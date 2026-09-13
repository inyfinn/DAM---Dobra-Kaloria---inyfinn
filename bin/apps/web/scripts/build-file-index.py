# -*- coding: utf-8 -*-
"""
DAM file index builder (read-only scan of Marketing products -> JSON in apps/web/data).

Preferuje X:/Marketing (aktualny mount), potem D:/Marketing.
Nazewnictwo / sloty 0-4: knowledge z structure-mcp (nie kopiujemy kodu migratora).

Usage:
  python apps/web/scripts/build-file-index.py
  python apps/web/scripts/build-file-index.py --root "X:/Marketing/- POLSKA/01 - PRODUKTY/- DK"
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "data" / "file-index.json"
SEARCH_OUT = WEB / "data" / "search-index.json"
THUMBS_DIR = WEB / "data" / "thumbs"
NAMING_DICT_PATH = WEB / "data" / "naming-dictionary.json"
PRODUCT_ALIASES_PATH = WEB / "data" / "product-aliases.json"
LANG_OVERRIDES_PATH = WEB / "data" / "lang-overrides.json"
PRODUCT_CATALOG_PATH = WEB / "data" / "product-catalog.json"
BULK_PACKAGING_PATH = WEB / "data" / "bulk-packaging.json"


def _load_naming_dict() -> dict:
    try:
        return json.loads(NAMING_DICT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


NAMING = _load_naming_dict()

_LIVE_PATH = Path(os.environ.get("DAM_INDEX_LIVE_FILE") or "")
if not str(_LIVE_PATH):
    _LIVE_PATH = WEB.parent / "desktop" / "data" / "index-live.json"
_LIVE_LAST = 0.0
_LIVE_PRODUCT = ""
_LIVE_SLOT = ""
_LIVE: dict = {
    "running": False,
    "current_item": "",
    "current_name": "",
    "current_path": "",
    "current_label": "",
    "products_done": 0,
    "products_total": 0,
    "files_done": 0,
    "files_total": 0,
}


def _write_index_live(*, force: bool = False) -> None:
    global _LIVE_LAST
    now = time.time()
    if not force and (now - _LIVE_LAST) < 0.28:
        return
    _LIVE_LAST = now
    body = dict(_LIVE)
    body["updated_at"] = datetime.now().isoformat(timespec="seconds")
    try:
        _LIVE_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = _LIVE_PATH.with_suffix(_LIVE_PATH.suffix + f".{os.getpid()}.tmp")
        tmp.write_text(json.dumps(body, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, _LIVE_PATH)
    except OSError:
        try:
            _LIVE_PATH.write_text(json.dumps(body, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass


def touch_index_live(
    *,
    kind: str = "",
    name: str = "",
    path: str = "",
    product: str = "",
    slot: str = "",
    file: str = "",
    inc_product: bool = False,
    inc_file: bool = False,
) -> None:
    bits = [bit for bit in (product, slot, file or name) if bit]
    label = " / ".join(bits) if bits else (name or path)
    _LIVE["running"] = True
    _LIVE["kind"] = kind
    _LIVE["current_name"] = name or file or product or ""
    _LIVE["current_path"] = str(path or "").replace("\\", "/")
    _LIVE["current_label"] = label
    _LIVE["current_item"] = label
    if inc_product:
        _LIVE["products_done"] = int(_LIVE.get("products_done") or 0) + 1
    if inc_file:
        _LIVE["files_done"] = int(_LIVE.get("files_done") or 0) + 1
    _write_index_live(force=inc_product)
    try:
        print(
            "[live] "
            + "|".join(
                [
                    product or "",
                    slot or "",
                    file or name or "",
                    str(path or "").replace("\\", "/"),
                ]
            ),
            flush=True,
        )
    except OSError:
        pass


def resolve_marketing_base() -> Path:
    """machine-config / M: (source) > X:/Marketing > D:/Marketing."""
    # Keep scripts/ on path when launched from another cwd (watcher / bridge).
    _scripts = Path(__file__).resolve().parent
    if str(_scripts) not in sys.path:
        sys.path.insert(0, str(_scripts))
    from marketing_roots import resolve_marketing_base as _resolve

    return _resolve()


# Lazy roots: do NOT touch Marketing drives at import ( --help / lock-before-scan ).
MARKETING_BASE: Path | None = None
DEFAULT_ROOT: Path | None = None
GC_ROOT: Path | None = None
MARKETING_ROOT: Path | None = None
ROOTS: list[dict] = []


def _ensure_roots() -> None:
    global MARKETING_BASE, DEFAULT_ROOT, GC_ROOT, MARKETING_ROOT, ROOTS
    if MARKETING_BASE is not None and ROOTS:
        return
    MARKETING_BASE = resolve_marketing_base()
    DEFAULT_ROOT = MARKETING_BASE / "- POLSKA" / "01 - PRODUKTY" / "- DK"
    GC_ROOT = MARKETING_BASE / "- EKSPORT" / "01 - PRODUCTS" / "- GC"
    MARKETING_ROOT = MARKETING_BASE / "- POLSKA"
    ROOTS = [
        {"brand": "DK", "path": DEFAULT_ROOT},
        {"brand": "GC", "path": GC_ROOT},
    ]


def _atomic_write_json(path: Path, payload: dict) -> None:
    """Temp + os.replace so readers never see partial file-index/search-index."""
    import os

    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)

_LANGS_FROM_DICT = NAMING.get("languages") or {}
# HARD 2026-07-21: UK/GB/EN = English = kanonicznie "en" (chip EN). Ukraina = UA. NIGDY UK→Ukraina.
KNOWN_LANG_CODES = frozenset(_LANGS_FROM_DICT.keys()) | frozenset({
    "pl", "de", "en", "ua", "cz", "sk", "hu", "ro", "lt", "lv", "ee",
    "fr", "it", "es", "nl", "ru", "hr", "si", "bg", "at", "be", "dk",
    "se", "no", "fi", "pt", "gr", "ie", "ch",
})
LANG_ALIASES = dict(NAMING.get("lang_aliases") or {"gb": "en", "uk": "en", "ukr": "ua"})
# Always force English market aliases onto en (dictionary may lag).
LANG_ALIASES.update({"gb": "en", "uk": "en", "ukr": "ua"})
# HARD: UA = Ukrainian (ISO). Never map ua -> uk/en (legacy dict had ua:uk).
LANG_ALIASES.pop("ua", None)
# HARD 2026-07-21: etykiety = nazwy JEZYKOW (Polski, Niemiecki), nie krajow.
LANG_LABELS = {
    "pl": "Polski",
    "de": "Niemiecki",
    "en": "Angielski",
    "ua": "Ukrainski",
    "cz": "Czeski",
    "sk": "Slowacki",
    "hu": "Wegierski",
    "ro": "Rumunski",
    "lt": "Litewski",
    "lv": "Lotewski",
    "ee": "Estonski",
    "fr": "Francuski",
    "it": "Wloski",
    "es": "Hiszpanski",
    "nl": "Holenderski",
    "ru": "Rosyjski",
    "hr": "Chorwacki",
    "si": "Slowenski",
    "bg": "Bulgarski",
    "at": "Austriacki",
    "be": "Belgijski",
    "dk": "Dunski",
    "se": "Szwedzki",
    "no": "Norweski",
    "fi": "Finski",
    "pt": "Portugalski",
    "gr": "Grecki",
    "ie": "Irlandzki",
    "ch": "Szwajcarski",
}
LANG_LABELS.update(_LANGS_FROM_DICT)
# Canonical EN even if dict still carries legacy gb-only key.
if "en" not in LANG_LABELS and LANG_LABELS.get("gb"):
    LANG_LABELS["en"] = LANG_LABELS["gb"]
LANG_LABELS["gb"] = LANG_LABELS.get("en", "Angielski")
MULTI_LANG_SYNONYMS = list(
    ((NAMING.get("ui") or {}).get("multi_lang_synonyms"))
    or [
        "multijezyczny",
        "multijęzyczny",
        "multi",
        "wielojezykowy",
        "wielojęzykowy",
        "wiele jezykow",
        "wiele języków",
        "multilang",
        "multi-lang",
    ]
)

IMAGE_VIZ_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff"}
THUMB_MAX_EDGE = 480

INDEX_RE = re.compile(r"(?P<base>\d{6,8})\.(?P<rev>\d{2})")
# Foldery typu "DOY - 23.06.2026 - 6300760" (bez .00) - jak DamLabels.extractIndexFromString
INDEX_PLAIN_RE = re.compile(r"(?<!\d)(?P<base>\d{6,8})(?!\d)")
DATE_DOT_RE = re.compile(r"(\d{2})\.(\d{2})\.(\d{4})")
DATE_SPACE_RE = re.compile(r"(\d{2})\s+(\d{2})\s+(\d{4})")
# Prefiks nosnika - dluzsze tokeny pierwsze; jezyki (CZ SK) odcinane osobno
CARRIER_RE = re.compile(
    r"^(?P<code>"
    r"KAR\s*6\s*X|KAR6X|DOY\s*6\s*X|DOY6X|ETY[\s\-_]?BUT|ETY[\s\-_]?SLO|"
    r"DOYPACK|DOY|KARTON|CARTON|KAR|MINI|BATON|BAT|BAR|BIGPAK|BIGPACK|"
    r"FOLIA|FOIL|FOL|R[EĘ]KAW|SLEEVE|OWIJKA|TUBA|TUBE|"
    r"ETYKIETA|ETY|LABEL|SASZ|SACHET|OBW|SHOT|WIZKA"
    r")(?:\s+|$|-)",
    re.I,
)
CARRIER_CODE_NORM = {
    "KAR6X": "KAR6X", "KAR 6X": "KAR6X", "KAR 6 X": "KAR6X",
    "DOY6X": "DOY6X", "DOY 6X": "DOY6X", "DOY 6 X": "DOY6X",
    "DOYPACK": "DOY", "DOY": "DOY",
    "KARTON": "KAR", "CARTON": "KAR", "KAR": "KAR",
    "MINI": "MINI",
    "BATON": "BAT", "BAT": "BAT", "BAR": "BAT",
    "BIGPAK": "BIGPAK", "BIGPACK": "BIGPAK",
    "FOLIA": "FOLIA", "FOIL": "FOLIA", "FOL": "FOLIA",
    "REKAW": "REKAW", "RĘKAW": "REKAW", "SLEEVE": "REKAW", "OWIJKA": "REKAW",
    "TUBA": "TUBA", "TUBE": "TUBA",
    "ETYKIETA": "ETY", "ETY": "ETY", "LABEL": "ETY",
    "ETY-BUT": "ETY-BUT", "ETY BUT": "ETY-BUT",
    "ETY-SLO": "ETY-SLO", "ETY SLO": "ETY-SLO",
    "SASZ": "SASZ", "SACHET": "SASZ",
    "OBW": "OBW", "SHOT": "SHOT", "WIZKA": "WIZKA",
}
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
    ".psd", ".ai", ".pdf", ".eps", ".svg", ".indd", ".zip", ".rar", ".7z",
    ".pptx", ".ppt", ".docx", ".doc", ".key",
}

# Checklista rozszerzona (2026-07-18, user): oprocz zrodlo/podglad/druk/wizki/elementy,
# rozpoznaj dodatkowo Karty wprowadzenia (zwykle w 1-MATERIALY) i Strategie/koncepcje
# pozycjonowania (prezentacje .pptx w 1-MATERIALY). Opcjonalne, nie blokuja checklisty.
KARTY_WPROWADZENIA_KW = ("karta wprowadz", "karty wprowadz", "wprowadzenie", "intro card", "onboarding")
STRATEGIA_KW = ("strategi", "pozycjonowani", "koncepcj", "positioning", "brand book", "brandbook")

# Wizualizacje = TYLKO obrazy. ZIP/RAR nigdy nie sa wizkami (nawet w folderze 4-WIZKI).
VIZ_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".gif"}
ARCHIVE_EXT = {".zip", ".rar", ".7z"}
PRINT_ARCHIVE_KW = (
    "pakiet", "fq", "druk", "drukarnia", "kubara", "produkcyj", "polzdob", "do druku",
)

PERSON_HINTS = [
    "krzysztof", "szymon", "anna", "ania", "marek", "karolina", "maciej", "ewa",
    "kinga", "sylwia", "zofia", "pawel", "paweł", "tomek", "natalia", "agata",
]
FLAVOR_HINTS = [
    "czekolada", "kakao", "malina", "malinowa", "cynamon", "banoffee", "tiramisu",
    "orzech", "orzechowe", "proteina", "slivka", "śliwka", "cytryna", "lemon", "matcha",
    "porzeczka", "wanilia", "nerkowcowy", "tarta", "chia", "mct",
    "jagoda", "jagodowy", "kokos", "migdal", "migdał", "arachid", "miod", "miód",
    "deserowe", "owocowe", "karmel", "pistacja", "truskawka", "morela", "mango",
    "imbir", "kawa", "sezam", "cynamonka", "muffin",
]
# Typ = forma produktu (nosniki BAT/FOLIA/… sa w PACKAGING_HINTS / Opakowanie)
PRODUCT_HINTS = [
    "kulki", "mini batoniki", "batoniki",
    "nuggets", "kiełbas", "parow", "krem", "napoj", "sypkie",
    "roslinne", "roślinne", "burger", "gyros", "kotlet", "pasztet",
    "owies", "jaglanka", "boost", "dates", "mix", "mixy",
    "niemiesne", "funkcjonalny", "sniadaniowe",
]
# Nosniki = Opakowanie (pelna lista z docs/NAMING.md / naming-dictionary)
PACKAGING_HINTS = [
    "doypack", "doy 6x", "doy6x",
    "baton", "bat", "mini baton", "mini",
    "karton 6x", "kar6x", "karton",
    "bigpak", "folia", "fol",
    "etykieta", "etykieta butelka", "etykieta sloik", "ety-but", "ety-slo", "ety",
    "rekaw", "sleeve", "tuba", "shot",
    "sasz", "obwoluta", "pet", "szklo", "kub", "box",
]
# Kanoniczna lista zawsze widoczna w pasku tagow Opakowanie
OPAKOWANIE_CANON = [
    # TUBA w top-8 faceta Opakowanie (ROW_LIMIT=8) - inaczej chowa sie pod +N
    "doypack", "baton", "mini baton", "tuba", "karton 6x", "karton", "bigpak",
    "folia", "etykieta", "etykieta butelka", "etykieta sloik", "rekaw",
    "shot", "doy 6x", "sasz", "obwoluta",
]

# Stuby zbyt krotkie / szum - NIE blokuj "bat" (nosnik BAT)
TAG_DENYLIST = frozenset({
    "kar6", "nerkowc", "wizka", "datesy",
})

TAG_LABEL_MAP = {
    "doy": "doypack",
    "datesy": "dates",
    "nerkowc": "nerkowcowy",
    "mini": "mini baton",
    "kar6x": "karton 6x",
    "doy6x": "doy 6x",
    "sleeve": "rekaw",
    "bar": "baton",
    "bat": "baton",
    "fol": "folia",
    "foil": "folia",
    "ety": "etykieta",
    "ety-but": "etykieta butelka",
    "ety but": "etykieta butelka",
    "ety-slo": "etykieta sloik",
    "ety slo": "etykieta sloik",
    "label": "etykieta",
    "batoniki": "mini batoniki",
}

TAG_PREFER_OVER = {
    "doypack": "doy",
    "nerkowcowy": "nerkowc",
    "dates": "datesy",
    "mini baton": "mini",
    "karton 6x": "kar6x",
    "doy 6x": "doy6x",
    "rekaw": "sleeve",
    "baton": "bat",
    "folia": "fol",
    "etykieta": "ety",
    "mini batoniki": "batoniki",
}

# parse_carrier / folder prefix -> kanoniczny tag (Opakowanie)
CARRIER_TO_TAG = {
    "BAT": "baton",
    "BAR": "baton",
    "MINI": "mini baton",
    "KAR6X": "karton 6x",
    "KAR": "karton",
    "DOY": "doypack",
    "DOY6X": "doy 6x",
    "DOYPACK": "doypack",
    "SLEEVE": "rekaw",
    "REKAW": "rekaw",
    "FOLIA": "folia",
    "FOL": "folia",
    "FOIL": "folia",
    "TUBA": "tuba",
    "ETY": "etykieta",
    "ETY-BUT": "etykieta butelka",
    "ETY-SLO": "etykieta sloik",
    "BIGPAK": "bigpak",
    "SASZ": "sasz",
    "OBW": "obwoluta",
    "SHOT": "shot",
}

# Nosniki NIE trafiaja do Typ - tylko do Opakowanie
TYP_NOSNIKI = frozenset()

TYP_PRIORITY = (
    "baton", "mini baton", "mini batoniki", "kulki", "sypkie",
    "niemiesne", "nuggets", "krem", "napoj",
    "mix", "mixy", "roslinne", "burger", "dates", "boost",
)

BRACKET_HINT_RE = re.compile(r"\[\s*([^\]]+?)\s*\]")

# Podkategoria (nawias w nazwie produktu) -> ZAWSZE polski, z pelnymi diakrytykami
# (2026-07-18, wymog usera "wszedzie w calym projekcie musisz naprawic polskie znaki").
# Klucz = norm() ze slugiem (bez diakrytykow, spacje/podkreslniki -> spacja) - patrz norm().
SUBCATEGORY_PL = {
    "balls crispy": "Kulki Kruche",
    "balls raw": "Kulki Surowe",
    "bars date": "Batony Daktylowe",
    "bars functional": "Batony Funkcjonalne",
    "bars mix": "Batony Mix",
    "bars protein": "Batony Proteinowe",
    "boosty": "Boosty",
    "cashews": "Nerkowce",
    "daktylowy": "Daktylowy",
    "date": "Daktylowe",
    "deserowe": "Deserowe",
    "funkcjonalne": "Funkcjonalne",
    "funkcjonalny": "Funkcjonalny",
    "ig": "Niski IG",
    "krem orzechowy": "Krem Orzechowy",
    "mixy": "Mixy",
    "nerkowcowy": "Nerkowcowy",
    "niemiesne": "Niemięsne",
    "niemi sne": "Niemięsne",  # folder ma uszkodzony bajt w "ę" (U+FFFD) - tylko etykieta, plik NIE zmieniany
    "orzechowe": "Orzechowe",
    "owocowe": "Owocowe",
    "plant based": "Roślinne",
    "postbiotyk": "Postbiotyk",
    "proteinowy": "Proteinowy",
    "raw": "Raw",
    "sniadanie": "Śniadanie",
    "sniadaniowe": "Śniadaniowe",
    "ziomki": "Ziomki",
}


def subcategory_label_pl(bracket_tags: list[str]) -> tuple[str, str]:
    """Pierwszy nawias z nazwy produktu -> (slug, etykieta PL). "" gdy brak / nieznany."""
    for raw in bracket_tags or []:
        slug = norm(raw)
        if not slug:
            continue
        label = SUBCATEGORY_PL.get(slug)
        if label:
            return slug, label
    return "", ""

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


LIFECYCLE_SUFFIX_RE = re.compile(r"\s+-\s+[FXD]$", re.IGNORECASE)


def strip_lifecycle_suffix(name: str) -> str:
    """Usun koncowke statusu folderu: - F / - X / - D."""
    return LIFECYCLE_SUFFIX_RE.sub("", (name or "").rstrip()).rstrip()


def lifecycle_letter_from_folder_name(name: str) -> str:
    m = re.search(r"\s-\s([FXD])$", name or "", re.I)
    return m.group(1).upper() if m else ""


def dedupe_lifecycle_folder_twins(revisions: list[dict]) -> list[dict]:
    """Gdy na dysku sa twin foldery (bez i z sufiksem F/X/D), zostaw jeden wpis w indeksie."""
    by_base: dict[str, list[dict]] = defaultdict(list)
    loose: list[dict] = []
    for r in revisions:
        folder = r.get("folder") or ""
        if not folder:
            loose.append(r)
            continue
        base = strip_lifecycle_suffix(folder).lower()
        if not base:
            loose.append(r)
            continue
        by_base[base].append(r)
    out = list(loose)
    for items in by_base.values():
        if len(items) == 1:
            out.append(items[0])
            continue

        def twin_rank(row: dict) -> tuple:
            lit = lifecycle_letter_from_folder_name(row.get("folder") or "")
            lit_pri = {"F": 3, "D": 2, "X": 1}.get(lit, 0)
            has_lit = 1 if lit else 0
            date_s = row.get("date") or ""
            return (has_lit, lit_pri, date_s)

        items_sorted = sorted(items, key=twin_rank, reverse=True)
        out.append(items_sorted[0])
    return out


GRAM_SUFFIX_RE = re.compile(r"\s*\d+\s*g\b", re.I)
PRODUCT_TECH_PREFIX_RE = re.compile(r"^(?:DK|GC)[-_]", re.I)
INDEX_TAIL_RE = re.compile(r"\s+(?P<base>\d{6,8})(?:\.\d{2})?\s*$")


def to_title_case_pl(s: str) -> str:
    raw = (s or "").strip()
    if not raw:
        return raw
    return re.sub(
        r"(^|[\s\-_/])(\S)",
        lambda m: m.group(1) + m.group(2)[:1].upper() + m.group(2)[1:].lower(),
        raw.lower(),
    )


def split_glued_flavor_token(token: str) -> str:
    """LEMONCHEESECAKE -> Lemon Cheesecake (vocab longest-first)."""
    letters = re.sub(r"[^a-zA-ZĄĆĘŁŃÓŚŹŻąćęłńóśźż]", "", token or "")
    if not letters:
        return (token or "").strip()
    if re.search(r"\s", token or ""):
        return to_title_case_pl(token)
    lower = norm(letters).replace(" ", "")
    if len(lower) <= 4:
        return to_title_case_pl(letters)
    vocab = sorted(
        {
            norm(h).replace(" ", "")
            for h in FLAVOR_HINTS
            + PRODUCT_HINTS
            + ["cheesecake", "cheese", "cake", "brownie", "muffin", "burger", "sznyce", "mielone"]
        },
        key=len,
        reverse=True,
    )
    parts: list[str] = []
    i = 0
    while i < len(lower):
        matched = False
        for v in vocab:
            if len(v) >= 3 and lower.startswith(v, i):
                parts.append(v)
                i += len(v)
                matched = True
                break
        if matched:
            continue
        j = i + 1
        while j <= len(lower):
            if any(lower.startswith(v, j) for v in vocab if len(v) >= 3) or j == len(lower):
                parts.append(lower[i:j])
                i = j
                break
            j += 1
        else:
            parts.append(lower[i:])
            break
    if not parts:
        return to_title_case_pl(letters)
    return " ".join(to_title_case_pl(p) for p in parts if p)


def polish_display_title(s: str) -> str:
    """Gramatura/indeks z tytulu; rozbij sklejone smaki (LEMONCHEESECAKE)."""
    out = GRAM_SUFFIX_RE.sub("", s or "").strip()
    out = INDEX_TAIL_RE.sub("", out).strip()
    if not out:
        return out
    letters = re.sub(r"[^a-zA-Z]", "", out)
    if letters and letters == letters.upper() and len(letters) > 5 and not re.search(r"\s", out):
        return split_glued_flavor_token(out)
    if out == out.upper() or out == out.lower():
        return to_title_case_pl(out)
    return out


def strip_technical_product_prefix(display: str) -> str:
    """DK-DOY-DATESY - LEMONCHEESECAKE 100 g -> LEMONCHEESECAKE 100 g (typ w tagach)."""
    if " - " not in display:
        return display
    left, right = display.split(" - ", 1)
    left = left.strip()
    right = right.strip()
    if not right:
        return display
    if PRODUCT_TECH_PREFIX_RE.match(left) and "-" in left:
        return right
    return display


def parse_display_name(product_name: str) -> tuple[str, list[str]]:
    bracket_tags: list[str] = []
    clean_name = strip_lifecycle_suffix(product_name)
    for m in BRACKET_HINT_RE.finditer(clean_name):
        hint = norm(m.group(1))
        if hint and not is_noise_tag(hint):
            bracket_tags.append(hint)
    display = DISPLAY_BRACKET_RE.sub("", clean_name).strip()
    display = re.sub(r"\s+", " ", display)
    display = strip_technical_product_prefix(display)
    display = polish_display_title(display)
    if not display:
        display = clean_name or product_name
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


def _sort_typ_tags(tags: list[str]) -> list[str]:
    prio = {name: i for i, name in enumerate(TYP_PRIORITY)}
    return sorted(tags, key=lambda t: (prio.get(t, 500), t))


def build_tag_groups(tags: list[str], cap: int = 32) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {
        "smak": [],
        "typ": [],
        "opakowanie": [],
        "autor": [],
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
            groups["autor"].append(t)
            groups["osoba"].append(t)
        elif t in FLAVOR_SET:
            groups["smak"].append(t)
        elif t in PACKAGING_SET or t in {norm(x) for x in OPAKOWANIE_CANON}:
            groups["opakowanie"].append(t)
        elif t in TYP_NOSNIKI or t in PRODUCT_TYPE_SET:
            # Typ: forma produktu (kulki, sypkie…) - nosniki sa w Opakowanie
            groups["typ"].append(t)
        elif t in CURATED_VOCAB:
            groups["inne"].append(t)
    groups["typ"] = _sort_typ_tags(groups["typ"])[:cap]
    for key in groups:
        if key == "typ":
            continue
        groups[key] = sorted(groups[key])[:cap]
    return groups


def merge_global_tag_groups(products: list[dict], cap: int = 48) -> dict[str, list[str]]:
    merged: dict[str, set[str]] = {
        "smak": set(),
        "typ": set(),
        "opakowanie": set(),
        "autor": set(),
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
        # Nosnik z rewizji zawsze do Opakowanie
        for r in p.get("revisions") or []:
            code = (r.get("carrier") or "").upper()
            mapped = CARRIER_TO_TAG.get(code)
            if mapped:
                ct = canonicalize_tag(mapped)
                if ct:
                    merged["opakowanie"].add(ct)
    # Pelna sciagawka nosnikow zawsze w UI (nawet gdy rzadkie w katalogu)
    for t in OPAKOWANIE_CANON:
        ct = canonicalize_tag(t)
        if ct:
            merged["opakowanie"].add(ct)
    out: dict[str, list[str]] = {}
    for k, v in merged.items():
        items = list(v)
        if k == "typ":
            out[k] = _sort_typ_tags(items)[:cap]
        elif k == "opakowanie":
            # kanoniczna kolejnosc z listy, potem reszta alfa
            order = [canonicalize_tag(t) for t in OPAKOWANIE_CANON]
            seen = set()
            ordered = []
            for t in order:
                if t in v and t not in seen:
                    ordered.append(t)
                    seen.add(t)
            for t in sorted(v):
                if t not in seen:
                    ordered.append(t)
                    seen.add(t)
            out[k] = ordered[:cap]
        else:
            out[k] = sorted(items)[:cap]
    return out


def parse_index(name: str) -> tuple[str | None, str | None, str | None]:
    """Wyciagnij indeks produktu. Preferuj NNNNNNN.RR; akceptuj tez same cyfry (bez .00)."""
    if not name:
        return None, None, None
    name = strip_lifecycle_suffix(name)
    # Placeholder typu 6300XXX - nie traktuj jako prawdziwy indeks
    if re.search(r"\d{3,}X{2,}", name, flags=re.IGNORECASE):
        return None, None, None
    # Indeks testowy / alfanumeryczny: TEST-TEST (lifecycle QA)
    m_test = re.search(r"\b(TEST-[A-Z0-9]+)\b", name, flags=re.IGNORECASE)
    if m_test:
        full = m_test.group(1).upper()
        return full, None, full
    m = INDEX_RE.search(name)
    if m:
        base, rev = m.group("base"), m.group("rev")
        return base, rev, f"{base}.{rev}"
    # Ostatni match wygrywa (indeks zwykle na koncu nazwy folderu)
    plains = list(INDEX_PLAIN_RE.finditer(name))
    if not plains:
        return None, None, None
    base = plains[-1].group("base")
    return base, "00", f"{base}.00"


def infer_index_from_files(files: list[dict]) -> tuple[str | None, str | None, str | None]:
    """Gdy folder wariantu nie ma indeksu (ETY-SLO), wez z nazw plikow wizki/.ai."""
    best: tuple[str | None, str | None, str | None] = (None, None, None)
    best_rev = -1
    for f in files or []:
        blob = " ".join(
            [
                str(f.get("name") or ""),
                str(f.get("path") or ""),
                str(f.get("rel") or ""),
            ]
        )
        base, rev, full = parse_index(blob)
        if not full:
            continue
        rev_n = int(rev) if rev and str(rev).isdigit() else 0
        if rev_n >= best_rev:
            best_rev = rev_n
            best = (base, rev, full)
    return best


def safe_thumb_stem(product_id: str, index_base: str, lang: str) -> str:
    """Unikalna nazwa miniatury - NIGDY wspolne unknown_pl.jpg dla wielu produktow."""
    pid = re.sub(r"[^a-zA-Z0-9_-]+", "-", (product_id or "p").strip())[:96].strip("-").lower()
    raw = (index_base or "").strip()
    if not raw or raw.lower() == "noid":
        raw = "pending"
    base = re.sub(r"[^0-9A-Za-z]+", "", raw) or "pending"
    lg = re.sub(r"[^a-z0-9]+", "", (lang or "xx").lower()) or "xx"
    return f"{pid}__{base}_{lg}.jpg"


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


def normalize_carrier_code(raw: str) -> str:
    key = re.sub(r"\s+", " ", (raw or "").strip().upper())
    if not key:
        return "OTHER"
    if key in CARRIER_CODE_NORM:
        return CARRIER_CODE_NORM[key]
    compact = key.replace(" ", "").replace("_", "")
    for alias, code in CARRIER_CODE_NORM.items():
        if alias.replace(" ", "").replace("_", "") == compact:
            return code
    return key


def _strip_trailing_lang_tokens(tokens: list[str]) -> list[str]:
    out = list(tokens)
    while out:
        t = out[-1].strip().lower()
        t = LANG_ALIASES.get(t, t)
        if len(t) == 2 and t in KNOWN_LANG_CODES:
            out.pop()
            continue
        break
    return out


def looks_like_date_token(s: str) -> bool:
    t = (s or "").strip()
    if not t:
        return False
    if DATE_DOT_RE.search(t) or DATE_SPACE_RE.search(t):
        return True
    return bool(re.match(r"^\d{2}[./-]\d{2}[./-]\d{2,4}$", t))


def parse_carrier(name: str) -> str:
    """Nosnik z prefiksu folderu; kody jezykow (CZ SK) nie wchodza w carrier."""
    head = (name or "").split(" - ")[0].strip()
    if looks_like_date_token(head):
        return "OTHER"
    tokens = _strip_trailing_lang_tokens(re.split(r"[\s_]+", head) if head else [])
    cleaned = " ".join(tokens).strip()
    if cleaned and looks_like_date_token(cleaned):
        return "OTHER"
    if cleaned:
        m = CARRIER_RE.match(cleaned)
        if m:
            return normalize_carrier_code(m.group("code"))
    m2 = CARRIER_RE.match((name or "").strip())
    if m2:
        return normalize_carrier_code(m2.group("code"))
    # Nie zwracaj daty / losowego prefiksu produktu jako nosnika
    if cleaned and not looks_like_date_token(cleaned):
        # jesli wyglada jak znany alias w srodku tekstu
        for alias, code in sorted(CARRIER_CODE_NORM.items(), key=lambda kv: -len(kv[0])):
            if re.search(rf"\b{re.escape(alias)}\b", cleaned, re.I):
                return code
    return "OTHER"


def infer_carrier_from_files(files: list[dict]) -> str:
    """Nosnik z nazw plikow wizki/source gdy folder zaczyna sie od daty."""
    for f in files or []:
        name = f.get("name") or ""
        # Pomin generyczny WARIANT- jako nosnik
        m = CARRIER_RE.search(name.replace("_", " ").replace("-", " "))
        if m:
            code = normalize_carrier_code(m.group("code"))
            if code and code != "WIZKA":
                return code
        # Prefiks DK-FOLIA- / GC-DOY-
        m2 = re.match(r"^(?:DK|GC)[-_]([A-Za-z0-9ŁłĘę]+)", name, re.I)
        if m2:
            code = normalize_carrier_code(m2.group(1))
            if code in (NAMING.get("carriers") or {}) or code in CARRIER_CODE_NORM.values():
                return code
    return ""


def is_mix_product(name: str, tags: list | None = None) -> bool:
    n = name or ""
    if re.search(r"\bMIX\b", n, re.I) or re.match(r"^\s*-\s*MIX", n, re.I):
        return True
    if tags and any(str(t).lower() == "mix" for t in tags):
        return True
    return False


def carrier_label_pl(code: str, *, product_name: str = "", tags: list | None = None) -> str:
    if not code or code in ("OTHER", "UNKNOWN", "WARIANT"):
        if is_mix_product(product_name, tags):
            return ((NAMING.get("ui") or {}).get("mix_prefix") or "MIX - ").rstrip(" -")
        return ""
    carriers = NAMING.get("carriers") or {}
    entry = carriers.get(code) or {}
    fallback = {
        "FOLIA": "FOLIA",
        "REKAW": "REKAW",
        "DOY": "DOYPACK",
        "KAR": "KARTON",
        "KAR6X": "KARTON 6x MINI",
        "BAT": "BATON",
        "MINI": "MINI BATON",
        "TUBA": "TUBA",
        "ETY": "ETYKIETA",
    }
    label = entry.get("label_pl") or fallback.get(code) or code
    if is_mix_product(product_name, tags):
        prefix = (NAMING.get("ui") or {}).get("mix_prefix") or "MIX - "
        return f"{prefix}{label}"
    return label


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
    # Folder bez numeru: "DRUK", "DRUKARNIA", "WIZKI"...
    source_kw = ("zrodlo", "projekt", "brief", "psd", "akceptacja", "source", "material")
    print_kw = ("druk", "drukarnia", "produkcyjny", "pdf produkcyjny")
    viz_kw = ("wizki", "wizka", "wizualiz", "wizualizacje", "visuals")
    if any(k in n for k in source_kw) or n.endswith(" ai") or " ai " in n or n == "ai":
        return "source"
    if any(k in n for k in print_kw):
        return "print"
    if any(k in n for k in viz_kw):
        return "viz"
    return None


def is_lang_evidence_slot(slot_name: str) -> bool:
    """HARD: jezyk tylko z PROJEKT/PROJECT lub 4-WIZKI/VISUALS - nie z MATERIALY/Magnific."""
    n = norm(slot_name or "")
    if not n:
        return False
    # Explicit reject materials / magnific coincidence paths
    if "material" in n or "magnific" in n:
        return False
    if "projekt" in n or "project" in n:
        return True
    if any(k in n for k in ("wizki", "wizka", "wizualiz", "visuals")):
        return True
    # Numbered slots: 2 often = PROJEKT, 4 = WIZKI (when name lacks keyword after norm fail)
    first = n.split()[0] if n.split() else ""
    if first == "4":
        return True
    if first in ("1", "2") and ("projekt" in n or "project" in n or "ai" in n):
        return True
    return False


def is_lang_evidence_file(f: dict) -> bool:
    """True if file path/rel/slot looks like PROJEKT or WIZKI (not MATERIALY)."""
    if not isinstance(f, dict):
        return False
    blob = " ".join(
        [
            str(f.get("path") or ""),
            str(f.get("rel") or ""),
            str(f.get("slot") or ""),
            str(f.get("role") or ""),
        ]
    )
    n = norm(blob)
    if "material" in n or "magnific" in n:
        return False
    if "projekt" in n or "project" in n:
        return True
    if any(k in n for k in ("wizki", "wizka", "wizualiz", "visuals", "/4 -", "\\4 -")):
        return True
    # Role from indexer: viz = WIZKI; source alone is ambiguous (MATERIALY also source)
    role = str(f.get("role") or "").lower()
    if role == "viz":
        return True
    return False


def is_wizki_dir(name: str) -> bool:
    return classify_slot_role(name) == "viz"


def is_archive_name(name: str) -> bool:
    return Path(name).suffix.lower() in ARCHIVE_EXT


def is_viz_image_name(name: str) -> bool:
    return Path(name).suffix.lower() in VIZ_IMAGE_EXT


def archive_looks_like_print(name: str) -> bool:
    """ZIP zwykle = pakiet do druku (szczegolnie *Pakiet*, FQ, KUBARA)."""
    n = norm(name)
    return any(k in n for k in PRINT_ARCHIVE_KW)


def resolve_file_role(slot_role: str, filename: str) -> str | None:
    """
    Slot daje domyslna role, ale:
    - archiwum NIGDY nie jest wizualizacja,
    - archiwum w 3-DRUK / z nazwa pakietu/FQ -> print,
    - w slotcie viz zostaja tylko obrazy.
    """
    if not slot_role:
        return None
    if is_archive_name(filename):
        if slot_role == "print" or archive_looks_like_print(filename):
            return "print"
        if slot_role == "viz":
            # ZIP wlozony do 4-WIZKI (np. DK-...-Pakiet.zip) = nie wizka
            return "print"
        return slot_role  # source / inne
    if slot_role == "viz" and not is_viz_image_name(filename):
        # PDF/AI w folderze wizki nie trafia do galerii wizualizacji
        return None
    return slot_role


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
        if not c or c == "OTHER":
            continue
        mapped = CARRIER_TO_TAG.get(c.upper()) or CARRIER_TO_TAG.get(norm(c).upper())
        if mapped:
            tags.add(norm(mapped))
            continue
        cn = norm(c)
        if cn in CURATED_VOCAB and not is_noise_tag(cn):
            tags.add(cn)
        elif len(cn) >= 4 and not is_noise_tag(cn):
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


def scan_slot_files(slot_dir: Path, root: Path, *, slot_name: str = "") -> list[dict]:
    files: list[dict] = []
    try:
        for f in slot_dir.iterdir():
            if f.is_file() and f.suffix.lower() in SCAN_EXT:
                try:
                    ent = file_entry(f, root)
                    if slot_name:
                        ent["slot"] = slot_name
                    files.append(ent)
                    touch_index_live(
                        kind="file",
                        name=f.name,
                        path=str(f),
                        product=_LIVE_PRODUCT,
                        slot=slot_name,
                        file=f.name,
                        inc_file=True,
                    )
                except (PermissionError, OSError):
                    pass
    except (PermissionError, OSError):
        pass
    files.sort(key=lambda x: x.get("name", ""))
    return files


def scan_viz_slot_files(
    slot_dir: Path,
    root: Path,
    *,
    slot_name: str = "",
    max_depth: int = 4,
) -> list[dict]:
    """WIZKI: pliki w slocie + zagniezdzenia (INTERNET-PREZENTACJE-RGB, data/RGB, ...).

    Flat scan_slot_files pomija RGB w podfolderach → puste viz mimo plikow na dysku
    (CYNAMONKA/ŚLIWKA MINI 6300782/6300784, 2026-09-04).
    """
    files: list[dict] = []
    seen: set[str] = set()

    def walk(p: Path, depth: int) -> None:
        if depth > max_depth:
            return
        try:
            children = list(p.iterdir())
        except (PermissionError, OSError):
            return
        for child in children:
            try:
                if child.is_file() and child.suffix.lower() in SCAN_EXT:
                    ent = file_entry(child, root)
                    if slot_name:
                        ent["slot"] = slot_name
                    key = ent.get("path") or child.name
                    if key in seen:
                        continue
                    seen.add(key)
                    files.append(ent)
                    touch_index_live(
                        kind="file",
                        name=child.name,
                        path=str(child),
                        product=_LIVE_PRODUCT,
                        slot=slot_name,
                        file=child.name,
                        inc_file=True,
                    )
                elif child.is_dir():
                    walk(child, depth + 1)
            except (PermissionError, OSError):
                continue

    walk(slot_dir, 0)
    files.sort(key=lambda x: x.get("name", ""))
    return files


def classify_special_document(filename: str) -> str | None:
    """Karty wprowadzenia / strategie pozycjonowania - dodatkowy tag NIEZALEZNY
    od podstawowej roli (source/print/...), tylko dla checklisty rozszerzonej."""
    n = norm(filename)
    if not n:
        return None
    if any(k in n for k in KARTY_WPROWADZENIA_KW):
        return "karty_wprowadzenia"
    ext = Path(filename).suffix.lower()
    if ext in (".pptx", ".ppt", ".key") and any(k in n for k in STRATEGIA_KW):
        return "strategia"
    return None


def _is_elements_dirname(name: str) -> bool:
    n = norm(name)
    return (
        "elementy" in n
        or "elements" in n
        or "skladniki" in n
        or "ingredients" in n
        or n == "element"
        or n.startswith("element ")
        # Surowe elementy: 2 - PROJEKT/links (Adobe Links / cropy zrodlowe)
        or n == "links"
        or n == "linki"
    )


def scan_elements_files(slot_dir: Path, root: Path) -> list[dict]:
    """Pliki elementow: bezposrednio w folderze + 1 poziom podfolderow
    (np. ELEMENTY/PNG/*.png)."""
    files: list[dict] = []
    seen: set[str] = set()
    try:
        for f in slot_dir.iterdir():
            if f.is_file() and f.suffix.lower() in SCAN_EXT:
                try:
                    ent = file_entry(f, root)
                    key = ent.get("path") or f.name
                    if key not in seen:
                        seen.add(key)
                        files.append(ent)
                        touch_index_live(
                            kind="file",
                            name=f.name,
                            path=str(f),
                            product=_LIVE_PRODUCT,
                            slot=f.parent.name,
                            file=f.name,
                            inc_file=True,
                        )
                except (PermissionError, OSError):
                    pass
            elif f.is_dir():
                try:
                    for nested in f.iterdir():
                        if nested.is_file() and nested.suffix.lower() in SCAN_EXT:
                            try:
                                ent = file_entry(nested, root)
                                key = ent.get("path") or nested.name
                                if key not in seen:
                                    seen.add(key)
                                    files.append(ent)
                            except (PermissionError, OSError):
                                pass
                except (PermissionError, OSError):
                    pass
    except (PermissionError, OSError):
        pass
    files.sort(key=lambda x: x.get("name", ""))
    return files


def scan_revision_slots(child: Path, root: Path) -> tuple[list[str], dict[str, list[dict]], list[dict]]:
    """Skan slotow rewizji. ELEMENTY czesto leza jako PODFOLDER
    `1 - MATERIALY/ELEMENTY` - wczesniej nie byly indeksowane (falszywy BRAK
    w checklistcie). Od 2026-07-18: zagniezdzenie + skladniki + 1 poziom w ELEMENTY."""
    slots: list[str] = []
    files_by_role: dict[str, list[dict]] = {"source": [], "print": [], "viz": [], "elements": []}
    wizki_files: list[dict] = []
    try:
        for sub in child.iterdir():
            if not sub.is_dir():
                continue
            sn = sub.name
            slots.append(sn)
            # Slot sam w sobie = ELEMENTY (rzadkie, ale bywa)
            if _is_elements_dirname(sn):
                for f in scan_elements_files(sub, root):
                    files_by_role.setdefault("elements", []).append(f)
                continue
            slot_role = classify_slot_role(sn)
            if not slot_role:
                # Mimo braku roli glownej - szukaj ELEMENTY w srodku (np. MATERIALY)
                try:
                    for nested in sub.iterdir():
                        if nested.is_dir() and _is_elements_dirname(nested.name):
                            slots.append(sn + "/" + nested.name)
                            for f in scan_elements_files(nested, root):
                                files_by_role.setdefault("elements", []).append(f)
                except (PermissionError, OSError):
                    pass
                continue
            # HARD: 4-WIZKI czesto trzyma RGB w podfolderach — flat scan = 0 wizki
            if slot_role == "viz":
                scanned = scan_viz_slot_files(sub, root, slot_name=sn)
            else:
                scanned = scan_slot_files(sub, root, slot_name=sn)
            for f in scanned:
                role = resolve_file_role(slot_role, f.get("name") or "")
                if not role:
                    continue
                f["role"] = role
                f["slot"] = sn
                files_by_role.setdefault(role, []).append(f)
                if role == "viz" and is_viz_image_name(f.get("name") or ""):
                    wizki_files.append(f)
                special = classify_special_document(f.get("name") or "")
                if special:
                    files_by_role.setdefault(special, []).append(f)
            # MATERIALY / PROJEKT: 1 poziom ELEMENTY/ELEMENTS/SKLADNIKI
            try:
                for nested in sub.iterdir():
                    if nested.is_dir() and _is_elements_dirname(nested.name):
                        slots.append(sn + "/" + nested.name)
                        for f in scan_elements_files(nested, root):
                            files_by_role.setdefault("elements", []).append(f)
            except (PermissionError, OSError):
                pass
    except (PermissionError, OSError):
        pass
    for role in files_by_role:
        files_by_role[role].sort(key=lambda x: x.get("name", ""))
    wizki_files.sort(key=lambda x: x.get("name", ""))
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


def load_product_aliases() -> list[dict]:
    try:
        data = json.loads(PRODUCT_ALIASES_PATH.read_text(encoding="utf-8"))
        return data.get("groups") or []
    except (OSError, json.JSONDecodeError):
        return []


def apply_product_aliases(products: list[dict]) -> None:
    """DK<->GC "ten sam produkt" (2026-07-18, P1/P9). Powiazanie z product-aliases.json
    (indeks lub reczne wskazanie folderu przez admina/power_user - Faza 4) - dopisuje
    kazdemu czlonkowi grupy `linked_products` + `alias_langs` (suma jezykow z WSZYSTKICH
    czlonkow), tak aby modal wizualizacji mogl pokazac warianty jezykowe ponad marka."""
    groups = load_product_aliases()
    if not groups:
        return
    by_id = {p["id"]: p for p in products}
    for group in groups:
        member_ids = [m.get("product_id") for m in group.get("members") or [] if m.get("product_id")]
        present = [by_id[mid] for mid in member_ids if mid in by_id]
        if len(present) < 2:
            continue
        alias_langs: set[str] = set()
        for prod in present:
            # TYLKO surowe langs z rewizji - bez domyslu marki (GC!=gb).
            for r in prod.get("revisions") or []:
                alias_langs.update(r.get("langs") or [])
        for prod in present:
            prod["linked_products"] = [
                {"product_id": other["id"], "brand": other.get("brand")}
                for other in present
                if other["id"] != prod["id"]
            ]
            prod["alias_langs"] = sorted(alias_langs)
            prod["alias_canonical_id"] = group.get("canonical_id") or member_ids[0]


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


def is_category_archive_folder(name: str) -> bool:
    """Folder kategorii — ARCHIWUM (nie rozszerzenie .zip)."""
    return (name or "").strip().upper().endswith("ARCHIWUM")


def strip_product_folder_status_suffix(name: str) -> str:
    """Usun sufiks ' - F/X/D' z nazwy folderu produktu w archiwum."""
    m = re.match(r"^(.+?)\s-\s[FXD]$", name or "", re.I)
    return m.group(1).strip() if m else (name or "").strip()


def finalize_revision_groups(revisions: list[dict], cat_name: str) -> None:
    """Carrier guess + is_latest (wspolne dla live i archiwum)."""
    cat_u = (cat_name or "").upper()
    is_bars_cat = "BAR" in cat_u or "BATON" in cat_u
    if is_bars_cat:
        for r in revisions:
            if r.get("carrier") in ("DOY", "DOY6X"):
                r["carrier_guessed"] = True
    known_carriers = [
        r["carrier"] for r in revisions if r["carrier"] and r["carrier"] not in ("OTHER", "UNKNOWN", "WARIANT")
    ]
    if known_carriers:
        majority_carrier = Counter(known_carriers).most_common(1)[0][0]
        for r in revisions:
            if not r["carrier"] or r["carrier"] in ("OTHER", "UNKNOWN", "WARIANT"):
                r["carrier"] = majority_carrier
                r["carrier_guessed"] = True
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
            if not r.get("in_archive"):
                r["is_latest"] = False
        live_items = [r for r in items_sorted if not r.get("in_archive")]
        pick = live_items if live_items else items_sorted
        if pick:
            pick[-1]["is_latest"] = True


def scan_revision_children(product_dir: Path, root: Path, brand: str, cat_name: str) -> list[dict]:
    """Skan folderow-wariantow w katalogu produktu (live lub archiwum)."""
    revisions: list[dict] = []
    try:
        children = list(product_dir.iterdir())
    except (PermissionError, OSError):
        return revisions

    for child in children:
        if not child.is_dir():
            continue
        base, rev, full = parse_index(child.name)
        carrier = parse_carrier(child.name)
        date_s = parse_date(child.name)
        touch_index_live(
            kind="folder",
            name=child.name,
            path=str(child),
            product=_LIVE_PRODUCT,
            slot=child.name,
        )
        slots, files_by_role, wizki_files = scan_revision_slots(child, root)

        pool: list[dict] = list(wizki_files or [])
        fbr = files_by_role or {}
        for role_key in ("source", "print", "viz", "elements"):
            pool.extend(fbr.get(role_key) or [])
        if not full:
            base, rev, full = infer_index_from_files(pool)
        if not carrier or carrier == "OTHER":
            inferred = infer_carrier_from_files(pool)
            if inferred:
                carrier = inferred

        # HARD: lang evidence = folder name + PROJEKT/WIZKI only (not MATERIALY)
        lang_pool = [f for f in pool if is_lang_evidence_file(f)]
        raw_langs = infer_langs_from_files(child.name, lang_pool)
        file_langs, langs_source = apply_brand_lang_baseline(brand, raw_langs)
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
                "langs": file_langs,
                "langs_manual": False,
                "langs_source": langs_source,
            }
        )

    revisions = dedupe_lifecycle_folder_twins(revisions)
    finalize_revision_groups(revisions, cat_name)
    return revisions


def merge_category_archive(cat: Path, root: Path, brand: str, products: list[dict]) -> int:
    """Dolacz warianty z — ARCHIWUM do istniejacych produktow (bez duplikatu produktu)."""
    arch_dir = None
    try:
        for child in cat.iterdir():
            if child.is_dir() and is_category_archive_folder(child.name):
                arch_dir = child
                break
    except (PermissionError, OSError):
        return 0
    if not arch_dir:
        return 0

    cat_name = cat.name
    live_by_name: dict[str, dict] = {}
    live_by_id: dict[str, dict] = {}
    for p in products:
        if p.get("category") != cat_name or p.get("brand") != brand:
            continue
        live_by_name[p["name"]] = p
        live_by_id[p["id"]] = p

    merged = 0
    try:
        arch_prods = sorted([p for p in arch_dir.iterdir() if p.is_dir()], key=lambda p: p.name)
    except (PermissionError, OSError):
        return 0

    for arch_prod in arch_prods:
        key_name = strip_product_folder_status_suffix(arch_prod.name)
        target = live_by_name.get(key_name)
        if not target:
            pid = norm(key_name).replace(" ", "-")[:80]
            target = live_by_id.get(pid)
        if not target:
            item = scan_product(cat_name, arch_prod, root, brand)
            if not item:
                print(f"  [archive] brak produktu live dla: {arch_prod.name}")
                continue
            item["in_archive"] = True
            item["archive_only"] = True
            for r in item.get("revisions") or []:
                r["in_archive"] = True
            if item.get("revisions"):
                for r in item["revisions"]:
                    r["is_latest"] = False
                item["revisions"][-1]["is_latest"] = True
            products.append(item)
            live_by_name[item["name"]] = item
            live_by_id[item["id"]] = item
            merged += len(item.get("revisions") or [])
            print(f"  [archive] produkt tylko archiwum: {arch_prod.name}")
            continue

        arch_revs = scan_revision_children(arch_prod, root, brand, cat_name)
        paths = {x.get("path") for x in target.get("revisions") or []}
        folders = {x.get("folder") for x in target.get("revisions") or []}
        for r in arch_revs:
            r["in_archive"] = True
            r["is_latest"] = False
            r["archive_wrapper"] = str(arch_prod).replace("\\", "/")
            if r.get("path") in paths or r.get("folder") in folders:
                continue
            target.setdefault("revisions", []).append(r)
            paths.add(r.get("path"))
            folders.add(r.get("folder"))
            merged += 1

        target["revision_count"] = len(target.get("revisions") or [])
        target["indexes"] = sorted({r["index"] for r in target["revisions"] if r.get("index")})
        target["index_bases"] = sorted({r["index_base"] for r in target["revisions"] if r.get("index_base")})

    if merged:
        print(f"  [{brand}] {cat_name} archiwum: +{merged} wariant(ow)")
    return merged


def scan_product(cat_name: str, product_dir: Path, root: Path, brand: str) -> dict | None:
    global _LIVE_PRODUCT
    product_name = product_dir.name
    display_name, bracket_tags = parse_display_name(product_name)
    _LIVE_PRODUCT = display_name or product_name
    touch_index_live(
        kind="product",
        name=_LIVE_PRODUCT,
        path=str(product_dir),
        product=_LIVE_PRODUCT,
    )
    revisions = scan_revision_children(product_dir, root, brand, cat_name)
    if not revisions and not product_dir.exists():
        return None

    tags = extract_tags(
        [cat_name, product_name, display_name] + [r["folder"] for r in revisions],
        extra_bracket=bracket_tags,
    )
    tag_groups = build_tag_groups(tags)
    indexes = sorted({r["index"] for r in revisions if r.get("index")})
    index_bases = sorted({r["index_base"] for r in revisions if r.get("index_base")})
    # Podkategoria: WSZYSTKIE nawiasy z nazwy (nie tylko te co przeszly filtr
    # is_noise_tag dla Smak/Typ - "balls_crispy"/"plant based" sa wielowyrazowe
    # i sa tam odrzucane, ale jako Podkategoria maja byc widoczne, patrz P4).
    raw_brackets = [norm(m.group(1)) for m in BRACKET_HINT_RE.finditer(product_name)]
    subcat_slug, subcat_label = subcategory_label_pl(raw_brackets)
    touch_index_live(
        kind="product",
        name=_LIVE_PRODUCT,
        path=str(product_dir),
        product=_LIVE_PRODUCT,
        inc_product=True,
    )

    return {
        "id": norm(product_name).replace(" ", "-")[:80],
        "name": product_name,
        "display_name": display_name,
        "category": cat_name,
        "brand": brand,
        "subcategory_slug": subcat_slug,
        "subcategory_label": subcat_label,
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


def canonicalize_lang_code(code: str) -> str:
    """Map gb/uk/en -> en; ukr -> ua. UA stays ua (Ukrainian). Empty for junk."""
    c = (code or "").lower().strip()
    if not c or c in ("?", "unknown", "xx"):
        return ""
    if c == "ua":
        return "ua"
    c = LANG_ALIASES.get(c, c)
    if c in ("gb", "uk", "en"):
        return "en"
    if c == "ukr":
        return "ua"
    return c


def parse_folder_langs(folder_name: str) -> list[str]:
    """Kody jezykow z segmentow ' - ' (w tym ' - PL EN - ') oraz prefiksu nosnika."""
    langs: list[str] = []
    seen: set[str] = set()

    def add_token(tok: str) -> None:
        code = canonicalize_lang_code(tok.strip().lower())
        if len(code) != 2:
            return
        if code in KNOWN_LANG_CODES and code not in seen:
            seen.add(code)
            langs.append(code)

    parts = [p.strip() for p in (folder_name or "").split(" - ") if p.strip()]
    if not parts:
        return []
    for part in parts:
        # pomin segmenty wygladajace jak data / indeks
        if DATE_DOT_RE.search(part) or re.fullmatch(r"\d{5,9}(?:\.\d{2})?", part):
            continue
        # Segment wylacznie z kodami jezykow: "PL EN", "CZ SK", "GB"
        toks = [t for t in re.split(r"[\s,;/]+", part) if t.strip()]
        if toks and all(
            canonicalize_lang_code(t) in KNOWN_LANG_CODES
            and len(canonicalize_lang_code(t)) == 2
            for t in toks
        ):
            for tok in toks:
                add_token(tok)
            continue
        for tok in toks:
            add_token(tok)
    return langs


_LANG_CODES_ORDER = (
    "pl", "de", "en", "gb", "ua", "uk", "cz", "sk", "hu", "ro", "lt", "lv", "ee",
    "fr", "it", "es", "nl", "ru", "hr", "si", "bg", "ar",
)


def parse_langs_from_text(text: str) -> list[str]:
    """Wszystkie kody jezyka z nazwy pliku/folderu (CZ_SK -> [cz, sk]). Bez domyslow."""
    n = norm(text or "")
    if not n:
        return []
    found: list[str] = []
    seen: set[str] = set()
    for code in _LANG_CODES_ORDER:
        if re.search(rf"(^|[^a-z]){re.escape(code)}([^a-z]|$)", n):
            mapped = canonicalize_lang_code(code)
            if mapped in KNOWN_LANG_CODES and mapped not in seen:
                seen.add(mapped)
                found.append(mapped)
    return found


def infer_langs_from_files(folder_name: str, files: list[dict] | None) -> list[str]:
    """Surowe dane: jezyki z nazwy folderu + plikow PROJEKT/WIZKI (caller filtruje)."""
    seen: set[str] = set()
    out: list[str] = []
    for code in parse_folder_langs(folder_name) + parse_langs_from_text(folder_name):
        c = canonicalize_lang_code(code)
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    for f in files or []:
        if isinstance(f, dict) and not is_lang_evidence_file(f):
            # Caller should pre-filter; keep guard for direct calls
            path_n = norm(str(f.get("path") or "") + " " + str(f.get("slot") or ""))
            if "material" in path_n or "magnific" in path_n:
                continue
            if not (
                "projekt" in path_n
                or "project" in path_n
                or "wizki" in path_n
                or "visuals" in path_n
                or str(f.get("role") or "") == "viz"
            ):
                continue
        name = (f.get("name") if isinstance(f, dict) else "") or ""
        for code in parse_langs_from_text(name):
            c = canonicalize_lang_code(code)
            if c and c not in seen:
                seen.add(c)
                out.append(c)
    return out


def apply_brand_lang_baseline(brand: str, raw_langs: list[str] | None) -> tuple[list[str], str]:
    """DK zawsze ma PL (pewnik marki). Dodatkowe kody TYLKO z raw (folder/plik).

    GC: bez baseline (GC!=en). Extra jezyki tylko z nazw albo override.
    Zwraca (langs, langs_source).
    """
    brand_u = (brand or "DK").upper()
    raw: list[str] = []
    seen: set[str] = set()
    for code in raw_langs or []:
        c = canonicalize_lang_code(code)
        if not c:
            continue
        if c not in seen and c in KNOWN_LANG_CODES:
            seen.add(c)
            raw.append(c)

    if brand_u == "DK":
        out = ["pl"]
        for c in raw:
            if c != "pl":
                out.append(c)
        if len(out) > 1:
            return out, "brand_dk+raw"
        return out, "brand_dk"

    # GC i inne: tylko dowod z nazw
    if raw:
        return raw, "raw"
    return [], "unknown"


def detect_lang_explicit(filename: str) -> str | None:
    langs = parse_langs_from_text(filename)
    return langs[0] if langs else None


def detect_lang(filename: str) -> str:
    """DEPRECATED fallback - nie wymyslaj PL. Puste = nieznany."""
    return detect_lang_explicit(filename) or ""


def lang_label(code: str) -> str:
    if not code or code in ("?", "unknown", "xx"):
        return "?"
    return LANG_LABELS.get(code, code.upper())


def load_lang_overrides() -> dict:
    try:
        data = json.loads(LANG_OVERRIDES_PATH.read_text(encoding="utf-8"))
        return data.get("overrides") or {}
    except (OSError, json.JSONDecodeError):
        return {}


def apply_lang_overrides(products: list[dict]) -> None:
    """Reczne langs (admin) = najwyższy priorytet. NIGDY nie nadpisuj auto po rebuildzie."""
    overrides = load_lang_overrides()
    if not overrides:
        return
    for p in products:
        for r in p.get("revisions") or []:
            idx = str(r.get("index") or "")
            path = str(r.get("path") or "").replace("\\", "/")
            folder = str(r.get("folder") or "")
            hit = None
            for key in (idx, path, folder, path.replace("/", "\\")):
                if key and key in overrides:
                    hit = overrides[key]
                    break
            if not hit:
                continue
            manual = hit.get("langs")
            if not isinstance(manual, list) or not manual:
                continue
            cleaned = []
            seen: set[str] = set()
            for raw in manual:
                code = canonicalize_lang_code(str(raw))
                if code in KNOWN_LANG_CODES and code not in seen:
                    seen.add(code)
                    cleaned.append(code)
            if cleaned:
                r["langs"] = cleaned
                r["langs_manual"] = True
                r["langs_source"] = "manual"


def is_viz_image(f: dict) -> bool:
    ext = (f.get("ext") or "").lower()
    return ext in {"jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"}


def pick_thumb_file(
    files: list[dict],
    preferred_index: str | None = None,
    *,
    carrier: str | None = None,
) -> dict | None:
    """Priority: FRONT-S (lekki podglad), potem S-SKLEP, FRONT-L/XL, inne FRONT, PREV.

    HARD KAR6X / KARTON 6x MINI: preferuj FRONT-L (nie ENFACE) gdy dostepne.
    NIGDY nie preferuj SKLEP2-XL / *-XL nad zwyklym FRONT-S.png - galeria ma byc szybka.
    """
    imgs = [f for f in files if is_viz_image(f)]
    if not imgs:
        return None
    # Nigdy nie bierz FRONT z innego indeksu (np. 6300524 w folderze 6300767)
    if preferred_index:
        pref = re.sub(r"\D", "", str(preferred_index))[:7]
        if len(pref) >= 6:
            matched = [f for f in imgs if pref in (f.get("name") or "")]
            if matched:
                imgs = matched

    carrier_u = (carrier or "").upper().replace(" ", "")
    prefer_front_l = carrier_u in ("KAR6X", "KARTON6XMINI", "KAR6XMINI") or "KAR6X" in carrier_u

    def tier(name: str) -> int:
        n = name.upper().replace("Ł", "L").replace("ł", "L")
        # demote technical / non-packaging shots — token match, NOT substring.
        # BUGFIX 2026-07-20: "AUTO" in "AUTOM-GRILL" false-positive demoted ALL
        # packshots of burger-klasyczny 6300755 to tier 9, then TYL-S won by mtime.
        tokens = set(re.split(r"[-_\s.]+", n))
        if tokens & {"AUTO", "PROBE", "DIELINE", "TEMPLATE", "WYKROJNIK"}:
            return 9
        if "DIE-LINE" in n or "PDF.PNG" in n or "_PDF" in n:
            return 9
        is_enface = "ENFACE" in n and "TYL" not in n
        is_front_token = "FRONT" in n
        is_front = is_front_token or is_enface
        is_sklep = "SKLEP" in n
        is_xl = bool(re.search(r"[-_]XL\b", n) or "XL." in n)
        is_front_l = bool(
            re.search(r"FRONT[-_]?L\b", n)
            or (is_front_token and re.search(r"[-_]L\.", n) and not is_xl)
        )
        # Czysty FRONT-S / ENFACE-S (bez SKLEP / XL) - preferowany do miniatur
        is_front_s = is_front and not is_sklep and not is_xl and (
            "FRONT-S" in n
            or "ENFACE-S" in n
            or bool(re.search(r"(?:FRONT|ENFACE)[-_]?S\b", n))
            or bool(re.search(r"[-_]S\.", n))
        )
        # KAR6X: FRONT-L wygrywa nad ENFACE i nad FRONT-S
        if prefer_front_l and is_front_l and not is_enface:
            return 0
        if prefer_front_l and is_enface:
            return 4  # demote ENFACE for KAR6X
        if is_front_s:
            return 0 if not prefer_front_l else 1
        if is_front and is_sklep and not is_xl:
            return 2
        if is_front and (is_xl or is_front_l):
            return 3
        if is_front:
            return 4
        if "PREV" in n or "WIZKA" in n or "WIZ_" in n:
            return 5
        if "TYL" in n or "BACK" in n:
            return 7
        return 6

    best_tier = min(tier(f.get("name") or "") for f in imgs)
    pool = [f for f in imgs if tier(f.get("name") or "") == best_tier]

    def rank(f: dict) -> tuple:
        name = (f.get("name") or "").upper()
        ext = (f.get("ext") or "").lower()
        # W tierze FRONT-S: preferuj DK-*-FRONT-S.png (nie DOY- bez marki / nie XL)
        dk_bonus = 1 if name.startswith("DK-") or name.startswith("GC-") else 0
        # Bez tla (PNG/WEBP, przezroczyste) > z tlem (JPG/JPEG/TIFF, studyjne zdjecie) -
        # oryginalny plik produktu nie ma szarego tla/artefaktow, wiec miniatura
        # galerii tez nie powinna (2026-07-18, zgloszenie usera). Patrz DamLabels.vizBackground.
        transparent_bonus = 1 if ext in ("png", "webp") else 0
        front_l_bonus = 1 if prefer_front_l and re.search(r"FRONT[-_]?L\b", name) else 0
        # png/jpg ok; nie premiuj jpg kosztem poprawnego FRONT-S.png
        mtime = f.get("mtime") or ""
        return (
            front_l_bonus,
            dk_bonus,
            transparent_bonus,
            mtime,
            1 if ext in ("png", "jpg", "jpeg", "webp") else 0,
        )

    return max(pool, key=rank)


def _is_valid_jpeg(path: Path) -> bool:
    try:
        with path.open("rb") as fh:
            return fh.read(3) == b"\xff\xd8\xff"
    except OSError:
        return False


def write_web_thumb(src: Path, dest: Path, max_edge: int = THUMB_MAX_EDGE) -> None:
    """Zapis miniatury JPEG. NIGDY nie kopiuj TIF/PSD/AI pod rozszerzeniem .jpg
    (2026-08-04: dk-doy-datesy-karmel mial 39MB TIFF jako .jpg -> Brak miniatury)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        from PIL import Image

        with Image.open(src) as im:
            # Przezroczystosc na BIALE - bez szarego letterbox w galerii
            if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
                rgba = im.convert("RGBA")
                bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                bg.paste(rgba, mask=rgba.split()[-1])
                im = bg.convert("RGB")
            else:
                im = im.convert("RGB")
            im.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
            im.save(dest, "JPEG", quality=85, optimize=True)
        if not _is_valid_jpeg(dest):
            raise RuntimeError(f"thumb not jpeg after PIL save: {dest}")
        return
    except Exception:
        pass
    # Fallback: tylko prawdziwy JPEG zrodlowy - nigdy TIF/PNG/PSD jako .jpg
    if src.suffix.lower() in {".jpg", ".jpeg"} and _is_valid_jpeg(src):
        shutil.copy2(src, dest)
        return
    raise OSError(f"cannot build jpeg thumb from {src}")


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
            base_lower = base.lower()
            for length in range(3, len(base_lower) + 1):
                pref = base_lower[:length]
                if pid not in by_prefix[pref]:
                    by_prefix[pref].append(pid)
            for length in range(4, len(base) + 1):
                pref = base[:length]
                if pid not in by_prefix[pref]:
                    by_prefix[pref].append(pid)

        rev_indexes = [str(r.get("index") or "") for r in p.get("revisions") or [] if r.get("index")]
        multi_bits: list[str] = []
        for r in p.get("revisions") or []:
            langs_r = [canonicalize_lang_code(x) for x in (r.get("langs") or []) if x]
            langs_r = [x for x in langs_r if x]
            if len(langs_r) >= 2:
                multi_bits.extend(MULTI_LANG_SYNONYMS)
                multi_bits.append(((NAMING.get("ui") or {}).get("multi_lang_label")) or "Multijęzyczny")
                multi_bits.extend(langs_r)
                break
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
                        [
                            p.get("display_name") or p["name"],
                            p["name"],
                            p["category"],
                            p.get("path") or "",
                        ]
                        + p["tags"]
                        + p["indexes"]
                        + rev_indexes
                        + [r["folder"] for r in p.get("revisions") or []]
                        + [r.get("path") or "" for r in p.get("revisions") or []]
                        + multi_bits
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
    # Usun stare kolizyjne unknown_*.jpg (Banoffee/Karmel/Lemon nadpisywaly sie)
    for stale in thumbs_dir.glob("unknown_*.jpg"):
        try:
            stale.unlink()
        except OSError:
            pass

    out: list[dict] = []
    for p in products:
        brand = p.get("brand") or "DK"
        pid = p.get("id") or "p"
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
            # Upewnij indeks z plikow jesli nadal pusty
            if not r.get("index_base"):
                ib, ir, full = infer_index_from_files(r.get("wizki") or [])
                if full:
                    r["index_base"], r["index_rev"], r["index"] = ib, ir, full

            revision_langs: list[str] = list(r.get("langs") or [])
            wizki = r.get("wizki") or []
            lang_files: dict[str, list[dict]] = defaultdict(list)

            for f in wizki:
                # Wszystkie kody z nazwy (CZ_SK -> cz i sk), nie tylko pierwszy.
                explicits = parse_langs_from_text(f.get("name") or "")
                if explicits:
                    for lg in explicits:
                        lang_files[lg].append(f)
                elif revision_langs:
                    for lg in revision_langs:
                        lang_files[lg].append(f)
                # Brak sygnalu: NIE wrzucaj do gb/pl - zostaw na "?" ponizej.

            if not lang_files and revision_langs:
                for lg in revision_langs:
                    lang_files[lg] = list(wizki)

            target_langs = sorted(lang_files.keys())
            if not target_langs and revision_langs:
                target_langs = list(revision_langs)
            if not target_langs:
                # DK: baseline PL. GC: unknown / UI "?" (zakaz GC->gb).
                if brand == "DK" and wizki:
                    target_langs = ["pl"]
                    lang_files["pl"] = list(wizki)
                elif wizki:
                    target_langs = ["unknown"]
                    lang_files["unknown"] = list(wizki)
                else:
                    continue

            for lang in target_langs:
                # Thumb z slotu WIZKI - preferuj plik z indeksem TEJ rewizji
                files_for_lang = lang_files.get(lang) or []
                thumb_pool = list(wizki) if wizki else files_for_lang
                index_base = r.get("index_base") or ""
                if not index_base or str(index_base).lower() == "noid":
                    ib, ir, full = parse_index(r.get("folder") or "")
                    if not full:
                        ib, ir, full = infer_index_from_files(r.get("wizki") or [])
                    if full:
                        r["index_base"], r["index_rev"], r["index"] = ib, ir, full
                        index_base = ib or ""
                if not index_base:
                    index_base = "pending"
                carrier_for_thumb = r.get("carrier") or ""
                thumb_src = pick_thumb_file(thumb_pool, index_base, carrier=carrier_for_thumb)
                if not thumb_src:
                    thumb_src = pick_thumb_file(
                        files_for_lang, index_base, carrier=carrier_for_thumb
                    )
                if not thumb_src:
                    continue
                # Legacy data/thumbs JPG WYLACZONE — UI /thumb-cache AVIF (PAMIEC-PODRECZNA).
                thumb_name = safe_thumb_stem(pid, index_base, lang)
                try:
                    src_path = Path(thumb_src["path"])
                except (OSError, TypeError, KeyError):
                    continue
                langs_out = revision_langs if revision_langs else (
                    [] if lang in ("?", "unknown", "xx") else [lang]
                )
                pname = p.get("display_name") or p["name"]
                carrier_code = r.get("carrier") or ""
                lang_unknown = lang in ("?", "unknown", "xx") or not langs_out
                out.append(
                    {
                        "product_id": pid,
                        "product_name": pname,
                        "category": p["category"],
                        "brand": brand,
                        "subcategory_slug": p.get("subcategory_slug") or "",
                        "subcategory_label": p.get("subcategory_label") or "",
                        "linked_products": p.get("linked_products") or [],
                        "alias_langs": p.get("alias_langs") or [],
                        "carrier": carrier_code,
                        "carrier_label": carrier_label_pl(
                            carrier_code,
                            product_name=pname,
                            tags=p.get("tags") or [],
                        ),
                        "carrier_guessed": bool(r.get("carrier_guessed")),
                        "is_mix": is_mix_product(pname, p.get("tags") or []),
                        "index": r.get("index"),
                        "index_base": index_base,
                        "revision_folder": r.get("folder"),
                        "revision_path": r.get("path"),
                        "langs": langs_out,
                        "langs_manual": bool(r.get("langs_manual")),
                        "lang": "?" if lang_unknown else lang,
                        "lang_label": "?" if lang_unknown else lang_label(lang),
                        "lang_unknown": lang_unknown,
                        "thumb_url": "",  # AVIF via /thumb-cache from path; no static JPG
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
            # Pomijaj folder archiwum kategorii (— ARCHIWUM) - warianty dolaczamy ponizej
            pname = prod.name or ""
            if is_category_archive_folder(pname):
                continue
            item = scan_product(cat_name, prod, root, brand)
            if item:
                products.append(item)
                count += 1
            if max_products and count >= max_products:
                break
        merge_category_archive(cat, root, brand, products)
        print(f"  [{brand}] {cat_name}: products so far {count}")
        if max_products and count >= max_products:
            break
    return products, categories, count


def merge_product_catalog_packaging(products: list[dict]) -> None:
    """Attach bulk_packaging_ref and tag_groups.pakowanie from catalog + bulk registry."""
    try:
        catalog = json.loads(PRODUCT_CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        catalog = {"products": {}}
    try:
        bulk = json.loads(BULK_PACKAGING_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        bulk = {"packs": {}}
    cat_products = catalog.get("products") or {}
    packs = bulk.get("packs") or {}
    by_index: dict[str, str] = {}
    for pid, entry in cat_products.items():
        if not isinstance(entry, dict):
            continue
        idx = entry.get("index_primary")
        if idx:
            by_index[str(idx)] = pid
        by_index[pid] = pid
    for p in products:
        pid = p.get("id") or ""
        entry = cat_products.get(pid)
        if not entry:
            for idx in p.get("indexes") or []:
                alt = cat_products.get(by_index.get(str(idx), ""))
                if alt:
                    entry = alt
                    break
        if not entry:
            continue
        ref = entry.get("bulk_packaging_ref")
        if ref:
            p["bulk_packaging_ref"] = ref
            pack = packs.get(ref) or {}
            label = pack.get("label")
            if label:
                tg = p.setdefault("tag_groups", {})
                pak = list(tg.get("pakowanie") or [])
                if label not in pak:
                    pak.append(label)
                tg["pakowanie"] = pak
                tags = list(p.get("tags") or [])
                if label not in tags:
                    tags.append(label)
                p["tags"] = tags


def main() -> None:
    global OUT, SEARCH_OUT, THUMBS_DIR
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="", help="Single root override (disables multi-root)")
    ap.add_argument("--brand", default="", help="Brand tag when using --root")
    ap.add_argument("--max-products", type=int, default=0, help="0 = all")
    ap.add_argument(
        "--out-dir",
        default="",
        help="Write file-index/search-index here (fixtures/tests). Default: apps/web/data",
    )
    args = ap.parse_args()

    if args.out_dir:
        out_dir = Path(args.out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        OUT = out_dir / "file-index.json"
        SEARCH_OUT = out_dir / "search-index.json"
        THUMBS_DIR = out_dir / "thumbs"
        THUMBS_DIR.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    try:
        if _LIVE_PATH.is_file():
            prev_live = json.loads(_LIVE_PATH.read_text(encoding="utf-8"))
            if isinstance(prev_live, dict):
                if prev_live.get("products_total"):
                    _LIVE["products_total"] = prev_live.get("products_total")
                if prev_live.get("files_total"):
                    _LIVE["files_total"] = prev_live.get("files_total")
    except (OSError, json.JSONDecodeError):
        pass
    if not _LIVE.get("products_total") and OUT.is_file():
        try:
            prev_idx = json.loads(OUT.read_text(encoding="utf-8"))
            prods = prev_idx.get("products") if isinstance(prev_idx, dict) else []
            _LIVE["products_total"] = len(prods or [])
            _LIVE["files_total"] = int(prev_idx.get("viz_count") or 0)
        except (OSError, json.JSONDecodeError, TypeError):
            pass
    _LIVE["running"] = True
    _write_index_live(force=True)
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
        marketing_root = root
        for p in root.parents:
            if (p / "- POLSKA").is_dir() or p.name.upper() in ("MARKETING",):
                marketing_root = p / "- POLSKA" if (p / "- POLSKA").is_dir() else p
                break
    else:
        _ensure_roots()
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
        marketing_root = MARKETING_ROOT

    attach_marketing_links(products)
    discover_marketing_materials(products, marketing_root)
    apply_product_aliases(products)
    apply_lang_overrides(products)
    merge_product_catalog_packaging(products)

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
    _atomic_write_json(OUT, payload)
    _atomic_write_json(
        SEARCH_OUT,
        {
            "generated_at": payload["generated_at"],
            "product_count": len(products),
            **search,
        },
    )

    sample = [p for p in products if "tarta" in norm(p.get("display_name", "")) and "malin" in norm(p.get("display_name", ""))]
    banoffee = [p for p in products if "banoffee" in norm(p.get("display_name", "")) and "kakao" in norm(p.get("display_name", ""))]
    orange = [v for v in viz if v.get("index_base") == "6300624" or "orange" in norm(v.get("product_name", ""))]
    _LIVE["running"] = False
    _write_index_live(force=True)
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

    # Po rebuildzie: dolacz authors / by_tag imion (Sylwia/Krzysztof/Szymon) z product-people + Asana.
    # Bez tego "Skanuj dysk" / build wycina wyszukiwanie po osobach.
    try:
        import importlib.util

        enrich_path = Path(__file__).resolve().parent / "enrich-search-tags.py"
        spec = importlib.util.spec_from_file_location("enrich_search_tags", enrich_path)
        if not spec or not spec.loader:
            raise RuntimeError("brak enrich-search-tags.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        code = mod.main()
        print(f"enrich-search-tags: exit={code}")
    except Exception as exc:  # noqa: BLE001
        print(f"WARN: enrich-search-tags failed: {exc}")

    try:
        import importlib.util

        enrich_assoc = Path(__file__).resolve().parent / "enrich-product-associations.py"
        spec2 = importlib.util.spec_from_file_location("enrich_product_associations", enrich_assoc)
        if spec2 and spec2.loader:
            mod2 = importlib.util.module_from_spec(spec2)
            spec2.loader.exec_module(mod2)
            code2 = mod2.main()
            print(f"enrich-product-associations: exit={code2}")
    except Exception as exc:  # noqa: BLE001
        print(f"WARN: enrich-product-associations failed: {exc}")


if __name__ == "__main__":
    main()
