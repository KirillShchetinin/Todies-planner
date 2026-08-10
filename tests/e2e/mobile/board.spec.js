// The mobile board is a separate renderer (mobile.js), not a restyled desktop
// one: a day strip plus one expanded "hero" day over collapsed dot rows.

const { test, expect } = require('../fixtures/test');
const { hero, dayRow, stripChip, task } = require('../fixtures/mobile');
const { SUNDAY } = require('../fixtures/seed-data');

test('uses the mobile renderer below the breakpoint', async ({ page, planner }) => {
  await expect(page.locator('body')).toHaveAttribute('data-view', 'mobile');
  await expect(page.locator('#mobile-header')).toBeVisible();
  await expect(page.locator('#main > header')).toBeHidden();
  await expect(page.locator('.week-row')).toHaveCount(0);
});

test('the day strip covers the whole week and marks today', async ({ page, planner }) => {
  await expect(page.locator('.mob-day-chip')).toHaveCount(7);
  await expect(page.locator('.mob-day-chip.today')).toHaveCount(1);
  await expect(stripChip(page, 11)).toHaveClass(/today/);
  // The seeded week has no Sunday form yet.
  await expect(stripChip(page, SUNDAY.dayNum)).toHaveClass(/no-col/);
  // Wed: 4 of 5 tasks still open.
  await expect(stripChip(page, 11).locator('.mob-chip-rem')).toHaveText('4');
  await expect(stripChip(page, 12).locator('.mob-chip-rem')).toHaveText('✓');
});

test('today opens expanded, other days stay collapsed', async ({ page, planner }) => {
  await expect(hero(page)).toHaveCount(1);
  await expect(hero(page)).toHaveClass(/is-today/);
  await expect(hero(page).locator('.mob-hero-count')).toHaveText('1done / 5total');
  await expect(hero(page).locator('.task-text')).toHaveText(
    ['Review PRs', 'Buy milk', 'Call bank', 'Water plants', 'Old chore']);

  await expect(dayRow(page, 'Mon')).toBeVisible();
  await expect(dayRow(page, 'Mon').locator('.mob-dot')).toHaveCount(2);
  await expect(dayRow(page, 'Mon').locator('.mob-row-rem')).toHaveText('1');
  await expect(dayRow(page, 'Thu').locator('.mob-row-empty')).toBeVisible();
});

test('tapping a day row expands it, tapping the hero header collapses it', async ({ page, planner }) => {
  await dayRow(page, 'Mon').click();
  await expect(hero(page, 'Mon')).toBeVisible();
  await expect(task(hero(page, 'Mon'), 'Team standup')).toBeVisible();

  await hero(page, 'Mon').locator('.mob-hero-hdr').click();
  await expect(dayRow(page, 'Mon')).toBeVisible();
  await expect(hero(page, 'Mon')).toHaveCount(0);
});

test('strip chips toggle a day, and an empty chip creates it', async ({ page, planner }) => {
  await stripChip(page, 13).click();
  await expect(hero(page, 'Fri')).toBeVisible();
  await expect(stripChip(page, 13)).toHaveClass(/expanded/);

  await stripChip(page, SUNDAY.dayNum).click();
  await expect(stripChip(page, SUNDAY.dayNum)).not.toHaveClass(/no-col/);

  await planner.reload();
  await expect(dayRow(page, 'Sun')).toBeVisible();
});
