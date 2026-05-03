import os
from flask import Flask, jsonify, request
from backend import data_access
from backend.auth import resolve_user_id

BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
data_access.register(app)


@app.route('/api/state', methods=['GET'])
def get_state():
    user_id = resolve_user_id()
    state   = data_access.get_state(user_id)
    app.logger.debug('GET /api/state user_id=%r found=%s', user_id, state is not None)
    return jsonify(state)


@app.route('/api/state', methods=['PUT'])
def set_state():
    user_id = resolve_user_id()
    state   = request.get_json(silent=True)
    if state is None:
        return jsonify(error='invalid JSON body'), 400
    data_access.set_state(user_id, state)
    app.logger.debug('PUT /api/state user_id=%r', user_id)
    return '', 204


@app.route('/')
def index():
    return app.send_static_file('index.html')
