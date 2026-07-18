# Nazewnictwo - foldery, .ai, wizki

Sciagawka. Zrodlo maszynowe: `apps/web/data/naming-dictionary.json`.

## Hierarchia

```
- POLSKA / - EKSPORT
  └─ 01 - PRODUKTY / 01 - PRODUCTS
     └─ MARKA (DK / GC)
        └─ LINIA
           └─ NAZWA PRODUKTU - [ kategoria ]
              └─ NOSNIK gramatura - DD.MM.RRRR - INDEKS
                 ├─ 0 - ARCHIWUM
                 ├─ 1 - MATERIALY
                 ├─ 2 - PROJEKT          ← .ai .psd .indd
                 ├─ 3 - DRUK
                 └─ 4 - WIZKI            ← .png .jpg .tif
```

Wariant: `<NOSNIK> <gramatura> - DD.MM.RRRR - <INDEKS>`
Produkt: `NAZWA PRODUKTU - [ kategoria ]` (nawias obowiazkowy).

## .ai / .psd / .indd

`<MARKA>-<NOSNIK>-<Linia> - <NAZWA> <gramatura> - <INDEKS>-<STAN>.ai`

STAN: brak = robocza, `-F` = Finished, `-FQ` = Final Quality (druk).

## Wizualizacje (eksport)

`<NOSNIK>-<NAZWA>-<INDEKS>-<PERSPEKTYWA>-<ROZMIAR>[-<NUMER>].<ext>`

Rozmiar: `S` = krotsza krawedz < 1300 px, `L` = >= 1300 px.

## Nosniki (UI zawsze PL)

| Folder / EN | Kod | Etykieta PL |
|-------------|-----|-------------|
| DOYPACK | DOY | DOYPACK |
| BATON / BAR | BAT | BATON |
| MINI BATON | MINI | MINI BATON |
| KARTON 6x MINI | KAR6X | KARTON 6x MINI |
| KARTON / CARTON | KAR | KARTON |
| FOLIA / FOIL | FOLIA | FOLIA |
| REKAW / SLEEVE | REKAW | REKAW |
| TUBA / TUBE | TUBA | TUBA |
| ETYKIETA / LABEL | ETY | ETYKIETA |

Jezyki (CZ, SK, GB...) **nie** wchodza w nazwe nosnika - osobny tag.

## MIX

Nazwa produktu z `MIX` → etykieta nosnika: `MIX - <nosnik>` (np. `MIX - MINI BATON`), nigdy gole `WARIANT`.
