# Headed Chrome. Mouse clicks only. No Runtime.evaluate / page.evaluate.
from __future__ import annotations

import os
import sys
import time

from playwright.sync_api import sync_playwright

EVIDENCE = os.path.dirname(os.path.abspath(__file__))
URL_EX = "http://127.0.0.1:8765/explorer.html"
CLICK_VIZ = (120, 249)
CLICK_EX = (120, 193)


def shot(page, stem: str) -> str:
    path = os.path.join(EVIDENCE, stem + ".png")
    page.screenshot(path=path, full_page=False)
    print("SHOT", stem, path, flush=True)
    return path


def human_click(page, xy, label: str) -> None:
    x, y = xy
    print("CLICK", label, x, y, flush=True)
    page.mouse.move(x, y)
    time.sleep(0.08)
    page.mouse.click(x, y, delay=60)


def main() -> int:
    print("START headed chrome 1280x1800 v5.0.186", flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            channel="chrome",
            args=[
                "--window-size=1280,1800",
                "--window-position=40,40",
                "--disable-session-crashed-bubble",
                "--hide-crash-restore-bubble",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-features=InfiniteSessionRestore,TranslateUI",
            ],
            timeout=15000,
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 1800},
            device_scale_factor=1,
        )
        page = context.new_page()
        page.set_default_timeout(15000)
        page.goto(URL_EX, wait_until="domcontentloaded", timeout=15000)
        time.sleep(2.2)
        print("URL first", page.url, flush=True)
        human_click(page, CLICK_VIZ, "Wizualizacje")
        t0 = time.time()
        while time.time() - t0 < 3:
            if "visualizations.html" in (page.url or ""):
                break
            time.sleep(0.15)
        if "visualizations.html" not in (page.url or ""):
            for y in (261, 248, 272):
                human_click(page, (120, y), "Wizualizacje-%s" % y)
                time.sleep(0.6)
                print("retry viz", y, page.url, flush=True)
                if "visualizations.html" in (page.url or ""):
                    break
        viz_nav_ms = int((time.time() - t0) * 1000)
        print("URL viz", page.url, "nav_ms", viz_nav_ms, flush=True)
        time.sleep(0.35)
        shot(page, "explorer-186-viz-clickable")
        if "visualizations.html" not in (page.url or ""):
            print("BLOCKED never reached visualizations.html", flush=True)
            browser.close()
            return 2
        t1 = time.time()
        human_click(page, CLICK_EX, "Eksplorer")
        while time.time() - t1 < 5:
            elapsed = int((time.time() - t1) * 1000)
            print("wait return", elapsed, "ms", page.url, flush=True)
            if "explorer.html" in (page.url or ""):
                break
            time.sleep(0.2)
        ret_ms = int((time.time() - t1) * 1000)
        print("URL return", page.url, "click_to_url_ms", ret_ms, flush=True)
        time.sleep(3.2)
        shot(page, "explorer-186-3-return")
        print("URL after settle", page.url, flush=True)
        browser.close()
    print("DONE", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print("FAIL", type(exc).__name__, exc, flush=True)
        sys.exit(2)
