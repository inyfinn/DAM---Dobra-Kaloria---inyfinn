# ARCHITECTURE - DAM ETA

## Komponenty

| Warstwa | Lokalizacja | Technologia |
|---------|-------------|-------------|
| API | `apps/api` | Laravel 11 + Sanctum + PostgreSQL |
| UI | `apps/web` | Geex HTML/Bootstrap 5 (THEME) |
| Desktop | `apps/desktop` | Python pywebview + lokalny serwer |
| Dane | `data/postgres`, `storage/` | PG cluster na P, vault assetow |
| Tooling | `tooling/` | PHP, Composer, pgsql binaries |

## Auth

```
Browser/Desktop UI
    -> OIDC (Entra ID) lub LDAP/OIDC Synology lub local Sanctum
    -> API middleware EnsureRole(admin|power_user|user)
```

Konfiguracja providerow: `azure_ad` | `ldap` | `oidc_generic` | `local` (ADR-006).

## Completeness

Event (upload / set current_revision / checklist change)
  -> `RecomputeChecklistStatus`
  -> zapis wiersza `checklist_status`
  -> GET completeness czyta tylko te tabele (bez hot-path JOIN).

## Wersjonowanie

- Os A: `variants` (carrier, data, product index.revision)
- Os B: `assets` + `asset_revisions` + `current_revision_id`

## Integracje

Jobs: `SyncAsanaChecklistJob`, `NotifyTeamsMissingAssetsJob` (ADR-005).
