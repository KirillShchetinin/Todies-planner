#!/usr/bin/env bash
# Restart the gunicorn server, or start it if it is not running.
set -euo pipefail

cd "$(dirname "$0")"

PATTERN='gunicorn --bind 0.0.0.0:5000'
LOG=gunicorn.log

# The master is the matching process whose parent is not itself a match.
# Killing a worker instead is a no-op: the master just forks a replacement.
find_master() {
    local pids pid ppid
    pids=$(pgrep -f "$PATTERN" || true)
    for pid in $pids; do
        ppid=$(ps -o ppid= -p "$pid" | tr -d ' ')
        if ! grep -qw "$ppid" <<<"$pids"; then
            echo "$pid"
            return
        fi
    done
}

master=$(find_master)
if [ -n "$master" ]; then
    echo "stopping gunicorn (master $master)"
    kill "$master"
    for _ in $(seq 20); do
        pgrep -f "$PATTERN" >/dev/null || break
        sleep 0.5
    done
    if pgrep -f "$PATTERN" >/dev/null; then
        echo "did not exit in 10s, forcing"
        pkill -9 -f "$PATTERN" || true
        sleep 1
    fi
else
    echo "not running"
fi

nohup venv/bin/gunicorn --bind 0.0.0.0:5000 --workers 2 --threads 4 server:app >> "$LOG" 2>&1 &
sleep 1

if [ -z "$(find_master)" ]; then
    echo "failed to start, last lines of $LOG:"
    tail -n 20 "$LOG"
    exit 1
fi

echo "running:"
pgrep -af "$PATTERN"
