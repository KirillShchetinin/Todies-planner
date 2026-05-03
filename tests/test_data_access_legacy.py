"""
Tests for the legacy-DB side of `backend.data_access`:
  - init_db
  - backup
  - get_state / set_state
  - connection lifecycle (get_db, close_db, register)
"""
import json
import os
import sqlite3

import pytest
from flask import g

from backend import data_access


# ── init_db ──────────────────────────────────────────────────────────────

def test_init_db_creates_tables(tmp_path, monkeypatch):
    db_file = tmp_path / "fresh.db"
    monkeypatch.setattr(data_access, "DB_PATH", str(db_file))

    data_access.init_db()

    assert db_file.exists()
    conn = sqlite3.connect(str(db_file))
    try:
        names = {
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
    finally:
        conn.close()
    assert "users" in names
    assert "planner_state" in names


def test_init_db_is_idempotent(tmp_path, monkeypatch):
    db_file = tmp_path / "fresh.db"
    monkeypatch.setattr(data_access, "DB_PATH", str(db_file))

    data_access.init_db()
    # second call must not raise even though tables exist
    data_access.init_db()


def test_init_db_users_token_unique(tmp_path, monkeypatch):
    db_file = tmp_path / "fresh.db"
    monkeypatch.setattr(data_access, "DB_PATH", str(db_file))
    data_access.init_db()

    conn = sqlite3.connect(str(db_file))
    try:
        conn.execute("INSERT INTO users (token) VALUES ('abc')")
        conn.commit()
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO users (token) VALUES ('abc')")
            conn.commit()
    finally:
        conn.close()


# ── backup ───────────────────────────────────────────────────────────────

def test_backup_returns_none_when_db_missing(tmp_path, monkeypatch):
    missing = tmp_path / "nope.db"
    monkeypatch.setattr(data_access, "DB_PATH", str(missing))

    result = data_access.backup(str(tmp_path / "backups"))

    assert result is None
    assert not (tmp_path / "backups").exists()


def test_backup_creates_timestamped_copy(tmp_path, monkeypatch):
    db_file = tmp_path / "planner.db"
    db_file.write_bytes(b"fake-sqlite-bytes")
    monkeypatch.setattr(data_access, "DB_PATH", str(db_file))
    backup_dir = tmp_path / "backups"

    dest = data_access.backup(str(backup_dir))

    assert dest is not None
    assert os.path.exists(dest)
    fname = os.path.basename(dest)
    assert fname.startswith("planner_backup_")
    assert fname.endswith(".db")
    # contents preserved
    with open(dest, "rb") as f:
        assert f.read() == b"fake-sqlite-bytes"


def test_backup_creates_dir_if_missing(tmp_path, monkeypatch):
    db_file = tmp_path / "planner.db"
    db_file.write_bytes(b"x")
    monkeypatch.setattr(data_access, "DB_PATH", str(db_file))
    backup_dir = tmp_path / "deeply" / "nested" / "backups"

    dest = data_access.backup(str(backup_dir))

    assert dest is not None
    assert backup_dir.is_dir()


# ── get_state / set_state ────────────────────────────────────────────────

def test_get_state_returns_none_for_unknown_user(app_ctx):
    assert data_access.get_state(123) is None


def test_get_state_returns_none_for_anonymous_when_empty(app_ctx):
    assert data_access.get_state(None) is None


def test_set_then_get_state_roundtrip(app_ctx):
    state = {
        "cols": [{"id": "c1", "label": "Mon", "date": "01/15"}],
        "weekUnscheduled": [],
        "state": {"c1": [{"id": "t1", "text": "Buy milk", "done": False}]},
        "idCounter": 1,
        "uiScale": 1.0,
    }
    data_access.set_state(42, state)

    got = data_access.get_state(42)
    assert got == state


def test_set_state_replaces_existing_row(app_ctx):
    data_access.set_state(7, {"v": 1})
    data_access.set_state(7, {"v": 2})

    got = data_access.get_state(7)
    assert got == {"v": 2}


def test_set_state_keeps_users_isolated(app_ctx):
    data_access.set_state(1, {"who": "alice"})
    data_access.set_state(2, {"who": "bob"})
    data_access.set_state(None, {"who": "anon"})

    assert data_access.get_state(1)    == {"who": "alice"}
    assert data_access.get_state(2)    == {"who": "bob"}
    assert data_access.get_state(None) == {"who": "anon"}


def test_get_state_anonymous_distinct_from_user_zero(app_ctx):
    """user_id=None must not collide with any integer user_id."""
    data_access.set_state(0, {"who": "user-zero"})
    # anonymous (NULL) should still be empty
    assert data_access.get_state(None) is None


def test_set_state_handles_unicode_and_nested(app_ctx):
    state = {"text": "тест ✓", "nested": {"a": [1, 2, {"b": "ok"}]}}
    data_access.set_state(5, state)
    assert data_access.get_state(5) == state


def test_set_state_raises_on_non_serializable(app_ctx):
    with pytest.raises(TypeError):
        data_access.set_state(1, {"bad": object()})


def test_get_state_raises_on_corrupted_json(app_ctx, db_paths):
    """If a row exists with non-JSON data, get_state surfaces the parse error."""
    conn = sqlite3.connect(db_paths["legacy"])
    try:
        conn.execute(
            "INSERT INTO planner_state (user_id, data) VALUES (?, ?)",
            (99, "not-json"),
        )
        conn.commit()
    finally:
        conn.close()

    with pytest.raises(json.JSONDecodeError):
        data_access.get_state(99)


# ── connection lifecycle ─────────────────────────────────────────────────

def test_get_db_returns_same_connection_within_request(app_ctx):
    a = data_access.get_db()
    b = data_access.get_db()
    assert a is b


def test_get_db_2_returns_same_connection_within_request(app_ctx):
    a = data_access.get_db_2()
    b = data_access.get_db_2()
    assert a is b


def test_close_db_clears_g(app):
    with app.app_context():
        data_access.get_db()
        data_access.get_db_2()
        assert "db" in g
        assert "db_2" in g
        data_access.close_db()
        assert "db"   not in g
        assert "db_2" not in g


def test_close_db_safe_when_nothing_opened(app):
    with app.app_context():
        # neither db nor db_2 ever fetched — close_db must not raise
        data_access.close_db()


def test_register_attaches_teardown(app):
    """register() must wire close_db as a teardown_appcontext handler."""
    handlers = app.teardown_appcontext_funcs
    assert data_access.close_db in handlers


def test_connections_use_row_factory(app_ctx):
    db = data_access.get_db()
    cur = db.execute("SELECT 1 AS one")
    row = cur.fetchone()
    # sqlite3.Row supports name-based access
    assert row["one"] == 1
