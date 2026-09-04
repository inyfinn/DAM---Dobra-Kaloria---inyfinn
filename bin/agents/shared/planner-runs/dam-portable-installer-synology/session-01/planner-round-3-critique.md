# Critique round 3

## READ wykonany
- [x] `agents/shared/planner-runs/.../brief.md` — min_rounds 10, Synology §7 HARD, regresje branding, evidence-only
- [x] `agents/shared/planner-runs/.../planner-round-3-draft.md` — R3: CM1a/b, full-tree manifest, provenance, FREEZE, grid MUST, Q7A/Q8
- [x] `agents/shared/planner-runs/.../planner-round-2-critique.md` — 6K baseline oceny R2
- [x] `agents/shared/planner-runs/.../planner-round-2-response.md` — 13 ACCEPT / 0 REBUT (6K+7W+3Ko)
- [x] `agents/shared/planner-runs/.../planner-changelog.md` — R2→R3 changelog
- [x] `memory.md` — fat `branding-index.json` ~340MB; cold path = grid-head+index only
- [x] `apps/web/scripts/build-branding-grid-index.py` — output pisze do `apps/web/data/`; src = `branding-index.json`
- [x] `apps/web/data/program-instructions.json` — PI cold path; fat nie na hot path
- [x] Brak `.cursor/agents/critic.md` w repo

## Ocena domknięcia 6K + 7W + 3Ko (R2→R3)

| ID R2 | Status R3 | Testowalność |
|-------|-----------|--------------|
| K1 CM1a/b + profil VM | **Zamknięte częściowo** | §F.0 + VM-A/B + CM1a/b są konkretne; kolizja CM1a/CM12 na VM-A bez VC++ niedoprecyzowana |
| K2 full-tree manifest + verify | **Zamknięte częściowo** | D9 + §3.2 + verify-manifest OK; brak reguł self-include, junction/symlink, ADS |
| K3 provenance (nie mtime) | **Zamknięte częściowo** | E1.3 deterministyczny algorytm + BUILD_PROVENANCE; wąski snapshot (launcher only) |
| K4 branding-grid MUST | **Sprzeczność** | MUST + E1.0 jest, ale koliduje z D10 FREEZE (patrz Krytyczne) |
| K5 RELEASE FREEZE | **Sprzeczność** | D10/§4 szczegółowe, ale E1.0 łamie własną regułę |
| K6 CM12 docs≠PASS | **Zamknięte** | VM-A bez VC++, Q8×3, kolumna „Docs jako PASS? = NIGDY” |
| W1 portable CM1 | **Zamknięte** | CM1a portable gdy brak Q1 |
| W2 AUMID owner | **Zamknięte częściowo** | C5 W-Runtime; brak testowalnej asercji AUMID w CM7b |
| W3 CM13 redis | **Zamknięte** | CM13 + D7 |
| W4 grep bin/dist | **Zamknięte** | E1 krok 8 |
| W5 Q7A partial | **Zamknięte** | Q7A + guardrail „≠ brief §7” |
| W6 pyc exclude | **Zamknięte** | §3.1 runtime excludes |
| W7 todo Q7 | **Zamknięte** | step-A1-parent-q1-q7 |
| Ko1–Ko3 | **Zamknięte** | §1 min_rounds, legal HTML MUST, changelog R3 |

**Podsumowanie:** 4/6 krytycznych R2 zamknięte w pełni; 2/6 (FREEZE + grid MUST) wprowadzają **wewnętrzną sprzeczność R3**. Manifest i CM1a wymagają doprecyzowania edge-case.

## Krytyczne
- [wspolbieznosc] **D10 FREEZE** zakazuje WRITE `apps/web/**` od `freeze_commit` do PASS CM9, ale **E1.0** wewnątrz tego samego `release-gate` uruchamia `build-branding-grid-index.py`, który **zapisuje** `apps/web/data/branding-grid-*.json` po E0 freeze → sekwencja E1 krok 1 (dirty=OK) → krok 5 (WRITE) łamie D10 pkt 3–4; kolejny gate run dirty-check fail → niespójność → doprecyzować **jedną** regułę: (A) grid build **przed** E0 freeze + freeze obejmuje wygenerowane gridy w commicie, albo (B) **whitelist** zapisów E1.0 (`data/branding-grid-*.json` only) wyłączona z FREEZE violation, albo (C) FREEZE start **po** E1.0; bez tego FREEZE/CM9 na „frozen artifact” jest niewykonalne testowalnie.
- [weryfikacja] Full-tree manifest (§3.2) nie definiuje **kolejności i wykluczeń hash** — ryzyko: manifest wpisuje sam siebie (recursion/mismatch), pliki `manifest-*.json` / `THIRD_PARTY_NOTICES.txt` generowane po stage, junction `runtime/win` (brief: dev junction) hashuje symlink zamiast target → dopisać HARD: hash po finalnym stage; **exclude** z `files[]` plików poza `root` payload; **follow junctions=FAIL** (stage musi materializować realne pliki); hash = SHA256 stream pliku (nie ADS); osobny manifest `artifact_kind=installer` dla `.exe` Inno **poza** root portable; verify-manifest test case: celowo podmieniony 1 plik → exit ≠0.
- [zasoby] Brak polityki **rozmiaru payload** mimo PI/memory: fat `branding-index.json` ~340MB **nie** na hot path; allowlist MUST wymaga `file-index.json` + `search-index.json` (potencjalnie duże) bez limitu/LFS/stage-only → dopisać: fat `branding-index.json` **OUT** payload release (build input only); MUST w payload = grid-head/index + indeksy według progu (np. max N MB per plik data lub osobny `data-lite/` snapshot); gate loguje `payload_size_mb` + FAIL/WARN Parent gdy przekroczenie budżetu; wzmianka czy indeksy generowane na build machine vs kopiowane z repo/LFS.
- [weryfikacja] **CM1a i CM12** oba na **VM-A bez VC++** — `pythonnet`/PyInstaller na `DAM.exe` może failować na brak `vcruntime140.dll` **przed** heal engine/UI, zlewając CM1a (engine) z CM12 (komunikat) → dopisać kolejność CM: **CM12 pierwszy** na VM-A; CM1a PASS wymaga albo (a) jawnego heal/reason `vcredist` **albo** (b) potwierdzonego subprocess `pythonw` bez ładowania pythonnet w ścieżce CM1a (log procesu + exit code); Expected CM1a ≠ „dowolny crash”.

## Ważne
- [weryfikacja] `source_snapshot_sha256` (E1.3) hashuje tylko 3–4 pliki launchera — nie wiąże EXE z `freeze_commit`/synced `bin/apps/**`; pełny manifest to łata, ale brak asercji **sync completeness** (np. hash listy plików `bin/apps/web/assets/js/dam-brand*.js` po sync vs freeze) → rozszerzyć provenance o `post_sync_web_snapshot_sha256` lub wymagać `git diff --name-only freeze_commit -- apps/web` empty przed stage (po dozwolonym E1.0).
- [weryfikacja] E1.0 freshness: „fat index” bez ścieżki — ustawić HARD `apps/web/data/branding-index.json`; gate porównuje `generation_id` w grid-head vs `compute_generation_id(src)` (skrypt istnieje); wymaga `ijson` na build machine (FAIL jeśli brak).
- [weryfikacja] CM7b „AUMID” bez metody — dodać evidence: `Get-StartApps` / shortcut `.lnk` `AppUserModelID` / pin taskbar screenshot z właściwą ikoną DK (nie tylko WM_SETICON).
- [governance] Q7A partial ship vs user brief §7 — R3 poprawnie mówi „≠ zamknięcie §7”, ale **DoD ship** nie rozdziela tierów → dopisać **Tier-A** (portable/runtime/installer CONVERGED) vs **Tier-B** (CM3 online Synology wymagany dla pełnego odbioru brief §7); MAD może CONVERGE Tier-A przy Q7A, Tier-B otwarty.
- [eskalacja] CM5/CM6 „po Q1” — bez Q1 brak testu uninstall/update; OK dla debaty, ale DoD powinien explicit: CM5/CM6 = **SKIP** (nie PASS) dopóki brak Q1, nie „pominięte = zaliczone”.
- [weryfikacja] Q8 trigger CM12×3 — OK; doprecyzować że Q8 **nie** blokuje Tier-A portable ship jeśli CM12 PASS z komunikatem (tylko strategia docs vs bundle po FAIL).
- [ryzyko_modelowe] Redis CM13 na VM-B — OK; brak CM dla opcjonalnych native deps poza VC++ (np. `psycopg2` DLL) — ważne obserwacja, nie blokuje R3 jeśli CM1a engine-only.

## Kosmetyczne
- [governance] Todo `step-A1-parent-q1-q7` — Q8 warunkowe poza todo (spójne z §0.1, drobna luka dokumentacyjna).
- [kontekst] §1 „debata min_rounds 10” — werdykt R3 może mieć 0 nowych luk procesowych po R4, ale **MAD N<10** nadal wymusza kolejne rundy (jawnie OK w R3).
- [kompletność_briefu] `README-START.txt` nadal bez pełnego tekstu 5 linii (tylko odwołanie do R2/E2) — wystarczy w kanonie po CONVERGED.

## Werdykt
CONTINUE

*(Uwaga procesu: nawet przy domknięciu krytycznych w R4, `min_rounds: 10` w brief wymaga dalszych rund debaty niezależnie od werdyktu treściowego rundy.)*

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
