# ADR-012: Jeden właściciel wspólnego katalogu (indeksator), bramka po stronie bazy

Data: 2026-09-28. Status: przyjęte (wdrożenie etapami, patrz niżej). Plan: `work\PLAN-NAPRAWY-DAM-DLA-CLAUDE -2.md`, etap 3.

## Kontekst (pomiar 28.09, odczyt produkcji)

- `dam_meta.asset_index_mode = rows`; `dam_meta.index_authority` - brak klucza (każdy komputer z ROOT publikuje).
- `dam_index_snapshots`: `branding-index` zbudował KINGAUR 24.09 (366 MB), `file-index` KINGAUR 28.09 10:47,
  `branding-search-index` KRZYSZTOFWI. KINGAUR ma ROOT `C:\Marketing` = kopia Synology Drive (może być opóźniona).
- `dam_assets` zapisywały trzy komputery: KRZYSZTOFWI 55 068, KINGAUR 6 528, INYFINN 312 wierszy.
- Skutek: to, co widzą wszyscy, zależy od tego, który komputer ostatnio zeskanował swoją kopię. Stare wersje
  aplikacji (sprzed 27.09) nie znają `index_authority`, więc blokada tylko w nowym kliencie ich nie zatrzyma.

## Decyzja

1. **Właściciel katalogu = lista maszyn w `dam_meta.index_authority`** (`{"machines": [...]}`), na start
   `["KRZYSZTOFWI"]` - komputer z dostępem do oryginałów przez M: (udział administratorkubara, nie kopia Drive).
   To rozwiązanie przejściowe planu (etap 3): gdy powstanie stały indeksator z dostępem do administratorkubara
   (usługa na serwerze), dopisujemy jego nazwę i usuwamy KRZYSZTOFWI - bez zmiany kodu.
2. **Bramka po stronie bazy** (wyzwalacze PostgreSQL, działa także na stare wersje aplikacji), aktywna tylko,
   gdy lista jest niepusta:
   - `dam_index_snapshots`: zapis tylko, gdy `built_by` jest na liście.
   - `dam_assets`: maszyna spoza listy może tylko dodać nowy plik (INSERT) i zmienić żywy wiersz na ściśle
     nowszy `mtime_ms`. Tombstone, przywrócenie, zmiana samego opisu przy tym samym mtime - odrzucone
     (to już dziś jest reguła `index_authority` w nowym kliencie, `asset_sync_runner._sync_cycle_restricted_ops`).
     Nazwa maszyny = `split_part(updated_by, ':', 1)`, porównanie bez wielkości liter.
3. **Klient bez uprawnień nie wygrywa lokalnym plikiem**: `index_snapshots.pull_newer` - reguła
   "lokalny nowszy plik wygrywa" działa tylko dla maszyny z listy (albo gdy listy nie ma - jak dotąd).
4. **Dostarczenie zmian**: tani odczyt `max(rev)` / generacji snapshotów co ~30-60 s zamiast 600 s;
   pełne pobranie tylko przy zmianie.
5. Każdy nadal dodaje i edytuje pliki przez SMB/Drive; nowy plik z komputera bez uprawnień trafia do bazy
   jako `add`. Usunięcie potwierdza właściciel katalogu (jego skan albo jawna operacja).

## Plan powrotu

- Natychmiast: `index_authority.machines = []` (pusta lista = bramka nieaktywna, klient jak przed zmianą).
- Wyzwalacze: `ALTER TABLE ... DISABLE TRIGGER dam_authority_gate_*` (skrypt `enable-index-authority.py --rollback`).
- Kod klienta jest zgodny wstecz (brak klucza = dotychczasowe zachowanie).

## Warunki przed włączeniem na produkcji

- Testy wyzwalaczy i klienta na prawdziwym PostgreSQL (`dam_eta_test`, `run_realpg.py`): czerwone bez bramki,
  zielone z bramką; stary klient (zapis tombstone/snapshotu z maszyny spoza listy) odrzucony; właściciel przechodzi.
- Kopia produkcji przed zmianą (`pg_dump`, `D:\DAM-lokalne\backup\pg\`).
- Ograniczenie znane: gdy KRZYSZTOFWI nie działa, nowe skany i usunięcia czekają; istniejący katalog działa dalej.
