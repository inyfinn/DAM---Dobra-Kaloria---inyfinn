# Planner round 8 draft — DAM portable installer + Synology

```yaml
name: DAM portable installer Synology
overview: >-
  Go bootstrap Win32 CGO=0 (x/sys/windows) z A0 PoC gate; native heal; reliability
  handshake (nonce+pipe+heartbeat, bez HMAC); engine onedir + app-local CRT;
  bootstrap mutex first; installer 3010 resume/RunOnce; PREP/FREEZE/manifest;
  Tier-A/B Synology; Q1–Q7.
plan_mode: create
revision: 1
draft_round: 8
revisedAt: 2026-08-11
plannerSession: dam-portable-installer-synology/session-01
canonical_plan_path: C:\Users\krzysztof.wieczorek\.cursor\plans\dam-portable-installer-synology.plan.md
isProject: false
status: DRAFT_R8_AWAITING_CRITIC
changelog_from_r7: 13 ACCEPT / 0 REBUT (K+W); 3 Kosmetyczne ACCEPT
```

## 0. Decyzje Plannera (jawne)

| ID | Decyzja |
|----|---------|
| D1 | Dev sync+smoke; ship tylko `release-gate.ps1`; provenance ≠ mtime. |
| D2 | Supported: instalacja (Q1) LUB kompletny portable NTFS. Unsupported: UNC niepełny. |
| D3 | Dist: `GIT_ROOT/dist/{prep,staging,release,evidence,manifests}`. Zakaz `bin/dist/`. |
| D4 | Synology prefer po D0 PI+KV + D2 + D2b + Parent APPROVAL. CM3 bez migrate apply. |
| D5 | Ikony logo DK; jeden AUMID `Inyfinn.DAM.DobraKaloria.1`. |
| D6 | Evidence-only. |
| D7 | Redis lib only; CM13. |
| D8 | `build-release-zip.ps1` DEPRECATED. |
| D9 | Manifest two-phase + artifact bundle; portable zip = unpack hash. |
| D10 | PREP allowlist commit → FREEZE → copy-only. |
| D11 | Fat OUT; slim MUST + stubs. |
| D12 | Public entry = `DAM.exe` (Go). Engine = **onedir** `bin\runtime\win\dam-app\` (`dam-appw.exe` + deps). |
| D13 | Tier-A / Tier-B; Q7A + §7 deferred checkbox. |
| D14 | Budżety A0 + rolling 3 + hard caps. |
| D15 | Installer: bundled `vc_redist.x64.exe` + §2.2 resume. Portable: app-local CRT z oficjalnego layout; **nie** instaluje redist. |
| D16 | Native heal Win32 w bootstrap; `boot-heal.html` = dev (WARN jeśli obecny, nie FAIL). |
| D17 | Go: CGO=0, pin modules, DPI PerMonitorV2, signing matrix, verify gate. |
| D18 | PS boot-host / DAM.cmd public entry OUT. |
| D19 | **GUI stack HARD:** `golang.org/x/sys/windows` + własne cienkie wrappery CreateWindow/GDI (pinned w go.mod). **A0 PoC gate** przed fazą C pełną. |
| D20 | **Handshake = reliability only** (§1.3). HMAC usunięty. |
| D21 | **Bootstrap mutex first** (§1.5). Engine mutex = defense-in-depth. |

---

## 0.1 Parent Q1–Q7 (rekomendacja A)

| Q | Blokuje | Nie blokuje |
|---|---------|-------------|
| Q1 | E3 path, CM5/CM6, brief §8 | portable, CM5p, CM12a |
| Q2 | SmartScreen-free expectation; gdy B — sign bootstrap+engine+installer | Tier-A z hash gdy A + **Parent checkbox SmartScreen×2** |
| Q3 | Tier-B CM3 / D3 | Tier-A |
| Q4 | example LAN | DDNS |
| Q5 | sslmode B | TCP + CM3 log mode |
| Q6 | CM1b/CM11 WV2 | native heal |
| Q7 | Tier-B / §7 | Tier-A deferred + offline hint screenshot |
| Q8 | CM12a/b FAIL×3 | PASS path |

**PoC FAIL AskQuestion (tylko gdy A0 PoC padnie):**  
- **A (rekomendacja):** retry Win32 wrapper (bugfix) + 1 dodatkowy PoC przebieg  
- **B:** inny CGO-free stack Parent-approved (nazwany w odpowiedzi)  
- **C:** inne  

---

## 1. Bootstrap / GUI / handshake / mutex

### 1.1 GUI stack (D19) + A0 PoC gate

| Element | Spec |
|---------|------|
| API | Win32 przez **`golang.org/x/sys/windows`** (pinned version w `go.mod`/`go.sum`) |
| Wrappery | Własne pliki w `apps/desktop/bootstrap/win32/` — CreateWindowEx, message loop, static/button, LoadImage z embed PNG, SetWindowTextW (UTF-16 PL) |
| CGO | **0** zawsze |
| Zakaz | `webview`, `walk` jeśli wymaga CGO, Electron, browser heal |

**A0 PoC (STOP przed pełnym C jeśli FAIL)** — artefakt `dist/evidence/a0-gui-poc/`:

1. Native window (title PL ze znakami).  
2. Embedded logo DK widoczne.  
3. PerMonitorV2 @ 125% DPI (screenshot).  
4. Tab order: logo → body → Ponów → Log → Zamknij; Enter=Ponów, Esc=Zamknij.  
5. Screen-reader: `SetWindowText` + accessible names na buttonach (MSA A / UIA minimal: button text).  
6. No console (`-H=windowsgui`).  
7. Clean VM Win10/11 bez VC++/Python.  

PoC PASS → odblokuj C. PoC FAIL → AskQuestion powyżej (nie kontynuuj implementacji heal/GUI).

### 1.2 Native healer

Jak R7 kontrolki (logo, PL copy, Ponów/Log/Zamknij); reasons bez zmian. Zero browser/WebView2/backend.

### 1.3 Launch handshake — reliability (D20)

#### Threat / non-threat (jawne)

| Non-threat (NIE obiecujemy) | Threat/goal (obiecujemy) |
|-----------------------------|---------------------------|
| Ochrona przed złośliwym lokalnym userem / forge token | Zapobieganie przypadkowemu double-click `dam-appw.exe` (UX) |
| Security boundary / DRM | Nie spawn drugiego silnika gdy bootstrap już działa |
| HMAC z publicznego git_sha | Nie false-heal przy wolnym cold start (do 60s) |

#### Protocol

1. Bootstrap (po mutex + checks) tworzy named pipe ACL = current user only.  
2. Generuje **per-launch random nonce** (32 B) **tylko w pamięci** (nie zapis na dysk, nie do BUILD_PROVENANCE, nie do logów).  
3. Przekazuje nonce do engine przez **inherited pipe handle** (prefer) i/lub env `DAM_LAUNCH_NONCE` (ephemeral).  
4. Spawn `dam-appw.exe` **absolute path**, args: `--dam-launch-pipe … --dam-parent-pid …`.  
5. Engine bez poprawnego handshake (pipe ACK + parent alive + nonce match) → **exit 17** + MessageBox PL.  
6. **Timeout:** heartbeat na pipe co ≤2 s; **max 60 s** na cold start/extract (onedir zwykle szybszy); brak ACK → native heal default (nie po 5 s).  
7. **CM-slow-VM** obowiązkowy (timeout nie false-positive).

### 1.4 Engine package = onedir (D12/K3)

| Pole | Spec |
|------|------|
| Layout | `bin\runtime\win\dam-app\dam-appw.exe` + `_internal\` / deps **obok** (PyInstaller **onedir**, nie onefile) |
| CRT | App-local DLL **w tym samym katalogu co dam-appw.exe** (engine dir), nie tylko w `python\` |
| Spawn | Bootstrap: `CreateProcess(W absoluteEnginePath)`, `lpCurrentDirectory` = engine dir **lub** desktop dir jawnie; czyści niebezpieczne env (np. nie dziedzicz `PYTHONPATH` spoza tree) |
| Loader | Nie polegamy na dziedziczeniu `SetDefaultDllDirectories` z bootstrap → engine dir layout + opcjonalnie application manifest `LoadFromApplicationDir`; CRT obok exe wystarcza dla Windows loader search order app-dir first |
| Hijack CM | Spoof `vcruntime140.dll` w **cwd**, **PATH**, **TEMP** przy starcie **dam-appw** — must not load spoof |

### 1.5 Single-instance (D21)

**Pierwsza operacja** w `DAM.exe` (przed UI/checks spawn):

`CreateMutexW(NULL, FALSE, L"Local\\Inyfinn.DAM.DobraKaloria.Singleton")`

| Wynik | Akcja |
|-------|-------|
| New owner | Kontynuuj checks → handshake → spawn engine |
| Already exists | **Nie spawn**; wyślij activate signal (named event `…Activate` lub pipe command `ACTIVATE`); exit 0 |
| Error | Native heal default |

Engine/`launch.py` mutex = **defense-in-depth** (drugi pas).  

**CM-double-bootstrap:** drugi click w <1 s → jedno okno, zero drugiego dam-appw (tasklist evidence).

### 1.6 Exit codes (README-START)

| Code | Meaning |
|------|---------|
| 0 | OK / activated existing |
| 2 | missing_runtime (heal shown) |
| 3 | vcredist (heal) |
| 4 | webview2 (heal) |
| 5 | corrupt_manifest |
| 6 | db_config |
| 17 | engine started without handshake |
| ≠0 child <5s | bootstrap shows heal after wait |

### 1.7 Go build / signing

Jak R7: CGO=0, trimpath, pin go.mod/sum, DPI manifest, version/icon, provenance JSON, sign bootstrap+engine+installer (Q2), verify vc_redist MS sig+hash.

---

## 2. CRT + installer 3010 resume

### 2.1 Portable CRT

- Pin `vc_redist.x64.exe` build (np. 14.40.x) w `dist/prep/vc_redist.sha256`.  
- Extract `/layout` → copy exact DLL list matched to `prep-dll-dependents.json` → engine dir (+ python dir jeśli potrzebne).  
- Zakaz System32 copy.  
- THIRD_PARTY notice.  
- **Portable nigdy nie uruchamia vc_redist installera.**

### 2.2 Installer vc_redist + 3010 resume (HARD)

| Case | Action |
|------|--------|
| 0 | Continue install |
| 1638 | Continue (newer present) |
| **3010** | Zapisz **resume state** (signed/validated: path, version, checksum, flag `pending_vc_reboot`) w `%LOCALAPPDATA%\DAM\install-resume.json` **lub** Inno `{app}` staging; UI: „Uruchom ponownie PC, instalacja dokończy się sama”; **RunOnce** / Inno restart-resume: po logon re-run installer silent finish; **redetect VC++**; dokończ kopiowanie app; **nie** auto-launch DAM aż success; screenshot CM12b |
| UAC Deny | Rollback; delete partial; no launch |
| Cancel mid-install | Cleanup staged files + resume flag |
| Offline | Redist bundled; hash+MS sig verified before Run |

Uninstall (CM6): usuń skróty+app; **zostaw** VC++; zachowaj user `dam-connection.env` / data z README.

---

## 3. PREP / FREEZE / MUST / budgets / Synology

Jak R7/R6:
- Allowlist git; secret scan; fat OUT; rolling budgets.  
- BUILD_PROVENANCE: bootstrap_sha, engine_dir manifest hash, freeze_commit, web snapshot.  
- D0 PI → D3 prefer; CM3 TLS log; Q3 required for Tier-B; CM4b before Tier-B; Q7A offline hint screenshot.  
- Index PREP: build-file-index → grid; branding-search preserve+freshness.  
- Update: CM5p kill-all (bootstrap mutex holders, dam-appw, pythonw, bridge) **before** overwrite; kill fail → **abort** (no partial).

---

## 4. Ownership

| Worker | WRITE |
|--------|-------|
| W-Runtime | `apps/desktop/bootstrap/**` (Win32 wrappers, heal, mutex, handshake), engine onedir build script, CRT extract |
| W-Pack | gate, Inno+resume/RunOnce, manifests, signing verify, dist/** |
| W-Icons | ico + embed PNG |
| W-DB | PI, DB, prefer |
| W-QA | PoC evidence + CM matrix |

---

## 5. Plan wykonawczy

**A0** size+latency + **GUI PoC gate** (§1.1) → STOP/AskQuestion jeśli FAIL.  
**A1** Q1–Q7 (+ SmartScreen×2 checkbox gdy Q2=A).  
**B1** ico/logo.  
**C** (tylko po PoC PASS): bootstrap Win32, heal, mutex, handshake, onedir engine, CRT, provenance, signing prep.  
**D** PI/DB/DDNS/TLS.  
**E** PREP→FREEZE→gate→installer (3010 resume)→manifests.  
**F** CM matrix.  
**G** Tier sign-off.

### F — Clean-machine (kluczowe nowości)

| ID | Expected |
|----|----------|
| A0-PoC | §1.1 checklist PASS files |
| CM1a | Bootstrap; native heal/start; no browser/console; no system Python |
| CM-double-bootstrap | Drugi click → activate, 1 process engine |
| CM-bypass | dam-appw bez handshake → exit 17 |
| CM-slow-VM | Cold start ≤60s heartbeat; no false heal |
| CM-hijack | Spoof CRT in cwd/PATH/TEMP vs **engine** start |
| CM12a | Portable CRT; no redist install |
| CM12b | Offline redist; UAC deny; **3010 resume after reboot** |
| CM5p | Kill success; abort on lock; preserve data |
| CM5/CM6 | Po Q1 |
| CM3/CM4b | Tier-B; offline hint on Q7A |
| CM8 | Native heal missing_runtime screenshot |
| CM-heal-* / CM7* / CM9* / verify-manifest | jak R7 |

---

## 6. Todos (po CONVERGED)

- `step-A0-gui-poc-gate`
- `step-A1-parent-q`
- `step-C-win32-bootstrap-heal`
- `step-C-mutex-handshake-onedir`
- `step-C-crt-layout-hijack`
- `step-E-prep-freeze-gate`
- `step-E3-vcredist-3010-resume`
- `step-F-cm-matrix`
- `step-G-tier-signoff`

---

## 7. DoD

### Tier-A
- [ ] A0 GUI PoC PASS  
- [ ] Native heal; no HMAC; handshake reliability + CM-slow-VM  
- [ ] Onedir engine; CRT in engine dir; hijack PASS  
- [ ] Bootstrap mutex; CM-double-bootstrap PASS  
- [ ] CM12a PASS; portable no redist install  
- [ ] PREP/FREEZE/manifest/indexes; fat OUT  
- [ ] Q2=A → Parent SmartScreen×2 checkbox **lub** Q2=B signed  
- [ ] Parent §7 deferred **lub** Tier-B  

### Tier-B
- [ ] CM3+CM4b; Q3; D3 APPROVAL  

### Brief §8
- [ ] Q1+CM5+CM6; CM12b 3010 resume PASS  

---

## 8–10. Rollback / Guardrails / Kontrakt

Rollback: archive portable/installer; abort upgrade on kill fail; FREEZE restart.  

Guardrails: no browser heal; no HMAC-as-security; no onefile engine; no spawn without mutex; no auto-launch after 3010 before success; no portable redist install; no `git add -A`; MAD min 10.  

Po CONVERGED: UPDATE `canonical_plan_path` only.

---

## 11. Notatki dla Critica (round 8)

Sprawdź: Win32 x/sys PoC gate; threat model handshake; onedir+hijack; mutex-first; 3010 resume; Synology/manifest/freeze spójność; exit codes README.

## Werdykt Plannera

Draft R8 gotowy na **Critic round 8**. Kanon nie tworzony. 0 REBUT / brak tie. MAD 8/10.
