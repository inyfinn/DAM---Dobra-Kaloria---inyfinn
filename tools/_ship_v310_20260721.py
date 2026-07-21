# -*- coding: utf-8 -*-
"""Ship v3.1.0 + unify cache token ship20260721v310. UTF-8 writes only."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
TOKEN = "ship20260721v310"
VER = "3.1.0"
VER_DISP = "v3.1.0"


def write_utf8(path: Path, text: str) -> None:
    path.write_bytes(text.encode("utf-8"))


def bump_version_surfaces() -> None:
    vjson = WEB / "version.json"
    data = vjson.read_text(encoding="utf-8")
    # rewrite whole file for clarity
    note = (
        "3.1.0: gap ship 2026-07-21 — viz modal parity (INDEX above studio, show-all "
        "dedupe/rows, grouptint #f5f6fa, actions bar z40, studio chips nowrap), branding "
        "WARIANTY raster-only (no PSD/PSB/AI/PDF in variant-grid; sources in SourceMount), "
        "Shift-minus −20% global, paintAssoc unblocked from enrich hang, UTF-8 PL chrome "
        "(Pokaż/Włącz), UK→GB lang canon, adminGate session. Cache ship20260721v310."
    )
    write_utf8(
        vjson,
        "{\n"
        f'  "version": "{VER}",\n'
        '  "name": "DAM - Dobra Kaloria - Inyfinn",\n'
        '  "codename": "gapship",\n'
        '  "released_at": "2026-07-21",\n'
        f'  "note": "{note}"\n'
        "}\n",
    )

    dv = WEB / "assets" / "js" / "dam-version.js"
    write_utf8(
        dv,
        "/**\n"
        " * Wersja programu DAM (single source w UI).\n"
        " * Przy releasie: podbij string tutaj ORAZ w version.json (ten sam numer).\n"
        " * 3.1.0 — gap ship modal parity + UTF-8 + noSrcGrid + Shift-minus (2026-07-21)\n"
        " */\n"
        "(function (global) {\n"
        '  "use strict";\n'
        f'  global.DAM_APP_VERSION = "{VER}";\n'
        "})(typeof window !== \"undefined\" ? window : globalThis);\n",
    )

    rc = ROOT / "apps" / "desktop" / "runtime_config.py"
    t = rc.read_text(encoding="utf-8")
    t2 = re.sub(
        r'APP_VERSION\s*=\s*"[^"]+"',
        f'APP_VERSION = "{VER}"  # sync z apps/web/version.json + dam-version.js',
        t,
        count=1,
    )
    if t2 != t:
        write_utf8(rc, t2)
        print("runtime_config.py OK")
    else:
        print("runtime_config.py NO MATCH")

    shell = WEB / "assets" / "js" / "dam-shell.js"
    st = shell.read_text(encoding="utf-8")
    st2 = st.replace('window.DAM_APP_VERSION || "2.0.7"', f'window.DAM_APP_VERSION || "{VER}"')
    st2 = st2.replace('window.DAM_APP_VERSION || "2.0.6"', f'window.DAM_APP_VERSION || "{VER}"')
    if st2 != st:
        write_utf8(shell, st2)
        print("dam-shell.js fallback OK")


def bump_html() -> None:
    pats = [
        (r'dam-version\.js\?v=[^"]+', f"dam-version.js?v={VER}"),
        (r'(class="dam-app-version"[^>]*>)v?[0-9]+\.[0-9]+\.[0-9]+', rf"\g<1>{VER_DISP}"),
        (r'dam-media-preview\.js\?v=[^"]+', f"dam-media-preview.js?v={TOKEN}"),
        (r'dam-assoc-edit\.js\?v=[^"]+', f"dam-assoc-edit.js?v={TOKEN}"),
        (r'dam-viz\.js\?v=[^"]+', f"dam-viz.js?v={TOKEN}"),
        (r'dam-branding\.css\?v=[^"]+', f"dam-branding.css?v={TOKEN}"),
        (r'dam-viz-modal\.css\?v=[^"]+', f"dam-viz-modal.css?v={TOKEN}"),
        (r'dam-brand\.css\?v=[^"]+', f"dam-brand.css?v={TOKEN}"),
        (r'dam-labels\.js\?v=[^"]+', f"dam-labels.js?v={TOKEN}"),
        (r'dam-badges\.js\?v=[^"]+', f"dam-badges.js?v={TOKEN}"),
        (r'dam-shell\.js\?v=[^"]+', f"dam-shell.js?v={TOKEN}"),
    ]
    for html in sorted(WEB.glob("*.html")):
        t = html.read_text(encoding="utf-8")
        n = t
        for pat, repl in pats:
            n = re.sub(pat, repl, n)
        if n != t:
            write_utf8(html, n)
            print("html", html.name)


def bump_js_injects() -> None:
    for rel in ("assets/js/dam-media-preview.js", "assets/js/dam-viz.js"):
        p = WEB / rel
        t = p.read_text(encoding="utf-8")
        n = re.sub(r'dam-viz-modal\.css\?v=[^"]+', f"dam-viz-modal.css?v={TOKEN}", t)
        if n != t:
            write_utf8(p, n)
            print("inject", rel)


def verify() -> None:
    mp = (WEB / "assets/js/dam-media-preview.js").read_text(encoding="utf-8")
    assert "return !isSourceVariantFile(v);" in mp
    assert "materialSiblings) return true" not in mp
    assert "materialSiblings return true" not in mp
    viz = (WEB / "visualizations.html").read_bytes()
    assert "Pokaż wszystkie".encode("utf-8") in viz
    assert b"Poka? wszystkie" not in viz
    assert b"W??cz" not in viz
    assert VER.encode() in (WEB / "version.json").read_bytes()
    assert f'DAM_APP_VERSION = "{VER}"'.encode() in (WEB / "assets/js/dam-version.js").read_bytes()
    print("VERIFY OK", VER, TOKEN)


if __name__ == "__main__":
    bump_version_surfaces()
    bump_html()
    bump_js_injects()
    verify()
