// ── collapse.js ───────────────────────────────────────────────────────────────
// Manages the short/full toggle state for day columns.
//
// Toggle rule (per-column, in isolation):
//   - Has done tasks OR more than SHOW_ACTIVE active tasks → toggleable
//   - Otherwise → no-op (nothing to shorten)
//
// Short-state rendering:
//   - Only done tasks  → show first SHOW_DONE, dot the rest (faded)
//   - Has active tasks → hide all done, show up to SHOW_ACTIVE, dot overflow active + all done

const Collapse = (() => {
  const SHOW_ACTIVE = 3;
  const SHOW_DONE   = 2;

  // colId → 0 (full) | 1 (short)
  const state = {};

  function isShort(colId) {
    return state[colId] === 1;
  }

  function canToggle(colId, taskState) {
    const tasks = taskState[colId] || [];
    const activeTasks = tasks.filter(t => !t.done);
    const hasDone     = tasks.some(t => t.done);
    return hasDone || activeTasks.length > SHOW_ACTIVE;
  }

  function toggle(colId, taskState) {
    if (!canToggle(colId, taskState)) return false;
    state[colId] = isShort(colId) ? 0 : 1;
    return true;
  }

  // Apply the short-state to a rendered column element.
  // colEl: the .col div
  // zone: the .drop-zone div inside it
  // tasks: task array for this col (data, not DOM)
  // typeConfig: label→style map for dot colors
  function applyShort(colEl, zone, tasks, typeConfig) {
    const activeTasks = tasks.filter(t => !t.done);
    const doneTasks   = tasks.filter(t => t.done);
    const onlyDone    = activeTasks.length === 0;

    let dotItems = []; // { task, faded }

    if (onlyDone) {
      zone.querySelectorAll('.task').forEach((el, i) => {
        if (i >= SHOW_DONE) el.style.display = 'none';
      });
      dotItems = doneTasks.slice(SHOW_DONE).map(t => ({ task: t, faded: true }));
    } else {
      zone.querySelectorAll('.task.done').forEach(el => el.style.display = 'none');
      [...zone.querySelectorAll('.task:not(.done)')].slice(SHOW_ACTIVE)
        .forEach(el => el.style.display = 'none');
      dotItems = [
        ...activeTasks.slice(SHOW_ACTIVE).map(t => ({ task: t, faded: false })),
        ...doneTasks.map(t => ({ task: t, faded: true })),
      ];
    }

    if (dotItems.length) {
      const row = document.createElement('div');
      row.className = 'col-dots';
      dotItems.forEach(({ task, faded }) => {
        const cfg = typeConfig[task.type] || typeConfig['t-async'];
        const dot = document.createElement('span');
        dot.className = 'col-dot' + (faded ? ' col-dot--done' : '');
        dot.style.background = faded ? cfg.border : cfg.text;
        row.appendChild(dot);
      });
      colEl.appendChild(row);
    }
  }

  return { isShort, canToggle, toggle, applyShort };
})();
