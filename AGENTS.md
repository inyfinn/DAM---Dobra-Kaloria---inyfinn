# AGENTS.md - mapa 3 agentow (Composer 2.5)

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

- Tylko `P:\DAM`
- UI = Geex THEME
- Desktop + browser
- Em-dash ban
- Auth: Entra ID / Synology LDAP + role `admin` | `power_user` | `user` (ADR-006)
- **Weryfikacja UI:** po zmianach wizualnych zawsze screenshot + Read (regula `.cursor/rules/verify-ui-after-changes.mdc`). Bez tego nie oddawac.
- **Instrukcje programu:** `program-instructions` w KV (patrz wyzej).
- **Pochodzenie jezykow (HARD):** [`agents/shared/lang-provenance.md`](agents/shared/lang-provenance.md) - rozumiesz skad bierze sie kod (folder/plik/override), nie hardcodujesz produktu. Drafty 3 podejsc: [`lang-provenance.DRAFTS.md`](agents/shared/lang-provenance.DRAFTS.md).
