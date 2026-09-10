# -*- coding: utf-8 -*-
import json
import re
from datetime import datetime, timezone
from pathlib import Path

INDEX = Path(
    r"d:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\bin\apps\web\data\file-index.json"
)
OUT = Path(__file__).with_name("sort-before.json")


def letter_from_folder(path_or_name):
    nm = str(path_or_name or "").replace("\\", "/").split("/")[-1]
    m = re.search(r"\s-\s([FXD])$", nm, re.I)
    return m.group(1).upper() if m else ""


def revision_is_final(rev):
    if not rev:
        return False
    disk = letter_from_folder(rev.get("path") or "")
    if not disk and not rev.get("path") and rev.get("folder"):
        disk = letter_from_folder(rev.get("folder"))
    return disk == "F"


def parse_revision_date(folder, fallback=""):
    m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", str(folder or ""))
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return fallback or ""


def record_mtime_ms(rec):
    if not rec:
        return 0
    ms = rec.get("mtime_ms")
    try:
        n = float(ms)
        if n and n == n:
            return int(n)
    except (TypeError, ValueError):
        pass
    for key in ("mtime", "sortDate", "date"):
        raw = rec.get(key)
        if not raw:
            continue
        try:
            t = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            return int(t.timestamp() * 1000)
        except ValueError:
            pass
        try:
            # 2026-09-08 or 08.09.2026
            s = str(raw)
            for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d.%m.%Y"):
                try:
                    t = datetime.strptime(s[:19], fmt)
                    return int(t.replace(tzinfo=timezone.utc).timestamp() * 1000)
                except ValueError:
                    continue
        except Exception:
            pass
    return 0


def main():
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    products = data.get("products") or []
    rows = []
    for prod in products:
        pid = prod.get("id") or ""
        name = prod.get("display_name") or prod.get("name") or pid
        if re.search(r"test-lifecycle", pid, re.I) or re.search(r"^test\b", name, re.I):
            continue
        for rev in prod.get("revisions") or []:
            if not revision_is_final(rev):
                continue
            idx = str(rev.get("index") or rev.get("index_base") or "")
            if not idx or idx == "pending" or re.match(r"^noid", idx, re.I) or idx.startswith("000000"):
                continue
            sort_date = (
                rev.get("date")
                or parse_revision_date(rev.get("folder") or rev.get("path") or "")
                or ""
            )
            rec = {
                "product_name": name,
                "index": idx,
                "sortDate": sort_date,
                "mtime": rev.get("mtime"),
                "mtime_ms": rev.get("mtime_ms"),
                "rev_keys": sorted(list(rev.keys()))[:40],
            }
            rec["_ms"] = record_mtime_ms(
                {
                    "mtime_ms": rev.get("mtime_ms"),
                    "mtime": rev.get("mtime"),
                    "sortDate": sort_date,
                    "date": rev.get("date"),
                }
            )
            rows.append(rec)

    # current widget sort (string localeCompare on sortDate)
    by_text = sorted(rows, key=lambda r: str(r.get("sortDate") or ""), reverse=True)
    seen = set()
    unique_text = []
    for r in by_text:
        if r["index"] in seen:
            continue
        seen.add(r["index"])
        unique_text.append(r)

    by_num = sorted(
        rows,
        key=lambda r: (0 if r["_ms"] else 1, -r["_ms"]),
    )
    seen2 = set()
    unique_num = []
    for r in by_num:
        if r["index"] in seen2:
            continue
        seen2.add(r["index"])
        unique_num.append(r)

    def slim(r):
        ms = r["_ms"]
        iso = ""
        if ms:
            iso = datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        return {
            "name": r["product_name"],
            "index": r["index"],
            "sortDate": r.get("sortDate"),
            "mtime": r.get("mtime"),
            "mtime_ms": r.get("mtime_ms"),
            "computed_ms": ms,
            "computed_iso": iso,
        }

    sample_rev_keys = unique_text[0]["rev_keys"] if unique_text else []
    out = {
        "product_count": len(products),
        "final_rows": len(rows),
        "sample_rev_keys": sample_rev_keys,
        "before_text_sort_top10": [slim(r) for r in unique_text[:10]],
        "numeric_sort_top10": [slim(r) for r in unique_num[:10]],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
