# -*- coding: utf-8 -*-
"""One-shot: vendor fonts/icons + strip Geex demo + F5 sabotage from DAM shells."""
from __future__ import annotations

import os
import re
import ssl
import urllib.request
from pathlib import Path

ROOT = Path(r"D:\Marketing\- POLSKA\99 - WYMIANA\Krzysztof\--- Moj obszar pracy\DAM---Dobra-Kaloria---inyfinn")
WEB = ROOT / "bin" / "apps" / "web"
CTX = ssl.create_default_context()

F5_RE = re.compile(
    r"[ \t]*<script>\(function\(\)\{function g\(\)\{try\{var u=location\.pathname"
    r".*?window\.__damInlineHardReset=g;\}\)\(\);</script>\r?\n",
    re.S,
)

GOOGLE_FONT_RE = re.compile(
    r"[ \t]*<link[^>]+fonts\.googleapis\.com[^>]*>\r?\n",
    re.I,
)
GSTATIC_PRE_RE = re.compile(
    r"[ \t]*<link[^>]+fonts\.gstatic\.com[^>]*>\r?\n",
    re.I,
)
GOOGLE_PRE_RE = re.compile(
    r"[ \t]*<link[^>]+preconnect[^>]+fonts\.googleapis\.com[^>]*>\r?\n",
    re.I,
)
UNICONS_LINK_RE = re.compile(
    r"[ \t]*<link[^>]+cdn\.jsdelivr\.net/npm/@iconscout/unicons[^>]*>\r?\n"
    r"(?:[ \t]*<noscript><link[^>]+unicons[^>]*></noscript>\r?\n)?",
    re.I,
)
APEX_CSS_RE = re.compile(
    r"[ \t]*<link[^>]+cdn\.jsdelivr\.net/npm/apexcharts[^>]*>\r?\n",
    re.I,
)
APEX_JS_RE = re.compile(
    r"[ \t]*<script[^>]+cdn\.jsdelivr\.net/npm/apexcharts[^>]*></script>\r?\n",
    re.I,
)
JQ_UI_CSS_RE = re.compile(
    r"[ \t]*<link[^>]+code\.jquery\.com/ui/[^>]*>\r?\n",
    re.I,
)

FAIL_OPEN_4500 = (
    "(function(){var r=document.documentElement;"
    'if(!r.classList.contains("dam-booting"))r.classList.add("dam-booting");'
    "setTimeout(function(){if(r.classList.contains(\"dam-booting\"))"
    "{r.classList.remove(\"dam-booting\");r.classList.add(\"dam-booted\");"
    "if(document.body)document.body.classList.remove(\"is-booting\");}},4500);})();"
)
FAIL_SAFE_4500 = (
    "(function(){var r=document.documentElement;"
    'if(!r.classList.contains("dam-booting"))r.classList.add("dam-booting");'
    'setTimeout(function(){if(window.__damBootWatchdog)window.__damBootWatchdog("4.5s");},4500);})();'
)

EXPLORER_UNLOCK_RE = re.compile(
    r"  function unlock\(\)\{try\{r\.classList\.remove\(\"dam-booting\"\).*?"
    r"setTimeout\(unlock,400\);setTimeout\(unlock,1600\);setTimeout\(unlock,4000\);\}\)\(\);",
    re.S,
)
EXPLORER_UNLOCK_SAFE = (
    '  function watchdog(){try{if(window.__damBootWatchdog)window.__damBootWatchdog("explorer-inline");}catch(e){}}\n'
    "  setTimeout(watchdog,4500);})();"
)

DAM_HEADER_ACTION_INNER = """    <div class="geex-content__header__customizer">
        <button type="button" class="geex-btn geex-btn__toggle-sidebar" aria-label="Menu boczne" data-dam-tip="Otworz / zamknij menu">
            <i class="uil uil-align-center-alt"></i>
        </button>
        <button type="button" class="geex-btn geex-btn__customizer" data-dam-tip="Dostosuj wyglad">
            <i class="uil uil-pen"></i>
            <span>Dostosuj wyglad</span>
        </button>
    </div>
    <div class="geex-content__header__action__wrap">
        <ul class="geex-content__header__quickaction">
            <li class="geex-content__header__quickaction__item">
                <a href="#" class="geex-content__header__quickaction__link" aria-label="Szukaj" data-dam-tip="Szukaj">
                    <i class="uil uil-search" aria-hidden="true"></i>
                </a>
                <div class="geex-content__header__searchform geex-content__header__popup">
                    <input type="text" placeholder="Szukaj..." class="geex-content__header__btn" />
                    <i class="uil uil-search"></i>
                </div>
            </li>
            <li class="geex-content__header__quickaction__item">
                <a href="#" class="geex-content__header__quickaction__link" id="damMsgBellLink" aria-label="Wiadomosci" data-dam-tip="Wiadomosci Asana i Teams">
                    <i class="uil uil-comment-alt-dots" aria-hidden="true"></i>
                    <span class="geex-content__header__badge dam-badge--msg" id="damMsgBadge" hidden>0</span>
                </a>
                <div class="geex-content__header__popup geex-content__header__popup--message" role="dialog" aria-label="Wiadomosci"></div>
            </li>
            <li class="geex-content__header__quickaction__item">
                <a href="#" class="geex-content__header__quickaction__link" id="damNotifBellLink" aria-label="Powiadomienia" data-dam-tip="Powiadomienia operacyjne">
                    <i class="uil uil-bell" aria-hidden="true"></i>
                    <span class="geex-content__header__badge dam-badge--notif" id="damNotifBadge" hidden>0</span>
                </a>
                <div class="geex-content__header__popup geex-content__header__popup--notification" role="dialog" aria-label="Powiadomienia"></div>
            </li>
            <li class="geex-content__header__quickaction__item">
                <a href="#" class="geex-content__header__quickaction__link" aria-label="Profil" data-dam-tip="Menu uzytkownika">
                    <img class="user-img" src="assets/img/avatar/avatar-male.svg" alt="" />
                </a>
                <div class="geex-content__header__popup geex-content__header__popup--author dam-user-menu" role="menu" aria-label="Menu uzytkownika"></div>
            </li>
        </ul>
    </div>
"""

# Polish diacritics (UTF-8) — written via unicode escapes so this file stays ASCII-safe on disk
DAM_HEADER_ACTION_INNER = DAM_HEADER_ACTION_INNER.replace("Otworz", "Otw\u00f3rz")
DAM_HEADER_ACTION_INNER = DAM_HEADER_ACTION_INNER.replace("wyglad", "wygl\u0105d")
DAM_HEADER_ACTION_INNER = DAM_HEADER_ACTION_INNER.replace("Wiadomosci", "Wiadomo\u015bci")
DAM_HEADER_ACTION_INNER = DAM_HEADER_ACTION_INNER.replace("uzytkownika", "u\u017cytkownika")


def fetch(url: str, dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "DAM-vendor/1.0"})
    with urllib.request.urlopen(req, context=CTX, timeout=45) as resp:
        data = resp.read()
    dest.write_bytes(data)
    return len(data)


def find_tag_end(html: str, start: int) -> int:
    """start = index of '<tag'. Return index after matching close tag."""
    m = re.match(r"<([a-zA-Z0-9:-]+)", html[start:])
    if not m:
        raise ValueError("no tag at %s" % start)
    tag = m.group(1).lower()
    i = start
    depth = 0
    pat = re.compile(r"</?%s\b[^>]*>" % re.escape(tag), re.I)
    for mm in pat.finditer(html, start):
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
        if mm.start() > start + 8_000_000:
            break
    raise ValueError("unclosed <%s> at %s" % (tag, start))


def replace_element_inner(html: str, open_pat: str, new_inner: str) -> tuple[str, int]:
    n = 0
    out = html
    while True:
        m = re.search(open_pat, out)
        if not m:
            break
        start = m.start()
        # find end of opening tag
        gt = out.find(">", m.end() - 1)
        if gt < 0:
            break
        end = find_tag_end(out, start)
        # keep opening tag + new inner + closing tag
        close = re.search(r"</[a-zA-Z0-9:-]+>\s*$", out[start:end])
        open_tag = out[start : gt + 1]
        close_tag = out[end - (len(close.group(0)) if close else 0) : end] if close else ""
        if not close:
            # extract last close
            last = out.rfind("<", start, end)
            open_tag = out[start : gt + 1]
            close_tag = out[last:end]
        out = out[:start] + open_tag + "\n" + new_inner + close_tag + out[end:]
        n += 1
        if n > 20:
            break
    return out, n


def empty_ul_by_class(html: str, cls: str) -> tuple[str, int]:
    pat = r'<ul class="%s">' % re.escape(cls)
    return replace_element_inner(html, pat, "")


def replace_action_inner(html: str) -> tuple[str, int]:
    pat = r'<div class="geex-content__header__action">'
    return replace_element_inner(html, pat, DAM_HEADER_ACTION_INNER)


def remove_display_none_row(html: str) -> tuple[str, int]:
    m = re.search(r'<div class="row g-4" style="display:none">', html)
    if not m:
        return html, 0
    end = find_tag_end(html, m.start())
    return html[: m.start()] + html[end:], 1


def vendor_assets() -> None:
    fonts = WEB / "assets" / "vendor" / "fonts"
    icons = WEB / "assets" / "vendor" / "icons"
    fonts.mkdir(parents=True, exist_ok=True)
    (icons / "fonts" / "line").mkdir(parents=True, exist_ok=True)

    print("=== vendor Jost (fontsource static weights) ===")
    subsets = ("latin", "latin-ext")
    weights = ("300", "400", "500", "600", "700")
    faces = []
    for subset in subsets:
        for w in weights:
            name = "jost-%s-%s.woff2" % (subset, w)
            url = "https://cdn.jsdelivr.net/fontsource/fonts/jost@5.2.8/%s-%s-normal.woff2" % (subset, w)
            dest = fonts / name
            try:
                n = fetch(url, dest)
                print("  %s %s B" % (name, n))
            except Exception as e:
                print("  FAIL %s %s" % (name, e))
                continue
            ur = (
                "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
                if subset == "latin"
                else "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"
            )
            faces.append(
                "@font-face {\n"
                "  font-family: 'Jost';\n"
                "  font-style: normal;\n"
                "  font-weight: %s;\n"
                "  font-display: swap;\n"
                "  src: url('../vendor/fonts/%s') format('woff2');\n"
                "  unicode-range: %s;\n"
                "}\n" % (w, name, ur)
            )

    dam_fonts = WEB / "assets" / "css" / "dam-fonts.css"
    dam_fonts.write_text(
        "/* DAM local Jost + Unicons. No Google / jsDelivr at runtime. */\n"
        + "@import url('../vendor/icons/unicons-line.css');\n\n"
        + "".join(faces),
        encoding="utf-8",
    )
    print("wrote", dam_fonts, dam_fonts.stat().st_size)

    print("=== vendor Unicons woff2 ===")
    uni_css = icons / "unicons-line.css"
    raw = uni_css.read_text(encoding="utf-8", errors="replace")
    names = sorted(set(re.findall(r"unicons-(\d+)\.woff2", raw)))
    print("  shards", names)
    for num in names:
        woff = "unicons-%s.woff2" % num
        url = "https://cdn.jsdelivr.net/npm/@iconscout/unicons@4.0.8/fonts/line/" + woff
        dest = icons / "fonts" / "line" / woff
        try:
            n = fetch(url, dest)
            print("  %s %s B" % (woff, n))
        except Exception as e:
            print("  FAIL", woff, e)
    # rewrite css to local woff2 only
    def repl_face(m: re.Match) -> str:
        body = m.group(0)
        mm = re.search(r"unicons-(\d+)\.woff2", body)
        if not mm:
            return body
        num = mm.group(1)
        ur = re.search(r"unicode-range:([^}]+)", body)
        urange = ur.group(1).strip().rstrip(";") if ur else "U+0-10FFFF"
        return (
            "@font-face{font-family:unicons-line;"
            "src:url('./fonts/line/unicons-%s.woff2') format('woff2');"
            "font-weight:400;font-style:normal;unicode-range:%s}" % (num, urange)
        )

    new_css = re.sub(r"@font-face\{[^}]+\}", repl_face, raw)
    uni_css.write_text(new_css, encoding="utf-8")
    print("rewrote unicons-line.css", uni_css.stat().st_size)

    print("=== vendor jquery-ui images ===")
    img_dir = WEB / "assets" / "vendor" / "css" / "jquery-ui" / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    for name in (
        "ui-icons_444444_256x240.png",
        "ui-icons_555555_256x240.png",
        "ui-icons_ffffff_256x240.png",
        "ui-icons_777620_256x240.png",
        "ui-icons_cc0000_256x240.png",
        "ui-icons_777777_256x240.png",
    ):
        url = "https://code.jquery.com/ui/1.12.1/themes/base/images/" + name
        try:
            n = fetch(url, img_dir / name)
            print("  %s %s B" % (name, n))
        except Exception as e:
            print("  FAIL", name, e)


def patch_common_html(html: str, name: str) -> tuple[str, dict]:
    stats = {}
    n_f5 = len(F5_RE.findall(html))
    html = F5_RE.sub("", html)
    stats["f5"] = n_f5

    html = GOOGLE_FONT_RE.sub("", html)
    html = GSTATIC_PRE_RE.sub("", html)
    html = GOOGLE_PRE_RE.sub("", html)
    html = UNICONS_LINK_RE.sub("", html)
    html = APEX_CSS_RE.sub("", html)
    html = APEX_JS_RE.sub("", html)
    html = JQ_UI_CSS_RE.sub(
        '  <link rel="stylesheet" href="./assets/vendor/css/jquery-ui/jquery-ui.css">\n',
        html,
    )

    # inject dam-fonts.css once, after bootstrap if present, else after charset/title block
    if "dam-fonts.css" not in html:
        boot = re.search(
            r'<link rel="stylesheet" href="\./assets/vendor/css/bootstrap/bootstrap\.css">',
            html,
        )
        link = '  <link rel="stylesheet" href="./assets/css/dam-fonts.css">\n'
        if boot:
            html = html[: boot.end()] + "\n" + link + html[boot.end() :]
        else:
            html = html.replace("</title>", "</title>\n" + link, 1)

    if FAIL_OPEN_4500 in html:
        html = html.replace(FAIL_OPEN_4500, FAIL_SAFE_4500)
        stats["failopen4500"] = 1
    else:
        stats["failopen4500"] = 0

    if EXPLORER_UNLOCK_RE.search(html):
        html = EXPLORER_UNLOCK_RE.sub(EXPLORER_UNLOCK_SAFE, html)
        stats["explorer_unlock"] = 1
    else:
        stats["explorer_unlock"] = 0

    return html, stats


def patch_shell_demo(html: str, name: str) -> tuple[str, dict]:
    stats = {}
    html, n = empty_ul_by_class(html, "geex-header__menu")
    stats["header_menu"] = n
    html, n = empty_ul_by_class(html, "geex-sidebar__menu")
    stats["sidebar_menu"] = n
    html, n = replace_action_inner(html)
    stats["header_action"] = n
    if name == "explorer.html":
        html, n = remove_display_none_row(html)
        stats["hidden_row"] = n
    else:
        stats["hidden_row"] = 0
    return html, stats


def patch_signin(html: str) -> str:
    html = html.replace(
        '      <div class="geex-content__authentication__img">\n'
        '        <img src="./assets/img/authentication.svg" alt="">\n'
        "      </div>",
        '      <div class="geex-content__authentication__img">\n'
        "        <picture>\n"
        '          <source type="image/avif" srcset="./assets/img/auth/kubara-building.avif">\n'
        '          <img src="./assets/img/auth/kubara-building.jpg" alt="Budynek siedziby Kubara w Konstancinie-Jeziornie">\n'
        "        </picture>\n"
        "      </div>",
    )
    if "dam-auth.css" not in html:
        # after last DAM stylesheet (dam-brand.css)
        html = html.replace(
            '<link rel="stylesheet" href="./assets/css/dam-brand.css?v=restore20260805c">',
            '<link rel="stylesheet" href="./assets/css/dam-brand.css?v=restore20260805c">\n'
            '  <link rel="stylesheet" href="./assets/css/dam-auth.css">',
            1,
        )
    return html


SIGNIN_GEEX = """<!doctype html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>DAM - przekierowanie</title>
  <meta http-equiv="refresh" content="0;url=signin.html">
  <script>location.replace("signin.html");</script>
</head>
<body>
  <p>Przekierowanie do logowania DAM.</p>
</body>
</html>
"""


def main() -> None:
    vendor_assets()

    html_files = sorted(WEB.glob("*.html"))
    f5_files = []
    line_counts = {}

    shell5 = {
        "dashboard.html",
        "explorer.html",
        "visualizations.html",
        "costs.html",
        "invoices.html",
    }

    for path in html_files:
        raw = path.read_text(encoding="utf-8")
        before = raw.count("\n") + (0 if raw.endswith("\n") else 1)
        html, st = patch_common_html(raw, path.name)
        if st.get("f5"):
            f5_files.append(path.name)
        if path.name in shell5:
            html, st2 = patch_shell_demo(html, path.name)
            st.update(st2)
        if path.name == "signin.html":
            html = patch_signin(html)
        if path.name == "signin-geex.html":
            html = SIGNIN_GEEX
            st["signin_geex"] = "redirect"
        after = html.count("\n") + (0 if html.endswith("\n") else 1)
        if html != raw:
            path.write_text(html, encoding="utf-8", newline="\n")
            line_counts[path.name] = {
                "before": before,
                "after": after,
                "delta": after - before,
                **st,
            }
            print("PATCHED", path.name, line_counts[path.name])
        else:
            print("SKIP", path.name, st)

    print("F5_FILES", len(f5_files), f5_files)
    leftover = []
    for path in html_files:
        t = path.read_text(encoding="utf-8")
        if "_damr=" in t:
            leftover.append(path.name)
    print("DAMR_LEFT", leftover)


if __name__ == "__main__":
    main()
