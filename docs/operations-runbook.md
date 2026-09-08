# Operations Runbook

Operational reference for the Todies planner deployment. Covers where it runs,
how to deploy new code, how to restart, and how backups actually behave.

## Hosting

- **Host:** Azure VM (`openclaw-vm`), user `azureuser`.
- **App directory:** `/home/azureuser/Todoies/Todies-planner`
- **Virtualenv:** `/home/azureuser/Todoies/Todies-planner/venv`
- **Server:** gunicorn, bound to `0.0.0.0:5000`, 1 worker, app target `server:app`.

Full start command (as observed in `ps aux`):

```bash
/home/azureuser/Todoies/Todies-planner/venv/bin/gunicorn \
  --bind 0.0.0.0:5000 --workers 1 server:app
```

## Identifying the running process

```bash
ps aux | grep gunicorn        # find master + workers
sudo ss -ltnp | grep :5000    # confirm what is listening on 5000
```

There are two gunicorn processes: the **master** (the older, long-lived parent)
and its **worker** (the child, `--workers 1`). The master is the one you send
signals to. Identify it as the gunicorn process that has been running longest /
whose parent is `init`.

## Deploy new code + restart

1. Pull:
   ```bash
   cd /home/azureuser/Todoies/Todies-planner
   git pull
   ```
2. Graceful reload — tell the gunicorn **master** to restart its workers, which
   re-import `server:app` with the new code (no downtime, master stays up):
   ```bash
   kill -HUP <master-pid>
   ```
3. Verify — the worker PID should change and be timestamped "now":
   ```bash
   ps aux | grep gunicorn
   ```
4. Start the new commit's stability clock (see
   [Rolling back a bad deploy](#rolling-back-a-bad-deploy)) — this is the only
   thing that records the deploy, so skipping it silently postpones promotion:
   ```bash
   python3 rollback.py status
   ```

### Notes / gotchas

- **Do not rely on `pkill -f server.py`** — the process runs as `gunicorn
  server:app`, so its command line is `gunicorn`, not `server.py`. `pkill -f
  server.py` matches nothing.
- **If a systemd service exists**, prefer it over manual signals:
  ```bash
  systemctl status                       # discover the unit
  sudo systemctl restart <service-name>
  ```
  A `kill -HUP` on the master is safe alongside systemd because the master stays
  alive (systemd sees no exit). A full `kill` of the master under systemd will
  trigger an automatic restart.
- **Hard restart** (if `HUP` doesn't pick up changes): `kill <master-pid>` then
  rerun the gunicorn start command above, or `systemctl restart` if a unit
  exists.

## Backups — current behavior (important)

Backups are **not** on a timer. `backup()` runs only when `server.py` is
imported at process start (`server.py:6`), which for gunicorn means **whenever a
worker boots**:

- On restart / reload (`HUP`), or when gunicorn recycles/respawns a worker, the
  new worker re-imports `server.py` → one backup is written.
- `backup()` copies `planner_db.db` to `backups/planner_db_backup_<timestamp>.db`
  (`backend/data_access/connections.py:67`).
- `_prune_old_backups()` deletes any backup older than **3 days**
  (`connections.py:79`), so only ~3 days of history is ever retained.

**Consequence:** backup cadence == worker-restart cadence, which is incidental,
not scheduled. If the server stays up for several days without a worker
restart, backups silently stop and older ones age out — leaving no backup at
all. Recent backups seen on the VM are the byproduct of workers being
respawned, not of a scheduled job.

**Also:** `backup()` uses `shutil.copy2` on a live WAL database. At startup this
is safe (no traffic yet). It is **not** safe to call on a running server as-is —
a WAL-safe backup would need SQLite's backup API (`sqlite3 planner_db.db
".backup ..."`) instead.

### Manual on-demand backup (WAL-safe)

```bash
cd /home/azureuser/Todoies/Todies-planner
sqlite3 planner_db.db ".backup backups/planner_db_backup_$(date +%Y%m%d_%H%M%S).db"
```

### TODO / open item

Add a real periodic backup (in-app background thread using SQLite's `.backup`,
or an external cron) so backup cadence no longer depends on incidental worker
restarts.

## Rolling back a bad deploy

`rollback.py` (repo root, python3, stdlib only) tracks the last known-good
commit and puts the checkout back on it.

```bash
cd /home/azureuser/Todoies/Todies-planner
python3 rollback.py           # roll back to stable + restart
python3 rollback.py status    # report, and promote HEAD once it has earned it
```

A rollback checkpoints the current HEAD, checks out the stable commit
**detached**, and runs `./servicestart.sh`. It never rewrites history —
`master` still points at the bad commit, so the fix is normal git work. It
refuses when tracked files have uncommitted changes, and is a no-op when HEAD
is already stable. Untracked files do not count — the production checkout
always has some (`venv/`, and SQLite's `planner_db.db-wal`/`-shm`, which
`.gitignore`'s `*.db` does not cover) and a checkout never touches them.

State is three git ref namespaces, so `git pull` and checkouts leave it alone
and nothing needs gitignoring:

| Ref | Meaning |
|---|---|
| `refs/rollback/stable` | the rollback target |
| `refs/rollback/checkpoint/<UTC ts>` | HEAD at each rollback — the rollback log |
| `refs/rollback/deployed/<UTC ts>` | when the current commit started serving |

Inspect them with `git for-each-ref refs/rollback`.

**Promotion.** The clock is **time spent running in production**, not the
commit's own date — a commit written a month ago and deployed today has proved
nothing. `status` records when HEAD started serving (one deploy ref at a time),
and promotes HEAD to stable once it is a descendant of stable and has held that
record for 7 days. A rollback deletes the record, so a commit that was rolled
back starts its week over if you ever redeploy it.

That clock only advances when the script runs, so **run `python3 rollback.py
status` as the last step of every deploy** — that is what starts the new
commit's week.

### Notes / gotchas

- After a rollback the checkout is on a **detached HEAD**. `git pull` will not
  work until you `git checkout master`.
- A commit only becomes stable if `status` was run when it was deployed **and**
  run again a week later. Skip the deploy-time run and the clock does not start
  until the next `status`, whenever that is — which then reports a fresh
  `eligible in 7 days`, exactly as it would for a commit deployed a minute ago.
  Nothing in the output distinguishes the two, which is why the deploy-time run
  is the step that matters.
- `servicestart.sh` is a stop/start (~1s downtime), not the graceful `HUP`
  reload used for normal deploys. That is deliberate: a rollback happens when
  the app is already broken. Use `--no-restart` to skip it.
