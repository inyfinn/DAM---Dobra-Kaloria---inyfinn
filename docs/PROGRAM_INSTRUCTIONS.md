# Instrukcje programu (źródło prawdy)

Newralgiczne ustalenia użytkownika **nie mogą** żyć tylko w `memory.md`.

| Warstwa | Gdzie |
|---------|--------|
| Postgres | `dam_kv_store` key `program-instructions` |
| Cache lokalny | `apps/web/data/program-instructions.json` |
| Lustro | `app-settings.json` → `instructions` |
| API | `GET /program-instructions` (bridge :8766) |
| UI | Ustawienia → **Instrukcje programu (baza)** |
| Agent | `AGENTS.md` + `.cursor/rules/program-instructions.mdc` |

## Workflow po decyzji użytkownika

1. Dopisz / zaktualizuj obiekt w `instructions[]` (`id`, `priority`, `must`, `must_not`).
2. Seed: start bridge albo `python -c "import local_bridge; local_bridge._seed_naming_policy_to_postgres()"`.
3. Zmień kod zgodnie z instrukcją.
4. Wpisz skutek do `process.md`.

## Kategorie (obecne)

- `meta` - skad brac prawde
- `data` - pochodzenie jezykow (`data.lang_provenance_only`: DK=PL; extra/GC z dowodu)
- `naming` - nosniki UI vs dysk, Multi, nie zgaduj
- `lifecycle` - F / X / D, Aktualne / Nieaktualne
- `operations` - change-log jako slad operacji
- `ui` - Geex, screenshot, em-dash, casing tagow
- `admin` / `auth` / `storage`
- `search` - osoby przy produktach (szukajka)

## Powiazane

- Jezyki: [`LANG_PROVENANCE.md`](LANG_PROVENANCE.md)
- Agenci: [`../agents/README.md`](../agents/README.md)
