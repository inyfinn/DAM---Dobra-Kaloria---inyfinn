# P5 recontent — Explorer secondary filter band recipes

**Worker:** P5 (ui-create-design-system Mode A)  
**Captured:** 2026-09-09  
**Inputs:** P4-audit.md (3 doc-gap holes), P2-from-evidence.md, P1-ownership-map.md, production census `explorer.html`, sandbox (read-only)

---

## Pass/Fail

| Gate | Result |
|------|--------|
| All 4 P4 P5-candidates landed or deferred | **PASS** — 4/4 landed in DS |
| §9 H-* rows intact | **PASS** — no deletions; cross-refs added |
| Product files untouched | **PASS** — allowlist only |
| Unverified colour dates | **PASS** — no Captured bumps without new probe |

**P5 verdict:** **PASS** — recipes close P4 holes; P6 should re-screenshot explorer + sandbox vs new §5.8.

---

## Sections touched (DESIGN_SYSTEM.md)

| Section | Change |
|---------|--------|
| **Header** | P5 recontent stamp |
| **§1 Control plane** | Vendor bootstrap path; per-panel CSS chains (Branding / Explorer / Viz); DS lab HTTP root = `bin/` ops note |
| **§5.4 `.dam-viz-badge`** | Addendum — Explorer `.dam-brand-chip-btn` (+ `--dk` / `--gc`); not tag badges |
| **§5.8** (new) | Explorer secondary filter band inner skeleton — clone target `explorer.html:909-928` |
| **§7 Explorer panel** | Split secondary filter band row (§5.8) vs toolbar/tag chips |
| **§9 P3 2026-09-09** | One-line cross-refs on H-chip-brand / H-skeleton-explorer / H-kit-bootstrap → §5.4 addendum / §5.8 / §1 |

**Not touched:** §3 token tables, §4 glyph gate, §6 rhythm values, §8 workflow, prior §9 branding rows, `design-system-rhythm.mdc`.

---

## Selectors added to recipes

| Selector / ID | Section | Production census |
|---------------|---------|-------------------|
| `./assets/vendor/css/bootstrap/bootstrap.css` | §1 | `explorer.html:30`, `branding.html:19` |
| `#damExplorerCatMode.dam-explorer-cat-mode` | §5.8 | `explorer.html:910` |
| `label.dam-db-mode-chip` | §5.8 | `explorer.html:911-917` |
| `label.dam-switch` / `#damExplorerShowAll` | §5.8 | `explorer.html:920-923` |
| `#damExplorerBrandMount.dam-sidebar-brand-mount` | §5.4 addendum, §5.8 | `explorer.html:925` |
| `.dam-brand-chip-btn`, `.dam-brand-chip-btn--dk`, `.dam-brand-chip-btn--gc` | §5.4 addendum | `dam-brand-filter.js:288-293`; sandbox `explorer-filter-band.html:41-42` |
| `#damExplorerLangFilter.dam-control--select` | §5.8 | `explorer.html:926-928` |
| `.dam-explorer-shell` (wrapper for pad exception) | §5.8 | §6 ownership; sandbox `explorer-filter-band.html:20` |

**CSS owners cited:** `dam-brand.css:623+`, `:3795`, `:4499`, `:8310+`.

---

## P4 candidates — disposition

| P4 candidate | Status | DS landing |
|--------------|--------|------------|
| §5 inner skeleton (mode / switch / brand / lang) | **Landed** | §5.8 |
| §5.4 addendum brand chips | **Landed** | §5.4 addendum |
| §1 per-panel chains + vendor bootstrap | **Landed** | §1 table + text blocks |
| §1 lab HTTP root = `bin/` | **Landed** | §1 DS lab ops paragraph |

**Deferred:** none.

---

## Verification (rg)

```text
dam-brand-chip-btn     → §5.4 addendum, §5.8, §9 cross-ref
damExplorerCatMode     → §5.8, §7, §9 cross-ref
vendor/css/bootstrap   → §1 (Explorer + Branding chains)
§9 H-chip-brand        → present + see §5.4 addendum
§9 H-skeleton-explorer → present + see §5.8
§9 H-kit-bootstrap     → present + see §1
```

No `bin/apps/web/**` in git diff for this task.

---

## P6 recommendation

**Run P6 next:** live screenshot + Read of `explorer.html?v=5.0.178` filter band and sandbox `explorer-filter-band.html` served from `bin/` root — confirm visual match to §5.8 skeleton and §5.4 brand-chip addendum.

---

*End P5-recontent*
