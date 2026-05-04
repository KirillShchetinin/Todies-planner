"""
Specific-response test for the frontend `GET /api/state` call.

Unlike the other controller tests which use temp DBs, this test runs against
the real `planner.db` with the known production token, asserting the exact
shape and key values the frontend currently receives.

If `planner.db` content changes, update the expected values here to match.
"""
import os
import sqlite3
import sys

import pytest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend import controller  # noqa: E402

TOKEN = "CnNmPUrQawwR5caaGOtyDkuKqyf2KY66jj-ootpyG04"


@pytest.fixture
def real_client():
    """Flask test client backed by the real planner.db (no monkeypatching)."""
    db_path = os.path.join(PROJECT_ROOT, "planner.db")
    if not os.path.exists(db_path):
        pytest.skip("planner.db not present")
    flask_app = controller.app
    prev_testing = flask_app.config.get("TESTING")
    flask_app.config["TESTING"] = True
    try:
        yield flask_app.test_client()
    finally:
        flask_app.config["TESTING"] = prev_testing


def test_get_state_returns_expected_response(real_client):
    resp = real_client.get(f"/api/state?token={TOKEN}")

    assert resp.status_code == 200
    assert resp.content_type.startswith("application/json")

    body = resp.get_json()
    assert body is not None, "expected a state object, got null"

    # ── top-level shape ───────────────────────────────────────────────────
    assert set(body.keys()) == {
        "colCounter", "collapseState", "cols", "idCounter", "lang",
        "legendOrder", "state", "typeConfig", "typeCounter", "uiScale",
        "weekUnscheduled",
    }

    # ── scalar metadata ───────────────────────────────────────────────────
    assert body["lang"] == "en"
    assert body["uiScale"] == 1
    assert body["idCounter"] == 174
    assert body["colCounter"] == 235
    assert body["typeCounter"] == 8

    # ── cols: 26 day columns, first is Monday 04/20 ───────────────────────
    assert isinstance(body["cols"], list)
    assert len(body["cols"]) == 26
    assert body["cols"][0] == {"id": "mon", "label": "Mon", "date": "04/20"}
    for col in body["cols"]:
        assert set(col.keys()) >= {"id", "label", "date"}

    # ── weekUnscheduled: 7 boxes, first is col200/Unscheduled ─────────────
    assert isinstance(body["weekUnscheduled"], list)
    assert len(body["weekUnscheduled"]) == 7
    assert body["weekUnscheduled"][0] == {"id": "col200", "label": "Unscheduled"}

    # ── state: dict keyed by col client_id, 26 entries, 87 tasks total ────
    assert isinstance(body["state"], dict)
    assert len(body["state"]) == 33
    total_tasks = sum(len(v) for v in body["state"].values())
    assert total_tasks == 87

    # every task has the required client-side fields
    for col_id, tasks in body["state"].items():
        assert isinstance(tasks, list)
        for t in tasks:
            assert "id" in t and "text" in t

    # ── typeConfig: 8 built-ins + 7 custom = 15 keys; required built-ins ──
    type_config = body["typeConfig"]
    assert isinstance(type_config, dict)
    assert len(type_config) == 15
    for builtin in ("done", "t-locked", "t-interview", "t-tax",
                    "t-practice", "t-async", "t-rest", "t-unplanned"):
        assert builtin in type_config, f"missing built-in type {builtin!r}"

    # ── legendOrder is a 7-element list ───────────────────────────────────
    assert isinstance(body["legendOrder"], list)
    assert len(body["legendOrder"]) == 7

    # ── collapseState is a dict (may be empty) ────────────────────────────
    assert isinstance(body["collapseState"], dict)
