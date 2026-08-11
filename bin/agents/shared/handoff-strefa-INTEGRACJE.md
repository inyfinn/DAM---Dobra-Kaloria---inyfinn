# Handoff STREFA INT-FIX (Grok) - skeleton + clicki + CTA - 2026-07-20

MODEL: cursor-grok-4.5-high-fast (Grok). Bez commit. Bez kasowania plikow.

## Checklista

- **C3** BENTO anatomia kart viz/branding: nadal `[ ]` (zamrozone).
- **A1/A2** OAuth: bez zmian logiki mostu; tipy na disabled Zaloguj.

## Design Read

Panel Integracje (hub) dla operatorow DAM; Geex/DAM product UI; foot CTA = profil `.dam-welcome-link` / `.dam-int-cta` (neutral #E7E7E7 / ink #464255); Wkrótce = dashed `#8b8d97` + ink `#1a1820` (setbento20260720h).

## Root cause

### 1) Skeleton nie znika

`DamGridReveal.skeleton` → `.dam-skeleton--grid`. Zostawal gdy:

1. **Race bootu** (naprawione INT-LOAD): `DOMContentLoaded` po fakcie.
2. **Wiszący Promise / brak timeoutu** → skeleton bez `innerHTML` replace.
3. **GSAP reveal mid-tween** → karty `opacity` 0.3–0.9 wygladaly jak „pustka / skeleton”.

### 2) Przyciski „tylko odświeżają”

`integrations.html` mial `window.addEventListener("focus", DamIntegrations.refresh)` → **pełny remount**:

- flash skeleton,
- zamyka `<details>` Konfiguruj,
- wyglada jak noop / reload.

Preferencje (`href=settings.html#damPrefs`) **dziala** (nawigacja) - to nie byl noop.

## Fix (INT-FIX + INT-LOAD)

| Plik | Zmiana |
|------|--------|
| `integrations.html` | Usunieto remount na `focus`; `visibilitychange` z guardem (details/form open + debounce 5s); boot `readyState`; `?v=intfix20260720c` |
| `dam-integrations.js` | `withTimeout` na fetchach; `safeRender` / error UI; failsafe clear skeleton; Konfiguruj w `dam-int-tile__foot`; GSAP `killTweensOf` + force opacity; `.dam-int-cta` |
| `dam-integrations.css` | CTA welcome-link; summary = ten sam outline; Wkrótce dashed; panel config `position:static` |
| `settings.html` | bump `?v=intfix20260720c` (wspolny JS/CSS) |

## Cache-bust

- `dam-integrations.css?v=intfix20260720c`
- `dam-integrations-settings.css?v=intfix20260720c`
- `dam-integrations.js?v=intfix20260720c`

## Weryfikacja

- `node --check` dam-integrations.js OK
- CDP hub: 12 kart, `skel=false`, Wkrótce `borderStyle=dashed` + ink `#1a1820`
- `window focus` → **nie** remountuje (`data-int-load-gen` bez zmian; details zostaje open)
- Preferencje → `settings.html#damPrefs`
- Konfiguruj → `details.open=true` + formularz

### Screenshoty

`agents/shared/qa-screenshots/`:

- `int-hub-fix-pass1-tiles.png`
- `int-hub-fix-pass2-ctas.png`
- `int-hub-fix-pass3-final.png`
- (INT-LOAD) `int-load-pass1-hub-loaded.png`, `int-load-pass2-settings-prefs-nav.png`, `int-load-pass3-hub-konfiguruj-open.png`

## NIE ruszano

`dam-shell.js`, `dam-tutorial.*`, `dam-assoc-edit.js`, `dam-viz.js`, `local_bridge.py` (endpointy OK).

## Follow-up

- C3 anatomia kart nadal zamrozona.
- A1/A2 OAuth nadal wymaga Client ID/Secret od usera.
- GSAP reveal na hubie: safety killTweensOf; jesli dalej ghosting w IDE browser - rozwazyc skip `revealRows` na tile layout.
