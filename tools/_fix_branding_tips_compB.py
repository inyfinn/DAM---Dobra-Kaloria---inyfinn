# -*- coding: utf-8 -*-
import re
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "apps" / "web" / "branding.html"
t = p.read_bytes().decode("utf-8")
tip_ok = (
    "Ile kart (elementów) pokazać w siatce. Suwak i pole nie odświeżają siatki na żywo "
    "- zatwierdź przyciskiem OK. Kółko myszy na kontrolce zmienia wartość."
)
t = re.sub(
    r'data-dam-tip="Ile kart \(element[^"]+"',
    f'data-dam-tip="{tip_ok}"',
    t,
    count=1,
)
t = t.replace('zapisz preferencj?"', "zapisz preferencję\"")
p.write_bytes(t.encode("utf-8"))
bad = t.count("Poka?") + t.count("W??cz") + t.count("pokaza?")
print("bad", bad)
