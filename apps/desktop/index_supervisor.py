# -*- coding: utf-8 -*-
"""Single cross-process index supervisor (bridge-owned).

Owns product file-index watcher for both launch.py and serve_browser.py.
Uses O_EXCL supervisor lock so duplicates become no-ops.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any

from rebuild_lock import DATA_DIR, acquire_lock, lock_is_stale, read_lock, status_from_lock

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = DESKTOP_DIR.parent / "web"
WATCH_SCRIPT = WEB_ROOT / "scripts" / "watch-file-index.py"
SUPERVISOR_LOCK = DATA_DIR / "index-supervisor.lock.json"
WATCHER_STATUS = DATA_DIR / "index-watcher-status.json"
WATCHER_LOG = DATA_DIR / "index-watcher.log"
PRODUCT_REBUILD_LOCK = DATA_DIR / "index-rebuild.lock.json"
MAX_LOG_BYTES = 2_000_000

CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)

_state_lock = threading.Lock()
_owner: "IndexSupervisor | None" = None


def _utc() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _rotate_log_if_needed(path: Path) -> None:
    try:
        if path.is_file() and path.stat().st_size > MAX_LOG_BYTES:
            bak = path.with_suffix(path.suffix + ".1")
            if bak.is_file():
                bak.unlink()
            path.replace(bak)
    except OSError:
        pass


def write_watcher_status(payload: dict[str, Any], *, preserve_last: bool = True) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    body = dict(payload)
    if preserve_last:
        prev = read_watcher_status()
        for key in ("last_ok", "last_rc", "last_error", "last_started", "last_finished"):
            if key not in body and key in prev and prev.get(key) is not None:
                body[key] = prev.get(key)
    # Explicit run state: null last_ok = no successful rebuild yet (not a green success).
    if body.get("last_ok") is None and "awaiting_first_rebuild" not in body:
        body["awaiting_first_rebuild"] = True
    elif body.get("last_ok") is True:
        body["awaiting_first_rebuild"] = False
    body["updated_at"] = _utc()
    text = json.dumps(body, ensure_ascii=False, indent=2) + "\n"
    tmp = WATCHER_STATUS.with_name(WATCHER_STATUS.name + f".{os.getpid()}.tmp")
    try:
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, WATCHER_STATUS)
    except OSError:
        # Windows race with concurrent readers/writers: best-effort direct write
        try:
            WATCHER_STATUS.write_text(text, encoding="utf-8")
        except OSError:
            pass
        try:
            if tmp.is_file():
                tmp.unlink()
        except OSError:
            pass


def read_watcher_status() -> dict[str, Any]:
    if not WATCHER_STATUS.is_file():
        return {"ok": False, "watcher_ok": False, "error": "no_status"}
    try:
        data = json.loads(WATCHER_STATUS.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {"ok": False, "watcher_ok": False}
    except (OSError, json.JSONDecodeError) as exc:
        return {"ok": False, "watcher_ok": False, "error": str(exc)}


def supervisor_lock_status() -> dict[str, Any]:
    return status_from_lock(SUPERVISOR_LOCK, ttl_sec=120)


class IndexSupervisor:
    """Owns watch-file-index subprocess + status/log files."""

    def __init__(self, *, interval: float = 5.0, roots: list[str] | None = None) -> None:
        self.interval = float(interval)
        self.roots = list(roots or [])
        self._proc: subprocess.Popen | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock_handle = None
        self._owned = False

    def try_become_owner(self) -> dict[str, Any]:
        handle, meta = acquire_lock(
            SUPERVISOR_LOCK,
            stage="supervising",
            ttl_sec=120,
            extra={"owner": "index_supervisor", "role": "bridge"},
        )
        if handle is None:
            return {"ok": True, "owned": False, "reason": "another_owner", **meta}
        self._lock_handle = handle
        self._owned = True
        write_watcher_status(
            {
                "ok": True,
                "watcher_ok": False,
                "stage": "owner_acquired",
                "supervisor_pid": os.getpid(),
                "recovered_stale": meta.get("recovered_stale"),
            }
        )
        return {"ok": True, "owned": True, **meta}

    def start(self) -> dict[str, Any]:
        own = self.try_become_owner()
        if not own.get("owned"):
            return own
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True, name="dam-index-supervisor")
        self._thread.start()
        return {"ok": True, "owned": True, "started": True}

    def _spawn_watcher(self) -> subprocess.Popen | None:
        if not WATCH_SCRIPT.is_file():
            write_watcher_status(
                {
                    "ok": False,
                    "watcher_ok": False,
                    "error": f"missing_watch_script:{WATCH_SCRIPT}",
                    "last_error": f"missing_watch_script:{WATCH_SCRIPT}",
                }
            )
            return None
        _rotate_log_if_needed(WATCHER_LOG)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        log_f = open(WATCHER_LOG, "a", encoding="utf-8", errors="replace")
        cmd = [
            sys.executable,
            str(WATCH_SCRIPT),
            "--interval",
            str(self.interval),
            "--status-file",
            str(WATCHER_STATUS),
            "--lock-file",
            str(PRODUCT_REBUILD_LOCK),
            "--no-initial",
        ]
        for r in self.roots:
            cmd.extend(["--root", r])
        flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(WEB_ROOT.parent.parent),
                creationflags=flags,
                stdin=subprocess.DEVNULL,
                stdout=log_f,
                stderr=subprocess.STDOUT,
            )
        except Exception as exc:  # noqa: BLE001
            try:
                log_f.close()
            except Exception:
                pass
            write_watcher_status(
                {
                    "ok": False,
                    "watcher_ok": False,
                    "error": f"spawn_failed:{exc}",
                    "last_error": str(exc),
                    "last_ok": False,
                }
            )
            return None
        # keep log handle alive via proc (best-effort); close on stop
        setattr(proc, "_dam_log_f", log_f)
        write_watcher_status(
            {
                "ok": True,
                "watcher_ok": True,
                "stage": "watcher_spawned",
                "watcher_pid": proc.pid,
                "supervisor_pid": os.getpid(),
                "log": str(WATCHER_LOG),
            }
        )
        return proc

    def _loop(self) -> None:
        while not self._stop.is_set():
            # heartbeat supervisor lock
            if self._lock_handle is not None:
                try:
                    self._lock_handle.update(stage="supervising", heartbeat_at=_utc())
                except Exception:
                    pass
            alive = self._proc is not None and self._proc.poll() is None
            if not alive:
                if self._proc is not None:
                    rc = self._proc.poll()
                    write_watcher_status(
                        {
                            "ok": False,
                            "watcher_ok": False,
                            "last_ok": False,
                            "last_rc": rc,
                            "last_error": f"watcher_exited_rc_{rc}",
                            "stage": "restarting",
                        }
                    )
                    log_f = getattr(self._proc, "_dam_log_f", None)
                    if log_f:
                        try:
                            log_f.close()
                        except Exception:
                            pass
                self._proc = self._spawn_watcher()
            self._stop.wait(2.5)

    def stop(self) -> None:
        self._stop.set()
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.terminate()
            except Exception:
                pass
        log_f = getattr(self._proc, "_dam_log_f", None) if self._proc else None
        if log_f:
            try:
                log_f.close()
            except Exception:
                pass
        if self._lock_handle is not None:
            try:
                self._lock_handle.release()
            except Exception:
                pass
            self._lock_handle = None
        self._owned = False


def ensure_index_supervisor(*, interval: float = 5.0) -> dict[str, Any]:
    """Idempotent: start supervisor if this process can own the lock."""
    global _owner
    with _state_lock:
        # Another process already owns?
        st = supervisor_lock_status()
        if st.get("held") and int((st.get("lock") or {}).get("pid") or 0) != os.getpid():
            return {
                "ok": True,
                "owned": False,
                "reason": "other_process",
                "lock": st.get("lock"),
                "watcher": read_watcher_status(),
            }
        if _owner is not None and _owner._owned:
            return {
                "ok": True,
                "owned": True,
                "started": False,
                "watcher": read_watcher_status(),
            }
        sup = IndexSupervisor(interval=interval)
        result = sup.start()
        if result.get("owned"):
            _owner = sup
        return {**result, "watcher": read_watcher_status()}


def stop_index_supervisor() -> None:
    global _owner
    with _state_lock:
        if _owner is not None:
            _owner.stop()
            _owner = None


def public_status() -> dict[str, Any]:
    w = read_watcher_status()
    lock = supervisor_lock_status()
    rebuild = status_from_lock(PRODUCT_REBUILD_LOCK, ttl_sec=3600)
    last_ok = w.get("last_ok")
    awaiting = last_ok is None
    # watcher_ok = process alive; index_run_ok = last rebuild succeeded (no false green).
    return {
        "ok": True,
        "watcher_ok": bool(w.get("watcher_ok")),
        "index_run_ok": last_ok is True,
        "awaiting_first_rebuild": awaiting,
        "watcher": w,
        "supervisor": lock,
        "rebuild_lock": rebuild,
        "last_ok": last_ok,
        "last_error": w.get("last_error") or w.get("error") or (
            "awaiting_first_rebuild" if awaiting else ""
        ),
        "last_rc": w.get("last_rc"),
        "stale": bool(lock.get("stale") or rebuild.get("stale")),
        "log": str(WATCHER_LOG),
    }
