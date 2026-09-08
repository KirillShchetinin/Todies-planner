"""
Tests for rollback.py.

Each test builds a throwaway git repo in tmp_path and drives the script's
functions against it. Commit dates are forced through GIT_*_DATE so the
promotion clock can be exercised without waiting a week.
"""
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

import pytest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import rollback  # noqa: E402


def _run(repo, *args, env=None):
    full = dict(os.environ)
    full.update(env or {})
    subprocess.run(['git', '-C', repo] + list(args), check=True,
                   capture_output=True, text=True, env=full)


def _commit(repo, text, days_ago=0):
    """Write a file and commit it with a committer date `days_ago` in the past."""
    when = datetime.now(timezone.utc) - timedelta(days=days_ago)
    stamp = when.strftime('%Y-%m-%dT%H:%M:%S+0000')
    with open(os.path.join(repo, 'file.txt'), 'w') as fh:
        fh.write(text + '\n')
    _run(repo, 'add', 'file.txt')
    _run(repo, 'commit', '-m', text,
         env={'GIT_AUTHOR_DATE': stamp, 'GIT_COMMITTER_DATE': stamp})
    return rollback.head_sha(repo)


def _deployed(repo, days_ago=0):
    """Record HEAD as having started serving `days_ago` days ago."""
    when = datetime.now(timezone.utc) - timedelta(days=days_ago)
    rollback.clear_deploy_record(repo)
    rollback.write_stamped_ref(repo, rollback.DEPLOY_PREFIX,
                               rollback.head_sha(repo), when)


@pytest.fixture
def repo(tmp_path):
    """A git repo with one commit, 30 days old, on master."""
    path = str(tmp_path / 'repo')
    os.makedirs(path)
    _run(path, 'init', '--quiet')
    _run(path, 'symbolic-ref', 'HEAD', 'refs/heads/master')
    _run(path, 'config', 'user.email', 'test@example.com')
    _run(path, 'config', 'user.name', 'Test')
    _commit(path, 'first', days_ago=30)
    return path


# ── promotion ─────────────────────────────────────────────────────────────

def test_status_bootstraps_stable_at_head(repo, capsys):
    assert rollback.read_ref(repo, rollback.STABLE_REF) is None

    rollback.cmd_status(repo)

    assert rollback.read_ref(repo, rollback.STABLE_REF) == rollback.head_sha(repo)
    assert 'bootstrapped stable' in capsys.readouterr().out


def test_young_head_is_not_promoted(repo):
    rollback.cmd_status(repo)              # stable = first commit
    stable = rollback.read_ref(repo, rollback.STABLE_REF)
    _commit(repo, 'second')
    _deployed(repo, days_ago=3)

    promote, reason = rollback.promotion_check(repo)

    assert promote is False
    assert 'eligible in 4 days' in reason
    assert rollback.read_ref(repo, rollback.STABLE_REF) == stable


def test_week_old_head_is_promoted(repo, capsys):
    rollback.cmd_status(repo)
    new_head = _commit(repo, 'second')
    _deployed(repo, days_ago=8)

    rollback.cmd_status(repo)

    assert rollback.read_ref(repo, rollback.STABLE_REF) == new_head
    assert 'promoted' in capsys.readouterr().out


def test_status_starts_the_clock_on_a_newly_deployed_head(repo):
    rollback.cmd_status(repo)
    head = _commit(repo, 'second')

    rollback.cmd_status(repo)

    when, sha = rollback.deploy_record(repo)
    assert sha == head
    assert (datetime.now(timezone.utc) - when) < timedelta(minutes=1)


def test_rollback_restarts_the_clock_of_the_commit_it_rejected(repo):
    """A commit that got rolled back does not keep the time it already served."""
    rollback.cmd_status(repo)
    bad = _commit(repo, 'bad')
    _deployed(repo, days_ago=6)           # nearly earned it
    rollback.cmd_rollback(repo, restart=False)

    rollback.git(repo, 'checkout', 'master')   # redeploy the same commit
    rollback.cmd_status(repo)

    when, sha = rollback.deploy_record(repo)
    assert sha == bad
    assert (datetime.now(timezone.utc) - when) < timedelta(minutes=1)
    promote, reason = rollback.promotion_check(repo)
    assert promote is False
    assert 'eligible in 7 days' in reason


def test_a_fix_older_than_the_rollback_can_still_be_promoted(repo):
    """
    The deadlock the commit-date clock had: commit a fix, roll prod back while
    it is still broken, then deploy the fix. The fix predates the rollback, but
    it has been serving for a week and must be promotable.
    """
    rollback.cmd_status(repo)
    _commit(repo, 'bad')
    rollback.cmd_rollback(repo, restart=False)          # checkpoint = now
    rollback.git(repo, 'checkout', 'master')
    fix = _commit(repo, 'fix', days_ago=20)             # authored long before
    _deployed(repo, days_ago=8)

    rollback.cmd_status(repo)

    assert rollback.read_ref(repo, rollback.STABLE_REF) == fix


def test_detached_head_is_never_promoted(repo):
    rollback.cmd_status(repo)
    _commit(repo, 'second')
    _deployed(repo, days_ago=8)
    rollback.git(repo, 'checkout', '--detach', 'HEAD')

    promote, reason = rollback.promotion_check(repo)

    assert promote is False
    assert 'detached' in reason


# ── rollback ──────────────────────────────────────────────────────────────

def test_rollback_checkpoints_and_detaches(repo):
    rollback.cmd_status(repo)
    stable = rollback.read_ref(repo, rollback.STABLE_REF)
    bad = _commit(repo, 'bad', days_ago=0)

    assert rollback.cmd_rollback(repo, restart=False) == 0

    assert rollback.head_sha(repo) == stable
    assert rollback.is_detached(repo)
    assert [sha for _when, sha in rollback.checkpoints(repo)] == [bad]
    # master is untouched -- the bad commit is still on the branch.
    assert rollback.read_ref(repo, 'refs/heads/master') == bad
    with open(os.path.join(repo, 'file.txt')) as fh:
        assert fh.read().strip() == 'first'


def test_rollback_refuses_dirty_tree(repo):
    rollback.cmd_status(repo)
    _commit(repo, 'bad', days_ago=0)
    with open(os.path.join(repo, 'file.txt'), 'w') as fh:
        fh.write('uncommitted\n')

    with pytest.raises(rollback.RollbackError, match='dirty'):
        rollback.cmd_rollback(repo, restart=False)

    assert rollback.checkpoints(repo) == []


def test_untracked_files_do_not_block_rollback(repo):
    """The production checkout always carries untracked files: the venv lives
    inside the repo root and SQLite's WAL mode leaves planner_db.db-wal/-shm
    (`.gitignore` covers `*.db` but not those). None of them are touched by a
    checkout, so none of them may block a rollback."""
    rollback.cmd_status(repo)
    stable = rollback.read_ref(repo, rollback.STABLE_REF)
    _commit(repo, 'bad', days_ago=0)
    os.makedirs(os.path.join(repo, 'venv', 'bin'))
    open(os.path.join(repo, 'venv', 'bin', 'gunicorn'), 'w').close()
    open(os.path.join(repo, 'planner_db.db-wal'), 'w').close()

    assert rollback.cmd_rollback(repo, restart=False) == 0

    assert rollback.head_sha(repo) == stable
    assert os.path.exists(os.path.join(repo, 'planner_db.db-wal'))
    assert os.path.exists(os.path.join(repo, 'venv', 'bin', 'gunicorn'))


def test_rollback_on_stable_head_is_a_noop(repo, capsys):
    rollback.cmd_status(repo)

    assert rollback.cmd_rollback(repo, restart=False) == 0

    assert 'nothing to roll back' in capsys.readouterr().out
    assert rollback.checkpoints(repo) == []
    assert not rollback.is_detached(repo)


def test_rollback_without_stable_refuses(repo):
    with pytest.raises(rollback.RollbackError, match='no stable commit'):
        rollback.cmd_rollback(repo, restart=False)


def test_a_refused_checkout_keeps_the_deploy_clock(repo):
    """
    `git checkout` can refuse (here: an untracked file the stable tree would
    overwrite). Nothing moved, so the commit is still the one being served and
    must keep the promotion clock it has already earned.
    """
    rollback.cmd_status(repo)
    _commit(repo, 'stable')
    with open(os.path.join(repo, 'extra.txt'), 'w') as fh:
        fh.write('tracked\n')
    _run(repo, 'add', 'extra.txt')
    _run(repo, 'commit', '-m', 'stable carries extra.txt')
    rollback.git(repo, 'update-ref', rollback.STABLE_REF, rollback.head_sha(repo))

    _run(repo, 'rm', '--quiet', 'extra.txt')
    _run(repo, 'commit', '-m', 'bad drops extra.txt')
    bad = rollback.head_sha(repo)
    _deployed(repo, days_ago=6)                # nearly earned promotion
    before = rollback.deploy_record(repo)

    # Recreate it untracked, with different content: the checkout will refuse.
    with open(os.path.join(repo, 'extra.txt'), 'w') as fh:
        fh.write('regenerated at runtime\n')

    with pytest.raises(rollback.RollbackError, match='checkout'):
        rollback.cmd_rollback(repo, restart=False)

    assert rollback.head_sha(repo) == bad
    assert not rollback.is_detached(repo)
    assert rollback.deploy_record(repo) == before


def test_second_rollback_records_a_second_checkpoint(repo):
    rollback.cmd_status(repo)
    _commit(repo, 'bad', days_ago=0)
    rollback.cmd_rollback(repo, restart=False)

    rollback.git(repo, 'checkout', 'master')
    _commit(repo, 'bad again', days_ago=0)
    rollback.cmd_rollback(repo, restart=False)

    assert len(rollback.checkpoints(repo)) == 2


def test_only_one_deploy_ref_survives_a_head_change(repo):
    """The clock is a single record: a new HEAD replaces it, never joins it."""
    rollback.cmd_status(repo)
    _commit(repo, 'second')
    rollback.cmd_status(repo)
    head = _commit(repo, 'third')
    rollback.cmd_status(repo)

    refs = rollback._stamped_refs(repo, rollback.DEPLOY_PREFIX)
    assert len(refs) == 1
    assert refs[0][1] == head


def test_a_hand_made_deploy_ref_is_still_cleared(repo):
    """
    strptime accepts 1-6 fractional digits, strftime always writes 6. Deleting
    by a rebuilt name would silently miss an operator-written ref and leave the
    clock stuck on it forever.
    """
    rollback.cmd_status(repo)
    rollback.git(repo, 'update-ref',
                 '%s/20301231T235959.5Z' % rollback.DEPLOY_PREFIX, 'HEAD')

    rollback.clear_deploy_record(repo)

    assert rollback._stamped_refs(repo, rollback.DEPLOY_PREFIX) == []
