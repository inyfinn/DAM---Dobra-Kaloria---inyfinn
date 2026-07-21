from pathlib import Path

root = Path(__file__).resolve().parents[1]
n = 0
for p in root.glob("*.html"):
    t = p.read_text(encoding="utf-8")
    o = t
    for old in (
        "dam-brand.css?v=geexF4badge20260721a",
        "dam-brand.css?v=geexF4badge20260721b",
        "dam-brand.css?v=ship20260721v310",
    ):
        t = t.replace(old, "dam-brand.css?v=geexF720260721a")
    if t != o:
        p.write_text(t, encoding="utf-8")
        n += 1
print("bumped", n)
