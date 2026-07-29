# Reflection loop — checklista (overlay projektu DAM)

> Skill uniwersalny: `reflection-loop`. Ten plik = scope **tylko** tego repo.

## Scope A: assoc/viz P1–P4

**Pliki w scope:**

- `apps/web/assets/js/dam-assoc-edit.js`
- `apps/web/assets/js/dam-viz.js`
- `apps/web/assets/js/dam-media-preview.js`
- `apps/web/assets/js/dam-folder-picker.js` (gałęzie assoc/COMBO)
- `apps/web/visualizations.html`, `apps/web/branding.html` (cache-bust assoc)

**Macierz P1–P4** (`code-doctrine.md` §12):

| ID | Co naprawiać | Czego NIE ruszać |
|----|--------------|------------------|
| P1 | Viz sugestie — sync seed `_damMaterialsCtx` + enrich po `loadIndexAssets` | branding `data-viz-assoc-cta="product"` (złoty path) |
| P2 | Viz warianty — `openVizAssocVariantsPicker` | wspólny `paintAssoc` brandingu |
| P3 | Align COMBO ↔ picker shell | embed COMBO w `#damAssocEditPopover` |
| P4 | Unifikacja handlerów (delegacja, jeden entry) | zamiana `DamFolderPicker` pickera produktów |

**Typ awarii:**

- **A** — listener/delegacja (klik nie dociera)
- **B** — ctx/dane (toast, pusty picker, zły zapis)

**Kontrakt 3 warstw:** (1) sync ctx+seed → (2) sync bind → (3) async enrich — nigdy odwrotnie.

**Testy min.:** `node --check`, `node scripts/qa/sim-assoc-dodaj.js`; przy P1 dodatkowo `sim-assoc-material-empty-seed.js`; runtime Ctrl+F5.

## Scope B: decyzje architektoniczne

- Nowa/zmieniona reguła biznesowa → najpierw `program-instructions.json`, potem kod.
- Wzorzec UI assoc → COMBO shell (`#damThumbPicker`), nie legacy embed.
- ADR / §12 lekcja gdy nowy anty-wzorzec lub zamknięcie tematu wieloetapowego.
- Auth/privilege: admin ON + rola privileged dla CTA assoc.

## Anty-triggery (krytyk NIE wymagany)

- Pytania „co to jest / jak działa” bez planu zmiany kodu.
- Kosmetyka CSS poza assoc modalami.
- Edycja plików poza listą scope bez słowa usera `/reflect`.

## Pięć trybów krytyka (esencja)

Pełna definicja w skillu **`reflection-loop`** → `references/critic-core.md`. Poniżej tylko anty-triggery DAM.
