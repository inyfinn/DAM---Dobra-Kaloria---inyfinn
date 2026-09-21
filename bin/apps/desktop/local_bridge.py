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
  GET  /checklist-extras?index=6300808  karty (D/G Projekty opakowań) + OK.pdf (Projekty wstępne)
  GET  /folder-browse?path=...&mode=assets  foldery + pliki (AI/PDF/PNG...) do wskazania ELEMENTY
  POST /elements-link  reczne powiazanie folderu/plikow Elementy -> apps/web/data/elements-overrides.json
  POST /viz-flag  demo/hidden/manual -> apps/web/data/viz-flags.json
  GET  /thumb-cache?path=&profile=grid  AVIF/JPG miniatura z PAMIEC-PODRECZNA (on-demand encode)
  POST /thumb-cache/warm  {"paths":[...],"profile":"grid"}  podgrzewanie cache
  GET  /thumb-cache/status  stan katalogu pamieci podrecznej (+ sync)
  GET  /thumb-cache/sync/status  postep pobierania cache z NAS
  POST /thumb-cache/sync/start  first-run download z Synology (manifest)
  POST /thumb-cache/publish  wyslij nowe thumbs na NAS (W:\\web\\Panel-DAM\\pamiec-podreczna)
  POST /thumb-override  wybor miniatury -> apps/web/data/thumb-overrides.json
  POST /audit    {"action","user","path","detail",...}
  GET  /audit?limit=100
  GET  /file-index  pelny file-index.json (gzip gdy Accept-Encoding);
                    ?fields=viz_latest = lekki wycinek;
                    ?fields=explorer = produkty bez files_by_role/wizki/viz_latest (first paint)
  GET  /file-index/product?id=  pelny produkt (pliki rewizji) do openProduct
  GET  /file-index/viz-latest?index=&revision_path=&product_id=  pojedynczy wiersz viz_latest
  GET  /index/status  mtime file-index + postgres + ETA/cancel/snooze + current_item
  GET  /index/report  last_run_new (added/changed) after indeksowanie
  POST /index/rebuild  przebudowa indeksu + miniatur (async)
  GET/POST /index/cancel  przerwij biezacy rebuild (index-control.json)
  GET/POST /index/snooze  odroc hourly+watch do konca dnia
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

# Embeddable CPython (bin/runtime/win/python): python*._pth omits script dir / cwd.
_DESKTOP_BOOT = Path(__file__).resolve().parent
if str(_DESKTOP_BOOT) not in sys.path:
    sys.path.insert(0, str(_DESKTOP_BOOT))

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

import platform_compat

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
    import dam_thumb_cache
except ImportError:
    dam_thumb_cache = None  # type: ignore

# NFS/M: bywa wolne: cache-hit /thumb-cache potrafi wisiec >10s (kulki 2026-09-03).
# Klient <img> nie dostaje onerror przy pending — hard timeout na odpowiedzi HTTP.
THUMB_CACHE_TIMEOUT_S = float(os.environ.get("DAM_THUMB_CACHE_TIMEOUT_S", "2.5"))


def _thumb_cache_with_timeout(
    path: str,
    *,
    profile: str = "grid",
    resolve_physical=None,
    timeout_s: float | None = None,
) -> tuple[int, bytes, str, dict]:
    """Uruchom get_or_build_thumb w watku; po timeout zwroc 504 (onerror → /media)."""
    if not dam_thumb_cache:
        return 500, b"", "application/json", {"ok": False, "error": "dam_thumb_cache_missing"}
    limit = THUMB_CACHE_TIMEOUT_S if timeout_s is None else float(timeout_s)
    box: dict = {}

    def _worker() -> None:
        try:
            box["result"] = dam_thumb_cache.get_or_build_thumb(
                path,
                profile=profile,
                resolve_physical=resolve_physical,
            )
        except Exception as exc:  # noqa: BLE001
            box["error"] = str(exc)

    t = threading.Thread(target=_worker, daemon=True, name="dam-thumb-cache")
    t.start()
    t.join(timeout=max(0.2, limit))
    if "result" in box:
        return box["result"]
    if "error" in box:
        return 500, b"", "application/json", {"ok": False, "error": "thumb_build_failed", "detail": box["error"]}
    return (
        504,
        b"",
        "application/json",
        {
            "ok": False,
            "error": "thumb_timeout",
            "timeout_s": limit,
            "path": path,
            "profile": profile,
        },
    )

try:
    import dam_file_availability
except ImportError:
    dam_file_availability = None  # type: ignore

try:
    import branding_asset_routes
except ImportError:
    branding_asset_routes = None  # type: ignore

try:
    import app_updates
except ImportError:
    app_updates = None  # type: ignore

try:
    import dam_debug
except ImportError:
    dam_debug = None  # type: ignore

try:
    import dam_semantic_search
except Exception:  # noqa: BLE001
    dam_semantic_search = None  # type: ignore

try:
    import dam_path_resolve
except ImportError:
    dam_path_resolve = None  # type: ignore

try:
    import marketing_discovery
except ImportError:
    marketing_discovery = None  # type: ignore

try:
    import preflight as dam_preflight
except ImportError:
    dam_preflight = None  # type: ignore

HOST = "127.0.0.1"
PORT = int(os.environ.get("DAM_BRIDGE_PORT", "8766"))
# Bump po nowych endpointach hub (smoke: GET /health -> api_version)
BRIDGE_API_VERSION = 11
DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = Path(os.environ.get("DAM_WEB_ROOT", str(DESKTOP_DIR.parent / "web")))
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


def _origin_of(url: str) -> str:
    """scheme://host[:port] - naglowek Origin nigdy nie ma sciezki ('/Panel-DAM')."""
    try:
        u = urlparse(str(url or "").strip())
    except ValueError:
        return ""
    if not u.scheme or not u.netloc:
        return ""
    return f"{u.scheme}://{u.netloc}".lower()


_LOOPBACK_NAMES = ("127.0.0.1", "localhost", "[::1]", "::1")
_UI_HOST = (urlparse(CORS_ORIGIN).hostname or "").lower()
# Tryb publiczny: most stoi na NAS za nginx (/dam-api/) i jest osiagalny z internetu.
# Wykrywany po DAM_UI_ORIGIN spoza loopback (start-dam-bridge.sh) albo DAM_PUBLIC_MODE=1.
PUBLIC_MODE = (os.environ.get("DAM_PUBLIC_MODE", "").strip().lower() in ("1", "true", "yes")) or (
    bool(_UI_HOST) and _UI_HOST not in _LOOPBACK_NAMES
)
PUBLIC_HOSTS = {
    h.strip().lower()
    for h in ([_UI_HOST] + (os.environ.get("DAM_PUBLIC_HOSTS") or "").split(","))
    if h and h.strip() and h.strip().lower() not in _LOOPBACK_NAMES
}
# Jedyne sciezki dostepne w trybie publicznym bez waznej sesji.
PUBLIC_ANON_PATHS = frozenset(
    {
        "/health",
        "/auth/login",
        "/auth/logout",
        "/auth/me",
        "/auth/registration-open",
        "/auth/register",
        "/auth/change-password",
        "/db/status",
        "/pg/status",
        "/files/status",
        "/oauth/callback",
    }
)
# Funkcje komputera uzytkownika: na serwerze nie maja sensu, a w internecie sa grozne.
PUBLIC_FORBIDDEN_PATHS = frozenset(
    {
        "/open",
        "/reveal",
        "/pick-folder",
        "/open-image-resizer",
        "/synology-share",
        "/validate-base",
        "/detect-marketing-bases",
        "/preflight",
        "/db/activate",
        "/db/activation",
        "/db/path",
        "/auth/rehydrate",
        "/auth/identity",
        "/debug/self-test",
        "/telemetry/tail",
        "/app-update/apply",
        "/app-update/check",
        "/app-update/status",
        "/app-update/prefs",
        "/app-update/success",
    }
)
# Kolejnosc: M: (komputer zrodlowy Synology) -> X:/Marketing -> staging D: -> inne wykryte.
# Uzupelniane w tle przy starcie mostu (marketing_discovery); funkcje czytaja globala
# w chwili wywolania, wiec podmiana krotki wystarcza.
MARKETING_CANDIDATES: tuple[Path, ...] = platform_compat.marketing_candidates(
    (
        Path("M:/"),
        Path("X:/Marketing"),
        Path("D:/Marketing"),
    )
)
MARKETING_DISCOVERY_INTERVAL_SEC = 300.0


def _set_marketing_candidates(discovered) -> tuple[Path, ...]:
    global MARKETING_CANDIDATES
    if marketing_discovery is None:
        return MARKETING_CANDIDATES
    cands = tuple(marketing_discovery.ordered_candidates((), discovered))
    MARKETING_CANDIDATES = cands
    if dam_path_resolve is not None:
        dam_path_resolve.set_marketing_candidates(cands)
    return cands


def refresh_marketing_candidates(*, use_cache: bool = False) -> tuple[Path, ...]:
    """Probe all drives (max ok. 2 s) and extend MARKETING_CANDIDATES."""
    if marketing_discovery is None:
        return MARKETING_CANDIDATES
    try:
        roots = marketing_discovery.discover_roots(
            required=REQUIRED_ROOT_FOLDERS, use_cache=use_cache
        )
    except Exception as exc:  # noqa: BLE001
        print("marketing_discovery:", exc)
        return MARKETING_CANDIDATES
    return _set_marketing_candidates(roots)


def _marketing_discovery_watcher() -> None:
    """Start mostu i co 5 min: litera dysku moze pojawic sie po VPN."""
    while True:
        cands = refresh_marketing_candidates()
        print("marketing_candidates:", [str(c) for c in cands])
        time.sleep(MARKETING_DISCOVERY_INTERVAL_SEC)

_index_lock = threading.Lock()
_index_state: dict = {
    "running": False,
    "last_started": "",
    "last_finished": "",
    "last_ok": None,
    "last_error": "",
    "last_rc": None,
    "stage": "",
    "kind": "",
    "child_pid": None,
}
_branding_rebuild_lock = threading.Lock()
_branding_rebuild_state: dict = {
    "running": False,
    "last_started": "",
    "last_finished": "",
    "last_ok": None,
    "last_error": "",
    "last_rc": None,
    "stage": "",
    "generation_id": "",
    "slim_pending": False,
    "slim_last_ok": None,
    "slim_last_rc": None,
    "slim_last_error": "",
    "slim_last_finished": "",
    "slim_coalesced": 0,
}
SLIM_PUBLISH_DEBOUNCE_SEC = 2.0
BRANDING_LOCK_TTL_SEC = 7200.0
_slim_publisher: Any = None


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_path(p: str) -> str:
    return str(Path(p)).replace("/", "\\")


def is_probably_file(p: str) -> bool:
    name = Path(p).name
    return "." in name and not name.startswith(".")


# --- Explorer: karta + fokus (2026-07-20) -----------------------------------
# Windows-only implementation (ctypes focus helpers, explorer /select, PIDL
# tab navigation) zyla tu do 2026-09-21, teraz w platform_compat.py razem z
# macOS `open -R` odpowiednikiem - reveal_in_explorer() nizej tylko waliduje
# i deleguje.


def reveal_in_explorer(target: str) -> dict:
    target = (
        dam_path_resolve.resolve_physical_path(
            target,
            normalize_path=normalize_path,
            marketing_candidates=MARKETING_CANDIDATES,
            machine_config_path=MACHINE_CONFIG,
        )
        if dam_path_resolve
        else normalize_path(target)
    )
    if not os.path.exists(target):
        return {"ok": False, "error": "path_not_found", "path": target}
    if not _is_under_marketing(Path(target)):
        return {"ok": False, "error": "path_outside_marketing", "path": target}

    # Bez shell=True (unikaj injection przez cudzyslowy w sciezce).
    # Foldery typu "6300084.00" maja kropke - NIE wolno traktowac ich jako plik.
    return platform_compat.reveal_in_folder(target)


OPEN_BLOCKED_EXTENSIONS = frozenset(
    (
        ".exe .com .scr .pif .cpl .msi .msp .mst .msix .appx .appinstaller .bat .cmd .ps1 .psm1 "
        ".psd1 .vbs .vbe .js .jse .wsf .wsh .wsc .hta .jar .lnk .url .reg .inf .scf .dll .sys "
        ".chm .hlp .application .gadget .settingcontent-ms .library-ms .search-ms .website "
        ".iso .img .vhd .vhdx .py .pyw .sh .docm .dotm .xlsm .xltm .xlam .pptm .potm .ppam"
    ).split()
)


def open_in_default_app(target: str) -> dict:
    """Otworz plik domyslna aplikacja Windows (os.startfile). Tylko pliki w Marketing."""
    target = (
        dam_path_resolve.resolve_physical_path(
            target,
            normalize_path=normalize_path,
            marketing_candidates=MARKETING_CANDIDATES,
            machine_config_path=MACHINE_CONFIG,
        )
        if dam_path_resolve
        else normalize_path(target)
    )
    if not os.path.exists(target):
        return {"ok": False, "error": "path_not_found", "path": target}
    if not _is_under_marketing(Path(target)):
        return {"ok": False, "error": "path_outside_marketing", "path": target}
    if not os.path.isfile(target) and not is_probably_file(target):
        return {"ok": False, "error": "not_a_file", "path": target}
    # Udzial Marketing jest zapisywalny dla wielu osob: podrzucony .bat/.lnk/.exe
    # nie moze zostac uruchomiony jednym kliknieciem (ani zadaniem do mostu).
    if Path(target).suffix.lower() in OPEN_BLOCKED_EXTENSIONS:
        return {"ok": False, "error": "file_type_blocked", "path": target}
    result = platform_compat.open_file(target)
    if result.get("ok"):
        return {"ok": True, "path": target, "command": "startfile"}
    return {"ok": False, "error": result.get("error") or "open_failed", "path": target}


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
            resolved = (
                dam_path_resolve.resolve_physical_path(
                    raw,
                    normalize_path=normalize_path,
                    marketing_candidates=MARKETING_CANDIDATES,
                    machine_config_path=MACHINE_CONFIG,
                )
                if dam_path_resolve
                else normalize_path(raw)
            )
            p = Path(resolved)
            if p.is_dir():
                start_dir = str(p)
            elif p.parent.is_dir():
                start_dir = str(p.parent)
        except OSError:
            start_dir = ""

    if not _PICK_FOLDER_LOCK.acquire(blocking=False):
        return {"ok": False, "error": "picker_busy"}

    if sys.platform == "darwin":
        # tkinter Tk() w watku spawnowanym = Cocoa wymaga glownego watku (crash/hang).
        try:
            native = platform_compat.pick_folder_native(
                start_dir, prompt="Wybierz folder Marketing (root)"
            )
        finally:
            _PICK_FOLDER_LOCK.release()
        if not native.get("ok"):
            return {"ok": False, "cancelled": native.get("error") == "cancelled", "error": native.get("error")}
        return {"ok": True, "path": native["path"], "cancelled": False}

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
    """Wykryj dostepne rooty Marketing na TYM komputerze (M:/X:/D: + dowolna litera).

    Kazda litera sprawdzana w osobnym watku; odpowiedz najpozniej po ok. 2-3 s,
    zawieszony dysk sieciowy dostaje ``timeout: true``. ``valid`` = wszystkie
    poprawne rooty w kolejnosci kandydatow, ``recommended`` = pierwszy z nich.
    """
    if marketing_discovery is not None:
        entries = marketing_discovery.probe_drives(required=REQUIRED_ROOT_FOLDERS)
        _set_marketing_candidates([e["path"] for e in entries if e.get("ok")])
        key = marketing_discovery.path_key
        by_key = {key(e["path"]): e for e in entries}
        preferred = {key(p) for p in marketing_discovery.PREFERRED_CANDIDATES}
        listed: list[dict] = []
        for cand in marketing_discovery.PREFERRED_CANDIDATES:
            e = by_key.get(key(cand)) or {}
            listed.append(
                {
                    "path": str(cand),
                    "ok": bool(e.get("ok")),
                    "exists": bool(e.get("exists")),
                    "missing": list(e.get("missing") or REQUIRED_ROOT_FOLDERS),
                    "timeout": bool(e.get("timeout")),
                }
            )
        for e in entries:
            if e.get("ok") and key(e["path"]) not in preferred:
                listed.append(
                    {"path": e["path"], "ok": True, "exists": True, "missing": [], "timeout": False}
                )
        valid = [x["path"] for x in listed if x["ok"]]
        return {
            "ok": True,
            "candidates": listed,
            "valid": valid,
            "recommended": valid[0] if valid else None,
            "required": list(REQUIRED_ROOT_FOLDERS),
        }
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


def build_preflight_report() -> dict:
    """GET /preflight: baza, folder Marketing, indeks, watcher, WebView2 (< 3 s, bez sesji)."""
    if dam_preflight is None:
        return {"ok": False, "error": "preflight_missing", "blocking": [], "items": []}

    def pg_module():
        try:
            import pg_db as _pg
        except Exception:  # noqa: BLE001
            return None
        return _pg

    if marketing_discovery is not None:
        path_key = marketing_discovery.path_key

        def check_paths(paths):
            return marketing_discovery.check_paths(
                paths,
                required=REQUIRED_ROOT_FOLDERS,
                timeout=dam_preflight.DRIVE_CHECK_TIMEOUT_SEC,
            )

        def discover():
            return marketing_discovery.discover_roots(
                required=REQUIRED_ROOT_FOLDERS,
                per_drive_timeout=dam_preflight.DRIVE_CHECK_TIMEOUT_SEC,
                timeout=dam_preflight.DRIVE_CHECK_TIMEOUT_SEC,
            )
    else:
        def path_key(p):
            return str(p).replace("/", "\\").rstrip("\\").lower()

        def check_paths(paths):
            out = {}
            for p in paths:
                info = validate_base(str(p))
                out[path_key(p)] = {
                    "ok": bool(info.get("ok")),
                    "exists": info.get("error") != "not_a_directory",
                    "missing": info.get("missing") or [],
                }
            return out

        def discover():
            return [c for c in MARKETING_CANDIDATES if validate_base(str(c)).get("ok")]

    def watcher_status():
        import index_supervisor

        return index_supervisor.public_status()

    checks = [
        ("database", lambda: dam_preflight.check_database(pg_module())),
        (
            "marketing",
            lambda: dam_preflight.check_marketing(
                read_machine_config().get("base_path") or "", check_paths, discover, path_key
            ),
        ),
        ("index", lambda: dam_preflight.check_index(INDEX_FILE)),
        ("watcher", lambda: dam_preflight.check_watcher(watcher_status)),
        ("webview2", dam_preflight.check_webview2),
    ]
    report = dam_preflight.run_checks(checks)
    report["api_version"] = BRIDGE_API_VERSION
    return report


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


def _assoc_status_payload() -> dict:
    try:
        import assoc_repo

        db_path = None
        if dam_db is not None:
            db_path = getattr(dam_db, "DB_CANONICAL", None)
        return assoc_repo.status_counts(db_path)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "counts": {}, "schema_error": str(exc), "total": 0}


def _index_db_snapshot() -> dict:
    if not dam_db:
        return {"ok": False, "error": "dam_db_missing"}
    try:
        snap = dam_db.ping()
        snap["online"] = bool(snap.get("ok"))
        snap["writes_ok"] = not bool(snap.get("writes_paused") or snap.get("offline_mode"))
        return snap
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def index_status() -> dict:
    mtime = None
    size = 0
    if INDEX_FILE.is_file():
        st = INDEX_FILE.stat()
        mtime = st.st_mtime
        size = st.st_size
    db = _index_db_snapshot()
    with _index_lock:
        state = dict(_index_state)
    watcher = {}
    try:
        import index_supervisor

        watcher = index_supervisor.public_status()
    except Exception as exc:  # noqa: BLE001
        watcher = {"ok": False, "watcher_ok": False, "last_error": str(exc), "stale": False}
    last_ok = watcher.get("last_ok") if watcher.get("last_ok") is not None else state.get("last_ok")
    progress = watcher.get("progress") if isinstance(watcher.get("progress"), dict) else {}
    if state.get("running"):
        elapsed = None
        started = state.get("last_started") or ""
        if started:
            try:
                ts = started.replace("Z", "+00:00")
                dt = datetime.fromisoformat(ts)
                elapsed = max(0, int((datetime.now(timezone.utc) - dt).total_seconds()))
            except Exception:
                elapsed = None
        last_dur = (watcher.get("watcher") or {}).get("last_duration_sec") if isinstance(watcher.get("watcher"), dict) else None
        remaining = None
        if last_dur and elapsed is not None:
            try:
                remaining = max(0, int(float(last_dur) - elapsed))
            except (TypeError, ValueError):
                remaining = None
        progress = {
            "running": True,
            "kind": state.get("kind") or "manual",
            "stage": state.get("stage") or "building",
            "started_at": started,
            "elapsed_sec": elapsed,
            "eta_sec": remaining,
            "remaining_sec": remaining,
            "pct": progress.get("pct"),
            "message": progress.get("current_item") or progress.get("message") or "Indeksowanie",
            "current_item": progress.get("current_item") or watcher.get("current_item") or "",
            "current_name": progress.get("current_name") or watcher.get("current_name") or "",
            "current_path": progress.get("current_path") or watcher.get("current_path") or "",
            "current_label": progress.get("current_label") or watcher.get("current_label") or "",
            "products_done": progress.get("products_done") if progress.get("products_done") is not None else watcher.get("products_done"),
            "products_total": progress.get("products_total") if progress.get("products_total") is not None else watcher.get("products_total"),
            "files_done": progress.get("files_done"),
            "files_total": progress.get("files_total"),
        }
    snoozed = bool(watcher.get("snoozed"))
    return {
        "ok": True,
        "index_path": str(INDEX_FILE),
        "mtime": mtime,
        "mtime_iso": datetime.fromtimestamp(mtime, timezone.utc).isoformat() if mtime else "",
        "size": size,
        "rebuild": state,
        "rebuild_running": bool(state.get("running") or progress.get("running")),
        "database": db,
        "watcher_ok": bool(watcher.get("watcher_ok")),
        "index_run_ok": last_ok is True,
        "awaiting_first_rebuild": last_ok is None,
        "watcher": watcher.get("watcher") or watcher,
        "last_ok": last_ok,
        "last_error": watcher.get("last_error") or state.get("last_error") or "",
        "last_rc": watcher.get("last_rc") if watcher.get("last_rc") is not None else state.get("last_rc"),
        "stale": bool(watcher.get("stale")),
        "assoc": _assoc_status_payload(),
        "progress": progress,
        "cancelable": bool(state.get("running") or watcher.get("cancelable") or progress.get("running")),
        "snoozed": snoozed,
        "snooze_until": watcher.get("snooze_until") or "",
        "control_path": watcher.get("control_path") or str(DESKTOP_STATE_DIR / "index-control.json"),
        "hourly_sec": watcher.get("hourly_sec"),
        "hourly_pending": bool(watcher.get("hourly_pending")),
        "current_item": progress.get("current_item") or watcher.get("current_item") or "",
        "current_name": progress.get("current_name") or watcher.get("current_name") or "",
        "current_path": progress.get("current_path") or watcher.get("current_path") or "",
        "current_label": progress.get("current_label") or watcher.get("current_label") or "",
        "new_items": watcher.get("new_items") or [],
        "last_report": watcher.get("last_report") or {},
    }


def _append_rebuild_log(line: str) -> None:
    try:
        DESKTOP_DATA_DIR.mkdir(parents=True, exist_ok=True)
        with INDEX_REBUILD_LOG_FILE.open("a", encoding="utf-8", errors="replace") as fh:
            fh.write(f"{utc_now()} {line}\n")
        if INDEX_REBUILD_LOG_FILE.is_file() and INDEX_REBUILD_LOG_FILE.stat().st_size > 2_000_000:
            bak = INDEX_REBUILD_LOG_FILE.with_suffix(".log.1")
            if bak.is_file():
                bak.unlink()
            INDEX_REBUILD_LOG_FILE.replace(bak)
    except OSError:
        pass


def _run_index_rebuild() -> None:
    global _index_state
    with _index_lock:
        if _index_state["running"]:
            return
        _index_state["running"] = True
        _index_state["last_started"] = utc_now()
        _index_state["last_error"] = ""
        _index_state["stage"] = "starting"
        _index_state["kind"] = "manual"
    try:
        import index_supervisor

        index_supervisor.begin_run_snapshot()
    except Exception:
        pass
    lock_handle = None
    try:
        from rebuild_lock import acquire_lock

        lock_handle, meta = acquire_lock(
            INDEX_REBUILD_LOCK_FILE,
            stage="manual:starting",
            ttl_sec=3600,
            extra={"owner": "local_bridge"},
        )
        if lock_handle is None:
            with _index_lock:
                _index_state["last_ok"] = False
                _index_state["last_error"] = "lock_held"
                _index_state["stage"] = "skipped_lock_held"
                _index_state["last_finished"] = utc_now()
            _append_rebuild_log(f"skip lock_held meta={meta}")
            return
        if not BUILD_INDEX.is_file():
            raise FileNotFoundError(str(BUILD_INDEX))
        _drop_json_cache(INDEX_FILE)
        _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        DESKTOP_DATA_DIR.mkdir(parents=True, exist_ok=True)
        with _index_lock:
            _index_state["stage"] = "building"
        lock_handle.update(stage="manual:building")
        with INDEX_REBUILD_LOG_FILE.open("a", encoding="utf-8", errors="replace") as log_f:
            log_f.write(f"\n==== rebuild start {utc_now()} pid={os.getpid()} ====\n")
            log_f.flush()
            try:
                import index_supervisor as _idx_sup

                _rebuild_env = _idx_sup.index_builder_env()
            except Exception:
                _rebuild_env = os.environ.copy()
                _rebuild_env["DAM_INDEX_LIVE_FILE"] = str(DESKTOP_STATE_DIR / "index-live.json")
            proc = subprocess.Popen(
                [sys.executable, "-u", str(BUILD_INDEX)],
                creationflags=_no_win,
                stdin=subprocess.DEVNULL,
                stdout=log_f,
                stderr=subprocess.STDOUT,
                env=_rebuild_env,
            )
            try:
                lock_handle.update(child_pid=proc.pid)
            except Exception:
                pass
            with _index_lock:
                _index_state["child_pid"] = proc.pid
            try:
                import index_supervisor

                rc = index_supervisor.wait_rebuild_proc(
                    proc, lock_handle=lock_handle, log_file=INDEX_REBUILD_LOG_FILE
                )
            except Exception:
                rc = int(proc.wait())
        with _index_lock:
            _index_state["last_rc"] = rc
            _index_state["last_ok"] = rc == 0
            _index_state["last_finished"] = utc_now()
            _index_state["stage"] = "cancelled" if rc == 130 else ("idle" if rc == 0 else "error")
            if rc == 130:
                _index_state["last_error"] = "cancelled"
            elif rc != 0:
                _index_state["last_error"] = f"build_rc_{rc}"
        _append_rebuild_log(f"finished rc={rc}")
        try:
            import index_supervisor

            index_supervisor.complete_run_report(ok=(rc == 0), cancelled=(rc == 130), rc=rc)
        except Exception as report_exc:  # noqa: BLE001
            _append_rebuild_log(f"index_report {report_exc}")
        try:
            import index_supervisor

            # _for_merge: koperta bledu z czytania nie moze wjechac na dysk
            # jako watcher_ok=false (to wlasnie zamrazalo pasek na pulpicie).
            prev = index_supervisor.read_watcher_status_for_merge()
            index_supervisor.write_watcher_status(
                {
                    "ok": rc == 0,
                    "watcher_ok": bool(prev.get("watcher_ok", True)),
                    "stage": prev.get("stage") or "monitoring",
                    "pid": prev.get("pid"),
                    "last_ok": rc == 0,
                    "last_rc": rc,
                    "last_error": "" if rc == 0 else f"build_rc_{rc}",
                    "last_started": _index_state.get("last_started") or "",
                    "last_finished": _index_state.get("last_finished") or utc_now(),
                },
                preserve_last=False,
            )
        except Exception as status_exc:  # noqa: BLE001
            _append_rebuild_log(f"watcher_status_sync {status_exc}")
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
            # Hook: branding grid/search must follow file-index (one pipeline, no second watcher).
            try:
                br = start_branding_rebuild()
                _append_rebuild_log(
                    f"branding_hook_after_index started={br.get('started')} running={br.get('running')}"
                )
            except Exception as br_exc:  # noqa: BLE001
                _append_rebuild_log(f"branding_hook_after_index_error {br_exc}")
            try:
                warm = _warm_viz_thumbs_from_index(limit=64)
                _append_rebuild_log(
                    f"viz_thumb_warm queued={warm.get('queued')} ok={warm.get('ok')}"
                )
            except Exception as warm_exc:  # noqa: BLE001
                _append_rebuild_log(f"viz_thumb_warm_error {warm_exc}")
            try:
                if dam_thumb_cache:
                    pub = dam_thumb_cache.start_publish_after_index()
                    _append_rebuild_log(f"cache_publish started={pub.get('started')}")
            except Exception as pub_exc:  # noqa: BLE001
                _append_rebuild_log(f"cache_publish_error {pub_exc}")
    except Exception as exc:  # noqa: BLE001
        with _index_lock:
            _index_state["last_ok"] = False
            _index_state["last_error"] = str(exc)
            _index_state["last_finished"] = utc_now()
            _index_state["stage"] = "error"
        _append_rebuild_log(f"error {exc}")
    finally:
        if lock_handle is not None:
            try:
                lock_handle.release()
            except Exception:
                pass
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


def index_cancel() -> dict:
    try:
        import index_supervisor

        return index_supervisor.request_cancel()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def index_snooze(*, until: str = "eod") -> dict:
    try:
        import index_supervisor

        if str(until or "eod").strip().lower() in ("clear", "off", "0"):
            return index_supervisor.clear_snooze()
        return index_supervisor.snooze_until_end_of_day()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def _canonical_sqlite_path() -> Path:
    """Kanoniczny dam-local.sqlite (ADR-007/010) dla --from-sqlite Path."""
    from branding_publish import canonical_sqlite_path

    return canonical_sqlite_path(
        dam_db_module=dam_db,
        desktop_dir=Path(__file__).resolve().parent,
    )


def _grid_from_sqlite_argv(sqlite_path: Path | None = None) -> list[str]:
    """Argv for build-branding-grid-index.py --from-sqlite <Path> (required Path)."""
    from branding_publish import grid_from_sqlite_argv

    db = Path(sqlite_path) if sqlite_path is not None else _canonical_sqlite_path()
    return grid_from_sqlite_argv(BUILD_BRANDING_GRID_INDEX, db)


def _branding_generation_id() -> str:
    """generation_id = fat mtime/size + SQLite assoc revision."""
    try:
        st = BRANDING_INDEX_FILE.stat()
        fat_sig = f"{int(st.st_mtime)}:{st.st_size}"
    except OSError:
        fat_sig = "0:0"
    assoc = _assoc_status_payload()
    return f"{fat_sig}:assoc{assoc.get('total', 0)}"


def _write_branding_status(extra: dict | None = None) -> None:
    with _branding_rebuild_lock:
        payload = {
            "ok": _branding_rebuild_state.get("last_ok") is not False,
            "state": "running" if _branding_rebuild_state.get("running") else (
                "ok" if _branding_rebuild_state.get("last_ok") else (
                    "error" if _branding_rebuild_state.get("last_ok") is False else "idle"
                )
            ),
            **dict(_branding_rebuild_state),
            "assoc": _assoc_status_payload(),
            "sqlite_path": str(_canonical_sqlite_path()),
            "updated_at": utc_now(),
        }
    if extra:
        payload.update(extra)
    try:
        _save_json(BRANDING_STATUS_FILE, payload)
    except Exception:
        BRANDING_STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
        BRANDING_STATUS_FILE.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )


def _run_branding_rebuild() -> None:
    global _branding_rebuild_state
    with _branding_rebuild_lock:
        if _branding_rebuild_state["running"]:
            return
        _branding_rebuild_state["running"] = True
        _branding_rebuild_state["last_started"] = utc_now()
        _branding_rebuild_state["last_error"] = ""
        _branding_rebuild_state["stage"] = "starting"
        _branding_rebuild_state["generation_id"] = _branding_generation_id()
    lock_handle = None
    try:
        from rebuild_lock import acquire_lock

        lock_handle, meta = acquire_lock(
            BRANDING_REBUILD_LOCK_FILE,
            stage="branding:starting",
            ttl_sec=BRANDING_LOCK_TTL_SEC,
            extra={
                "owner": "local_bridge_full",
                "mode": "full",
                "generation_id": _branding_rebuild_state["generation_id"],
            },
        )
        if lock_handle is None:
            with _branding_rebuild_lock:
                _branding_rebuild_state["last_ok"] = False
                _branding_rebuild_state["last_error"] = "lock_held"
                _branding_rebuild_state["stage"] = "skipped_lock_held"
                _branding_rebuild_state["last_finished"] = utc_now()
            _write_branding_status({"lock": meta.get("lock")})
            return
        if not BUILD_BRANDING_INDEX.is_file():
            raise FileNotFoundError(str(BUILD_BRANDING_INDEX))
        _no_win = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
        from branding_publish import resolve_script_python

        # pythonw + same site-packages (ijson); python.exe flashes CMD.
        try:
            script_py = resolve_script_python(require_ijson=True)
        except RuntimeError as ijson_exc:
            raise RuntimeError(str(ijson_exc)) from ijson_exc
        # Stage 1: fat builder (keeps WIZKI) — fat does not need ijson; same exe for consistency
        with _branding_rebuild_lock:
            _branding_rebuild_state["stage"] = "fat"
        lock_handle.update(stage="branding:fat")
        _write_branding_status()
        _append_rebuild_log(f"branding_script_python {script_py}")
        rc = subprocess.call([script_py, str(BUILD_BRANDING_INDEX)], creationflags=_no_win)
        if rc != 0:
            raise RuntimeError(f"fat_build_rc_{rc}")
        # Stage 2: slim grid from SQLite (explicit Path — argparse requires it)
        if BUILD_BRANDING_GRID_INDEX.is_file():
            with _branding_rebuild_lock:
                _branding_rebuild_state["stage"] = "grid_from_sqlite"
            lock_handle.update(stage="branding:grid_from_sqlite")
            _write_branding_status()
            grid_cmd = _grid_from_sqlite_argv()
            _append_rebuild_log(f"full_grid_cmd {' '.join(grid_cmd)}")
            rc2 = subprocess.call(
                grid_cmd,
                creationflags=_no_win,
                cwd=str(BUILD_BRANDING_GRID_INDEX.parent),
            )
            if rc2 != 0:
                raise RuntimeError(f"grid_build_rc_{rc2}")
        # Stage 3: invalidate caches only after success
        with _branding_rebuild_lock:
            _branding_rebuild_state["stage"] = "cache_invalidate"
        _invalidate_branding_data_caches()
        with _branding_rebuild_lock:
            _branding_rebuild_state["last_rc"] = 0
            _branding_rebuild_state["last_ok"] = True
            _branding_rebuild_state["last_finished"] = utc_now()
            _branding_rebuild_state["stage"] = "idle"
            _branding_rebuild_state["generation_id"] = _branding_generation_id()
        _write_branding_status()
    except Exception as exc:  # noqa: BLE001
        with _branding_rebuild_lock:
            _branding_rebuild_state["last_ok"] = False
            _branding_rebuild_state["last_error"] = str(exc)
            _branding_rebuild_state["last_finished"] = utc_now()
            _branding_rebuild_state["stage"] = "error"
        _write_branding_status()
    finally:
        if lock_handle is not None:
            try:
                lock_handle.release()
            except Exception:
                pass
        with _branding_rebuild_lock:
            _branding_rebuild_state["running"] = False
        _write_branding_status()


def start_branding_rebuild() -> dict:
    with _branding_rebuild_lock:
        if _branding_rebuild_state["running"]:
            return {
                "ok": True,
                "started": False,
                "running": True,
                "rebuild": dict(_branding_rebuild_state),
            }
    threading.Thread(target=_run_branding_rebuild, daemon=True).start()
    time.sleep(0.05)
    with _branding_rebuild_lock:
        state = dict(_branding_rebuild_state)
    return {"ok": True, "started": True, "running": True, "rebuild": state}


def _ensure_slim_publisher() -> Any:
    """Lazy SlimGridPublisher bound to bridge branding state/paths."""
    global _slim_publisher
    from branding_publish import SlimGridPublisher

    if _slim_publisher is not None:
        # Refresh paths that may be patched in tests
        _slim_publisher.grid_script = BUILD_BRANDING_GRID_INDEX
        _slim_publisher.lock_file = BRANDING_REBUILD_LOCK_FILE
        _slim_publisher.sqlite_path = _canonical_sqlite_path()
        return _slim_publisher

    def _write(extra: dict | None) -> None:
        _write_branding_status(extra)

    _slim_publisher = SlimGridPublisher(
        grid_script=BUILD_BRANDING_GRID_INDEX,
        lock_file=BRANDING_REBUILD_LOCK_FILE,
        sqlite_path=_canonical_sqlite_path(),
        invalidate_caches=_invalidate_branding_data_caches,
        write_status=_write,
        append_log=_append_rebuild_log,
        generation_id_fn=_branding_generation_id,
        state=_branding_rebuild_state,
        state_lock=_branding_rebuild_lock,
        debounce_sec=SLIM_PUBLISH_DEBOUNCE_SEC,
        lock_ttl_sec=BRANDING_LOCK_TTL_SEC,
    )
    return _slim_publisher


def _schedule_slim_grid_publish(delay_sec: float | None = None) -> None:
    """Debounced slim publish: one pending timer/generation; runner uses branding O_EXCL lock."""
    if not BUILD_BRANDING_GRID_INDEX.is_file():
        return
    pub = _ensure_slim_publisher()
    pub.schedule(delay_sec=delay_sec)


_INDEX_RE = re.compile(r"^(FOL\d+|\d{5,9})(\.\d{2})?$", re.IGNORECASE)


def _is_under_marketing(path: Path) -> bool:
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


def variant_note_key(raw: str) -> str:
    """Klucz notatki = sam indeks, bez ".00".

    Firma wycofuje sie z koncowki ".00", a ten sam wariant wystepuje w indeksie
    raz jako "6300631.00", raz jako "6300631". Jeden klucz = jedna notatka,
    niezaleznie od tego, ktora forma akurat trafila do nazwy folderu.
    """
    txt = str(raw or "").strip()
    m = re.search(r"(\d{6,8})(?:\.\d+)?", txt)
    if m:
        return m.group(1)
    return re.sub(r"\s+", " ", txt).strip()


VARIANT_NOTE_MAX = 120
# Kto moze zatwierdzac cudze zmiany w opisie chronionym.
VARIANT_NOTE_APPROVERS = ("admin", "power_user")


def read_variant_notes() -> dict:
    data = _load_json(WEB_ROOT / "data" / "variant-notes.json", {"notes": {}, "pending": {}})
    if not isinstance(data.get("notes"), dict):
        data["notes"] = {}
    if not isinstance(data.get("pending"), dict):
        data["pending"] = {}
    return data


def _save_variant_notes(data: dict) -> None:
    data["updated_at"] = utc_now()
    _save_json(WEB_ROOT / "data" / "variant-notes.json", data)


def _clean_note_text(note: str) -> str:
    return re.sub(r"\s+", " ", str(note or "")).strip()[:VARIANT_NOTE_MAX]


def upsert_variant_note(raw_key: str, note: str, actor: str = "", role: str = "") -> dict:
    """Opis wariantu widoczny obok indeksu. NIE zmienia nazwy folderu na dysku.

    Zasada uprawnien:
      - opisu moze dodac KAZDY zalogowany i wchodzi od razu,
      - opis zalozony lub zmieniony przez admina/power_usera jest chroniony:
        zwykly uzytkownik moze go tylko ZAPROPONOWAC, a zmiana czeka na
        zatwierdzenie przez admina albo power_usera,
      - admin i power_user nadpisuja bez pytania.
    """
    key = variant_note_key(raw_key)
    if not key:
        return {"ok": False, "error": "index_required"}
    text = _clean_note_text(note)
    role_n = str(role or "").strip().lower()
    is_approver = role_n in VARIANT_NOTE_APPROVERS
    data = read_variant_notes()
    # Plik jest edytowalny recznie i bywa rwany przez synchronizacje - nie
    # zakladaj, ze oba klucze istnieja.
    if not isinstance(data.get("notes"), dict):
        data["notes"] = {}
    if not isinstance(data.get("pending"), dict):
        data["pending"] = {}
    existing = data["notes"].get(key) or {}
    protected = bool(existing.get("protected"))

    if protected and not is_approver:
        data["pending"][key] = {
            "note": text,
            "replaces": str(existing.get("note") or ""),
            "by": actor or "",
            "at": utc_now(),
        }
        _save_variant_notes(data)
        append_change_log(
            {"action": "variant_note_proposed", "category": "index", "index": key, "note": text}
        )
        notify_admins_note_proposal(key, text, str(existing.get("note") or ""), actor)
        return {
            "ok": True,
            "index": key,
            "pending": True,
            "note": str(existing.get("note") or ""),
            "proposed": text,
            "hint": "Opis zalozyl admin - zmiana czeka na zatwierdzenie.",
        }

    if text:
        data["notes"][key] = {
            "note": text,
            "updated_at": utc_now(),
            "updated_by": actor or "",
            # Chroniony dopiero wtedy, gdy autorem jest admin/power_user.
            "protected": is_approver,
        }
    else:
        data["notes"].pop(key, None)
    data["pending"].pop(key, None)
    _save_variant_notes(data)
    append_change_log(
        {"action": "variant_note", "category": "index", "index": key, "note": text}
    )
    return {"ok": True, "index": key, "note": text, "pending": False}


def _norm_tag(name: str) -> str:
    """Klucz slownika opisow. Wielkosc liter i nadmiarowe spacje nie tworza
    nowego tagu - inaczej GRILL, Grill i "na grilla" bylyby trzema bytami."""
    return re.sub(r"\s+", " ", str(name or "")).strip().upper()


def _month_ok(month: int) -> bool:
    return isinstance(month, int) and 1 <= month <= 12


def read_variant_tags() -> dict:
    data = read_variant_notes()
    tags = data.get("tags")
    return tags if isinstance(tags, dict) else {}


def variant_tag_suggestions(limit: int = 60) -> list[dict]:
    """Slownik opisow: to, czego juz uzyto, plus tagi z sezonem.

    Bez podpowiedzi ten sam wyroznik zapisze sie jako GRILL, Grill i
    "na grilla" - trzy byty zamiast jednego, nie do wyszukania razem.
    """
    data = read_variant_notes()
    notes = data.get("notes") if isinstance(data.get("notes"), dict) else {}
    tags = data.get("tags") if isinstance(data.get("tags"), dict) else {}
    counts: dict[str, dict] = {}
    for entry in notes.values():
        text = str((entry or {}).get("note") or "").strip()
        if not text:
            continue
        key = _norm_tag(text)
        row = counts.setdefault(key, {"tag": text, "uses": 0})
        row["uses"] += 1
    for key, meta in tags.items():
        row = counts.setdefault(_norm_tag(key), {"tag": str(key), "uses": 0})
        season = (meta or {}).get("season") or {}
        if _month_ok(season.get("from")) and _month_ok(season.get("to")):
            row["season"] = {"from": int(season["from"]), "to": int(season["to"])}
    out = sorted(counts.values(), key=lambda r: (-r["uses"], r["tag"].lower()))
    return out[: max(1, int(limit or 60))]


def upsert_variant_tag(name: str, season_from=None, season_to=None) -> dict:
    """Sezon tagu. Poza sezonem wariant nadal JEST aktualny - po prostu nie
    jest teraz w obiegu (grill w styczniu). Dlatego nie kasujemy statusu,
    tylko oznaczamy "poza sezonem"."""
    key = _norm_tag(name)
    if not key:
        return {"ok": False, "error": "tag_required"}
    data = read_variant_notes()
    if not isinstance(data.get("tags"), dict):
        data["tags"] = {}
    if season_from is None and season_to is None:
        data["tags"].pop(key, None)
        _save_variant_notes(data)
        return {"ok": True, "tag": key, "season": None}
    try:
        mf, mt = int(season_from), int(season_to)
    except (TypeError, ValueError):
        return {"ok": False, "error": "bad_month"}
    if not _month_ok(mf) or not _month_ok(mt):
        return {"ok": False, "error": "bad_month"}
    data["tags"][key] = {"season": {"from": mf, "to": mt}, "updated_at": utc_now()}
    _save_variant_notes(data)
    append_change_log(
        {"action": "variant_tag_season", "category": "index", "tag": key, "from": mf, "to": mt}
    )
    return {"ok": True, "tag": key, "season": {"from": mf, "to": mt}}


def resolve_variant_note_proposal(raw_key: str, accept: bool, actor: str = "") -> dict:
    """Zatwierdzenie albo odrzucenie propozycji zwyklego uzytkownika."""
    key = variant_note_key(raw_key)
    data = read_variant_notes()
    if not isinstance(data.get("notes"), dict):
        data["notes"] = {}
    if not isinstance(data.get("pending"), dict):
        data["pending"] = {}
    proposal = data["pending"].get(key)
    if not proposal:
        return {"ok": False, "error": "no_pending_proposal"}
    if accept:
        text = _clean_note_text(proposal.get("note") or "")
        if text:
            data["notes"][key] = {
                "note": text,
                "updated_at": utc_now(),
                "updated_by": str(proposal.get("by") or ""),
                "approved_by": actor or "",
                "protected": True,
            }
        else:
            data["notes"].pop(key, None)
    data["pending"].pop(key, None)
    _save_variant_notes(data)
    append_change_log(
        {
            "action": "variant_note_accepted" if accept else "variant_note_rejected",
            "category": "index",
            "index": key,
            "note": str(proposal.get("note") or ""),
        }
    )
    return {"ok": True, "index": key, "accepted": bool(accept)}


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
    raw = (
        dam_path_resolve.resolve_physical_path(
            path or "",
            normalize_path=normalize_path,
            marketing_candidates=MARKETING_CANDIDATES,
            machine_config_path=MACHINE_CONFIG,
        )
        if dam_path_resolve
        else normalize_path(path or "")
    )
    target = Path(raw)
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

_LANG_ALIAS_CANON = {"gb": "en", "uk": "en", "ukr": "ua"}  # UA stays ua — never ua->uk
_KNOWN_LANG_FOR_FOLDER = frozenset({
    "pl", "de", "en", "ua", "cz", "sk", "hu", "ro", "lt", "lv", "ee",
    "fr", "it", "es", "nl", "ru", "hr", "si", "bg", "at", "be", "dk",
    "se", "no", "fi", "pt", "gr", "ie", "ch", "ar",
})


def canonicalize_lang_code(code: str) -> str:
    c = (code or "").strip().lower()
    if not c or c in ("?", "unknown", "xx"):
        return ""
    if c == "ua":
        return "ua"
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
PRODUCT_LIFECYCLE_FILE = WEB_ROOT / "data" / "product-lifecycle.json"
PRODUCT_PRICES_CACHE_FILE = WEB_ROOT / "data" / "product-prices-cache.json"
BULK_PACKAGING_FILE = WEB_ROOT / "data" / "bulk-packaging.json"
SHOP_CATEGORIES_FILE = WEB_ROOT / "data" / "shop-categories.json"
BRANDING_INDEX_FILE = WEB_ROOT / "data" / "branding-index.json"
BRANDING_SEARCH_INDEX_FILE = WEB_ROOT / "data" / "branding-search-index.json"
BRANDING_OVERRIDES_FILE = WEB_ROOT / "data" / "branding-metadata-overrides.json"
BRANDING_ASSOC_OVERRIDES_FILE = WEB_ROOT / "data" / "branding-associations-overrides.json"
BRANDING_STATUS_FILE = WEB_ROOT / "data" / "branding-build-status.json"
BRANDING_RECOGNIZE_STATUS_FILE = WEB_ROOT / "data" / "branding-recognize-status.json"
WYKROJNIKI_REGISTRY_FILE = WEB_ROOT / "data" / "wykrojniki-registry.json"
BUILD_BRANDING_INDEX = WEB_ROOT / "scripts" / "build-branding-index.py"
BUILD_BRANDING_GRID_INDEX = WEB_ROOT / "scripts" / "build-branding-grid-index.py"
DESKTOP_DATA_DIR = Path(__file__).resolve().parent / "data"
try:
    from rebuild_lock import STATE_DIR as DESKTOP_STATE_DIR
except Exception:  # noqa: BLE001 - mostek musi wstac nawet bez modulu blokad
    DESKTOP_STATE_DIR = DESKTOP_DATA_DIR
BACKGROUND_JOBS_FILE = DESKTOP_DATA_DIR / "background-jobs.json"
# Ulotny stan indeksu: poza repo, bo repo lustrzy Synology Drive (rwie pliki w locie).
INDEX_REBUILD_LOCK_FILE = DESKTOP_STATE_DIR / "index-rebuild.lock.json"
INDEX_WATCHER_STATUS_FILE = DESKTOP_STATE_DIR / "index-watcher-status.json"
INDEX_REBUILD_LOG_FILE = DESKTOP_STATE_DIR / "index-rebuild.log"
BRANDING_REBUILD_LOCK_FILE = DESKTOP_DATA_DIR / "branding-rebuild.lock.json"
FETCH_PRODUCT_PRICES = WEB_ROOT / "scripts" / "fetch-product-prices.py"
IMPORT_WYKROJNIKI = WEB_ROOT / "scripts" / "import-wykrojniki-xlsx.py"
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

# Scheduled / in-app background jobs (Settings: Zadania w tle).
# Gate: DAM.exe OR dam-appw.exe. python serve_browser.py is NOT enough.
_BG_JOB_CATALOG = (
    {
        "id": "panel-dam-sync",
        "title": "Sync Panel-DAM na NAS",
        "why": "Co godzine kopiuje panel (bin/apps/web) na W:\\web\\Panel-DAM, zeby wersja na synology.me byla aktualna. Bez DAM.exe / dam-appw.exe zadanie konczy sie od razu, bez okna.",
        "task_name": "DAM-Panel-DAM-HourlySync",
        "kind": "scheduled",
        "can_run": True,
        "can_toggle": True,
    },
    {
        "id": "db-git-sync",
        "title": "Kopia zrzutow bazy do gita",
        "why": "Zapasowy sync dumpow Postgres. Gdy DAM jest otwarty, zrzut robi watek mostu. Harmonogram milczy przy zamknietej aplikacji.",
        "task_name": "DAM-ETA-Database-Git-Sync",
        "kind": "scheduled",
        "can_run": True,
        "can_toggle": True,
    },
    {
        "id": "pg-backup-watcher",
        "title": "Zrzut Postgres (watek mostu)",
        "why": "Co godzine zapisuje dam_eta_*.sql.gz. Dziala tylko wewnatrz otwartego DAM (local_bridge), bez osobnego okna.",
        "task_name": "",
        "kind": "in-app",
        "can_run": True,
        "can_toggle": True,
    },
    {
        "id": "index-supervisor",
        "title": "Nadzor indeksu plikow",
        "why": "Odswieza indeks, gdy DAM jest otwarty. Wymagane do wyszukiwania. Nie ma osobnego okna CMD.",
        "task_name": "",
        "kind": "in-app",
        "can_run": False,
        "can_toggle": False,
    },
)


def _bg_no_window_kwargs() -> dict:
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
    si = None
    if sys.platform == "win32":
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        si.wShowWindow = 0
    return {"creationflags": flags, "startupinfo": si}


def _dam_desktop_processes() -> list[str]:
    found: list[str] = []
    try:
        r = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq DAM.exe", "/FO", "CSV", "/NH"],
            capture_output=True,
            text=True,
            timeout=8,
            **_bg_no_window_kwargs(),
        )
        if r.stdout and "DAM.exe" in r.stdout and "INFO:" not in r.stdout:
            found.append("DAM.exe")
    except Exception:
        pass
    try:
        r = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq dam-appw.exe", "/FO", "CSV", "/NH"],
            capture_output=True,
            text=True,
            timeout=8,
            **_bg_no_window_kwargs(),
        )
        if r.stdout and "dam-appw.exe" in r.stdout.lower() and "INFO:" not in r.stdout:
            found.append("dam-appw.exe")
    except Exception:
        pass
    return found


def _read_background_jobs_file() -> dict:
    DESKTOP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not BACKGROUND_JOBS_FILE.is_file():
        return {"updated_at": None, "jobs": {}}
    try:
        data = json.loads(BACKGROUND_JOBS_FILE.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {"updated_at": None, "jobs": {}}
        jobs = data.get("jobs")
        if not isinstance(jobs, dict):
            data["jobs"] = {}
        else:
            junk = {
                "IsFixedSize",
                "IsSynchronized",
                "Count",
                "IsReadOnly",
                "Values",
                "Keys",
                "SyncRoot",
            }
            data["jobs"] = {k: v for k, v in jobs.items() if k not in junk}
        return data
    except Exception:
        return {"updated_at": None, "jobs": {}}


def _write_background_jobs_file(data: dict) -> None:
    DESKTOP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = BACKGROUND_JOBS_FILE.with_suffix(".json.tmp")
    payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(BACKGROUND_JOBS_FILE)


def _job_auto_enabled(job_id: str, stored: dict) -> bool:
    entry = (stored.get("jobs") or {}).get(job_id) or {}
    if not isinstance(entry, dict):
        return True
    if "auto" not in entry:
        return True
    return bool(entry.get("auto"))


def _query_schtask(name: str) -> dict:
    if not name:
        return {"exists": False}
    try:
        r = subprocess.run(
            ["schtasks", "/query", "/tn", name, "/fo", "LIST", "/v"],
            capture_output=True,
            text=True,
            timeout=15,
            **_bg_no_window_kwargs(),
        )
    except Exception as exc:  # noqa: BLE001
        return {"exists": False, "error": str(exc)}
    if r.returncode != 0:
        return {"exists": False, "error": (r.stderr or r.stdout or "").strip()[:400]}
    info = {"exists": True, "hidden": None, "state": None, "last_run": None, "last_result": None, "to_run": None}
    for raw in (r.stdout or "").splitlines():
        if ":" not in raw:
            continue
        key, val = raw.split(":", 1)
        key = key.strip()
        val = val.strip()
        if key == "Last Run Time":
            info["last_run"] = val
        elif key == "Last Result":
            info["last_result"] = val
        elif key == "Scheduled Task State":
            info["state"] = val
        elif key == "Task To Run":
            info["to_run"] = val
        elif key == "Status":
            info["status"] = val
    try:
        ps = (
            f"$t=Get-ScheduledTask -TaskName '{name}' -ErrorAction Stop; "
            "$t.Settings.Hidden; $t.State"
        )
        r2 = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-Command",
                ps,
            ],
            capture_output=True,
            text=True,
            timeout=15,
            **_bg_no_window_kwargs(),
        )
        lines = [ln.strip() for ln in (r2.stdout or "").splitlines() if ln.strip()]
        if lines:
            info["hidden"] = lines[0].lower() in ("true", "1")
            if len(lines) > 1:
                info["state_ps"] = lines[1]
    except Exception:
        pass
    return info


def _set_schtask_enabled(name: str, enabled: bool) -> dict:
    flag = "/ENABLE" if enabled else "/DISABLE"
    try:
        r = subprocess.run(
            ["schtasks", "/Change", "/TN", name, flag],
            capture_output=True,
            text=True,
            timeout=20,
            **_bg_no_window_kwargs(),
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
    if r.returncode != 0:
        return {
            "ok": False,
            "error": (r.stderr or r.stdout or "schtasks_change_failed").strip()[:400],
            "escalate": "admin" in (r.stderr or "").lower() or r.returncode in (1, 2),
        }
    return {"ok": True, "enabled": enabled}


def _start_bg_job_hidden(job_id: str) -> dict:
    if job_id == "db-git-sync":
        # sync-database-backups-to-git.py = ssh syno + git. Dev/build machine only.
        if app_updates is None:
            return {"ok": False, "error": "app_updates_missing"}
        try:
            if not app_updates.is_portable_repo():
                return {"ok": False, "error": "not_dev_tree", "portable": False}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": f"portable_check_error:{exc}"}
    wrapper = DESKTOP_DIR.parent.parent / "scripts" / "ops" / "run-dam-bg-job.ps1"
    if not wrapper.is_file():
        return {"ok": False, "error": f"missing_wrapper:{wrapper}"}
    try:
        subprocess.Popen(
            [
                "powershell.exe",
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(wrapper),
                "-JobId",
                job_id,
                "-Force",
            ],
            cwd=str(wrapper.parent),
            **_bg_no_window_kwargs(),
        )
        return {"ok": True, "started": True, "hidden": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def background_jobs_status() -> dict:
    stored = _read_background_jobs_file()
    dam_procs = _dam_desktop_processes()
    jobs_out = []
    for spec in _BG_JOB_CATALOG:
        job_id = spec["id"]
        stored_job = (stored.get("jobs") or {}).get(job_id) or {}
        if not isinstance(stored_job, dict):
            stored_job = {}
        auto = _job_auto_enabled(job_id, stored)
        task = _query_schtask(spec.get("task_name") or "") if spec.get("task_name") else {}
        last_run = stored_job.get("last_run") or task.get("last_run")
        last_status = stored_job.get("last_status")
        item = {
            "id": job_id,
            "title": spec["title"],
            "why": spec["why"],
            "kind": spec["kind"],
            "can_run": spec["can_run"],
            "can_toggle": spec["can_toggle"],
            "auto": auto,
            "gate": "DAM.exe or dam-appw.exe",
            "hidden": True,
            "task_name": spec.get("task_name") or None,
            "task": task,
            "last_run": last_run,
            "last_status": last_status,
            "last_detail": stored_job.get("last_detail"),
        }
        if spec["kind"] == "in-app":
            item["task"] = {
                "exists": False,
                "in_app": True,
                "state": "Ready" if dam_procs else "Stopped",
            }
        jobs_out.append(item)
    startup = []
    try:
        start_dir = Path.home() / (
            "AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
        )
        if start_dir.is_dir():
            for p in start_dir.iterdir():
                if "DAM" in p.name.upper() or "dam" in p.name:
                    startup.append({"name": p.name, "path": str(p)})
    except Exception:
        pass
    return {
        "ok": True,
        "dam_running": bool(dam_procs),
        "dam_processes": dam_procs,
        "gate": "DAM.exe or dam-appw.exe (not python serve_browser)",
        "file": str(BACKGROUND_JOBS_FILE),
        "startup": startup,
        "jobs": jobs_out,
    }


def background_jobs_apply(payload: dict) -> dict:
    job_id = str(payload.get("id") or "").strip()
    action = str(payload.get("action") or "").strip().lower()
    spec = next((s for s in _BG_JOB_CATALOG if s["id"] == job_id), None)
    if spec is None:
        return {"ok": False, "error": "unknown_job"}
    stored = _read_background_jobs_file()
    jobs = stored.setdefault("jobs", {})
    if not isinstance(jobs, dict):
        jobs = {}
        stored["jobs"] = jobs
    entry = jobs.get(job_id) if isinstance(jobs.get(job_id), dict) else {}
    from datetime import datetime as _dt

    stamp = _dt.now().strftime("%Y-%m-%dT%H:%M:%S")

    if action == "toggle":
        if not spec["can_toggle"]:
            return {"ok": False, "error": "toggle_locked"}
        enabled = bool(payload.get("auto")) if "auto" in payload else not _job_auto_enabled(job_id, stored)
        entry = dict(entry)
        entry["auto"] = enabled
        entry["updated_at"] = stamp
        jobs[job_id] = entry
        stored["updated_at"] = stamp
        _write_background_jobs_file(stored)
        task_res = {"ok": True, "skipped": True}
        if spec.get("task_name"):
            task_res = _set_schtask_enabled(spec["task_name"], enabled)
        return {
            "ok": True,
            "id": job_id,
            "auto": enabled,
            "task": task_res,
            "status": background_jobs_status(),
        }

    if action == "run":
        if not spec["can_run"]:
            return {"ok": False, "error": "run_locked"}
        if spec["kind"] == "in-app" and job_id == "pg-backup-watcher":
            result = run_hourly_pg_backup()
            entry = dict(entry)
            entry["last_run"] = stamp
            entry["last_status"] = "ok" if result.get("ok") else "error"
            entry["last_detail"] = json.dumps(result, ensure_ascii=False)[:400]
            jobs[job_id] = entry
            stored["updated_at"] = stamp
            _write_background_jobs_file(stored)
            return {"ok": bool(result.get("ok")), "id": job_id, "result": result}
        started = _start_bg_job_hidden(job_id)
        entry = dict(entry)
        entry["last_run"] = stamp
        entry["last_status"] = "started" if started.get("ok") else "error"
        entry["last_detail"] = started.get("error") or "hidden start"
        jobs[job_id] = entry
        stored["updated_at"] = stamp
        _write_background_jobs_file(stored)
        return {**started, "id": job_id}

    return {"ok": False, "error": "unknown_action"}


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
    "variant-notes",
    "elements-overrides",
    "viz-flags",
    "thumb-overrides",
    "thumb-cache-manifest",
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


def _kv_key_or_none(raw: str) -> str | None:
    key = str(raw or "").strip()
    return key if key in KV_STORE_KEYS else None


def _db_changes_payload(since: str) -> dict:
    """GET /db/changes - tani SELECT, bez payload. Przy braku PG: szybko db_unavailable."""
    try:
        import pg_db
    except Exception:
        return {"ok": False, "error": "db_unavailable"}
    health = pg_db.cached_health()
    if not health.get("ok"):
        return {"ok": False, "error": "db_unavailable"}
    try:
        return pg_db.kv_changes_since(since)
    except Exception:
        return {"ok": False, "error": "db_unavailable"}


def _db_kv_get_payload(store_key: str) -> dict:
    try:
        import pg_db
    except Exception:
        return {"ok": False, "error": "db_unavailable"}
    health = pg_db.cached_health()
    if not health.get("ok"):
        return {"ok": False, "error": "db_unavailable"}
    try:
        row = pg_db.kv_get_meta(store_key)
    except Exception:
        return {"ok": False, "error": "db_unavailable"}
    if not row:
        return {"ok": False, "error": "not_found", "store_key": store_key}
    return {
        "ok": True,
        "store_key": store_key,
        "payload": row.get("payload"),
        "updated_at": row.get("updated_at") or "",
        "updated_by": row.get("updated_by") or "",
    }


def _db_kv_set_payload(
    store_key: str,
    payload,
    *,
    expected_updated_at: str | None,
    updated_by: str,
) -> tuple[int, dict]:
    dest = WEB_ROOT / "data" / f"{store_key}.json"
    try:
        import pg_db

        new_ts = _save_json(
            dest,
            payload,
            expected_updated_at=expected_updated_at,
            updated_by=updated_by,
        )
        return 200, {
            "ok": True,
            "store_key": store_key,
            "updated_at": new_ts or "",
            "updated_by": updated_by,
        }
    except Exception as exc:
        if exc.__class__.__name__ == "StaleKvVersion":
            return 409, {
                "ok": False,
                "error": "stale_version",
                "store_key": store_key,
                "current_updated_at": getattr(exc, "current_updated_at", ""),
            }
        return 503, {"ok": False, "error": "writes_paused_db", "detail": str(exc)}


_JSON_FILE_CACHE: dict[str, tuple[float, object]] = {}
_EXPLORER_SLIM_CACHE: dict = {"mtime": None, "raw": None, "gz": None}
_VIZ_SLIM_CACHE: dict = {"mtime": None, "raw": None, "gz": None}

# First-paint allowlists. Denylist leaked search_blob / tag_groups / authors (~120 KB)
# and extras_for_index injected checklist_paths (~470 KB) — that is why fields=explorer
# shipped ~985 KB instead of a catalog slice.
_EXPLORER_PRODUCT_KEEP = (
    "id",
    "display_name",
    "name",
    "brand",
    "root_key",
    "path",
    "category",
    "subcategory_slug",
    "subcategory_label",
    "tags",
    "indexes",
    "index_bases",
    "revision_count",
    "in_archive",
    "archive_only",
)
_EXPLORER_REV_KEEP = (
    "folder",
    "path",
    "index",
    "index_base",
    "date",
    "langs",
    "carrier",
    "is_latest",
    "in_archive",
    "archive_wrapper",
)
_EXPLORER_FALSEY_OMIT = frozenset({"in_archive", "archive_only", "is_latest"})
_VIZ_LATEST_KEEP = (
    "product_id",
    "product_name",
    "category",
    "brand",
    "subcategory_slug",
    "subcategory_label",
    "linked_products",
    "alias_langs",
    "carrier",
    "carrier_label",
    "carrier_guessed",
    "is_mix",
    "index",
    "index_base",
    "revision_folder",
    "revision_path",
    "langs",
    "langs_manual",
    "lang",
    "lang_label",
    "lang_unknown",
    "file",
    "path",
    "mtime",
    "tags",
    "in_archive",
    "carrier_previous",
)
_VIZ_FALSEY_OMIT = frozenset(
    {"carrier_guessed", "is_mix", "langs_manual", "lang_unknown", "in_archive"}
)


def _project_row(
    src: dict,
    keys: tuple[str, ...],
    *,
    falsey_omit: frozenset[str] | None = None,
) -> dict:
    """Copy allowlisted keys; drop empties and default-false flags."""
    skip_false = falsey_omit or frozenset()
    out: dict = {}
    for key in keys:
        if key not in src:
            continue
        val = src[key]
        if val is None or val == "" or val == [] or val == {}:
            continue
        if key in skip_false and val is False:
            continue
        out[key] = val
    return out


def _invalidate_explorer_slim_cache() -> None:
    _EXPLORER_SLIM_CACHE["mtime"] = None
    _EXPLORER_SLIM_CACHE["raw"] = None
    _EXPLORER_SLIM_CACHE["gz"] = None
    _VIZ_SLIM_CACHE["mtime"] = None
    _VIZ_SLIM_CACHE["raw"] = None
    _VIZ_SLIM_CACHE["gz"] = None


def _drop_json_cache(path: Path) -> None:
    _JSON_FILE_CACHE.pop(str(path.resolve()), None)
    try:
        if path.resolve() == INDEX_FILE.resolve():
            _invalidate_explorer_slim_cache()
    except OSError:
        pass


def _file_index_explorer_slim(data: dict) -> dict:
    """First-paint explorer catalog: allowlisted product + revision keys only.

    Checklist flags/paths are computed on GET /file-index/product (openProduct
    hydrates). Injecting extras_for_index here doubled the payload (~985 KB).
    """
    products = []
    for prod in data.get("products") or []:
        if not isinstance(prod, dict):
            continue
        slim_revs = []
        for rev in prod.get("revisions") or []:
            if not isinstance(rev, dict):
                continue
            slim_revs.append(
                _project_row(rev, _EXPLORER_REV_KEEP, falsey_omit=_EXPLORER_FALSEY_OMIT)
            )
        row = _project_row(
            prod, _EXPLORER_PRODUCT_KEEP, falsey_omit=_EXPLORER_FALSEY_OMIT
        )
        row["revisions"] = slim_revs
        row["files_slim"] = True
        products.append(row)
    return {
        "ok": True,
        "slim": True,
        "fields": "explorer",
        "generated_at": data.get("generated_at"),
        "product_count": data.get("product_count") or len(products),
        "category_count": data.get("category_count"),
        "viz_count": data.get("viz_count"),
        "roots": data.get("roots"),
        "root": data.get("root"),
        "categories": data.get("categories"),
        "lang_labels": data.get("lang_labels"),
        "tag_groups": data.get("tag_groups"),
        "products": products,
    }


def _file_index_viz_latest_slim(data: dict) -> dict:
    """fields=viz_latest: drop empty thumb_url/rel and default-false flags."""
    rows = []
    for row in data.get("viz_latest") or []:
        if not isinstance(row, dict):
            continue
        rows.append(_project_row(row, _VIZ_LATEST_KEEP, falsey_omit=_VIZ_FALSEY_OMIT))
    return {
        "ok": True,
        "fields": "viz_latest",
        "generated_at": data.get("generated_at"),
        "product_count": data.get("product_count"),
        "viz_count": data.get("viz_count") or len(rows),
        "viz_latest": rows,
    }


def _file_index_product_by_id(data: dict, pid: str) -> dict | None:
    needle = str(pid or "").strip()
    if not needle:
        return None
    products = data.get("products") or []
    for prod in products:
        if isinstance(prod, dict) and str(prod.get("id") or "") == needle:
            return prod
    if needle.isdigit():
        for prod in products:
            if not isinstance(prod, dict):
                continue
            if str(prod.get("index") or "") == needle:
                return prod
            bases = [str(x) for x in (prod.get("index_bases") or [])]
            idxs = [str(x) for x in (prod.get("indexes") or [])]
            if needle in bases or needle in idxs:
                return prod
    return None


def _dumps_slim(payload: dict) -> bytes:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def _explorer_slim_bytes(data: dict, mtime: float) -> tuple[bytes, bytes | None]:
    if (
        _EXPLORER_SLIM_CACHE["mtime"] == mtime
        and _EXPLORER_SLIM_CACHE["raw"] is not None
    ):
        return _EXPLORER_SLIM_CACHE["raw"], _EXPLORER_SLIM_CACHE["gz"]
    raw = _dumps_slim(_file_index_explorer_slim(data))
    gz = gzip.compress(raw, compresslevel=6) if len(raw) > 4096 else None
    _EXPLORER_SLIM_CACHE["mtime"] = mtime
    _EXPLORER_SLIM_CACHE["raw"] = raw
    _EXPLORER_SLIM_CACHE["gz"] = gz
    return raw, gz


def _viz_slim_bytes(data: dict, mtime: float) -> tuple[bytes, bytes | None]:
    if _VIZ_SLIM_CACHE["mtime"] == mtime and _VIZ_SLIM_CACHE["raw"] is not None:
        return _VIZ_SLIM_CACHE["raw"], _VIZ_SLIM_CACHE["gz"]
    raw = _dumps_slim(_file_index_viz_latest_slim(data))
    gz = gzip.compress(raw, compresslevel=6) if len(raw) > 4096 else None
    _VIZ_SLIM_CACHE["mtime"] = mtime
    _VIZ_SLIM_CACHE["raw"] = raw
    _VIZ_SLIM_CACHE["gz"] = gz
    return raw, gz


def _invalidate_branding_data_caches() -> None:
    """Czysc pamiec JSON bridge PRZED zapisem / rebuild indeksu branding."""
    for rel in (
        "data/branding-index.json",
        "data/branding-search-index.json",
        "data/branding-grid-index.json",
        "data/branding-grid-head.json",
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


def _save_json(
    path: Path,
    data,
    *,
    expected_updated_at: str | None = None,
    updated_by: str = "local_bridge",
    push_to_pg: bool = True,
) -> str | None:
    """Zapis lokalnego cache + (gdy PG skonfigurowany) upsert do dam_kv_store.

    expected_updated_at podany (POST /db/kv): slepy upsert + StaleKvVersion / 409.
    expected_updated_at is None i path w KV_STORE_KEYS: scalenie merge_document.
    Pozostale pliki (indeksy, finanse): slepy zapis na dysk, bez PG.
    Lokalny JSON i cache - po commicie, wynikiem scalenia.

    push_to_pg=False: zapisz TYLKO lokalnie, bez dotykania Postgresa (uzywane
    przy startowym seedowaniu polityki/nazewnictwa - patrz
    pg_db.should_seed_kv_from_local - zeby zainstalowana kopia / most
    publiczny nie scalily build-time snapshotu web/data z baza).
    """
    store_key = _path_to_store_key(path)
    new_ts = None
    to_write = data
    if push_to_pg and store_key and _pg_available():
        try:
            import pg_db

            if expected_updated_at is not None:
                conn = pg_db.connect()
                try:
                    cur = conn.cursor()
                    pg_db.kv_get_for_update(store_key, None, cur)
                    new_ts = pg_db.kv_set_in_txn(
                        store_key,
                        data,
                        updated_by or "local_bridge",
                        cur,
                        expected_updated_at=expected_updated_at,
                    )
                    conn.commit()
                finally:
                    conn.close()
            else:
                result = pg_db.kv_apply_change(
                    store_key,
                    {"op": "merge_document", "payload": data if isinstance(data, dict) else {}},
                    updated_by=updated_by or "local_bridge",
                )
                if not result.get("ok"):
                    raise RuntimeError(result.get("error") or "kv_apply_change_failed")
                new_ts = result.get("updated_at") or None
                if isinstance(result.get("payload"), dict):
                    to_write = result["payload"]
        except Exception as exc:
            if exc.__class__.__name__ == "StaleKvVersion":
                raise
            print(f"kv_store save warning ({store_key}):", exc)
    path.parent.mkdir(parents=True, exist_ok=True)
    _drop_json_cache(path)
    path.write_text(json.dumps(to_write, ensure_ascii=False, indent=2), encoding="utf-8")
    return new_ts


# --- Gruby indeks brandingu: zapis poza watkiem zadania ----------------------
# branding-index.json ma ~48 MB i NIE jest zrodlem prawdy (SoT = SQLite przez
# assoc_repo.upsert_confirmed_links). Czytanie i przepisywanie go w watku
# zadania bylo przyczyna zamrozen UI przy dodawaniu skojarzen: json.loads
# 47,9 MB + json.dumps(indent=2) calosci na KAZDY zapisany asset. Teraz
# zadanie zglasza latke i wraca, a jeden watek w tle scala wszystkie latki
# z okna ciszy i zapisuje plik raz, kompaktowo.
_FAT_ASSOC_QUIET_S = 0.75
_FAT_ASSOC_MAX_WAIT_S = 10.0
_FAT_ASSOC_LOCK = threading.Lock()
_FAT_ASSOC_PENDING: list[dict] = []
_FAT_ASSOC_WAKE = threading.Event()
_FAT_ASSOC_THREAD: threading.Thread | None = None


def _write_json_compact(path: Path, data) -> None:
    """Atomowy zapis bez wciec - dla duzych plikow czytanych tylko maszynowo."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)
    # Utrzymaj cache goracy: bez tego nastepny czyt kosztuje ponowny parse 48 MB.
    try:
        _JSON_FILE_CACHE[str(path.resolve())] = (path.stat().st_mtime, data)
    except OSError:
        _drop_json_cache(path)


def _apply_assoc_patch_to_index(
    patch: dict,
    assets: list,
    assets_by_id: dict,
    file_index: dict,
) -> None:
    aid = str(patch.get("asset_id") or "")
    pids = list(patch.get("linked_product_ids") or [])
    vids = list(patch.get("linked_variant_ids") or [])
    group = str(patch.get("folder_group_id") or "").strip().lower()
    target = assets_by_id.get(aid)
    if target is None:
        return
    if not group:
        group = str(target.get("folder_group_id") or "").strip().lower()
    linked_meta = _build_linked_product_meta(pids, file_index)

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
    # spray_group=False: zapis "Tylko ten plik" / jawna lista plikow - bez rozlewania
    # na caly folder (kazdy wariant materialu ma wlasne skojarzenia).
    if group and patch.get("spray_group", True):
        for a in assets:
            ag = str(a.get("folder_group_id") or "").strip().lower()
            if ag == group:
                apply_to_asset(a)


def _flush_assoc_index_patches() -> int:
    """Zastosuj wszystkie zgloszone latki i zapisz gruby indeks RAZ."""
    with _FAT_ASSOC_LOCK:
        batch = list(_FAT_ASSOC_PENDING)
        del _FAT_ASSOC_PENDING[:]
    if not batch:
        return 0
    try:
        idx = _load_json(BRANDING_INDEX_FILE, None)
        if not isinstance(idx, dict):
            return 0
        assets = idx.get("assets") or []
        assets_by_id = {a.get("id"): a for a in assets if a.get("id")}
        file_index = _load_json(INDEX_FILE, {"products": []})
        for patch in batch:
            try:
                _apply_assoc_patch_to_index(patch, assets, assets_by_id, file_index)
            except Exception as exc:  # noqa: BLE001
                print("assoc fat-index patch warning:", exc)
        _write_json_compact(BRANDING_INDEX_FILE, idx)
        return len(batch)
    except Exception as exc:  # noqa: BLE001
        print("assoc fat-index flush failed:", exc)
        return 0


def _assoc_index_worker() -> None:
    while True:
        _FAT_ASSOC_WAKE.wait()
        deadline = time.monotonic() + _FAT_ASSOC_MAX_WAIT_S
        # Okno ciszy: dobierz kolejne latki, zanim ruszysz plik 48 MB.
        while True:
            _FAT_ASSOC_WAKE.clear()
            time.sleep(_FAT_ASSOC_QUIET_S)
            if not _FAT_ASSOC_WAKE.is_set() or time.monotonic() >= deadline:
                break
        _flush_assoc_index_patches()


def _enqueue_assoc_index_patch(
    asset_id: str,
    folder_group_id: str,
    linked_product_ids: list,
    linked_variant_ids: list | None,
    spray_group: bool = True,
) -> None:
    global _FAT_ASSOC_THREAD
    with _FAT_ASSOC_LOCK:
        _FAT_ASSOC_PENDING.append(
            {
                "asset_id": str(asset_id or ""),
                "folder_group_id": str(folder_group_id or ""),
                "linked_product_ids": list(linked_product_ids or []),
                "linked_variant_ids": list(linked_variant_ids or []),
                "spray_group": bool(spray_group),
            }
        )
        if _FAT_ASSOC_THREAD is None or not _FAT_ASSOC_THREAD.is_alive():
            _FAT_ASSOC_THREAD = threading.Thread(
                target=_assoc_index_worker, name="dam-assoc-index", daemon=True
            )
            _FAT_ASSOC_THREAD.start()
    _FAT_ASSOC_WAKE.set()


try:  # zamkniecie procesu nie moze zgubic zgloszonych latek
    import atexit as _atexit

    _atexit.register(_flush_assoc_index_patches)
except Exception:  # noqa: BLE001
    pass


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


def _patch_project_costs_direct(project_id: str, payload: dict) -> dict:
    """Merge direct lines / ad-hoc rows into project-costs.json (seed overrides)."""
    pid = str(project_id or "").strip()
    if not pid:
        return {"ok": False, "error": "project_id_required"}
    root = _load_json(PROJECT_COSTS_FILE, {})
    projects = root.get("projects") or []
    target = None
    for p in projects:
        if not isinstance(p, dict):
            continue
        if p.get("id") == pid or p.get("linked_product_id") == pid:
            target = p
            break
    if target is None:
        return {"ok": False, "error": "project_not_found"}

    direct = target.get("direct")
    if not isinstance(direct, list):
        direct = []

    if "direct" in payload:
        incoming = payload.get("direct")
        if not isinstance(incoming, list):
            return {"ok": False, "error": "direct_must_be_list"}
        cleaned: list[dict] = []
        for row in incoming:
            if not isinstance(row, dict):
                continue
            label = str(row.get("label") or "").strip()
            if not label:
                continue
            key = str(row.get("key") or label).strip().replace(" ", "_")[:64]
            try:
                amount = round(float(row.get("amount") or 0), 2)
            except (TypeError, ValueError):
                amount = 0.0
            cleaned.append(
                {
                    "key": key,
                    "label": label,
                    "department": str(row.get("department") or "Ręczne"),
                    "unit": str(row.get("unit") or "szt"),
                    "qty": row.get("qty"),
                    "rate": row.get("rate"),
                    "amount": amount,
                    "isTest": bool(row.get("isTest", True)),
                    "source": str(row.get("source") or "manual"),
                    "adhoc": bool(row.get("adhoc")),
                }
            )
        direct = cleaned

    adhoc = payload.get("add_adhoc")
    if isinstance(adhoc, dict):
        label = str(adhoc.get("label") or "").strip()
        if label:
            try:
                amount = round(float(adhoc.get("amount") or 0), 2)
            except (TypeError, ValueError):
                amount = 0.0
            key = str(adhoc.get("key") or f"adhoc_{int(time.time() * 1000)}")
            direct.append(
                {
                    "key": key,
                    "label": label,
                    "department": str(adhoc.get("department") or "Ad-hoc"),
                    "unit": str(adhoc.get("unit") or "szt"),
                    "qty": adhoc.get("qty"),
                    "rate": adhoc.get("rate"),
                    "amount": amount,
                    "isTest": True,
                    "source": "manual",
                    "adhoc": True,
                }
            )

    target["direct"] = direct
    dtotal = round(
        sum(float(r.get("amount") or 0) for r in direct if isinstance(r, dict)),
        2,
    )
    target["direct_total"] = dtotal
    labor = float(target.get("labor_total") or 0)
    target["total"] = round(labor + dtotal, 2)
    target["total_with_invoices"] = target["total"]
    root["projects"] = projects
    root["updated_at"] = utc_now()
    _save_json(PROJECT_COSTS_FILE, root)
    return {"ok": True, "project_id": target.get("id"), "project": target}


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
    """Sciezka zrodlowa wizki (UI buduje /thumb-cache AVIF). Bez legacy data/thumbs JPG."""
    pid = (product_id or "").strip()
    if pid:
        for row in file_index.get("viz_latest") or []:
            if not isinstance(row, dict):
                continue
            if str(row.get("product_id") or "") == pid and row.get("path"):
                return str(row["path"])
    products_by_id = {p.get("id"): p for p in (file_index.get("products") or []) if p.get("id")}
    p = products_by_id.get(product_id) or {}
    for rev in p.get("revisions") or []:
        rp = (rev.get("path") or "").strip()
        if rp:
            hit = _lookup_viz_path_from_index(rp, file_index)
            if hit:
                return hit
        for key in ("viz_path", "thumb_path", "path"):
            vp = rev.get(key) or ""
            if vp and _VIZ_IMAGE_EXT.search(str(vp)):
                return str(vp)
    return ""


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
    spray_group: bool = True,
) -> tuple[bool, str | None]:
    """Reczna edycja: SQLite SoT + mirror override; fat index patch best-effort.

    spray_group=False: skojarzenia tylko tego pliku (bez wpisu folder_groups
    w mirrorze i bez rozlewania latki grubego indeksu na caly folder).
    """
    aid = str(asset_id or "").strip()
    group = str(folder_group_id or "").strip().lower() if spray_group else ""
    if not aid:
        return False, "asset_id_required"
    pids = [str(x).strip() for x in (linked_product_ids or []) if str(x).strip()]
    vids = [str(x).strip() for x in (linked_variant_ids or []) if str(x).strip()]

    # Unified SQLite write + JSON mirror (ADR-010)
    try:
        import assoc_repo

        db_path = getattr(dam_db, "DB_CANONICAL", None) if dam_db is not None else None
        result = assoc_repo.upsert_confirmed_links(
            aid,
            pids,
            db_path=db_path,
            source="manual",
            reason="editor_confirm",
            updated_by=updated_by,
            reject_other_pending=True,
            replace_confirmed=True,
            mirror=True,
            overrides_path=BRANDING_ASSOC_OVERRIDES_FILE,
            variant_ids=vids,
            folder_group_id=group,
            schedule_publish=True,
        )
        if not result.get("ok"):
            return False, str(result.get("error") or "assoc_write_failed")
    except Exception as exc:  # noqa: BLE001
        return False, f"assoc_sqlite:{exc}"

    # Fat index (48 MB) is not SoT - patch it off the request thread.
    _enqueue_assoc_index_patch(aid, group, pids, vids, spray_group=spray_group)
    return True, None


_ASSOC_SCOPE_MAX_ASSETS = 500


def _save_branding_associations_scoped(data: dict, updated_by: str) -> tuple[int, dict]:
    """POST /branding/asset-associations z `scope` / `asset_ids` (warianty materialu).

    scope="file": tylko `asset_id`. scope="all": `asset_id` + `asset_ids` (kazdy plik
    z grupy "Warianty materialu") dostaje ten sam zestaw produktow. Petla po
    assoc_repo.upsert_confirmed_links (przez _patch_branding_associations), bez
    rozlewania na folder. linked_variant_ids z zadania dotycza pliku `asset_id`;
    pozostale pliki zachowuja swoje z mirrora.
    """
    scope = str(data.get("scope") or "").strip().lower()
    raw_ids = data.get("asset_ids")
    if raw_ids is not None and not isinstance(raw_ids, list):
        return 400, {"ok": False, "error": "asset_ids_invalid"}
    extra = [str(x).strip() for x in (raw_ids or []) if str(x or "").strip()]
    primary = str(data.get("asset_id") or "").strip() or (extra[0] if extra else "")
    if not primary:
        return 400, {"ok": False, "error": "asset_id_required"}
    if not scope:
        scope = "all" if extra else "file"
    if scope not in ("file", "all"):
        return 400, {"ok": False, "error": "invalid_scope"}
    targets: list[str] = [primary]
    if scope == "all":
        for x in extra:
            if x not in targets:
                targets.append(x)
    if len(targets) > _ASSOC_SCOPE_MAX_ASSETS:
        return 400, {"ok": False, "error": "too_many_assets", "max": _ASSOC_SCOPE_MAX_ASSETS}
    pids = [str(x).strip() for x in (data.get("linked_product_ids") or []) if str(x).strip()]
    req_vids = [str(x).strip() for x in (data.get("linked_variant_ids") or []) if str(x).strip()]
    mirror_assets: dict = {}
    if len(targets) > 1:
        ov = _load_json(BRANDING_ASSOC_OVERRIDES_FILE, {})
        if isinstance(ov, dict) and isinstance(ov.get("assets"), dict):
            mirror_assets = ov["assets"]
    results: list[dict] = []
    for aid in targets:
        if aid == primary:
            vids = req_vids
        else:
            entry = mirror_assets.get(aid)
            if isinstance(entry, dict) and "linked_variant_ids" in entry:
                vids = [str(v).strip() for v in (entry.get("linked_variant_ids") or []) if str(v).strip()]
            else:
                vids = req_vids
        ok, err = _patch_branding_associations(
            aid, "", pids, vids, updated_by=updated_by, spray_group=False
        )
        row: dict = {"asset_id": aid, "ok": bool(ok)}
        if not ok:
            row["error"] = err or "patch_failed"
        results.append(row)
    saved = sum(1 for r in results if r["ok"])
    failed = len(results) - saved
    payload: dict = {
        "ok": failed == 0,
        "scope": scope,
        "asset_id": primary,
        "asset_ids": targets,
        "linked_product_ids": pids,
        "linked_variant_ids": req_vids,
        "results": results,
        "saved": saved,
        "failed": failed,
    }
    if failed:
        payload["error"] = "partial_failure" if saved else (results[0].get("error") or "patch_failed")
    return (200 if saved else 400), payload


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


def _seed_kv_push_allowed(store_key: str) -> bool:
    """Wrapper: pg_db.should_seed_kv_from_local + PUBLIC_MODE tego procesu."""
    try:
        import pg_db

        return pg_db.should_seed_kv_from_local(store_key, public_mode=PUBLIC_MODE)
    except Exception:
        return False


def _seed_naming_policy_to_postgres() -> None:
    """Wypchnij naming-dictionary + app-settings + program-instructions do dam_kv_store.

    Dev-tree-only (HARD), PUBLIC_MODE wykluczony (patrz pg_db.should_seed_kv_from_local):
    instalator wiezie web/data z maszyny budujacej - zainstalowana kopia i
    most na NAS (moze serwowac przestarzala kopie Panel-DAM) NIE moga scalac
    tych plikow z baza przy KAZDYM starcie, to nadpisaloby nowsze dane z
    innego stanowiska. Wyjatek per-klucz: swiezy wiersz w dam_kv_store nie
    istnieje jeszcze - bootstrap wtedy nie ma czego nadpisac.
    Lokalny plik na dysku jest zawsze odswiezany (nieszkodliwe), pchniecie do
    Postgresa idzie tylko gdy _seed_kv_push_allowed(store_key) zwroci True.
    """
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
    _save_json(APP_SETTINGS_FILE, app_settings, push_to_pg=_seed_kv_push_allowed("app-settings"))
    if naming:
        _save_json(
            NAMING_DICTIONARY_FILE,
            naming,
            push_to_pg=_seed_kv_push_allowed("naming-dictionary"),
        )
    if instructions:
        _save_json(
            PROGRAM_INSTRUCTIONS_FILE,
            instructions,
            push_to_pg=_seed_kv_push_allowed("program-instructions"),
        )
    # Historia operacji / statusow / slownik EN->PL - tez do KV (o ile wolno)
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
                store_key = _path_to_store_key(path)
                allow_push = _seed_kv_push_allowed(store_key) if store_key else False
                _save_json(path, _load_json(path, {}), push_to_pg=allow_push)
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
            # Wykryty root (dowolna litera, walidacja 3 folderow), potem stary P:
            found = (
                marketing_discovery.discover_roots(required=REQUIRED_ROOT_FOLDERS)
                if marketing_discovery is not None
                else []
            )
            for cand in [str(f) for f in found] + [r"P:\Marketing"]:
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


SUPPORT_REPORT_KINDS = {
    "blad": "Blad / usterka",
    "pomysl": "Pomysl / usprawnienie",
    "dane": "Zle dane w panelu",
    "inne": "Inne",
}


def create_support_report(payload: dict, actor: str = "", role: str = "") -> dict:
    """Zgloszenie z Ustawien -> Pomoc. Trafia do skrzynki KAZDEGO admina.

    Zwykly uzytkownik nie ma gdzie zglosic usterki - dotad jedyna droga bylo
    powiedziec komus osobiscie. Wpis dostaje audience="admins", wiec nie
    zasmieca skrzynek pozostalych uzytkownikow.
    """
    kind = str(payload.get("kind") or "blad").strip().lower()
    if kind not in SUPPORT_REPORT_KINDS:
        kind = "inne"
    title = re.sub(r"\s+", " ", str(payload.get("title") or "")).strip()[:120]
    body = str(payload.get("body") or "").strip()[:4000]
    if not title and not body:
        return {"ok": False, "error": "title_or_body_required"}
    if not title:
        title = body[:80]
    where = str(payload.get("page") or "").strip()[:200]
    detail_lines = [body] if body else []
    if where:
        detail_lines.append(f"Strona: {where}")
    # Wersja z version.json - local_bridge nie importuje runtime_config,
    # a zgloszenie bez numeru wersji jest dla admina bezuzyteczne.
    ver = ""
    try:
        ver = str((_load_json(WEB_ROOT / "version.json", {}) or {}).get("version") or "")
    except Exception:  # noqa: BLE001
        ver = ""
    detail_lines.append(f"Wersja: {ver or 'nieznana'}")
    detail_lines.append(f"Zglosil: {actor or 'nieznany'}" + (f" ({role})" if role else ""))
    entry = append_inbox_item(
        {
            "kind": "support",
            "audience": "admins",
            "title": f"[{SUPPORT_REPORT_KINDS[kind]}] {title}",
            "detail": "\n".join(detail_lines),
            "source": "pomoc",
            "reported_by": actor or "",
            "report_kind": kind,
        }
    )
    append_change_log(
        {"action": "support_report", "category": "support", "kind": kind, "title": title}
    )
    return {"ok": True, "id": entry.get("id"), "title": entry.get("title")}


def notify_admins_note_proposal(index: str, proposed: str, replaces: str, actor: str) -> None:
    """Propozycja opisu od zwyklego uzytkownika musi kogos obudzic.

    Bez tego wpis lezalby w variant-notes.json i nikt by o nim nie wiedzial.
    """
    append_inbox_item(
        {
            "kind": "variant_note_proposal",
            "audience": "admins",
            "title": f"Propozycja opisu wariantu {index}",
            "detail": (
                f"Proponowany opis: {proposed or '(usuniecie opisu)'}\n"
                f"Obecny opis: {replaces or '(brak)'}\n"
                f"Zglosil: {actor or 'nieznany'}"
            ),
            "source": "eksplorer",
            "variant_index": index,
        }
    )


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
    raw = (
        dam_path_resolve.resolve_physical_path(
            path or "",
            normalize_path=normalize_path,
            marketing_candidates=MARKETING_CANDIDATES,
            machine_config_path=MACHINE_CONFIG,
        )
        if dam_path_resolve
        else normalize_path(path or "")
    )
    target = Path(raw)
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
    dest_dir: str = "",
) -> dict:
    """
    Spakuj 2 - PROJEKT(+y) + 4 - WIZKI/WIZUALIZACJE do ZIP.
    Domyslnie ZIP ląduje w 3 - DRUK wariantu. Opcjonalnie dest_dir = inny folder
    (np. wybor Windows Explorer przy masowym eksporcie).
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

    custom_dest: Path | None = None
    dest_raw = str(dest_dir or "").strip()
    if dest_raw:
        custom_dest = Path(normalize_path(dest_raw))
        try:
            if not custom_dest.exists():
                custom_dest.mkdir(parents=True, exist_ok=True)
            if not custom_dest.is_dir():
                return {
                    "ok": False,
                    "error": "dest_not_dir",
                    "message": "Cel eksportu nie jest folderem.",
                }
        except OSError as exc:
            return {
                "ok": False,
                "error": "dest_mkdir_failed",
                "detail": str(exc),
                "message": "Nie mozna utworzyc folderu docelowego.",
            }

    if custom_dest is not None:
        out_dir = custom_dest
        slot_label = str(custom_dest)
    else:
        if druk is None:
            druk = rev / "3 - DRUK"
        out_dir = druk
        slot_label = druk.name if druk else "3 - DRUK"

    zip_name = stem + ".zip"
    out_zip = out_dir / zip_name
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
        "druk_path": str(druk) if druk else "",
        "dest_dir": str(out_dir),
        "zip_name": zip_name,
        "zip_path": str(out_zip),
        "ai_stem": stem,
        "file_count": len(entries),
        "entries": [{"name": Path(arc).name, "arc": arc} for _abs, arc in entries[:200]],
        "dry_run": bool(dry_run),
    }
    if dry_run:
        return result_base

    try:
        out_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        return {
            "ok": False,
            "error": "druk_mkdir_failed",
            "detail": str(exc),
            "message": "Nie mozna utworzyc folderu docelowego (3 - DRUK lub dest).",
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
                "slot": slot_label,
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
            creationflags=_no_win,
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
    default = {"demo": {}, "hidden": {}, "manual": [], "updated_at": ""}
    raw = _load_json(flags_file, default)
    if not isinstance(raw, dict):
        return default
    return {
        "demo": raw.get("demo") if isinstance(raw.get("demo"), dict) else {},
        "hidden": raw.get("hidden") if isinstance(raw.get("hidden"), dict) else {},
        "manual": raw.get("manual") if isinstance(raw.get("manual"), list) else [],
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


def _media_preview_pdf(target: str) -> tuple[int, bytes, str] | None:
    """Pierwsza strona PDF -> JPEG (pdftoppm via dam_thumb_cache)."""
    if Path(target).suffix.lower() != ".pdf":
        return None
    if not dam_thumb_cache:
        return None
    try:
        body = dam_thumb_cache.raster_pdf_first_page_jpeg(target, max_side=2400)
        if body:
            return 200, body, "image/jpeg"
    except Exception:
        pass
    return None


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
_MARKETING_BASENAME_MAX_DEPTH = 4


def _score_marketing_basename_hit(hit: Path, search_root: Path) -> tuple[int, int]:
    """Lower tuple = better. Prefer SUCHE/gotowe, then shorter relative path."""
    try:
        rel_parts = hit.relative_to(search_root).parts
    except ValueError:
        rel_parts = hit.parts
    rel_lower = [x.lower() for x in rel_parts]
    score = 0
    if "suche" in rel_lower and "gotowe" in rel_lower:
        score -= 100
    return (score, len(rel_parts))


def _resolve_marketing_basename_drift(raw: str) -> str | None:
    """Marketing/slider drift: index flat path, file nested under existing parent dir."""
    if not raw:
        return None
    target = Path(normalize_path(raw))
    filename = target.name
    if not filename or len(target.parts) < 2:
        return None
    try:
        if target.is_file():
            return str(target)
    except OSError:
        pass

    search_root = None
    cur = target.parent
    for _ in range(4):
        try:
            if cur.is_dir():
                search_root = cur
                break
        except OSError:
            pass
        if cur.parent == cur:
            break
        cur = cur.parent
    if search_root is None:
        return None
    try:
        if not _is_under_marketing(search_root):
            return None
    except OSError:
        return None

    hits: list[Path] = []
    root_depth = len(search_root.parts)
    try:
        for dirpath, dirnames, filenames in os.walk(search_root):
            depth = len(Path(dirpath).parts) - root_depth
            if depth > _MARKETING_BASENAME_MAX_DEPTH:
                dirnames[:] = []
                continue
            if filename not in filenames:
                continue
            cand = Path(dirpath) / filename
            try:
                if cand.is_file() and _is_under_marketing(cand):
                    hits.append(cand)
            except OSError:
                continue
    except OSError:
        return None

    if not hits:
        return None
    if len(hits) == 1:
        return str(hits[0])

    hits.sort(key=lambda p: _score_marketing_basename_hit(p, search_root))
    best = hits[0]
    if len(hits) > 1 and _score_marketing_basename_hit(best, search_root) == _score_marketing_basename_hit(
        hits[1], search_root
    ):
        return None
    return str(best)


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
        return _resolve_marketing_basename_drift(raw)

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
    return _resolve_marketing_basename_drift(raw)


_VIZ_IMAGE_EXT = re.compile(r"\.(jpe?g|png|webp|gif|tif{1,2})$", re.I)
_LOGO_SLOT_RE = re.compile(r"(?i)/(01\s*-\s*logo)/")
_LOGO_TECH_FOLDER_RE = re.compile(r"(?i)/(png|svg|jpe?g|11x|ai|pdf|eps)(/|$)")
_VIZ_LOOKUP_MIN_SCORE = 60


def _norm_path_key(p: str) -> str:
    return normalize_path(p or "").replace("\\", "/").lower().rstrip("/")


def _path_is_brand_logo_tree(raw: str) -> bool:
    low = (raw or "").replace("\\", "/").lower()
    return "/01 - logo/" in low or "/- branding i marka -/" in low


def _logo_drive_variants(path: str) -> list[str]:
    p = (path or "").replace("\\", "/")
    out: list[str] = []
    seen: set[str] = set()

    def add(val: str) -> None:
        key = val.replace("\\", "/").lower()
        if not val or key in seen:
            return
        seen.add(key)
        out.append(val)

    add(p)
    # Kazdy root Marketing (M:/, X:/Marketing, D:/Marketing + wykryte) na kazdy inny.
    prefixes = marketing_root_prefixes()
    low = p.lower()
    for a in prefixes:
        if low.startswith(a.lower()):
            rest = p[len(a) :]
            for b in prefixes:
                if b != a:
                    add(b + rest)
    return out


def marketing_root_prefixes() -> list[str]:
    """MARKETING_CANDIDATES jako prefiksy 'M:/', 'X:/Marketing/' (kolejnosc zachowana)."""
    out: list[str] = []
    for c in MARKETING_CANDIDATES:
        s = str(c).replace("\\", "/").rstrip("/") + "/"
        if s not in out:
            out.append(s)
    return out


def _resolve_logo_lang_folder_drift(raw: str) -> str | None:
    """Index often has 01-LOGO/PNG while disk is 01-LOGO/PL/PNG (or EN) + optional -PREV."""
    target = Path(normalize_path(raw))
    try:
        if target.is_file():
            return str(target)
    except OSError:
        pass
    seeds = _logo_drive_variants(str(target).replace("\\", "/"))
    candidates: list[str] = []
    for s in seeds:
        m = _LOGO_SLOT_RE.search(s)
        if not m:
            continue
        after = s[m.end() :]
        tech = _LOGO_TECH_FOLDER_RE.match("/" + after)
        if tech:
            for lang in ("PL", "EN"):
                candidates.append(s[: m.end()] + lang + "/" + after)
        stem, ext = os.path.splitext(s.rsplit("/", 1)[-1])
        prev_name = stem + "-PREV" + ext if not re.search(r"-prev$", stem, re.I) else ""
        bases = [s.rsplit("/", 1)[0]]
        for cand in list(candidates[-4:]):
            bases.append(cand.rsplit("/", 1)[0])
        if prev_name:
            for base in bases:
                candidates.append(base + "/" + prev_name)
    seen: set[str] = set()
    for cand in candidates:
        key = cand.replace("\\", "/").lower()
        if key in seen:
            continue
        seen.add(key)
        try:
            if Path(cand).is_file():
                return str(Path(cand))
        except OSError:
            continue
    return None


def _lookup_viz_path_from_index(raw: str, file_index: dict | None = None) -> str:
    """Map revision folder / index / drifted path → viz_latest.path (FRONT-S RGB)."""
    if not raw:
        return ""
    if _path_is_brand_logo_tree(raw):
        return ""
    fi = file_index if isinstance(file_index, dict) else _load_json(INDEX_FILE, {})
    if not fi:
        return ""
    key = _norm_path_key(raw)
    idx_hint = ""
    m = re.search(r"(6\d{6}|69\d{5})\.\d{2}", raw)
    if m:
        idx_hint = m.group(0)
    base_hint = idx_hint.split(".")[0] if idx_hint else ""
    best = ""
    best_score = -1
    for row in fi.get("viz_latest") or []:
        if not isinstance(row, dict):
            continue
        vp = str(row.get("path") or "")
        if not vp or not _VIZ_IMAGE_EXT.search(vp):
            continue
        rp = str(row.get("revision_path") or "")
        rpk = _norm_path_key(rp)
        vpk = _norm_path_key(vp)
        score = 0
        if key and key == vpk:
            score = 100
        elif key and rpk and (key == rpk or key.startswith(rpk + "/") or rpk.startswith(key)):
            score = 90
        elif idx_hint and str(row.get("index") or "") == idx_hint:
            score = 80
        elif base_hint and str(row.get("index_base") or "") == base_hint:
            score = 70
        elif idx_hint and idx_hint in key and idx_hint in vpk:
            score = 60
        if score >= _VIZ_LOOKUP_MIN_SCORE and score > best_score:
            best_score = score
            best = vp
    if best and best_score >= _VIZ_LOOKUP_MIN_SCORE:
        resolved = normalize_path(best)
        try:
            if os.path.isfile(resolved):
                return resolved
        except OSError:
            pass
    return ""


def _scan_revision_folder_viz(rev_dir: str) -> str:
    """Last resort: walk revision 4-WIZKI for FRONT-S png/jpg."""
    root = Path(normalize_path(rev_dir))
    try:
        if not root.is_dir():
            return ""
    except OSError:
        return ""
    candidates: list[tuple[int, str, float]] = []
    for slot in ("4 - WIZKI", "4 - VISUALS"):
        vr = root / slot
        if not vr.is_dir():
            continue
        try:
            for hit in vr.rglob("*"):
                try:
                    if not hit.is_file():
                        continue
                except OSError:
                    continue
                if hit.suffix.lower() not in {
                    ".png",
                    ".jpg",
                    ".jpeg",
                    ".webp",
                    ".gif",
                    ".tif",
                    ".tiff",
                }:
                    continue
                name = hit.name.upper()
                tier = 9
                if "FRONT-S" in name or "ENFACE-S" in name:
                    tier = 0
                elif "FRONT" in name and "SKLEP" not in name:
                    tier = 2
                elif "FRONT" in name:
                    tier = 3
                try:
                    mt = hit.stat().st_mtime
                except OSError:
                    mt = 0.0
                candidates.append((tier, str(hit), mt))
        except OSError:
            continue
    if not candidates:
        return ""
    candidates.sort(key=lambda x: (x[0], -x[2]))
    return candidates[0][1]


def _resolve_viz_image_for_thumb(path: str) -> str:
    """Thumb-cache/media: file path, revision folder, or index drift → raster viz file."""
    raw = (path or "").strip()
    if not raw:
        return ""
    target = normalize_path(raw)
    try:
        if os.path.isfile(target):
            return target
    except OSError:
        pass
    logo_hit = _resolve_logo_lang_folder_drift(raw)
    if logo_hit:
        return logo_hit
    from_index = _lookup_viz_path_from_index(raw)
    if from_index:
        return from_index
    try:
        if os.path.isdir(target):
            scanned = _scan_revision_folder_viz(target)
            if scanned:
                return scanned
    except OSError:
        pass
    resolved = _resolve_missing_media_path(target)
    if resolved:
        try:
            if os.path.isfile(resolved):
                return resolved
        except OSError:
            pass
    return target


def _warm_viz_thumbs_from_index(limit: int = 48) -> dict:
    """Podgrzej PAMIEC-PODRECZNA dla najnowszych viz_latest po rebuild indeksu."""
    if not dam_thumb_cache:
        return {"ok": False, "error": "dam_thumb_cache_missing"}
    fi = _load_json(INDEX_FILE, {})
    paths: list[str] = []
    seen: set[str] = set()
    for row in fi.get("viz_latest") or []:
        if not isinstance(row, dict):
            continue
        p = str(row.get("path") or "").strip()
        if not p or p in seen:
            continue
        seen.add(p)
        paths.append(p)
        if len(paths) >= max(1, int(limit)):
            break

    def _resolve(p: str, _email: str = "") -> str:
        return _resolve_viz_image_for_thumb(p)

    return dam_thumb_cache.warm_paths(
        paths,
        profile="grid",
        resolve_physical=_resolve,
    )


def _coerce_media_target(path: str) -> str:
    """Exact file, revision folder → viz raster, or fuzzy resolve after rename."""
    return _resolve_viz_image_for_thumb(path)


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
        if preview and ext == ".pdf":
            converted = _media_preview_pdf(target)
            if converted:
                return converted
            return 422, b"", "application/json"
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


try:
    import ip_guard
except Exception:  # pragma: no cover
    ip_guard = None  # type: ignore[assignment]


def _pg_activation_required() -> bool:
    try:
        import pg_db as _pg

        return bool(_pg.activation_required())
    except Exception:
        return False


def _reset_db_status_cache() -> None:
    """Po aktywacji pill "Baza" ma od razu pokazac prawde, nie 30-sekundowy cache."""
    try:
        if dam_db is not None:
            dam_db._STATUS_CACHE = None  # type: ignore[attr-defined]
            dam_db._STATUS_CACHE_TS = 0.0  # type: ignore[attr-defined]
    except Exception:
        pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[dam-bridge]", fmt % args)

    def _host_ok(self) -> bool:
        """Anty DNS-rebinding: most odpowiada tylko na Host = loopback.

        Strona z internetu, ktorej domena po chwili wskazuje na 127.0.0.1, jest dla
        przegladarki "same-origin" (brak Origin, brak CORS) i czytalaby caly most.
        Jej naglowek Host to jednak nadal obca domena - i na tym ja odcinamy.
        """
        host = (self.headers.get("Host") or "").strip().lower()
        if not host:
            return False
        if host.startswith("["):
            name = host.split("]", 1)[0] + "]"
        else:
            name = host.rsplit(":", 1)[0] if ":" in host else host
        if name in ("127.0.0.1", "localhost", "[::1]"):
            return True
        return PUBLIC_MODE and name in PUBLIC_HOSTS

    def _client_ip(self) -> str:
        """Adres klienta do blokady IP. Tylko tryb publiczny: nginx wpisuje X-Real-IP,
        a most slucha na 127.0.0.1, wiec naglowka nie podstawi nikt spoza NAS."""
        if not PUBLIC_MODE or ip_guard is None:
            return ""
        return ip_guard.normalize_ip(self.headers.get("X-Real-IP") or "")

    def _ip_guard_login_result(self, res: dict, email: str) -> dict:
        """Po probie logowania: policz blad dla IP (3 w 999 min = blok) albo wyzeruj licznik."""
        ip = self._client_ip()
        if not ip or ip_guard is None:
            return res
        err = str(res.get("error") or "")
        if err == "invalid_credentials":
            state = ip_guard.record_failure(ip, email)
            if state.get("blocked"):
                return {
                    "ok": False,
                    "error": "ip_blocked",
                    "hint": "Ten adres IP zostal zablokowany po nieudanych logowaniach. Odblokowuje administrator.",
                }
            out = dict(res)
            out["attempts_left"] = state.get("remaining")
            return out
        if res.get("ok") or err == "password_change_required":
            ip_guard.record_success(ip)
        return res

    def _public_gate(self, parsed) -> bool:
        """True = odpowiedz juz wyslana (zadanie zatrzymane). Poza trybem publicznym nic nie robi."""
        if not PUBLIC_MODE:
            return False
        ip = self._client_ip()
        if ip and ip_guard is not None and ip_guard.is_blocked(ip):
            self._json(
                403,
                {
                    "ok": False,
                    "error": "ip_blocked",
                    "hint": "Ten adres IP zostal zablokowany po nieudanych logowaniach. Odblokowuje administrator.",
                },
            )
            return True
        if parsed.path in PUBLIC_FORBIDDEN_PATHS:
            self._json(404, {"ok": False, "error": "desktop_only"})
            return True
        if parsed.path in PUBLIC_ANON_PATHS:
            return False
        res = resolve_session(self._bearer())
        if not res.get("ok"):
            self._json(401, {"ok": False, "error": "login_required"})
            return True
        return False

    def parse_request(self):  # noqa: D102
        if not super().parse_request():
            return False
        if not self._host_ok():
            self.send_error(403, "host_forbidden")
            return False
        return True

    def _origin_ok(self) -> bool:
        """CORS: tylko UI origin (albo brak Origin = same-origin / narzedzia lokalne)."""
        # <img>/<script> z obcej strony nie wysyla Origin, ale przegladarka oznacza
        # takie zadanie Sec-Fetch-Site: cross-site. UI :8765 -> most :8766 to same-site.
        if (self.headers.get("Sec-Fetch-Site") or "").strip().lower() == "cross-site":
            return False
        origin = (self.headers.get("Origin") or "").strip()
        if not origin:
            return True
        return _origin_of(origin) == _origin_of(CORS_ORIGIN)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", _origin_of(CORS_ORIGIN) or CORS_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        # JS fetch() needs Expose-Headers to read thumb cache probes (8765→8766).
        self.send_header(
            "Access-Control-Expose-Headers",
            "X-Dam-Thumb-Hit, X-DAM-Thumb-Source, X-Dam-Thumb-Digest",
        )
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
        if self.command != "HEAD":
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

    def do_HEAD(self):  # noqa: N802
        self.do_GET()

    def _bearer(self) -> str:
        auth = self.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            return auth[7:].strip()
        return ""

    def _session_user(self) -> dict | None:
        """User z Bearer tokena (Postgres/SQLite). None = brak / niewazna sesja."""
        res = resolve_session(self._bearer())
        if res.get("ok"):
            user = res.get("user") or {}
            if user.get("email") or user.get("role"):
                return user
        # Desktop: wygasly Bearer, ale bound-session na maszynie — rehydrate bez hasla.
        if PUBLIC_MODE:
            return None
        try:
            rh = auth_rehydrate(
                session_id=(self.headers.get("X-Dam-Session-Id") or "").strip(),
                device_id=(self.headers.get("X-Dam-Device-Id") or "").strip(),
                machine_id=(self.headers.get("X-Dam-Machine-Id") or "").strip(),
            )
            if rh.get("ok"):
                user = rh.get("user") or {}
                if user.get("email") or user.get("role"):
                    return user
        except Exception:
            pass
        return None

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

    def _require_lifecycle_writer(self) -> dict | None:
        """Status F/X/D na dysku: admin, power_user lub grupa Graficy (notification-groups grafik)."""
        user = self._require_login()
        if user is None:
            return None
        role = (user.get("role") or "").strip().lower()
        if role in ("admin", "power_user"):
            return user
        email = str(user.get("email") or "").strip().lower()
        if email:
            for g in load_notification_group("grafik"):
                gemail = str((g or {}).get("email") or "").strip().lower()
                if gemail and gemail == email:
                    return user
        self._json(
            403,
            {
                "ok": False,
                "error": "lifecycle_writer_required",
                "hint": (
                    "Zmiana statusu F/X/D wymaga roli admin lub power_user "
                    "albo czlonkostwa w grupie Graficy."
                ),
            },
        )
        return None

    def _reject_unless_db_online(self) -> bool:
        """True = already responded (blocked). Cache thumbs are not a DB."""
        hint = "Zapis wstrzymany - baza"
        if not dam_db:
            self._json(403, {"ok": False, "error": "db_unavailable", "hint": hint})
            return True
        gate = dam_db.allows_mutations()
        if gate.get("ok"):
            return False
        self._json(
            403,
            {
                "ok": False,
                "error": gate.get("error") or "db_required",
                "hint": hint,
            },
        )
        return True

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        # OAuth callback moze przyjsc z Origin zewnetrznego IdP - nie blokuj.
        if parsed.path != "/oauth/callback" and not self._origin_ok():
            self._json(403, {"ok": False, "error": "origin_forbidden"})
            return
        if self._public_gate(parsed):
            return
        if parsed.path == "/auth/ip-blocks":
            if self._require_admin() is None:
                return
            self._json(
                200,
                {
                    "ok": True,
                    "public_mode": PUBLIC_MODE,
                    "blocks": ip_guard.list_blocks() if ip_guard else [],
                    "allowlist": sorted(ip_guard.allowlist()) if ip_guard else [],
                    "max_failures": ip_guard.MAX_FAILURES if ip_guard else 0,
                    "window_minutes": (ip_guard.WINDOW_S // 60) if ip_guard else 0,
                },
            )
            return
        if parsed.path == "/file-availability":
            if dam_file_availability is None:
                self._json(500, {"ok": False, "error": "dam_file_availability_missing"})
                return
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            bases = detect_marketing_bases()
            has_root = bool(bases.get("recommended"))
            out = dam_file_availability.classify_path(
                path,
                email="",
                resolve_physical=lambda p, _e="": _coerce_media_target(p),
                has_marketing_root=has_root,
            )
            self._json(200, out)
            return
        if branding_asset_routes is not None:
            try:
                if branding_asset_routes.handle_get(self, parsed):
                    return
            except Exception as exc:  # noqa: BLE001
                self._json(500, {"ok": False, "error": "branding_routes", "detail": str(exc)})
                return
        if parsed.path == "/health" and PUBLIC_MODE and not resolve_session(self._bearer()).get("ok"):
            # Internet dostaje tylko "zyje": bez sciezek, wersji tras i stanu watcherow.
            self._json(200, {"ok": True, "service": "dam-local-bridge"})
            return
        if parsed.path == "/health":
            assoc = _assoc_status_payload()
            watcher = {}
            try:
                import index_supervisor

                watcher = index_supervisor.public_status()
            except Exception as exc:  # noqa: BLE001
                watcher = {"ok": False, "watcher_ok": False, "last_error": str(exc)}
            self._json(
                200,
                {
                    "ok": True,
                    "service": "dam-local-bridge",
                    "port": PORT,
                    "api_version": BRIDGE_API_VERSION,
                    "assoc": assoc,
                    "assoc_schema_error": assoc.get("schema_error") or "",
                    "watcher_ok": bool(watcher.get("watcher_ok")),
                    "watcher": watcher,
                    "hub_routes": [
                        "/branding-index",
                        "/branding-grid-index",
                        "/branding/asset",
                        "/assoc/queue",
                        "/branding-search-index",
                        "/search/semantic",
                        "/product-catalog",
                        "/product-lifecycle",
                        "/bulk-packaging",
                        "/branding/status",
                        "/wykrojniki-registry",
                        "/wykrojnik-mapping-queue",
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
                    ],
                },
            )
            return
        if parsed.path == "/detect-marketing-bases":
            # Lokalny most 127.0.0.1 - status dysku bez Bearer (UI pyta przed / bez sesji)
            self._json(200, detect_marketing_bases())
            return
        if parsed.path == "/preflight":
            # Tylko tryb pulpitowy (w publicznym blokuje _public_gate); bez sesji, < 3 s.
            self._json(200, build_preflight_report())
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
        if parsed.path == "/background-jobs":
            user = self._require_login()
            if user is None:
                return
            self._json(200, background_jobs_status())
            return
        if parsed.path == "/auth/registration-open":
            n = users_count()
            me = resolve_session(self._bearer())
            is_admin = bool(
                me.get("ok") and str((me.get("user") or {}).get("role") or "").lower() == "admin"
            )
            self._json(
                200,
                {
                    "ok": True,
                    "open": n == 0 or is_admin,
                    "users": n,
                    "bootstrap": n == 0,
                },
            )
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
        if parsed.path == "/file-index/viz-latest":
            qs = parse_qs(parsed.query)
            index = (qs.get("index") or [""])[0].strip()
            revision_path = (qs.get("revision_path") or qs.get("path") or [""])[0].strip()
            product_id = (qs.get("product_id") or [""])[0].strip()
            fi = _load_json(INDEX_FILE, {})
            hit: dict | None = None
            idx_base = index.split(".")[0] if index else ""
            for row in fi.get("viz_latest") or []:
                if not isinstance(row, dict):
                    continue
                if product_id and str(row.get("product_id") or "") != product_id:
                    continue
                if index and str(row.get("index") or "") != index:
                    if not idx_base or str(row.get("index_base") or "") != idx_base:
                        continue
                if revision_path:
                    rp = _norm_path_key(str(row.get("revision_path") or ""))
                    qk = _norm_path_key(revision_path)
                    if rp and qk and rp != qk and not qk.startswith(rp):
                        continue
                hit = row
                break
            self._json(
                200,
                {
                    "ok": True,
                    "row": hit,
                    "path": (hit or {}).get("path") or "",
                    "index_path": str(INDEX_FILE),
                },
            )
            return
        if parsed.path == "/checklist-extras":
            qs = parse_qs(parsed.query)
            needle = (qs.get("index") or [""])[0].strip()
            try:
                import dam_path_resolve as _dpr  # type: ignore

                by_index = _dpr.scan_extra_documents()
            except Exception as exc:
                self._json(200, {"ok": False, "by_index": {}, "error": str(exc)})
                return
            if needle:
                digits = _dpr.extras_digits(needle)
                self._json(
                    200,
                    {
                        "ok": True,
                        "index": digits,
                        "by_index": {digits: by_index.get(digits) or {}} if digits else {},
                    },
                )
                return
            self._json(200, {"ok": True, "by_index": by_index})
            return
        if parsed.path == "/file-index/product":
            if not INDEX_FILE.is_file():
                self._json(
                    404,
                    {"ok": False, "error": "file_index_missing", "path": str(INDEX_FILE)},
                )
                return
            qs = parse_qs(parsed.query)
            pid = (qs.get("id") or qs.get("product_id") or [""])[0].strip()
            data = _load_json(INDEX_FILE, {})
            hit = _file_index_product_by_id(data, pid)
            if not hit:
                self._json(404, {"ok": False, "error": "product_not_found", "id": pid})
                return
            try:
                import copy as _copy
                import dam_path_resolve as _dpr  # type: ignore

                hit = _copy.deepcopy(hit)
                for rev in hit.get("revisions") or []:
                    if not isinstance(rev, dict):
                        continue
                    extra = _dpr.extras_for_index(str(rev.get("index") or ""))
                    fbr = rev.setdefault("files_by_role", {})
                    if extra.get("karta") and not fbr.get("karty_wprowadzenia"):
                        fbr["karty_wprowadzenia"] = [
                            {
                                "name": Path(extra["karta"]).name,
                                "path": extra["karta"].replace("\\", "/"),
                            }
                        ]
                    if extra.get("presentation") and not fbr.get("strategia"):
                        fbr["strategia"] = [
                            {
                                "name": Path(extra["presentation"]).name,
                                "path": extra["presentation"].replace("\\", "/"),
                            }
                        ]
            except Exception:
                pass
            self._json(200, {"ok": True, "product": hit})
            return
        if parsed.path == "/file-index":
            if not INDEX_FILE.is_file():
                self._json(
                    404,
                    {"ok": False, "error": "file_index_missing", "path": str(INDEX_FILE)},
                )
                return
            qs = parse_qs(parsed.query)
            fields = (qs.get("fields") or [""])[0].strip().lower()
            try:
                if fields == "viz_latest":
                    data = _load_json(INDEX_FILE, {})
                    st = INDEX_FILE.stat()
                    raw, gz = _viz_slim_bytes(data, st.st_mtime)
                    accept = (self.headers.get("Accept-Encoding") or "").lower()
                    body = gz if (gz and "gzip" in accept) else raw
                    self.send_response(200)
                    self._cors()
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    if body is gz:
                        self.send_header("Content-Encoding", "gzip")
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("X-Dam-Index-Mtime", str(int(st.st_mtime)))
                    self.send_header("X-Dam-Index-Fields", "viz_latest")
                    self.end_headers()
                    self.wfile.write(body)
                    return
                if fields == "explorer":
                    data = _load_json(INDEX_FILE, {})
                    st = INDEX_FILE.stat()
                    raw, gz = _explorer_slim_bytes(data, st.st_mtime)
                    accept = (self.headers.get("Accept-Encoding") or "").lower()
                    body = gz if (gz and "gzip" in accept) else raw
                    self.send_response(200)
                    self._cors()
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    if body is gz:
                        self.send_header("Content-Encoding", "gzip")
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("X-Dam-Index-Mtime", str(int(st.st_mtime)))
                    self.send_header("X-Dam-Index-Fields", "explorer")
                    self.end_headers()
                    self.wfile.write(body)
                    return
                body = INDEX_FILE.read_bytes()
                accept = (self.headers.get("Accept-Encoding") or "").lower()
                st = INDEX_FILE.stat()
                if "gzip" in accept and len(body) > 4096:
                    body = gzip.compress(body)
                    self.send_response(200)
                    self._cors()
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Encoding", "gzip")
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("X-Dam-Index-Mtime", str(int(st.st_mtime)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("X-Dam-Index-Mtime", str(int(st.st_mtime)))
                self.end_headers()
                self.wfile.write(body)
                return
            except OSError as exc:
                self._json(500, {"ok": False, "error": "file_index_read_failed", "detail": str(exc)})
                return
        if parsed.path == "/index/status":
            self._json(200, index_status())
            return
        if parsed.path == "/index/report":
            try:
                import index_supervisor

                report = index_supervisor.read_report()
            except Exception as exc:  # noqa: BLE001
                self._json(200, {"ok": False, "error": str(exc), "items": []})
                return
            self._json(200, {"ok": True, **report})
            return
        if parsed.path == "/index/cancel":
            self._json(200, index_cancel())
            return
        if parsed.path == "/index/snooze":
            qs = parse_qs(parsed.query)
            until = (qs.get("until") or ["eod"])[0]
            self._json(200, index_snooze(until=until))
            return
        if parsed.path == "/thumb-cache/sync/status":
            if not dam_thumb_cache:
                self._json(500, {"ok": False, "error": "dam_thumb_cache_missing"})
                return
            self._json(200, dam_thumb_cache.sync_status())
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
            # Pill "Baza online/offline" - bez Bearera (localhost); cache 30s (status_light)
            st = dam_db.status_light() if dam_db else {"ok": False, "error": "dam_db_missing"}
            st["activation_required"] = _pg_activation_required()
            self._json(200, st)
            return
        if parsed.path == "/db/activation":
            self._json(200, {"ok": True, "activation_required": _pg_activation_required()})
            return
        if parsed.path == "/db/ping":
            self._json(200, dam_db.ping() if dam_db else {"ok": False, "error": "dam_db_missing"})
            return
        if parsed.path == "/db/changes":
            qs = parse_qs(parsed.query)
            since = (qs.get("since") or [""])[0]
            self._json(200, _db_changes_payload(since))
            return
        if parsed.path == "/db/kv":
            qs = parse_qs(parsed.query)
            key = _kv_key_or_none((qs.get("key") or [""])[0])
            if not key:
                self._json(400, {"ok": False, "error": "store_key_required"})
                return
            self._json(200, _db_kv_get_payload(key))
            return
        if parsed.path == "/db/path":
            if not dam_db:
                self._json(500, {"ok": False, "error": "dam_db_missing"})
                return
            root = dam_db.resolve_marketing_root()
            self._json(
                200,
                {
                    "ok": True,
                    "path": str(dam_db.db_path()),
                    "dir": str(dam_db.canonical_db_dir()),
                    "marketing_root": str(root) if root else "",
                    "source": "bin-database",
                },
            )
            return
        if parsed.path == "/telemetry/tail":
            # Telemetria zawiera sciezki i zachowanie uzytkownika - tylko admin.
            if self._require_admin() is None:
                return
            qs = parse_qs(parsed.query)
            limit = int((qs.get("limit") or ["100"])[0] or 100)
            if dam_debug is None:
                self._json(500, {"ok": False, "error": "dam_debug_missing"})
                return
            self._json(200, {"ok": True, "events": dam_debug.read_tail(limit=limit)})
            return
        if parsed.path == "/debug/self-test":
            if self._require_login() is None:
                return
            if dam_debug is None:
                self._json(500, {"ok": False, "error": "dam_debug_missing"})
                return
            self._json(200, dam_debug.run_self_test())
            return
        if parsed.path == "/app-update/check":
            if app_updates is None:
                self._json(500, {"ok": False, "error": "app_updates_missing"})
                return
            qs = parse_qs(parsed.query)
            force = (qs.get("force") or ["0"])[0] in ("1", "true", "yes")
            self._json(200, app_updates.check_for_updates(force=force))
            return
        if parsed.path == "/app-update/status":
            if app_updates is None:
                self._json(500, {"ok": False, "error": "app_updates_missing"})
                return
            self._json(200, app_updates.download_status())
            return
        if parsed.path == "/app-update/prefs":
            if app_updates is None:
                self._json(500, {"ok": False, "error": "app_updates_missing"})
                return
            self._json(200, {"ok": True, "prefs": app_updates.load_prefs(), "config": app_updates.load_update_config()})
            return
        if parsed.path == "/app-update/success":
            if app_updates is None:
                self._json(500, {"ok": False, "error": "app_updates_missing"})
                return
            if hasattr(app_updates, "consume_success_marker"):
                self._json(200, app_updates.consume_success_marker())
            else:
                self._json(200, {"ok": True, "version": None})
            return
        if parsed.path == "/db/prefer":
            if not dam_db:
                self._json(500, {"ok": False, "error": "dam_db_missing"})
                return
            self._json(200, {"ok": True, "prefer": dam_db.load_prefer()})
            return
        if parsed.path == "/thumb-cache/status":
            if not dam_thumb_cache:
                self._json(500, {"ok": False, "error": "dam_thumb_cache_missing"})
                return
            root = dam_thumb_cache.cache_root()
            thumbs_dir = root / "thumbs"
            try:
                files = list(thumbs_dir.glob("*")) if thumbs_dir.is_dir() else []
                avif_n = sum(1 for p in files if p.suffix.lower() == ".avif")
                jpg_n = sum(1 for p in files if p.suffix.lower() == ".jpg")
            except OSError:
                files, avif_n, jpg_n = [], 0, 0
            self._json(
                200,
                {
                    "ok": True,
                    "root": str(root),
                    "thumbs_dir": str(thumbs_dir),
                    "exists": thumbs_dir.is_dir(),
                    "files": len(files),
                    "avif": avif_n,
                    "jpg": jpg_n,
                    "module": True,
                    "warm": dam_thumb_cache.warm_status(),
                    "sync": dam_thumb_cache.sync_status(),
                },
            )
            return
        if parsed.path == "/thumb-cache":
            # <img src> bez Bearer - jail przez resolve + isfile w dam_thumb_cache
            if not dam_thumb_cache:
                self._json(500, {"ok": False, "error": "dam_thumb_cache_missing"})
                return
            qs = parse_qs(parsed.query)
            path = (qs.get("path") or [""])[0]
            profile = (qs.get("profile") or ["grid"])[0] or "grid"
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            # Logo index paths often miss PL/EN; never reuse a viz/packshot cache key.
            if _path_is_brand_logo_tree(path):
                resolved_logo = _coerce_media_target(path)
                try:
                    if resolved_logo and os.path.isfile(resolved_logo):
                        path = resolved_logo
                except OSError:
                    pass

            def _resolve(p: str, _email: str = "") -> str:
                return _coerce_media_target(p)

            code, body, ctype, meta = _thumb_cache_with_timeout(
                path,
                profile=profile,
                resolve_physical=_resolve,
            )
            if code != 200:
                self._json(code, meta if isinstance(meta, dict) else {"ok": False})
                return
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", ctype or "image/jpeg")
            self.send_header("Content-Length", str(len(body)))
            self.send_header(
                "Cache-Control",
                "private, max-age=86400" if meta.get("cache_hit") else "private, max-age=60",
            )
            if meta.get("digest"):
                self.send_header("X-Dam-Thumb-Digest", str(meta.get("digest")))
            self.send_header("X-Dam-Thumb-Hit", "1" if meta.get("cache_hit") else "0")
            src = str(meta.get("thumb_source") or ("cache" if meta.get("cache_hit") else "original"))
            self.send_header("X-DAM-Thumb-Source", src)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
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
        if parsed.path == "/variant-tags":
            if self._require_login() is None:
                return
            self._json(200, {"ok": True, "tags": variant_tag_suggestions()})
            return
        if parsed.path == "/inbox-items":
            user = self._require_login()
            if user is None:
                return
            box = _load_json(INBOX_ITEMS_FILE, {"items": []})
            role = str((user or {}).get("role") or "").strip().lower()
            if role not in VARIANT_NOTE_APPROVERS:
                # Wpisy zaadresowane do adminow (zgloszenia usterek, propozycje
                # opisow) nie moga trafic do zwyklej skrzynki. Brak pola
                # audience = wpis dla wszystkich, jak dotad.
                box = dict(box)
                box["items"] = [
                    it for it in (box.get("items") or [])
                    if str((it or {}).get("audience") or "") != "admins"
                ]
            self._json(200, box)
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
        if parsed.path == "/product-lifecycle":
            data = _load_json(PRODUCT_LIFECYCLE_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "product_lifecycle_missing"})
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
            # HARD: pelny dump ~340MB zamraza UI i most. Domyslnie zakaz.
            # Skrypty/admin: GET /branding-index?full=1
            qs = parse_qs(parsed.query or "")
            full = str((qs.get("full") or [""])[0] or "").strip().lower()
            if full not in ("1", "true", "yes"):
                self._json(
                    403,
                    {
                        "ok": False,
                        "error": "use_branding_grid_index",
                        "hint": "GET /branding-grid-index, /branding-grid-head, /branding/asset?id= ; full dump requires ?full=1",
                    },
                )
                return
            data = _load_json(BRANDING_INDEX_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "branding_index_missing"})
                return
            self._json(200, {"ok": True, **data})
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
        if parsed.path == "/search/semantic":
            qs = parse_qs(parsed.query or "")
            q = (qs.get("q") or [""])[0]
            try:
                limit = int((qs.get("limit") or ["80"])[0] or "80")
            except ValueError:
                limit = 80
            limit = max(1, min(limit, 500))
            if dam_semantic_search is None:
                self._json(
                    503,
                    {
                        "ok": False,
                        "error": "semantic_unavailable",
                        "detail": "Moduł wyszukiwania semantycznego nie jest dostępny.",
                        "hits": [],
                    },
                )
                return
            try:
                out = dam_semantic_search.search(q, limit=limit)
            except FileNotFoundError as exc:
                self._json(
                    503,
                    {
                        "ok": False,
                        "error": "semantic_data_missing",
                        "detail": "Brak pliku danych wyszukiwania: " + str(exc),
                        "hits": [],
                    },
                )
                return
            except Exception as exc:  # noqa: BLE001
                self._json(
                    500,
                    {
                        "ok": False,
                        "error": "semantic_search_failed",
                        "detail": str(exc),
                        "hits": [],
                    },
                )
                return
            if not isinstance(out, dict):
                self._json(
                    500,
                    {
                        "ok": False,
                        "error": "semantic_bad_payload",
                        "detail": "Wyszukiwanie semantyczne zwróciło nieprawidłową odpowiedź.",
                        "hits": [],
                    },
                )
                return
            if not out.get("ok"):
                self._json(503, out)
                return
            self._json(200, out)
            return
        if parsed.path == "/branding-search-index":
            data = _load_json(BRANDING_SEARCH_INDEX_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "branding_search_index_missing"})
                return
            self._json(200, {"ok": True, **data})
            return
        if parsed.path in ("/branding/status", "/branding/recognize/status"):
            status_file = BRANDING_RECOGNIZE_STATUS_FILE if "recognize" in parsed.path else BRANDING_STATUS_FILE
            data = _load_json(status_file, {"ok": False, "state": "unknown"})
            if not isinstance(data, dict):
                data = {"ok": False}
            if "recognize" not in parsed.path:
                with _branding_rebuild_lock:
                    live = dict(_branding_rebuild_state)
                data = {
                    **data,
                    **live,
                    "assoc": _assoc_status_payload(),
                    "generation_id": live.get("generation_id") or data.get("generation_id") or _branding_generation_id(),
                }
                try:
                    from rebuild_lock import status_from_lock

                    data["rebuild_lock"] = status_from_lock(BRANDING_REBUILD_LOCK_FILE, ttl_sec=7200)
                except Exception:
                    pass
            self._json(200, data)
            return
        if parsed.path == "/wykrojniki-registry":
            data = _load_json(WYKROJNIKI_REGISTRY_FILE, None)
            if not isinstance(data, dict):
                self._json(404, {"ok": False, "error": "wykrojniki_registry_missing"})
                return
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
        if parsed.path != "/oauth/callback" and not self._origin_ok():
            self._json(403, {"ok": False, "error": "origin_forbidden"})
            return
        if self._public_gate(parsed):
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

        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid_json"})
            return

        if parsed.path != "/oauth/callback" and not self._origin_ok():
            self._json(403, {"ok": False, "error": "origin_forbidden"})
            return
        if branding_asset_routes is not None:
            try:
                if branding_asset_routes.handle_post(self, parsed, data if isinstance(data, dict) else {}):
                    return
            except Exception as exc:  # noqa: BLE001
                self._json(500, {"ok": False, "error": "branding_routes_post", "detail": str(exc)})
                return
        if parsed.path == "/db/activate":
            # Przed logowaniem (bez bazy nie ma kont): chroni Host/Origin + limit prob w pg_seal.
            try:
                import pg_db as _pg

                res = _pg.activate(str(data.get("code") or ""))
            except Exception as exc:  # noqa: BLE001
                res = {"ok": False, "error": "activate_failed", "detail": type(exc).__name__}
            if res.get("ok"):
                _reset_db_status_cache()
            self._json(200 if res.get("ok") else 400, res)
            return
        if parsed.path == "/reveal":
            # Audyt 2026-09-17: uruchamianie Eksploratora/aplikacji tylko z sesja.
            if self._require_login() is None:
                return
            path = (data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, reveal_in_explorer(path))
            return
        if parsed.path == "/open":
            # Otworz plik w domyslnej aplikacji Windows (os.startfile).
            if self._require_login() is None:
                return
            path = (data.get("path") or "").strip()
            if not path:
                self._json(400, {"ok": False, "error": "path_required"})
                return
            self._json(200, open_in_default_app(path))
            return
        if parsed.path == "/open-image-resizer":
            # STREFA A3 / pkt 37: Inyfinn Image resizer (CLI albo GUI+Explorer)
            if self._require_login() is None:
                return
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
        if parsed.path == "/background-jobs":
            user = self._require_login()
            if user is None:
                return
            if not isinstance(data, dict):
                data = {}
            res = background_jobs_apply(data)
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
            # Pierwsze konto (bootstrap) albo zalogowany admin. Bez sesji + istniejace
            # konta = 403 — UI mylilo to z "brak bazy".
            n = users_count()
            admin = self._session_user()
            is_admin = bool(admin and str(admin.get("role") or "").lower() == "admin")
            bootstrap = n == 0
            if not is_admin and not bootstrap:
                self._json(
                    403,
                    {
                        "ok": False,
                        "error": "admin_required",
                        "hint": "Nowe konta zaklada tylko administrator (albo pierwsze konto na pustej bazie).",
                    },
                )
                return
            requested_role = (data.get("role") or "user").strip().lower()
            if requested_role not in ("admin", "power_user", "user"):
                requested_role = "user"
            if bootstrap:
                requested_role = "admin"
            try:
                res = register_user(
                    data.get("email") or "",
                    data.get("password") or "",
                    data.get("name") or "",
                    requested_role,
                )
            except Exception as exc:  # noqa: BLE001
                self._json(
                    503,
                    {
                        "ok": False,
                        "error": "database_unavailable",
                        "hint": str(exc)[:240],
                    },
                )
                return
            self._json(200 if res.get("ok") else 400, res)
            return
        if parsed.path == "/auth/login":
            res = auth_login(
                data.get("email") or "",
                data.get("password") or "",
                data.get("device_id") or "",
                data.get("machine_id") or "",
            )
            self._json(200, self._ip_guard_login_result(res, data.get("email") or ""))
            return
        if parsed.path == "/auth/ip-unblock":
            if self._require_admin() is None:
                return
            ok = bool(ip_guard and ip_guard.unblock(str(data.get("ip") or "")))
            self._json(200 if ok else 400, {"ok": ok})
            return
        if parsed.path == "/auth/change-password":
            # Bez Bearer: dowodem jest stare haslo (takze dla kont z wymuszona zmiana).
            from auth_store import change_password as _auth_change_password

            res = _auth_change_password(
                data.get("email") or "",
                data.get("old_password") or "",
                data.get("new_password") or "",
            )
            self._json(200, self._ip_guard_login_result(res, data.get("email") or ""))
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
        if parsed.path == "/telemetry/batch":
            payload = data if isinstance(data, dict) else {}
            events = payload.get("events") if isinstance(payload.get("events"), list) else []
            if dam_debug is None:
                self._json(500, {"ok": False, "error": "dam_debug_missing"})
                return
            n = dam_debug.append_batch(events)
            self._json(200, {"ok": True, "written": n})
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
        if parsed.path == "/index/cancel":
            self._json(200, index_cancel())
            return
        if parsed.path == "/index/snooze":
            until = str((data.get("until") if isinstance(data, dict) else None) or "eod")
            self._json(200, index_snooze(until=until))
            return
        if parsed.path == "/thumb-cache/sync/start":
            if not dam_thumb_cache:
                self._json(500, {"ok": False, "error": "dam_thumb_cache_missing"})
                return
            force = bool(data.get("force")) if isinstance(data, dict) else False
            self._json(200, dam_thumb_cache.start_cache_download(force=force))
            return
        if parsed.path == "/thumb-cache/publish":
            if not dam_thumb_cache:
                self._json(500, {"ok": False, "error": "dam_thumb_cache_missing"})
                return
            self._json(200, dam_thumb_cache.publish_new_thumbs())
            return
        if parsed.path == "/branding/rebuild":
            if self._require_admin() is None:
                return
            if not BUILD_BRANDING_INDEX.is_file():
                self._json(500, {"ok": False, "error": "build_branding_missing"})
                return
            self._json(200, start_branding_rebuild())
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
            if data.get("scope") is not None or data.get("asset_ids") is not None:
                # Nowy kontrakt (warianty materialu): scope file|all + asset_ids.
                status, payload = _save_branding_associations_scoped(
                    data,
                    str(user.get("email") or user.get("name") or "user"),
                )
                self._json(status, payload)
                return
            ok, err = _patch_branding_associations(
                data.get("asset_id"),
                data.get("folder_group_id") or "",
                data.get("linked_product_ids") or [],
                data.get("linked_variant_ids"),
                updated_by=str(user.get("email") or user.get("name") or "user"),
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
        if parsed.path == "/product-lifecycle/update":
            if self._require_admin() is None:
                return
            product_id = (data.get("product_id") or "").strip()
            stage = (data.get("stage") or "").strip().lower()
            notes = data.get("notes")
            if not product_id or not stage:
                self._json(400, {"ok": False, "error": "product_id_and_stage_required"})
                return
            lifecycle = _load_json(PRODUCT_LIFECYCLE_FILE, {"version": 1, "stages": [], "products": {}})
            products = lifecycle.setdefault("products", {})
            base = products.get(product_id) if isinstance(products.get(product_id), dict) else {}
            products[product_id] = {
                **base,
                "stage": stage,
                "updated_at": utc_now(),
                **({"notes": notes} if notes is not None else {}),
            }
            lifecycle["updated_at"] = utc_now()
            PRODUCT_LIFECYCLE_FILE.write_text(
                json.dumps(lifecycle, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            self._json(200, {"ok": True, "product_id": product_id, "stage": stage})
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
        if parsed.path == "/variant-note":
            # Opis moze dodac KAZDY zalogowany - to wiedza o produkcie, nie
            # zmiana na dysku. Ochrone dostaje dopiero opis zalozony przez
            # admina: wtedy cudza zmiana idzie do zatwierdzenia.
            actor_user = self._require_login()
            if actor_user is None:
                return
            raw_key = (data.get("index") or data.get("path") or "").strip()
            if not raw_key:
                self._json(400, {"ok": False, "error": "index_required"})
                return
            result = upsert_variant_note(
                raw_key,
                data.get("note") or "",
                str(actor_user.get("username") or ""),
                str(actor_user.get("role") or ""),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/support-report":
            actor_user = self._require_login()
            if actor_user is None:
                return
            result = create_support_report(
                data if isinstance(data, dict) else {},
                str(actor_user.get("username") or ""),
                str(actor_user.get("role") or ""),
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/variant-tag":
            # Sezon tagu to decyzja slownikowa dla calej firmy, nie notatka
            # przy jednym wariancie - stad wyzszy prog niz przy opisie.
            actor_user = self._require_power_user_or_admin()
            if actor_user is None:
                return
            result = upsert_variant_tag(
                data.get("tag") or "", data.get("season_from"), data.get("season_to")
            )
            self._json(200 if result.get("ok") else 400, result)
            return
        if parsed.path == "/variant-note/resolve":
            actor_user = self._require_power_user_or_admin()
            if actor_user is None:
                return
            raw_key = (data.get("index") or "").strip()
            result = resolve_variant_note_proposal(
                raw_key,
                bool(data.get("accept")),
                str(actor_user.get("username") or ""),
            )
            self._json(200 if result.get("ok") else 400, result)
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
        if parsed.path == "/thumb-cache/warm":
            if not dam_thumb_cache:
                self._json(500, {"ok": False, "error": "dam_thumb_cache_missing"})
                return
            paths = data.get("paths") if isinstance(data, dict) else None
            if not isinstance(paths, list):
                self._json(400, {"ok": False, "error": "paths_required"})
                return
            profile = str((data.get("profile") if isinstance(data, dict) else None) or "grid")

            def _resolve(p: str, _email: str = "") -> str:
                return _coerce_media_target(p)

            result = dam_thumb_cache.warm_paths(
                [str(x) for x in paths if x],
                profile=profile,
                resolve_physical=_resolve,
            )
            self._json(200, result)
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
            user = self._require_lifecycle_writer()
            if user is None:
                return
            if self._reject_unless_db_online():
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
                dest_dir=str(
                    payload.get("dest_dir")
                    or payload.get("destination")
                    or payload.get("out_dir")
                    or ""
                ).strip(),
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
        if parsed.path == "/finance/project-costs":
            if self._require_admin() is None:
                return
            pid = str(data.get("project_id") or data.get("id") or "").strip()
            result = _patch_project_costs_direct(pid, data if isinstance(data, dict) else {})
            self._json(200 if result.get("ok") else 400, result)
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
            if self._require_admin() is None:
                return
            if not dam_db:
                self._json(500, {"ok": False, "error": "dam_db_missing"})
                return
            pull_dump = bool(data.get("pull_dump") or data.get("github") or False)
            self._json(200, dam_db.force_reconnect(pull_dump=pull_dump))
            return
        if parsed.path == "/db/kv":
            user = self._require_login()
            if user is None:
                return
            key = _kv_key_or_none(str((data or {}).get("store_key") or (data or {}).get("key") or ""))
            if not key:
                self._json(400, {"ok": False, "error": "store_key_required"})
                return
            if "payload" not in (data or {}):
                self._json(400, {"ok": False, "error": "payload_required"})
                return
            code, body = _db_kv_set_payload(
                key,
                data.get("payload"),
                expected_updated_at=str(
                    data.get("updated_at") or data.get("expected_updated_at") or ""
                )
                or None,
                updated_by=str(user.get("email") or user.get("name") or "local_bridge"),
            )
            self._json(code, body)
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
        if parsed.path == "/app-update/prefs":
            if app_updates is None:
                self._json(500, {"ok": False, "error": "app_updates_missing"})
                return
            prefs = app_updates.save_prefs(data if isinstance(data, dict) else {})
            self._json(200, {"ok": True, "prefs": prefs})
            return
        if parsed.path == "/app-update/apply":
            if app_updates is None:
                self._json(500, {"ok": False, "error": "app_updates_missing"})
                return
            url = str((data or {}).get("download_url") or "").strip()
            action = str((data or {}).get("action") or "apply").strip().lower()
            if hasattr(app_updates, "apply_action") and action in (
                "download",
                "install",
                "apply",
                "cancel",
            ):
                self._json(200, app_updates.apply_action(action, url))
                return
            if action == "download":
                self._json(200, app_updates.start_background_download(url))
                return
            if action in ("install", "apply"):
                self._json(200, app_updates.install_downloaded(url))
                return
            self._json(200, app_updates.download_and_launch_installer(url))
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


def _pg_dump_python(conn) -> bytes:
    """Logiczny zrzut COPY (odtwarzanie po katastrofie, nie merge)."""
    from io import StringIO

    buf = StringIO()
    buf.write("-- DAM ETA hourly dump (psycopg2 COPY). Disaster recovery only.\n")
    buf.write("-- Do not merge dumps from two machines (SERIAL keys collide).\n")
    for table in ("users", "device_sessions", "audit_log", "dam_kv_store"):
        buf.write(f"TRUNCATE {table} CASCADE;\n")
        copy_buf = StringIO()
        cur = conn.cursor()
        cur.copy_expert(f"COPY {table} TO STDOUT", copy_buf)
        buf.write(f"COPY {table} FROM stdin;\n")
        buf.write(copy_buf.getvalue())
        buf.write("\\.\n")
    return gzip.compress(buf.getvalue().encode("utf-8"))


def _write_hourly_dump_bytes(raw_gz: bytes, when=None) -> list[Path]:
    """Jeden przebieg zapisuje plik godzinowy i dzienny. Nigdy nie podklada pliku
    "poprzedniej godziny" - dwa pliki z ta sama sekunda to falszywy dowod na to,
    ze harmonogram dziala."""
    from datetime import datetime as _dt, timezone as _tz

    stamp = when or _dt.now(_tz.utc).astimezone()
    out_dir = DESKTOP_DIR.parent.parent / "DATABASE"
    out_dir.mkdir(parents=True, exist_ok=True)
    hourly = out_dir / f"dam_eta_{stamp.strftime('%Y-%m-%d_%H')}.sql.gz"
    daily = out_dir / f"dam_eta_{stamp.strftime('%Y-%m-%d')}.sql.gz"
    hourly.write_bytes(raw_gz)
    daily.write_bytes(raw_gz)
    return [hourly, daily]


def _pg_backup_interval_s() -> float:
    raw = (os.environ.get("DAM_PG_BACKUP_INTERVAL_S") or "").strip()
    try:
        n = float(raw) if raw else 3600.0
    except ValueError:
        n = 3600.0
    if n <= 0:
        n = 3600.0
    return n


def _pg_backup_log_path() -> Path:
    return DESKTOP_DIR.parent.parent / "DATABASE" / "pg-backup-watcher.log"


def _pg_backup_log(msg: str) -> None:
    from datetime import datetime as _dt

    line = f"{_dt.now().isoformat(timespec='seconds')} {msg}"
    print("pg hourly backup:", msg, flush=True)
    try:
        p = _pg_backup_log_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError:
        pass


def run_hourly_pg_backup() -> dict:
    """Zrzut godzinowy z procesu mostu (watek, nie blokuje HTTP).

    Dev-tree-only (HARD): zawiera tabele users - blokada tez na manualne
    "Uruchom teraz" z panelu Zadania w tle, nie tylko na petle watchera."""
    if app_updates is not None:
        try:
            if not app_updates.is_portable_repo():
                return {"ok": False, "error": "not_dev_tree", "portable": False}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": f"portable_check_error:{exc}"}
    else:
        return {"ok": False, "error": "app_updates_missing"}
    try:
        import pg_db

        health: dict = {}
        for _attempt in range(6):
            health = pg_db.cached_health()
            if not health.get("ok"):
                try:
                    pg_db.ping_live()
                except Exception as exc:  # noqa: BLE001
                    health = {"ok": False, "error": str(exc)}
                else:
                    health = pg_db.cached_health()
            if health.get("ok"):
                break
            time.sleep(2)
        if not health.get("ok"):
            _pg_backup_log(f"skip health_pending={health}")
            return {"ok": False, "error": "health_pending", "health": health}
        conn = pg_db.connect()
        try:
            raw = _pg_dump_python(conn)
        finally:
            conn.close()
        paths = _write_hourly_dump_bytes(raw)
        return {
            "ok": True,
            "files": [str(p.name) for p in paths],
            "bytes": len(raw),
        }
    except Exception as exc:  # noqa: BLE001
        _pg_backup_log(f"warning {exc}")
        return {"ok": False, "error": str(exc)}


def _pg_backup_git_sync() -> None:
    script = DESKTOP_DIR / "scripts" / "sync-database-backups-to-git.py"
    if not script.is_file():
        return
    try:
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
        subprocess.run(
            [sys.executable, str(script), "--from-bridge", "--skip-pull", "--no-commit", "--quiet"],
            cwd=str(DESKTOP_DIR),
            timeout=120,
            check=False,
            creationflags=flags,
        )
    except Exception as exc:  # noqa: BLE001
        print("pg backup git sync warning:", exc)


def _pg_backup_watcher() -> None:
    """Co godzine (albo DAM_PG_BACKUP_INTERVAL_S). Watek mostu, nie supervisor UI.
    Git sync w osobnym watku, nigdy nie wywala mostu.
    Zimny start: pierwszy zrzut nie ginie po cichu - log skip/ok jest zawsze.

    Dev-tree-only (HARD): zrzut zawiera tabele users - nie moze ladowac na
    kazdym kliencie. Instalacja bez .git (is_portable_repo()==False) nie
    odpala tej petli w ogole (zero zrzutu do bin\\DATABASE, zero git sync)."""
    if app_updates is not None:
        try:
            if not app_updates.is_portable_repo():
                _pg_backup_log("skip not_dev_tree (installed copy)")
                return
        except Exception as exc:  # noqa: BLE001
            _pg_backup_log(f"portable_check_error {exc}")
            return
    else:
        _pg_backup_log("skip app_updates_missing (cannot verify dev tree)")
        return
    interval = _pg_backup_interval_s()
    _pg_backup_log(f"watcher_start interval_s={interval}")
    time.sleep(min(8.0, max(2.0, interval)))
    while True:
        try:
            if not _job_auto_enabled("pg-backup-watcher", _read_background_jobs_file()):
                _pg_backup_log("skip auto_off")
                time.sleep(interval)
                continue
            result = run_hourly_pg_backup()
            if result.get("ok"):
                _pg_backup_log(f"ok files={result.get('files')} bytes={result.get('bytes')}")
                threading.Thread(
                    target=_pg_backup_git_sync,
                    daemon=True,
                    name="dam-pg-backup-git",
                ).start()
            else:
                _pg_backup_log(f"skip {result}")
        except Exception as exc:  # noqa: BLE001
            _pg_backup_log(f"watcher_error {exc}")
        time.sleep(interval)


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
    # Port najpierw: autostart (klucz Run) i DAM.exe moga wystartowac mostek rownolegle.
    # Bez tego drugi proces robi cala inicjalizacje (index_supervisor, sync cache, watki)
    # i dopiero potem wywala sie na bindzie - pod pythonw.exe po cichu, bez sladu.
    try:
        httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as exc:
        print(f"DAM local bridge: port {PORT} zajety ({exc}) - mostek juz dziala, wychodze.")
        return

    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    DESKTOP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Dysk Marketing pod dowolna litera: w tle, nie blokuje startu (martwy dysk sieciowy).
    threading.Thread(
        target=_marketing_discovery_watcher, daemon=True, name="dam-marketing-discovery"
    ).start()
    if branding_asset_routes is not None:
        sqlite_path = None
        try:
            if dam_db is not None:
                sqlite_path = getattr(dam_db, "DB_CANONICAL", None)
        except Exception:
            sqlite_path = None

        def _require_admin_wrap(handler):
            return handler._require_admin() is not None

        def _mirror_override(asset_id: str, product_ids: list) -> None:
            import assoc_repo

            assoc_repo.mirror_override(
                asset_id,
                product_ids,
                overrides_path=BRANDING_ASSOC_OVERRIDES_FILE,
                updated_by="quiz",
            )

        branding_asset_routes.configure(
            web_root=WEB_ROOT,
            branding_index_file=BRANDING_INDEX_FILE,
            load_json=_load_json,
            sqlite_path=sqlite_path,
            assoc_overrides_file=BRANDING_ASSOC_OVERRIDES_FILE,
            require_admin=_require_admin_wrap,
            mirror_override=_mirror_override,
            assoc_decide=None,  # wired below after assoc_repo import
            marketing_root_prefixes=marketing_root_prefixes,
        )
    try:
        if dam_db is not None:
            print("db:", dam_db.init_db())
        auth_init_db()
        seed_owner_from_env()
    except Exception as exc:
        print("auth/db seed:", exc)
    try:
        _seed_naming_policy_to_postgres()
    except Exception as exc:
        print("naming policy seed:", exc)
    try:
        import assoc_repo

        db_path = getattr(dam_db, "DB_CANONICAL", None) if dam_db is not None else None
        assoc_repo.set_slim_publish_callback(_schedule_slim_grid_publish)
        if branding_asset_routes is not None:

            def _assoc_decide(handler, body: dict) -> dict:
                return assoc_repo.decide_quiz(
                    str(body.get("asset_id") or ""),
                    str(body.get("action") or ""),
                    list(body.get("product_ids") or []),
                    db_path=db_path,
                    updated_by=str(body.get("user") or "quiz"),
                    schedule_publish=True,
                )

            branding_asset_routes.configure(assoc_decide=_assoc_decide)
        # Aktualizacja instalatora podmienia branding-grid-index.json na wersje z maszyny
        # budujacej (starsza/inna baza) i przykrywa lokalne skojarzenia uzytkownika -
        # wygladaja jakby zniknely, chociaz w jego wlasnym dam-local.sqlite sa nietkniete.
        # Jedna przebudowa slim-grid z lokalnej bazy przy kazdym starcie naprawia to same,
        # bez czekania az ktos cokolwiek recznie edytuje.
        _schedule_slim_grid_publish(delay_sec=10.0)
        if db_path:
            import assoc_sync

            # Postgres na Synology = baza glowna skojarzen; lokalny SQLite = zrzut offline.
            assoc_sync.start(Path(db_path), on_pulled=_schedule_slim_grid_publish)
    except Exception as exc:
        print("assoc_repo wire:", exc)
    try:
        import index_supervisor

        # 2s poll + depth 5: DK→kat→produkt→wariant→WIZKI→RGB (bylo 5s/depth3 = slepe WIZKI)
        sup = index_supervisor.ensure_index_supervisor(interval=2.0, depth=5)
        print("index_supervisor:", {k: sup.get(k) for k in ("ok", "owned", "started", "reason")})
    except Exception as exc:
        print("index_supervisor:", exc)
    try:
        if dam_thumb_cache:
            boot = dam_thumb_cache.ensure_boot_sync()
            print("thumb_cache_sync:", {k: boot.get(k) for k in ("ok", "started", "reason", "running")})
    except Exception as exc:
        print("thumb_cache_sync:", exc)
    if dam_debug is not None:
        try:
            dam_debug.ensure_daemon_started(interval_sec=60.0)
        except Exception as exc:
            print("dam_debug:", exc)
    if app_updates is not None:
        try:
            app_updates.ensure_scheduler_started()
        except Exception:
            pass
    threading.Thread(target=_tag_proposal_watcher, daemon=True).start()
    threading.Thread(target=_kv_cache_watcher, daemon=True).start()
    threading.Thread(target=_pg_backup_watcher, daemon=True, name="dam-pg-backup").start()
    print(f"DAM local bridge http://{HOST}:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        try:
            import index_supervisor

            index_supervisor.stop_index_supervisor()
        except Exception:
            pass
        httpd.shutdown()


if __name__ == "__main__":
    main()
