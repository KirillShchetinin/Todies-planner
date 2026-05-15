def _form(client, token):
    return client.post('/api/v2/forms', query_string={'token': token},
                       json={'label': 'Mon'}).get_json()['id']


def _task(client, token, fid, **kw):
    return client.post('/api/v2/tasks', query_string={'token': token},
                       json={'form_id': fid, **kw}).get_json()['id']


def _tasks(client, token):
    return client.get('/api/v2/tasks', query_string={'token': token}).get_json()['tasks']


# ── GET /api/v2/tasks ─────────────────────────────────────────────────────

def test_get_empty(client, token):
    assert client.get('/api/v2/tasks',
                      query_string={'token': token}).get_json() == {'tasks': []}


def test_get_shape(client, token):
    fid = _form(client, token)
    _task(client, token, fid, name='Buy milk', done=False, metadata={'type': 'async'})

    t = _tasks(client, token)[0]
    assert t['form_id'] == fid
    assert t['name'] == 'Buy milk'
    assert t['done'] is False
    assert t['metadata'] == {'type': 'async'}


# ── POST /api/v2/tasks ────────────────────────────────────────────────────

def test_create_missing_form_id(client, token):
    assert client.post('/api/v2/tasks', query_string={'token': token},
                       json={'name': 'x'}).status_code == 400


def test_create_form_not_found(client, token):
    assert client.post('/api/v2/tasks', query_string={'token': token},
                       json={'form_id': 9999}).status_code == 404


def test_create_returns_id(client, token):
    r = client.post('/api/v2/tasks', query_string={'token': token},
                    json={'form_id': _form(client, token), 'name': 'Task'})
    assert r.status_code == 201
    assert isinstance(r.get_json()['id'], int)


def test_create_sort_order_auto_increments(client, token):
    fid = _form(client, token)
    _task(client, token, fid, name='First')
    _task(client, token, fid, name='Second')
    orders = [t['sort_order'] for t in _tasks(client, token)]
    assert orders == sorted(orders) and orders[0] != orders[1]


# ── PUT /api/v2/tasks/<id> ────────────────────────────────────────────────

def test_update_fields(client, token):
    fid = _form(client, token)
    tid = _task(client, token, fid, name='Old')
    assert client.put(f'/api/v2/tasks/{tid}', query_string={'token': token},
                      json={'name': 'New', 'done': True}).status_code == 204
    t = next(t for t in _tasks(client, token) if t['id'] == tid)
    assert t['name'] == 'New' and t['done'] is True


def test_update_metadata_merges(client, token):
    fid = _form(client, token)
    tid = _task(client, token, fid, metadata={'type': 'rest', 'locked': True})
    client.put(f'/api/v2/tasks/{tid}', query_string={'token': token},
               json={'metadata': {'locked': False}})
    t = next(t for t in _tasks(client, token) if t['id'] == tid)
    assert t['metadata']['type'] == 'rest'
    assert t['metadata']['locked'] is False


def test_update_strips_internal_meta_keys(client, token):
    fid = _form(client, token)
    tid = _task(client, token, fid)
    client.put(f'/api/v2/tasks/{tid}', query_string={'token': token},
               json={'metadata': {'col': 'x', 'id': 99, 'type': 'async'}})
    t = next(t for t in _tasks(client, token) if t['id'] == tid)
    assert 'col' not in t['metadata'] and 'id' not in t['metadata']
    assert t['metadata']['type'] == 'async'


def test_update_not_found(client, token):
    assert client.put('/api/v2/tasks/9999', query_string={'token': token},
                      json={'name': 'x'}).status_code == 404


def test_update_user_isolation(client, two_tokens):
    t1, t2 = two_tokens
    fid = _form(client, t1)
    tid = _task(client, t1, fid, name='Secret')
    assert client.put(f'/api/v2/tasks/{tid}', query_string={'token': t2},
                      json={'name': 'Hacked'}).status_code == 404


# ── DELETE /api/v2/tasks/<id> ─────────────────────────────────────────────

def test_delete(client, token):
    fid = _form(client, token)
    tid = _task(client, token, fid, name='Gone')
    assert client.delete(f'/api/v2/tasks/{tid}',
                         query_string={'token': token}).status_code == 204
    assert not any(t['id'] == tid for t in _tasks(client, token))


def test_delete_not_found(client, token):
    assert client.delete('/api/v2/tasks/9999',
                         query_string={'token': token}).status_code == 404


def test_delete_user_isolation(client, two_tokens):
    t1, t2 = two_tokens
    fid = _form(client, t1)
    tid = _task(client, t1, fid, name='x')
    assert client.delete(f'/api/v2/tasks/{tid}',
                         query_string={'token': t2}).status_code == 404


# ── cascade ───────────────────────────────────────────────────────────────

def test_delete_tasks_then_form_succeeds(client, token):
    qs = {'token': token}
    fid = _form(client, token)
    tid = _task(client, token, fid, name='x')
    client.delete(f'/api/v2/tasks/{tid}', query_string=qs)
    assert client.delete(f'/api/v2/forms/{fid}', query_string=qs).status_code == 204
