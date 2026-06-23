"""Date helpers for form/task range queries.

Form dates are stored as display strings (``MM/DD`` or ``MM/DD/YYYY``, with an
optional trailing ``+``), mirroring the frontend's ``parseDateToSortKey``. These
helpers turn those strings into real ``datetime.date`` objects so backend range
filtering matches the frontend's interpretation (year inferred as the current
year when omitted, week starting on Monday).
"""
import datetime
import re

_DATE_RE = re.compile(r'^\s*(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\s*$')


def parse_form_date(date_str, today=None):
    """Parse a ``MM/DD[/YYYY]`` form date into a ``date``, or ``None``.

    When the year is omitted it is inferred from ``today`` (defaults to the
    current date), matching the frontend.
    """
    if not date_str:
        return None
    base = date_str.rstrip('+')
    m = _DATE_RE.match(base)
    if not m:
        return None
    today = today or datetime.date.today()
    month, day = int(m.group(1)), int(m.group(2))
    if m.group(3):
        year = int(m.group(3))
        if year < 100:
            year += 2000
    else:
        year = today.year
    try:
        return datetime.date(year, month, day)
    except ValueError:
        return None


def week_start(d):
    """Monday of the ISO week containing ``d``."""
    return d - datetime.timedelta(days=d.weekday())
