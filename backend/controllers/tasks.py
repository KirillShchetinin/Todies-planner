import datetime
from flask import jsonify, request
from backend.data_access import tasks as DA_tasks


def register(bp, require_user):
    @bp.route('/api/v2/tasks', methods=['GET'])
    def get_tasks():
        user_id, err = require_user()
        if err:
            return err

        form_ids = request.args.get('form_ids')
        if form_ids is not None:
            ids = [p for p in form_ids.split(',') if p.strip()]
            if not all(p.strip().lstrip('-').isdigit() for p in ids):
                return jsonify(error='form_ids must be comma-separated integers'), 400
            return jsonify({'tasks': DA_tasks.get_tasks_for_forms(user_id, ids)})

        from_arg = request.args.get('from')
        to_arg = request.args.get('to')
        if from_arg is not None or to_arg is not None:
            try:
                start = datetime.date.fromisoformat(from_arg)
                end = datetime.date.fromisoformat(to_arg)
            except (TypeError, ValueError):
                return jsonify(error='from and to must be YYYY-MM-DD dates'), 400
            if start > end:
                return jsonify(error='from must be on or before to'), 400
            return jsonify({'tasks': DA_tasks.get_tasks_in_range(user_id, start, end)})

        return jsonify({'tasks': DA_tasks.get_tasks(user_id)})

    @bp.route('/api/v2/tasks', methods=['POST'])
    def create_task():
        user_id, err = require_user()
        if err:
            return err
        body = request.get_json(silent=True) or {}
        task_id, error = DA_tasks.create_task(user_id, body)
        if error == 'form_id required':
            return jsonify(error=error), 400
        if error == 'form not found':
            return jsonify(error=error), 404
        return jsonify({'id': task_id}), 201

    @bp.route('/api/v2/tasks/<int:task_id>', methods=['PUT'])
    def update_task(task_id):
        user_id, err = require_user()
        if err:
            return err
        body = request.get_json(silent=True) or {}
        if not DA_tasks.update_task(user_id, task_id, body):
            return jsonify(error='task not found'), 404
        return '', 204

    @bp.route('/api/v2/tasks/<int:task_id>', methods=['DELETE'])
    def delete_task(task_id):
        user_id, err = require_user()
        if err:
            return err
        if not DA_tasks.delete_task(user_id, task_id):
            return jsonify(error='task not found'), 404
        return '', 204
