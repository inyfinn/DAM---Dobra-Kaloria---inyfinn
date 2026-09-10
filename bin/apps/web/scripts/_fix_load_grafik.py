from pathlib import Path
p = Path(__file__).resolve().parents[1] / "assets" / "js" / "dam-explorer.js"
t = p.read_text(encoding="utf-8")
old = "    if (input) bindSearchPanelSync(input);\n  }"
new = "    if (input) bindSearchPanelSync(input);\n    loadGrafikGroup();\n  }"
if "loadGrafikGroup();" in t.split("function bindExplorerData")[1][:1500]:
    print("already")
else:
    if old not in t:
        raise SystemExit("anchor not found")
    p.write_text(t.replace(old, new, 1), encoding="utf-8")
    print("patched")
