# Critique round 7

## READ wykonany
- [x] `agents/shared/planner-runs/.../brief.md` — ikony, Synology §7, installer §8, evidence-only, min_rounds 10
- [x] `agents/shared/planner-runs/.../planner-round-7-draft.md` — R7: native Go heal, launch token/HMAC, CGO=0/DPI/sign, CRT layout, vc_redist exit matrix
- [x] `agents/shared/planner-runs/.../planner-round-6-critique.md` — 5K baseline R6
- [x] `agents/shared/planner-runs/.../planner-round-6-response.md` — 13 ACCEPT / 0 REBUT
- [x] `agents/shared/planner-runs/.../planner-changelog.md` — R6→R7 changelog
- [x] `apps/desktop/launch.py` — mutex single-instance w app, nie w bootstrap
- [x] `apps/desktop/boot-heal.html` — dev fallback; R7 D16 OUT z release UX
- [x] Brak `apps/desktop/bootstrap/` — Go healer nie istnieje w repo
- [x] Brak `.cursor/agents/critic.md` w repo

## Ocena domknięcia 5K + 8W + 3Ko (R6→R7)

| ID R6 | Status R7 | Testowalność |
|-------|-----------|--------------|
| K1 browser heal | **Zamknięte** | D16 native Go dialog; zakaz ShellExecute browser |
| K2 dam-appw bypass | **Zamknięte częściowo** | token+pipe+CM-bypass exit 17; **klucz HMAC publiczny** = nie security |
| K3 Go build contract | **Zamknięte częściowo** | CGO=0, pin, DPI, signing matrix; **brak biblioteki GUI** |
| K4 CRT legal/hijack | **Zamknięte częściowo** | /layout z vc_redist; **hardening przed PyInstaller load** nieweryfikowalne |
| K5 vc_redist UAC/reboot | **Zamknięte częściowo** | 0/1638/3010, UAC deny; **brak resume po reboot** |
| W1–W8 | **Largely zamknięte** | lifecycle wait, no 8766, CM12a/b, CM5p kill, PS OUT, CM-manifest-corrupt |

**Podsumowanie:** R7 domyka większość R6, ale wprowadza **ryzyko wykonawcze** (natywny GUI Go bez stacku UI), **security theatre** (HMAC z kluczem derivable z BUILD_PROVENANCE) oraz luki lifecycle (bootstrap mutex, pipe timeout, installer 3010 resume).

## Krytyczne
- [ryzyko_modelowe] **Natywny Go GUI przy CGO=0 — brak wykonalnego stacku:** plan wymaga okna Win32 z logo, PL copy, 3 przyciskami, ale **nie nazywa biblioteki** (`walk`/`lxn/walk` syscall-only vs `webview` CGO) ani fallback gdy `CreateWindow` fail → dopisać HARD: wybrana lib + PoC w A0 (jeden dialog `missing_runtime` na Win11 125% DPI); brak PoC = STOP C; accessibility: min. **Tab order + keyboard Esc/Enter**, high-contrast readable text (nie tylko PNG logo).
- [weryfikacja] **Launch token/HMAC = reliability risk + security theatre:** `key = SHA256("DAM-LAUNCH-v1|gitRoot|git_sha")` jest **publiczny** (BUILD_PROVENANCE w payload) — każdy lokalny proces może forge token; plan sam mówi hidden≠security → **cel = UX anti double-click, nie ochrona** → uprościć do: pipe nonce ACK + `OpenProcess(parentPid)` + opcjonalnie `--dam-launched-by-bootstrap=1` bez HMAC **albo** jawnie oznaczyć w DoD „token ≠ security boundary”; **reliability:** timeout 5 s vs PyInstaller onefile extract (10–30 s cold) → false heal; dopisać timeout skalowany / wait na pipe connect bez heal do ACK; CM z **slow VM** obowiązkowy.
- [weryfikacja] **DLL hardening order vs dam-appw:** `SetDefaultDllDirectories` w bootstrap **nie chroni** PyInstaller bootloader `dam-appw.exe` (ładuje VC++/python DLL przed Pythonem) → wymagać: (A) early stub w PyInstaller `runtime hook` przed importami, **lub** (B) rezygnacja z onefile na `dam-appw` (onedir) + CRT w folderze; CM-hijack musi testować **dam-appw start**, nie tylko bootstrap; inaczej portable CRT copy do `python\` nie pomaga EXE bootloaderowi.
- [wspolbieznosc] **Single-instance tylko w launch.py:** brak mutexa w bootstrap — double-click `DAM.exe` = dwa pipe/token race / dwa dam-appw → dopisać bootstrap `CreateMutex` (ten sam `MUTEX_NAME` lub prefixed) przed spawn; exit codes: dokument macierzy 0/2/3/17/heal; CM1a **double-click bootstrap** expected = focus existing lub heal „już uruchomione”.
- [governance] **Installer 3010 bez resume:** block start OK, ale brak **Inno `[RunOnce]` / finish page „Uruchom ponownie installer po reboot”** i CM12b step — po reboot user nie wie co zrobić; dopisać ścieżkę resume (re-run installer idempotent) + evidence screenshot finish page 3010.

## Ważne
- [weryfikacja] **Q2=A unsigned — SmartScreen expectations:** macierz podpisu OK; Tier-A DoD musi explicit: **dwa** unsigned binaria (bootstrap + dam-appw) = SmartScreen ×2 przy pierwszym uruchomieniu; README + hash verify; Parent akceptuje w `parent-decisions.md` — nie mylić z „release correctness PASS”.
- [ryzyko_modelowe] **CRT `/layout` wersja vs dumpbin list:** lista DLL (concrt140_2, msvcp140_1…) zależy od wersji redist; skrypt extract musi **pin** redist build (14.4x) i diff vs `prep-dll-dependents.json`; FAIL gdy layout missing required DLL.
- [weryfikacja] **Token w env `DAM_LAUNCH_TOKEN`:** widoczny dla same-user process explorer — OK jeśli nie security; **nie** trafia do manifestu/logów; gate secret scan obejmuje env w log files.
- [weryfikacja] **Process lifecycle wait:** „prefer wait on dam-appw” — bootstrap zombie gdy app crash bez release mutex; dopisać: bootstrap exit gdy child exit <5 s z kodem ≠0 → native heal; integracja z `launch.py` mutex (dam-appw startuje launch który przejmuje mutex).
- [weryfikacja] **Synology/TLS/credentials:** CM3 Q3 SKIP≠PASS, TLS w logu, no migrate apply — spójne; doprecyzować CM3 **offline hint screenshot** przy Q7A (Tier-A deferred) — w R6 ważne, R7 nie powtarza w tabeli F.
- [weryfikacja] **CM5p kill:** wymienione; brak **rollback** gdy kill fail (locked DLL) → installer/portable upgrade abort + log; nie partial overwrite.
- [kompletność_briefu] **UNC/file share missing-engine:** D2 unsupported + CM8; native heal `missing_runtime` bez browser — OK; dopisać CM8 screenshot **native** heal (nie HTML).
- [ryzyko_modelowe] **Fallback rollback:** jeśli token/heal GUI regresja — archive previous portable z manifest; Parent może wymusić **temporary** Q2=B signing tylko bootstrap (mniejszy SmartScreen surface) — opcja w Q8 nie blokuje.

## Kosmetyczne
- [kontekst] MAD 7/10 — proces nadal trwa.
- [kompletność_briefu] `boot-heal.html` dev-only — gate może WARN jeśli obecny, nie FAIL (diagnostyka OK).
- [jednostka_miary] Exit code **17** — dopisać do README-START.txt dla support/IT.

## Werdykt
CONTINUE

*(MAD min_rounds 10: runda 7/10 — architektura stabilniejsza, wykonawczość token/GUI/DLL order wymaga R8.)*

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
