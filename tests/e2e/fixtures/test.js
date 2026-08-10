// Shared test fixture: one seeded user per test, a pinned clock, and the two
// helpers every spec needs (open / reload-and-wait).

const base = require('@playwright/test');
const { seedBoard, readTasks } = require('./db');
const { FIXED_NOW, ANCHOR_TASK } = require('./seed-data');

const KILL_ANIMATIONS = '*,*::before,*::after{transition:none!important;animation:none!important}';

const test = base.test.extend({
  planner: async ({ page }, use) => {
    const seeded = seedBoard();

    await page.clock.setFixedTime(FIXED_NOW);
    // The page links Google Fonts; blocking keeps the suite offline-safe.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());

    // Tasks land in the last of the three load phases, so an anchor task being
    // painted means metadata, forms and tasks have all been applied.
    const ready = async () => {
      await page.addStyleTag({ content: KILL_ANIMATIONS });
      await page.locator('.task', { hasText: ANCHOR_TASK }).first().waitFor();
    };

    const planner = {
      ...seeded,
      async open() {
        await page.goto(`/?token=${seeded.token}`);
        await ready();
      },
      async reload() {
        // Mutations are optimistic: the DOM updates before the write lands, so
        // a test can reach here with a PUT/DELETE still in flight — and
        // reloading would abort it. Let the network settle first.
        await page.waitForLoadState('networkidle');
        await page.reload();
        await ready();
      },
      /** Rows as the server stored them. */
      rows() {
        return readTasks(seeded.userId);
      },
      /** A field of the in-page task model — for state with no clean DOM form. */
      task(name) {
        return page.evaluate(text => {
          for (const list of Object.values(state)) {
            const t = list.find(x => x.text === text);
            if (t) return t;
          }
          return null;
        }, name);
      },
      /** The form id a task currently lives in, per the in-page model. */
      formOf(name) {
        return page.evaluate(text => {
          for (const [formId, list] of Object.entries(state)) {
            if (list.some(x => x.text === text)) return Number(formId);
          }
          return null;
        }, name);
      },
      settings() {
        return page.evaluate(() => ({ lang, uiScale, uiScaleMobile }));
      },
    };

    await planner.open();
    await use(planner);
  },
});

module.exports = { test, expect: base.expect, ANCHOR_TASK };
