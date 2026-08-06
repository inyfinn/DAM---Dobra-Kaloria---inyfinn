# HANDOFF — Branding / Quiz / Viz (2026-08-06) — NASTĘPNA TURA = NAPRAWA

**HARD:** Jakakolwiek wiadomość użytkownika w następnej sesji / następnym agencie
dotycząca Brandingu, Quizu skojarzeń, Wizualizacji, miniatur Datesy, mapowania
skojarzeń albo „napraw” = **kontynuuj naprawę z listy NIE OK poniżej**.
Nie zamykaj jako done bez runtime screenshot+Read (Ctrl+F5).

## OK (zrobione w kodzie, commit tej sesji)

1. Podwójne ładowanie Brandingu: head nie bierze już PDF z pustym asset_role;
   klient odrzuca „dokumentowy” head; `branding-grid-head.json` przebudowany (grafiki).
2. Tytuły kart: nazwa pliku, nie folder-kubełek (`01- CHŁODZONE`, `02 – SLIDERY…`).
3. Quiz `#damAssocQuizOpen`: tylko admin + toggle Admin; sync widoczności;
   pusty pending SQLite → fallback z siatki + jasny copy (nie „Kolejka pusta” bez sensu).
4. Viz: lepszy wybór thumb w grupie + onerror → `/media`; Datesy 690000x thumbs
   istnieją na dysku (HTTP 200) — **UI po Ctrl+F5 jeszcze NIE zweryfikowane screenshotem**.

## NIE OK / DO NAPRAWY (następny krok)

1. **Runtime QA brak:** brak screenshot+Read Branding + Viz + Quiz po Ctrl+F5.
2. **Mapowanie RT / sugestie AI:** brak pełnego pipeline skan → `asset_product_links`
   pending → prawdziwe propozycje w quizie (jest tylko fallback z siatki).
3. **Wizualizacje „Brak miniatury”:** jeśli po Ctrl+F5 nadal widać placeholder na
   Datesy/Karmel/Lemon — rebuild thumbs / ścieżka `cardThumbSrc` / serwowanie.
4. **Krytyk Task:** sesja bez pełnego critic subagenta (limit) — przy ryzyku powtórz `/reflect`.

## Stop

- Nie ładować fat `branding-index.json` (~340MB) na hot path UI.
- Live kod: `bin\apps\web`; git track: `apps\web` — sync przy commit.

## Pliki kluczowe

- `apps/web/assets/js/dam-branding.js`
- `apps/web/assets/js/dam-assoc-quiz.js`
- `apps/web/assets/js/dam-viz.js`
- `apps/web/scripts/build-branding-grid-index.py`
- `apps/web/data/branding-grid-head.json`
