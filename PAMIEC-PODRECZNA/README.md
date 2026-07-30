# PAMIEC-PODRECZNA — dyskowy cache miniatur DAM

**Root:** ten folder w repo na dysku **D:** (override: env `DAM_CACHE_ROOT`).

## Zasady (HARD)

- Cache zapisuje **tylko** tutaj — nigdy na `X:\Marketing` ani `M:\`.
- Binaria (`.avif`, `.jpg`) są **poza gitem** (patrz `.gitignore`).
- Klucz miniatury: `sha256(marketing_relative + mtime + profile)` → `thumbs/{hash}.avif` (JPEG fallback).
- **Dysk = źródło prawdy** dla thumb-cache. Redis trzyma tylko metadata (`thumb:{hash}`) i przyspiesza lookup gdy circuit CLOSED.

## Redis (opcjonalny)

**Redis bez Dockera: tak** — prefer native Windows Redis / Memurai na `127.0.0.1:6379`
(patrz `apps/desktop/README-redis.md`). Docker Compose = opcjonalny fallback.
Gdy Redis down / circuit OPEN: most czyta/pisze pliki tutaj bez crasha UI.

Zobacz: `apps/desktop/dam_redis.py` (circuit breaker + fallback matrix), `apps/desktop/dam_thumb_cache.py`.

## Endpointy mostu

- `GET /thumb-cache?path=...&profile=grid|card|modal` — encode z dysku Marketing (gdy plik lokalny)
- `GET /thumb-cache?path=...&profile=...&cache_only=1` — tylko PAMIEC (bez odczytu dysku)
- `POST /thumb-cache/warm` `{"paths":[...],"async":true}`

## Budowa cache (dev / deploy)

```powershell
python apps/desktop/scripts/dam_build_thumb_cache.py --warm --migrate-legacy --export-guest
```

- **PAMIEC-PODRECZNA/thumbs/** — kanoniczny cache AVIF/JPEG (`sha256` klucz)
- **apps/web/data/thumbs/** — kopia digestów dla Panel-DAM (statyczny HTTP)
- **apps/web/data/guest-cache-manifest.json** — mapa `path` → URL profilu (grid/card)
