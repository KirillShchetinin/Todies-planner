// Progressive load: the window opens on the current week plus two ahead, and
// the two controls reveal the rest in their own direction.
//
// The batching and direction logic live in common/columns.js, so they are
// covered once, here; the mobile spec only checks that its own surface wires
// into them. Which forms get `recent` is the backend's half, covered by
// tests/test_ranges.py and tests/test_forms.py.

const { test, expect, WEEKS, LOADED, byKey, taskOf } = require('../fixtures/progressive');
const { col } = require('../fixtures/desktop');

const earlierBtn = page => page.locator('.earlier-weeks-btn', { hasText: 'earlier weeks' });
const loadMoreBtn = page => page.locator('.earlier-weeks-btn', { hasText: 'load more' });

/** The week keys whose seeded task is on the board right now. */
async function shownWeeks(page) {
  const texts = await page.locator('.week-days .task-text').allTextContents();
  return WEEKS.filter(w => texts.includes(taskOf(w.key))).map(w => w.key);
}

test('opens on the current week plus two ahead, with a control at each end', async ({ page, planner }) => {
  expect(await shownWeeks(page)).toEqual(LOADED.map(w => w.key));
  // A week outside the window is absent, not merely empty.
  await expect(col(page, byKey['W+3'].mmdd)).toHaveCount(0);

  const rows = page.locator('#board > *');
  await expect(rows.first().locator('button')).toHaveText(/earlier weeks/);
  await expect(rows.last().locator('button')).toHaveText(/load more/);
});

test('"load more" loads two weeks per click until exhausted', async ({ page, planner }) => {
  await loadMoreBtn(page).click();

  expect(await shownWeeks(page)).toEqual([...LOADED, byKey['W+3'], byKey['W+4']].map(w => w.key));
  // Each revealed week brings its own unscheduled container: the pairing is by
  // absolute week index, so hidden weeks must not shift it.
  await expect(page.locator('.unscheduled-bar')).toHaveCount(LOADED.length + 2);
  await expect(loadMoreBtn(page)).toBeVisible();

  await loadMoreBtn(page).click();
  await expect(col(page, byKey['W+5'].mmdd)).toBeVisible();
  await expect(loadMoreBtn(page)).toHaveCount(0);
});

test('the two directions are independent', async ({ page, planner }) => {
  await earlierBtn(page).click();

  await expect(col(page, byKey['W-3'].mmdd)).toBeVisible();
  await expect(earlierBtn(page)).toHaveCount(0);
  // Revealing the past must not have pulled the future in with it.
  await expect(col(page, byKey['W+3'].mmdd)).toHaveCount(0);
  await expect(loadMoreBtn(page)).toBeVisible();
});

test.describe('with customLoad off', () => {
  test.use({ customLoad: false });

  test('every week renders and neither control appears', async ({ page, planner }) => {
    expect(await shownWeeks(page)).toEqual(WEEKS.map(w => w.key));
    await expect(page.locator('.earlier-weeks-btn')).toHaveCount(0);
  });
});
