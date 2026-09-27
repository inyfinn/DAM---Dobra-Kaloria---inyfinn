# -*- coding: utf-8 -*-
"""Faza 3, decyzja kierownika 27.09.2026: kto smie zmieniac WSPOLNY katalog w bazie.

Wybor lokalnego ROOT (ktory dysk otwiera pliki na tym komputerze) NIE daje
prawa do zmiany wspolnego indeksu w PostgreSQL. Komputer, ktorego ROOT jest
opozniona kopia (np. Synology Drive w trakcie synchronizacji), nie moze:
  - publikowac migawek indeksu (file-index / branding-index / branding-search-index,
    patrz index_snapshots.publish_changed),
  - wysylac tombstonow (usuniec materialow z dam_assets, patrz asset_sync_runner).

Upsert/restore zostaja dozwolone zawsze - user na lokalnej kopii nadal moze
dodac nowy plik, a regula "starszy mtime nigdy nie nadpisuje nowszego"
(asset_sync.py, WHERE w SQL) juz chroni baze przed cofnieciem przez wolniejsza
kopie - patrz tests/test_asset_sync.py::test_stale_x_older_mtime_does_not_revert_m_change
i ::test_stale_x_forced_push_of_older_version_refused_by_db (istniejace testy,
nie duplikujemy ich tutaj).

Klucz w PG: dam_meta['index_authority'] = JSON
    {"machines": ["INYFINN", "KRZYSZTOFWI", ...], "updated_at": "...", "updated_by": "..."}

Zachowanie jest ADDYTYWNE: klucza nie ma w bazie, JSON jest zly, albo baza nie
odpowiada -> may_publish() zwraca None, a kazdy wolajacy (index_snapshots,
asset_sync_runner) ma dzialac DOKLADNIE tak jak przed tym modulem (nikt nie
jest blokowany). Tylko jawne machines=[...] BEZ tej maszyny daje False.
"""
from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable

MODE_KEY = "index_authority"
_CACHE_TTL_S = 60.0
_LOCK = threading.Lock()
_CACHE: dict[str, Any] = {"at": 0.0, "value": None, "raw": {}, "error": ""}


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def current_machine() -> str:
    """Ta sama nazwa, co dam_assets.seen_by_machine / built_by - patrz
    index_snapshots._machine() i local_bridge._asset_sync_machine()."""
    return (os.environ.get("COMPUTERNAME") or os.environ.get("HOSTNAME") or "").strip()


def _drive_type_label(root_path: str) -> str:
    """Informacyjnie TYLKO dla panelu (GetDriveTypeW) - nigdy nie wplywa na
    may_publish(). Decyduje wylacznie lista maszyn w bazie."""
    if not root_path or os.name != "nt":
        return ""
    try:
        import ctypes

        drive = os.path.splitdrive(str(root_path))[0]
        if not drive:
            return ""
        n = ctypes.windll.kernel32.GetDriveTypeW(str(drive) + "\\")
        return {0: "unknown", 1: "no_root_dir", 2: "removable", 3: "fixed",
                4: "remote", 5: "cdrom", 6: "ramdisk"}.get(int(n), "unknown")
    except Exception:  # noqa: BLE001 - tylko etykieta, nigdy nie wywraca wolajacego
        return ""


def _default_pg_connect() -> Any:
    import pg_db  # noqa: PLC0415

    return pg_db.connect()


def _read_raw(pg_connect: Callable[[], Any]) -> dict[str, Any] | None:
    """SELECT value FROM dam_meta WHERE key='index_authority'.

    None = klucza nie ma / blad odczytu (siec, brak tabeli, zly JSON) - wolno to
    pomylic tylko w jedna strone: z "wszystko dozwolone", nigdy z "nikt nie moze"."""
    try:
        pg = pg_connect()
    except Exception:  # noqa: BLE001
        return None
    try:
        cur = pg.cursor()
        cur.execute("SELECT value FROM dam_meta WHERE key = %s", (MODE_KEY,))
        row = cur.fetchone()
    except Exception:  # noqa: BLE001
        return None
    finally:
        try:
            pg.close()
        except Exception:  # noqa: BLE001
            pass
    if not row:
        return {}
    raw = row.get("value") if hasattr(row, "get") else row[0]
    if not raw:
        return {}
    try:
        data = json.loads(raw) if isinstance(raw, (str, bytes)) else raw
    except (TypeError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def may_publish(pg_connect: Callable[[], Any] | None = None, *, force: bool = False) -> bool | None:
    """True/False = decyzja kto smie publikowac/kasowac wspolny indeks.
    None = klucza nie ma w bazie albo odczyt sie nie udal -> wolajacy ma
    zachowac sie jak dzis (przed tym modulem). Cache 60 s - nie pytamy bazy
    na kazdy plik/cykl; nigdy nie blokuje watku HTTP (timeout po stronie
    pg_connect/psycopg2, tak jak reszta modulu index_snapshots)."""
    now = time.monotonic()
    with _LOCK:
        if not force and (now - float(_CACHE.get("at") or 0.0)) < _CACHE_TTL_S:
            return _CACHE.get("value")
    connect = pg_connect or _default_pg_connect
    data = _read_raw(connect)
    with _LOCK:
        if data is None:
            _CACHE.update(at=now, value=None, raw={}, error="read_failed")
            return None
        machines = data.get("machines") if isinstance(data.get("machines"), list) else None
        if not machines:
            # klucz brakuje albo jest pusty/bez listy = jak brak klucza (bezpieczny domyslny)
            _CACHE.update(at=now, value=None, raw=data, error="")
            return None
        allowed = current_machine() in {str(m).strip() for m in machines if str(m).strip()}
        _CACHE.update(at=now, value=allowed, raw=data, error="")
        return allowed


def status(pg_connect: Callable[[], Any] | None = None, *, root_path: str = "") -> dict[str, Any]:
    """Dla panelu/administratora: ta maszyna, lista uprawnionych, wynik, wiek
    odczytu, typ dysku ROOT (informacyjnie). Most (local_bridge.py) wola to bez
    argumentow poza opcjonalnym root_path - domyslnie laczy sie przez pg_db."""
    allowed = may_publish(pg_connect)
    with _LOCK:
        raw = dict(_CACHE.get("raw") or {})
        error = _CACHE.get("error") or ""
        at = _CACHE.get("at") or 0.0
    machines = raw.get("machines") if isinstance(raw.get("machines"), list) else []
    return {
        "ok": True,
        "machine": current_machine(),
        "may_publish": allowed,
        "authority_configured": bool(machines),
        "machines": [str(m) for m in machines],
        "checked_age_s": round(time.monotonic() - at, 1) if at else None,
        "updated_at": raw.get("updated_at") or "",
        "updated_by": raw.get("updated_by") or "",
        "read_error": error,
        "root_drive_type": _drive_type_label(root_path) if root_path else "",
        "warning": (
            "" if machines else
            "Klucz index_authority nie ustawiony w bazie - kazdy komputer z ROOT "
            "moze dzis publikowac/kasowac (zachowanie sprzed tej zmiany)."
        ),
    }


if __name__ == "__main__":
    print(json.dumps(status(), ensure_ascii=False, indent=2))
