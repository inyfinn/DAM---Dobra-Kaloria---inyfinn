# Logo Dobra Kaloria (sidebar / header)

## Zasada

- Uzywamy wylacznie logo **Dobra Kaloria** (standardowe).
- **Zakaz:** logo wariantow **Niemiesa**.
- Na jasnym tle (light mode) **nie** uzywamy bialego wordmarku (`fill: #fff`) - jest niewidoczny.

## Zrodlo brand (poza repo)

`D:\Marketing\- POLSKA\- BRANDING i MARKA -\DOBRA KALORIA\01 - LOGO\SVG`

Pliki kanoniczne do kopiowania:

| Wariant | Plik brand | Uzycie w DAM |
|---------|------------|--------------|
| Zielony `#008244` | `LOGO Dobra Kaloria zielony.svg` | Light + Dark (domyslnie) |
| Bialy wordmark | `LOGO Dobra Kaloria bialy.svg` | Opcjonalnie tylko na bardzo ciemnym tle |
| Biale tlo + czarne napisy | `LOGO Dobra Kaloria Bialy - czarne napisy.svg` | Nie do sidebara (duzy kafelek) |

## Pliki w repo

- `apps/web/assets/img/logo-dk-green.svg` - kanoniczne logo UI
- `apps/web/assets/img/logo-dk-white.svg` - zapas na dark (jesli kiedyś potrzeba)
- `apps/web/assets/img/logo-lite.svg` / `logo-dark.svg` - Geex dual-theme slots (oba = zielony)
- `apps/web/assets/img/logo-dobra-kaloria.svg` - alias (signin / shell)

## Runtime

`dam-shell.js` -> `applyDobraKaloriaLogo()` ustawia `src` osobno dla `.logo-lite` i `.logo-dark`.

CSS: `dam-brand.css` (sekcja logo) - wymusza widocznosc slotu zgodnego z `html[data-theme]`.

## Kontrast

| Motyw | Tlo sidebara | Logo | Dlaczego |
|-------|--------------|------|----------|
| Light | jasne / off-white | zielony `#008244` | bialy wordmark = niewidoczny |
| Dark | ciemny | zielony `#008244` | czytelny; opcjonalnie white |

## Failure modes

- **FM-LOGO-WHITE-ON-LIGHT** - bialy SVG na jasnym sidebarze → wyglada jak „brak logo”.
- **FM-LOGO-NIEMIESA** - przypadkowe skopiowanie pliku z „Niemiesa” w nazwie.
