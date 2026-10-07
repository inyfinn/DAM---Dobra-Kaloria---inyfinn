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
import unicodedata
from pathlib import Path
from typing import Any, Callable

STATE_KEY_LAST_SCAN_TIME = "asset_sync_last_scan_time_ms"
STATE_KEY_CONFIRMED_DIRS = "asset_sync_confirmed_dirs"
STATE_KEY_BLOCKED = "asset_sync_blocked"
STATE_KEY_HOLDS = "asset_sync_holds"                 # etap 1a: wstrzymane foldery (panel w Ustawieniach)
STATE_KEY_FAILED_OPS = "asset_sync_failed_ops"       # etap 1a: operacje odrzucone jako zle dane + licznik
STATE_KEY_CATALOG_COUNT_AT = "asset_sync_catalog_count_at"
FAILED_OPS_KEEP = 200
CLOCK_SKEW_WARN_MS = 300000
MODE_KEY = "asset_index_mode"
MODE_ON = "rows"

MANIFEST_NAME = "branding-scan-dirs.json"
SCAN_NAME = "branding-index.scan.json"
FALLBACK_SCAN_NAME = "branding-index.json"
INDEX_NAME = "branding-index.json"
OVERRIDES_NAME = "branding-associations-overrides.json"

# Faza 3 (decyzja kierownika 27.09.2026): komputer bez uprawnien (index_authority.py)
# smie dodawac/aktualizowac materialy, ale nie kasowac ich we wspolnej bazie -
# wybor lokalnego ROOT sluzy tylko do otwierania plikow na tym komputerze.
NOT_AUTHORITY_BUCKET = "(wstrzymane: brak uprawnien do usuniec - not_authority)"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _norm_root(path: Any) -> str:
    """ROOT do porownan: NFC, ukosniki w przod, bez koncowego '/', bez wielkosci liter."""
    p = unicodedata.normalize("NFC", str(path or "")).replace("\\", "/").rstrip("/")
    return p.casefold()


def current_root_gen(root_path: str) -> str:
    """Kontrakt G: znacznik generacji ROOT dla obserwacji i manifestu.

    Numer generacji z dam_path_resolve.current_root_generation() (W3), jesli jest;
    bez niego sama znormalizowana sciezka ROOT. Oba skladniki w jednym napisie -
    zmiana ktoregokolwiek = obserwacje z innego ROOT."""
    gen: Any = None
    try:
        import dam_path_resolve  # noqa: PLC0415

        getter = getattr(dam_path_resolve, "current_root_generation", None)
        if callable(getter):
            gen = getter()
    except Exception:  # noqa: BLE001 - brak gettera / blad odczytu = porownanie samej sciezki
        gen = None
    return f"{'-' if gen is None else gen}|{_norm_root(root_path)}"


def _load_overrides(data_dir: Path) -> dict | None:
    raw = _read_json(data_dir / OVERRIDES_NAME) if (data_dir / OVERRIDES_NAME).is_file() else None
    return raw if isinstance(raw, dict) else None


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
    ten plik nie jest modyfikowany, tylko czytany.

    ADR-012 (28.09): reason="change" obejmuje w diff_scan_report takze ten sam
    mtime z innym rozmiarem/skrotem - bramka w bazie (sql/authority_gate.sql)
    przepuszcza od maszyny spoza listy tylko mtime SCISLE nowszy, wiec taka
    operacja tez jest wstrzymywana tutaj (inaczej baza pomijalaby ja w kazdym
    cyklu, a obserwacja bylaby zuzyta jak po udanym zapisie)."""
    reason = op.get("reason")
    if op.get("op") != "upsert" or reason not in ("add", "change"):
        return False
    if reason == "change" and "mtime_ms" in op and "base_mtime_ms" in op:
        try:
            return int(op.get("mtime_ms") or 0) > int(op.get("base_mtime_ms") or 0)
        except (TypeError, ValueError):
            return False
    return True


def _keep_prior_observations(nls: dict, ids, last_seen: Any) -> None:
    """Operacja wstrzymana / pominieta przez bramke nie "zuzywa" obserwacji: zostaje
    poprzednia (albo zadna), zeby po nadaniu uprawnien zostala wykryta ponownie."""
    import asset_sync  # noqa: PLC0415

    before = asset_sync.observations(last_seen) or {}
    for aid in ids:
        if aid in before:
            nls[aid] = dict(before[aid])
        else:
            nls.pop(aid, None)


def _refused_held_ids(result: dict) -> list[str]:
    """asset_id operacji spoza _is_allowed_without_authority, ktorych baza nie
    zastosowala (push_ops: applied False). Dotyczy tombstone, restore, recreate,
    meta i "change" bez nowszego mtime - to, co bramka ADR-012 pomija."""
    ops = ((result or {}).get("report") or {}).get("ops") or []
    results = ((result or {}).get("push") or {}).get("results") or []
    refused = {r.get("asset_id") for r in results if not r.get("applied")}
    if not refused:
        return []
    return [op.get("asset_id") for op in ops
            if op.get("asset_id") in refused and not _is_allowed_without_authority(op)]


def remote_max_rev(pg_connect: Callable[[], Any]) -> int | None:
    """ADR-012 pkt 4: tani odczyt max(rev) z dam_assets (indeks dam_assets_rev_idx).
    None = odczyt sie nie udal (siec, brak tabeli) - wolajacy czeka na zwykly cykl."""
    try:
        pg = pg_connect()
    except Exception:  # noqa: BLE001
        return None
    try:
        cur = pg.cursor()
        cur.execute("SELECT COALESCE(MAX(rev), 0) AS m FROM dam_assets")
        row = cur.fetchone()
        try:
            pg.rollback()
        except Exception:  # noqa: BLE001
            pass
        if row is None:
            return None
        return int(row["m"] if hasattr(row, "keys") else row[0])
    except Exception:  # noqa: BLE001
        return None
    finally:
        try:
            pg.close()
        except Exception:  # noqa: BLE001
            pass


class LightWatch:
    """ADR-012 pkt 4: kiedy uruchomic pelny cykl, gdy petla budzi sie co kilkadziesiat
    sekund. Pelny cykl: pierwszy raz, co `full_interval_s` (jak dotad) albo od razu,
    gdy tani odczyt (`probe`: max(rev) / generacje migawek) zwrocil inna wartosc niz
    ostatnio przetworzona. Blad odczytu (None) nie wyzwala cyklu - czeka na interwal."""

    def __init__(self, full_interval_s: float, probe: Callable[[], Any], *,
                 clock: Callable[[], float] = time.monotonic):
        self.full_interval_s = float(full_interval_s)
        self.probe = probe
        self.clock = clock
        self.last_full_at: float | None = None
        self.seen: Any = None
        self.reason = ""
        self._probed: Any = None

    def due(self) -> bool:
        try:
            value = self.probe()
        except Exception:  # noqa: BLE001
            value = None
        self._probed = value
        now = self.clock()
        if self.last_full_at is None:
            self.reason = "first"
        elif now - self.last_full_at >= self.full_interval_s:
            self.reason = "interval"
        elif value is not None and value != self.seen:
            self.reason = "remote_changed"
        else:
            self.reason = "probe_failed" if value is None else "unchanged"
            return False
        return True

    def done(self, seen: Any = None) -> None:
        """Po pelnym cyklu. `seen` = stan faktycznie przetworzony (np. max_rev lustra
        po cyklu); bez niego - wartosc odczytana PRZED cyklem (zmiana w trakcie cyklu
        zostanie wykryta przy nastepnym sprawdzeniu, nie zgubiona)."""
        self.last_full_at = self.clock()
        value = seen if seen is not None else self._probed
        if value is not None:
            self.seen = value


def _sync_cycle_restricted_ops(pg, local_rows: dict, *, scan: dict | None = None,
                                scanned_dirs=(), failed_dirs=(), confirmed_dirs=(),
                                last_seen=None, scan_time_ms: int = 0,
                                machine: str = "", now_ms: int | None = None,
                                root_gen: Any = None,
                                role: str = "copy", m_mode: str = "off", writer: str | None = None,
                                scan_db_ms: int | None = None,
                                pull_sql: str | None = None) -> dict[str, Any]:
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
    pull_kw = {"sql": pull_sql} if pull_sql else {}
    first = asset_sync.pull_since(pg, asset_sync.max_rev(rows), **pull_kw)
    rows = asset_sync.apply_remote(rows, first["rows"])
    out: dict[str, Any] = {"ok": first["ok"], "rows": rows, "report": None, "push": None,
                           "next_last_seen": asset_sync._copy_seen(last_seen)}  # noqa: SLF001
    if not first["ok"]:
        out["error"] = first.get("error", "")
        return out
    if scan is None:
        return out
    diff_kw = {"skip_future": True} if m_mode == "on" else {}   # etap 1a: baza (on) odrzuca daty z przyszlosci
    report = asset_sync.diff_scan_report(
        rows, scan, scanned_dirs, scan_time_ms, machine,
        last_seen=last_seen, failed_dirs=failed_dirs, confirmed_dirs=confirmed_dirs,
        root_gen=root_gen, **diff_kw,
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

    push_kw = {"writer": writer} if writer else {}
    pushed = asset_sync.push_ops(pg, kept_ops, now_ms=now_ms, **push_kw)
    out["push"] = pushed
    second = asset_sync.pull_since(pg, asset_sync.max_rev(rows), **pull_kw)
    out["rows"] = asset_sync.apply_remote(rows, second["rows"])
    out["ok"] = bool(pushed["ok"] and second["ok"])
    if out["ok"]:
        nls = report["next_last_seen"]
        held_ids = {op.get("asset_id") for op in held_back}
        if isinstance(nls, dict) and held_ids:
            # 28.09 (W2): wstrzymana operacja nie "zuzywa" obserwacji - zostaje
            # poprzednia, zeby po nadaniu uprawnien zmiana (np. samego opisu)
            # zostala wykryta ponownie, a nie uznana za juz wyslana.
            _keep_prior_observations(nls, held_ids, last_seen)
        out["next_last_seen"] = asset_sync.stamp_observed_rev(
            nls, out["rows"], [aid for aid in scan if aid not in held_ids])
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
        import data_mode  # noqa: PLC0415

        # Tryb LOKALNY: branding-index.json pisze skan ROOT, nie scalanie z bazy.
        if data_mode.is_local():
            return {"ok": True, "mode": "local"}
    except ImportError:
        pass
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
        import asset_sync_m  # noqa: PLC0415

        # Etap 1a: przelacznik dam_meta['m_rules'] (off | shadow | on). Brak wiersza / zly JSON = off.
        # Blad ODCZYTU to blad cyklu, nie "off". Bez kolumn etapu 1a w bazie klient dziala jak 2.6.0.
        try:
            rules = asset_sync_m.read_rules(pg)
        except asset_sync_m.RulesLookupFailed as exc:
            return {"ok": False, "error": f"m_rules: {exc}"[:300], "mode": "rows"}
        m_mode = rules["mode"]
        m_columns_missing = False
        if m_mode != "off" and not asset_sync_m.columns_ready(pg):
            m_mode, m_columns_missing = "off", True
        role = asset_sync.ROLE_COPY
        writer = None
        if m_mode != "off":
            if root_alive and root_path:
                role = asset_sync_m.resolve_role(pg_connect, root_path, machine)
            writer = asset_sync_m.writer_of(machine, role)

        try:
            conn = sqlite3.connect(str(db_path))
            asset_repo.ensure_local(conn)
            rows = asset_repo.load_rows(conn)
            seen_state = asset_repo.load_observations(conn)
        except Exception as exc:  # noqa: BLE001 - lokalny magazyn niedostepny/nie istnieje jeszcze
            return {"ok": False, "error": f"asset_repo: {exc}"[:300], "mode": "rows"}

        # Kontrakt O + G (28.09): obserwacje v2; z v1 (2.4.5) - wpisy bez wersji.
        # Obserwacje zapisane przy innym ROOT/generacji = jak po reset_scan_memory:
        # pierwszy skan na tym ROOT nic nie usuwa i nic nie przywraca.
        root_gen = current_root_gen(root_path)
        last_seen = seen_state.get("obs")
        root_gen_changed = (seen_state.get("source") == "v2" and last_seen is not None
                            and seen_state.get("root_gen") != root_gen)
        if root_gen_changed:
            last_seen = None

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
        dupes: list[tuple[str, str]] = []
        did_scan = False
        manifest = None
        manifest_root_mismatch = False
        if root_alive:
            manifest_path = data_dir / MANIFEST_NAME
            manifest = _read_json(manifest_path) if manifest_path.is_file() else None
        if isinstance(manifest, dict):
            # Kontrakt G: manifest zbudowany przy innym ROOT (np. skan sprzed
            # przelaczenia, dokonczony po nim) nie jest skanem biezacego ROOT.
            # Brak pola "root" (starszy build) - porownanie niemozliwe, jak dotad.
            m_root = manifest.get("root")
            manifest_root_mismatch = bool(m_root and root_path
                                          and _norm_root(m_root) != _norm_root(root_path))
        if root_alive and isinstance(manifest, dict) and not manifest_root_mismatch:
            manifest_scan_time = int(manifest.get("scan_time_ms") or 0)
            if manifest_scan_time > state_last_scan:
                index_assets = _load_scan_assets(data_dir, manifest)
                if index_assets is not None:
                    scan = asset_repo.scan_from_index(
                        index_assets, root_path, taken=asset_repo.taken_from_rows(rows), dupes=dupes)
                    scan_kwargs.update(
                        scan=scan,
                        scanned_dirs=manifest.get("scanned_dirs") or (),
                        failed_dirs=manifest.get("failed_dirs") or (),
                        last_seen=last_seen,
                        scan_time_ms=manifest_scan_time,
                        root_gen=root_gen,
                    )
                    did_scan = True

        # confirmed_dirs (foldery odblokowane przez admina, krok 6 planu) sa
        # przekazywane tylko przy skanie i tylko, gdy sync_cycle je naprawde
        # przyjmuje - sprawdzane przez introspekcje sygnatury, zeby ten most nie
        # rzucil TypeError, gdyby W2 kiedykolwiek usunal ten parametr.
        if did_scan and _accepts_confirmed_dirs(asset_sync.sync_cycle):
            scan_kwargs["confirmed_dirs"] = confirmed_dirs

        # Etap 1a: pola dodatkowe tylko, gdy tryb <> off (w "off" wywolania sa identyczne jak w 2.6.0).
        clock_skew_ms = None
        if m_mode != "off":
            scan_kwargs["pull_sql"] = asset_sync._SQL_PULL_M  # noqa: SLF001
            if did_scan:
                scan_db_ms = scan_kwargs["scan_time_ms"]
                if role == asset_sync.ROLE_M:
                    try:
                        clock_skew_ms, _rtt = asset_sync_m.db_clock_offset(pg)
                    except Exception as exc:  # noqa: BLE001
                        return {"ok": False, "error": f"clock: {exc}"[:300], "mode": "rows"}
                    scan_db_ms = int(scan_db_ms) + int(clock_skew_ms)
                scan_kwargs.update(role=role, m_mode=m_mode, writer=writer, scan_db_ms=scan_db_ms)

        # Faza 3 (decyzja kierownika 27.09.2026): ROOT lokalny nie daje prawa do
        # kasowania we wspolnej bazie - patrz index_authority.py. None (brak
        # klucza / blad odczytu) = jak dzis (dozwolone, bez zmiany zachowania).
        try:
            import index_authority

            authority = index_authority.may_publish(pg_connect)
        except Exception:  # noqa: BLE001
            authority = None

        m_on_m = role == asset_sync.ROLE_M and m_mode == "on"
        try:
            # Etap 1a: kopia w trybie "on" ZAWSZE idzie sciezka ograniczona, takze gdy komputer jest na liscie
            # index_authority (np. wlasciciel przelaczyl ROOT na D:) - baza odrzucilaby jego usuniecia.
            if did_scan and not m_on_m and (authority is False or (role == asset_sync.ROLE_COPY and m_mode == "on")):
                result = _sync_cycle_restricted_ops(pg, rows, **scan_kwargs)
            else:
                result = asset_sync.sync_cycle(pg, rows, **scan_kwargs)
        except Exception as exc:  # noqa: BLE001 - siec/baza - bez zmian lokalnych
            return {"ok": False, "error": f"sync_cycle: {exc}"[:300], "mode": "rows"}

        # ADR-012 (runda 2): bramka w bazie POMIJA operacje spoza uprawnien bez bledu
        # (wyzwalacz RETURN NULL -> push_ops liczy je jako "refused", jak odmowy WHERE).
        # Gdy ten komputer nie jest wlascicielem, a lokalna decyzja may_publish byla
        # nieaktualna (cache 60 s) albo klucza jeszcze nie znal, sync_cycle "zuzylby"
        # obserwacje pominietych operacji (tombstone: znika wpis zniknietego pliku,
        # restore/meta: nowa obserwacja). Odswiez decyzje i - jesli False - przywroc
        # poprzednie obserwacje tych plikow, jak robi _sync_cycle_restricted_ops.
        # Nastepny cykl idzie juz sciezka z filtrem (nic nie wysyla, bez petli).
        refused_held = (_refused_held_ids(result)
                        if did_scan and authority is not False and not m_on_m else [])
        if refused_held and result.get("ok"):
            try:
                import index_authority

                authority = index_authority.may_publish(pg_connect, force=True)
            except Exception:  # noqa: BLE001
                pass
            if authority is False:
                nls = result.get("next_last_seen")
                if isinstance(nls, dict):
                    _keep_prior_observations(nls, refused_held, scan_kwargs.get("last_seen"))
                rep = result.get("report")
                if isinstance(rep, dict):
                    blocked = dict(rep.get("blocked") or {})
                    blocked[NOT_AUTHORITY_BUCKET] = blocked.get(NOT_AUTHORITY_BUCKET, 0) + len(refused_held)
                    rep["blocked"] = blocked
                    rep["not_authority_held"] = len(refused_held)
                print(f"asset_sync_runner: {len(refused_held)} operacji pominietych przez baze "
                      "(not_authority) - obserwacje zachowane", flush=True)

        report: dict[str, Any] = {"ok": bool(result.get("ok")), "mode": "rows",
                                   "pulled": result.get("pulled"), "push": result.get("push"),
                                   "did_scan": did_scan, "authority": authority,
                                   "observations": seen_state.get("source"),
                                   "root_gen_changed": root_gen_changed,
                                   "manifest_root_mismatch": manifest_root_mismatch}
        if refused_held and authority is False:
            report["not_authority_refused"] = len(refused_held)
        diff_report = result.get("report") or {}
        # Etap 1a: pola raportu cyklu (spec 4.3)
        push_res = result.get("push") or {}
        m_res = result.get("m") or {}
        report.update({
            "role": role, "m_mode": m_mode, "m_columns_missing": m_columns_missing,
            "stamped": int(m_res.get("stamped") or 0),
            "missing_marked_new": int(m_res.get("marked") or 0),   # oznaczone w TYM cyklu; lacznie: confirm_tick
            "failed_ops": int(push_res.get("failed") or 0),
            "key_collisions": len(dupes), "clock_skew_ms": clock_skew_ms,
            "future_skipped": int(diff_report.get("future_skipped") or 0),
            "future_clipped": int(diff_report.get("future_clipped") or 0),
        })
        if push_res.get("errors"):
            report["failed_samples"] = [{k: e.get(k) for k in ("asset_id", "error", "detail")}
                                        for e in push_res["errors"][:5]]
        if m_res.get("errors"):
            report.setdefault("warnings", []).extend(
                f"{e.get('step')}: {e.get('error')}"[:200] for e in m_res["errors"][:5])
        if clock_skew_ms is not None and abs(clock_skew_ms) > CLOCK_SKEW_WARN_MS:
            report.setdefault("warnings", []).append(f"clock_skew_ms: {clock_skew_ms}")
        if dupes:
            report["key_collision_sample"] = [list(d) for d in dupes[:5]]
        if "conflicts" in diff_report:
            report["conflicts"] = diff_report.get("conflicts")
            report["conflict_sample"] = diff_report.get("conflict_sample") or []
        new_rows = result.get("rows")
        if new_rows is None:
            new_rows = rows
        changed_ids = [aid for aid, row in new_rows.items() if rows.get(aid) != row]
        changed = bool(changed_ids)
        report["max_rev"] = asset_sync.max_rev(new_rows)  # dla LightWatch.done()
        report["assets_max_rev"] = report["max_rev"]       # tetno floty (etap 0): kolumna assets_rev

        if result.get("ok"):
            if did_scan and result.get("next_last_seen") is not None:
                try:
                    nls = result["next_last_seen"]
                    if isinstance(nls, dict):
                        # v2 + stary klucz last_seen (powrot do 2.4.5) jedna transakcja
                        asset_repo.save_observations(conn, nls, root_gen)
                    else:
                        asset_repo.save_last_seen(conn, nls)
                    asset_repo.set_state(conn, STATE_KEY_LAST_SCAN_TIME,
                                          str(scan_kwargs["scan_time_ms"]))
                    asset_repo.set_state(conn, STATE_KEY_CONFIRMED_DIRS, json.dumps([]))
                    blocked = (result.get("report") or {}).get("blocked") or {}
                    asset_repo.set_state(conn, STATE_KEY_BLOCKED,
                                          json.dumps(blocked, ensure_ascii=False))
                    report["blocked"] = blocked
                    if m_on_m:   # wstrzymanie folderow zastepuje bezpiecznik 20 %: bez zgody admina
                        asset_repo.set_state(conn, STATE_KEY_CONFIRMED_DIRS, json.dumps([]))
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

        if m_mode != "off":
            _record_failed_ops(asset_repo, conn, push_res, report)
            if role == asset_sync.ROLE_M and result.get("ok"):
                _maybe_refresh_catalog_count(asset_repo, asset_sync_m, conn, pg, machine, writer)

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
                # W8: bez ROOT None (sciezka wzgledna), nie "" ("/- POLSKA/..." = sciezka wzgledem biezacego dysku)
                assets = asset_repo.live_index(new_rows, root_path or None)
                # Kontrakt R: relacje folderu z katalogu (ta sama rewizja = ten sam
                # wynik na kazdym komputerze), nie z meta ostatniego skanu.
                try:
                    import folder_relations  # noqa: PLC0415

                    report["relations_computed"] = folder_relations.apply_to_entries(
                        assets, new_rows, root_path or None, _load_overrides(data_dir))
                except Exception as exc:  # noqa: BLE001 - zostaja wartosci z bazy
                    report.setdefault("warnings", []).append(f"folder_relations: {exc}"[:300])
                payload = {
                    "version": 1,
                    "generated_at": _now_ms(),
                    "source": "rows",
                    "assets": assets,
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


# --------------------------------------------------------------------------
# Etap 1a: stan pomocniczy, drugie sprawdzenie, partie
# --------------------------------------------------------------------------

def _record_failed_ops(asset_repo, conn, push_res: dict, report: dict) -> None:
    """Operacja odrzucona jako zle dane (znak zerowy, kolizja klucza) jest ponawiana w kolejnych cyklach, ale
    zostawia slad: asset_id -> {count, error, last_ms}. Zdrowe id znikaja ze stanu."""
    try:
        raw = asset_repo.get_state(conn, STATE_KEY_FAILED_OPS)
        prev = json.loads(raw) if raw else {}
        prev = prev if isinstance(prev, dict) else {}
        now = _now_ms()
        cur: dict[str, Any] = {}
        for e in (push_res.get("errors") or []):
            aid = str(e.get("asset_id") or "")
            if not aid:
                continue
            n = int((prev.get(aid) or {}).get("count") or 0) + 1
            cur[aid] = {"count": n, "error": e.get("error"), "last_ms": now}
        if cur or prev:
            asset_repo.set_state(conn, STATE_KEY_FAILED_OPS,
                                  json.dumps(dict(list(cur.items())[:FAILED_OPS_KEEP]), ensure_ascii=False))
        if cur:
            report["failed_ops_repeating"] = sum(1 for v in cur.values() if v["count"] > 1)
    except Exception as exc:  # noqa: BLE001 - stan pomocniczy nie psuje cyklu
        report.setdefault("warnings", []).append(f"failed_ops_state: {exc}"[:200])


def _maybe_refresh_catalog_count(asset_repo, asset_sync_m, conn, pg, machine: str, writer: str | None) -> None:
    """M17 raz na dobe (zegar lokalny tylko do odstepu miedzy wywolaniami; wiek wpisu sprawdza baza)."""
    try:
        last = int(asset_repo.get_state(conn, STATE_KEY_CATALOG_COUNT_AT) or 0)
        if _now_ms() - last < 86400000:
            return
        asset_sync_m.refresh_catalog_count(pg, machine, writer)
        asset_repo.set_state(conn, STATE_KEY_CATALOG_COUNT_AT, str(_now_ms()))
    except Exception:  # noqa: BLE001
        pass


def confirm_tick(db_path: str | Path, data_dir: str | Path, *, root_alive: bool, root_path: str, machine: str,
                 pg_connect: Callable[[], Any], probe: Callable[..., dict] | None = None) -> dict[str, Any]:
    """Drugie sprawdzenie "brakuje od" (wolane przez most przy kazdym przebudzeniu petli, co 30 s, gdy nie idzie
    pelny cykl). W trybie off, na kopii i bez ROOT konczy sie jednym tanim odczytem i zwraca {"ok": True,
    "skipped": "<powod>"}. Nie rzuca wyjatkow: blad bazy / dysku to {"ok": False, "error": ...}.
    Wynik bez "skipped": raport confirm_pass (pola: missing_marked, holds, witness, witness_tripped,
    last_batch, deleted, would_delete, errors ...)."""
    if not root_alive or not root_path:
        return {"ok": True, "skipped": "no_root"}
    try:
        import data_mode  # noqa: PLC0415

        if data_mode.is_local():
            return {"ok": True, "skipped": "local_mode"}
    except ImportError:
        pass
    try:
        pg = pg_connect()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300]}
    conn: sqlite3.Connection | None = None
    try:
        import asset_repo  # noqa: PLC0415
        import asset_sync_m  # noqa: PLC0415

        try:
            if _get_mode(pg) != MODE_ON:
                return {"ok": True, "skipped": "index_mode_off"}
            rules = asset_sync_m.read_rules(pg)
        except (_ModeLookupFailed, asset_sync_m.RulesLookupFailed) as exc:
            return {"ok": False, "error": str(exc)[:300]}
        if rules["mode"] == "off":
            return {"ok": True, "skipped": "mode_off"}
        if not asset_sync_m.columns_ready(pg):
            return {"ok": True, "skipped": "columns_missing"}
        if asset_sync_m.resolve_role(pg_connect, root_path, machine) != "m":
            return {"ok": True, "skipped": "copy"}
        cur = pg.cursor()
        cur.execute(asset_sync_m.M["M10"])
        row = cur.fetchone()
        marked = int(row["marked"] if hasattr(row, "keys") else row[0])
        if marked == 0:
            cur.execute(asset_sync_m.M["M13"])
            has_witness = cur.fetchone() is not None
            pg.rollback()
            if not has_witness:
                return {"ok": True, "skipped": "nothing_marked", "missing_marked": 0, "holds": 0,
                        "holds_list": [], "witness": None, "witness_tripped": False,
                        "would_delete": 0}
        else:
            pg.rollback()
        conn = sqlite3.connect(str(db_path))
        asset_repo.ensure_local(conn)
        rows = asset_repo.load_rows(conn)
        apply = rules["mode"] == "on"
        if apply:   # do etapu 4 usuwa tylko komputer z listy index_authority; reszta tylko raportuje
            try:
                import index_authority  # noqa: PLC0415

                apply = index_authority.may_publish(pg_connect) is not False
            except Exception:  # noqa: BLE001
                pass
        rep = asset_sync_m.confirm_pass(pg, rows, root=root_path, machine=machine, cfg=rules, apply=apply,
                                        probe=probe)
        rep["role"], rep["m_mode"] = "m", rules["mode"]
        # kontrakt ze stanem mostu / tetnem (etap 0): "holds" = LICZBA wstrzymanych folderow, lista w "holds_list"
        rep["holds_list"] = rep.get("holds") or []
        rep["holds"] = len(rep["holds_list"])
        try:
            asset_repo.set_state(conn, STATE_KEY_HOLDS, json.dumps(rep["holds_list"], ensure_ascii=False))
        except Exception:  # noqa: BLE001
            pass
        return rep
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"confirm_tick: {exc}"[:300]}
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


def list_batches(pg_connect: Callable[[], Any]) -> dict[str, Any]:
    """Lista partii usuniec (panel w Ustawieniach, trasa GET /asset-sync/batches). W trybie off: pusta."""
    try:
        pg = pg_connect()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300]}
    try:
        import asset_sync_m  # noqa: PLC0415

        if asset_sync_m.read_rules(pg)["mode"] == "off" or not asset_sync_m.columns_ready(pg):
            return {"ok": True, "items": []}
        return {"ok": True, "items": asset_sync_m.list_batches(pg)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300]}
    finally:
        try:
            pg.close()
        except Exception:  # noqa: BLE001
            pass


def undo_batch(pg_connect: Callable[[], Any], *, machine: str, root_path: str, batch: str) -> dict[str, Any]:
    """Cofniecie partii usuniec (M8). Tylko z komputera z M:, ktory jest na liscie index_authority, i tylko
    w trybie on. Bledy: bad_batch, rules_off, not_m_computer, not_authority, unknown_batch, albo tekst bledu bazy."""
    import asset_sync_m  # noqa: PLC0415

    if not asset_sync_m.BATCH_RE.match(str(batch or "")):
        return {"ok": False, "error": "bad_batch"}
    try:
        pg = pg_connect()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300]}
    try:
        rules = asset_sync_m.read_rules(pg)
        if rules["mode"] != "on" or not asset_sync_m.columns_ready(pg):
            return {"ok": False, "error": "rules_off"}
        if asset_sync_m.resolve_role(pg_connect, root_path, machine) != "m":
            return {"ok": False, "error": "not_m_computer"}
        try:
            import index_authority  # noqa: PLC0415

            if index_authority.may_publish(pg_connect, force=True) is False:
                return {"ok": False, "error": "not_authority"}
        except Exception:  # noqa: BLE001
            pass
        ids = asset_sync_m.undo_batch(pg, asset_sync_m.writer_of(machine, "m"), batch)
        if not ids:
            return {"ok": False, "error": "unknown_batch", "batch": batch, "restored": 0}
        return {"ok": True, "batch": batch, "restored": len(ids)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300]}
    finally:
        try:
            pg.close()
        except Exception:  # noqa: BLE001
            pass
