function allCols() { return [...cols, ...weekUnscheduled]; }

function addTask(colId, text, type) {
  if (!text.trim()) return;
  UndoHistory.push();
  if (!state[colId]) state[colId] = [];
  state[colId].push({id:'u'+(idCounter++), text:text.trim(), type, col:colId, locked:false, done:false});
  saveState(); render();
}

function deleteTask(id) {
  UndoHistory.push();
  allCols().forEach(c => { if (state[c.id]) state[c.id] = state[c.id].filter(t => t.id !== id); });
  saveState(); render();
}

function toggleDone(id) {
  UndoHistory.push();
  allCols().forEach(c => {
    if (!state[c.id]) return;
    const t = state[c.id].find(t => t.id === id);
    if (t) t.done = !t.done;
  });
  saveState(); render();
}
