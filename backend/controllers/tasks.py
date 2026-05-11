from flask import jsonify, request
from backend.data_access import tasks as DA_tasks


def register(bp, require_user):
    @bp.route('/api/v2/tasks', methods=['GET'])
    def get_tasks():
        user_id, err = require_user()
        if err:
            return err
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
