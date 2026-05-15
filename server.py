import os, threading, webbrowser
from backend.data_access.data_access import backup, init_db
from backend.controllers.controller import app

backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups')
backup(backup_dir)
init_db()

if __name__ == '__main__':
    def _open():
        import time; time.sleep(0.9)
        webbrowser.open('http://localhost:5000')
    threading.Thread(target=_open, daemon=True).start()
    print('  planner  ->  http://localhost:5000')
    app.run(host='0.0.0.0', port=5000, debug=False)
