# -*- coding: utf-8 -*-
from pathlib import Path
import re

WEB = Path(__file__).resolve().parents[1] / "apps" / "web"
MARKERS = ["Ä…", "Ä‡", "Ä™", "Å‚", "Å„", "Å›", "Åº", "Å¼", "Ã³", "â€"]
QPAT = re.compile(
    r"(miesi\?|tydzie\?|Wyczy\?|wygl\?d|j\?zyk|Poka\?|u\?ycia|status\?w|koszt\?w|Å‚|Ä‡)",
    re.I,
)
FFFD = b"\xef\xbf\xbd"

hits = []
for p in sorted(WEB.rglob("*")):
    if p.suffix.lower() not in {".html", ".js", ".css", ".json"}:
        continue
    if "vendor" in p.parts or "node_modules" in p.parts:
        continue
    if p.name in {"file-index.json", "branding-index.json"}:
        continue
    raw = p.read_bytes()
    if FFFD in raw:
        hits.append((str(p.relative_to(WEB)), "FFFD", raw.count(FFFD)))
    try:
        text = raw.decode("utf-8")
    except Exception:
        continue
    for m in MARKERS:
        if m in text:
            hits.append((str(p.relative_to(WEB)), "mojibake", m + " x" + str(text.count(m))))
            break
    for m in QPAT.finditer(text):
        hits.append((str(p.relative_to(WEB)), "qmark", m.group(0)))

print("hits", len(hits))
for h in hits[:80]:
    print(h)
