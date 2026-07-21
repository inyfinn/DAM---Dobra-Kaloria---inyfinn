# -*- coding: utf-8 -*-
"""Full branding.html PL chrome repair — latin-1 read, UTF-8 write."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from _fix_qmark_chrome_pl import PAIRS  # noqa: E402

p = ROOT / "apps" / "web" / "branding.html"
text = p.read_bytes().decode("latin-1")

for old, new in PAIRS:
    text = text.replace(old, new)

# Residual cp1250-as-latin-1 fragments after partial prior fixes
extra = [
    ("tag\u00f3w", "tagów"),
    ("element\u00f3w", "elementów"),
    ("preferencj\u0119", "preferencję"),
]
for old, new in extra:
    text = text.replace(old, new)

tip_ok = (
    "Ile kart (elementów) pokazać w siatce. Suwak i pole nie odświeżają siatki na żywo "
    "- zatwierdź przyciskiem OK. Kółko myszy na kontrolce zmienia wartość."
)
text = re.sub(
    r'data-dam-tip="Ile kart \(element[^"]+"',
    f'data-dam-tip="{tip_ok}"',
    text,
    count=1,
)
text = text.replace("zapisz preferencj?", "zapisz preferencję")
text = text.replace("zapisz preferencj\u0099", "zapisz preferencję")

p.write_bytes(text.encode("utf-8"))
bad = text.count("Poka?") + text.count("W??cz") + text.count("Wy??cz")
print("bad_q", bad, "fffd", text.count("\ufffd"))
