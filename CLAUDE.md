# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
python server.py
```

The server starts on port 5000 and auto-opens a browser tab. Use `start.bat` on Windows to install Flask first, then launch.

Install the only dependency:
```bash
pip install flask
```

There is no build step, test suite, or linter configured.

## Architecture

**Todies** is a weekly task planner. The backend is a minimal Flask app; the frontend is vanilla JavaScript with no framework or bundler.

### Backend (`server.py`)
- Serves static frontend files from `frontend/`
- Two REST endpoints: `GET /api/state` and `PUT /api/state`
- Persists the entire app state as a single JSON blob in SQLite (`planner.db`, table `planner_state`)
- On startup, backs up the DB to `backups/`

### Frontend (`frontend/`)
- `app.js` — 1000+ line monolithic JS file managing all state, rendering, task CRUD, drag-and-drop, and i18n (EN/RU). State is an in-memory object synced to the backend on every change via `saveState()`.
- `collapse.js` — Standalone module for column short/full-view toggle. Shows first N active tasks; overflow is represented by a dot count.
- `index.html` — Minimal shell; all DOM is created by `app.js`.
- `style.css` — CSS custom properties drive UI scaling (5 levels: 75%–125%). Wood-texture design.

### State Model
All application state lives in a single JS object and is serialized to/from the backend as one JSON document. Columns (days), tasks within columns, and labels are all nested inside this object. Double-clicking a task marks it done; a second double-click removes it.

### Labels
8 built-in task label types (locked, interview, tax, practice, async, rest, unplanned, done) plus user-defined custom labels with color presets. Labels drive task card styling.

### Internationalization
Language toggle (EN/RU) is handled inside `app.js`. Date formatting adapts per locale.
