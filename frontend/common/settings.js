// settings.js — UI scale and the progressive-load toggle.
//
// Both live in the metadata blob and both views can change them, so the model
// and the shell widgets that mirror it stay here. The desktop controls are
// wired in desktop/chrome.js; mobile builds its own in the side menu.

// Desktop and mobile keep independent scales; the active view decides which one
// backs the single --ui-scale var.
function currentScale() {
  return isMobileView() ? uiScaleMobile : uiScale;
}

function applyScale(scale) {
  if (isMobileView()) uiScaleMobile = scale;
  else uiScale = scale;
  document.documentElement.style.setProperty('--ui-scale', scale);
  document.querySelectorAll('.scale-btn').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.scale) === scale);
  });
}

// Whether the active view's scale can move one notch in `delta`'s direction.
function canStepScale(delta) {
  const idx = UI_SCALES.indexOf(currentScale());
  return delta < 0 ? idx > 0 : idx < UI_SCALES.length - 1;
}

// Steps the active view's scale by one notch, persisting it.
function stepScale(delta) {
  if (!canStepScale(delta)) return;
  const idx  = UI_SCALES.indexOf(currentScale());
  const prev = currentScale();
  pessimisticMeta(() => applyScale(UI_SCALES[idx + delta]), () => applyScale(prev));
}

function toggleCustomLoad() {
  const prev = customLoad;
  pessimisticMeta(
    () => { customLoad = !customLoad; renderCustomLoadBtn(); },
    () => { customLoad = prev; renderCustomLoadBtn(); },
  );
}

// ── shell widgets ─────────────────────────────────────────────────────────
// index.html carries one static settings panel. It is only visible on desktop,
// but mobile's side menu changes the same values, so both views keep it in
// sync through these two functions.

function renderScaleBtns() {
  const container = document.getElementById('scaleBtns');
  if (!container) return;
  container.innerHTML = '';

  const minus = document.createElement('button');
  minus.className = 'scale-btn';
  minus.textContent = '−';
  minus.title = t('scaleSmaller');
  minus.onclick = () => stepScale(-1);

  const plus = document.createElement('button');
  plus.className = 'scale-btn';
  plus.textContent = '+';
  plus.title = t('scaleLarger');
  plus.onclick = () => stepScale(1);

  container.appendChild(minus);
  container.appendChild(plus);
}

function renderCustomLoadBtn() {
  const btn = document.getElementById('customLoadBtn');
  if (!btn) return;
  btn.textContent = customLoad ? t('on') : t('off');
  btn.setAttribute('aria-pressed', customLoad ? 'true' : 'false');
}
