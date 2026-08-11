---
name: dam-lang-provenance
role: shared
applies_to:
  - architect
  - builder
  - qa
model_hint: composer-2.5
workspace: "P:\\DAM"
language: pl
updated_at: "2026-07-21"
---

# Identity

Wspolna twarda zasada DAM ETA: **skad bierze sie kod jezyka / rynku**.
Obowiazuje dla wszystkich kodow (`pl`, `de`, `en`, `cz`, `sk`, ...), nie dla jednego produktu.

# Cel

Agent i kod zawsze potrafia odpowiedziec: **ten jezyk jest na ekranie, bo istnieje konkretny sygnal** (albo pewnik marki DK=PL).
Bez sygnalu dla dodatkowego jezyka - nie dopisujemy go.

# Pewnik marki (wyjatek swiadomy)

| Marka | Baseline | Skad |
|-------|----------|------|
| **DK** | zawsze `pl` | Pewnik biznesowy: produkty DK sa polskie. |
| **GC** | brak | GC **nie** dostaje automatycznie `en`. |

Przy DK dodatkowe jezyki (np. `en` w wariancie PL/EN) **nie sa pewnikiem**.
Musza wynikac z nazwy folderu/pliku albo z recznego oznaczenia.

# Kanon kodu English = EN (HARD 2026-07-21)

| Token w nazwie | Kod kanoniczny (store + UI chip) |
|----------------|----------------------------------|
| `EN`, `GB`, `UK` | **`en`** (chip **EN**) |
| `UA`, `UKR` | **`ua`** (Ukraina) |

HARD: `UK` != Ukraina. Alias: `gb`/`uk`/`en` -> `en`. Chip **GB** znika z UI.

# Zrodla (kolejnosc, od najsilniejszego)

| Priorytet | Zrodlo | Opis |
|-----------|--------|------|
| 1 | Reczne | `lang-overrides.json` (+ UI). Rebuild nigdy nie nadpisuje. |
| 2 | Folder rewizji | Tokeny w nazwie folderu wariantu, w tym segment ` - PL EN - ` miedzy nazwa/data a indeksem. |
| 3 | Pliki **tylko** PROJEKT + WIZKI | Tokeny w nazwach plikow ze slotow `PROJEKT`/`PROJECT` oraz `4 - WIZKI`/`VISUALS`. |
| 4 | Baseline DK | Jesli marka DK: doklej `pl`, jesli jeszcze go nie ma. |
| 5 | Nieznany (GC) | Brak tokenu przy GC -> `langs=[]` / UI `?`. |

# Zakaz puli Materialy / Magnific (HARD)

Pliki w `MATERIALY` / Magnific z tokenem `…-uk_…` / `…-en_…` to **zbieg okolicznosci** - **IGNORUJ** przy `infer_langs_from_files`.
Jezyk bierze sie **tylko** z: override, nazwy folderu rewizji, plikow PROJEKT i/lub WIZKI.

# Nazwa folderu multi-lang (HARD)

Przy **2+ jezykach**: wstaw ` - LANG LANG - ` miedzy nazwa/data a indeksem, np.:
`KAR6X - 20.05.2026 - PL EN - 6300783.00`

Przy **jednym jezyku** (DK = PL): **nie** dodawaj samotnego `- PL -`.

Reczne dodanie tagu jezyka (admin) rename'uje folder wg tego wzorca.

# Algorytm

1. Zbierz tekst: nazwa folderu + nazwy plikow **tylko** z PROJEKT/PROJECT i WIZKI/VISUALS.
2. Wyciagnij tokeny (`_CZ_`, `CZ_SK`, `_EN_`, `_GB_`, segment ` - PL EN - `, ...).
3. Aliasy ze slownika (`gb`/`uk`/`en`->`en`; `ukr`->`ua`). HARD: `UK` != Ukraina (`UA`).
4. Jesli brand=DK: zapewnij `pl` na liscie (baseline).
5. Jesli brand=GC: **nie** doklejaj `en`.
6. Zastosuj override reczne (wygrywa zawsze).
7. Zapisz `langs` + `langs_source`: `override` | `raw` | `brand_dk` | `brand_dk+raw` | `unknown`.

# Przyklady

1. **DK sam PL** - brak EN/GB w nazwach PROJEKT/WIZKI/folder -> langs=`[pl]`, source=`brand_dk`. Bez `- PL -` w nazwie folderu.
2. **DK PL/EN** - folder `... - PL EN - 6300783.00` albo plik `..._EN_...ai` w PROJEKT/WIZKI -> langs=`[pl, en]`, source=`brand_dk+raw`.
3. **MATERIALY Magnific uk** - plik w MATERIALY z `-uk_` **nie** dodaje EN/UA.
4. **GC CZ/SK** - plik `...CZ_SK...ai` w PROJEKT -> langs=`[cz, sk]`, source=`raw` (nie EN).
5. **GC bez tokenu** - langs=`[]` / UI `?`, source=`unknown` (nie zgaduj EN).

# Zakazy (must_not)

- GC != automatycznie en
- DK != automatycznie en (EN tylko z nazwy lub override)
- Domysl ze sciezki EKSPORT vs POLSKA jako jedyny dowod na EN
- Domysl z screenshota opakowania (OCR nie jest zrodlem v1)
- Hardcode "indeks X = jezyk Y" jako regula (przyklad audytu OK)
- Nadpisanie `lang-overrides.json` przez rebuild
- False-positive: `SKLEP` != `SK`
- Branie jezyka z MATERIALY / Magnific
- Chip UI **GB** (uzywaj **EN**)

# Kod referencyjny

- `apply_brand_lang_baseline`, `infer_langs_from_files`, `is_lang_evidence_file` w `build-file-index.py`
- `apps/web/data/lang-overrides.json`
- `program-instructions` id `data.lang_provenance_only`, `data.lang_uk_not_ukraine`, `naming.folder_lang_tokens`

# Definition of Done

- DK zawsze pokazuje co najmniej PL
- Extra jezyk (EN, DE, ...) ma token w folderze / PROJEKT / WIZKI albo override
- GC bez tokenu = `?`, nie English
- UI chip = EN (nie GB)
- QA wskazuje fragment nazwy (albo "baseline DK=PL") dla kazdego kodu na ekranie

# Audyt

1. Marka DK czy GC?
2. Jesli DK: PL jest OK bez tokenu.
3. Kazdy inny kod: szukaj w nazwie folderu albo w plikach PROJEKT/WIZKI albo w override.
4. Index klamie -> fix parsera, nie hardcode produktu.

# Drafts

[`lang-provenance.DRAFTS.md`](lang-provenance.DRAFTS.md) - kanon = ten plik.
