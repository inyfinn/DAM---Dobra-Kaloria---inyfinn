# PROGRESS.md - DAM - Dobra Kaloria - Inyfinn

Ostatnia aktualizacja: **2026-07-21** (v3.1.0 gap ship)

| Obszar | Status | Notatka |
|--------|--------|---------|
| Geex UI + desktop launch | done | skrot DAM - Dobra Kaloria - Inyfinn |
| Auth lokalny (bcrypt) | done | SQLite `users` |
| **Sesja = machine_id + device_id + session_id** | **done** | ADR-008; weryfikacja przed startem |
| SQLite lokalna (repo) | done | `apps/desktop/data/dam-local.sqlite` - ADR-007 amended |
| Global search + tagi | done | Smak/Typ/Opakowanie/Autor |
| Taxonomia Typ vs Smak | done | muffin = Smak; kulki/BAT = Typ |
| Modal wiz + FRONT-S + zoom | done | chip zawsze; repair-viz-thumbs |
| Nosniki PS + admin rename | done | POST /rename-index |
| Audit log | done | `audit_log` w SQLite |
| Deployment docs + release ZIP | done | `docs/DEPLOYMENT.md`, `build-release-zip.ps1` |
| Postgres / Docker | cancelled (user) | opcjonalnie Laravel |
| Entra ID pelne | pending | ADR-006 |
| Wspolna baza na NAS (multi-PC) | **done** | Postgres :5433 ADR-009; DDNS first; OFFLINE=SQLite+hint |
| Naming dictionary (PL nosniki/jezyki) | **done** | V1-V10 PASS; DATE ORANGE = OTHER (do potwierdzenia) |
| Wspolne tagi dam-badges + Warianty | **done** | explorer=wiz; cache vizadm2 |
| Tryb admina (rola + czerwona obwodka) | **done** | pick_thumb, viz-flags, folder-images |
| Dashboard widgety + FMCG + notify | **done** | 24 widgety, layout localStorage, koszt OFF domyslnie |
| Tagi wiz - rozmiary + fix OTHER (Faza 1) | **done** | tokeny pill/badge, brak min-height 44px, kolejnosc tagow |
| Podkategoria PL + zgadywanie typu (Faza 2) | **done** | SUBCATEGORY_PL, carrier_guessed, audyt PL znakow |
| Alias produktow DK<->GC (Faza 2) | **done** | product-aliases.json, seed owies-miod<->cornflakes |
| Naprawa MATERIALY->PROJEKT (Faza 3) | **dry-run only** | 16 kandydatow (6 DK/10 GC), czeka na `--apply` po zgodzie |
| Moderacja tagow - kolejka 72h (Faza 4) | **done** | tag-proposals.json, panel w settings.html, carrier-types.json |
| Modal: aliasy w pasku wariantow (Faza 5) | **done** | withAliasItems(), jezyki wyszarzone + zglos zapotrzebowanie |
| Zgloszenia wielokanalowe + inbox (Faza 6) | **done (stub email/Teams/Asana)** | POST /viz-request, inbox.html, notification-groups.json |
| X / Wstecz UX audyt (Faza 6) | **done** | dam-modal-x, goBackNav() zamyka overlay zamiast nawigowac |
| Auth rehydrate (bound-session) | **done** | POST /auth/rehydrate; bez fake sesji z localStorage |
| Sidebar active + bez underline | **done** | aria-current + Geex purple; cache navActive1 |
| Dashboard â€žDostosuj pulpitâ€ť UX | **done** | DnD, preview 350ms, dirty guard, fioletowe checkboxy |
| Inbox copy + dam-inbox.js | **done** | ludzki podtytul; 72h reminder w copy |
| OAuth stub Asana/MS Graph | **done** | oauth_integrations.py + env.example |
| Strony prawne / security docs | **done** | privacy, terms, license, consents, docs-security |
| Dump Postgres w DATABASE/ | **done** | sync godzinowy NAS + sync-database-backups-to-git.py |
| Branding: POLSKA + archiwum, dedup, folder context | **done** | 49252 assetow; modal warianty + produkty; disc8 |
| Branding: tagi Slidery / Na sklep / Szkoła / Edytowalny | **done** | brand_tag_utils + brand_folder_context + testy |
| **Branding hub UI overhaul + marketing ID (2026-07-19)** | **done** | M-VID/KV…, modal wideo, karty viz-style, PNG domyślnie transparent (UI) |

## Feature: Branding hub UI + marketing ID (2026-07-19)

**Cache bust:** `hub20260719trans01` (JS taxonomy/badges/branding), `hub20260719ui05` (modal/marketing-id/CSS).

### Co wdrożono
- **ID marketingowe** (`dam-marketing-id.js`): format `M-{TYP}{nr}{id}-{MM}-{RR}`; w UI kart i modala; wewnętrzny `br-*` bez zmian.
- **Modal podglądu** (`dam-media-preview.js`): hero wideo 16:9/9:16/1:1 + play; ścieżka monospace z scroll; warianty placeholder; `#damMediaPreviewTitleMeta` margin-top 10px; `.dam-viz-modal__actions` margin-bottom 15px.
- **Karty branding** (`dam-branding.js` + CSS): układ jak viz (Podgląd / folder / share), tytuł +10%, padding body, gradient tile (`dam-hub-shared.css`).
- **Zoom wiz** 50–250% (`dam-viz.js`, `visualizations.html`); miniatury viz scale 1.2.
- **Przezroczyste tło:** skan pikseli (217 assetów www w indeksie) + **PNG/WebP bez skanu = domyślnie transparent** w UI (`dam-asset-taxonomy.effectiveBackground`, instrukcja `branding.png_default_transparent`).
- **Filtry tagów:** liczniki globalne vs zakładka; chip „Przezroczyste tło” aktywny (nie disabled).
- **Desktop:** silent DB sync (VBS/tray), assoc-edit, product-correlation, bridge preview PSB/PNG.

### QA 30-pass (Branding, 2026-07-19 ~19:10)
| # | Obszar | Wynik |
|---|--------|-------|
| 1 | Ładowanie indeksu, 120 kart Kampanie | PASS |
| 2 | Skrypt `dam-branding.js?v=hub20260719trans01` | PASS |
| 3 | `DamAssetTaxonomy.isEffectiveTransparent` | PASS |
| 4 | Chip „Przezroczyste tło” nie disabled | PASS |
| 5 | Filtr transparent → 17 kart (vs 120 bazowych) | PASS |
| 6 | br-004000 scanned transparent | PASS |
| 7 | br-006165 PNG bez bg → eff transparent | PASS |
| 8 | Marketing ID br-006165 → M-KV106165-04-25 | PASS |
| 9 | Marketing ID br-006305 → M-VID606305-01-25 | PASS |
| 10 | Modal: meta margin-top 10px | PASS |
| 11 | Modal: actions margin-bottom 15px | PASS |
| 12 | Modal: ścieżka monospace + scroll | PASS |
| 13 | Modal: marketing ID w meta | PASS |
| 14 | Karty: `.dam-viz-card__actions` + „Podgląd” | PASS |
| 15 | Karty: marketing ID M- w HTML | PASS |
| 16 | Tytuł karty font-size 15.4px (~+10%) | PASS |
| 17 | Zakładka Social (0 kart — brak assetów/filtr) | INFO |
| 18 | Zakładka WWW (0 kart w teście) | INFO |
| 19 | Zakładka Packshoty 120 kart | PASS |
| 20 | Wyczyść filtry | PASS |
| 21 | Wariant placeholder w modalu | PASS |
| 22 | Assoc footer „Brak skojarzonych” | PASS |
| 23 | program-instructions marketing_asset_id_format | PASS |
| 24 | program-instructions png_default_transparent | PASS |
| 25 | Badge „Przezroczyste tło” na karcie (modal tags) | PASS |
| 26 | Filtr „Tło białe” (120 — brak white w Kampaniach) | INFO |
| 27 | Sortowanie combobox obecny | PASS |
| 28 | Tylko grafiki checkbox | PASS |
| 29 | Screenshot modal KV (Read vision) | PASS |
| 30 | Screenshot siatka Kampanie | PASS (modal overlay w części testów) |

**Screenshoty QA:** `qa-pass-modal-kv6165.png`, `qa-pass30-kampanie-full.png` (temp Cursor screenshots).

### Backup / rollback
- Tag git przed commitem: `backup/2026-07-19-pre-branding-ui-overhaul` → stan `origin/main` sprzed tego commita.
- Tag po commicie: `feature/2026-07-19-branding-ui-overhaul` → pełny zestaw zmian.

## Uruchomienie dla usera

1. Skrot **DAM ETA** na pulpicie.
2. Launcher sprawdza ID maszyny (ADR-008).
3. Baza online = Postgres `inyfinn.synology.me:5433` (DDNS). Offline = lokalny SQLite + dump `DATABASE/`.
4. ROOT plikow: Ustawienia -> folder Marketing.

Postgres zyje na Synology (Docker). User nie instaluje Dockera na PC.

## 2026-07-20 - Usability UI pack (commit)

Pakiet rownoleglych agentow (Viz toolbar admin changelog, Branding page-size OK, Help restart, sidebar morph, device paths, tutorial C4, integracje/FMCG/danger) zweryfikowany w kodzie; docs + push na `main`. Szczegoly: `process.md`, `agents/shared/usability-brief-2026-07-20.md`.


## 2026-07-20 - Zaleglosci Explorer create + backlog A3/B5/C2/C3/rest

- Explorer: create category/product (most + modal dry-run/confirm); cache expb20260720b
- A3 FMCG seed kwot + map v2; C2 ERP stub; C3 bento freeze; B5 dashboard QA; B3/B4/B7
- A1/A2 OAuth nadal otwarte (credentials user)
- Lekcja doktryny: kolizja nazw WORKER A/B/C
- Checklista: A3/B3/B4/B5/B7/C2/C3 [x]

## 2026-07-20 - Sesja wieczorna: motion, sidebar, lifecycle, docs + push

**Commity:** `e28a4bd` (backlog + create stub), `025aad3` (B5 QA), docs `release-2026-07-20-evening.md`

| Obszar | Status | Cache / pliki |
|--------|--------|---------------|
| Skeleton + reveal global | done | `skel20260720a`, costs/integrations/invoices/branding/viz |
| Sidebar logo/meta collapsed | done | `sidebaridentity20260720b` |
| Explorer Historia statusów | done | `lifehist20260720a`, PI `lifecycle.history_restore` |
| Dashboard B5 layouts | done | `b5qa20260720f` |
| Explorer create modal (podst.) | done | `expb20260720b`, `explorer_create.py` |
| Explorer create modal redesign | **done** | `expc20260720d`, undo-create, add-variant-type |

Pełna mapa: [`agents/shared/release-2026-07-20-evening.md`](agents/shared/release-2026-07-20-evening.md)

## 2026-07-21 — v3.1.0 gap ship

| Obszar | Status | Notatka |
|--------|--------|---------|
| Viz modal parity (INDEX, show-all, tint, actions) | **done** | Worker A Pass 12/12 |
| Branding WARIANTY raster-only + noSrcGrid | **done** | PSD only SourceMount |
| Shift-minus −20% global + Shift-gate | **done** | 21px bubble |
| UTF-8 PL chrome (Pokaż/Włącz) | **done** | Worker B |
| UK→GB naming-dictionary | **done** | uk≠Ukraina |
| Audyt | **done** | gents/shared/gap-audit-2026-07-21.md |

## 2026-07-22 - Integracja i produkcja + Faktury (mail Outlook)

| Obszar | Status | Notatka |
|--------|--------|---------|
| Menu Integracja i produkcja | **done** | i18n/shell |
| Stany rekawkow (sleeve-stock) | **done** | parser XLSX + panel + tagi |
| Kosztorys Asana → FV | **done** | production-cost-catalog |
| Panel wysylki 4 sekcje | **done** | Kubara + 509012414 |
| Outlook draft + PDF/ZIP | **done*** | COM wymaga Outlooka usera; fallback ZIP Pass |
| Release notes | **done** | agents/shared/release-2026-07-22-integracja-produkcja.md |

\* COM abort w sesji agenta - nie blokuje Fazy B (guardrail planu).
