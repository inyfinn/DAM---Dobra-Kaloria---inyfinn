# DAM ETA - wdrozenie (bez instalacji dla usera)

## Cel

Program stoi w jednym miejscu (np. udzial sieciowy / serwer plikow).  
Uzytkownik marketingu: **dwuklik skrotu -> okno dziala**. Bez Dockera, bez Postgresa, bez recznych portow.

## Architektura runtime

| Warstwa | Gdzie | Uwagi |
|---------|--------|--------|
| Kod + UI | folder instalacji (repo / release ZIP) | `apps/web`, `apps/desktop` |
| SQLite (konta, sesje, audit) | `apps/desktop/data/dam-local.sqlite` | gitignored; lokalnie lub na udziale (WAL) |
| Indeks plikow | `apps/web/data/file-index.json` | snapshot; rebuild skryptem |
| Miniatury | `apps/web/data/thumbs/` | regenerowane |
| Assety | dysk Marketing (`X:` / `D:` / …) | tylko skan/odczyt |
| Tozsamosc PC | MachineGuid + host + Windows user | ADR-008 |

## Instalacja (admin / IT - raz)

1. Rozpakuj release ZIP albo sklonuj repo na udzial / lokalny dysk.
2. Na maszynie z Python 3.10+:

```powershell
cd <sciezka-do-DAM>
pip install -r apps/desktop/requirements.txt
powershell -ExecutionPolicy Bypass -File scripts/ops/install-desktop-shortcut.ps1
```

3. (Opcjonalnie) seed kont:

```powershell
python apps/desktop/seed_kubara_users.py
```

4. Uzytkownik ustawia folder Marketing w Ustawieniach (musi zawierac `-- ARCHIWUM --`, `- EKSPORT`, `- POLSKA`).

## Codzienne uzycie

1. Skrot **DAM ETA** na pulpicie.
2. Launcher weryfikuje `machine_id` (ADR-008).
3. Startuje most `:8766` + UI w WebView2 + watcher indeksu.
4. Logowanie: email + haslo lokalne (docelowo Entra ID).

## Git i sekrety (repo)

- Nigdy nie commituj: `.env`, `pg-config.json`, kluczy SSH (`id_rsa*`, `id_ed25519*`, `*.pem`), `.git-credentials`, `machine-config.json` z tokenami.
- Skan lokalny: `gitleaks detect --source . --verbose` (konfiguracja: `.gitleaks.toml` w GIT_ROOT).
- Klucz deploy na NAS pozostaje tylko na Synology (`dam-git.sh` wskazuje sciezke — nie zawartosc klucza).

## Bezpieczenstwo sesji

- `machine_id` / `device_id` / `session_id` - patrz ADR-008.
- Token w localStorage WebView jest niewazny na innym PC.
- Plik `bound-session.json` jest kasowany przy mismatch przed startem UI.

## Release ZIP

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/build-release-zip.ps1
```

Wynik: `dist/DAM-ETA-<version>.zip` (bez `.git`, thumbs, sqlite, `.env`).

## Docelowy serwer (roadmap)

- Wspolny SQLite na udziale z WAL (albo sync) - osobna decyzja.
- Entra ID / Synology LDAP (ADR-006).
- Jedna instalacja na NAS + skrot per PC wskazujacy ten sam folder.
