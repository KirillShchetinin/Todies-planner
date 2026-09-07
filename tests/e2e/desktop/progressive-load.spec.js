// Progressive load on the desktop board: the window opens on the current week
// plus two ahead, and the two controls reveal the rest in their own direction.
//
// The backend half of this (which forms get `recent`) is covered by
// tests/test_ranges.py and tests/test_forms.py; what only a browser can prove
// is that the board renders exactly the loaded weeks and that a click fetches
// the right batch.

const { test, expect, WEEKS, LOADED, EARLIER, LATER, byKey, taskOf } = require('../fixtures/progressive');
const { col } = require('../fixtures/desktop');

const earlierBtn = page => page.locator('.earlier-weeks-btn', { hasText: 'earlier weeks' });
const loadMoreBtn = page => page.locator('.earlier-weeks-btn', { hasText: 'load more' });

/** The week keys whose seeded task is on the board right now. */
async function shownWeeks(page) {
  const texts = await page.locator('.week-days .task-text').allTextContents();
  return WEEKS.filter(w => texts.includes(taskOf(w.key))).map(w => w.key);
}

test('opens on the current week plus two ahead, with both controls', async ({ page, planner }) => {
  expect(await shownWeeks(page)).toEqual(LOADED.map(w => w.key));

  // A week outside the window is not merely empty — its column is absent.
  await expect(col(page, byKey['W+3'].mmdd)).toHaveCount(0);
  await expect(col(page, byKey['W-3'].mmdd)).toHaveCount(0);

  await expect(earlierBtn(page)).toBeVisible();
  await expect(loadMoreBtn(page)).toBeVisible();
});

test('"load more" reveals the next two weeks, then exhausts', async ({ page, planner }) => {
  await loadMoreBtn(page).click();
  await expect(col(page, byKey['W+4'].mmdd)).toBeVisible();

  // Exactly two weeks per click — the third stays hidden.
  expect(await shownWeeks(page)).toEqual([...LOADED, byKey['W+3'], byKey['W+4']].map(w => w.key));
  await expect(col(page, byKey['W+5'].mmdd)).toHaveCount(0);
  await expect(loadMoreBtn(page)).toBeVisible();

  await loadMoreBtn(page).click();
  await expect(col(page, byKey['W+5'].mmdd)).toBeVisible();
  await expect(loadMoreBtn(page)).toHaveCount(0);
  // Nothing was loaded behind us: the earlier direction is untouched.
  await expect(earlierBtn(page)).toBeVisible();
  await expect(col(page, byKey['W-3'].mmdd)).toHaveCount(0);
});

test('the control sits below the last week, the earlier one above the first', async ({ page, planner }) => {
  const rows = page.locator('#board > *');
  await expect(rows.first()).toHaveClass(/earlier-weeks-row/);
  await expect(rows.last()).toHaveClass(/earlier-weeks-row/);
  await expect(rows.first().locator('button')).toHaveText(/earlier weeks/);
  await expect(rows.last().locator('button')).toHaveText(/load more/);
});

test('"earlier weeks" still works, and the two directions are independent', async ({ page, planner }) => {
  await earlierBtn(page).click();

  await expect(col(page, byKey['W-3'].mmdd)).toBeVisible();
  await expect(earlierBtn(page)).toHaveCount(0);
  // Revealing the past must not have pulled the future in with it.
  await expect(loadMoreBtn(page)).toBeVisible();
  await expect(col(page, byKey['W+3'].mmdd)).toHaveCount(0);
});

test('a revealed week keeps its own unscheduled container', async ({ page, planner }) => {
  const boxes = page.locator('.unscheduled-bar');
  await expect(boxes).toHaveCount(LOADED.length);

  await loadMoreBtn(page).click();
  await expect(boxes).toHaveCount(LOADED.length + 2);
});

test('only the loaded forms are fetched', async ({ page, planner }) => {
  const ids = await planner.loadedIds();
  for (const w of LOADED) expect(ids).toContain(planner.formIds[w.key]);
  for (const w of [...EARLIER, ...LATER]) expect(ids).not.toContain(planner.formIds[w.key]);

  await loadMoreBtn(page).click();
  await expect.poll(() => planner.loadedIds()).toContain(planner.formIds['W+3']);
  expect(await planner.loadedIds()).not.toContain(planner.formIds['W+5']);
});

test('the window is re-applied on reload, not remembered', async ({ page, planner }) => {
  await loadMoreBtn(page).click();
  await expect(col(page, byKey['W+3'].mmdd)).toBeVisible();

  await planner.reload();
  expect(await shownWeeks(page)).toEqual(LOADED.map(w => w.key));
});

test.describe('with customLoad off', () => {
  test.use({ customLoad: false });

  test('every week renders and neither control appears', async ({ page, planner }) => {
    expect(await shownWeeks(page)).toEqual(WEEKS.map(w => w.key));
    await expect(earlierBtn(page)).toHaveCount(0);
    await expect(loadMoreBtn(page)).toHaveCount(0);
  });
});
