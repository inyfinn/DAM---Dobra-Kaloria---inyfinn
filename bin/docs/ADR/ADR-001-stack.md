# ADR-001 - Stack v1

Status: Accepted (amended 2026-07-18)  
Date: 2026-07-16

## Decision

UI Geex z THEME + desktop pywebview.  
**Runtime uzytkownika:** SQLite lokalny (ADR-007) - bez Dockera.  
Laravel + PostgreSQL: opcjonalny tryb serwerowy / dev, nie wymagany do odpalenia skrotu DAM ETA.

## Why

- Geex daje gotowy admin shell zamiast Next skina.
- Desktop jak Inyfinn: prawdziwa lokalna app.
- Normalny user nie instaluje Dockera ani MySQL/Postgres (patrz ADR-007).

## Consequences

Zakaz Next.js jako glownego skina v1. Tokeny tylko z Geex variables.  
Baza dzienna = SQLite w `apps/desktop/data`.
