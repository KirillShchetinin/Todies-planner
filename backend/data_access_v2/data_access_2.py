from backend.data_access_v2.connections import (
    BASE_DIR, DB_PATH, NEW_DB_PATH,
    get_db, get_db_2, close_db, register, init_db, backup,
)
from backend.data_access_v2.metadata import (
    get_user, get_metadata, update_metadata,
)
from backend.data_access_v2.forms import (
    get_forms, create_form, delete_form,
)
from backend.data_access_v2.tasks import (
    get_tasks, get_tasks_by_form, create_task, update_task, delete_task,
)

__all__ = [
    'BASE_DIR', 'DB_PATH', 'NEW_DB_PATH',
    'get_db', 'get_db_2', 'close_db', 'register', 'init_db', 'backup',
    'get_user', 'get_metadata', 'update_metadata',
    'get_forms', 'create_form', 'delete_form',
    'get_tasks', 'get_tasks_by_form', 'create_task', 'update_task', 'delete_task',
]


def get_user_id(token):
    row = get_db_2().execute(
        'SELECT id FROM users WHERE token=?', (token,)
    ).fetchone()
    return row['id'] if row else None
