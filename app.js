const DEFAULT_COLS = [
  {id:'unscheduled', label:'Unscheduled', date:'', fixed:true},
  {id:'mon', label:'Mon', date:'04/20'},
  {id:'tue', label:'Tue', date:'04/21'},
  {id:'wed', label:'Wed', date:'04/22'},
  {id:'thu', label:'Thu', date:'04/23'},
  {id:'fri', label:'Fri', date:'04/24'},
  {id:'sat', label:'Sat', date:'04/25'},
  {id:'sun', label:'Sun', date:'04/26'},
  {id:'nxtwed', label:'Next Wed+', date:'04/29+'},
];

const INIT_TASKS = [
  {id:'t1',  text:'Bloomberg interview 12pm',  type:'t-locked',    col:'tue',         locked:true},
  {id:'t2',  text:'InterviewingIO 8:30pm',      type:'t-locked',    col:'tue',         locked:true},
  {id:'t3',  text:'Uber recruiter 10am',         type:'t-locked',    col:'wed',         locked:true},
  {id:'t4',  text:'Spanish 4pm (last class)',    type:'t-locked',    col:'wed',         locked:true},
  {id:'t5',  text:'Reply Lara Peterson',         type:'t-async',     col:'mon'},
  {id:'t6',  text:'Check Olivia startups',       type:'t-async',     col:'mon'},
  {id:'t7',  text:'Send resume IBKR',            type:'t-async',     col:'mon'},
  {id:'t8',  text:'Send resume James',           type:'t-async',     col:'fri'},
  {id:'t9',  text:'Bloomberg prep call',         type:'t-interview', col:'unscheduled'},
  {id:'t10', text:'Vaneveer behavioral',         type:'t-interview', col:'unscheduled'},
  {id:'t11', text:'Bloomberg Buy-Side x2',       type:'t-interview', col:'nxtwed'},
  {id:'t12', text:'Optiver phone screen',        type:'t-interview', col:'nxtwed'},
  {id:'t13', text:'Doordash coding screen',      type:'t-interview', col:'nxtwed'},
  {id:'t14', text:'Amazon SDE2 OA',              type:'t-interview', col:'tue'},
  {id:'t15', text:'Highland Tech C++ OA',        type:'t-interview', col:'sat'},
  {id:'t16', text:'Taxes - Fidelity PDFs',       type:'t-tax',       col:'mon'},
  {id:'t17', text:'Taxes - investments',         type:'t-tax',       col:'wed'},
  {id:'t18', text:'Taxes - finalize + Q1',       type:'t-tax',       col:'thu'},
  {id:'t19', text:'C++ practice',                type:'t-practice',  col:'thu'},
  {id:'t20', text:'System design prep',          type:'t-practice',  col:'fri'},
  {id:'t21', text:'Check Prampt',                type:'t-practice',  col:'sun'},
  {id:'t22', text:'Car inspection',              type:'t-async',     col:'thu'},
  {id:'t23', text:'Rest / recover',              type:'t-rest',      col:'mon'},
];

const TYPE_STYLES = {
  't-locked':    'background:var(--c-locked-bg);border-color:var(--c-locked-b);color:var(--c-locked-t)',
  't-interview': 'background:var(--c-interview-bg);border-color:var(--c-interview-b);color:var(--c-interview-t)',
  't-tax':       'background:var(--c-tax-bg);border-color:var(--c-tax-b);color:var(--c-tax-t)',
  't-practice':  'background:var(--c-practice-bg);border-color:var(--c-practice-b);color:var(--c-practice-t)',
  't-async':     'background:var(--c-async-bg);border-color:var(--c-async-b);color:var(--c-async-t)',
  't-rest':      'background:var(--c-rest-bg);border-color:var(--c-rest-b);color:var(--c-rest-t)',
  't-unplanned': 'background:var(--c-unplanned-bg);border-color:var(--c-unplanned-b);color:var(--c-unplanned-t)',
  'done':        'background:var(--c-done-bg);border-color:var(--c-done-b);color:var(--c-done-t)',
};
const LEGEND_ORDER   = ['t-locked','t-interview','t-tax','t-practice','t-async','t-rest','t-unplanned','done'];
const DROPDOWN_TYPES = ['t-interview','t-tax','t-practice','t-async','t-rest','t-unplanned'];

const DEFAULT_TYPE_LABELS = {
  't-locked':    'locked',
  't-interview': 'interview',
  't-tax':       'taxes',
  't-practice':  'practice',
  't-async':     'async',
  't-rest':      'rest',
  't-unplanned': 'unplanned',
  'done':        'done',
};

let cols = [], state = {}, idCounter = 100, colCounter = 200, dragging = null;
let typeLabels = {...DEFAULT_TYPE_LABELS};

function inferDay(dateStr) {
  const m = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return '';
  const yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
  const d  = new Date(yr, parseInt(m[1]) - 1, parseInt(m[2]));
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', {weekday: 'short'});
}

async function loadState() {
  try {
    const res   = await fetch('/api/state');
    const saved = await res.json();
    if (saved) {
      cols        = saved.cols;
      state       = saved.state;
      idCounter   = saved.idCounter   || 100;
      colCounter  = saved.colCounter  || 200;
      typeLabels  = saved.typeLabels  ? {...DEFAULT_TYPE_LABELS, ...saved.typeLabels} : {...DEFAULT_TYPE_LABELS};
      return;
    }
  } catch(e) {}
  cols  = DEFAULT_COLS.map(c => ({...c}));
  state = {};
  INIT_TASKS.forEach(t => { if (!state[t.col]) state[t.col]=[]; state[t.col].push({...t}); });
}

function saveState() {
  fetch('/api/state', {
    method:  'PUT',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify({cols, state, idCounter, colCounter, typeLabels}),
  }).catch(() => {});
}

function addTask(colId, text, type) {
  if (!text.trim()) return;
  if (!state[colId]) state[colId] = [];
  state[colId].push({id:'u'+(idCounter++), text:text.trim(), type, col:colId, locked:false, done:false});
  saveState(); render();
}

function deleteTask(id) {
  cols.forEach(c => { if (state[c.id]) state[c.id] = state[c.id].filter(t => t.id !== id); });
  saveState(); render();
}

function toggleDone(id) {
  cols.forEach(c => { if (!state[c.id]) return; const t = state[c.id].find(t => t.id===id); if (t) t.done = !t.done; });
  saveState(); render();
}

function addCol(label, date) {
  if (!label.trim()) return;
  const id = 'col'+(colCounter++);
  cols.push({id, label:label.trim(), date:date.trim()});
  saveState(); render();
}

function deleteCol(colId) {
  const tasks = state[colId] || [];
  if (tasks.length > 0) {
    if (!confirm('Move tasks to Unscheduled?')) return;
    if (!state['unscheduled']) state['unscheduled'] = [];
    tasks.forEach(t => { t.col='unscheduled'; state['unscheduled'].push(t); });
  }
  delete state[colId];
  cols = cols.filter(c => c.id !== colId);
  saveState(); render();
}

function renderLegend() {
  const el = document.getElementById('legend');
  el.innerHTML = '';
  LEGEND_ORDER.forEach(key => {
    const pill = document.createElement('span');
    pill.className   = 'leg';
    pill.style.cssText = TYPE_STYLES[key] || '';
    pill.textContent = typeLabels[key] || key;
    pill.title = 'click "labels" to rename';
    el.appendChild(pill);
  });
}

function render() {
  renderLegend();

  const board = document.getElementById('board');
  board.innerHTML = '';

  cols.forEach(col => {
    const colEl = document.createElement('div');
    colEl.className = 'col' + (col.id==='unscheduled' ? ' unscheduled' : '');

    const hdr  = document.createElement('div');
    hdr.className = 'col-header';
    const left = document.createElement('div');
    left.className = 'col-header-left';
    left.innerHTML = `<span>${col.label}</span>` + (col.date ? `<span class="date">${col.date}</span>` : '');
    hdr.appendChild(left);
    if (!col.fixed) {
      const dc = document.createElement('button');
      dc.className = 'del-col'; dc.textContent = '×'; dc.title = 'remove column';
      dc.onclick = () => deleteCol(col.id);
      hdr.appendChild(dc);
    }
    colEl.appendChild(hdr);

    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.dataset.col = col.id;

    (state[col.id]||[]).forEach(task => {
      const el = document.createElement('div');
      el.className = 'task ' + task.type + (task.locked?' locked':'') + (task.done?' done':'');
      el.dataset.id = task.id;

      const txt = document.createElement('span');
      txt.className = 'task-text';
      txt.textContent = task.text;
      el.appendChild(txt);

      if (!task.locked) {
        const actions = document.createElement('div');
        actions.className = 'task-actions';

        const chk = document.createElement('button');
        chk.className = 'check';
        chk.textContent = task.done ? '✓' : '○';
        chk.onclick = e => { e.stopPropagation(); toggleDone(task.id); };
        actions.appendChild(chk);

        const del = document.createElement('button');
        del.className = 'del'; del.textContent = '×';
        del.onclick = e => { e.stopPropagation(); deleteTask(task.id); };
        actions.appendChild(del);

        el.appendChild(actions);
        el.addEventListener('dblclick', () => toggleDone(task.id));
        el.draggable = !task.done;
        el.addEventListener('dragstart', e => {
          if (task.done) { e.preventDefault(); return; }
          dragging = task.id; e.dataTransfer.effectAllowed='move';
          setTimeout(() => el.style.opacity='0.4', 0);
        });
        el.addEventListener('dragend', () => {
          dragging=null; el.style.opacity='';
          document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over'));
        });
      }
      zone.appendChild(el);
    });

    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      if (!dragging) return;
      const tc = zone.dataset.col; let task=null;
      cols.forEach(c => {
        if (!state[c.id]) return;
        const i = state[c.id].findIndex(t => t.id===dragging);
        if (i>-1) task = state[c.id].splice(i,1)[0];
      });
      if (task) { task.col=tc; if (!state[tc]) state[tc]=[]; state[tc].push(task); saveState(); }
      render();
    });

    colEl.appendChild(zone);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn'; addBtn.textContent = '+ add task';

    const form = document.createElement('div');
    form.className = 'add-form';

    const opts = DROPDOWN_TYPES
      .map(k => `<option value="${k}"${k==='t-async'?' selected':''}>${typeLabels[k]||k}</option>`)
      .join('');
    form.innerHTML = `<input type="text" placeholder="task name..." maxlength="60" /><select>${opts}</select><div class="add-form-btns"><button class="btn-confirm">add</button><button class="btn-cancel">cancel</button></div>`;

    const reset = () => { addBtn.style.display=''; form.classList.remove('open'); form.querySelector('input').value=''; };
    addBtn.onclick = () => { addBtn.style.display='none'; form.classList.add('open'); form.querySelector('input').focus(); };
    form.querySelector('.btn-cancel').onclick  = reset;
    const doAdd = () => addTask(col.id, form.querySelector('input').value, form.querySelector('select').value);
    form.querySelector('.btn-confirm').onclick = doAdd;
    form.querySelector('input').addEventListener('keydown', e => { if(e.key==='Enter') doAdd(); if(e.key==='Escape') reset(); });

    colEl.appendChild(addBtn);
    colEl.appendChild(form);
    board.appendChild(colEl);
  });
}

loadState().then(() => render());

const addDayBtn   = document.getElementById('addDayBtn');
const addDayForm  = document.getElementById('addDayForm');
const newDayLabel = document.getElementById('newDayLabel');
const newDayDate  = document.getElementById('newDayDate');

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
  const l = newDayLabel.value;
  const d = newDayDate.value;
  if (!l.trim()) return;
  addCol(l, d); closeDay();
};
[newDayLabel, newDayDate].forEach(inp => {
  inp.addEventListener('keydown', e => {
    if (e.key==='Enter')  document.getElementById('addDayConfirm').click();
    if (e.key==='Escape') closeDay();
  });
});

const labelsPanel = document.getElementById('labelsPanel');

function openLabelsPanel() {
  const rows = document.getElementById('labelRows');
  rows.innerHTML = '';
  LEGEND_ORDER.forEach(key => {
    const style   = TYPE_STYLES[key] || '';
    const bgMatch = style.match(/background:([^;]+)/);
    const bMatch  = style.match(/border-color:([^;]+)/);

    const row = document.createElement('div');
    row.className = 'label-row';

    const swatch = document.createElement('div');
    swatch.className = 'label-swatch';
    if (bgMatch) swatch.style.background  = bgMatch[1].trim();
    if (bMatch)  swatch.style.borderColor = bMatch[1].trim();

    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.value       = typeLabels[key] || key;
    inp.dataset.key = key;
    inp.maxLength   = 20;

    row.appendChild(swatch);
    row.appendChild(inp);
    rows.appendChild(row);
  });

  labelsPanel.classList.add('open');
}

document.getElementById('labelsBtn').onclick = (e) => {
  e.stopPropagation();
  if (labelsPanel.classList.contains('open')) {
    labelsPanel.classList.remove('open');
  } else {
    openLabelsPanel();
  }
};

document.getElementById('labelsSave').onclick = () => {
  document.querySelectorAll('#labelRows input').forEach(inp => {
    const val = inp.value.trim();
    if (val) typeLabels[inp.dataset.key] = val;
  });
  saveState();
  render();
  labelsPanel.classList.remove('open');
};

document.addEventListener('click', e => {
  if (!labelsPanel.contains(e.target) && e.target.id !== 'labelsBtn') {
    labelsPanel.classList.remove('open');
  }
});
