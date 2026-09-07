// The mobile surface for progressive load: a chip at each end of the day strip
// instead of a row above and below the board. The batching and direction logic
// is shared with desktop and covered there — this only checks that mobile's own
// controls are present, in the right places, and wired to the right direction.
//
// Weeks are addressed by the seeded column's LABEL, not by day-of-month: the
// strip shows a chip for all 7 slots of every visible week, and two weeks four
// apart share a day number in February.

const { test, expect, WEEKS, LOADED } = require('../fixtures/progressive');
const { dayRow } = require('../fixtures/mobile');

/** One unscheduled chip is rendered per visible week row. */
const weekCount = page => page.locator('.mob-unsched-chip');

test('a chip at each end of the strip reveals its own direction', async ({ page, planner }) => {
  await expect(weekCount(page)).toHaveCount(LOADED.length);

  const strip = page.locator('.mob-day-strip > *');
  await expect(strip.first()).toHaveText(/earlier weeks/);
  await expect(strip.last()).toHaveText(/load more/);

  await strip.last().click();
  await expect(dayRow(page, 'W+4')).toBeVisible();
  await expect(dayRow(page, 'W-3')).toHaveCount(0);

  await page.locator('.mob-earlier-chip', { hasText: 'earlier weeks' }).click();
  await expect(dayRow(page, 'W-3')).toBeVisible();
});

test.describe('with customLoad off', () => {
  test.use({ customLoad: false });

  test('every week renders and neither chip appears', async ({ page, planner }) => {
    await expect(weekCount(page)).toHaveCount(WEEKS.length);
    await expect(page.locator('.mob-earlier-chip')).toHaveCount(0);
  });
});
