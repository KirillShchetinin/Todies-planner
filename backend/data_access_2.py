import json
import sqlite3

from backend.data_access import get_db_2


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


def get_state(user_id):
    user = get_user(user_id)
    if user is None:
        return None

    forms = get_forms(user_id)
    tasks = get_tasks(user_id)

    form_by_id = {f['id']: f for f in forms}

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


def save_user_metadata(user_id, state):
    meta = {k: state.get(k, default) for k, default in [
        ('idCounter', 0), ('colCounter', 0), ('typeCounter', 0),
        ('typeConfig', {}), ('legendOrder', []),
        ('uiScale', 1), ('lang', 'en'), ('collapseState', {}),
    ]}
    get_db_2().execute('UPDATE users SET metadata=? WHERE id=?', (json.dumps(meta), user_id))


def save_forms(user_id, cols, week_unscheduled):
    db = get_db_2()
    desired = (
        [{'client_id': c['id'], 'label': c.get('label', ''), 'date': c.get('date', ''), 'is_unscheduled': 0, 'sort_order': i}
         for i, c in enumerate(cols)] +
        [{'client_id': c['id'], 'label': c.get('label', ''), 'date': '', 'is_unscheduled': 1, 'sort_order': i}
         for i, c in enumerate(week_unscheduled)]
    )
    desired_ids = {f['client_id'] for f in desired}

    existing = db.execute('SELECT id, client_id FROM forms WHERE user_id=?', (user_id,)).fetchall()
    existing_map = {row['client_id']: row['id'] for row in existing}

    removed_db_ids = [existing_map[cid] for cid in existing_map if cid not in desired_ids]
    if removed_db_ids:
        db.execute(
            f'DELETE FROM forms WHERE id IN ({",".join("?" * len(removed_db_ids))})',
            removed_db_ids
        )

    for f in desired:
        if f['client_id'] in existing_map:
            db.execute(
                'UPDATE forms SET label=?, date=?, is_unscheduled=?, sort_order=? WHERE user_id=? AND client_id=?',
                (f['label'], f['date'], f['is_unscheduled'], f['sort_order'], user_id, f['client_id'])
            )
        else:
            db.execute(
                'INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order) VALUES (?,?,?,?,?,?)',
                (user_id, f['client_id'], f['label'], f['date'], f['is_unscheduled'], f['sort_order'])
            )

    return {row['client_id']: row['id'] for row in
            db.execute('SELECT id, client_id FROM forms WHERE user_id=?', (user_id,)).fetchall()}


def save_tasks(user_id, task_groups, form_db_id_map):
    db = get_db_2()
    desired = []
    for form_client_id, tasks in task_groups.items():
        form_db_id = form_db_id_map.get(form_client_id)
        if form_db_id is None:
            continue
        for i, task in enumerate(tasks):
            task_meta = {k: v for k, v in task.items() if k not in ('id', 'text', 'done')}
            desired.append({
                'client_id':  task['id'],
                'form_id':    form_db_id,
                'name':       task.get('text', ''),
                'done':       1 if task.get('done') else 0,
                'sort_order': i,
                'metadata':   json.dumps(task_meta),
            })
    desired_ids = {t['client_id'] for t in desired}

    existing = db.execute('SELECT client_id FROM tasks WHERE user_id=?', (user_id,)).fetchall()
    existing_ids = {row['client_id'] for row in existing}

    removed_ids = existing_ids - desired_ids
    if removed_ids:
        db.execute(
            f'DELETE FROM tasks WHERE user_id=? AND client_id IN ({",".join("?" * len(removed_ids))})',
            [user_id, *removed_ids]
        )

    for t in desired:
        if t['client_id'] in existing_ids:
            db.execute(
                'UPDATE tasks SET form_id=?, name=?, done=?, sort_order=?, metadata=? WHERE user_id=? AND client_id=?',
                (t['form_id'], t['name'], t['done'], t['sort_order'], t['metadata'], user_id, t['client_id'])
            )
        else:
            db.execute(
                'INSERT INTO tasks (user_id, form_id, client_id, name, done, sort_order, metadata) VALUES (?,?,?,?,?,?,?)',
                (user_id, t['form_id'], t['client_id'], t['name'], t['done'], t['sort_order'], t['metadata'])
            )


def set_state(user_id, state):
    save_user_metadata(user_id, state)
    form_db_id_map = save_forms(user_id, state.get('cols', []), state.get('weekUnscheduled', []))
    save_tasks(user_id, state.get('state', {}), form_db_id_map)
    get_db_2().commit()


# ---------------------------------------------------------------------------
# v2 granular API
# ---------------------------------------------------------------------------

def create_form(user_id, data):
    try:
        get_db_2().execute(
            'INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order)'
            ' VALUES (?,?,?,?,?,?)',
            (user_id, data['client_id'], data.get('label', ''), data.get('date', ''),
             1 if data.get('is_unscheduled') else 0, data.get('sort_order', 0)),
        )
        get_db_2().commit()
        return True, None
    except sqlite3.IntegrityError:
        return False, 'conflict'


def update_form(user_id, client_id, data):
    cur = get_db_2().execute(
        'UPDATE forms SET label=?, date=?, sort_order=? WHERE user_id=? AND client_id=?',
        (data.get('label', ''), data.get('date', ''), data.get('sort_order', 0),
         user_id, client_id),
    )
    get_db_2().commit()
    return cur.rowcount > 0


def delete_form(user_id, client_id):
    cur = get_db_2().execute(
        'DELETE FROM forms WHERE user_id=? AND client_id=?', (user_id, client_id)
    )
    get_db_2().commit()
    return cur.rowcount > 0


def update_metadata(user_id, metadata):
    cur = get_db_2().execute(
        'UPDATE users SET metadata=? WHERE id=?', (json.dumps(metadata), user_id)
    )
    get_db_2().commit()
    return cur.rowcount > 0
