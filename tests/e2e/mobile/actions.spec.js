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
  await expect(sheet(page).locator('.mob-action-row')).toHaveCount(5);
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

test('renames a task from the action sheet', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.task-text').click();
  await sheet(page).locator('.mob-name-input').fill('Buy oat milk');
  await sheet(page).locator('.mob-name-add-btn').click();

  // The sheet stays open on the renamed task.
  await expect(sheet(page).locator('.task-text')).toHaveText('Buy oat milk');

  await planner.reload();
  await expect(task(hero(page), 'Buy oat milk')).toBeVisible();
  expect(planner.rows().map(r => r.name)).not.toContain('Buy milk');
});

test('saves task details and reads them back', async ({ page, planner }) => {
  // Details are fetched lazily per task rather than loaded with the board, so
  // this covers both halves of the round trip.
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.mob-action-row', { hasText: 'Details' }).click();
  await sheet(page).locator('.mob-details-area').fill('two litres, oat');
  await sheet(page).locator('.mob-details-save').click();

  await planner.reload();
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.mob-action-row', { hasText: 'Details' }).click();
  await expect(sheet(page).locator('.mob-details-area')).toHaveValue('two litres, oat');
});

test('deletes from the action sheet', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.mob-action-row', { hasText: 'Delete' }).click();

  await expect(task(hero(page), 'Buy milk')).toHaveCount(0);
  await planner.reload();
  expect(planner.rows().map(r => r.name)).not.toContain('Buy milk');
});

// The sheet offers four targets: tomorrow, next week's unscheduled box, a
// picked date, and — depending on where the task sits — either its own week's
// unscheduled box ("later") or today (see unscheduled.spec.js).

test('moves a task to tomorrow', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.mob-day-grid-btn', { hasText: 'Tomorrow' }).click();

  // The clock is pinned to Wed 11 Mar, so tomorrow is Thu — which expands, so
  // the task is visible where it landed.
  await expect(task(hero(page, 'Thu'), 'Buy milk')).toBeVisible();

  await planner.reload();
  expect(await planner.formOf('Buy milk')).toBe(planner.formIds.thu);
});

test('"later" drops a task into its own week\'s unscheduled box', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.mob-day-grid-btn', { hasText: 'Later' }).click();

  await expect(page.locator('.mob-unsched-chip .mob-unsched-label')).toHaveText('unscheduled · 3');
  await planner.reload();
  expect(await planner.formOf('Buy milk')).toBe(planner.formIds.unscheduled);
});

test('a target the task already sits in is disabled', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.mob-day-grid-btn', { hasText: 'Tomorrow' }).click();

  await longPress(page, task(hero(page, 'Thu'), 'Buy milk'));
  await expect(sheet(page).locator('.mob-day-grid-btn', { hasText: 'Tomorrow' })).toBeDisabled();
});

test('"next week" files the task in next week\'s unscheduled box, creating it', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));
  await sheet(page).locator('.mob-day-grid-btn', { hasText: 'Next week' }).click();

  // Next week has no column at all, so its Monday is created to give the
  // unscheduled container a week row to pair with.
  await expect(page.locator('.mob-unsched-chip')).toHaveCount(2);
  await expect(dayRow(page, 'Mon')).toHaveCount(2);
  const target = await page.evaluate(() => weekUnscheduled[1].id);

  await planner.reload();
  expect(await planner.formOf('Buy milk')).toBe(target);
  // Containers pair with weeks by position, so the new one must still be second.
  expect(await page.evaluate(() => weekUnscheduled[1].id)).toBe(target);
});

test('a custom date creates the day it names and moves the task there', async ({ page, planner }) => {
  await longPress(page, task(hero(page), 'Buy milk'));

  // Sunday is deliberately absent from the fixture board. The picker closing —
  // not each `change` — is what commits the move.
  const picker = sheet(page).locator('.mob-day-grid-btn--date .mob-target-input');
  await picker.fill('2026-03-15');
  await picker.blur();

  await expect(task(hero(page, 'Sun'), 'Buy milk')).toBeVisible();

  await planner.reload();
  const sunId = await page.evaluate(() => cols.find(c => c.date === '03/15/2026')?.id ?? null);
  expect(sunId).not.toBeNull();
  expect(await planner.formOf('Buy milk')).toBe(sunId);
});
