# PROGRESS.md - DAM ETA

Ostatnia aktualizacja: **2026-07-18**

| Obszar | Status | Notatka |
|--------|--------|---------|
| Geex UI + desktop launch | done | skrot DAM ETA |
| Auth lokalny (bcrypt) | done | SQLite `users` |
| **Sesja = machine_id + device_id + session_id** | **done** | ADR-008; weryfikacja przed startem |
| SQLite lokalna (repo) | done | `apps/desktop/data/dam-local.sqlite` - ADR-007 amended |
| Global search + tagi | done | Smak/Typ/Opakowanie/Autor |
| Taxonomia Typ vs Smak | done | muffin = Smak; kulki/BAT = Typ |
| Modal wiz + FRONT-S + zoom | done | chip zawsze; repair-viz-thumbs |
| Nosniki PS + admin rename | done | POST /rename-index |
| Audit log | done | `audit_log` w SQLite |
| Deployment docs + release ZIP | done | `docs/DEPLOYMENT.md`, `build-release-zip.ps1` |
| Postgres / Docker | cancelled (user) | opcjonalnie Laravel |
| Entra ID pelne | pending | ADR-006 |
| Wspolna baza na NAS (multi-PC) | planned | SQLite WAL na udziale - osobna decyzja |

## Uruchomienie dla usera

1. Skrot **DAM ETA** na pulpicie.
2. Launcher sprawdza ID maszyny (ADR-008).
3. Baza = `apps/desktop/data/dam-local.sqlite` (nie Marketing).
4. ROOT plikow: Ustawienia → folder Marketing.

Nie: Docker, Postgres, MySQL, reczne porty.
