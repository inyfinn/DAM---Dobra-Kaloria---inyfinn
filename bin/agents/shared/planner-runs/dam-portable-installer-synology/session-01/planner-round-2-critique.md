# Critique round 2

## READ wykonany
- [x] `agents/shared/planner-runs/.../brief.md` — 15 celów HARD, regresje branding/quiz/indexes, evidence-only, min_rounds 10
- [x] `agents/shared/planner-runs/.../planner-round-2-draft.md` — R2 z 18 ACCEPT, Q1–Q7, allowlist §3.1, CM1–CM12, D0 PI przed D3
- [x] `agents/shared/planner-runs/.../planner-round-1-critique.md` — 8K/10W/3Ko; baseline oceny R1
- [x] `agents/shared/planner-runs/.../planner-round-1-response.md` — 18 ACCEPT / 0 REBUT mapowanie K1–K8, W1–W10
- [x] `agents/shared/planner-runs/.../planner-changelog.md` — R1→R2 changelog
- [x] `AGENTS.md` — PI+KV przed decyzjami biznesowymi; SQLite freeze do Synology
- [x] `apps/web/data/program-instructions.json` — cold UI wymaga `branding-grid-head.json` + `branding-grid-index.json`
- [x] `bin/LICENSE.md` — źródło LICENSE istnieje (SBOM możliwy); brak overlay `.cursor/agents/critic.md`

## Ocena 18 ACCEPT (R1→R2)

| Obszar R1 | Status R2 | Uwaga |
|-----------|-----------|-------|
| K1 CM1≠C1 | **Zamknięte częściowo** | §1.1 + CM1 VM — brak profilu VM i PASS per Q6 |
| K2 WebView2/VC++ | **Zamknięte częściowo** | CM11/CM12 istnieją; CM12 i baseline CM1 nadal miękkie |
| K3 allowlist | **Zamknięte częściowo** | §3.1 konkretne; branding-grid = WARN nie MUST |
| K4 SBOM | **Zamknięte** | E4 + CM10b; `bin/LICENSE.md` dostępne |
| K5 replace ZIP | **Zamknięte** | D8 deprecated; brak kroku grep-enforce w E1 |
| K6 Q6 | **Zamknięte** | Q6 + STOP E3 |
| K7 PI przed D3 | **Zamknięte** | D0 obowiązkowy |
| K8 manifest | **Zamknięte częściowo** | schema jest; pokrycie plików i verify niezależny — luka |
| W1–W10 | **Largely zamknięte** | sync lock, CM9a–e, Q7, D7 redis, stale exe — algorytm stale nie sprecyzowany |
| Ko1–Ko3 | **Zamknięte** | budżet min+escalate, C4 path, README szablon |

**Podsumowanie:** 18 ACCEPT realnie domyka ~14/18 w pełni; 4 obszary (CM1 baseline, manifest integrity, branding-grid MUST, QA freeze vs równoległy branding) wymagają doprecyzowania w R3.

## Krytyczne
- [weryfikacja] CM1 wymaga „screenshot okna” na izolowanym VM, ale Q6A czyni WebView2 zewnętrznym prereq — plan nie definiuje **profilu VM** (Win10/11, brak Python/repo/dev tools; WebView2: preinstalowany Evergreen vs brak) ani **PASS per Q6** → dopisać `CM1-profile.md` w artifacts: snapshot wymagań; rozdzielić **CM1a** (engine: `pythonw` + brak `missing_runtime`) od **CM1b** (pełne okno UI po spełnieniu polityki Q6); bez tego „czysty Windows bez zależności” jest nieweryfikowalne.
- [weryfikacja] Manifest §3.2 pokazuje 3 wpisy w `files[]` i gate fail tylko dla minimum — **nie chroni całego payload** przed podmianą/stale plików poza manifestem → wymagać albo **full-tree hash** w manifeście, albo jawnej listy MUST (allowlist §3.1 + wszystkie `bin/apps/web/assets/js/dam-*.js` objęte regresją) + osobny `scripts/ops/verify-manifest.ps1` uruchamiany niezależnie od gate (IT na czystym PC); gate FAIL gdy liczba wpisów < liczba plików staging.
- [weryfikacja] D1/W5 ACCEPT „stale DAM.exe” bez algorytmu w E1 krok 3 — brak reguły (max mtime `bin/apps/**` vs mtime/hash `DAM.exe`, lub wymuszone `--force-rebuild` zawsze w gate) → spisać jedną regułę HARD w E1; bez niej ochrona przed starym bin = deklaracja.
- [zasoby] `program-instructions.json` wymaga cold path `branding-grid-head.json` + `branding-grid-index.json`, ale §3.1 ma je jako **WARN→Parent** — sprzeczność z CM9a (branding preview latency) → zmienić na **MUST Test-Path** albo krok E1.0 `build-branding-grid-index.py` przed stage; gate FAIL gdy brak obu plików.
- [wspolbieznosc] Brak **RELEASE FREEZE** na `apps/web/**` (w tym `dam-branding.js`, `dam-media-preview.js`) między E1 a CM9a–e — równoległe naprawy branding preview mogą zmienić payload po gate lub podczas QA → dodać Parent gate „UI freeze” przed F; każda zmiana JS po gate = obowiązkowy re-run E1; W-QA READ-only na zainstalowanym artefakcie, zero WRITE prod JS.
- [weryfikacja] CM12 dopuszcza PASS przez „udokumentowany prereq” bez obowiązkowego testu lab — C5 nie podaje DLL/procedury (np. brak `vcruntime140.dll` na VM bez VC++) → CM12 MUST: uruchomienie na VM **bez** VC++ Redist; Expected = jawny komunikat/heal (nie silent crash); dokumentacja = uzupełnienie, nie zamiennik testu; opcjonalnie Q8 dopiero jeśli CM12 FAIL po 3 próbach.

## Ważne
- [weryfikacja] CM1 nie precyzuje artefaktu gdy Q1 nieznane (E3 zablokowane) — powinno być explicite: CM1 używa **portable** z `dist/release/` (zip lub folder staging) do czasu Q1.
- [wspolbieznosc] AppUserModelID: B1 (W-Icons) + „W-Runtime współdzieli kontrakt”, implementacja w `launch.py` (W-Runtime) — brak single WRITE owner → przypisać AUMID wyłącznie W-Runtime w `launch.py`; W-Icons dostarcza tylko ICO.
- [weryfikacja] D7 redis graceful degrade bez wiersza CM — dodać CM13: cold-start bez serwera Redis (import OK, brak crash); evidence log `redis: down`.
- [ryzyko_modelowe] W1 „grep zakaz `bin/dist/`” bez kroku w E1 — dodać asercję grep w gate (FAIL jeśli skrypt release pisze pod `bin/dist/`).
- [eskalacja] Q7 trigger CM3 FAIL jest OK, ale brak mapowania Q7A („ship offline only”) vs brief cel multi-PC Synology — dopisać że Q7A = **partial ship** (runtime/installer OK, live PG wstrzymane), nie CONVERGED pełnego brief §7.
- [weryfikacja] Allowlist kopiuje całe `bin/runtime/win/python/**` — brak explicit exclude `__pycache__`/`.pyc` w runtime tree (jest w desktop exclude) → doprecyzować exclude w stage skrypt, żeby payload nie puchł i nie maskował diffów.
- [governance] A1 todo `step-A1-parent-q1-q6` pomija Q7 — kosmetyczna niespójność z §0.1 (Q7 warunkowe, OK w tekście).

## Kosmetyczne
- [jednostka_miary] Budżet QA 15–25 przebiegów vs min_rounds 10 debaty — to OK; dopiero implementacja liczy przebiegi wykonawcze.
- [kompletność_briefu] Payload nie kopiuje `apps/web/license.html` (offline legal) — opcjonalnie do allowlist jeśli UI linkuje lokalnie.
- [kontekst] Changelog R1→R2 mówi „0 po ACCEPT” — precyzyjniej „0 otwartych z R1 po ACCEPT w R2 draft”; R2 wprowadza nowe luki procesowe (CM1 profile, manifest full-tree).

## Werdykt
CONTINUE

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
