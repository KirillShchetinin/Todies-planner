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

async function addTask(colId, text, type) {
  if (!text.trim()) return;
  let created;
  try {
    created = await taskApiCreate(colId, text.trim(), { type, locked: false });
  } catch (e) {
    return;
  }
  UndoHistory.push();
  if (!state[colId]) state[colId] = [];
  state[colId].push({ id: created.id, text: text.trim(), type, locked: false, done: false });
  render();
}

function deleteTask(id) {
  const task = findTask(id);
  if (!task) return;
  UndoHistory.push();
  allCols().forEach(c => { if (state[c.id]) state[c.id] = state[c.id].filter(t => t.id !== id); });
  taskApiDelete(id);
  render();
}

function toggleDone(id) {
  const task = findTask(id);
  if (!task) return;
  UndoHistory.push();
  task.done = !task.done;
  taskApiUpdate(id, { done: task.done });
  render();
}

function toggleCancelled(id) {
  const task = findTask(id);
  if (!task) return;
  UndoHistory.push();
  task.cancelled = !task.cancelled;
  taskApiUpdate(id, { metadata: { cancelled: task.cancelled } });
  render();
}
