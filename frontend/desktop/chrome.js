// chrome.js — the desktop shell around the board: the left action bar with its
// flyout panels, and the header's add-day form.
//
// This markup lives statically in index.html and is hidden by mobile.css, so
// only this file drives it. The values these controls change (lang, scale,
// progressive load) are common — mobile's side menu changes the same ones.

(function () {
  const panels = {
    actAccount:      'panelAccount',
    actLabels:       'panelLabels',
    actSettings:     'panelSettings',
    actInstructions: 'panelInstructions',
  };

  let activeBtn = null;

  Object.entries(panels).forEach(([btnId, panelId]) => {
    const btn   = document.getElementById(btnId);
    const panel = document.getElementById(panelId);

    btn.addEventListener('click', () => {
      const opening = activeBtn !== btnId;
      Object.entries(panels).forEach(([b, p]) => {
        document.getElementById(p).classList.remove('open');
        document.getElementById(b).classList.remove('active');
      });
      if (opening) {
        panel.classList.add('open');
        btn.classList.add('active');
        activeBtn = btnId;
      } else {
        activeBtn = null;
      }
    });
  });

  document.addEventListener('click', e => {
    if (!activeBtn) return;
    const bar   = document.getElementById('actbar');
    const panel = document.getElementById(panels[activeBtn]);
    if (!bar.contains(e.target) && !panel.contains(e.target)) {
      panel.classList.remove('open');
      document.getElementById(activeBtn).classList.remove('active');
      activeBtn = null;
    }
  }, true);
})();

// ── account panel ─────────────────────────────────────────────────────────

document.getElementById('accountAddBtn').addEventListener('click', function () {
  this.disabled = true;
  addAccount().then(token => showTokenModal(token)).catch(() => showAlert(t('accountCreateFailed')))
    .finally(() => { this.disabled = false; });
});

document.getElementById('accountRefreshTokenBtn').addEventListener('click', () => {
  showConfirm(t('accountRefreshConfirm'), () => {
    refreshToken(TOKEN).then(token => showTokenModal(token)).catch(() => showAlert(t('accountRefreshFailed')));
  });
});

document.getElementById('accountDeleteBtn').addEventListener('click', () => {
  showConfirm(t('accountDeleteConfirm'), () => {
    deleteAccount(TOKEN).then(res => {
      if (res.ok) window.location.href = '/';
      else showAlert(t('accountDeleteFailed'));
    });
  });
});

// ── settings panel ────────────────────────────────────────────────────────

document.getElementById('langBtn').addEventListener('click', () => {
  const prev = lang;
  pessimisticMeta(
    () => { lang = lang === 'en' ? 'ru' : 'en'; applyLangToStaticUI(); renderScaleBtns(); },
    () => { lang = prev; applyLangToStaticUI(); renderScaleBtns(); },
  );
});

document.getElementById('customLoadBtn').addEventListener('click', toggleCustomLoad);

// ── header: add day / add unscheduled ─────────────────────────────────────

// Wrapped so this file publishes no globals at all — the desktop layer is
// wiring, not API.
(function () {
  const addDayBtn   = document.getElementById('addDayBtn');
  const addDayForm  = document.getElementById('addDayForm');
  const newDayLabel = document.getElementById('newDayLabel');
  const newDayDate  = document.getElementById('newDayDate');
  const confirmBtn  = document.getElementById('addDayConfirm');

  document.getElementById('addUnscheduledBtn').onclick = addUnscheduledCol;
  addDayBtn.onclick = () => { addDayBtn.style.display='none'; addDayForm.classList.add('open'); newDayDate.focus(); };

  const closeDay = () => {
    addDayBtn.style.display=''; addDayForm.classList.remove('open');
    newDayLabel.value=''; newDayDate.value='';
  };

  // Typing a date auto-fills the weekday label.
  newDayDate.addEventListener('input', () => {
    const inferred = inferDay(newDayDate.value);
    if (inferred) newDayLabel.value = inferred;
  });

  document.getElementById('addDayCancel').onclick = closeDay;
  confirmBtn.onclick = () => {
    const l = newDayLabel.value, d = newDayDate.value;
    if (!l.trim()) return;
    addCol(l, d); closeDay();
  };
  [newDayLabel, newDayDate].forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key==='Enter')  confirmBtn.click();
      if (e.key==='Escape') closeDay();
    });
  });
})();
