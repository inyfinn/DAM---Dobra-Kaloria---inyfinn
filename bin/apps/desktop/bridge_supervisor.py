"""Local bridge (8766) supervisor - shared by launch.py and serve_browser.py."""
from __future__ import annotations

import json
import subprocess
import tempfile
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from runtime_config import DESKTOP_DIR, HOST, env_for_bridge

LOCAL_BRIDGE = DESKTOP_DIR / "local_bridge.py"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)

# Log bledow startu mostu POZA bundlem .app - zapis do wnetrza podpisanej
# aplikacji uniewaznia pieczec podpisu, a w /Applications zwykle nie ma praw.
if sys.platform == "darwin":
    _LOG_DIR = Path.home() / "Library" / "Logs" / "DAM"
else:
    _LOG_DIR = DESKTOP_DIR / "data"
try:
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    _LOG_DIR = Path(tempfile.gettempdir())
BRIDGE_STDERR_LOG = _LOG_DIR / "bridge-stderr.log"


def _silent_python() -> str:
    exe = Path(sys.executable)
    if exe.name.lower() == "python.exe":
        pw = exe.with_name("pythonw.exe")
        if pw.is_file():
            return str(pw)
    return str(exe)


def is_frozen() -> bool:
    """PyInstaller: sys.executable to binarka aplikacji, NIE interpreter."""
    return bool(getattr(sys, "frozen", False))


def payload_script_cmd(script: Path, run_name: str | None = None) -> list[str]:
    """Polecenie uruchamiajace skrypt payloadu - dziala tez w zamrozonej .app.

    Windows: dam_root_launcher.py re-exec-uje w bin/runtime/win/python/pythonw.exe,
    wiec sys.executable jest PRAWDZIWYM interpreterem i [exe, skrypt] dziala.

    macOS (.app): DAM-macos.spec zamraza cienki shim, ktory odpala kod przez
    runpy W TYM SAMYM PROCESIE - zadnego interpretera na dysku nie ma.
    sys.executable to DAM.app/Contents/MacOS/DAM, wiec [exe, skrypt] uruchamialo
    CALA APLIKACJE OD NOWA z ignorowanym argumentem, a nie skrypt. Most na 8766
    nigdy nie wstawal, a supervise() respawnowal kolejne kopie co 2,5 s.

    W trybie zamrozonym uzywamy wiec sentinela shima: [exe, "--run", <cel>],
    gdzie <cel> to nazwa z bialej listy dam_mac_shim.RUNNABLE (nie sciezka).
    """
    if not is_frozen():
        return [_silent_python(), str(script)]
    name = run_name or script.stem.replace("_", "-")
    return [str(sys.executable), "--run", name]


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
        self.last_error = ""

    def start(self) -> subprocess.Popen | None:
        if not LOCAL_BRIDGE.is_file():
            # Nie polykaj powodu - inaczej UI mowi tylko "most niedostepny".
            self.last_error = f"brak pliku mostu: {LOCAL_BRIDGE}"
            return None
        flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
        cmd = payload_script_cmd(LOCAL_BRIDGE, run_name="bridge")
        # stderr do pliku, nie do DEVNULL: gdy most padnie przy imporcie
        # (brakujace kolo arm64, brak praw zapisu), to jedyny slad dla diagnozy.
        try:
            err = open(BRIDGE_STDERR_LOG, "ab", buffering=0)
        except OSError:
            err = subprocess.DEVNULL
        try:
            return subprocess.Popen(
                cmd,
                cwd=str(DESKTOP_DIR),
                env=env_for_bridge(self.ui_port, self.bridge_port),
                creationflags=flags,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=err,
            )
        except OSError as exc:
            self.last_error = f"spawn mostu nieudany ({cmd[0]}): {exc}"
            return None

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
