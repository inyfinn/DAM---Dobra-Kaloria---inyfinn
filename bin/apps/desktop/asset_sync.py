# -*- coding: utf-8 -*-
"""Faza 2 "jedno zrodlo prawdy": scalanie indeksu materialow jak Synology Drive.

Baza (PostgreSQL na Synology, tabela dam_assets) trzyma JEDEN wiersz na material.
Kazdy komputer z folderem Marketing (ROOT) skanuje dysk i wysyla tylko roznice;
komputer bez ROOT tylko pobiera (rev > ostatni) i buduje z tego lokalny indeks.

Modul NIE jest wpiety w aplikacje (decyzja kierownika) - to czysta logika:
- diff_scan / diff_scan_report: skan lokalny + stan z bazy -> operacje
  (upsert / tombstone / restore) z bezpiecznikami na niepelny odczyt dysku,
- apply_remote: pobrane wiersze -> nowy lokalny stan,
- warstwa PG przez przekazany obiekt polaczenia (DB-API, kursor zwraca dict jak
  RealDictCursor): ensure_schema, push_ops, pull_since.

Reguly (szczegoly i uzasadnienie: bin/docs/PLAN-jedno-zrodlo-prawdy.md, Faza 2):
1. Dodanie/zmiana: upsert, gdy mtime nowszy albo przy tym samym mtime inny rozmiar
   (remis rozstrzyga rev: wygrywa zapis, ktory znal najnowszy rev).
   Starszy mtime NIGDY nie nadpisuje nowszego (nieaktualna kopia X: nic nie cofa).
2. Usuniecie (tombstone) tylko gdy:
   - ten komputer widzial plik w swoim poprzednim skanie (last_seen) - komputer
     usuwa tylko to, co sam mial (jak klient Synology); pierwszy skan nie usuwa nic,
   - najblizszy istniejacy folder nadrzedny zostal wylistowany w calosci bez bledu
     (scanned_dirs), a zaden folder po drodze nie jest w failed_dirs,
   - wpis w bazie ma mtime <= czas skanu i <= mtime wersji, ktora ten komputer znal,
   - bezpiecznik poddrzewa: jesli w istniejacym (wylistowanym) folderze znika > 20 %
     plikow (min. SUBTREE_MIN_FILES), usuniec z tego poddrzewa nie wysylamy.
3. Przywrocenie: plik znow widziany -> deleted_at NULL. Ta sama wersja (mtime nie
   nowszy) wraca tylko, gdy "pojawila sie" na tym komputerze (nie bylo jej w
   last_seen) - nieaktualna kopia, ktora komputer mial caly czas, nie wskrzesza
   pliku usunietego gdzie indziej.
4. Komputer bez ROOT: tylko pull_since + apply_remote + live_entries.
"""
from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any, Iterable

SUBTREE_SHRINK_LIMIT = 0.20   # > 20 % znikajacych plikow poddrzewa = podejrzany odczyt
SUBTREE_MIN_FILES = 10        # mniejsze poddrzewa nie sa oceniane (1 z 3 plikow to 33 %)
PUSH_COMMIT_EVERY = 500
PULL_BATCH = 2000
ADVISORY_LOCK_KEY = 736420921  # staly klucz blokady zapisow do dam_assets

OP_UPSERT = "upsert"
OP_TOMBSTONE = "tombstone"
OP_RESTORE = "restore"

ROW_FIELDS = ("asset_id", "asset_key", "path_rel", "name", "size", "mtime_ms",
              "content_hash", "meta", "deleted_at", "updated_at", "updated_by",
              "seen_by_machine", "rev")

# --------------------------------------------------------------------------
# Klucze sciezek (zrodlo prawdy: bin/apps/web/scripts/asset_ids.py)
# --------------------------------------------------------------------------

_asset_ids_mod: Any = None


def _asset_ids() -> Any:
    """asset_ids.py z apps/web/scripts (ten sam uklad w repo i w instalacji)."""
    global _asset_ids_mod
    if _asset_ids_mod is None:
        scripts = Path(__file__).resolve().parent.parent / "web" / "scripts"
        if str(scripts) not in sys.path:
            sys.path.insert(0, str(scripts))
        import asset_ids  # noqa: PLC0415

        _asset_ids_mod = asset_ids
    return _asset_ids_mod


def key_of(path: str) -> str:
    """Klucz sciezki niezalezny od litery dysku (asset_ids.asset_key)."""
    return _asset_ids().asset_key(path)


def id_of(path: str) -> str:
    return _asset_ids().stable_asset_id(path)


def dir_key(path: str, root: str | None = None) -> str:
    """Klucz folderu dla scanned_dirs / failed_dirs. Korzen Marketingu = ''.

    Z `root` liczy sciezke wzgledna (dziala tez dla X:/Marketing, gdzie sam
    asset_key nie wie, ze 'marketing' to korzen)."""
    p = unicodedata.normalize("NFC", str(path or "")).replace("\\", "/")
    if root is not None:
        r = unicodedata.normalize("NFC", str(root)).replace("\\", "/").rstrip("/")
        if p.casefold() == r.casefold():
            return ""
        if p.casefold().startswith(r.casefold() + "/"):
            return re.sub(r"/{2,}", "/", p[len(r) + 1:]).casefold().strip("/")
    return key_of(p)


def scan_entry(path: str, *, size: int | None, mtime_ms: int, root: str | None = None,
               meta: dict | None = None, content_hash: str | None = None) -> tuple[str, dict]:
    """Pomocnik dla skanera: (asset_id, wpis skanu) z bezwzglednej sciezki pliku."""
    key = dir_key(path, root)
    p = unicodedata.normalize("NFC", str(path)).replace("\\", "/")
    rel = p
    if root is not None:
        r = unicodedata.normalize("NFC", str(root)).replace("\\", "/").rstrip("/")
        if p.casefold().startswith(r.casefold() + "/"):
            rel = p[len(r) + 1:]
    return id_of(key), {
        "asset_key": key,
        "path_rel": rel,
        "name": p.rsplit("/", 1)[-1],
        "size": size,
        "mtime_ms": int(mtime_ms),
        "content_hash": content_hash,
        "meta": dict(meta or {}),
    }


def _parent(key: str) -> str:
    return key.rsplit("/", 1)[0] if "/" in key else ""


def _ancestors(key: str) -> list[str]:
    """Foldery nadrzedne od najblizszego do korzenia ('')."""
    out = []
    k = key
    while True:
        k = _parent(k) if k else None  # type: ignore[assignment]
        if k is None:
            break
        out.append(k)
        if k == "":
            break
    return out


def _int(v: Any, default: int = 0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _opt_int(v: Any) -> int | None:
    try:
        return None if v is None else int(v)
    except (TypeError, ValueError):
        return None


def _now_ms() -> int:
    return int(time.time() * 1000)


# --------------------------------------------------------------------------
# Scalanie: skan -> operacje
# --------------------------------------------------------------------------

def _op(kind: str, aid: str, entry: dict, prev: dict | None, machine: str,
        scan_time_ms: int, reason: str) -> dict:
    return {
        "op": kind,
        "reason": reason,
        "asset_id": aid,
        "asset_key": str(entry.get("asset_key") or (prev or {}).get("asset_key") or ""),
        "path_rel": str(entry.get("path_rel") or (prev or {}).get("path_rel") or ""),
        "name": str(entry.get("name") or (prev or {}).get("name") or ""),
        "size": _opt_int(entry.get("size")),
        "mtime_ms": _int(entry.get("mtime_ms")),
        "content_hash": entry.get("content_hash"),
        "meta": dict(entry.get("meta") or {}),
        "base_rev": _int((prev or {}).get("rev")),
        "base_mtime_ms": _int((prev or {}).get("mtime_ms")),
        "scan_time_ms": int(scan_time_ms),
        "machine": machine,
    }


def _content_differs(entry: dict, prev: dict) -> bool:
    if _opt_int(entry.get("size")) != _opt_int(prev.get("size")):
        return True
    h_new, h_old = entry.get("content_hash"), prev.get("content_hash")
    return bool(h_new and h_old and h_new != h_old)


def diff_scan_report(prev_rows: dict, scan: dict, scanned_dirs: Iterable[str],
                     scan_time_ms: int, machine: str, *,
                     last_seen: Iterable[str] | None = None,
                     failed_dirs: Iterable[str] = (),
                     confirmed_dirs: Iterable[str] = ()) -> dict:
    """Pelny raport scalania.

    prev_rows    asset_id -> wiersz z bazy (lokalne lustro po ostatnim pull; tombstony tez)
    scan         asset_id -> wpis skanu (asset_key, path_rel, name, size, mtime_ms, meta)
    scanned_dirs klucze folderow wylistowanych w calosci bez bledu ('' = korzen)
    failed_dirs  klucze folderow, ktore istnieja, ale nie zostaly wylistowane
                 (blad, brak dostepu, wykluczenie) - nic pod nimi nie jest usuwane
    last_seen    asset_id widziane przez TEN komputer w poprzednim skanie;
                 None = pierwszy skan -> zero usuniec
    confirmed_dirs klucze folderow, ktore admin potwierdzil jako prawdziwe usuniecie -
                 pliki pod nimi NIE podlegaja bezpiecznikowi poddrzewa (pkt 3 nizej).
                 Pozostale warunki usuniecia (last_seen, scanned_dirs, mtime) nadal
                 obowiazuja. Domyslnie puste = zachowanie bez zmian.

    Zwraca {"ops", "blocked": {folder: liczba}, "skipped_unlisted", "stale_ignored",
            "next_last_seen"}.
    """
    listed = {str(d) for d in scanned_dirs}
    failed = {str(d) for d in failed_dirs}
    confirmed = {str(d) for d in confirmed_dirs}
    seen_before = None if last_seen is None else set(last_seen)
    ops: list[dict] = []
    stale_ignored = 0

    # 1) pliki widziane w skanie: dodanie / zmiana / przywrocenie
    for aid in sorted(scan):
        entry = scan[aid] or {}
        prev = prev_rows.get(aid)
        mt = _int(entry.get("mtime_ms"))
        if prev is None:
            ops.append(_op(OP_UPSERT, aid, entry, None, machine, scan_time_ms, "add"))
            continue
        pmt = _int(prev.get("mtime_ms"))
        if prev.get("deleted_at") is not None:
            if mt > pmt or (mt == pmt and _content_differs(entry, prev)):
                ops.append(_op(OP_UPSERT, aid, entry, prev, machine, scan_time_ms, "recreate"))
            elif seen_before is not None and aid not in seen_before:
                ops.append(_op(OP_RESTORE, aid, entry, prev, machine, scan_time_ms, "reappeared"))
            else:
                stale_ignored += 1  # nieaktualna kopia, ktora komputer mial caly czas
            continue
        if mt > pmt or (mt == pmt and _content_differs(entry, prev)):
            ops.append(_op(OP_UPSERT, aid, entry, prev, machine, scan_time_ms, "change"))
        elif mt < pmt:
            stale_ignored += 1  # starsza wersja (np. X: jeszcze nie zsynchronizowany)

    # 2) kandydaci do usuniecia
    candidates: list[str] = []
    skipped_unlisted = 0
    keep_seen: set[str] = set()
    if seen_before is not None:
        for aid in seen_before:
            if aid in scan:
                continue
            prev = prev_rows.get(aid)
            if prev is None or prev.get("deleted_at") is not None:
                continue  # juz usuniety (albo nieznany) - nic do roboty
            key = str(prev.get("asset_key") or "")
            ok = False
            for anc in _ancestors(key):
                if anc in failed:
                    break
                if anc in listed:
                    ok = True
                    break
            if not ok:
                skipped_unlisted += 1
                keep_seen.add(aid)
                continue
            pmt = _int(prev.get("mtime_ms"))
            if pmt > int(scan_time_ms):
                keep_seen.add(aid)
                continue
            candidates.append(aid)

    # 3) bezpiecznik poddrzew: tylko foldery, ktore istnieja (zostaly wylistowane)
    blocked: dict[str, int] = {}
    if candidates:
        live_under: dict[str, int] = {}
        for aid, row in prev_rows.items():
            if row.get("deleted_at") is not None:
                continue
            if seen_before is not None and aid not in seen_before:
                continue  # oceniamy tylko pliki, ktore ten komputer mial
            for anc in _ancestors(str(row.get("asset_key") or "")):
                if anc in listed:
                    live_under[anc] = live_under.get(anc, 0) + 1
        gone_under: dict[str, int] = {}
        for aid in candidates:
            for anc in _ancestors(str(prev_rows[aid].get("asset_key") or "")):
                if anc in listed:
                    gone_under[anc] = gone_under.get(anc, 0) + 1
        bad = {d for d, gone in gone_under.items()
               if live_under.get(d, 0) >= SUBTREE_MIN_FILES
               and gone / live_under[d] > SUBTREE_SHRINK_LIMIT}
        for aid in candidates:
            prev = prev_rows[aid]
            ancestors = _ancestors(str(prev.get("asset_key") or ""))
            if not any(a in confirmed for a in ancestors):
                hit = [a for a in ancestors if a in bad]
                if hit:
                    top = hit[-1]  # najwyzszy podejrzany folder - czytelniej w raporcie
                    blocked[top] = blocked.get(top, 0) + 1
                    keep_seen.add(aid)
                    continue
            ops.append(_op(OP_TOMBSTONE, aid, {}, prev, machine, scan_time_ms, "missing"))
            ops[-1]["mtime_ms"] = _int(prev.get("mtime_ms"))
            ops[-1]["size"] = _opt_int(prev.get("size"))

    next_seen = set(scan) | keep_seen
    return {"ops": ops, "blocked": blocked, "skipped_unlisted": skipped_unlisted,
            "stale_ignored": stale_ignored, "next_last_seen": next_seen}


def diff_scan(prev_rows: dict, scan: dict, scanned_dirs: Iterable[str], scan_time_ms: int,
              machine: str, *, last_seen: Iterable[str] | None = None,
              failed_dirs: Iterable[str] = (), confirmed_dirs: Iterable[str] = ()) -> list[dict]:
    """Lista operacji (upsert / tombstone / restore) - patrz diff_scan_report."""
    return diff_scan_report(prev_rows, scan, scanned_dirs, scan_time_ms, machine,
                            last_seen=last_seen, failed_dirs=failed_dirs,
                            confirmed_dirs=confirmed_dirs)["ops"]


# --------------------------------------------------------------------------
# Lokalny stan z bazy
# --------------------------------------------------------------------------

def normalize_row(row: Any) -> dict:
    """Wiersz z PG (dict / RealDictRow) -> zwykly dict; meta zawsze dict."""
    d = {k: (row.get(k) if hasattr(row, "get") else None) for k in ROW_FIELDS}
    meta = d.get("meta")
    if isinstance(meta, (str, bytes)):
        try:
            meta = json.loads(meta)
        except ValueError:
            meta = {}
    d["meta"] = meta if isinstance(meta, dict) else {}
    d["rev"] = _int(d.get("rev"))
    d["mtime_ms"] = _int(d.get("mtime_ms"))
    d["size"] = _opt_int(d.get("size"))
    d["deleted_at"] = _opt_int(d.get("deleted_at"))
    return d


def apply_remote(local_rows: dict, remote_rows: Iterable[Any]) -> dict:
    """Nowy lokalny stan: wiersz z bazy zastepuje lokalny, gdy ma wiekszy rev.

    Tombstony zostaja w stanie (diff_scan musi wiedziec, ze plik usunieto);
    do budowy indeksu sluzy live_entries(). Wejscie nie jest modyfikowane."""
    out = dict(local_rows)
    for raw in remote_rows or ():
        try:
            row = normalize_row(raw)
        except Exception:  # noqa: BLE001 - uszkodzony wiersz nie psuje reszty
            continue
        aid = row.get("asset_id")
        if not aid:
            continue
        mine = out.get(aid)
        if mine is None or _int(mine.get("rev")) < row["rev"]:
            out[aid] = row
    return out


def max_rev(rows: dict) -> int:
    return max((_int(r.get("rev")) for r in rows.values()), default=0)


def live_entries(rows: dict, root: str | None = None) -> list[dict]:
    """Wpisy do lokalnego branding-index (bez usunietych), posortowane po kluczu."""
    out = []
    base = None if root is None else str(root).replace("\\", "/").rstrip("/")
    for aid in sorted(rows, key=lambda a: str(rows[a].get("asset_key") or "")):
        r = rows[aid]
        if r.get("deleted_at") is not None:
            continue
        e = dict(r.get("meta") or {})
        rel = str(r.get("path_rel") or r.get("asset_key") or "")
        e.update({
            "id": aid,
            "path": f"{base}/{rel}" if base is not None else rel,
            "name": r.get("name") or rel.rsplit("/", 1)[-1],
            "size": r.get("size"),
            "mtime_ms": r.get("mtime_ms"),
        })
        out.append(e)
    return out


# --------------------------------------------------------------------------
# PostgreSQL (polaczenie przekazywane z zewnatrz: pg_db.connect() w aplikacji,
# atrapa w testach). Placeholdery %s, kursor zwraca dict (RealDictCursor).
# --------------------------------------------------------------------------

PG_DDL = """
CREATE SEQUENCE IF NOT EXISTS dam_assets_rev_seq;
CREATE TABLE IF NOT EXISTS dam_assets (
  asset_id TEXT PRIMARY KEY,
  asset_key TEXT NOT NULL,
  path_rel TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  size BIGINT,
  mtime_ms BIGINT NOT NULL DEFAULT 0,
  content_hash TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at BIGINT,
  updated_at BIGINT NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT '',
  seen_by_machine TEXT NOT NULL DEFAULT '',
  rev BIGINT NOT NULL DEFAULT nextval('dam_assets_rev_seq')
);
CREATE UNIQUE INDEX IF NOT EXISTS dam_assets_key_idx ON dam_assets (asset_key);
CREATE INDEX IF NOT EXISTS dam_assets_rev_idx ON dam_assets (rev);
"""

_SQL_LOCK = "SELECT pg_advisory_xact_lock(%s)"

# Dodanie / zmiana / odtworzenie nowsza wersja. Starszy mtime nigdy nie wygrywa;
# remis mtime z inna trescia -> wygrywa zapis, ktory znal najnowszy rev (base_rev).
_SQL_UPSERT = """
INSERT INTO dam_assets AS t
  (asset_id, asset_key, path_rel, name, size, mtime_ms, content_hash, meta,
   deleted_at, updated_at, updated_by, seen_by_machine, rev)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, NULL, %s, %s, %s, nextval('dam_assets_rev_seq'))
ON CONFLICT (asset_id) DO UPDATE SET
  asset_key = EXCLUDED.asset_key, path_rel = EXCLUDED.path_rel, name = EXCLUDED.name,
  size = EXCLUDED.size, mtime_ms = EXCLUDED.mtime_ms, content_hash = EXCLUDED.content_hash,
  meta = EXCLUDED.meta, deleted_at = NULL, updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by, seen_by_machine = EXCLUDED.seen_by_machine,
  rev = nextval('dam_assets_rev_seq')
WHERE EXCLUDED.mtime_ms > t.mtime_ms
   OR (EXCLUDED.mtime_ms = t.mtime_ms
       AND (EXCLUDED.size IS DISTINCT FROM t.size
            OR EXCLUDED.content_hash IS DISTINCT FROM t.content_hash
            OR t.deleted_at IS NOT NULL)
       AND t.rev <= %s)
RETURNING rev
"""

# Usuniecie: tylko gdy w bazie jest wciaz ta sama (albo starsza) wersja, ktora
# ten komputer znal, i nie nowsza niz czas skanu.
_SQL_TOMBSTONE = """
UPDATE dam_assets SET deleted_at = %s, updated_at = %s, updated_by = %s,
  seen_by_machine = %s, rev = nextval('dam_assets_rev_seq')
WHERE asset_id = %s AND deleted_at IS NULL AND mtime_ms <= %s AND mtime_ms <= %s
RETURNING rev
"""

# Przywrocenie tej samej (lub starszej) wersji: tylko usuniecie sprzed skanu i tylko
# gdy tombstone w bazie to ten sam, ktory komputer znal (nikt w miedzyczasie nie
# zapisal nowszej wersji).
_SQL_RESTORE = """
UPDATE dam_assets SET deleted_at = NULL, path_rel = %s, name = %s, size = %s,
  mtime_ms = %s, content_hash = %s, meta = %s::jsonb, updated_at = %s, updated_by = %s,
  seen_by_machine = %s, rev = nextval('dam_assets_rev_seq')
WHERE asset_id = %s AND deleted_at IS NOT NULL AND deleted_at <= %s AND rev <= %s
RETURNING rev
"""

_SQL_PULL = """
SELECT asset_id, asset_key, path_rel, name, size, mtime_ms, content_hash, meta,
       deleted_at, updated_at, updated_by, seen_by_machine, rev
FROM dam_assets WHERE rev > %s ORDER BY rev LIMIT %s
"""


def ensure_schema(pg) -> dict:
    try:
        cur = pg.cursor()
        cur.execute(PG_DDL)
        pg.commit()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001 - offline / brak uprawnien to normalny stan
        _rollback(pg)
        return {"ok": False, "error": str(exc)[:300]}


def _rollback(pg) -> None:
    try:
        pg.rollback()
    except Exception:  # noqa: BLE001
        pass


def _first_rev(cur) -> int | None:
    row = cur.fetchone()
    if not row:
        return None
    return _int(row["rev"] if hasattr(row, "keys") else row[0])


def _exec_op(cur, op: dict, now_ms: int) -> int | None:
    kind = op.get("op")
    machine = str(op.get("machine") or "")
    meta = json.dumps(op.get("meta") or {}, ensure_ascii=False, sort_keys=True)
    if kind == OP_UPSERT:
        cur.execute(_SQL_UPSERT, (
            op["asset_id"], op["asset_key"], op.get("path_rel") or "", op.get("name") or "",
            op.get("size"), _int(op.get("mtime_ms")), op.get("content_hash"), meta,
            now_ms, machine, machine, _int(op.get("base_rev")),
        ))
        return _first_rev(cur)
    if kind == OP_TOMBSTONE:
        scan_ms = _int(op.get("scan_time_ms"))
        cur.execute(_SQL_TOMBSTONE, (
            scan_ms, now_ms, machine, machine, op["asset_id"],
            _int(op.get("base_mtime_ms")), scan_ms,
        ))
        return _first_rev(cur)
    if kind == OP_RESTORE:
        cur.execute(_SQL_RESTORE, (
            op.get("path_rel") or "", op.get("name") or "", op.get("size"),
            _int(op.get("mtime_ms")), op.get("content_hash"), meta, now_ms, machine, machine,
            op["asset_id"], _int(op.get("scan_time_ms")), _int(op.get("base_rev")),
        ))
        return _first_rev(cur)
    raise ValueError(f"nieznana operacja: {kind!r}")  # blad programisty


def push_ops(pg, ops: list[dict], *, now_ms: int | None = None) -> dict:
    """Wyslij operacje. Zapisy serializowane blokada doradcza, zeby rev rosly w
    kolejnosci commitow (pull_since 'rev > ostatni' niczego nie gubi).

    Zwraca {"ok", "applied", "refused", "results": [{asset_id, op, applied, rev}]}.
    Odrzucone = baza ma nowsza wersje; nastepny pull_since ja przyniesie."""
    for op in ops:  # bledy programisty zglaszamy przed dotknieciem bazy
        if op.get("op") not in (OP_UPSERT, OP_TOMBSTONE, OP_RESTORE) or not op.get("asset_id"):
            raise ValueError(f"zla operacja: {op!r}")
    stamp = _now_ms() if now_ms is None else int(now_ms)
    results: list[dict] = []
    applied = refused = committed = 0
    try:
        cur = pg.cursor()
        for i, op in enumerate(ops):
            if i % PUSH_COMMIT_EVERY == 0:
                if i:
                    pg.commit()
                    committed = len(results)
                cur.execute(_SQL_LOCK, (ADVISORY_LOCK_KEY,))
            rev = _exec_op(cur, op, stamp)
            ok = rev is not None
            applied += int(ok)
            refused += int(not ok)
            results.append({"asset_id": op["asset_id"], "op": op["op"], "applied": ok, "rev": rev})
        pg.commit()
    except Exception as exc:  # noqa: BLE001 - siec / baza: raport, nie wyjatek
        _rollback(pg)
        kept = results[:committed]  # tylko to, co naprawde zatwierdzono
        return {"ok": False, "error": str(exc)[:300],
                "applied": sum(1 for r in kept if r["applied"]),
                "refused": sum(1 for r in kept if not r["applied"]), "results": kept}
    return {"ok": True, "applied": applied, "refused": refused, "results": results}


def pull_since(pg, rev: int, *, limit: int = PULL_BATCH) -> dict:
    """Wiersze z rev > `rev` (paczkami). Zwraca {"ok", "rows", "max_rev", "more"}."""
    last = _int(rev)
    rows: list[dict] = []
    try:
        cur = pg.cursor()
        while True:
            cur.execute(_SQL_PULL, (last, int(limit)))
            batch = cur.fetchall()
            for r in batch:
                row = normalize_row(r)
                rows.append(row)
                last = max(last, row["rev"])
            if len(batch) < int(limit):
                break
        pg.commit()
    except Exception as exc:  # noqa: BLE001
        _rollback(pg)
        return {"ok": False, "error": str(exc)[:300], "rows": rows, "max_rev": last, "more": True}
    return {"ok": True, "rows": rows, "max_rev": last, "more": False}


def sync_cycle(pg, local_rows: dict, *, scan: dict | None = None,
               scanned_dirs: Iterable[str] = (), failed_dirs: Iterable[str] = (),
               confirmed_dirs: Iterable[str] = (),
               last_seen: Iterable[str] | None = None, scan_time_ms: int = 0,
               machine: str = "", now_ms: int | None = None) -> dict:
    """Jeden cykl jak klient Synology: pull -> (diff -> push -> pull).

    scan=None -> komputer bez ROOT: tylko pobiera. Zwraca {"ok", "rows",
    "report", "push", "next_last_seen"}; przy bledzie sieci rows = stan po tym,
    co zdazylo przyjsc, a last_seen sie nie zmienia."""
    rows = dict(local_rows)
    first = pull_since(pg, max_rev(rows))
    rows = apply_remote(rows, first["rows"])
    out: dict[str, Any] = {"ok": first["ok"], "rows": rows, "report": None, "push": None,
                           "next_last_seen": None if last_seen is None else set(last_seen)}
    if not first["ok"]:
        out["error"] = first.get("error", "")
        return out
    if scan is None:
        return out
    report = diff_scan_report(rows, scan, scanned_dirs, scan_time_ms, machine,
                              last_seen=last_seen, failed_dirs=failed_dirs,
                              confirmed_dirs=confirmed_dirs)
    out["report"] = {k: v for k, v in report.items() if k != "next_last_seen"}
    pushed = push_ops(pg, report["ops"], now_ms=now_ms)
    out["push"] = pushed
    second = pull_since(pg, max_rev(rows))
    out["rows"] = apply_remote(rows, second["rows"])
    out["ok"] = bool(pushed["ok"] and second["ok"])
    if out["ok"]:
        out["next_last_seen"] = report["next_last_seen"]
    else:
        out["error"] = pushed.get("error") or second.get("error", "")
    return out
