// The mobile shell must never let the document itself scroll: #board is the
// only scroller, and anything that moves the document takes the header (title,
// labels/settings buttons, day strip) off screen with no gesture to bring it
// back — overflow: hidden blocks the user, not the scroll.
//
// This has broken twice. Three independent defences are asserted here: the body
// can't be taller than the viewport, the initial scroll-to-today only ever
// touches #board, and a document scroll from anywhere else is snapped back.
//
// The rest of the file pins the bottom of the shell: the quick-add floats over
// the board with no backdrop of its own, and the board's last tasks scroll up
// to it instead of stopping short.

const { test, expect } = require('../fixtures/test');

test('the mobile shell is exactly viewport-tall, so the document cannot scroll', async ({ page, planner }) => {
  const m = await page.evaluate(() => ({
    overflowPx: document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight,
    // base.css's `min-height: 100vh` must be reset — on iOS 100vh exceeds the
    // visible viewport and silently re-introduces the overflow.
    bodyMinHeight: getComputedStyle(document.body).minHeight,
  }));

  expect(m.overflowPx).toBe(0);
  expect(m.bodyMinHeight).toBe('0px');
});

test('scroll-to-today scrolls #board, never the document', async ({ page, planner }) => {
  // Stand in for iOS, where 100vh is taller than the visible viewport: give the
  // document real overflow, then re-run the initial scroll.
  await page.addStyleTag({ content: 'body[data-view="mobile"] { min-height: calc(100vh + 120px); }' });

  await page.evaluate(() => {
    _didInitialScroll = false;
    _scrollToToday();
  });

  // The scroll lands in a rAF callback, so poll rather than sleep on it.
  await expect.poll(() => page.evaluate(
    () => document.getElementById('board').scrollTop > 0)).toBe(true);
  expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(0);
  expect(await page.evaluate(
    () => document.getElementById('mobile-header').getBoundingClientRect().top)).toBe(0);
});

test('a document scroll from anywhere is snapped back', async ({ page, planner }) => {
  // iOS scrolls the document itself to reveal a focused input, and overflow:
  // hidden does not stop it. Give the document overflow and shove it.
  await page.addStyleTag({ content: 'body[data-view="mobile"] { min-height: calc(100vh + 120px); }' });

  await page.evaluate(() => { document.scrollingElement.scrollTop = 120; });

  // The snap-back runs on the scroll event, which fires asynchronously.
  await expect.poll(() => page.evaluate(
    () => document.scrollingElement.scrollTop)).toBe(0);
  expect(await page.evaluate(
    () => document.getElementById('mobile-header').getBoundingClientRect().top)).toBe(0);
});

test('the quick-add floats over the board instead of sitting on a strip of its own', async ({ page, planner }) => {
  const m = await page.evaluate(() => {
    const qa = document.getElementById('mob-quick-add');
    const s  = getComputedStyle(qa);
    return {
      backgroundImage: s.backgroundImage,
      backgroundColor: s.backgroundColor,
      // It overlaps the board rather than displacing it: the board still runs
      // to the bottom of the screen behind it.
      boardBottom: Math.round(document.getElementById('board').getBoundingClientRect().bottom),
      viewportBottom: window.innerHeight,
    };
  });

  expect(m.backgroundImage).toBe('none');
  expect(m.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(m.boardBottom).toBe(m.viewportBottom);
});

test('the board scrolls its last tasks right up to the quick-add', async ({ page, planner }) => {
  const m = await page.evaluate(async () => {
    const board = document.getElementById('board');
    board.scrollTop = board.scrollHeight;
    await new Promise(r => requestAnimationFrame(r));

    const lists = [...document.querySelectorAll('.mob-day-list')];
    return {
      lastContentBottom: lists[lists.length - 1].getBoundingClientRect().bottom,
      quickAddTop: document.querySelector('.mob-quick-add-btn').getBoundingClientRect().top,
    };
  });

  // The gap left under the last day is the quick-add's own room and nothing
  // more — no dead strip below it.
  const gap = m.quickAddTop - m.lastContentBottom;
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(40);
});
