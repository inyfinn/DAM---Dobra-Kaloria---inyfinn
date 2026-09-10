# -*- coding: utf-8 -*-
"""Headed Chrome verification for Geex-strip WORKER. Do not print secrets."""
from __future__ import annotations

import json
import struct
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
BASE = "http://127.0.0.1:8765"
BRIDGE = "http://127.0.0.1:8766"
FORBIDDEN = (
    "Server Management",
    "Mahabub",
    "David Warner",
    "John Doe",
    "120Gb",
    "EnglishLesson1",
    "Wash-hand",
    "One Drive",
    "iCloud",
)


def png_wh(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return 0, 0
    w, h = struct.unpack(">II", data[16:24])
    return int(w), int(h)


def rehydrate() -> dict:
    req = urllib.request.Request(
        BRIDGE + "/auth/rehydrate",
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode("utf-8"))


def seed_session(context, sess: dict) -> None:
    token = sess.get("token") or ""
    user = sess.get("user") or {}
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


def shot(page, stem: str) -> dict:
    path = OUT / (stem + ".png")
    page.screenshot(path=str(path), full_page=False)
    w, h = png_wh(path)
    print("SHOT", stem, "%sx%s" % (w, h), path.name, "bytes", path.stat().st_size)
    return {"stem": stem, "path": str(path), "w": w, "h": h, "bytes": path.stat().st_size}


def forbidden_in(text: str) -> list[str]:
    return [s for s in FORBIDDEN if s in (text or "")]


def main() -> int:
    sess = rehydrate()
    if not sess.get("ok") or not sess.get("token"):
        print("FAIL rehydrate")
        return 2
    print("SESSION_OK user", (sess.get("user") or {}).get("name"), "role", (sess.get("user") or {}).get("role"))

    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            channel="chrome",
            args=["--window-size=1280,900", "--disable-session-crashed-bubble"],
            timeout=20000,
        )
        context = browser.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
        seed_session(context, sess)
        page = context.new_page()
        page.set_default_timeout(20000)

        def load_and_probe(name: str, url: str, wait_ms: int = 700) -> dict:
            net = []

            def on_req(req):
                net.append(req.url)

            page.on("request", on_req)
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(wait_ms)
            body = page.content()
            hits = forbidden_in(body)
            js = page.evaluate(
                """() => ({
                  title: document.title,
                  boot: document.documentElement.className,
                  hasCustomizer: !!document.querySelector(".geex-customizer"),
                  hasMsgBadge: !!document.getElementById("damMsgBadge"),
                  folderKids: (document.getElementById("damFolderList")||{children:[]}).children.length,
                  charts: ["chart-5","chart-6","chart-7"].map(id => !!document.getElementById(id)),
                  apex: typeof ApexCharts,
                  fail: !!document.getElementById("damBootFail"),
                  failText: (document.getElementById("damBootFailTitle")||{}).textContent || "",
                  demo: ["Server Management","Mahabub","David Warner","John Doe","120Gb","EnglishLesson1","Wash-hand","One Drive","iCloud"].filter(s => document.body && document.body.innerText.includes(s))
                })"""
            )
            page.remove_listener("request", on_req)
            ext = [
                u
                for u in net
                if u.startswith("http")
                and "127.0.0.1" not in u
                and "localhost" not in u
            ]
            rec = {
                "url": page.url,
                "hits": hits,
                "js": js,
                "external": ext,
                "net_n": len(net),
            }
            rec["shot"] = shot(page, name)
            print("PAGE", name, "hits", hits, "ext", ext[:8], "js", js)
            results[name] = rec
            return rec

        load_and_probe("v-dashboard", BASE + "/dashboard.html", 900)
        # customizer
        opened = page.evaluate(
            """() => {
              var b = document.querySelector(".geex-btn__customizer");
              if (b) { b.click(); return true; }
              return false;
            }"""
        )
        page.wait_for_timeout(400)
        custom_on = page.evaluate(
            """() => {
              var p = document.querySelector(".geex-customizer");
              return !!(p && p.classList.contains("active"));
            }"""
        )
        results["customizer"] = {"clicked": opened, "active": custom_on, "shot": shot(page, "v-customizer")}
        print("CUSTOMIZER", opened, custom_on)
        page.evaluate(
            """() => {
              var c = document.querySelector(".geex-customizer");
              if (c) c.classList.remove("active");
            }"""
        )

        load_and_probe("v-explorer", BASE + "/explorer.html", 2200)
        load_and_probe("v-viz", BASE + "/visualizations.html", 1000)
        load_and_probe("v-costs", BASE + "/costs.html", 800)
        load_and_probe("v-invoices", BASE + "/invoices.html", 800)

        # Explorer -> Viz -> Explorer
        page.goto(BASE + "/explorer.html", wait_until="domcontentloaded")
        page.wait_for_timeout(1800)
        kids1 = page.evaluate(
            "() => (document.getElementById('damFolderList')||{children:[]}).children.length"
        )
        results["ex1"] = {"kids": kids1, "shot": shot(page, "v-ex-before-viz")}
        page.locator(".geex-sidebar a[href='visualizations.html']").first.click(timeout=8000)
        page.wait_for_timeout(1200)
        results["ex2"] = {"url": page.url, "shot": shot(page, "v-ex-on-viz")}
        page.locator(".geex-sidebar a[href='explorer.html']").first.click(timeout=8000)
        page.wait_for_timeout(2000)
        kids2 = page.evaluate(
            "() => (document.getElementById('damFolderList')||{children:[]}).children.length"
        )
        cat_text = page.evaluate(
            "() => (document.getElementById('damFolderList')||{}).innerText || ''"
        )
        results["ex3"] = {
            "kids": kids2,
            "url": page.url,
            "hasKids": kids2 > 0,
            "sample": cat_text[:200],
            "shot": shot(page, "v-ex-return"),
        }
        print("EX_RETURN kids", kids1, "->", kids2)

        # signin + network (no session seed: new context)
        ctx2 = browser.new_context(viewport={"width": 1280, "height": 900})
        p2 = ctx2.new_page()
        net2 = []
        p2.on("request", lambda r: net2.append(r.url))
        p2.goto(BASE + "/signin.html", wait_until="domcontentloaded")
        p2.wait_for_timeout(800)
        ext2 = [u for u in net2 if u.startswith("http") and "127.0.0.1" not in u and "localhost" not in u]
        results["signin"] = {
            "ext": ext2,
            "net": net2,
            "hasPicture": p2.evaluate("() => !!document.querySelector('picture source[type=\"image/avif\"]')"),
            "hasAuthCss": p2.evaluate("() => !!document.querySelector('link[href*=\"dam-auth.css\"]')"),
            "hasSvg": p2.evaluate("() => !!document.querySelector('img[src*=\"authentication.svg\"]')"),
            "shot": shot(p2, "v-signin"),
        }
        print("SIGNIN ext", ext2, "n", len(net2))

        p2.goto(BASE + "/signin-geex.html", wait_until="domcontentloaded")
        p2.wait_for_timeout(500)
        results["signin-geex"] = {
            "url": p2.url,
            "title": p2.title(),
            "shot": shot(p2, "v-signin-geex"),
        }
        print("SIGNIN_GEEX", p2.url, p2.title())

        # fail screen
        p3 = ctx2.new_page()
        p3.goto(BASE + "/dashboard.html?dam_boot_fail=1", wait_until="domcontentloaded")
        p3.wait_for_timeout(600)
        fail = p3.evaluate(
            """() => ({
              fail: !!document.getElementById("damBootFail"),
              title: (document.getElementById("damBootFailTitle")||{}).textContent || "",
              geexDemo: (document.body.innerText||"").includes("Server Management"),
              boot: document.documentElement.className
            })"""
        )
        results["fail"] = {"js": fail, "shot": shot(p3, "v-boot-fail")}
        print("FAIL_SCREEN", fail)

        # dashboard network (seeded)
        netd = []
        page.on("request", lambda r: netd.append(r.url))
        page.goto(BASE + "/dashboard.html", wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        ext_d = [u for u in netd if u.startswith("http") and "127.0.0.1" not in u and "localhost" not in u]
        results["dash-net"] = {"ext": ext_d, "n": len(netd), "urls": netd[:40]}
        print("DASH_NET ext", ext_d, "n", len(netd))

        browser.close()

    (OUT / "verify-results.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("WROTE verify-results.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
