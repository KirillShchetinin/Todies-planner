import datetime, os, shutil, sqlite3
from flask import g

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH     = os.path.join(BASE_DIR, 'planner.db')
NEW_DB_PATH = os.path.join(BASE_DIR, 'planner_db.db')


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_2():
    conn = sqlite3.connect(NEW_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA synchronous=NORMAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def get_db():
    if 'db' not in g:
        g.db = _connect()
    return g.db


def get_db_2():
    if 'db_2' not in g:
        g.db_2 = _connect_2()
    return g.db_2


def close_db(_exception=None):
    conn = g.pop('db', None)
    if conn is not None:
        conn.close()
    conn_2 = g.pop('db_2', None)
    if conn_2 is not None:
        conn_2.close()


def register(app):
    app.teardown_appcontext(close_db)


def backup(backup_dir):
    if not os.path.exists(DB_PATH) and not os.path.exists(NEW_DB_PATH):
        return None
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    copied = []
    for src, name in ((NEW_DB_PATH, 'planner_db'),):
        if os.path.exists(src):
            dest = os.path.join(backup_dir, f'{name}_backup_{ts}.db')
            shutil.copy2(src, dest)
            copied.append(dest)
    return copied or None
