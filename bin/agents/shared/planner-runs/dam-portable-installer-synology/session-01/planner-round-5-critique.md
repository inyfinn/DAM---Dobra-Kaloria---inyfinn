# Critique round 5

## READ wykonany
- [x] `agents/shared/planner-runs/.../brief.md` — §7 Synology, §8 installer na innym PC, regresje preview/quiz/gazetka, min_rounds 10
- [x] `agents/shared/planner-runs/.../planner-round-5-draft.md` — R5: PS boot-host, A0 budgets, MUST §3.1, PREP→commit→FREEZE, Tier-A/B
- [x] `agents/shared/planner-runs/.../planner-round-4-critique.md` — 3K baseline R4
- [x] `agents/shared/planner-runs/.../planner-round-4-response.md` — 11 ACCEPT / 0 REBUT
- [x] `agents/shared/planner-runs/.../planner-changelog.md` — R4→R5 changelog
- [x] `apps/desktop/boot-heal.html` — brak `reason=vcredist`; brak logo DK; generic Segoe UI heal
- [x] `apps/desktop/dam_root_launcher.py` — spawn `launch.py` bez VC++ check; bypass boot-host
- [x] `bin/scripts/ops/install-desktop-shortcut.ps1` — target preferuje `DAM.exe`, nie `DAM.cmd`; brak ukrycia konsoli
- [x] `memory.md` — fat ~340MB OUT; branding-search ~41MB; PI launcher DAM.exe/DAM.cmd
- [x] Brak `dam-boot-host.ps1` / root `DAM.cmd` w repo (plan C6 — nie zaimplementowane)

## Ocena domknięcia 3K + 8W + 3Ko (R4→R5)

| ID R4 | Status R5 | Testowalność |
|-------|-----------|--------------|
| K1 PyInstaller vs CM1a | **Zamknięte częściowo** | CM1a-boot → `DAM.cmd`/PS host; **DAM.exe nadal w payload i shortcut preferuje exe** — bypass D15 |
| K2 budżety bez baseline | **Zamknięte częściowo** | A0 + formula + caps 100/120/800; **single-sample**, brak rolling/history w gate |
| K3 MUST slim + file-index PREP | **Zamknięte częściowo** | §3.1 rozbudowana; **secrets/generated/local** w MUST nie rozdzielone; commit PREP bez allowlist git |
| W1–W8 | **Largely zamknięte** | freeze=prep_commit, zip hash, Tier deferred checkbox, CM3 pack, CM9a threshold, SBOM PREP |
| Ko1–Ko3 | **Zamknięte** | PS zamiast DAM_BOOT_PROBE; min_rounds |

**Podsumowanie:** architektura boot-host rozwiązuje główny problem R4, ale **spójność end-user entry (exe vs cmd), heal vcredist/branding, shortcut/console/AUMID, PREP commit hygiene i VC++/dumpbin offline** pozostają luki testowalne.

## Krytyczne
- [weryfikacja] **DAM.exe bypass boot-host:** payload nadal zawiera `DAM.exe`; `dam_root_launcher.py` startuje `launch.py` bez VC++ gate; `install-desktop-shortcut.ps1` preferuje `DAM.exe` — użytkownik na czystym PC omija `dam-boot-host.ps1` i wraca do crash PyInstaller przed heal → HARD: albo (A) `DAM.exe` stub wyłącznie deleguje do `DAM.cmd`/boot-host, albo (B) shortcut/installer **tylko** `DAM.cmd` + gate FAIL gdy skrót wskazuje exe bez VC++ PASS; CM12/CM1a-boot muszą testować **oba** wejścia lub exe musi być OUT z domyślnego UX.
- [weryfikacja] **Heal „branded” + vcredist na PS path:** `boot-heal.html` **nie ma** `reason=vcredist` (wpada w generic); brak logo DK (brief §6 ikony ≠ heal page) — boot-host planuje `?reason=vcredist` ale UI tego nie obsługuje → C3 MUST dodać gałąź vcredist + CM1a/CM12 screenshot z oczekiwanym tytułem/CTA; doprecyzować czy „branded healer” = logo SVG w HTML (inaczej CM evidence ≠ brief).
- [weryfikacja] **Skrót → DAM.cmd: ikona OK, konsola i AUMID nie:** `.cmd` + `powershell -File` = **flash konsoli** bez `start /min` / VBS wrapper; AUMID w `launch.py` nie dotyczy procesu cmd/ps; CM7b wymaga pin taskbar **aplikacji**, nie tylko `.lnk IconLocation` → dopisać: shortcut przez `run-dam.vbs` (styl 1) lub Inno `[Run]` hidden; CM7b evidence = taskbar po starcie **UI** (pythonw), nie sam skrót; osobny CM7e „no console flash” (nagranie/log brak okna cmd).
- [wspolbieznosc] **PREP `git commit` może wciągnąć secrets/local:** krok 9 „add plików wygenerowanych w apps/web/data/” bez **git add allowlist** — ryzyko commit `dam-runtime.json`, sqlite, `.env` jeśli obecne → PREP commit = wyłącznie enumerated MUST slim JSON z §3.1; explicit `git reset`/`git check-ignore` gate; FREEZE nigdy nie commituje `apps/desktop/data/**`, sqlite, oauth; evidence `prep-commit-files.txt`.
- [ryzyko_modelowe] **VC++ bootstrap bez admina / offline:** plan mówi installer bootstrap przed app, ale brak: (1) per-user vs per-machine redist, (2) **offline** artefakt redist w payload/installer, (3) CM na VM **bez sieci** po instalacji → dopisać Q-path: portable Tier-A offline = heal vcredist + link; installer offline = **MUST** bundle `vc_redist.x64.exe` w Inno `[Files]`; CM12/CM5 test offline subset; bez admina = per-user redist lub dokumentowany FAIL + Parent Q8.

## Ważne
- [weryfikacja] **PowerShell 5.1 host — edge paths:** plan podaje `%GIT_ROOT%\bin\apps\desktop\dam-boot-host.ps1` bez **quoted paths** przy spacjach w GIT_ROOT (CM2); brak **Zone.Identifier** / MOTW unblock po copy portable z internetu (pliki mogą być zablokowane — heal/PS fail); brak testu **ExecutionPolicy Restricted** na domyślnym profilu (Bypass tylko na `-File` — OK, ale dopisać CM1a log `$ExecutionContext.SessionState.LanguageMode`); UTF-8: PS komunikaty/heal PL — wymagać `-Encoding UTF8` / BOM w `.ps1`.
- [weryfikacja] **dumpbin audit wąski:** PREP tylko `DAM.exe` + `pythonw.exe` — nie obejmuje `python312.dll`, `python3.dll`, `clr.dll`/`pythonnet`, `psycopg2._psycopg*.pyd`, PyInstaller `_internal` extract set → rozszerzyć audit na **top-N DLL** z `bin/runtime/win/python` + `_MEI*` extract test onefile; evidence `prep-dll-dependents.json`; FAIL jeśli wymagany VC++ a `vc_self_sufficient=false`.
- [zasoby] **Budżety nadal single-sample:** formula `max*1.25+5` OK dla v1, ale brak **historycznego porównania** (artifact N vs N-1 w `dist/release/archive/`) i brak zapisu „approval cap” w `parent-decisions.md` gdy hard cap 100/120/800 przekroczony przez wzrost indeksu → A0 dopisać rolling max 3 ostatnie PREP; gate WARN gdy >10% wzrost vs poprzedni release bez Parent checkbox.
- [zasoby] **MUST lista vs generated/local:** `tag-proposals.json`, `inbox-items.json`, `app-settings.json` — MUST IN ale mogą być **puste szablony** w release (nie live user queue z dev machine); PREP MUST generować **release-sane stubs** lub exclude non-empty inbox z payload; secrets scan CM10 obowiązkowy na tych plikach.
- [weryfikacja] **build-file-index.py PREP** wymaga dostępu do dysku Marketing (`X:/`/`D:/`) — na izolowanym build VM może FAIL / wygenerować pusty index → PREP offline smoke (krok 7) MUST assert `file-index.json` count > threshold lub Parent APPROVAL „ship with cached index” wpisany w `prep_commit` message.
- [weryfikacja] **Dowody screenshot — luki:** brak jawnego CM dla **missing_runtime** screenshot z heal (CM1a pokrywa częściowo); brak **CM7e no-console**; CM9a threshold „1.5× baseline” bez zapisanego baseline ms w A0 (tylko size baseline) → A0 dodać `branding-cold-latency-ms` z jednego lokalnego pomiaru; CM3 pack OK ale brak wymogu screenshot **offline hint** przy Tier-B fail→Q7A.
- [governance] **Portable update/uninstall vs installer:** CM5/6 SKIP Tier-A OK; brak **portable upgrade path** (nadpisanie folderu + zachowanie `apps/desktop/data` user) w macierzy — brief §8 częściowo tylko przez Q1; dopisać CM5p portable overwrite policy lub explicit OUT of scope z Parent sign-off.
- [eskalacja] **Synology Tier-B spójność:** D3 prefer + CM3 wymaga Q3 credentials na VM-B — plan OK; doprecyzować CM3 **nie uruchamia** migrate `--apply` bez Parent; rollback SQLite CM4b evidence nadal wymagane przed Tier-B ship.

## Kosmetyczne
- [kontekst] Tabela rozmiarów §2 „seed 2026-08-11” — nie zastępuje formalnego A0 artifact (plan to mówi; OK).
- [kompletność_briefu] `branding-search-index.json` builder nie jest osobnym krokiem PREP (krok 5 „jeśli osobny skrypt”) — doprecyzować nazwę skryptu lub „preserve + freshness mtime”.
- [jednostka_miary] MAD 5/10 — werdykt CONTINUE procesowy niezależnie od 0K treściowych (zgodnie z brief).

## Werdykt
CONTINUE

*(MAD min_rounds 10: runda 5/10 — debata procesowa trwa nawet przy domknięciu krytycznych w R6.)*

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
