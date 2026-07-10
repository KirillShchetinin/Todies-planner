import datetime


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


# ── GET /api/v2/forms?latest=N ────────────────────────────────────────────

def test_latest_filters_old_forms(client, token):
    qs = {'token': token}
    today = datetime.date.today()
    recent = today - datetime.timedelta(days=2)
    old = today - datetime.timedelta(days=60)
    client.post('/api/v2/forms', query_string=qs,
                json={'label': 'Recent', 'date': recent.strftime('%m/%d/%Y')})
    client.post('/api/v2/forms', query_string=qs,
                json={'label': 'Old', 'date': old.strftime('%m/%d/%Y')})

    data = client.get('/api/v2/forms', query_string={**qs, 'latest': '14'}).get_json()
    labels = {c['label'] for c in data['cols']}
    assert 'Recent' in labels
    assert 'Old' not in labels


def test_latest_includes_unscheduled(client, token):
    qs = {'token': token}
    client.post('/api/v2/forms', query_string=qs,
                json={'label': 'Backlog', 'is_unscheduled': True})
    data = client.get('/api/v2/forms', query_string={**qs, 'latest': '14'}).get_json()
    assert [u['label'] for u in data['weekUnscheduled']] == ['Backlog']


def test_latest_omitted_returns_all(client, token):
    qs = {'token': token}
    old = (datetime.date.today() - datetime.timedelta(days=120)).strftime('%m/%d/%Y')
    client.post('/api/v2/forms', query_string=qs, json={'label': 'Old', 'date': old})
    data = client.get('/api/v2/forms', query_string=qs).get_json()
    assert any(c['label'] == 'Old' for c in data['cols'])


def test_latest_invalid_returns_400(client, token):
    qs = {'token': token}
    assert client.get('/api/v2/forms',
                      query_string={**qs, 'latest': 'abc'}).status_code == 400
    assert client.get('/api/v2/forms',
                      query_string={**qs, 'latest': '-5'}).status_code == 400


def test_latest_double_dash_returns_400(client, token):
    # Regression: lstrip('-') let '--5' pass and int('--5') 500'd.
    assert client.get('/api/v2/forms',
                      query_string={'token': token, 'latest': '--5'}).status_code == 400


def test_latest_overflow_returns_400(client, token):
    # Regression: a huge latest overflowed timedelta in get_recent_forms → 500.
    assert client.get('/api/v2/forms',
                      query_string={'token': token,
                                    'latest': '99999999999999999999'}).status_code == 400


# ── GET /api/v2/forms?mark_recent=1 ───────────────────────────────────────

def test_mark_recent_absent_by_default(client, token):
    qs = {'token': token}
    client.post('/api/v2/forms', query_string=qs,
                json={'label': 'Mon', 'date': '01/20'})
    data = client.get('/api/v2/forms', query_string=qs).get_json()
    assert 'recent' not in data['cols'][0]


def test_mark_recent_adds_flag(client, token):
    qs = {'token': token}
    today = datetime.date.today()
    recent = today - datetime.timedelta(days=2)
    old = today - datetime.timedelta(days=60)
    client.post('/api/v2/forms', query_string=qs,
                json={'label': 'Recent', 'date': recent.strftime('%m/%d/%Y')})
    client.post('/api/v2/forms', query_string=qs,
                json={'label': 'Old', 'date': old.strftime('%m/%d/%Y')})
    client.post('/api/v2/forms', query_string=qs,
                json={'label': 'Undated'})

    data = client.get('/api/v2/forms',
                      query_string={**qs, 'mark_recent': '1'}).get_json()
    by_label = {c['label']: c for c in data['cols']}
    # Full list is still returned (no filtering); each col carries the flag.
    assert set(by_label) == {'Recent', 'Old', 'Undated'}
    assert by_label['Recent']['recent'] is True
    assert by_label['Old']['recent'] is False
    assert by_label['Undated']['recent'] is False


def test_mark_recent_ignored_with_latest(client, token):
    # Chosen behavior: mark_recent is ignored when latest is supplied.
    qs = {'token': token}
    recent = (datetime.date.today() - datetime.timedelta(days=2)).strftime('%m/%d/%Y')
    client.post('/api/v2/forms', query_string=qs,
                json={'label': 'Recent', 'date': recent})
    data = client.get('/api/v2/forms',
                      query_string={**qs, 'latest': '14', 'mark_recent': '1'}).get_json()
    assert data['cols']
    assert 'recent' not in data['cols'][0]


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
