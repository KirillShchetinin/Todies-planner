import os, threading, webbrowser
from backend.data_access import init_db, DB_PATH
from backend.controller import app

if __name__ == '__main__':
    if os.path.exists(DB_PATH):
        import shutil, datetime
        backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups')
        os.makedirs(backup_dir, exist_ok=True)
        ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        shutil.copy2(DB_PATH, os.path.join(backup_dir, f'planner_backup_{ts}.db'))
    init_db()
    def _open():
        import time; time.sleep(0.9)
        webbrowser.open('http://localhost:5000')
    threading.Thread(target=_open, daemon=True).start()
    print('  planner  ->  http://localhost:5000')
    app.run(port=5000, debug=False)
