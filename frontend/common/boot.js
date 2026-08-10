// boot.js — application start-up. Loads last, after every layer has defined
// itself and registered its view.
//
// Three staged phases, each re-rendering as its data lands:
//   1. metadata  — lang, scale, collapse state, types. If this fetch fails
//                  loadShowcase() paints the demo board an anonymous visitor
//                  to `/` sees.
//   2. forms + tasks — cannot start earlier because it branches on
//                  `customLoad`, which lives in metadata.
//   3. self-heal — create today's column and any missing per-week unscheduled
//                  container, then render once more.

const _t0 = performance.now();
console.log('[perf] scripts ready', '+0ms');

// Global shortcut: undo the last mutation (max 10 deep), unless the user is
// typing into a field.
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (UndoHistory.pop()) render();
  }
});

const _metadataP = apiFetch(METADATA_URL, undefined, 'load metadata')
  .then(r => r.ok ? r.json() : Promise.reject())
  .catch(() => { loadShowcase(); return null; });

_metadataP.then(userSettings => {
  if (!userSettings) return;
  applyUserSettings(userSettings);
  applyScale(currentScale());
  applyLangToStaticUI();
  renderScaleBtns();
  renderCustomLoadBtn();
  render();
  console.log(`[perf] metadata applied +${(performance.now() - _t0).toFixed(1)}ms`);
  loadBoard();
});

// Folds the saved metadata blob into the live globals. Custom types are merged
// OVER the built-ins, so a new built-in in constants.js reaches existing users
// and a custom type whose label collides with a built-in is dropped.
function applyUserSettings(userSettings) {
  lang        = userSettings.lang        || lang;
  uiScale     = userSettings.uiScale     || uiScale;
  // Pre-split accounts have no uiScaleMobile — seed it from the shared value so
  // the mobile view keeps the size the user already had.
  uiScaleMobile = userSettings.uiScaleMobile || userSettings.uiScale || uiScaleMobile;
  customLoad  = !!userSettings.customLoad;
  customLoadActive = customLoad;   // freeze for the session; toggling won't change the view until refresh
  typeCounter = userSettings.typeCounter || typeCounter;

  const builtinLabels = new Set(Object.values(DEFAULT_TYPE_CONFIG).map(t => t.label.toLowerCase()));
  const customCfg = Object.fromEntries(Object.entries(userSettings.typeConfig || {}).filter(([k, v]) =>
    k.startsWith('t-custom-') && !builtinLabels.has(v.label?.toLowerCase())
  ));
  typeConfig  = {...structuredClone(DEFAULT_TYPE_CONFIG), ...customCfg};
  legendOrder = (userSettings.legendOrder || []).filter(k => k in typeConfig);
  for (const k of Object.keys(customCfg)) {
    if (!legendOrder.includes(k)) legendOrder.push(k);
  }
  if (!legendOrder.includes('Random')) legendOrder.unshift('Random');
  if (!legendOrder.length) legendOrder = [...DEFAULT_LEGEND_ORDER];

  Collapse.loadAll(userSettings.collapseState || {});
}

// OFF path fetches everything; ON path fetches all forms (they're tiny) but
// only recent weeks' tasks.
function loadBoard() {
  return customLoadActive ? loadBoardPartial() : loadBoardFull();
}

function loadBoardFull() {
  const formsP = apiFetch(FORMS_URL, undefined, 'load forms').then(r => r.ok ? r.json() : null).catch(() => null);
  const tasksP = apiFetch(TASKS_URL, undefined, 'load tasks').then(r => r.ok ? r.json() : null).catch(() => null);

  formsP.then(formsData => {
    if (!formsData) return;
    applyFormsData(formsData);
    render();
    console.log(`[perf] forms applied +${(performance.now() - _t0).toFixed(1)}ms`);
  });

  return Promise.all([formsP, tasksP]).then(async ([formsData, tasksData]) => {
    if (!formsData || !tasksData) return;
    applyTasksData(tasksData);
    await _selfHeal();
  });
}

async function loadBoardPartial() {
  const formsData = await apiFetch(withParam(FORMS_URL, 'mark_recent=1'), undefined, 'load forms')
    .then(r => r.ok ? r.json() : null).catch(() => null);
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
    ? await apiFetch(withParam(TASKS_URL, `form_ids=${initialIds.join(',')}`), undefined, 'load tasks')
        .then(r => r.ok ? r.json() : null).catch(() => null)
    : { tasks: [] };
  if (!tasksData) return;
  mergeTasksData(tasksData, initialIds);
  console.log(`[perf] partial tasks applied +${(performance.now() - _t0).toFixed(1)}ms`);

  await _selfHeal();
}

async function _selfHeal() {
  await ensureTodayCol();
  await ensureUnscheduledForWeeks();
  render();
  console.log(`[perf] tasks applied +${(performance.now() - _t0).toFixed(1)}ms`);
}
