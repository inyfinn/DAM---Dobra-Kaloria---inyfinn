# Handoff: STREFA VIZ-ASSOC (Grok) — 2026-07-20

## Status: DONE (UI)

### Cel
1. `#damVizModal` / DamMediaPreview `viz-studio`: **Skojarzone materiały po PRAWEJ** (2-col).
2. **Zakaz pętli wiz→wiz** w liście skojarzeń.
3. RWD 375 / 768 / 1280 (mobile stack: hero → meta → assoc).

### Design Read
Reading this as: B2B DAM product-preview modal (Geex) for marketers, calm studio layout mirroring branding associations column, leaning toward CSS Grid bento split without AI-purple chrome.

### Jak odcięto loop
W `dam-media-preview.js` → `renderLinkedBrandingAssets`:

| Filtr | Co odcina |
|-------|-----------|
| `isVisualizationAsset` | `asset_role=packshot`, `source=wizki/visuals`, ścieżki `4 - WIZKI` / `4 - VISUALS` / `/wizki/` |
| `isNoiseBrandKitAsset` | globalne `IKONY` / logo brand_asset (szum 1500+) |
| `isRelevantMaterialForProduct` | zostawia role WWW/social/POS/KV **albo** asset z tokenami nazwy/indeksu produktu w path/name |

**Babka 6300684:** linked 1802 → po filtrach **7** materiałów (slidery/REFORMATY/ZESTAWY/grafiki WWW babki). Zero packshotów / nazw WIZKA/ENFACE w liście.
**OATS:** split layout OK, lista 0 (brak relewantnych marketing materials) — bez fałszywych wizek.

### Layout
- Klasa: `.dam-viz-modal-box--assoc-split`
- CSS: `apps/web/assets/css/dam-viz-modal.css`
- HTML: `#damVizModal` w `dam-viz.js` + DamMediaPreview `mode=viz-studio`
- Desktop: `grid` lewa `__main` (thumb+meta+actions) / prawa `__assoc-pane`
- `<768`: `flex` column, stack hero → meta → assoc

### PI (przed kodem)
`viz.assoc_no_visualization_loop` w `program-instructions.json` (critical).

### Pliki (własne)
- `apps/web/assets/js/dam-viz.js`
- `apps/web/assets/js/dam-media-preview.js`
- `apps/web/assets/css/dam-viz-modal.css` (nowy)
- bump `?v=vizassoc20260720c` w visualizations / explorer / dashboard / branding HTML
- **NIE ruszano:** `dam-assoc-edit.js`, `dam-branding.js`, `dam-shell`, `dam-tutorial`, `local_bridge`

### Screenshots (przeloty)
| Pass | Viewport | Plik |
|------|----------|------|
| 1 | 1280 | `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\viz-assoc-pass1-1280.png` |
| 2 | 1280 | `...\viz-assoc-pass2-1280.png` |
| 3 | 1280 | `...\viz-assoc-pass3-1280.png` (czysty: assoc prawo, 7 M-*) |
| 4 | ~768 | `...\viz-assoc-pass4-768.png` |
| 5 | 375 stack | `...\viz-assoc-pass5-mobile-stack.png`, `...\viz-assoc-pass5-mobile-assoc.png` |

### Handoff dla indeksera (`build-branding-index.py` / agent danych)
1. **Nie zapisuj** `linked_products` z packshotów WIZKI jako „materiałów brandingowych” przy innych packshotach.
2. **Nie masuj-linkuj** całego folderu `03 - IKONY` do każdego produktu (szum brand_asset).
3. Kafelek WWW `05 - GRAFIKI POJEDYNCZYCH` innego produktu nie powinien dziedziczyć `linked_products` babki bez jawnego skojarzenia.
4. UI filtruje — źródło prawdy i tak warto naprawić w indeksie (mniej JSON / mniej false positive).

### Test
- `node --check` dam-viz.js + dam-media-preview.js OK
- CDP: `paneRight=true`, `vizOut=200` packshotów odciętych, babka names tylko marketing, OATS bez wizki w assoc
