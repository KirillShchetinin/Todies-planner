// dates.js — the single client-side reading of a column's date string.
//
// A form's `date` is a DISPLAY STRING, not a date: `MM/DD` or `MM/DD/YYYY`
// with an optional trailing `+`. The rules here are deliberately mirrored by
// `backend/date_utils.py` (`parse_form_date`, `is_valid_form_date`) and the
// two must stay in sync. Nothing outside this file should match a date string
// with its own regex.

// Dates written before the year was recorded were all created in 2026, so
// legacy year-less values resolve there rather than drifting with the clock.
const LEGACY_DATE_YEAR = 2026;

const COL_DATE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;

function resolveYear(rawYear) {
  if (!rawYear) return LEGACY_DATE_YEAR;
  const yr = parseInt(rawYear);
  return yr < 100 ? yr + 2000 : yr;
}

// Regex parts [, MM, DD, YY?] of a column date, or null. The trailing `+`
// marker is not part of the date. Surrounding whitespace is NOT tolerated —
// the backend applies the same strict rule.
function matchColDate(dateStr) {
  return (dateStr || '').replace(/\+$/, '').match(COL_DATE_RE);
}

// The calendar day a column date names, or null when it names none.
function parseColDate(dateStr) {
  const m = matchColDate(dateStr);
  if (!m) return null;
  const d = new Date(resolveYear(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
  return isNaN(d) ? null : d;
}

// Sortable YYYYMMDD integer; undated columns sort last.
function parseDateToSortKey(dateStr) {
  if (!dateStr) return Infinity;
  const m = matchColDate(dateStr);
  if (!m) return Infinity;
  return resolveYear(m[3]) * 10000 + parseInt(m[1]) * 100 + parseInt(m[2]);
}

// Empty is allowed (dateless column); otherwise MM/DD[/YYYY] must name a real
// calendar day — rejects 13/01, 07/45, 02/29 in a non-leap year, 01/2/02/02.
function isValidColDate(dateStr) {
  const raw = (dateStr || '').trim();
  if (!raw) return true;
  const m = matchColDate(raw);
  if (!m) return false;
  const mo = parseInt(m[1]), day = parseInt(m[2]);
  if (mo < 1 || mo > 12 || day < 1) return false;
  const d = new Date(resolveYear(m[3]), mo - 1, day);
  return d.getMonth() === mo - 1 && d.getDate() === day;
}

// Pins an explicit year at write time so a stored date can't re-anchor to a
// later "current year". Leaves unparseable input alone.
function normalizeColDate(dateStr) {
  const raw  = (dateStr || '').trim();
  const plus = raw.endsWith('+') ? '+' : '';
  const m    = matchColDate(raw);
  if (!m) return raw;
  let yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
  if (yr < 100) yr += 2000;
  return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${yr}${plus}`;
}

// Column headers stay MM/DD — the stored year is not shown.
function formatColDate(dateStr) {
  const raw  = (dateStr || '').trim();
  const plus = raw.endsWith('+') ? '+' : '';
  const m    = matchColDate(raw);
  if (!m) return raw;
  return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}${plus}`;
}

// MM/DD/YYYY ⇄ YYYY-MM-DD (the value format of <input type="date">).
function dateStrToIso(dateStr) {
  const m = matchColDate(dateStr);
  if (!m) return '';
  return `${resolveYear(m[3])}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

function isoToDateStr(iso) {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}

// Today, in the canonical stored form.
function todayDateStr() {
  const now = new Date();
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const dd  = String(now.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${now.getFullYear()}`;
}

// Month/day only, matching how both views highlight "today" — a column dated
// 03/11 is today's column whichever year it carries.
function isTodayDate(dateStr) {
  const m = (dateStr || '').match(/^(\d{1,2})\/(\d{1,2})/);
  if (!m) return false;
  const now = new Date();
  return parseInt(m[1]) === now.getMonth() + 1 && parseInt(m[2]) === now.getDate();
}

// English 3-letter weekday for a date string, or '' — the label auto-filled
// when a day column is created.
function inferDay(dateStr) {
  const d = parseColDate((dateStr || '').trim());
  return d ? d.toLocaleDateString('en-US', {weekday:'short'}) : '';
}

// ISO week key "YYYY-Www" and day-of-week index (0=Mon…6=Sun) for a column,
// or null when it has no usable date. Week grouping is Monday-first and is
// computed here on the client; the backend never groups by week.
function colWeekInfo(col) {
  const d = parseColDate(col.date);
  if (!d) return null;
  const day = (d.getDay() + 6) % 7; // 0=Mon…6=Sun
  const thu  = new Date(d); thu.setDate(d.getDate() + (3 - day));
  const jan4 = new Date(thu.getFullYear(), 0, 4);
  const week = 1 + Math.round((thu - jan4) / 604800000);
  return { key: `${thu.getFullYear()}-W${String(week).padStart(2,'0')}`, day };
}

// Monday (day 0) of the ISO week identified by "YYYY-Www".
function weekKeyToMonday(key) {
  const m = key.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1]), week = parseInt(m[2]);
  const jan4 = new Date(year, 0, 4);
  const dow  = (jan4.getDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + (week - 1) * 7);
  return monday;
}
