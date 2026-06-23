import datetime
from backend.data_access.connections import get_db
from backend.date_utils import parse_form_date, week_start


def get_forms(user_id):
    rows = get_db().execute(
        'SELECT id, label, date, is_unscheduled, sort_order'
        ' FROM forms WHERE user_id=? ORDER BY sort_order',
        (user_id,)
    ).fetchall()
    return [dict(r) for r in rows]


def get_recent_forms(user_id, latest_days, today=None):
    """Scheduled forms dated on or after a recent lower bound.

    The lower bound is the earlier of:
      - the start of the week before ``today``, and
      - the start of the week containing (latest dated form - ``latest_days``).

    Unscheduled forms are always included. Forms with unparseable dates are
    excluded from the scheduled window (they have no position on the timeline).
    """
    today = today or datetime.date.today()
    forms = get_forms(user_id)

    dated = [(f, parse_form_date(f['date'], today))
             for f in forms if not f['is_unscheduled']]
    dated = [(f, d) for f, d in dated if d is not None]

    prev_week_start = week_start(today) - datetime.timedelta(days=7)
    if dated:
        latest = max(d for _, d in dated)
        latest_based = week_start(latest - datetime.timedelta(days=latest_days))
        lower = min(prev_week_start, latest_based)
    else:
        lower = prev_week_start

    cols = sorted((f for f, d in dated if d >= lower),
                  key=lambda f: f['sort_order'])
    unscheduled = [f for f in forms if f['is_unscheduled']]
    return cols, unscheduled


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
