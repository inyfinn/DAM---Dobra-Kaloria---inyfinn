# -*- coding: utf-8 -*-
"""
Pobierz dump Postgresa z Synology (DATABASE/) do repo DAM/DATABASE/
i wypchnij na Git (prywatne repo).

Retencja lokalna w repo: 48 godzinowych dam_eta_YYYY-MM-DD_HH.sql.gz
oraz 72 dziennych dam_eta_YYYY-MM-DD.sql.gz.

Zrzut sluzy TYLKO do odtwarzania po katastrofie. Nie scalaj dumpow
z dwoch maszyn (SERIAL / BIGSERIAL). Git commit nigdy nie wywala mostu.

Uzycie (Windows, w katalogu repo):
  python apps/desktop/scripts/sync-database-backups-to-git.py
  python apps/desktop/scripts/sync-database-backups-to-git.py --push

Wymaga: SSH host `syno` w ~/.ssh/config, git w PATH.
Nie commituje hasel — tylko pliki .sql.gz.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

CONTENT_ROOT = Path(__file__).resolve().parents[3]
GIT_ROOT = CONTENT_ROOT.parent
REPO_ROOT = CONTENT_ROOT  # DATABASE + apps live under bin/
DATABASE_DIR = CONTENT_ROOT / "DATABASE"
REMOTE_DIR = "/volume1/docker/dam-eta-postgres/DATABASE"
MAX_DAYS = 72
MAX_HOURLY = 48
SSH_HOST = "syno"
LOG_DIR = CONTENT_ROOT / "apps" / "desktop" / "logs"
SYNC_LOG = LOG_DIR / "database-sync.log"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)


def _log(msg: str) -> None:
    line = time.strftime("%Y-%m-%d %H:%M:%S") + " " + msg
    print(line, flush=True)
    if os.environ.get("DAM_SYNC_QUIET") == "1":
        try:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            with SYNC_LOG.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
        except OSError:
            pass


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
    return subprocess.run(
        cmd,
        cwd=str(GIT_ROOT),
        check=check,
        capture_output=True,
        text=True,
        creationflags=flags,
    )


def pull_from_syno() -> int:
    """Pobierz dumpy przez ssh cat (Synology czesto blokuje scp/SFTP na tych sciezkach)."""
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    ls = subprocess.run(
        ["ssh", SSH_HOST, f"ls -1 {REMOTE_DIR}/dam_eta_*.sql.gz 2>/dev/null"],
        capture_output=True,
        text=True,
        creationflags=CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )
    remote_files = [
        ln.strip()
        for ln in (ls.stdout or "").splitlines()
        if ln.strip().endswith(".sql.gz")
    ]
    if not remote_files:
        _log("Brak dumpow na Synology jeszcze (uruchom backup-postgres-database.sh).")
        return 0
    for remote in remote_files:
        name = Path(remote).name
        local = DATABASE_DIR / name
        result = subprocess.run(
            ["ssh", SSH_HOST, f"cat '{remote}'"],
            capture_output=True,
            creationflags=CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        if result.returncode != 0 or not result.stdout:
            err = (result.stderr or b"").decode("utf-8", errors="replace")
            _log(f"ssh cat error ({name}): {err}")
            continue
        local.write_bytes(result.stdout)
        _log(f"pobrano: {name} ({len(result.stdout)} B)")
    files = sorted(DATABASE_DIR.glob("dam_eta_*.sql.gz"))
    _log(f"Obecne lokalnie: {len(files)} dumpow")
    return len(files)


def rotate_local() -> None:
    hourly = sorted(DATABASE_DIR.glob("dam_eta_????-??-??_??.sql.gz"))
    if len(hourly) > MAX_HOURLY:
        for old in hourly[: len(hourly) - MAX_HOURLY]:
            _log(f"Rotacja godzinowa (kasuj): {old.name}")
            old.unlink(missing_ok=True)
    daily = sorted(DATABASE_DIR.glob("dam_eta_????-??-??.sql.gz"))
    if len(daily) > MAX_DAYS:
        for old in daily[: len(daily) - MAX_DAYS]:
            _log(f"Rotacja dzienna (kasuj): {old.name}")
            old.unlink(missing_ok=True)


def git_commit_push(do_push: bool) -> None:
    """Git nigdy nie wywala procesu (most / supervisor)."""
    try:
        run(["git", "add", "DATABASE/"], check=False)
        status = run(["git", "status", "--porcelain", "DATABASE/"], check=False)
        if not (status.stdout or "").strip():
            _log("Brak zmian w DATABASE/ - nic do commita.")
            return
        msg = "chore(database): rotate Postgres dumps (hourly+daily)"
        run(["git", "commit", "-m", msg], check=False)
        _log("Commit OK: " + msg)
        if do_push:
            run(["git", "push"], check=False)
            _log("Push OK")
    except Exception as exc:  # noqa: BLE001
        _log(f"git sync warning (ignored): {exc}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true", help="git push po commitcie")
    ap.add_argument("--skip-pull", action="store_true", help="tylko rotacja + commit lokalnych plikow")
    ap.add_argument(
        "--no-commit",
        action="store_true",
        help="tylko pobierz dump z Synology (bez git commit) - do natychmiastowego odswiezenia z UI",
    )
    ap.add_argument(
        "--quiet",
        action="store_true",
        help="bez konsoli — log do apps/desktop/logs/database-sync.log",
    )
    ap.add_argument(
        "--from-bridge",
        action="store_true",
        help="wywolanie z mostu: bez commita, bledy nie koncza procesu",
    )
    args = ap.parse_args()
    if args.from_bridge:
        args.no_commit = True
        args.quiet = True

    if args.quiet:
        os.environ["DAM_SYNC_QUIET"] = "1"
        try:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            sys.stdout = open(SYNC_LOG, "a", encoding="utf-8")  # noqa: SIM115
            sys.stderr = sys.stdout
        except OSError:
            pass

    if not args.skip_pull:
        pull_from_syno()
    rotate_local()
    if not args.no_commit:
        git_commit_push(do_push=args.push)


if __name__ == "__main__":
    main()
