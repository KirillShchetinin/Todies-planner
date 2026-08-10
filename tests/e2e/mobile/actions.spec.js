// On mobile there is no context menu and no drag: long-press is the only way
// to reach done/important/cancel/delete and to move a task between days.

const { test, expect } = require('../fixtures/test');
const { hero, dayRow, stripChip, task, sheet, longPress } = require('../fixtures/mobile');

test('double-tap toggles done', async ({ page, planner }) => {
  await task(hero(page), 'Buy milk').dblclick();

  await expect(task(hero(page), 'Buy milk')).toHaveClass(/done/);
  await expect(stripChip(page, 11).locator('.mob-chip-rem')).toHaveText('3');

  await planner.reload();
  await expect(task(hero(page), 'Buy milk')).toHaveClass(/done/);
});

test('long-press opens the action sheet for that task', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));

  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator('.task-text')).toHaveText('Buy milk');
  await expect(sheet(page).locator('.mob-action-row')).toHaveCount(4);
});

test('marks done and important from the action sheet', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.mob-action-row', { hasText: 'Mark done' }).click();
  await expect(task(hero(page), 'Buy milk')).toHaveClass(/done/);

  await longPress(page, task(hero(page), 'Call bank'));
  await sheet(page).locator('.mob-action-row', { hasText: 'Mark important' }).click();
  await expect(task(hero(page), 'Call bank').locator('.task-important')).toBeVisible();

  await planner.reload();
  await expect(task(hero(page), 'Buy milk')).toHaveClass(/done/);
  expect(await planner.task('Call bank')).toMatchObject({ important: true });
});

test('deletes from the action sheet', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.mob-action-row', { hasText: 'Delete' }).click();

  await expect(task(hero(page), 'Buy milk')).toHaveCount(0);
  await planner.reload();
  expect(planner.rows().map(r => r.name)).not.toContain('Buy milk');
});

test('moves a task to another day', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.mob-day-grid-btn', { hasText: 'Thu' }).click();

  await expect(task(hero(page), 'Buy milk')).toHaveCount(0);
  await expect(dayRow(page, 'Thu').locator('.mob-dot')).toHaveCount(1);

  await planner.reload();
  expect(await planner.formOf('Buy milk')).toBe(planner.formIds.thu);
});

test('the task\'s own day is not offered as a move target', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));
  await expect(sheet(page).locator('.mob-day-grid-btn', { hasText: 'Wed' })).toBeDisabled();
});
