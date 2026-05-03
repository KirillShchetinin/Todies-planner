"""
Tests for the Flask routes in `backend.controller`:
  - GET  /api/state
  - PUT  /api/state
  - GET  /              (serves frontend index.html)
"""
import json

from backend import data_access


# ── GET /api/state ───────────────────────────────────────────────────────

def test_get_state_anonymous_no_data_returns_null(client):
    resp = client.get("/api/state")
    assert resp.status_code == 200
    # jsonify(None) → JSON literal "null"
    assert resp.get_json() is None


def test_get_state_anonymous_returns_anon_state(client, seed):
    seed.legacy_state(None, {"who": "anonymous"})
    resp = client.get("/api/state")
    assert resp.status_code == 200
    assert resp.get_json() == {"who": "anonymous"}


def test_get_state_with_valid_token_returns_user_state(client, seed):
    uid = seed.user("tok-1")
    seed.legacy_state(uid, {"who": "alice", "cols": []})

    resp = client.get("/api/state?token=tok-1")
    assert resp.status_code == 200
    assert resp.get_json() == {"who": "alice", "cols": []}


def test_get_state_invalid_token_falls_back_to_anonymous(client, seed):
    """Unknown tokens resolve to user_id=None — they read the anonymous row."""
    seed.legacy_state(None, {"who": "anon"})
    seed.user("real-token")  # different token; the request won't use it
    seed.legacy_state(1, {"who": "real-user"})  # would be wrong if leaked

    resp = client.get("/api/state?token=bogus")
    assert resp.status_code == 200
    assert resp.get_json() == {"who": "anon"}


def test_get_state_isolates_users(client, seed):
    a = seed.user("tok-a")
    b = seed.user("tok-b")
    seed.legacy_state(a, {"who": "alice"})
    seed.legacy_state(b, {"who": "bob"})

    assert client.get("/api/state?token=tok-a").get_json() == {"who": "alice"}
    assert client.get("/api/state?token=tok-b").get_json() == {"who": "bob"}


def test_get_state_user_with_no_state_returns_null(client, seed):
    seed.user("tok-1")  # user exists, but no planner_state row
    resp = client.get("/api/state?token=tok-1")
    assert resp.status_code == 200
    assert resp.get_json() is None


# ── PUT /api/state ───────────────────────────────────────────────────────

def test_put_state_persists_for_anonymous(client, app):
    payload = {"cols": [{"id": "c1", "label": "Mon"}], "uiScale": 1.0}
    resp = client.put("/api/state", json=payload)
    assert resp.status_code == 204
    assert resp.data == b""

    with app.app_context():
        assert data_access.get_state(None) == payload


def test_put_state_persists_for_authenticated_user(client, app, seed):
    uid = seed.user("tok-1")
    payload = {"v": 42}

    resp = client.put("/api/state?token=tok-1", json=payload)
    assert resp.status_code == 204

    with app.app_context():
        assert data_access.get_state(uid)  == payload
        assert data_access.get_state(None) is None  # anon row untouched


def test_put_state_replaces_existing_for_authenticated_user(client, seed, app):
    """For an authenticated user, the UNIQUE constraint on user_id triggers
    INSERT OR REPLACE, so a second PUT overwrites the first.

    Note: this does NOT hold for anonymous PUTs — SQLite treats NULL as
    distinct under UNIQUE, so anonymous PUTs accumulate rows. That is current
    production behavior and is intentionally not asserted here.
    """
    uid = seed.user("tok-1")
    seed.legacy_state(uid, {"v": 1})

    resp = client.put("/api/state?token=tok-1", json={"v": 2})
    assert resp.status_code == 204

    with app.app_context():
        assert data_access.get_state(uid) == {"v": 2}


def test_put_state_rejects_non_json_body(client):
    resp = client.put("/api/state", data="not json",
                      content_type="application/json")
    assert resp.status_code == 400
    assert resp.get_json() == {"error": "invalid JSON body"}


def test_put_state_rejects_missing_body(client):
    resp = client.put("/api/state")
    assert resp.status_code == 400
    assert resp.get_json() == {"error": "invalid JSON body"}


def test_put_state_rejects_wrong_content_type(client):
    # request.get_json(silent=True) returns None for non-JSON content types
    resp = client.put("/api/state", data='{"v":1}',
                      content_type="text/plain")
    assert resp.status_code == 400
    assert resp.get_json() == {"error": "invalid JSON body"}


def test_put_state_accepts_empty_object(client, app):
    resp = client.put("/api/state", json={})
    assert resp.status_code == 204
    with app.app_context():
        assert data_access.get_state(None) == {}


def test_put_state_accepts_unicode(client, app):
    payload = {"text": "тест ✓", "emoji": "🎯"}
    resp = client.put("/api/state", json=payload)
    assert resp.status_code == 204
    with app.app_context():
        assert data_access.get_state(None) == payload


def test_put_then_get_roundtrip(client):
    payload = {
        "cols": [{"id": "c1", "label": "Mon", "date": "01/15"}],
        "weekUnscheduled": [],
        "state": {"c1": [{"id": "t1", "text": "x", "done": False}]},
        "idCounter": 1, "uiScale": 1.0, "lang": "en",
    }
    assert client.put("/api/state", json=payload).status_code == 204
    assert client.get("/api/state").get_json() == payload


# ── GET / (static index) ─────────────────────────────────────────────────

def test_index_serves_html(client):
    resp = client.get("/")
    assert resp.status_code == 200
    # The actual frontend index.html should be served. Just verify it's HTML-ish.
    body = resp.data.decode("utf-8", errors="replace").lower()
    assert "<html" in body or "<!doctype" in body


def test_unknown_path_returns_404(client):
    # /api/state methods are GET/PUT only — POST is 405, random path is 404.
    resp = client.get("/api/does-not-exist")
    assert resp.status_code == 404


def test_put_state_method_only_on_state_route(client):
    resp = client.post("/api/state", json={})
    assert resp.status_code == 405


# ── side-effect isolation across tests ──────────────────────────────────

def test_each_test_starts_with_clean_db(client):
    """Sanity check: leftovers from previous tests must not leak."""
    assert client.get("/api/state").get_json() is None
