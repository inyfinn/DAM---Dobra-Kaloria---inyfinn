# Handoff: STREFA A-PREVIEW (Task 36)

**Agent:** Grok · **Status:** DONE (2026-07-20) · **Plik:** `apps/web/assets/js/dam-assoc-edit.js`  
**Bump:** `branding.html` → `dam-assoc-edit.js?v=usab20260720a36f`

## Co zrobione
1. **Layout Bento / CSS Grid** w `#damAssocEditPopover`: head → pinned → search → body → actions.
2. **Body:** `[Podgląd LEWA ~200px] | [lista wyników PRAWA]` (stack <768).
3. **Anti-loop / self-assoc:** `excludeIds` / `excludeIndexes` + dedupe po `id` i indeksie; `isVisualizationLike` filtruje wizki z propozycji produktów.
4. **Stopka DAM:** Zatwierdź = primary purple; Dodaj z dysku / Wstecz = outline (bez topornych green/red pills).
5. Fix regresji: `opt-row` height 0 + `overflow:hidden` ucinał listę → flex + `min-height:64`.

## NIE ruszane
`dam-viz.js`, `dam-media-preview.js`, `dam-danger.js`, `dam-tutorial.js`, `dam-branding.js`, `local_bridge.py`.

## QA / screenshoty
- `tmp/qa-a36/pass4-desktop-clean.png` (desktop, lista + podgląd)
- `tmp/qa-a36/pass3-list-outlined.png` (dowód widoczności wierszy)
- `tmp/qa-a36/pass5-stacked-narrow.png` (wąski / stacked)

## Handoff dalej
- **VIZ-ASSOC:** gdy otwiera picker z kontekstu wizualizacji, przekazać `excludeIds` / `excludeIndexes` / `sourceType:"viz"` (API `DamAssocEdit.openPicker` już konsumuje).
- Miniatury produktów często 404 (`data/thumbs/...`) → panel pokazuje „Brak miniatury” (osobny temat indeksu thumbs).
