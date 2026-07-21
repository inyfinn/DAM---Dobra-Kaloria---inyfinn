# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PROC_ENTRY = """

## 2026-07-21 - HARD fix PL diacritics (U+FFFD in HTML chrome)

### Komenda/Akcja
WORKER encoding: Polish diacritics broken on Branding filters (Wyczysc/tydzien/miesiac/uzycia). Intensive QA 15 rund. No commit.

### Log/Status
1. Root cause: branding.html (also explorer/dashboard) had literal U+FFFD (EF BF BD) baked into chrome strings - irreversible; NOT meta charset; NOT font; NOT whole-page fail (tags OK).
2. Side pattern: invoices.html / visualizations.html had ASCII ? leftovers (wygl?d, Poka?, j?zyk).
3. Fixed via Python UTF-8 write_bytes: tools/_fix_fffd_chrome_pl.py, tools/_fix_qmark_chrome_pl.py, tools/_wire_branding_i18n_defense.py.
4. Defense: data-i18n + keys in i18n/pl.json for branding clear/week/month/sort/show_all; boot already waits DamI18n before reveal.
5. Cache-bust branding JS/i18n and page ?v=plenc20260721*.

### Efekt/Fix
- Files: branding.html, explorer.html, dashboard.html, invoices.html, visualizations.html, i18n/pl.json; tools scripts above.
- Site-wide FFFD in apps/web HTML/JS/CSS (ex vendor) = 0; mojibake marker sweep = 0.

### Backup
brak (no commit)

### Test/Ewaluacja
- Disk+HTTP bytes: Wyczysc=C5 9B C4 87, tydzien=C5 84, miesiac=C4 85, uzycia=C5 BC.
- CDP textContent + codepoints: s-acute U+015B, c-acute U+0107, n-acute U+0144, a-ogonek U+0105, z-dot U+017C; body FFFD=0 diamond=0.
- Range paint: s-acute/c-acute non-zero client widths (glyphs painted).
- Rundy: branding filters (1-5 Pass), settings (6-8 Pass), viz+inbox headers (9-11 Pass), reload overlay race (12-13 Pass), site-wide grep (14-15 Pass).
- Pass (FAIL gate: any diamond on branding filters - none).

### Zrodla
memory #140; tools/_fix_fffd_chrome_pl.py; apps/web/branding.html; dam-i18n.js boot contract
"""

LESSON = """
- 2026-07-21 | U+FFFD w HTML chrome (nie mojibake reversible) | Branding filtry
  pokazywaly Wyczy◆ filtry / tydzie◆ mimo poprawnych tagow PL na tej samej
  stronie | PowerShell/Get-Content albo zly zapis zniszczyl bajty UTF-8 i
  wstawil literalne U+FFFD (EF BF BD) - tego NIE odwraca `_fix_mojibake_utf8.py`
  (brak oryginalnych bajtow) | naprawa: przepisac stringi z kontekstu Pythonem
  `Path.write_bytes(text.encode("utf-8"))`; skrypt `tools/_fix_fffd_chrome_pl.py`;
  obrona: `data-i18n` na krytycznym chrome + DamI18n before reveal; weryfikacja =
  `open(rb)` + CDP `codePointAt` + Range.getBoundingClientRect szerokosc glifu
  (vision bywa biasowane promptem i klamie ze znaki zniknely mimo U+015B w DOM).
"""


def main() -> None:
    proc = ROOT / "process.md"
    proc.write_bytes(proc.read_bytes() + PROC_ENTRY.encode("utf-8"))
    print("process.md ok")

    doc = ROOT / "agents" / "shared" / "code-doctrine.md"
    raw = doc.read_text(encoding="utf-8")
    if "U+FFFD w HTML chrome" not in raw:
        doc.write_bytes((raw.rstrip() + "\n" + LESSON).encode("utf-8"))
        print("code-doctrine lesson added")
    else:
        print("code-doctrine lesson already present")


if __name__ == "__main__":
    main()
