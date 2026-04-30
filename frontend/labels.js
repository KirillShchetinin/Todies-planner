function addLabel(name, colors) {
  const key = 't-custom-' + (typeCounter++);
  typeConfig[key] = { label: name.trim(), ...colors };
  const doneIdx = legendOrder.indexOf('done');
  legendOrder.splice(doneIdx < 0 ? legendOrder.length : doneIdx, 0, key);
  saveState(); render();
}

function deleteLabel(key) {
  delete typeConfig[key];
  legendOrder = legendOrder.filter(k => k !== key);
  allCols().forEach(c => { (state[c.id]||[]).forEach(t => { if (t.type===key) t.type='t-async'; }); });
  saveState(); render();
}

function renameLabel(key, newName) {
  if (!typeConfig[key] || !newName.trim()) return;
  typeConfig[key].label = newName.trim();
  saveState(); render();
}

function recolorLabel(key, colors) {
  if (!typeConfig[key]) return;
  Object.assign(typeConfig[key], colors);
  saveState(); render();
}
