# -*- coding: utf-8 -*-
"""Repair ASCII-? remnants of destroyed PL diacritics in HTML chrome. UTF-8 only.

Never use PowerShell Set-Content on these files. Write via Path.write_bytes(utf-8).
Longer / more specific pairs first. Do NOT touch ?v= cache bust or URLs.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"

# Longer / more specific first.
PAIRS: list[tuple[str, str]] = [
    # --- visualizations / explorer show-all ---
    (
        "W??cz: pokazuje prototypy, dema oraz starsze i nieaktualne wizualizacje. Wy??cz: tylko aktualne.",
        "Włącz: pokazuje prototypy, dema oraz starsze i nieaktualne wizualizacje. Wyłącz: tylko aktualne.",
    ),
    (
        "W??cz: pokazuje prototypy, dema oraz starsze i nieaktualne warianty (w tym archiwum). Wy??cz: tylko aktualne na dysku live.",
        "Włącz: pokazuje prototypy, dema oraz starsze i nieaktualne warianty (w tym archiwum). Wyłącz: tylko aktualne na dysku live.",
    ),
    (
        "Od?wie? z dysku: skan folder?w Marketing ? indeks ? panel. Aktualizuje warianty i litery F/X/D wed?ug nazw folder?w. Nie zmienia dysku. Warianty z ? ARCHIWUM? widoczne przy ?Poka? wszystko?.",
        "Odśwież z dysku: skan folderów Marketing -> indeks -> panel. Aktualizuje warianty i litery F/X/D według nazw folderów. Nie zmienia dysku. Warianty z \"ARCHIWUM\" widoczne przy \"Pokaż wszystko\".",
    ),
    (
        "Stosuj zmiany = FORCE. Zapisuje statusy z programu na foldery Marketing (rename / archiwum). Odwrotno?? Od?wie?. Tylko admin.",
        "Stosuj zmiany = FORCE. Zapisuje statusy z programu na foldery Marketing (rename / archiwum). Odwrotność Odśwież. Tylko admin.",
    ),
    (
        "Tylko backup na dysk Twojego PC. Nie zmienia folder?w Marketing ani bazy. Wsp?lny zapis F/X/D robi most (dysk + JSON + Postgres).",
        "Tylko backup na dysk Twojego PC. Nie zmienia folderów Marketing ani bazy. Wspólny zapis F/X/D robi most (dysk + JSON + Postgres).",
    ),
    (
        "ADMIN: log ostatnich zatwierdzonych zmian (status, typ, indeks, rename folderu/plik?w) na dysku X: (most 8766 + sesja). To nie jest ?Baza online? (Postgres) - ka?da zmiana jest ju? zapisana, to tylko podgl?d.",
        "ADMIN: log ostatnich zatwierdzonych zmian (status, typ, indeks, rename folderu/plików) na dysku X: (most 8766 + sesja). To nie jest „Baza online” (Postgres) - każda zmiana jest już zapisana, to tylko podgląd.",
    ),
    (
        "Log zatwierdzonych zmian na dysku X: (status / typ / indeks / rename). Wymaga ADMIN ON. Nie myli? z Postgres ?Baza?.",
        "Log zatwierdzonych zmian na dysku X: (status / typ / indeks / rename). Wymaga ADMIN ON. Nie mylić z Postgres „Baza”.",
    ),
    (
        "Pe?na lista ostatnich zatwierdzonych zmian na dysku (status, typ, indeks, rename). To samo w Ustawieniach ? Dysk ? Historia zmian na dysku (#historiaZmian).",
        "Pełna lista ostatnich zatwierdzonych zmian na dysku (status, typ, indeks, rename). To samo w Ustawieniach -> Dysk -> Historia zmian na dysku (#historiaZmian).",
    ),
    (
        "Suwak: 65-100% pomniejsza wizualizacje w kafelku; powy?ej 100% powi?ksza kafelek (max 350%). Podgl?d startuje z tej samej skali. Shift+Plus / Shift+Minus: ta sama skala (tez w panelu skojarzen).",
        "Suwak: 65-100% pomniejsza wizualizacje w kafelku; powyżej 100% powiększa kafelek (max 350%). Podgląd startuje z tej samej skali. Shift+Plus / Shift+Minus: ta sama skala (tez w panelu skojarzen).",
    ),
    (
        "Suwak: 65-100% pomniejsza wizualizacje w kafelku; powy?ej 100% powi?ksza kafelek (max 350%). Podgl?d startuje z tej samej skali.",
        "Suwak: 65-100% pomniejsza wizualizacje w kafelku; powyżej 100% powiększa kafelek (max 350%). Podgląd startuje z tej samej skali.",
    ),
    (
        "Suwak: 65-100% pomniejsza grafik? w kafelku; powy?ej 100% powi?ksza kafelek (max 350%). Podgl?d startuje z tej samej skali. Shift+Plus / Shift+Minus: ta sama skala.",
        "Suwak: 65-100% pomniejsza grafikę w kafelku; powyżej 100% powiększa kafelek (max 350%). Podgląd startuje z tej samej skali. Shift+Plus / Shift+Minus: ta sama skala.",
    ),
    (
        "Ile kart (element?w) pokaza? w siatce. Suwak i pole nie od?wie?aj? siatki na ?ywo - zatwierd? przyciskiem OK. K?ko myszy na kontrolce zmienia warto??.",
        "Ile kart (elementów) pokazać w siatce. Suwak i pole nie odświeżają siatki na żywo - zatwierdź przyciskiem OK. Kółko myszy na kontrolce zmienia wartość.",
    ),
    (
        "Poka? liczby dopasowa? obok tag?w (domy?lnie wy??czone)",
        "Pokaż liczby dopasowań obok tagów (domyślnie wyłączone)",
    ),
    (
        "Nie widzisz swojego pliku? Sprawd?, czy masz zaznaczon? dobr? kategori?. Ewentualnie naci?nij Poka? wszystko.",
        "Nie widzisz swojego pliku? Sprawdź, czy masz zaznaczoną dobrą kategorię. Ewentualnie naciśnij Pokaż wszystko.",
    ),
    (
        "Szuka po znaczeniu (tagi, skojarzenia produkt?w, nazwy kampanii) - nie po ?cie?ce folderu",
        "Szuka po znaczeniu (tagi, skojarzenia produktów, nazwy kampanii) - nie po ścieżce folderu",
    ),
    (
        "Ukrywa PDF, Excel, Word i wideo przy wyszukiwaniu. Nadal dost?pne po tagach Dokument / Wideo.",
        "Ukrywa PDF, Excel, Word i wideo przy wyszukiwaniu. Nadal dostępne po tagach Dokument / Wideo.",
    ),
    (
        "Pokazuje info o pakowaniu zbiorczym na kartach wizualizacji (np. 2F, 2?12). Nie dotyczy strony Branding.",
        "Pokazuje info o pakowaniu zbiorczym na kartach wizualizacji (np. 2F, 2×12). Nie dotyczy strony Branding.",
    ),
    (
        "Pe?na struktura produkt?w Dobra Kaloria i?Good Calories",
        "Pełna struktura produktów Dobra Kaloria i\u00a0Good Calories",
    ),
    (
        "Reklamy, filmy i?grafiki marki. Szukaj albo kliknij tag.",
        "Reklamy, filmy i\u00a0grafiki marki. Szukaj albo kliknij tag.",
    ),
    (
        "Uk?ad pulpitu zapisuje si? lokalnie dla Twojego konta.",
        "Układ pulpitu zapisuje się lokalnie dla Twojego konta.",
    ),
    ("Otw?rz kalkulator koszt?w", "Otwórz kalkulator kosztów"),
    ("Przeskanuj foldery Marketing i od?wie? branding-index.json", "Przeskanuj foldery Marketing i odśwież branding-index.json"),
    ("Przeskanuj Marketing i wczytaj list? do programu", "Przeskanuj Marketing i wczytaj listę do programu"),
    ("Np. burger, grill, proteina, slider niemi?sa, film lato 2026?", "Np. burger, grill, proteina, slider niemięsa, film lato 2026?"),
    ("Domy?lnie ukryte foldery ARCHIWUM na dysku Marketing", "Domyślnie ukryte foldery ARCHIWUM na dysku Marketing"),
    ("Zastosuj limit kart i zapisz preferencj?", "Zastosuj limit kart i zapisz preferencję"),
    ("Zamknij podpowied?", "Zamknij podpowiedź"),
    ("?adowanie indeksu?", "Ładowanie indeksu…"),
    ("Wr?? do przegl?dania", "Wróć do przeglądania"),
    ("Wyczy?? filtry", "Wyczyść filtry"),
    ("Poka? wszystko", "Pokaż wszystko"),
    ("Poka? wszystkie", "Pokaż wszystkie"),
    ("Poka? archiwum", "Pokaż archiwum"),
    ("Ostatni miesi?c", "Ostatni miesiąc"),
    ("Ostatni tydzie?", "Ostatni tydzień"),
    ("Sortowanie wynik?w", "Sortowanie wyników"),
    ("Priorytet u?ycia", "Priorytet użycia"),
    ("Skala kafelk?w wizualizacji", "Skala kafelków wizualizacji"),
    ("Skala kafelk?w branding", "Skala kafelków branding"),
    ("Filtr j?zyka", "Filtr języka"),
    ("Wszystkie j?zyki", "Wszystkie języki"),
    ("Backup status?w", "Backup statusów"),
    ("Od?wie? z dysku", "Odśwież z dysku"),
    ("Dodaj kategori?", "Dodaj kategorię"),
    ("Dostosuj wygl?d", "Dostosuj wygląd"),
    ("Panel asset?w opakowa?", "Panel assetów opakowań"),
    ("Aktywno??", "Aktywność"),
    ("?adowanie faktur...", "Ładowanie faktur..."),
    ("Bie??ce zadania graficzne", "Bieżące zadania graficzne"),
    ("Ten tydzie?", "Ten tydzień"),
    ("Szacowany koszt miesi?ca", "Szacowany koszt miesiąca"),
    ("Czlonek Zarz?du / Dyrektor Marketingu", "Członek Zarządu / Dyrektor Marketingu"),
    # short leftovers (after longer tips)
    ("Nie myli? z Postgres ?Baza?.", "Nie mylić z Postgres „Baza”."),
    ("Usu?", "Usuń"),
]


def main() -> None:
    total_files = 0
    total_repl = 0
    for html in sorted(WEB.glob("*.html")):
        text = html.read_text(encoding="utf-8")
        n = 0
        for old, new in PAIRS:
            if old in text:
                c = text.count(old)
                text = text.replace(old, new)
                n += c
        if n:
            html.write_bytes(text.encode("utf-8"))
            total_files += 1
            total_repl += n
            print(f"{html.name}: {n} replacements, FFFD={text.count(chr(0xFFFD))}")
    print(f"--- files={total_files} replacements={total_repl}")


if __name__ == "__main__":
    main()
