# Handoff: STREFA TOOLTIPS — `#damAssocActionMenu`

**Data:** 2026-07-20  
**Agent:** STREFA TOOLTIPS (follow-up)  
**Status:** DONE (3 przeloty screenshot+Read)

## Problem

Itemy w `#damAssocActionMenu` (np. link „Przejdź”) nie miały `data-dam-tip` / `title` / `aria-label`.  
`dam-tooltips.js` binduje `<a>`/`<button>`, ale `bindElement` wychodzi wcześnie gdy `tipText` jest pusty — stąd brak tipów.

## Gdzie było

| Co | Plik |
|----|------|
| Render menu | `apps/web/assets/js/dam-assoc-edit.js` → `openActionMenu()` (~L279–340), id `#damAssocActionMenu`, klasa `.dam-assoc-action-menu__item` |
| Style | `apps/web/assets/css/dam-branding.css` (`.dam-assoc-action-menu*`) |
| Zamknięcie z preview | `dam-media-preview.js` woła `DamAssocEdit.closeActionMenu` |
| Skrypt assoc | obecnie tylko `branding.html` ładuje `dam-assoc-edit.js` |

Innego „action-menu” o tej klasie nie ma. Przyciski wiersza pickera (`.dam-assoc-edit-popover__row-btn`) już mają `title`/`aria-label` → tipy z auto-bind `dam-tooltips.js`.

## Jak naprawione (współbieżność)

Nie edytowano `dam-assoc-edit.js` / `dam-media-preview.js` / `dam-explorer.js` / `dam-branding.js` / tutorial / bridge.

**Nowy plik:** `apps/web/assets/js/dam-assoc-action-tips.js` (`?v=1`)

- MutationObserver na `document.body`
- Dla `#damAssocActionMenu` / `.dam-assoc-action-menu` dopina `data-dam-tip` wg `href` / `data-action` / tekstu `<span>`
- Wywołuje `DamTooltips.bind(menu)`

**HTML (po `dam-tooltips.js`):**

- `branding.html`
- `explorer.html`
- `dashboard.html`
- `visualizations.html`

## Teksty tipów

| Item | Tip |
|------|-----|
| Przejdź (`explorer.html?product=…`) | Przejdz do produktu w Eksploratorze |
| Eksplorator (`data-action=explorer`) | Otworz folder w Windows Explorerze (lub „Brak sciezki…” gdy disabled) |
| Wizualizacja (`visualizations.html?product=…`) | Otworz produkt w Wizualizacjach |
| Kopiuj link (`data-action=copy-link`) | Skopiuj link do produktu |

## Weryfikacja

- `node --check apps/web/assets/js/dam-assoc-action-tips.js` OK
- CDP branding: 4/4 itemy `data-dam-tip` + `_damTipBound` + `#damGlobalTooltip` visible
- Screenshot+Read (HARD GATE):

  1. `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\assoc-action-tips-pass1-przejdz.png` — „Przejdz do produktu w Eksploratorze”
  2. `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\assoc-action-tips-pass2-eksplorator.png` — „Otworz folder w Windows Explorerze”
  3. `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\assoc-action-tips-pass3-kopiuj.png` — „Skopiuj link do produktu”
  4. (wcześniejszy) `assoc-action-tips-przejdz.png`

## Follow-up (opcjonalnie, gdy H zwolni `dam-assoc-edit.js`)

Wstawić `data-dam-tip` bezpośrednio w HTML stringu `openActionMenu` i wtedy binder staje się redundantny (można zostawić jako safety net).

## Nie ruszane

`dam-tutorial.*`, `dam-branding.js`, `dam-danger.js`, `local_bridge.py`, `build-branding-index.py`, git commit/push.
