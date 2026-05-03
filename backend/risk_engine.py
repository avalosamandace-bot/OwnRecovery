"""Risk Scoring Engine — rule-based + scikit-learn logistic regression + XAI.

Design notes:
- Rule-based is the PRIMARY, displayed, interpretable model.
- Logistic Regression is a secondary experimental model trained on synthetic
  clinically-motivated data, exposed alongside rule-based for comparison.
- Both produce per-feature contributions (XAI).
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Optional
import numpy as np
from sklearn.linear_model import LogisticRegression

from models import FeatureContribution

# ---------- Clinically-motivated weights for rule-based model ----------
# Each feature contributes 0..max points. Signed where applicable.
RULE_WEIGHTS = {
    "craving": 30.0,      # 0-10 -> 0-30
    "stress": 20.0,       # 1-10 -> 0-20
    "sleep": 20.0,        # 0-4h -> 20, 5h ->15, 6h->10, 7h->5, 8+ ->0
    "mood": 15.0,         # low mood (1) -> 15, 10 -> 0
    "triggers": 15.0,     # per trigger +5, capped at 15
}


def _sleep_points(hours: float) -> float:
    if hours <= 3:
        return 20.0
    if hours <= 5:
        return 15.0
    if hours <= 6:
        return 10.0
    if hours <= 7:
        return 5.0
    return 0.0


def _mood_points(mood: int) -> float:
    # mood 1 (worst) -> 15, mood 10 (best) -> 0
    return round(((10 - mood) / 9.0) * RULE_WEIGHTS["mood"], 2)


def _level(score: float) -> str:
    if score < 35:
        return "low"
    if score < 65:
        return "medium"
    return "high"


def rule_based_score(entry: dict) -> Tuple[float, str, List[FeatureContribution], str]:
    """Return (score, level, contributions, narrative)."""
    craving = float(entry["craving"])
    stress = float(entry["stress"])
    sleep = float(entry["sleep_hours"])
    mood = int(entry["mood"])
    triggers = entry.get("triggers") or []

    contribs: List[FeatureContribution] = []

    c_pts = round((craving / 10.0) * RULE_WEIGHTS["craving"], 2)
    contribs.append(FeatureContribution(
        feature="craving", label="Craving intensity",
        value=craving, contribution=c_pts,
        direction="increase" if c_pts > 0 else "neutral",
    ))

    s_pts = round(((stress - 1) / 9.0) * RULE_WEIGHTS["stress"], 2)
    contribs.append(FeatureContribution(
        feature="stress", label="Stress level",
        value=stress, contribution=s_pts,
        direction="increase" if s_pts > 0 else "neutral",
    ))

    sl_pts = _sleep_points(sleep)
    contribs.append(FeatureContribution(
        feature="sleep", label="Sleep duration (hours)",
        value=sleep, contribution=sl_pts,
        direction="increase" if sl_pts > 0 else "decrease",
    ))

    m_pts = _mood_points(mood)
    contribs.append(FeatureContribution(
        feature="mood", label="Mood",
        value=mood, contribution=m_pts,
        direction="increase" if m_pts > 0 else "decrease",
    ))

    t_pts = min(len(triggers) * 5.0, RULE_WEIGHTS["triggers"])
    contribs.append(FeatureContribution(
        feature="triggers", label=f"Trigger events ({len(triggers)})",
        value=float(len(triggers)), contribution=t_pts,
        direction="increase" if t_pts > 0 else "neutral",
    ))

    total = round(min(100.0, sum(c.contribution for c in contribs)), 2)
    level = _level(total)

    # Narrative — order contributions by impact descending
    top = sorted(contribs, key=lambda c: c.contribution, reverse=True)[:3]
    bits = []
    for c in top:
        if c.contribution <= 0:
            continue
        bits.append(f"{c.label} contributed +{c.contribution:.0f}")
    if not bits:
        narrative = "All observed factors are within low-risk ranges today."
    else:
        narrative = "Today's risk is driven by: " + "; ".join(bits) + "."

    return total, level, contribs, narrative


# ---------- Logistic Regression (secondary, experimental) ----------
class LogisticRiskModel:
    """Logistic regression trained on a synthetic dataset at startup.

    Features: [craving, stress, inv_sleep(8-x clipped), inv_mood(10-x), n_triggers]
    Target: relapse risk binary derived from rule-based >= 60.
    """

    FEATURES = ["craving", "stress", "inv_sleep", "inv_mood", "n_triggers"]

    def __init__(self, seed: int = 42):
        self.model = LogisticRegression(max_iter=500)
        self._train(seed)

    def _synth(self, seed: int):
        rng = np.random.default_rng(seed)
        n = 4000
        craving = rng.integers(0, 11, n)
        stress = rng.integers(1, 11, n)
        sleep = rng.normal(7, 1.6, n).clip(0, 12)
        mood = rng.integers(1, 11, n)
        triggers = rng.integers(0, 5, n)
        X = np.stack([
            craving.astype(float),
            stress.astype(float),
            np.clip(8 - sleep, 0, 8),
            (10 - mood).astype(float),
            triggers.astype(float),
        ], axis=1)
        # Generate labels using a clinically reasonable linear combination + noise
        logit = (
            0.30 * craving
            + 0.18 * (stress - 1)
            + 0.22 * np.clip(8 - sleep, 0, 8)
            + 0.10 * (10 - mood)
            + 0.25 * triggers
            - 3.5
        )
        prob = 1 / (1 + np.exp(-logit))
        y = (rng.random(n) < prob).astype(int)
        return X, y

    def _train(self, seed: int):
        X, y = self._synth(seed)
        self.model.fit(X, y)

    def _vector(self, entry: dict) -> np.ndarray:
        return np.array([[
            float(entry["craving"]),
            float(entry["stress"]),
            float(max(0.0, 8.0 - float(entry["sleep_hours"]))),
            float(10 - int(entry["mood"])),
            float(len(entry.get("triggers") or [])),
        ]])

    def predict(self, entry: dict) -> Tuple[float, List[FeatureContribution]]:
        x = self._vector(entry)
        prob = float(self.model.predict_proba(x)[0, 1])
        score = round(prob * 100.0, 2)

        coefs = self.model.coef_[0]
        labels = {
            "craving": "Craving intensity",
            "stress": "Stress level",
            "inv_sleep": "Sleep deficit (below 8h)",
            "inv_mood": "Low mood (below 10)",
            "n_triggers": "Trigger events",
        }
        contribs: List[FeatureContribution] = []
        for i, feat in enumerate(self.FEATURES):
            value = float(x[0, i])
            # Contribution proportional to coef * value, normalized to ~0-100 scale
            raw = float(coefs[i]) * value
            contribs.append(FeatureContribution(
                feature=feat,
                label=labels[feat],
                value=value,
                contribution=round(raw * 10, 2),
                direction="increase" if raw > 0 else ("decrease" if raw < 0 else "neutral"),
            ))
        return score, contribs


# Singleton
_logistic_model: Optional[LogisticRiskModel] = None


def get_logistic_model() -> LogisticRiskModel:
    global _logistic_model
    if _logistic_model is None:
        _logistic_model = LogisticRiskModel()
    return _logistic_model


# ---------- Trend & Pattern detection ----------
def detect_patterns(entries: List[dict]) -> List[Dict]:
    """Return list of pattern flags. entries sorted by date ascending."""
    flags = []
    if len(entries) < 3:
        return flags

    last3 = entries[-3:]
    # 3-day upward stress
    stresses = [e["stress"] for e in last3]
    if stresses[0] < stresses[1] < stresses[2] and stresses[2] - stresses[0] >= 2:
        flags.append({
            "kind": "pattern",
            "level": "medium",
            "title": "3-day upward stress trend",
            "description": f"Stress increased from {stresses[0]} to {stresses[2]} over the last 3 days.",
            "suggested_action": "Consider a calming routine tonight and review recent triggers.",
        })

    # Declining sleep
    sleeps = [e["sleep_hours"] for e in last3]
    if sleeps[0] > sleeps[1] > sleeps[2] and sleeps[0] - sleeps[2] >= 1.5:
        flags.append({
            "kind": "pattern",
            "level": "medium",
            "title": "Declining sleep pattern",
            "description": f"Sleep dropped from {sleeps[0]:.1f}h to {sleeps[2]:.1f}h over 3 days.",
            "suggested_action": "Aim for consistent sleep hygiene tonight. Short sleep elevates relapse risk.",
        })

    # Rising cravings
    cravings = [e["craving"] for e in last3]
    if cravings[0] < cravings[1] < cravings[2] and cravings[2] - cravings[0] >= 2:
        flags.append({
            "kind": "pattern",
            "level": "high",
            "title": "Escalating craving intensity",
            "description": f"Cravings increased from {cravings[0]} to {cravings[2]}.",
            "suggested_action": "Reach out to a supporter or use a grounding exercise now.",
        })

    return flags


def moving_average(values: List[float], window: int = 7) -> List[Optional[float]]:
    out: List[Optional[float]] = []
    for i in range(len(values)):
        if i + 1 < window:
            out.append(None)
        else:
            out.append(round(sum(values[i + 1 - window:i + 1]) / window, 2))
    return out
