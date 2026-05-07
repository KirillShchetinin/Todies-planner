function parseDateToSortKey(dateStr) {
  if (!dateStr) return Infinity;
  const base = dateStr.replace(/\+$/, '');
  const m = base.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return Infinity;
  const yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
  return yr * 10000 + parseInt(m[1]) * 100 + parseInt(m[2]);
}

function sortColsByDate() {
  cols.sort((a, b) => parseDateToSortKey(a.date) - parseDateToSortKey(b.date));
}

function inferDay(dateStr) {
  const m = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return '';
  const yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
  const d  = new Date(yr, parseInt(m[1]) - 1, parseInt(m[2]));
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', {weekday:'short'});
}

// Returns ISO week key "YYYY-Www" and day-of-week index (0=Mon…6=Sun) for a col.
function colWeekInfo(col) {
  const base = (col.date || '').replace(/\+$/, '');
  const m = base.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
  const d  = new Date(yr, parseInt(m[1]) - 1, parseInt(m[2]));
  if (isNaN(d)) return null;
  const day = (d.getDay() + 6) % 7; // 0=Mon…6=Sun
  const thu  = new Date(d); thu.setDate(d.getDate() + (3 - day));
  const jan4 = new Date(thu.getFullYear(), 0, 4);
  const week = 1 + Math.round((thu - jan4) / 604800000);
  return { key: `${thu.getFullYear()}-W${String(week).padStart(2,'0')}`, day };
}

function addCol(label, date) {
  if (!label.trim()) return;
  UndoHistory.push();
  const newId = 'col' + (colCounter++);
  cols.push({id: newId, label: label.trim(), date: date.trim()});
  sortColsByDate();
  formApiCreate({id: newId, label: label.trim(), date: date.trim()}, false, cols.findIndex(c => c.id === newId));
  saveMetadata(); render();
}

function addNextDay() {
  const dayCols = cols.filter(c => c.date);
  let label = '', date = '';
  if (dayCols.length > 0) {
    const last = dayCols[dayCols.length - 1];
    const baseDate = last.date.replace(/\+$/, '');
    const m = baseDate.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (m) {
      const yr = m[3] ? parseInt(m[3]) : new Date().getFullYear();
      const d  = new Date(yr, parseInt(m[1]) - 1, parseInt(m[2]));
      d.setDate(d.getDate() + 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      date  = `${mm}/${dd}`;
      label = d.toLocaleDateString('en-US', {weekday: 'short'});
    }
  }
  addCol(label || t('dayFallback'), date);
}

function addUnscheduledCol() {
  UndoHistory.push();
  const newId = 'unsched_w' + (colCounter++);
  weekUnscheduled.push({id: newId, label: 'Unscheduled'});
  formApiCreate({id: newId, label: 'Unscheduled', date: ''}, true, weekUnscheduled.length - 1);
  saveMetadata(); render();
}

function deleteCol(colId) {
  const tasks = state[colId] || [];
  if (tasks.length > 0) { alert(t('deleteColHasTasks')); return; }
  UndoHistory.push();
  delete state[colId];
  cols = cols.filter(c => c.id !== colId);
  formApiDelete(colId);
  render();
}
