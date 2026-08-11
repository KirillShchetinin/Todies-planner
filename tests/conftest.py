"""
Shared pytest fixtures for backend tests.

Strategy:
  - The backend uses a single SQLite file whose path is a module-level constant
    in `backend.data_access.connections`. We monkeypatch that constant to point
    at a temporary file for each test, giving full isolation without touching
    the real planner_db.db.
  - The schema is built by the app's own `init_db()`, so tests run against the
    production schema (constraints and defaults included) rather than a copy
    that can drift from it.
  - The Flask `app` is constructed once at import time in
    `backend.controllers.controller` and is reused; we put it into TESTING mode
    and rely on per-test DB swap plus `g`-scoped connections to keep tests isolated.
"""
import json
import os
import sqlite3
import sys
from contextlib import closing

import pytest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.controllers import controller  # noqa: E402
from backend.data_access import connections, db_mgmt  # noqa: E402


# ── fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def db_path(tmp_path, monkeypatch):
    """Redirect data_access at a fresh temp DB: real schema, no rows."""
    path = str(tmp_path / "planner_db.db")
    monkeypatch.setattr(connections, "DB_PATH", path)
    db_mgmt.init_db()
    return path


@pytest.fixture
def db(db_path):
    """Direct SQL against the test DB, for setup and for asserting what landed."""
    class _Db:
        @staticmethod
        def exec(sql, *params):
            """Run a write. Returns the new row id."""
            with closing(sqlite3.connect(db_path)) as conn:
                row_id = conn.execute(sql, params).lastrowid
                conn.commit()
                return row_id

        @staticmethod
        def one(sql, *params):
            """First row, or None."""
            with closing(sqlite3.connect(db_path)) as conn:
                return conn.execute(sql, params).fetchone()

    return _Db


@pytest.fixture
def app(db_path):
    """
    Flask app in TESTING mode, with DB path pointed at a temp file.

    The app object itself is the module-level singleton from
    `backend.controllers.controller`; we just toggle config and lean on the
    `db_path` fixture for isolation.
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

@pytest.fixture
def seed(db):
    """
    Rows inserted straight into the test DB, bypassing the API.

    Usage:
        def test_x(seed, app_ctx):
            uid = seed.user("tok", {"lang": "en"})
            fid = seed.form(uid, "col1", "Mon", date="01/15", sort_order=0)
            seed.task(uid, fid, "task1", "Buy milk")
    """
    class _Seed:
        @staticmethod
        def user(token, metadata=None):
            return db.exec("INSERT INTO users (token, metadata) VALUES (?, ?)",
                           token, json.dumps(metadata or {}))

        @staticmethod
        def form(user_id, client_id, label, date='', is_unscheduled=0, sort_order=0):
            return db.exec(
                "INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                user_id, client_id, label, date, is_unscheduled, sort_order)

        @staticmethod
        def task(user_id, form_id, client_id, name, done=0, sort_order=0, metadata=None):
            return db.exec(
                "INSERT INTO tasks (user_id, form_id, client_id, name, done, sort_order, metadata)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                user_id, form_id, client_id, name, done, sort_order,
                json.dumps(metadata or {}))

    return _Seed


# ── shared API test fixtures ──────────────────────────────────────────────

_DEFAULT_META = {
    'typeCounter': 0, 'typeConfig': {}, 'legendOrder': [],
    'uiScale': 1, 'uiScaleMobile': 1, 'lang': 'en', 'collapseState': {},
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


@pytest.fixture
def api(client):
    """Requests to the app, with the token folded in."""
    class _Api:
        # Raw requests with the token folded into the query string. Query
        # params for GET/DELETE, JSON body for POST/PUT.
        @staticmethod
        def get(token, path, **params):
            return client.get(path, query_string={'token': token, **params})

        @staticmethod
        def post(token, path, **body):
            return client.post(path, query_string={'token': token}, json=body)

        @staticmethod
        def put(token, path, **body):
            return client.put(path, query_string={'token': token}, json=body)

        @staticmethod
        def delete(token, path):
            return client.delete(path, query_string={'token': token})

        # Board building for tests whose subject is something else. These
        # assert nothing — a failed create surfaces as a KeyError on the body.
        @staticmethod
        def form(token, **kw):
            return _Api.post(token, '/api/v2/forms',
                             **{'label': 'Mon', **kw}).get_json()['id']

        @staticmethod
        def task(token, form_id, **kw):
            return _Api.post(token, '/api/v2/tasks',
                             **{'form_id': form_id, **kw}).get_json()['id']

        @staticmethod
        def tasks(token):
            return _Api.get(token, '/api/v2/tasks').get_json()['tasks']

        @staticmethod
        def forms(token):
            return _Api.get(token, '/api/v2/forms').get_json()

    return _Api
