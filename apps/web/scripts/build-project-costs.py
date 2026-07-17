# -*- coding: utf-8 -*-
"""
Build project-costs.json from Asana CSV + cost-rates.json + invoices.json.
Usage: python apps/web/scripts/build-project-costs.py
"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # apps/web
DAM = ROOT.parent.parent  # P:/DAM when path is P:/DAM/apps/web/scripts
# Path: apps/web/scripts -> parents[0]=scripts, [1]=web, [2]=apps -> need parents[1] for web, parents[2] for apps, parents[3] for DAM
# Actually: __file__ = P:/DAM/apps/web/scripts/build-project-costs.py
# parents[0] = scripts, [1] = web, [2] = apps, [3] = DAM
WEB = Path(__file__).resolve().parents[1]
DAM_ROOT = Path(__file__).resolve().parents[3]

CSV_PATH = DAM_ROOT / "data" / "seeds" / "asana-tasks.csv"
RATES_PATH = WEB / "data" / "cost-rates.json"
INVOICES_PATH = WEB / "data" / "invoices.json"
OUT_PATH = WEB / "data" / "project-costs.json"


def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s


def parse_date(val: str) -> date | None:
    val = (val or "").strip()
    if not val:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d.%m.%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(val[:10], fmt).date()
        except ValueError:
            continue
    # ISO with time
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def short_label(project: str) -> str:
    p = project.strip()
    if p.startswith("(DK)"):
        p = p[4:].strip()
    # drop trailing | C/xx/yyyy
    p = re.sub(r"\s*\|\s*C/\d+/\d+\s*$", "", p)
    if len(p) > 42:
        p = p[:39] + "..."
    return p or project


def match_task_hours(task_name: str, task_hours: dict) -> tuple[float, str]:
    n = norm(task_name)
    best_key = "default"
    best_len = 0
    for key, hours in task_hours.items():
        if key == "default":
            continue
        kn = norm(key)
        if kn in n and len(kn) > best_len:
            best_key = key
            best_len = len(kn)
    return float(task_hours.get(best_key, task_hours.get("default", 4))), best_key


def hourly_rate(person_cfg: dict, avg_hours: float) -> float:
    net = float(person_cfg.get("net", 5500))
    mult = float(person_cfg.get("employer_mult", 1.4))
    if avg_hours <= 0:
        avg_hours = 168
    return (net * mult) / avg_hours


def project_allowed(name: str, prefixes: list[str]) -> bool:
    if not name or name == "(brak)":
        return False
    n = name.strip()
    for pref in prefixes:
        if n.startswith(pref) or n.upper().startswith(pref.upper()):
            return True
    # also allow exact bucket names
    if n.upper() in ("MARKETING", "E-COMMERCE"):
        return True
    return False


def primary_project(projects_field: str) -> str:
    parts = [p.strip() for p in (projects_field or "").split(",") if p.strip()]
    return parts[0] if parts else ""


def match_invoices(project_name: str, invoices: list[dict]) -> list[dict]:
    pn = norm(project_name)
    # extract distinctive tokens
    tokens = [t for t in re.split(r"[^\w]+", pn) if len(t) >= 5]
    matched = []
    for inv in invoices:
        ip = norm(inv.get("project", ""))
        hit = False
        if any(t in ip for t in tokens if t not in ("mini", "batoniki", "opakowania")):
            hit = True
        # special aliases
        if "cynamon" in pn and "cynamon" in ip:
            hit = True
        if "tuba" in pn and "tuba" in ip:
            hit = True
        if "banoffee" in pn and "banoffee" in ip:
            hit = True
        if "tiramisu" in pn and "tiramisu" in ip:
            hit = True
        if "nuggets" in pn and "nuggets" in ip:
            hit = True
        if "parow" in pn and "parow" in ip:
            hit = True
        if "orzechow" in pn and "orzechow" in ip:
            hit = True
        if hit:
            matched.append(
                {
                    "id": inv.get("id"),
                    "label": inv.get("project"),
                    "amount": float(inv.get("amount") or 0),
                    "status": inv.get("status"),
                    "type": inv.get("type"),
                }
            )
    return matched


def main() -> None:
    rates = json.loads(RATES_PATH.read_text(encoding="utf-8"))
    invoices_data = json.loads(INVOICES_PATH.read_text(encoding="utf-8"))
    invoices = invoices_data.get("invoices") or []

    people_rates = rates.get("people") or {}
    default_person = rates.get("default_person") or {}
    task_hours_map = rates.get("task_hours") or {"default": 4}
    direct_catalog = rates.get("direct_costs") or {}
    prefixes = rates.get("include_project_prefixes") or ["(DK)"]
    avg_hours = float(rates.get("avg_monthly_hours") or 168)
    today = date.today()

    # group tasks by project
    by_project: dict[str, list[dict]] = defaultdict(list)

    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            proj = primary_project(row.get("Projects") or "")
            if not project_allowed(proj, prefixes):
                continue
            by_project[proj].append(row)

    projects_out = []

    for project_name, rows in sorted(by_project.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        dates = []
        for r in rows:
            for key in ("Created At", "Start Date", "Completed At", "Due Date"):
                d = parse_date(r.get(key) or "")
                if d:
                    dates.append(d)
        start = min(dates) if dates else today
        end_candidates = [d for d in dates if d]
        # prefer max of completed/due, else today
        end = max(end_candidates) if end_candidates else today
        if end < start:
            end = start
        if end < today and any(not parse_date(r.get("Completed At") or "") for r in rows):
            end = today

        duration_days = max(1, (end - start).days)
        duration_months = round(duration_days / 30.4375, 2)

        # person hours
        person_hours: dict[str, float] = defaultdict(float)
        person_task_count: dict[str, int] = defaultdict(int)
        person_match_keys: dict[str, list[str]] = defaultdict(list)
        all_task_names = []

        for r in rows:
            name = (r.get("Name") or "").strip()
            assignee = (r.get("Assignee") or "").strip() or "Nieprzypisane"
            hours, matched = match_task_hours(name, task_hours_map)
            person_hours[assignee] += hours
            person_task_count[assignee] += 1
            person_match_keys[assignee].append(f"{name} ({matched}:{hours}h)")
            all_task_names.append(name)

        people_lines = []
        labor_total = 0.0
        for person, hours in sorted(person_hours.items(), key=lambda kv: -kv[1]):
            if person == "Nieprzypisane":
                cfg = dict(default_person)
                cfg["role"] = "Nieprzypisane"
            else:
                cfg = people_rates.get(person) or default_person
            allocation = float(cfg.get("allocation", 0.25))
            cap = duration_months * 160.0 * allocation
            capped_hours = min(hours, cap) if cap > 0 else hours
            rate = hourly_rate(cfg, avg_hours)
            cost = round(capped_hours * rate, 2)
            labor_total += cost
            people_lines.append(
                {
                    "name": person,
                    "role": cfg.get("role", "Wspolpracownik"),
                    "hours_raw": round(hours, 2),
                    "hours": round(capped_hours, 2),
                    "hourly_rate": round(rate, 2),
                    "cost": cost,
                    "tasks": person_task_count[person],
                    "net": cfg.get("net"),
                    "employer_mult": cfg.get("employer_mult"),
                }
            )

        # direct costs from catalog + keyword presence
        blob = " ".join(all_task_names) + " " + project_name
        blob_n = norm(blob)
        direct_lines = []
        direct_total = 0.0
        for key, spec in direct_catalog.items():
            keywords = spec.get("keywords") or [key]
            if any(norm(k) in blob_n for k in keywords):
                # MARKETING bucket always gets marketing line once
                amount = float(spec.get("amount") or 0)
                # count distinct matching task types lightly: once per category
                direct_lines.append(
                    {
                        "key": key,
                        "label": spec.get("label") or key,
                        "amount": amount,
                    }
                )
                direct_total += amount

        # bucket MARKETING always include marketing if project is MARKETING
        if project_name.upper().startswith("MARKETING"):
            if not any(d["key"] == "marketing" for d in direct_lines):
                mspec = direct_catalog.get("marketing") or {"label": "Marketing / kampania", "amount": 500}
                direct_lines.append(
                    {"key": "marketing", "label": mspec.get("label"), "amount": float(mspec.get("amount") or 500)}
                )
                direct_total += float(mspec.get("amount") or 500)

        inv_matched = match_invoices(project_name, invoices)
        inv_total = round(sum(i["amount"] for i in inv_matched), 2)

        open_count = sum(1 for r in rows if not parse_date(r.get("Completed At") or ""))
        people_names = sorted({p["name"] for p in people_lines if p["name"] != "Nieprzypisane"})

        labor_total = round(labor_total, 2)
        direct_total = round(direct_total, 2)
        # Grand total for ops: labor + direct (invoices shown separately as accounting reference)
        total = round(labor_total + direct_total, 2)

        projects_out.append(
            {
                "id": re.sub(r"[^a-zA-Z0-9]+", "-", project_name).strip("-").lower()[:64],
                "name": project_name,
                "label": short_label(project_name),
                "start": start.isoformat(),
                "end": end.isoformat(),
                "duration_days": duration_days,
                "duration_months": duration_months,
                "task_count": len(rows),
                "open_tasks": open_count,
                "people": people_names,
                "labor": people_lines,
                "labor_total": labor_total,
                "direct": direct_lines,
                "direct_total": direct_total,
                "invoices": inv_matched,
                "invoices_total": inv_total,
                "total": total,
                "total_with_invoices": round(total + inv_total, 2),
            }
        )

    # Prefer DK product tabs first, then buckets
    def sort_key(p: dict) -> tuple:
        name = p["name"]
        is_dk = 0 if name.startswith("(DK)") else 1
        return (is_dk, -p["total"], name)

    projects_out.sort(key=sort_key)

    open_sum = round(sum(p["total"] for p in projects_out if p["open_tasks"] > 0), 2)
    all_sum = round(sum(p["total"] for p in projects_out), 2)

    out = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source_csv": str(CSV_PATH).replace("\\", "/"),
        "rates_version": rates.get("version"),
        "currency": "PLN",
        "project_count": len(projects_out),
        "sum_open_projects": open_sum,
        "sum_all_projects": all_sum,
        "projects": projects_out,
    }

    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({len(projects_out)} projects, open_sum={open_sum})")
    # print Cynamonka sample
    for p in projects_out:
        if "cynamon" in norm(p["name"]):
            print("Cynamonka:", p["label"], "months=", p["duration_months"], "people=", p["people"], "total=", p["total"])
            break


if __name__ == "__main__":
    main()
