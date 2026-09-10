# P4 audit — Explorer secondary filter band (P3 sandbox 2026-09-09)

**Date:** 2026-09-09  
**Worker:** P4 Intern (ui-create-design-system Mode A)  
**Inputs:** `DESIGN_SYSTEM.md` v2 (P2 @ 2026-09-09), P0–P2 evidence, P3 sandbox files (HTML/CSS/PNG re-read)  
**Sandbox (live on disk):** `bin/agents/shared/design-system-2026-09-09/sandbox/explorer-filter-band.html`, `sandbox-stack.css`, `explorer-filter-band-screenshot.png`

**Blunt verdict:** v2 held census winners, TRAP prohibitions, and Explorer rhythm ownership. Three **doc-gap** holes blocked a DS-only build (brand chip class, inner skeleton, bootstrap path). Lab succeeded by cloning production markup/CSS paths outside §5 recipes. **No** kit/hex/Geex-16px/card-in-`dam-viz.css` failures.

---

## Screenshot confirmation

| Artifact | Claimed (P3) | Verified (P4 Read + PowerShell) |
|----------|--------------|----------------------------------|
| `explorer-filter-band-screenshot.png` | 1280×900, 37 134 B | **1280×900**, **37 134 B** ✓ |

Vision Read: filter band visible — Produkty/Materiały mode chips, Pokaż wszystkie switch (off), DK/GC brand chips, Wszystkie języki select; welcome pane below; token stack styling (no raw-hex look).

---

## WRONG (DS silent or misleading vs observed lab / census)

| id | Observed evidence | DS cited | Verdict |
|----|-------------------|----------|---------|
| **H-chip-brand** | Sandbox `#damExplorerBrandMount` uses `.dam-brand-chip-btn.dam-brand-chip-btn--dk\|--gc` (`explorer-filter-band.html:39-43`); production `dam-brand-filter.js:288-293` renders same; styles `dam-brand.css:623+`, `:3795` | §5.4 cites `.dam-viz-badge.dam-badge-tag` for filter pills; §8 census example `dam-viz-badge` — **no** `.dam-brand-chip-btn` recipe | **WRONG** — weak model following §5.4 alone would pick tag badges for DK/GC |
| **H-skeleton-explorer** | Sandbox + live DOM: `#damExplorerCatMode.dam-explorer-cat-mode` > `label.dam-db-mode-chip` > radio (`explorer-filter-band.html:22-30`; `explorer.html:910-918`); CSS `dam-brand.css:4499`, `:8310+` | §5.2 gives wrapper `.dam-viz-secondary-filters` only; §7 lists toolbar/filters row — **no** inner HTML skeleton | **WRONG** — DS pad/gap/mb documented (§6) but not clone markup for mode chips |
| **H-kit-bootstrap** | Explorer `explorer.html:30` → `./assets/vendor/css/bootstrap/bootstrap.css`; sandbox `@import` same path (`sandbox-stack.css:5`) | §1 canonical chain lists bare `bootstrap.css → style.css` (branding `branding.html:18-30` pattern); P0 explorer chain also abbreviates `bootstrap.css` | **WRONG** — ambiguous path; vendor subtree required on Explorer stack |

---

## RIGHT (DS held; lab succeeded because of named section)

| Observed evidence | DS section | Verdict |
|-------------------|------------|---------|
| Wrapper `.dam-viz-secondary-filters.dam-explorer-secondary-filters` (`explorer-filter-band.html:21`) | §5.2 | **RIGHT** — census winner used, not scratch Bootstrap row |
| Parent `.dam-explorer-shell` for explorer pad exception (shell zeros horizontal pad) | §6 — **20px 0px** explorer exception `dam-brand.css:4445-4449` | **RIGHT** — lab wrapped band in shell; did not copy viz **24px** horizontal |
| Explorer stack: tokens → primitives → app → tutorial → brand → bento; **no** `dam-viz.css` / `dam-branding.css` (`sandbox-stack.css:7-12`) | §2 layer map; P1-ownership-map Explorer chain | **RIGHT** — panel sheet omission matches production |
| No Geex 16px sidebar, no `sidebar.css`, no card anatomy in `dam-viz.css` | §2 TRAPs | **RIGHT** — TRAPs avoided (sandbox has no sidebar; no card overrides) |
| No raw hex in sandbox markup; colours from linked `--dam-*` stack | §3, §8 token vs hardcode | **RIGHT** — no unsourced brand hex |
| UTF-8 PL copy with diacritics (Pokaż, Materiały, języki); `&nbsp;` in subtitle (`explorer-filter-band.html:17`) | §4 UTF-8 doctrine | **RIGHT** — file encoding + nbsp bind |
| Clone vs scratch — IDs/classes mirror production explorer band | §8 clone vs scratch | **RIGHT** — not Bootstrap filter row |
| `.dam-explorer-panel.dam-explorer-welcome` empty canvas | §7 Explorer default canvas pattern | **RIGHT** — welcome copy static fallback |

---

## Do not add (already documented or lab-only)

| Topic | Reason |
|-------|--------|
| Explorer filter pad **20px 0px** + mb **14px** | Already §6 + P2/P1-computed-live — lab applied correctly, not a new hole |
| i18n orphans (**Kategorie**, JS hard-coded empty/loading) | Already §7 + P1-ownership-map — not newly proven by sandbox |
| Static lab omits `data-i18n` / `dam-i18n.js` | **Lab limitation** — DS §2 documents i18n overlay for production panels; does not claim static sandbox must wire JS |
| `python -m http.server` from sandbox folder → CSS 404 | **Lab ops note** (P3-lab-notes) — DS §1 does not falsely claim sandbox-only serve works; **P5 candidate** for lab HTTP root, not §9 anti-pattern |
| Prior §9 rows H-origin / H-kit / H-space (branding 2026-09-07) | Still valid for branding lab; **not duplicated** — different P3 task |

---

## P5 candidates (recipe recontent — do not edit §1–§8 in P4)

1. **§5 new recipe** — Explorer secondary filter band inner skeleton: `.dam-explorer-cat-mode`, `.dam-db-mode-chip`, `.dam-switch`, `#damExplorerBrandMount`, `#damExplorerLangFilter` (cite `explorer.html:909-928`).
2. **§5.4 addendum or §5.8** — Brand filter DK/GC: `.dam-brand-chip-btn` (+ `--dk` / `--gc` modifiers), owner `dam-brand.css` + `dam-brand-filter.js`; **not** `.dam-viz-badge`.
3. **§1 control plane** — Per-panel CSS chains with **full** bootstrap href (`assets/vendor/css/bootstrap/bootstrap.css` for Explorer); separate branding vs explorer stacks (already in P0/P1, not in §1 branding-only block).
4. **§1 or ops appendix** — Static DS lab HTTP root = `bin/` when sandbox `@import` reaches `apps/web/assets/`.

---

## Compliance summary (2026-09-09 explorer lab)

- Predicted traps (Geex 16px, `sidebar.css`, Bootstrap badge, `dam-viz.css` card override, raw hex) **did not occur**.
- Misses = **documentation silence** (3 rows), not cascade failure.
- Product files **untouched** in P3 — audit is sandbox vs DS only.

---

## Pass/Fail

| Gate | Result |
|------|--------|
| P4-audit.md from **this** lab | **PASS** |
| PNG WxH/bytes verified | **PASS** — 1280×900, 37 134 B |
| §9 net-new holes appended | **PASS** — 3 rows (see Parent return) |
| Product / version bump | **N/A** — forbidden |

**Blocked:** none.
