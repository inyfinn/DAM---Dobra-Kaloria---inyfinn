# Faza 6: early DamTheme bridge (pref+system+colorScheme) before CSS where possible.
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BRIDGE = (
    "<script>(function(){try{var r=document.documentElement,"
    "p=localStorage.getItem('dam_theme_pref')||localStorage.getItem('theme')||'light',t=p;"
    "if(p==='system'){t=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}"
    "if(t!=='dark'&&t!=='light')t='light';"
    "r.setAttribute('data-theme',t);r.style.colorScheme=t;"
    "if(p==='system'||p==='dark'||p==='light')r.setAttribute('data-dam-theme-pref',p);"
    "}catch(e){}})();</script>"
)

OLD_BLOCK = re.compile(
    r"<script>\s*if\s*\(localStorage\.theme\)\s*"
    r"document\.documentElement\.setAttribute\(\s*[\"']data-theme[\"']\s*,\s*localStorage\.theme\s*\);\s*"
    r"</script>",
    re.I,
)

OLD_INLINE = re.compile(
    r"if\s*\(localStorage\.theme\)\s*"
    r"document\.documentElement\.setAttribute\(\s*[\"']data-theme[\"']\s*,\s*localStorage\.theme\s*\);",
    re.I,
)

BRIDGE_RE = re.compile(
    r"<script>\(function\(\)\{try\{var r=document\.documentElement.*?\)\(\);</script>",
    re.S,
)

HOT = [
    "index.html",
    "dashboard.html",
    "branding.html",
    "visualizations.html",
    "explorer.html",
    "costs.html",
    "invoices.html",
    "integrations.html",
    "inbox.html",
    "settings.html",
]


def ensure_bridge_first(html: str) -> str:
    m = BRIDGE_RE.search(html)
    head = re.search(r"<head[^>]*>", html, re.I)
    if not head:
        return html
    if m:
        script = m.group(0)
        without = html[: m.start()] + html[m.end() :]
        head2 = re.search(r"<head[^>]*>", without, re.I)
        if not head2:
            return html
        return without[: head2.end()] + "\n  " + script + without[head2.end() :]
    # no bridge yet — inject after head
    return html[: head.end()] + "\n  " + BRIDGE + html[head.end() :]


def main() -> None:
    for name in HOT:
        path = ROOT / name
        if not path.exists():
            print("missing", name)
            continue
        text = path.read_text(encoding="utf-8")
        orig = text
        text, n1 = OLD_BLOCK.subn(BRIDGE, text)
        text, n2 = OLD_INLINE.subn(
            "(function(){try{var r=document.documentElement,"
            "p=localStorage.getItem('dam_theme_pref')||localStorage.getItem('theme')||'light',t=p;"
            "if(p==='system'){t=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}"
            "if(t!=='dark'&&t!=='light')t='light';"
            "r.setAttribute('data-theme',t);r.style.colorScheme=t;"
            "if(p==='system'||p==='dark'||p==='light')r.setAttribute('data-dam-theme-pref',p);"
            "}catch(e){}})();",
            text,
        )
        text = ensure_bridge_first(text)
        if text != orig:
            path.write_text(text, encoding="utf-8")
            print(f"OK {name} n1={n1} n2={n2}")
        else:
            print(f"SKIP {name}")


if __name__ == "__main__":
    main()
