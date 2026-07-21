# DAM ETA - Design System Master

## Baza: Geex Bootstrap HTML Template (themewant.com)

**Zrodlo miar F2:** `agents/shared/geex-realign-audit-2026-07-21.md` (CSS-declared; live CDP deferred gdy `:8765` down).

## Tokeny kolorow (CSS: `dam-tokens.css`)

| Token | Wartosc | Zastosowanie |
|-------|---------|--------------|
| `--dam-primary` / Primary | #AB54DB | Akcenty, CTA, aktywne elementy |
| `--dam-dark` / Dark | #17161E | Dark ink / dark surface-muted seed |
| `--dam-ok` | #00b074 | Success (Geex map: `--success-color`) |
| `--dam-danger` | #ff5b5b | Bledy, destructive |
| `--dam-warn` | #ffbb54 | Ostrzezenia |
| `--info-color` | #5B8DEF | Info (AA) |
| `--dam-text` | #464255 | Glowny tekst light |
| `--dam-text-muted` | #8f8b9f | Meta / secondary |
| `--dam-border` | #ececf2 | Hairline |
| `--dam-surface` | #FFFFFF | Karty / panele |
| `--dam-surface-muted` | #f5f6fa | Page / muted tile |
| `--dam-brand-green` | #008244 | Logo / DK green |

Nowe hex w CSS/HTML = **zakaz** (program-instructions `ui.geex_dna_tokens`). Uzywaj `var(--dam-*)`.

## Typografia
- Font: Jost (Google Fonts) — `--dam-font`
- Weights: 400, 500, 600, 700
- Base: `--dam-fs-base` 14px
- Control fs: `--dam-control-fs` 12px
- Badge pill: `--dam-tag-fs-pill` 10.5px; badge: `--dam-tag-fs-badge` 14px

## Promienie (Geex DNA — F2)

| Rola | Token | px |
|------|-------|---:|
| Card / modal sheet | `--dam-radius-lg` | 24 |
| CTA button | `--dam-radius-btn` | 18 |
| Badge / chip target | (MASTER target) | 14 |
| Panel / dash | `--dam-radius-md` | 12 |
| Control / icon-btn | `--dam-radius-sm` / `--dam-control-radius` | 8 |

## Spacing / controls

| Token | Wartosc | Zastosowanie |
|-------|---------|--------------|
| `--dam-space-btn-y` | 15px | Geex `.geex-btn` pad-y (audit) |
| `--dam-space-btn-x` | 25px | Geex `.geex-btn` pad-x |
| `--dam-control-h` | 44px | Toolbar / icon touch target (F2 Parent) |
| `--dam-badge-scale` | 1.05 | Global chip scale |

## Cienie
- Elev: `--dam-shadow` (`0 10px 30px` + RGB alpha token)

## Grid / Layout
- Sidebar: 250px (fixed), zamykana na mobile
- Header: 60px (fixed top)
- Content: fluid, padding 24px
- Geex class: `.geex-dashboard`, `.geex-sidebar`, `.geex-content`

## Primitives CSS

Plik: `apps/web/assets/css/dam-primitives.css` (po `style.css` + `dam-tokens.css`, przed `dam-brand.css`).

Sekcje: `BUTTONS` / `BADGES` / `PANELS` — anatomia F3/F4/F5; F2 = skeleton + token hooks.

Komponenty (kontrakt):
- [`components/buttons.md`](components/buttons.md)
- [`components/badges.md`](components/badges.md)
- [`components/surfaces.md`](components/surfaces.md)
- [`components/icon-btn.md`](components/icon-btn.md)

## Klasy Geex kluczowe
- `.geex-btn` / `--primary` / `--sm` / `--transparent` / danger / success
- `.dam-viz-badge` / `.dam-badge-tag` / `.dam-status-badge`
- `.dam-dash-panel` / `.dam-bento__cell` → surface tokens
- `.primay-bg` -> background primary (note: literowka w Geex)

## Chrome / Header (GLOBALNE - nie per-strona)
- Header actions: `dam-shell.js` (`ensureHeaderChrome` + `bindDamHeaderPopups`)
- Popupy: class `.is-open` w `dam-brand.css` - NIE jQuery `slideToggle`
- Style: tokeny z `dam-tokens.css` / primitives; zakaz inline one-off hex
- Zmiana ikony / typografii / przycisku w chrome = shell lub allowlist — nie mass-edit `dam-brand.css` w F2–F4

## Ludzkie etykiety rol assetow (OBOWIAZUJACE)
- artwork -> Projekt graficzny
- viz_3d -> Wizualizacja 3D
- print_pdf -> Plik do druku
- tech -> Specyfikacja techniczna
- photo -> Fotografia produktowa
- packaging_text -> Teksty na opakowanie

## Zasady copywritingu UI
- Jezyk domyslny: Polski
- BRAK em-dash w UI - tylko dywiz (-)
- Wszystkie stringi przez data-i18n lub dam-i18n.t()
- Brak technicznych terminow na widoku uzytkownika
- Etykiety przycisku akcji: max 3 slowa, jasne, czasownikowe
