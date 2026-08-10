// What the board must look like for a known week: the grid, today, and the
// collapse toggle. Regressions here break every other surface.

const { test, expect } = require('../fixtures/test');
const { col, unscheduledCol, task } = require('../fixtures/desktop');
const { SUNDAY } = require('../fixtures/seed-data');

test('renders the seeded week in date order, with a ghost for the missing day', async ({ page, planner }) => {
  const labels = page.locator('.week-days .col .col-header-text > span:first-child');
  await expect(labels).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  await expect(page.locator('.week-days .col-ghost')).toHaveCount(1);
  await expect(unscheduledCol(page)).toHaveCount(1);
});

test('marks today', async ({ page, planner }) => {
  await expect(page.locator('.col.today')).toHaveCount(1);
  await expect(col(page, '03/11')).toHaveClass(/today/);
  await expect(col(page, '03/11').locator('.today-flames')).toBeVisible();
});

test('places tasks in their own column, in sort order', async ({ page, planner }) => {
  await expect(col(page, '03/11').locator('.task-text')).toHaveText(
    ['Review PRs', 'Buy milk', 'Call bank', 'Water plants', 'Old chore']);
  await expect(col(page, '03/09').locator('.task-text')).toHaveText(['Team standup', 'Walk the dog']);
  await expect(col(page, '03/12').locator('.task')).toHaveCount(0);
  await expect(unscheduledCol(page).locator('.task-text')).toHaveText(['Fix bike', 'Renew passport']);
  await expect(task(col(page, '03/09'), 'Walk the dog')).toHaveClass(/done/);
});

test('collapsing a column hides overflow behind dots, and survives a reload', async ({ page, planner }) => {
  const wed = col(page, '03/11');
  await wed.locator('.col-header-left').click();

  // 4 active + 1 done → 3 active shown, 1 active + 1 done dotted away.
  await expect(wed.locator('.task:visible')).toHaveCount(3);
  await expect(wed.locator('.col-dot')).toHaveCount(2);

  await planner.reload();
  await expect(col(page, '03/11').locator('.task:visible')).toHaveCount(3);

  await col(page, '03/11').locator('.col-header-left').click();
  await expect(col(page, '03/11').locator('.task:visible')).toHaveCount(5);
});

test('a column with nothing to hide does not collapse', async ({ page, planner }) => {
  const fri = col(page, '03/13');
  await fri.locator('.col-header-left').click();
  await expect(fri.locator('.task:visible')).toHaveCount(1);
  await expect(fri.locator('.col-dot')).toHaveCount(0);
});

test('double-clicking the ghost slot creates that day', async ({ page, planner }) => {
  await page.locator('.week-days .col-ghost').dblclick();
  await expect(col(page, SUNDAY.date.slice(0, 5))).toBeVisible();

  await planner.reload();
  await expect(page.locator('.week-days .col .col-header-text > span:first-child')).toHaveText(
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
});
