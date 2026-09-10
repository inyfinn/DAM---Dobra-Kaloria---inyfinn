#!/usr/bin/env node
/** Same-tab Explorer reload probe x3. Unique user-data-dir. No Cursor MCP. */
"use strict";
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..", "..");
const OUT_DIR = __dirname;
const UI = "http://127.0.0.1:8765/explorer.html";
const UI_BUST = "http://127.0.0.1:8765/explorer.html?_damr=cachebust";
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
            headers: res.headers,
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

const PROBE_JS = `(() => {
  const folder = document.getElementById("damFolderList");
  const items = folder ? folder.querySelectorAll(".dam-folder-item:not([data-dam-skeleton])") : [];
  const html = document.documentElement;
  const loader = document.getElementById("damLoader");
  const bodyCs = document.body ? getComputedStyle(document.body) : null;
  const overlay = loader ? getComputedStyle(loader) : null;
  const ready = document.readyState;
  return {
    href: location.href,
    title: document.title,
    readyState: ready,
    htmlClass: html.className,
    booting: html.classList.contains("dam-booting"),
    booted: html.classList.contains("dam-booted"),
    bodyOpacity: bodyCs ? bodyCs.opacity : null,
    bodyPE: bodyCs ? bodyCs.pointerEvents : null,
    folderItems: items.length,
    bodyTextLen: document.body ? (document.body.innerText || "").trim().length : 0,
    loaderDisplay: overlay ? overlay.display : "none",
    loaderOpacity: overlay ? overlay.opacity : "0",
    v: (window.DAM_APP_VERSION || ""),
    hasHardReload: typeof window.__damHardReload === "function",
    panicInstalled: !!window.__damPanicReloadInstalled
  };
})()`;

async function probe(cdp) {
  const ev = await cdp.send(
    "Runtime.evaluate",
    { expression: PROBE_JS, returnByValue: true },
    8000
  );
  return (ev && ev.result && ev.result.value) || {};
}

async function shot(cdp, name) {
  let cap = null;
  for (let i = 0; i < 3; i++) {
    try {
      cap = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }, 20000);
      if (cap && cap.data) break;
    } catch (e) {
      if (i === 2) throw e;
      await sleep(400);
    }
  }
  const pngPath = path.join(OUT_DIR, name);
  let bytes = 0;
  if (cap && cap.data) {
    const buf = Buffer.from(cap.data, "base64");
    fs.writeFileSync(pngPath, buf);
    bytes = buf.length;
  }
  return { pngPath, bytes };
}

function isFail(p) {
  if (!p) return true;
  if (/signin/i.test(p.href || "")) return true;
  if (p.booting && !p.booted) return true;
  if (Number(p.bodyOpacity) === 0) return true;
  if ((p.folderItems || 0) < 1) return true;
  if ((p.bodyTextLen || 0) < 20) return true;
  if (p.readyState === "loading") return true;
  return false;
}

async function waitBoot(cdp, ms) {
  const t0 = Date.now();
  let last = {};
  while (Date.now() - t0 < ms) {
    last = await probe(cdp);
    if (!isFail(last) && last.booted && last.folderItems >= 8) return last;
    await sleep(250);
  }
  return last;
}

async function main() {
  if (typeof WebSocket === "undefined") throw new Error("need Node WebSocket");
  const html = await httpReq(UI, {}, 5000);
  const js = await httpReq("http://127.0.0.1:8765/assets/js/dam-panic-reload.js?v=5.0.180", {}, 5000);
  const curl = {
    htmlStatus: html.status,
    htmlCache: (html.headers && (html.headers["cache-control"] || html.headers["Cache-Control"])) || "",
    htmlLen: (html.body || "").length,
    jsStatus: js.status,
    jsCache: (js.headers && (js.headers["cache-control"] || js.headers["Cache-Control"])) || "",
    jsHasStop: /window\.stop\s*\(/.test(js.body || ""),
    jsHasPrevent: /\.preventDefault\s*\(/.test(js.body || ""),
  };
  console.log("[curl]", JSON.stringify(curl));
  if (!html.ok || !js.ok) throw new Error("curl_fail");
  if (curl.jsHasStop) throw new Error("panic_still_window_stop");
  if (curl.jsHasPrevent) throw new Error("panic_still_preventDefault");

  const sess = await rehydrateToken();
  const browser = findBrowser();
  if (!browser) throw new Error("no browser");
  const port = 9427;
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
  const userData = path.join(os.tmpdir(), "dam-explorer-reload-180-" + Date.now());
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
  const results = [];
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
    let p0 = await waitBoot(cdp, 12000);
    let s0 = await shot(cdp, "explorer-5.0.180-nav.png");
    results.push({ step: "nav", probe: p0, bytes: s0.bytes, png: path.basename(s0.pngPath), fail: isFail(p0) });
    console.log("[nav]", JSON.stringify({ folderItems: p0.folderItems, booted: p0.booted, booting: p0.booting, bodyOpacity: p0.bodyOpacity, href: p0.href, v: p0.v, fail: isFail(p0) }));

    for (let i = 1; i <= 3; i++) {
      await cdp.send("Page.reload", { ignoreCache: i === 3 }, 12000);
      const p = await waitBoot(cdp, 12000);
      const s = await shot(cdp, "explorer-5.0.180-reload" + i + ".png");
      const row = { step: "reload" + i, probe: p, bytes: s.bytes, png: path.basename(s.pngPath), fail: isFail(p) };
      results.push(row);
      console.log("[reload" + i + "]", JSON.stringify({ folderItems: p.folderItems, booted: p.booted, booting: p.booting, bodyOpacity: p.bodyOpacity, loaderDisplay: p.loaderDisplay, href: p.href, v: p.v, fail: isFail(p) }));
    }

    await cdp.send("Page.navigate", { url: UI_BUST }, 12000);
    const pb = await waitBoot(cdp, 12000);
    const sb = await shot(cdp, "explorer-5.0.180-cachebust.png");
    results.push({ step: "cachebust", probe: pb, bytes: sb.bytes, png: path.basename(sb.pngPath), fail: isFail(pb) });
    console.log("[cachebust]", JSON.stringify({ folderItems: pb.folderItems, booted: pb.booted, href: pb.href, v: pb.v, fail: isFail(pb) }));
  } finally {
    try {
      if (cdp) cdp.close();
    } catch (_) {}
    try {
      child.kill();
    } catch (_) {}
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "explorer-5.0.180-reload-probe.json"),
    JSON.stringify({ curl, results: results.map((r) => ({ step: r.step, probe: r.probe, bytes: r.bytes, png: r.png, fail: r.fail })) }, null, 2)
  );
  const fail = results.some((r) => r.fail);
  process.exitCode = fail ? 1 : 0;
  if (fail) console.error("[probe] FAIL");
  else console.log("[probe] PASS");
}

main().catch((e) => {
  console.error("[probe] FAIL", String(e.message || e));
  process.exit(1);
});
