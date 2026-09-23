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


def resolve_state_dir() -> Path:
    """Katalog na ulotny stan biezacego uruchomienia (statusy, blokady, logi).

    NIE moze to byc drzewo repo: caly folder Marketing jest lustrzany przez
    Synology Drive, ktory podmienia plik w trakcie zapisu i zostawia kopie
    *_INYFINN_*_Conflict. Rozdarty index-watcher-status.json wracal z czytania
    jako koperta bledu, koperta byla zapisywana z powrotem jako prawdziwy status
    i pulpit pokazywal "Aktualizacja indeksu nie dziala" juz na zawsze - nawet
    po restarcie, bo blad siedzial na dysku. Stan lokalny maszyny trzyma sie
    w LOCALAPPDATA/DAM/state; gdy zapis tam nie wychodzi, wracamy do DATA_DIR.
    """
    raw = (os.environ.get("DAM_STATE_DIR") or "").strip()
    if raw:
        cand = Path(raw)
    else:
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or ""
        if not base:
            return DATA_DIR
        cand = Path(base) / "DAM" / "state"
    try:
        cand.mkdir(parents=True, exist_ok=True)
        probe = cand / ".write-probe"
        probe.write_text("1", encoding="utf-8")
        probe.unlink()
    except OSError:
        return DATA_DIR
    return cand


STATE_DIR = resolve_state_dir()

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


def _process_start_ticks(pid: int) -> int | None:
    """Windows process creation time as a single 64-bit tick count (FILETIME).

    Windows recycles PIDs aggressively once a process exits - on a machine
    running many short-lived pythonw.exe helpers (index/branding subprocesses)
    a dead lock owner's PID can be reassigned to an unrelated live process
    within minutes. ``_pid_alive`` alone then reports "alive" for a PID that
    no longer belongs to the process that wrote the lock, and the stale lock
    survives until the (multi-hour) TTL fallback finally kicks in - exactly
    what produced the multi-hour-stuck branding grid publish on 2026-09-23
    (index-rebuild.lock.json recorded pid 54616 started_at 13:03:59Z, but the
    live process holding pid 54616 at inspection time had actually started at
    13:11:47Z - a different, later process reusing the number).

    Comparing the recorded creation time against the live process' actual
    creation time lets us detect that mismatch immediately instead of waiting
    for the TTL to expire. Returns None if unavailable (non-Windows, or the
    PID doesn't exist / can't be queried).
    """
    if os.name != "nt" or pid <= 0:
        return None
    try:
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, int(pid))
        if not handle:
            return None
        try:
            creation = wintypes.FILETIME()
            exit_time = wintypes.FILETIME()
            kernel_time = wintypes.FILETIME()
            user_time = wintypes.FILETIME()
            ok = kernel32.GetProcessTimes(
                handle,
                ctypes.byref(creation),
                ctypes.byref(exit_time),
                ctypes.byref(kernel_time),
                ctypes.byref(user_time),
            )
            if not ok:
                return None
            return (int(creation.dwHighDateTime) << 32) | int(creation.dwLowDateTime)
        finally:
            kernel32.CloseHandle(handle)
    except Exception:
        return None


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
    except (OSError, ValueError):
        # ValueError covers JSONDecodeError and UnicodeDecodeError (Synology Drive copies).
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
    if pid:
        recorded_start = payload.get("proc_start")
        if recorded_start is not None:
            current_start = _process_start_ticks(pid)
            # A live PID whose creation time no longer matches what we recorded
            # means Windows recycled the PID for a different process - the
            # original lock owner is gone. Treat as stale immediately instead
            # of waiting out the TTL (see _process_start_ticks docstring).
            if current_start is not None and int(recorded_start) != current_start:
                return True
    # Wiek liczymy od NAJSWIEZSZEGO znacznika (heartbeat_at > updated_at > started_at).
    # Blad do 2026-09-18: brany byl started_at, wiec supervisor z TTL 120 s byl "stale"
    # 2 minuty po starcie mimo zywego PID i heartbeatu sprzed sekundy - /preflight
    # pokazywal wtedy "Aktualizacja indeksu nie dziala" przy kazdym dluzszym uruchomieniu.
    from datetime import datetime

    newest: float | None = None
    for key in ("heartbeat_at", "updated_at", "started_at"):
        raw = str(payload.get(key) or "").strip()
        if not raw:
            continue
        try:
            ts = float(raw) if raw.isdigit() else datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
        except Exception:
            continue
        newest = ts if newest is None else max(newest, ts)
    if newest is None:
        return True
    return (time.time() - newest) > float(ttl_sec)


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

    own_pid = os.getpid()
    payload: dict[str, Any] = {
        "pid": own_pid,
        "started_at": _utc_iso(),
        "updated_at": _utc_iso(),
        "stage": stage,
        "ttl_sec": float(ttl_sec),
        "recovered_stale": recovered,
    }
    own_start = _process_start_ticks(own_pid)
    if own_start is not None:
        payload["proc_start"] = own_start
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


def mark_cancel_requested(path: Path) -> dict[str, Any]:
    """Stamp cancel_requested on a live lock so the rebuild child can stop."""
    payload = read_lock(path)
    if not payload:
        return {"ok": False, "error": "no_lock"}
    payload["cancel_requested"] = True
    payload["updated_at"] = _utc_iso()
    try:
        _write_atomic(path, payload)
    except OSError as exc:
        return {"ok": False, "error": str(exc), "lock": payload}
    return {"ok": True, "lock": payload}


def lock_cancel_requested(path: Path) -> bool:
    payload = read_lock(path)
    return bool(payload.get("cancel_requested"))


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
