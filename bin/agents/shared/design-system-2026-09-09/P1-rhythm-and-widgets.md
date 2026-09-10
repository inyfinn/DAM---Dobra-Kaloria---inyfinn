# P1 Rhythm & Widgets — spacing census

**Captured:** 2026-09-09 08:59 +02:00  
**Commands:**
- `rg -n "--dam-space-|--dam-bento-gap|dam-viz-secondary-filters|dam-viz-grid-toolbar|dam-viz-card__body" bin/apps/web/assets/css/{dam-tokens,dam-brand,dam-bento,dam-viz}.css`
- Playwright computed probes → `P1-computed-live.md`
- Vision Read `explorer-p1-live.png` @ 1280×1800

**Pages sampled:** `explorer.html?v=5.0.178` + `visualizations.html?v=5.0.178`

---

## Convention spine (token owners — not invented px)

| Rhythm token / role | Declared | Consumer | Status |
|---------------------|----------|----------|--------|
| `--dam-bento-gap: 16px` | `dam-bento.css:9` | `.geex-content:has(#vizGrid)` stack `:361+` | **source** |
| `--dam-bento-gap-sm: 12px` | `dam-bento.css:10` | responsive shrink `:137` | **source** |
| Filter band pad/gap/mb | `--dam-space-filter-*` | `dam-brand.css:3740-3742` | **source** — explorer horizontal pad **overridden** |
| Toolbar gaps/mb | `--dam-space-toolbar-*` | `dam-brand.css:3907-3909` | **source** — viz nested mb **0** |
| Card body pad/gap | `--dam-space-card-body-*` | `dam-brand.css:2731-2743` | **source** — computed **10×18×12 / gap 13** on viz |
| Sidebar nav compact | `--dam-sidebar-nav-*` | `dam-primitives.css:540-547` | **computed** 13.6px fs |

---

## 5-bullet rhythm census (explorer + viz)

1. **Vertical stack between main blocks** uses `--dam-bento-gap` (**16px**) on grid pages via `dam-bento.css:361-366` (`.geex-content:has(#vizGrid)` and branding/projects analogues) — **convention**; Geex `style.css` sets width only, not vertical rhythm (**TRAP** for spacing).
2. **Secondary filter band** declares token gaps **`10px 12px`** and pad **`20px × 24px`** in `dam-brand.css:3740-3742`; **computed explorer** = pad **`20px 0px`** (shell zeroes horizontal `dam-brand.css:4445-4449`) + mb **`14px`** (hardcoded `.dam-explorer-secondary-filters` `:3808-3809`, not `--dam-space-filter-mb` 12px).
3. **Grid toolbar row** uses token **`column-gap 14px`**, **`row-gap 8px`**, **`margin-bottom 12px`** (`dam-brand.css:3907-3909`) — **computed match on explorer**; on viz when nested in search block mb computes **0** (`dam-viz.css:176-179`).
4. **Card anatomy** frozen in `dam-brand.css:2715-2746` — body **`padding 10px 18px 12px`**, **`gap 13px`** via `--dam-space-card-body-*`; `dam-viz.css:9-10` explicitly **not** card owner — **computed viz card matches tokens**.
5. **Panel-specific exceptions (still `--dam-*` or documented hardcode):** viz page filter mb **`14px`** override `dam-viz.css:171` (when not nested); explorer filter mb **`14px`** class rule; branding search chrome uses **local px** (`dam-branding.css:173-174` `12px 16px`) — **exception**, not new tokens.

---

## Widget / component counts (file grep @ 2026-09-09)

| type | variant | count hint | pages | role |
|------|---------|------------|-------|------|
| `.dam-viz-secondary-filters` | shared filter band | 142+ refs family in `dam-brand.css` | explorer, viz, branding | **convention** |
| `.dam-viz-grid-toolbar` | status/meta row | brand `:3904+`, viz offsets `:89-190` | explorer, viz, branding | **convention** |
| `.dam-viz-card` / `.dam-branding-card` | grid tile | brand `:2717+`; branding deltas `:851+` | viz, branding | **convention** (anatomy frozen) |
| `.dam-viz-badge` / tag chips | filter pills | `dam-primitives.css:314-382` | all filter bands | **convention** |
| `.dam-explorer-*` | explorer shell | `dam-brand.css:2609+`, `:3952+` | explorer only | **panel exception** — no `dam-explorer.css` |

---

## TRAP rhythm sources (prohibit as census truth)

| Source | Why TRAP |
|--------|----------|
| `style.css` `.geex-sidebar__menu__link` 16×25 pad | Overridden by tokens + primitives — see computed |
| `sidebar.css` | Unlinked — 0 HTML references @ 2026-09-09 |
| Raw `#8b8d97` in `dam-brand.css:3814` | Legacy hint colour — not a spacing token |

---

*End P1 rhythm — mechanism-first; computed cells in P1-computed-live.md.*
