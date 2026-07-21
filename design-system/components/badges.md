# Badges / chips

**Audit:** `geex-realign-audit-2026-07-21.md` §2 / §5  
**Owner anatomy:** Agent 4 (Faza 4) — brief `geex-realign-agent-C-badges-2026-07-21.md`  
**Primitives section:** `/* === BADGES === */` w `dam-primitives.css`

## Canonical (stays)

| Family | Role |
|--------|------|
| `.dam-viz-badge` (+ `--lang`, `--cat`, `--brand`, `--more`, …) | Product/meta chips — **primary** system |
| `.dam-badge-tag` (+ `--pakowanie`, `--tier-low`) | Branding tags |
| `.dam-viz-badge.dam-badge-tag` | **MASTER** anatomy (radius 14, shared scale) |
| `.dam-status-badge` (+ status, `--lg`) | Lifecycle status |
| `.dam-media-preview__ext-tag` | Small variant (same radius/scale path) |
| `.dam-tag-pill` / `.dam-tag-chip` / `.dam-tag-group*` | Tag editor chrome |
| `.dam-badge--msg` / `--notif` | Shell counters |
| `.geex-content__header__badge` | Geex header |

## Scale / shape tokens

| Token / local | Value | Role |
|---------------|-------|------|
| `--dam-badge-scale` | `1.05` | Global chip scale |
| `--dam-tag-fs-pill` | `10.5px` | Pill base fs |
| `--dam-tag-fs-badge` | `14px` | Status badge fs |
| `--_dam-badge-radius` | `14px` | MASTER radius (primitives) |

Modifiers (`--brand`, `--cat`, …) = **color only**.

## Local overrides killed (F4)

| Location | Was | Now |
|----------|-----|-----|
| `dam-branding.css` ext-tag pad/fs | `* 1.1` | anatomy in primitives + `--dam-badge-scale` |
| `dam-branding.css` asset-id | `1em * 1.1` | `1em * var(--dam-badge-scale)` |
| `dam-brand.css:6825` | `* 1.05` literal | `var(--dam-badge-scale)` + radius 14 |

## Done (F4)

- One global scale path; no page-local `*1.1` on badge selectors.
- MASTER radius 14px via `--_dam-badge-radius`.
- Dark AA for muted index/more/ext-default (+ semantic text lift).
