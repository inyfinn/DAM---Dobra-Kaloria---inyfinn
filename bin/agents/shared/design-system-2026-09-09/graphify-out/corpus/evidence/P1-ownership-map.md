# P1 Ownership Map — stylesheet + copy owners

**Captured:** 2026-09-09 08:59 +02:00  
**Commands:** `Read explorer.html:16-53,627-957`; `Read visualizations.html:43-50`; `rg "sidebar\.css|assets/css/\?" bin/apps/web --glob "*.html"`; `rg "explorer\.|data-i18n" explorer.html dam-explorer.js i18n/pl.json`

**Stack:** Static HTML + vanilla JS → Geex `style.css` → `dam-tokens.css` → `dam-primitives.css` → `dam-app.css` → `dam-brand.css` → panel sheets.

---

## Stylesheet load order (recaptured)

| Panel | HTML lines | Chain (after bootstrap + style.css) |
|-------|------------|-------------------------------------|
| **Explorer** | `explorer.html:48-53` | tokens → primitives → app → tutorial → **brand** → bento — **no** `dam-viz.css` / `dam-branding.css` |
| **Visualizations** | `visualizations.html:43-50` | tokens → primitives → app → tutorial → brand → **branding** → bento → **dam-viz** |

Boot: `dam-shell-boot.css` inline critical + `:16-21` failsafe unlock scripts.

---

## Section ownership (look)

| Section | Style owner | Editable? | Evidence |
|---------|-------------|-----------|----------|
| Design tokens `--dam-*` | `dam-tokens.css` | Yes | `:6-140` light; `:142-185` dark |
| Geex realign (sidebar, badges, buttons) | `dam-primitives.css` | Yes | Sidebar `:540-547`; badges `:314-382` |
| Shared chrome + explorer + card anatomy | `dam-brand.css` | Yes (card **frozen** C3) | Explorer `:2609+`; filters `:3733+`; cards `:2715-2746` |
| Viz page offsets only | `dam-viz.css` | Yes — not card body | Header `:9-10`; filter mb `:169-171` |
| Branding panel deltas | `dam-branding.css` | Yes | Search chrome `:170-223`; tag filters `:1153+` |
| Bento vertical gap | `dam-bento.css` | Yes | `--dam-bento-gap:16px` `:9`; `:361-366` |
| Shell nav injection | **`dam-shell.js`** | Yes | Menu defs `:215-295` |
| i18n overlay | **`dam-i18n.js`** + **`i18n/pl.json`** | Yes | `data-i18n` keys on HTML |

---

## Explorer user-facing copy — string owners

| String / UI | Owner layer | Key / location | Evidence |
|-------------|-------------|----------------|----------|
| Page title **„Eksplorer”** | **i18n** (HTML fallback) | `data-i18n="explorer.title"` → `pl.json:115` | `explorer.html:627` |
| Subtitle (product structure) | **i18n** (HTML fallback mojibake risk) | `explorer.subtitle` → `pl.json:116` UTF-8 canonical | `explorer.html:628` |
| **„Kategorie”** panel heading | **HTML hard-coded** | `explorer.html:934` `<div class="dam-cat-panel__title">` | not in pl.json |
| **„Pokaż wszystkie”** switch | **i18n** | `common.show_all` → `pl.json` | `explorer.html:923` |
| Default empty canvas **„Wybierz kategorię…”** | **JS generated** | `dam-explorer.js` render path (initial `#damExplorerMain`) | vision + JS grep `:4780+` loading states |
| Status-filter empty titles/desc | **i18n + JS** | `explorer.empty_status_*` → `pl.json:306-309`; `renderStatusEmptyCard()` `:4571-4596` | JS wraps i18nText |
| Search empty **„Brak wyników”** + mascot copy | **JS hard-coded** (partial i18n) | `dam-explorer.js:4692-4723` — title/desc/button PL in JS | `branding.clear_filters` i18n for one button only |
| Loading **„Ładowanie indeksu dysku…”** | **JS hard-coded** | `dam-explorer.js:4780` | not i18n key |
| Shell nav labels (Eksplorer, Wizualizacje…) | **JS + i18n** | `dam-shell.js:294-295` `labelKey: nav.explorer` etc. | injected menu |

**Empty-state owner rule:** Explorer uses **shared branding empty components** (`.dam-branding-empty*`, `.dam-empty-mascot-row`) styled in `dam-brand.css` — copy split between **i18n JSON** (status filter) and **dam-explorer.js string literals** (search empty, loading, errors).

---

## Sandbox duplicate-page

**N/A — DAM is static HTML under git.**

- No WordPress duplicate-page / Polylang twin.
- Safe experiment = branch + local `:8765` + `?v=` cache bust on touched assets.
- Blast radius = git diff on `bin/apps/web/**`; no CMS DB.

---

## TRAPs (do not edit for look)

| Artifact | Why |
|----------|-----|
| `assets/css/style.css` | Geex demo; sidebar 16px TRAP `:376-384` |
| `assets/css/sidebar.css` | **0** HTML `<link>` @ 2026-09-09 |
| `./assets/css/?v=*` malformed link | **0** matches in `bin/apps/web` @ 2026-09-09 — **removed** (DS v2 claim “still on index/inbox” is **stale**) |
| `dam-accent.css` | settings-only accent picker |

---

*End P1 ownership — no product edits.*
