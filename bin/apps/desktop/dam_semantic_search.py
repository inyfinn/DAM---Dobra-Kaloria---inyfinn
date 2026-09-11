# -*- coding: utf-8 -*-
"""Wyszukiwanie semantyczne assetow brandingowych (frazy potoczne).

Samodzielny modul: NIE importuje local_bridge.py. Wejscie: search(query, limit=200).

Kolejnosc zrodel konceptu na pliku:
  1. skojarzenia produkt <-> plik (linked_product_ids, appearance_tags)
  2. sciezka i nazwa folderu
  3. tekst OCR (jesli jest w indeksie / branding-recognition)
  4. nazwa pliku
  + dziedziczenie produktu po tym samym strzale (BSA NNNN) w tej samej kampanii
"""
from __future__ import annotations

import json
import re
import threading
import unicodedata
from pathlib import Path
from typing import Any

DESKTOP_DIR = Path(__file__).resolve().parent
WEB_DATA = DESKTOP_DIR.parent / "web" / "data"

_PL_FOLD = str.maketrans(
    {
        "ą": "a",
        "ć": "c",
        "ę": "e",
        "ł": "l",
        "ń": "n",
        "ó": "o",
        "ś": "s",
        "ź": "z",
        "ż": "z",
        "Ą": "a",
        "Ć": "c",
        "Ę": "e",
        "Ł": "l",
        "Ń": "n",
        "Ó": "o",
        "Ś": "s",
        "Ź": "z",
        "Ż": "z",
    }
)

_CAMPAIGN_RE = re.compile(
    r"08\s*-\s*kamapanie[/\\]+(\d{4})[/\\]+([^/\\]+)",
    re.IGNORECASE,
)
_SHOOT_RE = re.compile(r"(?<![a-z0-9])bsa\s+\d+(?![a-z0-9])", re.IGNORECASE)
_TOKEN_SPLIT_RE = re.compile(r"[^a-z0-9]+")
_KOPIA_SEG_RE = re.compile(r"(?i)-kopia$")
_NON_DIGITS_RE = re.compile(r"\D+")

_CACHE: dict[str, Any] = {
    "vocab": None,
    "assets": None,
    "product_concepts": None,
}
_CACHE_LOCK = threading.RLock()

# Korzeń hiperonimii podmiotu: weższe pojęcie (kobieta, dziewczyna, laska…)
# jest spełnione przez szersze oznaczenie na pliku (człowiek / postać).
_SUBJECT_ROOT = "subject:czlowiek"


def fold_text(text: str) -> str:
    """Male litery + obustronne zniesienie polskich znakow (kulke == kulkę)."""
    s = str(text or "").translate(_PL_FOLD)
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s.lower()


def collapse_spaces(text: str) -> str:
    """Zwijanie wielokrotnych spacji na kopii tekstu, nie na sciezce zrodlowej."""
    return re.sub(r"\s+", " ", str(text or "")).strip()


def tokenize(text: str) -> list[str]:
    folded = fold_text(text)
    return [t for t in _TOKEN_SPLIT_RE.split(folded) if t]


def _load_json(path: Path, default: Any) -> Any:
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _category_to_concepts(category: str) -> list[str]:
    blob = fold_text(category)
    out: list[str] = []
    if "chrupkulk" in blob:
        out.append("product:chrupkulki")
        return out
    if "kulki" in blob or "balls" in blob:
        out.append("product:kulki")
    if "baton" in blob or "bars" in blob:
        out.append("product:batony")
    if "roslinn" in blob or "plant" in blob:
        out.append("product:roslinne")
        out.append("product:niemieso")
    if "niemies" in blob:
        out.append("product:niemieso")
    if "sypkie" in blob or "breakfast" in blob:
        out.append("product:sypkie")
    if "napoj" in blob or "drink" in blob:
        out.append("product:napoje")
    if "przetwor" in blob or "spread" in blob or "krem" in blob:
        out.append("product:przetwory")
    if "dates" in blob:
        out.append("product:datesy")
    return out


def _build_vocab(raw: dict) -> dict[str, Any]:
    concepts = []
    alias_to_ids: dict[str, list[str]] = {}
    max_alias_words = 1
    stop = set()
    for w in raw.get("stopwords") or []:
        folded = fold_text(w)
        if folded:
            stop.add(folded)
    by_id: dict[str, dict] = {}
    for item in raw.get("concepts") or []:
        cid = str(item.get("id") or "").strip()
        if not cid:
            continue
        aliases = []
        seen = set()
        for alias in item.get("aliases") or []:
            folded = collapse_spaces(fold_text(alias))
            if not folded or folded in seen:
                continue
            seen.add(folded)
            aliases.append(folded)
            alias_to_ids.setdefault(folded, [])
            if cid not in alias_to_ids[folded]:
                alias_to_ids[folded].append(cid)
            words = len(folded.split(" "))
            if words > max_alias_words:
                max_alias_words = words
        rec = {
            "id": cid,
            "label_pl": item.get("label_pl") or cid,
            "opis": item.get("opis") or "",
            "aliases": aliases,
            "query_satisfied_by": [
                str(x) for x in (item.get("query_satisfied_by") or []) if x
            ],
        }
        concepts.append(rec)
        by_id[cid] = rec
    _apply_subject_hypernyms(concepts, by_id)
    return {
        "stopwords": stop,
        "concepts": concepts,
        "by_id": by_id,
        "alias_to_ids": alias_to_ids,
        "max_alias_words": max_alias_words,
    }


def _apply_subject_hypernyms(
    concepts: list[dict[str, Any]], by_id: dict[str, dict]
) -> None:
    """Węższe subject:* spełnia szerszy korzeń (człowiek), nie odwrotnie.

    Działa dla kobieta / mężczyzna / dziecko i każdego innego podtypu
    obecnego w słowniku — bez twardego „jeśli kobieta to człowiek”.
    """
    if _SUBJECT_ROOT not in by_id:
        return
    for rec in concepts:
        cid = rec.get("id") or ""
        if not cid.startswith("subject:") or cid == _SUBJECT_ROOT:
            continue
        alts = rec.setdefault("query_satisfied_by", [])
        if _SUBJECT_ROOT not in alts:
            alts.append(_SUBJECT_ROOT)


def _ensure_vocab() -> dict[str, Any]:
    if _CACHE["vocab"] is None:
        with _CACHE_LOCK:
            if _CACHE["vocab"] is None:
                raw = _load_json(WEB_DATA / "semantic-vocabulary.json", {})
                _CACHE["vocab"] = _build_vocab(raw)
    return _CACHE["vocab"]


def _ensure_product_concepts() -> dict[str, list[str]]:
    if _CACHE["product_concepts"] is None:
        fi = _load_json(WEB_DATA / "file-index.json", {})
        mapping: dict[str, list[str]] = {}
        for prod in fi.get("products") or []:
            pid = str(prod.get("id") or "").strip()
            if not pid:
                continue
            cats = []
            for key in ("category", "category_title", "folder_category"):
                if prod.get(key):
                    cats.extend(_category_to_concepts(str(prod.get(key))))
            uniq: list[str] = []
            for c in cats:
                if c not in uniq:
                    uniq.append(c)
            mapping[pid] = uniq
        _CACHE["product_concepts"] = mapping
    return _CACHE["product_concepts"]


def _recognition_by_id(recognition: dict) -> dict[str, dict]:
    """Mapa id -> rekord OCR plus skróty z cyfr (M-SHOP404317 <-> 404317)."""
    assets_map = recognition.get("assets") or {}
    if not isinstance(assets_map, dict):
        return {}
    out: dict[str, dict] = {}
    for key, rec in assets_map.items():
        if not isinstance(rec, dict):
            continue
        out[str(key)] = rec
        digits = _NON_DIGITS_RE.sub("", str(key))
        if len(digits) >= 6:
            out.setdefault(digits, rec)
            out.setdefault(digits[-6:], rec)
    return out


def _merge_ocr(asset: dict, recognition: dict, by_id: dict[str, dict] | None = None) -> str:
    text = str(asset.get("ocr_text") or "").strip()
    aid = str(asset.get("id") or "")
    lookup = by_id if by_id is not None else _recognition_by_id(recognition)
    rec = lookup.get(aid) or {}
    if not rec:
        digits = _NON_DIGITS_RE.sub("", aid)
        if len(digits) >= 6:
            rec = lookup.get(digits) or lookup.get(digits[-6:]) or {}
    rec_text = str(rec.get("ocr_text") or "").strip()
    if rec_text and len(rec_text) > len(text):
        return rec_text
    return text


def campaign_from_path(path: str) -> dict[str, str]:
    """Kampania ze sciezki 08 - KAMAPANIE\\<rok>\\<kampania>\\... Oryginalnej sciezki nie rusza."""
    raw = str(path or "").replace("\\", "/")
    m = _CAMPAIGN_RE.search(raw)
    if not m:
        return {"year": "", "campaign": "", "key": "", "label": ""}
    year = m.group(1)
    name = str(m.group(2) or "").strip()
    label = year + "/" + name
    return {"year": year, "campaign": name, "key": fold_text(label), "label": label}


def leaf_folder(path: str) -> str:
    raw = str(path or "").replace("\\", "/").rstrip("/")
    if "/" not in raw:
        return raw
    return raw.rsplit("/", 1)[0]


def shoot_ids_from_name(name: str) -> list[str]:
    folded = collapse_spaces(fold_text(name))
    found = _SHOOT_RE.findall(folded)
    out = []
    for item in found:
        key = collapse_spaces(item)
        if key and key not in out:
            out.append(key)
    return out


def _match_aliases_in_tokens(tokens: list[str], vocab: dict[str, Any]) -> dict[str, str]:
    """Mapa concept_id -> 'token' dla dokladnych aliasow (bez stemmingu)."""
    hits: dict[str, str] = {}
    alias_to_ids = vocab["alias_to_ids"]
    max_n = int(vocab["max_alias_words"] or 1)
    n = len(tokens)
    i = 0
    while i < n:
        matched_n = 0
        matched_ids: list[str] = []
        matched_span = ""
        for size in range(min(max_n, n - i), 0, -1):
            span = " ".join(tokens[i : i + size])
            ids = alias_to_ids.get(span)
            if ids:
                matched_n = size
                matched_ids = ids
                matched_span = span
                break
        if matched_n:
            for cid in matched_ids:
                if cid not in hits:
                    hits[cid] = matched_span
            i += matched_n
        else:
            i += 1
    return hits


def detect_query_concepts(query: str) -> list[str]:
    vocab = _ensure_vocab()
    tokens = [t for t in tokenize(query) if t not in vocab["stopwords"]]
    hits = _match_aliases_in_tokens(tokens, vocab)
    return list(hits.keys())


def _concepts_from_text(text: str, vocab: dict[str, Any]) -> dict[str, str]:
    return _match_aliases_in_tokens(tokenize(text), vocab)


def _file_concepts_raw(asset: dict, vocab: dict[str, Any], product_map: dict[str, list[str]]) -> dict[str, dict[str, str]]:
    """concept_id -> {source, via} bez dziedziczenia strzalu.

    Produkt ze sciezki wygrywa z aliasem produktowym (np. Banoffee kulki
    powiazane z wizkami BATONY/BARS nie robi z batona kulek).
    """
    found: dict[str, dict[str, str]] = {}

    def add(cid: str, source: str, via: str) -> None:
        if not cid or cid in found:
            return
        found[cid] = {"source": source, "via": via}

    path = str(asset.get("path") or "")
    name = str(asset.get("name") or "")
    parent = leaf_folder(path)

    path_hits = _concepts_from_text(parent, vocab)
    for cid, via in path_hits.items():
        add(cid, "path", via)
    path_products = {cid for cid in found if cid.startswith("product:")}

    tags = list(asset.get("appearance_tags") or []) + list(asset.get("tags") or [])
    tag_hits = _concepts_from_text(" ".join(str(t) for t in tags), vocab)
    for cid, via in tag_hits.items():
        add(cid, "association", "tag:" + via)
    for pid in asset.get("linked_product_ids") or []:
        for cid in product_map.get(str(pid), []):
            if (
                cid.startswith("product:")
                and path_products
                and cid not in path_products
            ):
                continue
            add(cid, "association", "product:" + str(pid))

    ocr = str(asset.get("_ocr") or asset.get("ocr_text") or "")
    if ocr.strip():
        ocr_hits = _concepts_from_text(ocr, vocab)
        for cid, via in ocr_hits.items():
            add(cid, "ocr", via)

    name_hits = _concepts_from_text(name, vocab)
    for cid, via in name_hits.items():
        add(cid, "filename", via)

    return found


def _query_concept_matched(query_cid: str, file_cids: set[str], vocab: dict[str, Any]) -> bool:
    """Zapytanie o węższe pojęcie trafia plik oznaczony szerszym (hiperonimia).

    Idzie łańcuchem query_satisfied_by ze słownika (po _apply_subject_hypernyms
    każdy subject:* poza korzeniem jest spełniony przez subject:czlowiek).
    """
    if query_cid in file_cids:
        return True
    seen: set[str] = set()
    stack = [query_cid]
    while stack:
        cid = stack.pop()
        if not cid or cid in seen:
            continue
        seen.add(cid)
        rec = vocab["by_id"].get(cid) or {}
        for alt in rec.get("query_satisfied_by") or []:
            if alt in file_cids:
                return True
            if alt not in seen:
                stack.append(alt)
    return False


def _ensure_assets() -> list[dict[str, Any]]:
    if _CACHE["assets"] is not None:
        return _CACHE["assets"]
    with _CACHE_LOCK:
        if _CACHE["assets"] is not None:
            return _CACHE["assets"]
        return _load_assets_unlocked()


def _load_assets_unlocked() -> list[dict[str, Any]]:
    vocab = _ensure_vocab()
    product_map = _ensure_product_concepts()
    fat = _load_json(WEB_DATA / "branding-index.json", {})
    recognition = _load_json(WEB_DATA / "branding-recognition.json", {})
    rec_by_id = _recognition_by_id(recognition)
    assets_in = fat.get("assets") or []
    if not assets_in:
        slim = _load_json(WEB_DATA / "branding-grid-index.json", {})
        assets_in = slim.get("assets") or []

    prepared: list[dict[str, Any]] = []
    for a in assets_in:
        path = str(a.get("path") or "")
        name = str(a.get("name") or "")
        ocr = _merge_ocr(a, recognition, rec_by_id)
        camp = campaign_from_path(path)
        rec = {
            "id": str(a.get("id") or ""),
            "path": path,
            "name": name,
            "linked_product_ids": list(a.get("linked_product_ids") or []),
            "appearance_tags": list(a.get("appearance_tags") or []),
            "tags": list(a.get("tags") or []),
            "ocr_text": ocr,
            "_ocr": ocr,
            "campaign_key": camp["key"] or fold_text(a.get("campaign_id") or ""),
            "campaign_label": camp["label"] or str(a.get("campaign_id") or ""),
            "leaf": leaf_folder(path),
            "shoots": shoot_ids_from_name(name),
        }
        rec["_concepts"] = _file_concepts_raw(rec, vocab, product_map)
        prepared.append(rec)

    # dziedziczenie produktu po strzale w tej samej kampanii
    shoot_products: dict[tuple[str, str], dict[str, str]] = {}
    for rec in prepared:
        camp = rec["campaign_key"]
        if not camp:
            continue
        for cid, meta in rec["_concepts"].items():
            if not cid.startswith("product:"):
                continue
            src = meta.get("source")
            via = str(meta.get("via") or "")
            if src not in ("path", "ocr") and not (
                src == "association" and via.startswith("tag:")
            ):
                continue
            for shoot in rec["shoots"]:
                key = (camp, shoot)
                if cid not in shoot_products.get(key, {}):
                    shoot_products.setdefault(key, {})[cid] = rec["name"] or rec["path"]

    for rec in prepared:
        camp = rec["campaign_key"]
        if not camp:
            continue
        for shoot in rec["shoots"]:
            inherited = shoot_products.get((camp, shoot)) or {}
            for cid, via_name in inherited.items():
                if cid not in rec["_concepts"]:
                    rec["_concepts"][cid] = {
                        "source": "shoot",
                        "via": shoot + " / " + via_name,
                    }

    _CACHE["assets"] = prepared
    return prepared


def _hit_payload(rec: dict[str, Any], matched: list[str], group: str, reason: str) -> dict[str, Any]:
    vocab = _ensure_vocab()
    concepts_meta = rec.get("_concepts") or {}

    def source_for(cid: str) -> str:
        if cid in concepts_meta:
            m = concepts_meta[cid]
            return str(m.get("source") or "") + ":" + str(m.get("via") or "")
        rec_c = vocab["by_id"].get(cid) or {}
        for alt in rec_c.get("query_satisfied_by") or []:
            if alt in concepts_meta:
                m = concepts_meta[alt]
                return str(m.get("source") or "") + ":" + str(m.get("via") or "") + " (" + alt + ")"
        return ""

    return {
        "id": rec.get("id") or "",
        "path": rec.get("path") or "",
        "name": rec.get("name") or "",
        "concepts": list(concepts_meta.keys()),
        "matched_concepts": matched,
        "concept_sources": {cid: source_for(cid) for cid in matched},
        "score": _hit_score(matched),
        "group": group,
        "reason": reason,
        "association_reason": reason,
        "campaign": rec.get("campaign_label") or "",
        "campaign_key": rec.get("campaign_key") or "",
    }


def _hit_score(matched: list[str]) -> int:
    """Czynność podnosi pozycję, nie jest wymagana do trafienia."""
    score = 0
    for cid in matched:
        if cid.startswith("action:"):
            score += 3
        elif cid.startswith("product:"):
            score += 2
        else:
            score += 1
    return score


def _product_meta(rec: dict[str, Any], product_needed: list[str]) -> dict[str, str]:
    concepts = rec.get("_concepts") or {}
    for cid in product_needed:
        meta = concepts.get(cid) or {}
        if meta:
            return {"source": str(meta.get("source") or ""), "via": str(meta.get("via") or "")}
    return {"source": "", "via": ""}


def _product_group(rec: dict[str, Any], product_needed: list[str]) -> str:
    """1 = produkt ze ścieżki / tagu wyglądu; 2 = dziedziczenie po sesji."""
    if not product_needed:
        return "1"
    concepts = rec.get("_concepts") or {}
    saw_direct = False
    saw_shoot = False
    for cid in product_needed:
        meta = concepts.get(cid) or {}
        src = str(meta.get("source") or "")
        via = str(meta.get("via") or "")
        if src == "path" or (src == "association" and via.startswith("tag:")):
            saw_direct = True
        elif src == "shoot":
            saw_shoot = True
        elif src in ("ocr", "filename", "association"):
            saw_direct = True
    if saw_direct:
        return "1"
    if saw_shoot:
        return "2"
    return "1"


def _folder_labels(rec: dict[str, Any]) -> list[str]:
    leaf = str(rec.get("leaf") or "").replace("\\", "/")
    parts = [p for p in leaf.split("/") if p]
    labels: list[str] = []
    for part in parts[-3:]:
        folded = fold_text(part)
        if folded.startswith("kulka"):
            if "KULKA" not in labels:
                labels.append("KULKA")
        elif "ludzie" in folded and "produkt" in folded:
            if "ludzie i produkt" not in labels:
                labels.append("ludzie i produkt")
        elif "postaci" in folded or "postacia" in folded:
            if "zdjęcia postaci" not in labels:
                labels.append("zdjęcia postaci")
        elif part and not re.match(r"^\d{4}$", part) and not re.match(r"^\d{2}_", part):
            short = part if len(part) <= 48 else part[:45] + "..."
            if short not in labels:
                labels.append(short)
    return labels


def _folder_reason_pl(rec: dict[str, Any]) -> str:
    labels = _folder_labels(rec)
    if labels:
        return "W folderze „" + ", ".join(labels) + "”"
    return "W folderze z szukanym produktem"


def _product_label_pl(product_needed: list[str]) -> str:
    vocab = _ensure_vocab()
    for cid in product_needed:
        rec = vocab["by_id"].get(cid) or {}
        label = str(rec.get("label_pl") or "").strip()
        if label:
            return label
    return "szukanym produktem"


def _has_person(rec: dict[str, Any]) -> bool:
    return any(str(c).startswith("subject:") for c in (rec.get("_concepts") or {}))


def _reason_pl(rec: dict[str, Any], group: str, product_needed: list[str]) -> str:
    product_lbl = _product_label_pl(product_needed)
    person = " Na zdjęciu jest osoba." if _has_person(rec) else ""
    if group == "3":
        camp = rec.get("campaign_label") or rec.get("campaign_key") or ""
        if camp:
            return (
                "Z tej samej kampanii co zdjęcia z produktem „"
                + product_lbl
                + "”: "
                + camp
                + "."
                + person
            )
        return (
            "Z tej samej kampanii co zdjęcia z produktem „"
            + product_lbl
            + "”."
            + person
        )
    if group == "2":
        shoots = [collapse_spaces(str(x)).upper() for x in (rec.get("shoots") or []) if x]
        shoot = ", ".join(shoots)
        if shoot:
            return (
                "Ta sama sesja zdjęciowa "
                + shoot
                + " - ta sama osoba, co na zdjęciach z produktem „"
                + product_lbl
                + "”."
            )
        meta = _product_meta(rec, product_needed)
        via = meta.get("via") or ""
        if via:
            return (
                "Ta sama sesja zdjęciowa ("
                + via
                + ") - ta sama osoba, co na zdjęciach z produktem „"
                + product_lbl
                + "”."
            )
        return (
            "Ta sama sesja zdjęciowa - ta sama osoba, co na zdjęciach z produktem „"
            + product_lbl
            + "”."
        )
    meta = _product_meta(rec, product_needed)
    src = meta.get("source") or ""
    via = meta.get("via") or ""
    if src == "association" and via.startswith("tag:"):
        tag = via[4:].strip() or "produkt"
        return "Oznaczone tagiem wyglądu „" + tag + "”." + person
    if src == "filename":
        return (
            "Nazwa pliku „"
            + (rec.get("name") or via or "")
            + "” wskazuje na produkt „"
            + product_lbl
            + "”."
            + person
        )
    if src == "ocr":
        return (
            "Na grafice widać napis związany z produktem „"
            + product_lbl
            + "” („"
            + via
            + "”)."
            + person
        )
    folder = _folder_reason_pl(rec)
    return (
        folder
        + " - tu są zdjęcia z produktem „"
        + product_lbl
        + "”, nawet gdy nazwa pliku tego nie mówi."
        + person
    )


def _path_is_kopia(path: str) -> bool:
    parts = str(path or "").replace("\\", "/").split("/")
    return any(bool(_KOPIA_SEG_RE.search(part)) for part in parts)


def _canonical_hit_key(hit: dict[str, Any]) -> str:
    p = str(hit.get("path") or "").replace("\\", "/")
    parts = [_KOPIA_SEG_RE.sub("", part) for part in p.split("/")]
    return "/".join(parts).lower()


def _collapse_kopia_hits(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Warstwa prezentacji: jeden wynik na oryginał+kopię folderu -kopia.

    Nie rusza indeksu. Preferuje ścieżkę bez -kopia. Jeśli jest tylko kopia,
    zostawia ją z is_copy=True.
    """
    groups: dict[str, list[dict[str, Any]]] = {}
    order: list[str] = []
    for hit in hits:
        key = _canonical_hit_key(hit)
        if key not in groups:
            order.append(key)
            groups[key] = []
        groups[key].append(hit)
    out: list[dict[str, Any]] = []
    for key in order:
        bunch = groups[key]
        orig = [h for h in bunch if not _path_is_kopia(str(h.get("path") or ""))]
        copies = [h for h in bunch if _path_is_kopia(str(h.get("path") or ""))]
        keep = dict(orig[0] if orig else bunch[0])
        if copies:
            keep["merged_copy_count"] = len(copies) if orig else 0
            keep["is_copy"] = not bool(orig)
            keep["copy_paths"] = [str(h.get("path") or "") for h in copies]
        out.append(keep)
    return out


def _empty_search(query: str, concepts: list[str] | None = None) -> dict[str, Any]:
    return {
        "ok": True,
        "query": query,
        "concepts": list(concepts or []),
        "hits": [],
        "strict": [],
        "associated": [],
        "counts": {"strict": 0, "associated": 0, "1": 0, "2": 0, "3": 0, "total": 0},
    }


def search(query: str, limit: int = 200) -> dict[str, Any]:
    """Jedyna publiczna funkcja wejściowa.

    product: i subject: są wymagające. action: tylko podnosi pozycję.
    Grupy: 1 ścieżka/tag, 2 ta sama sesja, 3 ta sama kampania.
    """
    fat = WEB_DATA / "branding-index.json"
    grid = WEB_DATA / "branding-grid-index.json"
    if not fat.is_file() and not grid.is_file():
        return {
            "ok": False,
            "error": "brak_indeksu",
            "detail": "Brak pliku indeksu brandingowego (branding-index.json).",
            "query": str(query or ""),
            "concepts": [],
            "hits": [],
            "strict": [],
            "associated": [],
            "counts": {"strict": 0, "associated": 0, "1": 0, "2": 0, "3": 0, "total": 0},
        }

    vocab = _ensure_vocab()
    q = str(query or "")
    query_concepts = detect_query_concepts(q)
    product_needed = [c for c in query_concepts if c.startswith("product:")]
    subject_needed = [c for c in query_concepts if c.startswith("subject:")]
    required = product_needed + subject_needed

    if not query_concepts:
        return _empty_search(q)

    assets = _ensure_assets()
    cap = max(1, int(limit or 200))
    group1: list[dict[str, Any]] = []
    group2: list[dict[str, Any]] = []

    for rec in assets:
        file_cids = set(rec.get("_concepts") or {})
        if required:
            if not all(_query_concept_matched(cid, file_cids, vocab) for cid in required):
                continue
        else:
            if not any(
                _query_concept_matched(cid, file_cids, vocab) for cid in query_concepts
            ):
                continue
        matched = [
            cid
            for cid in query_concepts
            if _query_concept_matched(cid, file_cids, vocab)
        ]
        grp = _product_group(rec, product_needed)
        reason = _reason_pl(rec, grp, product_needed)
        payload = _hit_payload(rec, matched, grp, reason)
        if grp == "2":
            group2.append(payload)
        else:
            group1.append(payload)

    def _rank(hit: dict[str, Any]) -> tuple:
        return (-int(hit.get("score") or 0), str(hit.get("name") or ""))

    group1.sort(key=_rank)
    group2.sort(key=_rank)

    strict_ids = {
        h.get("id") for h in group1 + group2 if h.get("id")
    }
    strict_campaigns: dict[str, str] = {}
    preferred_camps: list[str] = []
    for h in group1 + group2:
        camp_key = h.get("campaign_key") or ""
        if not camp_key:
            continue
        if camp_key not in strict_campaigns:
            preferred_camps.append(camp_key)
        strict_campaigns[camp_key] = h.get("campaign") or camp_key
    camp_rank = {k: i for i, k in enumerate(preferred_camps)}

    group3: list[dict[str, Any]] = []
    if product_needed and strict_campaigns:
        for rec in assets:
            if rec.get("id") in strict_ids:
                continue
            camp_key = rec.get("campaign_key") or ""
            if camp_key not in strict_campaigns:
                continue
            file_cids = set(rec.get("_concepts") or {})
            matched = [
                cid
                for cid in query_concepts
                if _query_concept_matched(cid, file_cids, vocab)
            ]
            reason = _reason_pl(rec, "3", product_needed)
            group3.append(_hit_payload(rec, matched, "3", reason))
        group3.sort(
            key=lambda h: (
                camp_rank.get(h.get("campaign_key") or "", 999),
                -int(h.get("score") or 0),
                str(h.get("name") or ""),
            )
        )

    hits: list[dict[str, Any]] = list(group1) + list(group2)
    if len(hits) < cap:
        hits.extend(group3[: cap - len(hits)])
    else:
        hits = hits[:cap]
    hits = _collapse_kopia_hits(hits)

    strict = [h for h in hits if str(h.get("group") or "") in ("1", "2")]
    associated = [h for h in hits if str(h.get("group") or "") == "3"]
    n1 = sum(1 for h in hits if str(h.get("group") or "") == "1")
    n2 = sum(1 for h in hits if str(h.get("group") or "") == "2")
    n3 = sum(1 for h in hits if str(h.get("group") or "") == "3")
    return {
        "ok": True,
        "query": q,
        "concepts": query_concepts,
        "hits": hits,
        "strict": strict,
        "associated": associated,
        "counts": {
            "strict": len(strict),
            "associated": len(associated),
            "1": n1,
            "2": n2,
            "3": n3,
            "total": len(hits),
        },
    }


def reset_cache() -> None:
    with _CACHE_LOCK:
        _CACHE["vocab"] = None
        _CACHE["assets"] = None
        _CACHE["product_concepts"] = None
