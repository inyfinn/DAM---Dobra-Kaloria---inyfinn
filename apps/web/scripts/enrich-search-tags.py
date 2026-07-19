"""
Wzbogaca file-index.json + search-index.json:
- tag_groups smak/typ/opakowanie: 12-24 najczestszych
- tag_groups autor: z Asana CSV (Assignee x indeks) + product-people.json
- authors / search_blob / by_tag (imiona) na produktach i entries
"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
FILE_INDEX = DATA / "file-index.json"
SEARCH_INDEX = DATA / "search-index.json"
PRODUCT_PEOPLE = DATA / "product-people.json"
ASANA_CANDIDATES = [
    DATA / "asana-tasks-kw.csv",
    Path.home() / "Desktop" / "Zadania_Krzysztof_–_kubara.pl.csv",
    Path.home() / "Desktop" / "Zadania_Krzysztof_-_kubara.pl.csv",
]

INDEX_RE = re.compile(r"(6300\d{3}|FOL\d+|KAR\d+)", re.I)

FLAVOR = {
    "czekolada", "kakao", "malina", "malinowa", "cynamon", "banoffee", "tiramisu",
    "orzech", "orzechowe", "proteina", "cytryna", "lemon", "matcha", "porzeczka",
    "wanilia", "nerkowcowy", "tarta", "chia", "mct", "jagoda", "jagodowy", "kokos",
    "migdal", "miod", "deserowe", "owocowe", "karmel", "pistacja", "truskawka",
    "morela", "mango", "imbir", "kawa", "sezam", "solony", "cynamonka", "arachid",
    "muffin",
}
# Typ = forma produktu. muffin = SMAK. Nosniki = PACK (Opakowanie).
TYP = {
    "kulki", "mini batoniki", "nuggets", "krem",
    "napoj", "sypkie", "roslinne", "burger", "gyros", "kotlet", "pasztet",
    "owies", "jaglanka", "boost", "dates", "mix", "mixy", "niemiesne",
    "funkcjonalny", "sniadaniowe",
}
PACK = {
    "doypack", "doy 6x", "baton", "mini baton", "karton 6x", "karton",
    "bigpak", "folia", "etykieta", "etykieta butelka", "etykieta sloik",
    "rekaw", "tuba", "shot", "sasz", "obwoluta",
}

# Tagi Autor w Eksploratorze — tylko zespol DK + agencja Highlite (nie imiona z wizytowek/Asany).
AUTHOR_ALLOWLIST = ["Krzysztof", "Sylwia", "Szymon", "Highlite"]


def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9\.]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def first_name(assignee: str) -> str:
    parts = (assignee or "").strip().split()
    if not parts:
        return ""
    return parts[0]


def find_asana() -> Path | None:
    for p in ASANA_CANDIDATES:
        if p.is_file():
            return p
    desk = Path.home() / "Desktop"
    if desk.is_dir():
        for p in desk.glob("Zadania*.csv"):
            return p
    return None


def load_author_by_index(csv_path: Path) -> dict[str, str]:
    """index_base -> najczestszy autor (imie)."""
    counts: dict[str, Counter[str]] = defaultdict(Counter)
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        assignee = (r.get("Assignee") or "").strip()
        if not assignee:
            continue
        name = first_name(assignee)
        if not name:
            continue
        blob = " ".join(str(v or "") for v in r.values())
        for m in INDEX_RE.findall(blob):
            counts[m.upper()][name] += 1
    out: dict[str, str] = {}
    for idx, c in counts.items():
        out[idx] = c.most_common(1)[0][0]
    return out


def load_product_people() -> dict:
    if not PRODUCT_PEOPLE.is_file():
        return {}
    try:
        return json.loads(PRODUCT_PEOPLE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def people_for_product(p: dict, pp: dict) -> list[str]:
    """Lista imion z product-people.json (by_id / by_index / by_id_prefix)."""
    if not pp:
        return []
    found: list[str] = []

    def add(names: list | str | None) -> None:
        if not names:
            return
        if isinstance(names, str):
            names = [names]
        for n in names:
            fn = first_name(str(n)) or str(n).strip()
            if fn and fn not in found:
                found.append(fn)

    by_id = pp.get("by_id") or {}
    pid = str(p.get("id") or "")
    add(by_id.get(pid))

    for pref, names in (pp.get("by_id_prefix") or {}).items():
        if pid.startswith(str(pref)):
            add(names)

    by_index = pp.get("by_index") or {}
    for base in p.get("index_bases") or []:
        add(by_index.get(str(base).upper()))
        add(by_index.get(str(base)))

    return found


def author_search_tokens(authors: list[str], pp: dict) -> list[str]:
    """Imiona + aliasy (nazwiska) do search_blob / by_tag."""
    people = (pp or {}).get("people") or {}
    tokens: list[str] = []
    for a in authors:
        if a and a not in tokens:
            tokens.append(a)
        meta = people.get(a) or {}
        full = (meta.get("full") or "").strip()
        if full and full not in tokens:
            tokens.append(full)
        for al in meta.get("aliases") or []:
            al = str(al).strip()
            if al and al not in tokens:
                tokens.append(al)
    return tokens


def pick_group_tags(counter: Counter[str], allowed: set[str], lo: int = 12, hi: int = 24) -> list[str]:
    ranked = [(t, n) for t, n in counter.most_common() if t in allowed and n > 0]
    # uzupelnij z allowed jesli malo
    have = {t for t, _ in ranked}
    for t in sorted(allowed):
        if t not in have:
            ranked.append((t, 0))
    tags = [t for t, _ in ranked if t][:hi]
    if len(tags) < lo:
        tags = (tags + sorted(allowed - set(tags)))[:lo]
    return tags[:hi]


def main() -> int:
    fi = json.loads(FILE_INDEX.read_text(encoding="utf-8"))
    si = json.loads(SEARCH_INDEX.read_text(encoding="utf-8"))
    products = fi.get("products") or []

    tag_counter: Counter[str] = Counter()
    for p in products:
        for t in p.get("tags") or []:
            tag_counter[norm(t)] += 1

    smak = pick_group_tags(tag_counter, FLAVOR, 12, 24)
    typ = pick_group_tags(tag_counter, TYP, 12, 24)
    # Opakowanie: pelna lista nosnikow (kolejnosc kanoniczna), nie ucinaj do 6
    opak = pick_group_tags(tag_counter, PACK, len(PACK), max(24, len(PACK)))
    # wymus kanoniczna kolejnosc
    opak_ordered = [t for t in [
        "doypack", "baton", "mini baton", "karton 6x", "karton", "bigpak",
        "folia", "etykieta", "etykieta butelka", "etykieta sloik", "rekaw",
        "tuba", "shot", "doy 6x", "sasz", "obwoluta",
    ] if t in set(opak) or t in PACK]
    for t in opak:
        if t not in opak_ordered:
            opak_ordered.append(t)
    opak = opak_ordered

    asana = find_asana()
    author_by_index: dict[str, str] = {}
    if asana:
        author_by_index = load_author_by_index(asana)
        print(f"Asana: {asana} indexes_with_author={len(author_by_index)}")
    else:
        print("WARN: brak CSV Asana - autor bez mapowania indeksow")

    pp = load_product_people()
    if pp:
        print(
            f"product-people: by_id={len(pp.get('by_id') or {})} "
            f"by_index={len(pp.get('by_index') or {})} "
            f"prefix={len(pp.get('by_id_prefix') or {})}"
        )
    else:
        print("WARN: brak product-people.json")

    author_counter: Counter[str] = Counter()
    by_tag: dict[str, list[str]] = defaultdict(list)
    # zachowaj istniejace by_tag (smak/typ/...)
    for tag, ids in (si.get("by_tag") or {}).items():
        for pid in ids or []:
            by_tag[tag].append(pid)

    for p in products:
        authors: list[str] = []
        # product-people.json = zrodlo prawdy (np. Datesy = tylko Sylwia).
        # Asana CSV tylko gdy mapa nie ma wpisu - inaczej KW z Asany nadpisywalby Sylwie.
        mapped = people_for_product(p, pp)
        if mapped:
            authors = list(mapped)
        else:
            for base in p.get("index_bases") or []:
                a = author_by_index.get(str(base).upper())
                if a and a not in authors:
                    authors.append(a)
            # fallback: szukaj w tags/osoba
            tg = p.get("tag_groups") or {}
            for a in tg.get("osoba") or []:
                fn = first_name(a) or a
                if fn and fn not in authors:
                    authors.append(fn)
        tg = p.get("tag_groups") or {}
        for a in authors:
            author_counter[a] += 1
        p["authors"] = authors
        tg = dict(tg)
        tg["autor"] = sorted(authors)
        tg["osoba"] = sorted(authors)
        p["tag_groups"] = tg
        tokens = author_search_tokens(authors, pp)
        blob_parts = [
            p.get("display_name") or "",
            p.get("name") or "",
            " ".join(p.get("tags") or []),
            " ".join(tokens),
            " ".join(p.get("indexes") or []),
        ]
        p["search_blob"] = norm(" ".join(blob_parts))
        pid = p.get("id")
        if pid:
            for tok in tokens:
                key = norm(tok)
                if key and pid not in by_tag[key]:
                    by_tag[key].append(pid)
                # tez samo imie Title Case jako tag filtrujacy
                fn = first_name(tok)
                if fn:
                    fk = norm(fn)
                    if fk and pid not in by_tag[fk]:
                        by_tag[fk].append(pid)

    autor_tags = list(AUTHOR_ALLOWLIST)

    tag_groups = {
        "smak": smak,
        "typ": typ,
        "opakowanie": opak,
        "autor": autor_tags,
        "osoba": autor_tags,  # alias wstecz
        "inne": [],
    }

    # Przebuduj by_tag dla imion/aliasow od zera (stare Asana→KW nie zostaja przy Datesy→Sylwia).
    person_keys: set[str] = set()
    for name, meta in (pp.get("people") or {}).items():
        person_keys.add(norm(name))
        for al in meta.get("aliases") or []:
            person_keys.add(norm(al))
        full = (meta.get("full") or "").strip()
        if full:
            person_keys.add(norm(full))
            person_keys.add(norm(first_name(full)))
    for name in autor_tags:
        person_keys.add(norm(name))
    for key in list(by_tag.keys()):
        if key in person_keys:
            by_tag[key] = []
    for p in products:
        pid = p.get("id")
        if not pid:
            continue
        for tok in author_search_tokens(p.get("authors") or [], pp):
            key = norm(tok)
            if key and pid not in by_tag[key]:
                by_tag[key].append(pid)
            fn = first_name(tok)
            if fn:
                fk = norm(fn)
                if fk and pid not in by_tag[fk]:
                    by_tag[fk].append(pid)

    # search-index entries
    entries = si.get("entries") or []
    by_id = {p.get("id"): p for p in products}
    for e in entries:
        p = by_id.get(e.get("id"))
        if not p:
            continue
        e["authors"] = p.get("authors") or []
        e["tag_groups"] = p.get("tag_groups") or e.get("tag_groups") or {}
        tokens = author_search_tokens(e["authors"], pp)
        e["search_blob"] = norm(
            " ".join(
                [
                    e.get("display_name") or e.get("name") or "",
                    " ".join(e.get("tags") or []),
                    " ".join(tokens),
                    " ".join(e.get("indexes") or []),
                ]
            )
        )

    si["tag_groups"] = tag_groups
    fi["tag_groups"] = tag_groups
    si["by_tag"] = {k: sorted(set(v)) for k, v in sorted(by_tag.items()) if v}

    FILE_INDEX.write_text(json.dumps(fi, ensure_ascii=False, indent=2), encoding="utf-8")
    SEARCH_INDEX.write_text(json.dumps(si, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        "OK tag_groups:",
        {k: len(v) for k, v in tag_groups.items() if k != "inne"},
        "products_with_authors",
        sum(1 for p in products if p.get("authors")),
        "by_tag_sylwia",
        len(si["by_tag"].get("sylwia") or []),
        "by_tag_krzysztof",
        len(si["by_tag"].get("krzysztof") or []),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
