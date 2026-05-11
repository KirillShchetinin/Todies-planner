import json
from backend.data_access.connections import get_db


_INTERNAL_META_KEYS = {'col', 'id'}


def _clean_meta(meta):
    return {k: v for k, v in (meta or {}).items() if k not in _INTERNAL_META_KEYS}


def get_tasks_by_form(user_id, form_id):
    rows = get_db().execute(
        'SELECT id FROM tasks WHERE user_id=? AND form_id=?',
        (user_id, form_id)
    ).fetchall()
    return [dict(r) for r in rows]


def get_tasks(user_id):
    rows = get_db().execute(
        'SELECT id, form_id, name, done, sort_order, metadata'
        ' FROM tasks WHERE user_id=? ORDER BY form_id, sort_order',
        (user_id,)
    ).fetchall()
    result = []
    for r in rows:
        meta = _clean_meta(json.loads(r['metadata'] or '{}'))
        result.append({
            'id':         r['id'],
            'form_id':    r['form_id'],
            'name':       r['name'],
            'done':       bool(r['done']),
            'sort_order': r['sort_order'],
            'metadata':   meta,
        })
    return result


def create_task(user_id, data):
    db = get_db()
    form_id = data.get('form_id')
    if form_id is None:
        return None, 'form_id required'

    form = db.execute(
        'SELECT id FROM forms WHERE user_id=? AND id=?', (user_id, form_id)
    ).fetchone()
    if not form:
        return None, 'form not found'

    sort_order = data.get('sort_order')
    if sort_order is None:
        row = db.execute(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM tasks'
            ' WHERE user_id=? AND form_id=?',
            (user_id, form_id)
        ).fetchone()
        sort_order = row['next']

    meta = _clean_meta(data.get('metadata') or {})
    cur = db.execute(
        'INSERT INTO tasks (user_id, form_id, client_id, name, done, sort_order, metadata)'
        ' VALUES (?, ?, ?, ?, ?, ?, ?)',
        (user_id, form_id, '', data.get('name', ''),
         1 if data.get('done') else 0, sort_order, json.dumps(meta))
    )
    task_id = cur.lastrowid
    db.execute('UPDATE tasks SET client_id=? WHERE id=?', (str(task_id), task_id))
    db.commit()
    return task_id, None


def update_task(user_id, task_id, data):
    db = get_db()
    row = db.execute(
        'SELECT form_id, metadata FROM tasks WHERE user_id=? AND id=?',
        (user_id, task_id)
    ).fetchone()
    if not row:
        return False

    fields = {}
    if 'form_id' in data:
        new_form_id = data['form_id']
        owns = db.execute(
            'SELECT 1 FROM forms WHERE user_id=? AND id=?', (user_id, new_form_id)
        ).fetchone()
        if not owns:
            return False
        fields['form_id'] = new_form_id
    if 'name' in data:
        fields['name'] = data['name']
    if 'done' in data:
        fields['done'] = 1 if data['done'] else 0
    if 'sort_order' in data:
        fields['sort_order'] = data['sort_order']
    if 'metadata' in data:
        existing = json.loads(row['metadata'] or '{}')
        existing.update(data['metadata'] or {})
        fields['metadata'] = json.dumps(_clean_meta(existing))

    if not fields:
        return True

    set_clause = ', '.join(f'{k}=?' for k in fields)
    params = list(fields.values()) + [user_id, task_id]
    db.execute(f'UPDATE tasks SET {set_clause} WHERE user_id=? AND id=?', params)
    db.commit()
    return True


def delete_task(user_id, task_id):
    db = get_db()
    cur = db.execute(
        'DELETE FROM tasks WHERE user_id=? AND id=?', (user_id, task_id)
    )
    db.commit()
    return cur.rowcount > 0
