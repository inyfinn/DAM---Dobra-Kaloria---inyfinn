# -*- coding: utf-8 -*-
"""
Tozsamosc maszyny / sesji DAM ETA.

Cel: gdy instalacja stoi na udziale sieciowym albo ktos skopiuje folder,
sesja zalogowanego usera NIE moze "przyleciec" na inny PC.

Skladniki (Windows):
- MachineGuid (HKLM\\SOFTWARE\\Microsoft\\Cryptography) - stabilne ID OS
- hostname
- Windows username (konto lokalne / domenowe)
- opcjonalnie: serial woluminu systemowego

machine_id = dam-mid-<sha256[0:32]>  (deterministyczny, bez sekretow w plaintext)
session_id = dam-sid-<token>         (losowy per logowanie)
device_id  = dam-dev-<machine_id>    (1:1 z maszyna + userem Windows)
"""
from __future__ import annotations

import getpass
import hashlib
import json
import os
import platform
import secrets
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_ROOT = DESKTOP_DIR.parent / "web"
IDENTITY_RUNTIME = WEB_ROOT / "data" / "dam-identity.json"
# Powiazanie sesji z komputerem lezy w katalogu stanu uzytkownika Windows, a nie w
# folderze instalacji: instalator podmienia folder aplikacji przy aktualizacji, a
# uruchomienie z repo (D:, Synology Drive) moglo przywrocic stara kopie pliku.
# Stara lokalizacja jest czytana jako zapas, zeby przeprowadzka nie wylogowala nikogo.
LEGACY_BOUND_SESSION = DESKTOP_DIR / "data" / "bound-session.json"
try:
    import platform_compat as _pc

    BOUND_SESSION = _pc.user_state_dir() / "bound-session.json"
except Exception:  # noqa: BLE001
    BOUND_SESSION = LEGACY_BOUND_SESSION


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _win_machine_guid() -> str:
    if sys.platform != "win32":
        return ""
    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Cryptography",
        ) as key:
            val, _ = winreg.QueryValueEx(key, "MachineGuid")
            return str(val or "").strip()
    except OSError:
        return ""


def _system_volume_serial() -> str:
    if sys.platform != "win32":
        return ""
    try:
        import ctypes

        root = os.environ.get("SystemDrive", "C:") + "\\"
        serial = ctypes.c_uint32(0)
        ok = ctypes.windll.kernel32.GetVolumeInformationW(
            ctypes.c_wchar_p(root),
            None,
            0,
            ctypes.byref(serial),
            None,
            None,
            None,
            0,
        )
        if not ok:
            return ""
        return f"{serial.value:08X}"
    except Exception:
        return ""


def collect_raw_parts() -> dict[str, str]:
    hostname = (socket.gethostname() or platform.node() or "").strip().lower()
    win_user = (getpass.getuser() or os.environ.get("USERNAME") or "").strip().lower()
    domain = (os.environ.get("USERDOMAIN") or "").strip().lower()
    guid = _win_machine_guid()
    vol = _system_volume_serial()
    return {
        "machine_guid": guid,
        "hostname": hostname,
        "windows_user": win_user,
        "userdomain": domain,
        "volume_serial": vol,
        "platform": sys.platform,
    }


def compute_machine_id(parts: dict[str, str] | None = None) -> str:
    p = parts or collect_raw_parts()
    # machine_guid + hostname + windows_user (+ domain) - bez sciezek lokalnych
    material = "|".join(
        [
            p.get("machine_guid") or "noguid",
            p.get("hostname") or "nohost",
            p.get("userdomain") or "nodomain",
            p.get("windows_user") or "nouser",
            p.get("volume_serial") or "novol",
        ]
    )
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()[:32]
    return "dam-mid-" + digest


def device_id_for_machine(machine_id: str | None = None) -> str:
    mid = machine_id or compute_machine_id()
    return "dam-dev-" + mid.replace("dam-mid-", "")


def new_session_id() -> str:
    return "dam-sid-" + secrets.token_urlsafe(24)


def collect_identity() -> dict[str, Any]:
    parts = collect_raw_parts()
    mid = compute_machine_id(parts)
    return {
        "ok": True,
        "machine_id": mid,
        "device_id": device_id_for_machine(mid),
        "hostname": parts.get("hostname") or "",
        "windows_user": parts.get("windows_user") or "",
        "userdomain": parts.get("userdomain") or "",
        "platform": parts.get("platform") or "",
        "has_machine_guid": bool(parts.get("machine_guid")),
        "collected_at": _utc(),
    }


def write_identity_runtime(identity: dict[str, Any] | None = None) -> Path:
    data = identity or collect_identity()
    IDENTITY_RUNTIME.parent.mkdir(parents=True, exist_ok=True)
    IDENTITY_RUNTIME.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return IDENTITY_RUNTIME


def read_bound_session() -> dict[str, Any] | None:
    for path in (BOUND_SESSION, LEGACY_BOUND_SESSION):
        if not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(data, dict):
            return data
    return None


def write_bound_session(payload: dict[str, Any]) -> Path:
    BOUND_SESSION.parent.mkdir(parents=True, exist_ok=True)
    BOUND_SESSION.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return BOUND_SESSION


def clear_bound_session() -> None:
    # Obie lokalizacje - inaczej stara kopia w folderze instalacji przywrocilaby
    # sesje po wylogowaniu (read_bound_session czyta ja jako zapas).
    for path in (BOUND_SESSION, LEGACY_BOUND_SESSION):
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            pass


def verify_launch_binding() -> dict[str, Any]:
    """
    Wywolywane PRZED startem UI.
    Jesli bound-session.json ma inny machine_id niz biezaca maszyna -> kasuj binding.
    """
    identity = collect_identity()
    write_identity_runtime(identity)
    bound = read_bound_session()
    if not bound:
        return {
            "ok": True,
            "identity": identity,
            "binding": "none",
            "cleared": False,
            "message": "Brak lokalnego wiazania sesji - wymagane logowanie.",
        }
    bound_mid = str(bound.get("machine_id") or "").strip()
    bound_user = str(bound.get("windows_user") or "").strip().lower()
    cur_mid = identity["machine_id"]
    cur_user = (identity.get("windows_user") or "").strip().lower()
    mismatch = False
    reasons: list[str] = []
    if bound_mid and bound_mid != cur_mid:
        mismatch = True
        reasons.append("machine_id")
    if bound_user and cur_user and bound_user != cur_user:
        mismatch = True
        reasons.append("windows_user")
    if mismatch:
        clear_bound_session()
        return {
            "ok": True,
            "identity": identity,
            "binding": "cleared",
            "cleared": True,
            "reasons": reasons,
            "message": (
                "Wykryto sesje z innej maszyny lub innego konta Windows.\n"
                "Wiazanie usuniete - zaloguj sie ponownie na tym PC."
            ),
        }
    return {
        "ok": True,
        "identity": identity,
        "binding": "match",
        "cleared": False,
        "session_id": bound.get("session_id") or "",
        "user_email": bound.get("user_email") or "",
        "message": "Wiazanie maszyny OK.",
    }


if __name__ == "__main__":
    print(json.dumps(verify_launch_binding(), ensure_ascii=False, indent=2))
