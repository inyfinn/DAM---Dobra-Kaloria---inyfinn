# DAM ETA - Dobra Kaloria

Wewnetrzny **Digital Asset Management** dla opakowan i materialow marketingowych marek **Dobra Kaloria (DK)** oraz **Good Calories (GC)**.

Repozytorium: [inyfinn/DAM---Dobra-Kaloria---inyfinn](https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn)

> Workspace lokalny (Windows): dysk roboczy aplikacji. Dyski marketingowe (`D:` / `M:`) to zrodlo assetow - **nie** commitujemy ich zawartosci do Gita.

---

## Co robi system

- Katalog produktow i wariantow opakowan (nosniki: baton, karton 6x, mini, doypack, …)
- Indeks plikow z dysku Marketing (projekty, wizualizacje, druk, marketing)
- Checklist kompletnosci assetow per rewizja
- Podglad wizualizacji (miniatury, lightbox, widok kafelki / lista / skala)
- Mapowanie sciezki bazowej per uzytkownik (ten sam indeks `D:/Marketing/...`, lokalny remap np. na `M:\`)
- Lokalny bridge (Reveal w Eksploratorze Windows, media, audit, override nosnikow)
- UI na motywie **Geex** (Bootstrap 5) z tokenami DAM

---

## Wymagania

- Windows 10/11
- Python 3.10+ (launcher + local bridge)
- Przegladarka Chromium / Edge (UI serwowane lokalnie)
- Opcjonalnie: Postgres + PHP/Laravel (`apps/api`) - warstwa API w rozbudowie

---

## Szybki start

```powershell
# Z katalogu repozytorium
python apps/desktop/launch.py
```

Albo osobno:

```powershell
# Static UI :8765
python -m http.server 8765 --directory apps/web

# Local bridge :8766 (reveal, media, audit, overrides)
python apps/desktop/local_bridge.py
```

Skrypty pomocnicze:

```powershell
powershell -File scripts/ops/start-browser.ps1
powershell -File scripts/ops/start-desktop.ps1
```

Otworz: `http://127.0.0.1:8765/` (dashboard / explorer / visualizations).

### Pierwsze uruchomienie

1. Ustaw **sciezke bazowa** dysku Marketing (folder z `-- ARCHIWUM --`, `- EKSPORT`, `- POLSKA`).
2. Bridge musi dzialac na porcie **8766**, zeby dzialaly: Pokaz w eksploratorze, miniatury `/media`, audit.
3. Indeks plikow: `apps/web/data/file-index.json` (generowany skryptami sync/index - nie trzymamy tu blobow oryginalow).

---

## Struktura repo

```
apps/
  web/          # UI Geex + JS DAM (explorer, viz, shell, paths)
  desktop/      # launch.py + local_bridge.py
  api/          # Laravel API (opcjonalnie / w budowie)
THEME/          # Motyw Geex (zrodlo estetyki)
design-system/  # Tokeny i komponenty (MASTER.md, logo.md, …)
docs/           # Architektura, ADR, roadmap
scripts/        # Ops / sync / indeks
agents/         # Role agentow (Architect / Builder / QA)
memory.md       # Zasady dlugoterminowe
process.md      # Log operacyjny
PROGRESS.md     # Postep prac
```

---

## UI i branding

- Motyw: **Geex** (`THEME/geex-html-main`), tokeny: `apps/web/assets/css/dam-tokens.css`
- Logo sidebara/headera: **Dobra Kaloria zielone** (`#008244`) - szczegoly w `design-system/components/logo.md`
- **Nie** uzywamy wariantu logo „Niemiesa”
- Light/Dark: logo musi byc czytelne (zakaz bialego wordmarku na jasnym tle)

---

## Funkcje kluczowe (web)

| Modul | Opis |
|-------|------|
| Eksplorator | Kategorie, produkty, nosniki, checklist, sciezki |
| Wizualizacje | Siatka produktow, share Synology (UI), filtry |
| Sciezki | Kopiuj + Pokaz w Eksploratorze (`DamPaths`) |
| Override nosnika | „Nie widzisz wariantu? Dodaj go” -> JSON + bridge |
| Chrome | Header: szukaj, wiadomosci, powiadomienia, profil (`dam-shell.js`) |

---

## Dane lokalne (nie w Gicie / duze)

Do `.gitignore` naleza m.in.:

- `tooling/bin/` (Postgres, PHP, cache - gigabajty)
- `data/postgres/` (klaster DB)
- `apps/web/data/thumbs/` (wygenerowane miniatury)
- `.env`, sekrety, `node_modules`, `vendor`

Indeksy JSON (`file-index.json`, `product-status.json`, …) moga byc w repo jako snapshot roboczy; oryginalne pliki graficzne zostaja na dysku Marketing.

---

## Bezpieczenstwo

- **Nie** commituj tokenow GitHub, hasel, `.env`, sciezek z danymi osobowymi klientow.
- Tokeny trzymaj w menedzerze hasel / `gh auth` / zmiennych srodowiskowych lokalnie.
- Audit operacji (copy/reveal) trafia do `apps/web/data/audit-log.jsonl` (lokalnie) - nie publikuj logow z danymi uzytkownikow bez potrzeby.

---

## Dokumentacja wewnetrzna

| Plik | Rola |
|------|------|
| `memory.md` | Zasady, zakazy, edge-case'y |
| `process.md` | Log i przebieg operacji |
| `design-system/MASTER.md` | Design system |
| `docs/` | VISION / ARCHITECTURE / ADR |

---

## Licencja / wlasnosc

Kod i konfiguracja: wewnetrzny projekt ETA Innovations / Dobra Kaloria.  
Motyw Geex: zgodnie z licencja dostawcy motywu w `THEME/`.  
Znaki towarowe i logo Dobra Kaloria: wlasnosc marki - uzycie wylacznie w tym systemie wewnetrznym.
