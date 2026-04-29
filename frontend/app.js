// ── constants ─────────────────────────────────────────────────────────────────

const DEFAULT_COLS = [
  {id:'mon',    label:'Mon',       date:'04/20'},
  {id:'tue',    label:'Tue',       date:'04/21'},
  {id:'wed',    label:'Wed',       date:'04/22'},
  {id:'thu',    label:'Thu',       date:'04/23'},
  {id:'fri',    label:'Fri',       date:'04/24'},
  {id:'sat',    label:'Sat',       date:'04/25'},
  {id:'sun',    label:'Sun',       date:'04/26'},
  {id:'nxtwed', label:'Next Wed+', date:'04/29+'},
];

// one unscheduled col per week row, indexed by week index
const DEFAULT_WEEK_UNSCHEDULED = [
  {id:'unscheduled', label:'Unscheduled'},
  {id:'unscheduled_w1', label:'Unscheduled'},
];

const INIT_TASKS = [
  {id:'t1',  text:'Bloomberg interview 12pm', type:'t-locked',    col:'tue',         locked:true},
  {id:'t2',  text:'InterviewingIO 8:30pm',    type:'t-locked',    col:'tue',         locked:true},
  {id:'t3',  text:'Uber recruiter 10am',       type:'t-locked',    col:'wed',         locked:true},
  {id:'t4',  text:'Spanish 4pm (last class)',  type:'t-locked',    col:'wed',         locked:true},
  {id:'t5',  text:'Reply Lara Peterson',       type:'t-async',     col:'mon'},
  {id:'t6',  text:'Check Olivia startups',     type:'t-async',     col:'mon'},
  {id:'t7',  text:'Send resume IBKR',          type:'t-async',     col:'mon'},
  {id:'t8',  text:'Send resume James',         type:'t-async',     col:'fri'},
  {id:'t9',  text:'Bloomberg prep call',       type:'t-interview', col:'unscheduled'},
  {id:'t10', text:'Vaneveer behavioral',       type:'t-interview', col:'unscheduled'},
  {id:'t11', text:'Bloomberg Buy-Side x2',     type:'t-interview', col:'nxtwed'},
  {id:'t12', text:'Optiver phone screen',      type:'t-interview', col:'nxtwed'},
  {id:'t13', text:'Doordash coding screen',    type:'t-interview', col:'nxtwed'},
  {id:'t14', text:'Amazon SDE2 OA',            type:'t-interview', col:'tue'},
  {id:'t15', text:'Highland Tech C++ OA',      type:'t-interview', col:'sat'},
  {id:'t16', text:'Taxes - Fidelity PDFs',     type:'t-tax',       col:'mon'},
  {id:'t17', text:'Taxes - investments',       type:'t-tax',       col:'wed'},
  {id:'t18', text:'Taxes - finalize + Q1',     type:'t-tax',       col:'thu'},
  {id:'t19', text:'C++ practice',              type:'t-practice',  col:'thu'},
  {id:'t20', text:'System design prep',        type:'t-practice',  col:'fri'},
  {id:'t21', text:'Check Prampt',              type:'t-practice',  col:'sun'},
  {id:'t22', text:'Car inspection',            type:'t-async',     col:'thu'},
  {id:'t23', text:'Rest / recover',            type:'t-rest',      col:'mon'},
];

const DEFAULT_TYPE_CONFIG = {
  't-locked':    { label:'locked',    bg:'#e8f0fa', border:'#b5cff0', text:'#1a4a8a' },
  't-interview': { label:'interview', bg:'#eeecfb', border:'#cbc6f0', text:'#3c3489' },
  't-tax':       { label:'taxes',     bg:'#fdf3dc', border:'#f5d98a', text:'#7a4800' },
  't-practice':  { label:'practice',  bg:'#eaf6ee', border:'#a8ddb8', text:'#1a5c30' },
  't-async':     { label:'async',     bg:'#f2f2f0', border:'#d8d8d4', text:'#444444' },
  't-rest':      { label:'rest',      bg:'#fdecea', border:'#f5bdb8', text:'#8a2020' },
  't-unplanned': { label:'unplanned', bg:'#f4f4f2', border:'#c4c4be', text:'#888888', dashed:true, italic:true },
  'done':        { label:'done',      bg:'#f5f5f5', border:'#dddddd', text:'#bbbbbb' },
};
const DEFAULT_LEGEND_ORDER = ['t-locked','t-interview','t-tax','t-practice','t-async','t-rest','t-unplanned','done'];

const COLOR_PRESETS = [
  { bg:'#e8f0fa', border:'#b5cff0', text:'#1a4a8a' },
  { bg:'#eeecfb', border:'#cbc6f0', text:'#3c3489' },
  { bg:'#fdf3dc', border:'#f5d98a', text:'#7a4800' },
  { bg:'#eaf6ee', border:'#a8ddb8', text:'#1a5c30' },
  { bg:'#f2f2f0', border:'#d8d8d4', text:'#444444' },
  { bg:'#fdecea', border:'#f5bdb8', text:'#8a2020' },
  { bg:'#e0f5f5', border:'#90d0d0', text:'#1a5555' },
  { bg:'#fef0e6', border:'#f5c895', text:'#7a3000' },
  { bg:'#fceaf4', border:'#e8b0d8', text:'#6a1a4a' },
  { bg:'#f4f4f2', border:'#c4c4be', text:'#888888' },
];

// ── state ─────────────────────────────────────────────────────────────────────

let cols = [], weekUnscheduled = [], state = {}, idCounter = 100, colCounter = 200, typeCounter = 0, dragging = null, draggingCol = null;
let typeConfig  = structuredClone(DEFAULT_TYPE_CONFIG);
let legendOrder = [...DEFAULT_LEGEND_ORDER];
let uiScale = 1;

const UI_SCALES = [0.75, 0.875, 1, 1.125, 1.25];

function applyScale(scale) {
  uiScale = scale;
  document.documentElement.style.setProperty('--ui-scale', scale);
  document.querySelectorAll('.scale-btn').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.scale) === scale);
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseDateToSortKey(dateStr) {
  if (!dateStr) return Infinity;
  const base = dateStr.replace(/\+$/, '');
  const m = base.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return Infinity;
  const yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
  return yr * 10000 + parseInt(m[1]) * 100 + parseInt(m[2]);
}

function sortColsByDate() {
  cols.sort((a, b) => parseDateToSortKey(a.date) - parseDateToSortKey(b.date));
}

function inferDay(dateStr) {
  const m = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return '';
  const yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
  const d  = new Date(yr, parseInt(m[1]) - 1, parseInt(m[2]));
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', {weekday:'short'});
}

function applyTaskStyle(el, type, done) {
  const cfg = typeConfig[type] || typeConfig['t-async'] || {bg:'#f2f2f0', border:'#d8d8d4', text:'#444'};
  el.style.background  = cfg.bg;
  el.style.borderColor = cfg.border;
  el.style.color       = cfg.text;
  el.style.borderStyle = (!done && cfg.dashed) ? 'dashed' : 'solid';
  el.style.fontStyle   = (!done && cfg.italic)  ? 'italic' : '';
  el.style.opacity     = done ? '0.45' : '';
}

// ── persistence ───────────────────────────────────────────────────────────────

async function loadState() {
  try {
    const res   = await fetch('/api/state');
    const saved = await res.json();
    if (saved) {
      // migrate: if cols still contains unscheduled entries, pull them out
      const rawCols = saved.cols || [];
      cols           = rawCols.filter(c => c.id !== 'unscheduled' && !c.unscheduled);
      const oldUnsched = rawCols.filter(c => c.id === 'unscheduled' || c.unscheduled);
      weekUnscheduled = saved.weekUnscheduled || oldUnsched.map(c => ({id: c.id, label: 'Unscheduled'}));
      state       = saved.state;
      idCounter   = saved.idCounter   || 100;
      colCounter  = saved.colCounter  || 200;
      typeCounter = saved.typeCounter || 0;
      legendOrder = saved.legendOrder || [...DEFAULT_LEGEND_ORDER];
      typeConfig  = saved.typeConfig
        ? {...structuredClone(DEFAULT_TYPE_CONFIG), ...saved.typeConfig}
        : structuredClone(DEFAULT_TYPE_CONFIG);
      uiScale     = saved.uiScale     || 1;
      Collapse.loadAll(saved.collapseState);
      Object.values(typeConfig).forEach(cfg => delete cfg.fixed);
      ensureWeekUnscheduled();
      sortColsByDate();
      return;
    }
  } catch(e) {}
  cols  = DEFAULT_COLS.map(c => ({...c}));
  weekUnscheduled = DEFAULT_WEEK_UNSCHEDULED.map(c => ({...c}));
  state = {};
  INIT_TASKS.forEach(t => { if (!state[t.col]) state[t.col]=[]; state[t.col].push({...t}); });
}

// ensure weekUnscheduled has exactly one entry per week row
function ensureWeekUnscheduled() {
  const weekCount = Math.max(1, Math.ceil(cols.length / 7));
  while (weekUnscheduled.length < weekCount) {
    weekUnscheduled.push({id: 'unsched_w' + (colCounter++), label: 'Unscheduled'});
  }
}

function saveState() {
  fetch('/api/state', {
    method:  'PUT',
    headers: {'Content-Type':'application/json'},
    body:    JSON.stringify({cols, weekUnscheduled, state, idCounter, colCounter, typeCounter, typeConfig, legendOrder, uiScale, collapseState: Collapse.getAll()}),
  }).catch(() => {});
}

// ── label ops ─────────────────────────────────────────────────────────────────

function addLabel(name, colors) {
  const key = 't-custom-' + (typeCounter++);
  typeConfig[key] = { label: name.trim(), ...colors };
  const doneIdx = legendOrder.indexOf('done');
  legendOrder.splice(doneIdx < 0 ? legendOrder.length : doneIdx, 0, key);
  saveState(); render();
}

function deleteLabel(key) {
  delete typeConfig[key];
  legendOrder = legendOrder.filter(k => k !== key);
  allCols().forEach(c => { (state[c.id]||[]).forEach(t => { if (t.type===key) t.type='t-async'; }); });
  saveState(); render();
}

function renameLabel(key, newName) {
  if (!typeConfig[key] || !newName.trim()) return;
  typeConfig[key].label = newName.trim();
  saveState(); render();
}

function recolorLabel(key, colors) {
  if (!typeConfig[key]) return;
  Object.assign(typeConfig[key], colors);
  saveState(); render();
}

// ── context menu ──────────────────────────────────────────────────────────────

const ctxMenu = document.createElement('div');
ctxMenu.id = 'ctxMenu';
document.body.appendChild(ctxMenu);
let ctxKey = null;

function openTaskCtxMenu(e, taskId) {
  e.preventDefault();
  ctxKey = null;

  let task = null;
  allCols().forEach(c => { (state[c.id]||[]).forEach(t => { if (t.id === taskId) task = t; }); });

  ctxMenu.innerHTML = '';

  const impBtn = document.createElement('button');
  impBtn.className = 'ctx-item ctx-important-item';
  impBtn.textContent = task?.important ? '! unmark important' : '! mark important';
  impBtn.onclick = () => {
    allCols().forEach(c => { (state[c.id]||[]).forEach(t => { if (t.id === taskId) t.important = !t.important; }); });
    saveState(); closeCtxMenu(); render();
  };
  ctxMenu.appendChild(impBtn);

  const sep = document.createElement('div');
  sep.className = 'ctx-sep';
  ctxMenu.appendChild(sep);

  const heading = document.createElement('div');
  heading.className = 'ctx-heading';
  heading.textContent = 'change type';
  ctxMenu.appendChild(heading);

  const sep2 = document.createElement('div');
  sep2.className = 'ctx-sep';
  ctxMenu.appendChild(sep2);

  legendOrder.filter(k => k !== 'done').forEach(key => {
    const cfg = typeConfig[key];
    if (!cfg) return;
    const btn = document.createElement('button');
    btn.className = 'ctx-item ctx-type-item';
    btn.style.cssText = `border-left: 3px solid ${cfg.border}`;
    btn.textContent = cfg.label;
    btn.onclick = () => {
      allCols().forEach(c => { (state[c.id]||[]).forEach(t => { if (t.id === taskId) t.type = key; }); });
      saveState(); closeCtxMenu(); render();
    };
    ctxMenu.appendChild(btn);
  });

  ctxMenu.style.display = 'block';
  const mw = ctxMenu.offsetWidth, mh = ctxMenu.offsetHeight;
  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth  - mw - 8) + 'px';
  ctxMenu.style.top  = Math.min(e.clientY, window.innerHeight - mh - 8) + 'px';
}

function openCtxMenu(e, key) {
  e.preventDefault();
  ctxKey = key;
  const cfg = typeConfig[key] || {};

  ctxMenu.innerHTML = `
    <button class="ctx-item" id="ctxRename">rename</button>
    <div class="ctx-sep"></div>
    <div class="ctx-colors" id="ctxColors"></div>
    <div class="ctx-sep"></div><button class="ctx-item ctx-delete" id="ctxDelete">delete</button>
  `;

  ctxMenu.querySelector('#ctxRename').onclick = () => {
    const key = ctxKey;
    closeCtxMenu();
    const n = prompt('New name:', typeConfig[key]?.label || key);
    if (n) renameLabel(key, n);
  };
  const delBtn = ctxMenu.querySelector('#ctxDelete');
  if (delBtn) delBtn.onclick = () => { const key = ctxKey; closeCtxMenu(); deleteLabel(key); };

  const grid = ctxMenu.querySelector('#ctxColors');
  COLOR_PRESETS.forEach(preset => {
    const sw = document.createElement('button');
    sw.className = 'ctx-swatch';
    sw.style.cssText = `background:${preset.bg};border-color:${preset.border}`;
    sw.onclick = () => { recolorLabel(ctxKey, preset); closeCtxMenu(); };
    grid.appendChild(sw);
  });

  ctxMenu.style.display = 'block';
  const mw = ctxMenu.offsetWidth, mh = ctxMenu.offsetHeight;
  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth  - mw - 8) + 'px';
  ctxMenu.style.top  = Math.min(e.clientY, window.innerHeight - mh - 8) + 'px';
}

function closeCtxMenu() { ctxMenu.style.display = 'none'; ctxKey = null; }

document.addEventListener('click',   closeCtxMenu);
document.addEventListener('keydown', e => { if (e.key==='Escape') { closeCtxMenu(); closeAddPanel(); } });

// ── add label panel ───────────────────────────────────────────────────────────

const addPanel = document.createElement('div');
addPanel.id = 'addLabelPanel';
addPanel.innerHTML = `
  <p class="add-panel-title">new label</p>
  <input id="newLabelName" type="text" placeholder="label name..." maxlength="20" />
  <div class="ctx-colors" id="addPanelColors"></div>
  <div class="add-form-btns" style="margin-top:8px">
    <button class="btn-confirm" id="newLabelConfirm">add</button>
    <button class="btn-cancel"  id="newLabelCancel">cancel</button>
  </div>
`;
document.body.appendChild(addPanel);

let selectedPreset = COLOR_PRESETS[4];

function openAddPanel() {
  const grid = addPanel.querySelector('#addPanelColors');
  grid.innerHTML = '';
  COLOR_PRESETS.forEach(preset => {
    const sw = document.createElement('button');
    sw.className = 'ctx-swatch' + (preset === selectedPreset ? ' selected' : '');
    sw.style.cssText = `background:${preset.bg};border-color:${preset.border}`;
    sw.onclick = () => {
      selectedPreset = preset;
      grid.querySelectorAll('.ctx-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    };
    grid.appendChild(sw);
  });
  addPanel.style.display = 'block';
  addPanel.querySelector('#newLabelName').value = '';
  addPanel.querySelector('#newLabelName').focus();
}

function closeAddPanel() { addPanel.style.display = 'none'; }

addPanel.querySelector('#newLabelCancel').onclick  = closeAddPanel;
addPanel.querySelector('#newLabelConfirm').onclick = () => {
  const name = addPanel.querySelector('#newLabelName').value.trim();
  if (!name) return;
  addLabel(name, selectedPreset);
  closeAddPanel();
};
addPanel.querySelector('#newLabelName').addEventListener('keydown', e => {
  if (e.key === 'Enter')  addPanel.querySelector('#newLabelConfirm').click();
  if (e.key === 'Escape') closeAddPanel();
});

// ── legend ────────────────────────────────────────────────────────────────────

function renderLegend() {
  const el = document.getElementById('legend');
  el.innerHTML = '';

  legendOrder.forEach(key => {
    const cfg = typeConfig[key];
    if (!cfg) return;

    const pill = document.createElement('span');
    pill.className = 'leg';
    pill.style.cssText = `background:${cfg.bg};border-color:${cfg.border};color:${cfg.text}`;

    const name = document.createElement('span');
    name.textContent = cfg.label;
    pill.appendChild(name);

    const x = document.createElement('button');
    x.className = 'leg-del';
    x.textContent = '×';
    x.onclick = ev => { ev.stopPropagation(); deleteLabel(key); };
    pill.appendChild(x);

    pill.addEventListener('contextmenu', e => openCtxMenu(e, key));
    el.appendChild(pill);
  });

  const addBtn = document.createElement('button');
  addBtn.className   = 'leg-add';
  addBtn.textContent = '+ label';
  addBtn.onclick     = ev => { ev.stopPropagation(); openAddPanel(); };
  el.appendChild(addBtn);
}

// ── board ─────────────────────────────────────────────────────────────────────

function buildColEl(col) {
    const isUnscheduled = col.id === 'unscheduled' || col.unscheduled || weekUnscheduled.some(u => u.id === col.id);
    const colEl = document.createElement('div');
    colEl.className = 'col' + (isUnscheduled ? ' unscheduled' : '');
    colEl.draggable = !isUnscheduled;
    colEl.addEventListener('dragstart', e => {
      if (e.target.closest('.task,.add-btn,.add-form')) return;
      draggingCol = col.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => colEl.style.opacity = '0.4', 0);
    });
    colEl.addEventListener('dragend', () => {
      draggingCol = null; colEl.style.opacity = '';
      document.querySelectorAll('.col').forEach(c => c.classList.remove('col-drag-over'));
    });
    colEl.addEventListener('dragover', e => {
      if (!draggingCol || draggingCol === col.id) return;
      e.preventDefault(); e.stopPropagation();
      document.querySelectorAll('.col').forEach(c => c.classList.remove('col-drag-over'));
      colEl.classList.add('col-drag-over');
    });
    colEl.addEventListener('drop', e => {
      if (!draggingCol || draggingCol === col.id) return;
      e.preventDefault(); e.stopPropagation();
      document.querySelectorAll('.col').forEach(c => c.classList.remove('col-drag-over'));
      const from = cols.findIndex(c => c.id === draggingCol);
      const to   = cols.findIndex(c => c.id === col.id);
      if (from > -1 && to > -1) { const [m] = cols.splice(from, 1); cols.splice(to, 0, m); saveState(); }
      draggingCol = null; render();
    });

    const hdr  = document.createElement('div');
    hdr.className = 'col-header';
    const left = document.createElement('div');
    left.className = 'col-header-left';
    left.innerHTML = `<span>${col.label}</span>` + (col.date ? `<span class="date">${col.date}</span>` : '');
    hdr.appendChild(left);
    {
      const dc = document.createElement('button');
      dc.className = 'del-col'; dc.textContent = '×'; dc.title = 'remove column';
      dc.onclick = () => deleteCol(col.id);
      hdr.appendChild(dc);
    }

    // click header to collapse/expand; distinguish from drag via mousedown pos
    let hdrMouseX = 0, hdrMouseY = 0;
    hdr.addEventListener('mousedown', e => { hdrMouseX = e.clientX; hdrMouseY = e.clientY; });
    hdr.addEventListener('mouseup', e => {
      if (e.target.closest('.del-col')) return;
      const dx = Math.abs(e.clientX - hdrMouseX), dy = Math.abs(e.clientY - hdrMouseY);
      if (dx >= 5 || dy >= 5) return;
      if (Collapse.toggle(col.id, state)) render();
    });

    colEl.appendChild(hdr);

    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.dataset.col = col.id;

    (state[col.id]||[]).forEach(task => {
      const el = document.createElement('div');
      el.className = 'task' + (task.done ? ' done' : '');
      el.dataset.id = task.id;
      applyTaskStyle(el, task.type, task.done);

      if (task.important) {
        const imp = document.createElement('span');
        imp.className = 'task-important';
        imp.textContent = '!';
        el.appendChild(imp);
      }

      const txt = document.createElement('span');
      txt.className = 'task-text';
      txt.textContent = task.text;
      el.appendChild(txt);

      {
        const actions = document.createElement('div');
        actions.className = 'task-actions';

        const chk = document.createElement('button');
        chk.className   = 'check';
        chk.textContent = task.done ? '✓' : '○';
        chk.onclick = e => { e.stopPropagation(); toggleDone(task.id); };
        actions.appendChild(chk);

        const del = document.createElement('button');
        del.className = 'del'; del.textContent = '×';
        del.onclick = e => { e.stopPropagation(); deleteTask(task.id); };
        actions.appendChild(del);

        el.appendChild(actions);
        el.addEventListener('contextmenu', e => openTaskCtxMenu(e, task.id));
        el.addEventListener('dblclick', () => toggleDone(task.id));
        el.draggable = true;


        el.addEventListener('dragstart', e => {
          e.stopPropagation();
          dragging = task.id;
          e.dataTransfer.effectAllowed = 'move';
          setTimeout(() => el.style.opacity = '0.4', 0);
        });
        el.addEventListener('dragend', () => {
          dragging = null; el.style.opacity = '';
          document.querySelectorAll('.task').forEach(t => t.classList.remove('insert-before','insert-after'));
          document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over'));
        });

        // within-column drag positioning indicator
        el.addEventListener('dragover', e => {
          if (!dragging || dragging === task.id) return;
          e.preventDefault(); e.stopPropagation();
          const mid = el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2;
          document.querySelectorAll('.task').forEach(t => t.classList.remove('insert-before','insert-after'));
          el.classList.toggle('insert-before', e.clientY < mid);
          el.classList.toggle('insert-after',  e.clientY >= mid);
          zone.classList.remove('drag-over');
        });
        el.addEventListener('dragleave', () => el.classList.remove('insert-before','insert-after'));
      }
      zone.appendChild(el);
    });

    // drop on zone (append) or on a task (insert at position)
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      // only highlight zone if not hovering over a task
      if (!e.target.closest('.task')) zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      document.querySelectorAll('.task').forEach(t => t.classList.remove('insert-before','insert-after'));
      if (!dragging) return;

      const tc = zone.dataset.col;
      const targetEl = e.target.closest('.task[data-id]');

      // find and remove from source
      let task = null;
      allCols().forEach(c => {
        if (!state[c.id]) return;
        const i = state[c.id].findIndex(t => t.id === dragging);
        if (i > -1) task = state[c.id].splice(i, 1)[0];
      });
      if (!task) return;

      task.col = tc;
      if (!state[tc]) state[tc] = [];

      if (targetEl && targetEl.dataset.id !== task.id) {
        const rect     = targetEl.getBoundingClientRect();
        const before   = e.clientY < rect.top + rect.height / 2;
        const targetId = targetEl.dataset.id;
        const idx      = state[tc].findIndex(t => t.id === targetId);
        state[tc].splice(before ? idx : idx + 1, 0, task);
      } else {
        state[tc].push(task);
      }

      saveState(); render();
    });

    colEl.appendChild(zone);

    // add task form — step 1: type picker, step 2: name input
    const addBtn = document.createElement('button');
    addBtn.className   = 'add-btn';
    addBtn.textContent = '+ add task';

    const form = document.createElement('div');
    form.className = 'add-form';

    const dropKeys = legendOrder.filter(k => k !== 't-locked' && k !== 'done');

    // step 1: type pills
    const typePicker = document.createElement('div');
    typePicker.className = 'add-type-picker';
    dropKeys.forEach(k => {
      const cfg = typeConfig[k] || {};
      const pill = document.createElement('button');
      pill.className = 'add-type-pill';
      pill.textContent = cfg.label || k;
      pill.style.cssText = `background:${cfg.bg};border-color:${cfg.border};color:${cfg.text};`;
      if (cfg.dashed) pill.style.borderStyle = 'dashed';
      pill.dataset.type = k;
      typePicker.appendChild(pill);
    });

    // step 2: name input row
    const nameRow = document.createElement('div');
    nameRow.className = 'add-name-row';
    nameRow.innerHTML = `<input type="text" placeholder="task name…" maxlength="60"/>`;

    form.appendChild(typePicker);
    form.appendChild(nameRow);
    nameRow.style.display = 'none';

    let selectedType = null;

    const reset = () => {
      addBtn.style.display = '';
      form.classList.remove('open');
      typePicker.style.display = '';
      nameRow.style.display = 'none';
      const input = nameRow.querySelector('input');
      input.value = '';
      input.style.cssText = '';
      selectedType = null;
    };

    addBtn.onclick = () => {
      addBtn.style.display = 'none';
      form.classList.add('open');
    };

    typePicker.addEventListener('click', e => {
      const pill = e.target.closest('.add-type-pill');
      if (!pill) return;
      selectedType = pill.dataset.type;
      const cfg = typeConfig[selectedType] || {};
      typePicker.style.display = 'none';
      const input = nameRow.querySelector('input');
      input.style.cssText = `background:${cfg.bg};border-color:${cfg.border};color:${cfg.text};`;
      nameRow.style.display = 'flex';
      input.focus();
    });

    const doAdd = () => {
      if (!selectedType) return;
      addTask(col.id, nameRow.querySelector('input').value, selectedType);
      reset();
    };

    nameRow.querySelector('input').addEventListener('keydown', e => {
      if (e.key === 'Enter') doAdd();
      if (e.key === 'Escape') reset();
    });

    // clicking outside the form resets it
    document.addEventListener('click', e => {
      if (form.classList.contains('open') && !form.contains(e.target) && e.target !== addBtn) reset();
    }, { capture: true });

    colEl.appendChild(addBtn);
    colEl.appendChild(form);

    if (Collapse.isShort(col.id)) {
      Collapse.applyShort(colEl, zone, state[col.id] || [], typeConfig);
    }

    return colEl;
}

function render() {
  renderLegend();

  const board = document.getElementById('board');
  board.innerHTML = '';

  ensureWeekUnscheduled();

  const WEEK = 7;
  const weekCount = Math.max(1, Math.ceil(cols.length / WEEK));

  for (let wi = 0; wi < weekCount; wi++) {
    const weekDays = cols.slice(wi * WEEK, (wi + 1) * WEEK);
    const unschedCol = weekUnscheduled[wi];

    const weekRow = document.createElement('div');
    weekRow.className = 'week-row';

    // exactly one unscheduled bar per week row
    const bar = document.createElement('div');
    bar.className = 'unscheduled-bar';
    bar.appendChild(buildColEl(unschedCol));
    weekRow.appendChild(bar);

    // day columns grid
    const daysGrid = document.createElement('div');
    daysGrid.className = 'week-days';
    weekDays.forEach(col => daysGrid.appendChild(buildColEl(col)));

    // ghost placeholder in the last week row only
    if (wi === weekCount - 1) {
      const ghost = document.createElement('div');
      ghost.className = 'col-ghost';
      ghost.title = 'Double-click to add next day';
      ghost.addEventListener('dblclick', e => { e.stopPropagation(); addNextDay(); });
      daysGrid.appendChild(ghost);
    }

    weekRow.appendChild(daysGrid);
    board.appendChild(weekRow);
  }
}

// ── task / col ops ────────────────────────────────────────────────────────────

function addTask(colId, text, type) {
  if (!text.trim()) return;
  if (!state[colId]) state[colId] = [];
  state[colId].push({id:'u'+(idCounter++), text:text.trim(), type, col:colId, locked:false, done:false});
  saveState(); render();
}

function allCols() { return [...cols, ...weekUnscheduled]; }

function deleteTask(id) {
  allCols().forEach(c => { if (state[c.id]) state[c.id] = state[c.id].filter(t => t.id !== id); });
  saveState(); render();
}

function toggleDone(id) {
  allCols().forEach(c => {
    if (!state[c.id]) return;
    const t = state[c.id].find(t => t.id === id);
    if (t) t.done = !t.done;
  });
  saveState(); render();
}

function addCol(label, date) {
  if (!label.trim()) return;
  cols.push({id:'col'+(colCounter++), label:label.trim(), date:date.trim()});
  sortColsByDate();
  saveState(); render();
}

function addNextDay() {
  // find the last non-unscheduled col that has a parseable date
  const dayCols = cols.filter(c => c.date);
  let label = '', date = '';
  if (dayCols.length > 0) {
    const last = dayCols[dayCols.length - 1];
    const baseDate = last.date.replace(/\+$/, ''); // strip trailing '+'
    const m = baseDate.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (m) {
      const yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
      const d  = new Date(yr, parseInt(m[1]) - 1, parseInt(m[2]));
      d.setDate(d.getDate() + 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      date  = `${mm}/${dd}`;
      label = d.toLocaleDateString('en-US', {weekday: 'short'});
    }
  }
  addCol(label || 'Day', date);
}

function addUnscheduledCol() {
  weekUnscheduled.push({id:'unsched_w'+(colCounter++), label:'Unscheduled'});
  saveState(); render();
}

function deleteCol(colId) {
  const tasks = state[colId] || [];
  if (tasks.length > 0 && !confirm('Delete column and all its tasks?')) return;
  delete state[colId];
  cols = cols.filter(c => c.id !== colId);
  saveState(); render();
}

// ── scale controls ────────────────────────────────────────────────────────────

function renderScaleBtns() {
  const container = document.getElementById('scaleBtns');
  if (!container) return;
  container.innerHTML = '';

  const minus = document.createElement('button');
  minus.className = 'scale-btn';
  minus.textContent = '−';
  minus.title = 'Smaller';
  minus.onclick = () => {
    const idx = UI_SCALES.indexOf(uiScale);
    if (idx > 0) { applyScale(UI_SCALES[idx - 1]); saveState(); }
  };

  const plus = document.createElement('button');
  plus.className = 'scale-btn';
  plus.textContent = '+';
  plus.title = 'Larger';
  plus.onclick = () => {
    const idx = UI_SCALES.indexOf(uiScale);
    if (idx < UI_SCALES.length - 1) { applyScale(UI_SCALES[idx + 1]); saveState(); }
  };

  container.appendChild(minus);
  container.appendChild(plus);
}

// ── init ──────────────────────────────────────────────────────────────────────

loadState().then(() => {
  applyScale(uiScale);
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
