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

## Dokumentacja skojarzeń (assoc UI)

- **Słownik pojęć (metafory, typ A/B, bind = listener vs ctx):** [`docs/ASSOC-GLOSSARY.md`](ASSOC-GLOSSARY.md)
- **Pełny łańcuch techniczny + diagramy:** [`agents/shared/code-doctrine.md`](../agents/shared/code-doctrine.md) §12 REFERENCE
- **QA bramka P1 (pusty materialCandidates):** `scripts/qa/sim-assoc-material-empty-seed.js`

## Index run report contract (2026-09-15)

Written by `index_supervisor.complete_run_report` to `bin/apps/desktop/data/index-last-report.json` and returned as `GET /index/report` (`{ok, ...report}`). Additive keys only — do not drop legacy flat fields.

**Counters (three universes):**

- `elements` / `counts.elements_scanned` — logical products in `file-index.json` (id = product slug).
- `files` / `counts.files_scanned` — unique file paths inside those products (`files_by_role` + `wizki`, de-duplicated). Change detection is at this grain.
- `branding_materials` / `counts.branding_materials` — assets in `branding-grid-head.json` (head slice, not the fat branding index).

**Change detection:** stable key = normalized file path. Signature = existing `hash`/`sha256`/`digest` when present, otherwise `mtime` + `size`. `NEW` = key absent from the previous snapshot; `UPDATED` = key exists but signature changed; `UNCHANGED` = same signature; `REMOVED` = key present previously and gone now. Previous snapshot is `index-run-snapshot.json` (this-run pre-state), then `index-compare-snapshot.json`, then `.prev`. A corrupt or half-written snapshot does **not** become “all new” or “all unchanged”: `comparison_ok=false` and `warnings` contain `nie udało się porównać: …`. Verified `bez zmian` is only `comparison_ok=true` with `counts.new=updated=removed=0`.

**JSON shape (additive):**

```
counts: {new, updated, unchanged, removed, elements_scanned, files_scanned, branding_materials}
new_items / updated_items / removed_items: up to 50 × {key, name, path, kind}
new_items_truncated / updated_items_truncated / removed_items_truncated
started_at, finished_at, duration_ms, mode ("full"|"incremental"), comparison_ok, warnings[]
```

Legacy (unchanged names): `added`, `changed`, `unchanged`, `scanned`, `items`, `product_*`, `branding_*`, `files_before`, `files_after`. `added`/`changed` remain product+branding deltas for the current UI. `counts.*` is the file-level contract for the new renderer. One structured JSON line per run is appended to `bin/apps/desktop/data/index-rebuild.log` (rotated at 2 MB).

## File-index `fields=` projection (2026-09-15)

Owner: `apps/desktop/local_bridge.py` (`_file_index_explorer_slim`, `_file_index_viz_latest_slim`). Applied **before** `json.dumps`. Compact separators `("," , ":")`.

**`GET /file-index?fields=explorer`** — first-paint catalog only. Product allowlist: `id, display_name, name, brand, root_key, path, category, subcategory_slug, subcategory_label, tags, indexes, index_bases, revision_count, in_archive, archive_only` plus `revisions[]` and `files_slim=true`. Revision allowlist: `folder, path, index, index_base, date, langs, carrier, is_latest, in_archive, archive_wrapper`. Empty / default-false flags omitted. **Not** included: `search_blob`, product `tag_groups`, `authors`, `related_materials`, `files_by_role`, `wizki`, `checklist`, `checklist_paths`, `viz_latest`. Those come from `GET /file-index/product?id=` when explorer hydrates (`files_slim`).

Historical ~47 KB is stale: 193 products × 521 revisions with full Windows `path` values floor at ~259 KB compact. A ~1 MB live body was the denylist leaking `search_blob` plus per-revision `extras_for_index` checklist paths.

**`GET /file-index?fields=viz_latest`** — allowlist on each viz row (no empty `thumb_url` / `rel` / empty arrays / default-false flags). Frontend synthesizes `products` from rows.

**`GET /branding-grid-head`** — owner `branding_asset_routes._slim_branding_head`. File is already an 800-asset head (full grid ~23 MB). Serve omits empty `linked_product_ids` / `is_archive:false`.
