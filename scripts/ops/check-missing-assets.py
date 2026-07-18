"""List asset references in apps/web/*.html that do not exist on disk."""
from __future__ import annotations

import re
from pathlib import Path

WEB = Path(__file__).resolve().parents[2] / "apps" / "web"
pattern = re.compile(r'(?:href|src)="(\./)?(assets/[^"?#]+)')

missing: dict[str, list[str]] = {}
for html in WEB.glob("*.html"):
    text = html.read_text(encoding="utf-8", errors="replace")
    for m in pattern.finditer(text):
        rel = m.group(2)
        if not (WEB / rel).is_file():
            missing.setdefault(rel, []).append(html.name)

for rel in sorted(missing):
    pages = missing[rel]
    print(f"{rel}  <- {len(pages)} pages: {', '.join(sorted(set(pages))[:5])}")
print(f"\nTotal missing: {len(missing)}")
