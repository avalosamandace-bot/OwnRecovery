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
