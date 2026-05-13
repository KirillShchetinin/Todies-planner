import os
from flask import Blueprint, Flask, jsonify
from backend.data_access import data_access
from backend.auth import resolve_user_id
from backend.controllers import forms, metadata, tasks

BASE_DIR     = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
data_access.register(app)

bp = Blueprint('api', __name__)


def _require_user():
    user_id = resolve_user_id()
    if user_id is None:
        return None, (jsonify(error='unauthorized'), 401)
    return user_id, None


forms.register(bp, _require_user)
metadata.register(bp, _require_user)
tasks.register(bp, _require_user)


app.register_blueprint(bp)


@app.route('/api/account', methods=['POST'])
def create_account():
    token = data_access.create_user()
    return jsonify(token=token), 201


@app.route('/api/account', methods=['DELETE'])
def delete_account():
    from flask import request
    token = request.args.get('token')
    if not token:
        return jsonify(error='token required'), 400
    if not data_access.delete_user(token):
        return jsonify(error='not found'), 404
    return '', 204


@app.route('/')
def index():
    return app.send_static_file('index.html')
