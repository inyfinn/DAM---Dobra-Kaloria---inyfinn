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

from rebuild_lock import (
    DATA_DIR,
    acquire_lock,
    lock_is_stale,
    mark_cancel_requested,
    read_lock,
    status_from_lock,
)

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = DESKTOP_DIR.parent / "web"
WATCH_SCRIPT = WEB_ROOT / "scripts" / "watch-file-index.py"
SUPERVISOR_LOCK = DATA_DIR / "index-supervisor.lock.json"
WATCHER_STATUS = DATA_DIR / "index-watcher-status.json"
WATCHER_LOG = DATA_DIR / "index-watcher.log"
PRODUCT_REBUILD_LOCK = DATA_DIR / "index-rebuild.lock.json"
CONTROL_FILE = DATA_DIR / "index-control.json"
MAX_LOG_BYTES = 2_000_000
HOURLY_SEC_DEFAULT = float(os.environ.get("DAM_INDEX_HOURLY_SEC", "3600") or "3600")
FIRST_DELAY_SEC_DEFAULT = float(os.environ.get("DAM_INDEX_FIRST_DELAY_SEC", "20") or "20")

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
        for key in ("last_ok", "last_rc", "last_error", "last_started", "last_finished", "last_duration_sec"):
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


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f".{os.getpid()}.tmp")
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    try:
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, path)
    except OSError:
        try:
            path.write_text(text, encoding="utf-8")
        except OSError:
            pass
        try:
            if tmp.is_file():
                tmp.unlink()
        except OSError:
            pass


def read_control() -> dict[str, Any]:
    if not CONTROL_FILE.is_file():
        return {}
    try:
        data = json.loads(CONTROL_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_control(payload: dict[str, Any]) -> None:
    body = dict(payload)
    body["updated_at"] = _utc()
    _write_json_atomic(CONTROL_FILE, body)


def _parse_iso(ts: str):
    if not ts:
        return None
    try:
        from datetime import datetime

        return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except Exception:
        return None


def is_snoozed() -> bool:
    until = str(read_control().get("snooze_until") or "")
    dt = _parse_iso(until)
    if dt is None:
        return False
    try:
        from datetime import datetime

        now = datetime.now().astimezone()
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=now.tzinfo)
        return now < dt
    except Exception:
        return False


def snooze_until_end_of_day() -> dict[str, Any]:
    from datetime import datetime

    now = datetime.now().astimezone()
    eod = now.replace(hour=23, minute=59, second=59, microsecond=0)
    body = read_control()
    body["snooze_until"] = eod.isoformat()
    body["snooze_set_at"] = now.isoformat()
    body["cancel_requested"] = False
    write_control(body)
    return {
        "ok": True,
        "snoozed": True,
        "snooze_until": body["snooze_until"],
        "control_path": str(CONTROL_FILE),
    }


def clear_snooze() -> dict[str, Any]:
    body = read_control()
    body["snooze_until"] = ""
    write_control(body)
    return {"ok": True, "snoozed": False, "control_path": str(CONTROL_FILE)}


def peek_cancel() -> bool:
    return bool(read_control().get("cancel_requested"))


def consume_cancel() -> bool:
    body = read_control()
    hit = bool(body.get("cancel_requested"))
    if hit:
        body["cancel_requested"] = False
        body["cancel_consumed_at"] = _utc()
        write_control(body)
    return hit


def request_cancel() -> dict[str, Any]:
    body = read_control()
    body["cancel_requested"] = True
    body["cancel_at"] = _utc()
    write_control(body)
    killed = terminate_rebuild_child()
    try:
        mark_cancel_requested(PRODUCT_REBUILD_LOCK)
    except Exception:
        pass
    return {
        "ok": True,
        "cancel_requested": True,
        "control_path": str(CONTROL_FILE),
        **killed,
    }


def _terminate_pid(pid: int) -> bool:
    pid = int(pid or 0)
    if pid <= 0:
        return False
    try:
        if sys.platform == "win32":
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/T", "/F"],
                capture_output=True,
                timeout=8,
                creationflags=flags,
                check=False,
            )
            return True
        os.kill(pid, 15)
        return True
    except Exception:
        return False


def terminate_rebuild_child() -> dict[str, Any]:
    lock = read_lock(PRODUCT_REBUILD_LOCK)
    child = int(lock.get("child_pid") or 0)
    killed = False
    if child:
        killed = _terminate_pid(child)
    return {"child_pid": child, "killed": killed}


def wait_rebuild_proc(
    proc: subprocess.Popen,
    *,
    lock_handle=None,
    on_tick=None,
    poll_sec: float = 0.4,
) -> int:
    """Wait for build-file-index; stop on cancel flag or lock.cancel_requested."""
    from rebuild_lock import lock_cancel_requested

    while True:
        rc = proc.poll()
        if rc is not None:
            return int(rc)
        if peek_cancel() or lock_cancel_requested(PRODUCT_REBUILD_LOCK):
            try:
                proc.terminate()
            except Exception:
                pass
            _terminate_pid(int(getattr(proc, "pid", 0) or 0))
            try:
                proc.wait(timeout=8)
            except Exception:
                pass
            consume_cancel()
            return 130
        if callable(on_tick):
            try:
                on_tick()
            except Exception:
                pass
        if lock_handle is not None:
            try:
                lock_handle.update(heartbeat_at=_utc())
            except Exception:
                pass
        time.sleep(max(0.2, float(poll_sec)))


def public_control() -> dict[str, Any]:
    body = read_control()
    snoozed = is_snoozed()
    return {
        "control_path": str(CONTROL_FILE),
        "cancel_requested": bool(body.get("cancel_requested")),
        "snoozed": snoozed,
        "snooze_until": str(body.get("snooze_until") or ""),
        "updated_at": body.get("updated_at") or "",
    }


def _progress_from_watcher(w: dict[str, Any], rebuild: dict[str, Any]) -> dict[str, Any]:
    running = bool((rebuild.get("held")) or str(w.get("stage") or "").endswith(":building") or str(w.get("stage") or "") == "building")
    started = str(w.get("last_started") or (rebuild.get("lock") or {}).get("started_at") or "")
    elapsed = w.get("elapsed_sec")
    eta = w.get("eta_sec")
    remaining = w.get("remaining_sec")
    kind = w.get("rebuild_kind") or w.get("kind") or ""
    last_dur = w.get("last_duration_sec")
    if running and started and elapsed is None:
        dt = _parse_iso(started)
        if dt is not None:
            try:
                from datetime import datetime

                now = datetime.now().astimezone()
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=now.tzinfo)
                elapsed = max(0, int((now - dt).total_seconds()))
            except Exception:
                elapsed = None
        if last_dur and elapsed is not None:
            try:
                remaining = max(0, int(float(last_dur) - float(elapsed)))
                eta = remaining
            except (TypeError, ValueError):
                pass
    pct = None
    if running and last_dur:
        try:
            pct = max(1, min(99, int(100.0 * float(elapsed or 0) / float(last_dur))))
        except (TypeError, ValueError, ZeroDivisionError):
            pct = None
    return {
        "running": running,
        "kind": kind or ("hourly" if "hourly" in str(w.get("stage") or "") else ""),
        "stage": w.get("stage") or "",
        "started_at": started,
        "elapsed_sec": elapsed,
        "eta_sec": eta,
        "remaining_sec": remaining if remaining is not None else eta,
        "pct": pct,
        "last_duration_sec": last_dur,
        "message": w.get("progress_message") or "",
    }


class IndexSupervisor:
    """Owns watch-file-index subprocess + status/log files."""

    def __init__(
        self,
        *,
        interval: float = 2.0,
        depth: int = 5,
        roots: list[str] | None = None,
        hourly_sec: float | None = None,
        first_delay_sec: float | None = None,
    ) -> None:
        self.interval = float(interval)
        self.depth = max(1, int(depth))
        self.roots = list(roots or [])
        self.hourly_sec = float(hourly_sec if hourly_sec is not None else HOURLY_SEC_DEFAULT)
        self.first_delay_sec = float(
            first_delay_sec if first_delay_sec is not None else FIRST_DELAY_SEC_DEFAULT
        )
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
        try:
            from branding_publish import resolve_script_python

            watcher_py = resolve_script_python(require_ijson=False)
        except Exception:
            watcher_py = sys.executable
            exe = Path(sys.executable)
            if exe.name.lower() == "pythonw.exe":
                sibling = exe.with_name("python.exe")
                if sibling.is_file():
                    watcher_py = str(sibling)
        cmd = [
            watcher_py,
            str(WATCH_SCRIPT),
            "--interval",
            str(self.interval),
            "--depth",
            str(self.depth),
            "--status-file",
            str(WATCHER_STATUS),
            "--lock-file",
            str(PRODUCT_REBUILD_LOCK),
            "--control-file",
            str(CONTROL_FILE),
            "--hourly",
            str(self.hourly_sec),
            "--first-delay",
            str(self.first_delay_sec),
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


def ensure_index_supervisor(*, interval: float = 2.0, depth: int = 5) -> dict[str, Any]:
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
        sup = IndexSupervisor(interval=interval, depth=depth)
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
    control = public_control()
    progress = _progress_from_watcher(w, rebuild)
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
        "progress": progress,
        "control": control,
        "control_path": str(CONTROL_FILE),
        "snoozed": bool(control.get("snoozed")),
        "snooze_until": control.get("snooze_until") or "",
        "cancelable": bool(progress.get("running") or rebuild.get("held")),
        "hourly_sec": HOURLY_SEC_DEFAULT,
        "hourly_pending": bool(w.get("hourly_pending")) and not snoozed,
    }
