#!/usr/bin/env python3
"""One-shot patch: halve labor hours, FMCG direct chains, isTest, linked_product_id."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PC_PATH = ROOT / "data" / "project-costs.json"
CAT_PATH = ROOT / "data" / "product-catalog.json"

PRODUCT_LINKS = {
    "dk-mini-batoniki-a-la-cynamonka-102-g-c-28-2026": "dk-mini-batoniki-a-la-cynamonka-102-g-c-28-2026",
    "dk-mini-batoniki-a-la-kruche-ciasto-ze-liwk-c-29-2026": "dk-mini-batoniki-a-la-kruche-ciasto-ze-liwk-c-29-2026",
}


def fmcg_doypack_chain(batch_units: int, printer: str) -> list:
    cartons = max(1, math.ceil(batch_units / 24))
    pallets = max(1, math.ceil(cartons / 54))
    km = 220
    lines = [
        {"key": "prepress", "label": "Prepress / pliki do druku", "department": "DTP", "unit": "h", "qty": 6, "rate": 85.0, "amount": 510.0},
        {"key": "proof", "label": "Korekty proof i akceptacja", "department": "DTP", "unit": "h", "qty": 4, "rate": 85.0, "amount": 340.0},
        {"key": "trip", "label": f"Wyjazd na zadruk ({printer})", "department": "Logistyka", "unit": "km", "qty": km, "rate": 2.45, "amount": round(km * 2.45, 2)},
        {"key": "print_doy", "label": "Druk doypack / flexo", "department": "Produkcja", "unit": "szt", "qty": batch_units, "rate": 0.38, "amount": round(batch_units * 0.38, 2)},
        {"key": "foil", "label": "Surowiec / folia laminowana", "department": "Zakupy", "unit": "szt", "qty": batch_units, "rate": 0.31, "amount": round(batch_units * 0.31, 2)},
        {"key": "label", "label": "Etykieta samoprzylepna", "department": "Zakupy", "unit": "szt", "qty": batch_units, "rate": 0.12, "amount": round(batch_units * 0.12, 2)},
        {"key": "carton_unit", "label": "Kartonik jednostkowy", "department": "Zakupy", "unit": "szt", "qty": cartons, "rate": 5.8, "amount": round(cartons * 5.8, 2)},
        {"key": "carton_bulk", "label": "Karton zbiorczy (24 szt.)", "department": "Zakupy", "unit": "szt", "qty": cartons, "rate": 9.4, "amount": round(cartons * 9.4, 2)},
        {"key": "tape", "label": "Taśma pakowa (rolki)", "department": "Magazyn", "unit": "rolka", "qty": max(6, pallets + 4), "rate": 92.0, "amount": round(max(6, pallets + 4) * 92.0, 2)},
        {"key": "pack_labor", "label": "Robocizna pakowania", "department": "Produkcja", "unit": "h", "qty": 32, "rate": 48.0, "amount": 1536.0},
        {"key": "pallet", "label": "Paleta EPAL (wynajem)", "department": "Logistyka", "unit": "szt", "qty": pallets, "rate": 38.0, "amount": round(pallets * 38.0, 2)},
        {"key": "palletize", "label": "Paletyzacja (usługa)", "department": "Logistyka", "unit": "paleta", "qty": pallets, "rate": 110.0, "amount": round(pallets * 110.0, 2)},
        {"key": "freight", "label": "Transport palet / spedycja", "department": "Logistyka", "unit": "paleta", "qty": pallets, "rate": 485.0, "amount": round(pallets * 485.0, 2)},
        {"key": "gs1", "label": "GS1 / kody kreskowe", "department": "Regulacje", "unit": "partia", "qty": 1, "rate": 920.0, "amount": 920.0},
        {"key": "lab", "label": "Badania laboratoryjne (skrót)", "department": "QA", "unit": "partia", "qty": 1, "rate": 2100.0, "amount": 2100.0},
        {"key": "warehouse", "label": "Przyjęcie magazynowe", "department": "Magazyn", "unit": "partia", "qty": 1, "rate": 780.0, "amount": 780.0},
    ]
    for row in lines:
        row["isTest"] = True
        row["source"] = "seed"
    return lines


def fmcg_mini_bar_chain(batch_units: int) -> list:
    chain = fmcg_doypack_chain(batch_units, "Drukarnia Argraf, Poznań (ocena: 4/5)")
    # folia/wrapper baton — wyższy metraż
    for row in chain:
        if row["key"] == "foil":
            row["label"] = "Surowiec / folia flow-pack"
            row["rate"] = 0.34
            row["amount"] = round(batch_units * 0.34, 2)
        if row["key"] == "print_doy":
            row["label"] = "Druk opakowania flow-pack"
            row["rate"] = 0.29
            row["amount"] = round(batch_units * 0.29, 2)
    return chain


def pick_chain(project_id: str, name: str) -> list:
    blob = (project_id + " " + name).lower()
    if "figa" in blob or "doypack" in blob or "datesy" in blob or "lulki" in blob:
        return fmcg_doypack_chain(12000, "PrintPack Kalisz (ocena: 4/5)")
    if "mini baton" in blob or "cynamon" in blob or "nerkowc" in blob:
        return fmcg_mini_bar_chain(8000)
    if "burger" in blob or "nugget" in blob:
        return fmcg_doypack_chain(10000, "Interprint, Łódź (ocena: 5/5)")
    return fmcg_doypack_chain(6000, "PrintPack Kalisz (ocena: 4/5)")


def halve_labor(project: dict) -> None:
    total = 0.0
    for row in project.get("labor") or []:
        h = float(row.get("hours") or row.get("hours_raw") or 0)
        h2 = round(h / 2.0, 2)
        rate = float(row.get("hourly_rate") or 0)
        row["hours_raw"] = h2
        row["hours"] = h2
        row["cost"] = round(h2 * rate, 2)
        total += row["cost"]
    project["labor_total"] = round(total, 2)


def recalc_totals(project: dict) -> None:
    direct = project.get("direct") or []
    project["direct_total"] = round(sum(float(r.get("amount") or 0) for r in direct), 2)
    inv = project.get("invoices") or []
    project["invoices_total"] = round(sum(float(r.get("amount") or 0) for r in inv), 2)
    project["total"] = round(project["labor_total"] + project["direct_total"], 2)
    project["total_with_invoices"] = round(project["total"] + project["invoices_total"], 2)


def main() -> None:
    data = json.loads(PC_PATH.read_text(encoding="utf-8"))
    data["isTest"] = True
    data["source"] = "seed"
    data["generated_at"] = "2026-09-14T12:00:00"

    sum_open = 0.0
    sum_all = 0.0

    figa_exists = any(p.get("id") == "figa-z-makiem-owocowe" for p in data["projects"])

    for project in data["projects"]:
        pid = project.get("id") or ""
        if pid in PRODUCT_LINKS:
            project["linked_product_id"] = PRODUCT_LINKS[pid]
        elif "mini-batoniki-a-la-cynamonka" in pid:
            project["linked_product_id"] = "dk-mini-batoniki-a-la-cynamonka-102-g-c-28-2026"

        project["isTest"] = True
        project["source"] = "seed"
        halve_labor(project)

        if project.get("direct") and pid not in ("marketing", "e-commerce"):
            project["direct"] = pick_chain(pid, project.get("name") or "")
        for inv in project.get("invoices") or []:
            inv["isTest"] = True
            inv["source"] = "seed"

        recalc_totals(project)
        if project.get("invoices"):
            for inv in project["invoices"]:
                inv["amount"] = project["total"]

        if project.get("open_tasks"):
            sum_open += project["total"]
        sum_all += project["total"]

    if not figa_exists:
        labor = [
            {"name": "Krzysztof Wieczorek", "role": "Grafik", "hours_raw": 38.0, "hours": 38.0, "hourly_rate": 53.57, "cost": 2035.66, "tasks": 8, "net": 6000, "employer_mult": 1.5},
            {"name": "Anna Polańska", "role": "Koordynacja / PM", "hours_raw": 6.0, "hours": 6.0, "hourly_rate": 58.33, "cost": 349.98, "tasks": 2, "net": 7000, "employer_mult": 1.4},
            {"name": "Nieprzypisane", "role": "Nieprzypisane", "hours_raw": 4.0, "hours": 4.0, "hourly_rate": 45.83, "cost": 183.32, "tasks": 1, "net": 5500, "employer_mult": 1.4},
        ]
        direct = pick_chain("figa-z-makiem-owocowe", "Figa Z Makiem DOYPACK")
        labor_total = round(sum(x["cost"] for x in labor), 2)
        direct_total = round(sum(x["amount"] for x in direct), 2)
        total = round(labor_total + direct_total, 2)
        figa = {
            "id": "figa-z-makiem-owocowe",
            "linked_product_id": "figa-z-makiem-owocowe",
            "name": "(DK) Figa Z Makiem | DOYPACK owocowe",
            "label": "Figa Z Makiem",
            "start": "2026-05-12",
            "end": "2026-07-31",
            "duration_days": 80,
            "duration_months": 2.63,
            "task_count": 11,
            "open_tasks": 2,
            "people": ["Anna Polańska", "Krzysztof Wieczorek"],
            "labor": labor,
            "labor_total": labor_total,
            "direct": direct,
            "direct_total": direct_total,
            "invoices": [],
            "invoices_total": 0.0,
            "total": total,
            "total_with_invoices": total,
            "isTest": True,
            "source": "seed",
        }
        data["projects"].insert(0, figa)
        sum_all += total
        sum_open += total

    data["sum_open_projects"] = round(sum_open, 2)
    data["sum_all_projects"] = round(sum_all, 2)
    data["project_count"] = len(data["projects"])

    PC_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    catalog = json.loads(CAT_PATH.read_text(encoding="utf-8"))
    catalog["updated_at"] = "2026-09-14T12:00:00+02:00"
    catalog["isTest"] = True
    catalog["products"]["figa-z-makiem-owocowe"] = {
        "index_primary": "6300808.00",
        "shop_url": "https://dobrakaloria.pl/produkty/figa-z-makiem",
        "shop_category_slug": "lulki",
        "price_pln": 14.99,
        "dimensions_mm": {"w": 140, "h": 170, "d": 80},
        "weight_g": {"net": 65, "gross": 72},
        "units_per_bulk_case": 24,
        "bulk_packaging_ref": "pak:doypack-24",
        "bulk_case_mm": {"w": 400, "h": 300, "d": 180},
        "palletization": {
            "pallet_type": "EPAL 1200×1000 mm",
            "cases_per_layer": 9,
            "layers": 6,
            "cases_per_pallet": 54,
            "units_per_pallet": 1296,
            "net_weight_kg": 84.24,
            "gross_weight_kg": 108.0,
            "max_payload_kg": 1250,
            "formula_pl": "Karton 400×300×180 mm: 3×3 na warstwie (1200×1000). 6 warstw = 54 kartony × 24 szt. = 1296 szt. Masa ~108 kg << 1250 kg (EPAL).",
        },
        "notes": "Doypack lulki owocowe (TESTOWE seed).",
        "isTest": True,
        "source": "seed",
    }
    if "pak:doypack-24" not in (catalog.get("bulk_packs") or {}):
        catalog.setdefault("bulk_packs", {})
    CAT_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("OK patched", PC_PATH, CAT_PATH)


if __name__ == "__main__":
    main()
