"""Tests for sobriety/craving/resources/steps/insights upgrade.
Targets the new endpoints and verifies existing functionality still works.
"""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://behavioral-monitor.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

PW = "demo1234"
ALEX = "alex@demo.own"


def _login(email, password=PW):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s, data


@pytest.fixture(scope="module")
def alex():
    return _login(ALEX)


@pytest.fixture(scope="module")
def jamie():
    return _login("jamie@demo.own")


@pytest.fixture(scope="module")
def morgan():
    return _login("morgan@demo.own")


@pytest.fixture(scope="module")
def sam():
    return _login("sam@demo.own")


@pytest.fixture(scope="module")
def quinn():
    return _login("drquinn@demo.own")


# ---------------- AUTH still works + new fields ----------------
class TestAuthExtended:
    def test_me_includes_new_user_fields(self, alex):
        s, data = alex
        me = s.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 200
        body = me.json()
        # Required new fields
        for k in ("sobriety_start_date", "longest_streak_days", "why_i_am_sober",
                  "motivation_tags", "supporter_alerts_enabled", "is_admin"):
            assert k in body, f"missing field {k} in /auth/me: {list(body.keys())}"
        # Alex was seeded with sobriety_start_date and why_i_am_sober
        assert body.get("sobriety_start_date"), "alex should have seeded sobriety_start_date"
        assert body.get("why_i_am_sober"), "alex should have seeded why_i_am_sober"


# ---------------- SOBRIETY ----------------
class TestSobriety:
    def test_status_initial(self, alex):
        s, _ = alex
        r = s.get(f"{API}/sobriety/status", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("current_streak_days", "longest_streak_days", "milestones_reached",
                  "next_milestone", "relapse_history", "why_i_am_sober", "motivation_tags"):
            assert k in body
        assert body["why_i_am_sober"], "alex seeded why_i_am_sober missing"
        assert isinstance(body["relapse_history"], list)
        # Should be ~90 days seeded; at least >= 60 to be safe
        assert body["current_streak_days"] >= 60, f"alex should have ~90 day streak; got {body['current_streak_days']}"

    def test_start_valid_date(self, morgan):
        s, _ = morgan
        # Set a 100-day-old date
        new_start = (date.today() - timedelta(days=100)).isoformat()
        r = s.post(f"{API}/sobriety/start", json={"start_date": new_start}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["current_streak_days"] >= 99
        # Verify status reflects it
        st = s.get(f"{API}/sobriety/status", timeout=15).json()
        assert st["sobriety_start_date"] == new_start
        # longest >= current
        assert st["longest_streak_days"] >= st["current_streak_days"]

    def test_start_future_date_400(self, morgan):
        s, _ = morgan
        future = (date.today() + timedelta(days=5)).isoformat()
        r = s.post(f"{API}/sobriety/start", json={"start_date": future}, timeout=15)
        assert r.status_code == 400, f"expected 400 for future, got {r.status_code}: {r.text}"

    def test_start_invalid_format_400(self, morgan):
        s, _ = morgan
        r = s.post(f"{API}/sobriety/start", json={"start_date": "not-a-date"}, timeout=15)
        assert r.status_code == 400

    def test_why_post_and_get(self, jamie):
        s, _ = jamie
        text = f"For my family {uuid.uuid4().hex[:6]}"
        tags = ["family", "health"]
        r = s.post(f"{API}/sobriety/why", json={"why_i_am_sober": text, "motivation_tags": tags}, timeout=15)
        assert r.status_code == 200, r.text
        g = s.get(f"{API}/sobriety/why", timeout=15)
        assert g.status_code == 200
        body = g.json()
        assert body["why_i_am_sober"] == text
        assert set(body["motivation_tags"]) == set(tags)

    def test_relapse_no_date_resets_and_returns_message(self, jamie):
        s, _ = jamie
        # capture before
        before = s.get(f"{API}/sobriety/status", timeout=15).json()
        prev_streak = before["current_streak_days"]
        prev_relapses = len(before["relapse_history"])

        r = s.post(f"{API}/sobriety/relapse", json={"note": "test relapse"}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("supportive_message")
        assert body.get("new_start_date")
        # new_start_date should be tomorrow
        assert body["new_start_date"] == (date.today() + timedelta(days=1)).isoformat()

        after = s.get(f"{API}/sobriety/status", timeout=15).json()
        # current streak should drop to 0 (since start_date is tomorrow)
        assert after["current_streak_days"] == 0, f"expected streak reset, got {after['current_streak_days']}"
        assert len(after["relapse_history"]) == prev_relapses + 1
        # cleanup-ish: do not bother resetting jamie's date - test isolated to jamie

    def test_relapse_malformed_date_400(self, jamie):
        s, _ = jamie
        r = s.post(f"{API}/sobriety/relapse", json={"date": "garbage"}, timeout=15)
        assert r.status_code == 400


# ---------------- RESOURCES ----------------
class TestResources:
    def test_requires_auth(self):
        r = requests.get(f"{API}/resources", timeout=15)
        assert r.status_code in (401, 403)

    def test_resources_shape(self, alex):
        s, _ = alex
        r = s.get(f"{API}/resources", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "categories" in body and "resources" in body
        assert len(body["categories"]) >= 5
        assert len(body["resources"]) >= 10
        for res in body["resources"]:
            for k in ("title", "category", "description", "link", "crisis"):
                assert k in res, f"missing {k} in {res}"
            assert res["link"].startswith("http")

    def test_sample_links_resolve(self, alex):
        s, _ = alex
        body = s.get(f"{API}/resources", timeout=15).json()
        # sample 5 deterministically (first 5 distinct links)
        seen = []
        for r in body["resources"]:
            if r["link"] not in seen:
                seen.append(r["link"])
            if len(seen) >= 5:
                break
        failures = []
        for link in seen:
            try:
                resp = requests.get(link, timeout=15, allow_redirects=True,
                                    headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code >= 400:
                    failures.append((link, resp.status_code))
            except Exception as e:
                failures.append((link, str(e)))
        # Allow up to 1 transient failure (external sites can throttle)
        assert len(failures) <= 1, f"too many broken links: {failures}"


# ---------------- 12-STEPS ----------------
class TestSteps:
    def test_list_steps(self, morgan):
        s, _ = morgan
        r = s.get(f"{API}/steps", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] == 12
        assert len(body["steps"]) == 12
        for step in body["steps"]:
            assert step.get("title") and step.get("prompt")
        # completed should be 0 for fresh morgan (or whatever; just an int)
        assert isinstance(body["completed"], int)

    def test_reflect_step3(self, morgan):
        s, _ = morgan
        text = f"My reflection {uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/steps/3/reflect", json={"reflection": text, "marked_reflected": True}, timeout=15)
        assert r.status_code == 200, r.text
        # verify persistence
        body = s.get(f"{API}/steps", timeout=15).json()
        step3 = next(x for x in body["steps"] if x["n"] == 3)
        assert step3["reflection"] == text
        assert step3["marked_reflected"] is True
        assert body["completed"] >= 1

    def test_reflect_step0_400(self, morgan):
        s, _ = morgan
        r = s.post(f"{API}/steps/0/reflect", json={"reflection": "x", "marked_reflected": True}, timeout=15)
        assert r.status_code == 400

    def test_reflect_step13_400(self, morgan):
        s, _ = morgan
        r = s.post(f"{API}/steps/13/reflect", json={"reflection": "x", "marked_reflected": True}, timeout=15)
        assert r.status_code == 400


# ---------------- CRAVING ----------------
class TestCraving:
    def test_interventions_list(self, alex):
        s, _ = alex
        r = s.get(f"{API}/craving/interventions", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 5

    def test_checkin_then_after(self, alex):
        s, _ = alex
        r = s.post(f"{API}/craving/checkin", json={
            "level_before": 7, "trigger": "boredom", "note": "afternoon dip"
        }, timeout=15)
        assert r.status_code in (200, 201), r.text
        c = r.json()
        assert c["level_before"] == 7
        assert c["trigger"] == "boredom"
        cid = c["id"]
        # PATCH after
        r2 = s.patch(f"{API}/craving/checkin/{cid}/after",
                     json={"level_after": 3, "intervention_used": "breathing"}, timeout=15)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["delta"] == 4
        assert body["checkin"]["level_after"] == 3
        assert body["checkin"]["intervention_used"] == "breathing"

    def test_after_invalid_id_404(self, alex):
        s, _ = alex
        r = s.patch(f"{API}/craving/checkin/INVALID-ID/after",
                    json={"level_after": 2, "intervention_used": "water"}, timeout=15)
        assert r.status_code == 404

    def test_tape_forward_full(self, alex):
        s, _ = alex
        r = s.post(f"{API}/craving/tape-forward", json={
            "q1_if_use": "I'd feel relief briefly",
            "q2_what_happens_after": "Shame and lost progress",
            "q3_how_tomorrow": "Hung over and behind",
            "q4_safer_choice": "Walk + call sponsor",
        }, timeout=15)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body["q1_if_use"] and body["q4_safer_choice"]

    def test_tape_forward_missing_fields_422(self, alex):
        s, _ = alex
        r = s.post(f"{API}/craving/tape-forward", json={"q1_if_use": "only one"}, timeout=15)
        assert r.status_code == 422

    def test_recent_cravings(self, alex):
        s, _ = alex
        r = s.get(f"{API}/craving/recent", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        # We just created at least one above
        assert len(body) >= 1


# ---------------- INSIGHTS extended ----------------
class TestInsightsExtended:
    def test_observations_extended_fields(self, alex):
        s, _ = alex
        r = s.get(f"{API}/insights/observations", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("recovery_score", "trigger_insights", "confidence"):
            assert k in body, f"missing {k}"
        rs = body["recovery_score"]
        assert "score" in rs and "level" in rs and "components" in rs
        assert 0 <= rs["score"] <= 100
        assert rs["level"] in ("strong", "steady", "early")
        # alex is 90 days sober + many entries -> expect score reasonably high
        assert rs["score"] >= 60, f"alex recovery score expected >=60, got {rs['score']}"
        # confidence
        conf = body["confidence"]
        assert conf["level"] in ("low", "medium", "high")
        assert "n_entries" in conf
        # trigger_insights is a list
        assert isinstance(body["trigger_insights"], list)


# ---------------- EXISTING FUNCTIONALITY still works ----------------
class TestRegression:
    def test_checkin_still_works(self, alex):
        s, _ = alex
        r = s.post(f"{API}/health/checkin", json={
            "mood": 6, "craving": 4, "stress": 5, "sleep_hours": 7,
            "triggers": ["work"], "notes": "regression"
        }, timeout=20)
        assert r.status_code in (200, 201), r.text

    def test_alerts_list(self, alex):
        s, _ = alex
        r = s.get(f"{API}/health/alerts", timeout=15)
        assert r.status_code == 200

    def test_csv_export(self, alex):
        s, _ = alex
        r = s.get(f"{API}/health/export/csv", timeout=20)
        assert r.status_code == 200
        assert "csv" in r.headers.get("content-type", "").lower()

    def test_consent_get(self, alex):
        s, _ = alex
        r = s.get(f"{API}/consent", timeout=15)
        assert r.status_code == 200

    def test_supporter_connections(self, sam):
        s, _ = sam
        r = s.get(f"{API}/supporter/connections", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_clinician_overview(self, quinn):
        s, _ = quinn
        r = s.get(f"{API}/clinician/overview", timeout=15)
        assert r.status_code == 200
        assert "risk_distribution" in r.json()

    def test_weekly_summary(self, alex):
        s, _ = alex
        r = s.post(f"{API}/summary/weekly", json={}, timeout=60)
        assert r.status_code == 200
