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
10. **Em-dash ban:** zakaz `?` i `?` w UI, commit messages, copy agentow. Tylko `-`.
11. **Nie kopiowac** kodu structure-mcp do DAM; tylko wiedza domenowa (sloty 0-4, indeksy).
12. **Weryfikacja UI (2026-07-18):** po kazdej zmianie wizualnej - screenshot przegladarki + Read obrazu. Zakaz oddania "na oko"/sam CDP. Sidebar collapsed: logo w calosci czytelne (`object-fit: contain`, nie crop). Regula: `.cursor/rules/verify-ui-after-changes.mdc`.
12b. **Plany (HARD, 2026-07-21):** każdy plan techniczny przez globalny skill `/planner`
    (`~/.cursor/skills/planner/SKILL.md`) — rada Grok Planner + Composer Critic, 10–20 rund
    lub konwergencja; tie/niewiedza = AskQuestion do usera. Reguła: `~/.cursor/rules/planner-mad-always.mdc`.
    Wyjątek: user napisze wprost `bez /planner` / `skip debate`.
13. **Model agentow (HARD, 2026-07-21 supersede):** Wygrywa **global rule** `~/.cursor/rules/model-grok-composer-only.mdc`.
    - **Hierarchia:** Fable 5 (najwyższa: UX/arch/plan/smak) → Sonnet 5 (review) / GPT-5.6 Sol (long-horizon multi-file) / Opus 4.8 (instruction-following) → Grok 4.5 (WORKER: briefy, fixy, masowy kod) → Composer 2.5 (szybkie/tanie; preferuj jako **read-only second eyes**, nie Lead dużych planów).
    - Parent/plan = model z UI usera — **nie** przełączaj na siłę na GROK.
    - Task/subagenci default `cursor-grok-4.5-high-fast` (alt. `composer-2.5-fast`), chyba że user nadpisze w tej samej wiadomości.
    - Brak flagowca na Fazach architektonicznych → kompensacja **procesowa** (mniejsze checkpointy, cytat reguł przed commitem, Composer read-only review), nie modelowa.
    - Stara nota „tylko GROK wszędzie / zakaz Opus-Fable na parentcie” = **NIEAKTUALNA**.

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
21. **Auth roboczy (aktualizacja 2026-07-18):** `DAM_DEV_ALWAYS_ADMIN = false`. Prawdziwa sesja bridge (Bearer). Gdy token niewa?ny: `/auth/rehydrate` z bound-session (ta sama maszyna), inaczej signin. Nie udawa? logowania samym `dam_user` w localStorage.

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
    - Akcje UX przy sciezkach: ZAWSZE para ikon **Kopiuj sciezke** + **Pokaz w eksploratorze** (patrz ?31).
    - dam-labels.js musi byc zaladowany PRZED dam-explorer.js (window.DamLabels).

## 2026-07-17 - UX v4 (brand dropdown, viz group, Synology, profil KW)

25. **Filtr marek (2026-07-18, vizBarUnify1) - KANON:** chipy **DK / GC** (`.dam-brand-chip-btn`, `DamBrandFilter.renderChips`) - ten sam komponent w Eksplorerze (sidebar Kategorie) i Wizualizacjach (pasek filtr?w). Persist: `localStorage.dam_brands` `{DK,GC}`. Sync miedzy stronami. Dropdown `Marka: DK+GC` = legacy (nie uzywac w nowych widokach). Plik: `assets/js/dam-brand-filter.js` przed explorer/viz.

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

32. **Sciezka bazowa = PER URZADZENIE (KRYTYCZNE, 2026-07-18; update 2026-07-20):**
    - Struktura ZAWSZE ta sama. Litera dysku / root Marketing jest dla **tego PC** (`device_id`), NIE globalnie dla konta na wszystkie maszyny (dom X: vs praca D:).
    - Zrodlo prawdy: Postgres KV `user-device-paths:{email}` (+ bridge GET `/user-device-paths/current`). UI CRUD: **ta sama karta** `dam-device-paths.js` w `profile.html` i `settings.html#damDisk` (nie osobny settingBasePath).
    - Folder: pywebview `pick_folder` albo bridge `POST /pick-folder`; normalizacja `DamPaths.normalizeMarketingRoot` (np. `X:\Marketing\- POLSKA` → `X:\Marketing`) przed zapisem.
    - Cache: `localStorage.dam_base_path::{device_id}` (+ legacy `dam_base_path`) oraz `machine-config.json` per Windows USERNAME na tym PC.
    - Aplikacja **NIGDY** nie nadpisuje zapisanego path auto-detectem; nigdy nie bierze sciezki z innego device_id tego samego konta.
    - Detect / Podpowiedz = tylko sugestia; zapis dopiero po Zapisz.
    - Indeks moze miec dowolne `X:/`/`D:/Marketing/...` - `toLocal` zdejmuje `[A-Z]:/Marketing` i dokleja **baze biezacego urzadzenia**.
    - Metadane = baza (file-index / API). **Pliki** = ROOT tego device. PI: `device-scoped-base-paths`. Handoff: `agents/shared/handoff-strefa-DEVICE.md`.

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
    - **Zakaz** logo Niemiesa (pliki z ?Niemiesa? w nazwie).
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
    - W jednej grupie akcji (karta, modal, panel) max **jeden** `geex-btn--primary` (solid / ?ciezki?).
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
    - **187** = foldery produktow w plaskiej strukturze Marketing (`X:\?\- DK` 144 + `- GC` 43). To jest poprawna liczba *produktow* w indeksie.
    - **~473** = foldery wariantow/rewizji (nosniki). **~322** = unikalne bazy indeksow (6300?).
    - Legacy **M:** obecnie offline - tam historycznie wiecej; migracja przez structure-mcp. Archiwum: `X:\Marketing\-- ARCHIWUM --`.
    - UI status: `N produktow ? M wariantow` - nie ukrywac wariantow za samym "187".

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
    - Zrodlo prawdy: skrypt `EKSPORT WIZEK PS.jsx` (folder `?/Skrypty/PS/EKSPORT WIZEK PS`).
    - Kanoniczna nazwa: `<MARKA>-<NOSNIK>-<PRODUKT>-<INDEKS>-<SIDE>-<S|L>.<ext>`.
    - Folder wariantu czesto: `FOLIA - 09.02.2024 - 6300450.00` (nosnik - data - indeks).
    - **NIGDY** UI "Nosnik nieokreslony" gdy w nazwie folderu jest czytelny nosnik (FOLIA, DOY, BAT?).
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
    - **Smak** = smak produktu (`malina`, `muffin`, `czekolada`?). **muffin nie jest Typem**.
    - **Opakowanie** osobno: doypack, folia, karton, tuba, bigpak, doy 6x.
    - Przyklad: `DK-DOY-KULKI-MALINA-?-6300754` -> typ `kulki`, smak `malina`/`owocowe`, opakowanie `doypack`.
    - Po zmianie regu?: `repair-tag-taxonomy.py` (szybko) albo pelny `build-file-index.py`.
    - Tag bar: `dam-tag-bar.js` auto-mount `#damSearchTags` (cold-load); etykiety `bat`->BAT, `niemiesne`->niemi?sne.
    - Mobile drawer: NIE uzywac jQuery `width:toggle` (zostawia `translateX`); CSS `left:0` + `transform:none` + safe-area (`dam-brand.css` ?1199px).

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
    - Zakaz go?ych imperatywow bez obiektu ("Podpowiedz", "Sprawdz") - user zglosil jako "dziwne".
    - Wzorzec: "Wykryj automatycznie" (z ikona lupy) / "Sprawdz foldery" (z ikona ptaszka) - `dam-btn-icon`.
    - Komunikaty: stan ladowania ("Szukam folderu Marketing...", "Sprawdzam foldery...") + wynik w jezyku
      czlowieka ("Wszystko w porzadku - ta sciezka zawiera wymagane foldery.", "Znaleziono: X - kliknij...").
    - Zero krzywych cudzyslowow ? " w kodzie (mangled na `?`/`` w tym projekcie) - tylko ASCII `"`.
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
    - Nosniki NIE w wierszu Typ (Typ = forma: kulki, sypkie, nuggets?).

64. **Naming dictionary + rozpoznawanie nosnikow/jezykow (2026-07-18):**
    - Jedno zrodlo: `apps/web/data/naming-dictionary.json` (+ sciagawka `docs/NAMING.md`).
      Python (`build-file-index.py`) i JS (`dam-labels.js`) czytaja ten sam slownik.
    - `parse_carrier`: SLEEVE/FOIL/CARTON ? REKAW/FOLIA/KAR; kody CZ/SK odcinane z prefiksu nosnika.
    - `parse_folder_langs`: skanuje WSZYSTKIE segmenty ` - ` (nie tylko ostatni).
    - Jezyk wiz: folder-langs ? jawny kod z pliku ? default marki (DK=pl, GC=gb) tylko gdy brak sygnalu.
    - MIX ? etykieta `MIX - <nosnik>` (nigdy gole WARIANT). UI nosnikow zawsze PL.
    - Foldery zaczynajace sie od daty ? carrier OTHER, potem inferencja z nazw plikow; DATE/WARIANT-*
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
      nigdy nie wpisane z akcentem). Naprawione w OBU plikach. `REKAW`->`R?KAW`, `ETY-SLO`->"ETYKIETA S?OIK".
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
      folderu, wykrywa istniejacy znany kod i GO ZAST?PUJE, nie doklejuje drugiego przed pierwszym).
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
      `damAddVariantModal` (byl bez X, tylko "Anuluj"). Thumb-picker juz mial X (`?` + click-outside).
    - `dam-shell.js goBackNav()`: jesli otwarty modal/popover/lightbox (`#damVizModal`, `#damVizRequestModal`,
      `#damTagEditPopover`, `#damThumbPicker`, `#damAddVariantModal`) -> **Wstecz go zamyka**, NIE nawiguje
      do innej strony (`closeTopmostOverlayIfAny()`). Nawigacja miedzy stronami (pelny stack) - bez zmian,
      poza tym wyjatkiem (user: "cofa ostatnia akcje, nie cala karte - WYJATEK: podglad zamyka Wstecz").

76. **Naprawa migracji MATERIALY->PROJEKT/DRUK (Faza 3) - NIE AUTOMATYCZNA:**
    - Skrypt `apps/web/scripts/repair-materialy-to-projekt.py` (DK+GC, generyczny po slowach-kluczach
      MATERIA/PROJEKT-PROJECT/DRUK-PRINT w nazwie slotu, nie po numerze - warianty nazw sa niekonsekwentne:
      "2 - PROJEKT"/"2 - Projekt"/"2 ? PROJEKT"/"2- PROJEKT"/"PROJEKT" bez numeru).
    - Zasada: PROJEKT ma pliki -> NIE RUSZAMY. PROJEKT pusty -> szukaj .ai/.psd/.indd/.pdf w MATERIALY
      (w tym JEDEN poziom podfolderow, np. "...Folder do druku" - user zglosil ze migracja czasem tam
      zagniezdzila pliki) -> raport `data/materialy-to-projekt-dryrun.json`. DRUK tylko FLAGOWANY
      (nigdy automatycznie przenoszony - inna semantyka checklisty). Brak zrodla -> zostaw, checklist
      i tak pokaze brak (to jest prawda o danych, nie zgadujemy).
    - **Domyslnie tylko dry-run.** `--apply` wymaga wyraznej zgody usera PO przegladzie raportu - ZERO
      usuwania, `shutil.move` tylko gdy dest nie istnieje, audit log kazdego przeniesienia.
    - Test run 2026-07-18: 16 kandydatow (6 DK, 10 GC) - w tym potwierdzony przypadek usera
      (ORZESZKI MIOD/6300524, plik w `1 - MATERIA?Y/DK_..._Folder`).
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
 - Cache: `?v=20260718card7`. Nadpisane przez card7b (?85).

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
 - **User / power_user:** tylko zg?oszenia tekstowe (JSON). Zapis do `tag-proposals.json` + wpis w `inbox-items.json`. Brak zapisu kanonicznego / dysku.
 - **Admin:** jedyny kto `decide` / apply (rename, carrier-types, viz-flag, overrides, change-log undo/redo, index rebuild, db/*). Sesja z `Authorization: Bearer` - body.role / admin_mode NIE daja privilege (anti-spoof).
 - Po TTL 72h: **eskalacja do Inbox**, NIE auto-zapis na dysk.
 - Viz-request: kazdy zalogowany -> inbox. Drive/Git sync pliku SQLite = zakazany (ADR-009).
 - Bridge: `_require_login` / `_require_admin` w `local_bridge.py`.

86b. **Privilege hardening (2026-07-21 audit):**
 - Takze **admin-only** na bridzie: `POST /index/rebuild`, `POST /branding/rebuild`, `POST /notification-groups`, `GET /change-log`, `GET /lifecycle-reconcile?mode=boot` (enforce moves). `mode=pull` zostaje dla zalogowanych.
 - UI: karta `#historiaZmian` ukryta dla non-admin; Branding `#damBrandingRebuild` ukryty; Explorer Odswiez bez rebuild dla non-admin.
 - Anti-spoof UI: `DamApi.role()` preferuje role z `/auth/me` (`_sessionRole`); non-admin kasuje `dam_admin_mode`. Body.role / localStorage nadal NIE daja privilege na mutate.
 - Branding metadata/assoc: API = admin|power_user (zgodnie z PI tagow); user = 403.

87. **Inbox + OAuth + legal (2026-07-18):**
 - Wiadomosci: filtr **Zgloszenia DAM**; klik wiersza = expand detalu (Asana: parent/due/section). Pusty `#damHeaderAction` MUSI byc wypelniany quickaction (konto zawsze widoczne).
 - OAuth Asana + Microsoft (Teams/Outlook Graph): `oauth_integrations.py`, tokeny Fernet w `data/oauth-tokens.json`, klucz `.dam-secret.key`. Connect w Ustawieniach po Client ID w `dam-connection.env`.
 - Dokumenty: `privacy.html`, `terms.html`, `license.html`, `consents.html`, `docs-security.html` (dla weryfikacji Google/Microsoft).
 - Hasla: bcrypt; OAuth: Fernet; nigdy plaintext tokenow w Git.

88. **Moderacja TYLKO w Wiadomosciach (2026-07-18, Faza 6):**
 - Zakaz panelu moderacji w `settings.html` / dashboard. Admin decyduje w `inbox.html` (expand zg?oszenia: Zatwierdz / inny typ / Odrzuc).
 - Filtr **Historia moderacji** = decyzje (approved/rejected/?). Deep-link: `inbox.html?tag=zgloszenie&proposal_id=?` lub `?focus=`.
 - Admin default filtr = `zgloszenie`. Badge wiadomosci += pending z `/tag-proposals`.
 - Wstecz na inboxie: zamknij expand ? cofnij filtr ? dopiero nawigacja. Lightbox/modale: Wstecz zamyka overlay (`#damLightbox` itd.).
 - Copy: 72h = eskalacja/przypomnienie, **bez** auto-apply na dysk (nadpisuje starszy plan P7).
 - Grupa `grafik`: `apps/web/data/notification-groups.json` (edytowalna); stub listy w Ustawieniach.
 - Cache: `?v=20260718inbox3`.

85. **Karty card7b (2026-07-18):**
 - Indeks z powrotem w **prawym gornym rogu** karty (`.dam-project-card__index-corner`); pozostale tagi bezposrednio pod tytulem.
 - Tytul = `KATEGORIA ? NAZWA` (link ? `explorer.html?product=?`). Przycisk **Przejdz** nadal ? `project.html` (checklist).
 - Nazewnictwo: **Eksplorator** = hub DAM (`explorer.html`); **Eksplorator plikow** = Windows (ikona folderu). Sidebar/i18n PL: `nav.explorer` = "Eksplorator".
 - Status badge +7% (`calc(...*1.07)`). Soft wash `::before`: incomplete czerwony / ok zielony, ~5.75rem, alpha ~0.055 (tylko strefa status?tagi).
 - Cache: `?v=20260718card7b` / `card7b2` (CSS).

86. **PL znaki + status bazy + Wiadomosci (2026-07-18):**
 - Polskie znaki w `pl.json` + hardcoded UI (skrypt `apps/web/scripts/restore-pl-diacritics.py`). Unikac slepego replace `zadan`?`zada?` (psulo `zadania`).
 - Przyciski projektow: **Od?wie? list?** = reload z indeksu; **Skanuj dysk** = ingest Marketing (bylo "Wczytaj z dysku").
 - Pill **Baza online** obok Pliki online (`dam-db-status.js`): panel zrodel Synology / GitHub dump / lokalna SQLite; tryb auto|postgres|sqlite; `POST /db/prefer`, `POST /db/reconnect` (force, bez czekania 120s); Od?wie? moze `pull_dump` przez sync script `--no-commit`.
 - Prefer zapis: `apps/desktop/data/db-prefer.json`. GitHub NIE jest silnikiem live - tylko dump/backup.
 - Strona **Wiadomo?ci** = `inbox.html` + `dam-inbox.js` w sidebarze; filtry zrodel, szukaj, mark-read.
 - Po zmianie API bazy: **restart local_bridge** (stary proces nie ma POST /db/*).
 - Cache: `?v=20260718db1` / `db1b`.

87. **Eksplorer vs Windows + checklista klik (2026-07-18, icons2):**
 - **Eksplorer** = hub DAM (`explorer.html`). Sidebar: label `Eksplorer`, ikona `uil-sitemap` (nie folder-open).
 - **Eksplorator plikow / Folder Windows** = OS Explorer. Ikona: custom SVG `DamIcons.winExplorerSvg` (folder + wewnetrzny drawer/dysk).
 - Karty: **Sprawdz projekt** (strzalka ? `project.html`) + **Przejdz** (`uil-folder-open` ? `explorer.html?product=`) + Win + Asana mark SVG.
 - OK-wiersze checklisty (karta + detail): klik ? Przejdz + Folder Windows. Shared: `dam-icons.js` `bindChecklistRows`.
 - Wash incomplete/ok: wysokosc 8.625rem (+50%), alpha *1.3 (+30%).
 - Ramka 1px fade (50% koloru do 50% wysokosci ? 0 przy 95%): `--ok` zielony + `--incomplete` czerwony (ten sam mechanizm). Nie 100% alpha.
 - Cache: `?v=20260718border50` (dam-app).

89. **Explorer brand switch + badge unify (2026-07-18, brandsw1):**
 - Usunieto biedny `#damBrandFilterTrigger` z toolbara. Filtr marki = chipy DK/GC (bylo: `#damSidebarBrandMount` + `#damProductBrandMount`). **Nadpisane przez ?94** - tylko sidebar Kategorie.
 - Tagi explorera: `dam-viz-badge` pill jak karty projektow (index/brand/carrier/lang). Tytuly: `KATEGORIA ? NAZWA` (+3px: title 19px, carrier 17px, folder 15px).
 - Cache explorer: `?v=20260718brandsw1`.

90. **Tagi cienkie + indeks pill global (2026-07-18, tagthin1):**
 - `.dam-viz-badge` i `.dam-index-chip` = pill `border-radius: 999px`, `font-weight: 500` jak `.dam-tag-pill` (nigdy kwadrat 4px / mono / 600).
 - Fix: `button.dam-viz-badge` NIE uzywa `font: inherit` (kradlo weight 600 z rodzica).
 - Indeksy w liscie produktow: klasy `dam-index-chip dam-viz-badge dam-viz-badge--index`.
 - Cache: `?v=20260718tagthin1` (brand + app + explorer.js).

91. **Warianty count + chipy jeden styl (2026-07-18, varcnt1 ? varright1):**
 - Lista produktow: zamiast `N rew.` ? blok `[N]` + tag `Warianty` **po prawej** wiersza (`grid: 1fr auto`). Nie po lewej.
 - Bez duplikatu tagu Warianty w srodku rzedu (`multiIndex: false` gdy jest `__variants`).
 - Global: `.dam-date-chip`, `.dam-status-badge`, carrier chips, index = ten sam pill token (10.5px / 500 / 999px). Label nosnika = 16px jak tytul wiersza.
 - Cache: `?v=20260718varright1`.

92. **Lista produktow air + cienka typo (2026-07-18, listair1):**
 - Tytuly/foldery: panel 15/500, wiersz 13.5/500, folder 13/500 (nie 19/600).
 - Wiecej oddechu: gap 10px miedzy wierszami i tytul?tagi?indeksy; padding wiersza 14/16; tlo `#f8f7fb` (jasniej niz `#f3f2f7`).
 - Chipy (tag + indeks): stale `height: 22px`, `border: 1px solid rgba(70,66,85,.14)`.
 - Cache: `?v=20260718listair1`.

93. **Panel head: Wstecz/Do przodu + ikona kategorii (2026-07-18, panelnav2):**
 - `.dam-panel-head`: strzalki historii (`navStack`) + step-up (produkt?kat?root), ikona folder/box, kicker + tytul + meta; ramka `#f8f7fb`.
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
 - Rozmiar +50% vs pill 22px/10.5px ? `height: 33px`, `font-size: 15.75px`.
 - Cache explorer: `?v=20260718brandchip3`.

95. **Produkt: Poka? wszystko + status tag (2026-07-18, showall1):**
 - Usunieto `.dam-product-meta` (Marka + nieklikalne Indeksy) - nie pokazuj tego, czego nie da sie kliknac.
 - Toolbar produktu: switch **Poka? wszystko** (jak viz). OFF = tylko aktualne nosniki; ON = nieaktualne/starsze (lista pod karta).
 - Persist: `localStorage.dam_explorer_show_all`.
 - Tag statusu `Aktualne`/`Nieaktualne`: `dam-badge-tag` + `data-tag-kind=status`. Admin + Shift/dbl ? toggle; zapis `carrier-overrides` (bridge/PG) + local `product-status`.
 - Hook: `window.damSetRevisionStatus`. DamBadges.bindClicks na `#damExplorerMain`.
 - Cache: `?v=20260718showall1`.

96. **Pomoc FAB + od?wie?ona pomoc (2026-07-18, help3):**
 - FAB `#damHelpFab` (fioletowy `?`, 44px, prawy dolny) = to samo co **F1** (`DamShortcuts.openHelp`).
 - Modal `#damHelpModal`: skr?ty og?lne + **Skr?ty admina** tylko gdy `role===admin` (Shift+tag typ/status, dbl-klik, DK/GC); start krok?w; tagi; modu?y; offline.
 - `help.html`: grupy temat?w + wyszukiwarka `#damHelpSearch` (keywords + empty state). PL odmiana: 1 temat / 2-4 tematy / 5+ temat?w.
 - `kbd` na stronie pomocy: jawny `color:#17161E` (Bootstrap kbd = bia?y tekst - niewidoczny).
 - Cache: `?v=20260718help3` (`dam-brand.css`, `dam-shell.js` ? `dam-shortcuts.js`).

97. **Inbox kontekst + toolbar projekt?w + ramki 35% + widget viz (2026-07-18, ui35f):**
 - Inbox propozycja typu: tytul `Nazwa ? BAG ? DOY`; zawsze widoczny blok produktu (kola Eksplorer / Folder Windows / Wizualizacje + `DamBadges`); enrich z `file-index` po `product_id`.
 - Shared `.dam-nav-circles` + `.dam-viz-icon-btn` (36px).
 - Projekty toolbar: search wypelnia rzad; status `#damProjectsStatus` pod toolbar (`dam-projects-status-line`); bez martwej dziury.
 - Ramki kart `--ok` / `--incomplete`: alpha obrysu **0.35** (bylo 0.5), wash ~0.05.
 - Dashboard ?4 najnowsze wizualizacje? (2026-07-18): ranking = **projekt Asana (start)** + **mtime pliku bez bulk-sync** (?4 produktow w tej samej minucie = ignoruj) + dedupe 1 produkt/projekt; tagi: marka + nosnik + **indeks**; akcje = male zaokraglone kwadraty 26px (`.dam-nav-circles--tiles`); `+N` badge rozija pozostale tagi.
 - Cache: `?v=20260718ui35f` (app/brand/dashboard CSS + inbox/projects/dashboard HTML).

98. **Zg?oszenia: taby Typy / Wizualizacje / Historia + undo (2026-07-18, inboxTabs6):**
 - Sidebar: **bez** osobnej ?Historia moderacji?; historia = tab wewn?trz **Zg?oszenia DAM**.
 - Taby ikonowe `#inboxZgloszenieTabs`: `typy` | `wizualizacja` | `historia` (`zgloszenieSub` w `dam-inbox.js`).
 - Deep-link: `inbox.html?tag=zgloszenie&sub=historia` (legacy `?tag=historia` ? zgloszenie+historia).
 - Historia: pasek Cofnij ostatni? / Pon?w (`/change-log/undo|redo`); przy wpisie **Cofnij zmian?** (`POST /tag-proposals/undo`) lub **Wr?? do kolejki** (`POST /tag-proposals/reopen`).
 - Bridge: `proposal_id` w change-log; undo tylko gdy to ostatni wpis na dysku.
 - Karta propozycji: indeks (gdy jest), zmiana BAG?DOY, DamBadges, **Przejd?** + Folder Windows (jak project-card) + kola nawigacji.
 - Cache: `?v=20260718inboxTabs6`.

99. **Inbox ?r?d?a ikony + badge/PL + actor (2026-07-18, inboxIcons1):**
 - Sidebar ?r?d?a: szeroko?? **270px** (+50); ikony Unicons przy ka?dym filtrze; liczniki `.dam-inbox-count` jak pill/tag.
 - Header: `#damMsgBadge` / `#damNotifBadge` / `.dam-lang-code` ? tint + wi?kszy padding (bez ?martwej? bieli).
 - Karty: status i foot-tagi ~+10%; prawy d?? **Odrzuci? / Zatwierdzi? / Zmoderowa? / Zg?osi?: nick** (`actorFootHtml`, nick z local-part maila).
 - Cache: `?v=20260718inboxIcons1`.

100. **Tag picker pe?ne listy + historia undo (2026-07-18, histUndo2):**
 - Podkategorie: z `_DAM_FILE_INDEX.products` (nie `tag_groups.podkategoria` - klucz nie istnieje). Label **PL / EN** (`Ro?linne / plant based`). Popover `--wide` 360-480px.
 - Indeksy: wszystkie bazy z products (~335) + szukaj; nie tylko bie??cy.
 - Historia: **Cofnij zmian? na dysku** ? Wr?? do kolejki; po undo status `undone` + **30 s Anuluj cofni?cie** (`/tag-proposals/cancel-undo`); konflikt = timeline + audit (`GET /tag-proposals/timeline`); brak ?cie?ki na dysku = hint usuni?cia.
 - Cache: `?v=20260718histUndo2` (inbox), `histUndo1` (viz/explorer tag-edit + brand.css).

101. **Sesja rehydrate + Dostosuj pulpit (2026-07-18, authRehydrate1 / dashCustom2):**
 - Root cause `login_required` przy ?zalogowanym? UI: localStorage (`dam_user` / `dam_role`) bez wa?nego Bearer; bridge odrzuca token (`qa` / wygas?y). `DamApi.me()` nie mo?e udawa? sesji samym profilem.
 - Fix: `POST /auth/rehydrate` (bound-session + machine_id ? nowy token); `DamApi.rehydrate()` + auto w `me()` przy `invalid_session`/`no_token`; `enforceAuth` odrzuca `qa` / demo token.
 - Dostosuj pulpit: checkbox Geex `#AB54DB` 28px (2?), panel w lewo + hover preview 350ms (kolejka animacji, hover = wy?szy z-index), DnD + strza?ki, dirty guard: Zapisz zmiany / Nie zapisuj / Wr?? do wyboru.
 - Inbox subtitle: ludzki copy (bez ?robotycznego? r?wno?ci).
 - Cache: `?v=20260718authRehydrate1` (api/shell), `dashCustom2` (dashboard widgets/css).

101c. **Tagi casing globalny (2026-07-18, tagCase2):**
 - Tagi globalne: `DamLabels.formatTagLabel(label, kind)`.
 - Kody (brand/lang/carrier/index): WERSALIKI jak w slowniku (DOYPACK, GC, GB).
 - Ludzkie (category/subcategory/smak/typ): jak w zdaniu - `Kulki`, `Kulki Surowe`, `Mini Batoniki`.
 - Opakowanie w filtrze: mapuj do `label_pl` (doypack -> DOYPACK).
 - Instrukcja: `ui.tag_casing_global` w program-instructions. Cache `?v=20260718tagCase2`.

101d. **PL pod angielska nazwa GC (2026-07-18, namePl2):**
 - Karty Wizualizacji (GC): po tytule EN zawsze `<br>` + `( Polska )` ze spacjami w nawiasie, np. `MINCED` ? `( Mielone )`.
 - Rozmiar jak `.dam-viz-card__meta` (11px). Nawiasy: bardzo stonowane `#c5c6cd` + opacity 0.72 (slabsze niz meta). Tekst PL: `#696877`.
 - Slownik: `data/product-name-pl.json` + KV `product-name-pl`; API przez seed bridge.
 - `DamLabels.productNamePlMarkup` + `.dam-viz-card__title-pl-paren` / `__title-pl-text`. Instrukcja: `ui.product_name_pl_under_en`.
 - Cache: `?v=20260718namePl3`.

101b. **Instrukcje programu w BAZIE (2026-07-18, instr1) - KRYTYCZNE:**
 - Wszystkie newralgiczne ustalenia (nazewnictwo, F/X/D, aktywny/nieaktywny, zakazy) ? `program-instructions.json` + Postgres `dam_kv_store.program-instructions`.
 - API: `GET /program-instructions`. UI: Ustawienia ? ?Instrukcje programu (baza)?.
 - `memory.md` = notatka; przy konflikcie wygrywa program-instructions.
 - Po decyzji usera: najpierw dopisz instrukcje + seed KV, potem kod. Regula: `.cursor/rules/program-instructions.mdc`.

102. **Nosnik: UI = pelna nazwa, dysk = skrot (2026-07-18, namingPolicy1):**
 - **Zrodlo prawdy (nie tylko memory):** `naming-dictionary.json` ? Postgres `dam_kv_store.naming-dictionary` + lustro `app-settings.json` / `dam_kv_store.app-settings`. Karta Ustawienia ? ?Nazewnictwo no?nik?w?. Instrukcja: `naming.carrier_ui_vs_disk` w program-instructions.
 - `policy.carrier_display_in_ui = label_pl` (DOYPACK/FOLIA/BATON w UI).
 - `policy.carrier_prefix_on_disk = short` (DOY/FOL/BAT na dysku przy rename).
 - Kazdy nosnik ma `label_pl` + `short`. Bridge laduje `CARRIER_FOLDER_PREFIX` ze slownika (`load_carrier_folder_prefix`); seed przy starcie bridge.
 - Skroty tylko po to, zeby nazwy w Eksploratorze zajmowaly mniej miejsca - NIE etykieta UI.
 - Stare foldery `DOYPACK - ...` ? `KNOWN_CARRIER_PREFIXES` + skrypt `fix_doypack_folder_prefixes.py --apply`.
 - Operacje: `change-log.json` (+ assignment-log). Cache: `?v=20260718namingPolicy1`.

98. **Tryb admina = switch w headerze (2026-07-18, adminHdr1):**
 - Jedyny prze??cznik: switch **Admin** w geex-content__header__quickaction, **tu? po lewej od avatara** (po PL).
 - Zakaz lokalnych toggle na explorer/viz (#damAdminToggle, #vizAdminToggle, label.dam-admin-toggle).
 - Persist: localStorage.dam_admin_mode; event dam:admin-mode. Widoczny tylko dla 
ole=admin.
 - Pill Baza / Pliki: rozmiar zewnetrzny bez zmian (min-height 56). Tylko .dam-db-status__refresh = 24px (-50% vs 48).
 - Cache: ?v=20260718adminHdr4.


103. **Lifecycle status F/X/D (2026-07-18, lifeBez1) - TEST GATE:**
 - Admin oznacza produkt lub wariant: **F** (aktualne), **X** (nieaktualne/archiwum), **D** (demo), **Bez statusu** (dawniej Odznacz = clear literki).
 - Dysk = prawda: literka w nazwie folderu. Brak literki = oba scope (produkt + wariant) = Bez statusu. Zakaz fake F z `is_latest`.
 - Dysk: dopina `- F` / `- X` / `- D`. Historia: `apps/web/data/lifecycle-status.json` + change-log (`previous_name` + `previous_path`).
 - **Produkt X:** cascade `- X` na warianty + przeniesienie produktu do `? ARCHIWUM`.
 - **Wariant X:** tylko wariant do archiwum (wrapper produktu w ARCHIWUM); produkt LIVE zostaje BEZ `- X` (bez dublowania).
 - Restore wariantu (F / Bez statusu): wkladaj do istniejacego live produktu z jego AKTUALNA literka (`find_live_product_dir`), nie tworz drugiego folderu produktu.
 - Produkt D: cascade `- D` na warianty; clear wariantu przy produkcie D -> clear literki produktu gdy brak D w dzieciach.
 - **Toggle / kolejka:** ponowne klikniecie aktywnego F/X/D = clear; UI queue + Python lock na apply (szybkie kliki).
 - **Odswiez liste:** TYLKO dysk -> program (`GET /lifecycle-reconcile?mode=pull` + sync UI). NIGDY nie rename folderow. Przy rozjazdzie: toast + historia; panel pokazuje literke z dysku. Przywracanie poprzedniego statusu = **Stosuj zmiany** (FORCE).
 - **Stosuj zmiany** (`#damLifecycleForce`, admin): PROGRAM -> dysk FORCE (`POST /lifecycle-force`). Odwrotnosc Odswiez.
 - **Start / boot:** `GET /lifecycle-reconcile?mode=boot` - mtime: jesli `disk_mtime > applied_at` dysk wygrywa (store=dysk; X poza ARCHIWUM -> przenies); jesli `applied_at >= disk_mtime` i rozjazd -> program wygrywa (`needs_force`). Kazdy apply programu zapisuje `applied_at` + `source=program`.
 - **Path resolve (hard):** przed `path_not_found` silnik szuka sciezki w store (revision_index / previous_path / history ops) + literki F/X/D + skan ARCHIWUM. UI przed POST bierze path z lifecycle-store i po sukcesie patchuje `rev.path` natychmiast (nie czeka na rebuild).
 - Bridge: POST/GET `/lifecycle-status`, GET `/lifecycle-reconcile`, POST `/lifecycle-force` (admin). Modul: `apps/desktop/lifecycle_status.py`. Po restarcie bridge wymagane ponowne logowanie (sesja in-memory).
 - Produkt testowy: TEST LIFECYCLE / indeks TEST-TEST. Nie ruszac realnych produktow az user potwierdzi.
 - Cache UI: `dam-explorer.js?v=20260718lifeSync2`, `dam-brand.css?v=20260718lifeSync1`.
 - Po boot `program_wins`: UI nie nadpisuje tych wpisow syncem z indeksu (az Odswiez / FORCE).
 - Search scope global: radio `all|products|variants` (odklik Produkty/Warianty ? Wszystko). Biala tablica `.dam-search-wrap--panel` (input+chipy+wyniki). Wizualizacje: locked Wszystko, Produkty/Warianty disabled (bez nadpisu localStorage). Projekty: te same chipy + filtr haystack. Cache `?v=20260718scopeRadio2`.

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

108. **Osoba przy produkcie = wyszukiwanie, nie badge TAG (2026-07-18, people1 -> peopleFix1):**
 - Cel: wpisac w szukajke Sylwia / Krzysztof / Szymon i trafic w produkty, ktorymi sie zajmowali.
 - **Nie** robic widocznych tagow typu TAG Krzysztof na kartach (chyba ze user poprosi). Pill autor w tag bar OK.
 - Zrodlo: `apps/web/data/product-people.json` + KV `product-people` + Asana CSV w `enrich-search-tags.py`.
 - **HARD:** po kazdym `build-file-index.py` MUSI leciec enrich (hook na koncu builda od peopleFix1). Sam rebuild wycina authors/by_tag imion.
 - Recznie: `python apps/web/scripts/enrich-search-tags.py`. Instrukcja: `search.product_people`.
 - QA: `sylwia` ~23 (Mielone, Energia, Odpornosc, Prebiotyk, Kalendarz); `krzysztof` ~51; `szymon` ~2.
 - Kontekst ustalenia: chat a78fa004-2674-4f22-a383-c0f448f9635e (2026-07-18 ~21:36).
 - **Heurystyka (do integracji Asana):** 1) Asana Assignee = prawda. 2) Nowy produkt bez zadania KW w Asanie -> domyslnie Sylwia. 3) Szymon tylko jako slabe zgadywanie / koordynacja. Integracja Asana = pozniej.

109. **Carrier toggle row + inbox hist (2026-07-18, carrierInbox11):**
 - Pasek nosnika: grid `minmax(0,1fr) auto`; chevron ZAWSZE w `.dam-carrier-toggle-row__end` (po path actions).
 - Caly pasek toggle (Enter/Space); ignore: button/a/input/tag-edit/lifecycle/path-actions.
 - Typografia nosnika: `.dam-carrier-toggle__label` = **16px / 600 / #464255** (kolor jak `.dam-viz-card__title`; rozmiar NIE scinac do 14px). Folder name moze zostac `dam-fs-base`.
 - Inbox: hist-item jak mod strip; product nav = `dam-nav-circles--row` (nie stack).

110. **Tagi globalne - filtr + edycja (2026-07-18, tagAjax3):**
 - Tagi (`.dam-badge-tag` / `.dam-tag-editable`) dzialaja tak samo na Projekty / Wizualizacje / Eksplorer.
 - **Klik** = natychmiastowy filtr (token = widoczna etykieta, nie surowy `01 - BATONY`).
 - **Ctrl/Meta+klik** = dolacz token po spacji (AND w `filteredRows`).
 - **Shift/Alt/dblclick** = `DamTagEdit.openTagPicker` (admin/power_user). Projekty: `index.html` MUSI ladowac `dam-tag-edit.js`.
 - Po filtrze na `#damProjectsGrid`: GSAP reveal 0.2s (`autoAlpha` + `clipPath` inset gora->dol); `prefers-reduced-motion` = skip.
 - Vendor: `apps/web/assets/vendor/js/gsap/gsap.min.js`. Cache: `?v=20260718tagAjax3`.

111. **Globalny pasek wyszukiwania + toolbar Viz (2026-07-18, searchUnify3):**
 - Kanon search: `.dam-search-wrap { max-width: none }` + input 44px, biale tlo, fioletowa obwodka/ikona, clear X (`dam-shell.js`).
 - **Projekty / Wizualizacje / Eksplorer:** toolbar = sam search (pelna szerokosc contentu). Przyciski akcji NIE w tym samym rzedzie co search.
 - **Wizualizacje uklad:** search ? tagi ? `.dam-viz-secondary-filters` (Poka? wszystkie + `#vizBrandMount` chipy DK/GC + jezyk) ? `.dam-viz-grid-toolbar` (status | Cofnij/Ponow + **Skala prawo**).
 - **Projekty:** `.dam-projects-grid-toolbar` (status + Od?wie?/Skanuj) na bialym tle nad siatka.
 - **Eksplorer:** Od?wie?/Eksportuj w `.dam-explorer-results__toolbar` (biale tlo wynikow).
 - Cache: `dam-brand.css?v=20260718searchUnify3`, `dam-app.css?v=20260718searchUnify3`.

112. **Status F/X/D - prawda zapisu (2026-07-18, statusTruth1):**
 - Stary banner "localStorage + eksport na P:DAM" = **falsz** (legacy copy).
 - Zapis: most `POST /lifecycle-status` ? rename na Marketing + `apps/web/data/lifecycle-status.json` + mirror `product-status.json` + Postgres KV gdy Baza online.
 - `localStorage dam_product_status` = kopia w tej przegladarce. Przycisk = "Pobierz kopie statusu" (opcjonalny backup).
 - "Baza online" = Postgres Synology (KV); "Pliki online" = Marketing/indeks - osobne sygnaly.

113. **Eksplorer panel Wstecz + live search (2026-07-18, panelNavSearch2):**
 - `dam-panel-nav -1` = **krok w gore hierarchii** (produkt ? wyniki search / kategoria ? clear search ? welcome). Nie slepa `navGo` (pulapka: Wstecz wraca do produktu).
 - Breadcrumb cofanie: bez `navPush`; trim `productId` ze stosu.
 - Szukajka (`#damFileSearch`): od 2 znakow `DamSearch.search` ? `state.searchHits` ? panel `Wyszukiwanie` w `#damExplorerMain` (AJAX), nie zostawia listy kategorii.
 - Cache: `dam-explorer.js?v=20260718panelNavSearch2`.

114. **Lifecycle TEST repair (2026-07-18, testRepair3):**
 - Po restore wariantu: usuwaj pusty wrapper w `? ARCHIWUM` (`_cleanup_empty_archive_wrappers`).
 - `_safe_rename` / `_safe_move_tree`: pusty dest w ARCHIWUM = rmdir i kontynuuj (inaczej restore produktu blokowany).
 - Cascade produktu: `_sync_revisions_after_product` (path + letter/status w `store.revisions`).
 - UI: `getProductStatus` najpierw lifecycle; `clear` != Starsza; fallback `data/lifecycle-status.json` gdy most `/lifecycle-status` 404 (smoke UI-only).
 - Produkt testowy live: `?/BATONY/TEST LIFECYCLE ? [ nerkowcowy ]` + wariant `BAT - ? - TEST-TEST` (bez literki).

115. **Akcent UI = chrome, nie tagi (2026-07-18, accent3):**
 - `localStorage.dam_accent` (#RRGGBB) ustawia `--dam-primary` / `--primary-color` / `--primary-color-transparent`.
 - Dotyczy: FAB, sidebar active/hover, breadcrumb, ADMIN, primary buttons, search scope, settings chips.
 - **HARD:** tagi produktowe NIGDY nie dziedzicza akcentu.
 - Zakaz hardcoded `rgba(171,84,219,?)` / `#AB54DB` w chrome (tylko `var(--dam-primary)` / color-mix).
 - CSS: `dam-accent.css`; inject `dam-shell.ensureAccentCss`. Soft-boot w shell gdy brak `dam-accent.js`.

116. **Motyw light/dark = nakladka tokenow (2026-07-18, theme1):**
 - `dam-theme.js`: pref `light|dark|system` ? `html[data-theme]`; persist `localStorage.theme` + `dam_theme_pref`.
 - `dam-tokens.css` mapuje Geex `--white-color` / `--section-*` / `--body-color` na `--dam-surface` / `--dam-text`.
 - Soft-boot motywu w `dam-shell.js`. UI wyboru w Ustawienia ? Wygl?d.

117. **Settings UX (2026-07-18, set5b):**
 - Filtr sekcji (chipy + X), nie scroll-to-anchor; pokazuje tylko wybrane karty (flex).
 - Unified `.dam-sw-btn` (44px); padding kart `24px 26px` (bazowe widget +8).
 - Copy PL dla pierwszego uzycia; brak marki ?Geex? w UI (`Przywr?? domy?lny`).
 - Legal links wyciszone w `.dam-settings-legal-row`.

118. **Desktop branding + licencja wlasciciela (2026-07-18):**
 - Tytul okna / APP_TITLE: `DAM - Dobra Kaloria - Inyfinn` (`runtime_config.py`).
 - Ikona: `webview.start(icon=dam_app.ico)` + WM_SETICON; skrypt `apps/desktop/scripts/build-dam-ico.py`.
 - Start window: ~92% szerokosci ekranu, min 1400x800 (bez scrolla poziomego jako cel).
 - Licencja wlascicielska: `LICENSE.md` + `apps/web/license.html` - Krzysztof Wieczorek; PESEL tylko maskowany `93*****179`; bez dowodu osobistego.
 - Kwoty bazowe licencji: 6900 PLN jednorazowo / 490 PLN mies. (do 5) / 890 PLN mies. (do 15); zawsze indywidualnie z KW.

119. **Bridge security (2026-07-18):**
 - `/media` tylko pod Marketing + login + limit 40MB; bez shell=True w reveal.
 - Status lokalny BEZ Bearera: `/files/status`, `/db/status`, `/machine-config`, `/detect-marketing-bases`, `/validate-base` (UI pills/setup).
 - Mutacje + media/browse dalej z sesja; `/auth/register` bootstrap|admin.
 - CORS Origin must match `DAM_UI_ORIGIN`; OAuth HTML escape.
 - Logout: POST `/auth/logout` + clear `dam_token` + redirect signin (nie ?sesja urzadzenia forever?).

120. **Metadata FK (2026-07-18):**
 - `apps/desktop/meta_store.py` ? SQLite tabele `meta_products|revisions|files|tags|persons` + join.
 - Sync z `file-index.json` po rebuild indeksu i POST `/meta/sync` (admin).
 - UI Geex nadal czyta JSON; FK = spojnosc / audit / gotowosc na odczyt SQL.

121. **Folder picker (2026-07-18):**
 - Desktop: `pywebview.api.pick_folder()` ? FOLDER_DIALOG.
 - Modal: `.dam-basepath-browse` (ikona folderu + Wskaz folder).

122. **Lifecycle previous_letter per nośnik (2026-07-19, j18) - HARD:**
 - `previous_letter` = stan przed archiwum (F / D / clear). Odklik X przywraca ten stan, **nigdy X**.
 - Lookup: sciezka + `_variant_identity` (np. DOY|TEST-TEST2 vs ETY|TEST-TEST2). NIGDY sam `revision_index` gdy wspolny indeks.
 - Bug „wszystko D”: legacy klucz TEST-TEST2 w store z previous_letter:D kontaminowal DOY i ETY przy restore.
 - Po F/X/D: UI `reconcileProductLifecycleFromDisk` (hub20260719j18). Bridge restart po `lifecycle_status.py`.
 - Test: `python apps/desktop/tests/test_lifecycle_previous_letter.py`.

## 2026-07-18 - Go-Live produkcja (klient)

25. **Nazwa procesu:** Production Readiness Review (PRR) + Go-Live. Dokument: `GO_LIVE.md`.
26. **Smoke:** `apps/desktop/scripts/smoke-production.ps1` przed oddaniem. `-StrictPasswords` = FAIL gdy haslo `test` dziala.
27. **Hasla:** zakaz seed `test`. Wymagaj `DAM_SEED_PASSWORD` (min 8). Rotacja: `set-all-passwords.py` / `set-user-password.py`. Gate C bez rotacji = nie oddawac.
28. **Rejestracja UI:** ukryta gdy `users > 0`; endpoint `GET /auth/registration-open`. Nowe konta = admin.
29. **Branding produktu (HARD):** `DAM - Dobra Kaloria - Inyfinn` (krotko `DAM`). Zakaz w UI/manifest/title/subtitle: `ETA`, `DAM ETA`, `ETA Innovations`. Eksplorer subtitle: `Pelna struktura produktow Dobra Kaloria i Good Calories`. (ETYKIETA = typ opakowania - OK.)
29b. **Wersja programu:** start `1.00`, kolejne `1.01`... Zawsze w sidebar footer obok `inyfinn.art (c) ...` jako `v1.00`. Zrodla (ten sam string): `apps/web/version.json`, `apps/web/assets/js/dam-version.js`, `apps/desktop/runtime_config.py` (`APP_VERSION`).
30. **Most:** po zmianach w `local_bridge.py` restart procesu bridge (launch nie hot-reloaduje).

120. **Media preview branding = te same CTA co wizualizacje (2026-07-19):**
 - `#damMediaPreview` footer: **Przejdź** (produkt w Eksplorerze) + **Folder** (Windows) + opcjonalnie **Źródło** + Kopiuj + Udostępnij.
 - Zakaz etykiety „Pokaż w Eksploratorze” jako primary w tym modalu (myli z Przejdź).
 - Ext-tag (TIF/JPG): anatomia `.dam-viz-badge` (pill 999px, fw 500) +10% skala; odstęp od tytułu **8px**; tagi→tytuł **≥20px**.
 - Shift+klik na `.dam-media-preview__assoc-item` / thumb / name = edycja skojarzeń (wymaga admin mode), nie nawigacja.
 - Gradient `.dam-gradient-tile--editable/--vector`: od dolu, kończy się koło nazwy, start ~30% bardziej przezroczysty.

123. **Bento v2.0.0 (2026-07-19) - HARD:**
 - Wersja bazowa: `2.0.0` codename `bento` (`version.json` + `dam-version.js` + `runtime_config.py`).
 - Patch po każdej dostawie: `2.0.1` modal, `2.0.2` cache branding/bridge, `2.0.3` integracje OAuth.
 - Wspólny CSS: `apps/web/assets/css/dam-bento.css` (gap 16px, radius token, page chrome + explorer).
 - **Zamrożone wizualnie:** `.dam-viz-card`, `.dam-branding-card`, `.dam-project-card`, modale `#damMediaPreview` / viz modal - nie restylować; zachowanie 1:1.
 - **Hot zone Eksplorer:** `.dam-explorer-layout` (nie Bootstrap row); `.dam-carrier-toggle-row` = CSS Grid stref (title/chips/life/end); `.dam-prod-row` = te same strefy.
 - Chrome hubów (toolbar/filtry/shell) może być bento; siatka kart assetów wewnątrz bez zmiany anatomii.
 - QA: ui-taste **runda** = focus jednej strefy do zielonego (wiele passów screenshot→Read); intensive = min. 10 rund na hot zone.

124. **Integracje hub v2 / 2.0.5 (2026-07-19) - HARD:**
 - Integracje: konfiguracja na integrations.html (nie tylko Settings); bez kart Stub/Opcjonalnie/W planie na glownej.
 - Bridge: /integrations/config, /integrations/asana/sync, /wykrojnik-mapping-queue GET, /finance/* (rates, fmcg, project-costs, invoices).
 - Wykrojnik: zapis tylko przez bridge (Zapisano w DAM), bez Pobierz JSON / localStorage draft.
 - Kalkulator: badge zrodla + Synchronizuj z Asany (admin); sekcja Lancuch FMCG z katalogu.
 - Faktury: GET bridge + Import CSV (admin); Zadania Asana z asana-tasks.json lub banner do Integracji.
 - Katalog FMCG: fmcg-cost-catalog.json + import map/template; finance.fmcg_no_double_count w program-instructions.
 - Wersja: 2.0.5 (version.json, dam-version.js, runtime_config.py).

125. **Modal branding CTA zrodlowe (2026-07-19) - HARD:**
 - #damMediaPreviewMeta (linia TIF · Indeks) = **usuniete** - nie przywracac.
 - Ext-tag w tytule: odsunicie **10px** od nazwy (margin-inline-start: 10px).
 - Obok **Przejdz** + **Folder**: osobne przyciski zrodlowe z etykieta rozszerzenia (**PSD** / **PSB** / **AI**), nie jeden „Zrodlo”.
 - Mount: #damMediaPreviewSourceMount w .dam-viz-modal__actions-main.
 - Wersja: **2.0.6** (po hub 2.0.5).

126. **Sciezka przenosna Marketing\ (2026-07-19) - HARD:**
 - Kopiuj sciezke = `DamPaths.toPortablePath` / `copyPortablePath` (bez litery dysku, od segmentu Marketing\).
 - Kazdy user ma inna mape dysku - nie kopiowac X:\ ani D:\.

127. **Wazna checklista uzytkownika (2026-07-20) - HARD:**
 - Plik: `WAZNA-CHECKLISTA-UZYTKOWNIKA.md` (root repo) + regula `.cursor/rules/wazna-checklista-uzytkownika.mdc`.
 - Sekcje: A operacyjne (Asana/MS/FMCG), B techniczne (wykrojniki, FMCG XLSX, video posters, Autor, QA dashboard, wersja memory), C pozniej (Entra/LDAP, ERP, BENTO kart).
 - Gdy prosba uzytkownika zahacza o punkt listy: **przypomnij ID + status** (nie wklejaj calej listy). Po done: odhacz w pliku + `process.md`.

128. **Animacje + tryb w tle + cache Branding = wersja 2.0.7 (2026-07-20) - HARD:**
 - **Ruch:** tokeny w `dam-tokens.css`: `--dam-anim` 0.4s (wejscie), `--dam-anim-hover` 0.22s (stany), `--dam-anim-slow`, `--dam-anim-ease`. Reveal (GSAP `dam-grid-reveal.js`) DURATION 0.35->**0.4**, sidebar 0.3->0.4.
 - Tagi/pille/badge + belki (toolbary, context bar, filtry tagow) dostaly `transition` (wczesniej ZERO). Blok w `dam-brand.css` (app-wide) + `dam-branding.css` (chipy brandingu). Fallback w `var(...,0.22s)`.
 - Belki animowane jako **bloki** przez `DamGridReveal.revealBars()` (jednorazowo, znacznik `data-dam-bar-revealed`, brak migotania przy filtrach). NIE animowac kazdego taga osobno w reveal.
 - **Tray:** `launch.py` - `window.events.closing` chowa okno do zasobnika (`window.hide()`, return False) gdy `tray_active`; most/sync/index zyja dalej. Calkowite wyjscie = tray "Zatrzymaj DAM calkowicie" (`os._exit`). Stack bez zmian: pywebview + pystray. **Wymaga restartu aplikacji desktop** by wejscie zadzialalo.
 - **Cache Branding:** cache-bust `?v=CB` bez `Date.now()` (WebView2 cache'uje ~35 MB); indeks wspoldzielony `window.__damBrandingIndex` (branding.js + media-preview.js); jeden `renderTagFilters()` na boot (activateTab go robi); wideo w siatce `preload="none"`.
 - Cache-bust bumpniety na branding.html + dashboard.html (`motion20260720a` / `perf20260720a`); reszta stron = addytywna (brak nowego CSS = brak animacji, nie blad) -> pelny sweep to checklista **B6**.
 - Weryfikacja: browser :8765 screenshot+Read; CDP: --dam-anim-hover=0.22s, revealBars, sharedIndex 7832, 115 kart, badge transition 0.22s.

129. **Ruch globalny v2 - reveal 0.45s + skeleton (2026-07-20, w ramach 2.0.7) - HARD:**
 - `dam-grid-reveal.js`: DURATION **0.45s** (bylo 0.4); IntersectionObserver `rootMargin: -50px` (element wchodzi ~50px w viewport zanim reveal - user: "za szybko, nie widze").
 - **Kolejnosc gora->dol naprawiona:** reveal() dzieli wezly na `inView` (animowane od razu JEDNA posortowana sekwencja) vs `below` (IO przy scrollu). Koniec "wyskakiwania poza kolejnoscia zanim pojawi sie pierwszy".
 - **Wejscie strony** `revealPageEntrance()`: tytul `.geex-content__header__title` + podtytul + belki, sort po Y. Sidebar **usuniety** z reveal (tylko morph collapse/expand); `#damHeaderAction` tez bez slide.
 - **Hover globalny** (`dam-brand.css`): `.geex-btn`/ikony sidebaru scale ~1.05 (ikona 1.12) w 0.2s, `:active` 0.97. Token `--dam-hover-scale`.
 - **Skeleton loading** (`DamGridReveal.skeleton` + CSS `.dam-skeleton*` shimmer `dam-skel-shimmer`): costs (#damCostMeta/Result/Fmcg), integrations (#damIntegrationsList karty), invoices (#invTableBody tr). Po fetch render podmienia + `revealRows`. reduced-motion => shimmer off, statyczny.
 - **Tresc async animowana** `revealRows` (fade + y8, stagger 40ms): faktury (tabela nie byla animowana - "natychmiast"), panele costs, karty integracji.
 - `dam-grid-reveal.js` dodany do costs/integrations/invoices (nie mialy go). Cache-bust `motion20260720a` bumpniety na 9 stronach: branding, dashboard, index, explorer, inbox, visualizations, costs, integrations, invoices. Reszta stron = checklista **B7** (sweep).
 - **QA-pulapka:** karta automatyzacji w tle => `document.hidden=true` => rAF (GSAP) zamrozony => tween stoi (np. tytuł opacity 0.033). To NIE bug: wymus `gsap.globalTimeline.progress(1)` zeby zobaczyc stan koncowy; na widocznej karcie gra jak `index.html` (ten sam silnik, zatwierdzony wzorzec). Zweryfikowano: costs meta+koszt(7588,10 PLN), invoices 10 wierszy, integrations 7 kart.

129. **WYKLADNIA KODU DAM = agents/shared/code-doctrine.md (2026-07-20) - HARD:**
 - Nadrzedny dokument "jak rozumiec kod DAM"; ZAWSZE czytany przed zmiana w apps/web/**. Wpiety na gorze AGENTS.md + lokalna regula .cursor/rules/code-doctrine.mdc (alwaysApply; .cursor jest gitignored - trwaly nosnik to AGENTS.md + agents/shared/).
 - Uczy: architektura runtime (web 8765 / most 8766, dane JSON, brak build-stepu), wzorzec window.DamX, i twarde lekcje: cache-busting (?v=), wspolbiezni agenci (wstrzykuj CSS z JS, nie ruszaj cudzych .css, sprawdzaj turn_ended), IntersectionObserver + clip-path deadlock (stan spoczynku = opacity:0, clip tylko w tweenie), search po pelnych indexes/search_blob (nie indexes[0]), z-index warstw (picker > nakladka), weryfikacja CDP vs stale-frame screenshot.
 - Sekcja 12 to dziennik lekcji - kazdy agent DOPISUJE nowe odkrycia. Kolejnosc zrodel prawdy: program-instructions.json > code-doctrine.md > memory.md > kod.

130. **Edytor skojarzen dam-assoc-edit.js - naprawy (2026-07-20):**
 - Search: productSearchBlob (search_blob + pelne indexes + index_bases + tagi) - znajduje po 6300539.01/000108. Folder picker: z-index 12300 (nad nakladka 12100) - klikalny. "Dodaj z dysku": matchProductsByFolder po path (exact/under/parent) faktycznie dodaje. Odznaczanie: czerwony X na AKTUALNE. Ikony wierszy (folder/kopiuj link) + indeks jako TAG. Cale style wstrzykniete z JS (bez ruszania dam-branding.css agentow).

## #131 (2026-07-20) - Usability repair: jeden modal + dashboard win/preview
- Plan FAZA 0-5 wdrożony: ui-taste = product UI + bundled ui-ux-pro-max; regula ui-taste-always w repo.
- Dashboard: delegacja `.dam-win-btn`; Podglad otwiera `DamMediaPreview` w miejscu; 2x2 gap dla media.
- Branding: `?tab=` + `bestTabForSearchQuery` przy `?q=`.
- Explorer: `openLightbox` -> DamMediaPreview (viz-studio); historia statusow = przycisk -> modal.
- Cache-bust marker: `usab20260720a/b`.

## #132 (2026-07-20) - Model policy → SUPERSEDE 2026-07-21
- **Było:** tylko Grok wszędzie, zakaz Opus/Fable; potem parent=UI + subagenci Grok/Composer.
- **Jest (2026-07-21):** pełna hierarchia Fable 5 > Sonnet/Sol/Opus > Grok 4.5 > Composer 2.5; routing UX/plan→Fable, long multi-file→Sol, WORKER→Grok, Composer preferuj read-only second eyes; brak flagowca → kompensacja procesowa. Global: `~/.cursor/rules/model-grok-composer-only.mdc` + hard #13 + `agents/shared/model-hierarchy-2026-07-21.md`.

## #133 (2026-07-20) - UI chrome: Viz changelog / Branding page size / Help restart
- Viz `#damChangeLogBar`: tylko admin + ADMIN ON; mount w `.dam-search-scope` po prawej; to Cofnij/Ponow na dysku X: (most 8766), nie Baza online.
- Branding limit kart: suwak + input = draft; apply/persist dopiero po OK (Enter na input tez apply).
- `#damHelpModal`: Wlacz samouczek ponownie pod przyciskiem X (column + gap); wiekszy padding head/body (+10px).

## #134 (2026-07-20) - VIZ-TOOLBAR pad pill = baza + delta
- Pill Wizualizacje: padding = branding baza (7/14) **+8 top/bottom +12 L/R** → **15/26**, nie absolutne 8/12.
- Styl pill: Geex/DAM light tokens (nie 1:1 ciemny branding); inject #damVizCountPillInk.
- Branding page-size: session/local po OK wygrywa z race /user-prefs.
- Changelog bar: admin role + ADMIN ON; trailing w .dam-search-scope.

## #135 (2026-07-20) - C3 freeze + backlog B3/B4/B7
- C3 = **freeze anatomii** (nie redesign): `agents/shared/bento-card-freeze.md`; komentarze FROZEN przy `.dam-viz-card` / `.dam-branding-card`.
- B3: poster wideo — bridge SVG placeholder gdy ffmpeg pada; JS data-URI + probe.
- B4: filtry Autor (`author:Krzysztof|Sylwia|Szymon|Highlite`) w Brandingu.
- B7: cache token `bust20260720a` na pozostałych stronach HTML (tokens/brand/grid-reveal).
- A1/A2 nadal `[ ]` — brak Client ID/Secret w `dam-connection.env`.

## #136 (2026-07-20) - Zaległości: Explorer create + FMCG + ERP stub
- **Root cause zgubionego feature:** kolizja nazw WORKER A/B/C (prompty Explorera vs viz/CTA) — lekcja w code-doctrine §12.
- Explorer: Plus kategorii + Dodaj produkt → modal dry-run → confirm → `POST /explorer/create-*` (`explorer_create.py`); cache `expb20260720b`.
- A3: katalog FMCG bez null `amount` (seed_estimate) + import-map v2.
- C2: dwukierunkowy stub ERP faktur (`invoice_erp.py`, erp-status/export, UI Faktury).
- B5: QA layoutów dashboardu + inject `#damDashLayoutB5Css` (`b5qa20260720c`).
- Real write Marketing tylko po Podgląd + Potwierdź; nigdy nie kasować drzew usera.

## #137 (2026-07-20) - Design system: zero żółtych range + custom date picker (brpolish)
- **HARD, globalnie:** `input[type="range"]` w całym DAM shellu = `accent-color: var(--dam-primary, #AB54DB)` (reguła bez selektora klasy w `dam-brand.css` ~2247, defense-in-depth nad lokalnymi regułami Skali/Karty/dashboardu). Żaden suwak nie ma prawa pokazać domyślnego (żółtego na Windows/Chrome) akcentu UA.
- Karty (`#damBrandingPageSize`) = ta sama klasa `.dam-viz-zoom-control` co Skala → dziedziczy box/border/height ze wspólnego selektora; nie duplikować chrome w `dam-branding.css` dla nowych kontrolek tego typu, tylko dopisywać klasę.
- **Custom date picker = design system**, nie natywny `<input type="date">` popup: `dam-date-picker.js` (`window.DamDatePicker`) auto-enhance'uje KAŻDY `input[type="date"]` w dokumencie (MutationObserver na `document.body`, jak `dam-tooltips.js`) — readOnly + wrapper `.dam-date-field` + własny popover `.dam-date-popover` (z-index 12300, styl pill jak `.dam-viz-badge`). Oryginalny input zostaje jedynym źródłem prawdy (ISO w `.value`, dispatch `input`+`change`) — żadna logika filtrów się nie zmienia. CSS: `dam-date-picker.css` (nowy plik, globalny load).
- **Lekcja koderska:** `branding.html` miał realną (bajtową, nie tylko render) korupcję PL diakrytyków — literalne `?`/U+FFFD zapisane w pliku. Weryfikacja Read tool ukazuje to identycznie jak plik na dysku (nie jest to bug tool'a) — potwierdzać przez `[System.IO.File]::ReadAllBytes` + `UTF8.GetString` w PowerShell przed poprawką, żeby nie zgadywać. Przy dużej korupcji lepiej przepisać cały mały plik (Write) niż walczyć z fuzzy-match StrReplace na uszkodzonych bajtach.
- **Perf Branding (zmierzone 2026-07-20):** `branding-index.json` = 284.9 MB, `branding-search-index.json` = 43.7 MB w `apps/web/data/`. To jest root cause "spowolnienia vs wcześniej" — jeśli user zgłosi to znowu, nie szukać gdzie indziej, tylko przypomnieć że potrzebny redesign indeksu (lazy/slim/paginacja), nie tylko debounce (debounce search już wdrożony w `bindFilters`, 220ms, tylko na `#damBrandingSearch`).
- Cache-bust: token `brpolish20260720a` na `dam-brand.css` (wszystkie HTML) + `dam-branding.css`/`dam-branding.js` (branding/dashboard/visualizations/explorer) + nowe `dam-date-picker.js/css` (tylko branding.html — jedyna strona z `input[type="date"]`, grep-verified).

## #138 (2026-07-20) - Wizualizacje: `#damChangeLogBar` = "Historia zmian" (bez Cofnij/Ponów)
- **"Nieaktualne" w hincie changelog = status produktu/wariantu (X), nie wiek danych**: `#damChangeLogHint` opisuje ostatni wpis z `/change-log` (most). Copy (2026-07-20 fix): `Status wariantu: Nieaktualne · BABKA CYTRYNOWA · 6300622.00 · 19.07.2026 20:50` (bez mylącego `status ->`). Tip wyjaśnia: litera X / archiwum, nie „log przestarzały”; nie mylić z „Baza online”. Dane OK (ostatni wpis = realny lifecycle Babka).
- **Tipy bara**: brak `title` + `data-dam-tip` naraz; tipy PL ustawiane z JS (`rebindChangeLogTips`); przy otwartym `.dam-changelog-history` bar ma `data-dam-tip-suppress` + `DamTooltips.hide` (zero czarnego tipu nad białym popoverem). `DamTooltips.hide` wyeksportowane.
- **Cofnij/Ponów usunięte z tego bara** (historyczny kontekst #138) → `#damChangeHistoryBtn` + popover read-only.
- Cache-bust: `chgcopy20260720d` na `dam-tag-edit.js` + `dam-tooltips.js`.
- **Lekcja weryfikacji (CDP)**: `browser_take_screenshot` fotografuje kartę widoczną w OS-oknie, NIE kartę wskazaną przez `viewId` z `browser_navigate`/`browser_cdp`. Gdy w tle wisi >1 karta (stare sesje), trzeba je zamknąć (`browser_tabs action:"close"`) przed screenshotem, inaczej dostajesz zdjęcie złej strony mimo poprawnego targetu w CDP. Dopisane do `code-doctrine.md` §12.
- **Lekcja encoding**: nie bumpować `?v=` w HTML przez PowerShell `Get-Content`/`WriteAllText` na plikach z PL diakrytykami w atrybutach - korumpuje UTF-8 do U+FFFD. Tip strings trzymać w `.js` (UTF-8) albo bumpować Pythontem `Path.write_text(..., encoding='utf-8')`.

## #139 (2026-07-20 wieczór) - Audit domknięcie: count pill + assoc + hold 3s
- **Floating count pill (Viz + Branding)**: `.dam-viz-grid-count` / `.dam-branding-grid-count` = **zawsze biała powierzchnia** (`background: #fff` + soft double shadow), tekst `#464255` — NIGDY ciemny toast/charcoal z białym tekstem (user 2026-07-20 22:58+). Token CSS: `gridcountlight20260720b`.
- **Skojarzone materiały (viz modal + media preview)**: HARD `viz.assoc_no_visualization_loop` — tylko materiały marketingowe Brandingu (slider/baner/social/POS) + Elementy/Surowe; **nigdy** inne wizualizacje/warianty/packshoty (`isVisualizationAsset` + `looksLikePackshotOrPrintAsset`, także `GC_*_RGB` / `wiz_GC_*` z Marketing). Zero AI/PSD/PDF/source. Ładowanie = skeleton + `DamLoader`, bez gołego „Ładowanie…”.
- **Safe delete w modalu podglądu**: `MEDIA_PREVIEW_HOLD_MS = 3000` w `dam-danger.js` (`resolveHoldMs` dla `#damMediaPreview`, `#damVizModal`, `.dam-media-preview`); `dam-assoc-edit.js` nadal explicit `holdMs: 3000`. Settings danger zone zostaje `data-dam-hold-ms="300"`.
- Cache-bust: `gridcountlight20260720b` (viz/branding CSS), `safedel20260720b` (`dam-danger.js`), `assocfix20260720c` (media-preview/viz JS + dam-brand.css skeleton).


## #141 (2026-07-21) - HARD CANON: modal podglądu Wizualizacje = layout; Eksplorator parity; wariant = produkt

- **Kanon layoutu:** `#damVizModal .dam-viz-modal__body` (Wizualizacje) = wzorzec prezentacji. `#damMediaPreview .dam-viz-modal__body` (Eksplorator / Branding preview) ma wyglądać **tak samo** (te same bloki, studio frames, spacing).
- **WARIANT produktu** = inny **INDEKS** (chip/pasek indeks×język). **NIGDY** nie mylić z perspektywą wizualizacji (FRONT/BACK/ENFACE).
- **Warianty wizualizacji** = wyłącznie 3 ramki studio: **TŁO** | **PERSPEKTYWA** | **JAKOŚĆ** (`.dam-media-preview__studio-frame` w `#damVizModalStudio` / odpowiednik w media preview).
- **Eksplorator (`#damMediaPreview`):** NIE pokazywać „WARIANTY MATERIAŁU” jako paska różnych perspektyw tego samego produktu. Perspektywy tylko w ramce PERSPEKTYWA. Pasek wariantów tylko gdy realnie różne indeksy produktu.
- **Wizualizacje (`#damVizModal`):** pasek wariantów produktu (indeksy) + 3 ramki studio.
- **Pokaż wszystkie:** przycisk w modalu pokazuje WSZYSTKIE pliki wizualizacji (z tłem / bez tła, wszystkie perspektywy i jakości), pogrupowane poniżej, animacja fade-in + transition (`prefers-reduced-motion` = bez ruchu).
- Instrukcja programu: `ui.viz_modal_parity_explorer` w `program-instructions.json`. Nadpisuje wcześniejsze „freeze modal 1:1” gdy koliduje z tą regułą.

## #142 (2026-07-21) - HARD UI: viz badges→title gap + Shift-minus + ID chip

- **Title vs badges (HARD):** `#damVizModal` / `#damMediaPreview` — gap badges→title ≥10px (prefer 12–16). **NIGDY** `margin-top: calc(N - meta-gap)` ujemny na `.dam-viz-modal__title`. Defense: inject `#dam-uihard-fixes-20260721` (`injectUiHardFixes` w `dam-media-preview.js`). CDP: `title.top ≥ badges.bottom + 10`.
- **Branding ID chip:** `button.dam-branding-card__id-chip` — pełny indeks (`width/min-width:max-content`, bez ellipsis). Assoc pills mogą ellipsis + tip.
- **Minus assoc:** `.dam-assoc-quick-minus` widoczny **tylko przy Shift** (keydown latch `shiftKeyDown`); tip „Shift + hold 2s”. Zakaz „always visible” override (studioqa).
- **+N badge:** `.dam-media-preview__assoc-variant-badge { top: -1px }` (−5px vs dawne 4px).
- Cache token: `uiHard20260721h`.

## #141 (2026-07-21) - HARD: UK/GB/EN != Ukraina (UA)

- **Blad:** slownik mapowal `uk`→Ukraina i alias `ua`→`uk`, wiec angielskie warianty (chip `UK`, meta Ukraina) byly zle (np. 6300785 CIASTO SLIWKOWE - EN na opakowaniu).
- **Regula:** `UK`/`GB`/`EN` = English / Wielka Brytania (alias `en`+`uk`→`gb`). Ukraina = tylko `UA` (`ukr`→`ua`). NIGDY `UK`→Ukraina.
- **Kod:** `naming-dictionary.json`, `DamLabels.normalizeLangCode`, `build-file-index.py`, patch `file-index.json`. Instrukcja: `data.lang_uk_not_ukraine`.
- **Uwaga:** `dam-i18n.js` locale `uk` (ISO 639-1 ukrainski UI) to inna przestrzen nazw niz kody rynku produktu.
- Cache: `?v=20260721ukGb1` (dam-labels / dam-badges / dam-viz).

## #140 (2026-07-20) - Encoding HARD: apps/web HTML/JS tylko UTF-8

- **HARD:** kazdy zapis w `apps/web/**` (HTML/JS/CSS/chrome strings) = **UTF-8 bez BOM**. Nigdy cp1250/cp1252/ANSI.
- **Root cause mojibake (site-wide 2026-07-20):** UTF-8 PL zostal odczytany jako Windows-1250 i zapisany znowu jako UTF-8 (podwojne kodowanie). Objawy klasyczne: sekwencje UTF-8-as-cp1250. Naprawa: loose `encode(cp1250)` (+ C1 U+0081 dla L-stroke) -> `decode(utf-8)`. Skrypt: `tools/_fix_mojibake_utf8.py`.
- **Zakaz:** PowerShell `Get-Content`/`Set-Content`/`Out-File` bez jawnego UTF-8 na plikach z PL; bump `?v=` tylko Pythonem (`Path.write_bytes(text.encode("utf-8"))`).
- **Weryfikacja:** `open(path,"rb")` + bajty UTF-8 (`C4 85` a-ogonek, `C5 9B` s-acute, `C5 BC` z-dot). Konsola Windows przy `print` moze klamac.
- **Nie ruszaj:** `file-index.json` / `branding-index.json` / binarne indeksy przy fixach encoding UI.
- Meta charset juz byl `UTF-8` - problem byl w bajtach plikow, nie w `<meta>`.
- CDP Pass 2026-07-20: settings devices title + branding clear/tab z poprawnym PL.

## #141 (2026-07-21) - ASCII `?` / mixed ANSI w chrome PL (HARD)

- **Objaw:** `Poka? wszystkie`, tip `W??cz`/`Wy??cz` (viz/explorer), branding `Poka? archiwum` / `Wr??`.
- **Przyczyna:** nieodwracalna utrata bajtow PL (zapis ANSI/PowerShell) albo mieszanka UTF-8 + lone latin-1 (`0xF3` = o-acute).
- **Fix:** `tools/_fix_qmark_chrome_pl.py` + `_fix_mojibake_utf8.py`; zapis TYLKO `Path.write_bytes(...utf-8)`; nigdy PS `Set-Content`.
- **Obrona:** `data-i18n` na krytycznych labelach (`branding.show_all` / `show_archive` / `back_browse`); przy wspolbieznych agentach re-read + hold przed oddaniem.
- **Proof:** CDP `codePointAt` (ż=U+017C, ł=U+0142, ą=U+0105); rg `Poka\?|W\?\?cz|Wy\?\?cz` = 0.

## #143 (2026-07-21) - Branding WARIANTY + noSrcGrid + release v3.1.0

- **Branding #damMediaPreview materialMode:** WARIANTY MATERIALU = **jeden** pasek .dam-media-preview__variant-grid (siblingi RASTER/VIDEO: JPG/PNG…). **Zakaz** drugiego bloku all-files z tym samym naglowkiem.
- **noSrcGrid HARD (nadpisuje mergeVar PSD tiles):** PSD/PSB/AI/PDF **NIGDY** w variant-grid. Filtr: 
eturn !isSourceVariantFile(v). Zrodla tylko SourceMount w belce akcji.
- Studio materialMode: ukryty/pusty (brak fake TLO). Product viz all-files rows+dedupe bez zmian.
- Shift-minus: Shift-gate, rozmiar ≈80% (21px). UTF-8 chrome: Pokaż/Włącz (0x Poka?/W??cz).
- **Wersja:** v3.1.0. Cache: ship20260721v310. Audyt: agents/shared/gap-audit-2026-07-21.md.



## #144 (2026-07-21) - Lang EN canon + PROJEKT/WIZKI + Admin AJAX (HARD)

- **EN not GB:** store+chip en/EN; aliases gb/uk/en -> en; UA only for Ukraine (ukr->ua). UK != UA.
- **Provenance:** langs only from folder tokens + files in PROJEKT/PROJECT and 4-WIZKI/VISUALS. MATERIALY/Magnific …-uk_… IGNORE.
- **Folder multi-lang:**  - PL EN -  between name/date and index when 2+ langs; single PL (DK) = no lone - PL -.
- **Admin:** role=admin session = instant apply (carrier/lang); no moderation toast; AJAX UI update (DamViz.refreshAfterTagChange); no full reload.
- **API:** POST /revision-langs {revision_path, langs[]}; Dodaj typ -> /explorer/add-variant-type (+ Szablony when disk OK).
- **KAR6X:** thumb/path prefer FRONT-L over ENFACE.
- **Multi search:** synonyms in naming-dictionary.ui.multi_lang_synonyms + search_blob + viz filter.
- Cache token family: langEnTag20260721*.

## #145 (2026-07-21) - Samouczek + DobroKalorius HARD

- Poprawny cel: **advance-first**, potem opcjonalny nieblokujacy toast praise (~25%); `CONGRATS_MS=2275` (−35% vs 3500); krotkie teksty; rare burst `BURST_CHANCE=0.12` sposrod toastow. NIE `is-congrats` / praiseLock na tipie.
- Off-path = **exploreMode**: companion BR + `tryExplore` (>=40, joy/approve), soft dim, UI klikalne (bez preventDefault na kolejnych klikach), faza bez advance, throttle copy 12s; `Wróć do samouczka` przywraca tip.
- Media/nosniki: pozy `media-assets`/`media-image`/`media-video` (= explain-assets/image/video). NIGDY pose-5 / ksiazka Pyszne roslinne (`present` usuniete z mapy i krokow).
- Gender: jawna mapa F/M; unknown = neutral `{trySelf}` = sobie (nigdy zgadywanie z koncowki).
- Copy: `dobrokalorius-copy.json` (tryExplore + wander + sad), sloty `{name}/{nameVocative}/{nameDim}/{trySelf}`.
- Companion padding >=16-20px (cel ~22-28px) + anim `is-enter` / pose-swap.
- Help restart w `dam-shortcuts.js` + `DamTutorial`.
- Token: `tutorialPraiseToast20260721b` (linia explore: `tutorialExplore20260721c`). Instrukcja: `ui.tutorial_dobrokalorius_hard`.

- 2026-07-21: Etykiety jezykow = Polski/Niemiecki/Angielski (nie kraje). #damVizModalMeta klik = Folder/reveal. Zrodlo: naming-dictionary + DamLabels. Instrukcja ui.lang_labels_are_languages.

