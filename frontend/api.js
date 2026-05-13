function addAccount() {
  return apiFetch('/api/account', { method: 'POST' }, 'addAccount')
    .then(res => res.json())
    .then(data => data.token);
}

function apiFetch(url, options, label) {
  const t0 = performance.now();
  const method = (options && options.method) || 'GET';
  const path = url.split('?')[0];

  return fetch(url, options).then(res => {
    console.log(`[api] ${label}  ${method} ${path}  ${res.status}  ${(performance.now() - t0).toFixed(1)}ms`);
    return res;
  }).catch(err => {
    console.warn(`[api] ${label}  ${method} ${path}  ERROR  ${(performance.now() - t0).toFixed(1)}ms`, err);
    throw err;
  });
}
