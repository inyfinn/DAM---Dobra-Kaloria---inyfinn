# Ważna checklista użytkownika

Stan na: **2026-07-20** · baza: DAM **v2.0.7** (hub)

Źródło prawdy tej listy. Gdy prosisz o coś, co zahacza o pozycję poniżej, agent ma **przypomnieć** o tej checklistie (krótko: ID + status) i ewentualnie zaproponować odhaczenie / kolejny krok.

Legenda statusu: `[ ]` otwarte · `[~]` w toku · `[x]` zrobione

---

## A. Operacyjne (Ty / admin) — hub ma „żyć”

| ID | Status | Zadanie | Jak / gdzie |
|----|--------|---------|-------------|
| A1 | [ ] | **Asana** — Client ID/Secret → Zaloguj → Synchronizuj | Integracje (`integrations.html`) |
| A2 | [ ] | **Microsoft** (Teams/Outlook) — to samo, jeśli potrzebne | Integracje |
| A3 | [~] | **FMCG** — wypełnić CSV/Excel wg szablonu i zaimportować (albo ręcznie w katalogu) | UI **Edytuj** (mapowanie + dane ręczne) gotowe w Integracjach; brak pełnego wypełnienia kwot przez Ciebie - A3 nie jest `[x]` |
| A4 | [x] | **Restart bridge** po zmianach `local_bridge.py` | Zasada w `memory.md` — stosuj przy każdej edycji bridge |

---

## B. Techniczne (Agent)

| ID | Status | Zadanie | Notatka |
|----|--------|---------|---------|
| B1 | [x] | Naprawić **wykrojniki-registry** — parser XLSX nie generuje `row-1` bez `kod`/`nazwa` | 2026-07-20: parser Kubara (oznaczenie/asortyment); rejestr 52 wpisy; panel Wykrojniki↔produkty |
| B2 | [ ] | Import **FMCG XLSX** (`openpyxl`), jeśli plik nie jest CSV | CSV first już jest |
| B3 | [~] | **Miniatury wideo** — twardy fallback gdy poster ffmpeg pada | Branding / bridge. Częściowo: wideo w siatce `preload="none"` (mniej połączeń); twardy fallback posteru wciąż do zrobienia |
| B4 | [ ] | **Tagi Autor** w Brandingu (Krzysztof / Sylwia itd.) | Wspomniane, nie zrobione |
| B5 | [ ] | Dopiąć **QA dashboardu** — layouty 2×2 / 1×4 / 1×6 + sidebar expanded/collapsed | Reguła screenshot → Read |
| B6 | [x] | Ujednolicić **wersję w note/memory** | 2026-07-20: `version.json` + `dam-version.js` + `runtime_config.py` + memory §128 = **2.0.7** |
| B7 | [~] | **Sweep cache-bust** `?v=` na pozostałych stronach dla `dam-brand.css` / `dam-tokens.css` / `dam-grid-reveal.js` | Bumpnięte 9 stron (branding, dashboard, index, explorer, inbox, visualizations, costs, integrations, invoices). Reszta (activity, billing, consents, docs, help, license, privacy, profile, project, settings, terms, signin) = do zrobienia |

---

## C. Produkt / architektura (świadomie później)

| ID | Status | Zadanie | Notatka |
|----|--------|---------|---------|
| C1 | [ ] | Pełne **Entra / LDAP** produkcyjne | ADR-006 |
| C2 | [ ] | Dwukierunkowy **ERP faktur** | Poza scope planu hub v2 |
| C3 | [ ] | Duży redesign **BENTO** siatki kart | Zamrożone: `.dam-viz-card`, `.dam-branding-card` (`memory` §123); chrome hubów OK |

---

## Szybkie triggery (kiedy przypominać)

| Temat prośby | Przypomnij ID |
|--------------|---------------|
| Asana, sync, OAuth integracje | A1 |
| Teams, Outlook, Microsoft Graph | A2 |
| koszty FMCG, łańcuch, import katalogu | A3, B2 |
| wykrojnik, registry, `row-N` | B1 |
| poster, miniatura MP4/GIF, ffmpeg | B3 |
| autor, Krzysztof, Sylwia, tagi branding | B4 |
| dashboard widgety, układ 2×2/1×4/1×6 | B5 |
| bump wersji, memory vs version.json | B6 |
| Entra, LDAP, logowanie produkcyjne | C1 |
| faktury ERP, dwukierunkowo | C2 |
| bento karty, redesign siatki assetów | C3 (+ zakaz anatomii kart) |

---

## Jak odhaczać

1. Po zrobieniu pozycji: ustaw `[x]` w tej tabeli + krótka data w `process.md`.
2. Nie kasuj wierszy — zostaw historię.
3. Nowe priorytety użytkownika dopisuj na końcu sekcji A/B/C z kolejnym ID (`A5`, `B7`…).
