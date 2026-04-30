const ctxMenu = document.createElement('div');
ctxMenu.id = 'ctxMenu';
document.body.appendChild(ctxMenu);
let ctxKey = null;

function openTaskCtxMenu(e, taskId) {
  e.preventDefault();
  ctxKey = null;

  let task = null;
  allCols().forEach(c => { (state[c.id]||[]).forEach(t => { if (t.id === taskId) task = t; }); });

  ctxMenu.innerHTML = '';

  const editBtn = document.createElement('button');
  editBtn.className = 'ctx-item';
  editBtn.textContent = t('ctxEditTask');
  editBtn.onclick = () => {
    closeCtxMenu();
    startTaskInlineEdit(taskId);
  };
  ctxMenu.appendChild(editBtn);

  const editSep = document.createElement('div');
  editSep.className = 'ctx-sep';
  ctxMenu.appendChild(editSep);

  const impBtn = document.createElement('button');
  impBtn.className = 'ctx-item ctx-important-item';
  impBtn.textContent = task?.important ? t('ctxUnmarkImportant') : t('ctxMarkImportant');
  impBtn.onclick = () => {
    allCols().forEach(c => { (state[c.id]||[]).forEach(t => { if (t.id === taskId) t.important = !t.important; }); });
    saveState(); closeCtxMenu(); render();
  };
  ctxMenu.appendChild(impBtn);

  const sep = document.createElement('div');
  sep.className = 'ctx-sep';
  ctxMenu.appendChild(sep);

  const heading = document.createElement('div');
  heading.className = 'ctx-heading';
  heading.textContent = t('ctxChangeType');
  ctxMenu.appendChild(heading);

  const sep2 = document.createElement('div');
  sep2.className = 'ctx-sep';
  ctxMenu.appendChild(sep2);

  legendOrder.filter(k => k !== 'done').forEach(key => {
    const cfg = typeConfig[key];
    if (!cfg) return;
    const btn = document.createElement('button');
    btn.className = 'ctx-item ctx-type-item';
    btn.style.cssText = `border-left: 3px solid ${cfg.border}`;
    btn.textContent = cfg.label;
    btn.onclick = () => {
      allCols().forEach(c => { (state[c.id]||[]).forEach(t => { if (t.id === taskId) t.type = key; }); });
      saveState(); closeCtxMenu(); render();
    };
    ctxMenu.appendChild(btn);
  });

  ctxMenu.style.display = 'block';
  const mw = ctxMenu.offsetWidth, mh = ctxMenu.offsetHeight;
  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth  - mw - 8) + 'px';
  ctxMenu.style.top  = Math.min(e.clientY, window.innerHeight - mh - 8) + 'px';
}

function openCtxMenu(e, key) {
  e.preventDefault();
  ctxKey = key;
  const cfg = typeConfig[key] || {};

  ctxMenu.innerHTML = `
    <button class="ctx-item" id="ctxRename">${t('ctxRename')}</button>
    <div class="ctx-sep"></div>
    <div class="ctx-colors" id="ctxColors"></div>
    <div class="ctx-sep"></div><button class="ctx-item ctx-delete" id="ctxDelete">${t('ctxDelete')}</button>
  `;

  ctxMenu.querySelector('#ctxRename').onclick = () => {
    const key = ctxKey;
    closeCtxMenu();
    const n = prompt(t('ctxRenamePrompt'), typeConfig[key]?.label || key);
    if (n) renameLabel(key, n);
  };
  const delBtn = ctxMenu.querySelector('#ctxDelete');
  if (delBtn) delBtn.onclick = () => { const key = ctxKey; closeCtxMenu(); deleteLabel(key); };

  const grid = ctxMenu.querySelector('#ctxColors');
  COLOR_PRESETS.forEach(preset => {
    const sw = document.createElement('button');
    sw.className = 'ctx-swatch';
    sw.style.cssText = `background:${preset.bg};border-color:${preset.border}`;
    sw.onclick = () => { recolorLabel(ctxKey, preset); closeCtxMenu(); };
    grid.appendChild(sw);
  });

  ctxMenu.style.display = 'block';
  const mw = ctxMenu.offsetWidth, mh = ctxMenu.offsetHeight;
  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth  - mw - 8) + 'px';
  ctxMenu.style.top  = Math.min(e.clientY, window.innerHeight - mh - 8) + 'px';
}

function closeCtxMenu() { ctxMenu.style.display = 'none'; ctxKey = null; }

document.addEventListener('click',   closeCtxMenu);
document.addEventListener('keydown', e => { if (e.key==='Escape') { closeCtxMenu(); closeAddPanel(); } });
