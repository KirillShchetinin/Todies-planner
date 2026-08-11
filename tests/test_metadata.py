# ── GET /api/v2/metadata ──────────────────────────────────────────────────

def test_get_defaults(token, api):
    r = api.get(token, '/api/v2/metadata')
    assert r.status_code == 200
    data = r.get_json()
    assert data['lang'] == 'en'
    assert data['uiScale'] == 1
    assert data['typeConfig'] == {}
    assert data['legendOrder'] == []
    assert data['collapseState'] == {}


# ── PUT /api/v2/metadata ──────────────────────────────────────────────────

def test_put_persists_changes(token, api):
    api.put(token, '/api/v2/metadata', lang='ru', uiScale=0.75)
    data = api.get(token, '/api/v2/metadata').get_json()
    assert data['lang'] == 'ru'
    assert data['uiScale'] == 0.75


def test_put_scales_are_independent(token, api):
    api.put(token, '/api/v2/metadata', uiScale=1.25, uiScaleMobile=0.75)
    data = api.get(token, '/api/v2/metadata').get_json()
    assert data['uiScale'] == 1.25
    assert data['uiScaleMobile'] == 0.75


def test_put_ignores_unknown_keys(token, api):
    api.put(token, '/api/v2/metadata', lang='ru', hack='x')
    assert 'hack' not in api.get(token, '/api/v2/metadata').get_json()


def test_put_no_body_returns_400(client, token):
    # No JSON at all, which api.put() cannot express.
    assert client.put('/api/v2/metadata',
                      query_string={'token': token}).status_code == 400
