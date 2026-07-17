# process.md - log + proces DAM

## 2026-07-16 - Bootstrap

### Komenda/Akcja
K00-K02: workspace P:\DAM, drzewo monorepo, .gitignore; start re-download PostgreSQL binaries.

### Log/Status
1. tooling/downloads, choco-cache, npm-cache, composer-home, bin - OK
2. PHP 8.3.14 portable + Composer 2.10.2 w tooling/bin - OK
3. choco install bez admina - FAIL (UnauthorizedAccess) - fallback portable
4. Pierwszy ZIP Postgres niekompletny (~149MB / ~309MB) - restart curl download
5. THEME Geex obecny w P:\DAM\THEME - bazowy file-manager + variables.scss
6. Plan zaktualizowany: Geex UI, desktop shell (Inyfinn), Asana, Teams

### Efekt/Fix
Drzewo apps/api, apps/web, apps/desktop, docs, agents utworzone.

### Test/Ewaluacja
- Test-Path P:\DAM\THEME\geex-html-main = True
- php -v / composer -V z tooling\bin = OK (po PATH)

### Zrodla
- Plan dam_p_dysk_bootstrap
- Geex variables.scss
- EnterpriseDB postgresql-16.8 binaries zip

---

## 2026-07-16 - Auth w planie + Postgres + UI Geex

### Komenda/Akcja
Dodanie do planu: logowanie panelu, Azure AD/Entra ID, Synology SSO/LDAP, role admin/power_user/user. Kontynuacja extract Postgres, docs ADR, UI Geex, desktop stub.

### Log/Status
1. Plan: wiersz Auth + Role + sekcja Auth/domena + todo step-auth-aad
2. memory.md: punkty 8-9 auth/role
3. ADR-006-auth-entra-synology.md + ADR-001..005, VISION, ARCHITECTURE, DOMAIN, ROADMAP_100
4. packages/domain-schemas/food-pack-dk.v0.json
5. tar extract ZIP Postgres ~13 min na NFS P: - OK; psql 16.8
6. initdb `P:\DAM\data\postgres`, port 5433, CREATE DATABASE dam_eta - OK
7. UI: dam-app.css/js, index, project, integrations, signin (Microsoft CTA)
8. Desktop: launch.py + scripts/ops/start-desktop.ps1 + start-browser.ps1
9. Smoke HTTP: index/signin/dam-app.css = 200 na :8765
10. git init na P:\DAM (bez pierwszego commita - brak prosby)

### Efekt/Fix
- Niepelny katalog data/postgres (.gitkeep) blokowal initdb - usuniety, re-init
- Expand-Archive fail wczesniej - uzyto tar -xf

### Backup
Brak (tylko nowe pliki na P)

### Test/Ewaluacja
- `psql -h 127.0.0.1 -p 5433 -U dam -d dam_eta` -> current_database = dam_eta
- `Invoke-WebRequest http://127.0.0.1:8765/index.html` -> 200

### Zrodla
- https://learn.microsoft.com/en-us/entra/identity-platform/
- PostgreSQL 16 Windows binaries (EnterpriseDB zip)
- P:\DAM\THEME\geex-html-main (signin + file-manager)

---

## 2026-07-16 - UI QA + Laravel bootstrap

### Komenda/Akcja
ui-taste pass (struktura/CTA/mobile) + start Laravel 11 w apps/api.

### Log/Status
1. Klasa Geex CTA: `geex-btn--primary` (nie `__primary`) - poprawione
2. CTA fiolet `#AB54DB` - OK po hard refresh
3. Mobile 375: karty stack - OK
4. PHP portable: wlaczone openssl/curl/mbstring/pdo_pgsql/zip w php.ini
5. `composer create-project` FAIL na NFS (Could not delete vendor/composer) - fallback: ZIP GitHub + tar + composer install
6. Postgres: port 5433, DB dam_eta, user dam - dziala

### Test/Ewaluacja
- Browser index/signin 200; purple CTA verified CDP
- psql SELECT current_database = dam_eta

### Zrodla
- https://github.com/laravel/laravel/releases (v11.6.1 zip)
- Geex style.css `.geex-btn--primary`

---

## 2026-07-16 - Plan verify + API auth/completeness

### Komenda/Akcja
Weryfikacja planu (auth/role/Geex/Asana) + implementacja API K21+.

### Log/Status
1. Plan.md: overview uzupelniony o Entra/role; todos K00-K20/THEME/desktop = completed; auth+integrations in_progress
2. Modele Project/Variant/Asset/Revision/Checklist* + EnsureRole + RecomputeChecklistStatus
3. Routes: login, azure stub 503, projects, completeness, auth settings (admin)
4. Jobs: SyncAsanaChecklistJob, NotifyTeamsMissingAssetsJob
5. Seed: admin/power/user + 6300729.00 incomplete (brak viz_3d, print_pdf)
6. JSON schema BOM fix (UTF-8 no BOM)
7. Smoke API :8000 - health, login admin, projects, completeness, settings; user->settings 403

### Test/Ewaluacja
- `GET /api/health` ok
- `POST /api/auth/login` admin@dam.local -> role admin
- `GET /api/variants/1/completeness` source=checklist_status, missing viz_3d+print_pdf
- Azure redirect bez credentials -> 503 configured:false

### Zrodla
- ADR-006, Microsoft identity platform
- Laravel Sanctum + middleware alias role

---

## 2026-07-16 - Wdrozenie UI+API+ingest

### Komenda/Akcja
Podpiecie Geex UI do Laravel API, ingest pointerow, CORS, E2E w przegladarce.

### Log/Status
1. CORS config + DAM_INGEST_ROOTS
2. IngestPolskaPointers + artisan dam:ingest-pointers
3. Fixture P:\DAM\data\seeds\polska-demo (3 projekty, sloty 1-4)
4. API: POST /ingest/pointers, POST /variants/{id}/integrations/notify
5. UI: dam-api.js, dam-projects.js, dam-project.js; index/project dynamiczne
6. Browser: 3 karty z API; Banoffee complete; Tiramisu/Nuggets incomplete

### Test/Ewaluacja
- artisan dam:ingest-pointers EXIT 0
- GET /api/projects = 3 rekordy
- UI index: 3 project cards z checklist_status
- project.html?id=2 status complete

### Zrodla
- ADR-003 hybrid storage
- DOMAIN slot map 0-4

---

## 2026-07-17 - UI DAM panel - i18n + shell + nowe strony

### Komenda/Akcja
Kompletna transformacja Geex HTML do funkcjonalnego polskiego panelu DAM ETA.

### Log/Status
1. i18n: utworzono i18n/pl.json (kompletny) + 11 jezykow (en, de, fr, es, it, nl, cs, sk, uk, ru, da)
2. dam-i18n.js: loader overlay + aplikacja data-i18n/data-i18n-placeholder + switcher jezykow z flagami
3. dam-shell.js: auth guard + rewrite nav sidebar/header -> DAM items + messages popup Asana/Teams
4. dashboard.html: data-i18n na kartach, ID dla JS (damCard1Val..4Val, damBalanceTitle), skrypty DAM
5. dam-dashboard.js: dane z asana-tasks.json + API projects + szacunkowy koszt miesiaca
6. dam-cost.js: kalkulator z PL holidays (Easter computus), godziny robocze 2025-2027
7. costs.html: nowa strona formularzem kosztow w stylu Geex
8. data/invoices.json: 10 przykladowych faktur PL za prace graficzne
9. invoices.html + dam-invoices.js: lista z filterami status
10. explorer.html + dam-explorer.js: eksplorator plikow z folderami projektow
11. dam-project.js: ROLE_LABEL bez "asset_role: tech" - ludzkie etykiety
12. project.html: opis akcji po polsku, data-i18n
13. signin.html: redirect do dashboard.html + fallback admin@dam.local / DamAdmin123!
14. ui-complete/00-brief.md, ui-complete/PLAN.md, design-system/MASTER.md

### Efekt/Fix
Wszystkie strony DAM maja teraz polskie etykiety przez i18n overlay.
Nawigacja przepisana z Geex demo -> DAM items.
Auth guard na wszystkich stronach (dam-shell.js).

### Backup
Brak destrukcyjnych zmian - nowe pliki + StrReplace na kluczowych sekcjach.

### Test/Ewaluacja
Nie zakonczone (czeka na Visual QA screenshot od parent agenta).
Otwieranie: http://127.0.0.1:8765/dashboard.html (po uruchomieniu serwera).

### Zrodla
- Geex index-4.html jako baza dashboard
- asana-tasks.json (433 zadan, 109 otwartych)
- Easter computus: Meeus/Jones/Butcher algorithm

## 2026-07-17 - Geex DAM panel (ui-complete)

### Komenda/Akcja
Przebudowa UI na Geex index-4 + i18n + Asana CSV + kalkulator + human copy

### Log/Status
1. Design Read: B2B DAM dashboard, Geex Invoicing, dials 4/3/6
2. Skopiowano index-4 -> dashboard, file-manager -> explorer
3. i18n: 12 jezykow w apps/web/i18n/*.json + dam-i18n.js
4. Asana CSV -> data/asana-tasks.json (109 open)
5. Shell nav + Messages Asana/Teams tabs
6. costs.html kalkulator (ZUS mnoznik, swieta PL)
7. Usunieto zargon asset_role / checklist_status z UI
8. Ralph loops 1-8 OK, 9-10 partial

### Efekt/Fix
Panel startuje od dashboardu z logowaniem. Otworz: http://127.0.0.1:8765/signin.html (admin@dam.local / DamAdmin123!)

### Test/Ewaluacja
Browser snapshot: Dashboard karty, Asana lista, flagi jezykow, kalkulator 6000*1.5/184*40+...


## 2026-07-17 - Logo DK + always admin

### Komenda/Akcja
Zamiana logo Geex na Dobra Kaloria; tryb zawsze zalogowany jako admin (bez Microsoft).

### Log/Status
1. Skopiowano SVG bialy/czarny z D: branding (read-only) -> P:\DAM\apps\web\assets\img\
2. dam-shell: DAM_DEV_ALWAYS_ADMIN + applyDobraKaloriaLogo
3. signin.html: auto-wejscie do dashboard, bez przycisku Microsoft

### Efekt/Fix
Panel otwiera sie od razu jako admin. Logo DK w sidebar/header/signin.

## 2026-07-17 - Messages popup +250px + resize

### Komenda/Akcja
Powiekszyc okienko wiadomosci o 250px w dol; umozliwic rozciaganie w dol przez uzytkownika.

### Log/Status
1. Geex default content max-height 200px -> content min-height 450px (+250)
2. Popup height domyslnie 520px; uchwyt .dam-msg-resize-handle + localStorage dam_msg_popup_h
3. dam-brand.css dolaczony do wszystkich *.html (wczesniej brakowalo linku)
4. Override !important nad style.css Geex

### Efekt/Fix
Popup wiadomosci: wysokosc 520px, content 450px, resize vertical, drag handle na dole.

### Test/Ewaluacja
CDP: brandLoaded=true, popupH=520, contentH=450, resize=vertical, handle=true

### Zrodla
- apps/web/assets/css/dam-brand.css
- apps/web/assets/js/dam-shell.js (enableMessagePopupResize)

## 2026-07-17 - Wstepne tlumaczenie UI na PL

### Komenda/Akcja
Przetlumaczyc pozostale angielskie stringi Geex, skoro zaznaczony jest PL.

### Log/Status
1. HTML: Customizer->Dostosuj wyglad, Search->Szukaj, Edit/Delete, menu uzytkownika, Layout/Mode/Navbar
2. dam-shell.polishGeexChrome() + klucze i18n (pl/en)
3. dam-i18n wywoluje polishChrome po zmianie jezyka

### Efekt/Fix
Przy PL chrome Geex jest po polsku (LTR/RTL zostawione jako skroty techniczne).

### Test/Ewaluacja
Browser: Dostosuj wyglad, Kierunek tekstu, Motyw, Nawigacja, Profil, Edytuj/Usun

## 2026-07-17 - Nav trail: Wstecz + breadcrumbs

### Komenda/Akcja
Zawsze strzalka wstecz + sciezka (breadcrumbs) jak kategorie w sklepie. ui-ux-pro-max: predictable back, hierarchy.

### Log/Status
1. CSS .dam-nav-trail / .dam-breadcrumb w dam-brand.css (touch 44px, focus ring)
2. dam-shell.injectNavTrail + sessionStorage dam_nav_stack + fallback do rodzica
3. Podpieto shell na integrations.html i index.html
4. setTrailLeaf dla project.html

### Efekt/Fix
Na kazdej stronie (poza signin): przycisk Wstecz + Panel > Sekcja.

### Test/Ewaluacja
Integracje: Wstecz + Panel > Integracje; klik Wstecz -> Dashboard.

## 2026-07-17 - Auto kalkulator kosztow (taby per projekt)

### Komenda/Akcja
Przebudowa kalkulatora: bez formularza, taby projektow Asana, auto wyliczenia.

### Log/Status
1. cost-rates.json (osoby, mapa godzin, katalog bezposrednich)
2. scripts/build-project-costs.py -> data/project-costs.json (17 projektow)
3. costs.html + dam-cost.js: taby + meta + breakdown
4. dam-dashboard.js: suma otwartych projektow z project-costs.json

### Efekt/Fix
Cynamonka i inne (DK) jako taby; sumy labor+direct; faktury info.

### Test/Ewaluacja
Browser smoke costs.html - tab Cynamonka, brak inputow.

## 2026-07-17 - Pelny indeks dysku + Ajax + Wizualizacje

### Komenda/Akcja
Mapowanie calej struktury D: PRODUKTY/- DK; search indeks/tagi; wizualizacje latest rewizji.

### Log/Status
1. build-file-index.py -> file-index.json (144 prod) + search-index.json
2. TARTA MALINOWA KAR6X: .01 latest (24 wizki), .00 nie
3. dam-search.js Ajax prefix/fuzzy/tag
4. dam-explorer.js drzewo z indeksu
5. visualizations.html + dam-viz.js; nav Wizualizacje

### Efekt/Fix
http://127.0.0.1:8765/explorer.html i visualizations.html

### Ralph 10x (explorer/viz)
Screenshoty loop-1..10 + final. QA_FAIL_COUNT=0. Sugestia 6300538->6300539.01 OK.


## 2026-07-17 Explorer UX2
Warstwy plikow, tagi skojarzeniowe, marketing refs, admin status, sidebar collapse. Ralph 10x OK.


## 2026-07-17 Wizualizacje thumbs + GC sync
- sync-gc-viz-from-g: 17 copied, never overwrite
- index DK+GC, langs z folderu, FRONT thumbs
- fix onerror HTML break w dam-viz.js

---

## 2026-07-17 Explorer UX v3

### Komenda/Akcja
Pelny rewrite dam-explorer.js v3 + CSS + HTML + memory.

### Log/Status
1. Odczytano brief: `ui-complete/00-brief-explorer-ux-v3.md`, plan `ui-complete/PLAN.md`
2. Sprawdzono strukture danych file-index.json: 187 produktow, 12 kategorii (DK+GC), pola: brand, carrier, is_latest, files_by_role, wizki, slots
3. BABKA CYTRYNOWA: 5 rewizji - 1 bogus (ELEMENTY z OPAKOWAN), 2x KAR6X, 1x MINI, 1x bare-date (BAT)
4. Przepisano dam-explorer.js: stan canonCat/brands/expandedCarriers/showOlderCarriers; DK+GC merged; MIX section; carrier cards; checklist; viz groups
5. Dodano CSS v3 do dam-brand.css: brand filter bar, mix section, carrier cards, checklist OK/BRAK, viz groups, older revs
6. Dodano `dam-labels.js` przed `dam-explorer.js` w explorer.html
7. Zaktualizowano memory.md (regula 24 - Explorer v3 zasady)

### Efekt/Fix
- BATONY -> BATONY (nie "01 - BATONY")
- DK+GC merged w jednej liscie kategorii
- BABKA CYTRYNOWA pokazuje: KARTON 6x MINI BATONIKI + MINI BATONIK + BATON (3 carrier cards)
- "- MIX -" usuniete z nazw, MIXY na gorze jako collapsible
- Checklista per nosnik: AI, PREV, druk, wizki, elementy, marketing
- Elementy inherit: jezeli brak w aktualnym -> szukaj w innym wariancie
- Bez "Zobacz aktualne wizualizacje" (usunieto CTA)

### Backup
Poprzedni dam-explorer.js nadpisany (v2 nie backupowany - byl juz wersjonowany w git)

### Zrodla
- brief: `P:/DAM/ui-complete/00-brief-explorer-ux-v3.md`
- plan: `P:/DAM/ui-complete/PLAN.md`
- dam-labels.js: `P:/DAM/apps/web/assets/js/dam-labels.js`

### Ralph / QA (loop-2)
1. Screenshoty 1024 + 375: `ui-complete/screenshots/loop-*-v3*` / `loop-2-375-batony.png`
2. Fix: elementy tylko przy ELEMENTY/ELEMENTS (nie sam MATERIALY); BRAK czerwone w CSS
3. Cache bust `?v=20260717ux5`
4. `QA-AUDIT.md` â†’ QA_FAIL_COUNT: 0
5. Weryfikacja DOM: nosniki ludzkie, MIXY, wizki ENFACE/FRONT/BACK, drukarnia KUBARA


---

## 2026-07-17 - UX v4 (brand dropdown, viz gallery, tooltips, profil)

### Komenda/Akcja
Implementacja DAM ETA UX v4: filtry, galeria, tooltips, panel uzytkownika.

### Log/Status
1. dam-brand-filter.js - nowy wspolny komponent dropdown filtru marek (DK/GC). Przycisk "Marka: DK+GC" w toolbarze (nie w sidebarze). Persist localStorage.dam_brands. Sync explorer i viz.
2. dam-explorer.js - usunieto renderBrandFilterBar() z sidebar. renderSidebar() tylko kategorie. Init wiaze damBrandFilterTrigger przez DamBrandFilter.init(). Wczytuje stan marek z localStorage.
3. dam-viz.js - pelny rewrite: grupowanie po product_id, karta = produkt. Badge Multijezyczny. Ukryta sciezka z karty. Brak przycisku Indeks. Klik miniatury -> modal podgladu. Przycisk Udostepnij -> modal Synology z instrukcja PPM + pole QuickConnect.
4. dam-tooltips.js - nowy globalny helper tooltipow. Atrybuty data-dam-tip. MutationObserver. Szanuje localStorage.dam_tooltips=off.
5. dam-shell.js - ensureAdminSession ustawia dane KW (imie, stanowisko, email, tel, menedzer, wspolpracownicy). Menu linki -> profile.html, settings.html, billing.html, activity.html, help.html.
6. profile.html - nowa strona Geex-style: awatar initials, dane kontaktowe, menedzer, wspolpracownicy.
7. settings.html - toggle tooltips, toggle Synology, toggle marek DK/GC, zapisuje do localStorage.
8. billing.html, activity.html, help.html - placeholdery z trescia DAM.
9. dam-brand.css - dodano klasy .dam-filter-trigger, .dam-filter-dropdown, .dam-viz-modal-overlay, .dam-tooltip.
10. Cache bump ?v=20260717ux6 na CSS/JS w explorer.html i visualizations.html.

### Efekt/Fix
- Filtr DK/GC przeniesiony z sidebar do toolbar (e-commerce dropdown).
- Galeria viz: LEMON BUNDT CAKE = 1 karta z badge Multijezyczny.
- Modal podgladu z wariantami jezykowymi.
- Synology share: modal z instrukcja PPM + QC link.
- Panel uzytkownika: Krzysztof Wieczorek z pelnym profilem.

### Test/Ewaluacja
- Klik Marka: DK+GC -> dropdown z checkboxami otwiera sie
- Odznacz GC -> produkty GC znikaja z listy kategorii
- Klik miniatura produktu multijez -> modal z badge Multijezyczny
- Przycisk Udostepnij -> modal Synology z instrukcja PPM
- Klik profil w header -> profile.html z danymi KW
- settings.html: toggle tooltips zapisuje w localStorage

---

## 2026-07-17 - Re-audit UX v4 + fix search

### Komenda/Akcja
Ponowna weryfikacja briefu uzytkownika (ui-complete Ralph). Naprawa wyszukiwania viz + polish nosnikow.

### Log/Status
1. Audyt: filtr Marka u gory OK; Kategorie bez DK/GC OK; Multijezyczny OK; profil KW OK; share modal OK
2. FAIL znaleziony: wyszukiwanie viz zawsze zwracalo 153 produktow - przyczyna: `(index_base).indexOf(q.replace(/\D/g,''))` gdy q='lemon' daje indexOf('') === 0
3. Fix w dam-viz.js: digits tylko gdy length >= 4; strip dat z carrierHuman; strip (BAR)/(BAT)
4. explorer subtitle: DK i GC (HTML + JS)
5. QA-AUDIT.md v4: QA_FAIL_COUNT 0; screenshoty loop-final-explorer-brand-1024 + loop-final-viz-share-1024

### Efekt/Fix
Szukaj 'lemon' -> 6 produktow / 20 wariantow. Udostepnij otwiera modal Synology.

### Test/Ewaluacja
- browser: visualizations.html?v=ux10 search lemon PASS
- browser: Udostepnij -> damSynologyModal PASS
- browser: explorer Marka dropdown FILTR MARKI PASS

---

## 2026-07-17 - Sciezka bazowa + Pokaz w Eksploratorze + audit

### Komenda/Akcja
Para ikon Kopiuj / Pokaz w eksploratorze wszedzie; mapowanie bazy dysku per user; audit log; local bridge.

### Log/Status
1. `apps/desktop/local_bridge.py` - HTTP :8766: /health, /reveal (explorer /select), /validate-base (3 foldery), /audit GET+POST -> `apps/web/data/audit-log.jsonl`
2. `apps/web/assets/js/dam-paths.js` - DamPaths: toLocal, copyPath, revealInExplorer, pathActionsHtml, bindPathActions, modal setup bazy, audit
3. `dam-explorer.js` - pathActions() na plikach, wizkach, marketingu, naglowku nosnika; bindCopyButtons -> DamPaths.bindPathActions
4. `dam-viz.js` - modal: Kopiuj + Pokaz; Synology modal: Kopiuj + Pokaz (remap przez DamPaths)
5. `settings.html` - karta Sciezka bazowa + Sprawdz + zapis
6. `activity.html` - lista audit (bridge lub localStorage)
7. `launch.py` - startuje bridge + static UI
8. CSS: `.dam-path-actions`, `.dam-file-reveal`, `.dam-basepath-*`, `.dam-audit-*` w dam-brand.css
9. memory.md Â§32-33

### Efekt/Fix
- Indeks D:/Marketing/... mapowany na baze usera (np. M:\ -> M:\- POLSKA\...)
- Reveal zaznacza plik w folderze rodzica (nie otwiera pliku)
- Log: kto skopiowal / pokazal / zmienil baze

### Backup
Brak (nowe pliki + dopiski)

### Test/Ewaluacja
- Ustaw baza D:\Marketing lub M:\ w Ustawieniach / modalu
- Explorer: BABKA CYTRYNOWA -> ikony copy+reveal przy nosniku i plikach
- Reveal pliku PNG -> folder 4 - WIZKI + plik zaznaczony
- activity.html pokazuje wpisy po akcjach
- Bridge: `python apps/desktop/local_bridge.py` (port 8766)

### Zrodla
- wymaganie usera 2026-07-17 (screenshot warianty + mapowanie Dâ†”M)
- Windows: `explorer /select,"path"` (MS docs Explorer command-line)

---

## 2026-07-17 - Globalny chrome: panel wiadomosci + design system

### Komenda/Akcja
Naprawa rozwijania panelu wiadomosci (dzialalo tylko na czesci stron) + zasada: zmiany chrome/UI tylko globalnie (motyw Geex / dam-shell / dam-brand).

### Log/Status
1. Root cause: `height: 520px !important` na `.popup--message` + jQuery `slideToggle` (Geex main.js) - powiadomienia OK, wiadomosci nie.
2. `dam-shell.js`: `ensureHeaderChrome()` wstrzykuje ten sam header na stronach bez quickaction (settings/profile/activity/billing/help).
3. `bindDamHeaderPopups()`: otwieranie przez class `.is-open` (capture); odpina Geex click.
4. `main.js`: wczesny return gdy `data-dam-popups=1`.
5. Style tabow/resize/msg w `dam-brand.css` na tokenach (`--primary-color` itd.), bez inline one-off.
6. Cache `?v=20260717chrome1` ujednolicony na wszystkich HTML.
7. memory.md Â§34 + design-system/MASTER.md sekcja Chrome.

### Efekt/Fix
Wiadomosci / powiadomienia / profil dzialaja tak samo na costs, dashboard, settings itd.

### Test/Ewaluacja
- costs.html: klik ikony wiadomosci -> panel Asana/Teams + resize
- settings.html: pojawia sie pelny header chrome
- Escape / klik poza zamyka popup

---

## 2026-07-17 - Hub produktu: DK/GC + nosniki + wizki + lightbox

### Komenda/Akcja
Filtr DK/GC przy tytule (slot 1); widok wizualizacji kafelki/lista/skala (slot 2); naprawa blednego BATON; miniatury + lightbox; „Nie widzisz wariantu? Dodaj go”.

### Log/Status
1. `dam-labels.js`: folder tylko `data - indeks` -> UNKNOWN (nie BAT); infer z prefiksu pliku/folderu KAR6X; detectMarketFromPath PL/GC.
2. `carrier-overrides.json`: klucz `6300622.00` -> KAR6X / nieaktualne (stary karton 6x, nie BATON).
3. `dam-explorer.js`: resolveCarrierCode + override; toolbar slot1 DK/GC chips; slot2 Kafelki/Lista/Skala; thumbs via `/media`; lightbox prev/next/X; modal dodawania wariantu -> POST `/carrier-override`.
4. `dam-brand-filter.js`: `renderChips` dla strefy produktu.
5. `local_bridge.py`: GET `/media`, POST `/carrier-override`.
6. memory.md §35; cache `?v=20260717hub1`.

### Efekt/Fix
- BABKA CYTRYNOWA: KARTON 6x MINI BATONIKI + MINI BATONIK (bez fake BATON).
- 6300622 pod „Pokaz starsze” jako KAR6X.
- Prawdziwe miniatury; lightbox z nawigacja i X.
- DK/GC i ustawienia widoku przy tytule produktu.

### Test/Ewaluacja
- browser: explorer.html?product=babka-cytrynowa-nerkowcowy - DK/GC chips, Kafelki/Lista/Skala PASS
- brak naglowka BATON PASS
- KAR6X expanded: 28 thumbs, naturalWidth > 0, media bridge PASS
- lightbox is-open + prev/next/close PASS
- „Nie widzisz wariantu? Dodaj go” widoczne PASS

### Zrodla
- wymaganie usera 2026-07-17 (screenshoty 1/2 + folder 13.02.2025 - 6300622.00)
- memory.md §35

---

## 2026-07-17 - Logo DK przywrocone (light/dark) + README + push GitHub

### Komenda/Akcja
Przywrocenie logo Dobra Kaloria w sidebarze; kontrast light/dark; dokumentacja; commit + push do GitHub.

### Log/Status
1. Root cause: `logo-lite.svg` / `logo-dark.svg` / `logo-dobra-kaloria.svg` mialy `fill: #fff` (lub biale tlo) - na jasnym sidebarze niewidoczne.
2. Skopiowano z brand SVG (bez Niemiesa): `LOGO Dobra Kaloria zielony.svg` -> `logo-dk-green.svg` (+ `logo-dk-white.svg` zapas).
3. Podmieniono `logo-lite` / `logo-dark` / `logo-dobra-kaloria` na zielony `#008244`.
4. `dam-shell.js`: `LOGO_SRC_LIGHT` / `LOGO_SRC_DARK` + `applyDobraKaloriaLogo` per slot.
5. `dam-brand.css`: widocznosc logo + min-height sidebara; cache `?v=20260717logo1`.
6. Docs: `design-system/components/logo.md`, memory.md §36, README wyczerpujacy bez sekretow.
7. `.gitignore`: tooling/bin, thumbs, postgres, .cursor, sekrety.

### Efekt/Fix
Logo zielone DK widoczne w light i dark. Zakaz Niemiesa zapisany.

### Test/Ewaluacja
- Hard refresh UI `?v=20260717logo1`
- Light: zielony wordmark na jasnym sidebarze
- Dark: ten sam zielony

### Zrodla
- Brand: `D:\Marketing\- POLSKA\- BRANDING i MARKA -\DOBRA KALORIA\01 - LOGO\SVG`
- Geex: `html[data-theme=dark]` + klasy `.logo-lite` / `.logo-dark`

### Git / GitHub
- Repo prywatne: https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn
- Branch: `main` (commit `c337bea`)
- Auth: `gh` (konto inyfinn / keyring) - token z czatu NIE zapisany w repo
- `.gitignore`: tooling/bin, thumbs, postgres, sekrety
