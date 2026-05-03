import os, threading, webbrowser
from backend.data_access import init_db, backup
from backend.controller import app

if __name__ == '__main__':
    backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups')
    backup(backup_dir)
    init_db()
    def _open():
        import time; time.sleep(0.9)
        webbrowser.open('http://localhost:5000')
    threading.Thread(target=_open, daemon=True).start()
    print('  planner  ->  http://localhost:5000')
    app.run(port=5000, debug=False)
