# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "apps" / "web" / "visualizations.html"
c = p.read_text(encoding="utf-8")
repls = [
    ("PokaĹŽ wszystkie", "Pokaż wszystkie"),
    ("PokaĹĽ wszystkie", "Pokaż wszystkie"),
    ("Filtr jÄ™zyka", "Filtr języka"),
    ("Wszystkie jÄ™zyki", "Wszystkie języki"),
    ("Skala kafelkĂłw wizualizacji", "Skala kafelków wizualizacji"),
    ("powyĹĽej 100% powiÄ™ksza", "powyżej 100% powiększa"),
    ("PodglÄ…d startuje", "Podgląd startuje"),
    ("WĹ‚Ä…cz: pokazuje", "Włącz: pokazuje"),
    ("WyĹ‚Ä…cz: tylko", "Wyłącz: tylko"),
]
for a, b in repls:
    if a in c:
        c = c.replace(a, b)
        print("fixed:", a[:40])
    else:
        print("miss:", a[:40])

needle = 'data-dam-tip="Suwak: 65-100% pomniejsza wizualizacje w kafelku; powyżej 100% powiększa kafelek (max 350%). Podgląd startuje z tej samej skali."'
if needle in c and "Shift+Plus" not in c:
    c = c.replace(
        needle,
        'data-dam-tip="Suwak: 65-100% pomniejsza wizualizacje w kafelku; powyżej 100% powiększa kafelek (max 350%). Podgląd startuje z tej samej skali. Shift+Plus / Shift+Minus: ta sama skala (tez w panelu skojarzen)."',
        1,
    )
    print("tip appended")

p.write_text(c, encoding="utf-8")
print("wrote", p)
