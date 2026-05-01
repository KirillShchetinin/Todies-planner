const _t0 = performance.now();
console.log('[perf] scripts ready', '+0ms');

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (UndoHistory.pop()) { saveState(); render(); }
  }
});

loadState().then(() => {
  const tAfterFetch = performance.now();
  console.log(`[perf] loadState done +${(tAfterFetch - _t0).toFixed(1)}ms`);
  applyScale(uiScale);
  applyLangToStaticUI();
  const tBeforeRender = performance.now();
  render();
  const tAfterRender = performance.now();
  console.log(`[perf] render done  +${(tAfterRender - _t0).toFixed(1)}ms  (render itself: ${(tAfterRender - tBeforeRender).toFixed(1)}ms)`);
  requestAnimationFrame(() => {
    console.log(`[perf] first paint  +${(performance.now() - _t0).toFixed(1)}ms`);
  });
  renderScaleBtns();
});

document.getElementById('langBtn').addEventListener('click', () => {
  lang = lang === 'en' ? 'ru' : 'en';
  saveState();
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
