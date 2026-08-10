# Frontend end-to-end tests

Behavioural regression tests for the browser UI, driven by Playwright against
the real Flask app and a throwaway SQLite database.

The desktop board (`board.js`) and the mobile board (`mobile.js`) are two
separate renderers with different gestures, so they get **two separate suites**
that share only fixtures.

## Running

```bash
cd tests/e2e
npm install
npx playwright install chromium     # first time only

npm test                # both suites
npm run test:desktop    # 1440x900
npm run test:mobile     # Pixel 5 (393x851, touch)
npm run test:headed     # watch it happen
npm run report          # HTML report after a failing run
```

Playwright starts `tests/e2e/server.py` itself — nothing needs to be running
first. That server is the normal app pointed at `tests/e2e/.tmp/e2e.db` via
`TODIES_DB_PATH`; the file is deleted and recreated on every run and never
touches `planner_db.db`.

## How a test is set up

`fixtures/test.js` gives every test a `planner` fixture that:

- seeds **its own user** directly into SQLite (`fixtures/db.js`) and opens the
  board at `/?token=…`. A private user per test is what makes the suite safe to
  run fully parallel;
- pins the clock to **Wed 11 Mar 2026** and the timezone to UTC, so the week
  grid, "today" highlighting and locale formatting are identical everywhere;
- blocks Google Fonts and kills CSS transitions.

`fixtures/seed-data.js` is the one board every test starts from: Mon–Sat of ISO
week 2026-W11 plus one unscheduled container. **Sunday is deliberately missing**
so the empty-slot ("ghost") paths are covered by the default fixture. Two custom
labels, Work and Home, exist alongside the built-in Random.

Helpers: `planner.reload()` (re-open and wait for the board), `planner.rows()`
(what actually reached the database), `planner.task(name)` / `planner.formOf(name)`
/ `planner.settings()` (in-page model, for state with no clean DOM form).

## Conventions

- **Assert after a reload.** Every mutation is optimistic — the DOM updates
  before the write lands — so an in-page assertion alone proves nothing about
  persistence. `planner.reload()` waits for the network to settle first;
  reloading over an in-flight request aborts it and the test flakes.
- **Address columns by date, not by label.** `03/11` is unique and survives
  i18n; `Wed` becomes `Ср` in Russian.
- **Locators live in `fixtures/desktop.js` / `fixtures/mobile.js`.** Specs read
  as behaviour; when a class name changes there is one place to fix.

## What this suite does not cover

- **Visual regression.** No screenshot baselines. Layout, spacing and colour
  breakage will not be caught — adding `toHaveScreenshot()` on top of these
  fixtures is the natural next step if that becomes a problem.
- **Account endpoints** (create / rotate / delete token). Creation is rate
  limited to 3/min, which does not survive a parallel suite.
- **`customLoad` (progressive load) rendering.** The setting is frozen at page
  load and only shows up on boards with weeks older than 14 days, so it needs
  its own fixture rather than the shared one.
- **Browsers other than Chromium**, and real touch/iOS behaviour.
