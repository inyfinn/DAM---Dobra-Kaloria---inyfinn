# PAMIEC-PODRECZNA — dyskowy cache miniatur DAM

**Root:** ten folder w repo na dysku **D:** (override: env `DAM_CACHE_ROOT`).

## Zasady (HARD)

- Cache zapisuje **tylko** tutaj — nigdy na `X:\Marketing` ani `M:\`.
- Binaria (`.avif`, `.jpg`) są **poza gitem** (patrz `.gitignore`).
- Klucz miniatury: `sha256(marketing_relative + mtime + profile)` → `thumbs/{hash}.avif` (JPEG fallback).
- **Dysk = źródło prawdy** dla thumb-cache. Redis trzyma tylko metadata (`thumb:{hash}`) i przyspiesza lookup gdy circuit CLOSED.

## Redis (opcjonalny)

Docker Desktop **nie jest wymagany**. Gdy Redis down / circuit OPEN: most czyta/pisze pliki tutaj bez crasha UI.

Zobacz: `apps/desktop/dam_redis.py` (circuit breaker + fallback matrix), `apps/desktop/dam_thumb_cache.py`.

## Endpointy mostu

- `GET /thumb-cache?path=...&profile=grid|card|modal`
- `POST /thumb-cache/warm` `{"paths":[...],"async":true}`
