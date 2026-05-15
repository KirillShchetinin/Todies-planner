# ── GET /api/v2/metadata ──────────────────────────────────────────────────

def test_get_defaults(client, token):
    r = client.get('/api/v2/metadata', query_string={'token': token})
    assert r.status_code == 200
    data = r.get_json()
    assert data['lang'] == 'en'
    assert data['uiScale'] == 1
    assert data['typeConfig'] == {}
    assert data['legendOrder'] == []
    assert data['collapseState'] == {}


# ── PUT /api/v2/metadata ──────────────────────────────────────────────────

def test_put_persists_changes(client, token):
    qs = {'token': token}
    client.put('/api/v2/metadata', query_string=qs, json={'lang': 'ru', 'uiScale': 0.75})
    data = client.get('/api/v2/metadata', query_string=qs).get_json()
    assert data['lang'] == 'ru'
    assert data['uiScale'] == 0.75


def test_put_ignores_unknown_keys(client, token):
    qs = {'token': token}
    client.put('/api/v2/metadata', query_string=qs, json={'lang': 'ru', 'hack': 'x'})
    assert 'hack' not in client.get('/api/v2/metadata', query_string=qs).get_json()


def test_put_no_body_returns_400(client, token):
    assert client.put('/api/v2/metadata',
                      query_string={'token': token}).status_code == 400
