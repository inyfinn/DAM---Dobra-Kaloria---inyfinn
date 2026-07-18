"""
Wzbogaca file-index.json + search-index.json:
- tag_groups smak/typ/opakowanie: 12-24 najczestszych
- tag_groups autor: z Asana CSV (Assignee x indeks)
- authors / search_blob na produktach i entries
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
# Typ = forma + nosniki (BAT/mini baton/sleeve/karton 6x). muffin = SMAK.
TYP = {
    "kulki", "baton", "mini baton", "mini batoniki", "bat", "nuggets", "krem",
    "napoj", "sypkie", "roslinne", "burger", "gyros", "kotlet", "pasztet",
    "owies", "jaglanka", "boost", "dates", "mix", "mixy", "niemiesne",
    "funkcjonalny", "sniadaniowe", "sleeve", "karton 6x",
}
PACK = {
    "karton", "folia", "karton 6x", "tuba", "doypack", "doy 6x", "sleeve",
    "sasz", "pet", "szklo", "kub", "box", "bigpak",
}


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
    opak = pick_group_tags(tag_counter, PACK, 12, 24)

    asana = find_asana()
    author_by_index: dict[str, str] = {}
    if asana:
        author_by_index = load_author_by_index(asana)
        print(f"Asana: {asana} indexes_with_author={len(author_by_index)}")
    else:
        print("WARN: brak CSV Asana - autor bez mapowania indeksow")

    author_counter: Counter[str] = Counter()
    for p in products:
        authors: list[str] = []
        for base in p.get("index_bases") or []:
            a = author_by_index.get(str(base).upper())
            if a and a not in authors:
                authors.append(a)
                author_counter[a] += 1
        # fallback: szukaj w tags/osoba
        tg = p.get("tag_groups") or {}
        for a in tg.get("osoba") or []:
            fn = first_name(a) or a
            if fn and fn not in authors:
                authors.append(fn)
                author_counter[fn] += 1
        p["authors"] = authors
        tg = dict(tg)
        tg["autor"] = sorted(authors)
        p["tag_groups"] = tg
        # search blob
        blob_parts = [
            p.get("display_name") or "",
            p.get("name") or "",
            " ".join(p.get("tags") or []),
            " ".join(authors),
            " ".join(p.get("indexes") or []),
        ]
        p["search_blob"] = norm(" ".join(blob_parts))

    autor_tags = [t for t, _ in author_counter.most_common(24)]
    # doloz imiona z listy userow jesli brakuje
    for name in [
        "Krzysztof", "Anna", "Marek", "Ewa", "Karolina", "Maciej", "Szymon",
        "Sylwia", "Agata", "Andzelika", "Beata", "Dagmara", "Justyna",
        "Malgorzata", "Marta", "Ryszard",
    ]:
        if name not in autor_tags:
            autor_tags.append(name)
        if len(autor_tags) >= 24:
            break
    autor_tags = autor_tags[:24]
    if len(autor_tags) < 12:
        autor_tags = (autor_tags + [
            "Krzysztof", "Anna", "Marek", "Ewa", "Karolina", "Maciej",
            "Szymon", "Sylwia", "Agata", "Beata", "Dagmara", "Justyna",
        ])[:12]

    tag_groups = {
        "smak": smak,
        "typ": typ,
        "opakowanie": opak,
        "autor": autor_tags,
        "osoba": autor_tags,  # alias wstecz
        "inne": [],
    }

    # search-index entries
    entries = si.get("entries") or []
    by_id = {p.get("id"): p for p in products}
    for e in entries:
        p = by_id.get(e.get("id"))
        if not p:
            continue
        e["authors"] = p.get("authors") or []
        e["tag_groups"] = p.get("tag_groups") or e.get("tag_groups") or {}
        e["search_blob"] = norm(
            " ".join(
                [
                    e.get("display_name") or e.get("name") or "",
                    " ".join(e.get("tags") or []),
                    " ".join(e.get("authors") or []),
                    " ".join(e.get("indexes") or []),
                ]
            )
        )

    si["tag_groups"] = tag_groups
    fi["tag_groups"] = tag_groups

    FILE_INDEX.write_text(json.dumps(fi, ensure_ascii=False, indent=2), encoding="utf-8")
    SEARCH_INDEX.write_text(json.dumps(si, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        "OK tag_groups:",
        {k: len(v) for k, v in tag_groups.items() if k != "inne"},
        "products",
        len(products),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
