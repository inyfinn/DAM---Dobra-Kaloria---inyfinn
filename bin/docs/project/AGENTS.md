# AGENTS.md - mapa 3 agentow (Composer 2.5)

> **CZYTAJ ZAWSZE NAJPIERW:** [`agents/shared/code-doctrine.md`](agents/shared/code-doctrine.md)
> to WYKLADNIA KODU DAM - jak czytac ten kod, dlaczego jedno dziala a inne nie,
> pulapki (cache-busting, z-index warstw, IntersectionObserver + clip-path,
> wspolbiezni agenci, weryfikacja CDP vs screenshot). Obowiazkowa lektura przed
> KAZDA zmiana w `apps/web/**`. Po rozwiazaniu nowego, nieoczywistego problemu
> DOPISZ lekcje w sekcji 12 tego dokumentu.
>
> **SKILL projektu: `dam-dobrakaloria`** (Cursor Agent Skill) - doktryna + praktyki
> + obowiazkowa petla weryfikacji: kod -> test (node --check / CDP) ->
> screenshot+Read -> poprawka = 1 PRZELOT (tura/pass/podejscie); minimum 3 przeloty
> na zadanie wizualne; RUNDA = seria przelotow na jednym elemencie do czysta.
> Jesli masz ten skill dostepny - uzyj go przy kazdym zadaniu w tym repo.

Pelna dokumentacja: [`agents/README.md`](agents/README.md).  
Przy starcie zadania w danej roli **wklej / przeczytaj** odpowiedni `AGENT.md`.

| # | Rola | Sciezka | Kiedy |
|---|------|---------|--------|
| 01 | Architect | [`agents/01-architect/AGENT.md`](agents/01-architect/AGENT.md) | ADR, DOMAIN, ROADMAP, PROGRESS, AC, blokada K21 bez ADR-002 |
| 02 | Builder | [`agents/02-builder/AGENT.md`](agents/02-builder/AGENT.md) | Laravel, Geex UI, desktop shell, jobs, Asana/Teams stub |
| 03 | QA | [`agents/03-qa/AGENT.md`](agents/03-qa/AGENT.md) | Bramka co 10 K, anty-falszywa-zielen checklisty, smoke desktop+browser |

## Przelaczanie kontekstu

1. **NAJPIERW** przeczytaj instrukcje programu z bazy / cache:
   - plik: [`apps/web/data/program-instructions.json`](apps/web/data/program-instructions.json)
   - Postgres KV: `dam_kv_store.program-instructions`
   - API bridge: `GET http://127.0.0.1:8766/program-instructions`
   - UI: `settings.html#damProgramInstructions`
2. Przeczytaj `memory.md` (notatka operacyjna - przy konflikcie wygrywa `program-instructions`).
3. Wczytaj `AGENT.md` + `SOUL.md` roli.
4. Wykonaj zadanie tylko w zakresie roli.
5. Wpisz wynik do `process.md` / `PROGRESS.md`.
6. Handoff: Architect -> Builder -> QA.

## Newralgiczne reguly = BAZA (nie tylko memory)

Po **kazdej** krytycznej decyzji uzytkownika (nazewnictwo, status F/X/D, aktywny/nieaktywny, zakazy UI, privilege):

1. Dopisz / zaktualizuj wpis w `program-instructions.json` (`id`, `priority`, `must` / `must_not`).
2. Wypchnij do Postgres (start bridge robi seed; albo `_seed_naming_policy_to_postgres()`).
3. Dopiero potem zmieniaj kod.
4. Lustro skrotu: `app-settings.json` → pole `instructions`.

Bez tego agent "zapomina" miedzy sesjami i robi cos innego.

## Wspolne

- Layout: `D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn` = GIT_ROOT (`DAM.exe` + git); kod/dane = `...\bin` (CONTENT_ROOT). Od 2026-08-05 primary = **D**, nie `P:\DAM`.
- UI = Geex THEME (`bin\THEME\geex-html-main`; kit reusable: `bin\THEME\inyfinn-geex-kit`)
- Desktop + browser
- Em-dash ban
- Auth: Entra ID / Synology LDAP + role `admin` | `power_user` | `user` (ADR-006)
- DB (2026-08-03): SQLite only do powrotu Synology; multi-PC live wymaga PG na NAS
- **Weryfikacja UI:** po zmianach wizualnych zawsze screenshot + Read (regula `.cursor/rules/verify-ui-after-changes.mdc`). Bez tego nie oddawac.
- **Serwery przed przeglądarką (HARD):** `:8765` i `:8766` muszą dać HTTP 2xx w **5 s** (`scripts/ops/smoke-dam-ports.ps1` lub curl `--max-time 5`). Brak odpowiedzi = restart `python bin/apps/desktop/serve_browser.py` (z GIT_ROOT) albo `python apps/desktop/serve_browser.py` (z CONTENT_ROOT), potem kontynuuj. Nigdy nie wisieć na navigate; timeout = napraw, nie czekaj. Reguła: `.cursor/rules/server-timeout-never-hang.mdc`, doktryna §5.0.
- **Instrukcje programu:** `program-instructions` w KV (patrz wyzej).
- **Pochodzenie jezykow (HARD):** [`agents/shared/lang-provenance.md`](agents/shared/lang-provenance.md) - rozumiesz skad bierze sie kod (folder/plik/override), nie hardcodujesz produktu. Drafty 3 podejsc: [`lang-provenance.DRAFTS.md`](agents/shared/lang-provenance.DRAFTS.md).
