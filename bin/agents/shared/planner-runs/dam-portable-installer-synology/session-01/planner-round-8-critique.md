# Critique round 8

## READ wykonany
- [x] `agents/shared/planner-runs/.../brief.md` — portable+installer, Synology §7, clean-machine evidence, min_rounds 10
- [x] `agents/shared/planner-runs/.../planner-round-8-draft.md` — R8: x/sys Win32+wrappers, A0 PoC, nonce handshake, onedir+CRT, mutex-first, 3010 RunOnce
- [x] `agents/shared/planner-runs/.../planner-round-7-critique.md` — 5K baseline; R7→R8 closure map
- [x] `agents/shared/planner-runs/.../planner-round-7-response.md` — 13 ACCEPT / 0 REBUT
- [x] `agents/shared/planner-runs/.../planner-changelog.md` — MAD 8/10
- [x] `AGENTS.md` — GIT_ROOT/bin layout, evidence-only, server smoke
- [x] `memory.md` — portable HARD, fat branding OUT, /planner min_rounds
- [x] `apps/desktop/launch.py` — mutex `Global\\DAM_DOBRA_KALORIA_INYFINN_SINGLE_INSTANCE`, focus/zombie kill
- [x] `geex-plan-retro-cheat-sheet.md` — kategorie Critica, evidence cycles
- [x] Brak `.cursor/agents/critic.md` w repo

## Ocena domknięcia 5K + 8W + 3Ko (R7→R8)

| ID R7 | Status R8 | Testowalność |
|-------|-----------|--------------|
| K1 Go GUI stack | **Zamknięte częściowo** | D19 x/sys + wrappers + A0 gate; **brak comctl32 v6 manifest + dowodu a11y** |
| K2 HMAC theatre | **Zamknięte** | HMAC usunięty; threat model jawny; 60s heartbeat |
| K3 DLL onefile | **Zamknięte częściowo** | onedir + CRT w engine dir; **`_internal` layout nie doprecyzowany** |
| K4 bootstrap mutex | **Zamknięte częściowo** | mutex first + activate; **inna nazwa niż launch.py** |
| K5 3010 resume | **Zamknięte częściowo** | RunOnce + resume JSON; **integrity „signed" bez mechanizmu** |
| W1–W8 | **Largely zamknięte** | SmartScreen×2, pin redist, CM-slow-VM, kill abort, CM8 native |

**Podsumowanie:** R8 sensownie odpowiada na R7 (reliability≠security, onedir, PoC gate). Pozostają luki **wykonawcze Win32** (manifest comctl32, dowód UIA), **spójność mutexów**, **CRT vs PyInstaller `_internal`**, **RunOnce integrity** oraz **activate przy hang**.

## Krytyczne
- [weryfikacja] **A0 PoC — brak twardego evidence protocol dla a11y/DPI:** checklist §1.1 ma screenshot @125% i „MSA A / UIA minimal: button text", ale **SetWindowText ≠ audytowalny dowód UIA**; brak nazw plików PASS (`a0-narrator-log.txt`, `a0-inspect-accessible-names.png`, `a0-tab-order-recording.mp4` lub skrypt UIAutomation); dopisać HARD: min. **Narrator QuickStart** na 3 buttonach + **Inspect.exe** snapshot `Name`/`ControlType` per kontrolka; bez tego PoC = manual opinion.
- [ryzyko_modelowe] **D19: `x/sys/windows` bez jawnego stosu DLL/manifestu:** sam package **nie wystarczy** do pełnego GUI — plan musi HARD-pinować **`user32` + `gdi32` + `comctl32` v6** (embedded manifest `dependency` ComCtl32 6.0) i `InitCommonControlsEx`; bez tego PoC może PASS na dev a FAIL na clean VM (płaskie przyciski, brak theme). Wrappery w `win32/` OK, ale lista modułów + manifest = gate A0.
- [wspolbieznosc] **Dwa mutexy — ryzyko double engine:** bootstrap `Local\\Inyfinn.DAM.DobraKaloria.Singleton` ≠ engine `Global\\DAM_DOBRA_KALORIA_INYFINN_SINGLE_INSTANCE` (`launch.py`) → drugi bootstrap może być zablokowany, ale **bezpośredni start `dam-appw.exe`** omija bootstrap mutex; dopisać: **ten sam canonical name** (prefixed Local vs Global świadomie) + CM że bypass = exit 17; CM-double-bootstrap ≠ CM-double-engine jeśli nazwy rozjechane.
- [weryfikacja] **Onedir CRT placement vs `_internal`:** PyInstaller onedir ładuje `python3xx.dll`/deps z `_internal\`; plan mówi CRT „obok dam-appw.exe" — **niewystarczające** jeśli loader szuka w `_internal` first; dopisać: copy CRT do **exe dir AND `_internal`** (lub onedir layout bez `_internal` — Parent decision); CM-hijack musi testować spoof w **obu** katalogach + TEMP/PATH; artefakt `prep-dll-dependents.json` diff post-layout.
- [governance] **3010 resume „signed/validated" bez algorytmu:** `install-resume.json` OR Inno staging — brak **konkretnego** integrity (np. HMAC z installer build secret **poza** payload portable, albo Inno `{code}` signed flag + `{app}` only); ryzyko tamper/resume orphan po update/uninstall; dopisać: create/verify function, cleanup on success/uninstall/cancel, CM12b evidence = **before reboot screenshot + after reboot log + no stale RunOnce**.

## Ważne
- [weryfikacja] **Activate gdy hang:** §1.5 „activate signal → exit 0" nie rozwiązuje **bootstrap stuck przed spawn** ani **engine UI hang** (mutex engine trzymany, okno niewidoczne); skopiować wzorzec z `launch.py`: `_focus_existing_window` + zombie kill policy **lub** timeout → native heal „DAM już działa / nie odpowiada"; CM-double-bootstrap powinien assert **tasklist + window title**, nie tylko exit 0.
- [weryfikacja] **Handshake cleanup:** pipe ACL current-user OK; doprecyzować: **zamknij inherited handle** po ACK; bootstrap exit/crash → engine wykrywa parent death (`WaitForSingleObject` parent PID) i exit ≠17 z komunikatem; heartbeat fail @60s → **kill child** + heal (nie wiszący dam-appw); env `DAM_LAUNCH_NONCE` **unset** w logach i **nie** inherit do pythonw grandchildren.
- [ryzyko_modelowe] **`lpCurrentDirectory` ambiguity:** engine dir vs GIT_ROOT — wpływa na hijack cwd; HARD: `lpCurrentDirectory` = katalog `dam-appw.exe`; absolute paths everywhere; CM-hijack cwd = **desktop shortcut start dir** (user-facing).
- [weryfikacja] **Q2=A SmartScreen:** DoD + checkbox OK; dopisać evidence Tier-A: **2× screenshot** SmartScreen (bootstrap + pierwszy start engine) + hash verify README — oddzielone od release correctness PASS.
- [weryfikacja] **Synology/TLS/credentials/freeze:** D0→D3, CM3 SKIP≠PASS, fat OUT, PREP→FREEZE spójne; Tier-A DoD powtarza Q7A deferred — OK; doprecyzować CM3 **offline hint** artefakt przy Q7A (screenshot native heal/db hint, nie browser).
- [governance] **Q1–Q7 przed runda 10:** tabela §0.1 dobra; dla CONVERGED bez Parent: **bezpieczne defaulty** = Q2=A+checkbox, Q3 defer Tier-A, Q4=DDNS-only drop example LAN, Q5=TCP, Q6=N/A (native heal), Q7=A deferred, Q8=3×FAIL; **Q1 nadal blokuje §8/CM5/CM6** — w R9 dopisać „Tier-A portable-only sign-off bez Q1" vs „Brief §8 wymaga Q1" (nie mylić gate'ów).
- [weryfikacja] **Clean-machine proof:** macierz F solidna; brak **minimal bundle** listy plików per CM (np. CM12b = installer log + resume json + RunOnce registry export); W-QA powinien mieć szablon evidence folder per CM-ID.
- [kompletność_briefu] **UNC/file share:** D2 unsupported + CM8 native — OK; dopisać CM8 **bez** `boot-heal.html` w release tree (WARN only).

## Kosmetyczne
- [kontekst] MAD 8/10 — jeszcze 2 rundy do min.
- [jednostka_miary] A0 PoC = **osobny gate** przed C — dobrze; dopisać budżet (max 2 PoC runs przed AskQuestion).
- [kompletność_briefu] Exit codes README — już w §1.6; OK.

## Werdykt
CONTINUE

*(MAD 8/10 — architektura R7 domknięta; R8 wymaga doprecyzowania Win32 manifest/a11y evidence, mutex canonical name, CRT `_internal`, RunOnce integrity przed CONVERGED.)*

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
