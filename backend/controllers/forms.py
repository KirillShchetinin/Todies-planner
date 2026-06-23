from flask import jsonify, request
from backend.data_access import data_access as DA


def register(bp, require_user):
    @bp.route('/api/v2/forms', methods=['GET'])
    def get_forms():
        user_id, err = require_user()
        if err:
            return err
        latest_arg = request.args.get('latest')
        if latest_arg is not None:
            if not latest_arg.lstrip('-').isdigit() or int(latest_arg) < 0:
                return jsonify(error='latest must be a non-negative integer'), 400
            cols, unscheduled = DA.get_recent_forms(user_id, int(latest_arg))
        else:
            forms = DA.get_forms(user_id)
            cols = [f for f in forms if not f['is_unscheduled']]
            unscheduled = [f for f in forms if f['is_unscheduled']]
        return jsonify({
            'cols': [
                {'id': f['id'], 'label': f['label'], 'date': f['date']}
                for f in cols
            ],
            'weekUnscheduled': [
                {'id': f['id'], 'label': f['label']} for f in unscheduled
            ],
        })

    @bp.route('/api/v2/forms', methods=['POST'])
    def create_form():
        user_id, err = require_user()
        if err:
            return err
        body = request.get_json(silent=True) or {}
        db_id = DA.create_form(user_id, body)
        return jsonify({'id': db_id}), 201

    @bp.route('/api/v2/forms/<int:form_id>', methods=['DELETE'])
    def delete_form(form_id):
        user_id, err = require_user()
        if err:
            return err
        tasks = DA.get_tasks_by_form(user_id, form_id)
        if tasks:
            return jsonify(error='form has tasks'), 409
        if not DA.delete_form(user_id, form_id):
            return jsonify(error='form not found'), 404
        return '', 204
