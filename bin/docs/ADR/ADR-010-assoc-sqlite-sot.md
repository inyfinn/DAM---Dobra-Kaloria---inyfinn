# ADR-010 — SQLite SoT for asset↔product associations

- **Status:** Accepted (2026-08-05)
- **Context:** Branding associations lived in `branding-index.json` + overrides (~11). Folder spray and OCR polluted `linked_product_ids`. Instant boot cannot parse 361MB; quiz needs pending queue.
- **Decision:** Canonical store for association decisions = SQLite table `asset_product_links` in `dam-local.sqlite` (status: auto | pending | confirmed | rejected | skipped). Overrides seed as `confirmed` / source=`override`. Refilter writes pending (score 50–74) and auto (≥75). Quiz `/assoc/decide` updates SQLite and mirrors override on confirm. Slim `branding-grid-index.json` rebuilds `linked_product_ids` from SQLite (`--from-sqlite`).
- **Consequences:** JSON index is staging/cache for UI, not SoT after seed. Manual/quiz confirmed never OCR-overwritten. Portable runtime still uses local SQLite (no admin / no Postgres required for assoc SoT).
- **Related:** Instant slim (K0–4), spray ban PI `assoc.no_sibling_spray_mixed`, Portable Runtime P0.
