import datetime

from backend.date_utils import parse_form_date, week_start


# ── parse_form_date ───────────────────────────────────────────────────────

def test_parse_mm_dd_infers_current_year():
    today = datetime.date(2026, 6, 22)
    assert parse_form_date('01/20', today) == datetime.date(2026, 1, 20)


def test_parse_with_full_year():
    assert parse_form_date('03/15/2024') == datetime.date(2024, 3, 15)


def test_parse_with_two_digit_year():
    assert parse_form_date('03/15/24') == datetime.date(2024, 3, 15)


def test_parse_strips_trailing_plus():
    today = datetime.date(2026, 6, 22)
    assert parse_form_date('07/04+', today) == datetime.date(2026, 7, 4)


def test_parse_invalid_returns_none():
    assert parse_form_date('') is None
    assert parse_form_date(None) is None
    assert parse_form_date('Backlog') is None
    assert parse_form_date('13/40') is None  # impossible date


def test_parse_rejects_surrounding_whitespace():
    # Aligns with the stricter frontend rule: no padding tolerated, so a
    # space-prefixed date is undated on both sides.
    today = datetime.date(2026, 6, 22)
    assert parse_form_date(' 7/4', today) is None
    assert parse_form_date('7/4 ', today) is None


def test_parse_rejects_multiple_trailing_plus():
    today = datetime.date(2026, 6, 22)
    assert parse_form_date('07/04++', today) is None


# ── week_start ────────────────────────────────────────────────────────────

def test_week_start_is_monday():
    # 2026-06-22 is a Monday.
    monday = datetime.date(2026, 6, 22)
    assert week_start(monday) == monday
    sunday = datetime.date(2026, 6, 28)
    assert week_start(sunday) == monday
