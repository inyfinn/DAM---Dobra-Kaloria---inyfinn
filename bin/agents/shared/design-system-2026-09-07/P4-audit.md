# P4 audit — weak-model vs DESIGN_SYSTEM v1 → v2

**Date:** 2026-09-07  
**Worker:** P4 Intern (ui-create-design-system)  
**Inputs:** `DESIGN_SYSTEM.md` v1, `P1-computed-live.md`, parent P3 report  
**Sandbox:** `sandbox/branding-filter-card-fragment.html` — **STALE / DELETED** (removed by computed worker as "probes"). No HTML re-diff. Audit from P3 oral report + live computed file only.

---

## Blunt verdict on v1

**v1 was already good enough** that anti-patterns stay **almost empty** in the scary sense: no kit/hex/native-button/Geex-TRAP failures. Five **doc-gap / rhythm-precision** misses only. Core census winners, layer map, and TRAP prohibitions held.

---

## Compliance (observed hits)

| Rule | Evidence |
|------|----------|
| `.dam-viz-card` + `.dam-branding-card` | P3 report — census winners used |
| `.dam-viz-secondary-filters` + `--meta` | P3 report — meta band not scratch Bootstrap |
| Card anatomy not in `dam-viz.css` | No panel-sheet card override reported |
| Geex 16px sidebar TRAP avoided | P3 report; live confirms dam-tokens win (13.6px) |
| No `sidebar.css` / Bootstrap badge | P3 report |
| No unsourced brand hex | P3 report |

---

## Misses (observed only)

| # | Hole | Detail |
|---|------|--------|
| 1 | **H-origin** — missing tag-filter recipe | Omitted `.dam-branding-tag-filters` wrapper; v1 had content-arch row but no §5 recipe |
| 2 | **H-kit** — guessed CSS load order | Did not copy `branding.html:18-30` stack verbatim |
| 3 | **H-space** — extra local `<style>` | Sandbox spacing via inline block instead of winner `<link>`s |
| 4 | **H-space** — 2×8 vs calc chips | Picked literal `2px 8px`; live winner **2.1×8.4px** (primitives scale 1.05) |
| 5 | **H-space** — toolbar 8–14 unmapped | v1 said "8–14px declared" but did not map row/column; weak model used generic gap |

---

## Live corrections merged into v2 (from P1-computed-live)

| Topic | v1 claim | Live @ 2026-09-07 |
|-------|----------|-------------------|
| Sidebar link fs / pad | unverified ~13.6px | **13.6px**, **6.8×10.2px** ✓ |
| Filter band | 20×24, gap 10×12 | ✓ |
| Card body | 10×18×12, gap 13px | ✓; DOM class **`.dam-viz-card__body`** not `.dam-branding-card__body` |
| Badge radius | 14px | ✓ |
| Chip pad | `2px 8px` exception | **2.1×8.4px** — calc wins |
| Viz nested filter mb | 14px declared | **4px** nested |
| Branding grid-toolbar margin | 0 0 12px declared | **-4px 0 5px** |

P1 file evidence (`P1-tokens.md`, `P1-rhythm-and-widgets.md`) remains valid for file-level token declarations; computed supersedes unverified live cells only.

---

## Stale / deleted

- **`sandbox/`** — entire folder removed; do not recreate for P4; re-run P3 needs fresh sandbox if required.
- v1 runtime **DOWN** note — superseded; UI was UP for computed pass.

---

## Not done (explicit)

- No production CSS/JS unify
- No git commit
- No second weak-model pass (stop per parent)
