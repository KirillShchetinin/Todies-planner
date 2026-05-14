# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
python server.py
```

The server starts on port 5000 and auto-opens a browser tab. On Windows, `start.bat` installs Flask and launches the server.

```bash
pip install flask flask-limiter
```

There is no build step or linter configured.

## Running Tests

```bash
pytest tests/
pytest tests/test_auth.py::test_name   # single test
```

## Architecture

**Todies** is a weekly task planner. The backend is a minimal Flask app; the frontend is vanilla JavaScript with no framework or bundler.

### Backend

`server.py` is the entrypoint — backs up the DB, calls `init_db()`, and starts Flask on port 5000.

Backend logic lives in `backend/`:
- **`auth.py`** — `resolve_user_id()`: validates the token query param and returns the user ID.
- **`controllers/controller.py`** — Flask app instance, rate limiter (Flask-Limiter), blueprint registration, and account routes (`POST /api/account`, `POST /api/account/token`, `DELETE /api/account`). Account creation requires the `X-Create-Secret` header matching the `CREATE_SECRET` env var.
- **`controllers/forms.py`** — `GET/POST/DELETE /api/v2/forms`
- **`controllers/tasks.py`** — `GET/POST/PUT/DELETE /api/v2/tasks`
- **`controllers/metadata.py`** — `GET/PUT /api/v2/metadata`
- **`data_access/connections.py`** — `get_db`, `init_db`, `backup`. SQLite with WAL mode and foreign keys ON.
- **`data_access/metadata.py`** — user/token CRUD, metadata read/write.
- **`data_access/forms.py`** — form CRUD queries.
- **`data_access/tasks.py`** — task CRUD; `_clean_meta()` strips internal keys before storage.

Token-based auth: token passed as `?token=<token>` query param on every request; validated by `resolve_user_id()`.

### Database (`planner_db.db`)

Normalized SQLite schema:
- **`users`** — token auth + JSON `metadata` (lang, uiScale, counters, typeConfig, legendOrder, collapseState)
- **`forms`** — one row per day column or unscheduled container; has `label`, `date`, `is_unscheduled`, `sort_order`
- **`tasks`** — one row per task; linked to a form via `form_id`; extra fields (type, locked, cancelled, important) in JSON `metadata`

`internal/` contains migration scripts from the legacy single-blob schema (`planner.db`). `tests/test_db_parity.py` validates migrated data.

### Frontend (`frontend/`)

Script load order (all deferred, defined in `index.html`):
`sidebar.js` → `collapse.js` → `constants.js` → `api.js` → `i18n.js` → `state.js` → `undo.js` → `modal.js` → `labels.js` → `tasks.js` → `columns.js` → `scale.js` → `add-label-panel.js` → `context-menu.js` → `legend.js` → `board.js` → `showcase.js` → `app.js`

Key modules:
- **`state.js`** — global state (`cols`, `weekUnscheduled`, `state` keyed by form_id, counters, `typeConfig`, `uiScale`) and `loadState`/`saveState`. `saveMetadata()` batches UI settings; forms/tasks have per-item endpoints.
- **`app.js`** — orchestrates initial load: fetches metadata, forms, and tasks in parallel; merges `typeConfig` with defaults; applies lang/scale/collapse.
- **`api.js`** — `apiFetch` wrapper and account management helpers (deleteAccount, refreshToken, addAccount).
- **`board.js`** — `render()` rebuilds the entire DOM from state. Handles drag-and-drop for tasks (within/between columns) and columns.
- **`tasks.js`** — task CRUD: `addTask`, `deleteTask`, `toggleDone`, `toggleCancelled`.
- **`columns.js`** — column CRUD and date utilities: `addCol`, `deleteCol`, `sortColsByDate`, `colWeekInfo`. Date format is `MM/DD` or `MM/DD/YYYY`.
- **`undo.js`** — snapshots full state before every mutation (max 10 snapshots). Restored via Ctrl+Z.
- **`constants.js`** — default columns (Mon–Sun), 8 built-in task types with color schemes, and the 5 UI scale levels (0.75–1.25).
- **`collapse.js`** — per-column short/full toggle. Shows up to 3 active or 2 done tasks; dots represent overflow.
- **`i18n.js`** — EN/RU translations.

### Translation rule

Every user-visible string in the frontend **must** go through `t('key')` — never hardcode English text in `.js` files or in `index.html` button/label text. When adding any frontend feature, always:
1. Add the key to **both** `en` and `ru` blocks in `i18n.js`.
2. Use `t('key')` at the call site.
3. If the string appears in a static HTML element, add a line to `applyLangToStaticUI()` in `i18n.js` that sets its `textContent`.

### State Model

All in-memory state is a flat set of globals in `state.js`. On load, `loadState()` fetches metadata, forms, and tasks, then repopulates all globals, merging saved `typeConfig` with defaults to handle new built-in types. Mutations call `saveMetadata()` for UI settings or the relevant form/task endpoint directly.

### Task Types / Labels

8 built-in types (locked, interview, taxes, practice, async, rest, unplanned, done) plus user-defined custom types. Each type has `bg`, `border`, `text` colors and optional `dashed`/`italic` flags. Types drive card styling in `board.js:applyTaskStyle`. Users can reorder and create types via the legend panel.

### Tests

`tests/conftest.py` provides an isolated temp DB per test via the `db_paths` fixture, monkeypatching `DB_PATH`. The `seed` fixture exposes `.user()`, `.form()`, `.task()` helpers for quick test setup.

**Do not overwrite or delete existing test files without first warning the user explicitly and receiving their confirmation.**
