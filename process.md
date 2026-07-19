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
4. `QA-AUDIT.md` ? QA_FAIL_COUNT: 0
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
9. memory.md ?32-33

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
- wymaganie usera 2026-07-17 (screenshot warianty + mapowanie D?M)
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
7. memory.md ?34 + design-system/MASTER.md sekcja Chrome.

### Efekt/Fix
Wiadomosci / powiadomienia / profil dzialaja tak samo na costs, dashboard, settings itd.

### Test/Ewaluacja
- costs.html: klik ikony wiadomosci -> panel Asana/Teams + resize
- settings.html: pojawia sie pelny header chrome
- Escape / klik poza zamyka popup

---

## 2026-07-17 - Hub produktu: DK/GC + nosniki + wizki + lightbox

### Komenda/Akcja
Filtr DK/GC przy tytule (slot 1); widok wizualizacji kafelki/lista/skala (slot 2); naprawa blednego BATON; miniatury + lightbox; ?Nie widzisz wariantu? Dodaj go?.

### Log/Status
1. `dam-labels.js`: folder tylko `data - indeks` -> UNKNOWN (nie BAT); infer z prefiksu pliku/folderu KAR6X; detectMarketFromPath PL/GC.
2. `carrier-overrides.json`: klucz `6300622.00` -> KAR6X / nieaktualne (stary karton 6x, nie BATON).
3. `dam-explorer.js`: resolveCarrierCode + override; toolbar slot1 DK/GC chips; slot2 Kafelki/Lista/Skala; thumbs via `/media`; lightbox prev/next/X; modal dodawania wariantu -> POST `/carrier-override`.
4. `dam-brand-filter.js`: `renderChips` dla strefy produktu.
5. `local_bridge.py`: GET `/media`, POST `/carrier-override`.
6. memory.md ?35; cache `?v=20260717hub1`.

### Efekt/Fix
- BABKA CYTRYNOWA: KARTON 6x MINI BATONIKI + MINI BATONIK (bez fake BATON).
- 6300622 pod ?Pokaz starsze? jako KAR6X.
- Prawdziwe miniatury; lightbox z nawigacja i X.
- DK/GC i ustawienia widoku przy tytule produktu.

### Test/Ewaluacja
- browser: explorer.html?product=babka-cytrynowa-nerkowcowy - DK/GC chips, Kafelki/Lista/Skala PASS
- brak naglowka BATON PASS
- KAR6X expanded: 28 thumbs, naturalWidth > 0, media bridge PASS
- lightbox is-open + prev/next/close PASS
- ?Nie widzisz wariantu? Dodaj go? widoczne PASS

### Zrodla
- wymaganie usera 2026-07-17 (screenshoty 1/2 + folder 13.02.2025 - 6300622.00)
- memory.md ?35

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
6. Docs: `design-system/components/logo.md`, memory.md ?36, README wyczerpujacy bez sekretow.
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

---

## 2026-07-17 - Viz modal: Przejdz vs Eksplorator Windows

### Komenda/Akcja
Naprawa mylacych przyciskow w modalu Wizualizacje (SALTY NUT itd.).

### Log/Status
1. "Eksplorator produktu" robil `explorer.html?product=` (jak Indeks) - ZLE nazwa.
2. Przemianowano na **Przejdz do produktu** (hub DAM).
3. **Eksplorator produktu** = `DamPaths.openFolderInExplorer` - folder w Windows Explorer.
4. Ikony: arrow-right, folder-open, copy, share-alt (`.dam-btn-icon`).
5. Karty galerii: te same etykiety + przycisk folderu.

### Efekt/Fix
Dwa rozne CTA: hub HTML vs Windows folder. Ikony obowiazkowe.

### Test/Ewaluacja
- Hard refresh `visualizations.html?v=20260717vizbtns1`
- Bridge :8766 wymagany do otwarcia folderu

### Zrodla
- memory.md ?38, ui-ux-pro-max (ikony + touch 44px)

---

## 2026-07-17 - Viz Studio (Z tlem / Bez tla + lightbox)

### Komenda/Akcja
Redesign wizualizacji w hubie produktu: sortowanie tlem, hero per perspektywa, studio z sidebar/meta/zoom.

### Log/Status
1. Brief/PLAN: `ui-complete/00-brief.md`, `PLAN.md`
2. Labels: `vizBackground`, `vizSizeHint`, `vizFormatHint`, `vizLangFromFile`
3. Explorer: `buildVizStudioModel`, `renderVizGroups`, `openLightbox` (studio)
4. CSS: `.dam-viz-studio`, `.dam-lightbox--studio` w `dam-brand.css`
5. Bridge: `GET /media-meta` (PIL) - wymaga restartu procesu :8766
6. Fix: syntax error w catch stringu (blokowal IIFE) + em-dash w meta -> `x`/`-`
7. Ralph: screenshoty + `QA-AUDIT.md` FAIL=0

### Efekt/Fix
Sciana L/S zniknela z karty; klik hero otwiera studio z wariantami i meta.

### Test/Ewaluacja
- Babka KAR6X: taby 16/12, hero ENFACE/FRONT/BACK
- Studio meta: 3508 x 2480, 2.3 MB, RGB, DPI 72, JPEG
- `loop-final-{375,768,1024}.png`

### Zrodla
- `memory.md` ?37, `design-system/components/viz-studio.md`
- ui-complete / ui-ux-pro-max (Geex tokens)

---

## 2026-07-17 - Synology: wywolanie okna Uzyskaj lacze (bez modalu instrukcji)

### Komenda/Akcja
Usunac reczny modal udostepniania; DAM ma otwierac okno Synology Drive Client. Commit + push.

### Log/Status
1. Odrzucony UX: modal z 5 krokami PPM (user: "to miales wywolac okno synology").
2. Probe: Shell.Application.Verbs nie listuje Synology; AF_UNIX ui.sock z tej Pythona niedostepny.
3. Dziala: IContextMenu (IShellFolder.GetUIObjectOf) -> submenu Synology Drive -> "Uzyskaj lacze" (hr=0).
4. Produkcja: `apps/desktop/synology_get_link.ps1` + bridge `POST /synology-share`.
5. Front: `DamPaths.shareViaSynology` w `dam-paths.js`; `dam-viz.js` bez `openSynologyModal`.
6. Docs: `memory.md` ?27, `help.html` FAQ.

### Efekt/Fix
Klik "Udostepnij" otwiera natywne okno Synology (Get link). Modal instrukcji usuniety.

### Backup
Brak (tylko kod UI/bridge).

### Test/Ewaluacja
- `synology_get_link.ps1` na pliku PNG z D:\Marketing\- EKSPORT\... -> `ok:true`, verb Uzyskaj lacze
- Bridge restart wymagany po zmianie `local_bridge.py`

### Zrodla
- Win32 IContextMenu / IShellFolder (MSDN shell)
- Synology Drive Client context menu (lokalnie na stacji)

## 2026-07-18 - Sync Marka dropdown <-> chipy DK/GC + customizer button

### Komenda/Akcja
Synchronizacja filtra marki (toolbar "Marka: ..." z chipami DK/GC w produkcie) oraz zmniejszenie napisu "Dostosuj wyglad".

### Log/Status
1. dam-brand-filter.js: commitBrands + syncAllUi - jedna zmiana aktualizuje wszystkie triggery i chipy
2. pruneChipInstances - explorer remountuje #damProductBrandMount przy kazdym renderMain
3. dam-explorer.js: jeden addListener(onBrandFilterChange) zamiast stackowania callbackow
4. dam-viz.js: ten sam wzorzec addListener
5. dam-app.css: .geex-btn__customizer span 11px / line-height 1.15; ikona bez zmian
6. Cache bust: brandsync1 / customizer1 na explorer + visualizations

### Efekt/Fix
Odznaczenie GC w dropdownie odznacza chip GC (i odwrotnie). Przycisk customizera mniejszy wizualnie.

### Test/Ewaluacja
- Desktop (pywebview / skrot DAM ETA) - przeladowac Eksplorator, otworzyc produkt, toggle Marka vs DK/GC
- Nie opierac QA na http://127.0.0.1:8765 (dev-only)

### Zrodla
- memory.md Desktop first
- apps/web/assets/js/dam-brand-filter.js

## 2026-07-18 - file-index jako baza + fix sidebar collapse

### Komenda/Akcja
Projekty z mockow (3) -> file-index.json (187). Naprawa logo/zwijania sidebara.

### Log/Status
1. dam-api.js: offline czyta apps/web/data/file-index.json; kompletnosc z files_by_role (artwork/viz/print)
2. dam-projects.js: link do explorer.html?product= + checklista
3. dam-brand.css: collapsed logo 36px; przycisk expand wystaje poza panel (right:-16px)
4. dam-shell.js: setSidebarCollapsed + klik logo przy zwinieciu rozwija menu
5. Cache bust fileindex1 / sidebar2

### Efekt/Fix
Lista Projektow pokazuje caly indeks z repo. Sidebar da sie przywrocic; logo nie ucina sie na zwinietym.

### Test/Ewaluacja
- Desktop: Projekty -> ~187 kart; status "(indeks dysku w projekcie)"
- Zwin menu -> logo 36px, strzalka po prawej -> klik rozwija; albo klik logo

### Zrodla
- apps/web/data/file-index.json (product_count 187, viz_count 341)
- dam-paths.js: prefix sciezki vs stala struktura

## 2026-07-18 - konta bcrypt + ROOT offline + fix slots

### Komenda/Akcja
User: fetch z bazy; pliki z ROOT; offline kropka; konta szyfrowane; sesja=urzadzenie; konto KW.

### Log/Status
1. Fix `rolesFromRevision`: null rev nie crashuje na `.slots` (7 produktow bez revisions).
2. Projekty: metadane z file-index (baza lokalna), nie Laravel-first.
3. Auth: `auth_store.py` SQLite + bcrypt; bridge `/auth/login|register|me`; seed KW admin.
4. Sesja device_id - logout nie kasuje tokenu. signin.html prawdziwy formularz.
5. `dam-root-status.js`: czerwona kropka + Wskaz sciezke; `/files/status` probe X:\Marketing OK.

### Efekt/Fix
Projekty laduja sie; pliki online widoczne; konto KW w lokalnej bazie.

### Test/Ewaluacja
- Zaloguj: krzysztof.wieczorek@kubara.pl (haslo lokalne)
- Ustaw ROOT -> zielona kropka Pliki online
- Projekty: ~187 kart bez bledu slots

### Zrodla
- apps/desktop/auth_store.py, local_bridge.py
- apps/web/assets/js/dam-api.js, dam-root-status.js, signin.html

## 2026-07-18 - sciezka Marketing = wybor UZYTKOWNIKA

### Komenda/Akcja
User: zalezy od konta / kto zalogowany / co sobie ustawi. Zawsze liczy sie ustawienie usera, nie stala.

### Log/Status
1. Usunieto auto-nadpisywanie `dam_base_path` przez detect (X:/D:).
2. `ensureUserBase`: jesli user ustawil -> nie ruszac; pierwszy start -> tylko backup tego USERNAME; detect = sugestia.
3. `machine-config.json`: `{ users: { <USERNAME>: { base_path } } }`.
4. UI: brak domyslnego `X:\Marketing` w polu; Podpowiedz nie zapisuje sama.

### Efekt/Fix
Prawda sciezki = `dam_base_path` usera. Indeks tylko do remap struktury.

### Test/Ewaluacja
- Ustawienia: wpisz swoja baze -> Zapisz; restart nie zmienia na X: samo
- Drugie konto Windows moze miec inna baze w machine-config.users

### Zrodla
- apps/web/assets/js/dam-paths.js
- apps/desktop/local_bridge.py, machine-config.json

## 2026-07-18 - skrot DAM ETA nie startuje (zombie)


### Komenda/Akcja
Diagnostyka: skrot -> wscript -> run-dam.vbs -> pythonw launch.py

### Log/Status
1. Znaleziono zombie: launch.py + 2x local_bridge na 8765/8766, **bez widocznego okna** -> mutex blokowal nowy start ("juz uruchomiony").
2. Zabito PID 688/49980/56716.
3. `acquire_single_instance`: focus okna albo auto-kill zombie + retry; mutex handle trzymany w `_MUTEX_HANDLE`.
4. `run-dam.vbs`: pelna sciezka `C:\Python314\pythonw.exe` + log `launch-last-error.txt`.

### Efekt/Fix
Skr?t powinien znowu otwierac okno; przy kolejnym zombie auto-odzyskanie.

### Test/Ewaluacja
- Dwuklik "DAM ETA" na pulpicie
- Jesli fail: sprawdz `apps/desktop/launch-last-error.txt`

### Zrodla
- apps/desktop/launch.py, run-dam.vbs

## 2026-07-18 - X:Marketing + restart okna + structure-mcp

### Komenda/Akcja
1) Restart okna w Ustawieniach. 2) Indeks z X:\Marketing (nie D:). 3) Potwierdzenie wiedzy migracji structure-mcp.

### Log/Status
1. structure-mcp: `X:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\CURSOR\MCP - Filesystem\structure-mcp\` (memory: sloty 0-4, flat migrate, legacy M:). MCP config: POLSKA/EKSPORT = X:\Marketing, legacy = M:\ (obecnie niedostepny).
2. Skan X: LIVE: DK 144 + GC 43 = **187 produktow**; ~406 folderow wariantow. Indeks nie jest "ubogi" wzgledem drzewa X: - tyle jest w plaskiej strukturze.
3. `build-file-index.py`: auto `X:/Marketing` > `D:/Marketing`; przebudowa: products=187, viz=179 (czesciowe thumbs: WinError 389 cloud).
4. Domyslne sciezki UI: `X:\Marketing` (settings + dam-paths).
5. `launch.py`: `DamJsApi.restart_window` + opozniony relaunch (mutex). `settings.html`: przycisk "Zrestartuj okno aplikacji".

### Efekt/Fix
Indeks wskazuje X:; restart tylko w desktopie. Liczba 187 = stan drzewa X:, nie blad skanera. Wiecej bytow bedzie gdy: (a) M: legacy zmountowany i doscanowany / domigrowany, albo (b) UI liczy warianty/indeksy zamiast folderow produktu.

### Test/Ewaluacja
- Desktop: Ustawienia -> Zrestartuj okno aplikacji (confirm -> zamkniecie + relaunch)
- Ustawienia: baza `X:\Marketing` -> Sprawdz (3 foldery)
- Projekty / Eksplorator: ~187 kart, sciezki `X:/Marketing/...`

### Zrodla
- structure-mcp/memory.md (2026-07-17)
- user-structure MCP structure_get_config
- apps/web/scripts/build-file-index.py
- apps/desktop/launch.py

---

## 2026-07-18 - SQLite zamiast Dockera/Postgres (ADR-007)

### Komenda/Akcja
Uzytkownik: Docker nie wchodzi w gre dla normalnego usera; pytac o MySQL / cos natywnego.

### Log/Status
1. Decyzja: **SQLite** (nie MySQL - MySQL tez wymaga demona).
2. `apps/desktop/dam_db.py` - WAL, audit_log, status `docker_required: false`.
3. Bridge: audit -> SQLite (+ mirror JSONL); `/db/status`; usunieto `pg_store.py`.
4. `docker-compose.yml` - profil `dev-postgres` tylko opcjonalnie.
5. ADR-007 + amend ADR-001. memory.md ?41.

### Efekt/Fix
Odpalenie skrotu DAM ETA = baza w tle (plik SQLite). Bez Dockera, bez instalacji serwera DB.

### Test/Ewaluacja
- `python -c "import dam_db; print(dam_db.status())"` ? ok, wal=True, users>=1
- GET `/db/status` na bridge po starcie launchera

### Zrodla
- docs/ADR/ADR-007-local-sqlite.md
- apps/desktop/dam_db.py

---

## 2026-07-18 - Przyciski kart projektow (Geex)

### Komenda/Akcja
ui-taste: Checklista wygladala spoza DS (czarna obwodka `geex-btn--transparent`).

### Log/Status
1. Przyczyna: `geex-btn--transparent` w THEME = border 2px dark (button.html).
2. Fix: secondary = domyslny `geex-btn` (szary Geex), primary bez glow; ikony uil jak THEME.
3. Label primary skrocony do "Eksplorator" (jak viz).

### Efekt/Fix
CDP: Checklista `border: 0`, bg `rgb(236,234,243)`, radius 14px, min-height 44px.

### Zrodla
- THEME/geex-html-main/button.html
- apps/web/assets/js/dam-projects.js
- apps/web/assets/css/dam-app.css

---

## 2026-07-18 - Kontrast UI + ikony brak?w + wspolna baza

### Komenda/Akcja
ui-taste + ui-ux-pro-max: nieczytelne blekitne teksty, niewyr?wnanie; braki jako `Brak: viz_3d`; baza musi byc TA SAMA dla wszystkich.

### Log/Status
1. Przyczyna blekitu: Geex `--secondary-color: #B7DBF9` uzyty na subtitle - nieczytelny na bieli.
2. Fix signin: subtitle/title left-align z formem; kolor `--dark-color` / `#17161E`; tabs bez secondary-color.
3. Karty: mini-checklista jak Eksplorator (`dam-check-ok/brak` + Unicons); etykiety: Wizualizacje, Projekt graficzny, Pliki do druku.
4. Baza: `X:\Marketing\.dam-eta\dam-shared.sqlite` (WAL, busy_timeout 60s); seed z lokalnej; fallback lokalny.
5. ADR-007 amended; memory.md ?41+?43.

### Efekt/Fix
- CDP signin: subColor `rgb(23,22,30)`, titleLeft==emailLeft.
- CDP karty: lab `rgb(23,22,30)`, html `Wizualizacje Pliki do druku` (bez kodow API).
- `dam_db.status()`: shared=True, path Marketing `.dam-eta`.

### Test/Ewaluacja
Pass 1-5 screenshot (signin 375/768/1280 + karty 1280).

### Zrodla
- apps/desktop/dam_db.py
- apps/web/signin.html, dam-projects.js, dam-app.css
- docs/ADR/ADR-007-local-sqlite.md

---

## 2026-07-18 - Hierarchia CTA (jeden solid)

### Komenda/Akcja
ui-ux-pro-max: w grupie akcji tylko jeden przycisk ciezki (solid); drugi obrys/mniej absorbujacy.

### Log/Status
1. `project.html`: Przelicz = `geex-btn--primary`; Powiadom = `geex-btn--primary-transparent`.
2. Wzorzec `.dam-action-stack` w dam-app.css; memory.md ?44.
3. Modal sciezki Marketing: Save primary, Suggest outline, Skip szary.
4. Sloty checklisty: ikony + Wizualizacje (bez "3D").

### Test/Ewaluacja
CDP: recompute bg solid purple; notify border purple + transparent fill.

### Zrodla
- THEME/geex-html-main/button.html (primary vs primary-transparent)
- apps/web/project.html, dam-project.js, dam-app.css

---

## 2026-07-18 - Logo + wyszukiwarka na Projektach

### Komenda/Akcja
Logo zniknelo na Projekty; brak wyszukiwarki jak w Eksploratorze.

### Log/Status
1. Przyczyna logo: `index.html` nie mial `.geex-sidebar__header` / `.geex-sidebar__logo`.
2. Fix: markup logo w index + `ensureSidebarLogo()` w dam-shell (wszystkie strony).
3. Toolbar Projektow: `#damProjectsSearch` - ten sam placeholder i anatomia co Eksplorator; filtr lokalny.

### Test/Ewaluacja
Screenshot: logo DK w sidebarze; search "Szukaj indeksu lub skojarzenia..."; filtr `xmas` zaw??a karty.

---

## 2026-07-18 - ZIP nie jest wizualizacja

### Komenda/Akcja
Studio pokazywalo DK-6300753.00-Pakiet.zip (643 MB) jako WARIANT wizualizacji. Niedopuszczalne.

### Log/Status
1. ZIP lezal w 4 - WIZKI - indexer wrzucal caly slot do viz/wizki.
2. Fix indexer: resolve_file_role - archiwa nigdy viz; Pakiet/FQ/3-DRUK -> print; viz tylko obrazki.
3. Fix UI: filterVizImageFiles w dam-explorer; checklista/API bez ZIP jako viz.
4. Patch file-index.json: 7 archiwow przeniesionych viz->print (m.in. 6300753 Pakiet).
5. Asana CSV: apps/web/data/asana-tasks-kw.csv (433 taski) jako baza pod projekty/sciezki.

### Test/Ewaluacja
6300753: ZIP tylko w print; wizki = jpg/png FRONT/TYL. DamLabels.isVizImage(zip)=false.

---

## 2026-07-18 - Projekty UX: copy, ikony, liczniki, baza

### Komenda/Akcja
Ingest niezrozumialy; 187 vs wiecej produktow; ikony nie rowno; dwie ikony; Materialy kompletne; Dostosuj wyglad + baza.

### Log/Status
1. Przycisk: Wczytaj z dysku (nie Ingest pointerow).
2. Liczniki: 187 produktow na X: Marketing = poprawne foldery; 473 warianty; 322 bazy indeksow. M: offline. ARCHIWUM osobno.
3. Checklist: Materialy kompletne / Brakuje materialow + 3 role (jedna ikona statusu). CSS align + unicons-line.
4. Baza: X:\Marketing\.dam-eta\dam-shared.sqlite EXISTS (users/sessions/audit). Preferencje w Dostosuj wyglad = kolejny krok (zapis do SQLite).

### Test/Ewaluacja
Status UI: 187 produktow ? 473 wariantow. CDP icon/lab delta 0.

---

## 2026-07-18 - Modal wizualizacji: przyciski + warianty

### Komenda/Akcja
Przyciski za duze; Kopiuj/Udostepnij jako ikony w kole; 3x Polska daje ten sam efekt.

### Log/Status
1. Przyczyna: klik ustawial img.src = sciezke X:/ (browser nie laduje) + kopiowal sciezke.
2. Fix: thumb_url / bridge media; etykiety = indeks gdy wiele rewizji; Multijezyczny tylko przy >1 jezyku.
3. Akcje: 1 wiersz - Produkt, Eksplorator, okragle Kopiuj/Udostepnij.
4. Indexer: pick_thumb preferuje plik z indeksem rewizji.
5. Dysku: folder 6300767 zawiera pliki nazwane 6300524 (kopia bez rename) - wizualnie identyczne.

### Test/Ewaluacja
Do weryfikacji w visualizations.html?v=vizmodal1

---

## 2026-07-18 - DB + global search/tags + konta

### Komenda/Akcja
Czy baza dziala; Odswiez vs Wczytaj; tagi Autor + 12-24; global search na Projekty/Wizualizacje; konta test; awatary.

### Log/Status
1. Baza OK: `X:\Marketing\.dam-eta\dam-shared.sqlite` - 18 userow po seed.
2. Seed: `seed_kubara_users.py`, haslo `test`, login Agata/KW zweryfikowany.
3. Odswiez = reload z indeksu; Wczytaj z dysku = ingest/skan (tooltips).
4. `enrich-search-tags.py`: smak 24, typ 22, opakowanie 14, autor 16 (Asana CSV).
5. `dam-tag-bar.js` + collapse ~700px; wired explorer/projects/viz.
6. Awatary: female/male SVG wg email w `dam-shell.js`.

### Test/Ewaluacja
- login agata.karon@kubara.pl / test = OK
- tag_groups w search-index.json = OK

---

## 2026-07-18 - Nosnik FOLIA + meta PS + rename indeksu (admin)

### Komenda/Akcja
Usunac "Nosnik nieokreslony" gdy FOLIA widoczna; meta jak w EKSPORT WIZEK PS; tryb admina = edycja indeksu z rename na dysku.

### Log/Status
1. Przyczyna: `parseCarrierCode` nie znal FOLIA + UI doklejal "Nosnik nieokreslony ? " + folder.
2. Fix labels: FOLIA/REKAW/SLEEVE/? + skan calej nazwy; `parseRevisionMeta` / `extractIndexFromString` (jak JSX).
3. Explorer: label = czysty nosnik; chippy Marka/Indeks/Data; meta produktu Marka+Indeksy.
4. Admin: input indeksu + Zastosuj -> bridge `POST /rename-index` (tylko pod Marketing, confirm).
5. Cache: explorer `?v=20260718carrier1`.

### Test/Ewaluacja
- Odswiez explorer: ORZESZKI KUKURYDZA MIOD / FOLIA -> etykieta "FOLIA" (nie UNKNOWN).
- Admin: edycja indeksu wymaga confirm; dry path poza Marketing odrzucony.

---

## 2026-07-18 - Header wiadomosci/powiadomienia + logo login

### Komenda/Akcja
Skala i czytelnosc popupow Wiadomosci/Powiadomienia (Geex); logo na logowaniu wycentrowane nad napisami.

### Log/Status
1. Badge: realne liczby (Asana+Teams / ops), pill 20px, nie fake 84.
2. Popup: naglowek + wiekszy padding, ikony z tonem, zrodlo (DAM/Asana/Teams), bez podkre?len.
3. Login: logo DK centered nad tytulem (height 56px force - fix collapse).
4. Cache: `?v=20260718notif1`.

### Test/Ewaluacja
- Pass screenshot: settings powiadomienia (ikony+tagi), wiadomosci Asana bez underline.
- Pass screenshot: signin - logo nad "Witaj w DAM ETA", centers match.

---

## 2026-07-18 - Tag bar per-kategoria + ikony akcji wiz

### Komenda/Akcja
Tagi nie przycinac globalnie; kategoria >10 rozwija sie w dol. Eksplorator/Udostepnij = ikona; Przejdz do produktu = tekst.

### Log/Status
1. `dam-tag-bar.js`: usunieto max-height collapse; per group ROW_LIMIT=10 + `+N`/`mniej`.
2. Karty + modal `dam-viz.js`: `dam-btn-icon-only` dla folder/share.
3. Cache `?v=20260718tags2`.

### Test/Ewaluacja
- visualizations: Smak/Typ/Opakowanie/Autor widoczne naraz; +N przy Smaku spycha siatke.
- karta: Przejdz do produktu z napisem; obok same ikony.

---

## 2026-07-18 - Badge wiz: czytelny opis rewizji

### Komenda/Akcja
Wyjasnienie badge `(.01 > .00)` + zmiana copy na ludzki jezyk.

### Log/Status
1. Znaczenie: indeks pakowania ma sufiks rewizji; wyzszy (`.01`) = nowsza wersja niz `.00`.
2. Galeria bierze `viz_latest` = tylko aktualne.
3. `viz.badge` PL/EN + tip na badge w `visualizations.html`.

### Efekt/Fix
Badge: "Tylko najnowsze wersje produktow" (+ tip o `.01` vs `.00`).

---

## 2026-07-18 - Bridge offline + skroty F1/F5 + header polish

### Komenda/Akcja
Naprawa false-offline (brak mostu przy samym http.server), UI offline, F1/F5, kontrast badge, cienkie ikony.

### Log/Status
1. Diagnoza: UI = `python -m http.server 8765`, bridge 8766 nie dzialal -> "Bridge offline".
2. Start `local_bridge.py` + `serve_browser.py` (UI+bridge) + supervisor w `launch.py`.
3. `dam-root-status.js`: rozroznienie most/sciezka, `body.dam-bridge-offline`, szybszy poll offline.
4. `dam-shortcuts.js`: F1 modal pomocy, F5/Ctrl+R odswiez.
5. `dam-shell.js`: `normalizeHeaderIcons` (Unicons), badge msg/notif.
6. CSS: pasek offline, wiekszy pill, badge #B45309 / #0E7490, modal pomocy.
7. Cache `?v=20260718shell3`.

### Efekt/Fix
Most online gdy bridge dziala; offline widoczny (pasek + pill); F1/F5; czytelniejsze badge i ikony.

### Test/Ewaluacja
- `GET http://127.0.0.1:8766/health` = ok; machine-config `X:\\Marketing`
- Pass: Pliki online po starcie mostu; offline pill + `#damOfflineBar` 5px
- Pass: F1 modal pomocy; badge computed `#B45309` / `#0E7490`
- Pass: header icons = Unicons line (`dam-header-icon`)

---

## 2026-07-18 - Switch "Tylko najnowsze" + typografia toolbar/kart

### Komenda/Akcja
Badge rewizji -> switch; ujednolicenie fontow kontroli; wycentrowanie kart wiz.

### Log/Status
1. HTML: `#vizLatestOnly` + klasy `dam-control` / `dam-control--select`.
2. `dam-viz.js`: persist + expand starszych rewizji z products gdy OFF.
3. Tokeny `--dam-fs-*` / `--dam-control-*`; CSS switch + center body kart.
4. Cache `?v=20260718vizsw1`.

### Test/Ewaluacja
- ON: 278 wariantow; OFF: 285; lang/brand/switch fs=12px; title 14px center.

---

## 2026-07-18 - Autor inyfinn.art + CTA Przejdz + ui-taste intensive

### Komenda/Akcja
Usunac ETA Innovations z footera; CTA krotkie; skill ui-taste 10 rund przy mocnym polishu.

### Log/Status
1. `dam-shell.js` + i18n PL/EN + HTML footery: inyfinn.art (link).
2. `dam-viz.js`: przycisk "Przejdz".
3. settings/help + viz.subtitle uproszczony.
4. `ui-taste/SKILL.md` ?0.E: Intensive mode = 10 passes + self-critique.
5. Cache `?v=20260718inyf1`.

### Test/Ewaluacja
- Screenshot: footer `inyfinn.art ? 2026`, karty z CTA "Przejdz".

---

## 2026-07-18 - NOID fix + kalkulator picker (intensive QA)

### Komenda/Akcja
Usunac NOID z UI; pokazac prawdziwy indeks (np. 6300760); przebudowac wybor projektu w kalkulatorze kosztow.

### Log/Status
1. Root cause: `parse_index` wymagalo `NNNNNNN.RR`; foldery maja same cyfry -> fallback `noid`.
2. `build-file-index.py`: INDEX_PLAIN_RE + zakaz 6300XXX; thumb stem `pending` zamiast `noid`.
3. `repair-missing-indexes.py`: naprawiono 18 rewizji / 11 viz (limonka = 6300760).
4. `dam-viz.js`: `resolveIndexBase` / badge indeksu / nigdy nie pokazuj noid.
5. `dam-cost.js` + CSS: picker (bucket + search + select + wybrany projekt), RWD 375/768/1280.
6. Cache `?v=20260718noid1`. memory.md ?57.

### Test/Ewaluacja
- Intensive QA: DAKTYL LIMONKA badge `6300760`, body `noid` count = 0.
- Costs: brak chmury tagow; Marketing bucket = 3 projekty; mobile stack OK.

### Zrodla
- DamLabels.extractIndexFromString
- build-file-index.py parse_index

---

## 2026-07-18 - Typ vs Smak + mobile menu (ui-taste 5 passes)

### Komenda/Akcja
Poprawic taksonomie tagow (Typ != Smak) i ucinanie menu mobile u gory.

### Log/Status
1. Design read: Geex DAM filter redesign-preserve; dials 5/3/5.
2. Indexer: `muffin` -> Smak; Typ = baton / mini baton / mini batoniki / BAT / sleeve / karton 6x / kulki / sypkie / niemiesne?
3. `repair-tag-taxonomy.py` + sync `enrich-search-tags.py`.
4. `dam-tag-bar.js`: etykiety + auto-mount cold-load; explorer renderTagChips przed ciezkim load.
5. Mobile drawer: main.js bez width:toggle; CSS left:0 / transform:none / pad-top 44px + safe-area.
6. Cache `?v=20260718typ4`.

### Efekt/Fix
- Typ pokazuje mini baton, BAT, sleeve, karton 6x; muffin w Smak.
- Produkt 6300754 (KULKI MALINA): typ kulki, smak malina.
- Sidebar mobile: logoTop?49, clipped=false.

### Test/Ewaluacja (ui-taste 5 passes)
- Pass 1 (mobile~618): hierarchia Typ/Smak OK; nosniki widoczne.
- Pass 2 (sidebar open): logo + X widoczne, transform none.
- Pass 3: smak rozwiniety - muffin w Smak; typ bez muffina.
- Pass 4 (768): drawer open, logoTop 49, nie uciete.
- Pass 5 (desktop): pelna taksonomia + search 6300754.

### Zrodla
- User brief (Typ = nosnik/format; Smak osobno)
- apps/web/scripts/build-file-index.py, repair-tag-taxonomy.py
- apps/web/assets/js/dam-tag-bar.js, dam-explorer.js, main.js
- apps/web/assets/css/dam-brand.css

---

## 2026-07-18 - Przeniesienie SQLite z Marketing do repo

### Komenda/Akcja
User: zakaz zapisu `X:\Marketing\.dam-eta`; tylko repo; baza ma dzialac; status DB/indeks/dysk.

### Log/Status
1. Znaleziono `X:\Marketing\.dam-eta\dam-shared.sqlite` (ADR-007 stary kanon).
2. `dam_db.py`: kanon = `apps/desktop/data/dam-local.sqlite`; zero zapisu na Marketing.
3. Migracja danych do repo; usunieto `X:\Marketing\.dam-eta` (2x - stary most odtworzyl raz).
4. Restart bridge 8766; ADR-007 + memory ?41/41b.

### Efekt/Fix
- `/db/status` -> repo `dam-local.sqlite`, location=repo, `.dam-eta` nie istnieje.
- Auth: 1 user (admin Kubara). Indeks JSON w repo: 187 produktow. Marketing online (probe POLSKA).

### Test/Ewaluacja
- health ok; db/status path w repo; files/status online=true; Test-Path X:\Marketing\.dam-eta = False.

---

## 2026-07-18 - Modal wiz: chip 1x, FRONT-S, zoom, +50%

### Komenda/Akcja
User: zawsze chip wariantu (nawet 1 indeks); ujednolicic modal; miniatura FRONT-S nie SKLEP2-XL (MALINA); admin wybiera miniature; modal +50%; zoom +/- / lupa.

### Log/Status
1. `dam-viz.js`: zawsze render `.dam-viz-modal__variant`; zoom toolbar; admin Miniatura + overrides.
2. `dam-brand.css`: modal max-width 1020px, hero ~420-520px, style zoom.
3. `pick_thumb_file`: tier 0 = czysty FRONT-S (bez SKLEP/XL); prefer DK-*.
4. `repair-viz-thumbs.py`: forced_unlink=17 SKLEP/XL; MALINA -> `DK-?-FRONT-S.png`.
5. Bridge `POST /thumb-override` -> `apps/web/data/thumb-overrides.json`.
6. `#vizAdminToggle` na visualizations.html; cache `?v=20260718vizmod2`.

### Efekt/Fix
- Chip widoczny takze przy 1 indeksie (np. CZARNA PORZECZKA / MALINA).
- MALINA: FRONT-S.png zamiast FRONT-S-SKLEP2-XL.
- Modal wiekszy + zoom; admin moze nadpisac miniature.

### Test/Ewaluacja
- pick_thumb_file(malina) = DK-?-FRONT-S.png; repair OK viz=279.

---

## 2026-07-18 - Commit + docs + machine_id + release

### Komenda/Akcja
User: pelny commit, README, dokumentacja, memory, push, release ZIP; weryfikacja ID maszyny/sesji przed startem.

### Log/Status
1. machine_identity.py + verify w launch.py
2. Auth machine_id/session_id; bridge /auth/identity
3. dam-api.js clear przy mismatch
4. README, DEPLOYMENT, ADR-008, memory ?59
5. build-release-zip.ps1 + GitHub release

### Efekt/Fix
Sesja nie przenosi sie miedzy PC; artefakt ZIP + tag release.

### Zrodla
ADR-007/008; Windows MachineGuid

---

## 2026-07-18 - FIX: skrot nie startowal (SW_HIDE) + WebView2 profil + teksty przyciskow

### Komenda/Akcja
User: aplikacja w ogole nie startuje ze skrotu (wscript run-dam.vbs, "nic sie nie dzieje"); ma dzialac bez recznego zarzadzania portami; sprawdz baze danych; teksty przyciskow przy wykrywaniu sciezki sa dziwne - zrob bardziej intuicyjne.

### Log/Status
1. Reprodukcja: Start-Process wscript.exe run-dam.vbs + polling MainWindowTitle co 1.5s.
   - PRZED fixem: 120s bez okna. Proces (pythonw, local_bridge, watch-file-index, msedgewebview2 renderer)
     zyje i dziala poprawnie w tle - tylko GLOWNE OKNO nigdy sie nie pokazuje.
   - Kontrolowany test: Start-Process pythonw.exe -WindowStyle Hidden = brak okna (60s). WindowStyle Normal = okno po ~3s.
2. Root cause: run-dam.vbs uzywal sh.Run(cmd, 0, False) - styl okna 0 = SW_HIDE. pythonw.exe nie ma konsoli,
   ale SW_HIDE w STARTUPINFO blokuje initial-show WinForms/WebView2 window (pywebview edgechromium backend).
3. Fix run-dam.vbs: styl okna 1 (SW_SHOWNORMAL) w obu wariantach sh.Run + sh.CurrentDirectory = desktopDir.
4. Test bazy: /db/status (sqlite, wal, 18 users, location=repo) + pelny login+session cykl (auth/login,
   auth/me z machine_id/device_id) - dziala w 100%.
5. WebView2 startuje kazdy raz z nowym folderem %TEMP% (private_mode domyslnie True w pywebview) - kosztowny
   cold start. Fix: webview.start(private_mode=False, storage_path=apps/desktop/data/webview2-profile).
6. Teksty przyciskow: "Podpowiedz" -> "Wykryj automatycznie" (+ ikona lupy), "Sprawdz" -> "Sprawdz foldery"
   (+ ikona ptaszka). Komunikaty statusu w jezyku czlowieka (stan ladowania + wynik). Poprawiono w 3 miejscach:
   settings.html, dam-paths.js (modal setup pierwszego uruchomienia), dam-shortcuts.js (panel Pomocy).
7. Naprawiono mangled znaki ? " -> ASCII " (encoding issue w tym repo z krzywymi cudzyslowami).
8. Cache bump: dam-paths.js?v=20260718btn1, dam-shortcuts.js?v=20260718btn1.

### Efekt/Fix
- Skrot dziala: dwuklik -> okno w ~1.5-2s (potwierdzone 2x testem end-to-end identycznym jak user).
- Baza SQLite w pelni sprawna (login/session/machine binding).
- WebView2 ma trwaly profil (szybszy restart, bez smiecenia %TEMP%).
- Przyciski "Wykryj automatycznie" / "Sprawdz foldery" - jasne, ludzkie komunikaty (przetestowane w przegladarce,
  oba flow: sukces + informacja co dalej).

### Backup
Brak - zmiany tekstowe/logiczne, nie destrukcyjne. Stary run-dam.vbs mial jedynie bledny parametr.

### Test/Ewaluacja
- Start-Process wscript.exe run-dam.vbs -> MainWindowTitle "DAM ETA - Dobra Kaloria" po 1.6s (2. przebieg testu).
- /db/status: {"ok":true,"engine":"sqlite","users":18,"location":"repo"}.
- auth/login + auth/me: pelny cykl OK z machine_id/device_id/session_id.
- Browser QA (cursor-ide-browser): screenshot + klik obu przyciskow, komunikaty renderuja sie czysto (bez mojibake).

### Zrodla
- pywebview src: webview/platforms/edgechromium.py (clear_user_data, private_mode) + webview/__init__.py (storage_path)
- WScript.Shell.Run docs (intWindowStyle 0=Hide,1=Normal) - Microsoft WSH reference

---

## 2026-07-18 - Dashboard: siatka kart 2x2 + kolory + nowy sygnet kosztow

### Komenda/Akcja
User: karty statystyk zle sie ukladaja (flexbox/grid) na Dashboardzie; dopracuj kolorki; stary kolorek/grafika z motywu Geex w panelu kosztu jest zla - zamienic na cos zwiazanego z kosztami, sygnet lekko widoczny.

### Log/Status
1. Root cause ukladu: dam-app.css .geex-content__summary__count = grid-template-columns: repeat(auto-fit, minmax(215px,1fr)).
   Przy 4 kartach i typowej szerokosci okna (np. domyslne okno WebView2 1360px, ponizej breakpointu 1365.98px gdy
   .summary staje sie kolumna) auto-fit dobiera 3 kolumny -> 4. karta osierocona w nowym rzedzie.
2. Fix: grid-template-columns: repeat(2, minmax(0,1fr)) na sztywno (2x2 zawsze); repeat(1,...) pod 575.98px.
3. Kolory: "Zadania Asana" mialo klase danger-bg (czerwony) - alarmujacy kolor dla neutralnej liczby zadan.
   Zmiana na info-bg. Ale Geex --info-color (#58CDFF) ma kontrast ~1.8:1 z bialym tekstem (fail WCAG AA) -
   nadpisano w dam-tokens.css na #5B8DEF (kontrast ~5:1, dam-brand.css mial juz ten kolor jako fallback niewykorzystany).
   Literowka klasy primay-bg -> primary-bg (poprawiona, karta 1 "Produkty").
4. balance-bg.svg (dashboard.html + invoices.html, dzielony plik): usuniete losowe pastelowe blob-y demo Geex
   (koral, krem, blekit) niezwiazane z marka/tresc. Nowy motyw: sygnet - 2 nakladajace sie kola (monety) w
   barwach marki (Geex fiolet + DK zielony), niska opacity + 2 piersciene (obrys monety), subtelny watermark.
5. Cache bump: dam-tokens.css / dam-app.css -> ?v=20260718cost1 (wszystkie 14 stron HTML), balance-bg.svg?v=20260718cost1.

### Efekt/Fix (zweryfikowane CDP getBoundingClientRect + screenshoty)
- 375px: 4 karty w 1 kolumnie (stack). 768px: 2x2. 1360px (domyslne okno app): 2x2 - bug 3+1 zniknal.
  1920px (layout z panelem kosztu z boku): 2x2 kart + panel kosztu 460px, bez zmian proporcji.
- Karta "Zadania Asana": rgb(91,141,239) = #5B8DEF (bylo czerwone danger-bg).
- Nowy sygnet (2 kola + piersciene, fiolet+zielon) widoczny w rogu panelu kosztu na kazdej szerokosci (460-991px),
  bez ucinania przez border-radius.

### Backup
Brak - zmiany CSS/HTML/SVG nie destrukcyjne, cache-bust zapewnia odswiezenie u uzytkownikow.

### Test/Ewaluacja
- Browser QA (cursor-ide-browser + CDP Emulation.setDeviceMetricsOverride): 375/768/1360/1920px.
- Page.captureScreenshot z explicit clip (poza widocznym viewportem tabu) do weryfikacji sygnetu w panelu.
- ReadLints: brak bledow w dashboard.html, invoices.html, dam-app.css, dam-tokens.css.

### Zrodla
- WCAG 2.1 contrast ratio formula (relative luminance) - obliczenia rece dla #58CDFF vs #5B8DEF na bialym tekscie.

---

## 2026-07-18 - Login: minlength=8 blokowal haslo seed "test"

### Komenda/Akcja
User: nie moge sie zalogowac (admin); screen z tooltipem HTML5 "min 8 znakow" przy hasle `test` + stary komunikat invalid_credentials.

### Log/Status
1. Baza OK; konto admin istnieje; bcrypt weryfikuje haslo seed `test` (True), haslo z poprzedniego screenu (False).
2. Root cause UI: `signin.html` input hasla mial `minlength="8"`; seed Kubara = `test` (4 znaki) - przegl?darka blokuje submit.
3. Fix: minlength=4 (jak auth_store.register min 4); komunikat dam-api "Haslo min. 4 znaki"; cache ?v=20260718auth3.

### Efekt/Fix
Logowanie emailem admina + haslem `test` nie jest juz blokowane przez walidacje HTML5.

### Test/Ewaluacja
- Python: `_verify_password("test", hash)` True; `login(..., "test")` ok/admin.
- UI: po restarcie skrotu DAM - zalogowac `krzysztof.wieczorek@kubara.pl` / `test`.

### Zrodla
- apps/desktop/seed_kubara_users.py PASSWORD=test
- apps/desktop/auth_store.py password min 4
- HTML constraint validation (minlength przed eventem submit)

---

## 2026-07-18 - Sidebar collapsed: teksty zamiast samych ikon

### Komenda/Akcja
User: zwiniety sidebar pokazuje obciete etykiety zamiast samych ikon.

### Log/Status
1. Root cause: w dam-brand.css selector
   `body.dam-sidebar-collapsed ... menu__link span` byl przypadkowo zlaczone z `.dam-footer-author-link`
   i dostawal tylko color/font-weight zamiast `display:none`.
2. Fix: osobne reguly - span/dam-nav-label display:none; link font-size:0 + ikony 20px;
   title/aria-label na linkach w dam-shell.js; cache ?v=20260718side1.

### Test/Ewaluacja
- Browser 1360px: body.dam-sidebar-collapsed, sideW=72, spansStillVisible=0, ikony visible 20px.
- Screenshot: kolumna ikon bez etykiet.

---

## 2026-07-18 - DAM admin viz overhaul (rozpoznawanie, tagi, admin, wizki)

### Komenda/Akcja
Plan: naming-dictionary, fix parse_carrier/langs/MIX/PL, dam-badges, Warianty, white thumbs,
admin red outline, thumb picker, viz-flags; weryfikacja V1-V10.

### Log/Status
1. Utworzono `apps/web/data/naming-dictionary.json` + `docs/NAMING.md`.
2. `build-file-index.py`: CARRIER_RE + strip lang, parse_folder_langs all segments, MIX label,
   white thumb composite, CARTON?KAR, date-folder ? OTHER + infer from files.
3. `dam-labels.js` laduje dictionary (sync XHR); SLEEVE/FOIL ? REKAW/FOLIA.
4. Nowy `dam-badges.js`; wpi?ty w `dam-viz.js` (+ explorer scripts); "Warianty".
5. CSS: biale tlo + padding 12px thumbs; badges flex-start; `.dam-admin-control`; demo yellow.
6. Bridge: `GET /folder-images`, `POST /viz-flag`; `viz-flags.json`; launch `pick_thumb`.
7. Admin toggle ukryty gdy rola != admin (viz + explorer).
8. Rescan: products=187 viz?336.

### Efekt/Fix
- 6300610: carrier=REKAW, langs=[cz,sk] (nie GB).
- 6300650 DK NUGGETS XXL: REKAW + pl; GC kopia tego samego indeksu ma default GC?gb (nietypowe).
- OATS: FOLIA/DOYPACK; CORNFLAKES: czesciowo FOLIA; DATE ORANGE: folder od daty + pliki WARIANT-* ? OTHER (do potwierdzenia).
- Zero FOIL/SLEEVE/CARTON w polu carrier po skanie.

### Test/Ewaluacja
V1-V10: wyniki ponizej (PASS/FAIL + dowody).

### Zrodla
- docs/NAMING.md, apps/web/data/naming-dictionary.json
- plan dam_admin_viz_overhaul

---

## 2026-07-18 - Switch "Pokaz wszystkie" + Opakowanie tags

### Komenda/Akcja
User: "Tylko najnowsze" myli; odwrocic na "Pokaz wszystkie" (ON=stare+demo, OFF=aktualne).
Opakowanie: pelna lista nosnikow z sciagawki (nie tylko 6 tagow).

### Log/Status
1. visualizations.html + dam-viz.js: switch `vizShowAll`, default OFF, tooltip o prototypach/demach/starych.
2. Migracja localStorage z `dam_viz_latest_only` (odwrocona).
3. PACKAGING/OPAKOWANIE_CANON w build-file-index + enrich-search-tags; nosniki z Typ do Opakowanie.
4. repair-tag-taxonomy + enrich: 16 tagow opakowania.

### Efekt/Fix
Opakowanie: doypack, baton, mini baton, karton 6x, karton, bigpak, folia, etykieta, etykieta butelka, etykieta sloik, rekaw, tuba, shot, doy 6x, sasz, obwoluta.

---

## 2026-07-18 - Bramki V1-V10 (admin viz overhaul)

### V1 Recognition - PASS (z uwaga)
- 6300610: REKAW + langs=[cz,sk], lang cards cz/sk (nie GB). PASS
- 6300650 DK NUGGETS XXL: REKAW + pl. PASS. GC kopia indeksu ma default gb (nietypowe).
- OATS: FOLIA/DOYPACK. PASS
- MIX: etykiety `MIX - ?` / `MIX`, zero WARIANT. PASS
- DATE ORANGE / czesc CORNFLAKES: foldery od daty + pliki `WARIANT-*` ? carrier OTHER (pusta etykieta). Do potwierdzenia z userem (nie zgadywac FOLIA).

### V2 Carrier PL UI - PASS
- CDP dump kart: ETYKIETA, KARTON 6x MINI, DOYPACK, REKAW; zero FOIL/SLEEVE/CARTON/BAR w UI.
- Skrypt: 0 EN carrier codes w viz_latest.

### V3 Lang tooltip + touch - PASS
- Badge PL: tip="Polska", hitbox 44x44; kontrasty badge Geex; skroty PL/CZ/SK.

### V4 Tag click context - PASS (wiz)
- Klik tagu PL ? `#vizLangFilter` = `pl`. Explorer/project: handler w dam-badges (bind).

### V5 ui-taste galeria - PASS
- Pass1 375: biale tlo thumb, padding 12px, badges left, admin red, PL skrot. Screenshot+Read.
- Pass3 375 scroll: 2 karty, spojne badges. Screenshot+Read.
- Pass4 768: 2 kolumny, white thumbs. Screenshot+Read.
- Pass5 1280: sidebar+galeria, wariantow (nie rewizji). Screenshot+Read.
- Pass2 spacing: OK na Pass1/3.

### V6 Modal + explorer badges - PASS
- Modal: kategoria+nosnik+PL+indeks; zoom/warianty/Przejdz bez regresji; white+12px.
- Admin btns Miniatura/Demo/Ukryj/Dodaj z `.dam-admin-control`. Screenshot+Read.

### V7 Admin red outline - PASS
- ON: toggle + przyciski admin czerwone; OFF: brak Miniatura w modalu, 0 admin btns.
- Rola != admin: toggle ukryty (kod gate `isAdminRole`).

### V8 Demo/Ukryj/Dodaj - PASS
- Demo click ? `.dam-viz-card--demo` + badge Demo. CDP: demoCard=true, demoBadge=true.
- Ukryj/Dodaj: UI+POST /viz-flag OK (most zrestartowany).

### V9 Thumb picker - PASS
- Browser: Miniatura otwiera `#damThumbPicker` z lista plikow z 4-WIZKI (GET /folder-images).
- Desktop: `DamJsApi.pick_thumb` w launch.py (wymaga restartu skrotu DAM).
- Zapis: istniejacy POST /thumb-override.

### V10 Bramka koncowa - PASS z blokerami jawnymi
Pre-Delivery:
- Kontrast/focus/touch tagow: OK (44px, data-dam-tip).
- Em-dash ban w copy UI: OK (ASCII).
- Brak FOIL/SLEEVE w etykietach kart: OK.
- Modal zoom/warianty/Przejdz: OK.
- Galeria white+12px: OK (CSS+CDP).
- Admin czerwone tylko w trybie ON: OK po fix syncAdminOutline.
Bloker/uwagi (nie blokuje done feature, wymaga decyzji usera):
1. DATE ORANGE (i podobne GC) bez tokenu nosnika w folderze/plikach ? pusta etykieta.
2. Restart skrotu DAM potrzebny, zeby shell mial `pick_thumb` i swiezy most (folder-images/viz-flag).

---

## 2026-07-18 - Dashboard widgety + FMCG + notify

### Komenda/Akcja
Wdrozenie konfigurowalnego pulpitu (plan Dashboard widgety).

### Log/Status
1. Dodano `fmcg-cost-averages.json` + `dam-fmcg-cost.js` (landed cost + SWOT + sales mock).
2. Silnik: `dam-dashboard-widgets.js` (24 widgety, LayoutStore, modal Dostosuj z ??).
3. `dam-notify.js` - Notification API + poll file-index 60s.
4. Przebudowa `dashboard.html` na `#damDashGrid` + panel Asana/Teams; CSS `dam-dashboard.css`.
5. Orchestrator `dam-dashboard.js` laduje Asana / index / costs / rates / FMCG / flags / projects.
6. i18n PL/EN: `dash.customize*`, `dash.widget.*`.
7. QA ui-taste: 1280 / 768 / 375 screenshoty; dedupe najnowszych viz; usunieto zdublowany tytul.

### Efekt/Fix
- Domyslny layout bez kosztu miesiaca; user wlacza w Dostosuj pulpit.
- Persistencja `localStorage dam_dash_layout_v1:<userKey>`.

### Test/Ewaluacja
- Browser `http://127.0.0.1:8765/dashboard.html`: 7 widgetow domyslnych, modal 24 pozycji, dane 187/109/91.
- Em-dash scan nowych plikow: clean.

### Zrodla
- Plan `dashboard_widgety_*.plan.md`; Geex summary cards; project-costs + cost-rates.

---

## 2026-07-18 - Karty wizualizacji: tagi + wyr?wnanie flex

### Komenda/Akcja
Naprawa DOM kart #vizGrid - ogromne tagi, skakanie tytu??w/przycisk?w, brak ?wiat?a.

### Log/Status
1. CSS .dam-viz-card: flex column; thumb g?ra; body justify-content:flex-end + gap 14px.
2. .dam-viz-card__badges: wy?rodkowane, sta?a wysoko?? 48px (2 rz?dy).
3. Tagi w karcie: font jak pill (10.5px), padding pill, border-radius 999px (nie 27px chip).
4. JS: zawsze meta BRAK TYPU gdy brak nosnika; maxTotal:6 w compact.
5. Cache bust dam-brand.css / dam-viz.js / dam-badges.js ? viz4.

### Efekt/Fix
Tytu?y i CTA w wierszu na tej samej linii (CDP: titleTops/actTops r?wne). Mniej tag?w = pusta przestrze? w strefie badge, nie skok w g?r?.

### Test/Ewaluacja
- isualizations.html: badgeH ~20px vs pill 20px; BRAK TYPU na DATE ORANGE; align row1 OK.

### Zrodla
- Feedback UI (tagi vs .dam-tag-pill); ui-taste redesign-preserve Geex.

---

## 2026-07-18 - Regula weryfikacji UI + logo collapsed + tagi

### Komenda/Akcja
1) Globalna regula: zawsze weryfikuj UI screenshotem.
2) Logo collapsed nieczytelne; collapse vs Wstecz; tagi kart +padding/font.

### Log/Status
1. Dodano .cursor/rules/verify-ui-after-changes.mdc (alwaysApply) + wpis w memory.md / AGENTS.md.
2. Logo collapsed: object-fit: contain (bylo cover - tielo \"dobr\"), 48px, biale tlo.
3. Collapse: 	op: -29px - srodek w linii z #damNavBack (deltaCenter=0).
4. Tagi kart: font pill+1px (11.5), weight 500, padding 5px 11px; strefa badge 56px.

### Test/Ewaluacja
- CDP: collapseCenter=backCenter=44; badgeFw=500; badgeH=24; actTops row1 rowne.
- Screenshot: logo pokazuje \"dobra kaloria\" (nie crop \"dobr\").

## 2026-07-18 - skrot DAM ETA nie otwiera sie (porty)

### Komenda/Akcja
Diagnostyka skrotu Desktop\DAM ETA.lnk -> wscript -> run-dam.vbs -> pythonw launch.py

### Log/Status
1. Port 8765 zajety przez 2x http.server + serve_browser.py; 8766 przez 2x local_bridge (sesja dev/agenta).
2. Brak pythonw/launch i brak okna DAM - skrot wygladal na martwy.
3. Zabito zombie PID (serve_browser, http.server 8765, stare bridge).
4. Uruchomiono run-dam.vbs - okno "DAM ETA - Dobra Kaloria" (pythonw) na 8765/8766.
5. launch.py: _kill_stale_dam_processes obejmuje tez serve_browser + http.server:8765/web; wywolanie przed pick_free_port.

### Efekt/Fix
Aplikacja znowu otwarta. Kolejny start skrotu powinien sam sprzatac wiszace serwery deweloperskie.

### Test/Ewaluacja
- Dwuklik DAM ETA na pulpicie - okno widoczne
- netstat: 8765/8766 tylko procesy launch/bridge

### Zrodla
- apps/desktop/launch.py, run-dam.vbs

## 2026-07-18 - Tagi wizualizacji v2: 7 faz (rozmiary, OTHER, moderacja, aliasy, zgloszenia)

### Komenda/Akcja
Realizacja planu `viz_tags_ux_fix_e01a796a.plan.md` (7 faz) po ostrej reklamacji uzytkownika
odnosnie wygladu tagow/podgladow w wizualizacjach. Skille: ui-taste, ui-ux-pro-max, systematic-debugging.

### Log/Status (per faza)

**Faza 1 - rozmiary tagow + fix OTHER:**
1. `dam-tokens.css`: nowe tokeny `--dam-tag-fs-pill: 10.5px`, `--dam-tag-fs-badge: 14px`.
2. `dam-brand.css`: `.dam-viz-badge` font-size z tokena, padding 4px 12px; `.dam-tag-pill` 10.5px.
3. USUNIETO `min-height/min-width: 44px` z `.dam-badge-tag, button.dam-viz-badge` (root cause "2x za duze") -
   zastapione `::before{inset:-8px}` hit-area tylko dla `button.dam-badge-tag`.
4. `dam-labels.js carrierLabel()`: dodano `CARRIER_FORBIDDEN_RE`, zwraca `""` dla OTHER/UNKNOWN/WARIANT
   (wczesniej tylko UNKNOWN mial fallback "WARIANT" - OTHER przechodzil jako literal).
5. `dam-badges.js buildBadgeItems()`: przebudowana kolejnosc Marka->Kategoria->Podkategoria->Typ->
   Warianty->Jezyk->Indeks; compact mode = tylko flaga Multijezyczny (bez wyliczania GB/EE/LT...).
6. `dam-viz.js variantChipLabel()`: skrot+indeks (`GB ? 6300478`) zamiast pelnej nazwy; nowy `variantChipTip()`
   z pelna nazwa+sciezka w title/data-dam-tip.
7. `build-file-index.py pick_thumb_file`: `transparent_bonus` w `rank()` - PNG/WEBP (bez tla) > JPG (z tlem
   studyjnym) w tym samym tierze (artefakty = zle zdjecie, nie kompresja).
8. `repair-viz-thumbs.py`: force-unlink WSZYSTKICH cache'owanych thumbs (nie tylko SKLEP/XL) zeby nowy
   ranking faktycznie przeliczyl miniatury.

**Faza 2 - metadane, zgadywanie, aliasy, audyt PL:**
1. `SUBCATEGORY_PL` dict + `subcategory_label_pl()` w `build-file-index.py` - z SUROWEGO bracketu
   (nie filtrowanego `bracket_tags`, ktory odrzuca wielowyrazowe tagi).
2. Zgadywanie carrier: majority z sasiednich rewizji produktu, `carrier_guessed: true` flaga.
3. `product-aliases.json` (nowy) + `apply_product_aliases()` - `linked_products`/`alias_langs` na
   kazdym produkcie/viz_latest. Seed: owies-miod-sniadanie <-> cornflakes-peanuts-honey-balls-crispy.
4. Audyt PL znakow: `LANG_LABELS` (dam-labels.js) + `naming-dictionary.json.languages/ui/carriers` -
   Lotwa->?otwa, Wegry->W?gry, Slowacja->S?owacja, Wlochy->W?ochy, Bulgaria->Bu?garia, Slowenia->S?owenia,
   REKAW->R?KAW, ETY-SLO label->"ETYKIETA S?OIK", multi_lang_label->"Multij?zyczny" (OBA pliki - dictionary
   nadpisuje JS runtime przez XHR).
5. **Debugging note:** `print(repr(...))` w PowerShell pokazywal U+FFFD dla poprawnych UTF-8 znakow
   (cp1250 konsola) - zmylilo to na "korupcja danych"; zweryfikowano bajtami `open(...,'rb')` - dane
   byly ZAWSZE poprawne, tylko terminal output byl lossy.

**Faza 3 - naprawa migracji MATERIALY->PROJEKT (dry-run):**
1. Nowy `repair-materialy-to-projekt.py` - DK+GC, wykrywanie po slowach-kluczach (nie numerze slotu).
2. Rozszerzone po feedbacku usera: przeszukiwanie JEDNEGO poziomu podfolderow w MATERIALY (user
   zglosil realny przypadek zagniezdzenia), DRUK tylko flagowany.
3. `classify_special_document()` - karty_wprowadzenia + strategia (.pptx pozycjonowanie), SCAN_EXT
   +pptx/ppt/docx/doc/key.
4. Dry-run: 16 kandydatow (6 DK, 10 GC), zapisane `data/materialy-to-projekt-dryrun.json`. **BEZ --apply**
   - czeka na przegland i zgode usera (bardzo ostrozne, zero kasowania, PROJEKT-z-plikami nietykany).

**Faza 4 - edycja tagow + moderacja:**
1. `local_bridge.py`: `POST /rename-revision-prefix`, `POST/GET /tag-proposals(/decide)`,
   `POST/GET /carrier-types`. `rename_revision_prefix_on_disk()` - zamienia/dokleja WYLACZNIE prefiks.
2. `tag-proposals.json`, `carrier-types.json`, `carrier-assignment-log.json` (nowe, puste seed).
3. `dam-tag-edit.js` (nowy) - popover wyboru typu (`DamTagEdit.openCarrierPicker`), panel moderacji
   (`renderModerationPanel`) wbudowany w `settings.html`.
4. `dam-badges.js`: klik na `.dam-tag-editable` (carrier) -> popover edycji zamiast filtra.
5. Zweryfikowane end-to-end (popover otwiera sie, lista typow z diakrytykami, admin/user tryb naglowka).

**Faza 5 - modal: jeden indeks, aliasy, jezyki wyszarzone:**
1. `withAliasItems()` w `dam-viz.js` - pasek wariantow modalu dolacza `linked_products` PRZED dedupem.
2. Jezyki bez wizki: `missingLangs` = `alias_langs` minus jezyki w `items` -> wyszarzony badge +
   przycisk `uil-bell-plus` (`data-request-lang`) -> `DamVizRequest.open()`.
3. Zweryfikowane: OWIES MIOD (DK) modal pokazuje wariant CORNFLAKES PEANUTS HONEY (GC) w pasku - alias dziala.

**Faza 6 - zgloszenia wielokanalowe + inbox + X/Wstecz:**
1. `dam-viz-request.js` (nowy) - modal Email/Teams/Asana/W aplikacji + Wszystko/Wyczysc/Odwroc.
2. `local_bridge.py POST /viz-request` - wpis `inbox-items.json` ZAWSZE, email/teams/asana = stub
   (audit log, ADR-005). Test end-to-end: OK (channels_sent, inbox_item zwrocone poprawnie).
3. `notification-groups.json` (grafik: Krzysztof/Szymon/Sylwia).
4. `inbox.html` (nowa strona) - laczy inbox-items + asana-tasks, filtr tagow. `dam-shell.js`
   "Wszystkie zadania" -> `inbox.html` (bylo `dashboard.html`, potwierdzony bug).
5. `damAddVariantModal` dostal `.dam-modal-x` (byl bez X). `goBackNav()` zamyka modal/popover/lightbox
   zamiast nawigowac, jesli jest otwarty.

**Faza 7 - QA + docs:**
1. Screenshot QA 375/768/1280 na visualizations.html (siatka + modal + alias + missing-lang) - OK.
2. memory.md ?68-77, ten wpis w process.md, PROGRESS.md.
3. Cache bust: `?v=20260718tags1/2/3` na dam-tokens/dam-brand/dam-labels/dam-badges/dam-viz + nowe pliki.

### Backup
- Zadne pliki produkcyjne (X:\Marketing) NIE zostaly zmienione - Faza 3 to tylko dry-run raport.
- `carrier-assignment-log.json`/`tag-proposals.json`/`inbox-items.json` startuja jako puste seed.

### Test/Ewaluacja
- Browser MCP: CORNFLAKES/OATS CHOCOLATE/DATE ORANGE karty - zero "OTHER", poprawna kolejnosc,
  Multijezyczny bez rozwiniecia jezykow, "?" na zgadnietym typie, "Dodaj typ" gdy brak.
- DOM getBoundingClientRect: badge container w pelni w granicach karty (bez clipping - overflow:hidden
  na `.dam-viz-card` nie problem, bo wysokosc auto).
- `/viz-request` PowerShell smoke test: ok=true, channels_sent=[email,asana,app], inbox_item poprawny.
- Popover typu: otwiera sie, lista z diakrytykami (ETYKIETA S?OIK), header zmienia sie wg roli/trybu.

### Zrodla
- Plan: `c:\Users\xpret\.cursor\plans\viz_tags_ux_fix_e01a796a.plan.md` (nie edytowany, tylko realizowany)
- User feedback (2026-07-18): rozmiary tagow (+5%/+35%), zakres Fazy 3 (DK+GC, ostrozne kryteria),
  karty wprowadzenia/strategia w checklistcie

## 2026-07-18 - Viz UX: favicon DK, modal, tagi, tooltipy, picker

### Komenda/Akcja
Pelny polish wizualizacji (ui-taste 5 passes): favicon/PWA DK, tooltipy jasne, modal actions, kolory tagow, edycja typu z Zatwierdz/Anuluj/BRAK TYPU, admin dblclick/Shift.

### Log/Status
1. Favicon DK + manifest.webmanifest + meta mobile; dam-shell.ensureAppIcons na kazdej stronie.
2. Modal: CTA Przejdz/otworz rowne (~94px), admin kompakt (h28), gap Share->admin ~78px, zoom wycentrowany, badge left + styl kart.
3. Kolory: cat=zielony, carrier=pomarancz, subcat/smak=fiolet, warianty=teal, index-miss=jasny szary.
4. dam-tag-edit: wybor pending + footer Zatwierdz/Anuluj + BRAK TYPU; bridge rename DOYPACK/BATON + NONE; admin Shift/dblclick <=500ms.
5. Tooltips: jasne biale, auto-bind title/aria-label; 1500+ tipow.
6. BARS+DOY: carrier_guessed w build-file-index (wymaga przebudowy indeksu).

### Efekt/Fix
Aplikacja wyglada jak pelny produkt DK (ikona, PWA). Korekta typu wymaga Zatwierdz - zapis na dysk przez bridge.

### Test/Ewaluacja
- CDP: zoomOffCenter=0, gapShareAdmin=78, badgesJustify=flex-start, cta 94/92, admin h=28
- Popover: BRAK TYPU + Zatwierdz widoczne (actVisible=true)
- Pass 1-5 screenshoty: viz-pass1..5 w Temp/cursor/screenshots
- Favicon: favicon-dk.svg?v=20260718dk1

### Zrodla
- apps/web/assets/js/dam-tag-edit.js, dam-badges.js, dam-viz.js, dam-tooltips.js, dam-shell.js
- apps/web/assets/css/dam-brand.css
- apps/desktop/local_bridge.py
- plan viz_tags_ux_fix_e01a796a

## 2026-07-18 - Admin undo: Miniatura/Demo/Ukryj/Dodaj + tag (UKRYTE)

### Komenda/Akcja
Kazdy przycisk admina w modalu wizualizacji musi dac sie cofnac; osobny tag (UKRYTE) tylko dla admina; Pokaz wszystko pokazuje ukryte; tooltipy nie widoczne (z-index / bind).

### Log/Status
1. dam-viz: toggle Miniatura (Reset), Demo (Demo off), Ukryj/Pokaz (bez zamykania modala), Dodaj/Usun (+ Shift=dodaj kolejny).
2. dam-badges: label `(UKRYTE)`, klik -> `damVizToggleHidden`; Demo klik admin -> `damVizToggleDemo`.
3. Filtr: ukryte tylko dla admina przy `showAll`; inaczej odfiltrowane.
4. Tooltips: z-index 20050 + `DamTooltips.bind(modal)` po otwarciu; tipy dynamiczne z `data-dam-tip`.
5. Bridge: `thumb-override` z `clear:true` usuwa wpis; cache-bust `admin1`.

### Efekt/Fix
Admin moze odklikac pomylkowe Miniatura/Demo/Ukryj/Dodaj; tag (UKRYTE) i przycisk Pokaz przywracaja widocznosc.

### Test/Ewaluacja
- CDP: hide product_id -> grid OFF bez showAll, ON z showAll + `.dam-viz-card--hidden`
- Tag `(UKRYTE)` klik -> `Ukryj` z powrotem; tip z-index 20050, above=true nad stopka
- Screenshoty: admin-undo-pass1..5 w Temp/cursor/screenshots (pass5: tip nad Ukryj widoczny)
- Cache: dam-brand/badges/viz `admin2`, dam-tooltips `admin3`

### Zrodla
- apps/web/assets/js/dam-viz.js, dam-badges.js, dam-tooltips.js
- apps/web/assets/css/dam-brand.css
- apps/desktop/local_bridge.py
- memory.md ?79

---

## 2026-07-18 - Projekty tagi + checklista + Fala D/E

### Komenda/Akcja
Kontynuacja planu viz_admin: quick UI (podkategoria max10, picker header, tagi na projektach, szersza checklista) + rename plikow AI/PDF/wizki + change-log Cofnij/Ponow.

### Log/Status
1. dam-tag-edit: naglowek pickera " Wybierz typ\ / \Zaproponuj typ\ (bez \zatwierdz ponizej\).
2. dam-viz: Podkategoria max 10 + przycisk +N / mniej (jak DamTagBar).
3. dam-projects + dam-api: male tagi DamBadges na kartach; checklista 6 pozycji jak Eksplorator.
4. local_bridge: build_carrier_filename + rename_revision_files_on_disk; change-log.json + undo/redo API.
5. UI: Cofnij/Ponow w toolbarze wizualizacji; discrepancy assignment-log -> carrier_guessed + tip.
6. Cache-bust: ?v=20260718wave2.

### Efekt/Fix
Karty projektow pokazuja smak/kategorie/typ; checklista szersza; rename typu obejmuje pliki; historia z Cofnij/Ponow.

### Test/Ewaluacja
- index.html CDP: badgeCount>=1, 6 wierszy checklisty
- visualizations: Podkategoria +17 widoczne
- build_carrier_filename: GC_balls... -> GC-DOY-balls_cocoa-lime - GB_AR - 6300489.00.ai

### Zrodla
- plan viz_tags_ux_fix_e01a796a + viz_admin_ux_verify_d3c4e2c8
- apps/web/assets/js/dam-projects.js, dam-viz.js, dam-tag-edit.js, dam-api.js
- apps/desktop/local_bridge.py

---

## 2026-07-18 - Fix: Eksplorator SyntaxError (aplikacja " nie dziala\)

### Komenda/Akcja
User: aplikacja nie dziala, eksplorator byl rozjebany.

### Log/Status
1. Repro: explorer.html ladowal tagi, ale DamExplorer=undefined, puste #damFolderList/#damExplorerMain.
2. Root cause: SyntaxError w dam-explorer.js:1867 - string z niezescapowanym class=\dam-tag-group-pills\ przerywal parsing calego pliku.
3. Fix: zamiana na spojny single-quoted string.
4. Cache-bust explorer.html ?v=20260718fix1.
5. Weryfikacja: DamExplorer=object, kategorie BATONY/KULKI/..., 187 prod.

### Efekt/Fix
Eksplorator znowu startuje i pokazuje drzewo produktow.

### Test/Ewaluacja
- node --check dam-explorer.js = OK
- CDP: folderText zawiera BATONY/KULKI/ROSLINNE, meta 187 prod.

### Zrodla
- apps/web/assets/js/dam-explorer.js
- systematic-debugging
## 2026-07-18 - Fix ELEMENTY BRAK + studio lightbox UX (10-pass)

### Komenda/Akcja
User: falszywy BRAK Elementy (pliki w MATERIALY/ELEMENTY); studio podgladu chaotyczne / przycina / za duzo scrolla. Intensive QA 10 passes (ui-taste + ui-ux-pro-max).

### Log/Status
1. Root cause checklisty: indeks nie skanowar podfolderu ELEMENTY pod MATERIALY; `files_by_role.elements=[]`.
2. Fix indexer: `build-file-index.py` skan 1 poziomu ELEMENTY/ELEMENTS; patch `patch-elements-in-index.py` (8 rewizji, 160 plikow; czarna-porzeczka 6300753.00 = 14 plikow).
3. `revisionHasElements`: najpierw `elements.length`.
4. Studio: dedupe rozmiar|format, chipy L/S/XL, nazwa w stopce, stage flex fit (ratio ~0.97), details metadane, RWD stack.
5. Cache-bust explorer: dam-brand + dam-explorer `?v=20260718studio10f`.

### Efekt/Fix
Elementy / skladniki = OK (nie BRAK). Studio: 4 chipy zamiast sciany duplikatow; wizualizacja miesci sie w stage.

### Test/Ewaluacja
- CDP checklist: dam-check-ok Elementy
- Passy screenshot: qa-pass1..10 (desktop fit OK; tablet ze zwinietymi metadnymi)
- Intensive QA: 10 passes

### Zrodla
- apps/web/scripts/build-file-index.py, patch-elements-in-index.py
- apps/web/assets/js/dam-explorer.js, css/dam-brand.css, explorer.html

## 2026-07-18 - Reczne powiazanie Elementy (user/admin)

### Komenda/Akcja
User: nie tylko czarna porzeczka - zle wykrywanie szerzej; pozwolic wskazywac foldery/pliki, aktualizowac checklist?, przejsc ikona z eksploratora.

### Log/Status
1. Bridge: `POST /elements-link`, `GET /folder-browse`, KV `elements-overrides`, sklep `data/elements-overrides.json`.
2. Explorer checklista: akcje open / link / unlink; picker z ?Uzyj tego folderu?.
3. `computeChecklist` honoruje overrides; dam-api tech tez (localStorage).
4. Indexer: skladniki + pliki w podfolderach ELEMENTY; re-patch (+1 rev / 3 pliki).
5. Cache-bust `?v=20260718elemLink1`.

### Efekt/Fix
User/admin moze poprawic falszywy BRAK wskazujac folder; potem zielona checklista + ikona folderu do reveal.

### Test/Ewaluacja
- python ast + node --check OK
- patch-elements-in-index: patched_revisions=1 files_added=3
- Wymaga restartu local_bridge (8766) zeby nowe endpointy dzialaly

### Zrodla
- apps/desktop/local_bridge.py
- apps/web/assets/js/dam-explorer.js, dam-api.js, css/dam-brand.css
- apps/web/data/elements-overrides.json
- apps/web/scripts/build-file-index.py, patch-elements-in-index.py

---

## 2026-07-18 - Checklista + tagi listy + Zglos (7-pass QA)

### Komenda/Akcja
User: tagi na liscie produktow/wariantow jak w wizualizacjach; wieksze indeksy; checklista bez naglowka "Brakuje materialow"; nowe sloty Karta/Prezentacja; rename etykiet; wiecej oddechu; przyciski obok siebie; Powiadom = Zglos jak w wizualizacjach. 7 rund ui-taste + ui-ux-pro-max.

### Log/Status
1. Explorer `prodRowHtml`: DamBadges kategoria/podkat + jezyki; indeks/data chip 13px.
2. Warianty: chip typu + PL/jezyki z plikow + brand/index/date/status.
3. Checklista (explorer + karty Projektow + project.html): 8 slotow; etykiety "Plik zrodlowy?" / "Podglad PDF?"; Karta wprowadzenia + Prezentacja; bez head "Brakuje materialow".
4. Karty: akcje flex row, wysokosc ~36px; detail: Przelicz + Zglos side-by-side ~40px; Zglos -> DamVizRequest (Email/Teams/Asana/App).
5. Cache-bust `?v=20260718check8` / `check8b` / `check8c`.
6. QA 7 pass: lista KULKI (tagi+13px), wariant PL, karty, detail+modal, 375/768/1280.

### Efekt/Fix
Rozpiska czytelna z tagami; checklista mowi ikonami + jasnymi etykietami; Zglos = ten sam flow co wizualizacje.

### Test/Ewaluacja
- CDP: produkt tags KULKI/Deserowe/PL, index fontSize=13px
- CDP karty: 8 labels, head=null, actions flex row h=36
- CDP project: stackFlex=row, Przelicz+Zglos; modal kanalow OK
- Pass 1-7 screenshot+Read: clean (mobile: dlugie etykiety wrapuja - akceptowalne)

### Zrodla
- apps/web/assets/js/dam-explorer.js, dam-projects.js, dam-project.js, dam-api.js, dam-viz-request.js
- apps/web/assets/css/dam-brand.css, dam-app.css
- apps/web/explorer.html, index.html, project.html

---

## 2026-07-18 - Karty / detail / tagi PPM (card7, 7-pass QA)

### Komenda/Akcja
User: detail bez hashtagow, cie?szy tytul; checklista lu?niej; Akcje = kafelki + Eksplorator/Folder; klik slotu OK -> Przejdz+Win; karty: bez Rynek PL, indeks pod tytulem, Przejdz+Win (+Asana), bez duplikatu indeksu; PPM tag = kopiuj; tagi +1px; 7 tur ui-taste.

### Log/Status
1. `dam-projects.js`: index-row, badges bez indeksu, Przejdz/Win/Asana, ASANA_BY_INDEX.
2. `dam-project.js`: DamBadges header, title light, slot toggle actions, action tiles.
3. `dam-badges.js`: copyTagText + bindCopyOnRightClick (document).
4. `dam-api.js`: langs/category/carrier/path w meta projektu.
5. CSS: index-row, wieksze tagi, checklista gap, `.dam-action-tile`, slot actions, toast.
6. HTML cache `?v=20260718card7` + skrypty labels/badges/paths na project.html.
7. QA 7 pass: karta Banoffee, detail+slot open, 375/768/1440.

### Efekt/Fix
Czytelny header z prawdziwymi tagami; karty jak wizualizacje (Przejdz+folder); panel Akcje zrozumialy; PPM kopiuje tag.

### Test/Ewaluacja
- CDP karta: badgeFs=11.5px, pad 4/10, actions=3, checklistGap=12-14px
- CDP detail: titleWeight=500, badges DK/KULKI/Deserowe/DOYPACK/PL/index, hashGone, tiles=5, slot open Przejdz+Win
- Pass 1-7 screenshot+Read: clean; clipboard API w automation = NotAllowed (focus) - kod OK

### Zrodla
- apps/web/assets/js/dam-projects.js, dam-project.js, dam-badges.js, dam-api.js
- apps/web/assets/css/dam-app.css
- apps/web/index.html, project.html

---

## 2026-07-18 - DDNS first + OFFLINE fallback (NAT/CGNAT)

### Komenda/Akcja
User: jak sie polaczyc gdy straci static IP / ISP zamknie NAT; pamietaj o pomocy (GitHub DATABASE / lokalny SQLite); priorytet DDNS inyfinn.synology.me, LAN tylko awaryjnie; kazdy ma miec dostep do bazy.

### Log/Status
1. memory.md ?84: DDNS first, OFFLINE hint (NAT/CGNAT), DATABASE/ GitHub.
2. `pg_db.py`: sort hostname przed prywatnymi IP; sticky last-host tylko dla DDNS.
3. `dam_db.py`: przy padnieciu PG -> OFFLINE SQLite + offline_hint; retry co 120s; mirror users PG->SQLite; status z github_dump.
4. ADR-009 amended; PROGRESS: wspolna baza NAS = done.
5. Test: ping host=inyfinn.synology.me, users=18; prefer_ddns_first OK; symulacja offline -> SQLite Connection.

### Efekt/Fix
Gdy DDNS/NAT pada - app dziala lokalnie z jasnym komunikatem (nie cichy fail). Gdy DDNS wraca - auto powrot do PG.

### Test/Ewaluacja
- python ping ok, hosts=[inyfinn.synology.me, 192.168.0.145]
- offline sim: engine sqlite-offline, potem leave -> postgres

### Zrodla
- apps/desktop/dam_db.py, pg_db.py
- memory.md ?84, docs/ADR/ADR-009-postgres-synology.md

---

## 2026-07-18 - Karty card7b (indeks r?g, kategoria w tytule, wash, Eksplorator)

### Komenda/Akcja
User: indeks w prawy g?rny r?g; kategoria w nazwie; klik tytulu ? Eksplorator DAM; nazewnictwo Eksplorator vs Eksplorator plikow; status +7%; delikatny gradient statusu; 5 tur ui-ux-pro-max.

### Log/Status
1. `dam-projects.js`: index-corner; `CATEGORY ? NAME` ? explorer; Win tip = Eksplorator plikow.
2. `dam-app.css`: wash incomplete/ok (skr?cony + wygaszony), status ?1.07, title-link.
3. Sidebar/i18n: `nav.explorer` / `explorer.title` = Eksplorator; `explorer.html` tytu?.
4. QA 5 pass: desktop layout, spacing/wash, 375, 768, a11y (klik tytulu ? explorer?product=?).

### Efekt/Fix
Karty czytelniejsze (kategoria w tytule); indeks nie wypycha tag?w; wash nie zaburza checklisty; sp?jne nazwy nawigacji.

### Test/Ewaluacja
- CDP: indexInCorner, title `BATONY ? ?`, href explorer, beforeH?92px alpha 0.055, statusH?30px, nav=Eksplorator
- Klik tytulu ? `explorer.html?product=mix-12x-xmas-mixy` (breadcrumb BATONY / 12X XMAS)
- Pass 1-5 screenshot OK

### Zrodla
- apps/web/assets/js/dam-projects.js, dam-shell.js, dam-explorer.js
- apps/web/assets/css/dam-app.css
- apps/web/i18n/pl.json, en.json, index.html, explorer.html
- memory.md ?85

---

## 2026-07-18 - Karty card7b (indeks rog, kategoria w tytule, wash, Eksplorator)

### Komenda/Akcja
User: indeks w prawy gorny rog; kategoria w nazwie; klik tytulu -> Eksplorator DAM; nazewnictwo Eksplorator vs Eksplorator plikow; status +7%; delikatny gradient statusu; 5 tur ui-ux-pro-max.

### Log/Status
1. dam-projects.js: index-corner; CATEGORY ? NAME -> explorer; Win tip = Eksplorator plikow.
2. dam-app.css: wash incomplete/ok (skrocony + wygaszony), status x1.07, title-link.
3. Sidebar/i18n: nav.explorer / explorer.title = Eksplorator; explorer.html tytul.
4. QA 5 pass: desktop layout, spacing/wash, 375, 768, a11y (klik tytulu -> explorer?product=...).

### Efekt/Fix
Karty czytelniejsze (kategoria w tytule); indeks nie wypycha tagow; wash nie zaburza checklisty; spojne nazwy nawigacji.

### Test/Ewaluacja
- CDP: indexInCorner, title BATONY ? ?, href explorer, beforeH~92px alpha 0.055, statusH~30px, nav=Eksplorator
- Klik tytulu -> explorer.html?product=mix-12x-xmas-mixy (breadcrumb BATONY / 12X XMAS)
- Pass 1-5 screenshot OK

### Zrodla
- apps/web/assets/js/dam-projects.js, dam-shell.js, dam-explorer.js
- apps/web/assets/css/dam-app.css
- apps/web/i18n/pl.json, en.json, index.html, explorer.html
- memory.md ?85

---

## 2026-07-18 - PL znaki + status bazy + Wiadomosci (db1)

### Komenda/Akcja
User: polskie znaki wszedzie; wyjasnij Odswiez vs Wczytaj z dysku; status bazy obok Pliki online z wyborem zrodel + force refresh; dedykowana strona wiadomosci; ui-taste 10 tur + ui-ux-pro-max.

### Log/Status
1. Skrypt restore-pl-diacritics.py + poprawki manglingu (zadania/Zadanie).
2. Przyciski: Odswiez liste / Skanuj dysk (tips).
3. dam_db: prefer, sources, force_reconnect, pull dump --no-commit; bridge POST /db/reconnect, /db/prefer.
4. dam-db-status.js pill + panel; nav Wiadomosci; inbox.html + dam-inbox.js.
5. Intensive QA 10 pass (screenshot): index PL, panel bazy, inbox desktop/mobile, cache bump.

### Efekt/Fix
UI z polskimi znakami; jasne akcje indeksu; status bazy dziala (Synology/GitHub/lokalna); strona Wiadomosci z filtrami.

### Test/Ewaluacja
- GET /db/status: label Baza online, sources synology active
- POST /db/reconnect: Baza online
- CDP index: title Projekty opakowan, Odswiez liste, Skanuj dysk, Baza online
- inbox: 109 Asana, filtry, szukaj

### Zrodla
- apps/desktop/dam_db.py, local_bridge.py, scripts/sync-database-backups-to-git.py
- apps/web/assets/js/dam-db-status.js, dam-inbox.js, dam-shell.js
- apps/web/i18n/pl.json, inbox.html, index.html
- memory.md ?86

---

## 2026-07-18 - Checklist klik + ikony Eksplorer/Win/Asana (icons2)

### Komenda/Akcja
User: klikalne OK-sloty na kartach i w Wymaganiach (global); checklista detail jak karta; Asana SVG; gradient +30%/+50%; kompletny: ramka 1px fade 50%?95%; Sprawdz projekt + Przejdz?Eksplorer; rename Eksplorer; ikona sidebar; Win SVG z referencji; ui-taste 5 tur.

### Log/Status
1. dam-icons.js: Win folder SVG + Asana mark + bindChecklistRows (global).
2. dam-projects.js: OK-wiersze interaktywne; Sprawdz projekt (strzalka?project) + Przejdz (folder-open?explorer) + Win + Asana.
3. dam-project.js: ta sama interakcja; Eksplorer w akcjach; Win/Asana SVG; PL copy.
4. Sidebar/i18n: Eksplorer + uil-sitemap; Przejdz zostaje uil-folder-open.
5. CSS: wash 8.625rem / alpha *1.3; --ok border fade; checklista detail = rytm karty.
6. ui-taste Pass 1-5: 375/768/1280 screenshot+Read; fix wrap akcji + widocznosc akcji wiersza.

### Efekt/Fix
Jedna semantyka: Eksplorer=DAM hub, Eksplorator plikow Windows=OS; klik OK-slot ? Przejdz + Folder Windows wszedzie.

### Test/Ewaluacja
- CDP: nav Eksplorer + uil-sitemap; banoffee: Sprawdz projekt / Przejdz / Folder Windows / Asana
- Klik OK-wiersza: akcje Przejdz + dam-icon-win-explorer (karta + project.html)
- Cache: ?v=20260718icons2

### Zrodla
- apps/web/assets/js/dam-icons.js, dam-projects.js, dam-project.js, dam-shell.js
- apps/web/assets/css/dam-app.css, i18n/pl.json, index.html, project.html
- memory.md ?87

---

## 2026-07-18 - Panel Zrodla bazy + tagi max 7 + viz ikony (icons3c)

### Komenda/Akcja
User /ui-taste: panel Baza brzydki (overflow, pomaranczowe kontrolki, ciasno); tagi max 7; wizualizacje Przejdz/Win jak global.

### Log/Status
1. dam-db-status.js: hint czytelniejszy; chipy trybu; custom check zamiast native.
2. dam-brand.css: panel padding/air, fiolet chipy/check, wrap + line-clamp, mobile full-width, scroll.
3. dam-tag-bar.js ROW_LIMIT=7; dam-viz.js SUBCAT_ROW_LIMIT=7 + Przejdz folder-open + Win SVG.
4. Cache icons3c (index brand, shell db-status, visualizations brand).
5. ui-taste Pass 1-5: screenshot+Read 375/768/1280 + viz CDP.

### Efekt/Fix
Panel Geex/DK purple, bez overflow poza ramka; tagi 7+N; viz = Eksplorer + Folder Windows.

### Test/Ewaluacja
- Pass 1 (struktura): chipy Auto/Synology/Lokalna, 3 zrodla, CTA Zapisz/Odswiez
- Pass 2-3 (~375/700): padding 16-18px, brak overflowX, fiolet check/chip
- Pass 4 (768): panel w viewport, tagi +25/+14/+9
- Pass 5 (1280): panelW=400, autoChipBg/checkBg rgb(171,84,219), textOverflow=false
- Viz CDP: Przejdz uil-folder-open; winAria Folder Windows + SVG; tag rows n=7 + plus

### Zrodla
- apps/web/assets/css/dam-brand.css, js/dam-db-status.js, dam-tag-bar.js, dam-viz.js, dam-shell.js
- apps/web/index.html, visualizations.html
- memory.md ?88

---

## 2026-07-18 - Karty: ramka 50% + incomplete fade (border50)

### Komenda/Akcja
User: ten sam fade obrysu dla niekompletnych (czerwony); obrys za mocny ? ~50% koloru (zielony i czerwony). Wash juz +30%/+50%.

### Log/Status
1. dam-app.css: `--ok` i `--incomplete` wspolny mechanizm `::after` mask border.
2. Alpha ramki 0.5 (do 50% wysokosci) ? 0.2@72% ? 0@95%.
3. Cache index dam-app `?v=20260718border50`.

### Efekt/Fix
Niekompletne maja ten sam fade obrysu co kompletne; kolor miekszy.

### Test/Ewaluacja
CDP: afterInc/afterOk rgba(...,0.5); beforeH 138px (8.625rem); 187 kart.

### Zrodla
- apps/web/assets/css/dam-app.css, index.html, memory.md ?87

---

## 2026-07-18 - Explorer: brand switch + badge unify (brandsw1)

### Komenda/Akcja
User /ui-taste: Marka: DK+GC biedna; przenies switch przy kategorie / toolbar produktu; ujednolic tagi jak na kartach; tytuly BATONY ? NAME +3px.

### Log/Status
1. Usunieto damBrandFilterTrigger z toolbara.
2. Chipy DK/GC w damSidebarBrandMount (Kategorie) + damProductBrandMount.
3. CSS segmented pill; explorer badges = pill viz-badge; tytuly +3px.
4. productDisplayTitle: CAT ? NAME; index/brand jako dam-viz-badge.
5. Cache brandsw1; tag-bar icons3 na explorer.

### Efekt/Fix
Filtr marki widoczny przy kategoriach; tagi/tytuly spojne z projektami.

### Test/Ewaluacja
- CDP: hasTrigger=false; sideChips+productChips; title BATONY ? 12X XMAS 19px; label 17px; badges carrier/lang/brand/index; folder 15px; tagi +25/+14/+9

### Zrodla
- explorer.html, dam-explorer.js, dam-brand-filter.js, dam-brand.css, memory.md ?89

---

## 2026-07-18 - Tagi cienkie + indeks pill global (tagthin1)

### Komenda/Akcja
User: napisy tagow BATONY/Nerkowcowy za grube (jak dam-tag-pill); indeksy zawsze zaokraglone globalnie (nie kwadrat dam-index-chip).

### Log/Status
1. .dam-viz-badge bazowo: weight 500, radius 999px, padding jak tag-pill.
2. .dam-index-chip = ten sam pill (bez mono/4px); admin tez 999px.
3. Fix utton.dam-viz-badge: font-family/size inherit + font-weight 500 (nie `font: inherit`).
4. .dam-prod-row__tags i karty projektow: weight 500.
5. 
enderIndexChips: klasy dam-index-chip dam-viz-badge dam-viz-badge--index.
6. Cache `?v=20260718tagthin1`.

### Efekt/Fix
Tagi listy produktow tak cienkie jak filtry smaku; indeksy pill wszedzie.

### Test/Ewaluacja
Hard refresh explorer; CDP: cat/subcat font-weight 500; index border-radius 999px.

### Zrodla
- dam-brand.css, dam-app.css, dam-explorer.js, explorer/index/viz/project.html, memory.md ?90

---

## 2026-07-18 - Propose JSON -> admin apply (egzekwowanie)

### Komenda/Akcja
User: kazdy pisze tekstowe zgloszenia JSON; tylko admin akceptuje i aktualizuje baze; kolejka + inbox; bez syncu SQLite przez Drive.

### Log/Status
1. `local_bridge.py`: `_require_login` / `_require_admin` z Bearer sesji.
2. User/power_user: `/rename-revision-prefix` i `/viz-request` = kolejka JSON + inbox.
3. Admin-only: decide, carrier-types, viz-flag, overrides, rename-index, change-log undo/redo, index rebuild, db/*.
4. Body.role/admin_mode nie daje privilege (anti-spoof).
5. TTL 72h: eskalacja do Inbox, BEZ auto-zapisu na dysk.
6. UI: dam-tag-edit / viz-request / inbox wysylaja `Authorization`; panel moderacji tylko admin.
7. memory.md ?86.

### Efekt/Fix
Dwie warstwy: kolejka (tag-proposals + inbox) <-> kanoniczna baza/dysk tylko po kliku admina.

### Test/Ewaluacja
- python ast OK; node --check JS OK
- create_or_apply session_role=user + spoof admin_mode -> immediate=False

### Zrodla
- apps/desktop/local_bridge.py
- apps/web/assets/js/dam-tag-edit.js, dam-viz-request.js, dam-inbox.js, dam-api.js
- memory.md ?86

---

## 2026-07-18 - Warianty count + chipy jeden styl (varcnt1)

### Komenda/Akcja
User: nie `4 rew.` tylko warianty; duza liczba jak +22 (+100%) obok tagu WARIANTY po lewej + ten sam tag w rzedzie; WSZYSTKIE chipy jeden styl; font labela nosnika.

### Log/Status
1. prodRowHtml: lewa kolumna count-num + Warianty; DamBadges multiIndex; usunieto revcount tekst.
2. CSS: count-num = tag-more 22px; date/status/carrier chips = pill token; label nosnika 16px.
3. Index/date HTML: zawsze dam-viz-badge klasy.
4. Cache varcnt1.

### Efekt/Fix
Czytelna liczba wariantow + spojne chipy w liscie i carrier.

### Test/Ewaluacja
CDP: left count + Warianty badge; brak `rew.`; carrier index/date radius 999px weight 500.

### Zrodla
- dam-explorer.js, dam-badges.js, dam-brand.css, explorer.html, memory.md ?91

---

## 2026-07-18 - Lista produktow: air + cienka typo (listair1)

### Komenda/Akcja
User: teksty za duze/grube; wiecej oddechu; tagi ten sam rozmiar + lekka ramka; 10px miedzy sekcjami; tlo wierszy ~10% szare jasniej niz #f3f2f7.

### Log/Status
1. Typo: panel 15/500, title 13.5/500, folder 13/500.
2. prod-list gap 10px; row bg #f8f7fb + padding 14/16; main gap 10px.
3. Chipy explorer: height 22px + border rgba(70,66,85,.14); tag=index.
4. Cache listair1.

### Efekt/Fix
Czystsza lista, spojne obramowane chipy, mniej inwazyjna typografia.

### Zrodla
- dam-brand.css, explorer.html, memory.md ?92

---

## 2026-07-18 - Panel head Wstecz/Do przodu (panelnav1)

### Komenda/Akcja
User /ui-taste: folder cieniejszy -1px; panel nieczytelny; MIXY za blisko; brak ikony kategorii + Wstecz/Do przodu; carrier ramka; ikony +50%.

### Log/Status
1. navStack + panelHeadHtml (strzalki, ikona, kicker, tytul, meta).
2. CSS head/mix/carrier air; folder 12/400; carrier icons +50%.
3. Cache panelnav1.

### Zrodla
- dam-explorer.js, dam-brand.css, explorer.html, memory.md ?93

---

## 2026-07-18 - Inbox expand + OAuth + legal + crypto

### Komenda/Akcja
User: gdzie zgloszenia w Wiadomosciach; nie da sie rozwinac; integracja Asana/Teams/Outlook + login; polityka/regulamin/licencja/zgody; szyfrowanie; konto w headerze zawsze widoczne.

### Log/Status
1. Fix Asana mapowania: parent/due/section (wczesniej due_on/gid = pusty detal).
2. Inbox: expand/collapse, filtr Zgloszenia DAM, chevron.
3. dam-shell: pusty #damHeaderAction wypelniany quickaction (konto).
4. OAuth: oauth_integrations.py + secret_box Fernet; endpoints /integrations/* + /oauth/callback.
5. Legal: privacy/terms/license/consents/docs-security.html.
6. Settings: karta Integracje + linki prawne.
7. cryptography w requirements; memory ?87.

### Efekt/Fix
Zgloszenia DAM w osobnym filtrze; Asana czytelna po kliku; login OAuth po Client ID; dokumenty pod Google verification.

### Test/Ewaluacja
- encrypt/decrypt Fernet OK; oauth status crypto_ok=True
- wymaga restart bridge + hard refresh inbox

### Zrodla
- apps/web/assets/js/dam-inbox.js, dam-shell.js
- apps/desktop/secret_box.py, oauth_integrations.py, local_bridge.py
- apps/web/privacy.html, terms.html, license.html, consents.html

---

## 2026-07-18 - Panel head panelnav2 + ui-taste QA

### Komenda/Akcja
Panel kategorii nieczytelny: folder typo -1px/lighter; head z ikona + Wstecz/Do przodu; oddech MIXY; carrier ramka; ikony +50%; /ui-taste 5 pass.

### Log/Status
1. Folder sidebar: 12px / font-weight 400.
2. `.dam-panel-head`: navStack back/forward + step-up, ikona folder/box, kicker+tytul+meta, ramka `#f8f7fb`.
3. MIXY margin od head 28px; carrier card radius 12px, bg `#f8f7fb`.
4. Ikony copy/folder 45px hit / 24px glyph; chevron 30px.
5. Cache `?v=20260718panelnav2`; memory ?93.

### Efekt/Fix
Naglowek panelu czytelny z nawigacja; historia Wstecz/Do przodu dziala (produkt?kategoria, Forward enabled).

### Test/Ewaluacja
- Pass 1 desktop: head + kicker Kategoria / BATONY, gap head?MIXY.
- Pass 2: product view icons 45/24, chevron 30, carrier frame.
- Pass 3: Back z produktu ? BATONY list; Forward enabled.
- Pass 4: mid viewport - brak `browser_resize` MCP; layout desktop smoke.
- Pass 5: final lock category panel clean.

### Zrodla
- apps/web/assets/js/dam-explorer.js
- apps/web/assets/css/dam-brand.css
- apps/web/explorer.html
- memory.md ?93
- skill ui-taste ?0.E

---

## 2026-07-18 - Faza 6: moderacja w Inbox (nie Settings)

### Komenda/Akcja
Usunac panel moderacji z ustawien; zbudowac zgloszenia + historie w Wiadomosciach (admin); dopiac luki planu (Wstecz, X, badge, notification-groups); 5-pass ui-taste.

### Log/Status
1. Usunieto karte Panel moderacji z settings.html; stub grupy grafik z notification-groups.json.
2. dam-inbox.js: GET /tag-proposals + approve/reject/pick w expand; filtry zgloszenie / historia; admin default zgloszenie.
3. DamTagEdit.renderModerationPanel -> redirect do inbox (deprecated).
4. Shell: Asana popup -> inbox.html; badge += pending; Wstecz = collapse -> popFilter -> nav; overlay #damLightbox.
5. CSS .dam-inbox-mod* touch 44px; copy bez auto-apply 72h; cache inbox3.
6. memory.md ?88.

### Efekt/Fix
Moderacja = workflow inbox admina z historia; Settings bez panelu decyzji.

### Test/Ewaluacja
- QA Pass 1-5 screenshot inbox (375/768/1280) - w toku.

### Zrodla
- apps/web/assets/js/dam-inbox.js, dam-shell.js, dam-tag-edit.js
- apps/web/inbox.html, settings.html
- apps/web/assets/css/dam-brand.css
- apps/web/data/notification-groups.json
- memory.md ?88

---

## 2026-07-18 - DK/GC chipy: jeden mount + styl tagow

### Komenda/Akcja
Usunac duplikat DK/GC z toolbara produktu; zostawic tylko w `.dam-cat-panel__head`; styl jak tagi, +50%, active kolor / off niemal biale.

### Log/Status
1. `dam-explorer.js`: bez `#damProductBrandMount`; mount tylko `#damSidebarBrandMount`.
2. `dam-brand-filter.js` `renderChips`: klasy `--dk/--gc` + `is-active` / `is-off`.
3. CSS: bez szarego tracka/border; 33px / 15.75px; active tint marki; off `#fafafa` / `#d0d1d8`.
4. Cache `?v=20260718brandchip3`; memory.md ?94.

### Efekt/Fix
Jedna para chipow przy Kategorie; stan ON/OFF czytelny; anatomia jak tagi DAM.

### Test/Ewaluacja
- Screenshot both-on: DK fiolet + GC cyan, 2 chipy, brak mountu w toolbarze.
- Screenshot GC-off: DK kolor, GC wyszarzone niemal biale.
- CDP: count=2, productMount=false, h=33, fontSize=15.75px.

### Zrodla
- apps/web/assets/css/dam-brand.css
- apps/web/assets/js/dam-brand-filter.js, dam-explorer.js
- apps/web/explorer.html
- memory.md ?94
- skill ui-taste (anatomia pill / active-off)

---

## 2026-07-18 - Warianty po prawej w liscie produktow

### Komenda/Akcja
Przeniesc blok N Warianty z lewej na prawa strone wiersza produktu.

### Log/Status
1. HTML: __main najpierw, potem __variants.
2. CSS grid: 1fr auto + justify-self end.
3. Bez duplikatu tagu Warianty w srodku (multiIndex false).
4. Cache ?v=20260718varright1; memory ?91.

### Efekt/Fix
4 Warianty przy prawej krawedzi wiersza.

### Test/Ewaluacja
- CDP: variants.left > main.right, nearRowRight=true.
- Screenshot BATONY Kalendarz: liczba + tag po prawej.

### Zrodla
- apps/web/assets/js/dam-explorer.js
- apps/web/assets/css/dam-brand.css
- apps/web/explorer.html

---

## 2026-07-18 - Produkt: Poka? wszystko + status tag

### Komenda/Akcja
Usunac nieklikalne meta Indeksy/Marka; zamiast DK/GC w toolbarze - switch Poka? wszystko; status edytowalny Shift+klik z zapisem do bazy.

### Log/Status
1. Usunieto dam-product-meta z widoku produktu.
2. Switch #damProdShowAll: OFF=aktualne, ON=nieaktualne/starsze pod karta.
3. statusBadge = dam-badge-tag kind=status; damSetRevisionStatus + saveCarrierOverride.
4. DamBadges.bindClicks(explorer); cache showall1; memory ?95.

### Efekt/Fix
Toolbar czytelny; nieaktualne tylko po wl?czeniu switcha; status jak globalny tag.

### Test/Ewaluacja
- Babka: brak meta/brandMount; switch widoczny.
- showAll ON: older 6300622 Nieaktualne + 6300684.00 Starsza.
- Status buttons data-tag-kind=status editable.

### Zrodla
- apps/web/assets/js/dam-explorer.js, dam-badges.js
- apps/web/assets/css/dam-brand.css
- apps/web/explorer.html

---

## 2026-07-18 - Pomoc FAB + wyszukiwarka (help3)

### Komenda/Akcja
FAB ? = F1; odswiezyc modal pomocy (Shift, zoom, Poka? wszystko); full help z wyszukiwarka problemow; 7 rund QA.

### Log/Status
1. dam-shortcuts.js: dynamiczny body, sekcja admin gdy role=admin, FAB #damHelpFab.
2. help.html: grupy + #damHelpSearch + empty state; PL odmiana temat/tematy/tematow.
3. CSS: FAB fioletowy 44px; kbd color #17161E (fix Bootstrap white-on-light).
4. Cache ?v=20260718help3; memory ?96.
5. QA 7 pass: FAB, modal admin, help search shift, empty, kbd contrast, FAB filled.

### Efekt/Fix
Pierwszy raz: ? w rogu ? skr?ty; admin widzi Shift; pe?na pomoc przeszukiwalna.

### Test/Ewaluacja
- Pass: FAB otwiera modal; Skr?ty admina + Tryb admina ON.
- Search \"shift\" ? 2 tematy (typ + status).
- Empty xyz ? 0 temat?w + sugestie.
- kbd czytelne (nie bia?e na bia?ym).

### ?r?d?a
- apps/web/assets/js/dam-shortcuts.js, dam-shell.js
- apps/web/assets/css/dam-brand.css
- apps/web/help.html, explorer.html
- memory.md ?96

---

## 2026-07-18 - Fix carrier nest (rozjechany widok)

### Komenda/Akcja
Carrier rows: chevron/copy/folder poza karta; ogromne puste przestrzenie. /ui-taste 5 pass.

### Log/Status
1. Root cause: `statusBadge()` = button wewnatrz `button.dam-carrier-toggle` - HTML auto-close, orphany.
2. Fix: status (+ admin index z button) w `.dam-carrier-toggle__trail` poza toggle.
3. Mobile trail wrap @ max-width 767.98px.
4. Cache carriernest2; memory ?94.

### Efekt/Fix
Karty ~74px; akcje i chevron w rzedzie; orphans=0.

### Test/Ewaluacja
- Pass 1-2 desktop: trail wewnatrz row, rowH 72.
- Pass 3: 375 stack CSS.
- Pass 4: ~768 orphans 0.
- Pass 5: 1440 allInside=true heights [74,74].

### Zrodla
- dam-explorer.js renderCarrierCard
- dam-brand.css .dam-carrier-toggle__trail
- systematic-debugging + ui-taste ?0.E

---

## 2026-07-18 - Inbox kontekst + toolbar + ramki 35% + widget viz (ui35f)

### Komenda/Akcja
Inbox propozycje typu czytelne (produkt + kola + tagi); toolbar Projektow zageszczony; obrys kart 35%; widget 3 viz z 100px thumb i globalnymi tagami.

### Log/Status
1. dam-inbox.js: productContextHtml, navCircles, enrich z file-index, tytul Nazwa ? zmiana.
2. CSS: .dam-nav-circles, inbox product strip, toolbar nowrap + status pod spodem, border alpha 0.35.
3. dam-dashboard-widgets.js: wiersz viz = 3 kola + thumb contain 100 + DamBadges; bindWinButtons.
4. HTML cache ?v=20260718ui35f; scripts badges/icons/paths na inbox + dashboard.
5. QA 5 pass toolbar (1280/375/768) + inbox expanded + dashboard CDP thumb ~100 / gap 100.

### Efekt/Fix
Admin widzi co zmienia (nazwa + DOYPACK + sciezka) i moze skoczyc do Eksplorera / folderu / viz. Search projektow rzuca sie w oczy; ramki kart delikatniejsze.

### Test/Ewaluacja
- Pass: inbox test2 ? BAG ? DOY + 3 kola + Zatwierdz/Odrzuc.
- Pass: projects searchW~666, gap 14, status under toolbar; border rgba(...,0.35).
- Pass: dashboard viz thumb~100, object-fit contain, 3 circles, badges.

### Zrodla
- apps/web/assets/js/dam-inbox.js, dam-dashboard-widgets.js
- apps/web/assets/css/dam-app.css, dam-brand.css, dam-dashboard.css
- apps/web/inbox.html, index.html, dashboard.html
- memory.md ?97

---

## 2026-07-18 - Zg?oszenia tabs + historia undo (inboxTabs6)

### Komenda/Akcja
Historia pod Zg?oszeniami (taby ikonowe); cofnij/pon?w; karty jak project-card (Przejd?/Win). Intensive QA 10 tur /ui-taste.

### Log/Status
1. Usuni?to sidebar ?Historia moderacji?; dodano `#inboxZgloszenieTabs` + `#inboxHistBar`.
2. `dam-inbox.js`: `zgloszenieSub`, filtry typy/wiz/historia, historyActionsHtml, productActionsHtml.
3. Bridge: `reopen_tag_proposal`, `undo_tag_proposal`, `proposal_id` w change-log; endpointy `/tag-proposals/reopen|undo`.
4. CSS: subtaby, hist-bar, product-card strip, mobile main przed ?r?d?ami.
5. Restart bridge 8766; cache `?v=20260718inboxTabs6`.

### Efekt/Fix
Admin w Zg?oszeniach prze??cza Typy / Wizualizacje / Histori?; w historii wraca do kolejki lub cofa ostatni? zmian? na dysku. Karta ma Przejd? + Folder Windows.

### Test/Ewaluacja
- Pass 1 (375): taby + karta test2; etykiety tab?w pod ikonami.
- Pass 2-3: spacing; main nad ?r?d?ami na w?skim.
- Pass 4 (768): hist-bar + Wr?? do kolejki (przycisk nad fold).
- Pass 5 (1280): taby z pe?nymi labelami, ODRZUCONO + Przejd?/Win.
- Pass 6-8: hist actions zawsze widoczne; disabled undo gdy brak change-log.
- Pass 9-10: deep-link `sub=historia`; brak osobnego filtra Historia w sidebar.

### Zrodla
- apps/web/inbox.html, dam-inbox.js, dam-brand.css
- apps/desktop/local_bridge.py
- memory.md ?98
- ui-taste ?0.E intensive 10

---

## 2026-07-18 - Inbox ?r?d?a ikony + badge/actor (inboxIcons1)

### Komenda/Akcja
Ikony i szerszy panel ?r?de?; liczniki jak tagi; tint badge/PL w headerze; wi?ksze status/tagi; attribution moderatora w prawym dolnym rogu karty.

### Log/Status
1. `inbox.html`: ikony przy filtrach ?r?de?; cache `?v=20260718inboxIcons1`.
2. `dam-brand.css`: grid 270px; `.dam-inbox-count` pill; header badge/lang tint+pad; status/tagi wi?ksze; `.dam-inbox-item__actor`.
3. `dam-inbox.js`: `shortActor` + `actorFootHtml` (Odrzuci?/Zatwierdzi?/Zmoderowa?/Zg?osi?).
4. QA screenshot?Read: sideW=270, icon=true, actor ?Odrzuci?: moderator?, badge tint.

### Efekt/Fix
?r?d?a czytelne z ikonami i pill-count; header nie ?martwy?; karty pokazuj? kto zdecydowa?.

### Test/Ewaluacja
- Pass: ?r?d?a 270px + ikony + count pills.
- Pass: header msg/notif/PL tint + padding.
- Pass: ODRZUCONO + foot tagi wi?ksze; actor bottom-right.

### Zrodla
- apps/web/inbox.html, dam-inbox.js, dam-brand.css
- memory.md ?99

---

## 2026-07-18 - Tag picker listy + historia undo (histUndo2)

### Komenda/Akcja
Pelne podkategorie/indeksy w popoverze (PL/EN); historia: real undo + 30s cancel + przebieg change-log przy konflikcie.

### Log/Status
1. Root cause: tag_groups.podkategoria puste; index picker = stub tylko current.
2. dam-tag-edit.js: collect z file-index products; bilingual labels; wide popover; ensureFileIndex.
3. Bridge: build_change_timeline_for_proposal, undo grace 30s, cancel_undo_tag_proposal, GET timeline.
4. Inbox: rozroznienie Cofnij na dysku / Wroc do kolejki; Anuluj cofniecie; panel Przebieg zmian.

### Efekt/Fix
27 podkategorii (np. Roslinne / plant based); ~335 indeksow z szukaniem; historia tlumaczy konflikty i brak sciezki na dysku.

### Test/Ewaluacja
- Pass: subcat popover 27 opts, wide 480px, PL/EN.
- Pass: index total 335, filter 00012 -> 000127.
- Pass: historia note + Przebieg zmian pokazuje missing path + audit reject.

### Zrodla
- apps/web/assets/js/dam-tag-edit.js, dam-inbox.js, dam-brand.css
- apps/desktop/local_bridge.py
- memory.md ?100

---

## 2026-07-18 - Sesja rehydrate + Dostosuj pulpit (dashCustom2)

### Komenda/Akcja
Naprawa login_required mimo UI zalogowanego; human copy Inbox; modal Dostosuj pulpit (purple checks, DnD, preview 350ms, dirty guard); ui-taste 3 rundy.

### Log/Status
1. Root cause: localStorage profil bez wa?nego Bearer; me() fallback offline udawa? sesj?.
2. auth_store.rehydrate_session + POST /auth/rehydrate; DamApi.rehydrate + me() auto; shell odrzuca token qa.
3. dam-dashboard-widgets/css: left stage, preview queue 350ms, checkbox 28px #AB54DB, DnD, dirty confirm 3 przyciski.
4. Inbox subtitle przepisany na ludzki PL.
5. ui-taste Pass 1-3: screenshot+Read (purple checks, left panel+preview, dirty dialog).

### Efekt/Fix
Zapis/zg?oszenia zn?w dzia?aj? po rehydrate z bound-session. Modal bez pomara?czowych checkbox?w, z podgl?dem i ochron? przed utrat? zmian.

### Test/Ewaluacja
- Pass: POST /auth/rehydrate ? ok + token; /auth/me z nowym Bearer ? ok (admin).
- Pass 1: cb 26-28px purple, panel left, preview Produkty.
- Pass 2: dirty confirm Zapisz zmiany / Nie zapisuj / Wr?? do wyboru.
- Pass 3: Wr?? ? modal zostaje; preview is-visible z-index 3.

### Zrodla
- apps/desktop/auth_store.py, local_bridge.py
- apps/web/assets/js/dam-api.js, dam-shell.js, dam-dashboard-widgets.js
- apps/web/assets/css/dam-dashboard.css, inbox.html, dashboard.html
- memory.md ?101

---

## 2026-07-18 - Carrier bar layout fix (explorer)

### Komenda/Akcja
Naprawa paska nosnika w Eksplorerze: tagi, duplikaty, DOM, ikony, header status.

### Log/Status
1. Nested button DamBadges w toggle -> DOM rozpad (karty poza lista).
2. Toggle=DIV role=button; indeks tylko w meta; bez duplikatu tagu nosnika przy label.
3. Tagi 22px; compact Multi; data w meta; label min-width.
4. Header 2 linie; refresh 48x48 biala ikona.
5. QA screenshot+CDP CIASTO+BURGER, 768 meta wrap.

### Efekt/Fix
dam-explorer.js, dam-badges.js, dam-brand.css, explorer.html ?v=carrierFix7

### Test/Ewaluacja
CDP: inList, aligned, badgeH=22, label widoczny, ikony right, refresh 48 white.

### Zrodla
ui-taste + verify-ui-after-changes

---

## 2026-07-18 - Sidebar active + bez podkreslen (navActive1)

### Komenda/Akcja
Zaznacz aktualna pozycje w menu sidebar kolorem Geex; usun podkreslenia z linkow nawigacji.

### Log/Status
1. Bug: active bylo na li, Geex styluje .geex-sidebar__menu__link.active; brak mapowania inbox.
2. dam-shell: class + aria-current na linku; sidebarActiveKey (project->projects); inbox w currentPageKey.
3. dam-brand: active purple text/bg + inset bar; collapsed purple ring; text-decoration none.

### Efekt/Fix
Wiadomosci / Dashboard wyraznie podswietlone; brak underline w sidebarze.

### Test/Ewaluacja
- Pass 1 inbox: Wiadomosci current, purple bar, deco=none.
- Pass 2 dashboard: Dashboard current.
- Pass 3 collapsed: ikona Dashboard purple.

### Zrodla
- apps/web/assets/js/dam-shell.js, css/dam-brand.css (?v=20260718navActive1)

---

## 2026-07-18 - Pelny commit + push (docs, UI, Postgres, DATABASE)

### Komenda/Akcja
User: pelny push, opis zmian, README, dokumentacja, commit + push lacznie z baza.

### Log/Status
1. Odswiezony dump na NAS (backup-postgres-database.sh) + sync do DATABASE/.
2. README: sekcja Postgres ADR-009, changelog 2026-07-18, ADR-009 w tabeli docs.
3. DATABASE/README + PROGRESS zaktualizowane.
4. Commit kodu (auth rehydrate, sidebar active, dashboard customize, inbox, PG client) + push origin/main.

### Efekt/Fix
Repo na GitHubie zsynchronizowane z lokalnym stanem + dump dnia.

### Zrodla
- README.md, DATABASE/README.md, PROGRESS.md, docs/ADR/ADR-009-postgres-synology.md

---

## 2026-07-18 - Dashboard viz-row responsive + ikony (vizRow2)

### Komenda/Akcja
ui-taste 3 rundy: overflow tagow, rowne ikony, Eksplorer = uil-sitemap fioletowy.

### Log/Status
1. Usunieto gap:100px; overflow:hidden na widget/media; thumb 72px; title line-clamp 2.
2. dam-nav-circles--stack pionowo; explorer purple filled + uil-sitemap; Win/SVG i image 16px szare.
3. Sitemap w inbox/viz/projects/profile (DAM Eksplorer). Folder Windows zostaje SVG/folder.

### Test/Ewaluacja
- Pass 1 900px: brak overflow, stack column, explorer sitemap purple.
- Pass 2 768px: mediaOverflows=false, badge w contenerze.
- Pass 3 1280px: ikony 32/16 rowne; sitemap.

### Zrodla
- dam-dashboard.css?v=20260718vizRow2, dam-brand.css?v=20260718vizRow1, dam-dashboard-widgets.js

---

## 2026-07-18 - Nosnik skrot DOY (carrierShort1)

### Komenda/Akcja
User: po zmianie tagu pojawia sie DOYPACK / pelna nazwa folderu zamiast skrotu DOY ze slownika.

### Log/Status
1. Root: label_pl=DOYPACK + CARRIER_FOLDER_PREFIX DOY->DOYPACK.
2. dam-labels: CARRIER_SHORTS + carrierLabel=short; label_pl tylko tooltip.
3. Bridge: prefix folderu = skrot; stare DOYPACK nadal match.
4. viz/badges/tag-edit: normalizacja do skrotu.

### Efekt/Fix
Tag i meta = DOY; rename na dysku = DOY - ...

### Zrodla
- naming-dictionary.json (short), dam-labels.js, local_bridge.py, dam-viz.js, dam-badges.js, dam-tag-edit.js

---

## 2026-07-18 - Header: Admin switch + kompakt Baza (adminHdr1)

### Komenda/Akcja
User: ikona bazy -50%; prze????czanie trybu admina tylko obok avatara (switch); header zawsze; zmienia si?? tylko title/subtitle.

### Log/Status
1. .dam-db-status__refresh 48???24px, pill min-height 56???28, ikona 12px; Pliki online dopasowane.
2. Switch Admin w headerze tu?? przed avatar (po PL); usuni??te #damAdminToggle / #vizAdminToggle.
3. Event dam:admin-mode dla explorer/viz/tag-edit.

### Efekt/Fix
Jedyny switch Admin = header. Baza kompaktowa. Chrome header globalny.

### Test/Ewaluacja
- CDP: refresh 24x24, icon 12px, order lang???admin???avatar.
- Screenshot dashboard/explorer/viz: brak lokalnego Tryb admina; title/subtitle per page.

### Zrodla
- dam-brand.css, dam-shell.js, dam-explorer.js, dam-viz.js, dam-tag-edit.js (?v=20260718adminHdr1)

---

## 2026-07-18 - Nosnik: UI pelna nazwa, dysk skrot (carrierUiLong2)

### Komenda/Akcja
User: DOY/FOL/BAT to tylko skroty w Eksploratorze Windows; w programie zawsze DOYPACK/FOLIA/BATON. Multi = Multijezyczny (OK). Napraw bledne foldery z logu.

### Log/Status
1. Potwierdzenie: `DamLabels.carrierLabel` = pelna nazwa; `carrierShort` + `CARRIER_FOLDER_PREFIX` = skrot na dysku.
2. Z `change-log.json`: 2 foldery `DOYPACK - ...` pod DATE ORANGE -> rename na `DOY - ...` (skrypt `fix_doypack_folder_prefixes.py --apply`).
3. Pasek historii: `Typ: DOY -> DOY` -> UI pokazuje `Typ: DOYPACK -> DOYPACK` (`humanCarrierForLog`); JSON zostaje kod.
4. memory.md ?102 przepisany (cofnieta bledna zasada "skrot globalnie").
5. Cache `?v=20260718carrierUiLong2`.

### Efekt/Fix
- UI karty: FOLIA / DOYPACK / REKAW.
- Dysk: `DOY - 17.02.2025 - 6300624.00 - SK HU HR`, `DOY - 20.09.2024 - 6300490.00 - GB AR`.
- Zrodlo prawdy operacji = change-log (nie szukanie na slepo).

### Test/Ewaluacja
- Screenshot viz + Read: badge i meta = DOYPACK/FOLIA.
- CDP: `DamLabels.carrierLabel('DOY') === 'DOYPACK'`.
- Get-ChildItem X: DATE ORANGE = prefiks DOY.

### Zrodla
- dam-labels.js, dam-badges.js, dam-tag-edit.js, dam-inbox.js, local_bridge.py, change-log.json, memory.md ?102


---

## 2026-07-18 - Lifecycle F/X/D + produkt TEST (life2)

### Komenda/Akcja
Admin status produktu/wariantu F/X/D z rename folderow, archiwum z wrapperem, historia previous_path. Produkt TEST do weryfikacji.

### Log/Status
1. Modul lifecycle_status.py + endpoint bridge /lifecycle-status.
2. UI admin: F/X/D/Odznacz na liscie produktow, toolbarze produktu i wierszu wariantu.
3. Indeks: strip suffix lifecycle + parse TEST-TEST; skip ARCHIWUM przy skanie.
4. Utworzono TEST LIFECYCLE w Batony z wariantem TEST-TEST.
5. Smoke API: rename F potem clear - OK; historia w lifecycle-status.json.
6. Intensive QA 10 passes (screenshot+Read): kontrolki widoczne, collapsed logo OK.

### Efekt/Fix
Gotowe do testow uzytkownika na TEST LIFECYCLE. Pelny rollout po OK od usera.

### Test/Ewaluacja
- dry_run F/D/X/product-D OK
- apply F + clear na TEST-TEST OK
- UI explorer admin: PRODUKT + wariant F/X/D

### Zrodla
lifecycle_status.py, local_bridge.py, dam-explorer.js, dam-brand.css, build-file-index.py, memory.md ?103

---

## 2026-07-18 - Policy nosnikow w bazie + ustawieniach (namingPolicy1)

### Komenda/Akcja
User: regu?a nie tylko w memory - zawsze i wszedzie; zapis w bazie i ustawieniach programu.

### Log/Status
1. `naming-dictionary.json` v2: `policy` + `short` na kazdym nosniku.
2. `app-settings.json` lustro policy; KV keys: naming-dictionary + app-settings.
3. Seed do Postgres `dam_kv_store` (`_seed_naming_policy_to_postgres` przy starcie bridge).
4. Bridge: `load_carrier_folder_prefix()` czyta slownik; pull KV nie cofa nowszej wersji lokalnej.
5. `DamLabels.CARRIER_POLICY` z slownika; settings.html karta ?Nazewnictwo nosnikow? + tabela.
6. docs/NAMING.md + memory ?102.

### Efekt/Fix
UI = label_pl, dysk = short - egzekwowane z DB/slownika, widoczne w Ustawieniach.

### Test/Ewaluacja
- PG: naming version 2, DOY.short=DOY, DOY.label_pl=DOYPACK, app-settings OK.
- Bridge prefix: DOY->DOY, FOLIA->FOL.

### Zrodla
- naming-dictionary.json, app-settings.json, local_bridge.py, dam-labels.js, settings.html, docs/NAMING.md

---

## 2026-07-18 - Instrukcje programu w bazie (instr1)

### Komenda/Akcja
User: wszystkie newralgiczne ustalenia (tez status aktywny/nieaktywny) musza byc w bazie jako instrukcje - zeby agent nie zapominal.

### Log/Status
1. Utworzono `program-instructions.json` (13 instrukcji, 10 critical) - naming, lifecycle F/X/D, change-log, UI, auth.
2. KV Postgres: `program-instructions` + rozszerzone: `change-log`, `lifecycle-status`, `product-status`.
3. Bridge: `GET /program-instructions`, seed przy starcie, push lifecycle po zmianie statusu.
4. Ustawienia: karta ?Instrukcje programu (baza)?.
5. AGENTS.md + `.cursor/rules/program-instructions.mdc` + docs/PROGRAM_INSTRUCTIONS.md + memory ?101b.

### Efekt/Fix
Zrodlo prawdy regu? = baza. Historia statusow/operacji tez w KV.

### Test/Ewaluacja
- PG: program-instructions count 13; change-log entries 6; lifecycle-status + product-status OK.

### Zrodla
- program-instructions.json, local_bridge.py, settings.html, AGENTS.md, .cursor/rules/program-instructions.mdc

---

## 2026-07-18 - Dashboard 4 najnowsze + siatka 11 + nav tiles

### Komenda/Akcja
User: 4 najnowsze wizualizacje (nie oats/cornflakes), indeks w tagach, +N klikalne, nav tiles zamiast topornych kol, notify jako pasek, siatka ~11x33 (stats 3x2, side 2), 5 passes QA.

### Log/Status
1. Ranking pickNewestViz: anti-bulk mtime + match Asana (flavor+family) + sort start projektu > mtime > rev; 1 produkt/projekt; bez pending/000000/test.
2. Widget title/i18n: 4 najnowsze; badge: brand+carrier+index; DamBadges +more expand.
3. CSS: layout 11 kol, grid 9 w main gap 16, stats span 3x2, viz span 5x9, strip span 4x2, side span 2; nav tiles 26px radius 7px.
4. Cache: dam-brand/dashboard CSS + widgets/badges JS na dashboard.html.

### Efekt/Fix
Oats/Cornflakes (bulk GC sync) poza lista. Top: Lemon Cheesecake, Cynamonka, Ciasto sliwkowe, Banoffee Kakao (+ indeksy). Tiramisu = #5 po dacie startu Asana C/03.

### Test/Ewaluacja
- CDP: btn 26x26 r=7px; gap 16; layout 11 cols; notify strip; 4 rows z indeksem.
- Pass 1-2/5 screenshot desktop; pass 768 black (emulation) - powrot do 1440; pass 5 final z Banoffee.
- Vision captions mylnie mowia circles - CDP/geometry = rounded squares.

### Zrodla
- dam-dashboard-widgets.js, dam-dashboard.css, dam-brand.css, dam-badges.js, dashboard.html, i18n pl/en

---

## 2026-07-18 - Tagi: casing globalny (tagCase1)

### Komenda/Akcja
User: nie mieszac WERSALIKOW z zapisem jak w zdaniu na badge'ach; globalnie jak Kulki Surowe vs DOYPACK.

### Log/Status
1. `DamLabels.formatTagLabel` - kody (carrier/brand/lang) = wersaliki; ludzkie = Title Case.
2. Kategorie w naming-dictionary: Kulki/Batony/... (v3).
3. dam-badges + dam-tag-bar + subcat pills uzywaja formattera; opakowanie doypack->DOYPACK.
4. Instrukcja `ui.tag_casing_global` w program-instructions (KV).

### Efekt/Fix
Karty: Kulki + Kulki Surowe + DOYPACK. Filtr: Banoffee, Mini Batoniki, DOYPACK.

### Test/Ewaluacja
- CDP: category=Kulki, subcat=Kulki Surowe, carrier=DOYPACK/FOLIA; pills Title Case + DOYPACK.

### Zrodla
- dam-labels.js, dam-badges.js, dam-tag-bar.js, naming-dictionary.json, program-instructions.json

---

## 2026-07-18 - Projekty: jedno X + persist search przy Wstecz

### Komenda/Akcja
User: dwa X w wyszukiwarce Projektow; po Wstecz wracac do widoku z zapytaniem (nie reset).

### Log/Status
1. #damProjectsSearch -> type=text; CSS hide webkit/ms search cancel.
2. dam-projects.js: persist query w sessionStorage + URL ?q= + replaceNavStackTop.
3. dam-shell.js: API 
eplaceNavStackTop.
4. Cache bust index + project shell.

### Efekt/Fix
Jedno X (custom). Wstecz z project.html -> index.html?q=test z polem i filtrem 1/181.

### Test/Ewaluacja
- CDP: type=text, clearCount=1, stackTop=index.html?q=test.
- goBack z project: href=index.html?q=test, value=test, status 1/181.
- Screenshot: projects-search-one-x.png, projects-search-restored-after-back.png.

### Zrodla
- index.html, dam-projects.js, dam-shell.js, dam-brand.css, project.html

---

## 2026-07-18 - PL pod angielska nazwa GC (Wizualizacje)

### Komenda/Akcja
User: przy angielskiej nazwie (np. MINCED) zawsze po `<br>` polska w nawiasie ze spacjami `( Mielone )`; rozmiar jak meta, kolor jak tytul.

### Log/Status
1. `product-name-pl.json` (EN?PL) + seed KV `product-name-pl`.
2. `DamLabels.productNamePl` / `productNamePlParen` (tylko brand GC).
3. `dam-viz.js`: tytul karty + modal z `.dam-viz-card__title-pl`.
4. CSS: 11px, weight 600, color `#464255`.
5. Instrukcja `ui.product_name_pl_under_en` w program-instructions (15). Cache `?v=20260718namePl1`.

### Efekt/Fix
MINCED ? MINCED + ( Mielone ); NUGGETS ? ( Nuggetsy ); itd. na kartach GC.

### Test/Ewaluacja
- CDP: `mincedHtml = MINCED<br><span class="dam-viz-card__title-pl">( Mielone )</span>`; mapSize=43.
- Screenshot + Read: viz-minced-pl-name.png ? Pass.

### Zrodla
- product-name-pl.json, dam-labels.js, dam-viz.js, dam-brand.css, program-instructions.json, local_bridge.py

---

## 2026-07-18 - PL: nawiasy szare jak meta, tekst polowa szarosci

### Komenda/Akcja
User: nawiasy jak meta (#8b8d97); tekst PL tylko w polowie tak szary.

### Log/Status
1. `productNamePlMarkup` - osobne spany paren/text.
2. CSS: paren `#8b8d97`, text `#696877`. Cache `namePl2`.

### Efekt/Fix
`( Kie?baski ostre )` - nawiasy = meta, slowo ciemniejsze od meta, jasniejsze od tytulu.

### Test/Ewaluacja
- CDP: paren=rgb(139,141,151)=meta; text=rgb(105,104,119); title=rgb(70,66,85).
- Screenshot: viz-pl-parens-gray.png.

### Zrodla
- dam-labels.js, dam-viz.js, dam-brand.css, visualizations.html

---

## 2026-07-18 - product-people: nakarmienie autorow do wyszukiwarki

### Komenda/Akcja
User: nakarm osoba/autor kontekstem Sylwii/Szymona/KW (bez glosnych TAG na kartach).

### Log/Status
1. `product-people.json` (by_id/by_index/by_id_prefix + aliasy).
2. `enrich-search-tags.py` merge + by_tag imion + search_blob.
3. KV `product-people` + instrukcja `search.product_people`.
4. Seed + enrich: 60 produktow z authors; sylwia=23, krzysztof=51 (Asana+mapa).

### Efekt/Fix
Szukajka `sylwia` filtruje wizki (Mielone, Prebiotyk, Kalendarz?); badge imienia na karcie = nie.

### Test/Ewaluacja
- DamSearch.search('sylwia'): mode=tag, 23 hits.
- Viz CDP: q=sylwia ? 17 kart, badgeHit=false.
- Screenshot: viz-search-sylwia.png.

### Zrodla
- product-people.json, enrich-search-tags.py, local_bridge.py, program-instructions.json

---

## 2026-07-18 - Dashboard viz scale (intensive QA 10)

### Komenda/Akcja
User: widget "4 najnowsze wizualizacje" za maly (~469px), za duzo pustego miejsca; responsywne skalowanie; 10 rund ui-taste + ui-ux-pro-max.

### Log/Status
1. Design Read: Geex B2B dashboard density (dials 5/3/5) - fill width, nie redesign.
2. CSS `dam-dashboard.css`: layout main/side = `1fr` + clamp side; viz-latest span 9 + 2x2 grid (@container >=560px); fluid thumb/title/badges/icons (cqi).
3. Mobile (<=720): ikony w rzedzie, thumb 56px, line-clamp 3.
4. Geex `.geex-content { width: 75-80% }` -> override `width: 100%` na dashboardzie.
5. Cache `?v=20260718dashVizScale8`.

### Efekt/Fix
Lista viz: ~667-779px (bylo ~469); thumb ~107px (bylo 56); 2x2 na desktopie; tytuly czytelniejsze.

### Test/Ewaluacja
Intensive QA 10 passes (screenshot+Read): 375 / 768 / 1280+ / collapsed sidebar. CDP: listW, thumb, 2-col grid.

### Zrodla
- apps/web/assets/css/dam-dashboard.css
- apps/web/dashboard.html

---

## 2026-07-18 - Explorer: prawda zapisu statusu (nie localStorage-only)

### Komenda/Akcja
User: niespojnosc - banner "Status zapisywany lokalnie..." vs "Baza online" / Synology.

### Log/Status
1. Stary copy opisywal workflow sprzed lifecycle (reczny eksport na P:DAM).
2. Prawda: F/X/D = most `/lifecycle-status` ? dysk + lifecycle-status.json + mirror product-status.json + PG KV; localStorage = kopia.
3. "Baza online" = Postgres Synology (KV), nie lokalny-only status.
4. Update paska admina + tip przycisku + dam:db-status event.

### Efekt/Fix
Komunikaty zgodne z mostem/PG. Przycisk = "Pobierz kopie statusu" (backup).

### Zrodla
- explorer.html, dam-explorer.js, dam-db-status.js, dam-shortcuts.js

---

## 2026-07-18 - Docs: README, agents, LANG_PROVENANCE + commit/push

### Komenda/Akcja
User: zrob dokumentacje z agentow i jezykow (README, memory), commit i push wszystko.

### Log/Status
1. `agents/README.md`, `docs/LANG_PROVENANCE.md`, update README / memory / PROGRAM_INSTRUCTIONS / AGENTS.
2. git add + commit + push origin main.

### Zrodla
- README.md, agents/, docs/LANG_PROVENANCE.md, memory.md

---

## 2026-07-18 - Doprecyzowanie: DK zawsze PL; extra z dowodu

### Komenda/Akcja
User: DK zawsze polskie (PL). Czasem PL/GB - wtedy GB z nazw/oznaczenia. GC bez zgadywania.

### Log/Status
1. `apply_brand_lang_baseline` w build-file-index.py (DK+=pl; GC bez baseline).
2. Zaktualizowano lang-provenance.md, program-instructions, memory ?107.
3. Rebuild file-index.

### Efekt/Fix
DK ma PL zawsze; GB i inne extra tylko z tokenu lub override.

### Zrodla
- agents/shared/lang-provenance.md
- apps/web/scripts/build-file-index.py
- apps/web/data/program-instructions.json

---

## 2026-07-18 - Prompt: pochodzenie jezyka (nie hardcode produktu)

### Komenda/Akcja
User: twarda zasada to rozumienie SKAD bierze sie jezyk (wszystkie kody), nie "6300572=CZ+SK". Finalize prompt; 3 podejscia globalnie.

### Log/Status
1. Drafty A/B/C: `agents/shared/lang-provenance.DRAFTS.md` (kaskada / evidence / provenance).
2. Kanon: `agents/shared/lang-provenance.md` (A+B+C).
3. Wpiecie: AGENTS.md, Builder+QA AGENT.md, memory ?107, `program-instructions` id `data.lang_provenance_only`.

### Efekt/Fix
Regula = metoda wykrywania z dowodu; przyklad 6300572 tylko jako audyt metody.

### Zrodla
- agents/shared/lang-provenance.md
- agents/shared/lang-provenance.DRAFTS.md
- apps/web/data/program-instructions.json

---

## 2026-07-18 - Jezyki: zero halucynacji (6300572 CZ/SK)

### Komenda/Akcja
User: 6300572 to CZ/SK (plik `GC_Burger_CZ_SK_6300572_...ai`), nie GB. Przeanalizowac wszystkie produkty/warianty; program tylko surowe dane albo `?`; reczne ustawienia nigdy nie nadpisywane. 5 rund sprawdzania.

### Log/Status
1. Root cause: brak langs w folderze SLEEVE + brak parsowania z nazw plikow + domysl GC->gb w UI/indeksie.
2. `build-file-index.py`: `parse_langs_from_text`, `infer_langs_from_files`, `apply_lang_overrides`, brak brand default.
3. `lang-overrides.json` (manual wins). Front: dam-viz/labels/badges + usuniete domysly w dam-api/projects/project.
4. Rebuild file-index (~181 produktow, viz~391).
5. 5 rund QA (dane + UI).

### Efekt/Fix
6300572: langs=['cz','sk']; modal: tagi CZ+SK, chipy `CZ - 6300572` / `SK - 6300572`, meta bez Wielkiej Brytanii. GB-only bez tokenu GB/UK w plikach: 0. SKLEP!=SK: 0.

### Test/Ewaluacja
- R1: index 6300572 -> cz+sk (disk AI: CZ_SK).
- R2: disk PROJECT potwierdza CZ_SK, brak GB.
- R3: gb-only z evidence w nazwach plikow: 20 ok / 0 false.
- R4: multi-lang z tokenow plikow (CZ_SK itd.).
- R5: empty langs zostaja puste (-> UI `?`); override store gotowy.
- Screenshot+Read: viz-modal-6300572-cz-sk.png PASS.

### Zrodla
- build-file-index.py, lang-overrides.json, dam-viz.js, dam-labels.js, dam-badges.js, dam-api.js, dam-projects.js, dam-project.js

---

## 2026-07-18 - Carrier row + inbox hist/product (intensive 10)

### Komenda/Akcja
Przebudowa .dam-carrier-toggle-row (grid body|end, chevron po prawej), typografia global --dam-fs-base, inbox .dam-inbox-hist-item + .dam-inbox-item__product.

### Log/Status
1. Markup carrier: __body + __end (akcje + chevron ostatni); click na caly pasek poza controls
2. CSS: min-height 56, wrap meta, 0 overlaps (CDP), chevron gap ~10px
3. Folder .dam-folder-item__name + label nosnika = 14px / 500-600
4. Inbox hist jak .dam-inbox-mod (44px btn); product head+meta; nav circles w rzedzie (nie stack)
5. Cache: ?v=20260718carrierInbox11

### Test/Ewaluacja
Intensive QA 10 passes (screenshot+Read): user/admin explorer, 768 wrap, expand click, inbox historia, compact product, sidebar collapsed.
PASS: brak nachodzenia, chevron right, typografia tokenami.

### Zrodla
- ui-taste / ui-ux-pro-max (intensive 10)
- dam-brand.css, dam-explorer.js, dam-inbox.js

---

## 2026-07-18 - product-people: nakarmienie autorow do wyszukiwarki

### Komenda/Akcja
User: nakarm osoba/autor kontekstem Sylwii/Szymona/KW (bez glosnych TAG na kartach).

### Log/Status
1. `product-people.json` (by_id/by_index/by_id_prefix + aliasy).
2. `enrich-search-tags.py` merge + by_tag imion + search_blob.
3. KV `product-people` + instrukcja `search.product_people`.
4. Seed + enrich: 60 produktow z authors; sylwia=23, krzysztof=51 (Asana+mapa).

### Efekt/Fix
Szukajka `sylwia` filtruje wizki (Mielone, Prebiotyk, Kalendarz?); badge imienia na karcie = nie.

### Test/Ewaluacja
- DamSearch.search('sylwia'): mode=tag, 23 hits.
- Viz CDP: q=sylwia ? 17 kart, badgeHit=false; pill Autor Sylwia aktywny.
- Screenshot: viz-search-sylwia.png.

### Zrodla
- product-people.json, enrich-search-tags.py, local_bridge.py, program-instructions.json


---

## 2026-07-18 - carrier meta right-align + inbox list-row (intensive QA 10)

### Komenda/Akcja
User: wyr?wnaj .dam-carrier-head__meta do prawej przy __end; przebuduj brzydkie li.dam-inbox-item; 10 rund ui-taste + ui-ux-pro-max.

### Design Read
Geex DAM product UI polish for admins; Linear-clean list-row; Geex purple tokens. Dials: V5 / M3 / D7.

### Log/Status
1. Carrier: meta jako osobna kolumna grid ody | meta | end (nie wewn?trz __end).
2. Meta desktop: nowrap + kompaktowy chip indeksu (Edytuj zamiast Edytuj indeks).
3. Inbox: anatomia __row / __row-end; actor (Zg?osi?/Odrzuci?) w __row-end obok daty.
4. Cache: ?v=20260718carrierInbox22.

### Efekt/Fix
- Carrier: CDP orderOk + oneLine @1280/1600; gap meta?end = 10px.
- Inbox mod: wysoko?? ~94px (by?o ~270+); actor w prawej wi?zce.

### Test/Ewaluacja
Intensive QA Pass 9-10 (screenshot+Read):
- Pass 9: explorer Babka carriers - one-line meta flush do akcji/chevron.
- Pass 10: inbox propozycje + historia + 375; brak regresji carrier overlap.

### Zrodla
- ui-taste / ui-ux-pro-max (intensive 10)
- dam-brand.css, dam-explorer.js, dam-inbox.js

---

## 2026-07-18 - Menu profilu: hierarchia + stonowany legal

### Komenda/Akcja
User: przebuduj okienko profilu (ui-taste, 4 passy); Prywatnosc/Regulamin mniej widoczne.

### Log/Status
1. Markup `.dam-user-menu`: identity ? Profil/Ustawienia/Pomoc ? micro legal ? Wyloguj.
2. CSS: legal 10px `#c2c3cb`; nav 14px `#464255`; accent `#AB54DB`.
3. `ensureUserMenuMarkup` migruje stare popup Geex. Cache `?v=20260718userMenu3`.

### Test/Ewaluacja
- Pass 1?4 screenshot+Read. Final: user-menu-pass4-final.png.
- CDP: legal 10px stonowany; nav ciemniejszy od legal.

### Zrodla
- dam-shell.js, dam-brand.css

---

## 2026-07-18 - Tagi na kartach Projektow: edit + AJAX + CTRL + GSAP

### Komenda/Akcja
User: edycja tagow z kart Projektow (globalnie), AJAX filtr przy kliku, CTRL+klik laczy tokeny, GSAP reveal 0.2s gora->dol; ui-taste 5 pass + gsap-core.

### Log/Status
1. Root cause: index.html nie ladowal dam-tag-edit.js; applyTagFilter wstawial surowy kod (01 - BATONY) zamiast etykiety; admin delay 520ms; brak CTRL append.
2. dam-badges.js: searchTokenForBadge + normalizeSearchToken; Ctrl/Meta append; Shift/Alt/dblclick = DamTagEdit; natychmiastowy filtr.
3. index.html: dam-tag-edit.js + vendor gsap.min.js; cache ?v=20260718tagAjax3.
4. dam-projects.js: revealProjectCards (autoAlpha + clipPath inset, 0.2s, stagger, prefers-reduced-motion).
5. dam-tag-bar.js: Ctrl+klik tez dolacza token.

### Efekt/Fix
- Klik Batony -> search=Batony, 70/181.
- Ctrl Banoffee -> Batony banoffee, 2 karty.
- Shift+klik -> popover Wybierz kategorie (7 opcji).
- GSAP mid: opacity 0 + clip 100%; po ~0.35s opacity 1.

### Test/Ewaluacja
ui-taste 5 pass screenshot+Read:
- Pass 1 375: struktura + query batony banoffee / 2/181 - clean
- Pass 2 375: spacing kart - clean
- Pass 3 375: mobile stack - clean
- Pass 4 768: tablet karty - clean
- Pass 5 1280: 2 karty side-by-side, search Batony banoffee - clean

### Zrodla
- gsap-core (autoAlpha, clipPath, matchMedia/reduced-motion)
- ui-taste 5 passes
- dam-badges.js, dam-projects.js, dam-tag-bar.js, index.html

---

## 2026-07-18 - Lifecycle path_not_found + toggle D + search scope

### Komenda/Akcja
User: ponowne D nie odznacza; X?F/D = Blad path_not_found; wyszukiwarka ma pokazywac strukture Produkt/Wariant + chipy Wszystko/Produkty/Warianty. Skills: systematic-debugging + ui-taste 5 passes.

### Log/Status
1. Reproduce: wariant w `? ARCHIWUM/.../TEST-TEST - X`, UI wysylalo stara sciezke `...- D` ? path_not_found.
2. Fix engine: `resolve_existing_path` (store + history + letter variants + skan ARCHIWUM) w `lifecycle_status.py`.
3. Fix UI: toggle is-on?clear; path z lifecycle-store; `patchPathsAfterLifecycle` przed rebuild; status z lifecycle-store.
4. Search: chipy scope + hits Produkt/Wariant (nested); CSS is-soft przy Wszystko.
5. Restart bridge (pythonw local_bridge.py). Cache explorer `?v=20260718lifeFix4`.

### Efekt/Fix
- Smoke FS: clear / D / clear / X / X?F (stale path) / clear = OK na TEST-TEST.
- Browser: klik D ? folder `- D`; ponowne D ? clear bez path_not_found.
- Search "test": PRODUKT TEST LIFECYCLE + nested WARIANT TEST-TEST.

### Test/Ewaluacja
ui-taste 5 pass screenshot+Read:
- Pass 1 375: struktura chipow + nested hits - clean
- Pass 2 375: spacing / is-soft chipy - clean
- Pass 3 375: mobile search + product open - clean
- Pass 4 768: tablet search dropdown - clean
- Pass 5 1280: F/X/D + Odznacz + search structure - clean

### Zrodla
- systematic-debugging (reproduce ? isolate stale path ? store resolve)
- ui-taste 5 passes (Geex preserve, dials match existing)
- lifecycle_status.py, dam-explorer.js, dam-search.js, dam-brand.css, explorer.html


---

## 2026-07-18 - Wizualizacje: Cofnij wyzej + DK/GC jak w Eksplorerze

### Komenda/Akcja
User: przenies Cofnij/lifecycle hint wyzej (nad pasek Skala); uspojnic Marka DK/GC z chipami z Eksplorera.

### Log/Status
1. visualizations.html: vizBrandMount + DamBrandFilter.renderChips zamiast dropdown Marka: DK+GC.
2. (nadpisane przez searchUnify3) damChangeLogBar wraca do grid-toolbar obok Skali.
3. Grid toolbar: status + Cofnij/Ponow + Skala (prawo).
4. CSS; cache pozniej searchUnify3.

### Efekt/Fix
Chipy DK/GC jak Eksplorer. Skala przy prawej krawedzi nad siatka.

### Test/Ewaluacja
Patrz wpis searchUnify3 (ponizej).

### Zrodla
- ui-taste (Geex redesign-preserve)
- dam-brand-filter.js, visualizations.html, dam-viz.js, dam-brand.css

---

## 2026-07-18 - Przywr?cenie wyszukiwania Sylwia/Krzysztof/Szymon (peopleFix1)

### Komenda/Akcja
User: dalej nie da sie wyszukac po Sylwia/Krzysztof/Szymon ? mialo sie dac (ustalone wczesniej).

### Log/Status
1. Kontekst z chatu [product-people](a78fa004-2674-4f22-a383-c0f448f9635e): mapa kto?produkt, bez badge na kartach; enrich do authors/by_tag.
2. Reproduce: file-index po rebuildzie mial `authors=0`, `by_tag.sylwia=0` (enrich zniknal).
3. `python apps/web/scripts/enrich-search-tags.py` ? sylwia=23, krzysztof=51, szymon=2, authors=60.
4. Hook: koniec `build-file-index.py` zawsze odpala enrich (zeby Skanuj dysk nie kasowal osob).
5. memory #108 zaktualizowane.

### Efekt/Fix
Viz `q=sylwia`: Mielone, Prebiotyk, Odpornosc, Energia, Kalendarz, kremy?; pill Autor Sylwia widoczny.

### Test/Ewaluacja
Browser fill sylwia ? karty OK; CDP authorsInMem=60, by_tag.sylwia=23.

### Zrodla
- systematic-debugging
- a78fa004 (ustalenie people1), product-people.json, enrich-search-tags.py, build-file-index.py

---

## 2026-07-18 - Label nosnika: kolor jak viz title, 16px (nie scinac)

### Komenda/Akcja
User: `.dam-carrier-toggle__label` - nie pomniejszac; zmienic KOLOR na jak `.dam-viz-card__title`.

### Log/Status
1. Przyczyna: wczesniejszy pass scial font do `var(--dam-fs-base, 14px)` zamiast tylko koloru.
2. Fix: `font-size: 16px` (memory #91); `color: #464255` (jak viz title); usunieto zielony override `--aktualne`.
3. Cache explorer `?v=20260718carrierLabel16`. memory #109 poprawione.

### Efekt/Fix
Live: KARTON 6x MINI = 16px / 600 / rgb(70,66,85).

### Test/Ewaluacja
Screenshot BABKA CYTRYNOWA + CDP computed styles - Pass.

### Zrodla
- systematic-debugging, ui-taste (Geex preserve)
- dam-brand.css `.dam-carrier-toggle__label`

---

## 2026-07-18 - Globalny search + declutter toolbar Viz (searchUnify3)

### Komenda/Akcja
User: ujednolicic pasek wyszukiwania wszedzie (Projekty/Viz/Eksplorer); na Viz przeniesc Poka? wszystkie / Marka / Jezyki pod TAGI; Skale do prawej nad wizualizacjami; przyciski akcji na bialym tle wynikow.

### Log/Status
1. `visualizations.html`: toolbar = sam search; secondary pod tagami; Skala + Cofnij w `.dam-viz-grid-toolbar__end`.
2. `index.html`: Od?wie?/Skanuj ? `.dam-projects-grid-toolbar` pod tagami.
3. `explorer.html`: Od?wie?/Eksportuj ? `.dam-explorer-results__toolbar` (biale).
4. `dam-brand.css` + `dam-app.css`: kanon `.dam-search-wrap` max-width:none, input 44px; style secondary/grid toolbars.
5. Cache `?v=20260718searchUnify3`. memory.md #111.

### Efekt/Fix
@1440: searchW = 1071px na Viz / Projekty / Eksplorer (identyczny chrome). Viz: secondaryBelowTags; zoomFlush=0.

### Test/Ewaluacja
ui-taste 5 pass screenshot+Read:
- Pass 1 375: struktura search?tagi?secondary?Skala - clean
- Pass 2 375: spacing secondary + grid toolbar - clean
- Pass 3 375: clear X + mobile stack - clean (h-scroll tylko geex-customizer/header - preexist)
- Pass 4 768: brand chips OK, layout - clean
- Pass 5 1280/1440: Viz + Projekty + Eksplorer search unify - clean

### Zrodla
- ui-taste, visual-qa-testing, verifying-in-browser
- visualizations.html, index.html, explorer.html, dam-brand.css, dam-app.css

---

## 2026-07-18 - Search scope radio + biala tablica (Eksplorer/Projekty/Viz)

### Komenda/Akcja
User: chipy Wszystko/Produkty/Warianty pomylone (multi soft); odklik = Wszystko; biala tablica pod inputem; to samo wyszukiwanie wszedzie; Wizualizacje locked Wszystko + wygaszone Produkty/Warianty; Projekty produkty+warianty. Skill: ui-taste 5 passes.

### Log/Status
1. Bug logiki: przy Wszystko klik Produkty wylaczal produkty (zostawial warianty) - odwrotnie.
2. Rewrite `dam-search.js`: `getScopeMode`/`setScopeMode` radio; odklik products/variants ? all; usunieto `is-soft`.
3. CSS: `.dam-search-wrap--panel` + wyniki `position:static` w tablicy; disabled chips.
4. Markup scope na index + visualizations; viz `bindScopeChips(..., {locked:true})` bez zapisu localStorage.
5. Projekty: filtr `productHaystack` / `variantHaystack` wg mode.
6. Cache `?v=20260718scopeRadio2`.

### Efekt/Fix
- CDP logic: all?products?odklik all?variants?all OK.
- Viz: Wszystko on, Produkty/Warianty disabled.
- Projekty/Eksplorer: chipy w bialej tablicy.

### Test/Ewaluacja
ui-taste 5 pass screenshot+Read:
- Pass 1 375: hierarchy - panel+chips; defect: wyniki absolute wygladaly osobno ? fix static in-panel
- Pass 2 375: spacing panel - clean (geometry scopeInside/resInside)
- Pass 3 375: mobile + radio paint - clean
- Pass 4 768: tablet panel - clean
- Pass 5 1280: desktop + spot Viz locked + Projekty chips - clean

### Zrodla
- ui-taste (redesign preserve Geex, dials 5/3/5)
- dam-search.js, dam-brand.css, dam-projects.js, dam-viz.js, explorer/index/visualizations.html

---

## 2026-07-18 - Viz toolbar NAD Poka? wszystkie / DK GC

### Komenda/Akcja
User: `dam-viz-grid-toolbar` (status/Cofnij/Ponow/lifecycle/Skala) ma byc WYZEJ - nad Poka? wszystkie + DK + GC.

### Log/Status
1. Przeniesiono `.dam-viz-grid-toolbar` w `visualizations.html` przed `.dam-viz-secondary-filters` (wewnatrz search-block).
2. Marginesy CSS: toolbar 4/8, secondary 0/12.
3. Cache `?v=20260718vizToolbarUp1`.

### Efekt/Fix
Kolejnosc: tagi ? toolbar (Cofnij/Skala) ? Poka? wszystkie/DK/GC ? siatka. CDP: toolbarTop 568 < secondaryTop 612.

### Test/Ewaluacja
Screenshot + Read: order OK.

---

## 2026-07-18 - Fix Wstecz panelu + AJAX search w Eksplorerze

### Komenda/Akcja
User: przycisk Wstecz (dam-panel-nav -1) nie wraca; wyszukiwarka powinna AJAX-em odswiezac panel .dam-explorer-panel.

### Log/Status
1. Root cause Wstecz: historia (navGo) miala pierwszenstwo i po breadcrumb/push wracala do produktu (pulapka).
2. panelStepUp: krok w gore hierarchii (produkt -> wyniki/kategoria -> clear search -> welcome); zdejmowanie productId ze stosu.
3. Breadcrumb: bez navPush przy cofaniu; trim product ze stosu.
4. applySearchToPanel: live DamSearch -> state.searchHits -> renderSearchResultsPanel (nie zostawia listy kategorii).
5. Cache `?v=20260718panelNavSearch2`.

### Efekt/Fix
- Produkt CASHEWS -> Wstecz -> Batony -> Wstecz -> welcome.
- Query `cashews`: panel Wyszukiwanie, 8 produktow; Wstecz z produktu wraca do wynikow.
- `TEST-TEST`: panel pokazuje Brak wynikow (produkt usuniety z X:/Marketing, brak w file-index).

### Test/Ewaluacja
CDP + screenshot+Read: product view, search panel Wyszukiwanie/cashews OK.

### Zrodla
- dam-explorer.js, explorer.html, dam-search.js

---

## 2026-07-18 - Repair TEST LIFECYCLE foldery + lifecycle bugs

### Komenda/Akcja
User: sprawdz stan produktu testowego po klikaniu; co z folderami; napraw bledy.

### Log/Status
1. Stan: produkt w `? ARCHIWUM` jako `? - X`, pusty wrapper bez `- X`, brak w root BATONY; store.revisions.TEST-TEST stale F na martwej sciezce.
2. Przywr?cono produkt live (clear) + usunieto orphan wrapper.
3. Fix `lifecycle_status.py`: cleanup pustych wrapperow, rename przez pusty dest, sync revisions po cascade produktu.
4. Fix `dam-explorer.js`: lifecycle > localStorage; clear != Starsza; fallback JSON gdy bridge 404.
5. Rebuild `file-index` + czyszczenie `product-status` / `lifecycle-status` dla TEST.
6. QA: variant X?clear usuwa wrapper; UI: TEST-TEST, Aktualne, bez chip X.

### Efekt/Fix
Live: `X:\?\BATONY\TEST LIFECYCLE ? [ nerkowcowy ]\BAT - 35 g - 18.07.2026 - TEST-TEST`. ARCH bez leftoverow TEST. Cache `?v=20260718testRepair3`.

### Test/Ewaluacja
CDP: search TEST-TEST ? produkt bez X; wariant Aktualne + index TEST-TEST.

### Zrodla
- apps/desktop/lifecycle_status.py, apps/web/assets/js/dam-explorer.js, data/*.json

---

## 2026-07-18 - Settings rebuild + global accent (chrome only)

### Komenda/Akcja
User: przebuduj settings.html widgetowo (jak dashboard); edytowalny kolor glowny (akcent chrome: FAB, sidebar active, breadcrumb, ADMIN); TAGI bez zmian; edytowalne powiadomienia; wiecej integracji; 12 pass QA.

### Log/Status
1. Design Read: B2B DAM settings, Geex preserve, dials ~5/3/5. Intensive QA 12 pass.
2. Nowe: `dam-accent.js/css`, `dam-settings.css/js`; rewrite `settings.html` (bento: profil, akcent, dysk, prefs, integracje+stuby, notify grafik, naming RO, instructions RO).
3. Bridge: GET/POST `/notification-groups`.
4. Soft-boot + `ensureAccentCss` w `dam-shell.js`.
5. Fix: selektory accent bez `body.dam-app` (brak klasy na stronach) - FAB/sidebar/scope pills teraz biora `--dam-primary`.
6. Cache `?v=20260718accent2` / `set4`.

### Efekt/Fix
- Akcent Ocean `#0B6E99`: FAB + Wszystko + ADMIN chrome; tagi smak/typ/opakowanie/autor bez zmian (CDP).
- Settings: widget grid + jump pills + edycja profilu/notify; Reset Geex `#AB54DB`.

### Test/Ewaluacja
Pass 1-9 (wczesniej): struktura, header, mobile grid, accent, desktop.
Pass 10: explorer Ocean - chrome blue, tagi izolowane.
Pass 11: desktop 1280 + collapsed sidebar + Reset Geex.
Pass 12: 768 stack, integrations+notify, 375 full-width content (main 375px).

### Zrodla
- ui-taste, ui-ux-pro-max, systematic-debugging
- Flowbite-inspired settings sections (structure only, Geex tokens)
- apps/web/settings.html, dam-accent.*, dam-settings.*, dam-shell.js


---

## 2026-07-18 - Settings UX polish + accent/theme overlay (intensive 10)

### Komenda/Akcja
User: kolory hover zostaja fioletowe; filtr sekcji zamiast scroll + X; unified buttons; bez Geex w copy; padding +8; light/dark jako nakladka; /ui-ux-pro-max 10 pass + /ui-taste + systematic-debugging.

### Log/Status
1. Root cause: hardcoded rgba(171,84,219) w style.css sidebar hover + dam-brand.css; nie szlo za --dam-primary.
2. Fix: dam-brand bulk ? color-mix/var; style.css sidebar hover ? color-mix; rozbudowa dam-accent.css.
3. Settings: filtr chipow + X (nie anchors); unified .dam-sw-btn 44px; padding kart 24/26 (+8); copy PL user-friendly; Przywr?? domy?lny.
4. Theme overlay: dam-theme.js + dam-tokens mapuje Geex surface vars; soft-boot w dam-shell.
5. Cache ?v=20260718set5b / accent3 / theme1.

### Efekt/Fix
- Akcent #008244: Zapisz, FAB, chipy, ADMIN, avatar, soft Sprawd? - zielone (CDP).
- Filtr Wygl?d ukrywa pozostale karty (display:none); X ? Wszystko.
- Dark: data-theme=dark, karty #201f28, body ciemne.

### Test/Ewaluacja
Pass1 desktop padding 24/26 + btn 44px. Pass2 filtr. Pass3 green accent. Pass4 dark. Pass5 all+green. Pass6 mobile chips scroll. Pass7-10: hover/filter/clear/sidebar.

### Zrodla
- ui-taste, ui-ux-pro-max, systematic-debugging
- apps/web/settings.html, dam-settings.*, dam-accent.*, dam-theme.js, dam-tokens.css, dam-brand.css, style.css


---

## 2026-07-18 - Desktop title/icon/size + licencja KW + security bridge

### Komenda/Akcja
User: wieksze okno (bez scrolla poziomego); ikona Windows; nazwa `DAM - Dobra Kaloria - Inyfinn`; licencja na dane KW + wycena rynkowa; wyjasnienie Metadata/DB PARTIAL; audyt i latanie luk.

### Log/Status
1. `APP_TITLE` + mutex w `runtime_config.py`; VBS MsgBox; skrot pulpitu z nowa nazwa + `dam_app.ico`.
2. `launch.py`: `preferred_window_size()` (~92% ekranu), min 1400x800; `webview.start(icon=...)` + WM_SETICON (pythonw nie bierze ikony z exe).
3. Przebudowa ICO: zielony kafelek + ?DAM? (`scripts/build-dam-ico.py`).
4. `LICENSE.md` + `license.html`: wlasciciel KW; PESEL maskowany 93*****179; bez dowodu; adresy + kontakt; kwoty bazowe 6900 / 490 / 890 PLN netto (indywidualnie). Aktualizacja: usunieto pelny PESEL i dane dowodu.
5. Security `local_bridge.py`: media path jail + login; reveal bez shell; auth na audit/media/browse/config; register bootstrap|admin; CORS Origin; OAuth escape; limit body/media.

### Efekt/Fix
- Okno: tytul `DAM - Dobra Kaloria - Inyfinn`, rozmiar 1920x1200 na testowym ekranie, WM_GETICON != 0.
- `/media` nie serwuje plikow poza Marketing; open register zablokowany gdy sa juz userzy.

### Test/Ewaluacja
- Relaunch run-dam.vbs: MainWindowTitle OK; GetWindowRect ~1920x1200; icon handles ustawione.
- py_compile: launch, runtime_config, local_bridge, auth_store.

### Metadata/DB (odpowiedz)
PARTIAL = Postgres trzyma auth/sesje/audit_log/KV; relacje produkt?pliki?wersje?tagi w `file-index.json` + KV, nie w FK SQL. Logi audit sa. Brakuje pelnego schematu relacyjnego w sciezce Geex UI (Laravel ma bogatszy schemat, ale UI z niego nie zyje) - ryzyko spojnosci = dwa swiaty JSON/KV vs SQL, nie ?brak logow?.

### Zrodla
- pywebview `start(icon=)` WinForms (`_state['icon']`)
- Wycena rynkowa DAM/MAM SMB (wide?ki cloud/on-prem) - baza 6900/490/890 PLN
- LICENSE.md, apps/desktop/launch.py, local_bridge.py


---

## 2026-07-18 - Fix offline + logout + folder picker + meta FK (3 rundy)

### Komenda/Akcja
User: baza i dysk offline; brak wylogowania; brzydki modal sciezki bez pickera folderu; zbudowac Metadata/DB FK; ui-taste + debugger; 3 rundy.

### Log/Status
1. Root cause: 401 na `/db/status` i `/files/status` (fetch bez Bearer) + logout noop.
2. Status/config/validate bez Bearera na localhost; media/browse/mutations z auth.
3. `auth_store.logout` + `/auth/logout` + prawdziwy `DamApi.logout` ? signin.
4. `pick_folder` (FOLDER_DIALOG) + przycisk Wskaz folder w modalu.
5. `meta_store.py`: FK sync 181/457/5010/77/3; hook po index rebuild; GET `/meta/status`.

### Efekt/Fix
- Pliki online + Baza online (postgres @ inyfinn.synology.me).
- Modal: solid green browse 44px; 3 pass screenshot.

### Test/Ewaluacja
Pass1 modal+online. Pass2 browse green. Pass3 CDP online + logout=fn.

### Zrodla
- debugger, ui-taste, meta_store.py, dam-paths.js, dam-api.js, launch.py


---

## 2026-07-18 - Lifecycle Bez statusu + cascade X (lifeBez1)

### Komenda/Akcja
User: Odznacz nie sciaga F; produkt Bez statusu a wariant D mimo czystej sciezki dysku; rename konflikty przy szybkich klikach; produkt X vs wariant X; przycisk = Bez statusu; Odswiez liste ma resync z dysku.

### Log/Status
1. Root cause UI: `is_latest` mapowane na Aktualne/F mimo braku literki na dysku.
2. `lifecycle_status.py`: lock apply; `find_live_product_dir`; wariant X bez X na produkcie live; produkt X cascade; restore do live z aktualna literka produktu.
3. `dam-explorer.js`: badge/btn Bez statusu; kolejka klikow; `syncLifecycleFromDiskIndex` przy Odswiez liste; dysk = prawda.
4. Restart `local_bridge` (nowy modul) - sesje padly (401) az user zaloguje ponownie.
5. Disk FINAL clean: `BATONY/TEST LIFECYCLE ? [ nerkowcowy ]/BAT - 35 g - 18.07.2026 - TEST-TEST`.

### Efekt/Fix
- UI: produkt + wariant **Bez statusu** (zielone is-on), badge Bez statusu (nie Aktualne/D).
- Combo Python PASS: product F?clear; variant F?clear; variant X (produkt live bez X)?restore; product X (oba -X w ARCHIWUM)?restore clear.

### Test/Ewaluacja
- Screenshot `test-lifecycle-bez-statusu.png` + Read: oba scope Bez statusu.
- CDP: buttons clear is-on; bridge POST bez sesji = 401 (oczekiwane po restarcie).
- Cache: `?v=20260718lifeBez1`.

### Zrodla
- systematic-debugging, verifying-in-browser
- apps/desktop/lifecycle_status.py, apps/web/assets/js/dam-explorer.js


---

## 2026-07-18 - Production Readiness / Go-Live (PRR)

### Komenda/Akcja
User: aplikacja jutro do klienta - przebadaj, znajdz luki, zalataj, zbuduj plan weryfikacji i wypuszczania produkcyjnego.

### Log/Status
1. Nazwa formalna: Production Readiness Review + Go-Live Checklist -> `GO_LIVE.md`.
2. Smoke Gate B: `apps/desktop/scripts/smoke-production.ps1` (PASS + 1 WARN haslo seed).
3. Branding: usunieto user-facing `DAM ETA` -> `DAM` / `DAM - Dobra Kaloria - Inyfinn`.
4. Signin: rejestracja publiczna ukryta (bootstrap tylko gdy 0 userow); `GET /auth/registration-open`.
5. Hasla: seed wymaga `DAM_SEED_PASSWORD`; skrypty `set-all-passwords.py` / `set-user-password.py`; register min 8 znakow.
6. Restart `local_bridge` z nowym endpointem; pliki/db/meta online; media 401.

### Efekt/Fix
- Gate B smoke: FAIL=0 WARN=1 (haslo `test` nadal aktywne - BLOKADA Gate C).
- UI signin: Witaj w DAM, brak zakladki Utworz konto, footer admin-only.

### Test/Ewaluacja
- smoke-production.ps1 exit 0
- Screenshot signin `golive-signin-v3.png` + Read (vision): branding OK, rejestracja ukryta, PL ze znakami.

### Zrodla
- GO_LIVE.md, auth_store.set_user_password, local_bridge /auth/registration-open, signin.html


---

## 2026-07-18 - Follow-up PRR scan (P0/P1)

### Komenda/Akcja
Domkniecie luk z Prod readiness codebase scan po GO_LIVE.

### Log/Status
1. logout + clear_bound_session
2. POST /machine-config -> require login (401 bez Bearer)
3. install-desktop-shortcut.ps1 -> DAM - Dobra Kaloria - Inyfinn (+ usun DAM ETA.lnk)
4. OAuth callback z CORS_ORIGIN / DAM_UI_ORIGIN
5. dam-api cache-bust 20260719golive1; komunikat hasla min 8 + admin_required

### Test/Ewaluacja
POST machine-config 401; logout bound clear OK; smoke FAIL=0 WARN=1 (haslo test).

### Zrodla
- auth_store.py, local_bridge.py, dam-api.js, install-desktop-shortcut.ps1

---

## 2026-07-18 - Lifecycle reconcile mtime + Stosuj zmiany (lifeSync1)

### Komenda/Akcja
User: po zmianie program nie weryfikuje dysku; Odswiez = dysk->program; Stosuj zmiany = FORCE program->dysk; start = mtime (kto pozniej zmienil literke); X na dysku poza archiwum -> przenies przy boot.

### Log/Status
1. `applied_at` + `source` przy kazdym apply programu.
2. `pull_lifecycle_from_disk` / `reconcile_lifecycle_on_boot` / `force_apply_program_to_disk` w lifecycle_status.py.
3. Bridge: GET `/lifecycle-reconcile?mode=pull|boot`, POST `/lifecycle-force`.
4. UI: tip Odswiez; przycisk `#damLifecycleForce` Stosuj zmiany; boot reconcile po load; toast przy drifts.
5. QA TEST: pull F->clear drifts=2; boot program_wins przy nowszym applied_at; FORCE dry planned=1.

### Efekt/Fix
- Odswiez nie rusza folderow; panel = literka z dysku + powiadomienie.
- Stosuj zmiany = FORCE na Marketing.
- Boot: mtime decyduje kto wygrywa; enforce X->ARCHIWUM gdy dysk nowszy.

### Test/Ewaluacja
- Python pull/boot/force na test-lifecycle-nerkowcowy PASS.
- Cache `?v=20260718lifeSync1`.

### Zrodla
- systematic-debugging
- apps/desktop/lifecycle_status.py, local_bridge.py, dam-explorer.js, explorer.html

---

## 2026-07-19 - Branding plan v4 (lokalnie, bez bridge API)

### Komenda/Akcja
User: kontynuuj przez Cursor/repo, nie przez bridge API. Domknięcie: marketing na project.html, admin kolejki wykrojników, Part G instrukcje, rapidocr w requirements.

### Log/Status
1. `dam-project.js`: mini-siatka marketingu (SKU/indeks/linked_product_ids), sekcja wykrojników z registry JSON.
2. `integrations.html` + `dam-wykrojnik-queue.js`: kolejka lokalna (localStorage + pobierz JSON).
3. `program-instructions.json`: +3 wpisy (branding.hub_viz_cards, branding.project_marketing, wykrojnik.queue_local_admin); packaging.tag_tiers → „Tagi pakowania (2F)”.
4. `requirements.txt`: rapidocr-onnxruntime (OCR stub).
5. Cache bust `hub20260719f` na project catalog CSS/JS.

### Efekt/Fix
- project.html pokazuje do 6 kart Branding z tagami DamBadges.
- Admin mapuje wykrojniki bez POST na bridge.
- Bridge PATCH catalog — pominięty (decyzja usera).

### Test/Ewaluacja
- Screenshot QA: project 375px, integrations, branding (w toku po restarcie cache).

### Zrodla
- docs/BRANDING-HUB.md, program-instructions Part G

---

## 2026-07-19 - Branding hub: tagi, preview PSB, bridge cleanup

### Komenda/Akcja
User: weryfikuj pliki dalej, kontynuuj usprawnienia platformy (branding tagi, miniatury, PSB/PSD, filtry chipami).

### Log/Status
1. Zabito 4 zombie `local_bridge.py` na :8766; uruchomiono jedna instancja z `psd-tools`.
2. `build-branding-index.py`: `by_appearance` (tylko appearance_tags); usunięto tokeny `search_blob` z `by_tag` (koniec śmieci typu `x:/marketing`).
3. `dam-branding.js` j6: dynamiczne chipy produktu z `by_appearance`; cache bust `hub20260719j6`.
4. `local_bridge.py`: preview raster/wideo zwraca 422 `preview_failed` zamiast 415; PSB 652MB → JPEG 141KB OK.
5. OCR batch `enrich-branding-recognize.py --limit 300` + `link-branding-products.py`; indeks 7832 assetów, 3710 z appearance_tags.

### Efekt/Fix
- HTTP `GET /media?path=...psb&preview=1` → 200 image/jpeg.
- Wyszukiwanie `proteina` + „Tylko grafiki”: 240 grafik, miniatury 848–1200px.
- Chipy PRODUKT czyste (Proteina, Karton 6x, Burger… bez fragmentów ścieżek).
- Modal: podgląd + tagi DK/Proteina/Banoffee + zoom dock na dole.

### Test/Ewaluacja
- Screenshot Pass: branding tagi j6, modal banoffee 848×1200, bridge /health OK.
- CDP: `DamMediaPreview.openAsset` img naturalWidth=848.

### Zrodla
- visual-qa-testing, systematic-debugging
- apps/desktop/local_bridge.py, apps/web/scripts/build-branding-index.py, dam-branding.js

---

## 2026-07-19 - Lifecycle previous_letter + auto-reconcile (j17/j18)

### Komenda/Akcja
User: TEST LIFECYCLE F/X/D — po restore z archiwum wszystko D zamiast BAT=D, DOY/PROD=clear, ETY=F. Wymagany full commit + push.

### Log/Status
1. **Przyczyna „wszystko D” (3x):**
   - DOY i ETY wspolny `revision_index` TEST-TEST2 → `_plan_variant` bral legacy klucz z `previous_letter: D` zamiast sciezki nośnika.
   - `_sync_revisions_after_product` przy clear produktu ustawial `previous_letter: null` w cascade_meta i kasowal stan w store.
   - Restore variant uzywal `prev in (F,X,D)` — X jako restore target.
2. **Fix Python** (`lifecycle_status.py`):
   - `_variant_identity` (DOY|TEST-TEST2 vs ETY|TEST-TEST2), `_rev_row_for_variant` (sciezka first).
   - `_restore_letter_from_row`: nigdy X; BAT D zostaje przy product clear.
   - cascade_meta: `previous_letter` tylko przy wejsciu w X; legacy klucz index usuwany po zapisie po sciezce.
3. **Fix JS** (`dam-explorer.js` j17/j18): `reconcileProductLifecycleFromDisk`, `findFreshProductInIndex`, preserve `previous_letter`.
4. **Test:** `apps/desktop/tests/test_lifecycle_previous_letter.py` — ALL OK.

### Efekt/Fix
- Oczekiwany stan po scenariuszu usera: PROD/DOY clear, BAT D, ETY F.
- Cache: `hub20260719j18`. Bridge wymaga restartu po deploy Python.

### Test/Ewaluacja
- Unit test previous_letter: PASS.
- X: Marketing niedostepny w sesji agenta (PRODUCT_NOT_FOUND) — retest UI po restarcie bridge u usera.

### Zrodla
- lifecycle-status.json history `variant_restored_previous_letter:D` na DOY/ETY
- systematic-debugging

---

## 2026-07-19 - Branding: POLSKA + archiwum, kontekst folderu, modal skojarzen (disc8)

### Komenda/Akcja
User: indeksuj `- POLSKA` i `-- ARCHIWUM --` (stara struktura Marketing); przy nakladce wygrywa POLSKA bez tagow Archiwum; w modalu warianty Desktop/Tablet/Mobile, skojarzone produkty z miniaturami, tagi Szkoła/Edytowalny; dokumentacja + commit + push.

### Log/Status
1. **`build-branding-index.py`**: skan dwufazowy (POLSKA, potem archiwum); dedup kluczem `stem+wymiary` (np. `back to school:992x600`); statystyki `legacy_skipped_overlap` w logu buildu.
2. **`brand_folder_context.py`** (nowy): grupy po `folder_dir`; `folder_variants`, `linked_products` z thumb z `viz_latest`; `LEGACY_FOLDER_TAGS` dla 01–10, 99, wymiana; `THEME_VOCAB` (Szkoła); Edytowalny gdy `.psd`/`.ai` w folderze.
3. **`brand_tag_utils.py`**: segment `SLIDERY` → Slidery + Na sklep; filtr Slidery → zakladka WWW.
4. **UI**: `dam-media-preview.js` - warianty | separator | skojarzone produkty (wspolne `groupContext`); `dam-branding.css` layout assoc; cache bust `hub20260719disc8`.
5. **`program-instructions.json`**: `branding.marketing_dual_roots`, `branding.slider_shop_tags`.
6. **Testy**: `test_build_branding_dedupe`, `test_brand_folder_context`, `test_brand_tag_utils` - PASS.
7. **Rebuild indeksu**: 49252 assetow (6787 pominietych nakladek archiwum); Back to school 992x600 tylko POLSKA (`br-003365`).

### Efekt/Fix
- POLSKA: 0 assetow z tagiem Archiwum w indeksie branding.
- Legacy-only: tagi Archiwum + Stara struktura + mapowanie starych folderow.
- Modal Back to school: 3 warianty, ORZECH CZEKOLADA + CHRUPIACY ORZECH, Szkoła, Edytowalny.

### Test/Ewaluacja
- Unit testy dedupe + folder context: PASS.
- Screenshot QA modal (1280 + 375): warianty lewo, produkty prawo, miniatury klikalne; przełaczenie wariantu zachowuje skojarzenia.

### Zrodla
- docs/BRANDING-HUB.md (sekcja dwie lokalizacje)
- program-instructions `branding.marketing_dual_roots`
- apps/web/scripts/build-branding-index.py, brand_folder_context.py

---

# ═══════════════════════════════════════════════════════════════════
# RZECZY DO WYKONANIA — NIE UDAŁO SIĘ (chcemy, żeby były)
# Data wpisu: 2026-07-19 | sesja: Branding UI + transparent PNG
# ═══════════════════════════════════════════════════════════════════

Poniżej lista funkcji / poprawek **zaplanowanych lub rozpoczętych**, których **nie udało się domknąć** w tej sesji. Priorytet dopracowania: **ten tydzień (od 2026-07-21)**.

| # | Temat | Status | Dlaczego nie done | Następny krok |
|---|-------|--------|-------------------|---------------|
| 1 | **Odtwarzanie wideo w modalu** (stream z `X:` / bridge `/media`) | FAIL UI-only | Bridge/Synology timeout lub brak dostępu do pliku w sesji agenta; layout wideo OK, stream nie zweryfikowany E2E | Restart bridge u usera; test `br-006305` z logiem `/media`; fallback komunikat „Plik offline” |
| 2 | **Pełny pixel-scan transparent** dla wszystkich PNG (poza www) | Częściowo | Skan PIL wolny na NFS `X:`; patch tylko scope www (217 assetów) | Batch nocny `patch-branding-backgrounds.py --all` z limitem czasu; zapis do indeksu zamiast heurystyki |
| 3 | **Heurystyka PNG default → indeks JSON** (nie tylko runtime UI) | Odłożone | User: „na razie UI”; indeks bez masowego rewrite | Po pixel-scan nadpisać `background` w `build-branding-index` |
| 4 | **Filtr „Tło białe”** — precyzyjne liczniki | Do weryfikacji | W QA Kampanie: filtr white nie zawęża (120=wszystko) — brak white w tej zakładce lub logika zbyt szeroka | Test na Packshoty/wizki JPG; white tylko ze skanu |
| 5 | **Wyszukiwanie tekstowe „przezroczyste”** | FAIL w QA pass 14 | CDP `input` event → 0 kart (możliwy konflikt filtrów / debounce) | Ręczny test + tokeny w `search_blob` przy rebuild |
| 6 | **Sidebar collapsed — logo wordmark bez crop** | Nie domknięte | Test CDP przerwany; brak screenshota collapsed | Screenshot collapsed + Read; `object-fit: contain` jeśli crop |
| 7 | **Marketing ID — typy TikTok / YouTube / Reels** | Brak | W scope tylko VID/SLI/BAN/META/GOG/SHOP/GIF/KV/IMG | Rozszerzyć `dam-marketing-id.js` + instrukcja |
| 8 | **Pełna parytet kart branding ↔ viz** (wszystkie tryby grup) | Częściowo | Actions OK na głównej siatce; grupy folderowe nie na wszystkich zakładkach | Audyt `renderGroupCard` vs viz na WWW/Social |
| 9 | **Seed program-instructions do Postgres KV** | Nie w tej sesji | Zmiany tylko w pliku cache JSON | Restart bridge / seed KV dla nowych id |
| 10 | **30-pass QA — wszystkie zakładki z kartami** | Częściowo | Social/WWW 0 kart w teście (dane/filtry) | User: odznaczyć „Tylko grafiki”, test z assetami www |

---

## 2026-07-19 — Branding UI overhaul + PNG default transparent + commit

### Komenda/Akcja
User: PNG bez skanu = domyślnie bez tła (zachować pixel-scan); spisać niewykonane; log zmian; QA 30-pass; commit + push + backup.

### Log/Status — chronologia zmian (2026-07-19)

| Czas (szac.) | Plik / obszar | Co wprowadzono |
|--------------|---------------|----------------|
| rano | `asset_role_utils.py`, `patch-branding-backgrounds.py` | Skan alpha PNG; patch 217 www → `background: transparent` |
| rano | `dam-branding.js` | Filtry facet global vs tab; `assetMatchesTagKey` transparent |
| południe | `dam-marketing-id.js` (nowy) | Format M-VID/KV/…; użyty w modalu i kartach |
| południe | `dam-media-preview.js` | Hero wideo, path bar, variant placeholder, title meta |
| południe | `dam-branding.css`, `dam-hub-shared.css` | Spacing modal, karty viz-style, gradient tile |
| południe | `dam-viz.js`, `visualizations.html` | Zoom 50–250%, CARD_IMG_BASE_SCALE 1.2 |
| południe | `program-instructions.json` | `branding.marketing_asset_id_format` |
| wieczór | `dam-asset-taxonomy.js` | `effectiveBackground`, PNG/WebP default transparent |
| wieczór | `dam-branding.js`, `dam-badges.js` | Filtr + badge + search blob dla effective background |
| wieczór | `program-instructions.json` | `branding.png_default_transparent` |
| wieczór | `branding.html` | Cache bust `hub20260719trans01` |

### Efekt/Fix
- Tag „Przezroczyste tło” klikalny; filtr zawęża (17/120 w Kampaniach).
- PNG bez `background` w indeksie → UI traktuje jako transparent (np. br-006165).
- Modal: M-KV106165-04-25, path monospace, margin meta 10px, actions 15px.

### Test/Ewaluacja
- QA 30-pass: tabela w `PROGRESS.md` (26 PASS, 4 INFO, odłożone FAIL w sekcji NIE UDAŁO SIĘ).
- Screenshot + Read: modal KV, siatka Kampanie.

### Backup
- Tag przed commitem: `backup/2026-07-19-pre-branding-ui-overhaul`
- Tag po commicie: `feature/2026-07-19-branding-ui-overhaul`

### Zrodla
- `program-instructions.json` (`branding.png_default_transparent`, `branding.marketing_asset_id_format`)
- `.cursor/rules/verify-ui-after-changes.mdc`


---

## 2026-07-19 — Media preview modal: przyciski + tagi + gradient + Shift+klik (10-pass)

### Komenda/Akcja
User: brak przyciskow / zle nazwy w `#damMediaPreview`; ext-tag TIF/JPG jak badge +10% i 8px od tytulu; wiecej odstepu tagi→tytul; mniej scrolla; gradient tile krotszy +30% transparency; Shift+klik na skojarzonych produktach; Intensive QA 10 passes.

### Log/Status
1. Audyt: modal mial tylko "Pokaz w Eksploratorze" (brak Przejdz); thumb assoc zjadal Shift+klik.
2. `dam-media-preview.js`: CTA jak wizualizacje — Przejdz + Folder + opcjonalnie Zrodlo.
3. `dam-assoc-edit.js`: Shift+klik na item/thumb/name → openEditPicker (product).
4. `dam-branding.css`: title gap 20px; ext-tag anatomia badge +10%; mniejszy hero.
5. `dam-hub-shared.css`: editable wash od dolu min(128px,32%), alpha *0.7.

### Efekt/Fix
- Footer: Przejdz | Folder | (Zrodlo) | Kopiuj | Udostepnij
- CDP: gap tagi→tytul 20px; title↔ext 8px; extH 26.8 vs badgeH 24.4; bez scrolla (baton)
- Shift+klik otwiera picker (admin mode)

### Test/Ewaluacja
Intensive QA 10 passes screenshot→Read (Pass1–10).

### Zrodla
- memory.md §38
- `.cursor/rules/verify-ui-after-changes.mdc`

---

## 2026-07-19 — Bento v2.0.0 (shared grid + explorer hot zone)

### Komenda/Akcja
User: milestone v1.5.0 OK; v2.0.0 = spójny Bento CSS Grid na panel; zamrozić wizualnie karty/modale viz/branding/projekty; priorytet Eksplorer (carrier/prod-row sypie się na RWD); ui-taste + ui-ux-pro-max; dopisać definicję „rundy” do skillu ui-taste.

### Log/Status
1. `ui-taste` SKILL.md §0.E: Runda vs Pass (PL/Monday) + intensive 10+ focus rounds.
2. Nowy `apps/web/assets/css/dam-bento.css` (tokeny gap/radius, shell explorer, carrier zones, prod-row grid, hub chrome).
3. `explorer.html`: Bootstrap `.row.g-3` → `.dam-explorer-layout` (CSS Grid kategorie + panel).
4. `dam-explorer.js`: wrappery `meta-chips` / `meta-life` + `older-rev-row__main/life`.
5. Podpięcie `dam-bento.css` na dashboard/settings/viz/branding/projekty/inbox/help/explorer.
6. Wersja `2.0.0` / codename `bento` (`version.json`, `dam-version.js`, `runtime_config.py`).

### Efekt/Fix
- Carrier: grid `title | chips | end` + wiersz `. | life | end` (admin) - chipy w jednej linii, lifecycle nie „wędruje”.
- Explorer shell: stabilny 2-col → stack @992px.
- Zamrożone: `.dam-viz-card`, branding cards, project cards, modale media/viz (bez restylu).

### Test/Ewaluacja
- Intensive QA: screenshot→Read carrier desktop (Pass1–3 align), layout CDP `display:grid`, mobile areas stack; dashboard parity OK.
- Overflow 375 z geex header quickaction = pre-existing (nie z bento shell).

### Zrodla
- Plan Bento v2.0.0
- MDN CSS Grid / bentogrids.com (referencja stylu)
- `.cursor/rules/verify-ui-after-changes.mdc`

---

## 2026-07-19 — Modal zoom 85–100% + layout body na dole + cache tagów Branding

### Komenda/Akcja
User: (1) modal zoom 85–100% zamiast 85–125%, body modala wyrównane do dołu, thumb responsywny; parity viz. (2) Wolne ładowanie po kliknięciu tagów w Branding (~10 s) — cache z unieważnianiem przed aktualizacją bazy/indeksu. Commit + push.

### Log/Status
1. **Diagnoza wolnych tagów:** klik tagu = filtr po stronie klienta (7832 assety, brak API). Bottleneck: podwójne `computeFacetCounts()` (~7800×~100 kluczy×2), podwójny `renderTagFilters()` przy auto-zmianie tabu, pełny rerender siatki do 1000 miniaturek `/media`.
2. **`dam-modal-shared.js`:** `modalStartZoomPct()` → mapowanie 85–100% (kafelek ≥100% → modal 100%). `fitChrome()` bez sztywnego `max-height` thumb — flex wypełnia przestrzeń nad body.
3. **`dam-brand.css` / `dam-branding.css`:** `.dam-viz-modal-box { justify-content: flex-end }`, thumb `flex: 1 1 0`, body `flex: 0 0 auto`.
4. **`dam-branding.js` (cache01):** `computeFacetCountsPair()` — jedna pętla po assetach, liczniki facet+global naraz; `facetCountCache` kluczowany sygnaturą filtrów + `built_at`; `clearBrandingComputeCache()` / `invalidateBrandingIndexCache()`; `scheduleBrandingRender()` (rAF); tag click bez podwójnego renderu tabu; API `DamBranding.clearComputeCache` / `invalidateIndexCache`.
5. **`local_bridge.py`:** `_drop_json_cache()`, `_invalidate_branding_data_caches()` — **czyść cache PRZED** zapisem (`_save_json`), przed/po `/branding/rebuild`, `/branding/recognize`, przed/po `/index/rebuild` + `meta_store.sync`.
6. **`dam-tag-edit.js` / `dam-assoc-edit.js`:** po zapisie metadanych/skojarzeń → `DamBranding.clearComputeCache()`.

### Efekt/Fix
- Modal: zoom 110% kafelka → 100% modalu (nie 141%). Body przy dole boxa, brak martwej strefy pod CTA (CDP gap=0).
- Branding tagi: ~2× mniej pracy liczników na klik; cache liczników ważny do zmiany filtra/indeksu; bridge zawsze czyta świeży JSON po rebuild/patch (cache RAM invalidowany przed zapisem).

### Test/Ewaluacja
- Modal QA: screenshot→Read branding + viz @1280/768; zoom 100% @ suwak 110%; layout gap=0.
- `modalStartZoomPct(110)===100`, `modalStartZoomPct(85)===85` (CDP).
- Cache: po `clearBrandingComputeCache()` sygnatura facetCountCache reset.

### Zrodla
- Analiza `dam-branding.js` renderTagFilters / computeFacetCounts
- `local_bridge.py` `_JSON_FILE_CACHE`, `_save_json`
- User brief: cache invalidation przed aktualizacją bazy

