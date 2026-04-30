// board.js — rendering logic for the weekly planner board
// Depends on globals from: state.js, tasks.js, columns.js, context-menu.js, legend.js, collapse.js, i18n.js

function applyTaskStyle(el, type, done) {
  const cfg = typeConfig[type] || typeConfig['t-async'] || {bg:'#f2f2f0', border:'#d8d8d4', text:'#444'};
  el.style.background  = cfg.bg;
  el.style.borderColor = cfg.border;
  el.style.color       = cfg.text;
  el.style.borderStyle = (!done && cfg.dashed) ? 'dashed' : 'solid';
  el.style.fontStyle   = (!done && cfg.italic)  ? 'italic' : '';
  el.style.opacity     = done ? '0.45' : '';
}

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

    const _now = new Date();
    const isToday = (() => {
      if (isUnscheduled || !col.date) return false;
      const m = col.date.match(/^(\d{1,2})\/(\d{1,2})/);
      if (!m) return false;
      return parseInt(m[1]) === _now.getMonth() + 1 && parseInt(m[2]) === _now.getDate();
    })();
    if (isToday) colEl.classList.add('today');

    const hdr  = document.createElement('div');
    hdr.className = 'col-header';
    const left = document.createElement('div');
    left.className = 'col-header-left';
    const flames = isToday ? '<span class="today-flames"><span>🔥</span><span>🔥</span><span>🔥</span></span>' : '';
    left.innerHTML = `<span class="col-header-text"><span>${translateLabel(col.label)}</span>` + (col.date ? `<span class="date">${col.date}</span>` : '') + `</span>` + flames;
    hdr.appendChild(left);
    {
      const dc = document.createElement('button');
      dc.className = 'del-col'; dc.textContent = '×'; dc.title = t('removeColTitle');
      dc.onclick = () => deleteCol(col.id);
      hdr.appendChild(dc);
    }

    let hdrMouseX = 0, hdrMouseY = 0;
    hdr.addEventListener('mousedown', e => { hdrMouseX = e.clientX; hdrMouseY = e.clientY; });
    hdr.addEventListener('mouseup', e => {
      if (e.target.closest('.del-col')) return;
      const dx = Math.abs(e.clientX - hdrMouseX), dy = Math.abs(e.clientY - hdrMouseY);
      if (dx >= 5 || dy >= 5) return;
      if (Collapse.toggle(col.id, state)) { render(); saveState(); }
    });

    colEl.appendChild(hdr);

    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.dataset.col = col.id;

    (state[col.id]||[]).forEach(task => {
      const el = document.createElement('div');
      el.className = 'task' + (task.done ? ' done' : '');
      el.dataset.id = task.id;
      el.title = task.text;
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

    zone.addEventListener('dragover', e => {
      e.preventDefault();
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

    const addBtn = document.createElement('button');
    addBtn.className   = 'add-btn';
    addBtn.textContent = isUnscheduled ? '+' : t('addTask');

    const form = document.createElement('div');
    form.className = 'add-form';

    const dropKeys = legendOrder.filter(k => k !== 't-locked' && k !== 'done');

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

    const nameRow = document.createElement('div');
    nameRow.className = 'add-name-row';
    nameRow.innerHTML = `<input type="text" placeholder="${t('addTaskPh')}" maxlength="60"/>`;

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

  const weekMap = new Map();
  let noDateBucket = null;
  let weekOrder = 0;

  cols.forEach(col => {
    const info = colWeekInfo(col);
    if (!info) {
      if (!noDateBucket) { noDateBucket = { key: '__nodate__', slots: [], order: weekOrder++ }; weekMap.set('__nodate__', noDateBucket); }
      noDateBucket.slots.push({ col, day: noDateBucket.slots.length });
      return;
    }
    if (!weekMap.has(info.key)) {
      weekMap.set(info.key, { key: info.key, slots: new Array(7).fill(null), order: weekOrder++ });
    }
    weekMap.get(info.key).slots[info.day] = col;
  });

  const weeks = [...weekMap.values()].sort((a, b) => a.order - b.order);

  const weekCount = Math.max(1, weeks.length);
  while (weekUnscheduled.length < weekCount) {
    weekUnscheduled.push({ id: 'unsched_w' + (colCounter++), label: 'Unscheduled' });
  }

  weeks.forEach((week, wi) => {
    const unschedCol = weekUnscheduled[wi];

    const weekRow = document.createElement('div');
    weekRow.className = 'week-row';

    const bar = document.createElement('div');
    bar.className = 'unscheduled-bar';
    const unschedTasks = state[unschedCol.id] || [];
    if (unschedTasks.length > 0) bar.classList.add('has-tasks');
    bar.appendChild(buildColEl(unschedCol));
    weekRow.appendChild(bar);

    const daysGrid = document.createElement('div');
    daysGrid.className = 'week-days';

    const slots = week.key === '__nodate__'
      ? week.slots.map(s => s.col)
      : week.slots;

    const isLastWeek = wi === weeks.length - 1;
    let ghostAdded = false;

    for (let di = 0; di < 7; di++) {
      const entry = week.key === '__nodate__' ? (slots[di] || null) : slots[di];
      if (entry) {
        daysGrid.appendChild(buildColEl(entry));
      } else if (isLastWeek && !ghostAdded) {
        const ghost = document.createElement('div');
        ghost.className = 'col-ghost';
        ghost.title = t('ghostTitle');
        ghost.addEventListener('dblclick', e => { e.stopPropagation(); addNextDay(); });
        daysGrid.appendChild(ghost);
        ghostAdded = true;
      } else {
        const spacer = document.createElement('div');
        spacer.className = 'col-spacer';
        daysGrid.appendChild(spacer);
      }
    }

    weekRow.appendChild(daysGrid);
    board.appendChild(weekRow);
  });

  if (weeks.length === 0) {
    const weekRow = document.createElement('div');
    weekRow.className = 'week-row';
    const bar = document.createElement('div');
    bar.className = 'unscheduled-bar';
    const emptyTasks = state[weekUnscheduled[0].id] || [];
    if (emptyTasks.length > 0) bar.classList.add('has-tasks');
    bar.appendChild(buildColEl(weekUnscheduled[0]));
    weekRow.appendChild(bar);
    const daysGrid = document.createElement('div');
    daysGrid.className = 'week-days';
    const ghost = document.createElement('div');
    ghost.className = 'col-ghost';
    ghost.title = 'Double-click to add next day';
    ghost.addEventListener('dblclick', e => { e.stopPropagation(); addNextDay(); });
    daysGrid.appendChild(ghost);
    for (let i = 1; i < 7; i++) { const sp = document.createElement('div'); sp.className = 'col-spacer'; daysGrid.appendChild(sp); }
    weekRow.appendChild(daysGrid);
    board.appendChild(weekRow);
  }
}

function startTaskInlineEdit(taskId) {
  const el = document.querySelector(`.task[data-id="${taskId}"]`);
  if (!el) return;

  const txtSpan = el.querySelector('.task-text');
  if (!txtSpan) return;

  const original = txtSpan.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-inline-edit';
  input.value = original;

  txtSpan.replaceWith(input);
  el.draggable = false;
  input.focus();
  input.select();

  const commit = () => {
    const val = input.value.trim();
    if (val && val !== original) {
      allCols().forEach(c => { (state[c.id]||[]).forEach(t => { if (t.id === taskId) t.text = val; }); });
      saveState();
    }
    render();
  };

  const cancel = () => render();

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', commit);
}
