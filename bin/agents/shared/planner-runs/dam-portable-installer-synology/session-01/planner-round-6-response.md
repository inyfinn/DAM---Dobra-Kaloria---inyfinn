# Planner response — round 6

Źródło: `planner-round-6-critique.md` (werdykt CONTINUE).

## Krytyczne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| K1 | weryfikacja | Heal przez default browser | **ACCEPT** | Healer = natywne okno Go GUI; `boot-heal.html` tylko dev. |
| K2 | weryfikacja | dam-appw discoverable bypass | **ACCEPT** | Jeden launch path + **signed launch token/pipe**; bez tokenu dam-appw exit. Hidden file ≠ security. |
| K3 | ryzyko_modelowe | Go build contract niepełny | **ACCEPT** | Pin Go/modules, CGO=0, windowsgui, DPI manifest, provenance, signing matrix + verify gate. |
| K4 | ryzyko_modelowe | App-local CRT legal + hijack | **ACCEPT** | Tylko ekstrakcja z oficjalnego `vc_redist.x64.exe`; exact DLL list; `SetDefaultDllDirectories` + absolute paths; hijack CM. |
| K5 | weryfikacja | vc_redist UAC/reboot/offline | **ACCEPT** | Exit codes 0/1638/3010; UAC deny = rollback/no launch; reboot policy; hash+sig bundled redist. |

## Ważne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| W1 | weryfikacja | Lifecycle bootstrap→app; CM5p kill | **ACCEPT** | Wait/handoff + kill before overwrite. |
| W2 | weryfikacja | Bootstrap nie woła :8766 | **ACCEPT** | DB/network status tylko post-UI w app; heal bootstrap = lokalny dialog. |
| W3 | weryfikacja | SBOM PyInstaller/pip + binary secret scan | **ACCEPT** | Pin + staging strings scan. |
| W4 | zasoby | bootstrap SHA w BUILD_PROVENANCE | **ACCEPT** | Obok web snapshot. |
| W5 | weryfikacja | CM6 preserve secrets path; CM10 po CM5p | **ACCEPT** | Shortcuts gone; user data kept + README. |
| W6 | governance | Tier-B Q3; TLS w logu CM3 | **ACCEPT** | SKIP≠PASS bez creds procedure. |
| W7 | weryfikacja | CM-manifest-corrupt; CM1-profile no-python-PATH | **ACCEPT** | Automated synthetic + rename. |
| W8 | sekwencja | PS boot-host OUT z release | **ACCEPT** | Dev-only; payload FAIL jeśli obecny. |

## Kosmetyczne

| # | Werdykt | Notatka |
|---|---------|---------|
| Ko1 terminologia GUI | **ACCEPT** | Bootstrap = GUI shell + native heal UI. |
| Ko2 MAD 7/10 | **ACCEPT** | Debata trwa. |
| Ko3 CM12a/CM12b | **ACCEPT** | Split portable vs installer. |

## Liczniki

- **ACCEPT krytyczne:** 5 · **REBUT:** 0  
- **ACCEPT ważne:** 8 · **REBUT:** 0  
- **Kosmetyczne:** 3 ACCEPT  
- **K+W:** **13 ACCEPT / 0 REBUT**

## Tie / otwarte

- Brak tie.  
- Parent Q1–Q7 (Q8 warunkowe) otwarte.

## Skutek

→ `planner-round-7-draft.md`. Kanon nie tworzony. Implementacja zakazana.
