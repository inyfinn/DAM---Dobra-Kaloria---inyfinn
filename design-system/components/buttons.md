# Buttons (Geex CTA)

**Audit:** `geex-realign-audit-2026-07-21.md` §1 / §5  
**Owner anatomy:** Agent 3 (Faza 3) — brief `geex-realign-agent-B-buttons-2026-07-21.md`  
**Primitives section:** `/* === BUTTONS === */` w `dam-primitives.css`

## Canonical (stays)

| Class | Role | Declared measure |
|-------|------|------------------|
| `.geex-btn` | Base CTA | pad `15×25` (`--dam-space-btn-*`), radius `18` (`--dam-radius-btn`), gap `10px`, **min-height 44** (`--dam-control-h`) |
| `.geex-btn--primary` | Filled primary | `bg var(--dam-primary)` / white text; hover tinted (no flash) |
| `.geex-btn--secondary` | Outline secondary | surface `--dam-btn-outline-border`; hover 10% primary mix |
| `.geex-btn--danger` | Destructive | `bg var(--dam-danger)` |
| `.geex-btn--ghost` / `--transparent` | Ghost/outline | transparent + border; hover tinted, **no white fill** |
| `.geex-btn--sm` | Compact pad | pad `12×22`, fs `13px`, still min-h 44 |
| `.geex-btn.nav-link` | Shell nav | **do not** fold into CTA primitives |

## Alias (F3 — keep class names in HTML)

| Legacy | Maps to |
|--------|---------|
| `.dam-win-btn` | outline secondary anatomy |
| `.dam-btn-primary` | `.geex-btn--primary` |
| `.dam-tut__btn` | Geex pad/radius/height via `dam-tutorial.css` alias |
| `.dam-btn-icon` / `.dam-btn-icon-only` | `.dam-icon-btn` (see icon-btn.md) |

## Tokens (consumers)

- `--dam-radius-btn` (18)
- `--dam-space-btn-y` / `--dam-space-btn-x` (15 / 25)
- `--dam-control-h` (44)
- `--dam-primary` / `--dam-btn-outline-border`
- `--dam-danger` / `--dam-ok`

## Done (F3)

- Padding/radius/min-height via F2 tokens; Geex-first modifiers + secondary/ghost.
- Anti white-flash on secondary/ghost/icon hover (color-mix, not forced `#fff` + white text).
- No mass rewrite of `dam-brand.css`; no delete of HTML class names.
