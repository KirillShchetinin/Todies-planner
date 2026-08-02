// mobile.js — mobile view renderer
// Depends on globals: state.js, board.js (applyTaskStyle), tasks.js, columns.js,
//                     i18n.js, labels.js, context-menu.js, undo.js, api.js, scale.js

let expandedDays = new Set();
let overlay = null;
let _vpResizeListener = null;
let _didInitialScroll = false;
let _lastTapTaskId = null;
let _lastTapTime = 0;

// ── Entry point ────────────────────────────────────────────────────────────────

function renderMobile() {
  renderLegend();
  _initMobileState();
  _renderMobileHeader();
  _renderMobileBoard();
  _renderQuickAdd();
  _renderOverlay();
  if (!_didInitialScroll) {
    _didInitialScroll = true;
    requestAnimationFrame(() => {
      const todayEl = document.querySelector('.mob-day-hero.is-today');
      if (todayEl) todayEl.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  }
}

function _cleanupMobileDOM() {
  document.getElementById('mobile-header')?.remove();
  document.getElementById('mob-quick-add')?.remove();
  document.getElementById('mob-overlay')?.remove();
  _removeVpListener();
  _didInitialScroll = false;
}

// ── State helpers ──────────────────────────────────────────────────────────────

function _initMobileState() {
  const allColIds = new Set(allCols().map(c => c.id));
  for (const id of [...expandedDays]) {
    if (!allColIds.has(id)) expandedDays.delete(id);
  }
  if (expandedDays.size === 0) {
    const todayCol = _getTodayCol();
    if (todayCol) expandedDays.add(todayCol.id);
  }
}

function _getTodayCol() {
  const now = new Date();
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const dd  = String(now.getDate()).padStart(2, '0');
  const key = parseDateToSortKey(`${mm}/${dd}`);
  return cols.find(c => parseDateToSortKey(c.date) === key) || null;
}

function _isToday(col) {
  if (!col.date) return false;
  const now = new Date();
  const m   = col.date.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!m) return false;
  return parseInt(m[1]) === now.getMonth() + 1 && parseInt(m[2]) === now.getDate();
}

function _remainingCount(colId) {
  return (state[colId] || []).filter(t => !t.done && !t.cancelled).length;
}

function _getCurrentWeekKey() {
  const now = new Date();
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const dd  = String(now.getDate()).padStart(2, '0');
  const todayStr = `${mm}/${dd}`;
  const todayKey = parseDateToSortKey(todayStr);

  for (const col of cols) {
    const info = colWeekInfo(col);
    if (info && parseDateToSortKey(col.date) === todayKey) return info.key;
  }
  const info = colWeekInfo({ date: todayStr });
  if (info) return info.key;
  if (cols.length > 0) {
    const fi = colWeekInfo(cols[0]);
    if (fi) return fi.key;
  }
  return null;
}

function _weekMonday(isoKey) {
  const m = isoKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1]), week = parseInt(m[2]);
  const jan4  = new Date(year, 0, 4);
  const dow   = (jan4.getDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + (week - 1) * 7);
  return monday;
}

// ── Header ─────────────────────────────────────────────────────────────────────

function _renderMobileHeader() {
  let hdr = document.getElementById('mobile-header');
  if (!hdr) {
    hdr = document.createElement('div');
    hdr.id = 'mobile-header';
    const main = document.getElementById('main');
    main.insertBefore(hdr, main.firstChild);
  }
  hdr.innerHTML = '';

  // Title row
  const titleRow = document.createElement('div');
  titleRow.className = 'mob-title-row';

  const title = document.createElement('span');
  title.className = 'mob-title';
  title.textContent = t('appTitle');
  titleRow.appendChild(title);

  const btns = document.createElement('div');
  btns.className = 'mob-title-btns';

  const labelsBtn = document.createElement('button');
  labelsBtn.className = 'mob-icon-btn';
  labelsBtn.textContent = '◆';
  labelsBtn.title = t('actLabels');
  labelsBtn.onclick = () => { overlay = { kind: 'menu', tab: 'labels' }; render(); };
  btns.appendChild(labelsBtn);

  const menuBtn = document.createElement('button');
  menuBtn.className = 'mob-icon-btn';
  menuBtn.textContent = '≡';
  menuBtn.title = t('actSettings');
  menuBtn.onclick = () => { overlay = { kind: 'menu' }; render(); };
  btns.appendChild(menuBtn);

  titleRow.appendChild(btns);
  hdr.appendChild(titleRow);

  // Day strip
  const strip = document.createElement('div');
  strip.className = 'mob-day-strip';
  _buildDayStrip(strip);
  hdr.appendChild(strip);
}

function _buildDayStrip(container) {
  if (cols.length === 0) return;

  // Collect all unique week keys in order
  const weekKeys = [];
  const weekSeen = new Set();
  cols.forEach(col => {
    const info = colWeekInfo(col);
    if (info && !weekSeen.has(info.key)) {
      weekSeen.add(info.key);
      weekKeys.push(info.key);
    }
  });

  // customLoad ON: strip only lists loaded weeks; older weeks are revealed
  // via the "earlier weeks" chip prepended below. Frozen at load — toggling
  // customLoad never changes the view until refresh.
  const _loadedKeys = customLoadActive
    ? new Set(cols.filter(c => loadedFormIds.has(c.id)).map(c => colWeekInfo(c)?.key).filter(Boolean))
    : null;
  const visibleWeekKeys = _loadedKeys ? weekKeys.filter(k => _loadedKeys.has(k)) : weekKeys;

  if (hasUnloadedWeeks()) {
    const chip = document.createElement('button');
    chip.className = 'mob-earlier-chip';
    chip.textContent = loadingEarlier ? '…' : t('earlierWeeks');
    chip.disabled = loadingEarlier;
    chip.onclick = loadEarlierWeeks;
    container.appendChild(chip);
  }

  const INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const now = new Date();
  let todayChip = null;

  visibleWeekKeys.forEach((weekKey, wi) => {
    const monday = _weekMonday(weekKey);
    if (!monday) return;

    // Add a week-separator gap between weeks (except before the first)
    if (wi > 0) {
      const sep = document.createElement('div');
      sep.className = 'mob-strip-week-sep';
      container.appendChild(sep);
    }

    const weekCols = new Array(7).fill(null);
    cols.forEach(col => {
      const info = colWeekInfo(col);
      if (info && info.key === weekKey) weekCols[info.day] = col;
    });

    INITIALS.forEach((initial, idx) => {
      const col      = weekCols[idx];
      const chipDate = new Date(monday);
      chipDate.setDate(monday.getDate() + idx);
      const isToday  = chipDate.getDate()     === now.getDate() &&
                       chipDate.getMonth()    === now.getMonth() &&
                       chipDate.getFullYear() === now.getFullYear();

      const chip = document.createElement('div');
      chip.className = 'mob-day-chip';
      if (col && expandedDays.has(col.id)) chip.classList.add('expanded');
      if (isToday) chip.classList.add('today');
      if (!col)    chip.classList.add('no-col');

      const letter = document.createElement('span');
      letter.className = 'mob-chip-letter';
      letter.textContent = initial;
      chip.appendChild(letter);

      const dateEl = document.createElement('span');
      dateEl.className = 'mob-chip-date' + (isToday ? ' today' : '');
      dateEl.textContent = chipDate.getDate();
      chip.appendChild(dateEl);

      const remEl = document.createElement('span');
      remEl.className = 'mob-chip-rem';
      if (col) {
        const rem = _remainingCount(col.id);
        remEl.textContent = rem === 0 ? '✓' : rem;
      }
      chip.appendChild(remEl);

      if (col) {
        chip.onclick = () => {
          if (expandedDays.has(col.id)) expandedDays.delete(col.id);
          else expandedDays.add(col.id);
          render();
        };
      } else {
        chip.title = t('tapToAddDay');
        chip.onclick = () => addDayAtSlot(weekKey, idx);
      }

      container.appendChild(chip);
      if (isToday) todayChip = chip;
    });
  });

  // Scroll today's chip into view within the strip
  if (todayChip) {
    requestAnimationFrame(() => todayChip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' }));
  }
}

// ── Board ──────────────────────────────────────────────────────────────────────

function _renderMobileBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  const weekMap = new Map();
  let weekOrder = 0;

  cols.forEach(col => {
    const info = colWeekInfo(col);
    const key  = info ? info.key : '__nodate__';
    if (!weekMap.has(key)) {
      weekMap.set(key, { key, order: weekOrder++, slots: info ? new Array(7).fill(null) : [], hasDate: !!info });
    }
    const bucket = weekMap.get(key);
    if (info) bucket.slots[info.day] = col;
    else      bucket.slots.push(col);
  });

  const allWeeks = [...weekMap.values()].sort((a, b) => a.order - b.order);

  // customLoad ON: render only weeks with a loaded col; week.order stays the
  // ABSOLUTE index so unscheduled pairing never re-pairs (see board.js).
  const _colLoaded = col => !customLoadActive || loadedFormIds.has(col.id);
  const weeks = customLoadActive
    ? allWeeks.filter(w => w.slots.some(c => c && _colLoaded(c)))
    : allWeeks;

  const area = document.createElement('div');
  area.className = 'mob-scroll-area';

  if (weeks.length === 0 && weekUnscheduled.length > 0) {
    area.appendChild(_buildUnschedChip(weekUnscheduled[0]));
  }

  weeks.forEach((week) => {
    const unschedCol = weekUnscheduled[week.order] || weekUnscheduled[weekUnscheduled.length - 1];
    if (unschedCol) area.appendChild(_buildUnschedChip(unschedCol));

    const dayList = document.createElement('div');
    dayList.className = 'mob-day-list';

    week.slots.forEach(col => {
      if (!col || !_colLoaded(col)) return;
      dayList.appendChild(
        expandedDays.has(col.id) ? _buildDayHero(col) : _buildDayRow(col)
      );
    });

    area.appendChild(dayList);
  });

  board.appendChild(area);
}

// ── Unscheduled chip ───────────────────────────────────────────────────────────

function _buildUnschedChip(col) {
  const tasks = state[col.id] || [];

  const chip = document.createElement('div');
  chip.className = 'mob-unsched-chip';

  const label = document.createElement('span');
  label.className = 'mob-unsched-label';
  label.textContent = `${t('mobUnscheduled')} · ${tasks.length}`;
  chip.appendChild(label);

  const dots = document.createElement('div');
  dots.className = 'mob-unsched-dots';
  tasks.slice(0, 20).forEach(task => {
    const cfg = typeConfig[task.type] || typeConfig['Random'] || { border: '#d8d8d4' };
    const dot = document.createElement('span');
    dot.className = 'mob-unsched-dot';
    dot.style.background = cfg.border;
    dots.appendChild(dot);
  });
  if (tasks.length > 20) {
    const overflow = document.createElement('span');
    overflow.className = 'mob-unsched-overflow';
    overflow.textContent = `+${tasks.length - 20}`;
    dots.appendChild(overflow);
  }
  chip.appendChild(dots);

  const spacer = document.createElement('span');
  spacer.style.flex = '1';
  chip.appendChild(spacer);

  const arrow = document.createElement('span');
  arrow.className = 'mob-unsched-arrow';
  arrow.textContent = '›';
  chip.appendChild(arrow);

  chip.onclick = () => { overlay = { kind: 'unsched', colId: col.id }; render(); };
  return chip;
}

// ── DayRow (collapsed) ─────────────────────────────────────────────────────────

function _buildDayRow(col) {
  const isToday = _isToday(col);
  const tasks   = state[col.id] || [];

  const btn = document.createElement('button');
  btn.className = 'mob-day-row';

  // Date block
  const dateBlock = document.createElement('div');
  dateBlock.className = 'mob-row-date';

  const dayLabel = document.createElement('span');
  dayLabel.className = 'mob-row-daylabel' + (isToday ? ' today' : '');
  dayLabel.textContent = (col.label || '').slice(0, 3).toUpperCase();
  dateBlock.appendChild(dayLabel);

  if (col.date) {
    const m = col.date.match(/\/(\d+)/);
    const dayNum = document.createElement('span');
    dayNum.className = 'mob-row-daynum';
    dayNum.textContent = m ? parseInt(m[1]) : '';
    dateBlock.appendChild(dayNum);
  }

  btn.appendChild(dateBlock);

  // Separator
  const sep = document.createElement('div');
  sep.className = 'mob-row-sep';
  btn.appendChild(sep);

  // Dot row
  const dotRow = document.createElement('div');
  dotRow.className = 'mob-dot-row';
  if (tasks.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'mob-row-empty';
    empty.textContent = t('mobEmpty');
    dotRow.appendChild(empty);
  } else {
    tasks.forEach(task => {
      const cfg = typeConfig[task.type] || typeConfig['Random'] || { border: '#d8d8d4' };
      const dot = document.createElement('span');
      dot.className = 'mob-dot';
      dot.style.background = cfg.border;
      if (task.done || task.cancelled) dot.style.opacity = '0.3';
      dotRow.appendChild(dot);
    });
  }
  btn.appendChild(dotRow);

  // Important indicator
  if (tasks.some(t => t.important && !t.done && !t.cancelled)) {
    const imp = document.createElement('span');
    imp.className = 'mob-row-imp';
    imp.textContent = '!';
    btn.appendChild(imp);
  }

  // Remaining count
  const rem = _remainingCount(col.id);
  const remEl = document.createElement('span');
  remEl.className = 'mob-row-rem';
  remEl.textContent = rem === 0 ? '✓' : rem;
  btn.appendChild(remEl);

  // Chevron
  const chev = document.createElement('span');
  chev.className = 'mob-row-chev';
  chev.textContent = '›';
  btn.appendChild(chev);

  btn.onclick = () => { expandedDays.add(col.id); render(); };
  return btn;
}

// ── DayHero (expanded) ─────────────────────────────────────────────────────────

function _buildDayHero(col) {
  const isToday = _isToday(col);
  const tasks   = state[col.id] || [];
  const done    = tasks.filter(t => t.done || t.cancelled).length;

  const hero = document.createElement('div');
  hero.className = 'mob-day-hero' + (isToday ? ' is-today' : '');

  // Header row
  const hdr = document.createElement('div');
  hdr.className = 'mob-hero-hdr';

  const left = document.createElement('div');
  left.className = 'mob-hero-left';

  const dayName = document.createElement('span');
  dayName.className = 'mob-hero-dayname';
  dayName.textContent = translateLabel(col.label);
  left.appendChild(dayName);

  if (col.date) {
    const m = col.date.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (m) {
      const d  = new Date(resolveYear(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
      const dateSpan = document.createElement('span');
      dateSpan.className = 'mob-hero-date';
      dateSpan.textContent = d.toLocaleDateString(t('dayLocale'), { month: 'short', day: 'numeric' });
      left.appendChild(dateSpan);
    }
  }

  if (isToday) {
    const flames = document.createElement('span');
    flames.className = 'today-flames';
    flames.innerHTML = '<span>🔥</span><span>🔥</span><span>🔥</span>';
    left.appendChild(flames);
  }

  hdr.appendChild(left);

  const right = document.createElement('div');
  right.className = 'mob-hero-right';

  const count = document.createElement('span');
  count.className = 'mob-hero-count';
  count.textContent = `${done}done / ${tasks.length}total`;
  right.appendChild(count);

  const chev = document.createElement('span');
  chev.className = 'mob-hero-chev';
  chev.textContent = '▾';
  right.appendChild(chev);

  hdr.appendChild(right);
  hdr.onclick = () => { expandedDays.delete(col.id); render(); };
  hero.appendChild(hdr);

  // Divider
  const divider = document.createElement('div');
  divider.className = 'mob-hero-divider';
  hero.appendChild(divider);

  // Task list
  const taskList = document.createElement('div');
  taskList.className = 'mob-task-list';
  tasks.forEach(task => taskList.appendChild(_buildMobileTaskEl(task, col.id)));
  hero.appendChild(taskList);

  // Add task button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-btn';
  addBtn.textContent = t('addTask');
  addBtn.onclick = () => {
    overlay = { kind: 'add', step: 1, dayId: col.id, selectedType: null, typedText: '' };
    render();
  };
  hero.appendChild(addBtn);

  return hero;
}

// ── Mobile task element ────────────────────────────────────────────────────────

function _buildMobileTaskEl(task, fromColId) {
  const el = document.createElement('div');
  el.className = 'task' + (task.done ? ' done' : '') + (task.cancelled ? ' cancelled' : '');
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

  // Long-press → action sheet (350ms)
  let pressTimer = null;
  let startX = 0, startY = 0;

  el.addEventListener('pointerdown', e => {
    startX = e.clientX; startY = e.clientY;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      overlay = { kind: 'action', taskId: task.id, fromColId };
      render();
    }, 350);
  });
  el.addEventListener('pointermove', e => {
    if (!pressTimer) return;
    if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) {
      clearTimeout(pressTimer); pressTimer = null;
    }
  });
  el.addEventListener('pointerup', () => {
    if (!pressTimer) return;
    clearTimeout(pressTimer); pressTimer = null;
    const now = Date.now();
    if (_lastTapTaskId === task.id && now - _lastTapTime < 300) {
      _lastTapTaskId = null; _lastTapTime = 0;
      toggleDone(task.id);
    } else {
      _lastTapTaskId = task.id; _lastTapTime = now;
    }
  });
  el.addEventListener('pointercancel', () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  });
  el.addEventListener('contextmenu', e => e.preventDefault());

  return el;
}

// ── Quick-add button ───────────────────────────────────────────────────────────

function _renderQuickAdd() {
  let qa = document.getElementById('mob-quick-add');
  if (!qa) {
    qa = document.createElement('div');
    qa.id = 'mob-quick-add';
    document.getElementById('main').appendChild(qa);
  }
  qa.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = 'mob-quick-add-btn';

  const plus = document.createElement('span');
  plus.className = 'mob-qa-plus';
  plus.textContent = '+';
  btn.appendChild(plus);

  const lbl = document.createElement('span');
  lbl.className = 'mob-qa-label';
  lbl.textContent = t('mobQuickAdd');
  btn.appendChild(lbl);

  const todaySpan = document.createElement('span');
  todaySpan.className = 'mob-qa-today';
  todaySpan.textContent = t('mobToday');
  btn.appendChild(todaySpan);

  btn.onclick = () => {
    const todayCol = _getTodayCol();
    const dayId    = todayCol ? todayCol.id : (cols[0]?.id || weekUnscheduled[0]?.id || null);
    overlay = { kind: 'add', step: 1, dayId, selectedType: null, typedText: '' };
    render();
  };

  qa.appendChild(btn);
}

// ── Overlay dispatcher ─────────────────────────────────────────────────────────

function _renderOverlay() {
  _removeVpListener();
  document.getElementById('mob-overlay')?.remove();
  if (!overlay) return;

  const container = document.createElement('div');
  container.id = 'mob-overlay';

  if      (overlay.kind === 'action') _buildActionSheet(container);
  else if (overlay.kind === 'add')    _buildAddSheet(container);
  else if (overlay.kind === 'menu')   _buildSideMenu(container);
  else if (overlay.kind === 'unsched') _buildUnschedDrawer(container);

  document.body.appendChild(container);
}

// ── Action sheet (long-press) ──────────────────────────────────────────────────

function _buildActionSheet(container) {
  const task = findTask(overlay.taskId);
  if (!task) { overlay = null; return; }

  const scrim = document.createElement('div');
  scrim.className = 'mob-scrim';
  scrim.onclick = () => { overlay = null; render(); };
  container.appendChild(scrim);

  const card = document.createElement('div');
  card.className = 'mob-sheet';

  const handle = document.createElement('div');
  handle.className = 'mob-grab-handle';
  card.appendChild(handle);

  // Task preview
  const preview = document.createElement('div');
  preview.className = 'task';
  applyTaskStyle(preview, task.type, task.done, task.cancelled);
  const previewTxt = document.createElement('span');
  previewTxt.className = 'task-text';
  previewTxt.textContent = task.text;
  preview.appendChild(previewTxt);
  card.appendChild(preview);

  // MOVE TO section
  const moveLabel = document.createElement('div');
  moveLabel.className = 'mob-sheet-section-label';
  moveLabel.textContent = t('mobMoveTo');
  card.appendChild(moveLabel);

  const grid = document.createElement('div');
  grid.className = 'mob-day-grid';

  const fromColId = overlay.fromColId;
  const taskId    = overlay.taskId;  // capture before overlay can be nulled

  // Unscheduled buttons — show at most 2 (current + next), labeled "Later"
  weekUnscheduled.slice(0, 2).forEach((unschedCol, i) => {
    const lbl = weekUnscheduled.length > 1 ? `${t('mobLater')} ${i + 1}` : t('mobLater');
    const btn = _dayGridBtn(lbl, unschedCol.id === fromColId, () => _moveTaskToCol(taskId, unschedCol.id));
    grid.appendChild(btn);
  });

  // Nearby day cols — ±3 around the task's current column
  const fromIdx = cols.findIndex(c => c.id === fromColId);
  const nearbyCols = fromIdx === -1
    ? cols.slice(0, 7)
    : cols.slice(Math.max(0, fromIdx - 3), fromIdx + 4);
  nearbyCols.forEach(col => {
    const lbl = (col.label || '').slice(0, 3);
    const btn = _dayGridBtn(lbl, col.id === fromColId, () => _moveTaskToCol(taskId, col.id));
    grid.appendChild(btn);
  });

  card.appendChild(grid);

  const sep = document.createElement('div');
  sep.className = 'mob-sheet-sep';
  card.appendChild(sep);

  // Action rows — use captured taskId, not overlay.taskId
  [
    { icon: '✓', label: t('mobMarkDone'), cls: '', action: () => { overlay = null; toggleDone(taskId); } },
    { icon: '!',  label: t('mobMarkImportant'), cls: 'mob-action-important', action: () => {
        overlay = null;
        const t2 = findTask(taskId);
        if (!t2 || t2.pending) { render(); return; }
        const prev = t2.important;
        optimistic(
          () => { t2.important = !prev; },
          () => taskApiUpdate(taskId, { metadata: { important: !!t2.important } }),
          () => { t2.important = prev; },
        );
      }
    },
    { icon: '✕', label: t('mobCancelTask'), cls: 'mob-action-cancel', action: () => { overlay = null; toggleCancelled(taskId); } },
    { icon: '🗑', label: t('mobDelete'), cls: 'mob-action-delete', action: () => { overlay = null; deleteTask(taskId); } },
  ].forEach(({ icon, label, cls, action }) => {
    const row = document.createElement('button');
    row.className = 'mob-action-row' + (cls ? ' ' + cls : '');
    const iconEl = document.createElement('span');
    iconEl.className = 'mob-action-icon';
    iconEl.textContent = icon;
    row.appendChild(iconEl);
    const lblEl = document.createElement('span');
    lblEl.textContent = label;
    row.appendChild(lblEl);
    row.onclick = action;
    card.appendChild(row);
  });

  container.appendChild(card);
}

function _dayGridBtn(label, isSource, onclick) {
  const btn = document.createElement('button');
  btn.className = 'mob-day-grid-btn';
  btn.textContent = label;
  if (isSource) {
    btn.disabled = true;
  } else {
    btn.onclick = onclick;
  }
  return btn;
}

function _moveTaskToCol(taskId, targetColId) {
  let sourceColId = null;
  allCols().forEach(c => { if ((state[c.id] || []).some(t => t.id === taskId)) sourceColId = c.id; });
  const task = sourceColId != null ? state[sourceColId].find(t => t.id === taskId) : null;
  if (!task || task.pending) return;
  if (sourceColId === targetColId) { overlay = null; render(); return; }
  if (!state[targetColId]) state[targetColId] = [];

  // Revert is scoped to the two columns this move touches.
  const prevSource = [...state[sourceColId]];
  const prevTarget = [...state[targetColId]];
  overlay = null;
  optimistic(
    () => {
      state[sourceColId] = state[sourceColId].filter(t => t.id !== taskId);
      state[targetColId].push(task);
    },
    () => taskApiUpdate(taskId, { form_id: targetColId }),
    () => { state[sourceColId] = prevSource; state[targetColId] = prevTarget; },
  );
}

// ── Add-task sheet ─────────────────────────────────────────────────────────────

function _buildAddSheet(container) {
  const scrim = document.createElement('div');
  scrim.className = 'mob-scrim';
  scrim.onclick = () => { overlay = null; render(); };
  container.appendChild(scrim);

  const sheet = document.createElement('div');
  sheet.className = 'mob-sheet';

  const handle = document.createElement('div');
  handle.className = 'mob-grab-handle';
  sheet.appendChild(handle);

  if (overlay.step === 1) {
    const stepLbl = document.createElement('div');
    stepLbl.className = 'mob-sheet-section-label';
    stepLbl.textContent = t('mobStep1');
    sheet.appendChild(stepLbl);

    const pills = document.createElement('div');
    pills.className = 'mob-label-pills';

    legendOrder.filter(k => k !== 't-locked' && k !== 'done').forEach(k => {
      const cfg  = typeConfig[k] || {};
      const pill = document.createElement('button');
      pill.className = 'mob-label-pill';
      pill.textContent = cfg.label || k;
      pill.style.background   = cfg.bg;
      pill.style.borderColor  = cfg.border;
      pill.style.color        = cfg.text;
      if (cfg.dashed) pill.style.borderStyle = 'dashed';
      pill.onclick = () => { overlay.selectedType = k; overlay.step = 2; render(); };
      pills.appendChild(pill);
    });

    const newPill = document.createElement('button');
    newPill.className = 'mob-label-pill mob-label-new';
    newPill.textContent = '+ ' + t('addLabel').replace(/^\+\s*/, '');
    newPill.onclick = () => { overlay = null; render(); openAddPanel(null); };
    pills.appendChild(newPill);

    sheet.appendChild(pills);
  } else {
    const stepLbl = document.createElement('div');
    stepLbl.className = 'mob-sheet-section-label';
    stepLbl.textContent = t('mobStep2');
    sheet.appendChild(stepLbl);

    const cfg = typeConfig[overlay.selectedType] || {};

    const inputRow = document.createElement('div');
    inputRow.className = 'mob-name-input-row';
    inputRow.style.background   = cfg.bg   || '';
    inputRow.style.borderColor  = cfg.border || '';
    inputRow.style.color        = cfg.text  || '';

    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.className   = 'mob-name-input';
    inp.placeholder = t('addTaskPh');
    inp.maxLength   = 60;
    inp.value       = overlay.typedText || '';
    inp.addEventListener('input', () => { overlay.typedText = inp.value; });

    const addBtn = document.createElement('button');
    addBtn.className   = 'mob-name-add-btn';
    addBtn.textContent = t('addDayConfirm');

    // Capture before overlay is nulled
    const _dayId = overlay.dayId;
    const _type  = overlay.selectedType;

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = inp.value.trim();
        if (text && _dayId) { overlay = null; addTask(_dayId, text, _type); }
      }
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const text = inp.value.trim();
        if (text && _dayId) { addTask(_dayId, text, _type); overlay.typedText = ''; render(); }
      }
      if (e.key === 'Escape') { overlay = null; render(); }
    });

    addBtn.onclick = () => {
      const text = inp.value.trim();
      if (text && _dayId) { overlay = null; addTask(_dayId, text, _type); }
    };

    inputRow.appendChild(inp);
    inputRow.appendChild(addBtn);
    sheet.appendChild(inputRow);

    const hint = document.createElement('div');
    hint.className   = 'mob-name-hint';
    hint.textContent = t('mobAddHint');
    sheet.appendChild(hint);

    requestAnimationFrame(() => inp.focus());
    _addVpListener(sheet);
  }

  container.appendChild(sheet);
}

// ── Side menu ──────────────────────────────────────────────────────────────────

function _buildSideMenu(container) {
  const scrim = document.createElement('div');
  scrim.className = 'mob-scrim';
  scrim.onclick = () => { overlay = null; render(); };
  container.appendChild(scrim);

  const panel = document.createElement('div');
  panel.className = 'mob-side-menu';

  // Signed in
  _menuSection(panel, t('mobSignedIn'), () => {
    const info = document.createElement('span');
    info.className   = 'mob-menu-info';
    info.textContent = _token ? t('mobUser') : t('mobAnonymous');
    return [info];
  });

  // Account
  _menuSection(panel, t('mobAccount'), () => {
    const addBtn = document.createElement('button');
    addBtn.className   = 'mob-menu-btn';
    addBtn.textContent = t('accountAdd');
    addBtn.onclick = function() {
      this.disabled = true;
      addAccount()
        .then(token => { overlay = null; render(); showTokenModal(token); })
        .catch(() => showAlert(t('accountCreateFailed')))
        .finally(() => { this.disabled = false; });
    };

    const refreshBtn = document.createElement('button');
    refreshBtn.className   = 'mob-menu-btn';
    refreshBtn.textContent = t('accountRefreshToken');
    refreshBtn.onclick = () => {
      showConfirm(t('accountRefreshConfirm'), () => {
        refreshToken(_token)
          .then(token => { overlay = null; render(); showTokenModal(token); })
          .catch(() => showAlert(t('accountRefreshFailed')));
      });
    };

    const delBtn = document.createElement('button');
    delBtn.className   = 'mob-menu-btn';
    delBtn.textContent = t('accountDelete');
    delBtn.onclick = () => {
      showConfirm(t('accountDeleteConfirm'), () => {
        deleteAccount(_token).then(res => {
          if (res.ok) window.location.href = '/';
          else showAlert(t('accountDeleteFailed'));
        });
      });
    };

    return [addBtn, refreshBtn, delBtn];
  });

  // Labels
  _menuSection(panel, t('actLabels'), () => {
    const list = document.createElement('div');
    list.className = 'mob-menu-labels';

    legendOrder.forEach(key => {
      const cfg = typeConfig[key];
      if (!cfg) return;

      const row = document.createElement('div');
      row.className = 'mob-menu-label-row';

      const swatch = document.createElement('span');
      swatch.className = 'mob-menu-swatch';
      swatch.style.background  = cfg.bg;
      swatch.style.borderColor = cfg.border;
      row.appendChild(swatch);

      const name = document.createElement('span');
      name.className   = 'mob-menu-label-name';
      name.textContent = cfg.label;
      row.appendChild(name);

      const del = document.createElement('button');
      del.className   = 'mob-menu-label-del';
      del.textContent = '×';
      del.onclick = () => { overlay = null; render(); deleteLabel(key); };
      row.appendChild(del);

      list.appendChild(row);
    });

    const addRow = document.createElement('button');
    addRow.className   = 'mob-menu-label-add';
    addRow.textContent = t('addLabel');
    addRow.onclick = () => { overlay = null; render(); openAddPanel(null); };
    list.appendChild(addRow);

    return [list];
  });

  // Settings
  _menuSection(panel, t('actSettings'), () => {
    const langRow = document.createElement('div');
    langRow.className = 'mob-settings-row';

    ['en', 'ru'].forEach(l => {
      const btn = document.createElement('button');
      btn.className   = 'mob-settings-pill' + (lang === l ? ' active' : '');
      btn.textContent = l.toUpperCase();
      btn.onclick = () => {
        const prev = lang;
        pessimisticMeta(
          () => { lang = l; applyLangToStaticUI(); renderScaleBtns(); },
          () => { lang = prev; applyLangToStaticUI(); renderScaleBtns(); },
        );
      };
      langRow.appendChild(btn);
    });

    const scaleRow = document.createElement('div');
    scaleRow.className = 'mob-settings-row';

    const minus = document.createElement('button');
    minus.className   = 'mob-settings-pill';
    minus.textContent = '− ' + t('scaleSmaller');
    minus.onclick = () => {
      const idx = UI_SCALES.indexOf(uiScale);
      if (idx <= 0) return;
      const prev = uiScale;
      pessimisticMeta(() => applyScale(UI_SCALES[idx - 1]), () => applyScale(prev));
    };

    const plus = document.createElement('button');
    plus.className   = 'mob-settings-pill';
    plus.textContent = t('scaleLarger') + ' +';
    plus.onclick = () => {
      const idx = UI_SCALES.indexOf(uiScale);
      if (idx >= UI_SCALES.length - 1) return;
      const prev = uiScale;
      pessimisticMeta(() => applyScale(UI_SCALES[idx + 1]), () => applyScale(prev));
    };

    scaleRow.appendChild(minus);
    scaleRow.appendChild(plus);

    const loadRow = document.createElement('div');
    loadRow.className = 'mob-settings-row';

    const loadLbl = document.createElement('span');
    loadLbl.className    = 'mob-menu-info';
    loadLbl.style.alignSelf = 'center';
    loadLbl.textContent = t('customLoad');
    loadRow.appendChild(loadLbl);

    const loadBtn = document.createElement('button');
    loadBtn.className   = 'mob-settings-pill' + (customLoad ? ' active' : '');
    loadBtn.textContent = customLoad ? t('on') : t('off');
    loadBtn.setAttribute('aria-pressed', customLoad ? 'true' : 'false');
    loadBtn.onclick = () => {
      const prev = customLoad;
      pessimisticMeta(
        () => { customLoad = !customLoad; renderCustomLoadBtn(); },
        () => { customLoad = prev; renderCustomLoadBtn(); },
      );
    };
    loadRow.appendChild(loadBtn);

    return [langRow, scaleRow, loadRow];
  });

  // Help
  _menuSection(panel, t('actInstructions'), () => {
    const info = document.createElement('span');
    info.className   = 'mob-menu-info';
    info.textContent = t('hint');
    return [info];
  });

  container.appendChild(panel);
}

function _menuSection(parent, label, buildFn) {
  const section = document.createElement('div');
  section.className = 'mob-menu-section';

  const heading = document.createElement('div');
  heading.className   = 'mob-menu-section-label';
  heading.textContent = label;
  section.appendChild(heading);

  buildFn().forEach(el => section.appendChild(el));
  parent.appendChild(section);
}

// ── Unscheduled drawer ─────────────────────────────────────────────────────────

function _buildUnschedDrawer(container) {
  const colId = overlay.colId;
  const tasks = state[colId] || [];

  const scrim = document.createElement('div');
  scrim.className = 'mob-scrim';
  scrim.onclick = () => { overlay = null; render(); };
  container.appendChild(scrim);

  const drawer = document.createElement('div');
  drawer.className = 'mob-unsched-drawer';

  const handle = document.createElement('div');
  handle.className = 'mob-grab-handle mob-grab-handle--sky';
  drawer.appendChild(handle);

  // Header
  const hdrBlock = document.createElement('div');
  hdrBlock.className = 'mob-unsched-drawer-header';

  const lbl = document.createElement('span');
  lbl.className   = 'mob-unsched-drawer-label';
  lbl.textContent = t('mobUnscheduled').toUpperCase();
  hdrBlock.appendChild(lbl);

  const countEl = document.createElement('span');
  countEl.className   = 'mob-unsched-drawer-count';
  countEl.textContent = `${tasks.length} ${t('mobTasksWaiting')}`;
  hdrBlock.appendChild(countEl);

  const addBtn = document.createElement('button');
  addBtn.className   = 'mob-unsched-add-btn';
  addBtn.textContent = '+ ' + t('addTask').replace(/^\+\s*/, '');
  addBtn.onclick = () => {
    overlay = { kind: 'add', step: 1, dayId: colId, selectedType: null, typedText: '' };
    render();
  };
  hdrBlock.appendChild(addBtn);
  drawer.appendChild(hdrBlock);

  // Task list
  const taskList = document.createElement('div');
  taskList.className = 'mob-unsched-task-list';

  tasks.forEach(task => {
    const row = document.createElement('div');
    row.className = 'mob-unsched-task-row';

    const taskEl = _buildMobileTaskEl(task, colId);
    row.appendChild(taskEl);

    const schedBtn = document.createElement('button');
    schedBtn.className   = 'mob-sched-btn';
    schedBtn.textContent = t('mobSchedule') + ' ›';
    schedBtn.onclick = e => {
      e.stopPropagation();
      overlay = { kind: 'action', taskId: task.id, fromColId: colId };
      render();
    };
    row.appendChild(schedBtn);

    taskList.appendChild(row);
  });

  drawer.appendChild(taskList);

  const hint = document.createElement('div');
  hint.className   = 'mob-unsched-hint';
  hint.textContent = t('mobUnschedHint');
  drawer.appendChild(hint);

  container.appendChild(drawer);
}

// ── Visual viewport keyboard adjustment ────────────────────────────────────────

function _addVpListener(sheet) {
  if (!window.visualViewport || !sheet) return;
  _vpResizeListener = () => {
    const inset = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
    sheet.style.bottom = Math.max(0, inset) + 'px';
  };
  window.visualViewport.addEventListener('resize', _vpResizeListener);
}

function _removeVpListener() {
  if (!window.visualViewport || !_vpResizeListener) return;
  window.visualViewport.removeEventListener('resize', _vpResizeListener);
  _vpResizeListener = null;
}
