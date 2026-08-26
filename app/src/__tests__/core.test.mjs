// Tests for the core modules copied out of frontend/common/ by sync-core.mjs.
//
// These guard the copy itself — that the generated exports are complete and
// correct, and that nothing browser-only leaked in. The date grammar's
// agreement with the backend is checked separately by
// scripts/check-date-parity.mjs, which runs the real Python.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as dates from '../core/dates.js';
import * as constants from '../core/constants.js';
import * as i18n from '../core/i18n.js';
import * as collapse from '../core/collapse.js';

// ── the copy is intact ────────────────────────────────────────────────────

test('dates.js exports the whole grammar', () => {
  for (const name of ['parseColDate', 'parseDateToSortKey', 'isValidColDate',
                      'normalizeColDate', 'colWeekInfo', 'weekKeyToMonday',
                      'todayDateStr', 'isTodayDate', 'inferDay', 'dateStrToIso',
                      'isoToDateStr', 'formatColDate', 'colDateStr']) {
    assert.equal(typeof dates[name], 'function', `${name} missing`);
  }
});

test('i18n.js withholds applyLangToStaticUI', () => {
  // It writes into index.html's DOM. Exporting it would let the app call it and
  // crash on `document`; sync-core's omit list is what keeps it out.
  assert.equal(i18n.applyLangToStaticUI, undefined);
  assert.equal(typeof i18n.t, 'function');
  assert.equal(typeof i18n.translateLabel, 'function');
});

test('importing the core touches no browser global', () => {
  // The modules are already imported above; reaching `document` or `window` at
  // module scope would have thrown before we got here. Assert the environment
  // really lacks them, so this test cannot pass vacuously under a DOM shim.
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof window, 'undefined');
});

// ── the date grammar behaves ──────────────────────────────────────────────

test('a year-less date anchors to 2026, not the current year', () => {
  // The anchor is deliberate: dates written before the year was recorded were
  // all created in 2026, so they must not drift as the clock advances.
  assert.equal(dates.LEGACY_DATE_YEAR, 2026);
  assert.equal(dates.parseColDate('06/15').getFullYear(), 2026);
  assert.equal(dates.parseDateToSortKey('06/15'), 20260615);
});

test('a 2-digit year resolves through +2000', () => {
  assert.equal(dates.parseColDate('03/15/24').getFullYear(), 2024);
  assert.equal(dates.parseColDate('01/01/99').getFullYear(), 2099);
});

test('a trailing + is a marker, not part of the date', () => {
  assert.equal(dates.parseDateToSortKey('07/04+'), dates.parseDateToSortKey('07/04'));
  assert.equal(dates.parseDateToSortKey('07/04++'), Infinity);
});

test('undated columns sort last', () => {
  assert.equal(dates.parseDateToSortKey(''), Infinity);
  assert.equal(dates.parseDateToSortKey('Backlog'), Infinity);
  assert.equal(dates.parseDateToSortKey(null), Infinity);
});

test('an implicit year and an explicit 2026 are the same column', () => {
  // colForDate matches on sort key precisely so '03/11' and '03/11/2026' are
  // one column, not two.
  assert.equal(dates.parseDateToSortKey('03/11'), dates.parseDateToSortKey('03/11/2026'));
});

test('impossible calendar days are rejected', () => {
  for (const bad of ['13/01', '00/01', '01/00', '07/45', '02/30', '04/31', '11/31', '2/29']) {
    assert.equal(dates.isValidColDate(bad), false, `${bad} should be invalid`);
  }
  assert.equal(dates.isValidColDate('02/29/2024'), true, 'a real leap day is valid');
});

test('normalizeColDate pins the year so a stored date cannot re-anchor', () => {
  assert.equal(dates.normalizeColDate('03/11'), '03/11/2026');
  assert.equal(dates.normalizeColDate('03/11/2024'), '03/11/2024');
  assert.equal(dates.normalizeColDate('Backlog'), 'Backlog');
});

// ── ISO week grouping (client-only; the backend never groups by week) ──────

test('weeks are ISO and start on Monday', () => {
  // 2026-03-11 is a Wednesday.
  const wed = dates.colWeekInfo({ date: '03/11/2026' });
  assert.equal(wed.day, 2, 'Mon-first day index');
  const mon = dates.colWeekInfo({ date: '03/09/2026' });
  const sun = dates.colWeekInfo({ date: '03/15/2026' });
  assert.equal(mon.day, 0);
  assert.equal(sun.day, 6);
  assert.equal(mon.key, sun.key, 'Mon and Sun of one week share a key');
  assert.equal(wed.key, mon.key);
  assert.match(wed.key, /^\d{4}-W\d{2}$/);
});

test('colWeekInfo is null for an undated column', () => {
  assert.equal(dates.colWeekInfo({ date: '' }), null);
  assert.equal(dates.colWeekInfo({ date: 'Backlog' }), null);
});

test('weekKeyToMonday round-trips a week key', () => {
  const { key } = dates.colWeekInfo({ date: '03/11/2026' });
  const monday = dates.weekKeyToMonday(key);
  assert.equal(monday.getDay(), 1, 'is a Monday');
  assert.equal(dates.colDateStr(monday), '03/09/2026');
});

// ── i18n ──────────────────────────────────────────────────────────────────

test('en and ru define exactly the same keys', () => {
  // The translation rule in CLAUDE.md: every user-visible string goes through
  // t(), and a key added to one block must be added to the other. The app
  // inherits this — a key present in only one language silently falls back to
  // the raw key at runtime.
  const en = Object.keys(i18n.TRANSLATIONS.en).sort();
  const ru = Object.keys(i18n.TRANSLATIONS.ru).sort();
  assert.deepEqual(ru, en);
});

test('t() falls back to the key rather than throwing', () => {
  assert.equal(i18n.t('__no_such_key__'), '__no_such_key__');
});

// ── constants ─────────────────────────────────────────────────────────────

test('the default type config is intact', () => {
  assert.ok(constants.DEFAULT_TYPE_CONFIG.Random, 'Random is the built-in type');
  assert.ok(constants.DEFAULT_LEGEND_ORDER.includes('Random'));
  assert.equal(constants.UI_SCALES.length, 5);
  assert.ok(constants.UI_SCALES.includes(1), 'unscaled is one of the steps');
  assert.ok(constants.COLOR_PRESETS.length > 0);
});

// ── collapse ──────────────────────────────────────────────────────────────

test('a column only toggles when it has done or more than 3 active tasks', () => {
  const { Collapse } = collapse;
  const active = n => Array.from({ length: n }, (_, i) => ({ id: i, done: false }));
  // canToggle(colId, taskState) reads the column out of the formId → tasks map.
  assert.equal(Collapse.canToggle(1, { 1: active(3) }), false);
  assert.equal(Collapse.canToggle(1, { 1: active(4) }), true);
  assert.equal(Collapse.canToggle(1, { 1: [{ id: 1, done: true }] }), true);
  assert.equal(Collapse.canToggle(1, { 1: [] }), false);
  assert.equal(Collapse.canToggle(99, {}), false, 'an unknown column is inert');
  // A cancelled task counts as done for this rule.
  assert.equal(Collapse.canToggle(1, { 1: [{ id: 1, cancelled: true }] }), true);
});

test('collapse state round-trips through the metadata blob', () => {
  const { Collapse } = collapse;
  Collapse.loadAll({ 7: 1 });
  assert.equal(Collapse.isShort(7), true);
  assert.equal(Collapse.isShort(8), false);
  assert.deepEqual(Collapse.getAll(), { 7: 1 });
  // toggle refuses a column that fails canToggle, so state is unchanged.
  assert.equal(Collapse.toggle(8, { 8: [] }), false);
  assert.deepEqual(Collapse.getAll(), { 7: 1 });
  Collapse.loadAll({});
});
