from backend.data_access.connections import (
    BASE_DIR, DB_PATH,
    get_db, close_db, register, backup,
)
from backend.data_access.metadata import (
    create_user, delete_user, get_user, get_metadata, update_metadata, rotate_token,
)
from backend.data_access.forms import (
    get_forms, create_form, delete_form,
)
from backend.data_access.tasks import (
    get_tasks, get_tasks_by_form, create_task, update_task, delete_task,
)

__all__ = [
    'BASE_DIR', 'DB_PATH',
    'get_db', 'close_db', 'register', 'backup',
    'create_user', 'delete_user', 'get_user', 'get_metadata', 'update_metadata', 'rotate_token',
    'get_forms', 'create_form', 'delete_form',
    'get_tasks', 'get_tasks_by_form', 'create_task', 'update_task', 'delete_task',
]


def get_user_id(token):
    row = get_db().execute(
        'SELECT id FROM users WHERE token=?', (token,)
    ).fetchone()
    return row['id'] if row else None
