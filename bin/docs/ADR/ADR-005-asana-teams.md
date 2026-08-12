# ADR-005 - Asana + Microsoft Teams

Status: Accepted  
Date: 2026-07-16

## Decision

v1: stub jobs + config w `.env`. Pełne OAuth gdy credentials dostarczy admin.

- Asana: task przy niekompletnej checkliscie; link variant <-> task
- Teams: Incoming Webhook / Graph notification o brakach

## v2 (2026-07-19) — bridge-backed hub

Integracje nie są już stub UI. Konfiguracja i sync idą przez `local_bridge` (`:8766`):

- `GET/POST /integrations/config` — zapis `DAM_*` w `dam-connection.env` (secret maskowany)
- `POST /integrations/asana/sync` — pobranie tasków + rebuild `project-costs.json`
- Panel admin na `integrations.html` (Asana, Microsoft, Entra, stawki, katalog FMCG)
- Kalkulator / Faktury: `GET /finance/*` z fallbackiem na JSON w `apps/web/data/`

## Security

Sekrety tylko `dam-connection.env` / API `.env` (gitignored). Brak sekretow w repo.
