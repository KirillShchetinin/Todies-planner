// The mobile shell must never let the document itself scroll: #board is the
// only scroller, and anything that moves the document takes the header (title,
// labels/settings buttons, day strip) off screen with no gesture to bring it
// back — overflow: hidden blocks the user, not the scroll.
//
// This has broken twice. Two independent defences are asserted here: the body
// can't be taller than the viewport, and the initial scroll-to-today only ever
// touches #board.

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
  await page.waitForTimeout(100);

  const m = await page.evaluate(() => ({
    docScrollTop: document.scrollingElement.scrollTop,
    headerTop:    document.getElementById('mobile-header').getBoundingClientRect().top,
    boardScrolled: document.getElementById('board').scrollTop > 0,
  }));

  expect(m.docScrollTop).toBe(0);
  expect(m.headerTop).toBe(0);
  expect(m.boardScrolled).toBe(true);
});
