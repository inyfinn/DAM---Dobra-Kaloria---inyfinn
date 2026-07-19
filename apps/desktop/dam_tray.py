# -*- coding: utf-8 -*-
"""Ikona w zasobniku systemowym Windows dla DAM (pystray + Pillow)."""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Callable

_ICON_PATH = Path(__file__).resolve().parent / "dam_app.ico"


def _load_image():
    from PIL import Image, ImageDraw

    if _ICON_PATH.is_file():
        return Image.open(_ICON_PATH).convert("RGBA")
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((4, 4, 60, 60), fill=(171, 84, 219, 255))
    draw.text((18, 22), "DK", fill=(255, 255, 255, 255))
    return img


def start_tray(
    *,
    title: str,
    on_show: Callable[[], None] | None = None,
    on_quit: Callable[[], None] | None = None,
) -> threading.Event | None:
    """Uruchom ikone w tle. Zwraca event ustawiany przy calkowitym zamknieciu."""
    if threading.current_thread() is not threading.main_thread():
        # pystray wymaga glownego watku na czesci platform; launch.py odpala w daemon thread.
        pass
    try:
        import pystray
    except ImportError:
        return None

    stop = threading.Event()
    icon_holder: dict[str, object] = {}

    def _show(_icon, _item) -> None:
        if on_show:
            on_show()

    def _quit(_icon, _item) -> None:
        stop.set()
        if on_quit:
            on_quit()
        icon = icon_holder.get("icon")
        if icon is not None:
            icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem("Pokaz okno DAM", _show, default=True),
        pystray.MenuItem("Zatrzymaj DAM calkowicie", _quit),
    )
    icon = pystray.Icon(title, _load_image(), title, menu)
    icon_holder["icon"] = icon

    def _run() -> None:
        icon.run()

    threading.Thread(target=_run, name="dam-tray", daemon=True).start()
    return stop
