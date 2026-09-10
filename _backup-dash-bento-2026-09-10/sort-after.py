# -*- coding: utf-8 -*-
import json
import re
from datetime import datetime, timezone
from pathlib import Path

INDEX = Path(
    r"d:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\bin\apps\web\data\file-index.json"
)
OUT = Path(__file__).with_name("sort-after.json")


def letter_from_folder(path_or_name):
    nm = str(path_or_name or "").replace("\\", "/").split("/")[-1]
    m = re.search(r"\s-\s([FXD])$", nm, re.I)
    return m.group(1).upper() if m else ""


def revision_is_final(rev):
    disk = letter_from_folder(rev.get("path") or "")
    if not disk and not rev.get("path") and rev.get("folder"):
        disk = letter_from_folder(rev.get("folder"))
    return disk == "F"


def eligible(rev):
    if revision_is_final(rev):
        return True
    lit = letter_from_folder(rev.get("path") or "") or letter_from_folder(rev.get("folder") or "")
    if lit in ("X", "D"):
        return False
    path = str(rev.get("path") or "") + " " + str(rev.get("folder") or "")
    if re.search(r"archiwum", path, re.I):
        return False
    return rev.get("is_latest") is True


def parse_revision_date(folder, fallback=""):
    m = re.search(r"(\d{2})[.\s](\d{2})[.\s](\d{4})", str(folder or ""))
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return fallback or ""


def record_mtime_ms(rec):
    ms = rec.get("mtime_ms")
    try:
        n = float(ms)
        if n:
            return int(n)
    except (TypeError, ValueError):
        pass
    raw = rec.get("mtime") or rec.get("sortDate") or rec.get("date") or ""
    if not raw:
        return 0
    s = str(raw)
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            t = datetime.strptime(s[:19], fmt)
            return int(t.replace(tzinfo=timezone.utc).timestamp() * 1000)
        except ValueError:
            continue
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
            if not eligible(rev):
                continue
            idx = str(rev.get("index") or rev.get("index_base") or "")
            if not idx or idx == "pending" or re.match(r"^noid", idx, re.I) or idx.startswith("000000"):
                continue
            sort_date = rev.get("date") or parse_revision_date(rev.get("folder") or rev.get("path") or "") or ""
            rec = {
                "product_name": name,
                "index": idx,
                "sortDate": sort_date,
                "mtime_ms": record_mtime_ms({"date": sort_date, "mtime": sort_date}),
            }
            rows.append(rec)
    rows.sort(key=lambda r: (0 if r["mtime_ms"] else 1, -r["mtime_ms"]))
    seen = set()
    unique = []
    for r in rows:
        if r["index"] in seen:
            continue
        seen.add(r["index"])
        unique.append(r)

    def slim(r):
        ms = r["mtime_ms"]
        iso = datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d") if ms else ""
        return {"name": r["product_name"], "index": r["index"], "sortDate": r["sortDate"], "mtime_ms": ms, "date": iso}

    OUT.write_text(
        json.dumps({"row_count": len(rows), "unique": len(unique), "top10": [slim(r) for r in unique[:10]]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("wrote", OUT)
    for i, r in enumerate(unique[:10], 1):
        print(i, r["product_name"], r["index"], r["sortDate"])
    needles = ("lemon", "cynamonka", "sliwk", "śliw", "dates", "oat")
    print("---positions---")
    for i, r in enumerate(unique, 1):
        blob = (r["product_name"] + r["index"]).lower()
        if any(n in blob for n in needles):
            print(f"#{i}", r["product_name"], r["index"], r["sortDate"])


if __name__ == "__main__":
    main()
