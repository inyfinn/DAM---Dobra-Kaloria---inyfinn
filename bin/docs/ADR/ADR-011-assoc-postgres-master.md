# ADR-011 - Postgres (Synology) is the master store for asset-product associations

- **Status:** Accepted (2026-09-17). Supersedes the "SoT" part of ADR-010.
- **Context:** Associations lived only in each PC's `dam-local.sqlite`, so manual links, Quiz decisions and OCR results were not visible on other machines. The main database is Postgres on Synology (ADR-009). The local SQLite should only be a dump for offline work.
- **Decision:**
  - The master table is `dam_asset_product_links` in Postgres. It has the same columns as the local table plus `rev`, a global sequence that increases on every change.
  - Local `asset_product_links` gets a `dirty` flag. SQLite triggers set `dirty=1` on every insert or update, from any writer (bridge, Quiz, OCR scripts).
  - The bridge runs `assoc_sync` in the background. Each cycle first PULLs rows with `rev > last_rev`, then PUSHes rows with `dirty=1`. It wakes on every local write and otherwise runs every 20 s. Offline, it silently retries.
  - Conflicts: the newer `updated_at` wins. A manual decision (`confirmed`/`rejected`/`skipped`) is never overwritten by an automatic one (`auto`/`pending`), and always overwrites an automatic one.
  - On the first sync of a local DB, all of its rows are pushed.
- **Consequences:**
  - The slim grid is still built from the local SQLite, which is a fast, offline-capable mirror. It is rebuilt whenever a pull brings changes.
  - The CLI `python apps/desktop/assoc_sync.py --db <sqlite>` forces one cycle.
- **Conflicts and history (admin panel):**
  - A Postgres trigger saves every change of a row to `dam_assoc_history` (kind `change`, versions before and after).
  - Every losing version is also saved there (kind `conflict`): an older offline change beaten by a newer one, or an automatic suggestion stopped by a manual decision.
  - Settings → "Konflikty i historia skojarzeń" (`/assoc/history`, `/assoc/history/restore`, `/assoc/history/resolve`, admin only) lets the admin keep the program's choice or restore the rejected or previous version. A restore is written straight to Postgres, and every PC pulls it.
  - Retention: history 30 days, unresolved conflicts 90 days.
  - The bridge also makes a daily copy of the local SQLite in `DATABASE/backups` and keeps it 30 days.
