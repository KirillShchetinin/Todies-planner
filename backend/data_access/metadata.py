import json
import secrets
from backend.data_access.connections import get_db


_PERSISTED_KEYS = ('typeCounter', 'typeConfig', 'legendOrder',
                   'uiScale', 'lang', 'collapseState')


_DEFAULT_METADATA = {
    'typeCounter': 0,
    'typeConfig': {},
    'legendOrder': [],
    'uiScale': 1,
    'lang': 'en',
    'collapseState': {},
}


def create_user():
    db = get_db()
    token = secrets.token_hex(32)
    db.execute(
        'INSERT INTO users (token, metadata) VALUES (?, ?)',
        (token, json.dumps(_DEFAULT_METADATA))
    )
    db.commit()
    return token


def delete_user(token):
    db = get_db()
    cur = db.execute('DELETE FROM users WHERE token=?', (token,))
    db.commit()
    return cur.rowcount > 0


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
