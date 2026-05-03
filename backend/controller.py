import os
from flask import Flask, request, send_from_directory
from backend import data_access

BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

app = Flask(__name__)


@app.route('/api/state', methods=['GET'])
def get_state():
    token   = request.args.get('token')
    user_id = data_access.get_user_id(token) if token else None
    print(f'[DEBUG] token={token!r} user_id={user_id!r}')
    data = data_access.get_state(user_id)
    print(f'[DEBUG] row found={data is not None}')
    if data:
        return data, 200, {'Content-Type': 'application/json'}
    return 'null', 200, {'Content-Type': 'application/json'}


@app.route('/api/state', methods=['PUT'])
def set_state():
    token   = request.args.get('token')
    data    = request.get_data(as_text=True)
    user_id = data_access.get_user_id(token) if token else None
    data_access.set_state(user_id, data)
    return '', 204


@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)
