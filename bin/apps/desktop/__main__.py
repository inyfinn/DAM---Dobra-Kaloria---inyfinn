# -*- coding: utf-8 -*-
"""python apps/desktop/__main__.py

Windows: same as launch.py (WebView2).
macOS: HTTP UI on :8765 + optional pywebview (cocoa); else system browser.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_DESKTOP = Path(__file__).resolve().parent
if str(_DESKTOP) not in sys.path:
    sys.path.insert(0, str(_DESKTOP))


def _alert(message: str) -> None:
    """Okno komunikatu na macOS (bez GUI aplikacji - UI jeszcze nie wstal)."""
    print(message, file=sys.stderr)
    safe = message.replace("\\", "\\\\").replace('"', '\\"')
    try:
        subprocess.Popen(
            [
                "osascript",
                "-e",
                f'display dialog "{safe}" buttons {{"OK"}} default button "OK" '
                'with icon caution with title "DAM"',
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        pass


def _mac_takeover() -> None:
    """29.09.2026: po podmianie DAM.app (2.4.7 -> 2.4.9) stary most zyl w tle
    i nowa aplikacja logowala sie przez niego do starej bazy. Na macOS nie ma
    instalatora, ktory ubija stare procesy - przejmujemy porty sami, ZANIM
    serwer UI sprobuje zajac 8765, a nadzorca uzyje mostu na 8766."""
    import bridge_supervisor as bs
    from runtime_config import DEFAULT_BRIDGE_PORT, DEFAULT_UI_PORT

    try:
        res = bs.takeover_stale_services(DEFAULT_UI_PORT, DEFAULT_BRIDGE_PORT)
    except Exception as exc:  # noqa: BLE001 - przejecie nie moze wywrocic startu
        print(f"takeover: {exc}", file=sys.stderr)
        return
    if res.get("ok"):
        ui = res.get("ui") or {}
        if ui.get("verdict") == "foreign":
            _alert(
                f"Port {DEFAULT_UI_PORT} zajmuje inny program niż DAM - zamknij go "
                "albo uruchom komputer ponownie."
            )
            raise SystemExit(1)
        return
    message = str(res.get("message") or bs.STALE_MESSAGE)
    _alert(message)
    ui = res.get("ui") or {}
    if not ui.get("ok", True):
        # Stary serwer UI trzyma 8765: nowy by sie nie zbindowal, a okno pokazaloby
        # stare HTML/JS. Lepiej jasny komunikat niz ciche uzycie starej wersji.
        raise SystemExit(1)
    # Stary most, ktorego nie dalo sie zatrzymac: UI wstaje, ale nadzorca go nie
    # uzyje, a logowanie pokaze ten sam komunikat (stale_bridge_running).


def main() -> None:
    if sys.platform == "darwin":
        _mac_takeover()
        from dam_macos import main as mac_main

        mac_main()
        return
    from launch import main as win_main

    win_main()


if __name__ == "__main__":
    main()
