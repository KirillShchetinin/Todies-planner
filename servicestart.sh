#!/usr/bin/env bash
# Reload the gunicorn server, or start it if it is not running.
set -euo pipefail

cd "$(dirname "$0")"

ARGS='--bind 0.0.0.0:5000 --workers 2 --threads 4 server:app'
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

workers() { pgrep -P "$1" | sort | tr '\n' ' '; }

start() {
    nohup venv/bin/gunicorn $ARGS >> "$LOG" 2>&1 &
    sleep 1
    master=$(find_master)
}

master=$(find_master)

if [ -z "$master" ]; then
    echo "not running, starting"
    start
elif ! grep -q -- "$ARGS" <(tr '\0' ' ' < "/proc/$master/cmdline"); then
    # SIGHUP reloads the code but never the command line, so workers/threads
    # would stay as they are. Changed flags need a full restart.
    echo "flags differ from $ARGS, restarting (master $master)"
    # Only ever signal the master and its own children: matching on the
    # command line would also hit an unrelated process that happens to
    # mention it, a passing grep included.
    kids=$(workers "$master")
    kill "$master"
    for _ in $(seq 20); do
        kill -0 "$master" 2>/dev/null || break
        sleep 0.5
    done
    if kill -0 "$master" 2>/dev/null; then
        echo "did not exit in 10s, forcing"
        kill -9 "$master" $kids 2>/dev/null || true
        sleep 1
    fi
    start
else
    # Same flags, so a graceful reload is enough: the master keeps the
    # listening socket while it swaps in workers running the new code.
    echo "reloading (master $master)"
    before=$(workers "$master")
    kill -HUP "$master"
    # Old workers finish their in-flight requests before exiting, so wait for
    # every one of them to go rather than for the first new worker to appear.
    for _ in $(seq 20); do
        after=" $(workers "$master")"
        stale=0
        for old in $before; do
            case "$after" in *" $old "*) stale=1 ;; esac
        done
        [ "$stale" = 0 ] && [ -n "${after// /}" ] && break
        sleep 0.5
    done
fi

if [ -z "$master" ] || [ -z "$(workers "$master")" ]; then
    echo "failed, last lines of $LOG:"
    tail -n 20 "$LOG"
    exit 1
fi

echo "running:"
pgrep -af "$PATTERN"
