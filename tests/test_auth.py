"""
Tests for `backend.auth.resolve_user_id`.

`resolve_user_id` reads `?token=...` from the request and looks it up in the
normalized DB. We exercise it under a real Flask test request context so it
behaves exactly like in production.
"""
from backend import auth


def test_resolve_user_id_none_when_no_token(app, seed):
    seed.user("real-token")
    with app.test_request_context("/api/state"):
        assert auth.resolve_user_id() is None


def test_resolve_user_id_none_when_empty_token(app, seed):
    seed.user("real-token")
    # Empty string is falsy → branch returns None without hitting the DB.
    with app.test_request_context("/api/state?token="):
        assert auth.resolve_user_id() is None


def test_resolve_user_id_none_for_unknown_token(app, seed):
    seed.user("real-token")
    with app.test_request_context("/api/state?token=mystery"):
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
