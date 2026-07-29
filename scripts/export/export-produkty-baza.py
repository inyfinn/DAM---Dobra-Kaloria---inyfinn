#!/usr/bin/env python3
"""
Eksport bazy produktów DAM (DK + GC) do Markdown.

Domyślny plik żywy na dysku Marketing:
  X:/Marketing/- POLSKA/01 - PRODUKTY/DAM-PRODUKTY-BAZA.md

Uruchamiany automatycznie po każdym build-file-index.py.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INDEX_PATH = ROOT / "apps" / "web" / "data" / "file-index.json"
SLEEVE_PATH = ROOT / "apps" / "web" / "data" / "sleeve-stock.json"
WYK_PATH = ROOT / "apps" / "web" / "data" / "wykrojniki-registry.json"
DEFAULT_OUT = Path(r"X:/Marketing/- POLSKA/01 - PRODUKTY/DAM-PRODUKTY-BAZA.md")

ROLE_LABELS = {
    "artwork": "Plik źródłowy projektu graficznego",
    "prev": "Podgląd PDF projektu",
    "print_pdf": "Pliki do druku",
    "viz_3d": "Wizualizacje (wizki)",
    "tech": "Elementy / składniki",
    "marketing": "Materiały marketingowe",
    "karta": "Karta wprowadzenia",
    "presentation": "Prezentacja",
}

CHECK_ROLES = [
    "artwork",
    "prev",
    "print_pdf",
    "viz_3d",
    "tech",
    "marketing",
    "karta",
    "presentation",
]

VIZ_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"}
ARCHIVE_EXTS = {"zip", "rar", "7z"}
ARTWORK_EXTS = {"ai", "psd", "indd"}


def file_ext(name: str) -> str:
    m = re.search(r"\.([a-z0-9]+)$", str(name or "").lower())
    return m.group(1) if m else ""


def digits_only(s: str) -> str:
    return re.sub(r"\D", "", str(s or ""))


def is_viz_image(name: str) -> bool:
    return file_ext(name) in VIZ_EXTS


def is_archive_name(name: str) -> bool:
    return file_ext(name) in ARCHIVE_EXTS


def pick_latest_revision(product: dict) -> dict | None:
    revs = product.get("revisions") or []
    if not revs:
        return None
    candidates = [r for r in revs if r and r.get("is_latest")]
    if not candidates:
        candidates = list(revs)

    def sort_key(r: dict) -> tuple:
        ib = int(digits_only(r.get("index_base") or r.get("index") or "0") or 0)
        fbr = r.get("files_by_role") or {}
        viz_n = len([f for f in (fbr.get("viz") or []) if is_viz_image(f.get("name", ""))])
        wiz_n = len([f for f in (r.get("wizki") or []) if is_viz_image(f.get("name", ""))])
        return (-ib, -(viz_n + wiz_n), str(r.get("date") or ""), str(r.get("folder") or ""))

    candidates.sort(key=sort_key)
    return candidates[0]


def list_latest_revisions_by_index(product: dict) -> list[dict]:
    revs = product.get("revisions") or []
    by_index: dict[str, dict] = {}
    for r in revs:
        if not r or not r.get("index") or r.get("in_archive"):
            continue
        key = str(r["index"])
        cur = by_index.get(key)
        if not cur:
            by_index[key] = r
            continue
        if r.get("is_latest") and not cur.get("is_latest"):
            by_index[key] = r
            continue
        if r.get("is_latest") and cur.get("is_latest"):
            if str(r.get("date") or "") > str(cur.get("date") or ""):
                by_index[key] = r

    def sort_key(k: str) -> tuple:
        r = by_index[k]
        ib = int(digits_only(r.get("index_base") or k or "0") or 0)
        return (-ib, k)

    return [by_index[k] for k in sorted(by_index.keys(), key=sort_key)]


def roles_from_revision(rev: dict | None, product: dict) -> dict[str, bool]:
    fbr = (rev or {}).get("files_by_role") or {}
    src = fbr.get("source") or []
    prt = fbr.get("print") or []
    viz = [f for f in (fbr.get("viz") or []) if is_viz_image(f.get("name", ""))]
    wizki = [f for f in ((rev or {}).get("wizki") or []) if is_viz_image(f.get("name", ""))]
    elements = fbr.get("elements") or []
    archive_print = [
        f
        for f in (fbr.get("viz") or []) + ((rev or {}).get("wizki") or [])
        if is_archive_name(f.get("name", ""))
    ]

    artwork = any(file_ext(f.get("name", "")) in ARTWORK_EXTS for f in src)
    prev = any(
        re.search(r"\bPREV\b", str(f.get("name", "")).upper())
        or (re.search(r"[-_]F([-_.]|$)", str(f.get("name", "")).upper()) and "FQ" not in str(f.get("name", "")).upper())
        for f in src
    )
    viz_3d = bool(viz or wizki)
    print_pdf = bool(prt) or bool(archive_print) or any(
        "FQ" in str(f.get("name", "")).upper() and file_ext(f.get("name", "")) == "pdf" for f in src
    )
    slots = ((rev or {}).get("slots") or [])
    tech = bool(elements) or any(
        any(x in str(s).upper() for x in ("ELEMENTY", "ELEMENTS", "SKLADNIKI", "INGREDIENTS", "TECH"))
        for s in slots
    )
    marketing = any((m or {}).get("file_count", 0) > 0 for m in (product.get("related_materials") or []))
    karta = bool(fbr.get("karty_wprowadzenia")) or any(
        "KARTA" in str(f.get("name", "")).upper() and "WPROWADZ" in str(f.get("name", "")).upper() for f in src
    )
    presentation = bool(fbr.get("strategia")) or any(
        file_ext(f.get("name", "")) in {"pptx", "ppt", "key"}
        and re.search(r"PREZENT|STRATEG|POZYCJON", str(f.get("name", "")).upper())
        for f in src
    )
    return {
        "artwork": artwork,
        "prev": prev,
        "print_pdf": print_pdf,
        "viz_3d": viz_3d,
        "tech": tech,
        "marketing": marketing,
        "karta": karta,
        "presentation": presentation,
    }


def completeness(flags: dict[str, bool]) -> str:
    missing = [r for r in ("artwork", "viz_3d", "print_pdf") if not flags.get(r)]
    return "Kompletny" if not missing else "Niekompletny"


def clean_title(product: dict) -> str:
    name = product.get("display_name") or product.get("name") or product.get("id") or ""
    return re.sub(r"\s*—\s*\[[^\]]+\]\s*$", "", str(name)).strip()


def category_label(cat: str) -> str:
    return re.sub(r"^\s*\d+\s*[-–—]\s*", "", str(cat or "")).strip()


def yn(v: bool) -> str:
    return "TAK" if v else "NIE"


def tags_flat(product: dict) -> str:
    tg = product.get("tag_groups") or {}
    parts: list[str] = []
    for key in ("smak", "typ", "opakowanie", "autor", "osoba", "inne"):
        vals = tg.get(key) or []
        if vals:
            parts.append(f"{key}: {', '.join(vals)}")
    if not parts:
        return ", ".join(product.get("tags") or [])
    return " | ".join(parts)


def revision_summary(rev: dict) -> str:
    fbr = rev.get("files_by_role") or {}
    wiz = len(rev.get("wizki") or [])
    slots = ", ".join(rev.get("slots") or [])
    return (
        f"- **Folder:** {rev.get('folder', '')}\n"
        f"- **Indeks:** {rev.get('index', '')} | **Data:** {rev.get('date', '')} | **Nośnik:** {rev.get('carrier', '')}\n"
        f"- **Ścieżka:** `{rev.get('path', '')}`\n"
        f"- **Sloty:** {slots or '—'}\n"
        f"- **Pliki:** projekt={len(fbr.get('source') or [])}, druk={len(fbr.get('print') or [])}, "
        f"viz={len(fbr.get('viz') or [])}, wizki={wiz}, elementy={len(fbr.get('elements') or [])}\n"
    )


def build_row(seq: int, product: dict) -> dict:
    revs = list_latest_revisions_by_index(product)
    if not revs:
        single = pick_latest_revision(product)
        revs = [single] if single else []
    rev = revs[0] if revs else pick_latest_revision(product)
    flags = roles_from_revision(rev, product)
    indexes = [r.get("index") for r in revs if r.get("index")]
    if not indexes:
        indexes = list(product.get("indexes") or product.get("index_bases") or [])
    missing = [ROLE_LABELS[r] for r in ("artwork", "viz_3d", "print_pdf") if not flags.get(r)]
    wiz_count = int((rev or {}).get("wizki_count") or len((rev or {}).get("wizki") or []))
    return {
        "lp": seq,
        "id": product.get("id", ""),
        "nazwa": clean_title(product),
        "marka": product.get("brand", "DK"),
        "kategoria": category_label(product.get("category", "")),
        "podkategoria": product.get("subcategory_label") or product.get("subcategory_slug") or "",
        "indeksy": ", ".join(str(i) for i in indexes),
        "status": completeness(flags),
        "brakuje": "; ".join(missing) if missing else "",
        "projekt_graficzny": yn(flags["artwork"]),
        "podglad_pdf": yn(flags["prev"]),
        "wizki": yn(flags["viz_3d"]),
        "wizki_count": wiz_count,
        "druk": yn(flags["print_pdf"]),
        "elementy": yn(flags["tech"]),
        "marketing": yn(flags["marketing"]),
        "karta": yn(flags["karta"]),
        "prezentacja": yn(flags["presentation"]),
        "tagi": tags_flat(product),
        "sciezka": product.get("path", ""),
        "rewizje": len(product.get("revisions") or []),
        "product": product,
        "flags": flags,
        "revs": revs,
        "latest_rev": rev,
    }


def esc_md(s: str) -> str:
    return str(s or "").replace("|", "\\|").replace("\n", " ")


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def index_base_digits(raw: str) -> str:
    s = str(raw or "").strip()
    if not s:
        return ""
    if "." in s:
        s = s.split(".", 1)[0]
    return digits_only(s)


def index_tokens(product: dict) -> set[str]:
    """Bazy indeksów produktu (6300578, KAR000103, …) do cross-ref rękawków."""
    tokens: set[str] = set()

    def add(raw: str) -> None:
        s = str(raw or "").strip()
        if not s:
            return
        tokens.add(s)
        base = index_base_digits(s)
        if base:
            tokens.add(base)

    for idx in (product.get("indexes") or []) + (product.get("index_bases") or []):
        add(str(idx))
    for rev in product.get("revisions") or []:
        add(str(rev.get("index") or ""))
        add(str(rev.get("index_base") or ""))
    return {t for t in tokens if len(digits_only(t) or t) >= 5}


def sleeve_matches_product(entry: dict, product: dict, tokens: set[str]) -> bool:
    pid = str(product.get("id") or "")
    if pid and pid in (entry.get("linked_product_ids") or []):
        return True
    code = index_base_digits(str(entry.get("article_code") or ""))
    if not code or len(code) < 5:
        return False
    for t in tokens:
        td = index_base_digits(t) or digits_only(t)
        if td and code == td:
            return True
    return False


def wyk_matches_product(entry: dict, product: dict, tokens: set[str]) -> bool:
    pid = str(product.get("id") or "")
    if pid and pid in (entry.get("linked_product_ids") or []):
        return True
    raw_idx = str(entry.get("product_index") or "").strip()
    if not raw_idx or "separator" in raw_idx.lower():
        return False
    for token in re.findall(r"\d{5,9}(?:\.\d{2})?", raw_idx, re.I):
        if index_base_digits(token) in {index_base_digits(t) for t in tokens if index_base_digits(t)}:
            return True
    return False


def sleeve_tag_labels(tags: list[str]) -> str:
    labels = {
        "critical": "krytyczny",
        "order_now": "zamów teraz",
        "on_order": "w zamówieniu",
        "waiting_retailer": "czeka retailer",
        "transition": "przejściowy",
        "automat_alias": "alias automatu",
        "ok": "OK",
    }
    return ", ".join(labels.get(t, t) for t in (tags or []) if t)


def format_sleeve_short(entry: dict) -> str:
    code = entry.get("article_code") or "?"
    name = str(entry.get("name") or "").strip()
    parts = [f"{code}"]
    if name:
        parts.append(name[:48] + ("…" if len(name) > 48 else ""))
    stock = entry.get("stock")
    months = entry.get("months_of_stock")
    if stock is not None:
        parts.append(f"stan {stock}")
    if months is not None:
        parts.append(f"{months} msc")
    tags = sleeve_tag_labels(entry.get("tags") or [])
    if tags:
        parts.append(f"[{tags}]")
    return " — ".join(parts)


def format_wyk_short(entry: dict) -> str:
    kod = entry.get("kod") or "?"
    nazwa = str(entry.get("nazwa") or "").strip()
    rozmiar = str(entry.get("rozmiar") or "").strip()
    section = str(entry.get("section") or "").strip()
    bits = [kod]
    if nazwa:
        bits.append(nazwa)
    if rozmiar:
        bits.append(rozmiar)
    if section:
        bits.append(section)
    return " · ".join(bits)


def format_sleeve_detail(entry: dict) -> str:
    lines = [
        f"- **{entry.get('article_code', '?')}** — {entry.get('name', '')}",
    ]
    extra = []
    if entry.get("stock") is not None:
        extra.append(f"stan: **{entry['stock']}**")
    if entry.get("months_of_stock") is not None:
        extra.append(f"zapas: **{entry['months_of_stock']} msc**")
    if entry.get("on_order"):
        extra.append(f"w zamówieniu: **{entry['on_order']}**")
    if entry.get("die_type"):
        extra.append(f"wykrojnik (typ): {entry['die_type']}")
    tags = sleeve_tag_labels(entry.get("tags") or [])
    if tags:
        extra.append(f"tagi: {tags}")
    if entry.get("comment"):
        extra.append(f"uwagi: {entry['comment']}")
    if extra:
        lines.append("  - " + " | ".join(extra))
    return "\n".join(lines)


def format_wyk_detail(entry: dict) -> str:
    lines = [
        f"- **{entry.get('kod', '?')}** — {entry.get('nazwa', '')}",
    ]
    extra = []
    for key, label in (
        ("section", "sekcja"),
        ("rodzaj", "rodzaj"),
        ("rozmiar", "rozmiar"),
        ("drukarnia", "drukarnia"),
        ("podloze", "podłoże"),
        ("stacje_kolorow", "kolory"),
        ("uwagi", "uwagi"),
    ):
        val = str(entry.get(key) or "").strip()
        if val:
            extra.append(f"{label}: {val}")
    if entry.get("pdf_path"):
        extra.append(f"PDF: `{entry['pdf_path']}`")
    if entry.get("link_rule"):
        extra.append(f"reguła linku: {entry['link_rule']}")
    if extra:
        lines.append("  - " + " | ".join(extra))
    return "\n".join(lines)


def rekaw_revisions(product: dict) -> list[dict]:
    out: list[dict] = []
    for rev in product.get("revisions") or []:
        carrier = str(rev.get("carrier") or "").upper()
        folder = str(rev.get("folder") or "").upper()
        if any(x in carrier or x in folder for x in ("REKAW", "RĘKAW", "SLEEVE")):
            out.append(rev)
    return out


def build_packaging_by_product(
    products: list[dict],
    sleeve_data: dict | None,
    wyk_data: dict | None,
) -> dict[str, dict]:
    by_id: dict[str, dict] = {}
    sleeve_entries = (sleeve_data or {}).get("entries") or []
    wyk_entries = list(((wyk_data or {}).get("entries") or {}).values())

    for product in products:
        pid = str(product.get("id") or "")
        if not pid:
            continue
        tokens = index_tokens(product)
        sleeves = [e for e in sleeve_entries if sleeve_matches_product(e, product, tokens)]
        wykrojniki = [e for e in wyk_entries if wyk_matches_product(e, product, tokens)]
        sleeves.sort(key=lambda e: str(e.get("article_code") or ""))
        wykrojniki.sort(key=lambda e: str(e.get("kod") or ""))
        by_id[pid] = {
            "sleeves": sleeves,
            "wykrojniki": wykrojniki,
            "rekaw_revisions": rekaw_revisions(product),
        }
    return by_id


def packaging_summary_cell(pack: dict) -> tuple[str, str]:
    sleeves = pack.get("sleeves") or []
    wykrojniki = pack.get("wykrojniki") or []
    sleeve_txt = "; ".join(format_sleeve_short(s) for s in sleeves[:2])
    if len(sleeves) > 2:
        sleeve_txt += f"; +{len(sleeves) - 2}"
    wyk_txt = "; ".join(format_wyk_short(w) for w in wykrojniki[:2])
    if len(wykrojniki) > 2:
        wyk_txt += f"; +{len(wykrojniki) - 2}"
    if not sleeve_txt and pack.get("rekaw_revisions"):
        sleeve_txt = f"rewizje rękawa: {len(pack['rekaw_revisions'])}"
    return sleeve_txt or "—", wyk_txt or "—"


def sort_products(products: list[dict]) -> list[dict]:
    brand_order = {"DK": 0, "GC": 1}

    def key(p: dict) -> tuple:
        brand = str(p.get("brand") or "DK").upper()
        return (
            brand_order.get(brand, 9),
            str(p.get("category") or ""),
            clean_title(p).casefold(),
            str(p.get("id") or ""),
        )

    return sorted(products, key=key)


def render_markdown(data: dict, rows: list[dict], packaging: dict[str, dict]) -> str:
    generated = data.get("generated_at") or datetime.now().isoformat(timespec="seconds")
    roots = data.get("roots") or []
    complete = sum(1 for r in rows if r["status"] == "Kompletny")
    with_wizki = sum(1 for r in rows if r["wizki"] == "TAK")
    with_project = sum(1 for r in rows if r["projekt_graficzny"] == "TAK")
    dk_count = sum(1 for r in rows if r["marka"] == "DK")
    gc_count = sum(1 for r in rows if r["marka"] == "GC")
    with_sleeve = sum(1 for r in rows if (packaging.get(r["id"], {}).get("sleeves")))
    with_wyk = sum(1 for r in rows if (packaging.get(r["id"], {}).get("wykrojniki")))

    md: list[str] = []
    md.append("# DAM — baza produktów (DK + GC)")
    md.append("")
    md.append(
        "> **Plik żywy** — nadpisywany automatycznie po każdym skanie dysku Marketing "
        "(build-file-index / Skanuj dysk w DAM). Nie edytuj ręcznie — zmiany znikną przy następnym odświeżeniu."
    )
    md.append("")
    md.append(
        f"> Wygenerowano: **{generated}** | Źródło: `file-index.json` + `sleeve-stock.json` + "
        f"`wykrojniki-registry.json` | Produkty: **{len(rows)}**"
    )
    md.append("")
    md.append("## Źródła skanu")
    md.append("")
    for root in roots:
        md.append(f"- **{root.get('brand', '?')}:** `{root.get('path', '')}`")
    if not roots:
        md.append("- (brak metadanych roots w indeksie)")
    md.append("- **Stany rękawków:** `sleeve-stock.json` (import z STANY RĘKAWKÓW 2026.xlsx)")
    md.append("- **Wykrojniki Kubara:** `wykrojniki-registry.json`")
    md.append("")
    md.append("## Podsumowanie")
    md.append("")
    md.append(f"- **Łącznie produktów:** {len(rows)} (DK: {dk_count}, GC: {gc_count})")
    md.append(f"- **Kompletne** (projekt + wizki + druk): **{complete}**")
    md.append(f"- **Z wizkami:** **{with_wizki}**")
    md.append(f"- **Z plikiem projektu graficznego (AI/PSD/INDD):** **{with_project}**")
    md.append(f"- **Z dopasowanym stanem rękawa** (lista zakupów): **{with_sleeve}**")
    md.append(f"- **Z dopasowanym wykrojnikiem** (rejestr Kubara): **{with_wyk}**")
    md.append("")
    md.append("## Tabela wszystkich produktów")
    md.append("")
    md.append(
        "| LP | ID | Nazwa | Marka | Kategoria | Podkategoria | Indeksy | Rękaw / stan | Wykrojnik | "
        "Status | Projekt | Wizki | Druk | Elementy | Marketing | Karta | Prezentacja | Rewizje | Tagi | Ścieżka |"
    )
    md.append("|---:|---|---|---|---|---|---|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|---|")
    for r in rows:
        pack = packaging.get(r["id"], {})
        sleeve_cell, wyk_cell = packaging_summary_cell(pack)
        md.append(
            "| {lp} | {id} | {nazwa} | {marka} | {kat} | {sub} | {idx} | {sleeve} | {wyk} | {status} | "
            "{art} | {wiz} | {prt} | {tech} | {mkt} | {karta} | {prez} | {rev} | {tagi} | `{path}` |".format(
                lp=r["lp"],
                id=esc_md(r["id"]),
                nazwa=esc_md(r["nazwa"]),
                marka=esc_md(r["marka"]),
                kat=esc_md(r["kategoria"]),
                sub=esc_md(r["podkategoria"]),
                idx=esc_md(r["indeksy"]),
                sleeve=esc_md(sleeve_cell),
                wyk=esc_md(wyk_cell),
                status=esc_md(r["status"]),
                art=r["projekt_graficzny"],
                wiz=r["wizki"],
                prt=r["druk"],
                tech=r["elementy"],
                mkt=r["marketing"],
                karta=r["karta"],
                prez=r["prezentacja"],
                rev=r["rewizje"],
                tagi=esc_md(r["tagi"]),
                path=esc_md(r["sciezka"]),
            )
        )

    md.append("")
    md.append("---")
    md.append("")
    md.append("## Szczegóły per produkt")
    md.append("")

    current_brand = ""
    for r in rows:
        if r["marka"] != current_brand:
            current_brand = r["marka"]
            md.append(f"## Marka {current_brand}")
            md.append("")

        p = r["product"]
        flags = r["flags"]
        md.append(f"### {r['lp']}. {r['nazwa']}")
        md.append("")
        md.append(f"- **ID:** `{r['id']}`")
        md.append(
            f"- **Marka / kategoria:** {r['marka']} · {r['kategoria']}"
            + (f" · {r['podkategoria']}" if r["podkategoria"] else "")
        )
        md.append(f"- **Indeksy:** {r['indeksy'] or '—'}")
        md.append(f"- **Status kompletności:** {r['status']}")
        if r["brakuje"]:
            md.append(f"- **Brakuje:** {r['brakuje']}")
        md.append(f"- **Lokalizacja:** `{r['sciezka']}`")
        md.append(f"- **Tagi:** {r['tagi'] or '—'}")
        pack = packaging.get(r["id"], {})
        sleeves = pack.get("sleeves") or []
        wykrojniki = pack.get("wykrojniki") or []
        rekaw_revs = pack.get("rekaw_revisions") or []
        if sleeves or wykrojniki or rekaw_revs:
            md.append("")
            md.append("**Rękawki / wykrojniki:**")
            if sleeves:
                md.append("")
                md.append("*Stan z listy zakupów (sleeve-stock):*")
                for s in sleeves:
                    md.append(format_sleeve_detail(s))
            if wykrojniki:
                md.append("")
                md.append("*Wykrojnik z rejestru Kubara:*")
                for w in wykrojniki:
                    md.append(format_wyk_detail(w))
            if rekaw_revs:
                md.append("")
                md.append("*Rewizje rękawa w katalogu produktu:*")
                for rev in rekaw_revs[:6]:
                    md.append(
                        f"- `{rev.get('index', '')}` — {rev.get('folder', '')} "
                        f"({rev.get('carrier', '')})"
                    )
                if len(rekaw_revs) > 6:
                    md.append(f"- … i {len(rekaw_revs) - 6} więcej")
        md.append("")
        md.append("**Checklista materiałów:**")
        for role in CHECK_ROLES:
            md.append(f"- [{'x' if flags[role] else ' '}] {ROLE_LABELS[role]}")
        md.append("")
        if r["revs"]:
            md.append("**Aktywne rewizje (wg indeksu):**")
            md.append("")
            for rev in r["revs"]:
                md.append(revision_summary(rev))
        elif r["latest_rev"]:
            md.append("**Najnowsza rewizja:**")
            md.append("")
            md.append(revision_summary(r["latest_rev"]))
        related = p.get("related_materials") or []
        if related:
            md.append("**Powiązane materiały marketingowe:**")
            for m in related[:8]:
                md.append(
                    f"- {m.get('label', m.get('name', 'materiał'))}: "
                    f"`{m.get('path', '')}` ({m.get('file_count', 0)} plików)"
                )
            if len(related) > 8:
                md.append(f"- … i {len(related) - 8} więcej")
            md.append("")
        md.append("")

    return "\n".join(md)


def export_produkty_baza(
  index_path: Path | None = None,
  out_path: Path | None = None,
) -> dict:
    """Zbuduj dump MD. Zwraca statystyki lub rzuca wyjątek."""
    index_path = index_path or INDEX_PATH
    out_path = out_path or DEFAULT_OUT

    data = json.loads(index_path.read_text(encoding="utf-8"))
    products = sort_products(data.get("products") or [])
    sleeve_data = load_json(SLEEVE_PATH, {})
    wyk_data = load_json(WYK_PATH, {})
    packaging = build_packaging_by_product(products, sleeve_data, wyk_data)
    rows = [build_row(i + 1, p) for i, p in enumerate(products)]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(render_markdown(data, rows, packaging), encoding="utf-8")

    stats = {
        "out": str(out_path),
        "products": len(rows),
        "dk": sum(1 for r in rows if r["marka"] == "DK"),
        "gc": sum(1 for r in rows if r["marka"] == "GC"),
        "complete": sum(1 for r in rows if r["status"] == "Kompletny"),
        "wizki": sum(1 for r in rows if r["wizki"] == "TAK"),
        "project": sum(1 for r in rows if r["projekt_graficzny"] == "TAK"),
        "with_sleeve": sum(1 for r in rows if packaging.get(r["id"], {}).get("sleeves")),
        "with_wyk": sum(1 for r in rows if packaging.get(r["id"], {}).get("wykrojniki")),
        "generated_at": data.get("generated_at"),
    }
    return stats


def main() -> int:
    ap = argparse.ArgumentParser(description="Eksport bazy produktów DAM do Markdown")
    ap.add_argument("--index", type=Path, default=INDEX_PATH, help="Ścieżka do file-index.json")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Plik wyjściowy .md")
    args = ap.parse_args()

    try:
        stats = export_produkty_baza(args.index, args.out)
    except FileNotFoundError:
        print(f"ERROR: brak indeksu: {args.index}", file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"ERROR: zapis nieudany ({exc})", file=sys.stderr)
        return 1

    print(f"OK: {stats['out']}")
    print(
        "products={products} dk={dk} gc={gc} complete={complete} wizki={wizki} project={project} "
        "sleeve={with_sleeve} wyk={with_wyk}".format(**stats)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
