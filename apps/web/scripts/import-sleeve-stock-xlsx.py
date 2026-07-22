# -*- coding: utf-8 -*-
"""Import STANY RĘKAWKÓW from Kubara Excel into sleeve-stock.json.

Source (default):
  X:/Marketing/- POLSKA/01 - PRODUKTY/01 - WYKROJNIKI/STANY RĘKAWKÓW 2026.xlsx

Columns (flexible header match):
  ARTYKUL:KOD | dodatkowa nazwa | ARTYKUL:NAZWA | średnie zużycie | STAN |
  na ile msc zapas | w zamówieniu | z domówieniem zapas na | wykrojnik | kom
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "data" / "sleeve-stock.json"
DEFAULT_XLSX = Path(
    r"X:/Marketing/- POLSKA/01 - PRODUKTY/01 - WYKROJNIKI/STANY RĘKAWKÓW 2026.xlsx"
)

ARTICLE_RE = re.compile(r"\b(6300\d{3,4})\b")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def norm_key(val: Any) -> str:
    return re.sub(r"\s+", " ", str(val or "").strip())


def norm_header(val: Any) -> str:
    s = norm_key(val).lower()
    for a, b in (
        ("ł", "l"),
        ("ó", "o"),
        ("ą", "a"),
        ("ę", "e"),
        ("ś", "s"),
        ("ć", "c"),
        ("ń", "n"),
        ("ź", "z"),
        ("ż", "z"),
    ):
        s = s.replace(a, b)
    return s


def parse_number(val: Any) -> float | None:
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        if isinstance(val, float) and math.isnan(val):
            return None
        return float(val)
    s = str(val).strip().replace("\xa0", " ").replace(" ", "")
    if not s or s in ("-", "—", "–"):
        return None
    s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def parse_int(val: Any) -> int | None:
    n = parse_number(val)
    if n is None:
        return None
    return int(round(n))


def col_map(headers: list[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    for i, h in enumerate(headers):
        if not h:
            continue
        if "kod" in h and ("artykul" in h or "art" in h or h.endswith(":kod") or h == "kod"):
            out.setdefault("article_code", i)
        elif h in ("kod", "artykul:kod", "indeks"):
            out.setdefault("article_code", i)
        elif "dodatkowa" in h or "extra" in h:
            out.setdefault("extra_name", i)
        elif "nazwa" in h and "dodatkowa" not in h:
            out.setdefault("name", i)
        elif "srednie" in h or "zuzycie" in h:
            out.setdefault("avg_monthly_usage", i)
        elif h == "stan" or (h.startswith("stan") and "zapas" not in h):
            out.setdefault("stock", i)
        elif "na ile" in h or ("msc" in h and "zapas" in h and "domow" not in h):
            out.setdefault("months_of_stock", i)
        elif "zamowieniu" in h or "w zamowieniu" in h:
            out.setdefault("on_order", i)
        elif "domowieniem" in h or "z domow" in h:
            out.setdefault("months_with_order", i)
        elif "wykrojnik" in h:
            out.setdefault("die_type", i)
        elif h in ("kom", "uwagi", "komentarz") or "kom" == h[:3]:
            out.setdefault("comment", i)
    return out


def load_rows_xlsx(path: Path) -> list[tuple]:
    try:
        import openpyxl  # type: ignore
    except ImportError as e:
        raise RuntimeError("openpyxl required for XLSX import") from e
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    return list(ws.iter_rows(values_only=True))


def load_rows_csv(path: Path) -> list[tuple]:
    text = path.read_text(encoding="utf-8-sig")
    dialect = csv.Sniffer().sniff(text[:2048], delimiters=";,\t")
    reader = csv.reader(text.splitlines(), dialect)
    return [tuple(r) for r in reader]


def find_header(rows: list[tuple]) -> tuple[int, dict[str, int]]:
    for idx, row in enumerate(rows[:40]):
        headers = [norm_header(c) for c in row]
        cm = col_map(headers)
        if "article_code" in cm and ("name" in cm or "stock" in cm):
            return idx, cm
    raise RuntimeError("Nie znaleziono wiersza nagłówka (ARTYKUL:KOD / STAN)")


def compute_tags(
    months: float | None,
    stock: int | None,
    on_order: int,
    months_with: float | None,
    comment: str,
    die_type: str,
    thresholds: dict[str, float],
) -> tuple[list[str], int | None]:
    t: list[str] = []
    c = (comment or "").lower()
    d = (die_type or "").lower()
    crit = float(thresholds.get("critical_months", 1.0))
    order_m = float(thresholds.get("order_now_months", 2.0))
    ok_m = float(thresholds.get("ok_months", 3.0))
    m = months
    mw = months_with if months_with is not None else m
    if (m is not None and m < crit) or (stock == 0 and not on_order):
        t.append("critical")
    if m is not None and m < order_m:
        t.append("order_now")
    if on_order > 0:
        t.append("on_order")
    if "lidl" in c or "czekamy" in c:
        t.append("waiting_retailer")
    if "przej" in c or "przej" in d or "01.09" in c or "01.09" in d:
        t.append("transition")
    if "jest automat" in c:
        t.append("automat_alias")
    if mw is not None and mw >= ok_m and "critical" not in t:
        t.append("ok")
    lead = None
    if m is not None and m < order_m:
        lead = max(4, int(math.ceil((order_m - m) * 4.33)))
    return t, lead


def extract_automat_alias(comment: str) -> str | None:
    m = re.search(r"JEST\s+AUTOMAT\s+(\d{6,})", comment or "", re.I)
    return m.group(1) if m else None


def cross_ref_products(article_code: str, file_index: dict | None) -> list[str]:
    if not file_index or not article_code:
        return []
    needle = article_code
    found: list[str] = []
    for cat in file_index.get("categories") or []:
        for prod in cat.get("products") or []:
            pid = prod.get("id") or prod.get("slug") or ""
            blob = " ".join(
                [
                    str(prod.get("name") or ""),
                    str(prod.get("search_blob") or ""),
                    " ".join(str(x) for x in (prod.get("indexes") or [])),
                    " ".join(str(x) for x in (prod.get("index_bases") or [])),
                ]
            )
            for var in prod.get("variants") or []:
                blob += " " + str(var.get("path") or "") + " " + str(var.get("index") or "")
            if needle in blob and pid and pid not in found:
                found.append(pid)
    return found[:8]


def build_entry(
    cells: tuple,
    cm: dict[str, int],
    thresholds: dict[str, float],
    file_index: dict | None,
) -> dict[str, Any] | None:
    def at(key: str):
        i = cm.get(key)
        if i is None or i >= len(cells):
            return None
        return cells[i]

    raw_code = norm_key(at("article_code"))
    m = ARTICLE_RE.search(raw_code) if raw_code else None
    code = m.group(1) if m else re.sub(r"[^\d]", "", raw_code)[:10]
    if not code or len(code) < 5:
        return None
    name = norm_key(at("name"))
    if not name:
        return None
    extra = norm_key(at("extra_name"))
    if extra in ("-", "—", "–"):
        extra = ""
    die_type = norm_key(at("die_type"))
    comment = norm_key(at("comment"))
    if comment in ("0", "-"):
        comment = ""
    # die_type may hold transition note
    if "przej" in die_type.lower() and "przej" not in comment.lower():
        if comment:
            comment = comment + " · " + die_type
        else:
            comment = die_type
        die_type = "przejściowy"
    avg = parse_int(at("avg_monthly_usage"))
    stock = parse_int(at("stock"))
    months = parse_number(at("months_of_stock"))
    on_order = parse_int(at("on_order")) or 0
    mw = parse_number(at("months_with_order"))
    tags, lead = compute_tags(months, stock, on_order, mw, comment, die_type, thresholds)
    alias = extract_automat_alias(comment)
    linked = cross_ref_products(code, file_index)
    return {
        "article_code": code,
        "extra_name": extra or None,
        "name": name,
        "avg_monthly_usage": avg,
        "stock": stock,
        "months_of_stock": months,
        "on_order": on_order,
        "months_with_order": mw,
        "die_type": die_type or "",
        "comment": comment,
        "automat_alias_code": alias,
        "linked_wyk_kod": None,
        "linked_product_ids": linked,
        "tags": tags,
        "order_lead_weeks": lead,
    }


def load_prev_meta() -> dict[str, Any]:
    try:
        prev = json.loads(OUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return prev if isinstance(prev, dict) else {}


def import_from_rows(
    rows: list[tuple],
    *,
    source: str,
    file_index: dict | None = None,
) -> dict[str, Any]:
    header_idx, cm = find_header(rows)
    prev = load_prev_meta()
    thresholds = prev.get("thresholds") or {
        "critical_months": 1.0,
        "order_now_months": 2.0,
        "ok_months": 3.0,
    }
    entries: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows[header_idx + 1 :]:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue
        ent = build_entry(row, cm, thresholds, file_index)
        if not ent:
            continue
        code = ent["article_code"]
        if code in seen:
            continue
        seen.add(code)
        entries.append(ent)
    out = {
        "version": 1,
        "updated_at": utc_now(),
        "source_xlsx": source,
        "entry_count": len(entries),
        "thresholds": thresholds,
        "stakeholders": prev.get("stakeholders")
        or {
            "zakupy": ["Anna Polańska", "Marta Zasępa", "Justyna Zroślak"],
            "inni": [
                "Karolina Poznar",
                "Szymon Ryngwelski",
                "Krzysztof Wieczorek",
                "Sylwia Zarychta",
                "Beata Ścibik",
                "Agata Karoń",
            ],
        },
        "schedule_lead_days": prev.get("schedule_lead_days")
        or {
            "new_product_existing_die": 46,
            "new_flavor_family": 30,
            "reformat": 19,
            "export_consult": 5,
            "export_legal": 10,
        },
        "entries": entries,
    }
    return out


def import_path(path: Path, *, dry_run: bool = False, write: bool = True) -> dict[str, Any]:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(str(path))
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xlsm"):
        rows = load_rows_xlsx(path)
    elif suffix == ".csv":
        rows = load_rows_csv(path)
    else:
        raise RuntimeError(f"Unsupported format: {suffix}")
    fi = None
    fi_path = WEB / "data" / "file-index.json"
    if fi_path.exists():
        try:
            fi = json.loads(fi_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            fi = None
    data = import_from_rows(rows, source=str(path).replace("\\", "/"), file_index=fi)
    if write and not dry_run:
        OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return data


def main() -> int:
    ap = argparse.ArgumentParser(description="Import sleeve stock XLSX/CSV")
    ap.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    data = import_path(args.xlsx, dry_run=args.dry_run)
    print(f"ok entries={data.get('entry_count')} source={data.get('source_xlsx')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
