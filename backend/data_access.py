import datetime, json, os, shutil, sqlite3
from flask import g

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH     = os.path.join(BASE_DIR, 'planner.db')
NEW_DB_PATH = os.path.join(BASE_DIR, 'planner_db.db')


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_2():
    conn = sqlite3.connect(NEW_DB_PATH)
    conn.row_factory = sqlite3.Row
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
    row = get_db_2().execute(
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


def get_user(user_id):
    row = get_db_2().execute(
        'SELECT id, token, metadata FROM users WHERE id=?', (user_id,)
    ).fetchone()
    if not row:
        return None
    return {'id': row['id'], 'token': row['token'], 'metadata': json.loads(row['metadata'])}


def get_forms(user_id):
    rows = get_db_2().execute(
        'SELECT id, client_id, label, date, is_unscheduled, sort_order'
        ' FROM forms WHERE user_id=? ORDER BY sort_order',
        (user_id,)
    ).fetchall()
    return [dict(r) for r in rows]


def get_tasks(user_id):
    rows = get_db_2().execute(
        'SELECT id, form_id, client_id, name, done, sort_order, metadata'
        ' FROM tasks WHERE user_id=? ORDER BY form_id, sort_order',
        (user_id,)
    ).fetchall()
    result = []
    for r in rows:
        t = dict(r)
        t['metadata'] = json.loads(t['metadata'])
        result.append(t)
    return result


def get_state_2(user_id):
    user = get_user(user_id)
    if user is None:
        return None

    forms = get_forms(user_id)
    tasks = get_tasks(user_id)

    # index forms by their DB id for task lookup
    form_by_id = {f['id']: f for f in forms}

    # group tasks by their form's client_id
    task_groups = {}
    for f in forms:
        task_groups[f['client_id']] = []
    for t in tasks:
        form = form_by_id.get(t['form_id'])
        if form is None:
            continue
        task_obj = {'id': t['client_id'], 'text': t['name'], 'done': bool(t['done'])}
        task_obj.update(t['metadata'])
        task_groups[form['client_id']].append(task_obj)

    cols = [
        {'id': f['client_id'], 'label': f['label'], 'date': f['date']}
        for f in forms if not f['is_unscheduled']
    ]
    week_unscheduled = [
        {'id': f['client_id'], 'label': f['label']}
        for f in forms if f['is_unscheduled']
    ]

    meta = user['metadata']
    return {
        'cols':            cols,
        'weekUnscheduled': week_unscheduled,
        'state':           task_groups,
        'idCounter':       meta.get('idCounter', 0),
        'colCounter':      meta.get('colCounter', 0),
        'typeCounter':     meta.get('typeCounter', 0),
        'typeConfig':      meta.get('typeConfig', {}),
        'legendOrder':     meta.get('legendOrder', []),
        'uiScale':         meta.get('uiScale', 1),
        'lang':            meta.get('lang', 'en'),
        'collapseState':   meta.get('collapseState', {}),
    }
