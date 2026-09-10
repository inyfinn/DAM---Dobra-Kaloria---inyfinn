# -*- coding: utf-8 -*-
import json
import re
from datetime import datetime, timezone
from pathlib import Path

INDEX = Path(
    r"d:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\bin\apps\web\data\file-index.json"
)
OUT = Path(__file__).with_name("datesy-probe.json")

NEEDLE = re.compile(r"date|oat|lemon|cheesecake|cynamon|sliw|śliw", re.I)


def main():
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    products = data.get("products") or []
    viz = data.get("viz_latest") or []
    hits_prod = []
    for prod in products:
        name = str(prod.get("display_name") or prod.get("name") or "")
        pid = str(prod.get("id") or "")
        if not NEEDLE.search(name + " " + pid):
            continue
        revs = []
        for rev in prod.get("revisions") or []:
            revs.append(
                {
                    "index": rev.get("index"),
                    "folder": rev.get("folder"),
                    "path": rev.get("path"),
                    "date": rev.get("date"),
                    "mtime": rev.get("mtime"),
                    "mtime_ms": rev.get("mtime_ms"),
                    "is_latest": rev.get("is_latest"),
                    "letter_path": str(rev.get("path") or "")[-20:],
                }
            )
        hits_prod.append({"name": name, "id": pid, "rev_count": len(prod.get("revisions") or []), "revs": revs[:8]})

    hits_viz = []
    for v in viz:
        name = str(v.get("product_name") or "")
        pid = str(v.get("product_id") or "")
        blob = name + " " + pid + " " + str(v.get("path") or "")
        if not NEEDLE.search(blob):
            continue
        hits_viz.append(
            {
                "product_name": name,
                "product_id": pid,
                "index": v.get("index") or v.get("product_index"),
                "mtime": v.get("mtime"),
                "mtime_ms": v.get("mtime_ms"),
                "revision_folder": v.get("revision_folder"),
                "path": v.get("path"),
            }
        )

    # viz_latest numeric top 15
    def viz_ms(v):
        ms = v.get("mtime_ms")
        try:
            n = float(ms)
            if n:
                return int(n)
        except (TypeError, ValueError):
            pass
        raw = v.get("mtime")
        if not raw:
            return 0
        s = str(raw)
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                t = datetime.strptime(s[:19], fmt)
                return int(t.replace(tzinfo=timezone.utc).timestamp() * 1000)
            except ValueError:
                continue
        return 0

    ranked = []
    for v in viz:
        ranked.append(
            {
                "name": v.get("product_name"),
                "index": v.get("index") or v.get("product_index"),
                "mtime": v.get("mtime"),
                "mtime_ms": v.get("mtime_ms"),
                "ms": viz_ms(v),
            }
        )
    ranked.sort(key=lambda r: (0 if r["ms"] else 1, -r["ms"]))
    # unique by index
    seen = set()
    top = []
    for r in ranked:
        k = str(r.get("index") or r.get("name"))
        if k in seen:
            continue
        seen.add(k)
        if r["ms"]:
            r["iso"] = datetime.fromtimestamp(r["ms"] / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        top.append(r)
        if len(top) >= 15:
            break

    # string mtime localeCompare top (unique product)
    by_text = sorted(viz, key=lambda v: str(v.get("mtime") or ""), reverse=True)
    seen2 = set()
    text_top = []
    for v in by_text:
        pid = v.get("product_id") or v.get("index")
        if pid in seen2:
            continue
        seen2.add(pid)
        text_top.append(
            {
                "name": v.get("product_name"),
                "index": v.get("index") or v.get("product_index"),
                "mtime": v.get("mtime"),
                "mtime_ms": v.get("mtime_ms"),
            }
        )
        if len(text_top) >= 15:
            break

    OUT.write_text(
        json.dumps(
            {
                "viz_count": len(viz),
                "product_hits": hits_prod,
                "viz_hits": hits_viz[:20],
                "viz_numeric_top15": top,
                "viz_text_mtime_top15": text_top,
                "viz_sample_keys": sorted((viz[0] or {}).keys()) if viz else [],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print("wrote", OUT, "viz", len(viz), "prod hits", len(hits_prod), "viz hits", len(hits_viz))


if __name__ == "__main__":
    main()
