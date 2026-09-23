# -*- coding: utf-8 -*-
"""Jednorazowa migracja id materialow Brandingu na stabilne (asset_ids.stable_asset_id).

Stare id (br-000001...) byly licznikiem skanu i przesuwaly sie po kazdej przebudowie,
inne na kazdym komputerze. Dane trzymane po id wskazywaly potem inne pliki
(zmierzone 23.09: z powiazan sku_match tylko 7 wskazywalo plik z wlasciwym SKU).

Co robi (domyslnie --dry-run: tylko raport):
  1. Pliki pochodne (branding-index/-grid-index/-grid-head/-search-index, campaigns,
     branding-recognition): stare id z BIEZACEGO indeksu -> stabilne id tej samej
     sciezki; folder_group_id -> klucz folderu wzgledny wobec ROOT. To samo, co dalby
     pelny rebuild, bez skanu dysku.
  2. branding-associations-overrides.json: kazdy wpis przypiety do folderu
     (folder_group_id). Stare id przyjmowane TYLKO, gdy plik lezy w tym folderze
     (sprawdzane w biezacym indeksie i w migawce 17.09).
  3. Baza asset_product_links (--db, mozna podac kilka):
     - strong_sku_ocr/auto i override: usuwane (seed odtworzy je z migrowanych danych),
     - ocr_rapid_reviewed: id z migawki 17.09 (nazwa pliku zgodna z ocr-assoc-batch.jsonl),
     - reczne confirmed/rejected: epoka wg daty (przed 18.09 14:40 = migawka, od 22.09 =
       biezacy indeks), inaczej zostaja nietkniete i trafiaja do raportu.
Kopie zapasowe obok kazdego pliku przed zapisem (*.pre-stable-ids-<czas>).
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
import sys
import time
from collections import Counter
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))
from asset_ids import asset_key, is_stable_id, stable_asset_id  # noqa: E402

OLD_ID_RE = re.compile(r"^br-\d{6}$")
M_ID_RE = re.compile(r"^M-[A-Z]+(\d)(\d{5})-\d{2}-\d{2}$")
STAMP = time.strftime("%Y%m%d-%H%M%S")
# Epoki numeracji (zmierzone migawkami): do 18.09 ~14:40 numeracja z grid-index 17.09.
SNAP_ERA_END = "2026-09-18T14:40"
CUR_ERA_START = "2026-09-22"


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def save_json(p: Path, data, apply: bool, report: dict) -> None:
    if not apply:
        return
    bak = p.with_name(p.name + ".pre-stable-ids-" + STAMP)
    shutil.copy2(p, bak)
    tmp = p.with_name(p.name + ".tmp-stable")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(p)
    report.setdefault("backups", []).append(str(bak))


def folder_key(path: str) -> str:
    p = str(path or "").replace("\\", "/").rstrip("/")
    return asset_key(p.rsplit("/", 1)[0] if "/" in p else p)


def remap_tree(obj, cur: dict, stats: Counter):
    """Zamien stare id (wartosci i klucze) oraz folder_group_id w calym drzewie JSON."""
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            nk = cur.get(k, k) if isinstance(k, str) and OLD_ID_RE.match(k) else k
            if nk != k:
                stats["klucze"] += 1
            if k == "folder_group_id" and isinstance(v, str) and v:
                nv = asset_key(v)
                if nv != v:
                    stats["folder_group_id"] += 1
                out[nk] = nv
                continue
            out[nk] = remap_tree(v, cur, stats)
        return out
    if isinstance(obj, list):
        return [remap_tree(x, cur, stats) for x in obj]
    if isinstance(obj, str) and OLD_ID_RE.match(obj):
        new = cur.get(obj)
        if new:
            stats["wartosci"] += 1
            return new
        stats["nieznane_id"] += 1
    return obj


def m_to_br(mid: str) -> str:
    m = M_ID_RE.match(mid or "")
    return "br-0" + m.group(2) if m else ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--web", type=Path, required=True, help="folder bin/apps/web z biezacym indeksem")
    ap.add_argument("--snapshot", type=Path, required=True, help="branding-grid-index z 17.09 (numeracja powiazan)")
    ap.add_argument("--ocr-jsonl", type=Path, required=True, help="ocr-assoc-batch.jsonl (id + nazwa pliku)")
    ap.add_argument("--db", type=Path, action="append", default=[], help="dam-local.sqlite (mozna kilka)")
    ap.add_argument("--report", type=Path, required=True)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    data = args.web / "data"
    report: dict = {"apply": args.apply, "stamp": STAMP}

    # --- 1. mapa biezacy indeks: stare id -> stabilne ---
    idx_path = data / "branding-index.json"
    idx = load_json(idx_path)
    assets = idx.get("assets") or []
    if any(is_stable_id(a.get("id")) for a in assets[:50]):
        print("Indeks ma juz stabilne id - migracja plikow pominieta.")
        report["already_stable"] = True
    taken: dict[str, str] = {}
    cur: dict[str, str] = {}
    key_to_new: dict[str, str] = {}
    key_to_folder: dict[str, str] = {}
    for a in assets:
        old, path = a.get("id"), a.get("path") or ""
        if not old or not path:
            continue
        new = stable_asset_id(path, taken)
        cur[old] = new
        k = asset_key(path)
        key_to_new[k] = new
        key_to_folder[k] = folder_key(path)
    cur_path = {a["id"]: a.get("path") or "" for a in assets if a.get("id")}
    # Ten sam plik zapisany dwa razy (np. "cień" w NFC i NFD) daje ten sam klucz i ten
    # sam nowy id - takie wpisy sa scalane (dedupe_assets), to nie blad.
    report["indeks"] = {
        "assetow": len(assets),
        "zmapowanych": len(cur),
        "unikalnych_nowych": len(set(cur.values())),
        "scalonych_duplikatow": len(cur) - len(set(cur.values())),
    }

    snap = {a["id"]: a.get("path") or "" for a in (load_json(args.snapshot).get("assets") or []) if a.get("id")}

    def new_for_path(path: str) -> str:
        return key_to_new.get(asset_key(path), "") if path else ""

    # --- 2. pliki pochodne ---
    files = [
        "branding-index.json",
        "branding-grid-index.json",
        "branding-grid-head.json",
        "branding-search-index.json",
        "campaigns.json",
        "branding-recognition.json",
    ]
    report["pliki"] = {}
    if not report.get("already_stable"):
        for name in files:
            p = data / name
            if not p.is_file():
                continue
            st: Counter = Counter()
            obj = idx if name == "branding-index.json" else load_json(p)
            obj = remap_tree(obj, cur, st)
            if isinstance(obj, dict) and isinstance(obj.get("assets"), list):
                seen_ids: set = set()
                kept = []
                for a in obj["assets"]:
                    aid = a.get("id") if isinstance(a, dict) else None
                    if aid and aid in seen_ids:
                        st["scalone_duplikaty"] += 1
                        continue
                    if aid:
                        seen_ids.add(aid)
                    kept.append(a)
                obj["assets"] = kept
            report["pliki"][name] = dict(st)
            save_json(p, obj, args.apply, report)
            if name == "branding-index.json":
                idx = obj
            print(f"{name}: {dict(st)}", flush=True)

    # --- 3. nadpisania skojarzen: przypiecie przez folder ---
    ov_path = data / "branding-associations-overrides.json"
    ov_rep = {"przepiete": 0, "nierozwiazane": []}
    folder_first: dict[str, str] = {}
    for k in sorted(key_to_new):
        folder_first.setdefault(key_to_folder[k], key_to_new[k])
    if ov_path.is_file():
        ov = load_json(ov_path)
        new_assets: dict = {}
        for key, entry in (ov.get("assets") or {}).items():
            entry = dict(entry or {})
            group = asset_key(entry.get("folder_group_id") or "")

            def resolve(old_id: str) -> str:
                cands = []
                if is_stable_id(old_id):
                    return old_id
                for src in (cur_path, snap):
                    p = src.get(old_id) or src.get(m_to_br(old_id)) if src else ""
                    if p:
                        cands.append(p)
                for p in cands:
                    if group and folder_key(p) == group:
                        return new_for_path(p)
                return ""

            nk = resolve(key)
            if not nk and group and folder_first.get(group):
                # Most stosuje nadpisanie do calego folderu (spray_group) - kluczem moze
                # byc dowolny plik tego folderu. Folder i produkty zostaja bez zmian.
                nk = folder_first[group]
                ov_rep.setdefault("przez_folder", []).append({"klucz": key, "nowy": nk, "folder": group})
            if not nk:
                ov_rep["nierozwiazane"].append({"klucz": key, "folder": group, "produkty": entry.get("linked_product_ids")})
                new_assets[key] = entry  # zostaje pod starym kluczem: decyzja czlowieka nie znika
                continue
            vids = []
            for vid in entry.get("linked_variant_ids") or []:
                nv = resolve(vid)
                if nv:
                    vids.append(nv)
            entry["linked_variant_ids"] = vids
            entry["folder_group_id"] = group
            new_assets[nk] = entry
            ov_rep["przepiete"] += 1
        ov["assets"] = new_assets
        report["nadpisania"] = ov_rep
        save_json(ov_path, ov, args.apply, report)
        print(f"nadpisania: przepiete {ov_rep['przepiete']}, nierozwiazane {len(ov_rep['nierozwiazane'])}", flush=True)

    # --- 4. baza ---
    ocr_names = {}
    for line in args.ocr_jsonl.read_text(encoding="utf-8").splitlines():
        try:
            r = json.loads(line)
            ocr_names[r["id"]] = (r.get("name") or "").lower()
        except (ValueError, KeyError):
            continue
    report["bazy"] = {}
    for db in args.db:
        st: Counter = Counter()
        unresolved = []
        conn = sqlite3.connect(str(db))
        rows = conn.execute(
            "select asset_id, product_id, score, source, status, reason, updated_at, updated_by, dirty from asset_product_links"
        ).fetchall()
        plan_delete, plan_move = [], []
        for row in rows:
            aid, pid, score, source, status, reason, at, by, dirty = row
            if is_stable_id(aid):
                st["juz_stabilne"] += 1
                continue
            if (source == "strong_sku_ocr" and status == "auto") or source == "override" or reason == "override":
                plan_delete.append((aid, pid))
                st["usun_odtworzy_seed"] += 1
                continue
            path = ""
            if source == "ocr_rapid_reviewed":
                p = snap.get(aid, "")
                if p and p.replace("\\", "/").rsplit("/", 1)[-1].lower() == ocr_names.get(aid, "\0"):
                    path = p
            elif status in ("confirmed", "rejected"):
                if (at or "") < SNAP_ERA_END:
                    path = snap.get(aid, "")
                elif (at or "") >= CUR_ERA_START:
                    path = cur_path.get(aid, "")
            new = new_for_path(path)
            if new:
                plan_move.append((row, new))
                st["przepnij"] += 1
            else:
                unresolved.append({"asset_id": aid, "product_id": pid, "source": source, "status": status, "at": at})
                if status == "auto" or status == "pending":
                    plan_delete.append((aid, pid))
                    st["usun_nierozwiazane_auto"] += 1
                else:
                    st["zostaw_nierozwiazane_reczne"] += 1
        report["bazy"][str(db)] = {"wierszy": len(rows), **dict(st), "nierozwiazane": unresolved[:200]}
        print(f"{db.name}: {dict(st)}", flush=True)
        if args.apply:
            bak = db.with_name(db.name + ".pre-stable-ids-" + STAMP)
            src = sqlite3.connect(str(db))
            dst = sqlite3.connect(str(bak))
            src.backup(dst)
            dst.close()
            src.close()
            if bak.stat().st_size <= 0:
                print("BLAD: pusta kopia bazy", file=sys.stderr)
                return 3
            report.setdefault("backups", []).append(str(bak))
            with conn:
                for aid, pid in plan_delete:
                    conn.execute("delete from asset_product_links where asset_id=? and product_id=?", (aid, pid))
                for row, new in plan_move:
                    aid, pid, score, source, status, reason, at, by, dirty = row
                    conn.execute(
                        "insert into asset_product_links(asset_id, product_id, score, source, status, reason, updated_at, updated_by, dirty) "
                        "values(?,?,?,?,?,?,?,?,1) on conflict(asset_id, product_id) do update set "
                        "status=excluded.status, source=excluded.source, reason=excluded.reason, score=excluded.score, "
                        "updated_at=excluded.updated_at, updated_by=excluded.updated_by, dirty=1",
                        (new, pid, score, source, status, reason, at, by),
                    )
                    conn.execute("delete from asset_product_links where asset_id=? and product_id=?", (aid, pid))
        conn.close()

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print("raport:", args.report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
