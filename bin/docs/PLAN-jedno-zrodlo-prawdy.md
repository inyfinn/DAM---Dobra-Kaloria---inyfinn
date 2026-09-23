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

Snapshot "najnowszy wygrywa" z fazy 1 to nie jest scalanie: jeden niepełny skan
(23.09 - M: widział 9 produktów) albo nieaktualna kopia X: może nadpisać całość,
a zmiany z dwóch komputerów nie łączą się. Docelowo baza trzyma jeden wiersz na
materiał, a każdy komputer z ROOT wysyła tylko różnice - jak klient Synology Drive.

Logika gotowa, niewpięta: `bin/apps/desktop/asset_sync.py`
(testy: `bin/apps/desktop/tests/test_asset_sync.py`, 24 testy, w tym 19 scenariuszy wielu komputerów, atrapa PG na SQLite
wykonująca te same zapytania SQL).

### Tabela `dam_assets` (PostgreSQL na Synology)

| Kolumna | Typ | Znaczenie |
|---|---|---|
| `asset_id` | TEXT PK | stabilne id `br-0########` (`asset_ids.stable_asset_id`) |
| `asset_key` | TEXT UNIQUE | ścieżka względna wobec Marketingu, casefold, NFC, bez litery dysku |
| `path_rel` | TEXT | ścieżka względna z oryginalną wielkością liter (do wyświetlania) |
| `name` | TEXT | nazwa pliku |
| `size` | BIGINT NULL | rozmiar w bajtach |
| `mtime_ms` | BIGINT | czas modyfikacji pliku (ms) - główne kryterium "nowszy wygrywa" |
| `content_hash` | TEXT NULL | opcjonalny skrót treści (dziś nie liczony - za drogi po SMB) |
| `meta` | JSONB | pola skanera: media_type, sku, tags, folder_group_id... |
| `deleted_at` | BIGINT NULL | tombstone: czas skanu, który stwierdził brak pliku; NULL = żywy |
| `updated_at` | BIGINT | czas zapisu (ms, zegar komputera) |
| `updated_by` | TEXT | komputer, który zapisał wiersz |
| `seen_by_machine` | TEXT | ostatni komputer, który potwierdził plik zapisem |
| `rev` | BIGINT | `nextval('dam_assets_rev_seq')` przy każdej zmianie; indeks na `rev` |

Zapisy (`push_ops`) biorą `pg_advisory_xact_lock` - dzięki temu `rev` rosną w kolejności
commitów i `pull_since(rev > ostatni)` niczego nie gubi (ta dziura istnieje dziś w
`assoc_sync`: dwa równoległe zapisy mogą zatwierdzić mniejszy rev po większym).

### Reguły scalania

Wejście jednego skanu na komputerze z ROOT:
- `scan` - pliki widziane teraz (asset_id -> klucz, rozmiar, mtime, meta),
- `scanned_dirs` - foldery wylistowane W CAŁOŚCI bez błędu,
- `failed_dirs` - foldery, które istnieją, ale się nie wylistowały (błąd, brak dostępu, wykluczenie),
- `last_seen` - id plików, które TEN komputer widział w poprzednim skanie (lokalny stan),
- `prev_rows` - lokalne lustro bazy po ostatnim pull (z tombstonami).

1. **Dodanie / zmiana** (`upsert`): gdy pliku nie ma w bazie, gdy mtime jest nowszy, albo
   przy tym samym mtime inny rozmiar (lub skrót). Baza sprawdza to jeszcze raz w `WHERE`:
   starszy mtime nigdy nie nadpisze nowszego (kopia X: sprzed synchronizacji nic nie cofa).
   Remis mtime z inną treścią: wygrywa zapis, który znał najnowszy `rev` (`t.rev <= base_rev`),
   spóźniony zapis ze starego stanu jest odrzucany i dostaje nowszą wersję w następnym pull.
2. **Usunięcie** (`tombstone`, `deleted_at` = czas skanu) tylko gdy WSZYSTKO naraz:
   - plik był w `last_seen` tego komputera - komputer usuwa tylko to, co sam miał
     (jak klient Synology). Pierwszy skan na komputerze nie usuwa niczego. Dzięki temu
     nieaktualny X: nie usuwa pliku, którego Drive jeszcze do niego nie przyniósł;
   - najbliższy istniejący folder nadrzędny jest w `scanned_dirs`, a żaden folder po drodze
     nie jest w `failed_dirs` (brak odczytu = brak wniosku o usunięciu). Folder usunięty
     w całości jest rozpoznawany, bo jego rodzic został wylistowany i go nie zawiera;
   - wpis w bazie ma `mtime <= czas skanu` i `mtime <= mtime wersji, którą komputer znał`
     (baza sprawdza w `WHERE`). Zmiana na innym komputerze wygrywa z usunięciem;
   - **bezpiecznik poddrzewa**: dla każdego wylistowanego folderu z co najmniej 10 plikami
     (`SUBTREE_MIN_FILES`) - jeśli znika z niego > 20 % plików (`SUBTREE_SHRINK_LIMIT`),
     usunięć z tego poddrzewa nie wysyłamy (raport `blocked`). Zablokowane pliki zostają w
     `last_seen`, więc po powrocie dysku nic nie ginie, a przy prawdziwym usunięciu decyzja
     czeka na admina (patrz niżej).
3. **Przywrócenie**: plik znów widziany -> `deleted_at = NULL`.
   - nowszy mtime / inny rozmiar = zwykły upsert (`recreate`);
   - ta sama wersja (`restore`) wraca tylko, gdy "pojawiła się" na tym komputerze (nie było
     jej w `last_seen`, np. przywrócona z Kosza) i tylko gdy tombstone w bazie jest sprzed
     skanu i nikt go w międzyczasie nie zmienił (`deleted_at <= scan`, `rev <= base_rev`).
     Nieaktualna kopia, którą komputer miał cały czas, NIE wskrzesza pliku usuniętego gdzie indziej.
4. **Komputer bez ROOT**: tylko `pull_since(rev)` -> `apply_remote` -> `live_entries(rows, root)`
   buduje lokalny `branding-index.json`. Nigdy nie pisze do `dam_assets`.
5. **Cykl** (`sync_cycle`): pull -> diff -> push -> pull. Błąd sieci = raport `ok: False`,
   bez wyjątku; `last_seen` zmienia się tylko po udanym cyklu, więc nic się nie gubi.
6. Idempotencja: ten sam skan drugi raz = 0 operacji; tylko meta bez zmiany pliku nie
   generuje zapisu (inaczej dwie wersje skanera przerzucałyby się meta w nieskończoność).

### Migracja z dzisiejszych snapshotów

1. Na złotym komputerze (M:) po 2.3.7: `ensure_schema`, potem jednorazowy import
   `branding-index.json` (57 tys. wierszy) do `dam_assets` paczkami `execute_values`
   (nie `push_ops` - to po jednym zapytaniu na operację, dobre dla różnic, za wolne dla całości).
   `rev` z sekwencji, `updated_by = <maszyna>:import`, `deleted_at = NULL`.
2. Tym samym przebiegiem zapisać lokalnie `last_seen` = wszystkie zaimportowane id,
   żeby pierwszy skan fazy 2 mógł już wykrywać usunięcia (bez tego pierwszy skan nie usuwa nic).
3. Inne komputery z ROOT (X:, Mac) zaczynają z `last_seen = None`: pierwszy skan tylko
   dodaje / aktualizuje. Przy X: to celowe - kopia może być nieaktualna.
4. `dam_index_snapshots` dla `branding-index.json` zostaje w trybie tylko do odczytu jako
   awaryjny powrót przez jedno wydanie; potem publikacja tego klucza wyłączona.
   `file-index.json` (196 produktów) na razie dalej przez snapshoty - osobna decyzja.
5. Znacznik w `dam_meta`: `asset_index_mode = rows` - komputery z nowym wydaniem przestają
   pobierać snapshot `branding-index` i budują go z tabeli.

### Plan wpięcia (do decyzji kierownika)

| # | Krok | Gdzie | Flaga |
|---|------|-------|-------|
| 1 | Walker z `os.walk(onerror=...)` zamiast `rglob`: zwraca pliki + `scanned_dirs` + `failed_dirs`. Dziś `rglob` po cichu pomija nieczytelne foldery - bez tego `failed_dirs` jest puste i jedynym zabezpieczeniem jest próg 20 % | `build-branding-index.py::scan_marketing_roots` (+ `make_asset` jako źródło `meta`) | - |
| 2 | Lokalny stan: lustro wierszy + `last_seen` + `rev` w SQLite (`dam-local.sqlite`, tabele `asset_rows`, `asset_sync_state`) | nowe funkcje w `asset_sync` lub małe `asset_repo` | - |
| 3 | Wątek jak `assoc_sync.start`: co N min `sync_cycle`; z ROOT (`_snapshot_root_alive()`) ze skanem, bez ROOT tylko pull | `local_bridge.py` obok `assoc_sync.start` (~l. 11381) | `DAM_ASSET_SYNC=1` (domyślnie off przez pierwsze wydanie) |
| 4 | Po pull z nowymi wierszami: zapis `branding-index.json` z `live_entries` + ten sam callback co dziś `_on_snapshot_updated` (przebudowa siatki) | `local_bridge.py::_on_snapshot_updated` | - |
| 5 | Po włączeniu: `index_snapshots` przestaje publikować `branding-index.json` | `index_snapshots.py` (lista kluczy) | `asset_index_mode` w `dam_meta` |
| 6 | Panel admina: lista `blocked` (folder, liczba plików) z przyciskiem "potwierdź usunięcia" = `diff_scan_report` bez progu dla tego folderu | endpoint mostu + widok w panelu synchronizacji | - |
| 7 | Status w `/api/.../sync-status`: ostatni cykl, ops, blocked, stale_ignored, błędy | most | - |

### Ryzyka

- **Zegary**: `deleted_at` i warunek "mtime <= czas skanu" porównują czasy z różnych komputerów.
  Rozjazd zegara o minuty jest bez znaczenia (mtime plików pochodzi z dysku NAS), o godziny - już tak.
- **mtime przez Synology Drive**: Drive zachowuje mtime przy kopiowaniu - na tym opiera się
  "nowszy wygrywa". Jeśli jakiś klient (Mac/SMB) zaokrągla mtime do 2 s albo sekund, ten sam plik
  wyglądałby na zmieniony. Do sprawdzenia na prawdziwych danych przed włączeniem
  (w razie potrzeby porównywać z tolerancją).
- **Małe foldery** (< 10 plików) nie są oceniane przez bezpiecznik osobno - niepełny odczyt
  pojedynczego małego folderu, który jednak "wylistował się bez błędu", przejdzie.
  Chroni przed tym walker z `onerror` (krok 1) i próg na poziomie folderów nadrzędnych.
- **Zmiana reguł skanera** (nowe wykluczenia, dedupe legacy/POLSKA) wygląda jak masowe usunięcie
  i zostanie zablokowana progiem 20 % - to celowe; odblokowuje admin (krok 6).
- **Tombstony rosną**: nie są dziś czyszczone. Czyścić najwcześniej po 180 dniach - bez tombstona
  komputer offline dłużej niż okres czyszczenia mógłby wskrzesić plik jako "nowy".
- **Koszt push**: jedno zapytanie na operację; przy zwykłych różnicach (dziesiątki plików) bez
  znaczenia, przy imporcie i dużych przenosinach folderów - użyć paczek (migracja krok 1).
- **Atrapa to SQLite**, nie PostgreSQL: ta sama treść SQL, ale inny silnik (np. `nextval` zastąpione
  `MAX(rev)+1`, JSONB jako tekst). Przed włączeniem: jeden test na kopii bazy PG (nie produkcyjnej).
