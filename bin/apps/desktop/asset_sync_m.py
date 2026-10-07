# -*- coding: utf-8 -*-
"""Etap 1a nowej synchronizacji: klient w roli "komputer z M:" (M: = dysk z oryginalami).

Jedno miejsce dla instrukcji SQL M1-M17 (tekst identyczny z spec/etap-1/sql/04-klient-m.sql, sprawdzony
93 testami na bazie testowej) i dla logiki, ktora z nich korzysta:

  stamp_and_mark(...)   stempel "widziane na M:" (M2) i pierwsze sprawdzenie "brakuje od" (M3)
  confirm_pass(...)     drugie sprawdzenie: zajecie plikow (M4), sondy, kanarki, wstrzymanie folderu,
                        swiadek (M12-M14), pary folderow (M7), znaczniki usuniecia w partii (M6)
  undo_batch(...)       cofniecie partii usuniec jedna instrukcja (M8)
  list_batches(...)     lista partii (M9)

Zasady, ktore ten modul egzekwuje (spec/etap-1.md, rozdzialy 3 i 5):
  * baza pamieta, co bylo widziane na M: (kolumny origin / master_* / missing_since_ms); zegar bazy, nie klienta;
  * zwykla praca usuwa WYLACZNIE wiersze origin = 'm'; wiersze sprzed 1a rozstrzyga narzedzie uzgodnienia;
  * sonda rozroznia "nie ma" od "nieosiagalny"; nieosiagalny nigdy nie prowadzi do oznaczenia braku;
  * kanarki (20 plikow z >= 5 galezi) na poczatku, co 500 sond i przed kazda paczka 500 znacznikow;
  * kazdy znacznik usuniecia w osobnym SAVEPOINT; zly trafia do raportu, nie wycofuje paczki;
  * klient NIGDY nie wykonuje CREATE / ALTER / DROP (to robi skrypt administratora).

Rola komputera: resolve_role() - jedyne miejsce wywolania interfejsu etapu 0 (m_computers.role_for_root).
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import re
import sys
import time
from typing import Any, Callable, Iterable

import asset_sync

try:
    import psycopg2 as _psycopg2

    _CONN_ERRORS: tuple = (_psycopg2.OperationalError, _psycopg2.InterfaceError)
except ImportError:  # pragma: no cover
    _CONN_ERRORS = (ConnectionError, OSError)

NOW = "(extract(epoch FROM clock_timestamp()) * 1000)::bigint"

CLAIM_LIMIT = 2000
LEASE_MS = 60000                 # odstep ponownego zajecia pliku w zwyklej pracy
STAMP_BATCH = 2000
CANARIES = 20
CANARY_OK = 18                   # przy swiadku 20 z 20
CANARY_EVERY = 500
WITNESS_SHARE = 0.05
WITNESS_MIN = 200
WITNESS_RECHECK_MS = 1200000     # seria sond co 20 minut
WITNESS_GAP_MS = WITNESS_RECHECK_MS - 60000       # M12 min_gap_ms (zapas na rozrzut zegarow)
WITNESS_WINDOW_MS = 3600000
WITNESS_WINDOW_SLACK_MS = WITNESS_WINDOW_MS + 300000
WITNESS_SERIES = 3
SHADOW_RECHECK_MS = 21600000     # 6 h: w trybie shadow plik nie jest sondowany co minute
PAIR_MIN_FILES = 3
PAIR_SHARE = 0.90
PAIR_SAME_MTIME = 0.50
DELETE_COMMIT_EVERY = 500
REFUSE_STOP = 25                 # tyle odmow bazy z rzedu = reguly (np. hamulec) nie pozwalaja isc dalej
MIN_CANARY_POOL = 1

DEFAULT_RULES = {"mode": "off", "confirm_ms": 90000, "hold_ms": 900000,
                 "batch_max_files": 1000, "batch_max_share": 0.02}
MODES = ("off", "shadow", "on")
BATCH_RE = re.compile(r"^[crw]-[A-Za-z0-9_.-]{1,80}$")

# Instrukcje M1-M17: tekst z spec/etap-1/sql/04-klient-m.sql (komentarze zdjete; {NOW} = zegar BAZY).
# Zmiana tego tekstu wymaga ponownego przejscia testow realpg (test_asset_sync_m_realpg.py).
_M_RAW: dict[str, str] = {
    "M1": r"""INSERT INTO dam_assets AS t
  (asset_id, asset_key, path_rel, name, size, mtime_ms, content_hash, meta, deleted_at,
   updated_at, updated_by, seen_by_machine, rev,
   origin, master_seen_ms, master_mtime, master_size)
VALUES (%(asset_id)s, %(asset_key)s, %(path_rel)s, %(name)s, %(size)s, %(mtime_ms)s, %(content_hash)s, %(meta)s::jsonb, NULL,
        {NOW}, %(machine)s, %(machine)s, nextval('dam_assets_rev_seq'),
        'm', {NOW}, %(master_mtime)s, %(size)s)
ON CONFLICT (asset_id) DO UPDATE SET
  asset_key = EXCLUDED.asset_key, path_rel = EXCLUDED.path_rel, name = EXCLUDED.name,
  size = coalesce(EXCLUDED.size, t.size), mtime_ms = EXCLUDED.mtime_ms, content_hash = EXCLUDED.content_hash,
  meta = EXCLUDED.meta, deleted_at = NULL, updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by, seen_by_machine = EXCLUDED.seen_by_machine,
  rev = nextval('dam_assets_rev_seq'),
  origin = 'm', master_seen_ms = EXCLUDED.master_seen_ms, master_mtime = EXCLUDED.master_mtime,
  master_size = coalesce(EXCLUDED.master_size, t.master_size),
  missing_since_ms = NULL, delete_batch = NULL
WHERE (t.master_seen_ms IS NULL OR t.master_seen_ms <= %(scan_db)s)
  AND (t.deleted_at IS NULL OR t.deleted_at <= %(scan_db)s)
  AND (EXCLUDED.master_mtime IS DISTINCT FROM coalesce(t.master_mtime, t.mtime_ms)
       OR (EXCLUDED.size IS NOT NULL AND EXCLUDED.size IS DISTINCT FROM t.size)
       OR EXCLUDED.content_hash IS DISTINCT FROM t.content_hash
       OR EXCLUDED.meta IS DISTINCT FROM t.meta
       OR EXCLUDED.path_rel IS DISTINCT FROM t.path_rel
       OR EXCLUDED.name IS DISTINCT FROM t.name
       OR t.deleted_at IS NOT NULL
       OR t.origin IS DISTINCT FROM 'm')
  AND (EXCLUDED.master_mtime IS DISTINCT FROM coalesce(t.master_mtime, t.mtime_ms)
       OR t.deleted_at IS NOT NULL OR t.origin IS DISTINCT FROM 'm'
       OR t.rev <= %(base_rev)s)
RETURNING rev""",
    "M2": r"""UPDATE dam_assets t
   SET origin = 'm', master_seen_ms = {NOW}, master_mtime = t.mtime_ms, master_size = coalesce(s.sz, t.master_size),
       missing_since_ms = NULL,
       rev = CASE WHEN t.origin = 'copy' THEN nextval('dam_assets_rev_seq') ELSE t.rev END
  FROM unnest(%(ids)s::text[], %(mtimes)s::bigint[], %(sizes)s::bigint[]) AS s(id, mt, sz)
 WHERE t.asset_id = s.id AND t.deleted_at IS NULL AND t.mtime_ms = s.mt
   AND (t.master_seen_ms IS NULL OR t.missing_since_ms IS NOT NULL OR t.origin IS DISTINCT FROM 'm')""",
    "M3": r"""UPDATE dam_assets t
   SET missing_since_ms = {NOW}, checked_ms = {NOW}
 WHERE t.asset_id = ANY(%(ids)s::text[])
   AND t.deleted_at IS NULL AND t.missing_since_ms IS NULL
   AND t.origin = 'm'
   AND (t.master_seen_ms IS NULL OR t.master_seen_ms <= %(scan_db)s)
   AND (t.checked_ms IS NULL OR t.checked_ms <= {NOW} - 86400000)
RETURNING t.asset_id""",
    "M4": r"""WITH due AS MATERIALIZED (
  SELECT asset_id FROM dam_assets
   WHERE deleted_at IS NULL AND missing_since_ms IS NOT NULL
     AND missing_since_ms <= {NOW} - %(confirm_ms)s
     AND checked_ms <= {NOW} - %(recheck_ms)s
   ORDER BY missing_since_ms
   LIMIT %(limit)s
   FOR UPDATE SKIP LOCKED)
UPDATE dam_assets t
   SET checked_ms = {NOW}
  FROM due
 WHERE t.asset_id = due.asset_id
RETURNING t.asset_id, t.asset_key, t.path_rel, t.name, t.mtime_ms, t.master_mtime, t.origin, t.missing_since_ms""",
    "M5": r"""UPDATE dam_assets
   SET missing_since_ms = NULL, checked_ms = {NOW}, master_seen_ms = {NOW}, origin = coalesce(origin, 'm'),
       master_mtime = coalesce(master_mtime, mtime_ms)
 WHERE asset_id = ANY(%(ids)s::text[]) AND deleted_at IS NULL AND missing_since_ms IS NOT NULL""",
    "M6": r"""UPDATE dam_assets
   SET deleted_at = {NOW}, updated_at = {NOW}, updated_by = %(machine)s, seen_by_machine = %(machine)s,
       delete_batch = %(batch)s, rev = nextval('dam_assets_rev_seq')
 WHERE asset_id = %(asset_id)s AND deleted_at IS NULL
   AND origin = 'm'
   AND missing_since_ms IS NOT NULL AND missing_since_ms <= {NOW} - %(wait_ms)s
   AND mtime_ms = %(mirror_mtime)s
RETURNING rev""",
    "M7": r"""INSERT INTO dam_asset_product_links AS t
  (asset_id, product_id, score, source, status, reason, updated_at, updated_by)
SELECT %(new_id)s, l.product_id, l.score, l.source, l.status, l.reason,
       to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), %(machine)s || ':move'
  FROM dam_asset_product_links l
 WHERE l.asset_id = %(old_id)s
ON CONFLICT (asset_id, product_id) DO NOTHING""",
    "M8": r"""UPDATE dam_assets
   SET deleted_at = NULL, delete_batch = NULL, missing_since_ms = NULL, checked_ms = {NOW},
       updated_at = {NOW}, updated_by = %(machine)s, seen_by_machine = %(machine)s,
       rev = nextval('dam_assets_rev_seq')
 WHERE delete_batch = %(batch)s AND deleted_at IS NOT NULL
RETURNING asset_id""",
    "M9": r"""SELECT delete_batch, count(*) AS files, min(deleted_at) AS first_ms, max(deleted_at) AS last_ms,
       max(updated_by) AS by
  FROM dam_assets WHERE delete_batch IS NOT NULL AND deleted_at IS NOT NULL
 GROUP BY delete_batch ORDER BY max(deleted_at) DESC LIMIT 50""",
    "M10": r"""SELECT count(*) AS marked FROM dam_assets WHERE missing_since_ms IS NOT NULL AND deleted_at IS NULL""",
    "M11": r"""SELECT asset_id, asset_key, path_rel, name, size, mtime_ms, content_hash, meta,
       deleted_at, updated_at, updated_by, seen_by_machine, rev,
       origin, master_mtime, master_size, author_mtime, author_size, author_by, delete_batch
  FROM dam_assets WHERE rev > %s ORDER BY rev LIMIT %s""",
    "M12": r"""INSERT INTO dam_meta AS d (key, value)
VALUES ('m_witness', json_build_object('since_ms', {NOW}, 'last_ms', {NOW}, 'series', 1,
                                       'count', %(count)s::int, 'sha', %(sha)s::text, 'by', %(machine)s::text)::text)
ON CONFLICT (key) DO UPDATE SET value = CASE
    WHEN (d.value::jsonb ->> 'sha') IS DISTINCT FROM %(sha)s::text
         OR {NOW} - (d.value::jsonb ->> 'since_ms')::bigint > %(window_ms)s
      THEN EXCLUDED.value
    WHEN {NOW} - (d.value::jsonb ->> 'last_ms')::bigint < %(min_gap_ms)s
      THEN d.value
    ELSE (d.value::jsonb || jsonb_build_object('series', (d.value::jsonb ->> 'series')::int + 1,
                                               'last_ms', {NOW}, 'by', %(machine)s::text))::text
  END
RETURNING value""",
    "M13": r"""SELECT value, {NOW} AS now_ms FROM dam_meta WHERE key = 'm_witness'""",
    "M14": r"""DELETE FROM dam_meta WHERE key = 'm_witness'""",
    "M15": r"""UPDATE dam_assets t
   SET missing_since_ms = {NOW}, checked_ms = {NOW}
 WHERE t.asset_id = ANY(%(ids)s::text[])
   AND t.deleted_at IS NULL AND t.missing_since_ms IS NULL
   AND (t.origin IS NULL OR t.origin = 'm')
RETURNING t.asset_id""",
    "M16": r"""UPDATE dam_assets
   SET deleted_at = {NOW}, updated_at = {NOW}, updated_by = %(machine)s, seen_by_machine = %(machine)s,
       delete_batch = %(batch)s, rev = nextval('dam_assets_rev_seq')
 WHERE asset_id = %(asset_id)s AND deleted_at IS NULL
   AND (origin IS NULL OR origin = 'm')
   AND %(batch)s LIKE 'r-%%'
   AND missing_since_ms IS NOT NULL AND missing_since_ms <= {NOW} - %(wait_ms)s
   AND mtime_ms = %(mirror_mtime)s
RETURNING rev""",
    "M17": r"""INSERT INTO dam_meta AS d (key, value)
SELECT 'm_catalog_count',
       json_build_object('live', count(*), 'at_ms', {NOW}, 'by', %(machine)s::text)::text
  FROM dam_assets WHERE deleted_at IS NULL
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
 WHERE coalesce(substring(d.value from '"at_ms"\s*:\s*([0-9]{1,15})')::bigint, 0) <= {NOW} - %(min_age_ms)s
RETURNING value""",
}


def _sql(text: str) -> str:
    return text.replace("{NOW}", NOW)


# Odczyt wszystkich oznaczonych "brakuje od" (wykorzystuje indeks czesciowy dam_assets_missing_idx):
# potrzebny do wstrzymania folderow, swiadka i doboru kanarkow. Tylko SELECT.
M18 = ("SELECT asset_id, asset_key, path_rel, name, mtime_ms, master_mtime, origin, missing_since_ms, checked_ms "
       "FROM dam_assets WHERE missing_since_ms IS NOT NULL AND deleted_at IS NULL")
M_NOW = "SELECT " + NOW + " AS now_ms"

M: dict[str, str] = {k: _sql(v) for k, v in _M_RAW.items()}
M["M18"] = M18

# --------------------------------------------------------------------------
# Wspolne drobiazgi
# --------------------------------------------------------------------------


def _cell(row: Any, key: str, idx: int = 0) -> Any:
    if row is None:
        return None
    if hasattr(row, "keys"):
        return row[key]
    return row[idx]


def _rollback(pg) -> None:
    try:
        pg.rollback()
    except Exception:  # noqa: BLE001
        pass


def _is_conn_error(exc: BaseException) -> bool:
    return isinstance(exc, _CONN_ERRORS)


def _safe_machine(machine: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", str(machine or "x"))[:40] or "x"


def writer_of(machine: str, role: str) -> str:
    """Znacznik roli dla wyzwalacza bazy (zmienna transakcji dam.writer): 'HOST:m1' / 'HOST:c1'."""
    return f"{machine}:{'m1' if role == asset_sync.ROLE_M else 'c1'}"


def begin_write(cur, writer: str | None, *, lock: bool = True) -> None:
    asset_sync.begin_write(cur, writer, lock=lock)


def db_now(cur) -> int:
    cur.execute(M_NOW)
    return int(_cell(cur.fetchone(), "now_ms"))


def db_clock_offset(pg) -> tuple[int, int]:
    """(przesuniecie, obieg) w ms: zegar bazy minus zegar tego komputera, zmierzone w srodku obiegu."""
    cur = pg.cursor()
    t0 = time.time()
    cur.execute(M_NOW)
    t1 = time.time()
    now = int(_cell(cur.fetchone(), "now_ms"))
    _rollback(pg)
    return int(now - (t0 + t1) / 2 * 1000), int((t1 - t0) * 1000)


# --------------------------------------------------------------------------
# Przelacznik dam_meta['m_rules'] i gotowosc bazy
# --------------------------------------------------------------------------


def parse_rules(raw: Any) -> dict:
    """Jak dam_m_rules() w bazie: brak wiersza / zly JSON / zly tryb = "off"; zle liczby = domyslne."""
    cfg = dict(DEFAULT_RULES)
    try:
        data = json.loads(raw) if raw else {}
    except (TypeError, ValueError):
        data = {}
    if not isinstance(data, dict):
        data = {}
    mode = data.get("mode")
    cfg["mode"] = mode if isinstance(mode, str) and mode in MODES else "off"
    for k in ("confirm_ms", "hold_ms", "batch_max_files"):
        v = data.get(k)
        if isinstance(v, int) and not isinstance(v, bool) and 0 <= v < 10 ** 9:
            cfg[k] = v
    share = data.get("batch_max_share")
    if isinstance(share, (int, float)) and not isinstance(share, bool) and 0 <= share <= 1:
        cfg["batch_max_share"] = float(share)
    cfg["proto"] = data.get("proto", 1)
    return cfg


class RulesLookupFailed(Exception):
    """Odczyt dam_meta['m_rules'] sie nie udal (siec, baza) - to NIE jest tryb "off"."""


def read_rules(pg) -> dict:
    try:
        cur = pg.cursor()
        cur.execute("SELECT value FROM dam_meta WHERE key = 'm_rules'")
        row = cur.fetchone()
    except Exception as exc:  # noqa: BLE001
        raise RulesLookupFailed(str(exc)) from exc
    return parse_rules(_cell(row, "value") if row else None)


_COLUMNS = ("origin", "master_seen_ms", "master_mtime", "master_size", "missing_since_ms", "checked_ms",
            "delete_batch", "author_mtime", "author_size", "author_by", "author_seen_ms")
_MISSING_CACHE: dict[str, float] = {}     # schemat -> kiedy ostatnio stwierdzono brak kolumn
MISSING_RECHECK_S = 600.0


def columns_ready(pg, *, now: Callable[[], float] = time.monotonic) -> bool:
    """Czy baza ma kolumny z m_columns.sql i wyzwalacz dam_assets_rules? Brak = klient dziala jak 2.6.0
    (tryb "off"), a sprawdza ponownie dopiero po 10 minutach - nie co cykl i bez wyjatkow."""
    try:
        cur = pg.cursor()
        cur.execute("SELECT current_schema() AS s")
        schema = str(_cell(cur.fetchone(), "s"))
        last = _MISSING_CACHE.get(schema)
        if last is not None and now() - last < MISSING_RECHECK_S:
            return False
        cur.execute(
            "SELECT (SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() "
            "AND table_name = 'dam_assets' AND column_name = ANY(%s)) AS n, "
            "(to_regprocedure('dam_assets_rules()') IS NOT NULL) AS fn", (list(_COLUMNS),))
        row = cur.fetchone()
        ok = int(_cell(row, "n")) == len(_COLUMNS) and bool(_cell(row, "fn", 1))
    except Exception:  # noqa: BLE001
        _rollback(pg)
        return False
    if ok:
        _MISSING_CACHE.pop(schema, None)
    else:
        _MISSING_CACHE[schema] = now()
    return ok


def reset_caches() -> None:
    _MISSING_CACHE.clear()


# --------------------------------------------------------------------------
# Rola komputera (jedyne miejsce wywolania interfejsu etapu 0)
# --------------------------------------------------------------------------


def resolve_role(pg_connect: Callable[[], Any], root_path: str, machine: str) -> str:
    """"m" albo "copy". Interfejs etapu 0: m_computers.role_for_root(pg_connect, root_path) -> {"role": ...}.
    Dopoki modulu nie ma: wiersz dam_m_computers tego komputera, `approved` i dysk zgodny z literą ROOT.
    Kazdy blad = "copy" (nigdy przypadkowe "m")."""
    try:
        import m_computers  # noqa: PLC0415 - dostarcza etap 0

        res = m_computers.role_for_root(pg_connect, root_path)
        return asset_sync.ROLE_M if str((res or {}).get("role")) == "m" else asset_sync.ROLE_COPY
    except ImportError:
        pass
    except Exception:  # noqa: BLE001
        return asset_sync.ROLE_COPY
    if not root_path:
        return asset_sync.ROLE_COPY
    drive = os.path.splitdrive(str(root_path))[0].upper()
    try:
        pg = pg_connect()
    except Exception:  # noqa: BLE001
        return asset_sync.ROLE_COPY
    try:
        cur = pg.cursor()
        cur.execute("SELECT drive, source FROM dam_m_computers WHERE state = 'approved' "
                    "AND machine = lower(btrim(%s))", (str(machine),))
        for row in cur.fetchall():
            d = str(_cell(row, "drive") or "").upper()
            if d == drive or str(_cell(row, "source", 1)) == "admin":
                return asset_sync.ROLE_M
    except Exception:  # noqa: BLE001
        return asset_sync.ROLE_COPY
    finally:
        try:
            pg.close()
        except Exception:  # noqa: BLE001
            pass
    return asset_sync.ROLE_COPY


# --------------------------------------------------------------------------
# M1: operacja nowego klienta w roli M:
# --------------------------------------------------------------------------


def exec_m1(cur, op: dict) -> int | None:
    meta = json.dumps(op.get("meta") or {}, ensure_ascii=False, sort_keys=True)
    cur.execute(M["M1"], {
        "asset_id": op["asset_id"], "asset_key": op["asset_key"], "path_rel": op.get("path_rel") or "",
        "name": op.get("name") or "", "size": op.get("size"), "mtime_ms": int(op.get("mtime_ms") or 0),
        "content_hash": op.get("content_hash"), "meta": meta, "machine": str(op.get("machine") or ""),
        "master_mtime": int(op.get("master_mtime") if op.get("master_mtime") is not None else (op.get("mtime_ms") or 0)),
        "scan_db": int(op.get("scan_db_ms") or 0), "base_rev": int(op.get("base_rev") or 0)})
    row = cur.fetchone()
    return None if not row else int(_cell(row, "rev"))


# --------------------------------------------------------------------------
# M2 + M3: stempel i pierwsze sprawdzenie (po wysylce zmian, w tym samym cyklu)
# --------------------------------------------------------------------------


def stamp_and_mark(pg, writer: str | None, stamp: Iterable[tuple], missing: Iterable[str],
                   scan_db_ms: int) -> dict:
    """M2 paczkami po STAMP_BATCH, kazda w osobnej transakcji (P6), potem M3.
    Zwraca {"stamped", "stamped_ok_ids" (paczki, w ktorych baza zmienila KAZDY wiersz - lustro moze
    zapisac origin = 'm' bez czekania na nowy rev), "marked", "errors"}."""
    res: dict[str, Any] = {"stamped": 0, "stamped_ok_ids": [], "marked": 0, "errors": []}
    cur = pg.cursor()
    stamp = list(stamp)
    for i in range(0, len(stamp), STAMP_BATCH):
        chunk = stamp[i:i + STAMP_BATCH]
        try:
            begin_write(cur, writer, lock=True)
            cur.execute(M["M2"], {"ids": [c[0] for c in chunk], "mtimes": [int(c[1]) for c in chunk],
                                  "sizes": [c[2] for c in chunk]})
            n = cur.rowcount
            pg.commit()
        except Exception as exc:  # noqa: BLE001 - zla paczka do raportu, nie wyjatek
            _rollback(pg)
            res["errors"].append({"step": "M2", "error": str(exc)[:200]})
            if _is_conn_error(exc):
                return res
            continue
        res["stamped"] += max(0, n)
        if n == len(chunk):
            res["stamped_ok_ids"].extend(c[0] for c in chunk)
        else:   # cos zmienilo sie w miedzyczasie albo inny komputer z M: juz je ostemplowal: zapytaj baze, ktore sa 'm'
            try:
                cur.execute("SELECT asset_id FROM dam_assets WHERE asset_id = ANY(%s) AND origin = 'm' "
                            "AND master_seen_ms IS NOT NULL", ([c[0] for c in chunk],))
                res["stamped_ok_ids"].extend(_cell(r, "asset_id") for r in cur.fetchall())
                _rollback(pg)
            except Exception:  # noqa: BLE001
                _rollback(pg)
    missing = list(missing)
    for i in range(0, len(missing), STAMP_BATCH):
        chunk = missing[i:i + STAMP_BATCH]
        try:
            begin_write(cur, writer, lock=False)
            cur.execute(M["M3"], {"ids": chunk, "scan_db": int(scan_db_ms)})
            res["marked"] += len(cur.fetchall())
            pg.commit()
        except Exception as exc:  # noqa: BLE001
            _rollback(pg)
            res["errors"].append({"step": "M3", "error": str(exc)[:200]})
            if _is_conn_error(exc):
                return res
    return res


# --------------------------------------------------------------------------
# Kanarki
# --------------------------------------------------------------------------


def _branch(key: str) -> str:
    """Galaz = trzy pierwsze poziomy FOLDEROW sciezki (bez nazwy pliku)."""
    return "/".join(str(key).split("/")[:-1][:3])


class CanaryPool:
    """Pliki, ktore baza zna jako obecne, pogrupowane w galezie (trzy pierwsze poziomy sciezki).
    draw() losuje po jednym z kolejnych galezi, wiec 20 kanarkow pochodzi z jak najwiekszej liczby galezi."""

    def __init__(self, candidates: Iterable[tuple[str, str, str]], rng: random.Random | None = None):
        self.rng = rng or random.Random()
        self.by_branch: dict[str, list[tuple[str, str]]] = {}
        for aid, rel, key in candidates:
            self.by_branch.setdefault(_branch(key), []).append((aid, rel))

    def __len__(self) -> int:
        return sum(len(v) for v in self.by_branch.values())

    def draw(self, n: int = CANARIES) -> list[tuple[str, str]]:
        picks: list[tuple[str, str]] = []
        chosen: dict[str, set[int]] = {b: set() for b in self.by_branch}
        branches = list(self.by_branch)
        self.rng.shuffle(branches)
        while len(picks) < n:
            progressed = False
            for b in branches:
                pool = self.by_branch[b]
                if len(chosen[b]) >= len(pool):
                    continue
                for _ in range(8):
                    j = self.rng.randrange(len(pool))
                    if j not in chosen[b]:
                        break
                else:
                    j = next(x for x in range(len(pool)) if x not in chosen[b])
                chosen[b].add(j)
                picks.append(pool[j])
                progressed = True
                if len(picks) >= n:
                    break
            if not progressed:
                break
        return picks


def run_canaries(pool: CanaryPool | None, probe: Callable[..., dict], *, n: int = CANARIES,
                 need: int = CANARY_OK) -> dict:
    """20 losowych plikow, ktore baza zna jako obecne, musza odpowiedziec "jest" (>= need).
    Swiezy cache listowan na kazde sprawdzenie. Brak kanarkow = porazka (nie ma dowodu, ze dysk zyje)."""
    picks = pool.draw(n) if pool is not None else []
    cache: dict = {}
    ok = sum(1 for _aid, rel in picks if probe(rel, cache).get("state") == "jest")
    need_eff = min(int(need), len(picks))
    branches = len({_branch(rel.replace("\\", "/").lower()) for _aid, rel in picks})
    return {"n": len(picks), "ok": ok, "need": need_eff, "branches": branches,
            "passed": bool(picks) and ok >= need_eff}


class DiskUnavailable(Exception):
    """Kanarki nie przeszly: dysk M: jest niedostepny albo niepelny. Przebieg konczy sie bez usuniec."""


# --------------------------------------------------------------------------
# Pary folderow (przeniesienia)
# --------------------------------------------------------------------------


def detect_pairs(absent: list[dict], rows: dict, *, exclude_ids: Iterable[str] = ()) -> dict:
    """Wykrywanie przeniesien (spec 3.6). `absent` = pliki z odpowiedzia "nie ma", kazdy z polami
    asset_id, asset_key, mtime_ms i gone (sciezka wzgledna NAJWYZSZEGO folderu, ktory zniknal; '' =
    zniknal sam plik). `rows` = lustro (zywe wiersze nowych plikow).

    1. grupa = pliki pod najwyzszym zniknietym folderem; 2. kandydat = folder, pod ktorym ta sama
    sciezka wzgledna i nazwa ma >= 90 % plikow grupy; 3. para, gdy grupa >= 3 pliki i co najmniej
    polowa dopasowanych ma te sama date; 4. pliki dopasowane po sciezce wzglednej i nazwie.
    Zwraca {"map": {stary_id: nowy_id}, "pairs": [...]}."""
    groups: dict[str, list[dict]] = {}
    for r in absent:
        g = r.get("gone") or ""
        if g:
            groups.setdefault(asset_sync.key_of(g), []).append(r)
    out: dict[str, Any] = {"map": {}, "pairs": []}
    groups = {g: fs for g, fs in groups.items() if len(fs) >= PAIR_MIN_FILES}
    if not groups:
        return out
    skip = {r["asset_id"] for r in absent} | set(exclude_ids)
    by_name: dict[str, list[tuple[str, str, int]]] = {}
    for aid, row in rows.items():
        if row.get("deleted_at") is not None or aid in skip:
            continue
        k = str(row.get("asset_key") or "")
        by_name.setdefault(k.rsplit("/", 1)[-1], []).append((k, aid, int(row.get("mtime_ms") or 0)))
    for gk in sorted(groups):
        files = groups[gk]
        votes: dict[str, dict[str, tuple[str, int, int]]] = {}
        for f in files:
            k = str(f.get("asset_key") or "")
            if not k.startswith(gk + "/"):
                continue
            suffix = k[len(gk) + 1:]
            for ck, caid, cm in by_name.get(suffix.rsplit("/", 1)[-1], ()):
                if not ck.endswith("/" + suffix):
                    continue
                folder = ck[: -(len(suffix) + 1)]
                if folder == gk or folder.startswith(gk + "/"):
                    continue
                votes.setdefault(folder, {}).setdefault(f["asset_id"], (caid, cm, int(f.get("mtime_ms") or 0)))
        if not votes:
            continue
        best = min(votes, key=lambda fo: (-len(votes[fo]), fo))
        matched = votes[best]
        if len(matched) < PAIR_SHARE * len(files):
            continue
        same = sum(1 for (_caid, cm, om) in matched.values() if cm == om)
        if same < PAIR_SAME_MTIME * len(matched):
            continue
        for old_id, (new_id, _cm, _om) in matched.items():
            out["map"][old_id] = new_id
        out["pairs"].append({"from": gk, "to": best, "files": len(files), "matched": len(matched),
                             "same_mtime": same,
                             "cross_tree": gk.split("/", 1)[0] != best.split("/", 1)[0]})
    return out


# --------------------------------------------------------------------------
# Znaczniki usuniecia w partii (M6 / M16) i cofniecie (M8)
# --------------------------------------------------------------------------


def undo_batch(pg, writer: str | None, batch: str) -> list[str]:
    """M8: cala partia wraca jedna instrukcja. Rzuca wyjatek bazy (wolajacy raportuje)."""
    if not BATCH_RE.match(str(batch or "")):
        raise ValueError(f"zla nazwa partii: {batch!r}")
    cur = pg.cursor()
    try:
        begin_write(cur, writer, lock=True)
        cur.execute(M["M8"], {"batch": batch, "machine": str(writer or "").split(":")[0]})
        ids = [_cell(r, "asset_id") for r in cur.fetchall()]
        pg.commit()
    except Exception:
        _rollback(pg)
        raise
    return ids


def list_batches(pg) -> list[dict]:
    cur = pg.cursor()
    cur.execute(M["M9"])
    out = [{"batch": _cell(r, "delete_batch", 0), "files": int(_cell(r, "files", 1)),
            "first_ms": int(_cell(r, "first_ms", 2)), "last_ms": int(_cell(r, "last_ms", 3)),
            "by": _cell(r, "by", 4)} for r in cur.fetchall()]
    _rollback(pg)
    return out


def delete_batch(pg, *, writer: str, machine: str, sql: str, items: list[dict], batch: str,
                 pool: CanaryPool | None = None, probe: Callable[..., dict] | None = None,
                 canary_need: int = CANARY_OK, cap: int | None = None,
                 commit_every: int | None = None) -> dict:
    """Znaczniki usuniecia plik po pliku, kazdy w osobnym SAVEPOINT (zla instrukcja trafia do raportu i
    nie wycofuje paczki). `items`: {asset_id, mirror_mtime, wait_ms, new_id?}. Paczki po `commit_every`
    zatwierdzane dopiero po sprawdzeniu kanarkow; porazka wycofuje transakcje w toku i cofa M8 to, co
    juz zatwierdzone w tej partii. Zwraca {deleted, refused, moved, errors, aborted, undone, canary}."""
    out: dict[str, Any] = {"deleted": 0, "refused": 0, "moved": 0, "errors": [], "aborted": "",
                           "undone": 0, "committed": 0, "canary": None}
    commit_every = int(commit_every or DELETE_COMMIT_EVERY)   # stala czytana w chwili wywolania (testy ja skracaja)
    cur = pg.cursor()
    in_tx = 0
    started = False

    def canary_ok() -> bool:
        if pool is None or probe is None:
            return True
        c = run_canaries(pool, probe, need=canary_need)
        out["canary"] = c
        return c["passed"]

    try:
        for it in items:
            if cap is not None and out["committed"] + in_tx >= cap:
                break
            if not started:
                begin_write(cur, writer, lock=True)
                started = True
            cur.execute("SAVEPOINT dam_del")
            try:
                cur.execute(sql, {"asset_id": it["asset_id"], "machine": machine, "batch": batch,
                                  "mirror_mtime": int(it["mirror_mtime"]), "wait_ms": int(it["wait_ms"])})
                row = cur.fetchone()
                if row is None:
                    cur.execute("RELEASE SAVEPOINT dam_del")
                    out["refused"] += 1
                    if out["refused"] >= REFUSE_STOP:
                        out["aborted"] = "refused_limit"
                        break
                    continue
                if it.get("new_id"):
                    cur.execute(M["M7"], {"old_id": it["asset_id"], "new_id": it["new_id"], "machine": machine})
                    out["moved"] += max(0, cur.rowcount)
                cur.execute("RELEASE SAVEPOINT dam_del")
            except asset_sync._DATA_ERRORS as exc:  # noqa: SLF001 - ta sama definicja "bledu danych" co w push_ops
                cur.execute("ROLLBACK TO SAVEPOINT dam_del")
                out["errors"].append({"asset_id": it["asset_id"], "error": asset_sync._classify(exc),  # noqa: SLF001
                                      "detail": (str(exc).splitlines() or [""])[0][:200]})
                continue
            in_tx += 1
            if in_tx >= commit_every:
                if not canary_ok():
                    raise DiskUnavailable()
                pg.commit()
                out["committed"] += in_tx
                in_tx = 0
                started = False
        if started:
            if in_tx and not canary_ok():
                raise DiskUnavailable()
            pg.commit()
            out["committed"] += in_tx
            in_tx = 0
        out["deleted"] = out["committed"]
    except DiskUnavailable:
        _rollback(pg)
        out["aborted"] = "disk_unavailable"
        if out["committed"]:
            try:
                out["undone"] = len(undo_batch(pg, writer, batch))
            except Exception as exc:  # noqa: BLE001
                out["errors"].append({"asset_id": "", "error": "undo_failed", "detail": str(exc)[:200]})
        out["deleted"] = 0
    except Exception as exc:  # noqa: BLE001 - polaczenie, blokada, limit czasu: transakcja w toku przepada
        _rollback(pg)
        out["aborted"] = "error"
        out["error"] = str(exc)[:300]
        out["deleted"] = out["committed"]
    return out


# --------------------------------------------------------------------------
# Drugie sprawdzenie
# --------------------------------------------------------------------------


def _folder_counts(rows: dict) -> dict[str, int]:
    """Liczba zywych plikow znanych lustru pod kazdym folderem (po kluczu)."""
    counts: dict[str, int] = {}
    for row in rows.values():
        if row.get("deleted_at") is not None:
            continue
        for anc in asset_sync._ancestors(str(row.get("asset_key") or "")):  # noqa: SLF001
            counts[anc] = counts.get(anc, 0) + 1
    return counts


def _hold_folder(key: str, marked_under: dict[str, int], known: dict[str, int]) -> str:
    """Najwyzszy przodek, w ktorym oznaczonych jest > 20 % znanych plikow i co najmniej 10 ('' = brak)."""
    for anc in reversed(asset_sync._ancestors(key)):  # noqa: SLF001 - od korzenia w dol
        if not anc:
            continue
        n = known.get(anc, 0)
        if n >= asset_sync.SUBTREE_MIN_FILES and marked_under.get(anc, 0) / n > asset_sync.SUBTREE_SHRINK_LIMIT:
            return anc
    return ""


def _present_chunks(pg, cur, writer: str, ids: list[str]) -> int:
    n = 0
    for i in range(0, len(ids), STAMP_BATCH):
        begin_write(cur, writer, lock=False)
        cur.execute(M["M5"], {"ids": ids[i:i + STAMP_BATCH]})
        n += max(0, cur.rowcount)
        pg.commit()
    return n


def _probe_all(rows_to_probe: list[dict], probe, cache: dict, pool: CanaryPool | None, rep: dict,
               *, canary_need: int = CANARY_OK) -> tuple[list[dict], list[str]]:
    """Sonduje kazdy plik; co CANARY_EVERY sond sprawdza kanarki (porazka = DiskUnavailable).
    Zwraca (lista "nie ma" z polami gone / empty_parent, lista id z odpowiedzia "jest")."""
    absent: list[dict] = []
    present: list[str] = []
    for i, r in enumerate(rows_to_probe, 1):
        if i % CANARY_EVERY == 0:
            c = run_canaries(pool, probe, need=canary_need)
            rep["canary"] = c
            if not c["passed"]:
                raise DiskUnavailable()
        res = probe(r["path_rel"], cache)
        rep["probed"] += 1
        st = res.get("state")
        if st == "jest":
            present.append(r["asset_id"])
            rep["present"] += 1
        elif st == "nie_ma":
            absent.append({**r, "gone": res.get("gone", ""), "empty_parent": bool(res.get("empty_parent"))})
            rep["absent"] += 1
        else:
            rep["unreachable"] += 1
    return absent, present


def _witness_sha(ids: list[str]) -> str:
    return hashlib.sha1("\n".join(sorted(ids)).encode("utf-8")).hexdigest()


def new_report(mode: str, apply: bool) -> dict:
    return {"ok": True, "mode": mode, "apply": bool(apply), "marked": 0, "claimed": 0, "probed": 0,
            "present": 0, "absent": 0, "unreachable": 0, "ready": 0, "held": 0, "holds": [],
            "deleted": 0, "would_delete": 0, "refused": 0, "version_mismatch": 0, "deferred_by_cap": 0,
            "skipped_not_m": 0, "batch": "", "last_batch": "", "witness": None, "witness_tripped": False,
            "canary": None, "pairs": [], "moved_links": 0, "errors": [], "error": ""}


def confirm_pass(pg, rows: dict, **kw) -> dict:
    """Drugie sprawdzenie "brakuje od" (spec 3.3). `rows` = lustro wierszy tego komputera (wiersze z M11).
    Z apply=False (tryb shadow, proba na sucho) niczego nie usuwa, tylko liczy, co by usunal.
    Nie rzuca wyjatkow z bazy ani z dysku: wynik z ok False i polem error.
    Pola raportu: missing_marked = ile plikow zostalo oznaczonych PO przebiegu (oznaczone - usuniete - przywrocone)."""
    rep = _confirm_pass(pg, rows, **kw)
    if rep.get("marked"):
        rep["missing_marked"] = max(0, int(rep["marked"]) - int(rep.get("deleted") or 0) - int(rep.get("present") or 0))
    return rep


def _confirm_pass(pg, rows: dict, *, root: str, machine: str, cfg: dict, apply: bool = True,
                  probe: Callable[..., dict] | None = None, rng: random.Random | None = None,
                  limit: int = CLAIM_LIMIT) -> dict:
    rep = new_report(str(cfg.get("mode") or "on"), apply)
    writer = writer_of(machine, asset_sync.ROLE_M)
    cur = pg.cursor()
    confirm_ms = int(cfg.get("confirm_ms", DEFAULT_RULES["confirm_ms"]))
    hold_ms = int(cfg.get("hold_ms", DEFAULT_RULES["hold_ms"]))
    max_files = int(cfg.get("batch_max_files", DEFAULT_RULES["batch_max_files"]))
    try:
        cur.execute(M["M10"])
        marked_n = int(_cell(cur.fetchone(), "marked"))
        rep["missing_marked"] = marked_n
        rep["marked"] = marked_n
        now_ms = db_now(cur)
        cur.execute(M["M13"])
        wrow = cur.fetchone()
        wstate = None
        if wrow is not None:
            try:
                wstate = json.loads(_cell(wrow, "value"))
            except (TypeError, ValueError):
                wstate = None
        _rollback(pg)
        live_n = sum(1 for r in rows.values() if r.get("deleted_at") is None)
        witness_on = marked_n >= WITNESS_MIN and marked_n > WITNESS_SHARE * max(1, live_n)
        if marked_n == 0 or not witness_on:
            if wstate is not None and apply:     # liczba oznaczonych spadla ponizej progu: koniec swiadka (M14)
                begin_write(cur, writer, lock=False)
                cur.execute(M["M14"])
                pg.commit()
                wstate = None
        if marked_n == 0:
            return rep
        probe_fn = _probe_fn(root, probe)
        cur.execute(M["M18"])
        marked_rows = [dict(r) if hasattr(r, "keys") else r for r in cur.fetchall()]
        _rollback(pg)
        marked_ids = {r["asset_id"] for r in marked_rows}
        pool = CanaryPool(((aid, str(r.get("path_rel") or ""), str(r.get("asset_key") or ""))
                           for aid, r in rows.items()
                           if r.get("deleted_at") is None and r.get("origin") == "m" and aid not in marked_ids
                           and r.get("path_rel")), rng)
        need = CANARIES if witness_on else CANARY_OK
        c0 = run_canaries(pool, probe_fn, need=need)
        rep["canary"] = c0
        if not c0["passed"]:
            rep["ok"] = False
            rep["error"] = "disk_unavailable"
            return rep
        if witness_on:
            rep["witness_tripped"] = True
            _witness_pass(pg, cur, rows, rep, marked_rows=marked_rows, pool=pool, probe=probe_fn, writer=writer,
                          machine=machine, cfg=cfg, apply=apply, wstate=wstate, now_ms=now_ms, max_files=max_files)
            return rep
        _normal_pass(pg, cur, rows, rep, marked_rows=marked_rows, pool=pool, probe=probe_fn, writer=writer,
                     machine=machine, apply=apply, confirm_ms=confirm_ms, hold_ms=hold_ms, max_files=max_files,
                     recheck_ms=(LEASE_MS if apply else SHADOW_RECHECK_MS), limit=limit,
                     marked_n=marked_n)
    except DiskUnavailable:
        _rollback(pg)
        rep["ok"] = False
        rep["error"] = "disk_unavailable"
    except Exception as exc:  # noqa: BLE001 - baza / siec / dysk: raport, nie wyjatek; oznaczenia zostaja
        _rollback(pg)
        rep["ok"] = False
        rep["error"] = f"{type(exc).__name__}: {exc}"[:300]
    return rep


def _probe_fn(root: str, probe: Callable[..., dict] | None) -> Callable[..., dict]:
    if probe is not None:
        return probe
    asset_sync._asset_ids()  # noqa: SLF001 - dopisuje apps/web/scripts do sys.path
    import scan_walker  # noqa: PLC0415

    return lambda rel, cache=None: scan_walker.probe_file(root, rel, cache)


def _mirror_ok(rows: dict, r: dict) -> int | None:
    """Kontrakt T: usuwamy wersje, ktora znal sprawdzajacy - mtime z lustra musi zgadzac sie z baza."""
    m = rows.get(r["asset_id"])
    if m is None or m.get("deleted_at") is not None:
        return None
    return int(m.get("mtime_ms") or 0) if int(m.get("mtime_ms") or 0) == int(r.get("mtime_ms") or 0) else None


def _normal_pass(pg, cur, rows, rep, *, marked_rows, pool, probe, writer, machine, apply, confirm_ms, hold_ms,
                 max_files, recheck_ms, limit, marked_n) -> None:
    begin_write(cur, writer, lock=False)
    cur.execute(M["M4"], {"confirm_ms": confirm_ms, "recheck_ms": recheck_ms, "limit": limit})
    claimed = [dict(r) if hasattr(r, "keys") else r for r in cur.fetchall()]
    pg.commit()
    rep["claimed"] = len(claimed)
    # wiersze sprzed 1a (oznaczone narzedziem uzgodnienia) zostaja narzedziu: tu tylko origin = 'm'
    mine = [r for r in claimed if r.get("origin") == "m"]
    rep["skipped_not_m"] = len(claimed) - len(mine)
    if not mine:
        return
    absent, present = _probe_all(mine, probe, {}, pool, rep)
    if present:
        _present_chunks(pg, cur, writer, present)
    if not absent:
        return
    known = _folder_counts(rows)
    marked_under: dict[str, int] = {}
    for r in marked_rows:
        for anc in asset_sync._ancestors(str(r.get("asset_key") or "")):  # noqa: SLF001
            marked_under[anc] = marked_under.get(anc, 0) + 1
    now_ms = db_now(cur)
    _rollback(pg)
    holds: dict[str, dict] = {}
    ready: list[dict] = []
    for r in absent:
        folder = _hold_folder(str(r.get("asset_key") or ""), marked_under, known)
        held = bool(folder) or bool(r.get("empty_parent"))
        wait = hold_ms if held else confirm_ms
        r["wait_ms"] = wait
        if held:
            h = holds.setdefault(folder or "(pusty folder)", {"folder": folder or "(pusty folder)", "gone": 0,
                                                              "known": known.get(folder, 0), "release_at": 0})
            h["gone"] += 1
            h["release_at"] = max(h["release_at"], int(r.get("missing_since_ms") or 0) + hold_ms)
            rep["held"] += 1
        if now_ms - int(r.get("missing_since_ms") or 0) >= wait:
            ready.append(r)
    rep["holds"] = sorted(holds.values(), key=lambda h: -h["gone"])[:50]
    items = []
    for r in ready:
        mm = _mirror_ok(rows, r)
        if mm is None:
            rep["version_mismatch"] += 1
            continue
        items.append({"asset_id": r["asset_id"], "mirror_mtime": mm, "wait_ms": r["wait_ms"], "_r": r})
    rep["ready"] = len(items)
    if len(items) > max_files:
        rep["deferred_by_cap"] = len(items) - max_files
        items = items[:max_files]
    if not items:
        return
    pairs = detect_pairs([it["_r"] for it in items], rows, exclude_ids=marked_ids_of(marked_rows))
    rep["pairs"] = pairs["pairs"]
    for it in items:
        it["new_id"] = pairs["map"].get(it["asset_id"])
        it.pop("_r", None)
    if not apply:
        rep["would_delete"] = len(items)
        return
    batch = f"c-{now_ms}-{_safe_machine(machine)}"
    res = delete_batch(pg, writer=writer, machine=machine, sql=M["M6"], items=items, batch=batch,
                       pool=pool, probe=probe, cap=max_files)
    _apply_delete_result(rep, res, batch)


def marked_ids_of(marked_rows: list[dict]) -> set[str]:
    return {r["asset_id"] for r in marked_rows}


def _apply_delete_result(rep: dict, res: dict, batch: str) -> None:
    rep["deleted"] = res["deleted"]
    rep["refused"] += res["refused"]
    rep["moved_links"] = res["moved"]
    rep["errors"].extend(res["errors"][:20])
    if res.get("canary") is not None:
        rep["canary"] = res["canary"]
    if res["deleted"]:
        rep["batch"] = rep["last_batch"] = batch
    if res["aborted"] in ("disk_unavailable", "error"):
        rep["ok"] = False
        rep["error"] = res["aborted"] if res["aborted"] == "disk_unavailable" else res.get("error", "error")
        rep["undone"] = res.get("undone", 0)


def _witness_pass(pg, cur, rows, rep, *, marked_rows, pool, probe, writer, machine, cfg, apply, wstate, now_ms,
                  max_files) -> None:
    """Swiadek (O1, P4): usuniecia wstrzymane; seria sond obejmuje WSZYSTKIE oznaczone pliki; usuniecie po
    trzech zgodnych seriach w 60 minut i przy 20 z 20 kanarkow, partiami po najwyzej `max_files`."""
    confirm_ms = int(cfg.get("confirm_ms", DEFAULT_RULES["confirm_ms"]))
    mine = [r for r in marked_rows if r.get("origin") == "m"]
    rep["skipped_not_m"] = len(marked_rows) - len(mine)
    last_ms = int((wstate or {}).get("last_ms") or 0)
    if wstate is not None and now_ms - last_ms < WITNESS_GAP_MS:
        rep["witness"] = _witness_view(wstate, now_ms)
        return
    absent, present = _probe_all(mine, probe, {}, pool, rep, canary_need=CANARIES)
    if present:
        _present_chunks(pg, cur, writer, present)
    ids = [r["asset_id"] for r in absent]
    sha = _witness_sha(ids)
    if apply:
        begin_write(cur, writer, lock=False)
        cur.execute(M["M12"], {"count": len(ids), "sha": sha, "machine": machine,
                               "min_gap_ms": WITNESS_GAP_MS, "window_ms": WITNESS_WINDOW_SLACK_MS})
        value = json.loads(_cell(cur.fetchone(), "value"))
        pg.commit()
    else:   # shadow: ten sam rachunek bez zapisu
        value = {"since_ms": now_ms, "last_ms": now_ms, "series": 1, "count": len(ids), "sha": sha, "by": machine}
        if wstate is not None and wstate.get("sha") == sha and now_ms - int(wstate.get("since_ms") or 0) <= WITNESS_WINDOW_SLACK_MS:
            value["series"] = int(wstate.get("series") or 1) + 1
            value["since_ms"] = int(wstate.get("since_ms") or now_ms)
    rep["witness"] = _witness_view(value, now_ms)
    series = int(value.get("series") or 1)
    if series < WITNESS_SERIES or not absent:
        return
    items = []
    for r in sorted(absent, key=lambda x: x["asset_id"]):
        mm = _mirror_ok(rows, r)
        if mm is None:
            rep["version_mismatch"] += 1
            continue
        items.append({"asset_id": r["asset_id"], "mirror_mtime": mm, "wait_ms": confirm_ms, "_r": r})
    rep["ready"] = len(items)
    if len(items) > max_files:
        rep["deferred_by_cap"] = len(items) - max_files
        items = items[:max_files]
    if not items:
        return
    pairs = detect_pairs([it["_r"] for it in items], rows, exclude_ids=marked_ids_of(marked_rows))
    rep["pairs"] = pairs["pairs"]
    for it in items:
        it["new_id"] = pairs["map"].get(it["asset_id"])
        it.pop("_r", None)
    if not apply:
        rep["would_delete"] = len(items)
        return
    c = run_canaries(pool, probe, need=CANARIES)   # przy swiadku 20 z 20
    rep["canary"] = c
    if not c["passed"]:
        rep["ok"] = False
        rep["error"] = "disk_unavailable"
        return
    batch = f"w-{now_ms}-{series}"
    res = delete_batch(pg, writer=writer, machine=machine, sql=M["M6"], items=items, batch=batch,
                       pool=pool, probe=probe, canary_need=CANARIES, cap=max_files)
    _apply_delete_result(rep, res, batch)


def _witness_view(value: dict, now_ms: int) -> dict:
    last = int(value.get("last_ms") or now_ms)
    return {"since_ms": int(value.get("since_ms") or now_ms), "series": int(value.get("series") or 1),
            "count": int(value.get("count") or 0), "next_at": last + WITNESS_RECHECK_MS}


def refresh_catalog_count(pg, machine: str, writer: str | None, *, min_age_ms: int = 86400000) -> dict | None:
    """M17: dokladna liczba zywych wierszy dla hamulca partii w bazie. Raz na dobe w zwyklej pracy
    (min_age_ms = 86400000); narzedzie uzgodnienia przed --mark i po --confirm (0). Blad = None."""
    cur = pg.cursor()
    try:
        begin_write(cur, writer, lock=False)
        cur.execute(M["M17"], {"machine": machine, "min_age_ms": int(min_age_ms)})
        row = cur.fetchone()
        pg.commit()
        return json.loads(_cell(row, "value")) if row else None
    except Exception:  # noqa: BLE001
        _rollback(pg)
        return None
