# Progressive Task Loading — Implementation Design

Target audience: the engineer implementing this feature (junior/mid level).
Read the whole doc before writing code. Backend groundwork already exists —
most of this work is frontend wiring plus a handful of backend bug fixes.

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
- Toggling `customLoad` mid-session only persists the flag (existing
  `pessimisticMeta` handler); it takes effect on next page load. No dynamic
  switch.
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
