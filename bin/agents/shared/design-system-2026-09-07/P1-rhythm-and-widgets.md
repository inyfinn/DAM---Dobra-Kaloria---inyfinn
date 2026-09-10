# P1 Rhythm & Widgets — padding / gap / margin census

**Captured:** 2026-09-07T09:58:03+02:00  
**Commands:**
- `rg -c "padding|gap|margin" bin/apps/web/assets/css/dam-viz.css` → **33**
- `rg -c "padding|gap|margin" bin/apps/web/assets/css/dam-branding.css` → **319**
- `rg -c "padding|gap|margin" bin/apps/web/assets/css/dam-brand.css` → **1131**
- `rg -n "\.geex-content|dam-viz-grid-toolbar|dam-viz-secondary-filters|dam-viz-card|dam-branding-card|dam-viz-badge" bin/apps/web/assets/css/{dam-brand,dam-viz,dam-branding,dam-bento,dam-primitives}.css`

**Runtime:** unverified (UI down). All values from declared CSS.

---

## Convention spine

| Rhythm token / value | Owner | Role |
|---------------------|-------|------|
| `--dam-bento-gap: 16px` | `dam-bento.css:9` | Vertical stack between `.geex-content` children (viz / branding / projects) |
| `--dam-bento-gap-sm: 12px` | `dam-bento.css:10` | Responsive bento shrink |
| `--dam-viz-card-body-gap: 13px` | `dam-brand.css:2734` | Card body internal flex gap (viz + branding) |
| `--dam-viz-card-body-pad-*` | `dam-brand.css:2731-2733` | top 10 / x 18 / bottom 12 |
| `--dam-control-h: 44px` | `dam-tokens.css:71` | Toolbar touch target (meta band uses 34px locally) |
| Badge pill padding | `dam-primitives.css:337` | `calc(2px * scale) calc(8px * scale)` |
| Card badge padding | `dam-primitives.css:382` | denser: `calc(5px * scale) calc(11px * scale)` |

---

## `.geex-content` (main column)

| Rule | padding / gap / margin | Count | Convention / exception |
|------|------------------------|-------|------------------------|
| Geex base width only | no padding | 1 block | `style.css:2037-2042` — **TRAP for rhythm** (width % only) |
| Grid pages flex column | `gap: var(--dam-bento-gap)` | **3** selectors | `dam-bento.css:361-366` — viz, branding, projects |
| Mobile inline pad | `padding-inline: 1rem` | **1** | `dam-app.css:1028-1030` @ max-width breakpoint — **exception** |
| Branding search block | `margin-bottom: 8px` | **1** | `dam-branding.css:536-537` |
| Branding tag filters | `margin-top: 0` | **1** | `dam-branding.css:540-541` (bento gap owns vertical air) |
| Viz secondary filters override | `margin-bottom: 14px` | **2** selectors | `dam-viz.css:169-171` — **exception** vs base `margin: 0 0 12px` in brand |
| Nested search block filters | `margin-bottom: 4px` | **1** | `dam-viz.css:174-175` — tighter when inside `.dam-global-search-block` |

**Convention:** 16px vertical rhythm via `--dam-bento-gap` on grid pages. **Exception:** Geex `style.css` never sets content padding; DAM adds mobile `1rem` only.

---

## Toolbars & filter bands

### `.dam-viz-secondary-filters` (shared viz / explorer / branding meta)

| Property | Declared value | File:line | Notes |
|----------|----------------|-----------|-------|
| `gap` | `10px 12px` | `dam-brand.css:3740` | **convention** |
| `padding` | `20px 24px` | `dam-brand.css:3743` | was 8×12; +12px bump documented in comment |
| `margin` | `0 0 12px` | `dam-brand.css:3741` | base |
| `margin-bottom` | `14px` | `dam-viz.css:171` | viz-only override |
| `padding-left/right` | `20px / 24px` | `dam-brand.css:4481-4482` | full-bleed frost path on `.geex-content > …` |
| Child chip gap | `6px` | `dam-brand.css:3794` | `.dam-brand-chips` |
| Zoom control pad | `4px 10px` | `dam-brand.css:3757` | nested exception |

**Occurrences:** **142** lines touching `.dam-viz-secondary-filters` family in `dam-brand.css` (grep count); **11** in `dam-viz.css`.

### `.dam-viz-grid-toolbar` (status row under filters)

| Property | Value | File:line |
|----------|-------|-----------|
| `column-gap` | `14px` | `dam-brand.css:3908` |
| `row-gap` | `8px` | `dam-brand.css:3909` |
| `margin` | `0 0 12px` | `dam-brand.css:3910` |
| `__end gap` | `10px` | `dam-brand.css:3922` |
| Nested status text | `margin: 0 0 15px` | `dam-viz.css:189` | viz page only |
| Search-scope changelog | `gap: 8px` | `dam-viz.css:77` | `#vizSearchScope` row |

**Convention:** 12px bottom margin + 8–14px internal gaps. **Exception:** viz nests toolbar inside search block with zeroed margins (`dam-viz.css:178-180`).

### Branding toolbar (`.dam-search-wrap--branding-chrome`)

| Property | Value | File:line |
|----------|-------|-----------|
| `gap` | `10px` | `dam-branding.css:173` |
| `padding` | `12px 16px 12px` | `dam-branding.css:174` |
| Tabs row `gap` | `6px 8px` | `dam-branding.css:214` |
| Tab pill `padding` | `5px 12px` | `dam-branding.css:219` |

### Branding tag filters (`.dam-branding-tag-filters`)

| Property | Value | File:line |
|----------|-------|-----------|
| Container `padding` | `10px 12px` | `dam-branding.css:1155` |
| Container `margin` | `0 0 10px` | `dam-branding.css:1154` |
| Pills in tiles `gap` | `6px` | `dam-branding.css:1187` |
| Chip override `padding` | `2px 8px` | `dam-branding.css:1179` | **exception** vs primitives calc() — lower specificity context |

---

## Cards

### `.dam-viz-card` (base anatomy — **FROZEN in dam-brand.css**)

| Property | Value | File:line | Convention |
|----------|-------|-----------|------------|
| `border-radius` | `var(--dam-radius-md, 12px)` | `dam-brand.css:2719` | token |
| Body `padding` | `10px 18px 12px` via vars | `dam-brand.css:2737` | **convention** |
| Body `gap` | `13px` | `dam-brand.css:2743` | **convention** |
| Thumb height | `calc(178px * scale)` | `dam-brand.css:2843` | viz-only `:not(.dam-branding-card)` |
| Count pill | `padding: 15px 26px` | `dam-viz.css:252` / branding mirror `:568` | sticky FAB lane exception |

**Occurrences:** **142** `.dam-viz-card` family hits in `dam-brand.css`; **53** `.dam-branding-card` in `dam-branding.css`.

### `.dam-branding-card` (extends viz card)

| Property | Value | File:line | vs base |
|----------|-------|-----------|---------|
| Body gap/pad | same 13px / 10×18×12 | `dam-branding.css:882-890` | **convention** (explicit re-declare) |
| Thumb side pad | `calc(12px * scale)` L/R/B | `dam-branding.css:859-861` | branding-only |
| Video thumb | `200px` height, `8px` pad | `dam-branding.css:1964-1966` | **exception** |

`dam-viz.css:9-10` explicitly states card anatomy **NOT** in dam-viz.css.

---

## Tag chips (`.dam-viz-badge` / `.dam-badge-tag`)

| Context | padding | radius | Owner | File:line |
|---------|---------|--------|-------|-----------|
| Global pill | `calc(2px*scale) calc(8px*scale)` | `14px` | `dam-primitives.css` | `:337`, `:322` |
| Card / modal dense | `calc(5px*scale) calc(11px*scale)` | `14px` | `dam-primitives.css` | `:382` |
| Branding filter override | `2px 8px` (literal) | `var(--_dam-badge-radius, 14px)` | `dam-branding.css` | `:1179`, `:1182` |
| High-specificity win | `html body …` block | `14px` beats 999px | `dam-primitives.css` | `:353-368` |

**Occurrences:** **38** badge-family hits in `dam-primitives.css`.

**Convention:** 14px radius from primitives. **Exception / TRAP:** `dam-brand.css` still has many `border-radius: 999px` rules (47+ hits) for non-badge controls; comment `:2942` says badge base anatomy removed from brand layer.

---

## Census summary

| Widget / region | Dominant gap | Dominant padding | Owner file | Convention vs exception |
|-----------------|-------------|------------------|------------|-------------------------|
| `.geex-content` stack | 16px (`--dam-bento-gap`) | none (desktop) | `dam-bento.css` | convention |
| Secondary filters | 10×12px | 20×24px | `dam-brand.css` | convention; viz mb +2px exception |
| Grid toolbar | 8–14px | none | `dam-brand.css` + `dam-viz.css` | split ownership |
| Branding search chrome | 10px | 12×16px | `dam-branding.css` | convention |
| Tag filter panel | 6px (pills) | 10×12px | `dam-branding.css` | convention |
| `.dam-viz-card__body` | 13px | 10×18×12 | `dam-brand.css` | **frozen convention** |
| `.dam-branding-card__body` | 13px | same | `dam-branding.css` | mirrors base |
| Badge chips | — | 2×8 or 5×11 calc | `dam-primitives.css` | convention; branding filter literal override |

---

## File-level spacing rule counts (whole file)

| File | padding/gap/margin lines |
|------|--------------------------|
| `dam-viz.css` | 33 |
| `dam-branding.css` | 319 |
| `dam-brand.css` | 1131 |

Most rhythm **declarations** live in `dam-brand.css`; panel sheets add layout offsets and page-specific exceptions.
