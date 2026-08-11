import datetime

import pytest


def _days_ago(n):
    return (datetime.date.today() - datetime.timedelta(days=n)).strftime('%m/%d/%Y')


# ── GET /api/v2/forms ─────────────────────────────────────────────────────

def test_get_empty(token, api):
    r = api.get(token, '/api/v2/forms')
    assert r.status_code == 200
    assert r.get_json() == {'cols': [], 'weekUnscheduled': []}


def test_get_splits_scheduled_and_unscheduled(token, api):
    api.form(token, label='Mon', date='01/20', is_unscheduled=False)
    api.form(token, label='Backlog', is_unscheduled=True)

    data = api.forms(token)
    assert len(data['cols']) == 1
    assert data['cols'][0]['label'] == 'Mon'
    assert data['cols'][0]['date'] == '01/20'
    assert len(data['weekUnscheduled']) == 1
    assert data['weekUnscheduled'][0]['label'] == 'Backlog'
    assert 'date' not in data['weekUnscheduled'][0]


# ── GET /api/v2/forms?latest=N ────────────────────────────────────────────

def test_latest_filters_old_forms(token, api):
    api.form(token, label='Recent', date=_days_ago(2))
    api.form(token, label='Old', date=_days_ago(60))

    labels = {c['label'] for c in api.get(token, '/api/v2/forms',
                                          latest='14').get_json()['cols']}
    assert 'Recent' in labels
    assert 'Old' not in labels


def test_latest_includes_unscheduled(token, api):
    api.form(token, label='Backlog', is_unscheduled=True)
    data = api.get(token, '/api/v2/forms', latest='14').get_json()
    assert [u['label'] for u in data['weekUnscheduled']] == ['Backlog']


def test_latest_omitted_returns_all(token, api):
    api.form(token, label='Old', date=_days_ago(120))
    assert any(c['label'] == 'Old' for c in api.forms(token)['cols'])


@pytest.mark.parametrize('latest', [
    'abc',
    '-5',
    '--5',                     # regression: lstrip('-') let it through, int('--5') 500'd
    '99999999999999999999',    # regression: overflowed timedelta in get_recent_forms
])
def test_latest_invalid_returns_400(token, api, latest):
    assert api.get(token, '/api/v2/forms', latest=latest).status_code == 400


# ── GET /api/v2/forms?mark_recent=1 ───────────────────────────────────────

def test_mark_recent_absent_by_default(token, api):
    api.form(token, label='Mon', date='01/20')
    assert 'recent' not in api.forms(token)['cols'][0]


def test_mark_recent_adds_flag(token, api):
    api.form(token, label='Recent', date=_days_ago(2))
    api.form(token, label='Old', date=_days_ago(60))
    api.form(token, label='Undated')

    data = api.get(token, '/api/v2/forms', mark_recent='1').get_json()
    by_label = {c['label']: c for c in data['cols']}
    # Full list is still returned (no filtering); each col carries the flag.
    assert set(by_label) == {'Recent', 'Old', 'Undated'}
    assert by_label['Recent']['recent'] is True
    assert by_label['Old']['recent'] is False
    assert by_label['Undated']['recent'] is False


def test_mark_recent_ignored_with_latest(token, api):
    # Chosen behavior: mark_recent is ignored when latest is supplied.
    api.form(token, label='Recent', date=_days_ago(2))
    data = api.get(token, '/api/v2/forms', latest='14', mark_recent='1').get_json()
    assert data['cols']
    assert 'recent' not in data['cols'][0]


# ── POST /api/v2/forms ────────────────────────────────────────────────────

def test_create_returns_id(token, api):
    r = api.post(token, '/api/v2/forms', label='Tue', date='01/21')
    assert r.status_code == 201
    assert isinstance(r.get_json()['id'], int)


def test_create_appears_in_get(token, api):
    fid = api.form(token, label='Wed', date='01/22')
    assert any(c['id'] == fid for c in api.forms(token)['cols'])


@pytest.mark.parametrize('date', ['13/01', '07/45', '01/2/02/02', '02/29', 'Backlog', 5])
def test_create_rejects_invalid_date(token, api, date):
    assert api.post(token, '/api/v2/forms',
                    label='Bad', date=date).status_code == 400


@pytest.mark.parametrize('date', ['04/01/2025', '06/02', '6/2', '06/02+', '02/29/2028', ''])
def test_create_accepts_valid_date(token, api, date):
    assert api.post(token, '/api/v2/forms',
                    label='Good', date=date).status_code == 201


def test_create_rejects_invalid_date_before_insert(token, api):
    api.post(token, '/api/v2/forms', label='Bad', date='13/01')
    assert api.forms(token)['cols'] == []


# ── DELETE /api/v2/forms/<id> ─────────────────────────────────────────────

def test_delete_empty_form(token, api):
    fid = api.form(token, label='X')
    assert api.delete(token, f'/api/v2/forms/{fid}').status_code == 204
    assert not any(c['id'] == fid for c in api.forms(token)['cols'])


def test_delete_form_with_tasks_returns_409(token, api):
    fid = api.form(token, label='X')
    api.task(token, fid, name='task')
    assert api.delete(token, f'/api/v2/forms/{fid}').status_code == 409


def test_delete_not_found(token, api):
    assert api.delete(token, '/api/v2/forms/9999').status_code == 404


def test_delete_user_isolation(two_tokens, api):
    t1, t2 = two_tokens
    fid = api.form(t1, label='X')
    assert api.delete(t2, f'/api/v2/forms/{fid}').status_code == 404
