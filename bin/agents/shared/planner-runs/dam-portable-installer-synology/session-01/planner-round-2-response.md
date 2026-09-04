# Planner response — round 2

Źródło: `planner-round-2-critique.md` (werdykt CONTINUE).

## Krytyczne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| K1 | weryfikacja | Profil VM + CM1a/CM1b per Q6 | **ACCEPT** | Bez profilu i rozdzielenia engine vs UI „czysty Windows” nieweryfikowalny; Q6A nie może wymagać okna UI na VM bez WebView2. |
| K2 | weryfikacja | Full-tree manifest + niezależny verify-manifest.ps1 | **ACCEPT** | 3 wpisy w examples nie chronią payload; gate musi hashować każdy plik; IT weryfikuje poza gate. |
| K3 | weryfikacja | Algorytm stale EXE (nie mtime) | **ACCEPT** | mtime jest zawodne; provenance = git HEAD + source snapshot hash osadzone w EXE/metadata; fail przy mismatch. |
| K4 | zasoby | branding-grid MUST + freshness gate | **ACCEPT** | PI cold path wymaga head+index; WARN sprzeczne z CM9a; FAIL gdy brak lub stale generation. |
| K5 | wspolbieznosc | RELEASE FREEZE apps/web + branding do końca CM9 | **ACCEPT** | Równoległe edycje po gate = fałszywy PASS CM9; freeze commit + invalidacja. |
| K6 | weryfikacja | CM12 MUST na VM bez VC++; docs ≠ PASS | **ACCEPT** | „Udokumentowany prereq” jako PASS = fałszywa zieleń; lab test obowiązkowy. |

## Ważne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| W1 | weryfikacja | CM1 na portable gdy Q1 nieznane | **ACCEPT** | E3 zablokowane ≠ blokada CM1a/CM1b na portable z `dist/release`. |
| W2 | wspolbieznosc | AUMID wyłącznie W-Runtime w launch.py | **ACCEPT** | Jeden WRITE owner; Icons tylko ICO. |
| W3 | weryfikacja | CM13 redis cold-start bez serwera | **ACCEPT** | Domknięcie D7 evidence. |
| W4 | ryzyko_modelowe | grep `bin/dist/` asercja w E1 | **ACCEPT** | W1 bez kroku = deklaracja. |
| W5 | eskalacja | Q7A = partial ship, nie pełny brief §7 | **ACCEPT** | Multi-PC Synology pozostaje otwarte przy Q7A. |
| W6 | weryfikacja | Exclude `__pycache__`/`.pyc` z runtime tree | **ACCEPT** | Puchnięcie + maskowanie diffów. |
| W7 | governance | Todo A1 obejmuje Q7 warunkowe | **ACCEPT** | Spójność z §0.1. |

## Kosmetyczne

| # | Werdykt | Notatka |
|---|---------|---------|
| Ko1 budżet QA vs min_rounds | **ACCEPT** | Jawne: debata ≠ przebiegi implementacji. |
| Ko2 license.html w allowlist | **ACCEPT** | MUST jeśli UI linkuje lokalnie (`license.html` + powiązane legal pages). |
| Ko3 precyzja changelog | **ACCEPT** | R2 zamknął K z R1; R2 otworzył nowe luki domknięte w R3. |

## Liczniki

- **ACCEPT krytyczne:** 6 · **REBUT:** 0  
- **ACCEPT ważne:** 7 · **REBUT:** 0  
- **Kosmetyczne ACCEPT:** 3  
- **Łącznie K+W:** **13 ACCEPT / 0 REBUT**

## Tie / otwarte

- Brak REBUT → brak tie.  
- Parent Q1–Q7 nadal otwarte (nie zgadywane).  
- **Q8 (warunkowe):** tylko jeśli CM12 FAIL ×3 — strategia bundlowania VC++ (A dokumentuj+link / B bundle redist w installerze / C inne). Nie blokuje draftu.

## Skutek

Wszystkie ACCEPT → `planner-round-3-draft.md`. Kanon nie tworzony. Implementacja zakazana.
