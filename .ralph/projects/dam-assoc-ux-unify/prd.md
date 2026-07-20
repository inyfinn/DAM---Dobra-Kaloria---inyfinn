# DAM Assoc UX Unify - Product Requirements Document

**Version:** 1.1  
**Date:** 2026-07-21  
**Status:** Active  
**Author:** Monday / DAM session resume  
**Upstream abandoned agent:** `e5c3f108-4480-4b3b-9087-86f2deca6593` (interrupted mid-port branding→viz)

---

## 1. Executive Summary

Unify visualization modal association UX with the working Branding product-grid patterns. Restore broken associations (Nuggets materials, M-SLI products), fix popover size/thumbs/tags, port Shift+/- density, fix PL mojibake in branding search, and use the global "Skojarzenia…" loader everywhere loads happen.

**Design Read:** Product DAM dashboard (Geex) for brand operators; calm B2B density; preserve Geex tokens; no marketing-landing aesthetics.

---

## 2. Goals & Success Metrics

### Goals
- Nuggets `6300586` shows real materials count (>0), not empty after over-filter
- M-SLI505326-06-26 shows correct associated products only
- Viz assoc pane Shift+/- matches branding product grid behavior (copy, do not reinvent)
- `#damAssocEditPopover` is 70vw × 90vh with working thumbs and intact tags
- Branding search PL strings render correctly (no `niemiÄ™sa`)
- Global DamLoader "Skojarzenia…" pill used for all loading states that currently invent their own chrome
- Spacing: filename↔meta 8px; title↔ID tight; tags↔title +10px vs previous

### Success Metrics
- Each user story below has `passes: true` only after screenshot+Read (ui-taste gate)
- CDP proofs for Nuggets materials count, popover box ratios, Shift scale class presence
- 30 ui-taste focus rounds (rundy = zones, each with multi-pass screenshot loops)

---

## 3. User Personas

1. **Brand operator (primary)** - Opens viz modal, checks associations, edits links, copies indices
2. **Admin** - Same surfaces plus settings; must not lose privilege gates already shipped

---

## 4. Feature Scope

### 4.1 MVP (Phase 1) - Core Feature

**Priority: HIGHEST**

| Feature | Description | Priority |
|---------|-------------|----------|
| Nuggets materials restore | Fix over-aggressive phone-dump / index-scope filter so packaging materials return | P0 |
| M-SLI product filter | Associated products for spray/folder assets must match real product indices | P0 |
| Assoc popover size | `#damAssocEditPopover` = 70vw × 90vh | P0 |
| Assoc thumbs + tags | No false "Brak miniatury"; tags not clipped / wrong style | P0 |
| Shift+/- unify | Copy branding grid density handlers into viz assoc pane | P0 |
| Variant grouping | XL/L/S + z tłem/bez tła like branding media-preview body | P0 |
| Spacing meta | filename↔meta 8px; title↔ID close; tags gap +10px | P0 |
| Branding PL search | Fix mojibake on `#damBrandingSearch` placeholder/tip | P0 |
| Global loader | DamLoader Skojarzenia pill for all load surfaces | P1 |
| Right-click copy indices | Product index copy (e.g. 6300728) works in assoc/list contexts | P1 |

### 4.2 Out of scope
- New marketing pages
- Re-litigating completed Pass items (UTF-8 site-wide, settings bento, privilege audit) unless regression found
- `ralph start` autonomous commits on this branch without parent review (parent will commit+push)

---

## 5. User Stories (Ralph JSON source)

### US-01: Nuggets materials restored
**Description:** As an operator, when I open Nuggets `6300586` viz associations, I see packaging materials again.  
**Acceptance Criteria:**
- [ ] Live label `Skojarzone materiały (N)` with N ≥ 1 (target ~40+ groups if index healthy)
- [ ] Screenshot `loop-*-nuggets.png` shows material tiles, not empty state
- [ ] Filter still excludes true phone-dump `IMG_*` noise

### US-02: M-SLI products correct
**Description:** As an operator, M-SLI505326-06-26 shows only correctly linked products.  
**Acceptance Criteria:**
- [ ] Associated products list matches folder/spray product indices for `br-005326` / M-SLI505326
- [ ] No random unrelated SKUs dominating the pane

### US-03: Assoc edit popover 70vw×90vh
**Description:** Assoc edit overlay matches lifecycle modal scale.  
**Acceptance Criteria:**
- [ ] CDP: `#damAssocEditPopover` width ≈ 0.70 * vw, height ≈ 0.90 * vh
- [ ] Cache-bust bump on changed CSS/JS HTML refs

### US-04: Thumbs and tags in assoc edit
**Description:** Preview tiles show real thumbs; tags readable.  
**Acceptance Criteria:**
- [ ] No "Brak miniatury" when thumb_url / media exists
- [ ] Tags not cut off; Geex chip style consistent

### US-05: Shift+/- density (copy branding)
**Description:** Viz assoc pane density follows branding product grid Shift+/-.  
**Acceptance Criteria:**
- [ ] Same key handling and scale steps as branding (read branding source first)
- [ ] Screenshot before/after Shift+Minus and Shift+Plus shows tile size change
- [ ] Do not invent a second density system

### US-06: Variant grouping XL/L/S
**Description:** Viz variants grouped like branding media-preview body.  
**Acceptance Criteria:**
- [ ] Groups: size XL/L/S and background z tłem / bez tła visible
- [ ] Matches branding template structure (selectors adapted, not reinvented)

### US-07: Meta spacing
**Description:** Tight meta stack with tags breathing room.  
**Acceptance Criteria:**
- [ ] filename↔meta gap ≈ 8px
- [ ] title↔ID same tight family
- [ ] tags↔title = previous + 10px

### US-08: Branding search PL
**Description:** Polish search UI strings correct.  
**Acceptance Criteria:**
- [ ] `#damBrandingSearch` placeholder/tip has no mojibake (`mięsa` not `niemiÄ™sa`)
- [ ] UTF-8 source + cache-bust

### US-09: Global Skojarzenia loader
**Description:** One loader language site-wide for loading waits.  
**Acceptance Criteria:**
- [ ] DamLoader / Skojarzenia pill used for assoc and other primary load waits
- [ ] No one-off spinner inventing new chrome where DamLoader exists

### US-10: Right-click copy product index
**Description:** Copy product indices from assoc/list works.  
**Acceptance Criteria:**
- [ ] Context menu / copy path yields index like `6300728` (not broken empty)
- [ ] Works outside fragile clipboard automation focus cases (prove via JS API + UI path)

---

## 6. Technical Notes

### Files (WRITE allowlist)
- `apps/web/assets/js/dam-media-preview.js`
- `apps/web/assets/js/dam-viz.js`
- `apps/web/assets/js/dam-assoc-edit.js`
- `apps/web/assets/js/dam-branding.js` (read-first for Shift; edit only if shared helper extraction needed)
- `apps/web/assets/js/dam-loader.js`
- `apps/web/assets/js/dam-i18n.js` / `apps/web/i18n/pl.json`
- `apps/web/assets/css/dam-viz-modal.css`
- `apps/web/assets/css/dam-brand.css` / `dam-branding.css` (only as needed)
- `apps/web/branding.html`, `visualizations.html` (cache-bust `?v=`)
- `process.md`, `memory.md` (log only)

### Constraints
- Root: DAM repo only; Geex UI; em-dash ban in UI copy
- READ: `agents/shared/code-doctrine.md`, `program-instructions.json`, skill `dam-dobrakaloria`
- Cache-bust every changed JS/CSS HTML ref
- Screenshot+Read HARD GATE; CDP stronger than stale frames
- Do NOT declare passes:true from diff alone
- No `ralph start` commits in worker — parent commits

### Verification loop (ui-taste)
- 30 focus rounds (zones), each green before next zone
- Viewports where relevant: 1280 primary for viz modal; 375/768 if branding search
- Local URL: `http://127.0.0.1:8765/` (+ bridge `:8766`)

---

## 7. Risks

- Over-filter restore may reintroduce phone-dump noise — keep IMG_* hard ban
- Concurrent agents editing same JS — single writer for this PRD
- Dual bridge processes — prefer one healthy `:8766`

---

## 8. Open Questions

None blocking. Supersede interrupt brief from 2026-07-21 is source of truth for UX numbers (70vw×90vh, 8px, +10px tags).
