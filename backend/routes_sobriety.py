"""Sobriety tracking + Why I'm Sober anchor + relapse logging."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, date, timedelta
from typing import List
from models import (
    SobrietyStartRequest, WhyImSoberRequest, RelapseRequest, Relapse,
)
from auth import require_role, get_db

router = APIRouter(prefix="/api/sobriety", tags=["sobriety"])

MILESTONES = [1, 7, 30, 60, 90, 180, 365, 730]


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _days_between(start: str) -> int:
    s = date.fromisoformat(start)
    today = date.fromisoformat(_today())
    return max(0, (today - s).days)


@router.post("/start")
async def set_start(payload: SobrietyStartRequest, user=Depends(require_role("recovery_user"))):
    db = get_db()
    # Validate not future-dated
    try:
        d = date.fromisoformat(payload.start_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date. Use YYYY-MM-DD.")
    if d > date.fromisoformat(_today()):
        raise HTTPException(status_code=400, detail="Start date cannot be in the future.")
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"sobriety_start_date": payload.start_date}}
    )
    streak = _days_between(payload.start_date)
    if streak > user.get("longest_streak_days", 0):
        await db.users.update_one({"id": user["id"]}, {"$set": {"longest_streak_days": streak}})
    return {"ok": True, "current_streak_days": streak}


@router.get("/status")
async def status(user=Depends(require_role("recovery_user"))):
    db = get_db()
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    relapses_cur = db.relapses.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1)
    relapses = await relapses_cur.to_list(50)
    start = fresh.get("sobriety_start_date")
    current = _days_between(start) if start else 0
    longest = max(fresh.get("longest_streak_days", 0), current)
    if longest != fresh.get("longest_streak_days", 0):
        await db.users.update_one({"id": user["id"]}, {"$set": {"longest_streak_days": longest}})

    # Milestones reached
    reached = [m for m in MILESTONES if m <= current]
    next_m = next((m for m in MILESTONES if m > current), None)
    return {
        "sobriety_start_date": start,
        "current_streak_days": current,
        "longest_streak_days": longest,
        "milestones_reached": reached,
        "next_milestone": next_m,
        "days_to_next_milestone": (next_m - current) if next_m else None,
        "relapse_history": relapses,
        "why_i_am_sober": fresh.get("why_i_am_sober"),
        "motivation_tags": fresh.get("motivation_tags", []),
    }


@router.post("/relapse")
async def log_relapse(payload: RelapseRequest, user=Depends(require_role("recovery_user"))):
    db = get_db()
    d = payload.date or _today()
    try:
        date.fromisoformat(d)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date. Use YYYY-MM-DD.")
    rel = Relapse(user_id=user["id"], date=d, note=payload.note or "")
    await db.relapses.insert_one(rel.model_dump())
    # Reset sobriety start to the day after relapse
    next_day = (date.fromisoformat(d) + timedelta(days=1)).isoformat()
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"sobriety_start_date": next_day}}
    )
    return {
        "ok": True,
        "supportive_message": "You didn't fail. You're still in recovery. Let's take the next step together.",
        "new_start_date": next_day,
    }


@router.post("/why")
async def set_why(payload: WhyImSoberRequest, user=Depends(require_role("recovery_user"))):
    db = get_db()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "why_i_am_sober": payload.why_i_am_sober,
            "motivation_tags": payload.motivation_tags or [],
        }},
    )
    return {"ok": True}


@router.get("/why")
async def get_why(user=Depends(require_role("recovery_user"))):
    db = get_db()
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return {
        "why_i_am_sober": fresh.get("why_i_am_sober"),
        "motivation_tags": fresh.get("motivation_tags", []),
    }


@router.post("/supporter-alerts")
async def toggle_supporter_alerts(enabled: bool, user=Depends(require_role("recovery_user"))):
    db = get_db()
    await db.users.update_one({"id": user["id"]}, {"$set": {"supporter_alerts_enabled": bool(enabled)}})
    return {"ok": True, "supporter_alerts_enabled": bool(enabled)}
