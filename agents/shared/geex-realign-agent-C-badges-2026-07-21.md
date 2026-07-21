# Agent C / Faza 4 — Badges (WRITE set)

**Branch:** `design/geex-realign`  
**Gate in:** tag `geex-phase2` + this brief + audit §2  
**Gate out:** tag `geex-phase4` + handoff **only** `geex-realign-handoff-faza4.md`  
**Model:** Grok 4.5 (default). No sub-agents unless Parent says.

## Role

You own **BADGES** anatomy: viz/status/tag chips + global scale. Fill `/* === BADGES === */` in `dam-primitives.css`. Kill local `*1.1` scale bypasses. Do not start until `geex-phase2` exists.

## WRITE (allowed)

| Path | What |
|------|------|
| `apps/web/assets/css/dam-primitives.css` | Section `/* === BADGES === */` … `/* === /BADGES === */` only |
| `design-system/components/badges.md` | Sync contract |
| Allowlist surgical lines in `dam-branding.css` | Only local scale kill (`* 1.1` → token) — minimal diff |
| Allowlist one line `dam-brand.css:6825` area | `* 1.05` → `var(--dam-badge-scale)` if still literal |
| HTML `?v=` for affected CSS | Cache bust |
| `agents/shared/geex-realign-handoff-faza4.md` | Done / risks |
| Optional notes-faza4 | Local PNG notes |

## DONT (forbidden)

- `/* === BUTTONS === */` / `/* === PANELS === */`
- Mass rewrite `dam-brand.css` / unrelated branding layout
- `process.md` / main regress manifest / handoff-faza3
- New tokens outside F2: use `--dam-badge-scale`, `--dam-tag-fs-pill`, `--dam-tag-fs-badge`, color tokens
- PNG in git
- Changing CTA / panel surfaces (B / F5)

## Exact requirements

1. **Obecnie:** `--dam-badge-scale: 1.05` global; branding local `*1.1`; brand.css literal `*1.05` (audit §2).
2. **Docelowo:** one scale path; MASTER badge radius target 14px; families stay (viz / badge-tag / status).
3. **Pliki:** primitives BADGES + docs + surgical scale kills + handoff-faza4.
4. **Done:** min 3 / max 5 cycles; regress vs phase0/phase2; commit `geex-realign: faza 4 badges`; tag `geex-phase4`; push.

## Verification

- CDP: computed scale uses `var(--dam-badge-scale)`; no `*1.1` left on badge selectors listed in audit.
- Screenshot+Read branding + visualizations 1440+390.
- Edge E2 closed or documented residual.

## Return (handoff-faza4)

Files, Pass/Fail, risks, ESCALATE line if blocked.
