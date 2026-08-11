import re


# ── GET /api/v2/tasks ─────────────────────────────────────────────────────

def test_get_empty(client, token):
    assert client.get('/api/v2/tasks',
                      query_string={'token': token}).get_json() == {'tasks': []}


def test_get_shape(token, api):
    fid = api.form(token)
    api.task(token, fid, name='Buy milk', done=False, metadata={'type': 'async'})

    t = api.tasks(token)[0]
    assert t['form_id'] == fid
    assert t['name'] == 'Buy milk'
    assert t['done'] is False
    assert t['metadata'] == {'type': 'async'}


# ── GET /api/v2/tasks?form_ids= / ?from=&to= ──────────────────────────────

def test_get_by_form_ids(client, token, api):
    qs = {'token': token}
    f1 = api.form(token, date='06/15/2026')
    f2 = api.form(token, date='06/16/2026')
    api.task(token, f1, name='One')
    api.task(token, f2, name='Two')

    data = client.get('/api/v2/tasks',
                      query_string={**qs, 'form_ids': str(f1)}).get_json()
    assert {t['name'] for t in data['tasks']} == {'One'}


def test_get_by_form_ids_invalid(client, token):
    r = client.get('/api/v2/tasks',
                   query_string={'token': token, 'form_ids': 'abc'})
    assert r.status_code == 400


def test_get_by_date_range(client, token, api):
    qs = {'token': token}
    f_in = api.form(token, date='06/15/2026')
    f_out = api.form(token, date='07/15/2026')
    api.task(token, f_in, name='In')
    api.task(token, f_out, name='Out')

    data = client.get('/api/v2/tasks', query_string={
        **qs, 'from': '2026-06-01', 'to': '2026-06-30'}).get_json()
    assert {t['name'] for t in data['tasks']} == {'In'}


def test_get_by_date_range_invalid_date(client, token):
    r = client.get('/api/v2/tasks', query_string={
        'token': token, 'from': 'nope', 'to': '2026-06-30'})
    assert r.status_code == 400


def test_get_by_date_range_from_after_to(client, token):
    r = client.get('/api/v2/tasks', query_string={
        'token': token, 'from': '2026-06-30', 'to': '2026-06-01'})
    assert r.status_code == 400


def test_get_by_form_ids_double_dash_returns_400(client, token):
    # Regression: lstrip('-') let '--5' pass and int('--5') 500'd.
    r = client.get('/api/v2/tasks',
                   query_string={'token': token, 'form_ids': '--5'})
    assert r.status_code == 400


def test_get_by_form_ids_overflow_returns_400(client, token):
    # Regression: a 20-digit int > 2**63-1 raised sqlite OverflowError (500).
    r = client.get('/api/v2/tasks',
                   query_string={'token': token, 'form_ids': '9' * 20})
    assert r.status_code == 400


def test_get_by_form_ids_negative_single_dash_ok(client, token):
    # A single leading '-' is valid syntax (matches nothing, returns []).
    r = client.get('/api/v2/tasks',
                   query_string={'token': token, 'form_ids': '-5'})
    assert r.status_code == 200
    assert r.get_json() == {'tasks': []}


def test_form_ids_and_range_together_returns_400(client, token):
    r = client.get('/api/v2/tasks', query_string={
        'token': token, 'form_ids': '1', 'from': '2026-06-01', 'to': '2026-06-30'})
    assert r.status_code == 400


def test_get_by_form_ids_user_isolation(client, two_tokens, api):
    t1, t2 = two_tokens
    f1 = api.form(t1, date='06/15/2026')
    api.task(t1, f1, name='Secret')
    data = client.get('/api/v2/tasks',
                      query_string={'token': t2, 'form_ids': str(f1)}).get_json()
    assert data['tasks'] == []


# ── POST /api/v2/tasks ────────────────────────────────────────────────────

def test_create_missing_form_id(client, token):
    assert client.post('/api/v2/tasks', query_string={'token': token},
                       json={'name': 'x'}).status_code == 400


def test_create_form_not_found(client, token):
    assert client.post('/api/v2/tasks', query_string={'token': token},
                       json={'form_id': 9999}).status_code == 404


def test_create_returns_id(client, token, api):
    r = client.post('/api/v2/tasks', query_string={'token': token},
                    json={'form_id': api.form(token), 'name': 'Task'})
    assert r.status_code == 201
    assert isinstance(r.get_json()['id'], int)


def test_create_sort_order_auto_increments(token, api):
    fid = api.form(token)
    api.task(token, fid, name='First')
    api.task(token, fid, name='Second')
    orders = [t['sort_order'] for t in api.tasks(token)]
    assert orders == sorted(orders) and orders[0] != orders[1]


# ── PUT /api/v2/tasks/<id> ────────────────────────────────────────────────

def test_update_fields(client, token, api):
    fid = api.form(token)
    tid = api.task(token, fid, name='Old')
    assert client.put(f'/api/v2/tasks/{tid}', query_string={'token': token},
                      json={'name': 'New', 'done': True}).status_code == 204
    t = next(t for t in api.tasks(token) if t['id'] == tid)
    assert t['name'] == 'New' and t['done'] is True


def test_update_metadata_merges(client, token, api):
    fid = api.form(token)
    tid = api.task(token, fid, metadata={'type': 'rest', 'locked': True})
    client.put(f'/api/v2/tasks/{tid}', query_string={'token': token},
               json={'metadata': {'locked': False}})
    t = next(t for t in api.tasks(token) if t['id'] == tid)
    assert t['metadata']['type'] == 'rest'
    assert t['metadata']['locked'] is False


def test_update_strips_internal_meta_keys(client, token, api):
    fid = api.form(token)
    tid = api.task(token, fid)
    client.put(f'/api/v2/tasks/{tid}', query_string={'token': token},
               json={'metadata': {'col': 'x', 'id': 99, 'type': 'async'}})
    t = next(t for t in api.tasks(token) if t['id'] == tid)
    assert 'col' not in t['metadata'] and 'id' not in t['metadata']
    assert t['metadata']['type'] == 'async'


def test_update_not_found(client, token):
    assert client.put('/api/v2/tasks/9999', query_string={'token': token},
                      json={'name': 'x'}).status_code == 404


def test_update_user_isolation(client, two_tokens, api):
    t1, t2 = two_tokens
    fid = api.form(t1)
    tid = api.task(t1, fid, name='Secret')
    assert client.put(f'/api/v2/tasks/{tid}', query_string={'token': t2},
                      json={'name': 'Hacked'}).status_code == 404


# ── DELETE /api/v2/tasks/<id> ─────────────────────────────────────────────

def test_delete(client, token, api):
    fid = api.form(token)
    tid = api.task(token, fid, name='Gone')
    assert client.delete(f'/api/v2/tasks/{tid}',
                         query_string={'token': token}).status_code == 204
    assert not any(t['id'] == tid for t in api.tasks(token))


def test_delete_not_found(client, token):
    assert client.delete('/api/v2/tasks/9999',
                         query_string={'token': token}).status_code == 404


def test_delete_user_isolation(client, two_tokens, api):
    t1, t2 = two_tokens
    fid = api.form(t1)
    tid = api.task(t1, fid, name='x')
    assert client.delete(f'/api/v2/tasks/{tid}',
                         query_string={'token': t2}).status_code == 404


# ── cascade ───────────────────────────────────────────────────────────────

def test_delete_tasks_then_form_succeeds(client, token, api):
    qs = {'token': token}
    fid = api.form(token)
    tid = api.task(token, fid, name='x')
    client.delete(f'/api/v2/tasks/{tid}', query_string=qs)
    assert client.delete(f'/api/v2/forms/{fid}', query_string=qs).status_code == 204


# ── timestamps ────────────────────────────────────────────────────────────

def _stamp(db, tid, value='OLD'):
    """Force updated_at to a sentinel; minute precision makes clock diffs useless."""
    db.exec('UPDATE tasks SET updated_at=? WHERE id=?', value, tid)


def _updated_at(db, tid):
    return db.one('SELECT updated_at FROM tasks WHERE id=?', tid)[0]


def test_create_sets_created_and_updated(token, db, api):
    fid = api.form(token)
    tid = api.task(token, fid, name='x')
    created, updated = db.one('SELECT created_at, updated_at FROM tasks WHERE id=?', tid)
    assert created == updated
    assert re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\+00:00$', created)


def test_update_bumps_updated_at_except_pure_reorder(client, token, db, api):
    qs = {'token': token}
    fid = api.form(token)
    other = api.form(token, label='Tue')
    tid = api.task(token, fid, name='x')

    # A reorder alone must not touch it.
    _stamp(db, tid)
    client.put(f'/api/v2/tasks/{tid}', query_string=qs, json={'sort_order': 3})
    assert _updated_at(db, tid) == 'OLD'

    # A real edit must.
    client.put(f'/api/v2/tasks/{tid}', query_string=qs, json={'name': 'y'})
    assert re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\+00:00$', _updated_at(db, tid))

    # Moving to another day is a change, not a reorder, even alongside sort_order.
    _stamp(db, tid)
    client.put(f'/api/v2/tasks/{tid}', query_string=qs,
               json={'form_id': other, 'sort_order': 0})
    assert _updated_at(db, tid) != 'OLD'


# ── content ───────────────────────────────────────────────────────────

def _content(db, tid):
    row = db.one('SELECT content FROM task_content WHERE task_id=?', tid)
    return row[0] if row else None


def test_content_set_then_overwritten(client, token, db, api):
    qs = {'token': token}
    tid = api.task(token, api.form(token), name='x')
    assert _content(db, tid) is None          # nothing written at creation

    r = client.put(f'/api/v2/tasks/{tid}/content', query_string=qs,
                   json={'content': 'first'})
    assert r.status_code == 204
    assert _content(db, tid) == 'first'

    client.put(f'/api/v2/tasks/{tid}/content', query_string=qs,
               json={'content': 'second'})
    assert _content(db, tid) == 'second'      # upsert, not a duplicate row


def test_content_rejects_bad_input_and_other_users(client, two_tokens, db, api):
    t1, t2 = two_tokens
    tid = api.task(t1, api.form(t1), name='x')
    assert client.put(f'/api/v2/tasks/{tid}/content',
                      query_string={'token': t1}, json={}).status_code == 400
    assert client.put(f'/api/v2/tasks/{tid}/content', query_string={'token': t2},
                      json={'content': 'nope'}).status_code == 404
    assert _content(db, tid) is None


def test_content_cascades_on_task_delete(client, token, db, api):
    qs = {'token': token}
    tid = api.task(token, api.form(token), name='x')
    client.put(f'/api/v2/tasks/{tid}/content', query_string=qs, json={'content': 'x'})
    client.delete(f'/api/v2/tasks/{tid}', query_string=qs)
    assert _content(db, tid) is None


def test_content_get_roundtrip(client, token, api):
    tid = api.task(token, api.form(token), name='x')
    url = f'/api/v2/tasks/{tid}/content'
    qs = {'token': token}

    r = client.get(url, query_string=qs)
    assert r.status_code == 200 and r.get_json() == {'content': ''}   # never set

    client.put(url, query_string=qs, json={'content': 'notes'})
    assert client.get(url, query_string=qs).get_json() == {'content': 'notes'}

    # Unknown task id reads as empty rather than 404.
    assert client.get('/api/v2/tasks/999999/content',
                      query_string=qs).get_json() == {'content': ''}
