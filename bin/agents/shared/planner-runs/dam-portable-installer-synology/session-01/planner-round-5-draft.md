# Planner round 5 draft — DAM portable installer + Synology

```yaml
name: DAM portable installer Synology
overview: >-
  PowerShell boot-host heal przed PyInstaller/VC++; VC++ redist przed DAM.exe
  lub PREP self-sufficiency proof; A0 size baseline→budżety z margin/cap;
  pełna MUST-lista slim JSON + PREP build-file-index/grid; PREP→FREEZE→copy-only;
  Tier-A/B; DDNS Synology po PI; ikony/AUMID/signing/update spójne.
plan_mode: create
revision: 1
draft_round: 5
revisedAt: 2026-08-11
plannerSession: dam-portable-installer-synology/session-01
canonical_plan_path: C:\Users\krzysztof.wieczorek\.cursor\plans\dam-portable-installer-synology.plan.md
isProject: false
status: DRAFT_R5_AWAITING_CRITIC
changelog_from_r4: 11 ACCEPT / 0 REBUT (K+W); 3 Kosmetyczne ACCEPT
```

## 0. Decyzje Plannera (jawne)

| ID | Decyzja |
|----|---------|
| D1 | Dev sync+smoke; ship tylko `release-gate.ps1`; provenance ≠ mtime. |
| D2 | Supported: instalacja (Q1) LUB kompletny portable NTFS. Unsupported: UNC niepełny. |
| D3 | Dist: `GIT_ROOT/dist/{prep,staging,release,evidence,manifests}`. Zakaz `bin/dist/`. |
| D4 | Synology prefer po D0 PI+KV + D2 + D2b + Parent APPROVAL. |
| D5 | Ikony logo DK multi-DPI; AUMID wyłącznie w `launch.py` (W-Runtime). |
| D6 | Evidence-only. |
| D7 | Redis lib only; CM13. |
| D8 | `build-release-zip.ps1` DEPRECATED. |
| D9 | Manifest two-phase poza payload + artifact bundle; reject reparse/ADS/traversal; portable zip = hash po unpack + zip w artifact. |
| D10 | BUILD PREP → commit → FREEZE → stage copy-only. Regeneracja = restart PREP. |
| D11 | Fat `branding-index*.json` / backupy / conflict OUT. Slim MUST lista §3.1. |
| D12 | **Boot architecture = Windows PowerShell 5.1 host** (§1.2). CM1a-boot testuje host, nie `DAM.exe`. |
| D13 | Tier-A vs Tier-B; Q7A = Tier-A + Parent checkbox „§7 deferred”. |
| D14 | Budżety = A0 measured baseline + margin + absolute hard cap (§3.3). |
| D15 | **VC++:** Installer (i portable README path) instaluje VC++ redist **zanim** uruchomi `DAM.exe`. `DAM.exe`/pełny `launch.py` dopiero po PASS VC++ check w boot-host. PREP dodatkowo weryfikuje dependents (`dumpbin` lub równoważny) — wynik w evidence; brak samowystarczalności ≠ pozwolenie na start bez redist. |

---

## 0.1 Parent Q1–Q7 (rekomendacja A; bez ukrytych forków)

Bez zmian intencji względem R4. Blokady:

| Q | Blokuje | Nie blokuje |
|---|---------|-------------|
| Q1 | E3, CM5/CM6 (bez Q1=SKIP), brief §8 update/uninstall | PREP/FREEZE/portable/CM1a-boot/CM12/Tier-A portable |
| Q2 | expectation „bez SmartScreen” | Tier-A unsigned + hash |
| Q3 | D3 + Tier-B CM3 online | Tier-A offline |
| Q4 | example LAN; Q7 przy CM3 FAIL | DDNS primary |
| Q5 | sslmode jeśli B | TCP checklist A |
| Q6 | E3 UI prereq, CM1b, CM11 | CM1a-boot, CM12 |
| Q7 | Tier-B / §7 | Tier-A + deferred checkbox |
| Q8 | tylko po CM12 FAIL×3 | Tier-A gdy CM12 PASS heal/bootstrap |

---

## 1. Konwencje + boot architecture (D12/D15)

### 1.1 Prereq

| Rola | Wymagane | Dowód |
|------|----------|-------|
| Build | Host Python, pip, PyInstaller, ijson, dumpbin/VS tools **lub** `llvm-readobj`/Dependencies.exe, Inno po Q1 | C1 + PREP |
| CM1a-boot | Windows + PowerShell 5.1 (wbudowany) + portable tree; **bez** VC++, **bez** WebView2 | CM1a-boot |
| CM12 | + próba app path; VC++ absent | CM12 heal/bootstrap |
| CM1b | + WebView2 per Q6 | CM1b |

### 1.2 Boot host — technologia HARD

**Wybór:** `DAM.cmd` (root payload) wywołuje:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%GIT_ROOT%\bin\apps\desktop\dam-boot-host.ps1"`

| Element | Spec |
|---------|------|
| Runtime hosta | **Windows PowerShell 5.1** (`powershell.exe`) — obecny na Win10/11 x64 bez VC++ redist użytkownika |
| Zależności systemowe hosta | Tylko OS; **zakaz** .NET custom EXE / PyInstaller na ścieżce heal |
| Kolejność w `dam-boot-host.ps1` | (1) Resolve GIT_ROOT/CONTENT_ROOT (2) Test `pythonw.exe` → else open `boot-heal.html?reason=missing_runtime` + exit 2 (3) Test VC++ (`System32\vcruntime140.dll` + `msvcp140.dll` lub reg Uninstall VC++ Redist) → else open `boot-heal.html?reason=vcredist` + exit 3 (4) Optional WebView2 check for UI path (5) Start **`pythonw.exe launch.py`** (preferowane) lub `DAM.exe` **tylko** gdy VC++ PASS |
| Czego NIE robi | Nie uruchamia `DAM.exe` przed krokiem VC++; nie importuje pythonnet |
| Skrót pulpitu / installer | Target = `DAM.cmd` (nie goły `DAM.exe`) **albo** installer najpierw VC++ bootstrap, potem dopiero shortcut do `DAM.exe` — **preferowane:** shortcut → `DAM.cmd` zawsze (jedna ścieżka) |
| `DAM.exe` rola | Nadal thin PyInstaller dla użytkowników klikających exe; **boot-host i CM1a-boot nie polegają na nim** |

**PREP self-sufficiency check (równoległy dowód, nie zastępuje boot-host):**
- `dumpbin /dependents` (lub Dependencies) na `DAM.exe` i `pythonw.exe` → lista DLL.
- Jeśli brak VC++ w dependents **i** CM12 na VM-A startuje bez redist → zapisz `vc_self_sufficient=true`.
- Jeśli dependents wymagają VC++ → `vc_self_sufficient=false` → **HARD:** installer bootstrap VC++ przed pierwszym startem app; portable: heal `vcredist` via boot-host (zero crash).

**CM1a-boot entry (MUST):**  
`cmd /c DAM.cmd` lub bezpośredni `powershell … dam-boot-host.ps1` na portable.  
**Zakaz:** `Start-Process DAM.exe` jako jedyny dowód CM1a-boot.

---

## 2. Kontekst (read-only) — baseline A0 seed (ta maszyna 2026-08-11)

Z pomiaru roboczego (do powtórzenia w A0 formalnym):

| Plik | ~MB | Payload |
|------|-----|---------|
| branding-index.json (+backup/conflict) | 340–394 | **OUT** |
| branding-search-index.json | 41.39 | MUST IN (search) |
| branding-grid-index.json | 17.74 | MUST IN |
| file-index.json | 7.55 | MUST IN |
| search-index.json | 0.44 | MUST IN |
| branding-grid-head.json | 0.29 | MUST IN |
| bin/runtime/win/python | ~70.4 | MUST IN (tree) |

A0 **musi** zapisać świeży `dist/evidence/a0-size-baseline.json` (nie polegać wyłącznie na tej tabeli).

---

## 3. Architektura payload / manifest / budgets

### 3.1 MUST-lista slim (kompletna) — branding / viz / quiz / assoc / search

**Cold branding + preview (PI):**
- `branding-grid-head.json`
- `branding-grid-index.json`
- `branding-search-index.json` (search UI; nie fat)
- `branding-associations-overrides.json`
- `branding-recognition.json` (jeśli istnieje w source po PREP)
- `branding-segments.json` (jeśli istnieje)

**Produkty / search / explorer / titles:**
- `file-index.json`
- `search-index.json`
- `naming-dictionary.json`
- `lang-overrides.json`
- `product-name-pl.json`
- `product-status.json`
- `lifecycle-status.json` (jeśli istnieje)
- `carrier-types.json`
- `carrier-overrides.json`
- `viz-flags.json`
- `thumb-overrides.json`
- `bulk-packaging.json` (gazetka/bulk — brief §10)

**Quiz / assoc / program:**
- `program-instructions.json`
- `app-settings.json` (**bez** sekretów; scan)
- `tag-proposals.json` (może być pusty szablon)
- `notification-groups.json`
- `inbox-items.json` (może być pusty)

**Legal HTML (gdy w source):** `license.html`, `privacy.html`, `terms.html`, `consents.html`, `docs-security.html`

**OUT (FAIL jeśli w payload):**
- `branding-index.json` i wszelkie `branding-index*.backup*`, `*_Conflict.json`
- `*.sqlite*`, `pg-config.json`, `dam-connection.env`, `.env*`, oauth tokens, `.dam-secret.key`
- LFS pointer files
- machine: `dam-runtime.json`, `dam-identity.json`

**THEME MUST:** `bin/THEME/geex-html-main/**`, `bin/THEME/inyfinn-geex-kit/**`  
**Desktop MUST:** `launch.py`, `local_bridge.py`, `boot-heal.html`, `dam-boot-host.ps1`, `dam_root_launcher.py`, examples config, `dam_app.ico`  
**Root:** `DAM.cmd` (boot), `DAM.exe` (opcjonalny secondary), `README-START.txt`, `LICENSE.md`, `THIRD_PARTY_NOTICES.txt`, `VERSION.json`, `BUILD_PROVENANCE.json`

Gate: `Test-Path` każdej pozycji MUST z listy powyżej (dla „jeśli istnieje” — jeśli jest w SOURCE po PREP, musi trafić do payload).

### 3.2 PREP generators — kolejność HARD

1. Wymagane narzędzia: host Python, ijson.  
2. Fat input obecny na build machine: `apps/web/data/branding-index.json` (nie pakowany).  
3. `python apps/web/scripts/build-file-index.py` (odświeża file-index + search-index + powiązane).  
4. `python apps/web/scripts/build-branding-grid-index.py` (grid-head/index; generation_id vs fat).  
5. Inne zależne buildy jeśli wymagane przez MUST (np. search branding index builder — jeśli osobny skrypt w repo; inaczej zachowaj istniejący `branding-search-index.json` i zweryfikuj mtime/generation vs policy).  
6. Generuj `THIRD_PARTY_NOTICES.txt` z vendored site-packages.  
7. Size baseline refresh + LFS scan na outputach.  
8. Offline/local runtime smoke na build machine: start boot-host probe + `pythonw -c "import webview,bcrypt,psycopg2"` + curl smoke `:8765/:8766` gdy serve uruchomiony z embed — evidence w `dist/evidence/prep-offline-smoke.log`.  
9. **`git add` + `git commit`** plików wygenerowanych w `apps/web/data/` (slim only) → `prep_commit` SHA.  
10. E0 FREEZE = `freeze_commit` **==** `prep_commit` (lub descendant czysty). Dirty tree: tylko Parent APPROVAL + `FREEZE.json.allow_dirty=true` + lista plików.

### 3.3 Budżety z A0 (D14) — nie arbitralne 80/200

**A0 artifact:** `dist/evidence/a0-size-baseline.json`

```json
{
  "measured_at": "ISO",
  "machine": "...",
  "files": {
    "file-index.json": {"bytes": 0, "mb": 0},
    "search-index.json": {"bytes": 0, "mb": 0},
    "branding-grid-head.json": {},
    "branding-grid-index.json": {},
    "branding-search-index.json": {},
    "runtime_win_python_tree": {}
  },
  "p50_mb": {},
  "max_mb": {},
  "notes": "single-sample v1: p50=max=measured; later runs update rolling"
}
```

**Gate budget per plik MUST data:**  
`limit_mb = max( max_mb * 1.25 , max_mb + 5 )`  
gdzie `max_mb` z baseline dla tego pliku.

**Absolute hard caps (escalation, nie „miękki WARN”):**
- Pojedynczy data JSON w payload: **> 100 MB** → FAIL + Parent AskQuestion (podnieś cap / wyłącz plik).  
- Suma `apps/web/data` w payload: **> 120 MB** → FAIL + Parent (seed z baseline: search 41 + grid 18 + file 8 ≈ 67; 120 = room).  
- Portable total z runtime: **> 800 MB** → FAIL + Parent (seed runtime ~70 + data ~67 + web/theme ≈ headroom).  
- Fat branding-index obecny: FAIL zawsze.  
- LFS pointer: FAIL zawsze.

Jeśli baseline measurement pokazuje plik już > hard cap → **STOP PREP** przed freeze; Parent decyzja (nie ship).

### 3.4 Manifest (jak R4 + W4)

- Manifesty w `dist/release/manifests/` poza `DAM/`.  
- Portable dystrybucja zip: `portable-*.json` haszuje **folder po unpack**; `artifact` zawiera też sha256 pliku `.zip`.  
- verify-manifest niezależny; negative test 1-byte flip.

---

## 4. Ownership / FREEZE / sync

Jak R4 + W-Runtime WRITE: `dam-boot-host.ps1`, `DAM.cmd`, heal reasons, AUMID.  
W-Icons: ICO only.  
W-QA: READ-ONLY artefakt.

FREEZE: tylko po PREP commit; `git diff freeze -- apps/web` empty.  
Sync lock bez zmian.

**post_sync_web_snapshot_sha256** obejmuje min.:
`dam-branding.js`, `dam-media-preview.js`, `dam-assoc-quiz.js`, `dam-assoc-edit.js`, `dam-labels.js`, `dam-shell.js`, HTML: `branding.html` (+ inne strony CM9), oraz full-tree manifest = SoT.

---

## 5. Plan wykonawczy (skrót faz z R4, ze zmianami R5)

### A0 — Size + icons + logo inventory
Zmierz wszystkie MUST §3.1 + runtime tree → `a0-size-baseline.json`.  
Zapisz proponowane `limit_mb` per plik.  
CM1-profile szablon.

### A1 — Parent Q1–Q7

### B1 — Brand ICO + CM7 surfaces

### C — Boot host + launcher
- C1 vendor + ijson  
- C2 EXE + provenance + **dumpbin dependents evidence**  
- C3 heal: missing_runtime, vcredist, webview2, unsupported UNC  
- C4 shortcuts → **DAM.cmd**  
- C5 AUMID  
- **C6 implement `dam-boot-host.ps1` + root `DAM.cmd`** (kontrakt §1.2)

### D — PI / DB / DDNS
D0→D4 jak R4 (PI przed prefer; templates DDNS; connectivity; migrate dry-run).

### E — PREP → FREEZE → GATE → installer
- E-PREP §3.2 (file-index → grid → notices → commit)  
- E0 FREEZE  
- E1 gate: freeze assert, sync, provenance+web snapshot, stage materialize, budgets from A0, fat/LFS OUT, manifests, grep bin/dist, secrets  
- E2 README (5 linii; boot via DAM.cmd; VC++ heal)  
- E3 Installer: **VC++ redist bootstrap BEFORE** first app start; then shortcuts to DAM.cmd; signing Q2; WebView2 Q6  
- E4 archive; artifact manifest update  

### F — Clean-machine kolejność

| ID | Entry | Expected |
|----|-------|----------|
| **CM1a-boot** | `DAM.cmd` / boot-host na VM-A **bez VC++** | Heal missing_runtime **lub** (gdy runtime jest) heal **vcredist** / exit 3 — **nigdy** crash PyInstaller; evidence log PS + screenshot heal |
| **CM12** | Po snap-app: boot-host → próba startu app gdy user/force path **bez** VC++ | Heal vcredist; docs≠PASS; FAIL×3→Q8 |
| CM11 | brak WebView2 | heal webview2 |
| CM1b | VM-B + Q6 | pełne UI |
| CM3 | Tier-B | evidence pack: screenshot DB status pill; `dist/evidence/cm3/tcp-ddns.log` (host/port/ok, **bez hasła**); opc. `GET /auth/me` status |
| CM4/CM4b | offline / revert prefer | |
| CM5/CM6 | po Q1 | PASS wymagane dla brief §8; **Tier-A DoD nie wymaga**; bez Q1 = SKIP |
| CM7a–d | ikony + AUMID method | |
| CM8 | UNC | |
| CM9a–e | frozen; CM9a: mark/CDP latency ≤ threshold z A0/Parent (default: nie gorzej niż 1.5× baseline local cold) | 3 przeloty UI |
| CM10/10b/13 | secrets/notices/redis | |
| verify-manifest | + negative | |

### G — Handoff
Parent sign-off:  
- [ ] Tier-A APPROVED  
- [ ] **§7 Synology live DEFERRED** (gdy Q7A) **albo** Tier-B PASS  

---

## 6. Todos (po CONVERGED)

- `step-A0-size-baseline`
- `step-A1-parent-q1-q7`
- `step-B1-brand-ico`
- `step-C1-vendor`
- `step-C2-exe-provenance-dumpbin`
- `step-C3-heal`
- `step-C4-shortcut-dam-cmd`
- `step-C5-aumid`
- `step-C6-dam-boot-host-ps1`
- `step-D0-pi` … `step-D4-docs`
- `step-E-PREP-file-index-grid-notices-commit`
- `step-E0-freeze`
- `step-E1-gate`
- `step-E2-readme`
- `step-E3-installer-vcredist-first`
- `step-E4-manifests-archive`
- `step-F-cm1a-boot-host`
- `step-F-cm12-cm9-tier`
- `step-G-tier-signoff`

---

## 7. DoD

### Tier-A
- [ ] Boot-host PS1 + DAM.cmd; CM1a-boot PASS bez DAM.exe  
- [ ] VC++ policy D15; installer bootstrap przed DAM.exe  
- [ ] A0 baseline + gate budgets PASS  
- [ ] MUST §3.1 complete; fat/secrets OUT; PREP file-index+grid+commit  
- [ ] FREEZE clean; manifests+verify; CM9 frozen; CM7/11/12/13  
- [ ] CM5/6 SKIP OK dla Tier-A  
- [ ] Parent checkbox §7 deferred **lub** Tier-B  

### Tier-B
- [ ] CM3 evidence pack PASS; D3 prefer APPROVAL  

### Brief §8 (inny PC update/uninstall)
- [ ] Q1 + CM5 + CM6 PASS (nie część Tier-A minimal)

---

## 8–10. Rollback / Guardrails / Kontrakt

Jak R4 + dodatkowo: nigdy nie uznawaj CM1a-boot na `DAM.exe` bez VC++; nigdy arbitralnych 80/200 gdy A0 istnieje; SBOM tylko z PREP przed hash; MAD min_rounds 10.

---

## 11. Notatki dla Critica (round 5)

Sprawdź: PS 5.1 boot-host vs PyInstaller; D15 VC++ przed EXE; A0→budget formula + hard caps; MUST lista + PREP file-index order; freeze=commit; portable zip hashing; Tier-A deferred §7 checkbox; CM3 pack; CM9a latency threshold.

## Werdykt Plannera

Draft R5 gotowy na **Critic round 5**. Kanon nie tworzony. 0 REBUT / brak tie.
