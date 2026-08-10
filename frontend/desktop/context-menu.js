// context-menu.js — the desktop right-click menus.
//
// Two of them share one element: the task menu (right-click a card) and the
// label menu (right-click a legend pill). Mobile has no right-click; its
// equivalent is the long-press action sheet.

const ctxMenu = document.createElement('div');
ctxMenu.id = 'ctxMenu';
document.body.appendChild(ctxMenu);
let ctxKey = null;

function closeCtxMenu() { ctxMenu.style.display = 'none'; ctxKey = null; }

// Shows the menu at the pointer, nudged back inside the viewport.
function _placeCtxMenu(e) {
  ctxMenu.style.display = 'block';
  const mw = ctxMenu.offsetWidth, mh = ctxMenu.offsetHeight;
  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth  - mw - 8) + 'px';
  ctxMenu.style.top  = Math.min(e.clientY, window.innerHeight - mh - 8) + 'px';
}

function _ctxItem(label, className, onClick) {
  const btn = document.createElement('button');
  btn.className = 'ctx-item' + (className ? ' ' + className : '');
  btn.textContent = label;
  btn.onclick = onClick;
  return btn;
}

function _ctxSep() {
  const sep = document.createElement('div');
  sep.className = 'ctx-sep';
  return sep;
}

// ── task menu ─────────────────────────────────────────────────────────────

function openTaskCtxMenu(e, taskId) {
  e.preventDefault();
  ctxKey = null;

  const task = findTask(taskId);

  ctxMenu.innerHTML = '';

  ctxMenu.appendChild(_ctxItem(t('ctxDetails'), '', () => {
    closeCtxMenu();
    if (!task || task.pending) return;
    loadTaskContent(taskId).then(text =>
      showTaskDetails(text, saved => saveTaskContent(taskId, saved)));
  }));
  ctxMenu.appendChild(_ctxSep());

  ctxMenu.appendChild(_ctxItem(t('ctxEditTask'), '', () => {
    closeCtxMenu();
    startTaskInlineEdit(taskId);
  }));
  ctxMenu.appendChild(_ctxSep());

  ctxMenu.appendChild(_ctxItem(
    task?.important ? t('ctxUnmarkImportant') : t('ctxMarkImportant'),
    'ctx-important-item',
    () => { closeCtxMenu(); toggleImportant(taskId); },
  ));

  ctxMenu.appendChild(_ctxItem(
    task?.cancelled ? t('ctxUncancel') : t('ctxCancel'),
    'ctx-cancel-item',
    () => { closeCtxMenu(); toggleCancelled(taskId); },
  ));

  ctxMenu.appendChild(_ctxSep());
  ctxMenu.appendChild(_buildTypeSubmenu(taskId));

  _placeCtxMenu(e);
}

function _buildTypeSubmenu(taskId) {
  const typeRow = document.createElement('div');
  typeRow.className = 'ctx-submenu';

  const typeTrigger = document.createElement('button');
  typeTrigger.className = 'ctx-item ctx-submenu-trigger';
  typeTrigger.textContent = t('ctxChangeType');
  typeRow.appendChild(typeTrigger);

  const typePanel = document.createElement('div');
  typePanel.className = 'ctx-submenu-panel';
  typeRow.appendChild(typePanel);

  legendOrder.filter(k => k !== 'done').forEach(key => {
    const cfg = typeConfig[key];
    if (!cfg) return;
    const btn = _ctxItem(cfg.label, 'ctx-type-item', () => {
      closeCtxMenu();
      setTaskType(taskId, key);
    });
    btn.style.cssText = `border-left: 3px solid ${cfg.border}`;
    typePanel.appendChild(btn);
  });

  // Opened by class rather than :hover so the panel can be measured and
  // flipped/shifted before the pointer reaches it.
  const openSub = () => {
    typeRow.classList.add('open');
    typePanel.classList.remove('flip-left');
    typePanel.style.transform = '';
    let r = typePanel.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) {
      typePanel.classList.add('flip-left');
      r = typePanel.getBoundingClientRect();
    }
    const shift = Math.min(r.bottom - (window.innerHeight - 8), r.top - 8);
    if (shift > 0) typePanel.style.transform = `translateY(${-shift}px)`;
  };
  const closeSub = () => typeRow.classList.remove('open');

  typeRow.addEventListener('mouseenter', openSub);
  typeRow.addEventListener('mouseleave', closeSub);
  typeTrigger.onclick = e => {
    e.stopPropagation();
    typeRow.classList.contains('open') ? closeSub() : openSub();
  };

  return typeRow;
}

// ── label menu ────────────────────────────────────────────────────────────

function openCtxMenu(e, key) {
  e.preventDefault();
  ctxKey = key;

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

  _placeCtxMenu(e);
}

document.addEventListener('click',   closeCtxMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCtxMenu(); });
