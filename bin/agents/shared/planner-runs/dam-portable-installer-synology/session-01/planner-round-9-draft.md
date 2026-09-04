# Planner round 9 draft — DAM portable installer + Synology

```yaml
name: DAM portable installer Synology
overview: >-
  Win32 CGO=0 (user32/gdi32/comctl32 v6) z A0 a11y PASS/FAIL; kanoniczne
  mutex/event/pipe Local\; handshake reliability; onedir CRT po discovery+_internal;
  3010 resume DPAPI+RunOnce; Q1–Q7 bez silent default — STOP za bramką; Tier-A/B;
  PREP/FREEZE/manifest/Synology.
plan_mode: create
revision: 1
draft_round: 9
revisedAt: 2026-08-11
plannerSession: dam-portable-installer-synology/session-01
canonical_plan_path: C:\Users\krzysztof.wieczorek\.cursor\plans\dam-portable-installer-synology.plan.md
isProject: false
status: DRAFT_R9_AWAITING_CRITIC
changelog_from_r8: 12 ACCEPT / 1 REBUT (K+W); 3 Kosmetyczne ACCEPT
```

## 0. Decyzje Plannera (jawne)

| ID | Decyzja |
|----|---------|
| D1–D18 | Jak R8 (portable/installer/Synology/PREP/FREEZE/signing/fat OUT/PS OUT). |
| D19 | GUI = dynamic Win32 via `golang.org/x/sys/windows` → **user32/gdi32/comctl32**; Common Controls **v6** manifest; InitCommonControlsEx; DPI PerMonitorV2. |
| D20 | Handshake reliability (nonce+pipe+heartbeat≤60s); **bez HMAC**. |
| D21 | **Jedna** kanoniczna rodzina nazw IPC Local\ (§1.4); shared constants Go+Python. |
| D22 | Engine = PyInstaller **onedir**; CRT placement = **post-build discovery** (§2.1). |
| D23 | Resume 3010 = **DPAPI CurrentUser** blob + RunOnce absolute quoted (§2.2). |
| D24 | **Q1–Q7: zero silent default.** Brak odpowiedzi Parent = STOP za bramką (§0.2). Rekomendacje A w AskQuestion pozostają, ale **nie** są auto-wybierane przez wykonawcę. |

---

## 0.1 Parent Q1–Q7 (AskQuestion — rekomendacja A, bez auto-apply)

Treść opcji jak R8. **Wykonawca nie wstawia A sam.**

### 0.2 Gate matrix bez odpowiedzi Parent (HARD)

| Brak odpowiedzi na | Implementacja dozwolona | STOP |
|--------------------|-------------------------|------|
| (żadne jeszcze) | A0 PoC GUI/a11y, PREP research, draft docs, ownership | E3 installer path, CM5/6, Tier-B, signing Authenticode, LAN IP w example, sslmode require, WV2 silent install |
| **Q1** | Tier-A **portable-only** work (bootstrap/engine/CRT/CM1a/CM12a/CM5p/CM8/CM9…) | E3 Inno target path, CM5/CM6, brief §8 sign-off |
| **Q2** | Hash verify path, unsigned lab | Expectation „bez SmartScreen”; Authenticode gate |
| **Q3** | Tier-A offline | D3 prefer switch, CM3 PASS online, Tier-B |
| **Q4** | Kod DDNS-first (bez wpisywania nowego LAN) | Commit example z konkretnym LAN IP |
| **Q5** | TCP checklist docs | Implementacja `sslmode=require` |
| **Q6** | Native heal (nie zależy od Q6) | Silent WV2 w installerze; CM1b Expected per B |
| **Q7** | Tier-A + przygotowanie deferred checkbox UI | Tier-B ship / deklaracja §7 DONE |
| **Q8** | Happy-path CM12 | Strategia po FAIL×3 |

**Tier-A portable-only sign-off** = możliwy **bez Q1** (Parent checkbox „§8 installer later”).  
**Brief §8 / full installer acceptance** = **wymaga Q1** + CM5/CM6.  
Nie mylić tych dwóch gate’ów.

---

## 1. Win32 stack + A0 a11y PASS/FAIL

### 1.1 Toolchain / DLL / manifest (D19)

| Element | HARD |
|---------|------|
| Go | Pinned w `go.mod` (exact patch w evidence) |
| Module | `golang.org/x/sys` pinned + `go.sum` |
| Calls | Dynamic via x/sys: **user32.dll**, **gdi32.dll**, **comctl32.dll** (CreateWindowExW, MessageBoxW, LoadImageW, BitBlt/StretchDIBits lub Static SS_BITMAP, SendMessageW, …) |
| Init | `InitCommonControlsEx` (ICC_STANDARD_CLASSES \| ICC_WIN95_CLASSES) |
| Manifest | Embedded application manifest: `dpiAware` + **PerMonitorV2**; dependency **Microsoft.Windows.Common-Controls** version **6.0.0.0** processorArchitecture="*" |
| Resources | `goversioninfo` / `rsrc` — ico DK + versioninfo; PNG logo `embed` |
| Build | `CGO_ENABLED=0` `-H=windowsgui` `-trimpath` |

PoC outputs (obok R8): `bootstrap-build-provenance.json`, embedded manifest dump (`mt.exe -inputresource` lub równoważny).

### 1.2 A0 accessibility / DPI evidence protocol

Folder: `dist/evidence/a0-gui-poc/`  
Budżet: **max 2 PoC runs**; potem AskQuestion PoC FAIL.

| ID | Dowód plik | PASS | FAIL |
|----|------------|------|------|
| A0-NAR | `a0-narrator-keyboard.md` + opc. short video | Narrator: Tab przez **wszystkie** 3 buttony; Enter aktywuje Ponów; Esc zamyka; odczytane nazwy PL zgodne z UI | Pomiń kontrolkę / brak nazwy / nie da się klawiaturą |
| A0-UIA | `a0-inspect-tree.txt` **lub** Accessibility Insights export + `a0-inspect-accessible-names.png` | Każda kontrolka: **Name**, **ControlType** (Button/Text/Image), **State** (focusable gdzie trzeba), **Invoke** na buttonach | Brak Name na buttonie; ControlType=Pane bez roli; puste drzewo |
| A0-HC | `a0-high-contrast.png` | Windows High Contrast: tekst czytelny, buttony widoczne, logo nie znika w tło | Tekst niewidoczny / kontrast pad |
| A0-DPI200 | `a0-dpi-200.png` | 200% scaling: brak uciętego tekstu, buttony klikalne, logo nie pixel-mush unreadable | Overflow cut / overlap |
| A0-DPI125 | `a0-dpi-125.png` | Jak R8 | |
| A0-TAB | `a0-tab-order.md` | Kolejkność: body → Ponów → Log → Zamknij | Inna / pułapka fokusu |
| A0-NOCON | `a0-no-console.log` | Brak okna konsoli | Flash console |
| A0-VM | `a0-cm1-profile.md` | Clean VM bez system Python/VC++ | |

**A0 PASS** = wszystkie wiersze PASS. Jakikolwiek FAIL = PoC FAIL → AskQuestion (nie idź w pełne C).

### 1.3 Native heal + handshake cleanup

Heal UI jak R8. Handshake reliability jak R8 + HARD:
- Zamknij inherited pipe handle po ACK.  
- Engine: `WaitForSingleObject(parentPid)` → parent death → exit ≠17 z MessageBox „DAM zamknięty”.  
- Heartbeat fail @60s → bootstrap **TerminateProcess** child + native heal.  
- `DAM_LAUNCH_NONCE` unset przed spawn python grandchildren; secret scan logów.

### 1.4 Canonical IPC names (D21) — HARD

Shared file (single source): `apps/desktop/ipc_names.json` (lub `.go` + generated `.py` via script w PREP).

| Symbol | Value (Local namespace) |
|--------|------------------------|
| `MUTEX_SINGLE` | `Local\Inyfinn.DAM.DobraKaloria.Singleton` |
| `EVENT_ACTIVATE` | `Local\Inyfinn.DAM.DobraKaloria.Activate` |
| `PIPE_PREFIX` | `\\.\pipe\Local\Inyfinn.DAM.DobraKaloria.Launch.` |

- **Local\** = per user session (domyślnie). Cross-session Global **nie** używamy bez Parent.  
- Bootstrap: CreateMutex(`MUTEX_SINGLE`) **first**.  
- Engine/`launch.py`: używa **tego samego** `MUTEX_SINGLE` jako defense-in-depth **po** handshake; bezpośredni `dam-appw` bez handshake → **exit 17 natychmiast** (przed CreateMutex), żeby nie „zająć” singletonu myląco.  
- Contract test: `scripts/qa/test-ipc-names-contract.py` — Go constants == Python constants == JSON (FAIL gate).  
- Usuwamy stary `Global\\DAM_DOBRA_KALORIA_INYFINN_SINGLE_INSTANCE` (migrate w launch.py).

### 1.5 Activate / hang policy

Gdy mutex istnieje:
1. Pulse `EVENT_ACTIVATE`.  
2. Próba focus okna (EnumWindows / title `DAM` / AUMID).  
3. Evidence CM-double: `tasklist` + window title.  
4. Jeśli brak okna >3 s a proces engine żyje → native heal „DAM nie odpowiada — zamknij w Menedżerze zadań” (opc. kill zombie po Parent policy; default = heal, nie silent kill UI usera).  
5. Exit 0.

---

## 2. Onedir CRT discovery + 3010 DPAPI resume

### 2.1 CRT placement (D22) — discovery-first

1. Zbuduj PyInstaller **onedir** → zapisz drzewo `dist/evidence/prep-onedir-layout.txt` (rekurencyjny listing).  
2. PE dependency scan (`dumpbin` / Dependencies) na `dam-appw.exe` + każdy PE w drzewie → `prep-dll-dependents.json`.  
3. Wykryj czy istnieje katalog `_internal` (lub inna nazwa z listing).  
4. Skopiuj wymagane CRT DLL (z oficjalnego vc_redist `/layout`, pin hash) do **każdego katalogu**, z którego loader faktycznie ładuje VC++ deps — typowo:  
   - katalog `dam-appw.exe`  
   - katalog `_internal` **jeśli** listing/PE wskazuje load stamtąd  
5. **Nie zakładaj** layoutu z góry; reguła = „po discovery”.  
6. CM-hijack: spoof w **engine root**, **`_internal`**, **cwd=shortcut**, **PATH**, **TEMP**.  
7. CM-removal: usuń CRT z root XOR `_internal` → oczekiwany heal/fail jawny (dokumentuj który katalog jest konieczny po discovery).

`lpCurrentDirectory` = katalog zawierający `dam-appw.exe`. Absolute path spawn.

### 2.2 Installer 3010 resume (D23) — DPAPI

**Mechanizm:** Windows **DPAPI** `CryptProtectData` / `CryptUnprotectData` scope **CurrentUser** (maszyna+user). Bez sekretu w git/portable.

**Path:** `%LOCALAPPDATA%\DAM\install-resume.bin` (binary DPAPI blob) + obok plaintext header `install-resume.meta.json` (bez sekretów) z polami:

```json
{
  "schema": "dam-install-resume/1",
  "version": "<app version>",
  "created_at": "ISO",
  "expires_at": "ISO+72h",
  "nonce": "<uuid one-time>",
  "vc_exit": 3010,
  "installer_path": "<absolute path allowed>",
  "installer_sha256": "<hex>",
  "state": "pending_reboot",
  "actions_allowed": ["redetect_vc", "finish_copy", "write_shortcuts", "cleanup_resume"]
}
```

Blob DPAPI zawiera: meta + HMAC-like integrity over meta using DPAPI entropy string `DAM-INSTALL-RESUME|version|nonce` (entropy param), nie osobny key w pliku.

| Reguła | Spec |
|--------|------|
| ACL | Folder `%LOCALAPPDATA%\DAM` — current user Full; no Everyone |
| Atomic write | write temp → flush → rename |
| Allowed installer_path | Prefix allowlist: `{src}\` Inno output / `{app}\` only |
| Expiry | 72h → ignore + cleanup |
| One-time nonce | Po successful finish: delete bin+meta; reuse nonce = reject |
| RunOnce | `HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce` value `DAM_FinishInstall` = `\"{absolute installer}\" /RESUMEDAM=\"{absolute meta}\"` (quoted) |
| Po reboot | Installer: DPAPI unprotect → verify sha of installer file → redetect VC++ → finish → **no auto launch DAM** until success UI „Gotowe — uruchom DAM.exe” |
| Cancel/uninstall | Delete resume files + RunOnce value |
| CM12b evidence | before-reboot screenshot; after-reboot log; `reg query RunOnce` empty after success |

Portable: **never** runs vc_redist; never writes install-resume.

---

## 3. PREP / FREEZE / MUST / Synology / evidence templates

Jak R8 + :
- W-QA template: `dist/evidence/cm/<CM-ID>/` z `README.md` checklist (min pliki).  
- CM3 Q7A: `cm3-offline-hint.png` (native).  
- Q2=A Tier-A: `smartscreen-bootstrap.png` + `smartscreen-engine.png` + hash README (osobne od correctness).  
- IPC contract test w gate.  
- Fat OUT; PI before D3; CM3 no migrate apply; CM4b before Tier-B.

---

## 4. Ownership

| Worker | WRITE |
|--------|-------|
| W-Runtime | bootstrap Win32, ipc_names, handshake, launch.py mutex migrate, onedir+CRT discovery scripts |
| W-Pack | gate, Inno+DPAPI resume/RunOnce, manifests, signing verify |
| W-Icons | ico/PNG embed |
| W-DB | PI/DB/prefer |
| W-QA | A0 a11y evidence + cm/* templates |

---

## 5. Plan wykonawczy

**A0** size/latency + **GUI+a11y PoC** (§1.2) — max 2 runs.  
**A1** Parent Q1–Q7 (blokady §0.2).  
**B1** ico.  
**C** (PoC PASS): Win32+comctl6, mutex/IPC, handshake, onedir discovery CRT, provenance.  
**D** PI/DB (STOP bez Q3 na D3).  
**E** PREP→FREEZE→gate→installer (STOP bez Q1 na E3)→3010 resume.  
**F** CM matrix.  
**G** Tier sign-off (portable-only vs §8).

### F — kluczowe CM

| ID | Expected |
|----|----------|
| A0-* | §1.2 PASS table |
| CM1a / CM-double / CM-bypass / CM-slow-VM | jak R8 + IPC names |
| CM-hijack | root + `_internal` + cwd/PATH/TEMP |
| CM12a | portable CRT discovery-based |
| CM12b | 3010 DPAPI resume full cycle |
| CM5p | kill/abort; preserve data |
| CM5/CM6 | **tylko po Q1** |
| CM3/CM4b/CM8/CM9… | jak R8 + native offline hint |

---

## 6. Todos (po CONVERGED)

- `step-A0-a11y-poc`
- `step-A1-parent-q-no-default`
- `step-C-win32-comctl6`
- `step-C-ipc-canonical`
- `step-C-onedir-crt-discovery`
- `step-E-prep-freeze-gate`
- `step-E3-dpapi-3010-resume` (requires Q1)
- `step-F-cm-matrix`
- `step-G-tier-signoff`

---

## 7. DoD

### Tier-A portable-only (bez Q1 OK jeśli Parent checkbox)
- [ ] A0 a11y PASS table  
- [ ] comctl6 manifest; IPC contract test  
- [ ] onedir CRT discovery + hijack both dirs  
- [ ] handshake/mutex/activate hang policy  
- [ ] PREP/FREEZE/manifest/indexes; fat OUT  
- [ ] Q2 path: hash **lub** signed; SmartScreen evidence jeśli A  
- [ ] §7 deferred **lub** Tier-B  

### Brief §8 / installer
- [ ] **Q1 answered** + CM5/CM6 + CM12b resume  

### Tier-B
- [ ] **Q3 answered** + CM3/CM4b + D3 APPROVAL  

---

## 8–10. Rollback / Guardrails / Kontrakt

Rollback archive; kill-fail abort; DPAPI resume cleanup; FREEZE restart.  

Guardrails: no silent Q defaults; no HMAC-as-security; no assumed `_internal` without listing; no Global mutex without Parent; no browser heal; MAD min 10.  

Po CONVERGED: UPDATE `canonical_plan_path` only.

---

## 11. Notatki dla Critica (round 9)

Sprawdź: A0 PASS/FAIL table; comctl6; IPC Local\ + contract test + exit17 before mutex; CRT discovery; DPAPI resume fields; **no silent Q defaults** vs gate matrix; REBUT W6.

## Werdykt Plannera

Draft R9 gotowy na **Critic round 9**. Kanon nie tworzony. 1 REBUT (silent defaults). MAD 9/10.
