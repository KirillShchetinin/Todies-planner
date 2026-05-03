"""
Shared pytest fixtures for backend tests.

Strategy:
  - The backend uses two SQLite files whose paths are module-level constants
    in `backend.data_access`. We monkeypatch those constants to point at
    temporary files for each test, giving full isolation without touching the
    real planner.db / planner_db.db.
  - The Flask `app` is constructed once at import time in `backend.controller`
    and is reused; we put it into TESTING mode and rely on per-test DB swap
    plus `g`-scoped connections to keep tests isolated.
"""
import json
import os
import sqlite3
import sys

import pytest

# Make project root importable so `import backend.*` works when pytest is run
# from anywhere.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend import controller, data_access  # noqa: E402


# ── DB schemas ────────────────────────────────────────────────────────────

LEGACY_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT    NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS planner_state (
    user_id INTEGER UNIQUE REFERENCES users(id),
    data    TEXT    NOT NULL
);
"""

NORMALIZED_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    token    TEXT NOT NULL UNIQUE,
    metadata TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS forms (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    client_id       TEXT NOT NULL,
    label           TEXT NOT NULL,
    date            TEXT,
    is_unscheduled  INTEGER,
    sort_order      INTEGER
);
CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    form_id         INTEGER NOT NULL REFERENCES forms(id),
    client_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    done            INTEGER,
    sort_order      INTEGER,
    metadata        TEXT NOT NULL
);
"""


def _create_legacy_db(path):
    conn = sqlite3.connect(path)
    try:
        conn.executescript(LEGACY_SCHEMA)
        conn.commit()
    finally:
        conn.close()


def _create_normalized_db(path):
    conn = sqlite3.connect(path)
    try:
        conn.executescript(NORMALIZED_SCHEMA)
        conn.commit()
    finally:
        conn.close()


# ── fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def db_paths(tmp_path, monkeypatch):
    """
    Redirect data_access to use fresh temp DB files for this test.

    Yields a dict with the two paths. Both DBs start with the schema applied
    but no rows.
    """
    legacy_path = tmp_path / "planner.db"
    new_path    = tmp_path / "planner_db.db"
    _create_legacy_db(str(legacy_path))
    _create_normalized_db(str(new_path))

    monkeypatch.setattr(data_access, "DB_PATH",     str(legacy_path))
    monkeypatch.setattr(data_access, "NEW_DB_PATH", str(new_path))

    yield {"legacy": str(legacy_path), "new": str(new_path)}


@pytest.fixture
def app(db_paths):
    """
    Flask app in TESTING mode, with DB paths pointed at temp files.

    The app object itself is the module-level singleton from
    `backend.controller`; we just toggle config and lean on the
    `db_paths` fixture for isolation.
    """
    flask_app = controller.app
    prev_testing = flask_app.config.get("TESTING")
    flask_app.config["TESTING"] = True
    try:
        yield flask_app
    finally:
        flask_app.config["TESTING"] = prev_testing


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def app_ctx(app):
    """Push an application context for tests calling data_access directly."""
    with app.app_context():
        yield


# ── seeding helpers (also exposed as fixtures for convenience) ───────────

def _seed_legacy_state(legacy_path, user_id, state):
    conn = sqlite3.connect(legacy_path)
    try:
        conn.execute(
            "INSERT OR REPLACE INTO planner_state (user_id, data) VALUES (?, ?)",
            (user_id, json.dumps(state)),
        )
        conn.commit()
    finally:
        conn.close()


def _seed_user(new_path, token, metadata=None):
    conn = sqlite3.connect(new_path)
    try:
        cur = conn.execute(
            "INSERT INTO users (token, metadata) VALUES (?, ?)",
            (token, json.dumps(metadata or {})),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def _seed_form(new_path, user_id, client_id, label,
               date=None, is_unscheduled=0, sort_order=0):
    conn = sqlite3.connect(new_path)
    try:
        cur = conn.execute(
            "INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, client_id, label, date, is_unscheduled, sort_order),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def _seed_task(new_path, user_id, form_id, client_id, name,
               done=0, sort_order=0, metadata=None):
    conn = sqlite3.connect(new_path)
    try:
        cur = conn.execute(
            "INSERT INTO tasks (user_id, form_id, client_id, name, done, sort_order, metadata)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, form_id, client_id, name, done, sort_order,
             json.dumps(metadata or {})),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


@pytest.fixture
def seed(db_paths):
    """
    Bundled seeding helpers bound to the current test's temp DB paths.

    Usage:
        def test_x(seed, app_ctx):
            uid = seed.user("tok", {"lang": "en"})
            fid = seed.form(uid, "col1", "Mon", date="01/15", sort_order=0)
            seed.task(uid, fid, "task1", "Buy milk")
    """
    legacy_path = db_paths["legacy"]
    new_path    = db_paths["new"]

    class _Seed:
        @staticmethod
        def legacy_state(user_id, state):
            _seed_legacy_state(legacy_path, user_id, state)

        @staticmethod
        def user(token, metadata=None):
            return _seed_user(new_path, token, metadata)

        @staticmethod
        def form(user_id, client_id, label, **kw):
            return _seed_form(new_path, user_id, client_id, label, **kw)

        @staticmethod
        def task(user_id, form_id, client_id, name, **kw):
            return _seed_task(new_path, user_id, form_id, client_id, name, **kw)

    return _Seed
