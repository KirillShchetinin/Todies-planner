// The one canonical board every test starts from.
//
// The clock is pinned to Wed 11 Mar 2026 (ISO week 2026-W11, Mon 09 – Sun 15).
// Mon–Sat exist; SUNDAY IS DELIBERATELY MISSING so the empty-slot ("ghost")
// paths are exercised by the default fixture instead of needing their own setup.
// With today's column and one unscheduled container already present, the app's
// ensureTodayCol()/ensureUnscheduledForWeeks() self-healing stays a no-op and
// the board is byte-stable across runs.

const FIXED_NOW = new Date('2026-03-11T12:00:00Z');

// Any task on today's column: it is the only text visible in BOTH views
// (mobile collapses non-today days to dots), so it doubles as the load anchor.
const ANCHOR_TASK = 'Review PRs';

const TYPE_CONFIG = {
  't-custom-0': { label: 'Work', bg: '#e8f0fa', border: '#b5cff0', text: '#1a4a8a' },
  't-custom-1': { label: 'Home', bg: '#eaf6ee', border: '#a8ddb8', text: '#1a5c30' },
};

const METADATA = {
  lang: 'en',
  uiScale: 1,
  uiScaleMobile: 1,
  typeCounter: 2,
  typeConfig: TYPE_CONFIG,
  legendOrder: ['Random', 't-custom-0', 't-custom-1'],
  collapseState: {},
  customLoad: false,
};

// key → { label, date, tasks: [name, type, done] }
const FORMS = {
  mon: { label: 'Mon', date: '03/09/2026', tasks: [
    ['Team standup', 't-custom-0', 0],
    ['Walk the dog', 'Random', 1],
  ] },
  tue: { label: 'Tue', date: '03/10/2026', tasks: [] },
  // Today. Four active + one done → the only column that can collapse.
  wed: { label: 'Wed', date: '03/11/2026', tasks: [
    [ANCHOR_TASK, 't-custom-0', 0],
    ['Buy milk', 'Random', 0],
    ['Call bank', 't-custom-1', 0],
    ['Water plants', 'Random', 0],
    ['Old chore', 'Random', 1],
  ] },
  thu: { label: 'Thu', date: '03/12/2026', tasks: [] },   // empty move-to target
  fri: { label: 'Fri', date: '03/13/2026', tasks: [
    ['Plan next week', 't-custom-0', 0],
  ] },
  sat: { label: 'Sat', date: '03/14/2026', tasks: [] },   // empty, deletable
  // sun 03/15/2026 intentionally absent
  unscheduled: { label: 'Unscheduled', date: '', unscheduled: true, tasks: [
    ['Fix bike', 'Random', 0],
    ['Renew passport', 't-custom-1', 0],
  ] },
};

const SUNDAY = { date: '03/15/2026', dayNum: 15 };

module.exports = { FIXED_NOW, ANCHOR_TASK, TYPE_CONFIG, METADATA, FORMS, SUNDAY };
