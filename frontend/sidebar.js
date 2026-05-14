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

  document.getElementById('accountDeleteBtn').addEventListener('click', () => {
    showConfirm(t('accountDeleteConfirm'), () => {
      deleteAccount(_token).then(res => {
        if (res.ok) window.location.href = '/';
        else showAlert(t('accountDeleteFailed'));
      });
    });
  });
  document.getElementById('accountRefreshTokenBtn').addEventListener('click', function () {
    showConfirm(t('accountRefreshConfirm'), () => {
      refreshToken(_token).then(token => showTokenModal(token)).catch(() => showAlert(t('accountRefreshFailed')));
    });
  });
  document.getElementById('accountAddBtn').addEventListener('click', function () {
    this.disabled = true;
    addAccount().then(token => showTokenModal(token)).catch(() => showAlert(t('accountCreateFailed')))
      .finally(() => { this.disabled = false; });
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
