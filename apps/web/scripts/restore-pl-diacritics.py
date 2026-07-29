# -*- coding: utf-8 -*-
"""Przywraca polskie znaki w pl.json i wybranych plikach UI (UTF-8)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WEB = ROOT / "apps" / "web"

# Najdluzsze najpierw - unikamy czesciowych kolizji.
REPLS: list[tuple[str, str]] = sorted(
    {
        ("Wymagaja uzupelnienia", "Wymagają uzupełnienia"),
        ("Do uzupelnienia", "Do uzupełnienia"),
        ("Szacowany koszt miesiaca", "Szacowany koszt miesiąca"),
        ("Biezace zadania graficzne", "Bieżące zadania graficzne"),
        ("Ten tydzien", "Ten tydzień"),
        ("Otworz kalkulator kosztow", "Otwórz kalkulator kosztów"),
        ("Szczegoly kosztu", "Szczegóły kosztu"),
        ("Dostosuj wyglad", "Dostosuj wygląd"),
        (
            "Uklad pulpitu zapisuje sie lokalnie dla Twojego konta.",
            "Układ pulpitu zapisuje się lokalnie dla Twojego konta.",
        ),
        (
            "Powiadom gdy pojawi sie nowa wizualizacja",
            "Powiadom gdy pojawi się nowa wizualizacja",
        ),
        ("Nastepne zadania", "Następne zadania"),
        ("Obciazenie osob", "Obciążenie osób"),
        ("Sprzedaz (szacunek)", "Sprzedaż (szacunek)"),
        ("Jezyki / MIX", "Języki / MIX"),
        ("Top opakowan", "Top opakowań"),
        ("Szybkie skroty", "Szybkie skróty"),
        ("Wiadomosci", "Wiadomości"),
        ("wiadomosci", "wiadomości"),
        ("Aktywnosc", "Aktywność"),
        ("Wszelkie prawa zastrzezone", "Wszelkie prawa zastrzeżone"),
        ("Pliki projektow opakowan", "Pliki projektów opakowań"),
        ("Panel assetow opakowan", "Panel assetów opakowań"),
        ("Aktywne projekty opakowan", "Aktywne projekty opakowań"),
        ("Kalkulator kosztow", "Kalkulator kosztów"),
        ("Produkty opakowan", "Produkty opakowań"),
        ("Projekty opakowan", "Projekty opakowań"),
        ("projekty opakowan", "projekty opakowań"),
        ("kompletnosci plikow", "kompletności plików"),
        ("kompletnosci", "kompletności"),
        ("projektow", "projektów"),
        ("Produktow", "Produktów"),
        ("produktow", "produktów"),
        ("opakowan", "opakowań"),
        ("plikow", "plików"),
        ("Plikow", "Plików"),
        ("kosztow", "kosztów"),
        ("assetow", "assetów"),
        ("Jezyk", "Język"),
        ("jezyk", "język"),
        ("Usun", "Usuń"),
        ("Odswiez", "Odśwież"),
        ("odswiez", "odśwież"),
        ("Przeladuj", "Przeładuj"),
        ("przeladuj", "przeładuj"),
        ("biezacego", "bieżącego"),
        ("Biezace", "Bieżące"),
        ("biezace", "bieżące"),
        ("sciezke", "ścieżkę"),
        ("Sciezke", "Ścieżkę"),
        ("sciezka", "ścieżka"),
        ("Sciezka", "Ścieżka"),
        ("zgloszenia", "zgłoszenia"),
        ("zgloszen", "zgłoszeń"),
        ("Zglos", "Zgłoś"),
        ("zglos", "zgłoś"),
        ("uzupelnienia", "uzupełnienia"),
        ("uzupelnienie", "uzupełnienie"),
        ("miesiaca", "miesiąca"),
        ("miesiacu", "miesiącu"),
        ("tydzien", "tydzień"),
        ("Otworz", "Otwórz"),
        ("otworz", "otwórz"),
        ("Szczegoly", "Szczegóły"),
        ("szczegoly", "szczegóły"),
        ("wyglad", "wygląd"),
        ("Uklad", "Układ"),
        ("uklad", "układ"),
        ("zapisuje sie", "zapisuje się"),
        ("pojawi sie", "pojawi się"),
        ("Nastepne", "Następne"),
        ("nastepne", "następne"),
        ("Obciazenie", "Obciążenie"),
        ("obciazenie", "obciążenie"),
        ("Sprzedaz", "Sprzedaż"),
        ("sprzedaz", "sprzedaż"),
        ("skroty", "skróty"),
        ("Skroty", "Skróty"),
        ("zastrzezone", "zastrzeżone"),
        ("Trwa dluzej", "Trwa dłużej"),
        ("dluzej", "dłużej"),
        ("juz wczytanego", "już wczytanego"),
        ("juz zbudowanego", "już zbudowanego"),
        ("calego", "całego"),
        ("Wskaz sciezke", "Wskaż ścieżkę"),
        ("Wskaz", "Wskaż"),
        ("Jak uruchomic", "Jak uruchomić"),
        ("uruchomic", "uruchomić"),
        ("Zwin menu", "Zwiń menu"),
        ("Rozwin menu", "Rozwiń menu"),
        ("Sesja urzadzenia", "Sesja urządzenia"),
        ("urzadzenia", "urządzenia"),
        ("Pomoc i skroty klawiszowe", "Pomoc i skróty klawiszowe"),
        ("przegladarce", "przeglądarce"),
        ("przegladarki", "przeglądarki"),
        ("Przegladasz", "Przeglądasz"),
        ("Pokaz wszystkie", "Pokaż wszystkie"),
        ("dolacza", "dołącza"),
        ("watki", "wątki"),
        ("liczbe", "liczbę"),
        ("Status polaczenia", "Status połączenia"),
        ("polaczenia", "połączenia"),
        ("Twoja sciezka", "Twoja ścieżka"),
        ("czytac", "czytać"),
        ("otwierac", "otwierać"),
        ("Sciezka bazowa", "Ścieżka bazowa"),
        ("Jesli widzisz", "Jeśli widzisz"),
        ("skrot", "skrót"),
        ("dzialajacym", "działającym"),
        ("Wiecej w pelnej Pomocy", "Więcej w pełnej Pomocy"),
        ("Wiecej", "Więcej"),
        ("pelnej", "pełnej"),
        ("pelna", "pełna"),
        ("Pelna", "Pełna"),
        ("nosnika", "nośnika"),
        ("Nosnik", "Nośnik"),
        ("rozwinac", "rozwinąć"),
        ("zrodlowy", "źródłowy"),
        ("Zrodlowy", "Źródłowy"),
        ("Podglad", "Podgląd"),
        ("podglad", "podgląd"),
        ("skladniki", "składniki"),
        ("Skladniki", "Składniki"),
        ("Materialy", "Materiały"),
        ("materialy", "materiały"),
        ("wpisow", "wpisów"),
        ("rozjezdzaja", "rozjeżdżają"),
        ("niedostepny", "niedostępny"),
        ("Niedostepny", "Niedostępny"),
        ("dziala", "działa"),
        ("Ladowanie", "Ładowanie"),
        ("ladowanie", "ładowanie"),
        ("Blad", "Błąd"),
        ("blad", "błąd"),
        ("Polacz", "Połącz"),
        ("polacz", "połącz"),
        ("Brak sciezki", "Brak ścieżki"),
        ("ROOT plikow", "ROOT plików"),
        ("nie mozna odczytac", "nie można odczytać"),
        ("mozna", "można"),
        ("odczytac", "odczytać"),
        ("checkliste", "checklistę"),
        ("Checkliste", "Checklistę"),
        ("Brak projektow", "Brak projektów"),
        ("Kliknij", "Kliknij"),
        ("albo odswiez", "albo odśwież"),
        ("Eksploratorze", "Eksploratorze"),
        ("zadańia", "zadania"),
        ("Wszystkie zadan ", "Wszystkie zadań "),
        ("Otwarte zadan ", "Otwarte zadań "),
        ("miesiecy", "miesięcy"),
        ("gosciu", "gościu"),
        ("gosci", "gości"),
        ("wlacz", "włącz"),
        ("Wylacz", "Wyłącz"),
        ("wylacz", "wyłącz"),
        ("zacznij", "zacznij"),
        ("rozpocznij", "rozpocznij"),
        ("zakoncz", "zakończ"),
        ("Zakoncz", "Zakończ"),
        ("potwierdz", "potwierdź"),
        ("Potwierdz", "Potwierdź"),
        ("anuluj", "anuluj"),
        ("Anuluj", "Anuluj"),
        ("wyslij", "wyślij"),
        ("Wyslij", "Wyślij"),
        ("wyszukaj", "wyszukaj"),
        ("szukaj", "szukaj"),
        ("Szukaj", "Szukaj"),
        ("ustawienia", "ustawienia"),
        ("Ustawienia", "Ustawienia"),
        ("haslo", "hasło"),
        ("Haslo", "Hasło"),
        ("uzytkownik", "użytkownik"),
        ("Uzytkownik", "Użytkownik"),
        ("uzytkownika", "użytkownika"),
        ("uzytkownicy", "użytkownicy"),
        ("zaloguj", "zaloguj"),
        ("Zaloguj", "Zaloguj"),
        ("wyloguj", "wyloguj"),
        ("Wyloguj", "Wyloguj"),
        ("pomoc", "pomoc"),
        ("Pomoc", "Pomoc"),
        ("nazwa", "nazwa"),
        ("Nazwa", "Nazwa"),
        ("opis", "opis"),
        ("Opis", "Opis"),
        ("data", "data"),
        ("Data", "Data"),
        ("status", "status"),
        ("Status", "Status"),
        ("odswiezanie", "odświeżanie"),
        ("Odswiezanie", "Odświeżanie"),
        ("jesli", "jeśli"),
        ("Jesli", "Jeśli"),
        ("sie rozjezdzaja", "się rozjeżdżają"),
        ("rozjezdzaja", "rozjeżdżają"),
        ("Lista projektow", "Lista projektów"),
        ("ich kompletnosci", "ich kompletności"),
        ("wariantow", "wariantów"),
        ("liscie", "liście"),
        ("szerokosci", "szerokości"),
    },
    key=lambda x: -len(x[0]),
)

TARGETS = [
    WEB / "i18n" / "pl.json",
    WEB / "index.html",
    WEB / "inbox.html",
    WEB / "explorer.html",
    WEB / "assets" / "js" / "dam-shell.js",
    WEB / "assets" / "js" / "dam-projects.js",
    WEB / "assets" / "js" / "dam-project.js",
    WEB / "assets" / "js" / "dam-root-status.js",
    WEB / "assets" / "js" / "dam-explorer.js",
]


def _needs_boundary(src: str) -> bool:
    """Short/stem replacements are unsafe as raw substring replace."""
    if len(src) <= 8:
        return True
    risky = {
        "opakowan",
        "produktow",
        "projektow",
        "plikow",
        "kosztow",
        "assetow",
        "jezyk",
        "dziala",
        "gosci",
        "status",
        "data",
        "opis",
        "nazwa",
        "pomoc",
        "szukaj",
        "anuluj",
        "haslo",
    }
    return src.lower() in risky


def apply_text(text: str) -> str:
    for a, b in REPLS:
        if a == b:
            continue
        if _needs_boundary(a):
            text = re.sub(
                r"(?<![A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ])"
                + re.escape(a)
                + r"(?![A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ])",
                b,
                text,
            )
        else:
            text = text.replace(a, b)
    return text


def main() -> None:
    for path in TARGETS:
        if not path.is_file():
            print("skip missing", path)
            continue
        raw = path.read_text(encoding="utf-8")
        out = apply_text(raw)
        if out != raw:
            path.write_text(out, encoding="utf-8", newline="\n")
            n = len(re.findall(r"[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]", out))
            print("updated", path.relative_to(ROOT), "diacritics=", n)
        else:
            print("unchanged", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
