let cols = [], weekUnscheduled = [], state = {}, typeCounter = 0, dragging = null, draggingCol = null;
let typeConfig  = structuredClone(DEFAULT_TYPE_CONFIG);
let legendOrder = [...DEFAULT_LEGEND_ORDER];
let uiScale = 1;
let customLoad = false;

const _token = new URLSearchParams(window.location.search).get('token');
const _withToken = path => _token ? `${path}?token=${encodeURIComponent(_token)}` : path;

const _metadataUrl = _withToken('/api/v2/metadata');
const _formsUrl    = _withToken('/api/v2/forms');
const _tasksUrl    = _withToken('/api/v2/tasks');

function applyTasksData(tasksData) {
  state = {};
  for (const t of (tasksData.tasks || [])) {
    const formId = t.form_id;
    if (!state[formId]) state[formId] = [];
    const meta = t.metadata || {};
    state[formId].push({ id: t.id, text: t.name, done: !!t.done, ...meta });
  }
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

// Resolves only when the server accepts the write; rejects on network or !ok
// so pessimistic callers can apply the change only after it has persisted.
function saveMetadata() {
  return apiFetch(_metadataUrl, {
    method:  'PUT',
    headers: {'Content-Type':'application/json'},
    body:    JSON.stringify({lang, uiScale, legendOrder, typeConfig, typeCounter, collapseState: Collapse.getAll(), customLoad}),
  }, 'save metadata').then(res => {
    if (res && res.ok === false) throw new Error('save metadata failed');
    return res;
  });
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

async function formApiCreate(data, isUnscheduled, sortOrder) {
  const res = await apiFetch(_formsUrl, {
    method:  'POST',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify({
      label:          data.label || '',
      date:           data.date  || '',
      is_unscheduled: isUnscheduled ? 1 : 0,
      sort_order:     sortOrder || 0,
    }),
  }, 'create form');
  if (!res.ok) throw new Error('create form failed');
  return res.json();
}

function formApiDelete(formId) {
  const url = _withToken(`/api/v2/forms/${formId}`);
  return apiFetch(url, { method: 'DELETE' }, 'delete form');
}

async function taskApiCreate(formId, name, metadata) {
  const res = await apiFetch(_tasksUrl, {
    method:  'POST',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify({ form_id: formId, name, metadata: metadata || {} }),
  }, 'create task');
  if (!res.ok) throw new Error('create task failed');
  return res.json();
}

function taskApiUpdate(taskId, data) {
  const url = _withToken(`/api/v2/tasks/${taskId}`);
  return apiFetch(url, {
    method:  'PUT',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify(data),
  }, 'update task');
}

function taskApiDelete(taskId) {
  const url = _withToken(`/api/v2/tasks/${taskId}`);
  return apiFetch(url, { method: 'DELETE' }, 'delete task');
}
