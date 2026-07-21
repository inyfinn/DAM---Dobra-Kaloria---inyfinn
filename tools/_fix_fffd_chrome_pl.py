# -*- coding: utf-8 -*-
"""HARD: repair U+FFFD / ASCII-? PL chrome in apps/web HTML. UTF-8 write_bytes only."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
FFFD = "\ufffd"

# Order matters: longer / more specific first.
BRANDING_REPLACEMENTS: list[tuple[str, str]] = [
    # tips / phrases
    (
        f"Przeskanuj foldery Marketing i od{FFFD}wie{FFFD} branding-index.json",
        "Przeskanuj foldery Marketing i odśwież branding-index.json",
    ),
    (
        f"slider niemi{FFFD}sa, film lato 2026?",
        "slider niemięsa, film lato 2026?",
    ),
    (
        f"skojarzenia produkt{FFFD}w, nazwy kampanii) - nie po {FFFD}cie{FFFD}ce folderu",
        "skojarzenia produktów, nazwy kampanii) - nie po ścieżce folderu",
    ),
    (
        f"Domy{FFFD}lnie ukryte foldery ARCHIWUM na dysku Marketing",
        "Domyślnie ukryte foldery ARCHIWUM na dysku Marketing",
    ),
    (
        f"Nadal dost{FFFD}pne po tagach Dokument / Wideo.",
        "Nadal dostępne po tagach Dokument / Wideo.",
    ),
    (
        f"Poka{FFFD} liczby dopasowa{FFFD} obok tag{FFFD}w (domy{FFFD}lnie wy{FFFD}{FFFD}czone)",
        "Pokaż liczby dopasowań obok tagów (domyślnie wyłączone)",
    ),
    (
        f"Suwak: 65-100% pomniejsza grafik{FFFD} w kafelku; powy{FFFD}ej 100% powi{FFFD}ksza kafelek (max 350%). Podgl{FFFD}d startuje z tej samej skali.",
        "Suwak: 65-100% pomniejsza grafikę w kafelku; powyżej 100% powiększa kafelek (max 350%). Podgląd startuje z tej samej skali.",
    ),
    (
        f"Ile kart (element{FFFD}w) pokaza{FFFD} w siatce. Suwak i pole nie od{FFFD}wie{FFFD}aj{FFFD} siatki na {FFFD}ywo - zatwierd{FFFD} przyciskiem OK. K{FFFD}ko myszy na kontrolce zmienia warto{FFFD}{FFFD}.",
        "Ile kart (elementów) pokazać w siatce. Suwak i pole nie odświeżają siatki na żywo - zatwierdź przyciskiem OK. Kółko myszy na kontrolce zmienia wartość.",
    ),
    (
        f"Zastosuj limit kart i zapisz preferencj{FFFD}",
        "Zastosuj limit kart i zapisz preferencję",
    ),
    (
        f"Nie widzisz swojego pliku? Sprawd{FFFD}, czy masz zaznaczon{FFFD} dobr{FFFD} kategori{FFFD}. Ewentualnie naci{FFFD}nij Poka{FFFD} wszystko.",
        "Nie widzisz swojego pliku? Sprawdź, czy masz zaznaczoną dobrą kategorię. Ewentualnie naciśnij Pokaż wszystko.",
    ),
    # visible chrome
    (f"Wyczy{FFFD}{FFFD} filtry", "Wyczyść filtry"),
    (f"Ostatni tydzie{FFFD}", "Ostatni tydzień"),
    (f"Ostatni miesi{FFFD}c", "Ostatni miesiąc"),
    (f"Priorytet u{FFFD}ycia", "Priorytet użycia"),
    (f"Sortowanie wynik{FFFD}w", "Sortowanie wyników"),
    (f"Skala kafelk{FFFD}w branding", "Skala kafelków branding"),
    (f"{FFFD}adowanie indeksu{FFFD}", "Ładowanie indeksu…"),
    (f"Wr{FFFD}{FFFD} do przegl{FFFD}dania", "Wróć do przeglądania"),
    (f"Zamknij podpowied{FFFD}", "Zamknij podpowiedź"),
    (f"Poka{FFFD} wszystko", "Pokaż wszystko"),
    (f"Poka{FFFD} archiwum", "Pokaż archiwum"),
]

EXPLORER_REPLACEMENTS: list[tuple[str, str]] = [
    (f"Dostosuj wygl{FFFD}d", "Dostosuj wygląd"),
    (f"Panel asset{FFFD}w opakowa{FFFD}", "Panel assetów opakowań"),
    (f"Aktywno{FFFD}{FFFD}", "Aktywność"),
    (
        f"W{FFFD}{FFFD}cz: pokazuje prototypy, dema oraz starsze i nieaktualne warianty (w tym archiwum). Wy{FFFD}{FFFD}cz: tylko aktualne na dysku live.",
        "Włącz: pokazuje prototypy, dema oraz starsze i nieaktualne warianty (w tym archiwum). Wyłącz: tylko aktualne na dysku live.",
    ),
    (f"Poka{FFFD} wszystkie", "Pokaż wszystkie"),
    (f"Filtr j{FFFD}zyka", "Filtr języka"),
    (f"Wszystkie j{FFFD}zyki", "Wszystkie języki"),
    (f"Dodaj kategori{FFFD}", "Dodaj kategorię"),
    (
        f"Nie zmienia folder{FFFD}w Marketing ani bazy. Wsp{FFFD}lny zapis F/X/D robi most (dysk + JSON + Postgres).",
        "Nie zmienia folderów Marketing ani bazy. Wspólny zapis F/X/D robi most (dysk + JSON + Postgres).",
    ),
    (f"Backup status{FFFD}w", "Backup statusów"),
    (f"wczytaj list{FFFD} do programu", "wczytaj listę do programu"),
    (
        f"Od{FFFD}wie{FFFD} z dysku: skan folder{FFFD}w Marketing {FFFD} indeks {FFFD} panel. Aktualizuje warianty i litery F/X/D wed{FFFD}ug nazw folder{FFFD}w. Nie zmienia dysku. Warianty z {FFFD} ARCHIWUM widoczne przy {FFFD}Poka{FFFD} wszystko{FFFD}.",
        "Odśwież z dysku: skan folderów Marketing → indeks → panel. Aktualizuje warianty i litery F/X/D według nazw folderów. Nie zmienia dysku. Warianty z „ ARCHIWUM” widoczne przy „Pokaż wszystko”.",
    ),
    (f"Od{FFFD}wie{FFFD} z dysku", "Odśwież z dysku"),
    (
        f"Stosuj zmiany = FORCE. Zapisuje statusy z programu na foldery Marketing (rename / archiwum). Odwrotno{FFFD}{FFFD} Od{FFFD}wie{FFFD}. Tylko admin.",
        "Stosuj zmiany = FORCE. Zapisuje statusy z programu na foldery Marketing (rename / archiwum). Odwrotność Odśwież. Tylko admin.",
    ),
    (f"Usu{FFFD}", "Usuń"),
]

DASHBOARD_REPLACEMENTS: list[tuple[str, str]] = [
    (f"Dostosuj wygl{FFFD}d", "Dostosuj wygląd"),
    (f"Panel asset{FFFD}w opakowa{FFFD}", "Panel assetów opakowań"),
    (f"Aktywno{FFFD}{FFFD}", "Aktywność"),
    (
        f"Uk{FFFD}ad pulpitu zapisuje si{FFFD} lokalnie dla Twojego konta.",
        "Układ pulpitu zapisuje się lokalnie dla Twojego konta.",
    ),
    (
        f"Otw{FFFD}rz kalkulator koszt{FFFD}w",
        "Otwórz kalkulator kosztów",
    ),
]

# ASCII ? leftovers (invoices etc.) — only known PL chrome, not URLs/queries
QUESTION_MARK_PL: list[tuple[str, str]] = [
    ("Ten tydzie?", "Ten tydzień"),
    ("Szacowany koszt miesi?ca", "Szacowany koszt miesiąca"),
    ("miesi?ca", "miesiąca"),
    ("tydzie?", "tydzień"),
]


def apply_pairs(text: str, pairs: list[tuple[str, str]]) -> tuple[str, int]:
    n = 0
    for old, new in pairs:
        if old in text:
            c = text.count(old)
            text = text.replace(old, new)
            n += c
    return text, n


def fix_file(path: Path, pairs: list[tuple[str, str]], extra: list[tuple[str, str]] | None = None) -> dict:
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    before_fffd = text.count(FFFD)
    text, n1 = apply_pairs(text, pairs)
    n2 = 0
    if extra:
        text, n2 = apply_pairs(text, extra)
    after_fffd = text.count(FFFD)
    out = text.encode("utf-8")
    path.write_bytes(out)
    # verify key glyphs
    ok_sc = "ść".encode("utf-8") in out or after_fffd == 0
    return {
        "path": str(path.relative_to(ROOT)),
        "replacements": n1 + n2,
        "fffd_before": before_fffd,
        "fffd_after": after_fffd,
        "bytes": len(out),
        "has_C59B": b"\xc5\x9b" in out,
        "ok": after_fffd == 0,
    }


def remaining_fffd_contexts(path: Path, limit: int = 30) -> list[str]:
    text = path.read_bytes().decode("utf-8")
    out = []
    for i, line in enumerate(text.splitlines(), 1):
        if FFFD in line:
            out.append(f"{i}: {line.strip()[:180].replace(FFFD, '<<FFFD>>')}")
            if len(out) >= limit:
                break
    return out


def main() -> None:
    reports = []
    reports.append(fix_file(WEB / "branding.html", BRANDING_REPLACEMENTS))
    reports.append(fix_file(WEB / "explorer.html", EXPLORER_REPLACEMENTS))
    reports.append(fix_file(WEB / "dashboard.html", DASHBOARD_REPLACEMENTS))

    # invoices + any other html with ?-corruption on known phrases
    for html in sorted(WEB.glob("*.html")):
        raw = html.read_bytes()
        text = raw.decode("utf-8")
        if any(old in text for old, _ in QUESTION_MARK_PL):
            text2, n = apply_pairs(text, QUESTION_MARK_PL)
            if n:
                html.write_bytes(text2.encode("utf-8"))
                reports.append(
                    {
                        "path": str(html.relative_to(ROOT)),
                        "replacements": n,
                        "fffd_before": text.count(FFFD),
                        "fffd_after": text2.count(FFFD),
                        "bytes": len(text2.encode("utf-8")),
                        "has_C59B": b"\xc5\x9b" in text2.encode("utf-8"),
                        "ok": True,
                        "note": "question-mark PL",
                    }
                )

    for r in reports:
        print(r)

    print("\n--- remaining FFFD ---")
    for name in ("branding.html", "explorer.html", "dashboard.html"):
        left = remaining_fffd_contexts(WEB / name)
        print(name, "left", len(left))
        for line in left:
            print(" ", line)

    # site-wide scan
    print("\n--- site-wide FFFD count ---")
    for p in sorted(WEB.rglob("*")):
        if p.suffix.lower() not in {".html", ".js", ".css", ".json"}:
            continue
        if "vendor" in p.parts:
            continue
        c = p.read_bytes().count(b"\xef\xbf\xbd")
        if c:
            print(f"  {c:4d}  {p.relative_to(WEB)}")


if __name__ == "__main__":
    main()
