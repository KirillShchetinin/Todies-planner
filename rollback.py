#!/usr/bin/env python3
"""
Rollback the production checkout to the last known-good commit.

State lives in three git ref namespaces, so there is nothing to gitignore and
nothing a checkout can clobber:

    refs/rollback/stable                 the last known-good commit
    refs/rollback/checkpoint/<UTC ts>    HEAD at the moment of each rollback
    refs/rollback/deployed/<UTC ts>      when the current commit started serving

The checkpoint refs double as the rollback log: the name is when, the value is
what we rolled away from.

    rollback.py status     report, and promote HEAD to stable once it has been
                           deployed STABLE_AFTER_DAYS without a rollback
    rollback.py            checkpoint HEAD, check out stable detached, restart

A rollback never rewrites history -- it detaches. `master` is untouched, and
you come back with `git checkout master`.
"""
import argparse
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

STABLE_REF = 'refs/rollback/stable'
CHECKPOINT_PREFIX = 'refs/rollback/checkpoint'
DEPLOY_PREFIX = 'refs/rollback/deployed'
STAMP_FORMAT = '%Y%m%dT%H%M%S.%fZ'
STABLE_AFTER_DAYS = 7
RESTART_SCRIPT = 'servicestart.sh'

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))


class RollbackError(Exception):
    """A refusal we can explain to the operator."""


# ── git plumbing ──────────────────────────────────────────────────────────

def git(repo, *args, check=True):
    """Run a git command in `repo` and return its stripped stdout."""
    proc = subprocess.run(
        ['git', '-C', repo] + list(args),
        capture_output=True, text=True,
    )
    if check and proc.returncode != 0:
        raise RollbackError(
            'git %s failed: %s' % (' '.join(args), proc.stderr.strip()))
    return proc.stdout.strip()


def read_ref(repo, ref):
    """Commit a ref points at, or None if the ref does not exist."""
    proc = subprocess.run(
        ['git', '-C', repo, 'rev-parse', '--verify', '--quiet', ref],
        capture_output=True, text=True,
    )
    return proc.stdout.strip() or None


def subject(repo, sha):
    return git(repo, 'show', '-s', '--format=%s', sha)


def head_sha(repo):
    return git(repo, 'rev-parse', 'HEAD')


def is_detached(repo):
    proc = subprocess.run(
        ['git', '-C', repo, 'symbolic-ref', '--quiet', 'HEAD'],
        capture_output=True, text=True,
    )
    return proc.returncode != 0


def is_dirty(repo):
    # Tracked changes only. The production checkout permanently carries
    # untracked files -- the venv sits in the repo root and SQLite's WAL mode
    # leaves planner_db.db-wal/-shm behind -- and a checkout never touches
    # them, so counting them here would refuse every real rollback.
    return bool(git(repo, 'status', '--porcelain', '--untracked-files=no'))


def is_ancestor(repo, ancestor, descendant):
    proc = subprocess.run(
        ['git', '-C', repo, 'merge-base', '--is-ancestor', ancestor, descendant],
        capture_output=True, text=True,
    )
    return proc.returncode == 0


def _stamped_refs(repo, prefix):
    """[(timestamp, sha, refname)] under a `<prefix>/<UTC stamp>`, oldest first."""
    out = git(repo, 'for-each-ref', '--format=%(refname) %(objectname)',
              prefix + '/')
    found = []
    for line in out.splitlines():
        ref, sha = line.split(' ', 1)
        stamp = ref[len(prefix) + 1:]
        try:
            when = datetime.strptime(stamp, STAMP_FORMAT).replace(
                tzinfo=timezone.utc)
        except ValueError:
            continue  # hand-made ref, not ours to interpret
        found.append((when, sha, ref))
    return sorted(found)


def checkpoints(repo):
    """[(timestamp, sha)] of every recorded rollback, oldest first."""
    return [(when, sha) for when, sha, _ref in _stamped_refs(repo, CHECKPOINT_PREFIX)]


def write_stamped_ref(repo, prefix, sha, now=None):
    now = now or datetime.now(timezone.utc)
    git(repo, 'update-ref',
        '%s/%s' % (prefix, now.strftime(STAMP_FORMAT)), sha)


# ── the deploy clock ──────────────────────────────────────────────────────
#
# Stability is measured by time spent *running in production*, not by the
# commit's own date -- a commit written a month ago and deployed today has
# proved nothing. So we record when a commit started being served, and clock
# from that. Exactly one deploy ref exists at a time.

def deploy_record(repo):
    """(timestamp, sha) of the commit currently recorded as deployed, or None."""
    records = _stamped_refs(repo, DEPLOY_PREFIX)
    if not records:
        return None
    when, sha, _ref = records[-1]
    return when, sha


def clear_deploy_record(repo):
    # Delete by the name git reported, never by one rebuilt from the parsed
    # stamp: a hand-made ref can parse but not round-trip, and `update-ref -d`
    # exits 0 on a name that does not exist, so the miss would be silent.
    for _when, _sha, ref in _stamped_refs(repo, DEPLOY_PREFIX):
        git(repo, 'update-ref', '-d', ref)


def note_deploy(repo, now=None):
    """
    Start HEAD's clock if it is not the commit we already have recorded.

    Skipped while detached: a detached HEAD is a rollback in progress, and the
    stable commit it is serving is not a promotion candidate.
    """
    if is_detached(repo):
        return None
    head = head_sha(repo)
    record = deploy_record(repo)
    if record and record[1] == head:
        return record
    clear_deploy_record(repo)
    write_stamped_ref(repo, DEPLOY_PREFIX, head, now)
    return deploy_record(repo)


# ── promotion ─────────────────────────────────────────────────────────────

def promotion_check(repo, now=None):
    """
    Decide whether HEAD should become the new stable commit.

    Returns (should_promote, reason). HEAD qualifies once it has been the
    deployed commit for STABLE_AFTER_DAYS. A rollback clears the record, so
    re-deploying a commit that was rolled back starts its week over.
    """
    now = now or datetime.now(timezone.utc)
    stable = read_ref(repo, STABLE_REF)
    head = head_sha(repo)

    if stable is None:
        return False, 'no stable commit recorded yet'
    if is_detached(repo):
        return False, 'HEAD is detached (rolled back) -- nothing to promote'
    if head == stable:
        return False, 'HEAD is already stable'
    if not is_ancestor(repo, stable, head):
        return False, 'HEAD is not a descendant of stable -- history diverged'

    record = deploy_record(repo)
    if record is None or record[1] != head:
        return False, 'HEAD has no deploy record yet -- its clock starts now'

    since, _sha = record
    due = since + timedelta(days=STABLE_AFTER_DAYS)
    if now < due:
        return False, 'HEAD is eligible in %s' % _humanize(due - now, up=True)

    return True, 'HEAD has been deployed %s' % _humanize(now - since)


def _humanize(delta, up=False):
    """Whole days, or hours under a day. `up` rounds up, for countdowns."""
    hours = int(delta.total_seconds() // 3600)
    if hours >= 24:
        days = (hours + 23) // 24 if up else hours // 24
        return '%d day%s' % (days, '' if days == 1 else 's')
    return '%d hour%s' % (hours, '' if hours == 1 else 's')


# ── commands ──────────────────────────────────────────────────────────────

def cmd_status(repo):
    stable = read_ref(repo, STABLE_REF)
    head = head_sha(repo)

    note_deploy(repo)

    if stable is None:
        git(repo, 'update-ref', STABLE_REF, head)
        print('bootstrapped stable at %s %s' % (head[:9], subject(repo, head)))
        stable = head
    else:
        promote, reason = promotion_check(repo)
        if promote:
            git(repo, 'update-ref', STABLE_REF, head)
            print('promoted %s to stable -- %s' % (head[:9], reason))
            stable = head
        else:
            print('not promoting: %s' % reason)

    print()
    print('stable  %s  %s' % (stable[:9], subject(repo, stable)))
    print('HEAD    %s  %s%s' % (
        head[:9], subject(repo, head),
        '  (detached)' if is_detached(repo) else ''))

    history = checkpoints(repo)
    if history:
        print()
        print('rollbacks:')
        for when, sha in history[-5:]:
            print('  %s  from %s  %s' % (
                when.strftime('%Y-%m-%d %H:%M'), sha[:9], subject(repo, sha)))

    if is_detached(repo):
        print()
        print('rolled back. to return: git checkout master')
    return 0


def cmd_rollback(repo, restart=True):
    stable = read_ref(repo, STABLE_REF)
    if stable is None:
        raise RollbackError(
            'no stable commit recorded -- run "rollback.py status" first')

    head = head_sha(repo)
    if head == stable:
        print('already on stable %s -- nothing to roll back' % stable[:9])
        return 0
    if is_dirty(repo):
        raise RollbackError(
            'working tree is dirty -- commit or stash before rolling back')

    # Checkpoint first: the bad commit must be recoverable before anything moves.
    write_stamped_ref(repo, CHECKPOINT_PREFIX, head)
    print('checkpointed %s %s' % (head[:9], subject(repo, head)))

    git(repo, 'checkout', '--detach', stable)
    print('rolled back to %s %s' % (stable[:9], subject(repo, stable)))

    # This commit did not survive, so it does not get to keep the time it
    # served. Re-deploying it starts a fresh week. Only once the checkout has
    # actually succeeded: a refused checkout leaves the commit still deployed,
    # and it must keep the clock it has already earned.
    clear_deploy_record(repo)

    script = os.path.join(repo, RESTART_SCRIPT)
    if restart and os.path.exists(script):
        print('restarting via ./%s' % RESTART_SCRIPT)
        proc = subprocess.run(['bash', script], cwd=repo)
        if proc.returncode != 0:
            raise RollbackError('%s failed with exit %d -- the checkout is '
                                'rolled back but the server is not running'
                                % (RESTART_SCRIPT, proc.returncode))
    else:
        print('skipping restart (--no-restart or %s absent)' % RESTART_SCRIPT)

    print()
    print('to return once fixed: git checkout master && git pull')
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(
        description='Roll the checkout back to the last known-good commit.')
    parser.add_argument('command', nargs='?', default='rollback',
                        choices=['rollback', 'status'],
                        help='"rollback" (default) or "status"')
    parser.add_argument('--no-restart', action='store_true',
                        help='do not run %s after rolling back' % RESTART_SCRIPT)
    parser.add_argument('--repo', default=REPO_ROOT,
                        help='repository to act on (default: this script\'s)')
    args = parser.parse_args(argv)

    try:
        if args.command == 'status':
            return cmd_status(args.repo)
        return cmd_rollback(args.repo, restart=not args.no_restart)
    except RollbackError as exc:
        print('rollback: %s' % exc, file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
