from flask import jsonify, request
from backend.data_access_v2 import data_access_2 as DA_2


def register(bp, require_user):
    @bp.route('/api/v2/metadata', methods=['GET'])
    def get_metadata():
        user_id, err = require_user()
        if err:
            return err
        meta = DA_2.get_metadata(user_id)
        if meta is None:
            return jsonify(error='user not found'), 404
        return jsonify(meta)

    @bp.route('/api/v2/metadata', methods=['PUT'])
    def update_metadata():
        user_id, err = require_user()
        if err:
            return err
        body = request.get_json(silent=True)
        if body is None:
            return jsonify(error='invalid JSON body'), 400
        found = DA_2.update_metadata(user_id, body)
        if not found:
            return jsonify(error='user not found'), 404
        return '', 204
