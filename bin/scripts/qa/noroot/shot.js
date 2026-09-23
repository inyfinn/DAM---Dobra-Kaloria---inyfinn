/**
 * Zrzut ekranu strony DAM przez CDP (Node 24 ma globalny WebSocket) - dwa tryby:
 *
 *   --target gold    -> zlota aplikacja, UI :8765, most :8766 (uzywany wprost, bez przekierowan)
 *   --target noroot   -> kopia bez folderu Marketing (ROOT), UI :9765, most :9766.
 *                         Front ma zapasowe/hardkodowane adresy :8766 - kazde takie
 *                         zapytanie jest tu przekierowywane na :9766. W trybie noroot
 *                         NIE ustawiamy dam_base_path w localStorage (na czystym
 *                         komputerze bez ROOT tej wartosci by nie bylo).
 *
 * To harness QA, nie zwykla przegladarka: headless nie ma sesji uzytkownika, wiec
 * przed zaladowaniem strony podkladamy token i stubujemy /auth/* zeby zobaczyc realny
 * ekran (Eksplorator/Projekty/...), a nie signin.html. Reszta jest prawdziwa - ten sam
 * HTML, CSS, JS i te same dane z odpowiedniego portu UI/mostu.
 *
 * Uzycie:
 *   node shot.js --target gold|noroot <url> <out.png> [W] [H] [waitMs] [plik-js-do-eval]
 *
 * Domyslne W x H = 1530 x 1170 (wymog zadania QA "parity").
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target") { out.target = argv[++i]; continue; }
    out._.push(argv[i]);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const TARGET = args.target;
if (TARGET !== "gold" && TARGET !== "noroot") {
  console.error("Uzycie: node shot.js --target gold|noroot <url> <out.png> [W] [H] [waitMs] [evalFile]");
  process.exit(2);
}

const URL_ = args._[0];
const OUT = args._[1];
const W = parseInt(args._[2] || "1530", 10);
const H = parseInt(args._[3] || "1170", 10);
const WAIT = parseInt(args._[4] || "9000", 10);
const EVAL_FILE = args._[5] || "";

// Port debugowania Chrome - uzywamy 9420+ zeby nie kolidowac z innymi harnessami QA (9411-9413).
const CDP_PORT = TARGET === "gold" ? 9420 : 9421;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGet(p, ms) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: CDP_PORT, path: p, timeout: ms || 2000 }, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => resolve({ ok: true, body: b }));
    });
    req.on("error", () => resolve({ ok: false }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false }); });
  });
}

class Cdp {
  constructor(url) { this.url = url; this.id = 0; this.waiting = new Map(); }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(new Error("ws " + String(e && e.message)));
      this.ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (m.id && this.waiting.has(m.id)) { this.waiting.get(m.id)(m); this.waiting.delete(m.id); }
      };
    });
  }
  send(method, params, ms) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.waiting.delete(id); reject(new Error("timeout " + method)); }, ms || 15000);
      this.waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
}

(async () => {
  spawnSync("powershell", ["-NoProfile", "-Command",
    "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'remote-debugging-port=" +
    CDP_PORT + "' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
    { windowsHide: true, timeout: 8000 });

  const userData = path.join(os.tmpdir(), "dam-qa-shot-" + TARGET + "-" + Date.now());
  fs.mkdirSync(userData, { recursive: true });
  const child = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--disable-extensions", "--no-first-run",
    "--disable-web-security", "--disable-site-isolation-trials",
    "--no-default-browser-check", "--hide-scrollbars",
    "--user-data-dir=" + userData,
    "--remote-debugging-port=" + CDP_PORT,
    "--window-size=" + W + "," + H,
    "about:blank",
  ], { windowsHide: true, stdio: "ignore" });

  const t0 = Date.now();
  let page = null;
  while (Date.now() - t0 < 20000) {
    const v = await httpGet("/json/version", 1500);
    if (v.ok) {
      const list = await httpGet("/json/list", 3000);
      try {
        page = JSON.parse(list.body || "[]").find((p) => p.type === "page" && p.webSocketDebuggerUrl);
      } catch (_) { page = null; }
      if (page) break;
    }
    await sleep(300);
  }
  if (!page) { console.error("CDP nie wstal"); child.kill(); process.exit(1); }

  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride",
    { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  /* Headless nie ma sesji. Podkladamy token i blokujemy skok do signin.html -
     zeby zobaczyc realny ekran, a nie ekran logowania. Reszta bez zmian. */
  const baseLocalStorage = [
    'try{localStorage.setItem("dam_token","qa-shot");',
    'localStorage.setItem("dam_role","admin");',
    'localStorage.setItem("dam_user",JSON.stringify({email:"qa@local",role:"admin",name:"QA"}));',
    'localStorage.setItem("dam_explorer_show_all","0");',
    'localStorage.setItem("dam_basepath_later","1");',
    'localStorage.setItem("dam_device_id","qa-device");',
    'localStorage.setItem("dam_admin_mode","1");',
    'localStorage.setItem("dam_user_prefs",JSON.stringify({safe_delete:false}));',
  ];
  if (TARGET === "gold") {
    // Zlota aplikacja ma prawdziwy ROOT - dam_base_path odpowiada rzeczywistemu folderowi.
    baseLocalStorage.push('localStorage.setItem("dam_base_path","D:\\\\Marketing");');
  }
  // W trybie noroot celowo NIE ustawiamy dam_base_path - na komputerze bez folderu
  // Marketing ta wartosc nigdy by tam nie trafila.
  baseLocalStorage.push('}catch(e){}');

  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: [
      ...baseLocalStorage,
      '(function(){',
      'window.__damBlockedNav=[];',
      'try{window.location.assign=function(u){window.__damBlockedNav.push(String(u));};',
      'window.location.replace=function(u){window.__damBlockedNav.push(String(u));};}catch(e){}',
      'document.addEventListener("DOMContentLoaded",function(){',
      'try{Object.defineProperty(document.location,"href",{set:function(u){window.__damBlockedNav.push(String(u));},get:function(){return document.URL;}});}catch(e){}',
      '});})();',
    ].join(""),
  });

  /* Stub tylko dla /auth/*: headless nie ma sesji, a bez niej dam-api.js
     wyrzuca na signin.html zanim strona zdazy sie narysowac. */
  const FAKE_USER = {
    ok: true,
    user: { email: "qa@local", name: "QA", role: "admin", id: "qa" },
    device_id: "qa-device",
    machine_id: "qa-machine",
    session_id: "qa-session",
    token: "qa-shot",
  };

  const patterns = [{ urlPattern: "*/auth/*" }];
  if (TARGET === "noroot") patterns.push({ urlPattern: "*:8766/*" });

  global.__redir = { n: 0 };
  await cdp.send("Fetch.enable", { patterns });
  cdp.ws.addEventListener("message", async (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch (_) { return; }
    if (m.method !== "Fetch.requestPaused") return;
    const u = m.params.request.url;
    if (TARGET === "noroot" && !/\/auth\//.test(u) && u.includes(":8766")) {
      // Zapasowy/hardkodowany adres mostu zlotej aplikacji -> most bez ROOT.
      global.__redir.n++;
      try { await cdp.send("Fetch.continueRequest", { requestId: m.params.requestId, url: u.replace(":8766", ":9766") }, 5000); } catch (_) {}
      return;
    }
    const body = Buffer.from(JSON.stringify(FAKE_USER)).toString("base64");
    try {
      await cdp.send("Fetch.fulfillRequest", {
        requestId: m.params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: "application/json" },
          { name: "Access-Control-Allow-Origin", value: "*" },
        ],
        body,
      }, 5000);
    } catch (_) { /* karta mogla juz przejsc dalej */ }
  });

  await cdp.send("Page.navigate", { url: URL_ }, 20000);
  await sleep(WAIT);

  let evalResult = null;
  if (EVAL_FILE && fs.existsSync(EVAL_FILE)) {
    const code = fs.readFileSync(EVAL_FILE, "utf8");
    const r = await cdp.send("Runtime.evaluate",
      { expression: code, awaitPromise: true, returnByValue: true }, 40000);
    const val = r && r.result && r.result.result;
    evalResult = val && (val.value !== undefined ? val.value : val);
    console.log("EVAL:", JSON.stringify(evalResult));
    await sleep(2000);
  }

  const shot = await cdp.send("Page.captureScreenshot",
    { format: "png", captureBeyondViewport: false }, 30000);
  const b64 = shot && shot.result && shot.result.data;
  if (!b64) { console.error("brak danych zrzutu"); child.kill(); process.exit(1); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(b64, "base64"));
  if (TARGET === "noroot") console.log("PRZEKIEROWANE 8766->9766: " + global.__redir.n);
  console.log("ZRZUT: " + OUT + " (" + fs.statSync(OUT).size + " B)");

  try { child.kill(); } catch (_) {}
  process.exit(0);
})().catch((e) => { console.error("BLAD:", e && e.message); process.exit(1); });
