// Unscheduled tasks get a drawer on mobile instead of the desktop side bar,
// and scheduling one is a two-hop flow (drawer → action sheet).

const { test, expect } = require('../fixtures/test');
const { dayRow, drawer, sheet, task, fillAddSheet } = require('../fixtures/mobile');

test('the chip summarises and opens the drawer', async ({ page, planner }) => {
  const chip = page.locator('.mob-unsched-chip');
  await expect(chip.locator('.mob-unsched-label')).toHaveText('unscheduled · 2');
  await expect(chip.locator('.mob-unsched-dot')).toHaveCount(2);

  await chip.click();
  await expect(drawer(page)).toBeVisible();
  await expect(drawer(page).locator('.task-text')).toHaveText(['Fix bike', 'Renew passport']);
});

test('schedules an unscheduled task onto a day', async ({ page, planner }) => {
  await page.locator('.mob-unsched-chip').click();
  await drawer(page).locator('.mob-unsched-task-row', { hasText: 'Fix bike' })
    .locator('.mob-sched-btn').click();

  await sheet(page).locator('.mob-day-grid-btn', { hasText: 'Thu' }).click();

  await expect(page.locator('.mob-unsched-chip .mob-unsched-label')).toHaveText('unscheduled · 1');
  await planner.reload();
  expect(await planner.formOf('Fix bike')).toBe(planner.formIds.thu);
});

test('adds a task straight into the drawer', async ({ page, planner }) => {
  await page.locator('.mob-unsched-chip').click();
  await drawer(page).locator('.mob-unsched-add-btn').click();
  await fillAddSheet(page, 'Home', 'Sort the garage');

  await planner.reload();
  expect(await planner.formOf('Sort the garage')).toBe(planner.formIds.unscheduled);
});
