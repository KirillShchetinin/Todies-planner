// columns.js — creating, deleting and progressively loading columns.
//
// A "column" is a form: either a day column (has a date) or a week's
// unscheduled container (is_unscheduled). Both views render the same columns;
// nothing here touches view DOM.

function sortColsByDate() {
  cols.sort((a, b) => parseDateToSortKey(a.date) - parseDateToSortKey(b.date));
}

function allCols() { return [...cols, ...weekUnscheduled]; }

// The day column for a date string, or null. Matched on the sort key, so
// 03/11 and 03/11/2026 name the same column.
function colForDate(dateStr) {
  const key = parseDateToSortKey(dateStr);
  if (key === Infinity) return null;
  return cols.find(c => parseDateToSortKey(c.date) === key) || null;
}

function todayCol() { return colForDate(todayDateStr()); }

// Returns the new form's id, or null if it wasn't created.
async function addCol(label, date) {
  if (!label.trim()) return null;
  if (!isValidColDate(date)) { showAlert(t('invalidDate')); return null; }
  const colDate = normalizeColDate(date);
  try {
    const { id } = await formApiCreate({ label: label.trim(), date: colDate }, false, cols.length);
    UndoHistory.push();
    cols.push({ id, label: label.trim(), date: colDate });
    state[id] = [];
    loadedFormIds.add(id);   // newly created form starts empty → already "loaded"
    sortColsByDate();
    await ensureUnscheduledForWeeks();
    render();
    return id;
  } catch(e) { return null; }
}

function addNextDay() {
  const dayCols = cols.filter(c => c.date);
  let label = '', date = '';
  if (dayCols.length > 0) {
    const d = parseColDate(dayCols[dayCols.length - 1].date);
    if (d) {
      d.setDate(d.getDate() + 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      date  = `${mm}/${dd}/${d.getFullYear()}`;
      label = d.toLocaleDateString('en-US', {weekday: 'short'});
    }
  }
  addCol(label || t('dayFallback'), date);
}

// Creates the day form for one empty slot in an already-rendered week
// (double-click on desktop, tap on mobile's empty day chip).
function addDayAtSlot(weekKey, dayIndex) {
  const monday = weekKeyToMonday(weekKey);
  if (!monday) return;
  const d = new Date(monday);
  d.setDate(monday.getDate() + dayIndex);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  addCol(d.toLocaleDateString('en-US', {weekday: 'short'}), `${mm}/${dd}/${d.getFullYear()}`);
}

async function addUnscheduledCol() {
  try {
    const { id } = await formApiCreate({ label: 'Unscheduled', date: '' }, true, weekUnscheduled.length);
    UndoHistory.push();
    weekUnscheduled.push({ id, label: 'Unscheduled' });
    loadedFormIds.add(id);
    render();
  } catch(e) {}
}

// Refused client-side as well as server-side (the DELETE returns 409), so the
// user gets an explanation instead of a silent failure.
function deleteCol(colId) {
  const tasks = state[colId] || [];
  if (tasks.length > 0) { showAlert(t('deleteColHasTasks')); return; }
  UndoHistory.push();
  pessimistic(
    () => formApiDelete(colId),
    () => { delete state[colId]; cols = cols.filter(c => c.id !== colId); },
  );
}

function uniqueWeekKeys() {
  const keys = new Set();
  let hasNoDate = false;
  cols.forEach(c => {
    const info = colWeekInfo(c);
    if (info) keys.add(info.key);
    else hasNoDate = true;
  });
  return keys.size + (hasNoDate ? 1 : 0);
}

async function ensureTodayCol() {
  const todayStr = todayDateStr();
  if (colForDate(todayStr)) return;
  const label = new Date().toLocaleDateString('en-US', { weekday: 'short' });
  try {
    const { id } = await formApiCreate({ label, date: todayStr }, false, cols.length);
    cols.push({ id, label, date: todayStr });
    state[id] = [];
    loadedFormIds.add(id);
    sortColsByDate();
  } catch(e) {}
}

async function ensureUnscheduledForWeeks() {
  const need = Math.max(1, uniqueWeekKeys());
  while (weekUnscheduled.length < need) {
    try {
      const { id } = await formApiCreate({ label: 'Unscheduled', date: '' }, true, weekUnscheduled.length);
      weekUnscheduled.push({ id, label: 'Unscheduled' });
      loadedFormIds.add(id);
    } catch (e) { break; }
  }
}

// ── progressive load ──────────────────────────────────────────────────────

// True when at least one scheduled form's tasks have not been fetched yet.
// Gated on the session-frozen flag (a session that started with full load has
// nothing unloaded); the control's presence must not change when customLoad is
// toggled mid-session.
function hasUnloadedWeeks() {
  return customLoadActive && cols.some(c => !loadedFormIds.has(c.id));
}

// Reveal older unloaded weeks. Shared by desktop button + mobile chip. Fetches
// those forms' tasks by ID, merges, clears undo (a stale snapshot predates the
// merged tasks), and re-renders with scroll preserved. Normally loads the 2
// newest unloaded weeks, but if customLoad has been toggled OFF this session,
// a click loads ALL remaining weeks at once (catch up to full immediately).
async function loadEarlierWeeks() {
  if (loadingEarlier) return;

  // Group unloaded scheduled forms by week key; undated forms load last.
  const unloaded = cols.filter(c => !loadedFormIds.has(c.id));
  if (!unloaded.length) return;
  const byKey = new Map();
  const NODATE = '__nodate__';
  unloaded.forEach(c => {
    const info = colWeekInfo(c);
    const key  = info ? info.key : NODATE;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(c.id);
  });
  // Newest weeks first; the undated bucket always sorts to the very end.
  const keys = [...byKey.keys()].sort((a, b) => {
    if (a === NODATE) return 1;
    if (b === NODATE) return -1;
    return a < b ? 1 : a > b ? -1 : 0;
  });
  // customLoad ON → next 2 weeks; toggled OFF this session → all remaining.
  const take = customLoad ? 2 : keys.length;
  const ids = keys.slice(0, take).flatMap(k => byKey.get(k));
  if (!ids.length) return;

  loadingEarlier = true;
  render();  // re-render so the control shows its loading label

  const scroller = viewScrollEl();
  const prevTop    = scroller ? scroller.scrollTop    : 0;
  const prevHeight = scroller ? scroller.scrollHeight : 0;

  try {
    const res  = await apiFetch(withParam(TASKS_URL, `form_ids=${ids.join(',')}`), undefined, 'load earlier tasks');
    if (!res.ok) throw new Error('load earlier tasks failed');
    const data = await res.json();
    mergeTasksData(data, ids);
    UndoHistory.clear();      // a pre-merge snapshot would drop the merged tasks
    loadingEarlier = false;
    render();
    // Keep the viewport anchored: prepended rows grow scrollHeight from the top.
    const s = viewScrollEl();
    if (s) s.scrollTop = prevTop + (s.scrollHeight - prevHeight);
  } catch (e) {
    loadingEarlier = false;   // loaded data untouched — retry = click again
    render();
  }
}
