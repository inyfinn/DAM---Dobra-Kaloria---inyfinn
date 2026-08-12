# -*- coding: utf-8 -*-
from pathlib import Path

css = """\
.dam-logo-dk,
.geex-sidebar__logo img.logo-lite,
.geex-sidebar__logo img.logo-dark,
.geex-header__logo img.logo-lite,
.geex-header__logo img.logo-dark,
.geex-content__authentication__content__logo img {
  max-height: 48px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
}

.geex-sidebar__logo img.dam-logo-dk,
.geex-sidebar__logo .logo-lite,
.geex-sidebar__logo .logo-dark {
  max-height: 52px;
  max-width: 150px;
}

.geex-content__authentication__content__logo img {
  max-height: 72px;
  max-width: 220px;
}
"""
Path(r"P:/DAM/apps/web/assets/css/dam-brand.css").write_text(css, encoding="utf-8")
print("brand css OK")

link_tag = '<link rel="stylesheet" href="./assets/css/dam-brand.css">'
needle = 'href="./assets/css/dam-app.css">'
pages = [
    "dashboard.html", "costs.html", "explorer.html", "invoices.html",
    "index.html", "integrations.html", "project.html", "signin.html",
]
web = Path(r"P:/DAM/apps/web")
for name in pages:
    p = web / name
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    if "dam-brand.css" not in t:
        if needle in t:
            t = t.replace(needle, needle + "\n\t" + link_tag, 1)
        elif 'href="./assets/css/dam-tokens.css">' in t:
            t = t.replace(
                'href="./assets/css/dam-tokens.css">',
                'href="./assets/css/dam-tokens.css">\n\t' + link_tag,
                1,
            )
        p.write_text(t, encoding="utf-8")
        print("linked", name)
    else:
        print("already", name)

# Fix logout handler in polishUserMenu area
shell = Path(r"P:/DAM/apps/web/assets/js/dam-shell.js")
js = shell.read_text(encoding="utf-8")
old = """    document.querySelectorAll(".geex-content__header__popup--author .geex-content__header__popup__footer__link, #damShellLogout, .dam-logout-btn").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (window.DamApi) DamApi.logout();
        else {
          localStorage.removeItem("dam_token");
          localStorage.removeItem("dam_role");
          window.location.href = "signin.html";
        }
      });
    });"""
new = """    document.querySelectorAll(".geex-content__header__popup--author .geex-content__header__popup__footer__link, #damShellLogout, .dam-logout-btn").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (DAM_DEV_ALWAYS_ADMIN) {
          ensureAdminSession();
          window.location.href = "dashboard.html";
          return;
        }
        if (window.DamApi) DamApi.logout();
        else {
          localStorage.removeItem("dam_token");
          localStorage.removeItem("dam_role");
          window.location.href = "signin.html";
        }
      });
    });"""
if old in js:
    js = js.replace(old, new)
    shell.write_text(js, encoding="utf-8")
    print("logout handler OK")
else:
    print("logout handler pattern missing")

# cache bump dam-shell
for p in web.glob("*.html"):
    t = p.read_text(encoding="utf-8")
    n = t.replace("dam-shell.js?v=20260717b", "dam-shell.js?v=20260717d")
    n = n.replace("dam-shell.js?v=20260717c", "dam-shell.js?v=20260717d")
    if 'dam-shell.js"' in n and "dam-shell.js?v=" not in n:
        n = n.replace('dam-shell.js"', 'dam-shell.js?v=20260717d"')
    if n != t:
        p.write_text(n, encoding="utf-8")
        print("bump", p.name)

print("done")
