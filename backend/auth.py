from flask import request
from backend import data_access


def resolve_user_id():
    token = request.args.get('token')
    return data_access.get_user_id(token) if token else None
