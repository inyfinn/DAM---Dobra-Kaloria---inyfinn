# -*- coding: utf-8 -*-
"""CI: i18n UTF-8 contract — pl.json, viz wiring, serve charset, no U+FFFD in panel HTML."""
from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1]
WEB = DESKTOP.parent / "web"
PL_JSON = WEB / "i18n" / "pl.json"
VIZ_HTML = WEB / "visualizations.html"
EXPLORER_HTML = WEB / "explorer.html"

# Panel HTML served on :8765 — ban U+FFFD; allow vendor elsewhere.
PANEL_HTML = [
    "visualizations.html",
    "explorer.html",
    "branding.html",
    "dashboard.html",
    "index.html",
]


class I18nUtf8Tests(unittest.TestCase):
    def test_pl_json_has_pokaz_wszystkie(self):
        data = json.loads(PL_JSON.read_text(encoding="utf-8"))
        self.assertEqual(data["common.show_all"], "Pokaż wszystkie")
        self.assertIn("Włącz", data["viz.show_all_tip"])
        self.assertIn("Wyłącz", data["viz.show_all_tip"])

    def test_pl_json_valid_utf8_no_replacement(self):
        raw = PL_JSON.read_text(encoding="utf-8")
        self.assertNotIn("\ufffd", raw)

    def test_visualizations_show_all_i18n_wired(self):
        html = VIZ_HTML.read_text(encoding="utf-8")
        self.assertIn('data-i18n="common.show_all"', html)
        self.assertIn('data-i18n-tip="viz.show_all_tip"', html)
        self.assertIn("Pokaż wszystkie", html)

    def test_explorer_show_all_i18n_wired(self):
        html = EXPLORER_HTML.read_text(encoding="utf-8")
        self.assertIn('data-i18n="common.show_all"', html)
        self.assertIn('data-i18n-tip="explorer.show_all_tip"', html)

    def test_branding_i18n_no_fffd(self):
        html = (WEB / "branding.html").read_text(encoding="utf-8")
        data = json.loads(PL_JSON.read_text(encoding="utf-8"))
        self.assertIn('data-i18n="branding.date_month"', html)
        self.assertEqual(data["branding.date_month"], "Ostatni miesiąc")
        self.assertNotIn("\ufffd", html)

    def test_dashboard_i18n_no_fffd(self):
        html = (WEB / "dashboard.html").read_text(encoding="utf-8")
        data = json.loads(PL_JSON.read_text(encoding="utf-8"))
        self.assertIn('data-i18n="dash.customize_hint"', html)
        self.assertIn("Układ pulpitu", data["dash.customize_hint"])
        self.assertNotIn("\ufffd", html)

    def test_index_projects_subtitle_i18n(self):
        html = (WEB / "index.html").read_text(encoding="utf-8")
        data = json.loads(PL_JSON.read_text(encoding="utf-8"))
        self.assertIn('data-i18n="projects.subtitle"', html)
        self.assertIn("projektów", data["projects.subtitle"])
        self.assertNotIn("\ufffd", html)

    def test_panel_html_no_u_fffd(self):
        for name in PANEL_HTML:
            path = WEB / name
            self.assertTrue(path.is_file(), msg=name)
            text = path.read_text(encoding="utf-8")
            self.assertNotIn(
                "\ufffd",
                text,
                msg=f"{name} contains U+FFFD — run fix-utf8-mojibake.py",
            )

    def test_dam_ui_http_serves_charset_utf8(self):
        src = (DESKTOP / "dam_ui_http.py").read_text(encoding="utf-8")
        self.assertIn('return "text/html; charset=utf-8"', src)
        self.assertIn('return ctype + "; charset=utf-8"', src)

    def test_serve_browser_uses_dam_ui_http(self):
        src = (DESKTOP / "serve_browser.py").read_text(encoding="utf-8")
        self.assertIn("dam_ui_http", src)
        self.assertIn("make_handler_class", src)

    def test_i18n_loader_fetch_pl_json(self):
        js = (WEB / "assets" / "js" / "dam-i18n.js").read_text(encoding="utf-8")
        self.assertIn('i18n/" + lang + ".json', js)
        self.assertIn("applyTranslations", js)
        self.assertIn("data-i18n-tip", js)

    def test_fix_script_exists(self):
        script = WEB / "scripts" / "fix-utf8-mojibake.py"
        self.assertTrue(script.is_file())
        src = script.read_text(encoding="utf-8")
        self.assertIn("encoding=\"utf-8\"", src)


if __name__ == "__main__":
    unittest.main()
