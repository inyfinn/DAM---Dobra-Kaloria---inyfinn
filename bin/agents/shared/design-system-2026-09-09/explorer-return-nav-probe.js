#!/usr/bin/env node
/**
 * Same-tab Explorer → Visualizations → Explorer.
 * CDP: Page.navigate + Page.captureScreenshot + DOM.getOuterHTML only.
 * NO Runtime.evaluate. Unique user-data-dir. Kill Chrome if a step >40s.
 */
"use strict";
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const OUT_DIR = __dirname;
const UI_EX = "http://127.0.0.1:8765/explorer.html?v=5.0.182";
const UI_VIZ = "http://127.0.0.1:8765/visualizations.html?v=5.0.182";
const BRIDGE = "http://127.0.0.1:8766";
const BOUND = path.resolve(__dirname, "..", "..", "..", "apps", "desktop", "data", "bound-session.json");
const PORT = 9431;
const STEP_LIMIT_MS = 35000;

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
    this.events = [];
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
        if (msg.method) this.events.push(msg.method);
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
    const limit = ms || 8000;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("cdp_timeout_" + method));
      }, limit);
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
  };
}

async function waitLoad(cdp, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 12000)) {
    if (cdp.events.indexOf("Page.loadEventFired") !== -1) return true;
    await sleep(100);
  }
  return false;
}

async function navigate(cdp, url) {
  cdp.events = [];
  console.log("[nav]", url, Date.now());
  await cdp.send("Page.navigate", { url }, 12000);
  const loaded = await waitLoad(cdp, 12000);
  console.log("[load]", loaded ? "loadEventFired" : "no-load-event", Date.now());
  return loaded;
}

async function shot(cdp, name) {
  console.log("[shot]", name, Date.now());
  const cap = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }, 20000);
  const pngPath = path.join(OUT_DIR, name);
  let bytes = 0;
  if (cap && cap.data) {
    const buf = Buffer.from(cap.data, "base64");
    fs.writeFileSync(pngPath, buf);
    bytes = buf.length;
  }
  console.log("[shot-done]", name, bytes, Date.now());
  return { pngPath, bytes };
}

async function dumpSel(cdp, selector) {
  try {
    const doc = await cdp.send("DOM.getDocument", { depth: 0 }, 8000);
    const rootId = doc && doc.root && doc.root.nodeId;
    if (!rootId) return "";
    const q = await cdp.send("DOM.querySelector", { nodeId: rootId, selector }, 8000);
    if (!q || !q.nodeId) return "";
    const html = await cdp.send("DOM.getOuterHTML", { nodeId: q.nodeId }, 8000);
    return (html && html.outerHTML) || "";
  } catch (e) {
    return "ERR:" + String(e.message || e);
  }
}

function classifyFolderHtml(html) {
  const counts = [];
  const re = /dam-folder-item__count">([^<]*)</g;
  let m;
  while ((m = re.exec(html))) counts.push(String(m[1]).trim());
  const skeleton = /data-dam-skeleton/.test(html);
  const numeric = counts.filter((c) => /\d/.test(c));
  const ellipsis = counts.filter((c) => c === "…" || c === "..." || c === "&hellip;");
  return {
    itemCount: (html.match(/dam-folder-item/g) || []).length,
    counts: counts.slice(0, 12),
    numericCount: numeric.length,
    ellipsisCount: ellipsis.length,
    skeleton,
    loading: /Ładowanie indeksu/i.test(html) || /Ladowanie indeksu/i.test(html),
  };
}

async function sample(cdp, step) {
  const folder = await dumpSel(cdp, "#damFolderList");
  const status = await dumpSel(cdp, "#damExplorerStatus");
  const htmlEl = await dumpSel(cdp, "html");
  const htmlClass = /class="([^"]*)"/.exec(htmlEl || "");
  const statusText = String(status || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const cls = classifyFolderHtml(folder || "");
  const booting = htmlClass && /dam-booting/.test(htmlClass[1]);
  const peNone = /pointer-events:\s*none/i.test(htmlEl || "");
  const row = {
    step,
    htmlClass: htmlClass ? htmlClass[1].slice(0, 80) : "",
    booting: !!booting,
    statusText,
    folder: cls,
    peNoneHint: peNone,
  };
  fs.writeFileSync(path.join(OUT_DIR, "explorer-return-" + step + "-folder.html"), folder || "");
  console.log("[sample]", JSON.stringify(row));
  return row;
}

async function withDeadline(label, fn) {
  const t0 = Date.now();
  const timer = setInterval(() => {
    console.log("[alive]", label, Date.now() - t0, "ms");
  }, 5000);
  try {
    const p = Promise.race([
      fn(),
      sleep(STEP_LIMIT_MS).then(() => {
        throw new Error("step_over_40s_" + label);
      }),
    ]);
    return await p;
  } finally {
    clearInterval(timer);
  }
}

async function main() {
  if (typeof WebSocket === "undefined") throw new Error("need Node WebSocket");
  console.log("[start]", new Date().toISOString());
  const html = await httpReq(UI_EX, {}, 5000);
  const slim = await httpReq(BRIDGE + "/file-index?fields=explorer", {}, 5000);
  console.log("[curl]", html.status, html.body.length, "slim", slim.status, (slim.body || "").length);

  const sess = await rehydrateToken();
  const browser = findBrowser();
  if (!browser) throw new Error("no browser");
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

  const userData = path.join(os.tmpdir(), "dam-explorer-return-" + Date.now());
  fs.mkdirSync(userData, { recursive: true });
  console.log("[chrome-user-data]", userData);
  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "--user-data-dir=" + userData,
      "--remote-debugging-port=" + PORT,
      "--window-size=1280,1800",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" }
  );
  console.log("[chrome-pid]", child.pid);
  let cdp;
  const results = [];
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const v = await httpReq("http://127.0.0.1:" + PORT + "/json/version", {}, 1500);
      if (v.ok) break;
      await sleep(200);
    }
    const list = await httpReq("http://127.0.0.1:" + PORT + "/json/list", {}, 3000);
    const pages = JSON.parse(list.body || "[]");
    const page = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
    if (!page) throw new Error("no_page");
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable", {}, 4000);
    await cdp.send("DOM.enable", {}, 4000);
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

    await withDeadline("first-explorer", async () => {
      await navigate(cdp, UI_EX);
      await sleep(2500);
      const s = await shot(cdp, "explorer-return-1-first.png");
      const row = await sample(cdp, "1-first");
      results.push(Object.assign({ bytes: s.bytes, png: path.basename(s.pngPath) }, row));
    });

    await withDeadline("viz", async () => {
      await navigate(cdp, UI_VIZ);
      await sleep(1500);
      const s = await shot(cdp, "explorer-return-2-viz.png");
      const title = await dumpSel(cdp, "title");
      results.push({
        step: "2-viz",
        bytes: s.bytes,
        png: "explorer-return-2-viz.png",
        title: String(title || "").replace(/<[^>]+>/g, "").trim(),
      });
      console.log("[viz-title]", results[results.length - 1].title);
    });

    await withDeadline("return-explorer", async () => {
      await navigate(cdp, UI_EX);
      await sleep(300);
      const s0 = await shot(cdp, "explorer-return-3-imm.png");
      const r0 = await sample(cdp, "3-imm");
      results.push(Object.assign({ bytes: s0.bytes, png: path.basename(s0.pngPath) }, r0));

      await sleep(2700);
      const s3 = await shot(cdp, "explorer-return-3-3s.png");
      const r3 = await sample(cdp, "3-3s");
      results.push(Object.assign({ bytes: s3.bytes, png: path.basename(s3.pngPath) }, r3));

      await sleep(5000);
      const s8 = await shot(cdp, "explorer-return-3-8s.png");
      const r8 = await sample(cdp, "3-8s");
      results.push(Object.assign({ bytes: s8.bytes, png: path.basename(s8.pngPath) }, r8));
    });
  } finally {
    try {
      if (cdp) cdp.close();
    } catch (_) {}
    try {
      if (child && child.pid) {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 8000 });
      }
    } catch (_) {
      try {
        child.kill();
      } catch (_2) {}
    }
  }

  const out = path.join(OUT_DIR, "explorer-return-nav-probe.json");
  fs.writeFileSync(out, JSON.stringify({ results, chromePid: child.pid, userData }, null, 2));
  console.log("[wrote]", out);
}

main().catch((e) => {
  console.error("[probe-error]", String(e.message || e));
  process.exit(1);
});
