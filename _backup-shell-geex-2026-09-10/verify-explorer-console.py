# -*- coding: utf-8 -*-
from playwright.sync_api import sync_playwright

errs = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=False, channel="chrome")
    c = b.new_context(viewport={"width": 1280, "height": 900})
    page = c.new_page()
    cdp = c.new_cdp_session(page)
    cdp.send("Network.enable")
    cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto("http://127.0.0.1:8765/explorer.html", wait_until="domcontentloaded")
    page.wait_for_timeout(1600)
    charts = page.evaluate(
        """() => ({
          ids: ["chart-5","chart-6","chart-7"].map(id => !!document.getElementById(id)),
          apex: typeof ApexCharts
        })"""
    )
    print("ERRS", errs)
    print("CHARTS", charts)
    b.close()
