2026-09-09 | 5.0.187 ui-taste passes 4-17 + Explorer glossary | EVIDENCE not PASS | 17 PNG 1966x1061 w design-system-2026-09-09 (brak 18-20: screenshot timeout na index.html). Pass-05 widgety stacked, gap, bez overlap. Pass-06..11 Dashboard: mascot+Dalej kazdy krok; Asana/Teams glossary; Asana spotlight wybiela szynę. Explorer: pass-16/17 PAKIET glossary+przycisk na KARTON 6x MINI Babka Cytrynowa; pass-13 plik=hello nie Skojarzenia. Copy click: brak widocznego dymka (aria-label w drzewie). Faza 5→6: a11y Info Pakowania → Wiadomości, Dalej zostaje; PNG timeout. Resume po navigate bez Przejdź tam bywa pusty overlay. Wersja bez bump. Bez commit. | Parent decyduje

2026-09-09 | 5.0.187 tutorial Projekty Dalej + glossary | EVIDENCE not PASS | Smoke 8765/8766 200. index.html laduje dam-tutorial.js. Dalej nie GSAP-fade overlay, nie exploreMode na klik. wait max 3s. PNG: dashboard-pass-01-live.png 312028B Read: v5.0.187 mascot Info Pakowania, spotlight sidebar Projekty (off-page), widgety 4 najnowsze wizualizacje vs 4 najnowsze produkty. dashboard-pass-02-projekty.png 266751B Read: spotlight na switch Info Pakowania, mascot, Dalej. dashboard-pass-03-dalej.png 248222B URL nadal index.html, Faza 6/9 Wiadomosci, overlay nie zniknal. Glossary pl.json tut.* . Bez commit. | Parent czyta PNG



2026-09-09 | 5.0.186 viz boot unlock (pointer-events auto) | EVIDENCE | visualizations.html:8-9/17-20 inline boot = pointer-events:auto!important + unlock 0/50ms (bylo none + 4.5s). unlockBootFailsafe always (dam-panic-reload.js:79). finishBoot pointer-events auto!important (dam-shell.js:2918). dam-shell-boot.css:20 auto!important. Cache-bust dam-shell.js?v=5.0.186 na viz (bylo 5.0.180). Headed: explorer-186-viz-clickable.png 1280x1800 467681B Wizualizacje v5.0.186 sidebar widoczny. Return explorer-186-3-return.png 1280x1800 164060B Read Batony 85 / Kulki 19 / Roślinne 60. Playwright URL po kliku Eksplorer ~5s (nie 12s). Bez commit. | Parent decyduje

2026-09-09 | 5.0.185 headed Wizualizacje→Eksplorer return PNG | EVIDENCE | Smoke 8765/8766 200. Served explorer.html dam-explorer.js?v=5.0.185, no dam-branding.js. Headed Chrome (not headless=new), mouse click, no Runtime.evaluate. First miss: y=198 stayed Eksplorer. Viz click (120,261)/(90,248) → visualizations.html. Return shot explorer-186-3-return.png 1280x1800 163913B Read: Batony 85 / Kulki 19 / Roślinne 60 / Sypkie 14 / Napoje 3 / Przetwory 3 / Datesy 8 / Chrupkulki 1; v5.0.185; nie `…`; nie Ładowanie. Graphify freeze path still: skeleton L1427 → slim GET skipGlobalAbort L7150/7169 → applyExplorerIndexBundle → bindExplorerData; pageshow resume L8501. Viz boot HTML still pointer-events:none (visualizations.html:7) — klik Eksplorer z viz bywał >12s zanim URL się zmienił. Bez commit. | Parent decyduje

2026-09-09 | 5.0.185 Explorer return bind (headed Chrome PrintWindow) | EVIDENCE not PASS | 5.0.184 return freeze reproduced: hands-headed-6-return-3s/8s 1400x900 119270/119339B Read: Ładowanie indeksu..., puste Kategorie. Fix: startExplorerIndexBind resumeReason always drops inFlight (dam-explorer.js:8454-8464); resumeExplorerAfterRestore always restart (8511-8513); init._damDone reentry (8535-8543); slim JSON.parse on main (7146); removed dam-branding.js from visualizations.html. 5.0.185 return: hands-headed-10-return-8s.png 1630x1228 163531B Read: Batony 85 / Kulki 19 / Roślinne 60 / Sypkie 14 / Napoje 3, v5.0.185, brak Ładowania, welcome OK. Cursor browser: no tab. Chrome died twice (no evaluate PID). Bez commit. | Parent czyta PNG

2026-09-09 | 5.0.182 curl evidence (zero browser) | OK | Served explorer.html 200 173751B 0.018s; dam-branding.js ABSENT; ?v=5.0.182 explorer/version/panic/boot. Slim gzip 47016B header X-Dam-Index-Fields: explorer. Full gzip 450060B. Product hydrate karmel-daktyle 200 10993B. node --check 3 JS=0. test_file_index_explorer_slim OK. 22 HTML cache-bust 5.0.180→182. Bez CDP. | Parent decyduje DONE

2026-09-09 | 5.0.182 boot pointer-events auto + worker parse | OK | Body dam-booting: pointer-events auto (nie none). Unlock 0/50 ms. Slim GET fields=explorer + parseJsonInWorker; fallback parse po setTimeout(0). version.json naprawiony (uciety JSON). Bez CDP. | curl smoke + explorer.html 200

2026-09-09 | 5.0.184 Viz stop 9MB :8765 + same-profile return PNG | OK | loadIndex -> :8766 viz_latest 519192B; DamSearch.reload skipFile na visualizations.html; dam-paths skip 9MB na explorer/viz; branding head nie na first paint viz. headless=new return hung PID 67156 i 40716 (curl explorer 200 ~15ms w trakcie). headless=old same user-data-dir: return PNG 1280x1800 164527B counts 85/19/60 nie `...`, v5.0.184. Bez commit, bez MCP/evaluate. | Parent decyduje

2026-09-09 | 5.0.183 Explorer return bind (Wizualizacje -> Eksplorer) | OK | Root: init jednorazowy, brak pageshow, AbortController na slim fetch, skeleton CATEGORY_CANON. Fix: startExplorerIndexBind + pageshow/visibility; skipGlobalAbort. Chrome --screenshot same user-data-dir po viz hung 35s (PID 42144 i wczesniejsze); curl explorer 200 ~15ms. Fresh profile 1280x1800 counts numeric. Bez commit, bez MCP/evaluate. | Parent weryfikuje sidebar in-tab

# LOGI — DAM Dobra Kaloria (operacyjny)

Format: Data | Akcja | Status | Efekt | Dalej

---

2026-09-09 | 5.0.181 Explorer freeze + F5 po hang | OK | First paint: GET :8766/file-index?fields=explorer + parseJsonInWorker; DamSearch.reload explorer-safe (searchOnly); boot failsafe pointer-events 4s/6s + CSS dam-booted; usunięty _probe_explorer_boot.py; bez dam-branding.js | smoke-dam-ports + curl + node --check

2026-09-09 | P6 verify Explorer filter band (design-system-2026-09-09) | PASS | Live 1280×1800/168783B + filter clip 950×110/11957B + sandbox 1280×900/37134B; §5.8/§5.4/§6 pad 20px0px; tree 8 cats; P6-verify.md | Pipeline P0–P6 complete

2026-09-09 | P4 audit Explorer filter band (design-system-2026-09-09) | OK | Sandbox PNG 1280×900/37134B verified; 3 net-new §9 rows (H-chip-brand, H-skeleton-explorer, H-kit-bootstrap); P4-audit.md written; product untouched | P5 recipe recontent

2026-09-09 | P0 control-plane Mode A (design-system-2026-09-09) | OK | Channels: smoke 8765/8766=200; slim index 46909B/193 prod; version 5.0.178 shipped explorer.html. P0 md: bin/agents/shared/design-system-2026-09-09/P0-control-plane.md | P1+ later

2026-09-09 | 5.0.178 explorer puste Kategorie / ghost chipy | OK | Root: Promise.all slim+meta + 3× search-index r.json + GSAP autoAlpha; watchdog nie widział pustego #damExplorerMain. First paint = tylko slim; meta 3s; tag bar po idle; skip GSAP bars; MAIN_PARSE_MAX 1.2MB. | Ctrl+F5 http://127.0.0.1:8765/explorer.html?v=5.0.178

2026-09-08 | Parent PASS explorer hang 5.0.177 (klik Batony) | OK | Crop 1468×1800 z PNG 15529px: Eksplorer v5.0.177, Batony aktywne (fiolet), karty Babka Cytrynowa / Chrupiący Orzech / Ciasto Marchewkowe, breadcrumb BATONY, brak overlay. DOM po kliku: 555 produktów, pointer-events auto. | Ctrl+F5 u siebie jeśli cache stary

2026-09-08 | Explorer drzewo vision 1280×1800 | OK | Chrome headless --window-size=1280,1800: 8 kategorii na PNG (Batony 85 … Chrupkulki 1), brak overlay, empty state „wybierz kategorię”. Kadry 900px ucinały drzewo (stąd Parent_PASS_recommend no). | User: Ctrl+F5 + klik folder

2026-09-08 | Parent 3/3 explorer 5.0.177 headless (Edge+Chrome, bez MCP) | OK | Reload1/3 Edge dump-dom: dam-booted, 8× dam-folder-item (Batony/Kulki/…), 0× „Ładowanie indeksu”, pointer-events auto. Reload2 Chrome PNG 127096 B (inny hash). Vision: Eksplorer v5.0.177, 182 prod., brak overlay. Slim 8766 /file-index?fields=explorer = 200 / 512166 B. Pętla 2 min zabita (PID 17300). | Ctrl+F5 http://127.0.0.1:8765/explorer.html?v=5.0.177 — klik w folder

2026-09-08 | 5.0.177 explorer slim + worker parse; Wprowadzenie = DATESY | OK | First paint: GET /file-index?fields=explorer (bez files_by_role/wizki). Parse w Workerze. openProduct hydratuje GET /file-index/product. DamSearch searchOnly. Sort wprowadzenie (5.0.176) zostaje MIN pierwszej rewizji. Wymaga restartu mostu 8766. | Ctrl+F5 explorer.html?v=5.0.177 i visualizations.html?v=5.0.177

2026-09-08 | 5.0.176 sort Wprowadzenie = pierwsza rewizja SKU | OK | Gyros/Kofta 08.2026 = nowa wizka starego produktu. DATESY 04.08.2026 = nowe wprowadzenie linii. Sort introduced = MIN daty folderu ze wszystkich rewizji w file-index, nie MAX widocznej wizki. created/mtime zostaja MAX. | Ctrl+F5 visualizations.html?v=5.0.176

2026-09-08 | 5.0.175 explorer freeze + sort 3 panele | OK | Root cause: `dam-branding.js` wsadzony na explorer.html (rano go nie było) + DamLoader na first paint. Usunięty skrypt brandingu z explorera; boot unlock 400 ms; bez DamLoader przy init. Sort: wiz `#vizSort` (wprowadzenie/mtime/created/nazwa), branding + created/introduced, projekty + mtime/created + etykiety wprowadzenie. curl 8765/8766 przed QA. | Ctrl+F5 explorer.html?v=5.0.175

2026-09-08 | Intern: viz index + thumb-cache (6300782/6900001/6300728/6300784) | OK | Root cause white dashboard: **8765/8766 down** (curl 000). Po restarcie `local_bridge.py`: 8765+8766=200. Indeks `generated_at=2026-09-08T10:24:24`, viz_count=438, stale=false. Wszystkie 4 indeksy: `viz_latest.path` na dysku + `/thumb-cache` 200 (plik i folder rewizji). Bridge: GET `/file-index`, `/file-index/viz-latest`, `_resolve_viz_image_for_thumb` (folder→viz). Testy `test_viz_index_thumb_routes.py` 4/4. Bez commita, bez bump version.json. | Kierownik: dashboard JS (inny worker); QA Ctrl+F5 po bridge up

2026-09-07 | UX 5.0.169: Bez statusu / Graficy / historia / hover | OK | status letter filter (explorer+viz+badges); empty state geex-btn bez maskotki; lifecycle writer admin|power_user|grafik (bridge+UI); historia PL + index hover thumb 0.3s; loadGrafikGroup prefetch; dam-badges export naprawiony; curl explorer+viz 200 | DONE bez commita

2026-09-07 | UTF-8 U+FFFD zero 5.0.168 | OK | 18 HTML: fix-utf8-mojibake.py (pl.json sync + FFFD_REPLS) + merge-head-utf8.py; branding tooltip ręcznie; test_i18n_utf8 12/12; scan=0; curl charset=utf-8 branding+dashboard; browser Pokaż/Ostatni miesiąc/Układ pulpitu OK | UX (Bez statusu/historia/role/hover) — inny worker

2026-09-07 | P6 Intern: DESIGN_SYSTEM.md finish + rule abs path + TRAP link remove | OK | §P6 vision PASS 1610×869; sidebar 5.0.165 bottom-left; Jost glyph ambiguous; explorer+dashboard broken css/?v= removed; .cursor/rules abs MUST read | Polish recontent + index/inbox TRAP still unverified

2026-09-07 | branding gray tags audit 5.0.166 | OK | LIVE: GC/Sylwia/Szymon/Na sklep/Element produktu disabled opacity 0.42; GC=FEATURE (683 GC w fat, 0 grid-eligible — wszystkie /4-VISUALS); Na sklep=BUG (appearance_tags brak w slim) → SLIM_KEYS +brand +appearance_tags; rebuild grid 8901/1761 na_sklep; GC nadal 0 | Kierownik: QA branding ?v=5.0.166

2026-09-07 | sidebar footer 5.0.165: ukryty tytuł DAM, wersja na dole stopki w lewo | OK | dam-shell.js + dam-version.js + dam-brand.css; cache-bust HTML; version.json + runtime_config.py | Weryfikacja wizualna branding/viz

2026-09-07 | P6 re-capture P5 PNGs @ 5.0.164 | PASS vision | branding 153171 B 1610×869; viz 167949 B 1610×869; filter band + card rhythm MATCH viz/branding (vision); P6-verify.md updated | STOP

2026-09-07 | P6 ui-create-design-system: P6-verify + DS spacing tokens | FAIL vision / PASS computed | P5 PNGs 0-byte; live 5.0.164 filter 20×24 + card 10×18×12 MATCH viz/branding; explorer+dashboard link dam-tokens+dam-brand; DESIGN_SYSTEM.md §3 P5 token table | Re-capture P5 PNGs

2026-09-07 | P5 ui-create-design-system: rhythm tokens 5.0.164 | OK | --dam-space-filter/card/toolbar/badge w dam-tokens.css; konsumenci dam-brand/primitives/branding/viz; usunięto padding 2×8 branding chips; .cursor/rules design-system-rhythm | Weryfikacja computed viz vs branding

2026-09-07 | P4 ui-create-design-system: DESIGN_SYSTEM.md v2 + P4-audit | OK | v2: P1-computed-live merged (sidebar 13.6 verified, 4 rhythm exceptions); §5.7 tag-filters; 5 anti-patterns doc-gap only; sandbox STALE/deleted; brak prod CSS | STOP — czeka kierownik

2026-09-07 | git pull (already 5.0.163) + skasowanie poprzedniego DS docs | OK | pull: HEAD=origin/main 050280d; usunięto bin/design-system/{MASTER.md, components/*.md} (7 plików); CSS dam-tokens/dam-brand/dam-primitives nietknięte | Kierownik: weryfikacja

2026-09-04 | release 5.0.163 push+gh release | OK | Unified version 5.0.163; commit mascot+WIZKI+UA lang; gh release v5.0.163 + DAM-Setup.exe | Kierownik: QA

2026-09-04 | WIZKI nested scan + faster watcher (cynamonka/śliwka) | OK | Root cause: `scan_slot_files` flat → `4-WIZKI/INTERNET-PREZENTACJE-RGB` = 0 wizki mimo plikow na D:/M:. Fix: `scan_viz_slot_files` (depth≤4) w build-file-index; watcher interval **5s→2s**, depth **3→5** (arg `--depth` wreszcie uzywany); supervisor/bridge spawn `--interval 2 --depth 5`. Disk: CYNA MINI 6300782 WIZKI=20; SLIWKA MINI 6300784 WIZKI=41 (40 img). Index AFTER: viz **406→438**; 6300782 wizki=20; 6300784 wizki=40. figa: produkty w indeksie, `4-WIZKI` puste na dysku → 0 wynikow = poprawne. Testy NestedVizSlotScan + watch defaults OK. Bez dam-viz.js / jezyk / commit. | Kierownik: push+release

2026-09-04 | v5.0.162 sidebar version once + viz empty Dobrokalorius | OK | dam-version.js syncFooterVersion ukrywa .dam-app-version; dam-shell.js footer bez v-span; visualizations.html + dam-empty-mascot.js?v=5.0.162; dam-brand.css hide footer ver + mascot z-index; version.json/runtime_config 5.0.162; curl 8765=200 | Kierownik: QA visualizations ?v=5.0.162

2026-09-04 | v5.0.161 full reindex + branding auto-hook / ijson | OK | BEFORE grid 2026-09-03/8822 → AFTER **2026-09-04T07:59:17Z / 8842**; file-index **2026-09-04T09:55:28** p191 viz406; POST /index/rebuild + hook branding; bundled ijson + resolve_script_python; grid sys.path fix (cwd desktop); watcher PID **1** (74916); curl 8765/8766=200; falafel+DRUKOWANE=6 | Kierownik: DONE?

2026-09-04 | v5.0.161 branding quiz toolbar + DK/GC tag fix | OK | Quiz przeniesiony do view-tools (#damAssocQuizMount); DK/GC: inferAssetBrand() bo slim grid-index nie ma pola brand (renderTagFilters L2696 disabled); usunięty duplikat appearance:drukowane vs facet:drukowane; mniejszy gap tag-filters | browser branding ?v=5.0.161 — czeka QA

---

## 2026-09-03 — v5.0.159 branding PDF card thumb (kartka FALAFEL)

| Pole | Treść |
|------|--------|
| Wersja | **5.0.159** |
| Przyczyna | `thumbHtml`/`cardThumbSrc` pomijały PDF (fallback DOCUMENT); karta brała `.ai` (br-003435 vector); brak rasteryzacji PDF w `dam_thumb_cache` |
| Fix | `raster_pdf_first_page_jpeg` (pdftoppm/Poppler PATH); `_encode_thumb` PDF; `_media_preview_pdf` w bridge; branding: `pickThumbAsset` preferuje `.pdf`, `thumbPathForAsset`, img dla PDF, `/thumb-cache profile=grid` |
| HTTP | PDF `/thumb-cache` **200** AVIF ~7.5 KB; `.ai` **422** (oczekiwane); `/media?preview=1` PDF **200** JPEG 1712×2400 |
| Browser | falafel + Drukowane: karta FALAFEL `data-path=.pdf`, `img` 1712×2400, brak `.dam-viz-thumb__noviz` DOCUMENT — **PASS** |
| Pliki | `dam_thumb_cache.py`, `local_bridge.py`, `dam-branding.js`, `branding.html`, `version.json`, `dam-version.js`, `runtime_config.py`, test `test_branding_card_thumb_cache.js` |

---

2026-09-03 | v5.0.160 search focus + sidebar version + nav densify | OK | (1) suggest-host na input-wrap + pointer-events branding-chrome; (2) wersja pod #damShellLogout, #damAppVersionPill ukryty; (3) --dam-sidebar-nav-v-compact:0.8 na py/min-h/item-edge | browser branding ?v=5.0.160 | czeka QA

2026-09-03 | dam-grid-reveal.js 5.0.157 zapis | OK | THUMB 1200ms, bez DamLoader.done w timeout; HTML grid-reveal ?v=5.0.157 (9 stron); curl :8765 200; branding 100 kart opacity=1 | PASS smoke

---

## 2026-09-03 — branding 5.0.157: GSAP/opacity + thumb parity viz

| Pole | Treść |
|------|--------|
| „Stopped with error” | Cursor subagent `b073a970` (branding thumbs/click) przerwany `interrupt:true` przez kierownika ~12:38 — nie string w DAM UI; dodatkowo UI :8765 zawieszone (PID 54764, curl HTTP:000) |
| Root cause wizualny | 5.0.156: GSAP `reveal` → karty `opacity:0`; profil thumb `card` zamiast `grid`; hero modal thumb-cache first (łamie PI); absolute popover indeksów; DamLoader.done przy thumb timeout |
| Fix | `cardThumbSrc` → profile=grid; branding bez GSAP reveal kart; hero `/media` first; popover inline; timeout 1.2s; bez DamLoader.done w timeout |
| Wersja | **5.0.157** (`version.json`, `dam-version.js`, `runtime_config.py`, `branding.html ?v=`) |
| QA | Oczekuje Ctrl+F5 + browser 3-pass (kierownik) |

---

## 2026-09-03 — thumb-cache timeout + hero/grid fallback (5.0.156)

| Pole | Treść |
|------|--------|
| Dowód hang | `kulki.png` M-SLI503871: `/thumb-cache` cache-hit `X-Dam-Thumb-Hit:1` mimo to **grid 3045 / 13873 / 1953 ms**; modal ~400 ms; `/media` 440–911 ms (NFS M:) |
| Most | `local_bridge._thumb_cache_with_timeout` 2.5s → HTTP **504** `thumb_timeout` (onerror → `/media`) |
| UI | `dam-media-preview` hero watch 2.5s; `dam-grid-reveal` MutationObserver armThumbLoadTimeout → branding/media fallback + DamLoader.done |
| Testy | unittest 6/6 (`ThumbCacheTimeoutTests` + kulki live) |
| Wersja | **5.0.156** (`version.json`, `dam-version.js`, `runtime_config.py`, HTML `?v=` media-preview/grid-reveal) |
| Bridge | restart `:8766` OK |
| Zakazy | bez dam-branding.js/css redesign; bez fat rebuild; bez structure-mcp; bez commit |

---

## 2026-09-03 — branding klik id + Pokaż indeksy (5.0.156)

| Pole | Treść |
|------|--------|
| Bug | Podgląd karty **kulki** (M-SLI503871) otwierał modal **slider_newsletter_4** (M-SLI505687); `button.dam-viz-card__show-indexes` nie rozwijał listy (CSS `display:none!important` + brak stopPropagation w delegacji) |
| Pliki | `dam-branding.js` (`resolveBrandingClickId`, `openCardModalFromEl(clickId)`, delegacja ignoruje show-indexes, expand `is-expanded`); `dam-branding.css` (wrap widoczny przy `.is-expanded`); `branding.html` `?v=5.0.156` tylko js/css branding |
| Test stat | `node scripts/tests/test_branding_card_click_id.js` — OK |
| Browser 3× | P1 Podgląd kulki → modal **M-SLI503871-07-26** (nie 505687); P2 Pokaż indeksy → `display:flex`, bez modala; P3 klik miniatura kulki → modal 503871 |
| Koordynacja | Nie ruszono tagów hang workera: `dam-media-preview.js` / `dam-grid-reveal.js` ?v=5.0.156 |
| Zakazy | bez media-preview / grid-reveal / local_bridge / version.json; bez commit |

---

## 2026-09-03 — branding blank thumbs + instant klik (5.0.153)

| Pole | Treść |
|------|--------|
| Przyczyna | GSAP `reveal()` ustawiał `opacity:0` na 100/100 kart i tween nie leciał (document.hidden / brak failsafe); fallback miniatur miał `liveUrl:""` zamiast `/media?preview=1` (5.0.152) |
| Pliki | `dam-grid-reveal.js` (pageIsVisible + failsafe 900ms), `dam-branding.js` (cardLiveThumbSrc, fallback parity dam-viz, rAF reveal), HTML `?v=5.0.153`, `version.json`, `dam-version.js`, `runtime_config.py` |
| Browser | [branding 5.0.153](http://127.0.0.1:8765/branding.html?v=5.0.153) — opacity 100/100 kart=1; miniatury cache OK |
| Klik PASS | group +3 thumb M-SLI505686 → modal 0ms; single thumb M-SLI503871 → modal; article + Podgląd → modal |
| Viz regresja | 155 kart opacity OK; klik thumb → `#damVizModal` OK |
| Screenshot | `page-2026-09-03T10-44-47-475Z.png` (siatka), `page-2026-09-03T10-45-49-391Z.png` (modal kulki) |

## 2026-09-03 — branding karty thumb-cache + instant klik (5.0.155)

| Pole | Treść |
|------|--------|
| Przyczyna | Karty `/media` (lag); `openModal` crash: brak `brandingIndexFingerprint` + `global` w `heroSrcFromAsset`; per-karta handlery vs GSAP |
| Pliki | `dam-branding.js`, `dam-media-preview.js`, `dam-branding.css`, HTML `?v=5.0.155` |
| Test stat | `node scripts/tests/test_branding_card_thumb_cache.js` — OK |
| CDP | M-SLI504009 stack: src=thumb-cache; klik→modal ~0–15 ms (2 przeloty) |
| Wersja | 5.0.155 |

## 2026-09-03 — rekonsyliacja worker A (5.0.153) + B (5.0.155)

| Pole | Treść |
|------|--------|
| Audyt | B NIE nadpisał A — oba zestawy poprawek w drzewie; bez edycji kodu |
| A (153) | `dam-grid-reveal.js`: pageIsVisible, failsafe 900ms, killTweensOf, queue przy document.hidden; `dam-branding.js`: cardLiveThumbSrc, rAF×2 reveal |
| B (155) | brandingIndexFingerprint, cardThumbSrc→/thumb-cache, bindBrandingGridDelegation, heroSrcFromAsset→DamPreviewTruth, pointer-events CSS |
| ?v= | branding.html 5.0.155 = version.json; inne HTML grid-reveal 5.0.153 (cache-bust, ten sam plik) |
| Smoke | branding: 159 img op=1, thumb-cache, 0 białych; Podgląd→modal (body dam-media-preview-open); viz: 155 kart op=1 OK |
| Wynik | **PASS** — wersja 5.0.155, bez bump 5.0.156 |

---

## 2026-09-03 — sidebar nav compact −15% (worker intern)

| Pole | Treść |
|------|--------|
| CSS | `dam-tokens.css` (--dam-sidebar-nav-*), `dam-primitives.css`, `dam-brand.css`, `sidebar.css` |
| Skala | font 16→13.6px, padding 10×12→8.5×10.2px, gap 10→8.5px, icon 23→19.55px, min-h 44→37.4px |
| Cache | `?v=5.0.151` na dam-tokens / dam-primitives / dam-brand we wszystkich HTML |
| Wersja | version.json + dam-version.js + runtime_config.py → 5.0.151 |

---

## 2026-09-03 — v5.0.158 reindex + tag Drukowane (kartka FALAFEL)

| Pole | Treść |
|------|--------|
| Wersja | **5.0.158** |
| Przyczyna | `build-branding-index.py` skanował `X:/Marketing` (1 plik w DRUKOWANE) zamiast `D:/Marketing`/`M:/`; kartka FALAFEL tylko w `-- ARCHIWUM --` |
| Fix | `marketing_roots.resolve_marketing_base()` w build-branding-index; tag `Drukowane` z `04 - DRUKOWANE Materiały` (`brand_tag_utils.py`, `build_tags`); facet UI `dam-branding.js` |
| Rebuild | POST `/index/rebuild` rc=0, `file-index.json` generated_at **2026-09-03T14:05:25**; POST `/branding/rebuild` fat OK, grid bridge rc=2 (pythonw bez ijson) — grid odbudowany ręcznie systemowym Pythonem |
| Dowód | `br-003435` path `D:/Marketing/- POLSKA/03 - MATERIAŁY GRAFICZNE/04 - DRUKOWANE Materiały/kartka FALAFEL 2026/…`; tag `Drukowane`; search-index 34× Drukowane; grid 8822, 6× falafel DRUKOWANE |
| UI | branding.html ?v=5.0.158 — chip **Drukowane** w filtrach (snapshot) |

## 2026-09-03 — hotfix branding preview basename drift (kulki / M-SLI503871)

| Pole | Treść |
|------|--------|
| Asset | `M-SLI503871-01-00` — indexed `…/kulki.png`, disk `…/SUCHE/gotowe/kulki.png` |
| Pliki | `apps/desktop/local_bridge.py` (`_resolve_marketing_basename_drift`); test `tests/test_resolve_media_path.py` |
| Curl przed | indexed path: `/thumb-cache` 404, `/media` 404, `file-availability` state=missing |
| Curl po | indexed path: `/thumb-cache` 200 (~8 KB), `/media` 200 (~279 KB), `file-availability` state=local → SUCHE/gotowe |
| Testy | unittest 5/5 OK (marketing drift + revision regression + live kulki) |
| UI | 3 przeloty branding.html: karta obraz 680×340, modal obraz 680×340 — PASS |
| Zakazy | bez fat rebuild; bez branding-index w UI |

## 2026-09-02 — v5.0.148 indeks + search

| Pole | Treść |
|------|--------|
| Wersja | **5.0.148** |
| Pull | `667f7d8` (auth copy + skrypty Synology) |
| Indeks | `generated_at` 2026-09-02T15:37:33; 191 produktów / 408 wizualizacji |
| Search | DamSearch eksport matcher; explorer jeden lot; viz lokalny filtr |
| Zakazy | bez drugiego watchera; bez branding-index.json w UI; bez structure-mcp |

## 2026-08-13 — v5.0.145 biuro

| Pole | Treść |
|------|--------|
| Wersja | **5.0.145** |
| SQLite live | **TYLKO** `bin/DATABASE/dam-local.sqlite` (nie `D:\Marketing\DATABASE`) |
| Seed / dumpy | `bin/DATABASE/users-seed.sqlite`, `dam_eta_*.sql.gz` |
| Merge | pelna baza (users/size) wygrywa z nowsza pusta ~45 KB |
| Dashboard thumbs | AVIF `/thumb-cache` first, potem `/media`; wylaczono `DAM_DISABLE_THUMB_WARM` |
| Branding | boot single-shot; hydrate nie maluje siatki drugi raz |
| Panel | trzeci kafelek „W toku” = produkty bez pliku F / FQ (definicja robocza) |
| Start | `DAM.exe` / `URUCHOM-DAM.bat` — bez instalatora |
| Postgres | NIE przelaczamy; port 5433 do odblokowania w domu |

### Zakaz

- Live DB nie w `{Marketing ROOT}/DATABASE`
- Nie commituj `*.sqlite`, `pg-config.json`, sekretow

---

## 2026-08-12 — sesja biuro (przed domem)

| Pole | Treść |
|------|--------|
| Wersje | **5.0.136** telemetria/db ping → **5.0.137** login email+hasło → **5.0.138** AVIF cache-first → **5.0.139** kill legacy JPG → **5.0.140** handoff Synology |
| Synology Postgres | **NIE DZIAŁA** (stan na 2026-08-12 ~16:45 CEST) |
| Dowód | `inyfinn.synology.me:5433` → TCP refuse/timeout (~2–4 s); `192.168.0.145:5433` → timeout (~4 s) |
| Preferencje lokalne | `bin/apps/desktop/data/db-prefer.json` → `mode=auto`, `synology=true` (gitignored) |
| Config lokalny | `bin/apps/desktop/data/pg-config.json` przywrócony z `.off` (gitignored, hasło lokalnie) |
| Runtime | Aplikacja na **SQLite offline** (`dam-local.sqlite`); po 1. failu PG kolejne `ping` ~4 ms |
| Legacy thumbs | **USUNIĘTE** `bin/apps/web/data/thumbs/*.jpg` (402 plików); UI tylko `/thumb-cache` AVIF q30 |
| Telemetria | `bin/apps/desktop/logs/telemetry-YYYY-MM-DD.jsonl` + daemon health 60 s |
| ROOT | Nietykalny poza buildem `DAM.exe` / `DAM-Setup.exe` (gitignore) |

### Co zrobić w domu (po `git pull`)

1. Zainstaluj najnowszy **DAM-Setup.exe** z GitHub Releases (albo lokalny build).
2. Na routerze / NAS: **port forwarding TCP 5433** → Postgres Synology; sprawdź czy ISP nie daje CGNAT.
3. Test:
   ```powershell
   cd bin\apps\desktop
   python -c "import dam_db, pg_db; dam_db.reset_path_cache(); pg_db.reset_config_cache(); print(dam_db.ping())"
   ```
   Oczekiwane przy sukcesie: `engine=postgres`, `ok=True`, `latency_ms` niski.
4. W UI: źródła bazy → Synology / Auto; Odśwież bazę.
5. Kontynuuj: warm AVIF (`POST /thumb-cache/warm`), indeksowanie przyrostowe, ewentualny dump `DATABASE/`.

### Zakaz commitów (lokalne śmieci)

- `*.sqlite*.bak`, `index-watcher.log`, `user-prefs.json`, `index-rebuild.lock*`, `pg-config.json`, `db-prefer.json`
- NIE usuwać niczego z GIT_ROOT poza świadomym buildem artefaktów

---

*Dopisuj nowe wiersze na końcu tego pliku.*

2026-09-08 | Assoc picker COMBO + materials-only (5.0.172) | OK | visualizations.html: +dam-folder-picker.js +dam-branding.js; dam-assoc-edit: drop vizGroups product rows in material picker, Materiał badge; explorer: hydrateExplorerMarketingMaterials + DamMediaPreview.explorerMarketingRows | CDP viz: DamFolderPicker=true, material picker 13 rows badge=Materiał, COMBO opens no toast; ports 8765/8766=200 | Parent PASS/Fail

## 2026-09-08 16:02 explorer hang 5.0.177
Command: fix explorer intermittent hang
Log: DamSearch r.json 9MB + 9MB fallback + DamLoader overlay; slim fields=explorer; searchOnly on explorer; timeout 8s; Backup statusow UTF-8
Effect: no main-thread full file-index on explorer boot
Backup: none
Test: node --check OK; curl explorer 200 health 200 slim 200; browser forbidden this round
Sources: dam-explorer.js dam-search.js dam-loader.js explorer.html

2026-09-08 5.0.177 probe: curl ex:200 t=0.030 h:200 slim:200 s=512166 t=0.039; dam-browser-probe PASS; playwright NO_PW; Reload1/2/3 n/a; Parent_PASS_recommend:no

2026-09-08 16:16 5.0.177 hardload x3 Chrome headless (Edge present but 0-byte spawn): explorer=200 /health=404; R1/R2/R3 dam-folder-item=40 damFolderList cats=8 Ladowanie=0 ladowanie=0; PNG no overlay tree below 900px fold; Parent_PASS_recommend:no

2026-09-08 5.0.177 click-batony: health8766=200 explorer=200 slim=200/512KB; Playwright Chrome headless click [data-canon-cat=BATONY]; after folder=8 products=555 active=Batony booted=1 overlay=0 pe=auto; PNG explorer-5.0.177-click-batony.png; Click_PASS_recommend:yes

2026-09-09 08:59 P1 Mode A recapture: smoke UI+Bridge 200; slim index 193 products; P1-tokens/rhythm/ownership/computed-live + explorer-p1-live.png 1280x1800; sidebar computed 13.6px; P1_PASS

2026-09-09 P2 Mode A: surgical DESIGN_SYSTEM.md refresh from P0+P1 @ 5.0.178; explorer pad 20px 0px exception; broken-link TRAP gone; §9 untouched; P2-from-evidence.md; P2_PASS

2026-09-09 P5 Mode A recontent: DS §1 per-panel chains + vendor bootstrap + lab ops; §5.4 brand-chip addendum; §5.8 explorer filter skeleton (explorer.html:909-928); §7/§9 cross-refs; P5-recontent.md; no product edits; P5_PASS

2026-09-09 5.0.179 explorer empty tree (presentation): slim JSON OK 193 prod 512166 B 26ms roots=D:/Marketing; TagBar autoMount skipped on explorer; slim parse on main; CATEGORY_CANON skeleton; no Promise.race abandon; boot CSS tree opacity 1. M: detected ok but NOT crawled (slots only; live index is D:). Rebuild not started (no lock; data present). Headless x3 folderItems=8 status="" booted overlay none PNG 1280x1800. PASS vs user stuck Ładowanie+empty Kategorie.

2026-09-09 5.0.180 explorer reload-in-tab: F5 raced window.stop+location.replace (panic-reload.js / inline HTML / shortcuts) vs native reload; single-thread :8765 + dual bind serve_browser+launch.py; SW client.navigate. Fix: native F5 only; ThreadingMixIn+SO_EXCLUSIVEADDRUSE; no SW navigate. Headless same-profile reload x3 folderItems=8 booted overlay none PNG 1280x1800 Read. PASS not localhost-cache.

## 2026-09-09 16:40 5.0.191 tutorial + reindex + AVIF cache wipe
Command: Phase A finish tutorial; B full index rebuild; C wipe thumbs + rebuild AVIF q30
Log: tutorial IIFE `})(window)`; one-sentence copy; revealCarrierForTutorial + PAKIET chip in bubble; POST /index/rebuild via header; wipe `bin/PAMIEC-PODRECZNA/thumbs` then `dam_thumb_cache.enqueue_warm` grid+card
Effect: overlay boots; PAKIET visible on expanded KARTON 6x MINI; index 193 prod / 440 wiz / 13 cats ~34s; cache 601 deleted → 12860 avif / 0 jpg in 538s (14622 jobs)
Backup: thumbs wipe without zip (601 files gone before rebuild)
Test: headed Chrome CDP Page.captureScreenshot PNG 1966x1061; GET /index/status last_ok; GET /thumb-cache/status avif=12860 qlen=0; Read PNGs
Sources: dam-tutorial.js dam-explorer.js dam_thumb_cache.py `_encode_thumb` rebuild-avif-cache-5.0.191.py local_bridge.py start_index_rebuild
Blocked: hover dymek PNG — DOM.focus did not create `#damGlobalTooltip`; click hides tip; no mouse-move CDP


## 2026-09-10 15:06 przejęcie projektu, dokumentacja sesji

### Komenda
Dokumentacja sesji przejęcia z dosłownych słów kierownika (transkrypt czatu), na żądanie właściciela.

### Log
Nowy plik `bin/agents/shared/design-system-2026-09-10/SESJA-2026-09-10-przejecie.md`. Cytaty kierownika, w tym mechanizm zjawy tokenów `?v=` i awaria mostu. Tabela liczb z transkryptu. Błędy workerów i błędy kierownika spisane osobno. Otwarte na koniec sesji: pole szukania w brandingu, duplikaty `-kopia`, dziesięć bramek, ujednolicenie `?v=`, 6.0.0 zablokowane, kontrola wersji na 1 z 39 tras.

### Ostrzeżenie: kolizja zapisu
Około 14:41 dwie strefy pisały równolegle do `bin/apps/desktop/local_bridge.py` (trasa semantyczna 14:33, scalanie zapisów 14:36). Plik mostu został obcięty (~9486 do 8531 linii), most przestał wstawać. **Jeden plik ma jednego pisarza.** Watcher godzinowego zrzutu odtworzony z transkryptu workera, nie z pamięci. Po restarcie: `14:55:49 interval_s=3600.0`. PASS workera po odtworzeniu nie obowiązywał.

### Effect
Dziennik sesji + ten wpis + `process.md` + `PROGRESS.md`. `memory.md` i `code-doctrine.md` nietknięte (kierownik pisał w nich dziś).

### Sources
Transkrypt `daa93ecb-3331-4e8a-90d7-7fc07dc7d057.jsonl`; SESJA-2026-09-10-przejecie.md
