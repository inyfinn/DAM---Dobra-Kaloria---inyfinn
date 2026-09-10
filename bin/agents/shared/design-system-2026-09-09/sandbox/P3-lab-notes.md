# P3 weak-model lab — Explorer secondary filter band

**Worker:** ui-create-design-system Mode A P3  
**Captured:** 2026-09-09  
**Sandbox:** `bin/agents/shared/design-system-2026-09-09/sandbox/`

---

## Built

| File | Role |
|------|------|
| `explorer-filter-band.html` | Static clone of Explorer `.dam-viz-secondary-filters.dam-explorer-secondary-filters` band |
| `sandbox-stack.css` | `@import` only — Explorer CSS chain from P1-ownership-map (no `dam-viz.css` / `dam-branding.css`) |

**Controls cloned (static):** Produkty / Materiały (`#damExplorerCatMode`), Pokaż wszystkie (`#damExplorerShowAll`), DK/GC brand chips (`#damExplorerBrandMount`), język (`#damExplorerLangFilter`).

**Optional empty main pane:** `.dam-explorer-panel.dam-explorer-welcome` below the band (DS §7 default canvas copy pattern).

---

## DESIGN_SYSTEM.md sections followed

| Section | Application |
|---------|-------------|
| **§1 Control plane** | Explorer stack: bootstrap → style → tokens → primitives → app → tutorial → brand → bento; Jost via Google Fonts `<link>` |
| **§2 TRAP — Geex 16px sidebar** | Not copied; sandbox has no sidebar |
| **§2 TRAP — card anatomy in dam-viz.css** | No card overrides; empty pane uses existing `.dam-explorer-panel` classes from `dam-brand.css` |
| **§3 Tokens** | No raw hex in sandbox markup; colours from linked `--dam-*` stack |
| **§4 UTF-8 / PL copy** | UTF-8 file; Polish strings with diacritics (Pokaż, Materiały, języki); `&nbsp;` bind in subtitle |
| **§5.2 `.dam-viz-secondary-filters`** | Census winner wrapper + `.dam-explorer-secondary-filters` modifier |
| **§5.4 badges** | **Not used for DK/GC** — live explorer uses `.dam-brand-chip-btn` (DamBrandFilter); documented as DS silence below |
| **§6 Spacing rhythm** | Parent `.dam-explorer-shell` for explorer pad exception **20px 0px** + mb **14px** on secondary filters |
| **§7 Explorer copy owners** | Static fallbacks for show-all, lang filter, welcome empty text (no i18n JS in sandbox) |
| **§8 Clone vs scratch** | Markup mirrors production IDs/classes; no Bootstrap scratch filter row |

---

## DS silent / ambiguous

1. **Brand chips vs tag badges** — §5.4 cites `.dam-viz-badge.dam-badge-tag` for filter pills; Explorer DK/GC uses `.dam-brand-chip-btn` (rendered by `dam-brand-filter.js`). Sandbox uses brand-chip markup from live DOM evidence, not §5.4 recipe.
2. **Exact inner flex layout** — DS gives pad/gap/mb computed values but no HTML skeleton for `.dam-explorer-cat-mode` / `.dam-db-mode-chip`; structure taken from production `explorer.html` grep (forbidden read — IDs confirmed via P0/JS corpus).
3. **Show-all default** — Production switch starts `is-off` with unchecked box; screenshot often shows enabled state. Sandbox matches HTML default (`is-off`, unchecked).
4. **i18n keys** — Sandbox uses plain UTF-8 labels; `data-i18n` omitted (no `dam-i18n.js` in static lab).
5. **Geex body font TRAP (§4)** — Jost loaded but full shell may still compute Poppins on some nodes; not re-probed in sandbox.

---

## Verification

Playwright + Chromium @ `http://127.0.0.1:<ephemeral>/agents/shared/.../explorer-filter-band.html` with **HTTP root = `bin/`** (so `@import ../../../../apps/web/assets/...` resolves to `/apps/web/assets/...`).

| Artifact | Bytes | WxH | CSS 404? |
|----------|-------|-----|----------|
| `explorer-filter-band-screenshot.png` | **37134** | **1280×900** | **0** (all 8 sheets 200) |

**Serve note:** `python -m http.server` **from sandbox folder only** → `@import` resolves to `/apps/web/assets/...` → **404** (expected; do not edit production). Use `file://` on the HTML file or serve from `bin/` root.

**Bootstrap path fix:** DS §1 branding chain cites `bootstrap.css`; Explorer loads `assets/vendor/css/bootstrap/bootstrap.css` (P1 ownership grep). Sandbox `@import` uses vendor path.

---

*End P3 lab notes*
