# Reflect — Critic runda 1 (niezależna kontrola po 10-rundowym /planner)

Scope: `plan` (kanon bez kodu, `plan_mode: create-completed`, status `CONVERGED`).
Krytyk **nie implementuje** i **nie edytuje** kanonu — tylko ocena.

## Preflight

```
node ~/.cursor/skills/reflection-loop/scripts/test-preflight.js
```

- `globalCriticExists: true` (`~/.cursor/agents/critic.md` obecny).
- Repo (`DAM---Dobra-Kaloria---inyfinn`) **nie ma** `.cursor/agents/critic.md` (Glob: 0 wyników) ani `.cursor/rules/reflection-loop*.mdc` ze `strict: true` (Glob: 0 wyników).
- Kontrakt (T1 w self-teście skryptu): brak overlay + brak strict → **`PASS_GLOBAL_ONLY`**, `blockGenerate: false`.
- **Werdykt preflight: `PASS_GLOBAL_ONLY` — blockGenerate = false.** Pętla idzie na global discovery READ (bez pamięci regresji specyficznej dla overlay projektu, ale z pełnym `AGENTS.md`/`memory.md`/`code-doctrine.md` tego repo, patrz READ niżej). Nie STOP.

## READ wykonany

- [x] `AGENTS.md` — mapa 3 agentów, HARD reguły (server-timeout §5.0, PI przed decyzją biznesową, GIT_ROOT/CONTENT_ROOT, em-dash ban)
- [x] `memory.md` (grep targetowany: portable/installer/DDNS/AUMID/CRT/TLS/Synology) — Portable HARD (`bin\runtime\win\python`), fat `branding-index.json` OUT ładowania UI, SQLite-only do powrotu Synology, DDNS-first + CGNAT/Tailscale fallback (#84–85), reflection-loop overlay note (brak w tym repo — potwierdzone)
- [x] `agents/shared/code-doctrine.md` §1, §5.0, §6 — dwa procesy tła `:8765`/`:8766`, HARD GATE serwery-przed-przeglądarką, kolejność CDP→screenshot, model danych `file-index`/`branding-index`
- [x] `agents/shared/planner-runs/dam-portable-installer-synology/session-01/brief.md` — 15 celów HARD usera, fakty audytu, zakazane ścieżki
- [x] `agents/shared/planner-runs/dam-portable-installer-synology/session-01/planner-round-10-critique.md` — baza zamknięcia 2K+7W z R9, 5 Ważnych nonblocking wniesionych do kanonu
- [x] `agents/shared/planner-runs/dam-portable-installer-synology/session-01/planner-round-{3,4,5,6}-draft.md` — HISTORIA: wcześniejsze rundy miały tabelę definicji CM-ID (patrz Krytyczne #1)
- [x] Kanon: `C:\Users\krzysztof.wieczorek\.cursor\plans\dam-portable-installer-synology.plan.md` — cały dokument

Brak `.cursor/agents/critic.md` w repo → global discovery, ≥3 warstwy (Polityka=AGENTS.md, Architektura/Historia=code-doctrine+planner-runs, Operacyjne=memory.md) — nie jest to "cienkie docs".

---

## Krytyczne (blokują implementację)

### K1 — Zaginiona legenda testów CM-ID (regresja jakości między rundami, evidence-only naruszone)

KROK 15/17/19 (i pośrednio DoD KROK 20) wymieniają dziesiątki identyfikatorów testów **bez definicji**:

> KROK 15: `CM1a, CM-double-bootstrap, CM-bypass, CM-slow-VM, CM-hijack, CM12a, CM-heal-*, CM7a–e (...), CM8 native missing_runtime, CM5p (...), CM10/10b/13, CM-REG-1 (...), CM-REG-2 (...), verify-manifest.`

Żadna sekcja kanonu (§4 KROK 15/17/19, §5 Załączniki) nie definiuje **co dokładnie** każdy ID testuje (maszyna, precondition, expected, evidence). To **nie jest nowy problem planowania** — to udokumentowana **regresja** względem wcześniejszych rund tej samej debaty:

- Round 3 draft (linia 331): pełna tabela `ID | VM | Precondition | Expected | Evidence` dla `CM1a` i innych.
- Round 6 draft §F (linie 218–233): skrócona, ale wciąż czytelna tabela `ID | Expected` obejmująca ~15 kodów (`CM1a`, `CM12`, `CM7e`, `CM7a–d`, `CM-heal-*`, `CM5p`, `CM3`, `CM4/CM4b`, `CM8–CM13`...).
- Round 10 (kanon): tabela **zniknęła całkowicie** — same skróty w zdaniu ciągłym, bez opisu, bez odesłania do R6/R3.

Żadna krytyka R4–R10 nie złapała tego zaniku (R4/R5/R6 krytykowały *treść* poszczególnych CM, nie fakt, że tabela przestanie istnieć w finalnym dokumencie wykonawczym). To jest luka w trybie **HISTORIA** — plan powtarza wzorzec "kompresja podczas konwergencji gubi operacyjny szczegół", nieudokumentowany explicite w `planner-changelog.md`.

**Dlaczego to blokuje implementację, nie jest kosmetyką:** kanon sam narzuca `Evidence-only; deklaracje bez plików = FAIL` (§1) i `Weryfikacja: Wszystkie CRITICAL PASS z plikami` (KROK 15). Bez definicji `CM-hijack`, `CM10/10b/13`, `CM-heal-*` wykonawca (W-QA, inny agent niż planista) **nie ma jak** wyprodukować spójnego evidence — każdy z 3 workerów (Runtime/Pack/QA wg ownership §2.3) może zinterpretować te same skróty inaczej, co realnie zagraża DoD KROK 20 (bramka wymaga literalnie "KROK 15 PASS").

**Dowód, czego to NIE jest:** to nie brak w architekturze (§2.2 mermaid jest kompletny) ani w bramkach Q (§3 kompletne A/B/C) — to wyłącznie brak specyfikacji testów w warstwie wykonawczej §4.

---

## Ważne

1. **[architektura/kompletność_briefu] "GO Parent" — niedefiniowana makro-bramka vs Q1–Q7 mikro-bramki.** Front-matter (`note`) i §6 mówią "Implementacja nie startuje przed GO Parent", ale §3.2 STOP matrix definiuje bramki **wyłącznie** per-Q dla KROK 16–19 (Tier-A KROK 0–15 ma `Pre-conditions: Brak` wszędzie poza KROK 4→3, 8→4/6/7 itd. — żadna zależy od zbiorczego "GO"). Brak w kanonie jednej linii definiującej **czym jest "GO Parent"** (np. wpis w `dist/evidence/`, komunikat usera, checkbox) grozi dwoma przeciwstawnymi błędami wykonawcy: (a) czeka na nieformalny sygnał i blokuje KROK 0–15 mimo że STOP matrix na to pozwala — sprzeczne z celem usera "wdrożenie natychmiast po planie"; (b) startuje bez autoryzacji, bo "GO" nigdzie nie jest zoperacjonalizowane. Rewizja: 1 zdanie w §3.2 lub Kontrakt §C: *"GO Parent = jawna wiadomość Parenta 'start realizacji' zapisana w `dist/evidence/k0-setup.log`; niezależna od i wcześniejsza niż odpowiedzi Q1–Q7."*

2. **[weryfikacja] CM-REG-2 osłabia evidence-only przez spójnik "lub".** KROK 15: *"CM-REG-2 (1-liniowy checklist PASS: quiz / titles / gazetka — screenshot **lub** CDP note per powierzchnia)"*. Doktryna (`code-doctrine.md` §5.0) wymaga kolejności **najpierw CDP (dowód logiczny) → potem screenshot+Read (wygląd)**, nie alternatywy. "Lub" pozwala wykonawcy zaliczyć regresję samym screenshotem (podatnym na stale-frame gotcha, §5.0 pkt 2) bez pomiaru DOM. Rewizja: zmienić na *"CDP note (stan DOM/wynik) **oraz** screenshot per powierzchnia"*.

3. **[bezpieczeństwo] Zakres podpisywania (Q2) niejasny — installer vs bootstrap/engine exe.** Q2 dotyczy jawnie "Signing / SmartScreen?" przy KROK 16 (installer), ale KROK 8 (Go bootstrap `DAM.exe`, publiczny entry point) i KROK 9 (`dam-appw` onedir engine) nie mają własnej linii "Signing" ani odniesienia do Q2. Jeśli Parent wybierze Q2=B (Authenticode), a podpisany zostanie tylko `DAM-Setup-<ver>.exe`, to **sam `DAM.exe`** (uruchamiany po instalacji, jedyny public entry) może nadal wywoływać SmartScreen — pudrowanie problemu, nie rozwiązanie. Rewizja: dopisać w KROK 8 i/lub KROK 16 zdanie: "Q2=B obejmuje podpisanie installera **i** `DAM.exe`/`dam-appw.exe` (wszystkie PE w payload) — jeden cert, batch-sign w release-gate."

4. **[bezpieczeństwo/nieobecność] Q5 (TLS) nie ujawnia ryzyka w treści pytania.** Opcja A ("TCP 5433 bez force TLS") oznacza ruch DB przez publiczny DDNS/Internet bez szyfrowania, jeśli Parent nie zna konsekwencji z samego tekstu AskQuestion. Rewizja kosmetyczna, ale zgodna z "zero silent default" w duchu — dopisać do Q5 A: *"(ruch idzie przez WAN/DDNS bez TLS — akceptowalne tylko jeśli VPN/Tailscale plan §85 memory.md wdrożony później)"*.

5. **[kompletność_briefu] Rollback pokrywa tylko build-time (git), nie już-wdrożoną maszynę użytkownika.** Brief cel #14 = "Rollback/recovery + versioning". Kolumna "Rollback" per KROK to wyłącznie `git checkout`/`git reset`/usuń staging — nic o downgrade zainstalowanej wersji na maszynie usera (np. zachowanie poprzedniego portable ZIP / poprzedniego `DAM-Setup-<ver-1>.exe` w `dist/release/` jako fallback, albo procedura "zainstaluj starszą wersję nad nowszą"). KROK 17 CM6 testuje tylko czyste odinstalowanie, nie downgrade. Rewizja: dopisać do KROK 20 DoD lub KROK 17 wymóg zachowania N-1 artefaktu release + 1-liniową procedurę downgrade w README.

## Kosmetyczne

- Front-matter todos: `step-20-dod` (ostatni wpis, linie 86–87) **nie ma** pola `status: pending`, w przeciwieństwie do pozostałych 20 wpisów — niespójność schematu, łatwa do naprawienia przy najbliższym UPDATE kanonu.
- Nazewnictwo: user w prompcie mówi "20 kroków", kanon i R10-critique mówią "21 krokami" (KROK 0–20 inclusive) — brak realnej rozbieżności, tylko różne liczenie od zera.

---

## Rozdzielenie statusów

| Element | Stan | Dowód |
|---|---|---|
| Diagnoza (10-rundowy MAD) | [x] | `planner-round-10-critique.md` CONVERGED 0 Krytyczne |
| Bramka Critic R1 (ta tura) | [ ] REVISE | K1 legenda CM-ID + 5 Ważnych wyżej |
| Implementacja | [ ] nierozpoczęta | `status` w kanonie = todos `pending`; brak plików w `dist/` poza planner-runs |
| Runtime user | [ ] N/A | Nic nie zbudowano — zgodnie z zakresem tej tury |

## Tryby (1–5)

1. **DOWÓD:** Kanon nie zawiera fałszywych claimów PASS na runtime/kodzie — `status: CONVERGED` dotyczy wyłącznie procesu planistycznego (MAD 10/10), poprawnie odseparowane od `todos: pending`. Jedyny "dowód" wymagający kontroli to sama struktura CM-testów (K1) — obecnie nie da się zweryfikować, że evidence z KROK 15 faktycznie zmierzy to, co deklaruje, bo nie ma specyfikacji testu.
2. **HISTORIA:** Tak, znaleziono konkretną regresję — utrata tabeli definicji CM-ID między round-6-draft §F i round-10 (kanon). Nie jest to spekulacja: dwa pliki w `session-01/` to bezpośredni dowód (cytaty wyżej).
3. **DIAGNOZA vs WDROŻENIE:** Czysto rozdzielone — cały dokument to plan, żaden KROK nie jest oznaczony jako wykonany, `note` frontmatter jawnie mówi "Implementacja dopiero po GO Parent".
4. **RETORYKA vs TREŚĆ:** N/A — pierwsza runda Critic niezależna od 10-rundowego `/planner` (inny mechanizm, inny model), nic do porównania z wcześniejszą zgodą.
5. **NIEOBECNOŚĆ:** Brak (a) legendy CM-ID w §4/§5 (K1), (b) definicji "GO Parent" jako triggera (W1), (c) linii signing dla `DAM.exe`/`dam-appw.exe` poza installerem (W3), (d) procedury downgrade na maszynie usera (W5).

---

## Werdykt: **REVISE**

Jeden Krytyczny (K1 — legenda CM-ID) + 5 Ważnych. Zgodnie z kontraktem `critic-core.md`: choć jeden CRITICAL blokuje PASS.

**Co oddać userowi mimo REVISE (max 3):**
- Architektura, bramki Q1–Q7 i sekwencja KROK są solidne i wewnętrznie spójne (STOP matrix poprawnie ogranicza gate'y wyłącznie do KROK 16–19).
- Fazy KROK 0–15 (Tier-A portable) można bezpiecznie rozpocząć **od razu**, bez czekania na Q1–Q7 — potwierdzone przez STOP matrix §3.2.
- Jedyna twarda blokada to brakująca specyfikacja testów CM w §4/§5 — punktowa poprawka (przywrócić/odtworzyć tabelę z round-6-draft §F, zaktualizowaną o R7–R10 dodatki jak CM-REG-1/2), nie przeprojektowanie planu.

### Konkretne rewizje do kanonu (do wykonania przez orchestrator/Parent, NIE przez tego krytyka)

1. Dodać do kanonu (nowa sekcja §5.D lub aneks) tabelę `CM-ID | Maszyna/precondition | Expected PASS/FAIL | Evidence path` dla wszystkich ID używanych w KROK 15/17/19 — bazę wziąć z `planner-round-6-draft.md` §F i uzupełnić o `CM-REG-1`, `CM-REG-2`, `CM12b`, `CM5`/`CM6` z R9–R10.
2. Dopisać 1 zdanie definiujące trigger "GO Parent" (§3.2 lub Kontrakt §C) — oddzielić od Q1–Q7.
3. KROK 15 CM-REG-2: zamienić "screenshot **lub** CDP note" na "CDP note **oraz** screenshot" (zgodność z code-doctrine §5.0).
4. KROK 8/16: dopisać, że zakres Q2=B (signing) obejmuje `DAM.exe` + `dam-appw.exe`, nie tylko installer.
5. Q5 (§3.1): dopisać krótką notę o ryzyku ruchu bez TLS przez WAN/DDNS w opcji A.
6. Brief cel #14 (rollback): dopisać do KROK 17/20 wymóg zachowania N-1 artefaktu release + procedura downgrade.
7. Frontmatter todos: dodać brakujące `status: pending` do `step-20-dod`.

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
