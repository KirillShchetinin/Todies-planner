import os
from flask import Flask, request, send_from_directory
from backend import data_access

BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

app = Flask(__name__)


@app.route('/api/state', methods=['GET'])
def get_state():
    token = request.args.get('token')
    print(f'[DEBUG] token={token!r}')
    data = data_access.get_state(token)
    print(f'[DEBUG] row found={data is not None}')
    if data:
        return data, 200, {'Content-Type': 'application/json'}
    return 'null', 200, {'Content-Type': 'application/json'}


@app.route('/api/state', methods=['PUT'])
def set_state():
    token = request.args.get('token')
    data  = request.get_data(as_text=True)
    data_access.set_state(token, data)
    return '', 204


@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)
