from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
n = 0
for p in list(root.glob("*.html")) + [root / "_qa" / "geex-f3-buttons-fixture.html"]:
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    o = t
    t = re.sub(r"dam-tokens\.css\?v=[^\s\"'>]+", "dam-tokens.css?v=geexTaste20260721a", t)
    t = re.sub(r"dam-primitives\.css\?v=[^\s\"'>]+", "dam-primitives.css?v=geexTaste20260721a", t)
    t = re.sub(r"dam-brand\.css\?v=[^\s\"'>]+", "dam-brand.css?v=geexTaste20260721a", t)
    t = re.sub(r"dam-integrations\.css\?v=[^\s\"'>]+", "dam-integrations.css?v=geexTaste20260721a", t)
    if t != o:
        p.write_text(t, encoding="utf-8")
        n += 1
print("bumped", n)
