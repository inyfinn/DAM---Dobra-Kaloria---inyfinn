# -*- coding: utf-8 -*-
"""Naprawia U+FFFD i typowe mojibake w plikach UI (UTF-8 only).

Uruchom po edycji HTML/JS w edytorze, który psuje polskie znaki.
CI: test_i18n_utf8.py blokuje regresję.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WEB = ROOT / "apps" / "web"
PL_JSON = WEB / "i18n" / "pl.json"

POLISH = "ąćęłńóśźżĄĆĘŁŃÓŚŹŻ"
EXTRA_CORRUPT = "…×©«»""—–"

# Kontekstowe zamiany U+FFFD (najdłuższe najpierw).
FFFD_REPLS: list[tuple[str, str]] = sorted(
    [
        ("W\uFFFD\uFFFDcz", "Włącz"),
        ("Wy\uFFFD\uFFFDcz", "Wyłącz"),
        ("W\uFFFDcz", "Włącz"),
        ("Wy\uFFFDcz", "Wyłącz"),
        ("Poka\uFFFD wszystkie", "Pokaż wszystkie"),
        ("Poka\uFFFD wszystko", "Pokaż wszystko"),
        ("Poka\uFFFD archiwum", "Pokaż archiwum"),
        ("Poka\uFFFD lub ukryj has\uFFFDo", "Pokaż lub ukryj hasło"),
        ("Poka\uFFFD w eksploratorze", "Pokaż w eksploratorze"),
        ("Poka\uFFFD liczby", "Pokaż liczby"),
        ("Poka\uFFFD", "Pokaż"),
        ("j\uFFFDzyka", "języka"),
        ("j\uFFFDzyki", "języki"),
        ("J\uFFFDzyk", "Język"),
        ("powy\uFFFDej", "powyżej"),
        ("powi\uFFFDksza", "powiększa"),
        ("Podgl\uFFFDd", "Podgląd"),
        ("podgl\uFFFDd", "podgląd"),
        ("kafelk\uFFFDw", "kafelków"),
        ("kafelk\uFFFD", "kafelków"),
        ("2\uFFFD12", "2×12"),
        ("2F, 2\uFFFD12", "2F, 2×12"),
        ("Wyczy\uFFFD\uFFFD", "Wyczyść"),
        ("Wyczy\uFFFD", "Wyczyść"),
        ("przegl\uFFFDdania", "przeglądania"),
        ("Wr\uFFFD\uFFFD", "Wróć"),
        ("Wr\uFFFD", "Wróć"),
        ("zaznaczon\uFFFD", "zaznaczoną"),
        ("kategori\uFFFD", "kategorię"),
        ("naci\uFFFDnij", "naciśnij"),
        ("dopasowa\uFFFD", "dopasowań"),
        ("tag\uFFFDw", "tagów"),
        ("wy\uFFFD\uFFFDczone", "wyłączone"),
        ("wy\uFFFDczone", "wyłączone"),
        ("domy\uFFFDlnie", "domyślnie"),
        ("Domy\uFFFDlnie", "Domyślnie"),
        ("W\uFFFD\uFFFDcz switch", "Włącz switch"),
        ("no\uFFFDnik\uFFFDw", "nośników"),
        ("list\uFFFD", "listę"),
        ("pojawi\uFFFD", "pojawią"),
        ("Od\uFFFDwie\uFFFD", "Odśwież"),
        ("Od\uFFFDwiez", "Odśwież"),
        ("folder\uFFFDw", "folderów"),
        ("wed\uFFFDug", "według"),
        ("?r?d?o", "źródło"),
        ("?r?d?owe", "źródłowe"),
        ("?r\uFFFDd\uFFFDo", "źródło"),
        ("list\uFFFD do programu", "listę do programu"),
        ("Wczytywanie\uFFFD", "Wczytywanie…"),
        ("\uFFFDadowanie", "Ładowanie"),
        ("Materia\uFFFDy", "Materiały"),
        ("materia\uFFFDy", "materiały"),
        ("slot\uFFFDw", "slotów"),
        ("pokaza\uFFFD", "pokazać"),
        ("zg\uFFFDo\uFFFD", "zgłoś"),
        ("potrzeb\uFFFD", "potrzebę"),
        ("Asan\uFFFD", "Asanę"),
        ("koszt\uFFFDw", "kosztów"),
        ("faktur projektow", "faktur projektów"),
        ("dost\uFFFDpna", "dostępna"),
        ("wdro\uFFFDeniu", "wdrożeniu"),
        ("o\uFFFDwiadczenia", "oświadczenia"),
        ("Poni\uFFFDej", "Poniżej"),
        ("zapozna\uFFFDem", "zapoznałem"),
        ("zobowi\uFFFDzuj\uFFFD", "zobowiązuję"),
        ("prywatno\uFFFDci", "prywatności"),
        ("Polityk\uFFFD", "Politykę"),
        ("Wyra\uFFFDam", "Wyrażam"),
        ("dost\uFFFDp", "dostęp"),
        ("wiadomo\uFFFDci", "wiadomości"),
        ("niezb\uFFFDdnym", "niezbędnym"),
        ("od\uFFFD\uFFFDczy\uFFFD", "odłączyć"),
        ("ka\uFFFDdej", "każdej"),
        ("przetwarzanie danych", "przetwarzanie danych"),
        ("zastrze\uFFFDone", "zastrzeżone"),
        ("W\uFFFDa\uFFFDciciel", "Właściciel"),
        ("wy\uFFFD\uFFFDczne", "wyłączne"),
        ("nale\uFFFDy", "należy"),
        ("Cz\uFFFDstochowa", "Częstochowa"),
        ("Makuszy\uFFFDskiego", "Makuszyńskiego"),
        ("mo\uFFFDe", "może"),
        ("Op\uFFFDaty", "Opłaty"),
        ("wide\uFFFDek", "widełek"),
        ("u\uFFFDytkownik", "użytkownik"),
        ("wdro\uFFFDenia", "wdrożenia"),
        ("Prywatno\uFFFD\uFFFD", "Prywatność"),
        ("pr\uFFFDb\uFFFD", "próbę"),
        ("element\uFFFDw", "elementów"),
        ("przegl\uFFFDdarki", "przeglądarki"),
        ("przycisk \uFFFD", 'przycisk „'),
        ("\uFFFD gdy", '" gdy'),
        ("asset\uFFFDw", "assetów"),
        ("opakowa\uFFFD", "opakowań"),
        ("wygl\uFFFDd", "wygląd"),
        ("Aktywno\uFFFD\uFFFD", "Aktywność"),
        ("Oczekuj\uFFFDce", "Oczekujące"),
        ("Op\uFFFDacone", "Opłacone"),
        ("p\uFFFDatno\uFFFDci", "płatności"),
        ("miesi\uFFFDca", "miesiąca"),
        ("Bie\uFFFD\uFFFDce", "Bieżące"),
        ("tydzie\uFFFD", "tydzień"),
        ("Usu\uFFFD", "Usuń"),
        ("Copyright \uFFFD", "Copyright ©"),
        ("grafiki marki. Szukaj albo kliknij tag.", "grafiki marki. Szukaj albo kliknij tag."),
        ("i\uFFFDgrafiki", "i grafiki"),
        ("od\uFFFDwie\uFFFD", "odśwież"),
        ("niemi\uFFFDsa", "niemęsa"),
        ("\uFFFDcie\uFFFDce", "ścieżce"),
        ("produkt\uFFFDw", "produktów"),
        ("wynik\uFFFDw", "wyników"),
        ("u\uFFFDycia", "użycia"),
        ("element\uFFFDw", "elementów"),
        ("?r?d?owe", "źródłowe"),
        ("projekt\uFFFDw", "projektów"),
        ("opakowa\uFFFD", "opakowań"),
        ("kompletno\uFFFDci", "kompletności"),
        ("plik\uFFFDw", "plików"),
        ("li\uFFFDcie", "liście"),
        ("bia\uFFFDe", "białe"),
        ("t\uFFFDo", "tło"),
        ("pe\uFFFDnej", "pełnej"),
        ("szeroko\uFFFDci", "szerokości"),
        ("\uFFFD\uFFFDczenie", "Łączenie"),
        ("A\uFFFDZ", "A→Z"),
        ("Z\uFFFDA", "Z→A"),
        ("Przegl\uFFFDdaj", "Przeglądaj"),
        ("Prze\uFFFDaduj", "Przeładuj"),
        ("bie\uFFFD\uFFFDcego", "bieżącego"),
        ("Od\uFFFDwie\uFFFD", "Odśwież"),
        ("pe\uFFFDny", "pełny"),
        ("miesi\uFFFDc", "miesiąc"),
        ("Sprawd\uFFFD", "Sprawdź"),
        ("dobr\uFFFD", "dobrą"),
        ("kategori\uFFFD", "kategorię"),
        ("grafik\uFFFD", "grafikę"),
        ("powy\uFFFDej", "powyżej"),
        ("powi\uFFFDksza", "powiększa"),
        ("Podgl\uFFFDd", "Podgląd"),
        ("pokaza\uFFFD", "pokazać"),
        ("element\uFFFDw", "elementów"),
        ("indeksu\uFFFD", "indeksu…"),
        ("Uk\uFFFDad", "Układ"),
        ("si\uFFFD", "się"),
        ("Otw\uFFFDrz", "Otwórz"),
        ("koszt\uFFFDw", "kosztów"),
        ("dzia\uFFFDan", "działań"),
        ("\uFFFDcie\uFFFDk\uFFFD", "ścieżkę"),
        ("Kopiuj \uFFFDcie\uFFFDk\uFFFD", "Kopiuj ścieżkę"),
        ("wpis\uFFFDw", "wpisów"),
        ("Pokaz w", "Pokaż w"),
        ("pojawia sie", "pojawia się"),
        ("biezaco", "bieżąco"),
        ("Bezpiecze\uFFFDstwo", "Bezpieczeństwo"),
        ("Wiadomo\uFFFDci", "Wiadomości"),
        ("Has\uFFFDo", "Hasło"),
        ("U\uFFFDywanie", "Używanie"),
        ("Pe\uFFFDny", "Pełny"),
        ("Utw\uFFFDrz", "Utwórz"),
        ("Zapami\uFFFDtaj", "Zapamiętaj"),
        ("urz\uFFFDdzenie", "urządzenie"),
        ("Zaloguj si\uFFFD", "Zaloguj się"),
        ("cofni\uFFFDciu", "cofnięciu"),
        ("skr\uFFFDty", "skróty"),
        ("Odsprzeda\uFFFD", "Odsprzedaż"),
        ("plik\uFFFDw", "plików"),
        ("wewn\uFFFDtrzna", "wewnętrzna"),
        ("mog\uFFFD", "mogą"),
        ("usuni\uFFFDci", "usunięci"),
        ("nigdy nie s\uFFFD", "nigdy nie są"),
        ("Po\uFFFD\uFFFDczenie", "Połączenie"),
        ("Otw\uFFFDrz pe\uFFFDny", "Otwórz pełny"),
        ("odbiorc\uFFFDw", "odbiorców"),
        ("powiadomie\uFFFD", "powiadomień"),
        ("ostatni\uFFFD", "ostatnią"),
        ("zg\uFFFDoszenia", "zgłoszenia"),
        ("odpowiedzialno\uFFFD\uFFFD", "odpowiedzialność"),
        ("no\uFFFDnika", "nośnika"),
        ("min\uFFFD", "miną"),
        ("klepa\uFFFD", "klepać"),
        ("\uFFFDcie\uFFFDki", "ścieżki"),
        ("u\uFFFDytkownik\uFFFDw", "użytkowników"),
        ("przegl\uFFFDdarce", "przeglądarce"),
        ("Zwyk\uFFFDy", "Zwykły"),
        ("propozycj\uFFFD", "propozycję"),
        ("plik\uFFFDw", "plików"),
        ("Naci\uFFFDnij", "Naciśnij"),
        ("kompletno\uFFFDci", "kompletności"),
        ("\uFFFDr\uFFFDd\uFFFDa", "Źródła"),
        ("Multij\uFFFDzyczny", "Multijęzyczny"),
        ("grafik\uFFFDw", "grafików"),
        ("skr\uFFFDt", "skrót"),
        ("r\uFFFDkawek", "rękawek"),
        ("Jako\uFFFD\uFFFD", "Jakość"),
        ("sko\uFFFDczony", "skończony"),
        ("wy\uFFFD\uFFFDcznie", "wyłącznie"),
        ("po\uFFFD\uFFFDczeniu", "połączeniu"),
        ("prz\uFFFDd", "przód"),
        ("warto\uFFFD\uFFFD", "wartość"),
        ("domy\uFFFDlny", "domyślny"),
        ("Wygl\uFFFDd", "Wygląd"),
        ("typ\uFFFDw", "typów"),
        ("Propozycje typ\uFFFDw", "Propozycje typów"),
        ("u\uFFFDytkownik\uFFFDw", "użytkowników"),
        ("perspektywy", "perspektywy"),
        ("oznaczaj\uFFFD", "oznaczają"),
        ("otworzy\uFFFD", "otworzyć"),
        ("oznaczy\uFFFD", "oznaczyć"),
        ("przybli\uFFFDy\uFFFD", "przybliżyć"),
        ("wizualizacj\uFFFD", "wizualizację"),
        ("zewn\uFFFDtrzne", "zewnętrzne"),
        ("literk\uFFFD", "literkę"),
        ("przywr\uFFFDcenie", "przywrócenie"),
        ("Aplikacja dostarczana \uFFFDjak jest\uFFFD", "Aplikacja dostarczana „jak jest”"),
        ("zarz\uFFFDdzanie", "zarządzanie"),
        ("dostawc\uFFFDw", "dostawców"),
        ("procedur\uFFFD", "procedurę"),
        ("ko\uFFFDcu", "końcu"),
        ("p\uFFFDasko", "płasko"),
        ("Wy\uFFFDwietlamy", "Wyświetlamy"),
        ("Ci\uFFFD", "Cię"),
        ("Skr\uFFFDty", "Skróty"),
        ("Urz\uFFFDdze\uFFFD", "Urządzeń"),
        ("\uFFFDr\uFFFDd\uFFFDowe", "źródłowe"),
        ("zostaj\uFFFD", "zostają"),
        ("otw\uFFFDrz", "otwórz"),
        ("dzia\uFFFDa", "działa"),
        ("ca\uFFFDym", "całym"),
        ("panelu", "panelu"),
        ("historii\uFFFD", "historii…"),
        ("kana\uFFFD", "kanał"),
        ("robi\uFFFD", "robią"),
        ("Zg\uFFFDoszenia", "Zgłoszenia"),
        ("zg\uFFFDosze\uFFFDie", "zgłoszenie"),
        ("BATON\uFFFD", "BATONÓW"),
        ("TY\uFFFD-ENFACE", "TYŁ-ENFACE"),
        ("bezpiecze\uFFFDstwo", "bezpieczeństwo"),
        ("u\uFFFDytkownik\uFFFDw", "użytkowników"),
        ("imi\uFFFD", "imię"),
        ("Trwa d\uFFFDu\uFFFDej", "Trwa dłużej"),
        ("narz\uFFFDdziami", "narzędziami"),
        ("je\uFFFDli", "jeśli"),
        ("przywr\uFFFD\uFFFD", "przywróć"),
        ("korzysta\uFFFD", "korzystać"),
        ("wyj\uFFFDcia", "wyjścia"),
        ("Cz\uFFFDonek", "Członek"),
        ("Zarz\uFFFDdu", "Zarządu"),
        ("wskaz\uFFFDwki", "wskazówki"),
        ("Pe\uFFFDne", "Pełne"),
        ("Dematte czarnego matte \uFFFD", "Dematte czarnego matte —"),
        ("temat\uFFFDw", "tematów"),
        ("\uFFFDadna", "Żadna"),
        ("oznacze\uFFFD", "oznaczeń"),
        ("szeroko\uFFFD\uFFFD", "szerokość"),
        ("Cofnij ostatni\uFFFD", "Cofnij ostatnią"),
        ("operacyjne", "operacyjne"),
        ("Uzyskaj \uFFFD\uFFFDcze", "Uzyskaj łącze"),
        ("wdro\uFFFDeniu", "wdrożeniu"),
        ("chronimy dane u\uFFFDytkownik\uFFFDw", "chronimy dane użytkowników"),
        ("miniatur\uFFFD", "miniaturę"),
        ("integracja", "integracja"),
        ("filmy i\uFFFDgrafiki", "filmy i grafiki"),
    ],
    key=lambda x: -len(x[0]),
)

SCAN_EXTS = {".html", ".js", ".css", ".json"}
SKIP_PARTS = ("node_modules", "vendor", "_qa", "data/branding-index")


def load_pl() -> dict[str, str]:
    if not PL_JSON.is_file():
        return {}
    return json.loads(PL_JSON.read_text(encoding="utf-8"))


def to_broken(s: str) -> str:
    corrupt = set(POLISH + EXTRA_CORRUPT)
    return "".join("\ufffd" if c in corrupt else c for c in s)


def sync_i18n_html(text: str, pl: dict[str, str]) -> str:
    def inner(m: re.Match[str]) -> str:
        key, attrs, inner_txt = m.group(1), m.group(2), m.group(3)
        if key in pl:
            return f'data-i18n="{key}"{attrs}>{pl[key]}<'
        return m.group(0)

    text = re.sub(r'data-i18n="([^"]+)"([^>]*)>([^<]*)<', inner, text)

    def ph(m: re.Match[str]) -> str:
        key, rest, val = m.group(1), m.group(2), m.group(3)
        if key in pl:
            return f'data-i18n-placeholder="{key}"{rest}placeholder="{pl[key]}"'
        return m.group(0)

    text = re.sub(
        r'data-i18n-placeholder="([^"]+)"([^>]*?)placeholder="([^"]*)"',
        ph,
        text,
    )

    for key, val in pl.items():
        if not val or "\ufffd" in val:
            continue
        esc = re.escape(key)
        for attr in ("data-dam-tip", "title", "aria-label"):
            text = re.sub(
                rf'(data-i18n-tip="{esc}"[^>]*\s{attr}=")([^"]*)(")',
                rf"\g<1>{val}\3",
                text,
            )
            text = re.sub(
                rf'(data-i18n-title="{esc}"[^>]*\s{attr}=")([^"]*)(")',
                rf"\g<1>{val}\3",
                text,
            )
    return text


def fix_from_pl_dictionary(text: str, pl: dict[str, str]) -> str:
    for good in sorted({v for v in pl.values() if v and "\ufffd" not in v}, key=len, reverse=True):
        broken = to_broken(good)
        if broken != good and broken in text:
            text = text.replace(broken, good)
    return text


def apply_fffd_fixes(text: str, pl: dict[str, str] | None = None) -> str:
    if pl:
        text = sync_i18n_html(text, pl)
        text = fix_from_pl_dictionary(text, pl)
    for old, new in FFFD_REPLS:
        if old in text:
            text = text.replace(old, new)
    return text


def scan_file(path: Path, pl: dict[str, str]) -> tuple[str, int] | None:
    try:
        raw = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return ("decode_error", -1)
    if "\ufffd" not in raw and "ï¿½" not in raw:
        return None
    fixed = apply_fffd_fixes(raw, pl)
    if "\ufffd" in fixed:
        return ("remaining_fffd", fixed.count("\ufffd"))
    if fixed != raw:
        return ("fixed", fixed.count("\ufffd"))
    return ("unfixed", raw.count("\ufffd"))


def fix_file(path: Path, pl: dict[str, str]) -> bool:
    raw = path.read_text(encoding="utf-8")
    out = apply_fffd_fixes(raw, pl)
    if out != raw:
        path.write_text(out, encoding="utf-8", newline="\n")
        return True
    return False


def main() -> int:
    pl = load_pl()
    changed = 0
    remaining: list[tuple[str, str]] = []
    for p in sorted(WEB.rglob("*")):
        rel = str(p.relative_to(WEB)).replace("\\", "/")
        if any(s in rel for s in SKIP_PARTS):
            continue
        if p.suffix.lower() not in SCAN_EXTS:
            continue
        status = scan_file(p, pl)
        if status is None:
            continue
        kind, _n = status
        if kind == "fixed" or kind == "remaining_fffd" or kind == "unfixed":
            if fix_file(p, pl):
                changed += 1
                print("fixed", rel)
            elif "\ufffd" in p.read_text(encoding="utf-8"):
                remaining.append((rel, kind))
                print("REMAINING", rel, kind)
        elif kind == "decode_error":
            remaining.append((rel, kind))
            print("DECODE_ERR", rel)
    print(f"changed={changed} remaining={len(remaining)}")
    return 1 if remaining else 0


if __name__ == "__main__":
    sys.exit(main())
