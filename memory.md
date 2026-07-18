# memory.md - DAM ETA (zasady trwale)

Data: **2026-07-16**. Wykonawca: Composer 2.5. Workspace: **tylko `P:\DAM`**.

## Hard rules

1. **Scope:** caly kod, cache, downloady, dumpy, agenci - tylko pod `P:\DAM`. Zakaz AppData / TEMP / D: / M: jako miejsca zapisu (M: tylko read-only pointery przy ingest).
2. **Tooling:** `P:\DAM\tooling\downloads`, `choco-cache`, `npm-cache`, `composer-home`, `bin`. Brak CLI -> Chocolatey z cache na P albo portable na P.
3. **UI / estetyka:** wylacznie motyw **Geex** z `P:\DAM\THEME\geex-html-main`. Tokeny w `apps/web/assets/css/dam-tokens.css`. Nie budowac Next.js skina. ui-taste = polish w Geex (dials 5/3/5).
4. **Desktop first:** launcher w `apps/desktop` (pywebview + WebView2). Uzytkownik uruchamia skrot **DAM ETA** na pulpicie (jak Kalkulator). Porty localhost sa wewnetrzne - uzytkownik ich nie widzi. Browser mode tylko dev.
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

21. **Indeks dysku:** skan read-only Marketing (preferuj `X:/Marketing`, fallback `D:/Marketing`) -> `apps/web/data/file-index.json` + `search-index.json` (`python apps/web/scripts/build-file-index.py`). DK: `- POLSKA/01 - PRODUKTY/- DK`, GC: `- EKSPORT/01 - PRODUCTS/- GC`. Latest rewizja = max `.NN` indeksu. Search: prefix od 4 cyfr, fuzzy sugestie, tagi. Wiedza nazewnictwa/slotow 0-4 z structure-mcp (nie kopiowac kodu migratora do DAM).

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

27. **Synology Share (2026-07-17, poprawka):** przycisk "Udostepnij" **wywoluje okno Synology Drive Client** (menu: Synology Drive > Uzyskaj lacze / Get link) przez bridge `POST /synology-share` + skrypt `apps/desktop/synology_get_link.ps1` (IContextMenu). **Bez** modalu z instrukcja PPM. Wymaga: Synology Drive Client + `local_bridge.py` :8766. Ustawienie `localStorage.dam_synology_enabled` (domyslnie true). Gdy false -> przycisk disabled. Gdy bridge offline -> toast z komunikatem (nie fallback instrukcji).
   - Poprzednia wersja (bledna UX): modal z 5 krokami recznymi - odrzucona przez usera 2026-07-17.

28. **Tooltips:** `dam-tooltips.js` - globalny helper, atrybuty `data-dam-tip` na kluczowych przyciskach. Szanuje `localStorage.dam_tooltips=off`. Ustawienie w `settings.html`.

29. **Panel uzytkownika (Krzysztof Wieczorek):**
    - `localStorage.dam_user_name` = "Krzysztof Wieczorek" (nie "Administrator DAM")
    - `localStorage.dam_user` zawiera: email, title (GRAFIK), department (MARKETING), company (KUBARA), phone (502597985), manager (Karolina Poznar), colleagues.
    - Menu: Profil -> `profile.html`, Ustawienia -> `settings.html`, Rozliczenia -> `billing.html`, Aktywnosc -> `activity.html`, Pomoc -> `help.html`.
    - Wyloguj w dev mode -> dashboard.html (sesja nadal admin).

30. **Nowe pliki v4:** `assets/js/dam-brand-filter.js`, `assets/js/dam-tooltips.js`, `profile.html`, `settings.html`, `billing.html`, `activity.html`, `help.html`. Cache: `dam-viz.js?v=20260717ux10` (fix search: nie matchuj pustych digits przez `indexOf("")`).
31. **Szukaj viz:** `applyFilters` NIE wolno `indexOf(q.replace(/\D/g,""))` gdy query bez cyfr - w JS `"".indexOf("")===0` i kazdy wiersz przechodzi.

32. **Sciezka bazowa = ustawienie UZYTKOWNIKA (KRYTYCZNE, 2026-07-18):**
    - Struktura ZAWSZE ta sama. **Zrodlem prawdy sciezki jest to, co user ustawi** po pierwszym uruchomieniu (konto / profil) - NIE stala litera dysku w kodzie.
    - Persist: `localStorage.dam_base_path` (per profil WebView) + backup per `USERNAME` w `apps/desktop/machine-config.json`.
    - Aplikacja **NIGDY** nie nadpisuje zapisanego `dam_base_path` auto-detectem.
    - Detect / Podpowiedz = tylko sugestia; zapis dopiero po Zapisz.
    - Indeks moze miec dowolne `X:/`/`D:/Marketing/...` - `toLocal` zdejmuje `[A-Z]:/Marketing` i dokleja **baze usera**.
    - Metadane = baza (file-index / API). **Pliki** = ROOT usera. Offline plikow: czerwona kropka + "Wskaz sciezke" (`dam-root-status.js`, bridge `/files/status`).

41. **Konta lokalne + sesja urzadzenia (2026-07-18):**
    - SQLite `apps/desktop/data/dam-auth.sqlite` (nie w gicie). Hasla: **bcrypt** (nie plaintext).
    - Bridge: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.
    - Sesja = `device_id` + token bez wygasania. **Logout nie kasuje sesji.**
    - Entra ID / AD - pozniej. Owner seed: email KW (admin).

    - Onboarding: modal przy pierwszym wejsciu (brak `dam_base_path`). Edycja: `settings.html`. Walidacja: bridge `POST /validate-base`.
    - **Wszedzie** gdzie jest ikona/przycisk Kopiuj sciezke musi byc **dodatkowo** Pokaz w eksploratorze (para). Helper: `DamPaths.pathActionsHtml` + `bindPathActions`.
    - Reveal = `explorer /select,"<plik>"` (otwiera folder rodzica i **zaznacza** plik; NIE otwiera pliku). Folder -> `explorer "<folder>"`.
    - Bridge lokalny: `apps/desktop/local_bridge.py` port **8766**. Launcher `launch.py` startuje bridge + UI :8765.
    - Restart okna: Ustawienia -> `Zrestartuj okno aplikacji` -> `pywebview.api.restart_window()` (opozniony relaunch po zwolnieniu mutexa).
    - Bez bridge: fallback kopiuje sciezke + toast "Bridge offline".
    - Pliki: `assets/js/dam-paths.js`, CSS `.dam-path-actions` / `.dam-file-reveal` / `.dam-basepath-*`.
    - structure-mcp (wiedza migracji): `X:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\CURSOR\MCP - Filesystem\structure-mcp\` (memory.md: sloty 0-4, flat migrate, legacy `M:\`). **Nie** kopiowac kodu migratora do DAM.

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

37. **Viz Studio (2026-07-17):**
    - Karty: taby **Z tlem / Bez tla** (`DamLabels.vizBackground`: PNG/webp=bez tla; JPG/TIF=z tlem; override z nazwy).
    - Hero: jeden plik na perspektywe (`pickHeroFile` - preferuj L + JPG/PNG); klik -> studio lightbox.
    - Studio: sidebar (Tlo, Widok, Jezyk, Warianty L/S + hinty, Metadane), stage wiekszy (~30%), zoom `search-plus`/`search-minus`, prev/next perspektywy.
    - Meta: bridge `GET /media-meta?path=` (PIL: width/height, colorspace RGB/CMYK, dpi, size).
    - Skala hero: `localStorage` + slider "Skala podgladu" (domyslnie 140px).
    - Pliki: `dam-explorer.js`, `dam-labels.js`, `dam-brand.css`, `local_bridge.py`. QA: `ui-complete/QA-AUDIT.md`.

38. **Wizualizacje - przyciski modalu (KRYTYCZNE, 2026-07-17):**
    - **Przejdz do produktu** = hub DAM (`explorer.html?product=...`) - dawniej mylnie "Eksplorator produktu" / Indeks.
    - **Eksplorator produktu** = `DamPaths.openFolderInExplorer(path)` - otwiera **folder** w Windows Explorer (rodzic pliku), NIE zaznacza pliku, NIE nawiguje do HTML.
    - Kazdy CTA w modalu/karcie: ikona + tekst (`uil-arrow-right`, `uil-folder-open`, `uil-copy`, `uil-share-alt`), klasa `.dam-btn-icon`, min-height 44px.
    - Pliki: `dam-viz.js`, `dam-paths.js`, `dam-brand.css`.

23. **Wizualizacje:** thumbs w `apps/web/data/thumbs` (FRONT priorytet); jezyki z nazwy folderu rewizji (SK HU HR); DK+GC w indeksie; sync G:`GC WIZUALIZACJE` -> D: `4 - VISUALS` bez nadpisywania (`sync-gc-viz-from-g.py`).


39. **Filtr marki - sync dwukierunkowy (2026-07-18):**
    - `dam-brand-filter.js`: jedna funkcja `commitBrands` aktualizuje dropdown "Marka: ..." ORAZ chipy DK/GC w toolbarze produktu.
    - Persist nadal `localStorage.dam_brands`. Listener raz na boot (explorer/viz) - zakaz stackowania callbackow przy remount.
    - Customizer header: mniejszy napis w `dam-app.css` (`.geex-btn__customizer > span`), ikona bez zmian.
    - QA w desktop launcherze, nie na :8765.

40. **Baza plikow w projekcie (KRYTYCZNE, 2026-07-18):**
    - Zrodlo prawdy metadanych: `apps/web/data/file-index.json` (+ search-index, product-status, thumbs).
    - Struktura katalogow ZAWSZE ta sama; zmienia sie tylko prefix (D:/Marketing, M:/, P:/...).
    - Brak poprawnej bazy sciezki = pliki (AI/PDF/wizki) niedostepne do otwarcia, ale lista/indeks/status ZAWSZE z repo.
    - DamApi offline: NIE uzywac 3 mockow; mapuj products z file-index.
    - Sidebar collapse: przycisk expand musi byc klikalny gdy zwiniety; logo skalowane do ~36px.

## 2026-07-18 - Lokalna baza bez Dockera (ADR-007)

41. **SQLite = baza w REPO (KRYTYCZNE, amended 2026-07-18 #2):**
    - Kanon: `apps/desktop/data/dam-local.sqlite` (gitignored). WAL + busy_timeout 60s. Tabele: users, device_sessions, audit_log.
    - **ZAKAZ** tworzenia `{Marketing}/.dam-eta` ani innych katalogow/plikow na Marketing bez jawnego polecenia.
    - Marketing = skan/odczyt assetow; metadata aplikacji tylko w repo.
    - Stary blad `.dam-eta` na X: migracja do `dam-local.sqlite`, katalog usuniety.
    - Postgres/Docker tylko opcjonalnie pod Laravel (profil `dev-postgres`), nigdy w instrukcji dla marketingu.
    - ADR: `docs/ADR/ADR-007-local-sqlite.md`.
    - Seed Kubara: `python apps/desktop/seed_kubara_users.py` (haslo `test`, bez maili). Awatary plciowe: `avatar-female.svg` / `avatar-male.svg` w shell.

41b. **Zakres zapisu agenta (KRYTYCZNE):**
    - Domyslnie tylko repo DAM. Zero samowolnych folderow na `X:\` / `D:\Marketing` / udzialach.
    - Indeks = JSON w `apps/web/data/` (nie baza SQL). Pliki na Marketing tylko po wyraznym poleceniu.

42. **Przyciski Geex (2026-07-18):**
    - Zawsze wzoruj na `THEME/geex-html-main/button.html`.
    - Primary: `geex-btn geex-btn--primary` (bez neon glow).
    - Secondary na kartach: zwykly `geex-btn` (szare tlo THEME) - **NIE** `geex-btn--transparent` (czarna obwodka 2px wyglada jak brutalizm spoza DS).
    - Ikony: Unicons (`uil-*`) jak w Geex.

43. **Teksty UI (kontrast + jezyk):**
    - Geex `--secondary-color` = `#B7DBF9` (jasny blekit) - **NIGDY** jako kolor body/subtitle (nieczytelny na bieli). Uzywaj `--body-color` / `#464255`.
    - Braki na kartach: ikony jak w Eksploratorze (`dam-check-ok` / `dam-check-brak`), etykiety ludzkie: Wizualizacje (nie viz_3d / nie "3D"), Projekt graficzny, Pliki do druku.
    - Align: title + subtitle + form w jednej osi (left), bez centered hero nad left form.

44. **Hierarchia przyciskow (KRYTYCZNE):**
    - W jednej grupie akcji (karta, modal, panel) max **jeden** `geex-btn--primary` (solid / „ciezki”).
    - Drugi i kolejne: `geex-btn--primary-transparent` (obrys fioletowy Geex) albo zwykly `geex-btn` (szary).
    - Nie dwa solid purple obok siebie (np. Przelicz + Powiadom).
    - Wzorzec: `.dam-action-stack` w `dam-app.css`.

45. **Logo + wyszukiwarka (KRYTYCZNE):**
    - Sidebar ZAWSZE ma `.geex-sidebar__header` + `.geex-sidebar__logo` z `logo-dk-green.svg` (shell: `ensureSidebarLogo()`).
    - Globalny pasek: `.dam-search-input` + `#damSearchTags` / tag bar (`dam-tag-bar.js`) na Eksplorator, Projekty, Wizualizacje.
    - Szuka w obrebie podstrony (nie cross-page).
    - Grupy: Smak / Typ / Opakowanie / Autor (12-24 tagow; Autor z Asana Assignee x indeks).
    - Tag bar: wszystkie kategorie widoczne; kategoria >10 tagow ma `+N` i rozwija sie w dol (bez globalnego przyciecia).
    - Odswiez = przeladuj UI z biezacego indeksu. Wczytaj z dysku = skan/ingest Marketing (admin).

46. **ZIP != wizualizacja (KRYTYCZNE, 2026-07-18):**
    - Archiwa (`.zip` / `.rar` / `.7z`) **NIGDY** nie sa wariantami wizualizacji ani galeria / studio (nawet gdy leza w `4 - WIZKI`).
    - Folder `3 - DRUK` / `DRUK` = pliki do druku; ZIP tam = druk.
    - Nazwy typu `*Pakiet*`, `*FQ*`, `KUBARA*`, `*polzdob*` -> druk.
    - Wizualizacje = tylko obrazy: jpg/jpeg/png/webp/gif/tif/tiff (`DamLabels.isVizImage`, indexer `resolve_file_role`).
    - Asana (eksport KW): `apps/web/data/asana-tasks-kw.csv` (433 taski, kolumna sciezki) - punkt wyjscia do projektow / materialow marketingowych; sciezki moga byc sprzed migracji.

47. **Liczniki produktow (nie mylic):**
    - **187** = foldery produktow w plaskiej strukturze Marketing (`X:\…\- DK` 144 + `- GC` 43). To jest poprawna liczba *produktow* w indeksie.
    - **~473** = foldery wariantow/rewizji (nosniki). **~322** = unikalne bazy indeksow (6300…).
    - Legacy **M:** obecnie offline - tam historycznie wiecej; migracja przez structure-mcp. Archiwum: `X:\Marketing\-- ARCHIWUM --`.
    - UI status: `N produktow · M wariantow` - nie ukrywac wariantow za samym "187".

48. **Jezyk UI (zakaz zargonu):**
    - Zakaz etykiet: "Ingest pointerow", "ingest", "pointer". Przycisk: **Wczytaj z dysku**.
    - Kompletne: **Materialy kompletne** (+ lista 3 rol z ptaszkiem). Nie "Wszystkie wymagania spelnione".
    - Jedna ikona statusu na wiersz checklisty (bez drugiej ikony roli).

49. **Baza danych (stan 2026-07-18):**
    - TAK: SQLite w repo `apps/desktop/data/dam-local.sqlite` (users, device_sessions, audit_log). Nie na Marketing.
    - Preferencje wygladu (kolor, widok checklisty) - docelowo w tej bazie + panel **Dostosuj wyglad**; na razie Geex customizer (motyw/LTR). Nie hardkodowac fioletu poza tokenami Geex.

50. **Modal wizualizacji (KRYTYCZNE):**
    - Klik wariantu zmienia podglad przez `thumb_url` / bridge `/media` - **NIGDY** `img.src = X:/...` (przegladarka nie laduje sciezki dysku).
    - Chip wariantu: etykieta = **indeks** gdy wiele rewizji PL; jezyk tylko gdy realnie multi-lang. Badge "Multijezyczny" tylko gdy >1 jezyk; inaczej "Wiele rewizji".
    - **Chip ZAWSZE** (`.dam-viz-modal__variant`) - nawet przy 1 indeksie. Ten sam design, nie chowac.
    - Modal ~50% wiekszy (`max-width ~1020px`, hero ~420-520px) + zoom minus / lupa(reset) / plus.
    - Akcje w jednym wierszu: Produkt + Eksplorator + okragle ikony Kopiuj / Udostepnij.
    - Thumb z WIZKI: indeks zgodny z rewizja; domyslnie czysty **FRONT-S** (`DK-*-FRONT-S.png`), nie SKLEP2-XL (`pick_thumb_file` tier 0).
    - Admin: `#vizAdminToggle` / `dam_admin_mode` -> przycisk **Miniatura**; persist `data/thumb-overrides.json` + `POST /thumb-override` (repo). Repair: `repair-viz-thumbs.py`.

51. **Nosniki / nazewnictwo PS (KRYTYCZNE, 2026-07-18):**
    - Zrodlo prawdy: skrypt `EKSPORT WIZEK PS.jsx` (folder `…/Skrypty/PS/EKSPORT WIZEK PS`).
    - Kanoniczna nazwa: `<MARKA>-<NOSNIK>-<PRODUKT>-<INDEKS>-<SIDE>-<S|L>.<ext>`.
    - Folder wariantu czesto: `FOLIA - 09.02.2024 - 6300450.00` (nosnik - data - indeks).
    - **NIGDY** UI "Nosnik nieokreslony" gdy w nazwie folderu jest czytelny nosnik (FOLIA, DOY, BAT…).
    - Parser: `DamLabels.parseCarrierCode` / `parseRevisionMeta` / `extractIndexFromString` (jak w JSX).
    - Chippy meta: Marka (DK/GC), indeks, data. Produkt header pokazuje Marka + Indeksy.
    - Tryb admina: edycja indeksu + `POST /rename-index` (bridge) zmienia nazwy plikow/folderow **wewnatrz tego folderu wariantu** po confirm (mozliwosc, nie auto).

52. **Header wiadomosci / powiadomienia (2026-07-18):**
    - Badge = realne liczniki (Asana open + Teams stub / ops items), nie hardcode 84/2.
    - Popup: wiekszy padding, hierarchia tytul/czas/opis, ikona z tonem, chip zrodla; bez underline na wierszach.
    - Login: logo DK wycentrowane nad tytulem (`height: 56px`); nie `text-align: left` na logo.

53. **Tag bar + akcje kart wiz (2026-07-18):**
    - Wszystkie kategorie (Smak/Typ/Opakowanie/Autor) widoczne od razu. BEZ globalnego max-height przycinania.
    - Gdy kategoria ma >10 tagow: pokaz 10 + `+N` tylko dla tej kategorii; rozwiniecie zawija w dol i spycha siatke.
    - Karty/modal wiz: "Przejdz do produktu" z tekstem; Eksplorator i Udostepnij = tylko ikona (`dam-btn-icon-only`).

54. **Bridge + skroty + header chrome (2026-07-18):**
    - `python -m http.server 8765` **bez** mostu = zawsze "Pliki offline". Dev: `python apps/desktop/serve_browser.py`. Prod: skrot DAM ETA (`launch.py`) - most + supervisor restart.
    - Offline UI: `body.dam-bridge-offline` delikatny czerwony pasek u gory; pill `#damRootStatus` wiekszy (padding 8px).
    - Skroty: F1 pomoc modal (`dam-shortcuts.js`), F5 / Ctrl+R odswiez (pywebview = restart okna).
    - Badge header: messages `#B45309`, notif `#0E7490` (nie jasny zolty/turkus).
    - Ikony header: Unicons line (`normalizeHeaderIcons`), nie grube fill-SVG z demo Geex.

55. **Typografia + switch wiz (2026-07-18):**
    - Skala w `dam-tokens.css`: `--dam-fs-xs|sm|md|base|lg|xl`, `--dam-control-h/fs` (toolbar 38px / 12px).
    - Wiz: badge rewizji = switch `#vizLatestOnly` (persist `dam_viz_latest_only`). OFF = expand z `products.revisions` z wizki.
    - Karty wiz: tytul/meta/badge/akcje wycentrowane (`.dam-viz-card__body`).

56. **Autor projektu (2026-07-18):**
    - Sidebar footer / i18n / settings / help: **inyfinn.art** (nie ETA Innovations). Link `https://inyfinn.art`.
    - CTA karty wiz: tekst **Przejdz** (nie "Przejdz do produktu").
    - ui-taste skill: intensive mode = 10 rund QA gdy user prosi o mocne dopracowanie.

57. **Indeks produktu - zakaz NOID (KRYTYCZNE, 2026-07-18):**
    - Foldery czesto maja indeks bez `.00` (`DOY - 23.06.2026 - 6300760`). `parse_index` w `build-file-index.py` musi akceptowac same cyfry (jak `DamLabels.extractIndexFromString`).
    - **Zakaz** stringa `noid` w UI i w `index_base` prezentowanym userowi. Fallback pliku miniatury: `pending`. Brak numeru: etykieta **Bez indeksu**.
    - Karty wiz: badge z prawdziwym indeksem (np. `6300760`). Po naprawie: `repair-missing-indexes.py` albo rebuild indeksu.
    - Kalkulator kosztow: **nie** chmura tagow. Picker: bucket (Produkty / Marketing) + szukaj + select + karta "Wybrany projekt". Copy dla ksiegowosci, nie sciezki plikow.

58. **Taxonomia Typ vs Smak (KRYTYCZNE, 2026-07-18):**
    - **Typ** = format / nosnik / linia: `baton`, `mini baton`, `mini batoniki`, `BAT` (`bat`), `sleeve`, `karton 6x`, `kulki`, `sypkie`, `niemiesne`, itd. Priorytet nosnikow w `TYP_PRIORITY` / `CARRIER_TO_TAG` (`build-file-index.py`).
    - **Smak** = smak produktu (`malina`, `muffin`, `czekolada`…). **muffin nie jest Typem**.
    - **Opakowanie** osobno: doypack, folia, karton, tuba, bigpak, doy 6x.
    - Przyklad: `DK-DOY-KULKI-MALINA-…-6300754` -> typ `kulki`, smak `malina`/`owocowe`, opakowanie `doypack`.
    - Po zmianie reguł: `repair-tag-taxonomy.py` (szybko) albo pelny `build-file-index.py`.
    - Tag bar: `dam-tag-bar.js` auto-mount `#damSearchTags` (cold-load); etykiety `bat`->BAT, `niemiesne`->niemięsne.
    - Mobile drawer: NIE uzywac jQuery `width:toggle` (zostawia `translateX`); CSS `left:0` + `transform:none` + safe-area (`dam-brand.css` ≤1199px).

59. **Wiazanie sesji z maszyna (KRYTYCZNE, ADR-008, 2026-07-18):**
    - Przed UI: `launch.py` -> `machine_identity.verify_launch_binding()`.
    - `machine_id` = SHA256(MachineGuid + hostname + USERDOMAIN + Windows user + volume serial).
    - `device_id` = `dam-dev-` + hash; `session_id` = losowy przy loginie.
    - Mismatch -> kasuj `bound-session.json` + localStorage auth + wymus signin.
    - Bridge: `GET /auth/identity`, login/me wymagaja machine_id.
    - Cel: instalacja na udziale; zero dziedziczenia cudzej sesji miedzy PC.
    - Docs: `docs/ADR/ADR-008-device-session-binding.md`, `docs/DEPLOYMENT.md`.
    - Release ZIP: `scripts/ops/build-release-zip.ps1` -> `dist/DAM-ETA-*.zip`.
