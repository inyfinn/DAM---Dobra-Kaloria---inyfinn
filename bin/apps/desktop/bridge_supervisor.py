"""Local bridge (8766) supervisor - shared by launch.py and serve_browser.py."""
from __future__ import annotations

import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from runtime_config import DESKTOP_DIR, HOST, env_for_bridge

LOCAL_BRIDGE = DESKTOP_DIR / "local_bridge.py"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)


def _silent_python() -> str:
    exe = Path(sys.executable)
    if exe.name.lower() == "python.exe":
        pw = exe.with_name("pythonw.exe")
        if pw.is_file():
            return str(pw)
    return str(exe)


def bridge_health(port: int, timeout: float = 2.5) -> dict | None:
    url = f"http://{HOST}:{int(port)}/health"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            raw = resp.read()
            if not raw:
                return None
            data = json.loads(raw.decode("utf-8", errors="replace"))
            return data if isinstance(data, dict) else None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def is_bridge_up(port: int, timeout: float = 2.5) -> bool:
    data = bridge_health(port, timeout=timeout)
    return bool(data and data.get("ok") is not False)


class BridgeSupervisor:
    """Start and keep local_bridge.py alive."""

    def __init__(self, ui_port: int, bridge_port: int) -> None:
        self.ui_port = int(ui_port)
        self.bridge_port = int(bridge_port)
        self._proc: subprocess.Popen | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()

    def start(self) -> subprocess.Popen | None:
        if not LOCAL_BRIDGE.is_file():
            return None
        flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
        return subprocess.Popen(
            [_silent_python(), str(LOCAL_BRIDGE)],
            cwd=str(DESKTOP_DIR),
            env=env_for_bridge(self.ui_port, self.bridge_port),
            creationflags=flags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def ensure_running(self, wait_s: float = 12.0) -> dict:
        """Idempotent: health OK -> noop; else spawn bridge and wait."""
        if is_bridge_up(self.bridge_port):
            return {
                "ok": True,
                "started": False,
                "port": self.bridge_port,
                "health": bridge_health(self.bridge_port),
            }

        with self._lock:
            if is_bridge_up(self.bridge_port):
                return {"ok": True, "started": False, "port": self.bridge_port}

            alive = self._proc is not None and self._proc.poll() is None
            if not alive:
                try:
                    self._proc = self.start()
                except Exception as exc:
                    return {
                        "ok": False,
                        "started": False,
                        "port": self.bridge_port,
                        "error": str(exc),
                    }

            deadline = time.monotonic() + max(1.0, wait_s)
            while time.monotonic() < deadline:
                if is_bridge_up(self.bridge_port, timeout=1.5):
                    return {
                        "ok": True,
                        "started": True,
                        "port": self.bridge_port,
                        "health": bridge_health(self.bridge_port),
                    }
                if self._proc and self._proc.poll() is not None:
                    try:
                        self._proc = self.start()
                    except Exception as exc:
                        return {
                            "ok": False,
                            "started": False,
                            "port": self.bridge_port,
                            "error": str(exc),
                        }
                time.sleep(0.35)

        return {
            "ok": False,
            "started": True,
            "port": self.bridge_port,
            "error": "bridge_start_timeout",
        }

    def supervise(self, interval_s: float = 2.5) -> None:
        while not self._stop.is_set():
            self._stop.wait(interval_s)
            if self._stop.is_set():
                break
            if is_bridge_up(self.bridge_port, timeout=1.5):
                continue
            with self._lock:
                if self._proc is None or self._proc.poll() is not None:
                    try:
                        self._proc = self.start()
                    except Exception:
                        pass

    def start_supervisor_thread(self, interval_s: float = 2.5) -> threading.Thread:
        thread = threading.Thread(
            target=self.supervise,
            args=(interval_s,),
            daemon=True,
            name="dam-bridge-supervisor",
        )
        thread.start()
        return thread

    def stop(self) -> None:
        self._stop.set()
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.terminate()
            except Exception:
                pass
