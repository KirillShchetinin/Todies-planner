import json

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
        if not f['is_unscheduled']:
            task_groups[f['client_id']] = []
    for t in tasks:
        form = form_by_id.get(t['form_id'])
        if form is None or form['client_id'] not in task_groups:
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
