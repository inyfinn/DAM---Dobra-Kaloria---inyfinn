# Handoff: kontynuacja w domu (2026-08-12)

Po `git pull` na maszynie domowej czytaj ten plik + `LOGI.md`.

## Stan Synology (WAŻNE)

**Postgres Synology NIE działał z biura (2026-08-12):**

- Hosty: `inyfinn.synology.me`, `192.168.0.145`
- Port: **5433**
- Objaw: active refuse / timeout — DDNS rozwiązuje IP, ale **port zamknięty** (NAT / brak forwardingu / CGNAT)
- DAM działa wtedy na **SQLite offline** (to zamierzone awaryjne zachowanie od 5.0.139+)

Lokalnie (nie w gicie) powinny być:

- `bin/apps/desktop/data/pg-config.json` (z `.off` / example + hasło)
- `bin/apps/desktop/data/db-prefer.json` z `synology: true`, `mode: auto`

## Co już jest w main (5.0.136–5.0.140)

1. Lekki `/db/ping`, cache `init_db`, `/index/status` bez ciężkiego `status()`
2. Telemetria UI + `dam_debug` + `/debug/self-test`
3. Logowanie: tylko email + hasło (imię tylko przy rejestracji admina)
4. Thumb: **AVIF q30** w `PAMIEC-PODRECZNA`; **zero** legacy `data/thumbs/*.jpg`
5. Progressive: cache → `/media` ze źródła (bez udawanych procesów)
6. Gdy PG padnie: `_enter_offline` + kolejne pingi natychmiast na SQLite; `connect_timeout=2`

## Checklist kontynuacji w domu

- [ ] `git pull`
- [ ] Zainstaluj `DAM-Setup.exe` z release **v5.0.140+**
- [ ] Otwórz TCP **5433** na routerze → NAS Postgres
- [ ] `dam_db.ping()` → `engine=postgres`
- [ ] UI: Baza online (Synology)
- [ ] Warm miniatur + smoke Viz/Branding (karty AVIF, modal `/media`)
- [ ] Opcjonalnie: `bin/apps/desktop/scripts/sync-database-backups-to-git.py` / backup PG

## Komendy smoke

```powershell
curl.exe -s --max-time 8 http://127.0.0.1:8766/health
curl.exe -s --max-time 8 http://127.0.0.1:8766/db/ping
curl.exe -s --max-time 8 http://127.0.0.1:8766/debug/self-test
curl.exe -s --max-time 8 http://127.0.0.1:8766/thumb-cache/status
```

## Build (zawsze po zmianie — user używa tylko DAM.exe)

```powershell
powershell -File bin\scripts\ops\build-installer.ps1 -SkipSync -SkipVendor -SkipExeBuild
```

Potem commit + push + `gh release create` z `DAM-Setup.exe`.
