# Icon button

**Audit:** `geex-realign-audit-2026-07-21.md` §1  
**Owner:** Agent 3 (with BUTTONS) — keep separate from text CTA  
**Primitives:** `/* === BUTTONS === */` (icon block) in `dam-primitives.css`

## Canonical (stays)

| Class | Role |
|-------|------|
| `.dam-icon-btn` | Square icon control (shell/header) |
| `.dam-menu-toggle` | Menu / collapse chrome |
| `.dam-viz-icon-btn` | Viz / modal icon control — **44×44** |

## Alias

| Legacy | Maps to |
|--------|---------|
| `.dam-btn-icon` / `.dam-btn-icon-only` | `.dam-icon-btn` |

## Tokens

- `--dam-control-h` (44) — width/height + min touch
- `--dam-radius-sm` / `--dam-control-radius` (8)
- `--dam-btn-outline-border`

## Rules

- Not folded into `.geex-btn` text CTA anatomy (radius stays control 8, not btn 18).
- Outline uses `--dam-btn-outline-border` (50% primary mix).
- Hover: 10% primary mix on surface — no white-flash.
