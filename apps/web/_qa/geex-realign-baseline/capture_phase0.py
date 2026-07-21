"""Capture Geex realign phase0 baselines (PNG local, not git)."""
from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / "phase0"
BASE = "http://127.0.0.1:8765"
PAGES = [
    ("dashboard", f"{BASE}/dashboard.html"),
    ("branding", f"{BASE}/branding.html"),
    ("visualizations", f"{BASE}/visualizations.html"),
    ("explorer", f"{BASE}/explorer.html"),
    ("settings", f"{BASE}/settings.html"),
    ("inbox", f"{BASE}/inbox.html"),
]
VIEWPORTS = [1440, 1024, 390]
THEMES = ["light", "dark"]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    meta = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for theme in THEMES:
            for w in VIEWPORTS:
                h = 900 if w >= 1024 else 844
                context = browser.new_context(
                    viewport={"width": w, "height": h},
                    color_scheme="dark" if theme == "dark" else "light",
                )
                page = context.new_page()
                page.add_init_script(
                    f"localStorage.setItem('theme', '{theme}');"
                    f"document.documentElement.setAttribute('data-theme', '{theme}');"
                )
                for slug, url in PAGES:
                    name = f"phase0-{slug}-{theme}-{w}.png"
                    path = OUT / name
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=60000)
                        page.wait_for_timeout(1200)
                        page.evaluate(
                            f"() => {{ document.documentElement.setAttribute('data-theme', '{theme}'); "
                            f"try {{ localStorage.setItem('theme', '{theme}'); }} catch (e) {{}} }}"
                        )
                        page.wait_for_timeout(400)
                        page.screenshot(
                            path=str(path),
                            full_page=False,
                            timeout=60000,
                            animations="disabled",
                        )
                        st = "ok"
                    except Exception as e:  # noqa: BLE001
                        st = f"fail:{e}"
                    meta.append(
                        {
                            "file": name,
                            "page": slug,
                            "theme": theme,
                            "vp": w,
                            "status": st,
                        }
                    )
                    print(st, name)
                context.close()
        browser.close()
    (OUT / "_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    ok = sum(1 for m in meta if m["status"] == "ok")
    print(f"DONE {ok}/{len(meta)}")


if __name__ == "__main__":
    main()
