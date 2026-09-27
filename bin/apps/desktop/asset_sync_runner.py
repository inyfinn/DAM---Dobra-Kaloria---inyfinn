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

# Faza 3 (decyzja kierownika 27.09.2026): komputer bez uprawnien (index_authority.py)
# smie dodawac/aktualizowac materialy, ale nie kasowac ich we wspolnej bazie -
# wybor lokalnego ROOT sluzy tylko do otwierania plikow na tym komputerze.
NOT_AUTHORITY_BUCKET = "(wstrzymane: brak uprawnien do usuniec - not_authority)"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _index_looks_like_rows(index_path: Path) -> bool:
    """Tania proba (pierwsze 300 bajtow, bez pelnego json.loads - plik bywa
    >300 MB) - czy branding-index.json wyglada na wynik scalania z wierszy
    (payload zapisywany nizej: {"version": 1, ..., "source": "rows", ...}), a
    nie na cos innego (np. legacy skan v2 z build-branding-index.py, nadpisany
    z zewnatrz miedzy cyklami runnera - patrz incydent 27.09.2026 w run_once)."""
    try:
        with index_path.open("rb") as fh:
            head = fh.read(300)
    except OSError:
        return False
    return b'"version": 1' in head and b'"source": "rows"' in head


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


def _is_allowed_without_authority(op: dict[str, Any]) -> bool:
    """Faza 3, zadanie 3.3 (utwardzenie 27.09.2026): komputer BEZ uprawnien
    (index_authority.may_publish() == False) smie wyslac TYLKO:
      - dodanie pliku, ktorego w bazie nie ma (op=upsert, reason="add"),
      - zmiane z mtime SCISLE nowszym na zywym wierszu (op=upsert, reason="change").
    Wszystko inne trafia do potwierdzenia jak tombstone:
      - tombstone (usuniecie),
      - restore (op=restore, reason="reappeared" - ten sam plik "wraca" na
        komputerze, ktory go wczesniej nie widzial),
      - recreate (op=upsert, reason="recreate" - ponowne utworzenie NA WIERSZU
        Z TOMBSTONEM; nawet z genialnie nowszym mtime - to wskrzeszenie czegos,
        co inny komputer uznal za usuniete, decyzja kierownika 27.09 traktuje to
        jak usuniecie, nie jak zwykla zmiane),
      - meta (op=upsert, reason="meta" - ten sam mtime, sama zmiana opisu -
        to NIE jest "zmiana z mtime nowszym", wiec tez jest wstrzymywana).
    Reason-y sa zdefiniowane w asset_sync.py::diff_scan_report (_op wywolania) -
    ten plik nie jest modyfikowany, tylko czytany."""
    reason = op.get("reason")
    return op.get("op") == "upsert" and reason in ("add", "change")


def _sync_cycle_restricted_ops(pg, local_rows: dict, *, scan: dict | None = None,
                                scanned_dirs=(), failed_dirs=(), confirmed_dirs=(),
                                last_seen=None, scan_time_ms: int = 0,
                                machine: str = "", now_ms: int | None = None) -> dict[str, Any]:
    """Ta sama orkiestracja co asset_sync.sync_cycle (pull -> diff -> push -> pull),
    ZLOZONA tu z publicznych funkcji asset_sync.py bez zmiany tego pliku (zakaz
    kierownika) - jedyna roznica: operacje spoza _is_allowed_without_authority sa
    odfiltrowane PRZED push_ops, bo ten komputer nie ma dzis uprawnien do zmiany
    wspolnej bazy (index_authority.may_publish() == False).

    Odfiltrowane operacje trafiaja do report["blocked"][NOT_AUTHORITY_BUCKET]
    (istniejacy mechanizm /asset-sync/blocked, ta sama struktura {folder: count}
    co bezpiecznik 20% w diff_scan_report) - to TYLKO raport dla admina, bucket
    nie odblokuje sie przez confirmed_dirs (to nie jest podejrzany odczyt dysku,
    tylko brak uprawnien - odblokuje go wylacznie zmiana listy w index_authority).

    ponytail: bucket jest jeden, nie per-folder jak bezpiecznik 20% - upraszcza
    kod, kosztem mniej czytelnego raportu przy wielu roznych folderach naraz;
    podzial per-folder do dodania, jesli admin tego zazada."""
    import asset_sync  # noqa: PLC0415 - ten sam lazy import co run_once

    rows = dict(local_rows)
    first = asset_sync.pull_since(pg, asset_sync.max_rev(rows))
    rows = asset_sync.apply_remote(rows, first["rows"])
    out: dict[str, Any] = {"ok": first["ok"], "rows": rows, "report": None, "push": None,
                           "next_last_seen": None if last_seen is None else set(last_seen)}
    if not first["ok"]:
        out["error"] = first.get("error", "")
        return out
    if scan is None:
        return out
    report = asset_sync.diff_scan_report(
        rows, scan, scanned_dirs, scan_time_ms, machine,
        last_seen=last_seen, failed_dirs=failed_dirs, confirmed_dirs=confirmed_dirs,
    )
    ops = report["ops"]
    kept_ops = [op for op in ops if _is_allowed_without_authority(op)]
    held_back = [op for op in ops if not _is_allowed_without_authority(op)]

    blocked = dict(report.get("blocked") or {})
    if held_back:
        blocked[NOT_AUTHORITY_BUCKET] = blocked.get(NOT_AUTHORITY_BUCKET, 0) + len(held_back)

    out["report"] = {k: v for k, v in report.items() if k != "next_last_seen"}
    out["report"]["blocked"] = blocked
    out["report"]["not_authority_held"] = len(held_back)

    pushed = asset_sync.push_ops(pg, kept_ops, now_ms=now_ms)
    out["push"] = pushed
    second = asset_sync.pull_since(pg, asset_sync.max_rev(rows))
    out["rows"] = asset_sync.apply_remote(rows, second["rows"])
    out["ok"] = bool(pushed["ok"] and second["ok"])
    if out["ok"]:
        out["next_last_seen"] = report["next_last_seen"]
    else:
        out["error"] = pushed.get("error") or second.get("error", "")
    return out


def reset_scan_memory(db_path: str | Path, reason: str) -> dict[str, Any]:
    """Faza 3, zadanie 3.4 (27.09.2026): wolane po zmianie ROOT (most,
    switch_root, gdy changed == True - patrz ready diff w raporcie). Czysci
    last_seen i czas ostatniego skanu (asset_repo.clear_last_seen +
    STATE_KEY_LAST_SCAN_TIME=0) - lustro wierszy (asset_rows) i rev ZOSTAJA
    nietkniete. Po resecie pierwszy skan na nowym ROOT zachowuje sie jak
    pierwszy skan swiezego komputera: nic nie usuwa (last_seen=None wylacza
    tombstony w diff_scan_report), nic nie przywraca (last_seen=None wylacza
    tez "reappeared"/restore - patrz asset_sync.py, warunek `seen_before is not
    None and aid not in seen_before`). Bez tego kazdy plik obecny w nowym ROOT,
    a nieobecny w last_seen starego ROOT, wygladalby jak "pojawil sie" i mogl
    przywrocic material, ktory inny komputer uznal za usuniety."""
    try:
        import asset_repo  # noqa: PLC0415 - ten sam lazy import co run_once
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"asset_repo: {exc}"[:300]}
    try:
        conn = sqlite3.connect(str(db_path))
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300]}
    try:
        asset_repo.ensure_local(conn)
        asset_repo.clear_last_seen(conn)
        asset_repo.set_state(conn, STATE_KEY_LAST_SCAN_TIME, "0")
        conn.commit()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300]}
    finally:
        conn.close()
    return {"ok": True, "reason": str(reason)[:200]}


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
                    scan = asset_repo.scan_from_index(
                        index_assets, root_path, taken=asset_repo.taken_from_rows(rows))
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

        # Faza 3 (decyzja kierownika 27.09.2026): ROOT lokalny nie daje prawa do
        # kasowania we wspolnej bazie - patrz index_authority.py. None (brak
        # klucza / blad odczytu) = jak dzis (dozwolone, bez zmiany zachowania).
        try:
            import index_authority

            authority = index_authority.may_publish(pg_connect)
        except Exception:  # noqa: BLE001
            authority = None

        try:
            if did_scan and authority is False:
                result = _sync_cycle_restricted_ops(pg, rows, **scan_kwargs)
            else:
                result = asset_sync.sync_cycle(pg, rows, **scan_kwargs)
        except Exception as exc:  # noqa: BLE001 - siec/baza - bez zmian lokalnych
            return {"ok": False, "error": f"sync_cycle: {exc}"[:300], "mode": "rows"}

        report: dict[str, Any] = {"ok": bool(result.get("ok")), "mode": "rows",
                                   "pulled": result.get("pulled"), "push": result.get("push"),
                                   "did_scan": did_scan, "authority": authority}
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
        # 27.09.2026, incydent: karta produktu pokazywala 0 materialow. Miedzy
        # cyklami runnera cos (build-branding-index.py, race z watcherem) nadpisalo
        # branding-index.json legacy skanem (v2) - runner nie odbudowal go z
        # wierszy, bo `changed` bylo False (zaden NOWY wiersz w tym cyklu). Tania
        # proba (pierwsze 300 bajtow, bez pelnego json.loads - plik bywa >300 MB):
        # jesli plik nie wyglada na wynik scalania ("version":1,"source":"rows"),
        # odbuduj go z aktualnych wierszy NIEZALEZNIE od `changed`.
        needs_rebuild_wrong_version = index_path.is_file() and not _index_looks_like_rows(index_path)
        should_write_index = changed or not index_path.is_file() or needs_rebuild_wrong_version
        report["index_rebuilt_wrong_version"] = needs_rebuild_wrong_version
        if did_scan and not result.get("ok"):
            # 23.09: nieudany PUSH nadpisal wynik buildera wierszami - skan z dysku
            # przepadl i nastepny cykl nie mial czego ponowic. Skan zostaje do ponowienia.
            should_write_index = False
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
