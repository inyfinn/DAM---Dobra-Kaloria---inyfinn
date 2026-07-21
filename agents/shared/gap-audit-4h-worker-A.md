# Gap audit 4h — WORKER A (viz / product modal)

**Design Read:** B2B DAM Geex cockpit Dobra Kaloria — FUNCTIONS over micro-copy.

**Token:** `compA20260721a`  
**Intensive QA:** 12 passes × zones with fixes (UK dict + cache sync); re-verify zones already SHIPPED.

**Method:** `process.md` tail · `memory.md` · `program-instructions.json` · code grep · CDP `@ http://127.0.0.1:8765` · screenshot→Read on viz modal.

**Sibling refs (read-only):** gapship `30dbc941`, utf8 `17759948`, minus `ba480cc7`, merge `36990489`, studioRow `db41aeb5`.

---

## Gap table (FUNCTION claims)

| ID | Claim | Code evidence | CDP / live | Status |
|----|-------|---------------|------------|--------|
| A1 | Product INDEX variants **above** studio TŁO\|PERSPEKTYWA\|JAKOŚĆ | `buildProductVariantStripHtml` before `#damVizModalStudio` (`dam-viz.js`); CSS `dam-viz-modal__product-variants` | `jab-ko-cynamon`: pvTop 769 < studioTop 950; 7 INDEX chips | **SHIPPED** |
| A2 | Studio 3 frames TŁO \| PERSPEKTYWA \| JAKOŚĆ | `.dam-media-preview__studio--tri`; frame labels in JS | frameLabels `[Tło, Perspektywa, Jakość]`; studioTri true | **SHIPPED** |
| A3 | Show-all: dedupe XL/L/S/S-SKLEP per group | `allrows20260721a` dedupe in `dam-viz.js` / `dam-media-preview.js` | `orzeszki-kukurydza-miod`: 4 groups × uniq `[XL,L,S,S-SKLEP]`, dupes false | **SHIPPED** |
| A4 | Show-all: groups as **ROWS** not columns | CSS `flex-direction: column`; group `width:100%` | rowStack true; widthRatio 1.0; allFilesDisplay column | **SHIPPED** |
| A5 | Group tint `#f5f6fa` | `--dam-surface-muted` / explicit `#f5f6fa` in CSS + JS inject | framesBg + group bg `rgb(245,246,250)` | **SHIPPED** |
| A6 | Actions bar pinned white z40 clickable over all-files | Actions sibling under `__main`; `dam-viz-modal.css` z-index 40 | actionsZ 40, actionsBg white; elementFromPoint hits Przejdź after scroll | **SHIPPED** |
| A7 | Studio chips ONE flex row (no TYL-ENFACE wrap) | `studioRow20260721a`: `.studio-frame-chips { flex-wrap: nowrap }` | perspWrap nowrap; perspRowH 28 with 2 chips | **SHIPPED** |
| A8 | Shift-minus on `.dam-media-preview__all-file` + assoc (viz global) | `wireStudioAllFiles` + inject `#damVizModal … is-shift-hover` | 16 minus btns on all-files; opacity 1 with `is-shift-hover` | **SHIPPED** |
| A9 | UK→GB not Ukraina on product chips | `DamLabels.normalizeLangCode` uk→gb; `dam-labels.js` | variantLabels include `GB · …`; hasUkraina false | **SHIPPED** (UI) |
| A10 | Title / badges gap | `dam-viz-modal.css` body gap + title padding | gapPx 16 on jab-ko modal | **SHIPPED** |
| A11 | Active outline chips 1px | Quiet outline rules `dam-viz-modal.css` | chipBorder 1px | **SHIPPED** |
| A12 | Pokaż wszystkie + PL chrome UTF-8 on viz page | `visualizations.html` bytes; `#vizShowAll` label | showAll=`Pokaż wszystkie`; tip `Włącz:`; no `?` mojibake | **SHIPPED** |
| A13 | naming-dictionary `uk` ≠ Ukraina (data layer) | Was `"uk":"Ukraina"`, alias `ua→uk` | N/A (static JSON) | **PARTIAL → FIXED** |
| A14 | Injected `dam-viz-modal.css?v=` matches HTML cache | JS inject hrefs | Was `brandComposer20260721a` while siblings churn tokens | **PARTIAL → FIXED** |

**SUPERSEDED:** Branding `#damMediaPreview` material studio-under-variants (`brandVar20260721a`) — Worker A spot-check only; primary ownership B.

**ABANDONED (by design):** Shift-minus on INDEX variant strip (`.dam-viz-modal__variant`) — tiles are product-index pickers, not assoc removals; minus wired on all-files + branding assoc items only.

---

## Fixes shipped (WORKER A)

1. **A13:** `naming-dictionary.json` — `languages.uk` → `Wielka Brytania`; `lang_aliases.uk` → `gb`; `lang_aliases.ua` → `ua`; added `languages.ua` → `Ukraina`. UTF-8 via Python only.
2. **A14:** Cache-bust `compA20260721a` on `visualizations.html`, `explorer.html`, `dashboard.html` for viz-modal JS/CSS + inject hrefs in `dam-viz.js`, `dam-media-preview.js`.
3. Tool: `tools/_bump_compA20260721a.py`.

---

## Intensive QA — 12 passes (viz modal zones)

| Pass | Focus | Result |
|------|--------|--------|
| 1 | Structure: variants above studio, 3 frames | Clean |
| 2 | Show-all row stack + dedupe qualities | Clean |
| 3 | Group tint `#f5f6fa` on frames/groups/variants strip | Clean |
| 4 | Actions bar z40 white + elementFromPoint after expand | Clean |
| 5 | Studio chip row nowrap (Perspektywa frame) | Clean |
| 6 | Shift-minus visible on all-file with is-shift-hover | Clean |
| 7 | GB chip labels (no Ukraina) | Clean |
| 8 | Title/badges gap ≥12px | Clean (16px) |
| 9 | Active chip border 1px | Clean |
| 10 | UTF-8 `#vizShowAll` + studio btn `Pokaż wszystkie` | Clean |
| 11 | Reload w/ `?v=compA20260721a` — CSS inject token | Clean |
| 12 | Full modal screenshot orzeszki expanded all-files | Clean |

**Pass/Fail:** **Pass** (12/12) after A13+A14 fixes.

---

## Blocked

- None for Worker A scope.
- Worker B may overwrite shared HTML `?v=` on `dam-brand.css` / `dam-labels.js` — re-run bump before gapship commit if tokens diverge.

---

## Files touched

- `apps/web/data/naming-dictionary.json`
- `apps/web/visualizations.html`, `explorer.html`, `dashboard.html`
- `apps/web/assets/js/dam-viz.js`, `dam-media-preview.js`
- `tools/_bump_compA20260721a.py`
- `agents/shared/gap-audit-4h-worker-A.md` (this file)
