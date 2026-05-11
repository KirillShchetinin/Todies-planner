import os, threading, webbrowser
from backend.data_access_v2.data_access_2 import backup
from backend.controllers.controller_v2 import app

if __name__ == '__main__':
    backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups')
    backup(backup_dir)
    def _open():
        import time; time.sleep(0.9)
        webbrowser.open('http://localhost:5000')
    threading.Thread(target=_open, daemon=True).start()
    print('  planner  ->  http://localhost:5000')
    app.run(port=5000, debug=False)
