"""Health check-ins, risk scores, trends, alerts for recovery_user."""
import io
import csv
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional

from models import (
    HealthEntryCreate, HealthEntry, RiskScore, Alert,
)
from auth import require_role, get_db
from risk_engine import (
    rule_based_score, get_logistic_model, detect_patterns, moving_average,
)

router = APIRouter(prefix="/api/health", tags=["health"])


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@router.post("/checkin", response_model=dict)
async def submit_checkin(payload: HealthEntryCreate, user=Depends(require_role("recovery_user"))):
    db = get_db()
    entry_date = payload.entry_date or _today()

    # Upsert (one entry per user per date)
    existing = await db.health_entries.find_one(
        {"user_id": user["id"], "entry_date": entry_date}, {"_id": 0}
    )
    entry = HealthEntry(
        user_id=user["id"],
        entry_date=entry_date,
        mood=payload.mood,
        craving=payload.craving,
        sleep_hours=payload.sleep_hours,
        stress=payload.stress,
        triggers=payload.triggers,
        notes=payload.notes or "",
    )
    if existing:
        entry.id = existing["id"]
        entry.created_at = existing["created_at"]
        await db.health_entries.replace_one(
            {"user_id": user["id"], "entry_date": entry_date}, entry.model_dump()
        )
    else:
        await db.health_entries.insert_one(entry.model_dump())

    # Compute risk score (both models)
    edict = entry.model_dump()
    rule_pts, level, contribs, narrative = rule_based_score(edict)
    ml_score, _ml_contribs = get_logistic_model().predict(edict)

    rs = RiskScore(
        user_id=user["id"],
        entry_id=entry.id,
        entry_date=entry_date,
        rule_score=rule_pts,
        ml_score=ml_score,
        displayed_score=rule_pts,
        level=level,
        contributions=contribs,
        narrative=narrative,
    )
    await db.risk_scores.replace_one(
        {"user_id": user["id"], "entry_date": entry_date},
        rs.model_dump(), upsert=True,
    )

    # Risk-level alert (only if medium/high)
    if level in ("medium", "high"):
        alert = Alert(
            user_id=user["id"],
            kind="risk",
            level=level,
            title=f"{level.capitalize()} risk detected for {entry_date}",
            description=narrative,
            suggested_action=(
                "Consider a supportive coping strategy — breathing, journaling, or a short walk."
                if level == "medium"
                else "Consider reaching out to a trusted supporter or your care contact."
            ),
        )
        await db.alerts.insert_one(alert.model_dump())

    # Pattern detection on last 7 days
    recent = await db.health_entries.find(
        {"user_id": user["id"]}, {"_id": 0},
    ).sort("entry_date", 1).to_list(30)
    flags = detect_patterns(recent[-7:] if len(recent) >= 3 else recent)
    for f in flags:
        # avoid duplicates for same title today
        existing_alert = await db.alerts.find_one(
            {"user_id": user["id"], "title": f["title"],
             "created_at": {"$gte": _today()}},
            {"_id": 0},
        )
        if not existing_alert:
            a = Alert(user_id=user["id"], **f)
            await db.alerts.insert_one(a.model_dump())

    return {
        "entry": entry.model_dump(),
        "risk": rs.model_dump(),
    }


@router.get("/entries", response_model=List[HealthEntry])
async def list_entries(
    days: int = Query(30, ge=1, le=365),
    user=Depends(require_role("recovery_user")),
):
    db = get_db()
    start = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    cursor = db.health_entries.find(
        {"user_id": user["id"], "entry_date": {"$gte": start}},
        {"_id": 0},
    ).sort("entry_date", 1)
    return await cursor.to_list(500)


@router.get("/risk/latest")
async def latest_risk(user=Depends(require_role("recovery_user"))):
    db = get_db()
    rs = await db.risk_scores.find_one(
        {"user_id": user["id"]}, {"_id": 0},
        sort=[("entry_date", -1)],
    )
    return rs


@router.get("/risk/series")
async def risk_series(
    days: int = Query(30, ge=1, le=365),
    user=Depends(require_role("recovery_user")),
):
    db = get_db()
    start = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    cursor = db.risk_scores.find(
        {"user_id": user["id"], "entry_date": {"$gte": start}},
        {"_id": 0},
    ).sort("entry_date", 1)
    items = await cursor.to_list(500)
    scores = [i["displayed_score"] for i in items]
    ma7 = moving_average(scores, 7)
    for i, item in enumerate(items):
        item["ma7"] = ma7[i]
    return items


@router.get("/alerts", response_model=List[Alert])
async def list_alerts(user=Depends(require_role("recovery_user"))):
    db = get_db()
    cursor = db.alerts.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(100)


@router.post("/alerts/{alert_id}/acknowledge")
async def ack_alert(alert_id: str, user=Depends(require_role("recovery_user"))):
    db = get_db()
    r = await db.alerts.update_one(
        {"id": alert_id, "user_id": user["id"]},
        {"$set": {"acknowledged": True}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"ok": True}


@router.get("/risk/compare")
async def compare_models(user=Depends(require_role("recovery_user"))):
    """Return rule vs ML scores for the most recent entry (XAI comparison)."""
    db = get_db()
    entry = await db.health_entries.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("entry_date", -1)],
    )
    if not entry:
        return None
    rule_pts, level, rule_contribs, _ = rule_based_score(entry)
    ml_score, ml_contribs = get_logistic_model().predict(entry)
    return {
        "entry_date": entry["entry_date"],
        "rule": {
            "score": rule_pts,
            "level": level,
            "contributions": [c.model_dump() for c in rule_contribs],
        },
        "ml": {
            "score": ml_score,
            "contributions": [c.model_dump() for c in ml_contribs],
        },
    }


@router.delete("/data")
async def delete_all_data(user=Depends(require_role("recovery_user"))):
    """Right-to-delete: remove all health data for the current user."""
    db = get_db()
    await db.health_entries.delete_many({"user_id": user["id"]})
    await db.risk_scores.delete_many({"user_id": user["id"]})
    await db.alerts.delete_many({"user_id": user["id"]})
    await db.weekly_summaries.delete_many({"user_id": user["id"]})
    return {"ok": True, "message": "All personal health records deleted."}


@router.get("/export/csv")
async def export_csv(user=Depends(require_role("recovery_user"))):
    """Export all check-ins + risk scores as a single CSV."""
    db = get_db()
    entries = await db.health_entries.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("entry_date", 1).to_list(2000)
    risks_map = {}
    async for r in db.risk_scores.find({"user_id": user["id"]}, {"_id": 0}):
        risks_map[r["entry_date"]] = r

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "entry_date", "mood", "craving", "sleep_hours", "stress",
        "triggers", "notes", "risk_score", "risk_level", "rule_score", "ml_score",
    ])
    for e in entries:
        r = risks_map.get(e["entry_date"], {})
        writer.writerow([
            e["entry_date"], e["mood"], e["craving"], e["sleep_hours"], e["stress"],
            "|".join(e.get("triggers") or []),
            (e.get("notes") or "").replace("\n", " "),
            r.get("displayed_score", ""), r.get("level", ""),
            r.get("rule_score", ""), r.get("ml_score", ""),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=own-recovery-{user['id'][:8]}.csv"},
    )
