# Geex realign — manifest regresji wizualnej

PNG lokalnie: `apps/web/_qa/geex-realign-baseline/phase{N}/` (gitignore).

| Faza | Tag | Baseline vs | Wynik | Notatki |
|------|-----|-------------|-------|---------|
| 0 | `geex-phase0` | — | PARTIAL | Font-timeout Playwright; Parent unblock: nie blokować F1/F2. Skrypt: `_qa/geex-realign-baseline/capture_phase0.py` (+ `_capture_one.py` CDP fallback). |
| 1 | `geex-phase1` | phase0 smoke deferred | PASS audit / smoke DEFERRED | Audyt: `geex-realign-audit-2026-07-21.md`. Live CDP + dashboard×modal 3vp deferred (`:8765` down). F2 entry: re-CDP §5. |
| 2 | | phase0 | | |
| 3 | | phase0 / phase2 | | notes w handoff-faza3 |
| 4 | | phase0 / phase2 | | notes w handoff-faza4 |
| 5a | | phase0 | | |
| 5b | | phase5a | | |
| 6 | | phase0 | | |
| 7 | | phase0 | | |
| 8 | | phase0 | | |

## Świadome delty

(uzupełniać per faza)
