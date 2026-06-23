function addLabel(name, colors) {
  const _builtinLabels = new Set(Object.values(DEFAULT_TYPE_CONFIG).map(t => t.label.toLowerCase()));
  if (_builtinLabels.has(name.trim().toLowerCase())) return;
  UndoHistory.push();
  const key = 't-custom-' + (typeCounter++);
  const doneIdx = legendOrder.indexOf('done');
  const at = doneIdx < 0 ? legendOrder.length : doneIdx;
  pessimisticMeta(
    () => { typeConfig[key] = { label: name.trim(), ...colors }; legendOrder.splice(at, 0, key); },
    () => { delete typeConfig[key]; legendOrder = legendOrder.filter(k => k !== key); typeCounter--; },
  );
}

function deleteLabel(key) {
  const label = typeConfig[key]?.label || key;
  showConfirm(`Delete label "${label}"? Any tasks using it will be reassigned to Random.`, () => {
    UndoHistory.push();
    const prevCfg   = typeConfig[key];
    const prevOrder = [...legendOrder];
    const affected  = [];
    allCols().forEach(c => (state[c.id]||[]).forEach(t => { if (t.type === key) affected.push(t); }));

    const apply = () => {
      delete typeConfig[key];
      legendOrder = legendOrder.filter(k => k !== key);
      affected.forEach(t => { t.type = 'Random'; });
    };
    const revert = () => {
      typeConfig[key] = prevCfg;
      legendOrder = prevOrder;
      affected.forEach(t => { t.type = key; });
    };

    apply();
    render();
    // All writes must land; if any fails, roll the whole delete back.
    Promise.all([
      saveMetadata(),
      ...affected.map(t => taskApiUpdate(t.id, { metadata: { type: 'Random' } })
        .then(res => { if (res && res.ok === false) throw new Error('reassign failed'); })),
    ]).catch(() => { revert(); render(); });
  });
}

function renameLabel(key, newName) {
  if (!typeConfig[key] || !newName.trim()) return;
  UndoHistory.push();
  const prev = typeConfig[key].label;
  pessimisticMeta(
    () => { typeConfig[key].label = newName.trim(); },
    () => { if (typeConfig[key]) typeConfig[key].label = prev; },
  );
}

function recolorLabel(key, colors) {
  if (!typeConfig[key]) return;
  UndoHistory.push();
  const prev = { ...typeConfig[key] };
  pessimisticMeta(
    () => { Object.assign(typeConfig[key], colors); },
    () => { if (typeConfig[key]) typeConfig[key] = prev; },
  );
}
