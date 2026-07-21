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
updated_at: "2026-07-18"
---

# Identity

Wspolna twarda zasada DAM ETA: **skad bierze sie kod jezyka / rynku**.
Obowiazuje dla wszystkich kodow (`pl`, `de`, `gb`, `cz`, `sk`, ...), nie dla jednego produktu.

# Cel

Agent i kod zawsze potrafia odpowiedziec: **ten jezyk jest na ekranie, bo istnieje konkretny sygnal** (albo pewnik marki DK=PL).
Bez sygnalu dla dodatkowego jezyka - nie dopisujemy go.

# Pewnik marki (wyjatek swiadomy)

| Marka | Baseline | Skad |
|-------|----------|------|
| **DK** | zawsze `pl` | Pewnik biznesowy: produkty DK sa polskie. |
| **GC** | brak | GC **nie** dostaje automatycznie `gb`. |

Przy DK dodatkowe jezyki (np. `gb` w wariancie PL/GB) **nie sa pewnikiem**.
Musza wynikac z nazwy folderu/pliku albo z recznego oznaczenia.

# Zrodla (kolejnosc, od najsilniejszego)

| Priorytet | Zrodlo | Opis |
|-----------|--------|------|
| 1 | Reczne | `lang-overrides.json` (+ UI). Rebuild nigdy nie nadpisuje. |
| 2 | Folder rewizji | Tokeny w nazwie folderu wariantu. |
| 3 | Pliki w rewizji | Tokeny w nazwach plikow (PROJECT, VISUALS, PRINT, ...). |
| 4 | Baseline DK | Jesli marka DK: doklej `pl`, jesli jeszcze go nie ma. |
| 5 | Nieznany (GC) | Brak tokenu przy GC -> `langs=[]` / UI `?`. |

# Algorytm

1. Zbierz tekst: nazwa folderu + nazwy plikow w rewizji.
2. Wyciagnij tokeny (`_CZ_`, `CZ_SK`, `_GB_`, ...).
3. Aliasy ze slownika (`en`/`uk`->`gb` English/UK; `ukr`->`ua`). HARD: `UK` != Ukraina (`UA`).
4. Jesli brand=DK: zapewnij `pl` na liscie (baseline).
5. Jesli brand=GC: **nie** doklejaj `gb`.
6. Zastosuj override reczne (wygrywa zawsze).
7. Zapisz `langs` + `langs_source`: `override` | `raw` | `brand_dk` | `brand_dk+raw` | `unknown`.

# Przyklady

1. **DK sam PL** - brak GB w nazwach -> langs=`[pl]`, source=`brand_dk`.
2. **DK PL/GB** - plik `..._GB_...ai` albo folder z GB -> langs=`[pl, gb]`, source=`brand_dk+raw`.
3. **GC CZ/SK** - plik `...CZ_SK...ai` -> langs=`[cz, sk]`, source=`raw` (nie GB).
4. **GC bez tokenu** - langs=`[]` / UI `?`, source=`unknown` (nie zgaduj GB).

# Zakazy (must_not)

- GC != automatycznie gb
- DK != automatycznie gb (GB tylko z nazwy lub override)
- Domysl ze sciezki EKSPORT vs POLSKA jako jedyny dowod na GB
- Domysl z screenshota opakowania (OCR nie jest zrodlem v1)
- Hardcode "indeks X = jezyk Y" jako regula (przyklad audytu OK)
- Nadpisanie `lang-overrides.json` przez rebuild
- False-positive: `SKLEP` != `SK`

# Kod referencyjny

- `apply_brand_lang_baseline`, `infer_langs_from_files` w `build-file-index.py`
- `apps/web/data/lang-overrides.json`
- `program-instructions` id `data.lang_provenance_only`

# Definition of Done

- DK zawsze pokazuje co najmniej PL
- Extra jezyk (GB, DE, ...) ma token w nazwie albo override
- GC bez tokenu = `?`, nie Wielka Brytania
- QA wskazuje fragment nazwy (albo "baseline DK=PL") dla kazdego kodu na ekranie

# Audyt

1. Marka DK czy GC?
2. Jesli DK: PL jest OK bez tokenu.
3. Kazdy inny kod: szukaj w nazwach folderu/plikow albo w override.
4. Index klamie -> fix parsera, nie hardcode produktu.

# Drafts

[`lang-provenance.DRAFTS.md`](lang-provenance.DRAFTS.md) - kanon = ten plik.
