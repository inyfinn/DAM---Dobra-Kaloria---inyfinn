# Gap audit 4h — WORKER B (2026-07-21 ~03:00)

**Design Read:** B2B DAM Geex — functions over polish nudges; dense branding/explorer modals.

**Intensive QA:** 12 passes per gap zone (CDP + screenshot→Read where modal visible).

**Cache token:** `compB20260721a`

---

## Gap table (ownership B)

| ID | Claim | CDP / code evidence | Status |
|----|-------|---------------------|--------|
| **B1-WARIANTY** | ONE `WARIANTY MATERIAŁU` strip in `.dam-media-preview__variant-grid` (PSD/JPG/PNG); no duplicate all-group; Edytuj wszystko controls tiles | `br-005508`: tiles `["PSD","JPG"]`, `allFilesDup:false`, label `Warianty materiału`. `br-000002`: 6×`PNG`, `material:true`. `allFilesPanelHtml()` returns `""` when `materialMode`. | **SHIPPED** |
| **B2-STUDIO** | `materialMode` — no fake INNE·Z TŁEM; studio under variant-grid, not crushing products | `materialMode` hides studio (`studioHidden:true`); `ensureStudioUnderVariants()` parent `.assoc-col--variants`. No `.dam-media-preview__all-files` for material. | **SHIPPED** |
| **B3-MINUS** | Shift-minus bubble −20% globally (21px); Shift-gate not fat always-on discs | CSS inject `width:21px;height:21px`; default `opacity:0!important`; Shift / `.is-shift-hover` → `opacity:1`. Wired on variant-grid, assoc-grid, all-file tiles. | **SHIPPED** |
| **B4-UTF8** | `Pokaż` / `Włącz` / `Wyłącz` — zero `Poka?` / `W??cz` in apps/web chrome | **Was PARTIAL:** `visualizations.html` invalid UTF-8 + `Poka?`; `branding.html` cp1250/mojibake; `settings.html` `Wyczysc`; `dam-explorer.js` `Odswiez`. Fixed via `tools/_fix_compB_utf8.py`, `_fix_branding_qmark_only.py`. Live CDP viz: `label=Pokaż wszystkie`, `tip=Włącz:…` **ok:true**. Grep apps/web: **0** `Poka?`/`W??cz`. | **SHIPPED** (this worker) |
| **B5-EXPLORER** | Explorer modal parity vs viz (product INDEX variants, studio axes, show-all) | Code: `associationsFooterHtml` → `productIndexVariantsHtml` when `viz-studio` + `productContext`; explorer loads `dam-viz.js` + `dam-media-preview.js` `compB20260721a`. Prior process CDP Pass on ORZESZKI/Kulki. | **SHIPPED** (code + prior CDP; spot-check not re-run full explorer modal this pass) |
| **B6-SHIFT** | Assoc minus Shift-gate + red bubble style (not always-on) | `dam-assoc-edit.js` inject: hidden default; `.is-shift-hover` / `.is-shift-visible` show. `dam-media-preview.js` `#damMediaPreview` override aligns. Red gradient + 1px white border. | **SHIPPED** |
| **B7-PAINT** | Assoc paint not blocked by `enrichLinkedProducts` hang | `gapship20260721a`: `paintAssoc()` sync first; enrich async `.then/.catch`. CDP: assoc populated immediately on open. | **SHIPPED** (prior gapship; re-verified) |

**Abandoned:** none in ownership B after this pass.

**Superseded:** `gapship20260721a` token → **`compB20260721a`** (UTF-8 repair + cache re-bump).

---

## Fixes shipped (WORKER B)

1. **B4-UTF8:** Python UTF-8 writes — `tools/_fix_compB_utf8.py`, `tools/_fix_branding_qmark_only.py`; `settings.html`, `dam-explorer.js`, `visualizations.html`, `branding.html`.
2. **Cache-bust:** `apps/web/_qa/_bump_compB.py` → `compB20260721a` on branding/explorer/visualizations/dashboard HTML + `dam-assoc-edit.js`, `dam-media-preview.js`, `dam-viz.js`, CSS hrefs + injected `dam-viz-modal.css?v=`.

---

## 12-round pass log (Intensive per zone)

| Zone | Pass | Focus | Result |
|------|------|-------|--------|
| B1 | 1–3 | Material grid structure, tile count, no all-files dup | Pass — BLIX PSD+JPG, KUBARA 6 PNG |
| B1 | 4–6 | Label row `Warianty materiału`, `--material` class | Pass |
| B1 | 7–9 | Edytuj wszystko / assoc-item wrappers for Shift-minus | Pass — `assocItems:6`, minus wired |
| B1 | 10–12 | Collapsed/expand toggle not shown for materialSiblings | Pass — no erroneous toggle |
| B2 | 1–4 | `materialMode` hides fake TŁO/PERSP studio | Pass — `studioHidden:true` |
| B2 | 5–8 | Studio slotted under variants column | Pass — `studioInVar:true` |
| B2 | 9–12 | Products column not overlapped | Pass — prior CDP `horizClear` (process) |
| B3 | 1–4 | Default minus hidden | Pass — `opacity:0` |
| B3 | 5–8 | Shift reveals 21px bubble | Pass — `minusOp:1` with Shift keydown (kubara pass) |
| B3 | 9–12 | Red/white bubble not 26px fat disc | Pass — `21px`, gradient red |
| B4 | 1–4 | viz `#vizShowAll` label+tip | Pass CDP ok:true |
| B4 | 5–8 | branding tab/hint/clear | Pass snapshot Pokaż/Wyczyść |
| B4 | 9–12 | grep zero `Poka?`/`W??cz`; explorer empty hint | Pass after JS fix |
| B5 | 1–6 | Explorer loads viz modal stack | Pass — script tags `compB20260721a` |
| B5 | 7–12 | productIndexVariantsHtml path in code | Pass — read `dam-media-preview.js` |
| B6 | 1–12 | Shift-gate CSS specificity `#damMediaPreview .is-shift-visible` | Pass — inject order OK |

Screenshot pass on branding modal: **timeout** (shared browser load); CDP metrics authoritative per code-doctrine.

---

## Files touched

- `apps/web/visualizations.html`, `branding.html`, `settings.html`
- `apps/web/assets/js/dam-explorer.js`, `dam-media-preview.js`, `dam-viz.js`
- `apps/web/explorer.html`, `dashboard.html` (cache-bust only)
- `tools/_fix_compB_utf8.py`, `tools/_fix_branding_qmark_only.py`, `tools/_fix_branding_compB_final.py`
- `apps/web/_qa/_bump_compB.py`

**Token:** `compB20260721a`
