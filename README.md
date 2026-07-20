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
- **Branding DAM Hub:** modul marketingu (perspektywy WIZKI, kampanie, slidery WWW, archiwum starej struktury), karta katalogowa produktu, pakowanie zbiorcze (`2F·2×12`), rejestr wykrojnikow

Szczegoly modulu branding: [`docs/BRANDING-HUB.md`](docs/BRANDING-HUB.md).

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

### Postgres (wspolna, multi-PC) - ADR-009

- **Zywa baza:** PostgreSQL 16 na Synology, port **5433**, DB/user `dam_eta`
- **Host priorytet:** DDNS `inyfinn.synology.me:5433`, LAN `192.168.0.145` tylko awaryjnie
- **Klient:** `apps/desktop/pg_db.py` + schemat `apps/desktop/pg_schema.sql`
- **Konfig per PC (gitignored):** `apps/desktop/data/pg-config.json` albo `dam-connection.env`  
  Szablony: `pg-config.example.json`, `dam-connection.env.example`
- **Tier 1 (online):** `users`, `device_sessions`, `audit_log` - gdy PG niedostepny = tryb OFFLINE (SQLite + hint)
- **Tier 2:** `dam_kv_store` (JSONB) = prawda dla aliasow / propozycji tagow / slownika; lokalny JSON = cache (sync ~5 min)
- **Dumpy w Git:** folder [`DATABASE/`](DATABASE/README.md) (`dam_eta_YYYY-MM-DD.sql.gz`, max 72 dni)  
  Sync: `python apps/desktop/scripts/sync-database-backups-to-git.py` (SSH host `syno`)
- **Migracja:** `python apps/desktop/scripts/migrate_to_postgres.py` (domyslnie dry-run, `--apply` po akceptacji)

### SQLite (offline / awaryjnie)

- `apps/desktop/data/dam-local.sqlite` (WAL, **gitignored**) - mirror + praca offline
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
| `program-instructions.json` | newralgiczne reguly biznesowe (lustro KV) |
| `lang-overrides.json` | reczne jezyki wariantu (nigdy nie kasowane rebuildem) |
| `naming-dictionary.json` | nosniki / jezyki / kategorie PL (jedno zrodlo dla Python + JS) |
| `product-aliases.json` | ten sam produkt DK<->GC (indeks lub reczne dopiecie) |
| `product-name-pl.json` | PL pod angielska nazwa GC |
| `product-people.json` | osoby przy produktach (szukajka, nie badge TAG) |
| `lifecycle-status.json` / `change-log.json` | status F/X/D + historia operacji |
| `carrier-types.json` / `carrier-assignment-log.json` | wlasne typy nosnikow + historia przypisan |
| `tag-proposals.json` | kolejka moderacji (72h auto-apply) |
| `notification-groups.json` | odbiorcy zgloszen (grupa `grafik`) |
| `inbox-items.json` | skrzynka odbiorcza (`inbox.html`) |
| `elements-overrides.json` | override checklisty elementow |
| `materialy-to-projekt-dryrun.json` | raport naprawy migracji (patrz nizej) - **tylko dry-run** |
| `branding-index.json` / `branding-search-index.json` | assety marketingowe (rebuild: `build-branding-index.py`) |
| `campaigns.json` | kampanie z folderow Marketing (generowane z build branding) |
| `product-catalog.json` | karta katalogowa na `project.html` |
| `bulk-packaging.json` | tagi pakowania zbiorczego per SKU |
| `wykrojniki-registry.json` | rejestr wykrojnikow (import XLSX) |

### Indeks branding (Marketing, read-only)

```powershell
python apps/web/scripts/build-branding-index.py
# opcjonalnie: --marketing "X:/Marketing"
```

Bridge (dev): `POST http://127.0.0.1:8766/branding/rebuild`  
Dokumentacja: [`docs/BRANDING-HUB.md`](docs/BRANDING-HUB.md).

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
  desktop/      # launch.py, local_bridge.py, pg_db.py, SQLite offline, machine_identity.py
  api/          # Laravel API (opcjonalnie)
DATABASE/       # dumpy Postgres (sql.gz) - ADR-009, prywatne repo
THEME/          # Motyw Geex
design-system/  # MASTER.md, logo
docs/           # VISION, ARCHITECTURE, ADR, DEPLOYMENT, LANG_PROVENANCE, PROGRAM_INSTRUCTIONS
scripts/ops/    # skrot, release ZIP, smoke
agents/         # Architect / Builder / QA + shared (lang-provenance)
memory.md       # zasady dlugoterminowe (notatka; przy konflikcie wygrywa program-instructions)
process.md      # log operacyjny
PROGRESS.md     # postep
```

---

## Agenci (Architect / Builder / QA)

Pelna mapa: [`agents/README.md`](agents/README.md) oraz [`AGENTS.md`](AGENTS.md).

| Rola | Folder | Kiedy |
|------|--------|--------|
| Architect | `agents/01-architect/` | ADR, DOMAIN, ROADMAP, PROGRESS |
| Builder | `agents/02-builder/` | kod `apps/*`, indeks, bridge, UI Geex |
| QA | `agents/03-qa/` | GATE, smoke, screenshot UI |

Wspolne reguly jezykow: [`agents/shared/lang-provenance.md`](agents/shared/lang-provenance.md).

**Prawda biznesowa** zyje w `program-instructions` (KV + [`apps/web/data/program-instructions.json`](apps/web/data/program-instructions.json)), nie tylko w `memory.md`. Patrz [`docs/PROGRAM_INSTRUCTIONS.md`](docs/PROGRAM_INSTRUCTIONS.md).

---

## Jezyki / rynki (pochodzenie sygnalu)

Szczegoly: [`docs/LANG_PROVENANCE.md`](docs/LANG_PROVENANCE.md).

- **DK:** zawsze **PL**. Dodatkowe (np. GB w PL/GB) tylko z nazw folderow/plikow albo ręcznego `lang-overrides.json`.
- **GC:** bez automatycznego GB. Kazdy kod z tokenu w nazwie albo override; brak sygnalu = `?` w UI.
- Rebuild indeksu: `python apps/web/scripts/build-file-index.py` (nie nadpisuje override).

---

## Changelog (2026-07-20)

- **Usability chrome (Viz / Branding / Pomoc / Sidebar):** admin-only `#damChangeLogBar` w `.dam-search-scope` (prawo), hint Cofnij/Ponow, `#vizStatus` spacing, pill licznikow (+8/+12 pad); Branding suwak+input limitu kart z apply po OK; `#damHelpModal` restart samouczka pod X + padding panelu; sidebar morph anti-jank + footer meta
- **Device paths:** Marketing root per `device_id` (KV + bridge), nie globalnie per konto
- **Samouczek:** DobroKalorius, C4 dymek/anchor, 40 pochwal, `dam-tutorial.js` / `dam-tutorial.css`
- **Integracje / FMCG / Danger / Shell FOUC / Assocs:** hub Bento, Edytuj FMCG, H-danger UX, skojarzenia + product_element; szczegoly w `process.md` i `agents/shared/usability-brief-2026-07-20.md`
- **Doktryna:** `agents/shared/code-doctrine.md` (+ skill `dam-dobrakaloria`)

## Changelog (2026-07-19)

- **Branding DAM Hub:** `branding.html` (filtry, kampanie, Key visuale, layout builder), `dam-branding.js`, `dam-hub-shared.css`
- **Indeks marketing:** `build-branding-index.py` + `campaigns.json`, bridge `/branding-index`, `/branding/rebuild`
- **Katalog produktu:** karta na `project.html`, bridge `/product-catalog`, `fetch-product-prices.py`
- **Pakowanie zbiorcze:** `bulk-packaging.json`, badge tier low, toggle „Odsłon wszystko” (explorer, viz, projekty)
- **Wykrojniki:** rejestr XLSX, koszty w `build-project-costs.py`, kolejka mapowan (API)
- **Dashboard:** widget `branding_latest`; **Pomoc:** slownik branding w `help.html`
- Dokumentacja: [`docs/BRANDING-HUB.md`](docs/BRANDING-HUB.md)
- **QA:** `scripts/ops/smoke-branding-hub.ps1`, bridge `api_version` w `/health`

## Changelog (2026-07-18)

- **Jezyki (lang provenance):** DK=PL zawsze; extra / GC tylko z dowodu w nazwach lub override; dokumentacja w `docs/LANG_PROVENANCE.md` + `agents/shared/`
- **Agenci:** `agents/README.md`, reguly wpięte w AGENT.md rol
- **program-instructions:** krytyczne reguly w KV/cache (m.in. `data.lang_provenance_only`)
- **Postgres Synology (ADR-009):** wspolna baza multi-PC, DDNS first, OFFLINE=SQLite, dumpy w `DATABASE/`
- **Auth:** `/auth/rehydrate` z bound-session; bez fake sesji z samego `localStorage`; `DAM_DEV_ALWAYS_ADMIN=false`
- **Sidebar:** aktywna pozycja (fiolet Geex + pasek), bez underline linkow nawigacji
- **Dashboard:** modal „Dostosuj pulpit” (DnD, preview, dirty guard, fioletowe checkboxy)
- **Inbox:** ludzki podtytul, osobny `dam-inbox.js`, status bazy `dam-db-status.js`
- **Prawne / docs:** `privacy.html`, `terms.html`, `license.html`, `consents.html`, `docs-security.html`
- **OAuth stub:** `oauth_integrations.py` (Asana / Microsoft Graph) + zmienne w `dam-connection.env.example`

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
| Dashboard | 24 konfigurowalne widgety, „Dostosuj pulpit”, koszt FMCG, powiadomienia |
| Nawigacja | Aktywna pozycja sidebar (Geex purple), bez underline (`dam-shell.js` + `dam-brand.css`) |
| Status bazy | Pill online/offline Postgres (`dam-db-status.js`) |
| Sciezki | Kopiuj + Pokaz w Eksploratorze (`DamPaths`) |
| Tagi produktow | Smak / Typ / Opakowanie / Autor (`dam-tag-bar.js`) |
| Chrome | Header, wiadomosci, profil (`dam-shell.js`) |
| Branding | Siatka marketingu, filtry WIZKI, kampanie, modal wideo/wektor (`branding.html`) |
| Karta katalogowa | EAN, ceny, kategoria sklepu na `project.html` |
| Pakowanie zbiorcze | Badge `2F·2×12`, toggle tier low (`dam-badges.js`, `dam-hub-shared.css`) |
| Wykrojniki | Rejestr + koszty projektu + kolejka mapowan (bridge) |

---

## Dane lokalne (nie w Gicie)

- `apps/desktop/data/*.sqlite*`
- `apps/desktop/data/pg-config.json`, `apps/desktop/dam-connection.env` (haslo PG / OAuth)
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
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Architektura |
| [`docs/LANG_PROVENANCE.md`](docs/LANG_PROVENANCE.md) | Skad biora sie jezyki / rynki |
| [`docs/PROGRAM_INSTRUCTIONS.md`](docs/PROGRAM_INSTRUCTIONS.md) | Reguly w bazie (KV), nie tylko memory |
| [`docs/NAMING.md`](docs/NAMING.md) | Nazewnictwo nosnikow / slotow |
| [`docs/BRANDING-HUB.md`](docs/BRANDING-HUB.md) | Branding, katalog, pakowanie zbiorcze, wykrojniki |
| [`docs/ADR/ADR-007-local-sqlite.md`](docs/ADR/ADR-007-local-sqlite.md) | SQLite lokalny / offline |
| [`docs/ADR/ADR-008-device-session-binding.md`](docs/ADR/ADR-008-device-session-binding.md) | machine/session ID |
| [`docs/ADR/ADR-009-postgres-synology.md`](docs/ADR/ADR-009-postgres-synology.md) | Wspolny Postgres na NAS |
| [`DATABASE/README.md`](DATABASE/README.md) | Dumpy `pg_dump`, retencja 72 dni |
| [`agents/README.md`](agents/README.md) | Mapa agentow Architect / Builder / QA |
| [`AGENTS.md`](AGENTS.md) | Skrot startu sesji agenta |
| [`memory.md`](memory.md) | Zasady trwale (notatka operacyjna) |
| [`process.md`](process.md) | Log i proces |
| [`PROGRESS.md`](PROGRESS.md) | Postep / GATE |

---

## Licencja / wlasnosc

Kod: wewnetrzny projekt ETA Innovations / Dobra Kaloria.  
Motyw Geex: licencja dostawcy w `THEME/`.  
Znaki i logo Dobra Kaloria: wylacznie uzytek wewnetrzny w tym systemie.
