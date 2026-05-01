# Normalized SQLite Schema (todies2.db)

## Context

The current `planner.db` stores everything as a single JSON blob per user (`planner_state.data`). Every action — typing a task name, toggling done, reordering — triggers a full `PUT /api/state` that rewrites the entire document. This makes partial reads impossible, last-write-wins under concurrent tabs, and won't scale as user count grows.

The goal is a new `todies2.db` with a proper normalized schema and granular endpoints. The old `planner.db` is NOT touched.

---

## New Database: `todies2.db`

### Schema

```sql
-- Users table (already exists conceptually; extend with metadata column)
CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    token    TEXT    NOT NULL UNIQUE,
    metadata TEXT    NOT NULL DEFAULT '{}'
    -- metadata JSON holds: { lang, uiScale, legendOrder, typeConfig,
    --                        idCounter, colCounter, typeCounter, collapseState }
);

-- Forms table: one row per column/box visible on the board
CREATE TABLE IF NOT EXISTS forms (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    client_id  TEXT    NOT NULL,           -- the JS-side id e.g. 'col201', 'unsched_w202'
    label      TEXT    NOT NULL DEFAULT '',
    date       TEXT    NOT NULL DEFAULT '', -- 'MM/DD' or '' for unscheduled
    is_unscheduled INTEGER NOT NULL DEFAULT 0, -- 1 = unscheduled box, 0 = day column
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, client_id)
);

-- Tasks table: one row per task
CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    form_id    INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    client_id  TEXT    NOT NULL,           -- the JS-side id e.g. 'u101'
    name       TEXT    NOT NULL DEFAULT '',
    done       INTEGER NOT NULL DEFAULT 0, -- 0 or 1
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata   TEXT    NOT NULL DEFAULT '{}',
    -- metadata JSON holds: { type, locked } and any future per-task fields
    UNIQUE(user_id, client_id)
);
```

---

## New API Endpoints

All endpoints accept `?token=<token>` query param (same as today).

### Bootstrap / full load
```
GET /api/v2/state
```
Returns everything needed on first load: user metadata + all forms + all tasks. Used once at startup, replaces the current `GET /api/state`.

Response shape (mirrors current blob for easy frontend migration):
```json
{
  "forms": [
    { "client_id": "col201", "label": "Mon", "date": "04/28", "is_unscheduled": 0, "sort_order": 0 },
    { "client_id": "unsched_w202", "label": "Unscheduled", "date": "", "is_unscheduled": 1, "sort_order": 1 }
  ],
  "tasks": [
    { "client_id": "u101", "form_client_id": "col201", "name": "Team standup", "done": 0, "sort_order": 0, "metadata": { "type": "t-locked", "locked": true } }
  ],
  "metadata": { "lang": "en", "uiScale": 1, "legendOrder": [...], "typeConfig": {...}, "idCounter": 100, "colCounter": 200, "typeCounter": 0, "collapseState": {} }
}
```

SQL:
```sql
SELECT * FROM forms WHERE user_id = ?  ORDER BY sort_order;
SELECT t.*, f.client_id as form_client_id
  FROM tasks t JOIN forms f ON t.form_id = f.id
 WHERE t.user_id = ?  ORDER BY t.form_id, t.sort_order;
SELECT metadata FROM users WHERE id = ?;
```

---

### Forms (columns/boxes)

```
POST   /api/v2/forms                  -- create a new day or unscheduled box
PUT    /api/v2/forms/<client_id>      -- update label, date, sort_order
DELETE /api/v2/forms/<client_id>      -- delete column + cascade-deletes its tasks
```

**POST body:** `{ client_id, label, date, is_unscheduled, sort_order }`

SQL (POST):
```sql
INSERT OR IGNORE INTO users (token, metadata) VALUES (?, '{}');
INSERT INTO forms (user_id, client_id, label, date, is_unscheduled, sort_order)
  VALUES (?, ?, ?, ?, ?, ?);
```

SQL (PUT):
```sql
UPDATE forms SET label=?, date=?, sort_order=? WHERE user_id=? AND client_id=?;
```

SQL (DELETE):
```sql
DELETE FROM forms WHERE user_id=? AND client_id=?;
-- tasks cascade via ON DELETE CASCADE
```

---

### Tasks

```
POST   /api/v2/tasks                  -- create task
PUT    /api/v2/tasks/<client_id>      -- update name, done, sort_order, metadata
DELETE /api/v2/tasks/<client_id>      -- delete task
PATCH  /api/v2/tasks/<client_id>/done -- toggle done only (hot path)
PATCH  /api/v2/tasks/<client_id>/move -- move to different form_client_id
```

**POST body:** `{ client_id, form_client_id, name, done, sort_order, metadata }`

SQL (POST):
```sql
INSERT INTO tasks (user_id, form_id, client_id, name, done, sort_order, metadata)
  VALUES (?, (SELECT id FROM forms WHERE user_id=? AND client_id=?), ?, ?, ?, ?, ?);
```

SQL (PUT):
```sql
UPDATE tasks SET name=?, done=?, sort_order=?, metadata=?
 WHERE user_id=? AND client_id=?;
```

SQL (PATCH /done):
```sql
UPDATE tasks SET done = 1 - done WHERE user_id=? AND client_id=?;
```

SQL (PATCH /move):
```sql
UPDATE tasks SET form_id = (SELECT id FROM forms WHERE user_id=? AND client_id=?), sort_order=?
 WHERE user_id=? AND client_id=?;
```

SQL (DELETE):
```sql
DELETE FROM tasks WHERE user_id=? AND client_id=?;
```

---

### User metadata (settings)

```
PUT /api/v2/metadata
```

Body: full metadata JSON object `{ lang, uiScale, legendOrder, typeConfig, idCounter, colCounter, typeCounter, collapseState }`.

SQL:
```sql
UPDATE users SET metadata=? WHERE id=?;
```

This endpoint is called only when settings change (lang, scale, label config, undo counters, collapse toggle) — not on every task edit.
