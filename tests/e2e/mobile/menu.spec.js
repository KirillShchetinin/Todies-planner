// The mobile side menu is the only route to settings and labels on a phone —
// the desktop action bar is hidden at this width.

const { test, expect } = require('../fixtures/test');
const { hero, sideMenu, task } = require('../fixtures/mobile');

const openMenu = page => page.locator('.mob-icon-btn', { hasText: '≡' }).click();

test('switches language', async ({ page, planner }) => {
  await openMenu(page);
  await sideMenu(page).locator('.mob-settings-pill', { hasText: 'RU' }).click();

  await expect(page.locator('.mob-title')).toHaveText('планировщик недели');
  await planner.reload();
  await expect(page.locator('.mob-title')).toHaveText('планировщик недели');
  expect(await planner.settings()).toMatchObject({ lang: 'ru' });
});

test('the mobile scale is independent of the desktop scale', async ({ page, planner }) => {
  await openMenu(page);
  await sideMenu(page).locator('.mob-settings-pill', { hasText: 'Larger' }).click();

  await expect(page.locator('html')).toHaveCSS('--ui-scale', '1.125');

  await planner.reload();
  await expect(page.locator('html')).toHaveCSS('--ui-scale', '1.125');
  expect(await planner.settings()).toMatchObject({ uiScale: 1, uiScaleMobile: 1.125 });
});

test('deletes a label and falls its tasks back to Random', async ({ page, planner }) => {
  await openMenu(page);
  await sideMenu(page).locator('.mob-menu-label-row', { hasText: 'Work' })
    .locator('.mob-menu-label-del').click();
  await page.locator('#modalOverlay .modal-btn-danger').click();

  await planner.reload();
  expect(await planner.task('Review PRs')).toMatchObject({ type: 'Random' });

  await openMenu(page);
  await expect(sideMenu(page).locator('.mob-menu-label-name')).toHaveText(['Random', 'Home']);
});

test('opens the labels panel from the title bar', async ({ page, planner }) => {
  await page.locator('.mob-icon-btn', { hasText: '◆' }).click();
  await expect(sideMenu(page).locator('.mob-menu-label-name')).toHaveText(['Random', 'Work', 'Home']);
});
