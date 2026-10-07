-- Etap 1a, krok K2: kolumny "widziane na M:", "brakuje od", "sprawdzony o", partia usuniecia, "wersja u autora".
-- Wersja 2 (07.10.2026). Sprawdzone na bazie TESTOWEJ dam_eta_test (work/2026-10-07/etap1/), NIE WYKONANE na produkcji.
--
-- Wlasciwosci:
--   * idempotentny (IF NOT EXISTS), addytywny, zadna istniejaca kolumna ani indeks nie sa zmieniane;
--   * PostgreSQL 16.14 (zmierzone): ADD COLUMN bez DEFAULT i bez NOT NULL to zmiana samych metadanych,
--     tabela (85 599 wierszy, 143 MB) nie jest przepisywana;
--   * ALTER TABLE bierze blokade ACCESS EXCLUSIVE na czas milisekund; lock_timeout 5 s sprawia, ze skrypt
--     odpuszcza zamiast kolejkowac sie za dluga transakcja (i wstrzymywac za soba wszystkich czytajacych);
--   * indeksy czesciowe: w chwili tworzenia zaden wiersz nie spelnia warunku, budowa trwa ulamek sekundy
--     (blokada SHARE: odczyty ida, zapisy czekaja przez ten ulamek);
--   * klienci 2.5.x i 2.6.0 nie widza nowych kolumn: wszystkie ich instrukcje wymieniaja kolumny jawnie
--     (asset_sync.py:686-735, asset_repo.py:312-324, dam_thumb_cache.py:2273, index_authority.py:216).
--
-- Wartosci poczatkowe dla istniejacych wierszy: NULL we wszystkich nowych kolumnach.
--   origin NULL          = wiersz sprzed etapu 1a, jeszcze nie rozstrzygniety
--   master_seen_ms NULL  = zaden komputer z M: nie potwierdzil tego pliku wedlug nowych regul
-- Kto je ustawia: patrz spec/etap-1.md, rozdzial 2.3.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE dam_assets
  ADD COLUMN IF NOT EXISTS origin           text,    -- 'm' = widziany na M:, 'copy' = znany tylko z kopii, NULL = sprzed 1a
  ADD COLUMN IF NOT EXISTS master_seen_ms   bigint,  -- zegar BAZY: kiedy komputer z M: ostatnio potwierdzil te wersje
  ADD COLUMN IF NOT EXISTS master_mtime     bigint,  -- data pliku na M: (surowa, bez przyciecia)
  ADD COLUMN IF NOT EXISTS master_size      bigint,  -- rozmiar na M: w bajtach (NULL do czasu, az skaner zacznie go podawac)
  ADD COLUMN IF NOT EXISTS missing_since_ms bigint,  -- "brakuje od": zegar BAZY z pierwszego stwierdzenia braku na M:
  ADD COLUMN IF NOT EXISTS checked_ms       bigint,  -- "sprawdzony o": zegar BAZY z ostatniej sondy tego pliku (takze dzierzawa)
  ADD COLUMN IF NOT EXISTS delete_batch     text,    -- partia, w ktorej wiersz dostal znacznik usuniecia (cofniecie jednym poleceniem)
  ADD COLUMN IF NOT EXISTS author_mtime     bigint,  -- "wersja u autora": data pliku na kopii
  ADD COLUMN IF NOT EXISTS author_size      bigint,
  ADD COLUMN IF NOT EXISTS author_by        text,    -- komputer autora (nazwa jak w dam_authority_machine_of)
  ADD COLUMN IF NOT EXISTS author_seen_ms   bigint;  -- zegar BAZY z ostatniego zgloszenia autora

-- NOT VALID: bez przegladu tabeli; nowe zapisy sa sprawdzane od razu. Calosc zatwierdza 05-po-uzgodnieniu.sql (po K6).
-- Dodawane tylko, gdy go nie ma: ponowne wykonanie tego pliku nie cofa pozniejszego VALIDATE.
DO $chk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'dam_assets_origin_chk' AND conrelid = to_regclass('dam_assets')) THEN
    ALTER TABLE dam_assets ADD CONSTRAINT dam_assets_origin_chk
      CHECK (origin IS NULL OR origin IN ('m', 'copy')) NOT VALID;
  END IF;
END
$chk$;

-- wiersze czekajace na drugie sprawdzenie (zwykle 0, przy uzgodnieniu ok. 10 tys.)
CREATE INDEX IF NOT EXISTS dam_assets_missing_idx
  ON dam_assets (missing_since_ms) WHERE missing_since_ms IS NOT NULL AND deleted_at IS NULL;
-- partie usuniec (lista partii i cofniecie)
CREATE INDEX IF NOT EXISTS dam_assets_batch_idx
  ON dam_assets (delete_batch) WHERE delete_batch IS NOT NULL;

COMMIT;

-- Cofniecie kroku K2 nie jest potrzebne do powrotu do starego zachowania (kolumn nikt nie czyta).
-- Gdyby mialy zniknac: DROP INDEX dam_assets_missing_idx, dam_assets_batch_idx; ALTER TABLE dam_assets DROP COLUMN ... (11 kolumn).
-- To operacja nieodwracalna (gubi "widziane na M:"), wiec nie ma jej w skrypcie wycofania.
