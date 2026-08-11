# HANDOFF — Branding / Quiz / Viz — ZAMKNIĘTE (2026-08-11)

Plan recovery `dam_live_indexing_recovery` domknięty. Commity na `main` (HEAD `fb9ef83`+).

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

## PENDING (świadomie na kolejną turę)

1. Quiz E2E: pełny pipeline skan → `asset_product_links` pending (nie tylko grid fallback).
2. Edycja tytułów w UI (admin): contenteditable / persist display name.
3. Gazetki w UI: wyłączyć „Tylko grafiki” lub pokazać archiwum `.ai`.
4. Runtime screenshot parity: ten sam plik offline badge Branding vs Viz modal.

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
- `apps/desktop/local_bridge.py`
- `apps/web/scripts/build-branding-grid-index.py`
