// Adding on mobile goes through a two-step bottom sheet with its own target-day
// picker — a completely different path from the desktop inline form.

const { test, expect } = require('../fixtures/test');
const { hero, dayRow, sheet, task, fillAddSheet } = require('../fixtures/mobile');
const { SUNDAY } = require('../fixtures/seed-data');

test('quick add lands on today', async ({ page, planner }) => {
  await page.locator('.mob-qa-main').click();
  await expect(sheet(page).locator('.mob-target-text')).toHaveText('Wed, Mar 11');

  await fillAddSheet(page, 'Work', 'Book flights');

  await expect(task(hero(page, 'Wed'), 'Book flights')).toBeVisible();
  await planner.reload();
  await expect(task(hero(page, 'Wed'), 'Book flights')).toBeVisible();
  expect(await planner.formOf('Book flights')).toBe(planner.formIds.wed);
});

test('the hero add button targets that day, not today', async ({ page, planner }) => {
  await dayRow(page, 'Fri').click();
  await hero(page, 'Fri').locator('.add-btn').click();

  await expect(sheet(page).locator('.mob-target-text')).toHaveText('Fri, Mar 13');
  await fillAddSheet(page, 'Home', 'Water the plants');

  await planner.reload();
  expect(await planner.formOf('Water the plants')).toBe(planner.formIds.fri);
  expect(await planner.task('Water the plants')).toMatchObject({ type: 't-custom-1' });
});

test('retargeting to a day with no column creates it', async ({ page, planner }) => {
  await page.locator('.mob-qa-main').click();
  await sheet(page).locator('.mob-target-input').fill('2026-03-15');
  await expect(sheet(page).locator('.mob-target-text')).toHaveText('Sun, Mar 15');

  await fillAddSheet(page, 'Work', 'Meal prep');
  await expect(task(hero(page, 'Sun'), 'Meal prep')).toBeVisible();

  // A reload collapses everything but today, so Sunday comes back as a row.
  await planner.reload();
  await expect(page.locator('.mob-day-chip.no-col')).toHaveCount(0);
  await expect(dayRow(page, 'Sun').locator('.mob-dot')).toHaveCount(1);
  expect(await planner.task('Meal prep')).toMatchObject({ type: 't-custom-0' });
});

test('dismissing the sheet adds nothing', async ({ page, planner }) => {
  await page.locator('.mob-qa-main').click();
  await sheet(page).locator('.mob-label-pill', { hasText: 'Work' }).click();
  await sheet(page).locator('.mob-name-input').fill('Never saved');
  await page.locator('#mob-overlay .mob-scrim').click();

  await expect(page.locator('#mob-overlay')).toHaveCount(0);
  await planner.reload();
  expect(planner.rows().map(r => r.name)).not.toContain('Never saved');
});
