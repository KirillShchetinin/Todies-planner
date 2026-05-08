import re

from backend.data_access import get_db_2
from backend.data_access_v2.metadata import (
    get_user, save_user_metadata, get_metadata, update_metadata,
)
from backend.data_access_v2.forms import (
    get_forms, save_forms, create_form, update_form, delete_form,
)
from backend.data_access_v2.tasks import get_tasks, save_tasks

__all__ = [
    'get_user', 'save_user_metadata', 'get_metadata', 'update_metadata',
    'get_forms', 'save_forms', 'create_form', 'update_form', 'delete_form',
    'get_tasks', 'save_tasks',
    'get_state', 'set_state',
]


def get_state(user_id):
    user = get_user(user_id)
    if user is None:
        return None

    forms = get_forms(user_id)
    tasks = get_tasks(user_id)

    form_by_id = {f['id']: f for f in forms}

    task_groups = {}
    for f in forms:
        task_groups[f['client_id']] = []
    for t in tasks:
        form = form_by_id.get(t['form_id'])
        if form is None:
            continue
        task_obj = {'id': t['client_id'], 'text': t['name'], 'done': bool(t['done'])}
        task_obj.update(t['metadata'])
        task_groups[form['client_id']].append(task_obj)

    cols = [
        {'id': f['client_id'], 'label': f['label'], 'date': f['date']}
        for f in forms if not f['is_unscheduled']
    ]
    week_unscheduled = [
        {'id': f['client_id'], 'label': f['label']}
        for f in forms if f['is_unscheduled']
    ]

    nums = []
    for f in forms:
        m = re.match(r'(?:col|unsched_w)(\d+)$', f['client_id'])
        if m:
            nums.append(int(m.group(1)))
    col_counter = max(nums) + 1 if nums else 200

    meta = user['metadata']
    return {
        'cols':            cols,
        'weekUnscheduled': week_unscheduled,
        'state':           task_groups,
        'idCounter':       meta.get('idCounter', 0),
        'colCounter':      col_counter,
        'typeCounter':     meta.get('typeCounter', 0),
        'typeConfig':      meta.get('typeConfig', {}),
        'legendOrder':     meta.get('legendOrder', []),
        'uiScale':         meta.get('uiScale', 1),
        'lang':            meta.get('lang', 'en'),
        'collapseState':   meta.get('collapseState', {}),
    }


def set_state(user_id, state):
    save_user_metadata(user_id, state)
    form_db_id_map = save_forms(user_id, state.get('cols', []), state.get('weekUnscheduled', []))
    save_tasks(user_id, state.get('state', {}), form_db_id_map)
    get_db_2().commit()
