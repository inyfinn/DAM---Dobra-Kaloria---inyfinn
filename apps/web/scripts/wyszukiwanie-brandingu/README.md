# Wyszukiwanie brandingu

Zestaw skryptów do mapowania, indeksacji, kojarzenia produktów i weryfikacji materiałów z `X:/Marketing`.

## Skrypty

| Skrypt | Rola |
|--------|------|
| `../build-branding-index.py` | Pełny skan POLSKA + `-- ARCHIWUM --`, dedup, tagi, zapis `branding-index.json` |
| `../re-enrich-branding-index.py` | Szybki re-enrich wariantów / produktów (bez skanu dysku) |
| `../build-branding-segments.py` | Manifest ~200 segmentów → `data/branding-segments.json` |
| `../process-branding-segment.py` | OCR + enrich jednego segmentu (chunk po chunku) |
| `../enrich-branding-recognize.py` | OCR batch → `branding-recognition.json` |
| `../audit-branding-coverage.py` | Audyt: brakujące pliki vs indeks |
| `../brand_folder_context.py` | Logika wariantów, hintów produktów, legacy tagów |
| `../brand_marketing_segments.py` | Podział drzewa na segmenty |
| `verify-branding-fixtures.py` | Weryfikacja znanych kampanii (regresja linków) |

## Dane

| Plik | Rola |
|------|------|
| `../data/branding-index.json` | Indeks assetów (~49k) |
| `../data/branding-segments.json` | 174-200 segmentów do przetwarzania |
| `../data/branding-recognition.json` | OCR / AI cache |
| `../data/product-associations.json` | Terminy → product_id (priorytet nad zgadywaniem) |
| `../data/file-index.json` | Katalog produktów + miniatury |

## Typowy workflow

```powershell
cd apps/web/scripts

# 1. Mapa segmentów (~200 chunków)
python build-branding-segments.py

# 2. Pełny indeks (rzadko) lub tylko re-enrich po zmianie hintów
python re-enrich-branding-index.py

# 3. Segment po segmencie: OCR + produkty
python process-branding-segment.py --segment seg-172 --ocr-limit 30
python process-branding-segment.py --next-pending --ocr-limit 20

# 4. Audyt pokrycia
python audit-branding-coverage.py

# 5. Regresja znanych kampanii
python wyszukiwanie-brandingu/verify-branding-fixtures.py
```

## Zasady tagów filtrów (UI branding)

1. **Kolejność grup (ogół → szczegół):** Marka → Skojarzenia → Przeznaczenie → Format pliku → Kanał → Produkt → Cechy → Wizualizacja → Kiedy → Kolekcje → Co.
2. **Tagi kanoniczne `facet:*`** w `dam-branding.js` (`CANONICAL_TAGS`) — jeden klucz globalnie; ten sam tag może być w wielu rzędach (np. Slider w Skojarzeniach i Przeznaczeniu), zawsze ten sam filtr.
3. **Przeznaczenie** — kompaktowe pills z pełnym zaokrągleniem (klasa `dam-branding-tag-group--przeznaczenie-tiles`, ~35% poprzedniego rozmiaru kafelków).
4. Przy dodawaniu synonimu: dopisz do `CANONICAL_TAGS`, nie twórz osobno `search:` + `appearance:`.

## Zasady kojarzenia produktów

1. **Hint ścieżki folderu** (`FOLDER_PRODUCT_HINTS`) - **autorytatywny**: gdy hint istnieje, `enrich_folder_groups` **zastępuje** stare `linked_product_ids` (nie merguje z błędnymi wpisami z poprzednich reguł).
2. **product-associations.json** - terminy z OCR / nazw plików (tarta malinowa, muffin jagodowy, …).
3. **OCR** (`enrich-branding-recognize.py`) - tekst z baneru; nie polegać na kolorze opakowania.
4. **Nigdy** mapować wyłącznie po tagu „Deserowe” lub słowie „deserek” na produkty banoffee/tiramisu.

## Weryfikacja live (Ralph / przeglądarka)

Po `re-enrich-branding-index.py`:

```text
http://127.0.0.1:8765/branding.html?v=…&asset=br-004013   # A Może Deserek
http://127.0.0.1:8765/branding.html?v=…&asset=br-004105   # DPD Wielkanoc
```

`verify-branding-fixtures.py` sprawdza też te ID w `branding-index.json` ( nie tylko syntetyczny folder ).

## Fixture’y regresji

- `A Moze Deserek` → mini batoniki (tarta, muffin, sernik) + kulki raw wiśnia + jabłko cynamon; **bez** banoffee/tiramisu.
- `DPD Wielkanoc` → mix mini batoniki.
- `Back To School` → orzech czekolada + chrupiący orzech.
