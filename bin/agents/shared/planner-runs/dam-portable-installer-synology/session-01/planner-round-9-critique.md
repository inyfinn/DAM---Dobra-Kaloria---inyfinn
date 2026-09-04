# Critique round 9

## READ wykonany
- [x] `agents/shared/planner-runs/.../brief.md` — 15 celów HARD, Parent odbiorca, evidence-only, min_rounds 10
- [x] `agents/shared/planner-runs/.../planner-round-9-draft.md` — R9: A0 PASS/FAIL, comctl6, IPC Local\, CRT discovery, DPAPI resume, no silent Q
- [x] `agents/shared/planner-runs/.../planner-round-8-critique.md` — 5K+8W; baseline zamknięcia
- [x] `agents/shared/planner-runs/.../planner-round-8-response.md` — 12 ACCEPT / 1 REBUT (W6 silent defaults)
- [x] `agents/shared/planner-runs/.../planner-changelog.md` — MAD 9/10
- [x] `AGENTS.md` — GIT_ROOT/bin, bramki QA, evidence
- [x] `memory.md` — portable HARD, fat OUT, Parent w /planner
- [x] `apps/desktop/runtime_config.py` — stary `Global\\DAM_DOBRA_KALORIA…` do migracji
- [x] `geex-plan-retro-cheat-sheet.md` — kategorie Critica, dowód per krok
- [x] Brak `.cursor/agents/critic.md` w repo

## Ocena domknięcia 5K + 8W + 3Ko (R8→R9)

| ID R8 | Status R9 | Testowalność |
|-------|-----------|--------------|
| K1 A0 a11y evidence | **Zamknięte częściowo** | Tabela §1.2 PASS/FAIL; **Inspect/AI nie na czystej VM bez prep** |
| K2 comctl32 v6 / DLL | **Zamknięte** | user32/gdi32/comctl32, manifest 6.0, InitCommonControlsEx, pin |
| K3 mutex mismatch | **Zamknięte** | `ipc_names.json`, contract test, migrate launch.py, exit 17 przed mutex |
| K4 CRT `_internal` | **Zamknięte** | discovery-first, PE scan, hijack obu katalogów |
| K5 3010 integrity | **Zamknięte częściowo** | DPAPI+nonce+expiry+RunOnce; **elevation boundary HKCU RunOnce** |
| W1 activate hang | **Zamknięte** | focus/timeout heal, tasklist+title |
| W2 handshake cleanup | **Zamknięte** | close pipe, parent wait, kill @60s |
| W3 lpCurrentDirectory | **Zamknięte** | engine dir, absolute spawn |
| W4 SmartScreen×2 | **Zamknięte** | 2 screenshots + hash README |
| W5 CM3 offline hint | **Zamknięte** | cm3-offline-hint.png |
| W6 Q defaults | **REBUT zaakceptowany przez Critica** | §0.2 STOP matrix + Tier-A portable vs §8 — **słuszne**, nie wracam z tym samym ważnym |
| W7 evidence templates | **Zamknięte** | `dist/evidence/cm/<CM-ID>/` |
| W8 CM8 bez boot-heal | **Zamknięte** | WARN only |

**Podsumowanie:** R9 domyka architekturę R8. Pozostają **2–3 luki wykonawcze** (a11y tooling na VM, RunOnce/UAC, PREP tooling host vs clean VM) oraz **brief §10 regresja UI** bez CM.

## REBUT W6 (silent defaults Q1–Q7)

**Ocena: słuszny REBUT Plannera.** Brief §15 i user query wielokrotnie wymagały Parent jako bramki; auto-defaulty A naruszałyby governance i maskowałyby decyzje (Q1 path, Q2 SmartScreen, Q3 D3). Rozdzielenie **Tier-A portable-only** (bez Q1) vs **Brief §8** (wymaga Q1) w §0.2 jest wystarczające na CONVERGED rundy 10 **jako plan architektury** — bez twierdzenia „§8 DONE”. **Nie eskaluję tie** (dotyczyłoby 3× krytycznego; tu REBUT ważny, zaakceptowany).

## Krytyczne
- [weryfikacja] **3010 resume: HKCU RunOnce bez UAC vs elevated install:** RunOnce w `HKCU` uruchamia installer **w sesji user bez elevation**; jeśli pierwszy przebieg był elevated (typowo `{pf}`), resume `finish_copy`/shortcuts może **FAIL cicho** lub partial; dopisać HARD: (A) RunOnce command z `runas`/scheduled task elevated **tylko** gdy `{app}` wymaga admin, **lub** (B) resume phase = wyłącznie user-writable `{localappdata}` staging do momentu reboot+manual „Dokończ instalację” z UAC; CM12b must assert **log elevation + files in {app}** after reboot.
- [weryfikacja] **A0-UIA na clean VM — narzędzia niedostępne out-of-box:** `Inspect.exe` = Windows SDK (nie na CM1a); Accessibility Insights = osobny install; na czystej VM bez prep **A0-UIA FAIL by design**; dopisać: (1) **A0 PoC VM** = clean + **jednorazowy** QA bootstrap (Accessibility Insights portable **lub** `scripts/qa/export-uia-tree.ps1` w repo, zero SDK); **albo** (2) A0 PASS wymaga **A0-NAR mandatory**, A0-UIA optional Tier-A / mandatory Tier-B; inaczej gate nieosiągalny vs „clean VM” claim.

## Ważne
- [weryfikacja] **CRT discovery tooling — host vs CM VM:** `dumpbin`/Dependencies na **PREP/build host** (VS Build Tools pinned w gate), nie na clean CM; artefakt `prep-dll-dependents.json` commitowany do evidence; CM1a tylko **consumes** wynik; FAIL gate gdy brak dumpbin na build machine.
- [weryfikacja] **IPC exit 17 przed mutex — double direct dam-appw:** dwa ręczne starty `dam-appw.exe` mogą dać **dwa procesy** (oba exit path przed mutex); OK jako unsupported bypass, ale CM-bypass powinien assert **single instance tylko via bootstrap**; README „nie uruchamiaj dam-appw.exe bezpośrednio”.
- [weryfikacja] **DPAPI resume: meta.json vs blob:** `install-resume.meta.json` plaintext obok blob — dopisać **blob = source of truth**; installer **CryptUnprotectData first**, weryfikuje sha installer + nonce; meta tylko diagnostyka; reject gdy meta/blob mismatch.
- [kompletność_briefu] **Brief §10 regresja web (branding latency, quiz, titles, gazetka, indexes):** macierz F nie ma CM-regresji post-release; dopisać min. **CM-REG-1** smoke (8765/8766, grid-head cold path, jeden screenshot branding) w Tier-A lub osobna bramka po FREEZE — inaczej plan nie pokrywa celu 10.
- [weryfikacja] **Ikony DK (brief §6):** B1/W-Icons w planie, brak w DoD checklist (exe/installer/shortcut/uninstaller/taskbar); dopisać artefakt `icons-matrix.png` + hash w manifest.
- [weryfikacja] **Synology/DDNS (brief §7):** STOP bez Q3 na D3 spójne; doprecyzować w R10: **update example files** (`pg-config.example.json`, `dam-connection.env.example`) — usunąć stary LAN **po Q4**, nie przed; CM4b przed Tier-B OK.
- [governance] **Parent Q przed rundą 10:** plan **może** CONVERGE w R10 jako **architektura + gate matrix** bez odpowiedzi Parent; **nie może** twierdzić Brief §8 DONE / Tier-B bez Q1/Q3. W R10: jawna sekcja „Parent checklist przed E/D/G” + opcjonalny portable-only CONVERGED.

## Kosmetyczne
- [kontekst] MAD 9/10 — runda 10 obowiązkowa (min_rounds).
- [weryfikacja] A0-TAB: R8 logo→body→… vs R9 body→Ponów — doprecyzować czy logo w tab chain (dekoracyjne = skip OK).
- [kompletność_briefu] `mt.exe` manifest dump — wymaga Windows SDK na build host; pin w PREP docs obok dumpbin.

## Werdykt
CONTINUE

*(MAD 9/10 — R8 domknięte; 2 krytyczne wykonawcze: RunOnce/UAC + a11y tooling na VM; R10 = CONVERGED planu + Parent checklist, implementacja nadal za bramkami Q.)*

### Parent Q — wymagane teraz?

| Cel | Parent Q teraz? |
|-----|-----------------|
| Dokończenie debaty planu (R10) | **Nie** — możliwe CONVERGED architektury + checklist |
| Start fazy **E3** installer / CM5/CM6 / §8 sign-off | **Tak — Q1** |
| **D3** prefer Synology / Tier-B CM3 | **Tak — Q3** (+ D3 APPROVAL) |
| Authenticode / expectation SmartScreen | **Tak — Q2** (lab hash path bez Q2 OK) |
| **A0 PoC** | **Nie** |

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
