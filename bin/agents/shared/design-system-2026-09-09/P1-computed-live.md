# P1 Computed Live — probed cells only

**Captured:** 2026-09-09 08:59 +02:00  
**Commands:**
- `powershell -File bin\scripts\ops\smoke-dam-ports.ps1` → UI **200**, Bridge **200**
- Chrome headless `--window-size=1280,1800 --screenshot=explorer-p1-live.png` + `PIL Image.size` → **1280×1800** physical px
- Playwright `getComputedStyle` on `:8765/explorer.html?v=5.0.178` and `:8765/visualizations.html?v=5.0.178` (domcontentloaded + 5s buffer)

**Screenshot:** `bin/agents/shared/design-system-2026-09-09/explorer-p1-live.png` — **159202 B**, vision Read @ 2026-09-09: category tree populated (Batony, Kulki…), filter chips visible, default empty canvas “Wybierz kategorię…”, footer **DAM v5.0.178**.

---

## Sidebar nav (both panels)

| Property | Computed | Declared winner | Match? |
|----------|----------|-----------------|--------|
| `font-size` | **13.6px** | `--dam-sidebar-nav-fs` + `dam-primitives.css:545` | yes |
| `padding` | **6.8px 10.2px** | `--dam-sidebar-nav-py/px` + `:542` | yes |
| `gap` | **8.5px** | `--dam-sidebar-nav-gap` + `:543` | yes |
| `line-height` | **20.4px** | `--dam-sidebar-nav-lh` + `:546` | yes |
| `border-radius` | **15.3px** | `--dam-sidebar-nav-radius` + `:541` | yes |

**TRAP refuted:** Geex `style.css:384` **16px** does **not** compute when full stack loads.

---

## Explorer — `.dam-viz-secondary-filters`

| Property | Computed | Token / rule | Notes |
|----------|----------|--------------|-------|
| `padding` | **20px 0px** | `--dam-space-filter-pad-y` + explorer shell zero horizontal | `dam-brand.css:4445-4449` zeros L/R on `.dam-explorer-shell > …` |
| `gap` | **10px 12px** | `--dam-space-filter-gap-row/col` via `dam-brand.css:3740` | convention |
| `margin-bottom` | **14px** | hardcoded `.dam-explorer-secondary-filters` | `dam-brand.css:3808-3809` — **not** `--dam-space-filter-mb` (12px) |

## Explorer — `.dam-viz-grid-toolbar`

| Property | Computed | Token / rule |
|----------|----------|--------------|
| `column-gap` | **14px** | `--dam-space-toolbar-col-gap` `dam-brand.css:3907` |
| `row-gap` | **8px** | `--dam-space-toolbar-row-gap` `:3908` |
| `margin-bottom` | **12px** | `--dam-space-toolbar-mb` `:3909` |

---

## Visualizations — inner panel

| Node | Property | Computed | Token / rule |
|------|----------|----------|--------------|
| `.dam-viz-secondary-filters` | padding | **20px 24px 20px 20px** | asym override `dam-brand.css:4485-4486` |
| same | gap | **10px 12px** | `--dam-space-filter-gap-*` `:3740` |
| same | margin-bottom | **4px** | nested path — not viz.css 14px (toolbar nested) |
| `.dam-viz-grid-toolbar` | column/row gap | **14px / 8px** | tokens `:3907-3908` |
| same | margin-bottom | **0px** | nested in search block `dam-viz.css:176-179` |
| `.dam-viz-card__body` | padding | **10px 18px 12px** | `--dam-space-card-body-pad-*` via `dam-brand.css:2731-2737` |
| same | gap | **13px** | `--dam-space-card-body-gap` |

---

*Probe script deleted after run. Browser MCP not used.*
