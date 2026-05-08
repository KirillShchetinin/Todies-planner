let cols = [], weekUnscheduled = [], state = {}, idCounter = 100, colCounter = 200, typeCounter = 0, dragging = null, draggingCol = null;
let typeConfig  = structuredClone(DEFAULT_TYPE_CONFIG);
let legendOrder = [...DEFAULT_LEGEND_ORDER];
let uiScale = 1;

const _token = new URLSearchParams(window.location.search).get('token');
const _apiUrl        = _token ? `/api/state?token=${encodeURIComponent(_token)}`        : '/api/state';
const _metadataUrl   = _token ? `/api/v2/metadata?token=${encodeURIComponent(_token)}`  : '/api/v2/metadata';
const _formsUrl      = _token ? `/api/v2/forms?token=${encodeURIComponent(_token)}`     : '/api/v2/forms';
const _tasksUrl      = _token ? `/api/v2/tasks?token=${encodeURIComponent(_token)}`     : '/api/v2/tasks';

function applyTasksData(tasksData) {
  const allForms = [...cols, ...weekUnscheduled];
  const dbIdMap = {};
  for (const f of allForms) dbIdMap[f.dbId] = f.id;
  state = {};
  for (const t of (tasksData.tasks || [])) {
    const formClientId = dbIdMap[t.form_id];
    if (!formClientId) continue;
    if (!state[formClientId]) state[formClientId] = [];
    const { metadata = {}, ...rest } = t;
    state[formClientId].push({ id: t.client_id, text: t.name, done: !!t.done, ...metadata });
  }
}

function applyFormsData(data) {
  cols = data.cols || [];
  weekUnscheduled = data.weekUnscheduled || [];
  ensureWeekUnscheduled();
  sortColsByDate();
}

async function loadState(prefetchedSaved) {
  try {
    let saved;
    if (prefetchedSaved !== undefined) {
      saved = prefetchedSaved;
    } else {
      const res = await apiFetch(_apiUrl, undefined, 'load state');
      saved = await res.json();
    }
    if (saved) {
      const rawCols = saved.cols || [];
      cols           = rawCols.filter(c => c.id !== 'unscheduled' && !c.unscheduled);
      const oldUnsched = rawCols.filter(c => c.id === 'unscheduled' || c.unscheduled);
      weekUnscheduled = saved.weekUnscheduled || oldUnsched.map(c => ({id: c.id, label: 'Unscheduled'}));
      state       = saved.state;
      idCounter   = saved.idCounter   || 100;
      colCounter  = saved.colCounter  || 200;
      typeCounter = saved.typeCounter || 0;
      legendOrder = (saved.legendOrder || []).filter(k => k in typeConfig);
      if (!legendOrder.length) legendOrder = [...DEFAULT_LEGEND_ORDER];
      const customCfg = Object.fromEntries(Object.entries(saved.typeConfig || {}).filter(([k]) => k.startsWith('t-custom-')));
      typeConfig  = {...structuredClone(DEFAULT_TYPE_CONFIG), ...customCfg};
      uiScale     = saved.uiScale     || 1;
      lang        = saved.lang        || 'en';
      Collapse.loadAll(saved.collapseState);
      Object.values(typeConfig).forEach(cfg => delete cfg.fixed);
      ensureWeekUnscheduled();
      sortColsByDate();
      return;
    }
  } catch(e) { console.warn('loadState failed:', e); }
  cols  = DEFAULT_COLS.map(c => ({...c}));
  weekUnscheduled = DEFAULT_WEEK_UNSCHEDULED.map(c => ({...c}));
  state = {};
  INIT_TASKS.forEach(t => { if (!state[t.col]) state[t.col]=[]; state[t.col].push({...t}); });
}

function ensureWeekUnscheduled() {
  if (weekUnscheduled.length === 0) {
    weekUnscheduled.push({id: 'unsched_w' + (colCounter++), label: 'Unscheduled'});
  }
}

function saveState() {
  apiFetch(_apiUrl, {
    method:  'PUT',
    headers: {'Content-Type':'application/json'},
    body:    JSON.stringify({cols, weekUnscheduled, state, idCounter, typeCounter, typeConfig, legendOrder, uiScale, lang, collapseState: Collapse.getAll()}),
  }, 'save state').catch(() => {});
}

function formApiCreate(col, isUnscheduled, sortOrder) {
  apiFetch(_formsUrl, {
    method:  'POST',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify({
      client_id:      col.id,
      label:          col.label || '',
      date:           col.date  || '',
      is_unscheduled: isUnscheduled ? 1 : 0,
      sort_order:     sortOrder || 0,
    }),
  }, 'create form').catch(() => {});
}

function formApiUpdate(clientId, data) {
  const base = _token ? `/api/v2/forms/${encodeURIComponent(clientId)}?token=${encodeURIComponent(_token)}`
                      : `/api/v2/forms/${encodeURIComponent(clientId)}`;
  apiFetch(base, {
    method:  'PUT',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify(data),
  }, 'update form').catch(() => {});
}

function formApiDelete(clientId) {
  const base = _token ? `/api/v2/forms/${encodeURIComponent(clientId)}?token=${encodeURIComponent(_token)}`
                      : `/api/v2/forms/${encodeURIComponent(clientId)}`;
  apiFetch(base, { method: 'DELETE' }, 'delete form').catch(() => {});
}

function saveMetadata() {
  apiFetch(_metadataUrl, {
    method:  'PUT',
    headers: {'Content-Type':'application/json'},
    body:    JSON.stringify({lang, uiScale, legendOrder, typeConfig, idCounter, typeCounter, collapseState: Collapse.getAll()}),
  }, 'save metadata').catch(() => {});
}
