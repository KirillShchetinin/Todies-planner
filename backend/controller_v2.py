from flask import Blueprint, jsonify, request
from backend import data_access_2 as DA_2
from backend.auth import resolve_user_id

v2 = Blueprint('v2', __name__)


def _require_user():
    user_id = resolve_user_id()
    if user_id is None:
        return None, (jsonify(error='unauthorized'), 401)
    return user_id, None


@v2.route('/api/v2/forms', methods=['GET'])
def get_forms():
    user_id, err = _require_user()
    if err:
        return err
    forms = DA_2.get_forms(user_id)
    return jsonify({
        'cols': [
            {'id': f['client_id'], 'label': f['label'], 'date': f['date']}
            for f in forms if not f['is_unscheduled']
        ],
        'weekUnscheduled': [
            {'id': f['client_id'], 'label': f['label']}
            for f in forms if f['is_unscheduled']
        ],
    })


@v2.route('/api/v2/forms', methods=['POST'])
def create_form():
    user_id, err = _require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    if not body.get('client_id'):
        return jsonify(error='client_id required'), 400
    DA_2.create_form(user_id, body)
    return '', 201


@v2.route('/api/v2/forms/<client_id>', methods=['PUT'])
def update_form(client_id):
    user_id, err = _require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    found = DA_2.update_form(user_id, client_id, body)
    if not found:
        return jsonify(error='form not found'), 404
    return '', 204


@v2.route('/api/v2/forms/<client_id>', methods=['DELETE'])
def delete_form(client_id):
    user_id, err = _require_user()
    if err:
        return err
    found = DA_2.delete_form(user_id, client_id)
    if not found:
        return jsonify(error='form not found'), 404
    return '', 204


@v2.route('/api/v2/metadata', methods=['PUT'])
def update_metadata():
    user_id, err = _require_user()
    if err:
        return err
    body = request.get_json(silent=True)
    if body is None:
        return jsonify(error='invalid JSON body'), 400
    found = DA_2.update_metadata(user_id, body)
    if not found:
        return jsonify(error='user not found'), 404
    return '', 204
