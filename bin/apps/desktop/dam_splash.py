# -*- coding: utf-8 -*-
"""Plansza startowa DAM w stylu Dobra Kaloria (2.5.2, 2026-09-30).

Uzytkownik czekal na okno bez zadnego znaku zycia: DAM.exe -> silnik -> launch.py sprawdza
baze, przejmuje porty, stawia most i serwer UI, dopiero potem otwiera okno WebView2.
Plansza (bin/apps/web/dam-splash.html, 560x330) pokazuje sie na poczatku launch.main()
i znika, gdy okno programu wczyta pierwsza strone.

Osobny proces (a nie drugie okno w procesie aplikacji): blad planszy nie moze zatrzymac
startu programu, a plansza nie czeka na petle GUI, ktora rusza dopiero na koncu main().

Zasady:
- nigdy nad oknem programu (on_top=False, focus=False) i nigdy go nie blokuje;
- zamyka sie, gdy okno jest gotowe (plik-flaga "ready"), gdy proces programu zniknie,
  albo po 120 s (twardy limit);
- przewidywany czas = zmierzony czas poprzedniego startu (user_state_dir()/splash-eta.json);
  pierwszy start: 6 s z dysku lokalnego, 15 s z dysku sieciowego.

Wylaczenie: DAM_NO_SPLASH=1.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

_DESKTOP = Path(__file__).resolve().parent
if str(_DESKTOP) not in sys.path:
    sys.path.insert(0, str(_DESKTOP))

HARD_LIMIT_SEC = 120.0
DEFAULT_ETA_LOCAL = 6.0
DEFAULT_ETA_NETWORK = 15.0
WIDTH, HEIGHT = 560, 330
SPLASH_TITLE = "DAM Dobra Kaloria - uruchamianie"
SPLASH_HTML = _DESKTOP.parent / "web" / "dam-splash.html"


def _state_file() -> Path:
    try:
        from platform_compat import user_state_dir

        return user_state_dir() / "splash-eta.json"
    except Exception:  # noqa: BLE001 - plansza nie moze wywrocic startu
        return Path(tempfile.gettempdir()) / "dam-splash-eta.json"


def install_on_network(path: Path | None = None) -> bool:
    p = str(path or _DESKTOP)
    if p.startswith("\\\\") or p.startswith("//"):
        return True
    if sys.platform == "win32" and len(p) >= 2 and p[1] == ":":
        try:
            import ctypes

            return int(ctypes.windll.kernel32.GetDriveTypeW(p[:2] + "\\")) == 4  # DRIVE_REMOTE
        except Exception:  # noqa: BLE001
            return False
    return False


def expected_seconds(state_file: Path | None = None, install_path: Path | None = None) -> float:
    try:
        data = json.loads((state_file or _state_file()).read_text(encoding="utf-8"))
        value = float(data.get("last_start_sec") or 0)
        if 1.0 <= value <= HARD_LIMIT_SEC:
            return value
    except Exception:  # noqa: BLE001 - brak / uszkodzony plik = wartosc domyslna
        pass
    return DEFAULT_ETA_NETWORK if install_on_network(install_path) else DEFAULT_ETA_LOCAL


def save_duration(seconds: float, state_file: Path | None = None) -> None:
    if not (0.5 <= seconds <= HARD_LIMIT_SEC):
        return
    try:
        (state_file or _state_file()).write_text(
            json.dumps({"last_start_sec": round(seconds, 2), "saved_at": time.strftime("%Y-%m-%dT%H:%M:%S")}),
            encoding="utf-8",
        )
    except Exception:  # noqa: BLE001
        pass


class SplashHandle:
    """Strona programu: start() -> ready() albo close(). Wszystko bez wyjatkow na zewnatrz."""

    def __init__(self) -> None:
        self.t0 = time.monotonic()
        self.flag: Path | None = None
        self.proc: subprocess.Popen | None = None
        self.done = False

    def _signal(self, word: str) -> None:
        if self.done:
            return
        self.done = True
        if self.flag is None:
            return
        try:
            self.flag.write_text(word, encoding="utf-8")
        except Exception:  # noqa: BLE001
            pass

    def ready(self) -> None:
        """Okno programu wczytalo strone: zapisz czas startu, plansza domyka pasek i znika."""
        if self.done:
            return
        save_duration(time.monotonic() - self.t0)
        self._signal("ready")

    def close(self) -> None:
        """Start przerwany (np. druga kopia programu, blad): plansza znika bez zapisu czasu."""
        self._signal("close")


def start() -> SplashHandle:
    handle = SplashHandle()
    if (os.environ.get("DAM_NO_SPLASH") or "").strip() in ("1", "true", "yes"):
        handle.done = True
        return handle
    try:
        if not SPLASH_HTML.is_file():
            handle.done = True
            return handle
        fd, name = tempfile.mkstemp(prefix="dam-splash-", suffix=".flag")
        os.close(fd)
        handle.flag = Path(name)
        from bridge_supervisor import payload_script_cmd

        cmd = payload_script_cmd(Path(__file__).resolve(), "splash") + [
            "--eta", f"{expected_seconds():.2f}",
            "--flag", str(handle.flag),
            "--parent", str(os.getpid()),
            "--t0", str(int(time.time() * 1000)),
        ]
        kwargs: dict = {}
        if sys.platform == "win32":
            # Bez STARTUPINFO/SW_HIDE - to okno ma byc widoczne. CREATE_NO_WINDOW = bez konsoli.
            kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
        else:
            kwargs["start_new_session"] = True
        handle.proc = subprocess.Popen(
            cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kwargs
        )
    except Exception:  # noqa: BLE001 - bez planszy program startuje jak dotad
        handle.done = True
    return handle


# ---------------------------------------------------------------------------
# Proces planszy
# ---------------------------------------------------------------------------


def _parent_alive(pid: int) -> bool:
    if pid <= 0:
        return True
    if sys.platform == "win32":
        # UWAGA: os.kill(pid, 0) na Windows wola TerminateProcess - nie uzywac.
        try:
            import ctypes

            k32 = ctypes.windll.kernel32
            h = k32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
            if not h:
                return False
            try:
                code = ctypes.c_ulong(0)
                if not k32.GetExitCodeProcess(h, ctypes.byref(code)):
                    return True
                return code.value == 259  # STILL_ACTIVE
            finally:
                k32.CloseHandle(h)
        except Exception:  # noqa: BLE001
            return True
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except Exception:  # noqa: BLE001
        return True


def _read_flag(flag: Path) -> str:
    try:
        return flag.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return "close"
    except Exception:  # noqa: BLE001
        return ""


def run_splash(eta: float, flag: Path, parent: int, limit: float = HARD_LIMIT_SEC, started_ms: float = 0.0) -> int:
    import webview  # type: ignore

    started_ms = started_ms or time.time() * 1000.0

    # Czas w #fragmencie, nie w ?query: pywebview/WebView2 szukal pliku razem z "?eta=..."
    # i pokazywal "Nie mozna odnalezc pliku".
    # t0 = chwila startu programu (epoka, ms): pasek i "zostalo ok. N s" licza od startu,
    # a nie od chwili, gdy WebView2 narysuje strone (ok. 1-2 s pozniej).
    url = SPLASH_HTML.resolve().as_uri() + f"#eta={max(1.0, eta):.1f}&t0={int(started_ms)}"
    kwargs = dict(
        width=WIDTH,
        height=HEIGHT,
        resizable=False,
        frameless=True,
        on_top=False,
        background_color="#0F763E",
    )
    try:
        window = webview.create_window(SPLASH_TITLE, url, focus=False, easy_drag=False, **kwargs)
    except TypeError:  # starsze pywebview bez focus / easy_drag
        window = webview.create_window(SPLASH_TITLE, url, **kwargs)

    def fit() -> None:
        """Dokladnie 560x330 i srodek ekranu (WinForms bez ramki odejmowal obramowanie)."""
        try:
            window.resize(WIDTH, HEIGHT)
        except Exception:  # noqa: BLE001
            pass
        try:
            scr = (getattr(webview, "screens", None) or [None])[0]
            if scr is not None:
                window.move(int((scr.width - WIDTH) / 2), int((scr.height - HEIGHT) / 2))
        except Exception:  # noqa: BLE001
            pass
        if sys.platform == "win32":
            # Okno bez aktywacji (focus=False) Windows kladzie POD aktywnym oknem innego
            # programu - uzytkownik nie widzial planszy. Jednorazowo: na wierzch i od razu
            # z powrotem NIE-na-wierzchu (TOPMOST -> NOTOPMOST), bez odbierania fokusu.
            # Okno programu, gdy sie pokaze i aktywuje, i tak przykryje plansze.
            try:
                import ctypes

                u32 = ctypes.windll.user32
                hwnd = u32.FindWindowW(None, SPLASH_TITLE)
                flags = 0x0001 | 0x0002 | 0x0010 | 0x0040  # NOSIZE|NOMOVE|NOACTIVATE|SHOWWINDOW
                if hwnd:
                    u32.SetWindowPos(hwnd, -1, 0, 0, 0, 0, flags)
                    u32.SetWindowPos(hwnd, -2, 0, 0, 0, 0, flags)
            except Exception:  # noqa: BLE001
                pass

    def watch() -> None:
        t0 = time.monotonic()
        fit()
        while True:
            time.sleep(0.15)
            state = _read_flag(flag)
            if state == "ready":
                try:
                    window.evaluate_js("window.damSplashDone && window.damSplashDone()")
                except Exception:  # noqa: BLE001
                    pass
                time.sleep(0.45)
                break
            if state == "close" or not _parent_alive(parent) or time.monotonic() - t0 > limit:
                break
        try:
            window.destroy()
        except Exception:  # noqa: BLE001
            pass
        try:
            flag.unlink()
        except Exception:  # noqa: BLE001
            pass

    # Staly profil WebView2 planszy (nie nowy katalog tymczasowy przy kazdym starcie):
    # zimny profil to ok. 2-3 s pustej zieleni, zanim pojawi sie tresc.
    start_kwargs: dict = {"private_mode": False, "debug": False}
    try:
        prof = _state_file().parent / "splash-webview"
        prof.mkdir(parents=True, exist_ok=True)
        start_kwargs["storage_path"] = str(prof)
    except Exception:  # noqa: BLE001
        start_kwargs["private_mode"] = True
    if sys.platform == "win32":
        start_kwargs["gui"] = "edgechromium"
    try:
        webview.start(watch, **start_kwargs)
    except TypeError:
        webview.start(watch)
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Plansza startowa DAM (Dobra Kaloria)")
    ap.add_argument("--eta", type=float, default=DEFAULT_ETA_LOCAL)
    ap.add_argument("--flag", required=True)
    ap.add_argument("--parent", type=int, default=0)
    ap.add_argument("--limit", type=float, default=HARD_LIMIT_SEC)
    ap.add_argument("--t0", type=float, default=0.0, help="start programu, ms od epoki")
    args = ap.parse_args(argv)
    try:
        return run_splash(args.eta, Path(args.flag), args.parent, min(args.limit, HARD_LIMIT_SEC), args.t0)
    except Exception:  # noqa: BLE001 - plansza nigdy nie pokazuje bledu uzytkownikowi
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
