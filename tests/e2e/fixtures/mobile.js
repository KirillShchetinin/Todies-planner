// Mobile-view locators and gestures.

/** The expanded day card. Without an argument: whichever day is expanded. */
const hero = (page, dayLabel) => dayLabel
  ? page.locator('.mob-day-hero').filter({ has: page.locator('.mob-hero-dayname', { hasText: dayLabel }) })
  : page.locator('.mob-day-hero');

/** A collapsed day, by its 3-letter label. */
const dayRow = (page, dayLabel) =>
  page.locator('.mob-day-row').filter({ has: page.locator('.mob-row-daylabel', { hasText: dayLabel.toUpperCase() }) });

/** A day chip in the top strip, by day-of-month. */
const stripChip = (page, dayNum) =>
  page.locator('.mob-day-chip').filter({ has: page.locator('.mob-chip-date', { hasText: new RegExp(`^${dayNum}$`) }) });

const task = (scope, text) => scope.locator('.task').filter({ hasText: text });

const sheet = page => page.locator('#mob-overlay .mob-sheet');
const sideMenu = page => page.locator('#mob-overlay .mob-side-menu');
const drawer = page => page.locator('#mob-overlay .mob-unsched-drawer');

/** Hold a task down past the 350ms threshold to open the action sheet. */
async function longPress(page, locator, ms = 600) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Two-step add sheet: pick a label, then type the name and submit. */
async function fillAddSheet(page, type, name) {
  const s = sheet(page);
  await s.locator('.mob-label-pill', { hasText: type }).click();
  await s.locator('.mob-name-input').fill(name);
  await s.locator('.mob-name-add-btn').click();
}

module.exports = { hero, dayRow, stripChip, task, sheet, sideMenu, drawer, longPress, fillAddSheet };
