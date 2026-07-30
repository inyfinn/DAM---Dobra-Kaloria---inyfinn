"""
Upewnij sie, ze DAM UI (:8765) i most (:8766) dzialaja.

Uzycie:
  pythonw ensure_dam_running.py          # jednorazowo: start jesli martwe
  pythonw ensure_dam_running.py --watch  # w tle po logowaniu: pilnuje portow
  pythonw ensure_dam_running.py --open   # start + otworz przegladarke
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parent
SERVE_PY = DESKTOP_DIR / "serve_browser.py"
UI_PROBE = "http://127.0.0.1:8765/explorer.html"
BR_PROBE = "http://127.0.0.1:8766/health"
START_URL = "http://127.0.0.1:8765/dashboard.html"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
_STARTING = False


def _silent_python() -> str:
    exe = Path(sys.executable)
    if exe.name.lower() == "python.exe":
        pw = exe.with_name("pythonw.exe")
        if pw.is_file():
            return str(pw)
    return str(exe)


def _probe(url: str, timeout: float = 2.5) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return 200 <= int(resp.status) < 300
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return False


def services_up() -> bool:
    return _probe(UI_PROBE) and _probe(BR_PROBE)


def start_headless() -> bool:
    global _STARTING
    if _STARTING:
        return True
    if not SERVE_PY.is_file():
        return False
    _STARTING = True
    try:
        subprocess.Popen(
            [_silent_python(), str(SERVE_PY), "--headless"],
            cwd=str(DESKTOP_DIR),
            creationflags=CREATE_NO_WINDOW,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except OSError:
        return False
    finally:
        time.sleep(0.2)


def ensure(max_wait: float = 25.0) -> bool:
    if services_up():
        return True
    if not start_headless():
        return False
    deadline = time.time() + max_wait
    while time.time() < deadline:
        if services_up():
            return True
        time.sleep(0.45)
    return services_up()


def watch_loop(interval: float = 2.0) -> None:
    while True:
        if not services_up():
            start_headless()
            ensure(max_wait=20.0)
        time.sleep(max(0.5, interval))


def open_browser() -> None:
    import webbrowser

    try:
        webbrowser.open(START_URL)
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Ensure DAM browser stack is running")
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Petla w tle: gdy porty padna, uruchom ponownie (autostart Windows)",
    )
    parser.add_argument(
        "--open",
        action="store_true",
        help="Po starcie otworz dashboard w domyslnej przegladarce",
    )
    parser.add_argument("--interval", type=float, default=2.0, help="Interwal watch (s)")
    args = parser.parse_args()

    if args.watch:
        ensure(max_wait=25.0)
        watch_loop(args.interval)
        return

    ok = ensure()
    if ok and args.open:
        open_browser()
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
