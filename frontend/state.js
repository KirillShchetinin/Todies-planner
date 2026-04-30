let cols = [], weekUnscheduled = [], state = {}, idCounter = 100, colCounter = 200, typeCounter = 0, dragging = null, draggingCol = null;
let typeConfig  = structuredClone(DEFAULT_TYPE_CONFIG);
let legendOrder = [...DEFAULT_LEGEND_ORDER];
let uiScale = 1;

async function loadState() {
  try {
    const res   = await fetch('/api/state');
    const saved = await res.json();
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
  } catch(e) {}
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
  fetch('/api/state', {
    method:  'PUT',
    headers: {'Content-Type':'application/json'},
    body:    JSON.stringify({cols, weekUnscheduled, state, idCounter, colCounter, typeCounter, typeConfig, legendOrder, uiScale, lang, collapseState: Collapse.getAll()}),
  }).catch(() => {});
}
