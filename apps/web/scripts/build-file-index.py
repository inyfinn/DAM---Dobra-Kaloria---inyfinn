# -*- coding: utf-8 -*-
"""
DAM file index builder (read-only scan of D: products -> write JSON on P:DAM).

Usage:
  python apps/web/scripts/build-file-index.py
  python apps/web/scripts/build-file-index.py --root "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK"
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import time
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "data" / "file-index.json"
SEARCH_OUT = WEB / "data" / "search-index.json"
THUMBS_DIR = WEB / "data" / "thumbs"

DEFAULT_ROOT = Path(r"D:/Marketing/- POLSKA/01 - PRODUKTY/- DK")
GC_ROOT = Path(r"D:/Marketing/- EKSPORT/01 - PRODUCTS/- GC")
MARKETING_ROOT = Path(r"D:/Marketing/- POLSKA")

ROOTS = [
    {"brand": "DK", "path": DEFAULT_ROOT},
    {"brand": "GC", "path": GC_ROOT},
]

KNOWN_LANG_CODES = frozenset({
    "pl", "de", "gb", "uk", "cz", "sk", "hu", "ro", "lt", "lv", "ee",
    "fr", "it", "es", "nl", "ru", "hr", "si", "bg", "at", "be", "dk",
    "se", "no", "fi", "pt", "gr", "ie", "ch",
})

LANG_LABELS = {
    "pl": "Polska",
    "de": "Niemcy",
    "gb": "Wielka Brytania",
    "uk": "Ukraina",
    "cz": "Czechy",
    "sk": "Słowacja",
    "hu": "Węgry",
    "ro": "Rumunia",
    "lt": "Litwa",
    "lv": "Lotwa",
    "ee": "Estonia",
    "fr": "Francja",
    "it": "Włochy",
    "es": "Hiszpania",
    "nl": "Holandia",
    "ru": "Rosja",
    "hr": "Chorwacja",
    "si": "Slowenia",
    "bg": "Bulgaria",
    "at": "Austria",
    "be": "Belgia",
    "dk": "Dania",
    "se": "Szwecja",
    "no": "Norwegia",
    "fi": "Finlandia",
    "pt": "Portugalia",
    "gr": "Grecja",
    "ie": "Irlandia",
    "ch": "Szwajcaria",
}

IMAGE_VIZ_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff"}
THUMB_MAX_EDGE = 480

INDEX_RE = re.compile(r"(?P<base>\d{6,8})\.(?P<rev>\d{2})")
DATE_DOT_RE = re.compile(r"(\d{2})\.(\d{2})\.(\d{4})")
DATE_SPACE_RE = re.compile(r"(\d{2})\s+(\d{2})\s+(\d{4})")
CARRIER_RE = re.compile(
    r"^(KAR\d*X|KAR\d+|BAT|MINI|DOY|DOYPACK|TUBA|FOL|WIZKA|SASZ|KUB|BOX|PET|SZKLO)[\s\-]",
    re.I,
)
DISPLAY_BRACKET_RE = re.compile(r"\s*[—\-]\s*\[\s*([^\]]+?)\s*\]\s*")

SLOT_MAP = {
    "0": "brief",
    "1": "projekt",
    "2": "akceptacja",
    "3": "druk",
    "4": "wizki",
    "wizki": "wizki",
    "wizka": "wizki",
    "wizualiz": "wizki",
}

SCAN_EXT = {
    ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".gif",
    ".psd", ".ai", ".pdf", ".eps", ".svg", ".indd", ".zip", ".rar",
}

PERSON_HINTS = [
    "krzysztof", "szymon", "anna", "ania", "marek", "karolina", "maciej", "ewa",
    "kinga", "sylwia", "zofia", "pawel", "paweł", "tomek", "natalia", "agata",
]
FLAVOR_HINTS = [
    "czekolada", "kakao", "malina", "malinowa", "cynamon", "banoffee", "tiramisu",
    "orzech", "proteina", "slivka", "śliwka", "cytryna", "lemon", "matcha",
    "porzeczka", "wanilia", "nerkowcowy", "tarta", "chia", "mct",
    "jagoda", "jagodowy", "kokos", "migdal", "migdał", "arachid", "miod", "miód",
    "deserowe", "owocowe",
]
PRODUCT_HINTS = [
    "kulki", "baton", "doypack", "tuba", "nuggets", "kiełbas", "parow",
    "krem", "napoj", "sypkie", "roslinne", "roślinne", "burger", "gyros",
    "kotlet", "pasztet", "muffin", "owies", "jaglanka", "boost", "dates",
    "mix", "mini",
]
PACKAGING_HINTS = [
    "karton", "folia", "kar6x", "tuba", "doypack", "sasz", "pet",
    "szklo", "kub", "box",
]

TAG_DENYLIST = frozenset({
    "ety", "fol", "kar6", "bat", "doy", "nerkowc", "wizka", "datesy",
})

TAG_LABEL_MAP = {
    "doy": "doypack",
    "datesy": "dates",
    "nerkowc": "nerkowcowy",
}

TAG_PREFER_OVER = {
    "doypack": "doy",
    "nerkowcowy": "nerkowc",
    "dates": "datesy",
}

BRACKET_HINT_RE = re.compile(r"\[\s*([^\]]+?)\s*\]")

MARKETING_LINKS = [
    {
        "path": (
            "D:/Marketing/- POLSKA/06 - STRONY WWW - INTERNET/"
            "01 - Strona Dobra Kaloria/06 - SLIDERY NA GŁÓWNĄ/Postanowienia Noworoczne"
        ),
        "title": "Postanowienia Noworoczne (slider WWW)",
        "type": "marketing",
        "index_bases": ["6300684", "6300681", "6300682", "6300702", "6300540", "6300365"],
        "note": "Slider na stronie glownej Dobra Kaloria",
    }
]

MARKETING_SCAN_PATTERNS = [
    ("PREZENTAC", "presentation"),
    ("SKŁADNIK", "ingredients"),
    ("SKLADNIK", "ingredients"),
    ("RAPORT", "report"),
    ("BADAN", "report"),
]


def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9\.]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


PERSON_SET = {norm(h) for h in PERSON_HINTS}
FLAVOR_SET = {norm(h) for h in FLAVOR_HINTS}
PRODUCT_TYPE_SET = {norm(h) for h in PRODUCT_HINTS}
PACKAGING_SET = {norm(h) for h in PACKAGING_HINTS}
CURATED_VOCAB = PERSON_SET | FLAVOR_SET | PRODUCT_TYPE_SET | PACKAGING_SET


def parse_display_name(product_name: str) -> tuple[str, list[str]]:
    bracket_tags: list[str] = []
    for m in BRACKET_HINT_RE.finditer(product_name):
        hint = norm(m.group(1))
        if hint and not is_noise_tag(hint):
            bracket_tags.append(hint)
    display = DISPLAY_BRACKET_RE.sub("", product_name).strip()
    display = re.sub(r"\s+", " ", display)
    if not display:
        display = product_name
    return display, bracket_tags


def canonicalize_tag(tag: str) -> str | None:
    t = norm(tag)
    if not t:
        return None
    if t in TAG_DENYLIST:
        mapped = TAG_LABEL_MAP.get(t)
        return mapped if mapped else None
    return TAG_LABEL_MAP.get(t, t)


def finalize_tags(tags: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in tags:
        t = canonicalize_tag(raw)
        if not t or t in seen:
            continue
        seen.add(t)
        normalized.append(t)
    present = set(normalized)
    drop: set[str] = set()
    for preferred, stub in TAG_PREFER_OVER.items():
        if preferred in present and stub in present:
            drop.add(stub)
    return [t for t in normalized if t not in drop]


def build_tag_groups(tags: list[str], cap: int = 8) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {
        "smak": [],
        "typ": [],
        "opakowanie": [],
        "osoba": [],
        "inne": [],
    }
    seen: set[str] = set()
    for raw in finalize_tags(tags):
        t = canonicalize_tag(raw)
        if not t or t in seen or is_noise_tag(t):
            continue
        seen.add(t)
        if t in PERSON_SET:
            groups["osoba"].append(t)
        elif t in FLAVOR_SET:
            groups["smak"].append(t)
        elif t in PACKAGING_SET or t in {"kar6x", "folia", "karton", "tuba", "doypack", "mini"}:
            groups["opakowanie"].append(t)
        elif t in PRODUCT_TYPE_SET or t in {"kulki", "baton", "nuggets", "krem", "napoj", "sypkie", "mix"}:
            groups["typ"].append(t)
        elif t in CURATED_VOCAB:
            groups["inne"].append(t)
    for key in groups:
        groups[key] = sorted(groups[key])[:cap]
    return groups


def merge_global_tag_groups(products: list[dict], cap: int = 8) -> dict[str, list[str]]:
    merged: dict[str, set[str]] = {
        "smak": set(),
        "typ": set(),
        "opakowanie": set(),
        "osoba": set(),
        "inne": set(),
    }
    for p in products:
        tg = p.get("tag_groups") or {}
        for key in merged:
            for t in tg.get(key) or []:
                ct = canonicalize_tag(t)
                if ct and not is_noise_tag(ct) and ct not in TAG_DENYLIST:
                    merged[key].add(ct)
    return {k: sorted(v)[:cap] for k, v in merged.items()}


def parse_index(name: str) -> tuple[str | None, str | None, str | None]:
    m = INDEX_RE.search(name)
    if not m:
        return None, None, None
    base, rev = m.group("base"), m.group("rev")
    return base, rev, f"{base}.{rev}"


def parse_date(name: str) -> str | None:
    m = DATE_DOT_RE.search(name)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{mo}-{d}"
    m = DATE_SPACE_RE.search(name)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{mo}-{d}"
    return None


def parse_carrier(name: str) -> str:
    m = CARRIER_RE.match(name.strip())
    if m:
        return m.group(1).upper()
    part = name.split(" - ")[0].strip()
    return part[:24] if part else "OTHER"


def classify_slot_role(name: str) -> str | None:
    n = norm(name)
    if not n:
        return None
    first = n.split()[0] if n.split() else n
    if first in SLOT_MAP:
        mapped = SLOT_MAP[first]
        if mapped in ("brief", "projekt", "akceptacja"):
            return "source"
        if mapped == "druk":
            return "print"
        if mapped == "wizki":
            return "viz"
    source_kw = ("zrodlo", "projekt", "brief", "psd", "akceptacja", "source")
    print_kw = ("druk", "drukarnia", "produkcyjny", "pdf produkcyjny")
    viz_kw = ("wizki", "wizka", "wizualiz", "wizualizacje")
    if any(k in n for k in source_kw) or n.endswith(" ai") or " ai " in n or n == "ai":
        return "source"
    if any(k in n for k in print_kw):
        return "print"
    if any(k in n for k in viz_kw):
        return "viz"
    return None


def is_wizki_dir(name: str) -> bool:
    return classify_slot_role(name) == "viz"


def is_noise_tag(tag: str) -> bool:
    if not tag:
        return True
    t = norm(tag)
    if t in TAG_DENYLIST and t not in TAG_LABEL_MAP:
        return True
    if re.fullmatch(r"\d+", t):
        return True
    if len(t) < 3 and t not in CURATED_VOCAB:
        return True
    if " " in t and t not in CURATED_VOCAB:
        return True
    return False


def extract_tags(parts: list[str], extra_bracket: list[str] | None = None) -> list[str]:
    blob = norm(" ".join(parts))
    tags: set[str] = set()

    for p in parts:
        for m in BRACKET_HINT_RE.finditer(p):
            hint = norm(m.group(1))
            if hint and not is_noise_tag(hint):
                tags.add(hint)
    for hint in extra_bracket or []:
        if hint and not is_noise_tag(hint):
            tags.add(hint)

    tokens = re.split(r"[^a-z0-9]+", blob)
    for token in tokens:
        if not token or is_noise_tag(token):
            continue
        if token in CURATED_VOCAB:
            tags.add(token)
            continue
        for vocab in CURATED_VOCAB:
            if len(vocab) >= 5 and len(token) >= 4 and (token.startswith(vocab) or vocab.startswith(token)):
                tags.add(vocab)
                break

    for h in PERSON_HINTS + FLAVOR_HINTS + PRODUCT_HINTS + PACKAGING_HINTS:
        hn = norm(h)
        if hn and hn in blob and not is_noise_tag(hn):
            tags.add(hn)

    for p in parts:
        c = parse_carrier(p)
        if c and c != "OTHER":
            cn = norm(c)
            if len(cn) >= 4 and not is_noise_tag(cn):
                tags.add(cn)
            elif cn in CURATED_VOCAB and not is_noise_tag(cn):
                tags.add(cn)

    curated = sorted(t for t in tags if t in CURATED_VOCAB)
    other = sorted(t for t in tags if t not in CURATED_VOCAB and not is_noise_tag(t))
    return finalize_tags(curated + other)


def file_entry(f: Path, root: Path) -> dict:
    lang = detect_lang(f.name)
    return {
        "name": f.name,
        "path": str(f).replace("\\", "/"),
        "rel": str(f.relative_to(root)).replace("\\", "/"),
        "ext": f.suffix.lower().lstrip("."),
        "size": f.stat().st_size,
        "mtime": datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds"),
        "lang": lang,
    }


def scan_slot_files(slot_dir: Path, root: Path) -> list[dict]:
    files: list[dict] = []
    try:
        for f in slot_dir.iterdir():
            if f.is_file() and f.suffix.lower() in SCAN_EXT:
                try:
                    files.append(file_entry(f, root))
                except (PermissionError, OSError):
                    pass
    except (PermissionError, OSError):
        pass
    files.sort(key=lambda x: x.get("name", ""))
    return files


def scan_revision_slots(child: Path, root: Path) -> tuple[list[str], dict[str, list[dict]], list[dict]]:
    slots: list[str] = []
    files_by_role: dict[str, list[dict]] = {"source": [], "print": [], "viz": []}
    wizki_files: list[dict] = []
    try:
        for sub in child.iterdir():
            if not sub.is_dir():
                continue
            sn = sub.name
            slots.append(sn)
            role = classify_slot_role(sn)
            if not role:
                continue
            scanned = scan_slot_files(sub, root)
            files_by_role[role].extend(scanned)
            if role == "viz":
                wizki_files.extend(scanned)
    except (PermissionError, OSError):
        pass
    for role in files_by_role:
        files_by_role[role].sort(key=lambda x: x.get("name", ""))
    return slots, files_by_role, wizki_files


def product_matches_marketing(product: dict, link: dict) -> bool:
    bases = set(link.get("index_bases") or [])
    p_bases = set(product.get("index_bases") or [])
    if bases & p_bases:
        return True
    pids = set(link.get("product_ids") or [])
    if product.get("id") in pids:
        return True
    return False


def count_files_in_dir(path: Path) -> int:
    if not path.exists() or not path.is_dir():
        return 0
    count = 0
    try:
        for f in path.rglob("*"):
            if f.is_file():
                count += 1
    except (PermissionError, OSError):
        pass
    return count


def attach_marketing_links(products: list[dict]) -> None:
    for p in products:
        related: list[dict] = []
        for link in MARKETING_LINKS:
            if product_matches_marketing(p, link):
                path = Path(link["path"])
                related.append({
                    "title": link["title"],
                    "path": link["path"],
                    "type": link.get("type", "marketing"),
                    "note": link.get("note", ""),
                    "file_count": count_files_in_dir(path),
                })
        p["related_materials"] = related


def discover_marketing_materials(products: list[dict], marketing_root: Path) -> None:
    if not marketing_root.exists():
        return
    product_index: list[tuple[dict, str, set[str]]] = []
    for p in products:
        blob = norm(" ".join([
            p.get("display_name") or p.get("name") or "",
            " ".join(p.get("index_bases") or []),
            " ".join(p.get("indexes") or []),
        ]))
        product_index.append((p, blob, set(p.get("index_bases") or [])))

    try:
        folders = [f for f in marketing_root.rglob("*") if f.is_dir()]
    except (PermissionError, OSError):
        return

    for folder in folders:
        fname = folder.name.upper()
        matched_type = None
        for pattern, mtype in MARKETING_SCAN_PATTERNS:
            if pattern in fname or pattern in folder.as_posix().upper():
                matched_type = mtype
                break
        if not matched_type:
            continue
        folder_blob = norm(folder.as_posix())
        for p, pblob, bases in product_index:
            hit = False
            dn = norm(p.get("display_name") or "")
            if dn and len(dn) >= 4 and dn in folder_blob:
                hit = True
            for base in bases:
                if base and base in folder_blob:
                    hit = True
                    break
            if not hit:
                continue
            existing_paths = {r.get("path") for r in p.get("related_materials") or []}
            path_str = str(folder).replace("\\", "/")
            if path_str in existing_paths:
                continue
            p.setdefault("related_materials", []).append({
                "title": folder.name,
                "path": path_str,
                "type": matched_type,
                "note": "Wykryto skanem Marketing",
                "file_count": count_files_in_dir(folder),
            })


def scan_product(cat_name: str, product_dir: Path, root: Path, brand: str) -> dict | None:
    product_name = product_dir.name
    display_name, bracket_tags = parse_display_name(product_name)
    revisions = []
    try:
        children = list(product_dir.iterdir())
    except (PermissionError, OSError):
        return None

    for child in children:
        if not child.is_dir():
            continue
        base, rev, full = parse_index(child.name)
        if not full:
            base, rev, full = None, None, None
        carrier = parse_carrier(child.name)
        date_s = parse_date(child.name)
        slots, files_by_role, wizki_files = scan_revision_slots(child, root)

        folder_langs = parse_folder_langs(child.name)
        revisions.append(
            {
                "folder": child.name,
                "path": str(child).replace("\\", "/"),
                "rel": str(child.relative_to(root)).replace("\\", "/"),
                "carrier": carrier,
                "index_base": base,
                "index_rev": rev,
                "index": full,
                "date": date_s,
                "slots": slots,
                "files_by_role": files_by_role,
                "wizki": wizki_files,
                "wizki_count": len(wizki_files),
                "langs": folder_langs,
            }
        )

    groups: dict[tuple, list] = defaultdict(list)
    for r in revisions:
        key = (r["carrier"], r["index_base"] or r["folder"])
        groups[key].append(r)
    for _key, items in groups.items():
        def sort_key(r):
            rev_i = int(r["index_rev"]) if r.get("index_rev") and str(r["index_rev"]).isdigit() else -1
            date_s = r.get("date") or "0000-00-00"
            return (rev_i, date_s, r.get("folder") or "")

        items_sorted = sorted(items, key=sort_key)
        for r in items:
            r["is_latest"] = False
        if items_sorted:
            items_sorted[-1]["is_latest"] = True

    tags = extract_tags(
        [cat_name, product_name, display_name] + [r["folder"] for r in revisions],
        extra_bracket=bracket_tags,
    )
    tag_groups = build_tag_groups(tags)
    indexes = sorted({r["index"] for r in revisions if r.get("index")})
    index_bases = sorted({r["index_base"] for r in revisions if r.get("index_base")})

    return {
        "id": norm(product_name).replace(" ", "-")[:80],
        "name": product_name,
        "display_name": display_name,
        "category": cat_name,
        "brand": brand,
        "root_key": str(root).replace("\\", "/"),
        "path": str(product_dir).replace("\\", "/"),
        "rel": str(product_dir.relative_to(root)).replace("\\", "/"),
        "tags": tags,
        "tag_groups": tag_groups,
        "indexes": indexes,
        "index_bases": index_bases,
        "revision_count": len(revisions),
        "revisions": revisions,
        "related_materials": [],
    }


def parse_folder_langs(folder_name: str) -> list[str]:
    """Parse trailing country codes after last ' - ' (e.g. SK HU HR)."""
    parts = [p.strip() for p in folder_name.split(" - ")]
    if len(parts) < 2:
        return []
    tail = parts[-1]
    tokens = re.split(r"[\s,;/]+", tail)
    langs: list[str] = []
    seen: set[str] = set()
    for tok in tokens:
        code = tok.strip().lower()
        if len(code) != 2:
            continue
        if code == "en":
            code = "gb"
        if code == "ua":
            code = "uk"
        if code in KNOWN_LANG_CODES and code not in seen:
            seen.add(code)
            langs.append(code)
    return langs


_LANG_CODES_ORDER = (
    "pl", "de", "en", "gb", "uk", "cz", "sk", "hu", "ro", "lt", "lv", "ee",
    "fr", "it", "es", "nl", "ru", "ua", "hr", "si", "bg",
)


def detect_lang_explicit(filename: str) -> str | None:
    n = norm(filename)
    for code in _LANG_CODES_ORDER:
        if re.search(rf"(^|[^a-z]){code}([^a-z]|$)", n):
            if code == "en":
                return "gb"
            if code == "ua":
                return "uk"
            return code
    return None


def detect_lang(filename: str) -> str:
    return detect_lang_explicit(filename) or "pl"


def lang_label(code: str) -> str:
    return LANG_LABELS.get(code, code.upper())


def is_viz_image(f: dict) -> bool:
    ext = (f.get("ext") or "").lower()
    return ext in {"jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"}


def pick_thumb_file(files: list[dict]) -> dict | None:
    """Priority: FRONT-S/S-SKLEP, FRONT jpg, FRONT any, PREV, latest image."""
    imgs = [f for f in files if is_viz_image(f)]
    if not imgs:
        return None

    def tier(name: str) -> int:
        n = name.upper()
        # demote technical / non-packaging shots
        if any(x in n for x in ("AUTO", "PROBE", "DIELINE", "DIE-LINE", "TEMPLATE", "WYKROJNIK", "PDF.PNG", "_PDF")):
            return 9
        if "FRONT" in n and ("S-SKLEP" in n or "FRONT-S" in n or re.search(r"FRONT[-_]?S\b", n) or "-S." in name.upper() or "_S." in n):
            return 1
        if "FRONT" in n and ("-L." in n or "FRONT-L" in n or "-XL" in n):
            return 2
        if "FRONT" in n:
            return 3
        if "PREV" in n or "WIZKA" in n or "WIZ_" in n:
            return 4
        if "TYL" in n or "BACK" in n:
            return 6
        return 5

    best_tier = min(tier(f.get("name") or "") for f in imgs)
    pool = [f for f in imgs if tier(f.get("name") or "") == best_tier]

    def rank(f: dict) -> tuple:
        ext = (f.get("ext") or "").lower()
        jpg_bonus = 1 if ext in ("jpg", "jpeg") else 0
        mtime = f.get("mtime") or ""
        return (jpg_bonus, mtime)

    return max(pool, key=rank)


def write_web_thumb(src: Path, dest: Path, max_edge: int = THUMB_MAX_EDGE) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        from PIL import Image

        with Image.open(src) as im:
            im = im.convert("RGB")
            im.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
            im.save(dest, "JPEG", quality=85, optimize=True)
        return
    except Exception:
        pass
    if src.suffix.lower() in {".jpg", ".jpeg"}:
        shutil.copy2(src, dest)
        return
    smallest = src
    shutil.copy2(smallest, dest)


def build_search(products: list[dict]) -> dict:
    by_prefix: dict[str, list[str]] = defaultdict(list)
    by_tag: dict[str, list[str]] = defaultdict(list)
    by_base: dict[str, list[dict]] = defaultdict(list)
    entries = []

    for p in products:
        pid = p["id"]
        for tag in p.get("tags") or []:
            by_tag[tag].append(pid)
        for idx in p.get("indexes") or []:
            base = idx.split(".")[0]
            by_base[base].append({
                "product_id": pid,
                "index": idx,
                "name": p.get("display_name") or p["name"],
            })
            digits = re.sub(r"\D", "", idx)
            for length in range(4, len(digits) + 1):
                pref = digits[:length]
                if pid not in by_prefix[pref]:
                    by_prefix[pref].append(pid)
            for length in range(4, len(base) + 1):
                pref = base[:length]
                if pid not in by_prefix[pref]:
                    by_prefix[pref].append(pid)

        entries.append(
            {
                "id": pid,
                "name": p.get("display_name") or p["name"],
                "display_name": p.get("display_name") or p["name"],
                "category": p["category"],
                "tags": p["tags"],
                "tag_groups": p.get("tag_groups") or {},
                "indexes": p["indexes"],
                "index_bases": p["index_bases"],
                "search_blob": norm(
                    " ".join(
                        [p.get("display_name") or p["name"], p["name"], p["category"]]
                        + p["tags"]
                        + p["indexes"]
                        + [r["folder"] for r in p.get("revisions") or []]
                    )
                ),
            }
        )

    by_prefix_out = {k: v for k, v in sorted(by_prefix.items()) if len(k) >= 4}
    tag_groups = merge_global_tag_groups(products)

    return {
        "by_prefix": by_prefix_out,
        "by_tag": {k: sorted(set(v)) for k, v in sorted(by_tag.items())},
        "by_base": {k: v for k, v in sorted(by_base.items())},
        "tag_groups": tag_groups,
        "entries": entries,
    }


def collect_viz_latest(products: list[dict], thumbs_dir: Path) -> list[dict]:
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    out: list[dict] = []
    for p in products:
        brand = p.get("brand") or "DK"
        default_lang = "pl" if brand == "DK" else "gb"
        latest_revs = [r for r in p.get("revisions") or [] if r.get("is_latest")]
        if not latest_revs:
            revs = list(p.get("revisions") or [])
            if not revs:
                continue
            revs.sort(
                key=lambda r: (
                    int(r["index_rev"]) if r.get("index_rev") and str(r["index_rev"]).isdigit() else -1,
                    r.get("date") or "",
                )
            )
            latest_revs = [revs[-1]]

        for r in latest_revs:
            revision_langs: list[str] = list(r.get("langs") or [])
            wizki = r.get("wizki") or []
            lang_files: dict[str, list[dict]] = defaultdict(list)

            for f in wizki:
                explicit = detect_lang_explicit(f.get("name") or "")
                if explicit:
                    lang_files[explicit].append(f)
                elif revision_langs:
                    for lg in revision_langs:
                        lang_files[lg].append(f)
                else:
                    lang_files[default_lang].append(f)

            if not lang_files and revision_langs:
                for lg in revision_langs:
                    lang_files[lg] = list(wizki)

            target_langs = sorted(lang_files.keys())
            if not target_langs and revision_langs:
                target_langs = list(revision_langs)

            for lang in target_langs:
                # Thumb always from whole VISUALS folder (FRONT priority),
                # even when a lang-only file (e.g. ...GB...PREV) exists.
                files_for_lang = lang_files.get(lang) or []
                thumb_pool = list(wizki) if wizki else files_for_lang
                thumb_src = pick_thumb_file(thumb_pool)
                if not thumb_src:
                    thumb_src = pick_thumb_file(files_for_lang)
                if not thumb_src:
                    continue
                index_base = r.get("index_base") or "unknown"
                thumb_name = f"{index_base}_{lang}.jpg"
                thumb_path = thumbs_dir / thumb_name
                try:
                    write_web_thumb(Path(thumb_src["path"]), thumb_path)
                except (OSError, PermissionError) as exc:
                    print(f"  thumb skip {thumb_name}: {exc}")
                    continue
                langs_out = revision_langs if revision_langs else [lang]
                out.append(
                    {
                        "product_id": p["id"],
                        "product_name": p.get("display_name") or p["name"],
                        "category": p["category"],
                        "brand": brand,
                        "carrier": r.get("carrier"),
                        "index": r.get("index"),
                        "index_base": index_base,
                        "revision_folder": r.get("folder"),
                        "langs": langs_out,
                        "lang": lang,
                        "lang_label": lang_label(lang),
                        "thumb_url": f"data/thumbs/{thumb_name}",
                        "file": thumb_src["name"],
                        "path": thumb_src["path"],
                        "rel": thumb_src.get("rel"),
                        "mtime": thumb_src.get("mtime"),
                        "tags": p.get("tags") or [],
                    }
                )
    out.sort(key=lambda x: x.get("mtime") or "", reverse=True)
    return out


def scan_root(root: Path, brand: str, max_products: int, products_so_far: int) -> tuple[list[dict], list[dict], int]:
    products: list[dict] = []
    categories: list[dict] = []
    count = products_so_far
    if not root.exists():
        print(f"  skip missing root [{brand}]: {root}")
        return products, categories, count

    for cat in sorted([p for p in root.iterdir() if p.is_dir()], key=lambda p: p.name):
        cat_name = cat.name
        categories.append({
            "name": cat_name,
            "rel": str(cat.relative_to(root)).replace("\\", "/"),
            "brand": brand,
        })
        try:
            prod_dirs = [p for p in cat.iterdir() if p.is_dir()]
        except (PermissionError, OSError) as e:
            print(f"  skip cat {cat_name}: {e}")
            continue
        for prod in sorted(prod_dirs, key=lambda p: p.name):
            item = scan_product(cat_name, prod, root, brand)
            if item:
                products.append(item)
                count += 1
            if max_products and count >= max_products:
                break
        print(f"  [{brand}] {cat_name}: products so far {count}")
        if max_products and count >= max_products:
            break
    return products, categories, count


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="", help="Single root override (disables multi-root)")
    ap.add_argument("--brand", default="", help="Brand tag when using --root")
    ap.add_argument("--max-products", type=int, default=0, help="0 = all")
    args = ap.parse_args()

    t0 = time.time()
    products: list[dict] = []
    categories: list[dict] = []
    roots_meta: list[dict] = []

    if args.root:
        brand = args.brand or "DK"
        root = Path(args.root)
        roots_meta.append({"brand": brand, "path": str(root).replace("\\", "/")})
        prods, cats, _ = scan_root(root, brand, args.max_products, 0)
        products.extend(prods)
        categories.extend(cats)
    else:
        total = 0
        for cfg in ROOTS:
            root = cfg["path"]
            brand = cfg["brand"]
            roots_meta.append({"brand": brand, "path": str(root).replace("\\", "/")})
            prods, cats, total = scan_root(root, brand, args.max_products, total)
            products.extend(prods)
            categories.extend(cats)
            if args.max_products and total >= args.max_products:
                break

    attach_marketing_links(products)
    discover_marketing_materials(products, MARKETING_ROOT)

    search = build_search(products)
    viz = collect_viz_latest(products, THUMBS_DIR)

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "roots": roots_meta,
        "root": roots_meta[0]["path"] if roots_meta else "",
        "elapsed_sec": round(time.time() - t0, 2),
        "category_count": len(categories),
        "product_count": len(products),
        "viz_count": len(viz),
        "categories": categories,
        "products": products,
        "viz_latest": viz,
        "lang_labels": LANG_LABELS,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    SEARCH_OUT.write_text(
        json.dumps(
            {
                "generated_at": payload["generated_at"],
                "product_count": len(products),
                **search,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    sample = [p for p in products if "tarta" in norm(p.get("display_name", "")) and "malin" in norm(p.get("display_name", ""))]
    banoffee = [p for p in products if "banoffee" in norm(p.get("display_name", "")) and "kakao" in norm(p.get("display_name", ""))]
    orange = [v for v in viz if v.get("index_base") == "6300624" or "orange" in norm(v.get("product_name", ""))]
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
    print(f"Wrote {SEARCH_OUT} ({SEARCH_OUT.stat().st_size // 1024} KB)")
    print(f"Thumbs dir: {THUMBS_DIR} ({len(list(THUMBS_DIR.glob('*.jpg')))} files)")
    print(f"products={len(products)} viz={len(viz)} elapsed={payload['elapsed_sec']}s")
    if orange:
        for v in orange[:6]:
            line = (
                f"  viz sample: {v.get('product_name')} [{v.get('brand')}] "
                f"lang={v.get('lang')} thumb={v.get('thumb_url')} file={v.get('file')}"
            )
            print(line.encode("ascii", errors="replace").decode("ascii"))
    if banoffee:
        print("BANOFFEE display_name:", banoffee[0].get("display_name"), "related:", len(banoffee[0].get("related_materials") or []))
    if sample:
        p = sample[0]
        print("TARTA display_name:", p.get("display_name"), "related:", len(p.get("related_materials") or []))


if __name__ == "__main__":
    main()
