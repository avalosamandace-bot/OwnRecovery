"""Onboarding: 'I don't know where to start' guided flow + Day 1 plan (rule-based)."""
from fastapi import APIRouter, Depends, HTTPException
from models import OnboardingAnswers, Day1Plan, HealthEntry, RiskScore
from auth import require_role, get_db
from risk_engine import rule_based_score
from datetime import datetime, timezone

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


def _build_plan(a: OnboardingAnswers) -> Day1Plan:
    sleep_map = {
        "poor": ("Aim for 20 minutes earlier in bed tonight.", "Sleep shapes mood, cravings, and resilience — even small shifts matter."),
        "okay": ("Keep a gentle wind-down: dim lights 30 minutes before bed.", "Consistent sleep cues compound over time."),
        "good": ("Protect what's working — same bedtime tonight.", "Stable sleep is a strong protective factor in recovery."),
    }
    goal_text, why = sleep_map.get(a.sleep_quality, sleep_map["okay"])

    if a.stress_level >= 7:
        goal_text = "Take a 3-minute box-breathing break once today."
        why = "A short grounding exercise lowers acute stress without requiring energy you don't have."

    small_goal = goal_text
    suggested_checkin = (
        "Log today's check-in in under 90 seconds. Honest numbers matter more than ideal ones."
    )
    resource = {
        "title": "SAMHSA National Helpline",
        "why": "A free, confidential, 24/7 line for people navigating substance use and mental health.",
        "link": "https://www.samhsa.gov/find-help/national-helpline",
    }
    if a.sleep_quality == "poor":
        resource = {
            "title": "CDC Sleep Hygiene Tips",
            "why": "Practical, non-preachy habits that compound. Start with just one.",
            "link": "https://www.cdc.gov/sleep/about_sleep/sleep_hygiene.html",
        }
    elif a.stress_level >= 7:
        resource = {
            "title": "Box Breathing (4-4-4-4)",
            "why": "A short, portable grounding technique used in clinical settings.",
            "link": "https://www.healthline.com/health/box-breathing",
        }

    affirmation = "You're not alone. The fact that you showed up today is the start."
    return Day1Plan(
        small_goal=small_goal,
        suggested_checkin=suggested_checkin,
        recommended_resource=resource,
        affirmation=affirmation,
    )


@router.post("/plan", response_model=Day1Plan)
async def generate_plan(answers: OnboardingAnswers, user=Depends(require_role("recovery_user"))):
    db = get_db()
    plan = _build_plan(answers)

    # Mark user's onboarding mode
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"onboarding_mode": "guided"}}
    )

    # Also create a day-1 implicit check-in from the guided answers
    stress = int(answers.stress_level)
    sleep_hours = {"poor": 5.0, "okay": 6.5, "good": 7.5}.get(answers.sleep_quality, 6.5)
    # Map feeling_today keyword to rough mood score (very coarse — this is MVP)
    feel = (answers.feeling_today or "").lower()
    mood = 5
    if any(k in feel for k in ["good", "hopeful", "calm", "okay", "ok"]):
        mood = 7
    if any(k in feel for k in ["bad", "low", "down", "overwhelmed", "anxious"]):
        mood = 4
    if any(k in feel for k in ["hopeless", "numb", "desperate"]):
        mood = 2

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entry = HealthEntry(
        user_id=user["id"],
        entry_date=today,
        mood=mood, craving=3, sleep_hours=sleep_hours, stress=stress,
        triggers=[],
        notes=f"[Guided onboarding] {answers.feeling_today} / {answers.hardest_recently}",
    )
    existing = await db.health_entries.find_one(
        {"user_id": user["id"], "entry_date": today}, {"_id": 0}
    )
    if not existing:
        await db.health_entries.insert_one(entry.model_dump())
        rule_pts, level, contribs, narrative = rule_based_score(entry.model_dump())
        rs = RiskScore(
            user_id=user["id"], entry_id=entry.id, entry_date=today,
            rule_score=rule_pts, displayed_score=rule_pts, level=level,
            contributions=contribs, narrative=narrative,
        )
        await db.risk_scores.insert_one(rs.model_dump())

    return plan


@router.get("/status")
async def onboarding_status(user=Depends(require_role("recovery_user"))):
    db = get_db()
    has_entry = await db.health_entries.find_one({"user_id": user["id"]}, {"_id": 0})
    return {
        "onboarding_mode": user.get("onboarding_mode"),
        "has_data": bool(has_entry),
    }
