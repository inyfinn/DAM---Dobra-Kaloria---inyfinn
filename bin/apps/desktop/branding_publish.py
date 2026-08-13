# -*- coding: utf-8 -*-
"""Branding slim/full grid publish helpers (SQLite Path argv + debounced lock).

Keeps local_bridge thin: --from-sqlite MUST receive an explicit Path
(argparse type=Path on build-branding-grid-index.py).
"""
from __future__ import annotations

import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable

from rebuild_lock import acquire_lock

DEFAULT_DEBOUNCE_SEC = 2.0
DEFAULT_LOCK_TTL_SEC = 7200.0


def canonical_sqlite_path(
    *,
    dam_db_module: Any = None,
    desktop_dir: Path | None = None,
) -> Path:
    if dam_db_module is not None:
        p = getattr(dam_db_module, "DB_CANONICAL", None)
        if p is not None:
            return Path(p)
    base = Path(desktop_dir) if desktop_dir is not None else Path(__file__).resolve().parent
    return base.parent.parent / "DATABASE" / "dam-local.sqlite"


def grid_from_sqlite_argv(
    grid_script: Path,
    sqlite_path: Path,
    *,
    python_exe: str | None = None,
) -> list[str]:
    """Build argv: python build-branding-grid-index.py --from-sqlite <Path>."""
    exe = python_exe or sys.executable
    db = Path(sqlite_path)
    return [exe, str(grid_script), "--from-sqlite", str(db)]


class SlimGridPublisher:
    """One pending timer/generation; runner uses shared branding O_EXCL lock."""

    def __init__(
        self,
        *,
        grid_script: Path,
        lock_file: Path,
        sqlite_path: Path,
        invalidate_caches: Callable[[], None],
        write_status: Callable[[dict[str, Any] | None], None],
        append_log: Callable[[str], None],
        generation_id_fn: Callable[[], str],
        state: dict[str, Any],
        state_lock: threading.Lock,
        debounce_sec: float = DEFAULT_DEBOUNCE_SEC,
        lock_ttl_sec: float = DEFAULT_LOCK_TTL_SEC,
        subprocess_call: Callable[..., int] | None = None,
    ) -> None:
        self.grid_script = Path(grid_script)
        self.lock_file = Path(lock_file)
        self.sqlite_path = Path(sqlite_path)
        self.invalidate_caches = invalidate_caches
        self.write_status = write_status
        self.append_log = append_log
        self.generation_id_fn = generation_id_fn
        self.state = state
        self.state_lock = state_lock
        self.debounce_sec = float(debounce_sec)
        self.lock_ttl_sec = float(lock_ttl_sec)
        self._subprocess_call = subprocess_call or subprocess.call
        self._timer_lock = threading.Lock()
        self._timer: threading.Timer | None = None
        self._generation = 0

    def argv(self) -> list[str]:
        return grid_from_sqlite_argv(self.grid_script, self.sqlite_path)

    def schedule(self, delay_sec: float | None = None) -> int:
        if not self.grid_script.is_file():
            return self._generation
        delay = self.debounce_sec if delay_sec is None else float(delay_sec)
        with self._timer_lock:
            self._generation += 1
            gen = self._generation
            if self._timer is not None:
                try:
                    self._timer.cancel()
                except Exception:
                    pass
                with self.state_lock:
                    self.state["slim_coalesced"] = int(self.state.get("slim_coalesced") or 0) + 1
            with self.state_lock:
                self.state["slim_pending"] = True
                self.state["stage"] = "slim_debounced"
            self.write_status(
                {
                    "slim_result": "scheduled",
                    "slim_timer_gen": gen,
                    "slim_delay_sec": delay,
                }
            )
            self.append_log(f"slim_grid_publish scheduled gen={gen} delay={delay}")

            def _fire(g: int = gen) -> None:
                self.run(g)

            t = threading.Timer(max(0.2, delay), _fire)
            t.daemon = True
            self._timer = t
            t.start()
            return gen

    def run(self, scheduled_gen: int) -> None:
        with self._timer_lock:
            if scheduled_gen != self._generation:
                self.append_log(
                    f"slim_grid_publish skipped_stale_timer gen={scheduled_gen} current={self._generation}"
                )
                return

        if not self.grid_script.is_file():
            with self.state_lock:
                self.state["slim_pending"] = False
                self.state["slim_last_ok"] = False
                self.state["slim_last_error"] = "grid_builder_missing"
                self.state["slim_last_finished"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            self.write_status(None)
            self.append_log("slim_grid_publish error grid_builder_missing")
            return

        lock_handle, meta = acquire_lock(
            self.lock_file,
            stage="branding:slim_starting",
            ttl_sec=self.lock_ttl_sec,
            extra={
                "owner": "local_bridge_slim",
                "mode": "slim",
                "generation_id": self.generation_id_fn(),
            },
        )
        if lock_handle is None:
            with self.state_lock:
                self.state["slim_coalesced"] = int(self.state.get("slim_coalesced") or 0) + 1
                self.state["slim_pending"] = True
                self.state["slim_last_error"] = "lock_held_reschedule"
                self.state["stage"] = "slim_waiting_lock"
            self.write_status({"lock": meta.get("lock"), "slim_result": "rescheduled_lock_held"})
            self.append_log(f"slim_grid_publish reschedule lock_held lock={meta.get('lock')}")
            self.schedule(delay_sec=max(self.debounce_sec, 3.0))
            return

        try:
            with self.state_lock:
                self.state["slim_pending"] = False
                self.state["stage"] = "slim_grid_from_sqlite"
                self.state["generation_id"] = self.generation_id_fn()
            lock_handle.update(stage="branding:slim_grid_from_sqlite")
            self.write_status({"slim_result": "running"})
            cmd = self.argv()
            self.append_log(f"slim_grid_cmd {' '.join(cmd)}")
            _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
            rc = self._subprocess_call(cmd, creationflags=_no_win)
            if rc != 0:
                with self.state_lock:
                    self.state["slim_last_ok"] = False
                    self.state["slim_last_rc"] = rc
                    self.state["slim_last_error"] = f"slim_grid_rc_{rc}"
                    self.state["slim_last_finished"] = time.strftime(
                        "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
                    )
                    self.state["stage"] = "slim_error"
                self.write_status({"slim_result": "error", "slim_rc": rc})
                self.append_log(f"slim_grid_publish rc={rc}")
                return
            # Cache invalidate ONLY after rc=0; refresh generation from fat+SQLite.
            self.invalidate_caches()
            with self.state_lock:
                self.state["slim_last_ok"] = True
                self.state["slim_last_rc"] = 0
                self.state["slim_last_error"] = ""
                self.state["slim_last_finished"] = time.strftime(
                    "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
                )
                self.state["stage"] = "idle"
                self.state["generation_id"] = self.generation_id_fn()
            self.write_status({"slim_result": "ok", "slim_rc": 0})
            self.append_log(
                f"slim_grid_publish rc=0 generation_id={self.state.get('generation_id')}"
            )
        except Exception as exc:  # noqa: BLE001
            with self.state_lock:
                self.state["slim_last_ok"] = False
                self.state["slim_last_error"] = str(exc)
                self.state["slim_last_finished"] = time.strftime(
                    "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
                )
                self.state["stage"] = "slim_error"
            self.write_status({"slim_result": "error", "slim_error": str(exc)})
            self.append_log(f"slim_grid_publish error {exc}")
        finally:
            try:
                lock_handle.release()
            except Exception:
                pass

    def cancel(self) -> None:
        with self._timer_lock:
            if self._timer is not None:
                try:
                    self._timer.cancel()
                except Exception:
                    pass
                self._timer = None
