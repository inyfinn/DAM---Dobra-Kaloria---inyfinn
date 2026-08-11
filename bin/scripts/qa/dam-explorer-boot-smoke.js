#!/usr/bin/env node
/** Headless: explorer must leave opacity:0 within 4s. NO cursor-ide-browser MCP. */
"use strict";
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");
const LOG = path.join(REPO, "logs", "dam-connection");
const PORT = 9351;
const URL = "http://127.0.0.1:8765/explorer.html?v=bootReveal20260806a";

function findBrowser() {
  for (const c of [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean)) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}
function httpGet(url, ms) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: ms }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") })
      );
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    req.on("error", (e) => resolve({ ok: false, error: String(e.message || e) }));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.wsUrl = ws;
    this.id = 1;
    this.pending = new Map();
  }
  connect() {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("ws_timeout")), 8000);
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener("open", () => {
        clearTimeout(t);
        resolve();
      });
      this.ws.addEventListener("error", (e) => {
        clearTimeout(t);
        reject(e.error || e);
      });
      this.ws.addEventListener("message", (ev) => {
        let msg;
        try {
          msg = JSON.parse(String(ev.data));
        } catch (_) {
          return;
        }
        if (msg.id && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          clearTimeout(p.t);
          if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
          else p.resolve(msg.result);
        }
      });
    });
  }
  send(method, params, ms) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("cdp_timeout_" + method));
      }, ms || 8000);
      this.pending.set(id, { resolve, reject, t });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  close() {
    try {
      this.ws.close();
    } catch (_) {}
  }
}

async function main() {
  fs.mkdirSync(LOG, { recursive: true });
  if (typeof WebSocket === "undefined") throw new Error("need Node WebSocket");
  const browser = findBrowser();
  if (!browser) throw new Error("no browser");
  const gate = await httpGet("http://127.0.0.1:8765/explorer.html", 5000);
  if (!gate.ok) throw new Error("http_gate");

  spawnSync(
    "powershell",
    ["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'remote-debugging-port=" + PORT + "' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
    { windowsHide: true, timeout: 8000 }
  );

  const userData = path.join(os.tmpdir(), "dam-boot-smoke-" + Date.now());
  fs.mkdirSync(userData, { recursive: true });
  const child = spawn(browser, ["--headless=new", "--disable-gpu", "--disable-extensions", "--no-first-run", "--user-data-dir=" + userData, "--remote-debugging-port=" + PORT, "--window-size=1280,800", "about:blank"], {
    windowsHide: true,
    stdio: "ignore",
  });

  const out = { ok: false, samples: [] };
  let cdp;
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const v = await httpGet("http://127.0.0.1:" + PORT + "/json/version", 1500);
      if (v.ok) break;
      await sleep(200);
    }
    const list = await httpGet("http://127.0.0.1:" + PORT + "/json/list", 3000);
    const pages = JSON.parse(list.body || "[]");
    const page = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
    if (!page) throw new Error("no_page");
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable", {}, 4000);
    await cdp.send("Runtime.enable", {}, 4000);
    await cdp.send("Page.navigate", { url: URL }, 12000);

    const waits = [800, 2000, 3500, 5000];
    let prev = 0;
    for (const wait of waits) {
      await sleep(wait - prev);
      prev = wait;
      const ev = await cdp.send(
        "Runtime.evaluate",
        {
          expression: `(() => {
            const b = document.body;
            const cs = b ? getComputedStyle(b) : null;
            return {
              ready: document.readyState,
              href: location.href,
              htmlBoot: document.documentElement.className,
              bodyClass: b ? b.className : null,
              opacity: cs ? cs.opacity : null,
              kids: b ? b.children.length : 0,
              title: document.title,
              shell: !!window.DamShell,
              explorer: !!window.DamExplorer
            };
          })()`,
          returnByValue: true,
        },
        8000
      );
      const v = ev && ev.result && ev.result.value;
      out.samples.push({ t: wait, v });
      console.log("[boot]", wait + "ms", JSON.stringify(v));
    }

    const last = out.samples[out.samples.length - 1].v;
    const opacity = parseFloat(last && last.opacity);
    out.ok = !!last && last.kids > 5 && opacity > 0.5 && /Eksplorator/i.test(last.title || "");
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" }, 10000);
    if (shot && shot.data) {
      const png = path.join(LOG, "explorer-boot.png");
      fs.writeFileSync(png, Buffer.from(shot.data, "base64"));
      out.screenshot = png;
      console.log("[boot] shot", png);
    }
    fs.writeFileSync(path.join(LOG, "explorer-boot-last.json"), JSON.stringify(out, null, 2));
    if (!out.ok) throw new Error("still_blank:" + JSON.stringify(last));
    console.log("[boot] PASS");
    process.exitCode = 0;
  } catch (e) {
    out.error = String(e.message || e);
    fs.writeFileSync(path.join(LOG, "explorer-boot-last.json"), JSON.stringify(out, null, 2));
    console.error("[boot] FAIL", out.error);
    process.exitCode = 1;
  } finally {
    try {
      if (cdp) cdp.close();
    } catch (_) {}
    try {
      child.kill();
    } catch (_) {}
  }
}

main();
