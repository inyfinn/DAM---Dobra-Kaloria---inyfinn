# Planner response — round 7

Źródło: `planner-round-7-critique.md` (werdykt CONTINUE).

## Krytyczne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| K1 | ryzyko_modelowe | Go GUI bez nazwanego stacku / PoC | **ACCEPT** | Stos = Win32 via `golang.org/x/sys/windows` + własne wrappery (CGO=0). A0 PoC gate przed C; PoC FAIL → AskQuestion eskalacja (nie ukryte TBD). |
| K2 | weryfikacja | HMAC security theatre + timeout 5s | **ACCEPT** | Usuwamy HMAC. Handshake = reliability (nonce in-memory + pipe + parent alive + heartbeat, max 60s). Threat model jawny. |
| K3 | weryfikacja | DLL harden nie chroni onefile bootloader | **ACCEPT** | Engine = **onedir** (nie onefile); CRT w katalogu engine; absolute path spawn; hijack CM na engine start. |
| K4 | wspolbieznosc | Brak mutex w bootstrap | **ACCEPT** | CreateMutex jako pierwsza operacja; 2. launch = activate existing, zero spawn. |
| K5 | governance | 3010 bez resume | **ACCEPT** | Resume state + RunOnce/re-run; po reboot redetect VC++; no auto-launch przed success; cancel cleanup. Portable nie instaluje redist. |

## Ważne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| W1 | weryfikacja | Q2=A SmartScreen ×2 | **ACCEPT** | Explicit DoD + Parent checkbox. |
| W2 | ryzyko_modelowe | Pin redist build vs dumpbin | **ACCEPT** | Pin 14.4x + FAIL missing DLL. |
| W3 | weryfikacja | Nonce/env nie do logów | **ACCEPT** | Secret scan logów. |
| W4 | weryfikacja | Bootstrap wait + child fail <5s → heal | **ACCEPT** | Lifecycle macierz. |
| W5 | weryfikacja | CM3 offline hint przy Q7A | **ACCEPT** | W tabeli F. |
| W6 | weryfikacja | CM5p kill fail → abort | **ACCEPT** | No partial overwrite. |
| W7 | kompletność_briefu | CM8 native heal screenshot | **ACCEPT** | |
| W8 | ryzyko_modelowe | Archive rollback + opc. Q2 bootstrap-only | **ACCEPT** | Nota w Q2/Q8, nie blokuje. |

## Kosmetyczne

| # | Werdykt | Notatka |
|---|---------|---------|
| Ko1 MAD 8/10 | **ACCEPT** | Debata trwa. |
| Ko2 boot-heal.html WARN nie FAIL | **ACCEPT** | |
| Ko3 exit 17 w README | **ACCEPT** | |

## Liczniki

- **ACCEPT krytyczne:** 5 · **REBUT:** 0  
- **ACCEPT ważne:** 8 · **REBUT:** 0  
- **Kosmetyczne:** 3 ACCEPT  
- **K+W:** **13 ACCEPT / 0 REBUT**

## Tie / otwarte

- Brak tie.  
- Parent Q1–Q7 otwarte.  
- **PoC FAIL path:** AskQuestion A/B/C (Win32 retry / inny stack CGO=free / Parent choice) — dopiero gdy A0 PoC faktycznie padnie.

## Skutek

→ `planner-round-8-draft.md`. Kanon nie tworzony. Implementacja zakazana.
