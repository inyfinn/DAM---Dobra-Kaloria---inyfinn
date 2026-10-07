# -*- coding: utf-8 -*-
"""ETAP 0 synchronizacji (07.10.2026): tetno komputerow - baza wie, kto jest podlaczony,
w jakiej wersji programu i katalogu oraz czy ma dysk wzorcowy M:.

Co 5 minut (DAM_HEARTBEAT_S) KAZDY nowy klient zapisuje JEDEN wiersz swojego komputera w
dam_client_heartbeat (ostatni stan, bez historii). Stare klienty (2.6.0 i starsze) nic nie wysylaja
i nic nie wiedza o tabeli - admin widzi je w "komputery bez tetna" (device_sessions).

Zasady:
  - Tabele tworzy WLASCICIEL plikiem sql/fleet.sql. Program NIE wysyla zadnego DDL (konto programu
    ma docelowo nie miec uprawnien DDL, plan baza-konto-ograniczone.md). Bez tabel tetno po cichu
    pomija zapis: jedna linia w logu przy zmianie stanu, zero wyjatkow co cykl, program dziala jak 2.6.0.
  - Czas z zegara BAZY (seen_at = now()). Zegar klienta idzie tylko do policzenia przesuniecia
    (clock_skew_s = klient - baza, w SQL), nigdy do kolejnosci zdarzen.
  - Wylacznik bez wydania: dam_meta['fleet_heartbeat'] = 'off' (sprawdzany przy kazdym tetnie).
    Wylacznik lokalny: DAM_HEARTBEAT_S=0.
  - Tetno nie blokuje startu mostu (watek daemon, pierwsze po FIRST_DELAY_S), nigdy nie rzuca,
    po bledzie bazy najwczesniej za MIN_RETRY_S, kick() (zmiana ROOT, nowy katalog) najwyzej co KICK_MIN_S.
  - Samozgloszenie: gdy klucz ROOT (root_share) nalezy do dam_meta['m_shares'], tetno wpisuje pare
    (komputer, dysk) do dam_m_computers jako 'pending'. Zatwierdza admin (m_decision / m_register).
    Wiersze source='admin' klient nigdy nie rusza. Reguly (rola m|copy) liczy m_computers.py.
To sa dane informacyjne: konto bazy jest wspolne (superuzytkownik), wiec CHECK-i i reguly sa zapora
przed pomylka kodu i stara wersja, nie przed zlosliwym klientem (spec etap-0.md, 2.7).
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Callable

import m_computers
from m_computers import root_info  # noqa: F401 - re-eksport: spec wola fleet_heartbeat.root_info

PROTO = 1
FIRST_DELAY_S = 20.0
DEFAULT_INTERVAL_S = 300.0
MIN_INTERVAL_S = 5.0
MIN_RETRY_S = 60.0
KICK_MIN_S = 20.0
ONLINE_S = 480.0  # "online" w widoku admina = 1,6 rytmu
META_SHARES = "m_shares"
META_SWITCH = "fleet_heartbeat"

_LOCK = threading.Lock()
_WAKE = threading.Event()
_STOP = threading.Event()
_THREAD: threading.Thread | None = None
_STATE: dict[str, Any] = {"status": "", "beats": 0, "last_beat_at": "", "last_ok_at": "", "last_error": "",
                          "started_at": None}

_ROW_COLS = ("machine_name", "windows_user", "dam_user", "app_version", "proto", "platform", "data_mode",
             "catalog_kind", "catalog_id", "catalog_gen", "catalog_built_at", "catalog_source",
             "catalog_pulled_at", "assets_rev", "missing_marked", "holds", "witness_tripped",
             "root_kind", "root_drive", "root_share", "root_state", "m_role", "m_state", "last_error")
_UPSERT_SQL = (
    "INSERT INTO dam_client_heartbeat AS h (machine, " + ", ".join(_ROW_COLS)
    + ", clock_skew_s, started_at, seen_at) VALUES (%(machine)s, "
    + ", ".join("%(" + c + ")s" for c in _ROW_COLS)
    + ", %(client_epoch)s - extract(epoch FROM now()), %(started_at)s, now()) "
    "ON CONFLICT (machine) DO UPDATE SET "
    + ", ".join(f"{c} = EXCLUDED.{c}" for c in _ROW_COLS)
    + ", clock_skew_s = EXCLUDED.clock_skew_s, started_at = EXCLUDED.started_at, seen_at = now()"
)
_SELF_REPORT_SQL = (
    "INSERT INTO dam_m_computers AS m (machine, drive, share, state, source) "
    "VALUES (%(machine)s, %(drive)s, %(share)s, 'pending', 'auto') "
    "ON CONFLICT (machine, drive) DO UPDATE SET "
    "share = EXCLUDED.share, state = 'pending', requested_at = now(), decided_at = NULL, decided_by = '' "
    "WHERE m.source = 'auto' AND m.share <> EXCLUDED.share"
)
_FLAGS_SQL = (
    "SELECT now() AS db_now, to_regclass('dam_client_heartbeat') IS NOT NULL AS hb, "
    "to_regclass('dam_m_computers') IS NOT NULL AS mc, to_regclass('dam_meta') IS NOT NULL AS meta, "
    "to_regclass('device_sessions') IS NOT NULL AS sessions, "
    "to_regclass('dam_index_snapshots') IS NOT NULL AS snaps"
)


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def interval_s() -> float:
    """DAM_HEARTBEAT_S: sekundy; 0 albo mniej = tetno wylaczone lokalnie; blad = domyslne 300."""
    try:
        raw = float(os.environ.get("DAM_HEARTBEAT_S", DEFAULT_INTERVAL_S))
    except ValueError:
        return DEFAULT_INTERVAL_S
    return 0.0 if raw <= 0 else max(MIN_INTERVAL_S, raw)


def _default_connect() -> Any:
    import pg_db  # noqa: PLC0415

    return pg_db.connect()


def _int_or_none(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _bool_or_none(value: Any) -> bool | None:
    return value if isinstance(value, bool) else None


def _clock_skew_test_s() -> float:
    """Test-only (S13 w harnessie): przesuniecie zegara klienta; aktywne TYLKO przy DAM_TEST_PG=1."""
    if os.environ.get("DAM_TEST_PG") != "1":
        return 0.0
    try:
        return float(os.environ.get("DAM_TEST_CLOCK_SKEW_S") or 0.0)
    except ValueError:
        return 0.0


def _app_version() -> str:
    try:
        import bridge_supervisor  # noqa: PLC0415

        return str(bridge_supervisor.local_identity().get("app_version") or "")
    except Exception:  # noqa: BLE001
        return ""


def _dam_user() -> str:
    try:
        import machine_identity  # noqa: PLC0415

        return str((machine_identity.read_bound_session() or {}).get("user_email") or "")
    except Exception:  # noqa: BLE001
        return ""


def _snapshot_error() -> str:
    """Ostatni blad pobierania katalogu (cykl migawek) - do last_error tetna."""
    try:
        import index_snapshots  # noqa: PLC0415

        pull = index_snapshots._LAST.get("pull") or {}  # noqa: SLF001 - bez przeliczania katalogu (status() robi stat())
        return str(pull.get("error") or pull.get("errors") or "")
    except Exception:  # noqa: BLE001
        return ""


def build_row(info: dict[str, Any], *, machine_name: str, rinfo: dict[str, str], role: dict[str, Any],
              catalog: dict[str, Any], app_version: str, dam_user: str, last_error: str) -> dict[str, Any]:
    """Parametry UPSERT-u tetna (czysta funkcja; kazda kolumna NOT NULL ma wartosc, nigdy None)."""
    asset = info.get("asset_status") if isinstance(info.get("asset_status"), dict) else {}
    gen = catalog.get("gen")
    return {
        "machine": m_computers.machine_key(machine_name),
        "machine_name": str(machine_name or ""),
        "windows_user": str(info.get("windows_user") or ""),
        "dam_user": dam_user,
        "app_version": app_version,
        "proto": PROTO,
        "platform": sys.platform,
        "data_mode": str(info.get("data_mode") or ""),
        "catalog_kind": str(catalog.get("kind") or ""),
        "catalog_id": str(catalog.get("id") or ""),
        "catalog_gen": _int_or_none(gen),
        "catalog_built_at": str(catalog.get("built_at") or ""),
        "catalog_source": str(catalog.get("source") or ""),
        "catalog_pulled_at": str(catalog.get("pulled_at") or ""),
        "assets_rev": _int_or_none(asset.get("assets_max_rev")),
        "missing_marked": _int_or_none(asset.get("missing_marked")),
        "holds": _int_or_none(asset.get("holds")),
        "witness_tripped": _bool_or_none(asset.get("witness_tripped")),
        "root_kind": str(rinfo.get("kind") or "none"),
        "root_drive": str(rinfo.get("drive") or ""),
        "root_share": str(rinfo.get("share") or ""),
        "root_state": str(info.get("root_state") or "none"),
        "m_role": str(role.get("role") or "copy"),
        "m_state": str(role.get("state") or "none"),
        "last_error": str(last_error or "")[:300],
    }


def _read_meta(cur: Any) -> tuple[list[str], bool]:
    """(lista adresow udzialu M:, czy tetno wylaczone w bazie) - jedno zapytanie."""
    cur.execute("SELECT key, value FROM dam_meta WHERE key IN (%s, %s)", (META_SHARES, META_SWITCH))
    shares: list[str] = []
    off = False
    for row in cur.fetchall():
        key, value = (row["key"], row["value"]) if hasattr(row, "get") else (row[0], row[1])
        if key == META_SWITCH:
            off = str(value or "").strip().lower() == "off"
        elif key == META_SHARES:
            shares = _parse_shares(value)
    return shares, off


def _parse_shares(raw: Any) -> list[str]:
    try:
        doc = json.loads(raw) if isinstance(raw, (str, bytes)) else raw
    except (TypeError, ValueError):
        return []
    items = doc.get("shares") if isinstance(doc, dict) else None
    out: list[str] = []
    for item in items if isinstance(items, list) else []:
        s = m_computers.normalize_share(str(item or ""))
        if s and s not in out:
            out.append(s)
    return out


def _beat(get_info: Callable[[], dict[str, Any]], connect: Callable[[], Any]) -> dict[str, Any]:
    import index_authority  # noqa: PLC0415 - jedna nazwa komputera dla calego programu

    machine_name = index_authority.current_machine()
    if not m_computers.machine_key(machine_name):
        return {"ok": True, "status": "no_machine"}
    info = get_info() or {}
    root = str(info.get("base_path") or "")
    rinfo = m_computers.root_info(root)
    try:
        import index_snapshots  # noqa: PLC0415

        catalog = index_snapshots.catalog_info()
    except Exception:  # noqa: BLE001 - brak katalogu nie zabija tetna
        catalog = {}
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute(_FLAGS_SQL)
        flags = cur.fetchone()
        if not flags["hb"]:
            conn.rollback()
            return {"ok": True, "status": "no_tables"}
        shares, off = _read_meta(cur) if flags["meta"] else ([], False)
        if off:
            conn.rollback()
            return {"ok": True, "status": "off"}
        machine = m_computers.machine_key(machine_name)
        role: dict[str, Any] = {"role": "copy", "state": "none"}
        m_error = ""
        if flags["mc"] and rinfo["kind"] != "none":
            cur.execute("SAVEPOINT fleet_m")
            try:
                if rinfo["share"] and rinfo["share"] in shares:
                    cur.execute(_SELF_REPORT_SQL, {"machine": machine, "drive": rinfo["drive"], "share": rinfo["share"]})
                role = m_computers.apply_row(root, rinfo, m_computers.read_row(cur, machine, rinfo["drive"]))
                cur.execute("RELEASE SAVEPOINT fleet_m")
            except Exception as exc:  # noqa: BLE001 - np. CHECK na dziwnej nazwie; tetno idzie dalej
                cur.execute("ROLLBACK TO SAVEPOINT fleet_m")
                role = m_computers.fallback(root, rinfo)
                m_error = f"rejestr M: {exc}"
        with _LOCK:
            own_error = str(_STATE.get("last_error") or "")
            if _STATE.get("started_at") is None:
                _STATE["started_at"] = flags["db_now"]
            started_at = _STATE["started_at"]
        err = m_error or own_error or _snapshot_error()
        row = build_row(info, machine_name=machine_name, rinfo=rinfo, role=role, catalog=catalog,
                        app_version=_app_version(), dam_user=_dam_user(), last_error=err)
        row.update(client_epoch=time.time() + _clock_skew_test_s(), started_at=started_at)
        cur.execute(_UPSERT_SQL, row)
        conn.commit()
        return {"ok": True, "status": "ok", "role": role.get("role"), "m_state": role.get("state")}
    finally:
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass


def beat(get_info: Callable[[], dict[str, Any]], pg_connect: Callable[[], Any] | None = None) -> dict[str, Any]:
    """Jedno tetno. NIGDY nie rzuca; wynik {ok, status} (ok=False tylko przy bledzie: wtedy retry po MIN_RETRY_S)."""
    try:
        res = _beat(get_info, pg_connect or _default_connect)
    except Exception as exc:  # noqa: BLE001
        res = {"ok": False, "status": "error", "error": f"{type(exc).__name__}: {exc}"[:300]}
    _note(res)
    return res


_LOG_TEXT = {
    "no_tables": "tabele etapu 0 nie istnieja (uruchom sql/fleet.sql na bazie) - tetno pominiete, reszta programu bez zmian",
    "off": "tetno wylaczone w bazie (dam_meta fleet_heartbeat = off)",
    "no_machine": "brak nazwy komputera - tetno pominiete",
}


def _note(res: dict[str, Any]) -> None:
    """Stan tetna dla /fleet/status i log: jedna linia przy ZMIANIE stanu, nie co cykl."""
    status = str(res.get("status") or "")
    now = _utc()
    with _LOCK:
        changed = status != _STATE.get("status")
        _STATE.update(status=status, beats=int(_STATE.get("beats") or 0) + 1, last_beat_at=now)
        if res.get("ok") and status == "ok":
            _STATE.update(last_ok_at=now, last_error="")
        elif not res.get("ok"):
            _STATE["last_error"] = str(res.get("error") or status)[:300]
    if changed and status != "ok":
        print("fleet_heartbeat:", _LOG_TEXT.get(status) or str(res.get("error") or status), flush=True)


def local_state() -> dict[str, Any]:
    with _LOCK:
        out = {k: v for k, v in _STATE.items() if k != "started_at"}
    out["interval_s"] = interval_s()
    out["thread_alive"] = bool(_THREAD is not None and _THREAD.is_alive())
    return out


class Pace:
    """Kiedy nastepne tetno (czysta logika, testowalna bez watku). Pierwsze po first_delay_s;
    po sukcesie za interval_s, po bledzie za MIN_RETRY_S (nigdy czesciej); kick() = tetno od razu,
    ale nie wczesniej niz KICK_MIN_S po poprzednim i nie przed pierwszym zaplanowanym."""

    def __init__(self, interval: float, *, first_delay_s: float = FIRST_DELAY_S,
                 clock: Callable[[], float] = time.monotonic):
        self.interval = float(interval)
        self.clock = clock
        self.next_at = clock() + min(first_delay_s, self.interval)
        self.last: float | None = None
        self.kicked = False
        self.hold_until = 0.0  # po bledzie: nic (tez kick) przed uplywem MIN_RETRY_S

    def kick(self) -> None:
        self.kicked = True

    def due(self) -> bool:
        now = self.clock()
        if now < self.hold_until:
            return False
        if now >= self.next_at:
            return True
        return self.kicked and self.last is not None and now - self.last >= KICK_MIN_S

    def done(self, ok: bool) -> None:
        now = self.clock()
        self.last = now
        self.kicked = False
        self.hold_until = 0.0 if ok else now + MIN_RETRY_S
        self.next_at = now + (self.interval if ok else MIN_RETRY_S)


def kick() -> None:
    """Poproś o tetno wkrotce (zmiana ROOT, nowy katalog). Asynchroniczne: tylko zdarzenie, nie czeka na baze."""
    _WAKE.set()


def _loop(get_info: Callable[[], dict[str, Any]], pg_connect: Callable[[], Any] | None, pace: Pace) -> None:
    while not _STOP.is_set():
        try:
            if _WAKE.is_set():
                _WAKE.clear()
                pace.kick()
            if pace.due():
                pace.done(bool(beat(get_info, pg_connect).get("ok")))
        except Exception as exc:  # noqa: BLE001 - watek nie moze umrzec
            print("fleet_heartbeat: tick", str(exc)[:200], flush=True)
            pace.done(False)
        _WAKE.wait(1.0)


def start(get_info: Callable[[], dict[str, Any]], pg_connect: Callable[[], Any] | None = None) -> dict[str, Any]:
    """Uruchom watek tetna (daemon; most nie czeka). get_info() -> {windows_user, base_path, root_state,
    data_mode, asset_status} dostarcza most (bez importu local_bridge stad: brak cyklu)."""
    global _THREAD
    interval = interval_s()
    if interval <= 0:
        return {"ok": True, "started": False, "reason": "disabled"}
    if _THREAD is not None and _THREAD.is_alive():
        return {"ok": True, "started": False}
    _STOP.clear()
    _THREAD = threading.Thread(target=_loop, args=(get_info, pg_connect, Pace(interval)),
                               daemon=True, name="dam-fleet-heartbeat")
    _THREAD.start()
    return {"ok": True, "started": True, "interval_s": interval}


def stop(timeout: float = 5.0) -> None:
    """Zatrzymaj watek tetna (testy; w programie watek daemon umiera z procesem)."""
    global _THREAD
    _STOP.set()
    _WAKE.set()
    t = _THREAD
    if t is not None and t.is_alive():
        t.join(timeout)
    _THREAD = None


# --- Strona admina: odczyt floty i decyzje -------------------------------------------------------


def _jsonable(row: Any) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in dict(row).items():
        if isinstance(v, datetime):
            v = v.isoformat()
        elif isinstance(v, Decimal):
            v = float(v)
        out[k] = v
    return out


def _version_key(text: str) -> tuple[int, ...] | None:
    try:
        return tuple(int(p) for p in str(text or "").strip().split("."))
    except ValueError:
        return None


def _db_catalog(cur: Any) -> dict[str, Any]:
    import index_snapshots  # noqa: PLC0415

    keys = index_snapshots.CATALOG_KEYS
    cur.execute("SELECT store_key, sha256, built_at, built_by FROM dam_index_snapshots WHERE store_key = ANY(%s)",
                (list(keys),))
    rows = {str(r["store_key"]): r for r in cur.fetchall()}
    cat_id = index_snapshots.catalog_id_from_shas({k: str((rows.get(k) or {}).get("sha256") or "") for k in keys})
    head = rows.get("file-index") or {}
    return {"kind": "snapshot", "id": cat_id, "built_at": str(head.get("built_at") or ""),
            "built_by": str(head.get("built_by") or "")}


def admin_status(pg_connect: Callable[[], Any] | None = None) -> dict[str, Any]:
    """Dla GET /fleet/status (tylko admin): komputery z tetnem, wiersze rejestru M:, komputery bez
    tetna (znane z device_sessions), katalog w bazie, lista adresow M:, najnowsza wersja programu.
    Czasy i wiek (age_s) z zegara bazy."""
    conn = (pg_connect or _default_connect)()
    try:
        cur = conn.cursor()
        cur.execute(_FLAGS_SQL)
        flags = cur.fetchone()
        out: dict[str, Any] = {
            "now": flags["db_now"].isoformat(), "tables": {"heartbeat": bool(flags["hb"]), "m_computers": bool(flags["mc"])},
            "computers": [], "m_computers": [], "no_heartbeat": [], "m_shares": [], "db_catalog": {},
            "latest_app_version": "", "local": local_state(),
        }
        if flags["meta"]:
            out["m_shares"] = _read_meta(cur)[0]
        if flags["snaps"]:
            out["db_catalog"] = _db_catalog(cur)
        m_rows: dict[tuple[str, str], dict[str, Any]] = {}
        if flags["mc"]:
            cur.execute("SELECT * FROM dam_m_computers ORDER BY machine, drive")
            for r in cur.fetchall():
                d = _jsonable(r)
                d["unsigned"] = d["state"] == "approved" and not d["decided_by"]
                out["m_computers"].append(d)
                m_rows[(d["machine"], d["drive"])] = d
        known: set[str] = set()
        if flags["hb"]:
            cur.execute("SELECT h.*, extract(epoch FROM now() - h.seen_at) AS age_s "
                        "FROM dam_client_heartbeat h ORDER BY lower(h.machine_name), h.machine")
            for r in cur.fetchall():
                d = _jsonable(r)
                d["online"] = float(d["age_s"] or 0) <= ONLINE_S
                d["m_row"] = m_rows.get((d["machine"], d["root_drive"]))
                out["computers"].append(d)
                known.add(d["machine"])
            best = max((k for k in (_version_key(c["app_version"]) for c in out["computers"]) if k), default=None)
            out["latest_app_version"] = ".".join(str(n) for n in best) if best else ""
        if flags["sessions"]:
            cur.execute(
                "SELECT lower(btrim(split_part(hostname, ':', 1))) AS machine, max(hostname) AS hostname, "
                "max(windows_user) AS windows_user, max(last_seen_at) AS last_seen_at "
                "FROM device_sessions WHERE NOT revoked AND btrim(hostname) <> '' "
                "GROUP BY 1 ORDER BY 4 DESC LIMIT 200")
            out["no_heartbeat"] = [_jsonable(r) for r in cur.fetchall() if r["machine"] not in known]
        conn.rollback()  # same SELECT-y
        return out
    finally:
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass


def _write_shares(cur: Any, shares: list[str], by: str) -> None:
    """Zapis listy adresow; znacznik czasu w JSON z zegara BAZY (nie klienta)."""
    cur.execute(
        "INSERT INTO dam_meta (key, value) VALUES (%s, jsonb_build_object('shares', %s::jsonb, "
        "'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), 'updated_by', %s::text)::text) "
        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
        (META_SHARES, json.dumps(shares, ensure_ascii=False), by))


def _locked_shares(cur: Any) -> list[str]:
    """Lista adresow z blokada wiersza (dwoch adminow naraz nie gubi zmian)."""
    cur.execute("INSERT INTO dam_meta (key, value) VALUES (%s, %s) ON CONFLICT (key) DO NOTHING",
                (META_SHARES, json.dumps({"shares": []})))
    cur.execute("SELECT value FROM dam_meta WHERE key = %s FOR UPDATE", (META_SHARES,))
    row = cur.fetchone()
    return _parse_shares(row["value"] if row else "")


def m_decision(pg_connect: Callable[[], Any] | None, *, machine: str, drive: str, state: str,
               note: str | None, by: str) -> dict[str, Any]:
    """Admin zatwierdza ('approved') albo odrzuca ('revoked') pare (komputer, dysk)."""
    if state not in ("approved", "revoked"):
        return {"ok": False, "error": "bad_state"}
    key, drv = m_computers.machine_key(machine), str(drive or "").strip().upper()
    if not key:
        return {"ok": False, "error": "machine_required"}
    conn = (pg_connect or _default_connect)()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE dam_m_computers SET state = %s, decided_at = now(), decided_by = %s, note = COALESCE(%s, note) "
                    "WHERE machine = %s AND drive = %s RETURNING machine, drive, share, state, source",
                    (state, by, note, key, drv))
        row = cur.fetchone()
        conn.commit()
        return {"ok": True, "row": _jsonable(row)} if row else {"ok": False, "error": "not_found"}
    finally:
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass


def m_share(pg_connect: Callable[[], Any] | None, *, action: str, share: str, by: str) -> dict[str, Any]:
    """Admin dodaje / usuwa adres udzialu M: z dam_meta['m_shares'] (znormalizowany, bez duplikatow)."""
    norm = m_computers.normalize_share(share)
    if action not in ("add", "remove") or not norm:
        return {"ok": False, "error": "bad_request"}
    conn = (pg_connect or _default_connect)()
    try:
        cur = conn.cursor()
        shares = _locked_shares(cur)
        shares = [s for s in shares if s != norm] + ([norm] if action == "add" else [])
        _write_shares(cur, shares, by)
        conn.commit()
        return {"ok": True, "shares": shares}
    finally:
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass


def m_register(pg_connect: Callable[[], Any] | None, *, machine: str, drive: str, by: str) -> dict[str, Any]:
    """Skrot "to jest M:": klucz ROOT z tetna tego komputera trafia do m_shares, a para dostaje 'approved'
    (rozwiazuje pierwsze uruchomienie, gdy lista jest jeszcze pusta). Wiersz zostaje source='auto', czyli
    zatwierdzenie dotyczy TEGO udzialu: przemapowanie litery na inny go nie dziedziczy."""
    key, drv = m_computers.machine_key(machine), str(drive or "").strip().upper()
    if not key:
        return {"ok": False, "error": "machine_required"}
    conn = (pg_connect or _default_connect)()
    try:
        cur = conn.cursor()
        cur.execute("SELECT root_share FROM dam_client_heartbeat WHERE machine = %s AND root_drive = %s", (key, drv))
        hb = cur.fetchone()
        share = str(hb["root_share"] if hb else "")
        if not hb:
            conn.rollback()
            return {"ok": False, "error": "no_heartbeat"}
        if not share:
            conn.rollback()
            return {"ok": False, "error": "no_share"}
        shares = _locked_shares(cur)
        if share not in shares:
            shares.append(share)
            _write_shares(cur, shares, by)
        cur.execute("INSERT INTO dam_m_computers (machine, drive, share, state, source, decided_at, decided_by) "
                    "VALUES (%s, %s, %s, 'approved', 'auto', now(), %s) "
                    "ON CONFLICT (machine, drive) DO UPDATE SET share = EXCLUDED.share, state = 'approved', "
                    "decided_at = now(), decided_by = EXCLUDED.decided_by "
                    "RETURNING machine, drive, share, state, source",
                    (key, drv, share, by))
        row = cur.fetchone()
        conn.commit()
        return {"ok": True, "row": _jsonable(row), "shares": shares}
    finally:
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass
