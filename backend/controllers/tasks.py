from flask import jsonify
from backend.data_access_v2 import tasks as DA_tasks


def register(bp, require_user):
    @bp.route('/api/v2/tasks', methods=['GET'])
    def get_tasks():
        user_id, err = require_user()
        if err:
            return err
        tasks = DA_tasks.get_tasks(user_id)
        return jsonify({'tasks': tasks})
