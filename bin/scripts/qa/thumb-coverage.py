# -*- coding: utf-8 -*-
"""Pokrycie miniaturami: dam_assets (PG, zywe) vs pamiec podreczna na serwerze.

TYLKO ODCZYT. Nic nie zapisuje w bazie ani na NAS.

Laczy:
  - dam_assets (deleted_at IS NULL): path_rel, mtime_ms,
  - thumb-rel-index.json z NAS ("<rel>|<profil>" -> {digest, mtime}),
  - manifest.json z NAS (lista plikow thumbs/<digest>.<ext>).

Liczy per profil: ile materialow ma miniature na serwerze (klucz w rel-index
I plik w manifescie), ile da sie trafic samym mtime z bazy (_digest liczony
z dam_assets.mtime_ms, bez oryginalu), ile brakuje - z podzialem na
rozszerzenia i foldery; ile kluczy rel-index nie pasuje do zadnego materialu
(sieroty) i ile nie pasuje tylko przez normalizacje (NFC/wielkosc liter/ukosniki).

Uzycie:
  python thumb-coverage.py [--rel-index PLIK] [--manifest PLIK] [--local] [--out PLIK.json]
Bez --rel-index/--manifest pobiera oba z HTTPS NAS. --local = porownaj tez
lokalna pamiec (bin/PAMIEC-PODRECZNA).
"""
from __future__ import annotations

import argparse
import collections
import json
import sys
import time
import unicodedata
from pathlib import Path

BIN = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BIN / "apps" / "desktop"))
sys.path.insert(0, str(BIN / "apps" / "web" / "scripts"))

import dam_thumb_cache as tc  # noqa: E402
import pg_db  # noqa: E402
from asset_ids import asset_key  # noqa: E402

PROFILES = ("grid", "card", "modal")


def _load_json(path: str | None, url_name: str) -> dict:
    if path:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    raw = tc._http_get_bytes(tc.nas_cache_url() + "/" + url_name, timeout=60.0)
    if not raw:
        raise SystemExit(f"nie pobrano {url_name} z NAS")
    return json.loads(raw.decode("utf-8"))


def _fetch_assets() -> list[dict]:
    conn = pg_db.connect()
    try:
        cur = conn.cursor()
        cur.execute("SELECT path_rel, mtime_ms FROM dam_assets WHERE deleted_at IS NULL")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def _norm(rel: str) -> str:
    return unicodedata.normalize("NFC", rel or "").replace("\\", "/").strip("/")


def _top(rel: str) -> str:
    parts = rel.split("/")
    return "/".join(parts[:2]) if len(parts) > 2 else parts[0]


def coverage(assets: list[dict], rel_index: dict, manifest_digests: set[str]) -> dict:
    by_rel: dict[str, dict[str, str]] = collections.defaultdict(dict)
    for key, row in rel_index.items():
        if "|" not in key or not isinstance(row, dict):
            continue
        rel, prof = key.rsplit("|", 1)
        by_rel[rel][prof] = str(row.get("digest") or "")

    asset_rels = {a["path_rel"] for a in assets}
    asset_keys = {asset_key(r): r for r in asset_rels}

    per_prof = {p: 0 for p in PROFILES}
    per_prof_idx_only = {p: 0 for p in PROFILES}  # klucz jest, pliku brak na NAS
    any_hit = 0
    via_db_mtime = 0  # brak klucza, ale _digest(path_rel, mtime z bazy) jest na NAS
    norm_only = 0  # klucz jest tylko w innej postaci (NFC/case/ukosniki)
    missing: list[str] = []
    for a in assets:
        rel = a["path_rel"]
        profs = by_rel.get(rel) or by_rel.get(_norm(rel)) or {}
        hit = False
        for p in PROFILES:
            d = profs.get(p)
            if d and d in manifest_digests:
                per_prof[p] += 1
                hit = True
            elif d:
                per_prof_idx_only[p] += 1
        if hit:
            any_hit += 1
            continue
        mt = (a.get("mtime_ms") or 0) / 1000.0
        if mt and any(tc._digest(rel, mt, p) in manifest_digests for p in PROFILES):
            via_db_mtime += 1
            continue
        missing.append(rel)

    orphans = 0
    orphan_norm = 0
    for rel in by_rel:
        if rel in asset_rels:
            continue
        if asset_key(rel) in asset_keys:
            orphan_norm += 1
        else:
            orphans += 1
    norm_only = orphan_norm

    fill_ext = tc.FILL_SUPPORTED_EXT
    ext_c = collections.Counter(Path(r).suffix.lower() or "<brak>" for r in missing)
    top_c = collections.Counter(_top(r) for r in missing)
    buildable = sum(1 for r in missing if Path(r).suffix.lower() in fill_ext)
    return {
        "assets": len(assets),
        "server_thumb_any_profile": any_hit,
        "server_thumb_per_profile": per_prof,
        "rel_key_without_nas_file": per_prof_idx_only,
        "resolvable_via_db_mtime_only": via_db_mtime,
        "missing": len(missing),
        "missing_buildable_ext": buildable,
        "missing_unsupported_ext": len(missing) - buildable,
        "missing_by_ext": dict(ext_c.most_common(25)),
        "missing_by_folder": dict(top_c.most_common(25)),
        "rel_index_rels": len(by_rel),
        "rel_index_orphans": orphans,
        "rel_index_mismatch_normalisation_only": norm_only,
        "missing_sample": missing[:15],
    }


def _fill_candidates() -> set[str]:
    """Sciezki, ktore dzisiejszy watek uzupelniania (tc._fill_candidate_paths) w ogole widzi."""
    plain, viz = tc._fill_candidate_paths()
    return {tc._rel_from_logical(p) for p in list(plain) + list(viz)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rel-index")
    ap.add_argument("--manifest")
    ap.add_argument("--local", action="store_true")
    ap.add_argument("--out")
    args = ap.parse_args()

    t0 = time.time()
    assets = _fetch_assets()
    rel_index = _load_json(args.rel_index, "thumb-rel-index.json")
    manifest = _load_json(args.manifest, "manifest.json")
    digests = {str(f.get("digest")) for f in tc._manifest_files(manifest)}
    report = {
        "generated_at": tc._utc_iso(),
        "manifest": {k: manifest.get(k) for k in ("generated_at", "publisher", "thumb_count", "rel_count")},
        "server": coverage(assets, rel_index, digests),
    }
    cands = _fill_candidates()
    miss_all = [a["path_rel"] for a in assets]
    report["fill_watch_sees_assets"] = sum(1 for r in miss_all if r in cands)
    if args.local:
        local_idx = tc._load_rel_index()
        local_digests = {p.stem for p in (tc.cache_root() / "thumbs").iterdir() if p.is_file()}
        report["local"] = coverage(assets, local_idx, local_digests)
        report["local"]["cache_root"] = str(tc.cache_root())
    report["seconds"] = round(time.time() - t0, 1)

    out = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(out, encoding="utf-8")
    for name in ("server", "local"):
        s = report.get(name)
        if not s:
            continue
        print(f"== {name} ==")
        print(f"  materialy (dam_assets zywe)      {s['assets']:>7}")
        print(f"  miniatura na serwerze (dowolny)  {s['server_thumb_any_profile']:>7}  {100*s['server_thumb_any_profile']/max(1,s['assets']):.1f} %")
        for p, n in s["server_thumb_per_profile"].items():
            print(f"    profil {p:<6}                  {n:>7}")
        print(f"  tylko przez mtime z bazy         {s['resolvable_via_db_mtime_only']:>7}")
        print(f"  brak                             {s['missing']:>7}  (budowalne rozszerzenia {s['missing_buildable_ext']}, inne {s['missing_unsupported_ext']})")
        print(f"  sieroty rel-index                {s['rel_index_orphans']:>7}")
        print(f"  niezgodnosc tylko normalizacji   {s['rel_index_mismatch_normalisation_only']:>7}")
        print("  brak wg rozszerzenia:", ", ".join(f"{k} {v}" for k, v in list(s["missing_by_ext"].items())[:12]))
        print("  brak wg folderu:", "; ".join(f"{k} {v}" for k, v in list(s["missing_by_folder"].items())[:8]))
    print(f"watek uzupelniania widzi {report['fill_watch_sees_assets']} z {len(assets)} materialow")
    print(f"czas {report['seconds']} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
