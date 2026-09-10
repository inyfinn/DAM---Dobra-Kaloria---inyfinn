# P0 Control Plane — DAM Dobra Kaloria

**Capture:** 2026-09-07 09:55:53 +02:00 (worker Intern, ui-create-design-system P0)  
**Runtime restart:** 2026-09-07 09:58:38 +02:00 (worker Intern, P0 live channels)  
**GIT_ROOT:** `D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn`  
**File workspace (channel a):** `bin\apps\web` (not repo root; `DAM.exe` / launcher live under `bin\apps\desktop`)

---

## Three channels — status

| Channel | Mechanism | Status | Evidence command / note |
|---------|-----------|--------|-------------------------|
| **(a) Files** | Local disk `bin\apps\web` | **OK** | `Test-Path bin\apps\web\assets\css\dam-tokens.css` → True @ 2026-09-07 09:55:53 +02:00; `style.css` size 294416 bytes |
| **(b) Runtime** | UI `:8765`, bridge `:8766` | **UP** | @ 2026-09-07 09:58:38 +02:00: `curl.exe -sI --max-time 8 http://127.0.0.1:8765/branding.html` → **HTTP/1.0 200 OK**; `curl.exe -s --max-time 8 -o NUL -w "%{http_code}" http://127.0.0.1:8766/health` → **200** (uwaga: `-sI` / HEAD na `/health` → **501** — bridge nie obsługuje HEAD). Procesy w tle: **serve_browser PID 54608** (`bin\runtime\win\python\python.exe` + `serve_browser.py`), **local_bridge PID 44656** (`pythonw.exe` + `local_bridge.py`). Start: `Start-Process bin\runtime\win\python\python.exe -ArgumentList '"...\serve_browser.py"' -WorkingDirectory bin\apps\desktop` |
| **(c) Browser MCP** | `cursor-ide-browser` one page load | **OK (1 screenshot)** | `browser_navigate` → `http://127.0.0.1:8765/branding.html` @ 2026-09-07 09:58:54 +02:00 → title **Branding - DAM**, bez bramki logowania (sesja admin). Screenshot: `branding-p0-2026-09-07.png` **1110×798 px** (jeden kadr, bez retry viewport) |

**Channel (c) abilities / CMS:** **absent — not WordPress.** This stack has no WP Abilities MCP. Runtime API = Python `local_bridge.py` on `:8766` (`GET /health`, CORS for `:8765`). Adapted from `ops-layer.md`: files = CSS/HTML; shell = `launch.py` + Python scripts; API = bridge REST, not CMS.

---

## Stack name (what generates the look)

| Layer | Role |
|-------|------|
| **Static HTML + vanilla JS** | Multi-page app in `bin\apps\web\*.html` + `assets\js\dam-*.js` |
| **Geex admin template** | Bootstrap 5 shell: `assets\vendor\css\bootstrap\`, **`assets\css\style.css`** (~12k lines, from `P:\DAM\THEME\geex-html-main` per `memory.md`) |
| **DAM token + override stack** | **`dam-tokens.css`** → CSS variables; **`dam-primitives.css`** → Geex component realign; **`dam-app.css`** → app chrome; **`dam-brand.css`** → global DAM chrome (sidebar, header, shared grids) |
| **Panel sheets** | **`dam-viz.css`**, **`dam-branding.css`**, **`dam-dashboard.css`**, **`dam-viz-modal.css`**, etc. |
| **Runtime server** | Static UI `:8765` + **`local_bridge.py`** `:8766` (not a CMS) |

**Font:** runtime pages link **Jost** (Google Fonts). Geex `style.css` still `@import`s Lexend/Poppins (decoy / unused for body if later sheets win).

---

## Stylesheet load order (canonical shell pages)

Typical authenticated page (e.g. `branding.html`, `visualizations.html`, `dashboard.html`, `explorer.html`):

1. `assets/vendor/css/bootstrap/bootstrap.css`
2. **`assets/css/style.css`** ← Geex base (TRAP: raw 16px sidebar, Poppins import)
3. **`assets/css/dam-tokens.css`**
4. **`assets/css/dam-primitives.css`**
5. **`assets/css/dam-app.css`**
6. **`assets/css/dam-brand.css`**
7. Panel-specific (see table below)
8. Late: **`dam-viz-modal.css`** on viz / explorer

**Exception — signin:** `signin-geex.html` loads only `style.css` + `dam-brand.css` (no `dam-tokens` / `dam-primitives`).

**HTML grep command:** ripgrep `dam-tokens|dam-primitives|dam-brand|style.css` in `bin\apps\web\*.html` @ 2026-09-07 09:55.

---

## Winning stylesheet candidates vs TRAPs

### Winners (edit these for look)

| Path | Wins for |
|------|----------|
| `bin/apps/web/assets/css/dam-tokens.css` | All `--dam-*` tokens, Geex var mapping (`--primary-color`, surfaces), `--dam-sidebar-nav-*` |
| `bin/apps/web/assets/css/dam-primitives.css` | Sidebar nav size/padding via tokens on `.geex-sidebar__menu__link` |
| `bin/apps/web/assets/css/dam-brand.css` | Sidebar active state, header, shared `.dam-viz-*` / `.dam-explorer-*`, count bubble (`.dam-viz-card__variant-badge`) |
| `bin/apps/web/assets/css/dam-app.css` | Shell layout, Geex customizer tweaks, action stacks |
| `bin/apps/web/assets/css/dam-viz.css` | Visualizations panel only |
| `bin/apps/web/assets/css/dam-branding.css` | Branding panel only (+ shared grid classes) |
| `bin/apps/web/assets/css/dam-dashboard.css` | Dashboard widgets |

### TRAPs (do not treat as source of truth)

| Path / artifact | Why TRAP |
|-----------------|----------|
| **`assets/css/style.css`** | Geex demo: `.geex-sidebar__menu__link { font-size: 16px; padding: 16px 25px; }` (lines ~376–384). Later DAM sheets override **if loaded**. |
| **`assets/css/sidebar.css`** | Duplicate Geex sidebar rules with token vars — **not linked** in any `.html` (grep `sidebar.css` in `bin/apps/web` → 0). Dead fork. |
| **`./assets/css/?v=5.0.152`** | Broken `<link>` on `dashboard.html`, `explorer.html`, `index.html`, `inbox.html` — filename missing (likely lost `dam-accent.css` or similar). 404 at runtime. |
| **`dam-accent.css`** | Loaded only on `settings.html` (accent picker), **not** on main panels. |
| **`P:\DAM\design-system\MASTER.md`** | External doc reference; runtime CSS is under `bin/apps/web/assets/css/`. |
| **structure-mcp** | Product path knowledge only — **not** UI/search DB (`memory.md`). |

### Sidebar 16px decoy — computed winner

| Source | Declared nav `font-size` |
|--------|-------------------------|
| `style.css` `.geex-sidebar__menu__link` | `16px` |
| `dam-tokens.css` `--dam-sidebar-nav-fs` | `calc(16px * 0.85)` → **13.6px** |
| `dam-primitives.css` `.geex-sidebar__menu__link` | `var(--dam-sidebar-nav-fs, 13.6px)` |

**Expected winner (cascade):** **`dam-primitives.css` / token 13.6px** — same selector, loads after `style.css`.  
**Status:** **unverified** — runtime UP, ale brak pomiaru computed `font-size` na sidebar nav (P1).

---

## Panels — which CSS they share

| Panel | HTML | Shared base (all) | Panel-specific | Shared cross-panel classes |
|-------|------|-------------------|----------------|---------------------------|
| **Visualizations** | `visualizations.html` | bootstrap, `style.css`, `dam-tokens`, `dam-primitives`, `dam-app`, `dam-brand`, `dam-tutorial`, `dam-bento` | **`dam-branding.css`**, **`dam-viz.css`**, `dam-viz-modal.css` (footer) | `.dam-viz-grid`, `.dam-viz-grid-toolbar`, `.dam-viz-secondary-filters`, `.dam-explorer-toolbar`, `.dam-viz-zoom-control` |
| **Branding** | `branding.html` | same base | **`dam-branding.css`**, `dam-hub-shared.css`, `dam-assoc-quiz.css`, `dam-date-picker.css` | Same grid/toolbar classes as viz (`.dam-viz-grid`, `.dam-branding-*` extends viz) |
| **Explorer** | `explorer.html` | same base (no `dam-hub-shared`) | **No `dam-viz.css` / `dam-branding.css`** — layout in **`dam-brand.css`** + **`dam-app.css`**; `dam-viz-modal.css` | `.dam-explorer-*`, reused `.dam-viz-grid-toolbar`, `.dam-viz-secondary-filters` |
| **Dashboard** | `dashboard.html` | same base | **`dam-dashboard.css`**, `dam-bento.css` | Geex summary cards + DAM widgets JS |

**No `dam-explorer.css` file exists** — explorer styling lives inside `dam-brand.css` / `dam-app.css` (grep `.dam-explorer` in CSS @ 2026-09-07).

**memory.md rule confirmed:** count bubble global in `dam-brand.css` only; branding/viz must not override (`.dam-viz-card__variant-badge`).

---

## Where common stated findings are WRONG

Blunt corrections for typical misreads (no parent “stated findings” text supplied; from `memory.md` + disk):

1. **“WordPress / MCP cursor-bridge controls the UI”** — **WRONG.** Static Geex HTML in `bin/apps/web`; bridge is **`local_bridge.py`** (filesystem/index/auth), not WP Abilities.
2. **“Repo root CSS / DAM.exe folder is the workspace”** — **WRONG.** Kod = **`bin\`**; web UI = **`bin\apps\web`**.
3. **“Geex `style.css` sets nav to 16px in production”** — **LIKELY WRONG** when full stack loads; **`dam-primitives.css` overrides** to ~13.6px — **needs live verify** (currently unverified).
4. **“Branding and Viz use completely separate CSS with no overlap”** — **WRONG.** Both use **`dam-brand.css`**; **`visualizations.html` also loads `dam-branding.css`**; shared grid/toolbar class names.
5. **“Explorer has its own `dam-explorer.css`”** — **WRONG.** No such file; styles in **`dam-brand.css`**.
6. **“`sidebar.css` is the sidebar token consumer”** — **WRONG.** File exists but is **not linked**; tokens consumed in **`dam-primitives.css`** + **`dam-brand.css`**.
7. **“Broken link `./assets/css/?v=5.0.152` loads accent theme everywhere”** — **WRONG.** Malformed href; **`dam-accent.css`** only on **`settings.html`**.
8. **“structure-mcp is the design/search database for UI tokens”** — **WRONG.** Path/naming knowledge only; indexes are JSON under `bin/apps/web/data/`.

---

## Commands log (repro)

```powershell
# Timestamp
Get-Date -Format "yyyy-MM-dd HH:mm:ss K"

# Channel (a)
Test-Path "...\bin\apps\web\assets\css\dam-tokens.css"

# Channel (b) — @ 2026-09-07 09:58:38 +02:00
curl.exe -sI --max-time 8 http://127.0.0.1:8765/branding.html
curl.exe -s --max-time 8 -o NUL -w "8766 GET %{http_code}`n" http://127.0.0.1:8766/health
# PIDs: serve_browser=54608, local_bridge=44656

# Channel (c) — @ 2026-09-07 09:58:54 +02:00
# browser_navigate http://127.0.0.1:8765/branding.html → 200, screenshot 1110×798 px

# HTML CSS chain
# rg "dam-tokens|dam-primitives|dam-brand|style\.css" bin/apps/web/*.html

# Sidebar decoy
# rg "geex-sidebar__menu__link" bin/apps/web/assets/css/style.css
# rg "dam-sidebar-nav-fs" bin/apps/web/assets/css/dam-tokens.css
```

---

## Exit gate (P0)

| Criterion | Met? |
|-----------|------|
| Channels (a/b/c) answered | Yes — a OK, **b UP**, **c OK (1 screenshot)** |
| Stack + CSS layer named | Yes — static HTML/JS + Geex + DAM token stack |
| No `DESIGN_SYSTEM.md` | Yes |
| No P1 token dump | Yes |

**Next (P1):** computed sidebar `font-size`, token tables, ownership map cross-check.
