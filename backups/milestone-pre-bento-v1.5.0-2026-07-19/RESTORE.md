# Milestone pre-BENTO v1.5.0 (2026-07-19)

Kamien milowy **przed** refaktorem layoutu BENTO. Stan repo w tym momencie.

## Co zawiera ten release

- **Branding:** nawigacja skojarzeniowa (discovery panel), bez drzewa folderow dysku
- **Branding:** pasek „Wroc do przegladania” + chipy aktywnych filtrow
- **Branding:** miniatury wideo (video element + play badge), preferencja PNG/JPG w grupach
- **Search:** skojarzenia produktow, indeks autorow, enrich-search-tags
- **Modal podgladu:** poprawki badge/title, assoc-edit
- **Program-instructions:** `branding.navigation_associations`
- **Wersja aplikacji:** 1.5.0 (`dam-version.js` + `version.json`)

## Git tag

```
milestone/pre-bento-v1.5.0
```

## Jak wrocic do tego stanu

### Opcja A — tag (z gita, po clone/fetch)

```powershell
git fetch origin
git checkout milestone/pre-bento-v1.5.0
```

Albo na istniejacym branchu:

```powershell
git reset --hard milestone/pre-bento-v1.5.0
```

### Opcja B — bundle (offline, ten folder)

```powershell
git clone dam-pre-bento-v1.5.0.bundle dam-restore-pre-bento
cd dam-restore-pre-bento
git checkout milestone/pre-bento-v1.5.0
```

Bundle: `dam-pre-bento-v1.5.0.bundle` (tworzony przy commicie milestone).

## Commit

Szukaj commita z prefiksem `milestone(pre-bento):` lub tagu powyzej.

---
Utworzono: 2026-07-19 | DAM v1.5.0 | przed BENTO
