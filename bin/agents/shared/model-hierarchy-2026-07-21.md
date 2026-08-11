# Hierarchia modeli (HARD, 2026-07-21)

Lustro globalnej reguły `~/.cursor/rules/model-grok-composer-only.mdc` + `memory.md` hard #13.

## Ranking

| Model | Ranga | Do czego się nadaje | Kluczowy dowód |
|-------|-------|---------------------|----------------|
| Fable 5 | Najwyższa | Architektura, ocena UX/UI, długie autonomiczne sesje, smak projektowy | Architectural judgment / planning taste |
| Sonnet 5 | Wysoka | Code review, czystość komentarzy, precyzyjne poprawki | Review workflows |
| GPT-5.6 Sol | Wysoka | Długie, wieloetapowe implementacje wielu plików, dociąganie do końca | Long-horizon coding |
| Opus 4.8 | Wysoka | Instruction following, rozumowanie architektoniczne, pipeline'y | Trzymanie się specyfikacji |
| Cursor Grok 4.5 | Średnio-wysoka | Szybkie fixy, refaktory, tanie/masowe zadania, briefy WORKER | Koszt/jakość; warstwa robotnicza |
| Composer 2.5 | Średnia | Szybkie interaktywne / background; **preferuj read-only second eyes** | Nie Lead dużych wieloagentowych planów |

## Routing workflow

- Audyt UI / UX / planowanie refaktoru → **Fable 5**
- Dobrze opisana lista poprawek w wielu plikach → **GPT-5.6 Sol**
- Review → **Sonnet 5**; pipeline/spec → **Opus 4.8**
- Briefy B/C, masowe fixy → **Grok 4.5**
- Druga para oczu na diff (bez WRITE) → **Composer 2.5**

## Parent vs subagenci

- Parent = model z UI usera (nie auto-switch na Grok).
- Task default: `cursor-grok-4.5-high-fast` (alt. `composer-2.5-fast`), chyba że user nadpisze.

## Kompensacja gdy brak wyższej rangi

1. Mniejsza granulacja (sub-checkpointy + commit/tag).
2. Wymuszone self-checki (cytat reguły przed ryzykowną zmianą).
3. Composer (lub inny) read-only review przed tagiem fazy wysokiego ryzyka.
