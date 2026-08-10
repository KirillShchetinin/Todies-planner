// Drag and drop is desktop-only (mobile moves tasks through the action sheet)
// and is the single richest source of state bugs: it rewrites sort_order for a
// whole column and may reparent a task at the same time.

const { test, expect } = require('../fixtures/test');
const { col, unscheduledCol, task } = require('../fixtures/desktop');

test('reorders tasks inside a column', async ({ page, planner }) => {
  const wed = col(page, '03/11');
  // Drop above the first card: y=2 puts the pointer over its top half.
  await task(wed, 'Water plants').dragTo(task(wed, 'Review PRs'), { targetPosition: { x: 20, y: 2 } });

  const expected = ['Water plants', 'Review PRs', 'Buy milk', 'Call bank', 'Old chore'];
  await expect(wed.locator('.task-text')).toHaveText(expected);

  await planner.reload();
  await expect(col(page, '03/11').locator('.task-text')).toHaveText(expected);
});

test('moves a task to another column', async ({ page, planner }) => {
  await task(col(page, '03/11'), 'Buy milk').dragTo(col(page, '03/12').locator('.drop-zone'));

  await expect(task(col(page, '03/12'), 'Buy milk')).toBeVisible();
  await planner.reload();

  await expect(col(page, '03/12').locator('.task-text')).toHaveText(['Buy milk']);
  await expect(col(page, '03/11').locator('.task-text')).toHaveText(
    ['Review PRs', 'Call bank', 'Water plants', 'Old chore']);
  expect(await planner.formOf('Buy milk')).toBe(planner.formIds.thu);
});

test('moves a task out of the unscheduled bar onto a day', async ({ page, planner }) => {
  await task(unscheduledCol(page), 'Fix bike').dragTo(col(page, '03/12').locator('.drop-zone'));

  await planner.reload();
  await expect(task(col(page, '03/12'), 'Fix bike')).toBeVisible();
  await expect(unscheduledCol(page).locator('.task-text')).toHaveText(['Renew passport']);
});
