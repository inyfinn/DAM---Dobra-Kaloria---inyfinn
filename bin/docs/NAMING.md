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

## Nosniki — policy (baza + ustawienia)

Zrodlo: `naming-dictionary.json` → Postgres `dam_kv_store.naming-dictionary`
oraz lustro w `app-settings.json` (`dam_kv_store.app-settings`).
Karta w `settings.html` → „Nazewnictwo nośników”.

| Warstwa | Pole | Przyklad |
|---------|------|----------|
| **Program (UI)** | `label_pl` | DOYPACK, FOLIA, BATON |
| **Dysk Windows** | `short` | DOY, FOL, BAT |

`policy.carrier_display_in_ui = label_pl`  
`policy.carrier_prefix_on_disk = short`

Skroty istnieja **tylko** zeby nazwy w Eksploratorze zajmowaly mniej miejsca.
Rename folderu/pliku zawsze pisze `short`. Badge / meta / picker zawsze `label_pl`.

| Prefiks folderu | Kod | UI (`label_pl`) |
|-----------------|-----|-----------------|
| DOY | DOY | DOYPACK |
| BAT | BAT | BATON |
| MINI | MINI | MINI BATON |
| KAR6X | KAR6X | KARTON 6x MINI |
| KAR | KAR | KARTON |
| FOL | FOLIA | FOLIA |
| REKAW | REKAW | RĘKAW |
| TUBA | TUBA | TUBA |
| ETY | ETY | ETYKIETA |

Jezyki (CZ, SK, GB...) **nie** wchodza w nazwe nosnika - osobny tag.

## MIX

Nazwa produktu z `MIX` → etykieta nosnika: `MIX - <nosnik>` (np. `MIX - MINI BATON`), nigdy gole `WARIANT`.
