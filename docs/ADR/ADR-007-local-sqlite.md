# ADR-007 - Baza SQLite w repo (bez Dockera)

Status: Accepted (amended 2026-07-18 #2)  
Date: 2026-07-18  
Supersedes (desktop runtime): wymog Postgres/Docker z ADR-001 dla codziennej pracy uzytkownika

## Context

DAM ETA to aplikacja desktopowa (skrot na pulpicie). Uzytkownik marketingu nie bedzie:
- instalowal Dockera,
- uruchamial Postgresa / MySQL jako osobnej uslugi,
- konfigurwal portow baz danych.

**Ograniczenie operacyjne (2026-07-18):** agent / build **nie ma prawa** tworzyc katalogow ani plikow na udziale Marketing (np. `X:\Marketing\.dam-eta`) bez jawnego polecenia. Marketing = zrodlo assetow (skan read-only / operacje plikowe po zgodzie), nie miejsce na metadata aplikacji.

## Options Considered

### A: PostgreSQL (portable / Docker)
- Pros: FTS, Laravel-native, skalowanie serwerowe
- Cons: osobny proces, Docker lub tooling na dysku

### B: SQLite na udziale Marketing (`{Marketing}/.dam-eta/…`)
- Pros: jeden plik widoczny dla wszystkich na udziale
- Cons: **odrzucene** - zapis poza repo bez zgody; zanieczyszcza Marketing

### C: SQLite w repo `apps/desktop/data/` (wybrane)
- Pros: wszystko w zakresie repo; dziala gdy Marketing offline; zero Dockera
- Cons: baza jest lokalna per instalacja (nie auto-sync miedzy PC) - OK na etapie MVP

## Decision

**Desktop runtime = SQLite** w:

`apps/desktop/data/dam-local.sqlite`

- `users` + `device_sessions` (auth)
- `audit_log` (kto / akcja / sciezka / kiedy)
- Plik w `.gitignore` (`apps/desktop/data/*.sqlite`)

Migracja jednorazowa (read-only z Marketing): jesli istnieje stary
`{Marketing}/.dam-eta/dam-shared.sqlite`, skopiuj do `dam-local.sqlite`, potem katalog
`.dam-eta` na Marketing **usun** (nie tworzyc ponownie).

WAL + `busy_timeout=60000`.

Postgres / Docker **nie sa wymagane** do uruchomienia DAM ETA.

## Consequences

- Bridge i launch uzywaja SQLite **tylko w repo**.
- Indeks plikow (`file-index.json` / `search-index.json`) zostaje w `apps/web/data/` - UI i wyszukiwanie dzialaja offline wzgledem dysku, dopoki indeks jest zbudowany.
- Pliki z dysku (otwieranie folderow, thumbs live) wymagaja mostu + podlaczonego Marketing.
- Wspolna baza dla wielu PC na udziale Marketing = osobna decyzja (ADR przyszly), nie domyslny zapis na X:.
