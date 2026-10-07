# -*- coding: utf-8 -*-
"""ETAP 0 synchronizacji (07.10.2026): rejestr komputerow z M: - strona klienta.

Co to jest M: i kto je ma, wie BAZA (tabela dam_m_computers, tworzy ja wlasciciel plikiem
sql/fleet.sql), nie plik-znacznik w drzewie i nie wykrywanie dysku. Para (komputer, dysk)
zglasza sie sama jako 'pending' (robi to tetno, fleet_heartbeat.py), zatwierdza admin w
Ustawieniach. Ten modul daje etapowi 1a/4 jedna funkcje:

    role_for_root(pg_connect, root_path) -> {"role": "m"|"copy", "state": ..., "share": ..., "drive": ...}

Reguly (decide):
  - approved + source='admin'            -> m (admin wie lepiej niz wykrywanie: RaiDrive, dysk domowy);
  - approved + source='auto'             -> m TYLKO gdy wykryty klucz ROOT (share) rowna sie zapisanemu
                                            (przemapowanie litery na inny udzial NIE dziedziczy zatwierdzenia);
  - pending / revoked                    -> copy z tym stanem; brak wiersza -> copy/none.
Zmiana ROOT na tym samym komputerze to INNA para: cache jest kluczowany po znormalizowanym root_path.
Blad odczytu NIGDY nie daje roli m "z niczego": liczy sie ostatni ZNANY wiersz dla tego samego root_path
(plik stanu m-computers.json, przetrwa restart); bez niego wynik to copy/none. Zapisuje sie WIERSZ, nie
wynik - rola jest zawsze liczona od nowa z aktualnie wykrytego udzialu.
Zegar klienta nie jest tu uzywany (cache to monotonic); reguly czasowe liczy baza.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
from typing import Any, Callable

CACHE_TTL_S = 60.0
_LOCK = threading.Lock()
_CACHE: dict[str, dict[str, Any]] = {}  # root_key -> {"at": monotonic, "value": {...}}
_SAVED: dict[str, dict[str, Any]] = {}  # root_key -> ostatni zapisany wiersz (bez zbednych zapisow na dysk)

_KINDS = {"remote", "fixed", "removable"}


def machine_key(name: str) -> str:
    """Klucz komputera w bazie: jak lower(btrim(split_part(x, ':', 1))) w SQL."""
    return str(name or "").split(":", 1)[0].strip(" ").lower()


def normalize_share(path: str) -> str:
    """Klucz ROOT/udzialu: male litery, ukosniki w przod, bez koncowego (CHECK w dam_m_computers)."""
    return str(path or "").strip().replace("\\", "/").lower().rstrip("/")


def _wnet_connection(drive: str) -> str:
    """\\\\serwer\\udzial odwzorowany na litere dysku (WNetGetConnectionW) albo ''."""
    try:
        import ctypes
        from ctypes import wintypes

        size = wintypes.DWORD(1024)
        buf = ctypes.create_unicode_buffer(1024)
        rc = ctypes.windll.mpr.WNetGetConnectionW(str(drive), buf, ctypes.byref(size))
        return buf.value if rc == 0 else ""
    except Exception:  # noqa: BLE001 - tylko wykrywanie, nigdy nie wywraca wolajacego
        return ""


def _drive_kind(root_path: str) -> str:
    try:
        import index_authority  # noqa: PLC0415

        kind = index_authority._drive_type_label(root_path)  # noqa: SLF001 - ta sama sonda co panel
    except Exception:  # noqa: BLE001
        kind = ""
    return kind if kind in _KINDS else "unknown"


def root_info(root_path: str) -> dict[str, str]:
    """{kind: none|remote|fixed|removable|unknown, drive: 'M:'|'', share: klucz ROOT}.

    Windows: dysk sieciowy -> UNC z WNetGetConnectionW plus podsciezka ROOT za litera; dysk
    nie-sieciowy albo UNC nieznany -> PELNA znormalizowana sciezka lokalna. ROOT jako UNC bez litery:
    drive='', kind='remote'. Brak ROOT: none. macOS/Linux: kind='unknown', klucz = pelna sciezka
    (NIESPRAWDZONE, jak montowany jest udzial na Macu - do czasu pomiaru rejestruje admin recznie)."""
    raw = str(root_path or "").strip()
    if not raw:
        return {"kind": "none", "drive": "", "share": ""}
    if sys.platform != "win32":
        return {"kind": "unknown", "drive": "", "share": normalize_share(raw)}
    win = raw.replace("/", "\\")
    if win.startswith("\\\\"):
        return {"kind": "remote", "drive": "", "share": normalize_share(win)}
    drive = os.path.splitdrive(win)[0].upper()
    if not drive:
        return {"kind": "unknown", "drive": "", "share": normalize_share(win)}
    kind = _drive_kind(raw)
    share = normalize_share(win)
    if kind == "remote":
        unc = _wnet_connection(drive)
        if unc:
            sub = win[len(drive):].strip("\\")
            share = normalize_share(unc + ("\\" + sub if sub else ""))
    return {"kind": kind, "drive": drive, "share": share}


def decide(info: dict[str, str], row: dict[str, Any] | None) -> dict[str, str]:
    """Czysta regula roli z wykrytego ROOT (info) i wiersza rejestru (row albo None)."""
    out = {"role": "copy", "state": "none", "share": info.get("share") or "", "drive": info.get("drive") or ""}
    if not row:
        return out
    state = str(row.get("state") or "none")
    out["state"] = state
    if state != "approved":
        return out
    if str(row.get("source") or "auto") == "admin" or (out["share"] and out["share"] == str(row.get("share") or "")):
        out["role"] = "m"
    return out


def read_row(cur: Any, machine: str, drive: str) -> dict[str, Any] | None:
    cur.execute("SELECT state, source, share FROM dam_m_computers WHERE machine = %s AND drive = %s",
                (machine, drive))
    row = cur.fetchone()
    if not row:
        return None
    if hasattr(row, "get"):
        return {"state": row.get("state"), "source": row.get("source"), "share": row.get("share")}
    return {"state": row[0], "source": row[1], "share": row[2]}


def _state_path():
    import platform_compat  # noqa: PLC0415 - ten sam katalog co index-authority.json

    return platform_compat.user_state_dir() / "m-computers.json"


def _load_saved() -> dict[str, Any]:
    try:
        raw = json.loads(_state_path().read_text(encoding="utf-8"))
        roots = raw.get("roots") if isinstance(raw, dict) else None
        return roots if isinstance(roots, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_row(root_key: str, row: dict[str, Any] | None) -> None:
    """Ostatni ZNANY wiersz dla tego root_path - tylko po udanym odczycie i tylko gdy sie zmienil."""
    if _SAVED.get(root_key, "?") == row:
        return
    try:
        roots = _load_saved()
        roots[root_key] = row
        p = _state_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_name(p.name + f".{os.getpid()}.tmp")
        tmp.write_text(json.dumps({"roots": roots}, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, p)
        _SAVED[root_key] = row
    except OSError:
        pass


def apply_row(root_path: str, info: dict[str, str], row: dict[str, Any] | None) -> dict[str, Any]:
    """Wiersz odczytany z bazy (udany odczyt!) -> rola; odswieza cache i plik ostatniej znanej wartosci."""
    key = normalize_share(root_path)
    value: dict[str, Any] = {**decide(info, row), "stale": False}
    with _LOCK:
        _CACHE[key] = {"at": time.monotonic(), "value": value}
    _save_row(key, row)
    return dict(value)


def fallback(root_path: str, info: dict[str, str]) -> dict[str, Any]:
    """Odczyt sie nie udal: ostatni znany wiersz TEGO root_path (rola liczona od nowa), inaczej copy/none."""
    key = normalize_share(root_path)
    saved = _load_saved()
    if key in saved:
        out: dict[str, Any] = dict(decide(info, saved.get(key)))
        out["stale"] = True
        return out
    return {**decide(info, None), "stale": True}


def role_for_root(pg_connect: Callable[[], Any], root_path: str, *, force: bool = False) -> dict[str, Any]:
    """Rola tego komputera dla tego ROOT. Cache 60 s po root_path; force=True pomija cache.
    Nigdy nie rzuca: blad bazy/braku tabeli -> ostatni znany wiersz albo copy/none."""
    info = root_info(root_path)
    if info["kind"] == "none":
        return {**decide(info, None), "stale": False}
    key = normalize_share(root_path)
    now = time.monotonic()
    if not force:
        with _LOCK:
            hit = _CACHE.get(key)
        if hit and now - float(hit["at"]) < CACHE_TTL_S:
            return dict(hit["value"])
    machine = machine_key(_machine_name())
    if not machine:
        return fallback(root_path, info)
    try:
        pg = pg_connect()
    except Exception:  # noqa: BLE001
        return fallback(root_path, info)
    try:
        row = read_row(pg.cursor(), machine, info["drive"])
        return apply_row(root_path, info, row)
    except Exception:  # noqa: BLE001 - brak tabeli (jeszcze bez fleet.sql), siec, zly typ
        return fallback(root_path, info)
    finally:
        try:
            pg.close()
        except Exception:  # noqa: BLE001
            pass


def _machine_name() -> str:
    import index_authority  # noqa: PLC0415 - jedna definicja nazwy komputera dla calego programu

    return index_authority.current_machine()


def reset_cache() -> None:
    """Dla testow."""
    with _LOCK:
        _CACHE.clear()
        _SAVED.clear()
