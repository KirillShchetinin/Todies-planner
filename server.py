import os, sqlite3, threading, webbrowser
from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, 'planner.db')
app      = Flask(__name__)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS planner_state (
            id   INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT    NOT NULL
        )
    ''')
    conn.commit()
    conn.close()


@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


@app.route('/api/state', methods=['GET'])
def get_state():
    conn = get_db()
    row  = conn.execute('SELECT data FROM planner_state WHERE id=1').fetchone()
    conn.close()
    if row:
        return row['data'], 200, {'Content-Type': 'application/json'}
    return 'null', 200, {'Content-Type': 'application/json'}


@app.route('/api/state', methods=['PUT'])
def set_state():
    data = request.get_data(as_text=True)
    conn = get_db()
    conn.execute(
        'INSERT OR REPLACE INTO planner_state (id, data) VALUES (1, ?)',
        (data,),
    )
    conn.commit()
    conn.close()
    return '', 204


if __name__ == '__main__':
    # backup DB on every startup
    if os.path.exists(DB_PATH):
        import shutil, datetime
        ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        shutil.copy2(DB_PATH, os.path.join(BASE_DIR, f'planner_backup_{ts}.db'))
    init_db()
    def _open():
        import time; time.sleep(0.9)
        webbrowser.open('http://localhost:5000')
    threading.Thread(target=_open, daemon=True).start()
    print('  planner  ->  http://localhost:5000')
    app.run(port=5000, debug=False)
