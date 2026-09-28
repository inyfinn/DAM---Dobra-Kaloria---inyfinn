# -*- coding: utf-8 -*-
r"""Plan naprawy DAM, etap 4 pkt 4: raport pokrycia podgladow dla aktualnych
wersji zywych assetow.

Czyta (TYLKO ODCZYT - sesja startuje z `SET default_transaction_read_only = on`,
dodatkowy bezpiecznik niezaleznie od uprawnien roli w DSN):
  - `dam_assets` (zywe wiersze: `deleted_at IS NULL`) - asset_id, path_rel, name, size, mtime_ms.
  - `dam_thumb_cache_index` (store_key "rel|profil" -> digest, mtime w SEKUNDACH).

Czyta lokalnie (TEN komputer - moze byc pusty/inny na innym):
  - `preview-failures.json` z `platform_compat.user_state_dir()`
    (`dam_thumb_cache.record_preview_failure` - patrz `bin/apps/desktop/dam_thumb_cache.py`).

Klasyfikuje kazdy zywy asset x profil (domyslnie "grid") przez czysta funkcje
`preview_status.classify_asset` (bin/apps/desktop/preview_status.py) i drukuje:
  - liczniki per stan (ready/pending/failed/unsupported),
  - liczniki per rozszerzenie x stan,
  - top N folderow z najwiecej pending+failed.
Zapisuje pelny raport (JSON) do sciezki podanej przez --out.

DSN: WYLACZNIE ze zmiennej srodowiskowej DAM_COVERAGE_DSN. Ten skrypt NIGDY
sam nie decyduje, do jakiej bazy sie laczy - ustawienie tej zmiennej (test czy
produkcja) jest decyzja tego, kto go uruchamia. Zadnej konfiguracji aplikacji
(pg-config.json, *.dpapi) nie czyta ani nie pisze.

Dopasowanie sciezek (dam_assets.path_rel vs "rel" w dam_thumb_cache_index):
oba klucze normalizujemy przez `asset_ids.asset_key` (dokladnie ta sama
normalizacja, ktorej dam_thumb_cache._candidate_digests juz uzywa do
polaczenia _ASSET_MT z lokalnym indeksem miniatur - _ASSET_MT_KEY), zeby
litera dysku / wielkosc liter / UNC nie psuly dopasowania (plan etap 4.3).
Kolizje (dwa rozne rel dajace ten sam asset_key) nie sa w tym raporcie
spodziewane - asset_key jest tym samym kluczem, ktorego uzywa asset_sync do
liczenia stabilnego asset_id.

Uzycie:
  set DAM_COVERAGE_DSN=host=... port=... dbname=... user=... password=... sslmode=require
  python preview-coverage.py --out work\2026-09-28\W6\coverage.json
  python preview-coverage.py --profile card --top 30 --out coverage-card.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
DESKTOP = HERE.parents[1] / "apps" / "desktop"
WEB_SCRIPTS = HERE.parents[1] / "apps" / "web" / "scripts"
for _p in (str(DESKTOP), str(WEB_SCRIPTS)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import preview_status as ps  # noqa: E402
from asset_ids import asset_key  # noqa: E402

try:
    import dam_thumb_cache as tc  # noqa: E402
except Exception:  # noqa: BLE001 - opcjonalne (tylko dla FILL_SUPPORTED_EXT i lokalnych porazek)
    tc = None  # type: ignore[assignment]

DSN_ENV = "DAM_COVERAGE_DSN"
DEFAULT_PROFILE = "grid"
DEFAULT_TOP_N = 20

FALLBACK_SUPPORTED_EXT = frozenset(
    {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".psd", ".webp", ".gif", ".bmp", ".avif", ".pdf"}
)


def _supported_extensions() -> frozenset:
    if tc is not None:
        return frozenset(tc.FILL_SUPPORTED_EXT)
    return FALLBACK_SUPPORTED_EXT


def _local_failures_by_key() -> dict[str, ps.FailureRecord]:
    """asset_key(path_key)|profile -> FailureRecord, z lokalnego preview-failures.json.

    Puste, gdy dam_thumb_cache niedostepny (np. srodowisko bez runtime aplikacji)
    - raport wtedy po prostu nigdy nie zglosi "failed" (opisane w wyjsciu jako
    local_failures_source)."""
    if tc is None:
        return {}
    try:
        raw = tc.load_preview_failures()
    except Exception:  # noqa: BLE001
        return {}
    out: dict[str, ps.FailureRecord] = {}
    for row in raw.values():
        if not isinstance(row, dict):
            continue
        path_key = str(row.get("path_key") or "")
        profile = str(row.get("profile") or "")
        if not path_key or not profile:
            continue
        key = f"{asset_key(path_key)}|{profile}"
        out[key] = ps.FailureRecord(
            mtime_ms=int(row.get("mtime_ms") or 0),
            reason=str(row.get("reason") or ""),
            at=str(row.get("at") or ""),
        )
    return out


def fetch_assets(conn) -> list[ps.AssetRow]:
    cur = conn.cursor()
    cur.execute(
        "SELECT asset_id, path_rel, name, size, mtime_ms FROM dam_assets "
        "WHERE deleted_at IS NULL"
    )
    rows = cur.fetchall()
    out = []
    for r in rows:
        row = dict(r) if hasattr(r, "keys") else {
            "asset_id": r[0], "path_rel": r[1], "name": r[2], "size": r[3], "mtime_ms": r[4]
        }
        out.append(ps.AssetRow(
            asset_id=str(row.get("asset_id") or ""),
            path_rel=str(row.get("path_rel") or ""),
            mtime_ms=int(row.get("mtime_ms") or 0),
            size=int(row.get("size") or 0),
            name=str(row.get("name") or ""),
        ))
    return out


def fetch_thumb_index(conn) -> dict[str, ps.ThumbIndexEntry]:
    """asset_key(rel)|profile -> ThumbIndexEntry (max mtime, gdy kolizja kluczy)."""
    cur = conn.cursor()
    # BEZ prefiksu "public." - respektuje search_path (schemat testowy t_xxx w
    # testach realpg tworzy ta tabele PRZED public, "public.dam_thumb_cache_index"
    # daloby falszywy "brak tabeli" na kazdej bazie, gdzie nie jest pierwszym
    # schematem w search_path).
    cur.execute("SELECT to_regclass('dam_thumb_cache_index') AS t")
    row = cur.fetchone()
    has_table = bool((row["t"] if hasattr(row, "keys") else row[0]) if row else None)
    if not has_table:
        return {}
    cur.execute("SELECT store_key, digest, mtime FROM dam_thumb_cache_index")
    rows = cur.fetchall()
    out: dict[str, ps.ThumbIndexEntry] = {}
    for r in rows:
        row = dict(r) if hasattr(r, "keys") else {"store_key": r[0], "digest": r[1], "mtime": r[2]}
        store_key = str(row.get("store_key") or "")
        if "|" not in store_key:
            continue
        rel, profile = store_key.rsplit("|", 1)
        if not rel or not profile:
            continue
        key = f"{asset_key(rel)}|{profile}"
        try:
            mtime = float(row.get("mtime") or 0.0)
        except (TypeError, ValueError):
            mtime = 0.0
        digest = str(row.get("digest") or "")
        cur_entry = out.get(key)
        if cur_entry is None or mtime >= cur_entry.mtime:
            out[key] = ps.ThumbIndexEntry(digest=digest, mtime=mtime)
    return out


def build_report(conn, *, profile: str, top_n: int) -> dict[str, Any]:
    t0 = time.monotonic()
    assets = fetch_assets(conn)
    index_raw = fetch_thumb_index(conn)
    failures_raw = _local_failures_by_key()

    index_by_asset: dict[str, ps.ThumbIndexEntry] = {}
    failures_by_asset: dict[str, ps.FailureRecord] = {}
    for asset in assets:
        key = f"{asset_key(asset.path_rel)}|{profile}"
        if key in index_raw:
            index_by_asset[asset.asset_id] = index_raw[key]
        if key in failures_raw:
            failures_by_asset[asset.asset_id] = failures_raw[key]

    report, _statuses = ps.build_coverage_report(
        assets, profile=profile, index_by_asset=index_by_asset,
        failures_by_asset=failures_by_asset, supported_extensions=_supported_extensions(),
        top_n=top_n,
    )
    payload = report.to_dict()
    payload["generated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    payload["ms"] = int((time.monotonic() - t0) * 1000)
    payload["assets_seen"] = len(assets)
    payload["thumb_index_rows"] = len(index_raw)
    payload["local_failures_available"] = tc is not None
    payload["local_failures_rows"] = len(failures_raw)
    return payload


def print_summary(payload: dict[str, Any]) -> None:
    print(f"Profil: {payload['profile']}  |  zywe assety: {payload['total']}  |  {payload['ms']} ms")
    if not payload["local_failures_available"]:
        print("UWAGA: dam_thumb_cache niedostepny w tym srodowisku - stan 'failed' "
              "nie zostanie zglaszany (brak lokalnego preview-failures.json).")
    print("\nStany:")
    for state in ps.VALID_STATES:
        print(f"  {state:12s} {payload['counts'].get(state, 0)}")
    print("\nPer rozszerzenie:")
    for ext in sorted(payload["by_extension"]):
        counts = payload["by_extension"][ext]
        parts = ", ".join(f"{k}={v}" for k, v in sorted(counts.items()))
        print(f"  {ext:10s} {parts}")
    print("\nTop foldery z brakami (pending+failed):")
    for row in payload["top_missing_folders"]:
        print(f"  {row['count']:5d}  {row['folder']}")


def _connect(dsn: str):
    import psycopg2  # noqa: PLC0415
    import psycopg2.extras  # noqa: PLC0415

    conn = psycopg2.connect(dsn, connect_timeout=15, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute("SET default_transaction_read_only = on")
    conn.commit()
    return conn


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--profile", default=DEFAULT_PROFILE, choices=sorted(tc.PROFILES) if tc else
                    ["grid", "card", "modal", "poster"])
    ap.add_argument("--top", type=int, default=DEFAULT_TOP_N, help="ile folderow w top_missing_folders")
    ap.add_argument("--out", required=True, help="sciezka pliku JSON z pelnym raportem")
    args = ap.parse_args(argv)

    dsn = os.environ.get(DSN_ENV, "").strip()
    if not dsn:
        print(f"Blad: brak {DSN_ENV} w srodowisku - ten skrypt nigdy sam nie wybiera bazy.")
        return 2

    conn = _connect(dsn)
    try:
        cur = conn.cursor()
        cur.execute("SELECT current_database() AS db, current_user AS usr")
        who = cur.fetchone()
        print(f"Polaczono: db={who['db'] if hasattr(who, 'keys') else who[0]} "
              f"user={who['usr'] if hasattr(who, 'keys') else who[1]} (sesja read-only)")
        payload = build_report(conn, profile=args.profile, top_n=args.top)
    finally:
        conn.close()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print_summary(payload)
    print(f"\nPelny raport zapisany: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
