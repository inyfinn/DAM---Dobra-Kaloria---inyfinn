# Planner response — round 4

Źródło: `planner-round-4-critique.md` (werdykt CONTINUE).

## Krytyczne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| K1 | weryfikacja | PyInstaller DAM.exe crash przed heal na VM bez VC++ | **ACCEPT** | CM1a-boot **nie** startuje `DAM.exe`. Entry = Windows PowerShell host (`DAM.cmd` → `dam-boot-host.ps1`) pokazujący heal przed jakimkolwiek PyInstaller/pythonnet. VC++ redist przed `DAM.exe` **albo** PREP dowód samowystarczalności embed+exe. |
| K2 | zasoby | Budżety 80/200 bez baseline | **ACCEPT** | A0 mierzy P50/max; gate = baseline + margin + absolute hard cap + Parent escalation. |
| K3 | zasoby | Slim MUST niepełne vs quiz/assoc/gazetka; brak build-file-index w PREP | **ACCEPT** | Pełna MUST-lista JSON/overrides; PREP: `build-file-index.py` + zależne buildy w kolejności; offline smoke; fat/secrets OUT. |

## Ważne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| W1 | wspolbieznosc | freeze wymaga commit PREP | **ACCEPT** | E0 dopiero po `git commit` PREP (tag opcjonalny); dirty tylko z Parent APPROVAL w FREEZE.json. |
| W2 | weryfikacja | post_sync snapshot za wąski | **ACCEPT** | Rozszerzony zestaw regresji **oraz** jawnie: full-tree manifest = SoT, snapshot = szybki pre-check. |
| W3 | weryfikacja | CM9a bez progu latency | **ACCEPT** | CDP/mark vs baseline threshold z A0 / Parent. |
| W4 | weryfikacja | portable zip vs folder w manifeście | **ACCEPT** | Hash po rozpakowaniu; zip jako osobny plik w artifact manifest. |
| W5 | governance | Parent sign-off Tier-A deferred §7 | **ACCEPT** | Checkbox DoD — partial ≠ pełny SUCCESS §7. |
| W6 | eskalacja | Tier-A bez CM5/6; brief §8 wymaga Q1+CM5/6 | **ACCEPT** | Macierz + DoD rozdzielone. |
| W7 | weryfikacja | CM3 evidence pack | **ACCEPT** | screenshot DB status + TCP log bez sekretów + opc. `/auth/me`. |
| W8 | ryzyko_modelowe | SBOM w PREP przed phase A | **ACCEPT** | HARD kolejność. |

## Kosmetyczne

| # | Werdykt | Notatka |
|---|---------|---------|
| Ko1 C6 vs kod | **ACCEPT** | R5 zastępuje DAM_BOOT_PROBE architekturą PowerShell host. |
| Ko2 changelog precyzja | **ACCEPT** | R4 zamknął 3/4K R3; otworzył VC++/budget — domknięte w R5. |
| Ko3 min_rounds | **ACCEPT** | Bez zmian. |

## Liczniki

- **ACCEPT krytyczne:** 3 · **REBUT:** 0  
- **ACCEPT ważne:** 8 · **REBUT:** 0  
- **Kosmetyczne ACCEPT:** 3  
- **K+W:** **11 ACCEPT / 0 REBUT**

## Tie / otwarte

- Brak tie.  
- Parent Q1–Q7 (Q8 warunkowe) otwarte.

## Skutek

→ `planner-round-5-draft.md`. Kanon nie tworzony. Implementacja zakazana.
