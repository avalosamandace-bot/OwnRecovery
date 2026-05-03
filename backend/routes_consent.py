"""Consent management routes."""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone

from models import Consent, ConsentUpdate
from auth import get_current_user, get_db

router = APIRouter(prefix="/api/consent", tags=["consent"])


@router.get("", response_model=Consent)
async def get_consent(user=Depends(get_current_user)):
    db = get_db()
    c = await db.consents.find_one({"user_id": user["id"]}, {"_id": 0})
    if not c:
        c = Consent(user_id=user["id"])
        await db.consents.insert_one(c.model_dump())
        return c
    return Consent(**c)


@router.patch("", response_model=Consent)
async def update_consent(payload: ConsentUpdate, user=Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.consents.update_one(
        {"user_id": user["id"]}, {"$set": updates}, upsert=True,
    )
    c = await db.consents.find_one({"user_id": user["id"]}, {"_id": 0})
    if "user_id" not in c:
        c["user_id"] = user["id"]
    return Consent(**c)


@router.get("/access-log")
async def my_access_log(user=Depends(get_current_user), limit: int = 50):
    """Return audit-log events where THIS user was the target.
    Lets the user see who (clinician/admin) accessed their record.
    """
    db = get_db()
    events = await db.audit_log.find(
        {"target_user_id": user["id"]}, {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    # Strip actor_id (internal); show role + email only
    out = []
    for e in events:
        out.append({
            "action": e.get("action"),
            "actor_email": e.get("actor_email"),
            "actor_role": e.get("actor_role"),
            "actor_is_admin": bool(e.get("actor_is_admin")),
            "anonymized": (e.get("meta") or {}).get("anonymized"),
            "created_at": e.get("created_at"),
        })
    return {"total": len(out), "events": out}


@router.get("/transparency")
async def transparency_summary(user=Depends(get_current_user)):
    """Aggregate transparency view: what we have on file & how it flows."""
    db = get_db()
    counts = {
        "health_entries": await db.health_entries.count_documents({"user_id": user["id"]}),
        "risk_scores": await db.risk_scores.count_documents({"user_id": user["id"]}),
        "craving_checkins": await db.craving_checkins.count_documents({"user_id": user["id"]}),
        "alerts": await db.alerts.count_documents({"user_id": user["id"]}),
        "supporter_links": await db.supporter_links.count_documents({"user_id": user["id"], "status": "accepted"}),
        "weekly_summaries": await db.weekly_summaries.count_documents({"user_id": user["id"]}),
    }
    consent = await db.consents.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    consent.pop("id", None)
    consent.pop("user_id", None)
    consent.pop("updated_at", None)
    return {
        "data_on_file": counts,
        "consent_snapshot": consent,
        "principles": [
            {"k": "consent_first",
             "title": "Consent is enforced at the API",
             "body": "Sharing toggles are not just UI hints — the backend filters every clinician/supporter response by your live consent."},
            {"k": "explainable",
             "title": "Every risk score is explainable",
             "body": "We always show which signals (sleep, mood, stress, cravings, triggers) contributed to your score and by how much."},
            {"k": "anonymizable",
             "title": "You can be anonymous to clinicians",
             "body": "When 'anonymize me in clinician view' is on, your name is replaced with an opaque P-code. Default: ON."},
            {"k": "human_in_loop",
             "title": "Human in the loop",
             "body": "AI flags risk and surfaces patterns; humans (you, your supporter, your clinician) make the decisions."},
            {"k": "right_to_export_delete",
             "title": "Right to export & delete",
             "body": "You can download or permanently delete your record at any time."},
        ],
    }

