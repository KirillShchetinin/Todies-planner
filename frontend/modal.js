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
      { label: 'cancel', className: 'modal-btn-cancel', cancel: true },
      { label: 'delete', className: 'modal-btn-danger', primary: true, onClick: onConfirm },
    ],
  });
}

function showAlert(message) {
  _openModal({
    message,
    buttons: [
      { label: 'ok', className: 'modal-btn-primary', primary: true },
    ],
  });
}
