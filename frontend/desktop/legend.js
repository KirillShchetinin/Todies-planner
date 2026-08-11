// legend.js — the type list in the desktop Labels panel.
//
// Desktop-only: it is rebuilt on every desktop render, and right-clicking a
// pill opens the label context menu. Mobile shows its own label list in the
// side menu instead.

function renderLegend() {
  const el = document.getElementById('legend');
  if (!el) return;
  el.innerHTML = '';

  legendOrder.forEach(key => {
    const cfg = typeConfig[key];
    if (!cfg) return;

    const pill = mkEl('span', 'leg');
    pill.style.cssText = `background:${cfg.bg};border-color:${cfg.border};color:${cfg.text}`;

    const name = document.createElement('span');
    name.textContent = cfg.label;
    pill.appendChild(name);

    const x = mkEl('button', 'leg-del', '×');
    x.setAttribute('aria-label', 'Remove label ' + cfg.label);
    x.onclick = ev => { ev.stopPropagation(); deleteLabel(key); };
    pill.appendChild(x);

    pill.addEventListener('contextmenu', e => openCtxMenu(e, key));
    el.appendChild(pill);
  });

  const addBtn = mkEl('button', 'leg-add', t('addLabel'));
  addBtn.onclick     = ev => { ev.stopPropagation(); openAddPanel(ev.currentTarget); };
  el.appendChild(addBtn);
}
