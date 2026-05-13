function addLabel(name, colors) {
  const _builtinLabels = new Set(Object.values(DEFAULT_TYPE_CONFIG).map(t => t.label.toLowerCase()));
  if (_builtinLabels.has(name.trim().toLowerCase())) return;
  UndoHistory.push();
  const key = 't-custom-' + (typeCounter++);
  typeConfig[key] = { label: name.trim(), ...colors };
  const doneIdx = legendOrder.indexOf('done');
  legendOrder.splice(doneIdx < 0 ? legendOrder.length : doneIdx, 0, key);
  saveMetadata(); render();
}

function deleteLabel(key) {
  const label = typeConfig[key]?.label || key;
  showConfirm(`Delete label "${label}"? Any tasks using it will be reassigned to Random.`, () => {
    UndoHistory.push();
    delete typeConfig[key];
    legendOrder = legendOrder.filter(k => k !== key);
    const affected = [];
    allCols().forEach(c => {
      (state[c.id]||[]).forEach(t => {
        if (t.type === key) { t.type = 'Random'; affected.push(t.id); }
      });
    });
    affected.forEach(id => taskApiUpdate(id, { metadata: { type: 'Random' } }));
    saveMetadata();
    render();
  });
}

function renameLabel(key, newName) {
  if (!typeConfig[key] || !newName.trim()) return;
  UndoHistory.push();
  typeConfig[key].label = newName.trim();
  saveMetadata(); render();
}

function recolorLabel(key, colors) {
  if (!typeConfig[key]) return;
  UndoHistory.push();
  Object.assign(typeConfig[key], colors);
  saveMetadata(); render();
}
