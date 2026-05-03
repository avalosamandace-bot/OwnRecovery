"""Auth lifecycle regression tests.

Run after every seed/restart to catch auth regressions early:

    cd /app/backend && pytest tests/test_auth_lifecycle.py -v

Covers:
  • Idempotent reseed preserves user IDs (deterministic uuid5 from email)
  • Demo login works after fresh seed AND after re-seed
  • JWT token minted before reseed STILL works after reseed (because IDs are stable)
  • Logout clears the cookie; subsequent /auth/me returns 401
  • Wrong password / unknown email → specific error messages (not generic)
  • Session expired → "Session expired" message
  • Each role reaches its dashboard endpoint
  • Stale cookie from a non-existent user gets auto-cleared (server) and frontend gets 401
"""
import os
import sys
import uuid
import asyncio
import pytest
import httpx

BASE_URL = os.environ.get("OWN_RECOVERY_API", "http://localhost:8001")
DEMO_PW = "demo1234"

ROLES_ENDPOINTS = {
    "alex@demo.own": ("recovery_user", "/api/health/risk/latest"),
    "sam@demo.own": ("supporter", "/api/supporter/connections"),
    "drquinn@demo.own": ("clinician", "/api/clinician/overview"),
}


def _client():
    return httpx.AsyncClient(base_url=BASE_URL, timeout=15)


async def _login(client, email, password=DEMO_PW):
    r = await client.post("/api/auth/login", json={"email": email, "password": password})
    return r


async def _reseed_via_endpoint():
    async with _client() as c:
        r = await c.post("/api/admin/reset-demo")
        assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_01_demo_users_have_deterministic_ids():
    """User ID is uuid5(NAMESPACE, email). Same across reseeds."""
    sys.path.insert(0, "/app/backend")
    from seed import demo_user_id
    expected = demo_user_id("alex@demo.own")
    # uuid5 is deterministic
    assert demo_user_id("alex@demo.own") == expected
    assert demo_user_id("ALEX@demo.own".lower()) == expected


@pytest.mark.asyncio
async def test_02_login_succeeds_after_fresh_seed():
    await _reseed_via_endpoint()
    async with _client() as c:
        for email in ROLES_ENDPOINTS:
            r = await _login(c, email)
            assert r.status_code == 200, f"{email}: {r.status_code} {r.text}"
            assert r.json()["user"]["email"] == email


@pytest.mark.asyncio
async def test_03_login_then_logout_then_login_again():
    async with _client() as c:
        r = await _login(c, "alex@demo.own")
        assert r.status_code == 200
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}"}
        # /auth/me works while logged in
        me = await c.get("/api/auth/me", headers=h)
        assert me.status_code == 200
        # logout (cookie path; harmless even if no cookie set)
        out = await c.post("/api/auth/logout")
        assert out.status_code == 200
        # /auth/me without auth → 401
        me2 = await c.get("/api/auth/me")
        assert me2.status_code == 401
        # login again succeeds
        r2 = await _login(c, "alex@demo.own")
        assert r2.status_code == 200


@pytest.mark.asyncio
async def test_04_token_survives_reseed_due_to_stable_ids():
    async with _client() as c:
        r = await _login(c, "alex@demo.own")
        assert r.status_code == 200
        token = r.json()["token"]
        # Reseed
        await _reseed_via_endpoint()
        # Same token should still resolve to the same user (stable id) → /auth/me works
        me = await c.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200, f"Expected token to survive reseed, got {me.status_code} {me.text}"


@pytest.mark.asyncio
async def test_05_wrong_password_specific_message():
    async with _client() as c:
        r = await _login(c, "alex@demo.own", password="totally-wrong")
        assert r.status_code == 401
        assert "Incorrect password" in r.json()["detail"]


@pytest.mark.asyncio
async def test_06_unknown_email_specific_message():
    async with _client() as c:
        r = await _login(c, f"nobody-{uuid.uuid4()}@nowhere.com")
        assert r.status_code == 401
        assert "Email not found" in r.json()["detail"]


@pytest.mark.asyncio
async def test_07_role_mismatch_specific_message():
    async with _client() as c:
        r = await c.post(
            "/api/auth/login",
            json={"email": "alex@demo.own", "password": DEMO_PW, "expected_role": "clinician"},
        )
        assert r.status_code == 403
        assert "role mismatch" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_08_session_expired_message():
    """Forge a JWT with a past exp — backend should return 'Session expired'."""
    import jwt as pyjwt
    from datetime import datetime, timezone, timedelta
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        # Read from .env fallback for test runner
        with open("/app/backend/.env") as f:
            for line in f:
                if line.startswith("JWT_SECRET="):
                    secret = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    assert secret, "JWT_SECRET not available"
    expired = pyjwt.encode(
        {"sub": "anyid", "role": "recovery_user",
         "iat": datetime.now(timezone.utc) - timedelta(days=2),
         "exp": datetime.now(timezone.utc) - timedelta(days=1)},
        secret, algorithm="HS256",
    )
    async with _client() as c:
        r = await c.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"})
        assert r.status_code == 401
        assert "expired" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_09_stale_user_id_cookie_clears():
    """A token referencing a non-existent user should 401 AND the response should clear the cookie."""
    import jwt as pyjwt
    from datetime import datetime, timezone, timedelta
    with open("/app/backend/.env") as f:
        secret = next(l.split("=", 1)[1].strip() for l in f if l.startswith("JWT_SECRET="))
    bogus_token = pyjwt.encode(
        {"sub": str(uuid.uuid4()), "role": "recovery_user",
         "iat": datetime.now(timezone.utc),
         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        secret, algorithm="HS256",
    )
    async with _client() as c:
        # Send via Authorization header (mirrors a stale token scenario without HTTPS-cookie complications)
        r = await c.get("/api/auth/me", headers={"Authorization": f"Bearer {bogus_token}"})
        assert r.status_code == 401
        # The response MUST emit a Set-Cookie clearing or_token
        set_cookie_headers = r.headers.get_list("set-cookie") if hasattr(r.headers, "get_list") else [r.headers.get("set-cookie", "")]
        joined = "|".join(set_cookie_headers).lower()
        assert "or_token" in joined, f"Expected Set-Cookie to clear or_token; got: {joined}"


@pytest.mark.asyncio
async def test_10_each_role_reaches_their_dashboard_endpoint():
    for email, (_role, endpoint) in ROLES_ENDPOINTS.items():
        async with _client() as c:
            r = await _login(c, email)
            assert r.status_code == 200, f"login {email} → {r.status_code}"
            token = r.json()["token"]
            ep = await c.get(endpoint, headers={"Authorization": f"Bearer {token}"})
            assert ep.status_code == 200, f"{email} -> {endpoint} returned {ep.status_code} {ep.text}"


@pytest.mark.asyncio
async def test_11_clinician_not_verified_message():
    """Sign up a fresh clinician without invite -> 403 with specific message."""
    async with _client() as c:
        r = await c.post("/api/auth/signup", json={
            "email": f"unverified-{uuid.uuid4()}@example.com",
            "password": "demo1234",
            "name": "Unverified Doc",
            "role": "clinician",
            # No invite code
        })
        assert r.status_code == 403
        assert "invite" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_12_admin_reset_endpoint_idempotent():
    """Calling /api/admin/reset-demo twice does not break login."""
    await _reseed_via_endpoint()
    await _reseed_via_endpoint()
    async with _client() as c:
        r = await _login(c, "alex@demo.own")
        assert r.status_code == 200
