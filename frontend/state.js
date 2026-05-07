let cols = [], weekUnscheduled = [], state = {}, idCounter = 100, colCounter = 200, typeCounter = 0, dragging = null, draggingCol = null;
let typeConfig  = structuredClone(DEFAULT_TYPE_CONFIG);
let legendOrder = [...DEFAULT_LEGEND_ORDER];
let uiScale = 1;

const _token = new URLSearchParams(window.location.search).get('token');
const _apiUrl        = _token ? `/api/state?token=${encodeURIComponent(_token)}`        : '/api/state';
const _metadataUrl   = _token ? `/api/v2/metadata?token=${encodeURIComponent(_token)}`  : '/api/v2/metadata';
const _formsUrl      = _token ? `/api/v2/forms?token=${encodeURIComponent(_token)}`     : '/api/v2/forms';

async function loadState() {
  try {
    const tFetchStart = performance.now();
    const res   = await fetch(_apiUrl);
    const tFetchEnd = performance.now();
    console.log(`[perf] fetch done   +${(tFetchEnd - _t0).toFixed(1)}ms  (network: ${(tFetchEnd - tFetchStart).toFixed(1)}ms)`);
    const saved = await res.json();
    console.log(`[perf] json parsed  +${(performance.now() - _t0).toFixed(1)}ms`);
    if (saved) {
      const rawCols = saved.cols || [];
      cols           = rawCols.filter(c => c.id !== 'unscheduled' && !c.unscheduled);
      const oldUnsched = rawCols.filter(c => c.id === 'unscheduled' || c.unscheduled);
      weekUnscheduled = saved.weekUnscheduled || oldUnsched.map(c => ({id: c.id, label: 'Unscheduled'}));
      state       = saved.state;
      idCounter   = saved.idCounter   || 100;
      colCounter  = saved.colCounter  || 200;
      typeCounter = saved.typeCounter || 0;
      legendOrder = saved.legendOrder || [...DEFAULT_LEGEND_ORDER];
      typeConfig  = saved.typeConfig
        ? {...structuredClone(DEFAULT_TYPE_CONFIG), ...saved.typeConfig}
        : structuredClone(DEFAULT_TYPE_CONFIG);
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
  fetch(_apiUrl, {
    method:  'PUT',
    headers: {'Content-Type':'application/json'},
    body:    JSON.stringify({cols, weekUnscheduled, state, idCounter, colCounter, typeCounter, typeConfig, legendOrder, uiScale, lang, collapseState: Collapse.getAll()}),
  }).catch(() => {});
}

function formApiCreate(col, isUnscheduled, sortOrder) {
  fetch(_formsUrl, {
    method:  'POST',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify({
      client_id:      col.id,
      label:          col.label || '',
      date:           col.date  || '',
      is_unscheduled: isUnscheduled ? 1 : 0,
      sort_order:     sortOrder || 0,
    }),
  }).catch(() => {});
}

function formApiUpdate(clientId, data) {
  const base = _token ? `/api/v2/forms/${encodeURIComponent(clientId)}?token=${encodeURIComponent(_token)}`
                      : `/api/v2/forms/${encodeURIComponent(clientId)}`;
  fetch(base, {
    method:  'PUT',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify(data),
  }).catch(() => {});
}

function formApiDelete(clientId) {
  const base = _token ? `/api/v2/forms/${encodeURIComponent(clientId)}?token=${encodeURIComponent(_token)}`
                      : `/api/v2/forms/${encodeURIComponent(clientId)}`;
  fetch(base, { method: 'DELETE' }).catch(() => {});
}

function saveMetadata() {
  fetch(_metadataUrl, {
    method:  'PUT',
    headers: {'Content-Type':'application/json'},
    body:    JSON.stringify({lang, uiScale, legendOrder, typeConfig, idCounter, colCounter, typeCounter, collapseState: Collapse.getAll()}),
  }).catch(() => {});
}
