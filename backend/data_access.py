import os, sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH  = os.path.join(BASE_DIR, 'planner.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
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
    conn.close()


def resolve_user_id(conn, token):
    """Return user_id for token, or None if token is absent/invalid."""
    if not token:
        return None
    row = conn.execute('SELECT id FROM users WHERE token=?', (token,)).fetchone()
    return row['id'] if row else None


def get_state(token):
    conn    = get_db()
    user_id = resolve_user_id(conn, token)
    if user_id is not None:
        row = conn.execute(
            'SELECT data FROM planner_state WHERE user_id=?', (user_id,)
        ).fetchone()
    else:
        row = conn.execute(
            'SELECT data FROM planner_state WHERE user_id IS NULL'
        ).fetchone()
    conn.close()
    return row['data'] if row else None


def set_state(token, data):
    conn    = get_db()
    user_id = resolve_user_id(conn, token)
    conn.execute(
        'INSERT OR REPLACE INTO planner_state (user_id, data) VALUES (?, ?)',
        (user_id, data),
    )
    conn.commit()
    conn.close()
