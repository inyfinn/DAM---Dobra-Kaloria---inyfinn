# P1 Ownership Map — what file generates the look

**Captured:** 2026-09-07T09:58:03+02:00  
**Commands:** `Read bin/apps/web/{branding,visualizations,explorer,dashboard}.html` (link tags); `rg -l "dam-viz|dam-brand|dam-dashboard|sidebar" bin/apps/web/assets/css`; `rg "sidebar\.css" bin/apps/web --glob "*.html"` → **0** links

**Stack (generates look):** Static HTML + vanilla JS → Geex `style.css` → `dam-tokens.css` → `dam-primitives.css` → `dam-app.css` → `dam-brand.css` → panel sheets.

---

## Stylesheet load order (canonical panels)

| Panel | HTML | Load chain (after bootstrap + style.css) |
|-------|------|------------------------------------------|
| **Visualizations** | `visualizations.html` | tokens → primitives → app → tutorial → bento → **brand** → **branding** → **dam-viz** → dam-viz-modal (footer) |
| **Branding** | `branding.html:21-30` | tokens → primitives → app → tutorial → hub-shared → **brand** → **branding** → assoc-quiz → date-picker → bento |
| **Explorer** | `explorer.html:46-52` | tokens → primitives → app → tutorial → **brand** → bento — **no** dam-viz.css / dam-branding.css |
| **Dashboard** | `dashboard.html:36-42` | tokens → primitives → app → **brand** → broken `?v=5.0.152` → **dam-dashboard** → bento |

---

## Section ownership table

| Section | Style owner file(s) | Editable? | Evidence |
|---------|---------------------|-----------|----------|
| **Design tokens** (`--dam-*`) | `dam-tokens.css` | Yes (token source) | `:root` `:6-119`, dark `:121-164` |
| **Geex component realign** (buttons, sidebar nav, badges) | `dam-primitives.css` | Yes | Sidebar nav `:526-533`; badges `:314-382` |
| **Shell layout** (sidebar width, main padding) | `dam-app.css` | Yes | `padding-inline-start` calc `:29-34` |
| **Sidebar chrome** (active state, collapse, version slot) | `dam-brand.css` | Yes | Version hide/show `:3347-3383`; nav active elsewhere in file |
| **Sidebar nav size/padding** | `dam-primitives.css` (wins over Geex) | Yes | Overrides `style.css:376-384` when full stack loads — **computed unverified** |
| **Header / auth chrome** | `dam-brand.css` | Yes | `.geex-content__header__*` from `:101+` |
| **Bento grid rhythm** (`--dam-bento-gap`, `.geex-content:has(#vizGrid)`) | `dam-bento.css` | Yes | `:9-10`, `:361-366` |
| **Viz secondary filters** (`.dam-viz-secondary-filters`) | `dam-brand.css` (base) + `dam-viz.css` (page offsets) | Yes — coordinate both | Base `:3733-3803`; viz mb `:169-171` |
| **Viz grid toolbar** (`.dam-viz-grid-toolbar`) | `dam-brand.css` (grid) + `dam-viz.css` (search-scope/changelog) | Yes — coordinate both | Brand `:3904-3945`; viz `:89-93`, `:184-190` |
| **Viz search scope / admin undo row** | `dam-viz.css` | Yes | `#vizSearchScope` `:18-86` |
| **Branding search + tabs chrome** | `dam-branding.css` | Yes | `.dam-search-wrap--branding-chrome` `:170-223` |
| **Branding tag filters** | `dam-branding.css` (+ badge anatomy from primitives) | Yes | `.dam-branding-tag-filters` `:1153-1203` |
| **Branding status row** | `dam-branding.css` | Yes | `.dam-branding-status-row.dam-viz-grid-toolbar` `:316+` |
| **Explorer toolbar / results** | `dam-brand.css` (no dam-explorer.css) | Yes | `.dam-explorer-*` `:2609+`, `:3948+`, frost `:4319+` |
| **Card anatomy** (`.dam-viz-card`, frozen) | `dam-brand.css` | **Locked** (C3 freeze — layout-only deltas elsewhere) | `:2715-2746`, comment `:2715-2716` |
| **Branding card deltas** (`.dam-branding-card`) | `dam-branding.css` + `dam-hub-shared.css` | Layout-only per freeze | `dam-branding.css:851+`; hub `:17+` |
| **Badge / tag chips** | `dam-primitives.css` (radius 14, padding calc) | Yes | `:310-382`; branding filter override `:1171-1184` |
| **Count bubble** (`.dam-viz-card__variant-badge`) | `dam-brand.css` only | Yes — **do not override** in viz/branding | P0 + `memory.md` rule |
| **Viz modal chrome** | `dam-viz-modal.css` | Yes | Loaded on viz/explorer footers |
| **Dashboard widgets** | `dam-dashboard.css` + `dam-bento.css` | Yes | Dashboard overrides `.geex-content:has(.dam-dash-layout)` `:3-4` |
| **Footer version label** | HTML placeholder + **`dam-version.js`** + **`dam-brand.css`** hide rules | JS sets text; CSS hides footer copy | JS `DAM_APP_VERSION` `:15`; CSS `:3347-3356` hides `.dam-app-version`; sidebar nav item `:3359-3374` |

---

## TRAPs (do not edit for look)

| Artifact | Why TRAP |
|----------|----------|
| `assets/css/style.css` | Geex demo; sidebar 16px `:384`, Lexend/Poppins import |
| `assets/css/sidebar.css` | Duplicate tokenized sidebar — **0 HTML links** |
| `./assets/css/?v=5.0.152` | Broken href on dashboard/explorer/index/inbox |
| `dam-accent.css` | settings.html only |
| External `P:\DAM\design-system\MASTER.md` | Not runtime CSS |

---

## Cross-panel shared classes

| Class | Primary owner | Also loaded on |
|-------|---------------|----------------|
| `.dam-viz-grid` | `dam-brand.css` | viz, branding |
| `.dam-viz-grid-toolbar` | `dam-brand.css` + panel sheet | viz, branding, explorer (reused) |
| `.dam-viz-secondary-filters` | `dam-brand.css` | viz, explorer, branding meta |
| `.dam-viz-card` | `dam-brand.css` | viz, branding (via `.dam-branding-card`) |
| `.dam-explorer-toolbar` | `dam-brand.css` | explorer, branding (`.dam-branding-toolbar`) |

---

## Footer version — split ownership

1. **HTML:** `<span class="dam-app-version">` in `.geex-sidebar__footer__author` (e.g. `branding.html:67`) — static fallback text.
2. **JS:** `dam-version.js:15` → `DAM_APP_VERSION = "5.0.163"`; injects `.dam-nav-version` / `.dam-sidebar-version` in menu.
3. **CSS:** `dam-brand.css:3347-3356` **hides** footer `.dam-app-version`; `:3359-3374` styles sidebar nav version row.

**Visible version location (expected):** sidebar menu item, not footer paragraph — **computed unverified**.
