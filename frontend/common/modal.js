const _modalOverlay = document.createElement('div');
_modalOverlay.id = 'modalOverlay';
document.body.appendChild(_modalOverlay);

function _openModal({ message, buttons }) {
  _modalOverlay.innerHTML = '';
  _modalOverlay.style.display = 'flex';

  const card = document.createElement('div');
  card.className = 'modal-card';

  const msg = document.createElement('p');
  msg.className = 'modal-message';
  msg.textContent = message;
  card.appendChild(msg);

  const row = document.createElement('div');
  row.className = 'modal-btns';

  const handlers = [];

  buttons.forEach(({ label, className, onClick }) => {
    const btn = document.createElement('button');
    btn.className = 'modal-btn ' + (className || '');
    btn.textContent = label;
    const handler = () => { _closeModal(); onClick?.(); };
    btn.addEventListener('click', handler);
    handlers.push(handler);
    row.appendChild(btn);
  });

  card.appendChild(row);
  _modalOverlay.appendChild(card);

  const onKey = e => {
    if (e.key === 'Escape') { _closeModal(); buttons.find(b => b.cancel)?.onClick?.(); }
    if (e.key === 'Enter')  { _closeModal(); buttons.find(b => b.primary)?.onClick?.(); }
  };
  document.addEventListener('keydown', onKey);
  _modalOverlay._cleanup = () => document.removeEventListener('keydown', onKey);

  _modalOverlay.onclick = e => { if (e.target === _modalOverlay) { _closeModal(); buttons.find(b => b.cancel)?.onClick?.(); } };

  card.querySelector('.modal-btn')?.focus();
}

function _closeModal() {
  _modalOverlay.style.display = 'none';
  _modalOverlay.innerHTML = '';
  _modalOverlay._cleanup?.();
}

function showConfirm(message, onConfirm) {
  _openModal({
    message,
    buttons: [
      { label: t('modalCancel'), className: 'modal-btn-cancel', cancel: true },
      { label: t('modalDelete'), className: 'modal-btn-danger', primary: true, onClick: onConfirm },
    ],
  });
}

function showTokenModal(token) {
  _modalOverlay.innerHTML = '';
  _modalOverlay.style.display = 'flex';

  const card = document.createElement('div');
  card.className = 'modal-card';

  const msg = document.createElement('p');
  msg.className = 'modal-message';
  msg.textContent = t('tokenModalMsg');
  card.appendChild(msg);

  const tokenRow = document.createElement('div');
  tokenRow.className = 'modal-token-row';

  const input = document.createElement('input');
  input.className = 'modal-token-input';
  input.readOnly = true;
  input.value = token;
  tokenRow.appendChild(input);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'modal-btn';
  copyBtn.textContent = t('tokenCopy');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(token).then(() => {
      copyBtn.textContent = t('tokenCopied');
      setTimeout(() => { copyBtn.textContent = t('tokenCopy'); }, 1500);
    });
  });
  tokenRow.appendChild(copyBtn);
  card.appendChild(tokenRow);

  const row = document.createElement('div');
  row.className = 'modal-btns';
  const doneBtn = document.createElement('button');
  doneBtn.className = 'modal-btn modal-btn-primary';
  doneBtn.textContent = t('tokenDone');
  doneBtn.addEventListener('click', () => { _closeModal(); window.location.href = `/?token=${encodeURIComponent(token)}`; });
  row.appendChild(doneBtn);
  card.appendChild(row);

  _modalOverlay.appendChild(card);
  input.select();

  const redirect = () => { _closeModal(); window.location.href = `/?token=${encodeURIComponent(token)}`; };
  const onKey = e => { if (e.key === 'Enter' || e.key === 'Escape') redirect(); };
  document.addEventListener('keydown', onKey);
  _modalOverlay.onclick = e => { if (e.target === _modalOverlay) redirect(); };
  _modalOverlay._cleanup = () => document.removeEventListener('keydown', onKey);
}

function showTaskDetails(initialText, onSave) {
  _modalOverlay.innerHTML = '';
  _modalOverlay.style.display = 'flex';

  const card = document.createElement('div');
  card.className = 'modal-card modal-card-wide';

  const msg = document.createElement('p');
  msg.className = 'modal-message';
  msg.textContent = t('detailsTitle');
  card.appendChild(msg);

  const area = document.createElement('textarea');
  area.className = 'modal-textarea';
  area.placeholder = t('detailsPh');
  area.value = initialText || '';
  card.appendChild(area);

  const row = document.createElement('div');
  row.className = 'modal-btns';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-btn modal-btn-cancel';
  cancelBtn.textContent = t('modalCancel');
  cancelBtn.addEventListener('click', () => _closeModal());
  row.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'modal-btn modal-btn-primary';
  saveBtn.textContent = t('modalSave');
  saveBtn.addEventListener('click', () => { const v = area.value; _closeModal(); onSave?.(v); });
  row.appendChild(saveBtn);

  card.appendChild(row);
  _modalOverlay.appendChild(card);

  // Enter inserts newlines here, so only Escape closes; Ctrl/Cmd+Enter saves.
  const onKey = e => {
    if (e.key === 'Escape') _closeModal();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { const v = area.value; _closeModal(); onSave?.(v); }
  };
  document.addEventListener('keydown', onKey);
  _modalOverlay._cleanup = () => document.removeEventListener('keydown', onKey);

  _modalOverlay.onclick = e => { if (e.target === _modalOverlay) _closeModal(); };

  area.focus();
}

function showAlert(message) {
  _openModal({
    message,
    buttons: [
      { label: t('modalOk'), className: 'modal-btn-primary', primary: true },
    ],
  });
}
