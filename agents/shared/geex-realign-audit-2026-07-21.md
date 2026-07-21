# Geex realign — Faza 1 AUDIT (2026-07-21)

**Branch:** `design/geex-realign`  
**Tag target:** `geex-phase1`  
**Scope:** inventory only — **no CSS token/primitives commit**  
**Tool budget (Grep/Read/CDP):** 8 used / 18 max  
**Live CDP:** blocked (`:8765` `ERR_EMPTY_RESPONSE` at audit time). Measures below = **CSS-declared** (+ HTML class usage counts). Faza 2 may re-measure live.

---

## 1. Button families — stays / alias / remove

| Family / selector | Where defined | HTML usage (approx) | Decision | Notes for F2/F3 |
|-------------------|---------------|---------------------|----------|-----------------|
| `.geex-btn` (base) | `style.css` | ~89 `geex-btn` in HTML | **stays** | Canonical Geex CTA; padding 15×25, radius 18px |
| `.geex-btn--primary` | `style.css` | ~13 | **stays** | Primary filled |
| `.geex-btn--sm` | `style.css` | ~6 | **stays** | Compact |
| `.geex-btn--transparent` | `style.css` | low | **stays** | Outline/ghost Geex |
| `.geex-btn--primary-transparent` | `style.css` | ~2 | **stays** | Outline primary |
| `.geex-btn--danger` / `--danger-transparent` | `style.css` | low | **stays** | Destructive |
| `.geex-btn--success` / `--success-transparent` | `style.css` | low | **stays** | Success |
| `.geex-btn--dark` / `--dark-transparent` | `style.css` | low | **alias** | Map to surface/dark tokens; rarely used in DAM pages |
| `.geex-btn.nav-link` | `style.css` | shell nav | **stays** | Nav chrome — do not fold into CTA primitives |
| `.geex-btn__toggle-*` / `__customizer*` | `style.css` | Geex chrome | **stays** | Theme chrome; out of DAM CTA unify |
| `.dam-win-btn` | `dam-brand.css` (+ viz) | modals | **alias** → outline secondary on `.geex-btn` | Uses `--dam-btn-outline-border` |
| `.dam-icon-btn` / `.dam-menu-toggle` | `dam-brand.css` | shell/header | **stays** | Icon square; keep separate from text CTA |
| `.dam-btn-primary` | dam CSS | sparse | **alias** → `.geex-btn--primary` | Legacy DAM name |
| `.dam-btn-icon` / `.dam-btn-icon-only` | dam CSS | sparse | **alias** → `.dam-icon-btn` | Consolidate in F3 |
| `.dam-int-cta` | integrations CSS | hub | **stays** (page-local) | F3: only if matches global CTA anatomy |
| `button.dam-brand-tab` | branding | tabs | **stays** | Not a CTA family |
| `button.nav-link` (non-geex) | mixed | | **remove** (gradual) | Prefer `.geex-btn.nav-link` |

**F3 WRITE hint:** unify padding/radius/font via tokens; keep modifier names Geex-first; alias DAM leftovers without deleting class names in HTML yet.

---

## 2. Badge audit + local scale locations

### Families

| Class family | Role | Decision |
|--------------|------|----------|
| `.dam-viz-badge` (+ `--lang`, `--cat`, `--brand`, `--more`, …) | Product/meta chips | **stays** — primary badge system |
| `.dam-badge-tag` (+ `--pakowanie`, `--tier-low`) | Branding tags | **stays** / align scale to token |
| `.dam-status-badge` (+ status modifiers, `--lg`) | Lifecycle status | **stays** |
| `.dam-tag-pill` / `.dam-tag-chip` / `.dam-tag-group*` | Tag editor UI | **stays** (editor chrome) |
| `.dam-badge--msg` / `--notif` / header badge | Shell counters | **stays** |
| `.geex-content__header__badge` | Geex header | **stays** |

### Global scale token

| Token | Value | Defined |
|-------|-------|---------|
| `--dam-badge-scale` | `1.05` | `dam-tokens.css` |
| `--dam-tag-fs-pill` | `10.5px` | `dam-tokens.css` |
| `--dam-tag-fs-badge` | `14px` | `dam-tokens.css` |

Consumers (token-aware): `dam-brand.css` ~11001–11063, `dam-badges.js`, `dam-assoc-edit.js`.

### Local scale overrides (F4 must kill or retoken)

| Location | Hardcode | Issue |
|----------|----------|-------|
| `dam-branding.css:1723–1725` | `* 1.1` padding/font | **local scale** bypasses `--dam-badge-scale` |
| `dam-branding.css:1785` | `1em * 1.1` | same |
| `dam-brand.css:6825` | `* 1.05` literal | should use `var(--dam-badge-scale)` |
| `dam-branding.css:799` | `fs-base * 1.1` | title/chip adjacent — verify not badge |

---

## 3. Panels → surface candidates

| Current selector | Surface role | Candidate token (draft) | Faza |
|------------------|--------------|-------------------------|------|
| `.dam-bento__cell` | Card / tile | `--dam-surface` + `--dam-radius-md` + border | 5a |
| `.dam-bento__cell--muted` | Muted tile | `--dam-surface-muted` | 5a |
| `.dam-bento__cell--bare` | Transparent | no fill | 5a |
| `.dam-dash-panel` | App panel | `--dam-surface` / border / radius-md | 5a |
| `.dam-dash-modal__panel` | Modal sheet | surface + elev shadow | 5a/5b |
| `.geex-content__header__popup*` | Popover | surface + shadow | 5b |
| `.dam-tag-edit-popover` | Popover | surface | 5b |
| `.dam-dash-panel__item` / `__row` | List row | muted hover surface | 5a |

Already token-backed in places (`var(--dam-surface)` on `.dam-dash-panel`). F5 = remove leftover hex fills + unify elevation.

---

## 4. Top 50 hex + decision

Counts from `apps/web/assets/css` + `apps/web/*.html` (shell inventory 2026-07-21).

| # | Hex | Count | Decision |
|---|-----|------:|----------|
| 1 | `#ab54db` | 567 | **token** → `--dam-primary` (already); replace literals |
| 2 | `#fff` / `#ffffff` | 318+9 | **token** → `--dam-surface` / white |
| 3 | `#464255` | 159 | **token** → `--dam-text` |
| 4 | `#8b8d97` | 152 | **alias** → `--dam-text-muted` (near `#8f8b9f`) |
| 5 | `#e7e7e7` | 76 | **alias** → `--dam-border` family |
| 6 | `#ececf2` | 73 | **token** → `--dam-border` |
| 7 | `#17161e` | 41 | **token** → `--dam-dark` / dark surface-muted |
| 8 | `#f5f6fa` | 29 | **token** → `--dam-surface-muted` |
| 9 | `#ff5b5b` | 24 | **token** → `--dam-danger` |
| 10 | `#ff5653` | 22 | **alias** → `--dam-danger` (close red) |
| 11 | `#008244` | 22 | **token** → `--dam-brand-green` |
| 12 | `#8f8b9f` | 18 | **token** → `--dam-text-muted` |
| 13 | `#ececf1` | 16 | **alias** → `--dam-border` |
| 14 | `#f4f4f6` | 16 | **alias** → surface-muted |
| 15 | `#00b074` | 16 | **token** → `--dam-ok` |
| 16 | `#f0f0f0` | 15 | **alias** → border/muted |
| 17 | `#fbf7fe` | 14 | **keep local** (brand tint) or soft primary-mix |
| 18 | `#6b6d78` | 13 | **alias** → text-muted |
| 19 | `#fafafa` | 13 | **alias** → surface-muted |
| 20 | `#000` | 13 | **keep** sparingly (ink/overlay) |
| 21 | `#a3a3a3` | 12 | **alias** → muted |
| 22 | `#2cbf44` | 12 | **alias** → ok/success family |
| 23 | `#7a3aa8` | 11 | **alias** → primary darken |
| 24 | `#222222` | 10 | **alias** → dark text |
| 25 | `#ffbb54` | 8 | **token** → `--dam-warn` |
| 26 | `#64748b` | 8 | **keep local** (slate UI) or muted |
| 27 | `#c96a12` | 8 | **keep** warn-dark |
| 28 | `#6b6980` | 8 | **alias** → text-muted |
| 29 | `#292640` | 8 | **alias** → dark surface |
| 30 | `#1a1820` | 8 | **alias** → dark |
| 31 | `#1e9e5a` | 7 | **alias** → ok |
| 32 | `#e2e2ea` | 7 | **alias** → border |
| 33 | `#f8f7fb` | 7 | **alias** → surface-muted |
| 34 | `#6b7280` | 7 | **alias** → muted |
| 35 | `#3d2f4a` | 6 | **keep** purple-brown accent local |
| 36 | `#f8f4fd` | 6 | **alias** → primary tint |
| 37 | `#6a6570` | 6 | **alias** → muted |
| 38 | `#5a5a68` | 6 | **alias** → muted |
| 39 | `#e11d48` | 6 | **alias** → danger |
| 40 | `#eceaf3` | 6 | **alias** → border |
| 41 | `#28c76f` | 6 | **alias** → success (Geex) |
| 42 | `#faf9fc` | 5 | **alias** → surface |
| 43 | `#f5f5f7` | 5 | **alias** → muted |
| 44 | `#b9bbbd` | 5 | **alias** → border |
| 45 | `#fafafc` | 5 | **alias** → surface |
| 46 | `#b45309` | 5 | **keep** warn text |
| 47 | `#0a8db8` | 5 | **keep** info alt / or map `--info-color` |
| 48 | `#1c1c22` | 5 | **alias** → dark |
| 49 | `#fcfcfc` | 5 | **alias** → surface |
| 50 | `#5b8def` | (tokens) | **token** → `--info-color` |

**Decision key:** `token` = already/should be CSS var; `alias` = merge to nearest existing token in F2; `keep` / `keep local` = intentional one-off.

---

## 5. Control measures (≥6) — CSS-declared (CDP blocked)

Source: `style.css` / `dam-tokens.css` / `dam-dashboard.css` / `dam-bento.css`. Live CDP skipped (`:8765` empty response).

| # | Control | Declared measure | Source |
|---|---------|------------------|--------|
| 1 | `.geex-btn` | padding `15px 25px`; radius `18px`; gap `10px` | style.css:1727 |
| 2 | `.geex-btn--sm` | padding `12px 22px`; font-size `13px` | style.css:1771 |
| 3 | `.geex-btn--primary` | bg `var(--primary-color)`; color white | style.css:1819 |
| 4 | `.geex-btn--transparent` | border `2px solid var(--dark-color)`; bg transparent | style.css:1776 |
| 5 | Toolbar control height | `--dam-control-h: 38px`; radius `8px`; fs `12px` | dam-tokens.css:57–59 |
| 6 | `.dam-dash-panel` | bg surface; border 1px border; radius `--dam-radius-md` (12px); min-height `520px` | dam-dashboard.css:891 |
| 7 | `.dam-bento__cell` | padding `16px 18px`; bg `--dam-bento-surface`; radius `--dam-bento-radius` | dam-bento.css:31 |
| 8 | Badge scale | `--dam-badge-scale: 1.05`; pill fs `10.5px` | dam-tokens.css:51–54 |

**Re-measure gate:** Faza 2 smoke should CDP these 8 on live dashboard before token freeze.

---

## 6. Edge register (5–8 only)

| ID | Edge | Risk | Owner phase |
|----|------|------|-------------|
| E1 | `dam-brand.css` FREEZE for realign styling — aliases must not rewrite brand file casually | High conflict B/C | 3/4 via allowlist only |
| E2 | Local badge `*1.1` in `dam-branding.css` vs global `1.05` | Visual drift branding vs viz | 4 |
| E3 | IntersectionObserver + `clip-path` (doctrine) — surface/reveal changes can kill reveals | IO ratio 0 | 5b |
| E4 | Geex `.geex-btn` radius 18px vs DAM control radius 8px | Dual CTA anatomy | 3 |
| E5 | Hex `#ab54db` ×500+ literals outside `var(--dam-primary)` | Token adoption incomplete | 2+7 |
| E6 | Dark theme Geex overlay vars remap in `dam-tokens` — white-flash risk | Flash on theme toggle | 6 |
| E7 | Font-blocked Playwright screenshots (phase0) — regress compare flaky | Baseline quality | ops / F8 |
| E8 | `:8765` downtime during F1 — no live smoke 3vp this session | Smoke deferred | F2 entry |

---

## 7. Draft tokens (≤20 names) — NO CSS commit

Names only for Faza 2 implementation (do not invent unused tokens).

| # | Draft name | Intent | Seeds from |
|---|------------|--------|------------|
| 1 | `--dam-primary` | Brand accent | exists |
| 2 | `--dam-surface` | Card/panel fill | exists |
| 3 | `--dam-surface-muted` | Page/section bg | exists |
| 4 | `--dam-border` | Hairline | exists |
| 5 | `--dam-text` | Body | exists |
| 6 | `--dam-text-muted` | Secondary | exists |
| 7 | `--dam-danger` | Error/destructive | exists |
| 8 | `--dam-ok` | Success | exists |
| 9 | `--dam-warn` | Warning | exists |
| 10 | `--dam-radius-sm` | Controls 8 | exists |
| 11 | `--dam-radius-md` | Panels 12 | exists |
| 12 | `--dam-radius-btn` | **new?** CTA 18 → align Geex btn | style.css 18px |
| 13 | `--dam-control-h` | Toolbar height | exists |
| 14 | `--dam-badge-scale` | Chip scale | exists |
| 15 | `--dam-tag-fs-pill` | Chip type | exists |
| 16 | `--dam-btn-outline-border` | Ghost CTA | exists |
| 17 | `--dam-shadow` | Elevation | exists |
| 18 | `--dam-space-btn-y` / `--dam-space-btn-x` | **new** map 15/25 padding | Geex btn |
| 19 | `--info-color` | Info | exists |
| 20 | `--dam-brand-green` | DK green | exists |

**F2 rule:** prefer wiring consumers to existing 1–11,14–17,19–20 before adding 12/18. Cap ≤20 total including new.

---

## 8. Smoke (this session)

| Check | Result |
|-------|--------|
| Baseline PNG | **PARTIAL** — skip per Parent unblock (fonts/locks); do not block F2 |
| Dashboard + modal light × 3vp | **DEFERRED** — `:8765` down at audit write |
| Audit completeness | **PASS** — all stop-criteria tables present |

---

## 9. Stop criteria checklist

- [x] btn families table (stays/alias/remove)
- [x] badge audit + local scale locations
- [x] panels → surface candidates
- [x] top 50 hex + decision
- [x] ≥6 control measures (CSS-declared; live CDP blocked)
- [x] edge register 5–8 (here: 8)
- [x] draft tokens ≤20 (no CSS commit)
- [x] audit written to this file

---

## 10. Handoff → Faza 2

1. Read this audit + `geex-realign-plan-2026-07-21.md` + manifest.
2. Implement tokens/docs/primitives per F2 brief — **Composer RO** before tag.
3. Re-run live CDP on table §5 when `:8765` up.
4. Do **not** edit `dam-brand.css` for realign styling in F2 beyond token wiring if brief allows; B/C own buttons/badges later.
