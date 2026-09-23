# Jedno źródło prawdy - plan (start 2026-09-23)

Cel: każda instalacja DAM pokazuje te same DANE niezależnie od tego, czy ma folder
Marketing (ROOT) i pod jaką literą. ROOT daje oryginały i dodatkowe funkcje, ale
prawdą jest indeks i baza na Synology. Grafiki bez ROOT idą z pamięci podręcznej (NAS).

## Co było zepsute (zmierzone)

1. Id materiałów były licznikiem skanu (`br-000001`...). Każda przebudowa i każdy
   komputer miał inną numerację (`build-branding-index.py:253`, `:456`).
   Baza trzyma powiązania po id, więc na każdym komputerze te same wiersze
   wskazywały inne pliki. Z powiązań `sku_match` tylko 7 wskazywało plik
   z właściwym SKU (np. Klopsiki 6300576 przypięte do Figi z makiem).
2. `folder_group_id` z literą dysku (`x:/marketing/...` albo `m:/- polska/...`) -
   nadpisania skojarzeń nie trafiały na innym komputerze.
3. Między komputerami synchronizują się tylko `file-index.json` i
   `branding-search-index.json` (`index_snapshots.py:32`). `branding-index.json`,
   `branding-grid-index.json` i `branding-grid-head.json` każdy komputer ma swój
   (repo 54 MB, złota instalacja 362 MB).
4. `assoc_sync` (PG `dam_asset_product_links`) nie przenosi usunięć - stare
   wiersze wracają na świeże komputery.
5. Karta produktu: miniatury materiałów z dysku zamiast z pamięci podręcznej,
   nieczytelny opis ceny referencyjnej.

## Faza 1 - wydanie 2.3.6

| # | Zadanie | Kto | Stan |
|---|---------|-----|------|
| 1 | `asset_ids.py`: id ze ścieżki względnej wobec ROOT (`br-0` + 8 cyfr) | kierownik | zrobione, testy 8/8 |
| 2 | build/enrich używają stabilnych id, dedupe po kluczu | worker B + kierownik | zrobione |
| 3 | `folder_group_id` względny wobec ROOT (`brand_folder_context.py`) | kierownik | zrobione |
| 4 | Migracja danych: indeksy, overrides, obie bazy SQLite, PG (z kopiami) | kierownik | w toku |
| 5 | Seed powiązań SKU/OCR od nowa na stabilnych id | kierownik | czeka na 4 |
| 6 | Snapshoty PG także dla branding-index / grid-index / grid-head | worker D | do zrobienia |
| 7 | assoc_sync: epoka id - komputer ze starymi wierszami czyści je i pobiera od nowa | worker E | do zrobienia |
| 8 | Narzędzie porównania złota vs bez ROOT (zrzuty + liczby) | worker C | w toku |
| 9 | Karta produktu: miniatury z pamięci podręcznej, kontrast | kierownik | zrobione, czeka na zrzut |
| 10 | Wydanie 2.3.6 z `.exe` + `.sig`, CLAUDE.md: ship chain z `.sig` | kierownik | na końcu |

Dowód PASS: zrzuty z kopii bez ROOT (`bin/scripts/qa/noroot`) = te same liczby
co złota aplikacja na Projektach, Wizualizacjach, Brandingu i karcie produktu.

## Faza 2 - scalanie indeksu jak Synology Drive

Snapshot "najnowszy wygrywa" z fazy 1 to nie jest scalanie. Docelowo:
tabela PG z jednym wierszem na materiał (stabilne id, klucz ścieżki, mtime, rozmiar,
metadane, `deleted_at`, `rev`). Każdy komputer z ROOT skanuje i wysyła różnice
(dodane, zmienione, usunięte - usunięcie tylko, gdy lokalny skan widział folder
i plik zniknął, a wpis w bazie jest starszy). Komputery bez ROOT tylko pobierają.
Lokalne JSON-y (branding-index itd.) budowane z tej tabeli.
