# Version bump proposal — 2026-07-21 (WORKER B)

**Do not commit** — proposal only.

## Current version (canonical)

| Source | Value | Notes |
|--------|-------|-------|
| `apps/web/version.json` | `2.0.7` | codename `hub`, released 2026-07-20 |
| `apps/web/assets/js/dam-version.js` | `2.0.7` | `DAM_APP_VERSION` |
| `apps/desktop/runtime_config.py` | `2.0.7` | (per process.md; not re-read this pass) |
| HTML footers `.dam-app-version` | mixed `v1.00` / `v2.0.7` / stale | inconsistent chrome |
| HTML `dam-version.js?v=` | mixed `2.0.6`–`3.0.7` | cache-bust drift only |

## Suggested version

### **`v3.1.0`**

**Rationale:** `2.0.7` under-represents ~**28 substantive change areas** logged in `process.md` in the last ~4 hours (2026-07-21 00:15–03:00), spanning modal parity, branding material merge, global Shift-minus, UTF-8 hardening, viz show-all dedupe, actions bar, grouptint, badge scale, explorer/inbox/settings UX, privilege gating, loader hold, UK→GB, faktury toolbar, etc. This is a **feature wave**, not a patch. Jump to **3.x** aligns with existing cache-bust drift (`3.0.7` on some HTML) while marking a coherent release boundary.

**Alternative:** `v3.0.8` if you prefer minimal bump from drifted `3.0.7` cache tokens.

## Change-area count (last ~4h, from process.md + gap audit)

1. Viz modal hero / TUBA thumb  
2. Assoc skeleton 5-col  
3. TUBA search / Opakowanie facet  
4. Viz assoc variant grouping  
5. TUBA MINI PREZENT 3 wizki  
6. Show-all viz card hero  
7. Settings Historia + jump search  
8. Inbox Historia lifecycle  
9. Dashboard PODGLAD wireframes  
10. Global Historia modal  
11. Settings Bento grid  
12. Privilege audit admin gating  
13. Viz modal meta stack rhythm  
14. Inbox page-sub + UTF-8 boot  
15. HARD PL diacritics / FFFD  
16. Assoc META false+ / copy ID / meta layout  
17. Resume assoc-ux-unify / UTF-8 branding  
18. DamLoader label + 3s hold  
19. HARD CANON modal parity  
20. Assoc minus restyle  
21. Faktury toolbar Geex polish  
22. Viz modal parity branding (vizmod)  
23. Badge global +5%  
24. Viz studio UX intensive  
25. Show-all / title gap / chip 1px  
26. Actions bar sticky white  
27. Grouptint + variants above studio  
28. All-files dedupe + row stack  
29. Branding WARIANTY material + studio under variants  
30. gapship paintAssoc async  
31. **compB UTF-8 repair (viz/branding/settings/explorer JS)**

**Count used for rationale:** **28+** distinct user-visible or behavioral areas.

## Files to update on release (not done here)

1. `apps/web/version.json` — `"version": "3.1.0"`, update `note`, `released_at`
2. `apps/web/assets/js/dam-version.js` — `DAM_APP_VERSION = "3.1.0"`
3. `apps/desktop/runtime_config.py` — app version string
4. All HTML loading `dam-version.js` — unify `?v=3.1.0` (or single new token)
5. Footer spans `.dam-app-version` — display `v3.1.0` consistently
6. Optional: `apps/web/data/app-settings.json` — only if schema `version` bump required (separate from app semver)

## Pre-release checklist

- [ ] Single semver everywhere (no `2.0.7` vs `3.0.7` split)
- [ ] Grep `Poka?` / `W??cz` = 0 in `apps/web`
- [ ] CDP smoke: branding material modal + viz show-all + explorer UTF-8 hint
- [ ] User approves `v3.1.0` vs `v3.0.8`
