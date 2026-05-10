let cols = [], weekUnscheduled = [], state = {}, typeCounter = 0, dragging = null, draggingCol = null;
let typeConfig  = structuredClone(DEFAULT_TYPE_CONFIG);
let legendOrder = [...DEFAULT_LEGEND_ORDER];
let uiScale = 1;

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

function saveMetadata() {
  apiFetch(_metadataUrl, {
    method:  'PUT',
    headers: {'Content-Type':'application/json'},
    body:    JSON.stringify({lang, uiScale, legendOrder, typeConfig, typeCounter, collapseState: Collapse.getAll()}),
  }, 'save metadata').catch(() => {});
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
  return apiFetch(url, { method: 'DELETE' }, 'delete form').catch(() => {});
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
  }, 'update task').catch(() => {});
}

function taskApiDelete(taskId) {
  const url = _withToken(`/api/v2/tasks/${taskId}`);
  return apiFetch(url, { method: 'DELETE' }, 'delete task').catch(() => {});
}
