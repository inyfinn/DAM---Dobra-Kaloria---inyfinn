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

## UI

### branding.html

- Pelny `dam-shell` (sidebar Geex, nawigacja spojna z reszta aplikacji)
- Filtry: rozmiar (S/L/XL), tlo (transparent/white), kanal, archiwum
- Zakladki: **Key visuale** (presety perspektyw WIZKI) i **Layout builder** (podglad ukladow)
- Modal podgladu wideo / wektorow, linki do powiazanych produktow (SKU)
- Domyslnie **bez archiwum** (`-- ARCHIWUM --`, `00 - ARCHIWUM`)

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
# Indeks branding (read-only scan Marketing)
python apps/web/scripts/build-branding-index.py
python apps/web/scripts/build-branding-index.py --marketing "X:/Marketing"

# Powiazanie assetow branding z produktami (SKU w nazwie/sciezce)
python apps/web/scripts/link-branding-products.py

# OCR / rozpoznawanie (stub - RapidOCR w przygotowaniu)
python apps/web/scripts/enrich-branding-recognize.py

# Pakowanie zbiorcze z folderow PROJEKT
python apps/web/scripts/scan-bulk-packaging.py

# Ceny katalogu (sklep / zewnetrzne zrodlo)
python apps/web/scripts/fetch-product-prices.py

# Import wykrojnikow z XLSX
python apps/web/scripts/import-wykrojniki-xlsx.py

# Powiazanie wykrojnikow z produktami
python apps/web/scripts/link-wykrojniki-products.py
```

Po `build-branding-index.py` odswiez cache przegladarki (`?v=hub20260719` lub nowszy bust na assetach).

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

---

## Roadmap (otwarte)

- RapidOCR w `requirements.txt` + realny run `enrich-branding-recognize.py`
- Sekcja materialow marketingowych na `project.html` (linki do branding)
- Pelne 10 wpisow Part G w `program-instructions.json`
- Admin UI kolejki `wykrojnik-mapping-queue`
- Alias bridge `PATCH /product-catalog` (obecnie `POST /product-catalog/update`)
