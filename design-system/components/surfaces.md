# Surfaces / panels

**Audit:** `geex-realign-audit-2026-07-21.md` §3  
**Owner:** Faza 5a/5b (Lead) — F2 only token hooks in `/* === PANELS === */`

## Candidates

| Selector | Role | Tokens |
|----------|------|--------|
| `.dam-bento__cell` | Card / tile | `--dam-surface`, `--dam-radius-md`, border |
| `.dam-bento__cell--muted` | Muted tile | `--dam-surface-muted` |
| `.dam-bento__cell--bare` | Transparent | no fill |
| `.dam-dash-panel` | App panel | surface + border + `--dam-radius-md` |
| `.dam-dash-modal__panel` | Modal sheet | surface + `--dam-radius-lg` + `--dam-shadow` |
| `.geex-content__header__popup*` | Popover | surface + shadow (5b) |
| `.dam-tag-edit-popover` | Popover | surface (5b) |
| `.dam-dash-panel__item` / `__row` | List row | muted hover (5a) |

## Declared measure (audit)

`.dam-dash-panel`: bg surface; border 1px; radius `--dam-radius-md` (12px); min-height `520px`.  
`.dam-bento__cell`: padding `16px 18px`; radius bento token.

## Rules

- F5 removes leftover hex fills + unifies elevation.
- F5b: IntersectionObserver + `clip-path` doctrine — no collapsing clip on rest state.
