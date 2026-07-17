# -*- coding: utf-8 -*-
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(r"P:/DAM/ui-complete/screenshots")
base = "http://127.0.0.1:8765"
v = "20260717ux4"

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    page = b.new_page(viewport={"width": 768, "height": 900})
    page.goto(f"{base}/explorer.html?v={v}", wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.evaluate("document.body.classList.add('dam-sidebar-collapsed')")
    page.wait_for_timeout(300)
    page.screenshot(path=str(out / "ux2-loop-9-768.png"))
    page.screenshot(path=str(out / "loop-final-768.png"))
    print("9 ok")
    page.close()

    page = b.new_page(viewport={"width": 375, "height": 740})
    page.goto(f"{base}/explorer.html?v={v}", wait_until="networkidle")
    page.wait_for_timeout(900)
    page.screenshot(path=str(out / "ux2-loop-10-375.png"))
    page.screenshot(path=str(out / "loop-final-375.png"))
    print("10 ok")
    page.close()

    page = b.new_page(viewport={"width": 1280, "height": 900})
    page.goto(
        f"{base}/explorer.html?product=tarta-malinowa-nerkowcowy&v={v}",
        wait_until="networkidle",
    )
    page.wait_for_timeout(1200)
    page.evaluate(
        """() => {
      const btns = [...document.querySelectorAll('button')]
        .filter(b => /Otworz/i.test(b.textContent || ''));
      if (btns[1]) btns[1].click();
      else if (btns[0]) btns[0].click();
    }"""
    )
    page.wait_for_timeout(800)
    page.evaluate(
        """() => {
      const m = document.getElementById('damExplorerMain');
      if (m) m.scrollTop = 99999;
    }"""
    )
    page.wait_for_timeout(250)
    page.screenshot(path=str(out / "ux2-loop-5b-tarta-layers-1024.png"))
    page.screenshot(path=str(out / "loop-final-1024.png"))
    print("tarta ok")
    page.close()
    b.close()

print("DONE")
