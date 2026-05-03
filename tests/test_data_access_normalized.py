"""
Tests for the normalized-DB side of `backend.data_access`:
  - get_user_id
  - get_user
  - get_forms
  - get_tasks
  - get_state_2 (assembled state for the frontend)
"""
import pytest

from backend import data_access


# ── get_user_id ──────────────────────────────────────────────────────────

def test_get_user_id_returns_id_for_known_token(app_ctx, seed):
    uid = seed.user("tok-abc")
    assert data_access.get_user_id("tok-abc") == uid


def test_get_user_id_returns_none_for_unknown_token(app_ctx, seed):
    seed.user("real-token")
    assert data_access.get_user_id("nope") is None


def test_get_user_id_is_case_sensitive(app_ctx, seed):
    seed.user("MixedCase")
    assert data_access.get_user_id("mixedcase") is None
    assert data_access.get_user_id("MixedCase") is not None


def test_get_user_id_empty_string(app_ctx, seed):
    seed.user("nonempty")
    assert data_access.get_user_id("") is None


# ── get_user ─────────────────────────────────────────────────────────────

def test_get_user_returns_full_record(app_ctx, seed):
    meta = {"lang": "en", "uiScale": 1.0, "idCounter": 5}
    uid = seed.user("tok", meta)

    user = data_access.get_user(uid)

    assert user == {"id": uid, "token": "tok", "metadata": meta}


def test_get_user_returns_none_for_unknown_id(app_ctx, seed):
    assert data_access.get_user(9999) is None


def test_get_user_parses_metadata_json(app_ctx, seed):
    uid = seed.user("t", {"nested": {"a": [1, 2]}})
    assert data_access.get_user(uid)["metadata"] == {"nested": {"a": [1, 2]}}


# ── get_forms ────────────────────────────────────────────────────────────

def test_get_forms_empty_for_user_with_none(app_ctx, seed):
    uid = seed.user("t")
    assert data_access.get_forms(uid) == []


def test_get_forms_returns_all_columns(app_ctx, seed):
    uid = seed.user("t")
    seed.form(uid, "c1", "Mon", date="01/15", is_unscheduled=0, sort_order=0)

    forms = data_access.get_forms(uid)

    assert len(forms) == 1
    assert forms[0]["client_id"]      == "c1"
    assert forms[0]["label"]          == "Mon"
    assert forms[0]["date"]           == "01/15"
    assert forms[0]["is_unscheduled"] == 0
    assert forms[0]["sort_order"]     == 0
    assert "id" in forms[0]


def test_get_forms_ordered_by_sort_order(app_ctx, seed):
    uid = seed.user("t")
    seed.form(uid, "third",  "C", sort_order=2)
    seed.form(uid, "first",  "A", sort_order=0)
    seed.form(uid, "second", "B", sort_order=1)

    forms = data_access.get_forms(uid)
    assert [f["client_id"] for f in forms] == ["first", "second", "third"]


def test_get_forms_isolates_users(app_ctx, seed):
    a = seed.user("a")
    b = seed.user("b")
    seed.form(a, "ac", "Alice's col")
    seed.form(b, "bc", "Bob's col")

    a_forms = data_access.get_forms(a)
    b_forms = data_access.get_forms(b)
    assert [f["client_id"] for f in a_forms] == ["ac"]
    assert [f["client_id"] for f in b_forms] == ["bc"]


# ── get_tasks ────────────────────────────────────────────────────────────

def test_get_tasks_empty_for_user_with_none(app_ctx, seed):
    uid = seed.user("t")
    assert data_access.get_tasks(uid) == []


def test_get_tasks_parses_metadata(app_ctx, seed):
    uid = seed.user("t")
    fid = seed.form(uid, "c1", "Mon")
    seed.task(uid, fid, "tk1", "Buy milk",
              done=0, sort_order=0,
              metadata={"type": "interview", "important": True})

    tasks = data_access.get_tasks(uid)
    assert len(tasks) == 1
    t = tasks[0]
    assert t["client_id"]   == "tk1"
    assert t["name"]        == "Buy milk"
    assert t["done"]        == 0
    assert t["form_id"]     == fid
    assert t["metadata"]    == {"type": "interview", "important": True}


def test_get_tasks_ordered_by_form_then_sort_order(app_ctx, seed):
    uid = seed.user("t")
    f1 = seed.form(uid, "c1", "Mon", sort_order=0)
    f2 = seed.form(uid, "c2", "Tue", sort_order=1)
    seed.task(uid, f2, "f2t1", "F2-A", sort_order=0)
    seed.task(uid, f1, "f1t2", "F1-B", sort_order=1)
    seed.task(uid, f1, "f1t1", "F1-A", sort_order=0)

    tasks = data_access.get_tasks(uid)
    # ordered by (form_id ASC, sort_order ASC)
    assert [t["client_id"] for t in tasks] == ["f1t1", "f1t2", "f2t1"]


def test_get_tasks_isolates_users(app_ctx, seed):
    a = seed.user("a"); b = seed.user("b")
    fa = seed.form(a, "ac", "A")
    fb = seed.form(b, "bc", "B")
    seed.task(a, fa, "atask", "Alice")
    seed.task(b, fb, "btask", "Bob")

    a_tasks = data_access.get_tasks(a)
    assert len(a_tasks) == 1
    assert a_tasks[0]["client_id"] == "atask"


# ── get_state_2 ──────────────────────────────────────────────────────────

def test_get_state_2_returns_none_for_unknown_user(app_ctx):
    assert data_access.get_state_2(12345) is None


def test_get_state_2_for_user_with_no_data(app_ctx, seed):
    uid = seed.user("t", metadata={})

    state = data_access.get_state_2(uid)

    assert state == {
        "cols":            [],
        "weekUnscheduled": [],
        "state":           {},
        "idCounter":       0,
        "colCounter":      0,
        "typeCounter":     0,
        "typeConfig":      {},
        "legendOrder":     [],
        "uiScale":         1,
        "lang":            "en",
        "collapseState":   {},
    }


def test_get_state_2_assembles_full_state(app_ctx, seed):
    meta = {
        "idCounter": 10, "colCounter": 5, "typeCounter": 8,
        "typeConfig": {"interview": {"bg": "#fff", "border": "#000", "text": "#333"}},
        "legendOrder": ["interview", "rest"],
        "uiScale": 1.25, "lang": "ru",
        "collapseState": {"c1": True},
    }
    uid = seed.user("tok", metadata=meta)
    f1 = seed.form(uid, "c1", "Mon", date="01/15", is_unscheduled=0, sort_order=0)
    f2 = seed.form(uid, "c2", "Tue", date="01/16", is_unscheduled=0, sort_order=1)
    fu = seed.form(uid, "u1", "Backlog", date=None, is_unscheduled=1, sort_order=2)

    seed.task(uid, f1, "t1", "Buy milk", done=0, sort_order=0,
              metadata={"type": "interview", "important": True})
    seed.task(uid, f1, "t2", "Pay rent",  done=1, sort_order=1,
              metadata={"type": "rest"})
    seed.task(uid, fu, "t3", "Someday",   done=0, sort_order=0, metadata={})

    state = data_access.get_state_2(uid)

    assert state["cols"] == [
        {"id": "c1", "label": "Mon", "date": "01/15"},
        {"id": "c2", "label": "Tue", "date": "01/16"},
    ]
    assert state["weekUnscheduled"] == [{"id": "u1", "label": "Backlog"}]

    # tasks merged via metadata.update — keys from metadata appear flat
    assert state["state"]["c1"][0] == {
        "id": "t1", "text": "Buy milk", "done": False,
        "type": "interview", "important": True,
    }
    assert state["state"]["c1"][1] == {
        "id": "t2", "text": "Pay rent", "done": True, "type": "rest",
    }
    assert state["state"]["c2"] == []
    assert state["state"]["u1"] == [
        {"id": "t3", "text": "Someday", "done": False},
    ]

    # metadata fields propagated
    assert state["idCounter"]     == 10
    assert state["colCounter"]    == 5
    assert state["typeCounter"]   == 8
    assert state["typeConfig"]    == meta["typeConfig"]
    assert state["legendOrder"]   == ["interview", "rest"]
    assert state["uiScale"]       == 1.25
    assert state["lang"]          == "ru"
    assert state["collapseState"] == {"c1": True}


def test_get_state_2_done_is_bool(app_ctx, seed):
    """`done` comes out of SQLite as int 0/1 but get_state_2 normalizes to bool."""
    uid = seed.user("t", metadata={})
    f = seed.form(uid, "c1", "Mon")
    seed.task(uid, f, "t1", "x", done=1, metadata={})
    seed.task(uid, f, "t2", "y", done=0, metadata={})

    state = data_access.get_state_2(uid)
    dones = {t["id"]: t["done"] for t in state["state"]["c1"]}
    assert dones["t1"] is True
    assert dones["t2"] is False


def test_get_state_2_skips_orphan_tasks(app_ctx, seed, db_paths):
    """A task whose form_id no longer points to any form must be silently skipped."""
    import sqlite3
    uid = seed.user("t", metadata={})
    fid = seed.form(uid, "c1", "Mon")
    seed.task(uid, fid, "t1", "real",   metadata={})
    # insert a task with bogus form_id directly
    conn = sqlite3.connect(db_paths["new"])
    try:
        conn.execute(
            "INSERT INTO tasks (user_id, form_id, client_id, name, done, sort_order, metadata)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (uid, 99999, "orphan", "ghost", 0, 0, "{}"),
        )
        conn.commit()
    finally:
        conn.close()

    state = data_access.get_state_2(uid)
    ids = [t["id"] for t in state["state"]["c1"]]
    assert "t1" in ids
    assert "orphan" not in ids
    # orphan must not have created a stray group either
    assert set(state["state"].keys()) == {"c1"}


def test_get_state_2_metadata_overrides_core_fields(app_ctx, seed):
    """If task metadata sets `text` or `done`, dict.update lets it override —
    document the current behavior so a future refactor is intentional."""
    uid = seed.user("t", metadata={})
    f = seed.form(uid, "c1", "Mon")
    seed.task(uid, f, "t1", "real-name", done=0,
              metadata={"text": "from-metadata", "done": True})

    state = data_access.get_state_2(uid)
    task = state["state"]["c1"][0]
    # current implementation: task_obj.update(metadata) — metadata wins
    assert task["text"] == "from-metadata"
    assert task["done"] is True


def test_get_state_2_metadata_defaults_when_keys_missing(app_ctx, seed):
    uid = seed.user("t", metadata={})  # totally empty metadata

    state = data_access.get_state_2(uid)
    assert state["uiScale"] == 1
    assert state["lang"]    == "en"
    assert state["typeConfig"] == {}
    assert state["legendOrder"] == []
