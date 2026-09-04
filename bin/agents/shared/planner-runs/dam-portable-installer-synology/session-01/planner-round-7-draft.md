# Planner round 7 draft — DAM portable installer + Synology

```yaml
name: DAM portable installer Synology
overview: >-
  Go bootstrap z natywnym healerem GUI (bez przeglądarki); jeden launch path
  dam-appw + signed nonce/pipe; pin Go CGO=0 DPI signing; portable CRT z oficjalnego
  vc_redist + DLL hardening; installer vc_redist z kodami 0/1638/3010 i UAC rollback;
  PREP allowlist/FREEZE/manifest; Tier-A/B; Q1–Q7.
plan_mode: create
revision: 1
draft_round: 7
revisedAt: 2026-08-11
plannerSession: dam-portable-installer-synology/session-01
canonical_plan_path: C:\Users\krzysztof.wieczorek\.cursor\plans\dam-portable-installer-synology.plan.md
isProject: false
status: DRAFT_R7_AWAITING_CRITIC
changelog_from_r6: 13 ACCEPT / 0 REBUT (K+W); 3 Kosmetyczne ACCEPT
```

## 0. Decyzje Plannera (jawne)

| ID | Decyzja |
|----|---------|
| D1 | Dev sync+smoke; ship tylko `release-gate.ps1`; provenance ≠ mtime. |
| D2 | Supported: instalacja (Q1) LUB kompletny portable NTFS. Unsupported: UNC niepełny. |
| D3 | Dist: `GIT_ROOT/dist/{prep,staging,release,evidence,manifests}`. Zakaz `bin/dist/`. |
| D4 | Synology prefer po D0 PI+KV + D2 + D2b + Parent APPROVAL. CM3 bez `migrate --apply` bez Parent. |
| D5 | Ikony logo DK: bootstrap EXE, shortcut, installer, uninstaller, taskbar (jeden AUMID app). |
| D6 | Evidence-only. |
| D7 | Redis lib only; CM13. |
| D8 | `build-release-zip.ps1` DEPRECATED. |
| D9 | Manifest two-phase + artifact bundle; portable zip = unpack hash. |
| D10 | PREP allowlist commit → FREEZE → copy-only. |
| D11 | Fat OUT; slim MUST + stubs. |
| D12 | **Public entry = tylko `DAM.exe` (Go).** Engine = `bin\runtime\win\dam-app\dam-appw.exe` z **launch-token contract** (§1.3). Brak dual spawn pythonw-or-appw. |
| D13 | Tier-A / Tier-B; Q7A + checkbox §7 deferred. |
| D14 | Budżety A0 + rolling 3 + hard caps + Parent >10%. |
| D15 | **Installer VC++:** bundled `vc_redist.x64.exe` (hash+Authenticode MS) + UAC + exit-code matrix §2.2. **Portable CRT:** app-local DLL **wyłącznie** z oficjalnego layout `vc_redist.x64.exe` (§2.1). |
| D16 | **Healer = natywne okno Go** (§1.2). `boot-heal.html` = **dev-only**, OUT ze ścieżki release UX; może zostać w tree jako diagnostyka. |
| D17 | Go build HARD §1.4; signing matrix §1.5; verify-signature w gate. |
| D18 | PS `dam-boot-host.ps1` / release `DAM.cmd` jako public entry = **OUT** payload (FAIL jeśli obecne jako skrót/target). |

---

## 0.1 Parent Q1–Q7 (rekomendacja A)

Bez zmian intencji. Blokady jak R6 + Q2 rozszerza listę binariów do podpisu (§1.5).

| Q | Blokuje | Nie blokuje |
|---|---------|-------------|
| Q1 | E3 install path, CM5/CM6, brief §8 | portable Tier-A, CM5p, CM12a |
| Q2 | expectation bez SmartScreen; signing gate gdy B | Tier-A lab z hash verify gdy A |
| Q3 | Tier-B CM3 online / D3 | Tier-A offline |
| Q4 | example LAN | DDNS primary |
| Q5 | sslmode implementacja B | TCP checklist; CM3 loguje tryb |
| Q6 | WebView2 dla CM1b/CM11 | native heal (bez WV2) |
| Q7 | Tier-B / §7 | Tier-A deferred |
| Q8 | CM12a/b FAIL×3 | gdy PASS |

---

## 1. Bootstrap + native healer + launch token

### 1.1 Technologia

| Pole | Wartość |
|------|---------|
| Język | **Go** pinned w `apps/desktop/bootstrap/go.mod` (np. `go 1.22.10` — dokładny patch w PREP evidence) |
| Build | `CGO_ENABLED=0` `GOOS=windows` `GOARCH=amd64` `-trimpath` `-ldflags="-H=windowsgui -s -w -X main.version=… -X main.gitSha=…"` |
| Modules | `go mod download` + verify `go.sum`; commit `go.mod`/`go.sum`; evidence module checksums |
| Resources | `dam_app.ico` + PNG logo DK embedded (`embed` / `rsrc`); versioninfo Company/Product/FileVersion |
| DPI | application manifest: `dpiAware` true + **PerMonitorV2** |
| End-user deps | Tylko Win10/11 x64 system DLLs; **brak** VC++ dla bootstrap; **brak** WebView2 dla heal |

### 1.2 Native healer UI (D16) — HARD

**Zakaz** `ShellExecute` default browser / `file://boot-heal.html` na ścieżce release.

Okno Win32 (ten sam proces `DAM.exe`, ten sam **AUMID** `Inyfinn.DAM.DobraKaloria.1`):

| Kontrolka | Zachowanie |
|-----------|------------|
| Logo | Embedded PNG z oficjalnego logo DK (nie fetch) |
| Tytuł + body | Polski copy per reason |
| **Ponów** | Retry checks + relaunch path |
| **Otwórz log** | Otwórz `bin\apps\desktop\launch-last-error.txt` w Notatniku (local path) |
| **Zamknij** | Exit 0 |

Reasons (copy PL): `missing_runtime`, `vcredist`, `webview2`, `corrupt_manifest`, `db_config`, `network`, default.

`boot-heal.html` — pozostaje w repo dla agentów/dev; **nie** jest wywoływane przez release bootstrap; gate nie wymaga go do CM-heal-*.

DB/network: bootstrap **nie** woła `:8765/:8766`. Status bazy = **post-UI** w aplikacji (`dam-db-status.js`). Bootstrap pokazuje `db_config` tylko gdy brak pliku konfiguracji na dysku (statyczny Test-Path), nie po TCP.

### 1.3 Jeden launch path + token contract (D12) — HARD

**Jedyna produkcyjna sekwencja:**

`DAM.exe` (bootstrap) → (checks OK) → spawn `bin\runtime\win\dam-app\dam-appw.exe` z tokenem → `dam-appw` startuje `launch.py` / silnik.

**Nie** ma ścieżki „bootstrap → pythonw bezpośrednio” w release (pythonw zostaje w tree dla dam-appw/internal).

#### Launch token protocol

1. Bootstrap generuje `nonce` (32 B random), `exp = now+60s`, czyta własny `pid`.  
2. Tworzy named pipe: `\\.\pipe\DAM-launch-{pid}-{nonceHex}` (ACL: current user only).  
3. Liczy `token = HMAC-SHA256(key, nonce|pid|exp|damAppwPath)` gdzie `key = SHA256("DAM-LAUNCH-v1|" + absoluteGitRoot + "|" + content of BUILD_PROVENANCE.git_sha)` (deterministyczny per build, nie sekret z sieci).  
4. Spawn:  
   `CreateProcess(dam-appw.exe, args: --dam-launch-pipe <name> --dam-launch-nonce <hex> --dam-parent-pid <pid>, cwd=desktop)`  
   z env `DAM_LAUNCH_TOKEN=<hex token>`.  
5. Bootstrap **czeka** na connected read ACK z pipe (timeout 5 s) albo fail → native heal default.  
6. Po ACK bootstrap może exit **lub** wait na process (prefer **wait** na dam-appw, żeby single-instance/UX; dokumentuj w kodzie).  

#### dam-appw enforcement

- Przy starcie: wymaga `--dam-launch-pipe`, `--dam-parent-pid`, `DAM_LAUNCH_TOKEN`.  
- Sprawdza `OpenProcess(parentPid)` żywy; czyta pipe; weryfikuje HMAC + `exp`; mismatch → **exit 17**, MessageBox natywny „Uruchom DAM przez DAM.exe” (nie browser).  
- **CM-bypass:** double-click `dam-appw.exe` bez args → exit 17 + MessageBox; evidence screenshot.  
- Hidden attribute / nietypowa ścieżka = UX only, **nie** mechanizm bezpieczeństwa.

### 1.4 Go build provenance

Plik `dist/evidence/bootstrap-build-provenance.json`:

```json
{
  "go_version": "go1.22.10",
  "cgo": false,
  "ldflags": "-H=windowsgui -s -w -trimpath ...",
  "go_mod_sha256": "...",
  "go_sum_sha256": "...",
  "source_tree_sha256": "...",
  "output_dam_exe_sha256": "...",
  "dpi_manifest": "PerMonitorV2",
  "built_at": "ISO"
}
```

Reproducibility: ten sam commit + pinned Go → ten sam hash (modulo signing). Gate FAIL gdy CGO≠0 lub brak `-H=windowsgui`.

### 1.5 Signing matrix (Q2)

| Binary | Podpis |
|--------|--------|
| `DAM.exe` bootstrap | Authenticode (gdy Q2=B) lub hash-only (Q2=A) |
| `dam-appw.exe` | j.w. |
| Installer `.exe` | j.w. |
| `vc_redist.x64.exe` | **tylko weryfikacja podpisu Microsoft** (nie re-sign) |

`verify-signature.ps1` w gate: gdy Q2=B FAIL unsigned launcher/engine/installer; zawsze FAIL gdy vc_redist bez ważnego sig MS lub hash ≠ pinned w `dist/prep/vc_redist.sha256`.

---

## 2. CRT + vc_redist

### 2.1 Portable app-local CRT (legal)

**Źródło:** wyłącznie oficjalny `vc_redist.x64.exe` (URL Microsoft / cached w `bin/tooling/downloads` z hash pin).

**Procedura PREP (HARD):**
1. Verify Authenticode + SHA256 pin.  
2. Ekstrakcja Microsoft-supported: `vc_redist.x64.exe /layout <dir> /quiet` **lub** równoważna udokumentowana ekspansja kabinetów z redist (zapisać dokładną komendę w `scripts/ops/extract-vcruntime-app-local.ps1`).  
3. Skopiuj **exact list** (x64) do `bin/runtime/win/python\`:  
   `vcruntime140.dll`, `vcruntime140_1.dll`, `msvcp140.dll`, `msvcp140_1.dll`, `msvcp140_2.dll`, `concrt140.dll` (jeśli obecne w layout dla używanej wersji toolset — lista finalna = output skryptu + FAIL gdy brak wymaganego z dumpbin).  
4. **Zakaz** kopiowania z `System32`.  
5. `THIRD_PARTY_NOTICES.txt` += Microsoft Visual C++ Redistributable notice + wersja redist.

**DLL search hardening (bootstrap + dam-appw early):**
- `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32 | LOAD_LIBRARY_SEARCH_USER_DIRS)`  
- `AddDllDirectory(absolute path to python dir)`  
- CRT existence check via **absolute** `LoadLibraryEx(W)` path.  
- **CM-hijack:** katalog roboczy ze spoof `vcruntime140.dll` → proces **nie** ładuje spoof (evidence Process Monitor / ListDlls).

### 2.2 Installer vc_redist

| Case | Handling |
|------|----------|
| Exit **0** | Success → kontynuuj install app |
| Exit **1638** | Nowsza wersja już zainstalowana → **OK**, kontynuuj |
| Exit **3010** | Success, reboot required → pokaż UI „Wymagany restart”; **block** start DAM do reboot **lub** Parent policy „soft continue” zapisana w decisions (default: **block start**, allow Finish) |
| UAC **Deny** | Rollback kroku redist; **nie** rejestruj app jako gotowej; native message; exit installer fail; **no launch** |
| Inny ≠0 | Log + fail install; no launch |
| Offline | Redist w `[Files]`; zero download |

Przed Run: verify hash+MS signature of bundled redist.  
Uninstall app (**CM6**): **nie** usuwa systemowego VC++ (jawne w DoD); usuwa skróty + binaria app.

### 2.3 CM12 split

- **CM12a** portable: app-local CRT + hijack test + no system VC++.  
- **CM12b** installer offline: bundled redist; UAC deny lab; 1638/3010 simulation where feasible.

---

## 3. PREP / FREEZE / MUST / budgets

Jak R6 §3 z dopiskami:
- BUILD_PROVENANCE zawiera `bootstrap_sha`, `dam_appw_sha`, `post_sync_web_snapshot_sha256`, `freeze_commit`.  
- Staging binary secret scan (strings).  
- SBOM: pip freeze z site-packages + PyInstaller version pin w provenance.  
- Payload FAIL jeśli zawiera `dam-boot-host.ps1` jako release entry lub shortcut do niego.

---

## 4. Ownership

| Worker | WRITE |
|--------|-------|
| W-Runtime | `apps/desktop/bootstrap/**` (Go), dam-appw token verify stub/wrapper, heal UI, DLL hardening, extract-vcruntime script |
| W-Pack | gate, Inno+vc_redist, manifests, signing verify, dist/** |
| W-Icons | ico + embed PNG |
| W-DB | PI, DB templates, prefer |
| W-QA | CM matrix evidence |

---

## 5. Plan wykonawczy (skrót)

**A0** size+latency+CM1-profile (no-python-PATH = brak system Python; embed OK).  
**A1** Q1–Q7.  
**B1** ico/logo embed.  
**C** Go bootstrap+native heal; dam-appw token; CGO=0 provenance; CRT extract; signing prep.  
**D** PI/DB/DDNS/TLS.  
**E** PREP allowlist → FREEZE → gate (signature verify, bypass test harness) → installer redist matrix → manifests.  
**F** CM matrix poniżej.  
**G** Tier sign-off.

### F — Clean-machine (kluczowe)

| ID | Expected |
|----|----------|
| CM1a | Bootstrap DAM.exe; native heal lub start; **no browser**; no console; no system Python PATH |
| CM-bypass | dam-appw double-click → exit 17 + MessageBox |
| CM-manifest-corrupt | 1-byte flip → native heal `corrupt_manifest` |
| CM-heal-* | Native dialog screenshot per reason (logo DK) |
| CM7a–d / CM7e | Icons + AUMID + no console |
| CM-hijack | Spoof CRT not loaded |
| CM12a / CM12b | Portable CRT / installer redist matrix |
| CM5p | Kill pythonw/bridge/dam-appw before overwrite; preserve `apps/desktop/data` |
| CM5/CM6 | Po Q1; uninstall removes shortcuts; keeps user env files; leaves VC++ |
| CM3 | Tier-B; TLS mode logged; no migrate apply; Q3 required else SKIP≠PASS |
| CM4/CM4b | Before Tier-B ship |
| CM8–13, CM9a–e | jak R6 + latency baseline ms |

---

## 6. Todos (po CONVERGED)

- `step-A0-baseline`
- `step-A1-parent-q`
- `step-C-go-bootstrap-native-heal`
- `step-C-launch-token-dam-appw`
- `step-C-go-build-pin-dpi-sign`
- `step-C-crt-extract-harden`
- `step-E-prep-freeze-gate`
- `step-E3-vcredist-exitcodes`
- `step-F-cm-bypass-hijack-heal`
- `step-G-tier-signoff`

---

## 7. DoD

### Tier-A
- [ ] Native heal only (no browser path)  
- [ ] Launch token enforced; CM-bypass PASS  
- [ ] Go provenance CGO=0 + DPI + signing/hash per Q2  
- [ ] Portable CRT from official redist + hijack PASS  
- [ ] Installer redist 0/1638/3010 + UAC deny no-launch  
- [ ] PREP allowlist; FREEZE; manifests; PS host OUT  
- [ ] CM5p kill+preserve; CM7e; CM9  
- [ ] Parent §7 deferred **lub** Tier-B  

### Tier-B
- [ ] CM3+CM4b; Q3 procedure; D3 APPROVAL  

### Brief §8
- [ ] Q1+CM5+CM6  

---

## 8–10. Rollback / Guardrails / Kontrakt

Rollback: archive installer/portable; preserve user data; FREEZE restart.  

Guardrails: no browser heal; no tokenless dam-appw; no System32 CRT copy; no launch after UAC deny; no `:876x` in bootstrap heal; no `git add -A`; MAD min 10.  

Wykonawca: A→G; 3× fail → ESCALATE; po CONVERGED UPDATE `canonical_plan_path` only.

---

## 11. Notatki dla Critica (round 7)

Sprawdź: native heal controls; token/pipe contract; Go pin/DPI/sign; CRT extract legality+hijack; vc_redist exit/UAC/reboot; CM12a/b; lifecycle kill; no 8766 in bootstrap; PS OUT.

## Werdykt Plannera

Draft R7 gotowy na **Critic round 7**. Kanon nie tworzony. 0 REBUT / brak tie. MAD 7/10.
