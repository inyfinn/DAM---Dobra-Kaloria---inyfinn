# Handoff Faza 4 (Agent C — badges)

Właściciel: Agent C. **Nie edytuj** z Fazy 3. Lead scala przy join przed 5a.

Status: DONE — Pass (3 cykle)

Gate in: `geex-phase2` @ `16f0c95` + brief C. ESCALATE cleared.

## Done

1. **MASTER anatomy** w `dam-primitives.css` `/* === BADGES === */`:
   - `.dam-viz-badge` / `.dam-badge-tag` / `.dam-status-badge` + compound `.dam-viz-badge.dam-badge-tag`
   - `--_dam-badge-radius: 14px`; scale via `--dam-badge-scale`
   - modifiers = color only (dark AA lifts for muted/semantic)
   - `.dam-media-preview__ext-tag` = small variant (same radius/scale path)
2. **Scale kills (E2):**
   - `dam-branding.css` ext-tag `*1.1` → primitives anatomy
   - asset-id `1em * 1.1` → `var(--dam-badge-scale)`
   - filter pills `border-radius: 999px` → `var(--_dam-badge-radius, 14px)`
   - `dam-brand.css` ~6825 `* 1.05` literal → `var(--dam-badge-scale)` + radius 14
3. Sync `design-system/components/badges.md`
4. Cache bust `dam-primitives.css?v=geexF4badge20260721b` (+ branding/brand where surgical)

## Cycles

| # | Kod | CDP / visual | Wynik |
|---|-----|--------------|-------|
| 1 | BADGES fill + scale kills | scale OK (12.075 / pad 2.1×8.4); radius still 999 (branding filters) | Fail radius |
| 2 | higher-spec radius + branding 999→token | radius **14px**; scale OK; screenshot 1440 Read OK | Pass |
| 3 | dark AA + viz + wrap probe 360 | dark index `#d4d1de`; viz card pad 5.25×11.55 radius 14; wrapRows≥2 @360 | Pass |

## CDP evidence

- Branding MASTER: `border-radius: 14px`, `font-size: 12.075px`, `--dam-badge-scale: 1.05`
- Viz cards: `radius: 14px`, denser pad scaled
- Dark: `html[data-theme=dark] .dam-viz-badge--index` → `rgb(212,209,222)`

## Regress notes (local PNG only)

`apps/web/_qa/geex-realign-baseline/phase4/` (gitignore):
- `phase4-branding-light-1440.png`
- `phase4-branding-light-390-attempt.png`
- `phase4-branding-dark.png`

## Ryzyka / residual

- Host Emulation `innerWidth` stuck ~765 w Cursor browser — wrap zweryfikowany force `max-width:360` + mobile chrome UI.
- `dam-branding.css:799` `fs-base * 1.1` zostawione (audit: title/chip adjacent, nie badge).
- Later `dam-brand.css` single-class `999px` nadal w pliku — cascade wygrywa primitives `html body …` + branding token; F7 thin może usunąć duplikaty.
- Parallel Agent B może nadpisać `?v=` primitives — Lead join: scal bump.

## Tag / commit

- Commit message: `geex-realign: faza 4 badges`
- Tag: `geex-phase4`
