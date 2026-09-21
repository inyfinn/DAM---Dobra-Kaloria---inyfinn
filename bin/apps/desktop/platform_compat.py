# -*- coding: utf-8 -*-
"""Platform-specific shims: Windows behavior unchanged, macOS added, else safe no-op.

stdlib only. Windows branches are the exact code that used to live inline in
local_bridge.py / dam_sync.py — moved here so both platforms share one place.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

_DESKTOP_DIR = Path(__file__).resolve().parent
_DATA_DIR_FALLBACK = _DESKTOP_DIR / "data"


def _is_probably_file(p: str) -> bool:
    name = Path(p).name
    return "." in name and not name.startswith(".")


# --- open_file ---------------------------------------------------------


def open_file(path) -> dict:
    """Otworz plik domyslna aplikacja systemu."""
    if sys.platform == "win32":
        try:
            os.startfile(str(path))  # type: ignore[attr-defined]
            return {"ok": True, "error": ""}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}
    if sys.platform == "darwin":
        try:
            proc = subprocess.run(["open", str(path)], check=False)
            if proc.returncode == 0:
                return {"ok": True, "error": ""}
            return {"ok": False, "error": f"open exited {proc.returncode}"}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}
    return {"ok": False, "error": "unsupported_platform"}


# --- reveal_in_folder (Windows: explorer /select + tab/focus helpers) --
# Moved verbatim from local_bridge.py (2026-07-20 "karta + fokus" fix).
# Root cause "okno otwiera sie w tle": most to pythonw (proces BEZ okna na
# pierwszym planie), wiec explorer.exe odpalony przez subprocess nie dostaje
# fokusu (Windows foreground lock - SetForegroundWindow dziala tylko dla
# procesu na pierwszym planie). Obejscie: ALT-trick (keybd_event VK_MENU przed
# SetForegroundWindow) + ShowWindow + BringWindowToTop.

_VK_MENU, _VK_CONTROL, _VK_T, _KEYEVENTF_KEYUP = 0x12, 0x11, 0x54, 0x02


def _explorer_hwnds() -> set:
    """Top-level okna Eksploratora (klasa CabinetWClass), czysty ctypes."""
    import ctypes

    user32 = ctypes.windll.user32
    out: set = set()
    h = 0
    while True:
        h = user32.FindWindowExW(None, h, "CabinetWClass", None)
        if not h:
            break
        out.add(h)
    return out


def _focus_hwnd(hwnd: int) -> bool:
    """Wysun okno na wierzch. ALT-trick omija foreground lock."""
    try:
        import ctypes

        user32 = ctypes.windll.user32
        user32.ShowWindow(hwnd, 9 if user32.IsIconic(hwnd) else 5)  # SW_RESTORE / SW_SHOW
        user32.keybd_event(_VK_MENU, 0, 0, 0)
        user32.SetForegroundWindow(hwnd)
        user32.keybd_event(_VK_MENU, 0, _KEYEVENTF_KEYUP, 0)
        user32.BringWindowToTop(hwnd)
        return user32.GetForegroundWindow() == hwnd
    except Exception:
        return False


def _open_folder_tab_and_focus(target: str) -> bool:
    """Otworz folder jako NOWA KARTE istniejacego okna Eksploratora i wysun je.

    Zwraca True tylko gdy karta powstala i zostala nawigowana. False = wolaj
    fallback (nowe okno). Wywolywac WYLACZNIE z watku daemon - X: (NFS) bywa
    wolne, a COM/PIDL moga blokowac.
    """
    try:
        import ctypes
        import pythoncom
        import win32com.client
        from win32com.client import VARIANT
        from win32com.shell import shell as w32shell
    except Exception:
        return False

    user32 = ctypes.windll.user32
    pythoncom.CoInitialize()
    try:
        try:
            pidl = w32shell.SHParseDisplayName(target, 0)[0]
            var_pidl = VARIANT(
                pythoncom.VT_ARRAY | pythoncom.VT_UI1, w32shell.PIDLAsString(pidl)
            )
        except Exception:
            return False
        sh = win32com.client.Dispatch("Shell.Application")

        def explorer_tabs():
            out = []
            for w in sh.Windows():
                try:
                    if "explorer.exe" in str(w.FullName or "").lower():
                        out.append(w)
                except Exception:
                    pass
            return out

        items = explorer_tabs()
        if not items:
            return False
        hwnd = int(items[0].HWND)
        if not _focus_hwnd(hwnd):
            time.sleep(0.2)
            if not _focus_hwnd(hwnd):
                return False
        time.sleep(0.25)
        if user32.GetForegroundWindow() != hwnd:
            return False

        def url_counts():
            counts: dict = {}
            for w in explorer_tabs():
                try:
                    if int(w.HWND) == hwnd:
                        u = str(w.LocationURL or "")
                        counts[u] = counts.get(u, 0) + 1
                except Exception:
                    pass
            return counts

        before = url_counts()
        # Ctrl+T = nowa karta w oknie na pierwszym planie
        user32.keybd_event(_VK_CONTROL, 0, 0, 0)
        user32.keybd_event(_VK_T, 0, 0, 0)
        user32.keybd_event(_VK_T, 0, _KEYEVENTF_KEYUP, 0)
        user32.keybd_event(_VK_CONTROL, 0, _KEYEVENTF_KEYUP, 0)

        new_tab = None
        deadline = time.time() + 3.0
        while time.time() < deadline and new_tab is None:
            time.sleep(0.25)
            after = url_counts()
            surplus = [u for u in after if after.get(u, 0) > before.get(u, 0)]
            if surplus:
                for w in explorer_tabs():
                    try:
                        if int(w.HWND) == hwnd and str(w.LocationURL or "") in surplus:
                            new_tab = w
                            break
                    except Exception:
                        pass
        if new_tab is None:
            return False

        ok = False
        for _ in range(8):
            try:
                new_tab.Navigate2(var_pidl)  # PIDL, nie file:/// URI
                ok = True
                break
            except Exception:
                time.sleep(0.4)
        if not ok:
            return False
        time.sleep(0.3)
        _focus_hwnd(hwnd)  # re-assert - nawigacja potrafi oddac fokus
        return True
    finally:
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass


def _focus_new_explorer_window(before: set) -> None:
    """Po odpaleniu explorer.exe znajdz nowe okno (poll do 5 s) i wysun je."""
    import ctypes

    user32 = ctypes.windll.user32
    hwnd = 0
    deadline = time.time() + 5.0
    while time.time() < deadline:
        time.sleep(0.25)
        fresh = _explorer_hwnds() - before
        if fresh:
            hwnd = sorted(fresh)[0]
            break
    if not hwnd:
        # Brak nowego okna = Windows zrobil karte w istniejacym oknie
        current = _explorer_hwnds()
        if not current:
            return
        hwnd = sorted(current)[0]
    _focus_hwnd(hwnd)
    if user32.GetForegroundWindow() != hwnd:
        time.sleep(0.3)
        _focus_hwnd(hwnd)


def _select_file_in_explorer(filepath: str) -> bool:
    """Zaznacz DOKLADNY plik przez SHOpenFolderAndSelectItems.

    `explorer /select,` bywa zawodne gdy folder WIZKI jest juz otwarty (Windows
    zostawia poprzednie zaznaczenie - np. FRONT-L zamiast FRONT-S, ktore
    faktycznie wyslal most). API shellowe wymusza selekcje wskazanego PIDL.
    """
    try:
        import pythoncom
        from win32com.shell import shell as w32shell
    except Exception:
        return False
    pythoncom.CoInitialize()
    try:
        pidl = w32shell.SHParseDisplayName(filepath, 0)[0]
        # apidl musi byc lista/tablica IDL (None -> TypeError w pywin32)
        w32shell.SHOpenFolderAndSelectItems(pidl, [], 0)
        return True
    except Exception:
        return False
    finally:
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass


def _reveal_worker(target: str, mode: str, args: list) -> None:
    """Watek daemon: preferuj karte+fokus, fallback = nowe okno + fokus."""
    try:
        if mode == "open" and _open_folder_tab_and_focus(target):
            return
    except Exception:
        pass
    # Select: najpierw SHOpenFolderAndSelectItems (dokladny plik), potem /select
    if mode == "select":
        try:
            if _select_file_in_explorer(target):
                try:
                    _focus_new_explorer_window(set())
                except Exception:
                    pass
                return
        except Exception:
            pass
    before = _explorer_hwnds()
    try:
        _no_win = (
            getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
            if sys.platform == "win32"
            else 0
        )
        subprocess.Popen(
            args,
            shell=False,
            creationflags=_no_win,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        return
    try:
        _focus_new_explorer_window(before)
    except Exception:
        pass


def reveal_in_folder(target: str) -> dict:
    """Pokaz plik/folder w systemowym eksploratorze. `target` juz zwalidowany przez wolajacego."""
    if sys.platform == "win32":
        import threading

        if os.path.isfile(target):
            args = ["explorer", "/select,", target]
            mode = "select"
        elif os.path.isdir(target):
            args = ["explorer", target]
            mode = "open"
        elif _is_probably_file(target):
            args = ["explorer", "/select,", target]
            mode = "select"
        else:
            args = ["explorer", target]
            mode = "open"
        try:
            # Watek daemon: karta w istniejacym oknie + fokus (fallback: nowe
            # okno + fokus). Nie blokuje odpowiedzi HTTP (X: NFS bywa wolne).
            threading.Thread(
                target=_reveal_worker, args=(target, mode, args), daemon=True
            ).start()
            return {"ok": True, "path": target, "command": mode}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc), "path": target}
    if sys.platform == "darwin":
        try:
            proc = subprocess.run(["open", "-R", str(target)], check=False)
            if proc.returncode == 0:
                return {"ok": True, "path": target, "command": "open-R"}
            return {"ok": False, "error": f"open -R exited {proc.returncode}", "path": target}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc), "path": target}
    return {"ok": False, "error": "unsupported_platform", "path": target}


# --- popen_background_kwargs --------------------------------------------


def popen_background_kwargs() -> dict:
    """kwargs dla subprocess.Popen(...) tla bez okna. NIGDY creationflags != 0 poza Windows."""
    if sys.platform == "win32":
        # Dokladnie te dwie flagi co przed portem (dam_sync.py:121). Zadnej
        # trzeciej - CREATE_NEW_PROCESS_GROUP zmienilby zachowanie Windows.
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) | getattr(
            subprocess, "DETACHED_PROCESS", 0x00000008
        )
        return {"creationflags": flags}
    return {"start_new_session": True}


# --- pick_folder_native (macOS only; Windows keeps its tkinter path) ---


def pick_folder_native(start_dir: str = "", prompt: str = "") -> dict:
    if sys.platform != "darwin":
        return {"ok": False, "error": "use_tkinter"}
    prompt = (prompt or "Wybierz folder").replace('"', '\\"')
    script = f'POSIX path of (choose folder with prompt "{prompt}"'
    if start_dir:
        start_escaped = str(start_dir).replace('"', '\\"')
        script += f' default location (POSIX file "{start_escaped}")'
    script += ")"
    try:
        proc = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        if "-128" in stderr or "User canceled" in stderr:
            return {"ok": False, "error": "cancelled"}
        return {"ok": False, "error": stderr or "osascript_failed"}
    path = (proc.stdout or "").strip()
    if not path:
        return {"ok": False, "error": "empty_path"}
    return {"ok": True, "path": path}


# --- korzenie materialow -------------------------------------------------
# Na macOS dyski sieciowe montuja sie pod /Volumes/<nazwa udzialu>. Litery
# dyskow (M:, X:, D:) nie znacza tam nic - nigdy nie istnieja, wiec sonda je
# pomija. To tylko podpowiedz startowa; wlasciwy ROOT wskazuje uzytkownik
# w ustawieniach (pick_folder_native).

MAC_MARKETING_CANDIDATES: tuple[Path, ...] = (
    Path("/Volumes/Marketing"),
    Path("/Volumes/marketing"),
    Path("/Volumes/M"),
)


def marketing_candidates(windows_defaults) -> tuple[Path, ...]:
    """Kolejnosc Windows zostaje nietknieta (HARD). macOS dostaje swoje na przodzie."""
    base = tuple(Path(str(c)) for c in windows_defaults)
    if sys.platform == "darwin":
        return MAC_MARKETING_CANDIDATES + base
    return base


def marketing_root_prefixes(windows_prefixes) -> tuple[str, ...]:
    """Wariant napisowy z koncowym '/'. Napisy Windows przechodza BEZ zmiany
    (Path('M:/') dalby 'M:\\', co zepsulo by porownania prefiksow)."""
    base = tuple(str(p) for p in windows_prefixes)
    if sys.platform == "darwin":
        return tuple(p.as_posix() + "/" for p in MAC_MARKETING_CANDIDATES) + base
    return base


# --- user_state_dir ------------------------------------------------------
# Windows branch mirrors rebuild_lock.py:resolve_state_dir() (same
# DAM_STATE_DIR override + LOCALAPPDATA/APPDATA + write-probe + DATA_DIR
# fallback). macOS gets its own conventional path; unknown platforms fall
# back to XDG_STATE_HOME.


def user_state_dir() -> Path:
    raw = (os.environ.get("DAM_STATE_DIR") or "").strip()
    if raw:
        cand = Path(raw)
    elif sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or ""
        if not base:
            return _DATA_DIR_FALLBACK
        cand = Path(base) / "DAM" / "state"
    elif sys.platform == "darwin":
        cand = Path.home() / "Library" / "Application Support" / "DAM" / "state"
    else:
        base = os.environ.get("XDG_STATE_HOME") or str(Path.home() / ".local" / "state")
        cand = Path(base) / "DAM"
    try:
        cand.mkdir(parents=True, exist_ok=True)
        probe = cand / ".write-probe"
        probe.write_text("1", encoding="utf-8")
        probe.unlink()
    except OSError:
        return _DATA_DIR_FALLBACK
    return cand


if __name__ == "__main__":
    import tempfile

    tmp = Path(tempfile.gettempdir()) / "platform_compat_selfcheck.txt"
    tmp.write_text("x", encoding="utf-8")

    kw = popen_background_kwargs()
    assert isinstance(kw, dict), "popen_background_kwargs must return dict"
    if sys.platform != "win32":
        assert kw.get("creationflags", 0) in (0, None) or "creationflags" not in kw, (
            "creationflags must not be set on non-Windows"
        )

    r = reveal_in_folder(str(tmp))
    assert isinstance(r, dict) and "ok" in r, "reveal_in_folder must return dict with 'ok'"

    o = open_file(str(tmp))
    assert isinstance(o, dict) and "ok" in o and "error" in o, "open_file must return dict with ok/error"

    p = pick_folder_native(str(tmp.parent), "self-check")
    assert isinstance(p, dict) and "ok" in p, "pick_folder_native must return dict with 'ok'"

    d = user_state_dir()
    assert isinstance(d, Path), "user_state_dir must return Path"

    tmp.unlink(missing_ok=True)
    print("platform_compat self-check OK on", sys.platform)
