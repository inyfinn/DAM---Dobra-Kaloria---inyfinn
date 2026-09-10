#!/usr/bin/env node
/** Explorer tree first-paint probe x3. Unique user-data-dir. No Cursor MCP. */
"use strict";
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..", "..");
const OUT_DIR = __dirname;
const UI = "http://127.0.0.1:8765/explorer.html?v=5.0.179";
const BRIDGE = "http://127.0.0.1:8766";
const BOUND = path.join(REPO, "apps", "desktop", "data", "bound-session.json");

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

function httpReq(url, opts, ms) {
  opts = opts || {};
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: opts.method || "GET",
        headers: opts.headers || {},
        timeout: ms || 5000,
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
    if (opts.body) req.write(opts.body);
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

async function rehydrateToken() {
  const bound = JSON.parse(fs.readFileSync(BOUND, "utf8"));
  const body = JSON.stringify({
    session_id: bound.session_id || "",
    device_id: bound.device_id || "",
    machine_id: bound.machine_id || "",
  });
  const r = await httpReq(
    BRIDGE + "/auth/rehydrate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    },
    5000
  );
  if (!r.ok) throw new Error("rehydrate_http_" + (r.status || r.error));
  const data = JSON.parse(r.body || "{}");
  if (!(data && data.ok && data.token)) throw new Error("rehydrate_no_token");
  return {
    token: data.token,
    device_id: data.device_id || bound.device_id,
    machine_id: data.machine_id || bound.machine_id,
    session_id: data.session_id || bound.session_id,
    role: (data.user && data.user.role) || "admin",
    name: (data.user && data.user.name) || "",
  };
}

async function onePass(pass, sess) {
  const browser = findBrowser();
  if (!browser) throw new Error("no browser");
  const port = 9410 + pass;
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'remote-debugging-port=" +
        port +
        "' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    ],
    { windowsHide: true, timeout: 8000 }
  );
  const userData = path.join(os.tmpdir(), "dam-explorer-179-" + Date.now() + "-" + pass);
  fs.mkdirSync(userData, { recursive: true });
  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "--user-data-dir=" + userData,
      "--remote-debugging-port=" + port,
      "--window-size=1280,1800",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" }
  );
  let cdp;
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const v = await httpReq("http://127.0.0.1:" + port + "/json/version", {}, 1500);
      if (v.ok) break;
      await sleep(200);
    }
    const list = await httpReq("http://127.0.0.1:" + port + "/json/list", {}, 3000);
    const pages = JSON.parse(list.body || "[]");
    const page = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
    if (!page) throw new Error("no_page");
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable", {}, 4000);
    await cdp.send("Runtime.enable", {}, 4000);
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: 1280, height: 1800, deviceScaleFactor: 1, mobile: false },
      4000
    );
    const bootJs =
      "localStorage.setItem('dam_token'," +
      JSON.stringify(sess.token) +
      ");localStorage.setItem('dam_device_id'," +
      JSON.stringify(sess.device_id) +
      ");localStorage.setItem('dam_machine_id'," +
      JSON.stringify(sess.machine_id) +
      ");localStorage.setItem('dam_session_id'," +
      JSON.stringify(sess.session_id) +
      ");localStorage.setItem('dam_role'," +
      JSON.stringify(sess.role) +
      ");";
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: bootJs }, 4000);
    await cdp.send("Page.navigate", { url: UI }, 12000);
    await sleep(3500);
    const ev = await cdp.send(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const folder = document.getElementById("damFolderList");
          const items = folder ? folder.querySelectorAll(".dam-folder-item:not([data-dam-skeleton])") : [];
          const skel = folder ? folder.querySelectorAll("[data-dam-skeleton]") : [];
          const st = document.getElementById("damExplorerStatus");
          const html = document.documentElement;
          const loader = document.querySelector("[class*='dam-loader'], #damLoader, .dam-loader");
          const folderCs = folder ? getComputedStyle(folder) : null;
          const bodyCs = document.body ? getComputedStyle(document.body) : null;
          const overlay = loader ? getComputedStyle(loader) : null;
          return {
            href: location.href,
            title: document.title,
            htmlClass: html.className,
            booting: html.classList.contains("dam-booting"),
            booted: html.classList.contains("dam-booted"),
            bodyOpacity: bodyCs ? bodyCs.opacity : null,
            bodyPE: bodyCs ? bodyCs.pointerEvents : null,
            folderItems: items.length,
            skeletonItems: skel.length,
            folderOpacity: folderCs ? folderCs.opacity : null,
            folderVis: folderCs ? folderCs.visibility : null,
            status: st ? String(st.textContent || "") : "",
            statusHidden: st ? st.hasAttribute("hidden") : true,
            loaderDisplay: overlay ? overlay.display : "none",
            loaderOpacity: overlay ? overlay.opacity : "0",
            loaderPE: overlay ? overlay.pointerEvents : "none",
            v: (window.DAM_APP_VERSION || "")
          };
        })()`,
        returnByValue: true,
      },
      8000
    );
    const probe = (ev && ev.result && ev.result.value) || {};
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }, 12000);
    const pngPath = path.join(OUT_DIR, "explorer-5.0.179-r" + pass + ".png");
    let bytes = 0;
    if (shot && shot.data) {
      const buf = Buffer.from(shot.data, "base64");
      fs.writeFileSync(pngPath, buf);
      bytes = buf.length;
    }
    return { pass, probe, pngPath, bytes, userData };
  } finally {
    try {
      if (cdp) cdp.close();
    } catch (_) {}
    try {
      child.kill();
    } catch (_) {}
  }
}

async function main() {
  if (typeof WebSocket === "undefined") throw new Error("need Node WebSocket");
  const sess = await rehydrateToken();
  const results = [];
  for (let i = 1; i <= 3; i++) {
    const row = await onePass(i, sess);
    results.push(row);
    console.log(
      JSON.stringify({
        pass: i,
        folderItems: row.probe.folderItems,
        skeleton: row.probe.skeletonItems,
        status: row.probe.status,
        statusHidden: row.probe.statusHidden,
        booting: row.probe.booting,
        booted: row.probe.booted,
        bodyOpacity: row.probe.bodyOpacity,
        folderOpacity: row.probe.folderOpacity,
        loaderDisplay: row.probe.loaderDisplay,
        v: row.probe.v,
        href: row.probe.href,
        bytes: row.bytes,
        png: path.basename(row.pngPath),
      })
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, "explorer-5.0.179-probe.json"), JSON.stringify(results.map((r) => ({ pass: r.pass, probe: r.probe, bytes: r.bytes, png: path.basename(r.pngPath) })), null, 2));
  const fail = results.some(
    (r) =>
      !r.probe.folderItems ||
      /ładowanie indeksu/i.test(r.probe.status || "") ||
      /signin/i.test(r.probe.href || "")
  );
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => {
  console.error("[probe] FAIL", String(e.message || e));
  process.exit(1);
});
