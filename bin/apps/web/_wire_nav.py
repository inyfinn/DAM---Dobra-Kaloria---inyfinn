# -*- coding: utf-8 -*-
"""Wire dam-shell on legacy pages + bump cache versions."""
from pathlib import Path
import re

web = Path(r"P:/DAM/apps/web")
SHELL = (
    '  <script src="./assets/js/dam-api.js?v=20260717b"></script>\n'
    '  <script src="./assets/js/dam-i18n.js?v=20260717nav"></script>\n'
    '  <script src="./assets/js/dam-shell.js?v=20260717nav"></script>\n'
)

for p in web.glob("*.html"):
    if "signin" in p.name:
        continue
    t = p.read_text(encoding="utf-8")
    o = t
    # bump brand css + shell
    t = re.sub(r"dam-brand\.css\?v=[^\"]+", "dam-brand.css?v=20260717nav", t)
    t = re.sub(r"dam-shell\.js\?v=[^\"]+", "dam-shell.js?v=20260717nav", t)
    t = re.sub(r"dam-i18n\.js(\?v=[^\"]*)?", "dam-i18n.js?v=20260717nav", t)

    if "dam-shell.js" not in t and "</body>" in t:
        # insert before dam-app or before </body>
        if "dam-api.js" in t and "dam-i18n.js" not in t:
            t = t.replace(
                'src="./assets/js/dam-api.js?v=20260717b"></script>',
                'src="./assets/js/dam-api.js?v=20260717b"></script>\n'
                '  <script src="./assets/js/dam-i18n.js?v=20260717nav"></script>\n'
                '  <script src="./assets/js/dam-shell.js?v=20260717nav"></script>',
                1,
            )
        elif "dam-api.js" not in t:
            t = t.replace("</body>", SHELL + "</body>", 1)

    if t != o:
        p.write_text(t, encoding="utf-8")
        print("updated", p.name)
    else:
        print("unchanged", p.name)
