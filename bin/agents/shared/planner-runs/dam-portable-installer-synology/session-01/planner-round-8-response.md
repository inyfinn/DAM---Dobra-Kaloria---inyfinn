# Planner response — round 8

Źródło: `planner-round-8-critique.md` (werdykt CONTINUE).

## Krytyczne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| K1 | weryfikacja | A0 a11y bez audytowalnego UIA | **ACCEPT** | Narrator + Inspect/Accessibility Insights + HC/200% DPI; PASS/FAIL pliki. |
| K2 | ryzyko_modelowe | Brak comctl32 v6 / DLL pin | **ACCEPT** | Dynamic user32/gdi32/comctl32; manifest ComCtl32 6.0; InitCommonControlsEx; pin toolchain. |
| K3 | wspolbieznosc | Dwa różne mutex names | **ACCEPT** | Jedna kanoniczna konwencja Local\…; shared constants Go↔Python + contract test; bypass exit 17 przed drugim mutexem. |
| K4 | weryfikacja | CRT vs `_internal` layout | **ACCEPT** | Discovery po realnym onedir build; PE scan; place per loader; hijack obu katalogów. |
| K5 | governance | 3010 resume „signed” bez algorytmu | **ACCEPT** | Konkretny JSON + **DPAPI** CurrentUser + ACL + atomic + expiry + one-time nonce + cleanup + RunOnce quoted. |

## Ważne

| # | Kategoria | Punkt | Werdykt | Uzasadnienie |
|---|-----------|-------|---------|--------------|
| W1 | weryfikacja | Activate przy hang | **ACCEPT** | Focus/zombie policy + timeout heal; tasklist+window title. |
| W2 | weryfikacja | Handshake cleanup/parent death | **ACCEPT** | Close handles; parent wait; kill child @60s; unset nonce env. |
| W3 | ryzyko_modelowe | lpCurrentDirectory = engine dir | **ACCEPT** | Absolute paths; CM-hijack = shortcut start dir. |
| W4 | weryfikacja | SmartScreen×2 evidence | **ACCEPT** | 2 screenshots + hash README. |
| W5 | weryfikacja | CM3 offline hint Q7A | **ACCEPT** | Native screenshot artifact. |
| W6 | governance | „bezpieczne defaulty” Q1–Q7 bez Parent | **REBUT** (częściowo) | **ACCEPT** rozdzielenie bramek Tier-A portable vs brief §8. **REBUT** silent defaults: user HARD — bez odpowiedzi Parent **STOP** za odpowiednią bramką; nie defaultujemy Q1–Q7 w implementacji. |
| W7 | weryfikacja | Evidence folder template per CM-ID | **ACCEPT** | |
| W8 | kompletność_briefu | CM8 bez wymogu boot-heal.html | **ACCEPT** | WARN only. |

## Kosmetyczne

| # | Werdykt | Notatka |
|---|---------|---------|
| Ko1 MAD 9/10 | **ACCEPT** | |
| Ko2 PoC max 2 runs | **ACCEPT** | Potem AskQuestion. |
| Ko3 exit codes README | **ACCEPT** | Już w planie. |

## Liczniki

- **ACCEPT krytyczne:** 5 · **REBUT:** 0  
- **ACCEPT ważne:** 7 · **REBUT:** 1 (W6 partial — silent defaults)  
- **Kosmetyczne:** 3 ACCEPT  
- **K+W:** **12 ACCEPT / 1 REBUT**

## Tie / otwarte

- **Potencjalny tie W6:** Critic chciał safe defaults bez Parent; Planner REBUT — zgodne z briefem usera „do not silently default”. Jeśli Critic podniesie ponownie 3× → AskQuestion Parent.  
- Parent **Q1–Q7** nadal otwarte; brak odpowiedzi = STOP za bramką (§0.2 R9), nie domyślne A.

## Skutek

→ `planner-round-9-draft.md`. Kanon nie tworzony. Implementacja zakazana.
