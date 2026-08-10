// api.js — every HTTP call the client makes, and the token that authorises it.
//
// A user *is* a token in the URL: `resolve_user_id()` on the server turns
// `?token=…` into a user id, and there is no session or cookie layer. Nothing
// outside this file should build a request URL or call fetch().

const TOKEN = new URLSearchParams(window.location.search).get('token');
const withToken = path => TOKEN ? `${path}?token=${encodeURIComponent(TOKEN)}` : path;

const METADATA_URL = withToken('/api/v2/metadata');
const FORMS_URL    = withToken('/api/v2/forms');
const TASKS_URL    = withToken('/api/v2/tasks');

// Appends a query param to one of the URLs above, which may or may not
// already carry `?token=`.
const withParam = (url, param) => url + (TOKEN ? '&' : '?') + param;

// Negative ids for entities created optimistically before the server assigns a
// real (positive) one; shared so a temp task and temp column never collide.
let _tempIdSeq = -1;
const tempId = () => _tempIdSeq--;

function apiFetch(url, options, label) {
  const t0 = performance.now();
  const method = (options && options.method) || 'GET';
  const path = url.split('?')[0];

  // Default page (no token): authenticated data WRITES would be rejected, so skip
  // the network and return a synthetic success — writes "succeed" locally, the UI
  // sticks, and creates get a client-side temp id. This is the one place
  // token-awareness lives; mutation callers stay oblivious. GETs are left alone
  // so the initial load can still fail and fall back to the showcase. Account
  // endpoints (/api/account*) are excluded: creating an account is precisely the
  // write that has no token yet and must reach the server to mint one.
  if (!TOKEN && method !== 'GET' && path.startsWith('/api/v2/')) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: tempId() }) });
  }

  return fetch(url, options).then(res => {
    console.log(`[api] ${label}  ${method} ${path}  ${res.status}  ${(performance.now() - t0).toFixed(1)}ms`);
    return res;
  }).catch(err => {
    console.warn(`[api] ${label}  ${method} ${path}  ERROR  ${(performance.now() - t0).toFixed(1)}ms`, err);
    throw err;
  });
}

const _json = (body) => ({
  headers: {'Content-Type': 'application/json'},
  body:    JSON.stringify(body),
});

// ── account ───────────────────────────────────────────────────────────────

const CREATE_SECRET = 'todies-create-secret';

function addAccount() {
  return apiFetch('/api/account', { method: 'POST', headers: { 'X-Create-Secret': CREATE_SECRET } }, 'addAccount')
    .then(res => res.json())
    .then(data => data.token);
}

function refreshToken(token) {
  return apiFetch(`/api/account/token?token=${encodeURIComponent(token)}`, { method: 'POST' }, 'refreshToken')
    .then(res => res.ok ? res.json().then(d => d.token) : Promise.reject(res.status));
}

function deleteAccount(token) {
  return apiFetch(`/api/account?token=${encodeURIComponent(token)}`, { method: 'DELETE' }, 'deleteAccount');
}

// ── forms ─────────────────────────────────────────────────────────────────

async function formApiCreate(data, isUnscheduled, sortOrder) {
  const res = await apiFetch(FORMS_URL, {
    method: 'POST',
    ..._json({
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
  return apiFetch(withToken(`/api/v2/forms/${formId}`), { method: 'DELETE' }, 'delete form');
}

// ── tasks ─────────────────────────────────────────────────────────────────

async function taskApiCreate(formId, name, metadata) {
  const res = await apiFetch(TASKS_URL, {
    method: 'POST',
    ..._json({ form_id: formId, name, metadata: metadata || {} }),
  }, 'create task');
  if (!res.ok) throw new Error('create task failed');
  return res.json();
}

function taskApiUpdate(taskId, data) {
  return apiFetch(withToken(`/api/v2/tasks/${taskId}`), { method: 'PUT', ..._json(data) }, 'update task');
}

function taskApiDelete(taskId) {
  return apiFetch(withToken(`/api/v2/tasks/${taskId}`), { method: 'DELETE' }, 'delete task');
}

// Resolves to the content, or '' when it cannot be read (no token, 404).
function taskApiGetContent(taskId) {
  return apiFetch(withToken(`/api/v2/tasks/${taskId}/content`), undefined, 'get task content')
    .then(res => res.ok ? res.json().then(d => d.content || '') : '')
    .catch(() => '');
}

function taskApiSetContent(taskId, content) {
  return apiFetch(withToken(`/api/v2/tasks/${taskId}/content`), { method: 'PUT', ..._json({ content }) }, 'set task content');
}
