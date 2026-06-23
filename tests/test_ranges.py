"""Data-access tests for the recent-forms window and task range queries.

These call the data_access layer directly (rather than HTTP) so a fixed
``today`` can be passed for deterministic week-boundary math.
"""
import datetime

from backend.data_access import forms as DA_forms
from backend.data_access import tasks as DA_tasks

# Monday, mid-week reference date used throughout.
TODAY = datetime.date(2026, 6, 22)  # Monday


# ── get_recent_forms ──────────────────────────────────────────────────────

def test_recent_forms_keeps_previous_week_and_drops_older(seed, app_ctx):
    uid = seed.user('tok')
    # Latest form 06/22 -> -14d = 06/08 -> week start 06/08. prev_week_start
    # = 06/15. lower = min(06/15, 06/08) = 06/08. So 06/10 is in, 06/01 is out.
    seed.form(uid, 'a', 'Latest', date='06/22', sort_order=0)
    seed.form(uid, 'b', 'In window', date='06/10', sort_order=1)
    seed.form(uid, 'c', 'Too old', date='06/01', sort_order=2)

    cols, unscheduled = DA_forms.get_recent_forms(uid, 14, today=TODAY)
    labels = {c['label'] for c in cols}
    assert labels == {'Latest', 'In window'}
    assert 'Too old' not in labels
    assert unscheduled == []


def test_recent_forms_includes_unscheduled(seed, app_ctx):
    uid = seed.user('tok')
    seed.form(uid, 'a', 'Backlog', is_unscheduled=1, sort_order=0)
    seed.form(uid, 'b', 'Recent', date='06/20', sort_order=1)

    cols, unscheduled = DA_forms.get_recent_forms(uid, 14, today=TODAY)
    assert [u['label'] for u in unscheduled] == ['Backlog']
    assert [c['label'] for c in cols] == ['Recent']


def test_recent_forms_extends_back_for_far_future_latest(seed, app_ctx):
    """When the latest form is well past today, the window widens backward.

    Latest = 07/20 -> latest-14d = 07/06 -> its week start = 07/06 (Monday).
    prev_week_start = 06/15. Lower bound = min(06/15, 07/06) = 06/15, so a
    form on 06/16 is still included even though it predates the future cluster.
    """
    uid = seed.user('tok')
    seed.form(uid, 'a', 'Future', date='07/20', sort_order=0)
    seed.form(uid, 'b', 'Mid', date='06/16', sort_order=1)
    seed.form(uid, 'c', 'Old', date='06/01', sort_order=2)

    cols, _ = DA_forms.get_recent_forms(uid, 14, today=TODAY)
    labels = {c['label'] for c in cols}
    assert labels == {'Future', 'Mid'}


def test_recent_forms_lower_bound_uses_earlier_of_two(seed, app_ctx):
    """If the latest form is far in the future, latest-based bound wins only
    when it is earlier than the previous-week bound."""
    uid = seed.user('tok')
    # Latest 09/30 -> -14d = 09/16 -> week start 09/14. prev_week_start 06/15.
    # min = 06/15, so 06/16 included, 06/08 excluded.
    seed.form(uid, 'a', 'Far', date='09/30', sort_order=0)
    seed.form(uid, 'b', 'Edge in', date='06/16', sort_order=1)
    seed.form(uid, 'c', 'Edge out', date='06/08', sort_order=2)

    cols, _ = DA_forms.get_recent_forms(uid, 14, today=TODAY)
    labels = {c['label'] for c in cols}
    assert 'Edge in' in labels
    assert 'Edge out' not in labels


def test_recent_forms_preserves_sort_order(seed, app_ctx):
    uid = seed.user('tok')
    seed.form(uid, 'a', 'Second', date='06/18', sort_order=5)
    seed.form(uid, 'b', 'First', date='06/16', sort_order=2)

    cols, _ = DA_forms.get_recent_forms(uid, 14, today=TODAY)
    assert [c['label'] for c in cols] == ['First', 'Second']


def test_recent_forms_days_widens_latest_extension(seed, app_ctx):
    """A larger ``days`` pushes the latest-based bound further back.

    Latest 07/20. With days=14 -> -14d=07/06 -> week start 07/06; the prev-week
    bound 06/15 wins, so 05/25 is excluded. With days=60 -> -60d=05/21 -> week
    start 05/18, which is earlier, so 05/25 becomes reachable.
    """
    uid = seed.user('tok')
    seed.form(uid, 'a', 'Future', date='07/20', sort_order=0)
    seed.form(uid, 'b', 'Late May', date='05/25', sort_order=1)

    narrow = {c['label'] for c in DA_forms.get_recent_forms(uid, 14, today=TODAY)[0]}
    assert 'Late May' not in narrow

    wide = {c['label'] for c in DA_forms.get_recent_forms(uid, 60, today=TODAY)[0]}
    assert 'Late May' in wide


# ── get_tasks_in_range ────────────────────────────────────────────────────

def test_tasks_in_range_inclusive_bounds(seed, app_ctx):
    uid = seed.user('tok')
    f_lo = seed.form(uid, 'lo', 'Lo', date='06/10')
    f_mid = seed.form(uid, 'mid', 'Mid', date='06/15')
    f_hi = seed.form(uid, 'hi', 'Hi', date='06/20')
    f_out = seed.form(uid, 'out', 'Out', date='06/25')
    seed.task(uid, f_lo, 't1', 'Lo task')
    seed.task(uid, f_mid, 't2', 'Mid task')
    seed.task(uid, f_hi, 't3', 'Hi task')
    seed.task(uid, f_out, 't4', 'Out task')

    tasks = DA_tasks.get_tasks_in_range(
        uid, datetime.date(2026, 6, 10), datetime.date(2026, 6, 20), today=TODAY)
    names = {t['name'] for t in tasks}
    assert names == {'Lo task', 'Mid task', 'Hi task'}


def test_tasks_in_range_excludes_unscheduled(seed, app_ctx):
    uid = seed.user('tok')
    f_sched = seed.form(uid, 's', 'Sched', date='06/15')
    f_uns = seed.form(uid, 'u', 'Backlog', is_unscheduled=1)
    seed.task(uid, f_sched, 't1', 'Scheduled')
    seed.task(uid, f_uns, 't2', 'Unscheduled')

    tasks = DA_tasks.get_tasks_in_range(
        uid, datetime.date(2026, 6, 1), datetime.date(2026, 6, 30), today=TODAY)
    assert {t['name'] for t in tasks} == {'Scheduled'}


# ── get_tasks_for_forms ───────────────────────────────────────────────────

def test_tasks_for_forms_filters_by_id(seed, app_ctx):
    uid = seed.user('tok')
    f1 = seed.form(uid, 'f1', 'F1', date='06/15')
    f2 = seed.form(uid, 'f2', 'F2', date='06/16')
    f3 = seed.form(uid, 'f3', 'F3', date='06/17')
    seed.task(uid, f1, 't1', 'One')
    seed.task(uid, f2, 't2', 'Two')
    seed.task(uid, f3, 't3', 'Three')

    tasks = DA_tasks.get_tasks_for_forms(uid, [f1, f3])
    assert {t['name'] for t in tasks} == {'One', 'Three'}


def test_tasks_for_forms_empty_list(seed, app_ctx):
    uid = seed.user('tok')
    f1 = seed.form(uid, 'f1', 'F1', date='06/15')
    seed.task(uid, f1, 't1', 'One')
    assert DA_tasks.get_tasks_for_forms(uid, []) == []


def test_tasks_for_forms_user_isolation(seed, app_ctx):
    u1 = seed.user('tok1')
    u2 = seed.user('tok2')
    f1 = seed.form(u1, 'f1', 'F1', date='06/15')
    seed.task(u1, f1, 't1', 'Secret')
    # u2 asks for u1's form id -> gets nothing.
    assert DA_tasks.get_tasks_for_forms(u2, [f1]) == []
