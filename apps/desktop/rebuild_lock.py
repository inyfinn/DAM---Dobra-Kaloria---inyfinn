# -*- coding: utf-8 -*-
"""Cross-process O_EXCL rebuild locks with PID/TTL stale recovery."""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
DATA_DIR = DESKTOP_DIR / "data"

DEFAULT_TTL_SEC = 3600


def _utc_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        if os.name == "nt":
            import ctypes

            kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, int(pid))
            if not handle:
                return False
            kernel32.CloseHandle(handle)
            return True
        os.kill(pid, 0)
        return True
    except OSError:
        return False


@dataclass
class LockHandle:
    path: Path
    payload: dict[str, Any]

    def update(self, **fields: Any) -> None:
        self.payload.update(fields)
        self.payload["updated_at"] = _utc_iso()
        _write_atomic(self.path, self.payload)

    def release(self) -> None:
        try:
            if self.path.is_file():
                data = _read_json(self.path)
                if data.get("pid") == self.payload.get("pid"):
                    self.path.unlink(missing_ok=True)  # type: ignore[call-arg]
        except OSError:
            try:
                self.path.unlink()
            except OSError:
                pass


def _read_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def read_lock(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    return _read_json(path)


def lock_is_stale(payload: dict[str, Any], ttl_sec: float = DEFAULT_TTL_SEC) -> bool:
    if not payload:
        return True
    pid = int(payload.get("pid") or 0)
    if pid and not _pid_alive(pid):
        return True
    started = str(payload.get("started_at") or payload.get("updated_at") or "")
    if not started:
        return True
    try:
        # Accept Z or +00:00
        ts = started.replace("Z", "+00:00")
        # Fallback: parse as epoch if numeric
        if started.isdigit():
            age = time.time() - float(started)
        else:
            from datetime import datetime

            dt = datetime.fromisoformat(ts)
            age = time.time() - dt.timestamp()
        return age > float(ttl_sec)
    except Exception:
        return True


def acquire_lock(
    path: Path,
    *,
    stage: str = "starting",
    ttl_sec: float = DEFAULT_TTL_SEC,
    extra: dict[str, Any] | None = None,
) -> tuple[LockHandle | None, dict[str, Any]]:
    """Acquire exclusive lock via O_EXCL create. Returns (handle|None, status)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = read_lock(path)
    if existing and not lock_is_stale(existing, ttl_sec=ttl_sec):
        return None, {
            "ok": False,
            "error": "lock_held",
            "stale": False,
            "lock": existing,
        }
    if existing and lock_is_stale(existing, ttl_sec=ttl_sec):
        try:
            path.unlink()
        except OSError:
            pass
        recovered = True
    else:
        recovered = bool(existing)

    payload: dict[str, Any] = {
        "pid": os.getpid(),
        "started_at": _utc_iso(),
        "updated_at": _utc_iso(),
        "stage": stage,
        "ttl_sec": float(ttl_sec),
        "recovered_stale": recovered,
    }
    if extra:
        payload.update(extra)

    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
    try:
        fd = os.open(str(path), flags)
    except FileExistsError:
        again = read_lock(path)
        if again and lock_is_stale(again, ttl_sec=ttl_sec):
            try:
                path.unlink()
            except OSError:
                pass
            try:
                fd = os.open(str(path), flags)
            except FileExistsError:
                return None, {"ok": False, "error": "lock_held", "stale": False, "lock": read_lock(path)}
        else:
            return None, {"ok": False, "error": "lock_held", "stale": False, "lock": again}
    try:
        os.write(fd, (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    finally:
        os.close(fd)
    return LockHandle(path, payload), {"ok": True, "acquired": True, "recovered_stale": recovered, "lock": payload}


def status_from_lock(path: Path, ttl_sec: float = DEFAULT_TTL_SEC) -> dict[str, Any]:
    payload = read_lock(path)
    if not payload:
        return {"held": False, "stale": False, "lock": {}}
    stale = lock_is_stale(payload, ttl_sec=ttl_sec)
    return {
        "held": not stale,
        "stale": stale,
        "lock": payload,
        "pid_alive": _pid_alive(int(payload.get("pid") or 0)),
    }
