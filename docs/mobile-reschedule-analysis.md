# Mobile Rescheduling — Problems and Proposed Design

Analysis only; no code changed. All references are to `frontend/mobile/mobile.js`
unless stated otherwise.

## How it works today

Moving a task to another day on mobile has exactly one path:

```
long-press a task (350ms)  →  action sheet  →  "MOVE TO" grid  →  tap a button
```

The grid is built in `_buildActionSheet` (mobile.js:579-602) from two sources:

- `weekUnscheduled.slice(0, 2)` — labelled "Later 1" / "Later 2"
- `cols.slice(fromIdx - 3, fromIdx + 4)` — up to 7 **existing** day columns,
  labelled `col.label.slice(0, 3)`

Both are index slices over arrays, not date arithmetic.

## Problems

### 1. Most days are unreachable — you can only move to a column that already exists

`cols` holds only day forms that have been created. The app auto-creates today's
column (`ensureTodayCol`); every other day exists only if the user made it. So
the single most common reschedule — "push this to tomorrow" — is impossible
whenever tomorrow's column doesn't exist yet. The user must first go back to the
strip, find tomorrow's empty chip, tap it to create the column
(`addDayAtSlot`), then long-press the task again.

This is an asymmetry with **adding**: the add sheet already solved exactly this
problem with a native date picker plus `_resolveAddDayId` (mobile.js:851-863),
which creates the missing column on submit. Rescheduling never got that
treatment — you can *create* a task on any date in the future, but you cannot
*move* one there.

### 2. "Later 1 / Later 2" point at the oldest weeks on the board

`weekUnscheduled` is in server sort order, i.e. creation order, and a week row
pairs with `weekUnscheduled[week.order]` where `order` is the absolute week index
(`columns.js:96-109`). Index 0 is therefore the **first week the account ever
had**. On a board with 20 weeks of history, "Later" files the task into an
unscheduled bucket from months ago — scrolled far off-screen, and under
`customLoad` not rendered at all. The label promises the future and delivers the
past.

### 3. ±3 in `cols` index space is not ±3 days

On a sparse board (columns exist only for days that were used) `cols[fromIdx±3]`
can span three calendar weeks. Two buttons can both read `Wed` with nothing to
tell them apart — no date number, no month, no week. A mistap silently lands the
task on a Wednesday three weeks away, and mobile has no undo (Ctrl+Z is
keyboard-only, `boot.js:18-24`), so it cannot be taken back except by another
move — to a day the user now has to find.

### 4. Scheduling from the unscheduled drawer offers the seven *oldest* days

The drawer's "schedule ›" button (mobile.js:1067-1072) opens the same action
sheet with `fromColId` = the unscheduled form's id. That id is not in `cols`, so
`fromIdx === -1` and the fallback fires: `cols.slice(0, 7)` — and `cols` is
sorted ascending by date (`sortColsByDate`). The primary scheduling flow in the
app therefore proposes the seven earliest days of the entire board. This is the
sharpest bug of the set, and it is invisible in the e2e suite because the fixture
board is a single week (`tests/e2e/fixtures/seed-data.js`), where "first seven"
and "nearby" happen to coincide.

### 5. Moving into an unloaded week makes the task disappear

Under `customLoad`, `_renderMobileBoard` renders a column only if
`loadedFormIds.has(col.id)` (mobile.js:243-247), but the move grid is built from
`cols`, which includes unloaded columns. Moving there succeeds server-side and
the card vanishes from the board with no message and no way back short of
"earlier weeks".

### 6. No confirmation, no landing

After `_moveTaskToCol` the sheet closes and `render()` runs. The target day is
usually collapsed (a dot row) or in another week off-screen. Nothing expands it,
nothing scrolls to it, nothing says where the task went. Compare the add flow,
which calls `_expandDay(id)` so the new task is visible.

### 7. The gesture is invisible and fights scrolling

Nothing on a task card indicates it is long-pressable; `mobUnschedHint` is the
only mention, and only inside the drawer. The 350ms timer only cancels on >8px
of movement, so a slow scroll start opens the sheet mid-gesture, and the same
press is also the first half of the double-tap that toggles done
(mobile.js:455-479).

### 8. The bulk case has no flow at all

"I didn't finish these four, push them to tomorrow" is the reason weekly planners
exist. Today it costs, per task, a 350ms press plus a scan of up to nine
three-letter buttons — and the drawer closes after each move, so scheduling five
unscheduled tasks means reopening the drawer five times.

### 9. Grid labels bypass i18n

`_dayGridBtn` uses raw `col.label`, not `translateLabel(col.label)` as the hero
does (mobile.js:386). In Russian the sheet shows English `Mon`/`Tue`.

## Proposed design

The fix is mostly *deletion*: the move grid is a second, worse target picker
sitting next to a good one that already exists in the add sheet. Make moving use
the same target model as adding.

### Tier 1 — replace the grid with a date-based target picker

In the action sheet, swap `mob-day-grid` for a row of **relative chips plus the
existing date chip**:

```
MOVE TO   [ Tomorrow ]  [ Mon ]  [ Later ]     [ Thu, Mar 12 ▾ ]
                                                 (native picker)
```

- Chips are computed from `Date` arithmetic, never from array indices:
  *Tomorrow*, *next Monday* (or *Today* when the task is in the past/unscheduled),
  and *Later*.
- The date chip is `_buildTargetRow()` verbatim — same component, same native
  picker, so **any** date is reachable.
- Every chip resolves through the add flow's resolver, extracted and renamed:
  `_resolveAddDayId(dayId, date)` → `_resolveDayIdForDate(date)`, which finds the
  column or creates it. Adding and moving then share one code path.
- *Later* means "the unscheduled bucket of the **target task's own week**" —
  `weekUnscheduled[order]` for that week's bucket order — not `[0]` and `[1]`.

This alone fixes problems 1, 2, 3, 4 and 9, and removes code rather than adding
it.

### Tier 2 — make the landing visible

After a successful move: `expandedDays.add(targetId)`, scroll the target hero
into view with the board-relative scroll `_scrollToToday` already uses, and brief
flash on the card. If the resolved target is not in `loadedFormIds`, fetch that
form via `?form_ids=` and `mergeTasksData` before moving, so problem 5 cannot
happen.

Given that a mistap is otherwise unrecoverable on mobile, a small
`Moved to Thu 12 · Undo` toast wired to `UndoHistory.pop()` is worth the ~30
lines; it is the only undo affordance the mobile view would have.

### Tier 3 — the repeat cases

- Scheduling from the unscheduled drawer should open the **move picker only**
  (not the full action sheet with done/cancel/delete), and should keep the drawer
  open afterwards so several tasks can be filed in a row.
- A day hero header gains `push N unfinished →` when the day is in the past and
  has unfinished tasks: one tap, one undo snapshot, all of them to the next day.
  This is the workflow the current design makes most expensive.

Tier 1 is the one that matters; tiers 2 and 3 are independent and can wait.

## Test note

The e2e fixture is a single week, which is why every one of the ordering bugs
passes today. Any implementation should first extend the fixture to a
**multi-week** board (e.g. one week of history plus the current week) — the
existing `mob-day-grid-btn` assertions in `tests/e2e/mobile/actions.spec.js` and
`unscheduled.spec.js` would then need rewriting against the new chips.
