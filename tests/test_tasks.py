import re

import pytest


# ── GET /api/v2/tasks ─────────────────────────────────────────────────────

def test_get_empty(token, api):
    assert api.get(token, '/api/v2/tasks').get_json() == {'tasks': []}


def test_get_shape(token, api):
    fid = api.form(token)
    api.task(token, fid, name='Buy milk', done=False, metadata={'type': 'async'})

    t = api.tasks(token)[0]
    assert t['form_id'] == fid
    assert t['name'] == 'Buy milk'
    assert t['done'] is False
    assert t['metadata'] == {'type': 'async'}


# ── GET /api/v2/tasks?form_ids= / ?from=&to= ──────────────────────────────

def test_get_by_form_ids(token, api):
    f1 = api.form(token, date='06/15/2026')
    f2 = api.form(token, date='06/16/2026')
    api.task(token, f1, name='One')
    api.task(token, f2, name='Two')

    data = api.get(token, '/api/v2/tasks', form_ids=str(f1)).get_json()
    assert {t['name'] for t in data['tasks']} == {'One'}


def test_get_by_date_range(token, api):
    f_in = api.form(token, date='06/15/2026')
    f_out = api.form(token, date='07/15/2026')
    api.task(token, f_in, name='In')
    api.task(token, f_out, name='Out')

    data = api.get(token, '/api/v2/tasks',
                   **{'from': '2026-06-01', 'to': '2026-06-30'}).get_json()
    assert {t['name'] for t in data['tasks']} == {'In'}


@pytest.mark.parametrize('params', [
    {'form_ids': 'abc'},
    # Regression: lstrip('-') let '--5' pass and int('--5') 500'd.
    {'form_ids': '--5'},
    # Regression: a 20-digit int > 2**63-1 raised sqlite OverflowError (500).
    {'form_ids': '9' * 20},
    {'from': 'nope', 'to': '2026-06-30'},
    {'from': '2026-06-30', 'to': '2026-06-01'},           # from after to
    {'form_ids': '1', 'from': '2026-06-01', 'to': '2026-06-30'},  # both at once
])
def test_bad_range_params_return_400(token, api, params):
    assert api.get(token, '/api/v2/tasks', **params).status_code == 400


def test_get_by_form_ids_negative_single_dash_ok(token, api):
    # A single leading '-' is valid syntax (matches nothing, returns []).
    r = api.get(token, '/api/v2/tasks', form_ids='-5')
    assert r.status_code == 200
    assert r.get_json() == {'tasks': []}


def test_get_by_form_ids_user_isolation(two_tokens, api):
    t1, t2 = two_tokens
    f1 = api.form(t1, date='06/15/2026')
    api.task(t1, f1, name='Secret')
    assert api.get(t2, '/api/v2/tasks', form_ids=str(f1)).get_json()['tasks'] == []


# ── POST /api/v2/tasks ────────────────────────────────────────────────────

def test_create_missing_form_id(token, api):
    assert api.post(token, '/api/v2/tasks', name='x').status_code == 400


def test_create_form_not_found(token, api):
    assert api.post(token, '/api/v2/tasks', form_id=9999).status_code == 404


def test_create_returns_id(token, api):
    r = api.post(token, '/api/v2/tasks', form_id=api.form(token), name='Task')
    assert r.status_code == 201
    assert isinstance(r.get_json()['id'], int)


def test_create_sort_order_auto_increments(token, api):
    fid = api.form(token)
    api.task(token, fid, name='First')
    api.task(token, fid, name='Second')
    orders = [t['sort_order'] for t in api.tasks(token)]
    assert orders == sorted(orders) and orders[0] != orders[1]


# ── PUT /api/v2/tasks/<id> ────────────────────────────────────────────────

def test_update_fields(token, api):
    tid = api.task(token, api.form(token), name='Old')
    assert api.put(token, f'/api/v2/tasks/{tid}',
                   name='New', done=True).status_code == 204
    t = next(t for t in api.tasks(token) if t['id'] == tid)
    assert t['name'] == 'New' and t['done'] is True


def test_update_metadata_merges(token, api):
    tid = api.task(token, api.form(token), metadata={'type': 'rest', 'locked': True})
    api.put(token, f'/api/v2/tasks/{tid}', metadata={'locked': False})
    t = next(t for t in api.tasks(token) if t['id'] == tid)
    assert t['metadata']['type'] == 'rest'
    assert t['metadata']['locked'] is False


def test_update_strips_internal_meta_keys(token, api):
    tid = api.task(token, api.form(token))
    api.put(token, f'/api/v2/tasks/{tid}',
            metadata={'col': 'x', 'id': 99, 'type': 'async'})
    t = next(t for t in api.tasks(token) if t['id'] == tid)
    assert 'col' not in t['metadata'] and 'id' not in t['metadata']
    assert t['metadata']['type'] == 'async'


def test_update_not_found(token, api):
    assert api.put(token, '/api/v2/tasks/9999', name='x').status_code == 404


def test_update_user_isolation(two_tokens, api):
    t1, t2 = two_tokens
    tid = api.task(t1, api.form(t1), name='Secret')
    assert api.put(t2, f'/api/v2/tasks/{tid}', name='Hacked').status_code == 404


# ── DELETE /api/v2/tasks/<id> ─────────────────────────────────────────────

def test_delete(token, api):
    tid = api.task(token, api.form(token), name='Gone')
    assert api.delete(token, f'/api/v2/tasks/{tid}').status_code == 204
    assert not any(t['id'] == tid for t in api.tasks(token))


def test_delete_not_found(token, api):
    assert api.delete(token, '/api/v2/tasks/9999').status_code == 404


def test_delete_user_isolation(two_tokens, api):
    t1, t2 = two_tokens
    tid = api.task(t1, api.form(t1), name='x')
    assert api.delete(t2, f'/api/v2/tasks/{tid}').status_code == 404


# ── cascade ───────────────────────────────────────────────────────────────

def test_delete_tasks_then_form_succeeds(token, api):
    fid = api.form(token)
    tid = api.task(token, fid, name='x')
    api.delete(token, f'/api/v2/tasks/{tid}')
    assert api.delete(token, f'/api/v2/forms/{fid}').status_code == 204


# ── timestamps ────────────────────────────────────────────────────────────

STAMP = r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\+00:00$'


def _stamp(db, tid, value='OLD'):
    """Force updated_at to a sentinel; minute precision makes clock diffs useless."""
    db.exec('UPDATE tasks SET updated_at=? WHERE id=?', value, tid)


def _updated_at(db, tid):
    return db.one('SELECT updated_at FROM tasks WHERE id=?', tid)[0]


def test_create_sets_created_and_updated(token, api, db):
    tid = api.task(token, api.form(token), name='x')
    created, updated = db.one('SELECT created_at, updated_at FROM tasks WHERE id=?', tid)
    assert created == updated
    assert re.match(STAMP, created)


def test_update_bumps_updated_at_except_pure_reorder(token, api, db):
    tid = api.task(token, api.form(token), name='x')
    other = api.form(token, label='Tue')

    # A reorder alone must not touch it.
    _stamp(db, tid)
    api.put(token, f'/api/v2/tasks/{tid}', sort_order=3)
    assert _updated_at(db, tid) == 'OLD'

    # A real edit must.
    api.put(token, f'/api/v2/tasks/{tid}', name='y')
    assert re.match(STAMP, _updated_at(db, tid))

    # Moving to another day is a change, not a reorder, even alongside sort_order.
    _stamp(db, tid)
    api.put(token, f'/api/v2/tasks/{tid}', form_id=other, sort_order=0)
    assert _updated_at(db, tid) != 'OLD'


# ── content ───────────────────────────────────────────────────────────

def _content(db, tid):
    row = db.one('SELECT content FROM task_content WHERE task_id=?', tid)
    return row[0] if row else None


def test_content_set_then_overwritten(token, api, db):
    tid = api.task(token, api.form(token), name='x')
    assert _content(db, tid) is None          # nothing written at creation

    r = api.put(token, f'/api/v2/tasks/{tid}/content', content='first')
    assert r.status_code == 204
    assert _content(db, tid) == 'first'

    api.put(token, f'/api/v2/tasks/{tid}/content', content='second')
    assert _content(db, tid) == 'second'      # upsert, not a duplicate row


def test_content_rejects_bad_input_and_other_users(two_tokens, api, db):
    t1, t2 = two_tokens
    tid = api.task(t1, api.form(t1), name='x')
    assert api.put(t1, f'/api/v2/tasks/{tid}/content').status_code == 400
    assert api.put(t2, f'/api/v2/tasks/{tid}/content',
                   content='nope').status_code == 404
    assert _content(db, tid) is None


def test_content_cascades_on_task_delete(token, api, db):
    tid = api.task(token, api.form(token), name='x')
    api.put(token, f'/api/v2/tasks/{tid}/content', content='x')
    api.delete(token, f'/api/v2/tasks/{tid}')
    assert _content(db, tid) is None


def test_content_get_roundtrip(token, api):
    tid = api.task(token, api.form(token), name='x')
    url = f'/api/v2/tasks/{tid}/content'

    # Never set.
    assert api.get(token, url).get_json() == {'content': ''}

    api.put(token, url, content='notes')
    assert api.get(token, url).get_json() == {'content': 'notes'}

    # Unknown task id reads as empty rather than 404.
    assert api.get(token, '/api/v2/tasks/999999/content').get_json() == {'content': ''}
