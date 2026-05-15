# Handoff: Todoies — Mobile Web View (Option C)

## Overview

The Todoies weekly planner currently renders a 7-column board (Mon→Sun) at the
desktop breakpoint. That layout is unusable on phones. This handoff specifies
**Option C — Week Strip + Today Hero**: a mobile layout that keeps the existing
data model and visual language and only changes how the board is rendered when
the viewport is narrow.

The implementation should be **additive** — the desktop board must stay
identical for viewports wider than the breakpoint.

## About the Design Files

The files in `prototype/` are **design references created in HTML+React**.
They are not production code to copy directly. The real codebase (`frontend/`)
is **vanilla JS with direct DOM rendering** (see `board.js`, `tasks.js`,
`columns.js`, `state.js`, `api.js`). Recreate this design in that codebase,
using its established patterns:

- DOM nodes created via `document.createElement` / `el.appendChild`
- State held in module-scope variables (`cols`, `state`, `weekUnscheduled`)
- Re-render triggered by calling `render()`
- Persistence through the `formApi*` helpers in `api.js`
- Undo by calling `UndoHistory.push()` before mutations

Do **not** introduce React or any other framework. Match the existing style.

## Fidelity

**Hi-fi.** Final colors, typography, spacing, and interactions are specified.
Reuse the existing CSS variables in `frontend/style.css` (`--bg`, `--surface`,
`--surface2`, `--border`, `--text`, etc.) so light/dark/scale tweaks already
in the codebase continue to apply.

## Breakpoint & Activation

- Mobile layout activates at `max-width: 720px` (covers phones in portrait;
  tablets in portrait still get desktop).
- Implement via a `body[data-view="mobile"]` attribute toggled by a
  `matchMedia('(max-width: 720px)')` listener — easier to test from the
  console than pure CSS.
- All current scripts continue to run; only the rendered DOM inside `#board`
  and `#main > header` changes when `data-view="mobile"`.

## Screens / Views

### 1. Top region (replaces desktop header + activity bar)

A single sticky element at the top of `#main`, replacing the desktop
`<header>` AND the fixed 64-wide `#actbar`.

**Layout** (top to bottom, with vertical gap 8px, padding 10px 12px 4px):

1. **Title row** — flex, space-between
   - Left: `weekly planner` in DM Mono 13px 500, color `--accent` (#2a2a2a)
   - Right: two icon buttons in a row (gap 6px)
     - ◆ labels → opens the existing labels panel inline
     - ≡ menu → opens the slide-over menu (see Side Menu below)
   - Icon button: 30×30, border-radius 8, background `rgba(255,255,255,0.35)`,
     1px `--border` outline, DM Mono 13px, color `--text-muted`

2. **Day strip** — flex row, 7 equal children, gap 4px
   - Each chip: column flex, items-center, padding 6px 0, border-radius 6
   - Default chip: background `rgba(255,255,255,0.20)`, no border
   - **Expanded** chip: background `--surface` (#f0eeea), 1px `--border-hover`
     border, box-shadow `0 2px 6px rgba(0,0,0,0.10)`
   - **Today** chip: 1px `rgba(220,100,20,0.55)` border (replaces the
     expanded-state border when both apply)
   - Chip content, top to bottom:
     - Day initial letter (M/T/W/T/F/S/S) in DM Mono 9px uppercase, `--text-muted`
       (or `--text` when expanded)
     - Date day-of-month in DM Mono 12px 500, `--text` (or `#c25400` if today)
     - Remaining-count number in DM Mono 9px, `--text-muted` (or
       `--text-dim` + render `✓` when remaining is 0)

### 2. Unscheduled chip

A single-row stripe directly under the top region, padding 4px 12px 0.

- Outer: the existing `.unscheduled-bar` gradient + dashed
  `rgba(80,150,200,0.30)` border, border-radius 10, padding 6px 10px,
  display flex items-center gap 8px, cursor pointer
- Content (left to right):
  - `unscheduled · N` in DM Mono 10px uppercase letter-spacing 0.07em
    color `#3a6a8a`
  - Dot row — one 5×5 circle per unscheduled task in that label's
    border color (clamped to 20 dots, `+N` overflow indicator after)
  - Spacer (flex 1)
  - `›` glyph in DM Mono 13px color `#3a6a8a`
- Tap → opens **Unscheduled drawer** (see below)
- Per-week: render one of these above each week row's day list (the
  desktop already separates `weekUnscheduled` by week)

### 3. Day list

A vertically-scrolling `<div>` filling the remaining viewport, padding
10px 12px 80px (the 80px bottom keeps the quick-add button from covering
content), flex column gap 6px.

For each day in `cols` order, render **either** a `DayHero` (expanded) or
`DayRow` (collapsed), based on whether the day's id is in the
`expandedDays` Set.

#### DayHero (expanded)

Reuses the **existing** `.col` paper-card styling (background, border,
box-shadow stack, padding). Add 14px 14px 16px padding, flex column gap 8.

- **Header row** — flex, space-between, baseline; whole row is a button
  whose click toggles the day's expansion
  - Left: day label (e.g. `Thu`) in DM Sans 22px 500, plus date `May 14`
    in DM Mono 11px `--text-muted`. If today, append the existing
    `.today-flames` element.
  - Right: `Ndone / Ntotal` count in DM Mono 10px uppercase `--text-dim`,
    plus a `▾` chevron in DM Mono 14px `--text-dim`
- Divider — 1px `--border`, margin 2px 0 4px
- Task list — render existing `.task` elements **unchanged**. They already
  carry the right label colors, important `!`, done `✓`, and cancelled
  overlay. Reuse the existing tap/long-press handlers from `tasks.js`.
- `+ add task` button — the existing `.add-btn` element, unchanged

#### DayRow (collapsed)

- Outer button: width 100%, background `--surface`, 1px `--border`,
  border-radius 3, padding 10px 12px, flex items-center gap 10,
  box-shadow `1px 1px 0 rgba(0,0,0,0.05), 2px 3px 5px rgba(30,20,10,0.10)`
- Children (left to right):
  - Mini date block (min-width 36, column flex):
    - Day label in DM Mono 11px 500 uppercase (`#c25400` if today,
      else `--text-muted`)
    - Day-of-month in DM Mono 10px `--text-dim`
  - 1px × 24px vertical separator `--border`
  - Dot row (flex 1) — one 7×7 circle per task, label-border color,
    opacity 0.3 if done/cancelled. Show `empty` text in DM Mono 11px
    `--text-dim` if no tasks.
  - Red `!` glyph (font-weight 700, 15px, `#e8130d`) if any
    non-done/non-cancelled task is important
  - Remaining-count number in DM Mono 11px (min-width 22, right-aligned;
    show `✓` when 0)
  - `›` chevron in DM Mono 14px `--text-dim`
- Tap → toggle that day's expansion (add to `expandedDays` Set,
  re-render). If the dimmed-by-filter style applies, opacity 0.45.

### 4. Quick-add (bottom)

Always-visible docked element, position fixed at bottom of `#main`,
padding 10px 14px 16px, background `linear-gradient(to top,
rgba(216,194,152,1) 40%, rgba(216,194,152,0))`.

- Button: width 100%, background `--surface`, 1px `--border-hover`,
  border-radius 12, padding 13px 14px, text-align left, box-shadow
  `0 4px 14px rgba(0,0,0,0.14)`, flex items-center gap 8
- Content (left to right):
  - `+` in DM Mono 18px `--text-muted`
  - `quick add…` in DM Mono 13px `--text`
  - Spacer (flex 1)
  - `today` in DM Mono 10px uppercase `--text-dim`
- Tap → opens **Add task bottom-sheet** (see below)

### 5. Action sheet (long-press a task)

Replaces the desktop right-click context menu. Triggered by a 350ms
press-and-hold on any `.task` element (use a pointerdown timer; cancel
on pointermove > 8px or pointerup).

- Full-screen scrim `rgba(0,0,0,0.36)`, dismissed on tap
- Card slides up from bottom:
  - Background `--surface`, border-top-left/right-radius 18,
    padding 10px 14px 18px, box-shadow `0 -8px 30px rgba(0,0,0,0.22)`,
    flex column gap 10
  - 36×4 rounded grab handle (`rgba(0,0,0,0.18)`, border-radius 2,
    self-center, margin 4px 0 4px)
  - The task card itself (preview)
  - Section label `MOVE TO` in DM Mono 10px uppercase letter-spacing 0.08em
    `--text-dim`
  - 4×2 grid of day buttons (`Unsch`, `Mon`, `Tue`, …, `Sun`), gap 6px,
    border-radius 8, 1px `--border`, background `--surface2`, padding
    8px 4px, DM Mono 11px. The source day is dimmed (opacity 0.55) and
    non-tappable.
  - 1px `--border` divider
  - Action rows (each: flex gap 14, padding 10px 4px, DM Sans 14.5px):
    - ✓  Mark done   (color `--text`)
    - !  Mark important (`#c0392b`)
    - ✕  Cancel task    (`#8a2020`)
    - 🗑  Delete         (`#c0392b`)
  - Each action calls the corresponding existing handler in
    `tasks.js` / `context-menu.js`.

### 6. Add-task bottom-sheet

Two-step flow matching the desktop `.add-form`. Triggered by the quick-add
button (or by tapping `+ add task` inside an open `DayHero`).

**Step 1: pick a label**

- Section label `1 · PICK A LABEL`
- Flex-wrap row of pills, gap 5
- Each pill: DM Mono 11px, padding 5px 11px, border-radius 20, background
  / border / text from the label's preset, opacity 0.85 if not selected,
  selected pill gets `box-shadow: 0 0 0 2px rgba(0,0,0,0.18)`
- Trailing `+ new` pill: dashed `--border-hover` border, transparent
  background, `--text-dim` text

**Step 2: type name**

- Section label `2 · NAME`
- Input row uses the SELECTED pill's colors (background, border, text):
  padding 10px 12px, border-radius 8, flex items-center gap 8
  - Text input (flex 1) — focus the input on sheet open so the keyboard
    appears immediately
  - `add` button — background `--accent`, color `#fff`, padding 5px 11px,
    border-radius 6
- Help text in DM Mono 10px `--text-dim`: `↵ add & close`, `⇧↵ add & keep open`,
  `! marks important`
- Sheet sits above the keyboard. On iOS Safari the keyboard reduces
  visualViewport.height; subscribe to `visualViewport.resize` and update
  the sheet's bottom inset so it stays docked above the keys.

### 7. Side menu (≡)

Slide-over from the right, replaces the fixed 64-wide rail.

- Scrim `rgba(0,0,0,0.36)`, dismissed on tap
- Panel: width 260, full height, background
  `rgba(220, 200, 160, 0.94)` with `backdrop-filter: blur(8px)`,
  1px `--border` left border, padding 48px 18px 24px (top accounts for
  status bar), flex column gap 18
- Sections (each = mono uppercase 10px label + content):
  - `signed in` → user label + email
  - `account` → buttons for `Add account` and `Delete account` (the
    existing `#accountAddBtn` / `#accountDeleteBtn` handlers)
  - `labels` → vertical list of current labels (color swatch + name +
    × delete), plus a `+ add label` dashed-border row (reuse
    `add-label-panel.js`)
  - `settings` → row of pills for `EN` lang toggle and scale −/+

### 8. Unscheduled drawer

Triggered by tapping the unscheduled chip.

- Scrim, dismissed on tap
- Drawer slides up from bottom with the sky-blue gradient
  (`#b8ddf0` → `#cce8f5` → `#ddf0f8`), border-top-left/right-radius 18,
  dashed `rgba(80,150,200,0.30)` top border, padding 10px 14px 22px,
  max-height 82%
- Content:
  - Grab handle (`rgba(80,150,200,0.4)`)
  - Title block:
    - `UNSCHEDULED` in DM Mono 10px uppercase `#3a6a8a`
    - `N tasks waiting` in DM Sans 17px 500 `#1a4a6a`
    - Right: `+ add` button with the same sky styling
  - Scrollable column of rows, gap 6:
    - The existing `.task` element at full width (flex 1)
    - A `schedule ›` button on the right (DM Mono 11px, sky-tinted,
      border-radius 6, padding 8px 10px)
    - Tapping the task: open the **action sheet** (so user can also
      mark done / important without scheduling)
    - Tapping `schedule ›`: open a mini day picker (reuse the 4×2 grid
      from the action sheet)
  - Footer hint: `tap "schedule" or long-press to move to a day` in
    DM Mono 10px center `#3a6a8a` opacity 0.8

## Interactions & Behavior

| Gesture                         | Effect                                                    |
| ------------------------------- | --------------------------------------------------------- |
| Tap a day chip in the strip     | Toggle that day's expansion (add/remove from `expandedDays`) |
| Tap a collapsed `DayRow`        | Same — toggle expansion                                   |
| Tap the `▾` chevron / header on a `DayHero` | Collapse that day                              |
| Long-press a `.task` (350ms)    | Open action sheet                                         |
| Tap a label pill in add-sheet   | Select it; advance to step 2                              |
| Tap unscheduled chip            | Open unscheduled drawer                                   |
| Tap quick-add                   | Open add-task sheet (always defaults to today)            |
| Tap ≡                           | Open side menu                                            |
| Tap any scrim                   | Dismiss the overlay                                       |
| Pull-down on a sheet (>80px)    | Dismiss the overlay (nice-to-have)                        |

Animations: 200ms ease-out for sheet enter, 160ms ease-in for sheet exit.
Day expand/collapse: 180ms ease for the height transition (use
`overflow: hidden` + measured `max-height` to animate cleanly).

Today is recomputed from `Date.now()`; the today chip and `DayHero` get
the orange ring + 🔥🔥🔥 (the existing `.today-flames` element).

## State Management

New state to add (module-scope in a new `mobile.js`, alongside the
existing module state):

```js
// id of every day currently expanded (defaults to ['today-id'] when
// mobile view first activates)
let expandedDays = new Set();

// the currently visible overlay, or null
//   { kind: 'action',  task, fromDay }
//   { kind: 'add',     step: 1|2, dayId, selectedType, typedText }
//   { kind: 'menu' }
//   { kind: 'unsched' }
let overlay = null;
```

`expandedDays` and `overlay` are **purely client state** — do not
persist. Re-render is triggered by the same `render()` call already used
by `board.js`. Tap handlers mutate the Set and call `render()`.

The desktop data model (`cols`, `state`, `weekUnscheduled`,
`typeConfig`, `legendOrder`) is unchanged. All mutating actions
(move task, mark done, mark important, mark cancelled, delete, add task,
add label) go through the **existing** functions in
`tasks.js` / `columns.js` / `labels.js` so undo, persistence, and i18n
keep working.

## Design Tokens

Reuse the CSS variables already declared in `frontend/style.css`:

```
--bg            #dcc8a0
--surface       #f0eeea
--surface2      #e6e3de
--border        rgba(0,0,0,0.08)
--border-hover  rgba(0,0,0,0.18)
--text          #1a1a1a
--text-muted    #666
--text-dim      #aaa
--accent        #2a2a2a
--mono          'DM Mono', 'Consolas', 'Courier New', monospace
--sans          'DM Sans', system-ui, -apple-system, sans-serif
--ui-scale      1
```

Label colors come from `COLOR_PRESETS` in `constants.js` — no new colors.

Mobile-specific tokens (declare alongside the existing ones):

```
--today-ring        rgba(220,100,20,0.55)
--today-text        #c25400
--sky-from          #b8ddf0
--sky-mid           #cce8f5
--sky-to            #ddf0f8
--sky-border        rgba(80,150,200,0.30)
--sky-text          #3a6a8a
--sky-text-dark     #1a4a6a
--scrim             rgba(0,0,0,0.36)
--sheet-radius      18px
--mobile-bp         720px
```

Spacing: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 22 (use as-is — no new
scale).

## Assets

No new assets. The 🔥 flame emoji is already used in `.today-flames`.
All UI is built with CSS — no SVG or image files.

## Files in This Bundle

- `prototype/` — the HTML+React design references. Open
  `Todoies Mobile Proposal.html` in a browser to interact with them.
  Particularly useful: the `▶ Try it` artboard is fully interactive.
- `prototype/option-c-week-strip.jsx` — main mobile layout component
- `prototype/option-c-overlays.jsx` — all four overlays
  (action sheet, add-task sheet, side menu, unscheduled drawer)
- `prototype/option-c-interactive.jsx` — wiring + state for the playable demo
- `prototype/mobile-shared.jsx` — primitive wrappers (`WoodBg`, `SkyBg`,
  `Paper`, `TaskCard`, `DotRow`, `Flames`, `AddTaskBtn`, `DayHeader`)
- `prototype/shared-data.jsx` — sample week data + theme tokens
- `frontend-reference/` — snapshot of the relevant existing files
  (`style.css`, `constants.js`, `index.html`, `columns.js`) for the
  developer to read while implementing. Do not include these in the
  final implementation — they're already in the repo.

## Suggested Implementation Order

1. Add the `mobile-bp` media query + `data-view="mobile"` toggle
2. Build the top region (title + day strip) — pure CSS + a small render fn
3. Build `DayRow` and `DayHero` renderers; switch `#board`'s output when
   in mobile view
4. Wire the existing add-task / add-label / context-menu handlers to
   the new overlays
5. Add the action sheet, add-task sheet, side menu, unscheduled drawer
   (each is a sibling `<div>` of `#main`, position fixed)
6. Test long-press on real iOS Safari + Android Chrome
7. Verify undo, persistence, scale, lang toggle still work in mobile view
