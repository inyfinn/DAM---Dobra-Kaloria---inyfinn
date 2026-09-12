#!/usr/bin/env node
"use strict";
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");
const DEST = path.join(REPO, "docs", "project", "qa-6.0.0-explorer-elementy.png");
const PORT = 9361;

function findBrowser() {
  for (const c of [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ]) {
    if (c && fs.existsSync(c)) return c;
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
      resolve({ ok: false });
    });
    req.on("error", () => resolve({ ok: false }));
  });
}
function httpPost(url, body, ms) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const data = Buffer.from(body);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname, method: "POST", timeout: ms, headers: { "Content-Type": "application/json", "Content-Length": data.length } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, body: "" });
    });
    req.on("error", () => resolve({ status: 0, body: "" }));
    req.write(data);
    req.end();
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
  const rh = await httpPost("http://127.0.0.1:8766/auth/rehydrate", "{}", 5000);
  let token = "";
  try {
    const j = JSON.parse(rh.body || "{}");
    token = (j.token || "").toString();
    console.log("rehydrate", rh.status, !!token);
  } catch (_) {}
  const browser = findBrowser();
  spawnSync("powershell", ["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'remote-debugging-port=" + PORT + "' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { windowsHide: true, timeout: 8000 });
  const userData = path.join(os.tmpdir(), "dam-qa600e-" + Date.now());
  fs.mkdirSync(userData, { recursive: true });
  const child = spawn(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--user-data-dir=" + userData, "--remote-debugging-port=" + PORT, "--window-size=1440,900", "about:blank"], { windowsHide: true, stdio: "ignore" });
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
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable", {}, 4000);
    await cdp.send("Runtime.enable", {}, 4000);
    if (token) {
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.setItem('dam_token'," + JSON.stringify(token) + ");localStorage.setItem('dam_role','admin');" }, 4000);
    }
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:8765/explorer.html?v=6.0.0" }, 12000);
    await sleep(4000);
    const opened = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        var ex = window.DamExplorer;
        if (!ex || !ex.state || !ex.state.fileIndex) return { ok:false, why:"no_index" };
        var list = ex.state.fileIndex.products || [];
        var p = null;
        for (var i = 0; i < list.length; i++) {
          var row = list[i];
          var blob = ((row.search_blob || "") + " " + (row.name || "") + " " + ((row.indexes || []).join(" "))).toUpperCase();
          if (blob.indexOf("6300783") !== -1 || blob.indexOf("CYNAMON") !== -1) { p = row; break; }
        }
        if (!p) p = list[0] || null;
        if (!p) return { ok:false, why:"no_product", n:list.length };
        ex.openProduct(p);
        return { ok:true, id:p.id, name:p.name || "", n:list.length };
      })()`,
      returnByValue: true,
    }, 12000);
    console.log("open", JSON.stringify(opened && opened.result && opened.result.value));
    await sleep(6000);
    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        if (window.DamExplorer && typeof window.DamExplorer.revealCarrierForTutorial === "function") {
          window.DamExplorer.revealCarrierForTutorial();
        }
        return true;
      })()`,
      returnByValue: true,
    }, 8000);
    await sleep(1500);
    const cta = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        var btn = document.querySelector("[data-elements-link]");
        if (btn && btn.scrollIntoView) btn.scrollIntoView({ block: "center" });
        return {
          href: location.href,
          cta: !!(btn),
          ctaText: btn ? (btn.textContent || "").trim().slice(0, 80) : "",
          main: !!(document.getElementById("damExplorerMain") && document.getElementById("damExplorerMain").innerHTML.length > 200)
        };
      })()`,
      returnByValue: true,
    }, 8000);
    console.log("cta", JSON.stringify(cta && cta.result && cta.result.value));
    const png = await cdp.send("Page.captureScreenshot", { format: "png" }, 10000);
    fs.writeFileSync(DEST, Buffer.from(png.data, "base64"));
    console.log("wrote", DEST, fs.statSync(DEST).size);
  } finally {
    try { if (cdp) cdp.close(); } catch (_) {}
    try { child.kill(); } catch (_) {}
  }
}
main().catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exitCode = 1;
});
