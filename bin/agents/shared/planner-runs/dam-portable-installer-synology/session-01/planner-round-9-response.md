# Planner response — round 9

Źródło: `planner-round-9-critique.md` (werdykt CONTINUE; REBUT W6 zaakceptowany przez Critica — brak tie).

## Krytyczne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| K1 | weryfikacja | HKCU RunOnce vs elevated Program Files | **ACCEPT** | Usuwamy DPAPI/RunOnce. **Jednoznacznie:** po vc_redist 3010 installer kończy jako reboot-required; po restarcie user uruchamia **ten sam podpisany installer**; idempotent detect VC++ → atomowe dokończenie; skróty/app **dopiero po complete**. |
| K2 | weryfikacja | A0-UIA tooling na clean VM | **ACCEPT** | QA-tools bootstrap (pinned hashes, poza release payload) na PoC/CM VM **przed** testem; clean = brak app deps, nie brak QA tools. Narrator mandatory + UIA export z pinned tools. |

## Ważne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| W1 | weryfikacja | dumpbin na build host | **ACCEPT** | Evidence `prep-dll-dependents.json`; CM tylko konsumuje. |
| W2 | weryfikacja | Double dam-appw bypass | **ACCEPT** | README + CM-bypass scope = bootstrap path only. |
| W3 | weryfikacja | DPAPI meta vs blob | **ACCEPT / N/A** | Mechanizm usunięty na rzecz manual re-run (K1) — punkt nieaktualny. |
| W4 | kompletność_briefu | CM-REG-1 brief §10 | **ACCEPT** | Smoke branding cold path w Tier-A. |
| W5 | weryfikacja | icons-matrix DoD | **ACCEPT** | |
| W6 | weryfikacja | example LAN dopiero po Q4 | **ACCEPT** | |
| W7 | governance | Parent checklist przed E/D/G | **ACCEPT** | Portable-only CONVERGED ≠ §8 DONE. |

## Kosmetyczne

| # | Werdykt | Notatka |
|---|---------|---------|
| Ko1 MAD 10/10 | **ACCEPT** | R10 = min_rounds. |
| Ko2 logo poza tab chain | **ACCEPT** | Dekoracyjne Image — skip OK. |
| Ko3 mt.exe na build host | **ACCEPT** | Pin w PREP docs. |

## Liczniki

- **ACCEPT krytyczne:** 2 · **REBUT:** 0  
- **ACCEPT ważne:** 7 · **REBUT:** 0 (W3 supersede usunięciem DPAPI)  
- **Kosmetyczne:** 3 ACCEPT  
- **K+W:** **9 ACCEPT / 0 REBUT**

## Tie / otwarte krytyczne

- **0 krytycznych otwartych** po ACCEPT.  
- Parent Q1–Q7 nadal otwarte jako bramki implementacji (nie blokują CONVERGED architektury planu).  
- Brak tie.

## Skutek

→ `planner-round-10-draft.md` = final candidate executable plan.  
**Kanon `.plan.md` NIE tworzony** — dopiero po Critic R10 CONVERGED + polecenie Parent/orchestratora.
