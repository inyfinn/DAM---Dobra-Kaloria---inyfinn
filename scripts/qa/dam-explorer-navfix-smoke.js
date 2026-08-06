#!/usr/bin/env node
/**
 * Prove explorer reaches document.complete quickly (MCP hang root cause).
 * NO cursor-ide-browser. Hard timeouts.
 */
"use strict";
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");
const LOG = path.join(REPO, "logs", "dam-connection");
const PORT = 9355;
const URL = "http://127.0.0.1:8765/explorer.html?v=bootNavFix20260806a";
const BUDGET_MS = 8000;

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
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
        })
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
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
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
      }, ms || 10000);
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

function killPort() {
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'remote-debugging-port=" +
        PORT +
        "' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    ],
    { windowsHide: true, timeout: 8000 }
  );
}

async function main() {
  fs.mkdirSync(LOG, { recursive: true });
  if (typeof WebSocket === "undefined") throw new Error("need WebSocket");
  const browser = findBrowser();
  if (!browser) throw new Error("no browser");
  const gate = await httpGet("http://127.0.0.1:8765/explorer.html", 5000);
  if (!gate.ok) throw new Error("http_gate");
  if (/tiny\.cloud|fullcalendar\.io|unpkg\.com\/swiper|cdnjs\.cloudflare\.com\/ajax\/libs\/dragula/i.test(gate.body)) {
    console.error("[navfix] FAIL: explorer.html still embeds blocking CDN scripts");
    process.exitCode = 2;
    return;
  }

  killPort();
  const userData = path.join(os.tmpdir(), "dam-navfix-" + Date.now());
  fs.mkdirSync(userData, { recursive: true });
  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--user-data-dir=" + userData,
      "--remote-debugging-port=" + PORT,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" }
  );

  const out = { ok: false };
  let cdp;
  try {
    const tWait = Date.now();
    while (Date.now() - tWait < 15000) {
      const v = await httpGet("http://127.0.0.1:" + PORT + "/json/version", 1500);
      if (v.ok) break;
      await sleep(200);
    }
    const list = JSON.parse((await httpGet("http://127.0.0.1:" + PORT + "/json/list", 3000)).body || "[]");
    const page = list.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
    if (!page) throw new Error("no_page");
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable", {}, 4000);
    await cdp.send("Runtime.enable", {}, 4000);

    const t0 = Date.now();
    await cdp.send("Page.navigate", { url: URL }, 12000);

    let completeMs = null;
    let last = null;
    while (Date.now() - t0 < BUDGET_MS + 5000) {
      const ev = await cdp.send(
        "Runtime.evaluate",
        {
          expression: `({
            rs: document.readyState,
            opacity: document.body ? getComputedStyle(document.body).opacity : null,
            shell: !!window.DamShell,
            explorer: !!window.DamExplorer,
            hasTinyCdn: !![...document.scripts].find(s => /tiny\\.cloud|fullcalendar|dragula|swiper-bundle/.test(s.src||'')),
            kids: document.body ? document.body.children.length : 0
          })`,
          returnByValue: true,
        },
        5000
      );
      last = ev && ev.result && ev.result.value;
      if (last && last.rs === "complete" && completeMs == null) completeMs = Date.now() - t0;
      if (last && last.rs === "complete" && last.shell && parseFloat(last.opacity) > 0.5) break;
      await sleep(200);
    }

    out.completeMs = completeMs;
    out.last = last;
    out.ok =
      completeMs != null &&
      completeMs <= BUDGET_MS &&
      last &&
      last.shell &&
      !last.hasTinyCdn &&
      parseFloat(last.opacity) > 0.5;

    fs.writeFileSync(path.join(LOG, "explorer-navfix-last.json"), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    if (!out.ok) {
      console.error("[navfix] FAIL completeMs=" + completeMs + " budget=" + BUDGET_MS);
      process.exitCode = 1;
      return;
    }
    console.log("[navfix] PASS - load completes in " + completeMs + "ms (MCP can finish navigate)");
    process.exitCode = 0;
  } catch (e) {
    out.error = String(e.message || e);
    fs.writeFileSync(path.join(LOG, "explorer-navfix-last.json"), JSON.stringify(out, null, 2));
    console.error("[navfix] FAIL", out.error);
    process.exitCode = 1;
  } finally {
    try {
      if (cdp) cdp.close();
    } catch (_) {}
    try {
      child.kill();
    } catch (_) {}
    killPort();
  }
}

main();
