# -*- coding: utf-8 -*-
"""Jednorazowe uzgodnienie katalogu (dam_assets) z dyskiem M: - etap 1a, krok K6 (spec/etap-1.md, rozdzial 5).

Uruchamiac NA KOMPUTERZE Z M:, z konta admina, PO wlaczeniu trybu "shadow" i po akceptacji raportu proby na sucho
przez kierownika. Pliki pomocnicze (raporty, listy) trafiaja WYLACZNIE do <repo>/work/<data>/uzgodnienie/.

Kroki (kazdy osobnym poleceniem; kazdy da sie cofnac):
  --dry-run   (domyslne) sonduje kazdy zywy wiersz (origin pusty lub 'm'), wykrywa pary folderow (przeniesienia),
              liczy skojarzenia na widmach, zapisuje raport i liste. NIC nie zapisuje w bazie.
  --backup    CREATE TABLE dam_assets_bak_<data> / dam_asset_product_links_bak_<data> AS TABLE ... oraz zrzut
              obu tabel do .jsonl.gz z suma kontrolna. Zapis: tylko nowe tabele. Kopii tabel narzedzie nie kasuje.
  --mark      sonda od nowa. "Jest": stempel (M2). "Nie ma": "brakuje od" (M15, takze wiersze sprzed 1a).
              "Nieosiagalny": nic. Wymaga trybu "on" i komputera z M:. Zapis: kolumny etapu 1a, bez nowych rev.
              (przerwa co najmniej 15 minut)
  --confirm   druga sonda od nowa. Kanarki na poczatku, co 500 sond i przed zatwierdzeniem kazdej paczki 500
              znacznikow; pierwsza porazka cofa partie w toku (M8) i konczy przebieg. Swiadek i hamulec pominiete
              (swiadome uruchomienie admina, partia r-<...>). Przenosi skojarzenia par (M7), stawia znaczniki (M16).
              Usuwa tylko wiersze, ktore w OBU sondach mialy "nie ma". Wiersze "tylko z kopii" nie sa ruszane.
  --undo r-<partia>   cofniecie partii jedna instrukcja (M8): tylko z komputera z M: z listy index_authority, tryb on.

Odmowy (kod 3/4): korzen albo ktorys z trzech folderow glownych nie odpowiada; sonda "nieosiagalny" dla ponad 1 %
wierszy; komputer nie jest komputerem z M:; tryb inny niz "on" (dla --mark i --confirm); baza `dam_eta`
(produkcja) bez jawnego --production.

Polaczenie: --dsn-env NAZWA (zmienna z DSN, jak w enable-index-authority.py) albo - bez niej - konfiguracja programu
(pg_db.connect()). Haslo ani DSN nie sa nigdzie wypisywane."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import random
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
DESKTOP = REPO / "bin" / "apps" / "desktop"
if str(DESKTOP) not in sys.path:
    sys.path.insert(0, str(DESKTOP))

import asset_sync  # noqa: E402
import asset_sync_m  # noqa: E402
import asset_sync_runner  # noqa: E402

PRODUCTION_DBNAMES = {"dam_eta"}
MAX_UNREACHABLE = 0.01
MIN_GAP_MS = 15 * 60 * 1000
TECHNICAL_DIRS = ("__macosx", ".ds_store", "thumbs.db")


class Refusal(Exception):
    def __init__(self, msg: str, code: int = 3):
        super().__init__(msg)
        self.code = code


def _cell(row: Any, key: str, idx: int = 0) -> Any:
    return row[key] if hasattr(row, "keys") else row[idx]


def _now_stamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


# --------------------------------------------------------------------------
# Odczyt i sondy
# --------------------------------------------------------------------------

def load_catalog(pg) -> list[dict]:
    """Zywe wiersze do uzgodnienia: origin pusty (sprzed 1a) albo 'm'. Wierszy 'copy' nie ruszamy."""
    cur = pg.cursor()
    cur.execute("SELECT asset_id, asset_key, path_rel, name, mtime_ms, origin, missing_since_ms "
                "FROM dam_assets WHERE deleted_at IS NULL AND (origin IS NULL OR origin = 'm')")
    out = [dict(r) for r in cur.fetchall()]
    pg.rollback()
    return out


def load_live_mirror(pg) -> dict[str, dict]:
    """Wszystkie zywe wiersze (takze 'copy'): kandydaci na nowe miejsce przeniesionych folderow."""
    cur = pg.cursor()
    cur.execute("SELECT asset_id, asset_key, mtime_ms, deleted_at, origin FROM dam_assets WHERE deleted_at IS NULL")
    out = {r["asset_id"]: dict(r) for r in cur.fetchall()}
    pg.rollback()
    return out


def probe_rows(rows: list[dict], probe: Callable[..., dict], *, canary: Callable[[], bool] | None = None,
               every: int = asset_sync_m.CANARY_EVERY, progress: Callable[[int, int], None] | None = None) -> dict:
    """Sonduje kazdy wiersz (jeden swiezy cache na caly przebieg). Zwraca {present, absent, unreachable}."""
    cache: dict = {}
    present: list[dict] = []
    absent: list[dict] = []
    unreachable: list[dict] = []
    for i, r in enumerate(rows, 1):
        if canary is not None and i % every == 0 and not canary():
            raise asset_sync_m.DiskUnavailable()
        res = probe(r["path_rel"], cache)
        st = res.get("state")
        if st == "jest":
            present.append(r)
        elif st == "nie_ma":
            absent.append({**r, "gone": res.get("gone", ""), "empty_parent": bool(res.get("empty_parent"))})
        else:
            unreachable.append({**r, "reason": res.get("reason", "")})
        if progress and i % 5000 == 0:
            progress(i, len(rows))
    return {"present": present, "absent": absent, "unreachable": unreachable}


def check_reachable(res: dict, total: int) -> None:
    if total and len(res["unreachable"]) / total > MAX_UNREACHABLE:
        raise Refusal(f"sonda zwrocila 'nieosiagalny' dla {len(res['unreachable'])} z {total} wierszy "
                      f"(> {MAX_UNREACHABLE:.0%}) - dysk M: nie odpowiada w pelni", 4)


def folder_of(r: dict) -> str:
    g = r.get("gone") or ""
    if g:
        return g
    return str(r.get("path_rel") or "").rsplit("/", 1)[0] if "/" in str(r.get("path_rel") or "") else ""


def build_report(rows: list[dict], res: dict, pairs: dict, links_on_ghosts: int, *, root: str) -> dict:
    by_folder: dict[str, int] = {}
    for r in res["absent"]:
        by_folder[folder_of(r)] = by_folder.get(folder_of(r), 0) + 1
    rnd = random.Random(7)
    sample = [r["path_rel"] for r in rnd.sample(res["absent"], min(50, len(res["absent"])))]
    cross = [p for p in pairs["pairs"] if p["cross_tree"]]
    tech = [p for p in pairs["pairs"] if any(t in p["from"] or t in p["to"] for t in TECHNICAL_DIRS)]
    return {
        "root": root, "probed": len(rows), "present": len(res["present"]), "absent": len(res["absent"]),
        "unreachable": len(res["unreachable"]), "to_stamp": sum(1 for r in res["present"] if r.get("origin") != "m"),
        "to_mark": sum(1 for r in res["absent"] if r.get("missing_since_ms") is None),
        "top_folders": sorted(by_folder.items(), key=lambda kv: -kv[1])[:40],
        "pairs": pairs["pairs"], "pairs_files": len(pairs["map"]), "pairs_cross_tree": cross,
        "pairs_technical": tech, "links_on_ghosts": links_on_ghosts,
        "links_to_move": None, "sample_absent": sample,
    }


def count_links(pg, ids: list[str]) -> int:
    n = 0
    cur = pg.cursor()
    for i in range(0, len(ids), 5000):
        cur.execute("SELECT count(*) AS n FROM dam_asset_product_links WHERE asset_id = ANY(%s)", (ids[i:i + 5000],))
        n += int(_cell(cur.fetchone(), "n"))
    pg.rollback()
    return n


# --------------------------------------------------------------------------
# Warunki wstepne
# --------------------------------------------------------------------------

def guard_write(pg, pg_connect, *, root: str, machine: str, need_authority: bool) -> dict:
    """Wspolne bramki --mark i --confirm: tryb on, kolumny, rola M:, (dla --confirm) lista index_authority."""
    rules = asset_sync_m.read_rules(pg)
    if rules["mode"] != "on":
        raise Refusal(f"tryb m_rules to '{rules['mode']}', a --mark i --confirm wymagaja 'on'")
    if not asset_sync_m.columns_ready(pg):
        raise Refusal("brak kolumn etapu 1a albo wyzwalacza dam_assets_rules w bazie (uruchom m_columns.sql, m_rules.sql)")
    if asset_sync_m.resolve_role(pg_connect, root, machine) != "m":
        raise Refusal(f"komputer {machine} nie jest zatwierdzonym komputerem z M: dla ROOT {root}")
    if need_authority:
        import index_authority  # noqa: PLC0415

        if index_authority.may_publish(pg_connect, force=True) is False:
            raise Refusal(f"komputer {machine} nie jest na liscie index_authority (usuwa tylko komputer z listy)")
    return rules


def pick_canaries(pg, exclude: set[str]) -> asset_sync_m.CanaryPool:
    cur = pg.cursor()
    cur.execute("SELECT asset_id, path_rel, asset_key FROM dam_assets WHERE deleted_at IS NULL AND origin = 'm' "
                "AND missing_since_ms IS NULL")
    pool = asset_sync_m.CanaryPool(((r["asset_id"], r["path_rel"], r["asset_key"]) for r in cur.fetchall()
                                    if r["asset_id"] not in exclude))
    pg.rollback()
    return pool


# --------------------------------------------------------------------------
# Kroki
# --------------------------------------------------------------------------

def step_dry_run(pg, *, root: str, probe, work: Path) -> dict:
    rows = load_catalog(pg)
    res = probe_rows(rows, probe)
    check_reachable(res, len(rows))
    live = load_live_mirror(pg)
    pairs = asset_sync_m.detect_pairs(res["absent"], live)
    ghosts = [r["asset_id"] for r in res["absent"]]
    rep = build_report(rows, res, pairs, count_links(pg, ghosts), root=root)
    rep["links_to_move"] = count_links(pg, list(pairs["map"]))
    stamp = _now_stamp()
    work.mkdir(parents=True, exist_ok=True)
    (work / f"dry-run-{stamp}.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    (work / f"dry-run-{stamp}.nie_ma.json").write_text(
        json.dumps([{"asset_id": r["asset_id"], "path_rel": r["path_rel"], "gone": r["gone"]} for r in res["absent"]],
                   ensure_ascii=False), encoding="utf-8")
    rep["files"] = [f"dry-run-{stamp}.json", f"dry-run-{stamp}.nie_ma.json"]
    return rep


def step_backup(pg, *, work: Path) -> dict:
    day = datetime.now().strftime("%Y%m%d")
    out: dict[str, Any] = {"tables": []}
    cur = pg.cursor()
    for table in ("dam_assets", "dam_asset_product_links"):
        bak = f"{table}_bak_{day}"
        if not re.fullmatch(r"[a-z_]+_bak_[0-9]{8}", bak):
            raise Refusal(f"zla nazwa kopii: {bak}")
        cur.execute("SELECT to_regclass(%s) AS t", (bak,))
        if _cell(cur.fetchone(), "t"):
            raise Refusal(f"kopia {bak} juz istnieje - narzedzie niczego nie nadpisuje ani nie kasuje")
        pg.rollback()
        cur.execute(f"CREATE TABLE {bak} AS TABLE {table}")
        cur.execute(f"SELECT count(*) AS n FROM {bak}")
        n = int(_cell(cur.fetchone(), "n"))
        pg.commit()
        work.mkdir(parents=True, exist_ok=True)
        path = work / f"{bak}.jsonl.gz"
        h = hashlib.sha256()
        with gzip.open(path, "wt", encoding="utf-8") as fh:
            cur2 = pg.cursor(name=f"dump_{table}")           # kursor po stronie serwera: bez wczytywania calej tabeli
            cur2.execute(f"SELECT row_to_json(t)::text AS j FROM {table} t")
            for r in cur2:
                line = _cell(r, "j") + "\n"
                fh.write(line)
                h.update(line.encode("utf-8"))
            cur2.close()
        pg.rollback()
        (work / f"{bak}.jsonl.gz.sha256").write_text(h.hexdigest() + "  " + path.name + "\n", encoding="utf-8")
        out["tables"].append({"table": bak, "rows": n, "dump": path.name, "sha256_of_lines": h.hexdigest()})
    return out


def step_mark(pg, pg_connect, *, root: str, machine: str, probe, work: Path) -> dict:
    guard_write(pg, pg_connect, root=root, machine=machine, need_authority=False)
    writer = asset_sync_m.writer_of(machine, "m")
    rows = load_catalog(pg)
    res = probe_rows(rows, probe)
    check_reachable(res, len(rows))          # przed jakimkolwiek zapisem
    asset_sync_m.refresh_catalog_count(pg, machine, writer, min_age_ms=0)
    cur = pg.cursor()
    out = {"stamped": 0, "marked": 0, "unmarked": 0, "unreachable": len(res["unreachable"]), "errors": []}
    to_stamp = [(r["asset_id"], int(r["mtime_ms"]), None) for r in res["present"] if r.get("origin") != "m"]
    st = asset_sync_m.stamp_and_mark(pg, writer, to_stamp, [], 0)
    out["stamped"] = st["stamped"]
    out["errors"].extend(st["errors"])
    back = [r["asset_id"] for r in res["present"] if r.get("missing_since_ms") is not None]
    if back:                                                  # plik wrocil: zdejmij stare oznaczenie
        out["unmarked"] = asset_sync_m._present_chunks(pg, cur, writer, back)  # noqa: SLF001
    ids = [r["asset_id"] for r in res["absent"] if r.get("missing_since_ms") is None]
    for i in range(0, len(ids), asset_sync_m.STAMP_BATCH):
        try:
            asset_sync_m.begin_write(cur, writer, lock=False)
            cur.execute(asset_sync_m.M["M15"], {"ids": ids[i:i + asset_sync_m.STAMP_BATCH]})
            out["marked"] += len(cur.fetchall())
            pg.commit()
        except Exception as exc:  # noqa: BLE001
            pg.rollback()
            out["errors"].append({"step": "M15", "error": str(exc)[:200]})
    out["marked_at_ms"] = asset_sync_m.db_now(cur)
    pg.rollback()
    work.mkdir(parents=True, exist_ok=True)
    (work / f"mark-{_now_stamp()}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def step_confirm(pg, pg_connect, *, root: str, machine: str, probe, work: Path,
                 min_gap_ms: int = MIN_GAP_MS, commit_every: int | None = None) -> dict:
    guard_write(pg, pg_connect, root=root, machine=machine, need_authority=True)
    writer = asset_sync_m.writer_of(machine, "m")
    cur = pg.cursor()
    cur.execute(asset_sync_m.M["M18"])
    marked = [dict(r) for r in cur.fetchall() if r["origin"] in (None, "m")]
    now_ms = asset_sync_m.db_now(cur)
    pg.rollback()
    if not marked:
        raise Refusal("brak oznaczonych wierszy - najpierw --mark")
    youngest = max(int(r["missing_since_ms"]) for r in marked)
    if now_ms - youngest < min_gap_ms:
        raise Refusal(f"od --mark minelo za malo czasu: poczekaj jeszcze {(min_gap_ms - (now_ms - youngest)) // 1000} s "
                      f"(wymagana przerwa {min_gap_ms // 60000} min)")
    marked_ids = {r["asset_id"] for r in marked}
    pool = pick_canaries(pg, marked_ids)
    canary = lambda: asset_sync_m.run_canaries(pool, probe)["passed"]  # noqa: E731
    c0 = asset_sync_m.run_canaries(pool, probe)
    if not c0["passed"]:
        raise Refusal(f"kanarki nie przeszly na poczatku ({c0['ok']}/{c0['n']}): dysk M: niedostepny", 4)
    out: dict[str, Any] = {"marked": len(marked), "present": 0, "absent": 0, "unreachable": 0, "deleted": 0,
                           "moved_links": 0, "batch": "", "aborted": "", "undone": 0, "errors": [], "canary": c0}
    try:
        res = probe_rows(marked, probe, canary=canary)
    except asset_sync_m.DiskUnavailable:
        raise Refusal("kanarki nie przeszly w trakcie sond: dysk M: niedostepny; zero znacznikow", 4) from None
    check_reachable(res, len(marked))
    out.update(present=len(res["present"]), absent=len(res["absent"]), unreachable=len(res["unreachable"]))
    if res["present"]:
        out["unmarked"] = asset_sync_m._present_chunks(pg, cur, writer, [r["asset_id"] for r in res["present"]])  # noqa: SLF001
    asset_sync_m.refresh_catalog_count(pg, machine, writer, min_age_ms=0)
    live = load_live_mirror(pg)
    pairs = asset_sync_m.detect_pairs(res["absent"], live, exclude_ids=marked_ids)
    out["pairs"] = pairs["pairs"]
    batch = f"r-{now_ms}-{asset_sync_m._safe_machine(machine)}"  # noqa: SLF001
    items = [{"asset_id": r["asset_id"], "mirror_mtime": int(r["mtime_ms"]), "wait_ms": min_gap_ms,
              "new_id": pairs["map"].get(r["asset_id"])} for r in sorted(res["absent"], key=lambda x: x["asset_id"])]
    kw = {"commit_every": commit_every} if commit_every else {}
    d = asset_sync_m.delete_batch(pg, writer=writer, machine=machine, sql=asset_sync_m.M["M16"], items=items,
                                  batch=batch, pool=pool, probe=probe, **kw)
    out.update(deleted=d["deleted"], moved_links=d["moved"], aborted=d["aborted"], undone=d.get("undone", 0))
    out["errors"].extend(d["errors"][:20])
    if d["deleted"]:
        out["batch"] = batch
    asset_sync_m.refresh_catalog_count(pg, machine, writer, min_age_ms=0)
    work.mkdir(parents=True, exist_ok=True)
    (work / f"confirm-{_now_stamp()}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    if d["aborted"] == "disk_unavailable":
        raise Refusal("dysk M: przestal odpowiadac w trakcie --confirm: zero wierszy z partia r-..., oznaczenia "
                      f"zachowane (cofnieto {d.get('undone', 0)} znacznikow partii w toku)", 4)
    return out


# --------------------------------------------------------------------------
# Wejscie
# --------------------------------------------------------------------------

def _connector(args) -> Callable[[], Any]:
    if args.dsn_env:
        dsn = os.environ.get(args.dsn_env, "").strip()
        if not dsn:
            raise Refusal(f"zmienna srodowiskowa {args.dsn_env} jest pusta albo nie istnieje", 2)

        def connect():
            import psycopg2  # noqa: PLC0415
            import psycopg2.extras  # noqa: PLC0415

            return psycopg2.connect(dsn, connect_timeout=15, cursor_factory=psycopg2.extras.RealDictCursor)

        return connect
    import pg_db  # noqa: PLC0415

    return pg_db.connect


def main(argv: list[str] | None = None, *, pg_connect: Callable[[], Any] | None = None,
         probe: Callable[..., dict] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--dry-run", action="store_true", help="(domyslne) tylko raport, bez zapisu w bazie")
    g.add_argument("--backup", action="store_true")
    g.add_argument("--mark", action="store_true")
    g.add_argument("--confirm", action="store_true")
    g.add_argument("--undo", metavar="PARTIA")
    ap.add_argument("--root", required=True, help="ROOT = folder Marketing na dysku M: tego komputera")
    ap.add_argument("--machine", default="", help="nazwa komputera (domyslnie COMPUTERNAME)")
    ap.add_argument("--dsn-env", default="")
    ap.add_argument("--production", action="store_true", help="zgoda na baze produkcyjna dam_eta")
    ap.add_argument("--work-dir", default="", help="domyslnie <repo>/work/<data>/uzgodnienie")
    ap.add_argument("--min-gap-min", type=float, default=15.0)
    args = ap.parse_args(argv)
    machine = args.machine or os.environ.get("COMPUTERNAME", "") or "unknown"
    work = Path(args.work_dir) if args.work_dir else REPO / "work" / datetime.now().strftime("%Y-%m-%d") / "uzgodnienie"
    try:
        connect = pg_connect or _connector(args)
        pg = connect()
    except Refusal as exc:
        print(f"Odmowa: {exc}")
        return exc.code
    except Exception as exc:  # noqa: BLE001
        print(f"Blad polaczenia z baza: {type(exc).__name__}")
        return 5
    try:
        cur = pg.cursor()
        cur.execute("SELECT current_database() AS db")
        dbname = str(_cell(cur.fetchone(), "db"))
        pg.rollback()
        if dbname in PRODUCTION_DBNAMES and not args.production:
            print(f"Odmowa: baza '{dbname}' to produkcja - wymagany jawny --production")
            return 3
        if not Path(args.root).is_dir():
            print(f"Odmowa: ROOT {args.root} nie istnieje albo nie odpowiada")
            return 4
        pr = probe or asset_sync_m._probe_fn(args.root, None)  # noqa: SLF001
        gap = int(args.min_gap_min * 60000)
        if args.undo:
            res = asset_sync_runner.undo_batch(connect, machine=machine, root_path=args.root, batch=args.undo)
            print(json.dumps(res, ensure_ascii=False, indent=1))
            return 0 if res.get("ok") else 3
        if args.backup:
            out = step_backup(pg, work=work)
        elif args.mark:
            out = step_mark(pg, connect, root=args.root, machine=machine, probe=pr, work=work)
        elif args.confirm:
            out = step_confirm(pg, connect, root=args.root, machine=machine, probe=pr, work=work, min_gap_ms=gap)
        else:
            out = step_dry_run(pg, root=args.root, probe=pr, work=work)
        print(json.dumps(out, ensure_ascii=False, indent=1, default=str))
        return 0
    except Refusal as exc:
        print(f"Odmowa: {exc}")
        return exc.code
    except Exception as exc:  # noqa: BLE001
        print(f"Blad: {type(exc).__name__}: {str(exc)[:300]}")
        return 5
    finally:
        try:
            pg.close()
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    raise SystemExit(main())
