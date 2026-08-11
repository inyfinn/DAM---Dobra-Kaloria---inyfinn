# HANDOFF — Branding / Quiz / Viz — ZAMKNIĘTE (2026-08-11)

Plan recovery `dam_live_indexing_recovery` + HANDOFF pending items domknięte.

## PASS (wdrożone + commit)

1. Live indexing: supervisor, watcher, `DamIndexPoller`, force reload Explorer/Viz/Branding.
2. Branding head: grafiki only, `HEAD_ROLES` live taxonomy, `M-*` IDs (0× `br-`).
3. Tytuły kart: nazwa pliku, nie folder-kubełek.
4. Quiz: admin-only, `/thumb-cache`, fallback z siatki gdy SQLite pusty.
5. Viz thumbs: `hasStaticDataThumb`, `object-fit: contain`, onerror → `/media`.
6. Offline/online: wspólny `GET /file-availability` (Branding + Viz).
7. Empty assoc UI: ikona info + lepszy copy.
8. Preview: thumb-cache + defer (kod).
9. Doctrine §12: root causes zapisane w `agents/shared/code-doctrine.md`.
10. Repo cleanup: usunięte legacy THEME/tools/docs; `bin/` w `.gitignore`; `sync-apps-to-bin.ps1`.

### PASS — tura HANDOFF 2026-08-11 (4 pending)

| # | Temat | Status | Dowód |
|---|--------|--------|-------|
| 1 | Quiz E2E `asset_product_links` | **PASS** | SQLite: `auto=9351`, `confirmed=22`; `/assoc/queue` → 200 items, banner „Kolejka pending z bazy”, sugestia `gyros-groch-niemiesne 100`. Screenshot: `scripts/qa/handoff-20260811/qa-quiz-sqlite-suggestions.png` |
| 2 | Edycja tytułów (admin) | **PASS** | `DamModalShared.get/setAssetDisplayTitle` + `bindEditableAssetTitle` (localStorage `dam_asset_display_title:{path}`); karty branding + `#damMediaPreviewTitle` |
| 3 | Gazetki w UI (Tylko grafiki ON) | **PASS** | Bypass archiwum + źródeł (.ai) przy aktywnym wyszukiwaniu; „gazetka” → 2 elementy / 13 plików. Screenshot: `scripts/qa/handoff-20260811/qa-gazetka-pass.png` |
| 4 | Offline badge parity | **PASS** | Wspólny `DamModalShared.applyThumbAvailabilityFallback` → `GET /file-availability` w Branding (`__damBrandingThumbFallback`) i modal (`__damMediaPreviewFallback`); etykiety `DamPreviewTruth.onErrorTitle` |

## Po `git pull`

```powershell
.\scripts\ops\sync-apps-to-bin.ps1
.\scripts\ops\dev-start.ps1   # dev z apps/
# albo DAM.exe                   # prod z bin/
```

## Pliki kluczowe

- `apps/web/assets/js/dam-branding.js`
- `apps/web/assets/js/dam-assoc-quiz.js`
- `apps/web/assets/js/dam-viz.js`
- `apps/web/assets/js/dam-modal-shared.js`
- `apps/web/assets/js/dam-media-preview.js`
- `apps/desktop/local_bridge.py`
- `apps/web/scripts/build-branding-grid-index.py`
