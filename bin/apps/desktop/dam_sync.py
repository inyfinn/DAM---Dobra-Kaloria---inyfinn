# -*- coding: utf-8 -*-
"""Cichy sync dumpow Postgres (bez okna CMD) — z launch.py i harmonogramu."""
from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from pathlib import Path

import platform_compat
from runtime_config import CONTENT_ROOT, DESKTOP_DIR, GIT_ROOT

REPO_ROOT = CONTENT_ROOT  # content tree (bin); git cwd = GIT_ROOT
GIT_CWD = GIT_ROOT

CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
DATA_DIR = DESKTOP_DIR / "data"
LOG_DIR = DESKTOP_DIR / "logs"
RUNNING_LOCK = DATA_DIR / "dam-running.lock"
SYNC_SCRIPT = DESKTOP_DIR / "scripts" / "sync-database-backups-to-git.py"
VBS_SILENT = DESKTOP_DIR / "scripts" / "sync-database-backups-silent.vbs"
SYNC_INTERVAL_SEC = 3600
SYNC_START_DELAY_SEC = 120


def _log(msg: str) -> None:
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        line = time.strftime("%Y-%m-%d %H:%M:%S") + " " + msg + "\n"
        (LOG_DIR / "database-sync.log").open("a", encoding="utf-8").write(line)
    except Exception:
        pass


def _silent_python() -> str:
    exe = Path(sys.executable)
    if exe.name.lower() == "python.exe":
        pw = exe.with_name("pythonw.exe")
        if pw.is_file():
            return str(pw)
    return str(exe)


def write_running_lock() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RUNNING_LOCK.write_text(str(os.getpid()), encoding="utf-8")


def clear_running_lock() -> None:
    try:
        RUNNING_LOCK.unlink(missing_ok=True)
    except Exception:
        pass


def is_dam_running() -> bool:
    if not RUNNING_LOCK.is_file():
        return False
    try:
        pid = int((RUNNING_LOCK.read_text(encoding="utf-8") or "0").strip())
    except ValueError:
        return False
    if pid <= 0:
        return False
    if sys.platform != "win32":
        return True
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        STILL_ACTIVE = 259
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not handle:
            return False
        try:
            code = ctypes.c_ulong()
            if kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
                return int(code.value) == STILL_ACTIVE
        finally:
            kernel32.CloseHandle(handle)
    except Exception:
        return True
    return False


def spawn_sync_quiet(*, push: bool = True, no_commit: bool = False) -> bool:
    """Uruchom sync w tle — zero okna CMD (pythonw / VBS / CREATE_NO_WINDOW)."""
    if not SYNC_SCRIPT.is_file():
        _log("spawn_sync_quiet: brak skryptu " + str(SYNC_SCRIPT))
        return False

    args_tail = []
    if push:
        args_tail.append("--push")
    if no_commit:
        args_tail.append("--no-commit")
    args_tail.append("--quiet")

    if sys.platform == "win32" and VBS_SILENT.is_file():
        try:
            flags = subprocess.CREATE_NO_WINDOW | getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
            subprocess.Popen(
                ["wscript.exe", str(VBS_SILENT)],
                cwd=str(GIT_CWD),
                creationflags=flags,
                close_fds=True,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            _log("spawn_sync_quiet: wscript " + VBS_SILENT.name)
            return True
        except Exception as exc:
            _log("spawn_sync_quiet wscript fail: " + str(exc))

    py_exe = _silent_python()
    cmd = [py_exe, str(SYNC_SCRIPT), *args_tail]
    try:
        subprocess.Popen(
            cmd,
            cwd=str(GIT_CWD),
            close_fds=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            **platform_compat.popen_background_kwargs(),
        )
        _log("spawn_sync_quiet: " + " ".join(cmd))
        return True
    except Exception as exc:
        _log("spawn_sync_quiet fail: " + str(exc))
        return False


def run_sync_blocking(*, push: bool = False, no_commit: bool = False, timeout: int = 120) -> dict:
    """Sync synchroniczny (UI / bridge) — bez okna konsoli."""
    if not SYNC_SCRIPT.is_file():
        return {"ok": False, "error": "sync_script_missing"}
    py_exe = _silent_python()
    cmd = [py_exe, str(SYNC_SCRIPT)]
    if push:
        cmd.append("--push")
    if no_commit:
        cmd.append("--no-commit")
    cmd.append("--quiet")
    flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(GIT_CWD),
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            creationflags=flags,
        )
        return {
            "ok": proc.returncode == 0,
            "exit_code": proc.returncode,
            "stdout": (proc.stdout or "")[-800:],
            "stderr": (proc.stderr or "")[-400:],
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def start_periodic_sync(stop_event: threading.Event | None = None) -> None:
    """Co godzine sync dumpow gdy DAM dziala (cicho w tle)."""

    def _loop() -> None:
        time.sleep(SYNC_START_DELAY_SEC)
        while True:
            if stop_event and stop_event.is_set():
                break
            spawn_sync_quiet(push=True)
            if stop_event:
                if stop_event.wait(SYNC_INTERVAL_SEC):
                    break
            else:
                time.sleep(SYNC_INTERVAL_SEC)

    threading.Thread(target=_loop, name="dam-db-sync", daemon=True).start()
    _log("start_periodic_sync: co " + str(SYNC_INTERVAL_SEC) + "s (start za " + str(SYNC_START_DELAY_SEC) + "s)")
