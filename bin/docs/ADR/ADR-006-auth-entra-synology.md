# ADR-006 - Auth Entra ID + Synology / LDAP + role

Status: Accepted  
Date: 2026-07-16

## Context

Kazdy uzytkownik musi logowac sie do panelu. Firma jest w domenie Microsoft (logowanie danymi Microsoft). Chcemy model jak Synology DSM: podpiecie pod katalog firmowy / SSO, konfigurowalne.

## Decision

### Providery (switch w adminie)

| Provider | Uzycie |
|----------|--------|
| `azure_ad` | Domyslny. Microsoft Entra ID OIDC (Azure AD). |
| `ldap` | Synology Directory Server / AD LDAP/LDAPS |
| `oidc_generic` | Federacja OIDC (np. Synology SSO Server) |
| `local` | Sanctum email+haslo (dev / awaryjnie) |

Konfiguracja: Tenant ID, Client ID, Client secret (env), Redirect URI, domain hint. Mapowanie grup Azure/LDAP -> role DAM.

### Role v1 (dokladnie 3)

| Role | Uprawnienia |
|------|-------------|
| `admin` | users, auth, integracje, storage, audit export |
| `power_user` | projekty, warianty, upload, checklist, Asana/Teams ops |
| `user` | read, download, wlasne zadania |

Bez mapowania grupy = `user`.

### UI

Geex `signin.html`: CTA „Zaloguj przez Microsoft” + opcjonalny formularz lokalny.

## Sources

- https://learn.microsoft.com/en-us/entra/identity-platform/
- https://kb.synology.com/ (Directory Server / SSO Server)
- Laravel Sanctum docs

## Consequences

Migracja `users.role` check constraint. Middleware `EnsureRole`. ADR wymagany przed pelnym K51.
