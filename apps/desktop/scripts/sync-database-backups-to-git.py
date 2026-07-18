# -*- coding: utf-8 -*-
"""
Pobierz dump Postgresa z Synology (DATABASE/) do repo DAM/DATABASE/
i wypchnij na Git (prywatne repo).

Retencja lokalna w repo: max 72 plikow dam_eta_YYYY-MM-DD.sql.gz (1 / dzien).

Uzycie (Windows, w katalogu repo):
  python apps/desktop/scripts/sync-database-backups-to-git.py
  python apps/desktop/scripts/sync-database-backups-to-git.py --push

Wymaga: SSH host `syno` w ~/.ssh/config, git w PATH.
Nie commituje hasel — tylko pliki .sql.gz.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DATABASE_DIR = REPO_ROOT / "DATABASE"
REMOTE_DIR = "/volume1/docker/dam-eta-postgres/DATABASE"
MAX_DAYS = 72
SSH_HOST = "syno"


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=str(REPO_ROOT), check=check, capture_output=True, text=True)


def pull_from_syno() -> int:
    """Pobierz dumpy przez ssh cat (Synology czesto blokuje scp/SFTP na tych sciezkach)."""
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    ls = subprocess.run(
        ["ssh", SSH_HOST, f"ls -1 {REMOTE_DIR}/dam_eta_*.sql.gz 2>/dev/null"],
        capture_output=True,
        text=True,
    )
    remote_files = [ln.strip() for ln in (ls.stdout or "").splitlines() if ln.strip().endswith(".sql.gz")]
    if not remote_files:
        print("Brak dumpow na Synology jeszcze (uruchom backup-postgres-database.sh).")
        return 0
    for remote in remote_files:
        name = Path(remote).name
        local = DATABASE_DIR / name
        result = subprocess.run(
            ["ssh", SSH_HOST, f"cat '{remote}'"],
            capture_output=True,
        )
        if result.returncode != 0 or not result.stdout:
            err = (result.stderr or b"").decode("utf-8", errors="replace")
            print(f"ssh cat error ({name}):", err)
            sys.exit(1)
        local.write_bytes(result.stdout)
        print(f"pobrano: {name} ({len(result.stdout)} B)")
    files = sorted(DATABASE_DIR.glob("dam_eta_*.sql.gz"))
    print(f"Obecne lokalnie: {len(files)} dumpow")
    return len(files)


def rotate_local() -> None:
    files = sorted(DATABASE_DIR.glob("dam_eta_*.sql.gz"))
    if len(files) <= MAX_DAYS:
        return
    for old in files[: len(files) - MAX_DAYS]:
        print(f"Rotacja (kasuj): {old.name}")
        old.unlink(missing_ok=True)


def git_commit_push(do_push: bool) -> None:
    run(["git", "add", "DATABASE/"])
    status = run(["git", "status", "--porcelain", "DATABASE/"], check=False)
    if not (status.stdout or "").strip():
        print("Brak zmian w DATABASE/ — nic do commita.")
        return
    msg = "chore(database): rotate Postgres dumps (max 72 daily)"
    run(["git", "commit", "-m", msg])
    print("Commit OK:", msg)
    if do_push:
        run(["git", "push"])
        print("Push OK")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true", help="git push po commitcie")
    ap.add_argument("--skip-pull", action="store_true", help="tylko rotacja + commit lokalnych plikow")
    ap.add_argument(
        "--no-commit",
        action="store_true",
        help="tylko pobierz dump z Synology (bez git commit) - do natychmiastowego odswiezenia z UI",
    )
    args = ap.parse_args()

    if not args.skip_pull:
        pull_from_syno()
    rotate_local()
    if not args.no_commit:
        git_commit_push(do_push=args.push)


if __name__ == "__main__":
    main()
