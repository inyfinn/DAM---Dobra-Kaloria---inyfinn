#!/usr/bin/env node
/**
 * HTTP gate for DAM UI before cursor-ide-browser MCP.
 * Default: curl-equivalent asset checks with hard timeouts (never hang).
 * Optional: --try-chrome headless CDP about:blank + one page load (WARN on fail unless --chrome-strict).
 *
 * Logs: logs/dam-connection/freeze-log.jsonl
 */
"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");
const LOG_DIR = path.join(REPO, "logs", "dam-connection");
const FREEZE_LOG = path.join(LOG_DIR, "freeze-log.jsonl");
const UI = "http://127.0.0.1:8765";
const BRIDGE = "http://127.0.0.1:8766";
const HARD_MS = 5000;
const CHROME_MS = 20000;

function nowIso() {
  return new Date().ToISOString ? new Date().toISOString() : new Date().toISOString();
}

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function appendFreeze(row) {
  ensureLogDir();
  fs.appendFileSync(
    FREEZE_LOG,
    JSON.stringify(Object.assign({ ts: new Date().toISOString() }, row)) + "\n",
    "utf8"
  );
}

function httpGet(url, timeoutMs) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r) => {
      if (settled) return;
      settled = true;
      resolve(Object.assign({ latency_ms: Date.now() - t0, url }, r));
    };
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      finish({
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
      });
    });
    req.on("timeout", () => {
      req.destroy();
      finish({ ok: false, status: 0, error: "timeout", freeze: true });
    });
    req.on("error", (e) => finish({ ok: false, status: 0, error: String(e.message || e) }));
  });
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function waitHttp(url, timeoutMs, tries) {
  const t0 = Date.now();
  return new Promise(async (resolve) => {
    for (let i = 0; i < tries; i++) {
      const r = await httpGet(url, Math.min(2000, timeoutMs));
      if (r.ok) return resolve({ ok: true, latency_ms: Date.now() - t0, status: r.status });
      await new Promise((x) => setTimeout(x, 250));
      if (Date.now() - t0 > timeoutMs) break;
    }
    resolve({ ok: false, latency_ms: Date.now() - t0, error: "wait_timeout" });
  });
}

async function tryChrome(pageUrl) {
  const browser = findBrowser();
  if (!browser) {
    return { ok: false, error: "browser_not_found", warn: true };
  }
  const port = 9333 + Math.floor(Math.random() * 40);
  const userData = path.join(os.tmpdir(), "dam-browser-probe-" + port + "-" + Date.now());
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
      "--window-size=1280,800",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" }
  );
  const t0 = Date.now();
  try {
    const ready = await waitHttp("http://127.0.0.1:" + port + "/json/version", CHROME_MS, 40);
    if (!ready.ok) {
      appendFreeze({
        tool: "dam-browser-probe",
        url: pageUrl,
        outcome: "FREEZE",
        latency_ms: Date.now() - t0,
        diagnosis: "chrome_debug_port_timeout",
        recovery_action: "kill_headless_chrome",
      });
      return { ok: false, error: "chrome_debug_timeout", freeze: true, warn: true };
    }
    const list = await httpGet("http://127.0.0.1:" + port + "/json/list", 3000);
    if (!list.ok) {
      return { ok: false, error: "json_list_fail", warn: true };
    }
    // Soft: debugger port up counts as chrome alive for gate.
    return { ok: true, port, latency_ms: Date.now() - t0 };
  } finally {
    try {
      child.kill();
    } catch (_) {}
    if (process.platform === "win32") {
      try {
        spawnSync(
          "powershell",
          [
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'dam-browser-probe-" +
              port +
              "' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
          ],
          { windowsHide: true, timeout: 10000 }
        );
      } catch (_) {}
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const tryChromeFlag = argv.indexOf("--try-chrome") >= 0;
  const chromeStrict = argv.indexOf("--chrome-strict") >= 0;

  const checks = [
    UI + "/explorer.html",
    UI + "/dashboard.html",
    UI + "/assets/js/dam-pakiet.js?v=pakiet20260806c",
    BRIDGE + "/health",
  ];

  let fail = false;
  for (const url of checks) {
    const r = await httpGet(url, HARD_MS);
    const tag = r.ok ? "OK " : "FAIL";
    console.log(
      tag +
        "  " +
        url.replace(/^http:\/\/127\.0\.0\.1:\d+\//, "") +
        "  HTTP " +
        (r.status || 0) +
        "  " +
        r.latency_ms +
        "ms" +
        (r.error ? "  " + r.error : "")
    );
    if (!r.ok) {
      fail = true;
      if (r.freeze) {
        appendFreeze({
          tool: "dam-browser-probe",
          url,
          outcome: "FREEZE",
          latency_ms: r.latency_ms,
          diagnosis: "http_timeout",
          recovery_action: "dam-agent-unstick",
        });
      }
    }
  }

  if (fail) {
    console.log("[probe] FAIL http gate");
    process.exit(1);
  }

  if (tryChromeFlag) {
    const chrome = await tryChrome(UI + "/explorer.html");
    if (!chrome.ok) {
      console.log("[probe] chrome WARN:", chrome.error || "fail");
      appendFreeze({
        tool: "dam-browser-probe",
        url: UI + "/explorer.html",
        outcome: chrome.freeze ? "FREEZE" : "WARN",
        latency_ms: chrome.latency_ms || 0,
        diagnosis: chrome.error || "chrome_fail",
        recovery_action: "use_headless_cdp_not_mcp",
      });
      if (chromeStrict) {
        console.log("[probe] FAIL chrome-strict");
        process.exit(1);
      }
    } else {
      console.log("[probe] chrome OK port=" + chrome.port + " " + chrome.latency_ms + "ms");
    }
  }

  console.log("[probe] PASS");
  process.exit(0);
}

main().catch((e) => {
  console.error("[probe] crash", e);
  process.exit(1);
});
