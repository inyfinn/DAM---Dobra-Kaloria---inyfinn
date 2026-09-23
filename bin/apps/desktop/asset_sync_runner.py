# -*- coding: utf-8 -*-
"""Wpiecie scalania indeksu materialow (Faza 2, asset_sync.sync_cycle) w most.

Za znacznikiem w bazie (dam_meta.asset_index_mode = "rows") - dopoki znacznika
nie ma albo ma inna wartosc, run_once() nie rusza lokalnego stanu ani bazy
(tryb "off": snapshoty branding-index.json dzialaja jak dzisiaj, patrz
index_snapshots.py). Wlaczenie to jedna decyzja kierownika (UPDATE dam_meta),
nie wydanie kodu.

Logika scalania (asset_sync.py) i lokalny magazyn wierszy (asset_repo.py, W2)
sa importowane leniwie - ten modul dziala (w trybie "off" i w testach z
atrapami) nawet zanim asset_repo.py istnieje w repo.

Kontrakt run_once (patrz bin/docs/PLAN-jedno-zrodlo-prawdy.md, Faza 2, oraz
przydzial workera):
    run_once(db_path, data_dir, *, root_alive, root_path, machine,
             pg_connect, on_index_written) -> dict raportu

Skan czytany jest z data_dir/branding-index.scan.json, jesli plik istnieje
(zeby nie mylic wejscia skanu z wynikiem scalania, ktory po wlaczeniu trybu
"rows" nadpisuje branding-index.json) - w przeciwnym razie z
data_dir/branding-index.json (dzisiejszy skan, przed przelaczeniem W1 na
zapis .scan.json obok). Patrz sekcja "Otwarte kwestie" w raporcie workera.
"""
from __future__ import annotations

import inspect
import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Callable

STATE_KEY_LAST_SCAN_TIME = "asset_sync_last_scan_time_ms"
STATE_KEY_CONFIRMED_DIRS = "asset_sync_confirmed_dirs"
STATE_KEY_BLOCKED = "asset_sync_blocked"
MODE_KEY = "asset_index_mode"
MODE_ON = "rows"

MANIFEST_NAME = "branding-scan-dirs.json"
SCAN_NAME = "branding-index.scan.json"
FALLBACK_SCAN_NAME = "branding-index.json"
INDEX_NAME = "branding-index.json"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _write_json_atomic(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


class _ModeLookupFailed(Exception):
    """Odczyt dam_meta.asset_index_mode sie nie udal (siec/baza) - to NIE jest 'off'."""


def _get_mode(pg) -> str:
    """SELECT value FROM dam_meta WHERE key='asset_index_mode'. Brak wiersza = off.

    Rzuca _ModeLookupFailed, gdy samo zapytanie sie nie wykonalo (siec, polaczenie
    zerwane w trakcie) - to inny przypadek niz "wiersza po prostu nie ma", i wolno
    go pomylic z "off" tylko w jedna strone: cichy `except` tutaj zamienilby
    prawdziwy blad sieci w falszywe 'ok: True, mode: off'."""
    try:
        cur = pg.cursor()
        cur.execute("SELECT value FROM dam_meta WHERE key = %s", (MODE_KEY,))
        row = cur.fetchone()
    except Exception as exc:  # noqa: BLE001 - zgloszone wyzej jako blad, nie "off"
        raise _ModeLookupFailed(str(exc)) from exc
    if not row:
        return ""
    if hasattr(row, "get"):
        return str(row.get("value") or "")
    try:
        return str(row["value"] or "")
    except (KeyError, IndexError, TypeError):
        return str(row[0] or "")


def _load_scan_assets(data_dir: Path, manifest: dict | None = None) -> list | None:
    """Skan czysty: branding-index.scan.json, jesli istnieje; inaczej branding-index.json,
    ALE tylko gdy to wciaz ten sam plik, ktory zapisal build (rozmiar i czas zapisu
    zgodne z odciskiem index_size / index_mtime_ns w manifescie).

    W trybie "rows" most nadpisuje branding-index.json wynikiem scalania - bez tej
    kontroli runner moglby wziac wlasny wynik scalania za nowy skan dysku. Brak
    zgodnosci = None: cykl tylko pobiera, skan poczeka na nastepna przebudowe.
    """
    scan_path = data_dir / SCAN_NAME
    raw = _read_json(scan_path) if scan_path.is_file() else None
    if raw is None:
        fb = data_dir / FALLBACK_SCAN_NAME
        want_size = int((manifest or {}).get("index_size") or 0)
        want_mtime = int((manifest or {}).get("index_mtime_ns") or 0)
        try:
            st = fb.stat()
        except OSError:
            return None
        if not want_size or st.st_size != want_size or st.st_mtime_ns != want_mtime:
            return None
        raw = _read_json(fb)
    if raw is None:
        return None
    if isinstance(raw, dict):
        assets = raw.get("assets")
        return assets if isinstance(assets, list) else None
    if isinstance(raw, list):
        return raw
    return None


def _accepts_confirmed_dirs(fn: Callable) -> bool:
    try:
        sig = inspect.signature(fn)
    except (TypeError, ValueError):
        return False
    params = sig.parameters
    return "confirmed_dirs" in params or any(
        p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()
    )


def run_once(
    db_path: str | Path,
    data_dir: str | Path,
    *,
    root_alive: bool,
    root_path: str,
    machine: str,
    pg_connect: Callable[[], Any],
    on_index_written: Callable[[str, Path], None] | None = None,
) -> dict[str, Any]:
    data_dir = Path(data_dir)
    try:
        pg = pg_connect()
    except Exception as exc:  # noqa: BLE001 - siec/baza niedostepna
        return {"ok": False, "error": str(exc)[:300]}

    conn: sqlite3.Connection | None = None
    try:
        try:
            mode = _get_mode(pg)
        except _ModeLookupFailed as exc:
            return {"ok": False, "error": f"asset_index_mode: {exc}"[:300]}
        if mode != MODE_ON:
            return {"ok": True, "mode": "off"}

        import asset_repo  # noqa: PLC0415 - lazy: modul dostarcza inny worker (W2)
        import asset_sync  # noqa: PLC0415

        try:
            conn = sqlite3.connect(str(db_path))
            asset_repo.ensure_local(conn)
            rows = asset_repo.load_rows(conn)
            last_seen = asset_repo.load_last_seen(conn)
        except Exception as exc:  # noqa: BLE001 - lokalny magazyn niedostepny/nie istnieje jeszcze
            return {"ok": False, "error": f"asset_repo: {exc}"[:300], "mode": "rows"}

        state_last_scan = _int_state(asset_repo, conn, STATE_KEY_LAST_SCAN_TIME, 0)
        confirmed_raw = asset_repo.get_state(conn, STATE_KEY_CONFIRMED_DIRS)
        confirmed_dirs: list[str] = []
        if confirmed_raw:
            try:
                parsed = json.loads(confirmed_raw)
                if isinstance(parsed, list):
                    confirmed_dirs = [str(x) for x in parsed]
            except ValueError:
                confirmed_dirs = []

        scan_kwargs: dict[str, Any] = {"machine": machine}
        did_scan = False
        manifest = None
        if root_alive:
            manifest_path = data_dir / MANIFEST_NAME
            manifest = _read_json(manifest_path) if manifest_path.is_file() else None
        if root_alive and isinstance(manifest, dict):
            manifest_scan_time = int(manifest.get("scan_time_ms") or 0)
            if manifest_scan_time > state_last_scan:
                index_assets = _load_scan_assets(data_dir, manifest)
                if index_assets is not None:
                    scan = asset_repo.scan_from_index(index_assets, root_path)
                    scan_kwargs.update(
                        scan=scan,
                        scanned_dirs=manifest.get("scanned_dirs") or (),
                        failed_dirs=manifest.get("failed_dirs") or (),
                        last_seen=last_seen,
                        scan_time_ms=manifest_scan_time,
                    )
                    did_scan = True

        # confirmed_dirs (foldery odblokowane przez admina, krok 6 planu) sa
        # przekazywane tylko przy skanie i tylko, gdy sync_cycle je naprawde
        # przyjmuje - sprawdzane przez introspekcje sygnatury, zeby ten most nie
        # rzucil TypeError, gdyby W2 kiedykolwiek usunal ten parametr.
        if did_scan and _accepts_confirmed_dirs(asset_sync.sync_cycle):
            scan_kwargs["confirmed_dirs"] = confirmed_dirs

        try:
            result = asset_sync.sync_cycle(pg, rows, **scan_kwargs)
        except Exception as exc:  # noqa: BLE001 - siec/baza - bez zmian lokalnych
            return {"ok": False, "error": f"sync_cycle: {exc}"[:300], "mode": "rows"}

        report: dict[str, Any] = {"ok": bool(result.get("ok")), "mode": "rows",
                                   "pulled": result.get("pulled"), "push": result.get("push"),
                                   "did_scan": did_scan}
        new_rows = result.get("rows")
        if new_rows is None:
            new_rows = rows
        changed_ids = [aid for aid, row in new_rows.items() if rows.get(aid) != row]
        changed = bool(changed_ids)

        if result.get("ok"):
            if did_scan and result.get("next_last_seen") is not None:
                try:
                    asset_repo.save_last_seen(conn, result["next_last_seen"])
                    asset_repo.set_state(conn, STATE_KEY_LAST_SCAN_TIME,
                                          str(scan_kwargs["scan_time_ms"]))
                    asset_repo.set_state(conn, STATE_KEY_CONFIRMED_DIRS, json.dumps([]))
                    blocked = (result.get("report") or {}).get("blocked") or {}
                    asset_repo.set_state(conn, STATE_KEY_BLOCKED,
                                          json.dumps(blocked, ensure_ascii=False))
                    report["blocked"] = blocked
                except Exception as exc:  # noqa: BLE001
                    report.setdefault("warnings", []).append(f"state_save: {exc}"[:300])
        else:
            report["error"] = result.get("error", "")

        try:
            if changed_ids:
                asset_repo.save_rows(conn, new_rows, only_ids=changed_ids)
            pg_rev_setter = getattr(asset_repo, "set_pg_rev", None)
            if callable(pg_rev_setter):
                pg_rev_setter(conn, asset_sync.max_rev(new_rows))
        except Exception as exc:  # noqa: BLE001
            report.setdefault("warnings", []).append(f"save_rows: {exc}"[:300])

        index_path = data_dir / INDEX_NAME
        should_write_index = changed or not index_path.is_file()
        if should_write_index:
            try:
                payload = {
                    "version": 1,
                    "generated_at": _now_ms(),
                    "source": "rows",
                    "assets": asset_repo.live_index(new_rows, root_path or ""),
                }
                _write_json_atomic(index_path, payload)
                report["index_written"] = True
                if on_index_written is not None:
                    try:
                        on_index_written(str(index_path))
                    except Exception as exc:  # noqa: BLE001 - callback nie ma psuc cyklu
                        report.setdefault("warnings", []).append(f"on_index_written: {exc}"[:300])
            except Exception as exc:  # noqa: BLE001
                report.setdefault("warnings", []).append(f"index_write: {exc}"[:300])
                report["index_written"] = False
        else:
            report["index_written"] = False

        return report
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass
        try:
            pg.close()
        except Exception:  # noqa: BLE001
            pass


def _int_state(asset_repo, conn, key: str, default: int) -> int:
    try:
        raw = asset_repo.get_state(conn, key)
        return int(raw) if raw else default
    except (TypeError, ValueError):
        return default
    except Exception:  # noqa: BLE001
        return default
