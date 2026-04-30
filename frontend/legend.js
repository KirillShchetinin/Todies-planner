function renderLegend() {
  const el = document.getElementById('legend');
  el.innerHTML = '';

  legendOrder.forEach(key => {
    const cfg = typeConfig[key];
    if (!cfg) return;

    const pill = document.createElement('span');
    pill.className = 'leg';
    pill.style.cssText = `background:${cfg.bg};border-color:${cfg.border};color:${cfg.text}`;

    const name = document.createElement('span');
    name.textContent = cfg.label;
    pill.appendChild(name);

    const x = document.createElement('button');
    x.className = 'leg-del';
    x.textContent = '×';
    x.onclick = ev => { ev.stopPropagation(); deleteLabel(key); };
    pill.appendChild(x);

    pill.addEventListener('contextmenu', e => openCtxMenu(e, key));
    el.appendChild(pill);
  });

  const addBtn = document.createElement('button');
  addBtn.className   = 'leg-add';
  addBtn.textContent = t('addLabel');
  addBtn.onclick     = ev => { ev.stopPropagation(); openAddPanel(); };
  el.appendChild(addBtn);
}
