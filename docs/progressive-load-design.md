# Progressive Task Loading — Implementation Design

Target audience: the engineer implementing this feature (junior/mid level).
Read the whole doc before writing code. Backend groundwork already exists —
most of this work is frontend wiring plus a handful of backend bug fixes.

> **Status: implemented.** The design below is the plan of record. Section 7
> ("As-built reconciliation") records the concrete decisions taken where the
> plan left a choice open, the one fix added beyond the original Phase 0 scope,
> and an accepted tradeoff. Read section 7 alongside each phase.

## 1. Background & goal

Today the frontend loads **all** forms and **all** tasks on startup
(`frontend/app.js:20-22`). The backend already supports partial fetching:

| Endpoint | Param | Behavior | Code |
|---|---|---|---|
| `GET /api/v2/forms` | `?latest=N` | recent scheduled forms + all unscheduled | `backend/data_access/forms.py:get_recent_forms` |
| `GET /api/v2/tasks` | `?form_ids=1,2,3` | tasks for those forms | `backend/data_access/tasks.py:get_tasks_for_forms` |
| `GET /api/v2/tasks` | `?from=&to=` (ISO dates) | tasks on dated forms in range | `backend/data_access/tasks.py:get_tasks_in_range` |

A `customLoad` boolean already exists end-to-end (button in `index.html`,
handler in `app.js`, persisted via metadata, default `false` in
`backend/data_access/metadata.py`) but currently controls nothing.

**Goal:** when `customLoad` is ON, the board initially fetches and renders only
recent weeks; the user reveals older weeks on demand ("earlier weeks" control),
which fetches those tasks and renders those weeks. When OFF, behavior is
byte-for-byte identical to today.

Key decisions already made (do not re-litigate):

- **All forms are fetched upfront** (they are tiny). Only *tasks* load
  progressively, and only loaded forms are *rendered*.
- Older tasks are fetched by **`?form_ids=`**, not by date range — the client
  knows the exact form IDs, so no server-side date parsing is involved.
- A form is **never displayed until its tasks are fetched** (loaded ⇔ visible).
- The definition of "recent" is the **existing** `get_recent_forms()` window
  rule. Do not invent a new one.
- Existing range APIs (`?latest=`, `?from/to=`) stay. Do not delete them.
- Date format migration (adding years to `MM/DD` dates) is **out of scope**.

## 2. Phase 0 — bug fixes (do these first, each with a regression test)

These are confirmed bugs in the already-committed range API code. Fix before
building on top.

### 0.1 `GET /api/v2/tasks?form_ids=--5` → 500

`backend/controllers/tasks.py:16` validates with
`p.strip().lstrip('-').isdigit()`. `lstrip('-')` strips *all* leading dashes,
so `--5` passes validation and `int('--5')` raises `ValueError` in
`get_tasks_for_forms`. Fix the validation to accept only an optional single
leading `-` (e.g. `re.fullmatch(r'-?\d+', p.strip())`) and return 400.

### 0.2 `GET /api/v2/forms?latest=--5` → 500

Same bug, `backend/controllers/forms.py:13`:
`latest_arg.lstrip('-').isdigit()` passes for `--5`, then `int(latest_arg)`
raises inside the `if` expression. Same fix.

### 0.3 `GET /api/v2/tasks?form_ids=99999999999999999999` → 500

A valid-looking integer larger than 64 bits passes `int()` but sqlite3 raises
`OverflowError` on bind. Reject IDs outside a sane bound (e.g. `> 2**63 - 1`,
or simply length > 18 digits) with 400.

### 0.4 Two-digit years: backend and frontend disagree

Backend `parse_form_date` (`backend/date_utils.py:31`) maps year `< 100` to
`year + 2000`, so `7/4/26` → **2026**. The frontend (`columns.js`:
`parseDateToSortKey`, `inferDay`, `colWeekInfo`) passes the raw 2-digit year to
`new Date(26, …)`, which JavaScript maps to **1926**. A `MM/DD/YY` form is
therefore placed in different weeks by backend windowing vs frontend rendering.
Fix the frontend: in the three parsing helpers in `columns.js`, normalize
`yr < 100 → yr + 2000` to match the backend. (Frontend is the right side to
change: the backend rule is the sane one, and `parseDateToSortKey`'s sort key
should agree with it.)

### 0.5 Minor (fix opportunistically, don't grow scope)

- Backend `_DATE_RE` tolerates surrounding whitespace and `rstrip('+')` strips
  multiple `+`; frontend regexes are stricter. Dates injected via raw API like
  `" 7/4"` are dated on the backend but undated on the frontend. Align backend
  to the stricter frontend rule (single optional trailing `+`, no padding).
- `?form_ids=` combined with `?from/to=` silently ignores `from/to`. Return
  400 when both are supplied.
- Stale comment `tests/test_tasks.py:36` says `?start=&end=`; params are
  `from`/`to`.

## 3. Phase 1 — backend: annotate recent forms

The client needs to know which forms fall in the "recent" window without
duplicating the window rule in JS.

Add an optional query param to `GET /api/v2/forms`:

```
GET /api/v2/forms?mark_recent=1
```

Response is identical to today except each entry in `cols` gains
`"recent": true|false`. Implementation: in the controller, when the flag is
set, call `get_recent_forms(user_id, RECENT_DAYS)` (use the same default the
frontend would otherwise pass to `?latest=` — pick `14` and define it as a
constant), build a set of recent IDs, and annotate the full list. Unscheduled
forms need no flag (they are always loaded).

Notes:

- Do **not** change the default (no-param) response shape.
- `?latest=` keeps working as-is.
- Reuse `get_recent_forms` for the ID set — no new window logic.

Tests: response shape with/without the flag; a form last week → `recent:true`;
a form three weeks ago → `recent:false`; undated form → `recent:false`;
interaction with `?latest=` (mark_recent ignored or 400 — pick one, test it).

## 4. Phase 2 — frontend: partial state model

All changes gated on `customLoad === true`; when false, code paths must be
exactly today's.

### 4.1 New state (`frontend/state.js`)

```js
let loadedFormIds = new Set();   // forms whose tasks have been fetched
let loadingEarlier = false;      // one in-flight guard for batch fetches
```

`loadedFormIds` is the single source of truth: **a scheduled form is rendered
iff its ID is in the set** (when customLoad is ON). There is no separate
"visible window". An empty-but-loaded form renders as an empty day; an
unloaded form does not render at all.

### 4.2 Merge mode for task data (`frontend/state.js`)

`applyTasksData` currently resets `state = {}`. Add a merge variant (new
function or a flag — keep it small):

```js
function mergeTasksData(tasksData, formIds) {
  for (const id of formIds) state[id] = [];      // fetched-but-empty forms
  for (const t of (tasksData.tasks || [])) { /* same row mapping as applyTasksData */ }
  for (const id of formIds) loadedFormIds.add(id);
}
```

Assignment per form ID makes re-fetching the same batch idempotent (replace,
never append). The full-load path (`customLoad` OFF) keeps using
`applyTasksData` unchanged.

### 4.3 Initial load (`frontend/app.js`)

`customLoad` lives in metadata, so the forms/tasks requests can only be
specialized after metadata resolves. Restructure the startup so the forms and
tasks fetches are issued from a function that runs after `_metadataP`:

- **OFF:** exactly today's three fetches and `applyTasksData`.
- **ON:**
  1. `GET /api/v2/forms?mark_recent=1` → `applyFormsData` with all cols
     (keep every col in `cols` — rendering filters, state doesn't).
  2. Collect IDs: recent cols + all `weekUnscheduled` → `GET
     /api/v2/tasks?form_ids=...` → `mergeTasksData`.
  3. `ensureTodayCol()` / `ensureUnscheduledForWeeks()` run as today. Any form
     these create is empty by construction — add its ID to `loadedFormIds`.
     Same for `addCol`/`addUnscheduledCol` (`frontend/columns.js`): a
     user-created form starts with zero tasks, so mark it loaded immediately.

Perf logging: keep the `[perf]` console lines; add one for the first partial
tasks batch.

### 4.4 Rendering filter (`frontend/board.js`, `frontend/mobile.js`)

Where the board iterates `cols` to build week rows, skip cols not in
`loadedFormIds` (only when customLoad is ON). Two traps:

- **Unscheduled alignment.** `board.js` pairs `weekUnscheduled[wi]` with week
  rows by *rendered* index. When older weeks are hidden, `wi` shifts. Compute
  the week index over **all** cols (loaded or not, using `colWeekInfo`) and use
  that absolute index for the pairing, so hiding weeks never re-pairs
  containers. `uniqueWeekKeys()` / `ensureUnscheduledForWeeks()` keep counting
  over all cols — do not filter there.
- **Ghost/today slots.** The "add day" ghost logic operates on the last
  rendered week; last week is always loaded (it's recent), so no change should
  be needed — verify, don't assume.

### 4.5 "Earlier weeks" control

Desktop: when at least one scheduled form is not in `loadedFormIds`, render a
single full-width row above the first week row — a button labeled via
`t('earlierWeeks')` (add the key to both `en` and `ru` in `i18n.js`, per the
translation rule in CLAUDE.md). Mobile (`mobile.js`): an equivalent chip at
the start of the day strip calling the same function.

Click handler (shared, put it in `state.js` or `columns.js`):

1. If `loadingEarlier`, return. Set `loadingEarlier = true`, disable button
   (spinner or `…` label via `t()`).
2. Group unloaded scheduled forms by `colWeekInfo(col).key`; sort week keys
   descending; take the **2** newest unloaded weeks; collect their form IDs.
   Forms with no parseable date go into the final batch (load them last, with
   the oldest week).
3. `GET /api/v2/tasks?form_ids=<ids>`.
4. On success: `mergeTasksData(data, ids)`, `UndoHistory` **cleared** (see
   4.6), `loadingEarlier = false`, `render()`. The button disappears
   automatically once nothing is unloaded.
5. On failure: `loadingEarlier = false`, re-enable the button (loaded data
   untouched; retry = click again). No toast/alert machinery — the codebase
   has none; silent re-enable matches existing error style (`apiFetch`
   already `console.error`s).

Scroll anchoring: after prepending week rows, keep the viewport where it was —
record `scrollTop`/`scrollHeight` of the board container before `render()` and
restore `scrollTop + (newScrollHeight - oldScrollHeight)` after. Without this
the board visually jumps.

### 4.6 Undo

`frontend/undo.js` snapshots the entire state. A snapshot taken before a batch
merge, restored after it, would silently drop the merged tasks. Simplest safe
rule: **clear undo history when a batch merges** (add `UndoHistory.clear()`).
Batch loads are rare; losing undo history at that moment is acceptable.

### 4.7 Explicit non-changes

- Task/form mutations (`tasks.js`, drag-and-drop, `columns.js` CRUD) need no
  changes: every operation targets one task/form and is independent of
  unloaded data.
- Toggling `customLoad` mid-session must **never change the current view** —
  the switch takes effect only on the next page refresh. This requires freezing
  the flag at load: `customLoadActive` (captured once from metadata) governs all
  *rendering*, while the live `customLoad` global governs only the button label,
  persistence, and the earlier-weeks *fetch scope*. `pessimisticMeta` calls
  `render()` synchronously on toggle, so rendering MUST read `customLoadActive`,
  not `customLoad`, or the board would re-filter immediately. Concretely:
    1. Full view + toggle ON → stays full (do not cut to recent-only).
    2. Partial view + toggle OFF → stays partial (do not expand; wait for
       refresh).
    3. Partial view + toggle OFF + click "earlier weeks" → load **all** remaining
       weeks in one batch (not just 2), i.e. catch up to full immediately.
- Showcase / no-token mode: untouched (`_metadataP` failure path already
  routes to `loadShowcase()` before any of this logic runs).

## 5. Testing

Backend (`pytest tests/`):

- Phase 0 regressions: `form_ids=--5` → 400, `latest=--5` → 400, 20-digit
  form id → 400, `form_ids` + `from/to` together → 400.
- `mark_recent` tests per Phase 1.
- Existing 71 tests stay green.

Frontend has no test harness — verify by hand, both desktop and mobile widths
(≤720px), with a seeded account containing ≥4 weeks of history:

1. `customLoad` OFF → network tab shows the same three full fetches as today;
   board identical.
2. ON → initial tasks request carries `form_ids`; only recent weeks render;
   "earlier weeks" button present.
3. Click → exactly the next 2 weeks appear, scroll position stable, button
   gone when history exhausted.
4. Add/edit/move/delete/undo tasks on a partial board; reload; nothing lost.
5. Create a new day column while partial → it renders (loaded-empty).
6. Kill the server, click "earlier weeks" → button re-enables, loaded weeks
   intact; restart server, retry succeeds.
7. Both languages show translated button text.

## 6. Acceptance criteria

- OFF path is behaviorally identical to master (requests, rendering, undo).
- ON path never renders a form whose tasks were not fetched, and never
  re-fetches an already-loaded form.
- At most one batch request in flight; failures leave state consistent and
  retryable.
- All Phase 0 bugs fixed with regression tests; full suite green.

## 7. As-built reconciliation

What actually shipped, with every open choice from the plan resolved. The plan
above is unchanged; this section is the source of truth for the concrete
implementation.

### 7.1 Backend

- **Phase 0.1 / 0.2** — both controllers now validate with a shared
  `_INT_RE = re.compile(r'-?\d+')` + `fullmatch`, which rejects `--5`, `''`,
  whitespace, `+`, `-`, and `+5`, and accepts `-5` / `5`. Returns 400 on
  failure. (`backend/controllers/tasks.py`, `backend/controllers/forms.py`.)
- **Phase 0.3** — `form_ids` are bounded by `_MAX_ID = 2**63 - 1`
  (`abs(int(p)) > _MAX_ID` → 400) in `tasks.py`.
- **Phase 0.5a** — `_DATE_RE` tightened to
  `^(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\+?$` and the `rstrip('+')` dropped, so
  `" 7/4"` and `"07/04++"` are now **undated** on the backend, matching the
  frontend rule. (`backend/date_utils.py`.)
- **Phase 0.5b** — `?form_ids=` combined with `?from/to=` returns 400
  (mutually exclusive). **Phase 0.5c** — stale `?start=&end=` comment in
  `tests/test_tasks.py` fixed to `?from=&to=`.
- **Phase 1** — `?mark_recent=1` on `GET /api/v2/forms`. `RECENT_DAYS = 14`
  constant; recent-ID set built from `get_recent_forms(user_id, RECENT_DAYS)`;
  each scheduled `cols` entry gains `recent: true|false`. Default (no-param)
  response shape is unchanged (no `recent` key). The flag is read as a
  **presence check** (`'mark_recent' in request.args`), so `?mark_recent`
  alone enables it and its value is irrelevant.
- **Decision — `mark_recent` + `latest` interaction:** `mark_recent` is
  **ignored when `latest` is present** (`'mark_recent' in request.args and
  latest_arg is None`). Covered by `test_mark_recent_ignored_with_latest`.

### 7.2 Extra fix beyond the plan (from code review)

- **`?latest=<huge>` overflow → 500 (forms endpoint).** The plan's Phase 0.3
  only bounded `form_ids` on the tasks endpoint. The parallel `latest` param
  on `GET /api/v2/forms` had the same unguarded overflow: a 20-digit value
  passed validation, then `get_recent_forms` did `timedelta(days=...)` →
  `OverflowError` → 500. Fixed with a `_MAX_LATEST = 999999999`
  (`datetime.timedelta.max.days`) bound: `latest` must satisfy
  `0 <= int(latest) <= _MAX_LATEST` or 400. Regression:
  `test_latest_overflow_returns_400`.

### 7.3 Frontend

- **Phase 0.4** — `yr < 100 → yr + 2000` applied in `parseDateToSortKey`,
  `inferDay`, and `colWeekInfo` (`frontend/columns.js`), matching
  `parse_form_date`.
- **4.1 / 4.2** — `loadedFormIds` (Set) and `loadingEarlier` (bool) plus
  `mergeTasksData(tasksData, formIds)` in `frontend/state.js`; row mapping is
  identical to `applyTasksData`, per-form-id assignment makes re-fetch
  idempotent, and IDs are marked loaded on merge.
- **4.3** — startup restructured into `loadBoard()` (runs after `_metadataP`),
  splitting into `loadBoardFull()` (OFF; today's three fetches +
  `applyTasksData`) and `loadBoardPartial()` (ON; `forms?mark_recent=1` →
  `applyFormsData` all cols → recent + unscheduled IDs → `tasks?form_ids=` →
  `mergeTasksData`). Newly-created empty forms are marked loaded in `addCol`,
  `addUnscheduledCol`, `ensureTodayCol`, `ensureUnscheduledForWeeks`. `[perf]`
  logs kept; a "partial tasks applied" line added.
- **4.4** — desktop (`board.js`) and mobile (`mobile.js`) filter unloaded cols
  only when custom-load is active, and pair unscheduled containers by the
  **absolute** `week.order` (computed over all cols), not the filtered index.
  The "add day" ghost stays on the last *rendered* week (always recent/loaded).
- **4.7 mid-session toggle (see §4.7)** — added `customLoadActive` in
  `state.js`, frozen from `customLoad` at load (`app.js`). All rendering
  (`board.js`/`mobile.js` filters, `hasUnloadedWeeks`) reads `customLoadActive`,
  so toggling `customLoad` never changes the view until refresh — even though
  `pessimisticMeta` re-renders on toggle. `loadEarlierWeeks` reads the *live*
  `customLoad` for scope: `take = customLoad ? 2 : keys.length`, so a click
  after toggling OFF loads all remaining weeks at once. (Original §4.7 said
  "persists the flag only"; the implementation had leaked the live flag into
  rendering — fixed here.)
- **4.5** — shared `loadEarlierWeeks()` handler in `columns.js` plus
  `hasUnloadedWeeks()` / `_boardScrollEl()` helpers. Desktop renders a
  full-width `.earlier-weeks-row`; mobile renders a `.mob-earlier-chip`. Week
  keys are zero-padded ISO strings, so descending lexical sort = chronological;
  the 2 newest unloaded weeks load per click, undated forms load last. Scroll
  anchored via `scrollTop + (newHeight − oldHeight)`.
- **4.6** — `UndoHistory.clear()` added (`frontend/undo.js`), called on every
  batch merge.
- **Translation** — `earlierWeeks` added to both `en` ("↑ earlier weeks") and
  `ru` ("↑ ранние недели"), consumed via `t()`. Not added to
  `applyLangToStaticUI()` because the control is rebuilt via `t()` on every
  `render()` rather than being static HTML.
- **CSS** — minimal rules for `.earlier-weeks-row` / `.earlier-weeks-btn`
  (`style.css`) and `.mob-earlier-chip` (`mobile.css`), matching existing
  button/chip styling.

### 7.4 Regression found & fixed during runtime verification

Driving the app in a real browser (customLoad OFF and ON) surfaced a blank-board
crash that the syntax/`node --check` smoke checks missed:

- **Symptom:** on every initial load the board stayed empty; forms/tasks never
  fetched.
- **Cause:** the §4.3 restructure moved `loadBoard()` to run *after* the first
  `render()` inside the metadata handler (`app.js`). That first `render()` runs
  with empty state, hitting the pre-existing `weeks.length === 0` fallback in
  `board.js`, which dereferenced `weekUnscheduled[0].id` unguarded. On master
  this same code was a *latent, self-recovering* race (the forms/tasks fetches
  fired at module load independently, so a later re-render fixed it); once
  `loadBoard()` sat downstream of the throwing `render()`, the throw aborted the
  handler before any fetch ran.
- **Fix:** guard the empty-board branch in `board.js` against an empty
  `weekUnscheduled` (build the unscheduled bar only when a container exists).
  Surgical; also removes master's silent error.

### 7.5 Accepted tradeoff

- **OFF-path fetch timing.** Per §4.3's mandated restructure, the forms/tasks
  fetches now run *after* `_metadataP` resolves, whereas master fired all three
  in parallel at module load. This adds one round-trip of startup latency on
  the OFF path. The request *set* and rendering/undo behavior are identical
  (acceptance criteria met); only scheduling changed. This is a deliberate,
  design-sanctioned deviation, not a regression in behavior. If startup latency
  becomes a concern, the OFF-path forms/tasks fetches can be fired eagerly
  (they do not depend on `customLoad`) with only the partial path gated behind
  metadata.

### 7.6 Test status

`pytest tests/` → **82 passed** (71 baseline + 11 new): Phase 0 regressions
(`form_ids=--5`, `latest=--5`, 20-digit id, `form_ids`+`from/to`, the stricter
date rule), Phase 1 `mark_recent` (shape with/without flag, recent true,
older/undated false, ignored-with-`latest`), and the `latest` overflow guard.
Frontend has no test harness; JS files pass `node --check`. **Runtime
verification done** (Playwright + Chromium, isolated throwaway DB, seeded
account: 6 weekly forms = 3 recent + 3 older, plus an unscheduled container):

- OFF (desktop): exactly the three full fetches (`metadata`, `forms` with no
  `mark_recent`, `tasks` with no `form_ids`); all 6 weeks render; no control.
- ON (desktop): `forms?mark_recent=1` + a single `tasks?form_ids=…` (recent
  day-cols + all unscheduled containers); only the 3 recent weeks render; the
  "earlier weeks" control is present.
- Click #1 fetched exactly the 2 newest unloaded weeks' form IDs → 5 weeks
  shown, control still present; scroll anchoring was exact (scrollTop restored
  to `s0 + (newHeight − oldHeight)`, 704 = 704). Click #2 fetched the last
  week → 6 weeks shown, control gone.
- ON (mobile, 390px): `mark_recent` + partial `form_ids` fetch; day-strip
  "earlier weeks" chip present and functional (day chips 21 → 35 on click).
  Note: the chip sits at the far-left of the day strip, which auto-scrolls to
  today on load, so it is off-screen initially — a user scrolls the strip left
  to reach it.

- Mid-session toggle (desktop, real `#customLoadBtn` clicks): OFF session +
  toggle ON → stays 6 weeks, no control (`customLoad=true`,
  `customLoadActive=false`); ON session + toggle OFF → stays 3 weeks + control
  (`customLoad=false`, `customLoadActive=true`); then one click under toggle-OFF
  fetched `form_ids=4,5,6` (all remaining) → 6 weeks, control gone.

This verification surfaced and fixed the §7.4 blank-board regression and the
mid-session-toggle leak (§4.7).
