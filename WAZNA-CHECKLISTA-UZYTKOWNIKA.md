# Ważna checklista użytkownika

Stan na: **2026-07-20** · baza: DAM **v2.0.7** (hub)

Źródło prawdy tej listy. Gdy prosisz o coś, co zahacza o pozycję poniżej, agent ma **przypomnieć** o tej checklistie (krótko: ID + status) i ewentualnie zaproponować odhaczenie / kolejny krok.

Legenda statusu: `[ ]` otwarte · `[~]` w toku · `[x]` zrobione

---

## A. Operacyjne (Ty / admin) — hub ma „żyć”

| ID | Status | Zadanie | Jak / gdzie |
|----|--------|---------|-------------|
| A1 | [ ] | **Asana** — Client ID/Secret → Zaloguj → Synchronizuj | Integracje (`integrations.html`). 2026-07-20 verify: `dam-connection.env` ma tylko PG — brak `DAM_ASANA_CLIENT_ID/SECRET` (user musi uzupełnić) |
| A2 | [ ] | **Microsoft** (Teams/Outlook) — to samo, jeśli potrzebne | Integracje. 2026-07-20 verify: brak `DAM_MS_CLIENT_ID/SECRET` w env |

| A3 | [x] | **FMCG** — wypełnić CSV/Excel wg szablonu i zaimportować (albo ręcznie w katalogu) | 2026-07-20: katalog 45 pozycji z kwotami (seed_estimate PL midpoints + 6 wcześniej ręcznych); `fmcg-cost-import-map.json` v2 mapuje id/label; UI Edytuj w Integracjach. Kwoty realne z drukarni/ERP można nadpisać importem CSV |
| A4 | [x] | **Restart bridge** po zmianach `local_bridge.py` | Zasada w `memory.md` — stosuj przy każdej edycji bridge |

---

## B. Techniczne (Agent)

| ID | Status | Zadanie | Notatka |
|----|--------|---------|---------|
| B1 | [x] | Naprawić **wykrojniki-registry** — parser XLSX nie generuje `row-1` bez `kod`/`nazwa` | 2026-07-20: parser Kubara (oznaczenie/asortyment); rejestr 52 wpisy; panel Wykrojniki↔produkty |
| B2 | [ ] | Import **FMCG XLSX** (`openpyxl`), jeśli plik nie jest CSV | CSV first już jest |
| B3 | [x] | **Miniatury wideo** — twardy fallback gdy poster ffmpeg pada | 2026-07-20: bridge SVG placeholder zamiast 422; JS data-URI + probe `?preview=1` (`dam-branding.js` / `dam-media-preview.js`) |
| B4 | [x] | **Tagi Autor** w Brandingu (Krzysztof / Sylwia itd.) | 2026-07-20: grupa filtrów Autor (`author:*`) — `appearance_tags` + pole `author`/`authors` + path (Highlite) |
| B5 | [x] | Dopiąć **QA dashboardu** — layouty 2×2 / 1×4 / 1×6 + sidebar expanded/collapsed | 2026-07-20: cykl 2x2/1x4/1x6 bez overflow na 1280; inject `#damDashLayoutB5Css` (header wrap, customizer fixed, stack ≤768); screenshot+Read 1280/768/375 |
| B6 | [x] | Ujednolicić **wersję w note/memory** | 2026-07-20: `version.json` + `dam-version.js` + `runtime_config.py` + memory §128 = **2.0.7** |
| B7 | [x] | **Sweep cache-bust** `?v=` na pozostałych stronach dla `dam-brand.css` / `dam-tokens.css` / `dam-grid-reveal.js` | 2026-07-20: activity/billing/consents/docs-security/help/license/privacy/profile/project/settings/terms/signin(+geex) → `?v=bust20260720a` (gdzie asset występuje) |

---

## C. Produkt / architektura (świadomie później)

| ID | Status | Zadanie | Notatka |
|----|--------|---------|---------|
| C1 | [ ] | Pełne **Entra / LDAP** produkcyjne | ADR-006 |
| C2 | [x] | Dwukierunkowy **ERP faktur** | Kontrakt stub 2026-07-20: GET erp-status + POST export; stan invoice-erp-sync.json; UI Faktury Import/Eksport |
| C3 | [x] | Duży redesign **BENTO** siatki kart | 2026-07-20: **freeze anatomii (nie redesign)** — `agents/shared/bento-card-freeze.md` + komentarze FROZEN w CSS; chrome hubów OK |

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
