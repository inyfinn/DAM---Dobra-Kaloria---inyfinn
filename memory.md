# memory.md - DAM ETA (zasady trwale)

Data startu: **2026-07-16**. Ostatnia synchronizacja docs: **2026-07-18**.  
Workspace: **tylko `P:\DAM`**. Wykonawca: Composer 2.5 / Monday.

## Indeks dokumentacji (czytaj to pierwsze)

| Temat | Plik |
|-------|------|
| Start repo | [`README.md`](README.md) |
| Agenci | [`agents/README.md`](agents/README.md), [`AGENTS.md`](AGENTS.md) |
| Jezyki / rynki | [`docs/LANG_PROVENANCE.md`](docs/LANG_PROVENANCE.md), kanon [`agents/shared/lang-provenance.md`](agents/shared/lang-provenance.md) |
| Reguly w bazie | [`docs/PROGRAM_INSTRUCTIONS.md`](docs/PROGRAM_INSTRUCTIONS.md) + `apps/web/data/program-instructions.json` |
| Log operacyjny | [`process.md`](process.md) |
| Postep | [`PROGRESS.md`](PROGRESS.md) |

**Konflikt:** wygrywa `program-instructions` (KV), nie ten plik.

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
21. **Auth roboczy (aktualizacja 2026-07-18):** `DAM_DEV_ALWAYS_ADMIN = false`. Prawdziwa sesja bridge (Bearer). Gdy token nieważny: `/auth/rehydrate` z bound-session (ta sama maszyna), inaczej signin. Nie udawać logowania samym `dam_user` w localStorage.

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

80. **Projekty + rename plikow + change-log (2026-07-18 wave2):**
 - Karty Projektow: DamBadges (marka/kategoria/podkategoria/typ/indeks) jak wizualizacje; checklista 6 pozycji (AI, podglad, druk, wizki, elementy, marketing).
 - Podkategoria w filtrach viz: max 10 widocznych, reszta za +N.
 - Picker typu: naglowek tylko \Wybierz typ\ / \Zaproponuj typ\.
 - Po Zatwierdz: rename folderu + pliki AI/PDF/wizki (GC-DOY-product - LANG - index.ext), wpis change-log.
 - Cofnij/Ponow: GET/POST /change-log*, plik data/change-log.json.
 - Discrepancy: assignment-log vs dysk -> carrier_guessed + tip \Wczesniej zatwierdzono X\.
 - Cache-bust: ?v=20260718wave2.

81. **ELEMENTY: auto + reczne powiazania (2026-07-18):**
 - Auto: `1 - MATERIALY/ELEMENTY` (+ skladniki/ingredients), skan 1 poziomu w srodku ELEMENTY; patch `patch-elements-in-index.py`; indexer `scan_elements_files`.
 - Reczne poprawki (user/admin): `data/elements-overrides.json` + bridge `POST /elements-link`, `GET /folder-browse`. UI checklisty: ikona folderu (reveal), link (wskaz folder/plik), unlink.
 - Po wskazaniu: checklista = OK (`powiazane: N pl.`); ikona otwiera wskazany folder w Eksploratorze.
 - Studio lightbox: kompaktowa siatka, stage flex fit. Cache explorer: `?v=20260718elemLink1`.

82. **Checklista 8 slotow + tagi listy + Zglos (2026-07-18 check8):**
 - Lista produktow (explorer): tagi jak wizualizacje - kategoria + podkategoria + jezyki; indeks/data chip = **13px**.
 - Warianty: typ nosnika + jezyki (z `rev.langs` lub z plikow) + brand/index/date/status.
 - Checklista bez naglowka "Brakuje materialow" - status tylko ikonami. Etykiety: "Plik zrodlowy projektu graficznego", "Podglad PDF projektu", + **Karta wprowadzenia**, **Prezentacja** (karty_wprowadzenia / strategia|pptx).
 - Karty Projektow: przyciski obok siebie (~36px). Detail: **Przelicz** + **Zglos** (nie "Powiadom") = `DamVizRequest` jak wizualizacje.
 - Cache: `?v=20260718check8c` (index/project CSS), explorer check8b.

83. **Karty + detail polish card7 (2026-07-18):**
 - Karty: bez "Rynek PL" i bez duplikatu indeksu w meta; **indeks-tag pod tytulem**, potem reszta tagow (kolejnosc DamBadges + PL); tagi +1px font/+1px pad; akcje = **Przejdz** + folder Windows (+ Asana gdy zmapowany).
 - Detail: tytul font-weight 500; header = DamBadges (nie `#hash::index`); checklista wiecej oddechu; klik OK-slotu -> Przejdz + Folder; panel Akcje = kafelki ikona+tekst+opis (Przelicz/Zglos/Eksplorator/Folder/Asana).
 - Global: PPM na `.dam-viz-badge` / `.dam-badge-tag` = kopiuj tekst tagu + toast `#damGlobalToast`.
 - Asana stub: `ASANA_BY_INDEX["6300728.00"]` = link usera; rozszerzac mapa gdy beda kolejne.
 - Cache: `?v=20260718card7`. Nadpisane przez card7b (§85).

84. **Postgres Synology - DDNS first + offline (2026-07-18):**
 - **Zrodlo prawdy online:** Postgres Docker na NAS (`dam-eta-postgres`), port hosta **5433**, DB/user `dam_eta`.
 - **Host priorytet:** zawsze `inyfinn.synology.me` (DDNS). LAN `192.168.0.145` tylko awaryjnie gdy DDNS nie odpowiada. Nie hardkodowac samego numeru IP jako primary. QuickConnect / `:5001` = DSM UI, **nie** Postgres.
 - **Gdy brak polaczenia** (timeout, refused, CGNAT, ISP zamknal NAT, zmienne IP bez forwardu): `dam_db` wchodzi w **OFFLINE** - lokalny SQLite `apps/desktop/data/dam-local.sqlite` + jasny hint (status `offline_mode` / `offline_hint`). Co ~120 s retry DDNS. Nie udawac, ze wszystko jest online.
 - **Przypomnienie diagnostyczne:** konfiguracja serwera moze byc OK, a problem = brak otwartego NAT / CGNAT / ISP nie daje publicznego IP. Wtedy DDNS moze wskazywac zly/nieosiagalny adres.
 - **Kopia wspolna dla wszystkich:** dumpy w `DATABASE/` (GitHub) + sync godzinowy; sciezka Marketing: `X:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\CURSOR\Database DAM`. Kazdy z repo ma dostep do ostatniego dumpa nawet gdy PG pada.
 - Config lokalny (gitignored): `apps/desktop/data/pg-config.json` / `dam-connection.env`. Szablony: `pg-config.example.json`, `dam-connection.env.example`. ADR-009.

85. **CGNAT / brak publicznego IP - jak sie polaczyc do PG (2026-07-18):**
 - **DDNS + port-forward NIE dziala przy CGNAT** - ISP nie wpuszcza ruchu przychodzacego do domu. Same `inyfinn.synology.me` nie pomoze.
 - **Rozwiazanie docelowe przy CGNAT: mesh VPN (Tailscale / ZeroTier / Netbird)** na NAS + kazdym PC. Ruch wychodzi z obu stron (hole-punch / relay) - bez otwartego NAT. Potem host PG = Tailscale IP lub MagicDNS NAS (np. `100.x.x.x:5433`), nie publiczny DDNS.
 - Alternatywy: (A) kupno publicznego/"bialego" IP od ISP + dalej DDNS+5433; (B) VPS z publicznym IP + reverse WireGuard z NAS; (C) IPv6 jesli ISP daje prawdziwe IPv6. Cloudflare Tunnel / QuickConnect = OK dla WWW/DSM, **nie** jako surowy Postgres.
 - Preferencja dla zespolu DAM: **Tailscale na Synology (Package Center) + Tailscale na Windows**. Po wdrozeniu dodac host Tailscale na poczatek `DAM_PG_HOSTS` (przed DDNS albo zamiast DDNS spoza domu). Port 5433 wtedy NIE musi byc na routerze WAN.

86. **Propose JSON -> admin apply (2026-07-18):**
 - **User / power_user:** tylko zgłoszenia tekstowe (JSON). Zapis do `tag-proposals.json` + wpis w `inbox-items.json`. Brak zapisu kanonicznego / dysku.
 - **Admin:** jedyny kto `decide` / apply (rename, carrier-types, viz-flag, overrides, change-log undo/redo, index rebuild, db/*). Sesja z `Authorization: Bearer` - body.role / admin_mode NIE daja privilege (anti-spoof).
 - Po TTL 72h: **eskalacja do Inbox**, NIE auto-zapis na dysk.
 - Viz-request: kazdy zalogowany -> inbox. Drive/Git sync pliku SQLite = zakazany (ADR-009).
 - Bridge: `_require_login` / `_require_admin` w `local_bridge.py`.

87. **Inbox + OAuth + legal (2026-07-18):**
 - Wiadomosci: filtr **Zgloszenia DAM**; klik wiersza = expand detalu (Asana: parent/due/section). Pusty `#damHeaderAction` MUSI byc wypelniany quickaction (konto zawsze widoczne).
 - OAuth Asana + Microsoft (Teams/Outlook Graph): `oauth_integrations.py`, tokeny Fernet w `data/oauth-tokens.json`, klucz `.dam-secret.key`. Connect w Ustawieniach po Client ID w `dam-connection.env`.
 - Dokumenty: `privacy.html`, `terms.html`, `license.html`, `consents.html`, `docs-security.html` (dla weryfikacji Google/Microsoft).
 - Hasla: bcrypt; OAuth: Fernet; nigdy plaintext tokenow w Git.

88. **Moderacja TYLKO w Wiadomosciach (2026-07-18, Faza 6):**
 - Zakaz panelu moderacji w `settings.html` / dashboard. Admin decyduje w `inbox.html` (expand zgłoszenia: Zatwierdz / inny typ / Odrzuc).
 - Filtr **Historia moderacji** = decyzje (approved/rejected/…). Deep-link: `inbox.html?tag=zgloszenie&proposal_id=…` lub `?focus=`.
 - Admin default filtr = `zgloszenie`. Badge wiadomosci += pending z `/tag-proposals`.
 - Wstecz na inboxie: zamknij expand → cofnij filtr → dopiero nawigacja. Lightbox/modale: Wstecz zamyka overlay (`#damLightbox` itd.).
 - Copy: 72h = eskalacja/przypomnienie, **bez** auto-apply na dysk (nadpisuje starszy plan P7).
 - Grupa `grafik`: `apps/web/data/notification-groups.json` (edytowalna); stub listy w Ustawieniach.
 - Cache: `?v=20260718inbox3`.

85. **Karty card7b (2026-07-18):**
 - Indeks z powrotem w **prawym gornym rogu** karty (`.dam-project-card__index-corner`); pozostale tagi bezposrednio pod tytulem.
 - Tytul = `KATEGORIA · NAZWA` (link → `explorer.html?product=…`). Przycisk **Przejdz** nadal → `project.html` (checklist).
 - Nazewnictwo: **Eksplorator** = hub DAM (`explorer.html`); **Eksplorator plikow** = Windows (ikona folderu). Sidebar/i18n PL: `nav.explorer` = "Eksplorator".
 - Status badge +7% (`calc(...*1.07)`). Soft wash `::before`: incomplete czerwony / ok zielony, ~5.75rem, alpha ~0.055 (tylko strefa status→tagi).
 - Cache: `?v=20260718card7b` / `card7b2` (CSS).

86. **PL znaki + status bazy + Wiadomosci (2026-07-18):**
 - Polskie znaki w `pl.json` + hardcoded UI (skrypt `apps/web/scripts/restore-pl-diacritics.py`). Unikac slepego replace `zadan`→`zadań` (psulo `zadania`).
 - Przyciski projektow: **Odśwież listę** = reload z indeksu; **Skanuj dysk** = ingest Marketing (bylo "Wczytaj z dysku").
 - Pill **Baza online** obok Pliki online (`dam-db-status.js`): panel zrodel Synology / GitHub dump / lokalna SQLite; tryb auto|postgres|sqlite; `POST /db/prefer`, `POST /db/reconnect` (force, bez czekania 120s); Odśwież moze `pull_dump` przez sync script `--no-commit`.
 - Prefer zapis: `apps/desktop/data/db-prefer.json`. GitHub NIE jest silnikiem live - tylko dump/backup.
 - Strona **Wiadomości** = `inbox.html` + `dam-inbox.js` w sidebarze; filtry zrodel, szukaj, mark-read.
 - Po zmianie API bazy: **restart local_bridge** (stary proces nie ma POST /db/*).
 - Cache: `?v=20260718db1` / `db1b`.

87. **Eksplorer vs Windows + checklista klik (2026-07-18, icons2):**
 - **Eksplorer** = hub DAM (`explorer.html`). Sidebar: label `Eksplorer`, ikona `uil-sitemap` (nie folder-open).
 - **Eksplorator plikow / Folder Windows** = OS Explorer. Ikona: custom SVG `DamIcons.winExplorerSvg` (folder + wewnetrzny drawer/dysk).
 - Karty: **Sprawdz projekt** (strzalka → `project.html`) + **Przejdz** (`uil-folder-open` → `explorer.html?product=`) + Win + Asana mark SVG.
 - OK-wiersze checklisty (karta + detail): klik → Przejdz + Folder Windows. Shared: `dam-icons.js` `bindChecklistRows`.
 - Wash incomplete/ok: wysokosc 8.625rem (+50%), alpha *1.3 (+30%).
 - Ramka 1px fade (50% koloru do 50% wysokosci → 0 przy 95%): `--ok` zielony + `--incomplete` czerwony (ten sam mechanizm). Nie 100% alpha.
 - Cache: `?v=20260718border50` (dam-app).

89. **Explorer brand switch + badge unify (2026-07-18, brandsw1):**
 - Usunieto biedny `#damBrandFilterTrigger` z toolbara. Filtr marki = chipy DK/GC (bylo: `#damSidebarBrandMount` + `#damProductBrandMount`). **Nadpisane przez §94** - tylko sidebar Kategorie.
 - Tagi explorera: `dam-viz-badge` pill jak karty projektow (index/brand/carrier/lang). Tytuly: `KATEGORIA · NAZWA` (+3px: title 19px, carrier 17px, folder 15px).
 - Cache explorer: `?v=20260718brandsw1`.

90. **Tagi cienkie + indeks pill global (2026-07-18, tagthin1):**
 - `.dam-viz-badge` i `.dam-index-chip` = pill `border-radius: 999px`, `font-weight: 500` jak `.dam-tag-pill` (nigdy kwadrat 4px / mono / 600).
 - Fix: `button.dam-viz-badge` NIE uzywa `font: inherit` (kradlo weight 600 z rodzica).
 - Indeksy w liscie produktow: klasy `dam-index-chip dam-viz-badge dam-viz-badge--index`.
 - Cache: `?v=20260718tagthin1` (brand + app + explorer.js).

91. **Warianty count + chipy jeden styl (2026-07-18, varcnt1 → varright1):**
 - Lista produktow: zamiast `N rew.` → blok `[N]` + tag `Warianty` **po prawej** wiersza (`grid: 1fr auto`). Nie po lewej.
 - Bez duplikatu tagu Warianty w srodku rzedu (`multiIndex: false` gdy jest `__variants`).
 - Global: `.dam-date-chip`, `.dam-status-badge`, carrier chips, index = ten sam pill token (10.5px / 500 / 999px). Label nosnika = 16px jak tytul wiersza.
 - Cache: `?v=20260718varright1`.

92. **Lista produktow air + cienka typo (2026-07-18, listair1):**
 - Tytuly/foldery: panel 15/500, wiersz 13.5/500, folder 13/500 (nie 19/600).
 - Wiecej oddechu: gap 10px miedzy wierszami i tytul↔tagi↔indeksy; padding wiersza 14/16; tlo `#f8f7fb` (jasniej niz `#f3f2f7`).
 - Chipy (tag + indeks): stale `height: 22px`, `border: 1px solid rgba(70,66,85,.14)`.
 - Cache: `?v=20260718listair1`.

93. **Panel head: Wstecz/Do przodu + ikona kategorii (2026-07-18, panelnav2):**
 - `.dam-panel-head`: strzalki historii (`navStack`) + step-up (produkt→kat→root), ikona folder/box, kicker + tytul + meta; ramka `#f8f7fb`.
 - MIXY odstep 28px od head; carrier card ramka 12px `#f8f7fb`; ikony copy/folder 45px / chevron 30px (+50%).
 - Folder sidebar: 12px / weight 400.
 - Cache: `?v=20260718panelnav2`.

94. **Carrier nest ban (2026-07-18, carriernest2):**
 - NIGDY `<button>` / `<input>` wewnatrz `.dam-carrier-toggle` (statusBadge, admin index apply) - browser zamyka toggle i wyrzuca chevron+akcje poza karte.
 - Status + akcje w `.dam-carrier-toggle__trail` poza toggle; cache `?v=20260718carriernest2`.

88. **Panel Zrodla bazy + tagi max 7 + viz ikony (2026-07-18, icons3c):**
 - Panel `#damDbStatusPanel`: zero natywnych radio/checkbox (pomarancz OS). Chipy `.dam-db-mode-chip` (aktywny = `#AB54DB` / bialy tekst) + `.dam-db-check` (fioletowe kwadraty).
 - Hint: `Auto bierze pierwsze dzialajace zrodlo. Wymus Synology albo lokalna baze ponizej.` Wiecej paddingu (22px), wrap tekstow, line-clamp 2/3 na detail/note, `overflow-y: auto`, mobile full-width.
 - Tagi global: `DamTagBar.ROW_LIMIT = 7` + viz `SUBCAT_ROW_LIMIT = 7` (+N).
 - Wizualizacje: Przejdz = `uil-folder-open` + tip Eksplorer; Win = `DamIcons.winExplorerSvg` + "Folder Windows".
 - Cache: `?v=20260718icons3c` (brand + db-status + viz).

94. **DK/GC chipy tylko przy Kategorie (2026-07-18, brandchip3):**
 - Jeden mount: `#damSidebarBrandMount` w `.dam-cat-panel__head`. **Bez** `#damProductBrandMount` / duplikatu w toolbarze produktu.
 - Styl jak tagi (`.dam-tag-pill` / badge marki): brak szarego tracka i obrysu; `border: none`.
 - Active = kolor marki (DK fiolet / GC cyan); off = niemal biale `#fafafa` + tekst `#d0d1d8`. Domyslnie obie ON.
 - Rozmiar +50% vs pill 22px/10.5px → `height: 33px`, `font-size: 15.75px`.
 - Cache explorer: `?v=20260718brandchip3`.

95. **Produkt: Pokaż wszystko + status tag (2026-07-18, showall1):**
 - Usunieto `.dam-product-meta` (Marka + nieklikalne Indeksy) - nie pokazuj tego, czego nie da sie kliknac.
 - Toolbar produktu: switch **Pokaż wszystko** (jak viz). OFF = tylko aktualne nosniki; ON = nieaktualne/starsze (lista pod karta).
 - Persist: `localStorage.dam_explorer_show_all`.
 - Tag statusu `Aktualne`/`Nieaktualne`: `dam-badge-tag` + `data-tag-kind=status`. Admin + Shift/dbl → toggle; zapis `carrier-overrides` (bridge/PG) + local `product-status`.
 - Hook: `window.damSetRevisionStatus`. DamBadges.bindClicks na `#damExplorerMain`.
 - Cache: `?v=20260718showall1`.

96. **Pomoc FAB + odświeżona pomoc (2026-07-18, help3):**
 - FAB `#damHelpFab` (fioletowy `?`, 44px, prawy dolny) = to samo co **F1** (`DamShortcuts.openHelp`).
 - Modal `#damHelpModal`: skróty ogólne + **Skróty admina** tylko gdy `role===admin` (Shift+tag typ/status, dbl-klik, DK/GC); start kroków; tagi; moduły; offline.
 - `help.html`: grupy tematów + wyszukiwarka `#damHelpSearch` (keywords + empty state). PL odmiana: 1 temat / 2-4 tematy / 5+ tematów.
 - `kbd` na stronie pomocy: jawny `color:#17161E` (Bootstrap kbd = biały tekst - niewidoczny).
 - Cache: `?v=20260718help3` (`dam-brand.css`, `dam-shell.js` → `dam-shortcuts.js`).

97. **Inbox kontekst + toolbar projektów + ramki 35% + widget viz (2026-07-18, ui35f):**
 - Inbox propozycja typu: tytul `Nazwa · BAG → DOY`; zawsze widoczny blok produktu (kola Eksplorer / Folder Windows / Wizualizacje + `DamBadges`); enrich z `file-index` po `product_id`.
 - Shared `.dam-nav-circles` + `.dam-viz-icon-btn` (36px).
 - Projekty toolbar: search wypelnia rzad; status `#damProjectsStatus` pod toolbar (`dam-projects-status-line`); bez martwej dziury.
 - Ramki kart `--ok` / `--incomplete`: alpha obrysu **0.35** (bylo 0.5), wash ~0.05.
 - Dashboard „4 najnowsze wizualizacje” (2026-07-18): ranking = **projekt Asana (start)** + **mtime pliku bez bulk-sync** (≥4 produktow w tej samej minucie = ignoruj) + dedupe 1 produkt/projekt; tagi: marka + nosnik + **indeks**; akcje = male zaokraglone kwadraty 26px (`.dam-nav-circles--tiles`); `+N` badge rozija pozostale tagi.
 - Cache: `?v=20260718ui35f` (app/brand/dashboard CSS + inbox/projects/dashboard HTML).

98. **Zgłoszenia: taby Typy / Wizualizacje / Historia + undo (2026-07-18, inboxTabs6):**
 - Sidebar: **bez** osobnej „Historia moderacji”; historia = tab wewnątrz **Zgłoszenia DAM**.
 - Taby ikonowe `#inboxZgloszenieTabs`: `typy` | `wizualizacja` | `historia` (`zgloszenieSub` w `dam-inbox.js`).
 - Deep-link: `inbox.html?tag=zgloszenie&sub=historia` (legacy `?tag=historia` → zgloszenie+historia).
 - Historia: pasek Cofnij ostatnią / Ponów (`/change-log/undo|redo`); przy wpisie **Cofnij zmianę** (`POST /tag-proposals/undo`) lub **Wróć do kolejki** (`POST /tag-proposals/reopen`).
 - Bridge: `proposal_id` w change-log; undo tylko gdy to ostatni wpis na dysku.
 - Karta propozycji: indeks (gdy jest), zmiana BAG→DOY, DamBadges, **Przejdź** + Folder Windows (jak project-card) + kola nawigacji.
 - Cache: `?v=20260718inboxTabs6`.

99. **Inbox Źródła ikony + badge/PL + actor (2026-07-18, inboxIcons1):**
 - Sidebar Źródła: szerokość **270px** (+50); ikony Unicons przy każdym filtrze; liczniki `.dam-inbox-count` jak pill/tag.
 - Header: `#damMsgBadge` / `#damNotifBadge` / `.dam-lang-code` – tint + większy padding (bez „martwej” bieli).
 - Karty: status i foot-tagi ~+10%; prawy dół **Odrzucił / Zatwierdził / Zmoderował / Zgłosił: nick** (`actorFootHtml`, nick z local-part maila).
 - Cache: `?v=20260718inboxIcons1`.

100. **Tag picker pełne listy + historia undo (2026-07-18, histUndo2):**
 - Podkategorie: z `_DAM_FILE_INDEX.products` (nie `tag_groups.podkategoria` - klucz nie istnieje). Label **PL / EN** (`Roślinne / plant based`). Popover `--wide` 360-480px.
 - Indeksy: wszystkie bazy z products (~335) + szukaj; nie tylko bieżący.
 - Historia: **Cofnij zmianę na dysku** ≠ Wróć do kolejki; po undo status `undone` + **30 s Anuluj cofnięcie** (`/tag-proposals/cancel-undo`); konflikt = timeline + audit (`GET /tag-proposals/timeline`); brak ścieżki na dysku = hint usunięcia.
 - Cache: `?v=20260718histUndo2` (inbox), `histUndo1` (viz/explorer tag-edit + brand.css).

101. **Sesja rehydrate + Dostosuj pulpit (2026-07-18, authRehydrate1 / dashCustom2):**
 - Root cause `login_required` przy „zalogowanym” UI: localStorage (`dam_user` / `dam_role`) bez ważnego Bearer; bridge odrzuca token (`qa` / wygasły). `DamApi.me()` nie może udawać sesji samym profilem.
 - Fix: `POST /auth/rehydrate` (bound-session + machine_id → nowy token); `DamApi.rehydrate()` + auto w `me()` przy `invalid_session`/`no_token`; `enforceAuth` odrzuca `qa` / demo token.
 - Dostosuj pulpit: checkbox Geex `#AB54DB` 28px (2×), panel w lewo + hover preview 350ms (kolejka animacji, hover = wyższy z-index), DnD + strzałki, dirty guard: Zapisz zmiany / Nie zapisuj / Wróć do wyboru.
 - Inbox subtitle: ludzki copy (bez „robotycznego” równości).
 - Cache: `?v=20260718authRehydrate1` (api/shell), `dashCustom2` (dashboard widgets/css).

101c. **Tagi casing globalny (2026-07-18, tagCase2):**
 - Tagi globalne: `DamLabels.formatTagLabel(label, kind)`.
 - Kody (brand/lang/carrier/index): WERSALIKI jak w slowniku (DOYPACK, GC, GB).
 - Ludzkie (category/subcategory/smak/typ): jak w zdaniu - `Kulki`, `Kulki Surowe`, `Mini Batoniki`.
 - Opakowanie w filtrze: mapuj do `label_pl` (doypack -> DOYPACK).
 - Instrukcja: `ui.tag_casing_global` w program-instructions. Cache `?v=20260718tagCase2`.

101d. **PL pod angielska nazwa GC (2026-07-18, namePl2):**
 - Karty Wizualizacji (GC): po tytule EN zawsze `<br>` + `( Polska )` ze spacjami w nawiasie, np. `MINCED` → `( Mielone )`.
 - Rozmiar jak `.dam-viz-card__meta` (11px). Nawiasy: bardzo stonowane `#c5c6cd` + opacity 0.72 (slabsze niz meta). Tekst PL: `#696877`.
 - Slownik: `data/product-name-pl.json` + KV `product-name-pl`; API przez seed bridge.
 - `DamLabels.productNamePlMarkup` + `.dam-viz-card__title-pl-paren` / `__title-pl-text`. Instrukcja: `ui.product_name_pl_under_en`.
 - Cache: `?v=20260718namePl3`.

101b. **Instrukcje programu w BAZIE (2026-07-18, instr1) - KRYTYCZNE:**
 - Wszystkie newralgiczne ustalenia (nazewnictwo, F/X/D, aktywny/nieaktywny, zakazy) → `program-instructions.json` + Postgres `dam_kv_store.program-instructions`.
 - API: `GET /program-instructions`. UI: Ustawienia → „Instrukcje programu (baza)”.
 - `memory.md` = notatka; przy konflikcie wygrywa program-instructions.
 - Po decyzji usera: najpierw dopisz instrukcje + seed KV, potem kod. Regula: `.cursor/rules/program-instructions.mdc`.

102. **Nosnik: UI = pelna nazwa, dysk = skrot (2026-07-18, namingPolicy1):**
 - **Zrodlo prawdy (nie tylko memory):** `naming-dictionary.json` → Postgres `dam_kv_store.naming-dictionary` + lustro `app-settings.json` / `dam_kv_store.app-settings`. Karta Ustawienia → „Nazewnictwo nośników”. Instrukcja: `naming.carrier_ui_vs_disk` w program-instructions.
 - `policy.carrier_display_in_ui = label_pl` (DOYPACK/FOLIA/BATON w UI).
 - `policy.carrier_prefix_on_disk = short` (DOY/FOL/BAT na dysku przy rename).
 - Kazdy nosnik ma `label_pl` + `short`. Bridge laduje `CARRIER_FOLDER_PREFIX` ze slownika (`load_carrier_folder_prefix`); seed przy starcie bridge.
 - Skroty tylko po to, zeby nazwy w Eksploratorze zajmowaly mniej miejsca - NIE etykieta UI.
 - Stare foldery `DOYPACK - ...` → `KNOWN_CARRIER_PREFIXES` + skrypt `fix_doypack_folder_prefixes.py --apply`.
 - Operacje: `change-log.json` (+ assignment-log). Cache: `?v=20260718namingPolicy1`.

98. **Tryb admina = switch w headerze (2026-07-18, adminHdr1):**
 - Jedyny przełącznik: switch **Admin** w geex-content__header__quickaction, **tuż po lewej od avatara** (po PL).
 - Zakaz lokalnych toggle na explorer/viz (#damAdminToggle, #vizAdminToggle, label.dam-admin-toggle).
 - Persist: localStorage.dam_admin_mode; event dam:admin-mode. Widoczny tylko dla 
ole=admin.
 - Pill Baza / Pliki: rozmiar zewnetrzny bez zmian (min-height 56). Tylko .dam-db-status__refresh = 24px (-50% vs 48).
 - Cache: ?v=20260718adminHdr4.


103. **Lifecycle status F/X/D (2026-07-18, life2) - TEST GATE:**
 - Admin oznacza produkt lub wariant: **F** (aktualne), **X** (nieaktualne/archiwum), **D** (demo), **Odznacz**.
 - Dysk: dopina  - F /  - X /  - D do nazwy folderu. Historia: pps/web/data/lifecycle-status.json + change-log.json (previous_name + previous_path).
 - Produkt X: cascade na warianty + przeniesienie do — ARCHIWUM kategorii. Wariant X: archiwum z wrapperem produktu (PRODUKT\\WARIANT - X).
 - Produkt D: cascade - D na warianty; odznaczenie wariantu z D przy produkcie D -> clear literki produktu.
 - Bridge: POST/GET /lifecycle-status (admin). Modul: pps/desktop/lifecycle_status.py.
 - Produkt testowy: TEST LIFECYCLE / indeks TEST-TEST w Batony/nerkowcowe. Nie ruszac realnych produktow az user potwierdzi.
 - UI: Geex dials 5/3/5. Cache ?v=20260718life2.

104. **Silent launch (2026-07-18):** zakaz widocznego CMD przy starcie/relaunch. schedule_relaunch bez ping/cmd/start; pythonw + CREATE_NO_WINDOW. run-dam.vbs zostaje styl 1 (SW_HIDE psuje WebView2). Pomoc F1: sekcja F/X/D lifecycle.
105. **Projekty: jedno X + persist wyszukiwania (2026-07-18, searchPersist1):**
 - Pole #damProjectsSearch = 	ype=text (nie search) + CSS ukrywa natywny clear; zostaje tylko .dam-search-clear.
 - Stan zapytania: sessionStorage.dam_projects_view + URL index.html?q=... (history.replaceState) + aktualizacja wierzcholka dam_nav_stack (DamShell.replaceNavStackTop).
 - Wstecz z project.html wraca do listy z tym samym q (nie resetuje widoku).
 - Cache: index.html dam-brand.css?v=20260718searchClear1, dam-projects.js?v=20260718searchPersist1, dam-shell.js?v=20260718navStackQ1.


106. **Dashboard viz scale (2026-07-18, dashVizScale8):**
 - Widget `.dam-widget--viz-latest` = pelna szerokosc main (span 9), siatka 2x2 od ~560cqi, fluid thumbs/typo.
 - Layout: `.dam-dash-layout` = `minmax(0,1fr) clamp(260px,20vw,360px)` (nie sztywne 11 kolumn).
 - Override Geex: `.geex-content:has(.dam-dash-layout) { width: 100% !important }`.
 - Cache: `dam-dashboard.css?v=20260718dashVizScale8`.

107. **Jezyki/rynki - POCHODZENIE SYGNALU (2026-07-18, doprecyzowanie DK) - HARD:**
 - Kanon: `agents/shared/lang-provenance.md`.
 - **DK zawsze PL** (pewnik marki). Extra (np. GB w PL/GB) tylko z nazw folderow/plikow albo recznego oznaczenia.
 - **GC bez baseline** - GB/CZ/SK/... tylko z tokenu w nazwie albo override; inaczej `?`.
 - Zakaz: GC->gb z marki; DK->gb bez dowodu; hardcode indeksu jako regula.
 - `lang-overrides.json` nigdy nie nadpisywane rebuildem.
 - program-instructions: `data.lang_provenance_only`.

108. **Osoba przy produkcie = wyszukiwanie, nie badge TAG (2026-07-18, people1):**
 - Cel: wpisac w szukajke „Sylwia” / „Krzysztof” / „Szymon” i trafic w produkty, ktorymi sie zajmowali.
 - **Nie** robic widocznych tagow typu „TAG Krzysztof” na kartach (chyba ze user poprosi).
 - Zrodlo: `apps/web/data/product-people.json` + KV `product-people` + Asana CSV w `enrich-search-tags.py`.
 - Po zmianie mapy: `python apps/web/scripts/enrich-search-tags.py` (+ seed KV). Instrukcja: `search.product_people`.
 - QA: `sylwia` → ~23 produktow (Mielone, Energia, Odpornosc, Prebiotyk, Kalendarz, Datesy…); bez badge imienia na karcie.
 - **Heurystyka (do integracji Asana):** 1) Asana Assignee = prawda. 2) Nowy produkt bez zadania KW w Asanie → domyslnie Sylwia. 3) Szymon tylko jako slabe zgadywanie / koordynacja, NIE gdy Asana milczy i nie ma silnego sygnalu. Integracja Asana = pozniej (user usera).


109. **Carrier toggle row + inbox hist (2026-07-18, carrierInbox11):**
 - Pasek nosnika: grid `minmax(0,1fr) auto`; chevron ZAWSZE w `.dam-carrier-toggle-row__end` (po path actions).
 - Caly pasek toggle (Enter/Space); ignore: button/a/input/tag-edit/lifecycle/path-actions.
 - Typografia: `.dam-carrier-toggle__label` i `.dam-folder-item__name` = `var(--dam-fs-base)` (jak viz-card title / prod-row title).
 - Inbox: hist-item jak mod strip; product nav = `dam-nav-circles--row` (nie stack).
