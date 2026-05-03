"""Authentication: JWT email+password + Emergent Google OAuth + RBAC."""
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
import bcrypt
import jwt
import httpx
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "168"))
COOKIE_NAME = "or_token"

bearer_scheme = HTTPBearer(auto_error=False)


def set_auth_cookie(response: Response, token: str) -> None:
    """Set HttpOnly JWT cookie. Secure + SameSite=None to work across the ingress."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRE_HOURS * 3600,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/", samesite="none", secure=True)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_jwt(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session. Please sign in again.")


async def verify_emergent_google_session(session_id: str) -> dict:
    """Call Emergent-managed Google OAuth session endpoint."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google session")
        return r.json()


def get_db():
    # Lazy import to avoid circular
    from server import db
    return db


CLEAR_COOKIE_HEADER = (
    f"{COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None"
)


def _unauthorized_with_cookie_clear(detail: str) -> HTTPException:
    return HTTPException(
        status_code=401,
        detail=detail,
        headers={"Set-Cookie": CLEAR_COOKIE_HEADER},
    )


async def get_current_user(
    request: Request,
    response: Response,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    # Prefer HttpOnly cookie, fall back to Authorization header
    token = request.cookies.get(COOKIE_NAME)
    if not token and creds is not None:
        token = creds.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated. Please sign in.")
    try:
        payload = decode_jwt(token)
    except HTTPException as e:
        # Stale/expired/invalid token: proactively clear the cookie
        raise _unauthorized_with_cookie_clear(e.detail) from e
    db = get_db()
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise _unauthorized_with_cookie_clear("Session no longer valid. Please sign in again.")
    return user


def require_role(*roles):
    async def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {', '.join(roles)}")
        return user

    return checker


async def require_admin(user=Depends(get_current_user)):
    """Admin gate — `is_admin=True` required regardless of role."""
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


async def write_audit(actor: dict, action: str, target_user_id: str | None = None,
                      target_email: str | None = None, meta: dict | None = None) -> None:
    """Best-effort audit-log writer. Never raises into the request path."""
    try:
        db = get_db()
        await db.audit_log.insert_one({
            "actor_id": actor.get("id"),
            "actor_email": actor.get("email"),
            "actor_role": actor.get("role"),
            "actor_is_admin": bool(actor.get("is_admin")),
            "action": action,
            "target_user_id": target_user_id,
            "target_email": target_email,
            "meta": meta or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass
