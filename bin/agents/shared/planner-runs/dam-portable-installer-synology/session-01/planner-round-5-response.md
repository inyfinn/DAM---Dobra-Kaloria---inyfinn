# Planner response — round 5

Źródło: `planner-round-5-critique.md` (werdykt CONTINUE).

## Krytyczne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| K1 | weryfikacja | DAM.exe bypass boot-host / PyInstaller crash | **ACCEPT** | Jeden publiczny bootstrap EXE; wewnętrzny PyInstaller **przemianowany i ukryty** — nie jest entry UX. |
| K2 | weryfikacja | Heal bez vcredist + branding | **ACCEPT** | Rozszerzyć `boot-heal.html` o pełne reasons + logo DK lokalne/embed. |
| K3 | weryfikacja | Konsola flash + AUMID na cmd/ps | **ACCEPT** | Bootstrap GUI bez konsoli; AUMID na bootstrap + app; CM7e no-console. |
| K4 | wspolbieznosc | PREP git commit secrets | **ACCEPT** | Explicit allowlist; zakaz `git add -A`; secret/DB scan przed commit. |
| K5 | ryzyko_modelowe | VC++ offline/admin | **ACCEPT** | Per-artifact: installer = bundled `vc_redist.x64.exe`+UAC; portable = app-local CRT (licencjonowane). Bez fałszywego „per-user VC++ bez UAC”. |

## Ważne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| W1 | weryfikacja | PS path spaces / MOTW / ExecutionPolicy / UTF-8 | **ACCEPT** | Bootstrap EXE eliminuje PS jako public entry; wewnętrzne skrypty nadal quoted+Unblock+UTF8. |
| W2 | weryfikacja | dumpbin top-N DLL + pyd | **ACCEPT** | `prep-dll-dependents.json` rozszerzony. |
| W3 | zasoby | Rolling budget vs archive | **ACCEPT** | Rolling max 3 PREP; >10% growth → Parent checkbox. |
| W4 | zasoby | Stubs vs live inbox/settings | **ACCEPT** | Release stubs / sanitize non-empty user queues. |
| W5 | weryfikacja | build-file-index Marketing access | **ACCEPT** | Threshold count lub Parent „cached index” w prep message. |
| W6 | weryfikacja | Screenshot gaps + latency baseline ms | **ACCEPT** | CM missing_runtime; CM7e; A0 latency ms; CM3 offline hint. |
| W7 | governance | Portable upgrade path | **ACCEPT** | CM5p overwrite + preserve `apps/desktop/data`. |
| W8 | eskalacja | CM3 no migrate --apply; CM4b before Tier-B | **ACCEPT** | HARD w macierzy. |

## Kosmetyczne

| # | Werdykt | Notatka |
|---|---------|---------|
| Ko1 seed ≠ A0 | **ACCEPT** | Bez zmian intencji. |
| Ko2 branding-search builder | **ACCEPT** | Jawna policy preserve+freshness w R6. |
| Ko3 MAD 5→6/10 | **ACCEPT** | Debata trwa. |

## Liczniki

- **ACCEPT krytyczne:** 5 · **REBUT:** 0  
- **ACCEPT ważne:** 8 · **REBUT:** 0  
- **Kosmetyczne:** 3 ACCEPT  
- **K+W:** **13 ACCEPT / 0 REBUT**

## Tie / otwarte

- Brak tie.  
- Parent Q1–Q7 (Q8 warunkowe) otwarte.

## Skutek

→ `planner-round-6-draft.md`. Kanon nie tworzony. Implementacja zakazana.
