# -*- coding: utf-8 -*-
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(r"P:/DAM/ui-complete/screenshots")
out.mkdir(parents=True, exist_ok=True)
base = "http://127.0.0.1:8765"
v = "20260717ux3"

scenarios = [
    ("ux2-loop-1", f"{base}/explorer.html?v={v}", None, 1280),
    ("ux2-loop-2", f"{base}/explorer.html?v={v}", ("#damFileSearch", "czekolada"), 1280),
    ("ux2-loop-3", f"{base}/explorer.html?v={v}", ("#damFileSearch", "6300539"), 1280),
    ("ux2-loop-4", f"{base}/explorer.html?index=6300753&v={v}", None, 1280),
    ("ux2-loop-5", f"{base}/explorer.html?product=tarta-malinowa-nerkowcowy&v={v}", None, 1280),
    ("ux2-loop-6", f"{base}/explorer.html?product=babka-cytrynowa-nerkowcowy&v={v}", None, 1280),
    ("ux2-loop-7", f"{base}/explorer.html?v={v}", "admin", 1280),
    ("ux2-loop-8", f"{base}/visualizations.html?v={v}", None, 1280),
    ("ux2-loop-9", f"{base}/explorer.html?v={v}", "collapse", 768),
    ("ux2-loop-10", f"{base}/explorer.html?v={v}", None, 375),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, url, action, w in scenarios:
        page = browser.new_page(viewport={"width": w, "height": 900 if w >= 768 else 740})
        page.goto(url, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(1000)
        if isinstance(action, tuple):
            sel, text = action
            page.fill(sel, "")
            page.type(sel, text, delay=35)
            page.wait_for_timeout(700)
        elif action == "admin":
            page.check("#damAdminMode")
            page.wait_for_timeout(400)
            # open kulki category if present
            page.locator(".dam-folder-item").nth(1).click()
            page.wait_for_timeout(600)
        elif action == "collapse":
            btn = page.locator(".dam-sidebar-collapse-btn").first
            if btn.count():
                btn.click()
                page.wait_for_timeout(400)
        bp = {1280: "1024", 768: "768", 375: "375"}[w]
        path = out / f"{name}-{bp}.png"
        page.screenshot(path=str(path), full_page=False)
        print("saved", path.name)
        if name in ("ux2-loop-8", "ux2-loop-9", "ux2-loop-10"):
            page.screenshot(path=str(out / f"loop-final-{bp}.png"), full_page=False)
        page.close()
    browser.close()
print("DONE")
