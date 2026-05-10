import os
from flask import Blueprint, Flask, jsonify
from backend.data_access_v2 import data_access_2 as data_access
from backend.auth import resolve_user_id
from backend.controllers import forms, metadata, tasks

BASE_DIR     = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
data_access.register(app)

v2 = Blueprint('v2', __name__)


def _require_user():
    user_id = resolve_user_id()
    if user_id is None:
        return None, (jsonify(error='unauthorized'), 401)
    return user_id, None


forms.register(v2, _require_user)
metadata.register(v2, _require_user)
tasks.register(v2, _require_user)

app.register_blueprint(v2)


@app.route('/')
def index():
    return app.send_static_file('index.html')
