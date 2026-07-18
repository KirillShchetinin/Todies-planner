import re
from flask import jsonify, request
from backend.data_access import data_access as DA
from backend.date_utils import is_valid_form_date

_INT_RE = re.compile(r'-?\d+')
_MAX_LATEST = 999999999  # datetime.timedelta.max.days; larger overflows in get_recent_forms
RECENT_DAYS = 14


def register(bp, require_user):
    @bp.route('/api/v2/forms', methods=['GET'])
    def get_forms():
        user_id, err = require_user()
        if err:
            return err
        latest_arg = request.args.get('latest')
        mark_recent = 'mark_recent' in request.args and latest_arg is None
        if latest_arg is not None:
            if not _INT_RE.fullmatch(latest_arg) or not 0 <= int(latest_arg) <= _MAX_LATEST:
                return jsonify(error='latest must be a non-negative integer'), 400
            cols, unscheduled = DA.get_recent_forms(user_id, int(latest_arg))
        else:
            forms = DA.get_forms(user_id)
            cols = [f for f in forms if not f['is_unscheduled']]
            unscheduled = [f for f in forms if f['is_unscheduled']]

        recent_ids = set()
        if mark_recent:
            recent_cols, _ = DA.get_recent_forms(user_id, RECENT_DAYS)
            recent_ids = {f['id'] for f in recent_cols}

        col_entries = []
        for f in cols:
            entry = {'id': f['id'], 'label': f['label'], 'date': f['date']}
            if mark_recent:
                entry['recent'] = f['id'] in recent_ids
            col_entries.append(entry)

        return jsonify({
            'cols': col_entries,
            'weekUnscheduled': [
                {'id': f['id'], 'label': f['label']} for f in unscheduled
            ],
        })

    @bp.route('/api/v2/forms', methods=['POST'])
    def create_form():
        user_id, err = require_user()
        if err:
            return err
        body = request.get_json(silent=True) or {}
        if not is_valid_form_date(body.get('date', '')):
            return jsonify(error='date must be MM/DD or MM/DD/YYYY'), 400
        db_id = DA.create_form(user_id, body)
        return jsonify({'id': db_id}), 201

    @bp.route('/api/v2/forms/<int:form_id>', methods=['DELETE'])
    def delete_form(form_id):
        user_id, err = require_user()
        if err:
            return err
        tasks = DA.get_tasks_by_form(user_id, form_id)
        if tasks:
            return jsonify(error='form has tasks'), 409
        if not DA.delete_form(user_id, form_id):
            return jsonify(error='form not found'), 404
        return '', 204
