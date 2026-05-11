import datetime, os, shutil, sqlite3
from flask import g

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH  = os.path.join(BASE_DIR, 'planner_db.db')


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA synchronous=NORMAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def get_db():
    if 'db' not in g:
        g.db = _connect()
    return g.db


def close_db(_exception=None):
    conn = g.pop('db', None)
    if conn is not None:
        conn.close()


def register(app):
    app.teardown_appcontext(close_db)


def backup(backup_dir):
    if not os.path.exists(DB_PATH):
        return None
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    dest = os.path.join(backup_dir, f'planner_db_backup_{ts}.db')
    shutil.copy2(DB_PATH, dest)
    return [dest]
