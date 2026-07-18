// Dates written before the year was recorded were all created in 2026, so
// legacy year-less values resolve there rather than drifting with the clock.
const LEGACY_DATE_YEAR = 2026;

function resolveYear(rawYear) {
  if (!rawYear) return LEGACY_DATE_YEAR;
  const yr = parseInt(rawYear);
  return yr < 100 ? yr + 2000 : yr;
}

function parseDateToSortKey(dateStr) {
  if (!dateStr) return Infinity;
  const base = dateStr.replace(/\+$/, '');
  const m = base.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return Infinity;
  return resolveYear(m[3]) * 10000 + parseInt(m[1]) * 100 + parseInt(m[2]);
}

// Pins an explicit year at write time so a stored date can't re-anchor to a
// later "current year". Leaves unparseable input alone.
function normalizeColDate(dateStr) {
  const raw  = (dateStr || '').trim();
  const plus = raw.endsWith('+') ? '+' : '';
  const m    = raw.replace(/\+$/, '').match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return raw;
  let yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
  if (yr < 100) yr += 2000;
  return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${yr}${plus}`;
}

// Column headers stay MM/DD — the stored year is not shown.
function formatColDate(dateStr) {
  const raw  = (dateStr || '').trim();
  const plus = raw.endsWith('+') ? '+' : '';
  const m    = raw.replace(/\+$/, '').match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return raw;
  return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}${plus}`;
}

function sortColsByDate() {
  cols.sort((a, b) => parseDateToSortKey(a.date) - parseDateToSortKey(b.date));
}

function inferDay(dateStr) {
  const m = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return '';
  const d  = new Date(resolveYear(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', {weekday:'short'});
}

// Returns ISO week key "YYYY-Www" and day-of-week index (0=Mon…6=Sun) for a col.
function colWeekInfo(col) {
  const base = (col.date || '').replace(/\+$/, '');
  const m = base.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const d  = new Date(resolveYear(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
  if (isNaN(d)) return null;
  const day = (d.getDay() + 6) % 7; // 0=Mon…6=Sun
  const thu  = new Date(d); thu.setDate(d.getDate() + (3 - day));
  const jan4 = new Date(thu.getFullYear(), 0, 4);
  const week = 1 + Math.round((thu - jan4) / 604800000);
  return { key: `${thu.getFullYear()}-W${String(week).padStart(2,'0')}`, day };
}

async function addCol(label, date) {
  if (!label.trim()) return;
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
  } catch(e) {}
}

function addNextDay() {
  const dayCols = cols.filter(c => c.date);
  let label = '', date = '';
  if (dayCols.length > 0) {
    const last = dayCols[dayCols.length - 1];
    const baseDate = last.date.replace(/\+$/, '');
    const m = baseDate.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (m) {
      const d  = new Date(resolveYear(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
      d.setDate(d.getDate() + 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      date  = `${mm}/${dd}/${d.getFullYear()}`;
      label = d.toLocaleDateString('en-US', {weekday: 'short'});
    }
  }
  addCol(label || t('dayFallback'), date);
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
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${mm}/${dd}/${now.getFullYear()}`;
  const todayKey = parseDateToSortKey(todayStr);
  if (cols.some(c => parseDateToSortKey(c.date) === todayKey)) return;
  const label = now.toLocaleDateString('en-US', { weekday: 'short' });
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

// True when at least one scheduled form's tasks have not been fetched yet.
// Gated on the session-frozen flag (a session that started with full load has
// nothing unloaded); the control's presence must not change when customLoad is
// toggled mid-session.
function hasUnloadedWeeks() {
  return customLoadActive && cols.some(c => !loadedFormIds.has(c.id));
}

// The vertical scroll container differs per view: the document scrolls on
// desktop, #board scrolls on mobile. Prepending week rows must not shift the
// viewport, so anchor whichever element actually scrolls.
function _boardScrollEl() {
  return document.body.dataset.view === 'mobile'
    ? document.getElementById('board')
    : document.scrollingElement;
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

  const scroller = _boardScrollEl();
  const prevTop    = scroller ? scroller.scrollTop    : 0;
  const prevHeight = scroller ? scroller.scrollHeight : 0;

  try {
    const url  = _tasksUrl + (_token ? '&' : '?') + `form_ids=${ids.join(',')}`;
    const res  = await apiFetch(url, undefined, 'load earlier tasks');
    if (!res.ok) throw new Error('load earlier tasks failed');
    const data = await res.json();
    mergeTasksData(data, ids);
    UndoHistory.clear();      // a pre-merge snapshot would drop the merged tasks
    loadingEarlier = false;
    render();
    // Keep the viewport anchored: prepended rows grow scrollHeight from the top.
    const s = _boardScrollEl();
    if (s) s.scrollTop = prevTop + (s.scrollHeight - prevHeight);
  } catch (e) {
    loadingEarlier = false;   // loaded data untouched — retry = click again
    render();
  }
}
