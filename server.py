import os, threading, time, webbrowser
from backend.data_access.db_mgmt import backup, init_db, run_backup_loop
from backend.controllers.controller import app

backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups')
backup(backup_dir)

if __name__ == '__main__':
    def _open():
        time.sleep(0.9)
        webbrowser.open('http://localhost:5000')
    threading.Thread(target=_open, daemon=True).start()

    threading.Thread(target=init_db, args = (), daemon=True).start()
    threading.Thread(target=run_backup_loop, args=(backup_dir,), daemon=True).start()

    print('  planner  ->  http://localhost:5000')
    app.run(host='0.0.0.0', port=5000, debug=False)
