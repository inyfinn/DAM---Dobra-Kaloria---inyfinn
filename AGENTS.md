# AGENTS.md - mapa 3 agentow (Composer 2.5)

Przy starcie zadania w danej roli **wklej / przeczytaj** odpowiedni `AGENT.md`.

| # | Rola | Sciezka | Kiedy |
|---|------|---------|--------|
| 01 | Architect | [`agents/01-architect/AGENT.md`](agents/01-architect/AGENT.md) | ADR, DOMAIN, ROADMAP, PROGRESS, AC, blokada K21 bez ADR-002 |
| 02 | Builder | [`agents/02-builder/AGENT.md`](agents/02-builder/AGENT.md) | Laravel, Geex UI, desktop shell, jobs, Asana/Teams stub |
| 03 | QA | [`agents/03-qa/AGENT.md`](agents/03-qa/AGENT.md) | Bramka co 10 K, anty-falszywa-zielen checklisty, smoke desktop+browser |

## Przelaczanie kontekstu

1. Przeczytaj `memory.md`.
2. Wczytaj `AGENT.md` + `SOUL.md` roli.
3. Wykonaj zadanie tylko w zakresie roli.
4. Wpisz wynik do `process.md` / `PROGRESS.md`.
5. Handoff: Architect -> Builder -> QA.

## Wspolne

- Tylko `P:\DAM`
- UI = Geex THEME
- Desktop + browser
- Em-dash ban
- Auth: Entra ID / Synology LDAP + role `admin` | `power_user` | `user` (ADR-006)
