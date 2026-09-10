# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import struct
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
BASE = "http://127.0.0.1:8765"
BRIDGE = "http://127.0.0.1:8766"


def png_wh(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return 0, 0
    w, h = struct.unpack(">II", data[16:24])
    return int(w), int(h)


def shot(page, stem: str) -> dict:
    path = OUT / (stem + ".png")
    page.screenshot(path=str(path), full_page=False)
    w, h = png_wh(path)
    print("SHOT", stem, "%sx%s" % (w, h), path.stat().st_size)
    return {"w": w, "h": h, "bytes": path.stat().st_size, "path": str(path)}


def rehydrate() -> dict:
    req = urllib.request.Request(
        BRIDGE + "/auth/rehydrate",
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    sess = rehydrate()
    print("SESSION", (sess.get("user") or {}).get("name"))
    token = sess.get("token") or ""
    user = sess.get("user") or {}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            channel="chrome",
            args=["--window-size=1280,900"],
        )
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        context.route("**/*", lambda route: route.continue_())
        context.add_init_script(
            """(function(t,d,s,u){
          try {
            localStorage.setItem("dam_token", t);
            localStorage.setItem("dam_device_id", d);
            localStorage.setItem("dam_session_id", s);
            localStorage.setItem("dam_role", u.role || "admin");
            localStorage.setItem("dam_user_name", u.name || "");
            localStorage.setItem("dam_user", JSON.stringify(u));
          } catch (e) {}
        })(%s,%s,%s,%s);"""
            % (
                json.dumps(token),
                json.dumps(sess.get("device_id") or ""),
                json.dumps(sess.get("session_id") or ""),
                json.dumps(user),
            )
        )
        page = context.new_page()
        cdp = context.new_cdp_session(page)
        cdp.send("Network.enable")
        cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})

        page.goto(BASE + "/explorer.html", wait_until="domcontentloaded")
        page.wait_for_timeout(2800)
        tree = page.evaluate(
            """() => {
              var el = document.getElementById("damFolderList");
              var items = el ? el.querySelectorAll(".dam-folder-item, .dam-cat-item, [data-path]").length : 0;
              return {
                kids: el ? el.children.length : 0,
                items: items,
                text: el ? (el.innerText||"").slice(0,400) : ""
              };
            }"""
        )
        print("TREE1", tree)
        shot(page, "v-ex-tree1")
        fl = page.locator("#damFolderList")
        if fl.count():
            fl.screenshot(path=str(OUT / "v-ex-folderlist1.png"))
            w, h = png_wh(OUT / "v-ex-folderlist1.png")
            print("SHOT v-ex-folderlist1", "%sx%s" % (w, h), (OUT / "v-ex-folderlist1.png").stat().st_size)

        page.locator(".geex-sidebar a[href='visualizations.html']").first.click()
        page.wait_for_timeout(1400)
        shot(page, "v-ex-on-viz2")
        page.locator(".geex-sidebar a[href='explorer.html']").first.click()
        page.wait_for_timeout(2800)
        tree2 = page.evaluate(
            """() => {
              var el = document.getElementById("damFolderList");
              var items = el ? el.querySelectorAll(".dam-folder-item, .dam-cat-item, [data-path]").length : 0;
              return {
                kids: el ? el.children.length : 0,
                items: items,
                text: el ? (el.innerText||"").slice(0,400) : ""
              };
            }"""
        )
        print("TREE2", tree2)
        shot(page, "v-ex-tree2")
        if fl.count():
            page.locator("#damFolderList").screenshot(path=str(OUT / "v-ex-folderlist2.png"))
            w, h = png_wh(OUT / "v-ex-folderlist2.png")
            print("SHOT v-ex-folderlist2", "%sx%s" % (w, h), (OUT / "v-ex-folderlist2.png").stat().st_size)

        ctx2 = browser.new_context(viewport={"width": 1280, "height": 900})
        p2 = ctx2.new_page()
        cdp2 = ctx2.new_cdp_session(p2)
        cdp2.send("Network.enable")
        cdp2.send("Network.setCacheDisabled", {"cacheDisabled": True})
        p2.goto(BASE + "/dashboard.html?dam_boot_fail=1", wait_until="domcontentloaded")
        p2.wait_for_timeout(900)
        fail = p2.evaluate(
            """() => ({
              fail: !!document.getElementById("damBootFail"),
              title: (document.getElementById("damBootFailTitle")||{}).textContent || "",
              text: (document.getElementById("damBootFailText")||{}).textContent || "",
              geexDemo: (document.body.innerText||"").includes("Server Management"),
              boot: document.documentElement.className,
              force: !!window.__damForceBootFail,
              panic: typeof window.__damShowBootFail
            })"""
        )
        print("FAIL", fail)
        shot(p2, "v-boot-fail")

        # console errors on explorer
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(BASE + "/explorer.html", wait_until="domcontentloaded")
        page.wait_for_timeout(1200)
        charts = page.evaluate(
            """() => ({
              ids: ["chart-5","chart-6","chart-7"].map(id => !!document.getElementById(id)),
              apex: typeof ApexCharts,
              inst: (window.Apex && window.Apex.charts) ? Object.keys(window.Apex.charts||{}).length : null
            })"""
        )
        print("CHARTS", charts, "ERRS", errs)

        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
