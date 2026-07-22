# Release notes — Integracja i produkcja + Faktury (2026-07-22)

Plan: `integracja_produkcja_faktury_c9e97532`

## Faza A — Integracja i produkcja

| Krok | Deliverable | Status |
|------|-------------|--------|
| 0 | PI: `integrations.menu_label`, `sleeve.stock_panel`, `production.asana_costing`, `finance.invoice_mail_outlook` + seed `sleeve-stock.json` / `production-cost-catalog.json` | done |
| 1 | `import-sleeve-stock-xlsx.py` + bridge `GET/POST /sleeve-stock*` + cross-ref | done |
| 2 | `dam-sleeve-stock.js` panel pod wykrojnikami (tagi critical/order_now, import XLSX) | done |
| 3 | Menu rename „Integracja i produkcja” (i18n/shell/HTML/tutorial) | done |

## Faza B — Faktury

| Krok | Deliverable | Status |
|------|-------------|--------|
| 4 | Kosztorys Asana → pozycje (`production-cost-catalog`) w `dam-invoices.js` | done |
| 5 | Panel wysyłki 4 sekcje (odbiorcy Kubara, nr 509012414, wybór FV, Outlook/Kopiuj) | done |
| 6 | `invoice_mail.py` + `POST /finance/invoices/outlook-draft` (admin, Win32 COM) + ZIP/PDF fallback | done* |
| 7 | Docs (`process.md`, `PROGRESS.md`, ten plik) + commit plan-scoped | done |

\* Outlook COM na maszynie agenta zwraca `Operacja przerwana` / server failed — fallback ZIP (CSV+HTML+PDF) + mailto działa (HTTP 200, `fallback=zip_and_mailto`, 3 załączniki w ZIP w tym PDF). Pełny draft Outlook wymaga uruchomionego Outlooka w sesji użytkownika desktop DAM.

## QA live (2026-07-22 ~17:40)

| Check | Wynik |
|-------|-------|
| Tip `19e8c54` na `origin/main` | Pass |
| Bridge api_version 7; sleeve/catalog 401 (auth) | Pass |
| Sleeve panel 29 / critical 8 / `6300578` | Pass (`qa-integracja-sleeve-stock-pass.png`) |
| Mail 4 sekcje gap 24px; Kubara; `509012414` | Pass (`qa-invoices-mail-panel-pass.png`) |
| Asana 3× wizualizacja → 3× 800 PLN | Pass (CDP draft) |

## Endpointy (bridge :8766)

- `GET /sleeve-stock`
- `POST /sleeve-stock/reimport`
- `POST /sleeve-stock/import`
- `GET /production-cost-catalog`
- `POST /finance/invoices/outlook-draft` (admin) — body: `{invoice_ids[], to[], accounting_no, body_note}`

## UI

- `integrations.html` — `#damSleeveStock` pod kolejką wykrojników
- `invoices.html` — `#damInvMailPanel` (4 sekcje, gap 24px)
- Sidebar: „Integracja i produkcja”

## Checklisty użytkownika

- A1 Asana OAuth — nadal `[ ]` (credentials user)
- B1 wykrojniki — `[x]` (rozszerzone o stany rękawków)
- C2 ERP stub — `[x]` (rozszerzone o wysyłkę mailową desktop)

## Pliki kluczowe

- `apps/desktop/invoice_mail.py`
- `apps/desktop/local_bridge.py` (route outlook-draft + sleeve-stock)
- `apps/web/assets/js/dam-invoices.js`, `dam-sleeve-stock.js`
- `apps/web/data/sleeve-stock.json`, `production-cost-catalog.json`
- `apps/web/scripts/import-sleeve-stock-xlsx.py`
