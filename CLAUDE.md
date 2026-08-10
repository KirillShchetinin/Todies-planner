# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Engineering Principals

### Rule 1. Think Before Coding.
No silent assumptions.
State what you're assuming.
Surface tradeoffs.
Ask before guessing.
Push back when a simpler approach exists.

### Rule 2. Simplicity First.
Minimum code that solves the problem.
No speculative features.
No abstractions for single-use code.
If a senior engineer would call it overcomplicated — simplify.

### Rule 3. Surgical Changes.
Touch only what you must.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken.
Match existing style.

### Rule 4. Goal-Driven Execution.
Define success criteria.
Loop until verified.
Don't tell Claude what steps to follow, tell it what success looks like and let it iterate.

## What Todies is

A single-page weekly task planner. The board is a vertical stack of **week rows**;
each week row is one "unscheduled" container on the left plus a 7-slot Mon–Sun grid
of **day columns**. Tasks live inside a column, carry a colour-coded **type**
(label), and can be done / cancelled / important. There is no login screen: a user
*is* a token in a URL (`/?token=…`), and the board is whatever that token owns.

Two completely separate renderers draw that model — `desktop/board.js` and
`mobile/mobile.js` (below the 720px breakpoint). They share state, task/column
helpers and i18n, but not DOM or gestures. **A frontend behaviour change usually
has to be made in both.**

## Commands

```bash
pip install -r requirements.txt   # flask, flask-limiter
python server.py                  # dev: port 5000, opens a browser, starts the backup thread
```

```bash
pytest tests/                          # backend
pytest tests/test_tasks.py::test_name  # one test
```

```bash
cd tests/e2e && npm install && npx playwright install chromium   # first time
npm test              # both suites
npm run test:desktop  # 1440x900 only
npm run test:mobile   # Pixel 5 only
npm run test:headed   # watch it
```

No build step, no bundler, no linter. Frontend files are served straight from
`frontend/` as Flask static files, so a code change needs only a page refresh.

## Frontend layers

`frontend/` is split into three directories, and that split is the main thing to
respect when changing anything:

| Layer | What lives there |
|---|---|
| `common/` | View-agnostic: the model and its mutations, the HTTP client, date rules, i18n, undo, the shared widgets (modals, add-label panel), the view dispatcher, boot |
| `desktop/` | Desktop-only DOM and gestures: the week-row board, drag-and-drop, right-click menus, the left action bar, `desktop.css` |
| `mobile/` | Mobile-only DOM and gestures: day strip, heroes, sheets, drawer, `mobile.css` |

Two rules: **`common/` must never reference a symbol from `desktop/` or
`mobile/`, and those two must never reference each other.** There is no bundler
— `index.html` loads plain deferred scripts sharing one global scope, so the
script order in `index.html` *is* the dependency graph, and every file's
top-level names are effectively that file's exports.

`common/view.js` is the seam. Each renderer calls `registerView(name, {render,
teardown, scrollEl})` once at load; `render()` — the single exit point of every
mutation — dispatches to whichever view the viewport selects, and tears the old
one down when the breakpoint is crossed. Common code that needs a view-specific
answer (which element scrolls, which scale applies) goes through `view.js`
rather than naming a renderer.

Both renderers are always loaded, since the viewport can cross the breakpoint at
any moment.

CSS follows the same split and must be linked in this order: `common/base.css`
(tokens, page, task cards, modals) → `desktop/desktop.css` → `mobile/mobile.css`
(scoped to `body[data-view="mobile"]`).

## How it runs in production

Azure VM (`openclaw-vm`, user `azureuser`), gunicorn `--bind 0.0.0.0:5000
--workers 1 server:app`, out of `/home/azureuser/Todoies/Todies-planner` with a
venv alongside. Deploy = `git pull` + `kill -HUP <gunicorn master pid>`, which
re-imports `server:app` in a fresh worker with no downtime. `docs/operations-runbook.md`
has the full procedure and the gotchas (notably: `pkill -f server.py` matches
nothing — the process is named `gunicorn`).

Two consequences of the gunicorn path that bite:

- **`server.py`'s `if __name__ == '__main__'` block never runs.** The browser
  auto-open *and* the periodic `run_backup_loop` thread are dev-only. Under
  gunicorn the only backup is the module-level `backup()` call at import — i.e.
  one per worker boot. Since `_prune_old_backups` drops anything older than 3
  days, a long-lived worker means backups silently stop and then age out.
- `init_db()` also runs at import, so schema creation and the additive column
  migrations (`db_mgmt.apply_migrations`) happen on every worker boot. Migrations
  never raise — a column that can't be added is printed and skipped.

## Request / auth flow

Every data request carries `?token=<token>`. `auth.resolve_user_id()` turns it
into a user id; `controller._require_user()` wraps that and returns 401 when it
fails, and every blueprint route starts with it. There is no session, cookie or
CSRF layer — the token in the query string is the whole auth model, and every
query in `data_access/` is scoped by `user_id`.

Routes:

| Route | Notes |
|---|---|
| `GET/POST /api/v2/forms`, `DELETE /api/v2/forms/<id>` | delete returns **409** if the form still has tasks |
| `GET/POST /api/v2/tasks`, `PUT/DELETE /api/v2/tasks/<id>` | |
| `GET/PUT /api/v2/tasks/<id>/content` | long-form task body, separate `task_content` table, fetched lazily |
| `GET/PUT /api/v2/metadata` | one JSON blob of all UI settings |
| `POST /api/account` | needs header `X-Create-Secret` == `CREATE_SECRET` env var; rate-limited 3/min |
| `POST /api/account/token` | rotate token |
| `DELETE /api/account` | |

`GET /api/v2/forms` and `GET /api/v2/tasks` accept the range params that
progressive load is built on: `?latest=N`, `?mark_recent=1` (annotates each col
with `recent`, window = 14 days), `?form_ids=1,2,3`, `?from=&to=` (ISO). Bad
input must return 400, never 500 — several past bugs were exactly that
(`--5` passing `lstrip('-')` validation, >64-bit ids overflowing the sqlite
bind); `tests/test_ranges.py` guards them.

## Data model

`planner_db.db` (override with `TODIES_DB_PATH`), SQLite in WAL mode, foreign
keys ON, one connection per request stored on Flask `g`.

- **`users`** — token + a JSON `metadata` blob: `lang`, `uiScale`,
  `uiScaleMobile`, `typeConfig`, `legendOrder`, `typeCounter`, `collapseState`,
  `customLoad`.
- **`forms`** — a day column *or* an unscheduled container (`is_unscheduled`),
  with `label`, `date`, `sort_order`.
- **`tasks`** — `name`, `done`, `sort_order`, `form_id`, plus a JSON `metadata`
  holding `type`, `locked`, `cancelled`, `important`.
- **`task_content`** — 1:1 with a task, the details body.

**Dates are display strings, not dates.** A form's `date` is `MM/DD` or
`MM/DD/YYYY` with an optional trailing `+`. Both sides must agree on how to read
one, so the rules are duplicated deliberately and must stay in sync:
`backend/date_utils.py` (`parse_form_date`, `is_valid_form_date`) mirrors
`frontend/common/dates.js` (`parseDateToSortKey`, `isValidColDate`, `colWeekInfo`),
the one place on the client that matches a date string.
A missing year resolves to `LEGACY_DATE_YEAR = 2026` — *not* the current year —
in both files, and a 2-digit year gets `+2000`. `normalizeColDate` pins an
explicit year at write time so stored dates can't drift.

Week grouping is ISO (Monday-first) and is computed on the client from the date
string; the backend never groups by week for rendering.

## Frontend flows

State is a flat set of globals in `common/state.js`: `cols`, `weekUnscheduled`,
`state` (form_id → task array), `typeConfig`, `legendOrder`, scales,
`loadedFormIds`. There is no store, no reactivity — **every mutation ends in a
full `render()`**, which rebuilds the whole board DOM from those globals.

### Load

`common/boot.js` runs three staged phases, each re-rendering as data lands:

1. `GET /api/v2/metadata` → apply lang, scale, collapse state, merge saved
   custom types over `DEFAULT_TYPE_CONFIG`, then `render()`.
   **If this fetch fails, `loadShowcase()` paints a fake demo board** — that's
   what an anonymous visitor to `/` (no token) sees.
2. `loadBoard()` — forms and tasks. Cannot start earlier because it branches on
   `customLoad`, which lives in metadata.
3. `ensureTodayCol()` and `ensureUnscheduledForWeeks()` create any missing
   today-column / per-week unscheduled container, then a final `render()`.

`customLoad` (progressive load) is **frozen at page load** into
`customLoadActive`; toggling the setting changes persistence and the button, but
never the current view. When active: all forms are fetched (they're tiny) but
only recent weeks' tasks, and **a column renders iff its id is in
`loadedFormIds`**. "Earlier weeks" (`loadEarlierWeeks`) pulls the next 2 unloaded
weeks by `?form_ids=`, merges, clears undo history (a pre-merge snapshot would
delete the merged tasks) and restores scroll position. `docs/progressive-load-design.md`
is the plan of record (it predates the layer split, so its file paths are stale).

### Writes

Three mutation wrappers in `common/state.js`, and choosing the right one matters:

- `optimistic(mutate, apiCall, revert)` — mutate + render now, revert on failure.
  The default for task edits. `revert` must undo *only* what `mutate` did, since
  other writes may be in flight.
- `pessimistic(apiCall, apply)` — server first, apply after. Used when the change
  depends on a server-assigned id, or when a revert would be messy.
- `pessimisticMeta(mutate, revert)` — for metadata-blob writes, where
  `saveMetadata()` serialises the live globals so the change *is* the payload.

`addTask` is a hand-rolled optimistic create: it inserts a card with a negative
temp id and `pending: true`, then swaps in the real id. **Every mutation guards
on `task.pending`** — you cannot delete, toggle or retype a task whose server id
isn't known yet.

`apiFetch` has one special case: with no token, non-GET calls to `/api/v2/*`
short-circuit to a synthetic `{ ok: true }` with a temp id, so the showcase board
is interactive without persisting. GETs are left alone so the initial load can
fail and trigger the showcase. `/api/account*` is excluded — account creation is
precisely the write that has no token yet.

`UndoHistory` (Ctrl+Z, max 10) snapshots the entire state before each mutation.

### Column / task behaviours worth knowing

- **Ghost slots.** An empty day in a rendered week draws a `.col-ghost`;
  double-click (desktop) or tap (mobile) creates that exact date's column via
  `addDayAtSlot`.
- **Unscheduled pairing.** Each week row pairs with `weekUnscheduled[week.order]`,
  where `order` is the *absolute* week index over all weeks — so hiding unloaded
  weeks never re-pairs the containers.
- **Deleting a column with tasks is refused** on both client (`deleteCol`) and
  server (409).
- **Collapse** (state in `common/collapse.js`, DOM in `desktop/collapse-view.js`;
  per-column short/full, persisted in metadata): a
  header click is a no-op unless the column has done tasks or more than 3 active
  ones. Short shows 3 active (or 2 done when nothing is active) and renders the
  rest as type-coloured dots, faded for done. `docs/collapse-flow.md` has the
  decision tree.
- **Mobile-specific:** day strip header, expandable day heroes, a quick-add bar,
  a long-press action sheet with a "move to day" grid (2 unscheduled + ±3 nearby
  days), a side menu and an unscheduled drawer. Drag-and-drop is desktop only;
  mobile moves tasks through the sheet.

## Translation rule

Every user-visible string in the frontend **must** go through `t('key')` — never
hardcode English text in `.js` files or in `index.html` button/label text. When
adding any frontend feature:

1. Add the key to **both** `en` and `ru` blocks in `common/i18n.js`.
2. Use `t('key')` at the call site.
3. If the string lives in a static HTML element, add a line to
   `applyLangToStaticUI()` in `common/i18n.js` that sets its `textContent`.

## Task types / labels

8 built-ins (locked, interview, taxes, practice, async, rest, unplanned, done)
plus user-defined `t-custom-*` types, each with `bg`/`border`/`text` colours and
optional `dashed`/`italic`. `common/boot.js` merges saved custom types over
`DEFAULT_TYPE_CONFIG` on load — so adding a new built-in in `common/constants.js` reaches
existing users, and a custom type whose label collides with a built-in is dropped.
Types drive card styling through `common/types.js:applyTaskStyle`; users reorder
and create them in the legend panel.

## Tests

Backend: `tests/conftest.py` monkeypatches `connections.DB_PATH` to a temp file
per test, and the `seed` fixture gives `.user()`, `.form()`, `.task()`. It also
keeps the legacy single-blob schema around for the migration tests.

E2E: Playwright boots `tests/e2e/server.py` itself (same app, `TODIES_DB_PATH`
pointed at a throwaway db). Every test seeds **its own user** so the suite runs
fully parallel, pins the clock to Wed 11 Mar 2026 in UTC, and starts from a
board where **Sunday is deliberately missing** so ghost-slot paths are covered by
default. Two conventions that keep it non-flaky: **assert after
`planner.reload()`** (writes are optimistic, so an in-page assertion proves
nothing about persistence), and **address columns by date, not label** (`03/11`
survives i18n; `Wed` becomes `Ср`). See `tests/e2e/README.md`, including what it
deliberately does not cover (visual regression, account endpoints, `customLoad`).

**Do not overwrite or delete existing test files without first warning the user
explicitly and receiving their confirmation.**
