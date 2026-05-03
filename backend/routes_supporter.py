"""Supporter routes: invites, shared view, encouragement."""
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime, timezone, timedelta

from models import SupporterLink, InviteCreate, Encouragement, EncouragementCreate
from auth import require_role, get_current_user, get_db

router = APIRouter(prefix="/api/supporter", tags=["supporter"])


def _apply_consent(entry: dict, consent: dict) -> dict:
    """Filter an entry dict based on consent flags."""
    out = {"entry_date": entry["entry_date"]}
    if consent.get("share_mood"): out["mood"] = entry["mood"]
    if consent.get("share_craving"): out["craving"] = entry["craving"]
    if consent.get("share_sleep"): out["sleep_hours"] = entry["sleep_hours"]
    if consent.get("share_stress"): out["stress"] = entry["stress"]
    if consent.get("share_triggers"): out["triggers"] = entry.get("triggers", [])
    if consent.get("share_notes"): out["notes"] = entry.get("notes", "")
    return out


@router.post("/invite")
async def invite_supporter(payload: InviteCreate, user=Depends(require_role("recovery_user"))):
    db = get_db()
    existing = await db.supporter_links.find_one(
        {"user_id": user["id"], "supporter_email": payload.supporter_email}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Invitation already exists")

    # If supporter user exists, auto-link
    supporter = await db.users.find_one(
        {"email": payload.supporter_email, "role": "supporter"}, {"_id": 0}
    )
    link = SupporterLink(
        user_id=user["id"],
        supporter_email=payload.supporter_email,
        supporter_id=supporter["id"] if supporter else None,
        status="accepted" if supporter else "pending",
    )
    await db.supporter_links.insert_one(link.model_dump())
    return link.model_dump()


@router.get("/my-invites")
async def my_invites(user=Depends(require_role("recovery_user"))):
    db = get_db()
    cursor = db.supporter_links.find({"user_id": user["id"]}, {"_id": 0})
    return await cursor.to_list(50)


@router.get("/connections")
async def supporter_connections(user=Depends(require_role("supporter"))):
    """List recovery users a supporter is linked to."""
    db = get_db()
    # Link by supporter_id or email
    cursor = db.supporter_links.find(
        {"$or": [{"supporter_id": user["id"]}, {"supporter_email": user["email"]}],
         "status": "accepted"},
        {"_id": 0},
    )
    links = await cursor.to_list(50)
    # Backfill supporter_id if needed
    out = []
    for link in links:
        if not link.get("supporter_id"):
            await db.supporter_links.update_one(
                {"id": link["id"]}, {"$set": {"supporter_id": user["id"]}}
            )
            link["supporter_id"] = user["id"]
        ru = await db.users.find_one({"id": link["user_id"]}, {"_id": 0, "password_hash": 0})
        if ru:
            out.append({"link": link, "recovery_user": {"id": ru["id"], "name": ru["name"], "email": ru["email"]}})
    return out


@router.get("/view/{user_id}")
async def supporter_view_user(user_id: str, user=Depends(require_role("supporter"))):
    db = get_db()
    # Verify link exists & accepted
    link = await db.supporter_links.find_one(
        {"user_id": user_id, "status": "accepted",
         "$or": [{"supporter_id": user["id"]}, {"supporter_email": user["email"]}]},
        {"_id": 0},
    )
    if not link:
        raise HTTPException(status_code=403, detail="Not linked to this user")

    consent = await db.consents.find_one({"user_id": user_id}, {"_id": 0}) or {}
    ru = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not ru:
        raise HTTPException(status_code=404, detail="User not found")

    start = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    entries_cursor = db.health_entries.find(
        {"user_id": user_id, "entry_date": {"$gte": start}}, {"_id": 0}
    ).sort("entry_date", 1)
    entries = await entries_cursor.to_list(100)
    shared_entries = [_apply_consent(e, consent) for e in entries]

    latest_risk = None
    if consent.get("share_risk_score"):
        rs = await db.risk_scores.find_one(
            {"user_id": user_id}, {"_id": 0}, sort=[("entry_date", -1)]
        )
        if rs:
            latest_risk = {
                "entry_date": rs["entry_date"],
                "displayed_score": rs["displayed_score"],
                "level": rs["level"],
                "narrative": rs["narrative"],
            }

    alerts = []
    if consent.get("share_alerts"):
        ac = db.alerts.find(
            {"user_id": user_id, "level": {"$in": ["medium", "high"]}},
            {"_id": 0}
        ).sort("created_at", -1)
        alerts = await ac.to_list(20)

    return {
        "recovery_user": {"id": ru["id"], "name": ru["name"]},
        "consent": consent,
        "entries": shared_entries,
        "latest_risk": latest_risk,
        "alerts": alerts,
    }


@router.post("/encourage", response_model=Encouragement)
async def send_encouragement(payload: EncouragementCreate, user=Depends(require_role("supporter"))):
    db = get_db()
    link = await db.supporter_links.find_one(
        {"user_id": payload.user_id, "status": "accepted",
         "$or": [{"supporter_id": user["id"]}, {"supporter_email": user["email"]}]},
        {"_id": 0},
    )
    if not link:
        raise HTTPException(status_code=403, detail="Not linked")
    msg = Encouragement(
        user_id=payload.user_id,
        from_supporter_id=user["id"],
        from_supporter_name=user["name"],
        message=payload.message,
    )
    await db.encouragements.insert_one(msg.model_dump())
    return msg


@router.get("/messages")
async def my_encouragements(user=Depends(get_current_user)):
    db = get_db()
    cursor = db.encouragements.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(50)
