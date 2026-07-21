# -*- coding: utf-8 -*-
"""branding.html: cp1250/latin-1 read + qmark PAIRS only (no mojibake try_fix)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from _fix_qmark_chrome_pl import PAIRS  # noqa: E402
from _fix_mojibake_utf8 import write_utf8  # noqa: E402

p = ROOT / "apps" / "web" / "branding.html"
raw = p.read_bytes()
for enc in ("utf-8", "cp1250", "latin-1"):
    try:
        text = raw.decode(enc)
        print("decoded", enc)
        break
    except UnicodeDecodeError:
        continue
else:
    raise SystemExit("decode failed")

for old, new in PAIRS:
    text = text.replace(old, new)

tip_page = (
    "Ile kart (elementów) pokazać w siatce. Suwak i pole nie odświeżają siatki na żywo "
    "- zatwierdź przyciskiem OK. Kółko myszy na kontrolce zmienia wartość."
)
text = re.sub(
    r'data-dam-tip="Ile kart \(element[^"]+"',
    f'data-dam-tip="{tip_page}"',
    text,
    count=1,
)

write_utf8(p, text, raw)
needles = ["Pokaż", "Wyczyść", "Włącz", "Wyłącz", "Ładowanie", "Odśwież"]
for n in needles:
    print(n, n in text)
bad = text.count("Poka?") + text.count("W??cz")
print("bad_q", bad)
