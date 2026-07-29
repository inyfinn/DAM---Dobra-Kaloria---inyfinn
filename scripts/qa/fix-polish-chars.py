#!/usr/bin/env python3
"""
Fix Polish diacritic corruption (? placeholders) in apps/web HTML and dam-*.js.
Root cause: past edits saved non-ASCII as literal ? in source files.
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WEB = os.path.join(ROOT, "apps", "web")
PL_JSON = os.path.join(WEB, "i18n", "pl.json")

# Longest-first replacements for corrupted Polish strings
REPLACEMENTS: list[tuple[str, str]] = sorted([
    ("Wyczy?? filtry", "Wyczyść filtry"),
    ("Wyczy??", "Wyczyść"),
    ("wy??czone", "wyłączone"),
    ("wy??czony", "wyłączony"),
    ("Wy??cz", "Wyłącz"),
    ("W??cz", "Włącz"),
    ("Odwrotno??", "Odwrotność"),
    ("warto??.", "wartość."),
    ("warto??", "wartość"),
    ("Wr?? do przegl?dania", "Wróć do przeglądania"),
    ("Wr?? do", "Wróć do"),
    ("Wr??", "Wróć"),
    ("Wszystkie j?zyki", "Wszystkie języki"),
    ("Filtr j?zyka", "Filtr języka"),
    ("Poka? wszystkie", "Pokaż wszystkie"),
    ("Poka? wszystko", "Pokaż wszystko"),
    ("Poka? archiwum", "Pokaż archiwum"),
    ("Poka? liczby dopasowa? obok tag?w (domy?lnie wy??czone)", "Pokaż liczby dopasowań obok tagów (domyślnie wyłączone)"),
    ("Poka? liczby", "Pokaż liczby"),
    ("Poka?", "Pokaż"),
    ("pokaza? w siatce", "pokazać w siatce"),
    ("pokaza?", "pokazać"),
    ("Od?wie? z dysku: skan folder?w Marketing - indeks - panel. Aktualizuje warianty i litery F/X/D wed?ug nazw folder?w. Nie zmienia dysku. Warianty z ARCHIWUM widoczne przy Poka? wszystko.", "Odśwież z dysku: skan folderów Marketing - indeks - panel. Aktualizuje warianty i litery F/X/D według nazw folderów. Nie zmienia dysku. Warianty z ARCHIWUM widoczne przy Pokaż wszystko."),
    ("Od?wie? z dysku", "Odśwież z dysku"),
    ("Od?wie?", "Odśwież"),
    ("od?wie?aj? siatki na ?ywo", "odświeżają siatkę na żywo"),
    ("od?wie?aj?", "odświeżają"),
    ("od?wie? branding-index.json", "odśwież branding-index.json"),
    ("od?wie?", "odśwież"),
    ("?adowanie indeksu?", "Ładowanie indeksu…"),
    ("?adowanie", "Ładowanie"),
    ("Ostatni miesi?c", "Ostatni miesiąc"),
    ("miesi?ca", "miesiąca"),
    ("miesi?c", "miesiąc"),
    ("Priorytet u?ycia", "Priorytet użycia"),
    ("u?ycia", "użycia"),
    ("u?ytkownikow", "użytkowników"),
    ("u?ytkownik", "użytkownik"),
    ("U?ytkownik", "Użytkownik"),
    ("u?yc", "użyc"),
    ("wynik?w", "wyników"),
    ("dopasowa?", "dopasowań"),
    ("tag?w", "tagów"),
    ("domy?lnie", "domyślnie"),
    ("Domy?lnie", "Domyślnie"),
    ("niemi?sa", "niemięsa"),
    ("produkt?w", "produktów"),
    ("?cie?ce folderu", "ścieżce folderu"),
    ("?cie?ce", "ścieżce"),
    ("?cie?k", "ścieżk"),
    ("?r?d?owe (PSD", "źródłowe (PSD"),
    ("?r?d?owe", "źródłowe"),
    ("?r?d?ow", "źródłow"),
    ("dost?pne po tagach", "dostępne po tagach"),
    ("dost?pne", "dostępne"),
    ("dost?p", "dostęp"),
    ("przegl?dania", "przeglądania"),
    ("przegl?d", "przegląd"),
    ("pomniejsza grafik? w kafelku", "pomniejsza grafikę w kafelku"),
    ("grafik? w kafelku", "grafikę w kafelku"),
    ("grafik?", "grafikę"),
    ("powy?ej 100%", "powyżej 100%"),
    ("powy?ej", "powyżej"),
    ("powi?ksza kafelek", "powiększa kafelek"),
    ("powi?ksza", "powiększa"),
    ("Podgl?d startuje", "Podgląd startuje"),
    ("Podgl?d", "Podgląd"),
    ("podgl?d", "podgląd"),
    ("kafelk?w branding", "kafelków branding"),
    ("kafelk?w", "kafelków"),
    ("element?w) pokaza?", "elementów) pokazać"),
    ("element?w", "elementów"),
    ("na ?ywo - zatwierd? przyciskiem OK", "na żywo - zatwierdź przyciskiem OK"),
    ("na ?ywo", "na żywo"),
    ("?ywo", "żywo"),
    ("zatwierd? przyciskiem", "zatwierdź przyciskiem"),
    ("zaznaczon? dobr? kategori?", "zaznaczoną dobrą kategorię"),
    ("zaznaczon?", "zaznaczoną"),
    ("dobr? kategori?", "dobrą kategorię"),
    ("dobr?", "dobrą"),
    ("kategori?", "kategorię"),
    ("naci?nij Poka? wszystko", "naciśnij Pokaż wszystko"),
    ("naci?nij", "naciśnij"),
    ("Nie widzisz swojego pliku? Sprawd?, czy masz zaznaczon? dobr? kategori?. Ewentualnie naci?nij Poka? wszystko.", "Nie widzisz swojego pliku? Sprawdź, czy masz zaznaczoną dobrą kategorię. Ewentualnie naciśnij Pokaż wszystko."),
    ("Sprawd?,", "Sprawdź,"),
    ("Sprawd?", "Sprawdź"),
    ("Wsp?lny", "Wspólny"),
    ("Backup status?w", "Backup statusów"),
    ("status?w", "statusów"),
    ("je?li", "jeśli"),
    ("Dostosuj wygl?d", "Dostosuj wygląd"),
    ("wygl?d", "wygląd"),
    ("Panel asset?w opakowa?", "Panel assetów opakowań"),
    ("asset?w", "assetów"),
    ("opakowa?", "opakowań"),
    ("Pe?na struktura produkt?w", "Pełna struktura produktów"),
    ("Pe?na struktura", "Pełna struktura"),
    ("Pe?na", "Pełna"),
    ("list? do programu", "listę do programu"),
    ("list?", "listę"),
    ("folder?w Marketing", "folderów Marketing"),
    ("folder?w", "folderów"),
    ("wed?ug nazw", "według nazw"),
    ("wed?ug", "według"),
    ("j?zyki", "języki"),
    ("j?zyk", "język"),
    ("K?ko myszy", "Kółko myszy"),
    ("indeksu?", "indeksu…"),
    ("Zaloguj si?", "Zaloguj się"),
    ("Wyloguj si?", "Wyloguj się"),
    ("Zaawansowany u?ytkownik", "Zaawansowany użytkownik"),
    ("B??d po??czenia", "Błąd połączenia"),
    ("B??d", "Błąd"),
    ("b??d", "błąd"),
    ("po??czenia", "połączenia"),
    ("Po??czenie", "Połączenie"),
    ("po??czenie", "połączenie"),
    ("Has?o", "Hasło"),
    ("has?o", "hasło"),
    ("Aktywno??", "Aktywność"),
    ("aktywno??", "aktywność"),
    ("Op?acona", "Opłacona"),
    ("Op?acone", "Opłacone"),
    ("p?atno??", "płatności"),
    ("P?atno??", "Płatności"),
    ("Termin p?atno??", "Termin płatności"),
    ("Wy?lij", "Wyślij"),
    ("wy?lij", "wyślij"),
    ("Wys?lij", "Wyślij"),
    ("wys?lij", "wyślij"),
    ("Oczekuj?ce", "Oczekujące"),
    ("oczekuj?ce", "oczekujące"),
    ("Powr?t", "Powrót"),
    ("powr?t", "Powrót"),
    ("Przelicz checklistk?", "Przelicz checklistę"),
    ("checklistk?", "checklistę"),
    ("Dzi?", "Dziś"),
    ("Od?o?one", "Odłożone"),
    ("od?o?one", "odłożone"),
    ("Ten tydzie?", "Ten tydzień"),
    ("tydzie?", "tydzień"),
    ("zaanga?owan", "zaangażowan"),
    ("Zaanga?owan", "Zaangażowan"),
    ("bezpo?redni", "bezpośredni"),
    ("Bezpo?redni", "Bezpośredni"),
    ("Powi?zan", "Powiązan"),
    ("powi?zan", "powiązan"),
    ("ca?kowit", "całkowit"),
    ("Ca?kowit", "Całkowit"),
    ("Mno?nik", "Mnożnik"),
    ("mno?nik", "mnożnik"),
    ("?wi?t", "świąt"),
    ("?wi?ta", "święta"),
    ("Bo?e", "Boże"),
    ("bo?e", "boże"),
    ("Stycze?", "Styczeń"),
    ("Kwiecie?", "Kwiecień"),
    ("Wrzesie?", "Wrzesień"),
    ("Pa?dziernik", "Październik"),
    ("Sierpie?", "Sierpień"),
    ("Grudzie?", "Grudzień"),
    ("Wszelkie prawa zastrze?one", "Wszelkie prawa zastrzeżone"),
    ("zastrze?one", "zastrzeżone"),
    ("zg?oszenia", "zgłoszenia"),
    ("Zg?oszenia", "Zgłoszenia"),
    ("?r?dle", "źródle"),
    ("?r?d?a", "źródła"),
    ("?r?d?o", "źródło"),
    ("?r?d?em", "źródłem"),
    ("?r?de?", "źródłem"),
    ("?r?d", "źród"),
    ("?cie?ka", "ścieżka"),
    ("?cie?ki", "ścieżki"),
    ("Szuka po znaczeniu (tagi, skojarzenia produkt?w, nazwy kampanii) - nie po ?cie?ce folderu", "Szuka po znaczeniu (tagi, skojarzenia produktów, nazwy kampanii) - nie po ścieżce folderu"),
    ("Domy?lnie ukryte foldery ARCHIWUM", "Domyślnie ukryte foldery ARCHIWUM"),
    ("Ukrywa PDF, Excel, Word, wideo oraz pliki ?r?d?owe (PSD, AI, INDD). Nadal dost?pne po tagach Dokument / Wideo.", "Ukrywa PDF, Excel, Word, wideo oraz pliki źródłowe (PSD, AI, INDD). Nadal dostępne po tagach Dokument / Wideo."),
    ("Suwak: 65-100% pomniejsza grafik? w kafelku; powy?ej 100% powi?ksza kafelek (max 350%). Podgl?d startuje z tej samej skali.", "Suwak: 65-100% pomniejsza grafikę w kafelku; powyżej 100% powiększa kafelek (max 350%). Podgląd startuje z tej samej skali."),
    ("Ile kart (element?w) pokaza? w siatce. Suwak i pole nie od?wie?aj? siatki na ?ywo - zatwierd? przyciskiem OK. K?ko myszy na kontrolce zmienia warto??.", "Ile kart (elementów) pokazać w siatce. Suwak i pole nie odświeżają siatkę na żywo - zatwierdź przyciskiem OK. Kółko myszy na kontrolce zmienia wartość."),
    ("Przeskanuj foldery Marketing i od?wie? branding-index.json", "Przeskanuj foldery Marketing i odśwież branding-index.json"),
    ("Np. burger, grill, proteina, slider niemi?sa, film lato 2026?", "Np. burger, grill, proteina, slider niemięsa, film lato 2026?"),
    ("Sortowanie wynik?w", "Sortowanie wyników"),
    ("Skala kafelk?w branding", "Skala kafelków branding"),
    ("Liczba kart na stronie", "Liczba kart na stronie"),
    ("Stosuj zmiany = FORCE. Zapisuje statusy z programu na foldery Marketing (rename / archiwum). Odwrotno?? Od?wie?. Tylko admin.", "Stosuj zmiany = FORCE. Zapisuje statusy z programu na foldery Marketing (rename / archiwum). Odwrotność Odśwież. Tylko admin."),
    ("Odwrotno?? Od?wie?.", "Odwrotność Odśwież."),
    ("Zaloguj sie do DAM", "Zaloguj się do DAM"),
    ("Zaloguj sie", "Zaloguj się"),
    ("zaloguj sie", "zaloguj się"),
    ("Dostep do systemu", "Dostęp do systemu"),
    ("Dostep", "Dostęp"),
    ("dostep", "dostęp"),
    ("Bledne dane", "Błędne dane"),
    ("Bledne", "Błędne"),
    ("bledne", "błędne"),
    ("Domyslnie", "Domyślnie"),
    ("domyslnie", "domyślnie"),
    ("Domyslny", "Domyślny"),
    ("domyslny", "domyślny"),
    ("Miesiac", "Miesiąc"),
    ("miesiac", "miesiąc"),
    ("Mnoznik", "Mnożnik"),
    ("mnoznik", "mnożnik"),
    ("Swieta", "Święta"),
    ("swieta", "święta"),
    ("Pazdziernik", "Październik"),
    ("pazdziernik", "październik"),
    ("Sierpien", "Sierpień"),
    ("sierpien", "sierpień"),
    ("Wrzesien", "Wrzesień"),
    ("wrzesien", "wrzesień"),
    ("Styczen", "Styczeń"),
    ("styczen", "styczeń"),
    ("Kwiecien", "Kwiecień"),
    ("kwiecien", "kwiecień"),
    ("Grudzien", "Grudzień"),
    ("grudzien", "grudzień"),
    ("Calkowity", "Całkowity"),
    ("calkowity", "całkowity"),
    ("Odswiez", "Odśwież"),
    ("odswiez", "odśwież"),
    ("Odswie", "Odświe"),
    ("odswie", "odświe"),
    ("wspolbieznosc", "współbieżność"),
    ("wspolbiez", "współbież"),
    ("wspolny", "wspólny"),
    ("wspolne", "wspólne"),
    ("wspolna", "wspólna"),
    ("podgladzie", "podglądzie"),
    ("podglad", "podgląd"),
    ("produktow", "produktów"),
    ("sciezek", "ścieżek"),
    ("sciezki", "ścieżki"),
    ("sciezka", "ścieżka"),
    ("sciezk", "ścieżk"),
    ("zrodlow", "źródłow"),
    ("zrodlowe", "źródłowe"),
    ("zrodlo", "źródło"),
    ("zrodla", "źródła"),
    ("zrodlem", "źródłem"),
    ("zrodle", "źródle"),
    ("kosztow", "kosztów"),
    ("kosztow", "kosztów"),
    ("przegladarki", "przeglądarki"),
    ("przegladarce", "przeglądarce"),
    ("przegladark", "przeglądark"),
    ("przeglad", "przegląd"),
    ("zarzadzania", "zarządzania"),
    ("zarzadzan", "zarządzan"),
    ("urzadzenie", "urządzenie"),
    ("urzadzen", "urządzeń"),
    ("urzadz", "urządz"),
    ("Odswiez", "Odśwież"),
    ("Odwie", "Odświe"),
    ("Odwie", "Odśwież"),
    ("taksonomia", "taksonomia"),
    ("", ""),  # remove replacement chars from mojibake - will handle separately
], key=lambda x: -len(x[0]))

SKIP_LINE_RE = re.compile(
    r"(?:\?v=|\?=[^=]|location\.search|indexOf\([\"']\?[\"']\)|"
    r"http[s]?://[^\s\"']*\?|\.css\?|\.js\?)"
)


def is_excluded(path: str) -> bool:
    p = path.replace("\\", "/")
    return "_qa" in p or "node_modules" in p or "/vendor/" in p


def load_pl() -> dict[str, str]:
    with open(PL_JSON, encoding="utf-8") as f:
        return json.load(f)


def fix_content(text: str) -> tuple[str, int]:
    total = 0
    lines = text.splitlines(keepends=True)
    out_lines = []
    for line in lines:
        if SKIP_LINE_RE.search(line):
            out_lines.append(line)
            continue
        new_line = line
        for old, new in REPLACEMENTS:
            if not old or old == "":
                continue
            if old in new_line:
                count = new_line.count(old)
                new_line = new_line.replace(old, new)
                total += count
        out_lines.append(new_line)
    return "".join(out_lines), total


def sync_i18n_html(text: str, pl: dict[str, str]) -> tuple[str, int]:
    count = 0

    def repl_text(m: re.Match) -> str:
        nonlocal count
        key, attrs, inner = m.group(1), m.group(2), m.group(3)
        if key in pl and inner != pl[key]:
            count += 1
            return f'data-i18n="{key}"{attrs}>{pl[key]}<'
        return m.group(0)

    text = re.sub(r'data-i18n="([^"]+)"([^>]*)>([^<]*)<', repl_text, text)

    def repl_ph(m: re.Match) -> str:
        nonlocal count
        key, val = m.group(1), m.group(2)
        if key in pl and val != pl[key]:
            count += 1
            return f'data-i18n-placeholder="{key}" placeholder="{pl[key]}"'
        return m.group(0)

    text = re.sub(r'data-i18n-placeholder="([^"]+)"\s+placeholder="([^"]*)"', repl_ph, text)

    def repl_tip(m: re.Match) -> str:
        nonlocal count
        key, val = m.group(1), m.group(2)
        if key in pl and val != pl[key]:
            count += 1
            return f'data-i18n-tip="{key}" data-dam-tip="{pl[key]}"'
        return m.group(0)

    text = re.sub(r'data-i18n-tip="([^"]+)"\s+data-dam-tip="([^"]*)"', repl_tip, text)
    return text, count


def process_file(path: str, pl: dict[str, str]) -> int:
    with open(path, encoding="utf-8", errors="replace") as f:
        original = f.read()
    text, n1 = fix_content(original)
    if path.endswith(".html"):
        text, n2 = sync_i18n_html(text, pl)
    else:
        n2 = 0
    if text != original:
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
    return n1 + n2


def main() -> int:
    pl = load_pl()
    totals: dict[str, int] = {}
    for pattern in (os.path.join(WEB, "*.html"), os.path.join(WEB, "assets", "js", "dam-*.js")):
        for path in sorted(glob.glob(pattern)):
            if is_excluded(path):
                continue
            n = process_file(path, pl)
            if n:
                rel = os.path.relpath(path, WEB)
                totals[rel] = n
                print(f"FIXED {rel}: {n}")
    print(f"Files: {len(totals)}, total: {sum(totals.values())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
