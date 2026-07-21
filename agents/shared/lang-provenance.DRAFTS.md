---
name: dam-lang-provenance-drafts
role: shared
status: drafts-only
language: pl
updated_at: "2026-07-18"
---

# 3 podejscia (robocze) - skad bierze sie jezyk

Cel: twarda zasada to **pochodzenie sygnału**, nie hardcode jednego indeksu (np. 6300572).
Przyklad 6300572 = CZ+SK jest tylko **dowodem**, ze sygnal byl w nazwie pliku `...CZ_SK...`.

## Podejscie A - Kaskada zrodel (priority ladder)

1. Reczne (`lang-overrides.json`) - nigdy nie nadpisuj rebuildem.
2. Tokeny w nazwie folderu rewizji (np. `..._DE_AT_...`, `GB`).
3. Tokeny w nazwach plikow w rewizji (PROJECT / PROJEKT / VISUALS / WIZKI / PRINT).
4. Brak sygnalu -> puste langs / UI `?`.

Wyjątek: DK zawsze PL (pewnik). Zakaz: GC->gb; DK->gb bez tokenu; "bo eksport".

Mocne: proste, latwe do audytu.
Slabe: bez pola `lang_source` trudniej debugowac w UI.

## Podejscie B - Dowod na dysku (evidence-first)

Jezyk X wolno pokazac IFF istnieje **dowod tekstowy** w surowych nazwach:

- token granicami nie-liter: `_CZ_`, `-SK-`, ` CZ `, `CZ_SK`, `GB_AR`
- aliasy tylko ze slownika (`en`/`uk`->`gb`, `ukr`->`ua`; UK != Ukraina/UA)
- false-positive guard: `SKLEP` != `SK`, `FRONT` != `FR` (jesli FR nie jest osobnym tokenem)

Brak dowodu = brak jezyka (nie zgaduj z opakowania na screenshocie).

Mocne: zero halucynacji.
Slabe: wymaga starannego regex + listy kodow.

## Podejscie C - Provenance w indeksie (traceable)

Kazdy wynik ma:

- `langs: string[]`
- `lang_source: "override" | "folder" | "file" | "unknown"`
- opcjonalnie `lang_evidence: [fragment nazwy...]`

UI renderuje tylko to, co ma source != unknown (albo pokazuje `?`).
QA: fail jesli UI pokazuje kod bez evidence w indeksie.

Mocne: da sie sprawdzic "skad to wziales".
Slabe: wymaga dyscypliny w builderze indeksu.

---

# Wybor

Final = **A + B + C**: kaskada + wymog dowodu + pole source w danych.
Zobacz kanon: [`lang-provenance.md`](lang-provenance.md).
