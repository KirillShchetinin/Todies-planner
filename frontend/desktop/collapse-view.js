// collapse-view.js — how a collapsed desktop column draws.
//
// The toggle state lives in common/collapse.js; this is the DOM half.
//   - Only done tasks  → show first SHOW_DONE, dot the rest (faded)
//   - Has active tasks → hide all done, show up to SHOW_ACTIVE, dot overflow
//                        active + all done
//
// colEl: the .col div · zone: the .drop-zone inside it · tasks: the column's
// task array (data, not DOM).
function renderCollapsedCol(colEl, zone, tasks) {
  const { SHOW_ACTIVE, SHOW_DONE } = Collapse;
  const activeTasks = tasks.filter(t => !t.done && !t.cancelled);
  const fadedTasks  = tasks.filter(t => t.done || t.cancelled);
  const onlyFaded   = activeTasks.length === 0;

  let dotItems = []; // { task, faded }

  if (onlyFaded) {
    zone.querySelectorAll('.task').forEach((el, i) => {
      if (i >= SHOW_DONE) el.style.display = 'none';
    });
    dotItems = fadedTasks.slice(SHOW_DONE).map(t => ({ task: t, faded: true }));
  } else {
    zone.querySelectorAll('.task.done, .task.cancelled').forEach(el => el.style.display = 'none');
    [...zone.querySelectorAll('.task:not(.done):not(.cancelled)')].slice(SHOW_ACTIVE)
      .forEach(el => el.style.display = 'none');
    dotItems = [
      ...activeTasks.slice(SHOW_ACTIVE).map(t => ({ task: t, faded: false })),
      ...fadedTasks.map(t => ({ task: t, faded: true })),
    ];
  }

  if (!dotItems.length) return;

  const row = document.createElement('div');
  row.className = 'col-dots';
  dotItems.forEach(({ task, faded }) => {
    const cfg = typeStyle(task.type);
    const dot = document.createElement('span');
    dot.className = 'col-dot' + (faded ? ' col-dot--done' : '');
    dot.style.background = faded ? cfg.border : cfg.text;
    row.appendChild(dot);
  });
  colEl.appendChild(row);
}
