SECRET = 'todies-create-secret'


# ── POST /api/account ─────────────────────────────────────────────────────

def test_create_returns_token(client):
    r = client.post('/api/account', headers={'X-Create-Secret': SECRET})
    assert r.status_code == 201
    assert len(r.get_json()['token']) == 64


def test_create_wrong_secret(client):
    assert client.post('/api/account',
                       headers={'X-Create-Secret': 'bad'}).status_code == 403


def test_create_missing_secret(client):
    assert client.post('/api/account').status_code == 403


# ── POST /api/account/token ───────────────────────────────────────────────

def test_rotate_returns_new_token(token, api):
    r = api.post(token, '/api/account/token')
    assert r.status_code == 200
    assert r.get_json()['token'] != token


def test_rotate_invalidates_old_token(token, api):
    new = api.post(token, '/api/account/token').get_json()['token']
    assert api.get(token, '/api/v2/forms').status_code == 401
    assert api.get(new, '/api/v2/forms').status_code == 200


def test_rotate_missing_param(client):
    assert client.post('/api/account/token').status_code == 400


def test_rotate_invalid_token(client):
    assert client.post('/api/account/token',
                       query_string={'token': 'nope'}).status_code == 404


# ── DELETE /api/account ───────────────────────────────────────────────────

def test_delete(token, api):
    assert api.delete(token, '/api/account').status_code == 204
    assert api.get(token, '/api/v2/forms').status_code == 401


def test_delete_wipes_task_content(token, api, db):
    """The forms -> tasks -> task_content cascade must run all the way down."""
    tid = api.task(token, api.form(token), name='x')
    api.put(token, f'/api/v2/tasks/{tid}/content', content='secret body')
    assert db.one('SELECT COUNT(*) FROM task_content')[0] == 1

    api.delete(token, '/api/account')
    assert db.one('SELECT COUNT(*) FROM task_content')[0] == 0


def test_delete_missing_token(client):
    assert client.delete('/api/account').status_code == 400


def test_delete_invalid_token(client):
    assert client.delete('/api/account', query_string={'token': 'x'}).status_code == 404
