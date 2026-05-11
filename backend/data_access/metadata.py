import json
from backend.data_access.connections import get_db


_PERSISTED_KEYS = ('typeCounter', 'typeConfig', 'legendOrder',
                   'uiScale', 'lang', 'collapseState')


def get_user(user_id):
    row = get_db().execute(
        'SELECT id, token, metadata FROM users WHERE id=?', (user_id,)
    ).fetchone()
    if not row:
        return None
    return {'id': row['id'], 'token': row['token'],
            'metadata': json.loads(row['metadata'] or '{}')}


def get_metadata(user_id):
    row = get_db().execute(
        'SELECT metadata FROM users WHERE id=?', (user_id,)
    ).fetchone()
    if not row:
        return None
    meta = json.loads(row['metadata'] or '{}')
    for stale in ('idCounter', 'colCounter'):
        meta.pop(stale, None)
    return meta


def update_metadata(user_id, body):
    db = get_db()
    row = db.execute(
        'SELECT metadata FROM users WHERE id=?', (user_id,)
    ).fetchone()
    if not row:
        return False
    existing = json.loads(row['metadata'] or '{}')
    for k in _PERSISTED_KEYS:
        if k in body:
            existing[k] = body[k]
    db.execute('UPDATE users SET metadata=? WHERE id=?',
               (json.dumps(existing), user_id))
    db.commit()
    return True
