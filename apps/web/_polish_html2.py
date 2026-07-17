# -*- coding: utf-8 -*-
from pathlib import Path
import re
import json

web = Path(r"P:/DAM/apps/web")
for p in web.glob("*.html"):
    t = p.read_text(encoding="utf-8")
    o = t
    t = re.sub(r"(?m)^(\s+)Profile\s*$", r"\1Profil", t)
    t = re.sub(r"(?m)^(\s+)Settings\s*$", r"\1Ustawienia", t)
    t = re.sub(r"(?m)^(\s+)Billing\s*$", r"\1Rozliczenia", t)
    t = re.sub(r"(?m)^(\s+)Activity\s*$", r"\1Aktywnosc", t)
    t = re.sub(r"(?m)^(\s+)Help\s*$", r"\1Pomoc", t)
    t = t.replace(">Top Menu<", ">Menu gorne<")
    t = t.replace(">Side Menu<", ">Menu boczne<")
    t = t.replace(">Light Demo<", ">Motyw jasny<")
    t = t.replace(">Dark Demo<", ">Motyw ciemny<")
    t = t.replace(">LTR Demo<", ">LTR<")
    t = t.replace(">RTL Demo<", ">RTL<")
    if t != o:
        p.write_text(t, encoding="utf-8")
        print("fixed", p.name)

# Deduplicate en.json
en_path = Path(r"P:/DAM/apps/web/i18n/en.json")
raw = en_path.read_text(encoding="utf-8")
pairs = re.findall(r'"([^"]+)":\s*("(?:\\.|[^"\\])*")', raw)
ordered = []
seen = set()
d = {}
for k, v in pairs:
    d[k] = json.loads(v)
    if k not in seen:
        ordered.append(k)
        seen.add(k)
extra = {
    "user.profile": "Profile",
    "user.settings": "Settings",
    "user.billing": "Billing",
    "user.activity": "Activity",
    "user.help": "Help",
    "user.logout": "Logout",
    "customizer.title": "Customizer",
    "customizer.layout": "Layout Types",
    "customizer.mode": "Mode Type",
    "customizer.navbar": "Navbar Type",
    "customizer.ltr": "LTR",
    "customizer.rtl": "RTL",
    "header.search": "Search...",
    "header.lang_title": "Language",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.all_rights": "All rights reserved",
    "dash.open_cost": "Open cost calculator",
    "dash.cost_details": "Cost details",
    "dash.cost_calc": "Calculator",
}
for k, v in extra.items():
    d[k] = v
    if k not in seen:
        ordered.append(k)
        seen.add(k)

lines = ["{"]
for i, k in enumerate(ordered):
    comma = "," if i < len(ordered) - 1 else ""
    lines.append("  " + json.dumps(k) + ": " + json.dumps(d[k], ensure_ascii=False) + comma)
lines.append("}")
en_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("en.json keys", len(ordered))
