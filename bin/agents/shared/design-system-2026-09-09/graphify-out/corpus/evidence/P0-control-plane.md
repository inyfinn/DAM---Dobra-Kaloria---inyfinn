# P0 Control Plane — DAM Dobra Kaloria

**Capture:** 2026-09-09 08:55 +02:00 (WORKER Composer 2.5, ui-create-design-system Mode A P0 only)  
**GIT_ROOT:** `D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn`  
**CONTENT_ROOT:** `bin`  
**File workspace (channel a):** `bin\apps\web` (served tree; not repo root)

---

## 1. Three channels

| Channel | Mechanism | Status | Evidence (command @ 2026-09-09) |
|---------|-----------|--------|----------------------------------|
| **(a) Files** | Local disk `bin\apps\web` | **proven** | `Test-Path bin\apps\web\assets\css\dam-tokens.css` → **True** |
| **(b) Runtime UI** | Static HTTP `:8765` (`serve_browser.py`) | **UP** | `powershell -File bin\scripts\ops\smoke-dam-ports.ps1` → UI **HTTP 200** 0.014s; `curl.exe -s -o NUL -w "%{http_code}" --max-time 5 http://127.0.0.1:8765/explorer.html` → **200** |
| **(b) Bridge API** | `local_bridge.py` `:8766` | **UP** | smoke → Bridge **HTTP 200** 0.016s; `curl.exe -s --max-time 5 http://127.0.0.1:8766/health` → `{"ok":true,"service":"dam-local-bridge","port":8766,"api_version":9,...}` |
| **(c) MCP / abilities** | WordPress Cursor Bridge | **absent** | Not WordPress. Explorer data = bridge REST (below), not `cursor-bridge/*` abilities. |
| **(c) DAM API (adapted)** | `local_bridge.py` routes | **proven** | See bridge table below. |
| **SSH + CLI** | WP-CLI / remote shell | **absent** | Static HTML + local Python bridge; no server SSH in this stack (per `ops-layer.md` adapt). |
| **Secrets live in** | `bin\apps\desktop\data\`, host MCP config | location only | Never paste values in DS. |

### Bridge routes — explorer data plane

| Route | Role | Evidence |
|-------|------|----------|
| `GET /health` | Liveness, watcher, assoc DB | curl → 200 @ 2026-09-09 |
| `GET /file-index?fields=explorer` | **Slim first paint** — products without `files_by_role` / `wizki` / `viz_latest` | `curl.exe -s --compressed --max-time 8 -H "Accept: application/json" http://127.0.0.1:8766/file-index?fields=explorer` → **HTTP 200**, **46909 B** decompressed, **193 products**, `generated_at=2026-09-09T08:48:12` |
| `GET /file-index/product?id=` | Full product hydration on `openProduct` | Declared `local_bridge.py:52-53` |
| `GET /file-index/viz-latest?…` | Single viz row for thumbs | `local_bridge.py:53-54` |
| `GET /index/status` | Index mtime / postgres sync | `local_bridge.py:54` |
| Static `GET /data/search-index.json` | Tag groups (~491 KB) — **lazy**, not tree | `:8765` → **491513 B** HTTP 200 |

**Note:** Raw `bin\apps\web\data\file-index.json` on disk remains ~9 MB; explorer **must not** parse it on main thread (doctrine §2026-09-08).

---

## 2. Site graph (DAM analogue: chrome vs canvas)

This product is a **graph**, not one open tab. WordPress layout posts → DAM static shell + JS modules.

| Layer | DAM owner | Notes |
|-------|-----------|-------|
| **Winning tokens** | `dam-tokens.css` (`:root` `--dam-*`) | Computes palette, sidebar nav scale, rhythm tokens. Geex aliases mapped at `:30-48`. |
| **Geex realign** | `dam-primitives.css` | Wins sidebar nav over Geex: `.geex-sidebar__menu__link` `:540-547` uses `--dam-sidebar-nav-fs` etc. |
| **Shared chrome** | `dam-brand.css` + `dam-app.css` + `dam-shell-boot.css` | Sidebar, header, `.dam-viz-*` / `.dam-explorer-*`, frozen card anatomy. Boot anti-FOUC: `html.dam-booting` → `dam-booted`. |
| **Chrome (shell)** | Geex sidebar/header HTML in each `*.html` + **`dam-shell.js`** (menu inject) | **GLOBAL** — edit once in shell JS/CSS, not per panel copy. |
| **TRAP chrome** | Geex `style.css` `:376-384` | **16px / 16×25px** nav — loses to `dam-primitives.css` when full stack loads. |
| **Page canvas — Explorer** | `explorer.html` + **`dam-explorer.js`** | Category tree `#damFolderList`, results `#damExplorerMain`, filters `.dam-explorer-secondary-filters`. Style owner: **`dam-brand.css`** (no `dam-explorer.css`). |
| **Page canvas — Branding / Viz** | `branding.html` + `dam-branding.js`; `visualizations.html` + `dam-viz.js` | Panel sheets: `dam-branding.css`, `dam-viz.css`. |
| **i18n** | `assets/js/dam-i18n.js` + `i18n/pl.json` | `data-i18n` keys; UTF-8 gate in doctrine. **Note only** — no Polylang. |
| **Operator chrome** | **none** | No WP admin bar; logged-in = same shell. |
| **Menus** | `dam-shell.js` | Not native WP menus — injected nav items. |
| **Caches** | Browser `?v=` on scripts/CSS; bridge gzip; JSON indexes under `data/` | Cache-bust bump required on every JS/CSS edit. |

### Explorer canonical CSS load order (`explorer.html:16-53`)

```text
dam-shell-boot.css → bootstrap.css → style.css (TRAP) →
dam-tokens.css → dam-primitives.css → dam-app.css → dam-tutorial.css →
dam-brand.css → dam-bento.css → (late) dam-viz-modal.css
```

### Token ladder (winners vs TRAP)

| Sheet | Role |
|-------|------|
| `dam-tokens.css` | Source of `--dam-*`; sidebar nav calc tokens `:77-91` |
| `dam-primitives.css` | Geex button/badge/sidebar realign |
| `dam-brand.css` | Shared grids, cards, explorer toolbar/filters |
| `dam-shell-boot.css` | Boot overlay; explorer ghost-chip guard `:37-40` |
| `style.css` | **TRAP** — 16px sidebar, Poppins `@import`; do not copy as truth |

---

## 3. Existing `DESIGN_SYSTEM.md` vs skill required chapters (§10)

**Path:** `bin/design-system/DESIGN_SYSTEM.md` (v2, captured 2026-09-07, **do not rewrite in P0**).

| Skill chapter | Present in DS? | Gap / note |
|---------------|----------------|------------|
| 1. Control plane | **Yes** §1 | Stale runtime timestamps (2026-09-07); channel (c) listed Browser MCP — DAM should say bridge API **absent** WP. |
| 2. Layer map + prohibitions | **Yes** §2 | Complete; Geex 16px TRAP documented. |
| 3. Token tables | **Yes** §3 | Many cells **unverified** live; computed column thin for page title / body font. |
| 4. Language and fonts | **Yes** §4 | P5 glyph gate **ambiguous** (Jost check vs Poppins computed). |
| 5. Component recipes | **Yes** §5 | Census winners present. |
| 6. Spacing rhythm | **Yes** §6 | Mechanism-first; P1-computed-live referenced. |
| 7. Content architecture | **Yes** §7 | HTML+JS owners; builder = NO. |
| 8. Workflow / ladder | **Yes** §8 | WRONG/RIGHT pairs. |
| 9. Anti-patterns | **Yes** §9 | **Filled** from P3 weak-model (skill v1 wants empty until P3 — this repo already passed P3–P6). **Do not expand in P0.** |
| P6 verification (skill §12) | **Yes** appendix | Desktop 1610×869 only; tablet **unverified**. |

**Missing chapters:** none of the mandatory nine. **Stale:** control-plane timestamps, some computed cells pre-5.0.178 explorer fixes.

---

## 4. Why Explorer failed (2026-09-09 screenshots: empty Kategorie, ghost chips, intermittent)

**Current version:** `bin/apps/web/version.json` → **`5.0.178`**.  
**Shipped in explorer:** `explorer.html:2358` → `dam-explorer.js?v=5.0.178` (also `dam-search.js`, `dam-tag-bar.js`, `dam-grid-reveal.js` @ 5.0.178).

### Timeline — separate root causes

| Version | Symptom | Root cause | Key files |
|---------|---------|------------|-----------|
| **5.0.175** | Whole explorer frozen / no click | `dam-branding.js` on `explorer.html` + `DamLoader` on first paint + `html.dam-booting` `pointer-events:none` | `code-doctrine.md:365-371`; fix: remove branding script, dismiss loader, 400 ms boot unlock |
| **5.0.177** | Hang / empty after reload | **9 MB** `file-index.json` `JSON.parse` on main thread; DamSearch full reload | `code-doctrine.md:373`; fix: `GET /file-index?fields=explorer` + worker parse (`dam-explorer.js:7096-7155`) |
| **5.0.178** | Empty **Kategorie** + **ghost filter chips** (intermittent) | (1) **Blocking meta** — pre-fix `Promise.all(slim, meta)` waited on `product-status` / lifecycle; (2) **search-index stampede** — `DamTagBar` cold `autoMount` ×3 timeouts + ~491 KB `search-index.json`; (3) **GSAP `autoAlpha`** on `.dam-tag-groups` left `opacity:0`; (4) **Watchdog miss** — status in `#damExplorerStatus` (`hidden` when empty), not in `#damExplorerMain`; tree empty = `#damFolderList` without `.dam-folder-item` | See citations below |

### 5.0.178 fix contract (current code)

1. **First paint = slim index only** — `loadExplorerPrimaryIndex` → bridge `?fields=explorer` (`dam-explorer.js:7096-7128`); then `scheduleDeferredSearchIndexLoad` idle (`7063-7081`).
2. **Meta non-blocking** — `withTimeout(loadExplorerMetaLight(), 3000, "meta_timeout")` after bind (`8343-8359`); `loadExplorerMetaLight` = status + carrier + elements only (`7054-7059`).
3. **No DamLoader on init** — comment + `dismissExplorerLoader()` (`8326-8328`).
4. **Watchdog** — 8 s timer checks `explorerFolderEmpty()` on **`#damFolderList`**, not main text (`8330-8336`, `1402-1405`).
5. **GSAP skip on explorer** — `dam-grid-reveal.js:605-617` sets `skipBars` for `explorer.html`.
6. **Ghost cleanup** — `clearExplorerRevealResidue()` kills tweens on `.dam-tag-groups` (`1407-1420`); `dam-shell-boot.css:37-40` forces opacity on booted explorer bars.
7. **Parse guard** — `dam-search.js:44` `MAIN_PARSE_MAX = 1200000`; explorer `responseJsonOffMain` throws if text **> 400000** without worker (`7084-7093`).

### DamTagBar stampede (still relevant on cold cache)

`dam-tag-bar.js` **`autoMount`** at DOMContentLoaded + **120 ms** + **700 ms** (`308-314`) — up to three `loadTagGroups` → `fetch("data/search-index.json")` (`46-68`) before `_DAM_SEARCH_INDEX` warm. Explorer defers `renderTagChips` until after slim index (`8292-8293`, `8361-8366`) but **tag-bar module still self-mounts** early.

---

## 5. P0 exit gate

| Gate | Result |
|------|--------|
| Three channels named | **PASS** — (a) disk, (b) :8765/:8766, (c) bridge API; WP MCP **absent**; SSH **absent** |
| Site graph named | **PASS** — tokens → primitives/brand → panel; chrome vs explorer canvas |
| Explorer cause named | **PASS** — 5.0.175 / 177 / 178 separated with file:line |
| Blunt brief corrections | **PASS** — see §6 |
| Optional screenshot | **FAIL / skipped** — Chrome/Edge headless did not write PNG @ 2026-09-09 (no vision proof this run) |

**Overall P0:** **PASS** (channels + graph + root cause documented; screenshot unverified).

---

## 6. Where the stated findings are WRONG (blunt)

1. **Slim index ~512 KB (LOGI 2026-09-08)** — **Wrong today.** Live `curl --compressed …/file-index?fields=explorer` → **46909 B**, 193 products @ 2026-09-09. Byte count varies with index generation; use dated curl, not memorized 512166.

2. **“Watchdog looked for «Ładowanie indeksu» in empty `#damExplorerMain`”** — **Imprecise for 5.0.178.** Current watchdog (`dam-explorer.js:8330-8335`) tests **`explorerFolderEmpty()`** on `#damFolderList` (no `.dam-folder-item`). Loading text goes to `#damExplorerStatus` (`1394-1399`), which is **`hidden`** when message cleared — so operators saw blank chrome, but the code never searched main innerHTML for that string.

3. **“Promise.all(slim, meta) blocks tree”** — **True for pre-5.0.178 regression; fixed in shipped code.** Init now: slim → `bindExplorerData` → render tree → meta with **3 s cap** (`8343-8359`). `loadAllMeta()` Promise.all still exists (`7199-7205`) but is **not** on first-paint path.

4. **“MAIN_PARSE_MAX 1.2 MB (fallback slim)”** — **Half wrong.** `1_200_000` is in **`dam-search.js:44`**, not explorer. Explorer uses **400000** char guard in `responseJsonOffMain` (`7089-7090`). Slim fallback is bridge retry (`7131-7154`), not a 1.2 MB main-thread parse.

5. **“DamTagBar 3× r.json()”** — **Mechanism overstated.** Three **`autoMount` timers** (`dam-tag-bar.js:308-314`) can triple-fetch on **cold** cache; after first response `_DAM_SEARCH_INDEX` short-circuits (`73-78`). Not three parallel fetches on every load.

6. **Channel (c) = Browser MCP** — **Wrong for DAM P0.** 2026-09-07 DS §1 listed `cursor-ide-browser` as channel (c). This worker forbids Browser MCP (hangs). Adapted channel (c) = **`local_bridge.py` REST**, not WP abilities.

7. **5.0.178 not shipped** — **Wrong if claimed.** `version.json` = 5.0.178; `explorer.html` script `?v=5.0.178` confirmed grep @ 2026-09-09.

8. **Doctrine vs live curl disagree?** — **No.** `:8765` and `:8766` UP; slim index 200 with 193 products. If UI still shows empty Kategorie after **Ctrl+F5** with `?v=5.0.178`, suspect **stale browser cache** (old JS without slim-first path), not bridge down.

---

## Verification log (this run)

```text
2026-09-09 smoke-dam-ports.ps1     → UI 200, Bridge 200
2026-09-09 Test-Path dam-tokens.css → True
2026-09-09 curl explorer.html       → 200
2026-09-09 curl :8766/health        → 200 ok:true api_version:9
2026-09-09 curl file-index?fields=explorer --compressed → 200 46909B products=193
2026-09-09 search-index.json        → 491513 B
2026-09-09 grep explorer.html       → dam-explorer.js?v=5.0.178
2026-09-09 headless screenshot      → FAILED (no PNG)
```

---

*End P0 — Mode A only. No P1–P6. No product edits. No commit.*
