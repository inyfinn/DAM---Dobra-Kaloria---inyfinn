# Badges / chips

**Audit:** `geex-realign-audit-2026-07-21.md` §2 / §5  
**Owner anatomy:** Agent 4 (Faza 4) — brief `geex-realign-agent-C-badges-2026-07-21.md`  
**Primitives section:** `/* === BADGES === */` w `dam-primitives.css`

## Canonical (stays)

| Family | Role |
|--------|------|
| `.dam-viz-badge` (+ `--lang`, `--cat`, `--brand`, `--more`, …) | Product/meta chips — **primary** system |
| `.dam-badge-tag` (+ `--pakowanie`, `--tier-low`) | Branding tags |
| `.dam-status-badge` (+ status, `--lg`) | Lifecycle status |
| `.dam-tag-pill` / `.dam-tag-chip` / `.dam-tag-group*` | Tag editor chrome |
| `.dam-badge--msg` / `--notif` | Shell counters |
| `.geex-content__header__badge` | Geex header |

## Scale tokens

| Token | Value |
|-------|-------|
| `--dam-badge-scale` | `1.05` |
| `--dam-tag-fs-pill` | `10.5px` |
| `--dam-tag-fs-badge` | `14px` |

**MASTER radius target:** 14px (chip).

## Local overrides to kill (F4)

| Location | Hardcode |
|----------|----------|
| `dam-branding.css:1723–1725` | `* 1.1` padding/font |
| `dam-branding.css:1785` | `1em * 1.1` |
| `dam-brand.css:6825` | `* 1.05` literal → `var(--dam-badge-scale)` |

## Done (F4)

- One global scale path; no page-local `*1.1`.
- Do not edit `dam-brand.css` massively — allowlist only if brief permits.
