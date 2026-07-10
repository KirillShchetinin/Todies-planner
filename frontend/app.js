const _t0 = performance.now();

// Mobile view toggle (matchMedia listener)
const _mobileMq = window.matchMedia('(max-width: 720px)');
function _applyMobileView(matches) {
  document.body.dataset.view = matches ? 'mobile' : 'desktop';
}
_mobileMq.addEventListener('change', e => { _applyMobileView(e.matches); render(); });
_applyMobileView(_mobileMq.matches);
console.log('[perf] scripts ready', '+0ms');

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (UndoHistory.pop()) render();
  }
});

const _metadataP = apiFetch(_metadataUrl, undefined, 'load metadata').then(r => r.ok ? r.json() : Promise.reject()).catch(() => { loadShowcase(); return null; });

_metadataP.then(userSettings => {
  if (!userSettings) return;
  lang        = userSettings.lang        || lang;
  uiScale     = userSettings.uiScale     || uiScale;
  customLoad  = !!userSettings.customLoad;
  customLoadActive = customLoad;   // freeze for the session; toggling won't change the view until refresh
  typeCounter = userSettings.typeCounter || typeCounter;
  const _builtinLabels = new Set(Object.values(DEFAULT_TYPE_CONFIG).map(t => t.label.toLowerCase()));
  const customCfg = Object.fromEntries(Object.entries(userSettings.typeConfig || {}).filter(([k, v]) =>
    k.startsWith('t-custom-') && !_builtinLabels.has(v.label?.toLowerCase())
  ));
  typeConfig  = {...structuredClone(DEFAULT_TYPE_CONFIG), ...customCfg};
  legendOrder = (userSettings.legendOrder || []).filter(k => k in typeConfig);
  for (const k of Object.keys(customCfg)) {
    if (!legendOrder.includes(k)) legendOrder.push(k);
  }
  if (!legendOrder.includes('Random')) legendOrder.unshift('Random');
  if (!legendOrder.length) legendOrder = [...DEFAULT_LEGEND_ORDER];
  Collapse.loadAll(userSettings.collapseState || {});
  applyScale(uiScale);
  applyLangToStaticUI();
  renderScaleBtns();
  renderCustomLoadBtn();
  render();
  console.log(`[perf] metadata applied +${(performance.now() - _t0).toFixed(1)}ms`);
  loadBoard();
});

// Forms/tasks fetching is specialized by customLoad, which lives in metadata,
// so it can only run after _metadataP resolves. OFF path is byte-for-byte
// today's behavior; ON path fetches all forms but only recent weeks' tasks.
function loadBoard() {
  if (customLoadActive) return loadBoardPartial();
  return loadBoardFull();
}

function loadBoardFull() {
  const formsP = apiFetch(_formsUrl, undefined, 'load forms').then(r => r.ok ? r.json() : null).catch(() => null);
  const tasksP = apiFetch(_tasksUrl, undefined, 'load tasks').then(r => r.ok ? r.json() : null).catch(() => null);

  formsP.then(formsData => {
    if (!formsData) return;
    applyFormsData(formsData);
    render();
    console.log(`[perf] forms applied +${(performance.now() - _t0).toFixed(1)}ms`);
  });

  Promise.all([formsP, tasksP]).then(async ([formsData, tasksData]) => {
    if (!formsData || !tasksData) return;
    applyTasksData(tasksData);
    await ensureTodayCol();
    await ensureUnscheduledForWeeks();
    render();
    console.log(`[perf] tasks applied +${(performance.now() - _t0).toFixed(1)}ms`);
  });
}

async function loadBoardPartial() {
  const formsData = await apiFetch(_formsUrl + (_token ? '&' : '?') + 'mark_recent=1', undefined, 'load forms').then(r => r.ok ? r.json() : null).catch(() => null);
  if (!formsData) return;
  applyFormsData(formsData);
  render();
  console.log(`[perf] forms applied +${(performance.now() - _t0).toFixed(1)}ms`);

  // Fetch tasks only for recent scheduled cols + all unscheduled containers.
  const initialIds = [
    ...cols.filter(c => c.recent).map(c => c.id),
    ...weekUnscheduled.map(u => u.id),
  ];
  const tasksData = initialIds.length
    ? await apiFetch(_tasksUrl + (_token ? '&' : '?') + `form_ids=${initialIds.join(',')}`, undefined, 'load tasks').then(r => r.ok ? r.json() : null).catch(() => null)
    : { tasks: [] };
  if (!tasksData) return;
  mergeTasksData(tasksData, initialIds);
  console.log(`[perf] partial tasks applied +${(performance.now() - _t0).toFixed(1)}ms`);

  await ensureTodayCol();
  await ensureUnscheduledForWeeks();
  render();
  console.log(`[perf] tasks applied +${(performance.now() - _t0).toFixed(1)}ms`);
}

document.getElementById('langBtn').addEventListener('click', () => {
  const prev = lang;
  pessimisticMeta(
    () => { lang = lang === 'en' ? 'ru' : 'en'; applyLangToStaticUI(); renderScaleBtns(); },
    () => { lang = prev; applyLangToStaticUI(); renderScaleBtns(); },
  );
});

function renderCustomLoadBtn() {
  const btn = document.getElementById('customLoadBtn');
  if (!btn) return;
  btn.textContent = customLoad ? t('on') : t('off');
  btn.setAttribute('aria-pressed', customLoad ? 'true' : 'false');
}

document.getElementById('customLoadBtn').addEventListener('click', () => {
  const prev = customLoad;
  pessimisticMeta(
    () => { customLoad = !customLoad; renderCustomLoadBtn(); },
    () => { customLoad = prev; renderCustomLoadBtn(); },
  );
});

const addDayBtn   = document.getElementById('addDayBtn');
const addDayForm  = document.getElementById('addDayForm');
const newDayLabel = document.getElementById('newDayLabel');
const newDayDate  = document.getElementById('newDayDate');

document.getElementById('addUnscheduledBtn').onclick = addUnscheduledCol;
addDayBtn.onclick = () => { addDayBtn.style.display='none'; addDayForm.classList.add('open'); newDayDate.focus(); };

const closeDay = () => {
  addDayBtn.style.display=''; addDayForm.classList.remove('open');
  newDayLabel.value=''; newDayDate.value='';
};

newDayDate.addEventListener('input', () => {
  const inferred = inferDay(newDayDate.value);
  if (inferred) newDayLabel.value = inferred;
});

document.getElementById('addDayCancel').onclick  = closeDay;
document.getElementById('addDayConfirm').onclick = () => {
  const l = newDayLabel.value, d = newDayDate.value;
  if (!l.trim()) return;
  addCol(l, d); closeDay();
};
[newDayLabel, newDayDate].forEach(inp => {
  inp.addEventListener('keydown', e => {
    if (e.key==='Enter')  document.getElementById('addDayConfirm').click();
    if (e.key==='Escape') closeDay();
  });
});
