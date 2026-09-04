# Critique round 1
## Krytyczne
- [sekwencja] KROK 7–8 (SQLite+API) są przed quizem OK, ale KROK 5–6 (spray/refilter) zapisują jeszcze do JSON index bez jasnego mostu „po K7 seed nadpisze / zmerguje pending” → dodaj jawny krok merge: refilter output → seed input, nie dwa równoległe SoT.
- [wspolbieznosc] Faza A i C obie WRITE `local_bridge.py` → konflikt. Poprawka: Faza A tylko nowy plik helper `branding_asset_api.py` importowany przez bridge ALBO Faza C łączy asset+assoc routes w jednej sesji po A; nie równolegle A∥C na tym samym pliku.
- [weryfikacja] Instant gate `baseline_ms * 0.15` może być nierealne gdy baseline=60s → 9s nadal „pass” vs cel &lt;2s. Poprawka: HARD `cold_ms < 2500` absolutnie na D: lokalnym; relative tylko jako soft metric.
- [kompletnosc_briefu] Brief: quiz Branding → Viz → Explorer. Draft ma Viz/Explorer tylko w „poza zakresem” bez follow-up kroku z Done gate. Poprawka: KROK 12 follow-up (ten sam DamAssocQuiz, entry points) status=pending deferred, nie zniknąć z todos.
- [zasoby] Generator slim przy pełnym 361MB w pamięci może OOM. Poprawka: stream ijson / chunked; weryfikacja peak RAM; nie `json.load` całego indexu jeśli uniknione.

## Ważne
- [eskalacja] Brak jawnego kanału pliku `ESCALATE.md` w session — dopisz „stop + wpis process.md + AskQuestion”.
- [kontekst] 1 faza=1 sesja OK, ale brak checklisty wejścia sesji B (brief+instant-gate.md+tag). Dopisz.
- [ryzyko_modelowe] Orchestrator zastąpił Grok — oznacz w kanonie `plannerNote: grok_unavailable_orchestrator_draft`; Parent świadomy.
- [sekwencja] Fallback gdy brak slim: draft nie mówi czy boot ma fail-loud czy tymczasowy full. Decyzja: fail-loud + komunikat „uruchom build-branding-grid-index” (nie ciche 361MB).
- [governance] Przejście A→B wymaga Parent APPROVAL jeśli Instant gate FAIL; jeśli PASS — auto. Doprecyzuj.

## Kosmetyczne
- Nazwa todo `step-11-docs` vs KROK 12 follow-up — wyrównaj numerację.
- Mermaid OK; dodać edge k6→k7 „seed from refilter artifact”.

## Werdykt
CONTINUE

Przygotowano przy użyciu Critic inline (orchestrator; Composer Task niedostępny — limit użycia).
