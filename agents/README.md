# Agenci DAM ETA

Trzy role (Composer 2.5) + wspolne reguly. Przy starcie zadania: przeczytaj [`AGENTS.md`](../AGENTS.md), potem `AGENT.md` + `SOUL.md` roli.

## Mapa rol

| # | Rola | Folder | Zakres |
|---|------|--------|--------|
| 01 | Architect | [`01-architect/`](01-architect/) | ADR, DOMAIN, ROADMAP, PROGRESS, Acceptance Criteria. Nie pisze produkcyjnego kodu `apps/*` bez ADR. |
| 02 | Builder | [`02-builder/`](02-builder/) | Jedyny implementer: Laravel, Geex UI, desktop shell, bridge, indeks plikow, joby. |
| 03 | QA | [`03-qa/`](03-qa/) | Bramki GATE, anty-falszywa-zielen, smoke desktop+browser, screenshot UI. |

Handoff: **Architect -> Builder -> QA**.

## Pliki w kazdej roli

| Plik | Rola |
|------|------|
| `AGENT.md` | Tozsamosc, misja, hard constraints, DoD, eskalacja, handoff (front matter YAML). |
| `SOUL.md` | Misja / KPI / swoboda w krotkiej formie. |

## Wspolne (shared)

| Plik | Temat |
|------|--------|
| [`shared/lang-provenance.md`](shared/lang-provenance.md) | **Kanon:** skad bierze sie kod jezyka (DK=PL + extra z dowodu; GC bez zgadywania). |
| [`shared/lang-provenance.DRAFTS.md`](shared/lang-provenance.DRAFTS.md) | 3 podejscia robocze (kaskada / evidence / provenance). |

Lustro dla ludzi: [`docs/LANG_PROVENANCE.md`](../docs/LANG_PROVENANCE.md).

## Skad agenci biora prawde (kolejnosc)

1. **`program-instructions`** (Postgres KV + cache `apps/web/data/program-instructions.json`) - newralgiczne reguly biznesowe.
2. **`memory.md`** - notatka operacyjna (przy konflikcie wygrywa program-instructions).
3. **`AGENT.md` + `SOUL.md`** roli.
4. Kod i dysk Marketing (read-only) jako dowod faktow.

Dokument: [`docs/PROGRAM_INSTRUCTIONS.md`](../docs/PROGRAM_INSTRUCTIONS.md).

## Hard rules wspolne (skrot)

- Scope zapisu: `P:\DAM` (Marketing tylko odczyt przy indeksie).
- UI = Geex THEME; em-dash ban (`-` zamiast dlugich myslnikow).
- Po zmianie wizualnej: screenshot + Read (nie oddawac "na oko").
- Jezyki: patrz `shared/lang-provenance.md`.
- Reczne override (`lang-overrides.json` i inne) nigdy nie kasuj rebuildem.

## Logowanie pracy

| Plik | Co |
|------|-----|
| [`../process.md`](../process.md) | Log + proces (kroki, efekt, test). |
| [`../PROGRESS.md`](../PROGRESS.md) | Postep roadmapy / GATE. |
| [`../memory.md`](../memory.md) | Trwale zasady i niuanse. |

## Checklist startu sesji

1. `GET` / odczyt `program-instructions`.
2. `memory.md` (sekcje HARD + najnowsze numery).
3. `AGENT.md` swojej roli.
4. Jesli temat jezykow / tagow rynkow: `shared/lang-provenance.md`.
5. Po pracy: `process.md` (+ PROGRESS gdy GATE).
