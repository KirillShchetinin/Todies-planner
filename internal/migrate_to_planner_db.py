import sqlite3, json

# ── Step 1: read source ────────────────────────────────────────────────────
src = sqlite3.connect('planner.db')
src.row_factory = sqlite3.Row
row = src.execute(
    'SELECT u.id, u.token, ps.data FROM users u '
    'LEFT JOIN planner_state ps ON u.id = ps.user_id'
).fetchone()
token   = row['token']
parsed  = json.loads(row['data'])
src.close()

# ── Step 2: create planner_db.db schema ───────────────────────────────────
dst = sqlite3.connect('planner_db.db')
dst.execute('PRAGMA foreign_keys = ON')
dst.executescript('''
CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    token    TEXT    NOT NULL UNIQUE,
    metadata TEXT    NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS forms (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    client_id      TEXT    NOT NULL,
    label          TEXT    NOT NULL DEFAULT '',
    date           TEXT    NOT NULL DEFAULT '',
    is_unscheduled INTEGER NOT NULL DEFAULT 0,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, client_id)
);
CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    form_id    INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    client_id  TEXT    NOT NULL,
    name       TEXT    NOT NULL DEFAULT '',
    done       INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata   TEXT    NOT NULL DEFAULT '{}',
    UNIQUE(user_id, client_id)
);
''')

# ── Step 3: insert user with metadata ─────────────────────────────────────
meta = {k: parsed[k] for k in ('idCounter','colCounter','typeCounter',
                                'typeConfig','legendOrder','uiScale',
                                'lang','collapseState')}
dst.execute(
    'INSERT INTO users (token, metadata) VALUES (?, ?)',
    (token, json.dumps(meta))
)
user_id = dst.execute('SELECT last_insert_rowid()').fetchone()[0]
print(f'Inserted user id={user_id}')

# ── Step 4: insert forms (day cols) ───────────────────────────────────────
for i, col in enumerate(parsed['cols']):
    dst.execute(
        'INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order) '
        'VALUES (?, ?, ?, ?, 0, ?)',
        (user_id, col['id'], col['label'], col.get('date',''), i)
    )
print(f'Inserted {len(parsed["cols"])} day forms')

# ── Step 5: insert forms (unscheduled boxes) ──────────────────────────────
offset = len(parsed['cols'])
for i, col in enumerate(parsed['weekUnscheduled']):
    dst.execute(
        'INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order) '
        'VALUES (?, ?, ?, \'\', 1, ?)',
        (user_id, col['id'], col['label'], offset + i)
    )
print(f'Inserted {len(parsed["weekUnscheduled"])} unscheduled forms')

# ── Step 6: insert tasks ──────────────────────────────────────────────────
task_count = 0
for col_id, tasks in parsed['state'].items():
    form_row = dst.execute(
        'SELECT id FROM forms WHERE user_id=? AND client_id=?',
        (user_id, col_id)
    ).fetchone()
    if form_row is None:
        print(f'  WARNING: no form found for col_id={col_id}, skipping {len(tasks)} tasks')
        continue
    form_id = form_row[0]
    for order, task in enumerate(tasks):
        task_meta = {k: v for k, v in task.items()
                     if k not in ('id', 'text', 'done', 'col')}
        done = 1 if task.get('done') else 0
        dst.execute(
            'INSERT INTO tasks (user_id, form_id, client_id, name, done, sort_order, metadata) '
            'VALUES (?, ?, ?, ?, ?, ?, ?)',
            (user_id, form_id, task['id'], task['text'], done, order, json.dumps(task_meta))
        )
        task_count += 1
print(f'Inserted {task_count} tasks')

dst.commit()
dst.close()
print('Done.')
