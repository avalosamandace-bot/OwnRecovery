"""LLM-powered weekly summary via GPT-5.2 with template fallback.

Grounded strictly in structured data. No diagnosis. Calm tone.
"""
import os
import logging
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from models import WeeklySummary
from auth import require_role, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/summary", tags=["summary"])

SYSTEM_PROMPT = """You are an assistant that writes calm, factual weekly summaries for a behavioral health monitoring tool used in recovery care.

Strict rules:
- Ground every statement in the structured data provided. Do NOT invent numbers, dates or events.
- Do NOT provide medical diagnosis, treatment or clinical advice.
- Use a calm, respectful, non-alarming, non-judgmental tone.
- Reference observed patterns objectively (e.g., "sleep averaged 6.1 hours, 0.8 hours below the prior week").
- Keep output under 160 words, plain prose (no markdown headers, no bullet points).
- Never use exclamation marks. Never use emojis.
- Close with one gentle, concrete self-care suggestion grounded in the data.
"""


def _compute_stats(entries):
    if not entries:
        return {}
    avg = lambda key: round(sum(e[key] for e in entries) / len(entries), 2)
    return {
        "days_logged": len(entries),
        "avg_mood": avg("mood"),
        "avg_craving": avg("craving"),
        "avg_sleep": avg("sleep_hours"),
        "avg_stress": avg("stress"),
        "total_triggers": sum(len(e.get("triggers") or []) for e in entries),
    }


def _template_summary(stats, risk_avg):
    if not stats:
        return "No check-in data recorded this week. Logging your daily check-in helps reveal patterns over time."
    parts = [
        f"You logged {stats['days_logged']} check-ins this week.",
        f"Average mood was {stats['avg_mood']}/10, sleep averaged {stats['avg_sleep']}h, stress averaged {stats['avg_stress']}/10, and craving intensity averaged {stats['avg_craving']}/10.",
        f"There were {stats['total_triggers']} trigger events recorded.",
        f"Average relapse risk this week was {risk_avg}/100.",
    ]
    if stats["avg_sleep"] < 6.5:
        parts.append("Sleep was below the recommended range — consider a consistent wind-down routine tonight.")
    elif stats["avg_stress"] >= 7:
        parts.append("Stress ran high this week — a short grounding exercise may help.")
    else:
        parts.append("Keep logging check-ins to build a clearer picture over the coming weeks.")
    return " ".join(parts)


@router.post("/weekly", response_model=WeeklySummary)
async def generate_weekly(user=Depends(require_role("recovery_user"))):
    db = get_db()
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    start_s, end_s = start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")

    entries = await db.health_entries.find(
        {"user_id": user["id"], "entry_date": {"$gte": start_s}}, {"_id": 0}
    ).sort("entry_date", 1).to_list(14)

    risks = await db.risk_scores.find(
        {"user_id": user["id"], "entry_date": {"$gte": start_s}}, {"_id": 0}
    ).to_list(14)
    risk_avg = round(sum(r["displayed_score"] for r in risks) / len(risks), 2) if risks else 0.0

    stats = _compute_stats(entries)
    source = "template"
    text = _template_summary(stats, risk_avg)

    # Try LLM
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if api_key and entries:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"weekly-{user['id']}-{end_s}",
                system_message=SYSTEM_PROMPT,
            ).with_model("openai", "gpt-5.2")
            data_block = {
                "week": f"{start_s} to {end_s}",
                "stats": stats,
                "avg_risk_score_0_100": risk_avg,
                "daily_entries": [
                    {k: e[k] for k in ["entry_date", "mood", "craving", "sleep_hours", "stress"]
                     if k in e} | {"triggers": len(e.get("triggers") or [])}
                    for e in entries
                ],
            }
            msg = UserMessage(
                text="Write the weekly summary based strictly on this JSON:\n"
                     + str(data_block)
            )
            resp = await chat.send_message(msg)
            if resp and isinstance(resp, str) and len(resp.strip()) > 20:
                text = resp.strip()
                source = "llm"
    except Exception as e:
        logger.warning(f"LLM weekly summary failed, using template: {e}")

    summary = WeeklySummary(
        user_id=user["id"],
        week_start=start_s,
        week_end=end_s,
        summary_text=text,
        source=source,
        stats={**stats, "avg_risk_score": risk_avg},
    )
    await db.weekly_summaries.insert_one(summary.model_dump())
    return summary


@router.get("/weekly/latest")
async def latest_weekly(user=Depends(require_role("recovery_user"))):
    db = get_db()
    s = await db.weekly_summaries.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    return s
