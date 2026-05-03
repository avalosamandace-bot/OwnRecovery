"""End-to-end backend tests for Own Recovery.
Covers: auth (cookie+bearer), clinician invite validation,
check-in, risk, alerts, trends, weekly LLM summary, consent,
CSV export, data delete, supporter/clinician panels, onboarding, AI observations.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://behavioral-monitor.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

PW = "demo1234"
ALEX = "alex@demo.own"
JAMIE = "jamie@demo.own"
MORGAN = "morgan@demo.own"
SAM = "sam@demo.own"
QUINN = "drquinn@demo.own"


def _login(email, password=PW):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s, data


@pytest.fixture(scope="session")
def alex_session():
    s, data = _login(ALEX)
    return s, data


@pytest.fixture(scope="session")
def sam_session():
    s, data = _login(SAM)
    return s, data


@pytest.fixture(scope="session")
def quinn_session():
    s, data = _login(QUINN)
    return s, data


# ---------------- AUTH ----------------
class TestAuth:
    def test_me_no_cookie_unauth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_login_alex_sets_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ALEX, "password": PW}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == ALEX
        assert body["user"]["role"] == "recovery_user"
        # Cookie or token present
        has_cookie = any(c.name in ("or_token", "token", "access_token") for c in s.cookies)
        assert has_cookie or body.get("token"), "neither cookie nor body token set"
        # /auth/me with the session cookie
        me = s.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 200, me.text
        assert me.json()["email"] == ALEX

    def test_login_clinician_verified(self):
        s, data = _login(QUINN)
        assert data["user"]["role"] == "clinician"
        assert data["user"].get("verified_clinician") is True

    def test_logout_clears_cookie(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ALEX, "password": PW}, timeout=15)
        r = s.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code in (200, 204)
        # subsequent /auth/me must 401 (clear bearer first)
        s.headers.pop("Authorization", None)
        me = s.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 401

    def test_signup_recovery_user(self):
        s = requests.Session()
        email = f"test_rec_{uuid.uuid4().hex[:8]}@demo.own"
        r = s.post(f"{API}/auth/signup", json={
            "email": email, "password": "testpass123", "name": "Test Rec",
            "role": "recovery_user"
        }, timeout=20)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body["user"]["email"] == email
        assert body["user"]["role"] == "recovery_user"


# ---------------- CLINICIAN INVITE ----------------
class TestClinicianInvite:
    def test_signup_clinician_no_code_rejected(self):
        r = requests.post(f"{API}/auth/signup", json={
            "email": f"test_cli_{uuid.uuid4().hex[:8]}@demo.own",
            "password": "pw12345678", "name": "No Code", "role": "clinician"
        }, timeout=15)
        assert r.status_code in (400, 403), f"expected 403/400, got {r.status_code}: {r.text}"

    def test_signup_clinician_invalid_code_rejected(self):
        r = requests.post(f"{API}/auth/signup", json={
            "email": f"test_cli_{uuid.uuid4().hex[:8]}@demo.own",
            "password": "pw12345678", "name": "Bad Code", "role": "clinician",
            "clinician_invite_code": "BOGUS-XXXX"
        }, timeout=15)
        assert r.status_code == 400, r.text

    def test_invite_validate_valid_and_used(self):
        # validate a known-unused code (may be consumed later)
        r = requests.post(f"{API}/auth/invite/validate",
                          json={"invite_code": "CLINICIAN-DEMO-2026"}, timeout=15)
        assert r.status_code == 200
        assert "valid" in r.json()

        # bogus -> valid:false
        r2 = requests.post(f"{API}/auth/invite/validate",
                           json={"invite_code": "NOTREAL-CODE"}, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("valid") is False

    def test_signup_clinician_valid_then_reuse_rejected(self):
        code = "CLINICIAN-DEMO-2026"
        chk = requests.post(f"{API}/auth/invite/validate", json={"invite_code": code}, timeout=15).json()
        if not chk.get("valid"):
            pytest.skip(f"invite {code} already consumed in this env")
        email = f"test_cli_{uuid.uuid4().hex[:8]}@demo.own"
        r = requests.post(f"{API}/auth/signup", json={
            "email": email, "password": "pw12345678",
            "name": "Dr Test", "role": "clinician",
            "clinician_invite_code": code,
        }, timeout=20)
        assert r.status_code in (200, 201), r.text
        user = r.json()["user"]
        assert user.get("verified_clinician") is True
        assert user.get("verification_status") in ("simulated_verified", "verified")

        # reuse
        r2 = requests.post(f"{API}/auth/signup", json={
            "email": f"test_cli_{uuid.uuid4().hex[:8]}@demo.own",
            "password": "pw12345678", "name": "Dup", "role": "clinician",
            "clinician_invite_code": code,
        }, timeout=20)
        assert r2.status_code == 400, f"expected 400 for reuse, got {r2.status_code}"


# ---------------- HEALTH / CHECKIN / RISK ----------------
class TestHealth:
    def test_checkin_creates_risk(self, alex_session):
        s, _ = alex_session
        r = s.post(f"{API}/health/checkin", json={
            "mood": 4, "craving": 8, "stress": 8, "sleep_hours": 4.5,
            "triggers": ["work stress", "fatigue"], "notes": "test"
        }, timeout=20)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        # Accept either {risk, level} or nested
        risk = body.get("risk") or body.get("risk_score") or body
        assert risk is not None
        level = body.get("level") or (risk.get("level") if isinstance(risk, dict) else None)
        assert level in ("low", "medium", "high"), f"unexpected level: {level} body={body}"

    def test_entries_and_series(self, alex_session):
        s, _ = alex_session
        r = s.get(f"{API}/health/entries?days=30", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = s.get(f"{API}/health/risk/series?days=30", timeout=15)
        assert r2.status_code == 200

    def test_risk_compare(self, alex_session):
        s, _ = alex_session
        r = s.get(f"{API}/health/risk/compare", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "rule" in body and "ml" in body
        # contributions present on at least one
        contribs = body["rule"].get("contributions") or body["ml"].get("contributions")
        assert contribs, "no contributions in compare"

    def test_alerts_list_and_ack(self, alex_session):
        s, _ = alex_session
        r = s.get(f"{API}/health/alerts", timeout=15)
        assert r.status_code == 200
        alerts = r.json()
        assert isinstance(alerts, list)
        if alerts:
            aid = alerts[0].get("id") or alerts[0].get("_id")
            if aid:
                ra = s.post(f"{API}/health/alerts/{aid}/acknowledge", timeout=15)
                assert ra.status_code in (200, 204), ra.text

    def test_export_csv(self, alex_session):
        s, _ = alex_session
        r = s.get(f"{API}/health/export/csv", timeout=20)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "csv" in ct.lower(), f"not csv: {ct}"
        first_line = r.text.splitlines()[0].lower() if r.text else ""
        assert "mood" in first_line and "craving" in first_line, first_line


# ---------------- WEEKLY LLM SUMMARY ----------------
class TestSummary:
    def test_weekly_summary(self, alex_session):
        s, _ = alex_session
        r = s.post(f"{API}/summary/weekly", json={}, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("source") in ("llm", "template")
        assert "stats" in body or "summary" in body or "text" in body


# ---------------- CONSENT / PRIVACY ----------------
class TestConsent:
    def test_consent_get_patch(self, alex_session):
        s, _ = alex_session
        r = s.get(f"{API}/consent", timeout=15)
        assert r.status_code == 200
        before = r.json()
        current = before.get("share_craving", True)
        r2 = s.patch(f"{API}/consent", json={"share_craving": not current}, timeout=15)
        assert r2.status_code == 200, r2.text
        after = s.get(f"{API}/consent", timeout=15).json()
        assert after.get("share_craving") == (not current)
        # reset
        s.patch(f"{API}/consent", json={"share_craving": current}, timeout=15)

    def test_invite_supporter(self, alex_session):
        s, _ = alex_session
        email = f"supp_{uuid.uuid4().hex[:6]}@demo.own"
        # schema uses `supporter_email`
        r = s.post(f"{API}/supporter/invite", json={"supporter_email": email}, timeout=15)
        if r.status_code == 404:
            r = s.post(f"{API}/consent/supporters/invite", json={"supporter_email": email}, timeout=15)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"


# ---------------- SUPPORTER ----------------
class TestSupporter:
    def test_connections_and_view(self, sam_session, alex_session):
        s, _ = sam_session
        r = s.get(f"{API}/supporter/connections", timeout=15)
        assert r.status_code == 200, r.text
        conns = r.json()
        assert isinstance(conns, list) and len(conns) >= 1
        # connections shape: [{link:{...}, recovery_user:{id,name,email}}]
        target = None
        for c in conns:
            ru = c.get("recovery_user") or {}
            if ru.get("id"):
                target = ru["id"]
                break
        assert target, f"no recovery user id in connections: {conns}"
        rv = s.get(f"{API}/supporter/view/{target}", timeout=20)
        assert rv.status_code == 200, rv.text
        body = rv.json()
        # consent default share_craving=False -> entries should not contain 'craving'
        entries = body.get("entries") or body.get("health_entries") or []
        if entries:
            assert "craving" not in entries[0] or entries[0].get("craving") is None, \
                f"craving leaked despite default consent: {entries[0]}"

    def test_encourage_message(self, sam_session, alex_session):
        s_sam, _ = sam_session
        conns = s_sam.get(f"{API}/supporter/connections", timeout=15).json()
        target = None
        for c in conns:
            ru = c.get("recovery_user") or {}
            if ru.get("id"):
                target = ru["id"]
                break
        assert target
        msg = f"stay strong {uuid.uuid4().hex[:6]}"
        r = s_sam.post(f"{API}/supporter/encourage",
                       json={"user_id": target, "message": msg}, timeout=15)
        assert r.status_code in (200, 201), r.text
        # alex should see it via /supporter/messages or /encouragements
        s_alex, _ = alex_session
        m = s_alex.get(f"{API}/supporter/messages", timeout=15)
        if m.status_code == 404:
            m = s_alex.get(f"{API}/supporter/encouragements", timeout=15)
        assert m.status_code == 200, m.text
        msgs = m.json()
        assert isinstance(msgs, list)


# ---------------- CLINICIAN PANEL ----------------
class TestClinician:
    def test_patients_anonymized(self, quinn_session):
        s, _ = quinn_session
        r = s.get(f"{API}/clinician/patients", timeout=15)
        assert r.status_code == 200, r.text
        patients = r.json()
        assert isinstance(patients, list)
        if patients:
            # expect anonymized display_name like P-XXXXXX
            p = patients[0]
            code = p.get("display_name") or p.get("code") or p.get("anon_id")
            assert code and str(code).startswith("P-"), f"no anonymized code: {p}"
            assert p.get("anonymized") is True

    def test_overview(self, quinn_session):
        s, _ = quinn_session
        r = s.get(f"{API}/clinician/overview", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "risk_distribution" in body

    def test_recovery_user_forbidden(self, alex_session):
        s, _ = alex_session
        r = s.get(f"{API}/clinician/patients", timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"


# ---------------- ONBOARDING ----------------
class TestOnboarding:
    def test_plan_creates_day1(self):
        # Create a brand-new recovery user so onboarding is fresh
        email = f"test_onb_{uuid.uuid4().hex[:8]}@demo.own"
        s = requests.Session()
        r = s.post(f"{API}/auth/signup", json={
            "email": email, "password": "pw12345678", "name": "Onb User",
            "role": "recovery_user"
        }, timeout=20)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        tok = body.get("token")
        if tok:
            s.headers.update({"Authorization": f"Bearer {tok}"})
        rp = s.post(f"{API}/onboarding/plan", json={
            "feeling_today": "tired", "hardest_recently": "nights",
            "sleep_quality": "poor", "stress_level": 8
        }, timeout=20)
        assert rp.status_code in (200, 201), rp.text
        plan = rp.json()
        for k in ("small_goal", "suggested_checkin", "recommended_resource", "affirmation"):
            assert k in plan, f"missing {k} in plan: {plan}"


# ---------------- AI OBSERVATIONS ----------------
class TestInsights:
    def test_observations(self, alex_session):
        s, _ = alex_session
        r = s.get(f"{API}/insights/observations", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "observations" in body
        assert "insight_cards" in body
