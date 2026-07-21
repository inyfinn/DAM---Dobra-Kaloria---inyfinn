# -*- coding: utf-8 -*-
"""Rebuild branding.html PL chrome — UTF-8 write only (WORKER B compB)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from _fix_mojibake_utf8 import try_fix, write_utf8  # noqa: E402
from _fix_qmark_chrome_pl import PAIRS  # noqa: E402

p = ROOT / "apps" / "web" / "branding.html"
raw = p.read_bytes()
try:
    text = raw.decode("utf-8")
except UnicodeDecodeError:
    text = raw.decode("cp1250")

fixed, method = try_fix(text)
if method:
    text = fixed
    print("mojibake", method)

for old, new in PAIRS:
    if old in text:
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
bad = text.count("Poka?") + text.count("W??cz") + text.count("Wy??cz")
print("bad_q", bad, "Pokaż", text.count("Pokaż"))
