# -*- coding: utf-8 -*-
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(r"P:/DAM/ui-complete/screenshots")
out.mkdir(parents=True, exist_ok=True)
base = "http://127.0.0.1:8765"

scenarios = [
    ("loop-1", f"{base}/explorer.html?v=ralph4", None, 1280),
    ("loop-2", f"{base}/explorer.html?v=ralph4", ("#damFileSearch", "6300"), 1280),
    ("loop-3", f"{base}/explorer.html?v=ralph4", ("#damFileSearch", "6300539"), 1280),
    ("loop-4", f"{base}/explorer.html?v=ralph4", ("#damFileSearch", "6300538"), 1280),
    ("loop-5", f"{base}/explorer.html?v=ralph4", ("#damFileSearch", "czekolada"), 1280),
    ("loop-6", f"{base}/visualizations.html?v=ralph4", None, 1280),
    ("loop-7", f"{base}/visualizations.html?v=ralph4&lang=de", None, 1280),
    ("loop-8", f"{base}/visualizations.html?product=tarta-malinowa-nerkowcowy&v=ralph4", None, 1280),
    ("loop-9", f"{base}/explorer.html?index=6300539&v=ralph4", None, 768),
    ("loop-10", f"{base}/explorer.html?v=ralph4", None, 375),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, url, fill, w in scenarios:
        page = browser.new_page(viewport={"width": w, "height": 900 if w >= 768 else 740})
        page.goto(url, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(900)
        if fill:
            sel, text = fill
            page.fill(sel, "")
            page.type(sel, text, delay=40)
            page.wait_for_timeout(600)
        bp = {1280: "1024", 768: "768", 375: "375"}[w]
        path = out / f"{name}-{bp}.png"
        page.screenshot(path=str(path), full_page=False)
        print("saved", path.name)
        if name in ("loop-8", "loop-9", "loop-10"):
            page.screenshot(path=str(out / f"loop-final-{bp}.png"), full_page=False)
        page.close()
    browser.close()
print("DONE")
