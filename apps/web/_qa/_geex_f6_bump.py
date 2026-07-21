from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
n = 0
for p in root.glob("*.html"):
    t = p.read_text(encoding="utf-8")
    o = t
    t = t.replace("dam-tokens.css?v=geexF220260721a", "dam-tokens.css?v=geexF620260721a")
    t = re.sub(r"dam-theme\.js\?v=[^\s\"'>]+", "dam-theme.js?v=geexF620260721a", t)
    # shell js bump if present
    t = re.sub(r"dam-shell\.js\?v=[^\s\"'>]+", "dam-shell.js?v=geexF620260721a", t)
    if t != o:
        p.write_text(t, encoding="utf-8")
        n += 1
print("bumped", n)
head = (root / "index.html").read_text(encoding="utf-8").splitlines()[:14]
print("\n".join(head))
