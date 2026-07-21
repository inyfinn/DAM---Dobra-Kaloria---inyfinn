# Geex realign — manifest regresji wizualnej

PNG lokalnie: `apps/web/_qa/geex-realign-baseline/phase{N}/` (gitignore).

| Faza | Tag | Baseline vs | Wynik | Notatki |
|------|-----|-------------|-------|---------|
| 0 | `geex-phase0` | — | PARTIAL | Font-timeout Playwright; Parent unblock: nie blokować F1/F2. Skrypt: `_qa/geex-realign-baseline/capture_phase0.py` (+ `_capture_one.py` CDP fallback). |
| 1 | `geex-phase1` | phase0 smoke deferred | PASS audit / smoke DEFERRED | Audyt: `geex-realign-audit-2026-07-21.md`. Live CDP + dashboard×modal 3vp deferred (`:8765` down). F2 entry: re-CDP §5. |
| 2 | `geex-phase2` | phase0 | PASS structure / smoke DEFERRED | Tokens+primitives+docs+briefs. Live CDP §5 **skipped** (`:8765` HTTP 000). Miary z audit CSS-declared. Hot pages enqueue OK (21 HTML). PNG local compare skipped (no server). |
| 3 | | phase0 / phase2 | | notes w handoff-faza3 |
| 4 | | phase0 / phase2 | | notes w handoff-faza4 |
| 5a | | phase0 | | |
| 5b | | phase5a | | |
| 6 | | phase0 | | |
| 7 | | phase0 | | |
| 8 | | phase0 | | |

## Świadome delty

### Faza 2
- `--dam-control-h`: 38 → **44** (Parent F2 / touch target); audit CSS-declared było 38.
- Nowe tokeny z konsumentem w primitives: `--dam-radius-btn` (18), `--dam-space-btn-y/x` (15/25).
- Dark: pełniejsze mapowanie Geex `--success/danger/warning/primary*-transparent`.
- Skeleton primitives może lekko nadpisać radius paneli (token hooks) — F3/F5 domyka anatomię; świadoma delta vs phase0 bez live screenshot.
