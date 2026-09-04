# Baseline Branding cold open (K0)

- index_size_mb: 361.4
- assets_count (streamed): 56822
- frozen_slim_fields: id, path, name, tags, asset_role, media_type, folder_group_id, linked_product_ids, linked_products (id+name only), thumb_url, preview_url, background, is_archive, sku, indexes, index_bases, mtime, size
- note: cold boot today parses full branding-index.json on main thread (dam-branding.js loadIndex).
- baseline_assumed_cold_ms: >15000 (status "Przetwarzanie indeksu…"); Instant HARD target cold_ms < 2500 after slim.
