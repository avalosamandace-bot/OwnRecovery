"""Craving check-in + Urge Surfing + Play the Tape Forward."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from typing import List
from models import (
    CravingCheckinRequest, CravingAfterRequest, CravingCheckin,
    TapeForwardRequest, TapeForwardEntry,
)
from auth import require_role, get_db

router = APIRouter(prefix="/api/craving", tags=["craving"])

MICRO_INTERVENTIONS = [
    {"id": "breathing", "title": "Take 3 deep breaths", "tag": "calm"},
    {"id": "water", "title": "Drink a glass of water", "tag": "body"},
    {"id": "outside", "title": "Step outside for 2 minutes", "tag": "shift"},
    {"id": "message", "title": "Message someone you trust", "tag": "connect"},
    {"id": "why", "title": "Open your Why I'm Sober card", "tag": "anchor"},
    {"id": "urge_surf", "title": "Start an urge-surfing timer", "tag": "ride"},
    {"id": "tape", "title": "Play the tape forward", "tag": "reflect"},
]


@router.get("/interventions")
async def list_interventions(user=Depends(require_role("recovery_user"))):
    return MICRO_INTERVENTIONS


@router.post("/checkin", response_model=CravingCheckin)
async def craving_checkin(payload: CravingCheckinRequest, user=Depends(require_role("recovery_user"))):
    db = get_db()
    c = CravingCheckin(
        user_id=user["id"],
        level_before=payload.level_before,
        trigger=payload.trigger or "",
        note=payload.note or "",
        context=payload.context or "",
    )
    await db.craving_checkins.insert_one(c.model_dump())
    return c


@router.patch("/checkin/{checkin_id}/after")
async def craving_after(checkin_id: str, payload: CravingAfterRequest, user=Depends(require_role("recovery_user"))):
    db = get_db()
    r = await db.craving_checkins.update_one(
        {"id": checkin_id, "user_id": user["id"]},
        {"$set": {
            "level_after": payload.level_after,
            "intervention_used": payload.intervention_used or None,
        }},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Craving check-in not found")
    doc = await db.craving_checkins.find_one({"id": checkin_id}, {"_id": 0})
    delta = doc["level_before"] - (doc.get("level_after") or doc["level_before"])
    return {"ok": True, "delta": delta, "checkin": doc}


@router.get("/recent")
async def recent_cravings(days: int = 14, user=Depends(require_role("recovery_user"))):
    db = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cur = db.craving_checkins.find(
        {"user_id": user["id"], "created_at": {"$gte": since}}, {"_id": 0}
    ).sort("created_at", -1)
    return await cur.to_list(200)


@router.post("/tape-forward", response_model=TapeForwardEntry)
async def tape_forward(payload: TapeForwardRequest, user=Depends(require_role("recovery_user"))):
    db = get_db()
    entry = TapeForwardEntry(user_id=user["id"], **payload.model_dump())
    await db.tape_forward_entries.insert_one(entry.model_dump())
    return entry


@router.get("/tape-forward/recent")
async def recent_tape(user=Depends(require_role("recovery_user"))):
    db = get_db()
    cur = db.tape_forward_entries.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(20)
