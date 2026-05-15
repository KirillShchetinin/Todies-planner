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

def test_rotate_returns_new_token(client, token):
    r = client.post('/api/account/token', query_string={'token': token})
    assert r.status_code == 200
    assert r.get_json()['token'] != token


def test_rotate_invalidates_old_token(client, token):
    new = client.post('/api/account/token',
                      query_string={'token': token}).get_json()['token']
    assert client.get('/api/v2/forms', query_string={'token': token}).status_code == 401
    assert client.get('/api/v2/forms', query_string={'token': new}).status_code == 200


def test_rotate_missing_param(client):
    assert client.post('/api/account/token').status_code == 400


def test_rotate_invalid_token(client):
    assert client.post('/api/account/token',
                       query_string={'token': 'nope'}).status_code == 404


# ── DELETE /api/account ───────────────────────────────────────────────────

def test_delete(client, token):
    assert client.delete('/api/account', query_string={'token': token}).status_code == 204
    assert client.get('/api/v2/forms', query_string={'token': token}).status_code == 401


def test_delete_missing_token(client):
    assert client.delete('/api/account').status_code == 400


def test_delete_invalid_token(client):
    assert client.delete('/api/account', query_string={'token': 'x'}).status_code == 404
