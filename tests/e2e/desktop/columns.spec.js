// Column lifecycle: creation with date validation, and the guard that stops a
// column taking its tasks down with it.

const { test, expect } = require('../fixtures/test');
const { col, addDay, modal } = require('../fixtures/desktop');

test('adds a day and slots it into the right week position', async ({ page, planner }) => {
  await addDay(page, '03/15/2026');

  const sun = col(page, '03/15');
  await expect(sun).toBeVisible();
  // The label is inferred from the date, not typed.
  await expect(sun.locator('.col-header-text > span:first-child')).toHaveText('Sun');

  await planner.reload();
  await expect(page.locator('.week-days .col .date')).toHaveText(
    ['03/09', '03/10', '03/11', '03/12', '03/13', '03/14', '03/15']);
});

test('rejects an impossible date', async ({ page, planner }) => {
  await addDay(page, '13/45');

  await expect(modal(page)).toContainText('valid date');
  await modal(page).locator('.modal-btn').click();
  await expect(page.locator('.week-days .col')).toHaveCount(6);
});

test('refuses to delete a column that still has tasks', async ({ page, planner }) => {
  await col(page, '03/13').locator('.del-col').click();

  await expect(modal(page)).toContainText('Remove all tasks');
  await modal(page).locator('.modal-btn').click();
  await expect(col(page, '03/13')).toBeVisible();

  await planner.reload();
  await expect(col(page, '03/13')).toBeVisible();
});

test('deletes an empty column', async ({ page, planner }) => {
  await col(page, '03/14').locator('.del-col').click();
  await expect(col(page, '03/14')).toHaveCount(0);

  await planner.reload();
  await expect(col(page, '03/14')).toHaveCount(0);
  await expect(page.locator('.week-days .col')).toHaveCount(5);
});
