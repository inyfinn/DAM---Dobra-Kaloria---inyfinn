# Geex realign — manifest regresji wizualnej

PNG lokalnie: `apps/web/_qa/geex-realign-baseline/phase{N}/` (gitignore).

| Faza | Tag | Baseline vs | Wynik | Notatki |
|------|-----|-------------|-------|---------|
| 0 | `geex-phase0` | — | PASS 36/36 | 2026-07-21 inventory close: `retry_fails.py` dopiął 8 failów (font-timeout); lokalny `_meta.json` 36×ok (json gitignored). Skrypt: `capture_phase0.py` / `retry_fails.py`. |
| 1 | `geex-phase1` | phase0 smoke deferred | PASS audit / smoke DEFERRED | Audyt: `geex-realign-audit-2026-07-21.md`. Live CDP + dashboard×modal 3vp deferred (`:8765` down). F2 entry: re-CDP §5. |
| 2 | `geex-phase2` | phase0 | PASS structure / smoke DEFERRED | Tokens+primitives+docs+briefs. Live CDP §5 **skipped** (`:8765` HTTP 000). Miary z audit CSS-declared. Hot pages enqueue OK (21 HTML). PNG local compare skipped (no server). |
| 3 | `geex-phase3` @ `7c9d346` | phase0 / phase2 | PASS 3 cykle | Buttons: radius 18, pad 15×25, icon 44×44, actions gap 10; secondary hover no pure white. PNG: `geex-f3-buttons-390/1440.png` (notes-faza3). Risk: `dam-brand.css` after primitives may override pills. |
| 4 | `geex-phase4` @ `3ee60bf` | phase0 / phase2 | PASS 3 cykle | Badges MASTER radius 14 + `--dam-badge-scale`; scale kills branding/brand. PNG under `phase4/`. Residual: host Emulation ~765; brand.css `999px` later — F7 thin. |
| 5a | `geex-phase5a` @ `9b5cea5` | phase0 | PASS | PANELS surfaces; no reveal props. |
| 5b | `geex-phase5b` @ `3d457df` | phase5a | PASS | Popover surfaces; IO+opacity Pass. |
| 6 | `geex-phase6` @ `5c33525` | phase0 | PASS | Dark bridge + color-scheme; darkOk. |
| 7 | `geex-phase7` @ `c6023e3` | phase0 | PASS | Thin brand badge/btn duplicates; radius 14. |
| 8 | `geex-phase8` | phase0 | PASS | Final QA 390 dashboard Pass; merge main. |

## Świadome delty

### Faza 2
- `--dam-control-h`: 38 → **44** (Parent F2 / touch target); audit CSS-declared było 38.
- Nowe tokeny z konsumentem w primitives: `--dam-radius-btn` (18), `--dam-space-btn-y/x` (15/25).
- Dark: pełniejsze mapowanie Geex `--success/danger/warning/primary*-transparent`.
- Skeleton primitives może lekko nadpisać radius paneli (token hooks) — F3/F5 domyka anatomię; świadoma delta vs phase0 bez live screenshot.

### Faza 3 (join from notes-faza3)
- Geex CTA anatomy via tokens; aliases `.dam-win-btn` / `.dam-btn-primary` / tut btn.
- Modal actions: layout/gap only (`dam-viz-modal.css`).

### Faza 4 (join from notes-faza4)
- Chip corners 999→14 MASTER; branding local `*1.1` removed on badge path.
- Dark muted index AA lift.

