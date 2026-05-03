"""Pydantic models for Own Recovery - structured longitudinal health record schema."""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, date
import uuid


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid() -> str:
    return str(uuid.uuid4())


Role = Literal["recovery_user", "supporter", "clinician"]


# ---------- User ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: Role = "recovery_user"
    clinician_invite_code: Optional[str] = None
    organization: Optional[str] = None
    onboarding_mode: Optional[str] = None
    license_number: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


VerificationStatus = Literal["pending", "simulated_verified", "rejected", "real_verified_future"]


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    role: Role
    created_at: str
    verified_clinician: bool = False
    verification_status: Optional[VerificationStatus] = None
    organization: Optional[str] = None
    onboarding_mode: Optional[str] = None  # "guided" or None
    sobriety_start_date: Optional[str] = None
    longest_streak_days: int = 0
    why_i_am_sober: Optional[str] = None
    motivation_tags: List[str] = []
    supporter_alerts_enabled: bool = False
    is_admin: bool = False


class UserDB(BaseModel):
    id: str = Field(default_factory=_uid)
    email: EmailStr
    name: str
    role: Role = "recovery_user"
    password_hash: Optional[str] = None  # None for Google-only users
    google_sub: Optional[str] = None
    verified_clinician: bool = False
    verification_status: Optional[VerificationStatus] = None
    license_number: Optional[str] = None
    organization: Optional[str] = None
    onboarding_mode: Optional[str] = None
    sobriety_start_date: Optional[str] = None  # YYYY-MM-DD
    longest_streak_days: int = 0
    why_i_am_sober: Optional[str] = None
    motivation_tags: List[str] = []
    supporter_alerts_enabled: bool = False
    is_admin: bool = False
    created_at: str = Field(default_factory=_iso_now)


# ---------- Sobriety ----------
class SobrietyStartRequest(BaseModel):
    start_date: str  # YYYY-MM-DD


class WhyImSoberRequest(BaseModel):
    why_i_am_sober: str = Field(min_length=1, max_length=600)
    motivation_tags: List[str] = []


class RelapseRequest(BaseModel):
    date: Optional[str] = None  # YYYY-MM-DD; defaults today
    note: Optional[str] = ""
    notify_supporter: bool = False


class Relapse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str
    date: str
    note: str = ""
    created_at: str = Field(default_factory=_iso_now)


# ---------- Craving toolkit ----------
class CravingCheckinRequest(BaseModel):
    level_before: int = Field(ge=0, le=10)
    trigger: Optional[str] = ""
    note: Optional[str] = ""
    context: Optional[str] = ""


class CravingAfterRequest(BaseModel):
    level_after: int = Field(ge=0, le=10)
    intervention_used: Optional[str] = ""  # "urge_surfing", "tape_forward", "breathing", etc.


class CravingCheckin(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str
    level_before: int
    level_after: Optional[int] = None
    trigger: str = ""
    note: str = ""
    context: str = ""
    intervention_used: Optional[str] = None
    created_at: str = Field(default_factory=_iso_now)


class TapeForwardRequest(BaseModel):
    q1_if_use: str = Field(min_length=1)
    q2_what_happens_after: str = Field(min_length=1)
    q3_how_tomorrow: str = Field(min_length=1)
    q4_safer_choice: str = Field(min_length=1)


class TapeForwardEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str
    q1_if_use: str
    q2_what_happens_after: str
    q3_how_tomorrow: str
    q4_safer_choice: str
    created_at: str = Field(default_factory=_iso_now)


# ---------- 12-Step Progress ----------
class StepReflectRequest(BaseModel):
    reflection: Optional[str] = ""
    marked_reflected: bool = True


class StepProgress(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str
    step_number: int
    reflection: str = ""
    marked_reflected: bool = False
    updated_at: str = Field(default_factory=_iso_now)


# ---------- Supporter alerts toggle ----------
class SupporterAlertsToggle(BaseModel):
    enabled: bool


# ---------- Clinician Invite ----------
class ClinicianInvite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    invite_code: str
    email_allowed: Optional[str] = None
    created_by_admin: str = "system"
    used: bool = False
    used_by_user_id: Optional[str] = None
    expires_at: Optional[str] = None  # ISO
    created_at: str = Field(default_factory=_iso_now)


# ---------- Onboarding (guided "I don't know where to start") ----------
class OnboardingAnswers(BaseModel):
    feeling_today: str = Field(min_length=1)  # free text
    hardest_recently: str = Field(min_length=1)
    sleep_quality: str  # "poor" | "okay" | "good"
    stress_level: int = Field(ge=1, le=10)


class Day1Plan(BaseModel):
    small_goal: str
    suggested_checkin: str
    recommended_resource: dict  # {"title": str, "why": str, "link": str}
    affirmation: str


# ---------- Health Check-in ----------
class HealthEntryCreate(BaseModel):
    mood: int = Field(ge=1, le=10, description="Mood scale 1-10 (10=best)")
    craving: int = Field(ge=0, le=10, description="Craving intensity 0-10")
    sleep_hours: float = Field(ge=0, le=24)
    stress: int = Field(ge=1, le=10, description="Stress 1-10 (10=worst)")
    triggers: List[str] = []
    notes: Optional[str] = ""
    entry_date: Optional[str] = None  # YYYY-MM-DD; defaults to today


class HealthEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str
    entry_date: str  # YYYY-MM-DD
    mood: int
    craving: int
    sleep_hours: float
    stress: int
    triggers: List[str] = []
    notes: str = ""
    created_at: str = Field(default_factory=_iso_now)


# ---------- Risk Score ----------
class FeatureContribution(BaseModel):
    feature: str
    label: str  # Human readable
    value: float
    contribution: float  # points added to risk (signed)
    direction: Literal["increase", "decrease", "neutral"] = "neutral"


class RiskScore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str
    entry_id: str
    entry_date: str
    rule_score: float  # 0-100
    ml_score: Optional[float] = None  # 0-100 from logistic regression
    displayed_score: float  # primary score shown (rule-based)
    level: Literal["low", "medium", "high"]
    contributions: List[FeatureContribution] = []
    narrative: str = ""
    created_at: str = Field(default_factory=_iso_now)


# ---------- Alert ----------
class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str
    kind: Literal["pattern", "risk", "trend"]
    level: Literal["low", "medium", "high"]
    title: str
    description: str
    suggested_action: str
    acknowledged: bool = False
    created_at: str = Field(default_factory=_iso_now)


# ---------- Consent ----------
class Consent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str
    share_mood: bool = True
    share_craving: bool = False
    share_sleep: bool = True
    share_stress: bool = True
    share_triggers: bool = False
    share_notes: bool = False
    share_risk_score: bool = True
    share_alerts: bool = True
    anonymize_clinician_view: bool = True
    updated_at: str = Field(default_factory=_iso_now)


class ConsentUpdate(BaseModel):
    share_mood: Optional[bool] = None
    share_craving: Optional[bool] = None
    share_sleep: Optional[bool] = None
    share_stress: Optional[bool] = None
    share_triggers: Optional[bool] = None
    share_notes: Optional[bool] = None
    share_risk_score: Optional[bool] = None
    share_alerts: Optional[bool] = None
    anonymize_clinician_view: Optional[bool] = None


# ---------- Supporter Link ----------
class SupporterLink(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str  # the recovery user
    supporter_email: str
    supporter_id: Optional[str] = None  # set when accepted
    status: Literal["pending", "accepted", "revoked"] = "pending"
    created_at: str = Field(default_factory=_iso_now)


class InviteCreate(BaseModel):
    supporter_email: EmailStr


class EncouragementCreate(BaseModel):
    user_id: str
    message: str = Field(min_length=1, max_length=500)


class Encouragement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str  # recipient (recovery user)
    from_supporter_id: str
    from_supporter_name: str
    message: str
    created_at: str = Field(default_factory=_iso_now)


# ---------- Weekly Summary ----------
class WeeklySummary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_id: str
    week_start: str
    week_end: str
    summary_text: str
    source: Literal["llm", "template"] = "template"
    stats: dict = {}
    created_at: str = Field(default_factory=_iso_now)
