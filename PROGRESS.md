# PROGRESS.md - DAM ETA

| Krok | Status | Notatka |
|------|--------|---------|
| K00-K20 foundation+docs | done | |
| THEME Geex UI | done | index/project/signin wired to API |
| Desktop shell | done stub | launch.py + start-*.ps1 |
| Auth Entra/roles | done | login local + Azure stub + EnsureRole |
| Asana/Teams | done stub | jobs + notify endpoint |
| Postgres + Laravel | done | :5433 dam_eta, migrate, seed |
| Ingest pointerow | done | `dam:ingest-pointers` + fixture polska-demo + API POST |
| UI <-> API E2E | done | login → 3 karty z checklist_status → project detail |
| K41+ M:/D: roots | pending | ustaw `DAM_INGEST_ROOTS` gdy sciezki POLSKA dostepne |
| OIDC credentials | pending | AZURE_AD_* od admina |

## Jak uruchomic

1. Postgres: juz na `P:\DAM\data\postgres` port **5433**
2. API: `P:\DAM\tooling\bin\php.bat artisan serve --host=127.0.0.1 --port=8000` (cwd `apps\api`)
3. UI: `P:\DAM\scripts\ops\start-browser.ps1` → http://127.0.0.1:8765
4. Login: `admin@dam.local` / `DamAdmin123!`
5. Ingest: przycisk w UI albo `php artisan dam:ingest-pointers`

Ostatnia aktualizacja: 2026-07-16 (E2E UI+API+ingest wdrozony)
