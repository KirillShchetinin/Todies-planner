// state.js — the whole client model, and the three ways to change it.
//
// There is no store and no reactivity: the globals below ARE the model, and
// every mutation ends in a full render(). Both renderers read from here; only
// this file and the domain modules beside it write.

let cols = [], weekUnscheduled = [], state = {}, typeCounter = 0, dragging = null, draggingCol = null;
let typeConfig  = structuredClone(DEFAULT_TYPE_CONFIG);
let legendOrder = [...DEFAULT_LEGEND_ORDER];
let uiScale = 1;                 // desktop view scale
let uiScaleMobile = 1;           // mobile view scale — independent of desktop
let customLoad = false;          // live setting: button label, persistence, earlier-weeks fetch scope
let customLoadActive = false;    // customLoad frozen at page load — governs rendering; toggling never changes the view until refresh
let loadedFormIds = new Set();   // forms whose tasks have been fetched (customLoad ON)
let loadingEarlier = false;      // one in-flight guard for batch fetches

// Replaces the whole board: every form's tasks come from this one response.
function applyTasksData(tasksData) {
  state = {};
  mergeTasksData(tasksData, []);
}

// Merge variant of applyTasksData for progressive loading: replaces (never
// appends) the tasks for exactly the given form IDs and marks them loaded.
// Idempotent — re-fetching the same batch produces the same state.
function mergeTasksData(tasksData, formIds) {
  for (const id of formIds) state[id] = [];      // fetched-but-empty forms
  for (const t of (tasksData.tasks || [])) {
    const formId = t.form_id;
    if (!state[formId]) state[formId] = [];
    const meta = t.metadata || {};
    state[formId].push({ id: t.id, text: t.name, done: !!t.done, ...meta });
  }
  for (const id of formIds) loadedFormIds.add(id);
}

function applyFormsData(data) {
  cols = data.cols || [];
  weekUnscheduled = data.weekUnscheduled || [];
  sortColsByDate();
}

// Optimistic mutation, scoped to one entity. Applies `mutate` and renders
// immediately, fires the API, and if it fails runs `revert` — which must undo
// only what `mutate` changed, so concurrent in-flight actions are unaffected.
// (On the default page apiFetch returns a synthetic success, so failures and
// rollbacks only ever happen for real, token-backed accounts.)
function optimistic(mutate, apiCall, revert) {
  UndoHistory.push();
  mutate();
  render();
  return Promise.resolve()
    .then(apiCall)
    .then(res => {
      if (res && res.ok === false) throw new Error('request failed');
      return res;
    })
    .catch(() => { revert(); render(); });
}

// Pessimistic mutation: persist FIRST, and only apply to the in-memory model +
// render once the server confirms. On failure nothing changes — the UI never
// diverges from the server. `apiCall` must carry the intended change itself
// (the model isn't mutated until it succeeds). Use when an optimistic revert
// would be messy (metadata-blob writes, server-id-dependent creates).
function pessimistic(apiCall, apply) {
  return Promise.resolve()
    .then(apiCall)
    .then(res => {
      if (res && res.ok === false) throw new Error('request failed');
      apply(res);
      render();
      return res;
    })
    .catch(() => {});
}

// Pessimistic variant for metadata-blob writes, where the change IS the request
// payload (saveMetadata serializes the live globals). Mutates, saves, and on
// failure reverts so the UI never persists a change the server rejected.
// `mutate` applies the change to the globals; `revert` undoes exactly that.
function pessimisticMeta(mutate, revert) {
  mutate();
  render();
  return saveMetadata().catch(() => { revert(); render(); });
}

// Resolves only when the server accepts the write; rejects on network or !ok
// so pessimistic callers can apply the change only after it has persisted.
function saveMetadata() {
  return apiFetch(METADATA_URL, {
    method:  'PUT',
    headers: {'Content-Type':'application/json'},
    body:    JSON.stringify({lang, uiScale, uiScaleMobile, legendOrder, typeConfig, typeCounter, collapseState: Collapse.getAll(), customLoad}),
  }, 'save metadata').then(res => {
    if (res && res.ok === false) throw new Error('save metadata failed');
    return res;
  });
}
