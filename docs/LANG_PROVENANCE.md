# Pochodzenie jezykow / rynkow

Dokumentacja dla ludzi. **Kanon dla agentow:** [`agents/shared/lang-provenance.md`](../agents/shared/lang-provenance.md).  
Instrukcja w bazie: `program-instructions` id `data.lang_provenance_only`.

## Po co to jest

Panel nie moze "zgadywac" rynku (np. GB dla GC). Kazdy kod na ekranie musi wynikac z konkretnego sygnalu. Lepiej pokazac `?` niz klamac.

## Regula w skrocie

| Marka | Co jest pewne | Co wymaga dowodu |
|-------|---------------|------------------|
| **DK** | Zawsze **PL** (produkty Dobra Kaloria sa polskie) | Kazdy inny kod (np. **GB** w wariancie PL/GB) |
| **GC** | Nic automatycznie | Kazdy kod (CZ, SK, GB, DE, ...) |

## Skad bierze sie kod (kolejnosc)

1. **Reczne oznaczenie** - `apps/web/data/lang-overrides.json` (najwyzszy priorytet; rebuild nie nadpisuje).
2. **Nazwa folderu** rewizji / wariantu.
3. **Nazwy plikow** w rewizji (PROJECT/PROJEKT, VISUALS/WIZKI, PRINT/DRUK, ...).
4. **Baseline DK** - jesli marka DK, doklej `pl` gdy go jeszcze nie ma.
5. **Nieznany** - przy GC bez tokenu: puste langs / UI `?`.

## Przyklady

### DK tylko PL

Folder i pliki bez `GB` / `DE` / itd.  
Wynik: `langs = [pl]`, zrodlo `brand_dk`.

### DK PL/GB

W nazwie pliku lub folderu jest token `GB` (albo admin oznaczyl recznie).  
Wynik: `langs = [pl, gb]`, zrodlo `brand_dk+raw` (albo `manual`).

### GC CZ/SK (przyklad metody, nie hardcode produktu)

Plik w PROJECT: `GC_Burger_CZ_SK_6300572_...ai`.  
Wynik: `langs = [cz, sk]`, zrodlo `raw`.  
**Nie** GB "bo eksport / marka GC".

### GC bez tokenu

Brak kodu w nazwach i brak override.  
Wynik: UI `?`, zrodlo `unknown`.

## Zakazy

- GC nie dostaje automatycznie GB.
- DK nie dostaje automatycznie GB (ani innego extra) bez tokenu / override.
- Nie budujemy listy "indeks X zawsze = jezyk Y" jako reguly biznesowej (to sa tylko przyklady audytu).
- Nie bierzemy jezyka ze screenshota opakowania (OCR nie jest zrodlem v1).
- `SKLEP` w nazwie pliku nie znaczy jezyka SK.

## Kod

| Element | Sciezka |
|---------|---------|
| Builder indeksu | `apps/web/scripts/build-file-index.py` (`infer_langs_from_files`, `apply_brand_lang_baseline`, `apply_lang_overrides`) |
| Override | `apps/web/data/lang-overrides.json` |
| UI | `dam-viz.js`, `dam-labels.js`, `dam-badges.js` |
| Rebuild | `python apps/web/scripts/build-file-index.py` |

## Audyt gdy UI "klamie"

1. Otworz folder rewizji na Marketing (read-only).
2. Szukaj tokenu w nazwach folderu i plikow.
3. Porownaj z `file-index.json` (`langs`, `langs_source`).
4. Jesli index zly: popraw parser / usun domysl. Nie dopisuj hardcode produktu.
5. Jesli index pusty a prawda jest znana: wpisz override.
