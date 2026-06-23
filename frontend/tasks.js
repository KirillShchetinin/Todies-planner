function allCols() { return [...cols, ...weekUnscheduled]; }

function findTask(id) {
  for (const c of allCols()) {
    const list = state[c.id];
    if (!list) continue;
    const t = list.find(t => t.id === id);
    if (t) return t;
  }
  return null;
}

function addTask(colId, text, type) {
  const name = text.trim();
  if (!name) return;
  const tempId = _tempId();             // negative id marks a not-yet-persisted task
  UndoHistory.push();
  if (!state[colId]) state[colId] = [];
  const task = { id: tempId, text: name, type, locked: false, done: false, pending: true };
  state[colId].push(task);
  render();

  return Promise.resolve()
    .then(() => taskApiCreate(colId, name, { type, locked: false }))
    .then(created => {
      task.id = created.id;             // reconcile temp id with the server id
      delete task.pending;
      render();
    })
    .catch(() => {                       // create failed: drop the optimistic card
      if (state[colId]) state[colId] = state[colId].filter(t => t.id !== tempId);
      render();
    });
}

function deleteTask(id) {
  const task = findTask(id);
  if (!task || task.pending) return;     // can't delete a task whose id isn't known yet
  let colId, idx;
  allCols().forEach(c => {
    if (!state[c.id]) return;
    const i = state[c.id].findIndex(t => t.id === id);
    if (i > -1) { colId = c.id; idx = i; }
  });
  const nextId = state[colId][idx + 1]?.id;   // anchor so re-insert survives sibling changes
  optimistic(
    () => { state[colId] = state[colId].filter(t => t.id !== id); },
    () => taskApiDelete(id),
    () => {                                     // re-insert just this task, before its old neighbor
      const list = state[colId] || (state[colId] = []);
      const at = nextId != null ? list.findIndex(t => t.id === nextId) : -1;
      list.splice(at > -1 ? at : list.length, 0, task);
    },
  );
}

function toggleDone(id) {
  const task = findTask(id);
  if (!task || task.pending) return;
  const prev = task.done;
  optimistic(
    () => { task.done = !prev; },
    () => taskApiUpdate(id, { done: task.done }),
    () => { task.done = prev; },
  );
}

function toggleCancelled(id) {
  const task = findTask(id);
  if (!task || task.pending) return;
  const prev = task.cancelled;
  optimistic(
    () => { task.cancelled = !prev; },
    () => taskApiUpdate(id, { metadata: { cancelled: task.cancelled } }),
    () => { task.cancelled = prev; },
  );
}
