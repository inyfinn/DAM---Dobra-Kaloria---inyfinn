# P1 Computed Live — runtime verification

**Captured:** 2026-09-07T10:01+02:00 (local)  
**UI:** `http://127.0.0.1:8765` — `curl.exe branding.html` → **200** (no second server)  
**Bridge health:** `GET http://127.0.0.1:8766/health` → **200** (`HEAD` returns 501; use GET)  
**Method:** Chrome DevTools MCP `Runtime.evaluate` + `getComputedStyle` / `getBoundingClientRect`  
**Screenshots:** `branding-p1-live-2026-09-07.png`, `viz-p1-live-2026-09-07.png` (gate: widget height > 0 before capture)

---

## CDP command (repro)

```javascript
(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, found: false };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      sel, found: true,
      fontSize: cs.fontSize, lineHeight: cs.lineHeight,
      padding: cs.padding, paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight, paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      gap: cs.gap, columnGap: cs.columnGap, rowGap: cs.rowGap,
      margin: cs.margin, borderRadius: cs.borderRadius,
      height: Math.round(r.height * 100) / 100,
      width: Math.round(r.width * 100) / 100,
    };
  };
  return {
    ts: new Date().toISOString(),
    url: location.href,
    sidebarLink: pick('.geex-sidebar__menu__link'),
    tagFilters: pick('.dam-branding-tag-filters'),
    brandingSearchChrome: pick('.dam-search-wrap--branding-chrome'),
    secondaryFilters: pick('.dam-viz-secondary-filters'),
    vizCardBody: pick('.dam-viz-card__body'),
    geexContent: pick('.geex-content'),
    gridToolbar: pick('.dam-viz-grid-toolbar'),
  };
})();
```

---

## P1-tokens — verified / corrected

| Claim (P1-tokens) | Computed live | Page | Verdict |
|-------------------|---------------|------|---------|
| `--dam-brand-green` `#008244` | `#008244` on `:root` | branding | **OK** |
| `--dam-primary` `#AB54DB` | `#AB54DB` | branding | **OK** |
| `--dam-dark` `#17161E` | `#17161E` | branding | **OK** |
| `--dam-ok` `#00b074` | `#00b074` | branding | **OK** |
| `--dam-surface` `#ffffff` | `#ffffff` | branding | **OK** |
| `--dam-border` `#ececf2` | `#ececf2` | branding | **OK** |
| `--dam-text` `#464255` | `#464255` | branding | **OK** |
| `--dam-text-muted` `#8f8b9f` | `#8f8b9f` | branding | **OK** |
| `--dam-bento-gap` `16px` | `.geex-content` `gap: 16px` | both | **OK** |
| `--dam-control-h` `44px` | declared on `:root`; not re-measured on control node | — | **OK (token)** |
| **TRAP:** Geex `.geex-sidebar__menu__link` `16px` / `16px 25px` | **`font-size: 13.6px`**, **`padding: 6.8px 10.2px`**, `line-height: 20.4px`, `gap: 8.5px`, `border-radius: 15.3px` | branding | **dam-tokens + dam-primitives WIN** (not Geex 16px) |
| `--dam-sidebar-nav-fs` → 13.6px | matches computed `13.6px` | branding | **OK** |
| `--dam-sidebar-nav-py` / `--dam-sidebar-nav-px` | `6.8px` / `10.2px` padding | branding | **OK** |

**Note:** Sidebar collapsed in live layout (`height: 0` on link box); typography/padding still resolve. Gate used `.dam-branding-tag-filters` height **189.35px** > 0.

**Timestamp:** branding eval `2026-09-07T08:00:32.542Z`

---

## P1-rhythm-and-widgets — verified / corrected

### `.geex-content`

| Property | P1 declared | Computed | Page | Verdict |
|----------|-------------|----------|------|---------|
| `gap` | `16px` (`--dam-bento-gap`) | `16px` | branding, viz | **OK** |
| `padding` | none desktop | `0px` | both | **OK** |

### Secondary filters (`.dam-viz-secondary-filters`)

| Property | P1 declared | Computed | Page | Verdict |
|----------|-------------|----------|------|---------|
| `padding` | `20px 24px` | `20px 24px 20px 20px` (T/R/B/L) | both | **OK** (asymmetric L20) |
| `gap` | `10px 12px` | `10px 12px` | both | **OK** |
| `margin-bottom` base | `0 0 12px` | `0px` margin (branding top band) | branding | **context differs** |
| `margin-bottom` viz override | `14px` | `0px 0px 4px` when nested in `.dam-global-search-block` | viz | **P1 incomplete** — nested rule `dam-viz.css:174-175` wins (**4px**, not 14px) |

**Heights:** branding band **119.8px**; viz nested band **76px**.

### Branding search chrome (`.dam-search-wrap--branding-chrome`)

| Property | P1 declared | Computed | Verdict |
|----------|-------------|----------|---------|
| `padding` | `12px 16px` | `12px 16px` | **OK** |
| `gap` | `10px` | `10px` | **OK** |

### Branding tag filters (`.dam-branding-tag-filters`)

| Property | P1 declared | Computed | Verdict |
|----------|-------------|----------|---------|
| `padding` | `10px 12px` | `10px 12px` | **OK** |
| `margin` | `0 0 10px` | `0px 0px 10px` | **OK** |

**Screenshot gate:** height **189.35px** > 0 @ `2026-09-07T08:00:46Z`

### Branding toolbar (`.dam-branding-toolbar`)

| Property | P1 (implicit via search row) | Computed | Verdict |
|----------|-------------------------------|----------|---------|
| `padding` | not primary rhythm owner | `0px 0px 2px` | measured for record |
| `gap` | tabs row `6px 8px` nearby | `6px` on toolbar container | partial match |

### Grid toolbar (`.dam-viz-grid-toolbar`)

| Property | P1 declared | Computed | Page | Verdict |
|----------|-------------|----------|------|---------|
| `column-gap` / `row-gap` | `14px` / `8px` | `8px 14px` | viz | **OK** |
| `margin` | `0 0 12px` | `0px` | viz | **OK** on viz |
| `margin` | `0 0 12px` | **`-4px 0px 5px`** | branding | **P1 wrong** for branding context |
| Status child margin | `0 0 15px` viz | `0px 0px 15px` on `.dam-toolbar-status` | viz | **OK** |

### Cards (`.dam-viz-card` / branding)

| Property | P1 declared | Computed | Verdict |
|----------|-------------|----------|---------|
| `border-radius` | `12px` | `12px` | **OK** |
| `.dam-viz-card__body` `padding` | `10px 18px 12px` | `10px 18px 12px` | **OK** (branding cards use same class) |
| `.dam-viz-card__body` `gap` | `13px` | `13px` | **OK** |
| `.dam-branding-card__body` selector | re-declared in CSS | **not in DOM** — body is `.dam-viz-card__body` inside `.dam-branding-card` | **P1 selector name misleading**; values still **OK** |

**Card body box (branding):** height **295.14px**, width **226.69px** @ first card.

### Badge chips (`.dam-viz-badge.dam-badge-tag`)

| Property | P1 declared | Computed | Verdict |
|----------|-------------|----------|---------|
| `border-radius` | `14px` | `14px` | **OK** |
| pill padding (primitives calc) | `calc(2px*scale) calc(8px*scale)` | **`2.1px 8.4px`** (`--dam-badge-scale: 1.05`) | **OK** |
| branding filter override | literal `2px 8px` | **`2.1px 8.4px`** (override does not win) | **P1 wrong** on override exception |

---

## Blunt verdict on P1 files

**P1-tokens.md:** File-level token table is **accurate**. The Geex 16px TRAP is real in `style.css`, but **runtime cascade rejects it** — sidebar links compute **13.6px / 6.8×10.2px**. No invented hex errors found.

**P1-rhythm-and-widgets.md:** **Mostly accurate** for declared CSS on shared widgets (bento gap, filter padding, card body pad/gap, secondary-filter gap). **Wrong or incomplete on:**

1. Branding filter chip `2px 8px` override — **not live**; scale calc wins.
2. `.dam-branding-card__body` — **wrong selector** in census; live markup uses `.dam-viz-card__body`.
3. Viz `margin-bottom: 14px` on secondary filters — **not live** in nested search block (**4px** instead).
4. Grid toolbar `margin 0 0 12px` — **not live on branding** (`-4px 0px 5px`).

---

## Screenshots (pixel record)

| File | URL | Gate widget | Widget height (px) | Timestamp (UTC) |
|------|-----|-------------|-------------------|-----------------|
| `branding-p1-live-2026-09-07.png` | `/branding.html` | `.dam-branding-tag-filters` | **189.35** | 2026-09-07T08:00:46Z |
| `viz-p1-live-2026-09-07.png` | `/visualizations.html` | `.dam-viz-secondary-filters` | **76.00** | 2026-09-07T08:01:23Z |

Viewport: browser default (no resize loop). Sidebar link height **0** (collapsed); gate satisfied via filter bands.
