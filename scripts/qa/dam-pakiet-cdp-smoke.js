#!/usr/bin/env node
/**
 * Headless CDP smoke for DamPakiet — NO cursor-ide-browser MCP.
 * Uses Node global WebSocket + hard timeouts. Exit 0 = dialog + picker OK.
 */
"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");
const LOG_DIR = path.join(REPO, "logs", "dam-connection");
const UI = "http://127.0.0.1:8765/explorer.html?v=pakiet20260806c";
const PORT = 9347;

function ensureLog() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function httpGet(url, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
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

async function waitDebugger(port, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await httpGet("http://127.0.0.1:" + port + "/json/version", 1500);
    if (r.ok) return true;
    await sleep(200);
  }
  return false;
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.ws = null;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("ws_connect_timeout")), 8000);
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
        if (!msg.id || !this.pending.has(msg.id)) return;
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
      });
    });
  }
  send(method, params, timeoutMs) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("cdp_timeout_" + method));
      }, timeoutMs || 8000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  close() {
    try {
      if (this.ws) this.ws.close();
    } catch (_) {}
  }
}

async function pickWs(port) {
  const list = await httpGet("http://127.0.0.1:" + port + "/json/list", 3000);
  if (!list.ok) throw new Error("json_list_fail");
  const pages = JSON.parse(list.body || "[]");
  const page = pages.find(
    (p) => p.type === "page" && p.webSocketDebuggerUrl && !String(p.url || "").startsWith("chrome-extension:")
  );
  if (!page) throw new Error("no_page_target");
  return page.webSocketDebuggerUrl;
}

function killPortChrome(port) {
  if (process.platform !== "win32") return;
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'remote-debugging-port=" +
        port +
        "|dam-pakiet-cdp-' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    ],
    { windowsHide: true, timeout: 10000 }
  );
}

async function main() {
  ensureLog();
  if (typeof WebSocket === "undefined") {
    console.error("[pakiet-cdp] global WebSocket missing (need Node 22+)");
    process.exit(2);
  }
  const browser = findBrowser();
  if (!browser) {
    console.error("[pakiet-cdp] chrome/edge not found");
    process.exit(2);
  }

  for (const u of ["http://127.0.0.1:8765/explorer.html", "http://127.0.0.1:8766/health"]) {
    const r = await httpGet(u, 5000);
    if (!r.ok) {
      console.error("[pakiet-cdp] HTTP FAIL", u, r.error || r.status);
      process.exit(1);
    }
  }

  killPortChrome(PORT);
  const userData = path.join(os.tmpdir(), "dam-pakiet-cdp-" + Date.now());
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
      "--window-size=1280,800",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" }
  );

  const out = { ok: false };
  let cdp = null;
  try {
    if (!(await waitDebugger(PORT, 20000))) throw new Error("debugger_timeout");
    const wsUrl = await pickWs(PORT);
    cdp = new CdpSession(wsUrl);
    await cdp.connect();
    await cdp.send("Page.enable", {}, 5000);
    await cdp.send("Runtime.enable", {}, 5000);
    await cdp.send("Page.navigate", { url: UI }, 12000);

    let ready = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 25000) {
      const ev = await cdp.send(
        "Runtime.evaluate",
        {
          expression:
            "({href:location.href,pakiet:!!(window.DamPakiet&&DamPakiet.openChoice),explorer:!!window.DamExplorer,readyState:document.readyState})",
          returnByValue: true,
        },
        8000
      );
      ready = ev && ev.result && ev.result.value;
      if (ready && ready.pakiet) break;
      await sleep(400);
    }
    out.boot = ready;
    if (!ready || !ready.pakiet) throw new Error("DamPakiet_not_loaded");

    const open = await cdp.send(
      "Runtime.evaluate",
      {
        expression: `(function(){
          DamPakiet.openChoice({revPath:"X:\\\\Marketing\\\\PROBE\\\\IDX\\\\rev",index:"PROBE",productId:"PROBE",label:"PAKIET"});
          var card=document.getElementById("damPakietChoice");
          if(!card) return {ok:false,error:"no_overlay"};
          return {
            ok:true,
            text:(card.innerText||"").replace(/\\s+/g," ").trim().slice(0,220),
            btns:[...card.querySelectorAll("[data-pakiet-act]")].map(b=>b.getAttribute("data-pakiet-act")),
            x:!!card.querySelector(".dam-pakiet-card__x"),
            bubble:!!card.querySelector(".dam-pakiet-bubble")
          };
        })()`,
        returnByValue: true,
      },
      8000
    );
    out.choice = open && open.result && open.result.value;
    if (!out.choice || !out.choice.ok) throw new Error("choice_fail:" + JSON.stringify(out.choice));
    if (!out.choice.x) throw new Error("missing_x");
    if ((out.choice.btns || []).indexOf("one") < 0 || (out.choice.btns || []).indexOf("more") < 0) {
      throw new Error("missing_actions:" + JSON.stringify(out.choice.btns));
    }

    const shot = await cdp.send("Page.captureScreenshot", { format: "png" }, 10000);
    if (shot && shot.data) {
      const png = path.join(LOG_DIR, "pakiet-choice.png");
      fs.writeFileSync(png, Buffer.from(shot.data, "base64"));
      out.screenshot = png;
      console.log("[pakiet-cdp] shot", png);
    }

    const more = await cdp.send(
      "Runtime.evaluate",
      {
        expression: `(function(){
          var b=document.querySelector('[data-pakiet-act="more"]');
          if(b) b.click();
          var p=document.getElementById("damPakietPicker");
          return {
            picker:!!p,
            search:!!(p&&p.querySelector("#damPakietSearch")),
            dest:!!(p&&p.querySelector(".dam-pakiet-dest")),
            go:!!(p&&p.querySelector('[data-pakiet-pick="go"]')),
            x:!!(p&&p.querySelector(".dam-pakiet-card__x"))
          };
        })()`,
        returnByValue: true,
      },
      8000
    );
    out.picker = more && more.result && more.result.value;
    if (!out.picker || !out.picker.picker || !out.picker.search || !out.picker.go || !out.picker.x) {
      throw new Error("picker_fail:" + JSON.stringify(out.picker));
    }
    const shot2 = await cdp.send("Page.captureScreenshot", { format: "png" }, 10000);
    if (shot2 && shot2.data) {
      const png2 = path.join(LOG_DIR, "pakiet-picker.png");
      fs.writeFileSync(png2, Buffer.from(shot2.data, "base64"));
      out.screenshot_picker = png2;
      console.log("[pakiet-cdp] shot", png2);
    }

    out.ok = true;
    fs.writeFileSync(path.join(LOG_DIR, "pakiet-cdp-last.json"), JSON.stringify(out, null, 2));
    console.log("[pakiet-cdp] PASS");
    process.exitCode = 0;
  } catch (e) {
    out.error = String(e.message || e);
    fs.writeFileSync(path.join(LOG_DIR, "pakiet-cdp-last.json"), JSON.stringify(out, null, 2));
    fs.appendFileSync(
      path.join(LOG_DIR, "freeze-log.jsonl"),
      JSON.stringify({
        ts: new Date().toISOString(),
        tool: "dam-pakiet-cdp-smoke",
        url: UI,
        outcome: "FAIL",
        diagnosis: out.error,
        recovery_action: "dam-agent-unstick_then_retry_headless",
      }) + "\n"
    );
    console.error("[pakiet-cdp] FAIL", out.error);
    process.exitCode = 1;
  } finally {
    try {
      if (cdp) cdp.close();
    } catch (_) {}
    try {
      child.kill();
    } catch (_) {}
    killPortChrome(PORT);
  }
}

main();
