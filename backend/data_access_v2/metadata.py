import json
from backend.data_access import get_db_2


def get_user(user_id):
    row = get_db_2().execute(
        'SELECT id, token, metadata FROM users WHERE id=?', (user_id,)
    ).fetchone()
    if not row:
        return None
    return {'id': row['id'], 'token': row['token'], 'metadata': json.loads(row['metadata'])}


def save_user_metadata(user_id, state):
    meta = {k: state.get(k, default) for k, default in [
        ('idCounter', 0), ('typeCounter', 0),
        ('typeConfig', {}), ('legendOrder', []),
        ('uiScale', 1), ('lang', 'en'), ('collapseState', {}),
    ]}
    get_db_2().execute('UPDATE users SET metadata=? WHERE id=?', (json.dumps(meta), user_id))


def get_metadata(user_id):
    row = get_db_2().execute(
        'SELECT metadata FROM users WHERE id=?', (user_id,)
    ).fetchone()
    if not row:
        return None
    return json.loads(row['metadata'])


def update_metadata(user_id, metadata):
    cur = get_db_2().execute(
        'UPDATE users SET metadata=? WHERE id=?', (json.dumps(metadata), user_id)
    )
    get_db_2().commit()
    return cur.rowcount > 0
