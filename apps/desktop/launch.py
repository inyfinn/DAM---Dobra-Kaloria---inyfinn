"""
DAM - Dobra Kaloria - Inyfinn - lokalna aplikacja desktop (pywebview + WebView2).

Uruchomienie: dwuklik skrotu na pulpicie albo:
  pythonw apps/desktop/launch.py

Nie wymaga recznego otwierania przegladarki ani wklejania adresow URL.
"""
from __future__ import annotations

import http.server
import os
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path

from runtime_config import (
    APP_TITLE,
    DEFAULT_BRIDGE_PORT,
    DEFAULT_UI_PORT,
    DESKTOP_DIR,
    HOST,
    MUTEX_NAME,
    WEB_ROOT,
    env_for_bridge,
    pick_free_port,
    runtime_payload,
    write_runtime_file,
)

LOCAL_BRIDGE = DESKTOP_DIR / "local_bridge.py"
WATCH_INDEX = WEB_ROOT / "scripts" / "watch-file-index.py"
ICON = DESKTOP_DIR / "dam_app.ico"
LAUNCH_SCRIPT = Path(__file__).resolve()
_MUTEX_HANDLE = None  # musi zyc do konca procesu (GC CloseHandle zwalnia mutex)
# Windows: ukryj konsole dzieci (bez mrugania CMD / ping)
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)


def _silent_python() -> str:
    """Preferuj pythonw.exe - brak okna konsoli przy starcie/relaunch."""
    exe = Path(sys.executable)
    if exe.name.lower() == "python.exe":
        pw = exe.with_name("pythonw.exe")
        if pw.is_file():
            return str(pw)
    return str(exe)


def win_message(title: str, text: str, icon: int = 0x10) -> None:
    if sys.platform != "win32":
        print(f"{title}: {text}")
        return
    try:
        import ctypes

        ctypes.windll.user32.MessageBoxW(0, text, title, icon)
    except Exception:
        print(f"{title}: {text}")


def _find_app_hwnd() -> int:
    """Znajdz widoczne okno o tytule zawierajacym APP_TITLE."""
    if sys.platform != "win32":
        return 0
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.windll.user32
        found = ctypes.c_void_p(0)
        needle = APP_TITLE.lower()

        @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        def enum_proc(hwnd, _lparam):  # noqa: ANN001
            if not user32.IsWindowVisible(hwnd):
                return True
            buf = ctypes.create_unicode_buffer(512)
            user32.GetWindowTextW(hwnd, buf, 512)
            title = (buf.value or "").lower()
            if needle in title and "cursor" not in title:
                found.value = hwnd
                return False
            return True

        user32.EnumWindows(enum_proc, 0)
        return int(found.value or 0)
    except Exception:
        return 0


def _focus_existing_window() -> bool:
    hwnd = _find_app_hwnd()
    if not hwnd:
        return False
    try:
        import ctypes

        user32 = ctypes.windll.user32
        SW_RESTORE = 9
        user32.ShowWindow(hwnd, SW_RESTORE)
        user32.SetForegroundWindow(hwnd)
        return True
    except Exception:
        return False


def _kill_stale_dam_processes() -> int:
    """Ubija zombie launch / bridge / serve_browser / http.server:8765 (nie siebie).

    Dev czasem zostawia `serve_browser.py` albo `python -m http.server 8765`
    bez okna desktop - wtedy skrot wyglada jakby "nie chcial sie otworzyc"
    (mutex / porty / Pliki offline).
    """
    if sys.platform != "win32":
        return 0
    my_pid = os.getpid()
    launch_key = str(LAUNCH_SCRIPT).lower().replace("/", "\\")
    bridge_key = str(LOCAL_BRIDGE).lower().replace("/", "\\")
    serve_key = str((DESKTOP_DIR / "serve_browser.py").resolve()).lower().replace("/", "\\")
    web_key = str(WEB_ROOT.resolve()).lower().replace("/", "\\")
    try:
        ps = (
            f"$mine={my_pid};"
            f"$a='{launch_key.replace(chr(39), chr(39)+chr(39))}';"
            f"$b='{bridge_key.replace(chr(39), chr(39)+chr(39))}';"
            f"$c='{serve_key.replace(chr(39), chr(39)+chr(39))}';"
            f"$w='{web_key.replace(chr(39), chr(39)+chr(39))}';"
            "Get-CimInstance Win32_Process -Filter \"Name='pythonw.exe' OR Name='python.exe'\" | "
            "Where-Object { "
            "  $_.ProcessId -ne $mine -and $_.CommandLine -and ("
            "    $_.CommandLine.ToLower().Contains($a) -or "
            "    $_.CommandLine.ToLower().Contains($b) -or "
            "    $_.CommandLine.ToLower().Contains($c) -or "
            "    ($_.CommandLine.ToLower().Contains('http.server') -and "
            "     $_.CommandLine.ToLower().Contains('8765') -and "
            "     $_.CommandLine.ToLower().Contains('web'))"
            "  )"
            "} | ForEach-Object { "
            "  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId "
            "}"
        )
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True,
            text=True,
            timeout=20,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        lines = [ln.strip() for ln in (proc.stdout or "").splitlines() if ln.strip().isdigit()]
        killed = len(lines)
    except Exception:
        killed = 0
    if killed:
        time.sleep(0.8)
    return killed


def acquire_single_instance() -> bool:
    global _MUTEX_HANDLE
    if sys.platform != "win32":
        return True
    try:
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.windll.kernel32
        kernel32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
        kernel32.CreateMutexW.restype = wintypes.HANDLE
        kernel32.GetLastError.restype = wintypes.DWORD
        ERROR_ALREADY_EXISTS = 183

        def try_create() -> tuple[object, bool]:
            ctypes.windll.kernel32.SetLastError(0)
            handle = kernel32.CreateMutexW(None, False, MUTEX_NAME)
            exists = kernel32.GetLastError() == ERROR_ALREADY_EXISTS
            return handle, exists

        handle, exists = try_create()
        if not exists:
            _MUTEX_HANDLE = handle
            return True

        # Juz dziala: sprobuj przywrocic okno
        if _focus_existing_window():
            try:
                kernel32.CloseHandle(handle)
            except Exception:
                pass
            return False

        # Zombie: proces zyje, okno zniknelo (typowy objaw po restarcie / crashu WebView)
        try:
            kernel32.CloseHandle(handle)
        except Exception:
            pass
        killed = _kill_stale_dam_processes()
        handle2, exists2 = try_create()
        if not exists2:
            _MUTEX_HANDLE = handle2
            return True

        try:
            kernel32.CloseHandle(handle2)
        except Exception:
            pass
        win_message(
            APP_TITLE,
            "DAM wyglada na uruchomiony, ale okno nie jest widoczne.\n\n"
            f"Usunieto zombie procesow: {killed}.\n"
            "Zamknij pythonw w Menedzerze zadan albo uruchom ponownie skrot.",
        )
        return False
    except Exception:
        return True


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


class DamUiHandler(http.server.SimpleHTTPRequestHandler):
    runtime: dict

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):  # noqa: N802
        if self.path.split("?", 1)[0] == "/dam-runtime.json":
            body = json_bytes(self.runtime)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def json_bytes(payload: dict) -> bytes:
    import json

    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def start_bridge(ui_port: int, bridge_port: int) -> subprocess.Popen | None:
    if not LOCAL_BRIDGE.exists():
        return None
    flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
    return subprocess.Popen(
        [_silent_python(), str(LOCAL_BRIDGE)],
        cwd=str(DESKTOP_DIR),
        env=env_for_bridge(ui_port, bridge_port),
        creationflags=flags,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def start_index_watcher() -> subprocess.Popen | None:
    """Odswiezanie miniatur/indeksu co ~5s gdy zmienisz pliki w WIZKI."""
    if not WATCH_INDEX.is_file():
        return None
    try:
        flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
        return subprocess.Popen(
            [_silent_python(), str(WATCH_INDEX), "--interval", "5"],
            cwd=str(WEB_ROOT.parent.parent),
            creationflags=flags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        return None


def start_ui_server(ui_port: int, bridge_port: int) -> tuple[socketserver.TCPServer, threading.Thread]:
    runtime = runtime_payload(ui_port, bridge_port)
    write_runtime_file(ui_port, bridge_port)

    class Handler(DamUiHandler):
        pass

    Handler.runtime = runtime
    httpd = ReusableTCPServer((HOST, ui_port), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, thread


def require_pywebview():
    try:
        import webview  # type: ignore

        return webview
    except ImportError:
        win_message(
            APP_TITLE,
            "Brak biblioteki pywebview.\n\n"
            "Zainstaluj zaleznosci desktop:\n"
            "  pip install -r apps/desktop/requirements.txt\n\n"
            "Potem uruchom ponownie skrot DAM.",
        )
        raise SystemExit(1)


def schedule_relaunch() -> None:
    """Uruchom ponownie launch.py po zwolnieniu mutexa (opoznienie ~1.5s).

    Windows: BEZ cmd / ping / start - te komendy pokazywaly czarne okno konsoli.
    Delay + relaunch w ukrytym procesie pythonw + CREATE_NO_WINDOW.
    """
    exe = _silent_python()
    script = str(LAUNCH_SCRIPT)
    cwd = str(DESKTOP_DIR)
    if sys.platform == "win32":
        # Delay + relaunch bez shell/cmd/ping (te pokazywaly czarne okno).
        code = (
            "import time,subprocess;"
            "time.sleep(1.5);"
            "subprocess.Popen(%r, cwd=%r, creationflags=%d, "
            "stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)"
        ) % ([exe, script], cwd, CREATE_NO_WINDOW)
        flags = (
            subprocess.DETACHED_PROCESS
            | subprocess.CREATE_NEW_PROCESS_GROUP
            | CREATE_NO_WINDOW
        )
        subprocess.Popen(
            [exe, "-c", code],
            cwd=cwd,
            creationflags=flags,
            close_fds=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    subprocess.Popen(
        [exe, script],
        cwd=cwd,
        start_new_session=True,
    )


class DamJsApi:
    """API JS -> Python (pywebview). Ustawienia: restart okna + picker miniatury."""

    def __init__(self) -> None:
        self._restart_scheduled = False

    def _start_dir(self, directory: str = "") -> str:
        start_dir = (directory or "").strip()
        if start_dir and not os.path.isdir(start_dir):
            parent = os.path.dirname(start_dir)
            if os.path.isdir(parent):
                start_dir = parent
            else:
                start_dir = ""
        return start_dir

    def pick_thumb(self, directory: str = "") -> dict:
        """Natywny dialog wyboru pliku obrazu (miniatura) w folderze produktu."""
        try:
            import webview  # type: ignore
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

        start_dir = self._start_dir(directory)
        windows = list(getattr(webview, "windows", []) or [])
        if not windows:
            return {"ok": False, "error": "no_window"}
        win = windows[0]
        try:
            file_types = (
                "Obrazy (*.png;*.jpg;*.jpeg;*.webp;*.gif;*.tif;*.tiff)",
                "Wszystkie (*.*)",
            )
            result = win.create_file_dialog(
                webview.OPEN_DIALOG,
                directory=start_dir or None,
                allow_multiple=False,
                file_types=file_types,
            )
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

        if not result:
            return {"ok": False, "cancelled": True}
        path = result[0] if isinstance(result, (list, tuple)) else result
        path = str(path or "").strip()
        if not path or not os.path.isfile(path):
            return {"ok": False, "cancelled": True}
        return {
            "ok": True,
            "path": path.replace("\\", "/"),
            "file": os.path.basename(path),
        }

    def pick_folder(self, directory: str = "") -> dict:
        """Natywny dialog Windows: wskaz folder (Marketing / sciezka bazowa)."""
        try:
            import webview  # type: ignore
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

        start_dir = self._start_dir(directory)
        # #region agent log
        try:
            import json as _json
            import time as _time
            from pathlib import Path as _Path

            _log = _Path(__file__).resolve().parents[2] / "debug-a78fa0.log"
            with open(_log, "a", encoding="utf-8") as _f:
                _f.write(
                    _json.dumps(
                        {
                            "sessionId": "a78fa0",
                            "hypothesisId": "D",
                            "location": "launch.py:pick_folder",
                            "message": "folder dialog start",
                            "data": {
                                "requested": (directory or "")[:120],
                                "start_dir": (start_dir or "")[:120],
                                "start_empty": not bool(start_dir),
                            },
                            "timestamp": int(_time.time() * 1000),
                            "runId": "pre-fix",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        windows = list(getattr(webview, "windows", []) or [])
        if not windows:
            return {"ok": False, "error": "no_window"}
        win = windows[0]
        try:
            result = win.create_file_dialog(
                webview.FOLDER_DIALOG,
                directory=start_dir or None,
                allow_multiple=False,
            )
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

        if not result:
            return {"ok": False, "cancelled": True}
        path = result[0] if isinstance(result, (list, tuple)) else result
        path = str(path or "").strip()
        if not path or not os.path.isdir(path):
            return {"ok": False, "cancelled": True}
        # #region agent log
        try:
            import json as _json
            import time as _time
            from pathlib import Path as _Path

            _log = _Path(__file__).resolve().parents[2] / "debug-a78fa0.log"
            with open(_log, "a", encoding="utf-8") as _f:
                _f.write(
                    _json.dumps(
                        {
                            "sessionId": "a78fa0",
                            "hypothesisId": "D",
                            "location": "launch.py:pick_folder:result",
                            "message": "folder dialog result",
                            "data": {
                                "picked_tail": path[-90:],
                                "is_documents": ("Dokumenty" in path) or ("Documents" in path),
                                "is_marketing": "Marketing" in path,
                            },
                            "timestamp": int(_time.time() * 1000),
                            "runId": "pre-fix",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        return {
            "ok": True,
            "path": path.replace("/", "\\"),
            "folder": os.path.basename(path.rstrip("\\/")) or path,
        }

    def restart_window(self) -> dict:
        if self._restart_scheduled:
            return {"ok": True, "status": "already_scheduled"}
        self._restart_scheduled = True
        try:
            schedule_relaunch()
        except Exception as exc:
            self._restart_scheduled = False
            return {"ok": False, "error": str(exc)}

        def _close() -> None:
            try:
                import webview  # type: ignore

                for win in list(webview.windows):
                    try:
                        win.destroy()
                    except Exception:
                        pass
            except Exception:
                os._exit(0)

        threading.Thread(target=_close, daemon=True).start()
        return {"ok": True, "status": "restarting"}


def preferred_window_size() -> tuple[int, int]:
    """Szerokie okno startowe: UI miesci sie bez scrolla poziomego."""
    width, height = 1680, 1000
    if sys.platform == "win32":
        try:
            import ctypes

            user32 = ctypes.windll.user32
            sw = int(user32.GetSystemMetrics(0) or 0)  # SM_CXSCREEN
            sh = int(user32.GetSystemMetrics(1) or 0)  # SM_CYSCREEN
            if sw > 0 and sh > 0:
                # ~92% szerokosci / ~88% wysokosci, z buforem na taskbar
                width = max(1480, min(1920, int(sw * 0.92)))
                height = max(900, min(1200, int(sh * 0.88)))
        except Exception:
            pass
    return width, height


def apply_native_window_icon(icon_path: str) -> None:
    """Ustaw ikone tytulu/taskbara przez WM_SETICON (fallback gdy pythonw)."""
    if sys.platform != "win32" or not icon_path or not os.path.isfile(icon_path):
        return
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.windll.user32
        IMAGE_ICON = 1
        LR_LOADFROMFILE = 0x0010
        LR_DEFAULTSIZE = 0x0040
        WM_SETICON = 0x0080
        ICON_SMALL = 0
        ICON_BIG = 1

        hicon = user32.LoadImageW(
            None, icon_path, IMAGE_ICON, 0, 0, LR_LOADFROMFILE | LR_DEFAULTSIZE
        )
        if not hicon:
            return

        hwnd = _find_app_hwnd()
        if not hwnd:
            return
        user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, hicon)
        user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, hicon)
    except Exception:
        pass


def verify_machine_before_start() -> dict:
    """Zawsze przed UI: machine_id / windows_user. Sesja z innego PC = wyczyszczona."""
    try:
        from machine_identity import verify_launch_binding

        result = verify_launch_binding()
    except Exception as exc:
        return {"ok": False, "error": str(exc), "cleared": False}
    if result.get("cleared"):
        win_message(
            APP_TITLE,
            result.get("message")
            or "Sesja nalezala do innej maszyny. Zaloguj sie ponownie.",
            icon=0x30,  # MB_ICONWARNING
        )
    return result


def main() -> None:
    if not WEB_ROOT.is_dir():
        win_message(APP_TITLE, f"Brak folderu UI:\n{WEB_ROOT}")
        raise SystemExit(1)

    binding = verify_machine_before_start()
    if binding.get("ok") is False and binding.get("error"):
        win_message(
            APP_TITLE,
            "Nie udalo sie zweryfikowac ID maszyny.\n\n" + str(binding.get("error")),
        )
        raise SystemExit(1)

    if not acquire_single_instance():
        raise SystemExit(0)

    # Przed bindowaniem: zwolnij 8765/8766 zajete przez stare serve_browser / http.server
    _kill_stale_dam_processes()

    ui_port = pick_free_port(DEFAULT_UI_PORT)
    bridge_port = pick_free_port(DEFAULT_BRIDGE_PORT)

    bridge_proc = start_bridge(ui_port, bridge_port)
    watch_proc = start_index_watcher()
    httpd, _thread = start_ui_server(ui_port, bridge_port)
    start_url = runtime_payload(ui_port, bridge_port)["start_url"]

    # Pilnuj mostu: jesli padnie w trakcie sesji, podnies ponownie (inaczej "Pliki offline").
    stop_supervise = threading.Event()

    def _supervise_bridge() -> None:
        nonlocal bridge_proc
        while not stop_supervise.is_set():
            time.sleep(2.5)
            if stop_supervise.is_set():
                break
            if bridge_proc is None or bridge_proc.poll() is not None:
                try:
                    bridge_proc = start_bridge(ui_port, bridge_port)
                except Exception:
                    pass

    threading.Thread(target=_supervise_bridge, daemon=True).start()

    webview = require_pywebview()
    icon_path = str(ICON) if ICON.is_file() else None
    js_api = DamJsApi()
    win_w, win_h = preferred_window_size()

    window = webview.create_window(
        APP_TITLE,
        start_url,
        width=win_w,
        height=win_h,
        min_size=(1400, 800),
        text_select=True,
        js_api=js_api,
    )
    if icon_path:
        try:
            window.icon = icon_path
        except Exception:
            pass

    def _on_shown() -> None:
        # WinForms bierze ikone z webview.start(icon=...); WM_SETICON to pas bezpieczeństwa.
        if icon_path:
            apply_native_window_icon(icon_path)

    try:
        window.events.shown += _on_shown
    except Exception:
        pass

    def _show_window() -> None:
        try:
            for win in list(getattr(webview, "windows", []) or []):
                try:
                    win.show()
                    win.restore()
                except Exception:
                    pass
        except Exception:
            pass

    def _shutdown_all() -> None:
        stop_supervise.set()
        try:
            httpd.shutdown()
        except Exception:
            pass
        if watch_proc and watch_proc.poll() is None:
            watch_proc.terminate()
        if bridge_proc and bridge_proc.poll() is None:
            bridge_proc.terminate()
        os._exit(0)

    try:
        from dam_tray import start_tray

        start_tray(title=APP_TITLE, on_show=_show_window, on_quit=_shutdown_all)
    except Exception:
        pass

    # Profil WebView2 trwaly (nie nowy folder tymczasowy przy KAZDYM starcie).
    # Domyslnie pywebview tworzy folder w %TEMP% i usuwa go po zamknieciu -
    # to oznacza "cold start" (zero cache) przy kazdym uruchomieniu aplikacji.
    webview_profile = DESKTOP_DIR / "data" / "webview2-profile"
    webview_profile.mkdir(parents=True, exist_ok=True)

    start_kwargs = {
        "gui": "edgechromium",
        "debug": False,
        "private_mode": False,
        "storage_path": str(webview_profile),
    }
    if icon_path:
        start_kwargs["icon"] = icon_path

    try:
        webview.start(**start_kwargs)
    except TypeError:
        # Starsze pywebview bez icon=/storage_path
        try:
            webview.start(
                gui="edgechromium",
                debug=False,
                icon=icon_path if icon_path else None,
            )
        except TypeError:
            try:
                webview.start(gui="edgechromium", debug=False)
            except TypeError:
                webview.start(debug=False)
        if icon_path:
            threading.Thread(
                target=lambda: (time.sleep(0.6), apply_native_window_icon(icon_path)),
                daemon=True,
            ).start()
    except Exception as exc:
        win_message(
            APP_TITLE,
            "Nie udalo sie uruchomic okna aplikacji.\n\n"
            f"Szczegoly: {exc}\n\n"
            "Upewnij sie, ze masz zainstalowany Microsoft Edge WebView2 Runtime.",
        )
        raise SystemExit(1) from exc
    finally:
        stop_supervise.set()
        httpd.shutdown()
        if watch_proc and watch_proc.poll() is None:
            watch_proc.terminate()
        if bridge_proc and bridge_proc.poll() is None:
            bridge_proc.terminate()


if __name__ == "__main__":
    main()
