# LOGI — DAM Dobra Kaloria (operacyjny)

Format: Data | Akcja | Status | Efekt | Dalej

---

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

2026-09-04 | UA≠EN lang fix 6300763 + Zatwierdź + login_required | OK | naming-dictionary ua→uk usunięty; dam-labels/viz/bridge; test_lang_parse PASS | Czeka Kierownik push
