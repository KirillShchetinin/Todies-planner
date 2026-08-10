// board.js — the desktop renderer.
//
// The board is a vertical stack of week rows; each row is one unscheduled
// container plus a 7-slot Mon–Sun grid of day columns. Everything here is
// desktop-only: mouse drag-and-drop, hover affordances, right-click menus.
// Its mobile counterpart is mobile/mobile.js.

let _didInitialDesktopScroll = false;

registerView('desktop', {
  render: renderDesktop,
  // The document scrolls on desktop.
  scrollEl: () => document.scrollingElement,
});

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
      if (from > -1 && to > -1) { const [m] = cols.splice(from, 1); cols.splice(to, 0, m); }
      draggingCol = null; sortColsByDate(); render();
    });

    const isToday = !isUnscheduled && isTodayDate(col.date);
    if (isToday) colEl.classList.add('today');

    const hdr  = document.createElement('div');
    hdr.className = 'col-header';
    const left = document.createElement('div');
    left.className = 'col-header-left';
    const flames = isToday ? '<span class="today-flames"><span>🔥</span><span>🔥</span><span>🔥</span></span>' : '';
    left.innerHTML = `<span class="col-header-text"><span>${translateLabel(col.label)}</span>` + (col.date ? `<span class="date">${formatColDate(col.date)}</span>` : '') + `</span>` + flames;
    hdr.appendChild(left);
    {
      const dc = document.createElement('button');
      dc.className = 'del-col'; dc.textContent = '×'; dc.title = t('removeColTitle');
      dc.setAttribute('aria-label', t('removeColTitle'));
      dc.onclick = () => deleteCol(col.id);
      hdr.appendChild(dc);
    }

    // A header click toggles collapse — but only a click, not the tail of a
    // column drag, hence the 5px movement threshold.
    let hdrMouseX = 0, hdrMouseY = 0;
    hdr.addEventListener('mousedown', e => { hdrMouseX = e.clientX; hdrMouseY = e.clientY; });
    hdr.addEventListener('mouseup', e => {
      if (e.target.closest('.del-col')) return;
      const dx = Math.abs(e.clientX - hdrMouseX), dy = Math.abs(e.clientY - hdrMouseY);
      if (dx >= 5 || dy >= 5) return;
      if (Collapse.toggle(col.id, state)) {
        pessimisticMeta(() => {}, () => { Collapse.toggle(col.id, state); });
      }
    });

    colEl.appendChild(hdr);

    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.dataset.col = col.id;

    (state[col.id]||[]).forEach(task => zone.appendChild(buildTaskEl(task, zone)));

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      if (!e.target.closest('.task')) zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', e => onZoneDrop(e, zone));

    colEl.appendChild(zone);

    const { addBtn, form } = buildAddForm(col, isUnscheduled);
    colEl.appendChild(addBtn);
    colEl.appendChild(form);

    if (Collapse.isShort(col.id)) {
      renderCollapsedCol(colEl, zone, state[col.id] || []);
    }

    return colEl;
}

// ── task card ─────────────────────────────────────────────────────────────

function buildTaskEl(task, zone) {
  const el = document.createElement('div');
  el.className = 'task' + (task.done ? ' done' : '') + (task.cancelled ? ' cancelled' : '') + (task.pending ? ' pending' : '');
  el.dataset.id = task.id;
  el.title = task.text;
  applyTaskStyle(el, task.type, task.done, task.cancelled);

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

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const chk = document.createElement('button');
  chk.className   = 'check';
  chk.textContent = task.done ? '✓' : '○';
  chk.setAttribute('aria-label', task.done ? 'Mark incomplete' : 'Mark complete');
  chk.onclick = e => { e.stopPropagation(); toggleDone(task.id); };
  actions.appendChild(chk);

  const del = document.createElement('button');
  del.className = 'del'; del.textContent = '×';
  del.setAttribute('aria-label', 'Delete task');
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

  return el;
}

// ── drag-and-drop ─────────────────────────────────────────────────────────

// Dropping reorders within a column or moves between columns; either way every
// task in the destination column gets its sort_order rewritten. Revert is
// scoped to the two columns this drop touches, so concurrent writes elsewhere
// survive a failure.
function onZoneDrop(e, zone) {
  e.preventDefault();
  zone.classList.remove('drag-over');
  document.querySelectorAll('.task').forEach(t => t.classList.remove('insert-before','insert-after'));
  if (!dragging) return;

  const tc = Number(zone.dataset.col);
  const targetEl = e.target.closest('.task[data-id]');
  const draggedId = dragging;

  const sourceColId = findTaskCol(draggedId);
  const task = sourceColId != null ? state[sourceColId].find(t => t.id === draggedId) : null;
  if (!task) return;
  if (task.pending) return;  // id not persisted yet

  if (!state[tc]) state[tc] = [];
  const prevSource = [...state[sourceColId]];
  const prevTarget = sourceColId === tc ? prevSource : [...state[tc]];

  UndoHistory.push();
  state[sourceColId] = state[sourceColId].filter(t => t.id !== draggedId);
  if (sourceColId !== tc && !state[tc]) state[tc] = [];

  if (targetEl && Number(targetEl.dataset.id) !== task.id) {
    const rect     = targetEl.getBoundingClientRect();
    const before   = e.clientY < rect.top + rect.height / 2;
    const targetId = Number(targetEl.dataset.id);
    const idx      = state[tc].findIndex(t => t.id === targetId);
    state[tc].splice(before ? idx : idx + 1, 0, task);
  } else {
    state[tc].push(task);
  }

  const movedToOtherCol = sourceColId !== tc;
  const calls = state[tc].map((t, i) => {
    const patch = { sort_order: i };
    if (t.id === task.id && movedToOtherCol) patch.form_id = tc;
    return taskApiUpdate(t.id, patch).then(res => {
      if (res && res.ok === false) throw new Error('reorder failed');
    });
  });
  Promise.all(calls).catch(() => {
    state[sourceColId] = prevSource;          // restore only the two affected columns
    if (sourceColId !== tc) state[tc] = prevTarget;
    render();
  });
  render();
}

// ── add-task form ─────────────────────────────────────────────────────────

// Two steps in place of mobile's sheet: pick a type pill, then type a name.
function buildAddForm(col, isUnscheduled) {
  const addBtn = document.createElement('button');
  addBtn.className   = 'add-btn';
  addBtn.textContent = isUnscheduled ? '+' : t('addTask');

  const form = document.createElement('div');
  form.className = 'add-form';

  const typePicker = document.createElement('div');
  typePicker.className = 'add-type-picker';
  selectableTypeKeys().forEach(k => {
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
  nameRow.style.display = 'none';

  form.appendChild(typePicker);
  form.appendChild(nameRow);

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
    if (!document.body.contains(addBtn)) return; // column was removed from DOM, ignore
    if (form.classList.contains('open') && !form.contains(e.target) && e.target !== addBtn) reset();
  }, { capture: true });

  return { addBtn, form };
}

// ── board ─────────────────────────────────────────────────────────────────

function _buildEarlierWeeksRow() {
  const row = document.createElement('div');
  row.className = 'earlier-weeks-row';
  const btn = document.createElement('button');
  btn.className = 'earlier-weeks-btn';
  btn.textContent = loadingEarlier ? '…' : t('earlierWeeks');
  btn.disabled = loadingEarlier;
  btn.onclick = loadEarlierWeeks;
  row.appendChild(btn);
  return row;
}

// Buckets the columns into ISO weeks, each a 7-slot Mon–Sun array. Columns
// with no usable date fall into one trailing "__nodate__" bucket. `order` is
// the ABSOLUTE index over all weeks — it pairs a week with its unscheduled
// container, so hiding unloaded weeks must never renumber it.
function _weekBuckets() {
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

  return [...weekMap.values()].sort((a, b) => a.order - b.order);
}

function renderDesktop() {
  renderLegend();

  const board = document.getElementById('board');
  board.innerHTML = '';

  const allWeeks = _weekBuckets();

  // customLoad ON: render a week only if at least one of its cols is loaded
  // (unloaded weeks are revealed via "earlier weeks"). Uses the session-frozen
  // flag: toggling customLoad never changes the view until refresh.
  const _colLoaded = col => !customLoadActive || loadedFormIds.has(col.id);
  const weeks = customLoadActive
    ? allWeeks.filter(w => (w.key === '__nodate__'
        ? w.slots.some(s => _colLoaded(s.col))
        : w.slots.some(c => c && _colLoaded(c))))
    : allWeeks;

  // Desktop "earlier weeks" control — one full-width row above the first week.
  if (hasUnloadedWeeks()) board.appendChild(_buildEarlierWeeksRow());

  weeks.forEach(week => {
    const unschedCol = weekUnscheduled[week.order] || weekUnscheduled[weekUnscheduled.length - 1];
    if (!unschedCol) return;

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

    for (let di = 0; di < 7; di++) {
      const rawEntry = week.key === '__nodate__' ? (slots[di] || null) : slots[di];
      let entry = rawEntry;
      if (entry && !_colLoaded(entry)) entry = null;   // hide unloaded day within a partially-loaded week
      if (entry) {
        daysGrid.appendChild(buildColEl(entry));
      } else if (!rawEntry && week.key !== '__nodate__') {
        const ghost = document.createElement('div');
        ghost.className = 'col-ghost';
        ghost.title = t('ghostTitle');
        ghost.addEventListener('dblclick', e => { e.stopPropagation(); addDayAtSlot(week.key, di); });
        daysGrid.appendChild(ghost);
      } else {
        const spacer = document.createElement('div');
        spacer.className = 'col-spacer';
        daysGrid.appendChild(spacer);
      }
    }

    weekRow.appendChild(daysGrid);
    board.appendChild(weekRow);
  });

  if (!_didInitialDesktopScroll) {
    const todayEl = board.querySelector('.col.today');
    if (todayEl) {
      _didInitialDesktopScroll = true;
      requestAnimationFrame(() => todayEl.scrollIntoView({ block: 'start', behavior: 'auto' }));
    }
  }

  if (weeks.length === 0) board.appendChild(_buildEmptyWeekRow());
}

// A board with no columns at all still shows one week row, so there is
// somewhere to double-click.
function _buildEmptyWeekRow() {
  const weekRow = document.createElement('div');
  weekRow.className = 'week-row';
  const bar = document.createElement('div');
  bar.className = 'unscheduled-bar';
  const emptyUnsched = weekUnscheduled[0];
  if (emptyUnsched) {
    const emptyTasks = state[emptyUnsched.id] || [];
    if (emptyTasks.length > 0) bar.classList.add('has-tasks');
    bar.appendChild(buildColEl(emptyUnsched));
  }
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
  return weekRow;
}

// ── inline rename ─────────────────────────────────────────────────────────

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

  let committed = false;

  const commit = () => {
    if (committed) return;
    committed = true;
    const val = input.value.trim();
    const task = findTask(taskId);
    if (val && val !== original && task && !task.pending) renameTask(taskId, val);
    else render();
  };

  const cancel = () => { committed = true; render(); };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', commit);
}
