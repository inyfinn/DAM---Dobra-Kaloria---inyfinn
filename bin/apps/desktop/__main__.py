# -*- coding: utf-8 -*-
"""python apps/desktop/__main__.py

Windows: same as launch.py (WebView2).
macOS: HTTP UI on :8765 + optional pywebview (cocoa); else system browser.
"""
from __future__ import annotations

import sys
from pathlib import Path

_DESKTOP = Path(__file__).resolve().parent
if str(_DESKTOP) not in sys.path:
    sys.path.insert(0, str(_DESKTOP))


def main() -> None:
    if sys.platform == "darwin":
        from dam_macos import main as mac_main

        mac_main()
        return
    from launch import main as win_main

    win_main()


if __name__ == "__main__":
    main()
