function deleteAccount(token) {
  return apiFetch(`/api/account?token=${encodeURIComponent(token)}`, { method: 'DELETE' }, 'deleteAccount');
}

const CREATE_SECRET = 'todies-create-secret';

function refreshToken(token) {
  return apiFetch(`/api/account/token?token=${encodeURIComponent(token)}`, { method: 'POST' }, 'refreshToken')
    .then(res => res.ok ? res.json().then(d => d.token) : Promise.reject(res.status));
}

function addAccount() {
  return apiFetch('/api/account', { method: 'POST', headers: { 'X-Create-Secret': CREATE_SECRET } }, 'addAccount')
    .then(res => res.json())
    .then(data => data.token);
}

// Negative ids for entities created optimistically before the server assigns a
// real (positive) one; shared so a temp task and temp column never collide.
let _tempIdSeq = -1;
const _tempId = () => _tempIdSeq--;

function apiFetch(url, options, label) {
  const t0 = performance.now();
  const method = (options && options.method) || 'GET';
  const path = url.split('?')[0];

  // Default page (no token): authenticated WRITES would be rejected, so skip the
  // network and return a synthetic success — writes "succeed" locally, the UI
  // sticks, and creates get a client-side temp id. This is the one place
  // token-awareness lives; mutation callers stay oblivious. GETs are left alone
  // so the initial load can still fail and fall back to the showcase.
  if (!_token && method !== 'GET') {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: _tempId() }) });
  }

  return fetch(url, options).then(res => {
    console.log(`[api] ${label}  ${method} ${path}  ${res.status}  ${(performance.now() - t0).toFixed(1)}ms`);
    return res;
  }).catch(err => {
    console.warn(`[api] ${label}  ${method} ${path}  ERROR  ${(performance.now() - t0).toFixed(1)}ms`, err);
    throw err;
  });
}
