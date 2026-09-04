# Reflect — Critic runda 2 (weryfikacja rewizji R1, adversarialna)

Scope: `plan` (kanon `revision: 2`, `status: REFLECT_REVISED_PENDING_REVIEW`, bez kodu).
Krytyk **nie implementuje** i **nie edytuje** kanonu.

## Preflight (inherited z R1, re-zweryfikowany)

- `globalCriticExists: true` — bez zmian.
- Repo nadal **bez** `.cursor/agents/critic.md` (Glob: 0 wyników) i bez `strict: true` w `.cursor/rules/reflection-loop*.mdc`.
- Werdykt: **`PASS_GLOBAL_ONLY`, `blockGenerate: false`** — dziedziczony z R1, stan niezmieniony. Nie STOP.

## READ wykonany

- [x] Kanon rev2 (`dam-portable-installer-synology.plan.md`) — cały dokument, §1–§6 w tym nowe §3.0, §5.E/F/G
- [x] `agents/shared/planner-runs/dam-portable-installer-synology/session-01/reflect-round-1-critique.md` — baza 7 punktów do zweryfikowania
- [x] `agents/shared/planner-runs/dam-portable-installer-synology/session-01/planner-changelog.md` — wpis `reflect-r1 → rev2` (co Actor zmienił)
- [x] `agents/shared/planner-runs/dam-portable-installer-synology/session-01/planner-round-{5,6,7,8}-draft.md` — HISTORIA: pochodzenie `D7 Redis lib only / CM13` (sprawdzenie, czy CM13 to fabrykacja Actora czy dziedziczona decyzja — **dziedziczona**, potwierdzone R7/R8 draft)
- [x] Grep całego `session-01/*.md` i repo-`*.md` pod kątem "VM provisioning / Hyper-V / VMware / licencja Windows" — **brak wzmianek w całej 10-rundowej debacie**

---

## Krytyczne (blokują implementację)

### K1 — Infrastruktura clean-machine (VM-A/VM-B) nigdzie nie sprecyzowana — KROK 3/4/15 nie da się przekazać wykonawcom bez dodatkowej decyzji

§5.E.0 i cała macierz CM (30 ID) zakładają istnienie "VM-A" / "VM-B" ze zdolnością do **named snapshot + reset po każdym teście** (`Cleanup/reset: Snapshot reset` powtórzone w ~20 wierszach). **Żadna** runda planistyczna (1–10), żaden reflect (R1), ani rewizja R2 nie definiuje:
- na jakim hypervisorze/platformie te VM istnieją (Hyper-V / VMware / VirtualBox / cloud),
- skąd pochodzi obraz Windows 10 22H2 / 11 23H2+ (licencja, ISO, MSDN, Windows Sandbox?),
- jak wykonuje się "snapshot" i "reset" (checkpoint narzędzia, komenda).

Sprawdzone grep na całym `session-01/*.md` + repo `*.md` pod `Hyper-V|VMware|VirtualBox|VM provisio|licencj.*Windows` → **0 wyników** w 10 rundach MAD + R10 + reflect R1 + rev2.

**Dlaczego to Krytyczne, nie kosmetyka:** KROK 3 (`Pre-conditions: KROK 0`) i KROK 4 (`Pre-conditions: KROK 3`) wymagają tej infrastruktury **jako pierwsze kroki w Tier-A**, a KROK 8 ma `Pre-conditions: KROK 4 PASS` — czyli cała gałąź Runtime (KROK 8→9→10→11→14) jest **transitywnie zablokowana** przez brak decyzji o VM, mimo że formalnie żadne z KROK 0–15 "nie wymaga Q1–Q7". To jest luka **poza** systemem bramek Q, którą STOP matrix (§3.2) w ogóle nie adresuje — więc `GO Parent` "aktywne dla KROK 0–15" jest w praktyce **nieprawdziwe dla ~12 z 15 kroków**, dopóki ktoś nie podejmie osobnej (niezapisanej nigdzie) decyzji infrastrukturalnej.

**Nie jest to fabrykacja Actora ani nowy problem** — to luka, która przetrwała **całą** 10-rundową debatę MAD i pierwszą turę reflect niezauważona; dopiero adversarialne pytanie "czy KROK 0–15 da się przekazać bez dalszych decyzji" ją ujawnia (dokładnie zgodnie z intencją tego promptu).

**Zakres realnego bloku:** KROK 0,1,2,5,6,7,12,13 mogą iść na build host **bez VM** (można je oddać wykonawcy od razu). KROK 3,4,15 (i transitywnie 8–11,14, bo 8 wymaga PASS z 4) **nie mogą** ruszyć bez tej decyzji.

---

## Ważne

1. **[dowód/traceability]** `§3.0 GO Parent`: "Źródło autoryzacji... Parent powiedział... («później każ subagentom wdrożyć»)" jest **wklejonym cytatem bez kotwicy dowodowej** (brak timestamp/ID wiadomości/link do transkryptu w tej sesji `session-01`). Mechanicznie GO **nie omija** Q1–Q7 (zweryfikowane — żaden z KROK 0–15 nie ma precondition na Q, sygnatury sygnatury unsigned/lab w KROK 8/9/16 poprawnie warunkowane `Q2=A` dla lab, nie dla public) — więc punkt 2 z prośby usera jest **spełniony strukturalnie**. Ale sama autoryzacja opiera się wyłącznie na prozie w planie, nie na przywoływalnym dowodzie zewnętrznym, co jest niespójne z doktryną "evidence-only" tego repo. Rewizja: `dist/evidence/go-parent.md` (KROK 0) powinien zawierać **link/cytat z konkretnej wiadomości/tury**, nie tylko parafrazę już zapisaną w kanonie.
2. **[weryfikacja/papierowa checklista]** `secret scan` (KROK 12 i `CM10`) nigdy nie nazywa narzędzia ani reguł (gitleaks? detect-secrets? custom regex?). Claim "**0 sekretów, exit 0**" jest niefalsyfikowalny bez zdefiniowanej metody — to dokładnie ryzyko "papierowej checklisty" z adversarialnego promptu. Rewizja: dopisać w KROK 12 lub §5.E `CM10` konkretne narzędzie/regex-set (np. `gitleaks detect --no-git -v` + lista wzorców `AKIA`, `-----BEGIN.*PRIVATE KEY-----`, `password=`, connection string).
3. **[wykonalność]** `scripts/qa/validate-cm-ids.ps1` (§5.F) jest twardą bramką dla KROK 14, ale jego budowa jest przypisana tylko luźno: "W-QA tworzy przy pierwszej realizacji" — bez konkretnego KROK. Rewizja: dopisać `validate-cm-ids.ps1` jako deliverable KROK 0 lub KROK 2 (build host, nie wymaga VM), żeby KROK 14 miało z czego korzystać bez domyślnej improwizacji wykonawcy.
4. **[nieobecność, niska waga]** §5.G "Data/config backup" to checklist manualny (uczciwie nazwany, nie mylący) — żaden KROK nie automatyzuje ani nie weryfikuje, że backup faktycznie powstał przed nadpisaniem (`CM5p` sprawdza tylko kill-before-overwrite, nie backup-before-overwrite). Akceptowalne dla v1 jako świadomy zakres, ale warto to jawnie odnotować w KROK 20 DoD jako "manual, nie automatyczny" (już częściowo tak nazwane — sugestia kosmetyczna, nie blokująca).

## Kosmetyczne

- §5.F "Wejścia skanowane" ogranicza się do tekstu KROK 15/17/19/20 — odniesienia CM-ID w §5.G (np. `CM6`, `CM4b` w tabeli rollback) nie są skanowane przez `validate-cm-ids.ps1`. Nieszkodliwe (to nie nowe deklaracje, tylko cross-ref do już zwalidowanych ID), ale dla pełnej spójności można rozszerzyć zakres skanowania na cały plik.
- `CM13` ("Redis lib only") — potwierdzone jako dziedziczona decyzja `D7` z round 7/8 draft, **nie** fabrykacja tej rewizji; wciąż dość lakoniczna (nie wiadomo, gdzie dokładnie w kodzie `redis` jest importowany), ale test w §5.E jest wykonalny bez tej wiedzy (uruchom bez serwera Redis, sprawdź brak crasha).

---

## Weryfikacja 7 punktów z promptu

| # | Punkt | Status |
|---|-------|--------|
| 1 | CM-ID definicje kompletne, walidator nie liczy przykładów jako false-ref | **Potwierdzone** — 30/30 zdefiniowane = 30/30 referencje w KROK 15/17/19/20; `CM1-profile.md` jawnie wykluczony (§5.E.0 nazwa pliku ≠ CM-ID); zakres skanowania ograniczony do KROK 15/17/19/20 (redukuje false-positive) |
| 2 | GO Parent → KROK 0–15 bez obejścia bramek bezpieczeństwa | **Potwierdzone strukturalnie** (żaden precondition 0–15 nie wymaga Q; sygnatury/public release nadal warunkowane Q2) + **Ważne** (źródło autoryzacji bez kotwicy dowodowej, patrz W1) |
| 3 | CM-REG-2 wymaga CDP i screenshot+Read | **Potwierdzone** — potrojone "oraz" (§5.E wiersz, §5.D guardrails, KROK 15 weryfikacja) |
| 4 | Signing matrix precyzyjna | **Potwierdzone** — Q2=B wylicza 4 PE (installer/DAM.exe/dam-appw.exe/redist-verify); KROK 8/9/16/20 mają własne linie Signing |
| 5 | Q5 z konkretnymi TLS risks/choices | **Potwierdzone** — MITM/sniff/brak walidacji certu wymienione, wymóg zapisu akceptacji ryzyka w `parent-decisions.md` |
| 6 | Rollback user-machine/data/DB wykonalny, bez obietnicy niemożliwej backward migration | **Potwierdzone** — §5.G honestly: "nie wspieramy auto-down migrate", tylko restore z backupu/dumpu; N-1 archive + downgrade procedura opisane |
| 7 | Oryginalne cele usera nadal spełnione, brak nowych sprzeczności | **Potwierdzone** — mapowanie 15 celów briefu vs rev2 bez regresji; wzmocnione pkt 7/9/10/13/14 |

**Adversarialne pytania z promptu:**
- *30 CM-ID papierową checklistą?* — Większość ma konkretne, falsyfikowalne kryteria (exit code, hash diff, log grep, timing threshold). Wyjątek: `CM10` (secret scan) — narzędzie niezdefiniowane → patrz Ważne #2.
- *Artifact paths/evidence konkretne?* — Tak, w zdecydowanej większości (`dist/evidence/cm/<ID>/`, nazwane pliki). Miękkie miejsce: `secret-scan.log` (narzędzie nieznane).
- *KROK 0–15 przekazywalne wykonawcom bez dalszych decyzji?* — **NIE w pełni** — patrz Krytyczne K1 (VM-A/VM-B infra). KROK 0,1,2,5,6,7,12,13 tak; KROK 3,4,15 (i transitywnie 8–11,14) nie, dopóki nie padnie decyzja o platformie VM.

---

## Rozdzielenie statusów

| Element | Stan | Dowód |
|---|---|---|
| Rewizje R1 zaaplikowane w kanonie | [x] | rev2 §3.0, §5.E/F/G, `planner-changelog.md` wpis reflect-r1→rev2 |
| Bramka Reflect Critic R2 (ta tura) | [ ] REVISE | K1 VM infra + 4 Ważne |
| Implementacja | [ ] nierozpoczęta | todos = `pending`; brak plików w `dist/` |
| Runtime user | [ ] N/A | zgodnie z zakresem tej tury |

## Tryby (1–5)

1. **DOWÓD:** Rewizje R1 mają konkretny dowód tekstowy w kanonie (cytaty w tabeli wyżej) — nie "powinno działać". Jedyny słaby dowód to sama autoryzacja `GO Parent` (prozaiczna, bez kotwicy) i `secret scan` (brak narzędzia = brak dowodu metody).
2. **HISTORIA:** VM infra — potwierdzona luka **od round 1 do R2 włącznie**, nigdy nie zaadresowana (nie jest to regresja z konkretnej rundy, to stała nieobecność). `CM13`/Redis zweryfikowane jako dziedziczone z R7/R8 (`D7`), nie nowa fabrykacja.
3. **DIAGNOZA vs WDROŻENIE:** Czysto rozdzielone — cały dokument nadal `status: REFLECT_REVISED_PENDING_REVIEW`, `todos: pending`.
4. **RETORYKA vs TREŚĆ:** Rewizje R1→rev2 to **realne zmiany treści** (nowe sekcje §3.0/§5.E/F/G, nie tylko przeformułowania) — Actor faktycznie zmienił dokument, nie tylko zgodził się słownie. Potwierdzone jako prawdziwa Revise, nie retoryka.
5. **NIEOBECNOŚĆ:** (a) VM/CM infra provisioning (K1); (b) kotwica dowodowa dla GO Parent (W1); (c) nazwa narzędzia secret-scan (W2); (d) KROK przypisany dla budowy `validate-cm-ids.ps1` (W3).

---

## Werdykt: **REVISE**

1 Krytyczne (K1 — infrastruktura VM-A/VM-B nigdzie nieokreślona, blokuje transytywnie ~12/15 kroków Tier-A) + 4 Ważne. Zgodnie z kontraktem: PASS tylko przy 0 Krytycznych.

**Co oddać userowi mimo REVISE:**
- Wszystkie 7 rewizji z R1 zostały **rzeczywiście i poprawnie zaaplikowane** — CM legenda, GO Parent (mechanika bramek), CM-REG-2, signing matrix, Q5 ryzyka, rollback — żadnych regresji względem R1 ACCEPT.
- KROK 0, 1, 2, 5, 6, 7, 12, 13 (build host, bez VM) **można przekazać wykonawcom od razu**, bez dalszych decyzji.
- Jedyny nowy blocker (K1) jest wąski i punktowy: potrzebna **jedna decyzja** (platforma VM + źródło obrazu) zanim KROK 3/4/15 (i transitywnie 8–11/14) ruszą — to nie wymaga kolejnej pełnej rundy MAD, tylko jednej odpowiedzi Parenta/executora.

### Konkretne rewizje do kanonu (do wykonania przez orchestrator/Parent, NIE przez tego krytyka)

1. Dodać do §3.0 lub nowy §3.0.1 "VM Infrastructure": nazwać platformę (np. Hyper-V lokalny / istniejący lab) + źródło obrazu Windows + komendę snapshot/reset — **lub**, jeśli taka infra już istnieje poza tym dokumentem, dodać jedno zdanie wskazujące gdzie/jak jest dostępna (ścieżka, narzędzie), żeby KROK 3/4/15 miały wykonalny start.
2. `dist/evidence/go-parent.md` (KROK 0): wymóg wklejenia werbatim cytatu/odnośnika do konkretnej wiadomości Parenta z timestampem, nie tylko odniesienia do parafrazy w planie.
3. KROK 12 / `CM10` (§5.E): nazwać konkretne narzędzie/reguły secret-scan.
4. Przypisać budowę `scripts/qa/validate-cm-ids.ps1` do konkretnego KROK (0 lub 2), nie "przy pierwszej realizacji".
5. (Kosmetyczne, opcjonalne) Rozszerzyć zakres skanowania `validate-cm-ids.ps1` o §5.G dla pełnej spójności.

---
Przygotowano przy użyciu Claude Sonnet 5 Thinking
