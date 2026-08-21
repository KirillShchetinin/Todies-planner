// mobile.js — the mobile renderer.
//
// Below the 720px breakpoint this replaces the desktop board entirely: a day
// strip, expandable day heroes, a quick-add bar, and sheets/drawers in place of
// right-click menus and drag-and-drop. It builds its own DOM inside #board and
// #main; nothing desktop-only is reachable from here.
//
// Depends only on the common layer — see frontend/common/.

let expandedDays = new Set();
let overlay = null;
let _vpResizeListener = null;
let _docScrollListener = null;
let _didInitialScroll = false;
let _didStripScroll = false;
let _lastTapTaskId = null;
let _lastTapTime = 0;

registerView('mobile', {
  render:   renderMobile,
  teardown: teardownMobile,
  // #board is the only scroller on mobile; the document itself is locked.
  scrollEl: () => document.getElementById('board'),
});

// ── Entry point ────────────────────────────────────────────────────────────────

function renderMobile() {
  _initMobileState();
  _lockDocumentScroll();
  _renderMobileHeader();
  _renderMobileBoard();
  _renderQuickAdd();
  _renderOverlay();
  // The first render runs before forms/tasks land, so today's hero doesn't
  // exist yet — keep trying until it does, then never again for this session.
  if (!_didInitialScroll) _scrollToToday();
}

// The shell is exactly viewport-tall, so a scrolled document takes the header
// off the top *and* pulls the board's bottom edge above the fold, leaving a
// dead strip under it. overflow: hidden doesn't stop every scroll — iOS moves
// the document itself to reveal a focused input — and once moved, nothing the
// user can do brings it back. Snap it home whenever it drifts.
function _lockDocumentScroll() {
  if (_docScrollListener) return;
  _docScrollListener = () => {
    const doc = document.scrollingElement;
    if (doc && doc.scrollTop !== 0) doc.scrollTop = 0;
  };
  window.addEventListener('scroll', _docScrollListener, { passive: true });
}

function _scrollToToday() {
  requestAnimationFrame(() => {
    if (_didInitialScroll) return;
    const todayEl = document.querySelector('.mob-day-hero.is-today');
    if (!todayEl) return;
    _didInitialScroll = true;
    // Scroll #board itself: scrollIntoView also scrolls every ancestor, and the
    // document must never move on mobile — it can't be scrolled back.
    const board = document.getElementById('board');
    board.scrollTop += todayEl.getBoundingClientRect().top - board.getBoundingClientRect().top;
  });
}

// Called by view.js when the viewport crosses back over the breakpoint: the
// desktop board renders into #board, but these live outside it.
function teardownMobile() {
  document.getElementById('mobile-header')?.remove();
  document.getElementById('mob-quick-add')?.remove();
  document.getElementById('mob-overlay')?.remove();
  _removeVpListener();
  if (_docScrollListener) {
    window.removeEventListener('scroll', _docScrollListener);
    _docScrollListener = null;
  }
  _didInitialScroll = false;
  _didStripScroll = false;
}

// ── State helpers ──────────────────────────────────────────────────────────────

function _initMobileState() {
  const allColIds = new Set(allCols().map(c => c.id));
  for (const id of [...expandedDays]) {
    if (!allColIds.has(id)) expandedDays.delete(id);
  }
  if (expandedDays.size === 0) {
    const today = todayCol();
    if (today) expandedDays.add(today.id);
  }
}

function _remainingCount(colId) {
  return (state[colId] || []).filter(t => !t.done && !t.cancelled).length;
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
  // The header is rebuilt wholesale on every render, which resets the strip's
  // scroll to 0. Carry the old position over so re-rendering never yanks the
  // strip away from where the user scrolled it.
  const prevScroll = hdr.querySelector('.mob-day-strip')?.scrollLeft;
  hdr.innerHTML = '';

  // Title row
  const titleRow = mkEl('div', 'mob-title-row');

  const title = mkEl('span', 'mob-title', t('appTitle'));
  titleRow.appendChild(title);

  const btns = mkEl('div', 'mob-title-btns');

  const labelsBtn = mkEl('button', 'mob-icon-btn', '◆');
  labelsBtn.title = t('actLabels');
  labelsBtn.onclick = () => { overlay = { kind: 'menu', tab: 'labels' }; render(); };
  btns.appendChild(labelsBtn);

  const menuBtn = mkEl('button', 'mob-icon-btn', '≡');
  menuBtn.title = t('actSettings');
  menuBtn.onclick = () => { overlay = { kind: 'menu' }; render(); };
  btns.appendChild(menuBtn);

  titleRow.appendChild(btns);
  hdr.appendChild(titleRow);

  // Day strip
  const strip = mkEl('div', 'mob-day-strip');
  _buildDayStrip(strip);
  hdr.appendChild(strip);
  if (prevScroll) strip.scrollLeft = prevScroll;
}

function _buildDayStrip(container) {
  if (cols.length === 0) return;

  const weekKeys = weekBuckets().map(w => w.key).filter(k => k !== NODATE_WEEK);

  // customLoad ON: strip only lists loaded weeks; older weeks are revealed
  // via the "earlier weeks" chip prepended below. Frozen at load — toggling
  // customLoad never changes the view until refresh.
  const _loadedKeys = customLoadActive
    ? new Set(cols.filter(c => loadedFormIds.has(c.id)).map(c => colWeekInfo(c)?.key).filter(Boolean))
    : null;
  const visibleWeekKeys = _loadedKeys ? weekKeys.filter(k => _loadedKeys.has(k)) : weekKeys;

  if (hasUnloadedWeeks()) {
    const chip = mkEl('button', 'mob-earlier-chip', loadingEarlier ? '…' : t('earlierWeeks'));
    chip.disabled = loadingEarlier;
    chip.onclick = loadEarlierWeeks;
    container.appendChild(chip);
  }

  const INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const now = new Date();
  let todayChip = null;

  visibleWeekKeys.forEach((weekKey, wi) => {
    const monday = weekKeyToMonday(weekKey);
    if (!monday) return;

    // Add a week-separator gap between weeks (except before the first)
    if (wi > 0) {
      const sep = mkEl('div', 'mob-strip-week-sep');
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

      const chip = mkEl('div', 'mob-day-chip');
      if (col && expandedDays.has(col.id)) chip.classList.add('expanded');
      if (isToday) chip.classList.add('today');
      if (!col)    chip.classList.add('no-col');

      const letter = mkEl('span', 'mob-chip-letter', initial);
      chip.appendChild(letter);

      const dateEl = mkEl('span', 'mob-chip-date' + (isToday ? ' today' : ''), chipDate.getDate());
      chip.appendChild(dateEl);

      const remEl = mkEl('span', 'mob-chip-rem');
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

  // Centre today's chip on the first build only — re-centring on every render
  // would drag the strip back to today each time a day is tapped.
  if (todayChip && !_didStripScroll) {
    _didStripScroll = true;
    requestAnimationFrame(() => todayChip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' }));
  }
}

// ── Board ──────────────────────────────────────────────────────────────────────

function _renderMobileBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  const allWeeks = weekBuckets();

  // customLoad ON: render only weeks with a loaded col; week.order stays the
  // ABSOLUTE index so unscheduled pairing never re-pairs (see board.js).
  const _colLoaded = col => !customLoadActive || loadedFormIds.has(col.id);
  const weeks = customLoadActive
    ? allWeeks.filter(w => w.slots.some(c => c && _colLoaded(c)))
    : allWeeks;

  const area = mkEl('div', 'mob-scroll-area');

  if (weeks.length === 0 && weekUnscheduled.length > 0) {
    area.appendChild(_buildUnschedChip(weekUnscheduled[0]));
  }

  weeks.forEach((week) => {
    const unschedCol = weekUnscheduled[week.order] || weekUnscheduled[weekUnscheduled.length - 1];
    if (unschedCol) area.appendChild(_buildUnschedChip(unschedCol));

    const dayList = mkEl('div', 'mob-day-list');

    let collapsed = 0;
    week.slots.forEach(col => {
      if (!col || !_colLoaded(col)) return;
      const isHero = expandedDays.has(col.id);
      if (!isHero) collapsed++;
      dayList.appendChild(isHero ? _buildDayHero(col) : _buildDayRow(col));
    });

    // Grow by row count so rows get an equal share across weeks, not per week.
    dayList.style.flexGrow = collapsed;

    area.appendChild(dayList);
  });

  board.appendChild(area);
}

// ── Unscheduled chip ───────────────────────────────────────────────────────────

function _buildUnschedChip(col) {
  const tasks = state[col.id] || [];

  const chip = mkEl('div', 'mob-unsched-chip');

  const label = mkEl('span', 'mob-unsched-label', `${t('mobUnscheduled')} · ${tasks.length}`);
  chip.appendChild(label);

  const dots = mkEl('div', 'mob-unsched-dots');
  tasks.slice(0, 20).forEach(task => {
    const cfg = typeStyle(task.type);
    const dot = mkEl('span', 'mob-unsched-dot');
    dot.style.background = cfg.border;
    dots.appendChild(dot);
  });
  if (tasks.length > 20) {
    const overflow = mkEl('span', 'mob-unsched-overflow', `+${tasks.length - 20}`);
    dots.appendChild(overflow);
  }
  chip.appendChild(dots);

  const spacer = document.createElement('span');
  spacer.style.flex = '1';
  chip.appendChild(spacer);

  const arrow = mkEl('span', 'mob-unsched-arrow', '›');
  chip.appendChild(arrow);

  chip.onclick = () => { overlay = { kind: 'unsched', colId: col.id }; render(); };
  return chip;
}

// ── DayRow (collapsed) ─────────────────────────────────────────────────────────

function _buildDayRow(col) {
  const isToday = isTodayDate(col.date);
  const tasks   = state[col.id] || [];

  const btn = mkEl('button', 'mob-day-row');

  // Date block
  const dateBlock = mkEl('div', 'mob-row-date');

  const dayLabel = mkEl('span', 'mob-row-daylabel' + (isToday ? ' today' : ''), (col.label || '').slice(0, 3).toUpperCase());
  dateBlock.appendChild(dayLabel);

  if (col.date) {
    const d = parseColDate(col.date);
    const dayNum = mkEl('span', 'mob-row-daynum', d ? d.getDate() : '');
    dateBlock.appendChild(dayNum);
  }

  btn.appendChild(dateBlock);

  // Separator
  const sep = mkEl('div', 'mob-row-sep');
  btn.appendChild(sep);

  // Dot row
  const dotRow = mkEl('div', 'mob-dot-row');
  if (tasks.length === 0) {
    const empty = mkEl('span', 'mob-row-empty', t('mobEmpty'));
    dotRow.appendChild(empty);
  } else {
    tasks.forEach(task => {
      const cfg = typeStyle(task.type);
      const dot = mkEl('span', 'mob-dot');
      dot.style.background = cfg.border;
      if (task.done || task.cancelled) dot.style.opacity = '0.3';
      dotRow.appendChild(dot);
    });
  }
  btn.appendChild(dotRow);

  // Important indicator
  if (tasks.some(t => t.important && !t.done && !t.cancelled)) {
    const imp = mkEl('span', 'mob-row-imp', '!');
    btn.appendChild(imp);
  }

  // Remaining count
  const rem = _remainingCount(col.id);
  const remEl = mkEl('span', 'mob-row-rem', rem === 0 ? '✓' : rem);
  btn.appendChild(remEl);

  // Chevron
  const chev = mkEl('span', 'mob-row-chev', '›');
  btn.appendChild(chev);

  btn.onclick = () => { expandedDays.add(col.id); render(); };
  return btn;
}

// ── DayHero (expanded) ─────────────────────────────────────────────────────────

function _buildDayHero(col) {
  const isToday = isTodayDate(col.date);
  const tasks   = state[col.id] || [];
  const done    = tasks.filter(t => t.done || t.cancelled).length;

  const hero = mkEl('div', 'mob-day-hero' + (isToday ? ' is-today' : ''));

  // Header row
  const hdr = mkEl('div', 'mob-hero-hdr');

  const left = mkEl('div', 'mob-hero-left');

  const dayName = mkEl('span', 'mob-hero-dayname', translateLabel(col.label));
  left.appendChild(dayName);

  const heroDate = parseColDate(col.date);
  if (heroDate) {
    const dateSpan = mkEl('span', 'mob-hero-date', heroDate.toLocaleDateString(t('dayLocale'), { month: 'short', day: 'numeric' }));
    left.appendChild(dateSpan);
  }

  if (isToday) {
    const flames = mkEl('span', 'today-flames');
    flames.innerHTML = '<span>🔥</span><span>🔥</span><span>🔥</span>';
    left.appendChild(flames);
  }

  hdr.appendChild(left);

  const right = mkEl('div', 'mob-hero-right');

  const count = mkEl('span', 'mob-hero-count', `${done}done / ${tasks.length}total`);
  right.appendChild(count);

  const chev = mkEl('span', 'mob-hero-chev', '▾');
  right.appendChild(chev);

  hdr.appendChild(right);
  hdr.onclick = () => { expandedDays.delete(col.id); render(); };
  hero.appendChild(hdr);

  // Divider
  const divider = mkEl('div', 'mob-hero-divider');
  hero.appendChild(divider);

  // Task list
  const taskList = mkEl('div', 'mob-task-list');
  tasks.forEach(task => taskList.appendChild(_buildMobileTaskEl(task, col.id)));
  hero.appendChild(taskList);

  // Add task button
  const addBtn = mkEl('button', 'add-btn', t('addTask'));
  addBtn.onclick = () => {
    overlay = { kind: 'add', step: 1, dayId: col.id, targetDate: col.date || null, selectedType: null, typedText: '' };
    render();
  };
  hero.appendChild(addBtn);

  return hero;
}

// ── Mobile task element ────────────────────────────────────────────────────────

function _buildMobileTaskEl(task, fromColId) {
  const el = mkEl('div', 'task' + (task.done ? ' done' : '') + (task.cancelled ? ' cancelled' : ''));
  el.dataset.id = task.id;
  el.title = task.text;
  applyTaskStyle(el, task.type, task.done, task.cancelled);

  if (task.important) {
    const imp = mkEl('span', 'task-important', '!');
    el.appendChild(imp);
  }

  const txt = mkEl('span', 'task-text', task.text);
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

  const row = mkEl('div', 'mob-quick-add-btn');

  // Opens the add sheet aimed at today. Today's form may not exist yet — the
  // sheet resolves the date to a form (creating it) only once a task is added.
  const openAdd = pickDate => {
    const today = todayDateStr();
    overlay = {
      kind: 'add', step: 1,
      dayId: todayCol()?.id || null,
      targetDate: today,
      pickDate,
      selectedType: null, typedText: '',
    };
    render();
  };

  const btn = mkEl('button', 'mob-qa-main');

  const plus = mkEl('span', 'mob-qa-plus', '+');
  btn.appendChild(plus);

  const lbl = mkEl('span', 'mob-qa-label', t('mobQuickAdd'));
  btn.appendChild(lbl);

  btn.onclick = () => openAdd(false);
  row.appendChild(btn);

  const todayBtn = mkEl('button', 'mob-qa-today', t('mobToday') + ' ▾');
  todayBtn.title       = t('mobPickDay');
  todayBtn.onclick     = () => openAdd(true);
  row.appendChild(todayBtn);

  qa.appendChild(row);
}

// ── Overlay dispatcher ─────────────────────────────────────────────────────────

function _renderOverlay() {
  _removeVpListener();
  document.getElementById('mob-overlay')?.remove();
  if (!overlay) return;

  const container = document.createElement('div');
  container.id = 'mob-overlay';

  if      (overlay.kind === 'action') _buildActionSheet(container);
  else if (overlay.kind === 'details') _buildDetailsSheet(container);
  else if (overlay.kind === 'add')    _buildAddSheet(container);
  else if (overlay.kind === 'menu')   _buildSideMenu(container);
  else if (overlay.kind === 'unsched') _buildUnschedDrawer(container);

  document.body.appendChild(container);
}

// ── Action sheet (long-press) ──────────────────────────────────────────────────

function _buildActionSheet(container) {
  const task = findTask(overlay.taskId);
  if (!task) { overlay = null; return; }

  const scrim = mkEl('div', 'mob-scrim');
  scrim.onclick = () => { overlay = null; render(); };
  container.appendChild(scrim);

  const card = mkEl('div', 'mob-sheet');

  const handle = mkEl('div', 'mob-grab-handle');
  card.appendChild(handle);

  // Task preview — tap the name to rename it in place. A pending task has no
  // server id yet, so it stays read-only until the create lands.
  const editing = !!overlay.editingName && !task.pending;
  card.appendChild(editing ? _buildNameEditRow(task, card)
                           : _buildActionPreview(task));

  // MOVE TO section
  const moveLabel = mkEl('div', 'mob-sheet-section-label', t('mobMoveTo'));
  card.appendChild(moveLabel);

  const grid = mkEl('div', 'mob-day-grid');

  const fromColId = overlay.fromColId;
  const taskId    = overlay.taskId;  // capture before overlay can be nulled

  // Four fixed targets, the second of which depends on where the task sits
  // (see below). Everything resolved here is READ-ONLY: a button whose day
  // column or unscheduled container doesn't exist yet creates it when tapped,
  // never on render. A button is disabled only when its target is where the
  // task already is.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = colDateStr(tomorrow);

  const weekKey = _sourceWeekKey(fromColId);
  const nextKey = _weekKeyAfter(weekKey);

  grid.appendChild(_dayGridBtn(
    t('mobTomorrow'),
    colForDate(tomorrowStr)?.id === fromColId,
    () => _moveTaskToDate(taskId, tomorrowStr),
  ));

  // "Later" is the way off the calendar and into this week's unscheduled box —
  // meaningless for a task that already sits in one, so that slot flips to the
  // way back: "Today".
  const inUnsched = weekUnscheduled.some(u => u.id === fromColId);

  grid.appendChild(inUnsched
    ? _dayGridBtn(
        t('mobMoveToday'),
        false,
        () => _moveTaskToDate(taskId, todayDateStr()),
      )
    : _dayGridBtn(
        t('mobLater'),
        !weekKey || _unschedIdForWeek(weekKey) === fromColId,
        () => _moveTaskToWeekUnsched(taskId, weekKey),
      ));

  grid.appendChild(_dayGridBtn(
    t('mobNextWeek'),
    !nextKey || _unschedIdForWeek(nextKey) === fromColId,
    () => _moveTaskToWeekUnsched(taskId, nextKey),
  ));

  grid.appendChild(_dateGridCell(taskId));

  card.appendChild(grid);

  const sep = mkEl('div', 'mob-sheet-sep');
  card.appendChild(sep);

  // Action rows — use captured taskId, not overlay.taskId
  [
    { icon: '≡', label: t('mobDetails'), cls: '', action: () => _openTaskDetails(taskId) },
    { icon: '✓', label: t('mobMarkDone'), cls: '', action: () => { overlay = null; toggleDone(taskId); } },
    { icon: '!',  label: t('mobMarkImportant'), cls: 'mob-action-important',
      action: () => { overlay = null; toggleImportant(taskId); render(); } },
    { icon: '✕', label: t('mobCancelTask'), cls: 'mob-action-cancel', action: () => { overlay = null; toggleCancelled(taskId); } },
    { icon: '🗑', label: t('mobDelete'), cls: 'mob-action-delete', action: () => { overlay = null; deleteTask(taskId); } },
  ].forEach(({ icon, label, cls, action }) => {
    const row = mkEl('button', 'mob-action-row' + (cls ? ' ' + cls : ''));
    const iconEl = mkEl('span', 'mob-action-icon', icon);
    row.appendChild(iconEl);
    const lblEl = document.createElement('span');
    lblEl.textContent = label;
    row.appendChild(lblEl);
    row.onclick = action;
    card.appendChild(row);
  });

  container.appendChild(card);

  // Only the rename field raises the keyboard from this sheet, so the viewport
  // maths is wired up only while it is open (same handling as the add sheet).
  if (editing) _addVpListener(card);
}

// ── Rename (action sheet preview) ──────────────────────────────────────────────

function _buildActionPreview(task) {
  const preview = mkEl('div', 'task');
  applyTaskStyle(preview, task.type, task.done, task.cancelled);
  const previewTxt = mkEl('span', 'task-text', task.text);
  preview.appendChild(previewTxt);
  if (!task.pending) {
    preview.classList.add('mob-preview-editable');
    preview.title = t('mobRename');
    const pencil = mkEl('span', 'mob-preview-edit-icon', '✎');
    preview.appendChild(pencil);
    preview.onclick = () => { if (overlay) { overlay.editingName = true; render(); } };
  }
  return preview;
}

// The preview swapped for an editable field, styled like the add sheet's name
// row so both name-entry surfaces look the same. Any render() rebuilds the
// sheet, so what was typed is kept on the overlay, like `draft`/`typedText`.
function _buildNameEditRow(task, card) {
  const cfg    = typeConfig[task.type] || {};
  const taskId = task.id;

  const row = mkEl('div', 'mob-name-input-row');
  row.style.background  = cfg.bg     || '';
  row.style.borderColor = cfg.border || '';
  row.style.color       = cfg.text   || '';

  // No draft yet means this is the first build, not a rebuild mid-edit: only
  // then is the name preselected, so a render() can't eat what was typed.
  const fresh = overlay.nameDraft == null;

  const inp = document.createElement('input');
  inp.type        = 'text';
  inp.className   = 'mob-name-input';
  inp.placeholder = t('addTaskPh');
  inp.setAttribute('aria-label', t('mobRename'));
  inp.value = fresh ? task.text : overlay.nameDraft;
  inp.addEventListener('input', () => { if (overlay) overlay.nameDraft = inp.value; });
  inp.addEventListener('focus', () => card.classList.add('kb-reserve'));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); _commitTaskRename(taskId, inp.value); }
    if (e.key === 'Escape') { e.preventDefault(); overlay = null; render(); }
  });

  const saveBtn = mkEl('button', 'mob-name-add-btn', t('modalSave'));
  saveBtn.onclick = () => _commitTaskRename(taskId, inp.value);

  row.appendChild(inp);
  row.appendChild(saveBtn);

  requestAnimationFrame(() => { inp.focus(); if (fresh) inp.select(); });

  return row;
}

// Commits the rename and drops back to the preview, leaving the sheet open so
// the new name is visible. An empty or unchanged name is just a cancel.
function _commitTaskRename(taskId, value) {
  const name = value.trim();
  const task = findTask(taskId);
  if (overlay) { overlay.editingName = false; overlay.nameDraft = null; }
  if (!name || !task || task.pending || name === task.text) { render(); return; }
  renameTask(taskId, name);   // optimistic — ends in render()
}

function _dayGridBtn(label, isSource, onclick) {
  const btn = mkEl('button', 'mob-day-grid-btn', label);
  if (isSource) {
    btn.disabled = true;
  } else {
    btn.onclick = onclick;
  }
  return btn;
}

// The fourth cell: a transparent date input over a chip, the same trick the add
// sheet's target chip uses. A span, not a button — an input nested in a button
// swallows the tap. The move waits for the picker to CLOSE (blur) rather than
// for `change`, which iOS fires on every wheel settle: committing on change
// would file the task under a date the wheel merely passed through.
function _dateGridCell(taskId) {
  const cell = mkEl('span', 'mob-day-grid-btn mob-day-grid-btn--date');

  const txt = document.createElement('span');
  txt.textContent = t('mobCustomDate');
  cell.appendChild(txt);

  const inp = document.createElement('input');
  inp.type      = 'date';
  inp.className = 'mob-target-input';
  inp.setAttribute('aria-label', t('mobPickDay'));

  let picked = null;
  inp.addEventListener('change', () => {
    const date = isoToDateStr(inp.value);
    if (!date) return;
    picked = date;
    txt.textContent = _targetLabel(date);
  });
  inp.addEventListener('blur', () => { if (picked) _moveTaskToDate(taskId, picked); });
  cell.appendChild(inp);

  return cell;
}

// ── Move targets ───────────────────────────────────────────────────────────────

// The week row a move source belongs to, as an ISO week key, or null. A day
// column answers from its date; an unscheduled container answers from its
// position, since weekUnscheduled[i] is what weekBuckets()[i] pairs with.
function _sourceWeekKey(colId) {
  const col = cols.find(c => c.id === colId);
  if (col) return colWeekInfo(col)?.key || null;
  const i = weekUnscheduled.findIndex(u => u.id === colId);
  return i === -1 ? null : (weekBuckets()[i]?.key || null);
}

function _weekKeyAfter(weekKey) {
  const monday = weekKey ? weekKeyToMonday(weekKey) : null;
  if (!monday) return null;
  monday.setDate(monday.getDate() + 7);
  return colWeekInfo({ date: colDateStr(monday) })?.key || null;
}

// The unscheduled container already paired with a week, or null. Never creates.
function _unschedIdForWeek(weekKey) {
  if (!weekKey) return null;
  const order = weekBuckets().findIndex(b => b.key === weekKey);
  return order === -1 ? null : (weekUnscheduled[order]?.id ?? null);
}

// The day column for a date, creating it when that day has no form yet.
// Returns null when it neither exists nor could be created — the caller must
// then leave the task where it is.
async function _resolveDayIdForDate(dateStr) {
  const existing = colForDate(dateStr);
  if (existing) return existing.id;
  const d = parseColDate(dateStr);
  if (!d) return null;
  return addCol(d.toLocaleDateString('en-US', { weekday: 'short' }), dateStr);
}

// The unscheduled container for a week, creating what's missing. A week with no
// day column has no bucket for a container to pair with, so its Monday is
// created first — addCol re-sorts and self-heals the containers behind it.
async function _resolveUnschedIdForWeek(weekKey) {
  if (!weekKey) return null;
  let order = weekBuckets().findIndex(b => b.key === weekKey);
  if (order === -1) {
    const monday = weekKeyToMonday(weekKey);
    if (!monday) return null;
    const created = await addCol(monday.toLocaleDateString('en-US', { weekday: 'short' }), colDateStr(monday));
    if (!created) return null;
    order = weekBuckets().findIndex(b => b.key === weekKey);
    if (order === -1) return null;
  }
  await ensureUnscheduledForWeeks();
  return weekUnscheduled[order]?.id ?? null;
}

// Move onto a calendar day. The target day is expanded so the task is visible
// where it landed, the same way the add sheet reveals a new task.
function _moveTaskToDate(taskId, dateStr) {
  const task = findTask(taskId);
  if (!task || task.pending) return;
  _resolveDayIdForDate(dateStr).then(id => {
    if (id == null) return;        // day couldn't be created → no move
    _expandDay(id);
    _moveTaskToCol(taskId, id);
  });
}

function _moveTaskToWeekUnsched(taskId, weekKey) {
  const task = findTask(taskId);
  if (!task || task.pending) return;
  _resolveUnschedIdForWeek(weekKey).then(id => {
    if (id != null) _moveTaskToCol(taskId, id);
  });
}

// Closes the sheet and hands the move to the common mutation. A pending task
// keeps the sheet open — there is nothing to move yet.
function _moveTaskToCol(taskId, targetColId) {
  const task = findTask(taskId);
  if (!task || task.pending) return;
  overlay = null;
  if (findTaskCol(taskId) === targetColId) { render(); return; }
  moveTaskToCol(taskId, targetColId);
}

// ── Details sheet ──────────────────────────────────────────────────────────────

// Swaps the action sheet for the details editor. The body is fetched lazily, so
// the sheet opens in a disabled "loading" state and re-renders once it lands —
// unless the user has already moved on to another overlay.
function _openTaskDetails(taskId) {
  const task = findTask(taskId);
  if (!task || task.pending) { overlay = null; render(); return; }
  overlay = { kind: 'details', taskId, draft: null };
  render();
  loadTaskContent(taskId).then(() => {
    if (overlay && overlay.kind === 'details' && overlay.taskId === taskId) render();
  });
}

function _buildDetailsSheet(container) {
  const task = findTask(overlay.taskId);
  if (!task) { overlay = null; return; }

  const scrim = mkEl('div', 'mob-scrim');
  scrim.onclick = () => { overlay = null; render(); };
  container.appendChild(scrim);

  // Anchored to the top of the screen, not the bottom: the keyboard rises from
  // the bottom, so a top-anchored panel is out of its reach by construction —
  // the viewport maths below only refines the fit, it is not what keeps the
  // field visible. No grab handle: that is a bottom-sheet affordance.
  const card = mkEl('div', 'mob-sheet mob-sheet-top mob-sheet-details');

  // Task preview
  const preview = mkEl('div', 'task');
  applyTaskStyle(preview, task.type, task.done, task.cancelled);
  const previewTxt = mkEl('span', 'task-text', task.text);
  preview.appendChild(previewTxt);
  card.appendChild(preview);

  const label = mkEl('div', 'mob-sheet-section-label', t('detailsTitle'));
  card.appendChild(label);

  // undefined means "never fetched"; '' is a real, cached empty body.
  const loaded = task.content !== undefined;

  const area = mkEl('textarea', 'mob-details-area');
  area.placeholder = loaded ? t('detailsPh') : t('detailsLoading');
  area.disabled    = !loaded;
  // Any render() rebuilds this sheet from scratch, so keep what was typed on
  // the overlay — same reason the add sheet carries `typedText`.
  area.value = overlay.draft !== null ? overlay.draft : (task.content || '');
  area.addEventListener('input', () => { if (overlay) overlay.draft = area.value; });
  // Tapping the field is what raises the keyboard, and the resize that follows
  // can land late or not at all. Re-sync across the animation so the sheet is
  // never left sitting under the keys.
  area.addEventListener('focus', _syncViewportSoon);
  card.appendChild(area);

  const btns = mkEl('div', 'mob-details-btns');
  const taskId = overlay.taskId;   // capture before overlay can be nulled

  const cancelBtn = mkEl('button', 'mob-details-btn', t('modalCancel'));
  cancelBtn.onclick = () => { overlay = null; render(); };
  btns.appendChild(cancelBtn);

  const saveBtn = mkEl('button', 'mob-details-btn mob-details-save', t('modalSave'));
  saveBtn.disabled = !loaded;
  saveBtn.onclick = () => {
    const value = area.value;
    overlay = null;
    saveTaskContent(taskId, value);   // optimistic — ends in render()
  };
  btns.appendChild(saveBtn);

  card.appendChild(btns);
  container.appendChild(card);

  // Not focused on open: reading the notes is as common as editing them, and
  // focusing would raise the keyboard over the sheet either way.
  _addVpListener(card);
}

// ── Add-task sheet ─────────────────────────────────────────────────────────────

function _buildAddSheet(container) {
  const scrim = mkEl('div', 'mob-scrim');
  scrim.onclick = () => { overlay = null; render(); };
  container.appendChild(scrim);

  const sheet = mkEl('div', 'mob-sheet');

  const handle = mkEl('div', 'mob-grab-handle');
  sheet.appendChild(handle);

  sheet.appendChild(_buildTargetRow());

  if (overlay.step === 1) {
    const stepLbl = mkEl('div', 'mob-sheet-section-label', t('mobStep1'));
    sheet.appendChild(stepLbl);

    const pills = mkEl('div', 'mob-label-pills');

    selectableTypeKeys().forEach(k => {
      const cfg  = typeConfig[k] || {};
      const pill = mkEl('button', 'mob-label-pill', cfg.label || k);
      pill.style.background   = cfg.bg;
      pill.style.borderColor  = cfg.border;
      pill.style.color        = cfg.text;
      if (cfg.dashed) pill.style.borderStyle = 'dashed';
      pill.onclick = () => { overlay.selectedType = k; overlay.step = 2; render(); };
      pills.appendChild(pill);
    });

    const newPill = mkEl('button', 'mob-label-pill mob-label-new', '+ ' + t('addLabel').replace(/^\+\s*/, ''));
    newPill.onclick = () => { overlay = null; render(); openAddPanel(null); };
    pills.appendChild(newPill);

    sheet.appendChild(pills);
  } else {
    const stepLbl = mkEl('div', 'mob-sheet-section-label', t('mobStep2'));
    sheet.appendChild(stepLbl);

    const cfg = typeConfig[overlay.selectedType] || {};

    const inputRow = mkEl('div', 'mob-name-input-row');
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
    // Focusing this field is what raises the keyboard. Reserve room for it in
    // the sheet's padding so the row rides up out of the way even on browsers
    // that report no visual-viewport change at all (see mobile.css).
    inp.addEventListener('focus', () => sheet.classList.add('kb-reserve'));

    const addBtn = mkEl('button', 'mob-name-add-btn', t('addDayConfirm'));

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        _submitAddSheet(inp.value.trim(), e.shiftKey);
      }
      if (e.key === 'Escape') { overlay = null; render(); }
    });

    addBtn.onclick = () => _submitAddSheet(inp.value.trim(), false);

    inputRow.appendChild(inp);
    inputRow.appendChild(addBtn);
    sheet.appendChild(inputRow);

    requestAnimationFrame(() => inp.focus());
    _addVpListener(sheet);
  }

  container.appendChild(sheet);
}

function _targetLabel(dateStr) {
  const d = parseColDate(dateStr);
  if (!d) return t('mobUnscheduled');
  return d.toLocaleDateString(t('dayLocale'), { weekday: 'short', month: 'short', day: 'numeric' });
}

// The day the task will land on. Tapping it opens the native date picker, so
// any day is reachable — including one that has no form yet.
function _buildTargetRow() {
  const row = mkEl('div', 'mob-add-target');

  const lbl = mkEl('span', 'mob-sheet-section-label', t('mobAddFor'));
  row.appendChild(lbl);

  const chip = mkEl('span', 'mob-target-chip');
  chip.title     = t('mobPickDay');

  const txt = mkEl('span', 'mob-target-text', _targetLabel(overlay.targetDate));
  chip.appendChild(txt);

  const caret = mkEl('span', 'mob-target-caret', '▾');
  chip.appendChild(caret);

  const inp = document.createElement('input');
  inp.type      = 'date';
  inp.className = 'mob-target-input';
  inp.value     = dateStrToIso(overlay.targetDate);
  inp.setAttribute('aria-label', t('mobPickDay'));
  // Re-rendering here would tear down the open native picker mid-scroll (iOS
  // fires change on every wheel settle), so the chip text is patched in place.
  inp.addEventListener('change', () => {
    const picked = isoToDateStr(inp.value);
    if (!picked || !overlay) return;
    overlay.targetDate = picked;
    overlay.dayId      = null;   // a picked date outranks the form we came from
    txt.textContent    = _targetLabel(picked);
  });
  chip.appendChild(inp);

  row.appendChild(chip);

  if (overlay.pickDate) {
    overlay.pickDate = false;
    requestAnimationFrame(() => { try { inp.showPicker(); } catch (e) { inp.focus(); } });
  }
  return row;
}

// A picked date may name a day with no form yet — create it on submit. Returns
// the form id to add the task to, or null if it couldn't be resolved.
async function _resolveAddDayId(dayId, targetDate) {
  if (dayId) { _expandDay(dayId); return dayId; }
  if (!targetDate) return null;
  const id = await _resolveDayIdForDate(targetDate);
  if (id) _expandDay(id);
  return id;
}

function _expandDay(id) {
  if (cols.some(c => c.id === id)) expandedDays.add(id);
}

function _submitAddSheet(text, keepOpen) {
  if (!text || !overlay) return;
  // Read the target now: the date chip mutates the overlay without re-rendering.
  const dayId = overlay.dayId;
  const date  = overlay.targetDate;
  const type  = overlay.selectedType;

  if (keepOpen) overlay.typedText = '';
  else          overlay = null;
  render();

  _resolveAddDayId(dayId, date).then(id => { if (id) addTask(id, text, type); });
}

// ── Side menu ──────────────────────────────────────────────────────────────────

function _buildSideMenu(container) {
  const scrim = mkEl('div', 'mob-scrim');
  scrim.onclick = () => { overlay = null; render(); };
  container.appendChild(scrim);

  const panel = mkEl('div', 'mob-side-menu');

  // Signed in
  _menuSection(panel, t('mobSignedIn'), () => {
    const info = mkEl('span', 'mob-menu-info', TOKEN ? t('mobUser') : t('mobAnonymous'));
    return [info];
  });

  // Account
  _menuSection(panel, t('mobAccount'), () => {
    const addBtn = mkEl('button', 'mob-menu-btn', t('accountAdd'));
    addBtn.onclick = function() {
      this.disabled = true;
      addAccount()
        .then(token => { overlay = null; render(); showTokenModal(token); })
        .catch(() => showAlert(t('accountCreateFailed')))
        .finally(() => { this.disabled = false; });
    };

    const refreshBtn = mkEl('button', 'mob-menu-btn', t('accountRefreshToken'));
    refreshBtn.onclick = () => {
      showConfirm(t('accountRefreshConfirm'), () => {
        refreshToken(TOKEN)
          .then(token => { overlay = null; render(); showTokenModal(token); })
          .catch(() => showAlert(t('accountRefreshFailed')));
      });
    };

    const delBtn = mkEl('button', 'mob-menu-btn', t('accountDelete'));
    delBtn.onclick = () => {
      showConfirm(t('accountDeleteConfirm'), () => {
        deleteAccount(TOKEN).then(res => {
          if (res.ok) window.location.href = '/';
          else showAlert(t('accountDeleteFailed'));
        });
      });
    };

    return [addBtn, refreshBtn, delBtn];
  });

  // Labels
  _menuSection(panel, t('actLabels'), () => {
    const list = mkEl('div', 'mob-menu-labels');

    legendOrder.forEach(key => {
      const cfg = typeConfig[key];
      if (!cfg) return;

      const row = mkEl('div', 'mob-menu-label-row');

      const swatch = mkEl('span', 'mob-menu-swatch');
      swatch.style.background  = cfg.bg;
      swatch.style.borderColor = cfg.border;
      row.appendChild(swatch);

      const name = mkEl('span', 'mob-menu-label-name', cfg.label);
      row.appendChild(name);

      const del = mkEl('button', 'mob-menu-label-del', '×');
      del.onclick = () => { overlay = null; render(); deleteLabel(key); };
      row.appendChild(del);

      list.appendChild(row);
    });

    const addRow = mkEl('button', 'mob-menu-label-add', t('addLabel'));
    addRow.onclick = () => { overlay = null; render(); openAddPanel(null); };
    list.appendChild(addRow);

    return [list];
  });

  // Settings
  _menuSection(panel, t('actSettings'), () => {
    const langRow = mkEl('div', 'mob-settings-row');

    ['en', 'ru'].forEach(l => {
      const btn = mkEl('button', 'mob-settings-pill' + (lang === l ? ' active' : ''), l.toUpperCase());
      btn.onclick = () => {
        const prev = lang;
        pessimisticMeta(
          () => { lang = l; applyLangToStaticUI(); renderScaleBtns(); },
          () => { lang = prev; applyLangToStaticUI(); renderScaleBtns(); },
        );
      };
      langRow.appendChild(btn);
    });

    const scaleRow = mkEl('div', 'mob-settings-row');

    const minus = mkEl('button', 'mob-settings-pill', '− ' + t('scaleSmaller'));
    minus.disabled    = !canStepScale(-1);
    minus.onclick     = () => stepScale(-1);

    const plus = mkEl('button', 'mob-settings-pill', t('scaleLarger') + ' +');
    plus.disabled    = !canStepScale(1);
    plus.onclick     = () => stepScale(1);

    scaleRow.appendChild(minus);
    scaleRow.appendChild(plus);

    const loadRow = mkEl('div', 'mob-settings-row');

    const loadLbl = mkEl('span', 'mob-menu-info');
    loadLbl.style.alignSelf = 'center';
    loadLbl.textContent = t('customLoad');
    loadRow.appendChild(loadLbl);

    const loadBtn = mkEl('button', 'mob-settings-pill' + (customLoad ? ' active' : ''), customLoad ? t('on') : t('off'));
    loadBtn.setAttribute('aria-pressed', customLoad ? 'true' : 'false');
    loadBtn.onclick = toggleCustomLoad;
    loadRow.appendChild(loadBtn);

    return [langRow, scaleRow, loadRow];
  });

  // Help
  _menuSection(panel, t('actInstructions'), () => {
    const info = mkEl('span', 'mob-menu-info', t('hint'));
    return [info];
  });

  container.appendChild(panel);
}

function _menuSection(parent, label, buildFn) {
  const section = mkEl('div', 'mob-menu-section');

  const heading = mkEl('div', 'mob-menu-section-label', label);
  section.appendChild(heading);

  buildFn().forEach(el => section.appendChild(el));
  parent.appendChild(section);
}

// ── Unscheduled drawer ─────────────────────────────────────────────────────────

function _buildUnschedDrawer(container) {
  const colId = overlay.colId;
  const tasks = state[colId] || [];

  const scrim = mkEl('div', 'mob-scrim');
  scrim.onclick = () => { overlay = null; render(); };
  container.appendChild(scrim);

  const drawer = mkEl('div', 'mob-unsched-drawer');

  const handle = mkEl('div', 'mob-grab-handle mob-grab-handle--sky');
  drawer.appendChild(handle);

  // Header
  const hdrBlock = mkEl('div', 'mob-unsched-drawer-header');

  const lbl = mkEl('span', 'mob-unsched-drawer-label', t('mobUnscheduled').toUpperCase());
  hdrBlock.appendChild(lbl);

  const countEl = mkEl('span', 'mob-unsched-drawer-count', `${tasks.length} ${t('mobTasksWaiting')}`);
  hdrBlock.appendChild(countEl);

  const addBtn = mkEl('button', 'mob-unsched-add-btn', '+ ' + t('addTask').replace(/^\+\s*/, ''));
  addBtn.onclick = () => {
    overlay = { kind: 'add', step: 1, dayId: colId, targetDate: null, selectedType: null, typedText: '' };
    render();
  };
  hdrBlock.appendChild(addBtn);
  drawer.appendChild(hdrBlock);

  // Task list
  const taskList = mkEl('div', 'mob-unsched-task-list');

  tasks.forEach(task => {
    const row = mkEl('div', 'mob-unsched-task-row');

    const taskEl = _buildMobileTaskEl(task, colId);
    row.appendChild(taskEl);

    const schedBtn = mkEl('button', 'mob-sched-btn', t('mobSchedule') + ' ›');
    schedBtn.onclick = e => {
      e.stopPropagation();
      overlay = { kind: 'action', taskId: task.id, fromColId: colId };
      render();
    };
    row.appendChild(schedBtn);

    taskList.appendChild(row);
  });

  drawer.appendChild(taskList);

  const hint = mkEl('div', 'mob-unsched-hint', t('mobUnschedHint'));
  drawer.appendChild(hint);

  container.appendChild(drawer);
}

// ── Visual viewport keyboard adjustment ────────────────────────────────────────

// Breathing room left above a sheet that has been capped to the visible area.
const VP_SHEET_GAP = 12;

// iOS never resizes the layout viewport for the keyboard: only the visual
// viewport shrinks, and it also shifts down inside the layout viewport when
// Safari scrolls a focused field into view. innerHeight - height - offsetTop is
// therefore the gap the sheet has to clear. While the keyboard is up the sheet
// is also capped to what remains visible, so a tall one scrolls inside itself
// instead of running off the top of the screen.
function _addVpListener(sheet) {
  if (!window.visualViewport || !sheet) return;
  // Baseline for spotting the other way a browser can handle the keyboard:
  // honouring interactive-widget=resizes-content by shrinking the layout
  // viewport, which moves the sheet for us and needs no inset at all.
  const baseInnerHeight = window.innerHeight;
  _vpResizeListener = () => {
    const vp    = window.visualViewport;
    const inset = window.innerHeight - vp.height - vp.offsetTop;
    // A top-anchored sheet is already clear of the keyboard; it only needs to be
    // kept short enough to fit the strip that is left.
    const topAnchored = sheet.classList.contains('mob-sheet-top');
    if (inset > 0) {
      const avail = Math.max(0, vp.height - VP_SHEET_GAP);
      if (!topAnchored) sheet.style.bottom = inset + 'px';
      sheet.style.maxHeight = avail + 'px';
      // Landscape leaves so little above the keyboard that the sheet's own
      // chrome fills it. Shed the parts that are only context (the task
      // preview, the section label) so the field and its buttons still fit.
      if (sheet.scrollHeight > avail) sheet.classList.add('is-tight');
      sheet.classList.add('kb-handled');     // measured: CSS reserve stands down
    } else {
      sheet.style.bottom    = '';            // keyboard down: back to the stylesheet
      sheet.style.maxHeight = '';
      sheet.classList.remove('is-tight');
      // The layout viewport shrinking IS the browser handling the keyboard.
      sheet.classList.toggle('kb-handled', window.innerHeight < baseInnerHeight - VP_SHEET_GAP);
    }
  };
  window.visualViewport.addEventListener('resize', _vpResizeListener);
  // The keyboard can move the visual viewport without resizing it, which shifts
  // where the sheet belongs with no resize to react to.
  window.visualViewport.addEventListener('scroll', _vpResizeListener);
  // Position once now: a render() while the keyboard is already open rebuilds
  // the sheet at its CSS spot, and no further event need follow to correct it.
  _vpResizeListener();
}

// Re-runs the positioning across a keyboard animation (~300ms on iOS), for the
// browsers that fire no resize at the end of it — or none at all.
function _syncViewportSoon() {
  [50, 250, 500].forEach(ms => setTimeout(() => _vpResizeListener?.(), ms));
}

function _removeVpListener() {
  if (!window.visualViewport || !_vpResizeListener) return;
  window.visualViewport.removeEventListener('resize', _vpResizeListener);
  window.visualViewport.removeEventListener('scroll', _vpResizeListener);
  _vpResizeListener = null;
}
