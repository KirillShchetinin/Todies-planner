import datetime, json, os, shutil, sqlite3
from flask import g

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH  = os.path.join(BASE_DIR, 'planner.db')


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
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


def init_db():
    conn = _connect()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT    NOT NULL UNIQUE
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS planner_state (
                user_id INTEGER UNIQUE REFERENCES users(id),
                data    TEXT    NOT NULL
            )
        ''')
        conn.commit()
    finally:
        conn.close()


def backup(backup_dir):
    if not os.path.exists(DB_PATH):
        return None
    os.makedirs(backup_dir, exist_ok=True)
    ts   = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    dest = os.path.join(backup_dir, f'planner_backup_{ts}.db')
    shutil.copy2(DB_PATH, dest)
    return dest


def get_user_id(token):
    row = get_db().execute(
        'SELECT id FROM users WHERE token=?', (token,)
    ).fetchone()
    return row['id'] if row else None


def get_state(user_id):
    db = get_db()
    if user_id is not None:
        row = db.execute(
            'SELECT data FROM planner_state WHERE user_id=?', (user_id,)
        ).fetchone()
    else:
        row = db.execute(
            'SELECT data FROM planner_state WHERE user_id IS NULL'
        ).fetchone()
    return json.loads(row['data']) if row else None


def set_state(user_id, state):
    db = get_db()
    db.execute(
        'INSERT OR REPLACE INTO planner_state (user_id, data) VALUES (?, ?)',
        (user_id, json.dumps(state)),
    )
    db.commit()
