# DAM ETA - Dobra Kaloria

Wewnetrzny **Digital Asset Management** dla opakowan i materialow marketingowych marek **Dobra Kaloria (DK)** oraz **Good Calories (GC)**.

Repozytorium: [inyfinn/DAM---Dobra-Kaloria---inyfinn](https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn)

> Cel produktowy: jedna instalacja (udzial / serwer plikow), skrot na pulpicie, **uruchom i dziala** - bez Dockera i bez recznej konfiguracji portow.  
> Sesja jest zawsze zwiazana z **ID maszyny + kontem Windows** (ADR-008), zeby nikt nie dziedziczyl cudzego logowania.

---

## Co robi system

- Katalog produktow i wariantow opakowan (nosniki: baton, karton 6x, mini, doypack, kulki, …)
- Indeks plikow z dysku Marketing (projekty, wizualizacje, druk, marketing)
- Checklist kompletnosci assetow per rewizja (+ karty wprowadzenia, strategie pozycjonowania)
- Galeria wizualizacji (miniatury FRONT-S, modal + zoom, chip wariantu nawet przy 1 indeksie)
- Tagi wizualizacji: Marka -> Kategoria -> Podkategoria -> Typ -> Warianty -> Jezyk -> Indeks,
  zgadywanie typu nosnika z sasiednich rewizji (z ikonka "?"), aliasy produktow DK<->GC
- Moderacja tagow: kazdy user proponuje, admin/power_user zatwierdza - auto-apply po 72h
- Zgloszenia "Zglos zapotrzebowanie" (Email / Teams / Asana / w aplikacji) + skrzynka `inbox.html`
- Dashboard z konfigurowalnymi widgetami (24 widgety, FMCG landed cost, powiadomienia nowej wizualizacji)
- Mapowanie sciezki bazowej Marketing per uzytkownik Windows
- Lokalny bridge (Eksplorator Windows, media, audit, override nosnikow / miniatur, propozycje tagow)
- Konta lokalne (bcrypt) + sesja urzadzenia (`machine_id` / `device_id` / `session_id`)
- UI na motywie **Geex** (Bootstrap 5) z tokenami DAM

---

## Wymagania (uzytkownik koncowy)

- Windows 10/11
- Microsoft Edge **WebView2** Runtime (zwykle juz jest w systemie)
- Dostep do dysku Marketing (mapowany jako `X:` / `D:` / inny)
- Python 3.10+ **tylko na maszynie, gdzie IT zainstaluje skrot** (user nie instaluje nic recznie)

---

## Szybki start

### Dla uzytkownika

**Dwuklik skrotu „DAM ETA” na pulpicie** - otwiera sie okno aplikacji.

Przy starcie launcher:

1. Liczy `machine_id` (MachineGuid + host + user Windows + serial dysku).
2. Sprawdza `bound-session.json` - sesja z innego PC = wyczyszczona + komunikat.
3. Startuje most lokalny + UI w WebView2.

### Pierwsza instalacja skrotu (IT / raz na PC)

```powershell
cd <sciezka-do-DAM>
pip install -r apps/desktop/requirements.txt
powershell -ExecutionPolicy Bypass -File scripts/ops/install-desktop-shortcut.ps1
```

Alternatywnie:

```powershell
powershell -File scripts/ops/start-desktop.ps1
```

### Tryb developerski

```powershell
python apps/desktop/serve_browser.py
# albo: python -m http.server 8765 --bind 127.0.0.1 --directory apps/web
# + python apps/desktop/local_bridge.py
```

### Pierwsze uruchomienie po instalacji

1. Zaloguj sie (konta lokalne / seed Kubara).
2. Ustaw **sciezke bazowa** Marketing (folder z `-- ARCHIWUM --`, `- EKSPORT`, `- POLSKA`).
3. Indeks: `apps/web/data/file-index.json` (rebuild: `python apps/web/scripts/build-file-index.py`).

---

## Tozsamosc maszyny i sesja (wazne)

| Identyfikator | Skad | Po co |
|---------------|------|--------|
| `machine_id` | OS (MachineGuid, host, Windows user, volume) | unikalny PC+konto |
| `device_id` | z `machine_id` | klucz sesji w SQLite |
| `session_id` | losowy przy loginie | audyt / rozroznienie logowan |
| `token` | losowy, hash w DB | Bearer do `/auth/me` |

Szczegoly: [`docs/ADR/ADR-008-device-session-binding.md`](docs/ADR/ADR-008-device-session-binding.md).

Endpointy mostu:

- `GET /auth/identity` - biezace ID maszyny
- `POST /auth/login` - email, haslo, machine_id
- `GET /auth/me?device_id=&machine_id=` - walidacja sesji

---

## Baza danych

- **Kanon:** `apps/desktop/data/dam-local.sqlite` (WAL, gitignored)
- Tabele: `users`, `device_sessions`, `audit_log`
- **Zakaz** zapisu metadata aplikacji na Marketing (bez `.dam-eta` na `X:\`) - ADR-007
- Indeks produktow = JSON w `apps/web/data/` (nie SQL)

Seed kont testowych:

```powershell
python apps/desktop/seed_kubara_users.py
```

### Dane w repo (`apps/web/data/`, wersjonowane, nie sekrety)

| Plik | Rola |
|------|------|
| `file-index.json` / `search-index.json` | indeks produktow (rebuild: `build-file-index.py`) |
| `naming-dictionary.json` | nosniki / jezyki / kategorie PL (jedno zrodlo dla Python + JS) |
| `product-aliases.json` | ten sam produkt DK<->GC (indeks lub reczne dopiecie) |
| `carrier-types.json` / `carrier-assignment-log.json` | wlasne typy nosnikow + historia przypisan |
| `tag-proposals.json` | kolejka moderacji (72h auto-apply) |
| `notification-groups.json` | odbiorcy zgloszen (grupa `grafik`) |
| `inbox-items.json` | skrzynka odbiorcza (`inbox.html`) |
| `materialy-to-projekt-dryrun.json` | raport naprawy migracji (patrz nizej) - **tylko dry-run** |

### Naprawa migracji MATERIALY -> PROJEKT (ostrozne, dry-run domyslnie)

```powershell
python apps/web/scripts/repair-materialy-to-projekt.py            # raport, ZERO zmian na dysku
python apps/web/scripts/repair-materialy-to-projekt.py --apply    # po przegladzie raportu
```

Zasada: jesli `2 - PROJEKT` ma juz pliki - nietykane. Jesli pusty, szuka `.ai/.psd/.indd/.pdf`
wylacznie w `1 - MATERIALY` tego samego wariantu (w tym jeden poziom podfolderow). Nigdy nie kasuje.

---

## Struktura repo

```
apps/
  web/          # UI Geex + JS DAM
  desktop/      # launch.py, local_bridge.py, SQLite, machine_identity.py
  api/          # Laravel API (opcjonalnie)
THEME/          # Motyw Geex
design-system/  # MASTER.md, logo
docs/           # VISION, ARCHITECTURE, ADR, DEPLOYMENT
scripts/ops/    # skrot, release ZIP, smoke
agents/         # Architect / Builder / QA
memory.md       # zasady dlugoterminowe
process.md      # log operacyjny
PROGRESS.md     # postep
```

---

## Release (ZIP)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/build-release-zip.ps1
```

Artefakt: `dist/DAM-ETA-<wersja>.zip` (bez `.git`, thumbs, sqlite, `.env`).

Wdrozenie na udzial: rozpakuj ZIP, zainstaluj skrot na PC userow - patrz [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

GitHub Release: tag + upload ZIP (tworzone przy publikacji).

---

## Funkcje kluczowe (web)

| Modul | Opis |
|-------|------|
| Eksplorator | Kategorie, produkty, nosniki, checklist, sciezki |
| Wizualizacje | Siatka, modal +50%, zoom, chip indeksu, FRONT-S thumbs, "Pokaz wszystko" z placeholderami |
| Tagi wizualizacji | Kolejnosc Marka/Kategoria/Podkategoria/Typ/Warianty/Jezyk/Indeks (`dam-badges.js`) |
| Edycja typu + moderacja | Popover propozycji (`dam-tag-edit.js`), panel w `settings.html`, 72h auto-apply |
| Aliasy produktow | DK<->GC ten sam produkt (`product-aliases.json`), pasek wariantow w modalu |
| Zgloszenia wizualizacji | Modal wielokanalowy (`dam-viz-request.js`), skrzynka `inbox.html` |
| Dashboard | 24 konfigurowalne widgety, koszt FMCG, powiadomienia (`dam-dashboard-widgets.js`) |
| Sciezki | Kopiuj + Pokaz w Eksploratorze (`DamPaths`) |
| Tagi produktow | Smak / Typ / Opakowanie / Autor (`dam-tag-bar.js`) |
| Chrome | Header, wiadomosci, profil (`dam-shell.js`) |

---

## Dane lokalne (nie w Gicie)

- `apps/desktop/data/*.sqlite*`
- `apps/desktop/machine-config.json`
- `apps/desktop/data/bound-session.json`
- `apps/web/data/thumbs/`, `dam-runtime.json`, `dam-identity.json`
- `tooling/bin/`, `data/postgres/`, `.env`

---

## Bezpieczenstwo

- Nie commituj tokenow, hasel, `.env`, sciezek z danymi osobowymi.
- Sesja zwiazana z maszyna - skopiowany token na inny PC jest odrzucany.
- Audit: tabela `audit_log` + opcjonalnie `audit-log.jsonl`.

---

## Dokumentacja

| Plik | Rola |
|------|------|
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Wdrozenie bez instalacji |
| [`docs/ADR/ADR-007-local-sqlite.md`](docs/ADR/ADR-007-local-sqlite.md) | SQLite w repo |
| [`docs/ADR/ADR-008-device-session-binding.md`](docs/ADR/ADR-008-device-session-binding.md) | machine/session ID |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Architektura |
| `memory.md` / `process.md` / `PROGRESS.md` | Operacje agentow |

---

## Licencja / wlasnosc

Kod: wewnetrzny projekt ETA Innovations / Dobra Kaloria.  
Motyw Geex: licencja dostawcy w `THEME/`.  
Znaki i logo Dobra Kaloria: wylacznie uzytek wewnetrzny w tym systemie.
