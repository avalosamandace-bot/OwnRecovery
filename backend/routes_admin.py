"""Admin / Backoffice routes — invite management, user listing, audit log.

All routes here require an authenticated user with `is_admin=True`.
The legacy `/api/admin/reset-demo` endpoint is preserved (env-gated, no auth).
"""
import os
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from auth import require_admin, get_db, write_audit
from models import ClinicianInvite

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ----- Public (env-gated) demo reset — preserved -----
@router.post("/reset-demo")
async def reset_demo():
    if os.environ.get("ENABLE_DEMO_RESET", "").lower() not in ("1", "true", "yes"):
        raise HTTPException(status_code=403, detail="Demo reset is disabled. Set ENABLE_DEMO_RESET=true to enable.")
    from seed import main as seed_main
    await seed_main()
    return {
        "ok": True,
        "message": "Demo data refreshed. Demo users + passwords are unchanged.",
        "demo_credentials": {
            "password": "demo1234",
            "accounts": [
                "alex@demo.own (recovery_user)",
                "jamie@demo.own (recovery_user)",
                "morgan@demo.own (recovery_user)",
                "sam@demo.own (supporter)",
                "drquinn@demo.own (clinician, verified)",
                "admin@demo.own (admin · backoffice)",
            ],
            "clinician_invites": ["CLINICIAN-DEMO-2026", "CLINICIAN-RESEARCH-01"],
            "admin_account": "admin@demo.own / demo1234",
        },
    }


# ----- Admin-gated -----
class InviteCreate(BaseModel):
    email_allowed: EmailStr | None = None
    expires_days: int = Field(default=30, ge=1, le=365)
    code_prefix: str | None = Field(default="CLIN", max_length=20)


class AdminUserUpdate(BaseModel):
    is_admin: bool | None = None
    verified_clinician: bool | None = None


@router.get("/me")
async def admin_me(user=Depends(require_admin)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "is_admin": True}


@router.get("/users")
async def list_users(user=Depends(require_admin), limit: int = 200):
    db = get_db()
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1)
    users = await cursor.to_list(limit)
    # enrich with last health entry date
    out = []
    for u in users:
        last_entry = await db.health_entries.find_one(
            {"user_id": u["id"]}, {"_id": 0, "entry_date": 1, "created_at": 1},
            sort=[("entry_date", -1)],
        )
        out.append({
            "id": u["id"],
            "email": u["email"],
            "name": u["name"],
            "role": u["role"],
            "verified_clinician": bool(u.get("verified_clinician")),
            "is_admin": bool(u.get("is_admin")),
            "auth_provider": "google" if u.get("google_sub") and not u.get("password_hash") else "password",
            "created_at": u.get("created_at"),
            "last_entry_date": last_entry["entry_date"] if last_entry else None,
        })
    await write_audit(user, "list_users", meta={"count": len(out)})
    return {"total": len(out), "users": out}


@router.patch("/users/{user_id}")
async def update_user_flags(user_id: str, payload: AdminUserUpdate, user=Depends(require_admin)):
    db = get_db()
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        return {"ok": True, "no_change": True}
    await db.users.update_one({"id": user_id}, {"$set": updates})
    await write_audit(user, "update_user_flags",
                      target_user_id=user_id, target_email=target["email"], meta=updates)
    return {"ok": True, "updated": updates}


@router.get("/invites")
async def list_invites(user=Depends(require_admin)):
    db = get_db()
    invites = await db.clinician_invites.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"total": len(invites), "invites": invites}


@router.post("/invites")
async def create_invite(payload: InviteCreate, user=Depends(require_admin)):
    db = get_db()
    prefix = (payload.code_prefix or "CLIN").upper().strip()
    code = f"{prefix}-{secrets.token_hex(4).upper()}"
    invite = ClinicianInvite(
        invite_code=code,
        email_allowed=payload.email_allowed,
        created_by_admin=user["email"],
        expires_at=(datetime.now(timezone.utc) + timedelta(days=payload.expires_days)).isoformat(),
    )
    await db.clinician_invites.insert_one(invite.model_dump())
    await write_audit(user, "invite_create", target_email=payload.email_allowed,
                      meta={"invite_code": code, "expires_days": payload.expires_days})
    return invite.model_dump()


@router.post("/invites/{invite_code}/revoke")
async def revoke_invite(invite_code: str, user=Depends(require_admin)):
    db = get_db()
    inv = await db.clinician_invites.find_one({"invite_code": invite_code}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found")
    if inv.get("used"):
        raise HTTPException(status_code=400, detail="Invite already used; cannot revoke.")
    await db.clinician_invites.update_one(
        {"invite_code": invite_code},
        {"$set": {"used": True, "used_by_user_id": "REVOKED",
                  "used_at": datetime.now(timezone.utc).isoformat()}},
    )
    await write_audit(user, "invite_revoke", meta={"invite_code": invite_code})
    return {"ok": True, "invite_code": invite_code, "revoked": True}


@router.get("/audit-log")
async def audit_log(user=Depends(require_admin), limit: int = 200, action: str | None = None):
    db = get_db()
    q: dict = {}
    if action:
        q["action"] = action
    rows = await db.audit_log.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"total": len(rows), "events": rows}


@router.get("/stats")
async def admin_stats(user=Depends(require_admin)):
    db = get_db()
    total_users = await db.users.count_documents({})
    by_role = {}
    for role in ("recovery_user", "supporter", "clinician"):
        by_role[role] = await db.users.count_documents({"role": role})
    invites_total = await db.clinician_invites.count_documents({})
    invites_used = await db.clinician_invites.count_documents({"used": True})
    audit_total = await db.audit_log.count_documents({})
    health_entries = await db.health_entries.count_documents({})
    cravings = await db.craving_checkins.count_documents({})
    return {
        "total_users": total_users,
        "by_role": by_role,
        "invites": {"total": invites_total, "used_or_revoked": invites_used,
                    "available": invites_total - invites_used},
        "audit_events": audit_total,
        "health_entries": health_entries,
        "craving_checkins": cravings,
    }
