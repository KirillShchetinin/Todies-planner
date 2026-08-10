"""Tests for the removable additive-column migration step."""
import sqlite3

from backend.data_access import db_mgmt


def _columns(conn, table):
    return [r[1] for r in conn.execute(f'PRAGMA table_info({table})')]


def _tasks_db(tmp_path, name='m.db'):
    """A tasks table shaped like the pre-migration schema, with one row."""
    conn = sqlite3.connect(str(tmp_path / name))
    conn.execute('CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)')
    conn.execute("INSERT INTO tasks (name) VALUES ('existing')")
    conn.commit()
    return conn


def test_adds_missing_columns(tmp_path):
    conn = _tasks_db(tmp_path)
    db_mgmt.apply_migrations(conn)
    cols = _columns(conn, 'tasks')
    assert 'created_at' in cols
    assert 'updated_at' in cols


def test_existing_rows_read_null(tmp_path):
    conn = _tasks_db(tmp_path)
    db_mgmt.apply_migrations(conn)
    row = conn.execute('SELECT name, created_at, updated_at FROM tasks').fetchone()
    assert row == ('existing', None, None)


def test_is_idempotent(tmp_path):
    conn = _tasks_db(tmp_path)
    db_mgmt.apply_migrations(conn)
    db_mgmt.apply_migrations(conn)
    cols = _columns(conn, 'tasks')
    assert cols.count('created_at') == 1
    assert cols.count('updated_at') == 1


def test_survives_missing_table(tmp_path):
    conn = sqlite3.connect(str(tmp_path / 'empty.db'))
    db_mgmt.apply_migrations(conn)          # must not raise
    assert _columns(conn, 'tasks') == []


def test_survives_closed_connection(tmp_path):
    conn = _tasks_db(tmp_path)
    conn.close()
    db_mgmt.apply_migrations(conn)          # must not raise
