# Critique round 4

## READ wykonany
- [x] `agents/shared/planner-runs/.../brief.md` — §7 Synology HARD, regresje branding/quiz/gazetka, min_rounds 10
- [x] `agents/shared/planner-runs/.../planner-round-4-draft.md` — R4: PREP→FREEZE, manifest poza tree, slim/budgets/LFS, CM1a-boot→CM12, Tier-A/B
- [x] `agents/shared/planner-runs/.../planner-round-3-critique.md` — 4K baseline R3
- [x] `agents/shared/planner-runs/.../planner-round-3-response.md` — 11 ACCEPT / 0 REBUT
- [x] `agents/shared/planner-runs/.../planner-changelog.md` — R3→R4 changelog
- [x] `memory.md` — fat ~340MB OUT hot path; branding-search ~44MB; linked_products z fat/OCR
- [x] `apps/desktop/dam_root_launcher.py` — brak `DAM_BOOT_PROBE`; zawsze spawn `launch.py` via pythonw
- [x] `apps/web/assets/js/dam-branding.js` — cold path = grid-head/index only
- [x] `apps/web/assets/js/dam-media-preview.js` — preview używa grid-index, nie fat
- [x] Brak `.cursor/agents/critic.md` w repo

## Ocena domknięcia 4K + 7W + 3Ko (R3→R4)

| ID R3 | Status R4 | Testowalność |
|-------|-----------|--------------|
| K1 FREEZE vs generator | **Zamknięte** | BUILD PREP → E0 FREEZE; po freeze copy-only; regeneracja = restart PREP |
| K2 manifest edge cases | **Zamknięte częściowo** | §3.4 two-phase, manifest poza `DAM/`, artifact bundle, reparse/ADS/traversal; brak reguły portable **zip** vs folder |
| K3 size / fat OUT | **Zamknięte częściowo** | D11/D14 budżety + LFS; progi **nie uzasadnione** pomiarem; ryzyko FAIL na legalnym `file-index.json` |
| K4 CM1a∩CM12 | **Zamknięte częściowo** | CM1a-boot→CM12 + snapshoty; **PyInstaller `DAM.exe` vs brak VC++** nadal nierozwiązane |
| W1 post_sync snapshot | **Zamknięte** | E1.3 + git diff empty |
| W2 freshness + ijson | **Zamknięte** | PREP + generation_id + ijson FAIL |
| W3 CM7b AUMID | **Zamknięte** | Get-StartApps + pin screenshot |
| W4 Tier-A/B | **Zamknięte** | D13 + DoD §7 + Q7A ≠ §7 |
| W5 CM5/6 SKIP | **Zamknięte** | Explicit SKIP |
| W6 Q8 vs Tier-A | **Zamknięte** | Q8 tylko FAIL×3; D12 installer bootstrap |
| W7 native deps | **Zamknięte częściowo** | Obserwacja w tekście; psycopg2 na Tier-B bez osobnego CM |
| Ko1–Ko3 | **Zamknięte** | Q8 nota, min_rounds, README pełny |

**Podsumowanie:** 3/4 krytycznych R3 domknięte w pełni; CM1a-boot entry vs VC++/PyInstaller i walidacja budżetów 80/200 MB pozostają luki testowalne. Manifest i slim indexes wymagają doprecyzowania payload MUST.

## Krytyczne
- [weryfikacja] **CM1a-boot** na VM-A bez VC++ zakłada uruchomienie artefaktu portable (`DAM.exe`), ale **PyInstaller onefile** ładuje bootloader native **przed** jakimkolwiek Pythonem/C6 `DAM_BOOT_PROBE` — typowy błąd `VCRUNTIME140.dll` = crash **przed** heal (`dam_root_launcher.py` dziś nie ma probe path) → doprecyzować HARD: CM1a-boot **MUSI** używać jawnego entry (`pythonw.exe` + probe script **albo** `DAM.cmd` bez ładowania frozen EXE) **albo** gate evidence że `DAM.exe` bundluje VC++ redist (PyInstaller `--collect-binaries` / test `dumpbin /dependents` w PREP); inaczej CM1a-boot i CM12 zlewają się na tym samym VM-A failure mode.
- [zasoby] Budżety **80 MB / plik** i **200 MB** suma `web/data` bez **baseline pomiaru** w A0 (`size-budget.json` z aktualnymi rozmiarami `file-index.json`, `search-index.json`, grid slim) — memory zna fat 340MB OUT, ale `file-index` może przekroczyć 80 MB na realnym build machine → gate może **FAIL legalny release** lub **PASS za duży payload** → A0 MUST: zmierzyć rozmiary; progi = measured P95 + margines **albo** per-file whitelist (`file-index.json` wyższy limit np. 120 MB) z uzasadnieniem w `parent-decisions.md`; bez tego D14 nieweryfikowalne.
- [zasoby] Slim bez fat w payload zgodny z PI **hot path**, ale regresje brief §10 (quiz, preview skojarzeń, gazetka) mogą wymagać plików **poza** §3.1 MUST (`branding-associations-overrides.json`, ewent. `carrier-types.json`, `product-status.json`) — plan nie dowodzi funkcjonalności offline bez fat ani bez tych JSON → dopisać MUST allowlist (min. overrides jeśli obecne w source) **albo** CM9b/CM9d explicit FAIL gdy brak assoc/quiz data; PREP musi wymienić **`build-file-index.py`** (nie tylko grid) jako generator przed FREEZE gdy indeksy nie są w repo.

## Ważne
- [wspolbieznosc] PREP krok 5 „Commit **lub** czysty tree” — dla FREEZE testowalnego wymagany jest **jeden** stan: `freeze_commit` = SHA commita zawierającego wygenerowane gridy/slim indexes; uncommitted PREP → `git diff freeze -- apps/web` non-empty at E1 → doprecyzować: E0 dopiero po `git commit` PREP (tag opcjonalny `prep-<version>`) lub Parent APPROVAL dirty tree z wpisem w `FREEZE.json`.
- [weryfikacja] `post_sync_web_snapshot_sha256` obejmuje tylko `dam-brand*.js` + `dam-media-preview.js` — CM9c (titles), CM9d (gazetka), CM9b (quiz) mogą zmienić się w innych plikach bez wykrycia stale → rozszerzyć snapshot o pliki frozen paths z regresji (min. `dam-assoc-quiz.js`, `dam-labels.js`, HTML branding) **albo** polegać wyłącznie na full-tree manifest + freeze_commit (jawnie: manifest = source of truth, snapshot = szybki pre-check).
- [weryfikacja] CM9a „branding preview latency” — 3× screenshot+Read bez progu (ms, performance.mark `dam-branding-index-ready`) → dodać evidence: CDP `Performance.getMetrics` lub log mark delta < X ms (Parent threshold) vs baseline w `artifacts/baseline.md`.
- [weryfikacja] §3.4 manifest `portable-<version>.json` — nie precyzuje czy hashuje **rozpakowany folder** czy **`.zip`**; verify na VM po copy — dopisać: jeśli dystrybucja = zip, manifest hashuje **zawartość po rozpakowaniu** (root = folder), zip osobno w artifact manifest jako plik binarny.
- [governance] Tier-A CONVERGED przy Q7A **≠** odbiór usera brief §7 (Synology live) — R4 to mówi; brakuje jawnego **Parent sign-off Tier-A deferred §7** w DoD (checkbox) żeby partial ship nie wyglądał na pełny SUCCESS wobec user query.
- [eskalacja] CM5/CM6 SKIP bez Q1 — poprawne; dodać w macierzy że **Tier-A DoD nie wymaga** CM5/6; **pełny brief §8** (installer na innym PC z reinstall) wymaga Q1 + PASS CM5/6 — unika ukrycia wymagania update/uninstall.
- [weryfikacja] CM3 Tier-B — brak konkretnego evidence (screenshot status DB + log TCP DDNS bez sekretów + `GET /auth/me` jeśli dotyczy) — dopisać minimalny pakiet plików w `dist/evidence/cm3/`.
- [ryzyko_modelowe] E4 SBOM: „PREP lub przed phase A” — dwuznaczność kolejności względem hash → HARD: generuj `THIRD_PARTY_NOTICES.txt` w PREP, kopiuj do payload przed phase A walk.

## Kosmetyczne
- [kontekst] C6 `DAM_BOOT_PROBE` — kontrakt przykładowy; obecny kod go nie implementuje (OK dla planu, w executorze zależność przed CM1a-boot).
- [governance] Changelog „0 po ACCEPT R3→R4” — precyzyjniej: zamknięto 3/4K R3; R4 wprowadza nowe edge (PyInstaller VC++, budget baseline).
- [jednostka_miary] MAD N<10 — werdykt treściowy nie kończy sesji; R4 to już ma (Ko2).

## Werdykt
CONTINUE

*(Proces MAD: runda 4/10 min_rounds — debata trwa niezależnie od liczby krytycznych w tej rundzie.)*

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
