# Handoff: synteza usability 2026-07-20 (wieczór)

**Agent:** Grok (synteza read-only + docs) · **Bez re-implementacji.**

## Zamkniete strefy (dowod w process.md / handoff-strefa-*)

| Strefa | Punkty / zakres | Cache (skrot) |
|--------|-----------------|---------------|
| A | 1–10 (P6 dane Partial) | `usab20260720*` media/assoc/viz |
| B | 11–14, 16–18, 21–23; P15 Partial | `dam-branding.js?v=usab20260720f`, css `g` |
| B pe | indekser product_element + skojarzenia | indeks 51611; PI `branding.element_assoc_skladniki_owoce` |
| C / C3 / C4 | 19, 25–26, 39, 41–42 | tutorial `?v=8`+ |
| D | 20, 24 Explorer foreground + path | bridge restart A4 |
| H / H3 | 27–32 | `dam-danger.js?v=usab20260720h3b` |
| SHELL | 33 FOUC | `shellboot20260720b` |
| A3 | 34–38 | `usab20260720a3` |
| DEVICE | 40 | `devicepath20260720a` |
| VIZ-ASSOC / A-PREVIEW | assoc prawa, anti-loop, preview lewa | `usab20260720a36f` + viz-assoc |
| Integracje | skeleton, Bento, Konfiguruj, PLANOWANE, FMCG Edytuj | `skelbent` / `intcfgfix` / `planowane30a` / `fmcgedit20260720b` |

## Otwarte / partial (NIE zielone)

1. **Checklista A3 `[~]`** — UI FMCG Edytuj gotowe; brak pelnego wypelnienia kwot/importu przez usera.
2. **Checklista C3 `[ ]`** — redesign anatomii kart BENTO (zamrozona anatomia kart).
3. **P15 SLIDERY-sklep** — dedup POLSKA-first → 0 sciezek ARCHIWUM; decyzja policy jesli user chce osobne kopie.
4. **POS `\Links\` quality** — nadal w grupie ELEMENTY UI; sweep indeksera marketing Links.
5. **P6 Postanowienia/DPD → babka** — brak `linked_products` w danych (nie bug UI).
6. Checklista: A1/A2 Asana/MS, B1 wykrojniki, B2 XLSX, B3 poster video, B4 Autor, B5 QA dashboard, B7 sweep `?v=`.

## Hard-refresh (Ctrl+F5) po stronach

- Branding / Explorer / Viz / Dashboard — branding `f`/`g`, danger `h3`, assoc `a36f`
- Integracje + Settings — `skelbent20260720a`, `fmcgedit20260720b`, `planowane30a`, `intcfgfix20260720a`
- Po zmianach bridge — restart mostu (A4) + odswiez

## Doctrine

§12 juz zawiera lekcje NFS rebuild, POLSKA overlap, ELEMENTY pe, Konfiguruj panel, FOUC, Links vs materialy — **bez duplikatow**.
