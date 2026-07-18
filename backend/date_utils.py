"""Date helpers for form/task range queries.

Form dates are stored as display strings (``MM/DD`` or ``MM/DD/YYYY``, with an
optional trailing ``+``), mirroring the frontend's ``parseDateToSortKey``. These
helpers turn those strings into real ``datetime.date`` objects so backend range
filtering matches the frontend's interpretation (year inferred as the current
year when omitted, week starting on Monday).
"""
import datetime
import re

_DATE_RE = re.compile(r'^(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\+?$')

#: Dates written before the year was recorded were all created in 2026, so
#: legacy year-less values resolve there rather than drifting with the clock.
LEGACY_DATE_YEAR = 2026


def parse_form_date(date_str, today=None):
    """Parse a ``MM/DD[/YYYY]`` form date into a ``date``, or ``None``.

    When the year is omitted it falls back to ``LEGACY_DATE_YEAR``, matching the
    frontend's ``resolveYear``. ``today`` is accepted for call-site compatibility
    and no longer affects the result.
    """
    if not date_str:
        return None
    m = _DATE_RE.match(date_str)
    if not m:
        return None
    month, day = int(m.group(1)), int(m.group(2))
    if m.group(3):
        year = int(m.group(3))
        if year < 100:
            year += 2000
    else:
        year = LEGACY_DATE_YEAR
    try:
        return datetime.date(year, month, day)
    except ValueError:
        return None


def week_start(d):
    """Monday of the ISO week containing ``d``."""
    return d - datetime.timedelta(days=d.weekday())
