"""Flask server for end-to-end tests.

Same app as server.py, but pointed at a throwaway DB (TODIES_DB_PATH) and
without the backup thread or browser auto-open. Started by Playwright's
`webServer` config; the DB file is recreated on every run.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

DB_PATH = os.environ.get('TODIES_DB_PATH') or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '.tmp', 'e2e.db')
os.environ['TODIES_DB_PATH'] = DB_PATH
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
for suffix in ('', '-wal', '-shm'):
    try:
        os.remove(DB_PATH + suffix)
    except OSError:
        pass

from backend.data_access.db_mgmt import init_db          # noqa: E402
from backend.controllers.controller import app           # noqa: E402

init_db()

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('E2E_PORT', 5055)),
            debug=False, threaded=True)
