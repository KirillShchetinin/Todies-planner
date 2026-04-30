const addPanel = document.createElement('div');
addPanel.id = 'addLabelPanel';
addPanel.innerHTML = `
  <p class="add-panel-title">new label</p>
  <input id="newLabelName" type="text" placeholder="label name..." maxlength="20" />
  <div class="ctx-colors" id="addPanelColors"></div>
  <div class="add-form-btns" style="margin-top:8px">
    <button class="btn-confirm" id="newLabelConfirm">add</button>
    <button class="btn-cancel"  id="newLabelCancel">cancel</button>
  </div>
`;
document.body.appendChild(addPanel);

let selectedPreset = COLOR_PRESETS[4];

function openAddPanel() {
  const grid = addPanel.querySelector('#addPanelColors');
  grid.innerHTML = '';
  COLOR_PRESETS.forEach(preset => {
    const sw = document.createElement('button');
    sw.className = 'ctx-swatch' + (preset === selectedPreset ? ' selected' : '');
    sw.style.cssText = `background:${preset.bg};border-color:${preset.border}`;
    sw.onclick = () => {
      selectedPreset = preset;
      grid.querySelectorAll('.ctx-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    };
    grid.appendChild(sw);
  });
  addPanel.style.display = 'block';
  addPanel.querySelector('#newLabelName').value = '';
  addPanel.querySelector('#newLabelName').focus();
}

function closeAddPanel() { addPanel.style.display = 'none'; }

addPanel.querySelector('#newLabelCancel').onclick  = closeAddPanel;
addPanel.querySelector('#newLabelConfirm').onclick = () => {
  const name = addPanel.querySelector('#newLabelName').value.trim();
  if (!name) return;
  addLabel(name, selectedPreset);
  closeAddPanel();
};
addPanel.querySelector('#newLabelName').addEventListener('keydown', e => {
  if (e.key === 'Enter')  addPanel.querySelector('#newLabelConfirm').click();
  if (e.key === 'Escape') closeAddPanel();
});
