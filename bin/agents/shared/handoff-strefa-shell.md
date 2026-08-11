# Handoff: STREFA SHELL — Task 33 (flash starego layoutu)

**Data:** 2026-07-20  
**Agent:** STREFA SHELL  
**Status:** DONE (pkt 33 briefu usability)

## Objaw

Przy przejsciu miedzy pozycjami menu (pelne przeladowanie HTML, nie SPA) przez
ulamek sekundy migal surowy / stary layout Geex (Demo, Server Management…).

## Przyczyna (potwierdzona)

1. Wiele stron (`dashboard.html`, `explorer.html`, `costs.html`, `invoices.html`…)
   ma w HTML **statyczny markup szablonu Geex** w header/sidebar.
2. `dam-shell.js` nadpisuje menu dopiero na `DOMContentLoaded` (`init` →
   `buildSidebarNav` / `buildHeaderNav`).
3. First paint = widoczny Geex Demo zanim shell przepise chrome (= flash).
4. Dowod: `curl` raw HTML zawiera `Demo` / `Server Management`; CDP:
   przy `html.dam-booting` + Demo w DOM → `body` opacity `0` (brak widocznego flashu).

## Fix

- `html.dam-booting` + `body.is-booting` na wszystkich stronach z `dam-shell.js`
- Inline critical CSS `#dam-shell-boot-critical` na poczatku `<head>`
- `apps/web/assets/css/dam-shell-boot.css` (fade-in + `prefers-reduced-motion`)
- `DamShell.finishBoot()` po przepisaniu chrome (double rAF)
- Fallback 4.5s w `<head>` jesli shell nie wstanie
- Cache-bust: `dam-shell.js?v=shellboot20260720b`, boot CSS `?v=shellboot20260720a`

## Pliki zmienione

| Plik | Zmiana |
|------|--------|
| `apps/web/assets/js/dam-shell.js` | `finishBoot`, reset flagi w `init`, eksport API |
| `apps/web/assets/css/dam-shell-boot.css` | **NOWY** — boot / fade-in |
| 20× `apps/web/*.html` (z dam-shell) | `dam-booting`, critical CSS, `is-booting`, bump `?v=` |
| `agents/shared/code-doctrine.md` | lekcja sekcja 12 |
| `process.md` | wpis operacyjny |

### HTML (20)

activity, billing, branding, consents, costs, dashboard, docs-security,
explorer, help, inbox, index, integrations, invoices, license, privacy,
profile, project, settings, terms, visualizations

**Bez zmian:** `signin.html`, `signin-geex.html` (brak dam-shell).

## NIE ruszane (wspolbieznosc)

- `dam-media-preview.js`, `local_bridge.py` (A3)
- `dam-branding.js` (B)
- `dam-tutorial.js` / `dam-tutorial.css` (C)
- `dam-assoc-edit.js`, `dam-danger.js`, `dam-explorer.js` (H)
- W `settings.html` tylko head/body boot + bump dam-shell (bez cudzych skryptow)

## Weryfikacja

| Pass | Dowod | Wynik |
|------|-------|-------|
| 1 | dashboard screenshot po boot | DAM shell, brak Demo |
| 2 | CDP: Demo w DOM + `dam-booting` → opacity 0; screenshot blank gray | PASS — Demo niewidoczny |
| 3 | explorer po nawigacji | DAM shell, `booted`, opacity 1 |
| 4 | branding po nawigacji | DAM shell, `hasDemo=false` |
| 5 | costs po nawigacji | DAM shell, `hasDemo=false` |
| — | `node --check dam-shell.js` | OK |

Screenshoty: `shell-boot-pass1-dashboard.png` … `shell-boot-pass5-costs.png`
(Temp/cursor/screenshots).

## Uwagi dla nastepcy

- Nawigacja = full page reload; boot musi byc w kazdym HTML (nie wystarczy JS).
- Gdy inny agent doda nowa strone z dam-shell — skopiuj blok critical z istniejacych.
- `dam-grid-reveal` startuje po load; boot schodzi na DCL po shell rewrite — bez kolizji.
