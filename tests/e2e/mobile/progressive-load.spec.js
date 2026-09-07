// Progressive load on mobile. Same model as desktop, different surface: the
// controls are chips at either end of the day strip, and a week's presence is
// read from its day row and per-week unscheduled chip rather than from task
// text (mobile collapses every day but today to a row of dots).
//
// Weeks are addressed by the seeded column's LABEL, not by day-of-month: the
// strip shows a chip for all 7 slots of every visible week, and two weeks four
// apart share a day number in February.

const { test, expect, WEEKS, LOADED, EARLIER, LATER } = require('../fixtures/progressive');
const { dayRow } = require('../fixtures/mobile');

const earlierChip = page => page.locator('.mob-earlier-chip', { hasText: 'earlier weeks' });
const loadMoreChip = page => page.locator('.mob-earlier-chip', { hasText: 'load more' });

/** One unscheduled chip is rendered per visible week row. */
const weekCount = page => page.locator('.mob-unsched-chip');

test('opens on the current week plus two ahead, with both chips', async ({ page, planner }) => {
  await expect(weekCount(page)).toHaveCount(LOADED.length);
  await expect(dayRow(page, 'W+1')).toBeVisible();
  await expect(dayRow(page, 'W+3')).toHaveCount(0);
  await expect(dayRow(page, 'W-3')).toHaveCount(0);

  await expect(earlierChip(page)).toBeVisible();
  await expect(loadMoreChip(page)).toBeVisible();
});

test('the chips sit at either end of the day strip', async ({ page, planner }) => {
  const strip = page.locator('.mob-day-strip > *');
  await expect(strip.first()).toHaveClass(/mob-earlier-chip/);
  await expect(strip.last()).toHaveClass(/mob-earlier-chip/);
  await expect(strip.first()).toHaveText(/earlier weeks/);
  await expect(strip.last()).toHaveText(/load more/);
});

test('"load more" reveals the next two weeks, then exhausts', async ({ page, planner }) => {
  await loadMoreChip(page).click();
  await expect(dayRow(page, 'W+4')).toBeVisible();

  // Exactly two weeks per click — the third stays hidden.
  await expect(weekCount(page)).toHaveCount(LOADED.length + 2);
  await expect(dayRow(page, 'W+5')).toHaveCount(0);
  await expect(loadMoreChip(page)).toBeVisible();

  await loadMoreChip(page).click();
  await expect(dayRow(page, 'W+5')).toBeVisible();
  await expect(weekCount(page)).toHaveCount(WEEKS.length - EARLIER.length);
  await expect(loadMoreChip(page)).toHaveCount(0);
  await expect(earlierChip(page)).toBeVisible();
});

test('"earlier weeks" reveals the past without pulling the future in', async ({ page, planner }) => {
  await earlierChip(page).click();

  await expect(dayRow(page, 'W-3')).toBeVisible();
  await expect(earlierChip(page)).toHaveCount(0);
  await expect(loadMoreChip(page)).toBeVisible();
  await expect(dayRow(page, 'W+3')).toHaveCount(0);
  await expect(weekCount(page)).toHaveCount(LOADED.length + EARLIER.length);
});

test('only the loaded forms are fetched', async ({ page, planner }) => {
  const ids = await planner.loadedIds();
  for (const w of LOADED) expect(ids).toContain(planner.formIds[w.key]);
  for (const w of LATER) expect(ids).not.toContain(planner.formIds[w.key]);
});

test.describe('with customLoad off', () => {
  test.use({ customLoad: false });

  test('every week renders and neither chip appears', async ({ page, planner }) => {
    await expect(weekCount(page)).toHaveCount(WEEKS.length);
    await expect(earlierChip(page)).toHaveCount(0);
    await expect(loadMoreChip(page)).toHaveCount(0);
  });
});
