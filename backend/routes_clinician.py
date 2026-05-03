"""Clinician view routes (read-only, anonymization-aware)."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
import hashlib

from auth import require_role, get_db
from risk_engine import detect_patterns
from fastapi import Depends, HTTPException

router = APIRouter(prefix="/api/clinician", tags=["clinician"])


async def require_verified_clinician(user=Depends(require_role("clinician"))):
    if not user.get("verified_clinician"):
        raise HTTPException(
            status_code=403,
            detail="Clinician not verified. Contact an administrator for an invite code.",
        )
    return user


def _anon_id(uid: str) -> str:
    return "P-" + hashlib.sha256(uid.encode()).hexdigest()[:6].upper()


@router.get("/patients")
async def list_patients(user=Depends(require_verified_clinician)):
    db = get_db()
    # Clinician sees all recovery_users (simulation), but names are hidden
    # when the user has enabled anonymize_clinician_view (default True).
    cursor = db.users.find({"role": "recovery_user"}, {"_id": 0, "password_hash": 0})
    users = await cursor.to_list(200)
    out = []
    for u in users:
        consent = await db.consents.find_one({"user_id": u["id"]}, {"_id": 0}) or {}
        anon = consent.get("anonymize_clinician_view", True)
        latest_risk = await db.risk_scores.find_one(
            {"user_id": u["id"]}, {"_id": 0}, sort=[("entry_date", -1)],
        )
        alerts_count = await db.alerts.count_documents(
            {"user_id": u["id"], "level": {"$in": ["medium", "high"]}, "acknowledged": False}
        )
        out.append({
            "id": u["id"],
            "display_name": _anon_id(u["id"]) if anon else u["name"],
            "anonymized": anon,
            "latest_risk": (
                {"score": latest_risk["displayed_score"], "level": latest_risk["level"],
                 "entry_date": latest_risk["entry_date"]} if latest_risk else None
            ),
            "open_alerts": alerts_count,
        })
    # Sort high-risk first
    def _k(x):
        order = {"high": 0, "medium": 1, "low": 2, None: 3}
        return order.get(x["latest_risk"]["level"] if x["latest_risk"] else None, 3)
    out.sort(key=_k)
    return out


@router.get("/patients/{patient_id}")
async def patient_detail(patient_id: str, user=Depends(require_verified_clinician)):
    db = get_db()
    u = await db.users.find_one({"id": patient_id, "role": "recovery_user"}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Patient not found")
    consent = await db.consents.find_one({"user_id": patient_id}, {"_id": 0}) or {}
    anon = consent.get("anonymize_clinician_view", True)

    start = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    entries = await db.health_entries.find(
        {"user_id": patient_id, "entry_date": {"$gte": start}}, {"_id": 0}
    ).sort("entry_date", 1).to_list(200)
    risks = await db.risk_scores.find(
        {"user_id": patient_id, "entry_date": {"$gte": start}}, {"_id": 0}
    ).sort("entry_date", 1).to_list(200)
    patterns = detect_patterns(entries[-7:] if len(entries) >= 3 else entries)

    return {
        "id": u["id"],
        "display_name": _anon_id(u["id"]) if anon else u["name"],
        "anonymized": anon,
        "entries": entries,
        "risks": risks,
        "flagged_patterns": patterns,
    }


@router.get("/overview")
async def overview(user=Depends(require_verified_clinician)):
    """Aggregate risk distribution across population."""
    db = get_db()
    users = await db.users.find({"role": "recovery_user"}, {"_id": 0}).to_list(200)
    dist = {"low": 0, "medium": 0, "high": 0, "no_data": 0}
    for u in users:
        r = await db.risk_scores.find_one(
            {"user_id": u["id"]}, {"_id": 0}, sort=[("entry_date", -1)]
        )
        if not r:
            dist["no_data"] += 1
        else:
            dist[r["level"]] = dist.get(r["level"], 0) + 1
    total = len(users)
    return {"total_patients": total, "risk_distribution": dist}
