"""Developer-only demo reset endpoint. ENV-gated."""
import os
import asyncio
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/reset-demo")
async def reset_demo():
    """Run the idempotent seed to restore demo users and refresh demo health data.

    Disabled unless ENABLE_DEMO_RESET=true is set in the environment.
    Safe to call repeatedly: demo user IDs and passwords stay stable across calls.
    """
    if os.environ.get("ENABLE_DEMO_RESET", "").lower() not in ("1", "true", "yes"):
        raise HTTPException(
            status_code=403,
            detail="Demo reset is disabled. Set ENABLE_DEMO_RESET=true to enable.",
        )
    # Import lazily to avoid circulars
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
            ],
            "clinician_invites": ["CLINICIAN-DEMO-2026", "CLINICIAN-RESEARCH-01"],
        },
    }
