# -*- coding: utf-8 -*-
from pathlib import Path
import json
import re

NBSP = "\u00a0"
INBOX = (
    f"Zadania i{NBSP}zgłoszenia. Filtr po{NBSP}źródle. "
    f"Przypomnienie po{NBSP}72{NBSP}h{NBSP}bez{NBSP}decyzji. "
    f"Nic nie zapisuje się samo."
)

root = Path(__file__).resolve().parents[1] / "apps" / "web"
p = root / "inbox.html"
t = p.read_text(encoding="utf-8")
t2, n = re.subn(
    r'(data-i18n="messages.subtitle">)[^<]+',
    r"\g<1>" + INBOX,
    t,
    count=1,
)
p.write_text(t2, encoding="utf-8")
print("inbox", n)

pj = root / "i18n" / "pl.json"
data = json.loads(pj.read_text(encoding="utf-8"))
data["messages.subtitle"] = INBOX
pj.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("pl ok")
print(INBOX.encode("unicode_escape").decode())
