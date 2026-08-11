# Handoff STREFA SIDEBAR-MORPH (Grok) — 2026-07-20

## Status: DONE (margin identity + avatar + z-index + logout split + morph)

### A) Sesja vs Wyloguj (rozdzielone)

| Element | ID / klasa | Ikona | Zachowanie |
|---------|------------|-------|------------|
| Sesja urządzenia | `#damShellDeviceSession` `.dam-device-session-btn` | `uil-desktop` | `profile.html#damDevicePathsRoot` |
| Wyloguj | `#damShellLogout` `.dam-logout-btn` | `uil-signout` | `DamApi.logout()` → signin |

- Spacing: `.dam-nav-logout { margin-top: 50px }` (+50px friction)
- Collapsed: margin-top 8px
- Tips: `data-dam-tip` PL na obu
- Header user-menu **Wyloguj** też wraca do prawdziwego logout (nie device-paths)

### B) GSAP morph collapse

| Param | Wartość |
|-------|---------|
| duration | `0.5` |
| ease | `power3.inOut` |
| labels | `autoAlpha` + `x: ±10` |
| width | expanded `--dam-sidebar-w` → `72` |
| reduce | `gsap.matchMedia` / prefers-reduced-motion → duration `0` |
| boot | `applySidebarCollapse()` → `animate=false` (finishBoot OK) |

### C) Profile menu z-index

- Root cause: popup `z-index:40` < sticky search `52`
- Fix: action `12500`, popup `12550`, header `200` + `isolation:isolate`
- Przy open: `body.dam-header-popup-open` → sticky toolbars `z-index:20`
- CDP: `elementFromPoint` mid-menu → popup, nie search

### D) Default avatar (bez czapeczki)

- Pliki: `avatar-male.svg`, `avatar-female.svg`, `user.svg`
- Usunięty path „czapki/włosów” nad głową → czysta głowa + ramiona
- Cache-bust w `applyUserAvatar`: `?v=avatarflat20260720a`

### E) Identity margin (+20px)

- `.dam-user-menu__identity`: `margin: 12px 12px 20px` (było bottom `0`)
- Inject + `dam-brand.css`
- CDP: `marginBottom === "20px"` ✓

## Cache-bust

- `dam-shell.js?v=identitymb20260720a` (wszystkie HTML z shell)
- `dam-brand.css?v=identitymb20260720a`

## Screenshots

- `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\page-2026-07-20T16-21-29-233Z.png` — menu open, margin, avatar flat, nad search
- Wcześniejsze: `pass1-profile-over-search.png`

## Pliki

- `apps/web/assets/js/dam-shell.js` (główny)
- `apps/web/assets/css/dam-brand.css` (z-index popup + identity margin)
- `apps/web/assets/img/avatar/avatar-male.svg` | `avatar-female.svg` | `user.svg`
- `process.md` wpis
- NIE ruszane: settings danger zone (H2), lokalne pliki nie kasowane
