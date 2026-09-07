// Fixture for the progressive-load (`customLoad`) board.
//
// Why this doesn't use the shared fixture: progressive load is the one feature
// where the BACKEND decides what the frontend may render. `get_recent_forms`
// windows on the server's own `datetime.date.today()`, and no query param can
// pin that — so a board seeded around the suite's fixed 11 Mar 2026 would be
// flagged entirely out-of-window by a server living in the real present, and
// nothing would render. This board is therefore seeded relative to the REAL
// current week, and the browser clock is pinned to that same calendar date so
// both sides agree on "today".
//
// Residual: a run that crosses Sunday→Monday midnight (server-local) shifts the
// server's week while the pinned browser stays on the old one. That is a
// minutes-per-week window and every column here sits mid-week, so a one-day
// skew changes no assertion.

const base = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const { DB_FILE } = require('./db');
const { TYPE_CONFIG } = require('./seed-data');

const KILL_ANIMATIONS = '*,*::before,*::after{transition:none!important;animation:none!important}';

// Noon UTC on the server's current calendar date. Built from the local Y/M/D so
// the browser (which the config pins to UTC) reads back the same date the
// server will, whatever the runner's timezone.
const _now = new Date();
const TODAY = new Date(Date.UTC(_now.getFullYear(), _now.getMonth(), _now.getDate(), 12));

/** Monday of the ISO week containing `d`, as a new UTC date. */
function monday(d) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

function shift(d, days) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

const mmdd = d =>
  `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
const mmddyyyy = d => `${mmdd(d)}/${d.getUTCFullYear()}`;

const MONDAY = monday(TODAY);

// One day column per week, mid-week (Wednesday) so a one-day clock skew can
// never move it across a week boundary — except the current week, which uses
// TODAY itself so the app's ensureTodayCol() self-heal stays a no-op.
//
// Where each week falls relative to the server window (lower bound = Monday of
// last week; upper bound = Sunday of the week two ahead):
//
//   W-3  outside, behind    → hidden until "earlier weeks"
//   W-1  the lower bound    → loaded
//   W0   today's week       → loaded
//   W+1, W+2  inside ahead  → loaded
//   W+3, W+4, W+5  beyond   → hidden until "load more"
const WEEKS = [
  { key: 'W-3', weeks: -3, loaded: false },
  { key: 'W-1', weeks: -1, loaded: true },
  { key: 'W0', weeks: 0, loaded: true },
  { key: 'W+1', weeks: 1, loaded: true },
  { key: 'W+2', weeks: 2, loaded: true },
  { key: 'W+3', weeks: 3, loaded: false },
  { key: 'W+4', weeks: 4, loaded: false },
  { key: 'W+5', weeks: 5, loaded: false },
].map(w => {
  const date = w.weeks === 0 ? TODAY : shift(MONDAY, w.weeks * 7 + 2);
  return { ...w, date, mmdd: mmdd(date), stored: mmddyyyy(date) };
});

const byKey = Object.fromEntries(WEEKS.map(w => [w.key, w]));
/** The task seeded on that week's column — one per week, named for the week. */
const taskOf = key => `task ${key}`;
const ANCHOR = taskOf('W0');   // on today's column, so always in the first batch

const LOADED = WEEKS.filter(w => w.loaded);

function seedProgressiveBoard(customLoad) {
  const token = randomUUID().replace(/-/g, '');
  const db = new DatabaseSync(DB_FILE);
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    const userId = db.prepare('INSERT INTO users (token, metadata) VALUES (?, ?)').run(
      token,
      JSON.stringify({
        lang: 'en', uiScale: 1, uiScaleMobile: 1, typeCounter: 2,
        typeConfig: TYPE_CONFIG, legendOrder: ['Random', 't-custom-0', 't-custom-1'],
        collapseState: {}, customLoad,
      })
    ).lastInsertRowid;

    const insForm = db.prepare(
      'INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order)' +
      ' VALUES (?, ?, ?, ?, ?, ?)');
    const insTask = db.prepare(
      'INSERT INTO tasks (user_id, form_id, client_id, name, done, sort_order, metadata)' +
      ' VALUES (?, ?, ?, ?, ?, ?, ?)');

    WEEKS.forEach((w, i) => {
      const id = insForm.run(userId, w.key, w.key, w.stored, 0, i).lastInsertRowid;
      insTask.run(userId, id, `${w.key}-0`, taskOf(w.key), 0, 0, JSON.stringify({ type: 'Random' }));
    });
    // One unscheduled container per week, so ensureUnscheduledForWeeks() has
    // nothing to create and the board is stable on first paint.
    WEEKS.forEach((w, i) =>
      insForm.run(userId, `u-${w.key}`, 'Unscheduled', '', 1, i));

    return { token };
  } finally {
    db.close();
  }
}

const test = base.test.extend({
  // Flip with `test.use({ customLoad: false })` to get the same board loaded
  // in full — the control case that proves the gating.
  customLoad: [true, { option: true }],

  planner: async ({ page, customLoad }, use) => {
    const { token } = seedProgressiveBoard(customLoad);

    await page.clock.setFixedTime(TODAY);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());

    await page.goto(`/?token=${token}`);
    await page.addStyleTag({ content: KILL_ANIMATIONS });
    // Tasks land in the last of the three load phases, so the anchor being
    // painted means metadata, forms and tasks have all been applied.
    await page.locator('.task', { hasText: ANCHOR }).first().waitFor();
    await use({ token });
  },
});

module.exports = { test, expect: base.expect, WEEKS, LOADED, byKey, taskOf };
