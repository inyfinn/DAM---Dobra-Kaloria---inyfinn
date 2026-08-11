# BENTO card anatomy — FREEZE (nie redesign)

Stan: **2026-07-20** · źródło: `memory.md` §123 · checklista **C3** = freeze anatomii (nie redesign).

## Zamrożone selektory (anatomia 1:1)

| Selektor | Plik reguł | Zakaz |
|----------|------------|--------|
| `.dam-viz-card` (+ `__body`, `__title`, `__title-wrap`, `__title-pl*`, `__meta`, `__badges`, `__actions`, `__path`, `--no-viz`, `--clickable`) | `apps/web/assets/css/dam-brand.css` | Restyl anatomii karty wiz / wspólnej karty assetu |
| `.dam-branding-card` (+ `--video`, `--group`, `__id-chip`, thumb/video wrap) | `apps/web/assets/css/dam-branding.css` | Restyl anatomii karty Branding |
| `.dam-project-card` | CSS projektów / brand | Restyl anatomii karty projektu |
| `#damMediaPreview`, viz modal (warstwa karty w modalu) | `dam-branding.css` / `dam-brand.css` / media-preview | Zmiana układu karty w modalu „pod nowe bento” |

## Forbidden (bez ADR + jawnej zgody usera)

- Redesign siatki kart assetów (nowe proporcje thumb/body, nowa hierarchia title/meta/badges/CTA).
- Zmiana paddingu/gap/min-height anatomii body, `object-fit` wordmark/thumb w sposób tnący treść.
- „Upiększanie bento” kart `.dam-viz-card` / `.dam-branding-card` przy okazji chrome hubów.

## Chrome OK (wolno)

- Toolbar / filtry / shell / page chrome hubów (`dam-bento.css`, sidebar, tag bar).
- Bugfixy funkcjonalne (klik, filtr, poster fallback, a11y) **bez** zmiany geometrii karty.
- Cache-bust `?v=`, copy, dane, bridge — o ile nie ruszają anatomii CSS kart.

## Procedura gdy trzeba ruszyć anatomię

1. ADR + wpis w `program-instructions` / memory.
2. Odblokuj C3 w checklistie jako redesign (osobne zadanie), nie „przy okazji”.
3. Po zmianie: screenshot + Read (expanded/collapsed sidebar jeśli chrome), min. 3 przeloty.

Zobacz też: `agents/shared/code-doctrine.md` §12 (lekcja freeze).
