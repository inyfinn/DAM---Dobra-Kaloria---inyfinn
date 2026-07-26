"""
DAM ETA local bridge (Windows).
Opens Explorer with /select and appends audit log entries.

Port: 8766 (UI static server stays on 8765).
CORS: allows http://127.0.0.1:8765

Endpoints:
  GET  /health
  POST /reveal   {"path": "M:\\\\...\\\\file.png"}  -> explorer /select
  POST /open     {"path": "M:\\\\...\\\\file.png"}  -> os.startfile (domyslna aplikacja Windows)
  POST /rename-index {"folder","from_index","to_index","dry_run?"} -> rename index in folder tree
  POST /lifecycle-status {"scope":"product|variant","status":"aktualne|nieaktualne|demo|clear","path",...}
                         -> suffix - F/- X/- D, archiwum, historia previous_name/path
  POST /explorer/create-category  admin; JSON {brand:DK|GC, name, seq?, dry_run, confirm}
                         -> copytree Szablony/00 - KATEGORIA|CATEGORY -> {NN} - NAME
                         dry_run=true: planned_path bez zapisu; zapis tylko dry_run=false AND confirm=true
                         seq (opcjonalny) nadpisuje auto-numer (edytowalny licznik w UI)
  POST /explorer/create-product   admin; JSON {brand, category_path, name, subcategory,
                         variants[{enabled,template_folder,date,index}], demo, dry_run, confirm}
                         -> copytree szablon produktu; demo/6300XXX => suffix " - D"
                         po sukcesie: index_rebuild_suggested (client: POST /index/rebuild)
  GET  /explorer/next-category-seq?brand=DK|GC  admin; podpowiedz numeru kolejnej kategorii
  POST /explorer/undo-create  admin; JSON {path} -> cofniecie swiezo utworzonej kategorii/produktu
                         (okno ~2 min, tylko wewnatrz Marketing, tylko niedawno utworzony folder)
  POST /explorer/add-variant-type  admin; JSON {code, code_en, label_pl} -> nowy wariant/nosnik
                         globalny (naming-dictionary.carriers + carrier-types.json, KV push)
  POST /explorer/pack-print  login; JSON {revision_path|path, dry_run?}
                         -> ZIP (2 - PROJEKT + 4 - WIZKI, bez SZKICE) do 3 - DRUK;
                         nazwa = stem glownego .ai; 7-Zip -tzip -mx=9 -> choco -> OS zip
  POST /synology-share {"path": "..."} -> Synology Drive "Uzyskaj lacze" / Get link
  POST /validate-base {"path": "X:\\\\Marketing"} -> checks 3 root folders
  POST /pick-folder {"start":"X:\\\\"} -> natywny dialog folderu (tkinter; UI :8765)
  GET  /detect-marketing-bases -> kandydaci na tym komputerze (X:/D:/M:)
  GET/POST /machine-config -> baza Marketing dla tej maszyny (plik JSON)
  POST /auth/register|login  lokalne konta (bcrypt) + sesja urzadzenia
  GET  /auth/me  Authorization: Bearer <token>
  GET  /files/status?root=...  czy ROOT plikow online
  GET  /folder-images?path=...  lista obrazow w folderze Marketing (picker miniatury)
  GET  /folder-browse?path=...&mode=assets  foldery + pliki (AI/PDF/PNG...) do wskazania ELEMENTY
  POST /elements-link  reczne powiazanie folderu/plikow Elementy -> apps/web/data/elements-overrides.json
  POST /viz-flag  demo/hidden/manual -> apps/web/data/viz-flags.json
  POST /thumb-override  wybor miniatury -> apps/web/data/thumb-overrides.json
  POST /audit    {"action","user","path","detail",...}
  GET  /audit?limit=100
  GET  /index/status  mtime file-index + postgres
  POST /index/rebuild  przebudowa indeksu + miniatur (async)
  POST /rename-revision-prefix  kazdy zalogowany: kolejka JSON (tag-proposals).
                                 Natychmiastowy zapis dysku TYLKO sesja admin + admin_mode.
  GET  /tag-proposals  lista kolejki (po TTL: eskalacja do inbox, BEZ auto-zapisu)
  POST /tag-proposals/decide  zatwierdz/odrzuc/pick_other - TYLKO sesja admin
  GET/POST /carrier-types  wlasne typy nosnikow (dodaj/usun + reassign historii)
  GET  /program-instructions  newralgiczne reguly programu (KV + lokalny cache)
  POST /viz-request  Faza 5/6: "Zglos zapotrzebowanie" wielokanalowe (mail/Teams/Asana stub + w aplikacji)
  GET  /inbox-items  lista wpisow panelu (viz-request i inne, tagi + read flag)
  POST /inbox-items/mark-read  {"id"} -> oznacz przeczytane
"""
from __future__ import annotations

import gzip
import json
import os
import re
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from auth_store import (
    init_db as auth_init_db,
    list_users,
    login as auth_login,
    logout as auth_logout,
    register_user,
    rehydrate_session as auth_rehydrate,
    resolve_session,
    seed_owner_from_env,
    users_count,
)

try:
    import oauth_integrations
except ImportError:
    oauth_integrations = None  # type: ignore

try:
    import dam_db
except ImportError:
    dam_db = None  # type: ignore

try:
    import lifecycle_status as lifecycle_status_mod
except ImportError:
    lifecycle_status_mod = None  # type: ignore

try:
    import explorer_create as explorer_create_mod
except ImportError:
    explorer_create_mod = None  # type: ignore

try:
    import invoice_erp as invoice_erp_mod
except ImportError:
    invoice_erp_mod = None  # type: ignore

try:
    import invoice_mail as invoice_mail_mod
except ImportError:
    invoice_mail_mod = None  # type: ignore

try:
    import dam_redis
except ImportError:
    dam_redis = None  # type: ignore

try:
    import dam_path_resolve as dam_path_resolve_mod
except ImportError:
    dam_path_resolve_mod = None  # type: ignore

try:
    import dam_file_availability as dam_file_availability_mod
except ImportError:
    dam_file_availability_mod = None  # type: ignore

try:
    import dam_thumb_cache as dam_thumb_cache_mod
except ImportError:
    dam_thumb_cache_mod = None  # type: ignore

HOST = "127.0.0.1"
PORT = int(os.environ.get("DAM_BRIDGE_PORT", "8766"))
# Bump po nowych endpointach hub (smoke: GET /health -> api_version)
BRIDGE_API_VERSION = 7
DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = Path(os.environ.get("DAM_WEB_ROOT", str(DESKTOP_DIR.parent / "web")))
DEBUG_SESSION_LOG = WEB_ROOT.parent.parent / "debug-0f6c29.log"
AUDIT_FILE = WEB_ROOT / "data" / "audit-log.jsonl"
INDEX_FILE = WEB_ROOT / "data" / "file-index.json"
# Inyfinn Image / Photo Resizer (GUI launcher + opcjonalny CLI w BIN/dev)
IMAGE_RESIZER_ROOT = Path(
    os.environ.get(
        "DAM_IMAGE_RESIZER_ROOT",
        r"X:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\Inyfinn Image resizer",
    )
)
BUILD_INDEX = WEB_ROOT / "scripts" / "build-file-index.py"
MACHINE_CONFIG = DESKTOP_DIR / "machine-config.json"
USER_DEVICE_PATHS_FILE = DESKTOP_DIR / "data" / "user-device-paths.json"
USER_PREFS_FILE = DESKTOP_DIR / "data" / "user-prefs.json"
SYNOLOGY_SCRIPT = DESKTOP_DIR / "synology_get_link.ps1"
REQUIRED_ROOT_FOLDERS = ("-- ARCHIWUM --", "- EKSPORT", "- POLSKA")
CORS_ORIGIN = os.environ.get("DAM_UI_ORIGIN", "http://127.0.0.1:8765")
# Kolejnosc: ten komputer (X:) -> staging D: -> legacy root M:
MARKETING_CANDIDATES = (
    Path("X:/Marketing"),
    Path("D:/Marketing"),
    Path("M:/"),
)

_index_lock = threading.Lock()
_index_state: dict = {
    "running": False,
    "last_started": "",
    "last_finished": "",
    "last_ok": None,
    "last_error": "",
    "last_rc": None,
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_path(p: str) -> str:
    return str(Path(p)).replace("/", "\\")


def is_probably_file(p: str) -> bool:
    name = Path(p).name
    return "." in name and not name.startswith(".")


# --- Explorer: karta + fokus (2026-07-20) -----------------------------------
# Root cause "okno otwiera sie w tle": most to pythonw (proces BEZ okna na
# pierwszym planie), wiec explorer.exe odpalony przez subprocess nie dostaje
# fokusu (Windows foreground lock - SetForegroundWindow dziala tylko dla
# procesu na pierwszym planie). Obejscie: ALT-trick (keybd_event VK_MENU przed
# SetForegroundWindow) + ShowWindow + BringWindowToTop.
# Karta zamiast nowego okna: fokus istniejacego okna Eksploratora -> Ctrl+T ->
# Navigate2(PIDL) na swiezej karcie. UWAGA (HARD): Navigate2 NIE przyjmuje
# sciezek jako file:/// URI (%20 itd. -> dialog "Nie mozna odnalezc...").
# Zawsze podawaj PIDL (SHParseDisplayName) albo surowa sciezke Windows.

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
                # #region agent log
                try:
                    with open(
                        Path(__file__).resolve().parents[2] / "debug-a78fa0.log",
                        "a",
                        encoding="utf-8",
                    ) as _f:
                        _f.write(
                            json.dumps(
                                {
                                    "sessionId": "a78fa0",
                                    "hypothesisId": "SELECT",
                                    "location": "local_bridge.py:_reveal_worker",
                                    "message": "SHOpenFolderAndSelectItems ok",
                                    "data": {
                                        "basename": os.path.basename(target),
                                        "path_tail": target[-90:],
                                        "has_front_s": bool(
                                            re.search(r"FRONT[-_ ]?S\b", os.path.basename(target), re.I)
                                        ),
                                        "has_front_l": bool(
                                            re.search(r"FRONT[-_ ]?L\b", os.path.basename(target), re.I)
                                        ),
                                    },
                                    "timestamp": int(time.time() * 1000),
                                    "runId": "select-s-fix",
                                },
                                ensure_ascii=False,
                            )
                            + "\n"
                        )
                except Exception:
                    pass
                # #endregion
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


def reveal_in_explorer(target: str) -> dict:
    target = normalize_path(target)
    if not os.path.exists(target):
        # #region agent log
        try:
            with open(
                Path(__file__).resolve().parents[2] / "debug-a78fa0.log",
                "a",
                encoding="utf-8",
            ) as _f:
                _f.write(
                    json.dumps(
                        {
                            "sessionId": "a78fa0",
                            "hypothesisId": "B",
                            "location": "local_bridge.py:reveal_in_explorer",
                            "message": "path_not_found",
                            "data": {"path_tail": target[-80:], "exists": False},
                            "timestamp": int(time.time() * 1000),
                            "runId": "pre-fix",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        return {"ok": False, "error": "path_not_found", "path": target}
    if not _is_under_marketing(Path(target)):
        # #region agent log
        try:
            with open(
                Path(__file__).resolve().parents[2] / "debug-a78fa0.log",
                "a",
                encoding="utf-8",
            ) as _f:
                _f.write(
                    json.dumps(
                        {
                            "sessionId": "a78fa0",
                            "hypothesisId": "B",
                            "location": "local_bridge.py:reveal_in_explorer",
                            "message": "path_outside_marketing",
                            "data": {
                                "path_tail": target[-80:],
                                "drive": target[:3],
                                "is_documents": "Dokumenty" in target or "Documents" in target,
                            },
                            "timestamp": int(time.time() * 1000),
                            "runId": "pre-fix",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        return {"ok": False, "error": "path_outside_marketing", "path": target}

    # Bez shell=True (unikaj injection przez cudzyslowy w sciezce).
    # WAŻNE: ["/select," + path] ze spacjami = Windows otwiera Dokumenty.
    # Poprawnie: osobny argument sciezki po "/select,".
    # Foldery typu "6300084.00" maja kropke - NIE wolno traktowac ich jako plik.
    _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
    if os.path.isfile(target):
        args = ["explorer", "/select,", target]
        mode = "select"
    elif os.path.isdir(target):
        args = ["explorer", target]
        mode = "open"
    elif is_probably_file(target):
        args = ["explorer", "/select,", target]
        mode = "select"
    else:
        args = ["explorer", target]
        mode = "open"

    try:
        # #region agent log
        try:
            with open(
                Path(__file__).resolve().parents[2] / "debug-a78fa0.log",
                "a",
                encoding="utf-8",
            ) as _f:
                _f.write(
                    json.dumps(
                        {
                            "sessionId": "a78fa0",
                            "hypothesisId": "E",
                            "location": "local_bridge.py:reveal_in_explorer",
                            "message": "launching explorer",
                            "data": {
                                "mode": mode,
                                "path_tail": target[-90:],
                                "drive": target[:3],
                                "is_dir": os.path.isdir(target),
                                "is_file": os.path.isfile(target),
                                "args_len": len(args),
                                "select_split": mode == "select" and len(args) == 3,
                                "creationflags": int(_no_win),
                            },
                            "timestamp": int(time.time() * 1000),
                            "runId": "post-fix",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        # Watek daemon: karta w istniejacym oknie + fokus (fallback: nowe
        # okno + fokus). Nie blokuje odpowiedzi HTTP (X: NFS bywa wolny).
        threading.Thread(
            target=_reveal_worker, args=(target, mode, args), daemon=True
        ).start()
        return {"ok": True, "path": target, "command": mode}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "path": target}


def open_in_default_app(target: str) -> dict:
    """Otworz plik domyslna aplikacja Windows (os.startfile). Tylko pliki w Marketing."""
    target = normalize_path(target)
    if not os.path.exists(target):
        return {"ok": False, "error": "path_not_found", "path": target}
    if not _is_under_marketing(Path(target)):
        return {"ok": False, "error": "path_outside_marketing", "path": target}
    if not os.path.isfile(target) and not is_probably_file(target):
        return {"ok": False, "error": "not_a_file", "path": target}
    try:
        os.startfile(target)  # type: ignore[attr-defined]
        return {"ok": True, "path": target, "command": "startfile"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "path": target}


def invoke_synology_share(target: str) -> dict:
    """Open Synology Drive Client share dialog (context menu: Uzyskaj lacze / Get link)."""
    target = normalize_path(target)
    if not os.path.exists(target):
        return {"ok": False, "error": "path_not_found", "path": target}
    if not _is_under_marketing(Path(target)):
        return {"ok": False, "error": "path_outside_marketing", "path": target}
    if not os.path.isfile(target):
        return {"ok": False, "error": "not_a_file", "path": target}
    if not SYNOLOGY_SCRIPT.is_file():
        return {"ok": False, "error": "script_missing", "path": str(SYNOLOGY_SCRIPT)}

    cmd = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(SYNOLOGY_SCRIPT),
        "-FilePath",
        target,
    ]
    try:
        _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=45,
            check=False,
            creationflags=_no_win,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout", "path": target}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "path": target}

    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()
    # Script prints one JSON object; take the last non-empty line.
    payload = None
    for line in reversed(stdout.splitlines()):
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
            break
        except json.JSONDecodeError:
            continue

    if isinstance(payload, dict):
        payload.setdefault("path", target)
        if payload.get("ok"):
            return payload
        return {
            "ok": False,
            "error": payload.get("error") or "synology_invoke_failed",
            "path": target,
            "raw": payload,
            "stderr": stderr or None,
        }

    return {
        "ok": False,
        "error": "invalid_script_output",
        "path": target,
        "exit_code": proc.returncode,
        "stdout": stdout[:500],
        "stderr": stderr[:500] if stderr else None,
    }


def validate_base(path: str) -> dict:
    base = Path(normalize_path(path))
    if not base.exists() or not base.is_dir():
        return {"ok": False, "error": "not_a_directory", "path": str(base)}
    missing = [name for name in REQUIRED_ROOT_FOLDERS if not (base / name).is_dir()]
    return {
        "ok": len(missing) == 0,
        "path": str(base),
        "missing": missing,
        "required": list(REQUIRED_ROOT_FOLDERS),
    }


_PICK_FOLDER_LOCK = threading.Lock()


def pick_folder_dialog(start: str = "") -> dict:
    """Natywny dialog Windows (tkinter) - wskazanie folderu Marketing z przegladarki + most.

    Desktop pywebview ma wlasne api.pick_folder; ten endpoint jest dla :8765 + :8766.
    """
    start_dir = ""
    raw = (start or "").strip()
    if raw:
        try:
            p = Path(normalize_path(raw))
            if p.is_dir():
                start_dir = str(p)
            elif p.parent.is_dir():
                start_dir = str(p.parent)
        except OSError:
            start_dir = ""

    if not _PICK_FOLDER_LOCK.acquire(blocking=False):
        return {"ok": False, "error": "picker_busy"}

    result: dict = {"ok": False, "cancelled": True}

    def _run() -> None:
        nonlocal result
        try:
            import tkinter as tk
            from tkinter import filedialog

            root = tk.Tk()
            root.withdraw()
            try:
                root.attributes("-topmost", True)
            except Exception:
                pass
            chosen = filedialog.askdirectory(
                initialdir=start_dir or None,
                title="Wybierz folder Marketing (root)",
                mustexist=True,
            )
            try:
                root.destroy()
            except Exception:
                pass
            if not chosen:
                result = {"ok": False, "cancelled": True}
                return
            path = str(Path(chosen))
            if not Path(path).is_dir():
                result = {"ok": False, "error": "not_a_directory", "cancelled": False}
                return
            result = {"ok": True, "path": path, "cancelled": False}
        except Exception as exc:  # noqa: BLE001
            result = {"ok": False, "error": str(exc), "cancelled": False}

    try:
        # Dialog musi byc w watku z message loop - join z timeoutem (user moze myslec)
        t = threading.Thread(target=_run, daemon=True)
        t.start()
        t.join(timeout=300)
        if t.is_alive():
            return {"ok": False, "error": "picker_timeout"}
        return result
    finally:
        try:
            _PICK_FOLDER_LOCK.release()
        except RuntimeError:
            pass


def detect_marketing_bases() -> dict:
    """Wykryj dostepne rooty Marketing na TYM komputerze."""
    found: list[dict] = []
    for candidate in MARKETING_CANDIDATES:
        try:
            exists = candidate.exists() and candidate.is_dir()
        except OSError:
            exists = False
        if not exists:
            found.append(
                {
                    "path": str(candidate),
                    "ok": False,
                    "exists": False,
                    "missing": list(REQUIRED_ROOT_FOLDERS),
                }
            )
            continue
        info = validate_base(str(candidate))
        found.append(
            {
                "path": str(candidate),
                "ok": bool(info.get("ok")),
                "exists": True,
                "missing": info.get("missing") or [],
            }
        )
    recommended = next((x["path"] for x in found if x.get("ok")), None)
    return {
        "ok": True,
        "candidates": found,
        "recommended": recommended,
        "required": list(REQUIRED_ROOT_FOLDERS),
    }


def _windows_username() -> str:
    return (os.environ.get("USERNAME") or os.environ.get("USER") or "default").strip() or "default"


def _normalize_base_path(base_path: str) -> str:
    win = normalize_path(base_path).strip()
    if re.match(r"^[A-Za-z]:\\?$", win):
        return win[0].upper() + ":\\"
    return win.rstrip("\\")


def read_machine_config() -> dict:
    """Preferencja Marketing dla biezacego konta Windows (nie globalna stala)."""
    user = _windows_username()
    if not MACHINE_CONFIG.is_file():
        return {"ok": True, "user": user, "base_path": "", "path": str(MACHINE_CONFIG)}
    try:
        data = json.loads(MACHINE_CONFIG.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    users = data.get("users") if isinstance(data.get("users"), dict) else {}
    entry = users.get(user) if isinstance(users.get(user), dict) else None
    # Migracja starego formatu {base_path: ...} -> biezacy user
    if not entry and data.get("base_path"):
        entry = {"base_path": data.get("base_path"), "updated_at": data.get("updated_at") or ""}
    return {
        "ok": True,
        "user": user,
        "base_path": str((entry or {}).get("base_path") or "").strip(),
        "updated_at": (entry or {}).get("updated_at") or "",
        "path": str(MACHINE_CONFIG),
    }


def write_machine_config(base_path: str) -> dict:
    """Zapis tylko dla biezacego konta Windows - nie nadpisuje innych userow."""
    user = _windows_username()
    stored = _normalize_base_path(base_path)
    data: dict = {}
    if MACHINE_CONFIG.is_file():
        try:
            data = json.loads(MACHINE_CONFIG.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            data = {}
    users = data.get("users") if isinstance(data.get("users"), dict) else {}
    users[user] = {"base_path": stored, "updated_at": utc_now()}
    payload = {"users": users}
    MACHINE_CONFIG.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if dam_db is not None:
        try:
            dam_db.reset_path_cache()
            dam_db.init_db()
        except Exception:  # noqa: BLE001
            pass
    return {
        "ok": True,
        "user": user,
        "base_path": stored,
        "updated_at": users[user]["updated_at"],
        "path": str(MACHINE_CONFIG),
        "db": dam_db.status() if dam_db else None,
    }


# ---------------------------------------------------------------------------
# Sciezki Marketing PER URZADZENIE (konto DAM + device_id) - ADR-008 + PI
# Zrodlo prawdy: Postgres dam_kv_store klucz user-device-paths:{email}
# Cache lokalny: apps/desktop/data/user-device-paths.json
# ---------------------------------------------------------------------------


def _udp_store_key(email: str) -> str:
    return "user-device-paths:" + (email or "").strip().lower()


def _udp_load_local_all() -> dict:
    if not USER_DEVICE_PATHS_FILE.is_file():
        return {"users": {}}
    try:
        data = json.loads(USER_DEVICE_PATHS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"users": {}}
    if not isinstance(data, dict):
        return {"users": {}}
    users = data.get("users")
    if not isinstance(users, dict):
        return {"users": {}}
    return {"users": users}


def _udp_save_local_all(data: dict) -> None:
    USER_DEVICE_PATHS_FILE.parent.mkdir(parents=True, exist_ok=True)
    USER_DEVICE_PATHS_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _udp_normalize_devices(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        did = str(item.get("device_id") or "").strip()
        if not did:
            continue
        out.append(
            {
                "device_id": did,
                "hostname": str(item.get("hostname") or "").strip(),
                "base_path": _normalize_base_path(str(item.get("base_path") or "").strip())
                if str(item.get("base_path") or "").strip()
                else "",
                "label": str(item.get("label") or "").strip(),
                "updated_at": str(item.get("updated_at") or "").strip(),
            }
        )
    return out


def _udp_read_user_payload(email: str) -> dict:
    """Payload jednego usera: { email, devices: [...] } z PG (prefer) lub lokalnego pliku."""
    key_email = (email or "").strip().lower()
    empty = {"email": key_email, "devices": []}
    if not key_email:
        return empty

    if _pg_available():
        try:
            import pg_db

            payload = pg_db.kv_get(_udp_store_key(key_email), None)
            if isinstance(payload, dict):
                return {
                    "email": key_email,
                    "devices": _udp_normalize_devices(payload.get("devices")),
                }
        except Exception as exc:  # noqa: BLE001
            print("user-device-paths pg read warning:", exc)

    local = _udp_load_local_all()
    entry = local["users"].get(key_email)
    if isinstance(entry, dict):
        return {
            "email": key_email,
            "devices": _udp_normalize_devices(entry.get("devices")),
        }
    return empty


def _udp_write_user_payload(email: str, devices: list[dict]) -> dict:
    key_email = (email or "").strip().lower()
    payload = {
        "email": key_email,
        "devices": _udp_normalize_devices(devices),
        "updated_at": utc_now(),
    }
    local = _udp_load_local_all()
    local["users"][key_email] = {
        "devices": payload["devices"],
        "updated_at": payload["updated_at"],
    }
    _udp_save_local_all(local)

    if _pg_available():
        try:
            import pg_db

            pg_db.kv_set(
                _udp_store_key(key_email),
                payload,
                updated_by="local_bridge",
            )
        except Exception as exc:  # noqa: BLE001
            print("user-device-paths pg write warning:", exc)

    return payload


def _udp_current_identity() -> dict:
    try:
        from machine_identity import collect_identity

        ident = collect_identity()
        return ident if isinstance(ident, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def list_user_device_paths(email: str) -> dict:
    ident = _udp_current_identity()
    payload = _udp_read_user_payload(email)
    current_id = str(ident.get("device_id") or "").strip()
    current_entry = None
    for d in payload["devices"]:
        if d.get("device_id") == current_id:
            current_entry = d
            break
    return {
        "ok": True,
        "email": payload["email"],
        "devices": payload["devices"],
        "current": {
            "device_id": current_id,
            "hostname": str(ident.get("hostname") or "").strip(),
            "machine_id": str(ident.get("machine_id") or "").strip(),
            "entry": current_entry,
            "base_path": (current_entry or {}).get("base_path") or "",
            "has_path": bool((current_entry or {}).get("base_path")),
        },
    }


def upsert_user_device_path(
    email: str,
    device_id: str,
    base_path: str,
    hostname: str = "",
    label: str | None = None,
) -> dict:
    did = str(device_id or "").strip()
    if not did:
        return {"ok": False, "error": "device_id_required"}
    path = str(base_path or "").strip()
    if not path:
        return {"ok": False, "error": "base_path_required"}
    stored = _normalize_base_path(path)
    payload = _udp_read_user_payload(email)
    devices = list(payload["devices"])
    found = False
    now = utc_now()
    for i, d in enumerate(devices):
        if d.get("device_id") == did:
            next_label = str(d.get("label") or "").strip()
            if label is not None:
                next_label = str(label).strip()
            devices[i] = {
                "device_id": did,
                "hostname": str(hostname or d.get("hostname") or "").strip(),
                "base_path": stored,
                "label": next_label,
                "updated_at": now,
            }
            found = True
            break
    if not found:
        devices.append(
            {
                "device_id": did,
                "hostname": str(hostname or "").strip(),
                "base_path": stored,
                "label": str(label or "").strip(),
                "updated_at": now,
            }
        )
    written = _udp_write_user_payload(email, devices)
    entry = next((d for d in written["devices"] if d.get("device_id") == did), None)
    return {"ok": True, "entry": entry, "devices": written["devices"]}


def delete_user_device_path(email: str, device_id: str) -> dict:
    did = str(device_id or "").strip()
    if not did:
        return {"ok": False, "error": "device_id_required"}
    payload = _udp_read_user_payload(email)
    before = len(payload["devices"])
    devices = [d for d in payload["devices"] if d.get("device_id") != did]
    if len(devices) == before:
        return {"ok": False, "error": "not_found", "devices": payload["devices"]}
    written = _udp_write_user_payload(email, devices)
    return {"ok": True, "deleted": did, "devices": written["devices"]}


def resolve_base_path_for_current_device(email: str) -> dict:
    """Sciezka dla biezacego PC: wpis user+device, fallback machine-config (lokalny cache)."""
    listed = list_user_device_paths(email)
    current = listed.get("current") or {}
    base = str(current.get("base_path") or "").strip()
    source = "user-device-paths" if base else ""
    if not base:
        mc = read_machine_config()
        base = str(mc.get("base_path") or "").strip()
        if base:
            source = "machine-config-fallback"
    return {
        "ok": True,
        "email": (email or "").strip().lower(),
        "device_id": current.get("device_id") or "",
        "hostname": current.get("hostname") or "",
        "base_path": base,
        "source": source or "unset",
        "has_path": bool(base),
        "devices": listed.get("devices") or [],
        "current": current,
    }


# ---------------------------------------------------------------------------
# Preferencje UI per konto (safe_delete itd.) - PI ui.safe_delete
# Zrodlo prawdy: Postgres dam_kv_store klucz user-prefs:{email}
# Cache lokalny: apps/desktop/data/user-prefs.json
# ---------------------------------------------------------------------------

USER_PREFS_DEFAULTS = {
    "safe_delete": True,
    "branding_page_size": 100,
    "card_zoom": 100,
    "assoc_split": {},
    "explorer_show_all": False,
    "explorer_lang_filter": "",
    "explorer_viz_view": "tiles",
    "explorer_viz_scale": 140,
    "reveal_low_tags": False,
    "sidebar_collapsed": False,
}


def _uprefs_store_key(email: str) -> str:
    return "user-prefs:" + (email or "").strip().lower()


def _uprefs_load_local_all() -> dict:
    if not USER_PREFS_FILE.is_file():
        return {"users": {}}
    try:
        data = json.loads(USER_PREFS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"users": {}}
    if not isinstance(data, dict):
        return {"users": {}}
    users = data.get("users")
    if not isinstance(users, dict):
        return {"users": {}}
    return {"users": users}


def _uprefs_save_local_all(data: dict) -> None:
    USER_PREFS_FILE.parent.mkdir(parents=True, exist_ok=True)
    USER_PREFS_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _uprefs_clamp_page_size(value) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = int(USER_PREFS_DEFAULTS["branding_page_size"])
    if n < 24:
        n = 24
    if n > 500:
        n = 500
    return n


def _uprefs_clamp_card_zoom(value) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = int(USER_PREFS_DEFAULTS["card_zoom"])
    if n < 70:
        n = 70
    if n > 160:
        n = 160
    return n


def _uprefs_clamp_viz_scale(value) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = int(USER_PREFS_DEFAULTS["explorer_viz_scale"])
    if n < 80:
        n = 80
    if n > 220:
        n = 220
    return n


def _uprefs_normalize_assoc_split(raw) -> dict:
    out: dict = {}
    if not isinstance(raw, dict):
        return out
    for key, val in raw.items():
        try:
            n = float(val)
        except (TypeError, ValueError):
            continue
        if 0.2 <= n <= 0.8:
            out[str(key)] = round(n, 3)
    return out


def _uprefs_normalize(raw) -> dict:
    prefs = dict(USER_PREFS_DEFAULTS)
    prefs["assoc_split"] = {}
    if not isinstance(raw, dict):
        return prefs
    if "safe_delete" in raw:
        prefs["safe_delete"] = bool(raw.get("safe_delete"))
    if "branding_page_size" in raw:
        prefs["branding_page_size"] = _uprefs_clamp_page_size(raw.get("branding_page_size"))
    if "card_zoom" in raw:
        prefs["card_zoom"] = _uprefs_clamp_card_zoom(raw.get("card_zoom"))
    if "assoc_split" in raw:
        prefs["assoc_split"] = _uprefs_normalize_assoc_split(raw.get("assoc_split"))
    if "explorer_show_all" in raw:
        prefs["explorer_show_all"] = bool(raw.get("explorer_show_all"))
    if "explorer_lang_filter" in raw:
        prefs["explorer_lang_filter"] = str(raw.get("explorer_lang_filter") or "")
    if "explorer_viz_view" in raw:
        vv = str(raw.get("explorer_viz_view") or "tiles")
        prefs["explorer_viz_view"] = "list" if vv == "list" else "tiles"
    if "explorer_viz_scale" in raw:
        prefs["explorer_viz_scale"] = _uprefs_clamp_viz_scale(raw.get("explorer_viz_scale"))
    if "reveal_low_tags" in raw:
        prefs["reveal_low_tags"] = bool(raw.get("reveal_low_tags"))
    if "sidebar_collapsed" in raw:
        prefs["sidebar_collapsed"] = bool(raw.get("sidebar_collapsed"))
    return prefs


def read_user_prefs(email: str) -> dict:
    key_email = (email or "").strip().lower()
    empty = {
        "ok": True,
        "email": key_email,
        "prefs": dict(USER_PREFS_DEFAULTS),
        "source": "default",
    }
    if not key_email:
        return empty

    if _pg_available():
        try:
            import pg_db

            payload = pg_db.kv_get(_uprefs_store_key(key_email), None)
            if isinstance(payload, dict):
                return {
                    "ok": True,
                    "email": key_email,
                    "prefs": _uprefs_normalize(payload.get("prefs")),
                    "updated_at": str(payload.get("updated_at") or ""),
                    "source": "postgres",
                }
        except Exception as exc:  # noqa: BLE001
            print("user-prefs pg read warning:", exc)

    local = _uprefs_load_local_all()
    entry = local["users"].get(key_email)
    if isinstance(entry, dict):
        return {
            "ok": True,
            "email": key_email,
            "prefs": _uprefs_normalize(entry.get("prefs")),
            "updated_at": str(entry.get("updated_at") or ""),
            "source": "local",
        }
    return empty


def write_user_prefs(email: str, prefs_patch: dict | None) -> dict:
    key_email = (email or "").strip().lower()
    if not key_email:
        return {"ok": False, "error": "email_required"}
    current = read_user_prefs(key_email)
    merged = _uprefs_normalize(current.get("prefs"))
    if isinstance(prefs_patch, dict):
        # Full normalize of patch fields (incl. card_zoom / assoc_split / explorer_*)
        patch_norm = _uprefs_normalize({**merged, **prefs_patch})
        if "assoc_split" in prefs_patch and isinstance(prefs_patch.get("assoc_split"), dict):
            # Merge assoc_split maps (per-product ratios) instead of replace-all wipe
            patch_norm["assoc_split"] = _uprefs_normalize_assoc_split(
                {**(merged.get("assoc_split") or {}), **(prefs_patch.get("assoc_split") or {})}
            )
        merged = patch_norm
    payload = {
        "email": key_email,
        "prefs": merged,
        "updated_at": utc_now(),
    }
    local = _uprefs_load_local_all()
    local["users"][key_email] = {
        "prefs": payload["prefs"],
        "updated_at": payload["updated_at"],
    }
    _uprefs_save_local_all(local)

    if _pg_available():
        try:
            import pg_db

            pg_db.kv_set(
                _uprefs_store_key(key_email),
                payload,
                updated_by="local_bridge",
            )
        except Exception as exc:  # noqa: BLE001
            print("user-prefs pg write warning:", exc)

    return {
        "ok": True,
        "email": key_email,
        "prefs": merged,
        "updated_at": payload["updated_at"],
        "source": "postgres" if _pg_available() else "local",
    }


def append_audit(entry: dict) -> dict:
    """Zapis do SQLite (glowny) + opcjonalny mirror JSONL."""
    stores: list[str] = []
    row = {
        "ts": entry.get("ts") or utc_now(),
        "action": entry.get("action") or "unknown",
        "user": entry.get("user") or "anonymous",
        "path": entry.get("path") or "",
        "local_path": entry.get("local_path") or "",
        "detail": entry.get("detail") or "",
        "meta": entry.get("meta") or {},
    }
    if dam_db is not None:
        res = dam_db.append_audit(row)
        if res.get("ok"):
            stores.append("sqlite")
            row = res.get("entry") or row
    try:
        AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with AUDIT_FILE.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
        stores.append("jsonl")
    except OSError:
        pass
    return {"ok": bool(stores), "entry": row, "stores": stores}


def read_audit(limit: int = 100) -> list:
    if dam_db is not None:
        res = dam_db.read_audit(limit)
        if res.get("ok") and res.get("items"):
            return list(res["items"])
    if not AUDIT_FILE.exists():
        return []
    lines = AUDIT_FILE.read_text(encoding="utf-8").splitlines()
    rows = []
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
        if len(rows) >= limit:
            break
    return rows


def index_status() -> dict:
    mtime = None
    size = 0
    if INDEX_FILE.is_file():
        st = INDEX_FILE.stat()
        mtime = st.st_mtime
        size = st.st_size
    db = dam_db.status() if dam_db else {"ok": False, "error": "dam_db_missing"}
    with _index_lock:
        state = dict(_index_state)
    return {
        "ok": True,
        "index_path": str(INDEX_FILE),
        "mtime": mtime,
        "mtime_iso": datetime.fromtimestamp(mtime, timezone.utc).isoformat() if mtime else "",
        "size": size,
        "rebuild": state,
        "database": db,
    }


def _run_index_rebuild() -> None:
    global _index_state
    with _index_lock:
        if _index_state["running"]:
            return
        _index_state["running"] = True
        _index_state["last_started"] = utc_now()
        _index_state["last_error"] = ""
    try:
        if not BUILD_INDEX.is_file():
            raise FileNotFoundError(str(BUILD_INDEX))
        _drop_json_cache(INDEX_FILE)
        _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        rc = subprocess.call(
            [sys.executable, str(BUILD_INDEX)],
            creationflags=_no_win,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        with _index_lock:
            _index_state["last_rc"] = rc
            _index_state["last_ok"] = rc == 0
            _index_state["last_finished"] = utc_now()
            if rc != 0:
                _index_state["last_error"] = f"build_rc_{rc}"
        append_audit(
            {
                "action": "index_rebuild",
                "user": "system",
                "detail": "ok" if rc == 0 else f"rc={rc}",
                "meta": {"rc": rc},
            }
        )
        if rc == 0:
            _drop_json_cache(INDEX_FILE)
            try:
                import meta_store

                meta_store.sync_from_file_index()
            except Exception as meta_exc:  # noqa: BLE001
                append_audit(
                    {
                        "action": "meta_sync",
                        "user": "system",
                        "detail": str(meta_exc),
                        "meta": {},
                    }
                )
    except Exception as exc:  # noqa: BLE001
        with _index_lock:
            _index_state["last_ok"] = False
            _index_state["last_error"] = str(exc)
            _index_state["last_finished"] = utc_now()
    finally:
        with _index_lock:
            _index_state["running"] = False


def start_index_rebuild() -> dict:
    with _index_lock:
        if _index_state["running"]:
            return {"ok": True, "started": False, "running": True, "rebuild": dict(_index_state)}
    threading.Thread(target=_run_index_rebuild, daemon=True).start()
    # Daj watkowi chwile na ustawienie flagi
    time.sleep(0.05)
    return {"ok": True, "started": True, "running": True, "rebuild": index_status()["rebuild"]}


_INDEX_RE = re.compile(r"^(FOL\d+|\d{5,9})(\.\d{2})?$", re.IGNORECASE)


def _is_under_marketing(path: Path) -> bool:
    if dam_path_resolve_mod is not None:
        return dam_path_resolve_mod.is_under_marketing(
            path,
            resolve_base_path=resolve_base_path_for_current_device,
            marketing_candidates=MARKETING_CANDIDATES,
            machine_config_path=MACHINE_CONFIG,
        )
    try:
        resolved = path.resolve()
    except OSError:
        return False
    candidates = list(MARKETING_CANDIDATES)
    cfg = MACHINE_CONFIG
    if cfg.is_file():
        try:
            data = json.loads(cfg.read_text(encoding="utf-8"))
            base = (data.get("base_path") or data.get("path") or "").strip()
            if base:
                candidates.insert(0, Path(base))
        except (OSError, json.JSONDecodeError):
            pass
    for root in candidates:
        try:
            resolved.relative_to(root.resolve())
            return True
        except (ValueError, OSError):
            continue
    return False


def rename_index_in_folder(
    folder: str,
    from_index: str,
    to_index: str,
    dry_run: bool = False,
) -> dict:
    """Rename occurrences of an index inside one revision folder (files + dirs)."""
    from_index = (from_index or "").strip()
    to_index = (to_index or "").strip()
    if not from_index or not to_index:
        return {"ok": False, "error": "from_and_to_required"}
    if from_index == to_index:
        return {"ok": False, "error": "same_index"}
    if not _INDEX_RE.match(from_index) or not _INDEX_RE.match(to_index):
        return {"ok": False, "error": "invalid_index_format"}

    root = Path(normalize_path(folder))
    if not root.is_dir():
        return {"ok": False, "error": "folder_not_found", "path": str(root)}
    if not _is_under_marketing(root):
        return {"ok": False, "error": "path_outside_marketing", "path": str(root)}

    renamed: list[dict] = []
    errors: list[dict] = []

    # Bottom-up: files first, then directories (so parent rename sees already-fixed children)
    all_paths = sorted(root.rglob("*"), key=lambda p: len(p.parts), reverse=True)
    # Include the revision folder itself last (shallowest rename among parents)
    targets = [p for p in all_paths if from_index in p.name]
    if from_index in root.name:
        targets.append(root)

    for path in targets:
        new_name = path.name.replace(from_index, to_index)
        if new_name == path.name:
            continue
        dest = path.with_name(new_name)
        entry = {"from": str(path), "to": str(dest)}
        if dry_run:
            renamed.append(entry)
            continue
        try:
            if dest.exists():
                errors.append({**entry, "error": "target_exists"})
                continue
            path.rename(dest)
            renamed.append(entry)
        except OSError as exc:
            errors.append({**entry, "error": str(exc)})

    append_audit(
        {
            "action": "rename_index",
            "path": str(root),
            "detail": f"{from_index} -> {to_index}",
            "renamed_count": len(renamed),
            "error_count": len(errors),
            "dry_run": bool(dry_run),
        }
    )
    if not dry_run and renamed and len(errors) == 0:
        path_renames = []
        for item in renamed:
            old_p = Path(normalize_path(item.get("from") or ""))
            new_p = Path(normalize_path(item.get("to") or ""))
            path_renames.append(
                {
                    "old_path": item.get("from"),
                    "new_path": item.get("to"),
                    "old_name": old_p.name,
                    "new_name": new_p.name,
                }
            )
        new_folder = str(root)
        for item in renamed:
            if normalize_path(item.get("from") or "") == normalize_path(folder):
                new_folder = item.get("to") or new_folder
                break
        append_change_log(
            {
                "action": "rename_index",
                "category": "index",
                "index_from": from_index,
                "index_to": to_index,
                "folder": new_folder,
                "path_renames": path_renames,
            }
        )
    return {
        "ok": len(errors) == 0,
        "folder": str(root),
        "from_index": from_index,
        "to_index": to_index,
        "dry_run": bool(dry_run),
        "renamed": renamed,
        "errors": errors,
    }


def append_carrier_override(path_key: str, entry: dict) -> dict:
    overrides_file = WEB_ROOT / "data" / "carrier-overrides.json"
    data = _load_json(overrides_file, {"overrides": {}})
    if "overrides" not in data or not isinstance(data["overrides"], dict):
        data["overrides"] = {}
    data["overrides"][path_key] = entry
    m = re.search(r"(\d{7}(?:\.\d+)?)", path_key)
    if m:
        data["overrides"][m.group(1)] = entry
    data["updated_at"] = utc_now()
    _save_json(overrides_file, data)
    return {"ok": True, "path": path_key, "entry": entry}


ELEMENTS_LINK_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".tif", ".tiff",
    ".ai", ".psd", ".indd", ".pdf", ".zip", ".rar", ".7z",
    ".svg", ".eps", ".pptx", ".ppt",
}


def _count_elements_files(target: Path) -> int:
    """Policz pliki elementow w folderze (max 2 poziomy w dol)."""
    if target.is_file():
        return 1 if target.suffix.lower() in ELEMENTS_LINK_EXTS else 0
    if not target.is_dir():
        return 0
    n = 0
    try:
        for child in target.iterdir():
            if child.is_file() and child.suffix.lower() in ELEMENTS_LINK_EXTS:
                n += 1
            elif child.is_dir():
                try:
                    for nested in child.iterdir():
                        if nested.is_file() and nested.suffix.lower() in ELEMENTS_LINK_EXTS:
                            n += 1
                        if n >= 500:
                            return n
                except OSError:
                    pass
            if n >= 500:
                return n
    except OSError:
        return n
    return n


def upsert_elements_link(payload: dict) -> dict:
    """Reczne powiazanie Elementy/skladniki: folder lub plik wskazany przez usera/admina."""
    store = WEB_ROOT / "data" / "elements-overrides.json"
    data = _load_json(store, {"links": {}, "updated_at": ""})
    if "links" not in data or not isinstance(data["links"], dict):
        data["links"] = {}
    action = (payload.get("action") or "link").strip().lower()
    rev_key = (payload.get("revision_path") or payload.get("path_key") or "").strip().replace("\\", "/")
    index_key = (payload.get("index") or "").strip()
    if action == "unlink":
        if not rev_key and not index_key:
            return {"ok": False, "error": "revision_path_or_index_required"}
        removed = False
        if rev_key and rev_key in data["links"]:
            data["links"].pop(rev_key, None)
            removed = True
        if index_key and index_key in data["links"]:
            data["links"].pop(index_key, None)
            removed = True
        # usun tez wpisy wskazujace ten sam folder (gdy klucz indeksowy)
        if rev_key:
            for k, v in list(data["links"].items()):
                if isinstance(v, dict) and str(v.get("revision_path") or "").replace("\\", "/") == rev_key:
                    data["links"].pop(k, None)
                    removed = True
        data["updated_at"] = utc_now()
        _save_json(store, data)
        return {"ok": True, "action": "unlink", "removed": removed, "links": data["links"]}

    target_raw = (payload.get("target_path") or payload.get("path") or "").strip()
    if not rev_key or not target_raw:
        return {"ok": False, "error": "revision_path_and_target_required"}
    target = Path(normalize_path(target_raw))
    if not target.exists():
        return {"ok": False, "error": "path_not_found", "path": str(target)}
    if not _is_under_marketing(target if target.is_dir() else target.parent):
        return {"ok": False, "error": "path_outside_marketing", "path": str(target)}
    kind = "folder" if target.is_dir() else "file"
    folder_path = target if target.is_dir() else target.parent
    file_count = _count_elements_files(target if target.is_dir() else folder_path)
    entry = {
        "path": str(target).replace("\\", "/"),
        "folder": str(folder_path).replace("\\", "/"),
        "kind": kind,
        "file_count": file_count,
        "revision_path": rev_key,
        "index": index_key,
        "product_id": (payload.get("product_id") or "").strip(),
        "linked_by": (payload.get("linked_by") or "user").strip() or "user",
        "linked_at": utc_now(),
        "note": (payload.get("note") or "").strip(),
    }
    data["links"][rev_key] = entry
    if index_key:
        data["links"][index_key] = entry
    data["updated_at"] = utc_now()
    _save_json(store, data)
    return {"ok": True, "action": "link", "entry": entry, "store": str(store)}


def list_folder_browse(path: str, mode: str = "assets") -> dict:
    """Lista folderow + plikow (nie tylko obrazow) do wskazania ELEMENTY w przegladarce."""
    target = Path(normalize_path(path or ""))
    if not target.exists():
        return {"ok": False, "error": "path_not_found", "path": str(target), "files": [], "folders": []}
    if target.is_file():
        target = target.parent
    if not target.is_dir():
        return {"ok": False, "error": "not_a_directory", "path": str(target), "files": [], "folders": []}
    if not _is_under_marketing(target):
        return {"ok": False, "error": "path_outside_marketing", "path": str(target), "files": [], "folders": []}
    exts = ELEMENTS_LINK_EXTS if (mode or "assets") == "assets" else IMAGE_EXTS
    files: list[dict] = []
    folders: list[dict] = []
    try:
        for child in sorted(target.iterdir(), key=lambda p: p.name.lower()):
            if child.is_dir():
                if len(folders) < 200:
                    folders.append({"name": child.name, "path": str(child).replace("\\", "/")})
                continue
            if not child.is_file():
                continue
            if child.suffix.lower() not in exts:
                continue
            files.append(
                {
                    "name": child.name,
                    "path": str(child).replace("\\", "/"),
                    "ext": child.suffix.lower().lstrip("."),
                    "size": child.stat().st_size,
                }
            )
            if len(files) >= 200:
                break
    except OSError as exc:
        return {"ok": False, "error": str(exc), "path": str(target), "files": [], "folders": []}
    parent = target.parent
    parent_ok = str(parent) != str(target) and _is_under_marketing(parent)
    return {
        "ok": True,
        "path": str(target).replace("\\", "/"),
        "files": files,
        "folders": folders,
        "file_count": _count_elements_files(target),
        "parent": str(parent).replace("\\", "/") if parent_ok else "",
        "mode": mode or "assets",
    }


TAG_PROPOSALS_FILE = WEB_ROOT / "data" / "tag-proposals.json"
CARRIER_TYPES_FILE = WEB_ROOT / "data" / "carrier-types.json"
ASSIGNMENT_LOG_FILE = WEB_ROOT / "data" / "carrier-assignment-log.json"
CHANGE_LOG_FILE = WEB_ROOT / "data" / "change-log.json"
LIFECYCLE_STORE_FILE = WEB_ROOT / "data" / "lifecycle-status.json"
PRODUCT_STATUS_FILE = WEB_ROOT / "data" / "product-status.json"
LANG_OVERRIDES_FILE = WEB_ROOT / "data" / "lang-overrides.json"
PROPOSAL_TTL_HOURS = 72

_LANG_ALIAS_CANON = {"gb": "en", "uk": "en", "ukr": "ua"}
_KNOWN_LANG_FOR_FOLDER = frozenset({
    "pl", "de", "en", "ua", "cz", "sk", "hu", "ro", "lt", "lv", "ee",
    "fr", "it", "es", "nl", "ru", "hr", "si", "bg", "at", "be", "dk",
    "se", "no", "fi", "pt", "gr", "ie", "ch", "ar",
})


def canonicalize_lang_code(code: str) -> str:
    c = (code or "").strip().lower()
    if not c or c in ("?", "unknown", "xx"):
        return ""
    c = _LANG_ALIAS_CANON.get(c, c)
    if c in ("gb", "uk"):
        return "en"
    return c


def _is_lang_only_segment(part: str) -> bool:
    toks = [t for t in re.split(r"[\s,;/]+", (part or "").strip()) if t]
    if not toks:
        return False
    for t in toks:
        c = canonicalize_lang_code(t)
        if not c or c not in _KNOWN_LANG_FOR_FOLDER or len(c) != 2:
            return False
    return True


def build_revision_folder_name_with_langs(folder_name: str, langs: list[str]) -> str:
    """Wstaw ' - PL EN - ' miedzy nazwa/data a indeksem gdy 2+ jezyki.
    Single-lang (np. samo PL): bez samotnego ' - PL - '.
    """
    name = (folder_name or "").strip()
    if not name:
        return name
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in langs or []:
        c = canonicalize_lang_code(raw)
        if c and c in _KNOWN_LANG_FOR_FOLDER and c not in seen:
            seen.add(c)
            cleaned.append(c)
    # Prefer PL first when present
    if "pl" in cleaned:
        cleaned = ["pl"] + [c for c in cleaned if c != "pl"]

    parts = [p.strip() for p in name.split(" - ") if p.strip()]
    if not parts:
        return name

    date_re = re.compile(r"^\d{2}[./-]\d{2}[./-]\d{2,4}$")
    index_re = re.compile(r"^\d{5,9}(?:\.\d{2})?$")

    kept: list[str] = []
    index_part = None
    for part in parts:
        if _is_lang_only_segment(part):
            continue
        if index_re.match(part) and index_part is None:
            index_part = part
            continue
        kept.append(part)

    # Rebuild: kept parts + optional lang segment + index
    out_parts = list(kept)
    if len(cleaned) >= 2:
        out_parts.append(" ".join(c.upper() for c in cleaned))
    if index_part:
        out_parts.append(index_part)
    elif kept and date_re.match(kept[-1]) is None:
        # no index found - leave as-is structure without inventing index
        pass
    return " - ".join(out_parts)


def rename_revision_langs_on_disk(revision_path: str, langs: list[str]) -> dict:
    """Rename folder rewizji wg wzorca multi-lang tokenow."""
    p = Path(normalize_path(revision_path))
    if not p.is_dir():
        return {"ok": False, "error": "revision_not_found", "path": str(p)}
    new_name = build_revision_folder_name_with_langs(p.name, langs)
    if new_name == p.name:
        return {
            "ok": True,
            "noop": True,
            "old_path": str(p),
            "new_path": str(p),
            "old_name": p.name,
            "new_name": p.name,
            "langs": [canonicalize_lang_code(x) for x in (langs or []) if canonicalize_lang_code(x)],
        }
    dest = p.parent / new_name
    if dest.exists() and dest != p:
        return {"ok": False, "error": "target_exists", "target": str(dest)}
    try:
        p.rename(dest)
    except OSError as exc:
        return {"ok": False, "error": str(exc)}
    return {
        "ok": True,
        "noop": False,
        "old_path": str(p),
        "new_path": str(dest),
        "old_name": p.name,
        "new_name": new_name,
        "langs": [canonicalize_lang_code(x) for x in (langs or []) if canonicalize_lang_code(x)],
    }


def save_lang_override(
    *,
    revision_path: str = "",
    index: str = "",
    langs: list[str],
    actor: str = "",
) -> dict:
    data = _load_json(
        LANG_OVERRIDES_FILE,
        {
            "note": "Reczne jezyki wariantu.",
            "policy": {"manual_wins": True},
            "overrides": {},
            "updated_at": "",
        },
    )
    overrides = data.setdefault("overrides", {})
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in langs or []:
        c = canonicalize_lang_code(raw)
        if c and c not in seen:
            seen.add(c)
            cleaned.append(c)
    if not cleaned:
        return {"ok": False, "error": "langs_required"}
    entry = {
        "langs": cleaned,
        "updated_at": utc_now(),
        "updated_by": actor or "",
    }
    keys = []
    if index:
        keys.append(str(index).strip())
    if revision_path:
        rp = str(revision_path).replace("\\", "/")
        keys.append(rp)
        keys.append(rp.replace("/", "\\"))
    if not keys:
        return {"ok": False, "error": "revision_path_or_index_required"}
    for k in keys:
        if k:
            overrides[k] = dict(entry)
    data["updated_at"] = utc_now()
    _save_json(LANG_OVERRIDES_FILE, data)
    return {"ok": True, "langs": cleaned, "keys": keys}


def apply_revision_langs(
    payload: dict,
    *,
    session_role: str = "user",
    session_email: str = "",
) -> dict:
    """Admin: natychmiastowy zapis langs + rename folderu. Non-admin: proposal."""
    role = (session_role or "user").strip().lower()
    revision_path = (payload.get("revision_path") or "").strip()
    index = (payload.get("index") or payload.get("revision_index") or "").strip()
    raw_langs = payload.get("langs")
    if not isinstance(raw_langs, list):
        one = (payload.get("new_lang_code") or payload.get("lang") or "").strip()
        raw_langs = [one] if one else []
    cleaned = []
    seen: set[str] = set()
    for raw in raw_langs:
        c = canonicalize_lang_code(str(raw))
        if c and c not in seen:
            seen.add(c)
            cleaned.append(c)
    if not revision_path and not index:
        return {"ok": False, "error": "revision_path_or_index_required"}
    if not cleaned:
        return {"ok": False, "error": "langs_required"}

    actor = session_email or (payload.get("user_email") or "")
    if role == "admin":
        rename_res = {"ok": True, "noop": True, "new_path": revision_path, "old_path": revision_path}
        if revision_path:
            rename_res = rename_revision_langs_on_disk(revision_path, cleaned)
            if not rename_res.get("ok"):
                return rename_res
        new_path = rename_res.get("new_path") or revision_path
        ov = save_lang_override(
            revision_path=new_path or revision_path,
            index=index,
            langs=cleaned,
            actor=actor,
        )
        if not ov.get("ok"):
            return ov
        append_audit({
            "action": "revision_langs_applied",
            "path": new_path,
            "detail": ",".join(cleaned),
            "user": actor,
        })
        append_change_log({
            "action": "set_langs",
            "category": "lang",
            "actor": actor,
            "langs": cleaned,
            "folder_rename": {
                "old_path": rename_res.get("old_path"),
                "new_path": rename_res.get("new_path"),
                "old_name": rename_res.get("old_name"),
                "new_name": rename_res.get("new_name"),
            },
            "product_id": payload.get("product_id") or "",
            "product_name": payload.get("product_name") or "",
        })
        return {
            "ok": True,
            "applied": True,
            "immediate": True,
            "langs": cleaned,
            **{k: rename_res.get(k) for k in (
                "old_path", "new_path", "old_name", "new_name", "noop"
            )},
        }

    # Non-admin: queue as tag proposal (field=lang)
    data = load_tag_proposals()
    proposals = data.setdefault("proposals", [])
    now = datetime.now(timezone.utc)
    expires = now.timestamp() + PROPOSAL_TTL_HOURS * 3600
    proposal_id = f"prop_lang_{int(now.timestamp() * 1000)}"
    entry = {
        "id": proposal_id,
        "field": "lang",
        "revision_path": revision_path,
        "product_id": payload.get("product_id") or "",
        "product_name": payload.get("product_name") or "",
        "current_value": (payload.get("current_langs") or payload.get("current_value") or ""),
        "proposed_value": ",".join(cleaned),
        "proposed_langs": cleaned,
        "status": "pending",
        "submitted_by": actor or "anonim",
        "submitted_at": now.isoformat(timespec="seconds"),
        "expires_at": datetime.fromtimestamp(expires, tz=timezone.utc).isoformat(timespec="seconds"),
        "decided_by": None,
        "decided_at": None,
    }
    proposals.append(entry)
    save_tag_proposals(data)
    append_inbox_item({
        "type": "tag_proposal",
        "title": f"Propozycja jezykow: {entry.get('current_value') or '?'} -> {','.join(cleaned)}",
        "detail": f"{entry.get('product_name') or revision_path}\nZglosil: {actor}\nproposal_id: {proposal_id}",
        "tags": ["moderacja", "tag", "lang", "propozycja"],
        "requested_by": actor,
        "product_id": entry.get("product_id") or "",
        "path": revision_path,
        "proposal_id": proposal_id,
        "read": False,
    })
    return {"ok": True, "applied": False, "immediate": False, "proposal": entry}


def mirror_lifecycle_to_product_status(result: dict, payload: dict) -> None:
    """Dopisz status do product-status.json (revisions + products) po FS change."""
    data = _load_json(PRODUCT_STATUS_FILE, {"updated_at": "", "revisions": {}, "products": {}})
    data.setdefault("revisions", {})
    data.setdefault("products", {})
    status = result.get("status") or "clear"
    letter = result.get("letter")
    note = f"Lifecycle {letter or 'clear'}"
    scope = (result.get("scope") or payload.get("scope") or "").lower()
    if scope == "variant":
        keys = [
            result.get("final_variant_path") or "",
            payload.get("path") or "",
            payload.get("revision_index") or payload.get("index") or "",
        ]
        for key in keys:
            key = str(key or "").strip()
            if not key:
                continue
            data["revisions"][key] = {"status": status, "note": note, "letter": letter}
    else:
        pid = str(payload.get("product_id") or "").strip()
        ppath = result.get("final_product_path") or payload.get("path") or ""
        if pid:
            data["products"][pid] = {
                "status": status,
                "note": note,
                "letter": letter,
                "path": ppath,
            }
        if ppath:
            data["products"][ppath] = {
                "status": status,
                "note": note,
                "letter": letter,
                "path": ppath,
            }
    data["updated_at"] = utc_now()
    _save_json(PRODUCT_STATUS_FILE, data)

# Slot folderow w rewizji - tu rename'ujemy AI/PDF/wizki (Fala D).
_REVISION_FILE_SLOT_HINTS = (
    "PROJEKT", "PROJECT", "DRUK", "PRINT", "WIZKI", "WIZUAL", "VISUAL", "PAKIET",
)
_FILE_DATE_RE = re.compile(r"(?:_|-)(20\d{2})(?:_|-)(\d{2})(?:_|-)(\d{2})")
_FILE_INDEX_RE = re.compile(r"(6300\d{3})(?:\.(\d{2}))?")
_FILE_BRAND_RE = re.compile(r"^(DK|GC)[_-]", re.I)
_FILE_ROLE_RE = re.compile(r"[_-](F|FQ|PREV|PREVIEW)$", re.I)
_FILE_LANG_RE = re.compile(r"[_-]([A-Za-z]{2}(?:[_-][A-Za-z]{2})+)$")
_FILE_CARRIER_TOKENS = sorted(
    {
        "DOY6X", "KAR6X", "DOYPACK", "KARTON", "BATON", "FOLIA", "REKAW", "SASZETKA",
        "DOY", "KAR", "BAT", "BAR", "MINI", "FOL", "FOIL", "SASZ", "TUBA", "ETY",
        "SHOT", "OBW", "SLEEVE",
    },
    key=len,
    reverse=True,
)

# Znane kody nosnikow (do wykrycia i ZAMIANY istniejacego prefiksu, nie doklejania
# drugiego przed pierwszym - "FOLIA - ..." -> "DOY - ...", nie "DOY - FOLIA - ...").
KNOWN_CARRIER_CODES = (
    "KAR6X", "DOY6X", "ETY-BUT", "ETY-SLO", "DOY", "KAR", "MINI", "BAT", "BAR",
    "BIGPAK", "TUBA", "FOLIA", "FOL", "FOIL", "SASZ", "REKAW", "SLEEVE", "OBW",
    "ETY", "SHOT", "WIZKA",
)

# Etykiety PL / warianty nazw folderow (najdluzsze pierwsze) - rename DOYPACK -> BAT
KNOWN_CARRIER_PREFIXES = (
    "DOYPACK 6X MINI",
    "DOYPACK 6x MINI",
    "KARTON 6X MINI",
    "KARTON 6x MINI",
    "MINI BATON",
    "ETYKIETA BUTELKA",
    "ETYKIETA SLOIK",
    "ETYKIETA SŁOIK",
    "BIGPAK",
    "DOYPACK",
    "KARTON",
    "BATON",
    "FOLIA",
    "REKAW",
    "RĘKAW",
    "SASZETKA",
    "OBWOLUTA",
    "WIZUALIZACJE",
    "WIZKA",
    "TUBA",
    "SHOT",
    "ETYKIETA",
) + KNOWN_CARRIER_CODES

# Mapowanie kodu API (BAT/DOY) -> prefiks folderu na dysku.
# ZRODLO PRAWDY: apps/web/data/naming-dictionary.json (policy + carriers[].short)
# + kopia w Postgres dam_kv_store / naming-dictionary. Pelne DOYPACK/BATON w UI;
# na dysku zawsze skrot (DOY/BAT/FOL). Stare foldery z pelnym prefiksem
# wykrywa KNOWN_CARRIER_PREFIXES przy rename.
NAMING_DICTIONARY_FILE = WEB_ROOT / "data" / "naming-dictionary.json"
APP_SETTINGS_FILE = WEB_ROOT / "data" / "app-settings.json"
PROGRAM_INSTRUCTIONS_FILE = WEB_ROOT / "data" / "program-instructions.json"
PRODUCT_CATALOG_FILE = WEB_ROOT / "data" / "product-catalog.json"
PRODUCT_PRICES_CACHE_FILE = WEB_ROOT / "data" / "product-prices-cache.json"
BULK_PACKAGING_FILE = WEB_ROOT / "data" / "bulk-packaging.json"
SHOP_CATEGORIES_FILE = WEB_ROOT / "data" / "shop-categories.json"
BRANDING_INDEX_FILE = WEB_ROOT / "data" / "branding-index.json"
BRANDING_SEARCH_INDEX_FILE = WEB_ROOT / "data" / "branding-search-index.json"
_BRANDING_SEARCH_INDEX_MEM: dict | None = None


def _branding_search_index_mem() -> dict:
    global _BRANDING_SEARCH_INDEX_MEM
    if _BRANDING_SEARCH_INDEX_MEM is None:
        loaded = _load_json(BRANDING_SEARCH_INDEX_FILE, None)
        _BRANDING_SEARCH_INDEX_MEM = loaded if isinstance(loaded, dict) else {"entries": []}
    return _BRANDING_SEARCH_INDEX_MEM


def _branding_picker_title(entry: dict) -> str:
    blob = str(entry.get("search_blob") or "")
    low = blob.lower()
    sep = low.find(" x:")
    if sep > 0:
        return blob[:sep].strip()
    path = str(entry.get("path") or "").replace("\\", "/")
    if path:
        base = path.rsplit("/", 1)[-1]
        if base:
            dot = base.rfind(".")
            if dot > 0:
                return base[:dot]
            return base
    return str(entry.get("id") or "")


def _light_branding_picker_entry(entry: dict) -> dict:
    path = str(entry.get("path") or "").replace("\\", "/")
    title = _branding_picker_title(entry)
    thumb_url = ""
    if path and path.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff")):
        from urllib.parse import quote

        thumb_url = "/media?path=" + quote(path) + "&preview=1"
    return {
        "id": entry.get("id") or "",
        "name": title,
        "title": title,
        "path": path,
        "search_blob": entry.get("search_blob") or "",
        "thumb_url": thumb_url,
    }


def resolve_branding_search_picker(query: str, limit: int = 80, include_ids: list | None = None) -> dict:
    """Light picker search — never ship full branding-search-index (~40MB) to browser."""
    data = _branding_search_index_mem()
    entries = data.get("entries") if isinstance(data.get("entries"), list) else []
    limit = max(1, min(int(limit or 80), 120))
    q = str(query or "").strip().lower()
    include_ids = [str(x).strip() for x in (include_ids or []) if str(x).strip()]
    by_id: dict[str, dict] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "").strip()
        if eid:
            by_id[eid] = entry
    out: list[dict] = []
    seen: set[str] = set()
    for iid in include_ids:
        if iid in seen:
            continue
        src = by_id.get(iid)
        if not src:
            continue
        seen.add(iid)
        out.append(_light_branding_picker_entry(src))
    # Empty query without include_ids must not scan the full index (UI freeze on open).
    if not q and not include_ids:
        return {"ok": True, "entries": out, "count": len(out), "query": q}
    for entry in entries:
        if len(out) >= limit:
            break
        if not isinstance(entry, dict):
            continue
        eid = str(entry.get("id") or "").strip()
        if not eid or eid in seen:
            continue
        blob = str(entry.get("search_blob") or eid or entry.get("path") or "").lower()
        if q and q not in blob:
            continue
        seen.add(eid)
        out.append(_light_branding_picker_entry(entry))
    return {"ok": True, "entries": out, "count": len(out), "query": q}


def _branding_digits_only(s) -> str:
    return re.sub(r"\D", "", str(s or ""))


def _branding_is_archived(a: dict) -> bool:
    if not isinstance(a, dict):
        return False
    if "ARCHIWUM" in (a.get("tags") or []) or a.get("is_archive"):
        return True
    return "ARCHIWUM" in str(a.get("path") or "").upper()


def _branding_asset_matches(a: dict, product_id: str, tokens: list) -> bool:
    """Port 1:1 z dam-product-correlation.js brandingAssetMatches (UI nie parsuje 388MB)."""
    ids = list(a.get("linked_product_ids") or []) + list(a.get("product_ids") or [])
    if product_id and product_id in ids:
        return True
    sku = str(a.get("sku") or "")
    if sku:
        for t in tokens:
            if not t:
                continue
            if sku == t or sku.startswith(t) or t.startswith(sku):
                return True
    hay = (
        str(a.get("path") or "")
        + " "
        + str(a.get("name") or "")
        + " "
        + str(a.get("search_blob") or "")
    ).lower()
    for tok in tokens:
        tl = str(tok or "").lower()
        if len(tl) >= 6 and tl in hay:
            return True
        td = _branding_digits_only(tl)
        if len(td) >= 6 and td in hay:
            return True
    return False


def resolve_branding_for_product(
    product_id: str,
    tokens: list,
    limit: int = 400,
    include_archive: bool = False,
    sort: str = "",
) -> dict:
    """Filtr pelnego branding-index po stronie bridge — UI dostaje tylko dopasowane assety.

    Bez product_id/tokens: zwraca wszystkie nie-archiwalne (dla sort=recent widget dashboardu).
    """
    data = _load_json(BRANDING_INDEX_FILE, None)
    assets = (
        data.get("assets")
        if isinstance(data, dict) and isinstance(data.get("assets"), list)
        else []
    )
    limit = max(1, min(int(limit or 400), 2000))
    tokens = [str(t).strip() for t in (tokens or []) if str(t).strip()]
    product_id = str(product_id or "").strip()
    has_filter = bool(product_id or tokens)
    out: list = []
    for a in assets:
        if not isinstance(a, dict):
            continue
        if not include_archive and _branding_is_archived(a):
            continue
        if has_filter and not _branding_asset_matches(a, product_id, tokens):
            continue
        out.append(a)
        if not sort and len(out) >= limit:
            break
    if sort == "recent":
        out.sort(
            key=lambda x: str(x.get("mtime") or x.get("modified") or x.get("date") or ""),
            reverse=True,
        )
    out = out[:limit]
    return {"ok": True, "assets": out, "count": len(out), "product_id": product_id}


BRANDING_OVERRIDES_FILE = WEB_ROOT / "data" / "branding-metadata-overrides.json"
BRANDING_ASSOC_OVERRIDES_FILE = WEB_ROOT / "data" / "branding-associations-overrides.json"
BRANDING_STATUS_FILE = WEB_ROOT / "data" / "branding-build-status.json"
BRANDING_RECOGNIZE_STATUS_FILE = WEB_ROOT / "data" / "branding-recognize-status.json"
WYKROJNIKI_REGISTRY_FILE = WEB_ROOT / "data" / "wykrojniki-registry.json"
SLEEVE_STOCK_FILE = WEB_ROOT / "data" / "sleeve-stock.json"
PRODUCTION_COST_CATALOG_FILE = WEB_ROOT / "data" / "production-cost-catalog.json"
DEFAULT_SLEEVE_STOCK_XLSX = Path(
    r"X:/Marketing/- POLSKA/01 - PRODUKTY/01 - WYKROJNIKI/STANY RĘKAWKÓW 2026.xlsx"
)
BUILD_BRANDING_INDEX = WEB_ROOT / "scripts" / "build-branding-index.py"
FETCH_PRODUCT_PRICES = WEB_ROOT / "scripts" / "fetch-product-prices.py"
IMPORT_WYKROJNIKI = WEB_ROOT / "scripts" / "import-wykrojniki-xlsx.py"
IMPORT_SLEEVE_STOCK = WEB_ROOT / "scripts" / "import-sleeve-stock-xlsx.py"
LINK_WYKROJNIKI = WEB_ROOT / "scripts" / "link-wykrojniki-products.py"
ENRICH_BRANDING_RECOGNIZE = WEB_ROOT / "scripts" / "enrich-branding-recognize.py"
COST_RATES_FILE = WEB_ROOT / "data" / "cost-rates.json"
FMCG_CATALOG_FILE = WEB_ROOT / "data" / "fmcg-cost-catalog.json"
FMCG_IMPORT_MAP_FILE = WEB_ROOT / "data" / "fmcg-cost-import-map.json"
PROJECT_COSTS_FILE = WEB_ROOT / "data" / "project-costs.json"
INVOICES_FILE = WEB_ROOT / "data" / "invoices.json"
INVOICE_ERP_SYNC_FILE = WEB_ROOT / "data" / "invoice-erp-sync.json"
ASANA_TASKS_FILE = WEB_ROOT / "data" / "asana-tasks.json"
WYKROJNIK_QUEUE_FILE = WEB_ROOT / "data" / "wykrojnik-mapping-queue.json"
BUILD_PROJECT_COSTS = WEB_ROOT / "scripts" / "build-project-costs.py"

_CARRIER_FOLDER_PREFIX_FALLBACK = {
    "BAT": "BAT",
    "BAR": "BAT",
    "MINI": "MINI",
    "DOY": "DOY",
    "DOY6X": "DOY6X",
    "KAR": "KAR",
    "KAR6X": "KAR6X",
    "FOL": "FOL",
    "FOIL": "FOL",
    "FOLIA": "FOL",
    "REKAW": "REKAW",
    "SLEEVE": "REKAW",
    "SASZ": "SASZ",
    "OBW": "OBW",
    "ETY": "ETY",
    "ETY-BUT": "ETY-BUT",
    "ETY-SLO": "ETY-SLO",
    "TUBA": "TUBA",
    "SHOT": "SHOT",
    "BIGPAK": "BIGPAK",
    "WIZKA": "WIZKA",
    "NONE": "",
}


def load_carrier_folder_prefix(dict_data: dict | None = None) -> dict[str, str]:
    """Prefiks folderu z naming-dictionary.policy + carriers[].short|label_pl."""
    data = dict_data
    if data is None:
        try:
            if NAMING_DICTIONARY_FILE.is_file():
                data = json.loads(NAMING_DICTIONARY_FILE.read_text(encoding="utf-8"))
            else:
                data = {}
        except (OSError, json.JSONDecodeError):
            data = {}
    policy = (data or {}).get("policy") or {}
    use_short = str(policy.get("carrier_prefix_on_disk") or "short").lower() == "short"
    out = dict(_CARRIER_FOLDER_PREFIX_FALLBACK)
    for code, meta in ((data or {}).get("carriers") or {}).items():
        if not isinstance(meta, dict):
            continue
        code_u = str(code).strip().upper()
        short = str(meta.get("short") or code_u).strip().upper()
        label = str(meta.get("label_pl") or code_u).strip()
        prefix = short if use_short else label
        out[code_u] = prefix
        for alias in meta.get("aliases") or []:
            a = str(alias).strip().upper()
            if a:
                out[a] = prefix
    out["NONE"] = ""
    return out


CARRIER_FOLDER_PREFIX = load_carrier_folder_prefix()


def reload_naming_policy_from_disk() -> dict:
    """Odswiez CARRIER_FOLDER_PREFIX po pull KV / zapisie slownika."""
    global CARRIER_FOLDER_PREFIX
    CARRIER_FOLDER_PREFIX = load_carrier_folder_prefix()
    return {
        "ok": True,
        "prefix_sample": {
            "DOY": CARRIER_FOLDER_PREFIX.get("DOY"),
            "FOLIA": CARRIER_FOLDER_PREFIX.get("FOLIA"),
            "BAT": CARRIER_FOLDER_PREFIX.get("BAT"),
        },
    }


# Tier 2 (ADR-009): te pliki JSON sa wspolne w Postgres dam_kv_store.
# Lokalny plik = cache (odswiezany natychmiast po wlasnym zapisie + co 30 min).
KV_STORE_KEYS = frozenset({
    "product-aliases",
    "product-name-pl",
    "product-people",
    "naming-dictionary",
    "app-settings",
    "program-instructions",
    "tag-proposals",
    "carrier-types",
    "carrier-assignment-log",
    "change-log",
    "lifecycle-status",
    "product-status",
    "notification-groups",
    "inbox-items",
    "carrier-overrides",
    "elements-overrides",
    "viz-flags",
    "thumb-overrides",
})


def _path_to_store_key(path: Path) -> str | None:
    name = path.name
    if not name.endswith(".json"):
        return None
    key = name[:-5]
    return key if key in KV_STORE_KEYS else None


def _pg_available() -> bool:
    try:
        import pg_db

        return pg_db.is_configured()
    except Exception:
        return False


_JSON_FILE_CACHE: dict[str, tuple[float, object]] = {}


def _drop_json_cache(path: Path) -> None:
    _JSON_FILE_CACHE.pop(str(path.resolve()), None)


def _invalidate_branding_data_caches() -> None:
    """Czysc pamiec JSON bridge PRZED zapisem / rebuild indeksu branding."""
    for rel in (
        "data/branding-index.json",
        "data/branding-search-index.json",
        "data/campaigns.json",
    ):
        _drop_json_cache(WEB_ROOT / rel)


def _load_json(path: Path, default):
    """Czytaj lokalny cache. (Prawda jest w PG - watcher odswieza co 30 min.)"""
    if not path.exists():
        return default
    try:
        mtime = path.stat().st_mtime
        key = str(path.resolve())
        cached = _JSON_FILE_CACHE.get(key)
        if cached is not None and cached[0] == mtime:
            return cached[1]
        data = json.loads(path.read_text(encoding="utf-8"))
        _JSON_FILE_CACHE[key] = (mtime, data)
        return data
    except json.JSONDecodeError:
        return default


def _save_json(path: Path, data) -> None:
    """Zapis lokalnego cache + (gdy PG skonfigurowany) upsert do dam_kv_store
    z SELECT ... FOR UPDATE - chroni przed utrata rownoleglych decyzji moderacji."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _drop_json_cache(path)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    store_key = _path_to_store_key(path)
    if not store_key or not _pg_available():
        return
    try:
        import pg_db

        conn = pg_db.connect()
        try:
            cur = conn.cursor()
            # Blokada wiersza - druga stacja poczeka zanim nadpisze
            pg_db.kv_get_for_update(store_key, None, cur)
            pg_db.kv_set_in_txn(store_key, data, updated_by="local_bridge", cur=cur)
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        print(f"kv_store save warning ({store_key}):", exc)


def _parse_csv_text(text: str) -> list[dict[str, str]]:
    import csv
    from io import StringIO

    raw = (text or "").strip()
    if not raw:
        return []
    if raw.startswith("\ufeff"):
        raw = raw[1:]
    reader = csv.DictReader(StringIO(raw))
    rows: list[dict[str, str]] = []
    for row in reader:
        if not row:
            continue
        cleaned = {str(k or "").strip(): str(v or "").strip() for k, v in row.items() if k}
        if any(cleaned.values()):
            rows.append(cleaned)
    return rows


def _extract_post_csv(raw: bytes, content_type: str, data: dict | None = None) -> str:
    ctype = (content_type or "").lower()
    if isinstance(data, dict):
        for key in ("csv", "text", "body"):
            val = data.get(key)
            if isinstance(val, str) and val.strip():
                return val
    if "text/csv" in ctype or "text/plain" in ctype:
        return raw.decode("utf-8", errors="replace")
    if "multipart/form-data" in ctype and raw:
        import re

        m = re.search(r"boundary=([^;\s]+)", content_type or "")
        if not m:
            return ""
        boundary = m.group(1).strip().strip('"')
        marker = ("--" + boundary).encode("ascii", errors="ignore")
        for part in raw.split(marker):
            if b"Content-Disposition" not in part:
                continue
            if b"filename=" not in part and b'name="' not in part:
                continue
            _, _, body = part.partition(b"\r\n\r\n")
            if not body:
                _, _, body = part.partition(b"\n\n")
            body = body.rstrip(b"\r\n-")
            if body:
                return body.decode("utf-8", errors="replace")
    return ""


def _extract_multipart_file(raw: bytes, content_type: str) -> tuple[bytes | None, str]:
    """Return (file_bytes, filename) from multipart upload; empty if none."""
    import re

    if not raw or "multipart/form-data" not in (content_type or "").lower():
        return None, ""
    m = re.search(r"boundary=([^;\s]+)", content_type or "")
    if not m:
        return None, ""
    boundary = m.group(1).strip().strip('"')
    marker = ("--" + boundary).encode("ascii", errors="ignore")
    for part in raw.split(marker):
        if b"Content-Disposition" not in part or b"filename=" not in part:
            continue
        head, _, body = part.partition(b"\r\n\r\n")
        if not body:
            head, _, body = part.partition(b"\n\n")
        body = body.rstrip(b"\r\n-")
        fm = re.search(br'filename="([^"]+)"', head) or re.search(br"filename=([^\r\n;]+)", head)
        name = fm.group(1).decode("utf-8", errors="replace").strip() if fm else "upload.bin"
        if body:
            return body, name
    return None, ""


def _run_sleeve_stock_import(path: Path) -> dict:
    """Import sleeve stock via script module (in-process) and push KV."""
    import importlib.util

    if not IMPORT_SLEEVE_STOCK.is_file():
        raise FileNotFoundError("import_sleeve_stock_script_missing")
    spec = importlib.util.spec_from_file_location("import_sleeve_stock_xlsx", IMPORT_SLEEVE_STOCK)
    if spec is None or spec.loader is None:
        raise RuntimeError("import_sleeve_stock_load_failed")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    data = mod.import_path(path, dry_run=False, write=True)
    # Ensure KV mirror via _save_json
    _save_json(SLEEVE_STOCK_FILE, data)
    return data


def _fmcg_default_catalog() -> dict:
    return {
        "version": 1,
        "currency": "PLN",
        "imported_at": None,
        "stages": ["procurement", "prepress", "production", "warehouse", "logistics"],
        "items": [],
    }


def _fmcg_compute(catalog: dict) -> dict:
    stages = catalog.get("stages") or [
        "procurement",
        "prepress",
        "production",
        "warehouse",
        "logistics",
    ]
    by_stage = {s: 0.0 for s in stages}
    missing = 0
    filled = 0
    for item in catalog.get("items") or []:
        if not isinstance(item, dict):
            continue
        stage = str(item.get("stage") or "").strip()
        amt = item.get("amount")
        if amt is None or amt == "":
            missing += 1
            continue
        try:
            val = float(amt)
        except (TypeError, ValueError):
            missing += 1
            continue
        filled += 1
        if stage in by_stage:
            by_stage[stage] += val
        else:
            by_stage[stage] = val
    return {
        "ok": True,
        "currency": catalog.get("currency") or "PLN",
        "by_stage": by_stage,
        "missing_count": missing,
        "filled_count": filled,
        "item_count": len(catalog.get("items") or []),
        "imported_at": catalog.get("imported_at"),
    }


def _apply_fmcg_csv_import(catalog: dict, rows: list[dict[str, str]]) -> tuple[int, list[str]]:
    import_map = _load_json(FMCG_IMPORT_MAP_FILE, {"maps": []})
    col_to_id: dict[str, str] = {}
    for m in import_map.get("maps") or []:
        if not isinstance(m, dict):
            continue
        col = str(m.get("column") or "").strip()
        cid = str(m.get("catalog_id") or "").strip()
        if col and cid and cid not in ("catalog_id", "amount", "_id_field", "_amount_field"):
            col_to_id[col] = cid

    items = catalog.setdefault("items", [])
    by_id = {str(it.get("id")): it for it in items if isinstance(it, dict) and it.get("id")}
    updated = 0
    errors: list[str] = []

    for row in rows:
        cid = (row.get("catalog_id") or row.get("id") or "").strip()
        amount_raw = row.get("amount")
        if not cid:
            for col, val in row.items():
                mapped = col_to_id.get(col)
                if mapped and val:
                    cid = mapped
                    amount_raw = val
                    break
        if not cid:
            errors.append("missing_catalog_id")
            continue
        if amount_raw is None or amount_raw == "":
            for col in ("amount", "kwota", "cena"):
                if row.get(col):
                    amount_raw = row.get(col)
                    break
        try:
            amount = float(str(amount_raw).replace(",", ".").replace(" ", ""))
        except (TypeError, ValueError):
            errors.append(f"bad_amount:{cid}")
            continue
        item = by_id.get(cid)
        if not item:
            errors.append(f"unknown_id:{cid}")
            continue
        item["amount"] = amount
        item["source"] = row.get("source") or "import"
        if row.get("vendor"):
            item["vendor"] = row.get("vendor")
        if row.get("notes"):
            item["notes"] = row.get("notes")
        updated += 1

    catalog["imported_at"] = utc_now()
    return updated, errors


def _import_invoices_csv(rows: list[dict[str, str]]) -> tuple[int, list[str]]:
    required = (
        "id",
        "client",
        "project",
        "amount",
        "currency",
        "issue_date",
        "due_date",
        "status",
        "type",
    )
    store = _load_json(INVOICES_FILE, {"invoices": []})
    invoices = store.setdefault("invoices", [])
    by_id = {str(inv.get("id")): inv for inv in invoices if isinstance(inv, dict)}
    imported = 0
    errors: list[str] = []

    for row in rows:
        missing = [k for k in required if not row.get(k)]
        if missing:
            errors.append("missing:" + ",".join(missing))
            continue
        inv_id = row["id"]
        try:
            amount = float(str(row["amount"]).replace(",", ".").replace(" ", ""))
        except ValueError:
            errors.append(f"bad_amount:{inv_id}")
            continue
        entry = {
            "id": inv_id,
            "client": row["client"],
            "project": row["project"],
            "amount": amount,
            "currency": row.get("currency") or "PLN",
            "issue_date": row["issue_date"],
            "due_date": row["due_date"],
            "status": row["status"],
            "type": row["type"],
        }
        by_id[inv_id] = entry
        imported += 1

    store["invoices"] = list(by_id.values())
    store["updated_at"] = utc_now()
    _save_json(INVOICES_FILE, store)
    if invoice_erp_mod is not None:
        try:
            invoice_erp_mod.mark_import(
                WEB_ROOT,
                imported=imported,
                load_json=_load_json,
                save_json=_save_json,
                error=("errors:" + str(len(errors))) if errors and imported == 0 else None,
            )
        except Exception:
            pass
    return imported, errors


def _run_build_project_costs() -> dict:
    if not BUILD_PROJECT_COSTS.is_file():
        return {"ok": False, "error": "build_script_missing"}
    try:
        _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        rc = subprocess.call(
            [sys.executable, str(BUILD_PROJECT_COSTS)],
            creationflags=_no_win,
        )
        costs = _load_json(PROJECT_COSTS_FILE, {})
        return {
            "ok": rc == 0,
            "rc": rc,
            "project_count": costs.get("project_count"),
            "sum_open_projects": costs.get("sum_open_projects"),
        }
    except OSError as exc:
        return {"ok": False, "error": str(exc)}


def _sync_asana_tasks() -> dict:
    token = oauth_integrations.get_access_token("asana") if oauth_integrations else None
    source = "file"
    tasks_payload = _load_json(
        ASANA_TASKS_FILE,
        {"source": "asana-export", "total": 0, "open": 0, "tasks": []},
    )

    if token:
        try:
            import urllib.request

            req = urllib.request.Request(
                "https://app.asana.com/api/1.0/users/me/tasks"
                "?opt_fields=name,assignee.name,due_on,completed,memberships.project.name,parent.name",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=45) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            raw_tasks = body.get("data") or []
            norm_tasks = []
            open_n = 0
            for t in raw_tasks:
                if not isinstance(t, dict):
                    continue
                completed = bool(t.get("completed"))
                if not completed:
                    open_n += 1
                memberships = t.get("memberships") or []
                project = ""
                if memberships and isinstance(memberships[0], dict):
                    proj = memberships[0].get("project") or {}
                    project = proj.get("name") or ""
                parent = t.get("parent") or {}
                norm_tasks.append(
                    {
                        "id": str(t.get("gid") or t.get("id") or ""),
                        "name": t.get("name") or "",
                        "section": "",
                        "assignee": ((t.get("assignee") or {}).get("name") or ""),
                        "due": t.get("due_on") or "",
                        "project": project,
                        "parent": parent.get("name") or "",
                        "status": "done" if completed else "open",
                        "product_index": None,
                    }
                )
            tasks_payload = {
                "source": "asana-api",
                "total": len(norm_tasks),
                "open": open_n,
                "tasks": norm_tasks,
            }
            source = "oauth"
        except Exception as exc:  # noqa: BLE001
            source = "oauth_stub"
            tasks_payload["meta"] = {
                "sync_error": str(exc)[:300],
                "synced_at": utc_now(),
                "source": source,
            }
    else:
        return {"ok": False, "error": "asana_not_connected"}

    tasks_payload["meta"] = {
        "synced_at": utc_now(),
        "source": source,
    }
    tasks_payload["synced_at"] = utc_now()
    _save_json(ASANA_TASKS_FILE, tasks_payload)
    build = _run_build_project_costs()
    return {
        "ok": True,
        "source": source,
        "task_count": len(tasks_payload.get("tasks") or []),
        "open_count": tasks_payload.get("open") or 0,
        "build": build,
    }


def _patch_branding_metadata(asset_id: str, field: str, value) -> tuple[bool, str | None]:
    """Reczna edycja asset_role / appearance (branding) — overrides + indeks lokalny."""
    aid = str(asset_id or "").strip()
    fld = str(field or "").strip()
    if not aid or fld not in ("asset_role", "appearance_primary"):
        return False, "invalid_request"
    idx = _load_json(BRANDING_INDEX_FILE, None)
    if not isinstance(idx, dict):
        return False, "branding_index_missing"
    assets = idx.get("assets") or []
    found = None
    for a in assets:
        if a.get("id") == aid:
            found = a
            break
    if not found:
        return False, "asset_not_found"
    if fld == "asset_role":
        found["asset_role"] = str(value or "").strip() or None
    elif fld == "appearance_primary":
        v = str(value or "").strip()
        tags = list(found.get("appearance_tags") or [])
        if v:
            if tags:
                tags[0] = v
            else:
                tags = [v]
            found["appearance_tags"] = tags
    ov = _load_json(BRANDING_OVERRIDES_FILE, {"version": 1, "assets": {}})
    if not isinstance(ov, dict):
        ov = {"version": 1, "assets": {}}
    patch = ov.setdefault("assets", {}).setdefault(aid, {})
    if fld == "appearance_primary":
        patch["appearance_tags"] = found.get("appearance_tags") or []
    else:
        patch["asset_role"] = found.get("asset_role")
    _save_json(BRANDING_OVERRIDES_FILE, ov)
    _save_json(BRANDING_INDEX_FILE, idx)
    return True, None


def _resolve_viz_thumb(product_id: str, file_index: dict) -> str:
    """Miniatura produktu z file-index (jak brand_folder_context.resolve_viz_thumb)."""
    products_by_id = {p.get("id"): p for p in (file_index.get("products") or []) if p.get("id")}
    p = products_by_id.get(product_id) or {}
    for rev in p.get("revisions") or []:
        for key in ("viz_path", "thumb_path", "path"):
            vp = rev.get(key) or ""
            if vp and re.search(r"\.(jpe?g|png|webp|gif|tif{1,2})$", vp, re.I):
                rel = vp.replace("\\", "/")
                if rel.lower().startswith("x:/"):
                    slug = product_id.replace("/", "-")
                    base = Path(rel).stem
                    return f"data/thumbs/{slug}__{base}_pl.jpg"
    slug = product_id.replace("/", "-")
    return f"data/thumbs/{slug}__000098_pl.jpg"


def _build_linked_product_meta(product_ids: list, file_index: dict) -> list:
    products_by_id = {p.get("id"): p for p in (file_index.get("products") or []) if p.get("id")}
    out = []
    seen_ids: set[str] = set()
    seen_labels: set[str] = set()
    for pid in product_ids or []:
        if not pid or pid in seen_ids:
            continue
        p = products_by_id.get(pid) or {}
        display = (p.get("display_name") or p.get("name") or pid).split("—")[0].strip()
        label_key = re.sub(r"\s+", " ", display.lower())
        if label_key in seen_labels:
            continue
        seen_ids.add(pid)
        seen_labels.add(label_key)
        idx_val = ""
        indexes = p.get("indexes") or []
        if indexes:
            idx_val = str(indexes[0])
        elif (p.get("revisions") or [{}])[0].get("index"):
            idx_val = str((p.get("revisions") or [{}])[0].get("index") or "")
        if idx_val and "." in idx_val:
            idx_val = idx_val.split(".")[0]
        out.append(
            {
                "id": pid,
                "display_name": display,
                "thumb_url": _resolve_viz_thumb(pid, file_index),
                "product_index": idx_val,
            }
        )
    return out


def _patch_branding_associations(
    asset_id: str,
    folder_group_id: str,
    linked_product_ids: list,
    linked_variant_ids: list | None,
    updated_by: str = "local_bridge",
    product_link_id: str = "",
    product_link_action: str = "",
) -> tuple[bool, str | None]:
    """Reczna edycja skojarzen produktow / wariantow w branding-index + overrides."""
    aid = str(asset_id or "").strip()
    group = str(folder_group_id or "").strip().lower()
    if not aid:
        return False, "asset_id_required"
    idx = _load_json(BRANDING_INDEX_FILE, None)
    if not isinstance(idx, dict):
        return False, "branding_index_missing"
    assets = idx.get("assets") or []
    target = None
    for a in assets:
        if a.get("id") == aid:
            target = a
            break
    if not target:
        return False, "asset_not_found"
    if not group:
        group = str(target.get("folder_group_id") or "").strip().lower()
    file_index = _load_json(INDEX_FILE, {"products": []})
    delta_pid = str(product_link_id or "").strip()
    delta_action = str(product_link_action or "").strip().lower()
    if delta_pid:
        if delta_action not in ("add", "remove"):
            return False, "invalid_product_link_action"
        existing_pids = list(target.get("linked_product_ids") or [])
        if not existing_pids:
            existing_pids = [
                item.get("id")
                for item in (target.get("linked_products") or [])
                if isinstance(item, dict) and item.get("id")
            ]
        pids = [str(x).strip() for x in existing_pids if str(x).strip()]
        if delta_action == "add" and delta_pid not in pids:
            pids.append(delta_pid)
        elif delta_action == "remove":
            pids = [pid for pid in pids if pid != delta_pid]
        vids = [
            str(x).strip()
            for x in (
                linked_variant_ids
                if linked_variant_ids is not None
                else target.get("linked_variant_ids") or []
            )
            if str(x).strip()
        ]
    else:
        pids = [str(x).strip() for x in (linked_product_ids or []) if str(x).strip()]
        vids = [str(x).strip() for x in (linked_variant_ids or []) if str(x).strip()]
    pids = list(dict.fromkeys(pids))
    vids = list(dict.fromkeys(vids))

    ov = _load_json(
        BRANDING_ASSOC_OVERRIDES_FILE,
        {"version": 1, "updated_at": "", "assets": {}, "folder_groups": {}},
    )
    if not isinstance(ov, dict):
        ov = {"version": 1, "updated_at": "", "assets": {}, "folder_groups": {}}
    ov.setdefault("assets", {})
    ov.setdefault("folder_groups", {})
    ov["assets"][aid] = {
        "linked_product_ids": pids,
        "linked_variant_ids": vids,
        "folder_group_id": group,
        "updated_by": updated_by,
    }
    if group:
        ov["folder_groups"][group] = {
            "linked_product_ids": pids,
            "linked_variant_ids": vids,
            "updated_by": updated_by,
        }
    ov["updated_at"] = utc_now()
    _save_json(BRANDING_ASSOC_OVERRIDES_FILE, ov)

    linked_meta = _build_linked_product_meta(pids, file_index)
    assets_by_id = {a.get("id"): a for a in assets if a.get("id")}

    def apply_to_asset(a: dict) -> None:
        a["linked_product_ids"] = list(pids)
        a["folder_linked_product_ids"] = list(pids)
        a["linked_products"] = list(linked_meta)
        if vids:
            a["linked_variant_ids"] = list(vids)
            variants = []
            for vid in vids:
                va = assets_by_id.get(vid)
                if not va:
                    continue
                variants.append(
                    {
                        "id": vid,
                        "name": va.get("name") or vid,
                        "path": va.get("path") or "",
                        "label": va.get("name") or "Plik",
                        "media_type": va.get("media_type") or "",
                    }
                )
            if variants:
                a["folder_variants"] = variants

    apply_to_asset(target)
    if group:
        for a in assets:
            ag = str(a.get("folder_group_id") or "").strip().lower()
            if ag == group:
                apply_to_asset(a)

    _save_json(BRANDING_INDEX_FILE, idx)
    return True, None


def _copy_media_file(src: str, dest_dir: str) -> tuple[bool, str | None, str | None]:
    """Kopiuj plik wizualizacji do folderu produktu."""
    import shutil

    src_p = Path(str(src or "").replace("/", "\\"))
    dest_root = Path(str(dest_dir or "").replace("/", "\\"))
    if not src_p.is_file():
        return False, "source_missing", None
    if not dest_root.is_dir():
        return False, "dest_dir_missing", None
    try:
        dest = dest_root / src_p.name
        if dest.resolve() != src_p.resolve():
            shutil.copy2(src_p, dest)
        return True, None, str(dest)
    except OSError as exc:
        return False, str(exc), None


def _pull_kv_cache_from_postgres() -> int:
    """Pobierz wszystkie Tier-2 stores z PG i nadpisz lokalne pliki cache. Zwraca liczbe."""
    if not _pg_available():
        return 0
    try:
        import pg_db
    except Exception:
        return 0
    n = 0
    try:
        keys = pg_db.kv_all_keys()
    except Exception as exc:
        print("kv_cache pull error (list):", exc)
        return 0
    for store_key in keys:
        if store_key not in KV_STORE_KEYS:
            continue
        try:
            payload = pg_db.kv_get(store_key, None)
            if payload is None:
                continue
            # Nie cofaj lokalnego seedu do starszej wersji z PG
            if store_key in ("naming-dictionary", "program-instructions") and isinstance(
                payload, dict
            ):
                local_path = WEB_ROOT / "data" / f"{store_key}.json"
                local = _load_json(local_path, {})
                local_ver = int((local or {}).get("version") or 0)
                remote_ver = int(payload.get("version") or 0)
                if local_ver > remote_ver:
                    continue
                # program-instructions: wiecej instrukcji lokalnie = nowszy seed
                if store_key == "program-instructions":
                    local_n = len((local or {}).get("instructions") or [])
                    remote_n = len(payload.get("instructions") or [])
                    if local_n > remote_n and local_ver >= remote_ver:
                        continue
            path = WEB_ROOT / "data" / f"{store_key}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            n += 1
        except Exception as exc:
            print(f"kv_cache pull error ({store_key}):", exc)
    if n:
        reload_naming_policy_from_disk()
    return n


def _seed_naming_policy_to_postgres() -> None:
    """Wypchnij naming-dictionary + app-settings + program-instructions do dam_kv_store."""
    naming: dict = {}
    if NAMING_DICTIONARY_FILE.is_file():
        try:
            naming = json.loads(NAMING_DICTIONARY_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            naming = {}
    policy = naming.get("policy") or {}

    instructions: dict = {}
    if PROGRAM_INSTRUCTIONS_FILE.is_file():
        try:
            instructions = json.loads(PROGRAM_INSTRUCTIONS_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            instructions = {}

    instr_list = instructions.get("instructions") if isinstance(instructions, dict) else []
    critical_ids = [
        i.get("id")
        for i in (instr_list or [])
        if isinstance(i, dict) and i.get("priority") == "critical" and i.get("id")
    ]

    app_settings = {
        "version": 2,
        "naming": {
            "source_kv": "naming-dictionary",
            "carrier_display_in_ui": policy.get("carrier_display_in_ui") or "label_pl",
            "carrier_prefix_on_disk": policy.get("carrier_prefix_on_disk") or "short",
            "description_pl": policy.get("description_pl") or "",
            "dictionary_version": naming.get("version"),
        },
        "instructions": {
            "source_kv": "program-instructions",
            "version": instructions.get("version") if instructions else 0,
            "count": len(instr_list or []),
            "critical_ids": critical_ids,
            "settings_anchor": "settings.html#damProgramInstructions",
        },
        "updated_at": policy.get("updated_at")
        or (instructions.get("updated_at") if instructions else "")
        or "",
    }
    _save_json(APP_SETTINGS_FILE, app_settings)
    if naming:
        _save_json(NAMING_DICTIONARY_FILE, naming)
    if instructions:
        _save_json(PROGRAM_INSTRUCTIONS_FILE, instructions)
    # Historia operacji / statusow / slownik EN->PL - tez do KV
    name_pl_file = WEB_ROOT / "data" / "product-name-pl.json"
    people_file = WEB_ROOT / "data" / "product-people.json"
    for path in (
        CHANGE_LOG_FILE,
        LIFECYCLE_STORE_FILE,
        PRODUCT_STATUS_FILE,
        name_pl_file,
        people_file,
    ):
        if path.is_file():
            try:
                _save_json(path, _load_json(path, {}))
            except Exception as exc:  # noqa: BLE001
                print(f"kv seed skip {path.name}:", exc)
    reload_naming_policy_from_disk()
    print(
        "program policy seeded:",
        f"ui={app_settings['naming']['carrier_display_in_ui']}",
        f"disk={app_settings['naming']['carrier_prefix_on_disk']}",
        f"instructions={app_settings['instructions']['count']}",
        f"critical={len(critical_ids)}",
        f"DOY->{CARRIER_FOLDER_PREFIX.get('DOY')}",
    )


def load_tag_proposals() -> dict:
    return _load_json(TAG_PROPOSALS_FILE, {"proposals": []})


def save_tag_proposals(data: dict) -> None:
    _save_json(TAG_PROPOSALS_FILE, data)


def append_assignment_log(revision_path: str, carrier_code: str, actor: str) -> None:
    log = _load_json(ASSIGNMENT_LOG_FILE, {"entries": []})
    log["entries"].append({
        "ts": utc_now(),
        "revision_path": revision_path,
        "carrier_code": carrier_code,
        "actor": actor,
    })
    _save_json(ASSIGNMENT_LOG_FILE, log)


def get_last_assignment(revision_path: str) -> dict | None:
    """Ostatnie zatwierdzone przypisanie typu dla sciezki (lub poprzedniej nazwy folderu)."""
    log = _load_json(ASSIGNMENT_LOG_FILE, {"entries": []})
    needle = normalize_path(revision_path).lower()
    parent = str(Path(normalize_path(revision_path)).parent).lower()
    last = None
    for e in log.get("entries") or []:
        rp = normalize_path(e.get("revision_path") or "").lower()
        if rp == needle or (rp.startswith(parent + "\\") or rp.startswith(parent + "/")):
            # Match exact path or same product folder (folder rename changes leaf)
            if rp == needle or Path(rp).parent.as_posix().lower() == Path(needle).parent.as_posix().lower():
                last = e
    return last


def append_change_log(entry: dict) -> dict:
    """Fala E: chronologiczny change-log (rename folder/plikow) z before/after."""
    data = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    data.setdefault("entries", [])
    data.setdefault("redo", [])
    row = {
        "id": f"chg_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "ts": utc_now(),
        **entry,
    }
    data["entries"].append(row)
    # Nowa akcja kasuje galaz redo
    data["redo"] = []
    _save_json(CHANGE_LOG_FILE, data)
    return row


def load_change_log(limit: int = 50) -> dict:
    data = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    entries = list(data.get("entries") or [])
    redo = list(data.get("redo") or [])
    return {
        "ok": True,
        "entries": entries[-max(1, min(limit, 200)) :],
        "redo": redo[-max(1, min(limit, 50)) :],
        "can_undo": bool(entries),
        "can_redo": bool(redo),
    }


def _extract_index_from_folder(folder_name: str) -> str:
    m = _FILE_INDEX_RE.search(folder_name or "")
    if not m:
        return ""
    base = m.group(1)
    rev = m.group(2) or "00"
    return f"{base}.{rev}"


def build_carrier_filename(name: str, carrier_code: str, index: str) -> str | None:
    """GC_balls_cocoa-lime_2024_07_05_GB_AR.ai
    -> GC-DOY-balls_cocoa-lime - GB_AR - 6300489.00.ai
    (Fala D: wstaw kod nosnika, usun date, doklej indeks)."""
    if "." not in name:
        return None
    stem, ext = name.rsplit(".", 1)
    bm = _FILE_BRAND_RE.match(stem)
    if not bm:
        return None
    brand = bm.group(1).upper()
    rest = stem[bm.end() :]

    rest_u = rest.upper()
    for tok in _FILE_CARRIER_TOKENS:
        if rest_u.startswith(tok + "_") or rest_u.startswith(tok + "-"):
            rest = rest[len(tok) + 1 :]
            break

    rest = _FILE_DATE_RE.sub("", rest)

    role = ""
    rm = _FILE_ROLE_RE.search(rest)
    if rm:
        role = rm.group(1)
        rest = rest[: rm.start()]

    file_index = (index or "").strip()
    im = _FILE_INDEX_RE.search(rest)
    if im:
        if not file_index:
            file_index = f"{im.group(1)}.{im.group(2) or '00'}"
        # Usun indeks z srodka/konca (z poprzedzajacym separatorem jesli jest)
        start = im.start()
        if start > 0 and rest[start - 1] in "_-":
            start -= 1
        rest = rest[:start] + rest[im.end() :]

    lang = ""
    lm = _FILE_LANG_RE.search(rest)
    if lm:
        lang = lm.group(1).replace("-", "_")
        rest = rest[: lm.start()]

    product = rest.strip("_- ")
    product = re.sub(r"[_-]{2,}", "_", product)
    if not product:
        product = "produkt"

    code = (carrier_code or "").strip().upper()
    if code in ("NONE", "BRAK", "BRAK_TYPU", "__NONE__", ""):
        mid = f"{brand}-{product}"
    else:
        mid = f"{brand}-{code}-{product}"

    parts = [mid]
    if lang:
        parts.append(lang)
    if file_index:
        if "." not in file_index:
            file_index = f"{file_index}.00"
        idx_bit = file_index + (f"_{role}" if role else "")
        parts.append(idx_bit)
    elif role:
        parts.append(role)

    return " - ".join(parts) + "." + ext


def _iter_revision_files(revision_dir: Path):
    """Pliki w slotach PROJEKT/DRUK/WIZKI (1 poziom + pliki w root rewizji)."""
    if not revision_dir.is_dir():
        return
    try:
        children = list(revision_dir.iterdir())
    except OSError:
        return
    for child in children:
        if child.is_file():
            yield child
            continue
        if not child.is_dir():
            continue
        name_u = child.name.upper()
        if not any(h in name_u for h in _REVISION_FILE_SLOT_HINTS):
            continue
        try:
            for f in child.iterdir():
                if f.is_file():
                    yield f
        except OSError:
            continue


def rename_revision_files_on_disk(
    revision_path: str,
    new_code: str,
    *,
    dry_run: bool = False,
) -> dict:
    """Fala D: rename AI/PDF/PNG w drzewie rewizji wg reguly brand-carrier-product - lang - index."""
    p = Path(normalize_path(revision_path))
    if not p.is_dir():
        return {"ok": False, "error": "revision_not_found", "renames": []}
    index = _extract_index_from_folder(p.name)
    planned: list[dict] = []
    for f in _iter_revision_files(p):
        new_name = build_carrier_filename(f.name, new_code, index)
        if not new_name or new_name == f.name:
            continue
        dest = f.parent / new_name
        planned.append({
            "old_path": str(f),
            "new_path": str(dest),
            "old_name": f.name,
            "new_name": new_name,
        })

    if dry_run:
        return {"ok": True, "dry_run": True, "renames": planned, "count": len(planned)}

    done = []
    errors = []
    for item in planned:
        src = Path(item["old_path"])
        dest = Path(item["new_path"])
        if dest.exists() and dest != src:
            errors.append({"path": str(src), "error": "target_exists", "target": str(dest)})
            continue
        try:
            src.rename(dest)
            done.append(item)
        except OSError as exc:
            errors.append({"path": str(src), "error": str(exc)})
    return {
        "ok": len(errors) == 0,
        "dry_run": False,
        "renames": done,
        "errors": errors,
        "count": len(done),
    }


def _apply_path_renames_forward(path_renames: list) -> list:
    """Ponow: old_path -> new_path (kolejnosc jak przy apply)."""
    reverses = []
    for pr in path_renames or []:
        src = Path(normalize_path(pr.get("old_path") or ""))
        dest = Path(normalize_path(pr.get("new_path") or ""))
        if not src.exists():
            reverses.append({"ok": False, "error": "missing", "from": str(src), "to": str(dest)})
            continue
        if dest.exists():
            reverses.append({"ok": False, "error": "target_exists", "from": str(src), "to": str(dest)})
            continue
        try:
            src.rename(dest)
            reverses.append({"ok": True, "from": str(src), "to": str(dest)})
        except OSError as exc:
            reverses.append({"ok": False, "error": str(exc), "from": str(src), "to": str(dest)})
    return reverses


def _apply_path_renames_reverse(path_renames: list) -> list:
    """Cofnij: new_path -> old_path (odwrotna kolejnosc)."""
    reverses = []
    for pr in reversed(path_renames or []):
        src = Path(normalize_path(pr.get("new_path") or ""))
        dest = Path(normalize_path(pr.get("old_path") or ""))
        if not src.exists():
            reverses.append({"ok": False, "error": "missing", "from": str(src), "to": str(dest)})
            continue
        if dest.exists():
            reverses.append({"ok": False, "error": "target_exists", "from": str(src), "to": str(dest)})
            continue
        try:
            src.rename(dest)
            reverses.append({"ok": True, "from": str(src), "to": str(dest)})
        except OSError as exc:
            reverses.append({"ok": False, "error": str(exc), "from": str(src), "to": str(dest)})
    return reverses


def undo_last_change(actor: str = "") -> dict:
    """Cofnij ostatni wpis change-log (rename folder + pliki) na dysku."""
    data = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    entries = data.get("entries") or []
    if not entries:
        return {"ok": False, "error": "nothing_to_undo"}
    entry = entries.pop()
    data["redo"] = data.get("redo") or []
    data["redo"].append(entry)

    reverses = []
    action = str(entry.get("action") or "")
    path_renames = entry.get("path_renames") or []

    if action == "rename_index" or path_renames:
        reverses = _apply_path_renames_reverse(path_renames)
    else:
        # Najpierw pliki (new->old), potem folder
        for fr in reversed(entry.get("file_renames") or []):
            src = Path(normalize_path(fr.get("new_path") or ""))
            dest = Path(normalize_path(fr.get("old_path") or ""))
            if src.is_file() and not dest.exists():
                try:
                    src.rename(dest)
                    reverses.append({"ok": True, "from": str(src), "to": str(dest)})
                except OSError as exc:
                    reverses.append({"ok": False, "error": str(exc), "from": str(src)})
            else:
                reverses.append({"ok": False, "error": "missing_or_exists", "from": str(src), "to": str(dest)})

        folder = entry.get("folder_rename") or {}
        if folder.get("new_path") and folder.get("old_path"):
            src = Path(normalize_path(folder["new_path"]))
            dest = Path(normalize_path(folder["old_path"]))
            if src.is_dir() and not dest.exists():
                try:
                    src.rename(dest)
                    reverses.append({"ok": True, "from": str(src), "to": str(dest), "kind": "folder"})
                except OSError as exc:
                    reverses.append({"ok": False, "error": str(exc), "kind": "folder"})

    folder = entry.get("folder_rename") or {}
    _save_json(CHANGE_LOG_FILE, data)
    undo_path = (
        folder.get("old_path")
        or entry.get("folder")
        or (path_renames[0].get("old_path") if path_renames else "")
        or ""
    )
    append_audit({
        "action": "change_log_undo",
        "path": undo_path,
        "detail": entry.get("id") or "",
        "user": actor or "system",
    })
    return {"ok": True, "undone": entry, "reverses": reverses}


def redo_last_change(actor: str = "") -> dict:
    """Ponow ostatnio cofniety wpis change-log."""
    data = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    redo = data.get("redo") or []
    if not redo:
        return {"ok": False, "error": "nothing_to_redo"}
    entry = redo.pop()
    reverses = []
    action = str(entry.get("action") or "")
    path_renames = entry.get("path_renames") or []

    if action == "rename_index" or path_renames:
        reverses = _apply_path_renames_forward(path_renames)
    else:
        folder = entry.get("folder_rename") or {}
        if folder.get("old_path") and folder.get("new_path"):
            src = Path(normalize_path(folder["old_path"]))
            dest = Path(normalize_path(folder["new_path"]))
            if src.is_dir() and not dest.exists():
                try:
                    src.rename(dest)
                    reverses.append({"ok": True, "from": str(src), "to": str(dest), "kind": "folder"})
                except OSError as exc:
                    reverses.append({"ok": False, "error": str(exc), "kind": "folder"})
        base = Path(normalize_path(folder.get("new_path") or folder.get("old_path") or ""))
        for fr in entry.get("file_renames") or []:
            old_name = fr.get("old_name") or Path(fr.get("old_path") or "").name
            new_name = fr.get("new_name") or Path(fr.get("new_path") or "").name
            found = None
            if base.is_dir():
                for f in _iter_revision_files(base):
                    if f.name == old_name:
                        found = f
                        break
            if found:
                dest = found.parent / new_name
                try:
                    if not dest.exists():
                        found.rename(dest)
                        reverses.append({"ok": True, "from": str(found), "to": str(dest)})
                except OSError as exc:
                    reverses.append({"ok": False, "error": str(exc)})

    folder = entry.get("folder_rename") or {}
    data.setdefault("entries", []).append(entry)
    data["redo"] = redo
    _save_json(CHANGE_LOG_FILE, data)
    redo_path = folder.get("new_path") or entry.get("folder") or ""
    append_audit({
        "action": "change_log_redo",
        "path": redo_path,
        "detail": entry.get("id") or "",
        "user": actor or "system",
    })
    return {"ok": True, "redone": entry, "reverses": reverses}


def _match_carrier_prefix(name):
    """Zwraca (matched_head, rest_with_separator). rest zaczyna sie od ' - ' gdy bylo."""
    head = name.split(" - ")[0].strip()
    rest = name[len(head):]
    head_upper = head.upper()
    for code in sorted(KNOWN_CARRIER_PREFIXES, key=lambda s: -len(s)):
        cu = code.upper()
        if head_upper == cu or head_upper.startswith(cu + " "):
            return head, rest
    return None, name


def rename_revision_prefix_on_disk(
    revision_path: str,
    new_code: str,
    *,
    rename_files: bool = True,
    dry_run_files: bool = False,
) -> dict:
    """Zamienia prefiks folderu rewizji na dysku (2026-07-18, P6/P7) + opcjonalnie
    pliki AI/PDF/wizki (Fala D). Folder: jezyki/gramatura/data bez zmian."""
    p = Path(normalize_path(revision_path))
    if not p.is_dir():
        return {"ok": False, "error": "revision_not_found", "path": str(p)}
    parent = p.parent
    name = p.name
    matched_known, rest = _match_carrier_prefix(name)
    new_code_clean = (new_code or "").strip().upper()
    if not new_code_clean:
        return {"ok": False, "error": "new_code_required"}

    if new_code_clean in ("NONE", "BRAK", "BRAK_TYPU", "__NONE__"):
        if matched_known is None:
            return {
                "ok": True,
                "old_path": str(p),
                "new_path": str(p),
                "old_name": name,
                "new_name": name,
                "noop": True,
                "file_renames": [],
            }
        new_name = rest.lstrip(" -").strip() if rest else ""
        if not new_name:
            return {"ok": False, "error": "cannot_strip_to_empty_name"}
    else:
        folder_prefix = CARRIER_FOLDER_PREFIX.get(new_code_clean, new_code_clean)
        if matched_known is not None:
            tail = rest if rest.startswith(" - ") else ((" - " + rest.lstrip(" -")) if rest else "")
            new_name = folder_prefix + tail
        else:
            sep = "" if name.startswith(" - ") else " - "
            new_name = folder_prefix + sep + name

    dest = parent / new_name
    if dest.exists() and dest != p:
        return {"ok": False, "error": "target_exists", "target": str(dest)}
    try:
        p.rename(dest)
    except OSError as exc:
        return {"ok": False, "error": str(exc)}

    file_result = {"renames": [], "count": 0}
    if rename_files:
        file_result = rename_revision_files_on_disk(
            str(dest), new_code_clean, dry_run=dry_run_files
        )

    return {
        "ok": True,
        "old_path": str(p),
        "new_path": str(dest),
        "old_name": name,
        "new_name": new_name,
        "file_renames": file_result.get("renames") or [],
        "file_rename_count": file_result.get("count") or 0,
        "file_rename_errors": file_result.get("errors") or [],
        "carrier_guessed": False,
    }


def create_or_apply_tag_proposal(
    payload: dict,
    *,
    session_role: str = "user",
    session_email: str = "",
    admin_mode: bool = False,
) -> dict:
    """Propose -> admin apply (ADR-009 / memory §86).

    Kazdy zalogowany pisze TYLKO do kolejki JSON (tag-proposals + inbox).
    Natychmiastowy zapis na dysk / kanoniczna baza: sesja role=admin
    (HARD 2026-07-21: bez wymogu admin_mode UI). Body.role / body.admin_mode
    SA IGNOROWANE (anti-spoof) - privilege bierze sie z sesji Bearer.
    """
    revision_path = (payload.get("revision_path") or "").strip()
    new_code = (payload.get("new_carrier_code") or "").strip().upper()
    role = (session_role or "user").strip().lower()
    submitted_by = (
        session_email
        or (payload.get("user_email") or payload.get("user_name") or "anonim")
    ).strip()
    current_value = (payload.get("current_carrier_code") or "").strip().upper()

    if not revision_path:
        return {"ok": False, "error": "revision_path_and_new_carrier_code_required"}
    if not new_code:
        return {"ok": False, "error": "revision_path_and_new_carrier_code_required"}
    # NONE = jawne "BRAK TYPU" (dozwolone)

    # HARD: admin session = instant apply (admin_mode optional UX only)
    can_apply_immediately = role == "admin"
    _ = admin_mode  # kept for API compat / callers
    if can_apply_immediately:
        rename_files = bool(payload.get("rename_files", True))
        result = rename_revision_prefix_on_disk(
            revision_path, new_code, rename_files=rename_files
        )
        if result.get("ok"):
            append_audit({
                "action": "rename_revision_prefix",
                "path": result["new_path"],
                "detail": f"{current_value or '?'} -> {new_code}"
                + (f" (+{result.get('file_rename_count', 0)} plikow)" if rename_files else ""),
                "user": submitted_by,
            })
            append_assignment_log(result["new_path"], new_code, submitted_by)
        append_change_log({
            "action": "rename_carrier",
            "category": "carrier",
                "actor": submitted_by,
                "carrier_from": current_value,
                "carrier_to": new_code,
                "folder_rename": {
                    "old_path": result.get("old_path"),
                    "new_path": result.get("new_path"),
                    "old_name": result.get("old_name"),
                    "new_name": result.get("new_name"),
                },
                "file_renames": result.get("file_renames") or [],
                "product_id": payload.get("product_id") or "",
                "product_name": payload.get("product_name") or "",
            })
        return {"ok": result.get("ok", False), "applied": True, "immediate": True, **result}

    data = load_tag_proposals()
    proposals = data.setdefault("proposals", [])
    now = datetime.now(timezone.utc)
    expires = now.timestamp() + PROPOSAL_TTL_HOURS * 3600
    proposal_id = f"prop_{int(now.timestamp() * 1000)}"
    entry = {
        "id": proposal_id,
        "field": "carrier",
        "revision_path": revision_path,
        "product_id": payload.get("product_id") or "",
        "product_name": payload.get("product_name") or "",
        "current_value": current_value,
        "proposed_value": new_code,
        "status": "pending",
        "submitted_by": submitted_by,
        "submitted_at": now.isoformat(timespec="seconds"),
        "expires_at": datetime.fromtimestamp(expires, tz=timezone.utc).isoformat(timespec="seconds"),
        "decided_by": None,
        "decided_at": None,
    }
    proposals.append(entry)
    save_tag_proposals(data)
    append_audit({
        "action": "tag_proposal_submitted",
        "path": revision_path,
        "detail": f"{current_value or '?'} -> {new_code} (pending)",
        "user": submitted_by,
    })
    # Tymczasowa kolejka <-> inbox: admin widzi zapotrzebowanie od razu
    append_inbox_item({
        "type": "tag_proposal",
        "title": f"Propozycja typu: {current_value or '?'} -> {new_code}",
        "detail": (
            f"{entry.get('product_name') or revision_path}\n"
            f"Zglosil: {submitted_by}\n"
            f"Sciezka: {revision_path}\n"
            f"proposal_id: {proposal_id}"
        ),
        "tags": ["moderacja", "tag", "propozycja"],
        "requested_by": submitted_by,
        "product_id": entry.get("product_id") or "",
        "path": revision_path,
        "proposal_id": proposal_id,
        "read": False,
    })
    return {"ok": True, "applied": False, "immediate": False, "proposal": entry}


def escalate_expired_proposals() -> int:
    """Po TTL NIE zapisujemy na dysk automatycznie (tylko admin apply).
    Eskalacja: flaga + wpis inbox dla admina."""
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    now = datetime.now(timezone.utc)
    changed = 0
    for entry in proposals:
        if entry.get("status") != "pending":
            continue
        if entry.get("escalated_at"):
            continue
        try:
            expires_at = datetime.fromisoformat(entry["expires_at"])
        except (KeyError, ValueError):
            continue
        if now < expires_at:
            continue
        entry["escalated_at"] = now.isoformat(timespec="seconds")
        append_inbox_item({
            "type": "tag_proposal_expired",
            "title": f"Propozycja wygasla - decyzja admina: {entry.get('proposed_value')}",
            "detail": (
                f"{entry.get('product_name') or entry.get('revision_path')}\n"
                f"Zglosil: {entry.get('submitted_by')}\n"
                f"proposal_id: {entry.get('id')}\n"
                "System NIE zastosowal zmiany automatycznie - zatwierdz w Ustawieniach."
            ),
            "tags": ["moderacja", "tag", "wygaslo"],
            "requested_by": entry.get("submitted_by") or "system",
            "product_id": entry.get("product_id") or "",
            "path": entry.get("revision_path") or "",
            "proposal_id": entry.get("id"),
            "read": False,
        })
        append_audit({
            "action": "tag_proposal_escalated",
            "path": entry.get("revision_path") or "",
            "detail": f"TTL minął, czeka na admina: {entry.get('id')}",
            "user": "system",
        })
        changed += 1
    if changed:
        save_tag_proposals(data)
    return changed


def auto_apply_expired_proposals() -> int:
    """Kompatybilnosc nazwy - teraz tylko eskalacja do inbox (bez auto-zapisu)."""
    return escalate_expired_proposals()


def decide_tag_proposal(payload: dict, *, decided_by: str = "") -> dict:
    proposal_id = (payload.get("proposal_id") or "").strip()
    decision = (payload.get("decision") or "").strip()  # approve | reject | pick_other
    decided_by = (decided_by or payload.get("decided_by") or "admin").strip()
    override_value = (payload.get("new_value") or "").strip().upper()

    if not proposal_id or decision not in ("approve", "reject", "pick_other"):
        return {"ok": False, "error": "proposal_id_and_valid_decision_required"}

    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    entry = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not entry:
        return {"ok": False, "error": "proposal_not_found"}
    if entry.get("status") != "pending":
        return {"ok": False, "error": "proposal_already_decided", "status": entry.get("status")}

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if decision == "reject":
        entry["status"] = "rejected"
        entry["decided_by"] = decided_by
        entry["decided_at"] = now
        save_tag_proposals(data)
        append_audit({"action": "tag_proposal_rejected", "path": entry["revision_path"], "user": decided_by})
        return {"ok": True, "proposal": entry}

    final_value = override_value if decision == "pick_other" and override_value else entry["proposed_value"]
    result = rename_revision_prefix_on_disk(entry["revision_path"], final_value)
    entry["status"] = "approved" if result.get("ok") else "approve_failed"
    entry["decided_by"] = decided_by
    entry["decided_at"] = now
    entry["final_value"] = final_value
    save_tag_proposals(data)
    if result.get("ok"):
        append_assignment_log(result["new_path"], final_value, decided_by)
        append_audit({
            "action": "tag_proposal_approved",
            "path": result["new_path"],
            "detail": f"{entry.get('current_value') or '?'} -> {final_value}",
            "user": decided_by,
        })
        append_change_log({
            "action": "rename_carrier_approved",
            "category": "carrier",
            "actor": decided_by,
            "proposal_id": proposal_id,
            "carrier_from": entry.get("current_value") or "",
            "carrier_to": final_value,
            "folder_rename": {
                "old_path": result.get("old_path"),
                "new_path": result.get("new_path"),
                "old_name": result.get("old_name"),
                "new_name": result.get("new_name"),
            },
            "file_renames": result.get("file_renames") or [],
            "product_id": entry.get("product_id") or "",
            "product_name": entry.get("product_name") or "",
        })
    return {"ok": result.get("ok", False), "proposal": entry, **{k: v for k, v in result.items() if k != "ok"}}


def reopen_tag_proposal(payload: dict, *, actor: str = "") -> dict:
    """Wroc decyzje do kolejki (pending) - bez zmian na dysku."""
    proposal_id = (payload.get("proposal_id") or "").strip()
    actor = (actor or payload.get("actor") or "admin").strip()
    if not proposal_id:
        return {"ok": False, "error": "proposal_id_required"}
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    entry = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not entry:
        return {"ok": False, "error": "proposal_not_found"}
    st = str(entry.get("status") or "")
    if st == "pending":
        return {"ok": True, "proposal": entry, "note": "already_pending"}
    if st not in ("rejected", "approved", "approve_failed", "undone", "awaiting_admin"):
        return {"ok": False, "error": "cannot_reopen_status", "status": st}
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    entry["status"] = "pending"
    entry["reopened_at"] = now
    entry["reopened_by"] = actor
    entry["reopen_from"] = st
    for key in ("decided_by", "decided_at", "final_value"):
        entry.pop(key, None)
    save_tag_proposals(data)
    append_audit({
        "action": "tag_proposal_reopened",
        "path": entry.get("revision_path") or "",
        "detail": proposal_id,
        "user": actor,
    })
    return {"ok": True, "proposal": entry}



def _short_actor(s: str) -> str:
    v = (s or "").strip()
    if "@" in v:
        return v.split("@", 1)[0]
    return v or "?"


def _folder_rename_summary(entry: dict) -> str:
    fr = entry.get("folder_rename") or {}
    old_n = Path(normalize_path(fr.get("old_path") or "")).name
    new_n = Path(normalize_path(fr.get("new_path") or "")).name
    if old_n and new_n and old_n != new_n:
        return f"{old_n} -> {new_n}"
    action = str(entry.get("action") or entry.get("category") or "zmiana")
    return action


def _path_probe(path: str) -> dict:
    pth = Path(normalize_path(path or ""))
    if not path:
        return {"path": "", "exists": False, "kind": "unknown"}
    if pth.exists():
        return {"path": str(pth), "exists": True, "kind": "dir" if pth.is_dir() else "file"}
    return {
        "path": str(pth),
        "exists": False,
        "kind": "missing",
        "hint": "Sciezka nie istnieje na dysku (usunieta albo przeniesiona poza DAM).",
    }


def build_change_timeline_for_proposal(proposal_id: str) -> dict:
    """Przebieg change-log + audit dla sciezki propozycji (konflikty / kolejne zmiany)."""
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    entry = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not entry:
        return {"ok": False, "error": "proposal_not_found"}

    rev = normalize_path(entry.get("revision_path") or "")
    rev_l = rev.lower()
    parent_l = Path(rev).parent.as_posix().lower() if rev else ""

    clog = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    entries = list(clog.get("entries") or [])
    redo = list(clog.get("redo") or [])

    own_idx = -1
    for i, e in enumerate(entries):
        if str(e.get("proposal_id") or "") == proposal_id:
            own_idx = i

    timeline = []
    for i, e in enumerate(entries):
        fr = e.get("folder_rename") or {}
        new_p = normalize_path(fr.get("new_path") or e.get("folder") or "")
        old_p = normalize_path(fr.get("old_path") or "")
        related = str(e.get("proposal_id") or "") == proposal_id
        if not related and rev_l:
            for cand in (new_p, old_p, e.get("folder") or ""):
                cl = normalize_path(cand).lower()
                if cl == rev_l or (parent_l and (cl.startswith(parent_l + "/") or cl.startswith(parent_l + "\\"))):
                    related = True
                    break
        if not related and own_idx >= 0 and i > own_idx:
            related = True
        if not related:
            continue
        probe = _path_probe(new_p or old_p or rev)
        timeline.append({
            "id": e.get("id") or "",
            "ts": e.get("ts") or "",
            "actor": _short_actor(e.get("actor") or e.get("user") or ""),
            "proposal_id": e.get("proposal_id") or "",
            "action": e.get("action") or e.get("category") or "",
            "summary": _folder_rename_summary(e),
            "is_this": str(e.get("proposal_id") or "") == proposal_id,
            "is_after": own_idx >= 0 and i > own_idx,
            "disk": probe,
        })

    audit_hits = []
    try:
        for row in read_audit(80):
            ap = normalize_path(row.get("path") or "").lower()
            if not ap or not rev_l:
                continue
            if ap != rev_l and not (parent_l and (ap.startswith(parent_l + "/") or ap.startswith(parent_l + "\\"))):
                continue
            act = str(row.get("action") or "")
            if (
                act in (
                    "change_log_undo",
                    "change_log_redo",
                    "tag_proposal_approved",
                    "tag_proposal_rejected",
                    "tag_proposal_reopened",
                    "tag_proposal_undone",
                    "tag_proposal_cancel_undo",
                )
                or "delete" in act
                or "remove" in act
                or "rename" in act
            ):
                audit_hits.append({
                    "ts": row.get("ts") or row.get("at") or "",
                    "actor": _short_actor(row.get("user") or row.get("actor") or ""),
                    "action": act,
                    "detail": row.get("detail") or "",
                    "path": row.get("path") or "",
                })
    except Exception:
        pass

    last = entries[-1] if entries else None
    can_undo_now = bool(last) and str(last.get("proposal_id") or "") == proposal_id
    current_disk = _path_probe(rev)
    return {
        "ok": True,
        "proposal_id": proposal_id,
        "can_undo_now": can_undo_now,
        "current_disk": current_disk,
        "timeline": timeline,
        "audit": audit_hits[:12],
        "redo_available": [
            {
                "id": r.get("id") or "",
                "ts": r.get("ts") or "",
                "proposal_id": r.get("proposal_id") or "",
                "summary": _folder_rename_summary(r),
                "actor": _short_actor(r.get("actor") or r.get("user") or ""),
            }
            for r in redo[-10:]
        ],
    }


def undo_tag_proposal(payload: dict, *, actor: str = "") -> dict:
    """Cofnij zatwierdzona zmiane typu na dysku (gdy to ostatni change-log).
    Po sukcesie: status=undone + undo_grace_until (+30s).
    Przy konflikcie: pelny przebieg change-log (timeline)."""
    proposal_id = (payload.get("proposal_id") or "").strip()
    actor = (actor or payload.get("actor") or "admin").strip()
    if not proposal_id:
        return {"ok": False, "error": "proposal_id_required"}
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    entry = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not entry:
        return {"ok": False, "error": "proposal_not_found"}
    st = str(entry.get("status") or "")
    if st == "rejected":
        return {
            "ok": False,
            "error": "rejected_no_disk_change",
            "hint": (
                "Ta decyzja to odrzucenie - na dysku nic nie zmieniono. "
                "Uzyj \"Wroc do kolejki\", jesli chcesz zdecydowac ponownie."
            ),
            "timeline": build_change_timeline_for_proposal(proposal_id).get("timeline") or [],
        }
    if st not in ("approved", "approve_failed"):
        return {"ok": False, "error": "nothing_to_undo_on_disk", "status": st}

    clog = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    entries = list(clog.get("entries") or [])
    if not entries:
        now = datetime.now(timezone.utc)
        grace = (now + timedelta(seconds=30)).isoformat(timespec="seconds")
        entry["status"] = "undone"
        entry["undone_at"] = now.isoformat(timespec="seconds")
        entry["undone_by"] = actor
        entry["undo_grace_until"] = grace
        entry["disk_undo"] = False
        entry["undo_hint"] = "Brak wpisu change-log - tylko status, bez cofniecia na dysku."
        save_tag_proposals(data)
        append_audit({
            "action": "tag_proposal_undone",
            "path": entry.get("revision_path") or "",
            "detail": proposal_id + "|no_changelog",
            "user": actor,
        })
        return {
            "ok": True,
            "proposal": entry,
            "disk_undo": False,
            "grace_seconds": 30,
            "undo_grace_until": grace,
            "hint": entry["undo_hint"],
            "timeline": build_change_timeline_for_proposal(proposal_id).get("timeline") or [],
        }

    last = entries[-1]
    if str(last.get("proposal_id") or "") != proposal_id:
        report = build_change_timeline_for_proposal(proposal_id)
        return {
            "ok": False,
            "error": "not_last_change",
            "hint": (
                "Po tej zmianie nastapily kolejne na dysku. "
                "Najpierw cofnij nowsze (Cofnij ostatnia / przebieg ponizej), "
                "albo ponow po cofnieciu. Program nie cofnie w srodek historii."
            ),
            "last_proposal_id": last.get("proposal_id") or "",
            "last_change_id": last.get("id") or "",
            "last_summary": _folder_rename_summary(last),
            "last_actor": _short_actor(last.get("actor") or last.get("user") or ""),
            "last_ts": last.get("ts") or "",
            "timeline": report.get("timeline") or [],
            "audit": report.get("audit") or [],
            "current_disk": report.get("current_disk") or {},
            "redo_available": report.get("redo_available") or [],
        }

    fr = last.get("folder_rename") or {}
    expected_new = normalize_path(fr.get("new_path") or "")
    probe = _path_probe(expected_new or entry.get("revision_path") or "")
    if expected_new and not probe.get("exists"):
        report = build_change_timeline_for_proposal(proposal_id)
        return {
            "ok": False,
            "error": "path_missing",
            "hint": (
                "Nie mozna cofnac rename: folder/plik z tej zmiany nie istnieje na dysku. "
                "Ktos mogl go usunac albo przeniesc poza logi DAM. "
                "Ponizej przebieg zmian i wskazowki z audytu."
            ),
            "current_disk": probe,
            "timeline": report.get("timeline") or [],
            "audit": report.get("audit") or [],
        }

    disk = undo_last_change(actor)
    if not disk.get("ok"):
        report = build_change_timeline_for_proposal(proposal_id)
        disk["timeline"] = report.get("timeline") or []
        disk["audit"] = report.get("audit") or []
        disk["current_disk"] = probe
        return disk

    reverses = disk.get("reverses") or []
    failed = [r for r in reverses if not r.get("ok")]
    if failed:
        report = build_change_timeline_for_proposal(proposal_id)
        return {
            "ok": False,
            "error": "partial_undo_failed",
            "hint": (
                "Cofniecie na dysku nie powiodlo sie w calosci "
                "(brak pliku, konflikt nazw albo reczna zmiana po drodze)."
            ),
            "reverses": reverses,
            "timeline": report.get("timeline") or [],
            "audit": report.get("audit") or [],
            "current_disk": probe,
        }

    now = datetime.now(timezone.utc)
    grace = (now + timedelta(seconds=30)).isoformat(timespec="seconds")
    entry["status"] = "undone"
    entry["undone_at"] = now.isoformat(timespec="seconds")
    entry["undone_by"] = actor
    entry["undo_grace_until"] = grace
    entry["undo_change_id"] = (disk.get("undone") or {}).get("id") or ""
    entry["disk_undo"] = True
    for key in ("decided_by", "decided_at", "final_value"):
        if key in entry and f"prev_{key}" not in entry:
            entry[f"prev_{key}"] = entry.get(key)
    save_tag_proposals(data)
    append_audit({
        "action": "tag_proposal_undone",
        "path": entry.get("revision_path") or "",
        "detail": proposal_id,
        "user": actor,
    })
    return {
        "ok": True,
        "proposal": entry,
        "disk_undo": True,
        "grace_seconds": 30,
        "undo_grace_until": grace,
        "undone": disk.get("undone"),
        "reverses": reverses,
        "hint": "Cofnieto na dysku. Masz 30 s na Anuluj cofniecie (Ponow).",
        "redo_available": build_change_timeline_for_proposal(proposal_id).get("redo_available") or [],
    }


def cancel_undo_tag_proposal(payload: dict, *, actor: str = "") -> dict:
    """W ciagu 30 s po cofnieciu: ponow zmiane na dysku i przywroc status approved."""
    proposal_id = (payload.get("proposal_id") or "").strip()
    actor = (actor or payload.get("actor") or "admin").strip()
    if not proposal_id:
        return {"ok": False, "error": "proposal_id_required"}
    data = load_tag_proposals()
    proposals = data.get("proposals") or []
    entry = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not entry:
        return {"ok": False, "error": "proposal_not_found"}
    if str(entry.get("status") or "") != "undone":
        return {"ok": False, "error": "not_in_undo_grace", "status": entry.get("status")}

    grace_raw = str(entry.get("undo_grace_until") or "")
    try:
        grace_dt = datetime.fromisoformat(grace_raw.replace("Z", "+00:00"))
        if grace_dt.tzinfo is None:
            grace_dt = grace_dt.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > grace_dt:
            return {
                "ok": False,
                "error": "grace_expired",
                "hint": "Minelo 30 s. Uzyj Ponow na pasku Historii (ostatnio wycofane), jesli nadal w redo.",
            }
    except ValueError:
        pass

    clog = _load_json(CHANGE_LOG_FILE, {"entries": [], "redo": []})
    redo = list(clog.get("redo") or [])
    want = str(entry.get("undo_change_id") or "")
    if entry.get("disk_undo") and redo:
        top = redo[-1]
        if want and str(top.get("id") or "") != want:
            return {
                "ok": False,
                "error": "redo_mismatch",
                "hint": "Na stosie redo jest inna zmiana. Sprawdz \"Ostatnio wycofane\" na pasku Historii.",
                "redo_top": top.get("id") or "",
            }
        redone = redo_last_change(actor)
        if not redone.get("ok"):
            return redone
    elif entry.get("disk_undo"):
        return {"ok": False, "error": "nothing_to_redo", "hint": "Brak wpisu na stosie redo."}

    entry["status"] = "approved"
    if entry.get("prev_decided_by"):
        entry["decided_by"] = entry.pop("prev_decided_by")
    if entry.get("prev_decided_at"):
        entry["decided_at"] = entry.pop("prev_decided_at")
    if "prev_final_value" in entry:
        entry["final_value"] = entry.pop("prev_final_value")
    for k in ("undone_at", "undone_by", "undo_grace_until", "undo_change_id", "disk_undo", "undo_hint"):
        entry.pop(k, None)
    entry["cancel_undo_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    entry["cancel_undo_by"] = actor
    save_tag_proposals(data)
    append_audit({
        "action": "tag_proposal_cancel_undo",
        "path": entry.get("revision_path") or "",
        "detail": proposal_id,
        "user": actor,
    })
    return {"ok": True, "proposal": entry, "hint": "Anulowano cofniecie - zmiana znow obowiazuje."}


def manage_carrier_type(payload: dict) -> dict:
    """Dodaj/usun wlasny typ (Faza 4, warstwa nad naming-dictionary.json).
    Usuniecie wymaga replacement (kod docelowy albo None=wyczysc) - historia
    przypisan w carrier-assignment-log.json pozwala pozniej zbiorczo naprawic."""
    action = (payload.get("action") or "").strip()
    code = (payload.get("code") or "").strip().upper()
    data = _load_json(CARRIER_TYPES_FILE, {"custom_types": {}, "deleted_types": {}})
    data.setdefault("custom_types", {})
    data.setdefault("deleted_types", {})

    if action == "add":
        label_pl = (payload.get("label_pl") or code).strip()
        if not code:
            return {"ok": False, "error": "code_required"}
        data["custom_types"][code] = {"label_pl": label_pl, "added_at": utc_now(), "added_by": payload.get("actor") or ""}
        data["deleted_types"].pop(code, None)
        _save_json(CARRIER_TYPES_FILE, data)
        append_audit({"action": "carrier_type_added", "detail": f"{code}: {label_pl}", "user": payload.get("actor") or ""})
        return {"ok": True, "custom_types": data["custom_types"]}

    if action == "delete":
        if not code:
            return {"ok": False, "error": "code_required"}
        replacement = (payload.get("replacement") or "").strip().upper() or None
        data["custom_types"].pop(code, None)
        data["deleted_types"][code] = {
            "replacement": replacement,
            "deleted_at": utc_now(),
            "deleted_by": payload.get("actor") or "",
        }
        _save_json(CARRIER_TYPES_FILE, data)
        # Zbiorcze przepisanie historycznych przypisan (jesli wskazano replacement)
        reassigned = 0
        if replacement:
            log = _load_json(ASSIGNMENT_LOG_FILE, {"entries": []})
            for e in log.get("entries") or []:
                if e.get("carrier_code") == code:
                    rev = e.get("revision_path") or ""
                    if rev and Path(normalize_path(rev)).is_dir():
                        res = rename_revision_prefix_on_disk(rev, replacement)
                        if res.get("ok"):
                            reassigned += 1
        append_audit({
            "action": "carrier_type_deleted",
            "detail": f"{code} -> {replacement or 'brak (wyczyszczone)'} ({reassigned} przepisanych)",
            "user": payload.get("actor") or "",
        })
        return {"ok": True, "deleted": code, "replacement": replacement, "reassigned_count": reassigned}

    return {"ok": False, "error": "unknown_action"}


_VARIANT_CODE_RE = re.compile(r"^[A-Z0-9][A-Z0-9\-]{0,15}$")
_SUBCATEGORY_SLUG_RE = re.compile(r"^[a-z0-9-]{1,48}$")


def add_global_subcategory(payload: dict, *, actor: str = "") -> dict:
    """Global subcategory append to naming-dictionary.subcategories[] (no Szablony copytree)."""
    slug = str(payload.get("slug") or "").strip().lower()
    label_pl = str(payload.get("label_pl") or "").strip()
    if not slug:
        return {"ok": False, "error": "slug_required", "message": "Podaj slug podkategorii."}
    if not _SUBCATEGORY_SLUG_RE.match(slug):
        return {
            "ok": False,
            "error": "slug_invalid",
            "message": "Slug: 1-48 znakow, male litery/cyfry/myslnik.",
        }
    if not label_pl:
        return {"ok": False, "error": "label_pl_required", "message": "Podaj etykiete PL."}

    naming = _load_json(NAMING_DICTIONARY_FILE, {})
    if not isinstance(naming, dict):
        naming = {}
    subs = naming.setdefault("subcategories", [])
    if not isinstance(subs, list):
        subs = []
        naming["subcategories"] = subs
    for row in subs:
        if isinstance(row, dict) and str(row.get("slug") or "").strip().lower() == slug:
            return {
                "ok": False,
                "error": "already_exists",
                "message": f"Podkategoria {slug} juz istnieje.",
            }

    entry = {
        "slug": slug,
        "label_pl": label_pl,
        "added_at": utc_now(),
        "added_by": actor or "",
        "custom": True,
    }
    subs.append(entry)
    naming["version"] = int(naming.get("version") or 1) + 1
    _save_json(NAMING_DICTIONARY_FILE, naming)
    reload_naming_policy_from_disk()
    return {
        "ok": True,
        "slug": slug,
        "label_pl": label_pl,
        "subcategory": entry,
        "message": f"Dodano podkategorie globalna: {label_pl} ({slug}).",
    }


def add_global_variant_type(payload: dict, *, actor: str = "") -> dict:
    """Nowy wariant/nosnik GLOBALNY, respektowany przez cala aplikacje (EXP-C /
    Eksplorer - "Dodaj produkt", sekcja "Nowy wariant globalny").

    3 parametry usera: kod PL (skrot na dysku, np. PUSZ), kod EN (alias, np. CAN),
    pelna nazwa PL do UI (np. PUSZKA). Zapis do dwoch miejsc zgodnie z
    naming.carrier_ui_vs_disk (program-instructions.json):
      - naming-dictionary.json -> carriers[{code}] = {short, aliases, label_pl}
        (ZRODLO PRAWDY prefiksu na dysku + etykiety UI; _save_json robi KV push)
      - carrier-types.json -> custom_types[{code}] (widoczne w istniejacym
        GET/POST /carrier-types uzywanym przez Ustawienia)
    UWAGA (ograniczenie, nie blokada): to rejestruje nazwe/etykiete globalnie,
    ale NIE tworzy nowego fizycznego podfolderu w szablonie produktu na X: -
    fizyczny folder wariantu w Szablony folderow musi dodac admin recznie, potem
    wariant pojawi sie na liscie available_variants (skan folderu szablonu).
    """
    code = str(payload.get("code") or "").strip().upper()
    code_en = str(payload.get("code_en") or "").strip().upper()
    label_pl = str(payload.get("label_pl") or "").strip()

    if not code:
        return {"ok": False, "error": "code_required", "message": "Podaj kod PL (skrot na dysku)."}
    if not _VARIANT_CODE_RE.match(code):
        return {
            "ok": False,
            "error": "code_invalid",
            "message": "Kod PL: 1-16 znakow, wielkie litery/cyfry/myslnik, bez spacji.",
        }
    if code_en and not _VARIANT_CODE_RE.match(code_en):
        return {
            "ok": False,
            "error": "code_en_invalid",
            "message": "Kod EN: 1-16 znakow, wielkie litery/cyfry/myslnik, bez spacji.",
        }
    if not label_pl:
        return {"ok": False, "error": "label_pl_required", "message": "Podaj pelna nazwe (etykieta UI)."}

    naming = _load_json(NAMING_DICTIONARY_FILE, {})
    if not isinstance(naming, dict):
        naming = {}
    carriers = naming.setdefault("carriers", {})
    if code in carriers:
        return {
            "ok": False,
            "error": "already_exists",
            "message": f"Wariant {code} juz istnieje w slowniku nazewnictwa.",
        }

    aliases = [code]
    if code_en and code_en != code:
        aliases.append(code_en)
    if label_pl.upper() not in aliases:
        aliases.append(label_pl.upper())

    carriers[code] = {
        "short": code,
        "aliases": aliases,
        "label_pl": label_pl,
        "code_en": code_en or "",
        "added_at": utc_now(),
        "added_by": actor or "",
        "custom": True,
    }
    order = naming.setdefault("carrier_detect_order", [])
    if code not in order:
        order.append(code)
    naming["version"] = int(naming.get("version") or 1) + 1
    _save_json(NAMING_DICTIONARY_FILE, naming)
    reload_naming_policy_from_disk()

    ctypes = _load_json(CARRIER_TYPES_FILE, {"custom_types": {}, "deleted_types": {}})
    ctypes.setdefault("custom_types", {})
    ctypes.setdefault("deleted_types", {})
    ctypes["custom_types"][code] = {
        "label_pl": label_pl,
        "code_en": code_en or "",
        "added_at": utc_now(),
        "added_by": actor or "",
    }
    ctypes["deleted_types"].pop(code, None)
    _save_json(CARRIER_TYPES_FILE, ctypes)

    # HARD 2026-07-21: utworz foldery wariantu w Szablony folderow (PL + EN/GC)
    templates_created: list[str] = []
    templates_errors: list[str] = []
    try:
        import shutil
        from explorer_create import (  # type: ignore
            resolve_product_template,
        )
        marketing_base = None
        try:
            cfg = _load_json(WEB_ROOT / "data" / "machine-config.json", {})
            marketing_base = (cfg.get("marketing_base") or cfg.get("base_path") or "").strip()
        except Exception:  # noqa: BLE001
            marketing_base = ""
        if not marketing_base:
            # Common local mount
            for cand in (r"X:\Marketing", r"P:\Marketing"):
                if Path(cand).is_dir():
                    marketing_base = cand
                    break
        if marketing_base and Path(marketing_base).is_dir():
            base = Path(marketing_base)
            for brand in ("DK", "GC"):
                prod_tmpl = resolve_product_template(base, brand)
                if prod_tmpl is None or not prod_tmpl.is_dir():
                    templates_errors.append(f"no_product_template:{brand}")
                    continue
                # Example variant folder name pattern from siblings
                siblings = [c for c in prod_tmpl.iterdir() if c.is_dir()]
                sample = siblings[0].name if siblings else f"{code} - DD.MM.RRRR - 0000000.00"
                # Replace leading carrier token with new code short
                head = sample.split(" - ")[0].strip()
                rest = sample[len(head):] if head else sample
                if rest.startswith(" - "):
                    new_folder = code + rest
                else:
                    new_folder = f"{code} - DD.MM.RRRR - 0000000.00"
                dest = prod_tmpl / new_folder
                if dest.exists():
                    templates_created.append(str(dest) + " (exists)")
                    continue
                # Copy tree from sample sibling if available, else minimal slots
                try:
                    if siblings:
                        shutil.copytree(siblings[0], dest)
                        # rename is already dest; content is copy of sample - OK for template
                    else:
                        dest.mkdir(parents=True, exist_ok=True)
                        for slot in ("1 - PROJEKT", "3 - DRUK", "4 - WIZKI"):
                            (dest / slot).mkdir(exist_ok=True)
                    templates_created.append(str(dest))
                except OSError as exc:
                    templates_errors.append(f"{brand}:{exc}")
        else:
            templates_errors.append("marketing_base_unavailable")
    except Exception as exc:  # noqa: BLE001
        templates_errors.append(str(exc))

    append_audit({
        "action": "explorer_add_variant_type",
        "detail": f"{code} ({code_en or '-'}): {label_pl}; templates={len(templates_created)}",
        "user": actor or "",
    })
    return {
        "ok": True,
        "code": code,
        "code_en": code_en,
        "label_pl": label_pl,
        "templates_created": templates_created,
        "templates_errors": templates_errors,
        "message": f"Dodano wariant globalny: {label_pl} ({code}).",
    }


NOTIFICATION_GROUPS_FILE = WEB_ROOT / "data" / "notification-groups.json"
INBOX_ITEMS_FILE = WEB_ROOT / "data" / "inbox-items.json"


def load_notification_group(name: str) -> list[dict]:
    data = _load_json(NOTIFICATION_GROUPS_FILE, {})
    return data.get(name) or []


def append_inbox_item(entry: dict) -> dict:
    """Wpis 'w aplikacji' - ZAWSZE tworzony niezaleznie od wybranych kanalow
    zewnetrznych (Faza 6, P10). apps/web/data/inbox-items.json, tagi = zrodlo."""
    data = _load_json(INBOX_ITEMS_FILE, {"items": []})
    data.setdefault("items", [])
    entry = dict(entry)
    entry.setdefault("id", f"inbox_{int(datetime.now(timezone.utc).timestamp() * 1000)}")
    entry.setdefault("created_at", utc_now())
    entry.setdefault("read", False)
    data["items"].insert(0, entry)
    data["items"] = data["items"][:500]  # nie rosnij w nieskonczonosc
    _save_json(INBOX_ITEMS_FILE, data)
    return entry


def create_viz_request(payload: dict) -> dict:
    """Faza 5/6 (P10): "Zglos zapotrzebowanie" - wielokanalowe zgloszenie.
    Email/Teams/Asana to na razie STUBY (ADR-005) - logujemy intencje w audit +
    inbox, gotowe do podlaczenia realnych credentiali. Wpis w panelu ZAWSZE."""
    product_name = payload.get("product_name") or "Produkt"
    lang_full = payload.get("lang_full") or payload.get("lang") or ""
    index = payload.get("index") or ""
    channels = payload.get("channels") or {}
    requested_by = payload.get("requested_by") or "anonim"

    human_desc = (
        f"Prosze o wykonanie wizualizacji na {product_name}"
        + (f" ({lang_full})" if lang_full else "")
        + (f" - indeks {index}" if index else "")
        + f". Zglosil: {requested_by}."
    )
    folder_link = payload.get("path") or ""
    detail_lines = [human_desc]
    if folder_link:
        detail_lines.append(f"Folder: {folder_link}")
    if payload.get("brand"):
        detail_lines.append(f"Marka: {payload.get('brand')}")
    if payload.get("category"):
        detail_lines.append(f"Kategoria: {payload.get('category')}")
    if payload.get("carrier_label"):
        detail_lines.append(f"Typ: {payload.get('carrier_label')}")
    full_detail = "\n".join(detail_lines)

    channels_sent: list[str] = []
    tags = ["wizualizacja", "zgloszenie"]

    if channels.get("email"):
        recipients = [g.get("email") for g in load_notification_group("grafik") if g.get("email")]
        append_audit({
            "action": "viz_request_email_stub",
            "detail": f"TO: {', '.join(recipients)} | {human_desc}",
            "user": requested_by,
        })
        channels_sent.append("email")
        tags.append("mail")
    if channels.get("teams"):
        append_audit({"action": "viz_request_teams_stub", "detail": human_desc, "user": requested_by})
        channels_sent.append("teams")
        tags.append("teams")
    if channels.get("asana"):
        append_audit({"action": "viz_request_asana_stub", "detail": full_detail, "user": requested_by})
        channels_sent.append("asana")
        tags.append("asana")
    if channels.get("app") or not channels_sent:
        channels_sent.append("app")
        tags.append("prywatna")

    inbox_entry = append_inbox_item({
        "type": "viz_request",
        "title": f"Zgloszenie wizualizacji: {product_name}",
        "detail": full_detail,
        "tags": sorted(set(tags)),
        "requested_by": requested_by,
        "product_id": payload.get("product_id"),
        "path": folder_link,
    })
    append_audit({
        "action": "viz_request_created",
        "detail": human_desc,
        "user": requested_by,
        "path": folder_link,
    })
    return {"ok": True, "channels_sent": channels_sent, "inbox_item": inbox_entry}


def append_thumb_override(product_id: str, entry: dict) -> dict:
    """Zapis wyboru miniatury w repo (apps/web/data) - nigdy na Marketing."""
    pid = (product_id or "").strip()
    if not pid:
        return {"ok": False, "error": "product_id_required"}
    overrides_file = WEB_ROOT / "data" / "thumb-overrides.json"
    data = _load_json(overrides_file, {})
    if not isinstance(data, dict):
        data = {}
    if entry.get("clear"):
        data.pop(pid, None)
        _save_json(overrides_file, data)
        return {"ok": True, "product_id": pid, "cleared": True, "store": str(overrides_file)}
    row = {
        "path": (entry.get("path") or "").strip(),
        "file": (entry.get("file") or "").strip(),
        "thumb_url": (entry.get("thumb_url") or "").strip(),
        "updated_at": utc_now(),
    }
    data[pid] = row
    _save_json(overrides_file, data)
    return {"ok": True, "product_id": pid, "entry": row, "store": str(overrides_file)}


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff"}


def list_folder_images(path: str) -> dict:
    """Lista obrazow + podfolderow w folderze Marketing (picker miniatury/parowania w przegladarce).
    Zwraca rowniez `parent` (jesli wciaz pod Marketing) - admin moze nawigowac
    w gore/w dol, zeby wskazac folder wizualizacji INNEGO jezyka/wariantu (parowanie, 2026-07-18)."""
    target = Path(normalize_path(path or ""))
    if not target.exists():
        return {"ok": False, "error": "path_not_found", "path": str(target), "files": [], "folders": []}
    if target.is_file():
        target = target.parent
    if not target.is_dir():
        return {"ok": False, "error": "not_a_directory", "path": str(target), "files": [], "folders": []}
    if not _is_under_marketing(target):
        return {"ok": False, "error": "path_outside_marketing", "path": str(target), "files": [], "folders": []}
    files: list[dict] = []
    folders: list[dict] = []
    try:
        for child in sorted(target.iterdir(), key=lambda p: p.name.lower()):
            if child.is_dir():
                if len(folders) < 200:
                    folders.append({"name": child.name, "path": str(child).replace("\\", "/")})
                continue
            if not child.is_file():
                continue
            if child.suffix.lower() not in IMAGE_EXTS:
                continue
            files.append(
                {
                    "name": child.name,
                    "path": str(child).replace("\\", "/"),
                    "ext": child.suffix.lower().lstrip("."),
                    "size": child.stat().st_size,
                }
            )
            if len(files) >= 200:
                break
    except OSError as exc:
        return {"ok": False, "error": str(exc), "path": str(target), "files": [], "folders": []}
    parent = target.parent
    parent_ok = str(parent) != str(target) and _is_under_marketing(parent)
    return {
        "ok": True,
        "path": str(target).replace("\\", "/"),
        "files": files,
        "folders": folders,
        "parent": str(parent).replace("\\", "/") if parent_ok else "",
    }


def _child_dir_named(parent: Path, name_lower: str) -> Path | None:
    """Znajdz podfolder po nazwie (case-insensitive)."""
    if not parent.is_dir():
        return None
    want = (name_lower or "").strip().lower()
    if not want:
        return None
    try:
        for child in parent.iterdir():
            if child.is_dir() and child.name.lower() == want:
                return child
    except OSError:
        return None
    return None


def _child_dir_prefix(parent: Path, prefix_lower: str) -> Path | None:
    """Znajdz podfolder zaczynajacy sie od prefixu (np. '1 - materia' / '2 - projekt')."""
    if not parent.is_dir():
        return None
    pref = (prefix_lower or "").strip().lower()
    if not pref:
        return None
    try:
        for child in parent.iterdir():
            if child.is_dir() and child.name.lower().startswith(pref):
                return child
    except OSError:
        return None
    return None


_SZKICE_NAME_RE = re.compile(r"szkice", re.IGNORECASE)
_PROJEKT_SLOT_PREFIXES = (
    "2 - projekty",
    "2 - projekt",
    "2 - project",
    "2 - projects",
)
_WIZKI_SLOT_PREFIXES = (
    "4 - wizualizacje",
    "4 - wizki",
    "4 - visuals",
    "4 - wizual",
    "4 - viz",
)
_DRUK_SLOT_PREFIXES = (
    "3 - druk",
    "3 - print",
    "3 - drukarnia",
)


def _is_szkice_name(name: str) -> bool:
    return bool(_SZKICE_NAME_RE.search(name or ""))


def _find_slot_dir(revision: Path, prefixes: tuple[str, ...]) -> Path | None:
    """Case-insensitive slot match (PROJEKT/PROJEKTY, WIZKI/WIZUALIZACJE, DRUK)."""
    for pref in prefixes:
        found = _child_dir_prefix(revision, pref)
        if found is not None:
            return found
    return None


def _find_7z_exe() -> str | None:
    import shutil

    candidates = [
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe",
        shutil.which("7z"),
        shutil.which("7za"),
        shutil.which("7z.exe"),
    ]
    for c in candidates:
        if not c:
            continue
        p = Path(c)
        if p.is_file():
            return str(p)
    return None


def _try_choco_install_7zip() -> str | None:
    """Non-interactive Chocolatey install of 7zip; return 7z.exe path or None."""
    import shutil

    choco = shutil.which("choco")
    if not choco:
        return None
    try:
        _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        subprocess.run(
            [choco, "install", "7zip", "-y", "--no-progress"],
            check=False,
            timeout=300,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=_no_win,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return _find_7z_exe()


def _find_main_ai_stem(projekt: Path) -> str | None:
    """Stem glownego .ai w 2 - PROJEKT (bez SZKICE); preferuj *-F / najnowszy."""
    if not projekt.is_dir():
        return None
    ais: list[Path] = []
    try:
        for child in projekt.iterdir():
            if not child.is_file():
                continue
            if child.suffix.lower() != ".ai":
                continue
            if _is_szkice_name(child.name):
                continue
            ais.append(child)
    except OSError:
        return None
    if not ais:
        return None

    def _rank(p: Path) -> tuple:
        stem = p.stem
        has_f = 0 if re.search(r"(?:^|[\s_-])F(?:$|[\s_-])|\.00-F|-F$", stem, re.I) else 1
        try:
            mtime = -p.stat().st_mtime
        except OSError:
            mtime = 0.0
        return (has_f, mtime, stem.lower())

    ais.sort(key=_rank)
    return ais[0].stem


def _collect_pack_entries(
    projekt: Path, wizki: Path
) -> list[tuple[Path, str]]:
    """Lista (abs_path, arcname) - sloty jako top-level w ZIP; bez plikow *szkice*."""
    entries: list[tuple[Path, str]] = []
    for folder in (projekt, wizki):
        if not folder.is_dir():
            continue
        root_name = folder.name
        try:
            for root, _dirs, files in os.walk(folder):
                root_p = Path(root)
                for fname in files:
                    if _is_szkice_name(fname):
                        continue
                    abs_p = root_p / fname
                    try:
                        rel = abs_p.relative_to(folder)
                    except ValueError:
                        continue
                    arc = str(Path(root_name) / rel).replace("\\", "/")
                    entries.append((abs_p, arc))
        except OSError:
            continue
    return entries


def _zip_with_7z(out_zip: Path, revision: Path, projekt: Path, wizki: Path, seven: str) -> dict:
    """7-Zip: format zip, Ultra (-mx=9), multi-thread; wyklucz *szkice*."""
    args = [
        seven,
        "a",
        "-tzip",
        "-mx=9",
        "-mmt=on",
        "-y",
        str(out_zip),
        projekt.name,
        wizki.name,
        "-xr!*szkice*",
        "-xr!*SZKICE*",
        "-xr!*Szkice*",
    ]
    _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
    try:
        proc = subprocess.run(
            args,
            cwd=str(revision),
            check=False,
            timeout=900,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=_no_win,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "zip_timeout", "engine": "7z"}
    except OSError as exc:
        return {"ok": False, "error": "zip_os_error", "detail": str(exc), "engine": "7z"}
    if proc.returncode != 0 or not out_zip.is_file():
        return {
            "ok": False,
            "error": "7z_failed",
            "engine": "7z",
            "detail": (proc.stderr or proc.stdout or "")[:500],
            "returncode": proc.returncode,
        }
    return {"ok": True, "engine": "7z"}


def _zip_with_python(out_zip: Path, entries: list[tuple[Path, str]]) -> dict:
    """stdlib zipfile DEFLATE max; fallback gdy brak 7-Zip / Compress-Archive."""
    import zipfile

    try:
        with zipfile.ZipFile(
            out_zip,
            mode="w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
        ) as zf:
            for abs_p, arc in entries:
                try:
                    zf.write(abs_p, arcname=arc)
                except OSError:
                    continue
    except OSError as exc:
        return {"ok": False, "error": "zip_os_error", "detail": str(exc), "engine": "zipfile"}
    if not out_zip.is_file():
        return {"ok": False, "error": "zip_missing", "engine": "zipfile"}
    return {"ok": True, "engine": "zipfile"}


def _zip_with_powershell(out_zip: Path, stage_dir: Path) -> dict:
    """Windows Compress-Archive fallback (stage juz bez SZKICE)."""
    if sys.platform != "win32":
        return {"ok": False, "error": "not_windows", "engine": "compress_archive"}
    ps = (
        "Compress-Archive -Path (Join-Path -LiteralPath $env:DAM_STAGE '*') "
        "-DestinationPath $env:DAM_OUT -CompressionLevel Optimal -Force"
    )
    env = os.environ.copy()
    env["DAM_STAGE"] = str(stage_dir)
    env["DAM_OUT"] = str(out_zip)
    _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    try:
        proc = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                ps,
            ],
            check=False,
            timeout=900,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            creationflags=_no_win,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"ok": False, "error": "compress_archive_failed", "detail": str(exc), "engine": "compress_archive"}
    if proc.returncode != 0 or not out_zip.is_file():
        return {
            "ok": False,
            "error": "compress_archive_failed",
            "engine": "compress_archive",
            "detail": (proc.stderr or proc.stdout or "")[:500],
        }
    return {"ok": True, "engine": "compress_archive"}


def create_print_package(
    revision_path: str = "",
    product_id: str = "",
    index: str = "",
    dry_run: bool = False,
) -> dict:
    """
    Spakuj 2 - PROJEKT(+y) + 4 - WIZKI/WIZUALIZACJE do ZIP w 3 - DRUK.
    Nazwa ZIP = stem glownego .ai (bez SZKICE). Preferuj 7-Zip Ultra zip.
    """
    import shutil
    import tempfile

    rev: Path | None = None
    if revision_path:
        cand = Path(normalize_path(revision_path))
        if cand.is_dir() and _is_under_marketing(cand):
            rev = cand
    if rev is None:
        rev = _resolve_revision_path(product_id=product_id, index=index, revision_path=revision_path)
    if rev is None or not rev.is_dir():
        return {
            "ok": False,
            "error": "revision_not_found",
            "message": "Nie znaleziono folderu wariantu produktu.",
        }
    if not _is_under_marketing(rev):
        return {"ok": False, "error": "path_outside_marketing"}

    projekt = _find_slot_dir(rev, _PROJEKT_SLOT_PREFIXES)
    wizki = _find_slot_dir(rev, _WIZKI_SLOT_PREFIXES)
    druk = _find_slot_dir(rev, _DRUK_SLOT_PREFIXES)
    missing: list[str] = []
    if projekt is None:
        missing.append("2 - PROJEKT")
    if wizki is None:
        missing.append("4 - WIZKI")
    if missing:
        return {
            "ok": False,
            "error": "folders_missing",
            "missing": missing,
            "message": "Brak folderow: " + ", ".join(missing),
            "revision_path": str(rev),
        }

    assert projekt is not None and wizki is not None
    stem = _find_main_ai_stem(projekt)
    if not stem:
        return {
            "ok": False,
            "error": "ai_project_missing",
            "message": "Brak pliku .ai projektu w 2 - PROJEKT (bez SZKICE).",
            "revision_path": str(rev),
            "projekt_path": str(projekt),
        }

    if druk is None:
        druk = rev / "3 - DRUK"
    zip_name = stem + ".zip"
    out_zip = druk / zip_name
    entries = _collect_pack_entries(projekt, wizki)
    if not entries:
        return {
            "ok": False,
            "error": "nothing_to_pack",
            "message": "Brak plikow do spakowania (po wykluczeniu SZKICE).",
        }

    result_base = {
        "ok": True,
        "revision_path": str(rev),
        "projekt_path": str(projekt),
        "wizki_path": str(wizki),
        "druk_path": str(druk),
        "zip_name": zip_name,
        "zip_path": str(out_zip),
        "ai_stem": stem,
        "file_count": len(entries),
        "dry_run": bool(dry_run),
    }
    if dry_run:
        return result_base

    try:
        druk.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        return {
            "ok": False,
            "error": "druk_mkdir_failed",
            "detail": str(exc),
            "message": "Nie mozna utworzyc folderu 3 - DRUK.",
        }

    if out_zip.is_file():
        try:
            out_zip.unlink()
        except OSError as exc:
            return {
                "ok": False,
                "error": "zip_locked",
                "detail": str(exc),
                "message": "Nie mozna nadpisac istniejacego ZIP (plik zajety?).",
            }

    seven = _find_7z_exe()
    if not seven:
        seven = _try_choco_install_7zip()

    zip_res: dict
    if seven:
        zip_res = _zip_with_7z(out_zip, rev, projekt, wizki, seven)
        if not zip_res.get("ok"):
            # 7z mogl stworzyc uszkodzony plik
            try:
                if out_zip.is_file():
                    out_zip.unlink()
            except OSError:
                pass
            zip_res = _zip_with_python(out_zip, entries)
    else:
        zip_res = {"ok": False, "error": "7z_missing"}

    if not zip_res.get("ok") and sys.platform == "win32":
        try:
            if out_zip.is_file():
                out_zip.unlink()
        except OSError:
            pass
        stage: Path | None = None
        try:
            stage = Path(tempfile.mkdtemp(prefix="dam-pakiet-"))
            for abs_p, arc in entries:
                dest = stage / Path(arc)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(abs_p, dest)
            zip_res = _zip_with_powershell(out_zip, stage)
        except OSError as exc:
            zip_res = {
                "ok": False,
                "error": "stage_failed",
                "detail": str(exc),
                "engine": "compress_archive",
            }
        finally:
            if stage is not None:
                try:
                    shutil.rmtree(stage, ignore_errors=True)
                except OSError:
                    pass

    if not zip_res.get("ok"):
        try:
            if out_zip.is_file():
                out_zip.unlink()
        except OSError:
            pass
        zip_res = _zip_with_python(out_zip, entries)

    if not zip_res.get("ok"):
        return {
            "ok": False,
            "error": zip_res.get("error") or "zip_failed",
            "detail": zip_res.get("detail") or "",
            "engine": zip_res.get("engine") or "",
            "message": "Kompresja ZIP nie powiodla sie.",
            "revision_path": str(rev),
        }

    try:
        st = out_zip.stat()
        size = int(st.st_size)
        mtime = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
    except OSError:
        size = 0
        mtime = utc_now()

    result_base.update(
        {
            "ok": True,
            "dry_run": False,
            "engine": zip_res.get("engine") or "",
            "zip_size": size,
            "mtime": mtime,
            "file": {
                "name": zip_name,
                "path": str(out_zip).replace("\\", "/"),
                "ext": "zip",
                "size": size,
                "mtime": mtime,
                "lang": "",
                "slot": druk.name if druk else "3 - DRUK",
                "role": "print",
            },
        }
    )
    return result_base


def _count_files(folder: Path, max_n: int = 500) -> int:
    n = 0
    if not folder.is_dir():
        return 0
    try:
        for root, _dirs, files in os.walk(folder):
            n += len(files)
            if n >= max_n:
                return n
    except OSError:
        return n
    return n


def _find_links_under_projekt(projekt: Path) -> Path | None:
    """Preferuj ...\\2 - PROJEKT\\Links; inaczej najbogatszy zagniezdzony Links."""
    direct = _child_dir_named(projekt, "links")
    if direct is not None:
        return direct
    best: Path | None = None
    best_n = -1
    try:
        for child in projekt.iterdir():
            if not child.is_dir():
                continue
            nested = _child_dir_named(child, "links")
            if nested is None:
                continue
            n = _count_files(nested, max_n=50)
            if n > best_n:
                best = nested
                best_n = n
    except OSError:
        return best
    return best


def _resolve_revision_path(product_id: str = "", index: str = "", revision_path: str = "") -> Path | None:
    """Znajdz folder rewizji produktu po sciezce / id+indeksie z file-index."""
    if revision_path:
        p = Path(normalize_path(revision_path))
        if p.is_dir() and _is_under_marketing(p):
            return p
    pid = (product_id or "").strip()
    idx = (index or "").strip()
    if not pid and not idx:
        return None
    if not INDEX_FILE.is_file():
        return None
    try:
        data = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    products = data.get("products") if isinstance(data, dict) else None
    if not isinstance(products, list):
        return None
    idx_base = idx.split(".")[0] if idx else ""
    for prod in products:
        if not isinstance(prod, dict):
            continue
        if pid and str(prod.get("id") or "") != pid:
            continue
        revs = prod.get("revisions") or []
        if not isinstance(revs, list):
            continue
        # Najpierw dokladne dopasowanie indeksu, potem baza, potem latest
        exact = None
        base_hit = None
        latest = None
        for rev in revs:
            if not isinstance(rev, dict):
                continue
            rpath = (rev.get("path") or "").strip()
            if not rpath:
                continue
            ridx = str(rev.get("index") or "")
            if idx and ridx == idx:
                exact = rpath
            if idx_base and (ridx.split(".")[0] == idx_base or str(rev.get("index_base") or "") == idx_base):
                if base_hit is None or rev.get("is_latest"):
                    base_hit = rpath
            if rev.get("is_latest"):
                latest = rpath
        chosen = exact or base_hit or (latest if pid and not idx else None)
        if chosen:
            p = Path(normalize_path(chosen))
            if p.is_dir() and _is_under_marketing(p):
                return p
        if pid:
            break
    return None


def resolve_product_links_elementy(
    product_id: str = "",
    index: str = "",
    revision_path: str = "",
) -> dict:
    """
    STREFA A3 / pkt 37: lokalizacja folderow Links (surowe) i ELEMENTY (gotowe)
    dla rewizji produktu. ELEMENTY puste + Links obecne => UI moze zaproponowac resizer.
    """
    rev = _resolve_revision_path(product_id, index, revision_path)
    if rev is None:
        return {
            "ok": False,
            "error": "revision_not_found",
            "product_id": product_id or "",
            "index": index or "",
        }
    materials = _child_dir_prefix(rev, "1 - materia")
    projekt = _child_dir_prefix(rev, "2 - projekt")
    elementy = _child_dir_named(materials, "elementy") if materials else None
    links = _find_links_under_projekt(projekt) if projekt else None
    el_count = _count_files(elementy) if elementy else 0
    links_count = _count_files(links) if links else 0
    return {
        "ok": True,
        "revision_path": str(rev).replace("\\", "/"),
        "links_path": str(links).replace("\\", "/") if links else "",
        "links_exists": bool(links and links.is_dir()),
        "links_file_count": links_count,
        "elementy_path": str(elementy).replace("\\", "/") if elementy else "",
        "elementy_exists": bool(elementy and elementy.is_dir()),
        "elementy_file_count": el_count,
        "can_generate": bool(links and links.is_dir() and links_count > 0 and el_count == 0),
        "product_id": product_id or "",
        "index": index or "",
    }


def open_image_resizer(input_path: str = "", output_path: str = "", product_id: str = "", index: str = "") -> dict:
    """
    STREFA A3 / pkt 37: otworz Inyfinn Photo Resizer.
    Jezeli dostepny CLI (venv / python -m) - uruchom convert PNG q=60.
    W przeciwnym razie: GUI + Explorer na folder Links (PIDL/foreground ze Strefy D).
    """
    info = resolve_product_links_elementy(product_id, index, "")
    inp = (input_path or "").strip() or (info.get("links_path") or "")
    out = (output_path or "").strip() or (info.get("elementy_path") or "")
    if not inp:
        return {"ok": False, "error": "input_required", "info": info}
    inp_p = Path(normalize_path(inp))
    out_p = Path(normalize_path(out)) if out else None
    if not _is_under_marketing(inp_p):
        return {"ok": False, "error": "input_outside_marketing", "input": str(inp_p)}
    if out_p is not None and out and not _is_under_marketing(out_p):
        return {"ok": False, "error": "output_outside_marketing", "output": str(out_p)}
    if out_p is not None and out:
        try:
            out_p.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            return {"ok": False, "error": f"output_mkdir_failed:{exc}", "output": str(out_p)}

    root = IMAGE_RESIZER_ROOT
    launcher = root / "InyfinnPhotoResizer.exe"
    bin_exe = root / "BIN" / "InyfinnPhotoResizer.exe"
    venv_py = root / "BIN" / "dev" / ".venv" / "Scripts" / "python.exe"
    cli_module = "inyfinn_resizer.cli"

    _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
    cli_args = [
        "convert",
        "--input",
        str(inp_p),
        "--output",
        str(out_p) if out_p else str(inp_p),
        "--format",
        "png",
        "--quality",
        "60",
        "--overwrite",
    ]

    # 1) CLI przez venv projektu resizera (gdy obecny)
    if venv_py.is_file():
        try:
            proc = subprocess.Popen(
                [str(venv_py), "-m", cli_module, *cli_args],
                cwd=str(root / "BIN" / "dev"),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=_no_win,
            )
            return {
                "ok": True,
                "mode": "cli_venv",
                "pid": proc.pid,
                "input": str(inp_p).replace("\\", "/"),
                "output": str(out_p).replace("\\", "/") if out_p else "",
                "warning": "Konwersja automatyczna moze dac elementy slabej jakosci.",
                "info": info if info.get("ok") else {},
            }
        except OSError as exc:
            cli_err = str(exc)
    else:
        cli_err = "venv_python_missing"

    # 2) Fallback: GUI + otwarcie folderu Links w Explorerze
    exe = launcher if launcher.is_file() else bin_exe
    if not exe.is_file():
        return {
            "ok": False,
            "error": "resizer_exe_missing",
            "path": str(root),
            "cli_error": cli_err,
            "info": info if info.get("ok") else {},
        }
    try:
        subprocess.Popen(
            [str(exe)],
            cwd=str(exe.parent),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError as exc:
        return {"ok": False, "error": f"launch_failed:{exc}", "exe": str(exe)}

    reveal = reveal_in_explorer(str(inp_p))
    return {
        "ok": True,
        "mode": "gui_plus_explorer",
        "exe": str(exe).replace("\\", "/"),
        "input": str(inp_p).replace("\\", "/"),
        "output": str(out_p).replace("\\", "/") if out_p else "",
        "cli_error": cli_err,
        "explorer": reveal,
        "warning": (
            "Brak jasnego CLI w launcherze EXE - otwarto GUI oraz folder Links. "
            "Ustaw input=Links, output=ELEMENTY, PNG 60%."
        ),
        "info": info if info.get("ok") else {},
    }


def read_viz_flags() -> dict:
    flags_file = WEB_ROOT / "data" / "viz-flags.json"
    default = {"demo": {}, "hidden": {}, "manual": [], "linked_variants": {}, "unlinked_variants": {}, "updated_at": ""}
    raw = _load_json(flags_file, default)
    if not isinstance(raw, dict):
        return default
    return {
        "demo": raw.get("demo") if isinstance(raw.get("demo"), dict) else {},
        "hidden": raw.get("hidden") if isinstance(raw.get("hidden"), dict) else {},
        "manual": raw.get("manual") if isinstance(raw.get("manual"), list) else [],
        "linked_variants": raw.get("linked_variants") if isinstance(raw.get("linked_variants"), dict) else {},
        "unlinked_variants": raw.get("unlinked_variants") if isinstance(raw.get("unlinked_variants"), dict) else {},
        "updated_at": raw.get("updated_at") or "",
    }


def write_viz_flags(payload: dict) -> dict:
    """Zapis flag demo/hidden/manual tylko do apps/web/data (+ PG Tier 2)."""
    flags_file = WEB_ROOT / "data" / "viz-flags.json"
    current = read_viz_flags()
    action = (payload.get("action") or "").strip().lower()
    if isinstance(payload.get("flags"), dict):
        incoming = payload["flags"]
        current["demo"] = incoming.get("demo") if isinstance(incoming.get("demo"), dict) else current["demo"]
        current["hidden"] = incoming.get("hidden") if isinstance(incoming.get("hidden"), dict) else current["hidden"]
        if isinstance(incoming.get("manual"), list):
            current["manual"] = incoming["manual"]
        if isinstance(incoming.get("linked_variants"), dict):
            current["linked_variants"] = incoming["linked_variants"]
        if isinstance(incoming.get("unlinked_variants"), dict):
            current["unlinked_variants"] = incoming["unlinked_variants"]
    elif action in ("demo", "hidden"):
        key = (payload.get("key") or "").strip()
        if key:
            bucket = current.setdefault(action, {})
            if payload.get("value"):
                bucket[key] = True
            else:
                bucket.pop(key, None)
    elif action == "manual":
        entry = payload.get("entry")
        if isinstance(entry, dict) and entry.get("path"):
            current.setdefault("manual", []).append(entry)
    current["updated_at"] = utc_now()
    _save_json(flags_file, current)
    return {"ok": True, "flags": current, "store": str(flags_file)}


_MEDIA_MAX_BYTES = 40 * 1024 * 1024  # 40 MB - anty DoS przez odczyt ogromnych plikow
_MEDIA_VIDEO_MAX_BYTES = 512 * 1024 * 1024  # 512 MB - wideo streamowane z Range


_PREVIEW_RASTER_EXT = {".tif", ".tiff", ".psd", ".psb", ".bmp"}
_PREVIEW_ALPHA_EXT = {".png", ".webp"}
_VIDEO_EXT = {".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"}
_MATTE_PNG_CACHE: dict[str, tuple[float, int, bytes]] = {}
_MATTE_PNG_CACHE_MAX = 64


def _path_is_elementy_folder(path: str) -> bool:
    """True gdy plik lezy w folderze ELEMENTY (case-insensitive)."""
    n = (path or "").replace("/", "\\").lower()
    return "\\elementy\\" in n or n.rstrip("\\").endswith("\\elementy")


def _image_to_jpeg_bytes(im) -> bytes:
    import io

    from PIL import Image  # type: ignore

    if im.mode in ("CMYK", "P"):
        im = im.convert("RGB")
    elif im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        if im.mode == "LA":
            im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    elif im.mode != "RGB":
        im = im.convert("RGB")
    max_side = 2400
    if max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=88, optimize=True)
    return buf.getvalue()


def _rgba_sample_has_transparency(rgba, *, alpha_threshold: int = 128, min_ratio: float = 0.01) -> bool:
    """Szybki sampling: czy obraz ma juz prawdziwa przezroczystosc."""
    w, h = rgba.size
    step = max(1, min(w, h) // 80)
    total = 0
    transparent = 0
    px = rgba.load()
    for y in range(0, h, step):
        for x in range(0, w, step):
            total += 1
            if px[x, y][3] < alpha_threshold:
                transparent += 1
    return bool(total and (transparent / total) >= min_ratio)


def _dematte_black_to_alpha(im, *, thr: int = 20):
    """ELEMENTY/AI export: czarne matte (opaque RGB ~0) -> alpha=0.

    Nie rusza plikow z prawdziwym alpha (np. Liście z tRNS).
    Nie zapisuje na dysk - tylko podglad w pamieci.
    """
    rgba = im.convert("RGBA") if im.mode != "RGBA" else im.copy()
    if _rgba_sample_has_transparency(rgba):
        return rgba
    w, h = rgba.size
    if w < 2 or h < 2:
        return rgba
    px = rgba.load()
    corners = (px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1])
    if not all(max(c[0], c[1], c[2]) <= thr and c[3] > 200 for c in corners):
        return rgba
    out = rgba.copy()
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = opx[x, y]
            if a > 0 and r <= thr and g <= thr and b <= thr:
                opx[x, y] = (r, g, b, 0)
    return out


def _image_to_png_preview_bytes(im, *, dematte: bool = True) -> bytes:
    """PNG/WebP preview: zachowaj alpha; opcjonalnie zdejmij czarne matte; downscale."""
    import io

    from PIL import Image  # type: ignore

    rgba = _dematte_black_to_alpha(im) if dematte else (
        im.convert("RGBA") if im.mode != "RGBA" else im.copy()
    )
    max_side = 1600
    if max(rgba.size) > max_side:
        rgba.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    rgba.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _media_preview_jpeg(target: str) -> tuple[int, bytes, str] | None:
    """Konwersja TIFF/PSD/PSB/BMP do JPEG pod podglad w przegladarce."""
    ext = Path(target).suffix.lower()
    if ext not in _PREVIEW_RASTER_EXT:
        return None
    try:
        from PIL import Image  # type: ignore

        im = None
        try:
            with Image.open(target) as pil_im:
                im = pil_im.copy()
        except Exception:
            if ext in {".psd", ".psb"}:
                from psd_tools import PSDImage  # type: ignore

                im = PSDImage.open(target).composite()
            else:
                raise
        if im is None:
            return None
        return 200, _image_to_jpeg_bytes(im), "image/jpeg"
    except Exception:
        return None


def _media_preview_png(target: str, *, dematte: bool = True) -> tuple[int, bytes, str] | None:
    """PNG/WebP preview z alpha (dematte czarnego matte z eksportow ELEMENTY)."""
    ext = Path(target).suffix.lower()
    if ext not in _PREVIEW_ALPHA_EXT:
        return None
    try:
        mtime = os.path.getmtime(target)
        size = os.path.getsize(target)
        cache_key = f"{target}|{int(mtime)}|{size}|dematte={int(dematte)}"
        hit = _MATTE_PNG_CACHE.get(cache_key)
        if hit and hit[0] == mtime and hit[1] == size:
            return 200, hit[2], "image/png"
        from PIL import Image  # type: ignore

        with Image.open(target) as pil_im:
            im = pil_im.copy()
        body = _image_to_png_preview_bytes(im, dematte=dematte)
        if len(_MATTE_PNG_CACHE) >= _MATTE_PNG_CACHE_MAX:
            # FIFO-ish: drop arbitrary oldest key
            try:
                _MATTE_PNG_CACHE.pop(next(iter(_MATTE_PNG_CACHE)))
            except StopIteration:
                pass
        _MATTE_PNG_CACHE[cache_key] = (mtime, size, body)
        return 200, body, "image/png"
    except Exception:
        return None


_VIDEO_POSTER_PLACEHOLDER_SVG = (
    b'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img">'
    b'<rect width="640" height="360" fill="#ececf2"/>'
    b'<circle cx="320" cy="168" r="42" fill="#c5c6cd"/>'
    b'<path d="M308 148 L308 188 L348 168 Z" fill="#fff"/>'
    b'<text x="320" y="248" text-anchor="middle" fill="#696877" '
    b'font-family="Segoe UI,Arial,sans-serif" font-size="22">Wideo</text>'
    b"</svg>"
)


def _media_video_poster_placeholder() -> tuple[int, bytes, str]:
    """Twardy fallback gdy ffmpeg nie wyciagnie klatki (B3)."""
    return 200, _VIDEO_POSTER_PLACEHOLDER_SVG, "image/svg+xml"


def _media_video_duration_sec(target: str) -> float | None:
    """Czas trwania wideo (ffprobe); None gdy niedostepne."""
    try:
        import subprocess

        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                target,
            ],
            check=True,
            capture_output=True,
            timeout=30,
            text=True,
        )
        val = float((proc.stdout or "").strip() or "0")
        return val if val > 0 else None
    except Exception:
        return None


def _media_video_poster(target: str) -> tuple[int, bytes, str] | None:
    """Klatka z wideo jako JPEG (~25% czasu trwania; fallback 0.5s)."""
    ext = Path(target).suffix.lower()
    if ext not in _VIDEO_EXT:
        return None
    try:
        import subprocess
        import tempfile

        dur = _media_video_duration_sec(target)
        if dur and dur > 1.0:
            seek_sec = max(0.25, dur * 0.25)
        else:
            seek_sec = 0.5
        seek_arg = f"{seek_sec:.3f}"

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            out = tmp.name
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-ss",
                    seek_arg,
                    "-i",
                    target,
                    "-frames:v",
                    "1",
                    "-q:v",
                    "3",
                    out,
                ],
                check=True,
                capture_output=True,
                timeout=90,
            )
            with open(out, "rb") as fh:
                data = fh.read()
            if not data:
                return None
            return 200, data, "image/jpeg"
        finally:
            try:
                os.unlink(out)
            except OSError:
                pass
    except Exception:
        return None
    return None


_MEDIA_PATH_INDEX_RE = re.compile(r"(?<!\d)(\d{7})(?:\.\d{2})?(?!\d)")
_MEDIA_REV_HINT_RE = re.compile(
    r"(KAR|MINI|MIX|FOL|\d{2}[.\s/-]\d{2}[.\s/-]\d{2,4})",
    re.IGNORECASE,
)


def _resolve_missing_media_path(raw: str) -> str | None:
    """Gdy sciezka z indeksu jest nieaktualna (np. rewizja dostala 'PL EN'), znajdz plik na dysku.

    Typowy drift: index ma `KAR6X - 20.05.2026 - 6300785.00 - F`, dysk ma
    `KAR6X - 20.05.2026  - PL EN - 6300785.00 - F`. Szukamy siblinga rewizji
    z tym samym indeksem i tym samym ogonem (ELEMENTY/Links/...).
    """
    if not raw:
        return None
    target = Path(normalize_path(raw))
    try:
        if target.is_file():
            return str(target)
    except OSError:
        pass

    parts = list(target.parts)
    if len(parts) < 3:
        return None

    rev_i = None
    index = None
    for i, part in enumerate(parts):
        m = _MEDIA_PATH_INDEX_RE.search(part)
        if not m:
            continue
        if _MEDIA_REV_HINT_RE.search(part) or (i + 1 < len(parts) and parts[i + 1][:1].isdigit()):
            rev_i = i
            index = m.group(1)
            # prefer deepest revision-like segment
    if rev_i is None:
        # fallback: last segment containing 7-digit index that is not the filename
        for i in range(len(parts) - 2, 0, -1):
            m = _MEDIA_PATH_INDEX_RE.search(parts[i])
            if m:
                rev_i = i
                index = m.group(1)
                break
    if rev_i is None or rev_i < 1:
        return None

    product_dir = Path(*parts[:rev_i])
    try:
        if not product_dir.is_dir():
            # climb to first existing ancestor (max 4 levels)
            cur = product_dir
            found = None
            for _ in range(4):
                if cur.parent == cur:
                    break
                cur = cur.parent
                try:
                    if cur.is_dir():
                        found = cur
                        break
                except OSError:
                    break
            if found is None:
                return None
            product_dir = found
    except OSError:
        return None

    tail_parts = parts[rev_i + 1 :]
    if not tail_parts:
        return None
    filename = parts[-1]
    old_rev = parts[rev_i]
    carrier = (old_rev.split(" - ")[0] or "").strip().lower()

    try:
        siblings = [p for p in product_dir.iterdir() if p.is_dir()]
    except OSError:
        return None

    ranked: list[tuple[int, Path]] = []
    for sib in siblings:
        score = 0
        name_l = sib.name.lower()
        if index and index in sib.name:
            score += 10
        if carrier and carrier in name_l:
            score += 3
        if score:
            ranked.append((score, sib))
    ranked.sort(key=lambda x: (-x[0], len(x[1].name)))

    slot_fallbacks = (
        Path("1 - MATERIAŁY") / "ELEMENTY" / filename,
        Path("1 - MATERIALY") / "ELEMENTY" / filename,
        Path("2 - PROJEKT") / "Links" / filename,
        Path("2 - PROJEKT") / "links" / filename,
    )

    for score, sib in ranked:
        if index and score < 10:
            continue
        if tail_parts:
            cand = sib.joinpath(*tail_parts)
            try:
                if cand.is_file() and _is_under_marketing(cand):
                    return str(cand)
            except OSError:
                pass
        for sub in slot_fallbacks:
            cand2 = sib / sub
            try:
                if cand2.is_file() and _is_under_marketing(cand2):
                    return str(cand2)
            except OSError:
                pass

    # Last resort: shallow name match under index-matching revisions only
    for score, sib in ranked:
        if index and score < 10:
            continue
        try:
            for hit in sib.rglob(filename):
                try:
                    if hit.is_file() and _is_under_marketing(hit):
                        return str(hit)
                except OSError:
                    continue
        except OSError:
            continue
    return None


def _coerce_media_target(path: str, email: str = "") -> str:
    """Exact path, device-scoped rebase, or fuzzy resolve when index drifted."""
    if dam_path_resolve_mod is not None:
        return dam_path_resolve_mod.resolve_physical_path(
            path,
            email,
            normalize_path=normalize_path,
            resolve_base_path=resolve_base_path_for_current_device,
            marketing_candidates=MARKETING_CANDIDATES,
            machine_config_path=MACHINE_CONFIG,
            fuzzy_resolve=_resolve_missing_media_path,
        )
    target = normalize_path(path)
    try:
        if os.path.isfile(target):
            return target
    except OSError:
        pass
    resolved = _resolve_missing_media_path(target)
    return resolved or target


def serve_media(path: str, preview: bool = False, matte: bool = False) -> tuple[int, bytes, str]:
    """Zwraca (code, body, content_type). Dla wideo preferuj serve_media_range.

    matte/preview dla PNG w folderze ELEMENTY: dematte czarnego tla -> alpha PNG.
    """
    target = _coerce_media_target(path)
    if not os.path.isfile(target):
        return 404, b"", "application/json"
    if not _is_under_marketing(Path(target)):
        return 403, b"", "application/json"
    ext = Path(target).suffix.lower()
    mime = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".webm": "video/webm",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
        ".m4v": "video/mp4",
    }.get(ext)
    # ELEMENTY PNG: auto-dematte (nawet bez preview=1) — pliki maja czarne matte bez alpha.
    want_matte = bool(matte) or (
        ext == ".png" and _path_is_elementy_folder(target)
    )
    if preview or want_matte:
        if preview and ext in _PREVIEW_RASTER_EXT:
            converted = _media_preview_jpeg(target)
            if converted:
                return converted
            return 422, b"", "application/json"
        if ext in _PREVIEW_ALPHA_EXT and (preview or want_matte):
            converted = _media_preview_png(target, dematte=want_matte or preview)
            if converted:
                return converted
            if preview:
                return 422, b"", "application/json"
        if preview and ext in _VIDEO_EXT:
            poster = _media_video_poster(target)
            if poster:
                return poster
            # B3: twardy fallback zamiast 422 — JS tez ma data-URI placeholder
            return _media_video_poster_placeholder()
    if not mime:
        return 415, b"", "application/json"
    try:
        size = os.path.getsize(target)
        limit = _MEDIA_VIDEO_MAX_BYTES if ext in _VIDEO_EXT else _MEDIA_MAX_BYTES
        if size > limit:
            return 413, b"", "application/json"
    except OSError:
        return 404, b"", "application/json"
    # TIFF often unsupported in browsers - still serve; client may fallback
    with open(target, "rb") as fh:
        return 200, fh.read(), mime


def _parse_bytes_range(header: str, size: int) -> tuple[int, int] | None:
    """RFC 7233 bytes=start-end → (start, end_inclusive)."""
    if not header or not header.startswith("bytes="):
        return None
    spec = header[6:].strip()
    if "," in spec:
        spec = spec.split(",", 1)[0].strip()
    if "-" not in spec:
        return None
    start_s, end_s = spec.split("-", 1)
    try:
        if start_s == "":
            # suffix: last N bytes
            length = int(end_s)
            if length <= 0:
                return None
            start = max(0, size - length)
            end = size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s else size - 1
    except ValueError:
        return None
    if start < 0 or start >= size:
        return None
    end = min(end, size - 1)
    if end < start:
        return None
    return start, end


def media_meta(path: str) -> dict:
    """Read width/height/mode/colorspace/size for a local image (PIL)."""
    target = _coerce_media_target(path)
    if not os.path.isfile(target):
        return {"ok": False, "error": "not_found", "path": target}
    if not _is_under_marketing(Path(target)):
        return {"ok": False, "error": "path_outside_marketing", "path": target}
    size_bytes = os.path.getsize(target)
    out: dict = {
        "ok": True,
        "path": target,
        "size_bytes": size_bytes,
        "ext": Path(target).suffix.lower().lstrip("."),
        "width": None,
        "height": None,
        "mode": None,
        "colorspace": None,
        "dpi": None,
        "format": None,
    }
    try:
        from PIL import Image  # type: ignore

        with Image.open(target) as im:
            out["width"], out["height"] = im.size
            out["mode"] = im.mode
            out["format"] = im.format
            dpi = im.info.get("dpi")
            if dpi:
                out["dpi"] = dpi
            # Heuristic color space
            mode = (im.mode or "").upper()
            if mode in ("CMYK",):
                out["colorspace"] = "CMYK"
            elif mode in ("RGB", "RGBA", "P", "LA", "L"):
                out["colorspace"] = "RGB" if mode != "L" else "Grayscale"
                if mode in ("RGBA", "LA") or (mode == "P" and "transparency" in im.info):
                    out["has_alpha"] = True
            else:
                out["colorspace"] = mode or "unknown"
            if "icc_profile" in im.info:
                out["has_icc"] = True
    except Exception as exc:  # noqa: BLE001
        out["pil_error"] = str(exc)
    return out


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[dam-bridge]", fmt % args)

    def _origin_ok(self) -> bool:
        """CORS: tylko UI origin (albo brak Origin = same-origin / narzedzia lokalne)."""
        origin = (self.headers.get("Origin") or "").strip()
        if not origin:
            return True
        return origin.rstrip("/") == CORS_ORIGIN.rstrip("/")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", CORS_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Vary", "Origin")

    def _json(self, code: int, payload: dict | list):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        encoding = None
        accept = (self.headers.get("Accept-Encoding") or "").lower()
        if len(body) > 8192 and "gzip" in accept:
            body = gzip.compress(body, compresslevel=6)
            encoding = "gzip"
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        if encoding:
            self.send_header("Content-Encoding", encoding)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _bytes(self, code: int, body: bytes, content_type: str):
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "private, max-age=60")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):  # noqa: N802
        if not self._origin_ok():
            self.send_response(403)
            self.end_headers()
            return
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _bearer(self) -> str:
        auth = self.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            return auth[7:].strip()
        return ""

    def _session_user(self) -> dict | None:
        """User z Bearer tokena (Postgres/SQLite). None = brak / niewazna sesja."""
        res = resolve_session(self._bearer())
        if not res.get("ok"):
            return None
        user = res.get("user") or {}
        if not user.get("email") and not user.get("role"):
            return None
        return user

    def _require_login(self) -> dict | None:
        user = self._session_user()
        if not user:
            self._json(
                401,
                {
                    "ok": False,
                    "error": "login_required",
                    "hint": "Zaloguj sie - zgłoszenia i zapis wymagają sesji.",
                },
            )
            return None
        return user

    def _require_admin(self) -> dict | None:
        user = self._require_login()
        if user is None:
            return None
        if (user.get("role") or "").strip().lower() != "admin":
            self._json(
                403,
                {
                    "ok": False,
                    "error": "admin_required",
                    "hint": (
                        "Tylko admin zatwierdza zmiany w bazie / na dysku. "
                        "Użytkownik może tylko zgłosić propozycję (JSON w kolejce)."
                    ),
                },
            )
            return None
        return user

    def _require_power_user_or_admin(self) -> dict | None:
        user = self._require_login()
        if user is None:
            return None
        role = (user.get("role") or "").strip().lower()
        if role not in ("admin", "power_user"):
            self._json(
                403,
                {
                    "ok": False,
                    "error": "power_user_or_admin_required",
                    "hint": "Sync Asana wymaga roli power_user lub admin.",
                },
            )
            return None
        return user

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        # OAuth callback moze przyjsc z Origin zewnetrznego IdP - nie blokuj.
        if parsed.path != "/oauth/callback" and not self._origin_ok():
            self._json(403, {"ok": False, "error": "origin_forbidden"})
            return
        if parsed.path == "/health":
            redis_info = dam_redis.status() if dam_redis else {"redis": "down", "circuit": "open", "reason": "module_missing"}
            warm_info = dam_thumb_cache_mod.warm_status() if dam_thumb_cache_mod else {}
            circuit = redis_info.get("circuit") or "open"
            redis_state = redis_info.get("redis") or "down"
            self._json(
                200,
                {
                    "ok": True,
                    "service": "dam-local-bridge",
                    "port": PORT,
                    "api_version": BRIDGE_API_VERSION,
                    "redis_status": redis_state,
                    "redis_circuit": circuit,
                    "redis_detail": redis_info,
                    "redis": {
                        "ok": redis_state == "ok",
                        "circuit": circuit,
                        "state": redis_state,
                        "detail": redis_info,
                    },
                    "warm": warm_info,
                    "redis_fallback_matrix": dam_redis.fallback_matrix() if dam_redis else [],
                    "hub_routes": [
                        "/branding-index",
                        "/branding-search-index",
                        "/branding-search-picker",
                        "/branding-for-product",
                        "/product-catalog",
                        "/bulk-packaging",
                        "/branding/status",
                        "/wykrojniki-registry",
                        "/wykrojnik-mapping-queue",
                        "/sleeve-stock",
                        "/sleeve-stock/reimport",
                        "/sleeve-stock/import",
                        "/production-cost-catalog",
                        "/integrations/config",
                        "/integrations/status",
                        "/integrations/asana/sync",
                        "/finance/cost-rates",
                        "/finance/fmcg-catalog",
                        "/finance/fmcg-import",
                        "/finance/fmcg-import-map",
                        "/finance/fmcg-compute",
                        "/finance/project-costs",
                        "/finance/invoices",
                        "/finance/invoices/import",
                        "/finance/invoices/export",
                        "/finance/invoices/erp-status",
                        "/finance/invoices/outlook-draft",
                        "/file-availability",
                        "/thumb-cache",
                        "/thumb-cache/warm",
                    ],
                },
            )
            return
        if parsed.path == "/file-availability":
            # Localhost jail - Bearer optional (img/onerror paths); UDP email when present
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            paths_raw = (qs.get("paths") or [""])[0]
            user = self._session_user()
            email = str((user or {}).get("email") or "").strip()
            has_root = None
            if email:
                try:
                    has_root = bool(resolve_base_path_for_current_device(email).get("has_path"))
                except Exception:
                    has_root = None
            elif not resolve_base_path_for_current_device("").get("has_path"):
                # machine-config may still set base
                try:
                    mc = read_machine_config()
                    has_root = bool((mc.get("base_path") or "").strip()) if isinstance(mc, dict) else None
                except Exception:
                    has_root = None
            if dam_file_availability_mod is None:
                self._json(500, {"ok": False, "error": "module_missing"})
                return

            def _resolve(p: str, em: str = "") -> str:
                return _coerce_media_target(p, em or email)

            if paths_raw:
                plist = [p.strip() for p in paths_raw.split("|") if p.strip()]
                self._json(
                    200,
                    dam_file_availability_mod.classify_batch(
                        plist,
                        email=email,
                        resolve_physical=_resolve,
                        has_marketing_root=has_root,
                    ),
                )
                return
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(
                200,
                dam_file_availability_mod.classify_path(
                    path,
                    email=email,
                    resolve_physical=_resolve,
                    has_marketing_root=has_root,
                ),
            )
            return
        if parsed.path == "/thumb-cache":
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            profile = (qs.get("profile") or ["grid"])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            if dam_thumb_cache_mod is None:
                self._json(500, {"ok": False, "error": "module_missing"})
                return
            target = _coerce_media_target(path)
            if not os.path.isfile(target) or not _is_under_marketing(Path(target)):
                self._json(403 if os.path.isfile(target) else 404, {"ok": False, "error": "path_outside_marketing" if os.path.isfile(target) else "not_found", "path": path})
                return

            def _resolve(p: str, em: str = "") -> str:
                return _coerce_media_target(p, em)

            def _rel(p: str, em: str = "") -> str:
                if dam_path_resolve_mod is None:
                    return Path(p).name
                return dam_path_resolve_mod.marketing_relative_key(
                    p,
                    email=em,
                    resolve_base_path=resolve_base_path_for_current_device,
                    marketing_candidates=MARKETING_CANDIDATES,
                    machine_config_path=MACHINE_CONFIG,
                )

            t0 = time.time()
            code, body, ctype, meta = dam_thumb_cache_mod.get_or_build_thumb(
                path,
                profile=profile,
                resolve_physical=_resolve,
                marketing_relative=_rel,
            )
            meta["ms"] = int((time.time() - t0) * 1000)
            if code != 200:
                self._json(code if code in (403, 404, 422) else 404, {"ok": False, "error": meta.get("error") or "thumb_failed", "path": path, **meta})
                return
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "private, max-age=86400")
            self.send_header("X-DAM-Cache-Hit", "1" if meta.get("cache_hit") else "0")
            self.send_header("X-DAM-Thumb-Ms", str(meta.get("ms") or 0))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/detect-marketing-bases":
            # Lokalny most 127.0.0.1 - status dysku bez Bearer (UI pyta przed / bez sesji)
            self._json(200, detect_marketing_bases())
            return
        if parsed.path == "/machine-config":
            self._json(200, read_machine_config())
            return
        if parsed.path == "/user-device-paths":
            user = self._require_login()
            if user is None:
                return
            email = str(user.get("email") or "").strip()
            self._json(200, list_user_device_paths(email))
            return
        if parsed.path == "/user-device-paths/current":
            user = self._require_login()
            if user is None:
                return
            email = str(user.get("email") or "").strip()
            self._json(200, resolve_base_path_for_current_device(email))
            return
        if parsed.path == "/user-prefs":
            user = self._require_login()
            if user is None:
                return
            email = str(user.get("email") or "").strip()
            self._json(200, read_user_prefs(email))
            return
        if parsed.path == "/auth/registration-open":
            # Publiczny (localhost): czy UI moze pokazac "Utworz konto".
            n = users_count()
            self._json(200, {"ok": True, "open": n == 0, "users": n})
            return
        if parsed.path == "/auth/identity":
            try:
                from machine_identity import collect_identity, write_identity_runtime

                ident = collect_identity()
                write_identity_runtime(ident)
                self._json(200, ident)
            except Exception as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/auth/me":
            qs = parse_qs(parsed.query)
            device_id = (qs.get("device_id") or [""])[0]
            machine_id = (qs.get("machine_id") or [""])[0]
            res = resolve_session(self._bearer(), device_id, machine_id)
            self._json(200 if res.get("ok") else 401, res)
            return
        if parsed.path == "/auth/users":
            # lista kont (bez hasel) - tylko gdy sesja admina
            me = resolve_session(self._bearer())
            if not me.get("ok") or (me.get("user") or {}).get("role") != "admin":
                self._json(403, {"ok": False, "error": "admin_required"})
                return
            self._json(200, {"ok": True, "users": list_users()})
            return
        if parsed.path == "/files/status":
            # Status ROOT plikow - bez loginu (pill "Pliki online/offline")
            qs = parse_qs(parsed.query)
            root = (qs.get("root") or [""])[0].strip()
            if not root:
                self._json(400, {"ok": False, "online": False, "error": "root_required"})
                return
            info = validate_base(root)
            online = bool(info.get("ok"))
            # Dodatkowy probe: czy da sie listowac POLSKA
            probe_ok = False
            if online:
                try:
                    polska = Path(normalize_path(root)) / "- POLSKA"
                    probe_ok = polska.is_dir() and any(polska.iterdir())
                except OSError:
                    probe_ok = False
            self._json(
                200,
                {
                    "ok": True,
                    "online": online and probe_ok,
                    "root": info.get("path") or root,
                    "missing": info.get("missing") or [],
                    "probe": "list_-POLSKA",
                    "probe_ok": probe_ok,
                },
            )
            return
        if parsed.path == "/audit":
            if self._require_login() is None:
                return
            qs = parse_qs(parsed.query)
            limit = int((qs.get("limit") or ["100"])[0])
            self._json(200, {"ok": True, "items": read_audit(max(1, min(limit, 500)))})
            return
        if parsed.path == "/index/status":
            self._json(200, index_status())
            return
        if parsed.path == "/meta/status":
            try:
                import meta_store

                self._json(200, meta_store.status())
            except Exception as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/folder-images":
            # Odczyt lokalny Marketing (jail) - img/fetch bez Bearer
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required", "files": []})
                return
            self._json(200, list_folder_images(path))
            return
        if parsed.path == "/folder-browse":
            # Odczyt lokalny Marketing (jail) - picker bez Bearer
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            mode = (qs.get("mode") or ["assets"])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required", "files": [], "folders": []})
                return
            self._json(200, list_folder_browse(path, mode=mode))
            return
        if parsed.path in ("/db/status", "/pg/status"):
            # Pill "Baza online/offline" - bez Bearera (localhost)
            self._json(200, dam_db.status() if dam_db else {"ok": False, "error": "dam_db_missing"})
            return
        if parsed.path == "/db/prefer":
            if not dam_db:
                self._json(500, {"ok": False, "error": "dam_db_missing"})
                return
            self._json(200, {"ok": True, "prefer": dam_db.load_prefer()})
            return
        if parsed.path == "/media":
            # Miniatury w <img src> nie moga wyslac Authorization - localhost + jail Marketing
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            preview = (qs.get("preview") or ["0"])[0].strip().lower() in ("1", "true", "yes")
            matte = (qs.get("matte") or ["0"])[0].strip().lower() in ("1", "true", "yes")
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            target = _coerce_media_target(path)
            ext = Path(target).suffix.lower() if target else ""
            range_hdr = self.headers.get("Range") or ""
            # Wideo: Range + stream bez wczytywania calego pliku do RAM
            if (
                not preview
                and not matte
                and ext in _VIDEO_EXT
                and os.path.isfile(target)
                and _is_under_marketing(Path(target))
            ):
                try:
                    size = os.path.getsize(target)
                except OSError:
                    self._json(404, {"ok": False, "error": "not_found", "path": path})
                    return
                if size > _MEDIA_VIDEO_MAX_BYTES:
                    self._json(413, {"ok": False, "error": "file_too_large", "path": path})
                    return
                mime = {
                    ".mp4": "video/mp4",
                    ".mov": "video/quicktime",
                    ".webm": "video/webm",
                    ".avi": "video/x-msvideo",
                    ".mkv": "video/x-matroska",
                    ".m4v": "video/mp4",
                }.get(ext, "application/octet-stream")
                rng = _parse_bytes_range(range_hdr, size) if range_hdr else None
                if rng:
                    start, end = rng
                    length = end - start + 1
                    self.send_response(206)
                    self._cors()
                    self.send_header("Content-Type", mime)
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                    self.send_header("Content-Length", str(length))
                    self.send_header("Cache-Control", "private, max-age=60")
                    self.end_headers()
                    with open(target, "rb") as fh:
                        fh.seek(start)
                        remaining = length
                        while remaining > 0:
                            chunk = fh.read(min(1024 * 256, remaining))
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            remaining -= len(chunk)
                    return
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", mime)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(size))
                self.send_header("Cache-Control", "private, max-age=60")
                self.end_headers()
                with open(target, "rb") as fh:
                    while True:
                        chunk = fh.read(1024 * 256)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                return
            code, body, ctype = serve_media(path, preview=preview, matte=matte)
            if code != 200:
                err = {
                    403: "path_outside_marketing",
                    413: "file_too_large",
                    415: "unsupported_media",
                    422: "preview_failed",
                }.get(code, "not_found")
                self._json(code if code in (403, 413, 415, 422) else 404, {"ok": False, "error": err, "path": path})
                return
            self._bytes(200, body, ctype)
            return
        if parsed.path == "/media-meta":
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, media_meta(path))
            return
        if parsed.path == "/tag-proposals":
            if self._require_login() is None:
                return
            auto_apply_expired_proposals()
            self._json(200, load_tag_proposals())
            return
        if parsed.path == "/change-log":
            # Log operacji na dysku - tylko admin (UI Historia / pasek Dysk).
            if self._require_admin() is None:
                return
            qs = parse_qs(parsed.query)
            limit = int((qs.get("limit") or ["40"])[0])
            self._json(200, load_change_log(limit))
            return
        if parsed.path == "/program-instructions":
            data = _load_json(PROGRAM_INSTRUCTIONS_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "program_instructions_missing"})
                return
            qs = parse_qs(parsed.query)
            cat = (qs.get("category") or [""])[0].strip().lower()
            pri = (qs.get("priority") or [""])[0].strip().lower()
            items = list(data.get("instructions") or [])
            if cat:
                items = [i for i in items if str((i or {}).get("category") or "").lower() == cat]
            if pri:
                items = [i for i in items if str((i or {}).get("priority") or "").lower() == pri]
            self._json(
                200,
                {
                    "ok": True,
                    "version": data.get("version"),
                    "updated_at": data.get("updated_at"),
                    "title_pl": data.get("title_pl"),
                    "description_pl": data.get("description_pl"),
                    "source_of_truth": data.get("source_of_truth"),
                    "count": len(items),
                    "instructions": items,
                },
            )
            return
        if parsed.path == "/lifecycle-status":
            if self._require_login() is None:
                return
            if lifecycle_status_mod is None:
                self._json(500, {"ok": False, "error": "lifecycle_module_missing"})
                return
            store = lifecycle_status_mod.load_lifecycle_store(LIFECYCLE_STORE_FILE)
            self._json(200, {"ok": True, **store})
            return
        if parsed.path == "/lifecycle-reconcile":
            # pull = sync JSON z dysku (login); boot/mtime moze przenosic X -> tylko admin
            qs = parse_qs(parsed.query)
            mode = ((qs.get("mode") or ["pull"])[0] or "pull").strip().lower()
            if mode in ("boot", "startup", "mtime"):
                user = self._require_admin()
            else:
                user = self._require_login()
            if user is None:
                return
            if lifecycle_status_mod is None:
                self._json(500, {"ok": False, "error": "lifecycle_module_missing"})
                return
            pid_filter = ((qs.get("product_id") or [""])[0] or "").strip() or None
            actor = (user.get("email") or user.get("name") or "reconcile") if isinstance(user, dict) else "reconcile"
            if mode in ("boot", "startup", "mtime"):
                result = lifecycle_status_mod.reconcile_lifecycle_on_boot(
                    store_path=LIFECYCLE_STORE_FILE,
                    file_index_path=INDEX_FILE,
                    actor=str(actor),
                    product_id_filter=pid_filter,
                    enforce_moves=True,
                    append_change_log=append_change_log,
                )
            else:
                result = lifecycle_status_mod.pull_lifecycle_from_disk(
                    store_path=LIFECYCLE_STORE_FILE,
                    file_index_path=INDEX_FILE,
                    actor=str(actor),
                    product_id_filter=pid_filter,
                )
            # nie zwracaj calego store w body (duzy) - UI i tak przeladuje
            body = {k: v for k, v in result.items() if k != "store"}
            body["ok"] = bool(result.get("ok"))
            self._json(200 if body.get("ok") else 400, body)
            return
        if parsed.path == "/tag-proposals/timeline":
            if self._require_login() is None:
                return
            qs = parse_qs(parsed.query)
            pid = (qs.get("proposal_id") or [""])[0].strip()
            result = build_change_timeline_for_proposal(pid)
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/carrier-assignment":
            if self._require_login() is None:
                return
            # Discrepancy: dysk vs ostatnie zatwierdzenie
            qs = parse_qs(parsed.query)
            rev = (qs.get("path") or qs.get("revision_path") or [""])[0].strip()
            disk = (qs.get("disk_carrier") or [""])[0].strip().upper()
            last = get_last_assignment(rev) if rev else None
            assigned = ((last or {}).get("carrier_code") or "").strip().upper()
            discrepancy = bool(assigned and disk and assigned != disk and assigned not in ("NONE", "BRAK"))
            self._json(200, {
                "ok": True,
                "revision_path": rev,
                "disk_carrier": disk,
                "assigned_carrier": assigned,
                "discrepancy": discrepancy,
                "last": last,
                "tip": (
                    f"Wczesniej zatwierdzono {assigned}, na dysku jest {disk}."
                    if discrepancy
                    else ""
                ),
            })
            return
        if parsed.path == "/carrier-types":
            if self._require_login() is None:
                return
            self._json(200, _load_json(CARRIER_TYPES_FILE, {"custom_types": {}, "deleted_types": {}}))
            return
        if parsed.path == "/explorer/next-category-seq":
            # Read-only: podpowiedz numeru kolejnej kategorii (edytowalny licznik w UI)
            user = self._require_admin()
            if user is None:
                return
            if explorer_create_mod is None:
                self._json(500, {"ok": False, "error": "explorer_create_module_missing"})
                return
            qs = parse_qs(parsed.query or "")
            brand_val = (qs.get("brand") or ["DK"])[0]
            email = str(user.get("email") or "").strip()
            resolved = resolve_base_path_for_current_device(email)
            base = str(resolved.get("base_path") or "").strip()
            if not base:
                self._json(400, {"ok": False, "error": "marketing_base_unset"})
                return
            result = explorer_create_mod.next_category_seq_for_brand(base, brand_val)
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/inbox-items":
            if self._require_login() is None:
                return
            self._json(200, _load_json(INBOX_ITEMS_FILE, {"items": []}))
            return
        if parsed.path == "/integrations/status":
            if self._require_login() is None:
                return
            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            self._json(200, oauth_integrations.status())
            return
        if parsed.path == "/notification-groups":
            if self._require_login() is None:
                return
            groups = _load_json(NOTIFICATION_GROUPS_FILE, {})
            # Nie zwracaj meta-kluczy typu _readme jako grupy
            clean = {
                k: v
                for k, v in (groups or {}).items()
                if isinstance(v, list) and not str(k).startswith("_")
            }
            self._json(200, {"ok": True, "groups": clean})
            return
        if parsed.path == "/oauth/callback":
            # Redirect z Asana / Microsoft - wymiana code, potem HTML z komunikatem
            import html as _html

            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            qs = parse_qs(parsed.query)
            code = (qs.get("code") or [""])[0]
            state = (qs.get("state") or [""])[0]
            err = (qs.get("error") or [""])[0]
            ui_origin = (CORS_ORIGIN or "http://127.0.0.1:8765").rstrip("/")
            integrations_url = ui_origin + "/integrations.html"
            integrations_hash = integrations_url + "#damIntegrationsOAuth"
            settings_url = ui_origin + "/settings.html#damIntegrations"
            if err:
                safe_err = _html.escape(str(err)[:500])
                safe_integrations = _html.escape(integrations_hash)
                page = (
                    "<!doctype html><meta charset=utf-8><title>OAuth</title>"
                    f"<h1>Logowanie przerwane</h1><p>{safe_err}</p>"
                    f'<p><a href="{safe_integrations}">Wroc do Integracji</a></p>'
                )
                self._bytes(400, page.encode("utf-8"), "text/html; charset=utf-8")
                return
            result = oauth_integrations.complete_callback(code, state)
            ok = result.get("ok")
            safe_provider = _html.escape(str(result.get("provider") or "")[:120])
            safe_msg = _html.escape(str(result.get("error") or "OK")[:500])
            safe_integrations = _html.escape(integrations_hash)
            safe_settings = _html.escape(settings_url)
            page = (
                "<!doctype html><meta charset=utf-8><title>OAuth</title>"
                f"<h1>{'Polaczono' if ok else 'Blad OAuth'}</h1>"
                f"<p>{safe_provider} - {safe_msg}</p>"
                f'<p><a href="{safe_integrations}">Wroc do Integracji</a>'
                f' · <a href="{safe_settings}">Ustawienia</a></p>'
                f"<script>setTimeout(function(){{location.href={json.dumps(integrations_hash)}}},1500)</script>"
            )
            self._bytes(200 if ok else 400, page.encode("utf-8"), "text/html; charset=utf-8")
            return
        if parsed.path == "/product-catalog":
            data = _load_json(PRODUCT_CATALOG_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "product_catalog_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/product-price":
            qs = parse_qs(parsed.query)
            product_id = (qs.get("product_id") or [""])[0].strip()
            if not product_id:
                self._json(400, {"ok": False, "error": "product_id_required"})
                return
            cache = _load_json(PRODUCT_PRICES_CACHE_FILE, {"products": {}})
            hit = (cache.get("products") or {}).get(product_id)
            if not hit and FETCH_PRODUCT_PRICES.is_file():
                try:
                    _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
                    subprocess.call(
                        [sys.executable, str(FETCH_PRODUCT_PRICES), "--product-id", product_id],
                        creationflags=_no_win,
                    )
                    cache = _load_json(PRODUCT_PRICES_CACHE_FILE, {"products": {}})
                    hit = (cache.get("products") or {}).get(product_id)
                except OSError:
                    pass
            if not hit:
                self._json(404, {"ok": False, "error": "price_not_found", "product_id": product_id})
                return
            self._json(200, {"ok": True, "product_id": product_id, **hit})
            return
        if parsed.path == "/bulk-packaging":
            data = _load_json(BULK_PACKAGING_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "bulk_packaging_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/shop-categories":
            data = _load_json(SHOP_CATEGORIES_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "shop_categories_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/branding-index":
            data = _load_json(BRANDING_INDEX_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "branding_index_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/branding-for-product":
            qs = parse_qs(parsed.query or "")
            tokens = [
                t.strip()
                for t in (qs.get("tokens") or [""])[0].split(",")
                if t.strip()
            ]
            try:
                lim = int((qs.get("limit") or ["400"])[0])
            except Exception:
                lim = 400
            self._json(
                200,
                resolve_branding_for_product(
                    (qs.get("product_id") or [""])[0],
                    tokens,
                    lim,
                    (qs.get("include_archive") or ["0"])[0] in ("1", "true"),
                    (qs.get("sort") or [""])[0],
                ),
            )
            return
        if parsed.path == "/product-links-elementy":
            # STREFA A3: Links (surowe) vs ELEMENTY (gotowe) dla rewizji produktu
            qs = parse_qs(parsed.query or "")
            self._json(
                200,
                resolve_product_links_elementy(
                    (qs.get("product_id") or [""])[0],
                    (qs.get("index") or [""])[0],
                    (qs.get("revision_path") or [""])[0],
                ),
            )
            return
        if parsed.path == "/branding-search-index":
            data = _load_json(BRANDING_SEARCH_INDEX_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "branding_search_index_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/branding-search-picker":
            qs = parse_qs(parsed.query or "")
            q = (qs.get("q") or [""])[0]
            try:
                lim = int((qs.get("limit") or ["80"])[0])
            except (TypeError, ValueError):
                lim = 80
            raw_include = (qs.get("include") or [""])[0]
            include_ids = [x.strip() for x in str(raw_include).split(",") if x.strip()]
            data = _branding_search_index_mem()
            if not isinstance(data, dict) or not isinstance(data.get("entries"), list):
                self._json(404, {"ok": False, "error": "branding_search_index_missing"})
                return
            self._json(200, resolve_branding_search_picker(q, lim, include_ids))
            return
        if parsed.path in ("/branding/status", "/branding/recognize/status"):
            status_file = BRANDING_RECOGNIZE_STATUS_FILE if "recognize" in parsed.path else BRANDING_STATUS_FILE
            data = _load_json(status_file, {"ok": False, "state": "unknown"})
            self._json(200, data if isinstance(data, dict) else {"ok": False})
            return
        if parsed.path == "/wykrojniki-registry":
            data = _load_json(WYKROJNIKI_REGISTRY_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "wykrojniki_registry_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/sleeve-stock":
            if self._require_login() is None:
                return
            data = _load_json(SLEEVE_STOCK_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "sleeve_stock_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/production-cost-catalog":
            if self._require_login() is None:
                return
            data = _load_json(
                PRODUCTION_COST_CATALOG_FILE,
                {"version": 1, "currency": "PLN", "lines": []},
            )
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/wykrojnik-mapping-queue":
            if self._require_login() is None:
                return
            queue = _load_json(WYKROJNIK_QUEUE_FILE, {"version": 1, "pending": [], "resolved": []})
            self._json(200, {"ok": True, **queue})
            return
        if parsed.path == "/integrations/config":
            if self._require_login() is None:
                return
            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            self._json(200, oauth_integrations.read_env_public())
            return
        if parsed.path == "/finance/cost-rates":
            if self._require_login() is None:
                return
            data = _load_json(COST_RATES_FILE, {"version": 1, "currency": "PLN"})
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/finance/fmcg-catalog":
            if self._require_login() is None:
                return
            data = _load_json(FMCG_CATALOG_FILE, _fmcg_default_catalog())
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/finance/fmcg-import-map":
            if self._require_login() is None:
                return
            data = _load_json(FMCG_IMPORT_MAP_FILE, {"version": 1, "maps": []})
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/finance/fmcg-compute":
            if self._require_login() is None:
                return
            catalog = _load_json(FMCG_CATALOG_FILE, _fmcg_default_catalog())
            self._json(200, _fmcg_compute(catalog))
            return
        if parsed.path == "/finance/project-costs":
            if self._require_login() is None:
                return
            data = _load_json(PROJECT_COSTS_FILE, {})
            meta = {
                "generated_at": data.get("generated_at"),
                "source_csv": data.get("source_csv"),
                "project_count": data.get("project_count"),
                "sum_open_projects": data.get("sum_open_projects"),
                "sum_all_projects": data.get("sum_all_projects"),
                "currency": data.get("currency"),
            }
            self._json(200, {"ok": True, "meta": meta, **data})
            return
        if parsed.path == "/finance/invoices":
            if self._require_login() is None:
                return
            data = _load_json(INVOICES_FILE, {"invoices": []})
            self._json(200, {"ok": True, **data})
            return
        if parsed.path == "/finance/invoices/erp-status":
            if self._require_login() is None:
                return
            if invoice_erp_mod is None:
                self._json(503, {"ok": False, "error": "invoice_erp_unavailable"})
                return
            self._json(200, invoice_erp_mod.status_payload(WEB_ROOT, _load_json))
            return
        self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        # Limit body (anty DoS) - 2 MB wystarczy na JSON mostu
        if length > 2 * 1024 * 1024:
            self._json(413, {"ok": False, "error": "payload_too_large"})
            return
        raw = self.rfile.read(length) if length else b"{}"
        parsed = urlparse(self.path)
        content_type = self.headers.get("Content-Type") or ""

        if parsed.path == "/debug-ingest":
            if not self._origin_ok():
                self._json(403, {"ok": False, "error": "origin_forbidden"})
                return
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                self._json(400, {"ok": False, "error": "invalid_json"})
                return
            line = json.dumps(payload, ensure_ascii=False) + "\n"
            for dbg_path in (
                DEBUG_SESSION_LOG,
                WEB_ROOT / "data" / "debug-0f6c29.log",
            ):
                try:
                    dbg_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(dbg_path, "a", encoding="utf-8") as dbg_f:
                        dbg_f.write(line)
                except OSError:
                    pass
            self._json(200, {"ok": True})
            return

        if parsed.path == "/thumb-cache/warm":
            if not self._origin_ok():
                self._json(403, {"ok": False, "error": "origin_forbidden"})
                return
            if dam_thumb_cache_mod is None:
                self._json(500, {"ok": False, "error": "module_missing"})
                return
            try:
                data = json.loads(raw.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                self._json(400, {"ok": False, "error": "invalid_json"})
                return
            paths = data.get("paths") if isinstance(data.get("paths"), list) else []
            if not paths and data.get("path"):
                paths = [str(data.get("path"))]
            paths = [str(p).strip() for p in paths if str(p).strip()]
            profile = str(data.get("profile") or "grid").strip() or "grid"
            async_warm = bool(data.get("async"))
            user = self._session_user()
            email = str((user or {}).get("email") or "").strip()

            def _resolve(p: str, em: str = "") -> str:
                return _coerce_media_target(p, em or email)

            def _rel(p: str, em: str = "") -> str:
                if dam_path_resolve_mod is None:
                    return Path(p).name
                return dam_path_resolve_mod.marketing_relative_key(
                    p,
                    email=em or email,
                    resolve_base_path=resolve_base_path_for_current_device,
                    marketing_candidates=MARKETING_CANDIDATES,
                    machine_config_path=MACHINE_CONFIG,
                )

            if async_warm:
                self._json(200, dam_thumb_cache_mod.enqueue_warm(paths, profile=profile, email=email))
                return
            self._json(
                200,
                dam_thumb_cache_mod.warm_paths(
                    paths,
                    email=email,
                    profile=profile,
                    resolve_physical=_resolve,
                    marketing_relative=_rel,
                ),
            )
            return

        if parsed.path in ("/finance/fmcg-import", "/finance/invoices/import"):
            if parsed.path != "/oauth/callback" and not self._origin_ok():
                self._json(403, {"ok": False, "error": "origin_forbidden"})
                return
            if self._require_admin() is None:
                return
            data: dict = {}
            if "application/json" in content_type.lower():
                try:
                    data = json.loads(raw.decode("utf-8") or "{}")
                except json.JSONDecodeError:
                    self._json(400, {"ok": False, "error": "invalid_json"})
                    return
            csv_text = _extract_post_csv(raw, content_type, data)
            rows = _parse_csv_text(csv_text)
            if not rows:
                self._json(400, {"ok": False, "error": "csv_required"})
                return
            if parsed.path == "/finance/fmcg-import":
                catalog = _load_json(FMCG_CATALOG_FILE, _fmcg_default_catalog())
                updated, errors = _apply_fmcg_csv_import(catalog, rows)
                _save_json(FMCG_CATALOG_FILE, catalog)
                self._json(
                    200,
                    {
                        "ok": True,
                        "updated": updated,
                        "errors": errors[:20],
                        "compute": _fmcg_compute(catalog),
                    },
                )
                return
            imported, errors = _import_invoices_csv(rows)
            self._json(
                200,
                {"ok": True, "imported": imported, "errors": errors[:20]},
            )
            return

        if parsed.path == "/sleeve-stock/import" and "multipart/form-data" in content_type.lower():
            if not self._origin_ok():
                self._json(403, {"ok": False, "error": "origin_forbidden"})
                return
            if self._require_admin() is None:
                return
            import tempfile

            blob, fname = _extract_multipart_file(raw, content_type)
            if not blob:
                self._json(400, {"ok": False, "error": "file_required"})
                return
            suffix = Path(fname).suffix.lower() or ".xlsx"
            try:
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    tmp.write(blob)
                    tmp_path = Path(tmp.name)
                result = _run_sleeve_stock_import(tmp_path)
                try:
                    tmp_path.unlink(missing_ok=True)
                except OSError:
                    pass
                append_audit(
                    {
                        "action": "sleeve_stock_import",
                        "user": str((self._session_user() or {}).get("email") or "admin"),
                        "meta": {
                            "entry_count": result.get("entry_count"),
                            "filename": fname,
                        },
                    }
                )
                self._json(
                    200,
                    {
                        "ok": True,
                        "entry_count": result.get("entry_count"),
                        "updated_at": result.get("updated_at"),
                        "source_xlsx": result.get("source_xlsx"),
                    },
                )
            except Exception as exc:  # noqa: BLE001
                self._json(500, {"ok": False, "error": str(exc)})
            return

        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid_json"})
            return

        if parsed.path != "/oauth/callback" and not self._origin_ok():
            self._json(403, {"ok": False, "error": "origin_forbidden"})
            return
        if parsed.path == "/reveal":
            # #region agent log
            try:
                _user = self._session_user() or {}
                _dbg = {
                    "sessionId": "a78fa0",
                    "hypothesisId": "A",
                    "location": "local_bridge.py:/reveal",
                    "message": "reveal request",
                    "data": {
                        "has_bearer": bool(self._bearer()),
                        "path_len": len((data.get("path") or "").strip()),
                        "user_email": str(_user.get("email") or "")[:80],
                    },
                    "timestamp": int(time.time() * 1000),
                    "runId": "post-fix",
                }
                with open(
                    Path(__file__).resolve().parents[2] / "debug-a78fa0.log",
                    "a",
                    encoding="utf-8",
                ) as _f:
                    _f.write(json.dumps(_dbg, ensure_ascii=False) + "\n")
            except Exception:
                pass
            # #endregion
            # Lokalny most 127.0.0.1: otwarcie folderu w Marketing (jail) bez Bearer.
            path = (data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, reveal_in_explorer(path))
            return
        if parsed.path == "/open":
            # Otworz plik w domyslnej aplikacji Windows (os.startfile).
            path = (data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, open_in_default_app(path))
            return
        if parsed.path == "/open-image-resizer":
            # STREFA A3 / pkt 37: Inyfinn Image resizer (CLI albo GUI+Explorer)
            self._json(
                200,
                open_image_resizer(
                    (data.get("input") or "").strip(),
                    (data.get("output") or "").strip(),
                    (data.get("product_id") or "").strip(),
                    (data.get("index") or "").strip(),
                ),
            )
            return
        if parsed.path == "/synology-share":
            if self._require_login() is None:
                return
            path = (data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, invoke_synology_share(path))
            return
        if parsed.path == "/validate-base":
            path = (data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, validate_base(path))
            return
        if parsed.path == "/pick-folder":
            # Lokalny most 127.0.0.1: dialog folderu (jak reveal) - bez Bearer.
            start = (
                data.get("start") or data.get("path") or data.get("directory") or ""
            ).strip()
            self._json(200, pick_folder_dialog(start))
            return
        if parsed.path == "/machine-config":
            # Zapis sciezki Marketing tylko dla zalogowanego uzytkownika
            user = self._require_login()
            if user is None:
                return
            path = (data.get("base_path") or data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "base_path_required"})
                return
            result = write_machine_config(path)
            # Lustro do bazy per-urzadzenie (biezacy device_id)
            try:
                ident = _udp_current_identity()
                email = str(user.get("email") or "").strip()
                did = str(ident.get("device_id") or "").strip()
                if email and did:
                    upsert_user_device_path(
                        email,
                        did,
                        path,
                        hostname=str(ident.get("hostname") or ""),
                    )
            except Exception as exc:  # noqa: BLE001
                print("user-device-paths mirror from machine-config:", exc)
            self._json(200, result)
            return
        if parsed.path == "/user-device-paths":
            user = self._require_login()
            if user is None:
                return
            email = str(user.get("email") or "").strip()
            action = str(data.get("action") or "upsert").strip().lower()
            if action == "delete":
                did = str(data.get("device_id") or "").strip()
                res = delete_user_device_path(email, did)
                self._json(200 if res.get("ok") else 404, res)
                return
            did = str(data.get("device_id") or "").strip()
            if not did:
                ident = _udp_current_identity()
                did = str(ident.get("device_id") or "").strip()
            hostname = str(data.get("hostname") or "").strip()
            if not hostname:
                ident = _udp_current_identity()
                if did == str(ident.get("device_id") or "").strip():
                    hostname = str(ident.get("hostname") or "").strip()
            label = data.get("label") if "label" in data else None
            path = (data.get("base_path") or data.get("path") or "").strip()
            res = upsert_user_device_path(
                email,
                did,
                path,
                hostname=hostname,
                label=label,
            )
            # Gdy zapis dotyczy biezacego urzadzenia - odswiez lokalny machine-config
            if res.get("ok"):
                try:
                    ident = _udp_current_identity()
                    if did == str(ident.get("device_id") or "").strip() and path:
                        write_machine_config(path)
                except Exception:  # noqa: BLE001
                    pass
            self._json(200 if res.get("ok") else 400, res)
            return
        if parsed.path == "/user-prefs":
            user = self._require_login()
            if user is None:
                return
            email = str(user.get("email") or "").strip()
            patch = data.get("prefs") if isinstance(data.get("prefs"), dict) else data
            if not isinstance(patch, dict):
                patch = {}
            res = write_user_prefs(email, patch)
            self._json(200 if res.get("ok") else 400, res)
            return
        if parsed.path == "/meta/sync":
            if self._require_admin() is None:
                return
            try:
                import meta_store

                self._json(200, meta_store.sync_from_file_index())
            except Exception as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/auth/logout":
            res = auth_logout(self._bearer())
            self._json(200 if res.get("ok") else 401, res)
            return
        if parsed.path == "/auth/register":
            # Bootstrap: pierwsze konto w systemie (zawsze role=admin).
            # Potem: tylko admin moze zakladac konta (wczesniej kazdy lokalny mogl).
            admin = self._session_user()
            is_admin = bool(admin and (admin.get("role") or "") == "admin")
            bootstrap = users_count() == 0
            if not bootstrap and not is_admin:
                self._json(
                    403,
                    {
                        "ok": False,
                        "error": "admin_required",
                        "hint": "Nowe konta zaklada tylko administrator.",
                    },
                )
                return
            requested_role = (data.get("role") or "user").strip().lower()
            if bootstrap:
                requested_role = "admin"
            elif not is_admin:
                requested_role = "user"
            if requested_role not in ("admin", "power_user", "user"):
                requested_role = "user"
            self._json(
                200,
                register_user(
                    data.get("email") or "",
                    data.get("password") or "",
                    data.get("name") or "",
                    requested_role,
                ),
            )
            return
        if parsed.path == "/auth/login":
            self._json(
                200,
                auth_login(
                    data.get("email") or "",
                    data.get("password") or "",
                    data.get("device_id") or "",
                    data.get("machine_id") or "",
                ),
            )
            return
        if parsed.path == "/auth/rehydrate":
            payload = data if isinstance(data, dict) else {}
            self._json(
                200,
                auth_rehydrate(
                    payload.get("session_id") or "",
                    payload.get("device_id") or "",
                    payload.get("machine_id") or "",
                ),
            )
            return
        if parsed.path == "/audit":
            user = self._require_login()
            if user is None:
                return
            payload = data if isinstance(data, dict) else {}
            payload.setdefault("user", user.get("email") or user.get("name") or "")
            self._json(200, append_audit(payload))
            return
        if parsed.path == "/index/rebuild":
            # Przebudowa indeksu z dysku = mutate (PI auth.roles_and_privilege) - tylko admin.
            if self._require_admin() is None:
                return
            self._json(200, start_index_rebuild())
            return
        if parsed.path == "/branding/rebuild":
            if self._require_admin() is None:
                return
            if not BUILD_BRANDING_INDEX.is_file():
                self._json(500, {"ok": False, "error": "build_branding_missing"})
                return
            try:
                _invalidate_branding_data_caches()
                _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
                rc = subprocess.call(
                    [sys.executable, str(BUILD_BRANDING_INDEX)],
                    creationflags=_no_win,
                )
                if rc == 0:
                    _invalidate_branding_data_caches()
                self._json(200, {"ok": rc == 0, "rc": rc})
            except OSError as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/branding/recognize":
            if self._require_admin() is None:
                return
            if not ENRICH_BRANDING_RECOGNIZE.is_file():
                self._json(500, {"ok": False, "error": "recognize_script_missing"})
                return
            try:
                _invalidate_branding_data_caches()
                _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
                rc = subprocess.call(
                    [sys.executable, str(ENRICH_BRANDING_RECOGNIZE)],
                    creationflags=_no_win,
                )
                if rc == 0:
                    _invalidate_branding_data_caches()
                self._json(200, {"ok": rc == 0, "rc": rc})
            except OSError as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/branding/asset-metadata":
            user = self._require_login()
            if user is None:
                return
            role = str(user.get("role") or "user").lower()
            if role not in ("admin", "power_user"):
                self._json(403, {"ok": False, "error": "forbidden"})
                return
            ok, err = _patch_branding_metadata(
                data.get("asset_id"),
                data.get("field"),
                data.get("value"),
            )
            if not ok:
                self._json(400, {"ok": False, "error": err or "patch_failed"})
                return
            self._json(200, {"ok": True, "asset_id": data.get("asset_id"), "field": data.get("field")})
            return
        if parsed.path == "/branding/asset-associations":
            user = self._require_login()
            if user is None:
                return
            role = str(user.get("role") or "user").lower()
            if role not in ("admin", "power_user"):
                self._json(403, {"ok": False, "error": "forbidden"})
                return
            ok, err = _patch_branding_associations(
                data.get("asset_id"),
                data.get("folder_group_id") or "",
                data.get("linked_product_ids") or [],
                data.get("linked_variant_ids"),
                updated_by=str(user.get("email") or user.get("name") or "user"),
                product_link_id=data.get("product_link_id") or "",
                product_link_action=data.get("product_link_action") or "",
            )
            if not ok:
                self._json(400, {"ok": False, "error": err or "patch_failed"})
                return
            self._json(
                200,
                {
                    "ok": True,
                    "asset_id": data.get("asset_id"),
                    "linked_product_ids": data.get("linked_product_ids") or [],
                    "linked_variant_ids": data.get("linked_variant_ids") or [],
                    "product_link_id": data.get("product_link_id") or "",
                    "product_link_action": data.get("product_link_action") or "",
                },
            )
            return
        if parsed.path == "/branding/copy-visual":
            user = self._require_login()
            if user is None:
                return
            role = str(user.get("role") or "user").lower()
            if role not in ("admin", "power_user"):
                self._json(403, {"ok": False, "error": "forbidden"})
                return
            ok, err, dest = _copy_media_file(data.get("src") or "", data.get("dest_dir") or "")
            if not ok:
                self._json(400, {"ok": False, "error": err or "copy_failed"})
                return
            self._json(200, {"ok": True, "dest": dest})
            return
        if parsed.path == "/wykrojniki/reimport":
            if self._require_admin() is None:
                return
            if not IMPORT_WYKROJNIKI.is_file():
                self._json(500, {"ok": False, "error": "import_script_missing"})
                return
            try:
                _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
                rc = subprocess.call(
                    [sys.executable, str(IMPORT_WYKROJNIKI)],
                    creationflags=_no_win,
                )
                reg = _load_json(WYKROJNIKI_REGISTRY_FILE, {})
                self._json(
                    200,
                    {
                        "ok": rc == 0,
                        "rc": rc,
                        "entry_count": len((reg or {}).get("entries") or {}),
                        "source_xlsx": (reg or {}).get("source_xlsx"),
                    },
                )
            except OSError as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/sleeve-stock/reimport":
            if self._require_admin() is None:
                return
            xlsx = Path(str(data.get("path") or DEFAULT_SLEEVE_STOCK_XLSX))
            try:
                result = _run_sleeve_stock_import(xlsx)
                append_audit(
                    {
                        "action": "sleeve_stock_reimport",
                        "user": str((self._session_user() or {}).get("email") or "admin"),
                        "meta": {
                            "entry_count": result.get("entry_count"),
                            "source": result.get("source_xlsx"),
                        },
                    }
                )
                self._json(
                    200,
                    {
                        "ok": True,
                        "entry_count": result.get("entry_count"),
                        "updated_at": result.get("updated_at"),
                        "source_xlsx": result.get("source_xlsx"),
                    },
                )
            except FileNotFoundError:
                self._json(404, {"ok": False, "error": "xlsx_not_found", "path": str(xlsx)})
            except Exception as exc:  # noqa: BLE001
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/sleeve-stock/import":
            # Multipart handled before JSON parse - re-read is not possible; use early branch.
            # If we reached here, body was JSON with optional base64.
            if self._require_admin() is None:
                return
            import base64
            import tempfile

            b64 = data.get("file_base64") or data.get("content_base64")
            fname = str(data.get("filename") or "sleeve-stock.xlsx")
            if not b64:
                self._json(400, {"ok": False, "error": "file_required"})
                return
            try:
                blob = base64.b64decode(b64)
            except Exception:  # noqa: BLE001
                self._json(400, {"ok": False, "error": "invalid_base64"})
                return
            suffix = Path(fname).suffix.lower() or ".xlsx"
            try:
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    tmp.write(blob)
                    tmp_path = Path(tmp.name)
                result = _run_sleeve_stock_import(tmp_path)
                try:
                    tmp_path.unlink(missing_ok=True)
                except OSError:
                    pass
                append_audit(
                    {
                        "action": "sleeve_stock_import",
                        "user": str((self._session_user() or {}).get("email") or "admin"),
                        "meta": {
                            "entry_count": result.get("entry_count"),
                            "filename": fname,
                        },
                    }
                )
                self._json(
                    200,
                    {
                        "ok": True,
                        "entry_count": result.get("entry_count"),
                        "updated_at": result.get("updated_at"),
                        "source_xlsx": result.get("source_xlsx"),
                    },
                )
            except Exception as exc:  # noqa: BLE001
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/wykrojniki/link-products":
            if self._require_admin() is None:
                return
            if not LINK_WYKROJNIKI.is_file():
                self._json(500, {"ok": False, "error": "link_script_missing"})
                return
            try:
                _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
                rc = subprocess.call(
                    [sys.executable, str(LINK_WYKROJNIKI)],
                    creationflags=_no_win,
                )
                reg = _load_json(WYKROJNIKI_REGISTRY_FILE, {})
                self._json(
                    200,
                    {
                        "ok": rc == 0,
                        "rc": rc,
                        "link_stats": (reg or {}).get("link_stats") or {},
                        "entry_count": len((reg or {}).get("entries") or {}),
                    },
                )
            except OSError as exc:
                self._json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/wykrojniki/set-link":
            if self._require_admin() is None:
                return
            kod = str(data.get("kod") or data.get("wykrojnik_kod") or "").strip()
            product_id = str(data.get("product_id") or "").strip()
            action = str(data.get("action") or "set").strip().lower()
            if not kod:
                self._json(400, {"ok": False, "error": "kod_required"})
                return
            reg = _load_json(WYKROJNIKI_REGISTRY_FILE, {"version": 1, "entries": {}})
            entries = reg.setdefault("entries", {})
            block = entries.get(kod) if isinstance(entries.get(kod), dict) else None
            if block is None:
                block = {"kod": kod, "nazwa": "", "linked_product_ids": [], "source": "manual"}
                entries[kod] = block
            linked = list(block.get("linked_product_ids") or [])
            if action == "clear":
                block["linked_product_ids"] = []
            elif action == "add" and product_id:
                if product_id not in linked:
                    linked.append(product_id)
                block["linked_product_ids"] = linked
                block["link_rule"] = "manual_ui"
            elif action == "set":
                if not product_id:
                    self._json(400, {"ok": False, "error": "product_id_required"})
                    return
                block["linked_product_ids"] = [product_id]
                block["link_rule"] = "manual_ui"
            else:
                self._json(400, {"ok": False, "error": "unknown_action"})
                return
            reg["updated_at"] = utc_now()
            WYKROJNIKI_REGISTRY_FILE.write_text(
                json.dumps(reg, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            self._json(200, {"ok": True, "kod": kod, "linked_product_ids": block.get("linked_product_ids") or []})
            return
        if parsed.path == "/product-catalog/update":
            if self._require_admin() is None:
                return
            product_id = (data.get("product_id") or "").strip()
            patch = data.get("patch") or data.get("entry") or {}
            if not product_id or not isinstance(patch, dict):
                self._json(400, {"ok": False, "error": "product_id_and_patch_required"})
                return
            catalog = _load_json(PRODUCT_CATALOG_FILE, {"version": 1, "products": {}})
            products = catalog.setdefault("products", {})
            base = products.get(product_id) if isinstance(products.get(product_id), dict) else {}
            products[product_id] = {**base, **patch}
            catalog["updated_at"] = utc_now()
            PRODUCT_CATALOG_FILE.write_text(
                json.dumps(catalog, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            self._json(200, {"ok": True, "product_id": product_id})
            return
        if parsed.path == "/wykrojnik-mapping-queue":
            if self._require_admin() is None:
                return
            queue = _load_json(WYKROJNIK_QUEUE_FILE, {"version": 1, "pending": [], "resolved": []})
            action = (data.get("action") or "add").strip().lower()
            if action == "add":
                item = data.get("item") or {}
                if not isinstance(item, dict):
                    self._json(400, {"ok": False, "error": "item_required"})
                    return
                queue.setdefault("pending", []).append(item)
            elif action == "resolve":
                item_id = (data.get("id") or "").strip()
                pending = [x for x in queue.get("pending") or [] if str(x.get("id")) != item_id]
                resolved = queue.get("resolved") or []
                for it in queue.get("pending") or []:
                    if str(it.get("id")) == item_id:
                        it["resolved_at"] = utc_now()
                        resolved.append(it)
                        # Apply to registry immediately (no terminal step)
                        kod = str(it.get("wykrojnik_kod") or it.get("kod") or "").strip()
                        pid = str(it.get("product_id") or "").strip()
                        if kod and pid:
                            reg = _load_json(WYKROJNIKI_REGISTRY_FILE, {"version": 1, "entries": {}})
                            entries = reg.setdefault("entries", {})
                            block = entries.get(kod) if isinstance(entries.get(kod), dict) else None
                            if block is None:
                                block = {
                                    "kod": kod,
                                    "nazwa": "",
                                    "linked_product_ids": [],
                                    "source": "queue",
                                }
                                entries[kod] = block
                            linked = list(block.get("linked_product_ids") or [])
                            if pid not in linked:
                                linked.append(pid)
                            block["linked_product_ids"] = linked
                            block["link_rule"] = "manual_queue"
                            reg["updated_at"] = utc_now()
                            WYKROJNIKI_REGISTRY_FILE.write_text(
                                json.dumps(reg, ensure_ascii=False, indent=2),
                                encoding="utf-8",
                            )
                queue["pending"] = pending
                queue["resolved"] = resolved
            elif action == "remove":
                item_id = (data.get("id") or "").strip()
                if not item_id:
                    self._json(400, {"ok": False, "error": "id_required"})
                    return
                queue["pending"] = [
                    x for x in queue.get("pending") or [] if str(x.get("id")) != item_id
                ]
                queue["resolved"] = [
                    x for x in queue.get("resolved") or [] if str(x.get("id")) != item_id
                ]
            else:
                self._json(400, {"ok": False, "error": "unknown_action"})
                return
            queue["updated_at"] = utc_now()
            WYKROJNIK_QUEUE_FILE.write_text(
                json.dumps(queue, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            self._json(200, {"ok": True, "pending": len(queue.get("pending") or [])})
            return
        if parsed.path == "/carrier-override":
            if self._require_admin() is None:
                return
            path = (data.get("path") or "").strip()
            entry = data.get("entry") or {}
            if not path or not isinstance(entry, dict):
                self._json(400, {"ok": False, "error": "path_and_entry_required"})
                return
            self._json(200, append_carrier_override(path, entry))
            return
        if parsed.path == "/elements-link":
            if self._require_admin() is None:
                return
            result = upsert_elements_link(data if isinstance(data, dict) else {})
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/thumb-override":
            if self._require_admin() is None:
                return
            pid = (data.get("product_id") or "").strip()
            if not pid:
                self._json(400, {"ok": False, "error": "product_id_required"})
                return
            self._json(200, append_thumb_override(pid, data if isinstance(data, dict) else {}))
            return
        if parsed.path == "/viz-flag":
            if self._require_admin() is None:
                return
            self._json(200, write_viz_flags(data if isinstance(data, dict) else {}))
            return
        if parsed.path == "/rename-index":
            if self._require_admin() is None:
                return
            folder = (data.get("folder") or data.get("path") or "").strip()
            from_index = (data.get("from_index") or "").strip()
            to_index = (data.get("to_index") or "").strip()
            dry_run = bool(data.get("dry_run"))
            if not folder or not from_index or not to_index:
                self._json(400, {"ok": False, "error": "folder_from_to_required"})
                return
            result = rename_index_in_folder(folder, from_index, to_index, dry_run=dry_run)
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/lifecycle-status":
            user = self._require_admin()
            if user is None:
                return
            if lifecycle_status_mod is None:
                self._json(500, {"ok": False, "error": "lifecycle_module_missing"})
                return
            payload = data if isinstance(data, dict) else {}
            result = lifecycle_status_mod.apply_lifecycle_status(
                scope=str(payload.get("scope") or ""),
                status=str(payload.get("status") or ""),
                path=str(payload.get("path") or payload.get("folder") or ""),
                product_path=str(payload.get("product_path") or ""),
                product_id=str(payload.get("product_id") or ""),
                revision_index=str(payload.get("revision_index") or payload.get("index") or ""),
                actor=(user.get("email") or user.get("name") or ""),
                dry_run=bool(payload.get("dry_run")),
                store_path=LIFECYCLE_STORE_FILE,
                append_change_log=append_change_log,
            )
            # Po sukcesie: wypchnij lifecycle + mirror product-status do PG (KV)
            if result.get("ok") and not result.get("dry_run"):
                try:
                    store = lifecycle_status_mod.load_lifecycle_store(LIFECYCLE_STORE_FILE)
                    _save_json(LIFECYCLE_STORE_FILE, store)
                except Exception:  # noqa: BLE001
                    pass
                try:
                    mirror_lifecycle_to_product_status(result, payload)
                except Exception:  # noqa: BLE001
                    pass
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/lifecycle-force":
            # Stosuj zmiany: PROGRAM -> dysk (FORCE)
            user = self._require_admin()
            if user is None:
                return
            if lifecycle_status_mod is None:
                self._json(500, {"ok": False, "error": "lifecycle_module_missing"})
                return
            payload = data if isinstance(data, dict) else {}
            pid_filter = str(payload.get("product_id") or "").strip() or None
            dry_run = bool(payload.get("dry_run"))
            result = lifecycle_status_mod.force_apply_program_to_disk(
                store_path=LIFECYCLE_STORE_FILE,
                file_index_path=INDEX_FILE,
                actor=(user.get("email") or user.get("name") or "force"),
                product_id_filter=pid_filter,
                dry_run=dry_run,
                append_change_log=append_change_log,
            )
            body = {k: v for k, v in result.items() if k != "store"}
            self._json(200 if body.get("ok") else 400, body)
            return
        if parsed.path == "/explorer/create-category":
            # Admin: kopia szablonu 00 - KATEGORIA|CATEGORY -> {NN} - NAME
            user = self._require_admin()
            if user is None:
                return
            if explorer_create_mod is None:
                self._json(500, {"ok": False, "error": "explorer_create_module_missing"})
                return
            payload = data if isinstance(data, dict) else {}
            email = str(user.get("email") or "").strip()
            resolved = resolve_base_path_for_current_device(email)
            base = str(resolved.get("base_path") or "").strip()
            if not base:
                self._json(
                    400,
                    {
                        "ok": False,
                        "error": "marketing_base_unset",
                        "message": "Ustaw sciezke Marketing (user-device-paths / machine-config).",
                    },
                )
                return
            dry_run = bool(payload.get("dry_run", True))
            confirm = bool(payload.get("confirm"))
            seq_raw = payload.get("seq")
            result = explorer_create_mod.create_category(
                marketing_base=base,
                brand=str(payload.get("brand") or ""),
                name=str(payload.get("name") or ""),
                seq=seq_raw if seq_raw not in (None, "") else None,
                dry_run=dry_run,
                confirm=confirm,
            )
            if result.get("ok") and not result.get("dry_run"):
                try:
                    append_audit(
                        {
                            "action": "explorer_create_category",
                            "user": email or user.get("name") or "",
                            "path": result.get("created_path") or result.get("planned_path") or "",
                            "detail": {
                                "brand": payload.get("brand"),
                                "name": payload.get("name"),
                            },
                        }
                    )
                except Exception:  # noqa: BLE001
                    pass
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/explorer/create-product":
            # Admin: kopia szablonu produktu do category_path (+ warianty / demo - D)
            user = self._require_admin()
            if user is None:
                return
            if explorer_create_mod is None:
                self._json(500, {"ok": False, "error": "explorer_create_module_missing"})
                return
            payload = data if isinstance(data, dict) else {}
            email = str(user.get("email") or "").strip()
            resolved = resolve_base_path_for_current_device(email)
            base = str(resolved.get("base_path") or "").strip()
            if not base:
                self._json(
                    400,
                    {
                        "ok": False,
                        "error": "marketing_base_unset",
                        "message": "Ustaw sciezke Marketing (user-device-paths / machine-config).",
                    },
                )
                return
            dry_run = bool(payload.get("dry_run", True))
            confirm = bool(payload.get("confirm"))
            variants = payload.get("variants")
            if variants is not None and not isinstance(variants, list):
                self._json(400, {"ok": False, "error": "variants_must_be_array"})
                return
            result = explorer_create_mod.create_product(
                marketing_base=base,
                brand=str(payload.get("brand") or ""),
                category_path=str(payload.get("category_path") or ""),
                name=str(payload.get("name") or ""),
                subcategory=str(payload.get("subcategory") or ""),
                variants=variants if isinstance(variants, list) else None,
                demo=bool(payload.get("demo")),
                dry_run=dry_run,
                confirm=confirm,
                existing_product_path=str(payload.get("existing_product_path") or ""),
            )
            if result.get("ok") and not result.get("dry_run"):
                try:
                    append_audit(
                        {
                            "action": "explorer_create_product",
                            "user": email or user.get("name") or "",
                            "path": result.get("created_path") or result.get("planned_path") or "",
                            "detail": {
                                "brand": payload.get("brand"),
                                "name": payload.get("name"),
                                "subcategory": payload.get("subcategory"),
                                "demo": bool(payload.get("demo")),
                            },
                        }
                    )
                except Exception:  # noqa: BLE001
                    pass
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/explorer/undo-create":
            # Admin: cofniecie swiezo utworzonej kategorii/produktu (~2 min okno)
            user = self._require_admin()
            if user is None:
                return
            if explorer_create_mod is None:
                self._json(500, {"ok": False, "error": "explorer_create_module_missing"})
                return
            payload = data if isinstance(data, dict) else {}
            email = str(user.get("email") or "").strip()
            resolved = resolve_base_path_for_current_device(email)
            base = str(resolved.get("base_path") or "").strip()
            if not base:
                self._json(400, {"ok": False, "error": "marketing_base_unset"})
                return
            result = explorer_create_mod.undo_create(
                marketing_base=base,
                path=str(payload.get("path") or ""),
            )
            if result.get("ok"):
                try:
                    append_audit(
                        {
                            "action": "explorer_undo_create",
                            "user": email or user.get("name") or "",
                            "path": result.get("deleted_path") or "",
                        }
                    )
                except Exception:  # noqa: BLE001
                    pass
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/explorer/add-variant-type":
            # Admin: nowy wariant/nosnik globalny - naming-dictionary.carriers + carrier-types.json
            user = self._require_admin()
            if user is None:
                return
            payload = data if isinstance(data, dict) else {}
            result = add_global_variant_type(
                payload,
                actor=str(user.get("email") or user.get("name") or ""),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/explorer/add-subcategory":
            # Admin: globalna podkategoria → naming-dictionary.subcategories[]
            user = self._require_admin()
            if user is None:
                return
            payload = data if isinstance(data, dict) else {}
            result = add_global_subcategory(
                payload,
                actor=str(user.get("email") or user.get("name") or ""),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/explorer/pack-print":
            # PAKIET: ZIP 2-PROJEKT + 4-WIZKI -> 3-DRUK (bez SZKICE); nazwa = stem .ai
            user = self._require_login()
            if user is None:
                return
            payload = data if isinstance(data, dict) else {}
            rev_path = (
                payload.get("revision_path")
                or payload.get("path")
                or payload.get("folder")
                or ""
            )
            result = create_print_package(
                revision_path=str(rev_path or "").strip(),
                product_id=str(payload.get("product_id") or "").strip(),
                index=str(payload.get("index") or payload.get("revision_index") or "").strip(),
                dry_run=bool(payload.get("dry_run")),
            )
            if result.get("ok") and not result.get("dry_run"):
                try:
                    append_audit(
                        {
                            "action": "explorer_pack_print",
                            "user": user.get("email") or user.get("name") or "",
                            "path": result.get("zip_path") or "",
                            "detail": {
                                "zip_name": result.get("zip_name"),
                                "engine": result.get("engine"),
                                "file_count": result.get("file_count"),
                                "revision_path": result.get("revision_path"),
                            },
                        }
                    )
                except Exception:  # noqa: BLE001
                    pass
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/rename-revision-prefix":
            user = self._require_login()
            if user is None:
                return
            # admin_mode z body tylko jako UX flag - privilege i tak z sesji
            admin_mode = bool(data.get("admin_mode")) and (user.get("role") or "") == "admin"
            result = create_or_apply_tag_proposal(
                data if isinstance(data, dict) else {},
                session_role=(user.get("role") or "user"),
                session_email=(user.get("email") or user.get("name") or ""),
                admin_mode=admin_mode,
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/revision-langs":
            user = self._require_login()
            if user is None:
                return
            result = apply_revision_langs(
                data if isinstance(data, dict) else {},
                session_role=(user.get("role") or "user"),
                session_email=(user.get("email") or user.get("name") or ""),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/rename-revision-files":
            # Dry-run wolny dla zalogowanych; apply tylko admin
            user = self._require_login()
            if user is None:
                return
            rev = (data.get("revision_path") or "").strip()
            code = (data.get("new_carrier_code") or "").strip()
            dry = bool(data.get("dry_run", True))
            if not rev or not code:
                self._json(400, {"ok": False, "error": "revision_path_and_new_carrier_code_required"})
                return
            if not dry and (user.get("role") or "") != "admin":
                self._json(403, {"ok": False, "error": "admin_required", "hint": "Apply rename plików = tylko admin."})
                return
            self._json(200, rename_revision_files_on_disk(rev, code, dry_run=dry))
            return
        if parsed.path == "/change-log/undo":
            user = self._require_admin()
            if user is None:
                return
            actor = (user.get("email") or data.get("actor") or "").strip()
            self._json(200, undo_last_change(actor))
            return
        if parsed.path == "/change-log/redo":
            user = self._require_admin()
            if user is None:
                return
            actor = (user.get("email") or data.get("actor") or "").strip()
            self._json(200, redo_last_change(actor))
            return
        if parsed.path == "/tag-proposals/decide":
            user = self._require_admin()
            if user is None:
                return
            result = decide_tag_proposal(
                data if isinstance(data, dict) else {},
                decided_by=(user.get("email") or user.get("name") or "admin"),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/tag-proposals/reopen":
            user = self._require_admin()
            if user is None:
                return
            result = reopen_tag_proposal(
                data if isinstance(data, dict) else {},
                actor=(user.get("email") or user.get("name") or "admin"),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/tag-proposals/undo":
            user = self._require_admin()
            if user is None:
                return
            result = undo_tag_proposal(
                data if isinstance(data, dict) else {},
                actor=(user.get("email") or user.get("name") or "admin"),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/tag-proposals/cancel-undo":
            user = self._require_admin()
            if user is None:
                return
            result = cancel_undo_tag_proposal(
                data if isinstance(data, dict) else {},
                actor=(user.get("email") or user.get("name") or "admin"),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/tag-proposals/timeline":
            user = self._require_admin()
            if user is None:
                return
            pid = ""
            if isinstance(data, dict):
                pid = (data.get("proposal_id") or "").strip()
            if not pid:
                qs = parse_qs(parsed.query or "")
                pid = (qs.get("proposal_id") or [""])[0].strip()
            result = build_change_timeline_for_proposal(pid)
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/carrier-types":
            if self._require_admin() is None:
                return
            result = manage_carrier_type(data if isinstance(data, dict) else {})
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/viz-request":
            user = self._require_login()
            if user is None:
                return
            payload = data if isinstance(data, dict) else {}
            payload["requested_by"] = user.get("email") or user.get("name") or payload.get("requested_by") or ""
            result = create_viz_request(payload)
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/inbox-items/mark-read":
            if self._require_login() is None:
                return
            item_id = (data.get("id") or "").strip()
            store = _load_json(INBOX_ITEMS_FILE, {"items": []})
            for it in store.get("items") or []:
                if it.get("id") == item_id:
                    it["read"] = True
            _save_json(INBOX_ITEMS_FILE, store)
            self._json(200, {"ok": True})
            return
        if parsed.path == "/integrations/connect":
            user = self._require_login()
            if user is None:
                return
            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            provider = (data.get("provider") or "").strip().lower()
            result = oauth_integrations.start_login(
                provider, user_email=(user.get("email") or "")
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/integrations/disconnect":
            user = self._require_admin()
            if user is None:
                return
            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            provider = (data.get("provider") or "").strip().lower()
            self._json(200, oauth_integrations.disconnect(provider))
            return
        if parsed.path == "/integrations/config":
            if self._require_admin() is None:
                return
            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            updates = data if isinstance(data, dict) else {}
            payload = updates.get("config") if isinstance(updates.get("config"), dict) else updates
            result = oauth_integrations.write_env_keys(payload)
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/integrations/asana/sync":
            if self._require_power_user_or_admin() is None:
                return
            if oauth_integrations is None:
                self._json(500, {"ok": False, "error": "oauth_module_missing"})
                return
            result = _sync_asana_tasks()
            if not result.get("ok") and result.get("error") == "asana_not_connected":
                self._json(400, result)
                return
            self._json(200 if result.get("ok") else 500, result)
            return
        if parsed.path == "/finance/cost-rates":
            if self._require_admin() is None:
                return
            incoming = data.get("rates") if isinstance(data.get("rates"), dict) else data
            if not isinstance(incoming, dict) or not incoming:
                self._json(400, {"ok": False, "error": "rates_required"})
                return
            incoming["updated_at"] = utc_now()
            _save_json(COST_RATES_FILE, incoming)
            self._json(200, {"ok": True, "version": incoming.get("version")})
            return
        if parsed.path == "/finance/fmcg-import-map":
            if self._require_admin() is None:
                return
            maps = data.get("maps")
            if not isinstance(maps, list):
                self._json(400, {"ok": False, "error": "maps_required"})
                return
            cleaned: list[dict] = []
            for m in maps:
                if not isinstance(m, dict):
                    continue
                col = str(m.get("column") or "").strip()
                cid = str(m.get("catalog_id") or "").strip()
                if not col and not cid:
                    continue
                cleaned.append({"column": col, "catalog_id": cid})
            payload = {
                "version": int(data.get("version") or 1),
                "maps": cleaned,
                "updated_at": utc_now(),
            }
            _save_json(FMCG_IMPORT_MAP_FILE, payload)
            self._json(200, {"ok": True, "map_count": len(cleaned)})
            return
        if parsed.path == "/finance/fmcg-catalog":
            if self._require_admin() is None:
                return
            action = (data.get("action") or "replace").strip().lower()
            if action in ("patch", "upsert"):
                catalog = _load_json(FMCG_CATALOG_FILE, _fmcg_default_catalog())
                by_id = {
                    str(it.get("id")): it
                    for it in catalog.get("items") or []
                    if isinstance(it, dict) and it.get("id")
                }
                allow_upsert = action == "upsert" or bool(data.get("upsert"))
                patched = 0
                created = 0
                for patch in data.get("items") or []:
                    if not isinstance(patch, dict):
                        continue
                    pid = str(patch.get("id") or "").strip()
                    if not pid:
                        continue
                    if pid in by_id:
                        by_id[pid].update({k: v for k, v in patch.items() if k != "id"})
                        patched += 1
                    elif allow_upsert:
                        stage = str(patch.get("stage") or "procurement").strip() or "procurement"
                        new_item = {
                            "id": pid,
                            "stage": stage,
                            "label_pl": str(patch.get("label_pl") or pid),
                            "unit": str(patch.get("unit") or "per_order"),
                            "amount": patch.get("amount"),
                            "currency": str(patch.get("currency") or catalog.get("currency") or "PLN"),
                            "source": str(patch.get("source") or "manual"),
                            "vendor": str(patch.get("vendor") or ""),
                            "asana_keywords": patch.get("asana_keywords")
                            if isinstance(patch.get("asana_keywords"), list)
                            else [],
                            "notes": str(patch.get("notes") or ""),
                        }
                        by_id[pid] = new_item
                        created += 1
                catalog["items"] = list(by_id.values())
                catalog["updated_at"] = utc_now()
                _save_json(FMCG_CATALOG_FILE, catalog)
                self._json(
                    200,
                    {
                        "ok": True,
                        "patched": patched,
                        "created": created,
                        "compute": _fmcg_compute(catalog),
                    },
                )
                return
            incoming = data.get("catalog") if isinstance(data.get("catalog"), dict) else data
            if not isinstance(incoming, dict) or "items" not in incoming:
                self._json(400, {"ok": False, "error": "catalog_required"})
                return
            if not isinstance(incoming.get("items"), list):
                self._json(400, {"ok": False, "error": "catalog_items_required"})
                return
            incoming["updated_at"] = utc_now()
            _save_json(FMCG_CATALOG_FILE, incoming)
            self._json(200, {"ok": True, "item_count": len(incoming.get("items") or [])})
            return
        if parsed.path in ("/finance/invoices/export", "/finance/invoices/push"):
            if self._require_admin() is None:
                return
            if invoice_erp_mod is None:
                self._json(503, {"ok": False, "error": "invoice_erp_unavailable"})
                return
            store = _load_json(INVOICES_FILE, {"invoices": []})
            invoices = store.get("invoices") if isinstance(store, dict) else []
            if not isinstance(invoices, list):
                invoices = []
            # Optional subset by ids
            ids = data.get("ids")
            if isinstance(ids, list) and ids:
                id_set = {str(x) for x in ids}
                invoices = [inv for inv in invoices if isinstance(inv, dict) and str(inv.get("id")) in id_set]
            dry_run = bool(data.get("dry_run"))
            result = invoice_erp_mod.export_invoices(
                WEB_ROOT,
                invoices,
                load_json=_load_json,
                save_json=_save_json,
                dry_run=dry_run,
            )
            self._json(200, result)
            return
        if parsed.path == "/finance/invoices/outlook-draft":
            if self._require_admin() is None:
                return
            if invoice_mail_mod is None:
                self._json(503, {"ok": False, "error": "invoice_mail_unavailable"})
                return
            ids = data.get("invoice_ids") or data.get("ids") or []
            if not isinstance(ids, list) or not ids:
                self._json(400, {"ok": False, "error": "invoice_ids_required"})
                return
            to = data.get("to") or []
            if isinstance(to, str):
                to = [x.strip() for x in to.replace(";", ",").split(",") if x.strip()]
            if not isinstance(to, list) or not to:
                self._json(400, {"ok": False, "error": "recipients_required"})
                return
            result = invoice_mail_mod.prepare_invoice_mail(
                WEB_ROOT,
                invoice_ids=[str(x) for x in ids],
                to=[str(x) for x in to],
                accounting_no=str(data.get("accounting_no") or "509012414"),
                body=str(data.get("body") or data.get("body_note") or ""),
                load_json=_load_json,
                invoices_file=INVOICES_FILE,
            )
            append_audit(
                {
                    "action": "invoice_outlook_draft",
                    "user": str((self._session_user() or {}).get("email") or "admin"),
                    "meta": {
                        "invoice_ids": ids,
                        "to": to,
                        "ok": result.get("ok"),
                        "error": result.get("error"),
                    },
                }
            )
            # Expose zip via relative data path for browser fallback
            if result.get("zip_name"):
                result["zip_url"] = f"/data/_invoice_mail_stage/{result['zip_name']}"
            status = 200 if result.get("ok") or result.get("zip_path") else 500
            self._json(status, result)
            return
        if parsed.path == "/finance/invoices":
            if self._require_admin() is None:
                return
            action = (data.get("action") or "replace").strip().lower()
            if action == "upsert":
                inv = data.get("invoice")
                if not isinstance(inv, dict) or not inv.get("id"):
                    self._json(400, {"ok": False, "error": "invoice_id_required"})
                    return
                store = _load_json(INVOICES_FILE, {"invoices": []})
                invoices = store.setdefault("invoices", [])
                found = False
                for i, row in enumerate(invoices):
                    if str(row.get("id")) == str(inv.get("id")):
                        invoices[i] = {**row, **inv}
                        found = True
                        break
                if not found:
                    invoices.append(inv)
                store["updated_at"] = utc_now()
                _save_json(INVOICES_FILE, store)
                self._json(200, {"ok": True, "upserted": str(inv.get("id"))})
                return
            incoming = data.get("invoices")
            if incoming is None and isinstance(data.get("invoice"), dict):
                incoming = [data.get("invoice")]
            if not isinstance(incoming, list):
                self._json(400, {"ok": False, "error": "invoices_required"})
                return
            store = {"invoices": incoming, "updated_at": utc_now()}
            _save_json(INVOICES_FILE, store)
            self._json(200, {"ok": True, "count": len(incoming)})
            return
        if parsed.path == "/notification-groups":
            # Listy odbiorcow org-wide - tylko admin (nie user/power_user).
            if self._require_admin() is None:
                return
            incoming = data.get("groups") if isinstance(data.get("groups"), dict) else data
            if not isinstance(incoming, dict):
                self._json(400, {"ok": False, "error": "invalid_groups"})
                return
            current = _load_json(NOTIFICATION_GROUPS_FILE, {})
            if not isinstance(current, dict):
                current = {}
            # Zachowaj _readme i inne meta; aktualizuj tylko listy odbiorców
            for key, val in incoming.items():
                if str(key).startswith("_"):
                    continue
                if not isinstance(val, list):
                    continue
                cleaned = []
                for item in val:
                    if isinstance(item, dict):
                        email = str(item.get("email") or "").strip()
                        name = str(item.get("name") or "").strip()
                        if email and "@" in email:
                            cleaned.append({"name": name or email, "email": email})
                    elif isinstance(item, str) and "@" in item:
                        cleaned.append({"name": item, "email": item.strip()})
                current[key] = cleaned
            if "_readme" not in current:
                current["_readme"] = (
                    "Grupy odbiorcow powiadomien. Edytuj w Ustawieniach DAM "
                    "lub w tym pliku - kod NIE trzeba zmieniac."
                )
            _save_json(NOTIFICATION_GROUPS_FILE, current)
            clean = {
                k: v
                for k, v in current.items()
                if isinstance(v, list) and not str(k).startswith("_")
            }
            self._json(200, {"ok": True, "groups": clean})
            return
        if parsed.path in ("/db/reconnect", "/db/refresh"):
            # Jak GET /db/status: reconnect + opcjonalny pull dump na localhost (bez Bearera).
            if not dam_db:
                self._json(500, {"ok": False, "error": "dam_db_missing"})
                return
            pull_dump = bool(data.get("pull_dump") or data.get("github") or False)
            self._json(200, dam_db.force_reconnect(pull_dump=pull_dump))
            return
        if parsed.path == "/db/prefer":
            if self._require_admin() is None:
                return
            if not dam_db:
                self._json(500, {"ok": False, "error": "dam_db_missing"})
                return
            prefer = dam_db.save_prefer(data if isinstance(data, dict) else {})
            status = dam_db.force_reconnect(pull_dump=False)
            status["prefer"] = prefer
            self._json(200, status)
            return
        self._json(404, {"ok": False, "error": "not_found"})


def _tag_proposal_watcher() -> None:
    """Co ~15 min: eskalacja wygaslych propozycji do inbox (BEZ auto-zapisu na dysk)."""
    while True:
        try:
            n = escalate_expired_proposals()
            if n:
                print(f"tag-proposals watcher: escalated {n} to inbox (awaiting admin)")
        except Exception as exc:
            print("tag-proposals watcher error:", exc)
        time.sleep(15 * 60)


def _kv_cache_watcher() -> None:
    """ADR-009: co 5 min (gdy program/bridge dziala) pobierz wszystkie Tier-2
    stores z Postgresa do lokalnego cache. Tier 1 (auth/sesje) jest ZAWSZE zywe
    - bez cache. Pierwszy pull zaraz po starcie."""
    first = True
    while True:
        if not first:
            time.sleep(5 * 60)
        first = False
        try:
            n = _pull_kv_cache_from_postgres()
            if n:
                print(f"kv_cache watcher: refreshed {n} stores from postgres")
        except Exception as exc:
            print("kv_cache watcher error:", exc)


def main() -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        if dam_db is not None:
            print("db:", dam_db.init_db())
        auth_init_db()
        if dam_redis:
            try:
                dam_redis.bootstrap()
            except Exception as exc:  # noqa: BLE001
                print("dam_redis.bootstrap warning:", exc)
        if dam_thumb_cache_mod is not None and os.environ.get("DAM_WARM_BOOT_CONSUMER", "1") == "1":
            if os.environ.get("DAM_WARM_BOOT_ENQUEUE", "0") != "0":
                print("[C-WARM] DAM_WARM_BOOT_ENQUEUE must stay 0 on boot path")
            warm_json = os.environ.get(
                "DAM_WARM_LOCAL_JSON",
                str(DESKTOP_DIR.parent.parent / "PAMIEC-PODRECZNA" / "warm-local-20260722.json"),
            )
            try:
                dam_thumb_cache_mod.dam_warm_boot_consumer(warm_json)
            except Exception as exc:  # noqa: BLE001
                print("dam_warm_boot_consumer warning:", exc)
        seed_owner_from_env()
    except Exception as exc:
        print("auth/db seed:", exc)
    try:
        _seed_naming_policy_to_postgres()
    except Exception as exc:
        print("naming policy seed:", exc)
    threading.Thread(target=_tag_proposal_watcher, daemon=True).start()
    threading.Thread(target=_kv_cache_watcher, daemon=True).start()
    try:
        from dam_sync import spawn_sync_quiet, start_periodic_sync

        if dam_db and not dam_db.latest_database_dump():
            spawn_sync_quiet(push=False, no_commit=True)
        start_periodic_sync()
    except Exception as exc:
        print("db dump bootstrap:", exc)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"DAM local bridge http://{HOST}:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
