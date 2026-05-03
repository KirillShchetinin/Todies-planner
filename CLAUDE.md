# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
python server.py
```

The server starts on port 5000 and auto-opens a browser tab. On Windows, `start.bat` installs Flask and launches the server.

```bash
pip install flask
```

There is no build step or linter configured.

## Running Tests

```bash
pytest tests/
```

Tests live in `tests/` and currently cover DB schema parity (`test_db_parity.py`). Run a single test file with `pytest tests/test_db_parity.py`.

## Architecture

**Todies** is a weekly task planner. The backend is a minimal Flask app; the frontend is vanilla JavaScript with no framework or bundler.

### Backend

`server.py` is the entrypoint — backs up the DB, calls `init_db()`, and starts Flask on port 5000.

Backend logic lives in `backend/`:
- **`controller.py`** — Flask app instance and all routes (`GET /api/state`, `PUT /api/state`, static file serving). Handles request/response, extracts the auth token, and delegates DB work to `data_access`.
- **`data_access.py`** — all SQL queries and DB helpers: `get_db`, `init_db`, `resolve_user_id`, `get_state`, `set_state`. Nothing in here knows about HTTP.

Token-based auth: `users` table stores tokens; state is keyed per user.

### Database (`internal/`)
There are two DB schemas in transition:

- **Legacy** (`planner.db`): single `planner_state` table storing entire state as a JSON blob per user
- **New** (`planner_db.db`): normalized schema with three tables:
  - `users` — token auth + user metadata (lang, uiScale, counters, typeConfig, legendOrder, collapseState) stored as JSON in `metadata`
  - `forms` — one row per day column or unscheduled container; has `label`, `date`, `is_unscheduled`, `sort_order`
  - `tasks` — one row per task; linked to a form via `form_id`; extra fields (type, locked, cancelled, important) stored in `metadata` JSON

`internal/` contains DB migration logic. `tests/test_db_parity.py` validates that migrated data matches the legacy blob.

### Frontend (`frontend/`)

Script load order (all deferred, defined in `index.html`):
`collapse.js` → `constants.js` → `i18n.js` → `state.js` → `undo.js` → `labels.js` → `tasks.js` → `columns.js` → `scale.js` → `add-label-panel.js` → `context-menu.js` → `legend.js` → `board.js` → `app.js`

Key modules:
- **`state.js`** — global state variables (`cols`, `weekUnscheduled`, `state`, counters, `typeConfig`, `uiScale`) and the `loadState`/`saveState` functions that sync with the backend. `saveState()` is called after every mutation.
- **`board.js`** — `render()` rebuilds the entire DOM from state. Handles drag-and-drop for both tasks (within/between columns) and columns themselves.
- **`tasks.js`** — task CRUD: `addTask`, `deleteTask`, `toggleDone`, `toggleCancelled`.
- **`columns.js`** — column CRUD and date utilities: `addCol`, `deleteCol`, `sortColsByDate`, `colWeekInfo`. Date format is `MM/DD` or `MM/DD/YYYY`.
- **`undo.js`** — snapshots full state before every mutation (max 10 snapshots). Restored via Ctrl+Z.
- **`constants.js`** — default columns (Mon–Sun), initial tasks, 8 built-in task types with color schemes, and the 5 UI scale levels (0.75–1.25).
- **`collapse.js`** — per-column short/full toggle. A column can collapse if it has done tasks or more than 3 active tasks; shows up to 3 active or 2 done tasks, dots represent overflow.
- **`i18n.js`** — EN/RU translations. Language toggle persists in state.

### State Model

All in-memory state is a flat set of globals in `state.js`. `saveState()` serializes everything — cols, tasks, counters, typeConfig, lang, uiScale, collapseState — into one JSON PUT request. On load, `loadState()` fetches and repopulates all globals, merging saved `typeConfig` with defaults to handle new built-in types.

### Task Types / Labels

8 built-in types (locked, interview, taxes, practice, async, rest, unplanned, done) plus user-defined custom types. Each type has `bg`, `border`, `text` colors and optional `dashed`/`italic` flags. Types drive card styling in `board.js:applyTaskStyle`. Users can reorder and create types via the legend panel.
