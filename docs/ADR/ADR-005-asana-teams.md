# ADR-005 - Asana + Microsoft Teams

Status: Accepted  
Date: 2026-07-16

## Decision

v1: stub jobs + config w `.env`. Pełne OAuth gdy credentials dostarczy admin.

- Asana: task przy niekompletnej checkliscie; link variant <-> task
- Teams: Incoming Webhook / Graph notification o brakach

## Security

Sekrety tylko `P:\DAM\apps\api\.env` (gitignored). Brak sekretow w repo.
