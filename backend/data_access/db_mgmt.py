"""One-time / lifecycle database operations: schema creation, backups, migrations.

Everything here runs at startup or on a timer, never per request. Per-request
connection handling stays in connections.py.

DB_PATH is read through the `connections` module rather than imported by value
so tests that monkeypatch it are honoured.
"""
import datetime, os, sqlite3, time
from backend.data_access import connections

BACKUP_INTERVAL_SECONDS = 4 * 60 * 60
SIMULATE_RESTART_INTERVAL_SECONDS = 24 * 60 * 60

def init_db(interval = SIMULATE_RESTART_INTERVAL_SECONDS):
    conn = connections._connect()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            token    TEXT    NOT NULL UNIQUE,
            metadata TEXT    NOT NULL DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS forms (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id        INTEGER NOT NULL REFERENCES users(id),
            client_id      TEXT    NOT NULL,
            label          TEXT    NOT NULL DEFAULT '',
            date           TEXT    NOT NULL DEFAULT '',
            is_unscheduled INTEGER NOT NULL DEFAULT 0,
            sort_order     INTEGER NOT NULL DEFAULT 0,
            UNIQUE(user_id, client_id)
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users(id),
            form_id    INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
            client_id  TEXT    NOT NULL,
            name       TEXT    NOT NULL DEFAULT '',
            done       INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0,
            metadata   TEXT    NOT NULL DEFAULT '{}',
            created_at TEXT,
            updated_at TEXT,
            UNIQUE(user_id, client_id)
        );
        CREATE TABLE IF NOT EXISTS task_content (
            task_id     INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
            content     TEXT    NOT NULL DEFAULT ''
        );
    ''')
    conn.commit()

    apply_migrations(conn)

    # Adding one more table to the sql lite. Currently not active since functionality not ready.
    # init_user_feedback_db_table(conn)
    conn.close()


# Currently not called by design.
def init_user_feedback_db_table(conn):
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS user_feedback (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id  INTEGER NOT NULL REFERENCES users(id),
            type     TEXT    NOT NULL DEFAULT '',
            feedback TEXT    NOT NULL DEFAULT '',
            metadata TEXT    NOT NULL DEFAULT '{}',
            status   TEXT    NOT NULL DEFAULT ''
        );
    ''')
    conn.commit()


def backup(backup_dir):
    if not os.path.exists(connections.DB_PATH):
        return None
    os.makedirs(backup_dir, exist_ok=True)
    now = datetime.datetime.now()
    ts = now.strftime('%Y%m%d_%H%M%S')
    dest = os.path.join(backup_dir, f'planner_db_backup_{ts}.db')
    tmp_dest = dest + '.tmp'
    src_conn = sqlite3.connect(connections.DB_PATH)
    dest_conn = sqlite3.connect(tmp_dest)
    with dest_conn:
        src_conn.backup(dest_conn)
    dest_conn.close()
    src_conn.close()
    os.replace(tmp_dest, dest)
    _prune_old_backups(backup_dir, now)
    return [dest]


def _prune_old_backups(backup_dir, now):
    cutoff = now - datetime.timedelta(days=3)
    stamps = []
    for name in os.listdir(backup_dir):
        if not (name.startswith('planner_db_backup_') and name.endswith('.db')):
            continue
        try:
            ts = datetime.datetime.strptime(name[len('planner_db_backup_'):-len('.db')], '%Y%m%d_%H%M%S')
        except ValueError:
            continue
        stamps.append((ts, name))
    if not stamps or (now - min(s[0] for s in stamps)) <= datetime.timedelta(days=3):
        return
    for ts, name in stamps:
        if ts < cutoff:
            try:
                os.remove(os.path.join(backup_dir, name))
            except OSError:
                pass


def run_backup_loop(backup_dir, interval=BACKUP_INTERVAL_SECONDS):
    """Back up every `interval` seconds, forever. Runs in a daemon thread."""
    while True:
        time.sleep(interval)
        try:
            backup(backup_dir)
        except Exception as e:
            print(f'  backup failed: {e}')


# ── removable: additive column migrations ─────────────────────────────────
# Delete this section and the apply_migrations() call in init_db() once every
# deployed DB has the columns below -- they are already in init_db()'s CREATE
# TABLE, so fresh databases stay correct without it. Nothing here raises: a
# column that cannot be added is reported and skipped, and the app runs as it
# did before.

# (table, column, type) -- nullable with no default, so existing rows read NULL
# and ALTER TABLE stays legal on a table that already has data.
_MIGRATION_COLUMNS = [
    ('tasks', 'created_at', 'TEXT'),
    ('tasks', 'updated_at', 'TEXT'),
]


def apply_migrations(conn):
    """Add any missing columns from _MIGRATION_COLUMNS. Never raises."""
    for table, column, coltype in _MIGRATION_COLUMNS:
        try:
            if _has_column(conn, table, column):
                continue
            conn.execute(f'ALTER TABLE {table} ADD COLUMN {column} {coltype}')
            conn.commit()
        except Exception as e:
            print(f'  migration skipped: {table}.{column} ({e})')


def _has_column(conn, table, column):
    rows = conn.execute(f'PRAGMA table_info({table})').fetchall()
    return any(r[1] == column for r in rows)

# ── end removable section ─────────────────────────────────────────────────
