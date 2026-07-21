# Agent B / Faza 3 — Buttons (WRITE set)

**Branch:** `design/geex-realign`  
**Gate in:** tag `geex-phase2` + this brief + audit §1/§5  
**Gate out:** tag `geex-phase3` + handoff **only** `geex-realign-handoff-faza3.md`  
**Model:** Grok 4.5 (default). No sub-agents unless Parent says.

## Role

You own **BUTTONS** anatomy: Geex CTA + aliases + icon-btn touch. Fill `/* === BUTTONS === */` in `dam-primitives.css`. Do not start until `geex-phase2` exists.

## WRITE (allowed)

| Path | What |
|------|------|
| `apps/web/assets/css/dam-primitives.css` | Section `/* === BUTTONS === */` … `/* === /BUTTONS === */` only |
| `design-system/components/buttons.md` | Sync contract if anatomy changes |
| `design-system/components/icon-btn.md` | Sync if icon-btn changes |
| HTML `?v=` bump for `dam-primitives.css` (and tokens if needed) | Cache bust only |
| `agents/shared/geex-realign-handoff-faza3.md` | Done / risks / regress notes |
| Optional: `agents/shared/geex-realign-regress-notes-faza3.md` | Local PNG notes |

Inject page-local CSS from JS (`<style id>`) only if a single page needs a temporary bridge — prefer primitives.

## DONT (forbidden)

- `/* === BADGES === */` / `/* === PANELS === */` sections (Agent C / F5)
- Mass edit `dam-brand.css` / `dam-branding.css` / full `style.css` rewrite
- `process.md` append during F3 (race with C) — use handoff-faza3 only
- Main `geex-realign-regress-manifest.md` (Lead join)
- handoff-faza4
- New tokens “just in case” — use F2 tokens: `--dam-radius-btn`, `--dam-space-btn-*`, `--dam-control-h`, `--dam-btn-outline-border`, color tokens
- PNG in git
- Faza 4/5 scope

## Exact requirements

1. **Obecnie:** Geex btn pad/radius in `style.css`; DAM aliases diverge; dual radius 18 vs control 8 (edge E4).
2. **Docelowo:** `.geex-btn` (+ modifiers) wired to F2 tokens; aliases `.dam-win-btn`, `.dam-btn-primary` share anatomy without deleting HTML classes; `.dam-icon-btn` min 44×44 via `--dam-control-h`.
3. **Pliki:** primitives BUTTONS + docs sync + handoff-faza3.
4. **Done:** min 3 / max 5 verification cycles; local regress vs phase0/phase2; commit `geex-realign: faza 3 buttons`; tag `geex-phase3`; push.

## Verification

- CDP (when `:8765` up): `.geex-btn` radius ≈18, pad ≈15×25; icon-btn min-h ≥44.
- Screenshot+Read hot pages 1440+390 light (and dark if touched).
- `node` N/A for CSS; no invent tokens outside F2 set.

## Return (handoff-faza3)

Root cause/approach, files touched, Pass/Fail cycles, known risks, ESCALATE line if blocked.
