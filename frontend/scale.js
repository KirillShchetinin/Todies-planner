function applyScale(scale) {
  uiScale = scale;
  document.documentElement.style.setProperty('--ui-scale', scale);
  document.querySelectorAll('.scale-btn').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.scale) === scale);
  });
}

function renderScaleBtns() {
  const container = document.getElementById('scaleBtns');
  if (!container) return;
  container.innerHTML = '';

  const minus = document.createElement('button');
  minus.className = 'scale-btn';
  minus.textContent = '−';
  minus.title = t('scaleSmaller');
  minus.onclick = () => {
    const idx = UI_SCALES.indexOf(uiScale);
    if (idx > 0) { applyScale(UI_SCALES[idx - 1]); saveMetadata(); }
  };

  const plus = document.createElement('button');
  plus.className = 'scale-btn';
  plus.textContent = '+';
  plus.title = t('scaleLarger');
  plus.onclick = () => {
    const idx = UI_SCALES.indexOf(uiScale);
    if (idx < UI_SCALES.length - 1) { applyScale(UI_SCALES[idx + 1]); saveMetadata(); }
  };

  container.appendChild(minus);
  container.appendChild(plus);
}
