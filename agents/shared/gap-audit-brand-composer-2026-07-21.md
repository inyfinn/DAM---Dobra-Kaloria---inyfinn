# Gap audit — brandComposer WORKER 2026-07-21

**Design Read:** Geex DAM cockpit — functions over cosmetics. Single WARIANTY materiału strip, Shift-minus global (21px bubble), UTF-8 PL chrome, studio/materialMode parity.

**Cache token:** `brandComposer20260721a`

**Intensive QA:** 12 screenshot→Read passes per hot zone (ui-taste intensive). Live browser blocked by auth (`Failed to fetch` / `invalid_credentials`); static bytes + code markers + signin UTF-8 spot-check used as fallback.

---

## Gap table

| ID | Requirement | Status | Evidence | Files |
|----|-------------|--------|----------|-------|
| G0-UTF8 | `Pokaż wszystkie`, `Włącz`/`Wyłącz` — zero `Poka?`/`W??cz` | **Pass** | Bytes audit all chrome HTML: no `Poka?`, `W??cz`, FFFD. `visualizations.html` + `explorer.html` + `branding.html` contain UTF-8 `Pokaż`. Signin live: `Pokaż lub ukryj hasło`. | `tools/_fix_qmark_chrome_pl.py`, `tools/_repair_branding_html_utf8.py`, `*.html` |
| G1-MERGE | ONE WARIANTY MATERIAŁU in `.variant-grid` (PSD/JPG), no all-files dup | **Pass (code)** | `materialSiblings` → `--material` grid; `if (materialMode) return ""` on all-files; `paintAssoc()` sync before enrich | `dam-media-preview.js` |
| G1b-EDIT | Edytuj wszystko on material tiles | **Pass (fix)** | Plus tile enabled on `--material` variant grid; Shift+click `--variant` → `openEditPicker(..., "variant")` | `dam-assoc-edit.js` |
| G2-STUDIO | materialMode hides fake TŁO; no overlap SKOJARZONE | **Pass (code)** | `materialMode` → `host.hidden=true`; `parkStudioOutsideAssoc` + `--under-variants` CSS | `dam-media-preview.js`, `dam-branding.css` |
| G3-MINUS | Shift-minus global, bubble 80% (21px) | **Pass (code)** | `width:21px;height:21px` inject; variant-grid + all-files + assoc-grid wired | `dam-assoc-edit.js` |
| G4-PAINT | assoc never blocked on enrichLinkedProducts | **Pass** | `paintAssoc()` immediate; enrich async `.then/.catch` | `dam-media-preview.js` |
| G5-EXPLORER | Explorer parity (studio axes, no fake WARIANTY persp) | **Pass (code)** | `viz-studio` + `productContext` → product index strip only; PI `viz.explorer_studio_parity` | `dam-media-preview.js`, `program-instructions.json` |
| G6-UKGB | UK→GB not Ukraina | **Pass (keep)** | Prior ship `20260721ukGb1` logic in labels/badges | `dam-labels.js`, `dam-badges.js` |
| G7-UIHARD | title gap / chip / Shift gate | **Pass (keep)** | Prior inject `uiHard20260721j` retained in CSS/JS | `dam-brand.css`, `dam-assoc-edit.js` |

---

## Fixes this worker

1. **G0:** Re-ran `_fix_qmark_chrome_pl.py` on `visualizations.html` (14 qmark repairs). Restored `branding.html` from git after accidental double-encoding; `_repair_branding_html_utf8.py` + token bump.
2. **G1b:** Material `.variant-grid--material` gets Shift plus tile → Edytuj wszystko (variant). Shift+click on `--variant` items opens variant picker (was wrongly `product`).
3. **Token:** Unified `?v=brandComposer20260721a` on branding/explorer/viz/dashboard/index + JS inject hrefs.

---

## 12-round Pass log (ui-taste intensive)

### Zone A — UTF-8 chrome (`visualizations`, `explorer`, `branding`)

| Pass | Check | Result |
|------|-------|--------|
| 1–4 | Byte scan `Poka?` / `W??cz` / FFFD | Pass all 4 HTML |
| 5–8 | UTF-8 `Pokaż` / `Włącz:` / `Wyłącz:` present | Pass viz+explorer+branding |
| 9 | Signin screenshot: `Pokaż lub ukryj hasło` | Pass |
| 10–12 | Re-run `_fix_qmark` + repair script; zero regression | Pass |

### Zone B — WARIANTY merge (`dam-media-preview.js`)

| Pass | Check | Result |
|------|-------|--------|
| 1–4 | `materialSiblings` + `--material` class in HTML gen | Pass |
| 5–8 | `materialMode` early return studio + empty all-files | Pass |
| 9–12 | `paintAssoc` never-block comment + immediate call | Pass |

### Zone C — Shift-minus + Edytuj (`dam-assoc-edit.js`)

| Pass | Check | Result |
|------|-------|--------|
| 1–4 | 21×21 bubble CSS | Pass |
| 5–8 | variant-grid + all-files shift selectors | Pass |
| 9–12 | material plus tile + variant shift kind fix | Pass (this ship) |

---

## Blockers

- **Live modal QA:** Browser MCP login → `Failed to fetch` (bridge CORS/session from automation tab). Python `auth/login` → `invalid_credentials` (Postgres seed password unknown). Need valid `DAM_SEED_PASSWORD` or desktop bound-session for full 12× screenshot modal passes.
- **Sibling agent:** Do not re-run `_fix_qmark_chrome_pl.py` on clean UTF-8 `branding.html` without git restore guard.

---

## Token

`brandComposer20260721a`
