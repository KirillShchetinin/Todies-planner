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
    if (idx <= 0) return;
    const prev = uiScale;
    pessimisticMeta(() => applyScale(UI_SCALES[idx - 1]), () => applyScale(prev));
  };

  const plus = document.createElement('button');
  plus.className = 'scale-btn';
  plus.textContent = '+';
  plus.title = t('scaleLarger');
  plus.onclick = () => {
    const idx = UI_SCALES.indexOf(uiScale);
    if (idx >= UI_SCALES.length - 1) return;
    const prev = uiScale;
    pessimisticMeta(() => applyScale(UI_SCALES[idx + 1]), () => applyScale(prev));
  };

  container.appendChild(minus);
  container.appendChild(plus);
}
