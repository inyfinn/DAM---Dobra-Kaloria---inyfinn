# Buttons (Geex CTA)

**Audit:** `geex-realign-audit-2026-07-21.md` §1 / §5  
**Owner anatomy:** Agent 3 (Faza 3) — brief `geex-realign-agent-B-buttons-2026-07-21.md`  
**Primitives section:** `/* === BUTTONS === */` w `dam-primitives.css`

## Canonical (stays)

| Class | Role | Declared measure (audit) |
|-------|------|--------------------------|
| `.geex-btn` | Base CTA | pad `15×25`, radius `18px`, gap `10px` |
| `.geex-btn--primary` | Filled primary | `bg var(--primary-color)` / white text |
| `.geex-btn--sm` | Compact | pad `12×22`, fs `13px` |
| `.geex-btn--transparent` | Ghost/outline | border `2px solid var(--dark-color)` |
| `.geex-btn--primary-transparent` | Outline primary | stays |
| `.geex-btn--danger` / `--danger-transparent` | Destructive | stays |
| `.geex-btn--success` / `--success-transparent` | Success | stays |
| `.geex-btn.nav-link` | Shell nav | **do not** fold into CTA primitives |

## Alias (F3 — keep class names in HTML)

| Legacy | Maps to |
|--------|---------|
| `.dam-win-btn` | outline secondary on `.geex-btn` (`--dam-btn-outline-border`) |
| `.dam-btn-primary` | `.geex-btn--primary` |
| `.dam-btn-icon` / `.dam-btn-icon-only` | `.dam-icon-btn` (see icon-btn.md) |

## Tokens (consumers)

- `--dam-radius-btn` (18)
- `--dam-space-btn-y` / `--dam-space-btn-x` (15 / 25)
- `--dam-primary` / `--dam-btn-outline-border`
- `--dam-danger` / `--dam-ok`

## Done (F3)

- Padding/radius/font via tokens; Geex-first modifiers.
- No mass rewrite of `dam-brand.css`; no delete of HTML class names yet.
