# ── GET /api/v2/forms ─────────────────────────────────────────────────────

def test_get_empty(client, token):
    r = client.get('/api/v2/forms', query_string={'token': token})
    assert r.status_code == 200
    assert r.get_json() == {'cols': [], 'weekUnscheduled': []}


def test_get_splits_scheduled_and_unscheduled(client, token):
    qs = {'token': token}
    client.post('/api/v2/forms', query_string=qs,
                json={'label': 'Mon', 'date': '01/20', 'is_unscheduled': False})
    client.post('/api/v2/forms', query_string=qs,
                json={'label': 'Backlog', 'is_unscheduled': True})

    data = client.get('/api/v2/forms', query_string=qs).get_json()
    assert len(data['cols']) == 1
    assert data['cols'][0]['label'] == 'Mon'
    assert data['cols'][0]['date'] == '01/20'
    assert len(data['weekUnscheduled']) == 1
    assert data['weekUnscheduled'][0]['label'] == 'Backlog'
    assert 'date' not in data['weekUnscheduled'][0]


# ── POST /api/v2/forms ────────────────────────────────────────────────────

def test_create_returns_id(client, token):
    r = client.post('/api/v2/forms', query_string={'token': token},
                    json={'label': 'Tue', 'date': '01/21'})
    assert r.status_code == 201
    assert isinstance(r.get_json()['id'], int)


def test_create_appears_in_get(client, token):
    qs = {'token': token}
    fid = client.post('/api/v2/forms', query_string=qs,
                      json={'label': 'Wed', 'date': '01/22'}).get_json()['id']
    assert any(c['id'] == fid
               for c in client.get('/api/v2/forms', query_string=qs).get_json()['cols'])


# ── DELETE /api/v2/forms/<id> ─────────────────────────────────────────────

def test_delete_empty_form(client, token):
    qs = {'token': token}
    fid = client.post('/api/v2/forms', query_string=qs,
                      json={'label': 'X'}).get_json()['id']
    assert client.delete(f'/api/v2/forms/{fid}', query_string=qs).status_code == 204
    assert not any(c['id'] == fid
                   for c in client.get('/api/v2/forms', query_string=qs).get_json()['cols'])


def test_delete_form_with_tasks_returns_409(client, token):
    qs = {'token': token}
    fid = client.post('/api/v2/forms', query_string=qs,
                      json={'label': 'X'}).get_json()['id']
    client.post('/api/v2/tasks', query_string=qs, json={'form_id': fid, 'name': 'task'})
    assert client.delete(f'/api/v2/forms/{fid}', query_string=qs).status_code == 409


def test_delete_not_found(client, token):
    assert client.delete('/api/v2/forms/9999',
                         query_string={'token': token}).status_code == 404


def test_delete_user_isolation(client, two_tokens):
    t1, t2 = two_tokens
    fid = client.post('/api/v2/forms', query_string={'token': t1},
                      json={'label': 'X'}).get_json()['id']
    assert client.delete(f'/api/v2/forms/{fid}',
                         query_string={'token': t2}).status_code == 404
