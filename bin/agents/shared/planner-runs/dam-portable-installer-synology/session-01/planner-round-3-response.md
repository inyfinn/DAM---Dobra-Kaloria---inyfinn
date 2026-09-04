# Planner response — round 3

Źródło: `planner-round-3-critique.md` (werdykt CONTINUE).

## Krytyczne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| K1 | wspolbieznosc | E1.0 WRITE po FREEZE łamie D10 | **ACCEPT** | Jedyna reguła = **BUILD PREP przed FREEZE**; po freeze tylko read/copy. Regeneracja gridów = unieważnienie freeze + restart gate. (Odrzucamy whitelist WRITE i FREEZE-po-E1.0 jako mniej bezpieczne dla CM9.) |
| K2 | weryfikacja | Manifest self-hash, junctions, ADS, kolejność | **ACCEPT** | Manifest poza payload lub two-phase; reject reparse/symlink/junction/ADS/traversal; osobny artifact manifest + niezależny verifier. |
| K3 | zasoby | Fat 340MB + brak size budget / LFS | **ACCEPT** | Slim runtime indexes ONLY; fat `branding-index.json` OUT; budżety FAIL; LFS pointer detection MUST. |
| K4 | weryfikacja | CM1a∩CM12 na VM-A bez VC++ / crash przed heal | **ACCEPT** | Rozdzielona kolejność + snapshoty: najpierw minimal boot/heal bez pythonnet; potem osobny test app bez VC++; VC++ wymagany ⇒ installer bootstrap przed startem; zero crash przed healerem. |

## Ważne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| W1 | weryfikacja | provenance wąski; sync completeness vs freeze | **ACCEPT** | `post_sync_web_snapshot_sha256` + `git diff freeze -- apps/web` empty przed stage. |
| W2 | weryfikacja | E1.0 freshness: ścieżka fat + generation_id + ijson | **ACCEPT** | HARD `apps/web/data/branding-index.json` jako input build (nie payload); generation_id; ijson na build machine. |
| W3 | weryfikacja | CM7b AUMID metoda evidence | **ACCEPT** | Get-StartApps / .lnk AppUserModelID + screenshot pin. |
| W4 | governance | DoD Tier-A vs Tier-B (Q7A) | **ACCEPT** | Tier-A portable/runtime/installer; Tier-B CM3 Synology = pełny brief §7. |
| W5 | eskalacja | CM5/CM6 bez Q1 = SKIP nie PASS | **ACCEPT** | Explicit SKIP w DoD. |
| W6 | weryfikacja | Q8 nie blokuje Tier-A gdy CM12 PASS komunikatem | **ACCEPT** | Q8 tylko po FAIL×3. |
| W7 | ryzyko_modelowe | Native deps poza VC++ (psycopg2) | **ACCEPT** | Obserwacja: CM1a-boot bez native; CM1a-app/CM3 ładują psycopg2 — FAIL→heal/docs, nie mylić z CM12. |

## Kosmetyczne

| # | Werdykt | Notatka |
|---|---------|---------|
| Ko1 Q8 w todo | **ACCEPT** | `step-A1` notuje Q8 warunkowe. |
| Ko2 min_rounds 10 | **ACCEPT** | MAD trwa do N≥10 nawet przy 0K. |
| Ko3 README 5 linii pełny tekst | **ACCEPT** | Pełny szablon w R4 E2. |

## Liczniki

- **ACCEPT krytyczne:** 4 · **REBUT:** 0  
- **ACCEPT ważne:** 7 · **REBUT:** 0  
- **Kosmetyczne ACCEPT:** 3  
- **K+W łącznie:** **11 ACCEPT / 0 REBUT**

## Tie / otwarte

- Brak REBUT → brak tie.  
- Parent Q1–Q7 (i Q8 warunkowe) nadal otwarte — bez niejawnych alternatyw.

## Skutek

Wszystkie ACCEPT → `planner-round-4-draft.md`. Kanon nie tworzony. Implementacja zakazana.
