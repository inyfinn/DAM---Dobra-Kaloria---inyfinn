# Planner response — round 1

Źródło: `planner-round-1-critique.md` (werdykt CONTINUE).  
Reguła: każde Krytyczne/Ważne → ACCEPT (wprowadź w R2) albo REBUT.

## Krytyczne

| # | Kategoria | Punkt (skrót) | Werdykt | Uzasadnienie |
|---|-----------|---------------|---------|--------------|
| K1 | weryfikacja | CM1 ≠ C1; cold-start na izolowanym VM | **ACCEPT** | C1 to smoke build machine; CM1 musi być osobny dowód z VM/profilu bez Python/repo/dev tools (log + screenshot). |
| K2 | weryfikacja | WebView2 + VC++ failure modes → CM11/CM12 | **ACCEPT** | `launch.py` już ma heal webview2; pythonnet/PyInstaller mogą wymagać VC++. Bez CM11/CM12 CM1 = fałszywy PASS. |
| K3 | zasoby | E2 allowlist THEME/data bez ścieżek | **ACCEPT** | Konkretna lista + `Test-Path` per pozycja w `release-gate.ps1`. |
| K4 | weryfikacja | Brak SBOM / THIRD_PARTY_NOTICES | **ACCEPT** | E1/E4 generuje notices z vendored site-packages + `LICENSE.md` w root payload; CM10+. |
| K5 | ryzyko_modelowe | `build-release-zip.ps1` replace-not-wrap | **ACCEPT** | Nowy staging `dist/staging/`; stary ZIP deprecated poza ścieżką release; E1 nie deleguje do starego skryptu. |
| K6 | eskalacja | Brak Q6 WebView2 | **ACCEPT** | Q6 A/B/C; STOP E3/CM11 bez odpowiedzi Parent. Nie zgadujemy polityki. |
| K7 | governance | D3 bez `program-instructions.json` + KV | **ACCEPT** | Obowiązkowy krok PI przed zmianą default prefer; weryfikacja `GET /program-instructions`. |
| K8 | weryfikacja | Kontrakt manifest SHA256 | **ACCEPT** | `dist/release/manifest-<version>.json` ze schematem; gate fail bez pokrycia pythonw/DAM.exe/LICENSE. |

## Ważne

| # | Kategoria | Punkt (skrót) | Werdykt | Uzasadnienie |
|---|-----------|---------------|---------|--------------|
| W1 | sekwencja | Kanoniczna ścieżka `dist/` vs `bin/dist/` | **ACCEPT** | Jedyna kanoniczna: `GIT_ROOT/dist/{staging,release,evidence}`; grep zakaz `bin/dist/` w release scripts. |
| W2 | wspolbieznosc | Sync lock / handoff | **ACCEPT** | Lock file + wpis process.md; tylko Parent lub wyznaczony W-Pack wykonuje sync w join. |
| W3 | weryfikacja | CM9 → CM9a–e + 3 przeloty UI | **ACCEPT** | Bisectowalność + doctrine screenshot+Read na zainstalowanej instancji. |
| W4 | eskalacja | CM3 fail DDNS → Q4=C / Q7 przed multi-PC ship | **ACCEPT** | Escrow: jeśli CM3 FAIL, STOP ship multi-PC; AskQuestion Q4 ponownie lub Q7. |
| W5 | kompletność_briefu | Stary DAM.exe w gate | **ACCEPT** | `release-gate` wymusza rebuild exe LUB porównuje mtime/hash vs `bin/apps` po sync. |
| W6 | zasoby | redis w requirements-portable | **ACCEPT** | D7: klient redis w site-packages OK (import); **brak** serwera Redis w payload; feature zależne od Redis = graceful degrade / documented optional. |
| W7 | weryfikacja | ICO multi-DPI + AppUserModelID + installer surfaces | **ACCEPT** | B1 rozszerzone: 16/32/48/256, SetupIcon/UninstallDisplayIcon, AUMID, CM7a–d. |
| W8 | weryfikacja | D2b migrate evidence | **ACCEPT** | Dry-run migrate log (bez sekretów) przed D3. |
| W9 | ryzyko_modelowe | Tabela build-machine vs end-user prereqs | **ACCEPT** | Sekcja 1.1 w R2 — rozdzielenie C1 vs CM1. |
| W10 | weryfikacja | CM4b rollback prefer sqlite | **ACCEPT** | Test powrotu prefer + brak utraty danych user-facing. |

## Kosmetyczne (nie blokują; wprowadzone do R2)

| # | Werdykt | Notatka |
|---|---------|---------|
| Ko1 E1 budżet „minimum + escalate” | ACCEPT | Nie twardy sufit 5. |
| Ko2 C4 ścieżka WRITE | ACCEPT | `scripts/ops/...` source + mirror `bin/scripts/ops` po sync. |
| Ko3 README-START szablon | ACCEPT | 5 linii w E2. |

## Podsumowanie liczników

- **ACCEPT krytyczne:** 8  
- **REBUT krytyczne:** 0  
- **ACCEPT ważne:** 10  
- **REBUT ważne:** 0  
- **Łącznie ACCEPT / REBUT (K+W):** **18 / 0**

## Skutek

Wszystkie ACCEPT → `planner-round-2-draft.md`.  
Kanon `.plan.md` nadal nie tworzony. Implementacja zakazana.
