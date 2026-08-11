"""
Tests for `backend.auth.resolve_user_id`.

`resolve_user_id` reads `?token=...` from the request and looks it up in the
normalized DB. We exercise it under a real Flask test request context so it
behaves exactly like in production.
"""
import pytest

from backend import auth


# ── HTTP auth guard ───────────────────────────────────────────────────────

def test_no_token_returns_401(client):
    assert client.get('/api/v2/forms').status_code == 401


def test_invalid_token_returns_401(client):
    assert client.get('/api/v2/forms', query_string={'token': 'bad'}).status_code == 401


# ── resolve_user_id unit tests ────────────────────────────────────────────

@pytest.mark.parametrize('query', [
    '',                 # no token param at all
    '?token=',          # empty string is falsy → returns None without hitting the DB
    '?token=mystery',   # a token no user owns
])
def test_resolve_user_id_none(app, seed, query):
    seed.user("real-token")
    with app.test_request_context("/api/state" + query):
        assert auth.resolve_user_id() is None


def test_resolve_user_id_returns_user_id_for_valid_token(app, seed):
    uid = seed.user("real-token")
    with app.test_request_context("/api/state?token=real-token"):
        assert auth.resolve_user_id() == uid


def test_resolve_user_id_distinguishes_users(app, seed):
    a = seed.user("tok-a")
    b = seed.user("tok-b")
    with app.test_request_context("/api/state?token=tok-a"):
        assert auth.resolve_user_id() == a
    with app.test_request_context("/api/state?token=tok-b"):
        assert auth.resolve_user_id() == b
