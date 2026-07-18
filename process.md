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
4. `ui-taste/SKILL.md` ÿ0.E: Intensive mode = 10 passes + self-critique.
5. Cache `?v=20260718inyf1`.

### Test/Ewaluacja
- Screenshot: footer `inyfinn.art ÿ 2026`, karty z CTA "Przejdz".

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
4. README, DEPLOYMENT, ADR-008, memory §59
5. build-release-zip.ps1 + GitHub release

### Efekt/Fix
Sesja nie przenosi sie miedzy PC; artefakt ZIP + tag release.

### Zrodla
ADR-007/008; Windows MachineGuid
