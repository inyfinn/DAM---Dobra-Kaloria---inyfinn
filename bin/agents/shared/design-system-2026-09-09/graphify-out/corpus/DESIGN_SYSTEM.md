# DAM Dobra Kaloria — Design System v2

**Version:** 2 (P2 evidence refresh @ **5.0.178**; P6 vision still @ **5.0.164**/**5.0.165** — not re-run 2026-09-09)  
**Captured:** 2026-09-09 (P2 surgical update from P0+P1 evidence)  
**Evidence sources:** `bin/agents/shared/design-system-2026-09-09/P0-control-plane.md`, `P1-tokens.md`, `P1-rhythm-and-widgets.md`, `P1-ownership-map.md`, **`P1-computed-live.md`**; prior P3–P6 @ 2026-09-07 retained where not superseded  
**Runtime status:** `:8765` / `:8766` **UP** @ 2026-09-09T08:55+02:00 — `smoke-dam-ports.ps1` → UI **200**, Bridge **200**; `curl explorer.html?v=5.0.178` → **200**; slim index `GET /file-index?fields=explorer` → **46909 B**, **193 products** (not ~512 KB / 9 MB main-thread parse).

**Evidence hygiene:** File-level token cells refreshed from P1 file read @ 2026-09-09. **Computed live @ 2026-09-09** supersedes only cells in `design-system-2026-09-09/P1-computed-live.md`. Cells verified @ 2026-09-07 but **not** re-probed 2026-09-09 stay **unverified** (do not bump date). Sandbox: **N/A** — static git HTML, no WP duplicate-page.

---

## 1. Control plane

How the next operator reaches this site. No secrets below.

| Channel | Path or command | Status |
|---------|-----------------|--------|
| **(a) File workspace** | `bin\apps\web` (served tree; not repo root) | **proven** — `Test-Path bin\apps\web\assets\css\dam-tokens.css` → True @ 2026-09-09 |
| **(b) Runtime UI** | Static `:8765` via `bin\apps\desktop\launch.py` / `serve_browser.py` | **UP** — `curl.exe explorer.html?v=5.0.178` → **200** @ 2026-09-09; `smoke-dam-ports.ps1` → UI **200** |
| **(b) Bridge API** | `local_bridge.py` `:8766` (`GET /health`, `GET /file-index?fields=explorer`) | **UP** — GET `/health` → **200** `ok:true` @ 2026-09-09; slim index **46909 B**, 193 products |
| **(c) DAM REST (adapted)** | `local_bridge.py` routes — not WP Cursor Bridge | **proven** — explorer data plane via bridge; WP abilities **absent** |
| **CMS / WP Abilities** | — | **absent** — static HTML + Python bridge, not WordPress |
| **Secrets live in** | Machine-local launcher config, gitignored runtime data under `bin\apps\desktop\data\` | location only |

**Stack (generates look):** Static HTML + vanilla JS (`bin\apps\web\*.html`, `assets\js\dam-*.js`) → Bootstrap 5 / Geex `style.css` → DAM token stack → panel sheets.

**Canonical CSS load order (branding panel — copy verbatim; do not guess):** `branding.html:18-30`

```text
Jost (Google Fonts) → bootstrap.css → style.css →
dam-tokens.css → dam-primitives.css → dam-app.css → dam-tutorial.css →
dam-hub-shared.css → dam-brand.css → dam-branding.css → dam-assoc-quiz.css →
dam-date-picker.css → dam-bento.css
```

Boot-only inline: `#dam-shell-boot-critical` + `dam-shell-boot.css` (lines 7-10). **Do not** add sandbox `<style>` blocks for panel chrome — link the winner sheets above.

---

## 2. Layer map + prohibitions

| Layer | Path or panel | Role | Evidence (command / declared) | Status |
|-------|---------------|------|--------------------------------|--------|
| **Token source** | `bin/apps/web/assets/css/dam-tokens.css` | WINNER — all `--dam-*`, Geex alias vars | `rg -n "^  --" dam-tokens.css` @ 2026-09-07 | **source** |
| **Geex realign** | `dam-primitives.css` | WINNER — sidebar nav, buttons, badge anatomy | `.geex-sidebar__menu__link` `:540-547`; `.dam-viz-badge` `:314-382` | **source** |
| **Shared chrome** | `dam-brand.css` | WINNER — card anatomy (frozen), filters, grids, explorer | `.dam-viz-card` `:2717-2746`; `.dam-viz-secondary-filters` `:3733-3754` | **source** |
| **Shell layout** | `dam-app.css` | WINNER — sidebar width, mobile pad | `padding-inline: 1rem` `@ max-width` `:1028-1030` | **source** |
| **Grid rhythm** | `dam-bento.css` | WINNER — `--dam-bento-gap`, `.geex-content:has(#vizGrid)` stack | `:9-10`, `:361-366` | **source** |
| **Viz panel chrome** | `dam-viz.css` | WINNER — page offsets only; **not** card anatomy | header comment `:9-10` | **source** |
| **Branding panel chrome** | `dam-branding.css` | WINNER — search/tabs, tag filters, card deltas | `.dam-search-wrap--branding-chrome` `:170-223` | **source** |
| **Geex base** | `assets/css/style.css` | DECOY — demo sizes, Lexend/Poppins `@import` | `.geex-sidebar__menu__link { font-size: 16px }` `:376-384` | **TRAP — prohibit as truth** |
| **Dead sidebar fork** | `assets/css/sidebar.css` | DECOY — duplicate rules, **not linked** | `rg "sidebar\.css" bin/apps/web --glob "*.html"` → **0** @ 2026-09-09 | **TRAP — prohibit** |
| **Broken link** | `./assets/css/?v=*` | DECOY — malformed empty-filename href (404) | `rg "assets/css/\?" bin/apps/web --glob "*.html"` → **0** @ 2026-09-09 | **TRAP — gone** (all shell pages cleaned; do not restore) |
| **Accent picker only** | `dam-accent.css` | DECOY on main panels — `settings.html` only | P0 @ 2026-09-07 | **TRAP** |
| **External doc** | `P:\DAM\design-system\MASTER.md` | Not runtime CSS | P0 @ 2026-09-07 | **TRAP** |
| **structure-mcp** | Path/naming knowledge | Not UI token DB | `memory.md` | **TRAP for look** |

**Winner rule (one sentence):** For colour, type, spacing, and layout on authenticated panels, **`dam-tokens.css` + later DAM sheets win** over Geex `style.css`; panel-specific offsets live in `dam-viz.css` / `dam-branding.css` but **card anatomy is frozen in `dam-brand.css`**, not `dam-viz.css`.

### TRAP — Geex `style.css` sidebar nav 16px

Looks like production nav is 16px / 16×25px pad because Geex declares it on `.geex-sidebar__menu__link`. **Loses** when full stack loads: `dam-tokens.css` sets `--dam-sidebar-nav-fs: calc(16px * 0.85)` → **13.6px** and `dam-primitives.css:540-547` applies token vars on the same selector after `style.css`.

**Prohibition:** Do not copy Geex 16px nav as design truth. Edit `--dam-sidebar-nav-*` in `dam-tokens.css` or overrides in `dam-primitives.css`. **Computed verified** @ 2026-09-09 — `13.6px` fs, padding **`6.8×10.2px`**, lh `20.4px`, gap `8.5px`, radius `15.3px` on `explorer.html?v=5.0.178` (`design-system-2026-09-09/P1-computed-live.md`; Playwright `getComputedStyle`).

```text
WRONG: /* style.css truth */ .geex-sidebar__menu__link { font-size: 16px; padding: 16px 25px; }
RIGHT: /* token + primitives — live */ font-size: 13.6px; padding: 6.8px 10.2px; /* dam-primitives.css:540-547 */
```

### TRAP — `sidebar.css` as token owner

File exists with tokenized sidebar rules but **zero HTML `<link>`** references. Real consumer: **`dam-primitives.css` + `dam-brand.css`**.

```text
WRONG: Edit assets/css/sidebar.css for nav spacing.
RIGHT: Edit dam-tokens.css (--dam-sidebar-nav-*) and dam-primitives.css (.geex-sidebar__menu__link).
```

### TRAP — malformed `./assets/css/?v=*` (historical)

Empty-filename `<link>` on several shell pages — 404 at runtime; filename lost (P0: not `dam-accent.css`, which is settings-only). **Gone @ 2026-09-09:** `rg "assets/css/\?" bin/apps/web --glob "*.html"` → **0** matches (`P1-ownership-map.md`).

```text
WRONG: <link rel="stylesheet" href="./assets/css/?v=5.0.152">
RIGHT: Delete the broken line (no real sheet to restore). All shell pages clean @ 2026-09-09 — do not reintroduce.
```

### TRAP — card anatomy in `dam-viz.css`

`dam-viz.css:9-10` states card anatomy **does not** live there. Owner: **`dam-brand.css:2715-2746`** (C3 freeze).

```text
WRONG: /* dam-viz.css */ .dam-viz-card__body { padding: 12px 16px; }
RIGHT: /* dam-brand.css — frozen vars */ padding: var(--dam-viz-card-body-pad-top) var(--dam-viz-card-body-pad-x) var(--dam-viz-card-body-pad-bottom); /* 10px 18px 12px */
```

### Doctrine — UTF-8 only (PL copy)

**All user-facing Polish text is UTF-8 end-to-end.** No U+FFFD (`�`), no `?`-as-diacritic, no Windows-1250 saves.

| Layer | Rule | Evidence |
|-------|------|----------|
| **Source files** | Save HTML/JS/JSON as **UTF-8** (no BOM preferred). Python: `open(..., encoding="utf-8")`. | `fix-utf8-mojibake.py`, `scan-utf8-mojibake.py` |
| **i18n overlay** | User-facing strings on panels → `data-i18n` / `data-i18n-tip` keys in `i18n/pl.json` (canonical). HTML fallback must still be valid UTF-8. | `dam-i18n.js` boot contract; e.g. `common.show_all` = **Pokaż wszystkie** @ 5.0.167 |
| **HTTP serve** | `dam_ui_http.py` → `text/html; charset=utf-8`, JS/CSS/JSON append `; charset=utf-8`. | `serve_browser.py` → `make_handler_class` |
| **CI guard** | `test_i18n_utf8.py`: pl.json has Pokaż; viz/explorer wired; panel HTML ban U+FFFD. | `bin/apps/desktop/tests/test_i18n_utf8.py` |

```text
WRONG: <span class="dam-switch__label">Poka� wszystkie</span>  (hard-coded mojibake)
RIGHT: <span class="dam-switch__label" data-i18n="common.show_all">Pokaż wszystkie</span>
       + pl.json "common.show_all": "Pokaż wszystkie"
       + label data-i18n-tip="viz.show_all_tip" for Włącz/Wyłącz tooltip
```

**Prohibition:** Do not patch mojibake with font-family swaps or CSS `content:` hacks — fix encoding + i18n source.

---

## 3. Token tables

Command for all `:root` tokens: `rg -n "^  --" bin/apps/web/assets/css/dam-tokens.css` @ 2026-09-09T08:59+02:00 (`design-system-2026-09-09/P1-tokens.md`).  
**Computed column:** probed @ 2026-09-09 via Playwright on `explorer.html?v=5.0.178` + `visualizations.html?v=5.0.178` (`P1-computed-live.md`) — sidebar nav, explorer/viz filter bands, explorer toolbar, viz card body. **Not re-probed 2026-09-09:** bento gap, branding filter band, badge pills, glyph gate — remain **unverified** (2026-09-07 claims not copied forward).

### Colour — brand & status (`:root` light)

| Token | Value | Source | Command | Captured |
|-------|-------|--------|---------|----------|
| `--dam-brand-green` | `#008244` | `dam-tokens.css:12` | `rg -n "^  --" dam-tokens.css` | 2026-09-07 |
| `--dam-primary` | `#AB54DB` | `dam-tokens.css:13` | same | 2026-09-07 |
| `--primary-color` | `var(--dam-primary, #AB54DB)` | `dam-tokens.css:14` | same | 2026-09-07 |
| `--dam-dark` | `#17161E` | `dam-tokens.css:15` | same | 2026-09-07 |
| `--dam-ok` | `#00b074` | `dam-tokens.css:18` | same | 2026-09-07 |
| `--dam-warn` | `#ffbb54` | `dam-tokens.css:19` | same | 2026-09-07 |
| `--dam-danger` | `#ff5b5b` | `dam-tokens.css:20` | same | 2026-09-07 |
| `--info-color` | `#5B8DEF` | `dam-tokens.css:23` | same | 2026-09-07 |

### Colour — surfaces (light)

| Token | Value | Source | Command | Captured |
|-------|-------|--------|---------|----------|
| `--dam-surface` | `#ffffff` | `dam-tokens.css:26` | same | 2026-09-07 |
| `--dam-surface-muted` | `#f5f6fa` | `dam-tokens.css:27` | same | 2026-09-07 |
| `--dam-border` | `#ececf2` | `dam-tokens.css:28` | same | 2026-09-07 |

### Colour — Geex overlay aliases (light)

| Token | Value | Source | Command | Captured |
|-------|-------|--------|---------|----------|
| `--white-color` | `var(--dam-surface)` | `dam-tokens.css:31` | same | 2026-09-07 |
| `--section-color` | `var(--dam-surface-muted)` | `dam-tokens.css:32` | same | 2026-09-07 |
| `--sectionTwo-color` | `var(--dam-surface-muted)` | `dam-tokens.css:33` | same | 2026-09-07 |
| `--sectionThree-color` | `var(--dam-surface)` | `dam-tokens.css:34` | same | 2026-09-07 |
| `--gray-color` | `var(--dam-border)` | `dam-tokens.css:35` | same | 2026-09-07 |
| `--body-color` | `var(--dam-text)` | `dam-tokens.css:36` | same | 2026-09-07 |
| `--desc-color` | `var(--dam-text)` | `dam-tokens.css:37` | same | 2026-09-07 |
| `--sec-color` | `var(--dam-text-muted)` | `dam-tokens.css:38` | same | 2026-09-07 |
| `--dark-color` | `var(--dam-dark)` | `dam-tokens.css:39` | same | 2026-09-07 |
| `--success-color` | `var(--dam-ok)` | `dam-tokens.css:40` | same | 2026-09-07 |
| `--warning-color` | `var(--dam-warn)` | `dam-tokens.css:41` | same | 2026-09-07 |
| `--danger-color` | `var(--dam-danger)` | `dam-tokens.css:42` | same | 2026-09-07 |
| `--primary-color-transparent` | `color-mix(in srgb, var(--dam-primary) 15%, transparent)` | `dam-tokens.css:43` | same | 2026-09-07 |
| `--success-color-transparent` | `color-mix(..., 15%, transparent)` | `dam-tokens.css:44` | same | 2026-09-07 |
| `--warning-color-transparent` | `color-mix(..., 15%, transparent)` | `dam-tokens.css:45` | same | 2026-09-07 |
| `--danger-color-transparent` | `color-mix(..., 15%, transparent)` | `dam-tokens.css:46` | same | 2026-09-07 |
| `--info-color-transparent` | `color-mix(..., 15%, transparent)` | `dam-tokens.css:47` | same | 2026-09-07 |
| `--dark-color-transparent` | `color-mix(..., 15%, transparent)` | `dam-tokens.css:48` | same | 2026-09-07 |

### Typography tokens

| Token | Value | Source | Command | Captured |
|-------|-------|--------|---------|----------|
| `--dam-font` | `"Jost", sans-serif` | `dam-tokens.css:51` | same | 2026-09-07 |
| `--dam-text` | `#464255` | `dam-tokens.css:52` | same | 2026-09-07 |
| `--dam-text-muted` | `#8f8b9f` | `dam-tokens.css:53` | same | 2026-09-07 |
| `--dam-muted` | `var(--dam-text-muted)` | `dam-tokens.css:54` | same | 2026-09-07 |
| `--dam-fs-xs` | `11px` | `dam-tokens.css:57` | same | 2026-09-07 |
| `--dam-fs-sm` | `12px` | `dam-tokens.css:58` | same | 2026-09-07 |
| `--dam-fs-md` | `13px` | `dam-tokens.css:59` | same | 2026-09-07 |
| `--dam-fs-base` | `14px` | `dam-tokens.css:60` | same | 2026-09-07 |
| `--dam-fs-lg` | `16px` | `dam-tokens.css:61` | same | 2026-09-07 |
| `--dam-fs-xl` | `22px` | `dam-tokens.css:62` | same | 2026-09-07 |
| `--dam-tag-fs-pill` | `10.5px` | `dam-tokens.css:65` | same | 2026-09-07 |
| `--dam-tag-fs-badge` | `14px` | `dam-tokens.css:66` | same | 2026-09-07 |
| `--dam-badge-scale` | `1.05` | `dam-tokens.css:68` | same | 2026-09-07 |

### Typography roles (cascade — thin P1 evidence)

| Role | family | weight | size | line-height | source | Status |
|------|--------|--------|------|-------------|--------|--------|
| body (token default) | `"Jost", sans-serif` | unverified | unverified | unverified | `--dam-font` `dam-tokens.css:51` | **unverified** live |
| card title | inherit / `--dam-font` | 600 | `var(--dam-fs-base, 14px)` | unverified | `dam-brand.css:2751-2752` | declared only |
| page title (`h2.geex-content__header__title`) | unverified | 600 | **32px** (Geex) | 48px | `style.css:2135-2138` | **TRAP — computed unverified**; no P1 DAM override captured |
| button (`.geex-btn`) | inherit | 500 | inherit | unverified | `dam-primitives.css:13-27` | declared only |
| meta filter band | inherit | 500 | `12px` via `--dam-viz-meta-fs` | unverified | `dam-brand.css:3734,3751` | declared only |

**Blunt:** P1 is **too thin** for a full typography role table. Only token definitions and a few component rules are sourced. Do not invent body 14px or page-title DAM sizes without live computed probe.

### Controls

| Token | Value | Source | Command | Captured |
|-------|-------|--------|---------|----------|
| `--dam-control-h` | `44px` | `dam-tokens.css:73` | `rg -n "^  --" dam-tokens.css` | 2026-09-09 |
| `--dam-control-fs` | `12px` | `dam-tokens.css:74` | same | 2026-09-09 |
| `--dam-control-radius` | `8px` | `dam-tokens.css:75` | same | 2026-09-09 |
| `--dam-control-h-sm` | `36px` | `dam-tokens.css:108` | same | 2026-09-09 |

### Sidebar nav tokens

| Token | Value | Source | Command | Captured |
|-------|-------|--------|---------|----------|
| `--dam-sidebar-nav-scale` | `0.85` | `dam-tokens.css:78` | same | 2026-09-09 |
| `--dam-sidebar-nav-v-compact` | `0.8` | `dam-tokens.css:79` | same | 2026-09-09 |
| `--dam-sidebar-nav-fs` | `calc(16px * 0.85)` → **13.6px** | `dam-tokens.css:80` | Playwright `getComputedStyle` `.geex-sidebar__menu__link` | 2026-09-09 **verified** |
| `--dam-sidebar-nav-lh` | `calc(24px * 0.85)` → **20.4px** live | `dam-tokens.css:81` | Playwright computed | 2026-09-09 **verified** |
| `--dam-sidebar-nav-py` | `calc(10px * 0.85 * 0.8)` → **6.8px** live | `dam-tokens.css:82` | Playwright computed | 2026-09-09 **verified** |
| `--dam-sidebar-nav-px` | `calc(12px * 0.85)` → **10.2px** live | `dam-tokens.css:83` | Playwright computed | 2026-09-09 **verified** |
| `--dam-sidebar-nav-gap` | `calc(10px * 0.85)` → **8.5px** live | `dam-tokens.css:84` | Playwright computed | 2026-09-09 **verified** |
| `--dam-sidebar-nav-icon-fs` | `calc(23px * var(--dam-sidebar-nav-scale))` | `dam-tokens.css:83` | same | 2026-09-07 |
| `--dam-sidebar-nav-icon-nudge` | `1px` | `dam-tokens.css:84` | same | 2026-09-07 |
| `--dam-sidebar-nav-item-edge` | `calc(15px * … * v-compact)` | `dam-tokens.css:85` | same | 2026-09-07 |
| `--dam-sidebar-nav-min-h` | `calc(56px * var(--dam-sidebar-nav-v-compact))` | `dam-tokens.css:86` | same | 2026-09-07 |
| `--dam-sidebar-nav-active-inset` | `calc(8px * … * v-compact)` | `dam-tokens.css:87` | same | 2026-09-07 |
| `--dam-sidebar-nav-radius` | `calc(18px * var(--dam-sidebar-nav-scale))` | `dam-tokens.css:88` | same | 2026-09-07 |
| `--dam-sidebar-nav-logout-mt` | `calc(50px * var(--dam-sidebar-nav-v-compact))` | `dam-tokens.css:89` | same | 2026-09-07 |

### Radius

| Token | Value | Source | Command | Captured |
|-------|-------|--------|---------|----------|
| `--dam-radius-lg` | `24px` | `dam-tokens.css:95` | same | 2026-09-07 |
| `--dam-radius-md` | `12px` | `dam-tokens.css:96` | same | 2026-09-07 |
| `--dam-radius-sm` | `8px` | `dam-tokens.css:97` | same | 2026-09-07 |
| `--dam-radius-btn` | `18px` | `dam-tokens.css:98` | same | 2026-09-07 |
| `--dam-radius-btn-compact` | `8px` | `dam-tokens.css:107` | same | 2026-09-07 |
| `--_dam-badge-radius` | `14px` | `dam-primitives.css:322` | `Read dam-primitives.css` | 2026-09-07 |

### Space — rhythm tokens (P5 @ **5.0.164**)

| Token | Value | Source | Consumer | Captured |
|-------|-------|--------|----------|----------|
| `--dam-space-filter-pad-y` | `20px` | `dam-tokens.css:112` | `.dam-viz-secondary-filters` → `dam-brand.css:3740-3742` | 2026-09-09 |
| `--dam-space-filter-pad-x` | `24px` | `dam-tokens.css:113` | same — **explorer shell zeros horizontal** (`dam-brand.css:4445-4449`) | 2026-09-09 |
| `--dam-space-filter-gap-row` | `10px` | `dam-tokens.css:114` | same | 2026-09-09 |
| `--dam-space-filter-gap-col` | `12px` | `dam-tokens.css:115` | same | 2026-09-09 |
| `--dam-space-filter-mb` | `12px` | `dam-tokens.css:116` | token default — explorer uses **14px** hardcode (`dam-brand.css:3808-3809`) | 2026-09-09 |
| `--dam-space-filter-nested-mb` | `4px` | unverified in P1-2026-09-09 | nested viz search block | **unverified** |
| `--dam-space-card-body-pad-top` | `10px` | `dam-tokens.css:118` | `.dam-viz-card__body` → `dam-brand.css` | 2026-09-09 |
| `--dam-space-card-body-pad-x` | `18px` | `dam-tokens.css:119` | same | 2026-09-09 |
| `--dam-space-card-body-pad-bottom` | `12px` | `dam-tokens.css:120` | same | 2026-09-09 |
| `--dam-space-card-body-gap` | `13px` | `dam-tokens.css:121` | same — **computed viz** @ 2026-09-09 | 2026-09-09 **verified** (viz only) |
| `--dam-space-toolbar-row-gap` | `8px` | `dam-tokens.css:122` | `.dam-viz-grid-toolbar` → `dam-brand.css:3907-3909` | 2026-09-09 |
| `--dam-space-toolbar-col-gap` | `14px` | `dam-tokens.css:123` | same — **computed explorer** @ 2026-09-09 | 2026-09-09 **verified** (explorer) |
| `--dam-space-toolbar-mb` | `12px` | `dam-tokens.css:124` | same — **computed explorer** @ 2026-09-09 | 2026-09-09 **verified** (explorer) |
| `--dam-space-toolbar-stack-offset` | `12px` | `dam-tokens.css:123` | toolbar stack context | 2026-09-07 |
| `--dam-space-toolbar-nested-mb` | `5px` | `dam-tokens.css:124` | branding status row | 2026-09-07 |

### Space (CTA — button pads)

| Token | Value | Source | Command | Captured |
|-------|-------|--------|---------|----------|
| `--dam-space-btn-y` | `15px` | `dam-tokens.css:101` | same | 2026-09-07 |
| `--dam-space-btn-x` | `25px` | `dam-tokens.css:102` | same | 2026-09-07 |
| `--dam-space-btn-sm-y` | `8px` | `dam-tokens.css:104` | same | 2026-09-07 |
| `--dam-space-btn-sm-x` | `14px` | `dam-tokens.css:105` | same | 2026-09-07 |
| `--dam-bento-gap` | `16px` | `dam-bento.css:9` | `Read dam-bento.css` | 2026-09-07 |
| `--dam-bento-gap-sm` | `12px` | `dam-bento.css:10` | same | 2026-09-07 |

**Note:** P5 added named rhythm tokens above; still no arbitrary global spacing ladder. Panel rhythm = bento gap + these component tokens (consumed in `dam-brand.css`, panel offsets in `dam-viz.css` / `dam-branding.css`).

### Shadow & motion

| Token | Value | Source | Command | Captured |
|-------|-------|--------|---------|----------|
| `--dam-shadow-rgb` | `23 22 30` | `dam-tokens.css:129` | `rg -n "^  --" dam-tokens.css` | 2026-09-07 |
| `--dam-shadow-alpha` | `0.08` (light) | `dam-tokens.css:130` | same | 2026-09-07 |
| `--dam-shadow` | `0 10px 30px rgb(var(--dam-shadow-rgb) / var(--dam-shadow-alpha))` | `dam-tokens.css:131` | same | 2026-09-07 |
| `--dam-anim-hover` | `0.22s` | `dam-tokens.css:134` | same | 2026-09-07 |
| `--dam-anim` | `0.4s` | `dam-tokens.css:135` | same | 2026-09-07 |
| `--dam-anim-slow` | `0.55s` | `dam-tokens.css:136` | same | 2026-09-07 |
| `--dam-anim-ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | `dam-tokens.css:137` | same | 2026-09-07 |
| `--dam-btn-outline-border` | `color-mix(in srgb, var(--dam-primary) 50%, transparent)` | `dam-tokens.css:92` | same | 2026-09-07 |

### Dark scheme (`html[data-theme="dark"]`)

| Token | Value | Source | Command | Captured |
|-------|-------|--------|---------|----------|
| `--dam-surface` | `#201f28` | `dam-tokens.css:146` | same | 2026-09-09 |
| `--dam-surface-muted` | `#17161e` | `dam-tokens.css:147` | same | 2026-09-09 |
| `--dam-border` | `#2c2b36` | `dam-tokens.css:148` | same | 2026-09-09 |
| `--dam-text` | `#eeeaf6` | `dam-tokens.css:150` | same | 2026-09-09 |
| `--dam-text-muted` | `#b8b3c6` | `dam-tokens.css:152` | same | 2026-09-09 |
| `--dam-shadow-alpha` | `0.35` | `dam-tokens.css:154` | same | 2026-09-09 |
| `--dam-dark` | unverified line in P1-2026-09-09 | — | same | **unverified** |
| `--dam-surface-elevated` | `#2a2833` | `dam-tokens.css:157` | same | 2026-09-09 |
| `--gray-color` | `#d2cedc` (not aliased to border) | `dam-tokens.css:167` | same | 2026-09-09 |

---

## 4. Language and fonts

Loaded families from P1/HTML evidence. **P5 glyph gate** probed @ 2026-09-07T10:23+02:00 via CDP on `branding.html?v=5.0.165`.

| Family | Loaded from | Roles | Glyph probe | Result |
|--------|-------------|-------|-------------|--------|
| `"Jost", sans-serif` | Google Fonts `<link>` on panel pages (e.g. `branding.html:18`); token `--dam-font` `dam-tokens.css:51` | App body, controls, cards (via inherit) | CDP `document.fonts.check('16px Jost', ch)` for **ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ** | **check=true all 18** — but Jost faces report **`unloaded`** in `document.fonts`; computed body/card still **Poppins** (Geex TRAP). **Ambiguous — recontent gate unverified** |
| `'Lexend', 'Poppins'` | `@import` in `style.css:14` | Geex demo defaults | — | **Wins on body/card title live** @ probe — **TRAP** until `--dam-font` consumer proven |
| `unicons-line` | CDN `@iconscout/unicons` (e.g. `branding.html:32`) | Icon font for `.uil` | — | **not run** |

**Dead / decoy font files:** Lexend and Poppins imported by Geex `style.css` and `content.css` — **`content.css` not in canonical panel load chain** (P0). Do not assign copy or UI to Poppins without proving cascade.

### P5 gate — Polish glyph coverage (Jost)

**Target chars:** ą ć ę ł ń ó ś ź ż (and capitals).  
**Method:** CDP on live `:8765/branding.html?v=5.0.165` after navigate; `document.fonts.check('16px Jost', ch)` per char; `await document.fonts.ready` follow-up.  
**Verdict:** Isolated `fonts.check` passes for all 18 chars, but **live computed** `body` and `.dam-viz-card__title` = **`Poppins, sans-serif`**; zero Jost faces in `loaded` state at probe time. **Do not swap fonts.** Recontent into Polish is **not accepted** until a named UI node with `--dam-font` applied proves Jost (not Poppins) renders copy containing ąćęłńóśźż without mid-word fallback.

### P5 gate — Polish microtypography bind list (not swept)

Mandatory one-letter binds: `a i o u w z` (+ capitals). Recommended in headings: `do na od po za ze we ku bez dla nad pod nie`. French-style rules N/A. **Sweep status:** **not run** — no orphan count reported.

---

## 5. Component recipes

Census from CSS declaration counts @ 2026-09-07 (`rg -c` / selector hits in P1). Only winners (count ≫ 1 or cross-panel shared).

### 5.1 `.dam-viz-card` + `.dam-viz-card__body` (census: **80** CSS hits in `dam-brand.css`; JS renders in `dam-viz.js`, `dam-branding.js`)

**Forbidden equivalent:** Bootstrap card, Geex summary card without DAM classes, restyling in `dam-viz.css`.

**Tokens:** `--dam-radius-md`, `--dam-border`, `--dam-surface`, `--dam-viz-card-body-pad-*`, `--dam-viz-card-body-gap`, `--dam-fs-base`, `--dam-text`.

```html
<!-- WRONG: panel sheet overrides frozen anatomy -->
<!-- dam-viz.css --> .dam-viz-card__body { padding: 16px; gap: 8px; }

<!-- RIGHT: clone existing card; deltas only in dam-branding.css for .dam-branding-card -->
<article class="dam-viz-card dam-branding-card">
  <div class="dam-viz-card__body">
    <h3 class="dam-viz-card__title">…</h3>
  </div>
</article>
<!-- Live DOM: body class is .dam-viz-card__body — NOT .dam-branding-card__body -->
```

### 5.2 `.dam-viz-secondary-filters` (census: **30** hits `dam-brand.css`, **8** `dam-viz.css`; HTML on viz/branding/explorer)

**Forbidden equivalent:** Ad-hoc filter row with random padding; copying Geex form-group spacing.

**Tokens:** `--dam-border`, `--dam-text`, `--dam-viz-meta-fs` (12px local), `--dam-bento-gap` for stack context.

```html
<!-- WRONG: new panel-only class with 8px 12px pad (old pre-bump values) -->
<div class="my-filters" style="padding: 8px 12px">…</div>

<!-- RIGHT -->
<div class="dam-viz-secondary-filters dam-branding-filters" role="group">…</div>
<!-- dam-brand.css:3740-3743 → gap 10px 12px; padding 20px 24px -->
```

### 5.3 `.dam-viz-grid-toolbar` (census: shared on viz/branding/explorer; base `dam-brand.css:3904+`)

**Declared (dam-brand.css:3904-3911):** `column-gap: 14px`; `row-gap: 8px`; base `margin: 0 0 12px`.

**Computed live (context-dependent — do not copy one margin everywhere):**

| Context | Computed margin | Source |
|---------|-----------------|--------|
| Viz top-level toolbar | `0px` | nested in `.dam-global-search-block` |
| Branding status row | **`-4px 0px 5px`** | `dam-branding.css:312-317` offsets bento gap |

**Tokens:** `--dam-text`, `--dam-bento-gap` (branding margin calc uses it).

```html
<!-- WRONG: duplicate status row markup without toolbar class -->
<div id="status"><span>…</span></div>

<!-- WRONG: generic gap: 10px on toolbar — misses row 8 / column 14 split -->
<div class="dam-viz-grid-toolbar" style="gap: 10px">…</div>

<!-- RIGHT -->
<div class="dam-viz-grid-toolbar dam-branding-grid-toolbar dam-branding-status-row">
  <div class="dam-toolbar-status" aria-live="polite">…</div>
</div>
<!-- dam-brand.css:3908-3909 → row-gap 8px, column-gap 14px -->
```

### 5.4 `.dam-viz-badge` / `.dam-badge-tag` (census: **49** hits `dam-primitives.css`; JS via `dam-badges.js`)

**Forbidden equivalent:** `border-radius: 999px` from legacy `dam-brand.css` chip rules; Bootstrap badge.

**Tokens:** `--dam-badge-scale`, `--dam-tag-fs-pill`, `--dam-tag-fs-badge`, `--_dam-badge-radius` (14px).

```html
<!-- WRONG: literal pill in branding filter context fighting primitives -->
<span class="dam-viz-badge" style="padding: 2px 8px; border-radius: 999px">tag</span>

<!-- RIGHT -->
<button type="button" class="dam-viz-badge dam-badge-tag">tag</button>
<!-- dam-primitives.css:337 — calc(2px*scale) calc(8px*scale); live 2.1×8.4px @ scale 1.05; radius 14px -->
```

**Live winner:** Primitives calc **wins** on tag-filter chips — computed **`2.1px 8.4px`**, radius **14px** @ 2026-09-07 only — **not re-probed 2026-09-09** (**unverified**). Declared `dam-branding.css:1179` literal `2px 8px` does **not** override in live cascade (2026-09-07 claim).

### 5.5 `.geex-sidebar__menu__link` (compact nav — census: canonical in `dam-primitives.css:540-547`)

**Forbidden equivalent:** Geex `style.css` 16px / 16×25px; editing `sidebar.css`.

**Tokens:** all `--dam-sidebar-nav-*`.

```css
/* WRONG — TRAP source */
.geex-sidebar__menu__link { font-size: 16px; padding: 16px 25px; } /* style.css:383-384 */

/* RIGHT — already in dam-primitives.css */
.geex-sidebar__menu__link {
  font-size: var(--dam-sidebar-nav-fs, 13.6px);
  padding: var(--dam-sidebar-nav-py, 8.5px) var(--dam-sidebar-nav-px, 10.2px);
}
```

### 5.6 `.geex-btn` (census: canonical `dam-primitives.css:13+`)

**Tokens:** `--dam-radius-btn`, `--dam-space-btn-y/x`, `--dam-control-h`, `--dam-primary`, `--dam-btn-outline-border`.

```html
<!-- WRONG -->
<button class="btn btn-primary" style="border-radius: 4px">Action</button>

<!-- RIGHT -->
<button type="button" class="geex-btn geex-btn--primary">Action</button>
```

### 5.7 `.dam-branding-tag-filters` (census: dynamic `#damBrandingTagFilters`; `dam-branding.css:1153+`)

**Forbidden equivalent:** Ad-hoc tag row without wrapper; chips as plain `<span>` without badge classes.

**Live rhythm:** container `padding: 10px 12px`; `margin: 0 0 10px` (`P1-computed-live.md`). Chips: `.dam-viz-badge.dam-badge-tag` inside `.dam-tag-group-pills` (JS renders groups).

```html
<!-- WRONG: tags inline in secondary-filters band -->
<div class="dam-viz-secondary-filters"><span class="tag">burger</span></div>

<!-- WRONG: missing wrapper between search block and meta filters -->
<div class="dam-viz-secondary-filters dam-branding-filters--meta">…</div>

<!-- RIGHT — branding.html:138-158 spine -->
<div class="dam-branding-tag-filters" id="damBrandingTagFilters" role="group" aria-label="Filtry tagami"></div>
<div class="dam-viz-secondary-filters dam-branding-filters dam-branding-filters--meta" role="group">…</div>
<div class="dam-viz-grid-toolbar dam-branding-grid-toolbar dam-branding-status-row">…</div>
```

---

## 6. Spacing rhythm

**Mechanism first:** This app has **no global spacing token scale**. Rhythm is built from (1) **`--dam-bento-gap` flex column stack** on grid pages, (2) **shared filter band** padding (token **`20×24`** — explorer **ownership exception** computes **`20px 0px`**), (3) **frozen card body** `10×18×12` + `13px` internal gap, (4) **primitives calc()** for badges/buttons. Core spine partially **computed verified** @ 2026-09-09 (`design-system-2026-09-09/P1-computed-live.md`). **Live exceptions** below override naive declared-only reads — document as ownership, not token lies.

| Mechanism | Used N times (evidence) | Typical values (sourced) | Computed live | Do not use |
|-----------|-------------------------|--------------------------|---------------|------------|
| **`gap` on `.geex-content` grid pages** | **3** selectors (`dam-bento.css:361-366`) | `var(--dam-bento-gap)` → **16px** | **unverified** @ 2026-09-09 (2026-09-07 **16px** not re-probed) | Random `margin-bottom` between major blocks when bento stack applies |
| **Filter band pad** | **142** lines touch `.dam-viz-secondary-filters` family in `dam-brand.css` (P1 grep) | `padding: 20px 24px`; `gap: 10px 12px` (`dam-brand.css:3740-3742`) | **Viz:** **20×24×20×20**, gap **10×12** ✓ @ 2026-09-09. **Explorer:** pad **`20px 0px`**, gap **10×12**, mb **14px** ✓ — shell zeros horizontal `dam-brand.css:4445-4449`; mb from `.dam-explorer-secondary-filters` `:3808-3809` (**not** `--dam-space-filter-mb`) | Old **8×12** pre-bump values; do not copy **24px** horizontal onto explorer |
| **Card body pad/gap** | **80** `.dam-viz-card` hits in `dam-brand.css` | top **10** / x **18** / bottom **12**; gap **13px** (`dam-brand.css:2731-2743`) | **Viz only @ 2026-09-09:** **10×18×12**, gap **13px** ✓ | Overrides in `dam-viz.css` (explicitly forbidden `:9-10`); wrong selector `.dam-branding-card__body` (not in DOM) |
| **Branding search chrome** | convention on branding page | `padding: 12px 16px`; `gap: 10px` (`dam-branding.css:173-174`) | **unverified** (2026-09-07 claim not re-probed) | Copy viz-only offsets without checking panel sheet |
| **Branding tag filter band** | `#damBrandingTagFilters` | `padding: 10px 12px`; `margin-bottom: 10px` (`dam-branding.css:1153+`) | **unverified** (2026-09-07 claim not re-probed) | Omit wrapper — tags belong here, not in meta filters |
| **Badge pills (global + tag filters)** | **38** badge-family hits in `dam-primitives.css` | `calc(2px*scale) calc(8px*scale)` (`:337`) | **unverified** @ 2026-09-09 (2026-09-07 **2.1×8.4px** not re-probed) | Literal **`2px 8px`** — declared override in `dam-branding.css:1179` does **not** win live (2026-09-07) |
| **Grid toolbar gaps** | `dam-brand.css:3908-3909` | `row-gap: 8px`; `column-gap: 14px` | **8×14** ✓ on viz | Single undifferentiated `gap: 10px` |
| **Grid toolbar margin (branding)** | `dam-branding.css:312-317` | declared base `0 0 12px` on `.dam-viz-grid-toolbar` | **`-4px 0px 5px`** on branding status row | Copy viz `0 0 12px` onto branding |
| **Viz nested filter margin** | `dam-viz.css:174-175` | declared `14px` on top-level rule | **`4px`** when nested in `.dam-global-search-block` | Applying **14px** where nested rule wins |
| **Mobile content inset** | **1** rule | `padding-inline: 1rem` (`dam-app.css:1028-1030`) | unverified desktop | Desktop content padding from Geex (none set — width only TRAP) |

### Convention spine (quick reference)

| Rhythm | Value | Owner |
|--------|-------|-------|
| Vertical stack between main blocks | **16px** (`--dam-bento-gap`) | `dam-bento.css` |
| Secondary filters padding | **20px 24px** (viz/branding); **explorer: 20px 0px** shell exception | `--dam-space-filter-pad-y/x` → `dam-brand.css`; explorer override `dam-brand.css:4445-4449` |
| Card body padding | **10px 18px 12px** | `--dam-space-card-body-pad-*` → `dam-brand.css` |
| Card body internal gap | **13px** | `--dam-space-card-body-gap` → `dam-brand.css` |
| Branding tag-filter band pad | **10px 12px**; mb **10px** | `dam-branding.css` |
| Badge chip pad (live) | **2.1×8.4px** (scale 1.05) | `dam-primitives.css` — not literal 2×8 |
| Grid toolbar gaps | **row 8px / column 14px** | `--dam-space-toolbar-row-gap/col-gap` → `dam-brand.css` |
| Branding toolbar margin | **-4px 0 5px** (not 0 0 12px) | `dam-branding.css:312-317` |
| Viz nested filter mb | **4px** (not 14px) | `dam-viz.css:174-175` |

**User context (not implemented in v2):** Goal to unify paddings across visualizations, branding, and other panels should respect the spine above — change **`dam-brand.css` shared classes first**, then panel exceptions (`dam-viz.css`, `dam-branding.css`), never Geex TRAPs. **No production unify in P4.**

---

## 7. Content architecture

**No WordPress / page builder.** All sections: **editable in page builder = NO**. Owners are HTML shell + JS modules + JSON under `bin/apps/web/data/`.

### Global chrome (consent before editing)

| Section | Content owner | Style owner | Edit surface | Builder |
|---------|---------------|-------------|--------------|---------|
| Sidebar menu | `dam-shell.js` (injects items) | `dam-brand.css`, `dam-primitives.css` | JS + HTML shell | **NO** |
| Sidebar version label | `dam-version.js` (`DAM_APP_VERSION` = **5.0.178**) → `#damSidebarVersion` appended to `.geex-sidebar__footer` | `dam-brand.css:3367-3378` (`.dam-sidebar-version` — `text-align: left`, muted 11px×scale) | JS constant + CSS; legacy `.dam-app-version` / `#damAppVersionPill` hidden | **NO** |
| Header / logo | `*.html` shell | `dam-brand.css` | HTML + assets | **NO** |
| Theme pref | inline boot script + `localStorage` | `dam-tokens.css` dark block | HTML + user prefs JS | **NO** |

### Branding panel (`branding.html`)

| Section | Content owner | Style owner | Edit surface | Builder |
|---------|---------------|-------------|--------------|---------|
| Page title / subtitle | `branding.html:75-76` + `dam-i18n.js` | Geex header TRAP + DAM overrides **unverified** | HTML / i18n keys | **NO** |
| Search + tabs | `branding.html:84-136` | `dam-branding.css:170-223` | HTML structure; behaviour `dam-branding.js` | **NO** |
| Tag filters (dynamic) | `dam-branding.js` → `#damBrandingTagFilters` | `dam-branding.css:1153+`, badges `dam-primitives.css` | JS + CSS | **NO** |
| Meta filters row | `branding.html:139-158` | `dam-brand.css` (`.dam-viz-secondary-filters`) | HTML | **NO** |
| Status toolbar | `branding.html:159-161` | `dam-branding.css` + `dam-brand.css` | HTML + JS status text | **NO** |
| Card grid | `dam-branding.js` → `#damBrandingSectionGrid` | `dam-brand.css` (card), `dam-branding.css` (deltas) | JS templates; index JSON | **NO** |
| Brandbook panel | `branding.html:180-184` | `dam-branding.css`, `dam-hub-shared.css` | JS + HTML | **NO** |

### Visualizations panel (`visualizations.html`)

| Section | Content owner | Style owner | Edit surface | Builder |
|---------|---------------|-------------|--------------|---------|
| Search scope / admin row | `dam-viz.js`, `dam-search.js` | `dam-viz.css:#vizSearchScope` | JS | **NO** |
| Secondary filters | HTML + JS | `dam-brand.css` + `dam-viz.css` offsets | HTML/JS | **NO** |
| Viz grid cards | `dam-viz.js` | **`dam-brand.css`** (anatomy) | JS; `search-index.json` / bridge | **NO** |
| Modal preview | `dam-media-preview.js` | `dam-viz-modal.css` | JS | **NO** |

### Explorer panel (`explorer.html` @ **5.0.178**)

| Section | Content owner | Style owner | Edit surface | Builder |
|---------|---------------|-------------|--------------|---------|
| Page title **„Eksplorer”** | **i18n** — `data-i18n="explorer.title"` → `pl.json:115`; HTML fallback `explorer.html:627` | Geex header TRAP + DAM overrides **unverified** | HTML / i18n | **NO** |
| Subtitle (product structure) | **i18n** — `explorer.subtitle` → `pl.json:116` | same | HTML / i18n | **NO** |
| **„Kategorie”** panel heading | **HTML hard-coded** — `explorer.html:934` `<div class="dam-cat-panel__title">` | `dam-brand.css` explorer shell | HTML only — **not in pl.json** | **NO** |
| **„Pokaż wszystkie”** switch | **i18n** — `common.show_all` | `dam-brand.css` | HTML `explorer.html:923` | **NO** |
| Category tree `#damFolderList` | **`dam-explorer.js`** (slim index `GET /file-index?fields=explorer`) | **`dam-brand.css`** (no `dam-explorer.css`) | JS + bridge API | **NO** |
| Default empty canvas **„Wybierz kategorię…”** | **JS generated** — `dam-explorer.js` render path | `dam-brand.css` empty components | JS | **NO** |
| Status-filter empty states | **i18n + JS** — `explorer.empty_status_*` → `pl.json:306-309`; `renderStatusEmptyCard()` | `dam-brand.css` `.dam-branding-empty*` | JS + pl.json | **NO** |
| Search empty **„Brak wyników”** + mascot | **JS hard-coded** — `dam-explorer.js:4692-4723` (partial i18n on clear button) | `dam-brand.css` | JS — **orphan PL strings** | **NO** |
| Loading **„Ładowanie indeksu dysku…”** | **JS hard-coded** — `dam-explorer.js:4780` | — | JS — **not i18n key** | **NO** |
| Toolbar / filter chips | HTML + `dam-explorer.js` + `dam-tag-bar.js` | **`dam-brand.css`** — filter pad **20px 0px** shell exception | JS | **NO** |
| Results grid `#damExplorerMain` | `dam-explorer.js` | `dam-brand.css` | JS + bridge `/file-index/product?id=` | **NO** |

**Explorer boot note (2026-09-09):** Empty **Kategorie** tree + ghost chips were **5.0.178 boot-race regressions** (blocking meta, tag-bar stampede, GSAP opacity) — **fixed in shipped 5.0.178**. Vision @ capture: `explorer-p1-live.png` **1280×1800**, **159202 B**, tree populated (**8** categories: Batony, Kulki…), footer **DAM v5.0.178** — not the current default empty state.

**Sandbox:** **N/A** — static git HTML; safe experiment = branch + local `:8765` + `?v=` cache bust (`P1-ownership-map.md`).

**Clone path when adding a section:** Copy an existing panel block from `branding.html` or `visualizations.html`, keep shared class names (`.dam-viz-secondary-filters`, `.dam-viz-grid`), wire new behaviour in a **`dam-*.js`** file — never a hypothetical builder field.

---

## 8. Workflow / ladder

WRONG/RIGHT pairs for this stack (static HTML + DAM CSS/JS).

### Clone vs scratch

```text
WRONG: New filter row from Bootstrap examples with inline padding.
RIGHT: Copy <div class="dam-viz-secondary-filters">…</div> from branding.html:139; adjust only IDs and panel-specific classes documented in dam-branding.css.
```

### Token vs hardcode

```text
WRONG: border: 1px solid #ececf2; color: #464255;
RIGHT: border: 1px solid var(--dam-border); color: var(--dam-text);
```

### Census winner vs Geex native

```text
WRONG: <span class="badge bg-primary rounded-pill">
RIGHT: <button class="dam-viz-badge dam-badge-tag">
```

### Content owner vs fake duplicate

```text
WRONG: Hard-code sidebar nav items in one HTML page only.
RIGHT: Extend menu data in dam-shell.js so all panel shells stay consistent.
```

### Card anatomy edit level

```text
WRONG: Tweak .dam-viz-card padding in dam-branding.css for "just branding".
RIGHT: Card pad/gap changes require dam-brand.css vars (--dam-viz-card-body-pad-*) — frozen C3; layout-only deltas in dam-branding.css for .dam-branding-card thumb etc.
```

### Hide vs delete

```text
WRONG: display:none on .dam-viz-card__variant-badge in dam-branding.css to "fix" overlap.
RIGHT: Count bubble lives in dam-brand.css only — fix layout in the owning sheet without overriding global badge (memory.md / P0).
```

### Lowest legal rung vs bespoke jump

```text
WRONG: New dam-explorer.css because "explorer feels different".
RIGHT: Reuse .dam-explorer-* rules already in dam-brand.css; add page offsets only if census shows repeated pattern.
```

### Named files (bespoke — builder cannot do this)

| File | Why bespoke |
|------|-------------|
| `assets/css/dam-tokens.css` | Token source — no CMS theme.json |
| `assets/css/dam-primitives.css` | Geex realign layer |
| `assets/css/dam-brand.css` | Shared grids, cards, filters, explorer |
| `assets/css/dam-viz.css` | Viz-only chrome offsets |
| `assets/css/dam-branding.css` | Branding-only chrome + card deltas |
| `assets/css/dam-bento.css` | Grid gap spine |
| `assets/js/dam-branding.js`, `dam-viz.js`, `dam-explorer.js` | Dynamic grids, search, index binding |
| `assets/js/dam-shell.js` | Sidebar menu injection |
| `apps/desktop/local_bridge.py` | Filesystem/index API — not styling, but content source |

---

## 9. Anti-patterns (from the weak-model run)

P3 lab task: branding filter-card fragment in sandbox. **Sandbox deleted** by computed worker — audit from parent P3 report only (no HTML re-read). **Blunt:** v1 was already good enough that anti-patterns stay **small** — five doc-gap / rhythm-precision misses, **zero** kit/hex/native-button/Geex-TRAP failures.

| id | Observed miss | WRONG | RIGHT |
|----|---------------|-------|-------|
| H-origin | Tag-filter band omitted — no `.dam-branding-tag-filters` wrapper | Tags/chips placed inside `.dam-viz-secondary-filters` or bare div | `<div class="dam-branding-tag-filters" id="damBrandingTagFilters">` between search block and meta filters (`branding.html:138`; recipe §5.7) |
| H-kit | Guessed CSS `<link>` order | Reordered or shortened stack (e.g. skipped `dam-branding.css` / `dam-bento.css`) | Copy `branding.html:18-30` verbatim (§1 control plane) |
| H-space | Extra local `<style>` for panel spacing | Sandbox `<style>` duplicating filter/card pad | Link winner sheets only; boot inline limited to `#dam-shell-boot-critical` |
| H-space | Chip pad read as literal **2×8** | `padding: 2px 8px` on filter chips | `.dam-viz-badge.dam-badge-tag` — live **2.1×8.4px** from primitives calc (§5.4) |
| H-space | Toolbar gaps **8–14** unmapped | Single `gap: 10px` or undeclared flex row | `.dam-viz-grid-toolbar` → `row-gap: 8px; column-gap: 14px`; branding margin **-4 0 5** (§5.3, §6) |

**Compliance (observed hits — do not re-list as anti-patterns):**

- Used census winners **`.dam-viz-card`** + **`.dam-branding-card`** (card anatomy owner respected).
- Used **`.dam-viz-secondary-filters`** + **`dam-branding-filters--meta`** for meta band (not scratch Bootstrap row).
- Did **not** copy Geex **16px** sidebar TRAP or edit **`sidebar.css`**.
- Did **not** use Bootstrap **`badge bg-primary`** or restyle card anatomy in **`dam-viz.css`**.
- Did **not** hardcode unsourced brand hex (token stack assumed from linked sheets).

**Holes (observed misses only):** five rows above. Predicted traps (kit primary, raw hex, native button, flex layout mode, content-owner swap) **did not occur**.

---

## P1 evidence gaps (blunt)

| Cell / topic | Verdict |
|--------------|---------|
| Sidebar nav **computed** | **Verified @ 2026-09-09** — 13.6px / 6.8×10.2px / gap 8.5px / radius 15.3px on `explorer.html?v=5.0.178` (`design-system-2026-09-09/P1-computed-live.md`) |
| Explorer filter band pad | **Verified @ 2026-09-09** — **`20px 0px`** (not token 24px horizontal); mb **14px** — shell exception `dam-brand.css:4445-4449`, `:3808-3809` |
| Viz filter band + card body | **Verified @ 2026-09-09** — pad 20×24×20×20; card **10×18×12**, gap **13px** |
| Explorer screenshot | **Verified @ 2026-09-09** — `explorer-p1-live.png` **1280×1800**, tree **8 cats** populated; empty Kategorie = **historical boot race**, not default |
| Slim index size | **Verified @ 2026-09-09** — **46909 B**, **193 products** via `curl …/file-index?fields=explorer` — **not** ~512 KB memorized count |
| Sidebar version label **5.0.178** | **Verified @ 2026-09-09** — vision Read on `explorer-p1-live.png` footer text |
| Branding filter band computed 20×24 | **Unverified** — not re-probed 2026-09-09 (2026-09-07 P6 claim retained, stale for computed) |
| Bento gap 16px computed | **Unverified** — not re-probed 2026-09-09 |
| Badge pill 2.1×8.4px computed | **Unverified** — not re-probed 2026-09-09 |
| P6 vision @ 1610×869 branding/viz | **Unverified @ 2026-09-09** — prior PASS @ 2026-09-07 only (`P6-verify.md`) |
| Page title / body font live | **Too thin** — only Geex TRAP sourced |
| Polish glyph / orphan sweep | **Not run** @ 2026-09-09 |
| Broken `./assets/css/?v=*` | **Gone** — `rg` **0** matches @ 2026-09-09 (`P1-ownership-map.md`) |
| Explorer **„Kategorie”** heading | **HTML orphan** — hard-coded @ `explorer.html:934`; wire through i18n if editing copy |

---

## P6 — Verification gates (skill §12)

**Captured:** 2026-09-07T10:12+02:00 (`P6-verify.md`) — **not re-run @ 2026-09-09**. **Runtime reconfirmed:** `:8765` / `:8766` **UP** @ 2026-09-09 (`P0-control-plane.md`). **Explorer vision @ 2026-09-09:** `design-system-2026-09-09/explorer-p1-live.png` **1280×1800**, **159202 B**.

### Screenshot record (vision Read — not filename-only)

| File | Bytes | WxH | Verdict |
|------|-------|-----|---------|
| `bin/agents/shared/design-system-2026-09-07/branding-p5-live-2026-09-07.png` | **153171** | **1610×869** | **PASS** — filter band ~20×24 density, toolbar 8×14 gaps, card body tight pad, grid populated |
| `bin/agents/shared/design-system-2026-09-07/viz-p5-live-2026-09-07.png` | **167949** | **1610×869** | **PASS** — secondary filters match branding density; 159 cards; cross-panel parity |
| `design-system-2026-09-09/explorer-p1-live.png` | **159202** | **1280×1800** | **PASS @ 2026-09-09** — tree 8 cats, filters visible, **DAM v5.0.178**; empty Kategorie was boot race, not default |
| `branding-p1-live-2026-09-07.png` | 101476 | 1110×798 | **STALE** — P1 reference only |
| `viz-p1-live-2026-09-07.png` | 111884 | 1110×798 | **STALE** — P1 reference only |

**P5 appearance verdict:** Filter band density, chip rhythm, and card body tightness **MATCH** between branding and viz. **PASS (vision).**

### Computed cross-panel @ 5.0.164 (supplement)

| Node | Branding | Viz | Match |
|------|----------|-----|-------|
| `.dam-viz-secondary-filters` pad | 20/24/20/20 | 20/24/20/20 | **YES** |
| filter gap row×col | 10×12 | 10×12 | **YES** |
| `.dam-viz-card__body` pad | 10/18/12 | 10/18/12 | **YES** |
| card body gap | 13px | 13px | **YES** |
| `.dam-viz-grid-toolbar` gaps | 8/14 | 8/14 | **YES** |

### Gate matrix

| Gate | Result |
|------|--------|
| P5 screenshot vision (1610×869, non-zero bytes) | **PASS** |
| Runtime `:8765` | **PASS** |
| P5 rhythm tokens in `dam-tokens.css` | **PASS** |
| Computed viz ↔ branding rhythm | **PASS** |
| Explorer @ 5.0.178 + slim index | **PASS** @ 2026-09-09 — tree populated in `explorer-p1-live.png`; broken-link TRAP **gone** all pages |
| Polish glyph recontent (P5) | **UNVERIFIED** |
| Tablet/mobile viewport shots | **UNVERIFIED** — only desktop 1610×869 captured |

---

*End v2 — P2 refresh @ 2026-09-09 (ui-create-design-system Mode A). Computed: `design-system-2026-09-09/P1-computed-live.md`. Prior vision: `P6-verify.md` @ 2026-09-07. Sandbox: N/A (static git).*