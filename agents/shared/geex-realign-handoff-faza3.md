# Handoff Faza 3 (Agent B — buttons)

Właściciel: Agent B. **Nie edytuj** z Fazy 4. Lead scala przy join przed 5a.

Status: DONE — tag `geex-phase3`

## Approach / root cause

F2 zostawiło skeleton `/* === BUTTONS === */` z token hookami. F3 wypełnia anatomię Geex: `.geex-btn` pad 15×25 / radius 18 / min-height 44 via F2 tokens; warianty primary / secondary / danger / ghost; aliasy `.dam-win-btn`, `.dam-btn-primary`; icon controls 44×44. Hover secondary/ghost/icon = `color-mix` (anti white-flash). Modal actions: tylko layout/gap 10px w `dam-viz-modal.css`. Tutorial `.dam-tut__btn` → ta sama anatomia w `dam-tutorial.css`.

## Done

- [x] `dam-primitives.css` BUTTONS section (BADGES nietknięte)
- [x] `dam-viz-modal.css` actions* layout/gap only
- [x] `dam-tutorial.css` tut btn alias → Geex look
- [x] design-system `buttons.md` + `icon-btn.md` sync
- [x] HTML `?v=` bump: `dam-primitives.css?v=geexF3btn20260721c`, tut `geexF3tut20260721a`, viz-modal `geexF3act20260721a`
- [x] 3 verification cycles Pass (fixture + CDP + screenshot Read)

## Verification cycles

| Cycle | Viewport | Result |
|-------|----------|--------|
| 1 | default / fixture | Pass: radius 18, pad 15×25, icon 44×44, actions gap 10; fix dam-btn-primary UA border |
| 2 | 390 | Pass: min-h ≥44, no CTA overflow, border fix confirmed, screenshot Read OK |
| 3 | 1440 | Pass: same measures, secondary hover not pure white (`whiteFlash=false`), screenshot Read OK |

Local fixture (not required in prod): `apps/web/_qa/geex-f3-buttons-fixture.html`

## Files touched

- `apps/web/assets/css/dam-primitives.css` (BUTTONS only)
- `apps/web/assets/css/dam-viz-modal.css` (actions layout/gap)
- `apps/web/assets/css/dam-tutorial.css` (tut alias)
- `design-system/components/buttons.md`
- `design-system/components/icon-btn.md`
- `apps/web/*.html` (`?v=` cache bust only)
- `agents/shared/geex-realign-handoff-faza3.md`
- optional: `agents/shared/geex-realign-regress-notes-faza3.md`

## Risks

- Cascade: `dam-brand.css` ładuje się **po** primitives — lokalne override modal/nav mogą nadal nadpisać część anatomii (np. pill radius 50px w actions). F3 nie rusza `dam-brand.css` (FORBIDDEN).
- Równoległy Agent C bumpował też `?v=` na primitives — Lead przy join powinien jedna wersja enqueue.
- Live pages z auth (`:8765` pełny DAM) nie były CDP na dashboardzie; dowód = fixture + token measures.

## Return

- tag: `geex-phase3`
- cycle count: **3** (Pass)
- ESCALATE: none
