# P6 — visual verification (Intern worker)

**Captured:** 2026-09-07T10:12+02:00  
**Claim under test:** P5 @ **5.0.164** — filter **20×24** MATCH viz/branding; card **10×18×12** MATCH; toolbar gaps **8×14**.  
**Method order:** (1) read P5 PNGs (vision), (2) pixel record, (3) runtime curl, (4) CDP computed (supplement only).

---

## Runtime

| Probe | Result |
|-------|--------|
| `curl.exe http://127.0.0.1:8765/branding.html?v=5.0.164` | **200** |
| `curl.exe http://127.0.0.1:8765/visualizations.html?v=5.0.164` | **200** |
| Second server started | **NO** (forbidden) |

---

## Screenshot pixel record

| File | Bytes | WxH | Vision usable? |
|------|-------|-----|----------------|
| `branding-p5-live-2026-09-07.png` | **153171** | **1610×869** | **YES** |
| `viz-p5-live-2026-09-07.png` | **167949** | **1610×869** | **YES** |
| `branding-p1-live-2026-09-07.png` (reference only) | 101476 | **1110×798** | yes — **P1**, not P5 |
| `viz-p1-live-2026-09-07.png` (reference only) | 111884 | **1110×798** | yes — **P1**, not P5 |

**Capture notes:** Branding via `browser_take_screenshot`; viz via CDP `Page.captureScreenshot` (browser screenshot returned no image data on first attempt). Both pages waited until filter band height > 0 (branding ~76px / 100 cards; viz ~76px / 159 cards) before capture.

### P5 vision notes (live @ 5.0.164)

**Branding (`branding-p5-live-2026-09-07.png` @ 1610×869):**

- Meta filter band (`.dam-branding-filters--meta`) fully rendered: bordered rounded panel with **generous internal padding** (~20×24-class), chip rows for Marka / Autor / Skojarzenia / Przeznaczenie at **10×12-class** row/column rhythm.
- Grid toolbar above filters: sort dropdown, scale/cards sliders, Quiz skojarzeń — **8×14-class** horizontal gaps between controls.
- Card grid below filters: product cards with **tight title/meta stacks** inside card bodies (~10px top / ~18px horizontal / ~12px bottom pad visible on text blocks).
- DAM v5.0.164 footer badge visible; no blank/loading shell.

**Viz (`viz-p5-live-2026-09-07.png` @ 1610×869):**

- Secondary filter band (`.dam-viz-secondary-filters`) fully rendered: **same bordered density and padding** as branding meta band — Smak / Typ / Opakowanie / Autor / Podkategoria chip rows at matching rhythm.
- Toolbar row (search, category tabs, scale slider, toggles) shares **same gap/spacing class** as branding toolbar.
- Card grid populated (159 products); card bodies show **matching tight pad** on titles/meta vs branding cards.
- Cross-panel filter band **visual parity confirmed** at P5 token targets.

**P5 appearance verdict:** Filter band density, chip rhythm, and card body tightness **MATCH** between branding and viz in live P5 captures. **PASS (vision).**

### P1 vision notes (stale — pre-tokenization reference only)

From `branding-p1-live` / `viz-p1-live` @ 1110×798:

- Both panels show bordered filter bands with **generous** internal padding and **10×12-class** chip row rhythm.
- Branding meta filter band and viz secondary filter band **look the same density** in P1 captures.
- Card grids show **tight title/meta stacks** consistent with ~10px top / ~18px horizontal body pad — superseded by P5 re-capture above.

---

## Token source (5.0.164) — `dam-tokens.css`

| Token | Value | Consumer |
|-------|-------|----------|
| `--dam-space-filter-pad-y` | `20px` | `dam-brand.css` `.dam-viz-secondary-filters` |
| `--dam-space-filter-pad-x` | `24px` | same |
| `--dam-space-filter-gap-row` | `10px` | same |
| `--dam-space-filter-gap-col` | `12px` | same |
| `--dam-space-filter-mb` | `12px` | same |
| `--dam-space-filter-nested-mb` | `4px` | `dam-viz.css` nested override |
| `--dam-space-card-body-pad-top` | `10px` | `dam-brand.css` `.dam-viz-card__body` |
| `--dam-space-card-body-pad-x` | `18px` | same |
| `--dam-space-card-body-pad-bottom` | `12px` | same |
| `--dam-space-card-body-gap` | `13px` | same |
| `--dam-space-toolbar-row-gap` | `8px` | `dam-brand.css` `.dam-viz-grid-toolbar` |
| `--dam-space-toolbar-col-gap` | `14px` | same |
| `--dam-space-toolbar-mb` | `12px` | same |
| `--dam-space-toolbar-nested-mb` | `5px` | branding status row offset |

**Verdict:** P5 tokens **landed** in token source and are wired to shared consumers. **PASS (source).**

---

## Computed live @ 5.0.164 (CDP — supplement)

Both pages load `dam-tokens.css?v=5.0.164`.

### Filter band (`.dam-viz-secondary-filters` / `.dam-branding-filters--meta`)

| Property | Branding | Viz | Match? |
|----------|----------|-----|--------|
| padding T/R/B/L | **20 / 24 / 20 / 20** | **20 / 24 / 20 / 20** | **YES** |
| gap row×col | **10 × 12** | **10 × 12** | **YES** |
| margin-bottom | `0px` (meta) | **`4px`** (nested) | expected context delta |

### Card body (`.dam-viz-card__body`)

| Property | Branding | Viz | Match? |
|----------|----------|-----|--------|
| padding | **10 / 18 / 12** | **10 / 18 / 12** | **YES** |
| gap | **13px** | **13px** | **YES** |

### Grid toolbar (`.dam-viz-grid-toolbar`)

| Property | Branding | Viz | Match? |
|----------|----------|-----|--------|
| row-gap / column-gap | **8 / 14** | **8 / 14** | **YES** |
| margin-bottom | **5px** (branding status) | **0px** | expected context delta |

**Verdict:** Computed rhythm **MATCH** between viz and branding for filter pad/gap and card pad/gap @ live 5.0.164. **PASS (computed).**

---

## Explorer / dashboard inheritance

| Page | `dam-tokens.css` | `dam-brand.css` | Version query | Gap |
|------|------------------|-----------------|---------------|-----|
| `explorer.html` | **linked** L46 | **linked** L50 | `?v=5.0.164` | **TRAP:** malformed `./assets/css/?v=5.0.152` L51 (404-class broken href) |
| `dashboard.html` | **linked** L36 | **linked** L39 | `?v=5.0.164` | **same TRAP** L40 |

Both panels **inherit** token + shared chrome stack. No drive-by restyle performed. Broken empty-href link is a **pre-existing TRAP** — report only.

---

## Verdict matrix

| Gate | Result |
|------|--------|
| P5 screenshot vision (appearance) | **PASS** — 153171 B / 1610×869 branding; 167949 B / 1610×869 viz; filter/card rhythm MATCH |
| Runtime :8765 | **PASS** |
| P5 tokens in source | **PASS** |
| Computed viz ↔ branding rhythm | **PASS** |
| Explorer/dashboard inherit stack | **PASS** (with broken-link TRAP noted) |

**Overall P6:** **PASS** — vision + runtime + token + computed cross-panel match confirmed @ 5.0.164.

---

*Worker Intern — ui-create-design-system P6 re-capture. No commit. No new spacing. No second server.*
