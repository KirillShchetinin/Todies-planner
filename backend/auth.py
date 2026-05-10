from flask import request
from backend.data_access_v2 import data_access_2 as data_access


def resolve_user_id():
    token = request.args.get('token')
    return data_access.get_user_id(token) if token else None
