// Every mobile text field must stay visible above the on-screen keyboard.
//
// This has broken again and again, each time on a real phone after the tests
// passed: every earlier test stubbed ONE model of how the browser reports the
// keyboard, the fix was tuned to that model, and the next iOS release reported
// it differently. So this file does not trust the browser's report at all:
//
//   - Ground truth is the keyboard itself. Each model decides what the page is
//     *told* (visualViewport, innerHeight, a real resize), but the assertion is
//     always against where the keys *actually are*, never against what the
//     page was told.
//   - Every field that raises the keyboard runs against every model — the
//     matrix is SURFACES × KEYBOARD_MODELS.
//   - A static guard fails the suite when mobile.js gains a text field that is
//     not in SURFACES, so a new field can't silently skip the matrix.
//
// To add a field: add it to SURFACES. To cover a new browser quirk: add it to
// KEYBOARD_MODELS. Never loosen the assertion to fit a model.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('../fixtures/test');
const { hero, task, sheet, longPress } = require('../fixtures/mobile');

// A tall iOS keyboard (with the accessory bar) is ~36-46% of a portrait screen.
const KEYBOARD_FRACTION = 0.46;

/**
 * Each model installs itself before the surface is opened (listeners bind to
 * whatever window.visualViewport is at build time), then `raise(kb)` puts the
 * keyboard up. It returns the band of layout-viewport y-coordinates that is
 * really visible: [top, bottom).
 */
const KEYBOARD_MODELS = {
  // Classic iOS Safari: the visual viewport shrinks, the layout viewport and
  // innerHeight do not.
  'ios: visual viewport shrinks': {
    install: page => stubViewport(page, {}),
    raise: (page, kb, H) => setKb(page, kb).then(() => ({ top: 0, bottom: H - kb })),
  },
  // iOS panning the visual viewport down to "reveal" the focused field, so the
  // top of the layout viewport goes off screen.
  'ios: visual viewport shrinks and pans': {
    install: page => stubViewport(page, { pan: true }),
    raise: (page, kb, H) => setKb(page, kb).then(() => ({ top: kb / 2, bottom: H - kb / 2 })),
  },
  // A browser whose visualViewport never reports the keyboard.
  'visualViewport reports nothing': {
    install: page => stubViewport(page, { silent: true }),
    raise: (page, kb, H) => setKb(page, kb).then(() => ({ top: 0, bottom: H - kb })),
  },
  'no visualViewport at all': {
    install: page => page.evaluate(() => {
      Object.defineProperty(window, 'visualViewport', { get: () => undefined, configurable: true });
      window.__setKb = () => {};
    }),
    raise: (page, kb, H) => setKb(page, kb).then(() => ({ top: 0, bottom: H - kb })),
  },
  // innerHeight shrinks with the keyboard but fixed-position boxes stay where
  // they were (iOS 26-style) — so innerHeight-based maths sees no keyboard.
  'innerHeight shrinks, layout does not': {
    install: page => stubViewport(page, { lyingInnerHeight: true }),
    raise: (page, kb, H) => setKb(page, kb).then(() => ({ top: 0, bottom: H - kb })),
  },
  // Android Chrome honouring interactive-widget=resizes-content: the layout
  // viewport really shrinks.
  'layout viewport really resizes': {
    install: () => Promise.resolve(),
    raise: async (page, kb, H) => {
      const { width } = page.viewportSize();
      await page.setViewportSize({ width, height: H - kb });
      return { top: 0, bottom: H - kb };
    },
  },
};

/** A fake visualViewport driven by window.__kbd, the true keyboard height. */
function stubViewport(page, opts) {
  return page.evaluate(({ pan, silent, lyingInnerHeight }) => {
    const realH = window.innerHeight;
    const vp = new EventTarget();
    window.__kbd = 0;
    Object.defineProperties(vp, {
      height:    { get: () => realH - (silent ? 0 : window.__kbd) },
      width:     { get: () => window.innerWidth },
      offsetTop: { get: () => (pan ? window.__kbd / 2 : 0) },
    });
    Object.defineProperty(window, 'visualViewport', { get: () => vp, configurable: true });
    if (lyingInnerHeight) {
      Object.defineProperty(window, 'innerHeight', { get: () => realH - window.__kbd, configurable: true });
    }
    window.__setKb = px => {
      window.__kbd = px;
      vp.dispatchEvent(new Event('resize'));
      vp.dispatchEvent(new Event('scroll'));
    };
  }, opts);
}

const setKb = (page, kb) => page.evaluate(px => window.__setKb(px), kb);

/**
 * Every place in the mobile view that raises the keyboard. `open` gets the
 * field on screen and focused; `must` lists what has to stay visible with it —
 * you need to see what you type and the button that submits it.
 */
const SURFACES = {
  'add-task name': {
    open: async page => {
      await page.locator('.mob-qa-main').click();
      await sheet(page).locator('.mob-label-pill').first().click();
    },
    must: ['.mob-name-input', '.mob-name-add-btn'],
  },
  'rename from the action sheet': {
    open: async page => {
      await longPress(page, task(hero(page), 'Buy milk'));
      await sheet(page).locator('.mob-preview-editable').click();
    },
    must: ['.mob-name-input', '.mob-name-add-btn'],
  },
  'task details': {
    open: async page => {
      await longPress(page, task(hero(page), 'Buy milk'));
      await sheet(page).locator('.mob-action-row', { hasText: 'Details' }).click();
      await expect(sheet(page).locator('.mob-details-area')).toBeEnabled();
    },
    must: ['.mob-details-area', '.mob-details-save'],
  },
};

async function assertVisible(page, selectors, band, when) {
  for (const sel of selectors) {
    await expect.poll(async () => {
      const b = await sheet(page).locator(sel).boundingBox();
      return !!b && b.y >= band.top - 1 && b.y + b.height <= band.bottom + 1;
    }, { message: `${sel} is under the keyboard ${when} (visible y ${band.top}–${band.bottom})` }).toBe(true);
  }
}

for (const [surfaceName, surface] of Object.entries(SURFACES)) {
  for (const [modelName, model] of Object.entries(KEYBOARD_MODELS)) {
    test(`${surfaceName} stays above the keyboard — ${modelName}`, async ({ page, planner }) => {
      const H = page.viewportSize().height;
      const kb = Math.round(H * KEYBOARD_FRACTION);

      await model.install(page);
      await surface.open(page);
      const field = sheet(page).locator(surface.must[0]);
      await field.focus();

      const band = await model.raise(page, kb, H);
      await assertVisible(page, surface.must, band, 'once it opens');

      // Every mutation ends in a full render(), rebuilding the sheet while the
      // keyboard is already up — no further viewport event comes to fix it.
      await page.evaluate(() => render());
      await assertVisible(page, surface.must, band, 'after a render()');
    });
  }
}

test('every mobile text field is covered by the keyboard matrix', () => {
  // A field that raises the keyboard but isn't in SURFACES would skip every
  // check above. Count them in the source; if this fails, add the new field to
  // SURFACES rather than bumping the number.
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', '..', '..', 'frontend', 'mobile', 'mobile.js'), 'utf8');
  const textFields =
    (src.match(/\.type\s*=\s*'text'/g) || []).length +
    (src.match(/'textarea'/g) || []).length +
    (src.match(/contenteditable/gi) || []).length;
  expect(textFields, 'mobile.js text fields vs SURFACES entries').toBe(Object.keys(SURFACES).length);
});
