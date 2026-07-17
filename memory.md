# memory.md - DAM ETA (zasady trwale)

Data: **2026-07-16**. Wykonawca: Composer 2.5. Workspace: **tylko `P:\DAM`**.

## Hard rules

1. **Scope:** caly kod, cache, downloady, dumpy, agenci - tylko pod `P:\DAM`. Zakaz AppData / TEMP / D: / M: jako miejsca zapisu (M: tylko read-only pointery przy ingest).
2. **Tooling:** `P:\DAM\tooling\downloads`, `choco-cache`, `npm-cache`, `composer-home`, `bin`. Brak CLI -> Chocolatey z cache na P albo portable na P.
3. **UI / estetyka:** wylacznie motyw **Geex** z `P:\DAM\THEME\geex-html-main`. Tokeny w `apps/web/assets/css/dam-tokens.css`. Nie budowac Next.js skina. ui-taste = polish w Geex (dials 5/3/5).
4. **Desktop first:** launcher w `apps/desktop` (wzór Inyfinn Resizer - prawdziwa lokalna app). Browser = ten sam localhost, mobile-first.
5. **Completeness:** `checklist_status` materializowany, refresh na evencie. Zakaz hot-path LEFT JOIN.
6. **Wersjonowanie:** os A `variants` vs os B `asset_revisions` + `current_revision_id` (ADR-002).
7. **Integracje:** Asana + Microsoft Teams (ADR-005). Sekrety tylko w `.env`.
8. **Auth (2026-07-16):** kazdy user loguje sie do panelu. Domyslnie **Microsoft Entra ID / Azure AD** (domena Microsoft jak teraz). Konfigurowalne (tenant, client, redirect). Alternatywa: **Synology Directory / LDAP / OIDC** (model jak DSM pod AD) + local Sanctum. ADR-006.
9. **Role v1:** dokladnie `admin` | `power_user` | `user`. Mapowanie grup Azure/LDAP konfigurowalne.
10. **Em-dash ban:** zakaz `—` i `–` w UI, commit messages, copy agentow. Tylko `-`.
11. **Nie kopiowac** kodu structure-mcp do DAM; tylko wiedza domenowa (sloty 0-4, indeksy).

## Stack

- API: Laravel 11.55 + Sanctum + PostgreSQL (portable `tooling/bin/pgsql`, cluster `data/postgres`, port **5433**, DB `dam_eta`)
- UI: Geex HTML/Bootstrap 5 zaadaptowany w `apps/web` (smoke `http://127.0.0.1:8765`)
- Desktop: Python pywebview launcher (`apps/desktop/launch.py`)
- Search v1: Postgres FTS (limitation PL w ADR-004)
- PHP portable: `tooling/bin/php/php.ini` z openssl/curl/mbstring/pdo_pgsql
- Composer na NFS P: unikac `create-project` extract-delete; ZIP + `composer update` (audit.block-insecure false lokalnie)

## Referencje

- THEME: `P:\DAM\THEME\geex-html-main`
- Wzor jakosci lokalnej app: Inyfinn Image Resizer (launcher + process/memory + testy)
- Plan: Cursor plans `dam_p_dysk_bootstrap_*.plan.md`

## 2026-07-17 - UI polish DAM panel

12. **i18n overlay:** WSZYSTKIE widoczne stringi poprzez `data-i18n="key"` w HTML i pliki `apps/web/i18n/{lang}.json`. Nigdy nie hardkodowac jedynego zrodla prawdy dla UI copy. dam-i18n.js laduje overlay z localStorage.dam_lang (default pl).
13. **Human labels (obowiazujace):** zakazane etykiety techniczne w UI. Mapowanie: artwork->"Projekt graficzny", viz_3d->"Wizualizacja 3D", print_pdf->"Plik do druku", tech->"Specyfikacja techniczna". Plik: dam-project.js ROLE_LABEL.
14. **Scope: P: only.** Zakaz zapisu do D: i M:. Obowiazuje od startu projektu.
15. **Signin redirect:** po udanym logowaniu -> dashboard.html (nie index.html). Fallback demo: admin@dam.local / DamAdmin123!
16. **dam-shell.js:** auth guard na wszystkich stronach (oprocz signin). Rewrite nav Geex -> DAM items. Messages popup z Asana/Teams tabs.
17. **dam-cost.js:** PL holidays computus (Wielkanoc Meeus/Jones/Butcher) + stale 9 swiat. Godziny robocze = Mon-Fri minus swieta x 8h.
18. **Nowe strony:** costs.html (kalkulator), invoices.html (faktury + data/invoices.json). Obie bazuja na shell dashboard.html.
19. **Design system:** P:\DAM\design-system\MASTER.md. Geex primary #AB54DB, dark #17161E, Jost font.

## 2026-07-17 - Branding + auth roboczy

20. **Logo:** Dobra Kaloria (bialy + czarne napisy) - pps/web/assets/img/logo-dobra-kaloria.svg (kopia z D: tylko odczyt). Geex logo nie uzywac w UI.
21. **Auth roboczy:** DAM_DEV_ALWAYS_ADMIN = true w dam-shell.js. Brak Microsoft Entra na teraz. Sesja zawsze admin@dam.local. signin.html auto-redirect do dashboard.html.

17. **Messages popup:** domyslna wysokosc 520px (content +250 vs Geex 200); skalowanie w dol przez uchwyt; zapis w localStorage `dam_msg_popup_h`; style w `dam-brand.css` (musi byc linkowany).

18. **i18n PL chrome:** `DamShell.polishChrome()` tlumaczy pozostalosci Geex (Customizer, Edit/Delete, Search, menu user). Domyslny jezyk `dam_lang=pl`. LTR/RTL bez zmian (skroty).

19. **Nav trail:** zawsze `#damNavTrail` (Wstecz + breadcrumbs). Hierarchia PAGE_TRAIL w dam-shell. Historia: `sessionStorage.dam_nav_stack`. Bez trail tylko na signin.

20. **Kalkulator:** brak formularza. Taby z `project-costs.json` (build: `python apps/web/scripts/build-project-costs.py`). Stawki w `cost-rates.json`. Suma = osoby + bezposrednie; faktury tylko info.

21. **Indeks dysku:** skan read-only `D:/Marketing/- POLSKA/01 - PRODUKTY/- DK` -> `apps/web/data/file-index.json` + `search-index.json` (`python apps/web/scripts/build-file-index.py`). Latest rewizja = max `.NN` indeksu. Search: prefix od 4 cyfr, fuzzy sugestie, tagi.

22. **Explorer UX2:** display_name bez nawiasow; tag_groups (smak/typ/opakowanie/osoba); files_by_role; related_materials (odnosniki); product-status.json + Tryb admina (Aktualne/Nieaktualne); sidebar collapse.


24. **Explorer v3 (2026-07-17):**
    - Kategorie: zawsze kanoniczne tytuly z `DamLabels.categoryTitle` (bez numerow "01 -"). DK + GC laczone w jednej liscie po `categoryCanonId`.
    - Filtr marek: checkboxy DK / GC + Wyczysc / Zaznacz wszystko / Odznacz wszystko / Odwroc zaznaczenie.
    - MIXY: `DamLabels.isMixProduct()` - zawsze na gorze jako sekcja rozwijana, nie w regularnej liscie.
    - Produkty: `DamLabels.cleanProductDisplayName()` - usun "- MIX -" z tytulu; indeks jako tag-pill pod nazwa.
    - Nosniki: `DamLabels.parseCarrierCode(r.folder)` -> grupuj rewizje; `DamLabels.carrierLabel()` = ludzki label. Jeden aktualny per typ domyslnie. Starsze ukryte za "Pokaz starsze".
    - Bogus revision: `DamLabels.isBogusRevision()` - "- ELEMENTY z OPAKOWAN" nie jest nosnikiem, skip.
    - Checklista: AI (ext=ai/psd/indd), PREV/podglad, druk (print role/FQ PDF), wizki, elementy (slots MATERIA/ELEMENT lub dziedziczenie z innego wariantu tego produktu), marketing.
    - Elementy inherit: jezeli brak w aktualnym wariancie -> szukaj w innym wariancie TEGO SAMEGO produktu -> pokaz note "z wariantu...".
    - Wizualizacje: grupowane po `vizPerspective` + `vizSize`. Miniatury z `data/thumbs/`. Bez przycisku "Zobacz aktualne wizualizacje".
    - Akcje UX przy sciezkach: ZAWSZE para ikon **Kopiuj sciezke** + **Pokaz w eksploratorze** (patrz §31).
    - dam-labels.js musi byc zaladowany PRZED dam-explorer.js (window.DamLabels).

## 2026-07-17 - UX v4 (brand dropdown, viz group, Synology, profil KW)

25. **Filtr marek v4 (KRYTYCZNE):** filtr DK/GC USUNIETY z paska kategorii (sidebar). Zamiast tego: dropdown `dam-brand-filter.js` (przycisk "Marka: DK+GC" w toolbarze eksploratora i wizualizacji). Klasa `.dam-filter-trigger` + panel `.dam-filter-dropdown`. Persist: `localStorage.dam_brands` JSON `{DK:true,GC:true}`. Sync explorer <-> viz. Wspólny plik `assets/js/dam-brand-filter.js`. dam-brand-filter.js musi byc zaladowany PRZED dam-explorer.js i dam-viz.js.

26. **Galeria wizualizacji v4:**
    - Grupy po `product_id` - jedna karta = produkt (nie per jezyk).
    - Badge "Multijezyczny" jesli wiele wariantow jezykowych (zamiast 8 kart).
    - Ukryta sciezka D: i raw filename z karty (zostaje w modalu).
    - Usuniety przycisk "Indeks". Zostal "Eksplorator" + "Udostepnij".
    - Klik miniatury -> modal podgladu (tytul, warianty jezykowe, akcje).
    - Carrier label ludzki: `DamLabels.carrierLabel` / `parseCarrierCode`.

27. **Synology Share fallback:** z przegladarki NIE mozna kliknac menu Synology Drive Client. Modal "Udostepnianie Synology" kopiuje sciezke lokalna do schowka + instrukcja PPM w Eksploratorze. Pole na wklejenie linku QuickConnect. Ustawienie `localStorage.dam_synology_enabled` (domyslnie true). Gdy false -> przycisk "Udostepnij" disabled + tooltip.

28. **Tooltips:** `dam-tooltips.js` - globalny helper, atrybuty `data-dam-tip` na kluczowych przyciskach. Szanuje `localStorage.dam_tooltips=off`. Ustawienie w `settings.html`.

29. **Panel uzytkownika (Krzysztof Wieczorek):**
    - `localStorage.dam_user_name` = "Krzysztof Wieczorek" (nie "Administrator DAM")
    - `localStorage.dam_user` zawiera: email, title (GRAFIK), department (MARKETING), company (KUBARA), phone (502597985), manager (Karolina Poznar), colleagues.
    - Menu: Profil -> `profile.html`, Ustawienia -> `settings.html`, Rozliczenia -> `billing.html`, Aktywnosc -> `activity.html`, Pomoc -> `help.html`.
    - Wyloguj w dev mode -> dashboard.html (sesja nadal admin).

30. **Nowe pliki v4:** `assets/js/dam-brand-filter.js`, `assets/js/dam-tooltips.js`, `profile.html`, `settings.html`, `billing.html`, `activity.html`, `help.html`. Cache: `dam-viz.js?v=20260717ux10` (fix search: nie matchuj pustych digits przez `indexOf("")`).
31. **Szukaj viz:** `applyFilters` NIE wolno `indexOf(q.replace(/\D/g,""))` gdy query bez cyfr - w JS `"".indexOf("")===0` i kazdy wiersz przechodzi.

32. **Sciezka bazowa + Pokaz w Eksploratorze (KRYTYCZNE, 2026-07-17):**
    - Indeks kanoniczny: zawsze `D:/Marketing/...` (i `D:/Marketing/- EKSPORT/...`).
    - Kazdy user ustawia **sciezke bazowa** = folder, w ktorym widzi 3 katalogi: `-- ARCHIWUM --`, `- EKSPORT`, `- POLSKA`.
      Przyklady: `D:\Marketing`, `M:\`, `C:\Marketing`. Persist: `localStorage.dam_base_path`.
    - Remap: `DamPaths.toLocal(indexPath)` = strip `dam_index_base` (domyslnie `D:/Marketing`) + join user base.
      Przyklad: `D:/Marketing/- POLSKA/...` + baza `M:\` -> `M:\- POLSKA\...`.
    - Onboarding: modal przy pierwszym wejsciu (brak `dam_base_path`). Edycja: `settings.html`. Walidacja: bridge `POST /validate-base`.
    - **Wszedzie** gdzie jest ikona/przycisk Kopiuj sciezke musi byc **dodatkowo** Pokaz w eksploratorze (para). Helper: `DamPaths.pathActionsHtml` + `bindPathActions`.
    - Reveal = `explorer /select,"<plik>"` (otwiera folder rodzica i **zaznacza** plik; NIE otwiera pliku). Folder -> `explorer "<folder>"`.
    - Bridge lokalny: `apps/desktop/local_bridge.py` port **8766**. Launcher `launch.py` startuje bridge + UI :8765.
    - Bez bridge: fallback kopiuje sciezke + toast "Bridge offline".
    - Pliki: `assets/js/dam-paths.js`, CSS `.dam-path-actions` / `.dam-file-reveal` / `.dam-basepath-*`.

33. **Audit log operacji:**
    - Kazda akcja uzytkownika (copy_path, reveal_explorer, set_base_path, share_synology; pozniej move/copy/delete plikow) -> log z user, ts, path, local_path, detail.
    - Lokalny cache: `localStorage.dam_audit_log`. Trwaly: `apps/web/data/audit-log.jsonl` przez bridge `POST/GET /audit`.
    - UI: `activity.html` (lista z bridge lub cache).

34. **Design system GLOBALNY (KRYTYCZNE):**
    - Zakaz one-off zmian na jednej stronie (inna ikona lupy, inny popup, inny kolor przycisku).
    - Chrome (header: szukaj / wiadomosci / powiadomienia / profil): `dam-shell.js` + `dam-brand.css` + tokeny Geex (`dam-tokens.css`).
    - Panel wiadomosci: otwieranie przez `.is-open` (nie jQuery slideToggle) - slideToggle psuje stala wysokosc / resize.
    - Strony bez header action (settings/profile/...) dostaja ten sam chrome przez `ensureHeaderChrome()`.
    - Cache bust: wspolna wersja `?v=...` dla dam-brand + dam-shell na WSZYSTKICH html.

35. **Nosniki - NIE ZGADUJ (KRYTYCZNE, 2026-07-17):**
    - Folder tylko `data - indeks` (np. `13.02.2025 - 6300622.00`) = `UNKNOWN`, NIGDY `BAT`/`BATON`.
    - Rozpoznanie: 1) `carrier-overrides.json` / localStorage, 2) prefiks pliku wizki (`KAR6X-...`), 3) prefiks folderu (`KAR6X - ...`).
    - Override Babka 6300622.00 = KAR6X / nieaktualne (stary karton 6x).
    - UI: przy produkcie slot1 = chipy DK/GC; slot2 = widok wizualizacji (kafelki/lista/skala).
    - Lightbox globalny: prev/next + X (`.dam-lightbox`).
    - Miniatury: `data/thumbs` + fallback bridge `GET /media?path=`.
    - "Nie widzisz wariantu? Dodaj go" -> modal + `POST /carrier-override` + audit.

36. **Logo Dobra Kaloria (KRYTYCZNE, 2026-07-17):**
    - Zrodlo: `D:\Marketing\- POLSKA\- BRANDING i MARKA -\DOBRA KALORIA\01 - LOGO\SVG`.
    - **Zakaz** logo Niemiesa (pliki z „Niemiesa” w nazwie).
    - Light mode: **zielony** `#008244` (`logo-dk-green.svg`) - bialy wordmark na jasnym sidebarze = niewidoczny.
    - Dark mode: ten sam zielony (czytelny); zapas `logo-dk-white.svg` tylko gdy potrzeba.
    - Runtime: `dam-shell.js` `applyDobraKaloriaLogo()`; CSS w `dam-brand.css`; docs: `design-system/components/logo.md`.
    - Nie commituj tokenow GitHub / sciezek lokalnych z haslami / `.env`.

23. **Wizualizacje:** thumbs w `apps/web/data/thumbs` (FRONT priorytet); jezyki z nazwy folderu rewizji (SK HU HR); DK+GC w indeksie; sync G:`GC WIZUALIZACJE` -> D: `4 - VISUALS` bez nadpisywania (`sync-gc-viz-from-g.py`).

