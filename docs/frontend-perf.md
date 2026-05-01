# Frontend Performance: Analysis & Work Log

## Problem

Page refresh takes 500ms+ before content is visible. The app is blank until the full load/render cycle completes.

## Load Sequence (as instrumented)

```
[perf] scripts ready  +0ms         ← all 14 JS files parsed & executed
[perf] fetch done     +Xms         ← GET /api/state returned  (network: Yms)
[perf] json parsed    +Xms
[perf] loadState done +Xms
[perf] render done    +Xms         ← full DOM rebuild complete (render itself: Zms)
[perf] first paint    +Xms         ← browser committed frame to screen
```

Perf logging is live in `frontend/app.js` and `frontend/state.js` — open DevTools console on refresh to see real numbers.

---

## Identified Bottlenecks

### 1. Google Fonts `@import` — render-blocking (FIXED)

**Was:** `style.css` line 1 had `@import url('https://fonts.googleapis.com/...')`.  
A CSS `@import` of an external URL is render-blocking — the browser cannot finish parsing the stylesheet or paint anything until the Google Fonts CSS is fetched over the network.

**Fix applied (`frontend/index.html`, `frontend/style.css`):**
- Removed `@import` from `style.css`
- Added `<link rel="preconnect">` hints to `index.html` for early DNS/TLS
- Loaded Google Fonts via `<link rel="stylesheet" media="print" onload="this.media='all'">` — non-blocking async load that flips to `all` once ready
- Added `<noscript>` fallback

**Expected gain:** 200–500ms FCP improvement (eliminates the render-block entirely).  
**Observed:** No measurable improvement in practice. Likely explanation: the bottleneck is elsewhere (script parse time or the fetch itself dominates), or the font was already cached from prior visits.

### 2. Script tags not deferred — parser-blocking (FIXED)

**Was:** All 14 `<script>` tags in `<body>` had no `async`/`defer`. Browser stops HTML parsing to fetch and execute each script in sequence.

**Fix applied (`frontend/index.html`):**  
Added `defer` to all 14 `<script>` tags. Execution order is preserved by `defer`; HTML parsing completes before scripts run.

**Expected gain:** Allows browser to finish parsing HTML shell while scripts download.  
**Observed:** No measurable improvement — likely because scripts are local (served from Flask, no network latency) so the blocking time was already negligible.

### 3. Full DOM rebuild on every render — NOT YET ADDRESSED

`render()` in `frontend/board.js:280` does `board.innerHTML = ''` then rebuilds the entire board from scratch on every state change. With a typical task load this takes ~30–100ms.

**Root cause:** No incremental update strategy — any change (add task, toggle done, reorder) triggers a full rebuild.

**Potential fix:** Targeted DOM updates per action (e.g. only re-render the affected column), or introduce a keyed diffing pass before clearing innerHTML.

### 4. Per-task event listeners — NOT YET ADDRESSED

`buildColEl()` in `frontend/board.js:14` attaches 8–10 event listeners per task element on every render. With 20 tasks that's 200+ listener attachments per full render.

**Potential fix:** Event delegation — a single listener on `#board` that reads `e.target.closest('.task')`.

### 5. Google Fonts network round-trip — NOT YET ADDRESSED

Even with async loading, two round-trips to `fonts.googleapis.com` + `fonts.gstatic.com` are required on a cold cache. On a slow or offline connection this causes FOUT (flash of unstyled text) or slow render.

**Potential fix:** Self-host the font files in `frontend/fonts/` and reference them via `@font-face` in `style.css`. Eliminates the external dependency entirely.

### 6. No skeleton / loading state — NOT YET ADDRESSED

The board div is empty until `loadState()` resolves and `render()` completes. On a slow server or cold start this is a blank screen.

**Potential fix:** Render a static skeleton (e.g. 7 empty column placeholders) from HTML/CSS before JS runs, then replace with real content.

### 7. Complex CSS background — low priority

`body` has 7 layered radial/linear gradients for the wood texture (`style.css:20–52`). Expensive on initial GPU paint.

**Potential fix:** Pre-render as a static PNG and use `background-image: url(wood.png)`.

---

## What to Try Next

Most promising remaining approaches, in order of expected impact:

1. **Self-host fonts** — eliminates the external network dependency entirely, no FOUT.
2. **Targeted render / event delegation** — reduces render time from ~50ms to near-zero for single-item changes.
3. **Skeleton UI** — hides the blank-screen gap regardless of fetch latency.
