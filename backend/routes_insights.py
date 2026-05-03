"""AI Observations + Insight Cards + forecast — data-grounded, rule-based."""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from auth import require_role, get_db

router = APIRouter(prefix="/api/insights", tags=["insights"])


def _mean(vals: List[float]) -> float:
    return round(sum(vals) / len(vals), 2) if vals else 0.0


def _pct_change(a: float, b: float) -> float:
    if a == 0:
        return 0.0
    return round(((b - a) / a) * 100, 1)


@router.get("/observations")
async def observations(user=Depends(require_role("recovery_user"))):
    """Natural-language AI observations grounded strictly in data."""
    db = get_db()
    start = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
    entries = await db.health_entries.find(
        {"user_id": user["id"], "entry_date": {"$gte": start}}, {"_id": 0}
    ).sort("entry_date", 1).to_list(30)

    obs: List[Dict[str, Any]] = []
    if len(entries) < 3:
        return {"observations": [{
            "tone": "neutral",
            "text": "Log a few more check-ins to unlock personalized AI observations.",
        }], "insight_cards": [], "forecast": None}

    prev7 = entries[-14:-7] if len(entries) >= 14 else entries[: max(1, len(entries) - 3)]
    last7 = entries[-7:]

    def avg(lst, k): return _mean([e[k] for e in lst])

    # Stress trend
    if last7 and prev7:
        s_now = avg(last7, "stress"); s_prev = avg(prev7, "stress")
        delta = round(s_now - s_prev, 2)
        if delta >= 1.0:
            obs.append({
                "tone": "warn",
                "text": f"Stress has increased over the past week (avg {s_now} vs {s_prev} prior week).",
            })
        elif delta <= -1.0:
            obs.append({
                "tone": "good",
                "text": f"Stress has eased this week (avg {s_now} vs {s_prev} prior week).",
            })

    # Sleep
    if last7 and prev7:
        sl_now = avg(last7, "sleep_hours"); sl_prev = avg(prev7, "sleep_hours")
        if sl_prev - sl_now >= 0.6:
            obs.append({
                "tone": "warn",
                "text": f"Sleep has declined ({sl_now}h avg vs {sl_prev}h prior week). Short sleep is a known risk amplifier.",
            })

    # Sleep-craving correlation (simple coincidence flag)
    if len(entries) >= 5:
        low_sleep_days = [e for e in entries if e["sleep_hours"] < 6]
        if low_sleep_days and _mean([e["craving"] for e in low_sleep_days]) >= 5:
            obs.append({
                "tone": "warn",
                "text": f"Low-sleep days ({len(low_sleep_days)} in the window) coincided with higher craving intensity.",
            })

    # Trigger escalation
    t_prev = sum(len(e.get("triggers") or []) for e in prev7)
    t_now = sum(len(e.get("triggers") or []) for e in last7)
    if t_now > t_prev + 2:
        obs.append({
            "tone": "warn",
            "text": f"More trigger events logged this week ({t_now}) than last ({t_prev}).",
        })

    # Mood
    m_now = avg(last7, "mood")
    if m_now >= 7:
        obs.append({"tone": "good", "text": f"Mood has been stable-to-positive this week (avg {m_now}/10)."})
    elif m_now <= 4:
        obs.append({"tone": "warn", "text": f"Mood has trended low this week (avg {m_now}/10)."})

    # Risk-based observation
    risks = await db.risk_scores.find(
        {"user_id": user["id"], "entry_date": {"$gte": start}}, {"_id": 0}
    ).sort("entry_date", 1).to_list(30)
    risk_forecast = None
    if len(risks) >= 4:
        recent_trend = [r["displayed_score"] for r in risks[-4:]]
        if recent_trend[-1] > recent_trend[0] + 8:
            risk_forecast = {
                "direction": "up",
                "text": "Risk may continue to increase if current sleep and stress trends persist.",
                "basis": {"from": recent_trend[0], "to": recent_trend[-1]},
            }
        elif recent_trend[-1] < recent_trend[0] - 8:
            risk_forecast = {
                "direction": "down",
                "text": "Risk trajectory is improving based on the last 4 readings.",
                "basis": {"from": recent_trend[0], "to": recent_trend[-1]},
            }

    # Insight cards — compact quantitative insights
    cards: List[Dict[str, Any]] = []
    if last7 and prev7:
        c_now = avg(last7, "craving"); c_prev = avg(prev7, "craving")
        cards.append({
            "title": "Craving intensity",
            "value": f"{c_now}/10",
            "delta": _pct_change(c_prev, c_now),
            "period": "vs prior week",
        })
        cards.append({
            "title": "Sleep",
            "value": f"{avg(last7,'sleep_hours')}h",
            "delta": _pct_change(avg(prev7,'sleep_hours'), avg(last7,'sleep_hours')),
            "period": "vs prior week",
        })
        cards.append({
            "title": "Stress",
            "value": f"{avg(last7,'stress')}/10",
            "delta": _pct_change(avg(prev7,'stress'), avg(last7,'stress')),
            "period": "vs prior week",
        })
        if risks:
            r_now = _mean([r["displayed_score"] for r in risks[-7:]])
            r_prev = _mean([r["displayed_score"] for r in risks[:-7][-7:]] if len(risks) > 7 else risks[:-7]) if len(risks) > 7 else r_now
            cards.append({
                "title": "Avg risk",
                "value": f"{r_now}/100",
                "delta": _pct_change(r_prev, r_now) if r_prev else 0,
                "period": "vs prior week",
            })

    if not obs:
        obs.append({"tone": "neutral", "text": "No significant changes observed this week. Keep logging check-ins to build the picture."})

    return {"observations": obs, "insight_cards": cards, "forecast": risk_forecast}
