#!/usr/bin/env node
"use strict";
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");
const DOCS = path.join(REPO, "docs", "project");
const PORT = 9360;
const OUT = {
  elementy: path.join(DOCS, "qa-6.0.0-explorer-elementy.png"),
  db: path.join(DOCS, "qa-6.0.0-db-panel.png"),
  settings: path.join(DOCS, "qa-6.0.0-settings-db.png"),
};

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
function httpPost(url, body, ms) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const data = Buffer.from(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: "POST",
        timeout: ms,
        headers: { "Content-Type": "application/json", "Content-Length": data.length },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    req.on("error", (e) => resolve({ ok: false, error: String(e.message || e) }));
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

async function shot(cdp, dest) {
  const png = await cdp.send("Page.captureScreenshot", { format: "png" }, 10000);
  if (!png || !png.data) throw new Error("no_png_" + dest);
  fs.writeFileSync(dest, Buffer.from(png.data, "base64"));
  const st = fs.statSync(dest);
  console.log("wrote", dest, st.size);
  return st.size;
}

async function ev(cdp, expr, ms) {
  const r = await cdp.send(
    "Runtime.evaluate",
    { expression: expr, awaitPromise: true, returnByValue: true },
    ms || 12000
  );
  return r && r.result && r.result.value;
}

async function main() {
  fs.mkdirSync(DOCS, { recursive: true });
  if (typeof WebSocket === "undefined") throw new Error("need Node WebSocket");
  const browser = findBrowser();
  if (!browser) throw new Error("no browser");
  const rh = await httpPost("http://127.0.0.1:8766/auth/rehydrate", "{}", 5000);
  let token = "";
  try {
    const j = JSON.parse(rh.body || "{}");
    token = (j.token || (j.session && j.session.token) || "").toString();
    console.log("rehydrate", rh.status, !!token, j.ok, j.error || "");
  } catch (e) {
    console.log("rehydrate_parse", rh.status, String(e.message || e));
  }

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

  const userData = path.join(os.tmpdir(), "dam-qa600-" + Date.now());
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
      "--window-size=1440,900",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" }
  );

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
    if (token) {
      await cdp.send(
        "Page.addScriptToEvaluateOnNewDocument",
        {
          source:
            'localStorage.setItem("dam_token",' +
            JSON.stringify(token) +
            ');localStorage.setItem("dam_role","admin");',
        },
        4000
      );
    }
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:8765/explorer.html?v=6.0.0" }, 12000);
    await sleep(3500);
    await ev(
      cdp,
      `(() => {
        var inp = document.getElementById("damFileSearch");
        if (inp) {
          inp.value = "6300783";
          inp.dispatchEvent(new Event("input", { bubbles: true }));
        }
        var cards = document.querySelectorAll("[data-product-id], .dam-explorer-card, .dam-folder-item, [data-index]");
        if (cards[0]) cards[0].click();
        return {
          href: location.href,
          title: document.title,
          elementy: !!document.querySelector("[data-elements-link]"),
          db: !!document.getElementById("damDbStatus"),
          kids: document.body ? document.body.children.length : 0
        };
      })()`,
      8000
    );
    await sleep(2500);
    await ev(
      cdp,
      `(() => {
        var btn = document.querySelector("[data-elements-link]");
        if (!btn) {
          var more = document.querySelectorAll(".dam-explorer-item, .dam-product-card, [data-product-id]");
          if (more[0]) more[0].click();
        }
        return !!document.querySelector("[data-elements-link]");
      })()`,
      8000
    );
    await sleep(1500);
    await shot(cdp, OUT.elementy);
    await ev(
      cdp,
      `(() => {
        var el = document.getElementById("damDbStatus");
        if (el) el.click();
        var panel = document.getElementById("damDbStatusPanel");
        if (panel) panel.hidden = false;
        return !!(panel || el);
      })()`,
      8000
    );
    await sleep(800);
    await shot(cdp, OUT.db);
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:8765/settings.html?v=6.0.0" }, 12000);
    await sleep(3000);
    await ev(
      cdp,
      `(() => {
        var el = document.getElementById("damDbStatus");
        if (el) el.click();
        var panel = document.getElementById("damDbStatusPanel");
        if (panel) panel.hidden = false;
        return location.href;
      })()`,
      8000
    );
    await sleep(800);
    await shot(cdp, OUT.settings);
  } finally {
    try {
      if (cdp) cdp.close();
    } catch (_) {}
    try {
      child.kill();
    } catch (_) {}
  }
}

main().catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exitCode = 1;
});
