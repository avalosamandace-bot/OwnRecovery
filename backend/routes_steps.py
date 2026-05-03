"""12-Step inspired modern, secular reflections + per-user progress."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from models import StepReflectRequest, StepProgress
from auth import require_role, get_db

router = APIRouter(prefix="/api/steps", tags=["steps"])

STEPS = [
    {"n": 1, "title": "Acknowledge your struggle honestly",
     "prompt": "What is the most honest thing you can say about your relationship with substances or behaviors right now?"},
    {"n": 2, "title": "Accept that you need support",
     "prompt": "Recovery isn't done alone. Who or what has helped — even a little — and who could help more?"},
    {"n": 3, "title": "Commit to change",
     "prompt": "What is one specific thing you are willing to do differently this week?"},
    {"n": 4, "title": "Reflect on patterns and triggers",
     "prompt": "Look at the last month: when did cravings or urges hit hardest? What was happening just before?"},
    {"n": 5, "title": "Share your truth with someone safe",
     "prompt": "What is one piece of your story you've been holding alone? Who is one person you could share part of it with?"},
    {"n": 6, "title": "Become willing to let go of what hurts you",
     "prompt": "What habit, belief, or relationship is keeping you stuck — even if part of you isn't ready to release it yet?"},
    {"n": 7, "title": "Ask for help when you need it",
     "prompt": "What's one place where pride or fear keeps you from asking for help?"},
    {"n": 8, "title": "Make a list of who you've affected",
     "prompt": "Who has been impacted by your struggle — including yourself? Names, not blame."},
    {"n": 9, "title": "Make repairs where it's safe to",
     "prompt": "Where can you repair, apologize, or make right — without causing further harm?"},
    {"n": 10, "title": "Stay honest, daily",
     "prompt": "What's one small honesty you can practice today, even just with yourself?"},
    {"n": 11, "title": "Build a daily practice that keeps you grounded",
     "prompt": "What practice — meditation, journaling, walks, prayer, music — steadies you? How often will you do it this week?"},
    {"n": 12, "title": "Carry this forward to others",
     "prompt": "How could supporting another person in their journey also support yours?"},
]


@router.get("")
async def list_steps(user=Depends(require_role("recovery_user"))):
    db = get_db()
    progress_docs = await db.twelve_steps_progress.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).to_list(50)
    by_n = {p["step_number"]: p for p in progress_docs}
    out = []
    for s in STEPS:
        p = by_n.get(s["n"])
        out.append({
            **s,
            "reflection": (p or {}).get("reflection", ""),
            "marked_reflected": (p or {}).get("marked_reflected", False),
            "updated_at": (p or {}).get("updated_at"),
        })
    completed = sum(1 for o in out if o["marked_reflected"])
    return {"steps": out, "completed": completed, "total": len(STEPS)}


@router.post("/{n}/reflect")
async def reflect(n: int, payload: StepReflectRequest, user=Depends(require_role("recovery_user"))):
    if n < 1 or n > 12:
        raise HTTPException(status_code=400, detail="Step number must be 1-12")
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "user_id": user["id"],
        "step_number": n,
        "reflection": payload.reflection or "",
        "marked_reflected": bool(payload.marked_reflected),
        "updated_at": now,
    }
    await db.twelve_steps_progress.update_one(
        {"user_id": user["id"], "step_number": n},
        {"$set": update, "$setOnInsert": {"id": StepProgress(user_id=user["id"], step_number=n).id}},
        upsert=True,
    )
    return {"ok": True}
