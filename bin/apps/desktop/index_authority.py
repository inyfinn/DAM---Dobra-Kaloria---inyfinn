# -*- coding: utf-8 -*-
"""Faza 3, decyzja kierownika 27.09.2026: kto smie zmieniac WSPOLNY katalog w bazie.

Wybor lokalnego ROOT (ktory dysk otwiera pliki na tym komputerze) NIE daje
prawa do zmiany wspolnego indeksu w PostgreSQL. Komputer, ktorego ROOT jest
opozniona kopia (np. Synology Drive w trakcie synchronizacji), nie moze:
  - publikowac migawek indeksu (file-index / branding-index / branding-search-index,
    patrz index_snapshots.publish_changed),
  - wysylac tombstonow, przywroceń (restore) ani ponownych utworzen na wierszu z
    tombstonem (recreate) - patrz asset_sync_runner._sync_cycle_restricted_ops.
    Wysyla TYLKO dodanie pliku, ktorego w bazie nie ma ("add"), i zmiane z mtime
    scisle nowszym na zywym wierszu ("change") - wszystko inne (tombstone,
    restore, recreate, sama zmiana opisu przy tym samym mtime) trafia na liste
    do potwierdzenia, tak jak dzisiejszy bezpiecznik 20%.

Regula "starszy mtime nigdy nie nadpisuje nowszego" (asset_sync.py, WHERE w SQL)
chroni baze przed cofnieciem przez wolniejsza kopie niezaleznie od tego modulu -
patrz tests/test_asset_sync.py::test_stale_x_older_mtime_does_not_revert_m_change
i ::test_stale_x_forced_push_of_older_version_refused_by_db (istniejace testy,
nie duplikujemy ich tutaj).

Klucz w PG: dam_meta['index_authority'] = JSON
    {"machines": ["INYFINN", "KRZYSZTOFWI", ...], "updated_at": "...", "updated_by": "..."}
Porownanie nazw maszyn jest bez wzgledu na wielkosc liter (casefold po obu stronach).

Zachowanie jest ADDYTYWNE: klucza nigdy nie bylo w bazie -> may_publish() zwraca
None, kazdy wolajacy (index_snapshots, asset_sync_runner) dziala DOKLADNIE tak
jak przed tym modulem. Blad odczytu (siec/baza padla) PO tym, jak klucz byl juz
raz poprawnie odczytany, NIE cofa sie do None - zostaje OSTATNIA ZNANA wartosc
(takze False), zapisana w pliku stanu (ten sam katalog co index-snapshots.json),
zeby przetrwala restart procesu. Inaczej krotka awaria sieci na komputerze BEZ
uprawnien wygladalaby jak "klucza nie ma" i chwilowo odblokowywalaby publikacje.
"""
from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

MODE_KEY = "index_authority"
_CACHE_TTL_S = 60.0
_LOCK = threading.Lock()
_CACHE: dict[str, Any] = {"at": 0.0, "value": None, "raw": {}, "error": ""}


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def current_machine() -> str:
    """Kanoniczna nazwa TEGO komputera - TA SAMA wartosc, co dam_assets.seen_by_machine
    i dam_index_snapshots.built_by. Jedna funkcja dla wszystkich trzech miejsc, ktore
    dawniej mialy wlasna kopie tej samej logiki (index_snapshots._machine() teraz
    deleguje tutaj; local_bridge._asset_sync_machine() - ready diff w raporcie
    workera A, worker A jest jedynym pisarzem local_bridge.py).

    COMPUTERNAME/HOSTNAME puste (rzadkie - kontener, niektóre VM) -> platform.node()."""
    name = (os.environ.get("COMPUTERNAME") or os.environ.get("HOSTNAME") or "").strip()
    if name:
        return name
    try:
        import platform

        return (platform.node() or "").strip()
    except Exception:  # noqa: BLE001
        return ""


def _casefold_set(names: Any) -> set[str]:
    if not isinstance(names, list):
        return set()
    return {str(m).strip().casefold() for m in names if str(m or "").strip()}


def _state_path() -> Path:
    import platform_compat  # noqa: PLC0415 - ten sam katalog co index-snapshots.json

    return platform_compat.user_state_dir() / "index-authority.json"


def _load_persisted() -> dict[str, Any]:
    try:
        raw = json.loads(_state_path().read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_persisted(value: bool, raw: dict[str, Any]) -> None:
    """Ostatnia ZNANA wartosc (i surowy JSON klucza) - przetrwac restart procesu.
    Zapisywana TYLKO po udanym odczycie, nigdy przy bledzie (inaczej blad zapisalby
    'None' na zawsze i skasowalby poprzednia znana wartosc)."""
    try:
        p = _state_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_name(p.name + f".{os.getpid()}.tmp")
        tmp.write_text(
            json.dumps({"value": value, "raw": raw, "saved_at": _utc()}, ensure_ascii=False),
            encoding="utf-8",
        )
        os.replace(tmp, p)
    except OSError:
        pass


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
            # Blad odczytu (siec/baza) - NIE "klucza nie ma". Jesli klucz byl juz
            # raz poprawnie odczytany (plik stanu istnieje), zostaje ta wartosc -
            # patrz naglowek modulu. Dopiero gdy NIGDY sie nie udalo -> None.
            persisted = _load_persisted()
            if "value" in persisted:
                last_value = persisted.get("value")
                _CACHE.update(at=now, value=last_value, raw=persisted.get("raw") or {},
                              error="read_failed_kept_last_known")
                return last_value
            _CACHE.update(at=now, value=None, raw={}, error="read_failed")
            return None
        machines = data.get("machines") if isinstance(data.get("machines"), list) else None
        if not machines:
            # klucz brakuje albo jest pusty/bez listy = jak brak klucza (bezpieczny domyslny)
            _CACHE.update(at=now, value=None, raw=data, error="")
            return None
        allowed = current_machine().casefold() in _casefold_set(machines)
        _CACHE.update(at=now, value=allowed, raw=data, error="")
        _save_persisted(allowed, data)
        return allowed


def _known_machines_and_last_publish(pg_connect: Callable[[], Any]) -> tuple[set[str], dict[str, str]]:
    """(nazwy maszyn znane bazie - casefold, {maszyna_casefold: najnowszy built_at ISO}),
    z dam_assets.updated_by i dam_index_snapshots.built_by. Blad/offline -> oba puste;
    status() wtedy po prostu NIE dodaje ostrzezen zaleznych od tych danych (nie ma jak
    ich sprawdzic), zamiast falszywie krzyczec "nieznany komputer" przy braku sieci."""
    try:
        pg = pg_connect()
    except Exception:  # noqa: BLE001
        return set(), {}
    known: set[str] = set()
    last_built: dict[str, str] = {}
    try:
        cur = pg.cursor()
        cur.execute(
            "SELECT DISTINCT updated_by FROM dam_assets WHERE updated_by IS NOT NULL AND updated_by <> ''"
        )
        for row in cur.fetchall():
            v = row.get("updated_by") if hasattr(row, "get") else row[0]
            if v:
                known.add(str(v).strip().casefold())
        cur.execute(
            "SELECT built_by, built_at FROM dam_index_snapshots WHERE built_by IS NOT NULL AND built_by <> ''"
        )
        for row in cur.fetchall():
            by = row.get("built_by") if hasattr(row, "get") else row[0]
            at_raw = row.get("built_at") if hasattr(row, "get") else row[1]
            if not by:
                continue
            key = str(by).strip().casefold()
            known.add(key)
            at_s = str(at_raw or "")
            if at_s and (key not in last_built or at_s > last_built[key]):
                last_built[key] = at_s
    except Exception:  # noqa: BLE001
        return known, last_built
    finally:
        try:
            pg.close()
        except Exception:  # noqa: BLE001
            pass
    return known, last_built


_STALE_PUBLISH_S = 24 * 3600.0


def status(pg_connect: Callable[[], Any] | None = None, *, root_path: str = "") -> dict[str, Any]:
    """Dla panelu/administratora: ta maszyna, lista uprawnionych, wynik, wiek
    odczytu, typ dysku ROOT (informacyjnie), ostrzezenia. Most (local_bridge.py)
    wola to bez argumentow poza opcjonalnym root_path - domyslnie laczy sie przez pg_db."""
    allowed = may_publish(pg_connect)
    with _LOCK:
        raw = dict(_CACHE.get("raw") or {})
        error = _CACHE.get("error") or ""
        at = _CACHE.get("at") or 0.0
    machines = raw.get("machines") if isinstance(raw.get("machines"), list) else []

    warnings: list[str] = []
    if not machines:
        warnings.append(
            "Klucz index_authority nie ustawiony w bazie - kazdy komputer z ROOT "
            "moze dzis publikowac/kasowac (zachowanie sprzed tej zmiany)."
        )
    else:
        connect = pg_connect or _default_pg_connect
        known, last_built = _known_machines_and_last_publish(connect)
        if known:  # zapytanie sie udalo - inaczej nie ma jak ocenic, wiec cisza
            newest: datetime | None = None
            for m in machines:
                key = str(m).strip().casefold()
                if key not in known:
                    warnings.append(
                        f"Nieznany komputer na liscie index_authority: {m!r} - nie widziany "
                        "w dam_assets.updated_by ani dam_index_snapshots.built_by."
                    )
                at_s = last_built.get(key)
                if at_s:
                    try:
                        dt = datetime.fromisoformat(at_s)
                    except ValueError:
                        continue
                    if newest is None or dt > newest:
                        newest = dt
            now_dt = datetime.now(timezone.utc)
            if newest is not None:
                age_s = (now_dt - newest).total_seconds()
                if age_s > _STALE_PUBLISH_S:
                    warnings.append(
                        f"Ostatnia publikacja migawki przez uprawniony komputer: {newest.isoformat()} "
                        f"- {age_s / 3600.0:.1f} h temu (ponad 24h)."
                    )
            else:
                warnings.append("Zaden uprawniony komputer nigdy nie opublikowal migawki indeksu.")

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
        "warning": warnings[0] if warnings else "",
        "warnings": warnings,
    }


if __name__ == "__main__":
    print(json.dumps(status(), ensure_ascii=False, indent=2))
