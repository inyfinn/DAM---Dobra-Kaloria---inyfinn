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
12. **Weryfikacja UI (2026-07-18):** po kazdej zmianie wizualnej - screenshot przegladarki + Read obrazu. Zakaz oddania "na oko"/sam CDP. Sidebar collapsed: logo w calosci czytelne (`object-fit: contain`, nie crop). Regula: `.cursor/rules/verify-ui-after-changes.mdc`.

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

60. **Skrot VBS - ZAKAZ SW_HIDE (KRYTYCZNE, 2026-07-18, root cause "nic sie nie dzieje"):**
    - `run-dam.vbs` wolal `sh.Run ..., 0, False` (styl okna 0 = SW_HIDE). `pythonw.exe` i tak nie ma konsoli,
      ale STARTUPINFO ze `SW_HIDE` blokuje **pierwsze pojawienie sie** okna WinForms/WebView2 (pywebview) -
      caly backend (most, watcher, WebView2 renderer) startuje poprawnie w tle, ale okno NIGDY sie nie pokazuje.
    - Fix: styl okna **1** (SW_SHOWNORMAL) w obu `sh.Run` (fallback PATH i pythonw z pelna sciezka) +
      `sh.CurrentDirectory = desktopDir` przed `Run`.
    - Zweryfikowane empirycznie: `Start-Process wscript.exe run-dam.vbs` + polling `MainWindowTitle` co 1.5s;
      przed fixem brak okna po 120s (proces zyje, WebView2 renderer dziala), po fixie okno widoczne ~1.5-2s.
    - Nie diagnozowac tego przez samo sprawdzenie `Get-Process` po chwili - proces bedzie zawsze zyc; test
      MUSI sprawdzac `MainWindowHandle` / `MainWindowTitle`.

61. **WebView2 profil trwaly (szybszy start, 2026-07-18):**
    - Domyslnie pywebview (`private_mode=True`) tworzy NOWY folder w `%TEMP%\tmpXXXXXXXX\EBWebView` przy
      KAZDYM starcie i usuwa go po zamknieciu (`clear_user_data()` w `edgechromium.py`) - to "cold start"
      WebView2 (bez cache) kazde uruchomienie.
    - Fix w `launch.py`: `webview.start(..., private_mode=False, storage_path=apps/desktop/data/webview2-profile)`.
      Profil zostaje na dysku miedzy sesjami (gitignored). TypeError fallback dla starszych pywebview.

62. **Teksty przyciskow - jeden human-friendly wzorzec (ui-taste, 2026-07-18):**
    - Zakaz gołych imperatywow bez obiektu ("Podpowiedz", "Sprawdz") - user zglosil jako "dziwne".
    - Wzorzec: "Wykryj automatycznie" (z ikona lupy) / "Sprawdz foldery" (z ikona ptaszka) - `dam-btn-icon`.
    - Komunikaty: stan ladowania ("Szukam folderu Marketing...", "Sprawdzam foldery...") + wynik w jezyku
      czlowieka ("Wszystko w porzadku - ta sciezka zawiera wymagane foldery.", "Znaleziono: X - kliknij...").
    - Zero krzywych cudzyslowow „ " w kodzie (mangled na `?`/`` w tym projekcie) - tylko ASCII `"`.
    - Zmiana w: `settings.html`, `dam-paths.js` (modal setup), `dam-shortcuts.js` (panel pomocy).

63. **Dashboard/Faktury - karty statystyk 2x2 + kolory (KRYTYCZNE, 2026-07-18):**
    - `.geex-content__summary__count` NIE uzywac `grid-template-columns: repeat(auto-fit, minmax(...))` dla stalej liczby
      kart (4) - auto-fit dobiera liczbe kolumn wg szerokosci kontenera i przy 4 elementach czesto daje 3+1
      (osierocona karta w nowym rzedzie, zle wyrownana). Fix: `repeat(2, minmax(0, 1fr))` na sztywno (2x2 zawsze),
      `repeat(1, ...)` tylko pod 575.98px. Zweryfikowane CDP `getBoundingClientRect` na 375/768/1360/1920px.
    - Kolory kart: **zakaz** `.danger-bg` (czerwony) dla neutralnych metryk (np. liczba zadan Asana) - czerwony =
      alarm, myli usera. Uzyc `.info-bg`. Geex domyslny `--info-color: #58CDFF` ma kontrast ~1.8:1 z bialym tekstem
      (WCAG AA wymaga 4.5:1) - nadpisane w `dam-tokens.css` na `#5B8DEF` (kontrast ~5:1).
    - Literowka klasy `primay-bg` (bez "r") -> `primary-bg` (poprawna, istniejaca w `style.css`).
    - Wzorzec 4 kart: primary (fiolet, total), info (niebieski, w toku/neutralne), success (zielon, kompletne),
      warning (oranz, braki). `danger` tylko dla realnie blokujacych stanow.
    - `assets/img/balance-bg.svg` (dzielony przez `dashboard.html` + `invoices.html`): usunieto losowe
      pastelowe blob-y z demo Geex (koral #EF9A91, krem #F1E6B9, blekit #B7DBF9 - kolory bez zwiazku z marka/kosztem).
      Nowy motyw: "sygnet" (2 nakladajace sie kola = monety) w barwach marki (Geex fiolet #AB54DB + DK zielony
      #008244), niska opacity (0.14-0.16) + 2 cienkie piersciene (obrys monety) - subtelny, zwiazany z kosztami,
      "lekko widoczny" w tle panelu (nie przycisk, nie logo).
    - Cache bump: `dam-tokens.css?v=20260718cost1`, `dam-app.css?v=20260718cost1`, `balance-bg.svg?v=20260718cost1`
      (wszystkie strony HTML zaktualizowane razem, jedna wersja).

65. **Wizualizacje: switch "Pokaz wszystkie" (2026-07-18):**
    - Domyslnie OFF = tylko aktualne (najnowsze rewizje), bez Demo.
    - ON = starsze/nieaktualne + Demo/prototypy. Tooltip to tlumaczy.
    - Klucz localStorage: `dam_viz_show_all` (stary `dam_viz_latest_only` migrujemy odwrotnie).

66. **Tagi Opakowanie = pelna lista nosnikow (2026-07-18):**
    - Opakowanie: doypack, baton, mini baton, karton 6x, karton, bigpak, folia, etykieta,
      etykieta butelka, etykieta sloik, rekaw, tuba, shot (+ doy 6x, sasz, obwoluta).
    - Nosniki NIE w wierszu Typ (Typ = forma: kulki, sypkie, nuggets…).

64. **Naming dictionary + rozpoznawanie nosnikow/jezykow (2026-07-18):**
    - Jedno zrodlo: `apps/web/data/naming-dictionary.json` (+ sciagawka `docs/NAMING.md`).
      Python (`build-file-index.py`) i JS (`dam-labels.js`) czytaja ten sam slownik.
    - `parse_carrier`: SLEEVE/FOIL/CARTON → REKAW/FOLIA/KAR; kody CZ/SK odcinane z prefiksu nosnika.
    - `parse_folder_langs`: skanuje WSZYSTKIE segmenty ` - ` (nie tylko ostatni).
    - Jezyk wiz: folder-langs → jawny kod z pliku → default marki (DK=pl, GC=gb) tylko gdy brak sygnalu.
    - MIX → etykieta `MIX - <nosnik>` (nigdy gole WARIANT). UI nosnikow zawsze PL.
    - Foldery zaczynajace sie od daty → carrier OTHER, potem inferencja z nazw plikow; DATE/WARIANT-*
      bez tokenu nosnika zostaje puste (zglaszac do potwierdzenia, nie zgadywac FOLIA/DOY).
    - Wspolne tagi: `dam-badges.js` (explorer + wizualizacje); "Warianty" zamiast "Wiele rewizji".
    - Tryb admina tylko gdy `DamApi.role()==="admin"`; klasa `.dam-admin-control` (czerwona obwodka).
    - Miniatura: pywebview `pick_thumb` + browser `GET /folder-images`; flagi `viz-flags.json` + `POST /viz-flag`.
    - Cache UI: `?v=20260718vizadm1` (dam-brand, dam-labels, dam-badges, dam-viz, dam-explorer).

67. **Dashboard widgety (2026-07-18):**
    - Konfigurowalny pulpit: `dam-dashboard-widgets.js` + `dam-dashboard.css` + modal Dostosuj.
    - Layout w `localStorage` klucz `dam_dash_layout_v1:<email|anon>`. Domyslnie BEZ kosztu miesiaca.
    - 24 widgety (katalog w registry). FMCG landed: `data/fmcg-cost-averages.json` + `dam-fmcg-cost.js`.
    - Powiadomienia nowej wiz: `dam-notify.js` (Notification API, poll 60s, klucz `dam_notify_new_viz`).
    - Sprzedaz / SWOT / landed = szacunki az do danych realnych (etykieta chip).
    - Cache: `?v=20260718dash3`.

## 2026-07-18 - Tagi wizualizacji v2: rozmiary, OTHER, moderacja, aliasy, zgloszenia (7 faz)

68. **Rozmiary tagow - matematyka (KRYTYCZNE, nie zmieniac bez pytania):**
    - Pill wyszukiwania (Smak/Typ/Opakowanie, `.dam-tag-pill`): `font-size: var(--dam-tag-fs-pill, 10.5px)` (+5% od bazowych 10px).
    - Badge karty/modalu (`.dam-viz-badge`): `font-size: var(--dam-tag-fs-badge, 14px)` (= pill x1.35).
    - Tokeny w `dam-tokens.css`. **Zakaz** przywracania `min-height/min-width: 44px` na `.dam-viz-badge` -
      to byl root cause "tagi 2x za duze" (2026-07-18). Touch-target 44px tylko dla klikalnych `button.dam-badge-tag`
      przez niewidoczny `::before{inset:-8px}` (hit-area), NIE przez wizualne rozdecie chipa.
    - `maxTotal` w `DamBadges.render()` (dam-badges.js) limituje SUMA tagow na karcie (nie tylko per-kind) -
      przy dodawaniu nowego typu tagu na karte ZAWSZE podnies `maxTotal` w wywolaniu w `dam-viz.js`,
      inaczej nowy tag ucina sie w "+N" (bug znaleziony 2026-07-18: dodanie Kategorii+Podkategorii
      bez podniesienia `maxTotal` z 6 na 9 chowalo Multijezyczny/Indeks).

69. **OTHER/WARIANT - nigdy w UI (KRYTYCZNE):**
    - Root cause: `DamLabels.carrierLabel()` (dam-labels.js) i `naming-dictionary.json.ui.multi_lang_label`
      to DWA rownoleglych zrodla - dictionary ladowany przez XHR NADPISUJE JS defaults (`applyNamingDict`).
      Napraw ZAWSZE w OBU miejscach, inaczej zmiana w jednym pliku "nie dziala" (co wygladalo jak bug cache).
    - `carrierLabel()` zwraca `""` (nie renderuje sie) dla OTHER/UNKNOWN/WARIANT - NIGDY literal.
    - Zgadywanie typu (Faza 2): `build-file-index.py scan_product()` - majority carrier z sasiednich
      rewizji TEGO SAMEGO produktu. Ustawia `carrier_guessed: true` na rewizji/viz_latest. UI: badge
      typu + male "?" (`.dam-viz-badge--guessed::after`), widoczne dla WSZYSTKICH rol (nie tylko admin).
    - Brak typu i brak zgadniecia -> badge "Dodaj typ" (`showCarrierPlaceholder`), klikalny dla wszystkich.

70. **Podkategoria PL (bracket produktu) - diakrytyki (KRYTYCZNE):**
    - `SUBCATEGORY_PL` w `build-file-index.py` mapuje nawias `[ balls_crispy ]` -> "Kulki Kruche" itd.
      Zrodlo bracketow = `BRACKET_HINT_RE` na SUROWEJ nazwie produktu (NIE filtrowana `bracket_tags`
      z `is_noise_tag` - ta odrzuca wielowyrazowe tagi typu "balls_crispy"/"plant based", potrzebne dla
      Typ/Smak, ale Podkategoria potrzebuje wszystkich).
    - Audyt polskich znakow 2026-07-18: `LANG_LABELS` (dam-labels.js) I `naming-dictionary.json.languages`
      mialy Lotwa/Wegry/Slowacja/Wlochy/Bulgaria/Slowenia BEZ diakrytykow (nie mojibake - po prostu
      nigdy nie wpisane z akcentem). Naprawione w OBU plikach. `REKAW`->`RĘKAW`, `ETY-SLO`->"ETYKIETA SŁOIK".
    - **WAZNE:** `repr()`/`print()` w PowerShell/cp1250 konsoli PSUJE polskie znaki na WYJSCIU (pokazuje
      U+FFFD) mimo ze plik na dysku ma poprawny UTF-8 - zawsze weryfikuj przez `open(..., 'rb').read()`
      (bajty) albo w przegladarce, NIE przez `print(repr(...))` w terminalu Windows.

71. **Alias produktow DK<->GC (P1/P9):** `apps/web/data/product-aliases.json` - grupy `{canonical_id,
    linked_by, members:[{product_id,brand}]}`. `apply_product_aliases()` w `build-file-index.py` dopisuje
    kazdemu czlonkowi `linked_products` + `alias_langs` (suma jezykow wszystkich czlonkow + default marki
    PL/GB). Frontend: `dam-viz.js withAliasItems()` rozszerza pasek wariantow modalu o wszystkie
    `linked_products` PRZED dedupem. Seed: `owies-miod-sniadanie` (DK) <-> `cornflakes-peanuts-honey-balls-crispy`
    (GC), wspolny indeks 6300699. Nowe pary: reczna edycja JSON (UI picker - Faza 4/przyszlosc).

72. **Moderacja tagow (Faza 4) - kolejka propozycji:**
    - `local_bridge.py`: `POST /rename-revision-prefix` (dowolna rola) - admin/power_user + `dam_admin_mode=1`
      -> zmiana NATYCHMIASTOWA na dysku (`rename_revision_prefix_on_disk` - zamienia WYLACZNIE prefiks
      folderu, wykrywa istniejacy znany kod i GO ZASTĘPUJE, nie doklejuje drugiego przed pierwszym).
      Inaczej -> `tag-proposals.json` (status pending, `expires_at=+72h`).
    - `GET /tag-proposals` lazily wywoluje `auto_apply_expired_proposals()` (72h bez decyzji = auto-apply).
    - `POST /tag-proposals/decide` {proposal_id, decision: approve|reject|pick_other} - panel w
      `settings.html#damModerationPanel` (`dam-tag-edit.js renderModerationPanel`), widoczny dla admin/power_user.
    - `carrier-types.json` (custom_types/deleted_types) - "Dodaj typ" w popover (`dam-tag-edit.js`).
      Usuniecie typu z `replacement` -> zbiorczo `rename_revision_prefix_on_disk` dla wszystkich wpisow
      w `carrier-assignment-log.json` z tym kodem (historia przypisan, appended na kazdej zmianie).
    - Frontend klik na tag typu (`.dam-tag-editable`) -> `DamTagEdit.openCarrierPicker()` (popover),
      NIE filtr wyszukiwania (to bylo domyslne zachowanie `dam-badges.js` przed Faza 4).

73. **Zgloszenie "Zglos zapotrzebowanie" (Faza 5/6, P10):**
    - Modal `dam-viz-request.js` (`DamVizRequest.open(ctx)`): checkboxy Email/Teams/Asana/W aplikacji +
      Wszystko/Wyczysc/Odwroc + Anuluj/Wyslij + X. Pamieta wybor: `localStorage.dam_viz_request_channels`.
    - Backend `POST /viz-request` (local_bridge.py): wpis w `inbox-items.json` ZAWSZE (niezaleznie od
      kanalow), Email/Teams/Asana na razie STUB (log do audit-log, gotowe pod prawdziwe credentiale
      ADR-005). Odbiorcy "grafik": `apps/web/data/notification-groups.json` (edytuj plik, nie kod).
    - Modal wizualizacji: jezyki bez realnej wizki (`alias_langs` minus `items` obecne langi) ->
      wyszarzony badge (`.dam-viz-badge--lang-missing`) + przycisk zgloszenia (`uil-bell-plus`).
    - Siatka glowna: TYLKO pozycje z realna wizka (bez zmian - juz bylo). "Pokaz wszystkie" = reszta.

74. **Inbox (Faza 6):** `inbox.html` (nowa strona) - laczy `GET /inbox-items` (bridge) + `data/asana-tasks.json`,
    filtr po tagach (wizualizacja/asana/teams/mail/projekt/prywatna). "Wszystkie zadania" w panelu wiadomosci
    (`dam-shell.js`) linkuje TU (bylo: `dashboard.html` - literalny bug zglaszany przez usera, potwierdzony w kodzie).
    `PAGE_TRAIL.inbox` dodany dla breadcrumb.

75. **X / Wstecz - audyt UX (Faza 6):**
    - Generyczna klasa `.dam-modal-x` (dam-brand.css) dla przyciskow zamkniecia - dodana do
      `damAddVariantModal` (byl bez X, tylko "Anuluj"). Thumb-picker juz mial X (`×` + click-outside).
    - `dam-shell.js goBackNav()`: jesli otwarty modal/popover/lightbox (`#damVizModal`, `#damVizRequestModal`,
      `#damTagEditPopover`, `#damThumbPicker`, `#damAddVariantModal`) -> **Wstecz go zamyka**, NIE nawiguje
      do innej strony (`closeTopmostOverlayIfAny()`). Nawigacja miedzy stronami (pelny stack) - bez zmian,
      poza tym wyjatkiem (user: "cofa ostatnia akcje, nie cala karte - WYJATEK: podglad zamyka Wstecz").

76. **Naprawa migracji MATERIALY->PROJEKT/DRUK (Faza 3) - NIE AUTOMATYCZNA:**
    - Skrypt `apps/web/scripts/repair-materialy-to-projekt.py` (DK+GC, generyczny po slowach-kluczach
      MATERIA/PROJEKT-PROJECT/DRUK-PRINT w nazwie slotu, nie po numerze - warianty nazw sa niekonsekwentne:
      "2 - PROJEKT"/"2 - Projekt"/"2 – PROJEKT"/"2- PROJEKT"/"PROJEKT" bez numeru).
    - Zasada: PROJEKT ma pliki -> NIE RUSZAMY. PROJEKT pusty -> szukaj .ai/.psd/.indd/.pdf w MATERIALY
      (w tym JEDEN poziom podfolderow, np. "...Folder do druku" - user zglosil ze migracja czasem tam
      zagniezdzila pliki) -> raport `data/materialy-to-projekt-dryrun.json`. DRUK tylko FLAGOWANY
      (nigdy automatycznie przenoszony - inna semantyka checklisty). Brak zrodla -> zostaw, checklist
      i tak pokaze brak (to jest prawda o danych, nie zgadujemy).
    - **Domyslnie tylko dry-run.** `--apply` wymaga wyraznej zgody usera PO przegladzie raportu - ZERO
      usuwania, `shutil.move` tylko gdy dest nie istnieje, audit log kazdego przeniesienia.
    - Test run 2026-07-18: 16 kandydatow (6 DK, 10 GC) - w tym potwierdzony przypadek usera
      (ORZESZKI MIOD/6300524, plik w `1 - MATERIAŁY/DK_..._Folder`).
    - Rozszerzona checklista: `classify_special_document()` rozpoznaje "karty_wprowadzenia" (zwykle w
      MATERIALY) i "strategia" (.pptx z "strategi"/"pozycjonowani"/"koncepcj" w nazwie, rowniez MATERIALY).
      `SCAN_EXT` rozszerzony o .pptx/.ppt/.docx/.doc/.key.

77. **Cache-bust wspolny tej rundy:** znormalizowane na jedna wersje `?v=20260718v7f` na WSZYSTKICH
    stronach HTML dla: `dam-tokens.css`, `dam-brand.css`, `dam-labels.js`, `dam-badges.js`, `dam-viz.js`,
    `dam-tag-edit.js`, `dam-viz-request.js`, `dam-shell.js`, `dam-explorer.js`, `dam-dashboard-widgets.js`.
    Przy nastepnej duzej zmianie w tych plikach - NOWY sufiks na WSZYSTKICH stronach na raz (skrypt
    PowerShell `-replace` na `apps/web/*.html`, potem koniecznie sprawdzic brak BOM: `Set-Content
    -Encoding UTF8` w Windows PowerShell 5.1 DOPISUJE BOM - zawsze stripuj bajtami po masowej zamianie).

78. **Domkniecie checklisty planu (2026-07-18, po wlasnej weryfikacji):** dwie realne dziury znalezione
    i naprawione po zaimplementowaniu 7 faz:
    - 72h auto-apply propozycji tagow bylo TYLKO lazy (na GET /tag-proposals) - plan wymagal
      "cron/watcher co ~15 min" niezaleznie od tego czy ktos otworzyl panel. Dodano
      `_tag_proposal_watcher()` (daemon thread w `local_bridge.py main()`), lazy check zostaje jako
      dodatkowa siec bezpieczenstwa.
    - "Pokaz wszystko" nie ujawnial rewizji BEZ wizki jako wyszarzonych placeholderow (byly calkowicie
      pomijane w `expandVizFromProducts` - `dam-viz.js`). Naprawione: gdy `onlyLatest=false` (showAll),
      rewizje z `wizki_count===0` dostaja `has_viz: false`, karta renderuje `.dam-viz-card--no-viz`
      (szary diagonalny wzor + `.dam-viz-thumb__noviz` "Brak wizualizacji") z przyciskiem "Zglos"
      (`.dam-viz-request-btn` -> `DamVizRequest.open()`) zamiast Przejdz/Udostepnij.

78. **App chrome + tag edit (2026-07-18 vizux):**
    - Favicon/PWA: `assets/img/favicon-dk.svg` + `manifest.webmanifest`; `dam-shell.ensureAppIcons()`.
    - Tooltipy: jasne (`.dam-tooltip` biale), `dam-tooltips.js` binduje `data-dam-tip`/`title`/`aria-label`.
    - Kolory badge: cat=zielony, carrier/opakowanie=pomarancz, subcat/smak=fiolet, warianty=teal (nie czerwony).
    - Admin tryb: pojedynczy klik tagu typu = filtr (opozniony 520ms); **podwojny klik <=500ms** lub **Shift+klik** = picker.
    - Picker: wybor pending, footer **Zatwierdz** (zielony) + **Anuluj** (czerwony X), opcja **BRAK TYPU** (`NONE` w bridge).
    - Zmiana marki DK/GC vs sciezka folderu: `confirm()` ostrzezenie.
    - Cache-bust tej rundy: `?v=20260718vizux2`.

79. **Admin modal undo + (UKRYTE) (2026-07-18):**
    - Miniatura / Demo / Ukryj / Dodaj sa **odwracalne** (toggle): Reset / Demo off / Pokaz / Usun.
    - Ukryj **nie zamyka** modala. Tag admin-only **`(UKRYTE)`** - klik odklika ukrycie.
    - Ukrycie jest na **product_id** (caly kafelek), nie na pojedynczy jezyk/indeks.
    - Admin + **Pokaz wszystko** widzi ukryte (bez showAll ukryte sa odfiltrowane nawet dla admina).
    - Tooltipy: `z-index: 20050`, tip nad stopka modala (preferAbove), bez tipowania `role=dialog`.
    - Toast: top-right (nie zaslania admin buttons). Cache-bust: `?v=20260718admin2/3`.
