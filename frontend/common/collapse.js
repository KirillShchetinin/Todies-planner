// collapse.js — the short/full state of day columns.
//
// State only: it is persisted in the metadata blob (so it must live in the
// common layer), while the DOM that a short column renders is the desktop
// board's business — see desktop/collapse-view.js.
//
// Toggle rule (per-column, in isolation):
//   - Has done tasks OR more than SHOW_ACTIVE active tasks → toggleable
//   - Otherwise → no-op (nothing to shorten)

const Collapse = (() => {
  const SHOW_ACTIVE = 3;
  const SHOW_DONE   = 2;

  // colId → 0 (full) | 1 (short)
  let state = {};

  function isShort(colId) {
    return state[colId] === 1;
  }

  function canToggle(colId, taskState) {
    const tasks = taskState[colId] || [];
    const activeTasks = tasks.filter(t => !t.done && !t.cancelled);
    const hasDone     = tasks.some(t => t.done || t.cancelled);
    return hasDone || activeTasks.length > SHOW_ACTIVE;
  }

  function toggle(colId, taskState) {
    if (!canToggle(colId, taskState)) return false;
    state[colId] = isShort(colId) ? 0 : 1;
    return true;
  }

  function getAll()       { return { ...state }; }
  function loadAll(saved) { state = saved || {}; }

  return { isShort, canToggle, toggle, getAll, loadAll, SHOW_ACTIVE, SHOW_DONE };
})();
