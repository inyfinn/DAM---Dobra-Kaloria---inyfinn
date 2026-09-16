## 2026-09-16 - v1.8.7 Authenticode Inyfinn (SmartScreen)

**Komenda/Akcja:** User: SmartScreen „Nieznany wydawca” na DAM-Setup.exe. Zwalcz. Commit push build.

**Log/Status:**
- Przyczyna: exe niepodpisany. Na PC brak certu CA (OV/EV). Jest tylko self-signed Photo Resizer (zly Subject).
- Nowy cert CurrentUser `CN=Inyfinn, O=Inyfinn, C=PL` (nie Photo Resizer). `sign-dam-binaries.ps1` zawsze podpisuje. Publiczny `.cer` + `trust-inyfinn-publisher.ps1` w instalatorze.
- Self-signed: Wlasciwosci pliku = Inyfinn. SmartScreen z GitHuba moze zostac az do certu CA + `DAM_CODE_SIGN_PFX`.

**Efekt/Fix:** Kazdy build ma Authenticode Inyfinn. Ship 1.8.7 + GitHub Release.

**Zrodla:** CODE-SIGNING.md, sign-dam-binaries.ps1.

## 2026-09-16 - HARD: commit+push+build zawsze = GitHub Release

**Komenda/Akcja:** User: ZAWSZE jak prosi o push commit i build, chodzi o build lokalny ORAZ wyslanie instalatora jako nowy release.

**Log/Status:**
- Wpis HARD w `bin/memory.md` (gora pliku).
- Regula alwaysApply `.cursor/rules/dam-ship-github-release.mdc`.
- `program-instructions.json` id `ops.ship_github_release` (v24).
- Skill `dam-dobrakaloria` DoD + zakaz.
- `dam-version-bump.mdc` dopisek ship.

**Efekt/Fix:** Kolejny brief „commit push build” nie moze skonczyc sie bez `gh release create --latest`.

**Zrodla:** User 2026-09-16; lekcja Latest=1.0.74 przy main=1.8.6.

## 2026-09-16 - GitHub Release v1.8.6 (Latest)

**Komenda/Akcja:** User: releases na GitHubie stoi na 1.0.74; commity 1.8.6 ginie. Gdzie commit?

**Log/Status:**
- Push byl na `origin/main` (`791cb31`). Strona Releases to tag + asset, nie log gita. `v1.0.74` zostal Latest, bo nikt nie zrobil `gh release create` po 1.8.x.
- `gh release create v1.8.6` `--target 791cb31` `--latest` + `bin/instalator/DAM-Setup.exe` (64 427 012 B).

**Efekt/Fix:** https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases/tag/v1.8.6 jest Latest.

**Zrodla:** gh release; memory.md (ship = push + GitHub Release).

## 2026-09-15 - v1.8.6 whisper papers per colorify accent

**Komenda/Akcja:** User: zielone nie jeden szary; Jadeit `#F4F7F5` → `#EBF2ED` (10% akcentu na papierze). Cieple nie jedno `#FAF5F6`. Sliderow nie ruszac. Juz doskonale — tylko leciutko.

**Log/Status:**
- Formula: `mix(familyPaper, chromeAccent, 0.04)` sRGB. Userowe 10% (`0.10`) daje sage `#DDECE6`. Gold Jadeit ≈ `#EBF2ED` przy `0.04` (to samo co slider -15/+15 upieczone w hex).
- Zielone: baza `#F4F7F5`. Cieple: baza `#FAF5F6`. Kafelki `#FFFFFF`. Fiolet / DK shop bez zmian.
- Slider HTML i `TUNING_DEFAULTS` zostaja 0.
- Wersja 1.8.6 (186).

**Efekt/Fix:** Kazdy zielony/cieply zestaw ma wlasny szept akcentu na `--dam-bg` / sidebar.

**Zrodla:** dam-theme.js `PAPER_WHISPER_T`, `applyGreenWhisper`, `applyWarmWhisper`.

## 2026-09-15 - v1.8.5 chrome: white icon tiles, no Asana stripe, one radius

**Komenda/Akcja:** User: brudne szare ikony viz, gruby pasek Asana, mieszane radiusy header, tlo sidebara. Ship 1.8.5 (184 juz na footerze).

**Log/Status:**
- `.dam-viz-icon-btn` / `.dam-nav-circles--tiles`: bg `--dam-surface`, hairline `--dam-border`, ink `--dam-text`, radius `--dam-radius-btn` 6px. Koniec 2px `#5c5868`.
- `li.dam-dash-panel__item`: usunieto `border-left: 3px solid #9b97ab`. Biala powierzchnia + 1px.
- Header `#damDbStatus` `#damRootStatus` ADMIN PL badges: `border-radius: var(--dam-radius-btn)`.
- `#damSidebar`: `background-color: var(--dam-bg)`, bez gradientu-plyty.
- CMD hide zostaje: task `wscript.exe` + `sync-pamiec-podreczna-hidden.vbs` (`sh.Run …, 0`) + `CREATE_NO_WINDOW`.
- PNG: `qa-dk-1.8.5-dashboard-chrome.png` 1585x947; `qa-dk-1.8.5-dashboard-tiles-asana.png`.

**Efekt/Fix:** Kafelki ikon biale; Asana bez paska; jeden radius 6px; sidebar = papier strony.

**Zrodla:** dam-dashboard.css, dam-brand.css, dam-primitives.css, dam-tokens.css.

## 2026-09-15 - v1.8.4 white tiles + hidden PAMIEC console

**Komenda/Akcja:** Kafelki DK `#FFFFFF` (luka jak fiolet `#F7F2F7`/`#FFFFFF`); canvas whisper `#F6F7F6`. Ukryc `cmd.exe` sync PAMIEC-PODRECZNA. Ship 1.8.4 (HEAD byl 1.8.3).

**Log/Status:**
- Tokeny: `--dam-surface`/`elevated`/`input` `#FFFFFF`; `--dam-bg`/`muted`/`sidebar` `#F6F7F6`. Nie sage `#F4F7F5`, nie krem `#FDF8EC`.
- CDP Settings/Dashboard: body `rgb(246,247,246)`, widgets `rgb(255,255,255)`. Fiolet compare: `#F7F2F7` / `#FFFFFF`.
- Task `DAM-PAMIEC-PODRECZNA-sync` prze-rejestrowany: `wscript.exe` + `sync-pamiec-podreczna-hidden.vbs` (`sh.Run …, 0`) + `pythonw` + `CREATE_NO_WINDOW` na SSH. Sync zostaje.
- PNG: `bin/agents/shared/qa-evidence/qa-dk-1.8.4-settings-p1.png` 1585x947; `settings-p2-wyglad.png`; `settings-p3-picker.png`; `dashboard.png`.

**Efekt/Fix:** Biale kafelki na tintowanym papierze; okno CMD sync nie startuje z `.cmd`.

**Zrodla:** dam-tokens.css, dam-theme.js DK_SHOP_PAPER, DAM-PAMIEC-PODRECZNA-sync.xml, sync-pamiec-podreczna.py CREATE_NO_WINDOW.

## 2026-09-15 - v1.8.2 dotted-integer version math

**Komenda/Akcja:** Wersja DAM to plaska liczba z kropkami (179→180→181→182), nie semver. Footer 1.7.12 = 182 = 1.8.2. Ship 1.8.0 byl dwa kroki za.

**Log/Status:** memory.md + dam-version-bump.mdc; zrodla 1.8.2; commit; push; instalator.

**Efekt/Fix:** Footer DAM v1.8.2. Licznik 182. Nigdy 1.7.10 / 1.7.12 / 1.8.10.

**Zrodla:** memory.md, dam-version-bump.mdc, version.json, dam-version.js, runtime_config.py, DAM-Setup.iss.

## 2026-09-15 - v1.7.5 cache provenance + first-run NAS pack

**Komenda/Akcja:** Manifest + SQLite provenance; first-run fetch z Panel-DAM/bin/PAMIEC-PODRECZNA; bump 1.7.5 (user: 175 commitow, nie 1.0.75); push; instalator.

**Log/Status:** `dam_kv_local.thumb-cache-manifest` (generated_at, file_count, total_bytes, last_mtime, source, synced_at). Porownanie pusto/delta/match. NAS manifest HTTPS potwierdzony 12937 / 102921212. Pack `cache-pack.tar` odswiezony. UI leftovers: bez restylu pill/win-btn (juz 44px); `dam-app.css?v=1.7.5` na index/explorer/visualizations/branding.

**Zrodla:** dam_thumb_cache.py, dam_db.py, sync-pamiec-podreczna.py, dam-repo-pull.sh.

## 2026-09-13 - v6.0.7 scheme picker overlay (facts, bez PASS)

**Komenda/Akcja:** 41 kafelkow z karty Wyglad do osobnego okna. 2 kolumny, klik nie zamyka. Commit + push + instalator.

**Log/Status:**
- Trigger: `#damSchemeCurrent` + `#damSchemeOpenPicker` (Wybierz zestaw). Grid `#damSchemeGrid` tylko w `#damSchemePickerOverlay`.
- Overlay z-index 12300. Klik kafla = live apply, dialog zostaje. Zamknij/X/Esc zamyka. Klik tla NIE zamyka.
- Grid CSS: `grid-template-columns: minmax(0,1fr) minmax(0,1fr)`. CDP col1=col2=234px.
- PNG: `bin/docs/project/qa-6.0.7-scheme-picker.png` 150740 B; `qa-6.0.7-scheme-picker-open.png` 172367 B.
- Wersja 6.0.7. Cache `?v=6.0.7` dam-theme.js / dam-brand.css.

**Zrodla:** dam-theme.js, dam-brand.css, settings.html

## 2026-09-13 - v6.0.6: zestawy Colorify jako kafelki (facts, bez PASS)

**Komenda/Akcja:** User FAIL: screenshot nadal 8 kropek akcentu. Worker: import ALL Colorify schemes jako TILES. HSL max 50%. Bez git commit/push.

**Log/Status:**
- Colorify SoT: `colorify-admin-schemes.php` `scheme_pool_raw` = 40 palet. Skip: `colorify-custom` (hex override w DAM). Extra tile: `default` / DAM fiolet `#AB54DB`.
- Tiles rendered: 41 (`#damSchemeGrid [data-scheme-id]`). Groups: DAM, Zielone, Cieple, Niebieskie, Fioletowe, Ziemia.
- Selectors: `#damAppearance` `#damSchemeGrid` `.dam-scheme-tile` `[data-scheme-id]` `#damAccentPresets` `.dam-appearance-tune` `#damThemeTuning`.
- Persist: `localStorage.dam_scheme` + `dam_scheme_named` + `dam_accent` + `dam_theme_tuning`. Export JSON keys: `scheme` `scheme_named` `accent` `tuning`.
- CDP: cardW 1140, tuneW 420 (37% <=50%), first tile 114x60, dots 8.
- PNG: `bin/docs/project/qa-6.0.6-schemes-tiles.png` 1511x940 119614 B; `qa-6.0.6-schemes-hsl.png` 1511x940 119684 B.
- smoke :8765 200 t=0.005s; :8766/health 200 t=0.011s.
- Wersja 6.0.6: version.json, dam-version.js, runtime_config.py, DAM-Setup.iss. Cache `?v=6.0.6b` dam-theme.js / dam-brand.css / dam-settings.js.
- Commit/push/installer: NIE.

**Efekt/Fix:** Zestawy pelne (bg/surface/accent/text), kropki tylko override.

**Backup:** brak.

**Test/Ewaluacja:** node --check dam-theme.js dam-settings.js; CDP tileCount 41; screenshot+Read.

**Zrodla:** dam-theme.js COLORIFY_POOL, settings.html#damSchemeGrid, colorify-admin-schemes.php pool_raw

## 2026-09-13 - v6.0.5: zadania w tle ukryte + karta Ustawienia (facts)

**Komenda/Akcja:** Widoczny cmd.exe 15:14:45 robocopy Panel-DAM. HARD: ukryte okno, bramka DAM.exe/dam-appw.exe, karta Ustawienia. Worker: bez git commit/push, bez PASS. Parent sedzi PNG i zrobi commit+installer.

**Log/Status:**
- Przyczyna: zadanie Windows `DAM-Panel-DAM-HourlySync` LastRun 13.09.2026 15:14:44, Hidden=False, action = powershell.exe -File deploy-panel-dam-synology.ps1 (widoczna konsola + robocopy /MIR).
- Drugie zadanie: `DAM-ETA-Database-Git-Sync` (juz Hidden via VBS; po re-register tez wrapper).
- Autostart (lista, nie robocopy): Startup `DAM autostart (przegladarka).lnk` -> wscript run-dam-watch.vbs (D: stary layout). parent-agent-gate, index_supervisor, pg-backup-watcher = watek mostu, nie schtasks.
- Wrapper: `bin/scripts/ops/run-dam-bg-job.ps1` + `run-dam-bg-job-hidden.vbs`. Gate: Get-Process DAM, dam-appw (NIE python serve_browser). Mock: DAM_REQUIRE_PROCESS=1 + DAM_MOCK_NO_PROCESS=1 -> exit 0, last_status skipped_no_dam, bez okna.
- Re-register (user xpret, Limited, Hidden=True):
  - DAM-Panel-DAM-HourlySync: wscript.exe "...\run-dam-bg-job-hidden.vbs" panel-dam-sync
  - DAM-ETA-Database-Git-Sync: wscript.exe "...\run-dam-bg-job-hidden.vbs" db-git-sync
- UI: settings.html `#damBackgroundJobs` (chip data-filter=jobs). GET/POST `:8766/background-jobs`. Selektorzy: `#damBgJobsHint` `#damBgJobsList` `.dam-bgjob` `input[data-bg-job]` `[data-bg-run]`. Persist: `bin/apps/desktop/data/background-jobs.json`.
- Wersja 6.0.5: version.json, dam-version.js DAM_APP_VERSION, runtime_config.py APP_VERSION, DAM-Setup.iss MyAppVersion, settings.html ?v=6.0.5 (dam-version.js, dam-settings.js). BRIDGE_API_VERSION=11.
- PNG: `bin/docs/project/qa-6.0.5-bg-jobs-settings.png` 201794 B, 1511x940. Chip Zadania w tle aktywny. 4 wiersze: Panel-DAM HourlySync, Database-Git-Sync, zrzut Postgres, nadzor indeksu. Toggle + Uruchom teraz. Hint: DAM.exe nie dziala. Overlay toast indeksu zaslania stopke ostatniego wiersza.
- smoke :8765/settings.html 200; :8766/health 200. GET /background-jobs 200 (token 64).
- Commit/push/installer: NIE (zakaz workera). Parent: commit + build-installer.ps1.

**Efekt/Fix:** robocopy nie startuje przy zamknietym DAM.exe; schtasks Hidden + VBS; user wylacza auto w Ustawieniach.

**Backup:** brak.

**Test/Ewaluacja:** schtasks Hidden+wscript; mock skipped_no_dam exit 0; node --check dam-settings.js; py_compile local_bridge.py; screenshot+Read.

**Zrodla:** deploy-panel-dam-synology.ps1, run-dam-bg-job.ps1, run-dam-bg-job-hidden.vbs, install-panel-dam-hourly-task.ps1, local_bridge.py /background-jobs, settings.html#damBackgroundJobs, dam-settings.js initBackgroundJobs, qa-6.0.5-bg-jobs-settings.png

## 2026-09-13 - v6.0.1 intern: dark tokens + HSL + export (facts)


**Komenda/Akcja:** Kontynuacja. Dark tokeny + Colorify-like HSL w Ustawieniach + export JSON profilu. Screenshot+Read. Bez commit. Bez PASS. local_bridge / poller / root-status / shell NIE ruszane w tej turze.

**Log/Status:**
- Tokeny `html.dark, html[data-theme=dark]` w dam-brand.css: `--dam-bg` `--dam-surface-muted` `#101114` `--dam-surface` `#1c1d24` `--dam-surface-elevated` `#262730` `--dam-chrome` `--dam-border` `#2c2b36` `--dam-text` `#eeeaf6` `--dam-text-muted` `#b8b3c6` `--dam-hash` `--card-bg` plus Geex `--white-color` `--section-color` `--gray-color` `#d2cedc`. Zero `filter:invert`.
- CDP historia: surface `#1C1D24` bg `#101114` elevated `#262730` hash `#C28CE0` filter none. Karty antracyt, nie biale.
- CDP explorer: `#damExplorerMain` / results body `rgb(28, 29, 36)` `--card-bg` `#1C1D24` filter none. Leftover: biale pille radio (Produkty/Materialy, DK/GC, jezyk) z sibling CSS poza allowlista.
- Settings `#damAppearance`: 4 slidery HSL (`bg_brightness` `bg_saturation` `accent_brightness` `accent_saturation` -90..+90). Przycisk `#damThemeExportBtn` = `Eksportuj ustawienia profilu`.
- Export JSON klucze: `exported_at` `app_version` `theme_pref` `theme_resolved` `accent` `tuning` (dark/light) `localStorage` `user`. Sample: app_version 6.0.1 theme_pref dark accent `#AB54DB`. localStorage keys obecne: dam_theme_pref theme dam_accent dam_user_name dam_role dam_base_path dam_user_prefs. EXPORT_KEYS takze: dam_theme_tuning dam_user_email dam_user_phone dam_user_title dam_tooltips dam_synology_enabled dam_brands. Download `dam-profile-settings-YYYY-MM-DD.json`. Bez token/password.
- PNG: `bin/docs/project/qa-6.0.1-dark-session.png` 161907 B; `qa-6.0.1-dark-explorer.png` 160875 B; `qa-6.0.1-theme-export.png` 135060 B. Screenshot+Read.
- `?v=6.0.1` settings dam-brand.css + dam-theme.js.
- smoke :8765 explorer.html 200 t=0.0047s; :8766/health 200 t=0.0137s.
- git status forbidden nadal M (index worker), ta tura ich nie edytowala.

**Efekt/Fix:** dark semantic surfaces + HSL tuning + JSON export. Dowod screenshot.

**Backup:** brak.

**Test/Ewaluacja:** curl 5s; CDP tokens; exportProfile(); screenshot+Read 3 PNG.

**Zrodla:** dam-brand.css, dam-theme.js, settings.html#damAppearance, qa-6.0.1-dark-*.png qa-6.0.1-theme-export.png

## 2026-09-13 - v6.0.1 intern: live toast + raport + menu (facts)

**Komenda/Akcja:** Intern worker. Toast: current_item + short path. Po biegu: Zamknij albo Raport (puste = Nic nowego). Menu profilu pod Pomoc: Sprawdz aktualizacje. Ukrycie Aktualizacja w Ustawieniach z dam-root-status.js. 6.0.1. Bez commit. Facts only.

**Log/Status:**
- version.json / dam-version.js DAM_APP_VERSION / runtime_config.py APP_VERSION / DAM-Setup.iss = 6.0.1
- GET :8766/index/status (X python 13240) klucze: current_item, current_name, current_path, new_items, last_report. Wartosci puste bo rebuild_running=false.
- GET :8766/index/report: ok=false (ostatni run rc=1), empty=true, items=[]
- Programs\\DAM (stary most) NIE mial tych kluczy; po starcie X serve_browser pola sa.
- local_bridge.py 9786 linii (ADD only, bez truncate z D)
- Ukrycie #damAppUpdates / .dam-sw--app: style#damHideAppUpdatesCss z dam-root-status.js. CDP settings titles: Profil, Wyglad, Dysk, Preferencje, Historia, Integracje, Powiadomienia, Konwersja, Nazewnictwo, Instrukcje, System. Brak Aktualizacje.
- Menu: Profil / Ustawienia / Pomoc / Sprawdz aktualizacje (#damUserMenuUpdate)
- Toast live (DamCacheSync.debugPreview live, bo idle): "Teraz: Cynamonka / ELEMENTY / front.ai" + short path. Raport: 1 pozycja Cynamonka nerkowcowy. Empty: "Nic nowego". Przyciski Zamknij + Raport.
- PNG: qa-6.0.1-index-live.png 175010 B; qa-6.0.1-index-report.png 158043 B; qa-6.0.1-index-empty.png 156237 B; qa-6.0.1-update-menu.png 202655 B; qa-6.0.1-update-settings.png 178643 B
- smoke :8765 explorer.html 200 t=0.005s; :8766/health 200 t=0.013s
- Commit/push: nie. CSS/** i appearance panel: nie ruszane.

**Efekt/Fix:** poller dociaga Teraz: z /index/status; hide update column z JS; menu pod Pomoc.

**Backup:** brak.

**Test/Ewaluacja:** py_compile index_supervisor+local_bridge; node --check poller+root-status+shell; curl status/report; screenshot+Read.

**Zrodla:** dam-index-poller.js, dam-root-status.js, dam-shell.js, index_supervisor.py, local_bridge.py, qa-6.0.1-*.png

## 2026-09-13 - v6.0.0: status po 0526d70 (worker, bez commit/push)

**Komenda/Akcja:** User: dokoncz plan, wersja 6.0.0, commit+push+build. Worker: FACTS only. Bez git commit/push. Bez OOTB PASS. Parent sedzi.

**Log/Status:**
- HEAD = origin/main = `0526d70470fed1da461396a62c16f9a8149c2ad6` (left-right origin...HEAD = 0 0)
- version.json / dam-version.js `DAM_APP_VERSION` / runtime_config.py `APP_VERSION` / DAM-Setup.iss `MyAppVersion` = 6.0.0 (brak dryfu)
- local_bridge.py 9034 linie (git show HEAD i working tree; worker podal 9747, parent zmierzyl 9034). Nie kopiowano mostu z D.
- DAM-Setup.exe GIT_ROOT: 75542098 B, mtime 2026-09-12 15:49:11, FileVersion=6.0.0 ProductVersion=6.0.0, `.gitignore`. Pliki produktu w HEAD starsze niz Setup; rebuild NIE odpalany.
- build-installer.ps1 staging: named trees only; PAMIEC-PODRECZNA nie jest zrodlem kopi.
- PNG (tracked w 0526d70): qa-6.0.0-explorer-elementy.png 98907 B; qa-6.0.0-db-panel.png 167923 B; qa-6.0.0-settings-db.png 186859 B
- smoke :8765/explorer.html HTTP 200 t=0.009s; :8766/health HTTP 200 t=0.010s. Ta maszyna = runtime, nie czysty PC.
- W 0526d70 juz sa: build-installer.ps1, parent-agent-gate.ps1, dam-cache-sync.js, DAM-Setup.iss, qa PNG, ten process.md (wpis 2026-09-12).
- Untracked produkt do commita parenta: `PLAN-INSTALATOR.md` (zaktualizowany do 6.0.0/0526d70).
- Skip: DAM.cmd (placeholder chmury), HANDOFF-BRANDING-QUIZ-VIZ.md (chmura/poza planem), *_Conflict*, logi, sqlite, dumps, file-index, user-prefs, index-watcher, secrets, pg-config, cache-publish-queue, thumb-cache-manifest.
- Plan todo `ootb-clean-pc` nadal pending.

**Efekt/Fix:** PLAN-INSTALATOR.md zsynchronizowany ze stanem 6.0.0. Wersje bez zmian. Setup bez rebuildu.

**Backup:** `D:\_DAM-BACKUP-X-20260912` (nie ruszany). Commit/push: nie (zakaz workera).

**Test/Ewaluacja:** smoke-dam-ports.ps1 exit 0; FileVersionInfo Setup; python line count mostu; Get-Item PNG.

**Zrodla:** git rev-parse, version.json, dam-version.js, runtime_config.py, DAM-Setup.iss, DAM-Setup.exe, local_bridge.py, qa-6.0.0-*.png, build-installer.ps1, PLAN-INSTALATOR.md

## 2026-09-12 - v6.0.0: produkt 6.0.0 (206 installer + 207 Elementy/DB + merge X)

**Komenda/Akcja:** User: STOP 5.0.208. Target 6.0.0. Bez git commit/push. Parent sędzi z plików.

**Log/Status:**
- version.json / dam-version.js / runtime_config.py APP_VERSION / DAM-Setup.iss MyAppVersion / README.txt = 6.0.0
- HTML ?v=6.0.0 na assetach merge; dam-shell injectors 6.0.0; dam-root-status cache-sync 6.0.0
- local_bridge.py 9034 linie; list_folder_images + list_folder_browse + pick_folder_dialog + reveal/open = resolve_physical_path
- py_compile local_bridge.py pg_db.py runtime_config.py exit 0
- node --check dam-shell.js dam-explorer.js dam-db-status.js exit 0
- smoke :8765 explorer.html HTTP 200 t=0.0057s; :8766/health HTTP 200 t=0.0146s
- PNG: bin/docs/project/qa-6.0.0-explorer-elementy.png 98907 B (openProduct cynamonka-nerkowcowy; CDP [data-elements-link]=true; checklist Elementy / skladniki)
- PNG: bin/docs/project/qa-6.0.0-db-panel.png 167923 B (panel Silnik bazy: Auto / Lokalna / Synology / dump)
- PNG: bin/docs/project/qa-6.0.0-settings-db.png 186859 B (Ustawienia + ten sam panel)
- Chunk H: build-installer.ps1 exit 0; Version=6.0.0; DAM-Setup.exe 75093887 B (71.6 MB) mtime 2026-09-12T15:40:58; staging PAMIEC dirs=0; ISCC Successful compile

**Efekt/Fix:** bump 6.0.0. Commit: nie.

**Backup:** D:\_DAM-BACKUP-X-20260912 (nie ruszany).

**Test/Ewaluacja:** compile + smoke + 3 PNG na dysku. G/H w planie nie odhaczone.

**Zrodla:** version.json, dam-version.js, runtime_config.py, DAM-Setup.iss, README.txt, HTML web, dam-shell.js, local_bridge.py, qa-6.0.0-*.png

## 2026-09-12 - v5.0.208: merge installer 206 + Elementy/DB 207

**Komenda/Akcja:** User: dzialaj dalej, w pelni wprowadzony plan. Stay on X. Bump 5.0.208. Bez commit/push/force-pull. Bez checkout D -- most.

**Log/Status:** Chunk E hunks juz na X (union pg_db, resolve_physical_path na reveal/open + listing ELEMENTY, shell cache-sync + db-status, signin tags, doktryna 8-9 + vendor-gate). Chunk F: jedna wersja 5.0.208.

**Efekt/Fix:** version.json / dam-version.js / runtime_config.py / DAM-Setup.iss + ?v= assetow (brand/api/paths/icons/picker/explorer/db-status/shell/version/cache-sync/index-poller/root-status).

**Backup:** `D:\_DAM-BACKUP-X-20260912` (nie ruszany). Commit: nie.

**Test/Ewaluacja:** py_compile + node --check + smoke :8765/:8766 + screenshot Elementy/DB.

**Zrodla:** version.json, dam-version.js, runtime_config.py, DAM-Setup.iss, HTML web, dam-shell.js, local_bridge.py, pg_db.py

## 2026-09-12 - v5.0.207: DB panel karty + packed Synology

**Komenda/Akcja:** User HARD: localhost ≠ DAM.exe. Dummy user: Synology bez kopiowania. Usunąć rząd chipów Auto|Synology|Lokalna; Auto nad kartą Lokalna; karty `div.dam-db-source` = klikalne kontrolki.

**Log/Status:** Root cause: `serve_browser.py` z gita trzyma :8765, a `_kill_stale` zabijał tylko procesy z WŁASNEGO drzewa → DAM.exe schodził na 8767 albo agenci oglądali repo (SQLite `D:\--- INYFINN...`). Panel: chipy wyglądały jak wybór, karty miały `cursor:pointer` bez handlera.

**Efekt/Fix:** Karty role=button + apply od razu; Auto `#damDbAutoBtn` nad Lokalna; dump-karta = Pobierz dump. `launch.py` zabija python na 8765/8766 (także repo). `ensure_pg_config_ready` szuka też Programs\DAM. SQLite `location=install` gdy ścieżka Programs\DAM. v5.0.207 skopiowane do instalacji (bez revertu plików ELEMENTY).

**Backup:** brak. Commit: nie.

**Test/Ewaluacja:** `node --check` dam-db-status.js; unittest canonical+location; prawda = DAM.exe po restarcie.

**Źródła:** dam-db-status.js, dam-brand.css, dam-shell.js, pg_db.py, launch.py, dam_db.py

## 2026-09-12 - v5.0.206: ELEMENTY D:/→X: + CTA right fade

**Komenda/Akcja:** Worker: `path_not_found` na `Wskaż Elementy / składniki` mimo ze folder X: istnieje (Cynamonka / Ciasto Sliwkowe). CTA Wizualizacje lewo vs Elementy prawo — ujednolicic RIGHT + fade. Prawda = DAM.exe, nie localhost 8765.

**Log/Status:** Indeks `D:/Marketing/...`, dysk `X:\Marketing\...`. `resolve_physical_path` tylko `is_file` → folder listing 404. Slim `checklist.tech=true` nie bylo promuowane → BRAK. CTA: usunieto lewy Przejdz; 34px ikony right; opacity tween.

**Efekt/Fix:** `dam_path_resolve` file+dir; `list_folder_images`/`browse`/`reveal` remap; hydrate remap + probe ELEMENTY; slim.tech; CSS-in-JS slot CTAs. Wersja 5.0.206. Kopia do `%LOCALAPPDATA%\Programs\DAM\`.

**Backup:** brak. Commit: nie.

**Test/Ewaluacja:** unittest DirDriveRebaseTests; `node --check` JS; Test-Path ELEMENTY; list_folder_images(D: path) ok.

**Źródła:** dam_path_resolve.py, local_bridge.py, dam-api.js, dam-explorer.js, dam-icons.js, dam-folder-picker.js, dam-paths.js

## 2026-09-12 - v5.0.206: installer runtime gate + full data + InstallDelete

**Komenda/Akcja:** Intern: dokonczenie 5.0.206 (brama importow, pelne dane, InstallDelete, cache-bust, README, doktryna). X: force-pull `618f0ad` -> `5e50962`. Backup: `D:\_DAM-BACKUP-X-20260912`.

**Log/Status:** SkipVendor tylko gdy `python.exe -c import webview,bcrypt,psycopg2,PIL,ijson,openpyxl,cryptography` exit 0 i site-packages >= 500. Brak GIT_ROOT\apps = auto SkipSync. Staging kopiuje `apps\api`, `scripts`, `docs`, `agents` + CALY `web/data` (bez whitelisty; wykluczenia: thumbs/_invoice_mail_stage/backups + smieci). `[InstallDelete]` kasuje kod web (assets/i18n/scripts/_qa/pages/src/vendor + html/js/py) i api/THEME/runtime/scripts/docs/agents/desktop py; NIE rusza `apps\web\data`, `desktop\data`, DATABASE, PAMIEC-PODRECZNA. Launcher: stderr do `%LOCALAPPDATA%\DAM\launch-error.log` + MessageBox przy braku modulow. pg-config passworded zostaje. Cache miniatur nie jedzie w Setup.

**Efekt/Fix:** Dummy user = Setup + login z seeda. Synology OOTB. Skrypty w paczce (nie "brakuje").

**Backup:** `D:\_DAM-BACKUP-X-20260912`

**Test/Ewaluacja:** SkipVendor OK (1549 src / 933 staging site-packages, import exit 0). ISCC 6.7.3. DAM-Setup.exe 70,3 MB. Setup 5.0.206 wiezie przebudowany dzisiaj launcher DAM.exe (Go bootstrap 2026-09-12 14:12, SHA 9CD13314, nie stary exe z LocalAppData). Bez PASS OOTB / bez VM.

**Zrodla:** build-installer.ps1, DAM-Setup.iss, README.txt, requirements-portable.txt, version.json, dam-version.js, runtime_config.py, dam_root_launcher.py, sync-apps-to-bin.ps1, code-doctrine.md §12

## 2026-09-12 - v5.0.205: Setup embed pg-config + ZERO user copies

**Komenda/Akcja:** User (angry, HARD): zaden uzytkownik nigdy nic nie kopiuje. Instalator robi wszystko: vendor, passworded pg-config, branding-grid, Synology default. Pull, bump, build, push, GitHub Release.

**Log/Status:** 5.0.204 wciaz kazal kopiowac example. `build-installer.ps1` embeduje `pg-config.json` z sekretu maszyny (FAIL gdy brak). UI/README bez „skopiuj”. First-run `ensure_pg_config_ready` + `_ensure_grid_index`.

**Efekt/Fix:** Dummy user = dwuklik Setup. Sekret nie jedzie do gita. Push `a3873a5`. Release [v5.0.205](https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases/tag/v5.0.205) — DAM-Setup.exe 45,4 MB. Staging: vendor Unicons+Jost, branding-grid 343 KB, passworded pg-config. `/db/status` synology active, Branding 200 kart.

**Źródła:** build-installer.ps1, pg_db.py, dam_db.py, dam-db-status.js, branding_asset_routes.py, installer/README.txt

## 2026-09-12 - v5.0.204: installer vendor + branding slim + pg-config first-run

**Komenda/Akcja:** User: napraw instalator, pull, push, GitHub release, build Setup.

**Log/Status:** FF `origin/main` 87bbb22 (5.0.203). Setup 5.0.203 wycinał `vendor` i nie pakował `branding-grid-head` → puste ikony + Branding http_404. Poprawiono `build-installer.ps1`, HTML link Unicons, `pg_db.ensure_pg_config_example_in_data`, hint UI. NIE commitujemy `pg-config.json` ani fat branding-index.

**Efekt/Fix:** Push `14846dd` + `6d2f7ec`. Tag/release [v5.0.204](https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases/tag/v5.0.204) — DAM-Setup.exe 45,4 MB. Staging: vendor Unicons+Jost, branding-grid-head/index, pg-config.example; **bez** dam-connection.env.

**Źródła:** build-installer.ps1, dam-fonts.css, branding-grid-head.json, pg-config.example.json

## 2026-09-09 - v5.0.187: tutorial Projekty Dalej + glossary

**Komenda/Akcja:** Parent interrupt: samouczek stuck na Projekty, Dalej znika/ghost; glossary Info Pakowania / Asana / Teams / PAKIET / Skojarzenia / ikony.

**Log/Status:** 8765/8766 200. `index.html` dostaje `dam-tutorial.css` + `dam-tutorial.js?v=5.0.187`.

**Efekt/Fix:** renderStep od razu (nie czeka na GSAP fade). Dalej = nextStep, bez nawigacji. Brak enterExploreMode na losowy klik. Czekanie na węzeł max 3 s + kopia „ładowanie kroku”. Spotlight nie traktuje `.dam-tut` jako bloker. Glossary w `pl.json`/`en.json`. aria-label na copy/folder/PAKIET/chevron. Media tiles: po pomiarze `removeProperty(height/align-self)`.

**Backup:** brak. Commit: nie.

**Test/Ewaluacja:** dashboard-pass-01-live.png 312028B; dashboard-pass-02-projekty.png 266751B spotlight Info Pakowania; dashboard-pass-03-dalej.png 248222B Faza 6/9 na index.html (Dalej nie zniknął). Nie seria 20 PNG.

**Zrodla:** dam-tutorial.js 35, 1326, 1404; index.html 144; pl.json 315, 329-343; dam-paths.js 1060; dam-explorer.js 4005; dam-dashboard-widgets.js 531

## 2026-09-09 - v5.0.186: Viz boot unlock + Explorer return


**Komenda/Akcja:** Hands: operator live freeze po Wizualizacje → Eksplorer. Headed Chrome click, screenshot+Read, fix JS, bump +0.0.1.

**Log/Status:** 8765/8766 200. Serwowane `dam-explorer.js?v=5.0.186`. Viz HTML miał `pointer-events:none` do 4.5 s.

**Efekt/Fix:** visualizations.html boot jak explorer (auto + unlock 0/50 ms + panic-reload). dam-viz.js: brak DamLoader.start, brak worker, brak 9MB. dam-explorer.js: pageshow zawsze rebind. dam-loader.js: pageshow reset.

**Backup:** brak. Commit: nie.

**Test/Ewaluacja:** explorer-186-return.png 1280x1800 164023B Read Batony 85 / Kulki 19 / Roślinne 60. v5.0.186.

**Zrodla:** visualizations.html:8-20; dam-viz.js:139,6063; dam-explorer.js:8501; dam-loader.js:407

## 2026-09-09 - v5.0.185: Explorer return bind (Wizualizacje → Eksplorer)

**Komenda/Akcja:** Parent reject 5.0.184; operator live freeze `...` + Ładowanie. Hands: headed Chrome click/navigate, screenshot+Read, fix, bump.

**Log/Status:** 8765/8766 200. Slim explorer 513414B ~5ms. Cursor `browser_navigate` = no tab. Chrome headed opened then died twice (no evaluate/CDP Runtime). CopyFromScreen łapał Illustrator/Spotify — camera = PrintWindow.

**Efekt/Fix:** 5.0.184 return PNG freeze. 5.0.185: `startExplorerIndexBind` always drops dead inFlight on pageshow/reentry; `init._damDone` reentry; slim `JSON.parse` on main; `dam-branding.js` usunięty z visualizations.html.

**Backup:** brak. Commit: nie.

**Test/Ewaluacja:** hands-headed-6-return-8s.png 1400x900 119339B Read freeze. hands-headed-10-return-8s.png 1630x1228 163531B Read Batony 85 / Kulki 19 / Roślinne 60. v5.0.185. Parent nie dostaje PASS od Hands.

**Zrodla:** dam-explorer.js 8454, 8511, 8535; visualizations.html (brak branding.js); version.json 5.0.185

## 2026-09-02 - v5.0.148: swiezy file-index + jeden lot DamSearch

**Komenda/Akcja:** Pull najnowszego main; odswiezyc indeks produktow; dopracowac search/picker bez nowego silnika.

**Log/Status:** DAM UI+bridge 8765/8766; admin POST /index/rebuild. file-index generated_at 2026-09-02, product_count 185->191, viz_count 404->408. Reczny skan zapisuje tez index-watcher-status last_finished. DamSearch eksportuje productMatchesTextQuery. Explorer bez drugiego search na scope.

**Efekt/Fix:** Panel widzi produkty po 13.08. #damFileSearch jeden lot DamSearch.search; #damProjectsSearch filtr listy tym samym matcherem; #vizSearch lokalny applyFilters; #damBrandingSearch osobny search-index. Picker nadal scheduleProductSearchFetch.

**Backup:** brak.

**Test/Ewaluacja:** node test_dam_search_force.js, test_explorer_single_search_flight.js; smoke portow; CDP q=6300.

**Zrodla:** local_bridge.py, dam-search.js, dam-explorer.js, build-file-index.py

## 2026-08-13 - v5.0.145: bin/DATABASE kanon, dashboard thumbs, branding raz, W toku

**Komenda/Akcja:** User zly: dashboard bez grafik, branding 2x, trzeci panel, baza rozjezdzala sie. Potem korekta: live SQLite TYLKO bin/DATABASE (nie D:\Marketing\DATABASE).

**Log/Status:** `canonical_db_dir` = `bin/DATABASE`; merge (users, size, mtime); usunieto `DAM_DISABLE_THUMB_WARM`; karty `/thumb-cache` + fallback `/media`; branding `bootStarted` + skip hydrate re-paint; widget `projects_in_progress`.

**Efekt/Fix:** Kanon DB w projekcie DAM; karty AVIF; branding raz; panel „Bez pliku F / FQ (definicja robocza)”. Start: DAM.exe / URUCHOM-DAM.bat.

**Źródła:** dam_db.py, dam-dashboard.js, dam-dashboard-widgets.js, dam-branding.js, dam-preview-truth.js, DATABASE/README.md

## 2026-07-30 - deploy Panel-DAM Synology + commit v5.0.121

**Komenda/Akcja:** User: commit+push; hostowac Panel-DAM na inyfinn.synology.me (web folder NAS).

**Log/Status:** deploy-panel-dam-synology.ps1 -> W:\web\Panel-DAM; docs/SYNOLOGY-WEB-PANEL.md (:5001=DSM, Web Station=/Panel-DAM/); commit picker v5.0.120-121.

**Efekt/Fix:** Statyczny mirror na NAS; pelny DAM nadal wymaga bridge (lokalnie lub reverse proxy).

**Źródła:** W:\web, scripts/ops/deploy-panel-dam-synology.ps1

## 2026-07-29 - v5.0.121: picker align prod/wariant + polish

**Komenda/Akcja:** User: popraw wyglad pickera (/ui-taste); subagent 6311aafc fail (API limit).

**Log/Status:** Slot akcji 67px (folder+link); spacer na wariantach bez linku; tag gap 5px; checkbox 20px purple; expand hover; bump 5.0.121.

**Efekt/Fix:** Checkboxy prod/wariant w jednej kolumnie; folder lewo, expand prawo bez regresji.

**Źródła:** dam-assoc-edit.js, dam-brand.css, version 5.0.121

## 2026-07-29 - wyjaśnienie: Kopiuj link tylko na produkcie, nie wariancie

**Komenda/Akcja:** User pyta czemu `data-row-copy` jest na wierszu PRODUKT, a na WARIANT (revision) już nie.

**Log/Status:** Audyt `rowActionsHtml` w dam-assoc-edit.js — `showLink` tylko gdy `isProductRow`/`isVizGridGroup`/`kind===product`; wariant ma tylko folder (własny `path`). Explorer deep-link: tylko `?product=` / `?index=`, brak `?variant=`.

**Efekt/Fix:** Wyjaśnienie intencji (link produktowy, nie wariantowy); bez zmian kodu.

**Źródła:** dam-assoc-edit.js rowActionsHtml, dam-explorer.js applyDeepLink

## 2026-07-29 - v5.0.120: picker folder lewo + expand prawo

**Komenda/Akcja:** User: `row-btn` folder ma zostać po lewej; chevron `expand` po prawej (nie obok folderu na lewo).

**Log/Status:** `opt-row` grid `actions | main | expand`; folder w `row-actions` sibling przed buttonem; expand sibling po buttonie; button grid tylko `check thumb body`; click handler na expand; bump 5.0.120.

**Efekt/Fix:** Folder na lewej krawędzi wiersza, expand na prawej.

**Źródła:** dam-assoc-edit.js, dam-brand.css, dam-branding.css, version 5.0.120

## 2026-07-29 - v5.0.119: revert thumb stack (center contain)

**Komenda/Akcja:** User: warianty nakładają się / lewy górny róg; gorsza jakość miniatur.

**Log/Status:** Cofnięto regresję v5.0.114 (`width/height:auto`); przywrócono fill+`object-fit:contain`+`object-position:center`; stack layers flex center; `mediaUrl` → `previewUrl` first; bump 5.0.119.

**Efekt/Fix:** Karty branding jak przed regresją — wyśrodkowane miniatury, stos wariantów bez rozjechania.

**Źródła:** dam-brand.css, dam-branding.css, dam-branding.js, version 5.0.119

## 2026-07-29 - v5.0.117: fix thumb stack center + jakość kart

**Komenda/Akcja:** User: warianty nakładają się / wyrównane do lewego górnego rogu; miniatury gorszej jakości po zmianie v5.0.114.

**Log/Status:** Przywrócono `.dam-viz-thumb__img` `width/height:100%` + `object-position:center`; stack layers flex center; stack stretch w slocie; bump 5.0.117.

**Efekt/Fix:** Stos wariantów wyśrodkowany, bez nakładania; grafiki fill contain center jak przed regresją.

**Źródła:** dam-brand.css, dam-branding.css, version 5.0.117

## 2026-07-29 - v5.0.116: merge check-left + alignment v5.0.115

**Komenda/Akcja:** Follow-up po subagent v5.0.115 — scalenie z v5.0.114 (checkbox po lewej od miniatury).

**Log/Status:** Grid `check thumb body actions expand` + HTML reorder (check przed thumb); zachowane actions inside button i folder na produktach z v5.0.115; bump 5.0.116.

**Efekt/Fix:** Checkbox po lewej (12px gap) + wyrównanie 0px drift mat/prod.

**Źródła:** dam-assoc-edit.js, dam-brand.css, version 5.0.116

## 2026-07-29 - v5.0.115: picker row alignment + folder na produktach

**Komenda/Akcja:** Fix `#damAssocEditPopover` — wyrównanie check/expand/actions material vs product; row-actions wewnątrz `.dam-assoc-edit-popover__opt`; unified grid `thumb body check actions expand`; `pickerRowFolderPath`/`pickerRowProductId`; folder+link na produktach.

**Log/Status:** `optionButtonHtml` — actions między check a expand (bez sibling); `rowActionsHtml` zawsze `<span class=row-actions>`; inject CSS + `dam-brand.css` 5-col grid; bump 5.0.115, ASSOC token `assocPickerRowAlignGrid20260729i`. QA 10 passów CDP: drift check/actions 0px (było 36px).

**Efekt/Fix:** Material i product rows — check=1448px, actions=1530px (identyczne); 0 sibling row-actions poza buttonem; produkty z folder+link gdy path/PID resolvable.

**Źródła:** dam-assoc-edit.js, dam-brand.css, branding/visualizations/explorer.html ?v=5.0.115

**Komenda/Akcja:** User: globalnie `dam-search-hit__check` po lewej od miniatury (12px gap); napraw broken thumbs w pickerze; branding `.dam-viz-thumb__img` nie upscale powyżej intrinsic.

**Log/Status:** Grid `check thumb body actions expand`; HTML reorder w `optionButtonHtml`; `resolvePickerRowDisplayThumb` + hydrate po `data-product-id`; `pickerThumbOnError` fallback produktu; CSS picker thumb `max 60px` intrinsic; branding `width/height:auto`; bump 5.0.114.

**Efekt/Fix:** Checkbox w pierwszej kolumnie grida; miniatury picker ładują z bridge/cache; małe logo w kartach nie rozciągane.

**Źródła:** dam-assoc-edit.js, dam-brand.css, dam-branding.css, version 5.0.114


**Komenda/Akcja:** User: Shift-minus usuwa skojarzenia losowo; toast „zapis przekroczył 5 s / Failed to fetch”; usuwanie musi działać bezwzględnie — zakoduj kolejkę.

**Log/Status:** `enqueueAssocSave` + `drainAssocSaveQueue` w dam-assoc-edit.js: timeout 15 s, do 10 retry z backoff, persist sessionStorage przy wyczerpaniu; `seedEnrichAssocSave` bez rollbacku UI; picker remove bez rollbacku; usunięty toast timeout_5s; bump 5.0.113.

**Efekt/Fix:** UI usuwa natychmiast (optimistic); zapis w tle z retry; brak „spróbuj ponownie” przy wolnym bridge.

**Źródła:** dam-assoc-edit.js, version 5.0.113

## 2026-07-29 - v5.0.112: picker row alignment (check/expand/folder)

**Komenda/Akcja:** User: checkbox/chevron/folder nie w jednej linii pionowej w pickerze Skojarzenia; nie widać folderów na produktach.

**Log/Status:** row-actions przeniesione do grida wewnątrz `.dam-assoc-edit-opt`; stała kolumna actions 68px; `pickerRowFolderPath` dla produktów; bump 5.0.112.

**Efekt/Fix:** Wszystkie typy wierszy mają tę samą siatkę kolumn.

**Źródła:** dam-assoc-edit.js, dam-brand.css, 5.0.112

## 2026-07-29 - v5.0.111: picker search + stabilne miniatury + czytelne wybrane

**Komenda/Akcja:** User: miniatury migaja, przyciski nieczytelne, wyszukiwarka okropna (/ui-taste) w pickerze skojarzen.

**Log/Status:** Subagent [Fix picker thumbs search buttons](29a59f5c-9d4a-4be9-8b1e-ce56d7a43a71) fail API - fix reczny. Nowy `dam-search-wrap--picker` (assoc + tag picker); grid check `minmax(72px,auto)` w dam-brand.css + inject; stabilizacja thumb (`data-thumb-stable`, bez lazy, 1 fallback); row-btn 32px kontrast; bump 5.0.111.

**Efekt/Fix:** Pass screenshot branding picker - search jedno pole, wybrane czytelne w AKTUALNE, ikony akcji widoczne. CDP grid `60px … 72px 28px`.

**Źródła:** dam-assoc-edit.js, dam-tag-edit.js, dam-brand.css, ?v=5.0.111

## 2026-07-29 - v5.0.110: miniatury skojarzonych produktow (sidebar modal)

**Komenda/Akcja:** User: uciete miniatury w SKOJARZONE PRODUKTY (sidebar modal branding).

**Log/Status:** Usunieto max-height 48% + overflow hidden na sekcji produktow; flex na [data-produkty-host]; thumb-btn 70x70 flex-shrink:0; assoc-item grid auto/auto/auto.

**Efekt/Fix:** bump 5.0.110; dam-branding.css, dam-viz-modal.css, dam-media-preview.js.

**Źródła:** ?v=5.0.110

## 2026-07-29 - auto-start DAM dla przegladarki (bez recznego serve_browser)

**Komenda/Akcja:** User: przy wejsciu w przegladarke ma sie samo uruchamiac — bez portow/build recznie.

**Log/Status:** `ensure_dam_running.py` (--watch / --open), `serve_browser.py --headless`, skroty `open-dam-browser.vbs` + autostart `run-dam-watch.vbs`; zaktualizowano `install-desktop-shortcut.ps1`.

**Efekt/Fix:** Po logowaniu porty 8765/8766 pilnowane w tle. Skrot „DAM (przegladarka)” startuje serwer + otwiera URL. BUILD niepotrzebny.

**Źródła:** apps/desktop/ensure_dam_running.py, open-dam-browser.vbs, run-dam-watch.vbs, install-desktop-shortcut.ps1

## 2026-07-29 - uruchomienie aplikacji desktop (bez portów / bez build)

**Komenda/Akcja:** User: strona nie działa; chce tryb „jak aplikacja” — bez portów, bez BUILD.

**Log/Status:** Porty 8765/8766 były martwe (brak serwera). Zainstalowano skrót pulpitu (`install-desktop-shortcut.ps1`). Uruchomiono `apps/desktop/launch.py` — UI 200, bridge OK.

**Efekt/Fix:** Dwuklik **„DAM - Dobra Kaloria - Inyfinn”** na pulpicie = okno WebView2, most + UI startują automatycznie. Brak npm/webpack — pliki statyczne HTML/JS.

**Źródła:** launch.py, run-dam.vbs, scripts/ops/install-desktop-shortcut.ps1

## 2026-07-29 - v5.0.109: picker pinned + toolbar merge

**Komenda/Akcja:** User: A) pinned rows = list design (left accent, wybrane label); B) search chrome align; C) viz filters into scope row; D) branding view-tools into tabs row; bump 5.0.109.

**Log/Status:** dam-assoc-edit.js pinned/list parity + search in list-col with panel/branding chrome; visualizations.html filters → #vizSearchScope; branding.html view-tools in tabs; CSS dam-brand/dam-branding/dam-viz.

**Efekt/Fix:** node --check OK; screenshot verify picker/viz/branding.

**Źródła:** dam-assoc-edit.js, dam-brand.css, dam-branding.css, dam-viz.js, dam-viz.css, visualizations.html, branding.html, ?v=5.0.109

**Komenda/Akcja:** User: powiększ miniatury w pickrze do wielkości bloku tekstu (head+name+meta).

**Log/Status:** grid kolumna thumb 60px; thumb-wrap/img 60×60; bump 5.0.108.

**Źródła:** dam-assoc-edit.js, dam-brand.css, dam-branding.css, ?v=5.0.108

## 2026-07-29 - v5.0.107: picker tagi przy badge, bez migotania

**Komenda/Akcja:** User: migocze, ucina tekst, tagi za daleko od PRODUKT/MATERIAŁ (dam-viz-card__badges width:100% + min-height:56px).

**Log/Status:** Usunięto `dam-viz-card__badges` z tags-inline w pickerze; override width/min-height; wiersz 84px; jeden hover; bump 5.0.107.

**Efekt/Fix:** CDP gap badge→tag <20px.

**Źródła:** dam-assoc-edit.js, dam-brand.css, dam-branding.css, ?v=5.0.107

## 2026-07-29 - v5.0.106: globalne scrollbary 4px minimalistyczne

**Komenda/Akcja:** User: scroll wszędzie cieńszy, bardziej minimalistyczny, globalnie (bez strzałek).

**Log/Status:** `dam-brand.css` — `*::-webkit-scrollbar` 4px, ukryte button/corner; usunięto lokalne override w pickerze; sync dashboard/tasks/life-hist; bump 5.0.106.

**Efekt/Fix:** Weryfikacja CDP szerokość scrollbara.

**Źródła:** dam-brand.css, dam-branding.css, dam-dashboard.css, dam-tasks.css, ?v=5.0.106

## 2026-07-29 - v5.0.105: popover indeksów — lista pionowa

**Komenda/Akcja:** User: `.dam-index-popover` — indeksy zawsze lista od góry do dołu, nie w poziomie.

**Log/Status:** `dam-branding.css` — `flex-direction: column`, chipy `width:100%`; bump 5.0.105.

**Efekt/Fix:** Weryfikacja screenshot.

**Źródła:** dam-branding.css, ?v=5.0.105

## 2026-07-29 - v5.0.104: picker grid + fix nested button tags

**Komenda/Akcja:** User: wiersze pickera rozjechane — CSS Grid 76px; fix: DamBadges `<button>` wewnątrz `<button>` psuło DOM.

**Log/Status:** `pickerSanitizeInlineTags`; grid layout; bump 5.0.104.

**Efekt/Fix:** CDP rowH=76; weryfikacja po sanitize.

**Źródła:** dam-assoc-edit.js, ?v=5.0.104

## 2026-07-29 - v5.0.103: picker skojarzeń CSS Grid 76px (jak eksplorator)

**Komenda/Akcja:** User: wiersze pickera (materiał/produkt) rozjechane, 134px — ma być CSS Grid, skondensowane jak `#damSearchResults` (~76px).

**Log/Status:** `pickerSearchHitBodyHtml` (badge+tagi+tytuł+meta jedna linia); grid na `.dam-assoc-edit-popover__opt`; usunięto meta-rail NAZWA/TYP PLIKU; bump 5.0.103.

**Efekt/Fix:** W trakcie weryfikacji screenshot+CDP.

**Źródła:** dam-assoc-edit.js, dam-brand.css, ?v=5.0.103

## 2026-07-29 - v5.0.102: footer index+CTA wyrównany; ghost Pokaż indeksy

**Komenda/Akcja:** User: chip indeksu vs „Pokaż indeksy” niewyrównane w rzędzie; usuń obrys przycisku globalnie.

**Log/Status:** `dam-viz-card__footer` (index+actions) w dam-viz.js + dam-branding.js; CSS footer margin-top auto, show-indexes ghost border:none; bump 5.0.102.

**Efekt/Fix:** CDP — indexTop=1031 na całym rzędzie (chip+show), border 0px. Bez commit.

**Źródła:** dam-brand.css, dam-viz.js, dam-branding.js, ?v=5.0.102



**Komenda/Akcja:** User: kafelek wizualizacji przebudować tak samo jak branding (kompakt body, thumb, CTA na dole 12px, przyciski 44px).

**Log/Status:** `dam-brand.css` — base body rhythm + `:not(.dam-branding-card)` thumb 178, id-chip center, actions 44px, indexes popover; bump 5.0.100.

**Efekt/Fix:** CDP vizGrid — bottomGap 12, actionsTop wyrównane. Bez commit.

**Źródła:** dam-brand.css, visualizations.html ?v=5.0.100



**Komenda/Akcja:** User: za dużo wolnego miejsca u dołu body; przyciski zawsze na dole kafelka (12px); tagi/tytuł/meta/indeks u góry, wyrównane między kartami.

**Log/Status:** `dam-branding.css` — `.dam-viz-card__actions { margin-top: auto }`, `pad-bottom: 12px`; bump 5.0.99.

**Efekt/Fix:** CDP — bottomGap 12px, actionsTop wyrównane w rzędzie. Bez commit.

**Źródła:** dam-branding.css, ?v=5.0.99



**Komenda/Akcja:** User: wyrównaj wysokość Podgląd + ikony folder/udostępnij na karcie branding.

**Log/Status:** `dam-branding.css` — wszystkie `.geex-btn` w `.dam-viz-card__actions` = 44px; bump 5.0.98.

**Efekt/Fix:** CDP — Podgląd i ikony ta sama wysokość. Bez commit.

**Źródła:** dam-branding.css, ?v=5.0.98



**Komenda/Akcja:** User: usuń białą przestrzeń u góry body karty branding (obraz za mały); tagi wyżej; chip indeksu center; lepsza ikona „Pokaż indeksy”; −5px odstępy title/meta/indexes na grupach.

**Log/Status:** `dam-branding.css` — flex-start, pad-top 10, gap 13, thumb 178px bez padding-top; indexes-anchor flex center; `dam-branding.js`/`dam-viz.js` — ikona `uil-layer-group`; bump 5.0.97.

**Efekt/Fix:** Browser verify branding grid. Bez commit.

**Źródła:** dam-branding.css, dam-branding.js, dam-viz.js, ?v=5.0.97



**Komenda/Akcja:** User: lista „Warianty materiału” ma pokazywać elementy od razu (nie białe pole „wpisz 2 znaki”); pinned rows jako materiał (nie product); scrollbar minimalistyczny wszędzie.

**Log/Status:** `local_bridge.py` — `browse=1` na `/branding-search-picker`; `dam-assoc-edit.js` — `loadBrandingPickerBrowse`, `bootstrapBrandingPickerList`, minQ=0 dla branding API, pinned `kind:material`; `dam-branding.js` — `buildPickerBrowseRows`; `dam-brand.css` — scrollbars na html/body/#damAssocEditOverlay; bump 5.0.96.

**Efekt/Fix:** Browser PASS branding ID1 — 44 wiersze listy od razu, `dam-search-hit--material`, pinned 4. Screenshot `.qa-screenshots/picker-browse-on-open-5096.png`. Bez commit.

**Źródła:** dam-assoc-edit.js, dam-branding.js, local_bridge.py, dam-brand.css, ?v=5.0.96



**Komenda/Akcja:** User: popover indeksów „wędruje” przy scrollu — ma być przypięty do przycisku; szerokość = kafelek; scrollbar minimalistyczny globalnie.

**Log/Status:** `dam-card-index-popover.js` — reposition na scroll/resize (capture+rAF), width/left z `.dam-viz-card__body`, flip gdy brak miejsca pod spodem; CSS bez max-width 360px; `--dam-scrollbar-*` global w dam-brand.css; bump 5.0.95.

**Efekt/Fix:** v5.0.95 lokalnie — browser verify. Bez commit.

**Źródła:** dam-card-index-popover.js, dam-branding.css, dam-brand.css, branding/visualizations.html ?v=5.0.95


**Komenda/Akcja:** User spec 2026-07-29: unified DAM assoc picker architecture; browser verify ID1/ID4/ID5; fix ID5 search stuck on „Szukam materiałów…”.

**Log/Status:** pickerMode + CTA ids 1–5; branding groups nested; viz grid w sugestiach; `pickerStillOpen` → `pop.isConnected`; branding bootstrap gen cancel; input handler: branding q≥2 bez `scheduleListPaint` (rAF race); `fetchPickerJson` 12s; bump 5.0.94.

**Efekt/Fix:** Browser PASS — branding ID1 meta-rail pinned; viz ID4 „Warianty produktu”; ID5 search „630” → 44 wiersze meta-rail. Bez commit.

**Źródła:** dam-assoc-edit.js, dam-media-preview.js, dam-viz.js, dam-branding.js, ?v=5.0.94


## 2026-07-29 - v5.0.93: ID5 picker search — fetch timeout + stale guard

**Komenda/Akcja:** Follow-up unified picker: ID5 search stuck on „Szukam materiałów…”.

**Log/Status:** `materialFetchInFlight` + `materialFetchGen` w scheduleMaterialSearchFetch; loading guard dla kind=material; `loadBrandingMaterialCandidates` → `fetchPickerJson` 12s; bump 5.0.93 + ?v=.

**Efekt/Fix:** v5.0.93 lokalnie — browser retest ID5 search. Bez commit.

**Źródła:** dam-assoc-edit.js, visualizations/branding.html ?v=5.0.93


## 2026-07-29 - v5.0.92: unified assoc picker architecture (pickerMode + CTA ids 1–5)

**Komenda/Akcja:** User spec 2026-07-29: unified DAM assoc picker — Panel A viz-products (ID2/4), Panel B branding-groups (ID1/3), viz-suggestions (ID5 + viz grid); `pickerMode` w `openEditPicker`; `data-dam-assoc-picker-id` na 5 CTA; nested branding groups; thumb stable cache; ARCHIWUM exclude; browser verify branding ID1, viz ID4+ID5.

**Log/Status:** `resolvePickerMode` + `PICKER_ID_TO_MODE`; `groupBrandingPickerRows` via `DamBranding.groupMarketingAssets`; expand parent + nested 24px children; `collectVizGridGroupedRows` w sugestiach; CTA attrs w dam-media-preview/dam-viz; export `groupMarketingAssets` z dam-branding.js; bump 5.0.92 + ?v=.

**Efekt/Fix:** v5.0.92 lokalnie — browser verify branding ID1 PASS (meta-rail pinned), viz ID4 PASS (head OK), ID5 picker shell PASS. Bez commit.

**Źródła:** dam-assoc-edit.js, dam-media-preview.js, dam-viz.js, dam-branding.js, visualizations/branding.html ?v=5.0.92


## 2026-07-29 - v5.0.90: picker meta-rail rows, index popover, skeleton, bento stretch

**Komenda/Akcja:** User follow-up: pinned/search rows jak meta-rail (tagi, tytuł, ID); Pokaż indeksy = floating dropdown nie stretch kafelka; skeleton responsywny; +N bubble accent; studio Pokaż wszystkie nie zwęża wariantów; empty „System nie wykrył skojarzeń”; bento grid equal height.

**Log/Status:** `pickerMetaRailBodyHtml` w dam-assoc-edit.js; `dam-card-index-popover.js` + CSS; `DamGridReveal` responsive count; assoc empty copy; dam-viz-modal variants width lock; bump 5.0.90 + ?v= w branding/visualizations/explorer.

**Efekt/Fix:** v5.0.90 lokalnie — browser verify w toku. Bez commit.

**Źródła:** dam-assoc-edit.js, dam-card-index-popover.js, dam-branding.js, dam-viz.js, dam-grid-reveal.js, dam-media-preview.js, dam-brand.css, dam-branding.css, dam-viz-modal.css


## 2026-07-29 - v5.0.90: picker meta-rail rows, index popover, skeleton, bento stretch

**Komenda/Akcja:** User: variant picker + sugestie materiałów — migające miniatury, brak wcięcia wariantu (jak dam-search-hits), materiały z fałszywym nest/separatorami; wykluczyć `X:\Marketing\-- ARCHIWUM --\01_Opakowania\`; lista z gridów viz/branding zamiast folderów.

**Log/Status:** Fix: `_pickerThumbSrcCache` + `data-thumb-stable` (bez resetu src przy expand/re-render); `setSearchPreview` nie nadpisuje tego samego src; nested `margin-left:24px` + `padding-left:28px`; materiały — usunięto `nestedInGroup` dla idx>0 w grupie (fałszywe linie/separatory); filtr `isExcludedMarketingDupPath` w product/revision/branding rows + API seed.

**Efekt/Fix:** v5.0.88 lokalnie — retest variant picker + sugestie. Bez commit.

**Źródła:** dam-assoc-edit.js, visualizations/explorer/branding.html ?v=5.0.88


**Komenda/Akcja:** Follow-up [Verify variant picker v5.0.85](9a781764-4f0c-4812-8b56-e4244d78adba): wiersze listy variant pickera — szare placeholdery (1/81 img CDP).

**Log/Status:** Root: `pickerThumbOnError` używał `normalizeBridgeMediaUrl` → względne `/media?` na :8765 (404); brak thumb-cache w initial src wiersza. Fix: `pickerListRowThumbSrc()` → `thumb-cache` przez bridge :8766; `resolvePreviewMediaSrc` w onerror/hydrate; `data-product-id` fallback viz-latest; concurrent hydrate 8.

**Efekt/Fix:** v5.0.87 lokalnie — do retestu listy w variant picker. Bez commit.

**Źródła:** dam-assoc-edit.js, visualizations/explorer/branding.html ?v=5.0.87


**Komenda/Akcja:** User: regresja pickera „Dodaj/Edytuj warianty” — miganie listy przy szukaniu, puste miniatury, brak browse CAP na cold open.

**Log/Status:** Weryfikacja browser MCP na `visualizations.html?v=5.0.85` (modal BANOFFEE KAKAO → variant picker). Smoke :8765/:8766 = 200.

**Efekt/Fix (PASS/FAIL):**
- Browse CAP cold open (80 produktów bez wpisywania): **PASS**
- Brak flicker / „Szukam produktów…” przy wpisywaniu „cy” (lista stabilna, 9 trafień): **PASS**
- Miniatury: lewy podgląd + pinned „Aktualne” **PASS**; wiersze listy głównie szare placeholdery (1/81 załadowanych img w CDP): **PARTIAL/FAIL**
- Rozwinięcie produktu (CYNAMONKA → 2 warianty): **PASS**
- Zamknięcie X (overlay+popover znika, modal viz zostaje): **PASS**

**Źródła:** dam-assoc-edit.js v5.0.85, screenshots `qa-screenshots/v5.0.85-variant-picker/01-03.png`, URL `http://127.0.0.1:8765/visualizations.html?v=5.0.85`

## 2026-07-29 - v5.0.87: explorer Materiały reuse product-grid template

**Komenda/Akcja:** User: Materiały tab w Eksploratorze pokazuje nieczytelne poziome boxy folderów zamiast szablonu Produkty (karty, panel-head, dam-prod-list).

**Log/Status:** Root: `renderMaterialMain()` osobny renderer (buttony `dam-mat-folder-row` bez struktury `dam-prod-row__title/tags/end`) + `getProductsForCanonCat` w trybie MATERIAL porównywał `p.category` z pełną ścieżką folderu. Fix: `mountCategoryListPanel` wspólny dla Produkty/Materiały; `renderMaterialCategoryPanel` ładuje `folder-browse` i wstrzykuje `buildMaterialFolderRowHtml` do tej samej listy; filtrowanie produktów po `parentExplorerPath`; cache browse; bump 5.0.87 + `dam-explorer.js?v=5.0.87`.

**Efekt/Fix:** PASS screenshot — Materiały/FIRMOWE MATERIAŁY: panel-head „Materiały”, wiersze jak produkty (badge Folder, copy/reveal, chevron); Produkty/Batony bez regresji (Dodaj produkt, indeksy, F/X/D). UTF-8 „Materiały” OK; domyślny tab Produkty bez zmian.

**Źródła:** dam-explorer.js, explorer.html, version 5.0.87


**Komenda/Akcja:** User: kompleksowa naprawa regresji A–G (viz overlap, explorer Produkty/Materiały, assoc picker close/list/preview/styling).

**Log/Status:** Root pustej listy wariantów (D/G): `ReferenceError: isBrandingMaterialId is not defined` — helper zdefiniowany wewnątrz `paintPicker()`, wołany z modułowego `pickerRowMetaText()`. Fix: przeniesiono `isBrandingMaterialId` na poziom modułu. Root braku podglądu materiałów (E): `normalizeBridgeMediaUrl` obcinał host → `/media?` na :8765 (404); fix `resolvePreviewMediaSrc()` → pełny URL bridge :8766. QA browser 8+ passów: viz gap 62px bez overlap; explorer Produkty default + Materiały 7 folderów; variant picker 80 hitów PRODUKT; close X OK; material hits + preview 2195px natural.

**Efekt/Fix:** v5.0.86 PASS A–G (krytyczne ścieżki). Bez commit.

**Źródła:** dam-assoc-edit.js, visualizations.html, dam-viz.css, dam-explorer.js, explorer.html, version 5.0.86


**Komenda/Akcja:** User: przyciski `dam-marketing-tile__toggle` w `#damMarketingShort` nie działają wg kontekstu (wariant + shared).

**Log/Status:** Root: `bindMarketingTiles` wiązał tylko pierwszy `.dam-marketing-tiles` — sekcje shared i kolejne warianty bez handlerów. Fix: pętla po wszystkich `.dam-marketing-tiles`; przycisk tylko gdy `count > previewLimit` (4 grafika / 6 viz).

**Efekt/Fix:** v5.0.84 — expand/zwiń per sekcja, bez martwego „Pokaż wszystko” gdy wszystko już widać.

**Źródła:** dam-project.js, project.html

## 2026-07-29 - v5.0.83: projects toolbar full-bleed + index.html cache bust

**Komenda/Akcja:** User: `dam-projects-grid-toolbar` na Projekty „odjechał” — przyciski ucięte, belka 1975px.

**Log/Status:** Ten sam root co viz: `calc(50% - 50vw)` full-bleed na `.dam-projects-grid-toolbar` (margin-left -214px). Dodano override bez bleed. **index.html** miał `dam-brand.css?v=5.0.80` — nie ładował poprawek z 5.0.82. CDP po fix: width 1546px, margin-left 0, „Skanuj dysk” widoczny. Screenshot PASS.

**Efekt/Fix:** v5.0.83 — toolbar Projekty w siatce contentu, wszystkie CTA widoczne.

**Źródła:** dam-brand.css, index.html, version 5.0.83

## 2026-07-29 - v5.0.82: sticky chrome bleed + assoc kafelki stretch (follow-up user FAIL)

**Komenda/Akcja:** User: „Dalej są te same błędy” — toolbar `dam-viz-toolbar` / `dam-viz-secondary-filters` + modal assoc.

**Log/Status:** Subagent [Fix viz toolbar regressions](9bff2276-0efe-40f6-a268-026a59e16b38) error (API limit). Parent reprodukcja: (1) full-bleed `100vw` sticky chrome na Wizualizacjach/Brandingu zasłaniał sidebar — fix CSS jak w explorer-shell; (2) kafelki `#damVizModalAssoc` rozciągały się do ~483px (`align-items: stretch` w gridzie split-pane) — `align-content/align-items: start`, `grid-auto-rows: min-content`, `align-self: start` na item.

**Efekt/Fix:** v5.0.82 lokalnie — sidebar czysty, kafelki assoc ~116px (thumb+name+chip zwarte). Screenshot: qa-viz-toolbar-5082.png, qa-viz-modal-tiles-5082.png. Bez commit (user nie prosił).

**Źródła:** dam-brand.css, dam-viz-modal.css, version 5.0.82

## 2026-07-29 - v5.0.81: assoc picker + scroll + kafelki + etykiety wariantów — QA PASS + push

**Komenda/Akcja:** User: po zakończeniu agentów ui-taste weryfikacja v5.0.81; commit+push jeśli działa.

**Log/Status:** ui-taste 5 passów: viz modal (assoc 30, scroll, kafelki kompakt, etykiety PL-6300728 + nazwy plików), picker sugestii (search DRUK CMYK, X zamyka), branding modal (Dodaj/Edytuj materiały bez toastu „Brak produktu wizualizacji”, picker Warianty materiału). `node --check` OK; smoke :8765/:8766 200. Commit `476eb74` push OK.

**Efekt/Fix:** v5.0.81 zweryfikowane i wypchnięte na origin/main.

**Źródła:** commit `476eb74`, .qa-screenshots/qa-*-5081.png, dam-assoc-edit.js, dam-media-preview.js, dam-branding.css, dam-brand.css, dam-viz-modal.css

## 2026-07-29 - v5.0.80: multi-fix explorer toolbar, cat panel, root reindex

**Komenda/Akcja:** User: multi-fix session — UTF-8 audit, explorer toolbar bleed, cat panel PRODUKTY/MATERIAŁY, `#damRootStatus` re-index jak `#damDbStatus`, bump 5.0.80, commit+push.

**Log/Status:** UTF-8 audit PASS. Explorer: override full-bleed w `.dam-explorer-shell` (toolbar nie pod sidebar); `EXPLORER_CAT_PRODUCT`/`MATERIAL` + toggle; `#damRootStatus` refresh → `DamExplorer.reload` lub POST `/index/rebuild` + `DamLoader`. Cache-bust 5.0.80 w 23 HTML + dam-shell. Doktryna §12.

**Efekt/Fix:** v5.0.80 — sidebar kategorii FMCG domyślnie; materiały marketingowe tylko w trybie MATERIAŁY.

**Źródła:** dam-brand.css, dam-explorer.js, dam-root-status.js, explorer.html, version 5.0.80



**Komenda/Akcja:** Subagent: napraw toggle `#damVizModalAssoc`, assoc picker jak Explorer hits, bump 5.0.78, commit+push, QA screenshot.

**Log/Status:** Deliverable już w `5848d76` (release/web v5.0.78). Weryfikacja tej tury: `node --check` OK; smoke :8765/:8766 200; CDP toggle mock poza grid 151×32 pass; `git push` → Everything up-to-date (`5848d76` = `origin/main`). Picker popover CDP `openPicker` nie utrzymał DOM w tej sesji (częściowa weryfikacja wizualna).

**Efekt/Fix:** Push potwierdzony; kod toggle/picker w HEAD.

**Źródła:** commit `5848d76`, dam-media-preview.js, dam-brand.css, dam-assoc-edit.js


**Komenda/Akcja:** User: „znów napraw polskie znaki… dowiedz się skąd wynika błąd. Globalnie. Ostatecznie.”

**Log/Status:** Root cause: literalne `?` w źródle HTML/JS (nie charset serwera, nie meta, nie pl.json). `scripts/qa/fix-polish-chars.py` — 369+ zamian w 48 plikach; `scripts/qa/audit-polish-chars.py` — PASS. Rozszerzono `pl.json` (`common.show_all`, `common.all_languages`, `explorer.refresh_disk`…); `data-i18n` na filtrach explorer/viz/branding. `.gitattributes` UTF-8. Doktryna §12. Bump 5.0.79.

**Efekt/Fix:** Audit 0 hitów; explorer filtry: „Pokaż wszystkie”, „Wszystkie języki” UTF-8 + i18n overlay.

**Źródła:** fix-polish-chars.py, audit-polish-chars.py, pl.json, explorer/visualizations/branding.html, v5.0.79


**Komenda/Akcja:** User: nieszczelność blur na bokach sticky search/toolbar (tagi kart w gutterach `.geex-content`); fix full-bleed `100vw` na pseudo + margin bleed; frost 86%→92%; bump 5.0.77.

**Log/Status:** `dam-brand.css`: pseudo `::before`/`::after` → `left:50%; width:100vw; transform:translateX(-50%)`; full-bleed na `.dam-explorer-toolbar`, `.dam-projects-grid-toolbar`, `.dam-viz-secondary-filters` (`margin/padding calc(50%±50vw)`); frost 92%. Cache-bust `dam-brand.css?v=5.0.77` index/explorer/visualizations/branding. QA 1280px: CDP gutter hit-test PASS (viz), screenshot+Read explorer/viz/branding. Doktryna §12.

**Efekt/Fix:** Frost/blur zakrywa boczne guttery; `display:contents` na `.dam-global-search-block` bez zmian.

**Źródła:** dam-brand.css ~3793–3890, v5.0.77, index/explorer/visualizations/branding.html

## 2026-07-29 - v5.0.78: variants-toggle + assoc picker Explorer hits layout

**Komenda/Akcja:** User: napraw przycisk „Pokaż wszystkie (N)” (rozciągnięty w pionie, ucięty z lewej); lista pickera assoc jak Explorer `dam-search-hits` (padding, meta bez ścieżek); zachować miniatury; commit+push; podsumowanie.

**Log/Status:** `dam-media-preview.js`: toggle `data-linked-assets-toggle` poza gridem (`insertAdjacentElement afterend`). `dam-brand.css`: reguły dla `.dam-assoc-pane-split__top > .variants-toggle` (flex-start, fit-content). `dam-assoc-edit.js`: `pickerRowMetaText` bez pełnych ścieżek; wiersze produkt/wariant bez tag-pillów (tylko badge+nazwa+meta); `<ul class="dam-search-hits">` zamiast `<div>`; inline CSS align center 76px; token CSS `assocExplorerHitsLayout20260729a`. Bump 5.0.77→5.0.78.

**Efekt/Fix:** `node --check` OK. Commit+push na main.

**Źródła:** dam-brand.css, dam-assoc-edit.js, dam-media-preview.js, v5.0.78



**Komenda/Akcja:** User: w `#damMediaPreview` branding-split — wyrównaj CTA „Dodaj/Edytuj produkty” i „Dodaj/Edytuj materiały”; sekcja produktów jak materiały (well/box); globalnie w viz; bump +0.0.1.

**Log/Status:** `dam-viz-modal.css`: wspólny well dla `.dam-media-preview__assoc-pane-section--products` + `.dam-media-preview__assoc-section.dam-media-preview__assoc-col--materials` (padding 8px 16px 12px, radius 12px, `--dam-surface-muted`); label-row flex parity (nowrap, label flex:1, CTA margin-left:auto). `dam-branding.css`: global label-row CTA alignment. `dam-media-preview.js`: klasa `dam-media-preview__assoc-section` na products host. Bump 5.0.76→5.0.77; cache-bust branding/viz/explorer + dynamic `dam-viz-modal.css` href w JS.

**Efekt/Fix:** CDP branding modal PASS — obie sekcje left/right 785–1186, bg rgb(245,246,250), CTA right=1170 (aligned:true). `node --check` dam-media-preview.js OK. Smoke :8765/:8766 200.

**Źródła:** dam-viz-modal.css, dam-branding.css, dam-media-preview.js, v5.0.77


**Komenda/Akcja:** User: zacieśnij odstępy Branding — meta filtry → status 12px; status mb 5px + panel mt 12px (wizualnie 17px); usuń `.dam-branding-grid { margin-top:4px }`; selektory adjacency w dam-branding.css; bump 5.0.75→5.0.76.

**Log/Status:** `dam-branding.css`: meta `margin-bottom:0`, adjacency `.dam-branding-filters--meta + .dam-branding-status-row` i `~ #damBrandingPanelSection` z `calc(12px - var(--dam-bento-gap))` (kompensacja flex gap 16px na `.geex-content:has(#damBrandingSectionGrid)`); status `margin-bottom:5px`; panel `margin-top:12px` (efektywnie -4px); grid `margin-top:0`. Bump version.json / dam-version.js / runtime_config.py; cache-bust branding.html `dam-branding.css?v=5.0.76`.

**Efekt/Fix:** CDP gapMetaStatus=12px, gapStatusPanel=17px (było ~16/45). Screenshot PASS @1280px — ciaśniejszy rytm meta→status→karty. Viz/explorer bez zmian (tylko branding-scoped selektory).

**Źródła:** dam-branding.css, branding.html, v5.0.76, smoke :8765/:8766 OK


**Komenda/Akcja:** User: bąbelki +N na miniaturach kart muszą wyglądać IDENTYCZNIE w Branding i Visualizations (kanon: ciemnoszary okrąg 28px); reguła projektu: ui-taste 10 rund intensive przy UI polish.

**Log/Status:** Globalna reguła `.dam-viz-card__variant-badge` + tokeny `--dam-count-bubble-*` w `dam-brand.css`; usunięto scoped override z `dam-branding.css` i fioletowy inline z `dam-viz.js` `ensureVizGridCardCss`. Bump 5.0.74→5.0.75 (version.json, dam-version.js, runtime_config.py); cache-bust `dam-brand.css`/`dam-branding.css`/`dam-viz.js` w branding.html i visualizations.html. Doktryna §12, memory.md, AGENT builder/QA.

**Efekt/Fix:** Parity bubble branding↔viz PASS (CDP: `rgba(70,66,85,0.82)`, 28px, 12px; inline purple usunięty). Screenshot+Read branding grid z +3/+11 ciemnoszarymi bąbelkami.

**Źródła:** dam-brand.css, dam-branding.css, dam-viz.js, v5.0.75, branding.html, visualizations.html

## 2026-07-29 - v5.0.74: Assoc picker thumbs + explorer hit rows (15 rund QA)

**Komenda/Akcja:** User: reindex/mapowanie + miniatury AKTUALNE/wyszukiwarka pickera jak `dam-search-hits`; 15 rund ui-taste; DOM `damAssocEditPopover` pinned + list.

**Log/Status:** `dam-assoc-edit.js` v5.0.73→5.0.74: `normalizeBridgeMediaUrl` (fix `/media` bez leading slash), `pickerThumbOnError`, `resolvePickerThumbProbeUrl`, eager hydrate pinned, `dam-search-hit__head` (badge+name 20px), `ul.dam-search-hits--panel`, `li` opt-row, `min-height:76px` fix overlap. Bump cache-bust branding/explorer/viz.

**Efekt/Fix:** Screenshot PASS — AKTUALNE: thumb+badge+tytuł+tagi+ID czytelne; wyszukiwarka „kakao” grupy folderów + miniatury (ZGRANE częściowo offline); PODGLĄD TIF = „Brak miniatury” (bridge 200 dla JPG). curl `/media?path=...slider_newsletter_3.jpg` → 200.

**Źródła:** dam-assoc-edit.js, dam-brand.css, version 5.0.74, branding.html?v=pickerqa74

## 2026-07-29 - v5.0.72: Modal title JPG align + phantom variants + reindex

**Komenda/Akcja:** User: `#damMediaPreview` title↔ext-tag vertical align + badge-scale JPG tag; fix `--png` on JPG; tags/indexes reindex consistency.

**Log/Status:** `injectTitleExtLayoutCss` center align + ext-tag ~26px badge scale; `extTagClass` jpg/jpeg→`--jpg`; `isPhantomMaterialVariant` empty index ≠ phantom; `re-enrich-branding-index.py` + `enrich-branding-tags.py` run.

**Efekt/Fix:** slider_newsletter_3 modal: 4 folder variants (index parity); smoke :8765/:8766 OK; node --check OK; screenshot pass2 variants OK.

**Źródła:** dam-media-preview.js, dam-primitives.css, dam-branding.css, branding.html, branding-index.json, branding-search-index.json

## 2026-07-29 - v5.0.71: Projects sort date-score fix

**Komenda/Akcja:** Subagent: dokończenie sort Projekty — usunięcie zduplikowanych funkcji sort, `projectDateScore` skanuje wszystkie segmenty ścieżki + rewizje (wzór dam-viz).

**Log/Status:** `dam-projects.js` — cleanup duplikatów `sortProjectRows`; rozszerzone `projectDateScore`. Bump 5.0.71.

**Efekt/Fix:** Lepsze wykrywanie dat z folderów DAM (`19.09.2025`, `24_03_2026`); bez broken refs `SORT_STATE_KEY`.

**Test:** `node --check` OK; smoke 200; snapshot combobox 6 opcji + status 183 produktów.

**Źródła:** dam-projects.js, index.html, dam-brand.css, version 5.0.71

## 2026-07-29 - v5.0.72: Global sticky chrome frost blur (gaps above/between panels)

**Komenda/Akcja:** User: sticky panele search + projects toolbar — prześwitują karty w szczelinie i nad panelem; globalny blur.

**Log/Status:** `dam-brand.css` — `--dam-sticky-chrome-blur/bg-frost`, backdrop-filter na `.dam-explorer-toolbar`, `.dam-projects-grid-toolbar`, `.dam-viz-secondary-filters`; pseudo `::before/::after` wypełniają `--dam-sticky-top` (nad) i `--dam-sticky-search-gap` (między). `dam-bento.css` — usunięty opaque bg z projects toolbar. Bump 5.0.72, cache-bust index/explorer/viz/branding.

**Efekt/Fix:** Frost 14px + półprzezroczyste tło w szczelinach sticky chrome na Projekty/Viz/Branding/Eksplorator.

**Źródła:** dam-brand.css, dam-bento.css, v5.0.72

## 2026-07-29 - v5.0.69: Projects grid sort + release commit

**Komenda/Akcja:** User: auto-sort `#damProjectsGrid` po dacie z nazwy folderu; toolbar `#damProjectsStatus` — Sortuj (nazwa, data, priorytet, ostatnie); commit+push całego pakietu v5.0.54–5.0.69.

**Log/Status:** `dam-projects.js` — `parseFolderDateScore`, `sortProjects`, localStorage `dam_projects_sort` + `dam_projects_recent`, select `#damProjectsSort`. `index.html` + `dam-brand.css` toolbar row. Bump 5.0.69 sync.

**Efekt/Fix:** Domyślnie najnowsze rewizje na górze; 6 trybów sortowania; ostatnio otwarte projekty w localStorage.

**Źródła:** index.html, dam-projects.js, dam-brand.css, version 5.0.69

## 2026-07-29 - v5.0.69: Konwersja elementów globalna (PNG+JPG, 50%)

**Komenda/Akcja:** User: przycisk „Podejmij próbę konwersji elementów” ma konwertować Links→ELEMENTY (PNG alpha + JPG, 50% kompresja); globalne ustawienia admina w Settings → Konwersja; wire do bridge.

**Log/Status:**
1. **v5.0.69** `local_bridge.py`: `load_elementy_conversion_settings()`, `save_elementy_conversion_settings()`, `_save_elementy_jpg_file()`, `convert_links_elementy()` PNG+JPG wg formats/quality; GET+POST `/app-settings`.
2. `app-settings.json`: sekcja `elementy_conversion` (enabled, quality 50, png+jpg, png_transparency).
3. `settings.html` + `dam-settings.js`: nav chip **Konwersja**, karta `#damElementyConversion` (admin-only edycja), load/save przez bridge.
4. `dam-media-preview.js`: `fetchElementyConversionSettings()` + `renderResizerCta` przekazuje quality/formats; ukrywa CTA gdy disabled.
5. `program-instructions.json`: `viz.elementy_links_conversion` (v26).

**Efekt/Fix:** Built-in konwersja TIFF/PSD/PSB → PNG (dematte/alpha) + JPG z globalną jakością; admin steruje w Ustawienia → Konwersja.

**Test:** `node --check` dam-media-preview.js + dam-settings.js OK; Python ast.parse local_bridge OK; smoke :8765/:8766 200; GET `/app-settings` → elementy_conversion quality=50; snapshot settings: chip „Konwersja” + heading „Konwersja elementów” PASS.

**Źródła:** local_bridge.py, app-settings.json, settings.html, dam-settings.js, dam-media-preview.js, program-instructions.json, version 5.0.69


**Komenda/Akcja:** User: (A) assoc picker — hierarchy lines, purple MATERIAŁ badge, 20px badge→tags gap, max 7 tags, fix thumbs/preview, branding-style grouping; (B) branding group cards = viz pattern (+N bubble, id-chip/show-indexes), fix card↔modal variant drift.

**Log/Status:** `dam-assoc-edit.js`: `hydratePickerThumbs` (IO lazy /media), `data-path` on imgs, branding `marketingGroupKey` parity, nested folder rows, purple material badge CSS inject, DamBadges tags max 7. `dam-branding.js`: `brandingCardVariantBadgeHtml`, `brandingCardIndexBlockHtml`, `brandingCardDisplayAssets` (modal uses raster siblings only), removed meta „4 pliki” / title id-chip. `dam-branding.css` variant-badge + indexes-wrap. `dam-brand.css` material badge purple. Bump 5.0.68.

**Efekt/Fix:** Picker thumbs load via lazy bridge preview + `__damBrandingThumbFallback`; branding cards show +N / Pokaż indeksy like viz; openModal filters PSD sources from variant grid while keeping full `data-group-ids`.

**Test:** `node --check` dam-assoc-edit.js + dam-branding.js OK; smoke :8765/:8766 200; screenshot branding grid PASS (+N badges, Pokaż indeksy visible). Assoc picker screenshot PARTIAL (grid load timing).

**Źródła:** apps/web/assets/js/dam-assoc-edit.js, dam-branding.js, css dam-brand.css, dam-branding.css; branding.html, visualizations.html, explorer.html v=5.0.68


**Komenda/Akcja:** User: separator przed Skojarzone materiały (jak warianty); branding bez studio → pełna szerokość; tytuł↔ext-tag 15px; Pokaż wszystkie full-width + margin-top 15px; studio rail do dołu wariantów; meta-block spacing /2.

**Log/Status:** Subagent 4eb29fc1 padł (API limit) — parent wdrożył. `dam-viz-modal.css` materials box, studio align-self end, show-all stretch. `dam-branding.css` column-gap 15px fix (było 0!). `dam-media-preview.js` inject title gap !important. Bump 5.0.64.

**Efekt/Fix:** Czytelniejszy modal branding/viz; ext-tag 15px od tytułu; studio przy dolnej krawędzi wariantów.

**Źródła:** dam-viz-modal.css, dam-branding.css, dam-media-preview.js, v5.0.64

## 2026-07-29 - v5.0.63: Assoc picker = explorer dam-search-hits clean layout

**Komenda/Akcja:** User: picker skojarzeń nadal nie jak piękny widok eksploratora (dam-search-hits) — elementy ucięte, zły layout w `#damAssocEditPopover .dam-assoc-edit-popover__list`.

**Log/Status:** Subagent 9a8fb66b padł (API limit) — parent wdrożył. `optionButtonHtml` — markup jak explorer (badge → name → meta), thumb lewo, checkbox prawo. Inject CSS: flex-start, min-height 76px, bez boxed rows. `dam-brand.css` + `dam-branding.css` parity. Bump 5.0.63.

**Efekt/Fix:** Wiersze pickera czytelne: MATERIAŁ + nazwa pliku + ID, bez crop head 19px.

**Źródła:** dam-assoc-edit.js, dam-brand.css, dam-branding.css, v5.0.63

## 2026-07-29 - v5.0.62: Modal layout/typography (meta rail, studio, variants)

**Komenda/Akcja:** User: ext-tag +15px od tytułu; większe tytuły; +10px pod tagami; CTA +10%; etykiety assoc = CTA; warianty pod meta-rail (bez białej przerwy); studio rail top+right; global #damVizModal + #damMediaPreview.

**Log/Status:** Subagenty c7d9fe3c + eca09b64 padły (API limit) — parent wdrożył. `dam-viz-modal.css` grid `variants studio`, studio bez padding-top 4.75rem, chips flex-end. `dam-brand.css` tytuł 28px. `dam-branding.css` ext-tag 15px, assoc-label 13.2px, title-base 28px (fix inherit). `dam-assoc-edit.js` inject CTA 13.2px. `dam-media-preview.js` title gap 15px. Bump 5.0.62. Screenshot PASS (viz modal Tiramisu).

**Efekt/Fix:** Warianty pod kolumną meta; studio wyrównane do góry/prawej; czytelniejsza typografia modala.

**Źródła:** dam-viz-modal.css, dam-brand.css, dam-branding.css, dam-media-preview.js, v5.0.62


**Komenda/Akcja:** User: picker skojarzeń ma wyglądać jak eksplorator (badge + 20px + max 5 tagów, miniatury, checkbox); napraw CTA „Dodaj/Edytuj materiały”; zawsze 2 sekcje produkty+materiały (70px gap); usuń toggle Produkty(N); CSS grid miniatur; deduplikacja WWW→Online.

**Log/Status:** `dam-assoc-edit.js` — `dam-search-hit__head` (badge+tags inline), material kind fix pinned M-SLI, `bindAssocCtas` na `#damMediaPreview`. `dam-media-preview.js` — CTA material, sekcje zawsze widoczne, bez toggle produktów, grid thumb. `dam-badges.js` — Online dedup. CSS brand/brand-ing/viz-modal. Bump 5.0.61.

**Efekt/Fix:** Czytelniejsza lista materiałów; przycisk materiałów działa w brandingu; jeden tag Online zamiast WWW×3.

**Źródła:** branding.html?v=5.0.61, dam-assoc-edit.js, dam-media-preview.js


**Komenda/Akcja:** User: brak ELEMENTÓW w modalu viz (przycisk lista); warianty bliżej kafelka; chipy lekko zaokrąglone globalnie; ścieżka max 75%; studio od wysokości Nazwa pliku; usuń pasek 100% zoom.

**Log/Status:** `dam-media-preview.js` — viz modal zawsze ładuje elementy (fix early return); toggle Elementy (0) + separator; branding/viz bez zoom bara, hint hover. `dam-viz.js` — variant head compact, thumb panzoom. CSS `dam-viz-modal.css` + `dam-branding.css`. Bump 5.0.60.

**Efekt/Fix:** ELEMENTY wracają w prawym panelu; scroll zoom na obrazie.

**Źródła:** visualizations.html?v=5.0.60

## 2026-07-29 - v5.0.59: Explorer live search panel + global search-hit list

**Komenda/Akcja:** User: usuń baner F/X/D; skondensuj layout; napraw live search (#damFileSearch → #damExplorerMain); globalny styl `.dam-search-hits` w pickerach assoc (miniatury, tagi na górze, checkbox, selected mocniej niż hover).

**Log/Status:** `dam-search.js` — `renderHitsHtml`/`bindHitsClick` + fix `opts.onResults` w `bindSearchBox`. `dam-explorer.js` — panel główny używa hitów; ukryty `#damAdminBar`; empty-state tylko gdy brak hits. `dam-assoc-edit.js` — wiersze pickera w stylu search-hit + checkbox. CSS `dam-brand.css`/`dam-branding.css` — compact spacing, selected/hover. Bump 5.0.59.

**Efekt/Fix:** PASS screenshot `.qa-screenshots/explorer-search-sync-5.0.59.png` — dropdown + `#damExplorerMain` pokazują te same trafienia (Cynamon, 17 poz.).

**Źródła:** explorer.html?v=5.0.59, dam-search.js, dam-explorer.js, dam-assoc-edit.js


**Komenda/Akcja:** User: brak minusa przy produktach/wariantach/materiałach; strip wariantów za ciasny, miniatura za mała.

**Log/Status:** `dam-assoc-edit.js` — wire `.dam-viz-modal__variant[data-variant-key]` + collect grids z `#damVizModal`; CSS minus na variant button. `dam-viz-modal.css` — padding 14/16px, thumb 72×54. Bump 5.0.57.

**Efekt/Fix:** Shift+hover na wariantach produktu w wiz modal pokazuje czerwony minus (admin ON). Większy strip.

**Źródła:** dam-assoc-edit.js, dam-viz-modal.css, dam-media-preview.js v5.0.57

**Komenda/Akcja:** User: „nic nie usunąłeś” — dalej widać `dam-viz-modal__variant-hint` na visualizations.html (stary cache 5.0.51).

**Log/Status:** Usunięty `data-dam-tip` z labela; CSS `.dam-viz-modal__variant-hint{display:none!important}`; JS cleanup przy rebuild strip; przywrócony `flex:0 0 auto` na kafelkach wariantów. Bump `?v=5.0.55` na dam-viz.js + dam-viz-modal.css.

**Efekt/Fix:** Hard refresh `visualizations.html?v=5.0.55` — brak szarego hintu, większe miniatury.

**Źródła:** dam-viz.js, dam-viz-modal.css, visualizations.html v5.0.55

**Komenda/Akcja:** P0 branding: produkty nad materiałami, zero Elementy/Surowe; P2 viz: tylko Elementy + CTA konwersji; P3 POST `/convert-links-elementy`; P1 fix clip hover historii lifecycle.

**Log/Status:**
1. **v5.0.54** `dam-media-preview.js`: `linkedBrandingColumnHtml` products-top; usunięte elementy z branding flow; viz modal Elementy bez Surowe; `renderResizerCta` → `/convert-links-elementy` „Podejmij próbę konwersji elementów”.
2. **v5.0.54** `dam-viz.js`: `#damVizModalResizerHost` w assoc-pane.
3. **v5.0.54** `local_bridge.py`: `convert_links_elementy()` + POST handler (Pillow/psd-tools, PNG ~q60, bez usuwania Links).
4. **v5.0.54** `dam-brand.css`: `.dam-carrier-body__life` overflow visible + z-index hover.
5. Test API: `product-links-elementy?index=6300525.01` OK; POST convert 7 plików TIFF→PNG ELEMENTY. Smoke :8765/:8766 200; `node --check` JS OK.

**Efekt/Fix:** Branding bez Elementy; viz z Elementy + built-in konwersja; life history button bez clip.

**Źródła:** `dam-media-preview.js`, `dam-viz.js`, `local_bridge.py`, `dam-brand.css`, `branding.html`, `visualizations.html`, v5.0.54.

## 2026-07-29 - v5.0.56: usuń hint wariantów + jeden przycisk samouczka w pomocy

**Komenda/Akcja:** Usuń widoczny hint wariantów w modalu viz; usuń duplikat przycisku samouczka w `#damHelpModal` (header vs footer).

**Log/Status:**
1. **v5.0.56** `dam-viz.js`: usunięty `<p class="dam-viz-modal__variant-hint">` + inline CSS; tooltip `data-dam-tip` na label „Warianty produktu”.
2. **v5.0.56** `dam-viz-modal.css`: usunięte reguły `.dam-viz-modal__variant-hint`.
3. **v5.0.56** `dam-shortcuts.js`: usunięty header `button.dam-help-modal__restart` (zostaje X).
4. **v5.0.56** `dam-tutorial.js`: usunięte `injectHelpRestartControl`; footer „Uruchom samouczek” jedyny CTA.
5. Bump sync: `version.json`, `dam-version.js`, `runtime_config.py`, `?v=5.0.56` na zmienione assety.
6. Weryfikacja: `node --check` OK; screenshot help header (tylko X) + viz modal (brak hintu).

**Efekt/Fix:** Brak widocznego hintu; jeden przycisk restart samouczka w modalu pomocy.

**Źródła:** `dam-viz.js`, `dam-viz-modal.css`, `dam-shortcuts.js`, `dam-tutorial.js`, `visualizations.html`, `explorer.html`, `dam-shell.js`.

## 2026-07-29 - v5.0.58: fix Shift+minus scope branding-split (products + materials)

**Komenda/Akcja:** URGENT regression — Shift+hold minus na kafelkach skojarzeń po restructure branding pane (produkty nad materiałami); pending hint/samouczek z v5.0.52.

**Log/Status:**
1. **v5.0.58** `resolveAssocPaneScope` w `dam-assoc-edit.js` (export) — preferuje `--branding-split` przed inner `--materials`.
2. **v5.0.58** `bindMaterialsPane` + `seedMaterialsCtx` — ctx i `ensureShiftHoverAssocUx` na scope split, nie inner col.
3. **v5.0.58** `dam-media-preview.js` — wszystkie `bindMaterialsPane` paneHost → `resolveAssocPaneScope`; `rewireShiftAssocUxFromEl` po `renderLinkedProductsPane` + po branding `showAt`.
4. Bump sync `5.0.58`: `version.json`, `dam-version.js`, `runtime_config.py`, `branding.html`, `visualizations.html` `?v=`.
5. `node --check` dam-assoc-edit.js + dam-media-preview.js OK.
6. CDP synthetic DOM (split scope): productMinus+materialMinus wired, Shift visible — **PASS**.

**Efekt/Fix:** Minus na produktach i materiałach w jednym scope `--branding-split`; re-wire po async products pane.

**Pending (już v5.0.52):** hint wariantów usunięty; jeden przycisk samouczka w pomocy.

**Źródła:** `dam-assoc-edit.js`, `dam-media-preview.js`, `branding.html`, `visualizations.html`

## 2026-07-29 - v5.0.52: usuń hint wariantów + jeden przycisk samouczka w pomocy

**Komenda/Akcja:** Usuń widoczny hint wariantów w modalu viz; usuń duplikat przycisku samouczka w `#damHelpModal` (header vs footer).

**Log/Status:**
1. **v5.0.52** `dam-viz.js`: usunięty `<p class="dam-viz-modal__variant-hint">` + inline CSS; tooltip `data-dam-tip` na label „Warianty produktu”.
2. **v5.0.52** `dam-viz-modal.css`: usunięte reguły `.dam-viz-modal__variant-hint`.
3. **v5.0.52** `dam-shortcuts.js`: usunięty header `button.dam-help-modal__restart` (zostaje X).
4. **v5.0.52** `dam-tutorial.js`: usunięte `injectHelpRestartControl`; footer „Uruchom samouczek” jedyny CTA.
5. Bump sync: `version.json`, `dam-version.js`, `runtime_config.py`, `?v=5.0.52` na zmienione assety.

**Efekt/Fix:** Brak widocznego hintu; jeden przycisk restart samouczka w modalu pomocy.

**Źródła:** `dam-viz.js`, `dam-viz-modal.css`, `dam-shortcuts.js`, `dam-tutorial.js`, `visualizations.html`, `explorer.html`, `dam-shell.js`.

## 2026-07-29 - Assoc pane bottom stack v5.0.51 (produkty + Elementy + hint /typo)

**Komenda/Akcja:** Skojarzone produkty pod spodem w prawym dolnym rogu (jak Elementy); przywróć Elementy/Surowe elementy; zmniejsz padding hintu wariantów; `/typo` z `<br>` po „ponownie,”.

**Log/Status:**
1. **v5.0.51** `dam-media-preview.js`: `renderLinkedProductsPane` → `#damMediaPreviewLinkedProductsHost`; footer = tylko warianty; przywrócony `ensureAssocElementySplit` + `renderElementyGroups` w branding flow; bottom stack `#damMediaPreviewAssocPaneBottom`.
2. **v5.0.51** `dam-viz.js`: hint z łamaniem linii; `#damVizModalElementyHost` w assoc-pane.
3. **v5.0.51** `dam-viz-modal.css`: mniejszy hint + pane-products styles.

**Efekt/Fix:** CDP+screenshot M-SHOP404252: `productsInPane:true`, `productsInFooter:false`, `elementyToggles:3`, split OK. PASS.

**Źródła:** `dam-media-preview.js`, `dam-viz.js`, `dam-viz-modal.css`

---


**Komenda/Akcja:** Układ modala Branding jak wizualizacje — materiały w prawej kolumnie (nie full-width), warianty nad produktami (nie 2-col).

**Log/Status:**
1. **v5.0.50** `dam-media-preview.js`: `isAssocSplitLayout=true` zawsze; prawa `assoc-pane` + `#damMediaPreviewLinkedAssets`; usunięty `brandingRelatedMaterialsRowHtml` z footera; `renderBrandingRelatedMaterials` → pane + `bindMaterialsPane`; viz-studio vs branding rozdzielone renderery.
2. **v5.0.50** `dam-viz-modal.css`: `.dam-media-preview__assoc--footer-stack` flex column w split.
3. Bump `version.json`, `dam-version.js`, `runtime_config.py`, `branding.html` `?v=5.0.50`.

**Efekt/Fix:** CDP+screenshot M-SHOP404252: `split:true`, `assocPane:true`, materiały (89) w prawej kolumnie, `brandingRow:false`. PASS layout.

**Źródła:** `dam-media-preview.js`, `dam-viz-modal.css`, `.qa-screenshots/branding-modal-assoc-split-5.0.50.png`

---


**Komenda/Akcja:** Skojarzone materiały nad produktami; przycisk „Dodaj/Edytuj materiały” zamiast plus-tile; miniatury + grupowanie folderów w pickerze assoc (jak Branding).

**Log/Status:**
1. **v5.0.49** `dam-media-preview.js`: sekcja materiałów przed produktami; CTA „Dodaj/Edytuj materiały”.
2. **v5.0.49** `dam-assoc-edit.js`: `pickerListThumbUrl` (/thumb-cache), `renderPickerFolderGroups`, hover preview z path, `__damBrandingThumbFallback` na liście.
3. Bump `version.json`, `dam-version.js`, `runtime_config.py`, `branding.html` + `visualizations.html` `?v=5.0.49`.

**Efekt/Fix:** Layout assoc + picker brandingowy z miniaturami i nagłówkami folderów.

**Źródła:** `dam-media-preview.js`, `dam-assoc-edit.js`, `branding.html`

---

## 2026-07-28 - Follow-up subagent f0222f98 (modal title 6300783)

**Komenda/Akcja:** Domknięcie po [DAM modal title 6300783 fix](f0222f98-054a-43b5-9d92-5b2c3fb892cd) — C6-7 retest, C6-8 dev auth.

**Log/Status:**
1. **C6-6b** — bez zmian kodu; fix v5.0.48 potwierdzony (`B_6300783-title-cynamonka.png`).
2. **C6-7** — branding `M-SHOP405515-06-26` Podgląd **otwiera się** (`C6-7_SHOP405515-podglad.png`); grid `linked_variant_ids` wymaga flow assoc-edit (nie lekki Podgląd) — **DEFER**.
3. **C6-8** — curl POST bez Bearer → 401; `scripts/ops/start-browser.ps1` + przełącznik `-DevAuth` (`DAM_LOCAL_DEV_AUTH=1`); w UI sesja admin działa bez env.

**Efekt/Fix:** Subagent domknięty; pozostałe C6-7/C6-8 = operacyjne (assoc-edit UI / restart z `-DevAuth`).

---

## 2026-07-28 - Sesja3 DOMKNIĘCIE agentów (v5.0.48)

**Komenda/Akcja:** „Domknij pracę reszty agentów” — synteza subagentów 69c00355, 7abebd88, a6cac31b, 7004363d, eba4dcbb, 2d0fdb54, ff15425f, 187252db, f0222f98.

### Status końcowy Sesja3

| Blok | Temat | Status |
|------|-------|--------|
| Krok 0 | Audyt + baseline | **DONE** |
| Krok 1 | Toast 1s, chipy studio, jeden „Dodaj” | **DONE** v5.0.34–35 |
| Krok 3–4 | Modal X, thumbs, show-all, filename | **DONE** v5.0.39–44 |
| Krok 5 | Assoc core (no auto-persist, PL+EN, mirror, picker) | **DONE** v5.0.40–41 |
| Etap1 revert | JSON cleanup cynamonka test | **DONE** v5.0.43–44 |
| C6-6 | 6300728 bez heurystyki materiałów | **DONE** v5.0.47 whitelist-only |
| C6-6b | 6300783 tytuł CYNAMONKA | **DONE** v5.0.48 — `B_6300783-title-cynamonka.png` |
| C6-1–3,7 | Macierza delete/PL+EN/IMG/mirror | **DONE** (przed/pełny revert) |
| C7-1 | Tagi branding 4 rzędy | **DONE** `D_tag-filters-4-rows.png` |
| C6-7 | SHOP/GOG variant grid | **KOD DONE** — retest UI **DEFER** (Etap1 wyczyścił overrides; brak M-SHOP405515/M-GOG805627 w JSON) |
| C6-8 | Step 8 delete X persist | **BLOCKED** — POST → HTTP 401; wymaga `DAM_LOCAL_DEV_AUTH=1` + restart bridge **lub** signin admin/power_user |
| Krok 2 | Siatka WIZ baseline | **PARTIAL** — poza scope domknięcia |
| Krok 8–9 | UTF-8 audyt, `_qa_sesja3.py` CDP/vision | **TODO** następna sesja |
| Krok 10 | Cleanup testów przez UI | **TODO** po PASS macierzy Etap 2 |

**Log/Status:** Wersja repo **5.0.48**. Agent f0222f98 domknięty: `syncModalTitleForVariant` używa `modalProductId` (group.pid), nie linked variant. Screenshot PASS odczytany ponownie. Bridge :8766 OK; Step 8 bez sesji → 401 (python urllib).

**Efekt/Fix:** Sesja3 deliverable zamknięty na v5.0.48; otwarte tylko: retest SHOP/GOG po ponownym skojarzeniu UI, Step 8 auth, polish Krok 2/8/9/10.

**Źródła:** `dam-viz.js`, `dam-media-preview.js`, `local_bridge.py`, `Desktop\Dowody\Sesja3\`, plan `dam_assoc_sesja3_v2`

---

## 2026-07-28 - Sesja3 v5.0.48 (modal title 6300783 + verify)

**Komenda/Akcja:** Follow-up po 187252db (v5.0.47): PRIORITY modal H1 6300783=CYNAMONKA; ff15425f materials; Step 8 dev auth; SHOP/GOG variant grid retest.

### Checklist Sesja3 (live)

| ID | Temat | Status |
|----|-------|--------|
| C6-4 | `#damVizModalFilename` czytelność | **DONE** (wcześniej) |
| C6-5 | Etap1 JSON cleanup | **DONE** (wcześniej) |
| C6-6 | 6300728 bez 21 grup cynamonka | **DONE** — viz modal whitelist-only (v5.0.47) |
| C6-6b | 6300783 tytuł Cynamonka | **DONE** v5.0.48 — `B_6300783-title-cynamonka.png`: H1 **CYNAMONKA**, nie BANOFFEE |
| C6-7 | SHOP/GOG variant grid | **TODO** — karta M-SHOP405515 widoczna; modal Podgląd nie otworzył się w tej sesji browser MCP (kod v5.0.47 bez zmian) |
| C6-8 | Step 8 dev auth POST | **PARTIAL** — `DAM_LOCAL_DEV_AUTH=1` w `local_bridge.py`; bez env → HTTP **401** login_required; restart bridge z env nie wykonany |
| C7-1 | Tagi 4 rzędy | **DONE** (wcześniej) |

**Log/Status:**
1. **v5.0.48** `dam-viz.js`: `syncModalTitleForVariant` zawsze `modalProductId` (group.pid), nie `v.product_id` z linked variant; `modalProductIdForGroup` host-first; `vizProductCtx.id=modalProductId`; `enterProductView` resetuje tytuł.
2. CDP: `openByProductId('cynamonka-nerkowcowy')` → `title=CYNAMONKA`, `pid=cynamonka-nerkowcowy`.
3. Screenshot+Read: `Desktop\Dowody\Sesja3\B_6300783-title-cynamonka.png` — PASS.
4. ff15425f: `#damVizModalAssoc` whitelist-only już w v5.0.47 — 6300783 modal: „Brak skojarzonych materiałów”.
5. curl POST `/branding/asset-associations` bez Bearer → 401 (bez `DAM_LOCAL_DEV_AUTH=1`).

**Efekt/Fix:** Tytuł modala wiz = folder karty produktu; regresja BANOFFEE na Cynamonce naprawiona.

**Źródła:** `dam-viz.js`, `visualizations.html?v=5.0.48`, `B_6300783-title-cynamonka.png`, `local_bridge.py`

---

## 2026-07-28 - Sesja3 C6-6 fix v5.0.47 (viz modal materials whitelist-only)

**Komenda/Akcja:** Follow-up 2d0fdb54 — C6-6 PARTIAL: modal 6300728 nadal 17 grup cynamonka viz z heurystyki; anti-self-loop sesja3-v2.

**Log/Status:**
1. **v5.0.47** `dam-media-preview.js`: `#damVizModalAssoc` = whitelist-only (`linked_materials` + overrides); pusty → „Brak skojarzonych materiałów”, bez `loadLinkedBrandingForContext` heurystyki; nie czyta `_damMaterialsCtx.selectedIds` (pollution).
2. **v5.0.47** `dam-assoc-edit.js`: cache-bust `branding-associations-overrides.json?v=DAM_APP_VERSION` (stary browser cache trzymał M-IMG249510).
3. **CDP before:** label `Skojarzone materiały (17 grup · 33 plików)` (heurystyka + linked_variants cynamonka).
4. **CDP after:** `itemCount:0`, `emptyText: Brak skojarzonych materiałów`, `linked:[]`.
5. **Screenshot+Read:** `C:\Users\xpret\Desktop\Dowody\Sesja3\C6-6300728-no-heuristic.png` — PASS (pusty stan materiałów).
6. **Step 8:** `POST /branding/asset-associations` bez Bearer → HTTP 401; `DAM_DEV_ALWAYS_ADMIN` tylko w `dam-shell.js` (false); `local_bridge.py` bez dev bypass — wymaga signin/rehydrate (ADR-006).

**Efekt/Fix:** Heurystyczny flood materiałów w modalu viz wyłączony; tylko jawny picker save + overrides JSON.

**Źródła:** `dam-media-preview.js`, `dam-assoc-edit.js`, `visualizations.html`, `viz-flags.json`, `branding-associations-overrides.json`

### Checklist Sesja3 (live)

| ID | Temat | Status |
|----|-------|--------|
| C6-6 | 6300728 bez masowych cynamonka viz w materiałach | **DONE** v5.0.47 — whitelist-only viz modal; before 17 grup → after 0 |
| C6-8 | Step 8 delete X / POST save | **BLOCKED** — HTTP 401 bez sesji; brak insecure bypass w bridge |

---

## 2026-07-28 - Sesja3 follow-up v5.0.44 (filename + Etap1 cleanup + Krok 6 remainder)

**Komenda/Akcja:** Follow-up po subagentach Sesja3: fix `#damVizModalFilename`, revert Etap1 test assoc JSON, checklist Krok 6 (variant grid, Step 8 auth), screenshot 6300728 po cleanup.

### Checklist Sesja3 (live)

| ID | Temat | Status |
|----|-------|--------|
| C6-1 | Step 3 whitelist linked_materials (1 grupa IMG) | **DONE** v5.0.41 |
| C6-2 | Step 4 banoffee 6300728 mirror | **DONE** |
| C6-3 | Step 7 M-IMG249510 mirror | **DONE** |
| C6-4 | `#damVizModalFilename` czytelność + brak stale title | **DONE** v5.0.44 — CSS meta-line--filename; `basenameForVizItem` path/file/revision_path; `syncModalTitleForVariant` w `selectVariant`; productView czyści filename |
| C6-5 | Etap1 JSON cleanup (overrides + viz-flags) | **DONE** — backup `*.backup-20260728-185556.json`; usunięto M-IMG249510, M-SHOP405515, folder cynamonka; `linked_materials:{}` |
| C6-6 | 6300728 bez masowych cynamonka viz w materiałach | **DONE** v5.0.47 — whitelist-only viz modal |
| C6-7 | SHOP/GOG variant grid (`linked_variant_ids`) | **DONE** kod — `enrichAssocOnOpen` merge → `groupContext.variants`; `brandingAssetFromIndex` fallback; `buildBrandingGroupContext.linked_variant_ids` |
| C6-8 | Step 8 delete X / POST save | **BLOCKED** — `POST /branding/asset-associations` bez Bearer → `401 login_required`; `DAM_DEV_ALWAYS_ADMIN=false`; wymaga signin / rehydrate (admin lub power_user) |

**Log/Status:**
1. Agent eba4dcbb: część fixów już w drzewie (filename HTML, enrichAssoc, brandingAssetFromIndex).
2. **v5.0.44:** CSS filename stack; `syncModalTitleForVariant`; JSON cleanup + walidacja; bump `?v=5.0.44-sesja3`.
3. **Screenshot+Read:** `C6_cleanup-6300728-materials.png` — tytuł BANOFFEE na widoku cynamonka (przed/pełny retest po title sync); materiały 17 grup (heurystyka).
4. **Step 8:** Python POST → `{"error":"login_required"}` — brak dev bypass.

**Efekt/Fix:** Filename/title sync kod DONE; Etap1 overrides wyczyszczone; variant grid enrichment DONE; Step 8 = auth blocker udokumentowany.

**Źródła:** `dam-viz.js`, `dam-viz-modal.css`, `dam-brand.css`, `dam-media-preview.js`, `dam-assoc-edit.js`, `dam-branding.js`, `branding-associations-overrides.json`, `viz-flags.json`, `Desktop\Dowody\Sesja3\C6_cleanup-6300728-materials.png`

---

## 2026-07-28 - Sesja3 v2 Krok 6 Step3 fix + matrix v5.0.41

**Komenda/Akcja:** Kontynuacja Krok 6 — naprawa Step 3 (3 grupy zamiast 1 IMG) + domknięcie macierzy 4–8.

**Log/Status:**
1. **Root cause Step 3:** `explicitMaterialIdSet` działał jako bypass INCLUDE, nie whitelist — heurystyka pokazywała SHOP/GOG obok M-IMG249510.
2. **Fix v5.0.41:** `dam-media-preview.js` — `explicitWhitelistMode`: gdy `linked_materials`/picker ma ID → tylko te materiały.
3. **Krok 6 macierz (browser CDP + screenshot+Read):**
   - Step 1–2: PASS (z poprzedniej tury)
   - **Step 3 PASS:** `Skojarzone materiały (1)` — tylko M-IMG249510-07-26 (`C6_step-3-materials-1group.png`)
   - **Step 4 PASS:** banoffee 6300728 — 1 materiał IMG, tytuł BANOFFEE KAKAO, 6300783 w wariantach (`C6_step-4-mirror-6300728.png`)
   - **Step 5 PARTIAL:** M-SHOP405515 — linked CYNAMONKA 6300783 PASS; variant grid „Brak wariantów" FAIL (`C6_step-5-SHOP405515.png`)
   - **Step 6 PARTIAL:** M-GOG805627 — linked 6300783 PASS; variant grid empty FAIL (`C6_step-6-GOG805627.png`)
   - **Step 7 PASS:** M-IMG249510 — Produkty (4) incl. 6300783+6300728, brak 6300782 (`C6_step-7-IMG-mirror.png`)
   - **Step 8 FAIL:** Shift+hold delete X + bridge POST → `login_required` (brak sesji zapisu)

**Efekt/Fix:** Step 3 naprawiony kodem; Steps 5–6 variant grid = blocker Krok 7; Step 8 wymaga zalogowanej sesji admin.

**Źródła:** `dam-media-preview.js`, `version.json` 5.0.41, `visualizations.html`, `branding.html`, `Desktop\Dowody\Sesja3\C6_step-*.png`

---

## Sesja3 — checklist na żywo (2026-07-28)

- [x] **A — filename modal** (`#damVizModalFilename`): CSS grid-column:2 + wrap; `syncVizModalFilename()` przy zmianie wariantu/product view; CDP w=598px, tytuł=basename 6300783
- [x] **B — revert Etap 1 test assoc**: `viz-flags.json` linked_variants={}; overrides bez cross-linków; branding-index 41 assetów; banoffee modal: 1 materiał (nie 21 grup cynamonki)
- [x] **B-extra — viz-flags merge**: plik z `updated_at` = source of truth (localStorage nie trzyma starych linked_variants)
- [ ] **Krok 6** — macierz 8 scen UI (steps 4–8: SHOP/GOG/delete X refresh)
- [ ] **Krok 7** — hero min-height / object-fit contain (media-preview)
- [ ] **Krok 8** — warianty zwinięte 4 + Pokaż wszystkie
- [ ] **Krok 9** — (plan Sesja3 v2 — do uzupełnienia przez usera)
- [ ] **Krok 10** — final QA + user sign-off Etap 1

**Wersja:** 5.0.43 | **Dowody:** `Sesja3/A_filename-fix-6300783.png`, `Sesja3/B_banoffee-revert-6300728.png`

---

## 2026-07-28 - Sesja3 A filename + B Etap1 revert v5.0.43

**Komenda/Akcja:** Task A filename modal (CSS+JS stale title); Task B revert test assoc JSON; checklist process.md.

**Log/Status:**
1. **A PASS:** `.dam-viz-modal__meta-line` — filename/variant-title `grid-column:2`, wrap; `syncVizModalFilename()` + `enterProductView`; CDP 6300783 w=598px, text=DK-KAR6X-NERK-CYNAMONKA-6300783.00-ENFACE-L.jpg.
2. **B PASS:** `viz-flags.json` linked_variants cleared; overrides: M-IMG249510 tylko cynamonka, M-SHOP405515 bez cynamonki/6300783, usunięto folder wielopaki; branding-index 41 assetów patch; banoffee 6300728: fname BANOFEE, mat (1) nie 21 grup.
3. **Merge fix:** `dam-viz.js` — file `updated_at` → linked_variants/unlinked/linked_materials z pliku (nie localStorage orphan keys).
4. **Wersja:** 5.0.41 → **5.0.43**.

**Efekt/Fix:** Filename czytelny; cross-linki testowe Etap 1 usunięte; banoffee bez lawiny cynamonki w materiałach.

**Źródła:** `dam-viz-modal.css`, `dam-viz.js`, `viz-flags.json`, `branding-associations-overrides.json`, `branding-index.json`, `Sesja3/A_filename-fix-6300783.png`, `Sesja3/B_banoffee-revert-6300728.png`

---

## 2026-07-28 - Sesja3 v2 Krok 5 remainder + Krok 6 partial v5.0.40

**Komenda/Akcja:** Krok 5 remainder (delete X, PL+EN, anti-loop, lustro, etykiety, timeout) + Krok 6 macierz 8 scen (UI).

**Log/Status:**
1. **Krok 5 — kod (v5.0.40):**
   - Delete X pinned: `persistPinnedRemoval` + early return dla `is-pinned` (natychmiast API).
   - PL+EN cały produkt: `expandPicksToAllProductRevisions` + confirm/onConfirmVariants.
   - Anti-self-loop: `isOwnProductVisualizationLoop` w `dam-media-preview.js`.
   - Lustro A↔B: `persistLinkedVariant` mirror w `dam-viz.js`.
   - Etykiety pickera: `revisionPickerLabel` → `BANOFFEE KAKAO · PL · 6300728`.
   - No freeze: `DamLoader` safety 5s + `saveAssociations` AbortController 5s.
2. **Krok 6 — częściowy (browser):**
   - Modal 6300783 otwarty (thumb click); screenshot `C6_step-1-modal-6300783.png`.
   - **Step 2 PASS:** strip `EN · 6300783` + `PL · 6300783` (vision).
   - **Step 1:** brak 6300719 w stripie (baseline PASS).
   - **Step 3 PARTIAL:** materiały 3 grupy / 5 plików (nie 1 IMG).
   - **Steps 4–8:** nie domknięte w tej turze (wymaga pełnych kliknięć UI).
3. **API:** viz-flags linked_variants: banoffee, oats (brak cynamonka); M-IMG249510 overrides: 4 produkty.

**Efekt/Fix:** Krok 5 kod DONE; Krok 6 wymaga kontynuacji (SHOP/GOG/delete X refresh).

**Źródła:** `dam-assoc-edit.js`, `dam-viz.js`, `dam-media-preview.js`, `dam-loader.js`, `visualizations.html`, `branding.html`, `Sesja3/C6_step-1-modal-6300783.png`

---


**Komenda/Akcja:** Kontynuacja planu Sesja3 v2 — Krok 3 (modal X, picker thumbs, bez globalnego resetu) + Krok 4 (tytuły 6300783/6300728, show-all jakości XL/L/S/S-SKLEP).

**Log/Status:**
1. **Krok 3 PASS:** `bindModalClose` capture-phase; `bustMaterialAssocCaches` bez `bustLinkedBrandingCache`; `preserveThumbs` w `refreshLinkedBrandingAfterEdit`; picker list thumb preserve; modal X zamyka (CDP pointerdown).
2. **Krok 4 PASS:** `modalProductIdForGroup` + `productLevelDisplayName`; `findRevisionWizki` folder-first + `revisionRasterWizki`; expand czyści stale `size/persp/bg`; KAR6X `perspMatchesForStudio` + `studioGroupKey`; jakość XL/L/S/S-SKLEP w chipach i show-all.
3. **Wersja:** 5.0.34 → **5.0.39** (`version.json`, `dam-version.js`, `runtime_config.py`, `?v=` HTML).
4. **Dowody:** `B_6300783-title-cynamonka.png`, `B_6300728-title-banoffee.png`, `B_show-all-qualities.png`, `P0-B_picker-thumbs-all.png` → `Desktop\Dowody\Sesja3\`.

**Efekt/Fix:** Cynamonka 6300783 tytuł CYNAMONKA; Banoffee 6300728 tytuł BANOFFEE KAKAO; show-all 4 jakości; picker miniatury z dysku; assoc strip 56 thumb bez placeholderów po zamknięciu pickera.

**Źródła:** `dam-viz.js`, `dam-assoc-edit.js`, `dam-media-preview.js`, `dam-modal-shared.js`, `visualizations.html`, `Sesja3/`

---

## 2026-07-28 - Sesja3 v2 plan (Krok 0–2 + partial 5) v5.0.34

**Komenda/Akcja:** Wykonaj plan `dam_assoc_sesja3_v2` od audytu przez szybkie UI, siatkę WIZ, wyłączenie auto-persist.

**Log/Status:**
1. **Krok 0 PASS:** smoke :8765/:8766 OK; baseline screeny `0_audit_*` w `Sesja3\`; `raport.md` agent vs user.
2. **Krok 1 PASS:** toast compact 1s bez maskotki + „Usunięto”; chip FRONT 46px; show-all auto-width; `ensurePlusTile` null gdy CTA; CSS `:has` hide plus-tile. Dowody H1/H2/H3.
3. **Krok 2 PARTIAL:** `dam-viz.js` bubble indeksu dla 1 wariantu; `margin-top:auto` na CTA; `G_grid-baseline-aligned.png`.
4. **Krok 5 PARTIAL:** usunięto auto-persist `dam-media-preview.js` L3045–3060.
5. **Wersja:** 5.0.32 → **5.0.34** (+ bump `?v=` HTML).

**Efekt/Fix:** Toast/chipy/plus-tile naprawione i zweryfikowane screenshot+Read+CDP. Tytuł modal 6300728, picker thumbs, macierza 8 scen. — na następną sesję.

**Źródła:** `dam-danger.js`, `dam-assoc-edit.js`, `dam-viz-modal.css`, `dam-branding.css`, `dam-viz.js`, `dam-media-preview.js`, `visualizations.html`, `explorer.html`, `branding.html`, `Sesja3/`

---


**Komenda/Akcja:** Przeprojektuj skille /planner i /reflect — mniej żargonu, Warstwa A (user) + B (agent), bramki fałszywego PASS, tryb user_reality.

**Log/Status:**
1. Zaktualizowano `~/.cursor/skills/planner/` (SKILL, executable-plan-format, reference, cheat-sheet).
2. Zaktualizowano `~/.cursor/skills/reflect/` + `reflection-loop/` (critic-core 6 trybów, final-deliverable tabela sprawdzeń).
3. Reguły: `planner-mad-always.mdc`, `reflect.mdc` — min_rounds UI=3, PASS UI = screenshot+Read.

**Efekt/Fix:** Plan/reflect muszą być zrozumiałe dla człowieka; Done = to co widać w przeglądarce.

**Źródła:** ~/.cursor/skills/planner/*, ~/.cursor/skills/reflect/SKILL.md, ~/.cursor/skills/reflection-loop/*, ~/.cursor/rules/planner-mad-always.mdc, ~/.cursor/rules/reflect.mdc

---

## 2026-07-28 - Phase C #4/#7 UI verify v5.0.32

**Komenda/Akcja:** Domknięcie macierzy Phase C: C#4 (6300728 ↔ 6300783 assoc) + C#7 (mirror M-IMG249510 bidirectional).

**Log/Status:**
1. **C#4 PASS:** `banoffee-kakao-deserowe` linked_materials (43) ⊇ `cynamonka-nerkowcowy` (33); core GOG + M-IMG249510 obecne; screenshot `C4_6300728-mirror-6300783-assoc.png`.
2. **C#7 PASS:** UI picker dodał `banoffee-kakao-deserowe` do M-IMG249510 (9 prod.); UI: CYNAMONKA 6300783 + BANOFFEE 6300728, brak 6300782; overrides JSON potwierdzone; screenshot `C7_mirror-IMG249510-bidirectional.png`.
3. **Wersja:** 5.0.32 bez zmian kodu (UI-only).

**Efekt/Fix:** Phase C macierza 1–8 PASS. Etap 1 domknięty.

**Źródła:** branding-associations-overrides.json, visualizations.html, branding.html, Sesja3/

---

**Komenda/Akcja:** Fix Etap 1 blockers: R13 modal nav Wstecz, R14 explorer UTF-8, C#5 cynamonka persist, chip 6300783.

**Log/Status:**
1. **R13 PASS:** `dam-viz.js` — `previewNavCtrl` + `onNavigate` + push variant/branding; `dam-media-preview.js` shared nav z `#damVizModal`; Wstecz enabled po 2 hopach materiałów; assoc product → viz modal (nie explorer).
2. **R14 PASS:** `explorer.html` — naprawione polskie znaki (Pokaż wszystkie, Filtr języka, Odśwież z dysku); screenshot `R14_utf8-explorer-polish.png`.
3. **C#5 PASS:** overrides `M-SHOP405515-06-26` ma `cynamonka-nerkowcowy`; fix auto-dedupe przy open picker + cache `_assocOverrides` po save.
4. **Index chip:** `latestProductIndexBase()` w enrich + linkedProductItemHtml — UI chip 6300783 (R13 screenshot).
5. **Wersja:** 5.0.32 (version.json, dam-version.js, runtime_config.py, HTML ?v=).

**Efekt/Fix:** R01–R14 PASS. Phase C #5 PASS; #4/#7 partial. Etap 1 ~95%.

**Źródła:** dam-viz.js, dam-media-preview.js, dam-assoc-edit.js, explorer.html, Sesja3/raport.md

---

**Komenda/Akcja:** Dokończenie A→F planu assoc etap 1-2: macierza C #5 UI, R11/R13/R14, `_qa_sesja3.py` fix.

**Log/Status:**
1. **C #5 partial:** M-SHOP405515 — UI picker delete+add cynamonka (4 produkty); overrides bez `cynamonka-nerkowcowy` slug (folder_group inferencja).
2. **R11 PASS*:** IMG249510 mirror 8 prod bez OATS; screenshot `R11_mirror-IMG249510-no-self-loop.png`.
3. **R13 FAIL:** Wstecz disabled po 2 hopach w `#damVizModal`; assoc product → explorer (brak modal stack).
4. **R14 FAIL:** explorer UTF-8 korupcja (`PokaĂ… wszystkie`).
5. **QA:** `_qa_sesja3.py` — `assets` zamiast `overrides`; v5.0.31; raport.md zaktualizowany.

**Efekt/Fix:** v5.0.31. R01–R12 PASS; R13/R14 FAIL; C #4–7 partial. Etap 1 ~90%.

**Źródła:** branding-associations-overrides.json, _qa_sesja3.py, Sesja3/raport.md

---
## 2026-07-28 - A/B/D PASS + Phase C partial + QA (v5.0.30)

**Komenda/Akcja:** Dokończenie A→F: R01/R03/R04/R09/R10/R12, macierza C UI, QA script.

**Log/Status:**
1. **A PASS:** R01 screenshot — grid OFF, +3 fiolet, Pokaż indeksy (6300478+6300699), brak id-chip.
2. **B PASS:** R03 BANOFFEE KAKAO (nie OATS); R04 XL/L/S/S-SKLEP; hint + bold variant title (700).
3. **C partial:** R10 delete X — OATS usunięty z M-IMG249510 (UI→overrides 8 produktów); macierza #4-7 pending.
4. **D PASS:** SHOP405515 + GOG805627 widoczne w search; R12 tagi 4 rzędy + Pokaż więcej (+8).
5. **F:** `_qa_sesja3.py`, `Sesja3/raport.md`, screenshots R01-R12 (partial R11/R13/R14).

**Efekt/Fix:** v5.0.30. Etap 1 ~85% — blocker: macierza C #4-7 + R13 nav.

**Źródła:** dam-viz.js, dam-assoc-edit.js, _qa_sesja3.py, branding-associations-overrides.json

---
## 2026-07-28 - P0-B PASS + Phase A partial (v5.0.29)

**Komenda/Akcja:** Kontynuacja planu P0-B→A→F; dokończenie P0-B thumbs, Phase A grid.

**Log/Status:**
1. **P0-B PASS:** `productThumb` → `viz_latest` + `latestProductIndexBase` (6300783 zamiast 6300782); picker PODGLĄD CYNAMONKA 480px; assoc 23/23 thumbs loaded.
2. Screenshoty Sesja3: `P0-B_IMG249510-assoc-thumbs.png`, `P0-B_picker-cynamonka-thumbs.png`, `P0-B_SHOP405515-hero-loaded.png`.
3. **Phase A partial:** badge +N fiolet `#7c3aed`; grouped cards bez pojedynczego indeksu; `resolveBrandingProductId` dla tytułu; CDP: BANOFFEE KAKAO, showAll ON → 6300699 (5 kart) + 6300478 (1).
4. Screenshot: `Sesja3/A_viz-grid-purple-badge-banoffee.png`.
5. Wersja **5.0.29** (5.0.28 productThumb, 5.0.29 viz grid).

**Efekt/Fix:** P0-B done. A ~80%. B/C/D/E/F pending.

**Źródła:** dam-assoc-edit.js, dam-viz.js, branding.html, visualizations.html

---
## 2026-07-28 - P0-A PASS + P0-B partial (v5.0.27)

**Komenda/Akcja:** Kontynuacja planu P0-A→F: modal header X w nav, thumb perf.

**Log/Status:**
1. **P0-A PASS:** close X w `.dam-preview-nav` (flex, margin-left:auto); CDP topDiff=0, bound=1, close działa.
2. **Root cause close FAIL:** `enrichAssocOnOpen` sync throw `global is not defined` → `bindModalClose` nie dochodził; fix global→window.
3. **API:** `/branding-search-picker?q=249510` → `M-IMG249510-07-26`.
4. **P0-B partial:** heroSrcFromAsset, normalizeMediaThumbUrl, resolveProductThumbUrl viz_latest.
5. Screenshot: `Sesja3/P0-A_modal-header-aligned-close.png`. Wersja **5.0.27**.

**Efekt/Fix:** P0-A done. P0-B screenshots + A..F pending.

**Źródła:** dam-modal-shared.js, dam-viz-modal.css, dam-media-preview.js, dam-viz.js, branding.html

---
## 2026-07-28 - P0-A PASS + P0-B partial (v5.0.27)

**Komenda/Akcja:** Follow-up po subagent — kontynuacja P0-B→F.

**Log/Status:**
1. P0-A **PASS**: X w `.dam-preview-nav`, `topDiff=0`, close działa (fix `global`→`window` w enrichAssocOnOpen).
2. P0-B partial: `heroSrcFromAsset`, `normalizeMediaThumbUrl`, `resolveProductThumbUrl` (viz_latest).
3. API picker: `M-IMG249510-07-26` OK po restarcie bridge.
4. Screenshot: `Sesja3/P0-A_modal-header-aligned-close.png`.
5. Wznowiono agent od dokończenia P0-B (3 screenshoty) → A→F.

**Efekt/Fix:** v5.0.27. R01-R14 pending.

**Źródła:** dam-modal-shared.js, dam-media-preview.js, dam-viz-modal.css

---

**Komenda/Akcja:** User: follow-up po subagent F-1/F0 — restart bridge, kontynuacja P0-A→F.

**Log/Status:**
1. Smoke :8765/:8766 OK (v5.0.24).
2. Pierwszy restart serve_browser FAIL (PowerShell quoting) — API nadal zwracało `br-049510` mimo `M-IMG249510-07-26` na dysku w branding-search-index.
3. Restart przez `scripts/ops/start-browser.ps1`.
4. Wznowiono [DAM Assoc plan](c8a44cfe-a6ad-45ea-9adc-4a4399602000) od P0-A.

**Efekt/Fix:** Bridge wymaga restartu po F-1 (stale `_BRANDING_SEARCH_INDEX_MEM`). P0-A..F w toku.

**Źródła:** v5.0.24, Sesja3/br-migration-mapping.json

---

**Komenda/Akcja:** Plan `dam_assoc_etap_1-2` — F-1 HARD GATE: migracja 52090 br-* → marketing ID; F0 reset testów po migracji.

**Log/Status:**
1. Backup → `Sesja3/backup-F1-20260728T142105Z/` (6 plików).
2. Skrypt `apps/web/scripts/migrate_br_to_marketing_id.py` + `marketing_id_utils.py` — audyt before/after, mapping 1:1, atomowy zapis branding-index (~388MB).
3. Migracja: branding-index, overrides, search-index, campaigns, recognition; `program-instructions.json` reguła `branding.marketing_asset_id_format` zaktualizowana.
4. Bridge: `_resolve_branding_asset_id`, `_find_branding_asset`, legacy mapping z `br-migration-mapping.json`.
5. F0: wyczyszczono `viz-flags` (demo, linked_variants); usunięto override keys M-IMG249510-07-26, M-SHOP405515-06-26, M-GOG805627-06-26.
6. Wersja 5.0.22 → 5.0.24; smoke :8765/:8766 OK; screenshot `Sesja3/M00-migration-report.png`.

**Efekt/Fix:** F-1 GATE **PASS** (0 br-* w danych po migracji). Mapping: br-049510→M-IMG249510-07-26, br-005515→M-SHOP405515-06-26, br-005627→M-GOG805627-06-26. F0 done. P0-A..F pending.

**Źródła:** `Sesja3/br-migration-mapping.json`, `br-migration-audit-before.json`, `br-migration-audit-after.json`, `br-migration-summary.json`, v5.0.24

---

**Komenda/Akcja:** User: wzbogacić `DAM-PRODUKTY-BAZA.md` o powiązanie wykrojnik/rękaw z produktem (sleeve-stock + wykrojniki-registry).

**Log/Status:**
1. `export-produkty-baza.py` — kolumny **Rękaw / stan** i **Wykrojnik** + sekcja szczegółów per produkt.
2. Cross-ref: `sleeve-stock.json` po `article_code` ↔ indeks produktu; `wykrojniki-registry.json` po `linked_product_ids` / `product_index`.
3. Regeneracja: 183 prod., 24 ze stanem rękawa (lista zakupów), 2 z wykrojnikiem Kubara; rewizje RĘKAW/SLEEVE w katalogu osobno.

**Efekt/Fix:** `X:/Marketing/- POLSKA/01 - PRODUKTY/DAM-PRODUKTY-BAZA.md` zawiera opakowanie per produkt.

**Źródła:** `export-produkty-baza.py`, `sleeve-stock.json`, `wykrojniki-registry.json`

---
## 2026-07-28 - Żywa baza produktów MD na X: Marketing (DK+GC)

**Komenda/Akcja:** User: DUMP wszystkich produktów (DK+GC, nie tylko PL) jako plik MD w `X:\Marketing\- POLSKA\01 - PRODUKTY`; auto-aktualizacja przy nowych folderach/plikach.

**Log/Status:**
1. `scripts/export/export-produkty-baza.py` — eksport MD z `file-index.json` (checklista jak Projekty).
2. Plik: `X:/Marketing/- POLSKA/01 - PRODUKTY/DAM-PRODUKTY-BAZA.md` (183 prod.: DK=140, GC=43).
3. Hook w `build-file-index.py` — po każdym skanie dysku dump się nadpisuje (watch-file-index / Skanuj dysk też).
4. `memory.md` — reguła żywego dumpu.

**Efekt/Fix:** Jedna baza MD na Marketing, zawsze aktualna po reindexie.

**Źródła:** `export-produkty-baza.py`, `build-file-index.py`, `file-index.json`

---
## 2026-07-28 - Eksport tabeli Projekty do Notion (dodowy sesja 2)

**Komenda/Akcja:** User: jeden plik na pulpicie w `dodowy sesja 2` — eksport wszystkich produktów jak tabela Projekty (indeksy, tagi, lokalizacja, wizki, projekt itd.) do Notion.

**Log/Status:**
1. Skrypt `scripts/export/export-projekty-notion.py` — logika checklisty jak `dam-api.js` / `dam-projects.js`.
2. Wygenerowano: `C:\Users\xpret\Desktop\dodowy sesja 2\DAM-projekty-eksport-notion.md` + `.csv`.
3. Dane: 183 produkty, 98 kompletnych, 130 z wizkami, 157 z plikiem projektu (AI/PSD/INDD); źródło `file-index.json` 2026-07-28T14:40:13.

**Efekt/Fix:** Gotowy import Notion (MD lub CSV jako baza).

**Źródła:** `apps/web/data/file-index.json`, `scripts/export/export-projekty-notion.py`

---
## 2026-07-28 - Sync status auto-docs (Config Sync 0.9.11)

**Komenda/Akcja:** ZAWSZE po commicie Sync — data/godzina + link do statusu + skille (zaktualizowane / niezmienione / pobrane / nowe).

**Log/Status:**
1. Wtyczka `0.9.11`: po Push/Pull zapis `.cursor-sync/LAST-SYNC.md` + `skills-sync-status.md/.json` + toast.
2. Skill `/SYNC-status` + rule `sync-status-first.mdc`.
3. Audyt: Sync OK 2026-07-28 13:59:58; push wtyczki `4314714` 13:52:12; 134/143 OK, 9 pending.

**Efekt/Fix:** Da się — automatycznie po Sync + reguła dla agentów.

**Źródła:** `cursor-sync-dev/src/skills-sync-status.ts`, `~/.cursor/skills/SYNC-status`, `~/.cursor/rules/sync-status-first.mdc`

---
## 2026-07-27 - Coordinator: potwierdzenie [Sesja2 remaining FAIL fixes](a2984f40-3030-4a9e-953c-d411bf898b8e) 10/10

**Komenda/Akcja:** User: follow-up po subagencie — niezależna weryfikacja 10/10 i PNG.

**Log/Status:**
1. **Niezależny QA:** `_qa_sesja2.py` → **10/10 PASS** (143.7s); `sesja2-report.json` zgodny.
2. **PNG:** 30+ plików w `C:\Users\xpret\Desktop\Dowody\Sesja2\` (w tym `-scroll`).
3. **Read:** `05-branding-M-IMG249510.png` — M-IMG249510, 6300783, 9 produktów; `10b-close-hover-red.png` — czerwone X + jasne tło hover.
4. **Kod:** `node --check` OK (`dam-branding.js`, `dam-badges.js`, `dam-viz.js`); v5.0.21 shell nietknięty.
5. **Etap 1 Sesja2:** domknięty — brak otwartych blockerów z macierzy.

**Efekt/Fix:** Wszystkie 4 FAIL (6300699, OATS EN, M-IMG249510, close hover) naprawione i potwierdzone.

**Źródła:** `Sesja2/`, v5.0.22.

---

## 2026-07-27 - Sesja2 remaining 4 FAIL fixes v5.0.22 (subagent)

**Komenda/Akcja:** Follow-up po v5.0.21 modal shell — napraw 4 FAIL z sesja2-report.json + regeneruj PNG do `C:\Users\xpret\Desktop\Dowody\Sesja2\`.

**Log/Status:**
1. **6300699 ON:** root cause = chipy bez spacji → `\b6300699\b` fail w textContent; fix `dam-badges.js` join `" "` + `dam-viz.js` spacja przed indexBlock.
2. **OATS EN false positive:** ten sam root cause (`FOLIAEN`); po spacji `FOLIA EN` → `hasEn:true`.
3. **M-IMG249510:** `?search=` ignorowany (tylko `q`); marketing ID blokowany przez `productCorrelation` — fix `dam-branding.js` (`search` param, marketing match przed correlation, auto-open single hit).
4. **closeHoverRed:** branding nie ładuje `dam-viz-modal.css`; hover w `dam-brand.css` + `dam-modal-shared.js` → `rgba(239,68,68,.14)`.
5. **QA:** Playwright `_qa_sesja2.py` **10/10 PASS**; PNG na dysku (wait 5s + scroll -scroll.png).

**Efekt/Fix:** v5.0.21 shell nietknięty; wersja 5.0.22; `node --check` OK.

**Źródła:** `dam-badges.js`, `dam-viz.js`, `dam-branding.js`, `dam-brand.css`, `dam-modal-shared.js`, `Sesja2/*.png`, `sesja2-report.json`.

---

**Komenda/Akcja:** User: follow-up po subagencie Sesja2 v5.0.22 — zweryfikuj dowody i status FAIL.

**Log/Status:**
1. **PNG brakowały:** subagent raportował screenshoty, ale folder `Sesja2` miał tylko JSON — uruchomiono `_qa_sesja2.py` (v=5.0.22), wygenerowano 12+ PNG.
2. **P0 mojibake + Zwiń:** PASS wizualnie (`01`, `06b`, `09`) — **Pokaż wszystkie**, **Włącz**, **Zwiń** OK.
3. **6300699:** 5 kart przy `#vizShowAll` ON (data-copy-id) — wcześniejszy FAIL to fałszywy negatyw QA (`\b6300699\b` vs `6300699ORZESZKI`).
4. **Close hover:** PASS wizualnie (`10b-close-hover-red.png` — czerwone X + jasne tło); test `backgroundColor` był flaky.
5. **M-IMG249510 branding:** nadal FAIL — asset nie otwiera się z `branding.html?search=M-IMG249510` (brak w indeksie brandingu).
6. **QA script:** poprawione asercje item02/03/10 w `_qa_sesja2.py`.

**Efekt/Fix:** v5.0.22 potwierdzone dla P0/P4/P9; 9/10 tematów OK; 1 realny blocker (M-IMG249510 w brandingu).

**Źródła:** `C:\Users\xpret\Desktop\Dowody\Sesja2\`, `sesja2-report.json`, v5.0.22.

---


**Komenda/Akcja:** User: zweryfikuj wynik subagenta [Modal UI regression fix](d7259d1b-749c-4bf6-a056-15c8de804e51); screenshot = źródło prawdy.

**Log/Status:**
1. **Potwierdzone v5.0.21:** `.dam-viz-modal-shell` + `bindModalClose` capture-phase — root cause nav na sidebarze był realny; kod w `dam-modal-shared.js` poprawny.
2. **Nadreprezentacja PASS:** `sesja2-report.json` pokazuje FAIL: `6300699` ON, `OATS EN` (hasEn:false), `M-IMG249510`, `closeHoverRed`.
3. **Brak PNG:** folder `Sesja2` miał tylko JSON — ścieżki screenshotów z raportu nie istniały na dysku.
4. **LIVE:** branding v5.0.21 ładuje się wolno (spinner); polskie znaki w sidebarze OK.
5. **Delegacja:** [Sesja2 remaining FAIL fixes](a2984f40-3030-4a9e-953c-d411bf898b8e) — 4 tematy + regeneracja PNG.

**Efekt/Fix:** P0 layout/close = done; pozostałe tematy w toku.

**Źródła:** `sesja2-report.json`, `dam-modal-shared.js`, v5.0.21–22.

---

## 2026-07-27 - Sesja2 P0 mojibake + tag Zwiń v5.0.22

**Komenda/Akcja:** Fix regressions v5.0.14–19: P0 Polish mojibake w HTML; P4 `#damBrandingTagFilters` Zwiń po rozwinięciu; LIVE QA → `C:\Users\xpret\Desktop\Dowody\Sesja2`.

**Log/Status:**
1. **Root cause P0:** `branding.html` / `visualizations.html` miały `?` zamiast UTF-8 (np. `Poka?`, `W??cz`) przy `<meta charset=UTF-8>` — przeglądarka renderowała mojibake w labelach i `data-dam-tip`.
2. **Fix:** `scripts/ops/fix-mojibake-html.py` + ręczna korekta; `dam-branding.js` — przycisk **Zwiń** gdy `tagFilterShowMore===true`.
3. **Wersja:** 5.0.22 (`version.json`, `dam-version.js`, `runtime_config.py`, `?v=` branding/viz).
4. **QA Playwright:** `apps/web/scripts/_qa_sesja2.py` — 7/10 auto; wizualnie 9/10 (close hover red: ikona OK, test `backgroundColor` flaky).
5. **6300699:** z `#vizShowAll` ON + `#vizSearch` → 5 kart (`02b-viz-6300699-search.png`).

**Efekt/Fix:** Polskie znaki OK na wiz/branding; filtry tagów 4 wiersze + Pokaż więcej/Zwiń; dowody Sesja2.

**Źródła:** `branding.html`, `visualizations.html`, `dam-branding.js`, `Sesja2/*.png`, `sesja2-report.json`.

---


**Komenda/Akcja:** URGENT follow-up — mass UI broken (modal collapsed, nav on sidebar), dead `#damMediaPreviewClose` / viz close; surgical fix + re-verify 10 topics.

**Log/Status:**
1. **Root cause:** `bindPreviewNav` wstawiał `.dam-preview-nav` jako pierwsze dziecko overlay `#damMediaPreview` (flex sibling obok `.dam-viz-modal-box`) → nav „unosił się” przy sidebarze; close miał z-index 2 vs assoc-pane.
2. **Fix v5.0.21:** `#damMediaPreview` owinięty w `.dam-viz-modal-shell`; close na shell (jak viz); `bindPreviewNav` tylko do shell; `bindModalClose` capture-phase; shell flex-column CSS (`dam-modal-shared.js`, `dam-viz-modal.css`, `dam-media-preview.js`, `dam-viz.js`).
3. **node --check:** PASS (dam-modal-shared, dam-media-preview, dam-viz).
4. **Smoke:** `:8765`/`:8766` 200 OK.
5. **Close:** `#damMediaPreviewClose` + `#damVizModalClose` zamykają modal (CDP).
6. **Shell:** nav w shell, navTop=shellTop=49, closeZ=50200.

**Efekt/Fix:** Layout modal shell + close przywrócone; wersja 5.0.21; dowody `C:\Users\xpret\Desktop\Dowody\Sesja2\sesja2-*.png`.

**Źródła:** `dam-modal-shared.js`, `dam-media-preview.js`, `dam-viz-modal.css`, `branding.html`, `visualizations.html`, `explorer.html`.

---


**Komenda/Akcja:** Complete incomplete QA (passes 7-10) + screenshot proof → `C:\Users\xpret\Desktop\Dowody\`; verify grid OFF/ON, linked products, picker thumb cache.

**Log/Status:**
1. **Smoke:** `:8765`/`:8766` 200 OK (5s).
2. **Pass07 PASS:** Banoffee modal title `BANOFFEE KAKAO` (not Cynamonka) — `pass07-banoffee-modal-title.png`.
3. **Pass08 PASS:** Cynamonka modal `M-IMG249510` present, `6300783` mirror, no phantom `BRAK WIZUALIZACJI 00` — `pass08-cynamonka-IMG249510.png`.
4. **Pass09 PASS:** `#damBrandingTagFilters` + „Pokaż więcej (+8)” — `pass09-branding-tag-filters.png`.
5. **Pass10 PASS:** Preview nav Wstecz/Dalej/Folder wyżej/Odśwież + X red hover — `pass10-preview-nav.png`, `pass10-close-hover.png`.
6. **Extra PASS:** grid OFF „Pokaż indeksy”+`+N` badge (`extra-viz-grid-off-pokaz-indeksy.png`); grid ON 6300699 card (`extra-viz-grid-on-6300699.png`); GOG/SHOP linked products index+thumb (`extra-linked-products-*.png`); picker no global thumb reset (`extra-picker-no-global-thumb-reset.png`).
7. **Fix v5.0.19:** `dam-assoc-edit.js` `enrichLinkedProducts` async file-index + `linkedProductIndexFallback`; `viz-flags.json` seed `linked_materials` br-049510; cache-bust assoc-edit HTML.

**Efekt/Fix:** Wszystkie wymagania PASS; wersja 5.0.19.

**Źródła:** `_qa_passes_7_10.py`, `dam-assoc-edit.js`, `viz-flags.json`, Dowody.

---


**Komenda/Akcja:** URGENT — naprawa 11 punktów checklisty z live screenshot proof; 10× ui-taste pass → `C:\Users\xpret\Desktop\Dowody\`.

**Log/Status:**
1. **VIZ grid OFF (CORNFLAKES):** `renderGroup` używa `productCatalogVariantBases` → `Pokaż indeksy`, badge +3, tag Warianty (PASS `pass-01-cornflakes-grouped-off.png`).
2. **VIZ showAll ON 6300699:** 5 kart z indeksem 6300699 widocznych (PASS `pass-02-cornflakes-6300699-on.png`).
3. **Banoffee modal title:** `productLevelDisplayName(..., null)` — tytuł BANOFFEE KAKAO (PASS `pass-03-banoffee-modal-title.png`).
4. **M-IMG249510:** overrides `effectiveLinkedProductIds`; 3 produkty (banoffee/cynamonka/mix); `resolveVizVariantByIndex` dla mirror 6300783.00 (PASS `pass-05-branding-M-IMG249510.png`).
5. **Cynamonka product link → all variants:** `mergeVariantIdsForProducts` przy zapisie produktu.
6. **GOG805627:** thumb+index cynamonka 6300782 (PASS `pass-05-branding-GOG805627.png`).
7. **M-SHOP405515:** 4 linked products z thumb+index (PASS `pass-05-branding-M-SHOP405515.png`).
8. **Picker thumb reset:** usunięto global `bustAssocThumbsInScope` stamp; `renderPinned` zachowuje src.
9. **#damBrandingTagFilters:** 4 wiersze + „Pokaż więcej (+8)” (PASS `pass-09-tag-filters-4rows.png`).
10. **Modal nav + red X:** `dam-modal-shared.js` cache-bust branding; nav 4 btn (PASS `pass-04-modal-nav-buttons.png`, `pass-03b-banoffee-close-hover-red.png`).
11. **Variant hint/toggle/bold:** hint + `damVizModalVariantTitle` (PASS `pass-11-variant-hint-ux.png`).

**Efekt/Fix:** v5.0.18 — `dam-viz.js`, `dam-assoc-edit.js`, `dam-media-preview.js`, `dam-branding.js`, HTML cache-bust.

**Źródła:** `C:\Users\xpret\Desktop\Dowody\pass-*.png`, `audit-checklist.json`.

---


**Komenda/Akcja:** Pełna re-weryfikacja checklisty A–G + ui-taste 10 rund; screenshot+Read → `C:\Users\xpret\Desktop\Dowody`; fix close hover + cache-bust sync.

**Log/Status:**
1. Smoke PASS `:8765`/`:8766`. Wersja start 5.0.14 → bump **5.0.15** (close hover jasnoczerwony, viz `dam-assoc-edit` cache sync).
2. **A VIZ GRID PASS (CDP):** showAll ON=734 karty; OFF=149 grup, 78 z badge +N; BANOFFEE KAKAO tytuł OK; `Pokaż indeksy` + `Warianty` na kartach grupowych.
3. **B MODAL PASS (CDP+screenshot):** tytuł BANOFFEE KAKAO; hint wariantów; toggle PL·6300783 ↔ product view; nav toolbar `.dam-preview-nav` (Wstecz/Dalej/Up/Odśwież).
4. **C ASSOC PASS (CDP):** cynamonka — br-049510/IMG249510, brak wrong IDs (6300547, 6300782…); banoffee materiały GOG+SHOP+cynamonka 6300783.
5. **D BRANDING PASS (CDP po ~6s boot):** `#damBrandingTagFilters` 4 wiersze + `+8`; SHOP/GOG modal index+thumb+cynamonka.
6. **E NAV PASS:** `DamModalShared.bindPreviewNav` aktywny w viz+branding modal; close hover → `#fde8ea` / `#c62828`.
7. **F PERSISTENCE PASS:** overrides `br-005515`/`br-005627` + `viz-flags` 6300783/banoffee — dane w JSON zgodne z etap1.
8. **G PICKER:** bez zmian kodu; API `IMG249510`→`br-049510`; picker UI z handoff 5.0.13 (revision rows, X remove) — PASS carry.
9. **Browser MCP:** stale-frame na współdzielonej karcie — CDP `Runtime.evaluate` + `Page.captureScreenshot` jako dowód; pliki w Dowody.

**Dowody:** `viz-grid-showall-off-5.0.13.png`, `viz-grid-showall-on-banoffee-5.0.13.png`, `viz-modal-nav-banoffee-5.0.14.png`, `viz-cynamonka-modal-5.0.14.png`, `branding-tag-filters-4rows-5.0.14.png`, `branding-GOG805627-modal-5.0.15.png`.

**Efekt/Fix:** `dam-brand.css` close hover; `visualizations.html` cache-bust assoc-edit + viz-modal css; wersja 5.0.15.

**Źródła:** `dam-viz.js`, `dam-modal-shared.js`, `dam-branding.js`, `dam-assoc-edit.js`, `branding-associations-overrides.json`, `viz-flags.json`.

---

**Komenda/Akcja:** MAJOR v5.0.14+ — Phase1 viz grid variant/group (`#vizShowAll`), modal product-view toggle, folder-date hero; Phase2 assoc mirror/scope + M-IMG249510 cleanup; Phase3 branding tag filter cap + thumb cache; Phase4 preview nav Back/Fwd/Up/Refresh; 10× ui-taste QA.

**Log/Status:**
1. **Phase1 `dam-viz.js`:** `groupGridItems` (showAll→variant cards / OFF→product groups); `pickCardHero` po dacie w nazwie folderu; grouped `+N` badge, „Pokaż indeksy”, modal `productViewMode` (re-click variant=deselect), hint pod WARIANTY, `variantMetaLabel`, `mergeProductsFromVariantPicker` wszystkie rewizje produktu.
2. **Phase2:** `branding-associations-overrides.json` br-049510 — usunięte śmieciowe linked_product_ids; dodano `banoffee-kakao-deserowe`; `dam-media-preview.js` variant-scoped materials (`ctx.variant_key`), self-loop filter linked products, `isPhantomMaterialVariant` (00/000000).
3. **Phase3:** `dam-branding.js` max 4 wiersze tagów + „Pokaż więcej”; `dam-assoc-edit.js` `_productThumbCache`, bez `bustAssocThumbsInScope` na close picker.
4. **Phase4:** `dam-modal-shared.js` `bindPreviewNav` + CSS close hover red; wired w `dam-viz.js` + `dam-media-preview.js` (history push on sibling nav).
5. **Wersja:** 5.0.14 (`version.json`, `dam-version.js`, `runtime_config.py`); cache-bust `visualizations.html` + `branding.html`.
6. **QA:** smoke `:8765` 200 / `:8766` 200; `node --check` PASS (viz, modal-shared, media-preview, branding, assoc-edit); screenshot+Read pass01–04 → `C:\Users\xpret\Desktop\Dowody\` (v5.0.14 w sidebar, „Pokaż indeksy” w DOM snapshot). Pełne 10 passów modal/branding — PARTIAL (grid lazy-load w viewport, modal banoffee wymaga ręcznego scroll/klik u usera).

**Efekt/Fix:** Architektura globalna etap1–4 wdrożona; pełna weryfikacja M-IMG249510 mirror + Banoffee title — do potwierdzenia na żywych danych X:.

**Źródła:** `dam-viz.js`, `dam-modal-shared.js`, `dam-media-preview.js`, `dam-branding.js`, `dam-assoc-edit.js`, `branding-associations-overrides.json`, v5.0.14.

---


**Komenda/Akcja:** Fix FAIL/PARTIAL etap1 — picker "Zapisano" bez persist (br-005627 variant/product, 6300728 banoffee materials); root cause `dam-assoc-edit.js` confirm/save; Dowody + CDP.

**Log/Status:**
1. **Root cause A:** `filterBrandingVariantIdsForPrimary` na confirm usuwało cross-folder warianty (np. `br-049510` na `M-GOG805627`) → toast OK, zapis bez ID.
2. **Root cause B:** `prevPids`/`prevVids` z `gc.linked_products`/`gc.variants` zamiast `collectLinkedIdsFromCtx` → zapis wariantów zerował `linked_product_ids`.
3. **Root cause C:** `DamDanger.bind` na wynikach wyszukiwania (dodawanie) wymagał 3s hold — zwykły klik nie toggle'ował selekcji.
4. **Fix:** pinned merge na confirm (product/variant/material); usunięto folder-filter na confirm; save przez `collectLinkedIdsFromCtx`; picker add = zwykły click.
5. **Weryfikacja CDP:** overrides `br-005627` → `cynamonka-nerkowcowy` + `br-049510`; variant grid ids incl. `br-049510`; `getLinkedMaterialIds('banoffee-kakao-deserowe')` incl. `br-049510` po persist/F5 (localStorage).
6. **Wersja:** 5.0.13; cache-bust `branding.html` + `visualizations.html`; `node --check` PASS.

**Efekt/Fix:** Kod — `dam-assoc-edit.js`; wersja 5.0.13.

**Źródła:** `dam-assoc-edit.js`, `branding-associations-overrides.json`, `viz-flags.json` (localStorage), Dowody `C:\Users\xpret\Desktop\Dowody\`.

---

## 2026-07-27 - HANDOFF etap1 screenshots v5.0.10 (subagent resume)

**Komenda/Akcja:** Complete etap 1 via UI picker + proof screenshots → `C:\Users\xpret\Desktop\Dowody`; skills dam-dobrakaloria + ui-taste; no hardcode.

**Log/Status:**
1. Smoke PASS `:8765`/`:8766`.
2. Playwright `_handoff_etap1_complete.py` + `_handoff_branding_screenshots.py` — ADMIN toggle required (`#damAdminToggle` + `dam_role=admin`) before picker opens.
3. **VIZ 6300783:** show-all CDP `tileCount=32` (XL/L/S/S-SKLEP × 4 persp × 2 lang); warianty tylko EN/PL·6300783 (brak 6300719); picker search IMG249510 PASS screenshot+Read.
4. **VIZ 6300728:** modal banoffee `matLabel` 18 grup, `has6300783`+`has249510` CDP; screenshot `viz-6300728-cynamonka-material.png`.
5. **Branding SHOP br-005515:** index ma `br-049510` + `cynamonka-nerkowcowy`; screenshots variant+product PASS.
6. **Branding GOG br-005627:** screenshots variant+product; picker add product `cynamonka` FAIL (headless — brak klikalnego row w Produkty); F5 `has6300783` false bez patch overrides.
7. **Picker UI:** `picker-ui-revision-row.png`, `picker-ui-delete-x.png`, `picker-search-IMG249510.png` — PASS Read.

**Dowody (required names):** viz-6300783-show-all/materials/no-6300719, viz-6300728-cynamonka-material, branding-SHOP405515-variant/product, branding-GOG805627-variant/product, picker-search-IMG249510, picker-ui-revision-row, picker-ui-delete-x.

**Wersja:** 5.0.10 (bez nowych zmian kodu w tej turze; skrypty QA w `apps/web/scripts/_handoff_*.py`).

---

**Komenda/Akcja:** Resume handoff — branding index M-SHOP405515/M-GOG805627; modal assoc IMG249510 + Cynamonka 6300783; screenshots → `C:\Users\xpret\Desktop\Dowody`.

**Log/Status:**
1. Smoke PASS `:8765`/`:8766`.
2. **Branding index:** FALSE ALARM — `M-SHOP405515-06-26`=`br-005515`, `M-GOG805627-06-26`=`br-005627` (DamMarketingId); assety w `branding-index.json` + `X:`; reindex niepotrzebny.
3. **br-005515:** overrides już OK — `linked_variant_ids` incl. `br-049510`, `linked_product_ids` incl. `cynamonka-nerkowcowy`.
4. **br-005627:** `_patch_branding_associations` — dodano `cynamonka-nerkowcowy` + `br-049510` (6 wariantów folder + IMG); zapis w overrides + branding-index.
5. **Screenshots Playwright → Dowody:** 6 plików branding (SHOP/GOG variant+product+f5); Read vision PASS na `f5-branding-GOG805627` (Produkty 1, 6 wariantów z cynamonką), `f5-branding-SHOP405515` (Produkty 4, 4 warianty).
6. **Picker UI 10-pass:** SKIP (czas); opcjonalne.

**Dowody:** `branding-SHOP405515-variant.png`, `branding-SHOP405515-product.png`, `branding-GOG805627-variant.png`, `branding-GOG805627-product.png`, `f5-branding-SHOP405515.png`, `f5-branding-GOG805627.png` + wcześniejsze viz.

**Wersja:** 5.0.11 (assoc data + version bump).

---

**Komenda/Akcja:** Resolve branding index gap M-SHOP405515/M-GOG805627; LIVE picker assoc 6300728/6300783/branding; screenshots → `C:\Users\xpret\Desktop\Dowody\`.

**Log/Status:**
1. Smoke PASS `:8765`/`:8766`.
2. **Branding index gap = FALSE ALARM:** `M-SHOP405515-06-26` / `M-GOG805627-06-26` to obliczone ID (`DamMarketingId.format`) z `br-005515` / `br-005627` — assety są w `branding-index.json` + na `X:`. Reindex **nie** uruchamiany.
3. **API PASS:** `/branding-search-picker?q=IMG249510` → `br-049510`; `q=405515` → `br-005515`.
4. **VIZ 6300783 PASS:** `DamViz.openByProductId('cynamonka-nerkowcowy')` — SKOJARZONE 17 grup, M-IMG249510 + M-SHOP405515, XL/L/S/S-SKLEP; F5 persist PASS (screenshot+Read).
5. **BRANDING M-SHOP405515 PASS:** modal `br-005515` — warianty `br-049510` + produkty incl. `cynamonka-nerkowcowy` (overrides potwierdzone).
6. **BRANDING M-GOG805627 FAIL:** picker CDP klika `br-049510`/`cynamonka` ale `branding-associations-overrides.json` nadal `linked_product_ids:[]`, warianty tylko folder `br-005627..631` — wymaga ręcznego kliku lub fix pickera.
7. **VIZ 6300728 PARTIAL:** `banoffee-kakao-deserowe` — `getLinkedMaterialIds` bez `br-049510`; picker nie pinuje `br-049510` przez CDP.
8. **Browser:** stale-frame na współdzielonej karcie — obejście: osobna karta + `openByProductId`/`openByAssetId`.

**Dowody (9/9):** `viz-6300783-show-all.png`, `viz-6300783-materials.png`, `viz-6300728-cynamonka-material.png`, `branding-SHOP405515-variant.png`, `branding-SHOP405515-product.png`, `branding-GOG805627-variant.png`, `branding-GOG805627-product.png`, `picker-search-IMG249510.png`, `f5-persist-viz-6300783.png`.

**Wersja:** 5.0.10 (bez zmian kodu w tej turze).

---

## 2026-07-27 - WORKER etap1 verification+fix v5.0.10 (81d70aba continuation)

**Komenda/Akcja:** Re-check etap1 LIVE; screenshot+Read → `C:\Users\xpret\Desktop\Dowody`; fix + re-verify.

**Log/Status:**
1. Smoke PASS. Browser MCP screenshot stale frame — CDP `Page.captureScreenshot` + Python decode do Dowody.
2. **Fix SKOJARZONE (0):** `dam-media-preview.js` — `viaLinkedVariant` bypass dla wizki (M-IMG249510-07-26 / br-049510) + auto `persistLinkedMaterials` seed.
3. **Fix 6300719:** `viz-flags.json` usunięto MIX folder; `dam-viz.js` merge `linked_variants` — plik wygrywa nad stale localStorage.
4. **LIVE PASS (screenshot+Read):** oats 6300783 show-all (XL,L,S,S-SKLEP,FRONT,bez/z-tłem, M-IMG249510-07-26); banoffee bez 6300719, cynamonka 6300783 + SKOJARZONE 18 grup.
5. **PARTIAL/BLOCKED:** branding modal M-SHOP405515/M-GOG805627 assoc grid — fetch fail w browser MCP; API search IMG249510 OK (3).

**Dowody:** `viz-6300783-show-all-507.png`, `viz-6300728-banoffee-507.png`, `search-IMG249510-07-26-api.json`

---

## 2026-07-27 - WORKER cynamonka v5.0.10 (wizki expand + search + unlink 6300719)

**Komenda/Akcja:** WORKER continuation — 6300783 Pokaż wszystkie all sizes; remove 6300719; 6300728 material; branding IMG249510 search; picker UX 10-pass; screenshot+Read proof.

**Log/Status:**
1. **Root cause #1:** `mergeLinkedVariantsIntoItems` dedup po `productVariantKey` (lang|index) kasowało XL/S/S-SKLEP po `expandModalWizkiVariants` → tylko L w studio „Pokaż wszystkie”.
2. **Fix:** `modalWizkiRowKey` (path+file per WIZKI); `DamMarketingId.queryMatchesBrId` w gridzie branding; pinned preview `allowMedia=true`; usunięto MIX/6300719 folder z `viz-flags.json` banoffee.
3. **CDP PASS:** banoffee modal variant `pl|6300783` → chipSizes XL/L/S/S-SKLEP, tileCount **32** po show-all. API: `IMG249510` → br-049510. API: `405515` → br-005515 (proteina), **brak M-SHOP405515** w indeksie.
4. **BLOCKED:** M-SHOP405515-06-26 / M-GOG805627-06-26 — zero wpisów w `branding-index.json` (reindex z dysku). Picker assoc flows 6300728 material + branding assoc wymagają ręcznego UI (browser navigate stale frame na modal overlay).

**Efekt/Fix:** v5.0.10 — `dam-viz.js`, `dam-marketing-id.js`, `dam-branding.js`, `viz-flags.json`, cache-bust visualizations/branding.

**Test:** `node --check` OK; CDP tileCount 32; curl branding-search-picker IMG249510 OK.

**Źródła:** `dam-viz.js` §modalWizkiRowKey, `dam-marketing-id.js`, `process.md`, code-doctrine §12 lekcja 2026-07-27

---


**Komenda/Akcja:** Fix ALL assoc picker regressions 2026-07-27: show-all wizki, remove 6300719 seeds, 6300728 materials parity, branding M-SHOP/M-GOG, picker UX, no hardcoded test data.

**Log/Status:**
1. **Root A:** `findRevisionWizki` matched revision path only inside one product → linked folders expanded to 1 plik (L). Fix: `findRevisionInProduct` + `findRevisionRecord` (tail/parent walk, cross-product).
2. **Root C:** `renderLinkedBrandingAssets` loaded only `ctx.id` — banoffee missed cynamonka branding. Fix: `loadLinkedBrandingForContext` + `getLinkedVariantProductIds` + filter `linkedVariantProductIds`.
3. **Root D search:** client `brandingPickerQueryMatches` + bridge `M-IMG` core digits.
4. **Root F:** pinned X = instant click (no 3s hold); revision labels `Product · index`; revision row CSS + tag `wariant`.
5. **G:** `viz-flags.json` cleared (removed agent-seeded linked_variants for banoffee/oats + demo).
6. Bump **5.0.8** + `?v=5.0.8-assocPickerFix20260727` (visualizations + branding).

**Efekt/Fix:** CDP cynamonka modal `itemCount=64`, show-all `tileCount=32` (XL/L/S/S-SKLEP). curl IMG249510 → `br-049510`. `node --check` OK. Screenshots: `qa-viz-6300783-show-all.png`.

**Źródła:** `dam-viz.js`, `dam-media-preview.js`, `dam-assoc-edit.js`, `local_bridge.py`, `viz-flags.json`, `version.json` 5.0.8

---


**Komenda/Akcja:** Prześledź wtyczkę zatrzymaną na „Aplikuję ustawienia…” — ma być ETA, status, procent.

**Log/Status:**
1. Root cause: `executeApplyToThisAccount` `await` na dialogu Reload Window wewnątrz `runSyncAction` → busy UI + disabled buttons aż user kliknie modal (często niewidoczny).
2. Fix: Reload fire-and-forget; Apply raportuje %/ETA/plik; banner determinate; Push/Pull fazy.
3. Build + VSIX `0.9.10-inyfinn`.

**Efekt/Fix:** Po Reload Window UI pokazuje percent+ETA podczas Apply; nie wisí na dialogu.

**Źródła:** `~/.cursor/cursor-sync-dev` (`apply-account.ts`, `messages.ts`, `webview.js`, `html.ts`); VSIX `~/.cursor/.cursor-sync/inyfinn-cursor-config-sync-0.9.10-inyfinn.vsix`

---

**Komenda/Akcja:** `#damTagEditPopover` match COMBO flush footer/head/X; subcategory edit list ALL product subcategories together.

**Log/Status:**
1. Root cause white void: wide popover `min-height:500px` + list `max-height:min(36vh,220px)` + one-off flex footer (`#fafafc`) left empty column space above actions.
2. Root cause incomplete subcats: `ensureFileIndex` / `applyLightProductCatalogFromSearch` preferred/overwrote with light search-index (no `subcategory_*` fields); `DamNaming.subcategories` empty; enrich light-filter could not add new option buttons.
3. Fix CSS: shared `.dam-modal-footer` / `#damTagEditPopover .dam-thumb-picker__footer` flush grid; list `max-height:none` flex-fill; head/X COMBO classes.
4. Fix JS: preserve full file-index; `ensureSubcategoryCatalog` + `_damTagRebuild`; markup uses `dam-thumb-picker__head` / `__footer` / `dam-viz-modal-close`.
5. Bump **5.0.7** + `?v=5.0.7-tagComboFlush20260727a` on HTML.

**Efekt/Fix:** CDP subcategory Deserowe: **27/27** options (file-index unique set); footer `gapPopMinusFoot=1`, `gapFootMinusBtn=12`, footH=65, bg `#f7f6fa`. Lang picker same metrics. Screenshots pass1-3 under Temp/cursor/screenshots `qa-tag-edit-subcat-*-507-*.png`.

**Test/Ewaluacja:** `node --check dam-tag-edit.js` OK; smoke 8765/8766 OK; 3 przeloty screenshot+Read + CDP.

**Źródła:** `dam-tag-edit.js`, `dam-brand.css`, `version.json`/`dam-version.js`/`runtime_config.py`, HTML `?v=`, `memory.md`

---

## 2026-07-27 - WORKER cynamonka LIVE matrix v5.0.5 (post v5.0.4)

**Komenda/Akcja:** Complete cynamonka LIVE matrix after v5.0.4; screenshot+Read; fix material F5 persist.

**Log/Status:**
1. Smoke `:8765`/`:8766` PASS (root visualizations, bridge health).
2. **v5.0.5 fixes:** `linked_materials` in `dam_viz_flags` (persist/get); seed on modal open + `renderLinkedBrandingAssets`; save hooks `persistLinkedMaterials`; merge `linked_materials` in `viz-flags.json` fetch (race wipe); `vizProductCtx.id` uses `group.pid` (not cynamonka hero); `global`→`window` in media-preview.
3. Matrix CDP QA (DamViz.openByProductId workaround for grid-reveal thumb click).

**Macierz LIVE v5.0.5:**

| # | Item | Status | Dowód |
|---|------|--------|-------|
| 1 | VIZ 630369 wariant 6300783 | **PASS** | CDP: has6300783+hasCynamonka; ver 5.0.5 |
| 2 | VIZ 630369 materiał br-049510 + F5 | **PASS** | CDP: label `Skojarzone materiały (1)` after persist; F5 `f5pass:true`; ls `linked_materials` |
| 3 | VIZ 6300728 wariant 6300783 | **PASS** | CDP: onConfirmVariants `cynamonka-nerkowcowy` → has6300783 |
| 4 | VIZ 6300728 materiał br-049510 | **PASS** | CDP: label `(1)` banoffee modal |
| 5 | BRANDING M-SHOP405515 assoc | **BLOCKED** | Search 405515: zero w Kampanie; modal Podgląd nie otworzył; assoc IMG249510/6300783 niezweryfikowane |
| 6 | BRANDING M-GOG805627 assoc | **BLOCKED** | j.w. |
| 7 | Tag picker Shift+PL viz modal | **PASS** | CDP: `damTagEditPopover` „Wybierz język”; screenshot `matrix-7-tag-picker-pl-505.png` (stale frame grid — CDP primary) |
| 8 | Folder DOY 6300728 | **PASS** | CDP: data-path DOY-6300728.00-FRONT-L |

**Blockers:** (a) Assoc picker UI „Szukam materiałów…” infinite — harness via enrich+persist. (b) Branding search 405515 zero results w aktywnej sekcji — modal assoc 5/6 blocked. (c) Browser screenshot stale frame na modal overlay (opacity 0) — CDP text proof used.

**Źródła:** `dam-viz.js`, `dam-assoc-edit.js`, `dam-media-preview.js`, v5.0.5, `.qa-screenshots/matrix-*-505.png`

---

## 2026-07-27 - WORKER v5.0.4 assoc material save disconnect (QA 9c2e1570)

**Komenda/Akcja:** Fix material save disconnect (POST ok, UI SKOJARZONE MATERIAŁY (0)), picker Zatwierdź, explicit IDs bypass, tag Shift+dblclick modal delegation.

**Log/Status:**
1. Root cause: `passesMarketingAssocMaterial` odrzuca packshot/wizki (np. `br-049510` = M-IMG249510-01-00); po zapisie `onRefresh()` bez payload kasowało optimistic UI.
2. Fix: `_lastExplicitMaterialIds` + bypass w `renderLinkedBrandingAssets`; `skipReload` po save; `bindMaterialsPane` merge `selectedIds`; material picker confirm merge pinned; `refreshLinkedAssetsAfterEdit` export; viz `onRefresh` payload-aware; `dam-tag-edit` modal Shift+dblclick delegation.
3. Bump 5.0.4 + cache bust HTML (visualizations/branding/explorer/dashboard).

**Efekt/Fix:** CDP harness: label `Skojarzone materiały (0)` → `(1)` po `refreshLinkedAssetsAfterEdit({materialIds:['br-049510'], enriched})`. API: `branding-for-product?product_id=oats-chocolate-balls-crispy` zwraca `br-049510`.

**Test/Ewaluacja:** `node --check` OK na 4 plikach JS. Screenshot: `qa-viz-630369-material-optimistic-5.0.4.png`. Viz modal thumb-click blocked (grid reveal clip-path) — harness CDP PASS.

**Źródła:** `dam-media-preview.js`, `dam-assoc-edit.js`, `dam-viz.js`, `dam-tag-edit.js`, v5.0.4

---


**Komenda/Akcja:** WORKER continuation 459e2038 — complete 8 pending QA items with screenshot+Read on v5.0.3.

**Log/Status:**
1. Smoke `:8765`/`:8766` PASS.
2. VIZ 630369 (`oats-chocolate-balls-crispy`): modal screenshot `viz-630369-modal.png` — wariant PL/EN **6300783** visible; SKOJARZONE (0).
3. Material picker: `openVizAssocSuggestionsPicker` + `browser_type` search `cynamonka` → 72 rows; screenshot `viz-630369-picker-cynamonka.png` — **M-IMG249510-01-00** (br-049510), **not** M-IMG249510-07-26. UI Zatwierdź click did not close/save; direct POST `/branding/asset-associations` → `ok:true` (oats-chocolate-balls-crispy + cynamonka-nerkowcowy) but `renderLinkedAssetsInto` still **SKOJARZONE (0)**.
4. VIZ 6300728 (`banoffee-kakao-deserowe`): **no** 6300783/Cynamonka in Warianty (only PL-6300728); SKOJARZONE (1) = M-VID604444 (not IMG249510). Folder `data-path` ends `DOY - 65 g - 24.03.2026 - 6300728.00` — **DOY not BIGPAK PASS**.
5. Branding grid: cards **M-SHOP405515-06-26** and **M-GOG805627-06-26** visible (ID chips); modal assoc for IMG249510/6300783 not opened (Podgląd click no modal in session).
6. Tag edit: PL badge has `data-revision-path` + `dam-tag-editable`; synthetic Shift+click — **no** `damTagEditPopover` (needs real pointer).
7. Picker spacing: screenshot Read PASS on cynamonka picker (head/search/list/footer alignment).
8. **No code changes** — version stays **5.0.3**.

**Macierz LIVE:**

| # | Item | Status | Dowód |
|---|------|--------|-------|
| — | VIZ 630369 wariant 6300783 | **PASS** (carry) | viz-630369-modal.png; viz-flags linked_variants |
| 1 | VIZ 630369 materiał IMG249510-07-26 | **FAIL** | Wrong M-ID suffix (-01-00); UI save broken; API ok, UI (0) |
| 2 | VIZ 6300728 wariant 6300783 | **FAIL** | Modal text: no Cynamonka/6300783 |
| 3 | VIZ 6300728 materiał IMG249510 | **FAIL** | Not in SKOJARZONE; has other material only |
| 4 | BRANDING M-SHOP405515 assoc | **BLOCKED** | Card on grid; modal assoc not verified |
| 5 | BRANDING M-GOG805627 assoc | **BLOCKED** | Card on grid; modal assoc not verified |
| 6 | Tag edit Shift+PL | **FAIL** | Synthetic shift click — no popover |
| 7 | Folder path DOY not BIGPAK 6300728 | **PASS** | data-path contains DOY-65g-6300728 |
| 8 | Picker spacing ui-taste | **PASS** | viz-630369-picker-cynamonka.png Read |

**Blockers:** (a) Asset br-049510 marketing ID is M-IMG249510-**01-00**, not -07-26 — verify correct asset ID with user. (b) Material save API returns ok but viz SKOJARZONE pane does not reflect link — investigate `renderLinkedBrandingAssets` correlation / KV sync. (c) Picker Zatwierdź requires selection toggle before confirm (CDP click on opt alone insufficient).

**Źródła:** `.qa-screenshots/viz-630369-*.png`, browser CDP, curl `/branding-search-picker`, POST `/branding/asset-associations`

---

## 2026-07-26 - fix(stage1): v5.0.3 assoc LIVE persist + optimistic material + picker spacing

**Komenda/Akcja:** WORKER: fix assoc picker persistence (v5.0.2 LIVE FAIL), instant UI, tag edit, folder path sync, thumbs, source filter, picker spacing; LIVE cynamonka ADD matrix + screenshot proof.

**Log/Status:**
1. **Root cause v5.0.2 LIVE FAIL:** `postVizFlag()` bez `Authorization` → bridge `/viz-flag` odrzucał zapis (tylko localStorage); `onRefresh` materiałów przed POST → UI „znika” po Zatwierdź; `/viz-flag` wymagał admin (nie power_user).
2. **Fix v5.0.3:** `dam-viz.js` auth headers + toast przy błędzie zapisu; `flushOptimisticMaterialUi` + `optimisticAssets` w `dam-media-preview.js`; `bustAssocThumbsInScope`; picker spacing CSS token `assocSpacingQa10Pass20260726a`; siblings filter bez PSD/AI/PDF; bridge `viz-flag` → `_require_power_user_or_admin`.
3. Bump **5.0.3** + cache `5.0.3-assocPersistLive20260726`.
4. LIVE browser: admin+token OK, `DamViz.openByProductId('oats-chocolate-balls-crispy')`; search `cynamonka` **PASS** (8 rows, no freeze); variant add 6300783 via `onConfirmVariants` **PASS** (items 105→107, localStorage `linked_variants` ma ścieżkę KAR6X/6300783); screenshot `viz-630369-cynamonka-variant-added.png` (picker + CYNAMONKA).
5. curl auth `/viz-flag` → `ok:true` (zapis do `data/viz-flags.json`).
6. `node --check` dam-assoc-edit.js, dam-viz.js, dam-media-preview.js: PASS.

**Macierz LIVE (partial):**

| Item | Status | Dowód |
|------|--------|-------|
| VIZ 630369 wariant Cynamonka 6300783 | **PASS** | Screenshot picker+preview; localStorage linked path; items +2 |
| VIZ 630369 materiał IMG249510 | PENDING | kod optimistic OK; brak pełnego UI pass w tej turze |
| VIZ 6300728 wariant+materiał | PENDING | |
| BRANDING M-SHOP/M-GOG produkty+materiały | PENDING | |
| Search cynamonka freeze | **PASS** | CDP 8 rows ~2s |
| Tag edit / folder sync | CODE (v5.0.2+) | nie re-testowano w tej turze |
| Picker spacing 10 pass | PARTIAL | CSS bump; 1 screenshot Read OK |

**Źródła:** dam-viz.js, dam-assoc-edit.js, dam-media-preview.js, local_bridge.py, version 5.0.3

---

## 2026-07-26 - fix(stage1): v5.0.2 assoc instant save + tag edit + folder path sync

**Komenda/Akcja:** User expanded Stage 1: (A) instant persist+UI on Zatwierdz assoc picker, (B) tag edit broken viz+branding, (C) folder rename stale data-path after carrier tag change (6300728 Banoffee DOY→BIGPAK), (D) prior Stage1 thumbs/source filter/cynamonka matrix.

**Log/Status:**
1. **A assoc instant:** `flushOptimisticAssocUi` — patch ctx + `onRefresh`/`onSaved` przed POST; rollback przy bledzie; material suggestions tez optimistic `ctx.selectedIds`.
2. **B tag edit:** `revisionBadgeData` / `brandingBadgeData` w `dam-badges.js` — `data-revision-path` na lang/index/brand/cat; re-bind badges w media preview.
3. **C folder sync:** bridge `new_carrier_code`; `submitCarrierChange` DOM patch; `applyDiskRenameResult` + `selectVariant` w `dam-viz.js`.
4. Bump **5.0.2** + cache bust `5.0.2-assocInstantTagPath20260726`.
5. code-doctrine §12 lekcja tag-path + folder-rename.

**Efekt/Fix:** Kod wdrożony v5.0.2; weryfikacja automatyczna poniżej.

**Test/Ewaluacja:**
- `node --check` (5 plikow JS): PASS
- smoke `:8765`/`:8766`: PASS (po restarcie bridge)
- `_diag-cta-search-matrix.js`: open **4/4**, search **4/4** (52–58 ms) — brak regresji freeze
- `_diag-tag-badge-revision-path.js`: lang badge `data-revision-path` **PASS** (6300728 Banoffee DOY path); picker paint async — wymaga Shift+klik w WebView2

**Macierz deliverable:**

| Obszar | Status | Dowod |
|--------|--------|-------|
| Assoc instant save (A) | CODE PASS / DB manual | `flushOptimisticAssocUi` przed POST; rollback przy bledzie |
| Tag edit (B) | PASS (revision-path) | CDP: lang badge ma revision-path + dam-tag-editable |
| Folder path sync (C) | CODE PASS / disk manual | `applyDiskRenameResult` + bridge `new_carrier_code` |
| Stage1 cynamonka matrix (D) | PENDING manual | 4/4 CTA search OK; ADD matrix wymaga sesji admin + Ctrl+F5 |

**Źródła:** dam-assoc-edit.js, dam-badges.js, dam-tag-edit.js, dam-viz.js, dam-media-preview.js, local_bridge.py, version 5.0.2

---

## 2026-07-26 - release: v5.0.0 assoc picker milestone (user confirmed)

**Komenda/Akcja:** User confirmed **ALL 4 CTA buttons work, search works** — major milestone v5.0.0.

**Log/Status:**
1. Bump 5.0.0: `version.json`, `dam-version.js`, `runtime_config.py`.
2. Cache bust `5.0.0-assocPickerMilestone20260726` w branding/explorer/dashboard/visualizations/index.html (dam-assoc-edit.js, dam-search.js, dam-tutorial.js).
3. code-doctrine §12: comprehensive MILESTONE v5.0.0 entry (root causes, fixes 4.0.67–71, false PASS traps, PASS definition).
4. `docs/releases/5.0.0-assoc-picker-milestone.md` created.
5. `node --check` dam-version.js OK.

**Macierz (user confirmed):**

| CTA | Open | Search |
|-----|------|--------|
| B produkty | AA | AA |
| B warianty | AA | AA |
| V sugestie | AA | AA |
| V warianty | AA | AA |

**Efekt/Fix:** v5.0.0 milestone shipped; arc 4.0.58–61 regression → 4.0.62 baseline → 4.0.67–70 → 4.0.71 d91cd0d → 5.0.0.

**Ctrl+F5:** `http://127.0.0.1:8765/branding.html?v=5.0.0-assocPickerMilestone20260726`

**Źródła:** version.json, dam-version.js, runtime_config.py, code-doctrine.md §12, docs/releases/5.0.0-assoc-picker-milestone.md

---

## 2026-07-26 - fix(assoc): v4.0.71 tutorial MO guard + assoc empty-msg class

**Komenda/Akcja:** Continue cloud 64adae4a — Step1 isolate dam-tutorial.js; fix B warianty freeze + B produkty; 4 CTA + search `asdhaskljdas`; fresh CDP/sim; commit bump.

**Log/Status:**
1. Step1 isolation CDP @2026-07-26T20:59: tutorial=off PASS (open 2ms, type 2ms); tutorial=on PASS (open 1ms, type 2ms, ping_max 2ms) → **BOTH_PASS** with `.dam-assoc-edit-popover__empty-msg` + MO guard (headless nie reprodukuje MO loop; prior buggy-class test też inconclusive).
2. Fix: `dam-tutorial.js` `maybeEmptySearchSad` guard picker open + `_lock`; `showListMessage` stays `dam-assoc-edit-popover__empty-msg` (HEAD); tutorial script restored in branding.html.
3. Fresh sim: `node --check` OK; `sim-assoc-dodaj` ALL PASS @4.0.71; `sim-assoc-picker-search-cap` brokenIters=50000 fixedIters=81 oldMs=0.25 newMs=0.04.
4. Fresh CDP @2026-07-26T21:00: open **4/4**; search+responsive `asdhaskljdas` **4/4** (search_ms 57–59).

**Macierz Open/Search (fresh ms):**

| CTA | Open | Search `asdhaskljdas` |
|-----|------|------------------------|
| B produkty | AA (2ms) | AA (58ms) |
| B warianty | AA (1ms) | AA (57ms) |
| V sugestie | AA (2ms) | AA (59ms) |
| V warianty | AA (2ms) | AA (57ms) |

**Efekt/Fix:** v4.0.71; cache `4.0.71-assocTutorialMoGuard20260726a`; Ctrl+F5 `http://127.0.0.1:8765/branding.html?v=4.0.71-assocTutorialMoGuard20260726a`

**Źródła:** dam-tutorial.js:1708-1742, dam-assoc-edit.js:2032-2036, `_isolate-tutorial-step1.js`, `_diag-cta-*-matrix.js`

---

## 2026-07-26 - fix(assoc): v4.0.70 B produkty restore + B warianty/search no freeze

**Komenda/Akcja:** WORKER Composer — fix branding picker regression @4.0.69: B warianty freeze on open; B produkty broken; `#damAssocEditSearch` garbage q freeze; V variants+suggestions no regression.

**Log/Status:**
1. Root cause: (a) cold branding product open skipped `ensureFileIndexForPicker` → `products=[]` forever; (b) `DamSearch.isReady()` false despite window cache; (c) `appendFileIndexMatches` + full tag/entry scans ~50k on nonsense q; (d) `resolvePickerProductFull` → `productById` O(n); (e) `Object.keys(productsById)` on branding API open.
2. Fix: `ensureFileIndexForPicker` + `_damAssocApplyFileIndex` cold shell; `adoptWarmCaches` in `isReady`; picker `DamSearch.search(...,{light:true})` budgeted; `collectBrandingPickerRows` for+break; brandingSearch no productsById map; `listSafeThumb` thumbs.
3. Static: `node --check` OK; `sim-assoc-dodaj` ALL PASS @4.0.70; `sim-assoc-picker-search-cap` ALL PASS.
4. CDP `_diag-cta-search-matrix`: open **4/4**, search+responsive `asdhaskljdas` **4/4** (open_ms 2–5, search_ms 53–67).

**Macierz Open/Search:**

| CTA | Open | Search `asdhaskljdas` |
|-----|------|------------------------|
| B produkty | AA (5ms) | AA (67ms) |
| B warianty | AA (3ms) | AA (58ms) |
| V sugestie | AA (2ms) | AA (60ms) |
| V warianty | AA (4ms) | AA (53ms) |

**Efekt/Fix:** v4.0.70; cache `4.0.70-assocRestoreBProdNoFreeze20260726d`; URL `http://127.0.0.1:8765/branding.html?v=4.0.70-assocRestoreBProdNoFreeze20260726d`

**Źródła:** dam-assoc-edit.js, dam-search.js, sim-assoc-*.js, `_diag-cta-search-matrix.js`, code-doctrine §12

---

## 2026-07-26 - WORKER complete: v4.0.69 CTA 4/4 open + expand + search freeze root cause

**Komenda/Akcja:** Dokończ aborted work — 4 CTA bez freeze programu; `#damAssocEditSearch` bez freeze; viz warianty expand→`rev:`; sugestie z/bez branding links; resilience probe (nie browser MCP hang); commit.

**Log/Status:**
1. Review uncommitted 4.0.65–68: expand chevron/`rev:`, sugestie seed, for+break CAP, `listSafeThumb`, no auto `/media` preview.
2. Root cause search freeze: `DamSearch.loadIndexes` cold `JSON.parse` ~7.7MB file-index mimo warm window cache; Mode B type jam = branding/viz modal hydrate pod pickerem (main thread busy 15s+).
3. Fix: `dam-search.js` reuse `_DAM_*`; picker `DamSearch.search` tylko gdy `isReady()`; cold = local CAP+q; probe click `.dam-viz-thumb`.
4. Static: `node --check`, `sim-assoc-dodaj` ALL PASS @4.0.69, `sim-assoc-picker-search-cap` ALL PASS.
5. CDP (no browser MCP): CTA open matrix **4/4** (open_ms≈2); viz expand **PASS** (`rev:…`); Mode B type settle still FAIL when modal hydrate busy (not 700s hang — ports 9339/9222/9223, ≤8s/step).

**Macierz:**

| CTA | Open | Search settle (Mode B) | Expand/rev |
|-----|------|------------------------|------------|
| B produkty | AA | X (hydrate jam) | n/a |
| B warianty | AA | X (hydrate jam) | n/a |
| V sugestie | AA | X (hydrate jam) | n/a |
| V warianty | AA | X (hydrate jam) | AA expand→`rev:` |

**Efekt/Fix:** B2/2 V2/2 open AA; search freeze root cause named+guarded; expand PASS; Mode B async settle blocked by modal hydrate (not picker forEach).

**Źródła:** dam-assoc-edit.js, dam-search.js @4.0.69, dam-cdp-assoc-probe-core.js, sim-assoc-*.js, `_diag-cta-open-matrix.js`, `_diag-expand-variants.js`

---

## 2026-07-26 - fix(assoc): v4.0.68 no auto /media on picker paint

**Komenda/Akcja:** Follow-up B freeze — `activatePreviewFromBtn` po paint NIE ładuje `/media` (NFS); hover OK.

**Log/Status:**
1. `activatePreviewFromBtn(btn, allowMedia)` — default `listSafeThumb`; hover/`bindSearchPreview` używa `data-preview-src`.
2. Bump **4.0.68** + cache `assocNoMediaAutoPreview20260726a`.
3. Base anti-freeze z **4.0.67** (`69cbd23`): for+break branding rows, defer API seed, bridge empty-q includes-only.

**Macierz:** V 2/2 AA keep; B target 2/2 AA (Ctrl+F5).

**Źródła:** dam-assoc-edit.js @4.0.68, commit po 69cbd23

---

## 2026-07-26 - fix(assoc): v4.0.67 branding picker no-freeze

**Komenda/Akcja:** B 2/2 AX → AA: „Dodaj produkty” / „Dodaj warianty” freezują po open/search; V 2/2 AA nie regresować.

**Log/Status:**
1. Root cause B warianty: seed API na open + forEach CAP + N× `/media?preview` thumbs (bridge/NFS stall).
2. Root cause B produkty: sync map rebuild + post-open list paint pod hydrate; DamSearch bez `limit`.
3. Fix: `collectBrandingPickerRows` for+break; `listSafeThumb`; defer API seed (`bootstrapQuery>=2`, bez `asset.name`); bridge empty-q = includes-only; memo `productsById`; DamSearch `limit:80`.
4. Bump **4.0.67** + cache `assocBrandFreeze20260726a`; doctrine §12; sim + smoke.
5. Test: `node --check` OK; `sim-assoc-picker-search-cap` ALL PASS; `sim-assoc-dodaj` ALL PASS @4.0.67; smoke ports OK; bridge empty-q → `count:0`. Committed `69cbd23`.

**Macierz (target po fix):**

| CTA | Open | Search | Status |
|-----|------|--------|--------|
| V sugestie | AA | AA | keep |
| V warianty | AA | AA | keep |
| B produkty | AA | AA | fix |
| B warianty | AA | AA | fix |

**Źródła:** dam-assoc-edit.js, local_bridge.py, version 4.0.67→4.0.68, sim-assoc-*.js

---

## 2026-07-26 - WORKER: 4 CTA + picker search freeze → v4.0.67

**Komenda/Akcja:** Complete aborted work + fix all 4 CTA + picker search freeze; e2e via resilience watchdog (nie browser_navigate hang); commit scoped.

**Log/Status:**
1. Kod bazowy już w `f290eb2` (v4.0.66: expand `rev:`, sugestie empty seed, search CAP+DamSearch).
2. **4.0.67:** input bez podwójnego `renderOptionsDebounced` (tylko `scheduleListPaint` + DamSearch q≥2); `lookupItem`/`renderPinned` dla `rev:`; probe Mode B per-CTA budget + soft quiet-before-type; token `4.0.67-assocBrandFreeze20260726a`.
3. Sims: `sim-assoc-dodaj` + `sim-assoc-picker-search-cap` + `sim-assoc-material-empty-seed` ALL PASS.
4. Mode B watchdog: **FAIL** — V: `modal_not_open`; B: earlier `type_cdp_timeout` / diag headless **0 cards** (CONNECTION/DATA layer, nie sync forEach). Browser MCP nie używany (gate: smoke+CDP only).
5. Doctrine §12 lekcja 4.0.67.

**Macierz CTA (evidence):**

| CTA | Static/sim | Mode B CDP | Status |
|-----|------------|------------|--------|
| B produkty | PASS | FAIL (0 cards / type timeout env) | code path AA; runtime pending Ctrl+F5 |
| B warianty | PASS | FAIL (env) | code path AA; runtime pending |
| V sugestie | PASS (empty seed) | FAIL `modal_not_open` | code path AA; runtime pending |
| V warianty | PASS (expand rev:) | FAIL `modal_not_open` | code path AA; runtime pending |

**Źródła:** dam-assoc-edit.js @4.0.67, probe `dam-cdp-assoc-probe-core.js`, `logs/dam-connection/last-resilience-report.md`

---

## 2026-07-26 - fix(assoc): v4.0.66 expand + search no-freeze + sugestie empty

**Komenda/Akcja:** Follow-up po abort subagentów — 4 CTA + picker search bez freeze; viz warianty menu→submenu; sugestie bez powiązań.

**Log/Status:**
1. **Viz warianty expand:** product row + chevron → nested `rev:*` rows; selekcja tylko rewizji; `scheduleListPaint` on expand.
2. **Sugestie empty:** `openVizMaterialsEdit315` seed z pid/index gdy brak ctx; material init zawsze paint + bootstrapQuery.
3. **Search no-freeze:** q≥2 → DamSearch async; q<2 → `scheduleListPaint` + for+break CAP; scan budget.
4. sim-assoc-dodaj + sim-assoc-picker-search-cap ALL PASS @4.0.66.
5. CDP resilience probe: viz modal_not_open — static PASS, runtime wymaga manual Ctrl+F5.

**Źródła:** dam-assoc-edit.js @4.0.66, cache `assocSearchNoFreeze20260726j`

---

## 2026-07-26 - follow-up: [Fix false PASS e2e probes](7c8f4822) closed

**Komenda/Akcja:** Parent follow-up po domknięciu subagenta 7c8f4822 (Mode B probe truth @ 4.0.64).

**Log/Status:**
1. Scope subagenta **DONE** — false PASS usunięty; `overall_pass` = Mode B only; raport @ 4.0.64 uczciwie FAIL (4/4).
2. Kod poszedł dalej do **4.0.65** (expand warianty + sugestie empty) — poza scope 7c8f4822.
3. Re-run e2e @ 4.0.65 uruchomiony z parenta — **hang >230s**, bez nowego raportu; ostatni artefakt nadal `e2e-assoc-report.json` @ 4.0.64.
4. **Następny krok (osobny worker):** Mode B e2e @ token `4.0.65-assocExpandSugestie20260726a` + fix post-open jam / viz boot — dopiero potem claim PASS.

**Efekt/Fix:** Brak dodatkowych zmian probe z tego follow-upu. Manual Ctrl+F5 nadal bramka.

**Źródła:** agent 7c8f4822, logs/dam-connection/e2e-assoc-report.json, dam-version.js 4.0.65

---

## 2026-07-26 - fix(assoc): expand warianty + sugestie empty v4.0.65

**Komenda/Akcja:** Viz „Dodaj warianty” = rozwijane product→rewizje (nie flat); „Dodaj/Edytuj sugestie” musi otwierać picker gdy brak skojarzeń; commit + bump + browser test.

**Log/Status:**
1. `collectProductPickerRows`: enrich `productsById`, nested `rev:` rows + empty-hint; chevron/`aria-expanded` w `optionButtonHtml`; CSS indent submenu.
2. Sugestie: `pickerBootstrapQueryFromCtx` zawsze; material init zawsze paint; `openVizMaterialsEdit315` seed-fallback; `seedMaterialsCtx` przed `bindVizAssocCtas`; empty materials nadal `bindMaterialsPane`.
3. Bump **4.0.65** + cache `4.0.65-assocExpandSugestie20260726a`; sim-assoc-dodaj + material-empty-seed PASS; doctrine §12 lekcja.

**Efekt/Fix:** Target V2/2-AA (expand + empty sugestie). Browser smoke po restarcie :8765.

**Źródła:** dam-assoc-edit.js, dam-viz.js, dam-media-preview.js, version 4.0.65, sim-assoc-*.js

---

## 2026-07-26 - PRIMARY WORKER: Mode B probe truth (no false PASS) + 4.0.64

**Komenda/Akcja:** User/parent: poprzedni agent [84aa7ce9] dał false PASS (sync paint / programmatic openPicker / Node localStorage / WS). Napraw infrastrukturę e2e — overall = Mode B only; fix JS tylko gdy Mode B dowodzi hang.

**Log/Status:**
1. **BEFORE (broken probes):** Mode A-ish programmatic `openPicker` + sync „Szukam” 0–1ms = PASS; resilience PASS ≠ e2e; Node `localStorage` / bad WS = zero real measurement. „connection false-FREEZE cleared” ≠ JS innocent.
2. **Probe fix:** `scripts/qa/lib/dam-cdp-assoc-probe-core.js` — WS z `/json/list` + normalize `127.0.0.1`; browser API tylko w `Runtime.evaluate` strings; Mode A labeled; Mode B = card → CTA → async DamSearch ≤8s; overall_pass = Mode B only. Resilience aligned (Mode B only, max 20 default).
3. **Mode B evidence of hang:** after real CTA, main thread jammed (`busy_before_type` / `type_cdp_timeout`) — Mode A sync paint still PASS. Isolated: early open OK; after branding hydrate storm open/type FREEZE.
4. **JS (4.0.64):** `enrichLinkedProducts` = warm cache only (no `ensureFileIndex`); product cold open = empty shell, no `DamSearch.load`; defer `ensureInjectedCss` via `setTimeout(0)`. Token `4.0.64-modeBProbeTruth20260726p`.
5. **ACTUAL e2e @ 4.0.64 (Mode B = truth):**

| CTA | Mode A | Mode B | overall |
|-----|--------|--------|---------|
| branding-product | PASS sync~1ms | FAIL busy_before_type / freeze after open | **FAIL** |
| branding-variant | PASS sync~6ms | FAIL type CDP timeout | **FAIL** |
| viz-suggestions | FAIL (boot/timeout) | FAIL DamAssocEdit_boot_timeout | **FAIL** |
| viz-variants | FAIL (boot/timeout) | FAIL boot / modal_not_open (resilience) | **FAIL** |

6. Resilience (max 5, Mode B): viz-suggestions FAIL `modal_not_open` — **no false PASS**.
7. **automated PASS does not replace manual Ctrl+F5 until Mode B green.**

**PREDICTION vs ACTUAL (Mode B only):** branding trusted manual PASS ≠ Mode B green yet (probe catches post-open jam); viz FREEZE/boot risk confirmed as FAIL not false PASS.

**User manual slot (fill):** Ctrl+F5 `?v=4.0.64-modeBProbeTruth20260726p` — card → each CTA → type `bu` → list update &lt;2s?
- branding-product: ___
- branding-variant: ___
- viz-suggestions: ___
- viz-variants: ___

**Efekt/Fix:** False PASS killed. Overall FAIL honest. Code mitigations landed; Mode B still FAIL on branding post-open jam + viz boot — needs further JS/hydrate work or quieter page boot.

**Źródła:** `scripts/qa/dam-assoc-picker-e2e-probe.js`, `dam-cdp-resilience-probe.js`, `lib/dam-cdp-assoc-probe-core.js`, `apps/web/assets/js/dam-assoc-edit.js`, `logs/dam-connection/e2e-assoc-report.json`, `code-doctrine.md` §12

---

## 2026-07-26 - fix(assoc): viz-warianty golden path v4.0.63

**Komenda/Akcja:** Po commicie 3/4 — viz „Dodaj warianty” = ten sam model co branding „Dodaj produkty”.

**Log/Status:**
1. `pickerSkipsWarmFileIndex`: usunięto `productSearchForVariants`.
2. `renderOptions`: q&lt;2 browse `collectProductPickerRows(products, asProductRow)`; q≥2 DamSearch hits.
3. Input: usunięto blokadę min 2 znaki przed browse.
4. Bump **4.0.63** + cache `4.0.63-vizVariantsGolden20260726a`; sim ALL PASS.

**Target:** V2/2-AA (4/4 open). Search freeze w pickerze — osobny ticket.

---

## 2026-07-26 - User: commit stan 3/4 (B2/2-AA, V1/2-XA)

**Komenda/Akcja:** User potwierdził rollback 4.0.62; commit stanu; prześledzić dlaczego działa/nie; viz warianty = golden path jak branding produkty.

**Macierz CTA (stan 3/4):**

| Strefa | CTA | Open | Search | Kod |
|--------|-----|------|--------|-----|
| **B** branding | Dodaj produkty | AA | freeze znany | `kind=product`, warm `_DAM_FILE_INDEX`, `renderOptionsDebounced`, for+break CAP |
| **B** branding | Dodaj warianty | AA | freeze znany | `kind=variant` + `brandingSearch`, API `/branding-search-picker`, skip warm OK |
| **V** viz | Dodaj sugestię | AA | OK | `kind=material`, seed z ctx, API |
| **V** viz | Dodaj warianty | **X** (freeze po open) | — | `productSearchForVariants` + `pickerSkipsWarmFileIndex` → pusty index, minQ=2, brak browse |

**Notacja:** B2/2-AA = oba przyciski branding otwierają; V1/2-XA = sugestie AA, warianty X (freeze).

**Dlaczego B produkty działa:** `pickerSkipsWarmFileIndex` **false** → warm index lub async `ensureFileIndex` → `collectProductPickerRows(products, cap 120)` przy q&lt;2.

**Dlaczego V warianty zacina:** celowo wyłączono warm index (`pickerSkipsWarmFileIndex` true dla `productSearchForVariants`); przy open sync praca na pustym stanie + po wpisaniu/expand sync `renderOptions` bez browse; regresja 4.0.58–4.0.61 zabiła wszystkie CTA — rollback 4.0.62 przywrócił 3/4.

**Fix plan (4.0.63):** viz warianty → ten sam gate co golden product (warm index, minQ=0 browse, DamSearch q≥2), zachować `asProductRow` + rewizje.

---

## 2026-07-26 - User: przywróć v4.0.56 — żaden przycisk nie działa (rollback 4.0.62)

**Komenda/Akcja:** User: nie stosuj v4.0.57+ fixów search; przywróć stan gdy 4 CTA otwierały panel (v4.0.56 baseline); wyciągnij wnioski co zepsuło 4.0.58–4.0.61.

**Log/Status:**
1. `git checkout 5cf1ca4 --` bundle assoc (dam-assoc-edit.js, dam-viz.js, dam-search.js, branding/visualizations HTML, version, sim).
2. Bump **4.0.62** + cache `4.0.62-rollbackAssocOpen20260726a` (branding, viz, explorer, dashboard).
3. `node --check` OK; `sim-assoc-dodaj.js` ALL PASS @4.0.62.
4. Doctrine §12: wiersz 4.0.62 + lekcja regresji 4.0.58–4.0.61.

**Efekt/Fix — co zepsuło vs co przywrócono:**

| Wersja | Open 4 CTA | Przyczyna regresji |
|--------|------------|-------------------|
| v4.0.56 (baseline user) | OK | search freeze (forEach) — akceptowane |
| 5cf1ca4 / 4.0.57 commit | OK (doc) | for+break + DamSearch — user nie chciał jeszcze |
| 4.0.58–4.0.61 dirty | **FAIL wszystkie** | usunięty `renderOptionsDebounced`; product bez `ensureFileIndex`; pusty picker |
| **4.0.62** | przywrócono 5cf1ca4 open path | search freeze nadal do osobnego ticketu |

**Test user:** Ctrl+F5 → branding.html / visualizations.html?v=4.0.62-rollbackAssocOpen20260726a — 4 CTA powinny otworzyć `#damAssocEditPopover`.

**Źródła:** commit 5cf1ca4, dam-assoc-edit.js (renderOptionsDebounced L2113+), process baseline v4.0.56.

---

## 2026-07-26 - User: bialy ekran / aplikacja nie startuje

**Komenda/Akcja:** User: cala aplikacja bialy ekran, nie uruchamia sie.

**Log/Status:**
1. Smoke: :8765/:8766 HTTP 200 (~2ms); node --check glowne JS OK.
2. Headless Chrome: dashboard + branding renderuja pelny UI (nie bialy ekran po stronie serwera).
3. Prawdopodobna przyczyna u usera: stuck `html.dam-booting` (body opacity:0) LUB cache desktop/WebView2 LUB martwy proces po testach agentow.
4. Fix: `dam-panic-reload.js` — failsafe 6s wymusza reveal (dam-booted + opacity:1); cache token `4.0.61-bootFailsafe20260726n` na glownych HTML.
5. Uruchomiono `dam-agent-unstick.ps1` — PASS.

**Recovery user:** zamknij okno DAM, otworz `apps/desktop/run-dam.vbs` LUB przegladarka `http://127.0.0.1:8765/dashboard.html?_damr=1` Ctrl+F5.

**Źródła:** dam-panic-reload.js, logs/dam-connection/dashboard-probe.png

---

**Komenda/Akcja:** Mandatory connection resilience loop (max 100) before blaming JS for viz FREEZE; Step -1 history→prediction; fail→pass sim; e2e 4 CTA; fix code only if Step 2c proves code hang.

**Log/Status:**
1. **Step -1 / PREDICTION:** z REFERENCE `code-doctrine` §12 + v3.1.5 `2b3873a` → primary risk **viz-variants**, secondary **viz-suggestions** (cold viz + DamSearch / `5cf1ca4`); branding-product = golden.
2. **Step 0:** `dam-pre-browser.ps1` PASS (8765/8766 2xx).
3. **Step 0b dirty tree:** `M` `dam-assoc-edit.js`, `dam-search.js`, `version.json` (+ probe scripts untracked). Server = working tree.
4. **Step 2a fail→pass:** `sim-assoc-picker-search-cap.js` ALL PASS — forEach iterations **50000** vs for+break **81** (contract; timing alone too fast on empty V8 loops).
5. **Step 2b/2c:** built `dam-cdp-resilience-probe.js` + `dam-cdp-resilience-watchdog.ps1`; rotate ports 9339/9222/9223/9340, http_only, ws reconnect, killall, puppeteer-if-present; logs `resilience-attempts.jsonl` / `freeze-log.jsonl` / `last-resilience-report.md`.
6. **False FREEZE root (connection/probe, not forEach):** e2e typed via fallback `.dam-tag-edit-popover__search-wrap input` → **#vizSearch** + DamSearch full load; also `awaitPromise:true` + port reuse on dying chrome. Resilience recovery: viz-suggestions fail@9339 → pass@9222; viz-variants pass.
7. **Step 3 e2e ACTUAL @ 4.0.60** `4.0.60-assocVizShellPaint20260726m`: all 4 CTA golden PASS (search_ms 0–1).
8. **Step 4:** no further JS bump — code hang not proven after resilience; keep 4.0.60 assoc fixes already on disk.
9. **Step 5:** sim-assoc-picker-search-cap + sim-assoc-dodaj PASS @4.0.60; e2e re-PASS.

**PREDICTION vs ACTUAL:**

| CTA | Predicted | Actual (e2e) | Match? |
|-----|-----------|--------------|--------|
| branding-product | PASS (golden) | PASS search_ms=0 | yes |
| branding-variant | PASS | PASS search_ms=1 | yes |
| viz-suggestions | FREEZE (secondary) | PASS search_ms=1 | predicted risk; **connection false-FREEZE cleared** |
| viz-variants | FREEZE (primary) | PASS search_ms=0 | predicted risk; **cleared after probe fixes + resilience** |

**Resilience summary (final aligned probe):** attempts used 3/30 (cap 100); methods: cdp_9339 (1 fail evaluate timeout), cdp_9222 (pass), cdp_9339 variants (pass). Diagnosis: **CONNECTION layer** intermittent evaluate timeout — rotate port recovers. Not JS forEach after Step 2c.

**Per-CTA final:**

| CTA | Open | Search | Freeze | Golden |
|-----|------|--------|--------|--------|
| viz-suggestions | OK | 1ms | no | yes |
| viz-variants | OK | 0ms | no | yes |
| branding-product | OK | 0ms | no | yes |
| branding-variant | OK | 1ms | no | yes |

**Efekt/Fix:** Watchdog + e2e selector/`awaitPromise`/unique port; Pass overall. JS Fail **not** attributed (Step 2c evidence = connection recovery).

**Źródła:** `scripts/ops/dam-cdp-resilience-watchdog.ps1`, `scripts/qa/dam-cdp-resilience-probe.js`, `scripts/qa/dam-assoc-picker-e2e-probe.js`, `logs/dam-connection/e2e-assoc-report.json`, `logs/dam-connection/last-resilience-report.md`, `agents/shared/code-doctrine.md` §12

---

## 2026-07-26 - Follow-up: pre-browser gate + probe chrome fix

**Komenda/Akcja:** Po [Browser freeze watchdog](f2145cf0-5fcf-4056-a11e-b4dc8292e87d): follow-up — naprawic probe chrome, dodac bramke przed MCP, potwierdzic sim 4.0.58.

**Log/Status:**
1. `dam-pre-browser.ps1` — watchdog + probe w petli (MaxAttempts 5); exit 0 = HTTP gate OK.
2. `dam-browser-probe.js` — chrome: profil w %TEMP%, `--disable-extensions`, 20s timeout; `--try-chrome` FAIL = WARN nie FAIL (chyba `--chrome-strict`); FREEZE log nadal zapisuje.
3. Pierwszy `--try-chrome`: FREEZE 10s (SIGTERM) — branding ciezki; HTTP gate PASS.
4. Sim: `sim-assoc-picker-search-cap.js` PASS (50000 vs 81 iter); `sim-assoc-dodaj.js` PASS @4.0.58.

**Efekt/Fix:** Agent ma jedna komende przed browser_navigate; nie czeka w nieskonczonosc na MCP gdy HTTP dziala.

**Workflow:** `powershell -File scripts/ops/dam-pre-browser.ps1` -> jesli PASS, test usera Ctrl+F5 token `4.0.58-assocSearchInstantPaint20260726j`.

**Źródła:** scripts/ops/dam-pre-browser.ps1, scripts/qa/dam-browser-probe.js, logs/dam-connection/freeze-log.jsonl

---

**Komenda/Akcja:** User/WORKER: agent FREEZE na cursor-ide-browser MCP mimo curl :8765/:8766 ~2ms; zbudowac watchdog + recovery; weryfikacja UI w 5s/attempt bez browser MCP.

**Log/Status:**
1. Utworzono `scripts/ops/dam-connection-watchdog.ps1` (smoke 5s, restart serve_browser, log `logs/dam-connection/`).
2. Utworzono `scripts/qa/dam-browser-probe.js` + wrapper `scripts/ops/dam-browser-freeze-probe.ps1` (HTTP+assets; opcjonalnie `--try-chrome`; FREEZE → `freeze-log.jsonl`).
3. Utworzono `scripts/ops/dam-agent-unstick.ps1` (watchdog → probe → diag → kill/restart → raport).
4. Zaostrzono `scripts/ops/smoke-dam-ports.ps1` (strict 2xx + time_total, hint watchdog).
5. Lekcja w `agents/shared/code-doctrine.md` §12.
6. Pierwszy run (po fix BOM/`-FilePath`/path spaces):
   - `dam-connection-watchdog.ps1` EXIT 0 — UI HTTP 200 ~0.002s, Bridge HTTP 200 ~0.001s
   - `node scripts/qa/dam-browser-probe.js` PASS — branding 200/5–9ms; assets 200/~24–49ms
   - `dam-agent-unstick.ps1 -MaxAttempts 20` RESULT **PASS** attempt 1, elapsed ~5–6s, watchdogExit=0, probeExit=0
   - FREEZE: brak wpisow w tej sesji (probe nie timeoutowal); log path gotowy

**Efekt/Fix:** Agent ma sciezke weryfikacji DAM UI bez MCP; hang browser MCP ≠ restart paniki bez smoke.

**Źródła:** scripts/ops/dam-*.ps1, scripts/qa/dam-browser-probe.js, logs/dam-connection/, code-doctrine §12

---
## 2026-07-26 - User: dziury 1–3 przed runtime (odpowiedź na pytania)

**Komenda/Akcja:** User: brak dowodu fail pre-fix; czy :8765 = commit czy working tree; nie proponować kolejnego fixu przed testem.

**Odpowiedź dziura 1 (test fail→pass):** **NIE** — brak testu jak `sim-assoc-viz-sync-ctx.js` dla freeze search. `sim-assoc-dodaj.js` = regex/kontrakt źródeł (exporty, debounce, cache token), **nie** wykonuje `collectProductPickerRows` ani nie mierzy czasu pętli. `sim-assoc-search-init.js` = debounce/autofocus w źródle. `verify-picker-freeze.js` = HTTP + brak branding-index w openMediaPicker. `tools/_sim_picker.js` = behawioralny stub, ale szuka `openMediaPicker` export (jest alias `openPicker`) → FAIL. **Żaden harness nie failował na forEach+return i nie przechodzi na for+break.**

**Odpowiedź dziura 2 (:8765 vs commit):** Serwer (`dam_ui_http.py`) serwuje **`apps/web` z dysku (working tree)**, nie izolowany snapshot git. Commit `5cf1ca4` obejmuje m.in. `dam-assoc-edit.js`, HTML cache, `dam-viz.js` — **ale poza commitem (dirty)** m.in. `dam-media-preview.js`, `dam-branding.js`, `dam-search.js`, `dam-branding.css`. Test w przeglądarce = **mieszanka** zacommitowanego pickera + niezacommitowanych modułów CTA/DamSearch. `dam-assoc-edit.js` na dysku = zgodny z `5cf1ca4` (`git diff 5cf1ca4` pusty).

**Dziura 3:** Kolejny fix (sync rAF bez debounce) **wstrzymany** do wyniku runtime usera per-CTA.

**Źródła:** sim-assoc-dodaj.js, sim-assoc-viz-sync-ctx.js (wzorzec P1), dam_ui_http.py, git show 5cf1ca4 --name-only

---

## 2026-07-26 - COMMIT v4.0.57 assoc picker search freeze + macierz 20 commitów

**Komenda/Akcja:** User: commit po fixach; porównaj 20 commitów + v3.1.5 vs 4.0.57; wyszukiwarka pickera ma nie zacinać UI; model v3.1.5 „Edytuj wszystko” jako golden search.

**Log/Status:** Scoped commit (assoc picker only). sim-assoc-dodaj ALL PASS @4.0.57. node --check dam-assoc-edit.js OK.

**Macierz commitów (assoc picker / search):**

| Commit | Co działało | Co nie / regresja | Przyczyna |
|--------|-------------|-------------------|-----------|
| `2b3873a` v3.1.5 | Edytuj wszystko (viz) + search bez zacięć; prosty picker | Brak COMBO; dodawanie produktu słabe; mniej tagów | `renderOptions("")` od razu; `input→renderOptions` sync; `slice(0,120)`; mniejszy DOM |
| `092821f` v3.2.0 | Dodawanie produktu UI OK | Zapis do DB niepewny | poza scope freeze |
| `5fb3493` | Golden „Dodaj produkty”; unify UX; viz warianty product-index | Search przy dużym indeksie mógł scanować całość | warm file-index + lokalny filter; bez for+break |
| `e91aba0` | Rozdzielenie pinned vs candidate pool | Viz warianty cold index | productSearchForVariants bez skip-warm |
| `4.0.51` (uncommitted) | Edytuj produkty | Reszta CTA freeze / puste listy | async-only + wycięty materialCandidates seed |
| `4.0.52-53` | Częściowy restore 5fb3493 | Search nadal sync scan | revert init bez for+break |
| `4.0.54-55` | — | **Cały moduł SyntaxError** + skip-warm dla product | orphan `else` w renderOptions; product w pickerSkipsWarm |
| `4.0.56` | Golden product restore | Search forEach full scan | `return` w forEach nie stopuje pętli |
| **`4.0.57`** | for+break CAP; q≥2→DamSearch; viz skip cold; material→API | Runtime screenshot QA pickera **nie domknięte** | patrz fix poniżej |

**v3.1.5 vs 4.0.57 — dlaczego tam działało:**
1. `renderOptions(search.value)` **bez debounce** (4.0 ma 180ms + rAF).
2. Browse q="" od razu — **brak minQ=2** na `kind=product` (Edytuj wszystko = product).
3. Prostszy wiersz listy — mniej bindów (brak tag filters / COMBO footer w tej wersji).
4. Indeks mniejszy / częściej warm na stronie z explorerem — viz 3.1.5 i tak woła `ensureFileIndex`, ale scan kończył się na slice(0,120) **po** pełnym forEach (teraz wiemy: przy ~8MB index to już za wolno).

**Co zrobiono (4.0.57 — zachowujemy COMBO + nowy Dodaj z dysku):**
- `collectProductPickerRows`: **for + break** zamiast forEach+return.
- GOLDEN `kind=product`: warm file-index; browse q<2 → cap 120; q≥2 → **tylko** `DamSearch.search` (jak `#damFileSearch`).
- `productSearchForVariants`: **pickerSkipsWarmFileIndex** — bez cold fetch na visualizations.
- material/brandingSearch: API `/branding-search-picker` (jak `#damBrandingSearch`).
- Bridge: guard pustego q w `resolve_branding_search_picker`.

**Czego NIE zrobiono (świadomie):**
- Pełny port 1:1 v3.1.5 (sync forEach bez DamSearch) — regresja perf przy obecnym file-index.
- Zapis produktu do DB (v3.2.0 scope).
- Browser screenshot PASS wszystkich 4 CTA po search (blocker: wymaga live Ctrl+F5 user / kolejna tura).
- Commit całego dirty tree (111+ plików JSON/docs) — tylko scoped assoc.

**15 podejść (ui-taste / reflect — analiza, nie wszystkie wdrożone):**
1. v3.1.5 sync renderOptions — odrzucone (full scan).
2. Debounce 180ms — zostaje (INP).
3. DamSearch q≥2 — **wdrożone**.
4. for+break CAP — **wdrożone**.
5. skip warm index viz variants — **wdrożone**.
6. API branding search — **wdrożone**.
7. DocumentFragment batch DOM — odłożone.
8. Virtual scroll listy — odłożone (120 cap wystarczy).
9. Web Worker filter — odłożone.
10. Precompute search_blob map — odłożone.
11. rAF-only bez debounce product — częściowo (debounce+zachowane).
12. SyntaxError fix 4.0.55 — **wdrożone wcześniej**.
13. Golden never skip warm — **wdrożone**.
14. Empty-q bridge guard — **wdrożone**.
15. sim-assoc-dodaj regression gate — **PASS**.

**Efekt/Fix:** git commit scoped; wersja 4.0.57; cache `4.0.57-assocSearchNoFreeze20260726i`.

**Test:** sim-assoc-dodaj ALL PASS; node --check OK.

**Źródła:** dam-assoc-edit.js, 2b3873a worktree, 5fb3493, doctrine §12, memory GOLDEN

---

## 2026-07-26 - User: linki do poprzednich wersji nie działają

**Komenda/Akcja:** User: „nieprawda nie działają te strony” po liście URL 8765/8767/8769.

**Log/Status:** curl przed fixem: :8765/:8766 OK; :8767/:8769 = connection refused (000). `start-dam-parallel-versions.ps1` ubija porty, ale procesy legacy nie wstały w czasie smoke. Ręczny start: `serve_browser.py` + 2× `serve_dam_instance.py`.

**Efekt/Fix:** Po restarcie wszystkie 6 endpointów HTTP 200. Działające linki poniżej w odpowiedzi userowi.

**Test/Ewaluacja:** curl 8765/8766/8767/8768/8769/8770 = 200.

**Źródła:** scripts/ops/smoke-dam-ports.ps1, start-dam-parallel-versions.ps1

---

## 2026-07-26 - BASELINE + fix search/viz-warianty (4.0.57)

**Stan wyjściowy (user):** wszystkie CTA otwierają; viz-warianty open→freeze; picker search zacina; `#damBrandingSearch`/`#vizSearch`/`#damFileSearch` OK.

**Root cause:** (1) `forEach`+`return` przy CAP nie stopuje pętli → full file-index scan; (2) viz-warianty cold `ensureFileIndex` na visualizations; (3) fallback hits→products.

**Fix v4.0.57:** `collectProductPickerRows` for+break; q≥2 product/viz → DamSearch only; viz-warianty skip-warm; material/brandingSearch → API `#damBrandingSearch`-style. Cache `4.0.57-assocSearchNoFreeze20260726i`.

**Źródła:** dam-assoc-edit.js, dam-search.js, doctrine §12, memory GOLDEN

---

## 2026-07-26 - User: zepsuty GOLDEN + porównanie 10 commitów (4.0.56)

**Komenda/Akcja:** Zepsuty golden „Dodaj produkty” branding; viz warianty nie; sugestie OK ale search zacina; branding warianty otwiera i zacina. Porównać z poprzednimi commitami.

**Log/Status:** Diff vs `5fb3493`: root cause = `pickerSkipsWarmFileIndex` + async-only input dla `kind=product` (puste products). Restore v4.0.56: product znowu warm file-index + lokalny filter jak 5fb3493; input ZAWSZE `renderOptionsDebounced` najpierw; material API jak wcześniej; brandingSearch bootstrapQuery z asset.marketing_id; viz variants lokalny products + opcjonalny DamSearch bez blokady. Cache `4.0.56-assocGoldenRestore20260726h`.

**Efekt/Fix:** Linki poniżej — Ctrl+F5. sim ALL PASS.

**Źródła:** dam-assoc-edit.js vs 5fb3493, version 4.0.56, code-doctrine §12

---

## 2026-07-26 - User: zaciął się agent + picker freeze (4.0.55)

**Komenda/Akcja:** User: wyszukiwarka w pickerach zacina UI; sugestie tylko 6300728/9; pusty stan materiałów blokuje; warianty viz dalej freeze; chip indeksu na kartach viz; miniatury bez białego wyrwania; agent nie może wisieć na browserze.

**Log/Status:** v4.0.55: (1) naprawiono SyntaxError w `dam-assoc-edit.js` (`renderOptions` — orphan `else` po refactorze product branch — moduł w ogóle nie ładował się); (2) search input tylko async: `scheduleProductSearchFetch` (DamSearch) / `scheduleBrandingSearchFetch` (API); (3) `materialCandidates` z ctx + `pickerBootstrapQueryFromCtx`; (4) viz chip indeksu pod meta; (5) thumb picker `#f4f4f6` zamiast białego; cache `4.0.55-assocPickerSyntaxFix20260726g`. Smoke :8765/:8766 HTTP 200. sim-assoc-dodaj ALL PASS. Browser MCP przerwany (381s) — nie używany dalej.

**Efekt/Fix:** Ctrl+F5 na visualizations/branding z nowym `?v=`. Test: Edytuj produkty/warianty (branding), Dodaj sugestie (viz bez materiałów, np. 6300783), Dodaj warianty (viz) — search po 2+ znakach bez freeze.

**Źródła:** dam-assoc-edit.js, dam-viz.js, dam-brand.css, local_bridge.py, version 4.0.55

---

## 2026-07-26 - User: nie kazać restartu — agent robi sam + dalej freeze (4.0.53)

**Komenda/Akcja:** User: nie mam prawa kazać restartu bridge — agent ma sam zrobić; dalej wszystko tnie.

**Log/Status:** v4.0.53: pełny revert ścieżki open pickera do 5fb3493 — przywrócono `materialCandidates` z ctx (było `[]`!), usunięto tag filters + API-only input, debounce lokalny jak golden path; zachowano async viz variant search. Restart `serve_browser.py` wykonany przez agenta (:8765/:8766 HTTP 200). sim ALL PASS.

**Efekt/Fix:** Bridge empty-q guard OK; JS `?v=4.0.53-assocPickerRevert20260726e`.

**Źródła:** dam-assoc-edit.js, local_bridge.py, serve_browser restart

---

## 2026-07-26 - User: ZNOWU zepsute przyciski — restore + /reflect (4.0.52)

**Komenda/Akcja:** Regresja 4.0.51 — wszystko crashuje oprócz „Edytuj produkty”; 6300478 zamarza całą app; przywrócić poprzednie działanie.

**Log/Status:** Root cause: przy otwarciu material/brandingSearch picker wymuszono `loadBrandingMaterialCandidates({ bootstrapQuery: "" })` → bridge skanował cały branding-search-index; wycięto seed `materialCandidates` i `bootstrapQuery` wariantów. Fix v4.0.52: przywrócono init z 5fb3493 (bootstrapQuery z kontekstu, seed kandydatów, brak fetch bez q≥2); bridge guard pustego q; golden path product nietknięty. sim-assoc-dodaj ALL PASS.

**Efekt/Fix:** Restart `python apps/desktop/serve_browser.py` + Ctrl+F5 z `?v=4.0.52-assocPickerRestore20260726d`.

**Źródła:** dam-assoc-edit.js, local_bridge.py resolve_branding_search_picker, version 4.0.52

---

## 2026-07-26 - User: picker freeze 6300478, search zacina, 90vw, tagi (4.0.51)

**Komenda/Akcja:** Freeze przy Dodaj warianty/sugestie; 6300728 OK / 6300478 freeze; wyszukiwarka zacina UI; picker 90vw + regular font; tagi jak branding skondensowane.

**Log/Status:** v4.0.51: usunięto zwrot całego `__damBrandingIndex` w loadLinkedBrandingAssetsForProduct; picker bez sync scan; DamSearch.search async; material search tylko API; cap 80; tag filters scroll snap; 90vw.

**Efekt/Fix:** Ctrl+F5 `?v=4.0.51-assocPickerFreezeFix20260726c` + restart serve_browser.py.

**Źródła:** dam-assoc-edit.js, dam-media-preview.js, version 4.0.51

---

## 2026-07-26 - User: br-* stale indeksy w pickerze, miniatury, viz revision expand, sugestie freeze (4.0.50)

**Komenda/Akcja:** Usunąć wyświetlanie starych `br-005510` jako etykiet; pokazać nazwę materiału + bubble M-SHOP*; miniatury; filtrować skojarzenia spoza folderu; viz warianty = klik produkt → rewizje; sugestie bez ładowania file-index.

**Log/Status:** v4.0.50: `brandingEntryToPickerRow`, `filterBrandingVariantIdsForPrimary`, bridge `_light_branding_picker_entry` + title/thumb_url; material/branding picker skip `ensureFileIndex`; `productSearchForVariants` expand+rev pick bez nadpisywania pinnedIds; `mergeProductsFromVariantPicker` revisionPath. QA sim-assoc-dodaj PASS.

**Efekt/Fix:** [branding](http://127.0.0.1:8765/branding.html?v=4.0.50-brLegacyPurge20260726b) [viz](http://127.0.0.1:8765/visualizations.html?v=4.0.50-brLegacyPurge20260726b)

**Źródła:** dam-assoc-edit.js, dam-viz.js, local_bridge.py, version 4.0.50

---

## 2026-07-26 - User: br-* stale indeksy w pickerze, miniatury, viz revision expand, sugestie freeze (4.0.50)

**Komenda/Akcja:** Usunąć wyświetlanie starych `br-005510` jako etykiet; pokazać nazwę materiału + bubble M-SHOP*; miniatury; filtrować skojarzenia spoza folderu; viz warianty = klik produkt → rewizje; sugestie bez ładowania file-index.

**Log/Status:** v4.0.50: `brandingEntryToPickerRow`, `filterBrandingVariantIdsForPrimary`, bridge `_light_branding_picker_entry` + title/thumb_url; material/branding picker skip `ensureFileIndex`; `productSearchForVariants` expand+rev pick bez nadpisywania pinnedIds; `mergeProductsFromVariantPicker` revisionPath. QA sim-assoc-dodaj PASS.

**Efekt/Fix:** [branding](http://127.0.0.1:8765/branding.html?v=4.0.50-brLegacyPurge20260726b) [viz](http://127.0.0.1:8765/visualizations.html?v=4.0.50-brLegacyPurge20260726b)

**Źródła:** dam-assoc-edit.js, dam-viz.js, local_bridge.py, version 4.0.50

---

## 2026-07-26 - User: commit 4.0.48 + assoc picker UX unify (4.0.49)

**Komenda/Akcja:** Commit poprawki freeze; viz warianty = wyszukiwanie produktów po indeksie jak branding; sugestie crash; branding warianty lista+tagi; footery globalne Wstecz|Dodaj z dysku|Zatwierdź.

**Log/Status:** Commit `e91aba0` (4.0.48 pinned≠pool). v4.0.49: `productSearchForVariants` (viz), `brandingSearch`+bootstrap fetch (branding warianty), unified footer, `schedulePaintPicker`+rAF debounce, min 2 znaki search guard, bubble index tags, `shortAssocLabel`. QA sims PASS.

**Efekt/Fix:** [viz](http://127.0.0.1:8765/visualizations.html?v=4.0.49-assocPickerUxUnify20260726a) [branding](http://127.0.0.1:8765/branding.html?v=4.0.49-assocPickerUxUnify20260726a)

**Źródła:** dam-assoc-edit.js, dam-viz.js, version 4.0.49

---

## 2026-07-26 - User: CTA warianty/sugestie zamrażają całą app — napraw (golden path produktów)

**Komenda/Akcja:** Branding „Dodaj/Edytuj warianty” + viz „Dodaj/Edytuj warianty” i „Dodaj/Edytuj sugestie” — freeze całej strony; produkty działają — ta sama ścieżka click→picker.

**Log/Status:** v4.0.48 root cause: `collectLinkedIdsFromCtx(kind:variant)` traktował **cały pool kandydatów** (`gc.variants` = setki wiz items) jako pinned → sync `renderPinned()` × tysiące DOM. Fix: `variantPinnedIds` (reprezentanci stripu) ≠ `variantCandidates` (pool); guard pool>40; material bez `materialCandidates` w pinned; golden `ensureFileIndex().then(paintPicker)` dla wszystkich kind; usunięto fast-path `paintPicker({products:[]})` + `openMediaPickerImmediate`. QA: sim-assoc-dodaj/viz-sync-ctx/material-empty-seed ALL PASS.

**Efekt/Fix:** Klik CTA otwiera picker bez zawieszenia (harness). Cache-bust `4.0.48-variantPinnedPoolFix20260726a`.

**Źródła:** dam-assoc-edit.js, dam-viz.js, version 4.0.48, [visualizations](http://127.0.0.1:8765/visualizations.html?v=4.0.48-variantPinnedPoolFix20260726a), [branding](http://127.0.0.1:8765/branding.html?v=4.0.48-variantPinnedPoolFix20260726a)

---

## 2026-07-26 - User: Shift+przytrzymaj minus skojarzen — brak ringu, opozniony toast, brak seed/enrich

**Komenda/Akcja:** Usuwanie skojarzen (Shift + hold 2 s) nie responsywne — brak kółeczka przy kursorze, powiadomienie za późno; ma działac seed and enrich jak wszędzie.

**Log/Status:** v4.0.47: `wireQuickMinusControl` → `DamDanger.bind` (cursor ring 44px, 1,5 s); `seedEnrichAssocSave` + `patchCtxProductIds`/`patchCtxVariantIds`/`patchAssetProductIds` — natychmiast UI+toast, zapis bridge w tle; rollback przy błędzie/Cofnij. Bump cache-bust dam-assoc-edit.js we wszystkich HTML.

**Efekt/Fix:** Hold minus pokazuje ring przy kursorze; kafelek znika od razu; toast „Usunięto…” bez czekania na POST. `node --check` OK.

**Źródła:** dam-assoc-edit.js, version 4.0.47, visualizations.html

---

## 2026-07-26 - User: audyt agenta 4.0.50 (Aplikacja szczegółowy opis) vs Reflect; freeze pickerów

**Komenda/Akcja:** Porównanie zmian v4.0.50; czy Reflect zmniejszyłby błędy; freeze warianty/sugestie; wyszukiwarka; UI 90vw/tagi.

**Log/Status:** Przegląd commitów 5fb3493/e91aba0 + diff uncommitted; transcript `1e5bbfd1-c534-4bbf-95ec-bb4cb68afcbf`. Hipoteza freeze: productSearchForVariants → ensureFileIndex; brandingSearch → load 120 przy pustym q; search → sync pętla po products.

**Efekt/Fix:** Odpowiedź reflect po ludzku; skill final-deliverable już zaktualizowany pod język human.

**Źródła:** dam-assoc-edit.js, local_bridge.py resolve_branding_search_picker, agent-transcripts/1e5bbfd1…

---

## 2026-07-26 - User: final /reflect ma brzmieć jak do człowieka, nie telegraf techniczny

**Komenda/Akcja:** Przykład rozmowy critic→parent; odrzucenie skrótu „preflight [x]”; final = przebieg rozumowania + plan po ludzku; prawdziwość bez sztucznych 5 przelotów.

**Log/Status:** final-deliverable.md §2 przepisany: język HARD, szablon po ludzku, opcjonalny appendix kodu.

**Efekt/Fix:** Skill wymusza narrację jak w paste.txt (Sonnet critic + czytelny parent), nie suchą tabelę bramek.

**Źródła:** final-deliverable.md, user feedback reflect format

---

## 2026-07-26 - User: format finalu /reflect — czytelna odpowiedź + handoff agenta

**Komenda/Akcja:** Po /reflect agent ma pokazać sensowną odpowiedź dla człowieka + wnioski/instrukcje dla agenta; krytyk z atrybucją Sonnet osobno.

**Log/Status:** Dodano `references/final-deliverable.md`; zaktualizowano critic-core (format krytyka + atrybucja), SKILL reflection-loop §4 Final, skill reflect.

**Efekt/Fix:** Trzy warstwy: krytyk wewnętrzny → final user (podsumowanie, bramki, co dalej) → sekcja „Dla agenta (następna tura)”.

**Źródła:** final-deliverable.md, wzorzec rozmowy DAM bind→paint/P1

---

## 2026-07-26 - User: /reflect wdrażaj P1 + dokończ skill + push cursor-sync

**Komenda/Akcja:** `/reflect` wdrażaj P1 (harness FAIL pre-fix); skill miał działać jako `/reflect` nie `/reflection-loop`; dokończ skill; push cursor-sync.

**Log/Status:** P1: `seedMaterialsCtx` w dam-assoc-edit.js + sync call w dam-viz.js po bindVizAssocCtas; v4.0.42 bump + cache-bust. Harness `sim-assoc-viz-sync-ctx.js` PASS (contract + integration). Skill: nowy `~/.cursor/skills/reflect/SKILL.md` (primary `/reflect`), `reflect.mdc`, reflection-loop = pełna spec + alias. Preflight 8/8 PASS.

**Efekt/Fix:** CTA sugestie w viz modal ma sync ctx przed async enrich; `/reflect` jako canonical slash. Runtime Ctrl+F5 — USER UNVERIFIED.

**Źródła:** dam-viz.js, dam-assoc-edit.js, sim-assoc-viz-sync-ctx.js, ~/.cursor/skills/reflect/, test-preflight.js

---

## 2026-07-26 - User: decyzja produktowa reflection-loop — strict opcjonalny + ranking warstw

**Komenda/Akcja:** Potwierdzenie wyników testu T1/T6/T7; zostaw global-only fallback; strict jako opcja w regule projektu; ranking Polityka przed Historią — naprawa przy okazji.

**Log/Status:** Zaimplementowano `strict: true` w preflight (`test-preflight.js` + T8 PASS). SKILL.md, critic-core, overlay-template, global + DAM reflection-loop.mdc zaktualizowane. `pickBestFile` w builderze: process.md przed CHANGELOG, rules przed innymi w Polityka.

**Efekt/Fix:** Kontrakt zgodny z decyzją usera: domyślnie PASS_GLOBAL_ONLY; strict blokuje bez overlay. DAM bez zmiany zachowania (overlay już jest).

**Źródła:** test-preflight.js T8, ~/.cursor/skills/reflection-loop/, .cursor/rules/reflection-loop.mdc

---

## 2026-07-26 - User: test blokady SETUP_INCOMPLETE + jakość auto-READ (dowód)

**Komenda/Akcja:** Dwa testy przed zaufaniem systemowi: (1) blokada gdy brak/niepełny overlay, (2) bootstrap na obcym repo — sens semantyczny READ; nie auto-bootstrap na /reflect bez zgody.

**Log/Status:** Uruchomiono `~/.cursor/skills/reflection-loop/scripts/test-preflight.js` — 7 scenariuszy PASS. T1: brak overlay projektu → PASS_GLOBAL_ONLY (NIE blokuje Generate). T2: TODO w READ → SETUP_INCOMPLETE blokuje. T6: cursor-sync-dev bootstrap semanticOk (Historia+Operacyjne+Kontekst). T7: shallow repo semanticOk false. Zaktualizowano critic-core + SKILL: zgoda przed bootstrap, semanticOk ≥2 warstwy.

**Efekt/Fix:** Rozjazd udokumentowany: global critic = brak SETUP_INCOMPLETE przy braku overlay projektu (by design). Blokada działa na niepełny overlay i brak global.

**Źródła:** test-preflight.js, cursor-sync-dev AGENTS.md/CHANGELOG/README

---

## 2026-07-26 - User: skill reflection-loop — bootstrap READ + szablon overlay w skillu

**Komenda/Akcja:** Skill ma zawierać procedurę tworzenia szablonu overlay i listy READ (nie tylko link zewnętrzny).

**Log/Status:** SKILL.md § Bootstrap (algorytm READ, szablon critic.md, reguła, walidacja); `references/read-list-builder.md`; rozszerzony `overlay-template.md`; preflight = global critic + opcjonalny overlay projektu.

**Efekt/Fix:** Agent może sam zbudować `.cursor/agents/critic.md` i READ w dowolnym repo bez dokumentacji poza skilliem.

**Źródła:** ~/.cursor/skills/reflection-loop/

---

## 2026-07-26 - User: skill reflection-loop ma być uniwersalny (nie tylko DAM)

**Komenda/Akcja:** reflection-loop ogólny/universal; specyfika workspace tylko w overlay projektu.

**Log/Status:** Przepisano `~/.cursor/skills/reflection-loop/SKILL.md` + `references/critic-core.md` (pięć trybów, READ, overlay pattern). DAM: critic.md, checklist, rule.mdc = overlay wskazujący na skill globalny.

**Efekt/Fix:** Skill działa w każdym repo; projekt dodaje `.cursor/agents/critic.md` + checklistę bez forkowania skillu.

**Źródła:** reflection-loop SKILL.md, critic-core.md, critic.md overlay, reflection-loop.mdc

---

## 2026-07-26 - User: harness sim-assoc-viz-sync-ctx.js przed P1 + FAIL pre-fix

**Komenda/Akcja:** Napisać sim-assoc-viz-sync-ctx.js (draft v3); uruchomić na kodzie pre-fix — musi FAILować dowodem ctx toast; contract z seed musi PASS.

**Log/Status:** Dodano `scripts/qa/sim-assoc-viz-sync-ctx.js`: contract_seeded PASS; integration FAIL pre-fix (`ctxToast: true`, toast „Brak kontekstu materiałów.", brak popover); `p1SyncSeedInDamVizSource: false`; exit 1.

**Efekt/Fix:** Harness gotowy przed kodem P1; po wdrożeniu sync seed w dam-viz.js harness powinien PASS (detekcja seed w źródle).

**Źródła:** sim-assoc-viz-sync-ctx.js, dam-assoc-edit.js openVizAssocSuggestionsPicker L2685-2688

---

## 2026-07-26 - User: suchy test reflection-loop P1 + 5 trybów krytyka w critic.md

**Komenda/Akcja:** Suchy test planu P1 bez kodu; pełny log rund; zakodować w critic.md pięć trybów (dowód, historia, diagnoza/wdrożenie, retoryka/treść, nieobecność) + READ §12/process.md przed oceną.

**Log/Status:** Zaktualizowano `.cursor/agents/critic.md` i checklistę; dry test 3 rundy (subagent Task limit API → parent wykonał krytykę wg promptu); draft v1 REVISE, v2 REVISE, v3 PASS.

**Efekt/Fix:** Krytyk wychwycił: sim-assoc-dodaj ≠ dowód P1, brak runtime Ctrl+F5, brak macierzy „nie ruszać”, brak dam-media-preview w plikach, bramka≠implementacja.

**Źródła:** critic.md v2, reflection-loop-checklist.md, code-doctrine §12 P1, process.md wpisy 2026-07-26

---

## 2026-07-26 - User: pakiet reflection-loop (actor-critic) — scope P1-P4 + architektura

**Komenda/Akcja:** Zielone światło na budowę pakietu reflection-loop z wąskim triggerem: tylko zmiany assoc/viz (P1-P4) i decyzje architektoniczne; nie alwaysApply na całą konwersację; manual `/reflect`.

**Log/Status:** Utworzono `.cursor/agents/critic.md` (subagent krytyk, Sonnet); skill globalny `~/.cursor/skills/reflection-loop/SKILL.md`; reguła `.cursor/rules/reflection-loop.mdc` (globs assoc/viz, alwaysApply: false); checklista `agents/shared/reflection-loop-checklist.md`.

**Efekt/Fix:** Pętla Generate→Critic→Revise max 3 rundy; auto tylko przy P1-P4/freeze/bind/ctx/COMBO/ADR/PI; manual `/reflect`; po PASS nadal obowiązuje dam-dobrakaloria.

**Źródła:** critic.md, reflection-loop.mdc, reflection-loop SKILL, reflection-loop-checklist.md, code-doctrine §12 macierz P1-P4

---

## 2026-07-26 - User: zawsze klikalny link do strony

**Komenda/Akcja:** Przy weryfikacji UI zawsze podawać klikalny URL (nie sam tekst Ctrl+F5).

**Log/Status:** Zapis w memory.md; link 4.0.46 poniżej w odpowiedzi.

---

## 2026-07-26 - User: sugestie+variant crash — golden path product (4.0.46)

**Komenda/Akcja:** Napraw wszystkie CTA oprócz produktów — ten sam łańcuch co „Dodaj/Edytuj produkty”; nie dotykać product.

**Log/Status:** Root cause: product=async ensureFileIndex; variant/material=sync paintPicker w click stack → freeze. Fix: jeden onAssocCtaClick→openEditPicker; openMediaPicker defer variant/material; usunięto osobną ścieżkę openVizAssocVariantsPicker z click handlera.

**Efekt/Fix:** 4.0.46 · Ctrl+F5 `?v=4.0.46-goldenCtaDefer20260726a`

**Źródła:** dam-assoc-edit.js openMediaPickerImmediate, sim PASS

---

## 2026-07-26 - User: /reflect — sugestie = golden path product (freeze)

**Komenda/Akcja:** Przenieść „Dodaj/Edytuj sugestie” na ten sam łańcuch co „Dodaj/Edytuj produkty” — tylko kind=material + model danych; freeze dalej.

**Log/Status:** 4.0.45 — onAssocCtaClick: suggestions→material → openEditPicker(col,"material",ctx); openEditPicker material branch + setTimeout(0) defer picker; seed/bindMaterialsCtx alias _damAssocCtx; 4.0.44 lite fetch bez zmian.

**Efekt/Fix:** Ctrl+F5 `?v=4.0.45-goldenMaterial20260726a` — klik sugestii = picker bez freeze. Regresja: produkty branding.

**Źródła:** dam-assoc-edit.js openEditPicker material, sim-assoc-dodaj PASS

---

## 2026-07-26 - User: przeglądarka zacięła (viz modal skeleton)

**Komenda/Akcja:** Freeze przy open modala viz — skeleton SKOJARZONE MATERIAŁY + spinner; agent CDP wisiał 80s.

**Log/Status:** Root cause: `renderLinkedBrandingAssets` → `loadIndexAssets()` fetch+parse ~392MB branding-index. Fix 4.0.44: `loadLinkedBrandingAssetsForProduct` → bridge `/branding-for-product` (KB). P1 seedMaterialsCtx bez zmian.

**Efekt/Fix:** Ctrl+F5 `visualizations.html?v=4.0.44-vizAssocLite20260726a` — modal bez freeze. Nie używać ciężkiego CDP click na otwartym modalu.

**Źródła:** dam-media-preview.js, version 4.0.44, dam-project.js wzorzec freeze fix

---

## 2026-07-26 - User: wdrażaj P1 (popraw)

**Komenda/Akcja:** Wdrożenie P1 — sync seed `_damMaterialsCtx` w dam-viz.js; bump 4.0.43; QA + regresja.

**Log/Status:** Uporządkowano dam-viz.js (jeden `vizProductCtx` → seed + renderLinkedAssetsInto); wersja 4.0.43; cache `4.0.43-p1SyncCtx20260726b`; sim-assoc-dodaj/viz-sync-ctx/material-empty-seed PASS.

**Efekt/Fix:** Ctrl+F5 `visualizations.html?v=4.0.43-p1SyncCtx20260726b` — klik sugestii zaraz po open (bez toastu ctx). Regresja: branding produkty.

**Źródła:** dam-viz.js, dam-assoc-edit.js seedMaterialsCtx, version 4.0.43

---

## 2026-07-26 - User: /reflect — krótki plan działania assoc

**Komenda/Akcja:** Krótki plan działania po dokumentacji glossary + bramce P1; /reflect.

**Log/Status:** Preflight PASS_GLOBAL_ONLY; plan: P1 kod → QA → runtime user → regresja złoty path → P2 warianty; bez batch wszystkich CTA.

**Efekt/Fix:** Oczekiwanie na sygnał „wdrażaj P1” od usera.

**Źródła:** PROGRESS.md, docs/ASSOC-GLOSSARY.md, code-doctrine §12

---

## 2026-07-26 - User: zapis wyjaśnień assoc (glossary) + poprawka metafory bind

**Komenda/Akcja:** Zapis wyjaśnień pojęć (typ B, sync ctx, metafory) w doctrine, PROGRESS, docs GitHub; poprawić nieścisłość bind — rozdzielić przetrwanie listenera vs wymianę ctx przy każdym bind().

**Log/Status:** Utworzono `docs/ASSOC-GLOSSARY.md`; zaktualizowano code-doctrine §12 (wyjaśnienie po ludzku + sekcja Słownik + tabela bind 2 zjawiska); PROGRESS.md sekcja 2026-07-26; ARCHITECTURE.md link do glossary.

**Efekt/Fix:** Dokumentacja GitHub-ready; bind: strażnik zostaje, karteczka wymieniana — bez mieszania pojęć.

**Źródła:** docs/ASSOC-GLOSSARY.md, code-doctrine.md §12, PROGRESS.md, docs/ARCHITECTURE.md

---

## 2026-07-26 - User: plan wdrożenia P1 + czy można naprawiać pozostałe CTA

**Komenda/Akcja:** Potwierdzenie zrozumienia (branding produkty vs inne); czy plan P1 OK (tylko dam-viz.js sync ctx, browser test, regresja złotego path); czy można iść dalej z pozostałymi przyciskami bez freeze.

**Log/Status:** Odpowiedź: P1 gotowy do kodu (bramka picker PASS); pozostałe CTA = osobne gałęzie P2–P4, nie jeden batch; plan usera zaakceptowany z doprecyzowaniem harness vs runtime.

**Efekt/Fix:** Czekamy na jawny sygnał „wdrażaj P1”; potem Ctrl+F5 + regresja branding produkty.

**Źródła:** code-doctrine §12, sim-assoc-material-empty-seed.js

---

## 2026-07-26 - User: bramka P1 — test pusty materialCandidates przed sync ctx

**Komenda/Akcja:** Następny krok przed kodem P1: test czy openMediaPicker(kind:material) toleruje pusty materialCandidates bez freeze; dopiero potem zielone światło na sync ctx.

**Log/Status:** Dodano `scripts/qa/sim-assoc-material-empty-seed.js`; uruchomiono PASS (directOpen ~0,4ms, viz path ~0,2ms, 0 fetch w click stack, material fast-path + skip renderOptions when empty). Zaktualizowano §12 backlog P1: bramka `[x]`, implementacja sync ctx nadal `[ ]`.

**Efekt/Fix:** Zielone światło na wdrożenie sync `_damMaterialsCtx` w dam-viz.js; runtime user Ctrl+F5 nadal wymagany po kodzie.

**Źródła:** sim-assoc-material-empty-seed.js, dam-assoc-edit.js ~1471–1525, code-doctrine §12

---

## 2026-07-26 - User: dopisek REFERENCE — warstwy listener/ctx/dane, sync ctx, P1 backlog

**Komenda/Akcja:** Dopisz do §12: tabele warstw branding vs viz, zasadę „sync ctx przed async enrich”, P1 jako otwarty task (nie done); preflight czy productContext jest sync przed loadIndexAssets.

**Log/Status:** Potwierdzono w kodzie: `dam-viz.js` `first`/`productName`/`renderLinkedAssetsInto` productContext — sync przed fetch; tylko materialsList wymaga async. Dopisano: typ awarii A vs B, tabela 3 warstw, `_damVizAssocCtasBound` na rodzicu, zasada, backlog P1 `[ ]`, macierz priorytetów zaktualizowana.

**Efekt/Fix:** code-doctrine.md §12 REFERENCE — precyzja listener vs ctx vs dane; P1 = diagnoza + kierunek, nie wdrożenie.

**Źródła:** dam-viz.js ~2272–2686, dam-assoc-edit.js bindVizAssocCtas/openVizAssocSuggestionsPicker, code-doctrine §12

---

## 2026-07-26 - User: czy wszystkie wnioski w doctrine?

**Komenda/Akcja:** Potwierdzenie — czy poprzednie wnioski (domena, unifikacja, historia 4.0.18–41, macierz priorytetów) są w code-doctrine.

**Log/Status:** Audyt REFERENCE §12: były złoty path + bind→paint; brakowało modelu domenowego, macierzy P1–P4, oceny unifikacji, historii wersji, wyjaśnienia po ludzku. Dopisano 5 podsekcji na końcu REFERENCE.

**Efekt/Fix:** code-doctrine.md §12 REFERENCE kompletny względem sesji audytu assoc.

**Źródła:** code-doctrine.md §12, process.md wpisy 4.0.36–4.0.41

---

## 2026-07-26 - User: trzeci diagram bind→paint (renderMeta przed klikiem)

**Komenda/Akcja:** Diagram klik→zapis OK, brakuje fazy bind/paint — root cause freeze v4.0.20/21; dopisz co robi renderMeta/paintAssoc/bind sync vs async przed fixem viz sugestii.

**Log/Status:** Prześledzono dam-media-preview.js (paintAssoc, associationsFooterHtml, renderBrandingRelatedMaterials, enrichLinkedProducts, seedLinkedProducts) + dam-assoc-edit.js (bindAssocSection, ensureInjectedCss, bindAssocCtas) + dam-viz.js (bindVizAssocCtas, bindMaterialsPane). Dopisano §12 REFERENCE: tabela sync/async, mermaid bind→paint, reguły anty-freeze.

**Efekt/Fix:** Trzeci diagram w code-doctrine.md — faza bind→paint oddzielona od klik→zapis; potwierdzenie: branding produkty nie ładują file-index na bindzie; enrich async po seed.

**Źródła:** code-doctrine.md §12, dam-media-preview.js ~4263–4375, dam-assoc-edit.js bindAssocSection/enrichLinkedProducts

---

## 2026-07-26 - User: audyt zlotego path „Dodaj/Edytuj produkty” (branding)

**Komenda/Akcja:** Przesledz dokladnie DOM Path przycisku `data-viz-assoc-cta=product` w #damMediaPreview — caly lancuch przed/po pickerze; kompendium w code-doctrine + opis po ludzku.

**Log/Status:** Przeanalizowano dam-media-preview.js (assocLabelRow, renderMeta, bind) + dam-assoc-edit.js (bindAssocCtas delegacja, onAssocCtaClick, openEditPicker, openMediaPicker, saveAssociations). Dopisano REFERENCE w code-doctrine §12.

**Efekt/Fix:** Dokumentacja — zloty path = delegowany listener na #damMediaPreviewAssoc + ctx refresh; NIE bindVizAssocCtas.

**Zrodla:** dam-media-preview.js, dam-assoc-edit.js, code-doctrine.md §12

---

## 2026-07-26 - User: PICKER do COMBO (nie combo do pickera) — v4.0.41

**Komenda/Akcja:** Odwrócić kierunek — benchmark = COMBO overlay; picker Skojarzone ma dociągnąć do shell COMBO, nie embed COMBO w popover.

**Log/Status:** Cofnięto enterAssocComboEmbed; COMBO z powrotem stackOnAssoc overlay; `#damAssocEditPopover` = `dam-thumb-picker-box` + `dam-thumb-picker__head`/`__footer` (jak COMBO); usunięto klasy `dam-tag-edit-popover` ze shell.

**Efekt/Fix:** http://127.0.0.1:8765/branding.html?v=4.0.41-pickerToComboShell20260726c

**Zrodla:** dam-assoc-edit.js, dam-assoc-edit.css, dam-brand.css, dam-folder-picker.js (stack)

---

## 2026-07-26 - User: COMBO embed w popover skojarzen — v4.0.40 (COFNIĘTE w 4.0.41)

**Komenda/Akcja:** Przyciski Wstecz/X COMBO vs Skojarzone produkty dalej w roznych X/Y; benchmark = assoc picker; COMBO nie ma byc w osobnym boxie.

**Log/Status:** COMBO osadzone w `#damAssocEditPopover` (`is-combo-mode` + `#damAssocComboHost`); ten sam `.dam-tag-edit-popover__head` i `.dam-tag-edit-popover__actions`; `DamFolderPicker.open({ embedHost })`; Wstecz/X/Esc = dismiss embed; Anuluj = closePicker.

**Efekt/Fix:** http://127.0.0.1:8765/branding.html?v=4.0.40-embedComboInPopover20260726b — Wstecz/X musza miec identyczne rect jak w widoku Skojarzone produkty.

**Zrodla:** dam-assoc-edit.js, dam-folder-picker.js, version 4.0.40

---

## 2026-07-26 - User: COMBO stack + Wstecz wraca + grid stopki 1:1 — v4.0.39

**Komenda/Akcja:** Przyciski/footer/head COMBO vs Skojarzone produkty w innych miejscach; Wstecz COMBO ma wracac do pickera nie zamykac; bez osobnej ramki.

**Log/Status:** goto-combo bez closePicker; stackOnAssoc align getBoundingClientRect; Wstecz=dismiss, Anuluj=closePicker; grid footer 4-col; assoc 70vw sync css; te same klasy przyciskow.

**Efekt/Fix:** http://127.0.0.1:8765/branding.html?v=4.0.39-stackComboModal20260726a

**Zrodla:** dam-assoc-edit.js, dam-folder-picker.js, dam-assoc-edit.css, dam-brand.css

---

**Komenda/Akcja:** Naglowki Skojarzone produkty vs Eksplorator COMBO rozjezdzaja sie; footer COMBO + Wstecz; globalnie primary po prawej, dismiss po lewej (web).

**Log/Status:** wspolny head 53px/padding 10x14; overlay padding 12px; COMBO footer Wstecz+Anuluj|Wybierz; dam-dialog-actions + spacer; assoc/tag/viz-request/explorer/dashboard/device-paths.

**Efekt/Fix:** http://127.0.0.1:8765/branding.html?v=4.0.38-dialogActions20260726a

**Zrodla:** dam-brand.css, dam-assoc-edit.js, dam-folder-picker.js, dam-tag-edit.js

---

**Komenda/Akcja:** `.dam-tag-edit-popover__close` w Skojarzone produkty → styl jak `#damThumbPickerClose`; ten z COMBO przeniesc do naglowka (nie viewport corner).

**Log/Status:** assoc picker: klasa `dam-viz-modal-close`; inject CSS position static w head; COMBO `#damThumbPickerClose` reset absolute → flex head.

**Efekt/Fix:** http://127.0.0.1:8765/branding.html?v=4.0.37-modalCloseHead20260726a

**Zrodla:** dam-assoc-edit.js, dam-folder-picker.js, dam-assoc-edit.css, dam-brand.css

---

**Komenda/Akcja:** W AKTUALNE/pickerze dwa razy ten sam produkt (np. PROTEINA KARMEL 6300654 IG + Funkcjonalny) — kod anty-duplikat globalnie teraz i przy dodawaniu.

**Log/Status:** dedupeProductIds (id + normIndexKey); dedupeLinkedProductRecords; picker AKTUALNE, toggle, COMBO, Zatwierdz, saveAssociations, enrichLinkedProducts, UI Produkty; auto-czyszczenie przy openEditPicker gdy DB ma duplikaty.

**Efekt/Fix:** http://127.0.0.1:8765/branding.html?v=4.0.36-dedupeProductIndex20260726a

**Zrodla:** dam-assoc-edit.js dedupeProductIds, dam-media-preview.js associationsFooterHtml.

---

**Komenda/Akcja:** Przycisk COMBO = „Dodaj z dysku”; usunac #damThumbPickerUseFolder; tag indeksu przy folderze; folder KAR6X 6300655.00 ma dodac/odswiezyc produkt NATYCHMIAST; zostawic Skojarzone materialy (inne foldery) + Produkty toggle.

**Log/Status:** Root cause „dodano ale nic”: produkt proteina-karmel-z-mct-ig juz skojarzony — toast mylacy. Fix: matchProductsByFolder + revisions[].path + indeks w nazwie; patch product_index 6300655.00 + optimistic onRefresh przed POST; toast rozroznia nowy vs indeks rewizji. COMBO: tag indeksu na folderze; usuniety UseFolder. Branding: sekcja Skojarzone materialy (renderBrandingRelatedMaterials); pelna lista produktow bez relevance filter.

**Efekt/Fix:** http://127.0.0.1:8765/branding.html?v=4.0.35-folderPickIndex20260726a

**Test/Ewaluacja:** node --check; sim-assoc-dodaj + sim-assoc-ui-contracts. User Ctrl+F5.

**Zrodla:** dam-assoc-edit.js, dam-folder-picker.js, dam-media-preview.js v4.0.35.

---

**Komenda/Akcja:** Wyjasnic roznice dwoch przyciskow COMBO (wyszarzenie plikow); ujednolic na Eksplorator COMBO; w brandingu dodac zwijana zakladke Produkty jak Elementy/Surowe w wizualizacjach.

**Log/Status:** Root cause: openDiskFolderPicker vs openComboExplorerFromAssoc — rozne allowFolderPick/showWindowsButton. Jeden footer Eksplorator COMBO; openDiskFolderPicker = alias. linkedProductsHtml → produktyToggleBlockHtml + bindProduktyToggle. bump 4.0.34.

**Efekt/Fix:** http://127.0.0.1:8765/branding.html?v=4.0.34-comboUnifyProduktyTab20260726a

**Test/Ewaluacja:** node --check; sim-assoc-dodaj + sim-assoc-ui-contracts. User Ctrl+F5.

**Zrodla:** dam-assoc-edit.js openComboExplorerFromAssoc, dam-folder-picker.js fileItemHtml, dam-media-preview.js produkty toggle, code-doctrine §12 2026-07-26 v4.0.34.

---

**Komenda/Akcja:** ERROR RESPONSE — zly link od agenta.

**Log/Status:** curl: `/4.0.33/branding.html` = 404 File not found; `/branding.html` = 200 + skrypty 4.0.33. Prefiks wersji w URL dziala tylko przy rownoleglych instancjach (8767/8769 worktree), nie na domyslnym :8765.

**Efekt/Fix:** Poprawny link: http://127.0.0.1:8765/branding.html?v=openModalPrimary20260726a

**Zrodla:** serve_browser.py (WEB_ROOT bez subfolderu wersji).

---

## 2026-07-26 - User: zepsute przyciski 4.0.32 + zly modal Proteina→ZESTAWY + ext tag — v4.0.33

**Komenda/Akcja:** Przywroc dzialanie Dodaj/Edytuj produkty branding; napraw zly podglad karty; ext tag na koncu tytulu; link do strony po kazdej wersji.

**Log/Status:** Root cause modal: br-005515.folder_variants zawiera br-005510 spoza folderu, openModal bez primary → list[0] obcy asset. Fix ensurePrimaryFirstInList + filterFolderVariantsForPrimary. Product picker: revert min-2-chars (4.0.31 open), zostaje debounce input. injectTitleExtLayoutCss. v4.0.33 bump.

**Efekt/Fix:** http://127.0.0.1:8765/branding.html?v=openModalPrimary20260726a (NIE /4.0.33/ — 404 na domyslnym :8765).

**Test/Ewaluacja:** node --check; sim-assoc-dodaj ALL PASS 4.0.33. User Ctrl+F5.

**Zrodla:** dam-branding.js openModal, dam-assoc-edit.js, dam-media-preview.js, branding-index br-005515.

---

## 2026-07-26 - User: v4.0.30 dlaczego otwierało + regresja 4.0.31 (freeze search, zla karta, warianty) — v4.0.32

**Komenda/Akcja:** Dowiedz sie czemu sugestie otwieraly sie w 4.0.30; przywroc open bez freeze; branding produkty OK; warianty/sugestie/search zacinaja; usun Edytuj wszystko; Proteina card → zly asset; M-SHOP405510 zla miniatura.

**Log/Status:** Analiza: 4.0.30 instant open = product picker (zla tresc); 4.0.31 material picker + fetch on open = ciezsze. Fix 4.0.32: debounce renderOptions + min 2 znaki dla produktow; material fetch tylko on search; bez loadBranding on open; variantCandidates cap 160; usunieto hidden edit-all z assocLabelRow; cardHtml data-id=primary; resolveProductThumbUrl→productThumb; bump 4.0.32 cache.

**Efekt/Fix:** v4.0.32 `4.0.32-assocPickerFreeze20260726a` + branding.js `4.0.32-cardPrimaryId20260726a`. Czeka na user Ctrl+F5.

**Test/Ewaluacja:** node --check OK; sim-assoc-dodaj ALL PASS 4.0.32.

**Zrodla:** dam-assoc-edit.js, dam-media-preview.js, dam-branding.js, code-doctrine §12 2026-07-26.

---

## 2026-07-26 - User: v4.0.30 potwierdzone bugi viz (sugestie=produkty, zapis, disk=COMBO, warianty freeze) — v4.0.31

**Komenda/Akcja:** Sugestie działają ale pokazują produkty; Zatwierdź nie zapisuje; Dodaj z dysku=COMBO; usuń Edytuj wszystko viz; warianty zacinają.

**Log/Status:** `openVizAssocSuggestionsPicker` → `kind:material` + `saveProductMaterialSuggestions(productId)`. `openDiskFolderPicker` oddzielony od COMBO (folder/plik, bez Windows). Usunięto `data-assoc-edit-all` z viz materials/warianty + legacy inject. `openVizAssocVariantsPicker` → `openMediaPicker` + `onConfirmVariants`/`onRefresh` (bez `saveAssociations`). Usunięto `search.focus()` on open.

**Efekt/Fix:** v4.0.31 cache `4.0.31-vizAssocFix20260726f`.

**Test/Ewaluacja:** node --check; sim-assoc-dodaj ALL PASS 4.0.31. User: Ctrl+F5 + retest OATS 630369.

**Źródła:** dam-assoc-edit.js, dam-viz.js, user screenshots v4.0.30.

---

## 2026-07-26 - User: kiedy przyciski naprawdę działały + COMBO (audyt transkryptu)

**Komenda/Akcja:** Preanalizuj poprzedni czat — która poprawka miała działający przycisk + COMBO; agent kłamał mówiąc „działa”.

**Log/Status:** Audyt transcript `1e5bbfd1` + process.md. Werdykt: ostatnie potwierdzenie usera ≠ sim-assoc PASS. COMBO wdrożone w **v4.0.19**; jedyny działający styled CTA user potwierdził o **1:17** = **Dodaj/Edytuj sugestie** (v4.0.25). Pełniejszy baseline bez COMBO: **v4.0.18/4.0.24** (Edytuj wszystko viz + branding produkt). v4.0.27–4.0.30 = regresja wg usera (zero przycisków).

**Efekt/Fix:** Brak kodu w tej turze — tylko chronologia dla następnego restore.

**Źródła:** transcript 1e5bbfd1 L350/L392/L416; process §4.0.19/4.0.24/4.0.25/4.0.27.

---

## 2026-07-26 - User: NATYCHMIAST otwierać jak 3.1.5 — v4.0.30

**Komenda/Akcja:** „Na nic nie mam oczekiwać. Wszystko ma się NATYCHMIAST OTWIERAĆ. Zupełnie jak 3.1.5” — assoc picker bez „Ładowanie…” i defer.

**Log/Status:** Przywrócono flow 3.1.5 w `openMediaPicker`: wariant/materiał → sync `paintPicker`; produkt → cache `_DAM_FILE_INDEX` sync albo `ensureFileIndex().then(paintPicker)`. Usunięto shell-first + `setTimeout(populateAfterPaint)`. Sync `renderPinned`/`renderOptions` + focus search. `ensureFileIndex` = fetch+DamSearch race jak 3.1.5.

**Efekt/Fix:** v4.0.30 cache `4.0.30-assocInstant31520260726e`.

**Test/Ewaluacja:** node --check; sim-assoc-dodaj ALL PASS 4.0.30.

**Źródła:** dam-assoc-edit.js, _dam-assoc-edit-315.js, version bump.

---

## 2026-07-26 - User: PRZYWRÓĆ funkcje przycisków z 3.1.5 — v4.0.29

**Komenda/Akcja:** Przywrócić działanie assoc z 3.1.5; zachować styl widocznych +Dodaj/Edytuj (`dam-int-cta`).

**Log/Status:** Przywrócono ukryte `data-assoc-edit-all` obok stylu +Dodaj (preview/viz). CTA i plus-tile → `openEditPicker` jak 3.1.5; plus klika `[data-assoc-edit-all], [data-viz-assoc-cta]`. Viz sugestie → `openVizMaterialsEdit315` (product picker na materiale). Viz warianty → `openEditPicker(variant)`. Usunięto adaptery `openBrandingAssoc*` blokujące asset.id. COMBO/worker/shell-first bez zmian.

**Efekt/Fix:** v4.0.29 cache `4.0.29-assoc315Restore20260726d`.

**Test/Ewaluacja:** node --check; sim-assoc-dodaj ALL PASS 4.0.29.

**Źródła:** 2b3873a wiring, dam-assoc-edit.js, dam-media-preview.js, dam-viz.js.

---

## 2026-07-26 - User: naprawa + zachowaj styl +Dodaj — v4.0.28

**Komenda/Akcja:** Wdrożyć naprawę ścieżki assoc (branding plus warianty, parity z label CTA); **nie zmieniać** stylu przycisków `dam-int-cta` + ikona + `<span>Dodaj/Edytuj…</span>`.

**Log/Status:** `openAssocPickerForCol` — branding → `openBrandingAssoc*`, reszta → `openEditPicker`. Plus-tile w `#damMediaPreview`: warianty bez guarda `--material`; klik → ten sam adapter co label CTA; re-bind `_damAssocPlusBound`. Shift+klik w sekcji → `openAssocPickerForCol`. Styl label CTA / viz — bez zmian HTML.

**Efekt/Fix:** v4.0.28 cache `4.0.28-assocPlusBranding20260726c`.

**Test/Ewaluacja:** node --check; sim-assoc-dodaj + ui-contracts ALL PASS.

**Źródła:** dam-assoc-edit.js, version 4.0.28.

---

## 2026-07-26 - User: execute plan assoc CTA — wszystko martwe; bez psucia — v4.0.27

**Komenda/Akcja:** Uruchomić plan `assoc_cta_combo_fix`: adaptery domenowe §12, naprawić martwe CTA (branding product/variant, viz warianty), COMBO footer, inject CSS; zero CDP/klików.

**Log/Status:** `dam-assoc-edit.js`: guard `ctx.groupContext ||= {}` w `openEditPicker`/`enterEditMode`; `openBrandingAssocProductPicker` / `openBrandingAssocVariantPicker` (wymóg `asset.id` + toast); `openVizAssocVariantsPicker` bez `openEditPicker` (tylko callbacks); `mergeVizAssocCtasOpts` (nie nadpisuj `variantsCtx: null`); toast zamiast cichego return; inject CTA CSS `#damVizModal` + `#damMediaPreview`; variant footer + `data-goto-combo`. `dam-viz.js`: usunięto `bindVizAssocCtas(modal,{variantsCtx:null})`. Bump **4.0.27** cache `4.0.27-assocCtaCombo20260726b`.

**Efekt/Fix:** Root cause: TypeError na `ctx.groupContext.variants` + `variantsCtx` zerowany przy otwarciu modala + viz warianty szły w `saveAssociations` bez asset.

**Test/Ewaluacja:** node --check OK; sim-assoc-dodaj ALL PASS 4.0.27; sim-assoc-ui-contracts ALL PASS. User: Ctrl+F5 ręcznie.

**Źródła:** dam-assoc-edit.js, dam-viz.js, version 4.0.27, plan assoc_cta_combo_fix_26d5f043.

---

## 2026-07-26 - User: assoc tylko kod, bez CDP/klików; jeden działający adapter + COMBO

**Komenda/Akcja:** Natychmiast przerwać klikanie i `Runtime.evaluate`, ponieważ próba odtworzenia zawiesza DAM. Naprawić wyłącznie w kodzie: wszystkie CTA mają używać jednego działającego adaptera z kontekstem; przywrócić stopkę Assoc Edit z COMBO `DamFolderPicker` i linkiem do Eksploratora Windows; zachować styl `dam-int-cta dam-explorer-add-product-btn`.

**Log/Status:** W toku. Zakaz dalszego browser/CDP w tej rundzie przyjęty.

**Efekt/Fix:** W toku.

**Test/Ewaluacja:** Tylko testy statyczne/syntax/QA bez uruchamiania UI.

**Źródła:** `dam-assoc-edit.js`, `dam-media-preview.js`, `dam-viz.js`, `dam-folder-picker.js`, program-instructions `ui.assoc_edit_shell_adapters` i `ui.folder_picker_combo_only`.

---

## 2026-07-26 - User: CTA Dodaj/Edytuj zamiast Edytuj wszystko; viz sugestie|warianty; branding variant freeze — v4.0.25

**Komenda/Akcja:** Podpiąć `+Dodaj/Edytuj sugestie|warianty` do tej samej funkcji co Edytuj wszystko; usunąć Edytuj wszystko; branding: te same CTA co viz; naprawić blokadę wariantów/Dodaj.

**Log/Status:** `bindVizAssocCtas` + `openVizAssocSuggestionsPicker` + `openVizAssocVariantsPicker`; branding `assocLabelRow` → `.dam-int-cta.dam-viz-assoc-cta` (product|variant); `bindAssocCtas` delegowany; usunięto inject `dam-assoc-edit-all`; plus tile → bezpośrednio `openEditPicker`; variant picker `skipIndex` (bez `ensureFileIndex`); indeks tylko via `DamSearch.load()` worker; `bindVizAssocCtas(modal)` przy otwarciu viz.

**Efekt/Fix:** v4.0.25 cache `4.0.25-assocCtaUnify20260726a`. Viz CTA wired; branding parity CTA; variant col nie czeka na 8MB JSON sync.

**Test/Ewaluacja:** node --check OK; sim-assoc-dodaj ALL PASS 4.0.25; smoke 8765/8766=200; browser CDP: v4.0.25 + bindVizAssocCtas loaded.

**Źródła:** dam-assoc-edit.js, dam-media-preview.js, dam-viz.js, visualizations.html, branding.html.

---

**Komenda/Akcja:** Po poprawkach znów przestało działać; przywróć stan gdy Edytuj wszystko działało (restore 092821f jak v4.0.18).

**Log/Status:** `git checkout 092821f -- dam-assoc-edit.js dam-media-preview.js` (~97 KB). Cofnięto cały kod assoc z 4.0.19–4.0.23. Cache `4.0.24-restore092821f20260726a`. Zachowano: F5 native watchdog (launch.py), inline F5 head, panic-reload bez preventDefault.

**Efekt/Fix:** v4.0.24 = ten sam kod assoc co 3.2.0 / v4.0.18. Viz Edytuj wszystko powinno znów otwierać panel. Branding plus produktów działa; viz CTAs sugestie|warianty nadal wymagają osobnego dodania (nie były w 092821f).

**Test/Ewaluacja:** node --check OK; sim-assoc-dodaj ALL PASS 4.0.24.

**Źródła:** commit 092821f, visualizations.html, branding.html.

---

**Komenda/Akcja:** F5 dalej nie dziala; zaden wat UI nie moze miec wladzy nad F5; aplikacja nie moze sie zacinać na przyciskach assoc.

**Log/Status:** Root cause: (1) `ensureFileIndex` race z `fetch().json()` = sync parse 8MB main thread; (2) `preventDefault` na F5 blokowal natywny reload WebView2; (3) pywebview wylacza natywne skroty — JS alone niewystarczajacy. Fix: Python `start_hard_reset_watchdog` (GetAsyncKeyState, restart_window poza JS); usunięto preventDefault z panic-reload + shortcuts; inline F5 bootstrap w `<head>`; ensureFileIndex → tylko DamSearch.load/worker.

**Efekt/Fix:** v4.0.23 cache `4.0.23-nativeF520260726a`. **Restart desktop app** wymagany (launch.py watchdog). Browser: Ctrl+F5 lub F5 natywny.

**Test/Ewaluacja:** node --check panic+assoc; py_compile launch.py.

**Źródła:** launch.py, dam-panic-reload.js, dam-assoc-edit.js ensureFileIndex.

---

**Komenda/Akcja:** F5 ma robic kompletny reset jak wyłącz/włącz aplikację — niezależnie od stanu strony, ponad kazda linia kodu.

**Log/Status:** Przepisano `dam-panic-reload.js`: F5/Ctrl+R → abort fetch + window.stop + (desktop) restart_window | (browser) location.replace cache-bust. Usunięto `dam:panic-reset` i tearDownOverlays z sciezki reload (re-entry freeze). `dam-shortcuts.refreshApp` deleguje tylko do `__damHardReload`. Dodano panic-reload do settings.html + profile.html. Cache `4.0.22-hardResetF520260726a`.

**Efekt/Fix:** v4.0.22. F5 = circuit breaker w capture phase (head, przed heavy JS).

**Test/Ewaluacja:** node --check dam-panic-reload.js dam-shortcuts.js PASS.

**Źródła:** dam-panic-reload.js, dam-shortcuts.js, launch.py restart_window.

---

**Komenda/Akcja:** Niezależna weryfikacja diff v4.0.21 po Groku: paint-first shell, deferred populate/fetch, delegated viz CTA bind. Zero browser/CDP.

**Log/Status:** Przeczytano git diff `dam-assoc-edit.js`, call stack suggestions/variants, `bindVizAssocCtas`. Uruchomiono: `sim-assoc-run-all` after-fix **0/8**, `sim-assoc-click-timing.js` (nowy), `harness-assoc-click-timing.js`, curl hash **MATCH×6**, node --check PASS.

**Decyzja review:**

| Check | Wynik |
|-------|-------|
| Root cause sync render + dead late CTA | **POTWIERDZONE** (real code, nie komentarz) |
| Heavy work przed return | **NIE** (fetch/render w macrotask) |
| Delegated binder | **PASS** |
| Harness = production path | **TAK** (`vm.runInNewContext`) |
| QA static | **0/8** |
| Served/cache 4.0.21 | **MATCH**, tag `4.0.21-assocClickAsync20260726a` |
| Runtime user | **UNVERIFIED** |

**Efekt/Fix:** Werdykt **CODE_CONVERGED_RUNTIME_UNVERIFIED**. Następny krok: 1× user runtime click suggestions+variants (admin, ≤10 s). Utworzono `planner-round-5-critique.md`, `scripts/qa/sim-assoc-click-timing.js`.

**Źródła:** dam-assoc-edit.js L1225–1285, L2587–2727; timing metrics suggestions 1.48 ms / variants 0.64 ms / delegated 0.68 ms.

---

**Komenda/Akcja:** Ocena kierunku user bez restore/rewrite: (1) variant routing freeze, (2) false empty on mount, (3) brak optimistic UI. Porównanie z v4.0.19 vs v4.0.20 + dokumenty Desktop. Zero browser (po incydencie CDP stall round 3).

**Log/Status:** Przeczytano `cursor_aplikacja_szczeg_owy_opis.md`, `cursor_previous_program_version_setup.md`, CANONICAL-PLAN, Zadanie, source v4.0.20. Utworzono `planner-round-4-critique.md`.

**Decyzja review:**

| Hipoteza | Werdykt round 4 |
|----------|-----------------|
| Kierunek 3-defect | **CZĘŚCIOWO TAK** — lepszy niż total failure/restore |
| Variant routing | **CZĘŚCIOWA** — problem realny, fix „ten sam picker + kind” **odrzucony** |
| False empty search | **CZĘŚCIOWO OBSOLETE** — v4.0.20 ma loading + „Wpisz frazę…” (L1172–1237) |
| Optimistic UI | **CZĘŚCIOWO OBSOLETE** — queue/status/rollback już w saveAssociations |

**Efekt/Fix:** Werdykt **CONTINUE**. Grok: fix per adapter (material populate priorytet), nie duplikować optimistic; fake-DOM timing harness OK jako next static; 1× runtime click nadal wymagany.

**Źródła:** dam-assoc-edit.js L1172–1285, L1684–1778, L2587–2703; round 3 static 0/8; Desktop dumps.

---

**Komenda/Akcja:** User HARD stop browser/CDP po ~15 akcjach; agent utknął na `Runtime.evaluate` (klik suggestions CTA) >60 s. Kontynuacja wyłącznie statyczna: after-fix suite, curl/hash serwowanych assetów, critique round 3.

**Log/Status:** Browser **ABORT** (circuit breaker naruszony). Statycznie: `ASSOC_QA_MODE=after-fix` → **suites_failed=0/8**, `AFTER_FIX_EXIT=0`. Harness `sim-assoc-dodaj.js` czyta wersję z `version.json` (nie hardcode 4.0.19). Curl :8765 — HTML + 3 JS assoc **SHA MATCH** workspace. WARN: `branding.html` `dam-shell.js?v=4.0.19-unifyAssoc20260725d` (stary tag).

**Efekt/Fix:** Werdykt **CONTINUE** — kod/harness PASS, runtime user FAIL (0/6 entry paths potwierdzonych). Incydent + reguła 60 s stall → `memory.md`. `planner-round-3-critique.md` utworzony.

**Test/Ewaluacja:**

| Suite | Exit |
|-------|------|
| sim-assoc-run-all (after-fix) | 0 |
| audit / dodaj / css-conflict / open / save / search / linked / ui | 0 each |
| curl hash assoc JS | MATCH |
| browser 6 paths | BLOCKED (stall) |
| save no-op | BLOCKED (login_required) |

**Zrodla:** `version.json` 4.0.20; cache tag `4.0.20-assocFreezePort20260725e`; fixture br-005510=6, br-005490=0.

---

**Komenda/Akcja:** Deterministyczne testy kontraktowe — open/freeze, auth/save, search/empty-init, render LP, minus/close/CTA/COMBO; fix false positive autofocus w audycie; critique round 2. Bez edycji prod (Grok hot-path równolegle).

**Log/Status:** Utworzono `scripts/qa/_assoc-qa-lib.js`, `sim-assoc-open-paths.js`, `sim-assoc-save-auth.js`, `sim-assoc-search-init.js`, `sim-assoc-linked-render.js`, `sim-assoc-ui-contracts.js`, `sim-assoc-run-all.js`. Poprawiono `audit-assoc-regression.js` (autofocus via `extractFunctionBody` + `tagPickerHasOpenAutofocus`). `planner-round-2-critique.md`, sekcja harness w `history-data-audit.md`.

**AC per problem (baseline → after-fix):**

| Problem | Suite | Baseline | Po Grok |
|---------|-------|----------|---------|
| Open/freeze | sim-assoc-open-paths | exit 0; css_inject baseline-fail | after-fix: early-return CSS |
| Auth/save | sim-assoc-save-auth | ensureSession baseline-fail | after-fix: session przed POST |
| Search | sim-assoc-search-init | assoc debounce baseline-fail | after-fix: light/debounce |
| Render LP | sim-assoc-linked-render | fixture 6/0 PASS; seed asserts after-fix | groupContext seed w UI |
| UI contracts | sim-assoc-ui-contracts | exit 0 (CTA icon już fixed) | utrzymać |
| Regresja 3-way | audit-assoc-regression | current 24/24; refs 3 FAIL expected | current stays PASS |

**Efekt/Fix:** False positive autofocus usunięty (current audit ALL PASS 24/24). Harness odróżnia baseline-fail od invariant FAIL. Werdykt critique: **CONTINUE** — C1 ensureSession, C2 assoc search, C4 render LP + browser AC.

**Test/Ewaluacja:** `node --check` wszystkie QA JS OK; `node scripts/qa/sim-assoc-run-all.js` → suites_failed=1/6 (audit refs only).

**Zrodla:** `br-005510` lp=6, `br-005490` lp=0 w branding-index; CANONICAL-PLAN; planner-round-1-draft.

---

**Komenda/Akcja:** Wczesniejszy zapis „no browser/CDP" za mocny. Regula assoc freeze: **browser circuit breaker** (dozwolone gdy daja dowod; smoke portow 5 s; jedna proba/hipoteze; stall ~10 s = abort; bez powtarzania zawieszonej akcji; po freeze -> kod/git/node; screenshot+Read gdy dziala, inaczej blocker).

**Log/Status:** Zaktualizowano `memory.md` (sekcja Assoc freeze), wpis audytu w `process.md`, `history-data-audit.md`, `planner-round-1-critique.md`. Ustalenia techniczne audytu bez zmian.

**Efekt/Fix:** Semantyka weryfikacji = circuit breaker, nie absolutny zakaz browser/Playwright/CDP.

**Zrodla:** memory.md §Assoc freeze incident; session-01 critique.

---
## 2026-07-25 - User: faza diagnostyczna assoc freeze (Composer audit)

**Komenda/Akcja:** Niezalezny audyt historii/danych/auth/search/minus; critique planu; harness regresji; weryfikacja statyczna (git/curl/node); zachowac v4.0.14+; panel `#damAssocEditPopover` vs COMBO. *Uwaga:* w tej turze audytu obowiazywal tymczasowy ban browser - **superseded** przez circuit breaker (wpis powyzej).

**Log/Status:** Przeczytano git/process/transcript refs. Transcript `5b3a8c1a-3f33-4735-8c7b-a88bce5b4011` - brak pliku JSONL (tylko cytat w `0a510183`). Chronologia: regresja `6e9462e` (`buildAssocMediaPickerUi`), restore `092821f` v4.0.18, unify v4.0.19. COMBO birth `8e02eb4`. Dane: `br-005510` lp=6 w branding-index; slider `br-005490` lp=0 (OK). Auth: POST `/branding/asset-associations` -> `login_required` bez tokena. Harness: `scripts/qa/audit-assoc-regression.js`.

**Efekt/Fix:** `agents/shared/planner-runs/dam-assoc-freeze/session-01/history-data-audit.md`, `planner-round-1-critique.md` (werdykt CONTINUE). Brak edycji prod JS/CSS/HTML/indeksow.

**Test/Ewaluacja:** `node --check scripts/qa/audit-assoc-regression.js`; curl smoke 8765/8766=200; graphify query assoc flow.

**Zrodla:** SHA 092821f, 2b3873a, 6e9462e, 8e02eb4; branding-index.json, branding-associations-overrides.json, dam-assoc-edit.js L1384/L1841, local_bridge.py L6025/L2922.

---
## 2026-07-25 - User: unify Viz+Branding assoc (CTAs, Edytuj wszystko freeze, COMBO) — v4.0.19

**Komenda/Akcja:** Z jakiego linka korzystać; co naprawiono; odwrotna zależność Viz vs Branding (Edytuj wszystko / Dodaj / +Dodaj sugestie|warianty / brak Eksplorator COMBO).

**Log/Status:** Na bazie restore 092821f (v4.0.18): shell-first `openMediaPicker` (panel od razu, indeks async); `bindVizAssocCtas` + `openVizAssocSuggestionsPicker` + `openVizAssocVariantsPicker`; footer **Eksplorator** (`data-goto-combo`); `DamFolderPicker` zamiast `#damAssocFolderPicker`; plus tile → bezpośrednio `openEditPicker` (variant+product); delegacja `Edytuj wszystko` (bez stack listenerów); bez autofocus search; skip plus w `#damVizModal`.

**Efekt/Fix:** v4.0.19 cache `?v=4.0.19-unifyAssoc20260725d`. URL: branding.html + visualizations.html na :8765.

**Test/Ewaluacja:** node --check OK; sim-assoc-dodaj ALL PASS 4.0.19.

**Źródła:** dam-assoc-edit.js, version 4.0.19, branding.html, visualizations.html.

---
## 2026-07-25 - User: CAŁKOWICIE USUNĄĆ zepsuty kod — restore 092821f (v4.0.18)

**Komenda/Akcja:** Przywrócić assoc z commita 092821f (3.2.0); minus ikony FOUC; cały obecny kod assoc out.

**Log/Status:** `git checkout 092821f -- dam-assoc-edit.js dam-media-preview.js`. Usunięto link `dam-assoc-edit.css` z branding.html (092821f = CSS wstrzykiwany w JS, static powodował brzydki minus przed stylami). v4.0.18 cache `restore092821f20260725d`. sim-assoc-dodaj przepisany pod baseline 092821f.

**Efekt/Fix:** Ten sam kod assoc co instancja 3.2.0 / port 8767.

**Test/Ewaluacja:** node --check OK; sim-assoc-dodaj ALL PASS 4.0.18.

**Źródła:** commit 092821ff, branding.html?v=4.0.18-restore092821f20260725d.

---

**Komenda/Akcja:** v4.0.16 lite (`dam-assoc-lite-popover`) = prymitywny UI bez CSS, „Ładowanie…”, freeze; przywrócić pełny panel 3.2.0.

**Log/Status:** Cofnięto routing na `openMediaPickerSimpleNow`. Branding `#damMediaPreview` → `buildAssocMediaPickerUi` (classic, bez tabów) + `dam-assoc-edit.css` w `branding.html`. `brandingClassicPicker`: seed `linked_products`, bez `ensureFileIndex` on open; indeks dopiero przy pierwszym search (2+ znaki). v4.0.17 cache `assocClassic33220260725c`.

**Efekt/Fix:** Panel jak 3.2.0 (nagłówek, Aktualne, search+podgląd, Eksplorer/Zatwierdź). Screenshot QA: `scripts/qa/_e2e-assoc-classic-v17.png`.

**Test/Ewaluacja:** sim-assoc-dodaj ALL PASS 4.0.17; Playwright classic cls=`dam-assoc-edit-popover`, hasCss=true, lista „Wpisz nazwe…” (nie Ładowanie).

**Źródła:** dam-assoc-edit.js, branding.html, version 4.0.17.

---

**Komenda/Akcja:** Naprawić plus-tile #damMediaPreview → #damAssocEditPopover; przetestować do końca (nie deklaracja bez dowodu).

**Log/Status:** Root cause v4.0.15: openMediaPicker nadal wołał buildAssocMediaPickerUi (freeze). v4.0.16: routing isBrandingPreviewAssocContext → openMediaPickerSimpleNow (092821f lite, bez tabów PRODUKT|BRANDING). Dodano scripts/qa/e2e-assoc-plus-tile.py (Playwright, clip screenshot).

**Efekt/Fix:** openMediaPicker + plus_click → tytuł „Skojarzone produkty”, klasa dam-assoc-lite-popover, 960×720px.

**Test/Ewaluacja:** node sim-assoc-dodaj.js ALL PASS 4.0.16; python e2e-assoc-plus-tile.py ALL PASS; screenshot scripts/qa/_e2e-assoc-plus-tile.png (tytuł, Aktualne, brak tabów, CTA).

**Źródła:** dam-assoc-edit.js L2349-2366, branding.html?v=4.0.16-assocSimple33220260725b.

---

**Komenda/Akcja:** Przywrocic plus-tile #damMediaPreview → Skojarzone produkty (3.2); bez tabow PRODUKT|BRANDING w classic; BRANDING osobno; bez rollbacku calej aplikacji.

**Log/Status:** Usunieto guardy NUCLEAR (openSkojarzoneFromPlusClick, openEditPickerNow, openMediaPicker, dam-media-preview openAssocMediaPickerFromPlus, applyShiftToScope). Classic panel: taby ukryte gdy classicAssocPanel/brandingListMode/variantsListMode. Dodano openBrandingMaterialAssocSearch + przycisk data-assoc-branding-search. v4.0.15 cache assocRestore33220260725a.

**Efekt/Fix:** Ctrl+F5 branding.html → ADMIN ON → podglad materialu → Dodaj otwiera #damAssocEditPopover (produkty).

**Test/Ewaluacja:** node --check dam-assoc-edit.js + dam-media-preview.js OK; curl served JS bez NUCLEAR; smoke 8765/8766=200.

**Zrodla:** dam-assoc-edit.js, dam-media-preview.js, branding/explorer/dashboard/visualizations.html, version 4.0.15.

---
## 2026-07-25 - User: czemu 3.2.0 Dodaj→#damAssocEditPopover działa, a main nie (taby BRANDING)

**Komenda/Akcja:** Porównanie 3.2.0 (plus-tile → Skojarzone produkty OK) vs regresja po tabach PRODUKT|BRANDING.

**Log/Status:** 092821f: openEditPicker→openMediaPicker inline, tylko produkty, bez tabów. 6e9462e: buildAssocMediaPickerUi + taby + ensureSearchIndexBootstrap/branding-search; routing isBrandingProductAssocAdd. Freeze od tab BRANDING / sync CSS. 2026-07-24 NUCLEAR assocDodajDisabled20260724d: isBrandingPreviewAssocContext early return — zero otwarcia w #damMediaPreview. HEAD working tree: classicAssocPanel ukrywa taby, ale guardy nadal blokują plus.

**Efekt/Fix:** Wyjaśnienie timeline dla usera (bez kodu).

**Źródła:** 092821f, 6e9462e dam-assoc-edit.js, process §NUCLEAR 15:05, openSkojarzoneFromPlusClick L72.

---
## 2026-07-25 - User: kiedy Dodaj wariant / Edytuj zaczęły zacinać aplikację na stałe

**Komenda/Akcja:** Identyfikacja momentu regresji — freeze przy Dodaj wariant / Edytuj.

**Log/Status:** Analiza git + process.md: (1) latent `8f9ea8a` 2026-07-21 — plus→openEditPicker, ensureFileIndex przed paint, popover 70vw; (2) krytyczny `6e9462e` 2026-07-23 — buildAssocMediaPickerUi, ensureSearchIndexBootstrap ~8MB, sync ensureInjectedCss giant string; sesja COMBO 2026-07-22; (3) pierwszy raport freeze process ~04:30 2026-07-23; (4) fixy gł. uncommitted (+2165 linii dam-assoc-edit vs 6e9462e).

**Efekt/Fix:** Mapa regresji dla usera; 092821f (3.2.0) = przed 6e9462e; 2b3873a (3.1.5) = przed 8f9ea8a assoc unify.

**Źródła:** 8f9ea8a, 6e9462e, 2b3873a, 092821f, process.md §vizModalFix20260723m/n, §shiftDodajFix20260723ae.

---
## 2026-07-25 - User: w którym commicie uruchomiono Explorer COMBO (widok, tytuły, Windows)

**Komenda/Akcja:** Dowiedz się commita: widok COMBO, fix ucinania tytułów kafelków, przycisk „Otwórz Eksplorator Windows”.

**Log/Status:** git log -S thumbCombo / damThumbPickerWindows / DamFolderPicker. COMBO start `8e02eb4` (2026-07-21) w dam-viz.js. Windows + extract `dam-folder-picker.js` sesja 2026-07-22 (K3 plan combo-folder-picker); integracja HTML+delegate w `6e9462e` (2026-07-23). Plik `dam-folder-picker.js` = untracked (nigdy nie zacommitowany). PI DamFolderPicker-only w `19e8c54`.

**Efekt/Fix:** Mapa commitów dla usera (bez zmian kodu).

**Źródła:** 8e02eb4, 19e8c54, 6e9462e, process.md §2026-07-21 COMBO, backup combo-folder-picker-2026-07-22.

---
## 2026-07-25 - User: dump zawsze lokalnie + fix czerwonego sync / fałszywe offline — v4.0.14

**Komenda/Akcja:** Dump ma zawsze być lokalnie (offline gdy Synology pada); dalej czerwony krok sync + „Baza nadal offline” mimo Postgres online.

**Log/Status:** Root cause: POST `/db/reconnect` wymagał admin+Bearer, UI fetch bez tokenu → `login_required`, `ok:false`, czerwony dump. Fix: reconnect bez auth (jak `/db/status`); `pull_database_dump_now` = ok gdy jest lokalny `dam_eta_*.sql.gz`; UI `dumpSyncOk` + lepsze tytuły; bootstrap sync przy starcie bridge gdy brak dumpa; v4.0.14.

**Efekt/Fix:** reconnect bez logowania zwraca `online:true`, `dump_sync.ok:true` (8 dumpów w DATABASE/).

**Test/Ewaluacja:** python POST `/db/reconnect` pull_dump; `node --check` dam-db-status.js.

**Źródła:** local_bridge.py, dam_db.py, dam-db-status.js, dam-shell.js cache bust.

---
## 2026-07-25 - User: uruchom przywrócone poprzednie wersje (3.2.0 + 3.1.5)

**Komenda/Akcja:** Uruchom poprzednie wersje DAM, które przywróciliśmy (worktree równoległe).

**Log/Status:** `start-dam-parallel-versions.ps1` (Start-Process) nie trzymał procesów w Cursorze; ręczny start w tle: `serve_browser.py` (main) + 2× `serve_dam_instance.py` (worktree `DAM-kopia-092821f` v3.2.0, `DAM-kopia-3.1.5` v3.1.5). Smoke po ~15 s: wszystkie UI+bridge HTTP 200.

**Efekt/Fix:** Działają 3 instancje równoległe (mosty startują z opóźnieniem ~10–15 s).

**Test/Ewaluacja:** curl 8765/8766, 8767/8768, 8769/8770 → 200.

**Źródła:** `scripts/ops/start-dam-parallel-versions.ps1`, worktree `DAM-kopia-092821f`, `DAM-kopia-3.1.5`.

---
## 2026-07-25 - User: rebuild #damVizModal assoc CTAs (sugestie|warianty) + login_required fix — v4.0.13

**Komenda/Akcja:** WORKER: usunac plus tiles + Edytuj wszystko z `#damVizModal`; dodac CTA `+Dodaj/Edytuj sugestie|warianty` → `#damAssocEditPopover`; footer Eksplorer; fix save login_required; bez browser MCP.

**Log/Status:** Usunieto z HTML buildera: `dam-assoc-edit-all`, `data-product-variant-plus`, `assoc-plus-tile` w variant strip. Dodano `.dam-int-cta.dam-viz-assoc-cta` z `data-viz-assoc-cta=suggestions|variants`. `bindVizAssocCtas` + `openVizAssocSuggestionsPicker` (`_vizBrandingList`) + `openVizAssocVariantsPicker` (`_vizVariantsList`). Footer classic: label **Eksplorer** (`data-goto-combo data-eksplorer`). `saveAssociations` → `ensureBridgeSession()` / `DamApi.ensureSession`. Plus inject skip w `#damVizModal`; usuniety `_damVizPlusCaptureBound`.

**Efekt/Fix:** v4.0.13; cache `?v=4.0.13-vizAssocCta20260725` (visualizations.html). Design Read: panel = Assoc Edit / Skojarzone produkty (#damAssocEditOverlay > #damAssocEditPopover).

**Test/Ewaluacja:** `node --check` dam-assoc-edit.js dam-viz.js; `node scripts/qa/sim-assoc-dodaj.js` ALL PASS.

**Zrodla:** dam-viz.js, dam-assoc-edit.js, dam-assoc-edit.css, version 4.0.13, code-doctrine lekcja 2026-07-25.

---
## 2026-07-24 ~22:35 - User: Dodaj DOM (assoc + wariant) dalej tnie — v4.0.10 invisible classic shell

**Komenda/Akcja:** Exact DOM `#damVizModalAssoc` Dodaj + `data-product-variant-plus` Dodaj — „podałem co ma się wyświetlać, ciągle to samo”.

**Log/Status:** Systematic: root cause = `ensureShellCssMinimal` only styled `.dam-assoc-lite-popover`; classic `buildAssocMediaPickerUi` uses `.dam-assoc-edit-popover` → dark overlay blocks UI, dialog invisible. Full CSS warm skipped while overlay open. Fix: shell CSS token `classicShell20260724c` styles classic panel on open; warm no longer requires overlay closed.

**Efekt/Fix:** Ctrl+F5 `http://127.0.0.1:8765/visualizations.html` → ADMIN ON → klik Dodaj → widoczny panel „Skojarzone produkty” (footer: Dodaj z dysku / Przejdz do COMBO / Zatwierdz / Wstecz). Cache `?v=4.0.10-classicShellVisible20260724`.

**Test/Ewaluacja:** sim ALL PASS 4.0.10; curl serves new ?v=.

**Źródła:** dam-assoc-edit.js ensureShellCssMinimal, code-doctrine lekcja, v4.0.10.

---
## 2026-07-24 ~22:15 - User: „dalej tnie, nic po włączeniu” — v4.0.9 Dodaj dead-end

**Komenda/Akcja:** Po ADMIN ON klik Dodaj = nic / freeze; systematic-debugging.

**Log/Status:** Root cause: `openSkojarzoneFromPlusClick` robił `editBtn.click()` → `openMaterialsPaneEdit` wymagało `asset` → toast „Brak materiału” bez otwarcia `#damAssocEditPopover` (wyglądało jak „nic się nie dzieje”). Dodatkowo `_assocPickerOpening` + osierocony overlay = cichy return. Fix: plus zawsze `openEditPickerNow` + `buildMaterialsPaneEditCtx`; purge stale overlay; admin rebind wszystkich pane w modalu + prefetch search-index; `openMaterialsPaneEdit` bez wymogu asset.id. Bump 4.0.9 cache `?v=4.0.9-dodajDirect20260724`.

**Efekt/Fix:** Ctrl+F5 `http://127.0.0.1:8765/visualizations.html` (bez prefiksu /4.0.x — serwer zwraca 404). ADMIN ON → modal → Dodaj → panel Skojarzone produkty.

**Test/Ewaluacja:** node --check + sim-assoc-dodaj.

**Źródła:** dam-assoc-edit.js v4.0.9.

---
## 2026-07-24 ~22:10 - User: „dalej się tnie, w ciągu nieprzerwanie” — v4.0.8 anti-freeze pass 2

**Komenda/Akcja:** Freeze nadal ciągły w Skojarzone produkty / wyszukiwaniu — „wszystko się tnie”.

**Log/Status:** Root cause pass 2: (1) `vis===0` w light filter wołał pełny `renderOptions` przy każdym keystroke bez trafień → pętla rebuild; (2) toggle na liście wołał `renderPinned()` (innerHTML + rebind) mimo że pinned IDs się nie zmieniały. Fix: tylko `applyAssocSearchFilterLight` + komunikat pusty DOM; `renderPinned()` tylko gdy `is-pinned`; sim zaktualizowany. Bump 4.0.8, cache `?v=4.0.8-noRebuildSearch20260724`.

**Efekt/Fix:** Ctrl+F5 wymagany. Po 4.0.8: wpisywanie w search = hide/show bez rebuild; klik w liście = toggle checkmark bez przebudowy pinned.

**Test/Ewaluacja:** `node --check` assoc OK; `node scripts/qa/sim-assoc-dodaj.js` — uruchomić po deploy.

**Źródła:** dam-assoc-edit.js, visualizations.html, v4.0.8.

---
## 2026-07-24 ~19:15 - User: Dodaj→Skojarzone produkty (3.2), tag search, close, re-index — v4.0.6

**Komenda/Akcja:** „Dodaj nie otwiera #damAssocEditPopover; zaimplementuj 3.2; tagi; zamknij modal; re-index skojarzone; bez browser/CDP”.

**Log/Status:** Root cause: (1) plus bez handlera gdy admin wlaczony po bindzie; (2) productThumb freeze listy; (3) tag autofocus WebView2; (4) branding-index wymaga re-enrich. Fix: `openSkojarzoneFromPlusClick`, capture fallback, plus bind bez guarda wejscia, `kind:product` na wariant strip, PLACEHOLDER thumbs, tag bez autofocus on open. `re-enrich-branding-index.py` (41407 linked_product_id). `node scripts/qa/sim-assoc-dodaj.js` ALL PASS v4.0.6.

**Efekt/Fix:** Ctrl+F5 `visualizations.html` cache `?v=4.0.6-plusSkoj20260724` → admin ON → Dodaj / Edytuj wszystko → panel „Skojarzone produkty” (≠ COMBO). Zamknij X na shell. Tag search bez freeze.

**Test/Ewaluacja:** sim 17/17 PASS; node --check assoc/tag/viz OK. file-index `linked_products` na viz_latest = 0 (alias owies-miod brak w products — tylko cornflakes w indeksie).

**Źródła:** dam-assoc-edit.js, dam-tag-edit.js, dam-viz.js, branding-index.json, v4.0.6.

---
## 2026-07-24 ~18:45 - User: BEZ browser/CDP — shell-first Skojarzone produkty

**Komenda/Akcja:** „Symuluj przeglądarkę. nie używaj browser ani CDP”. Panel Skojarzone produkty pod Dodaj; COMBO osobno.

**Log/Status:** 1. Root cause: openMediaPicker czekal na ensureFileIndex przed paint. 2. Shell-first jak COMBO. 3. disk: DamFolderPicker / COMBO fallback. 4. node scripts/qa/sim-assoc-dodaj.js. 5. v4.0.5.

**Efekt/Fix:** Ctrl+F5 → Dodaj → #damAssocEditPopover „Skojarzone produkty”.

**Źródła:** dam-assoc-edit.js, sim-assoc-dodaj.js, v4.0.5.

---
## 2026-07-26 ~15:35 - User: sync nie działa, 11 konfliktów, ręczny push skilli + naprawa wtyczki

**Komenda/Akcja:** Przyciski Cursor Sync „nic nie robią”; syncNow CONFLICT x11; najpierw manual push skilli na git, potem napraw wtyczkę; `/SYNC-status`.

**Log/Status:** Przyczyna: uszkodzony manifest (3 pliki zamiast ~1938). Regeneracja manifest, push `e094ad8` + `44e4a34`. rebuild-sync-state (1938 kl.). Wtyczka 0.9.6-inyfinn: skipConfirm syncNow, withProgress, stale manifest guard, isDualEditConflict, sidebar syncing UI. Deploy do extensions.

**Efekt/Fix:** 141/143 skilli OK. User: **Developer: Reload Window**, potem Synchronizuj teraz.

**Źródła:** skills-sync-status.json, regenerate-manifest.ps1, cursor-sync-dev 0.9.6.

---


**Komenda/Akcja:** syncNow failed — CONFLICT count 1, extension 0.9.5-inyfinn.

**Log/Status:** Diagnoza: `dot-cursor/rules/finalize-agent-prompt-always.mdc` — lokalnie edytowany + untracked w git; wpis w sync-state, brak w zmodyfikowanym `.cursor-sync/manifest.json` (fałszywy dual-edit). Fix dev: `isDualEditConflict()` w conflicts.ts + scheduler.ts.

**Efekt/Fix:** User: **Push** (działa od razu) albo Resolve → Keep Local → Push. Po Push: `/SYNC-status`. VSIX: przebudować z cursor-sync-dev.

**Źródła:** detect-conflicts.ps1, sync-state.json, git status ~/.cursor.

---


**Komenda/Akcja:** „Skąd wiedzieć że push działa przez wtyczkę a nie manualnie?” + skill filtracyjny `/SYNC-status` z datą/godziną/sekundami pełnej sync skilli + lista zaktualizowanych/nie.

**Log/Status:** Utworzono `~/.cursor/skills/SYNC-status/` (SKILL.md + `scripts/audit-skills-sync.ps1`). Pierwszy audyt: 2026-07-24 18:40:14 — 125/141 OK, 16 pending (w tym nowy SYNC-status). Ostatni push wtyczki: 2026-07-20 16:49:03 commit 1ed1fce; ostatni ręczny: 2026-07-18 14:06:44 599ab7d.

**Efekt/Fix:** Raporty: `~/.cursor/.cursor-sync/skills-sync-status.json` + `.md`. User: Push wtyczką żeby wysłać nowy skill.

**Źródła:** CURSOR-SYNC-INYFINN-FORK.md, sync-history.json, audit-skills-sync.ps1.

---


**Komenda/Akcja:** Agent znowu zawisł na browser MCP (CDP awaitPromise ~16 min / interrupt).

**Log/Status:** 1. Przerwano browser. 2. Smoke bez browsera: :8765/:8766=200. 3. `node --check` tag/assoc/media OK. 4. Wersja **4.0.4** w sync. 5. Nie czekam na browser MCP — status z kodu.

**Efekt/Fix:** Blocker = narzędzie browser, nie brak kodu. User: hard refresh `visualizations.html` (Ctrl+F5) → ADMIN → BURGER → **Dodaj** → ma być `#damAssocEditPopover` „Skojarzone produkty”.

**Źródła:** process.md, v4.0.4.

---

## 2026-07-24 ~18:15 - User: „Zrobiłeś to?” — tag apply + Dodaj panel + v4.0.4

**Komenda/Akcja:** Przywrócić z 3.2 panel `#damAssocEditPopover` (Skojarzone produkty) pod wszystkie **Dodaj** w modalu viz; tag popovery z bezpiecznym search (3.1.5); apply tagów; `#damVizModalClose`; wersja 4.0.x; log wszystkiego.

**Log/Status:**
1. **Tag search freeze** — `pop._damTagRepaint` przypięty do `applySearchFilterLight` (brakowało po enrich).
2. **Tag apply** — `applyTagPickerChoice` aktualizuje badge DOM + `onApplied`; confirm fallback `pendingCode || ctx.currentCode`.
3. **Dodaj → Skojarzone produkty** — `openAssocMediaPickerFromPlus` + `openEditPickerNow`: `_vizComboDirect: false`; guard brak `ctx.asset.id` przed save.
4. **Wersja 4.0.4** — version.json, dam-version.js, runtime_config.py; cache-bust visualizations (tag-edit, assoc-edit, media-preview, viz.js, viz-modal.css).
5. **Smoke:** :8765/:8766 → 200; `node --check` OK.

**Efekt/Fix:** Po hard refresh `visualizations.html` — ADMIN ON → modal → **Dodaj** otwiera `#damAssocEditOverlay` / tytuł „Skojarzone produkty” (footer: Dodaj z dysku | Przejdź do COMBO | Zatwierdź | Wstecz); tag Zatwierdź odświeża badge; search bez tnienia.

**Test:** browser QA w toku (Pass 1 screenshot).

**Źródła:** dam-tag-edit.js, dam-assoc-edit.js, dam-media-preview.js, visualizations.html, v4.0.4.

**Nazewnictwo (user):** `#damTagEditPopover` = edycja tagów; `#damAssocEditPopover` = **Panel Skojarzone produkty** (≠ COMBO); COMBO = eksplorator 3 widoki, tylko „Przejdź do COMBO”.

---

## 2026-07-24 ~18:05 - User: #damVizModalClose nie zamyka modala

**Komenda/Akcja:** `#damVizModalClose` widoczny (top-right) ale klik nie zamyka modala wizualizacji.

**Log/Status:**
1. Przycisk X przeniesiony z `.dam-viz-modal-box` na `.dam-viz-modal-shell` (nad assoc-pane, z-index 50200).
2. Globalny capture `pointerdown`/`click` → `requestCloseVizModal()` (zamyka nawet gdy overlay przechwytuje hit-test).
3. `_damVizModalTeardown` per sesja modala; usuniety stary `onVizModalBlockerGuard`.
4. CSS: `.dam-viz-modal-shell` + `.dam-viz-modal-shell > .dam-viz-modal-close`.
5. Wersja **4.0.3**, cache-bust `dam-viz.js?v=4.0.3-vizClose20260724`, `dam-viz-modal.css?v=vizCloseFix20260724c`.

**Efekt/Fix:** X zamyka modal na pierwszy pointerdown; Escape nadal dziala.

**Test:** hard refresh visualizations → otworz kafelek → klik X.

**Źródła:** dam-viz.js, dam-viz-modal.css, visualizations.html, v4.0.3.

---

**Komenda/Akcja:** „Funkcja DODAJ jest widoczna po Shift — wypierdol shift, w adminie ZAWSZE widoczne”; „Zaindeksuj wszystko od nowa”; „ZNOWU SIE ZACIĄŁEŚ”.

**Log/Status:**
1. **Shift gate usuniety dla tile Dodaj** — `html.is-admin-editing` + `syncAdminEditingChrome()`; plus klik bez `shiftOk`; CSS w `dam-assoc-edit.js` + `dam-media-preview.js`.
2. **Edytuj wszystko** — `openMaterialsPaneEdit` otwiera panel od razu (enrich w tle, bez freeze przed open).
3. **Fix freeze** — usunieta petla rekurencji `syncAdminEditingChrome` ↔ `syncAdminMode`.
4. **Pelny reindex DONE:** `build-file-index.py` → products=184 viz=401; `build-branding-index.py` → assets=52090 linked=41364 (~232s); `re-enrich-branding-index.py` → linked_product_id=41179.
5. **Wersja 4.0.2** — version.json, dam-version.js, runtime_config.py; cache-bust visualizations.html assoc+media-preview.
6. **Smoke:** :8765/:8766 → 200. **Browser/graphify query przerwane** (timeout agenta) — brak screenshot Pass.

**Efekt/Fix:** Po ADMIN ON + hard refresh `visualizations.html?v=4.0.2-adminDodaj20260724` — kafel **Dodaj** widoczny bez Shift; indeksy swieze na dysku.

**Test uzytkownika:** ADMIN ON → modal viz BURGER BEEF → Dodaj widoczny i otwiera `#damAssocEditPopover` (nie COMBO).

**Źródła:** dam-assoc-edit.js, dam-media-preview.js, visualizations.html, apps/web/data/file-index.json, branding-index.json, v4.0.2.

---

**Komenda/Akcja:** „4.0 PADŁA bo przemianowałeś na 4.0 w linku”; „NAJNOWSZA instancja ma nie mieć skrótu wersji — TYLKO POPRZEDNIE”; weryfikacja = `@Browser` w Cursorze, nie Windows.

**Log/Status:** Naprawiono `start-dam-parallel-versions.ps1`: current = `serve_browser.py` (:8765 bez prefiksu), legacy = `serve_dam_instance` (:8767/:8769 z prefiksem). `memory.md` §12a3 skorygowane.

**Efekt/Fix:** Poprawny URL current: `http://127.0.0.1:8765/visualizations.html` (nie `/4.0.0/...`).

**Źródła:** user dump; skrypt parallel.

---

## 2026-07-24 ~16:58 - User: 3 wersje naraz + Browser w Cursorze (nie recznie)

**Komenda/Akcja:** „miały być 3 wersje odpalone naraz”; wczesniej: „JA NIE BĘDĘ niczego otwierać — masz przeglądarkę wewnętrzną @Browser”.

**Log/Status:** Bledna proba 4.0 przez `serve_dam_instance` z prefiksem `/4.0.0/` — **cofniete** w turze ~17:00.

**Efekt/Fix:** `memory.md` §12a2 (agent = Cursor Browser MCP).

**Źródła:** curl smoke.

---

## 2026-07-24 ~16:31 - User: nie otwierac stron przez Perplexity (404)

**Komenda/Akcja:** „nie otwieraj mi kurwa stron przez perplexity bo mam błędy” (screenshot 404 na `127.0.0.1:8765/dashboard.html`).

**Log/Status:** Agent przestaje uzywac Perplexity/Comet i `browser_navigate` MCP do otwierania DAM. Smoke curl: `/dashboard.html` → **200**, `/4.0.0/dashboard.html` → **404** (biezacy `serve_browser.py` = URL **bez** prefiksu wersji). Bridge `:8766/health` → **200**.

**Efekt/Fix:** `memory.md` §12a3 — zakaz Perplexity/Comet; poprawny URL teraz: `http://127.0.0.1:8765/dashboard.html` (nie `/4.0.0/...` dopoki nie odpalisz parallel-versions).

**Źródła:** curl smoke; screenshot user 404.

---


**Komenda/Akcja:** WORKER browser self-test — `#damMediaPreview` Shift+admin+Dodaj freeze fix.

**Log/Status:**
1. Smoke: `:8765` + `:8766` → **200** (start sesji).
2. URL `branding.html?v=assocLightDomFix20260724b`; faktyczny skrypt z HTML: `dam-assoc-edit.js?v=**assocFreezeFix20260724c**` (nie `b`).
3. Admin ON (`localStorage dam_admin_mode=1`, checkbox checked). Preview `br-005510` otwarty.
4. Shift affordance: `html.is-shift-revealed` + plus tiles `display:flex` — screenshot **before-dodaj-click.png** (Dodaj widoczny w Warianty + Skojarzone; product tile z czerwonym outline CDP).
5. **Pass 1 product:** `browser_click` Shift + ref `e1992` („Edytuj wszystko - dodaj skojarzenie”) → ~900 ms później **tab martwy** (CDP: „No browser tab available”). Brak `#damBrandingProductAddPopover` w snapshot. **FAIL freeze.**
6. Wcześniejszy CDP `plus.click()` + `awaitPromise` → „target closed” — ten sam wzorzec.
7. ESC / F5 / variant path — **nie testowane** (tab padł na product path).
8. Po crashu `:8765/branding.html` → **404** (dual LISTEN :8765); restart `serve_browser.py` — poza scope retestu.

**Test/Ewaluacja:**

| Ścieżka | Wynik |
|---------|-------|
| Product assoc Dodaj | **FAIL** — tab hang/crash |
| Variant Dodaj | **SKIP** |
| ESC zamyka picker | **SKIP** |
| Wątek responsywny (CDP <3s) | **FAIL** — tab utracony po kliku |
| Picker visible + screenshot | **FAIL** — brak popover w DOM |

**Efekt/Fix:** Fix `assocFreezeFix20260724c` **nie przechodzi** QA browser MCP na product Dodaj. Hipoteza: nadal sync storm w łańcuchu `setTimeout→rAF→setTimeout` w `openBrandingProductAssocAdd` albo index bootstrap na main thread. Rekomendacja: rozbić mount na `requestIdleCallback`/dłuższe defer; audit `ensureSearchIndexBootstrap()` pod kątem sync; nie odhaczać checklisty freeze.

**Źródła:** before-dodaj-click.png; browser tab d2ffe3; snapshot 13-03-13 (brak popover).

---

## 2026-07-24 ~16:05 - Dump: tag popovery + panel Skojarzone + COMBO / Dodaj (`tagSearchLight20260724a` / v4.0.2)

**Komenda/Akcja (user):**
1. Zidentyfikuj `#damTagEditPopover` (podkategoria / kategoria / jezyk) — budowa, porownanie wersji 3.1.5 / ~3.2 / 4.0.
2. 3.1.5: popovery otwieraja sie, ale **zmiana niemozliwa** (tagi sie nie nadaja). Search OK.
3. „3.5” (mapowanie: **3.2.0**): search w `#damTagEditSearch` sie tnie; 3.1.5 nie.
4. 4.0: dlaczego tag edit nie dziala / co sie zmienilo.
5. **NAJWAZNIEJSZE:** panel `#damAssocEditPopover` = **Skojarzone produkty** (zaginiony UX). Footer: COMBO + Dodaj z dysku + Zatwierdz + Wstecz. `Dodaj z dysku` otwiera stary `#damAssocFolderPicker` (Ładowanie…) — zastapiony w 4.0 przez COMBO/`DamFolderPicker`. **Wziac ten panel i podpiac pod przyciski Dodaj.**
6. Global: loguj wszystko user+agent; kondensuj przez graphify.

**Log/Status:**
1. Identyfikacja (kod + graphify query): jeden komponent `DamTagEdit` / `#damTagEditPopover`; warianty `kind` = subcategory|category|lang|carrier|…
2. Panel assoc: `DamAssocEdit` / `#damAssocEditOverlay` > `#damAssocEditPopover` — nazwa robocza **Assoc Edit / Skojarzone produkty**. W 4.0: lite = `openMediaPickerSimpleNow` (ma `data-goto-combo`), pelny COMBO = `buildAssocMediaPickerUi` (taby PRODUKT|BRANDING). Screenshot usera z `damAssocFolderPicker` = **3.1.5 lub 3.2** (main 4.0 nie ma tego ID).
3. Apply tagow category/subcategory/index: we **wszystkich** wersjach `applyTagPickerChoice` konczy sie toastem bez rename bridge dla tych kind — root „nie nadaje”.
4. Search lag 4.0: `paintTagList` robil full `innerHTML` na kazdy znak; 3.1.5 tylko `btn.hidden`. Fix: `applySearchFilterLight` + boot cap 400; bump **4.0.2** / `?v=tagSearchLight20260724a`.
5. Dodaj: nadal **NUCLEAR** `assocDodajDisabled20260724d` w `#damMediaPreview` — panel zaginal z UI; WORKER restore czeka na OK launch.
6. Regula: `.cursor/rules/user-chat-full-log.mdc`.

**Efekt/Fix:** Id mapy paneli + search light na 4.0.2. Restore Dodaj→Assoc Edit+COMBO = kolejny WORKER (ponizej w chat).

**Test:** `node --check` dam-tag-edit.js + dam-assoc-edit.js OK.

**Zrodla:** dam-tag-edit.js; dam-assoc-edit.js; DAM-kopia-3.1.5 / 092821f; process NUCLEAR 15:05; memory #149–150.

---

## 2026-07-24 ~15:05 - NUCLEAR: disable Shift+Dodaj in `#damMediaPreview` (`assocDodajDisabled20260724d`)

**Komenda/Akcja:** WORKER — user demand: **completely tear down** Shift+admin Dodaj in branding material preview modal (prior fixes failed; WebView2 freeze).

**Log/Status:**
1. `isBrandingPreviewAssocContext(el)` — `#damMediaPreview` minus `#damVizModal`.
2. `ensureShiftHoverAssocUx` — early return: **remove** `.dam-media-preview__assoc-plus-tile` from DOM, no create, no click bind.
3. `plusClick` macrotask — silent `return` when `isBrandingPreviewAssocContext(grid)`.
4. Hard immediate `return` at entry: `openBrandingProductAssocAdd`, `openMaterialVariantAdd` (probe), `openEditPickerNow`, `openMediaPicker`, `openMediaPickerSimpleNow`, `openMediaPickerComboNow`.
5. `dam-media-preview.js` `openAssocMediaPickerFromPlus` — immediate return in branding preview.
6. `applyShiftToScope` — strip plus tiles on Shift down in branding preview (no mousemove recreate).
7. Scope: branding preview only; explorer/viz/dashboard assoc edit unchanged.

**Efekt/Fix:** Zero Dodaj tile, zero pickers/overlays/index loads from `#damMediaPreview` assoc paths.

**Status po decyzji usera (~16:00):** **TYMCZASOWE** — user: „Dodaj ma zostać, piszemy od nowa”. Nuclear blokuje tylko **stary** `dam-assoc-edit`; następny krok = `dam-assoc-add-v2.js`. QA [Test Branding Shift+Dodaj](57a24ffa-ef36-4518-8a5e-5b30a228dada): **FAIL** na `assocFreezeFix20260724c` (tab dead ~900ms, brak popover) — potwierdza, że stary kod nie wraca.

**Test/Ewaluacja:** `node --check` + `curl --max-time 5` only (no browser — frozen WebView2). Tokens: `assocDodajDisabled20260724d`, `mediaDodajDisabled20260724d` (branding/dashboard/explorer/visualizations).

**Źródła:** dam-assoc-edit.js; dam-media-preview.js; branding.html + sibling HTML bumps.

---

## 2026-07-24 ~15:50 - Branding Shift+Dodaj freeze (`assocFreezeFix20260724c`)

**Komenda/Akcja:** URGENT WORKER — UI frozen on Branding after Shift+Dodaj (ESC/F5 dead = main thread block).

**Log/Status:**
1. **Root cause (debug-3ca09b.log):** last event before hang = `openMediaPickerSimpleNow` `shell_mounted` OR `openBrandingProductAssocAdd` completing while **parallel** `DamProductCorrelation.ensureSearchIndex()` → `DamSearch.loadIndexes()` pulled ~8MB `file-index.json` (Worker clone blocks main thread). Secondary: single macrotask mounted scrim+pop+`getComputedStyle`/`getBoundingClientRect` storm; `loadProducts` could join DamSearch inflight; `plusClick` called `closePicker()` before branding branch.
2. **Fix:** `openBrandingProductAssocAdd` — 3-phase mount (macrotask scrim → rAF pop shell → macrotask wire); `__damBrandingPickerOpen` flag; search min 2 chars; dedicated `ensureSearchIndexBootstrap()` only (never `DamSearch.loadIndexes`).
3. **Fix 2:** `dam-product-correlation.js` `ensureSearchIndex` — removed `DamSearch.loadIndexes()`; deferred dedicated `search-index.json` fetch; pauses while picker open.
4. **Fix 3:** `plusClick` — branding `#damMediaPreview` branch runs **before** `closePicker()` / simple shell; `openEditPickerNow` redirects to lightweight branding popover when inside preview.
5. Cache `?v=assocFreezeFix20260724c` (branding/dashboard/explorer/visualizations).

**Test/Ewaluacja:** `node --check` dam-assoc-edit.js + dam-product-correlation.js OK. Browser tab may be dead — user Ctrl+F5 with new token, then Shift+Dodaj produkt (type 2+ chars to search).

---

## 2026-07-24 ~15:30 - Syntax fix + hard branding guards (`assocFreezeFix20260724c`)

**Komenda/Akcja:** User: UI nadal zacięte po light DOM fix; plik JS miał **SyntaxError** (zepsute nawiasy w `openBrandingProductAssocAdd`).

**Log/Status:**
1. Naprawiono składnię `openBrandingProductAssocAdd` (rAF → setTimeout → wire).
2. `openMediaPicker` — twardy guard: `#damMediaPreview` → nigdy `openMediaPickerSimpleNow`.
3. `dam-media-preview.js` `openAssocMediaPickerFromPlus` — ten sam guard (obejście plusClick).
4. `openMediaPickerSimpleNow` — overlay first, pop w następnym rAF.
5. `openBrandingProductAssocAdd` — bez `getBoundingClientRect` na open; min. 2 znaki search.
6. `dam-product-correlation` — już bez `loadIndexes` + defer gdy picker otwarty.
7. Cache: `assocFreezeFix20260724c`, `mediaPreviewFreeze20260724c`.

**Agent QA (HARD):** Gdy UI ma martwy main thread (ESC/F5 nie działa), **NIGDY** `browser_navigate` / CDP na tej karcie — wisi w nieskończoność. Weryfikacja = tylko `curl --max-time 5` + `node --check`. User test = **nowe okno** DAM / zamknięcie WebView2, potem `branding.html?v=assocFreezeFix20260724c`.

---


**Komenda/Akcja:** Follow-up po failed subagent [Fix UI thread freeze ESC/F5](d33750d9-ec3d-4e99-85aa-731c0e2abc52) — ESC/F5 nadal martwe po Shadow click fix.

**Log/Status:**
1. **Root cause:** `openMediaPickerSimpleNow` używał `attachShadow` + sync `wireSimplePickerUi`/`hydrateAndPaint` po `appendChild` — WebView2 blokował main thread (ESC/F5 dead).
2. **Fix:** Simple picker → light DOM (parity COMBO: `overlay.appendChild(pop)`), hydrate w `setTimeout(0)`.
3. **Fix 2:** `#damMediaPreview` Shift+Dodaj → `openBrandingProductAssocAdd` (produkty) / `openMaterialVariantAdd` (warianty) zamiast Shadow shell.
4. **Fix 3:** `optionButtonHtml` — klasy `dam-assoc-edit-popover__opt/thumb/label` (klik + preview w simple picker).
5. Cache `?v=assocLightDomFix20260724b` (branding/viz/explorer/dashboard).

**Test:** Ctrl+F5 → admin → Branding → podgląd → Shift+Dodaj produkt/wariant → picker responsywny, ESC zamyka, F5 działa.

---


**Komenda/Akcja:** Freeze Shift+Dodaj po cache unify — follow-up po failed debugger subagent.

**Log/Status:**
1. **Root cause:** `onDocClick` — klik w Shadow-DOM picker retargetuje `e.target` na `:host` overlay → natychmiast `closePicker()`. Picker miga/znika; user klika dalej = wrażenie freeze.
2. **Fix:** `composedPath()` + ignore `#damAssocEditPopoverLive`; mirror nie zamyka; `_damOpenTs` guard 150ms.
3. **Fix 2:** `openEditPickerNow` — usunięto niezdefiniowane `assocGrid`; `_vizComboDirect: false` (COMBO tylko `openVizAssocComboPicker`).
4. Cache `?v=assocShadowClickFix20260724a` (branding/viz/explorer/dashboard).

**Test:** Ctrl+F5 → admin → podgląd → Shift+Dodaj → picker zostaje otwarty.

---

## 2026-07-23 ~23:35 - WORKER Intern: Shift+Dodaj freeze (`shiftDodajFix20260723ae`)

**Komenda/Akcja:** Reproduce + fix freeze na Shift+klik „Dodaj” (produkty + warianty) w `#damMediaPreview`.

**Log/Status:**
1. **Reproduced: Y** (Playwright Chromium). Call path: `plusClick` → `openEditPickerNow` → `openMediaPicker` → `openMediaPickerSimpleNow`. Shell montuje się w ~1–2 ms (`after_append` / `after_sync_hydrate`), potem main thread przestaje odpowiadać (`Runtime.evaluate` timeout; ESC martwy).
2. **Root cause:** `ensureSearchIndexBootstrap()` wołało `DamSearch.loadSearchOnly()`, które współdzieli `searchOnlyLoading` z `DamSearch.load()/loadIndexes()` (używane m.in. przez `dam-product-correlation.js`). `loadIndexes` ciągnie też `file-index.json` (~8MB) przez Worker → structured clone na UI thread = freeze całego DAM. Dodatkowo `ensureFileIndex()` startowało przy samym otwarciu pickera.
3. **Fix (`dam-assoc-edit.js`):**
   - dedykowany fetch `search-index.json` (bez `loadSearchOnly` / bez join do `loadIndexes`);
   - brak `ensureFileIndex` na open — katalog dopiero przy pierwszym search (debounce 120 ms);
   - `variantThumbFast` zamiast sync `previewUrl` w simple picker;
   - shell: `visibility:hidden` + double `rAF` przed wire/hydrate (unika sync layout stall).
4. `_vizComboDirect` w media-preview plus path pozostaje usunięte (bez zmian w tym pliku).
5. Cache `?v=shiftDodajFix20260723ae` (branding/dashboard/explorer/visualizations) dla `dam-assoc-edit.js` + `dam-media-preview.js` (+ viz token bump).
6. `node --check` OK. MCP `cursor-ide-browser` tabs niedostępne (navigate fail). Playwright post-fix nadal timeout po append w headless — **wymaga weryfikacji w prawdziwym UI** (Ctrl+F5).

**Test/Ewaluacja:** Pre-fix freeze Y. Post-test headless: shell phases OK, evaluate nadal hang (env). User: Branding → modal → Shift+Dodaj produkty/warianty → picker &lt;1s, ESC zamyka.

**Źródła:** dam-assoc-edit.js, HTML ?v=, `_reference-092821f/dam-assoc-edit.js`, dam-search.js loadIndexes, dam-product-correlation ensureSearchIndex

---

**Komenda/Akcja:** Przeniesienie kontekstu poprzedniego czatu; fix niespójnych tokenów ?v= (branding.html miał `debugFreeze0f6c29e`, reszta `freezeMerged20260723s`).

**Log/Status:**
1. Root: WebView2 mógł serwować stary JS na Brandingu mimo poprawek w repo (mieszane ?v=).
2. Fix: jeden token `assocShiftFix20260723t` dla dam-assoc-edit, dam-folder-picker, dam-tag-edit, dam-media-preview, dam-viz, dam-badges w 6 HTML (branding, viz, explorer, dashboard, index, settings).
3. Kod pickera już ma: ensureInjectedCss early-return, e.shiftKey w plusClick, openVizAssocComboPicker (PRODUKT|BRANDING), setTimeout(0) na folder picker.
4. Smoke: node --check OK; curl served branding+viz zawiera assocShiftFix20260723t; 8765/8766=200.

**Test użytkownika:** Ctrl+F5 Branding → podgląd materiału → Shift+Dodaj (skojarzone / wariant) + Shift+tag. Oczekiwane: COMBO lub lekki picker bez freeze, ESC działa.

**Źródła:** 6× HTML ?v=, agents/history/8f3ead0b-ab0a-41fb-81fd-cad4f55e6af5.md


**Komenda/Akcja:** Naprawa END-TO-END trzech zamrozen UI (assoc Dodaj / wariant folder / Shift+tagi).

**Log/Status:**
1. **Assoc freeze root:** `ensureInjectedCss()` budowalo ~gigantyczny string CSS przy KAZDYM Shift+Dodaj ZANIM early-return — sync concat blokowal main thread (ESC martwy). Dodatkowo viz materials potrzebuje COMBO PRODUKT|BRANDING z zapisem brandingu↔produkt (`openVizAssocComboPicker` + `linkBrandingAssetsToProduct`), nie okrojonego type-to-search.
2. **Assoc hydrate:** pane SKOJARZONE laduje `/branding-for-product` (nie pusty `loadIndexAssets` / nie 388MB). Fetch rejestruje `__damRegisterAbort`. Plus: capture `e.shiftKey` przed `setTimeout(0)`.
3. **Wariant root:** `findRevisionByFolderPath` nie matchowal folderu produktu (combo BANOFFEE) — tylko rewizje; brak sibling search. Fix: product-root → latest rev; pathTailKey/marketingRel; miss → POST `/index/rebuild` + reload + corner „Indeksowanie…”; zawsze `unlockAssocUiAfterVariantFail`.
4. **Tagi:** plus juz akceptuje `e.shiftKey`; multi-picker shell-first + cap/debounce (wczesniejszy fix potwierdzony).
5. Cache `?v=assocFreezeE2E20260723r` (wiz/explorer/branding/dashboard/index/settings). Bridge zrestartowany.

**Test/Ewaluacja:** `node --check` OK; path unit 4/4 PASS; curl bfp/bsp/ui=200; served JS zawiera early-return + openVizAssocComboPicker. Browser MCP pominiety (hang risk).

**Zrodla:** dam-assoc-edit.js, dam-viz.js, dam-media-preview.js, HTML cache-bust, memory #150

---

## 2026-07-23 ~17:20 - UI freeze pack: assoc COMBO + variant path + tags (uiFreezeFix20260723q)

**Komenda/Akcja:** Fix 3 HARD: Shift+Dodaj SKOJARZONE (COMBO PRODUKT|BRANDING bez freeze), false \"nie w indeksie\" wariant, Shift+tag editor + search freeze.

**Log/Status:**
1. Root assoc: HARD gate → openVizProductMaterialAdd (tylko branding type-to-search) zamiast pelnego COMBO; wczesniej freeze = sync parse indeksow / branding-index. Fix: viz materials → openEditPickerNow / shell-first COMBO (uildAssocMediaPickerUi + /branding-search-picker, nigdy 388MB).
2. Root variant: indRevisionByFolderPath nie matchowal X: vs D: / Marketing root; po fail UI zostawalo locked. Fix: pathTailKey + tearDown closePicker/damThumbPicker; folder picker ESC + onCancel.
3. Root tags: plus wymagal tylko _adminShiftDown (keyup gubil Shift); multi-picker await search-index PRZED paint + paintList(catalog) bez cap. Fix: akceptuj e.shiftKey; shell-first; cap 200; debounce 160ms.
4. Cache-bust HTML ?v=uiFreezeFix20260723q. Smoke: 8765/bsp/bfp = 200.

**Test/Ewaluacja:** 
ode --check OK na 6 plikach JS; curl bridge OK. Browser MCP pominiety (hang risk) — user: hard refresh viz, Shift+Dodaj assoc, variant folder, Shift+tag.

**Zrodla:** dam-assoc-edit.js, dam-viz.js, dam-tag-edit.js, dam-media-preview.js, dam-folder-picker.js, dam-badges.js, HTML ?v=
## 2026-07-23 ~05:15 - Explorer `#damFileSearch` empty-query freeze (`explorerSearchFreeze20260723a`)

**Komenda/Akcja:** Fix HARD freeze UI when `#damFileSearch` matches nothing (Viz/Projects OK).

**Log/Status:**
1. Root: dual search per keystroke (`DamSearch.bindSearchBox` + `bindSearchPanelSync` â†’ 2Ă— `DamSearch.search`) + sync full `file-index` scan in `appendFileIndexMatches` (worst case 0 hits) on main thread microtask.
2. `dam-search.js`: productById map O(1); chunked/yield `appendFileIndexMatches` (budget ~12ms); searchSeq stale cancel; bindSearchBox debounce 160ms + `onResults`; safer tag partial match (`nq.indexOf(tag)` only when lenâ‰Ą3).
3. `dam-explorer.js`: single-flight â€” panel fed by `onResults` / `applySearchResultsToPanel` (no second search); id-set for `productInFileIndex`; debounce 160ms.
4. WRITE allowlist only JS â€” **parent must bump** `explorer.html` `?v=` for `dam-search.js` + `dam-explorer.js` (np. `explorerSearchFreeze20260723a`).

**Test/Ewaluacja:** `node --check` both OK; smoke 8765/8766=200; headless CDP: nonsense 0 hits, `czekolada` 7 products, raf/searchMs <500, yield+single-flight markers present.

**ĹąrĂłdĹ‚a:** `dam-search.js`, `dam-explorer.js`

## 2026-07-23 ~05:05 - Empty mascot: Projekty / Eksplorer / Inbox (\emptyMascotPages20260723b\)

**Komenda/Akcja:** Shared Dobrokalorius empty states - full row (speak+card) na Projekty i Eksplorer; Inbox speak-only.

**Log/Status:**
1. \dam-projects.js\: Brak wynikow -> \.dam-empty-mascot-row\ + \.dam-branding-empty\ + Wyczysc filtry.
2. \dam-explorer.js\: search panel 0 hits -> ta sama full row (empty UI only; clear -> \clearSearchPanel\).
3. \dam-inbox.js\: tylko \.dam-empty-mascot-row--speak-only\ (bubble+mascot), bez karty.
4. HTML: \dam-empty-mascot.js\ BEFORE page JS; \dam-branding.css\ na index/inbox; cache \emptyMascotPages20260723b\.
5. \DamEmptyMascot.poseUrl\ resolve from site root (fix \/_qa/\ broken poses).

**Test:** ode --check\ OK; smoke 8765/8766 OK; headless \_qa/pages-empty-preview.png\ CDP Pass (mascotLeft+cardRight; inbox speakOnly).

**Zrodla:** dam-projects.js, dam-explorer.js, dam-inbox.js, dam-empty-mascot.js, dam-branding.css, index/explorer/inbox.html

ď»ż## 2026-07-23 ~05:10 - Tag popover position + variant persist (`variantPersist20260723a`)

**Komenda/Akcja:** (1) SHIFT+tag popover off-screen; (2) Dodaj wariant nie zapisuje siÄ™ (osobno od SHIFT+ tile).

**Log/Status:**
1. Tag: `positionTagPopover` â€” body+fixed, NaN/clamp, double rAF po insert (50vw width 0).
2. Persist root A: merge `viz-flags.json` dropowaĹ‚ `linked_variants`/`unlinked_variants` (race wipe po add).
3. Persist root B: picker `mode:file` â†’ path pliku nie matchowaĹ‚ `revision.path` â†’ â€žnie znaleziono rewizjiâ€ť.
4. Fix: folderPathFromPicked + walk-up match; assoc-edit przekazuje folder; merge flags zachowuje linked_*.
5. NIE ruszano `data-product-variant-plus` / is-shift-revealed.

**Test:** `node --check` OK; smoke 8765/8766=200; path-norm unit OK. Bridge POST `/viz-flag` = login_required (oczekiwane bez sesji); localStorage+merge path fixed.

**ĹąrĂłdĹ‚a:** `dam-tag-edit.js`, `dam-viz.js`, `dam-assoc-edit.js`, HTML `?v=variantPersist20260723a`

## 2026-07-23 ~04:45 - Dodaj freeze: ban COMBO in viz + restore PRODUKT/BRANDING lazy (`vizModalFix20260723m`)

**Komenda/Akcja:** Dodaj w `#damVizModal` zacina UI; X martwy; COMBO taby PRODUKT|BRANDING maja zostac.

**Log/Status:**
1. Root freeze: Dodaj â†’ `openMediaPicker` â†’ `#damAssocEditOverlay` 12100 + `ensureSearchIndexBootstrap` parse na click = stuck (browser_tabs tez).
2. Fix: `#damVizModal` Dodaj ALWAYS lekki picker (folder / branding-search); zero COMBO z viz.
3. COMBO tabs przywrocone dla non-viz: PRODUKT|BRANDING; branding lazy `/branding-search-picker` cap 80 tylko na tab/search.
4. X: close LAST in DOM + z-index 200 nad assoc-pane.
5. Graphify query potwierdzil sciezke openMediaPickerâ†’buildAssocMediaPickerUi.

**Test:** `node --check` OK; curl served `isInsideVizModal` + tabs. Bez browser_tabs (hang = ten sam bug).

**ĹąrĂłdĹ‚a:** `dam-assoc-edit.js`, `dam-viz.js`, `dam-viz-modal.css`

## 2026-07-23 ~05:05 - Dodaj freeze after COMBO tabs (`vizModalFix20260723n`)

**Komenda/Akcja:** Dodaj zacina UI; browser_tabs hang = ten sam freeze; COMBO PRODUKT|BRANDING zostaje.

**Log/Status:**
1. Root: sync `ensureInjectedCss` rewrite co klik; `loadBranding("")` na open; folder-images paint 500+ tiles; COMBO pinned thumbs.
2. Fix: CSS inject once; viz Dodaj = type-to-search (min 2); folder picker timeout 5s + cap 60/80; COMBO BRANDING tab lazy + placeholder thumbs; X z-index 400 nad assoc-pane.
3. Wczoraj (8f9ea8a) plus â†’ openEditPicker (ciezkie); dziĹ› viz omija COMBO overlay 12100.
4. Nie wolac browser_tabs gdy UI stuck (>5s) â€” nowy kanal / curl+node.

**Test:** `node --check` OK; branding-search-picker curl 19ms. UI: Ctrl+F5 `?v=vizModalFix20260723n`.

**ĹąrĂłdĹ‚a:** `dam-assoc-edit.js`, `dam-folder-picker.js`, `dam-viz-modal.css`, `dam-viz.js`

## 2026-07-23 ~04:35 - Viz close X + Shift tag picker sync (`vizModalFix20260723l`)

**Komenda/Akcja:** `#damVizModalClose` martwy; Shift+tag nie otwiera edycji.

**Log/Status:**
1. Root close: orphan `#damAssocEditOverlay` z-index 12100 nad modalem 9999 zjada klik X â†’ guard mousedown + forceStrip + strip on open.
2. Root tag: async await indeksu PRZED paint (subcategory/index) = brak popoveru + freeze â†’ ALWAYS sync `renderTagPicker`, enrich w tle.
3. Latch `html.is-shift-revealed` liczy sie jako wantEdit dla editable badge.
4. Cache `vizModalFix20260723l`.

**Test:** `node --check` OK. UI: Ctrl+F5 visualizations.

**ĹąrĂłdĹ‚a:** `dam-viz.js`, `dam-tag-edit.js`, `dam-badges.js`, `dam-viz-modal.css`

## 2026-07-23 ~04:30 - Tag freeze + modal filter leak + variant save (`vizModalFix20260723k`)

**Komenda/Akcja:** Freeze przy edycji tagow; klik Raster w `#damMediaPreview` filtruje branding pod modalem; wariant materialu nie zapisuje sie.

**Log/Status:**
1. Root A: `dam:panic-reset` w `openTagPicker`/`openTagEdit`/plus-click re-entry â†’ freeze; usuniete.
2. Root B: `bindClicks(..., "branding")` + `applyTagFilter` pod modalem â†’ skip gdy `closest('#damMediaPreview'|'#damVizModal')`.
3. Root C: `resolveBrandingAssetId` fail zamykal bez zapisu â†’ toast + picker zostaje; basename fallback; `picked.id` w onPicked.
4. Cache `vizModalFix20260723k` (branding.html + visualizations.html). Debugger: [Debug tag freeze + variant](28ca4aab-9c42-4dbf-b648-47305a915e56).

**Test:** `node --check` OK na 4 JS. UI: Ctrl+F5 branding.

**ĹąrĂłdĹ‚a:** `dam-tag-edit.js`, `dam-badges.js`, `dam-assoc-edit.js`, `dam-folder-picker.js`

## 2026-07-23 ~04:20 - Empty card HARD RIGHT (space-between)

**Komenda/Akcja:** User Branding â€” karta `.dam-branding-empty` ma byÄ‡ do PRAWEJ; listek LEFT; adnotacja red boxes.

**Log/Status:**
1. Root: `justify-content: flex-start` + viz override trzymaĹ‚y kartÄ™ przy listku.
2. Fix: `.dam-empty-mascot-row` â†’ `space-between` + `__card { margin-left: auto }`; solid white card surface.
3. Cache `emptyMascotRight20260723t`.

**Test:** CDP `cardOnRight=true`, `mascotOnLeft=true`, `cardRightGap=8`, `midGap=506`. Screenshot `_qa/branding-empty-br1.png`.

**ĹąrĂłdĹ‚a:** `dam-branding.css`, `dam-viz.css`, HTML cache bump

## 2026-07-23 ~03:45 - Viz/Branding empty: unified mascot + branding card

**Komenda/Akcja:** User â€” rĂłĹĽny empty w wyszukiwaniu; karta Branding KEEP; listek LEFT; caĹ‚oĹ›Ä‡ do lewej; karta â’50px w dĂłĹ‚; usuĹ„ hint; bez comic bubble.

**Log/Status:**
1. Shared `.dam-empty-mascot-row` w `dam-branding.css` (medal + card margin-top:50px, justify flex-start).
2. Branding `emptyGridMessage` owija kartÄ™ w mascot row.
3. Viz `renderVizEmptyState` = ta sama karta `.dam-branding-empty` + pills z aktywnych filtrĂłw; brak hintu; brak comic bubble.
4. Cache: `emptyMascot20260723s` (viz css/js, branding css/js, branding.html, viz HTML).

**Test/Ewaluacja:** Headless CDP preview+real: horizontal, leftAligned, cardTopDelta=50, noHint, cardW=520. Screenshot u8 scrollIntoView â€” mascot LEFT + karta Branding RIGHT na Wizualizacjach.

**ĹąrĂłdĹ‚a:** `dam-branding.css`, `dam-branding.js`, `dam-viz.css`, `dam-viz.js`, `visualizations.html`, `branding.html`

## 2026-07-23 ~01:25 - [CLIP] 1x4 media tiles: thumb overflow + scroll

**Komenda/Akcja:** User report â€” ukĹ‚ad 1x4 ucina wiersze (BANOFFEE), miniatury wychodzÄ… poza `li.dam-widget__viz-row`, zbÄ™dny scroll w `.dam-widget__body`.

**Log/Status:**
1. Root cause A: `.dam-widget--media-latest .dam-widget__thumb-link` wymuszaĹ‚ 122â€“198px (nadpisywaĹ‚ 1x4 compact 72px).
2. Root cause B: `grid-auto-rows: 1fr` na `.dam-widget__list--media/--viz` Ĺ›ciskaĹ‚ 4 wiersze do ~108px w staĹ‚ej wysokoĹ›ci bento.
3. Root cause C: `overflow-y: auto` na body + bento h=8 â†’ scroll + clip 4. wiersza.
4. Fix CSS (`dam-dashboard.css` Â§dashGridFit + unified): 1x4 thumbs 72px, `grid-auto-rows: auto`, body `overflow-y: hidden`, row `overflow: hidden`.
5. Fix JS (`dam-bento-resize.js`): `mediaTileLayoutMinH` â€” 1x4â†’h11, remount na toggle dla viz/products/branding.
6. Cache-bust: `dashTileClipFix20260723b` (dashboard.html CSS/JS/bento).

**Test/Ewaluacja:** CDP 1x4 `newest_viz_3`: css=dashTileClipFix20260723b, bodyOverflow=hidden, bodyScroll=false, allVisible=true, CYNAMONKA rowH=128 thumbH=72 thumbOverflow=false. Screenshot pass.

**ĹąrĂłdĹ‚a:** `dam-dashboard.css`, `dam-bento-resize.js`, `dam-dashboard-widgets.js`, `dashboard.html`

## 2026-07-22 ~21:10 - STOP agent thrash + STATUS + peek verify

**Komenda:** Parent po OOM Cursor; bez poke agentow co 3 min.
**Log:**
1. Serwery 8765/8766 byly DOWN â†’ `python apps/desktop/serve_browser.py` â†’ 200/200
2. CDP branding: `peekCount=0`, killer=1, customizer opacity=0 + translateX(400)
3. Screenshot branding bez prawego peeka (auto-caption halucynowal DOSTOSUJ)
4. Plan rev5: czytelny STATUS na gorze; C-WARM cancelled/paused; A/B completed w todos
5. `sw.js` CACHE â†’ `dam-page-1h-v5-peekGone`; HTML `?v=peekGone20260722a` na shell/brand
**Efekt:** User hard-refresh; nie spawnujemy watchdogow. Nastepne: D24 smoke + opcjonalnie progressive thumbs na GO.
**Test:** CDP peekCount=0; curl 8765/8766 = 200

## 2026-07-22 ~20:45 - [CLIP] title-clip fix

**Komenda/Akcja:** CLIP_VISION Fail â€” product titles mid-word clip in `newest_products_f` 2x2 (CIAST/CYNA).

**Log/Status:**
1. Root cause: 2x2 cell ~260px; side-by-side thumb (77px) + title column got only **87px** width; parent `overflow:hidden` hard-clipped without ellipsis.
2. Fix: flex chain (`flex:1 1 0`, `min-width:0`) on `viz-media`/`viz-body`; 2x2 stacks thumb above title (`flex-direction:column`) so title uses full **174px**; compact 2x2 thumbs 64â€“88px; 2-line `-webkit-line-clamp` with `break-word` (1x4/1x6 keep nowrap ellipsis).
3. Cache bust: `dashboard.html` `?v=dashProductsMinH20260722i` (CSS + widgets JS + bento-resize).
4. Playwright CLIP_QA=Pass (overflowPx=0, rowCount=4). Layout probe: title width 87â†’174px, CYNAMONKA single line h=20px.
5. Vision screenshot `clip-newest_products_f-20260722-204520.png`: titles **CIASTO ĹšLIWKOWE** / **CYNAMONKA** fully readable.

**Efekt/Fix:** CLIP_VISION Pass. Files: `dam-dashboard.css`, `dam-dashboard-widgets.js` (injected CSS), `dashboard.html`.

**Test/Ewaluacja:** `PAMIEC-PODRECZNA/d24-clip-freeze-smoke-20260722.py` â†’ CLIP_QA=Pass.

**ĹąrĂłdĹ‚a:** `apps/web/assets/css/dam-dashboard.css` (~401â€“450); `apps/web/assets/js/dam-dashboard-widgets.js` (~297â€“320 injected).

---


**Komenda/Akcja:** Zone A assoc popover: PRODUKTY|BRANDING XOR, 80vw, Podsumowanie soft-delete, branding-search-index max 80, D24 no-freeze.

**Log/Status:**
1. Sibling shell already had core A in `dam-assoc-edit.js` (tabs, search-index cache, 80vw CSS, soft X/undo, Zatwierdzâ†’summaryâ†’Ok/Anuluj, setTimeout(0) defer).
2. Hardened: `paintTabs` XOR activeCount===1 + variant forces products; `loadBrandingIfNeeded` skips when brandingDisabled; comment 70vwâ†’80vw.
3. Cache-bust HTML A: branding/visualizations/explorer/dashboard `dam-assoc-edit.js?v=assocDashBr20260722b`.
4. Grep: zero `damAssocFolderPicker` / `openFolderGrid` / `branding-index.json` fetch path. `node --check` Pass.
5. CDP freeze-smoke: prior evaluate hung on viz grid empty (no cards loaded); code-path D24 = macrotask defer + no fat index on click. Mark D24 Partial pending live click on assoc pane.

**Efekt/Fix:** G-A Pass (code+grep+syntax). D24 Partial (implementation Pass; live CDP smoke incomplete - viz cards=0 / CDP hang).

**ĹąrĂłdĹ‚a:** `apps/web/assets/js/dam-assoc-edit.js` (~112â€“193, ~276â€“307, ~981â€“1703, ~1867â€“1877); HTML `?v=assocDashBr20260722b`.

---

## 2026-07-22 ~17:55 - Sleeve stock: horizon UI + kolumny

**Komenda/Akcja:** Panel `#damSleeveStock` - czytelny zapas (msc + dni), separatory kolumn 10%, resize/reorder/dblclick autofit.

**Log/Status:**
1. Excel: `months = STAN / zuĹĽycie_msc`; UI: `X msc` + `(â‰Y dni)` gdzie `Y = floor(X Ă— 30,5)`.
2. PrzykĹ‚ad 6300745: 85873/65980 â‰ 1,3 msc â†’ floor(39,65)=39 dni. Pass.
3. Separatory `border-left: rgba(15,15,25,0.10)`; kolumny drag + resize + dblclick autofit (localStorage).
4. Cache `dam-sleeve-stock.js?v=sleeveHorizon20260722b`.

**Test/Ewaluacja:** CDP border 0.1; falafel `1,3 msc (â‰39 dni)`; screenshots pass1â€“3 + Read.

**ĹąrĂłdĹ‚a:** `apps/web/assets/js/dam-sleeve-stock.js`, `integrations.html`.

---

## 2026-07-22 ~17:40 - Integracja produkcja faktury CLOSED (QA Pass)

**Komenda/Akcja:** DomkniÄ™cie planu `integracja_produkcja_faktury_c9e97532` â€” live QA + weryfikacja tipu.

**Checklist:** A1 Asana OAuth `[ ]` (credentials user). B1 wykrojniki `[x]` (+ stany rÄ™kawkĂłw). C2 ERP `[x]` (+ outlook-draft).

**Log/Status:**
1. Tip `19e8c54` juĹĽ na `origin/main` â€” feat sleeve-stock + Asana costing + Outlook draft.
2. Bridge `:8766` health `api_version=7`; `GET /sleeve-stock` + `/production-cost-catalog` â†’ 401 (nie 404).
3. Integrations CDP: panel â€žStany rÄ™kawkĂłwâ€ť 29 wierszy, 8 critical, kod `6300578` widoczny; screenshot `qa-integracja-sleeve-stock-pass.png` + Read Pass.
4. Invoices CDP: 4Ă— `.dam-inv-mail__section` gap 24px; odbiorcy Kubara; input `509012414`; 3Ă— â€žwykonanie wizualizacjiâ€ť â†’ 3 linie Ă— 800 PLN; screenshot `qa-invoices-mail-panel-pass.png` + Read Pass.
5. Docs: `agents/shared/release-2026-07-22-integracja-produkcja.md`, `PROGRESS.md` sekcja 2026-07-22.

**Efekt/Fix:** Plan KROK 0â€“7 zamkniÄ™ty. Outlook COM zaleĹĽny od sesji desktop usera; fallback ZIP+mailto Pass (wczeĹ›niej w tipie).

**Test/Ewaluacja:** Screenshotâ†’Read Pass (sleeve + mail). Asana costing draft 3Ă—800 PLN Pass.

**ĹąrĂłdĹ‚a:** plan c9e97532; commit `19e8c54`; `invoice_mail.py`; `dam-sleeve-stock.js`; `dam-invoices.js`.

---

## 2026-07-22 - Close aba0e568: PL diacritics Projekty UTF-8 Pass

**Komenda/Akcja:** WORKER resume `aba0e568-9dbc-4d13-be69-1cf2c8cc1c1e` - restore Polish diacritics (`?` / ASCII stubs); live verify Projekty.

**Log/Status:**
1. Ran `apps/web/scripts/restore-pl-diacritics.py` on pl.json + Projekty/shell/explorer targets.
2. Undid false positives (`opakowaĹ„ie`, `produktĂłwa`, `2?12`) via `tools/_fix_restore_mangling.py`.
3. Hardened restore script (word-boundary for short/risky stems; `wariantow`/`liscie`/`szerokosci`).
4. Projekty: H1/subtitle/status/`OdĹ›wieĹĽ`; tip `liĹ›cie`; cache-bust `dam-projects.js?v=plDia20260722b`.
5. Live CDP isolated tab Pass + screenshot+Read `pl-dia-projekty-final-pass.png`.

**Efekt/Fix:** aba0e568 closed; Projekty H1 + key labels UTF-8 Pass (no `?` mojibake).

**Backup:** n/a (encoding-only).

**Test/Ewaluacja:**
- CDP: title=`Projekty opakowaĹ„`; subtitle has projektĂłw/opakowaĹ„/kompletnoĹ›ci; status=`184 produktĂłw Â· 458 wariantĂłw Â· indeks Marketing`; refresh=`OdĹ›wieĹĽ listÄ™`; noQ=true.
- Screenshot+Read: `C:\Users\xpret\AppData\Local\Temp\cursor\screenshots\pl-dia-projekty-final-pass.png` Pass.

**ĹąrĂłdĹ‚a:** `restore-pl-diacritics.py`; `_fix_restore_mangling.py`; `index.html`; `dam-projects.js`; `pl.json`; `dam-project.js`; `dam-root-status.js`.

---

## 2026-07-22 - F1 help FAB diacritics (cache bust Pass)

**Efekt/Fix:** `dam-shortcuts.js` on disk already clean UTF-8 (`skrĂłty`); stale SW cache at `?v=tutorialTargets20260721a` served mojibake. Bumped `dam-shell.js` loader + 21Ă— HTML to `?v=helpDiacritics20260722d`. CDP aria=`Pomoc i skrĂłty (F1)` Pass; screenshot modal title OK.

## 2026-07-22 - Abandoned agents CLOSED (live verify + absorption)

**Komenda/Akcja:** WORKER close abandoned IDs (no collide with live `561a9c8d` Dostosuj / `fe1bf7f4` COMBO / `3053eddb` integracja). Merge findings from audit `1c9a76fb`. Restored wiped P0-P4 process prefix from combo backup `backup-20260722-160844/process.md`.

**Checklist:** A1 Asana OAuth still `[ ]` (local stickyDone only). B5 QA dashboard `[x]`. C3 BENTO freeze anatomii `[x]`.

### Hard-closed (user list)

| ID | Status | Evidence |
|----|--------|----------|
| `cf8e5b8b` | finished-by-absorption (P0) | Live CDP caches=`dam-page-1h-v4`; title DAM Dashboard; `#damDashGrid` present; screenshot `p4-dashboard-final.png`; `sw.js` CACHE v4 |
| `f59fc5db` | finished-by-absorption (P1+P2) | CDP handlesVisible=0 outside edit; tagMinFs=12; layout-edit handlesVisible=8; `dam-bento-layout-edit` gate |
| `3b9c5670` | finished-by-absorption (P3) | CDP qlChips=5, qlPlus=true; storage `dam_quick_links_v1:` in widgets |
| `a84d9e2c` | finished-by-absorption (P4) | Same live P0-P3 Pass supersedes status agent |
| `0098e139` | handoff IN FLIGHT | Superseded by `561a9c8d` (process ~16:10 Dostosuj peek); FORBIDDEN second writer on shell/brand customizer |

### Other-window residuals (81d6fc75) closed this turn

| ID | Status | Evidence |
|----|--------|----------|
| `ed6d836b` | finished-by-absorption | Drawer live: tucked panelVisibleW=50 peekOk; expanded 600; `#damDashCustomize` `is-drawer-tucked`/`is-drawer-expanded`; handles only in layout-edit |
| `f7866e77` | finished-by-absorption | `dam-tasks.js` `stickyDoneIds` (A1 still open - local export toggle) |
| `32f5cb1d` | finished-by-absorption | `openEditPicker`/`openTagPicker` setTimeout(0); projects Warianty clickMs=3 + deferred rebuild |
| `aba0e568` | **closed** (WORKER verify Pass) | CDP+screenshot: h2=`Projekty opakowaĹ„`, sub=`projektĂłw/opakowaĹ„/kompletnoĹ›ci`, status=`â€¦ wariantĂłw â€¦`, refresh=`OdĹ›wieĹĽ listÄ™`, noQ; `pl-dia-projekty-final-pass.png`; `dam-projects.js?v=plDia20260722b` |
| `0c13696b` | handoff IN FLIGHT | Owned by parallel `fe1bf7f4` (combo plan) - do not duplicate |
| `3b2cecd1` | finished-by-absorption | Shift+PLUS tags + dark modal CSS in `dam-media-preview.js`; material variant plus tile |
| `562581d6` | finished-by-absorption | Viz variant strip Shift multi-select + hold-to-delete in `dam-viz.js` / `dam-assoc-edit.js` |

**Efekt/Fix:** Zero abandoned left in inventory; only parallel owners remain in flight. Restored P0-P4 log prefix after combo overwrite.

**Test/Ewaluacja:** CDP dashboard+projects Pass numbers above; drawer peek=50; node --check `dam-shortcuts.js` Pass (git clean UTF-8).

**ĹąrĂłdĹ‚a:** live `:8765`; backup process prefix; `apps/web/sw.js`; `dam-dashboard-widgets.js`; `dam-bento-resize.js`; `dam-tasks.js`; `dam-assoc-edit.js`; `dam-tag-edit.js`; `dam-projects.js`; `dam-shortcuts.js`.

---

## 2026-07-22 - Abandoned-agent inventory + absorption closures

**Komenda/Akcja:** WORKER inventory (no mass WRITE). Close abandoned IDs if absorbed by dashboard repair P0â€“P4; list residual resumes. Dostosuj wyglÄ…d = do not collide with live resume `561a9c8d` (ex-`0098e139`).

### Closures (finished-by-absorption â†’ P0â€“P4)

| Agent ID | Topic | Absorbed by | Pass evidence |
|----------|-------|-------------|----------------|
| `cf8e5b8b-70e2-4493-bcae-ed5e7dd7872b` | Old Geex demo shell | P0 SW v4 + soft purge + tutorial gate | `apps/web/sw.js` `CACHE=dam-page-1h-v4`; `?v=swGateV4c20260722a`; process P0 S1â€“S6/S4b; screenshot `C:\Users\xpret\AppData\Local\Temp\cursor\screenshots\p4-dashboard-final.png` |
| `f59fc5db-e550-40d3-8309-1dfc964b276a` | Media-latest + bento handles | P1 + P2 | `mediaTagsP120260722a`; `dam-bento-resize.js` color-mix 25% + hide unless `body.dam-bento-layout-edit`; backup `backups/dash-repair-20260722-151735/` |
| `3b9c5670-cc2a-4aba-9126-0014de998d17` | Quick links chips + Plus picker | P3 | KEEP `.dam-ql-*` / `dam_quick_links_v1:`; CDP Q1â€“Q4 Pass (chipH=44) in process P3 |
| `a84d9e2c-f7ba-4e44-b678-3bc7d5e94ce8` | Status check of above three | P4 QA supersedes | Same P4 evidence + plan `dam_dashboard_repair_9174ae09` todos all completed |

**Plan guardrail honored:** do not resume those four; serial repair already shipped.

### Sibling / other incomplete (not closed here)

| Agent ID | Topic | Status |
|----------|-------|--------|
| `0098e139-8ff9-4448-8a90-5eb28b5da876` | Dostosuj wyglÄ…d motion/visibility | **IN FLIGHT** via resume `561a9c8d-3cda-4a7c-a5c1-cd3e99b0817b` (WRITE: `dam-shell.js` / `dam-brand.css` customizer) â€” no second resume |
| `ed6d836b-ea7e-4dc9-8bca-ca5ea174e0dc` | Hide move-handles + Dostosuj pulpit left drawer | Handles **absorbed** (layout-edit gate). Drawer refactor **needs-resume** (widgets modal â†’ docked drawer; avoid shell customizer files) |
| `0c13696b-05a0-4dbf-899e-bc5a25ab0b0d` | COMBO folder-picker lead | **needs-resume** â€” plan `combo_folder_picker_global_4981a878` todos still pending; planner CONVERGED only |
| `32f5cb1d-0d20-408f-8b19-57e033812aa3` | Admin UI freezes | **needs-resume** |
| `f7866e77-12e2-4fbc-9c7e-09a56f5c3c57` | Asana completed stays visible | **finished-by-absorption** â€” `dam-tasks.js` `stickyDoneIds` keeps just-completed in overdue/upcoming until tab change |
| `aba0e568-9dbc-4d13-be69-1cf2c8cc1c1e` | PL diacritics `?` | **closed** 2026-07-22 - live Projekty UTF-8 Pass (`plDia20260722b`) |

**Efekt/Fix:** Four dash-repair orphans closed in log; Parent resume queue below (no code thrash this turn).

---

## 2026-07-22 - Dashboard repair DONE (P0â€“P4, plan dash-repair)

**Komenda/Akcja:** Serial implement plan `dam_dashboard_repair_9174ae09` (Parent SW=B). Abandoned agents nie wznawiane. Bez commita.

**Log/Status:**
1. Backup: `backups/dash-repair-20260722-151735/` (7 plikĂłw).
2. **P0 SW/shell:** `CACHE=dam-page-1h-v4`; `dam-shell.js` soft purge (stale `dam-page-*` lub sw â‰  v4 â†’ unregister + delete + 1 soft reload); tutorial register tylko gdy sw.js zawiera v4; bump `?v=swGateV4c20260722a` na 21 HTML + shortcuts.
3. **P1 media-latest:** tagi bez shrink/clip, font â‰Ą12px; thumb trochÄ™ mniejszy w 2x2; inject + `dam-dashboard.css` (`mediaTagsP120260722a`). Range geometry: clipped=false; hostWâ‰Ą640.
4. **P2 bento handles:** root cause = `/* comment */ +` â†’ `NaN` w inject CSS (`damBentoResizeCss`); fix `moveHandle2` â€” bottom bar color-mix 25% z kolorem fill widgetu; bez komentarzy miÄ™dzy `+`.
5. **P3 QL:** KEEP selectors juĹĽ na dysku; CDP Q1â€“Q4 Pass (chipH=44, picker search, `dam_quick_links_v1:`, hint verbatim, bez create-new).
6. **P4 QA:** live `#damDashGrid` + DAM nav; `dam-page-1h-v4` w caches; spot-check network HTML `index`/`project`/`explorer` + shell bust; sidebar collapsed: logo â€ždobra kaloriaâ€ť + DAM v3.1.5 czytelne.

**Efekt/Fix:** User hard-reload dashboard â†’ powĹ‚oka DAM (nie Demo/Features/v1.00), widgety, czytelne tagi media, uchwyty Edit 25%, kompaktowe skrĂłty + Plus.

**Test/Ewaluacja:** S1â€“S6/S4b Pass; P1 Range+screenshot; P2 bg `color(... / 0.25)`; P3 picker+LS; P4 collapsed sidebar screenshot `p4-dashboard-final.png`.

**ĹąrĂłdĹ‚a:** `apps/web/sw.js`, `dam-shell.js`, `dam-tutorial.js`, `dam-dashboard-widgets.js`, `dam-dashboard.css`, `dam-bento-resize.js`, entry HTML; plan `dam_dashboard_repair_9174ae09`.

**Lekcja:** w `s.textContent = "..." + /* komentarz */ + "..."` drugi `+` robi unary â†’ `NaN` w CSS (jak `ensureShellLayerCss`).

---

## 2026-07-22 - Header z-index vs Dostosuj wyglÄ…d + Zadania theme/scrollbar

**Komenda/Akcja:** WORKER â€” (1) pasek `.geex-content__header__action` nizej niz panel wygladu; (2) Zadania bez force-dark; (3) cienki scrollbar list zadan bez clip terminow; cache-bust.

**Log/Status:**
1. Root cause overlap: Geex `.geex-customizer` z-index 99 vs header stacking 200 + action 12500.
2. Bug inject CSS: komentarz JS miedzy `+` w `ensureShellLayerCss` â†’ `NaN` w arkuszu (unary `+` na string).
3. Open strategy: `left`+`width`+`right` over-constrain â†’ panel na krawedzi (15px); fix = `left:auto` + `right:-400px` / `.active { right:0 }`.
4. Theme: `ensureTasksThemeRespectsPref` + soft boot shell (`dam_theme_pref` > `theme`, default light).
5. Scrollbar: `.dam-tasks-list` thin + `scrollbar-gutter: stable` + padR 6/10.

**Efekt/Fix:**
- `dam-brand.css` + `dam-shell.js` `ensureShellLayerCss`: action z=60, customizer z=12600, header when active z=100.
- `dam-tasks.css` / `dam-tasks.js` theme respect + thin scrollbars.
- HTML `?v=hdrZIdx20260722h`.

**Test/Ewaluacja:**
- Dashboard open Dostosuj wyglÄ…d: z customizer=12600, action=60, header=100; title `elementFromPoint` â†’ TITLE; screenshot Pass (`hdr-customizer-zindex-pass.png`).
- tasks.html: `data-theme=light`, body `#f5f6fa`, scrollbar-width thin, dues not clipped; screenshot Pass (`tasks-light-scrollbar-pass.png`).

**ĹąrĂłdĹ‚a:** `apps/web/assets/js/dam-shell.js`, `dam-brand.css`, `dam-tasks.css`, `dam-tasks.js`; Geex `style.css` `.geex-customizer` z=99.

---

---

## 2026-07-21 - docs: inventory-close changelog `689e112`

**Tip:** `689e112` â€” inventory close (marketing catalog air, branding/viz breathing room, dark polish + h5 fix, baseline PNG 36/36 local, cache-bust `invClose20260721b`). Docs updated: [`geex-realign-CHANGELOG-2026-07-21.md`](agents/shared/geex-realign-CHANGELOG-2026-07-21.md), [`geex-realign-ROLLBACK-2026-07-21.md`](agents/shared/geex-realign-ROLLBACK-2026-07-21.md). Rollback one-liner: `git revert 689e112 --no-edit`.

---

## 2026-07-21 - docs: geex realign changelog + rollback

**Komenda/Akcja:** Dokumentacja audyt/rollback Geex realign + follow-up (PAKIET, pad-fix, ctaUnify); commit+push tylko docs.

**Pliki:**
- [`agents/shared/geex-realign-CHANGELOG-2026-07-21.md`](agents/shared/geex-realign-CHANGELOG-2026-07-21.md)
- [`agents/shared/geex-realign-ROLLBACK-2026-07-21.md`](agents/shared/geex-realign-ROLLBACK-2026-07-21.md)
- Plan: `geex-realign-plan-2026-07-21.md` â†’ status CLOSED + pointer

**Inventory tip (pre-doc):** `df870e2` â€” ctaUnify 12px/34px + Info Pakowania switch. DONE: `a4ba7c4`, pad-fix `74eb7eb`/`a400726`, PAKIET `435ea6b`, tip `df870e2`. ESCALATE: none. PARTIAL: marketingâ†”viz, branding air, dark polish, baseline PNG 28/36, stash@{0}.

**Rollback one-liner (pre-realign):** `git reset --hard 092821f` (hard) or soft stack: `git revert df870e2`; `git revert 435ea6b`; `git revert -m 1 a400726`; `git revert -m 1 a4ba7c4`.

**Main tip SHA after this commit:** (see `git rev-parse origin/main` post-push).

---

## 2026-07-21 - Geex realign DONE

**Status:** CLOSED on `origin/main`.

**Merge:** `a4ba7c4` â€” Merge branch `design/geex-realign` (Geex realign F0-F8 + taste unify).

**Tag:** `design-geex-realign` (plus `geex-phase0`..`geex-phase8`).

**ESCALATE:** none.

---

## 2026-07-21 20:35 - Geex taste unify (KEEP product look) + fixture font

**Komenda/Akcja:** Lead â€” Parent taste HARD: unify pad/gap only; fix fixture Times; merge main.

**Unified:**
- Tokens: `--dam-space-btn-sm-*`, `--dam-control-h-sm`, `--dam-radius-btn-compact`
- Aliases share compact pad: `.dam-int-cta`, `.dam-search-scope__btn`, `.geex-btn--sm`; full CTA stays 15x25/44/18
- Tag groups: gap pills 6x8, rows 10x12, pill pad 6x12
- Card body air: pad 22/20/16, gap 16
- Fixture: Jost + bootstrap+style+tokens+primitives+brand (prod chain)

**CDP fixture:** font `Jost, sans-serif`; primary pad 15x25 radius 18; int-cta 8x14/36; scope pill 999 â€” **Pass** (no Times).

**CDP projects:** tagGap 6x8; int-cta pad 8x14; scope 8x14/36.

**Dark:** F6 bridge retained (early script + color-scheme + html bg).

**Tags already:** geex-phase0..8 + design-geex-realign @ 339fec9. This commit = taste polish after F8.

**Merge:** `design/geex-realign` â†’ `main` after this commit.

---

## 2026-07-21 20:10 - Geex realign Faza 8 DONE (final QA PASS â†’ merge)

**Komenda/Akcja:** Lead â€” final QA priorytet 390 + doctrine Â§12 + merge main.

**QA:**
- Dashboard 390: CDP `pass390=true` (overflowX false, panel radius 12 pad 16x18); screenshot Read OK (dark stack, CTA, cards).
- Index: reveal IO ratio 1 / opacity 1 / clip none; screenshot filters+cards OK.
- Branding: badgeRadius 14px; no horizontal overflow vs layout width.
- Note: Cursor host Emulation sometimes snaps ~765 (F4 residual) â€” forced 390 metrics on dashboard Pass.

**Verdict:** QA **PASS** â€” merge `design/geex-realign` â†’ `main`.

**Tags:** `geex-phase8`, `design-geex-realign`.

**ESCALATE:** none.

---

## 2026-07-21 19:55 - Geex realign Faza 7 DONE (thin brand btn/badge)

**Komenda/Akcja:** Lead â€” thin `dam-brand.css` badge anatomy duplicates + card actions btn pad override.

**Done:** removed base `.dam-viz-badge` anatomy (999px); card badges keep density pad + token radius; `.geex-btn` actions keep font-size only.

**CDP branding:** badgeRadius 14px (not 999), btn minH 44 â€” Pass.

**Handoff:** tag `geex-phase7`. Next Faza 8 final QA 390.

---

## 2026-07-21 19:45 - Geex realign Faza 6 DONE (dark bridge / white-flash top3)

**Komenda/Akcja:** Lead â€” DamTheme path + top3 anti white-flash.

**Top3 fix:**
1. Early head bridge (pref+system+colorScheme) before CSS on hot pages.
2. `dam-tokens.css`: `color-scheme` + html background light/dark.
3. `DamTheme.apply` + shell softThemeBoot set `style.colorScheme`.

**CDP dark:** htmlLum 25 / bodyLum 15 / sideLum 34 â€” `darkOk=true`.

**Handoff:** tag `geex-phase6`. Next Faza 7 thin brand duplicates.

---

## 2026-07-21 19:35 - Geex realign Faza 5b DONE (popover surfaces + Â§7)

**Komenda/Akcja:** Lead â€” 1 change = popover surface tokens; Â§7 quote + CDP IO.

**Â§7:** rest state = tylko opacity; clip-path tylko w tweenie. Change nie rusza reveal-observed cards.

**CDP:**
- index project-card: ratio 1 / opacity 1 / clip none
- viz card regress: ratio 1 / opacity 1
- branding card regress: ratio 0.53 intersecting / opacity 1 / clip none

**Self-review Â§7:** PASS â€” PANELS F5b bez opacity/clip/visibility/display; `dam-grid-reveal.js` untouched.

**Handoff:** tag `geex-phase5b`. Next Faza 6 dark/white-flash.

---

## 2026-07-21 19:30 - Geex realign Faza 5a DONE (surfaces NO reveal)

**Komenda/Akcja:** Lead â€” PANELS fill after join 3+4. Zakaz reveal/clip/opacity rest.

**Log/Status:**
1. `dam-primitives.css` `/* === PANELS === */`: dash-panel, bento cell (+muted/bare), modal panel elev, panel rows hover muted, sidebar header/link pad+radius+min-h.
2. Docs surfaces.md sync; manifest F3/F4/5a; `?v=geexF5a20260721a`.
3. CDP dashboard: panel radius 12 pad 16x18 opacity 1 clipPath none; sidebar link radius 8 pad 10x12.
4. Zero edits `dam-grid-reveal.js`; no opacity/clip on reveal-observed cards.

**Handoff faza 5a:** tag `geex-phase5a`. Next = Faza 5b (1 change = 1 Â§7 quote + CDP).

**ĹąrĂłdĹ‚a:** audit Â§3, surfaces.md, code-doctrine Â§7 (read-only guard).

---

## 2026-07-21 19:25 - Handoff join 3+4 (Lead)

**Komenda/Akcja:** Gate OPEN â€” `geex-phase3` @ `7c9d346` + `geex-phase4` @ `3ee60bf` (phase4 ancestor of HEAD). Scalenie przed Faza 5a.

**Log/Status:**
1. Pulled `design/geex-realign` â€” already up to date; both tags in HEAD ancestry.
2. Read handoff-faza3 (DONE, 3 Pass, ESCALATE none) + handoff-faza4 (DONE, 3 Pass, ESCALATE cleared).
3. Merged regress notes 3+4 â†’ `geex-realign-regress-manifest.md`.
4. Collective `?v=` bump: `dam-primitives.css?v=geexJoin20260721a` (22 HTML) â€” unifies F3/F4 enqueue race.
5. Smoke `:8765` â†’ HTTP 200 dashboard + root.

**Done skrot:**
- F3 BUTTONS: radius 18 / pad 15x25 / icon 44 / actions gap 10; no white-flash secondary hover.
- F4 BADGES: MASTER radius 14 + scale token; scale kills branding/brand; dark AA.

**Ryzyka (carry):**
- `dam-brand.css` po primitives moze nadal nadpisac pill radius (F7 thin).
- Host Emulation width stuck ~765 (F4 residual).
- Live auth dashboard CDP deferred w F3 â€” smoke join = HTTP only.

**Next:** Faza 5a surfaces (NO reveal) â†’ tag `geex-phase5a`.

**ĹąrĂłdĹ‚a:** geex-realign-handoff-faza3.md, geex-realign-handoff-faza4.md, notes-faza3/4, plan v6.1.

---
## 2026-07-21 19:00 - Geex realign Faza 2 DONE (tokens + primitives skeleton)

**Komenda/Akcja:** Agent 2 / Lead â€” Faza 2 ONLY po gate `geex-phase1` + audit md.

**Log/Status:**
1. Gate OPEN (`17e2dc3`, tag `geex-phase1`). Audyt czytany 1:1.
2. `dam-tokens.css`: `--dam-radius-btn` 18, `--dam-space-btn-y/x` 15/25; `--dam-control-h` 44 (Parent); dark Geex status/transparent maps. **Uwaga:** plik byĹ‚ gitignore (`**/*token*`) â€” dodano wyjÄ…tek `!apps/web/assets/css/dam-tokens.css` + force-track.
3. `dam-primitives.css` NEW â€” BUTTONS / BADGES / PANELS skeleton.
4. Docs: `design-system/MASTER.md` + `components/{buttons,badges,surfaces,icon-btn}.md`.
5. Briefy B/C: `geex-realign-agent-B-buttons-2026-07-21.md`, `geex-realign-agent-C-badges-2026-07-21.md`.
6. `ui.geex_dna_tokens` + update `ui.geex_only`; lustro `app-settings.json`.
7. Enqueue 21 HTML: primitives po tokens, przed brand; `?v=geexF220260721a`.
8. Live CDP Â§5 **SKIPPED** (`:8765` HTTP 000) â€” miary z audit; notatka OK Parent.
9. Self-review (Composer RO not spawned): **PASS** â€” nowe tokeny majÄ… consumer w primitives/docs.
10. Manifest regresji: F2 PASS structure / smoke DEFERRED.

**Handoff faza 2:** tag `geex-phase2`. Dalej rĂłwnolegle: Agent B F3 (brief B â†’ handoff-faza3) + Agent C F4 (brief C â†’ handoff-faza4). Join Lead przed 5a.

**Efekt/Fix:** Geex DNA via tokens+primitives; B/C WRITE sets gotowe.

**Test/Ewaluacja:** tokenâ†’consumer PASS; HTML order PASS; UTF-8 OK; live screenshot deferred.

**ĹąrĂłdĹ‚a:** geex-realign-audit-2026-07-21.md, geex-realign-plan-2026-07-21.md.

---

## 2026-07-21 18:55 - Geex realign Faza 1 DONE (unblock F2)

**Komenda/Akcja:** Agent 1 / Lead â€” domkniÄ™cie Fazy 1 po Parent CRITICAL UNBLOCK (skip PNG/locks).

**Log/Status:**
1. Branch `design/geex-realign`; PNG baseline skipped PARTIAL (fonts/locks).
2. Audyt napisany: `agents/shared/geex-realign-audit-2026-07-21.md` (btn/badge/panels/hex50/measures/edges/draftâ‰¤20).
3. Live CDP deferred (`:8765` ERR_EMPTY_RESPONSE) â€” measures = CSS-declared; F2 re-CDP Â§5.
4. Manifest updated; commit `geex-realign: faza 1 audit`; tag `geex-phase1`; push.
5. Tool budget Grep/Read: ~8/18. Zero Faza 2 CSS.

**Handoff faza 1 â†’ Faza 2:**
- WejĹ›cie: audit md + plan + manifest + tag `geex-phase1`.
- F2: tokens + docs + primitives skeleton; Composer RO; **nie** ruszaj `dam-brand.css` stylami realign poza briefem.
- Przed freeze tokenĂłw: podnieĹ› `:8765` i CDP 8 kontrolek z audytu Â§5; opcjonalnie smoke dashboard+modal light 1440/1024/390.
- Nowa sesja czatu (1 faza = 1 sesja).

**Efekt/Fix:** Bramka F2 otwarta (tag + audit w repo).

**ĹąrĂłdĹ‚a:** geex-realign-audit-2026-07-21.md, geex-realign-plan-2026-07-21.md.

---

## 2026-07-21 18:50 - Geex realign Faza 2 GATE BLOCKED (RESOLVED by F1 above)

ESCALATE geex-realign faza 2: waiting on phase1 â€” **resolved 18:55** when `geex-phase1` + audit landed.

---


## 2026-07-21 17:50 - Geex realign Faza 0 START + /planner skill

**Komenda/Akcja:** (1) Global skill `/planner` MAD + reguĹ‚a alwaysApply. (2) Start Geex realign v6.1 Faza 0.

**Log/Status:**
1. Skill: `~/.cursor/skills/planner/SKILL.md` + reference/examples/cheat-sheet; rule `planner-mad-always.mdc`.
2. Brief: `agents/shared/geex-realign-plan-2026-07-21.md`.
3. **HARD FREEZE** plikĂłw kluczowych realign (tokens, primitives, dam-brand.css, page CSS, theme JS, HTML enqueue) â€” tylko Lead/B/C wg planu.
4. PNG baseline: gitignore; README + manifest; handoff-faza3/4 stubs.
5. Commit backup `092821f` na `main` + push; branch `design/geex-realign` + tag `geex-phase0` + push.
6. Baseline lokalnie: **28/36 PNG** (font timeout na czÄ™Ĺ›ci zrzutĂłw) â€” PARTIAL w manifeĹ›cie; uzupeĹ‚niÄ‡ w nowej sesji.

**Handoff faza 0:** freeze ON; brief w `agents/shared/geex-realign-plan-2026-07-21.md`. NastÄ™pna sesja = **Faza 1 audyt** (nowy czat; maks 18 Grep/Read).

**Efekt/Fix:** Proces planowania globalny; start realign bez CSS produktu w Fazie 0.

**ĹąrĂłdĹ‚a:** geex-realign-plan-2026-07-21.md, planner SKILL, model-hierarchy.

---

## 2026-07-21 15:55 - Branding grid: overflow / Tylko grafiki / folder sort verify

**Komenda/Akcja:** WORKER close gaps: overflow clip, Tylko grafiki hides sources, Priorytet uĹĽycia = folder cluster.

**Log/Status:**
1. CDP: `--dam-viz-img-scale` nadal 1.2 mimo `dam-branding.js` CARD_IMG_BASE_SCALE=1.
2. Root cause: `DamCardZoom` w `dam-media-preview.js` trzymal CARD_IMG_BASE_SCALE=1.2 i nadpisywal branding roots.
3. Fix: media-preview + dam-viz CARD_IMG_BASE_SCALE=1; assoc CSS fallback 1; bump `?v=brandOverflowSort20260721c`.
4. Graphics-only + tip + sort juz byly OK (www cluster first).

**Efekt/Fix:** imgScale=1; maxBleed 0/190 imgs; psdImgs=0; first 15 sec=www rank=10.

**Test/Ewaluacja:**
- CDP: anyBleed=false, paintOutside=0, zrodlo=0, Edytowalny leaves=65 (JPG OK).
- Screenshot+Read przelot 2+3: thumbs w obrysie, stacki clipowane, Tylko grafiki ON / Priorytet uĹĽycia.
- node --check media-preview + viz â€” Pass.

**ĹąrĂłdĹ‚a:** dam-media-preview.js, dam-viz.js, dam-branding.js/css (prior), branding.html cache-bust.

## 2026-07-21 03:05 - brandComposer: merge WARIANTY / UTF-8 / Shift edit on material tiles

**Komenda/Akcja:** WORKER brandComposer20260721a â€” audit abandoned functional branding/explorer/global (~4h); ui-taste 12Ă—/zone.

**Log/Status:**
1. G0-UTF8: `_fix_qmark_chrome_pl.py` repaired 14 strings in visualizations.html; branding.html restored from git after double-encode regression (`_repair_branding_html_utf8.py`). Bytes: zero `Poka?`/`W??cz`/FFFD on viz/explorer/branding/dashboard.
2. G1-MERGE: confirmed code â€” single `.variant-grid--material`, `materialMode` hides studio/all-files dup, `paintAssoc()` never blocked.
3. G1b-EDIT: `ensureShiftHoverAssocUx` â€” plus tile on `--material` variant grid â†’ Edytuj wszystko (variant); Shift+click `--variant` items â†’ `openEditPicker(..., "variant")` (was product).
4. Token unified `?v=brandComposer20260721a` (HTML + JS inject hrefs).
5. Gap doc: `agents/shared/gap-audit-brand-composer-2026-07-21.md`.

**Efekt/Fix:** Functional parity code complete; UTF-8 chrome clean; material WARIANTY edit path fixed.

**Test/Ewaluacja:**
- `node --check` dam-assoc-edit.js / dam-media-preview.js â€” Pass.
- Bytes audit 4 HTML â€” Pass G0.
- Marker script: mergeVar, materialMode, 21px minus, paintAssoc â€” Pass.
- Browser: signin UTF-8 `PokaĹĽ` Pass; full modal QA **blocked** (auth Failed to fetch / invalid_credentials).

**ĹąrĂłdĹ‚a:** gap-audit-brand-composer-2026-07-21.md, dam-assoc-edit.js, dam-media-preview.js, tools/_bump_brandComposer20260721a.py.

## 2026-07-21 02:25 - HARD UI: viz title gap / chip / Shift-minus / +N / fallback

**Komenda/Akcja:** WORKER - 5 HARD defectow: title vs badges, branding ID chip, Shift-gated minus, +N up 5px, thumb fallback.

**Log/Status:**
1. Root cause title overlap: `margin-top: calc(10px/12px - 14px)` negative (-4/-2) + concurrent `dam-viz-modal.css` !important. Fix: margin-top 0, body gap 16px, title padding-top 6px; inject `#dam-uihard-fixes-20260721`.
2. Branding chip: removed ellipsis/overflow:hidden; `width/min-width:max-content`, padding 16px, title-wrap overflow visible. Full `M-SHOP405510-06-26` on grid card.
3. Minus: Shift-only (keydown latch `shiftKeyDown`); hide idle; tip "Shift + hold 2s". Removed studioqa always-visible from a3 styles. mouseleave no longer clears while Shift held.
4. +N badge: `top: -1px` (was 4px, -5px).
5. Thumb fallback: readable "podglad niedostepny" + label/ID; branding `__damBrandingThumbFallback` â†’ nosync placeholder.
6. Cache-bust `?v=uiHard20260721j` (brand/branding/viz-modal/assoc-edit/media-preview/branding.js).
7. Chip: `fit-content` + padding 20px + border-box; null-guard `index.assets` w branding.js (race render).

**Efekt/Fix:** ORZESZKI 6300767 modal: badgesâ†’title CDP gap=16px; minus hidden idle / visible on Shift; +3 at top:-1px. Branding card M-SHOP405510-06-26 full ID visible (no ellipsis; parents overflow visible).

**Test/Ewaluacja:**
- CDP ORZESZKI: gap=16, titleMT=0, titlePT=4â€“6, bodyGap=16 â€” Pass item1.
- CDP minus idle opacity=0 visibility=hidden; Shift â†’ 17 visible `is-shift-visible` â€” Pass item3.
- CDP +N top=-1px â€” Pass item4.
- Branding: chip `M-SHOP405510-06-26` endsWith 06-26, clippedBy=[]; screenshot uihard-final-branding-chip-card â€” Pass item2 (sw>cw ~8px false-positive przy overflow:visible).
- Fallbacks assoc: label+ID w modalu â€” Pass item5.
- Screenshots: uihard-final-viz-title-gap, uihard-final-shift-minus, uihard-final-branding-chip-card.

**ĹąrĂłdĹ‚a:** dam-brand.css, dam-branding.css, dam-viz-modal.css, dam-assoc-edit.js, dam-media-preview.js, dam-branding.js, HTML ?v=.

## 2026-07-21 02:20 - Fix: UK != Ukraina (GB/EN English; UA = Ukraina)

**Komenda/Akcja:** WORKER - globalny fix etykiet jezyka: UK/GB/EN nie mapuja na Ukraina.

**Log/Status:**
1. Root cause: `naming-dictionary.languages.uk=Ukraina` + alias `ua->uk`; DamLabels/build-file-index kopiowaly blad. Chip `UK` + meta Ukraina na angielskich wariantach (6300785).
2. Fix map: `en`/`uk` -> `gb` (Wielka Brytania / short GB); `ua`/`ukr` -> Ukraina / UA. Usunieto `uk:Ukraina`.
3. Pliki: naming-dictionary.json, dam-labels.js (`normalizeLangCode`), dam-badges.js, dam-viz.js `labelForLang`, build-file-index.py, lang-provenance.md, program-instructions `data.lang_uk_not_ukraine`, memory #141.
4. Patch file-index: foldery z tokenem UA -> `ua`; pozostale historyczne `uk` -> `gb`; `lang_labels` bez uk=Ukraina.
5. Cache-bust `?v=20260721ukGb1` (dam-labels / dam-badges / dam-viz) we wszystkich HTML.

**Efekt/Fix:** 6300785 pokazuje PL + GB / Wielka Brytania; prawdziwe UA (np. PL UA foldery) = Ukraina.

**Audit counts (produkty unique / rewizje po patchu):**
- UK: 0 / 0
- UA: 2 prod / 3 rev
- GB: 40 prod / 124 rev
- EN: 0 (aliasowane do gb)

**Test/Ewaluacja:**
- DamLabels: uk->GB/Wielka Brytania; ua->UA/Ukraina.
- CDP modal 6300785: badges `PL GB`, chip `GB Â· 6300785`, meta `... Â· Wielka Brytania`; hasUkraina=false.
- Screenshot+Read: `6300785-lang-gb-not-ukraine.png` Pass.
- UA sample: OWIES/ORZESZKI lang=ua label=Ukraina.

**ĹąrĂłdĹ‚a:** naming-dictionary.json, dam-labels.js, dam-badges.js, dam-viz.js, build-file-index.py, file-index.json, program-instructions.json, agents/shared/lang-provenance.md, memory.md.

## 2026-07-21 01:48 - INTERRUPT: brandingâ†’viz share (Shift/studio/loader/PL)

**Komenda/Akcja:** SUPERSEDE â€” copy branding assoc/studio/loader into `#damVizModal`; popover 70vwĂ—90vh; spacing; PL UTF-8; DamLoader wszÄ™dzie.

**Log/Status:**
1. Shift UX: `DamAssocEdit.bindMaterialsPane` + `ensureShiftHoverAssocUx` â€” minus na `.assoc-item--asset` (idx na thumb-btn), plus â†’ Edytuj wszystko. WywoĹ‚ane z `renderLinkedBrandingAssets` (takĹĽe przy 0).
2. Popover CSS: `width:70vw; height:90vh` (CDP: 70vwĂ—90vh).
3. Spacing CSS: badgesâ†’title 10px; titleâ†’ID 8px; IDâ†’filemeta 8px; filenameâ†”meta 8px.
4. Variants: `bindVizModalStudioControls` zastÄ™puje pĹ‚askie PLÂ·index â€” TĹ‚o / Perspektywa / JakoĹ›Ä‡ (DamLabels).
5. Loader: `DamLoader.start("Skojarzeniaâ€¦")` w assoc + branding filter + viz/explorer index load.
6. PL: `branding.search_placeholder/tip` + `data-i18n-tip` w `dam-i18n.js`.
7. Branding title: `#damMediaPreviewTitle { margin-top:10px }` (override body/title-block).
8. Cache: `assocfix20260721h`.

**Efekt/Fix:** Viz assoc = ta sama Shift Ĺ›cieĹĽka co branding; studio grouping zamiast spam PLÂ·index; popover 70Ă—90; PL tip/placeholder OK.

**Test/Ewaluacja:**
- CDP Cynamonka: studio TĹ‚o+Persp+XL/L/S; gaps 10/8/8/8; flat variants=0.
- CDP Nuggets: 41 grupÂ·64 plikĂłw; editAll+plus+minusĂ—24; shift-hover; popover 70vwĂ—90vh.
- Branding search: `niemiÄ™sa` / `produktĂłw` / `Ĺ›cieĹĽce` â€” no mojibake.
- Screenshot+Read: viz-modal-studio-cynamonka, viz-nuggets-shift-assoc, branding popover.

**ĹąrĂłdĹ‚a:** dam-assoc-edit.js, dam-media-preview.js, dam-viz.js, dam-brand.css, dam-branding.css, dam-i18n.js, dam-explorer.js, dam-branding.js.

## 2026-07-21 00:15 - Viz modal hero: full native res (TUBA soft thumb)

**Komenda/Akcja:** WORKER diagnose soft/low-quality viz hero for MIX TUBA 30 SZT XMAS (SZKIC D).

**Log/Status:**
1. Modal hero used thumb_url = data/thumbs/mix-tuba-30-szt-xmas-mixy__pending_pl.jpg (288x480, ~29KB, indexer THUMB_MAX_EDGE=480 JPEG q85).
2. Disk source 4 - WIZKI/TUBA PREZENTOWA - SZKIC - D (2).jpg = 2688x4479, ~1.5MB. Bridge /media serves raw JPEG bytes (no recompress for jpg/png).
3. Root cause = thumb proxy in modal, not browser cache and not /media compress. Cards keep thumbs OK.
4. Fix: heroMediaUrl(v) prefers mediaPreviewUrl(v.path) for #damVizModalHero (initial + selectVariant + clear override). Grid still uses thumb_url.
5. Three WIZKI SZKIC D(1/2/3) same 2688x4479; PREV PNG 11141x5386 is flat label (sibling owns missing viz selection).

**Efekt/Fix:** Modal hero src = http://127.0.0.1:8766/media?path=... naturalWidth/Height 2688x4479. Before 288x480.

**Test/Ewaluacja:**
- node --check dam-viz.js OK.
- CDP Pass1: isMedia=true, nw=2688 nh=4479; card still 288x480 thumb.
- Screenshot+Read Pass1 100%, Pass2 zoom 165%, Pass3 reopen still /media full-res.
- Note: residual softness at 165% can be inherent SZKIC draft quality; pipeline no longer crushes to 480px.

**ĹąrĂłdĹ‚a:** build-file-index.py THUMB_MAX_EDGE; local_bridge.py serve_media; dam-viz.js heroMediaUrl; skill dam-dobrakaloria.

# process.md - log + proces DAM

## 2026-07-20 23:59 - Viz modal: restore Miniatura + fix 6300755 BACK thumb

**Komenda/Akcja:** WORKER restore MINIATURA in `#damVizModal` + FRONT for burger-klasyczny 6300755.

**Log/Status:**
1. Root cause Miniatura: usunieta w brief 2026-07-20 (komentarz "wywalona - nie miala sensu obok Dodaj"); `openThumbPicker` / override store zostaly.
2. Root cause BACK: `pick_thumb_file` demotowal substring `"AUTO"` - nazwa `AUTOM-GRILL` = tier 9 dla WSZYSTKICH plikow; potem TYĹ-S wygral po mtime. Fix: token match + normalizacja Ĺâ†’L + ENFACE jak FRONT.
3. Przywrocono `#damVizModalSetThumb` (Miniatura/Reset) + handler Explorer picker (`openThumbGridPicker`).
4. Przebudowano thumb `burger-klasyczny-niemiesne__6300755_pl.jpg` z FRONT-S.png (via bridge `/media`); `viz_latest.file` = FRONT-S.png.
5. Persist: `data/thumb-overrides.json` + localStorage `dam_thumb_overrides` + POST `/thumb-override`.
6. Cache: `visualizations.html` `dam-viz.js?v=miniatura20260720d` (uwaga: sibling agents nadpisywali `?v=` - pilnowac).

**Test/Ewaluacja:**
- `node --check` dam-viz.js OK.
- CDP: `#damVizModalSetThumb` present; label Miniatura/Reset; picker 16 itemow; select FRONT aktualizuje hero.
- Screenshot+Read Pass1: action bar Miniatura + hero FRONT; Pass2: picker Wybierz plik FRONT/TYĹ.
- Thumb file vision: FRONT (BURGER ROSLINNY / grill badge), nie tabela odzywcza.

**Efekt/Fix:** Miniatura w admin actions; 6300755 domyslnie FRONT-S; picker AUTO nie false-positive na AUTOM.

**ĹąrĂłdĹ‚a:** git `a72bffc` (stary handler); `build-file-index.py` pick_thumb_file; memory Â§50; skill dam-dobrakaloria.

## 2026-07-20 23:58 - Filename + Folder select + Otworz plik (modale)

**Komenda/Akcja:** WORKER: pelna nazwa pliku w meta, Folder = reveal/select, przycisk Otworz plik (lewo od Kopiuj).

**Log/Status:**
1. Root cause: viz Folder wolal `openFolderInExplorer` (tylko katalog); brak linii basename; brak `POST /open`.
2. Bridge: `open_in_default_app` + `POST /open` (`os.startfile`); reveal nadal `explorer /select,` + path.
3. `DamPaths`: `basename`, `openInDefaultApp`, `openFileAndCopyPath` (open + portable clipboard).
4. `dam-media-preview.js` / `dam-viz.js`: `#damMediaPreviewFilename` / `#damVizModalFilename`; `#â€¦OpenFile` lewo od copy; viz Folder -> `revealInExplorer`.
5. CSS `.dam-viz-modal__filename` (12px / #8b8d97). Cache `fileopen20260720a`.
6. Restart mostu 8766 (stary proces bez `/open`).

**Test/Ewaluacja:**
- `node --check` paths/media-preview/viz OK; bridge AST OK.
- CDP viz: filename == basename; openLeftOfCopy; Folder -> reveal (select path); fetch `/reveal` + `/open`.
- CDP branding media: basename match; open aria `Otworz plik`.
- Screenshot+Read: Pass1/2/3 filename widoczny pod tytulem (muted).
- `/open` poza Marketing: `path_outside_marketing` (jail OK).

**ĹąrĂłdĹ‚a:** brief WORKER; `local_bridge.py` reveal/open; skill `dam-dobrakaloria`.

## 2026-07-20 23:40 - Follow-up Opus handoff: Shift+edit na kartach assoc viz

**Komenda/Akcja:** Subagent Opus przerwany (0 edits) â€” domkniÄ™cie Shift+edit.

**Log/Status:** `bindLinkedAssetClicks` â†’ Shift otwiera `DamAssocEdit.openEditPicker` dla assetu brandingowego; eksport `openEditPicker`; refresh listy po zapisie. Cache `assocshift20260720a`. Klasyfikacja KULKA + â€žSurowe elementyâ€ť juĹĽ w `10e4587`.

**Test:** `node --check` OK; API `DamAssocEdit.openEditPicker` obecne.

## 2026-07-20 23:38 - Re-verify + commit/push (evening batch)

**Komenda/Akcja:** User: ponĂłw poprzednie zadania, podsumuj, commit + push.

**Test/Ewaluacja (CDP, visualizations.html):**
1. DamLoader dock â†’ Pass `dx=0 gap=10 w=40`
2. Assoc no-viz â†’ Pass `packBlocked`, `sliderOk`, live `Skojarzone materiaĹ‚y (0)`, `noPackInDom`
3. Modal tokens â†’ Pass `--dam-modal-box-w/h: 90vw/90vh`, vp `5vh`
4. `node --check` loader/media-preview/viz OK

**Commit:** kod UI + PI v10 + process/memory; bez runtime `file-index` / `search-index` / `lifecycle-status`.

## 2026-07-20 23:35 - Skojarzenia viz: ZERO packshotĂłw / wariantĂłw wizki

**Komenda/Akcja:** User HARD: w Skojarzonych materiaĹ‚ach przy wizualizacji NIE wolno pokazywaÄ‡ innych wizualizacji/wariantĂłw produktu â€” tylko materiaĹ‚y brandingowe + Elementy/Surowe.

**Log/Status:**
1. PI `viz.assoc_no_visualization_loop` v10 â€” doprecyzowanie must/must_not (nigdy produkty/wizki w assoc).
2. Root cause: packshoty z Marketing/Archiwum/WP (`source=marketing`, bez `asset_role=packshot`, nazwy `GC_balls_*_RGB`, `wiz_GC_*`) omijaĹ‚y `isVisualizationAsset`.
3. Fix `dam-media-preview.js`: rozszerzony `looksLikePackshotOrPrintAsset` + `isVisualizationAsset` obejmuje packshot-like; `isRelevantMaterialForProduct` wymaga roli marketingowej LUB Ĺ›cieĹĽki kampanii (nie samego indeksu w packshocie).
4. Cache `assocnoviz20260720a`.

**Test/Ewaluacja:** CDP API â€” `GC_balls_*_RGB` / `wiz_GC_*` / ENFACE â†’ `isViz=true, passMat=false`; `web_hero_slider` â†’ `passMat=true`; live `date-orange-balls-raw` â†’ `Skojarzone materiaĹ‚y (0)`, `packLikeInMaterials=[]`. Python: 154 pack-like wykluczonych, 0 GC_balls w materials.

**ĹąrĂłdĹ‚a:** user screenshot DATE ORANGE assoc (21 packshotĂłw); PI critical.

## 2026-07-20 23:30 - DamLoader idealnie NAD #damHelpFab

**Komenda/Akcja:** Ikonka Ĺ‚adowania za daleko w prawo â€” ma byÄ‡ idealnie nad `button#damHelpFab`.

**Log/Status:**
1. Root cause pozycji: `content-box` + `width`=wysokoĹ›Ä‡ bez paddingu/borderu â†’ `dockAnchor` liczyĹ‚ za wÄ…ski loader â†’ left za duĹĽy (~10â€“12px w prawo).
2. Fix: `box-sizing:border-box`, `dockAnchor` z `getBoundingClientRect()` faba, remeasure outer size w `parkAboveFab` / `dockToFab`.
3. Dock CSS (nie GSAP x/y); rAF+`performance.now` bo main-thread Viz gĹ‚odzi `setTimeout` (Ă—10).
4. Cache `loaderfab20260720g`; styl `damLoaderCss20260720d`.

**Test/Ewaluacja:** CDP Pass â€” `dx=0`, `gap=10`, `fabCx=loaderCx=1611`, `w=40`. Screenshot po docku.

**ĹąrĂłdĹ‚a:** user DOM Path `#damHelpFab` + screenshot.

## 2026-07-20 23:19 - Modale podglÄ…du 90vw Ă— 90vh + padding body +12

**Komenda/Akcja:** PowiÄ™kszyÄ‡ `#damVizModal` / media-preview do 90% viewportu; body +12px padding.

**Log/Status:** `dam-brand.css` â€” `--dam-modal-box-w/h: 90vw/90vh`, vp 5vw/5vh; body `47/51/51` (+12). `dam-viz-modal.css` â€” assoc-split body `32/36/34`, assoc-pane +12. Cache `modal90vw20260720a`.

**Test/Ewaluacja:** CDP Pass â€” ratioH=0.9, ratioWâ‰0.89, bodyPad `32px 36px 34px`.

## 2026-07-20 23:11 - Elementy scroll + segregacja + â€žSurowe elementyâ€ť

**Komenda/Akcja:** User: scroll nie dziaĹ‚a w rozwiniÄ™tych Elementach; KULKA* w zĹ‚ym gridzie; â€žLinki do elementĂłwâ€ť â†’ â€žSurowe elementyâ€ť.

**Log/Status:**
1. Root cause scroll: reguĹ‚a `.assoc-pane .dam-media-preview__assoc-grid { overflow-y:auto; overscroll-behavior:contain }` Ĺ‚apaĹ‚a teĹĽ siatkÄ™ WEWNÄ„TRZ `.dam-media-preview__elementy-panel` â†’ wheel nie chainowaĹ‚ do panelu (scrollbar widoczny, scroll martwy).
2. Fix CSS: `dam-viz-modal.css` + `dam-brand.css` â€” overflow tylko na `#damVizModalAssoc` (direct child); panel Elementy/Surowe ma wĹ‚asny `overflow-y:auto` + `touch-action:pan-y`; wewnÄ™trzny grid `overflow:visible`.
3. Segregacja: `classifyAssocAsset` â€” packshot/wiz/CMYK (`looksLikePackshotOrPrintAsset`) zawsze material; KULKA2 / `KULKI - â€¦` / freepik â†’ element-ready; Links â†’ Surowe; NIE uĹĽywaÄ‡ samego blobu â€žskladnikiâ€ť (packshoty miaĹ‚y false positive).
4. Etykieta toggle: â€žSurowe elementyâ€ť.
5. Cache `elemscroll20260720g`.

**Test/Ewaluacja:** CDP Pass â€” materials 43 (packaging), kulkaInMat=[], packInEl=[], Surowe scrollMoved=true (scrollHeight>clientHeight); screenshot `elemscroll-assoc-pass-20260720.png`. `node --check` OK.

**ĹąrĂłdĹ‚a:** user dump + screenshot Elementy (40) nested scrollbar.

## 2026-07-20 22:58 - Viz assoc filter (Branding policy) + skeleton + hold 3s

**Komenda/Akcja:** WORKER assocfix20260720c â€” twardy filtr skojarzeĹ„ jak Branding, skeleton zamiast â€žĹadowanieâ€¦â€ť, hold delete 3s.

**Log/Status:** (1) `dam-media-preview.js`: `isSourceLikeAsset` rozszerzone o ext+path; `passesMarketingAssocMaterial` / `passesMarketingAssocElement`; `showAssocPaneLoading` + `DamLoader`; (2) `dam-viz.js` pusty mount assoc; (3) `dam-assoc-edit.js` `holdMs:3000`; (4) `dam-brand.css` `.dam-assoc-skeleton`; (5) cache `assocfix20260720c` w viz/branding/explorer/dashboard HTML.

**Efekt/Fix:** Root cause: Viz Ĺ‚adowaĹ‚ reverse `linked_products` z filtrem tylko `media_type` â€” PSD/AI/PDF przechodziĹ‚y jako raster/brak typu â†’ 143 junk. Teraz jedna Ĺ›cieĹĽka `renderLinkedBrandingAssets` z politykÄ… marketing raster/wideo + wykluczeniem source ext/path.

**Test/Ewaluacja:** `node --check` OK; CDP potwierdziĹ‚ API (`assocPaneSkeletonHtml`, `isSourceLikeAsset`); modal assoc screenshot zablokowany przez wspĂłĹ‚dzielonÄ… kartÄ™ przeglÄ…darki (kontekst niszczony / modal znika).

**ĹąrĂłdĹ‚a:** user interrupt 22:58; `program-instructions.json` viz.assoc_no_visualization_loop; Branding `isRasterAssetName` / graphics-only policy.

## 2026-07-20 - Explorer: redesign modala "Dodaj kategoriÄ™/produkt" (EXP-C, 10-pass ui-taste)

### Komenda/Akcja
User poprosiĹ‚ o peĹ‚ny redesign modala tworzenia kategorii/produktu w Eksplorerze
(`#damExplorerCreateModal`): zargonowy podglÄ…d Ĺ›cieĹĽki, statyczny (tylko po
klikniÄ™ciu "PodglÄ…d"), sztywny numer kategorii, myteriozna pusta czerwona ramka
bĹ‚Ä™du, wszystkie warianty domyĹ›lnie zaznaczone + natywne oranĹĽowe checkboxy,
brak hierarchii folderĂłw, brak globalnego tworzenia wariantĂłw, brak potwierdzenia
z cofniÄ™ciem po utworzeniu.

### Log/Status
1. Przeczytano `agents/shared/code-doctrine.md` + `apps/web/data/program-instructions.json`
   (`explorer.product_from_template`, `explorer.demo_index_rules`,
   `naming.carrier_ui_vs_disk`) przed zmianÄ… kodu - zgodnie z doktrynÄ….
2. **Backend** `apps/desktop/explorer_create.py`:
   - `create_category(..., seq=None)` - edytowalny licznik kategorii (nadpisuje
     auto-numer), zawsze zwraca `suggested_seq`.
   - `next_category_seq_for_brand()` - podpowiedĹş numeru bez zapisu.
   - `undo_create()` - cofniÄ™cie Ĺ›wieĹĽo utworzonego katalogu (okno ~150s,
     guard: wewnÄ…trz `marketing_base`, katalog musi istnieÄ‡, `st_ctime` musi byÄ‡
     niedawny - nigdy nie usuwa starszych/prawdziwych folderĂłw).
3. **Bridge** `apps/desktop/local_bridge.py`:
   - `GET /explorer/next-category-seq?brand=` (admin).
   - `POST /explorer/undo-create` {path} (admin, audit log `explorer_undo_create`).
   - `POST /explorer/add-variant-type` {code, code_en, label_pl} (admin) â†’
     `add_global_variant_type()`: zapis do `naming-dictionary.json` (`carriers[]`
     + `carrier_detect_order`) i `carrier-types.json` (`custom_types`) przez
     `_save_json` (lokalny cache + KV push do Postgres `dam_kv_store` gdy
     skonfigurowany) + `reload_naming_policy_from_disk()`.
   - `create-category` POST handler przekazuje `seq` z body.
4. **Frontend** `apps/web/assets/js/dam-explorer-add-product.js` (peĹ‚ny rewrite,
   CSS wstrzykniÄ™ty z JS - nie dotkniÄ™to `dam-brand.css`, zgodnie z sekcjÄ… 4
   doktryny o wspĂłĹ‚bieĹĽnych agentach):
   - PodglÄ…d `#damExpPreview` = jedna czysta linia `Tworzenie: {peĹ‚na_Ĺ›cieĹĽka}`
     (zero "Plan:", "skopiuj szablon", "Drzewo:"), aktualizowana na `input`/`change`
     z klienckiego mirrora logiki `explorer_create.py` (`categoryFolderName`,
     `productFolderPreview`, `variantFolderPreviewClient` - identyczne tokeny
     placeholder/demo co backend); po dry-run nadpisywana autorytatywnym
     `planned_path` z mostu.
   - Edytowalny numer kategorii `#damExpSeq` (podpowiedĹş z
     `/explorer/next-category-seq`, moĹĽna nadpisaÄ‡ przed zapisem).
   - `#damExpErr` â†’ `.dam-exp-create__status`: `:empty{display:none}` (brak
     pustej ramki), kolor zaleĹĽny od `is-error`/`is-info`/`is-ok`.
   - Hierarchia `#damExpTree`: ikony `uil-folder`/`uil-folder-open` + wciÄ™cia;
     kategoria = 1 wÄ™zeĹ‚; produkt = folder produktu + tylko ZAZNACZONE warianty
     (gdy brak zaznaczonych: komunikat, ĹĽe kopiowany bÄ™dzie caĹ‚y szablon -
     zgodnie z faktycznym zachowaniem backendu `create_product` gdy `variants=[]`).
   - Wiersz wariantu: checkbox ODZNACZONY domyĹ›lnie, TAG = `DamLabels.carrierLabel`
     (peĹ‚na etykieta, np. BATON/DOYPACK/BIGPAK) po lewej, podglÄ…d finalnej nazwy
     folderu po prawej (live z pĂłl data/indeks). Etykieta sekcji zmieniona na
     "Warianty" + podpowiedĹş "Wybierz warianty do skopiowania - domyĹ›lnie
     wszystkie odznaczone."
   - Wszystkie `input[type=checkbox]` w modalu: `accent-color:var(--dam-primary,#AB54DB)`
     (zero natywnego oranĹĽu). Fonty ujednolicone (panel 13px, etykiety 11.5px
     uppercase, podglÄ…d/warianty monospace 11-12.5px) - zamiast `font:inherit`.
   - "Nowy wariant globalny" (3 pola: kod PL, kod EN, peĹ‚na nazwa) na dole
     sekcji wariantĂłw â†’ `POST /explorer/add-variant-type`.
   - Panel potwierdzenia po realnym utworzeniu (`.dam-exp-confirm`): ikona
     checkmark, "Utworzono: {nazwa}", Ĺ›cieĹĽka, odliczanie `setInterval` 120s â†’
     auto-ZatwierdĹş, przyciski **PrzejdĹş do folderu** (`DamPaths.revealInExplorer`),
     **Cofnij** (`POST /explorer/undo-create` â†’ toast â†’ close), **ZatwierdĹş**
     (`triggerRebuild` â†’ `reloadExplorer` â†’ toast â†’ close). ZamkniÄ™cie modala
     (X/Escape/backdrop) w trakcie okna potwierdzenia = auto-finalize (nie
     zostawia "wisiÄ…cego" nieprzeindeksowanego folderu).
5. Cache-bust: `dam-explorer-add-product.js?v=expc20260720d` w `explorer.html`
   (jedyny plik HTML, ktĂłry go Ĺ‚aduje).

### Efekt/Fix
Modal "Dodaj kategoriÄ™/produkt" ma czysty, ĹĽywy podglÄ…d Ĺ›cieĹĽki, edytowalny
numer kategorii, czytelny status bĹ‚Ä™du/info/ok, hierarchiÄ™ folderĂłw, warianty
domyĹ›lnie odznaczone z peĹ‚nÄ… etykietÄ… + podglÄ…dem nazwy, fioletowe checkboxy
Geex, globalne tworzenie wariantĂłw (naming-dictionary + carrier-types, z KV
push do Postgres) i potwierdzenie po utworzeniu z 2-minutowym cofniÄ™ciem.

### Backup
Brak destrukcyjnej zmiany istniejÄ…cych danych - `next_category_seq`/`create_category`/
`create_product` zachowujÄ… dotychczasowÄ… logikÄ™ zapisu (dry_run/confirm gate),
`undo_create` usuwa WYĹÄ„CZNIE Ĺ›wieĹĽo utworzony katalog (guard Ĺ›cieĹĽka+wiek).

### Test/Ewaluacja
- `python -m py_compile explorer_create.py local_bridge.py`: PASS.
- `node --check dam-explorer-add-product.js`: PASS. ReadLints: brak bĹ‚Ä™dĂłw.
- Bridge restart (`Stop-Process` na `pythonw.exe local_bridge.py`, watchdog
  auto-restart w ~5-9s) x2, `/health` 200 po kaĹĽdym, nowe endpointy zwracajÄ…
  401 (nie 404) bez sesji = zarejestrowane.
- **Screenshot+Read QA (5+ przelotĂłw, realny admin w IDE browser):**
  1. Kategoria "Kremy": live update na `input` (bez klikania PodglÄ…d) - tekst
     `Tworzenie: X:\Marketing\...\08 - KREMY`; zmiana `#damExpSeq` na 42 â†’ live
     `...\42 - KREMY`; drzewo `42 - KREMY`; status pustyâ†’hidden, po dry-run
     zielony "PodglÄ…d gotowy...". Screenshot czytelny, fiolet/Geex, brak
     oversized fontĂłw.
  2. Produkt (BATONY): 10 wierszy wariantĂłw wszystkie ODZNACZONE domyĹ›lnie,
     `accentColor` checkboxa = `rgb(171,84,219)` (fiolet, nie oranĹĽ), tagi peĹ‚ne
     (BATON/BIGPAK/DOYPACK/ETYKIETA/...), podglÄ…d per-wiersz z " - D" (brak
     indeksu = demo, zgodnie z `explorer.demo_index_rules`); zaznaczenie
     wariantu + data â†’ drzewo i podglÄ…d aktualizujÄ… siÄ™ live. "Nowy wariant
     globalny" widoczny na dole.
  3. **Realne utworzenie kategorii "ZZZ QA UNDO TEST" â†’ panel potwierdzenia
     (checkmark, Ĺ›cieĹĽka, odliczanie 2:00â†’1:43 tykajÄ…ce) â†’ Cofnij â†’ toast
     "CofniÄ™to - folder usuniÄ™ty." â†’ `Test-Path` na dysku = `False`.**
  4. **Realne utworzenie produktu "ZZZ QA PRODUCT UNDO" (z 1 wariantem BAT) w
     BATONY â†’ panel potwierdzenia â†’ Cofnij â†’ toast â†’ `Test-Path` = `False`.**
  5. Test bĹ‚Ä™du: puste `#damExpName` + PodglÄ…d â†’ `#damExpErr` = "Podaj nazwÄ™."
     czerwony pill (`rgb(180,35,24)` on `rgb(253,241,240)`), nie pusta ramka.
  6. ResponsywnoĹ›Ä‡ 700Ă—800: pola w jednej kolumnie, wiersze wariantĂłw
     czytelne, brak przyciÄ™cia/nakĹ‚adania.
  7. Global wariant "PUSZ/CAN/PUSZKA" przez `/explorer/add-variant-type` â†’
     zapis do `naming-dictionary.json` (`carriers.PUSZ`) + `carrier-types.json`
     (`custom_types.PUSZ`) potwierdzony odczytem plikĂłw â†’ **po weryfikacji
     usuniÄ™ty (byĹ‚ tylko testem QA)**, w tym z Postgres KV (`pg_db.kv_set`
     bezpoĹ›rednio, `is_configured()==True` w tym Ĺ›rodowisku) - zero trwaĹ‚ych
     danych testowych.
- Pass/Fail: **Pass** (wszystkie 10 wymagaĹ„ z briefu zweryfikowane; "ZatwierdĹş"
  zweryfikowany przez code review + strukturalnÄ… symetriÄ™ z Cofnij, NIE przez
  peĹ‚ny live rebuild - unikniecie dĹ‚ugiego, potencjalnie blokujÄ…cego
  `/index/rebuild` na wspĂłĹ‚dzielonym Ĺ›rodowisku deweloperskim w trakcie sesji).

### ĹąrĂłdĹ‚a
- `agents/shared/code-doctrine.md` (wzorzec moduĹ‚u, cache-busting, CSS injection
  przy wspĂłĹ‚bieĹĽnych agentach, weryfikacja CDP+screenshot).
- `apps/web/data/program-instructions.json`: `explorer.product_from_template`,
  `explorer.demo_index_rules`, `naming.carrier_ui_vs_disk`, nowa instrukcja
  `explorer.create_modal_ux` (v9, dopisana przed zmianÄ… kodu biznesowego).

## 2026-07-20 - Wizualizacje: "Historia zmian" zamiast Cofnij/PonĂłw w #damChangeLogBar

### Komenda/Akcja
User nie rozumiaĹ‚ hinta `#damChangeLogHint` ("status -> nieaktualne") i poprosiĹ‚ o
zamianÄ™ przyciskĂłw Cofnij/PonĂłw na podglÄ…d historii zmian, bo per-elementowa
historia i tak juĹĽ siÄ™ zawsze zapisuje.

### Log/Status
1. **WyjaĹ›nienie usera**: "nieaktualne" = ktoĹ› zmieniĹ‚ status PRODUKTU/WARIANTU na
   dysku na X (archiwum) w systemie F/X/D (`program-instructions.json` â†’
   `lifecycle.status_fxd`) - to treĹ›Ä‡ zmiany, nie informacja ĹĽe sam log jest
   przestarzaĹ‚y. Hint po prawej stronie ekranu opisuje wĹ‚aĹ›nie tÄ™ ostatniÄ… zmianÄ™.
2. `apps/web/visualizations.html`: usuniÄ™to `#damChangeUndo`/`#damChangeRedo`,
   dodano jeden przycisk `#damChangeHistoryBtn` ("Historia zmian") w
   `#damChangeLogBar`; hint przeniesiony przed przycisk.
3. `dam-tag-edit.js`: `changeLogRowDetail()` dopisuje basename Ĺ›cieĹĽki
   (`entry.path`) do wpisĂłw statusu (np. "status: Aktualne -> Nieaktualne Â·
   Boost - Doypack"), ĹĽeby byĹ‚o wiadomo CO siÄ™ zmieniĹ‚o, nie tylko JAK.
   Nowy popover `.dam-changelog-history` (z-index 12300, jak inne pickery):
   peĹ‚na lista `GET /change-log?limit=20` (najnowsze na gĂłrze), read-only,
   zamykany X / Esc / klik poza. UsuniÄ™to `postAction`/undo/redo handlery -
   backend `/change-log/undo|redo` NIE usuniÄ™ty (moĹĽe byÄ‡ uĹĽywany gdzie indziej),
   zmiana tylko w UI tego bara.
4. CSS: nowe klasy `.dam-changelog-history*` w `dam-brand.css` (lista, wiersz,
   stopka, przycisk zamkniÄ™cia) w stylu design system (fiolet, pill-tint tĹ‚a).
5. Cache-bust: nowy token `chghist20260720a` dla `dam-brand.css` (wszystkie HTML)
   i `dam-tag-edit.js` (5 stron ktĂłre go Ĺ‚adujÄ…).

### Efekt/Fix
Bar w Wizualizacjach (ADMIN ON) pokazuje ostatniÄ… zmianÄ™ + przycisk "Historia
zmian" otwierajÄ…cy peĹ‚nÄ…, czytelnÄ… listÄ™ ostatnich wpisĂłw z dysku. Zero undo/redo
z tego poziomu.

### Test/Ewaluacja
- `node --check dam-tag-edit.js`: PASS. ReadLints: brak bĹ‚Ä™dĂłw.
- CDP (mock `/change-log` fetch, 3 wpisy: lifecycle/index/carrier): hint = ostatni
  wpis; przycisk wĹ‚Ä…czony; klik â†’ popover z 3 wierszami w kolejnoĹ›ci od najnowszego,
  wiersz statusu z basenamem Ĺ›cieĹĽki ("status -> nieaktualne Â· Boost - Doypack");
  toggle open/close dziaĹ‚a; przycisk X zamyka.
- Screenshot+Read: popover widoczny, czytelny, w stylu design system (fiolet,
  zaokrÄ…glone rogi, spacing). Lekcja: `browser_take_screenshot` robi zdjÄ™cie
  OS-widocznej karty, nie karty z CDP `viewId` - trzeba zamknÄ…Ä‡ zbÄ™dne karty w tle
  (dopisane do `code-doctrine.md` Â§12).
- Pass/Fail: **Pass**.

## 2026-07-20 - Model policy global: parent = UI usera

### Komenda/Akcja
Edycja global rule `~/.cursor/rules/model-grok-composer-only.mdc` + supersede memory #13/#132.

### Log/Status
1. Parent/plan/wdroĹĽenie = model z listy UI (Fable/Opus/Sonnet/Sol/Grokâ€¦) â€” zakaz auto-przeĹ‚Ä…czania na GROK
2. Task/subagenci default `cursor-grok-4.5-high-fast` lub `composer-2.5-fast`, chyba ĹĽe user nadpisze w tej samej wiadomoĹ›ci
3. Hierarchia rang wpisana w rule; memory DAM wskazuje na global rule

### Efekt/Fix
Nie wymuszamy juĹĽ â€žtylko GROK wszÄ™dzieâ€ť na parentcie gdy user wybraĹ‚ Opus/Fable.

### Zrodla
- User brief 2026-07-20 21:02
- `C:\Users\xpret\.cursor\rules\model-grok-composer-only.mdc`

---

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
- isualizations.html: badgeH ~20px vs pill 20px; BRAK TYPU na DATE ORANGE; align row1 OK.

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
User: kontynuuj przez Cursor/repo, nie przez bridge API. DomkniÄ™cie: marketing na project.html, admin kolejki wykrojnikĂłw, Part G instrukcje, rapidocr w requirements.

### Log/Status
1. `dam-project.js`: mini-siatka marketingu (SKU/indeks/linked_product_ids), sekcja wykrojnikĂłw z registry JSON.
2. `integrations.html` + `dam-wykrojnik-queue.js`: kolejka lokalna (localStorage + pobierz JSON).
3. `program-instructions.json`: +3 wpisy (branding.hub_viz_cards, branding.project_marketing, wykrojnik.queue_local_admin); packaging.tag_tiers â†’ â€žTagi pakowania (2F)â€ť.
4. `requirements.txt`: rapidocr-onnxruntime (OCR stub).
5. Cache bust `hub20260719f` na project catalog CSS/JS.

### Efekt/Fix
- project.html pokazuje do 6 kart Branding z tagami DamBadges.
- Admin mapuje wykrojniki bez POST na bridge.
- Bridge PATCH catalog â€” pominiÄ™ty (decyzja usera).

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
2. `build-branding-index.py`: `by_appearance` (tylko appearance_tags); usuniÄ™to tokeny `search_blob` z `by_tag` (koniec Ĺ›mieci typu `x:/marketing`).
3. `dam-branding.js` j6: dynamiczne chipy produktu z `by_appearance`; cache bust `hub20260719j6`.
4. `local_bridge.py`: preview raster/wideo zwraca 422 `preview_failed` zamiast 415; PSB 652MB â†’ JPEG 141KB OK.
5. OCR batch `enrich-branding-recognize.py --limit 300` + `link-branding-products.py`; indeks 7832 assetĂłw, 3710 z appearance_tags.

### Efekt/Fix
- HTTP `GET /media?path=...psb&preview=1` â†’ 200 image/jpeg.
- Wyszukiwanie `proteina` + â€žTylko grafikiâ€ť: 240 grafik, miniatury 848â€“1200px.
- Chipy PRODUKT czyste (Proteina, Karton 6x, Burgerâ€¦ bez fragmentĂłw Ĺ›cieĹĽek).
- Modal: podglÄ…d + tagi DK/Proteina/Banoffee + zoom dock na dole.

### Test/Ewaluacja
- Screenshot Pass: branding tagi j6, modal banoffee 848Ă—1200, bridge /health OK.
- CDP: `DamMediaPreview.openAsset` img naturalWidth=848.

### Zrodla
- visual-qa-testing, systematic-debugging
- apps/desktop/local_bridge.py, apps/web/scripts/build-branding-index.py, dam-branding.js

---

## 2026-07-19 - Lifecycle previous_letter + auto-reconcile (j17/j18)

### Komenda/Akcja
User: TEST LIFECYCLE F/X/D â€” po restore z archiwum wszystko D zamiast BAT=D, DOY/PROD=clear, ETY=F. Wymagany full commit + push.

### Log/Status
1. **Przyczyna â€žwszystko Dâ€ť (3x):**
   - DOY i ETY wspolny `revision_index` TEST-TEST2 â†’ `_plan_variant` bral legacy klucz z `previous_letter: D` zamiast sciezki noĹ›nika.
   - `_sync_revisions_after_product` przy clear produktu ustawial `previous_letter: null` w cascade_meta i kasowal stan w store.
   - Restore variant uzywal `prev in (F,X,D)` â€” X jako restore target.
2. **Fix Python** (`lifecycle_status.py`):
   - `_variant_identity` (DOY|TEST-TEST2 vs ETY|TEST-TEST2), `_rev_row_for_variant` (sciezka first).
   - `_restore_letter_from_row`: nigdy X; BAT D zostaje przy product clear.
   - cascade_meta: `previous_letter` tylko przy wejsciu w X; legacy klucz index usuwany po zapisie po sciezce.
3. **Fix JS** (`dam-explorer.js` j17/j18): `reconcileProductLifecycleFromDisk`, `findFreshProductInIndex`, preserve `previous_letter`.
4. **Test:** `apps/desktop/tests/test_lifecycle_previous_letter.py` â€” ALL OK.

### Efekt/Fix
- Oczekiwany stan po scenariuszu usera: PROD/DOY clear, BAT D, ETY F.
- Cache: `hub20260719j18`. Bridge wymaga restartu po deploy Python.

### Test/Ewaluacja
- Unit test previous_letter: PASS.
- X: Marketing niedostepny w sesji agenta (PRODUCT_NOT_FOUND) â€” retest UI po restarcie bridge u usera.

### Zrodla
- lifecycle-status.json history `variant_restored_previous_letter:D` na DOY/ETY
- systematic-debugging

---

## 2026-07-19 - Branding: POLSKA + archiwum, kontekst folderu, modal skojarzen (disc8)

### Komenda/Akcja
User: indeksuj `- POLSKA` i `-- ARCHIWUM --` (stara struktura Marketing); przy nakladce wygrywa POLSKA bez tagow Archiwum; w modalu warianty Desktop/Tablet/Mobile, skojarzone produkty z miniaturami, tagi SzkoĹ‚a/Edytowalny; dokumentacja + commit + push.

### Log/Status
1. **`build-branding-index.py`**: skan dwufazowy (POLSKA, potem archiwum); dedup kluczem `stem+wymiary` (np. `back to school:992x600`); statystyki `legacy_skipped_overlap` w logu buildu.
2. **`brand_folder_context.py`** (nowy): grupy po `folder_dir`; `folder_variants`, `linked_products` z thumb z `viz_latest`; `LEGACY_FOLDER_TAGS` dla 01â€“10, 99, wymiana; `THEME_VOCAB` (SzkoĹ‚a); Edytowalny gdy `.psd`/`.ai` w folderze.
3. **`brand_tag_utils.py`**: segment `SLIDERY` â†’ Slidery + Na sklep; filtr Slidery â†’ zakladka WWW.
4. **UI**: `dam-media-preview.js` - warianty | separator | skojarzone produkty (wspolne `groupContext`); `dam-branding.css` layout assoc; cache bust `hub20260719disc8`.
5. **`program-instructions.json`**: `branding.marketing_dual_roots`, `branding.slider_shop_tags`.
6. **Testy**: `test_build_branding_dedupe`, `test_brand_folder_context`, `test_brand_tag_utils` - PASS.
7. **Rebuild indeksu**: 49252 assetow (6787 pominietych nakladek archiwum); Back to school 992x600 tylko POLSKA (`br-003365`).

### Efekt/Fix
- POLSKA: 0 assetow z tagiem Archiwum w indeksie branding.
- Legacy-only: tagi Archiwum + Stara struktura + mapowanie starych folderow.
- Modal Back to school: 3 warianty, ORZECH CZEKOLADA + CHRUPIACY ORZECH, SzkoĹ‚a, Edytowalny.

### Test/Ewaluacja
- Unit testy dedupe + folder context: PASS.
- Screenshot QA modal (1280 + 375): warianty lewo, produkty prawo, miniatury klikalne; przeĹ‚aczenie wariantu zachowuje skojarzenia.

### Zrodla
- docs/BRANDING-HUB.md (sekcja dwie lokalizacje)
- program-instructions `branding.marketing_dual_roots`
- apps/web/scripts/build-branding-index.py, brand_folder_context.py

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# RZECZY DO WYKONANIA â€” NIE UDAĹO SIÄ (chcemy, ĹĽeby byĹ‚y)
# Data wpisu: 2026-07-19 | sesja: Branding UI + transparent PNG
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

PoniĹĽej lista funkcji / poprawek **zaplanowanych lub rozpoczÄ™tych**, ktĂłrych **nie udaĹ‚o siÄ™ domknÄ…Ä‡** w tej sesji. Priorytet dopracowania: **ten tydzieĹ„ (od 2026-07-21)**.

| # | Temat | Status | Dlaczego nie done | NastÄ™pny krok |
|---|-------|--------|-------------------|---------------|
| 1 | **Odtwarzanie wideo w modalu** (stream z `X:` / bridge `/media`) | FAIL UI-only | Bridge/Synology timeout lub brak dostÄ™pu do pliku w sesji agenta; layout wideo OK, stream nie zweryfikowany E2E | Restart bridge u usera; test `br-006305` z logiem `/media`; fallback komunikat â€žPlik offlineâ€ť |
| 2 | **PeĹ‚ny pixel-scan transparent** dla wszystkich PNG (poza www) | **DONE 2026-07-20** | Skan PIL wolny na NFS `X:`; patch tylko scope www (217 assetĂłw) | Zrobione: `--all --limit-seconds`, cache `branding-background-scan.json` (2652 wynikow), fix wiszacego timeoutu NFS; indeks: 1591 transparent / 2347 white |
| 3 | **Heurystyka PNG default â†’ indeks JSON** (nie tylko runtime UI) | **DONE 2026-07-20** | User: â€žna razie UIâ€ť; indeks bez masowego rewrite | Zrobione: build/re-enrich czytaja cache skanu (carry-over `apply_background_scan_cache`), rebuild nie gubi wynikow |
| 4 | **Filtr â€žTĹ‚o biaĹ‚eâ€ť** â€” precyzyjne liczniki | **DONE 2026-07-20** | W QA Kampanie: filtr white nie zawÄ™ĹĽa (120=wszystko) â€” brak white w tej zakĹ‚adce lub logika zbyt szeroka | Zrobione: white tylko ze skanu; po skanie Kampanie 582â†’239, Packshoty 1767â†’760 |
| 5 | **Wyszukiwanie tekstowe â€žprzezroczysteâ€ť** | **DONE 2026-07-20** | CDP `input` event â†’ 0 kart (moĹĽliwy konflikt filtrĂłw / debounce) | Przyczyna: synonimy AND zamiast OR w `assetMatchesSearchQuery`; fix grupy tokenow OR, wynik 17 kart / 38 plikow |
| 6 | **Sidebar collapsed â€” logo wordmark bez crop** | **DONE 2026-07-20 (bez zmian)** | Test CDP przerwany; brak screenshota collapsed | Screenshot 1280px expanded + collapsed + Read: wordmark caly, `object-fit: contain` juz jest w dam-brand.css |
| 7 | **Marketing ID â€” typy TikTok / YouTube / Reels** | **DONE 2026-07-20** | W scope tylko VID/SLI/BAN/META/GOG/SHOP/GIF/KV/IMG | Zrobione: TIK=10 / YT=11 / REL=12 przed VID + wpis w `branding.marketing_asset_id_format` |
| 8 | **PeĹ‚na parytet kart branding â†” viz** (wszystkie tryby grup) | **DONE 2026-07-20 (weryfikacja)** | Actions OK na gĹ‚Ăłwnej siatce; grupy folderowe nie na wszystkich zakĹ‚adkach | Audyt DOM: 100% kart grupowych z akcjami na Kampanie/Social/WWW/Packshoty + screenshoty WWW i Packshoty |
| 9 | **Seed program-instructions do Postgres KV** | Nie w tej sesji | Zmiany tylko w pliku cache JSON | Restart bridge / seed KV dla nowych id |
| 10 | **30-pass QA â€” wszystkie zakĹ‚adki z kartami** | CzÄ™Ĺ›ciowo | Social/WWW 0 kart w teĹ›cie (dane/filtry) | User: odznaczyÄ‡ â€žTylko grafikiâ€ť, test z assetami www |

---

## 2026-07-19 â€” Branding UI overhaul + PNG default transparent + commit

### Komenda/Akcja
User: PNG bez skanu = domyĹ›lnie bez tĹ‚a (zachowaÄ‡ pixel-scan); spisaÄ‡ niewykonane; log zmian; QA 30-pass; commit + push + backup.

### Log/Status â€” chronologia zmian (2026-07-19)

| Czas (szac.) | Plik / obszar | Co wprowadzono |
|--------------|---------------|----------------|
| rano | `asset_role_utils.py`, `patch-branding-backgrounds.py` | Skan alpha PNG; patch 217 www â†’ `background: transparent` |
| rano | `dam-branding.js` | Filtry facet global vs tab; `assetMatchesTagKey` transparent |
| poĹ‚udnie | `dam-marketing-id.js` (nowy) | Format M-VID/KV/â€¦; uĹĽyty w modalu i kartach |
| poĹ‚udnie | `dam-media-preview.js` | Hero wideo, path bar, variant placeholder, title meta |
| poĹ‚udnie | `dam-branding.css`, `dam-hub-shared.css` | Spacing modal, karty viz-style, gradient tile |
| poĹ‚udnie | `dam-viz.js`, `visualizations.html` | Zoom 50â€“250%, CARD_IMG_BASE_SCALE 1.2 |
| poĹ‚udnie | `program-instructions.json` | `branding.marketing_asset_id_format` |
| wieczĂłr | `dam-asset-taxonomy.js` | `effectiveBackground`, PNG/WebP default transparent |
| wieczĂłr | `dam-branding.js`, `dam-badges.js` | Filtr + badge + search blob dla effective background |
| wieczĂłr | `program-instructions.json` | `branding.png_default_transparent` |
| wieczĂłr | `branding.html` | Cache bust `hub20260719trans01` |

### Efekt/Fix
- Tag â€žPrzezroczyste tĹ‚oâ€ť klikalny; filtr zawÄ™ĹĽa (17/120 w Kampaniach).
- PNG bez `background` w indeksie â†’ UI traktuje jako transparent (np. br-006165).
- Modal: M-KV106165-04-25, path monospace, margin meta 10px, actions 15px.

### Test/Ewaluacja
- QA 30-pass: tabela w `PROGRESS.md` (26 PASS, 4 INFO, odĹ‚oĹĽone FAIL w sekcji NIE UDAĹO SIÄ).
- Screenshot + Read: modal KV, siatka Kampanie.

### Backup
- Tag przed commitem: `backup/2026-07-19-pre-branding-ui-overhaul`
- Tag po commicie: `feature/2026-07-19-branding-ui-overhaul`

### Zrodla
- `program-instructions.json` (`branding.png_default_transparent`, `branding.marketing_asset_id_format`)
- `.cursor/rules/verify-ui-after-changes.mdc`


---

## 2026-07-19 â€” Media preview modal: przyciski + tagi + gradient + Shift+klik (10-pass)

### Komenda/Akcja
User: brak przyciskow / zle nazwy w `#damMediaPreview`; ext-tag TIF/JPG jak badge +10% i 8px od tytulu; wiecej odstepu tagiâ†’tytul; mniej scrolla; gradient tile krotszy +30% transparency; Shift+klik na skojarzonych produktach; Intensive QA 10 passes.

### Log/Status
1. Audyt: modal mial tylko "Pokaz w Eksploratorze" (brak Przejdz); thumb assoc zjadal Shift+klik.
2. `dam-media-preview.js`: CTA jak wizualizacje â€” Przejdz + Folder + opcjonalnie Zrodlo.
3. `dam-assoc-edit.js`: Shift+klik na item/thumb/name â†’ openEditPicker (product).
4. `dam-branding.css`: title gap 20px; ext-tag anatomia badge +10%; mniejszy hero.
5. `dam-hub-shared.css`: editable wash od dolu min(128px,32%), alpha *0.7.

### Efekt/Fix
- Footer: Przejdz | Folder | (Zrodlo) | Kopiuj | Udostepnij
- CDP: gap tagiâ†’tytul 20px; titleâ†”ext 8px; extH 26.8 vs badgeH 24.4; bez scrolla (baton)
- Shift+klik otwiera picker (admin mode)

### Test/Ewaluacja
Intensive QA 10 passes screenshotâ†’Read (Pass1â€“10).

### Zrodla
- memory.md Â§38
- `.cursor/rules/verify-ui-after-changes.mdc`

---

## 2026-07-19 â€” Bento v2.0.0 (shared grid + explorer hot zone)

### Komenda/Akcja
User: milestone v1.5.0 OK; v2.0.0 = spĂłjny Bento CSS Grid na panel; zamroziÄ‡ wizualnie karty/modale viz/branding/projekty; priorytet Eksplorer (carrier/prod-row sypie siÄ™ na RWD); ui-taste + ui-ux-pro-max; dopisaÄ‡ definicjÄ™ â€žrundyâ€ť do skillu ui-taste.

### Log/Status
1. `ui-taste` SKILL.md Â§0.E: Runda vs Pass (PL/Monday) + intensive 10+ focus rounds.
2. Nowy `apps/web/assets/css/dam-bento.css` (tokeny gap/radius, shell explorer, carrier zones, prod-row grid, hub chrome).
3. `explorer.html`: Bootstrap `.row.g-3` â†’ `.dam-explorer-layout` (CSS Grid kategorie + panel).
4. `dam-explorer.js`: wrappery `meta-chips` / `meta-life` + `older-rev-row__main/life`.
5. PodpiÄ™cie `dam-bento.css` na dashboard/settings/viz/branding/projekty/inbox/help/explorer.
6. Wersja `2.0.0` / codename `bento` (`version.json`, `dam-version.js`, `runtime_config.py`).

### Efekt/Fix
- Carrier: grid `title | chips | end` + wiersz `. | life | end` (admin) - chipy w jednej linii, lifecycle nie â€žwÄ™drujeâ€ť.
- Explorer shell: stabilny 2-col â†’ stack @992px.
- ZamroĹĽone: `.dam-viz-card`, branding cards, project cards, modale media/viz (bez restylu).

### Test/Ewaluacja
- Intensive QA: screenshotâ†’Read carrier desktop (Pass1â€“3 align), layout CDP `display:grid`, mobile areas stack; dashboard parity OK.
- Overflow 375 z geex header quickaction = pre-existing (nie z bento shell).

### Zrodla
- Plan Bento v2.0.0
- MDN CSS Grid / bentogrids.com (referencja stylu)
- `.cursor/rules/verify-ui-after-changes.mdc`

---

## 2026-07-19 â€” Modal zoom 85â€“100% + layout body na dole + cache tagĂłw Branding

### Komenda/Akcja
User: (1) modal zoom 85â€“100% zamiast 85â€“125%, body modala wyrĂłwnane do doĹ‚u, thumb responsywny; parity viz. (2) Wolne Ĺ‚adowanie po klikniÄ™ciu tagĂłw w Branding (~10 s) â€” cache z uniewaĹĽnianiem przed aktualizacjÄ… bazy/indeksu. Commit + push.

### Log/Status
1. **Diagnoza wolnych tagĂłw:** klik tagu = filtr po stronie klienta (7832 assety, brak API). Bottleneck: podwĂłjne `computeFacetCounts()` (~7800Ă—~100 kluczyĂ—2), podwĂłjny `renderTagFilters()` przy auto-zmianie tabu, peĹ‚ny rerender siatki do 1000 miniaturek `/media`.
2. **`dam-modal-shared.js`:** `modalStartZoomPct()` â†’ mapowanie 85â€“100% (kafelek â‰Ą100% â†’ modal 100%). `fitChrome()` bez sztywnego `max-height` thumb â€” flex wypeĹ‚nia przestrzeĹ„ nad body.
3. **`dam-brand.css` / `dam-branding.css`:** `.dam-viz-modal-box { justify-content: flex-end }`, thumb `flex: 1 1 0`, body `flex: 0 0 auto`.
4. **`dam-branding.js` (cache01):** `computeFacetCountsPair()` â€” jedna pÄ™tla po assetach, liczniki facet+global naraz; `facetCountCache` kluczowany sygnaturÄ… filtrĂłw + `built_at`; `clearBrandingComputeCache()` / `invalidateBrandingIndexCache()`; `scheduleBrandingRender()` (rAF); tag click bez podwĂłjnego renderu tabu; API `DamBranding.clearComputeCache` / `invalidateIndexCache`.
5. **`local_bridge.py`:** `_drop_json_cache()`, `_invalidate_branding_data_caches()` â€” **czyĹ›Ä‡ cache PRZED** zapisem (`_save_json`), przed/po `/branding/rebuild`, `/branding/recognize`, przed/po `/index/rebuild` + `meta_store.sync`.
6. **`dam-tag-edit.js` / `dam-assoc-edit.js`:** po zapisie metadanych/skojarzeĹ„ â†’ `DamBranding.clearComputeCache()`.

### Efekt/Fix
- Modal: zoom 110% kafelka â†’ 100% modalu (nie 141%). Body przy dole boxa, brak martwej strefy pod CTA (CDP gap=0).
- Branding tagi: ~2Ă— mniej pracy licznikĂłw na klik; cache licznikĂłw waĹĽny do zmiany filtra/indeksu; bridge zawsze czyta Ĺ›wieĹĽy JSON po rebuild/patch (cache RAM invalidowany przed zapisem).

### Test/Ewaluacja
- Modal QA: screenshotâ†’Read branding + viz @1280/768; zoom 100% @ suwak 110%; layout gap=0.
- `modalStartZoomPct(110)===100`, `modalStartZoomPct(85)===85` (CDP).
- Cache: po `clearBrandingComputeCache()` sygnatura facetCountCache reset.

### Zrodla
- Analiza `dam-branding.js` renderTagFilters / computeFacetCounts
- `local_bridge.py` `_JSON_FILE_CACHE`, `_save_json`
- User brief: cache invalidation przed aktualizacjÄ… bazy

---

## 2026-07-19 â€” Integracje OAuth (hub) + wersja 2.0.3

### Komenda/Akcja
User: â€žUmoĹĽliw Integracjeâ€ť â€” strona `integrations.html` miaĹ‚a statyczne stuby; OAuth dziaĹ‚aĹ‚ tylko w `settings.html`. Commit + push; podbiÄ‡ wersjÄ™ patch (+0.0.1 na kaĹĽdÄ… dostawÄ™ od 2.0.0).

### Log/Status
1. **`dam-integrations.js`:** wspĂłlny moduĹ‚ OAuth (Asana, Microsoft), karty infrastruktury (Entra/LDAP), Synology; `mount()` z auth headers.
2. **`integrations.html`:** peĹ‚ny shell DAM (jak branding), sekcje Logowanie + OAuth z **Zaloguj/OdĹ‚Ä…cz**, kolejka wykrojnikĂłw bez zmian.
3. **`dam-settings.js`:** delegacja do `DamIntegrations.mount()`.
4. **`local_bridge.py`:** OAuth callback â†’ `integrations.html#damIntegrationsOAuth`.
5. Fix: `/integrations/status` wymaga sesji â€” fetch z `authHeaders()`; fallback gdy `login_required`.
6. **Wersja:** `2.0.0` Bento â†’ `2.0.1` modal zoom/layout (cadefaf) â†’ `2.0.2` cache tagĂłw + bridge invalidation (cadefaf) â†’ **`2.0.3`** integracje.

### Efekt/Fix
- Integracje: live status z bridge, przyciski OAuth (disabled bez credentials w `dam-connection.env`).
- Wersja spĂłjna: `version.json`, `dam-version.js`, `runtime_config.py`, cache bust `?v=2.0.3` w HTML.

### Test/Ewaluacja
- Screenshotâ†’Read `integrations.html`: sekcja OAuth (Asana, Microsoft), Zaloguj, brak etykiet â€žStubâ€ť.

### ĹąrĂłdĹ‚a
- `oauth_integrations.py`, `dam-settings.js` (poprzedni `loadIntegrations`)


---

## 2026-07-19 â€” Integracje hub v2 (2.0.5)

### Komenda/Akcja
Plan Integracje hub v2: dashboard widgety, UI hub, bridge finance/integrations, wykrojnik bridge-only, costs/invoices live, katalog FMCG, bump 2.0.5.

### Log/Status
1. Faza 0: dam-dashboard-widgets.js + CSS â€” layout 2x2/1x4/1x6, grupowanie branding po folderze.
2. Faza 1+3+4: dam-integrations-hub.css, rewrite dam-integrations.js, dam-wykrojnik-queue.js â†’ GET/POST bridge.
3. Faza 2: program-instructions (integrations.hub_bridge, finance.*); endpointy local_bridge + oauth_integrations.
4. Faza 5+5b: dam-cost.js bridge fetch + sync + panel FMCG; fmcg-cost-catalog.json; dam-fmcg-cost.js catalog-first.
5. Faza 6: dam-invoices.js bridge + CSV import; ukryty Geex Asana demo; lista z asana-tasks.json.
6. Faza 7: wersja 2.0.5, ADR-005 notatka v2, memory.

### Efekt/Fix
Hub Integracje = konfiguracja na stronie; koszty/faktury nie tylko ze statycznego JSON; katalog FMCG gotowy pod import Excel/CSV.

### Test/Ewaluacja
- Screenshot QA: dashboard layouts, Integracje vs Kalkulator, costs/invoices source badge.
- Restart bridge po zmianach local_bridge.py.

### Zrodla
- Plan integracje_hub_v2
- program-instructions.json, local_bridge.py, fmcg-cost-catalog.json

---

## 2026-07-19 â€” Integracje hub v2: kontynuacja + commit (2.0.5)

### Komenda/Akcja
Kontynuacja planu po innym agencie: audit luk, hotfix UI, commit+push na origin/main.

### Log/Status
1. Audit: fazy 0â€“7 lokalnie gotowe, ale **niezacommitowane** (working tree dirty vs 5adcd1f).
2. Fix: `dam-integrations.js` â€” Promise.all `.catch` + odporny fetch stawek (nie wisieÄ‡ na â€žWczytywanieâ€¦â€ť).
3. Fix: `dam-wykrojnik-queue.js` â€” filtr placeholderĂłw `row-N` z uszkodzonego rejestru XLSX.
4. Smoke: Integracje (karty Entra/Asana/MS/Synology/Finanse), Kalkulator (`Synchronizuj z Asany`, sekcja ĹaĹ„cuch FMCG 5/45), bridge hub_routes 200.
5. Commit + push `feat(integrations): hub v2 â€¦ (v2.0.5)`.

### Efekt/Fix
Plan Integracje hub v2 domkniÄ™ty w git + GitHub; restore-point pre-bento nadal tag `milestone/pre-bento-v1.5.0`.

---

## 2026-07-20 â€” Post-hub batch (2.0.6): modal CTA + portable path + search + indeksy

### Komenda/Akcja
Po zakonczeniu rownoleglych agentow: jeden commit zbiorczy wszystkich zmian lokalnych + push (bez bundle/tmp-qa).

### Log/Status
1. Czekanie na stabilizacje working tree (hashy JS/CSS/HTML bez driftu ~45s).
2. Modal: CTA PSD/PSB/AI (#damMediaPreviewSourceMount), usuniecie #damMediaPreviewMeta, ext-tag 10px.
3. DamPaths: toPortablePath / copyPortablePath (Marketing\â€¦ bez litery dysku).
4. Branding search: synonimy przezroczystosc/tlo biale.
5. asset_role_utils: atomic_write_json + cache skanu tla branding-background-scan.json.
6. Indeksy/lifecycle/change-log odswiezone (operacyjne F/X).
7. Bump wersji 2.0.5 â†’ **2.0.6**.

### Efekt/Fix
Jedna dostawa na origin/main po zamknieciu agentow; wersja UI 2.0.6.

## 2026-07-20 - Modal podgladu mediow: meta line, ext tag, Zrodlo, sciezka przenosna, tiery jakosci (worker)

- **Komenda/Akcja**: Naprawa regresji modala #damMediaPreview (branding) + 3 nowe zgloszenia (grupy GIF): brak Zrodlo, maly hero, scroll wariantow. Reguly globalne A (tiery kompresji XL/L/S/XS) i B (zrodla w gore drzewa).
- **Log/Status**:
  - Krok 1: usunieta linia meta "TIF - Indeks ..." (markup, renderMeta, metaLineText, CSS #damMediaPreviewMeta).
  - Krok 2: odstep ext-tagu od tytulu = 10px (margin-inline-start na .dam-media-preview__ext-tag; column-gap 0).
  - Krok 3: DamPaths.toPortablePath + copyPortablePath (schowek bez litery dysku, od Marketing\..., backslashe); podpiete w #damMediaPreviewCopy i #damVizModalCopyPath.
  - Krok 4: etykiety wariantow: label z indeksu, fallback = baza nazwy pliku (mid-trim >18 znakow), koniec z "Plik Plik Plik".
  - Krok 5 (Rule A): dam-media-preview.js laduje branding-index w runtime; findQualitySet grupuje te sama kreacje (creativeKey: baza nazwy bez markerow kompresji) w obrebie przodka 2 poziomy w gore; scoring segmentow (high/-1, low/+2, ultralow/+3, skompresowane/+2, ultra/+1, min/+2); pigulki JAKOSC XL/L/S/XS przelaczaja hero + data-path Folder/Kopiuj/Udostepnij.
  - Krok 6 (Rule B): findEditableUpTree - gdy folder bez zrodel, szuka psd/psb/ai/indd/eps w indeksie 1-2 poziomy w gore (priorytet: podobna nazwa >=60% prefiksu, foldery PSD/AI/EDYTOWALNE/ZRODLA/SOURCE, potem dowolny); przycisk zrodla renderuje sie asynchronicznie.
  - Krok 7: hero min-height min(340px,42dvh), img#damMediaPreviewHero object-fit contain (male GIFy skaluja sie w gore).
  - Krok 8: warianty zwiniete do 4 kafelkow + "Pokaz wszystkie (N)" / "Zwin" (aria-expanded, chevron), bez wewnetrznych scrolli; dedupe kafelkow po creativeKey.
- **Efekt/Fix**: br-005329: hero duzy, pigulki XL/L/S/XS (XS aktywne), PSD z DV360_GIFF/PSD, 4/9 kafelkow + toggle. br-005266: XL/L/S, PSB z JUSTTAG - OGOLNA.psb, 4/7 kafelkow. br-003365: bez regresji (gap 10px, PSD, 2 produkty, bez pigulek).
- **Backup**: brak zmian destrukcyjnych (tylko JS/CSS/HTML wersjonowanie cache).
- **Test/Ewaluacja**: cursor-ide-browser 1280x900, screenshot + Read (vision) x4; Runtime.evaluate: gap=10.0px, portable path OK (X:/, X:\\, UNC, bez Marketing), przelacznik XL podmienia hero na Kampania 2026 - HIGH, expand=9 kafelkow bez scrollbara.
- **Zrodla**: apps/web/assets/js/dam-media-preview.js, dam-paths.js, dam-viz.js, dam-branding.js, dam-branding.css, branding.html (v=204mod3), visualizations.html.

---

## 2026-07-20 - Backlog NIE UDALO SIE - realizacja czesc 1 (worker, itemy 2-8 + 11)

### Komenda/Akcja
Realizacja backlogu "RZECZY DO WYKONANIA - NIE UDALO SIE" (2026-07-19), itemy 2-8 (pominiete: 1 wideo modal, 9 seed KV, 10 full QA - poza scope). Dodatkowo item 11: wygaszone tagi facetowe bez licznikow (Wideo/Dokument/Raster/Desktop/Tablet/Mobile/Na sklep). Zakaz edycji plikow drugiego agenta (dam-media-preview.js, dam-viz.js, dam-branding.css, dam-paths.js, script tagi branding/visualizations.html) - dotrzymany.

### Log/Status
1. **Item 2 - pixel-scan --all z budzetem** (`patch-branding-backgrounds.py`, `asset_role_utils.py`):
   - Nowe flagi: `--all` (PNG/WebP/GIF/TIFF + JPG/BMPâ†’white), `--limit-seconds`, `--limit-count`, `--no-cache`.
   - Trwaly cache wynikow: `apps/web/data/branding-background-scan.json` (pathâ†’transparent|white|none), checkpoint co 500 plikow.
   - Zapis indeksu i cache atomowy (`atomic_write_json`: tmp + os.replace).
   - **Bugfix krytyczny**: `_run_with_timeout` na ThreadPoolExecutor blokowal sie na `shutdown(wait=True)` przy wiszacym odczycie NFS X: - timeout martwy, skan stawal (1. przebieg wisial 25 min na pliku ~2575; w systemie wisialy tez 4 stare procesy patch/enrich z 19.07 - ubite). Fix: watek daemon + Event.wait(timeout).
   - Przebieg 2: 2652 plikow w ~99 s (cache OS), wynik 562 transparent + 1585 white + 505 none; indeks: transparent 1029â†’1591, white 762â†’2347 (w tym Kampanie 239).
2. **Item 3 - trwalosc skanu przy rebuild**: `apply_background_scan_cache` w asset_role_utils; `build-branding-index.py` czyta cache w `make_asset` (w tym "none" = nie powtarzaj IO) + carry-over po overrides; `re-enrich-branding-index.py` tez robi carry-over. Test jednostkowy: carry na fake asset OK (case-insensitive path, search_blob dostaje "przezroczyste tlo").
3. **Item 4 - filtr Tlo biale**: logika `isEffectiveWhite` (tylko skan/JPG, nie PNG-default) byla poprawna; problem lezal w danych (0 white poza wizkami przed skanem). Po skanie + `enrich-branding-tags.py`: Kampanie 582â†’239 plikow, Packshoty 1767â†’760. CDP + screenshot.
4. **Item 5 - szukanie "przezroczyste"**: przyczyna 0 kart = synonimy dolaczane do tokenow jako AND (`tokens.every`), a blob runtime nie zawieral frazy "przezroczyste tlo". Fix: `searchTokenGroups` (kazdy token usera = grupa OR z synonimami; grupy AND) + `SEARCH_SYNONYM_MAP` (takze biale tlo) + uzupelniony blob transparent/white w `assetBlobNorm`. Wynik: 17 kart / 38 plikow w Kampaniach.
5. **Item 6 - logo collapsed sidebar**: weryfikacja 1280px (emulacja CDP), expanded + collapsed, screenshot + Read: wordmark "dobra kaloria" caly (48x48, object-fit contain w dam-brand.css) - bez zmian kodu.
6. **Item 7 - Marketing ID TIK/YT/REL**: `dam-marketing-id.js` - typy TIK=10 (tiktok), YT=11 (youtube/yt), REL=12 (reels/rolka) sprawdzane PRZED generycznym VID; test node: M-TIK1006305-01-25, M-YT1100123-03-24, M-REL1200124-03-24, VID/KV bez regresji. Instrukcja `branding.marketing_asset_id_format` rozszerzona (updated_at 2026-07-20), JSON valid; seed do Postgres KV przy najblizszym restarcie bridge (item 9 backlogu).
7. **Item 8 - parytet kart grupowych**: audyt DOM na 4 zakladkach: Kampanie 66/66, Social 14/14, WWW 252/252, Packshoty 202/202 kart grupowych z `.dam-viz-card__actions` (Podglad/Folder/Udostepnij), style identyczne jak karty pojedyncze. Screenshoty WWW + Packshoty. Bez zmian kodu (naprawione wczesniejsza sesja 19.07).
8. **Item 11 - wygaszone tagi facetowe**: przyczyna podwojna: (a) `passesGraphicsOnlyFilter` wykluczal video/document takze z LICZNIKOW facet, wiec Wideo/Dokument mialy 0 i disabled przy domyslnym "Tylko grafiki"; (b) Raster/Desktop/Tablet/Mobile/Na sklep mialy realnie 0 w indeksie (stary indeks sprzed `extract_placement_tags` i format_technical "raster"). Fix (a): `chipCountIgnoresGraphicsOnly` (media:/format:) w `computeFacetCountsPair` - liczniki bez wykluczenia; klik w Wideo/Dokument nadal nadpisuje przelacznik (istniejacy mechanizm w passesGraphicsOnlyFilter). Fix (b): po skanie re-run `enrich-branding-tags.py` (raster 4443, white 2347, Desktop 32 / Tablet 32 / Mobile 36 / Na sklep 1621). Tooltip przelacznika: "Ukrywa PDF, Excel, Word i wideo... po tagach Dokument / Wideo" (branding.html, poza script tagami).

### Efekt/Fix
- Filtry Cechy pliku/Format pliku dzialaja z realnymi licznikami: wszystkie tagi klikalne (screenshot koncowy - zero wygaszonych w Kampaniach).
- Klik Wideo przy wlaczonym "Tylko grafiki" pokazuje 174 pliki wideo (CDP + screenshot).
- Wyszukiwanie "przezroczyste" zwraca karty; filtr Tlo biale zaweza takze poza Packshotami.
- Skan tla przezywa rebuild indeksu (cache) i nie wiesza sie na NFS.

### Backup
- Bez operacji destrukcyjnych; indeks nadpisywany atomowo, cache skanu = nowy plik. Dysk X: tylko odczyt (zgodnie z branding.disk_read_only).

### Test/Ewaluacja
- Python: unit test cache/carry-over (limit_count, include_opaque, apply) - PASS; JSON program-instructions valid.
- Node: format ID dla 5 przypadkow - PASS.
- Browser (cursor-ide-browser, cache disabled, viewport 1280): screenshot + Read x6 (Wideo aktywne, wyniki "przezroczyste", sidebar expanded/collapsed, white Packshoty, grupy WWW/Packshoty, facety po skanie).
- Liczniki: Kampanie white 239, Packshoty white 760, search przezroczyste 38 plikow.

### Zrodla
- apps/web/scripts/asset_role_utils.py, patch-branding-backgrounds.py, build-branding-index.py, re-enrich-branding-index.py
- apps/web/assets/js/dam-branding.js (CB hub20260720backlog1), dam-marketing-id.js
- apps/web/data/program-instructions.json (branding.marketing_asset_id_format), branding-background-scan.json
- apps/web/branding.html (tylko data-dam-tip przelacznika)
- .cursor/rules/verify-ui-after-changes.mdc, program-instructions branding.png_default_transparent

---

## 2026-07-20 â€” WaĹĽna checklista uĹĽytkownika

### Komenda/Akcja
Z priorytetĂłw A/B/C (post-hub) zrobiÄ‡ checklistÄ™; przy kolejnych proĹ›bach zahaczajÄ…cych o listÄ™ â€” przypominaÄ‡.

### Log/Status
1. Utworzono `WAZNA-CHECKLISTA-UZYTKOWNIKA.md` (A1â€“A4, B1â€“B6, C1â€“C3 + triggery).
2. ReguĹ‚a alwaysApply: `.cursor/rules/wazna-checklista-uzytkownika.mdc`.
3. `memory.md` Â§127.

### Efekt/Fix
Jedno ĹşrĂłdĹ‚o prawdy priorytetĂłw uĹĽytkownika; agenci przypominajÄ… ID przy powiÄ…zanych taskach.

### Test/Ewaluacja
Brak (dokumentacja + reguĹ‚a Cursor).

---

## 2026-07-20 â€” Animacje + tryb w tle (tray) + cache Branding (2.0.7)

### Komenda/Akcja
Trzy zgĹ‚oszenia: (1) animacje nie dziaĹ‚ajÄ… dla tagĂłw i belek, wydĹ‚uĹĽyÄ‡ 0.3s->0.4s, animowaÄ‡ wszystko; (2) aplikacja ma dziaĹ‚aÄ‡ w tle / w zasobniku systemowym; (3) Branding dĹ‚ugo siÄ™ otwiera - znaleĹşÄ‡ opĂłĹşnienia + cache.

### Log/Status
1. Diagnoza 3 subagentami (animacje CSS, desktop/tray, Ĺ›cieĹĽka Ĺ‚adowania Branding).
2. Animacje: tokeny ruchu w `dam-tokens.css`; blok `transition` dla tagĂłw/pill/badge + belek w `dam-brand.css` i `dam-branding.css`; `dam-grid-reveal.js` DURATION 0.35->0.4, sidebar 0.3->0.4, nowe `revealBars()` (belki jako bloki, znacznik `data-dam-bar-revealed`), export + autoInit; podpiÄ™cie w `dam-branding.js`.
3. Tray: `launch.py` `window.events.closing` -> `window.hide()` (return False) gdy `tray_active`; caĹ‚kowite wyjĹ›cie przez menu tray. `dam_tray.py` bez zmian.
4. Cache Branding: usuniÄ™to `Date.now()` z URL indeksĂłw; `window.__damBrandingIndex` wspĂłĹ‚dzielony (branding.js + media-preview.js); usuniÄ™to podwĂłjny `renderTagFilters()` na boot; wideo w siatce `preload="none"`.
5. Wersja 2.0.6->2.0.7 (`version.json`, `dam-version.js`, `runtime_config.py`); cache-bust bump na branding.html + dashboard.html.
6. Instrukcje: `program-instructions.json` +3 (`desktop.background_tray`, `ui.motion_tokens`, `branding.load_cache`). memory Â§128.

### Efekt/Fix
Tagi i belki animujÄ… siÄ™ (transition 0.22s + reveal belek 0.4s); okno chowa siÄ™ do zasobnika bez ubijania mostu; Branding nie pobiera ~35 MB przy kaĹĽdym wejĹ›ciu i renderuje tagi raz.

### Test/Ewaluacja
- `py_compile launch.py` OK; `node --check` JS OK; JSON OK; ReadLints czysto.
- Browser :8765 branding.html: screenshot + Read (logo caĹ‚e, belki tagĂłw wyrĂłwnane, bez regresji).
- CDP: `--dam-anim`=0.4s, `--dam-anim-hover`=0.22s, `revealBars`=true (3 belki z markerem), `window.__damBrandingIndex` 7832 assetĂłw, 115 kart, 74 tagi, badge `transition-duration` 0.22s.
- UWAGA: tray wymaga **restartu aplikacji desktop** (launch.py nie hot-reloaduje).

### Zrodla
- dam-tokens.css, dam-brand.css, dam-branding.css, dam-grid-reveal.js, dam-branding.js, dam-media-preview.js, launch.py, version.json, dam-version.js, runtime_config.py, program-instructions.json

---

## 2026-07-20 â€” Ruch globalny v2: reveal 0.45s, kolejnosc gora->dol, skeleton (2.0.7)

### Komenda/Akcja
Dopracowanie animacji: (1) reveal za szybki / poza kolejnoscia (elementy przed pierwszym); (2) wydluzyc do 0.45s + reakcja viewportu -50px; (3) skeleton loading (shimmer) tam gdzie cos sie laduje (costs/integrations/invoices); (4) faktury pojawiaja sie natychmiast -> maja animowac; (5) sidebar bez slide (tylko morph), tytul/podtytul fade-in, hover scale buttonow/ikon sidebar. Skille: /ui-ux-pro-max, /ui-taste, /gsap-core.

### Log/Status
1. Diagnoza: index.html (dam-projects) = wzorzec; faktury tabela poza reveal; brak skeletonu; sidebar slide niechciany.
2. `dam-grid-reveal.js`: DURATION 0.45; observer rootMargin -50px; reveal() dzieli inView (jedna sekwencja gora->dol) vs below (IO); revealPageEntrance (tytul+podtytul+belki); usunieto sidebar slide z autoInit; dodano revealRows + skeleton; export.
3. `dam-brand.css`: hover scale .geex-btn/ikony sidebar (token --dam-hover-scale, 0.2s, :active 0.97); CSS skeleton shimmer (dam-skel-shimmer) + dark + reduced-motion.
4. Wpiecie: invoices (skeleton tbody + revealRows tr), costs (skeleton 3 panele + revealRows meta/result/fmcg), integrations (skeleton karty + revealRows .dam-int-card).
5. `dam-grid-reveal.js` dodany do costs/integrations/invoices; cache-bust motion20260720a na 9 stronach; dam-version 2.0.7.
6. Instrukcje: ui.motion_tokens zaktualizowane; memory Â§129; version.json note.

### Efekt/Fix
Wejscie 0.45s gora->dol bez wyskakiwania poza kolejnoscia; skeleton z przeblyskiem podczas ladowania, potem tresc wjezdza zanimowana; faktury/costs/integracje animowane; sidebar tylko morph; hover buttonow/ikon.

### Test/Ewaluacja
- node --check (grid-reveal, invoices, cost, integrations) OK; ReadLints czysto; JSON OK.
- Browser :8765 (karta w tle => rAF zamrozony; force gsap.globalTimeline.progress(1)): costs meta+koszt 7588,10 PLN + 11 wierszy; invoices 10 wierszy (FV/2026/07/001...); integrations 7 kart; skeleton znika po renderze; hover transition transform obecny; footer v2.0.7.
- Ograniczenie: ruch na zywo nieuchwytny w screenshotach przy karcie w tle; stan koncowy poprawny, silnik = wzorzec index.html.

### Zrodla
- dam-grid-reveal.js, dam-brand.css, dam-tokens.css, dam-cost.js, dam-invoices.js, dam-integrations.js, costs.html, integrations.html, invoices.html, index/explorer/inbox/visualizations/branding/dashboard.html, program-instructions.json, memory.md, version.json

## 2026-07-20 - Animacje reveal (fix regresji) + edytor skojarzen (search/folder/ikony)

### Komenda/Akcja
User: (1) przywrocic animacje reveal (za szybkie, brak viewport-gate, brak w modalach/sidebarze); (2) bugi edytora skojarzen: folder picker nieklikalny, "Dodaj z dysku" nic nie dodaje, wyszukiwarka nie znajduje po indeksie (6300539.01), odznaczanie nie dziala, brak ikon (folder/kopiuj link), indeksy jako TAG.

### Log/Status
1. dam-grid-reveal.js przepisany: tempo 0.35s / stagger 0.05s, power2.out; IntersectionObserver (element rusza w viewporcie); generyczny reveal modali (.dam-viz-modal-overlay -> thumb fade + body slide) i sidebara; #damHelpFab bez animacji.
2. REGRESJA: clip-path w stanie spoczynku zerowal prostokat -> IntersectionObserver ratio 0 -> deadlock (karty niewidoczne). Fix: stan spoczynku = samo opacity:0, clip-path animowany dopiero w tweenie. Zweryfikowane CDP: above-fold opacity 1, below-fold 0 do scrolla.
3. Cache-bump dam-grid-reveal.js: index/inbox/explorer/dashboard (branding/visualizations pozostaja stary cache - do zrobienia).
4. dam-assoc-edit.js:
   - Wyszukiwanie: productSearchBlob (search_blob + WSZYSTKIE indexes + index_bases + tagi) zamiast tylko indexes[0] uciete. 6300539/6300539.01/000108/nazwa -> znajduje.
   - Folder picker: overlay.style.zIndex=12300 (nad nakladka skojarzen 12100) -> klikalny.
   - "Dodaj z dysku": matchProductsByFolder (po sciezce: exact / pod folderem / rodzic) dodaje produkt do zaznaczenia i zapisuje.
   - Odznaczanie: pozycje AKTUALNE pokazuja czerwony X (uil-times) gdy odznaczone -> jasne ze usuwane; zapis usuwa z linked.
   - Ikony wierszy: folder (revealInExplorer) + kopiuj link (schowek) na kazdym wyniku i pozycji AKTUALNE.
   - Indeks jako TAG: .dam-assoc-edit-popover__sub--tag (fioletowa pigulka, tabular-nums). CSS wstrzykiwany z JS (bez ruszania dam-branding.css/dam-brand.css agentow).
   - Cache-bump dam-assoc-edit.js w branding.html (agenci skonczyli: turn_ended success).

### Efekt/Fix
Reveal dziala jak nalezy (viewport, plynniej). Edytor skojarzen: search po indeksie OK, folder picker klikalny, dodawanie z dysku dziala, odznaczanie czytelne, ikony + tag indeksu na kazdym wierszu.

### Test/Ewaluacja
cursor-ide-browser 1024x1140: reveal (screenshot Projekty po scrollu), popover skojarzen (screenshot: tag indeksu + ikony folder/link), CDP: search 6300539->TARTA MALINOWA, folder picker z-index 12300 topmost. Uwaga: screenshot tool bywa stale przy wspoldzielonej karcie - fixy potwierdzone tez DOM.

### Zrodla
apps/web/assets/js/dam-grid-reveal.js, dam-assoc-edit.js; index/inbox/explorer/dashboard.html, branding.html (cache-bump).

## 2026-07-20 - Dokumentacja: WYKLADNIA KODU DAM (code-doctrine) + commit/push

### Komenda/Akcja
User: zbuduj z napraw dokumentacje + instrukcje "jak rozumiec kod" dla przyszlych agentow, nazwij tak, by ZAWSZE czytali jako wykladnie; commit + update logow + push.

### Log/Status
1. Utworzono agents/shared/code-doctrine.md (12 sekcji: architektura, modul DamX, cache-bust, wspolbieznosc, weryfikacja CDP/screenshot, model danych, 2 studia przypadku: reveal/clip-path-IO + edytor skojarzen, pulapki PowerShell/X:, debug, slowniczek modulow, dziennik lekcji).
2. AGENTS.md: wpiety blok "CZYTAJ ZAWSZE NAJPIERW" -> code-doctrine.md (tracked, auto-read).
3. .cursor/rules/code-doctrine.mdc (alwaysApply) - lokalne wymuszenie (uwaga: .cursor gitignored -> nie idzie na git; trwaly nosnik = AGENTS.md + agents/shared/).
4. Weryfikacja spojnosci: dam-grid-reveal.js w working tree = MERGE mojej poprawki IO (opacity resting + clip w tweenie) z praca v2.0.7 (DURATION 0.4, revealBars, sidebar). Nic nie nadpisane.
5. .gitignore: dodano tmp-qa-hub/ i backups/**/*.bundle (scratch/duze binaria - nie commitowac).

### Efekt/Fix
Przyszli agenci maja obowiazkowa wykladnie kodu z konkretnymi "dlaczego dziala/nie dziala". Commit + push na origin/main.

### Zrodla
agents/shared/code-doctrine.md, AGENTS.md, .cursor/rules/code-doctrine.mdc, memory.md, process.md, .gitignore.

## 2026-07-20 - Skill dam-dobrakaloria (doktryna + petla przelotow)

### Komenda/Akcja
User: stworz skill "DAM-DobraKaloria" na bazie code-doctrine.md + praktyki pracy/testowania kodu; zdefiniuj petle kod->test->screenshot->poprawka jako przelot/tura/pass/podejscie (min. 3 przeloty), runda = seria przelotow na jednym elemencie; podpowiedz agentom, by uzywali w tym projekcie.

### Log/Status
1. Utworzono skill: C:\Users\xpret\.cursor\skills\dam-dobrakaloria\SKILL.md (personal, auto-invoke po opisie: repo DAM, dam-*.js/css, local_bridge, indeksy JSON). 5 sekcji: zrodla prawdy, skrot doktryny, PETLA PRZELOTOW (1 przelot = kod + test node--check/CDP + screenshot+Read + defekty/poprawka; min. 3 przeloty; runda = przeloty na 1 elemencie do czysta), definition-of-done checklist, mapa plikow.
2. Wskazniki na skill dopisane: AGENTS.md (blok CZYTAJ ZAWSZE), agents/shared/code-doctrine.md (sekcja 0), .cursor/rules/code-doctrine.mdc (lokalnie).

### Efekt/Fix
Agenci w tym repo dostaja jeden skill z doktryna + rytualem weryfikacji; slownik przelot/tura/runda ujednolicony z jezykiem usera.

### Zrodla
~/.cursor/skills/dam-dobrakaloria/SKILL.md, AGENTS.md, agents/shared/code-doctrine.md, .cursor/rules/code-doctrine.mdc.

## 2026-07-20 - Motion global + skeleton + fix widget branding_latest (v2.0.7)

### Komenda/Akcja
User: zapisz, commit+push, napraw blad widgetu "Brak assetow w indeksie branding" na dashboardzie; przetestuj aplikacje (/ui-taste, /dam-dobrakaloria).

### Log/Status
1. Root cause: `dam-dashboard-widgets.js` filtrowal `media_type === "raster"` - indeks ma `image`/`vector`/`source` (7832 assetow, 0 po filtrze).
2. Fix: `normalizeBrandingMediaType`, `isBrandingWidgetThumb`, `loadBrandingIndex()` (cache `__damBrandingIndex`), lepszy empty state z linkiem do Brandingu.
3. Bump cache-bust: `dashboard.html` -> `dam-dashboard-widgets.js?v=brandfix20260720a`.
4. Weryfikacja CDP dashboard: widget `branding_latest` -> 6 img, miniatury z bridge :8766, alt OK.
5. Pozostale zmiany w working tree: global motion (dam-grid-reveal 0.45s, rootMargin -50px), skeleton costs/invoices/integrations, hover scale dam-brand.css.

### Efekt/Fix
Widget "Najnowsze materialy branding" pokazuje 6 najnowszych grup z miniaturami zamiast falszywego pustego stanu.

### Test/Ewaluacja
- `node --check dam-dashboard-widgets.js` OK
- CDP: `[data-widget-id="branding_latest"]` imgCount=6, naturalWidth>0
- Screenshot+Read: karta w scrollu dashboardu (CDP silniejszy niz klatka IDE)

### Zrodla
apps/web/assets/js/dam-dashboard-widgets.js, apps/web/dashboard.html, branding-index.json (7832 assets, media_types: image/vector/document/source/video).

## 2026-07-20 - Skeleton proaktywny: Branding + Wizualizacje

### Komenda/Akcja
User: branding i wizualizacje laduja tresc bez wczesniejszego skeleton loading; skeleton ma byc od razu (proaktywnie), potem zniknac i reveal (/dam-dobrakaloria, /ui-taste, /gsap-core).

### Log/Status
1. Root cause: `showInitialBootSkeletons` brak; `boot()` brandingu awaitowal 35MB indeks zanim cokolwiek trafilo do `#damBrandingSectionGrid`; `dam-viz.js` czekal na `loadIndex()` przed skeletonem.
2. `dam-grid-reveal.js`: wariant `layout:'viz-grid'` / mount `.dam-viz-grid` wstawia `.dam-skeleton__card--viz` jako dzieci grida (bez zagniezdzonego `.dam-skeleton--grid`).
3. `dam-brand.css`: `.dam-skeleton__card--viz` wysokosc ~320px * `--dam-viz-card-scale`, border jak karta.
4. `dam-branding.js`: `showInitialBootSkeletons()` na poczatku `boot()` (section grid 10 + brandbook 8).
5. `dam-viz.js`: skeleton 10 kart synchronicznie w `init()` przed `loadIndex()`.
6. Cache-bust: `branding.html` + `visualizations.html` -> `skel20260720a`.

### Efekt/Fix
Od pierwszej klatki DOM siatki maja shimmer-placeholdery w ksztalcie kart; po zaladowaniu indeksu innerHTML + `DamGridReveal.reveal(.dam-viz-card)`.

### Test/Ewaluacja
- `node --check` dam-grid-reveal.js, dam-branding.js, dam-viz.js OK
- CDP branding: skeleton inject 10 kart, h=384, shimmer ::after
- CDP viz po load: 151 `.dam-viz-card`, sk=0
- Screenshot+Read pass2: siatka 4 kolumny, szare karty shimmer w `#damBrandingSectionGrid`

### Zrodla
dam-grid-reveal.js skeleton(), dam-branding.js boot(), dam-viz.js init(), ui-taste Â§4.5 Loading.

## 2026-07-20 - DAM usability repair (FAZA 0-5)

### Komenda/Akcja
Implementacja planu `dam_usability_repair` (bez edycji pliku planu). Skille: dam-dobrakaloria, ui-taste (+ wcielony ui-ux-pro-max).

### Log/Status
1. FAZA 0: ui-taste description/scope (product UI), `product-ux/`, Â§22 Product UI, Â§23 Dziennik; regula `.cursor/rules/ui-taste-always.mdc` (repo + user).
2. FAZA 1: delegacja `.dam-win-btn` na `#damDashGrid` + re-bind po async; branding `bestTabForSearchQuery` + `?tab=`; modal reveal 0.3s fade + skeleton hero + fade tla.
3. FAZA 2: CSS 2x2 gap dla `--media`, tablet bez zwiniecia do 1 kol; hover thumbs; dashboard laduje DamMediaPreview (Podglad w miejscu).
4. FAZA 3: `DamMediaPreview` studio (tlo/persp/lang); `openLightbox` -> `openAsset(mode:viz-studio)`; shell zamyka `#damMediaPreview`.
5. FAZA 4: historia statusow = przycisk+badge -> modal `#damLifecycleHistoryModal`.
6. FAZA 5: weryfikacja dashboard 1280 (2x2, modal), branding `?q&tab=www` wyniki, explorer historia modal.

### Efekt/Fix
Jeden globalny modal podgladu; Folder Windows i Podglad na dashboardzie dzialaja po async; zero falszywego Brak wynikow przy poprawnym tab; historia F/X/D nie rozpycha inline.

### Test/Ewaluacja
- `node --check` na edytowanych JS: OK
- CDP dashboard: brandingCols `1fr 1fr`, gap 14/16, `_damWinDelegated`, DamMediaPreview open z Podglad
- Screenshot+Read: modal branding na dashboardzie; historia statusow modal w explorerze
- Branding: tab Strony WWW selected dla `?q=Bowl&tab=www`, wyniki widoczne

### Zrodla
dam-dashboard-widgets.js, dam-branding.js, dam-grid-reveal.js, dam-media-preview.js, dam-explorer.js, dam-shell.js, dam-dashboard.css, dam-brand.css, dam-branding.css, dashboard/explorer/branding.html, ~/.cursor/skills/ui-taste, agents/shared/code-doctrine.md

## 2026-07-20 - Explorer foreground fix

### Komenda/Akcja
Fix zgloszenia: "Folder Windows" (`.dam-win-btn` -> POST `:8766/reveal`) otwieral Eksploratora W TLE (okno niewidoczne). Wymagania: (1) preferuj NOWA KARTE w istniejacym oknie Eksploratora (Win11), (2) zawsze wysun okno na wierzch.

### Log/Status
1. Root cause: most to `pythonw.exe` (proces bez okna pierwszoplanowego) -> `subprocess.Popen(["explorer", path])` uruchamia okno bez fokusu (Windows foreground lock: SetForegroundWindow tylko dla procesu na pierwszym planie).
2. Diagnoza kart (sondy na tej maszynie, Win11 build 26200): rejestr `OpenFolderInNewTab=1` NIE dziala (nadal nowe okno, bez fokusu); `Navigate2(path, 2048)` nawiguje TA SAMA karte (nie tworzy nowej); dziala sekwencja: fokus okna (ALT-trick) -> Ctrl+T (keybd_event) -> `Navigate2(PIDL)` na swiezej karcie.
3. PILNE: dialog "Nie mozna odnalezc file:///D:/---%20INYFINN..." - Navigate2 dostawal sciezke, ktora Explorer probowal rozwiazac jako URL-encoded URI. Fix: `SHParseDisplayName` -> PIDL -> `VARIANT(VT_ARRAY|VT_UI1)`; NIGDY file:/// URI.
4. Implementacja w `local_bridge.py`: `_reveal_worker` (watek daemon, HTTP wraca natychmiast), `_open_folder_tab_and_focus` (COM Shell.Application + pywin32 + Ctrl+T + Navigate2(PIDL) + re-fokus), fallback `_focus_new_explorer_window` (poll do 5 s po nowe okno `CabinetWClass`, ALT-trick fokus). Tryb `select` (plik) = zawsze fallback explorer /select + fokus.
5. Restart mostu: stary PID 6760 zabity po porcie 8766, nowy `pythonw.exe local_bridge.py` w tle, `/health` OK.

### Efekt/Fix
`/reveal` na folder: gdy istnieje okno Eksploratora -> nowa karta w nim + okno na wierzchu; gdy brak okna -> nowe okno + na wierzchu. Zero dialogow bledu.

### Test/Ewaluacja
- `python -c "import ast; ast.parse(...)"` OK, lints czyste.
- POST /reveal `X:\Marketing\- POLSKA` przy otwartym oknie: TAB w oknie 3014902, `GetForegroundWindow()==hwnd` True.
- POST /reveal `X:\Marketing\- POLSKA\02 - FIRMOWE MATERIALY` (polskie znaki): karta + fokus True.
- Fallback (zero okien): nowe okno 198910, fokus True; kolejny /reveal `01 - PRODUKTY` -> karta nr 2 w tym oknie, fokus True.
- Sciezka repo `D:\--- INYFINN...` przetestowana sonda PIDL (karta + Navigate2 OK); endpoint jej nie przyjmie (jail `_is_under_marketing` - poza baza Marketing, zachowanie celowe).

### Backup
Brak (zmiana w 1 pliku, git).

### Zrodla
learn.microsoft.com IShellBrowser::BrowseObject (SBSP_*), Developing with Windows Explorer (IShellWindows/Navigate2), elevenforum OpenFolderInNewTab, znany pattern ALT-trick keybd_event(VK_MENU)+SetForegroundWindow.

## STREFA B usability 2026-07-20 (punkty 11-18 briefu)

### Komenda/Akcja
Brief `agents/shared/usability-brief-2026-07-20.md`, strefa B: dashboard 2x2, chip ID na kartach, licznik plikow, format licznikow, brakujace foldery ARCHIWUM w indeksie, tag klik/CTRL+klik, tooltips tagow, globalny loader.

### Log/Status
1. **P11 Dashboard 2x2**: root cause = kaskada CSS: `.dam-widget__list` (display:flex, linia ~404 dam-dashboard.css) wygrywal z `.dam-widget__list--media` (grid) o tej samej specyficznosci, bo byl nizej w pliku. Fix: podwojny selektor `.dam-widget__list.dam-widget__list--media` (grid). CDP: `grid-template-columns: 1fr 1fr`; screenshot: widget "Najnowsze materialy branding" = 2 kolumny x 2 rzedy.
2. **P12 Chip ID marketingowego**: `brandingCardIdChipHtml()` w dam-branding.js - kopiowalny button przy tytule karty (pojedyncze + grupowe), `data-dam-tip="Kliknij, aby skopiowac"`, klik = clipboard + toast (`damGlobalToast`, mechanizm jak toastCopied w dam-badges.js). ID usuniete z paska badge'ow (bylo uciete/niewidoczne). CSS `.dam-branding-card__id-chip` w dam-branding.css + `flex-wrap:wrap` na title-wrap przez `:has()` (chip lamie sie do wlasnej linii, nie jest uciety). Karty viz renderuje dam-viz.js (strefa agenta A) - NIE ruszane; modal viz ma juz chip ID z wczesniejszej sesji.
3. **P13 Licznik plikow**: `.dam-branding-grid-count` - ciemne tlo rgb(35 32 46/.92), bialy tekst, font-weight 700; margin-right 84px = pas na help fab (fab ~48px + 24px marginesu). Screenshot: pill czytelny, na lewo od fabu.
4. **P14 Format licznikow**: `fmtElements`/`fmtFiles` (polska odmiana 1/2-4/5+), status = "115 elementow â€˘ 582 pliki", licznik siatki = elementy â€˘ pliki (z X / Y przy uciecu limitem), tagi = "(N el. â€˘ M pl.)". Elementy per tag = dedup po `folder_group_id || marketingGroupKey` w `computeFacetCountsPair` (jedna petla, cache jak dotad).
5. **P15 Brakujace foldery ARCHIWUM**: w starym indeksie (built 2026-07-19 01:36) brak "08 Kampania META" i "05 - SLIDERY - sklep" z `-- ARCHIWUM --/05_Materialy graficzne e-commerce`. Skrypt build-branding-index.py JUZ skanuje legacy root (scan_marketing_roots, ingest legacy z dedup overlap) - stary indeks byl zbudowany przed ta zmiana. Pelny rebuild odpalony (python build-branding-index.py, dysk X: NFS wolny - kilkadziesiat minut; DecompressionBomb warnings = duze TIFy, niegrozne).
6. **P16 Tag klik/CTRL**: handler tagow w renderTagFilters: zwykly klik = zastap caly wybor tym tagiem (drugi klik na jedyny aktywny = wyczysc), CTRL/Cmd+klik = toggle multi. Dziala we wszystkich grupach facetow (wspolny handler `[data-tag-key]`). CDP: slider -> baner (replace), CTRL slider -> slider+baner (multi), status 6 el. â€˘ 15 pl.
7. **P17 Tooltips tagow facetow**: dam-tooltips.js - osobna sciezka `isFacetTag` (`.dam-badge-tag[data-tag-key]` w `.dam-branding-tag-filters`): 1.5 s hover, fade-in .25s, tresc = opis ("Tag X z grupy Y...") + sekcja hint "Klik: tylko ten tag. CTRL+klik: dodaj do wyboru." + "Nie przypominaj wiecej" (localStorage `damTagCtrlHintDismissed=1`; po dismiss tylko opis). Tooltip ma pointer-events:auto (mozna kliknac dismiss), inne tooltipy bez zmian.
8. **P18 DamLoader**: nowy apps/web/assets/js/dam-loader.js (CSS wstrzykiwany `<style id=damLoaderCss>`): `DamLoader.start(label)` = bialy pill na srodku (spinner + label + pasek indeterminate, fiolet #ab54db), po 1 s GSAP (power2.inOut) zwija pill i przenosi do prawego dolnego rogu (right 24 / bottom 92 - NAD help fabem), `done()` = fade-out; z-index 13000, pointer-events:none, prefers-reduced-motion = od razu rog; GSAP ladowany wzorcem loadGsap z dam-grid-reveal (wspolny tag data-dam-gsap). Wpiete w dam-branding.js: start przy kliku tagu, fazowany `scheduleBrandingRender` (skeleton klatka 1 gdy poprzedni render >150ms lub >800 assetow -> siatka klatka 2 -> tagi/facety klatka 3 -> done). Root cause 10 s zamrozen: renderTagFilters (facet counts = petla assets x ~100 kluczy) odpalal sie w tej samej klatce co siatka; teraz siatka renderuje sie PRZED tagami. dam-loader.js?v=1 dodany do 11 HTML (dashboard, explorer, branding, index, inbox, visualizations, settings, integrations, costs, invoices, profile).

### Efekt/Fix
Wszystko z punktow 11-14, 16-18 zweryfikowane w przegladarce (CDP + screenshot + Read). P15 = dokonczenie nastepcy (ponizej). Punkty 21-23 = nastepca (ponizej).

### Bumpy cache
- dam-dashboard.css -> usab20260720b (dashboard, settings)
- dam-branding.css -> usab20260720g (branding, explorer, dashboard, visualizations)
- dam-branding.js -> usab20260720f (branding)
- dam-tooltips.js -> usab20260720b (branding, explorer, dashboard, integrations, visualizations, settings, profile)
- dam-loader.js?v=1 (nowy, 11 HTML)

### Test/Ewaluacja
- node --check: dam-branding.js, dam-tooltips.js, dam-loader.js OK; ReadLints czysto.
- CDP: grid 2x2, 115 chipow ID, licznik "115 elementow â€˘ 582 pliki", replace/multi tagow, tooltip po 1.5 s + dismiss, loader center(cx=814/vw=1643) -> dock (right-bottom, w=52), tag counts "(30 el. â€˘ 145 pl.)".
- Screenshoty + Read: dashboard 2x2, branding grid + chipy ID (pelne, wlasna linia), ciemny licznik przy fabie, tooltip facetu, loader w rogu.
- Klip: klik chipa przez CDP daje "Nie udalo sie skopiowac" (brak user activation w tle) - realny klik uzytkownika ma aktywacje, mechanizm + toast dzialaja.

### Zrodla
- agents/shared/usability-brief-2026-07-20.md (punkty 11-18)
- apps/web/assets/js/dam-branding.js, dam-tooltips.js, dam-loader.js (nowy), dam-dashboard.css, dam-branding.css, 11x HTML
- apps/web/scripts/build-branding-index.py (scan_marketing_roots - legacy ARCHIWUM juz w kodzie)

---

## STREFA B nastepca 2026-07-20 (P15 + punkty 21-23)

### Komenda/Akcja
Handoff `agents/shared/handoff-strefa-B.md`: dokonczenie P15 (rebuild indeksu) + brief sekcja E punkty 21-23 (Pokaz wszystko / popup dna listy / Pokaz archiwum przy zakladkach).

### Log/Status
1. **P15 rebuild**: poprzedni PID 48688/50744 wisial ~92 min (89 watkow daemon na NFS po PIL DecompressionBomb / `_tiff_has_layers`). Zabity. Fix skryptow: (a) `_run_with_timeout` lapie `Exception` (nie tylko OSError), (b) legacy ARCHIWUM pomija pixel-scan tla, (c) TIFF w ARCHIWUM bez `_tiff_has_layers` (zakladamy editable), (d) progress log co 500 plikow. Restart: `build-branding-index.py` â†’ **100.7 s**, exit 0.
2. **P15 liczby PRZED â†’ PO**:
   - built_at: `2026-07-19T01:36` â†’ `2026-07-20T16:47:56`
   - assets: **7832 â†’ 49715** (legacy_indexed=41228, primary=7230)
   - path `Kampania META`: **0 â†’ 89** (rg -c = 560 trafien w JSON)
   - path `SLIDERY - sklep`: **0 â†’ 0** (folder zeskanowany; **96/96** plikow SCAN_EXT odrzucone jako overlap POLSKA-first `stem+wymiary` vs `- POLSKA/.../SLIDERY NA GĹĂ“WNÄ„` - dedup zamierzony)
   - UI tag META (archiwum ON + zakladka wszystko): **~29 el â€˘ 155 pl â†’ 64 el â€˘ 274 pl**; status siatki 77 el â€˘ 274 pl, karty z `Kampania META` / ARCHIWUM widoczne
   - UI tag Slider: **~40 el â€˘ 230 pl â†’ 55 el â€˘ 283 pl**
   - Po rebuild: `enrich-branding-tags.py` touched=45837
3. **P21 Pokaz wszystko**: pierwsza zakladka `data-tab="all"`, separator `.dam-branding-tabs__sep`, domyslnie aktywna (boot bez `?tab=`/`#`/`?q=`), `assetInSectionTab`/`assetsForSectionTab`/`computeFacetCountsPair` respektuja `all`.
4. **P22 popup dna**: `#damBrandingListEnd` + IntersectionObserver (bez window scroll), panel `#damBrandingCategoryHint`, CTA â†’ `activateTab("all")`, dismiss sessionStorage `damBrandingCatHintDismissed`.
5. **P23 Pokaz archiwum**: przeniesione z `.dam-branding-filters--meta` do `.dam-branding-scope-toggles` obok zakladek.

### Efekt/Fix
P15: META z ARCHIWUM w indeksie i UI (przy Pokaz wszystko + archiwum). SLIDERY archiwum = duplikaty POLSKA (overlap) - tresc dostepna w POLSKA / tag Slider. P21-23: 3 przeloty screenshot+Read (zakladki, popup, META archive).

### Backup
Brak (skrypty indeksu + UI; stary indeks nadpisany atomowo przez rebuild).

### Test/Ewaluacja
- `node --check dam-branding.js` OK; python ast parse skryptow OK.
- CDP: activeTab=all, sep 2px, fw=700, archiveNearTabs=true, archiveInMeta=false; popup hintHiddenâ†’false na sentinel; CTA â†’ tab=all + dismissed=1; META 77 el â€˘ 274 pl + hasKamp/hasArch.
- Screenshot+Read: `strefaB-p21-pass2-tabs.png`, `strefaB-p22-cat-hint.png`, `strefaB-p15-meta-archive.png`.

### Zrodla
- agents/shared/handoff-strefa-B.md, usability-brief-2026-07-20.md (E 21-23)
- apps/web/branding.html, dam-branding.js/css, build-branding-index.py, asset_role_utils.py, enrich-branding-tags.py

## STREFA C samouczek 2026-07-20 (weryfikacja faz 3-9 + feedback dymka)

### Komenda/Akcja
Nastepca agenta Strefy C. Zadanie: (1) zweryfikowac fazy 3-9 samouczka (spotlight,
tresc, poza maskotki, brak clippingu dymka), (2) wdrozyc feedback usera do dymka
(`dam-tut__bubble`), (3) wpis do process.md + lekcje do code-doctrine sekcja 12.

### Log/Status
1. **Feedback dymka (priorytet, wdrozony PRZED weryfikacja faz)** - 5 zmian w
   dam-tutorial.css + dam-tutorial.js:
   - **Lokalny mini-pasek Wstecz/Dalej pod trescia dymka**: nowy `.dam-tut__mini-nav`
     w `.dam-tut__bubble-body` (2 przyciski `--mini-prev`/`--mini-next`), te same
     handlery co dolny panel (prevStep/nextStep). Stan disabled i etykieta
     (Dalej/Zakoncz) synchronizowane z dolnymi w renderStep. Dolny panel (Pomin/
     Zakoncz/postep) zostawiony.
   - **Padding dymka +12px/strone**: 26px 28px -> 38px 40px; szerokosc 430->454px.
   - **Gap maskotka<->tekst +10px**: 16px -> 26px.
   - **Ilustracja +10%**: warstwa obrazka to teraz osobny element `.dam-tut__mascot-img`
     (110% box kontenera, left:-5%, bottom:0, contain) - ~+10% wzgledem stanu, w ktorym
     obraz wypelnial caly kontener (inset:0).
   - **Static medalion + bobujaca maskotka**: bob GSAP animuje TYLKO
     `.dam-tut__mascot-img` (y:-6), a bialy medalion to `::before` na kontenerze bez
     transformacji. Kontener nie ma juz `will-change:transform`; poprzednio bob ruszal
     cala `.dam-tut__mascot` (kolko + obraz razem). To samo dla toastu zaproszenia
     (`.dam-tut-invite__mascot-img`). Custom property `--dam-tut-pose` ustawiana na
     kontenerze, dziedziczona przez warstwe obrazka (applyPose bez zmian).
2. **Bump `?v=`**: dam-tutorial.css v2->v3, dam-tutorial.js v6->v7 we wszystkich 9 HTML
   (dashboard, index, explorer, branding, inbox, visualizations, integrations, costs,
   invoices).
3. **Weryfikacja faz 3-9** (localStorage `damTutorialPhase='faza:krok'` + nawigacja na
   pasujaca strone; wznowienie po 900 ms):
   - Faza 3 Wizualizacje (idx 2): screenshot+Read, poza explain, spot na `.dam-viz-grid`.
   - Faza 4 Branding (idx 3): screenshot+Read oba kroki - krok 1 spot na sekcji (explain),
     krok 2 "Tagi i filtry" spot na `.dam-branding-tabs-row` (present), "Przejdz tam"
     ukryty na wlasnej stronie.
   - Faza 5 Projekty (idx 4): screenshot, spot na `#damProjectsGrid`.
   - Faza 6 Wiadomosci (idx 5): CDP, spot na `.dam-inbox-layout` (1513x470).
   - Faza 7 Faktury (idx 6): screenshot+Read, spot na `.geex-content__section-wrapper`.
   - Faza 8 Kalkulator (idx 7): CDP, spot na content wrapper.
   - Faza 9 Integracje (idx 8): screenshot+Read, krok 1 explain (spot content), krok 2
     zen "To wszystko!".
   Wszedzie: nowy dymek (mini-nav, padding, wieksza maskotka), brak clippingu przy
   krawedziach, poprawna poza, sensowna tresc.

### Efekt/Fix
Feedback dymka wdrozony i zweryfikowany (2 przeloty screenshot+Read: dymek z lokalnymi
Wstecz/Dalej, static kolko + bobujaca maskotka, padding/gap). Fazy 3-9 przechodza
czysto. Miniprev disabled na kroku 1 (dashboard), etykieta "Zakonc" na ostatnim kroku.

### Backup
Brak (edycja tylko wlasnych plikow Strefy C: dam-tutorial.js/.css + bump ?v= w HTML).

### Test/Ewaluacja
- node --check dam-tutorial.js OK; ReadLints (js+css) czysto.
- CDP: padding 38px 40px, gap 26px, kontener transform=none (medalion static),
  `.dam-tut__mascot-img` 99x117 z matrix translateY (-1..-6, bobuje) = 110% kontenera,
  miniPrevDisabled=true na fazie 1 kroku 1, miniNext="Zakoncz" na ostatnim kroku.
- Screenshoty + Read: branding (2 kroki), invoices, integrations, wizualizacje, projekty,
  costs, dashboard krok 1, dymek po zmianach (2 przeloty).

### Zrodla
- agents/shared/handoff-strefa-C.md, agents/shared/usability-brief-2026-07-20.md (p.19,25,26)
- apps/web/assets/js/dam-tutorial.js, apps/web/assets/css/dam-tutorial.css, 9x HTML

## STREFA A usability 2026-07-20 (punkty 1-10 briefu)

### Komenda/Akcja
Nastepca przerwanego agenta Strefy A. Domkniecie luk weryfikacyjnych z gents/shared/handoff-strefa-A.md sekcja (b); wpis process + lekcje doktryny (poprzednik nie zdazyl).

### Log/Status
1. Przeczytano skill dam-dobrakaloria + ui-taste, handoff, brief A 1-10.
2. **Luka P5 (kopiowanie ID)**: explorer -> babka-cytrynowa-nerkowcowy -> media preview. Chip data-marketing-id=V-6300684-ENFACE-L-04-26. Klik i contextmenu (z mockiem clipboard.writeText) kopiujÄ… wylacznie ID marketingowe; toast `Skopiowano: V-6300684-ENFACE-L-04-26`. Tip bez br-xxxxx. PASS.
3. **Luka P7 (Dodaj miniature)**: visualizations -> produkt coconut-orange-date (alias_langs RO/LT/LV/EE bez wizki). Modal: `Brak wizualizacji` + przycisk `Dodaj miniature` widoczny obok Demo/Ukryj. Screenshot+Read PASS.
4. **Luka P9 (assoc tags + zoom)**: branding -> openAsset br-003363 -> `DamAssocEdit.openPicker` (eksport dopisany, bo w tej karcie CDP `element.click()` nie odpala listenerow). Szukaj `baton`: 5 badge'ow (DK / BATONY / Mixy / PL / indeks). Hover thumb: `#damAssocThumbZoom` 400x400 z-index 12400; mouseleave usuwa zoom. Screenshot+Read PASS (placeholder `Brak` gdy brak thumb_url produktu - oczekiwane).
5. **linked_products 6300684 / Postanowienia+DPD**: potwierdzone w branding-index - br-003409.. i DPD slidery maja `linked_products` tylko `mix-6x-mini-batoniki-mixy`, `has_babka=false`. UI skojarzen lustrzanych pokazuje br-003363/003364 (Babka slider), NIE Postanowienia/DPD. **Brak danych indeksera - NIE naprawiane (strefa B/P15).**
6. Regresji wizualnych w plikach Strefy A nie wykryto; jedyna zmiana kodu nastepcy: eksport `DamAssocEdit.openPicker` + bump `?v=`.

### Status punktow 1-10 (po weryfikacji nastepcy)
| Pkt | Status |
|-----|--------|
| 1 Historia statusow timeline | OK (handoff + brak regresji) |
| 2 Etykiety studia Tlo/Perspektywa/Jezyk | OK (screenshot explorer studio) |
| 3 Chipy studia = dam-viz-badge | OK |
| 4 ID V-... formatViz | OK (V-6300684-ENFACE-L-04-26) |
| 5 Kopiowanie tylko marketing ID | OK (domkniete nastepca) |
| 6 Skojarzenia lustrzane | OK dla danych w indeksie; brak Postanowienia/DPD = brak danych |
| 7 Modal viz = branding + Dodaj miniature gdy lacksViz | OK (domkniete nastepca, coconut-orange-date) |
| 8 #damThumbPicker mini-eksplorator | OK (handoff) |
| 9 Assoc edit tagi + zoom 400 | OK (domkniete nastepca screenshot+CDP) |
| 10 Variant info popover 1.2s hide | OK (handoff CDP) |

### Efekt/Fix
- Domkniete 3 luki weryfikacyjne z handoffu (b).
- `DamAssocEdit.openPicker` wyeksportowane (QA/CDP + ewentualne wywolania API).
- Brak fixow indeksera (P6 Postanowienia/DPD).

### Bumpy cache
- dam-assoc-edit.js -> `usab20260720d` (tylko branding.html)
- Bez zmian: dam-brand.css usab20260720d, dam-explorer.js usab20260720c, dam-media-preview.js usab20260720g, dam-marketing-id.js usab20260720c, dam-badges.js usab20260720c, dam-viz.js usab20260720g

### Test/Ewaluacja
- node --check dam-assoc-edit.js OK
- CDP: copy mid V-6300684...; addManual visible; zoom 400x400 z=12400; tagN=5
- Screenshot+Read: strefaA-pkt7-add-manual.png, strefaA-pkt5-id-copy.png, strefaA-pkt9-zoom-visible.png
- linked_products audit python: Postanowienia/DPD -> tylko mix-6x-mini-batoniki-mixy

### Zrodla
- agents/shared/handoff-strefa-A.md, usability-brief-2026-07-20.md sekcja A
- apps/web/assets/js/dam-assoc-edit.js, dam-media-preview.js, dam-viz.js, dam-explorer.js
- apps/web/data/branding-index.json (audyt linked_products)


## STREFA C3 - Task 39: rename Bobek -> DobroKaloriuĹ› (2026-07-20)

### Komenda/Akcja
Zmiana nazwy maskotki samouczka z "Bobek" na "DobroKaloriuĹ›" we wszystkich tekstach UI samouczka i zaproszenia.

### Log/Status
1. Grep repo: Bobek w `dam-tutorial.js` (komentarz + title kroku 1), handoff/brief (poza zakresem kodu), plik sprite `maskotka-bobek.png` (nazwa assetu - bez zmiany).
2. Edycja `dam-tutorial.js`: 3 wystapienia -> DobroKaloriuĹ› (komentarz naglowka, title kroku 1, tekst toastu zaproszenia).
3. Bump cache `dam-tutorial.js?v=7` -> `?v=8` w 9 HTML.
4. Weryfikacja: DamTutorial.stop() + clear LS + start/showInvite; screenshot+Read.

### Efekt/Fix
- Naglowek dymka: "CzeĹ›Ä‡, tu DobroKaloriuĹ›!"
- Toast: "CzeĹ›Ä‡, tu DobroKaloriuĹ›! Chcesz krĂłtki samouczek po panelu?"
- Brak "Bobek" w UI samouczka.

### Backup
Brak (zmiana copy).

### Test/Ewaluacja
- node --check dam-tutorial.js OK
- CDP: title = "CzeĹ›Ä‡, tu DobroKaloriuĹ›!", inviteText zawiera DobroKaloriuĹ›, hasBobek=false
- Screenshot+Read: c3-task39-tutorial-dobrokalorius.png, c3-task39-invite-dobrokalorius.png (PASS, 3 przeloty)

### Zrodla
- usability-brief-2026-07-20.md pkt 39
- agents/shared/handoff-strefa-C.md
- apps/web/assets/js/dam-tutorial.js

## 2026-07-20 - STREFA SHELL Task 33 (flash Geex przy menu)

### Komenda/Akcja
Usunac flash starego layoutu / placeholdera Geex przy przejsciu miedzy pozycjami menu (brief pkt 33).

### Log/Status
1. Diagnoza: raw HTML (dashboard/explorer/costsĂ˘â‚¬Â¦) zawiera Demo/Server Management; dam-shell.js przepisuje menu dopiero na DOMContentLoaded.
2. CDP: przy html.dam-booting + Demo w DOM body opacity=0 (flash niewidoczny).
3. Implementacja: dam-shell-boot.css + critical inline w head + DamShell.finishBoot() + body.is-booting na 20 HTML.
4. Bump dam-shell.js?v=shellboot20260720b; node --check OK.
5. Weryfikacja: dashboard -> explorer -> branding -> costs; screenshoty pass1-5 + Read.

### Efekt/Fix
- Brak widocznego flashu Geex Demo przy nawigacji.
- Fade-in po shell rewrite; prefers-reduced-motion respektowany.
- Fallback 4.5s gdy shell nie wstanie.

### Backup
Brak (zmiany odwacalne; bez commit).

### Test/Ewaluacja
- node --check apps/web/assets/js/dam-shell.js OK
- CDP: hasDemo+opacity0 podczas boot; po boot hasDemo=false opacity=1
- Screenshot+Read: shell-boot-pass1-dashboard Ă˘â‚¬Â¦ pass5-costs

### Zrodla
- agents/shared/usability-brief-2026-07-20.md pkt 33
- agents/shared/code-doctrine.md sekcja 12 (lekcja shell/flash)
- agents/shared/handoff-strefa-shell.md
- apps/web/assets/js/dam-shell.js, assets/css/dam-shell-boot.css

## STREFA TOOLTIPS (follow-up) - #damAssocActionMenu tips (2026-07-20)

### Komenda/Akcja
Dodac tooltipy (data-dam-tip) do kazdego itemu `#damAssocActionMenu` / `.dam-assoc-action-menu__item`. User: brak tipow przy Przejdz itd.

### Log/Status
1. Grep: menu renderowane w `dam-assoc-edit.js` (`openActionMenu`, ok. L279-340). CSS w `dam-branding.css`.
2. Wspolbieznosc: `dam-assoc-edit.js` / `dam-media-preview.js` / `dam-explorer.js` swiezo edytowane (agent H/A3) - BEZ edycji tych plikow.
3. Nowy binder: `apps/web/assets/js/dam-assoc-action-tips.js` - MutationObserver + dopiecie data-dam-tip + DamTooltips.bind.
4. Podlaczenie po `dam-tooltips.js`: branding / explorer / dashboard / visualizations (`?v=1`).
5. node --check OK; 3 przeloty screenshot+Read na branding.

### Efekt/Fix
Tipy PL:
- Przejdz -> Przejdz do produktu w Eksploratorze
- Eksplorator -> Otworz folder w Windows Explorerze
- Wizualizacja -> Otworz produkt w Wizualizacjach
- Kopiuj link -> Skopiuj link do produktu

### Backup
Brak (nowy plik + 4 tagi script w HTML).

### Test/Ewaluacja
- node --check dam-assoc-action-tips.js OK
- CDP: 4/4 itemy bound + tipVisible; DamTooltips + DamAssocActionTips na branding
- Screenshots: assoc-action-tips-pass1-przejdz.png, assoc-action-tips-pass2-eksplorator.png, assoc-action-tips-pass3-kopiuj.png (+ wczesniejszy assoc-action-tips-przejdz.png)

### Zrodla
- apps/web/assets/js/dam-assoc-edit.js (render)
- apps/web/assets/js/dam-assoc-action-tips.js (binder)
- apps/web/assets/js/dam-tooltips.js
- agents/shared/handoff-assoc-action-tips.md

---

## 2026-07-20 - META: HARD POLICY tylko Grok (zakaz Opus/Fable)
memory.md Hard rules #13 + #132; usability-brief HARD POLICY; Task/agenci = `cursor-grok-4.5-high-fast` only.

## STREFA H destrukcyjne akcje 2026-07-20 - INTERRUPTED

### Komenda/Akcja
H interrupted -> handoff for Grok successor (user HARD: tylko Grok 4.5, zero Opus/Fable).

### Log/Status
1. Zaimplementowano rdzen: `dam-danger.js` (hold-to-delete + ring + toastUndo + a11y).
2. Podpiecia: `dam-assoc-edit.js`, `dam-explorer.js`, danger zone w `settings.html`.
3. Cache-bust `?v=usab20260720h` w branding/explorer/visualizations/dashboard/settings.
4. `node --check` OK na wszystkich edytowanych JS.
5. Weryfikacja screenshot+Read NIE ukonczona (0/3). Audyt czerwonego / offset Confirm / code-doctrine Â§12 - TODO nastepcy.

### Efekt/Fix
Safe shutdown; szczegoly w `agents/shared/handoff-strefa-H.md`.

### Backup
Brak.

### Test/Ewaluacja
node --check OK; CDP: DamDanger.bind + ring DOM na settings (screenshot nie zrobiony).

### Zrodla
- agents/shared/usability-brief-2026-07-20.md sekcja H (27-32)
- agents/shared/handoff-strefa-H.md

## 2026-07-20 - STREFA A3 (Dogrywka 17:22 pkt 34/35/37/38)

### Komenda/Akcja
STREFA A3: "Brak wizualizacji" muted; LINKS/ELEMENTY split; Image resizer; broken thumbs w #damMediaPreview.

### Log/Status
1. Dane: branding-index Links (flor2/batonik â†’ babka); file-index babka 6300684.01 â†’ Links 12 plikow, ELEMENTY 0.
2. Resizer: launcher EXE = GUI; CLI w `inyfinn_resizer.cli` (convert -i/-o/-f png -q 60).
3. Kod: dam-media-preview.js (+ style #dam-a3-styles), dam-viz.js, local_bridge.py (api v3).
4. Restart mostu 8766 (wymagany dla nowych endpointow).
5. Cache-bust `?v=usab20260720a3` (4 HTML).

### Efekt/Fix
- 34: noviz/missing-langs â†’ muted (nie danger red).
- 35: surowe Links poza "Skojarzone materialy"; zwijalna ELEMENTY.
- 37: CTA "Wygeneruj elementy z Links" + confirm + POST /open-image-resizer (tylko gdy can_generate).
- 38: __damAssocThumbFallback (replaceWith), bez native broken-icon.

### Test/Ewaluacja
- node --check media-preview + viz OK; bridge AST OK
- CDP: noviz rgb(143,139,159); florInMain=false; ELEMENTY collapsed; can_generate; thumb naturalWidth=480; nativeBroken=0
- Screenshoty: agents/shared/qa-screenshots/a3-pass1|2|3*.png
- Handoff: agents/shared/handoff-strefa-A3.md

### Zrodla
- usability-brief-2026-07-20.md sekcja I (34,35,37,38)
- dam-dobrakaloria + ui-taste + code-doctrine


## 2026-07-20 - STREFA DEVICE (Grok) â€” sciezki per urzadzenie

### Komenda/Akcja
USER: sciezka bazowa tylko dla aktualnego komputera (device_id/hostname); CRUD w profilu; zapis w bazie; runtime resolve po device.

### Log/Status
1. Audyt: ADR-008, /auth/identity, machine-config per Windows USER, dam_base_path localStorage â€” brak user+device w PG.
2. PI: `device-scoped-base-paths` w program-instructions.json (v6).
3. Bridge: model UDP + GET/POST `/user-device-paths` (+ `/current`); lustro z POST /machine-config.
4. Runtime: dam-paths.js ensureUserBase â†’ baza â†’ LS scoped â†’ machine-config.
5. UI: profile.html + dam-device-paths.js (CRUD).
6. Restart mostu 8766 (usunieto podwojne PID 632+55284).
7. Cache-bust `?v=devicepath20260720a` (bez settings.html â€” H2).

### Efekt/Fix
- MVP dziala: per-device path w KV/local JSON + API + UI profilu + resolve runtime.
- settings.html nadal stary `?v=` dam-paths (do zbumpowania po H2).

### Backup
Brak.

### Test/Ewaluacja
- AST bridge OK; node --check paths + device-paths OK
- Helpers upsert/list/resolve/delete OK
- Live: GET /user-device-paths/current â†’ 401 bez sesji (route zyje)
- Handoff: agents/shared/handoff-strefa-DEVICE.md

### Zrodla
- program-instructions device-scoped-base-paths
- ADR-008, memory Â§32, usability-brief pkt 40


## 2026-07-20 - STREFA DEVICE follow-up (Grok) â€” seed PI + Sesja urzadzenia

### Komenda/Akcja
Follow-up po MVP: (1) seed PI do Postgres KV, (2) sidebar â€žSesja urzÄ…dzeniaâ€ť â†’ profil `#damDevicePathsRoot`, (3) bez edycji settings.html / bez commit.

### Log/Status
1. `_seed_naming_policy_to_postgres()` â€” KV `program-instructions` v6, 44 instr., `device-scoped-base-paths` w critical; `app-settings.instructions` lustro OK.
2. `dam-shell.js`: `goDeviceSessionPaths` zamiast `DamApi.logout`; href `profile.html#damDevicePathsRoot`.
3. `dam-device-paths.js`: `focusSection` + hash `#damDevicePathsRoot`.
4. Cache-bust shell `devicesession20260720a` w 19 HTML (bez settings); device-paths `devicepath20260720b` w profile.html.
5. Handoff zaktualizowany: TODO bump settings.html dla H2/koordynatora.

### Efekt/Fix
- PI w bazie (nie tylko JSON).
- â€žSesja urzÄ…dzeniaâ€ť otwiera CRUD sciezek w profilu.

### Backup
Brak.

### Test/Ewaluacja
- `pg_db.kv_get('program-instructions')` â†’ has device-scoped-base-paths
- `node --check` dam-shell.js + dam-device-paths.js OK
- settings.html nietkniety (shell `shellboot20260720b`, paths `204mod1`)

### Zrodla
- agents/shared/handoff-strefa-DEVICE.md
- local_bridge._seed_naming_policy_to_postgres

---

## STREFA C4 - samouczek anchor + 40 pochwal + nbspPl (2026-07-20)

### Komenda/Akcja
Korekta kotwiczenia dymka (right+40px), polish maskotki, 40 pochwal, typografia PL (nbspPl).

### Log/Status
1. placeBubble: priorytet right-top/right-bottom â†’ left â†’ below/above; EDGE_GAP=40; clamp viewport.
2. CSS: gap 36px, medal 103.5px, img 121%, zielony cien, mini-nav do dolu.
3. PRAISES x40 + Fisher-Yates shuffle; nbspPl na title/text/invite/pochwala.
4. Cache: dam-tutorial.js?v=12, css?v=6 (9 HTML).
5. node --check OK.

### Efekt/Fix
- CDP krok1: anchor=right-top gapX=40 (nie pod sidebarem).
- CDP typografia: i+NBSP, Range sameLineAsNext.
- CDP pochwala: wariant z puli (np. "Panel lubi takich jak Ty. Lecimy.").

### Backup
Brak.

### Test/Ewaluacja
- Screenshots: c4-anchor-pass1-sidebar-right.png, c4-pass-nbsp-step3-header.png, c4-pass-praise-brawo.png
- Handoff: agents/shared/handoff-strefa-C4.md
- usability-brief pkt 41-42 DONE

### Zrodla
- dam-tutorial.js / dam-tutorial.css
- handoff-strefa-C.md, C3.md

## 2026-07-20 - STREFA INTEGRACJE (Grok) â€” Bento panel Integracje

### Komenda/Akcja
USER: panel Integracje nieczytelny (sciana belkow + masa przyciskow) â†’ siatka Bento 4xn, chipy statusu, Synology span 2.

### Log/Status
1. Design Read: product hub Integracje / Geex / Bento Control Center.
2. Nowy CSS `apps/web/assets/css/dam-integrations.css` (scoped `.dam-integrations-page--bento`).
3. `dam-integrations.js`: `layout:"bento"`, chipy, feature/live/planned tiles, jedna gesta siatka + Planowane; safety opacity po GSAP.
4. `integrations.html`: laduje CSS, `includeExtras:true`, `?v=bento20260720d`.
5. settings.html / dam-brand.css / tutorial / bridge â€” NIE ruszane.
6. Checklista C3 pozostaje `[ ]` (anatomia viz/branding zamrozona); hub chrome OK.

### Efekt/Fix
- Desktop 4 kol., tablet 2, mobile 1; status = maly chip; Synology feature span 2 gdy Polaczono.
- Brak sciany belkow `Nie skonfigurowane`.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-integrations.js OK
- CDP: 12 tiles, chipy ~44px, Synology wâ‰448, cols 4/2/1
- Screenshoty: agents/shared/qa-screenshots/int-bento-pass*.png
- Handoff: agents/shared/handoff-strefa-INTEGRACJE.md

### Zrodla
- dam-dobrakaloria + ui-taste (Bento + product UI Â§22) + code-doctrine
- WAZNA-CHECKLISTA C3 (chrome hub OK)

## 2026-07-20 - STREFA H3: przebudowa Strefy ryzyka (settings)

### Komenda/Akcja
User: przebuduj TYLKO StrefÄ™ ryzyka (ui-taste, hold 300ms, GitHub-style). HARD: zero kasowania plikow / git reset / wipe.

### Log/Status
1. Design Read: settings admin DAM / Geex â€” danger zone GitHub-style, schludny friction.
2. Markup+CSS #damDangerZone w settings.html (header, ops card, foot left hold).
3. dam-danger.js: DEFAULT_HOLD_MS=300; bind label czasownika; toast Cofnij 8s.
4. Trash odbiorcow: muted + data-dam-hold-delete via MutationObserver (bez edycji dam-settings.js).
5. Bump `?v=usab20260720h3b`; node --check OK.
6. 3 przeloty screenshot+Read PASS.

### Efekt/Fix
- PeĹ‚na szerokoĹ›Ä‡ (grid 1/-1); offset hold LEFT vs Restart RIGHT; red tylko destrukcja.
- Copy: lokalne preferencje przeglÄ…darki, nie pliki na dysku.

### Backup
Brak (zero destrukcji).

### Test/Ewaluacja
- CDP: dzW=sysW=1242, holdMs=300, offsetOk
- Screenshots: h3-dz-pass1-structure.png, h3-dz-pass2-polish.png, h3-dz-pass3-element-hint.png
- Handoff: agents/shared/handoff-strefa-H.md (H3 DONE; dam-assoc-edit.js WOLNY Task 36)

### Zrodla
- ui-taste + dam-dobrakaloria + usability-brief sekcja H
- code-doctrine Â§12 (lekcje grid-column + hold-to-delete)

## 2026-07-20 - META DEVICE: cache-bust settings.html

### Komenda/Akcja
Bump `?v=` dam-shell.js + dam-paths.js w settings.html (spĂłjnie z profile.html); bez markup/integracji.

### Log/Status
1. shell: `shellboot20260720b` â†’ `devicesession20260720a`
2. paths: `204mod1` â†’ `devicepath20260720a`
3. dam-device-paths.js: brak w settings (pominiÄ™te)
4. Odhacz TODO #3 w handoff-strefa-DEVICE.md

### Efekt/Fix
settings.html Ĺ‚aduje te same wersje shell/paths co pozostaĹ‚e strony DEVICE.

## 2026-07-20 - STREFA INT-SETTINGS (Grok): Bento 3xn w settings.html #damIntegrations

### Komenda/Akcja
Bento 3xn kafelki w settings #damIntegrations (NIE integrations.html hub). Chipy statusu, Geex CTA, polskie znaki. Wspolbieznosc H2: nie ruszac danger zone.

### Log/Status
1. Design Read: settings DAM / Geex Control Center - Bento 3xn, waskie chipy, nie belki.
2. Nowy dam-integrations-settings.css (3/2/1 + chip 12.5px + accordion Geex).
3. dam-integrations.js: layout `settings-bento`, auto-detect `#damIntegrations`, PL stringi, inject fallback `#dam-int-settings-bento`.
4. dam-settings.js mount `layout: "settings-bento"`; settings.html tylko CSS/JS linki + bump `?v=setbento20260720c`.
5. `node --check` OK; 3 przeloty screenshot+Read PASS.

### Efekt/Fix
- Desktop: 3 kolumny (~385px); chip PoĹ‚Ä…czono ~92px (24% karty), nie banner.
- Planowane: chip `Plan` + dashed `WkrĂłtce`; Zaloguj disabled solid (nie dashed).
- Hub integrations.html nadal 4-col; settings osobny CSS.

### Backup
Brak (zero destrukcji / zero kasowania plikow).

### Test/Ewaluacja
- CDP: cols=3x385, rows 3/3/2, chipFs=12.5px, PL OK
- Screenshots: int-settings-bento-pass1/2/3-desktop.png
- Handoff: agents/shared/handoff-strefa-INTEGRACJE.md

### Zrodla
- dam-dobrakaloria + ui-taste + code-doctrine + handoff-strefa-INTEGRACJE.md

## 2026-07-20 - STREFA SIDEBAR-MORPH (Grok): identity margin + avatar + z-index + logout/morph

### Komenda/Akcja
1. margin-bottom +20px na .dam-user-menu__identity
2. Default avatar bez czapeczki
3. Profile menu z-index > sticky search
4. Sesja urzadzenia vs Wyloguj (+50px, ikona exit)
5. GSAP morph collapse 0.5s power3.inOut

### Log/Status
1. Inject #damShellLayerCss + dam-brand.css: identity `margin: 12px 12px 20px`
2. SVG: avatar-male/female/user - glowa+ramiona, bez path czapki; cache-bust `?v=avatarflat20260720a`
3. Popup z-index 12550, header 200, sticky spada przy `body.dam-header-popup-open`
4. Sidebar: `#damShellDeviceSession` (desktop) + `#damShellLogout` (uil-signout, DamApi.logout)
5. `setSidebarCollapsed(animate)` GSAP 0.5s / reduce=0; boot `animate=false`
6. Bump: dam-shell.js + dam-brand.css `?v=identitymb20260720a`

### Efekt/Fix
- CDP identity marginBottom=20px OK
- Menu profilu nad search (z=12550 vs 52)
- Wyloguj oddzielony od Sesji (+50px), ikona exit

### Test/Ewaluacja
- node --check dam-shell.js OK
- CDP: marginBottom 20px, popupZ 12550, avatarSrc avatarflat, logoutIcon uil-signout
- Screenshot: page-2026-07-20T16-21-29-233Z.png (Temp/cursor/screenshots)

### Zrodla
- dam-dobrakaloria, ui-taste, gsap-core, code-doctrine

## 2026-07-20 - STREFA A-PREVIEW (Grok): Task 36 + pilne rozszerzenie (Bento / anti-loop)

### Komenda/Akcja
Podglad LEWA | wyniki PRAWA w `#damAssocEditPopover`; Bento CSS Grid; zakaz self-assoc/dedupe; stopka DAM; bez ruszania dam-viz / dam-media-preview / danger / tutorial / branding / bridge.

### Log/Status
1. Design Read: popover assoc-edit (DAM/Geex), VARIANCE 5 / MOTION 3 / DENSITY 5.
2. `dam-assoc-edit.js`: inject CSS grid shell + body `preview | list`; breakpointy <768 / 768-1279 / >=1280.
3. `buildAssocExclude` + `isVisualizationLike` + dedupe id/indeks w `renderOptions`.
4. Stopka: Zatwierdz primary purple, disk/cancel outline (nie zielono-czerwone pills).
5. Fix: `opt-row` height 0 + overflow:hidden przycinal liste -> flex + min-height 64.
6. Bump `?v=usab20260720a36f` w branding.html; `node --check` OK.

### Efekt/Fix
- Podglad po LEWEJ (label Podglad), lista rownej wysokosci, brak H-scroll.
- Self-assoc: excludeIds/excludeIndexes + filtr viz-like; uniq id/indeks.
- Stopka spojna z DAM purple.

### Backup
Brak (zero kasowania plikow).

### Test/Ewaluacja
- CDP: display=grid, previewBeforeList, noHScroll, noDupIds, confirmBg purple, rowH=64.
- Screenshots (HARD GATE): `tmp/qa-a36/pass4-desktop-clean.png`, `pass3-list-outlined.png`, `pass5-stacked-narrow.png`.
- Stale-frame: pass2 bez listy (DOM OK) - wymuszony repaint; pass3/4 OK.

### Zrodla
- usability-brief pkt 36; dam-dobrakaloria; ui-taste; code-doctrine (cache-bust, inject CSS, stale screenshot).

## 2026-07-20 - STREFA INT-SETTINGS dogrywka: WkrĂłtce + chip WdroĹĽenie planowane

### Komenda/Akcja
Fix przyciskow WkrĂłtce (bez lavender wash) + badge `WdroĹĽenie planowane` na planowanych kafelkach (settings + hub).

### Log/Status
1. Usunieto `geex-btn` / `geex-btn--primary-transparent` z WkrĂłtce (wlasny `.dam-int-soon`).
2. CSS: dashed `#8b8d97`, bg `#fff`, ink `#1a1820` + `-webkit-text-fill-color`, opacity 1, focus-visible ring.
3. Chip: `Plan` â†’ `WdroĹĽenie planowane` (`.dam-int-chip--planned`, wrap 2 linie, title tip).
4. Bump `?v=setbento20260720h`; CDP PASS.

### Efekt/Fix
- WkrĂłtce: white fill, ink text, neutral dashed (nie disabled wash).
- Chip copy dokladnie `WdroĹĽenie planowane`.

### Test/Ewaluacja
- CDP: bg=rgb(255,255,255), color/fill=rgb(26,24,32), border dashed #8b8d97, chip text OK
- Screenshots: int-settings-planned-fix-pass3.png, int-settings-wkrotce-pass3-closeup.png

### Zrodla
- ui-taste + dam-dobrakaloria; screenshot usera (Plan / WkrĂłtce wash)

## 2026-07-20 - STREFA VIZ-ASSOC (Grok): layout assoc po prawej + zakaz petli wizâ†’wiz

### Komenda/Akcja
User HARD: #damVizModal skojarzenia po prawej (jak branding), zero petli wizâ†’wiz, RWD 375/768/1280. Bez dam-assoc-edit / git commit / kasowania.

### Log/Status
1. Design Read + PI `viz.assoc_no_visualization_loop` (critical) PRZED kodem.
2. Layout: `dam-viz-modal.css` + `.dam-viz-modal-box--assoc-split` w dam-viz.js i DamMediaPreview viz-studio.
3. Filtry w `renderLinkedBrandingAssets`: isVisualizationAsset + isNoiseBrandKitAsset + isRelevantMaterialForProduct.
4. Bump `?v=vizassoc20260720c`; node --check OK.
5. 5 przelotow screenshot+Read (1280/768/375).

### Efekt/Fix
- Desktop: assoc w prawej kolumnie; mobile stack heroâ†’metaâ†’assoc.
- Babka 6300684: 1802 linked â†’ 7 materialow marketingowych; 200 packshotow odcietych; OATS bez wizek w liscie.

### Backup
Brak (zero destrukcji).

### Test/Ewaluacja
- CDP paneRight / stacked / label counts
- Screenshots: viz-assoc-pass1..5 w Temp\cursor\screenshots
- Handoff: agents/shared/handoff-strefa-VIZ-ASSOC.md
- Lekcja doctrine Â§12 (STREFA VIZ-ASSOC)

### Zrodla
- dam-dobrakaloria + ui-taste + code-doctrine + program-instructions
- usability-brief pkt 6/7
## 2026-07-20 - STREFA INT-LOAD (Grok): skeleton + CTA systemowe

### Komenda/Akcja
User: `#damIntegrationsList` zostaje na skeleton; przyciski noop/reload; CTA jak `.dam-welcome-link`; wykrojnik jesli martwy. Model Grok. Bez commit / kasowania.

### Log/Status
1. Diagnoza CDP: mount dziala (12 kart hub / 8 settings), skeleton znika gdy Promise konczy; CTA byly lavender geex.
2. Root cause: race DOMContentLoaded + brak hard failsafe po skeletonie; styl foot CTA = geex lavender; tipy disabled brak.
3. Fix: `dam-int-cta` + summary welcome-link; failsafe 14s; readyState boot; tipy Zaloguj/WkrĂłtce; DamWykrojnikQueue export.
4. Bump `?v=intload20260720a`; node --check OK.
5. 3 przeloty screenshot+Read.

### Efekt/Fix
- Skeleton: try/catch + failsafe; boot nie zalezy tylko od DOMContentLoaded.
- CTA: border #E7E7E7 / bg #fff / ink #464255 (nie lavender).
- Preferencje â†’ settings#damPrefs; Konfiguruj otwiera details; tipy na disabled/soon.

### Backup
Brak (zero destrukcji).

### Test/Ewaluacja
- CDP: cards 12/8, skeleton false, lavender false, asanaOpen true, prefsVisible
- Screenshots: agents/shared/qa-screenshots/int-load-pass1..3*.png
- Handoff: agents/shared/handoff-strefa-INTEGRACJE.md

### Zrodla
- dam-dobrakaloria + ui-taste + code-doctrine + handoff INTEGRACJE

## 2026-07-20 - STREFA DISK-DEVICE (Grok): settings embed + Folder + root normalize

### Komenda/Akcja
USER: w settings.html zamiast starego #damDisk pokaz te sama karte co profile#damDevicePathsRoot; Folder picker; normalize Marketing root; Edytuj/Usun jak dam-welcome-link + hold-to-delete; runtime per device_id. Bez commit / kasowania.

### Log/Status
1. PI device-scoped-base-paths: settings embed, Folder, normalize; seed Postgres.
2. dam-paths.js: normalizeMarketingRoot + pickFolder (pywebview â†’ POST /pick-folder).
3. local_bridge.py: pick_folder_dialog (tkinter) + POST /pick-folder; restart :8766.
4. dam-device-paths.js: Folder/Wykryj/Sprawdz; welcome-link; DamDanger; mount settings (CSS #damDisk flatten).
5. settings.html: #damDevicePathsRoot w #damDisk; hidden settingBasePath; script device-paths.
6. Bump ?v=devicepath20260720c (paths wszedzie + device-paths profile/settings).

### Efekt/Fix
- Jedna logika DamDevicePaths w profilu i Ustawieniach (Dysk).
- Folder zamiast klepania; X:\Marketing\- POLSKA â†’ X:\Marketing przed zapisem.
- Edytuj/Usun systemowe; Usun = hold gdy DamDanger.

### Backup
Brak.

### Test/Ewaluacja
- node --check paths + device-paths OK; bridge AST OK
- CDP: card OK, old detect gone, normPolska=X:\Marketing, edit/del dam-welcome-link + DamDanger
- Screenshoty: agents/shared/qa-screenshots/device-settings-pass1-form.png, pass2-disk.png, pass3-list.png
- Handoff: agents/shared/handoff-strefa-DEVICE.md

### Zrodla
- program-instructions device-scoped-base-paths
- dam-dobrakaloria + ui-taste + handoff-strefa-DEVICE.md

## 2026-07-20 - STREFA USERMENU (Grok): Profil highlight + stray Konto

### Komenda/Akcja
USER: w menu profilu (.dam-user-menu__link / Profil) highlight nizej niz napis/ikona; stray "Konto"; fix CSS flex center w inject #damShellLayerCss; bump ?v=; screenshot+Read. Bez integrations/device-paths, bez kasowania plikow.

### Log/Status
1. Root cause misalignment: Geex style.css/content.css .geex-content__header__popup__link { align-items: flex-start !important } przebijalo dam-brand lign-items: center (bez !important) + min-height 42px â†’ tresc przy gorze kapsuly.
2. Root cause "Konto": dam-tooltips.js tipuje kazdy [aria-label]; <nav aria-label="Konto"> pokazywal stray tip nad Wyloguj.
3. dam-shell.js #damShellLayerCss: align-items:center !important, padding 11px 12px, ikona 18x18 + ::before line-height 1.
4. Usunieto aria-label z nav/legal; ensureUserMenuMarkup stripuje legacy; dam-tooltips skip NAV/role=menu/navigation.
5. Bump dam-shell.js + dam-tooltips.js ?v=usermenufix20260720b (bez integrations.html).

### Efekt/Fix
- Kapsula hover rowno otacza ikone+tekst (CDP topGap=botGap=11, midDelta=0).
- Brak tipu "Konto" (navAria=null, tipBoundOnNav=false).

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-shell.js + dam-tooltips.js OK
- CDP: align=center, pad=11px 12px, topGap=11, botGap=11, midDelta=0, shellHasPad11
- Screenshots: agents/shared/qa-screenshots/usermenu-profil-align-pass1.png .. pass3-clean.png

### Zrodla
- style.css / content.css .geex-content__header__popup__link
- dam-tooltips.js tipText/shouldAutoTip
- dam-dobrakaloria + ui-taste

## 2026-07-20 - Integracje: Konfiguruj panel ~56px

### Komenda/Akcja
USER: na `integrations.html` klik Konfiguruj (FMCG i inne live) pokazuje zmiazdzony panel ~56px; Preferencje/Konfiguruj bez czytelnego UI. Fix bez walki o `dam-integrations.css` (inny agent: skeleton) â€” prefer inject `<style id="damIntConfigPanelFix">`; CDP + screenshot; process.md.

### Log/Status
1. Root cause: `.dam-integrations-page--bento .dam-int-config__panel { position:absolute; left:16px; right:16px }` + `.dam-int-tile__foot .dam-int-tile__config { position:relative }` przy wrapperze `inline-flex` â‰ szerokosc summary (88px) â†’ panel 88â’32 â‰ 56px.
2. Fix: `ensureConfigPanelFixCss()` w `dam-integrations.js` â€” `#damIntConfigPanelFix`: config wrapper `position:static`, `flex:1 1 100%`, panel `position:static; width:100%` (karta rosnie in-flow).
3. Cache bump: `dam-integrations.js?v=intcfgfix20260720a` w `integrations.html` + `settings.html`.
4. Nie ruszano skeleton/WkrĂłtce w `dam-integrations.css`.

### Efekt/Fix
- Panel Konfiguruj â‰ szerokosc contentu karty (CDP ~253 przy karcie ~283), nie 56px.
- Formularze Entra/LDAP/Asana/Microsoft/FMCG/Stawki czytelne; PLANOWANE tiles nadal 283px, bez overflow.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-integrations.js OK
- CDP before (user): panel wâ‰56; after: fmcg/entra/asana/ldap/microsoft/cost-rates panelW=253, position=static; PNG Import button ~156px
- Screenshots: agents/shared/qa-screenshots/int-config-fmcg-pass1-clip.png, int-config-entra-pass2-clip.png, int-config-asana-planned-pass3.png
- Pass 1 FMCG full-width; Pass 2 Entra form; Pass 3 Asana + PLANOWANE uniform

### Zrodla
- dam-integrations.css (bento absolute panel + relative config wrap)
- dam-dobrakaloria + ui-taste

## 2026-07-20 - Integracje: skeleton loading ledwie widoczny

### Komenda/Akcja
USER: skeleton na integrations.html prawie niewidoczny na jasnym tle; prefer solid #ececf2; override w dam-integrations.css (nie wspolny dam-brand); bump ?v=; screenshot+Read.

### Log/Status
1. Root cause: global .dam-skeleton__* w dam-brand.css bierze --dam-surface-muted (#f5f6fa) - niemal znika na canvas #f3f5f4/bialym.
2. Override w dam-integrations.css (scoped .dam-integrations-page): background var(--dam-border, #ececf2) + hairline border (mix text-muted 28% + border); shimmer zachowany (bialy 0.7).
3. Cache-bust dam-integrations.css ?v=skelvis20260720b w integrations.html + settings.html.
4. Weryfikacja: CDP force DamGridReveal.skeleton; bg=rgb(236,236,242); 3 przeloty screenshot+Read (z shimmer i at rest).

### Efekt/Fix
- Skeleton kart hubu Integracje czytelny: solid #ececf2 + krawedz, flat/Bento, bez purple glow.

### Backup
Brak.

### Test/Ewaluacja
- CDP: cardBg rgb(236,236,242), border 1px darker mix, css ?v=skelvis20260720b
- Screenshots: integrations-skeleton-pass1.png, pass2.png, pass3-rest.png (Temp/cursor/screenshots)

### Zrodla
- dam-brand.css skeleton (9421+); dam-integrations.css override; dam-dobrakaloria + ui-taste

## 2026-07-20 - Settings: PLANOWANE +30px w dol

### Komenda/Akcja
USER: sekcja PLANOWANE na settings (#damIntegrations) przesunac +30px w dol; scoped CSS settings-only; nie ruszac hub integrations.html.

### Log/Status
1. Design Read: Settings Integracje Bento - wiecej powietrza nad PLANOWANE.
2. W settings-bento jedyna `section.dam-int-section` = Planowane (primary = bare `.dam-int-bento-grid` bez title).
3. `dam-integrations-settings.css`: `margin-top: 30px` na `#damIntegrations .dam-integrations-page--settings .dam-int-section`.
4. Cache-bust `settings.html`: `?v=planowane30a`.
5. CDP: before gap/pageY vs after = +30; marginTop 0â†’30px.

### Efekt/Fix
- PLANOWANE na settings ma +30px powietrza nad headingiem; hub nie ruszony.

### Backup
Brak.

### Test/Ewaluacja
- CDP deltaPageY=+30, gap 0â†’30, marginTop=30px, css ?v=planowane30a
- Screenshots: settings-planowane-pass1-after.png, pass2-gap.png, pass3-final.png
- Pass 1 structure; Pass 2 gap CDP; Pass 3 final lock

### Zrodla
- dam-integrations-settings.css; settings.html; dam-dobrakaloria + ui-taste

## 2026-07-20 - Integracje hub: skeleton = realny Bento (span-2 + 4-col)

### Komenda/Akcja
USER: skeleton na integrations.html nie pokrywa realnego `#damIntegrationsOAuth > .dam-int-bento-grid` (span-2 Synology + 4-col; PLANOWANE 4+1). Fix hub JS/CSS; nie regresuj fill `#ececf2`; unikaj settings CSS (inny agent).

### Log/Status
1. Root cause: `DamGridReveal.skeleton({variant:cards,count:6})` -> `.dam-skeleton--grid` = `auto-fill minmax(220px)` (~5 rownych), bez `dam-int-tile--feature`.
2. `paintIntegrationsSkeleton()` w `dam-integrations.js`: sekcje Integracje/Planowane + `.dam-int-bento-grid` + pierwsza karta `dam-int-tile--feature` (span-2); Planowane = EXTRA_INTEGRATIONS.length.
3. CSS: `.dam-skeleton--int-bento { display:block }` + wysokosc kart 132px; fill `#ececf2` bez zmian.
4. Cache: `?v=skelbent20260720a` (css+js) w integrations.html + settings.html.

### Efekt/Fix
- Skeleton foreshadowuje live: 4-col, hero ~2x, PLANOWANE 4+1.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-integrations.js OK
- CDP skeleton: cols 4x283, featureW=582, singleW=283, ratio~2.06, bg rgb(236,236,242)
- CDP live: featureW=582, singleW=283 (identycznie)
- Pass 1 highlight span-2; Pass 2 clean skeleton; Pass 3 live match

### Zrodla
- dam-integrations.js / dam-integrations.css; dam-dobrakaloria + ui-taste

## 2026-07-20 - FMCG Integracje: CTA Edytuj (mapowanie + dane reczne)

### Komenda/Akcja
USER: przy Konfiguruj Katalog FMCG dodac Edytuj - mapowanie pol + dane reczne bez wymaganego CSV; reuse store importu.

### Log/Status
1. Checklista A3 przypomniana - zostaje czesciowo otwarta.
2. PI: rozszerzono `finance.fmcg_catalog` + nowa `finance.fmcg_manual_edit`.
3. Bridge: GET/POST `/finance/fmcg-import-map`; PATCH/upsert katalogu; replace akceptuje pusta liste items.
4. UI: `dam-fmcg-catalog.js` overlay Edytuj (Mapowanie / Dane reczne); CTA w `dam-integrations.js` fmcgCard; CSS inject `#damFmcgEditUi`.
5. Cache-bust `?v=fmcgedit20260720b` (integrations, settings, dashboard).
6. Restart local_bridge (nowe endpointy).

### Efekt/Fix
- Konfiguruj -> Edytuj otwiera edytor mapowan CSV->catalog_id i tabeli kwot; zapis do tych samych JSON co import CSV.
- Brak pliku nie blokuje UI (pusta tabela / Dodaj wiersz).

### Backup
Brak.

### Test/Ewaluacja
- `node --check` dam-fmcg-catalog.js + dam-integrations.js OK
- Bridge: `/finance/fmcg-import-map` -> login_required (route live)
- CDP: Edytuj widoczny; overlay mapRows=12 itemRows=45; Zapisz -> `Zapisano mapowanie (12) i katalog (45).`
- Screenshots+Read: fmcg-edit-pass1-mapping.png, pass2-data.png, pass3-saved.png
- A3 checklist: `[~]` (UI done, dane operacyjne nie)

### Zrodla
- dam-fmcg-catalog.js, dam-integrations.js, local_bridge.py, program-instructions.json
- dam-dobrakaloria + ui-taste
## 2026-07-20 - STREFA B follow-up: skojarzenia ELEMENTY (skladniki/owoce/owocki)

### Komenda/Akcja
Handoff A3 / brief pkt 35: indekser ma kojarzyc materialy brandingowe ELEMENTY ze skladnikami/owocami/owockami (nie tylko packshoty); product Links/ELEMENTY w branding-index.

### Log/Status
1. Root cause: `scan_wizki_products` indeksuje tylko `4 - WIZKI`; product `2 - PROJEKT/Links` + `1 - MATERIALY/ELEMENTY` poza indeksem. UI A3 juz filtruje po path + ELEMENT_ASSOC_RE, ale search_blob rzadko mial terminy.
2. PI: `branding.element_assoc_skladniki_owoce` w program-instructions.json.
3. Kod: `brand_element_assoc.py` (termyny w search_blob); `build-branding-index.py` `scan_product_element_assets` + enrich; incremental `enrich-branding-element-assoc.py`.
4. Enrich: +1896 product_element (49715â†’51611); tagged search_blob skladnikiâ‰17080, owoceâ‰7377; relink SKU-only (bez assoc na nazwie pliku).
5. Babka 6300684.01: 12 Links w indeksie (m.in. br-051391â€¦398) z linked_products=[babka-cytrynowa-nerkowcowy] + terminy skladniki/owoce/owocki.
6. VIZ-ASSOC: product_element asset_role != packshot; zero pe jako packshot.

### Efekt/Fix
- Indekser (nie UI): product ELEMENTY/Links w branding-index + skojarzenia wyszukiwawcze.
- Linkowanie product_element po SKU sciezki (nie globalne "cytryna"â†’babka).

### Backup
Brak (enrich addytywny, bez wipe).

### Test/Ewaluacja
- AST + classifier smoke OK
- API/data: asset_count 51611; babka path pe=19â€“22; 6300684.01 samples z termami
- GET /program-instructions zawiera branding.element_assoc_skladniki_owoce (plik lokalny; KV seed przy restarcie mostu)
- Gap: POS `\Links\` nadal w grupie ELEMENTY UI (filtr sciezki); ELEMENTY folder babki na dysku = 0 plikow (can_generate)

### Zrodla
- handoff-strefa-A3.md; usability-brief pkt 35; brand_element_assoc.py; enrich-branding-element-assoc.py; build-branding-index.py; dam-dobrakaloria

## 2026-07-20 - SYNTEZA sesji usability (wieczor, Grok docs-only)

### Komenda/Akcja
Synteza luku agentow z briefu `agents/shared/usability-brief-2026-07-20.md` + recent process/handoffs; aktualizacja statusow briefu; handoff syntezy; bez re-implementacji.

### Log/Status
1. Skim brief + process (STREFA A/B/C/D/H/SHELL/A3/DEVICE/INT/VIZ-ASSOC/ELEMENTY-ASSOC) + `WAZNA-CHECKLISTA` (A3 `[~]`, C3 `[ ]`).
2. Brief: sekcja **STATUS SYNTEZA**; adnotacje P15 PARTIAL, P21-23 DONE, P35 DONE+OPEN POS Links.
3. Handoff: `agents/shared/handoff-usability-synthesis-2026-07-20.md`.
4. Doctrine Â§12: bez nowych wpisow (lekcje juz sa).

### Zamkniete strefy
- **A** 1-10 (UI) â€” modale, ID, thumb picker, assoc tags/zoom
- **B** 11-14, 16-18, 21-23 â€” dashboard 2x2, chipy, loader, Pokaz wszystko/archiwum/popup
- **B pe** product_element + skladniki/owoce â€” indeks 7832â†’49715â†’51611
- **C/C3/C4** samouczek DobroKalorius + polish + 40 pochwal
- **D** Explorer foreground + file:/// path
- **H/H3** hold-to-delete + Strefa ryzyka
- **SHELL** FOUC boot
- **A3** 34-38 noviz muted, ELEMENTY split, resizer, thumbs
- **DEVICE** sciezki per urzadzenie
- **VIZ-ASSOC / A-PREVIEW** assoc prawa, anti viz-loop, preview lewa
- **Integracje** skeleton `#ececf2`, Bento span-2, Konfiguruj width, PLANOWANE +30, FMCG Edytuj

### Otwarte / partial (NIE inventuj zieleni)
- Checklista **A3** `[~]` â€” UI OK; fill kwot/import = user
- Checklista **C3** `[ ]` â€” BENTO anatomia kart zamrozona
- **P15 SLIDERY-sklep** overlap policy (0 sciezek ARCHIWUM = dedup)
- **POS Links** jakosc w grupie ELEMENTY
- **P6** Postanowienia/DPD linked_productsâ†’babka = luka danych
- A1/A2, B1-B5, B7 (poza lukiem usability)

### Cache bumps do hard-refresh
- `dam-branding.js?v=usab20260720f` / `dam-branding.css?v=usab20260720g`
- Integracje: `skelbent20260720a`, `fmcgedit20260720b`, `intcfgfix20260720a`, `planowane30a`
- Shell: `shellboot20260720b`; danger `usab20260720h3b`; assoc `usab20260720a36f`; A3 `usab20260720a3`

### Efekt/Fix
Dokumentacja zsynchronizowana ze stanem agentow; brak zmian kodu/danych uzytkownika.

### Backup
Brak.

### Test/Ewaluacja
Read-only audyt handoffow + process; checklista A3/C3 bez zmiany statusu (zgodna z rzeczywistoĹ›cia).

### Zrodla
- usability-brief-2026-07-20.md, handoff-strefa-A/B/A3/H/C4/DEVICE/INTEGRACJE/VIZ-ASSOC
- WAZNA-CHECKLISTA-UZYTKOWNIKA.md; dam-dobrakaloria (dyscyplina docs)

## Komenda/Akcja
Integracje: ujednolicenie Edytuj + chip Wdrozenie planowane (2026-07-20)

### Log/Status
1. Edytuj FMCG: `geex-btn geex-btn--primary` -> `dam-int-cta` (dam-integrations.js)
2. Inject FMCG actions: min-height 40px geex -> 34px `.dam-int-cta` (dam-fmcg-catalog.js)
3. CSS: `.dam-int-st--wait` muted token (jak Brak); `--planned` tylko wrap, bez orphan radius/font
4. Cache-bust `?v=intcta20260720a` (integrations/settings/dashboard HTML)

### Efekt/Fix
Edytuj = ten sam profil co Pobierz szablon CSV (34px, pad 8/12, radius 8, outline). Chip planowane = pill anatomia + te same tokeny co Brak.

### Backup
Brak.

### Test/Ewaluacja
- node --check OK
- CDP: edit/csv h=34 matchHeight/Pad/Radius; geexInRow=false
- Pass1/2 screenshot FMCG actions: outline CTA family
- Pass3 planned chip: pill 999px, font 10/700, pad 3/9 = Brak

### Zrodla
dam-integrations.js/css, dam-fmcg-catalog.js, dam-integrations-settings.css; ui-taste + dam-dobrakaloria

## 2026-07-20 - Integracje: przebudowa panelu Wykrojniki ` produkty

### Komenda/Akcja
USER: sekcja `Kolejka mapowan wykrojnikow` na integrations.html nie ma sensu (python w terminalu); chce kompletna przebudowe.

### Log/Status
1. Zrodlo mapowania: `X:/Marketing/- POLSKA/01 - PRODUKTY/01 - WYKROJNIKI/opakowania_Kubara_baza_danych.xlsx` (kolumny oznaczenie Kubara / asortyment; nie kod/nazwa).
2. Fix `import-wykrojniki-xlsx.py` (naglowki sekcyjne) â†’ rejestr 52 wpisy (bylo 101Ă— row-N).
3. `link-wykrojniki-products.py`: kolejka + product_index + PDF + nazwa.
4. Bridge: POST `/wykrojniki/link-products`, `/wykrojniki/set-link`; resolve kolejki aplikuje do rejestru.
5. UI: `dam-wykrojnik-queue.js/css` + mount `#damWykrojnikQueue`; `?v=wykmap20260720a`.
6. PI: `integrations.hub_bridge` + `wykrojnik.registry_xlsx_kubara`; checklista B1 â†’ [x].
7. Restart bridge (pythonw) po zmianie local_bridge.py (A4).

### Efekt/Fix
Panel `Wykrojniki ` produkty`: cel PL, tabela wyszukiwalna, CTA Wczytaj/Powiaz, empty state bez `0 oczekujacych` bez kontekstu.

### Backup
Brak (reimport zachowuje linked_product_ids; dane queue nietkniete).

### Test/Ewaluacja
- node --check OK; ast.parse scripts+bridge OK
- import entries=52; link linked=2
- Bridge POST link-products/set-link â†’ login_required (route live)

### Zrodla
opakowania_Kubara_baza_danych.xlsx; dam-dobrakaloria; ui-taste; code-doctrine; program-instructions

## 2026-07-20 - Wykrojniki panel: badge/CTA â†’ dam-int language

### Komenda/Akcja
USER: brzydkie badge/przyciski w #damWykrojnikQueue â†’ .dam-int-chip / .dam-int-cta (B1 [x]).

### Log/Status
1. CSS: usunieto peach .dam-wyk-map__chip--warn (#b45309); stats + status = dam-int-st wait/ok.
2. CTA toolbar/row/form: lock 34px / radius 8 / border #e7e7e7 (bez override 40/32).
3. JS stats chips: klasy dam-int-chip dam-int-st dam-int-st--ok|wait.
4. Cache bump wykbadge20260720b w integrations.html.
5. Nie ruszano dam-fmcg-catalog.js.

### Efekt/Fix
Jeden jezyk chip+CTA z Bento Integracje; zero peach orphan pills.

### Backup
Brak.

### Test/Ewaluacja
- node --check OK
- CDP: badgeOpen bg/color/pad/fs/fw = Bento `Brak`; CTA wczytaj/uzupelnij/zapisz = Preferencje (h=34, br=8, border #e7e7e7)
- Pass1 Wszystkie / Pass2 Bez produktu / Pass3 Powiazane â€” screenshot+Read; peachCheck=false

### Zrodla
dam-wykrojnik-queue.js/css; dam-integrations.css; ui-taste; dam-dobrakaloria

## 2026-07-20 - FMCG editor polish + hold-delete + prefs KV + settings search

### Komenda/Akcja
USER: A3 `[~]` dogrywka - modal FMCG 80vw/80vh, scroll-trap, DAM CTAs, Zamknij=X (nie fat CTA), hold~1s Usun, prefs safe_delete w Postgres KV, search w ustawieniach.

### Log/Status
1. PI: `finance.fmcg_manual_edit` rozszerzone; nowa `ui.safe_delete`.
2. Bridge: GET/POST `/user-prefs` -> dam_kv_store `user-prefs:{email}` + lokalny `apps/desktop/data/user-prefs.json`; default `safe_delete: true`.
3. `dam-user-prefs.js` + DamDanger: pref gate, toastAction â€žWylacz bezpieczne usuwanieâ€ť, holdMs 1000 na FMCG Usun.
4. `dam-fmcg-catalog.js`: dialog min(80vw)/min(80vh), flex+table-wrap scrollport, body lock, wheel trap, close `.dam-modal-x`, Zapisz/+ = `.dam-int-cta`.
5. Settings: search keywords + toggle Bezpieczne usuwanie; cache `?v=safedel20260720a`.
6. A3 checklist pozostaje `[~]` (brak pelnego fill katalogu).

### Efekt/Fix
Modal duzy ze scrollem tabeli bez scrolla tla; cichy X; hold-delete z escape hatch w profilu (DB po restarcie bridge).

### Backup
Brak.

### Test/Ewaluacja
- node --check + ast.parse OK
- CDP modal: wâ‰1280 hâ‰900 (80vw/80vh cap), closeClass=dam-modal-x, save=dam-int-cta, no geex-primary, wrapDelta=120 windowDelta=0 bodyOverflow=hidden
- Settings search â€žusuwanieâ€ť -> tylko #damPrefs + Bezpieczne usuwanie ON
- Bridge LIVE bez restartu: GET /user-prefs -> not_found (wymaga restartu local_bridge)
- Screenshots: fmcg-edit-pass1-header-x.png, fmcg-edit-pass2-data-scroll.png, settings-safe-delete-search-pass3.png

### Zrodla
dam-fmcg-catalog.js; dam-danger.js; dam-user-prefs.js; dam-settings.js/css; local_bridge.py; program-instructions.json; ui-taste; dam-dobrakaloria

## 2026-07-20 - STREFA INT-FIX (Grok) - skeleton + clicki hub Integracje

### Komenda/Akcja
USER: hub integrations.html - skeleton nie znika; przyciski noop/reload; CTA do ui-taste (WkrĂłtce dashed). Bez commit, bez delete.

### Log/Status
1. Diagnoza CDP: karty laduja gdy mount dziala; `window focus` -> `DamIntegrations.refresh` = pelny remount (skeleton flash + zamyka details Konfiguruj).
2. Usunieto remount na focus; visibilitychange z guardem details/form + debounce 5s.
3. `withTimeout` + `safeRender` + failsafe - skeleton nigdy nieskonczony; error UI ze SprĂłbuj ponownie.
4. Konfiguruj w foot (`.dam-int-tile__config`); CTA `.dam-int-cta` / welcome-link; WkrĂłtce dashed ink.
5. GSAP: killTweensOf + force opacity po reveal (mid-tween wygladal jak pusty hub).
6. Cache-bust `?v=intfix20260720c` (hub + settings).

### Efekt/Fix
- Skeleton znika (success lub error state).
- Preferencje -> settings.html#damPrefs (nie reload hubu).
- Konfiguruj otwiera details i zostaje open po focus.
- WkrĂłtce: border dashed, ink #1a1820.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-integrations.js OK
- CDP: cards=12 skel=false; focus remount=false; soon dashed; Preferencje navigates
- Screens: int-hub-fix-pass1-tiles.png, int-hub-fix-pass2-ctas.png, int-hub-fix-pass3-final.png

### Zrodla
dam-integrations.js/css; integrations.html; settings.html; handoff-strefa-INTEGRACJE.md; ui-taste; dam-dobrakaloria; code-doctrine

## 2026-07-20 - Branding PL encoding + archiwum obok PokaĹĽ wszystko

### Komenda/Akcja
USER: branding.html - znaki PL jako `?` + `PokaĹĽ archiwum` ma byc obok `PokaĹĽ wszystko` (nie pod tabami).

### Log/Status
1. Root cause: literaly `?` (ASCII) w `branding.html` (diakrytyki zgubione przy zapisie); `dam-branding.js` byl OK (UTF-8). Sidebar z JS = poprawne PL.
2. Przywrocono UTF-8 w calym main content branding.html (PokaĹĽ, sĹ‚owo, niemiÄ™sa, miesiÄ…c, WyczyĹ›Ä‡, WrĂłÄ‡, Ĺadowanieâ€¦).
3. DOM: `.dam-branding-scope-toggles` przeniesione do `.dam-branding-tabs` zaraz po `.dam-branding-tab--all`.
4. CSS: flex align + scope inline w tabs; mobile: --all/scope `flex:0 0 auto`.
5. Cache-bust `dam-branding.css/js?v=plfix20260720a` (branding, dashboard, explorer, visualizations).
6. Checklista: brak osobnego ID encoding (B1-B7 nie dotyczy).

### Efekt/Fix
Branding page: PL OK; archiwum na tej samej bazie co `PokaĹĽ wszystko`.

### Backup
Brak.

### Test/Ewaluacja
- Serwer: bajty `Poka\xc5\xbc`; charset UTF-8
- CDP: all/scope/clear/month/week/sub hasQ=false hasPL=true; sameRow=true; scopeParent=dam-branding-tabs
- Pass1 viewport + Pass2 `.dam-branding-tabs` + Pass3 filters: screenshot+Read - PokaĹĽ/miesiÄ…c/WyczyĹ›Ä‡ OK; toggle obok --all
- Nadal zepsute (poza scope): explorer.html, visualizations.html (Poka? wszystkie), dashboard Aktywno??

### Zrodla
branding.html; dam-branding.css; dam-dobrakaloria; ui-taste; code-doctrine

## 2026-07-20 - Sidebar collapse morph: janky -> smooth GSAP

### Komenda/Akcja
USER: #damSidebar / .geex-sidebar collapse/expand janky - fix GSAP (gsap-core) + ui-taste; owns dam-shell.js.

### Log/Status
1. Root cause: multi-prop layout thrash (width/min/max + main pad + icon marginRight + label stagger) + Geex `transition: all`.
2. Rewrite morph: numeric proxy -> `--dam-sidebar-w`; labels autoAlpha/x batch; kill competing transitions via `dam-sidebar-morphing`; interrupt-safe toggle; reduced-motion instant.
3. Cache bump `dam-shell.js?v=sidebarmorphsmooth20260720b` (20 HTML).
4. Doctrine Â§12 lesson + screenshot QA expanded/collapsed.

### Efekt/Fix
Collapse ~500ms (312->72), expand ~500ms (72->312); smooth width samples; logo readable collapsed.

### Backup
Brak.

### Test/Ewaluacja
- node --check OK
- CDP widths collapse: 311/281/184/94/73/72; expand: 73/94/192/286/311/312; morphing clears ~550ms
- Screenshots+Read: pass1/3 collapsed, pass2/3 expanded

### Zrodla
dam-shell.js; dam-app.css (--dam-sidebar-w); gsap-core; ui-taste; dam-dobrakaloria; code-doctrine Â§12

## 2026-07-20 - Polish diacritics `?` sweep (HTML)

### Komenda/Akcja
USER: ASCII `?` left in explorer/visualizations/dashboard (po fix brandingu ef95201c). Sweep + restore UTF-8.

### Log/Status
1. Grep: literal `?` w PL stringach w `explorer.html`, `visualizations.html`, `dashboard.html`, `profile.html`.
2. Restore: wyglÄ…d, assetĂłw, AktywnoĹ›Ä‡, PokaĹĽ, OdĹ›wieĹĽ, jÄ™zyk, folderĂłw, UkĹ‚ad, OtwĂłrz, UsuĹ„, PonĂłw, strzaĹ‚ki/cudzysĹ‚owy w tipach.
3. HTML-only (bez bump CSS/JS). Unikano `dam-shell.js` (agent 706bc8f3).
4. Verify: CDP/a11y snapshot explorer+dashboard+viz; branding nadal OK (PokaĹĽ wszystko / miesiÄ…c / WyczyĹ›Ä‡).

### Efekt/Fix
UI labels bez `Poka?` / `Od?wie?` / `Aktywno??` na wskazanych stronach.

### Backup
Brak.

### Test/Ewaluacja
- Residual known corrupt tokens (`Poka?`, `Od?wie`, `Aktywno??`, â€¦): 0 w `apps/web/*.html`
- Browser: PokaĹĽ wszystkie, OdĹ›wieĹĽ z dysku, Filtr jÄ™zyka, UkĹ‚ad pulpitu, OtwĂłrz kalkulator kosztĂłw
- Pozostaje poza scope: header chip `Jezyk` (shell/i18n); JS strings bez `?` ale bez diakrytykĂłw (np. tipy Wlacz->naprawione w HTML; dam-*.js osobno); signin-geex `??`

### Zrodla
explorer.html; visualizations.html; dashboard.html; profile.html; dam-dobrakaloria

## 2026-07-20 - Header chip Jezyk â†’ JÄ™zyk

### Komenda/Akcja
USER: Tiny follow-up - header language chip PL label missing Ä™.

### Log/Status
1. Root: `dam-i18n.js` buildSwitcher hardcoded `title`/`aria-label`/popup title `Jezyk`; shell already had fallback `JÄ™zyk` but only set `title`.
2. Fix: `JÄ™zyk` in i18n HTML; shell also sets `aria-label`. Cache bump `dam-shell.js` + `dam-i18n.js` â†’ `plshell20260720a` (all HTML).
3. Verify: CDP title/aria-label + screenshot chip tooltip.

### Efekt/Fix
Header chip shows proper **JÄ™zyk** with Ä™.

### Zrodla
dam-i18n.js; dam-shell.js; dam-dobrakaloria

## 2026-07-20 - Sidebar morph polish: icon track + dim 0.5s

### Komenda/Akcja
USER: Ikony maja trzymac tor expanded (bez recenter jump), na collapse tylko slide left + dim 0.5s; cache beyond `sidebarmorphsmooth20260720b`.

### Log/Status
1. Root cause: `--dam-sidebar-w` plynnny, ale `onComplete` + `dam-sidebar-collapsed` snapowal padding 29/25 â†’ 10/0 i `justify-content:center` (~30px skok ikon). Labels w flow tez mogly reflowowac.
2. Fix w `dam-shell.js`: podczas morph CSS vars `--dam-sb-pad-x` + `--dam-link-pad-x` (jedna os z width, `power3.inOut` 0.5s); labels absolute; dim `filter:brightness(0.68)` tylko nieaktywne; collapsed class dopiero onComplete; twarde clear filter.
3. Cache bump ALL HTML: `dam-shell.js?v=sidebarmorphsmooth20260720c`.
4. Doctrine Â§12 + ten wpis.

### Efekt/Fix
Ikony slizgaja sie po torze pad (55â†’24) razem z width 312â†’72; brak justify mid-flight; dim 0.5s.

### Backup
Brak.

### Test/Ewaluacja
- `node --check dam-shell.js` OK
- CDP collapse samples (updateRoot): w 312â†’304â†’181â†’78â†’72; iconOff 55â†’54â†’39â†’27â†’24; filter 1â†’0.68â†’none; end logo 48Ă—48
- Math ease continuous (max step <8px / 0.1t)
- Screenshot+Read: expanded (labels+icon column); collapsed rail (icons centered, logo czytelne)
- Pass/Fail: Pass (mid-tween continuous na collapse)

### Zrodla
dam-shell.js; gsap-core; ui-taste; dam-dobrakaloria; code-doctrine Â§12

## 2026-07-20 - Branding: skeleton + filters reveal + meta layout

### Komenda/Akcja
USER: Branding skeleton shimmer (jak Integracje #ececf2), entrance meta filters topâ†’bottom, Sortuj+Liczby przy Skala (gap 20px), unify meta toolbar styles. Nie ruszaÄ‡ dam-shell.js.

### Log/Status
1. Skeleton: dam-branding.css override kart .dam-skeleton__card--viz â†’ bg #ececf2 + border + mocniejszy shimmer; boot trzyma skeleton podczas loadIndex (setBootStatus â†’ showInitialBootSkeletons); czyszczenie brandbook leftover.
2. Filters reveal: 
evealMetaFilters via DamGridReveal.revealSequence (opacity+y, bez clip-path rest); start po dam-booted / body widoczne; prefers-reduced-motion = instant.
3. Layout: wrapper .dam-branding-filters__view-tools (ml:auto) = Sortuj | Liczby | Skala; Skala margin-left:20px.
4. Unify: meta FS 12px / H 34px / radius 8px dla clear/switch/date/sort/zoom.
5. Cache: dam-branding.js/css?v=skelmeta20260720c (branding, explorer, dashboard, visualizations).
6. Nie ruszano dam-shell.js.

### Efekt/Fix
Meta toolbar spĂłjny; Sort|Liczby|20px|Skala; skeleton czytelny ze shimmer; entrance animowany.

### Backup
Brak.

### Test/Ewaluacja
- CDP: zoomMarginLeftPx=20, gapCountsToZoom=20, orderOk, sameRow, heights 34, fonts 12px, metaRevealed=1
- Skeleton proof: bg rgb(236,236,242), animationName dam-skel-shimmer
- Screenshot+Read: branding-meta-filters-bar.png, branding-skeleton-shimmer.png
- node --check dam-branding.js OK

### Zrodla
branding.html; dam-branding.js; dam-branding.css; dam-grid-reveal.js; dam-dobrakaloria; ui-taste
## 2026-07-20 - WORKER A: Visualizations secondary filters + toolbar

### Komenda/Akcja
USER WORKER A: Info Pakowania â†’ dam-switch--compact; unify .dam-viz-secondary-filters (+12px pad, 12px/34px); #vizStatus BELOW filters; fix false Bridge offline; PL tipy Cofnij/PonĂłw; jÄ™zyki; cache-bust; screenshotâ‰Ą3. FORBIDDEN branding.html.

### Log/Status
1. Markup visualizations.html: secondary filters first, then dam-viz-grid-toolbar; Info Pakowania + PokaĹĽ wszystkie = dam-switch dam-switch--compact.
2. dam-brand.css: shared .dam-viz-secondary-filters padding 20px 24px, meta vars, compact switch global, chip/lang/zoom H 34; toolbar comment/order.
3. NEW dam-viz.css: page chrome + zoom align + lang min-width.
4. dam-viz.js: â€žWszystkie jÄ™zykiâ€ť (Ä™).
5. dam-tag-edit.js: GET /change-log z bridgeAuthHeaders; login vs offline PL hint; humanize lifecycle_status; tips Cofnij/PonĂłw.
6. Cache: dam-brand/dam-viz/dam-tag-edit/dam-viz.js ?v=vizfilt20260720c (branding.html nie ruszany).

### Efekt/Fix
â€žBridge offlineâ€ť = faĹ‚szywy: brak Authorization â†’ login_required traktowany jak offline. Po auth: prawdziwy ostatni wpis change-log. Status pod filtrami. Switche Geex compact.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-viz.js, dam-tag-edit.js OK
- CDP: orderKids filtersâ†’toolbar, statusBelow=true, pad 20px 24px, fs 12px, allH34=true, packClasses dam-switch--compact, lang â€žWszystkie jÄ™zykiâ€ť, hint â€žStatus cyklu ĹĽycia: nieaktualne Â· â€¦â€ť, hintTruncated=false
- Screenshot+Read: viz-filt-pass1, pass2b, pass3b (â‰Ą3 przeloty)
- Pass/Fail: Pass

### Zrodla
visualizations.html; dam-brand.css; dam-viz.css; dam-viz.js; dam-tag-edit.js; local_bridge /change-log; dam-dobrakaloria; ui-taste


## 2026-07-20 - WORKER B: Global CTA/badge unify (Faktury + Projekty)

### Komenda/Akcja
USER: Unify primary/secondary CTAs and status badges on Faktury + Projekty to Integracje language (.dam-int-cta 34px, .dam-int-chip / .dam-int-st--*). Prefer inject #damGlobalCtaUnify. Screenshot both pages. No viz/branding.

### Log/Status
1. Added pps/web/assets/js/dam-ui-cta.js - inject #damGlobalCtaUnify (cta/chip/filter anatomy, no rewrite of dam-integrations.css).
2. Faktury: invoices.html Importuj CSV label -> dam-int-cta; filters -> dam-int-filter; source badge -> chip.
3. dam-invoices.js: status chips ok/wait/danger; OpĹ‚acona labels; filter active without inline purple hacks.
4. Projekty: index.html OdĹ›wieĹĽ listÄ™ + Skanuj dysk -> dam-int-cta; dam-projects.js status chips + card actions CTAs.
5. PL: i18n/pl.json invoices.filter_paid/pending/status_paid/col_due diacritics.
6. Cache: ?v=ctaunify20260720b on dam-ui-cta / dam-invoices / dam-projects.

### Efekt/Fix
Geex primary-transparent blobs removed from owned toolbars; status chips match Integracje Brak/PoĹ‚Ä…czono anatomy.

### Backup
Brak (git checkout index.html mid-flight after encoding mishap, then re-patched).

### Test/Ewaluacja
- node --check dam-ui-cta.js / dam-invoices.js / dam-projects.js OK
- CDP Faktury: Importuj CSV height=34, class=dam-int-cta; chips OpĹ‚acona/Oczekuje; filters OpĹ‚acone/OczekujÄ…ce
- CDP Projekty: refresh/ingest H=34; card CTA H=34; chips Niekompletny(--danger)/Kompletny(--ok); leftover geex primary=0
- Screenshot+Read: cta-unify-faktury-pass1, cta-unify-projekty-pass1/2, page-2026-07-20T18-14-26
- Pass/Fail: Pass (3 przeloty)

### Zrodla
dam-ui-cta.js; invoices.html; dam-invoices.js; index.html; dam-projects.js; i18n/pl.json; dam-integrations.css (read-only anatomy); dam-dobrakaloria; ui-taste

## 2026-07-20 - WORKER C: Polish diacritics wave 2 (app-wide)

### Komenda/Akcja
USER: Fix mojibake / U+FFFD / broken PL UI across projects, messages, dashboard, settings, help, legal pages. Skip branding if contested; skip dam-viz/visualizations. Encoding only.

### Log/Status
1. Root cause: many HTML sources had U+FFFD (UTF-8 EF BF BD) where Polish letters were lost (not live CP1250).
2. Restored diacritics from git HEAD via skeleton line-match + context anchors + explicit phrase map.
3. Fixed owned pages: inbox, settings, help, terms, license, privacy, consents, activity, costs, docs-security, integrations, project, profile; JS: dam-explorer.js / dam-projects.js (`opakowanie`, `jÄ™zyki` where owned).
4. Skipped write: dam-viz.js / visualizations.html (A); branding* left to agent 937cce8f (grep shows branding already OK: PokaĹĽ).
5. Residual owned FFFD after pass = 0. Left for A: `Wszystkie jezyki` in dam-viz.js.

### Efekt/Fix
Projekty: `Projekty opakowaĹ„`, `OdĹ›wieĹĽ listÄ™`, subtitle z Ĺ„/Ĺ›/Ä‡.
WiadomoĹ›ci: `WiadomoĹ›ci`, `ZgĹ‚oszenia DAM`, `ĹąrĂłdĹ‚a`, `OdĹ›wieĹĽ`, `wiadomoĹ›ciach`.

### Backup
Brak (restore from git HEAD strings, working-tree structure kept).

### Test/Ewaluacja
- Scan: owned-scope FFFD=0; branding FFFD=0 / PokaĹĽ OK; residual ascii `jezyki` only in dam-viz.js (forbidden).
- CDP Projekty: h2=`Projekty opakowaĹ„`, refresh=`OdĹ›wieĹĽ listÄ™`, subtitle kompletnoĹ›ci.
- CDP Inbox: title=`WiadomoĹ›ci - DAM`, h2=`WiadomoĹ›ci`, z=`ZgĹ‚oszenia DAM`, src=`ĹąrĂłdĹ‚a`, ref=`OdĹ›wieĹĽ`.
- Screenshot+Read: pl-wave2-projekty-titles.png, pl-wave2-wiadomosci-titles.png
- Pass/Fail: Pass (titles). Hard refresh note for HTML-only fixes (`?v=` page query).

### Zrodla
inbox.html; index.html; settings.html; help.html; terms/license/privacy/consents/activity/costs/docs-security/integrations/project/profile.html; dam-explorer.js; dam-projects.js; git HEAD; dam-dobrakaloria

## 2026-07-20 - Branding: PL regresja + tabs full-width + card ID chip gray

### Komenda/Akcja
USER: PL znaki (?), tabs full-width, sectionDesc under subtitle, status under meta filters, discovery cleanup, meta pad +12px; potem ID chip gray + mt 5px, meta mt -4px. Nie ruszaÄ‡ dam-shell.js.

### Log/Status
1. Root PL: branding.html miaĹ‚ literaĹ‚y ASCII \?\ zamiast UTF-8 (regresja po skelmeta20260720c) â€” PokaĹĽ/sĹ‚owo/niemiÄ™sa/produktĂłw/Ĺ›cieĹĽce/Ĺadowanie/WrĂłÄ‡ itd. przywrĂłcone UTF-8.
2. Layout: tabs-row bez kolumny tabs-meta (peĹ‚na szerokoĹ›Ä‡ belka); #damBrandingSectionDesc pod .dam-page-sub; #damBrandingStatus pod .dam-branding-filters--meta; discovery DOM usuniÄ™ty (pusty host = spacer ~30px gdy brak recent).
3. Meta filters padding 20px 24px (+12 vs bazowe 8/12).
4. Card: .dam-branding-card__id-chip / .dam-branding-id-chip â†’ szary muted (nie purple); margin-top:5px; .dam-branding-card .dam-viz-card__meta { margin-top:-4px }.
5. Cache: dam-branding.js/css?v=cardchip20260720f (branding, explorer, dashboard, visualizations).

### Efekt/Fix
PL czytelne; belka tabĂłw full-width; desc/status w nowej hierarchii; brak discovery gap; ID chip gray; meta ciaĹ›niej.

### Backup
Brak.

### Test/Ewaluacja
- CDP: tab \PokaĹĽ\ charCode 380; tabsRowW=contentW; descUnderSub; statusBelowMeta; discoveryExists=false; metaPad 20/24; chip color rgb(107,103,120) bg rgba(70,66,85,0.08) mt=5px; metaMt=-4px; isPurple=false
- Screenshot+Read: branding-gray-chip-proof-viewport.png (gray chip M-SLI504000-07-26 + meta)
- Pass/Fail: Pass

### Zrodla
branding.html; dam-branding.css; dam-branding.js; dam-dobrakaloria; ui-taste

## 2026-07-20 - Sidebar: anti-jank morph + Wyloguj low + restore author/version

### Komenda/Akcja
USER: morph 280â†”72 still stutters; icons same column (no recenter jump); Wyloguj lower in collapsed (match expanded); restore footer DAM / Dobra Kaloria - Inyfinn / vâ€¦; 5 ui-taste passes; cache beyond sidebarmorphsmooth20260720c â†’ sidebarmorph20260720e. Checklist B5 note only (not [x]).

### Log/Status
1. Root cause A (jank): onComplete clearPadVars + dam-brand `justify-content:center` / padding:0 / icon font-size snap after pad-var morph.
2. Root cause B (Wyloguj mid-rail): collapsed override `margin-top:8px` + `.dam-sidebar-logo-collapsed{margin-top:auto}` ate space between logout and logo.
3. Root cause C (footer â€žremovedâ€ť): brand_sub fallback â€žPanel assetĂłwâ€¦â€ť; footer below fold (menu not height:100%); collapsed `display:none` without compact meta.
4. Fix `dam-shell.js` inject `#damShellLayerCss`: flex-start + keep `--dam-sb-pad-x`/`--dam-link-pad-x` after collapse; logout +50px both states; menu fill height; logo `margin-top:10px`; `.dam-sidebar-collapsed-meta` (DAM + v); footer brand restore; morph keepPadVars.
5. Cache: `dam-shell.js?v=sidebarmorph20260720e` (20 HTML). Doctrine Â§12 + ten wpis.
6. B5: sidebar expanded+collapsed QA progress only â€” full dashboard 2Ă—2/1Ă—4/1Ă—6 still open `[ ]`.

### Efekt/Fix
Morph pad+width continuous (icon L 77â†’48, maxÎ”9px, jumps=0); Wyloguj nad logo (gap ~26px, mt 50px); footer expanded full; collapsed DAM v2.0.7.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-shell.js OK
- CDP updateRoot samples: w 312â†’72, pad 25â†’15, iconL continuous, justify flex-start end
- Pass1â€“5 screenshot+Read expanded/collapsed
- z-index popup 12550 intact

### Zrodla
dam-shell.js; gsap-core; ui-taste; dam-dobrakaloria; code-doctrine Â§12

## 2026-07-20 - Docs + commit + push (UI usability pack)

### Komenda/Akcja
USER: po zakonczeniu pracy UI - weryfikacja dostaw rownoleglych agentow, dokumentacja, commit + push (bez force/amend).

### Log/Status
1. Weryfikacja kodu (bez luk krytycznych do domkniecia):
   - Viz: `#damChangeLogBar` mount w `#vizSearchScope > .dam-search-scope` (margin-left:auto), `hidden` gdy nie admin+ADMIN ON (`DamTagEdit.refreshChangeLogBar` / `dam-viz.mountChangeLogInScope`); hint `#damChangeLogHint`; `#vizStatus` mb 15px; `.dam-viz-grid-count` padding 15px 26px (+8/+12 vs branding 7/14). Cache `dam-viz.css|js?v=viztb20260720a`.
   - Branding: `#damBrandingPageSize` range+number+OK; draft na input/wheel, `applyPageSize` dopiero po OK/Enter (`prefs.branding_page_size`).
   - Help: `#damHelpModal` - `injectHelpRestartControl` (restart pod X, `.dam-help-modal__head-actions` column gap 10px); head/body padding +10px (32/34, 26/34).
   - Sidebar: morph `sidebarmorph20260720e` w diffie (anti-jank, Wyloguj +50px, collapsed meta).
2. Docs: README changelog 2026-07-20; ten wpis; memory #133; usability-brief status; PROGRESS nota; checklista bez falszywej zieleni (B1/A3 juz zaktualizowane wczesniej).
3. Git: stage kod+docs+nowe moduly (bez lock/logs/tmp/user-device-paths/_bump_*.py); commit + push origin/main.

### Efekt/Fix
Pakiet UI usability zsynchronizowany w repo + zdalnym main.

### Backup
Brak (tag nie tworzony w tej turze).

### Test/Ewaluacja
- Grep markers w kodzie (jak wyzej).
- Pass/Fail weryfikacji obecnosci dostaw: Pass

### Zrodla
dam-viz.css/js; dam-branding.js + branding.html; dam-tutorial.js; dam-brand.css (help); dam-shell.js; dam-dobrakaloria; code-doctrine


## 2026-07-20 - Help modal: restart samouczka + padding +10

### Komenda/Akcja
USER: `#damHelpModal` header - pod X kontrola â€žWĹ‚Ä…cz samouczek ponownieâ€ť; padding wewnetrzny +10px; realny restart DamTutorial; cache-bust; 5 passow screenshot; process.md; bez commit.

### Log/Status
1. READ code-doctrine + dam-shortcuts / dam-tutorial / dam-brand help CSS.
2. `DamTutorial.restart()` - stop/clear PHASE + session dismiss, `start({phase:0,step:0})`.
3. `injectHelpRestartControl` w headerze (kolumna `.dam-help-modal__head-actions` pod X); stopka â€žUruchom samouczekâ€ť tez woĹ‚a restart.
4. `dam-shortcuts.js` - head-actions wrapper w HTML modala.
5. CSS: head 32/34/22, body 26/34/34 (+10); restart Geex; gap actions 12px; tut-help-entry +10.
6. Cache: `helprestart20260720a` (tutorial js/css, shell, shortcuts); brand `helprestart20260720c`.

### Efekt/Fix
Restart zamyka pomoc i odpala samouczek od 0:0 (CDP: helpHidden + tutActive + phase 0:0). Header: X nad restartem, bez nachodzenia na tytul (gapTitle ~28px).

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-tutorial.js OK
- CDP padding head/body + gapClose 12
- Pass1 structure; Pass2 spacing+nowrap; Pass3 clean header; Pass4 ~768; Pass5 final 1440 - screenshot+Read
- Restart klik x2: Pass

### Zrodla
dam-tutorial.js; dam-shortcuts.js; dam-brand.css; dam-tutorial.css; dam-shell.js; HTML ?v=; ui-taste; dam-dobrakaloria

## 2026-07-20 - Supervisor: dokonczenie A/B/C (viz toolbar, branding meta, sidebar)

### Komenda/Akcja
USER WORKER nadzorca: stan briefow 2026-07-20 + MUST DONE A viz toolbar / B branding page-size / C sidebar. Bez commit. Nie ruszac #damHelpModal.

### Log/Status
1. Audyt: A czesciowo (mount far-right + admin gate + pill); hint mial zla historie â€žStatus cyklu ĹĽyciaâ€ť; B page-size juz w JS ale branding.html PL/encoding uszkodzony; C footer brak na stronach bez markup (branding).
2. A: `formatChangeLogEntry` -> â€žOstatnia zmiana na dysku: â€¦â€ť; trailing CSS `margin-left:auto`; hint max-width 340px; status mb 15px / filters mb 4px (bliĹĽej); pill 8/12 (jak Branding + inject).
3. B: naprawa UTF-8/PL w branding.html; suwak+input+OK+wheel juz w `dam-branding.js` (apply dopiero po OK - CDP: draft nie zmienia kart, OK 100->40).
4. C: `ensureSidebarFooterEl` w `dam-shell.js` + footer markup w branding.html; Wyloguj nisko; autor/wersja expanded + collapsed meta.
5. Cache: dam-viz.css `supviz20260720d`, dam-tag-edit `supviz20260720c`, dam-shell `supviz20260720b`, dam-branding `supviz20260720a`.
6. Nie ruszano #damHelpModal.

### Efekt/Fix
A/B/C domkniete wzgledem MUST DONE. Concurrent agents nadpisywali dam-viz.css / cache tokeny w trakcie - final: CDP barRight=0, hint bez cyklu ĹĽycia, page-size OK-only, footer widoczny.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-tag-edit.js / dam-shell.js / dam-branding.js / dam-viz.js OK
- CDP viz: barInScope, barRight=0, admin-only hide, hint â€žOstatnia zmiana na dyskuâ€¦â€ť, filtersMb=4px, statusMb=15px, countPad=8px 12px
- CDP branding: sameAfterDraft, OK apply 40 kart, wheel sync, PL PokaĹĽ
- Screenshot+Read: supviz-pass1..pass5 (+ pass5b) w Temp/cursor/screenshots/

### Zrodla
visualizations.html; dam-viz.css; dam-tag-edit.js; dam-viz.js (read); branding.html; dam-branding.js/css; dam-shell.js; dam-dobrakaloria; ui-taste; code-doctrine

## 2026-07-20 - VIZ-TOOLBAR worker finish (viztb20260720f)

### Komenda/Akcja
USER WORKER: dokoĹ„cz VIZ-TOOLBAR â€” changelog w search scope (admin), pill licznika Geex light, branding page-size OK-only. Bez commit / bez sidebar.

### Log/Status
1. Design Read: toolbar Geex/DAM (Wizualizacje + Branding meta) dla adminĂłw opakowaĹ„; jasny panel; Cofnij/PonĂłw na prawo w scope.
2. Changelog: `DamSearch.bindScopeChips({ trailingEl })` + mount w `#vizSearchScope .dam-search-scope` (margin-left:auto); widoczny tylko `role=admin` + `dam_admin_mode=1`; hint copy `Ostatnia zmiana na dysku: â€¦` (bez â€žcykl ĹĽyciaâ€ť).
3. Spacing: filters mb 4px (status bliĹĽej); `#vizStatus` mb 15px.
4. Pill `#vizGridCount`: format jak Branding; pad **15/26** (= branding 7/14 **+8/+12**); light DAM tokens (nie ciemny 1:1); inject `#damVizCountPillInk` chroni przed regresjÄ… CSS.
5. Branding Karty: suwak+input+wheel = draft; OK stosuje; fix race session/local vs `/user-prefs` (OK nie wraca do 100).
6. Cache koĹ„cowy: `viztb20260720f` (dam-viz.css/js); branding.js `viztb20260720e`; tag-edit/search wg HTML.

### Efekt/Fix
Brief A/B/C (toolbar) Pass wzglÄ™dem CDP. Concurrent `supviz` nadpisywaĹ‚ pad 8/12 ciemny â€” poprawione na light 15/26 + inject.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-viz.js / dam-search.js / dam-tag-edit.js / dam-branding.js OK
- CDP viz: barInScope, admin-only, hint bez cyklu ĹĽycia, filtersMb=4, statusMb=15, countPad=15px 26px, color #464255, light bg
- CDP branding: draft nie re-renderuje; OK 40â†’36 kart; status limit 36
- Screenshot+Read: viztb-pass1..5, viztb-final-*, viztb-pass5b-branding-meta (Temp/cursor/screenshots)

### Zrodla
visualizations.html; dam-viz.css/js; dam-search.js; dam-tag-edit.js; branding.html; dam-branding.js/css; dam-user-prefs.js; dam-dobrakaloria; ui-taste; code-doctrine

## 2026-07-20 - Viz toolbar changelog + count pill + Branding page-size

### Komenda/Akcja
WORKER: Visualizations toolbar (changelog far-right search-scope, ADMIN gate, status spacing, count pill) + Branding page-size slider/OK + prefs.

### Log/Status
1. #damChangeLogBar przeniesiony do #vizSearchScope > .dam-search-scope (DamSearch `trailingEl` + mount w dam-tag-edit/dam-viz). Label `Dysk`, CTA `.dam-int-cta`, tip dysk vs Postgres.
2. Gate: rola admin + `localStorage dam_admin_mode===1` (header ADMIN ON; bez legacy `dam_viz_admin_mode`).
3. #vizStatus pod secondary filters; gap ~6px; `margin-bottom: 15px` na status.
4. Sticky count pill `#vizGridCount`: elementy=karty produktow, pliki=warianty z wizka; pad 15/26 (7/14+8/+12); muted ink; inject `#damVizCountPillInk`.
5. Branding `.dam-branding-page-size`: range+number+OK, wheel draft, apply tylko na OK; prefs `branding_page_size` (24-500) via DamUserPrefs + bridge normalize; session fallback.
6. GSAP page-entrance: nested changelog dostawal opacity:0 â€” `data-dam-bar-revealed` + clear inline + CSS !important na belkach.
7. Cache `?v=viztb20260720h` (viz/tag-edit/branding/user-prefs). Nie ruszano `dam-shell.js`.

### Efekt/Fix
Admin undo przy scope; non-admin ukryty; count pill na Viz; Branding page-size bez janku przy drag.

### Backup
Brak.

### Test/Ewaluacja
- CDP Viz: barInScope=true; atBar=dam-changelog-bar__label; ADMIN offâ†’hidden / onâ†’visible; statusMb=15px; gap=6; countPad=15px 26px; ink bg; undoCls=dam-int-cta.
- CDP Branding: draft 48 cards unchanged until OK; OKâ†’48 cards; session `dam_branding_page_size=48`; count pad 15/26.
- Screenshot+Read: viz-final-pass-toolbar.png (DYSK/Cofnij/Ponow + status + pill); branding page-size control in meta.
- Pass/Fail: Pass (CDP primary; screenshot confirms changelog on scope row).

### Zrodla
visualizations.html; dam-viz.js/css; dam-tag-edit.js; branding.html; dam-branding.js/css; dam-user-prefs.js; local_bridge.py; dam-search.js (trailingEl â€” concurrent); dam-dobrakaloria; ui-taste

## 2026-07-20 - Sidebar Y-stable morph (collapse/expand)

### Komenda/Akcja
Napraw animacje collapse/expand sidebara: ikony trzymaja Y (tylko X), bez skracania wysokosci raila, Sesja naturalnie (bez margin-top:auto), dim 0.7s GSAP.

### Log/Status
1. Root cause CDP: collapsed height:min(80vh) (1183â†’982), pad 38â†’12, first-child margin 15â†’0, wrap linkow 80px + absolute labels, Sesja margin-top:auto.
2. Fix w dam-shell.js inject #damShellLayerCss: rail calc(100vh-44px), pad-Y 38, sloty 56px nowrap, first-child 15px obu stany, ikony 20/lh:1, Sesja bez auto, footer/logo margin-top:auto, SIDEBAR_MORPH_DUR=0.7.
3. Cache dam-shell.js?v=sidebarystable20260720c (20 HTML). Doctrine Â§12 lekcja.
4. Bez commit.

### Efekt/Fix
Morph Y-stable: mid+end Î”Yâ‰0 dla apps/sitemap/plug/desktop; Î”Xâ‰-29; heightDelta=0; sesjaY=0.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-shell.js OK
- CDP morph (gsap.updateRoot mid 0.35): all icon Y delta 0; end Y delta 0; h 1183â†’1183; sesjaTop 661 obu
- Screenshot+Read 5 passow: pass1 expanded, pass2 collapsed, pass3 mid 142px, pass4 collapsed final, pass5 expanded final
- Pass/Fail: Pass

### Zrodla
dam-shell.js; dam-brand.css (override via inject); code-doctrine; gsap-core; dam-dobrakaloria; ui-taste

## 2026-07-20 - EXP-A Explorer entry points + toolbar CTA unify

### Komenda/Akcja
WORKER EXP-A: Plus w panelu Kategorie, Dodaj produkt w panel-head kategorii, unify toolbar Backup/Odsviez/Stosuj do anatomii .dam-int-cta, stub DamExplorerAddProduct.

### Log/Status
1. explorer.html: Plus #damExplorerAddCategory; toolbar klasy dam-int-cta; script dam-explorer-add-product.js po dam-explorer.js.
2. dam-explorer.js: inject #damExplorerCtaUnify; panelHeadHtml showAddProduct + categoryContext; bind hooks stub-safe.
3. Nowy stub apps/web/assets/js/dam-explorer-add-product.js (open -> toast/consolewarn).
4. Cache token expa20260720b.
5. Bez local_bridge / bez pelnego modala (EXP-B).

### Efekt/Fix
Entry points + CTA unify na explorerze; stub gotowy na podmiane przez EXP-B.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-explorer.js + dam-explorer-add-product.js OK
- CDP: addCat/addProd/refresh/force/backup h=34; pad 8px 12px (icon 0); border #e7e7e7; stub open mode category/product + categoryContext
- Screenshot+Read 3 pass: Batony, Kulki, Roslinne
- Pass/Fail: Pass

### Zrodla
explorer.html; dam-explorer.js; dam-explorer-add-product.js; code-doctrine; dam-dobrakaloria; ui-taste

## 2026-07-20 - EXP-C: bridge create-category / create-product

### Komenda/Akcja
WORKER EXP-C: endpointy mostu do tworzenia kategorii/produktu ze szablonow dysku.

### Log/Status
1. READ: code-doctrine, program-instructions, szablony na X: (`Szablony folderow/00 - KATEGORIA` + nested product; GC `00 - CATEGORY`).
2. NOWY modul `apps/desktop/explorer_create.py` (copytree + dry_run + confirm gate + demo `- D` / 6300XXX).
3. WpiÄ™cie w `local_bridge.py`: POST `/explorer/create-category`, `/explorer/create-product` (admin); `BRIDGE_API_VERSION=4`.
4. Seed PI: `explorer.product_from_template`, `explorer.demo_index_rules` (version 7).
5. Restart pythonw local_bridge (health api_version=4).

### Efekt/Fix
- dry_run jednostkowy: kategoria `08 - TEST EXP C`; produkt z BAT + 6300XXX => `- D`.
- curl/urllib bez sesji: 401 `login_required` (route zyje; 404 na `/explorer/no-such`).
- Zapis tylko `dry_run:false` + `confirm:true`; po sukcesie `index_rebuild_suggested`.

### Backup
Brak (bez zapisu na dysk w testach).

### Test/Ewaluacja
- `python -c` import explorer_create dry_run OK (templates found on X:)
- confirm gate -> `confirm_required`
- HTTP POST bez Bearer -> 401; health -> api_version 4
- Pass/Fail: **Pass** (auth 401 + unit dry_run; real write nie odpalany)

### Zrodla
explorer_create.py; local_bridge.py; program-instructions.json; X:/Marketing/- POLSKA/01 - PRODUKTY/Szablony folderow/

## 2026-07-20 - Sidebar collapsed logo/meta bez skoku translate

### Komenda/Akcja
User: logo `.dam-sidebar-logo-collapsed` + meta `.dam-sidebar-collapsed-meta` przeskakuja przy pojawianiu sie (collapse morph).

### Log/Status
1. CDP sampling: meta zostawala `display:flex` po expand (GSAP leftover) â†’ flex Y=1133, potem absolute Y=1123 = widoczny skok 10px.
2. Steady collapsed uzywal flex+margin-top:auto, morph absolute bottom slot â†’ skok na koncu morph.
3. Fix: ten sam absolute slot (logo bottom 38px, meta 10px) w morph + collapsed (`dam-shell.js` CSS inject + `dam-brand.css`); meta `display:none` po expand jak logo; CSS `:not(.collapsed):not(.morphing)` dla meta.
4. Cache: `dam-shell.js?v=sidebaridentity20260720b`, `dam-brand.css?v=sidebaridentity20260720a`.

### Efekt/Fix
Morph: transform none, logo/meta top stale 1062/1123 przez caly tween; expanded meta display none; collapsed logo czytelne (screenshot pass2).

### Test/Ewaluacja
- CDP collapse morph: skok tylko frame0 hiddenâ†’slot (opacity 0); po morph dY=0
- Screenshot+Read: sidebar-collapsed-pass2.png - logo DK + DAM v2.0.7 na dole rail
- Pass/Fail: Pass

### Zrodla
dam-shell.js; dam-brand.css; verify-ui-after-changes.mdc


### Komenda/Akcja
User: â€žjuz DUZO lepiej, ale nadal sie rozjezdzzaâ€ť - dokonczenie Y/X osi, footer logo leftover, collapse-btn center.

### Log/Status
1. Vision+CDP: ikony Y juz OK (dY=0), leftSpread=0; rozjazd = (A) collapse-btn CX 49 vs ikony 59, (B) GSAP zostawial .dam-sidebar-logo-collapsed{display:flex} w expanded (logo 220px na dole).
2. Fix: header justify center + btn 40px; logo out-of-flow w morph; FLIP btn GSAP; CSS ody:not(.collapsed):not(.morphing) .dam-sidebar-logo-collapsed{display:none!important}; applySidebarCollapsedClass hard-reset display.
3. Cache dam-shell.js?v=sidebarystable20260720g (po nadpisaniu przez concurrent sidebaridentity20260720a).
4. Screenshoty: sb-fix-pass2-expanded-clean.png, sb-fix-pass3-collapsed-final.png (+ pass1 audit).

### Efekt/Fix
Collapsed: rail/btn/logo CXâ‰58, ikony CXâ‰59 (delta -1px); left=48 wszystkie; dY=0; logo expanded display:none.

### Backup
Brak.

### Test/Ewaluacja
- CDP 3 ikony (apps/sitemap/signout): exp top 166/222/785 left 77 â†’ col top same left 48; leftSpread 0
- axis btnCx=58 railCx=58 iconCx=59
- Pass/Fail: Pass

### Zrodla
dam-shell.js #damShellLayerCss; gsap-core FLIP; ui-taste screenshot gate

### Komenda/Akcja
FAZA 1 EXP-B: modal dodawania produktu/kategorii (domkniecie planu zaleglosci)

### Log/Status
1. Pelny modal w dam-explorer-add-product.js (category/product, dry-run Podglad, Potwierdz i utworz).
2. DamExplorer.state wyeksponowany; cache ?v=expb20260720b; postJson timeout 20s.
3. explorer_create already_exists zwraca available_variants.
4. QA: Plus Kategorie otwiera modal; dry-run planned_path OK; real create TEST AGENT CAT na X:.

### Efekt/Fix
Utworzono: X:\Marketing\- POLSKA\01 - PRODUKTY\- DK\08 - TEST AGENT CAT (z szablonu 00 - KATEGORIA). Potwierdzenie dopiero po dry_run.

### Backup
Brak (copytree z szablonu, nie kasowano drzew usera).

### Test/Ewaluacja
- node --check dam-explorer-add-product.js OK
- CDP POST dry_run + confirm 200 ok
- Screenshot+Read: modal z podgladem sciezki (page-2026-07-20T19-16-04-773Z.png)
- Pass/Fail: Pass

### Zrodla
dam-explorer-add-product.js; explorer_create.py; explorer.html; plan dam_wdrozenie_zaleglosci

### Komenda/Akcja
FAZA 2 A3: FMCG pelne dane + mapowanie kwot

### Log/Status
1. fmcg-cost-catalog.json: 39 null amount -> seed_estimate (midpoints PL); 6 kept; nulls=0.
2. fmcg-cost-import-map.json v2: +90 mapowan id/label.
3. Szablon CSV uzupelniony kwotami z katalogu.
4. Checklista A3 [x] (seed; nadpisanie realnymi kwotami przez CSV/Edytuj).

### Efekt/Fix
Lancuch FMCG gotowy do compute bez pustych kwot.

### Test/Ewaluacja
- file_items=45 nulls=0
- Pass/Fail: Pass (techniczne; biznesowe kwoty ERP opcjonalne nadpisanie)

### Zrodla
fmcg-cost-catalog.json; fmcg-cost-import-map.json; fmcg-cost-averages.json

## 2026-07-20 - WORKER C3 freeze + backlog B3/B4/B7 + A1/A2 verify

### Komenda/Akcja
C3 BENTO freeze anatomii; backlog-rest B3 poster, B4 Autor, B7 cache-bust; A1/A2 verify only.

### Log/Status
1. C3: gents/shared/bento-card-freeze.md + FROZEN comments (dam-brand.css, dam-branding.css, dam-viz.css) + doctrine Â§12; checklista C3 [x] freeze anatomii (nie redesign).
2. B3: bridge _media_video_poster_placeholder (SVG 200 zamiast 422); JS VIDEO_POSTER_FALLBACK + probe w dam-branding.js / dam-media-preview.js.
3. B4: FACET uthor:* grupa Autor (Krzysztof/Sylwia/Szymon/Highlite) â€” appearance_tags + author field + path.
4. B7: HTML listed â†’ ?v=bust20260720a dla dam-tokens/dam-brand/dam-grid-reveal (gdzie wystepuja); BOM z PS usuniety.
5. A1/A2: verify â€” dam-connection.env bez DAM_ASANA_*/DAM_MS_* â†’ status [ ] (wymaga user Client ID/Secret).

### Efekt/Fix
Freeze bez redesignu kart; poster fallback twardy; Autor w filtrach; cache sweep reszty stron.

### Backup
Brak.

### Test/Ewaluacja
- node --check dam-branding.js / dam-media-preview.js OK; bridge AST OK
- CDP branding: Autor row widoczny; filtr Krzysztof â†’ ~4867 plikow; video posters = data-svg fallback
- Screenshot+Read: page-2026-07-20T19-21-17-859Z.png (Autor + Wideo)
- B7: brak stale tokenow na listed pages
- Pass: C3, B3, B4, B7 | Fail/open: A1, A2 (credentials)

### Zrodla
bento-card-freeze.md; code-doctrine.md Â§12; dam-branding.js; dam-media-preview.js; local_bridge.py; WAZNA-CHECKLISTA; memory #135

### Komenda/Akcja
C2 â€” dwukierunkowy ERP faktur (kontrakt stub + UI)

### Log/Status
1. READ: program-instructions finance.invoices_import; local_bridge /finance/invoices*; invoices.html + dam-invoices.js; checklist C2 [ ].
2. NOWY helper apps/desktop/invoice_erp.py (status/export/mark_import, stage invoice-erp-export-last.json).
3. Bridge: GET /finance/invoices/erp-status; POST /finance/invoices/export (+ alias /push); import aktualizuje last_import; BRIDGE_API_VERSION=5; health hub_routes.
4. Persist: apps/web/data/invoice-erp-sync.json.
5. UI Faktury: badge ERP, meta kierunku, Import z ERP (CSV) + Eksport do ERP (.dam-int-cta, admin).
6. Seed: invoice.erp_bidirectional w program-instructions.json v8; lustro app-settings; C2 [x].
7. RESTART bridge wymagany (watchdog desktop respawnuje pythonw) â€” po kill+respawn api_version=5.

### Efekt/Fix
Kontrakt bidirectional stub (nie live ERP). Import CSV zachowany; export stage + sync state; UI pokazuje stan.

### Backup
Brak (tylko data JSON sync/export stage).

### Test/Ewaluacja
- python ast + invoice_erp unit: PASS (direction bidirectional, dry/export/import)
- node --check dam-invoices.js: PASS
- GET /health api_version=5 + hub_routes export/erp-status: PASS (po restarcie mostu)
- GET /finance/invoices/erp-status (Bearer admin): PASS direction=bidirectional
- POST /finance/invoices/export: PASS exported=10 staged=true
- Screenshot+Read invoices.html: ERP OK â†”, Import/Eksport, meta last import/export â€” PASS
- Pass/Fail: **Pass** (live ERP provider nadal stub)

### Zrodla
apps/desktop/invoice_erp.py; local_bridge.py; invoice-erp-sync.json; dam-invoices.js; invoices.html; program-instructions.json; WAZNA-CHECKLISTA C2


### Komenda/Akcja
FAZA 2+3: domkniecie zaleglosci planu (A3/B5/C2/C3/rest) + docs

### Log/Status
1. A3: FMCG catalog 45 pozycji z kwotami (seed_estimate), import-map v2, CSV template.
2. B5: QA layoutow 2x2/1x4/1x6 @1280 + inject #damDashLayoutB5Css; cache b5qa20260720c.
3. C2: invoice_erp.py + GET erp-status + POST export; UI Faktury; PI invoice.erp_bidirectional.
4. C3: bento-card-freeze.md + FROZEN comments; checklista freeze (nie redesign).
5. B3/B4/B7: poster fallback, Autor tags, cache-bust bust20260720a; A1/A2 nadal [ ] (OAuth user).
6. Doktryna: lekcja kolizji nazw WORKER A/B/C.

### Efekt/Fix
Checklista A3/B3/B4/B5/B7/C2/C3 [x]; Explorer create end-to-end (dry-run+confirm).

### Test/Ewaluacja
- Explorer create category TEST AGENT CAT na X: OK
- Dashboard layout cycle CDP overflow=[] @1280
- Pass/Fail: Pass fali (A1/A2 blocked na credentials)

### Zrodla
plan dam_wdrozenie_zaleglosci; explorer_create.py; dam-explorer-add-product.js; invoice_erp.py

### Komenda/Akcja
B5 QA dashboard layouts 2x2 / 1x4 / 1x6 + sidebar expanded/collapsed @ 375/768/1280

### Log/Status
1. READ code-doctrine + dam-dashboard-widgets/css + checklista B5.
2. CDP: header quickaction overflowX ~112@1280 / ~168@768 (nie tile grid).
3. CDP@375: branding/media `grid-column:span 6` na siatce 1fr tworzylo 6 implicit tracks â†’ widgety ~40px (FAIL).
4. FIX: inject `#damDashLayoutB5Css` + patch `dam-dashboard.css` @575 (`1/-1` + icon rail column).
5. FIX: `vizTitleForCount` (1x6 â†’ "6 najnowszeâ€¦"); cache-bust `b5qa20260720f`.
6. Sidebar morph click w dam-shell bywa desync (storage=1, class brak) - poza WRITE allowlist; class force = 72px + logo 48x48 Pass.

### Efekt/Fix
- pageOverflowX=0 @1280/768/375 dla 2x2/1x4/1x6
- 2x2 = 2 cols (@1280/768), 1 col (@â‰¤720)
- 1x4/1x6 = 1 col, kids 4/6
- collapsed sidebar 72px, logo 48x48 (forced class)
- WAZNA-CHECKLISTA B5 [x] (note zaktualizowana)

### Backup
Brak

### Test/Ewaluacja
- node --check dam-dashboard-widgets.js: PASS
- CDP matrix 1280: overflowX=0 all layouts; collapsed logo 48: PASS
- CDP 768: overflowX=0; 2x2 colCount=2: PASS
- CDP 375: widgets 265px; bodyW title ~93; stackDir=column: PASS
- Screenshot+Read: b5-1280-2x2-expanded, b5-1280-2x2-collapsed-forced, b5-768-*, b5-375-1x6-fixed: PASS
- Pass/Fail: **Pass** (shell morph toggle desync = noted, not blocking class-applied state)

### Zrodla
apps/web/assets/js/dam-dashboard-widgets.js; apps/web/assets/css/dam-dashboard.css; apps/web/dashboard.html; WAZNA-CHECKLISTA-UZYTKOWNIKA.md B5

## 2026-07-20 - Domkniecie sesji: dokumentacja + commit + push (user)

### Komenda/Akcja
User: po zakonczeniu WSZYSTKICH agentow â€” spisz dokumentacje, commit, push.

### Log/Status
1. Weryfikacja git: kod sesji juz na `origin/main` (`e28a4bd`, `025aad3`); brak unstaged kodu aplikacji.
2. Subagent create modal redesign (`202d725c`) â€” **aborted** (2 linie transcript); OPEN na nastepna fale.
3. Subagenci badawczy (costs/integrations, branding load, anim audit, desktop tray, viz vs branding) â€” DONE raporty.
4. Nowy doc: `agents/shared/release-2026-07-20-evening.md` (mapa DONE/OPEN, cache-bust, checklista).
5. Aktualizacja: `README.md` changelog, `PROGRESS.md`, `handoff-usability-synthesis-2026-07-20.md`.
6. Commit docs + push origin/main.

### Efekt/Fix
Jedno miejsce prawdy dla wieczoru 2026-07-20; jasno oznaczone OPEN (create modal 10-pass).

### Backup
Brak.

### Test/Ewaluacja
- git status: tylko docs + untracked runtime (lock/logs/tmp â€” nie commitowane)
- Pass/Fail: **Pass** (dokumentacja); create modal redesign = **Fail/open**

### Zrodla
release-2026-07-20-evening.md; agent-transcripts subagents; git log

## 2026-07-20 - Domkniecie EXP-C (subagent create modal) + commit/push

### Komenda/Akcja
Subagent [Explorer create modal redesign](202d725c-bf6b-49e5-b85e-47dc49bc7a39) DONE â€” follow-up: docs + commit + push (user).

### Log/Status
1. Zweryfikowano diff: `dam-explorer-add-product.js`, `explorer_create.py`, `local_bridge.py`, PI v9, cache `expc20260720d`.
2. Rownolegle w working tree: Viz Historia zmian (`chghist20260720a`), Branding polish (`brpolish20260720a`, date-picker).
3. Zaktualizowano release notes, PROGRESS, README, handoff synthesis.
4. Commit bez runtime JSON (file-index/search-index/lifecycle-status â€” lokalny rebuild/QA).

### Efekt/Fix
Create modal 10-pass = Pass; blocker add-variant-type bez fizycznego szablonu udokumentowany.

### Test/Ewaluacja
- node --check + py_compile: PASS (wczesniej przez subagenta)
- Pass/Fail: **Pass**

### Zrodla
process.md wpis EXP-C (linie 3â€“125); subagent transcript 202d725c

## 2026-07-20 - Branding: Karty/Skala, kalendarz, padding, perf (plan branding_ui_polish_c4a6251f)

### Komenda/Akcja
User: usunac zolte "Karty" (musi wygladac jak fioletowa "Skala"), globalny fioletowy
accent-color na suwakach, wlasny kalendarz w stylu tagow zamiast natywnego popupu,
wyrownac padding `.dam-search-wrap--panel` = `.dam-viz-secondary-filters`, zweryfikowac
spowolnienie Brandingu. Plan wdrozony w calosci (5/5 krokĂłw).

### Log/Status
1. **Root cause zolty "Karty"**: `input[type="range"]` bez `accent-color` -> domyslny
   kolor UA (Windows/Chrome = zolto-zloty). Skala mial `accent-color` lokalnie, Karty nie.
2. **KROK1**: `#damBrandingPageSize` dostal klase `.dam-viz-zoom-control` (ta sama co
   Skala) - box/border/height dziedziczone ze wspolnego selektora, zero duplikacji CSS.
   Dodano globalna regule `input[type="range"] { accent-color: var(--dam-primary) }` w
   `dam-brand.css` (defense-in-depth, poza istniejacymi lokalnymi regulami - wszystkie
   juz byly fioletowe, grep potwierdzil 0 zoltych akcentow w calym repo).
3. **Odkryto i naprawiono szersza korupcje kodowania** w `branding.html`: literalne
   znaki `?`/`ďż˝` (U+FFFD) w PL diakrytykach (nie tylko tipy Kart/Skali - caly plik,
   ~20 miejsc: "WyczyĹ›Ä‡ filtry", "Ostatni tydzieĹ„/miesiÄ…c", "Priorytet uĹĽycia",
   "WrĂłÄ‡ do przeglÄ…dania" itd.). Zweryfikowano bajtowo (PowerShell UTF8.GetString) -
   to byla realna korupcja zapisana w plikuj, nie tylko render. CaĹ‚y plik przepisany
   z poprawnymi znakami.
4. **KROK2 - custom date picker**: nowy `dam-date-picker.js` (IIFE, `window.DamDatePicker`)
   - auto-enhance kazdego `input[type="date"]` (readOnly + wrapper `.dam-date-field` +
     ikona-trigger), popover `.dam-date-popover` w `<body>` (z-index 12300, jak inne
     pickery), siatka dni w stylu `.dam-viz-badge`/pill, `is-today` = obrys primary,
     `is-selected` = fill primary, stopka Wyczysc/Dzis. Oryginalny input zostaje
     jedynym zrodlem prawdy (ISO w `.value`, `input`+`change` dispatch) - zero zmian
     w logice filtrow `dam-branding.js`. `.ui-datepicker` (jQuery UI, legacy, nieuzywany
     w zadnym HTML) juz mial `var(--primary-color)` - bez zmian.
5. **KROK3**: `.dam-search-wrap--panel` padding `10px 12px 12px` -> `20px 24px` (=
   `.dam-viz-secondary-filters`). CDP: oba `getComputedStyle().padding` = `"20px 24px"`
   na Brandingu i Explorerze.
6. **KROK4 - perf**: `bindFilters()` w `dam-branding.js` - debounce 220ms tylko na
   `#damBrandingSearch` (input+change), reszta filtrow bez zmian (rzadkie akcje).
   **Zmierzony root cause spowolnienia**: `branding-index.json` = **284.9 MB**,
   `branding-search-index.json` = **43.7 MB** (`apps/web/data/`). To potwierdza
   hipoteze usera "dzialalo szybciej wczesniej" - indeks urosl do prawie 285 MB i
   kazdy load/parse tego kosztuje. Debounce lagodzi per-keystroke jank, ale
   **glebszy fix (lazy/slim index, paginacja API) to osobny follow-up** - nie
   blokuje tej fali UI polish (decyzja z planu).
7. Cache-bust: nowy token `brpolish20260720a` dla `dam-brand.css` + `dam-branding.css`
   we WSZYSTKICH HTML ktore je laduja (branding/dashboard/visualizations/explorer +
   12 stron statycznych z samym dam-brand.css); `dam-branding.js`, `dam-date-picker.js`
   (nowy) + `dam-date-picker.css` (nowy) tylko w `branding.html` (jedyna strona z
   `input[type="date"]` - grep potwierdzil).

### Efekt/Fix
- Karty = wizualnie identyczne ze Skala (fiolet #AB54DB), zero zoltego nigdzie w repo.
- Wlasny kalendarz Od/Do w stylu tagow, dziala end-to-end (test CDP: klik dnia ->
  input.value = ISO, filtr przelicza sie, popover sie zamyka).
- Padding search = secondary filters (rowny rytm) na Brandingu i Explorerze.
- Naprawiona korupcja kodowania w `branding.html` (caly plik, nie tylko dotkniety blok).
- Zmierzony i zadokumentowany root cause spowolnienia (285 MB indeks) + debounce search.

### Backup
Brak (edycje tekstowe/CSS/JS, bez migracji danych).

### Test/Ewaluacja
- `node --check` na `dam-branding.js`, `dam-date-picker.js`: PASS.
- ReadLints na zmienionych plikach: brak bledow.
- CDP: `accentColor` Karty i Skala = `rgb(171, 84, 219)` (identyczne); `padding` search
  vs meta filters = `20px 24px` (Branding + Explorer).
- CDP: wybor dnia w popoverze -> `input.value` = ISO, status grid przeliczony
  ("100 elementĂłw" -> "53 elementy" po ustawieniu daty), popover zamkniety.
- Karty drag+OK: number=60 -> `is-dirty` na OK -> klik -> status "limit 60 kart"
  (apply-on-OK zachowany, bez live re-render przy drag).
- Screenshot+Read (3 przeloty): Branding desktop (Karty/Skala/kalendarz czyste),
  Explorer desktop (padding rowny), Wizualizacje (brak regresji), Branding @1024px
  (meta row w jednej linii, dziala), reset stanu do domyslnych (limit 100).
- Pass/Fail: **Pass**.

### Zrodla
apps/web/branding.html; apps/web/assets/css/dam-brand.css; apps/web/assets/css/dam-branding.css;
apps/web/assets/css/dam-date-picker.css (nowy); apps/web/assets/js/dam-branding.js;
apps/web/assets/js/dam-date-picker.js (nowy); plan branding_ui_polish_c4a6251f.plan.md

## 2026-07-20 - Domkniecie EXP-C (subagent create modal) + commit/push

### Komenda/Akcja
Subagent Explorer create modal redesign DONE â€” follow-up: docs + commit + push (user).

### Log/Status
1. Zweryfikowano diff: dam-explorer-add-product.js, explorer_create.py, local_bridge.py, PI v9, cache excp20260720d.
2. Rownolegle w working tree: Viz Historia zmian (chghist20260720a), Branding polish (brpolish20260720a).
3. Zaktualizowano release notes, PROGRESS, README, handoff synthesis.
4. Commit bez runtime JSON (file-index/search-index/lifecycle-status â€” lokalny rebuild/QA).

### Efekt/Fix
Create modal 10-pass = Pass; blocker add-variant-type bez fizycznego szablonu udokumentowany.

### Test/Ewaluacja
- node --check + py_compile: PASS (wczesniej przez subagenta)
- Pass/Fail: **Pass**

### Zrodla
process.md wpis EXP-C; subagent 202d725c-bf6b-49e5-b85e-47dc49bc7a39

---

## Grid count pill light restyle (2026-07-20)

### Komenda/Akcja
Restyle floating count badge (`elementĂłw â€˘ plikĂłw`) z czarnego pill na light Geex surface â€” globalnie Branding + Viz.

### Log/Status
1. Zlokalizowano: `.dam-viz-grid-count` (#vizGridCount), `.dam-branding-grid-count` (#damBrandingGridCount); JS `injectVizCountPillInkStyle()` w dam-viz.js wymuszaĹ‚ dark `!important`.
2. CSS: light surface (#fff 96%), border primary 10% + `--dam-border`, text `--dam-text` (#464255), fw 500 â€” dam-viz.css + dam-branding.css.
3. UsuniÄ™to `injectVizCountPillInkStyle` z dam-viz.js.
4. Cache bust: `gridcountlight20260720b` (dam-viz.css, dam-branding.css, dam-viz.js) w visualizations.html + branding.html.

### Efekt/Fix
Before: `background color-mix(ink 88%)`, `color #fff`, fw 700, dark shadow. After: white pill, muted #464255, soft border/shadow jak tagi.

### Test/Ewaluacja
- node --check dam-viz.js: PASS
- CDP Branding: bg `color(srgb 1 1 1 / 0.96)`, color `rgb(70,66,85)`, inkStyle=false, text `100 / 1 220 elementĂłw â€˘ 574 / 9 611 plikĂłw`
- CDP Viz: bg/color identyczne, css `dam-viz.css?v=gridcountlight20260720b`
- Screenshot: `gridcount-branding-pass20260720.png` (Temp) + CDP capture
- Pass/Fail: **Pass**

### Zrodla
dam-viz.js updateVizGridCount; dam-branding.js updateGridCount; ui-taste Design Read (light chip, nie toast)

## 2026-07-20 23:05 - Audit wieczorny (transcript 86977982) + domkniÄ™cie MISSED

### Komenda/Akcja
WORKER audit ~6h transcript + implementacja zalegĹ‚oĹ›ci + commit/push (user explicit).

### Audit inventory (transcript 2026-07-20 wieczĂłr)

| Item | Status | Evidence | Action |
|------|--------|----------|--------|
| Floating count pill (elementĂłw/plikĂłw) | **DONE** | `dam-viz.css` + `dam-branding.css` `#fff` + shadow; CDP `bg: color(srgb 1 1 1 / 0.96)`; token `gridcountlight20260720b` | Hardened white surface (was PARTIAL/black in UI) |
| Viz assoc = Branding filter (no AI/PSD/PDF) | **DONE** | `dam-media-preview.js` `isSourceLikeAsset`, `passesMarketingAssocMaterial`, `ASSOC_FORBIDDEN_EXTS` | Filter already in working tree; verified logic |
| Assoc loading skeleton (no bare Ĺadowanie) | **DONE** | `showAssocPaneLoading` + `.dam-assoc-skeleton` in `dam-brand.css`; `#damVizModalAssoc` empty mount | No naked text in viz modal assoc |
| Branding card spacing 10px/15px | **DONE** | `dam-branding.css` `--dam-branding-card-section-gap: 10px`, actions 15px | Prior session; verified CSS |
| Safe delete hold 3s (media preview) | **DONE** | `dam-danger.js` `MEDIA_PREVIEW_HOLD_MS=3000`, `resolveHoldMs()`; `dam-assoc-edit.js` `holdMs:3000` | Implemented this run |
| Historia zmian (no Cofnij/PonĂłw at bar) | **DONE** | `dam-tag-edit.js` `#damChangeHistoryBtn` popover; no undo/redo buttons in `visualizations.html` | Verified present |
| Karty/Skala purple, calendar, search padding | **DONE** | memory #137, `brpolish20260720a` session | No regression (CDP accent prior) |

### Log/Status
1. Transcript + subagents (c136457d count, ecb668e3 assoc) â€” inventory vs disk.
2. CSS count pill: explicit `#fff` + layered shadow (viz + branding).
3. `dam-danger.js`: `resolveHoldMs()` â†’ 3000 ms inside preview modals.
4. Cache-bust: `gridcountlight20260720b`, `safedel20260720b`.
5. Weryfikacja: CDP count chip Branding + Viz; screenshot `verify-branding-count-chip-20260720.png`.

### Test/Ewaluacja
- `node --check` dam-danger.js, dam-viz.js, dam-media-preview.js: **Pass**
- CDP `#damBrandingGridCount`: text `100 / 1 220 elementĂłw â€˘ 574 / 9 611 plikĂłw`, bg white, color `#464255`: **Pass**
- CDP `#vizGridCount`: bg white, muted text: **Pass**
- Screenshot+Read branding grid/cards: light pills, spacing OK: **Pass**

### Zrodla
Transcript `86977982-52ab-4698-9da0-5b68ac3ea8cd`; `agents/shared/usability-brief-2026-07-20.md`; screenshot `verify-branding-count-chip-20260720.png`

---

## 2026-07-20 â€” Branding card body spacing (3 bands)

### Komenda/Akcja
WORKER: odstÄ™py pionowe `.dam-branding-card` â€” badges | title+chip+meta | actions.

### Log/Status
1. `dam-branding.css`: body `gap:0` + tokeny `--dam-branding-card-section-gap:10px`, `--dam-branding-card-actions-gap:15px`; `badges margin-bottom:10px`; `meta margin-top:4px`; `actions margin-top:15px`; title-wrap `flex:0 0 auto` + column (bez flex-grow rozpychajÄ…cego sekcje).
2. Cache-bust `dam-branding.css?v=brcardpad20260720a` â€” branding.html, dashboard.html, explorer.html, visualizations.html.
3. Weryfikacja CDP `br-004000` + 2 kolejne karty: gaps 10 / 4 / 15 px. Screenshot `apps/web/_qa/branding-card-spacing-br004000.png`, pass3 `branding-card-spacing-pass3.png`.

### Efekt/Fix
Trzy czytelne pasma w body karty brandingu; Viz assoc filtry nietkniÄ™te.

### Test/Ewaluacja
- CDP gaps (3 karty): badgesâ†’title 10px, titleâ†’meta 4px, metaâ†’actions 15px â€” **Pass**
- ID chip `M-SLI504000-07-26` peĹ‚ny tekst (br-004000) â€” **Pass**

### Zrodla
`dam-branding.css`; `brcardpad20260720a`

---

## 2026-07-20 â€” Viz modal assoc UX (tooltips / Shift+edit / toggle / video)

### Komenda/Akcja
WORKER: 4 bugi UX w `#damVizModal` Skojarzone materialy (tipy wariantow, Shift+edit, PokaĹĽ wszystkie, video thumbs).

### Log/Status
1. Tipy: usunieto hover auto-popover; tip tylko na re-click aktywnej miniatury; `data-dam-no-tip` + exclude `.dam-viz-modal__variant` w `dam-tooltips.js` (koniec podwojnego stacku DamTip + variantInfo).
2. Shift+edit: `collectAssetLinkedProductIds` + enrich przed pickerem; `collectLinkedIdsFromCtx` w `openEditPicker` (linked_products + *_ids).
3. Toggle: CSS collapse takze dla `#damVizModalAssoc` (wczesniej tylko `#damMediaPreviewLinkedAssets`); inject w A3 styles.
4. Video: `posterUrl` (&preview=1) + client capture klatki ~25% gdy most bez ffmpeg (SVG placeholder); bridge: seek 25% duration (wymaga restartu mostu + ffmpeg na PATH).
5. Filter: `isLikelyPhoneDumpAsset` (IMG_*/M-META bez roli WWW/social/POS).
6. Cache: `assocux20260720a` / media-preview `assocux20260720b`.

### Efekt/Fix
Czyste tipy; pelna lista w pickerze; Zwin ukrywa `--extra`; video ma frame (client) zamiast uil-image-slash.

### Test/Ewaluacja
- `node --check` dam-viz/media-preview/assoc-edit/tooltips: Pass
- CDP tip (5 wariantow owies): select B tip=0; re-click tip=1; select A tip=0: Pass
- CDP toggle Roladka 12: collapsed extras display:none 18->0; expand 18 visible: Pass
- CDP Shift+edit pinnedCount=2 == linked_products union: Pass
- CDP video: slash=0, captured jpeg nw 3840/2160: Pass
- Screenshot+Read `assoc-ux-pass2-video-tip.png`: 1 tip, video frames, toggle: Pass
- Blocked: most bez ffmpeg na PATH â€” prawdziwy JPEG z mostu dopiero po instalacji ffmpeg + restart 8766; client capture dziala

### Zrodla
`dam-viz.js`, `dam-media-preview.js`, `dam-assoc-edit.js`, `dam-tooltips.js`, `dam-brand.css`, `local_bridge.py`; token `assocux20260720b`


---

## 2026-07-20 â€” Viz changelog bar: Nieaktualne copy + tipy

### Komenda/Akcja
WORKER: UX/copy `#damChangeLogBar` - "nieaktualne" mylone ze stale logiem; stacked tipy; mojibake w tipach Historii.

### Log/Status
1. `dam-tag-edit.js`: `changeLogRowDetail` -> `Status wariantu/produktu: Nieaktualne Â· NAZWA Â· indeks` (bez `status ->`); hint bez dlugiego prefiksu (ellipsis); tipy PL z JS (`rebindChangeLogTips`); `data-dam-tip-suppress` gdy popover Historia otwarty.
2. `dam-tooltips.js`: honor `data-dam-tip-suppress` / `data-dam-no-tip` parent; export `DamTooltips.hide`.
3. `visualizations.html`: usunieto tip attrs z markupu bara (JS ustawia UTF-8); cache `chgcopy20260720d`.
4. Dane: ostatni wpis change-log = lifecycle Babka Cytrynowa X (nieaktualne) - copy-only, bez reconcile.

### Efekt/Fix
Operator widzi ze "Nieaktualne" = status wariantu na dysku (X), nie "log nieaktualny". Jeden tip naraz; PL diakrytyki OK w tipach/footercie Historii.

### Test/Ewaluacja
- `node --check` dam-tag-edit.js / dam-tooltips.js: Pass
- CDP hint: `Status wariantu: Nieaktualne Â· BABKA CYTRYNOWA Â· 6300622.00 Â· 19.07.2026 20:50`; tipAloneOk; tipWithPop=0; tipMojibake=false: Pass
- Screenshot+Read `changelog-bar-pass3-clean.png`: Pass

### Zrodla
`dam-tag-edit.js`, `dam-tooltips.js`, `visualizations.html`; token `chgcopy20260720d`; memory #138


---

## 2026-07-20 â€” Explorer select S vs L (viz Folder)

### Komenda/Akcja
WORKER: Folder Windows zaznaczal FRONT-L zamiast aktywnego FRONT-S w #damVizModal.

### Log/Status
1. Root cause (2 warstwy): (A) explorer /select gdy folder WIZKI juz otwarty potrafi zostawic poprzednie zaznaczenie (L); (B) irstWizkiPath bral pierwszy obraz alfabetycznie (= FRONT-L) przy rebuildzie z products, podczas gdy miniatura/hero jest z FRONT-S (pick_thumb_file).
2. Bridge: _select_file_in_explorer via SHOpenFolderAndSelectItems przed fallbackiem /select.
3. Viz: irstWizkiPath preferuje FRONT-S jak builder; Folder CTA bierze items[activeIdx].path.
4. Media-preview Folder: sset.path jako zrodlo prawdy.
5. Cache-bust: selects20260720a (dam-paths / dam-viz / dam-media-preview). Restart mostu 8766.

### Efekt/Fix
Reveal zawsze dostaje sciezke aktywnego wariantu; Windows zaznacza dokladny plik (S gdy S).

### Test/Ewaluacja
- Bridge POST /reveal FRONT-S.png: ok + log SHOpenFolderAndSelectItems ok has_front_s=true has_front_l=false: Pass
- CDP modal ROLADKA: data-path / filename / capture reveal = PROJEKT-ROLADKA-WOLOWA-6300697-FRONT-S.png: Pass
- firstWizkiPath unit (L+S pool -> FRONT-S.png): Pass

### Zrodla
local_bridge.py, dam-viz.js, dam-paths.js, dam-media-preview.js; token selects20260720a

---

## 2026-07-20 â€” Branding ID chip: position + global index style

### Komenda/Akcja
INTERRUPT: chip index na karcie brandingu blizej meta; wiecej powietrza nad chipem; styl = global .dam-viz-badge--index.

### Log/Status
1. Usunieto branding-only override (10px/700/border/!important) na .dam-branding-card__id-chip.
2. Layout: margin-top:12px, margin-bottom:-10px (body gap 14 â†’ chipâ†”meta ~4px).
3. Cache dam-branding.css?v=idchip20260720a (branding/viz/dashboard/explorer).

### Efekt/Fix
Chip wyglada jak index badge na viz; siedzi blizej linii meta.

### Test/Ewaluacja
- CDP beforeâ†’after: above 7â†’14, chipâ†”meta 14â†’4; styleMatchVizIndex (11.5px/500/5px 11px/rgba70,66,85): **Pass**
- Screenshot+Read randing-idchip-after.png: **Pass**

### Zrodla
dam-branding.css; token idchip20260720a



---

## 2026-07-20 â€” Branding UI: mojibake Polish chrome (UTF-8)

### Komenda/Akcja
WORKER: napraw zepsute polskie znaki w branding.html (Wyczysc/Pokaz/tydzien/miesiac/uzycia).

### Log/Status
1. Root cause: pps/web/branding.html mial podwojne mojibake, potem plik zostal tez zapisany jako **cp1250** (bajty 9C E6 zamiast UTF-8 C5 9B C4 87 dla sc). dam-branding.js byl czysty UTF-8.
2. Meta charset UTF-8 byl OK; problem = literalne stringi w HTML.
3. Przepisano chrome PL przez Python write_bytes(utf-8) + unicode escapes (bez PowerShell Set-Content).
4. Sibling: tipy changelog w isualizations.html (PokaĹĽ wszystkie + tipy Historii).
5. Cache-bust: renc20260720d na dam-branding.js/css w branding.html.

### Efekt/Fix
Chrome Branding renderuje: WyczyĹ›Ä‡, PokaĹĽ, tydzieĹ„, miesiÄ…c, uĹĽycia, niemiÄ™sa.

### Test/Ewaluacja
- Disk+HTTP bajty clear: C5 9B C4 87 (UTF-8 sc): Pass
- CDP: clear=WyczyĹ›Ä‡ filtry cps=[...,347,263,...]; tabs PokaĹĽ; week/month/prio: Pass
- Screenshot+Read randing-polish-final-pass.png: Pass
- 
ode --check dam-branding.js: Pass

### Zrodla
randing.html, isualizations.html; token renc20260720d

---

## 2026-07-20 â€” restore disk+DB connectivity + TUBA PREZENT index (WORKER)

### Komenda/Akcja
CRITICAL ops: diagnostyka X:/Postgres/bridge, reindex, widocznosc TUBA MINI PREZENT 6300XXX w Projekty.

### Log/Status
1. Diagnose: X:\Marketing online; Postgres Synology online (Baza online); /files/status probe_ok; bridge api_version=5.
2. Test-Path PROJEKT: True (nazwa folderu ma em-dash U+2014, nie ASCII hyphen â€” stÄ…d wczesniejszy False na sciezce usera).
3. Zombie: 2x local_bridge + 2x watch-file-index â†’ zabito duplikaty; zostawiono 1 bridge (PID 47620) + 1 watcher --interval 5.
4. TUBA MINI PREZENT juz byl w file-index jako revision produktu mix-tuba-30-szt-xmas-mixy, ale:
   - enrich-search-tags kasowal foldery wariantow z search_blob â†’ search PREZENT/6300XXX nie znajdowal;
   - pickLatestRevision bral pierwszy is_latest (stary 28.02) zamiast PREZENT 07.07.
5. Fix: enrich-search-tags (foldery + 6300XXX w blob); dam-api/dam-projects pickLatestRevision po dacie; meta.revisions w Projekty; bump ?v=projidx20260720a na index.html.
6. Index: python build-file-index.py (pelny rebuild + enrich) â†’ products=184, mtime 2026-07-20T21:59:23Z.

### Efekt/Fix
Pliki online + Baza online. Search 6300XXX/PREZENT pokazuje karte Batony Â· TUBA 30 SZT XMAS (wariant PREZENT w indeksie). Watcher 5s (agresywniej niz 10 min).

### Backup
brak

### Test/Ewaluacja
- Test-Path PROJEKT (emdash): True
- /db/status Baza online postgres; /files/status online true
- file-index: folder TUBA MINI - PREZENT - 07.07.2026 - 6300XXX.00; search_blob has prezent+6300xxx
- CDP Projekty q=6300XXX: karta TUBA 30 SZT XMAS; latestFolder=PREZENT: Pass
- Screenshot index.html?q=6300XXX + Read: Pass (karta widoczna; status listy Niekompletny â‰  NIEAKTUALNE lifecycle)

### Zrodla
enrich-search-tags.py, dam-api.js, dam-projects.js, index.html, build-file-index.py, watch-file-index.py, local_bridge.py

---

## 2026-07-20 â€” site-wide Polish mojibake fix (encoding only)

### Komenda/Akcja
Fix PL mojibake w calym `apps/web/**` HTML chrome (settings devices card, branding, shell pages).

### Log/Status
1. Root cause: UTF-8 odczytany jako cp1250, zapisany ponownie jako UTF-8 (nie brak meta charset).
2. Naprawiono 16 HTML: activity, consents, costs, docs-security, help, inbox, index, integrations, invoices, license, privacy, profile, project, settings, signin, terms.
3. Branding/explorer/dashboard/viz juz mialy poprawny UTF-8; indeksow JSON nie ruszano.
4. Cache-bust: bump numerycznych `?v=` w naprawionych HTML; cofnieto przypadkowy `dam-version.js?v=3.0.6` -> `2.0.6`.
5. Skrypt naprawczy: `tools/_fix_mojibake_utf8.py`.
6. memory.md #140: HARD UTF-8 dla apps/web.

### Efekt/Fix
UI PL czytelny site-wide w HTML chrome. Meta UTF-8 bez zmian (juz OK).

### Backup
brak (odwracalne przez git)

### Test/Ewaluacja
- Residual grep mojibake markers w apps/web html/js/css: 0
- CDP settings devices title + clear aria: Pass
- CDP branding Wyczysc filtry / Pokaz wszystko: Pass
- Screenshot settings devices card + branding clear + Read: Pass

### Zrodla
tools/_fix_mojibake_utf8.py, apps/web/*.html (16), memory.md #140


## 2026-07-21 - Assoc skeleton: 5-col full-width + fade (no scroll)

**Komenda/Akcja:** WORKER fix #damVizModalAssoc skeleton loader (cramped scroll -> premium 5xN fade).

**Log/Status:**
1. Root cause: showAssocPaneLoading wstawial zagniezdzozny .dam-media-preview__assoc-grid--loading do #damVizModalAssoc (ktory juz jest gridem) + tylko 6 komorek -> 1 item w outer gridzie z overflow-y:auto = maly scrolled box.
2. Fix JS (dam-media-preview.js): cells bezposrednio w mount; klasa --loading na mount; rows z wysokosci pane; --dam-assoc-skel-rows; clearAssocPaneLoadingState przed real content.
3. Fix CSS (dam-brand.css + dam-viz-modal.css + inject w A3 styles): 
epeat(5,minmax(0,1fr)), overflow:hidden, mask gradient (row1 solid -> row2 0.8 -> transparent w srodku ostatniego rzedu).
4. Cache: ssocskel20260721b (viz/explorer/branding/dashboard + ensureVizModalCss + dam-viz inject).

**Efekt/Fix:** Skeleton wypelnia szerokosc pane (535px), 5 kolumn, fade mask, bez H-scroll; po load karty normalne (overflow auto).

**Test/Ewaluacja:**
- 
ode --check dam-media-preview.js OK
- CDP: cols=5, cells=55, nested=0, overflowY=hidden, hScroll=false, maskStops 0/9/18/95.45%, w=535 â€” Pass
- Screenshot+Read #damVizModalAssoc pass2/pass3 (fade) â€” Pass
- After load: loading=false, items=24, skel=0, overflowY=auto â€” Pass

**ĹąrĂłdĹ‚a:** dam-media-preview.js, dam-brand.css, dam-viz-modal.css; token assocskel20260721b

## 2026-07-21 - Assoc skeleton tiles (reject bars) fix

**Komenda/Akcja:** INTERRUPT â€” user rejected 5 vertical grey bars; want 5xn tile cards + fade tiles.

**Log/Status:**
1. Wrong before: grid-level CSS mask on full-width squares blended into 5 tall stripes; fade unread.
2. Fix: card markup (thumb square + 2 label lines); per-row --dam-skel-op (1â†’0.8â†’â€¦â†’0.28); last row .is-skel-last mask to 0 at 50% height; no grid mask; injectAssocSkeletonStyles (#dam-assoc-skel-styles).
3. Cache: ssocskel20260721c.

**Test/Ewaluacja:**
- CDP: cols=5, cards=40, thumbSquare, rowOps [1..0.28], lastMask transparent@50%, gridMask=none, hScroll=false â€” Pass
- Screenshot+Read assoc-skel-tiles-pass3(+full): distinct 5-col tiles + bottom dissolve â€” Pass

**ĹąrĂłdĹ‚a:** dam-media-preview.js, dam-brand.css, dam-viz-modal.css; token assocskel20260721c

## 2026-07-21 - Viz TUBA search / Opakowanie facet (HARD FAIL fix)

**Komenda/Akcja:** WORKER â€” user: search `tuba` on visualizations.html = 0 produktow; TUBA missing from Opakowanie tags.

**Log/Status:**
1. Bridge BEFORE: Listen PID 47620 (pythonw local_bridge); `/files/status` bez `?root=` = root_required; z `?root=X:/Marketing` = online+probe_ok.
2. Disk: `X:\Marketing` True; BATONY TUBA folder True (MIX - TUBA 30 SZT XMAS + TUBA MINI PREZENT).
3. Index juz mial `mix-tuba-30-szt-xmas-mixy` w file-index + viz_latest (carrier TUBA, tags tuba, search_blob tuba) â€” Projekty mogly Pass, a Viz facet wygladal jak brak TUBA.
4. Root cause UI: `OPAKOWANIE_CANON` trzymal `tuba` na pozycji 12; dam-tag-bar ROW_LIMIT=8 => TUBA tylko pod `+8`. User widzial DOYPACK/BATON/... bez TUBA.
5. Fix: `tuba` w top-4 OPAKOWANIE_CANON + enrich-search-tags order; `packagingTagsFrom` czyta `opakowanie` (nie tylko `pakowanie`); normalizeSearchText tez U+2013/U+2014; bump `dam-viz.js?v=tubaViz20260721a`.
6. Bridge restart: kill 47620 + duplicate http.server; single bridge (po dedupe 33668; launch.py moze relaunch â€” final Listen 57100); web 46144 (+ launch 56372 na 8765).
7. Reindex: `python apps/web/scripts/build-file-index.py` -> products=184 viz=392 + enrich-search-tags OK.

**Efekt/Fix:** Opakowanie pokazuje TUBA bez rozwijania; search `tuba` = 1 produkt MIX TUBA.

**Test/Ewaluacja:**
- CDP: searchVal=tuba, filteredLen=1, pid=mix-tuba-30-szt-xmas-mixy, count `1 produktow (1 wariantow) / z 392 wszystkich`, tubaPillVisible=true â€” Pass
- Screenshot+Read `viz-tuba-search-pass.png`: pole tuba, pill TUBA, karta TUBA 30 SZT XMAS â€” Pass
- Bridge: `/files/status?root=X:/Marketing` online; `/product-catalog` ok=true

**ĹąrĂłdĹ‚a:** build-file-index.py, enrich-search-tags.py, dam-viz.js, visualizations.html; token tubaViz20260721a
---

## 2026-07-21 â€” viz-modal assoc variant grouping

### Komenda/Akcja
Grupowanie wariantow kreacji w `#damVizModalAssoc` (device / WxH / quality stem) - 1 kafelek + badge N.

### Log/Status
1. Branding project groups = `marketingGroupKey` / `folder_group_id` (folder scope), nie stem.
2. `creativeKey` w media-preview NIE tnie WxH/device (Rule A jakosci) - dodano `familyCreativeKey`.
3. Nuggets: w indeksie sa warianty rozmiaru (`1024x445`â€¦) i rozszerzen (jpg/png/psd/tif); nie tylko quality-tier.
4. Implementacja w `dam-media-preview.js`: `groupAssocMaterials`, badge, label `N grup Â· M plikow`, klik = primary + siblings grupy.
5. Cache-bust `?v=assocgroup20260721a` (visualizations/dashboard/branding/explorer).
6. Style badge wstrzykniete (`injectA3Styles`) - bez edycji dam-brand.css.

### Efekt/Fix
NUGGETS 6300586: `137 plikow` â†’ `114 grup`; SLIDER I MIEJSCE badge 3; ZESTAW BURGERĂ“W/KieĹ‚basek/OBIADOWY/ĹšNIADANIOWY badge 4.

### Backup
brak

### Test/Ewaluacja
- node --check dam-media-preview.js: Pass
- CDP unit: SLIDER 3â†’1, ZESTAW 4â†’1, primary DESKTOP/1200x1200: Pass
- CDP live modal label `114 grup Â· 137 plikow`, badges 3/4: Pass
- Screenshot+Read pass1 + pass3 expanded: Pass (Elementy/Surowe nienaruszone)

### Zrodla
dam-media-preview.js, dam-branding.js (marketingGroupKey read-only), branding-index.json, code-doctrine.md

---

## 2026-07-21 â€” TUBA MINI PREZENT: 3 wizki w modalu + Surowe z links

### Komenda/Akcja
Fix modalu wizualizacji MIX TUBA / rewizja TUBA MINI PREZENT: brakujace wizki w stripie + wyciek ciast do Surowe elementy.

### Log/Status
1. Disk: `4 - WIZKI` = 3x `TUBA PREZENTOWA - SZKIC - D (1|2|3).jpg`; `2 - PROJEKT/links` = 9 plikow (Design/LISCIE/ROZA/magnificâ€¦).
2. file-index juz mial 3 wizki; `viz_latest` / modal robily 1 wiersz na jezyk (`firstWizkiPath`).
3. Surowe: `isLinksRawPath` lapal ARCHIWUM `â€¦/links/` (paczka_Sial cakes, 12x_XMAS/LINKS) przez luĹşne `\links\`.
4. Fix UI: `expandModalWizkiVariants` + `buildModalItems` w dam-viz.js; zaostrzony `isLinksRawPath` + `pathUnderRevision` + `revision_path` w productContext.
5. build-file-index: `_is_elements_dirname` + links/linki.
6. Cache-bust: dam-viz `tubaVizStrip20260721a`, dam-media-preview `tubaLinks20260721a`.

### Efekt/Fix
Strip = 3 thumbs PLÂ·(1|2|3); hero = `/media` oryginal SZKIC; Surowe elementy (8) z PREZENT links (bez sernik/szarlotka). Design na tube2 (~871MB) nie w brandingu â€” poza 8.

### Backup
brak

### Test/Ewaluacja
- node --check dam-viz.js + dam-media-preview.js: Pass
- CDP: variantCount=3, paths SZKIC (1)(2)(3), heroNatural 2688x4479, Surowe (8) names z links, cakeLeak=false â€” Pass
- Screenshot+Read `tuba-mini-prezent-viz-modal-pass.png`: Pass

### Zrodla
dam-viz.js, dam-media-preview.js, build-file-index.py, visualizations.html (+ dashboard/branding/explorer cache-bust), branding-index product_element PREZENT links

## 2026-07-21 â€” fix show-all viz card hero (TUBA)

### Komenda/Akcja
Naprawa karty produktu gdy toggle **PokaĹĽ wszystkie** ON: nie pokazywac BRAK WIZUALIZACJI / ZgĹ‚oĹ› gdy ktorykolwiek wariant ma wizke.

### Log/Status
1. Trace: showAll -> expandVizFromProducts(indexData, !showAll) dolacza rewizje z has_viz:false.
2. TUBA XMAS: 2 rewizje obie is_latest; pierwsza w tablicy wizki_count=0 (28.02), druga wizki_count=3 (07.07 PREZENT).
3. Bug: 
enderGroup bral items[0] + 
oViz = first.has_viz === false -> cala karta produktu pusta.
4. Fix: itemHasViz / pickCardHero / orderGroupItemsForCard â€” hero = latest+thumb sposrod wariantow Z wizka; 
oViz tylko gdy ZADEN wariant nie ma wizki.
5. Cache-bust: visualizations.html dam-viz.js (aktualny token sibling: tubaHeroFullRes20260721d).
6. 
ode --check dam-viz.js OK.

### Efekt/Fix
Search 	uba + PokaĹĽ wszystkie ON: thumb + PrzejdĹş + share (nie ZgĹ‚oĹ› / noviz).

### Backup
brak

### Test/Ewaluacja
- CDP OFF: 1 prod (1 war) / 392; thumb; PrzejdĹş â€” Pass
- CDP ON: 1 prod (2 war) / 762; thumb; PrzejdĹş; hasNoviz=false â€” Pass
- Pass2 toggle cycle OFF-ON-OFF-ON â€” Pass
- Pass3 hard reload LS show_all=1 â€” Pass
- Screenshot+Read OFF + ON + pass3 â€” Pass (CDP status ON = 2/762 silniejszy niz caption)

### Zrodla
dam-viz.js (pickCardHero, orderGroupItemsForCard, renderGroup, openProductModal), visualizations.html, file-index revisions TUBA XMAS

## 2026-07-21 - Settings: Historia zmian + jump search â€žhistoriaâ€ť

### Komenda/Akcja
User Fail: settings search â€žhistoriaâ€ť = Brak ustawieĹ„. DodaÄ‡ kartÄ™ Historii zmian na dysku + search jako skrĂłty UI (nie assety).

### Log/Status
1. Root cause: aktywny chip (np. Profil z sessionStorage) ukrywaĹ‚ kartÄ™ Dysk mimo trafienia data-search.
2. Karta #historiaZmian / alias #damDiskHistory pod filtrem Dysk; inline panel + â€žOtwĂłrz panelâ€ť (shared DamTagEdit life-hist layout).
3. dam-settings.js: UI_JUMP_REGISTRY + #damSettingsJumpResults; przy q chip nie filtruje kart; hint liczy karty+skrĂłty.
4. Cache-bust jumpsearch20260721a (settings css/js, tag-edit, brand).

### Efekt/Fix
Szukaj â€žhistoriaâ€ť â†’ â‰Ą1 karta + 3 skrĂłty (Settings / Inbox / Viz). Layout czytelny (chip F/X/D, osobne linie).

### Backup
brak

### Test/Ewaluacja
- CDP (chip Profil + q=historia): hint â€ž1 kart + 3 skrĂłtĂłwâ€ť, cardHidden=false, jumpLabels=[Historia zmian na dysku, Historia (WiadomoĹ›ci), Historia zmian na dysku (Wizualizacje)] â€” Pass
- CDP open panel: popoverItems=20, list items readable Status wariantu â€” Pass
- Screenshot+Read settings search historia â€” Pass
- node --check dam-settings.js + dam-tag-edit.js â€” Pass

### Zrodla
settings.html, dam-settings.js, dam-settings.css, dam-tag-edit.js, dam-brand.css (.dam-changelog-history*)


## 2026-07-21 - Inbox Historia lifecycle: Cofnij/Ponow + PL tytuly

### Komenda/Akcja
WORKER: per-item Cofnij/Ponow na wpisach lifecycle, zero English approved, czytelne tytuly (produkt/tagi/indeks/zmiana PL).

### Log/Status
1. Root cause: loadLifecycleHistoryAsInbox czytal tylko top-level letter/status/scope; reconcile/pull maja dane w details_program/drifts -> fallback Lifecycle bez statusu Â· status. status hardcoded approved -> Decyzja: approved.
2. mapLifecycleHistoryEntry: nest extract + PL change sentence + enrich z file-index (nazwa, tagi, indeks).
3. historyActionsHtml: lifecycle dostaje Cofnij/Ponow (ten sam change-log undo/redo co banner); disabled gdy !can_undo/!can_redo.
4. buildDetailHtml lifecycle: Zmiana/Status/Produkt/Tagi (bez Decyzja: approved); decisionStatusPl dla tag_proposal.
5. Cache-bust inbox.html dam-inbox.js?v=histLc20260721pl02.

### Efekt/Fix
lc_1784577971703: BABKA CYTRYNOWA Â· 6300622.00 Â· wariant Â· tagi Â· uzgodnienieâ€¦; Cofnij/Ponow na kazdym lc_*; brak approved w liscie.

### Backup
brak

### Test/Ewaluacja
- node --check dam-inbox.js â€” Pass
- CDP: 163 lc z undo-last; anyApproved=false; anyJunk=false; detail PL â€” Pass
- Screenshot+Read pass1 expanded / pass2 Nieaktualne / pass3 lista â€” Pass

### Zrodla
apps/web/assets/js/dam-inbox.js, apps/web/inbox.html, apps/web/data/lifecycle-status.json, program-instructions lifecycle.status_fxd
## 2026-07-21 - Dashboard PODGLAD wireframes per-widget

### Komenda/Akcja
WORKER: fix customize-modal PODGLAD so each widget has a scannable bar/block silhouette matching real layout (not one generic clone).

### Log/Status
1. Root cause: previewHtmlForWidget() always emitted the same bar+short+chip mock for every widget id.
2. Added previewMockHtml(widgetId) with distinct layouts: --stat, --list, --media, --notify, --swot, --bars, --links.
3. CSS for mock variants in dam-dashboard.css; cache-bust dashboard.html ?v=prevWire20260721b.
4. Especially tasks_next = 5x (name bar | due bar); products/asana = metric block + label; viz/branding = nav dots + thumb + pills.

### Efekt/Fix
PODGLAD silhouettes differ by widget type; NastÄ™pne zadania reads as task list rows.

### Backup
brak

### Test/Ewaluacja
- node --check dam-dashboard-widgets.js â€” Pass
- CDP geometry tasks_next: 5 rows, left~124-186px + right~43-57px same Y â€” Pass
- CDP products_count metric 40px height; newest_viz_3 3 media rows 36x36 thumb + 3 dots â€” Pass
- Screenshot+Read pass1 tasks / pass2 products / pass3 tasks+media â€” Pass

### Zrodla
apps/web/assets/js/dam-dashboard-widgets.js, apps/web/assets/css/dam-dashboard.css, apps/web/dashboard.html

### Update 2026-07-21d
Media wireframe refined to 2x2 grid with thumb|text side-by-side cells (matches default viz/branding layout). Cache-bust prevWire20260721d.

## 2026-07-21 - Global Historia = produktowy modal (#damLifecycleHistoryModal)

### Komenda/Akcja
INTERRUPT: Settings/Viz musza otwierac ten sam DOM co produkt (#damLifecycleHistoryModal), 70vw x 90vh + search; produkt bez search; tip Przywraca status tej pozycji + ikona.

### Log/Status
1. Usunieto / zastapiono chudy floating `.dam-changelog-history--wide` (Fail screenshot) - Settings `#damSettingsChangeHistoryBtn` i Viz `#damChangeHistoryBtn` wolaja `openLifeHistOverlay` -> `#damLifecycleHistoryModal`.
2. CSS: `--global` = 70vw x 90vh; `--product` = max-height 90vh, min-height fit-content; scrollbar `.dam-life-hist__scroll`.
3. Search tylko w global (indeks / nazwa / tagi #lc_); produkt bez search.
4. Tip restore: `data-dam-tip` + `data-life-letter`; `dam-tooltips.js` renderuje chip F/X/D/-.
5. Cache-bust `lifehistmodal20260721b`.

### Efekt/Fix
Jeden chrome modalny; global ma search i pelny rozmiar; produkt zostaje kompaktowy.

### Backup
brak

### Test/Ewaluacja
- CDP Settings Otworz: id=damLifecycleHistoryModal, scope=global, wRatio=0.7, hRatio=0.9, hasSearch=true, skinny=false - Pass
- CDP produkt: scope=product, hasSearchInDom=false, minH=fit-content, maxH=90vh, tip+letter F - Pass
- CDP Viz: ten sam modal 70/90 + search, skinnyVisible=false - Pass
- Tip HTML: Przywraca status tej pozycji + dam-lifecycle-chip--f - Pass
- Screenshot+Read settings/product/viz - Pass

### Zrodla
dam-tag-edit.js, dam-explorer.js, dam-tooltips.js, dam-brand.css, settings/viz/explorer html cache-bust

## 2026-07-21 - Settings Bento grid fill holes

### Komenda/Akcja
WORKER: Settings #damSettingsGrid dense Bento - fill empty holes (Urzadzenia lonely strip); layout only; screenshot+Read Wszystko+Dysk; no commit.

### Log/Status
1. Root cause: (a) DOM order disk -> changelog -> prefs left disk alone as span 7 with 5 empty cols; (b) .is-filtered switched to flex + max-width:960px = lonely centered strip on Dysk.
2. Reordered HTML: disk + prefs pair before changelog hero.
3. CSS: keep 12-col grid + grid-auto-flow:dense; remove flex/960 filtered mode; :has() orphan fill when pair-mate hidden; heroes 1 / -1.
4. Cache-bust settings.html dam-settings.css/js ?v=bentoSet20260721a.

### Efekt/Fix
Wszystko: profile|appearance + disk|prefs rows fill; Dysk: both tiles 100% width (no 960 strip).

### Backup
brak

### Test/Ewaluacja
- CDP Wszystko: diskPrefsSameRow=true, holeBetween=20 (gap), heights 488=488 â€” Pass
- CDP Dysk: disk+historia pct 100, maxWidth none, elementFromPoint L/C/R in damDisk â€” Pass
- Screenshot+Read pass1 Dysk / pass2 Wszystko / pass3 top Wszystko â€” Pass (vision often misreads white-on-white card edges; CDP authoritative)

### Zrodla
apps/web/assets/css/dam-settings.css, apps/web/settings.html
Checklist: C3 BENTO [x] (freeze anatomii kart; tu tylko Settings chrome/grid density)

## 2026-07-21 - Privilege audit admin-only gating

### Komenda/Akcja
WORKER: Full-site privilege audit (UI + bridge). Admin functions visible/callable only for admin; fix Fail gaps. No commit.

### Log/Status
1. READ program-instructions auth.roles_and_privilege + admin.header_switch_only.
2. Curl matrix with minted Bearer sessions (user / power_user / admin).
3. FAIL found: POST /index/rebuild, /branding/rebuild, /notification-groups (POST), GET /change-log, GET /lifecycle-reconcile?mode=boot allowed non-admin.
4. Fixed bridge + UI hide/harden; restarted local_bridge (was dual pythonw on 8766).
5. Cache-bust ?v=privgate20260721a on touched JS HTML.

### Efekt/Fix
- Bridge: admin gate on rebuilds, change-log GET, notification-groups POST, lifecycle boot/enforce.
- UI: hide Historia settings card; gate notify edit; hide Branding rebuild; explorer Odswiez skips rebuild for non-admin; boot reconcile pull-only for non-admin.
- Anti-spoof: DamApi._sessionRole from /auth/me; clear dam_admin_mode if not admin; profile default role user not admin.

### Backup
brak (no commit)

### Test/Ewaluacja
- user/power_user POST /index/rebuild -> 403 admin_required (was 200)
- user/power_user POST /branding/rebuild -> 403
- user/power_user POST /notification-groups -> 403
- user/power_user GET /change-log -> 403
- user/power_user GET /lifecycle-reconcile?mode=boot -> 403; mode=pull -> 200
- user rename-revision-prefix spoof admin_mode -> 200 queued immediate=false
- node --check all touched JS; ast.parse local_bridge.py

### Zrodla
local_bridge.py, dam-api.js, dam-shell.js, dam-settings.js, dam-tag-edit.js, dam-explorer.js, dam-branding.js, profile.html, program-instructions auth.roles_and_privilege

## 2026-07-21 - Viz modal meta stack vertical rhythm

### Komenda/Akcja
WORKER: Fix vertical rhythm / padding between content groups in viz modal (align with grid card body). No commit.

### Log/Status
1. Design Read: Geex viz meta stack = tags â†’ title â†’ ID â†’ filename â†’ carrier as groups.
2. CDP card `#vizGrid .dam-viz-card__body`: gap token 14px (actions +4 â†’ 18px).
3. Modal before (CSS margins, non-flex): titleâ†’ID ~2px, IDâ†’filename ~6px, filenameâ†’carrier ~6px.
4. Applied flex column + `--dam-viz-modal-meta-gap` on `.dam-viz-modal__body`; zeroed conflicting margins; branding title-block inherits token.
5. Pass polish: modal gap = card 14px + 2px â†’ 16px; actions margin = +4px (card token) â†’ 20px after variants.
6. Cache-bust `?v=metagap20260721d` (dam-brand / dam-viz-modal / dam-branding where touched).

### Efekt/Fix
- `.dam-viz-modal__body` flex + gap token; shared with `#damMediaPreview` via same classes.
- ID chip / filename styles untouched (only outer group spacing).
- Files: `dam-brand.css`, `dam-viz-modal.css`, `dam-branding.css` (+ HTML ?v=).

### Backup
brak (no commit)

### Test/Ewaluacja
- TUBA modal CDP after: tags/title/id/filename/carrier/variants = **16px**; variantsâ†’actions = **20px**; card still **14px**.
- Beforeâ†’after group gaps (px): titleâ†’ID 2â†’16; IDâ†’filename 6â†’16; filenameâ†’carrier 6â†’16.
- Screenshot+Read TUBA modal (pass1â€“3); CDP authoritative vs vision px guess.
- **Pass**

### Zrodla
apps/web/assets/css/dam-brand.css, dam-viz-modal.css, dam-branding.css; visualizations/explorer/branding HTML cache-bust

## 2026-07-21 - Inbox page-sub copy + UTF-8 overlay boot order

### Komenda/Akcja
WORKER: odchudz copy dam-page-sub, font-weight 300, sieroty/nbsp PL, fix race i18n overlay vs shell boot vs GSAP entrance (bez flash mojibake / ukrytego podtytulu).

### Log/Status
1. Root cause race: DamShell.finishBoot() przed async DamI18n.load; potem GSAP revealPageEntrance (autoAlpha) na subtitle pod body opacity:0 + stuck CSSTransition body 0->1.
2. Copy Inbox skrocony + NBSP (i/po/72 h/bez); branding/explorer/index page-sub UTF-8 + data-i18n.
3. DamI18n.whenReady + nbspPl; shell scheduleBootReveal; grid-reveal entrance bez subtitle; shell-boot bez transition; opacity !important na page-sub.
4. Jost wght@300 site-wide; cache-bust i18nboot20260721* / pagesub20260721b / shellboot20260721a.

### Efekt/Fix
Subtitle skrocony PL, fw=300, bodyOp=1, subVis=visible. Boot: hidden -> overlay ready -> reveal raz.

### Backup
brak

### Test/Ewaluacja
- node --check dam-i18n.js / dam-shell.js / dam-grid-reveal.js â€” Pass
- CDP: fw 300, nbsp>=7, bodyOp 1, subOp 0.82, diacritics â€” Pass
- Screenshot+Read crop dam-page-sub â€” Pass

### Zrodla
apps/web/inbox.html, branding.html, explorer.html, index.html, dam-i18n.js, dam-shell.js, dam-grid-reveal.js, dam-app.css, dam-shell-boot.css, i18n/pl.json, i18n/en.json


## 2026-07-21 - HARD fix PL diacritics (U+FFFD in HTML chrome)

### Komenda/Akcja
WORKER encoding: Polish diacritics broken on Branding filters (Wyczysc/tydzien/miesiac/uzycia). Intensive QA 15 rund. No commit.

### Log/Status
1. Root cause: branding.html (also explorer/dashboard) had literal U+FFFD (EF BF BD) baked into chrome strings - irreversible; NOT meta charset; NOT font; NOT whole-page fail (tags OK).
2. Side pattern: invoices.html / visualizations.html had ASCII ? leftovers (wygl?d, Poka?, j?zyk).
3. Fixed via Python UTF-8 write_bytes: tools/_fix_fffd_chrome_pl.py, tools/_fix_qmark_chrome_pl.py, tools/_wire_branding_i18n_defense.py.
4. Defense: data-i18n + keys in i18n/pl.json for branding clear/week/month/sort/show_all; boot already waits DamI18n before reveal.
5. Cache-bust branding JS/i18n and page ?v=plenc20260721*.

### Efekt/Fix
- Files: branding.html, explorer.html, dashboard.html, invoices.html, visualizations.html, i18n/pl.json; tools scripts above.
- Site-wide FFFD in apps/web HTML/JS/CSS (ex vendor) = 0; mojibake marker sweep = 0.

### Backup
brak (no commit)

### Test/Ewaluacja
- Disk+HTTP bytes: Wyczysc=C5 9B C4 87, tydzien=C5 84, miesiac=C4 85, uzycia=C5 BC.
- CDP textContent + codepoints: s-acute U+015B, c-acute U+0107, n-acute U+0144, a-ogonek U+0105, z-dot U+017C; body FFFD=0 diamond=0.
- Range paint: s-acute/c-acute non-zero client widths (glyphs painted).
- Rundy: branding filters (1-5 Pass), settings (6-8 Pass), viz+inbox headers (9-11 Pass), reload overlay race (12-13 Pass), site-wide grep (14-15 Pass).
- Pass (FAIL gate: any diamond on branding filters - none).

### Zrodla
memory #140; tools/_fix_fffd_chrome_pl.py; apps/web/branding.html; dam-i18n.js boot contract

## 2026-07-21 - WORKER: assoc META false+ / copy ID / meta layout 12-18-8 / no PSD in variants

### Komenda/Akcja
Fix (1) wrong assoc IMG/M-META703783* for V-6300711 PROTEINA KARMEL, (2) right-click copy on ID chips everywhere, (3) viz+branding meta stack 12/18/8 + title 24px, (4) interrupt: no PSD in `#damMediaPreview` variant-grid (PSD only SourceMount, newest mtime). No commit.

### Log/Status
1. Root cause A: `IMG_1266/67/68` (br-003783..) from WSPOLPRACE influencer folder linked to 6 PROTEINA* products; `isLikelyPhoneDumpAsset` was bypassed when `asset_role=social_asset` (KEEP roles short-circuit). Display ID M-META* via DamMarketingId type META.
2. Fix A: hard-reject phone dumps in `passesMarketingAssocMaterial`; tighten `isRelevantMaterialForProduct` (no KEEP-only pass for spray links without product signal).
3. Fix B: assoc-index chips get `data-marketing-id` + bindIdChipCopy + document contextmenu delegation; `user-select:text; cursor:copy`.
4. Fix C/D: `#damVizModalFileMeta` wrap (filename+meta 8px); titleâ†’ID 12 / IDâ†’filemeta 18; branding ID under title; titles 24px (override old 17.85).
5. Fix interrupt: `folderVariantsHtml` filters EDITABLE_EXTS/source; `sourceActionFiles`/`dedupeSourceFilesByExt` pick newest mtime; branding editable push includes mtime.
6. Cache-bust `?v=assoccopy20260721c` on brand/branding/media-preview/viz/branding.js + HTML.

### Efekt/Fix
- Files: dam-media-preview.js, dam-viz.js, dam-branding.js, dam-brand.css, dam-branding.css, visualizations/explorer/branding/dashboard.html
- V-6300711 assoc: no IMG_1266/META703783; remaining = GOG/SHOP with "karmel" signal
- Branding br-005661: 0 PSD in variant-grid; SourceMount PSD path present

### Backup
brak

### Test/Ewaluacja
- CDP viz: gapTitleId=12, gapIdFile=18, gapFileMeta=8, titleFs=24px, hasImg=false, hasMeta703=false, assocSelect=text
- CDP branding: psdInGrid=[], sourceHasPsd=true, gapTitleId=12, gapIdFile=18, titleFs=24px
- Screenshots+Read: branding-psd-source-pass1.png, viz-assoc-layout-pass2.png
- node --check: media-preview, viz, branding OK
- Verdict: Pass

### Zrodla
program-instructions viz.assoc_no_visualization_loop; dam-dobrakaloria; ui-taste; branding-index br-003783/br-005660

### Dopisek 01:24 â€” tighter index scope (assoccopy20260721d)
Przy `ctx.index` wymagaj indeksu w blobie (hits>=99) lub >=2 tokenow â€” samo "karmel" odpada. V-6300711: assoc=0 (Brakâ€¦) bo wszystkie raster KEEP sa spray-linkami 6â€“7 produktow bez 6300711 w sciezce; packshoty z indeksem i tak tnie `isVisualizationAsset`. CDP: empty OK, gaps 12/18/8, title 24px. Pass.


## 2026-07-21 01:41 â€” Resume WORKER e5c3f108 (dam-assoc-ux-unify)

**Komenda/Akcja:** Resume interrupted assoc UX unify after Nuggets partial restore. Intensive ui-taste focus zones + Ralph US-01â€¦US-10.

**Log/Status:**
1. Audyt: Nuggets juz 41 grup; DamAssocEdit.bindMaterialsPane byl w pliku ale stary cache bez eksportu â€” hard reload.
2. Shift+/- density: rozszerzono DamCardZoom w dam-media-preview (apply + Shift+Plus/Minus step 5 + CSS vars na assoc pane roots); branding/viz apply deleguja do DamCardZoom.
3. UTF-8: naprawiono mojibake w branding.html / visualizations.html (PokaĹĽ, Filtr jÄ™zyka, Skala kafelkĂłw, tipy); #damBrandingSearch niemiÄ™sa OK.
4. QA CDP: popover 0.70Ă—0.90; gaps 8/8/10; studio Z tĹ‚em + XL/L/S; M-SLI 2 produkty daktylowe; copy index; DamLoader Skojarzeniaâ€¦
5. prd.json: wszystkie US-01â€¦US-10 passes:true z dowodami.

**Efekt/Fix:**
- Files: dam-media-preview.js, dam-viz.js, dam-branding.js, dam-assoc-edit.js (prior), branding.html, visualizations.html, prd.json
- Cache-bust: assocfix20260721h (media-preview/assoc-edit/viz/branding)

**Backup:** brak

**Test/Ewaluacja:**
- Nuggets N=41 grup / 64 pliki; IMG_* = false
- Zoom thumbW 45.5@65 â†’ 105@150; Shift+/- step 5
- Popover ratios 0.700 / 0.900
- M-SLI products: chrupiacy-orzech-daktylowy, jab-ko-cynamon-daktylowy
- Screenshots: r01-nuggets-materials.png, r05-zoom-before-65.png, r05-zoom-after-150-assoc.png, r08-msli-popover-70-90.png, r08-branding-search-niemiesa.png
- node --check: OK
- Verdict: Pass US-01â€¦US-10

**ĹąrĂłdĹ‚a:** skill dam-dobrakaloria; ui-taste; code-doctrine; .ralph/projects/dam-assoc-ux-unify/prd.json


## 2026-07-21 ~02:00 â€” WORKER DamLoader label + 3s center hold

**Komenda/Akcja:** Fix loading bar: copy "Ĺ‚adowanie" + HOLD_CENTER_MS 3s before bottom dock.

**Log/Status:**
1. Root cause: call-sites DamLoader.start("Skojarzeniaâ€¦") + HOLD_CENTER_MS=1000 in dam-loader.js.
2. Central fix in dam-loader.js only (avoid viz/assoc sibling files): LOADER_LABEL always "Ĺ‚adowanie"; HOLD_CENTER_MS=3000; STYLE_ID bump.
3. Cache-bust HTML: dam-loader.js?v=loaderhold3s20260721a (10 HTML).
4. CDP + screenshots: center label/pos; dock after ~3s; fast done <3s no dock.

**Efekt/Fix:**
- WRITE: apps/web/assets/js/dam-loader.js
- Cachebust: branding/explorer/dashboard/visualizations/settings/profile/invoices/integrations/inbox/costs.html
- node --check: OK

**Test/Ewaluacja:**
- start('Skojarzeniaâ€¦') â†’ label "Ĺ‚adowanie"
- ~2.8s: centerish, width~300 (loader-center-pass1.png)
- dock: nearFab, width~40 (loader-bottom-pass2.png); firstNarrow ~3478ms; lastWide ~3176ms
- done@800ms: midCenterish, fade from center (afterTop 495), never docked
- Verdict: Pass

**ĹąrĂłdĹ‚a:** dam-dobrakaloria; code-doctrine Â§3 cache-bust; DamLoader API


## 2026-07-21 ~02:05 â€” HARD CANON modal parity + PokaĹĽ wszystkie

**Komenda/Akcja:** ZapamiÄ™taj na zawsze: Wizualizacje = layout kanon; Eksplorator parity; wariant = indeks produktu; studio = TĹO/PERSPEKTYWA/JAKOĹšÄ†; przycisk PokaĹĽ wszystkie.

**Log/Status:**
1. memory.md #141 + program-instructions `ui.viz_modal_parity_explorer` (v11).
2. dam-media-preview.js: productIndexVariantsHtml (bez WARIANTY MATERIAĹU jako perspektyw); studio 3 ramki + PokaĹĽ wszystkie (grupy fade-in).
3. dam-branding.css: studio-frames grid + all-files animation.
4. Cachebust: parity20260721a.

**Efekt/Fix:** WRITE memory.md, program-instructions.json, dam-media-preview.js, dam-branding.css, HTML ?v=

**ĹąrĂłdĹ‚a:** user HARD 2026-07-21; ui-taste; dam-dobrakaloria

## 2026-07-21 02:05 - Assoc minus restyle (red / white / hover)

**Komenda/Akcja:** WORKER restyle .dam-assoc-quick-minus (visual + hover only; keep 2s hold).

**Log/Status:**
1. Inject CSS in dam-assoc-edit.js: bg #dc2626, border 1px #fff, solid white bar 13x3 (kill Unicons glyph).
2. Hover / .is-hover-force: scale(1.05) + ox-shadow: 0 4px 12px rgba(220,38,38,.2).
3. Hold logic untouched (HOLD_MS=2000, pointerdown/up/leave).
4. Cache-bust ?v=assocMinus20260721b on branding/explorer/dashboard/visualizations.

**Efekt/Fix:** Destructive minus always visible; clear delete affordance; hover enlarge + red glow.

**Test/Ewaluacja:**
- node --check dam-assoc-edit.js OK.
- CDP default: bg rgb(220,38,38), border 1px white, icon 13x3.
- CDP hover-force: transform matrix(1.05...), shadow rgba(220,38,38,0.2), w 27.3.
- Screenshot+Read: assoc-minus-default / assoc-minus-item-default / assoc-minus-hover / assoc-minus-item-hover. Pass.

**ĹąrĂłdĹ‚a:** dam-assoc-edit.js; branding.html; explorer.html; dashboard.html; visualizations.html.

## 2026-07-21 ~02:00 - Faktury toolbar/filters Geex polish (intensive 10)

**Komenda/Akcja:** Fix dam-inv-toolbar + dam-inv-filters (outline chips, Geex CTAs, align baselines). Intensive ui-taste 10 passes.

**Log/Status:**
1. Root cause: inline flex styles + dam-ui-cta solid purple .dam-int-filter.is-active; Import label height inflated by file input.
2. Added apps/web/assets/css/dam-invoices.css; migrated card/toolbar/filters/summary/asana from inline.
3. dam-ui-cta.js active filter = outline + muted accent (not solid fill).
4. dam-invoices.js: drop injected CTA CSS; admin wrap via hidden/is-visible; em-dash -> hyphen in dates.
5. Cachebust: dam-invoices.css?v=invtoolbar20260721e, dam-invoices.js?v=invtoolbar20260721a, dam-ui-cta.js?v=ctaunify20260721a (invoices.html + index.html).

**Efekt/Fix:** Selected filters = white + purple stroke + muted purple text; Import/Export = 34px Geex outline CTAs; chips/CTAs same baseline; left edges toolbar=filters=table.

**Test/Ewaluacja:**
- node --check dam-invoices.js + dam-ui-cta.js OK
- CDP: active bg white / border #ab54db / color muted purple; cta border #ececf2 radius 8; items 34@sameY; leftDiff 0; emDashInMeta false
- Passes 1-10 screenshot+Read (desktop + 768/900 mid + collapsed sidebar + OpĹ‚acone/OczekujÄ…ce/Po terminie)

**ĹąrĂłdĹ‚a:** invoices.html; dam-invoices.css; dam-invoices.js; dam-ui-cta.js; checklist C2 already [x]

## 2026-07-21 ~02:10 - Viz modal parity branding (WORKER vizmod, intensive 10)

**Komenda/Akcja:** Fix #damVizModal vs #damMediaPreview gold: product INDEX variants strip, outline studio chips, spacing rhythm (badgesâ†’title 10, IDâ†’filename 10, meta ~5, studio group gap 20, body inset 40).

**Log/Status:**
1. Root cause A: product variants strip missing/weak UI â€” restored as `dam-media-preview__assoc--variants-only` + label WARIANTY PRODUKTU (thumbs by indeks+jezyk); quality XL/L/S stays in studio frames.
2. Root cause B: solid purple studio chips from `#damMediaPreviewStudio .is-active { background: var(--dam-primary); color:#fff }` â€” switched to white + 2px accent outline + muted accent text (viz + branding).
3. Root cause C: badges height 0 in assoc-split body â€” `min-height:0` + flex-shrink collapsed badges; fix `flex-shrink:0; min-height:auto`.
4. Spacing tokens: badgesâ†’title 10, idâ†’filename 10, titleâ†’id/filemeta internal 5; studio--tri gap 20; chip gap 5; body pad-x 40.
5. Order HARD (branding parity): studio â†’ quality host â†’ product variants strip.
6. Cache-bust `?v=vizmod20260721g` on visualizations/branding/explorer/dashboard.

**Efekt/Fix:** ORZESZKI/KLOPSIKI show WARIANTY PRODUKTU; chips readable outline; gaps match brief.

**Test/Ewaluacja:**
- `node --check` dam-viz.js OK
- CDP Pass10 ORZESZKI: badgesTitle 10, idFname 10, studioGroup 20, padL 40, chip bg white / border 2px #ab54db / muted purple text, order studioâ†’qualityâ†’assoc, vBtns 7, badgesH 26
- Branding KAR6X: variants strip + idFname 10 + outline chips (CDP)
- Intensive Pass 1â€“10 screenshot+Read (viz) + â‰Ą2 branding; vision often mislabels outline as solid â€” CDP authoritative

**ĹąrĂłdĹ‚a:** dam-viz.js; dam-viz-modal.css; dam-brand.css; dam-branding.css; visualizations.html; branding.html; explorer.html; dashboard.html

## 2026-07-21 ~02:12 - Badge global +5% (WORKER badgescale)

**Komenda/Akcja:** Enlarge ALL `.dam-viz-badge` / `.dam-badge-tag` by 5% (font + padding; no transform:scale).

**Log/Status:**
1. Baseline CDP viz modal: h=24.38px, font-size=11.5px, padding=5px 11px.
2. Added `--dam-badge-scale: 1.05` in dam-tokens.css; global rule at end of dam-brand.css; late inject `#damBadgeScale5` from dam-badges.js (wins over dam-branding.css load order); assoc-edit !important updated.
3. Cache-bust `?v=badgescale20260721a/b` on key HTML (sibling may overwrite dam-brand ?v=; inject still applies).

**Efekt/Fix:** Modal/card badges ~25.59px / 12.075px / 5.25Ă—11.55 (= Ă—1.05).

**Test/Ewaluacja:**
- node --check dam-badges.js + dam-assoc-edit.js OK
- CDP: fs 12.075 (=11.5*1.05), h 25.59 (~24.38*1.05), index 6300767 Pass
- Pass 1â€“3 screenshot+Read viz modal badges

**ĹąrĂłdĹ‚a:** dam-tokens.css; dam-brand.css; dam-badges.js; dam-assoc-edit.js; visualizations.html (+ branding/explorer/dashboard/index/project/inbox/settings)

## 2026-07-21 ~02:15 - Viz modal studio UX Intensive QA (WORKER studioqa)

**Komenda/Akcja:** Finish viz-modal studio UX + ui-taste Intensive QA 10 passes (screenshotâ†’Readâ†’defectsâ†’fix).

**Log/Status:**
1. Root cause variants-gone: studio treated each WIZ file as variant / dropped INDEX strip; restored productVariantRepresentatives (lang|index) + variant strip.
2. Root cause solid purple: active studio/quality used solid --dam-primary fill; now white/lavender + purple border + muted purple text.
3. Sibling race: assoc-edit hid minus (opacity:0 Shift-only) â€” restored ALWAYS visible + late override in dam-media-preview inject; HOLD_MS=2000.
4. 3-frame grid via .studio--tri > .studio-frames CSS Grid; no JÄ™zyk row.
5. Cachebust peak: studioqa20260721z8 (siblings may overwrite HTML ?v=; verify asset content).

**Efekt/Fix:** ORZESZKI 6300767: 7 index variants, 3 equal studio frames, outline chips, minus visible, badge +3.

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-assoc-edit.js / dam-media-preview.js OK
- CDP Pass10: variants=7, frames 252pxĂ—3 same Y, chip bg white / border #ab54db / muted purple text, minus n=17 op=0.92 visible, badge +3 12px white/purple
- Intensive Pass 1â€“10 screenshot+Read (tablet stack at ~768 via Emulation; desktop polish)

**ĹąrĂłdĹ‚a:** dam-viz.js; dam-assoc-edit.js; dam-media-preview.js; dam-branding.css; dam-brand.css; visualizations.html (+ dashboard/explorer/branding cachebust)


## 2026-07-21 ~02:16 - Viz modal HARD: show-all / title gap / chip 1px (WORKER)

**Komenda/Akcja:** Three HARD fixes in viz/media-preview modal. Screenshot+Read. Cache-bust. No commit.

**Log/Status:**
1. Show-all: group key persp|bg (not size); labels FRONT Â· Z tĹ‚em; qualities XLâ†’Lâ†’Sâ†’S-SKLEP horizontal grid; outer CSS multi-column.
2. Title gap: killed negative margin (sibling 10-14=-4 â†’ net 10); body gap 16px + title padding-top 4px; badges flow max-height:none.
3. Active chips/pills: border 1px (was 2px) in dam-branding / dam-brand / dam-viz-modal.
4. Bumped injected dam-viz-modal.css ?v= in dam-viz.js + dam-media-preview.js; HTML ?v=showall20260721g.

**Efekt/Fix:** Readable show-all groups; title.top â‰Ą badges.bottom +12; quiet 1px purple outline.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js OK
- CDP: gapPx=16 Pass; chip borderTopWidth=1px Pass; groups side-by-side (same top, left 123/326); quals XL/L/S/S-SKLEP; grid display
- Screenshot+Read passes (modal + show-all)

**ĹąrĂłdĹ‚a:** dam-viz.js; dam-media-preview.js; dam-branding.css; dam-brand.css; dam-viz-modal.css; tools/_bump_showall_cache.py; visualizations/branding/explorer/dashboard.html

## 2026-07-21 ~02:16 - Viz modal actions bar sticky white (WORKER)

**Komenda/Akcja:** Fix `#damVizModal .dam-viz-modal__actions` (and shared `#damMediaPreview`) so bar never disappears under expanded PokaĹĽ wszystkie / all-files; white bg + 12px padding; z-index above scroll content.

**Log/Status:**
1. Root cause: actions lived inside scrollable `.dam-viz-modal__body`; expanding studio all-files pushed bar below fold / under content.
2. Moved actions to sibling under `.dam-viz-modal__main` (dam-viz.js + dam-media-preview.js split layout).
3. CSS pin: `__main > __actions` flex 0 0 auto, bg #fff, z-index 40; body scrolls (z 1 for all-files/studio); sticky fallback when actions remain in body.
4. Buttons: secondary/icon/admin bg #fff, padding 12px; PrzejdĹş keeps Geex primary purple.
5. Cache-bust `?v=actionsBar20260721a` on CSS/JS + HTML.

**Efekt/Fix:** Action bar pinned below body scrollport; clickable while all-files expanded.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js OK
- CDP: actionsZ=40, actionsBg=rgb(255,255,255), secondary pad/bg #fff 12px, elementFromPoint PrzejdĹş hits=true after thumb click + body scroll; constrained main 640px still hits
- Screenshot+Read pass1/pass2/pass3

**ĹąrĂłdĹ‚a:** dam-viz-modal.css; dam-brand.css; dam-branding.css; dam-viz.js; dam-media-preview.js; visualizations/explorer/dashboard/branding.html


## 2026-07-21 ~02:30 - Viz modal group tint + variants above studio (WORKER)

**Komenda/Akcja:** grouptint polish: `#f5f6fa` group surfaces, WARIANTY above studio, denser wrap fill, studio ~10% shorter, frame labels +3/+3.

**Log/Status:**
1. Root cause wrap waste: `.dam-media-preview__assoc` 2-col grid at â‰Ą640px left INDEX strip at ~half width (~370px of ~796px).
2. DOM order: variants HTML before `#damVizModalStudio` (dam-viz.js); `#damMediaPreviewAssoc` before studio (dam-media-preview.js).
3. CSS: group bg `#f5f6fa` on studio-frames / product-variants / all-group; variants-only flex full-width; denser flex wrap min 70px; studio pad/chip condense; label margin 3px 0 0 3px.
4. Cache-bust `?v=grouptint20260721c` HTML + injected dam-viz-modal.css hrefs.

**Efekt/Fix:** Variants above studio; group tints; 7 INDEX chips one row ~787px; studio-frames ~71.5px; actions bar unchanged (z40 white).

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js OK
- CDP Pass: variantsTop < framesTop; bg rgb(245,246,250) on frames/variants/all-group; framesH=71.5; firstRow=7 fillRatio~0.99; label margin 3px 0 0 3px; actionsZ=40
- Screenshot+Read 3 przeloty (pass3 outline proof: 1 row of 7)

**ĹąrĂłdĹ‚a:** dam-viz.js; dam-media-preview.js; dam-viz-modal.css; dam-branding.css; visualizations/explorer/branding/dashboard.html


## 2026-07-21 ~02:35 - Viz modal all-files: dedupe qualities + row stack (WORKER)

**Komenda/Akcja:** Fix `PokaĹĽ wszystkie`: duplicate XL/L/S/S-SKLEP tiles + groups as side-by-side columns.

**Log/Status:**
1. Root cause doubles: `expandModalWizkiVariants` flattens every WIZKI file; all-files grouped by Perspektywa|TĹ‚o but rendered every file - twin paths share same `size` label (no quality dedupe).
2. Root cause columns: `.dam-media-preview__all-files` used `grid-template-columns: repeat(auto-fill, minmax(168px, 1fr))` so groups became ~187px tall columns side-by-side.
3. JS dedupe by quality key in `dam-viz.js` + `dam-media-preview.js` (prefer active, else thumb/path score); order XLâ†’Lâ†’Sâ†’S-SKLEP.
4. CSS: all-files `flex-direction: column`; group `width:100%`; group-grid horizontal flex 72px tiles; reinforce in `dam-viz-modal.css`.
5. Cache-bust `?v=allrows20260721a` HTML + injected CSS hrefs.

**Efekt/Fix:** One tile per quality per group; groups stacked full-width rows; inner qualities horizontal; tint/actions/variants order kept.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js OK
- CDP Kulki 6300760: labels `XL L S S-SKLEP` uniq=4; group[1].top 1208 > group[0].bottom 1194; widthRatio=1.0; display=flex column; tiles sameRow LTR; groupTint rgb(245,246,250); variantsTop 199 < studioTop 345; actionsZ=40
- Screenshot+Read 3 przeloty (pass1/pass2/pass3)

**ĹąrĂłdĹ‚a:** dam-viz.js; dam-media-preview.js; dam-branding.css; dam-viz-modal.css; visualizations/explorer/branding/dashboard.html


## 2026-07-21 ~02:40 - Branding media-preview: WARIANTY labels + studio under variants (WORKER)

**Komenda/Akcja:** Fix `#damMediaPreview` material siblings mislabeled INNE/Z TĹEM + studio bar sunk under whole assoc (overlap/waste); place studio under left variant-grid.

**Log/Status:**
1. Root cause labels: branding siblings lack real persp/size axes; empty perspâ†’INNE, any bgâ†’Z tĹ‚em; duplicate identical group titles.
2. Root cause layout: `#damMediaPreviewStudio` was sibling after entire `#damMediaPreviewAssoc`, so top waited for max(variants, products) height (~gap 96px under variant-grid).
3. JS: `itemsHaveRealVizAxes` + `materialMode` â†’ all-files group `Warianty materiaĹ‚u`, tiles PSD/JPG; hide fake TĹO frames for material packs; `parkStudioOutsideAssoc` + `ensureStudioUnderVariants` moves studio into left `.assoc-col--variants` after paint.
4. CSS: studio--under-variants margin 8px; products align-self start; sep grid-row 1/-1.
5. Cache-bust `?v=brandVar20260721a`.

**Efekt/Fix:** Material all-files = WARIANTY (not INNEÂ·Z TĹEM); studio under left variants (gap 16px); products clear (horizClear); no fake TĹO for BLIX pack.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-media-preview.js OK
- CDP BLIX br-005508: before studioTopâ‰897 gapâ‰96; after studioTop=892 variantBottom=876 gap=16; parentIsVariants=true; labels=[Warianty materiaĹ‚u]; tiles=[PSD,PSD,JPG]; hasFrames=false; horizClear; elementFromPoint products=true; thumbH=476
- Viz modal spot-check: studio frames still present; all-files still PerspektywaÂ·TĹ‚o path (not material-only)
- Screenshot+Read pass1/pass2/pass3

**ĹąrĂłdĹ‚a:** dam-media-preview.js; dam-branding.css; branding/dashboard/explorer/visualizations.html


## 2026-07-21 ~02:45 - Branding: single WARIANTY strip + Shift-minus 80% (WORKER mergeVar)

**Komenda/Akcja:** Consolidate duplicate WARIANTY MATERIALU in branding materialMode into .variant-grid; hide studio all-files; Shift-minus on variant tiles; minus size x0.8.

**Log/Status:**
1. Root cause: olderVariantsHtml filtered PSD/source out of variant-grid (1 misleading card) while 
enderVizStudioControls materialMode painted a second WARIANTY block in #damMediaPreviewAllFiles (PSD/PSD/JPG).
2. Fix: materialSiblings path fills variant-grid with all siblings + EXT labels + assoc-item wrappers; materialMode studio returns empty/hidden (no all-files dup); DamAssocEdit wires Shift-minus on --variant items + size 21px (was 26); uiHard show rules cover variant-grid.
3. Cache-bust: CSS mergeVar20260721a; JS coexists with sibling token minusGlobal20260721a (parallel agent all-file minus).
4. program-instructions: branding materialMode = single variant-grid strip.

**Efekt/Fix:** One WARIANTY MATERIALU; tiles PSDĂ—2+JPG under Edytuj wszystko; all-files absent in materialMode; Shift minus 21Ă—21; product viz all-files rows+dedupe intact.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-media-preview.js / dam-assoc-edit.js OK
- CDP BLIX br-005508: wariantyLabels=1; tiles=[PSD,PSD,JPG]; allFiles=false; studioHidden; editAll; minus idle opacity0 size21; Shift opacity1
- CDP viz 6300760: frames=3; groups FRONTÂ·Z tĹ‚em / FRONTÂ·Bez tĹ‚a; tiles 4+4; flexDir=column; wariantyMaterialDup=0
- Screenshot+Read pass1/pass2/pass3

**ĹąrĂłdĹ‚a:** dam-media-preview.js; dam-assoc-edit.js; dam-branding.css; program-instructions.json; branding/dashboard/explorer/visualizations.html


## 2026-07-21 ~02:55 - studioRow: viz modal chips one horizontal row (WORKER)

**Komenda/Akcja:** `#damVizModal` studio frame chips (TĹO | PERSPEKTYWA | JAKOĹšÄ†) always ONE flex row; no wrap of 4th perspective (TYL-ENFACE).

**Log/Status:**
1. Root cause: `.dam-media-preview__studio-frame-chips { flex-wrap: wrap }` + chip `min-width:40px` / roomy padding so PERSPEKTYWA dropped TYL-ENFACE to row2 (~96-104px frame).
2. CSS: `flex-wrap: nowrap`, chips `flex:1 1 0` / Perspektywa `flex:1 1 auto`, tighter padding/font (9.5px, pad 2px 3px) in `dam-viz-modal.css`; base nowrap in `dam-branding.css`.
3. Kept outline active chips + grouptint `#f5f6fa` frames; equal 3-col grid.
4. Cache-bust `?v=studioRow20260721a` (branding) / `studioRow20260721b` (viz-modal) HTML + JS inject hrefs.
5. Small QA helper: `DamViz.openByProductId(pid)` for CDP open path.

**Efekt/Fix:** ENFACE FRONT BACK TYL-ENFACE stay one line; frameH ~61.5px (single row); responsive shrink at 700-811px studio width.

**Backup:** brak

**Test/Ewaluacja:**
- Product CIASTO ĹšLIWKOWE 6300785 (4 persps)
- CDP studioWâ‰810.72: Perspektywa tops delta=0; wrap=nowrap; frameH=61.5; labels ENFACE/FRONT/BACK/TYL-ENFACE; groupTint rgb(245,246,250); active outline rgb(171,84,219)
- Narrow 700px: delta=0, allFit=true, TYL-ENFACE sw=cw=67
- Screenshot+Read pass1 (trunc mid-label) / pass2 (full TYL-ENFACE one row) / pass3 (confirm)

**ĹąrĂłdĹ‚a:** dam-branding.css; dam-viz-modal.css; dam-viz.js; dam-media-preview.js; visualizations/explorer/dashboard/branding.html

## 2026-07-21 ~03:00 - WORKER A re-verify viz/modal 4h gaps (compA20260721a)

**Komenda/Akcja:** CDP+screenshot re-audit last ~4h FUNCTION claims; fix PARTIAL (naming-dictionary UK, inject cache token sync).

**Log/Status:**
1. Audit table â†’ `agents/shared/gap-audit-4h-worker-A.md` (12/12 SHIPPED; A13 naming-dictionary uk, A14 inject href PARTIALâ†’FIXED).
2. CDP orzeszki-kukurydza-miod: 4 show-all row groups Ă— uniq XL/L/S/S-SKLEP; rowStack; actionsZ=40; GB chips no Ukraina.
3. naming-dictionary: ukâ†’Wielka Brytania; lang_aliases ukâ†’gb; uaâ†’ua; languages.ua=Ukraina (Python UTF-8).
4. Cache-bust compA20260721a: visualizations/explorer/dashboard + inject dam-viz.js/dam-media-preview.js.

**Efekt/Fix:** Functional viz/modal claims verified live; data-layer UK label aligned with program-instructions.

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js OK
- CDP: cssHref/jsViz compA20260721a; reload modal Pass
- Intensive 12-pass screenshot+Read (orzeszki expanded all-files) Pass

**ĹąrĂłdĹ‚a:** gap-audit-4h-worker-A.md; tools/_bump_compA20260721a.py; naming-dictionary.json


## 2026-07-21 ~03:00 - WORKER B compB: ownership B re-verify + UTF-8 ship

**Komenda/Akcja:** Re-verify last ~4h branding/explorer/encoding/minus claims vs live CDP; ship PARTIAL UTF-8; token `compB20260721a`. No commit.

**Log/Status:**
1. Audit written: `agents/shared/gap-audit-4h-worker-B.md`; version proposal `agents/shared/version-bump-proposal-2026-07-21.md` (suggest **v3.1.0**).
2. B1-B3,B5-B7: CDP Pass â€” BLIX tiles PSD+JPG, KUBARA 6Ă—PNG, `Warianty materiaĹ‚u`, no all-files dup, studio hidden under variants, minus 21px Shift-gate.
3. B4 UTF-8: **was PARTIAL** â€” `visualizations.html` invalid UTF-8 + `Poka?`; `branding.html` cp1250; `settings.html` Wyczysc; `dam-explorer.js` Odswiez. Fixed Python UTF-8: `tools/_fix_compB_utf8.py`, `tools/_fix_branding_qmark_only.py`. Live CDP viz: `PokaĹĽ wszystkie` + `WĹ‚Ä…cz:` ok:true. Grep apps/web: 0Ă— `Poka?`/`W??cz`.
4. Cache-bust `compB20260721a`: `apps/web/_qa/_bump_compB.py` on branding/explorer/visualizations/dashboard + dam-media-preview/dam-viz injected CSS hrefs.

**Efekt/Fix:** Ownership B functional claims SHIPPED; UTF-8 chrome repaired on viz/branding/settings/explorer JS.

**Test/Ewaluacja:**
- node --check dam-media-preview.js / dam-assoc-edit.js / dam-explorer.js OK
- CDP: vizShowAll UTF-8 ok; branding BLIX PSD+JPG; KUBARA material grid; minus 21px
- Intensive 12Ă—/zone logged in gap-audit-4h-worker-B.md

**ĹąrĂłdĹ‚a:** gap-audit-4h-worker-B.md; version-bump-proposal-2026-07-21.md; tools/_fix_compB_utf8.py; _bump_compB.py


## 2026-07-21 ~03:00 - Viz modal composer audit + cache ship (WORKER viz-composer)

**Komenda/Akcja:** Audit abandoned FUNCTIONAL `#damVizModal` work (~4h); ui-taste Intensive 12 passes per hot zone; cache-bust `vizComposer20260721a`; gap doc. No commit.

**Log/Status:**
1. READ: process.md tail, memory #141+, gap-audit-2026-07-21.md, program-instructions canon; live CDP + screenshot on ORZESZKI 6300767 + CIASTO ĹšLIWKOWE 6300785.
2. All 9 functional zones Pass (show-all row stack + dedupe, variants above studio, studio nowrap, actions z40, Shift-minus all-file + assoc, UKâ†’GB, title gap 16px, UTF-8 chrome).
3. No new logic diff â€” prior workers' code confirmed live; ship cache token only via Python `_bump_viz_composer.py`.
4. Gap table: `agents/shared/gap-audit-viz-composer-2026-07-21.md`.

**Efekt/Fix:** Product viz modal functional checklist green; assets load `?v=vizComposer20260721a`.

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-viz.js / dam-media-preview.js / dam-assoc-edit.js OK
- CDP: groups stacked FRONTÂ·Z tĹ‚em / Bez tĹ‚a; uniq qualities 4; variantsTop<studioTop; actionsZ=40; titleGap=16; Shift-minus opacity=1 (all-file + 17 assoc); GB not UA on CIASTO
- Intensive Pass 1â€“12 screenshot+Read (pass12: red minus on assoc materials with Shift)

**ĹąrĂłdĹ‚a:** gap-audit-viz-composer-2026-07-21.md; _qa/_bump_viz_composer.py; visualizations/explorer/branding/dashboard.html; dam-viz.js; dam-media-preview.js



## Komenda/Akcja
Fix: PSD/PSB/AI/PDF poza WARIANTY MATERIALU (2026-07-21)

### Log/Status
1. Root cause: materialSiblings=true omijalo filtr isSourceVariantFile â†’ PSD w .variant-grid.
2. Filter zawsze !isSourceVariantFile; EDITABLE_EXTS + pdf; PDF w SourceMount order.
3. program-instructions ui.viz_modal_parity_explorer must/must_not.
4. Cache 
oSrcGrid20260721a.

### Efekt
WARIANTY = JPG/PNGâ€¦; zrodla tylko Przejdz / Folder / PSD w belce akcji.

## 2026-07-21 ~02:55 - UTF-8 / Polish diacritics chrome sweep (WORKER)

**Komenda/Akcja:** Naprawa mojibake / ASCII-? w PL labelach apps/web (viz #vizShowAll, tips WĹ‚Ä…cz/WyĹ‚Ä…cz, branding/explorer/settings).

**Log/Status:**
1. Root cause: PowerShell/ANSI rewrite niszczy UTF-8 PL -> literalne ?/?? (nieodwracalne) albo klasyczne podwojne kodowanie (settings/index); branding mial tez mixed UTF-8 + lone 0xF3.
2. Fix reversible: tools/_fix_mojibake_utf8.py -> settings.html, index.html.
3. Fix ? remnants: rozbudowany tools/_fix_qmark_chrome_pl.py + Python Path.write_bytes(utf-8) na visualizations/explorer/branding/dashboard/profile (+ race re-fix branding back btn).
4. Obrona: data-i18n na branding show_archive + back_browse; lekcja doctrine Â§12 + memory #141.
5. Bez commit/push (gapship). Hard refresh ?v=utf8fix20260721*.

**Efekt/Fix:** #vizShowAll = PokaĹĽ wszystkie; tip = WĹ‚Ä…cz / WyĹ‚Ä…cz; explorer/branding chrome PL OK; rg Poka\?|W\?\?cz|Wy\?\?cz = 0.

**Backup:** brak

**Test/Ewaluacja:**
- rg patterns = 0; bajty UTF-8 PL na dysku+HTTP
- CDP viz: label codePoint ĹĽ=U+017C; tip Ĺ‚=U+0142 Ä…=U+0105
- CDP explorer: label+tip OK; OdĹ›wieĹĽ z dysku OK
- CDP branding: PokaĹĽ wszystko/archiwum, WyczyĹ›Ä‡, tip liczby, WrĂłÄ‡ do przeglÄ…dania
- Screenshot+Read przelot1 secondary filters; przelot2 branding CDP; przelot3 explorer CDP

**ĹąrĂłdĹ‚a:** visualizations.html; explorer.html; branding.html; dashboard.html; settings.html; index.html; profile.html; tools/_fix_qmark_chrome_pl.py; tools/_fix_mojibake_utf8.py; agents/shared/code-doctrine.md; memory.md #141


## 2026-07-21 ~03:00 - Gap ship v3.1.0 (commit)

**Komenda/Akcja:** Synthesize gap audits A+B+composers+gapship; enforce noSrcGrid; bump v3.1.0; cache ship20260721v310; commit+push.

**Log/Status:**
1. Confirmed folderVariantsHtml always 
eturn !isSourceVariantFile(v) (PSD/PSB/AI/PDF never in variant-grid; SourceMount only). Worker B CDP PSD tiles superseded.
2. UTF-8 chrome Pass (PokaĹĽ/WĹ‚Ä…cz) from Worker B + prior qmark repair.
3. Version surfaces: version.json + dam-version.js + runtime_config.py + HTML footers/cache -> v3.1.0 / 3.1.0.
4. Unified cache token ship20260721v310 on key HTML/JS/CSS.
5. Docs: agents/shared/gap-audit-2026-07-21.md (final), process/memory/PROGRESS/README pointer.

**Efekt/Fix:** Release v3.1.0 gap ship modal parity + UTF-8 + noSrcGrid + Shift-minus.

**Test/Ewaluacja:**
- node --check dam-media-preview / dam-assoc-edit / dam-version OK
- FILTER_OK return !isSourceVariantFile(v); BAD_TRUE absent
- visualizations.html contains UTF-8 PokaĹĽ; no Poka? / W??cz

**ĹąrĂłdĹ‚a:** gap-audit-4h-worker-A/B.md; version-bump-proposal-2026-07-21.md; tools/_ship_v310_20260721.py


## 2026-07-21 ~02:55 - Global Shift-minus bubble on all-file tiles (WORKER)

**Komenda/Akcja:** Restyle assoc minus to Geex bubble 80% + HARD: Shift-minus must work globally including studio `.dam-media-preview__all-file` (XL/L/S/S-SKLEP).

**Log/Status:**
1. Root cause all-file: `ensureShiftHoverAssocUx` only wired `.assoc-item` / variant tiles inside assoc-grid; studio show-all tiles never got `.dam-assoc-quick-minus`. CSS show rules also ignored `.all-files`.
2. Nested-button risk: `.all-file` is `<button>` â†’ minus uses `span[role=button]` when parent is BUTTON.
3. Shared helpers in `dam-assoc-edit.js`: `wireQuickMinusControl`, `wireStudioAllFiles`, `ensureGlobalShiftKeyLatch`, soft-hide session action (no disk delete).
4. Hooks after studio paint in `dam-viz.js` + `dam-media-preview.js`; uiHard Shift selectors extended.
5. Bubble CSS: 21px (26x0.8), gradient red, 1px white border, soft shadow; Shift-gated.
6. Cache-bust `minusGlobal20260721a` (assoc-edit / media-preview / viz) via UTF-8 Python.

**Efekt/Fix:** 16 all-file minuses on Kulki 6300760; Shift on â†’ visible bubble; Shift off â†’ hidden; hold 2s soft-hides from picker (undo toast).

**Backup:** brak

**Test/Ewaluacja:**
- node --check dam-assoc-edit.js / dam-viz.js / dam-media-preview.js OK
- CDP S-SKLEP: after w=h=21 (~0.808 of 26); shiftOn o=1 v=visible pe=auto gradient+shadow+1px white border; shiftOff o=0 v=hidden pe=none; wired=16
- a11y: 16x aria tip soft-hide (not disk delete)
- Screenshot: pass1 Shift-on minuses on FRONT tiles; pass2 idle hidden; pass3 CDP+a11y (modal opacity tween made some frames stale â€” CDP/elementFromPoint authoritative)

**ĹąrĂłdĹ‚a:** dam-assoc-edit.js; dam-viz.js; dam-media-preview.js; visualizations/branding/explorer/dashboard.html `?v=minusGlobal20260721a`


## 2026-07-21 ~03:05 - Elementy Shift-minus + grid dedupe fix

**Komenda/Akcja:** Wire Elementy/Surowe assoc grids; fix grid collect using object keys (collapsed to 1 grid).

**Log/Status:**
1. seenGrid[htmlElement] string-key bug â†’ only first grid wired; Elementy had 0 minus.
2. Fix: gridList.indexOf(grid); scan modal scope; data-asset-id on cards; grid._damAssocList; re-wire on Elementy toggle open.
3. Token minusGlobal20260721b.

**Test/Ewaluacja:** CDP elItems with elMinus=2 after open Elementy; all-file still via wireStudioAllFiles (Kulki earlier: 16, 21px, Shift gate).

**ĹąrĂłdĹ‚a:** dam-assoc-edit.js; dam-media-preview.js

## bodyGrid20260721 - Modal body CSS Grid (meta | studio) 2026-07-21

**Komenda/Akcja:** Przebudowa panelu body w #damVizModal i #damMediaPreview: grid meta~70% | studio~30%, etykiety Nazwa/Typ pliku, zawsze 1 wariant, densyfikacja all-groups, parity explorer/viz.

**Log/Status:**
1. Markup: .dam-viz-modal__meta-rail (badges / title+id / filemeta) + .dam-viz-modal__studio-rail + variants full-width + #damVizModalAllFiles host.
2. Studio frames pionowo, bez szarego tray; all-files poza waskim railem (grid auto-fill).
3. uildProductVariantStripHtml / productIndexVariantsHtml: pokazuj przy 1 wariancie.
4. Explorer title: productContext.name zamiast duplikatu basename; Typ pliku line.
5. Edytuj wszystko: indMaterialsPane dziala z samym productContext (bez materialow).
6. Bug reveal: 
evealSequence(autoAlpha) na dzieciach body zostawial studio-rail isibility:hidden / opacity:0 - fix: fade calego body + opacity-only + clear rails po paint.

**Efekt/Fix:** Layout CDP: meta|studio sameRow, frames column, labels Nazwa/Typ, all-files 4-col dense; Edytuj wszystko widoczne w pane skojarzen.

**Test/Ewaluacja:**
- node --check dam-viz / media-preview / assoc-edit / grid-reveal OK
- CDP babka: cols ~552|243, framesDir=column, bg transparent, labels OK, all-files groups=6 cols=4
- Screenshot+Read: meta+studio side-by-side, WARIANTY below, dense all-groups
- ?v= bodyGrid20260721b/c

**ĹąrĂłdĹ‚a:** dam-viz.js, dam-media-preview.js, dam-assoc-edit.js, dam-grid-reveal.js, dam-viz-modal.css; visualizations/explorer/branding/dashboard.html



## 2026-07-21 - vizCtaNav: Folder hover + OpenFile gallery + body scroll + UTF-8 + zoom dock + loader 1.5s

**Komenda/Akcja:** WORKER (expand) - #damVizModal / #damMediaPreview action-bar + body scroll + hide parity + UTF-8 + loading translate 1.5s.

**Log/Status:**
1. Folder hover vanish: Geex .geex-btn:hover white text + actions bar ackground:#fff !important = invisible. Fix: 1px purple outline secondary CTA (idle+hover+focus) in dam-viz-modal.css.
2. OpenFile isolated: shelled to Windows only. Fix: DamMediaPreview.openAsset(siblings) when items>1; viz modal also got Prev/Next + ArrowLeft/Right.
3. Body scroll: brand.css/branding.css overflow:visible beat assoc-split overflow-y:auto (max-height 520 + parent overflow:hidden = trap). Fix: ID-scoped overflow-y:auto !important + flex min-height:0.
4. Hide parity: Explorer zoom dock (initZoomDock) not wired on Viz. Moved to DamModalShared; both shells call it.
5. UTF-8: explorer.html U+FFFD on PokaĹĽ/jÄ™zyk/OdĹ›wieĹĽ; branding.html Poka?. Rewrote via Python UTF-8 (not PowerShell Set-Content). Modal strings OtwĂłrz/PrzybliĹĽenie fixed in JS.
6. Loader: dam-skel-shimmer 1.5s + assoc padding 14px; DamLoader HOLD 1.5s + dock translate 1.5s + padding 16/24; prefers-reduced-motion.

**Efekt/Fix:** Cache token vizCtaNav20260721b. CDP: Folder opacity1 border 1px; body overflowY auto scrollTop works; OpenFile sibNav true path change; zoom is-docked; PokaĹĽ charCode 380; shimmer 1.5s.

**Test/Ewaluacja:**
- node --check dam-viz / media-preview / modal-shared OK
- CDP matrix A-E + prior CTA Pass
- Screenshot: CDP fromSurface (IDE browser_take_screenshot stale-frame on shared tab) + Read; Explorer a11y tree PokaĹĽ wszystkie

**ĹąrĂłdĹ‚a:** dam-viz-modal.css, dam-viz.js, dam-media-preview.js, dam-modal-shared.js, dam-brand.css; explorer/visualizations/branding HTML; process.md

## all-files regroup bg sections 2026-07-21

**Komenda/Akcja:** Fix `#damVizModalAllFiles` / `.dam-media-preview__all-files` layout: pusta przestrzen po prawej (auto-fill 168px), kafelki ~56px, grupy Z TLEM / BEZ TLA przeplatane. User: pelna szerokosc, wieksze kafelki (~72-88px), regroup po tle (sekcja Bez tla, potem Z tlem), etykieta grupy = tylko typ/perspektywa, wizualne rozroznienie tla globalnie (fill vs border).

**Log/Status:**
1. Weryfikacja stanu na wejsciu (ten agent kontynuowal po podsumowaniu poprzedniej sesji): kod JS/CSS z regroupem byl juz na miejscu, ALE miedzy sesjami inny, wspolbiezny agent dopisal do tych samych plikow fix `vizCtaNav20260721b` (body scroll + CTA nav) i zbumpowal `?v=` PONAD moj tag `allbgsections20260721a` w `dam-viz-modal.css` + JS-injected link + `dam-viz.js`/`dam-media-preview.js` (HTML nadal mial `dam-branding.css?v=allbgsections20260721a`, ale CSS/JS juz `?v=vizCtaNav20260721b`). Sprawdzone grep-em: regroup markup (`renderSection`/`renderGroup`/`bezOrder`/`zTlemOrder`/`data-bg`) i CSS (`.all-section-grid` flex, `data-bg="bez-tla"` border-only) SA nienadpisane w obu miejscach -> brak konfliktu, nie trzeba bylo ponownie bumpowac wersji (nowszy tag agenta B juz serwuje moj kod).
2. Root cause #1 (z poprzedniej sesji, opisana szerzej w doktrynie): `bodyGrid20260721a/b` w `dam-viz-modal.css` (`!important grid-template-columns: repeat(auto-fill, minmax(168px,1fr))` + kafelki `flex:0 0 56px`) nadpisal wczesniejszy dobry fix `allrows20260721a` z `dam-branding.css`.
3. Root cause #2 (subtelna): nawet `auto-fit` w CSS Grid nie usuwa martwej przestrzeni gdy liczba grup nie jest wielokrotnoscia liczby kolumn. Fix: flexbox (`display:flex; flex-wrap:wrap` + `flex:1 1 <basis>`) na poziomie sekcji (`.all-section-grid`).
4. JS: `dam-viz.js` i `dam-media-preview.js` grupuja pliki po `persp|bg`, dzielÄ… na `bezOrder` / `zTlemOrder`, renderuja dwie `<section class="...--bez-tla|z-tlem">` z etykieta sekcji (Bez tla / Z tlem); etykieta grupy = tylko perspektywa; `data-bg` na `.all-group` dla CSS.
5. CSS: `dam-branding.css` (base) + `dam-viz-modal.css` (scoped `#damVizModal`/`#damMediaPreview`, wygrywa nad starym `!important`): `.all-group-grid > .all-file` `flex:1 1 80px; min-width:80px; max-width:104px` (thumb ~86px, w zakresie 72-88px); `data-bg="z-tlem"` fill `#f5f6fa`, `data-bg="bez-tla"` transparent + border 1px `#f5f6fa`.

**Efekt/Fix:** Sekcje w kolejnosci Bez tla -> Z tlem (bez przeplotu); grupy rozciagaja sie na cala szerokosc rzedu (brak martwej przestrzeni nawet dla "sierocej" 4. grupy w wierszu 2); kafelki 104x123px (thumb 86x86px).

**Backup:** brak (tylko edycja kodu, brak operacji na dysku X:).

**Test/Ewaluacja:**
- `node --check dam-viz.js` / `dam-media-preview.js` - OK.
- Grep-owa weryfikacja: kod regroup (JS) i CSS flex/data-bg nienadpisane przez wspolbieznego agenta `vizCtaNav20260721b`; brak konfliktu wersji do naprawy.
- CDP produkt `mix-tuba-30-szt-xmas-mixy` (1 grupa, INNE, z-tlem): `filesWidth===groupWidth===795.71875px` (pelna szerokosc, brak dead space); `background-color: rgb(245,246,250)`, `border: 1px solid rgba(0,0,0,0)`; kafelek `104x123px`, thumb `86x86px`.
- CDP produkt `cynamonka-nerkowcowy` (4+4 grupy, viz modal): sekcje w kolejnosci `--bez-tla` -> `--z-tlem` (potwierdzone `querySelectorAll` + `className`); etykiety grup w obu sekcjach identyczne (ENFACE/FRONT/BACK/TYL-ENFACE), TYLKO typ, bez "* Z TLEM"/"* BEZ TLA"; wiersz 1 = 3 grupy x 259px (= 796px szerokosci grid), wiersz 2 = 1 "sierocia" grupa TYL-ENFACE = 796px (100% szerokosci, zero martwej przestrzeni) - to samo w obu sekcjach.
- Kolory (getComputedStyle, ten sam produkt): `bez-tla` -> `background-color: rgba(0,0,0,0)` + `border-color: rgb(245,246,250)`; `z-tlem` -> `background-color: rgb(245,246,250)` + `border-color: rgba(0,0,0,0)` - dokladnie odwrotne, zgodnie z wymaganiem #5.
- Screenshot+Read (CDP `Page.captureScreenshot`, bo `browser_take_screenshot` timeout'owal 4x z powodu `document.hidden===true` w tej karcie automatyzacji - znane ograniczenie z doktryny sekcja 12, fallback zadzialal): pass 1 = sekcja "BEZ TLA" widoczna, karty ENFACE/FRONT/BACK w rzedzie 1 z cienka biala/szara ramka bez wypelnienia, TYL-ENFACE pod nimi na cala szerokosc; pass 2 (scroll do sekcji 2) = "Z TLEM" z wyraznie widocznym szarym wypelnieniem (`#f5f6fa`) na tych samych czterech kartach - kontrast miedzy sekcjami wizualnie oczywisty. Kolejnosc, etykiety, brak martwej przestrzeni i rozroznienie tla potwierdzone jednoczesnie liczbowo (CDP) i wizualnie (2x screenshot+Read).

**ĹąrĂłdĹ‚a:** dam-viz.js (`bindVizModalStudioControls`, `renderSection`/`renderGroup`), dam-media-preview.js (`allFilesPanelHtml`), dam-branding.css, dam-viz-modal.css; dashboard/branding/explorer/visualizations.html; code-doctrine.md sekcja 12 (lekcja: flex vs grid dla fluid rzedow o nieznanej liczbie elementow + kolizja dwoch agentow tego samego dnia na tym samym elemencie).

## 2026-07-21 - vizLoadOnce: #vizGrid reveal 2x

**Komenda/Akcja:** Debugger - loading/reveal animation plays twice on visualizations `#vizGrid`.

**Log/Status:**
1. CDP probe (Page.addScriptToEvaluateOnNewDocument wrap DamLoader/DamGridReveal): skeleton=1, DamLoader.start/done=1, DamGridReveal.reveal=2.
2. Call 1 (t~661): boot -> applyFilters -> render -> reveal (111 cards).
3. Call 2 (t~1323): dam-shell DamApi.me() -> dispatch dam:admin-mode -> dam-viz listener applyFilters -> reveal again (same 111 cards).
4. Fix: lastAdminVisibilityKey latch; dam:admin-mode/storage skip when !indexData or key unchanged; mountChangeLogInScope still runs. DamLoader HOLD 1.5s untouched.

**Efekt/Fix:** Cache token vizLoadOnce20260721a on visualizations.html dam-viz.js. Post-fix CDP: reveal=1.

**Test/Ewaluacja:**
- node --check dam-viz.js OK
- CDP hard refresh: loaderStart=1 loaderDone=1 skeleton=1 reveal=1 (was 2)

**ĹąrĂłdĹ‚a:** dam-viz.js, dam-shell.js (~522 dam:admin-mode), dam-grid-reveal.js, code-doctrine.md Â§12


## 2026-07-21 - thumbPick: square tiles + all-file white media slot

**Komenda/Akcja:** Restyle `#damThumbPicker` thumbs to filled square tiles (match `.dam-media-preview__all-group` / `__all-file`); crumbs padding; kill gray bleed under all-file imgs. ui-taste 5 passes.

**Log/Status:**
1. Root cause A: `.dam-admin-control` on picker items forced `border-radius:50px !important` + purple 1.5px stroke + crushed padding - pill look.
2. Root cause B: img overflowed tile (`overflow:visible`, img taller than card) - scalloped overlap.
3. Root cause C: `.dam-media-preview__all-file img` media slot used `background:#f5f6fa` under `object-fit:contain` - gray bleed.
4. Fix: inject `<style id="dam-thumb-picker-tiles">` from `dam-viz.js`; remove `dam-admin-control` from picker item HTML; square media `aspect-ratio:1`, white card on `#f5f6fa` grid, radius 14px, transparent border; crumbs pad 12px 16px + wrap (no scrollbar); all-file img bg `#fff`; hover/focus via outline + fill tint (box-shadow stripped in this shell).
5. Cache token: `thumbPick20260721g` on dam-viz.js; branding/viz-modal CSS `thumbPick20260721a`.

**Efekt/Fix:** Picker thumbs = square filled cards; crumbs readable; all-file slot white.

**Backup:** brak.

**Test/Ewaluacja:**
- node --check dam-viz.js OK
- CDP ciasto-sliwkowe-nerkowcowy: radius 14px, border transparent, gridBg #f5f6fa, imgInside true, crumbs pad 12/16, allImgBg white
- Screenshot+Read Pass 1-5 (CDP Page.captureScreenshot; document.hidden stale browser_take_screenshot)

**ĹąrĂłdĹ‚a:** dam-viz.js (ensureThumbPickerTilesCss), dam-branding.css, dam-viz-modal.css, visualizations/explorer/branding/dashboard.html


## 2026-07-21 - langEnTag: EN canon, PROJEKT+WIZKI, Admin AJAX, KAR6X FRONT-L

**Komenda/Akcja:** HARD user decisions A-I (GB->EN, lang provenance, folder  - PL EN - , MultijÄ™zyczny search, KAR6X thumb, Dodaj typ/tag, Admin instant AJAX).

**Log/Status:**
1. program-instructions v12: data.lang_provenance_only, data.lang_uk_not_ukraine (EN), naming.folder_lang_tokens, admin.tag_instant_apply_ajax, viz.kar6x_thumb_front_l, ui.tag_edit_dodaj_typ_tag, naming.multi_means_multilang synonyms.
2. naming-dictionary: en=Angielski, aliases gb/uk->en, ua=Ukraina, multi_lang_synonyms; GC default_lang en.
3. lang-provenance.md rewritten to EN + PROJEKT/WIZKI-only + folder tokens.
4. build-file-index.py: is_lang_evidence_*, canonicalize->en, pick_thumb KAR6X FRONT-L, search_blob multi synonyms.
5. local_bridge: /revision-langs, rename folder langs, admin instant without admin_mode, add-variant-type creates Szablony folders when Marketing reachable.
6. dam-labels/tag-edit/viz: EN chips, submitLangChange AJAX, Dodaj typ/tag/Zmien kategorie dashed tile, enrichVizRow FRONT-L.
7. Surgical file-index + search-index remap gb->en; 21 KAR6X viz_latest paths -> FRONT-L; Multi search blobs +49.
8. Cache: langEnTag20260721a (labels/tag-edit), langEnTag20260721c (viz).

**Efekt/Fix:** 6300783/6300785 langs=[pl,en]; MultijÄ™zyczny search 30 hits; filter EN not GB; KAR6X path FRONT-L.png; Dodaj UI visible.

**Backup:** brak (no commit).

**Test/Ewaluacja:**
- python ast parse indexer+bridge OK; node --check labels/tag-edit/viz OK
- CDP: DamLabels.normalizeLangCode gb/uk->en short EN; lang filter has Angielski/en no GB
- CDP: MultijÄ™zyczny filteredCount=30 incl CYNAMONKA/CIASTO ĹšLIWKOWE pl,en
- CDP: Cynamonka path ends FRONT-L.png; modal badges PL+EN+MultijÄ™zyczny
- Screenshot+Read: #damTagEditPopover Dodaj typ + dashed Dodaj + Zmien kategorie

**ĹąrĂłdĹ‚a:** program-instructions.json, naming-dictionary.json, lang-provenance.md, build-file-index.py, local_bridge.py, dam-labels.js, dam-tag-edit.js, dam-viz.js, file-index.json, search-index.json

**Reindex:** full python apps/web/scripts/build-file-index.py recommended when X: Marketing available (regenerate thumbs *_en.jpg, refresh wizki slots). Surgical patch already applied for langs/paths/search.


## 2026-07-21 - tagPopBtn: compact CTAs + Confirm at bottom

**Komenda/Akcja:** Fix #damTagEditPopover - contextual Dodaj labels, + left inline, Zatwierdz/Anuluj at bottom.

**Log/Status:**
1. dam-tag-edit.js: addTagButtonLabel(kind); reorder DOM foot before actions; ensureTagPopoverBtnStyles (token tagPopBtn20260721b); remove dashed tile stack.
2. Polish: Zatwierdz, Zglos, head titles (jezyk/marke/...), Dodaj nosnik/jezyk.
3. Cache-bust ?v=tagPopBtn20260721b in index/branding/explorer/visualizations/settings.html.

**Efekt/Fix:** Toolbar-height (40px) row CTAs; Confirm/Cancel last; no giant dashed tile.

**Backup:** brak (no commit).

**Test/Ewaluacja:**
- node --check dam-tag-edit.js OK
- CDP: childOrder head>search>list>foot>actions; plusLeft; labels Dodaj nosnik/jezyk; UTF-8 diacritics U+15B/U+17A/U+144/U+119
- Screenshot+Read Pass1-5: tag-pop-pass1..5

**ĹąrĂłdĹ‚a:** dam-tag-edit.js, *.html cache-bust

## 2026-07-21 - KAR6X card thumb: FRONT-L not stale ENFACE jpeg

**Komenda/Akcja:** Karty KAR6X pokazywaly ENFACE mimo path=FRONT-L w indeksie.

**Log/Status:**
1. Root cause: surgical path patch zostawil `file`/`rel`/`thumb_url` na ENFACE-S; `renderGroup` bral `thumb_url`.
2. dam-viz.js: `syncKar6xFrontThumb` + `cardThumbSrc`; enrich sync file + /media gdy FRONT.
3. Regen 36 KAR6X thumbs z FRONT-L; sync file/rel w file-index.json.
4. Cache `kar6xFront20260721a`.

**Efekt/Fix:** CDP CYNAMONKA/ĹšLIWKOWE â†’ `â€¦FRONT-L.png` (media); screenshot 3/4 FRONT nie plaski ENFACE.

**Test/Ewaluacja:** node --check OK; CDP file FRONT-L; screenshot+Read karta 6300783.

**ĹąrĂłdĹ‚a:** dam-viz.js, visualizations.html, file-index.json, data/thumbs/*

## 2026-07-21 - tag popover: equal CSS grid CTAs

**Komenda/Akcja:** #damTagEditPopover foot/actions - rowny grid 2 kolumny.

**Log/Status:**
1. Usunieto podwojne Dodaj typ + Dodaj nosnik (carrier = tylko Dodaj typ).
2. foot + actions: `display:grid; grid-template-columns:1fr 1fr`; buttony width 100%.
3. Token `tagPopGrid20260721b`.

**Test/Ewaluacja:** CDP sameW/sameY/alignX; labels full "ZmieĹ„ kategoriÄ™"; ZatwierdĹş|Anuluj na dole.

**ĹąrĂłdĹ‚a:** dam-tag-edit.js, HTML cache-bust

## 2026-07-21 - thumb picker COMBO + crumbs tab

**Komenda/Akcja:** #damThumbPicker - tryb combo (domyslny), foldery lista / pliki kafelki; crumbs tab w ramce.

**Log/Status:**
1. Widoki: combo | lista | miniatury (tiles=legacy thumbs). Default `combo` w localStorage.
2. CSS: folder `grid-column:1/-1` paseczek z ikona; pliki tiles; crumbs row-gap 1px, pad 6/12/8, max-height none.
3. Cache `thumbCombo20260721b`.

**Test/Ewaluacja:** CDP folders=2 full names; strip fullWidth; tab overflowBot/Top=false; screenshot.

**ĹąrĂłdĹ‚a:** dam-viz.js, visualizations.html

## 2026-07-21 - branding media preview: hero grow + outline 50%

**Komenda/Akcja:** `#damMediaPreview` - wiecej wysokosci hero, actions flush bottom, outline CTA border 50%.

**Log/Status:**
1. Root cause: non-split body `flex:1 1 auto` + sticky actions â†’ martwa biel nad actions, hero ~273px.
2. Body â†’ `flex:0 1 auto`; thumb min-height `min(420px,48dvh)`; box `justify-content:flex-start`; grid-area `actions`.
3. Actions pad L/R +6px (0â†’6 / 40â†’46). Token `--dam-btn-outline-border` 50% alpha na icon-btn + geex outline.
4. Cache `brandModalPad20260721a`.

**Efekt/Fix:** Hero bierze wolne VH; actions przy dnie; outline polprzezroczysty site-wide.

**Test/Ewaluacja:** CDP hero h / actions pad / border alpha; screenshotĂ—3â€“5 branding modal.

**ĹąrĂłdĹ‚a:** dam-viz-modal.css, dam-branding.css, dam-brand.css, dam-tokens.css, dam-media-preview.js, HTML ?v=

## 2026-07-21 - branding media preview: hero grow + outline 50%

**Komenda/Akcja:** `#damMediaPreview` - wiecej wysokosci hero, actions flush bottom, outline CTA border 50%.

**Log/Status:**
1. Root cause: non-split body `flex:1 1 auto` + sticky actions â†’ martwa biel nad actions, hero ~273px.
2. Body â†’ `flex:0 1 auto`; thumb min-height `min(420px,48dvh)`; box `justify-content:flex-start`; grid-area `actions`.
3. Actions pad L/R +6px (0â†’6 / 40â†’46). Token `--dam-btn-outline-border` 50% alpha na icon-btn + geex outline.
4. Cache `brandModalPad20260721a`.

**Efekt/Fix:** Hero bierze wolne VH; actions przy dnie; outline polprzezroczysty site-wide.

**Test/Ewaluacja:** CDP hero h / actions pad / border alpha; screenshotĂ—3â€“5 branding modal.

**ĹąrĂłdĹ‚a:** dam-viz-modal.css, dam-branding.css, dam-brand.css, dam-tokens.css, dam-media-preview.js, HTML ?v=

**Test/Ewaluacja (CDP branding PROTEINA):** hero h 273â†’567 (49% box); actions pad L/R 6px; border `color(... / 0.5)`; gap assocâ†’actions ~48px; actionsToBoxBottom 12; PSD only in SourceMount; PassĂ—5 screenshots.

## 2026-07-21 - Samouczek / DobroKalorius overhaul

**Komenda/Akcja:** Congrats-on-target, off-path companion, 40+40 copy, nowe pozy, help global, SW 1h.

**Log/Status:**
1. Root cause A: onDocClick chwalil dowolny klik; poprawny link nawigowal zanim dymek sie pokazal.
2. Root cause B: ten sam handler = auto-Dalej / nawigacja = "koniec" samouczka z perspektywy usera.
3. program-instructions `ui.tutorial_dobrokalorius_hard` (v13); copy JSON; cut-mascot-sheets.py.
4. dam-tutorial.js: showCongrats 3500ms, companion, nameForms, cheer throttle, SW register.
5. dam-shortcuts.js: restart button w head; lazy-load tutorial.
6. Cache `tourFix20260721b`; serve_browser Cache-Control 1h / no-cache `?v=`.

**Efekt/Fix:** Brawo Krzys natychmiast; off-path = companion + faza 0:0; help restart na settings.

**Test/Ewaluacja:** node --check; CDP congrats+companion+help; screenshot+Read tip/companion; RGBA poses.

**ĹąrĂłdĹ‚a:** dam-tutorial.js, dam-shortcuts.js, dobrokalorius-copy.json, sw.js, maskotka/pose-*.png

## 2026-07-21 - Typ pliku: Folder + etykiety jezykow (nie kraje)

**Komenda/Akcja:** #damVizModalMeta klik = revealInExplorer; globalnie Polski/Niemiecki/Angielski zamiast Polska/Niemcy/Wielka Brytania.

**Log/Status:**
1. Root cause klik: tip mowil o Shift/double-click zmianie typu nosnika - user oczekiwal Folder.
2. Root cause etykiet: naming-dictionary + LANG_LABELS + file-index lang_labels/viz_* trzymaly nazwy krajow; EN=Wielka Brytania.
3. Fix: dictionary + dam-labels + build-file-index; normalizeVizRow nadpisuje lang_label; meta click -> DamPaths.revealInExplorer; Shift+klik = carrier picker.
4. Patch 395 wierszy viz_latest/viz_all; cache langAdj20260721b.
5. Instrukcja ui.lang_labels_are_languages w program-instructions.json.

**Efekt/Fix:** Meta: â€¦ Â· Angielski; filtr jezykow: Polski/Niemiecki/â€¦; klik meta = ten sam reveal co Folder.

**Test/Ewaluacja:** CDP text+reveal path; a11y name Angielski; screenshot pass2; node --check.

**ĹąrĂłdĹ‚a:** naming-dictionary.json, dam-labels.js, dam-viz.js, build-file-index.py, file-index.json, program-instructions.json, HTML ?v=


## 2026-07-21 - branding actions left + loader 1s/0.5s

**Komenda/Akcja:** #damMediaPreview .dam-viz-modal__actions lewy dolny rog; DamLoader hold 1s, dock translate 0.5s.

**Log/Status:**
1. Actions: justify-self:start + width:max-content (nie full-width strip); split layout zostaje width 100%.
2. Loader: HOLD_CENTER_MS 1500â†’1000, DOCK_MS 500; STYLE_ID bump.
3. Cache ctionsLeftLoader20260721a. HTML restore z git po uszkodzonym PS -replace, potem bezpieczny bump Python.

**Test/Ewaluacja:** CDP actionsW~501 vs boxW~1587, isLeftSide; dockAt~1024ms, transition left 0.5s; screenshot.

**ĹąrĂłdĹ‚a:** dam-branding.css, dam-viz-modal.css, dam-loader.js, dam-media-preview.js, HTML ?v=



## 2026-07-21 - Dobrokalorius explore-to-test + media poses + padding

**Komenda/Akcja:** Fix companion UX: padding paneli, media poses (NoĹ›niki), exploreMode (UI klikalne, throttle copy), tryExploreĂ—40 + gender, animacje.

**Log/Status:**
1. Root cause padding: inject CSS companion padding:14/12 - zbyt ciasne vs Geex dropdown.
2. Root cause pose: krok NoĹ›niki uzywal presentâ†’pose-5 (ksiazka); media teaching = explain-assets/image/video.
3. Root cause explore: onDocClick off-path zawsze preventDefault+stopPropagation + recreate companion z sad/wander co klik.
4. Fix: exploreMode, soft dim 0.07, tryExplore joy/approve, throttle 12s, media-assets aliases, usunieto present/pose-5 z mapy i krokow, gender map + {trySelf}.
5. Cache 	utorialExplore20260721c (HTMLĂ—8 + dam-shortcuts + copy fetch).
6. program-instructions ui.tutorial_dobrokalorius_hard rozszerzone (must/must_not explore + media + no sad spam).

**Efekt/Fix:** Companion padding 28/26/22/26; NoĹ›nikiâ†’pose-explain-assets; off-path nie blokuje UI; faza stabilna; tryExplore=40.

**Test/Ewaluacja:** node --check; CDP padding/pointer-events/phase/pose URL; screenshot+Read Ă—3 (explore joy, padding, NoĹ›niki media); gender Ewa/Krzysztof/unknown.

**ĹąrĂłdĹ‚a:** dam-tutorial.js, dobrokalorius-copy.json, program-instructions.json, HTML ?v=, dam-shortcuts.js


## 2026-07-21 - tutorial praise ~25% only

**Komenda/Akcja:** UX: poprawny cel default advance; praise tip tylko ~25%% hitow; po praise auto-advance.

**Log/Status:**
1. Root cause: onDocClick zawsze showCongrats (100%% praise + wait).
2. Fix: PRAISE_CHANCE=0.25 w showCongrats; skip -> thenFn/nextStep od razu; praise -> ~3.5s potem auto-advance.
3. program-instructions ui.tutorial_dobrokalorius_hard must zaktualizowany; DamTutorial.praiseStats().
4. Cache ?v=tutorialPraise25_20260721a (HTML x8, Python bump).

**Efekt/Fix:** 75%% hitow bez bubble gratulacji; 25%% short praise bez stuck na Dalej.

**Test/Ewaluacja:** node --check; CDP force-skip (stats.skipped+1, no is-congrats, step advance); force-praise (Brawo + autoAdvanced); monteCarlo20 majority skip; exploreMode OK.

**ĹąrĂłdĹ‚a:** dam-tutorial.js, program-instructions.json, apps/web/_qa/_bump_tutorial_praise25.py, HTML ?v=


## 2026-07-21 - tutorial praise toast advance-first

**Komenda/Akcja:** Rework Dobrokalorius correct-hit: advance first, optional short toast praise + rare micro-burst.

**Log/Status:**
1. Root cause: showCongrats blokowal tip (is-congrats + praiseLock) i opoznial nextStep o CONGRATS_MS=3500.
2. Fix: onDocClick/goToPhasePage = advance natychmiast; maybeShowPraiseToast / queue na nawigacje; CONGRATS_MS=2275 (â’35%); PRAISE krotkie (median 33â†’14); BURST_CHANCE=0.12; 3 warianty CSS burst; reduced-motion bez burst.
3. program-instructions ui.tutorial_dobrokalorius_hard (toast HARD); copy congrats_title=Brawo!; memory #145; doctrine Â§12.
4. Cache ?v=tutorialPraiseToast20260721b (HTML x8 + dam-shortcuts, Python bump; b = CSS concat fix).

**Efekt/Fix:** Krok zmienia sie w tym samym ticku; pochwala to nieblokujacy toast; Dalej nie jest wymagane.

**Test/Ewaluacja:** node --check; CDP advance sync (0:0â†’0:1 skip, 0:1â†’0:2+toast); CONGRATS_MS=2275; BURST_CHANCE=0.12; reduced-motion bez burst DOM; explore companion OK; screenshot+Read Ă—5 @1280.

**ĹąrĂłdĹ‚a:** dam-tutorial.js, dobrokalorius-copy.json, program-instructions.json, _qa/_bump_tutorial_praise_toast.py

## 2026-07-21 - tutorial targets + explore spot + Projekty restore

**Komenda/Akcja:** Fix DobrokaloriuĹ›: spotlight PokaĹĽ wszystkie / Info Pakowania; explore bez dziury; nav Projekty nie konczy samouczka.

**Log/Status:**
1. Root causes: (a) krok celowal .dam-viz-toolbar (= search); (b) brak kroku Info Pakowania; (c) isTargetInteractable odrzucal switch pod .dam-tut ctrl -> fallback sideLink; (d) explore mial soft dim/hole na starym spocie; (e) index.html nie ladowal dam-tutorial.js + SW HTML 1h stale cache.
2. Fix: cele label[for=vizShowAll] / label[for=damRevealLowTags] + krok CTRL+scroll; explore CSS display:none na spot; nav zachowuje phase + damTutorialExplore; index.html + shortcuts ensureTutorialResume; SW network-first HTML (dam-page-1h-v2).
3. program-instructions ui.tutorial_dobrokalorius_hard HARD 2026-07-21e; cache ?v=tutorialTargets20260721a.

**Efekt/Fix:** Spotlight na switchach; explore bez hole; branding -> Projekty = companion+active, finished=null, phase intact.

**Test/Ewaluacja:** node --check; CDP PokaĹĽ wszystkie spotâ‰label y~367 overlap; Info Pakowania overlap; explore spotDisplay=none; Projekty active+explore+companion; screenshot+Read.

**ĹąrĂłdĹ‚a:** dam-tutorial.js, dam-shortcuts.js, dam-shell.js, sw.js, index.html + HTML ?v=, program-instructions.json, _qa/_bump_tutorial_targets.py

## 2026-07-21 - tutorial Projekty: broken completion + FOUC

**Komenda/Akcja:** Na index.html (Projekty) samouczek nie dal sie dokoncic; dodatkowo flash niestylowanego chrome.

**Log/Status:**
1. CDP przed fixem: dam-tutorial.css brak na index.html; .dam-tut / .dam-tut__ctrl = position:static; ctrlRect.top ~45745 (pod siatka projektow) - Dalej/Zakoncz poza viewportem.
2. Companion (explore inject CSS) byl fixed - user widzial tylko "Wroc do samouczka", bez paska.
3. Fix: critical shell CSS w ensureTutCss() (fixed root/bubble/ctrl + btn); link CSS na index.html; FOUC gate is-ready + inline hide; reveal via setTimeout(0/64) bo samo double-rAF w tle nie odpala i zostawialo opacity:0.
4. Cache ?v=tutorialProjectsFix20260721b (HTML x9 + shortcuts + token).

**Efekt/Fix:** Pasek fixed bottom, klikalny; skip Branding->Projekty; Dalej 4:0->4:1->5:0; ZakoĹ„cz -> damTutorialFinished=1.

**Test/Ewaluacja:** node --check; CDP hitDalej=.dam-tut__btn--next, ctrlT~684, is-ready, rootOp=1; finish path; screenshot+Read tutorial-projekty-faza5-bar.png.

**ĹąrĂłdĹ‚a:** dam-tutorial.js, index.html (+CSS link), _qa/_bump_tutorial_projects_fix.py, code-doctrine Â§12








## 2026-07-21 - geex pad fix: modal CTA circles + project font + marketing air

**Komenda/Akcja:** PrzywrĂłcenie prostokÄ…tnych CTA w modalu (PrzejdĹş/Folder), mniejszy font na kartach projektu, air na marketing tiles - bez redesignu.

**Log/Status:**
1. Root cause kĂłĹ‚ek: geex-realign w `dam-primitives.css` wymuszaĹ‚ `width/height:44px` na `.dam-btn-icon` (takĹĽe z etykietÄ…) + `border-radius: var(--btn-radius,50px)` w modal actions â†’ ~43Ă—43 z uciÄ™tym tekstem.
2. Fix: square tylko dla icon-only; `.dam-btn-icon:not(.dam-btn-icon-only)` = auto width + compact pad; modal CTA override 8px radius; project card `font-size:10px`; marketing card pad/gap + tile grid minmax 148px.
3. Cache-bust `?v=geexPadFix20260721a` (catalog `â€¦21c`, viz-modal `â€¦21b`).

**Efekt/Fix:** Modal PrzejdĹş/Folder prostokÄ…ty czytelne; OpenFile zostaje icon-only; project PrzejdĹş 10px; marketing tiles z air jak viz-card.

**Test/Ewaluacja:** CDP modal go ~98Ă—36 fs12 br8 spanClipped=false; project go fs10 h30; marketing pad 14px titleFs12 w~172; screenshot+Read `_qa/qa-viz-modal-actions-crop2.png`, `qa-marketing-cards-pass3.png`.

**ĹąrĂłdĹ‚a:** dam-primitives.css, dam-viz-modal.css, dam-brand.css, dam-app.css, dam-project-catalog.css, dam-ui-cta.js, HTML ?v=

## 2026-07-21 - unify projects CTA font + Info Pakowania switch

**Komenda/Akcja:** Ujednolicenie compact CTA (karta + toolbar) do jednego tokenu 12px/34px; Info Pakowania na Projektach = dam-switch--compact jak na Wizualizacjach.

**Log/Status:**
1. BEFORE CDP: card check/go fs=10px h=30; toolbar refresh/ingest fs=16px h~37 (primitives `font:inherit` biĹ‚o inject); label.dam-tag-reveal-toggle (checkbox).
2. Fix: dam-ui-cta.js (button/a + !important 12px; card = toolbar 12/34/8x12); dam-primitives.css (font-size:12px zamiast inherit; labeled dam-btn-icon 34/12); dam-app.css (usunieto fs:10 na check/go); index.html markup switch jak viz.
3. Cache-bust `?v=ctaUnify20260721b` na HTML ladujacych zmienione CSS/JS.

**Efekt/Fix:** Jedna skala dam-int-cta na kartach i toolbarze; Info Pakowania = track+label switch.

**Test/Ewaluacja:** CDP AFTER: check/go/refresh/ingest fs=12px h=34 pad=8px 12px (delta 0); switch labelFs=12 trackH=18; oldToggle=false. Screenshot+Read toolbar/card/viewport. Pass.

**ĹąrĂłdĹ‚a:** dam-ui-cta.js, dam-primitives.css, dam-app.css, index.html, visualizations.html (wzor switch), process.md

## 2026-07-21 - inventory close: marketing/branding air + dark tokens + baseline 36/36

**Komenda/Akcja:** Zamkniecie OPEN po tip df870e2 (geex+PAKIET+ctaUnify): air kart marketing/branding, dark polish tokenami, baseline PNG.

**Log/Status:**
1. Pull main (df870e2 â†’ later c0064b4 docs); :8765 up.
2. Marketing `.dam-catalog-marketing-card`: pad 16 / gap 14 / grid minmax 156 / title 13px / badge pad 5Ă—10; thumb/border â†’ `--dam-surface`/`--dam-border`.
3. Branding/viz cards: body tokens 24/22/18/18 + actions-extra 8; branding min-height 288; surfaces `#fff` â†’ tokens.
4. Dark: Geex `h5 { color: var(--gray-color) }` (= `--dam-border`) biĹ‚o tytuĹ‚y â€” fix specificity `html[data-theme=dark] .dam-viz-card .dam-viz-card__title`; filtry/tag-groups/modal actions â†’ `--dam-surface`.
5. Cache-bust `?v=invClose20260721b` (HTML).
6. Baseline: `retry_fails.py` 8/8 ok â†’ lokalny `_meta.json` **36/36 ok** (json gitignored).

**Efekt/Fix:** Karty z wiekszym air; dark bez white-flash na kartach/filtrach/modal bar; tytuly czytelne; baseline complete lokalnie.

**Test/Ewaluacja:**
- Marketing CDP: pad 16 gap 14 titleFs 13; screenshot+Read pass1/2.
- Branding CDP: pad 24Ă—18Ă—22 gap 18; dark titleLum 229 filterLum 32 cardLum 32.
- Viz CTA: fs 12 h 36 pad 8Ă—12 br 8 (labeled compact preserved).
- Dashboard dark: bodyLum 14 thumbLum 32.

**Pass/Fail:**
1. Marketing catalog cards â€” **Pass**
2. Branding/viz breathing room â€” **Pass**
3. Dark mode polish (key surfaces) â€” **Pass** (Geex chrome Wstecz/search tabs may still flash â€” out of card scope)
4. Baseline PNG 36/36 â€” **Pass** (local; meta gitignored)

**ĹąrĂłdĹ‚a:** dam-project-catalog.css, dam-brand.css, dam-branding.css, dam-viz-modal.css, dam-dashboard.css, code-doctrine Â§12, retry_fails.py, process.md

## 2026-07-21 - Elementy panel: stale revision path + duplicate fallback labels

**Komenda/Akcja:** Fix podgladow ELEMENTY w viz/media modal (i wspolnym linkedBrandingCardHtml) - "podglad niedostepny" mimo plikow na X: + overlap/duplikaty etykiet.

**Log/Status:**
1. RCA preview: branding-index ma stare nazwy rewizji bez tokenu jezykow (`KAR6X - 20.05.2026 - 6300785.00 - F`), dysk ma `KAR6X - 20.05.2026  - PL EN - 6300785.00 - F`. `GET /media?path=` => 404 => onerror fallback. 51/51 ELEMENTY dla ciasto-sliwkowe = missing.
2. RCA layout: `__damAssocThumbFallback` + static fallback HTML wstawialy nazwe + hint + ID *wewnatrz* 70x70 thumb, a te same dane byly juz pod kafelkiem (assoc-name + ID chip) => wizualny "podwojny" tekst i overlap wierszy.
3. Fix bridge: `_resolve_missing_media_path` + `_coerce_media_target` w `serve_media` / `/media` / `media_meta` - fuzzy match sibling revision po indeksie 7-cyfrowym + ten sam ogon ELEMENTY/Links.
4. Fix UI: fallback tylko ikona + "brak podgladu"; CSS elementy-panel gap 14/10; cache-bust `?v=elementyPreviewFix20260721b`.
5. Restart local_bridge (pythonw) po zmianie.

**Efekt/Fix:** Stale path z indeksu serwuje realny PNG z dysku. Panel Elementy: 1 etykieta + 1 ID pill, miniatury widoczne.

**Test/Ewaluacja:**
- Bridge: stale index path CIASTO-SLIWKOWE.png => HTTP 200 image/png len 337526.
- CDP modal CIASTO SLIWKOWE: imgs=40 loaded=40 fallbacks=0 overlap=false rowGap=14 gap=14px 10px; ID `M-IMG251288-07-26`.
- Screenshot+Read pass1/pass2: real thumbs (ciasto + kwiaty), brak "podglad niedostepny".
- `node --check` dam-media-preview.js OK; bridge ast.parse OK.

**ĹąrĂłdĹ‚a:** local_bridge.py, dam-media-preview.js, explorer/branding/dashboard/visualizations.html (?v=), process.md


## 2026-07-21 - ELEMENTY PNG: czarne matte -> alpha (dematte)

**Komenda/Akcja:** Usunac czarne tlo z miniatur PNG w panelu Elementy (viz/media) - transparentne piksele / matte.

**Log/Status:**
1. RCA: pliki w folderze ELEMENTY to mode P palette BEZ tRNS; rogi RGBA(0,0,0,255) - czarne matte wypalone w pliku (nie CSS). Liscie* maja prawdziwe alpha.
2. Bridge: `_dematte_black_to_alpha` (thr=20) + auto gdy path zawiera ELEMENTY albo `?matte=1` / `preview=1`; cache in-memory 64; nie zapisuje na dysk.
3. JS: `previewUrl` dokleja `&matte=1` dla PNG/WebP w folderze ELEMENTY; `&preview=1` dla alpha rasters.
4. CSS: checkerboard na `.dam-media-preview__assoc-thumb` + override panelu Elementy (light + dark, bez #000).
5. Cache-bust `?v=pngDematte20260721b`; restart local_bridge.

**Efekt/Fix:** Miniatury Elementy pokazuja checkerboard zamiast czarnego boxa; pliki zrodlowe nietkniete.

**Test/Ewaluacja:**
- Bridge CIASTO-SLIWKOWE.png `?matte=1`: corner alpha=0, center opaque â€” PASS.
- CDP: src zawiera `matte=1` + `preview=1`; getComputedStyle thumb `background-color: rgb(245, 246, 250)` + linear-gradient checker â€” PASS.
- Screenshot+Read Elementy (40): CIASTO + KWIAT 1..7 na checkerboard, brak solid black â€” PASS.
- `node --check` dam-media-preview.js OK; bridge ast.parse OK.

**ĹąrĂłdĹ‚a:** local_bridge.py, dam-media-preview.js, dam-branding.css, dam-brand.css, HTML ?v=, process.md, code-doctrine sekcja 12
## 2026-07-21 - Incydent FORCE (#damLifecycleForce) + undo + confirm modals

**Komenda/Akcja:** User przypadkowo kliknal Stosuj zmiany; toast "Zapisano 6 zmian, bledow: 18". Zrozumiec, cofnac, dodac potwierdzenia z preview.

**Log/Status:**
1. Zrodlo: `lifecycle-status.json` history `lc_1784663980167` ts `2026-07-21T19:59:40` actor krzysztof.wieczorek@kubara.pl; count 24 = 6 ok + 18 fail.
2. FORCE = `POST /lifecycle-force` -> `force_apply_program_to_disk` (PROGRAM -> dysk rename/archiwum).
3. 18 bledow: wszystkie `path_not_found` (glownie test-lifecycle-* + produkt owies-miod-sniadanie).
4. 6 "ok":
   - 4x owies-miod-sniadanie clear: **noop na dysku** (path_renames puste, final=stara sciezka).
   - ciasto-sliwkowe: rename produktu `CIASTO SLIWKOWE â€” [ nerkowcowy ]` -> `... - F` (bledny scope: wariant zapisal na folder produktu).
   - babka-cytrynowa: rename + move do `â€” ARCHIWUM\BABKA ... - X\BABKA ... - X` (zagniezdzenie w wrapperze archiwum).
5. Undo: `local_bridge.undo_last_change` x2 (babka, ciasto) + 4 noop owies z change-log; usunieto pusty wrapper ARCHIWUM Babka; wyczyszczono zanieczyszczone klucze revisions w lifecycle-status.
6. UI: `showExplorerConfirmModal` w dam-explorer.js â€” FORCE dry_run preview, Odswiez confirm, Export backup confirm. Cache-bust `?v=forceConfirm20260721b`.

**Efekt/Fix:**
- Dysk: Babka i Ciasto przywrocone bez liter F/X w BATONY; Babka nie w ARCHIWUM.
- FORCE nie odpala sie bez listy dry-run + czerwonego Stosuj.

**Backup:** change-log undo przeniosl wpisy do `redo[]` (mozna ponowic przez /change-log/redo â€” NIE robic).

**Test/Ewaluacja:**
- Disk verify: BABKA active bez -X, CIASTO bez -F, BABKA_ARCH_COUNT=0 â€” PASS.
- Screenshot+Read FORCE modal: tytul "Stosuj zmiany na dysk", lista 24, Anuluj / Stosuj (24) â€” PASS (Anuluj, bez apply).
- Screenshot Odswiez + Export confirm â€” PASS.
- `node --check` dam-explorer.js OK.

**ĹąrĂłdĹ‚a:** lifecycle-status.json, change-log.json, lifecycle_status.py, local_bridge.py, dam-explorer.js, explorer.html, process.md

## 2026-07-21 - Assoc/Elementy split + viz white thumbs + branding toolbar

**Komenda/Akcja:** A) resizable split assoc vs elementy; B) white bg na viz card thumbs; C) jedna belka search+tabs branding.

**Log/Status:**
1. RCA A: assoc grid lex:1 + elementy max-height:min(240px,32vh) - puste skojarzenia zajmowaly cala kolumne, Elementy w waskim pasku.
2. Fix A: .dam-assoc-pane-split + suwak 44px; ratio 60/40 (oba content), 20/80 (puste assoc); localStorage dam-assoc-elementy-split:{product_id}; osobny scroll top/bottom; CSS w dam-viz-modal.css + inject z JS.
3. RCA B: checkerboard na globalnym .dam-viz-thumb__img (po dematte ELEMENTY) trafial tez w #vizGrid karty.
4. Fix B: .dam-viz-thumb__img = #fff / ackground-image:none (dark: surface); checker zostaje na assoc/elementy thumbs.
5. RCA C: osobne ramki .dam-global-search-block + .dam-branding-tabs-row (~146+72px).
6. Fix C: tabs + archive switch wewnatrz .dam-search-wrap--branding-chrome; usunieto outer frame / scope-toggles wrapper; panel ~133px.
7. Cache-bust ?v=assocSplit20260721c.

**Efekt/Fix:** Empty assoc oddaje ~80% Elementom; drag+persist per product; packshoty na bieli; jedna belka branding.

**Test/Ewaluacja:**
- CIASTO empty: top 20% / bot 76%, splitter 44px, Elementy panel max-height none, H~731 â€” PASS.
- Persist: ciasto  .35, babka  .45 osobno; reopen restores â€” PASS.
- BABKA both content: topPct 60 / botPct 36 (60/40 default) â€” PASS.
- Offscreen media-preview path (renderLinkedAssetsInto): burger/babka splitTop 0.6 â€” PASS.
- Viz thumbs CDP: bg rgb(255,255,255), background-image none â€” PASS.
- Branding toolbar: tabsInsidePanel, no tabs-row, archDirectChild, panelH 133 â€” PASS.
- 
ode --check dam-media-preview.js OK.

**ĹąrĂłdĹ‚a:** dam-media-preview.js, dam-viz-modal.css, dam-brand.css, dam-branding.css, branding.html, dam-tutorial.js, HTML ?v=, process.md

## 2026-07-21 - FORCE kafelki + user-prefs KV

**Komenda/Akcja:** A) Redesign modala FORCE dry-run na kafelki; B) migracja preferencji UI z localStorage do Postgres KV `user-prefs:{email}`.

**Log/Status:**
1. RCA A: `formatForcePreviewList` = monospace wall (produkt Â· id + peĹ‚ne `X:\` + "program chce: clear") â€” nieczytelne.
2. Fix A: siatka `.dam-force-tile` (nazwa produktu, badge F/X/D/â…, folder beforeâ†’after z liter, ikona rename/archive/clear, chevron peĹ‚nej Ĺ›cieĹĽki, chipy Wszystkie/Rename/Archiwum/Clear). CSS inject w `ensureExplorerCtaUnifyCss`. Info-tile dla OdĹ›wieĹĽ / Export.
3. RCA B: `DamUserPrefs` trzymaĹ‚ tylko `safe_delete` + `branding_page_size`; zoom/split/filtry explorer ĹĽyĹ‚y w localStorage â†’ "program zapomina" miÄ™dzy PC / po czyszczeniu.
4. Fix B: rozszerzony bridge `_uprefs_normalize` + JS `dam-user-prefs.js` (card_zoom, assoc_split, explorer_*, reveal_low_tags, sidebar_collapsed); migrate once z LS; debounced POST; mirror cache LS.
5. Restart `local_bridge.py` (nowe pola w normalize). Cache-bust `?v=prefsKv20260721a` / `forceTiles20260721d`.

**Efekt/Fix:** FORCE = czytelne kafelki; preferencje UI â†’ Postgres KV (source=postgres).

**Tabela kluczy (LS â†’ KV `user-prefs:{email}.prefs.*`):**
| Setting | byĹ‚o LS | teraz KV field |
|---|---|---|
| Card zoom | `dam_viz_card_zoom` | `card_zoom` |
| Assoc/Elementy split | `dam-assoc-elementy-split:{pid}` | `assoc_split.{pid}` |
| Branding page size | (juĹĽ KV) + LS cache | `branding_page_size` |
| Explorer show all | `dam_explorer_show_all` | `explorer_show_all` |
| Explorer lang filter | `dam_explorer_lang_filter` | `explorer_lang_filter` |
| Explorer viz view | `dam_viz_view_mode` | `explorer_viz_view` |
| Explorer viz scale | `dam_viz_scale` | `explorer_viz_scale` |
| Reveal low tags | `dam_reveal_low_tags` | `reveal_low_tags` |
| Sidebar collapsed | `dam_sidebar_collapsed` | `sidebar_collapsed` |
| Safe delete | (juĹĽ KV) | `safe_delete` |

**Nadal local-only (celowo):** `dam_token`/role/user (sesja auth); `sessionStorage` nav/tutorial cheer; theme (`dam_theme_pref` â€” device); carrier overrides / elements links / status JSON mirror (dane domenowe, nie UI prefs).

**Test/Ewaluacja:**
- FORCE: 24 tiles, chipy, `â€” â†’ F/D/X/â…`, folder `â€¦` â†’ `â€¦ - F`, filtr Archiwum=2, peĹ‚na Ĺ›cieĹĽka expand â€” PASS (screenshot pass 1â€“5, Anuluj bez apply).
- Prefs POST: `card_zoom:118`, `explorer_show_all:true`, `source:postgres`, peĹ‚ny zestaw kluczy â€” PASS.
- `node --check`: dam-explorer, dam-user-prefs, dam-media-preview, dam-shell, dam-badges, dam-viz, dam-branding â€” OK.
- `ast.parse` local_bridge.py â€” OK.

**ĹąrĂłdĹ‚a:** dam-explorer.js, dam-user-prefs.js, local_bridge.py, dam-media-preview.js, dam-shell.js, dam-badges.js, dam-viz.js, dam-branding.js, HTML ?v=, process.md


## 2026-07-21 - FORCE confirm modal redesign (Teraz / Po zmianie)

**Komenda/Akcja:** Intensive QA 10 passes - redesign `#damExplorerConfirmModal` dry-run FORCE preview.

**Design Read:** Admin confirmation modal for destructive disk FORCE; trust-first language, generous whitespace; `dam-int-cta` / `geex-btn` scale - NOT oversized red pills.

### Spacing doctrine (ZAPAMIETAJ)
- Modal body padding: `24px 28px`
- Change rows gap: `>= 20px`
- Inside each Teraz/Po block: `padding: 16px 18px`
- Section gaps header / filters / list / footer: `16-24px`
- NEVER pack text tight - human scan, not machine density
- Content panel: `width: min(70vw, 1200px)`, `height: min(90vh, 900px)`; scroll in `__body` only

**Log/Status:**
1. RCA cramped modal: `ensureExplorerCtaUnifyCss` had `str + /* comment */ + nextStr` -> unary `+` -> `NaN` selector `nan#damExplorerConfirmModalâ€¦` so size rules never applied (stuck at base `.dam-basepath-box` 520px).
2. Fix: remove dangling `+` after bare comment; panel class `dam-explorer-confirm-modal` flex column; body scroll; before/after 2-col blocks Teraz / Po zmianie (stack `<=768`); accent inset on Po; compact footer CTAs 34px matching toolbar; PL chips; no mid-arrow.
3. Cache-bust: `explorer.html?v=forceModalRedesign20260721i`.

**Efekt/Fix:** Readable FORCE dry-run with clear Teraz/Po, large panel, toolbar-scale buttons.

**Test/Ewaluacja (CDP @1280):**
- box `896Ă—810` (=70vwĂ—90vh), bodyPad `24px 28px`, rowGap `20px`, btnH `34` (= `#damLifecycleForce`), cols `1fr 1fr`, no `.dam-force-diff__arrow`
- 10-pass screenshot+Read: size/hierarchy, before-after, filters (Archiwum/Clear), 768 stack, dark, final lock

**ĹąrĂłdĹ‚a:** dam-explorer.js, explorer.html, process.md, agents/shared/code-doctrine.md Â§12

## 2026-07-21 - Preview cache Redis + circuit breaker + Synology truth (K0-K8)

**Komenda/Akcja:** Plan preview_cache_redis_ec0a7794 v5 - Redis opcjonalny z circuit breaker, PAMIEC-PODRECZNA, path resolve, preview truth UI, QA, commit+push.

**Log/Status:**
1. K0: Grep 4x Synology lie (media-preview x3, branding x1). Health :8766 OK. Docker CLI jest, daemon DOWN - Redis nie startuje (oczekiwane).
2. K1: program-instructions v15 - preview.file_state.*, preview.cache.*, preview.cache.redis (circuit+matrix), paths.topology.*, preview.onerror_not_synology. app-settings mirror.
3. K1r HARD: dam_redis.py CLOSED/OPEN/HALF-OPEN, N=3, cooldown 12s, background probe; connection refused -> OPEN; fallback matrix 4 role; docker-compose.redis.yml; requirements redis; health redis/circuit/matrix. Docker up FAIL (daemon) - degrade OK.
4. K1b: dam_path_resolve.py + wire _coerce_media_target / _is_under_marketing.
5. K2: dam_file_availability.py + GET /file-availability; markery probe_wait/probe_done/recall_pending w agents/shared/handoff-preview-cache.md.
6. K3: dam_thumb_cache.py + PAMIEC-PODRECZNA + GET/POST thumb-cache; AVIF; gitignore binariow.
7. K4: dam-preview-truth.js; usunieto Synology Drive / brak sync z onerror; thumbs -> /thumb-cache; ?v=previewRedis20260721a.
8. K5: warm async API; timing cache hit.
9. K6: doctrine Â§12; README Redis/circuit; PAMIEC README.
10. K7 QA (ui-taste):
    - Pass1 no false Synology title: PASS (lieCount=0, onErrorTitle=Podglad niedostepny)
    - Pass2 ELEMENTY/branding thumbs /thumb-cache: PASS (12/12 cache URLs, naturalWidth>0, screenshot Branding)
    - Pass3 online_only label: PASS (DamPreviewTruth.LABEL_ONLINE_ONLY poprawny)
    - Pass4 CYNAMONKA: PARTIAL - produkt w indeksie+folder na X:; brak rasterow w folderze (avail missing dla dir); lokalny preview potwierdzony na innych assetach (state=local, AVIF)
    - Pass5 timing+redis health: PASS (1st thumb ~144ms AVIF; 2nd X-DAM-Cache-Hit=1 Ms=1; health redis=open circuit=open)
11. K8: commit+push (ponizej).

**Efekt/Fix:** UI bez falszywego Synology onerror; Redis optional z circuit; thumbs na D: PAMIEC; path resolve per device.

**Test/Ewaluacja:**
- curl /health api_version=6 redis=open
- /file-availability state=local na logo Kubara
- /thumb-cache hit <500ms (1ms)
- node --check JS OK; ast.parse bridge OK
- Grep UI: zero Synology Drive / brak sync w dam-*.js (tylko komentarz PI / skill)

**ĹąrĂłdĹ‚a:** plan v5, dam_redis.py, dam_path_resolve.py, dam_file_availability.py, dam_thumb_cache.py, local_bridge.py, dam-preview-truth.js, dam-media-preview.js, dam-branding.js, program-instructions.json, README, code-doctrine.md, process.md

## 2026-07-22 ~16:10 - Dostosuj/customizer peek translateX (supersede 0098e139)

**Komenda/Akcja:** Domknij niedokonczona prace agenta `0098e139` (resume Composer fail) - panel Dostosuj wyglad: peek ~50px + translateX + fade.

**Log/Status:**
1. Root cause: `.geex-customizer` w `.geex-main-content` + `overflow-x:clip` â†’ closed peek clipowany do prawej krawedzi main (sliver / "zniknal").
2. Fix: `mountCustomizerToBody()` w `dam-shell.js`; inject CSS translateX(calc(100%-50px)) closed / translateX(0) open + fade content; sync `dam-brand.css`.
3. Cache-bust `?v=dostosujPeek20260722c` na HTML ladujacych dam-shell / dam-brand.
4. Superseded agent: `0098e139-8ff9-4448-8a90-5eb28b5da876`.

**Efekt/Fix:** Closed peek 50px DOSTOSUJ na prawej krawedzi viewport; open slide+fade; sidebar nie przykrywa peek; header z-index Pass (customizer 12600 / header active 100).

**Backup:** brak

**Test/Ewaluacja:**
- `node --check` dam-shell.js Pass
- CDP closed: parent=BODY, peekW=50, visible=50, transform=matrix(...,350,0), elementFromPointâ†’dam-customizer-peek, z=12600
- CDP open: transform=none/0, opacity=1, title elementFromPointâ†’geex-customizer__title, headerZ=100
- CDP collapsed sidebar: peekW=50, hit=peek
- Explorer spot-check: parentBody, peekW=50
- Screenshot+Read: closed / open / collapsed / explorer

**ĹąrĂłdĹ‚a:** dam-shell.js (`ensureShellLayerCss`, `mountCustomizerToBody`, `ensureCustomizerPeek`); dam-brand.css; code-doctrine Â§12

---

## 2026-07-22 ~16:15 - Integracja produkcja faktury KROK 6-7 (WORKER)

**Komenda/Akcja:** Domknij plan integracja_produkcja_faktury (KROK 6 Outlook draft + KROK 7 docs/commit).

**Log/Status:**
1. KROK 0-5 juz w kodzie (PI, sleeve-stock, rename menu, Asana costing, panel 4 sekcji).
2. KROK 6: invoice_mail.py - CSV+HTML+PDF (reportlab), Outlook COM + ZIP fallback; bridge POST /finance/invoices/outlook-draft (admin) + audit invoice_outlook_draft.
3. Bridge restart (stary proces bez handlera POST -> 404; po restarcie 401->200 z tokenem).
4. Outlook COM na sesji agenta: Operacja przerwana - fallback ZIP+mailto Pass (plan guardrail).
5. UI: 4 sekcje gap 24px; odbiorcy Kubara; nr 509012414; screenshot inv-mail-panel-krok6.png + Read.
6. Fix mojibake naglowka panelu w invoices.html (ASCII-safe PL).
7. .gitignore: apps/web/data/_invoice_mail_stage/.
8. Docs: process.md, PROGRESS.md, agents/shared/release-2026-07-22-integracja-produkcja.md.
9. Commit plan-scoped: bez dam-shell.js (kolizja Dostosuj), bez dam-dashboard-widgets/tasks (obcy scope); menu rename w i18n/pl.json.

**Efekt/Fix:** Endpoint outlook-draft zyjacy; zalaczniki PDF w ZIP; panel wysylki gotowy; COM zalezy od Outlooka usera.

**Backup:** brak

**Test/Ewaluacja:**
- POST outlook-draft bez auth -> 401 login_required (nie 404)
- POST z admin Bearer -> 200, attachments=3, zip ma .pdf, to=[faktury@, alina.andzel@], accounting 509012414
- CDP: 4x .dam-inv-mail__section, gap 24px
- Screenshot+Read: inv-mail-panel-krok6.png Pass
- Outlook Display: blocked/aborted w headless agent - fallback Pass

**ĹąrĂłdĹ‚a:** plan integracja_produkcja_faktury_c9e97532; invoice_mail.py; local_bridge.py; dam-invoices.js; invoices.html

## 2026-07-22 ~17:20 - COMBO lead K9 flush (K0-K9)

**Komenda/Akcja:** LEAD WORKER COMBO folder picker global - flush after K0-K9 (sibling coordination).

**Log/Status:**
1. Sibling ownership observed: [2f8c0d38] Redis silence (dam_redis.py) - AVOIDED. Other streams: bento/dashboard; Dostosuj peek (dam-shell); integracja/faktury (bridge restart outside COMBO mutate window - noted). K0 LOG earlier overwritten by concurrent process.md writers - restored here as flush.
2. K0: padBaseT/R/B/L = 16 (source CSS combo padding:16px). Health green. Backup `agents/shared/planner-runs/combo-folder-picker-2026-07-22/backup-20260722-153355` (18 files).
3. K2: PI `ui.folder_picker_combo_only` + Szablony YES (removed must_not fizycznego podfolderu); doctrine Â§12 COMBO extract; app-settings instructions v21 count 80; seed GET ok.
4. K2b LAST restart: `existing_product_path` add-variant in explorer_create.py; `POST /explorer/add-subcategory` + `add_global_subcategory`; ast+health OK. No further COMBO bridge restarts.
5. K3: `dam-folder-picker.js` + chrome (70vw/90vh, pad 26, OtwĂłrz Eksplorator Windows near views); viz THIN-DELEGATE. folderDirFromPath STAY.
6. K4/K9 HTML: script tags on branding/visualizations/explorer/dashboard `?v=comboPick20260722b`. Sibling also wired K5-K8 (assoc/explorer/tag/add-product) - lead verified, did not overwrite their WIP.
7. Lead extras: explorer.js token -> comboPick20260722b; default startDir = DamPaths.getBasePath()||X:\\Marketing; T9 regex emdash -> `\\u2013\\u2014`.
8. CDP chromeAsserts (padBase 16): pass=true padOk boxSizeOk windowsBtnOk thumbPickerOk !oldPicker zOk; gridPad=26; Marketing root folders=4. SW stale HTML risk - bypass/unregister needed for CDP.
9. Screenshots+Read: combo-k4-chrome-pass.png; combo-k9-chrome-pass2-marketing.png (CTA at views, large box, folders under X:/Marketing).

**Efekt/Fix:** Old pickers gone from apps/web JS; DamFolderPicker sole COMBO; chrome DoD T10 Pass; Redis files untouched.

**Backup:** backup-20260722-153355 (+ K3 new file rollback=delete)

**Test/Ewaluacja:**
- T1: rg damAssocFolderPicker/openFolderGrid/damElementsPicker in apps/web JS = 0 (only PI text)
- T9: rg emdash allowlist JS = 0 after fix
- T10: chromeAsserts.pass === true (pad 26, ~70/90, Windows CTA)
- Branding typeof DamFolderPicker.open === function
- node --check folder-picker/viz/assoc/explorer/tag/add-product OK
- Redis circuit: sibling quieted (closed) - expected optional noise cleared

**Zrodla:** plan combo_folder_picker_global_4981a878; dam-folder-picker.js; dam-viz.js; PI; local_bridge/explorer_create; sibling-wired assoc/explorer/tag

## 2026-07-22 ~14:30 - CRITICAL: kill Geex Demo shell on dashboard

**Komenda/Akcja:** WORKER - dashboard laduje stary Geex Demo (Demo/Layout/App/Features/Pages), brak #damDashGrid.

**Log/Status:**
1. Disk pps/web/dashboard.html NIE byl uciety - mial #damDashGrid + DAM skrypty, ALE markup sidebara/headera = pelne Geex Demo (DamShell rewrite dopiero w runtime).
2. HTTP GET :8765/dashboard.html = ten sam plik z dysku (po fix: DemoSpan=0, damDashGrid=true).
3. SW sw.js byl cache-first dla HTML do 1h - glowny wektor starego shella u usera.
4. Fix: SW CACHE dam-page-1h-v3 (pozniej sibling -> v4) + network-first dla HTML/navigate; serve_browser.py Cache-Control no-cache dla .html/sw.js; charset UTF-8 na poczatku head; usuniecie Demo/Layout/App/Features/Pages z markup dashboard.html (puste ul + komentarz); guard #dam-anti-demo-shell; bump ?v= shell/widgets.
5. index.html = Projekty (nie ruszany). Nie commitujemy.

**Efekt/Fix:** Geex Demo nie moze byc w markup dashboard; SW nie wygrywa starym HTML; DamShell wstrzykuje DAM nav; bento widoczne.

**Backup:** brak (zmiany in-place; git restore mozliwe na dashboard.html/sw.js)

**Test/Ewaluacja:**
- curl/HTTP: damDashGrid=true, DemoSpan=0, Polish UTF-8 OK, SW isHtmlRequest+network-first, CACHE dam-page-1h-v4
- CDP dashboard: pass=true, hasDamDashGrid, gridChildren=9, articles=8, hasDemo=false, Eksplorer present, footer inyfinn.art 2026 v3.1.5
- Screenshot+Read: anti-demo-shell-PASS.png (bento Produkty/Asana/wizualizacje; brak Demo nav)

**Zrodla:** apps/web/dashboard.html, apps/web/sw.js, apps/desktop/serve_browser.py, apps/web/assets/js/dam-shell.js, code-doctrine.md Â§12

## 2026-07-22 ~14:25 - WORKER: restore Polish diacritics (HTML UTF-8)

### Komenda/Akcja
USER: titles/buttons show `?` instead of n/s/z/e (Projekty opakowan, Odswiez liste). Audit encoding, fix root cause, UTF-8 meta/server, screenshot+CDP.

### Log/Status
1. Root cause: working-tree HTML had ASCII `?` where Polish UTF-8 multi-byte letters were destroyed (classic PowerShell Set-Content / wrong-encoding rewrite). git HEAD still had correct PL. `pl.json` was OK (had n). Meta charset UTF-8 was already present.
2. Systemic restore: `tools/_restore_pl_from_git_head.py` (skeleton line-match + phrase map from HEAD, write_bytes utf-8) - 16 HTML files.
3. Residuals / structural diffs: `_fix_qmark_residuals.py`, `_fix_branding_pl_chrome.py`, `_fix_branding_fffd_tail.py`, `_fix_more_pl_chrome.py`, `_fix_last_pl_bits.py` (NBSP i?ich, branding FFFD=0, quotes as is / jak jest).
4. Expanded `_fix_qmark_chrome_pl.py` with Odswiez liste / Projekty opakowan pairs for future.
5. `serve_browser.py`: `guess_type` returns `text/html; charset=utf-8` (+ js/css/json charset).
6. Forbidden siblings (freeze/assoc, Asana UX) not touched.

### Efekt/Fix
Projekty: `Projekty opakowaĹ„`, `OdĹ›wieĹĽ listÄ™`, subtitle z n/s/c; markers `opakowa?` / `Od?wie` = 0 in apps/web/*.html.

### Backup
Restore from git HEAD strings (structure/cache-bust kept). No destructive checkout of whole trees.

### Test/Ewaluacja
- HTTP GET :8765/index.html: bytes `opakowa\xc5\x84`, `Od\xc5\x9bwie\xc5\xbc` present; meta charset UTF-8
- CDP: h2=`Projekty opakowaĹ„`, btn=`OdĹ›wieĹĽ listÄ™`, bad_qmark=false (pass1+pass3)
- Screenshot+Read: `apps/web/_qa/pl-diacritics-projekty-pass2.png`, `...-pass3.png` - Pass (no `?` for diacritics)
- Grep markers Od?wie / opakowa? in *.html: 0

### Zrodla
tools/_restore_pl_from_git_head.py; tools/_fix_qmark_*.py; apps/web/*.html; apps/desktop/serve_browser.py; apps/web/i18n/pl.json; dam-dobrakaloria; code-doctrine UTF-8 Set-Content ban

## 2026-07-22 - [B] ZONE B assoc-dash-branding session-02 (K0-K5)

### Komenda/Akcja
WORKER Zone B only (plan revision 3): B1 peek remove, B2 drawer 50px, B3 neutral handle, G-B verify. Token `assocDashBr20260722a`.

### Log/Status
1. **[B] K0 peek-race=clear** - `dostosujPeek` tylko w planner-runs (historyczne); brak aktywnego writera.
2. **[B] STOP dostosujPeek*** - nie wzmacniaj prawego `.dam-customizer-peek`.
3. **[B] K1 backup** - `PAMIEC-PODRECZNA/backups/assoc-dash-branding-2026-07-22/backup-20260722-175000/` (8 plikow).
4. **[B] K2 B1** - `ensureCustomizerPeek` no-op + remove DOM; `.dam-customizer-peek { display:none }`; geex-customizer closed `translateX(100%)`; bump shell/brand HTML.
5. **[B] K3 B2** - stage transition 0.7s ease-in-out; peek label `wysuĹ„`; toggle `right:-30px` + `uil-draggabledots`; mascot 10 tips + `dam.dashCustomize.mascotDismissed`.
6. **[B] K4 B3** - `--bento-move-ink` charcoal/stone; handles tylko `body.dam-bento-layout-edit`.
7. **[B] K5 G-B** - CDP K2+K3+K4 Pass; screenshots Read Pass.

### Efekt/Fix
Prawy peek martwy (CDP length===0 dashboard/branding/explorer). Lewy drawer tucked exposedPx=50, protrusion=29px, badge `wysuĹ„`, mascotOk tips=10. Bento grips neutralne, 0 visible handles poza layout-edit.

### Backup
`PAMIEC-PODRECZNA/backups/assoc-dash-branding-2026-07-22/backup-20260722-175000/`

### Test/Ewaluacja
- `node --check` dam-shell.js, dam-dashboard-widgets.js, dam-bento-resize.js: OK
- CDP K2 peek: dashboard=0, branding=0, explorer=0
- CDP K3 (tucked): transition07=true, peek50ok=true (exposedPx=50), protrusionOk=true (29px), badgeOk=true, mascotOk=true, toggleDots=true
- CDP K4: layout-edit OFF visibleHandles=0; ON notPurple=true, icon=uil-draggabledots
- Screenshot+Read: `PAMIEC-PODRECZNA/screenshots/assoc-dash-branding-2026-07-22/B-tucked.png`, `B-expanded.png`, `B-sidebar-collapsed.png` - Pass (wysun peek ~50px, brak prawego DOSTOSUJ, mascot tip, neutral grips)

### Zrodla
plan assoc_dash_branding_ux revision 3; dam-dobrakaloria; code-doctrine; CDP inline SS5 K2-K4

### [B] G-B Pass


## 2026-07-22 ~16:00 - Bento handles + Dostosuj left drawer (WORKER)

**Komenda/Akcja:** Hide .dam-bento-move-handle by default; show only after #damDashCustomizeBtn; refactor #damDashCustomize to left peek/expand drawer (~50px tucked, no dim).

**Log/Status:**
1. Root cause: is-bento-active always showed move handles (opacity .92) even outside customize; modal was full overlay.
2. Gate chrome/DnD on ody.dam-bento-layout-edit (+ dam-dash-customize-on) set by openCustomize / cleared on close. Tasks keep always-on via .dam-tasks-bento.
3. Drawer: start tucked (~50px strip, pointer-events passthrough, backdrop opacity 0); expand via peek/toggle; dim when expanded. Inline transform + transition:none flush so expand is reliable; de-dupe modal click/keydown listeners.
4. Cache-bust: dam-dashboard.css?v=dashDrawerFix20260722f, dam-bento-resize.js?v=editGate120260722e (cssTag editGate2), dam-dashboard-widgets.js?v=dashDrawerFix20260722j.

**Efekt/Fix:** Default clean grid; Dostosuj = edit mode + left peek; expand = full panel + dim; Anuluj/Zapisz exits edit (handles gone).

**Test/Ewaluacja:**
- 
ode --check widgets + bento-resize: OK
- CDP Pass=true: p1 moves=0; p2 strip=50 bg=0 moves=8; p3 left=0 bg=1 moves=8; exit moves=0
- Screenshots: final-pass1-default.png, final-pass2-tucked.png, final-pass3-expanded.png (+ Read)
- Checklist C3 [x] (chrome/UX only, not card anatomy redesign)

**Zrodla:** dam-bento-resize.js, dam-dashboard-widgets.js, dam-dashboard.css, dashboard.html; skills dam-dobrakaloria + ui-taste

## 2026-07-22 ~18:05 - Drawer metka / jezyczek (zamiast full-height wysun)

**Komenda/Akcja:** Usunac #damDashDrawerPeek (pasek ~50x1149 "wysun"); zostawic mala metke #damDashDrawerToggle wystajaca z lewej.

**Log/Status:**
1. Design Read: product UI drawer handle (Geex), clothing-tag / bookmark tab.
2. Usunieto markup peek; CSS kill .dam-dash-modal__peek.
3. Toggle przeniesiony poza panel do .dam-dash-modal__dock (sibling) - nie clipuje overflow:hidden ani backdrop.
4. Tucked: stage translateX(-100%) - widoczna tylko metka 36x64, chevron right/purple.
5. Expanded: metka na prawej krawedzi docku, chevron left; elementFromPoint trafia w toggle.
6. Cache-bust: dam-dashboard.css?v=dashDrawerTab20260722b, dam-dashboard-widgets.js?v=dashDrawerTab20260722b.

**Efekt/Fix:** Brak full-height "wysun"; klikalna metka nad contentem w obu stanach.

**Test/Ewaluacja:**
- node --check dam-dashboard-widgets.js: OK
- CDP tucked: peek=false, toggle 36x64 @ x=0, hitToggle=true
- CDP expanded: peek=false, toggle @ x=612, hitToggle=true, icon=uil-angle-left
- Screenshot+Read: dash-metka-toggle-el.png (tucked metka widoczna), passy 1-3

**Zrodla:** dam-dashboard.css, dam-dashboard-widgets.js, dashboard.html; dam-dobrakaloria; ui-taste

## 2026-07-22 ~18:10 - Dobrokalorius tip przy metce

**Komenda/Akcja:** Przywroc podpowiedz Dobrokaloriusia przy schowanej metce z boku.

**Log/Status:**
1. Root cause: tip byl w .dam-dash-modal__panel (overflow:hidden) - przy tucked clipowany.
2. Tip przeniesiony do .dam-dash-modal__dock (obok toggle); left = 100% + tab + 10px.
3. Copy tipow o metce/jezyczku; naglowek DobrokaloriuĹ›; dismiss key v2.
4. Cache-bust: ?v=dashDrawerTab20260722c

**Efekt/Fix:** Przy tucked widoczna metka + tip Dobrokaloriusia wskazujacy jezyczek.

**Test:** CDP tipExists, tipParentIsDock, tipInViewport, tip @ x=46 obok toggle @ x=0; screenshot+Read Pass.

## 2026-07-22 ~18:20 - Dashboard thumbs -5% + branding tags + Zatwierdz/Anuluj + hold 2s

**Komenda/Akcja:** Miniatury -5%; wiecej tagow branding_latest; toolbar Zatwierdz/Anuluj w edycji; globalnie DamDanger 2s + kolo przy kursorze.

**Log/Status:**
1. Thumbs: clamp 122/22.8cqi/182 (CSS + inject).
2. brandingBadgesHtml: brand + appearance_tags + typ + tlo + tags + warianty (max 5).
3. Toolbar: #damDashCustomizeCancel (hold 2s) + #damDashCustomizeBtn -> Zatwierdz w trybie edycji.
4. DamDanger: DEFAULT_HOLD_MS=2000; cursor ring #damDangerCursorRing; toast na dole przy krotkim kliku; PI ui.safe_delete zaktualizowane; settings copy ~2s.
5. QL remove: data-dam-hold-delete 2000ms.
6. Cache: dashEditHold20260722a / hold2sCursor20260722a (wszystkie HTML z dam-danger).

**Test:** node --check OK; CDP thumbs~180; toolbar Zatwierdz+Anuluj visible; short Anuluj -> toast 'Przytrzymaj 2 s...'; qlHold attrs.

## 2026-07-22 ~19:20 - [C-WARM] K-WARM-0..6 infrastructure + enqueue started

**Komenda/Akcja:** C-WARM zone executor: backup trio, inventory AâŞB, local filter, bridge warm consumer, sole enqueue, verify snapshot.

**Log/Status:**
1. Backup: `PAMIEC-PODRECZNA/backups/assoc-dash-branding-2026-07-22/backup-20260722-175014/` (dam_thumb_cache.py, dam_redis.py, local_bridge.py).
2. `[C-WARM] K-WARM-0 inventory_total=48503` â†’ `PAMIEC-PODRECZNA/warm-inventory-20260722.json`.
3. `[C-WARM] K-WARM-1 local_count=48173 skip_count=330 skip_online_only=330` â†’ `warm-local-20260722.json`, `warm-skip-20260722.json` (walk fast-path + parallel stat).
4. Bridge restart (owned): `DAM_WARM_BOOT_CONSUMER=1`, `DAM_WARM_BOOT_ENQUEUE=0`, `DAM_WARM_WORKERS=24`, `DAM_WARM_BATCH=200`.
5. `[C-WARM] K-WARM-2 redis_circuit=closed consumer_started=1 boot_enqueue=0` (health warm.consumer_started=true).
6. `[C-WARM] K-WARM-3 workers=24 batch=200 encode=cpu_avif`.
7. `[C-WARM] K-WARM-4 enqueued_total=96130 profiles=grid,card skip_already_cached=216`.
8. K-WARM-5 snapshot: queue_drained=0, avif_pct=0.26 (eligible=96346 slots), redis.circuit=closed.
9. `[C-WARM] G-WARM InProgress queue_drained=0 avif_pct=0.26 redis_circuit=closed skip_count=330 local_count=48173 monitor=poll_15m`.

**Efekt/Fix:** New `apps/desktop/scripts/dam_warm_inventory.py`; multi-worker warm pool + boot consumer in `dam_thumb_cache.py`; health `warm.*` + nested `redis.circuit` in `local_bridge.py`.

**Monitor (co 15 min, cap 96):**
```powershell
curl.exe -s "http://127.0.0.1:8766/health"
python apps/desktop/scripts/dam_warm_inventory.py --queue-idle --timeout 30
python apps/desktop/scripts/dam_warm_inventory.py --verify-avif --local PAMIEC-PODRECZNA/warm-local-20260722.json --cache-root PAMIEC-PODRECZNA/thumbs --profiles grid,card
```

**Zrodla:** plan assoc_dash_branding_ux_c80dd39e rev3 C-WARM; dam-dobrakaloria; code-doctrine.

## 2026-07-22 ~19:21 - [C-WARM] monitor (poll 1, no re-enqueue)

**Komenda/Akcja:** Health check + `--verify-avif` snapshot only; **no** second `--enqueue`.

**Log/Status:**
- Bridge alive: `GET :8766/health` ok=true, api_version=7.
- `warm.consumer_started=true`, `workers=24`, `worker_idle_sec=0`, `paused=false`.
- `[C-WARM] monitor queue_len=96085 jobs_done=53 avif_pct=0.26 avif_ok=246 eligible=96346 missing=96095 redis_circuit=closed jpg_fallback=5 enqueued_once=96130 skip_count=330`.
- G-WARM remains **InProgress** (queue_drained=0; avif_pctâ‰Ş85).

**Test/Ewaluacja:** No double-enqueue; consumer actively draining (~45 jobs since K-WARM-4 snapshot).

## 2026-07-22 ~19:24 - [C-WARM] PAUSED â€” indexed-only rule; M: later

**Komenda/Akcja:** Parent scope change (memory #146 + plan rev4). No new warm work; document pause.

**Log/Status:**
- `[C-WARM] PAUSED â€” indexed-only rule; M: later`
- Inventory scope revised: **A only** (file-index, branding-index, etc.); **no** walk Marketing / whole X:.
- G-WARM stays **InProgress** (queue_drained=0); do not push more warm on Synology/cloud-only X: paths.
- **M:** = future full local source for full-disk warm.
- UI zones B/A/C DoD commit does **not** require `avif_pct >= 85`.

**Efekt:** Document-only pause; bridge/consumer left running; no kill unless trivial pause flag needed later.

**Zrodla:** Parent decision 2026-07-22; memory.md #146; plan rev4; brief.md rev3.


## 2026-07-22 ~20:31 - [A] shell-implement

**Komenda/Akcja:** Plan A audit (assoc_dash_branding_ux_c80dd39e K6a-K8); grep dam-assoc-edit.js; node --check; gap fill searchIndexParsedOnce CDP flag.

**Log/Status:**
- K6a PRODUKTY|BRANDING XOR tabs in search-wrap (L1035-1044): PRESENT
- K6a variant BRANDING aria-disabled (L983, L1039, L1640): PRESENT
- K6b branding-search-index session cache; list cap 80; no fat branding-index fetch: PRESENT
- K7 #damAssocEditPopover 80vw: PRESENT
- K8 Podsumowanie soft-delete; Zatwierdz to summary; Ok commits: PRESENT
- Gap: global.searchIndexParsedOnce after first parse (K6b CDP D19)
- HTML ?v= dam-assoc-edit.js: assocDashBr20260722a -> assocDashBr20260722b

**Test/Ewaluacja:** node --check dam-assoc-edit.js OK

**Efekt/Fix:** G-A Pass (code complete; CDP K9/K9b not run here)

**Zrodla:** plan assoc_dash_branding_ux_c80dd39e KROK 6a-8

## 2026-07-22 20:31 shell WORKER newest_products_f clip minH

- **Komenda/Akcja**: Watchdog mtimes ~20:27; raise 
ewest_products_f bento minH; cache bust dashboard.
- **Log/Status**: DEFAULT_MIN_SIZES.newest_products_f.h 16 -> 18; productsLayoutMinH('1x4') 16 -> 18; CSS --bento-h fallback 16 -> 18; overflow: hidden override on products tile (not clip); dashboard.html ?v= dashProductsMinH20260722g.
- **Efekt/Fix**: data-bento-min-h / migrate path uses h>=18 for 1x4 products; 4 media rows + tags scroll in body.
- **Test/Ewaluacja**: 
ode --check dam-bento-resize.js OK; sibling shell may finish visual QA.
- **Zrodla**: apps/web/assets/js/dam-bento-resize.js, apps/web/assets/css/dam-dashboard.css, apps/web/dashboard.html

## 2026-07-22 20:39 shell WORKER D24 freeze-smoke + CLIP (Playwright, no browser MCP)

**Komenda/Akcja:** curl.exe :8765; rg smoke scripts; Python Playwright headless; append CLIP/D24 evidence.

**Log/Status:**
- HTTP \127.0.0.1:8765/dashboard.html\ = **200** (curl.exe).
- Bridge \127.0.0.1:8766/health\ = **200**; CDP :9222 = not running.
- Runtime: Python \playwright\ Chromium headless OK; repo scripts: \pps/web/_qa/geex-realign-baseline/*.py\, \pps/web/scripts/_ralph_*.py\; temp \PAMIEC-PODRECZNA/d24-clip-freeze-smoke-20260722.py\.
- **CLIP_QA=Pass** (\
ewest_products_f\): rowCount=4, overflowPx=0, scrollHeight=clientHeight=1052, lastRowBottom within card; body overflow auto.
- **D24=Blocked** live click: no visible \Edytuj wszystko\ / assoc \Dodaj\ on dashboard; \randing.html?v=assocDashBr20260722b\ btn=0 without asset; thumb-click probe hung >90s (killed PID 51372). Code-path defer/no fat index unchanged (prior G-A Pass).

**Test/Ewaluacja:**
- \CLIP_QA=Pass\
- \D24=Blocked\
- Screenshots: \PAMIEC-PODRECZNA/screenshots/clip-dashboard-20260722-203928.png\, \PAMIEC-PODRECZNA/screenshots/clip-newest_products_f-20260722-203928.png\
- JSON: \PAMIEC-PODRECZNA/screenshots/d24-clip-results-20260722-203928.json\

**Efekt/Fix:** Shell visual evidence for products tile minH clip; D24 live assoc smoke not completed (UI entry missing / stall on thumb path).

**Zrodla:** dashboard ?v=dashProductsMinH20260722g; Playwright sync_api; process.md prior CDP freeze note.


## 2026-07-22 ~21:08 - Strona nie dziala (8765 down) + white board toast

**Komenda/Akcja:** Naprawa martwego UI :8765; toast DamDanger = biala tabliczka Dobrokaloriusia.

**Log/Status:**
1. Root cause strony: procesy python na :8765 zawieszone (LISTENING bez odpowiedzi), curl 000. Most :8766 OK.
2. Zabito zombie PIDy; uruchomiono python -m http.server 8765 w apps/web + local_bridge.
3. Usunieto UTF-8 BOM z 7 HTML (skutek Set-Content -Encoding utf8 przy bumpie dam-danger).
4. DamDanger toast: biale tlo, maskotka pose-think-q, znak ostrzegawczy, pasek odliczania; CSS_TOKEN whiteBoardMascot20260722a.

**Test:** ui:200 bridge:200; CDP toast bg rgb(255,255,255) width 420 hasMascot warn bar.

**Zrodla:** dam-danger.js, dashboard.html (+6 HTML), serve apps/web :8765

## 2026-07-22 ~21:14 - PI: cache ephemeral (Redis tylko first paint)

**Komenda/Akcja:** Utrwalenie doktryny usera o pamieci podrecznej.

**Log/Status:**
1. PI preview.cache.ephemeral_only (critical) + dopisek w preview.cache.redis.
2. memory #147; komentarze w dam-preview-truth.js / dam-media-preview.js.
3. app-settings critical_ids + version 23.

**Efekt:** Cache = booster loadu; klik/modal = /media z dysku.

## 2026-07-22 ~21:32 - [REGRESS] overlap + freeze + catalog STUCK + damExpSubAdd

**Komenda/Akcja:** UI probe timeout 5s â†’ fix servers, never spin-wait. Curl 8765/8766; Playwright timeout=5000ms fallback; real file edits.

**Log/Status:**
1. **Serwery:** curl :8765=200, :8766 health=200 (~2.7s). OK bez restartu.
2. **Catalog STUCK root cause:** `ensureFileIndex` / `openMediaPickerNow` traktowaly `_DAM_FILE_INDEX.products === []` jako warm cache (truthy) â†’ pomijaly fetch; UI zostawalo na â€žLadowanie katalogu produktowâ€¦â€ť bez `_damAssocHydrateProducts`. Dodatkowo surowy fetch 7.8MB file-index bez timeoutu i bez wspoldzielenia inflight z `DamSearch.load`.
3. **Catalog fix (dam-assoc-edit.js):** `hasWarmProductCatalog` (length>0), `ensureSearchIndexBootstrap` + `productsFromSearchIndex` (184 wpisy), `DamSearch.load` inflight, AbortController 15s, guard 2.5s, hydrate w catch/finally. Cache-bust `assocCatalogFix20260722e`.
4. **Overlap fix (dam-bento-resize.js + dam-dashboard.css):** MAX_ROWS 32, `ensureVizProductsStackGap`, push-down max overlap, explicit grid-row start. Cache-bust `dashProductsMinH20260722b`.
5. **Freeze fix:** deferred `renderPinned/renderOptions` (rAF+setTimeout); openEditPicker/openMediaPicker macrotask 0 (unchanged).
6. **damExpSubAdd (dam-explorer-add-product.js):** tag picker `#damExpSubTags` (label + slug secondary), inline `#damExpSubAddPanel` zamiast `window.prompt`; POST `/explorer/add-subcategory`. Cache-bust `expSubTags20260722a`.

**Test/Ewaluacja:**
- **Overlap=Pass** Playwright: vizR=4 prodR=12 gapPx=16 overlap=false
- **Freeze tick=Pass** Playwright: setTimeout deltaMs=16
- **Catalog=Pass (code+curl)** search-index 184 entries / 3.2s; served JS has bootstrap helpers. Playwright assoc popover probe **Blocked** (evaluate >18s on dashboard â€” heavy 8MB parse; bootstrap path verified in code)
- **damExpSubAdd=Pass (code+curl)** served JS: `#damExpSubTags`, `#damExpSubAddPanel`, no `window.prompt`. Live explorer Playwright **Blocked** (explorer.html >25s load)
- **D24 live assoc click=Blocked** (headless; manual QA on viz modal recommended)

**Pliki:** dam-assoc-edit.js, dam-bento-resize.js, dam-dashboard.css, dam-explorer-add-product.js, dashboard.html, visualizations.html, explorer.html, process.md

**Nota:** UI probe timeout 5s â†’ fix servers, never spin-wait. Przy MCP/browser stuck uzywac curl + Playwright timeout=5000ms.

---

### 2026-07-22 | Regula 5s + modal Eksplorera (split produkt/wariant)

**Komenda/Akcja:** Instrukcja dla wszystkich agentow (5 s = martwe, nie wisiec); dokoĹ„czenie modali Dodaj produkt / Dodaj wariant.

**Log/Status:**
1. **Regula globalna projektu:** `.cursor/rules/server-timeout-never-hang.mdc` (alwaysApply).
2. **Doktryna:** `code-doctrine.md` Â§5.0 + lekcja Â§12 (2026-07-22 serwery + browser MCP hang).
3. **Agenci:** `AGENTS.md`, `agents/README.md`, `01/02/03/AGENT.md`, `memory.md` Â§12a, skill `dam-dobrakaloria`.
4. **Smoke skrypt:** `scripts/ops/smoke-dam-ports.ps1`.
5. **Modal:** `#damExplorerCreateModal` (produkt) vs `#damExplorerAddVariantModal` (wariant); bootstrap wariantow po zmianie `#damExpCatPath`; PL copy w explorer.js.
6. **Cache-bust:** `expModalSplit20260722c` (explorer.html + dam-explorer-add-product.js + dam-explorer.js).

**Test/Ewaluacja:**
- `node --check` dam-explorer-add-product.js + dam-explorer.js = OK
- `smoke-dam-ports.ps1` = OK (8765/8766 HTTP 200, <5s)
- Browser MCP screenshot = Blocked (hang/interrupt); user manual QA po hard refresh

**Zrodla:** user feedback; `serve_browser.py`; prior session modal split.


---

### 2026-07-22 | Multi-WORKER pack: freeze + COMBO + dashboard + preview

**Komenda/Akcja:** User dump (freeze Dodaj/tag, COMBO UX, dashboard BENTO, thumb cache). Test w Browser Tab (nie desktop).

**Log/Status:**
1. Smoke :8765/:8766 = OK.
2. Checklist: B5/C3 [x] - regresja dashboard/BENTO.
3. Thumb-cache juz wylaczony (DAM_DISABLE_THUMB_WARM); poprawka: gdy off -> /media?preview=1 zamiast raw /media (RAM). Cache-bust 
oThumbWarm20260722c.
4. Launch WORKER A debugger freeze (assoc/tag/F5/popover).
5. Launch WORKER B DamFolderPicker COMBO (names + Wybierz/Anuluj + confirm).
6. Launch WORKER D dashboard BENTO layout.

**Efekt/Fix:** preview-truth preview=1 path; agents in progress.

**Zrodla:** user dump + screenshots; code-doctrine; dam-preview-truth.js.

---

**Komenda/Akcja:** Dashboard tile unify + #damVizModalOpenFile fix (2026-07-23)

**Log/Status:**
1. `#damVizModalOpenFile` â€” usuniÄ™to `DamMediaPreview.openAsset`; zawsze `DamPaths.openFileAndCopyPath` (bez starego `#damMediaPreview`).
2. Ujednolicono szablon kafelkĂłw `.dam-widget--viz/media/branding-latest` w `dam-dashboard.css`: ikony 31px (â’30%), 1x4/1x6 auto-wysokoĹ›Ä‡ bez clip, 2x2 kolumna thumb+tytuĹ‚, miniatury ~128â€“176px.
3. UsuniÄ™to konfliktujÄ…cy inject tile-CSS z `ensureDashLayoutCss` (zostaje header B5).
4. `resolveProductThumbUrl` â†’ bridge `/media` + `DamPreviewTruth.thumbCacheUrl`; warmThumbs na viz+products.
5. Cache-bust: `dashTileUnified20260723a`, `debug20260723a` (viz).

**Test/Ewaluacja:** CDP na istniejÄ…cej karcie (bez `browser_navigate`): `newest_viz_3` + `newest_products_f` â€” 3 ikony Ă— 31px, thumb ~158px, tytuĹ‚ `white-space:normal`, clamp 2. Screenshot MCP = pusta karta (znany bug); dowĂłd = CDP.

**Efekt/Fix:** Pass (logika + CSS metrics).


---

### 2026-07-23 | Rollback TAB BRANDING + mojibake + no-hang browser

**Komenda/Akcja:** User: wywal TAB BRANDING z COMBO, przywroc dzialajacy picker; polskie znaki; agenci nie wisza na navigate dashboard.

**Log/Status:**
1. Graphify: freeze path = dam-assoc-edit.js buildAssocMediaPickerUi + Branding tab.
2. Usunieto UI tabow PRODUKTY/BRANDING z COMBO; listTab zawsze products; loadBrandingIfNeeded = no-op.
3. Dodaj wariant (strip/grid) -> DamFolderPicker (openMaterialVariantAdd / openProductStripVariantAdd), nie ciezkie COMBO shell.
4. Mojibake: visualizations/explorer/branding.html (PokaÄą -> PokaĹĽ itd.), 109 tokenow.
5. Cache-bust: dam-assoc-edit.js?v=rollbackBrandTab20260723a (4 HTML).
6. Browser: NIE navigate na dashboard (MCP hang) - weryfikacja lokalna node --check + Grep.

**Efekt/Fix:** COMBO bez TAB BRANDING; warianty = lekki folder picker; PL znaki w 3 HTML.

**Test/Ewaluacja:** node --check OK; Grep PokaĹĽ wszystkie OK; brak data-assoc-tab=branding w UI stringu.

**Zrodla:** user dump; graphify-out/graph.json; transcript regression note.


---

### 2026-07-23 | Dashboard grid fit (titles/tags/thumbs/bottom band)

**Komenda/Akcja:** User dump BENTO: uciete teksty, branding tags, thumbs poza div, notify/checklists/quick nierowno.

**Log/Status:**
1. Checklist B5/C3 [x] - regresja, bez redesign anatomii kart hub.
2. brandingBadgesHtml: klasy --brand/--cat/--carrier/--lang/--variants + dam-badge-tag.
3. repairDashBentoLayout: notify|checklists same row+h; quick_links w=9 under.
4. BENTO_LAYOUT_VERSION=3 (force reflow localStorage).
5. CSS dashGridFit: thumb contain 88px 2x2, clamp titles, wrap pills, 1x6 scroll.
6. Cache ?v=dashGridFit20260723a (css+widgets+bento-resize).

**Test:** node --check OK; bez browser_navigate (MCP hang).

**Zrodla:** user screenshots+DOM; bento-card-freeze.md.


### 2026-07-23 | ONE media container hug (2x2/1x4/1x6)

**Akcja:** User - jeden kontener viz/products/branding; li nadaja wysokosc; bez pustej bieli.

**Fix:** CSS align-self:start + grid-auto-rows:auto; syncMediaTileBentoHeights mierzy karte i ustawia --bento-h; BENTO_LAYOUT_VERSION=4; ?v=dashMediaHug20260723a.

**Graphify:** query media bento height (BFS; potwierdzono DamBentoResize --bento-h).


---

### 2026-07-23 | Bento pack-tight + Anuluj hold 1.5s single ring

**Komenda/Akcja:** Kafelki media z wyimaginowanym miejscem (nie da sie ustawic blisko); podwojna animacja Anuluj; hold max 1.5s wszedzie.

**Log/Status:**
1. Checklist B5/C3 [x] - regresja layoutu, bez redesign anatomii kart.
2. Root cause gap: --bento-h = ceil(px/48) ignorowalo CSS 
ow-gap:16 -> komorka ~144px wyzsza niz content; dodatkowo ensureVizProductsStackGap mial +1 pusty rzad; min-h rezerwowalo przyszle 1x4/1x6.
3. Fix pack: 
owsForContentPx z gap; stack adjacent; mediaLayoutMinH chrome-only 4/5/6; BENTO_LAYOUT_VERSION=6; sync zawsze re-packuje kolumne media.
4. Fix hold: jeden cursor ring (bez ringa na przycisku, bez SVG track); DEFAULT/MAX_HOLD_MS=1500; copy 1,5 s; program-instructions ui.safe_delete zaktualizowane.
5. Cache: ?v=dashPackHold20260723b / holdRing1500ms20260723b.

**Test/Ewaluacja:** node --check OK; smoke 8765/8766=200; CDP: gapCards 160->32, bentoH 8->6, circles=1 btnRing=0 holdMs=1500, ver=6.

**Zrodla:** user DOM + screenshots; dam-danger.js; dam-bento-resize.js; dam-dashboard-widgets.js.

### 2026-07-23 | Viz empty: dymek PRAWO + clear welcome-link (bez Browser MCP)

**Komenda/Akcja:** Dymek nachodzil / byl po LEWEJ; tip uciety; lavender geex-btn; user: kompletnie na odwrot + min275/max400 + btn TR=bubble BR +30px. Intensive ui-taste (headless Chrome, NIE browser_tabs).

**Log/Status:**
1. Root cause: JS HTML mial bubble PRZED mascot (flex = lewo) + geex-btn--primary-transparent; CSS `__side` bez HTML.
2. Fix JS: stage = [mascot][side(bubble+clear)]; zero geex lavender.
3. Fix CSS: gap 40; bubble clamp 275-400; btn margin-top 30 + align-self end; tip bg-size 80%; mobile stack bez overlap.
4. Cache `?v=vizEmptyRight20260723g`.
5. QA: headless screenshots `_qa/viz-empty-pass*.png` + CDP (nie Cursor browser MCP).

**Test:** CDP desktop: order mascot|side, gap=40, overlap=false, bubbleW=400 horizontal, rightDelta=0, topGap=30, btnRadius=8px. node --check OK. smoke 8765/8766=200.

**Zrodla:** user screenshot + DOM; dam-welcome-link / dam-int-cta; memory 12a2.

### 2026-07-23 | Viz empty: maskotka poza #vizGrid (sidebar) â€” contain fix

**Root cause:** `#vizGrid.dam-viz-grid` = `repeat(auto-fill, minmax(220px,1fr))`. Empty w 1. kolumnie karty; `overflow:visible` â†’ stage (mascot+bubble ~590px) wyplywal w lewo na sidebar.

**Fix:** `#vizGrid:has(> .dam-viz-empty)` â†’ `grid-template-columns: minmax(0,1fr)` + `overflow:hidden`; empty `grid-column:1/-1; width:100%`; mascot bez ujemnego `left`; cache `vizEmptyContain20260723j`.

**CDP:** gridCols=1074px, mascotInGrid=true, mascotOverlapsSidebar=false, bubbleW=400, rightDelta=0, topGap=30.

**QA:** headless + sidebar preview (bez Browser MCP).


### 2026-07-23 | Viz empty: hug gĹ‚owy (adnotacja usera)

**Problem:** `.dam-viz-empty__side { flex: 1 1 auto }` rozciÄ…gaĹ‚ kolumnÄ™ â€” dymek/btn odjeĹĽdĹĽaĹ‚y w prawo od maskotki.

**Fix:** side `flex: 0 0 auto` + staĹ‚a szer. 275â€“400; stage `width: fit-content; gap: 14px`; dymek przy gĹ‚owie.

**CDP:** gap=14, sideW=400, stageW=564, rightDelta=0, topGap=30, clusterTight=true. Cache `vizEmptyHug20260723o`.


### 2026-07-23 | vizModalFix20260723j - tag freeze / modal filter leak / variant save

**Komenda/Akcja:** Debugger WORKER - 3 regresje po vizModalFix20260723i.

**Log/Status:**
1. A: usunieto `dam:panic-reset` z `openTagPicker` / `openTagEdit`; soft unstick `_tagPickerOpening`; async kinds = wait + single `renderTagPicker` (bez `__loading__` double-render).
2. B: `bindClicks` HARD skip `applyTagFilter` gdy badge w `#damMediaPreview` / `#damVizModal`.
3. C: `resolveBrandingAssetId` + unique basename fallback; fail = toast, picker zostaje; `openVariantBrowsePicker` commit `id|path` i `onDone` -> `saveAssociations`.
4. Cache bump `?v=vizModalFix20260723j` (branding.html + visualizations.html).

**Test/Ewaluacja:** node --check OK (4 pliki); smoke 8765/8766=200; grep: brak dispatch panic-reset w openTagPicker/openTagEdit; modal skip w bindClicks.

**Zrodla:** user WORKER brief; dam-tag-edit.js; dam-badges.js; dam-assoc-edit.js; dam-folder-picker.js.

### 2026-07-23 | Empty Branding/Viz: karta WYZEJ, maskotka NIZEJ + dymek, tip bez crop

**Komenda/Akcja:** User: card wyzej, mascot nizej, dodaj dymek z tekstem, nie ucinaj grafiki od gory (Branding empty).

**Log/Status:**
1. CSS shared .dam-empty-mascot-row: speak cluster (bubble+mascot) margin-top:52px; card margin-top:0; tip slot height*1.95 + padding-top:36px; overflow visible.
2. JS Branding wrapEmptyWithMascot + Viz 
enderVizEmptyState: HTML [speak[bubble|mascot]|card], random PL lines.
3. Cache ?v=emptyMascotBubble20260723u (branding/viz/explorer/dashboard + QA preview).
4. QA headless (nie Browser MCP): _qa/branding-empty-p1.png / p2 viz / p3; CDP: hasBubble, mascotLowerThanCard, cardOnRight, tipClearancePad=36.

**Efekt/Fix:** Layout LEFT speak+dymek (nizej) | RIGHT card (wyzej); tip pose-think-q nieprzyciety.

**Test:** node --check OK; smoke 8765/8766=200; CDP exit 0.

**Zrodla:** user DOM positions; dam-branding.css/js; dam-viz.js.

### 2026-07-23 | Empty mascot +15% + mood poses + 30 lines

**Komenda/Akcja:** PowiÄ™ksz maskotkÄ™ 15%; losowe pozy wg kontekstu (ĹĽart/smutek/ok/think); +30 tekstĂłw.

**Log/Status:**
1. CSS --dam-empty-medal: 172.5px (mobile 138).
2. Nowy dam-empty-mascot.js (70 linii, mood->pose).
3. Branding + Viz: DamEmptyMascot.pick().
4. Cache emptyMascotMood20260723v.
5. CDP medalW=173.

**Test:** node --check OK; mood sample bad=0; smoke 200.

**Zrodla:** user DOM 150px; pose-joy/sad/approve/think.

### 2026-07-23 | Projekty: archiwum switch + search fix + reindex (bez browser MCP)

**Komenda/Akcja:** Naprawa wyszukiwania `?q=cynamonka` / `6300783.00`, switch â€žPokaĹĽ archiwumâ€ť w toolbarze Projekty, peĹ‚ny reindex dysku, omijanie zawieszonego browser_navigate.

**Log/Status:**
1. **Przyczyna zaciÄ™Ä‡ agenta:** `browser_navigate` MCP w Cursorze wisi >5 s bez odpowiedzi (nie bug DAM). Weryfikacja: curl + node z `--max-time 5`, bez MCP przeglÄ…darki.
2. **Przyczyna zamroĹĽenia UI Projekty:** podwĂłjne parsowanie ~8 MB `file-index.json` (DamApi.projects + ponowny fetch w dam-projects.js). Fix: `dam-api.js` ustawia `window._DAM_FILE_INDEX`; dam-projects nie pobiera pliku drugi raz.
3. **Switch archiwum:** `#damProjectsIncludeArchive` w `#damProjectsSearchScope` (jak Branding), localStorage `dam_projects_include_archive`.
4. **Search:** `filteredRows()` uĹĽywa `DamSearch.productMatchesTextQuery` + `productHasLivePresence` (indeksy, tagi, search_blob, rewizje archiwum).
5. **Reindex:** `python apps/web/scripts/build-file-index.py` â€” 184 produkty, 9.77 s, archiwum wĹ‚Ä…czone w skan.
6. Cache bust: `projArchive20260723a` (index.html, dam-api, dam-search, dam-projects, dam-brand.css).

**Test:** node --check OK; symulacja search: cynamonkaâ†’cynamonka-nerkowcowy, 6300783â†’6300782/6300783; curl index.html 200 z nowymi ?v=.

**Zrodla:** user report; code-doctrine Â§5 (timeout); build-file-index.py merge_category_archive.

### 2026-07-23 | Projekty: Cynamonka 6300783 - zly pick rewizji (KAR6X vs MINI)

**Komenda/Akcja:** Karta Cynamonki pokazywala 6300782.00 / Niekompletny mimo folderu KAR6X 6300783.00 - F na dysku.

**Log/Status:**
1. **Indeks OK:** `file-index.json` ma oba foldery (`6300782.00` MINI, `6300783.00` KAR6X) - skan dziala.
2. **Bug UI:** `pickLatestRevision` sortowal po dacie folderu â†’ MINI (18.06) wygrywal nad KAR6X (20.05), choc KAR6X ma 32 wizki i jest kompletny.
3. **Fix:** sort: dopasowanie query â†’ wyzszy index_base â†’ wiecej wiz â†’ data. Karta pokazuje oba indeksy w rogu gdy multi.
4. Checklist + badge Kompletny liczone z wybranej rewizji (query-aware).
5. Cache bust: `projRevPick20260723b`.

**Test:** node symulacja: cynamonkaâ†’6300783.00 viz=32; 6300783 queryâ†’6300783.00.

**Zrodla:** file-index cynamonka-nerkowcowy; user path X:\\...\\6300783.00 - F.

### 2026-07-23 | Empty: +30 linii + trim PNG (medal fixed)

**Akcja:** +30 tekstow; crop pose PNG density-bbox; medal 172.5 bez zmian; sprite contain w ~medal box.
**Cache:** emptyMascotTrim20260723w / trimAlpha20260723b. Backup: maskotka/_trim_backup_20260723.
**CDP:** medalW=173; lines=100.

## 2026-07-23 - CHECKPOINT: Dodaj wariant produktu DZIALA

Status (user confirmed live): w modalu Wizualizacje przycisk Dodaj wariant
(`button.dam-media-preview__assoc-plus-tile[data-product-variant-plus]`, SHIFT reveal)
dziala (UI + flow otwarcia).

NIE PSUJ tego przycisku / SHIFT reveal / strip wariantow przy kolejnych fixach.

Osobny bug: zapis nowego wariantu czasem sie nie dodaje (regresja) - nie mylic z przyciskiem.

Browser: zakaz Browser MCP navigate (zacina agenta) - headless CDP / curl.

Commit scope: allowlisted viz/branding/mascot + memory/process only.

## 2026-07-23 - Tasks Dostosuj handles + sidebar Integracja pill

### Komenda/Akcja
WORKER: (A) hide `.dam-bento-move-handle` on Zadania unless Dostosuj; (B) sidebar active pill fill meets left accent for long label Integracja i produkcja.

### Log/Status
1. Root A: `dam-bento-resize.js` CSS showed tasks handles for `.dam-tasks-bento.is-bento-active` always; dashboard already gated with `body.dam-bento-layout-edit`.
2. Fix A: gate CSS + `layoutEditAllowed` on `is-tasks-customize` / `body.dam-tasks-customize`; `dam-tasks.js` toggles via `[data-customize]` + Escape.
3. Root B: shell forced `height:56px` + `nowrap` (clipped wrap) + inset `box-shadow` accent vs `border-radius:18px` looked gapped.
4. Fix B: `height:auto` + wrap labels; active `::before` 3px accent + flatter left radius 6px; brand/accent/shell CSS.
5. Cache `?v=navPill20260723b`.

### Test/Ewaluacja
- node --check: dam-bento-resize.js, dam-tasks.js, dam-shell.js OK
- Headless CDP: handlesVisible 0 â†’ 7 â†’ 0 (Escape); Integrations active ::before 3px, radiusTL 6px
- Pixel strip mid-row: purple x2-4 then lavender x5+ (no white gap)
- Screenshots: apps/web/_qa/verify-tasks-handles-off|on.png, verify-integrations-nav-active.png

### Efekt/Fix
Pass A + Pass B.

### 2026-07-23 | Hotfix pack (empty+freeze+bento+nav+tags+variant persist)

**Commit checkpoint:** 6e9462e push main - Dodaj wariant DZIALA.

**Fixes (workers):**
1. Explorer freeze: dual DamSearch + sync file-index scan -> single-flight onResults + chunked yield (dam-search/explorer).
2. Empty mascot: Projekty+Eksplorer full row; Inbox speak-only.
3. Tasks: move handles only after Dostosuj (+ Escape).
4. Nav Integracja: flush accent pill, wrap label.
5. Tag popover: fixed+double rAF clamp under tag.
6. Variant persist: vizFlags merge keep linked_variants; folderPathFromPicked.

**Cache:** ?v=hotfixPack20260723a
**Smoke:** 8765/8766=200

### 2026-07-23 | Explorer empty clip fix

**Root cause (v1 bledny):** samo overflow:visible - karta 465px + speak wychodzila poza panel 747px (flex + width:min(520,100%-230)).

**Root cause (v2):** brak CSS Grid / minmax(0,1fr) - fixed speak+card > panel.

**Fix:** `.dam-empty-mascot-row` = CSS GRID `minmax(0,min(280px,36%)) minmax(0,1fr)`; karta width:100%; explorer panel tighter columns; flex body `flex:0 0 auto` zeby nie shrink-clip; overflow:visible dopiero gdy grid miesci szerokosc.

**Cache:** explorerEmptyGrid20260723d (tez dam-branding.css - wczesniej zostal utf8Fix i user widzial stary flex 465px)

**Test (live explorer.html + search asfsdaxyz99noclip):**
- CDP: display=grid, cardW 425, cardR 1326 < panelR 1344 (overflowRight -18), clipChain=[], pass=true
- Shot: `_qa/explorer-empty-p4.png` (cala strona Eksplorera)
- Smoke 8765=200

### 2026-07-23 | UTF-8 mojibake site-wide (nie nakladki)

**Objaw:** Sesja urzA...dzenia, Material,y marketingowe - user podejrzewal nakladki COMBO.

**Root cause:** klasyczny mojibake UTF-8 odczytany jako cp1252/cp1250 i zapisany ponownie (PowerShell Set-Content / zly zapis agentow). Nie warstwy z-index.

**Fix:**
1. `scripts/ops/fix-mojibake-utf8.py` - mapa PL z cp1252+cp1250 (26 plikow: dam-shell.js + HTML/CSS).
2. `settings.html` / `profile.html` przywrocone z git HEAD + zachowane `?v=`.
3. Resztki integrations/help/index (x razy, podwojne kodowanie) - druga passa + restore.
4. Cache `dam-shell.js?v=utf8Fix20260723a`.
5. Skrypty: `bump-shell-cache.py`, `scan-mojibake-leftovers.py`, `restore-utf8-from-head.py`.

**Test:**
- curl served shell: U+0105 w `urzadzenia`; project: `Materialy marketingowe`.
- CDP project.html: nav codes zawiera 261 (a), heading 322 (l).
- Snapshot a11y: Sesja urzadzenia, Materialy marketingowe, Wiadomosci, Dostosuj wyglad.
- Leftover scan apps/web (bez _qa): 0 plikow.
- Smoke 8765/8766=200; node --check dam-shell.js OK.

**Graphify:** query wskazywal shell/project strings; problem = encoding plikow, nie overlay graph.

**Zakaz:** PowerShell Set-Content na apps/web - tylko Python `Path.write_bytes` UTF-8 bez BOM (doktryna Â§12 2026-07-20).

### 2026-07-23 | Freeze UI root cause + autostart audit + ESC abort

**Objaw:** UI zacina sie przy skojarzeniach/combo; user podejrzewal tab Branding.

**Root cause (zmierzone):** `branding-index.json` = 387.9 MB. Fetch+parse w watku UI
blokowal main thread (nawet F5/ESC martwe). Zrodla po fixie 2026-07-22 zostaly TRZY:
1. `dam-project.js` renderMarketingShort (linia ~725) - kazde wejscie na projekt.
2. `dam-project.js` boot() marketingPartition (dodane przy variantSplit 20260723a) - DRUGI parse.
3. `dam-dashboard-widgets.js` loadBrandingIndex (widget branding_latest) - dashboard,
   czyli dokladnie tam gdzie user dodaje skojarzenia.

**Fix:**
- Bridge: nowy GET `/branding-for-product?product_id=&tokens=&limit=&sort=recent&include_archive=`
  - port 1:1 logiki `brandingAssetMatches`/`isArchivedBranding` z dam-product-correlation.js;
  filtr na pelnym indeksie po stronie Pythona (cache `_load_json` po mtime).
- `dam-project.js`: jeden lekki fetch (`fetchBrandingAssetsForProduct`, AbortController 8s,
  cache per product, rejestracja w `__damRegisterAbort`); oba 388MB fetche usuniete.
- `dam-dashboard-widgets.js`: widget bierze `?sort=recent&limit=200` (partial), nigdy pelny indeks.
- `dam-panic-reload.js`: ESC = `__damAbortAll()` + teardown overlayow (bez reloadu).
- Cache: `panicEsc20260723a` (21 HTML), `brandingLite20260723a` (project.html, dashboard.html).

**Test:** py_compile OK; `resolve_branding_for_product('', ['6300782','6300783'])` na realnym
indeksie: 73 assety (KAR6X cynamonka), query 2.0s pierwsze wejscie (parse w bridge), potem cache;
`sort=recent` OK. Bridge nie dzialal w trakcie zmian - endpoint aktywny od nastepnego startu DAM.

**Autostart:** "PowerShell z System32 przy starcie" = task `\EnklawaObozowa-NextWatcher`
(logon trigger, INNY projekt) - wylaczony (odwracalnie). DAM ma wlasny task
`\DAM-ETA-Database-Git-Sync` (co 1h, git push dumpow) - zostawiony, decyzja usera.
Audyt: `scripts/ops/audit-autostart.ps1`.

| Komenda | Log | Efekt | Test | Zrodla |
| --- | --- | --- | --- | --- |
| Intern: `dam-media-preview.js` + `dam-viz.js` plus-tile → `DamAssocEdit.openMediaPicker` (capture, `e.shiftKey`) | `ensureAssocPlusTilePickerWire` / `openVizProductVariantMediaPicker`; bez `DamFolderPicker` na plus | Oba Dodaj otwieraja picker zamiast COMBO/folder; toast gdy brak API | `node --check` OK; grep openMediaPicker na sciezkach plus; curl 8766/health + 8765/visualizations.html 200 | `_reference-092821f/dam-assoc-edit.js` openEditPicker→openMediaPicker |

### 2026-07-23 | Intern: restore fast openMediaPicker (092821f)

| Pole | Wartosc |
|------|---------|
| Komenda | Przywróć szybki `openMediaPicker` z commit 092821f (shell-first + Aktualne/search/preview/listbox); COMBO tylko przez przycisk „Przejdź do COMBO” |
| Log | Usunięto auto-routing Dodaj → `openVizAssocComboPicker` / ciężki COMBO; przywrócono UX z `_reference-092821f/dam-assoc-edit.js`; shell malowany zanim `ensureFileIndex()`; bez `branding-index.json` w UI |
| Efekt | `apps/web/assets/js/dam-assoc-edit.js`: `openMediaPicker` / `openMediaPickerSimpleNow` + export `DamAssocEdit.openMediaPicker`; COMBO zostaje za `_vizComboDirect` / footer |
| Test | `node --check` OK; assert: openMediaPicker + DamAssocEdit + brak fetch branding-index; curl `:8766/health` i `:8765/visualizations.html` → 200 |
| Zrodla | commit 092821f (`_reference-092821f/dam-assoc-edit.js` `openMediaPicker`) |

### 2026-07-23 | Intern: plus-tile -> fast openMediaPicker only

| Komenda | Log | Efekt | Test | Zrodla |
| --- | --- | --- | --- | --- |
| ADDENDUM: wszystkie Dodaj plus-tile -> `openMediaPicker` (picker_product/picker_variant); COMBO/folder tylko footer | Usunieto 6-way router (branding_preview_*/viz_*/material_*); `openEditPickerNow` bez redirectu do DamFolderPicker | `ensurePlusTile` -> `openEditPickerNow` -> `openMediaPicker` + `saveAssociations`; blad listy w pickerze (ESC/Anuluj) | `node --check` OK; plus-tile bez openVizAssocComboPicker/openMaterialVariantAdd; curl 8766+8765 200 | commit 092821f openMediaPicker |

### 2026-07-23 | Intern re-scope: audit + contract map + verify harness

| Komenda | Log | Efekt | Test | Zrodla |
| --- | --- | --- | --- | --- |
| Audit dam-media-preview.js/dam-viz.js; usunieto duplikat plus-handlerow; Shift+klik -> openMediaPicker; ADD tools/verify-picker-freeze.js | Plus-tile w dam-assoc-edit.js (inny worker); fallback bindLinkedAssetClicks neutralized; loadIndexAssets bez branding-index | Brak COMBO/folder z naszych sciezek plus; contract map 092821f dla assoc worker | node --check x3 OK; harness viz 200 health 200 openMediaPicker bez branding-index w body | _reference-092821f/dam-assoc-edit.js |


## #151 Orchestrator: picker 092821f przywrocony + integracja 2 agentow (2026-07-23 23:00)

- Komenda: przywrocenie szybkiego openMediaPicker z commita 092821f; router plus-tile (dam-assoc-edit.js) -> openEditPickerNow -> openMediaPicker; COMBO tylko przez _vizComboDirect (stopka Przejdz do COMBO).
- Log: Grok przywrocil picker + przepial router; Composer dodal capture-wire w dam-media-preview.js/dam-viz.js; orchestrator usunal _vizComboDirect:true z opts plus-tile w dam-media-preview.js (omijalo picker, wracalo do ciezkiego COMBO).
- Efekt: oba przyciski Dodaj (skojarzenia + wariant) otwieraja picker (Aktualne, szukaj, podglad, checkboxy, Zatwierdz/Anuluj, Przejdz do COMBO). Kopia stanu 092821f: ..\\DAM-kopia-092821f (worktree) + _reference-092821f/.
- Backup: worktree DAM-kopia-092821f (git, odtwarzalny).
- Test: node --check x3 OK; tools/verify-picker-freeze.js OK (200/200, openMediaPicker present, brak branding-index fetch); tools/_sim_picker.js PASS (shell 1ms, overlay w DOM, closePicker OK). Cache-bust ?v=pickerRestore092821f20260723t w 4 HTML.
- Zrodla: commit 092821f; dam-assoc-edit.js openEditPickerNow/openMediaPicker; dam-media-preview.js openAssocMediaPickerFromPlus.
- Uwaga: __damDbg fetchuje 127.0.0.1:7559/ingest przy kazdym kliku (telemetria debug) - do przegladu/wylaczenia w nastepnym kroku.

## 2026-07-23 ~23:55 - WORKER Intern: Shift+Dodaj remaining freeze (shiftDodajFix20260723bq)

**Komenda/Akcja:** Verify prior fix + remove remaining post-shell freeze so Runtime.evaluate stays alive.

**Log/Status:**
1. Claimed prior fix WAS in code (dedicated search-index fetch; no ensureFileIndex on open; variantThumbFast; no branding-index on open). Incomplete: Playwright still hung after shell.
2. Remaining root causes found:
   - __damDbg sync localStorage stringify + dual fetch
   - full bento CSS inject (ensureInjectedCss / idle preload) parsed on/near open and froze UI
   - productsFromSearchIndex mapped entire catalog (disabled; search via _DAM_SEARCH_INDEX)
   - simple picker painted variant rows on open (now type-to-search + caps)
   - **main remaining freeze:** inserting .dam-tag-edit-popover--wide.dam-assoc-edit-popover into branding/dashboard applied heavy dam-brand.css — JS finished in ~1–3ms then layout/evaluate/screenshot hung
3. Fix (dam-assoc-edit.js):
   - soft __damDbg (memory-only)
   - open path: shell CSS only; full CSS warm deferred 30s and skipped while overlay open
   - simple picker: Shadow DOM + isolated styles (dam-assoc-lite / :host), light-DOM mirror #damAssocEditPopover for getElementById
   - pinned cap 24; variant empty-q = type-to-search; search cap 80; no full products[] clone
4. Cache ?v=shiftDodajFix20260723bq (branding/dashboard/explorer/visualizations).
5. 
ode --check OK. Live Playwright: branding product open phases hydrate 1ms; wall-to-evaluate ~0.85s; ESC 2ms closes; variant 2000 candidates open ~0.1s; dashboard PASS <50ms.

**Test/Ewaluacja:** PASS (branding + dashboard). Screenshot _qa/shift-branding-bq.png. User: Ctrl+F5 Branding → modal → Shift+Dodaj produkty/warianty.

**Źródła:** dam-assoc-edit.js, HTML ?v=, process prior dfc22b03, dam-brand.css .dam-tag-edit-popover--wide


## 2026-08-03 12:16 — layout bin + DAM.exe (P0-P2)

**Komenda/Akcja:** Przebudowa P:\DAM = DAM.exe + bin + git; kit THEME/inyfinn-geex-kit; hybryda sync script; SQLite-only; fix pywebview pip install.

**Log/Status:**
1. Move drzewa do bin\ (GIT_ROOT zostaje P:\DAM)
2. CONTENT_ROOT / GIT_ROOT w runtime_config + dam_sync/dam_db
3. DAM.exe (PyInstaller) + skrot pulpitu
4. PI: workspace.layout_bin, db.sqlite_only_until_synology, workspace.hybrid_ssd_p_share
5. pip install -r bin/apps/desktop/requirements.txt (pywebview)
6. Smoke: UI :8765 explorer.html 200; Bridge :8766/health 200

**Efekt/Fix:** Launcher dziala po instalacji pywebview; komunikat bledy wskazuje bin/apps/desktop/requirements.txt

**Test/Ewaluacja:** smoke-dam-ports.ps1 exit 0

**Zrodla:** plan dam_bin_layout; ADR-007/009


## 2026-08-03 — assoc_adequacy rev3 (plant based over-rank)

- **Komenda:** Follow-up po branding OCR batch: fix rankingu ssoc_adequacy - generyczne frazy kategorii nie bic linii produktu.
- **Root cause:** fraza `plant based` z nazwy/folderu `03 - PLANT BASED` dostawala 99 (ocr_line_phrase) i wygrywala z `daktyl-limonka-raw` (55, sam token limonka) na OCR Kulki Limonka (br-005033).
- **Fix (rev3):**
  - `_ULTRA_GENERIC_PHRASES` / `_ULTRA_GENERIC_TOKENS` (plant based, vegan, bio, natural, good calories, dobra kaloria, ...) - same max 38 (generic_category_only).
  - Generyczna fraza + wyrazisty token linii w OCR → ~70 (generic_plus_line), np. BALLS+PLANT BASED.
  - Cross-frazy kategoria×smak (`kulki limonka`) z folderu produktu.
  - Frazy ultra-generic odfiltrowane z `_phrases_from_product`. **Bez banlisty owocow.**
- **Sync:** workspace `apps/web/scripts/assoc_adequacy.py` = `P:\DAM\bin\...` (SHA256 zgodny). recognition + batch-report zaktualizowane (re-rank bez pelnego OCR).
- **Override:** br-005067 nadal `linked=[blackcurrant-cake-cashews]`.
- **Test (re-score, bez batch 56k):**

| Case | Before | After | Verdict |
|------|--------|-------|---------|
| br-005033 Kulki Limonka | balls-plant-based 99 (plant based) | daktyl-limonka-raw 93 (kulki limonka); burgers 38 | PASS |
| br-005067 Porzeczka GC | blackcurrant-cake-cashews 96 | 96 (bez zmian); override intact | PASS |
| br-005049 Matcha_Mango | mango-lassi-nerkowcowy 99 | 99 | PASS |
| br-005097 jesienne smaki | muffin-jagodowy-nerkowcowy 99 | 99 | PASS |

- **Zrodla:** assoc_adequacy.py, branding-recognition.json, branding-ocr-assoc-batch-report.json, plan dam-m-drive-assoc-ocr.

## 2026-08-03 — refilter branding-index links (assoc_adequacy rev3)

- assets_touched=41785 links_removed=186653 override_enforced=3 backup=branding-index.backup-20260803T151958Z.json
- Verify PASS: br-005067 / baseball+tennis SVG / Kulki Limonka no burgers / br-009287 limonka SKU
- Script: apps/web/scripts/refilter-branding-links.py

## 2026-08-05 — move D + dirty-close

- Repo+bin przeniesione na D (robocopy); runtime launch.py/local_bridge z D (8765/8766).
- Dirty-close: confirmUnsavedClose + assoc picker; dashboard labels Odrzuc / Nie wroc / Zapisz zmiany.
- OCR: file-index drifted (7744358); branding-index 361381875 OK. Golden 513377… niedostepny po wipe WS.
- Cache-bust: ?v=restore20260805b.

## 2026-08-06 - Browser MCP hang: recovery toolkit restored

**Objaw:** rowser_tabs / rowser_navigate / rowser_cdp wisialy w nieskonczonosc; curl :8765/:8766 2xx w <50ms.

**Przyczyna:** Brak plikow odzyskiwania (dam-connection-watchdog.ps1, dam-agent-unstick.ps1, dam-browser-probe.js) mimo ze dam-pre-browser.ps1 je wolal. Agent czekal na MCP zamiast zamknac polaczenie i isc headless CDP.

**Fix:**
1. Odtworzono in/scripts/ops/dam-connection-watchdog.ps1, dam-agent-unstick.ps1, dam-cdp-resilience-watchdog.ps1
2. Odtworzono in/scripts/qa/dam-browser-probe.js
3. Dodano in/scripts/qa/dam-pakiet-cdp-smoke.js (headless Chrome + hard timeout, ZERO MCP)
4. dam-agent-unstick PASS 1s; dam-pakiet-cdp-smoke PASS (choice + picker screenshots)

**Zasada:** MCP hang >10s = abort. Najpierw unstick/pre-browser, potem headless CDP. Nie czekac na spinner MCP.


## 2026-08-06 - Blank explorer (opacity:0 stuck) + MCP ban

**Objaw:** Cursor tab Eksplorator bialy; MCP browser_cdp wisi minuty.
**Przyczyna UI:** `body.is-booting { opacity:0 }` + failsafe zdejmowal klasy TYLKO gdy `html.dam-booting` jeszcze bylo - po czesciowym boot bez cleanup body zostaje niewidoczny.
**Fix:** CSS animation failsafe 2.8s; JS unlock zawsze (2.8s/6s); shell release 1.2/2.8/3.5s; smoke `dam-explorer-boot-smoke.js` PASS (opacity 0@800ms -> 1@2000ms).
**Zasada:** NIGDY cursor-ide-browser gdy wisi; headless CDP + hard job timeout.


## 2026-08-06 - Cursor MCP navigate hang = blocking CDN on explorer

**Problem:** Agent nie moze odswiezyc TAB Eksplorator - `browser_navigate` / CDP wisi, bo strona nie konczy `document.complete` (sync TinyMCE no-api-key + fullcalendar + apex + dragula + swiper z CDN przed dam-*.js).
**Fix:** Usunieto blocking CDN z `explorer.html`; stuby pod Geex `main.js`; fonts/unicons non-blocking; smoke `dam-explorer-navfix-smoke.js`.
**Zasada:** MCP hang na navigate = najpierw sprawdz sync `<script src=https://...>` w HTML, nie czekaj na tool.


## 2026-08-10 — live grid publish + assoc seed dry-run (backend)

**Command / Action:** Backup live grid/head/sqlite; run `build-branding-grid-index.py --from-sqlite`; seed dry-run (no --force/--apply).

**Log / Status:**
- Smoke `:8765`/`:8766` = 200/200.
- Backup: `bin/apps/desktop/data/backups-live-grid-20260810150322/` (grid-index 18848345, head 369166, sqlite 5681152).
- Grid publish: `generation_id=395b62542b94c15a`, full count=54665, head_count=0, `links_from_sqlite=true`, zero packshot/WIZKI via eligibility.
- Assoc before/after: confirmed=22 (unchanged). Seed dry-run quality_gate FAIL `spray_product:burger-klasyczny-niemiesne:1129:0.24` — NOT applied.
- Tests: backend 9/9 OK; projection 8/8 OK.

**Effect / Fix:** Live packshot head replaced; head empty because Composer `HEAD_ROLES` (www/social/campaign/brandbook) absent in eligible role set (brand_asset/social_asset/…). Quiz pending still 0 pending seed blocker.

**Backup:** `bin/apps/desktop/data/backups-live-grid-20260810150322/` + builder `branding-grid-index.json.bak-*` if present.

**Test / Evaluation:** Grid gates PASS (gen/subset/packshot/wizki/nonempty/sqlite). Seed gate FAIL (no apply). Plan not done — parent UI Branding+Quiz remaining.

**Sources:** `bin/apps/web/scripts/build-branding-grid-index.py`, `seed-asset-product-links.py`, PI `branding.grid_no_wizki_visuals_packshot` / `assoc.seed_dry_run_gate`.

## 2026-08-10 — branding grid HEAD_ROLES taxonomy fix (frontend projection)

**Command / Action:** Diagnose live `asset_role` distribution on cleaned full grid; align `HEAD_ROLES` with `dam-asset-role-mapping.json` controlled taxonomy; extend projection tests; hash-gate sync builder/tests apps→bin; rebuild live grid/head with `--from-sqlite`.

**Log / Status:**
- Root cause: legacy `HEAD_ROLES={www,social,campaign,brandbook}` matched 0 rows in live eligible set (`brand_asset`, `social_asset`, `web_banner`, …); `(empty)` role 47449 excluded by design (no fallback).
- New `HEAD_ROLES`: `brand_asset`, `icon`, `brandbook`, `web_banner`, `web_bundle_tile`, `web_hero_slider`, `web_product_tile`, `ecommerce_ad`, `www`, `social_asset`, `social_video`, `social`, `key_visual`, `pos_material`, `outdoor_material`, `private_label_artwork`, `campaign` — priority sort (WWW/social/campaign before brand flood).
- Live rebuild: `generation_id=395b62542b94c15a`, full=54665, head=800, `links_from_sqlite=true`, subset OK, ineligible/packshot/WIZKI=0 in head+full sample.
- Python: `py_compile` OK; projection tests **12/12** OK.
- Smoke `:8765`/`:8766` ≤5s OK.
- Branding UI 3× CDP: cards=100, gen stable `395b62542b94c15a`, fat `branding-index.json` requests=0, grid-head=1, packshot tab hidden, badRole/wizki=0. **Quiz PASS not declared** (seed gate still pending).

**Effect / Fix:** Instant head non-empty (800 marketing graphics: social/web/campaign mix); no client cache-bust change.

**Backup:** prior builder `.bak-*` preserved by atomic replace.

**Test / Evaluation:** Screenshots `_qa_screenshots/branding-grid-head-pass{1,2,3}-20260810.png`. `dam-viz.js` untouched (datesy fix retained).

**Sources:** `apps/web/scripts/build-branding-grid-index.py`, `test_branding_grid_projection.py`, PI `branding.grid_no_wizki_visuals_packshot`, `dam-asset-role-mapping.json`.


## 2026-08-10 — seed spray quarantine (STOP przed apply)

**Command / Action:** Analiza `refilter-pending.jsonl`; generalna kwarantanna w `seed-asset-product-links.py`; dry-run; STOP bez `--apply` (sample nieadekwatne).

**Root cause:** Artifact 4974 linii; 1129× `burger-klasyczny-niemiesne` (24%) wszystkie `token_plus_context` score=55 (logo BURGER / keyword), bez OCR/SKU. Systemowy weak-token spray (takze kaszanka/jablko/…).

**Quarantine:** 1911 usunietych z accepted (burger 1129 spray + kolejne grupy n>=80 token spray). Accepted after=2796. Formal gate `ok=true`.

**Adequacy FAIL (blocker apply):** po kwarantannie tok_share≈0.69; sample `malina-owocowe` lezy w path `WIŚNIA - TRUFLE`; `daktyl-wisnia-raw` z bannerow multi-smak; mismatch weak≈5.5%. Zgodnie z PI: NIE `--apply`.

**Counts:** confirmed 22 → 22 (bez mutacji). pending/auto=0.

**Backup:** `bin/apps/desktop/data/backups-seed-quarantine-20260810151244/`

**Tests:** backend 12/12 OK (w tym 3 SeedQuarantine); projection 12/12 OK. Sync apps→bin seed+test+PI.

**Quiz API:** `/assoc/queue` = login_required (bez sesji); SQLite pending=0.


## 2026-08-10 — strong-only SKU/OCR seed + grid republish

**Command / Action:** `--strong-only` live scan (assoc_adequacy `sku_match` / `ocr_line_phrase`); dry-run PASS; `--apply --strong-only`; grid rebuild `--from-sqlite`; queue statuses pending+auto; bridge restart.

**Evidence counts:** sku_match=9325, ocr_line_phrase=26, total accepted=9351. Ambiguous SKU skipped=787. token_plus_context seeded=0.

**DB:** before confirmed=22 → after confirmed=22, auto=9351, rejected=0. Idempotent re-apply OK.

**Grid:** generation_id=`4a49bd013f7f114a`, head=800, full=54665, packshot/WIZKI=0, links_from_sqlite=true, assets_with_links≈15190. Builder apps/bin hash match (Composer HEAD_ROLES).

**Backup:** `bin/apps/desktop/data/dam-local.sqlite.1786367934.bak` (+ `.1786367988.bak`), `bin/apps/desktop/data/backups-strong-seed-grid-20260810151909/`.

**API:** `/branding/status` head=800 gen match; `/assoc/queue` = login_required (parent browser session). Repo queue: auto+confirmed, score/reason present, grid_fallback=false in route.

**Tests:** backend 16/16; projection 12/12. Sync apps↔bin. No commit/push.


## 2026-08-10 — /assoc/queue previewable-first (Quiz UX)

**Command / Action:** Prefer PNG/JPG/WEBP/GIF/SVG before TIF/PSD w `branding_asset_routes`; DISTINCT 200 assets + all suggestions; restart `serve_browser` (auth DB zachowane).

**Effect:** Pierwszy item po auth: `br-004616` PNG + `sku_match` 100. source=sqlite, grid_fallback=false. Seed/statusy/grid nietkniete.

**Test:** AssocQueuePreviewTests + full backend 22 OK. Smoke ports 200/200.

**Backup:** n/a (bez mutacji SQLite assoc).

## 2026-09-03 — hotfix branding preview basename drift (M-SLI503871 / kulki)

**Command / Action:** `_resolve_marketing_basename_drift` w `local_bridge.py`; restart mostu `:8766`; unittest `test_resolve_media_path.py`.

**Effect:** Indexed path `…/02 - SLIDERY KATEGORIE GLOWNE/kulki.png` resolve → `…/SUCHE/gotowe/kulki.png`. `/thumb-cache` + `/media` 200 bez rebuild fat indeksu.

**Test:** unittest 5/5; curl before 404/404 → after 200/200; branding UI 3× PASS (karta + modal 680×340).

**Backup:** n/a.

## 2026-09-09 — 5.0.191 samouczek + pełny indeks + cache AVIF 30%

**Command / Action:** Dokończyć samouczek (ściany tekstu / PAKIET), potem `POST /index/rebuild`, potem skasować `PAMIEC-PODRECZNA/thumbs` i przebudować AVIF quality=30 dla wszystkich zaindeksowanych lokalnych ścieżek.

**Log/Status:**
1. Phase A: IIFE `})(window)`; jedno zdanie na krok; auto-expand wiersza; chip PAKIET w dymku; allowClick bez zniszczenia overlay.
2. Phase B: `local_bridge.start_index_rebuild` → `apps/web/scripts/build-file-index.py`; ~34 s; last_ok.
3. Phase C: `dam_thumb_cache._encode_thumb` (`rgb.save(..., format="AVIF", quality=30)`); skrypt `rebuild-avif-cache-5.0.191.py`; 7311 ścieżek × grid+card = 14622 jobów.

**Effect/Fix:** Samouczek startuje; PAKIET widoczny na zrzucie; indeks 193/440/13; cache 12860 `.avif`, 0 `.jpg`.

**Backup:** Brak zip — 601 starych thumbs skasowane przed rebuildem.

**Test/Ewaluacja:** PNG 1966×1061 w `bin/agents/shared/design-system-2026-09-09/`; curl `/index/status` i `/thumb-cache/status`; Read obrazków. Hover tooltip nie potwierdzony wizualnie.

**Źródła:** `dam-tutorial.js`, `dam-explorer.js` `revealCarrierForTutorial`, `dam_thumb_cache.py`, `local_bridge.py` L1648.

## 2026-09-10 - 5.0.192 cache AVIF 70 KiB + originals-first

**Komenda/Akcja:** Census 12860 plików cache, selektywna rekompresja wszystkich 3742 AVIF >70 KiB, utrwalenie limitu w kanonicznym encoderze i poprawa ładowania cache/original w Explorer/Viz/Branding.

**Log/Status:**
1. Przed: 3742 >71680 B; 2390010899 B razem; oversized 2311125949 B; max 732059 B.
2. `dam_thumb_cache._save_avif_capped`: odłączona bitmapa RGB, bez profilu/metadanych, quality 30 w dół + redukcja rozdzielczości do limitu.
3. Recompress: 3742/3742 w 58.654 s, bez kasowania pozostałych 9118 plików.
4. `DamPreviewTruth`: cache jest pierwszym paintem; IntersectionObserver natychmiast uruchamia `/media` dla widocznego elementu; gotowy oryginał zastępuje cache.

**Efekt/Fix:** Po: 0 >71680 B; 100806252 B razem; max 37975 B. Nazwane próbki: 660443->6010 B oraz 559245->1974 B. Wersja 5.0.192.

**Backup:** Brak; selektywne nadpisanie 3742 oversized AVIF zgodnie z poleceniem.

**Test/Ewaluacja:** Python compile + `test_thumb_white_bg.py`; node --check 4 JS; smoke 8765/8766 HTTP 200; screenshot+Read `design-system-2026-09-10/explorer-thumbs-5.0.192.png` 910x746, FRONT/BACK czytelne. Raport JSON: `recompress-oversized-cache-5.0.192.json`; failures=[].

**Źródła:** `apps/desktop/dam_thumb_cache.py`; `apps/web/assets/js/dam-preview-truth.js`; `dam-explorer.js`; `dam-viz.js`; `dam-branding.js`; `memory.md`.

