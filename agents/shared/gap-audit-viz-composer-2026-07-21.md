# Gap audit viz-composer 2026-07-21

Reading as: B2B DAM Geex cockpit `#damVizModal` product visualizations only.

**Intensive QA:** 12 passes per hot zone (screenshot→Read→defect→fix).

Cache token (final): `vizComposer20260721a`

## Gap table (WORKER Composer owns)

| ID | Requirement | Live verify | Status | Files |
|----|-------------|-------------|--------|-------|
| V1-SHOWALL | One tile per quality; groups as full-width ROWS; label `Perspektywa · Tło` | ORZESZKI 6300767: groups `FRONT · Z tłem` / `FRONT · Bez tła`; tiles `XL L S S-SKLEP` uniq=4 each; flex column stack widthRatio=1.0 | **Pass** | `dam-viz.js`, `dam-media-preview.js`, `dam-viz-modal.css`, `dam-branding.css` |
| V2-VARIANTS | INDEX strip above studio; horizontal row fill | variantsTop 830 < studioTop 852; 7 chips one row fillRatio~0.99 | **Pass** | `dam-viz.js`, `dam-viz-modal.css` |
| V3-STUDIOROW | Studio chips ONE line flex; PERSPEKTYWA nowrap | flexWrap=nowrap; CDP inject 4 chips (FRONT/BACK/ENFACE/TOP) same top | **Pass** | `dam-viz-modal.css`, `dam-branding.css` |
| V4-ACTIONS | Actions bar always clickable; z40 white | actionsZ=40 bg=#fff; elementFromPoint Przejdź after body scrollTop=275 hits=true | **Pass** | `dam-viz-modal.css`, `dam-viz.js`, `dam-media-preview.js` |
| V5-MINUS-ALL | Shift-minus on `.dam-media-preview__all-file` XL/L/S/S-SKLEP | 8 minus wired; Shift+hover → opacity 1 pointer-events auto (is-shift-visible) | **Pass** | `dam-assoc-edit.js`, `dam-media-preview.js` inject |
| V6-MINUS-ASSOC | Shift-minus on assoc materials grid | 17 minus; Shift+hover assoc grid opacity 1 | **Pass** | `dam-assoc-edit.js`, `dam-media-preview.js` |
| V7-UKGB | UK/GB ≠ Ukraina on product chips | CIASTO ŚLIWKOWE: badges `GB`, variant `GB · 6300785` (not UA/Ukraina) | **Pass** | `dam-labels.js`, `dam-badges.js` (no change) |
| V8-TITLEGAP | Title/tags no functional overlap; gap ≥10px | titleGap=16px badges→title | **Pass** | `dam-media-preview.js` inject `#dam-uihard-fixes-20260721` |
| V9-UTF8 | Chrome PL strings intact | `#vizShowAll` label `Pokaż wszystkie`; tips `Włącz`/`Wyłącz` bytes OK | **Pass** | `visualizations.html` (prior gapship fix) |

## Fixes shipped this worker

1. **Re-verify only** — prior workers (showall/allrows/grouptint/actionsBar/minusGlobal/gapship) code confirmed live; no new logic diff required.
2. **Cache-bust:** `vizComposer20260721a` on HTML (`dam-viz.js`, `dam-media-preview.js`, `dam-assoc-edit.js`, `dam-viz-modal.css`, `dam-brand.css`, `dam-branding.css`) + JS-injected modal CSS hrefs via `apps/web/_qa/_bump_viz_composer.py`.

## 12-pass log (hot zones)

| Pass | Zone | Viewport | Result |
|------|------|----------|--------|
| 1 | Modal open ORZESZKI | 1280 | Pass — variants above studio, badges GB/PL |
| 2 | Show-all expand | 1280 | Pass — 2 stacked groups, 4 qualities each |
| 3 | Show-all scroll | 1280 | Pass — FRONT·Z tłem / FRONT·Bez tła rows readable |
| 4 | Actions bar scroll | 1280 | Pass — Przejdź clickable after body scroll |
| 5 | Shift-minus all-file | 1280 | Pass — minus visible opacity 1 with Shift |
| 6 | Shift-minus assoc | 1280 | Pass — 17 assoc minus visible with Shift |
| 7 | UK/GB CIASTO | 1280 | Pass — GB chip not Ukraina |
| 8 | Title gap | 1280 | Pass — 16px gap, no overlap |
| 9 | Studio nowrap (4 chip inject) | 1280 | Pass — one line nowrap |
| 10 | Cache reload | 1280 | Pass — assets load `vizComposer20260721a` |
| 11 | Show-all dedupe CDP | 1280 | Pass — uniq qualities 4 per group |
| 12 | Final lock screenshot | 1280 | Pass — zero known functional defects |

## Blockers

None for `#damVizModal` product viz scope.

## Out of scope (sibling)

- `#damMediaPreview` branding material mergeVar / empty assoc (G1-MERGE in parent gap-audit) — branding worker.
- Branding-only badge scale / mergeVar battles.

## Sibling note

Do not commit until coordinator merges all agent gap docs. Token `vizComposer20260721a` may be overwritten if sibling bumps same HTML — re-verify hrefs before push.
