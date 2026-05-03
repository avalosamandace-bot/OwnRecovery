"""Iteration 3 tests — Google OAuth shape, Clinician PDF Export, Admin Console,
Trust+Privacy Dashboard backend endpoints. Regression for existing email/password
auth, role routing, clinician verification, and logout cookie-clear.

Run:
    pytest /app/backend/tests/test_own_recovery_upgrade_v3.py -v \
        --junitxml=/app/test_reports/pytest/own_recovery_upgrade_v3.xml
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://behavioral-monitor.preview.emergentagent.com").rstrip("/")
PW = "demo1234"

ALEX = "alex@demo.own"
SAM = "sam@demo.own"
DRQUINN = "drquinn@demo.own"
ADMIN = "admin@demo.own"


# ---------- Fixtures ----------
@pytest.fixture(scope="module", autouse=True)
def _reseed_once():
    """Ensure a clean, idempotent demo state at start of module."""
    r = requests.post(f"{BASE_URL}/api/admin/reset-demo", timeout=60)
    assert r.status_code == 200, f"reset-demo failed: {r.status_code} {r.text}"
    yield


def _login(email, pw=PW, expected_role=None):
    body = {"email": email, "password": pw}
    if expected_role:
        body["expected_role"] = expected_role
    r = requests.post(f"{BASE_URL}/api/auth/login", json=body, timeout=15)
    return r


def _token_for(email, pw=PW):
    r = _login(email, pw)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- REGRESSION 1-5: existing auth still works ----------
class TestAuthRegression:
    def test_email_login_alex(self):
        r = _login(ALEX)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["email"] == ALEX and u["role"] == "recovery_user"

    def test_email_login_sam(self):
        r = _login(SAM)
        assert r.status_code == 200 and r.json()["user"]["role"] == "supporter"

    def test_email_login_drquinn(self):
        r = _login(DRQUINN)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["role"] == "clinician" and u.get("verified_clinician") is True

    def test_email_login_admin(self):
        r = _login(ADMIN)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["role"] == "recovery_user" and u.get("is_admin") is True

    def test_me_with_or_token_cookie_only(self):
        """POST /api/auth/login sets or_token cookie; /api/auth/me must work with
        only that cookie (no Bearer header)."""
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ALEX, "password": PW}, timeout=15)
        assert r.status_code == 200
        # cookie exists
        assert "or_token" in s.cookies, f"or_token cookie not set. Cookies: {list(s.cookies.keys())}"
        # call /me WITHOUT Authorization header
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert me.status_code == 200, f"me via cookie failed: {me.status_code} {me.text}"
        assert me.json()["email"] == ALEX

    def test_role_based_dashboard_endpoints(self):
        mapping = {
            ALEX: ("/api/health/risk/latest", "recovery_user"),
            SAM: ("/api/supporter/connections", "supporter"),
            DRQUINN: ("/api/clinician/overview", "clinician"),
        }
        for email, (ep, _role) in mapping.items():
            tok = _token_for(email)
            rr = requests.get(f"{BASE_URL}{ep}", headers=_h(tok), timeout=15)
            assert rr.status_code == 200, f"{email} -> {ep}: {rr.status_code} {rr.text}"

    def test_clinician_verification_gate(self):
        # drquinn is verified → /api/clinician/patients returns 200
        tok = _token_for(DRQUINN)
        r = requests.get(f"{BASE_URL}/api/clinician/patients", headers=_h(tok), timeout=15)
        assert r.status_code == 200
        # Fresh clinician w/o invite → signup 403 "invite"
        u = f"unverified-{uuid.uuid4()}@example.com"
        rs = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": u, "password": PW, "name": "No Invite", "role": "clinician",
        }, timeout=15)
        assert rs.status_code == 403
        assert "invite" in rs.json()["detail"].lower()

    def test_logout_clears_or_token_cookie(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={"email": ALEX, "password": PW}, timeout=15)
        assert "or_token" in s.cookies
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert r.status_code == 200
        # Response must emit Set-Cookie that clears or_token
        set_cookies = r.headers.get("set-cookie", "")
        assert "or_token" in set_cookies.lower()
        # After logout, /me should return 401
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert me.status_code == 401


# ---------- FEATURE 1: Google OAuth endpoint shape ----------
class TestGoogleOAuthEndpoint:
    def test_google_auth_rejects_bad_session_id(self):
        """Invalid session_id must not mint a JWT; expect 401 (or 400). 
        The important thing: it does NOT 200."""
        r = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={"session_id": "not-a-valid-session", "role": "recovery_user"},
            timeout=20,
        )
        assert r.status_code in (400, 401, 502), (
            f"Expected 4xx/502 for bad session_id; got {r.status_code} {r.text}"
        )

    def test_google_auth_requires_session_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/google", json={"role": "recovery_user"}, timeout=15)
        assert r.status_code in (400, 422)


# ---------- FEATURE 2: Clinician PDF Export ----------
class TestClinicianPDF:
    def _pick_patient_id(self, tok):
        r = requests.get(f"{BASE_URL}/api/clinician/patients", headers=_h(tok), timeout=15)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert len(arr) > 0
        return arr[0]["id"]

    def test_pdf_export_success_for_verified_clinician(self):
        tok = _token_for(DRQUINN)
        pid = self._pick_patient_id(tok)
        r = requests.get(
            f"{BASE_URL}/api/clinician/patients/{pid}/report.pdf",
            headers=_h(tok), timeout=30,
        )
        assert r.status_code == 200, f"PDF export failed: {r.status_code} {r.text[:200]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() and ".pdf" in cd.lower()
        # PDF magic bytes
        assert r.content[:4] == b"%PDF", "Response body is not a valid PDF (missing %PDF header)"
        assert len(r.content) > 1000

    def test_pdf_export_forbidden_for_non_clinician(self):
        tok = _token_for(ALEX)
        r = requests.get(
            f"{BASE_URL}/api/clinician/patients/does-not-matter/report.pdf",
            headers=_h(tok), timeout=15,
        )
        assert r.status_code == 403


# ---------- FEATURE 3: Admin Console ----------
class TestAdminConsole:
    def test_admin_stats_authorized(self):
        tok = _token_for(ADMIN)
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_h(tok), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "total_users" in j and "by_role" in j and "audit_events" in j
        assert {"recovery_user", "supporter", "clinician"}.issubset(j["by_role"].keys())

    def test_admin_stats_forbidden_for_non_admin(self):
        for email in (ALEX, DRQUINN):
            tok = _token_for(email)
            r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_h(tok), timeout=15)
            assert r.status_code == 403, f"{email} unexpectedly got {r.status_code}"

    def test_admin_users_listing_has_auth_provider(self):
        tok = _token_for(ADMIN)
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=_h(tok), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["total"] > 0
        sample = j["users"][0]
        assert "auth_provider" in sample
        assert sample["auth_provider"] in ("password", "google")

    def test_admin_invite_crud(self):
        tok = _token_for(ADMIN)
        # create
        c = requests.post(f"{BASE_URL}/api/admin/invites", headers=_h(tok),
                          json={"expires_days": 7, "code_prefix": "TEST"}, timeout=15)
        assert c.status_code == 200, c.text
        code = c.json()["invite_code"]
        assert code.startswith("TEST-")
        # list
        ls = requests.get(f"{BASE_URL}/api/admin/invites", headers=_h(tok), timeout=15).json()
        assert any(i["invite_code"] == code for i in ls["invites"])
        # revoke
        rv = requests.post(f"{BASE_URL}/api/admin/invites/{code}/revoke",
                           headers=_h(tok), timeout=15)
        assert rv.status_code == 200 and rv.json().get("revoked") is True
        # confirm revoked in list
        ls2 = requests.get(f"{BASE_URL}/api/admin/invites", headers=_h(tok), timeout=15).json()
        target = next(i for i in ls2["invites"] if i["invite_code"] == code)
        assert target.get("used") is True

    def test_audit_log_writes_clinician_view_and_pdf_export(self):
        # Perform a clinician view + PDF export first
        doc_tok = _token_for(DRQUINN)
        pats = requests.get(f"{BASE_URL}/api/clinician/patients", headers=_h(doc_tok), timeout=15).json()
        pid = pats[0]["id"]
        requests.get(f"{BASE_URL}/api/clinician/patients/{pid}", headers=_h(doc_tok), timeout=15)
        requests.get(f"{BASE_URL}/api/clinician/patients/{pid}/report.pdf",
                     headers=_h(doc_tok), timeout=30)
        # Now query audit log
        adm = _token_for(ADMIN)
        al = requests.get(f"{BASE_URL}/api/admin/audit-log", headers=_h(adm), timeout=15)
        assert al.status_code == 200
        actions = {e.get("action") for e in al.json()["events"]}
        assert "clinician_view_patient" in actions, f"actions seen: {actions}"
        assert "export_patient_pdf" in actions, f"actions seen: {actions}"
        # filter by action
        flt = requests.get(f"{BASE_URL}/api/admin/audit-log?action=export_patient_pdf",
                           headers=_h(adm), timeout=15).json()
        assert flt["total"] >= 1
        assert all(e["action"] == "export_patient_pdf" for e in flt["events"])


# ---------- FEATURE 4: Trust + Privacy Dashboard ----------
class TestTrustPrivacy:
    def test_transparency_endpoint(self):
        tok = _token_for(ALEX)
        r = requests.get(f"{BASE_URL}/api/consent/transparency", headers=_h(tok), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "data_on_file" in j
        # counts dict has expected keys
        for key in ("health_entries", "risk_scores", "craving_checkins",
                    "alerts", "supporter_links", "weekly_summaries"):
            assert key in j["data_on_file"]
        assert "consent_snapshot" in j
        assert "principles" in j and len(j["principles"]) == 5
        keys = {p["k"] for p in j["principles"]}
        assert {"consent_first", "explainable", "anonymizable",
                "human_in_loop", "right_to_export_delete"}.issubset(keys)

    def test_access_log_populated_by_clinician_view(self):
        # Clinician views alex
        doc_tok = _token_for(DRQUINN)
        pats = requests.get(f"{BASE_URL}/api/clinician/patients", headers=_h(doc_tok), timeout=15).json()
        alex_id = next(p["id"] for p in pats if p["display_name"])  # any patient
        # find the patient that matches alex by looking up via admin
        adm_tok = _token_for(ADMIN)
        users = requests.get(f"{BASE_URL}/api/admin/users", headers=_h(adm_tok), timeout=15).json()["users"]
        alex_id = next(u["id"] for u in users if u["email"] == ALEX)
        # clinician views alex specifically
        r0 = requests.get(f"{BASE_URL}/api/clinician/patients/{alex_id}",
                          headers=_h(doc_tok), timeout=15)
        assert r0.status_code == 200
        # Alex queries her own access-log
        alex_tok = _token_for(ALEX)
        r = requests.get(f"{BASE_URL}/api/consent/access-log", headers=_h(alex_tok), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["total"] >= 1, "Expected at least one access event on alex's record"
        ev = j["events"][0]
        for k in ("action", "actor_email", "actor_role", "created_at"):
            assert k in ev

    def test_consent_toggles_all_patch_roundtrip(self):
        """The 9 consent toggles remain functional."""
        tok = _token_for(ALEX)
        # Get current
        g = requests.get(f"{BASE_URL}/api/consent", headers=_h(tok), timeout=15)
        assert g.status_code == 200
        current = g.json()
        # Build patch body flipping any boolean toggles we find
        bool_keys = [k for k, v in current.items() if isinstance(v, bool)]
        assert len(bool_keys) >= 5, f"expected several consent toggles, got: {bool_keys}"
        patch = {k: not current[k] for k in bool_keys}
        p = requests.patch(f"{BASE_URL}/api/consent", headers=_h(tok), json=patch, timeout=15)
        assert p.status_code == 200
        after = p.json()
        for k in bool_keys:
            assert after[k] == (not current[k]), f"toggle {k} did not flip"
        # Restore
        restore = {k: current[k] for k in bool_keys}
        rr = requests.patch(f"{BASE_URL}/api/consent", headers=_h(tok), json=restore, timeout=15)
        assert rr.status_code == 200
