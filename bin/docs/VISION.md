# VISION - DAM ETA

Digital Asset Management dla opakowan spozywczych ETA (DK/GC).

## Problem

Assety leza w drzewach POLSKA (M:/D:), bez jednego panelu kompletnosci, bez wspolnego logowania domenowego i bez powiazan z Asana / Teams.

## Cel v1

- Panel lokalny (desktop jak Inyfinn Resizer) + ten sam UI w przegladarce (mobile-first).
- Motyw wylacznie Geex z `P:\DAM\THEME`.
- Indeks istniejacych sciezek (pointery) + nowe uploady w `P:\DAM\storage`.
- Checklista materializowana (`checklist_status`).
- Logowanie: Microsoft Entra ID (Azure AD) domyslnie; Synology/LDAP/OIDC konfigurowalne; role `admin` | `power_user` | `user`.
- Integracje: Asana + Microsoft Teams (stub, potem OAuth).

## Poza scope v1

Bynder/Pimcore, Meilisearch (ADR-004 later), pelny OCR, publiczny SaaS multi-tenant.
