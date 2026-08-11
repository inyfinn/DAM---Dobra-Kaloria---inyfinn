# Handoff STREFA H / H2 / H3 - destrukcyjne akcje (2026-07-20)

**Status:** H3 DONE — przebudowa UI Strefy ryzyka (Grok).  
**Model:** tylko `cursor-grok-4.5-high-fast`.  
**Brief:** usability-brief sekcja H + reel UX (hold / labels / offset / red / danger zone / cooldown).

### Pliki WOLNE

| Plik | Status |
|------|--------|
| **`dam-assoc-edit.js`** | **WOLNY dla Task 36 (podglad po lewej)** |
| `dam-danger.js` | H3: DEFAULT_HOLD_MS=300; red-budget inject |
| `dam-explorer.js` | H2 zamkniety |
| `settings.html` (danger zone) | H3 przebudowa UI DONE |

**NIE ruszac:** dam-tutorial.*, dam-media-preview, dam-branding, local_bridge, indeksy, kasowanie plikow.

---

## H3 — przebudowa Strefy ryzyka (2026-07-20)

**Design Read:** settings admin DAM / Geex product UI — GitHub-style danger zone, schludny friction, nie toporny.

### Co zmienione
1. Markup `#damDangerZone`: header (ikona + lead), karta operacji, foot z hold btn po LEWEJ.
2. CSS `#damDangerZoneCss`: `grid-column: 1 / -1`, subtelna ramka danger, bez zagniezdzenia „pudel”, offset od Restart.
3. Hold **300 ms** (`dam-danger.js` DEFAULT + bind `holdMs:300`), label czasownika „Wyczysc lokalne ustawienia”, toast Cofnij ~8 s (copy: lokalne preferencje, nie pliki na dysku).
4. Trash odbiorcow (`.dam-notify-row__remove`): neutralny szary + `data-dam-hold-delete` przez MutationObserver w settings.html (bez edycji dam-settings.js).
5. `?v=usab20260720h3b` (settings); inne HTML: `dam-danger.js?v=usab20260720h3`.

### QA PASS (3 przeloty screenshot+Read)
| Pass | Fokus | Plik |
|------|--------|------|
| 1 | Struktura full-width (+ System) | `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\h3-dz-pass1-structure.png` |
| 2 | Polish (bez nested box) | `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\h3-dz-pass2-polish.png` |
| 3 | Karta danger + hold label | `c:\Users\xpret\AppData\Local\Temp\cursor\screenshots\h3-dz-pass3-element-hint.png` |

CDP: `dzW===sysW===1242`, `holdMs:300`, `btnLeft≈387` vs `restartRight≈1579`, hint text po tap.

**HARD:** zero kasowania plikow / git reset / wipe indeksow. Clear prefs = tylko UI hold (localStorage preferencji + toast Cofnij).

---

## Status pkt 27–32

| # | Status |
|---|--------|
| 27 Hold-to-delete | DONE (300 ms + ring + hint) |
| 28 Labels | DONE w strefie (czasowniki) |
| 29 Offset | DONE (lewa / dol karty ≠ Restart prawa) |
| 30 Red budget | DONE w zone + trash muted do hold |
| 31 Danger zone | DONE (GitHub-style rebuild) |
| 32 Soft-delete | DONE (toast Cofnij 8 s) |
