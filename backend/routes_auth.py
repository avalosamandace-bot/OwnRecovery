"""Auth routes: email+password signup/login + Emergent Google OAuth + HttpOnly cookies
+ clinician invite validation."""
from fastapi import APIRouter, HTTPException, Depends, Response, Request
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from models import (
    UserCreate, UserLogin, UserDB, UserPublic, Consent, ClinicianInvite,
)
from auth import (
    hash_password, verify_password, create_jwt,
    verify_emergent_google_session, get_current_user, get_db,
    set_auth_cookie, clear_auth_cookie, COOKIE_NAME,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class GoogleLoginRequest(BaseModel):
    session_id: str
    role: str | None = None


class InviteValidateRequest(BaseModel):
    invite_code: str
    email: EmailStr | None = None


class AuthResponse(BaseModel):
    token: str  # still returned (useful for tests); also set as HttpOnly cookie
    user: UserPublic


class LoginRequest(UserLogin):
    expected_role: str | None = None  # optional — if present, login must match role


async def _ensure_consent(user_id: str):
    db = get_db()
    existing = await db.consents.find_one({"user_id": user_id}, {"_id": 0})
    if not existing:
        c = Consent(user_id=user_id)
        await db.consents.insert_one(c.model_dump())


def _to_public(u: dict) -> UserPublic:
    return UserPublic(
        id=u["id"], email=u["email"], name=u["name"], role=u["role"],
        created_at=u["created_at"],
        verified_clinician=bool(u.get("verified_clinician", False)),
        verification_status=u.get("verification_status"),
        organization=u.get("organization"),
        onboarding_mode=u.get("onboarding_mode"),
    )


async def _consume_clinician_invite(code: str, email: str) -> ClinicianInvite:
    db = get_db()
    invite_doc = await db.clinician_invites.find_one({"invite_code": code}, {"_id": 0})
    if not invite_doc:
        raise HTTPException(status_code=400, detail="Invalid clinician invite code.")
    invite = ClinicianInvite(**invite_doc)
    if invite.used:
        raise HTTPException(status_code=400, detail="This invite code has already been used.")
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=400, detail="This invite code has expired.")
    if invite.email_allowed and invite.email_allowed.lower() != email.lower():
        raise HTTPException(status_code=400, detail="This invite code is restricted to a different email.")
    return invite


@router.post("/invite/validate")
async def validate_invite(payload: InviteValidateRequest):
    """Front-end check before exposing clinician signup form."""
    db = get_db()
    invite = await db.clinician_invites.find_one({"invite_code": payload.invite_code}, {"_id": 0})
    if not invite or invite.get("used"):
        return {"valid": False, "reason": "Invalid or already used"}
    if invite.get("email_allowed") and payload.email and invite["email_allowed"].lower() != payload.email.lower():
        return {"valid": False, "reason": "Email restricted"}
    if invite.get("expires_at") and invite["expires_at"] < datetime.now(timezone.utc).isoformat():
        return {"valid": False, "reason": "Expired"}
    return {"valid": True, "email_restricted": bool(invite.get("email_allowed")), "organization_hint": None}


@router.post("/signup", response_model=AuthResponse)
async def signup(payload: UserCreate, response: Response):
    db = get_db()
    existing = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    verified_clinician = False
    verification_status = None
    invite: ClinicianInvite | None = None

    if payload.role == "clinician":
        if not payload.clinician_invite_code:
            raise HTTPException(
                status_code=403,
                detail="Clinician accounts require a valid invite code.",
            )
        invite = await _consume_clinician_invite(payload.clinician_invite_code, payload.email)
        verified_clinician = True
        verification_status = "simulated_verified"

    user = UserDB(
        email=payload.email,
        name=payload.name,
        role=payload.role,
        password_hash=hash_password(payload.password),
        verified_clinician=verified_clinician,
        verification_status=verification_status,
        license_number=payload.license_number if payload.role == "clinician" else None,
        organization=payload.organization if payload.role == "clinician" else None,
    )
    await db.users.insert_one(user.model_dump())
    await _ensure_consent(user.id)

    if invite:
        await db.clinician_invites.update_one(
            {"invite_code": invite.invite_code},
            {"$set": {"used": True, "used_by_user_id": user.id,
                      "used_at": datetime.now(timezone.utc).isoformat()}},
        )

    token = create_jwt(user.id, user.role)
    set_auth_cookie(response, token)
    return AuthResponse(token=token, user=_to_public(user.model_dump()))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, response: Response):
    db = get_db()
    user = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Email not found. Check the address or create a new account.")
    if not user.get("password_hash"):
        raise HTTPException(
            status_code=401,
            detail="This account was created via Google sign-in. Please use Google to log in.",
        )
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password.")
    if payload.expected_role and user["role"] != payload.expected_role:
        raise HTTPException(
            status_code=403,
            detail=f"Account role mismatch. This email is registered as {user['role']}, not {payload.expected_role}.",
        )
    token = create_jwt(user["id"], user["role"])
    set_auth_cookie(response, token)
    return AuthResponse(token=token, user=_to_public(user))


@router.post("/google", response_model=AuthResponse)
async def google_login(payload: GoogleLoginRequest, response: Response):
    db = get_db()
    data = await verify_emergent_google_session(payload.session_id)
    email = data.get("email")
    name = data.get("name") or email.split("@")[0]
    sub = data.get("id") or data.get("sub") or email
    if not email:
        raise HTTPException(status_code=401, detail="Google session missing email")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        # Google signup is NOT allowed to create clinicians — enforce
        role = payload.role if payload.role in ("recovery_user", "supporter") else "recovery_user"
        new_user = UserDB(email=email, name=name, role=role, google_sub=sub)
        await db.users.insert_one(new_user.model_dump())
        await _ensure_consent(new_user.id)
        user = new_user.model_dump()
    else:
        if not user.get("google_sub"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"google_sub": sub}})

    token = create_jwt(user["id"], user["role"])
    set_auth_cookie(response, token)
    return AuthResponse(token=token, user=_to_public(user))


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return _to_public(user)
