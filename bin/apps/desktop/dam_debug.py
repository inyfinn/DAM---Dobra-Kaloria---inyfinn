# -*- coding: utf-8 -*-
"""Structured debug / telemetry log for DAM (JSONL, local only)."""
from __future__ import annotations

import json
import os
import socket
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
LOG_DIR = DESKTOP_DIR / "logs"
_LOCK = threading.Lock()
_SESSION_ID = os.environ.get("DAM_DEBUG_SESSION") or str(uuid.uuid4())[:12]


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_path_for_day(day: str | None = None) -> Path:
    day = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return LOG_DIR / f"telemetry-{day}.jsonl"


def append_event(
    event_type: str,
    *,
    component: str = "bridge",
    meta: dict[str, Any] | None = None,
    duration_ms: float | None = None,
    level: str = "info",
    session_id: str | None = None,
) -> dict[str, Any]:
    row = {
        "ts": _utc_iso(),
        "level": level,
        "type": str(event_type or "event"),
        "component": str(component or "bridge"),
        "session_id": session_id or _SESSION_ID,
        "hostname": socket.gethostname(),
        "pid": os.getpid(),
        "meta": meta or {},
    }
    if duration_ms is not None:
        row["duration_ms"] = round(float(duration_ms), 2)
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        line = json.dumps(row, ensure_ascii=False, default=str)
        with _LOCK:
            with log_path_for_day().open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
    except OSError:
        pass
    return row


def append_batch(events: list[dict[str, Any]]) -> int:
    if not events:
        return 0
    n = 0
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with _LOCK:
            with log_path_for_day().open("a", encoding="utf-8") as fh:
                for ev in events[:500]:
                    if not isinstance(ev, dict):
                        continue
                    row = {
                        "ts": ev.get("ts") or _utc_iso(),
                        "level": ev.get("level") or "info",
                        "type": str(ev.get("type") or ev.get("event_type") or "client"),
                        "component": str(ev.get("component") or "ui"),
                        "session_id": ev.get("session_id") or _SESSION_ID,
                        "hostname": socket.gethostname(),
                        "pid": os.getpid(),
                        "meta": ev.get("meta") if isinstance(ev.get("meta"), dict) else {},
                    }
                    if ev.get("duration_ms") is not None:
                        row["duration_ms"] = ev.get("duration_ms")
                    fh.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
                    n += 1
    except OSError:
        return n
    return n


def read_tail(limit: int = 100, day: str | None = None) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit or 100), 2000))
    path = log_path_for_day(day)
    if not path.is_file():
        return []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []
    out: list[dict[str, Any]] = []
    for line in reversed(lines[-limit:]):
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    out.reverse()
    return out


def run_self_test() -> dict[str, Any]:
    """Connection + index smoke tests for support/debug."""
    t0 = time.time()
    report: dict[str, Any] = {"ok": True, "checks": [], "started_at": _utc_iso()}
    try:
        import dam_db

        t_ping = time.time()
        ping = dam_db.ping()
        report["checks"].append(
            {
                "id": "db_ping",
                "ok": bool(ping.get("ok")),
                "duration_ms": round((time.time() - t_ping) * 1000, 1),
                "detail": ping,
            }
        )
    except Exception as exc:  # noqa: BLE001
        report["checks"].append({"id": "db_ping", "ok": False, "error": str(exc)})
        report["ok"] = False

    try:
        import pg_db

        if pg_db.is_configured():
            t_pg = time.time()
            pg_res = pg_db.ping()
            report["checks"].append(
                {
                    "id": "postgres_ping",
                    "ok": bool(pg_res.get("ok")),
                    "duration_ms": round((time.time() - t_pg) * 1000, 1),
                    "host": pg_db.last_host(),
                    "detail": pg_res,
                }
            )
            if not pg_res.get("ok"):
                report["ok"] = False
        else:
            report["checks"].append({"id": "postgres_ping", "ok": True, "skipped": True, "reason": "not_configured"})
    except Exception as exc:  # noqa: BLE001
        report["checks"].append({"id": "postgres_ping", "ok": False, "error": str(exc)})
        report["ok"] = False

    try:
        from pathlib import Path as P

        content = DESKTOP_DIR.parent
        idx = content / "web" / "data" / "file-index.json"
        branding = content / "web" / "data" / "branding-grid-index.json"
        for label, path in (("file_index", idx), ("branding_grid_index", branding)):
            ok = path.is_file()
            size = path.stat().st_size if ok else 0
            report["checks"].append(
                {
                    "id": label,
                    "ok": ok and size > 0,
                    "path": str(path),
                    "size": size,
                    "mtime": path.stat().st_mtime if ok else None,
                }
            )
            if not ok or size <= 0:
                report["ok"] = False
    except Exception as exc:  # noqa: BLE001
        report["checks"].append({"id": "index_files", "ok": False, "error": str(exc)})
        report["ok"] = False

    try:
        import index_supervisor

        watcher = index_supervisor.public_status()
        report["checks"].append({"id": "index_watcher", "ok": bool(watcher.get("watcher_ok")), "detail": watcher})
        if not watcher.get("watcher_ok"):
            report["ok"] = False
    except Exception as exc:  # noqa: BLE001
        report["checks"].append({"id": "index_watcher", "ok": False, "error": str(exc)})

    report["duration_ms"] = round((time.time() - t0) * 1000, 1)
    append_event("self_test", component="dam_debug", meta=report, duration_ms=report["duration_ms"])
    return report


_daemon_stop = threading.Event()
_daemon_thread: threading.Thread | None = None


def _daemon_loop(interval_sec: float = 60.0) -> None:
    while not _daemon_stop.is_set():
        try:
            rep = run_self_test()
            append_event(
                "health_tick",
                component="debug_daemon",
                meta={"ok": rep.get("ok"), "checks": len(rep.get("checks") or [])},
                duration_ms=rep.get("duration_ms"),
            )
        except Exception as exc:  # noqa: BLE001
            append_event("health_tick_error", component="debug_daemon", level="error", meta={"error": str(exc)})
        _daemon_stop.wait(interval_sec)


def ensure_daemon_started(interval_sec: float = 60.0) -> None:
    global _daemon_thread
    if _daemon_thread and _daemon_thread.is_alive():
        return

    def _run() -> None:
        _daemon_loop(interval_sec)

    _daemon_thread = threading.Thread(target=_run, name="dam-debug-daemon", daemon=True)
    _daemon_thread.start()
    append_event("debug_daemon_started", component="debug_daemon", meta={"interval_sec": interval_sec})
