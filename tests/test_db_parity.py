"""
Parity tests: planner.db (legacy blob) vs planner_db.db (normalized schema).

Run from the project root:
    python -m pytest tests/test_db_parity.py -v
"""
import json
import sqlite3
import pytest

# ── fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def legacy():
    """Return the parsed JSON blob from planner.db."""
    conn = sqlite3.connect("planner.db")
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT ps.data FROM users u "
        "LEFT JOIN planner_state ps ON u.id = ps.user_id"
    ).fetchone()
    conn.close()
    assert row and row["data"], "planner.db has no state data"
    return json.loads(row["data"])


@pytest.fixture(scope="session")
def new_db():
    """Return an open (read-only) connection to planner_db.db."""
    conn = sqlite3.connect("file:planner_db.db?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def new_user(new_db):
    row = new_db.execute("SELECT id FROM users LIMIT 1").fetchone()
    assert row, "planner_db.db has no users"
    return row["id"]


# ── helpers ───────────────────────────────────────────────────────────────

def _legacy_all_forms(legacy):
    """All form entries from the legacy blob (cols + weekUnscheduled)."""
    return legacy.get("cols", []) + legacy.get("weekUnscheduled", [])


def _legacy_all_tasks(legacy):
    """Flat list of all tasks from the legacy state dict."""
    tasks = []
    for col_tasks in legacy.get("state", {}).values():
        tasks.extend(col_tasks)
    return tasks


# ── tests: forms ─────────────────────────────────────────────────────────

def test_form_count(legacy, new_db, new_user):
    expected = len(_legacy_all_forms(legacy))
    actual = new_db.execute(
        "SELECT COUNT(*) FROM forms WHERE user_id=?", (new_user,)
    ).fetchone()[0]
    assert actual == expected, f"form count mismatch: {actual} != {expected}"


def test_all_form_client_ids_present(legacy, new_db, new_user):
    expected_ids = {f["id"] for f in _legacy_all_forms(legacy)}
    rows = new_db.execute(
        "SELECT client_id FROM forms WHERE user_id=?", (new_user,)
    ).fetchall()
    actual_ids = {r["client_id"] for r in rows}
    missing = expected_ids - actual_ids
    extra   = actual_ids - expected_ids
    assert not missing, f"forms missing from planner_db: {missing}"
    assert not extra,   f"extra forms in planner_db not in legacy: {extra}"


def test_day_col_labels_and_dates(legacy, new_db, new_user):
    for col in legacy.get("cols", []):
        row = new_db.execute(
            "SELECT label, date, is_unscheduled FROM forms WHERE user_id=? AND client_id=?",
            (new_user, col["id"])
        ).fetchone()
        assert row, f"day col {col['id']!r} not found in planner_db"
        assert row["label"] == col["label"], \
            f"label mismatch for {col['id']}: {row['label']!r} != {col['label']!r}"
        assert row["date"] == col.get("date", ""), \
            f"date mismatch for {col['id']}: {row['date']!r} != {col.get('date','')!r}"
        assert row["is_unscheduled"] == 0, \
            f"col {col['id']!r} should not be marked unscheduled"


def test_unscheduled_cols_flagged(legacy, new_db, new_user):
    for col in legacy.get("weekUnscheduled", []):
        row = new_db.execute(
            "SELECT is_unscheduled FROM forms WHERE user_id=? AND client_id=?",
            (new_user, col["id"])
        ).fetchone()
        assert row, f"unscheduled col {col['id']!r} not found in planner_db"
        assert row["is_unscheduled"] == 1, \
            f"col {col['id']!r} should be marked is_unscheduled=1"


# ── tests: tasks ──────────────────────────────────────────────────────────

def test_task_count(legacy, new_db, new_user):
    expected = len(_legacy_all_tasks(legacy))
    actual = new_db.execute(
        "SELECT COUNT(*) FROM tasks WHERE user_id=?", (new_user,)
    ).fetchone()[0]
    assert actual == expected, f"task count mismatch: {actual} != {expected}"


def test_all_task_client_ids_present(legacy, new_db, new_user):
    expected_ids = {t["id"] for t in _legacy_all_tasks(legacy)}
    rows = new_db.execute(
        "SELECT client_id FROM tasks WHERE user_id=?", (new_user,)
    ).fetchall()
    actual_ids = {r["client_id"] for r in rows}
    missing = expected_ids - actual_ids
    extra   = actual_ids - expected_ids
    assert not missing, f"tasks missing from planner_db: {missing}"
    assert not extra,   f"extra tasks in planner_db not in legacy: {extra}"


def test_task_names(legacy, new_db, new_user):
    for task in _legacy_all_tasks(legacy):
        row = new_db.execute(
            "SELECT name FROM tasks WHERE user_id=? AND client_id=?",
            (new_user, task["id"])
        ).fetchone()
        assert row, f"task {task['id']!r} not found in planner_db"
        assert row["name"] == task["text"], \
            f"name mismatch for task {task['id']}: {row['name']!r} != {task['text']!r}"


def test_task_done_flags(legacy, new_db, new_user):
    for task in _legacy_all_tasks(legacy):
        row = new_db.execute(
            "SELECT done FROM tasks WHERE user_id=? AND client_id=?",
            (new_user, task["id"])
        ).fetchone()
        assert row, f"task {task['id']!r} not found in planner_db"
        expected_done = 1 if task.get("done") else 0
        assert row["done"] == expected_done, \
            f"done mismatch for task {task['id']}: {row['done']} != {expected_done}"


def test_tasks_assigned_to_correct_form(legacy, new_db, new_user):
    state = legacy.get("state", {})
    for col_id, tasks in state.items():
        form_row = new_db.execute(
            "SELECT id FROM forms WHERE user_id=? AND client_id=?",
            (new_user, col_id)
        ).fetchone()
        assert form_row, f"form {col_id!r} not found for task assignment check"
        form_id = form_row["id"]
        for task in tasks:
            row = new_db.execute(
                "SELECT form_id FROM tasks WHERE user_id=? AND client_id=?",
                (new_user, task["id"])
            ).fetchone()
            assert row, f"task {task['id']!r} not found in planner_db"
            assert row["form_id"] == form_id, \
                f"task {task['id']!r} is on form {row['form_id']} but should be on {form_id} ({col_id})"


def test_task_metadata_type(legacy, new_db, new_user):
    for task in _legacy_all_tasks(legacy):
        if "type" not in task:
            continue
        row = new_db.execute(
            "SELECT metadata FROM tasks WHERE user_id=? AND client_id=?",
            (new_user, task["id"])
        ).fetchone()
        assert row, f"task {task['id']!r} not found in planner_db"
        meta = json.loads(row["metadata"])
        assert meta.get("type") == task["type"], \
            f"type mismatch for task {task['id']}: {meta.get('type')!r} != {task['type']!r}"


def test_task_sort_order_within_column(legacy, new_db, new_user):
    """Tasks within each column preserve their original order."""
    state = legacy.get("state", {})
    for col_id, tasks in state.items():
        rows = new_db.execute(
            "SELECT t.client_id FROM tasks t "
            "JOIN forms f ON t.form_id = f.id "
            "WHERE t.user_id=? AND f.client_id=? "
            "ORDER BY t.sort_order",
            (new_user, col_id)
        ).fetchall()
        actual_order   = [r["client_id"] for r in rows]
        expected_order = [t["id"] for t in tasks]
        assert actual_order == expected_order, \
            f"sort order mismatch in col {col_id!r}: {actual_order} != {expected_order}"


# ── tests: user metadata ──────────────────────────────────────────────────

META_KEYS = ("lang", "uiScale", "idCounter", "colCounter", "typeCounter",
             "legendOrder", "typeConfig", "collapseState")

def test_user_metadata_keys_present(legacy, new_db, new_user):
    row = new_db.execute(
        "SELECT metadata FROM users WHERE id=?", (new_user,)
    ).fetchone()
    assert row, "user row not found in planner_db"
    meta = json.loads(row["metadata"])
    for key in META_KEYS:
        assert key in meta, f"metadata key {key!r} missing from users.metadata"


def test_user_metadata_scalar_values(legacy, new_db, new_user):
    row = new_db.execute(
        "SELECT metadata FROM users WHERE id=?", (new_user,)
    ).fetchone()
    meta = json.loads(row["metadata"])
    for key in ("lang", "uiScale", "idCounter", "colCounter", "typeCounter"):
        assert meta[key] == legacy[key], \
            f"metadata[{key!r}] mismatch: {meta[key]!r} != {legacy[key]!r}"


def test_user_metadata_legend_order(legacy, new_db, new_user):
    row = new_db.execute(
        "SELECT metadata FROM users WHERE id=?", (new_user,)
    ).fetchone()
    meta = json.loads(row["metadata"])
    assert meta["legendOrder"] == legacy["legendOrder"], \
        f"legendOrder mismatch: {meta['legendOrder']} != {legacy['legendOrder']}"


def test_user_metadata_type_config_keys(legacy, new_db, new_user):
    row = new_db.execute(
        "SELECT metadata FROM users WHERE id=?", (new_user,)
    ).fetchone()
    meta = json.loads(row["metadata"])
    assert set(meta["typeConfig"].keys()) == set(legacy["typeConfig"].keys()), \
        "typeConfig keys differ between legacy and planner_db"
