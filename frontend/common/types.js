// types.js — task types (a.k.a. labels): their colours, and their CRUD.
//
// 1 built-in ("Random") plus user-defined `t-custom-*` types. boot.js merges
// saved custom types over DEFAULT_TYPE_CONFIG, so adding a built-in in
// constants.js reaches existing users. Both views paint cards through
// applyTaskStyle and dots through typeStyle.

// The colours a type paints with. Never returns undefined, so callers don't
// each carry their own fallback.
function typeStyle(type) {
  return typeConfig[type] || typeConfig['Random'] || FALLBACK_TYPE_STYLE;
}

// Paints one task card. Done/cancelled cards drop the type's dashed/italic
// treatment and fade instead.
function applyTaskStyle(el, type, done, cancelled) {
  const cfg = typeStyle(type);
  el.style.background  = cfg.bg;
  el.style.borderColor = cfg.border;
  el.style.color       = cfg.text;
  el.style.borderStyle = (!done && !cancelled && cfg.dashed) ? 'dashed' : 'solid';
  el.style.fontStyle   = (!done && !cancelled && cfg.italic)  ? 'italic' : '';
  el.style.opacity     = (done || cancelled) ? '0.45' : '';
}

// The types offered when picking one for a task, in legend order.
function selectableTypeKeys() {
  return legendOrder.filter(k => k !== 't-locked' && k !== 'done');
}

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
