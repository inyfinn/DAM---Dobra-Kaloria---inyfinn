# Geex realign + follow-up — CHANGELOG 2026-07-21

**Status inventory (verbatim):**

| Item | Value |
|------|--------|
| `origin/main` tip | `689e112` — inventory close (card air, dark tokens, baseline 36/36) |
| DONE on tip | geex merge `a4ba7c4`, pad-fix `74eb7eb`/`a400726`, PAKIET `435ea6b`, ctaUnify `df870e2`, inventory close `689e112` |
| Tags | `geex-phase0`..`4`, `5a`, `5b`, `6`, `7`, `8` + `design-geex-realign` @ `88d6a7e` (**NO** bare `geex-phase5`) |
| ESCALATE | none |
| PARTIAL/OPEN | `stash@{0}` WIP (marketing↔viz, branding air, dark polish, baseline PNG **36/36** local — closed on `689e112`) |

**Rollback recipes:** [`geex-realign-ROLLBACK-2026-07-21.md`](geex-realign-ROLLBACK-2026-07-21.md)  
**Plan status:** CLOSED — [`geex-realign-plan-2026-07-21.md`](geex-realign-plan-2026-07-21.md)

---

## Timeline (phases + follow-ups)

| Phase | Tag / commit | Full SHA | Summary |
|-------|--------------|----------|---------|
| Backup / pre-realign | (no tag) `092821f` | `092821ff4bd2378d915ea32c777582d56f34e756` | Backup before Geex design-system realign; first parent of merge `a4ba7c4` |
| F0 baseline | `geex-phase0` → `efdf632` | `efdf632e09074254c8a9c157f2c76f157ea91904` | Branch scaffold; PNG gitignore; baseline PARTIAL (fonts/locks); capture scripts; handoff |
| F1 audit | `geex-phase1` → `17e2dc3` | `17e2dc3ef495bce7adb02c9b32ab16f8f6fc1d3f` | Inventory / audit md |
| F2 tokens | `geex-phase2` → `16f0c95` | `16f0c9583f45b757c434e139ef0e90d5f5d90d0c` | Tokens + primitives docs |
| F3 buttons | `geex-phase3` → `7c9d346` | `7c9d34670da0596728c0c0b59815c507eaec74ce` | Global buttons / Geex CTA anatomy |
| F4 badges | `geex-phase4` → `3ee60bf` | `3ee60bf89bd0080a1e2010fa77d0aba23fa67723` | Global badges |
| F5a surfaces | `geex-phase5a` → `9b5cea5` | `9b5cea5eefa324719bce5b73ebb5d1d5c00e4de6` | Surfaces join after F3+F4 |
| F5b popovers | `geex-phase5b` → `3d457df` | `3d457df3476bdb6ae8a572ec2945efe7e665bec8` | Popover surfaces (§7 IO-safe) |
| F6 dark bridge | `geex-phase6` → `5c33525` | `5c335253d35d1f0ba93e64a1d29f179351f34d26` | Anti white-flash (early bridge + color-scheme) |
| F7 thin brand | `geex-phase7` → `c6023e3` | `c6023e3f9f747b9396ec51a2deaf6f9646c5d79f` | Thin brand badge/btn duplicates |
| F8 final QA | `geex-phase8` → `339fec9` | `339fec9e75535f4fa2832f27af90a0184843cb96` | Final QA PASS + doctrine lesson |
| Taste unify | `design-geex-realign` → `88d6a7e` | `88d6a7e53957daea9f466730a66a1eb3f4b9d5e6` | KEEP product look; pad/gap unify; fixture Jost |
| Merge → main | `a4ba7c4` | `a4ba7c4f6a650ee68c6f9a8334bf450c61f1e453` | Merge `design/geex-realign` (F0–F8 + taste unify) |
| Pad-fix (circles) | `74eb7eb` | `74eb7eb0c07526288120c9f43084d65ddf032f25` | Restore labeled modal CTAs; compact project/marketing pads (no circle CTAs) |
| Pad-fix merge | `a400726` | `a400726e1351b7622195d70bb0c237e2e63d2678` | Merge branch CTA pad fix |
| Doctrine note | `0bb7fad` | `0bb7fadf0db3c0b75251c98955d7d38bb7195c1e` | Lesson: labeled `dam-btn-icon` vs icon-only squares |
| PAKIET | `435ea6b` | `435ea6b6a6bb0cbca393326024a7597168f6900c` | Explorer PAKIET zip → 3-DRUK + show-all filter |
| CTA unify | `df870e2` | `df870e2406c6472ca4c49bcfbdb010e8a57bba70` | Projects `dam-int-cta` 12px/34px + Info Pakowania = dam-switch |
| Inventory close (tip) | `689e112` | `689e1123dc83afcca1ce8e6989bb0bae610a803a` | marketing catalog cards air/readable; branding/viz card breathing room; dark polish tokens + h5 title fix; baseline PNG 36/36 local; cache-bust `invClose20260721b` |

Sibling on branch (same message as PAKIET, not tip): `a4e9d35` — use `435ea6b` for main-line revert.

---

## User taste decisions (KEEP)

1. **KEEP buttons** — product CTA look retained; unify pads/gaps, not redesign chrome into generic AI look.
2. **No circle CTAs** — labeled modal / card actions stay pill/rect; pad-fix `74eb7eb` undid square/circle regressions.
3. **Compact 12px** — `dam-int-cta` / secondary filters: font 12px, control height ~34px (`ctaUnify` `df870e2`).
4. **Info Pakowania = dam-switch** — same `dam-switch--compact` pattern as Visualizations, on Projects.

---

## Key files touched (by phase / follow-up)

| Bucket | Primary paths |
|--------|----------------|
| F0–F2 | `agents/shared/geex-realign-*`, `.gitignore` (PNG baseline), `design-system/**`, `apps/web/assets/css/dam-tokens.css`, `dam-primitives.css` |
| F3–F4 | `dam-primitives.css`, handoff/regress notes, HTML `?v=` bumps |
| F5a–F5b | `dam-primitives.css`, surfaces docs, regress manifest |
| F6 | `dam-tokens.css`, `dam-theme.js`, `dam-shell.js`, early head bridge on HTML |
| F7 | `dam-brand.css` (thin badge/btn duplicates) |
| F8 | `code-doctrine.md`, regress manifest, process.md |
| Taste | `dam-tokens.css`, `dam-primitives.css`, `dam-brand.css`, fixture `geex-f3-buttons-fixture.html` |
| Pad-fix | `dam-primitives.css`, `dam-project-catalog.css`, `dam-viz-modal.css`, `dam-ui-cta.js`, `dam-app.css`, `dam-brand.css` |
| PAKIET | `apps/desktop/local_bridge.py`, `apps/web/assets/js/dam-explorer.js` |
| CTA unify | `dam-primitives.css`, `dam-ui-cta.js`, `dam-app.css`, `index.html` (+ cache-bust HTML) |
| Inventory close | `dam-project-catalog.css`, `dam-branding.css`, `dam-brand.css`, `dam-viz-modal.css`, `dam-dashboard.css`, HTML cache-bust `invClose20260721b` |

---

## Inventory close — `689e112` (2026-07-21)

**Commit:** `689e1123dc83afcca1ce8e6989bb0bae610a803a` — `fix(ui): inventory close - card air, dark tokens, baseline 36/36`

**Closed on this commit:**

1. **Marketing catalog cards air/readable** — `dam-project-catalog.css`: spacing, title/body contrast, card grid parity with viz cards.
2. **Branding / viz card breathing room** — `dam-branding.css`, `dam-viz-modal.css`: card body pad/gap, grid air, modal card rhythm.
3. **Dark polish tokens + h5 title fix** — `dam-brand.css`, `dam-dashboard.css`: dark-mode token pass; h5 card titles readable in dark.
4. **Baseline PNG 36/36 local** — full local capture set (gitignored); regress manifest updated.
5. **Cache-bust `invClose20260721b`** — HTML `?v=` bumps across affected pages (explorer, branding, visualizations, dashboard, etc.).

**Rollback:** `git revert 689e112 --no-edit` — see [`geex-realign-ROLLBACK-2026-07-21.md`](geex-realign-ROLLBACK-2026-07-21.md).

---

## PARTIAL / OPEN (honest)

- **Baseline PNG:** **36/36** local on `689e112` (was 28/36 pre-close). PNGs are gitignored — do not treat missing PNG as code failure.
- ~~**marketing ↔ viz cards**~~ — closed `689e112`.
- ~~**branding air**~~ — closed `689e112`.
- ~~**broader dark polish**~~ — token pass closed `689e112`; F6 still owns anti white-flash bridge.
- **`stash@{0}`:** `WIP before main merge (pad-fix)` on `design/geex-realign` — do not auto-apply; audit before `stash pop`.
- **ESCALATE geex-realign:** none (as of this doc).

---

## Audit pointers

- Plan: `agents/shared/geex-realign-plan-2026-07-21.md` → status **CLOSED**
- Audit: `agents/shared/geex-realign-audit-2026-07-21.md`
- Regress manifest: `agents/shared/geex-realign-regress-manifest.md`
- Doctrine lessons: `agents/shared/code-doctrine.md` (§12 entries from F8 + labeled CTA)
- Operational log: `process.md` (top entries 2026-07-21 Geex*)
