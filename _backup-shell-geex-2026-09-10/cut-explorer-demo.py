# -*- coding: utf-8 -*-
import re
from pathlib import Path

p = Path(r"D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn\bin\apps\web\explorer.html")
html = p.read_text(encoding="utf-8")
marker = '<div class=" table-responsive geex-content__section'
i = html.find(marker)
print("marker", i)
if i < 0:
    raise SystemExit("no marker")


def find_tag_end(s, start):
    m = re.match(r"<([a-zA-Z0-9:-]+)", s[start:])
    tag = m.group(1).lower()
    depth = 0
    pat = re.compile(r"</?%s\b[^>]*>" % re.escape(tag), re.I)
    for mm in pat.finditer(s, start):
        token = mm.group(0)
        if token.startswith("</"):
            depth -= 1
            if depth == 0:
                return mm.end()
        elif token.endswith("/>"):
            if depth == 0:
                return mm.end()
        else:
            depth += 1
    raise ValueError("unclosed")


end = find_tag_end(html, i)
chunk = html[i:end]
print("chunk_lines", chunk.count("\n") + 1, "chars", len(chunk))
print("has_English", "EnglishLesson1" in chunk)
new = html[:i] + html[end:]
print("left_English", new.count("EnglishLesson1"))
print("has_damFolderList", "damFolderList" in new)
print("has_damExplorerMain", "damExplorerMain" in new)
print("has_customizer", "geex-customizer" in new)
p.write_text(new, encoding="utf-8", newline="\n")
print("after_lines", new.count("\n") + 1)
