"""Shared runtime ports and paths for DAM desktop app."""
from __future__ import annotations

import json
import os
import socket
import sys
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = DESKTOP_DIR.parent / "web"
# Layout: GIT_ROOT (DAM.exe + .git) / bin = CONTENT_ROOT (apps, THEME, runtime, …)
# Primary 2026-08-05+: D:\\...\\DAM---Dobra-Kaloria---inyfinn (nie P:\\DAM).
CONTENT_ROOT = DESKTOP_DIR.parent.parent
GIT_ROOT = CONTENT_ROOT.parent
# Back-compat alias: content tree (not .git location after bin/ layout)
REPO_ROOT = CONTENT_ROOT

def _dir_is_writable(path: Path) -> bool:
    """Czy da sie pisac w tym katalogu. Probny plik, nie os.access - na macOS
    os.access klamie przy woluminach tylko do odczytu i przy ACL."""
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".dam-write-probe"
        probe.write_text("1", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def _user_data_root() -> Path:
    """Katalog na dane zmienne, gdy drzewo aplikacji jest tylko do odczytu.

    POWOD (2026-09-22): uzytkownik uruchamia DAM.app PROSTO Z ZAMONTOWANEGO .dmg.
    Obraz UDZO jest tylko do odczytu, a lancuch importu mostu konczyl sie zapisem
    do wnetrza bundla:
        import local_bridge -> import auth_store
        -> auth_store.py:37 DB_PATH = _db_path()          (PRZY IMPORCIE)
        -> dam_db.db_path() -> _migrate_into_repo()
        -> _migrate_sqlite_canonical() -> REPO_DATABASE.mkdir()   BEZ try/except
        -> OSError: [Errno 30] Read-only file system
    Most gina przy imporcie, zanim zajal port 8766 - stad "Most DAM niedostepny".
    Zapis do wnetrza PODPISANEGO bundla uniewaznia tez pieczec podpisu, wiec nawet
    na zapisywalnym woluminie jest to blad, nie tylko na .dmg.
    """
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
        return base / "DAM"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "DAM"
    return Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share") / "DAM"


# Korzen na dane zmienne: drzewo aplikacji, gdy zapisywalne (Windows, dev),
# inaczej katalog uzytkownika (.dmg, /Applications, bundle po podpisaniu).
CONTENT_ROOT_WRITABLE = _dir_is_writable(CONTENT_ROOT)
DATA_ROOT = CONTENT_ROOT if CONTENT_ROOT_WRITABLE else _user_data_root()

DEFAULT_UI_PORT = 8765
DEFAULT_BRIDGE_PORT = 8766
HOST = "127.0.0.1"
APP_TITLE = "DAM - Dobra Kaloria - Inyfinn"
APP_VERSION = "2.3.7"  # sync z apps/web/version.json + dam-version.js
MUTEX_NAME = "Global\\DAM_DOBRA_KALORIA_INYFINN_SINGLE_INSTANCE"


def pick_free_port(preferred: int) -> int:
    for port in (preferred, preferred + 1, preferred + 2, preferred + 10, 0):
        candidate = port if port else 0
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((HOST, candidate))
                return int(sock.getsockname()[1])
            except OSError:
                continue
    raise RuntimeError("No free TCP port for DAM runtime")


def runtime_payload(ui_port: int, bridge_port: int) -> dict:
    origin = f"http://{HOST}:{ui_port}"
    identity: dict = {}
    try:
        from machine_identity import collect_identity

        identity = collect_identity()
    except Exception:
        identity = {}
    return {
        "app": "dam-eta",
        "host": HOST,
        "ui_port": ui_port,
        "bridge_port": bridge_port,
        "ui_origin": origin,
        "bridge": f"http://{HOST}:{bridge_port}",
        "start_url": f"{origin}/dashboard.html",
        "machine_id": identity.get("machine_id") or "",
        "device_id": identity.get("device_id") or "",
        "windows_user": identity.get("windows_user") or "",
        "hostname": identity.get("hostname") or "",
    }


def runtime_file_path() -> Path:
    """dam-runtime.json obok UI, gdy da sie pisac; inaczej w katalogu uzytkownika.

    Na zamontowanym .dmg WEB_ROOT jest tylko do odczytu - wczesniej ten zapis
    rzucal OSError i wywracal start aplikacji.
    """
    if CONTENT_ROOT_WRITABLE:
        return WEB_ROOT / "data" / "dam-runtime.json"
    return DATA_ROOT / "apps" / "web" / "data" / "dam-runtime.json"


def write_runtime_file(ui_port: int, bridge_port: int) -> Path:
    path = runtime_file_path()
    payload = json.dumps(runtime_payload(ui_port, bridge_port), ensure_ascii=False, indent=2) + "\n"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(payload, encoding="utf-8")
        return path
    except OSError:
        fallback = DATA_ROOT / "apps" / "web" / "data" / "dam-runtime.json"
        fallback.parent.mkdir(parents=True, exist_ok=True)
        fallback.write_text(payload, encoding="utf-8")
        return fallback


def env_for_bridge(ui_port: int, bridge_port: int) -> dict:
    origin = f"http://{HOST}:{ui_port}"
    env = os.environ.copy()
    env["DAM_BRIDGE_PORT"] = str(bridge_port)
    env["DAM_UI_ORIGIN"] = origin
    env["DAM_WEB_ROOT"] = str(WEB_ROOT)
    env["PYTHONUTF8"] = "1"
    return env

