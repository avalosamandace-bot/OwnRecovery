"""Demo seed data for Own Recovery — IDEMPOTENT.

Demo users get DETERMINISTIC ids derived from their email (uuid5), so:
  • Re-seeding does NOT break tokens minted before the reseed.
  • Logins remain stable across restarts, reseeds, and tests.
  • Health/risk/alert history is fully refreshed, but users + consents persist.
"""
import asyncio
import os
import sys
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
import random
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
sys.path.insert(0, str(ROOT_DIR))

from motor.motor_asyncio import AsyncIOMotorClient

from models import UserDB, HealthEntry, RiskScore, Consent, SupporterLink, ClinicianInvite
from auth import hash_password
from risk_engine import rule_based_score, get_logistic_model, detect_patterns
from models import Alert


_NS = uuid.UUID("3f8b9c1e-5a2d-4f6e-9b1c-8a7d6e5f4c3b")


def demo_user_id(email: str) -> str:
    """Deterministic user id from email — survives reseeds."""
    return str(uuid.uuid5(_NS, email.lower().strip()))


DEMO_USERS = [
    {"email": "alex@demo.own", "name": "Alex Rivera", "role": "recovery_user", "password": "demo1234"},
    {"email": "jamie@demo.own", "name": "Jamie Chen", "role": "recovery_user", "password": "demo1234"},
    {"email": "morgan@demo.own", "name": "Morgan Lee", "role": "recovery_user", "password": "demo1234"},
    {"email": "sam@demo.own", "name": "Sam Patel", "role": "supporter", "password": "demo1234"},
    {"email": "drquinn@demo.own", "name": "Dr. Quinn Adams", "role": "clinician", "password": "demo1234"},
]


def _synth_entry(day_idx: int, profile: str):
    """Generate a plausible entry. profile alters trajectory."""
    random.seed(day_idx * 7 + hash(profile) % 100)
    if profile == "improving":
        base_mood = min(9, 4 + day_idx // 5)
        base_craving = max(0, 7 - day_idx // 4)
        base_stress = max(2, 8 - day_idx // 5)
        sleep = min(8.5, 5.5 + day_idx * 0.08)
    elif profile == "declining":
        base_mood = max(2, 8 - day_idx // 5)
        base_craving = min(9, 2 + day_idx // 4)
        base_stress = min(10, 3 + day_idx // 4)
        sleep = max(3.5, 7.5 - day_idx * 0.1)
    else:  # stable
        base_mood = 6
        base_craving = 3
        base_stress = 5
        sleep = 7.0
    mood = max(1, min(10, base_mood + random.randint(-1, 1)))
    craving = max(0, min(10, base_craving + random.randint(-1, 1)))
    stress = max(1, min(10, base_stress + random.randint(-1, 1)))
    sleep = round(max(3, min(10, sleep + random.uniform(-0.8, 0.8))), 1)
    trig_pool = ["work stress", "social event", "argument", "loneliness", "fatigue", "negative thought"]
    n_trig = random.choices([0, 1, 2, 3], weights=[55, 25, 15, 5])[0]
    triggers = random.sample(trig_pool, min(n_trig, len(trig_pool)))
    return {"mood": mood, "craving": craving, "stress": stress, "sleep_hours": sleep, "triggers": triggers}


async def main():
    mongo_url = os.environ["MONGO_URL"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ["DB_NAME"]]

    # Wipe time-series + helper collections (NOT users/consents — preserve identity across reseeds)
    for col in ["health_entries", "risk_scores", "alerts",
                "supporter_links", "encouragements", "weekly_summaries",
                "clinician_invites", "relapses", "craving_checkins",
                "tape_forward_entries", "twelve_steps_progress"]:
        await db[col].delete_many({})

    # Reset demo users to a known-good state via UPSERT (preserves stable ids)
    demo_emails = [u["email"] for u in DEMO_USERS]

    # Seed clinician invite codes
    await db.clinician_invites.insert_many([
        ClinicianInvite(invite_code="CLINICIAN-DEMO-2026", created_by_admin="seed").model_dump(),
        ClinicianInvite(invite_code="CLINICIAN-RESEARCH-01", created_by_admin="seed").model_dump(),
    ])

    users = []
    for u in DEMO_USERS:
        uid = demo_user_id(u["email"])
        existing = await db.users.find_one({"email": u["email"]}, {"_id": 0})
        # Build a fresh UserDB but FORCE the deterministic id and FRESH password hash
        kwargs = dict(
            id=uid,
            email=u["email"],
            name=u["name"],
            role=u["role"],
            password_hash=hash_password(u["password"]),
            verified_clinician=(u["role"] == "clinician"),
            verification_status=("simulated_verified" if u["role"] == "clinician" else None),
            organization=("City Behavioral Health" if u["role"] == "clinician" else None),
        )
        if existing and existing.get("created_at"):
            kwargs["created_at"] = existing["created_at"]
        udb = UserDB(**kwargs)
        doc = udb.model_dump()
        # Upsert by email; collapse duplicates with stale ids
        await db.users.update_one({"email": u["email"]}, {"$set": doc}, upsert=True)
        await db.users.delete_many({"email": u["email"], "id": {"$ne": uid}})
        await db.consents.update_one(
            {"user_id": uid},
            {"$setOnInsert": Consent(user_id=uid).model_dump()},
            upsert=True,
        )
        users.append(doc)

    # Link Sam (supporter) to Alex & Jamie
    recovery_users = [u for u in users if u["role"] == "recovery_user"]
    supporter = next(u for u in users if u["role"] == "supporter")
    for ru in recovery_users[:2]:
        link = SupporterLink(
            user_id=ru["id"],
            supporter_email=supporter["email"],
            supporter_id=supporter["id"],
            status="accepted",
        )
        await db.supporter_links.insert_one(link.model_dump())

    profiles = ["improving", "declining", "stable"]
    lr_model = get_logistic_model()
    today = datetime.now(timezone.utc).date()

    for ru, profile in zip(recovery_users, profiles):
        # Demo sobriety setup
        sobriety_days_map = {"improving": 90, "declining": 4, "stable": 365}
        days = sobriety_days_map.get(profile, 30)
        start = (today - timedelta(days=days)).isoformat()
        why_map = {
            "improving": "For my daughter's birthday this year, and to wake up without dread.",
            "declining": "To stop missing the moments that matter. For my partner. For me.",
            "stable": "Because I have proven I can do hard things, and I will not undo this.",
        }
        await db.users.update_one(
            {"id": ru["id"]},
            {"$set": {
                "sobriety_start_date": start,
                "longest_streak_days": days,
                "why_i_am_sober": why_map.get(profile, ""),
                "motivation_tags": ["family", "future", "self"],
            }},
        )

        for d in range(30):
            entry_date = (today - timedelta(days=29 - d)).strftime("%Y-%m-%d")
            s = _synth_entry(d, profile)
            entry = HealthEntry(
                user_id=ru["id"],
                entry_date=entry_date,
                mood=s["mood"], craving=s["craving"],
                sleep_hours=s["sleep_hours"], stress=s["stress"],
                triggers=s["triggers"], notes="",
            )
            await db.health_entries.insert_one(entry.model_dump())

            edict = entry.model_dump()
            rule_pts, level, contribs, narrative = rule_based_score(edict)
            ml_score, _ = lr_model.predict(edict)
            rs = RiskScore(
                user_id=ru["id"], entry_id=entry.id, entry_date=entry_date,
                rule_score=rule_pts, ml_score=ml_score, displayed_score=rule_pts,
                level=level, contributions=contribs, narrative=narrative,
            )
            await db.risk_scores.insert_one(rs.model_dump())

            if level in ("medium", "high") and d >= 25:
                a = Alert(
                    user_id=ru["id"], kind="risk", level=level,
                    title=f"{level.capitalize()} risk detected for {entry_date}",
                    description=narrative,
                    suggested_action=(
                        "Consider a supportive coping strategy — breathing, journaling, or a short walk."
                        if level == "medium"
                        else "Consider reaching out to a trusted supporter or your care contact."
                    ),
                )
                await db.alerts.insert_one(a.model_dump())

        # Pattern flags for declining profile
        if profile == "declining":
            last_entries = await db.health_entries.find(
                {"user_id": ru["id"]}, {"_id": 0}
            ).sort("entry_date", 1).to_list(50)
            for f in detect_patterns(last_entries[-7:]):
                a = Alert(user_id=ru["id"], **f)
                await db.alerts.insert_one(a.model_dump())

    print("Seed complete.")
    print("Demo accounts (password = demo1234):")
    for u in DEMO_USERS:
        print(f"  {u['role']:15s}  {u['email']}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
