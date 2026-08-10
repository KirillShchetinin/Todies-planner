// Task CRUD. Every mutation is checked after a reload — that is what proves
// the write reached the server rather than only the optimistic in-memory copy.

const { test, expect } = require('../fixtures/test');
const { col, task, addTask, ctxMenu, ctxChangeType, modal } = require('../fixtures/desktop');

test('adds a task with the chosen label', async ({ page, planner }) => {
  const thu = col(page, '03/12');
  await addTask(thu, 'Work', 'Ship the release');

  await expect(task(thu, 'Ship the release')).toBeVisible();
  await planner.reload();
  await expect(task(col(page, '03/12'), 'Ship the release')).toBeVisible();
  expect(await planner.task('Ship the release')).toMatchObject({ type: 't-custom-0', done: false });
});

test('ignores an empty task name', async ({ page, planner }) => {
  const thu = col(page, '03/12');
  await addTask(thu, 'Work', '   ');
  await expect(thu.locator('.task')).toHaveCount(0);
});

test('marks a task done and back', async ({ page, planner }) => {
  const wed = col(page, '03/11');
  await task(wed, 'Buy milk').locator('.check').click();
  await expect(task(wed, 'Buy milk')).toHaveClass(/done/);

  await planner.reload();
  await expect(task(col(page, '03/11'), 'Buy milk')).toHaveClass(/done/);

  await task(col(page, '03/11'), 'Buy milk').locator('.check').click();
  await planner.reload();
  await expect(task(col(page, '03/11'), 'Buy milk')).not.toHaveClass(/done/);
});

test('deletes a task', async ({ page, planner }) => {
  await task(col(page, '03/11'), 'Buy milk').locator('.del').click();
  await expect(task(col(page, '03/11'), 'Buy milk')).toHaveCount(0);

  await planner.reload();
  await expect(task(col(page, '03/11'), 'Buy milk')).toHaveCount(0);
  expect(planner.rows().map(r => r.name)).not.toContain('Buy milk');
});

test('renames a task inline', async ({ page, planner }) => {
  const wed = col(page, '03/11');
  await ctxMenu(page, task(wed, 'Buy milk'), 'edit name');
  const input = wed.locator('.task-inline-edit');
  await input.fill('Buy oat milk');
  await input.press('Enter');

  await planner.reload();
  await expect(task(col(page, '03/11'), 'Buy oat milk')).toBeVisible();
});

test('marks important, cancels, and changes label from the context menu', async ({ page, planner }) => {
  const wed = () => col(page, '03/11');

  await ctxMenu(page, task(wed(), 'Buy milk'), 'mark important');
  await expect(task(wed(), 'Buy milk').locator('.task-important')).toBeVisible();

  await ctxMenu(page, task(wed(), 'Buy milk'), 'cancel task');
  await expect(task(wed(), 'Buy milk')).toHaveClass(/cancelled/);

  await ctxChangeType(page, task(wed(), 'Buy milk'), 'Home');

  await planner.reload();
  await expect(task(wed(), 'Buy milk').locator('.task-important')).toBeVisible();
  await expect(task(wed(), 'Buy milk')).toHaveClass(/cancelled/);
  expect(await planner.task('Buy milk')).toMatchObject({ type: 't-custom-1', important: true, cancelled: true });
});

test('change type opens as a submenu beside the context menu', async ({ page, planner }) => {
  await task(col(page, '03/11'), 'Buy milk').click({ button: 'right' });
  const menu = page.locator('#ctxMenu');
  await menu.waitFor();

  const panel = menu.locator('.ctx-submenu-panel');
  await expect(panel).toBeHidden();

  await menu.locator('.ctx-submenu-trigger').hover();
  await expect(panel).toBeVisible();

  // The panel must sit outside the first-level menu, not expand inside it.
  const menuBox = await menu.boundingBox();
  const panelBox = await panel.boundingBox();
  const besideMenu = panelBox.x >= menuBox.x + menuBox.width || panelBox.x + panelBox.width <= menuBox.x;
  expect(besideMenu).toBe(true);
});

test('saves task details and reads them back', async ({ page, planner }) => {
  // Details are fetched lazily per task rather than loaded with the board, so
  // this covers both halves of the round trip.
  await ctxMenu(page, task(col(page, '03/11'), 'Buy milk'), 'details');
  await modal(page).locator('.modal-textarea').fill('two litres, oat');
  await modal(page).locator('.modal-btn-primary').click();

  await planner.reload();
  await ctxMenu(page, task(col(page, '03/11'), 'Buy milk'), 'details');
  await expect(modal(page).locator('.modal-textarea')).toHaveValue('two litres, oat');
});

test('Ctrl+Z restores a deleted task', async ({ page, planner }) => {
  await task(col(page, '03/11'), 'Buy milk').locator('.del').click();
  await expect(task(col(page, '03/11'), 'Buy milk')).toHaveCount(0);

  await page.keyboard.press('Control+z');
  await expect(task(col(page, '03/11'), 'Buy milk')).toBeVisible();
});
