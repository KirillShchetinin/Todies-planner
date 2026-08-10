// Settings and labels — the metadata blob. These all round-trip through a
// single PUT /metadata, so a reload check is the only proof they stuck.

const { test, expect } = require('../fixtures/test');
const { col, task, addTask, openPanel, modal } = require('../fixtures/desktop');

test('switching language translates the UI and the day labels', async ({ page, planner }) => {
  await openPanel(page, 'actSettings');
  await page.locator('#langBtn').click();

  await expect(page.locator('#appTitle')).toHaveText('планировщик недели');
  await expect(page.locator('#addDayBtn')).toHaveText('+ добавить день');
  await expect(col(page, '03/11').locator('.col-header-text > span:first-child')).toHaveText('Ср');

  await planner.reload();
  await expect(page.locator('#appTitle')).toHaveText('планировщик недели');
  expect(await planner.settings()).toMatchObject({ lang: 'ru' });
});

test('every EN string has an RU counterpart', async ({ page, planner }) => {
  // Guards the project rule that all user-visible text goes through t() with
  // both locales filled in — the cheapest way to catch a half-added feature.
  const { en, ru } = await page.evaluate(() => ({
    en: Object.keys(TRANSLATIONS.en).sort(),
    ru: Object.keys(TRANSLATIONS.ru).sort(),
  }));
  expect(ru).toEqual(en);
});

test('UI scale changes and is stored separately from the mobile scale', async ({ page, planner }) => {
  await openPanel(page, 'actSettings');
  await page.locator('.scale-btn', { hasText: '+' }).click();

  await expect(page.locator('html')).toHaveCSS('--ui-scale', '1.125');

  await planner.reload();
  await expect(page.locator('html')).toHaveCSS('--ui-scale', '1.125');
  expect(await planner.settings()).toMatchObject({ uiScale: 1.125, uiScaleMobile: 1 });
});

test('creates a custom label and uses it on a task', async ({ page, planner }) => {
  await openPanel(page, 'actLabels');
  await page.locator('#legend .leg-add').click();
  await page.locator('#newLabelName').fill('Errand');
  await page.locator('#newLabelConfirm').click();

  await planner.reload();
  await openPanel(page, 'actLabels');
  await expect(page.locator('#legend .leg > span:first-child')).toHaveText(['Random', 'Work', 'Home', 'Errand']);

  await addTask(col(page, '03/12'), 'Errand', 'Post parcel');
  await planner.reload();
  expect(await planner.task('Post parcel')).toMatchObject({ type: 't-custom-2' });
});

test('deleting a label falls its tasks back to Random', async ({ page, planner }) => {
  await openPanel(page, 'actLabels');
  await page.locator('#legend .leg', { hasText: 'Work' }).locator('.leg-del').click();
  await modal(page).locator('.modal-btn-danger').click();

  await planner.reload();
  await openPanel(page, 'actLabels');
  await expect(page.locator('#legend .leg > span:first-child')).toHaveText(['Random', 'Home']);
  expect(await planner.task('Review PRs')).toMatchObject({ type: 'Random' });
  expect(await planner.task('Call bank')).toMatchObject({ type: 't-custom-1' });
});
