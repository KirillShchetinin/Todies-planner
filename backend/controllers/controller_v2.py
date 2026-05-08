from flask import Blueprint, jsonify
from backend.auth import resolve_user_id
from backend.controllers import forms, metadata, tasks

v2 = Blueprint('v2', __name__)


def _require_user():
    user_id = resolve_user_id()
    if user_id is None:
        return None, (jsonify(error='unauthorized'), 401)
    return user_id, None


forms.register(v2, _require_user)
metadata.register(v2, _require_user)
tasks.register(v2, _require_user)
