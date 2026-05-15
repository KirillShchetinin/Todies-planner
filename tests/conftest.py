"""
Shared pytest fixtures for backend tests.

Strategy:
  - The backend uses a single SQLite file whose path is a module-level constant
    in `backend.data_access.connections`. We monkeypatch that constant to point
    at a temporary file for each test, giving full isolation without touching
    the real planner_db.db.
  - The Flask `app` is constructed once at import time in
    `backend.controllers.controller` and is reused; we put it into TESTING mode
    and rely on per-test DB swap plus `g`-scoped connections to keep tests isolated.
"""
import json
import os
import sqlite3
import sys

import pytest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.controllers import controller  # noqa: E402
from backend.data_access import connections  # noqa: E402


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
    Redirect data_access to use a fresh temp DB file for this test.

    Yields a dict with the path. The DB starts with the schema applied
    but no rows.
    """
    new_path = tmp_path / "planner_db.db"
    _create_normalized_db(str(new_path))

    monkeypatch.setattr(connections, "DB_PATH", str(new_path))

    yield {"new": str(new_path)}


@pytest.fixture
def app(db_paths):
    """
    Flask app in TESTING mode, with DB path pointed at a temp file.

    The app object itself is the module-level singleton from
    `backend.controllers.controller`; we just toggle config and lean on the
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


# ── seeding helpers ───────────────────────────────────────────────────────

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
    Bundled seeding helpers bound to the current test's temp DB path.

    Usage:
        def test_x(seed, app_ctx):
            uid = seed.user("tok", {"lang": "en"})
            fid = seed.form(uid, "col1", "Mon", date="01/15", sort_order=0)
            seed.task(uid, fid, "task1", "Buy milk")
    """
    new_path = db_paths["new"]

    class _Seed:
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


# ── shared API test fixtures ──────────────────────────────────────────────

_DEFAULT_META = {
    'typeCounter': 0, 'typeConfig': {}, 'legendOrder': [],
    'uiScale': 1, 'lang': 'en', 'collapseState': {},
}

_TOKEN_A = 'aaaa' * 16
_TOKEN_B = 'bbbb' * 16


@pytest.fixture
def token(seed):
    """Single seeded user. Avoids hitting POST /api/account rate limiter."""
    seed.user(_TOKEN_A, _DEFAULT_META)
    return _TOKEN_A


@pytest.fixture
def two_tokens(seed):
    """Two seeded users for isolation tests."""
    seed.user(_TOKEN_A, _DEFAULT_META)
    seed.user(_TOKEN_B, _DEFAULT_META)
    return _TOKEN_A, _TOKEN_B
