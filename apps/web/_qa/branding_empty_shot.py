"""Headless: branding empty — mascot LEFT, card RIGHT edge."""
from __future__ import annotations

import asyncio
import base64
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import websockets

QA = Path(__file__).resolve().parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9251

EXPR = r"""
(() => {
  const wrap =
    document.querySelector(".dam-branding-empty-wrap") ||
    document.getElementById("damBrandingSectionGrid") ||
    document.getElementById("vizGrid") ||
    document.querySelector(".dam-viz-empty");
  const row = document.querySelector(".dam-empty-mascot-row");
  const speak = document.querySelector(".dam-empty-mascot-row__speak");
  const bubble = document.querySelector(".dam-empty-mascot-row__bubble");
  const m = document.querySelector(".dam-empty-mascot-row__mascot");
  const card = document.querySelector(".dam-empty-mascot-row__card");
  if (!row || !m || !card) return { ok: false, why: "missing row/mascot/card" };
  const rr = row.getBoundingClientRect();
  const mr = m.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  const br = bubble ? bubble.getBoundingClientRect() : null;
  const cs = getComputedStyle(row);
  const speakMt = speak ? parseFloat(getComputedStyle(speak).marginTop) || 0 : 0;
  const cardMt = parseFloat(getComputedStyle(card).marginTop) || 0;
  return {
    ok: true,
    justify: cs.justifyContent,
    hasBubble: !!bubble && !!(bubble.textContent || "").trim(),
    bubbleText: bubble ? (bubble.textContent || "").trim().slice(0, 80) : "",
    speakMarginTop: speakMt,
    cardMarginTop: cardMt,
    mascotTop: Math.round(mr.top),
    cardTop: Math.round(cr.top),
    mascotLowerThanCard: mr.top > cr.top + 20,
    cardHigherThanMascot: cr.top < mr.top - 20,
    mascotLeftGap: Math.round(mr.left - rr.left),
    cardRightGap: Math.round(rr.right - cr.right),
    midGap: Math.round(cr.left - (speak ? speak.getBoundingClientRect().right : mr.right)),
    cardOnRight: (rr.right - cr.right) < 24 && cr.left > mr.right + 40,
    mascotOnLeft: (mr.left - rr.left) < 40,
    tipClearancePad: parseFloat(getComputedStyle(m).paddingTop) || 0,
    medalW: Math.round(mr.width),
    medalH: Math.round(parseFloat(getComputedStyle(m).width) || mr.width),
    mood: row.getAttribute("data-empty-mood") || "",
    poseBg: (getComputedStyle(m.querySelector(".dam-empty-mascot-row__mascot-img") || m).backgroundImage || "").slice(0, 120),
  };
})()
"""


def kill_port(port: int) -> None:
    try:
        out = subprocess.check_output(
            ["cmd", "/c", f"netstat -ano | findstr :{port}"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        return
    for line in out.splitlines():
        parts = line.split()
        if parts and parts[-1].isdigit():
            subprocess.run(
                ["taskkill", "/F", "/PID", parts[-1]],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )


def wait_cdp(port: int, timeout: float = 12.0) -> None:
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=1)
            return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError("CDP down")


async def run(url: str, shot: Path, w: int = 1280) -> dict:
    tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json", timeout=5))
    page = next(t for t in tabs if t.get("type") == "page" and t.get("webSocketDebuggerUrl"))
    async with websockets.connect(page["webSocketDebuggerUrl"], max_size=40_000_000) as ws:
        _id = 0

        async def call(method, params=None):
            nonlocal _id
            _id += 1
            await ws.send(json.dumps({"id": _id, "method": method, "params": params or {}}))
            while True:
                raw = json.loads(await ws.recv())
                if raw.get("id") == _id:
                    return raw

        await call("Page.enable")
        await call("Runtime.enable")
        await call(
            "Emulation.setDeviceMetricsOverride",
            {"width": w, "height": 900, "deviceScaleFactor": 1, "mobile": False},
        )
        await call("Page.navigate", {"url": url})
        await asyncio.sleep(1.2)
        geo = await call("Runtime.evaluate", {"expression": EXPR, "returnByValue": True})
        val = geo.get("result", {}).get("result", {}).get("value") or {"ok": False}
        shot_r = await call("Page.captureScreenshot", {"format": "png", "fromSurface": True})
        data = shot_r.get("result", {}).get("data")
        if data:
            shot.write_bytes(base64.b64decode(data))
        return val


def main() -> int:
    label = sys.argv[1] if len(sys.argv) > 1 else "br1"
    url = (
        sys.argv[2]
        if len(sys.argv) > 2
        else f"http://127.0.0.1:8765/_qa/branding-empty-preview.html?v={label}"
    )
    kill_port(PORT)
    time.sleep(0.3)
    ud = QA / f"_chrome_profile_{PORT}"
    ud.mkdir(exist_ok=True)
    proc = subprocess.Popen(
        [
            CHROME,
            f"--remote-debugging-port={PORT}",
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            f"--window-size=1280,900",
            f"--user-data-dir={ud}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_cdp(PORT)
        shot = QA / f"branding-empty-{label}.png"
        val = asyncio.run(run(url, shot))
        print(json.dumps({"shot": str(shot), "geo": val}, indent=2))
        if (
            not val.get("ok")
            or not val.get("cardOnRight")
            or not val.get("mascotOnLeft")
            or not val.get("hasBubble")
            or not val.get("mascotLowerThanCard")
            or (val.get("medalW") or 0) < 160
        ):
            return 2
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
