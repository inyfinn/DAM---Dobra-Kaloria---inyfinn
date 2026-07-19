# Branding DAM Hub

Modul laczacy **materialy marketingowe** z dysku Marketing (read-only) z katalogiem produktow DAM, pakowaniem zbiorczym i kartą produktu.

Pelna specyfikacja planu: `branding_dam_hub` (Plan v4, wewnetrzny).

---

## Zakres

| Obszar | Opis |
|--------|------|
| **Branding** | `branding.html` - siatka assetow, filtry, kampanie, Key visuale, layout builder |
| **Katalog produktu** | Karta na `project.html` (`product-catalog.json`, ceny z bridge) |
| **Pakowanie zbiorcze** | Badge `2F·2×12` itd. (`bulk-packaging.json`, tier low ukryty domyslnie) |
| **Wykrojniki** | Rejestr XLSX/PDF, koszty w `build-project-costs.py`, kolejka mapowan |
| **Wspolne tokeny** | `dam-hub-shared.css` - katalog + branding + toggle tier |

Dysk `X:\Marketing` (lub `D:\Marketing`) jest **tylko do odczytu** - DAM buduje indeksy JSON w `apps/web/data/`.

---

## Dwie lokalizacje Marketing (POLSKA + stara struktura)

Indeks branding skanuje **obie** glowne lokalizacje i laczy je w jedna siatke skojarzen (bez przenosin na dysku).

| Lokalizacja | Priorytet | Tagi specjalne |
|-------------|-----------|----------------|
| `X:/Marketing/- POLSKA/...` | **Wygrywa przy nakladce** | Slidery, Na sklep, Szkoła, Edytowalny itd. - **bez** Archiwum |
| `X:/Marketing/-- ARCHIWUM --/...` | Tylko pliki **bez** odpowiednika w POLSKA | **Archiwum** + **Stara struktura** + tagi ze starego drzewa folderow |

### Dedup POLSKA-first

Build (`build-branding-index.py`) skanuje najpierw `- POLSKA` (oraz EKSPORT branding), potem `-- ARCHIWUM --`.
Plik z archiwum jest **pomijany**, gdy w POLSKA istnieje ten sam material:

- Klucz: **stem kampanii + wymiary z nazwy** (np. `back to school:992x600`)
- Lapie warianty nazw: `BACK to School -992.png` vs `Back to school - 992.jpg`

Regula w `program-instructions.json`: `branding.marketing_dual_roots`.

### Stara struktura folderow (mapowanie tagow)

Segmenty sciezki w `-- ARCHIWUM --` dostaja tagi skojarzeniowe (oprócz Archiwum / Stara struktura):

| Folder (archiwum) | Tagi |
|-------------------|------|
| `01_Opakowania` | Opakowania |
| `02_Materiały marketingowe` | Materiały marketingowe |
| `03_Materiały graficzne` | Materiały graficzne |
| `04_Dokumenty` | Dokumenty |
| `05_Materiały graficzne e-commerce` | E-commerce, Na sklep |
| `06_Materiały firmowe` | Materiały firmowe |
| `07_Kampanie` | Kampanie |
| `08_PROCESY` | Procesy |
| `09 PRZEPISY` | Przepisy |
| `10 STRONA WWW` | Strony WWW, Na sklep |
| `99_Inne` | Inne |

Implementacja: `brand_folder_context.py` → `LEGACY_FOLDER_TAGS`, `extract_legacy_archive_tags()`.

### Kontekst folderu (warianty, produkty, tagi tematyczne)

Po buildzie skrypt `brand_folder_context.enrich_folder_groups()` grupuje pliki **po katalogu nadrzednym** (`folder_dir`):

| Sygnal | Efekt |
|--------|--------|
| 3 slidery w folderze (1920/992/576 × 600) | `folder_variants`: Desktop, Tablet, Mobile |
| `.psd` / `.ai` obok rastra | tag **Edytowalny** + `format_technical: editable` |
| Nazwa folderu (np. Back To School) | tag **Szkoła** (`THEME_VOCAB`) |
| Hint folderu / OCR / nazwy produktow | `linked_product_ids` + `linked_products[]` z miniaturami z `file-index` (`viz_latest`) |
| Wspolna grupa | `folder_group_id` - przy przełaczeniu wariantu **te same** skojarzenia na dole modala |

Przyklad: `.../SLIDERY NA GŁÓWNĄ/Back To School/` → ORZECH CZEKOLADA + CHRUPIĄCY ORZECH (miniatury batonow), 3 warianty, Szkoła, Edytowalny.

### Tagi sliderow sklepu WWW

Folder segment `SLIDERY` (w sciezce) → tagi **Slidery** + **Na sklep** + urzadzenie z wymiarow (Desktop 1920×600, Tablet 992×600, Mobile 576×600).

Regula: `program-instructions` → `branding.slider_shop_tags`. Kod: `brand_tag_utils.extract_folder_segment_tags()`.

Filtr **Slidery** w UI przełącza zakladke **Strony WWW** (nie Kampanie).

---

## UI

### branding.html

- Pelny `dam-shell` (sidebar Geex, nawigacja spojna z reszta aplikacji)
- Nawigacja **skojarzeniowa** (tagi, wyszukiwanie, kolekcje) - nie drzewo folderow dysku
- Zakladki: Kampanie, Social & wideo, **Strony WWW**, Packshoty, Brandbook
- Filtry chipami: produkt, rok, kanal, Slidery, Na sklep, Desktop/Tablet/Mobile, Edytowalny, …
- Modal podgladu (`dam-media-preview.js`): warianty materiału | separator | skojarzone produkty (klikalne miniatury)
- Domyslnie **bez archiwum produktowego**; `-- ARCHIWUM --` Marketing indeksowane osobno (stara struktura, tagi Archiwum)

### Toggle „Odsłon wszystko” (tagi tier low)

Pakowanie zbiorcze i inne tagi niskiego priorytetu (tier `low`) sa domyslnie ukryte.

- Eksplorator, Wizualizacje, Projekty: checkbox **Odsłon wszystko**
- Stan: `localStorage` klucz `damRevealLowTags`
- Event: `dam-tag-tiers-changed` - wymusza re-render badge
- API JS: `DamBadges.badgeTierOpt()`, `DamBadges.packagingTagsFrom()`

### project.html

- Karta katalogowa produktu (EAN, ceny, kategoria sklepu)
- Sekcja wykrojnikow (gdy powiazane w rejestrze)
- Wspolny CSS: `dam-hub-shared.css`

### Dashboard

- Widget `branding_latest` - ostatnie assety z indeksu branding

### Pomoc

- `help.html` - slownik perspektyw, kanalow, pakowania zbiorczego

---

## Dane (`apps/web/data/`)

| Plik | Rola |
|------|------|
| `branding-index.json` | Glowny indeks assetow marketingowych |
| `branding-search-index.json` | Indeks do wyszukiwania (build razem z branding) |
| `campaigns.json` | Kampanie wyciagniete ze struktury folderow |
| `branding-build-status.json` | Status ostatniego buildu |
| `product-catalog.json` | Karta katalogowa (EAN, opisy, kategorie) |
| `bulk-packaging.json` | Mapowanie SKU -> tagi pakowania zbiorczego |
| `brand-*.json` | Slowniki kanalow, perspektyw, rozmiarow |
| `wykrojniki-registry.json` | Rejestr wykrojnikow (import XLSX) |
| `wykrojnik-mapping-queue.json` | Kolejka recznych mapowan (bridge API) |

---

## Skrypty

Wszystkie z katalogu `apps/web/scripts/`, uruchamiane z root repo lub z `apps/web`:

```powershell
# Indeks branding (read-only scan Marketing: - POLSKA + -- ARCHIWUM --, dedup POLSKA-first)
python apps/web/scripts/build-branding-index.py
python apps/web/scripts/build-branding-index.py --marketing "X:/Marketing"

# Powiazanie assetow branding z produktami (SKU w nazwie/sciezce)
python apps/web/scripts/link-branding-products.py

# OCR / rozpoznawanie (batch - lepsze skojarzenia produktow na grafikach)
python apps/web/scripts/enrich-branding-recognize.py
python apps/web/scripts/enrich-branding-recognize.py --limit 300

# Tagi appearance (Slidery, Na sklep, urzadzenia) - wywolywane z build-branding-index
# brand_tag_utils.py, brand_folder_context.py

# Pakowanie zbiorcze z folderow PROJEKT
python apps/web/scripts/scan-bulk-packaging.py

# Ceny katalogu (sklep / zewnetrzne zrodlo)
python apps/web/scripts/fetch-product-prices.py

# Import wykrojnikow z XLSX
python apps/web/scripts/import-wykrojniki-xlsx.py

# Powiazanie wykrojnikow z produktami
python apps/web/scripts/link-wykrojniki-products.py
```

Po `build-branding-index.py` odswiez cache przegladarki (`?v=hub20260719disc8` lub nowszy bust na assetach).

**Git LFS:** `branding-index.json` i `branding-search-index.json` sa w **Git LFS** (indeks po pelnym skanie archiwum przekracza limit 100 MB GitHub). Po `git clone` potrzebny `git lfs pull`. Bez LFS: lokalny rebuild `python apps/web/scripts/build-branding-index.py`.

### Pliki Python (branding)

| Plik | Rola |
|------|------|
| `build-branding-index.py` | Skan POLSKA + archiwum, dedup, linki SKU, enrich tagow i folderow |
| `brand_tag_utils.py` | Tagi folderow (SLIDERY), placement, merge tagow |
| `brand_folder_context.py` | Grupy folderow: warianty, Edytowalny, Archiwum, produkty, Szkoła |
| `link-branding-products.py` | Dopelnienie `linked_product_ids` po SKU |
| `enrich-branding-recognize.py` | OCR → `ocr_text`, lepsze skojarzenia |

### Testy jednostkowe

```powershell
python -m unittest apps.desktop.tests.test_build_branding_dedupe apps.desktop.tests.test_brand_folder_context apps.desktop.tests.test_brand_tag_utils -v
```

---

## Bridge API (`local_bridge.py`, port 8766)

| Metoda | Sciezka | Opis |
|--------|---------|------|
| GET | `/branding-index` | Pelny indeks branding |
| GET | `/branding/status` | Status buildu |
| POST | `/branding/rebuild` | Uruchom `build-branding-index.py` |
| POST | `/branding/recognize` | Uruchom enrich OCR (stub) |
| GET | `/product-catalog` | Katalog produktow |
| POST | `/product-catalog/update` | Aktualizacja wpisu katalogu |
| GET | `/bulk-packaging` | Mapowanie pakowania zbiorczego |
| GET | `/wykrojniki-registry` | Rejestr wykrojnikow |
| POST | `/wykrojniki/reimport` | Ponowny import XLSX |
| GET/POST | `/wykrojnik-mapping-queue` | Kolejka mapowan |

---

## Perspektywy WIZKI (skrot)

Nazwy plikow z tokenami `-ENFACE-`, `-FRONT-`, `-BACK-`, `-TYL-` + rozmiar `S` / `L` / `XL` / `S-SKLEP`.

- PNG = tlo transparentne, JPG = biale
- Filtry w UI mapuja na pola `perspective`, `size`, `background` w indeksie

Szczegoly w `help.html` i slownikach `brand-perspectives.json`, `brand-sizes.json`.

---

## Reguly biznesowe

Krytyczne decyzje (status F/X/D, pakowanie, branding, katalog) sa w:

- `apps/web/data/program-instructions.json`
- Postgres KV `dam_kv_store.program-instructions`

Przy konflikcie z `memory.md` wygrywa **program-instructions**.

---

## QA po zmianach UI

1. Odswiez strone z cache bust (`?v=`)
2. Screenshot (branding grid, sidebar collapsed, karta katalogowa 375px)
3. Sprawdz toggle tier low, czytelnosc logo w sidebarze

Regula: `.cursor/rules/verify-ui-after-changes.mdc`

### Restart mostu po aktualizacji

Po `git pull` z nowymi endpointami hub **zrestartuj** `local_bridge.py`. Stary proces na 8766 zwraca `404 not_found` dla `/branding-index` (UI nadal dziala ze statycznych JSON w `data/`).

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/smoke-branding-hub.ps1
```

`GET /health` zwraca `api_version` (>= 2) i liste `hub_routes`.

---

- RapidOCR w `requirements.txt` + realny run `enrich-branding-recognize.py`
- Sekcja materialow marketingowych na `project.html` (linki do branding)
- Pelne 10 wpisow Part G w `program-instructions.json`
- Admin UI kolejki `wykrojnik-mapping-queue`
- Alias bridge `PATCH /product-catalog` (obecnie `POST /product-catalog/update`)
