# Brief — Instant + assoc + quiz (DAM)

## Cel usera
1. Poskładaj „bazę” w całość (jedna prawda skojarzeń; nie MySQL; nie MD jako silnik).
2. Instant otwieranie podstron lokalnie (szczególnie Branding) — pliki zaindeksowane, AJAX, dysk lokalny.
3. Adekwatne skojarzenia: rozpoznawać tekst na opakowaniach/wizualizacjach; nie mylić kategorii (kulki ≠ mini batony); lepiej bliskoznaczne tej samej linii niż puste lub złe.
4. Quiz admina: lewo materiał, prawo wyszukiwarka produktów; najpierw pipeline (pewne auto), potem człowiek na niepewnych; Branding → Viz → Explorer.
5. Optymalizacja kodu / nie powtarzać błędów przeszłości procesu AI.
6. **HARD (2026-08-05):** zero zależności systemowych — obcy PC bez Python/admin; wszystko w folderze; self-heal; Win+Mac (Win first).

## canonical_plan_path
`C:\Users\krzysztof.wieczorek\.cursor\plans\instant_assoc_quiz_d0bad117.plan.md`

## plan_mode
revise

## revision
9 (P0 Portable + Instant)

## min_rounds
10

## max_rounds
20

## Parent
Człowiek (user) w Cursor chat. Eskalacja: AskQuestion A/B/C + stop.

## Zakazy / doctrine (HARD)
- Em-dash ban w UI copy
- Tylko P:/DAM historycznie; teraz runtime **D:** `DAM---Dobra-Kaloria---inyfinn` (bin + apps)
- `program-instructions.json` > memory > kod
- PI `branding.assoc_adequate_not_keyword`: overrides nigdy nadpisywane OCR; adekwatność OCR+SKU+frazy; OLMOCR2 nie Ollama
- Cache-bust `?v=` w HTML po zmianie JS/CSS
- PowerShell: bez `&&`; UTF-8 bez Set-Content na PL JS
- Sync `apps/web` ↔ `bin/apps/web` gdy git vs runtime
- Nie commitować 361MB indeksów / PNG QA do gitu bez decyzji
- Budżety = przebiegi (pass/przelot), nie godziny
- WRITE sets rozłączne: nie 2 agentów na `dam-branding.js` równolegle
- 1 faza wdrożenia = 1 sesja agenta z briefem + Done gate
- UI QA: skill dam-dobrakaloria + ui-taste (screenshot+Read), min 3 przeloty wizualne
- **Zakaz** end-user MsgBox „Zainstaluj Python”; **zakaz** installer wymagający admina
- Launcher: prefer `bin/runtime/win/python/pythonw.exe`; system Python tylko `DAM_ALLOW_SYSTEM_PYTHON=1` (dev)
- Instant K0+ dopiero po `portable-win-gate.md` PASS

## Błędy przeszłości do uniknięcia (DAM + Geex cheat-sheet)
- Budowanie slim/UI przed audytem pól karty (inventory-first)
- Timebox w godzinach
- Wielu agentów na jeden CSS/JS
- „Parent” bez kanału stop
- Jedna długa sesja 0→N bez resetu kontekstu
- Brak weryfikacji per krok (CDP/curl)
- Missing script w bin HTML (bento-resize)
- Set-Content psuje polskie znaki
- Deklaracja Instant bez pomiaru cold open
- Folder spray zostawiony „na później” podczas gdy quiz UI już rośnie (zła sekwencja)

## Fakty potwierdzone (nie zgadywać dalej)
- Branding boot: full `branding-index.json` ~361MB `r.json()` main thread (`dam-branding.js` loadIndex)
- Search-index ~41MB równolegle; grid = `index.assets`
- Folder spray: `brand_folder_context.enrich_folder_groups` — sibling names → MIX na Kulki
- Scores 0–100 w `assoc_adequacy` / `branding-recognition`; NIE na published `linked_products`
- Overrides: `branding-associations-overrides.json` (~11 assets)
- LIVE DB: SQLite `dam-local.sqlite` (users/meta); nie MySQL
- `/thumb-cache` podpięty 2026-08-05; PAMIEC była pusta — warm osobno
- Quiz UI: ma sens; reuse `dam-assoc-edit` picker patterns

## Ścieżki zakazane do destrukcji bez APPROVAL
- Pełny wipe `branding-index.json`
- Nadpisanie overrides wynikami OCR
- Force-push / git config
