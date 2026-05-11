from backend.data_access.connections import get_db


def get_forms(user_id):
    rows = get_db().execute(
        'SELECT id, label, date, is_unscheduled, sort_order'
        ' FROM forms WHERE user_id=? ORDER BY sort_order',
        (user_id,)
    ).fetchall()
    return [dict(r) for r in rows]


def create_form(user_id, data):
    db = get_db()
    cur = db.execute(
        'INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order)'
        ' VALUES (?,?,?,?,?,?)',
        (user_id, '', data.get('label', ''), data.get('date', ''),
         1 if data.get('is_unscheduled') else 0, data.get('sort_order', 0)),
    )
    db_id = cur.lastrowid
    db.execute('UPDATE forms SET client_id=? WHERE id=?', (str(db_id), db_id))
    db.commit()
    return db_id


def delete_form(user_id, form_id):
    db = get_db()
    cur = db.execute(
        'DELETE FROM forms WHERE user_id=? AND id=?', (user_id, form_id)
    )
    db.commit()
    return cur.rowcount > 0
