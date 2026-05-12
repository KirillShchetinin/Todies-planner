const _t0 = performance.now();
console.log('[perf] scripts ready', '+0ms');

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (UndoHistory.pop()) render();
  }
});

const _metadataP = apiFetch(_metadataUrl, undefined, 'load metadata').then(r => r.ok ? r.json() : Promise.reject()).catch(() => { loadShowcase(); return null; });
const _formsP    = apiFetch(_formsUrl,    undefined, 'load forms')   .then(r => r.json()).catch(() => null);
const _tasksP    = apiFetch(_tasksUrl,    undefined, 'load tasks')   .then(r => r.json()).catch(() => null);

_metadataP.then(userSettings => {
  if (!userSettings) return;
  lang        = userSettings.lang        || lang;
  uiScale     = userSettings.uiScale     || uiScale;
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
  render();
  console.log(`[perf] metadata applied +${(performance.now() - _t0).toFixed(1)}ms`);
});

_formsP.then(formsData => {
  if (!formsData) return;
  applyFormsData(formsData);
  render();
  console.log(`[perf] forms applied +${(performance.now() - _t0).toFixed(1)}ms`);
});

Promise.all([_formsP, _tasksP]).then(async ([formsData, tasksData]) => {
  if (!formsData || !tasksData) return;
  applyTasksData(tasksData);
  await ensureUnscheduledForWeeks();
  render();
  console.log(`[perf] tasks applied +${(performance.now() - _t0).toFixed(1)}ms`);
});

document.getElementById('langBtn').addEventListener('click', () => {
  lang = lang === 'en' ? 'ru' : 'en';
  saveMetadata();
  applyLangToStaticUI();
  render();
  renderScaleBtns();
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
