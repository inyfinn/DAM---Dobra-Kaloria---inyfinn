# -*- coding: utf-8 -*-
from pathlib import Path

web = Path(__file__).resolve().parents[1] / "apps" / "web"
checks = [
    ("visualizations.html", [b"Poka\xc5\xbc wszystkie", b"W\xc5\x82\xc4\x85cz:", b"Wy\xc5\x82\xc4\x85cz:", b"Poka? wszystkie", b"W??cz"]),
    ("explorer.html", [b"Poka\xc5\xbc wszystkie", b"Od\xc5\x9bwie\xc5\xbc z dysku", b"Poka? wszystkie"]),
    ("branding.html", [b"Poka\xc5\xbc wszystko", b"Poka\xc5\xbc archiwum", b"Poka? wszystko"]),
]
for name, needles in checks:
    data = (web / name).read_bytes()
    print("==", name)
    for n in needles:
        bad = n.startswith(b"Poka?") or n.startswith(b"W??")
        present = n in data
        label = "BAD-STILL" if bad and present else ("OK" if present else "MISS")
        if bad and not present:
            label = "GONE-OK"
        print(" ", label, n.decode("utf-8", errors="replace")[:50])

js = (web / "assets/js/dam-assoc-edit.js").read_text(encoding="utf-8")
print("assoc-edit width:21px", "width:21px" in js)
print("paintAssoc never-block", "NEVER block WARIANTY" in (web / "assets/js/dam-media-preview.js").read_text(encoding="utf-8"))
css = (web / "assets/css/dam-branding.css").read_text(encoding="utf-8")
print("studioRow comment", "studioRow20260721a" in css)
print("flex-wrap nowrap chips", "flex-wrap: nowrap" in css)
print("mergeVar css", "mergeVar20260721a" in css)
mp = (web / "assets/js/dam-media-preview.js").read_text(encoding="utf-8")
print("materialMode empty all-files", "if (materialMode) return \"\";" in mp or "if (materialMode) return '';" in mp)
print("brandComposer html", "brandComposer20260721a" in (web / "visualizations.html").read_text(encoding="utf-8"))
