// tasks.js — task lookup and the mutations both views expose.
//
// Every mutation guards on `task.pending`: a card created optimistically holds
// a negative temp id until the server answers, and nothing can be updated or
// deleted until its real id is known.

function findTask(id) {
  for (const c of allCols()) {
    const list = state[c.id];
    if (!list) continue;
    const t = list.find(t => t.id === id);
    if (t) return t;
  }
  return null;
}

// The column a task currently lives in, or null.
function findTaskCol(id) {
  for (const c of allCols()) {
    if ((state[c.id] || []).some(t => t.id === id)) return c.id;
  }
  return null;
}

// Hand-rolled optimistic create: insert a card with a negative temp id and
// `pending: true`, then swap in the real id once the POST answers.
function addTask(colId, text, type) {
  const name = text.trim();
  if (!name) return;
  const temp = tempId();
  UndoHistory.push();
  if (!state[colId]) state[colId] = [];
  const task = { id: temp, text: name, type, locked: false, done: false, pending: true };
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
      if (state[colId]) state[colId] = state[colId].filter(t => t.id !== temp);
      render();
    });
}

function deleteTask(id) {
  const task = findTask(id);
  if (!task || task.pending) return;     // can't delete a task whose id isn't known yet
  const colId = findTaskCol(id);
  if (colId == null) return;
  const idx    = state[colId].findIndex(t => t.id === id);
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

function toggleImportant(id) {
  const task = findTask(id);
  if (!task || task.pending) return;
  const prev = task.important;
  optimistic(
    () => { task.important = !prev; },
    () => taskApiUpdate(id, { metadata: { important: !!task.important } }),
    () => { task.important = prev; },
  );
}

function setTaskType(id, type) {
  const task = findTask(id);
  if (!task || task.pending) return;
  const prev = task.type;
  optimistic(
    () => { task.type = type; },
    () => taskApiUpdate(id, { metadata: { type } }),
    () => { task.type = prev; },
  );
}

function renameTask(id, name) {
  const task = findTask(id);
  if (!task || task.pending) return;
  const prev = task.text;
  optimistic(
    () => { task.text = name; },
    () => taskApiUpdate(id, { name }),
    () => { task.text = prev; },
  );
}

// Moves a task to another column, appending it at the end. Revert is scoped to
// the two columns the move touches, so concurrent writes elsewhere survive.
function moveTaskToCol(taskId, targetColId) {
  const task = findTask(taskId);
  if (!task || task.pending) return;
  const sourceColId = findTaskCol(taskId);
  if (sourceColId == null || sourceColId === targetColId) return;
  if (!state[targetColId]) state[targetColId] = [];

  const prevSource = [...state[sourceColId]];
  const prevTarget = [...state[targetColId]];
  optimistic(
    () => {
      state[sourceColId] = state[sourceColId].filter(t => t.id !== taskId);
      state[targetColId].push(task);
    },
    () => taskApiUpdate(taskId, { form_id: targetColId }),
    () => { state[sourceColId] = prevSource; state[targetColId] = prevTarget; },
  );
}

// Long-form body, lazily fetched and then cached on the task. `undefined`
// means "never loaded"; '' is a real, cached empty body.
function loadTaskContent(id) {
  const task = findTask(id);
  if (!task) return Promise.resolve('');
  if (task.content !== undefined) return Promise.resolve(task.content);
  return taskApiGetContent(id).then(text => { task.content = text; return text; });
}

function saveTaskContent(id, content) {
  const task = findTask(id);
  if (!task || task.pending) return;
  optimistic(
    () => { task.content = content; },
    () => taskApiSetContent(id, content),
    // Undefined, not the previous value: a cached value here would be
    // indistinguishable from a loaded-empty one and would block the re-fetch
    // on next open.
    () => { task.content = undefined; },
  );
}
