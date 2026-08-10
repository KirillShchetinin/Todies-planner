// Desktop-view locators. Columns are addressed by their MM/DD header, which is
// unique on the board and survives label/i18n changes.

/** A day column, by the MM/DD shown in its header. */
const col = (page, mmdd) =>
  page.locator('.week-days .col').filter({ has: page.locator('.date', { hasText: mmdd }) });

const unscheduledCol = page => page.locator('.unscheduled-bar .col');

const task = (scope, text) => scope.locator('.task').filter({ hasText: text });

/** Full add-task flow for one column: open form → pick label → name → Enter. */
async function addTask(column, type, name) {
  await column.locator('.add-btn').click();
  await column.locator('.add-type-pill', { hasText: type }).click();
  const input = column.locator('.add-name-row input');
  await input.fill(name);
  await input.press('Enter');
}

/** Right-click a task and click one of the context-menu entries. */
async function ctxMenu(page, taskLocator, itemText) {
  await taskLocator.click({ button: 'right' });
  const menu = page.locator('#ctxMenu');
  await menu.waitFor();
  await menu.locator('.ctx-item', { hasText: itemText }).first().click();
}

/** Right-click a task and pick a type from the "change type" submenu. */
async function ctxChangeType(page, taskLocator, typeLabel) {
  await taskLocator.click({ button: 'right' });
  const menu = page.locator('#ctxMenu');
  await menu.waitFor();
  await menu.locator('.ctx-submenu-trigger').hover();
  await menu.locator('.ctx-submenu-panel .ctx-type-item', { hasText: typeLabel }).first().click();
}

const modal = page => page.locator('#modalOverlay .modal-card');

/** Add a day column through the header form (label is inferred from the date). */
async function addDay(page, date) {
  await page.locator('#addDayBtn').click();
  await page.locator('#newDayDate').fill(date);
  await page.locator('#addDayConfirm').click();
}

/** Open one of the left action-bar panels. */
async function openPanel(page, buttonId) {
  await page.locator(`#${buttonId}`).click();
}

module.exports = { col, unscheduledCol, task, addTask, ctxMenu, ctxChangeType, modal, addDay, openPanel };
