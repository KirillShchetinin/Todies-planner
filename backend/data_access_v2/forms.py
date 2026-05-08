from backend.data_access import get_db_2


def get_forms(user_id):
    rows = get_db_2().execute(
        'SELECT id, client_id, label, date, is_unscheduled, sort_order'
        ' FROM forms WHERE user_id=? ORDER BY sort_order',
        (user_id,)
    ).fetchall()
    return [dict(r) for r in rows]


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


def create_form(user_id, data):
    get_db_2().execute(
        'INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order)'
        ' VALUES (?,?,?,?,?,?)',
        (user_id, data['client_id'], data.get('label', ''), data.get('date', ''),
         1 if data.get('is_unscheduled') else 0, data.get('sort_order', 0)),
    )
    get_db_2().commit()


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
