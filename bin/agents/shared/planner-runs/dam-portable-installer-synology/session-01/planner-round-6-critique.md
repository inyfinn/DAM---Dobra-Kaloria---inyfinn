# Critique round 6

## READ wykonany
- [x] `agents/shared/planner-runs/.../brief.md` — §6 ikony, §7 Synology, §8 installer, regresje preview, min_rounds 10
- [x] `agents/shared/planner-runs/.../planner-round-6-draft.md` — R6: Go GUI bootstrap, ukryty dam-appw, heal 6 reasons, app-local CRT, PREP allowlist
- [x] `agents/shared/planner-runs/.../planner-round-5-critique.md` — 5K baseline R5
- [x] `agents/shared/planner-runs/.../planner-round-5-response.md` — 13 ACCEPT / 0 REBUT
- [x] `agents/shared/planner-runs/.../planner-changelog.md` — R5→R6 pivot PS→Go
- [x] `apps/desktop/boot-heal.html` — brak vcredist/corrupt_manifest/db_config (plan C3 ma naprawić)
- [x] `apps/desktop/dam_root_launcher.py` / brak `apps/desktop/bootstrap/` — Go bootstrap nie istnieje w repo
- [x] `apps/desktop/launch.py` — mutex single-instance; AUMID tylko po starcie UI
- [x] Brak `.cursor/agents/critic.md` w repo

## Ocena domknięcia 5K + 8W + 3Ko (R5→R6)

| ID R5 | Status R6 | Testowalność |
|-------|-----------|--------------|
| K1 exe bypass | **Zamknięte częściowo** | Jeden publiczny Go `DAM.exe`; **dam-appw nadal w filesystem** — bypass poza skrótem |
| K2 heal branded | **Zamknięte częściowo** | 6 reasons + logo w planie; **heal = ShellExecute browser**, nie Go GUI |
| K3 console/AUMID | **Zamknięte częściowo** | windowsgui + CM7e/7b; **dwa AUMID** bootstrap vs app; heal w przeglądarce |
| K4 PREP git | **Zamknięte** | allowlist + zakaz `git add -A` + prep-commit-files.txt |
| K5 VC++ offline | **Zamknięte częściowo** | installer bundle+UAC; portable app-local CRT; **UAC deny/reboot/DLL order** niedoprecyzowane |
| W1–W8 | **Largely zamknięte** | rolling budget, stubs, CM5p, CM3 no apply, dumpbin top-N, CM7e, latency A0 |

**Podsumowanie:** pivot na Go bootstrap domyka R5 entry/bypass w UX skrótów, ale wprowadza **nowe luki**: heal przez przeglądarkę, ukryty dam-appw discoverable, brak CGO=0/DPI/signing/supply-chain matrix, CRT legal/search order, process lifecycle upgrade/kill.

## Krytyczne
- [weryfikacja] **Heal ≠ self-contained Go GUI:** §1.2 otwiera heal przez **default browser** (`file://` boot-heal.html) — to **otwiera kartę Edge/Chrome**, psuje spójność AUMID/taskbar (CM7b), nie spełnia „branded healer bez WebView2/backendu” w sensie produktowym → albo (A) natywny mini-dialog Win32 w bootstrap (logo DK + reason + CTA), albo (B) jawna decyzja Parent: heal = browser OK + CM-heal-* mierzy **kartę przeglądarki** (nie app); zakaz mylenia z CM1b UI WebView2.
- [weryfikacja] **`dam-appw.exe` omijalny:** ścieżka `bin\runtime\win\dam-app\dam-appw.exe` jest discoverable w Explorerze; gate sprawdza tylko skróty → dopisać: atrybut hidden **nie wystarczy**; CM **CM-bypass** = double-click dam-appw musi **fail gate policy** (heal/redirect) lub installer portable **nie zawiera** dam-appw gdy ścieżka produkcyjna = wyłącznie pythonw (usunąć dual path §1.2 krok 7 „albo dam-appw”); jedna ścieżka spawn: bootstrap → pythonw+launch.py **tylko**.
- [ryzyko_modelowe] **Go bootstrap build contract niekompletny:** brak HARD `CGO_ENABLED=0`, `-ldflags "-H windowsgui"`, `-trimpath`, pinned `go.mod`/`go.sum`, **DPI awareness** (`SetProcessDpiAwarenessContext` / manifest `dpiAware`), per-monitor v2 dla ikony taskbar; SmartScreen/signing: brak macierzy **co podpisać** (bootstrap, dam-appw jeśli zostaje, installer, opcjonalnie vc_redist MS-signed only) → PREP evidence `bootstrap-build-provenance.json` (go version, ldflags, module hash); Q2 musi listować 3 binaria.
- [ryzyko_modelowe] **App-local CRT — legalność + hijacking:** kopiowanie `vcruntime140*.dll` do `python\` wymaga **ekstrakcji z oficjalnego vc_redist** (nie kopi z System32), wersja match x64, wpis licencji MS w THIRD_PARTY; brak **DLL search hardening** (`SetDefaultDllDirectories`, brak load z CWD/UNC) → CM12 + static audit: uruchom z katalogu ze spoof DLL obok — must not load wrong DLL; FAIL portable stage gdy brak weryfikacji źródła CRT.
- [weryfikacja] **Installer vc_redist: UAC deny / reboot / offline:** `/quiet /norestart` bez ścieżki gdy user **Anuluje UAC** lub redist wymaga reboot → dopisać CM12: (1) offline install bez sieci, (2) UAC deny → heal/rollback installer step (nie half-installed app), (3) exit code redist ≠0 → log + block start DAM.exe; CM6 uninstall policy: czy odinstalowanie app zostawia VC++ (typowo tak) — jawne w DoD.

## Ważne
- [weryfikacja] **Process lifecycle bootstrap → app:** brak kontraktu: bootstrap exit vs wait; współpraca z `acquire_single_instance()` w launch.py; **CM5p upgrade** musi **kill** pythonw/bridge przed nadpisaniem tree (inaczej locked DLL); dopisać krok PREP/gate + CM5p evidence `tasklist` before/after.
- [weryfikacja] **§1.2 krok 8 vs guardrail:** „lekki check bridge :8766” dla db/network koliduje z „Nigdy heal zależny od :8765/:8766” — ograniczyć do **post-UI** status w aplikacji, nie bootstrap heal; bootstrap heal tylko statyczny HTML reason.
- [weryfikacja] **Supply-chain PyInstaller + Go:** brak SBOM/pin dla PyInstaller, pip lockfile w vendor-runtime, hash `dam-appw.exe` w manifest obok bootstrap; secret scan scope — rozszerzyć o `dist/staging` binaries scan (strings grep password patterns).
- [zasoby] **PREP allowlist vs bootstrap source:** commit allowlist dotyczy tylko `apps/web/data/**`; zmiany `apps/desktop/bootstrap/**` idą normalnym git flow — doprecyzować: release gate wymaga **bootstrap SHA** w BUILD_PROVENANCE obok web snapshot.
- [weryfikacja] **CM5p / CM6 secrets:** preserve `apps/desktop/data` przy upgrade — OK; CM6 uninstall musi assert **skróty usunięte**, **pg-config/dam-connection.env** w user data **pozostają** (gitignored) z README ostrzeżeniem; CM10 scan po CM5p.
- [governance] **Synology Tier-B:** D4/CM3/CM4b spójne; doprecyzować CM3 evidence: TLS mode z Q5 w logu (tcp vs ssl); migrate dry-run artifact redact; **Tier-B nadal wymaga Q3** — CM3 SKIP nie PASS bez credentials procedure.
- [weryfikacja] **Evidence matrix luki:** CM-heal-* w browserze — OK jeśli decyzja; brak **CM-manifest-corrupt** automated (synthetic flip 1 byte + bootstrap step 3); CM9a latency wymaga zapisanego **baseline ms** w A0 (plan ma) + CDP mark w evidence; **CM-no-python-PATH** = VM bez python w PATH ale **z** embed pythonw (CM1a) — nazwa testu doprecyzować w CM1-profile.
- [sekwencja] **Pivot R5→R6:** R5 cały PS boot-host w changelog obsolete — guardrail: usuń/wyłącz `dam-boot-host.ps1` z release payload; dev-only dokumentacja żeby wykonawca nie implementuje obu ścieżek.

## Kosmetyczne
- [kompletność_briefu] §1.1 „Go Win32 GUI” vs heal HTML — niespójna terminologia „GUI bootstrap”.
- [kontekst] MAD 6/10 — proces trwa (zgodnie z brief).
- [jednostka_miary] CM12 łączy portable app-local CRT i installer redist — rozważ split CM12a/CM12b dla bisect.

## Werdykt
CONTINUE

*(MAD min_rounds 10: runda 6/10 — brak konwergencji procesowej mimo postępu architektury.)*

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
