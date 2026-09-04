# Planner round 6 draft — DAM portable installer + Synology

```yaml
name: DAM portable installer Synology
overview: >-
  Jeden publiczny bootstrap EXE (Go, GUI, self-contained, ikona DK, AUMID, no-console);
  wewnętrzny PyInstaller ukryty jako dam-appw.exe; healer branded z pełnymi reason;
  PREP git allowlist + secret scan; installer bundluje vc_redist+UAC; portable =
  app-local CRT; PREP→FREEZE→slim MUST; Tier-A/B; Q1–Q7 bez TBD.
plan_mode: create
revision: 1
draft_round: 6
revisedAt: 2026-08-11
plannerSession: dam-portable-installer-synology/session-01
canonical_plan_path: C:\Users\krzysztof.wieczorek\.cursor\plans\dam-portable-installer-synology.plan.md
isProject: false
status: DRAFT_R6_AWAITING_CRITIC
changelog_from_r5: 13 ACCEPT / 0 REBUT (K+W); 3 Kosmetyczne ACCEPT
```

## 0. Decyzje Plannera (jawne — zero TBD)

| ID | Decyzja |
|----|---------|
| D1 | Dev sync+smoke; ship tylko `release-gate.ps1`; provenance ≠ mtime. |
| D2 | Supported: instalacja (Q1) LUB kompletny portable NTFS. Unsupported: UNC niepełny. |
| D3 | Dist: `GIT_ROOT/dist/{prep,staging,release,evidence,manifests}`. Zakaz `bin/dist/`. |
| D4 | Synology prefer po D0 PI+KV + D2 + D2b + Parent APPROVAL. CM3 **bez** `migrate --apply` bez Parent. |
| D5 | Ikony logo DK na bootstrap EXE, shortcut, installer, uninstaller, taskbar. |
| D6 | Evidence-only. |
| D7 | Redis lib only; CM13. |
| D8 | `build-release-zip.ps1` DEPRECATED. |
| D9 | Manifest two-phase poza payload + artifact bundle; portable zip = hash po unpack. |
| D10 | PREP (generators) → **git commit allowlist** → FREEZE → stage copy-only. |
| D11 | Fat branding-index* OUT. Slim MUST §3.1 + stubs sanitize. |
| D12 | **Jedyny publiczny entry = `DAM.exe` bootstrap (Go GUI).** Wewnętrzny app: `bin\runtime\win\dam-app\dam-appw.exe` (PyInstaller, ukryty). Zakaz UX shortcutów do dam-appw / pythonw. |
| D13 | Tier-A / Tier-B; Q7A = Tier-A + Parent „§7 deferred”. |
| D14 | Budżety z A0 + rolling 3 PREP + hard caps + Parent na wzrost >10%. |
| D15 | **VC++ per artifact:** **Installer** = bundle `vc_redist.x64.exe`, silent+UAC **przed** startem app. **Portable** = **app-local CRT DLL** obok embed Python (redist license w THIRD_PARTY); healer `vcredist` tylko gdy brak DLL lokalnych/systemowych. **Nie** obiecujemy per-user VC++ install bez UAC. |
| D16 | Healer: reasons §1.3; logo DK embedded/local file; zero fetch do backendu. |

---

## 0.1 Parent Q1–Q7 (rekomendacja A)

| Q | Blokuje | Nie blokuje |
|---|---------|-------------|
| Q1 | E3 ścieżka instalacji, CM5/CM6 (SKIP bez Q1), brief §8 | PREP/FREEZE/portable/CM1a/CM12/Tier-A portable; CM5p portable upgrade |
| Q2 | „bez SmartScreen” expectation | Tier-A unsigned + hash verify |
| Q3 | D3 + Tier-B CM3 online | Tier-A offline |
| Q4 | example LAN; Q7 przy CM3 FAIL | DDNS primary |
| Q5 | sslmode B | TCP checklist A |
| Q6 | WebView2 installer/CM1b/CM11 | CM1a bootstrap heal |
| Q7 | Tier-B / §7 | Tier-A + deferred checkbox |
| Q8 | CM12 FAIL×3 (installer redist/heal strategy escalate) | gdy CM12 PASS |

---

## 1. Bootstrap architecture (D12) — HARD

### 1.1 Technologia

| Pole | Wartość |
|------|---------|
| Język | **Go 1.22+** (`GOOS=windows GOARCH=amd64`) |
| UI | Win32 GUI (`golang.org/x/sys/windows`) — **bez konsoli** (`-H windowsgui` / `rsrc` GUI subsystem) |
| Zależności systemowe na end-user | Tylko Windows 10/11 x64 API (kernel32, user32, shell32, ole32). **Brak** VC++ redistributable dla samego bootstrapa. **Brak** PowerShell jako public entry. |
| Zależności build machine | Go toolchain; `goversioninfo` / `rsrc` do osadzenia `dam_app.ico` (logo DK) |
| Publiczny plik | `DAM.exe` w root payload / instalacji |
| Wewnętrzny app | `bin\runtime\win\dam-app\dam-appw.exe` (PyInstaller onefile z `dam_root_launcher`/`launch` chain) — **nie** w root; **nie** w skrótach |
| Embed Python | `bin\runtime\win\python\pythonw.exe` (wywoływany wyłącznie przez bootstrap po PASS checks) |

### 1.2 Kolejność bootstrap (DAM.exe)

1. Ustaw **AppUserModelID** procesu bootstrapa: `Inyfinn.DAM.DobraKaloria.Bootstrap.1` (stała; evidence CM7b).  
2. Resolve `GIT_ROOT` = katalog `DAM.exe`.  
3. Verify manifest optional quick: jeśli `dist/release/manifests` skopiowane obok lub `BUILD_PROVENANCE.json` — przy korupcji → heal `corrupt_manifest`.  
4. Check `bin\runtime\win\python\pythonw.exe` → else heal `missing_runtime`.  
5. Check CRT: app-local DLL w `bin\runtime\win\python\` **lub** system `vcruntime140.dll` → else heal `vcredist`.  
6. Check WebView2 (reg/key) gdy start UI — else heal `webview2` (nie blokuje samego probe runtime).  
7. Spawn **`pythonw.exe`** + `bin\apps\desktop\launch.py` (cwd desktop) **albo** `dam-appw.exe` jeśli gate wybrał frozen path — **nigdy** nie eksponuj dam-appw użytkownikowi.  
8. Błędy DB/network przy cold status (opcjonalny lekki check po starcie bridge): heal `db_config` / komunikat sieciowy przez heal page (statyczny HTML).

Heal open: `ShellExecute` / default browser na **lokalny** `bin\apps\desktop\boot-heal.html?reason=…` (file URI). Żadnego HTTP do 8765/8766 dla heal.

### 1.3 Healer reasons (D16) — MUST w `boot-heal.html`

| reason | Tytuł (PL) | CTA |
|--------|------------|-----|
| `missing_runtime` | Brak silnika w folderze | Skopiuj pełną paczkę / reinstall |
| `vcredist` | Brak bibliotek systemowych (VC++) | Installer: uruchom ponownie setup; Portable: IT / dołączone DLL |
| `webview2` | Brak WebView2 | Link Evergreen Bootstrapper |
| `corrupt_manifest` | Uszkodzona paczka | Pobierz ponownie; verify-manifest |
| `db_config` | Brak konfiguracji bazy | First-run: wklej `dam-connection.env` (Q3) |
| `network` | Brak połączenia z bazą | Offline SQLite / sprawdź DDNS (bez sekretów) |
| (default) | Problem z uruchomieniem | Log + IT |

**Branding heal:** osadzone / lokalne `logo-dk-green.svg` lub PNG wygenerowane do `bin\apps\desktop\assets\heal-logo.png` (kopia z oficjalnego logo). CSS lokalny. **Zakaz** zewnętrznych CDN i backendu.

### 1.4 Ikona / taskbar / no-console

- Bootstrap `DAM.exe` budowany z `dam_app.ico` (logo DK multi-size).  
- Shortcut `IconLocation` = `DAM.exe,0`.  
- AUMID bootstrap (wyżej) + po starcie UI `launch.py` ustawia AUMID app `Inyfinn.DAM.DobraKaloria.1` (spójny pin).  
- **CM7e:** nagranie/log — **zero** okna konsoli przy starcie z shortcutu.  
- **CM7b:** pin taskbar po starcie UI — ikona DK, nie generic.

### 1.5 Zakaz bypass

- Gate FAIL jeśli installer/shortcut wskazuje `dam-appw.exe`, `pythonw.exe`, lub stary root PyInstaller pod nazwą mylącą.  
- Root **nie** zawiera publicznego drugiego exe app. Historyczny thin PyInstaller → tylko `bin\runtime\win\dam-app\dam-appw.exe`.  
- `DAM.cmd` / `dam-boot-host.ps1` = opcjonalne **dev** helpers, **nie** w skrótach release (release = wyłącznie `DAM.exe` bootstrap).

---

## 2. VC++ strategy per artifact (D15)

| Artifact | Strategia | Admin/UAC | Offline |
|----------|-----------|-----------|---------|
| **Installer** | Bundle `vc_redist.x64.exe` w Inno `[Files]`; `[Run]` silent (`/install /quiet /norestart`) **przed** pierwszym startem `DAM.exe`; przy braku uprawnień — UAC prompt (jawne; nie „per-user bez UAC”) | Może wymagać elevation | MUST działać offline (redist w paczce) |
| **Portable** | Skopiuj **app-local** `vcruntime140.dll`, `msvcp140.dll`, `vcruntime140_1.dll` (lista z PREP dumpbin) do `bin\runtime\win\python\` + wpis w `THIRD_PARTY_NOTICES.txt` (Microsoft Visual C++ Redistributable license) | Bez admina | MUST; heal `vcredist` tylko gdy DLL usunięte |

PREP: `prep-dll-dependents.json` = top dependents: `DAM.exe`(bootstrap), `pythonw.exe`, `python312.dll`, `python3.dll`, kluczowe `.pyd` (pythonnet/clr, psycopg2), `dam-appw.exe`. FAIL jeśli portable stage bez wymaganych app-local CRT gdy `vc_self_sufficient=false` dla python tree.

---

## 3. MUST slim + PREP git hygiene

### 3.1 MUST data (track/copy policy)

| Plik | Policy |
|------|--------|
| branding-grid-head/index.json | **generate** w PREP (`build-branding-grid-index.py`); track w git |
| branding-search-index.json | **preserve** jeśli brak osobnego builder-a; freshness = mtime ≥ grid build lub Parent note; track |
| file-index.json / search-index.json | **generate** `build-file-index.py`; track; assert product count > threshold **lub** Parent „cached index” w commit message |
| naming-dictionary, lang-overrides, product-*, carrier-*, viz-flags, thumb-overrides, bulk-packaging, branding-associations-overrides, branding-recognition/segments (jeśli istnieją) | **copy** z source; track jeśli już w repo |
| program-instructions.json | copy/track |
| app-settings.json | **release stub** (bez sekretów; wyzeruj lokalne ścieżki) |
| tag-proposals.json / inbox-items.json | **empty stub** `[]`/`{}` w release — **nie** kopiuj live kolejek z dev |
| notification-groups.json | copy lub stub |

**OUT:** branding-index*, backups, conflicts, sqlite, env, oauth, dam-runtime/identity, LFS pointers.

### 3.2 PREP commit — allowlist ONLY

```
# dozwolone ścieżki git add (enumerated):
apps/web/data/branding-grid-head.json
apps/web/data/branding-grid-index.json
apps/web/data/branding-search-index.json   # tylko jeśli regenerowany
apps/web/data/file-index.json
apps/web/data/search-index.json
# + inne MUST wygenerowane jawnie wymienione w prep-commit-files.txt
```

- **`git add -A` ZAKAZANE** (gate grep w PREP script FAIL).  
- Przed commit: `scripts/ops/prep-secret-scan.ps1` — FAIL na `.env`, passwords, `pg-config.json`, `*.sqlite`, `dam-connection.env`, oauth.  
- Output: `dist/evidence/prep-commit-files.txt` (dokładna lista).  
- FREEZE nigdy nie commituje `apps/desktop/data/**`.

### 3.3 Budżety

Jak R5 formula z A0 + **rolling max z 3 ostatnich** `dist/release/archive/*/a0-size-baseline.json`.  
Wzrost >10% vs poprzedni release bez Parent checkbox w `parent-decisions.md` → FAIL.  
Hard caps: 100 MB/plik data, 120 MB suma data, 800 MB portable — escalation Parent.  
A0 dodaje `branding-cold-latency-ms` (jeden lokalny pomiar).

### 3.4 branding-search builder

Brak osobnego skryptu w repo ⇒ PREP krok: **preserve** `branding-search-index.json` + assert size > 0 + mtime policy vs fat (dokumentuj w prep log). Gdy pojawi się builder — dopisz do allowlist generate.

---

## 4. Ownership

| Worker | WRITE |
|--------|-------|
| W-Pack | gate, stage, manifests, Inno, vc_redist bundle, dist/** |
| W-Runtime | **Go bootstrap `DAM.exe` źródła** (np. `apps/desktop/bootstrap/`), `boot-heal.html`, `launch.py` AUMID app, ukrycie dam-appw path, CRT copy script |
| W-Icons | `dam_app.ico` z logo DK; heal-logo asset |
| W-DB | PI, examples, prefer po APPROVAL |
| W-QA | evidence; READ-ONLY artefakt |

---

## 5. Plan wykonawczy (fazy)

### A0
Size baseline + latency ms + CM1-profile + logo inventory.

### A1
Parent Q1–Q7.

### B1
ICO + heal-logo z SVG DK.

### C — Bootstrap + heal + app hide
- C1 vendor + ijson  
- C2 Build **Go bootstrap** `DAM.exe` (GUI, ico, AUMID); build **dam-appw.exe** → `bin/runtime/win/dam-app/`; dumpbin evidence  
- C3 `boot-heal.html` wszystkie reasons + logo  
- C4 shortcuts **only** `DAM.exe` bootstrap; zaktualizuj `install-desktop-shortcut.ps1`  
- C5 AUMID app w launch.py  
- C6 Portable CRT copy into python dir + notices  
- C7 No-console smoke lokalny  

### D — PI / DB / TLS / credentials
D0 PI → D1 templates (DDNS; LAN Q4) → D2 connectivity → D2b migrate **dry-run only** → D3 prefer APPROVAL → D4 docs.  
Credentials: nigdy w git; Q3 first-run. TLS: Q5.

### E — PREP → FREEZE → GATE → installer
- E-PREP: generators §3.1–3.2; secret scan; allowlist commit; notices; CRT stage; offline smoke  
- E0 FREEZE = prep_commit  
- E1 gate: freeze, sync, provenance, stage (no fat), budgets+rolling, manifests, secrets, shortcut target assert = bootstrap DAM.exe  
- E2 README (start tylko DAM.exe bootstrap; VC++/WebView2/heal)  
- E3 Installer: extract `vc_redist.x64.exe` → silent+UAC → then finish; shortcuts to bootstrap; signing Q2; WebView2 Q6  
- E4 artifact manifests + archive  

### F — Clean-machine

| ID | Expected |
|----|----------|
| CM1a | Start **bootstrap DAM.exe** na VM-A bez VC++ systemowego: heal missing_runtime **lub** (gdy python+app-local CRT OK) start probe / heal webview2 — **zero crash**, **zero konsoli** |
| CM12 | Bez system VC++; portable z app-local CRT → app path OK **lub** heal; installer offline z bundled redist → UAC+install+start |
| CM7e | No console flash (video/log) |
| CM7a–d | Ikony bootstrap/shortcut/installer/uninstaller + taskbar AUMID |
| CM-heal-* | Screenshot per reason: missing_runtime, vcredist, webview2, corrupt_manifest (synthetic), db_config |
| CM5/CM6 | Po Q1; Tier-A nie wymaga |
| **CM5p** | Portable upgrade: nadpisz tree, **zachowaj** `apps/desktop/data` user |
| CM3 | Tier-B: screenshot online; tcp log bez sekretów; **no migrate --apply**; przy fail→Q7A + screenshot offline hint |
| CM4/CM4b | Offline + revert prefer — **wymagane przed Tier-B ship** |
| CM8–CM13, CM9a–e | jak R5 + latency vs A0 ms |
| verify-manifest | + negative |

### G
Parent: Tier-A APPROVED; §7 deferred **lub** Tier-B PASS; signing Q2 noted.

---

## 6. Todos (po CONVERGED)

- `step-A0-baseline-latency`
- `step-A1-parent-q1-q7`
- `step-B1-ico-heal-logo`
- `step-C2-go-bootstrap-exe`
- `step-C2b-hide-dam-appw`
- `step-C3-heal-reasons-branded`
- `step-C4-shortcut-bootstrap-only`
- `step-C6-portable-app-local-crt`
- `step-D0-d4-db-pi`
- `step-E-PREP-allowlist-commit`
- `step-E0-freeze`
- `step-E1-gate`
- `step-E3-installer-vcredist-bundle`
- `step-F-cm-matrix`
- `step-G-tier-signoff`

---

## 7. DoD

### Tier-A
- [ ] Public entry tylko bootstrap `DAM.exe` (Go GUI); dam-appw ukryty  
- [ ] CM1a/CM7e/CM7b PASS; heal reasons + logo evidence  
- [ ] Portable app-local CRT; installer offline vc_redist+UAC  
- [ ] PREP allowlist commit + secret scan; fat OUT; budgets+rolling  
- [ ] FREEZE; manifests; CM9; CM5p policy  
- [ ] Parent §7 deferred **lub** Tier-B  

### Tier-B
- [ ] CM3 pack PASS; CM4b PASS; D3 APPROVAL; no silent migrate apply  

### Brief §8
- [ ] Q1 + CM5 + CM6 PASS  

### Signing
- [ ] Q2 path executed (unsigned documented **lub** Authenticode)

---

## 8. Rollback / recovery

- Poprzedni installer z `dist/release/archive` (SHA).  
- Portable: przywróć folder; user data w `apps/desktop/data` nietknięte przy CM5p.  
- Prefer/PI revert.  
- FREEZE violation → discard CM9 + restart PREP.  
- Zły CRT copy → re-stage z PREP CRT list.

---

## 9. Guardrails

- Nigdy publiczny PyInstaller jako `DAM.exe`.  
- Nigdy `git add -A` w PREP.  
- Nigdy fat index w payload.  
- Nigdy per-user VC++ „bez UAC” jako obietnica.  
- Nigdy heal zależny od :8765/:8766.  
- Nie zgadywać Q1–Q7.  
- MAD min_rounds 10.

---

## 10. Kontrakt wykonawcy

Sekwencja A→G; stop on error; 3× fail → ESCALATE; deliverable po CONVERGED = UPDATE `canonical_plan_path` only.

---

## 11. Notatki dla Critica (round 6)

Sprawdź: Go bootstrap vs ukryty dam-appw; no-console+AUMID+ico; heal 6 reasons+logo; PREP allowlist; installer redist vs portable app-local CRT; CM5p; CM3 no apply; Q1–Q7 spójność.

## Werdykt Plannera

Draft R6 gotowy na **Critic round 6**. Kanon nie tworzony. 0 REBUT / brak tie. MAD 6/10.
