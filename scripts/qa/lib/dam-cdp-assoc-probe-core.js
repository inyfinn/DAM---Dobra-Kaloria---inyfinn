/**
 * Shared CDP helpers for assoc-picker probes.
 * HARD rules:
 *  - Browser APIs (localStorage/window/document) ONLY inside Runtime.evaluate strings.
 *  - WebSocket URL MUST come from /json/list webSocketDebuggerUrl (validated/normalized).
 *  - Mode B (real UI click + async DamSearch poll) is the only overall-PASS truth.
 */
"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const FREEZE_MS = 2000;
const ASYNC_WAIT_MS = 8000;
const PICKER_OPEN_MS = 8000;
const NAV_MS = 5000;
const EVAL_HARD_MS = 12000;
const CACHE = "4.0.68-assocNoMediaAutoPreview20260726a";
const UI = "http://127.0.0.1:8765";
const VERSION = "4.0.68"; /* branding freeze fix chain: 4.0.67 for+break/seed + 4.0.68 no auto /media */

const CTAS = [
  {
    id: "viz-suggestions",
    page: "viz",
    url: UI + "/visualizations.html?v=" + CACHE,
    selector: '[data-viz-assoc-cta="suggestions"]',
    kind: "material",
    cardSelector: ".dam-viz-card--clickable",
    modalSelector: "#damVizModal",
    optsFlags: {
      productSearchForVariants: false,
      brandingSearch: false,
      pickerSkipsWarmFileIndex: true,
    },
    pathSummary:
      "dam-viz CTA suggestions → bindVizAssocCtas → onAssocCtaClick(material) → openEditPicker(material)",
  },
  {
    id: "viz-variants",
    page: "viz",
    url: UI + "/visualizations.html?v=" + CACHE,
    selector: '[data-viz-assoc-cta="variants"]',
    kind: "variant",
    cardSelector: ".dam-viz-card--clickable",
    modalSelector: "#damVizModal",
    optsFlags: {
      productSearchForVariants: true,
      brandingSearch: false,
      pickerSkipsWarmFileIndex: true,
    },
    pathSummary:
      "dam-viz CTA variants → openVizAssocVariantsPicker → openEditPicker(variant,{productSearchForVariants})",
  },
  {
    id: "branding-product",
    page: "branding",
    url: UI + "/branding.html?v=" + CACHE,
    selector: '[data-viz-assoc-cta="product"]',
    kind: "product",
    cardSelector: ".dam-branding-card.dam-viz-card--clickable, .dam-branding-card",
    modalSelector: "#damMediaPreview",
    optsFlags: {
      productSearchForVariants: false,
      brandingSearch: false,
      pickerSkipsWarmFileIndex: false,
    },
    pathSummary:
      "branding card → media preview → [data-viz-assoc-cta=product] → openEditPicker(product)",
  },
  {
    id: "branding-variant",
    page: "branding",
    url: UI + "/branding.html?v=" + CACHE,
    selector: '[data-viz-assoc-cta="variant"]',
    kind: "variant",
    cardSelector: ".dam-branding-card.dam-viz-card--clickable, .dam-branding-card",
    modalSelector: "#damMediaPreview",
    optsFlags: {
      productSearchForVariants: false,
      brandingSearch: true,
      pickerSkipsWarmFileIndex: true,
    },
    pathSummary:
      "branding card → media preview → [data-viz-assoc-cta=variant] → openEditPicker(variant,{brandingSearch})",
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function stamp() {
  return nowIso().replace(/[:.]/g, "-");
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

function httpGet(url, timeoutMs) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r) => {
      if (settled) return;
      settled = true;
      resolve(Object.assign({ latency_ms: Date.now() - t0 }, r));
    };
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        finish({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
        })
      );
    });
    req.on("timeout", () => {
      req.destroy();
      finish({ ok: false, error: "timeout", freeze: true });
    });
    req.on("error", (e) => finish({ ok: false, error: String(e.message || e) }));
  });
}

function httpGetJson(url, timeoutMs) {
  return httpGet(url, timeoutMs).then((r) => {
    if (!r.ok) throw new Error(r.error || "http_" + r.status);
    return JSON.parse(r.body || "[]");
  });
}

/**
 * Validate + normalize Chrome /json/list webSocketDebuggerUrl.
 * NEVER invent path from id alone. Force 127.0.0.1 (Node WS + localhost/::1 issues).
 */
function normalizeWsDebuggerUrl(raw, port) {
  if (!raw || typeof raw !== "string") return null;
  let u;
  try {
    u = new URL(raw);
  } catch (_) {
    return null;
  }
  if (u.protocol !== "ws:" && u.protocol !== "wss:") return null;
  if (!/\/devtools\/page\//i.test(u.pathname || "")) return null;
  const hostRaw = String(u.hostname || "").replace(/^\[|\]$/g, "");
  const host =
    hostRaw === "localhost" || hostRaw === "::1" || hostRaw === "0.0.0.0"
      ? "127.0.0.1"
      : hostRaw || "127.0.0.1";
  const p = u.port || String(port || "");
  if (!p) return null;
  return "ws://127.0.0.1:" + p + u.pathname + (u.search || "");
}

function pickPageTarget(targets, preferUrl) {
  const list = Array.isArray(targets) ? targets : [];
  const pages = list.filter(
    (t) =>
      t &&
      t.type === "page" &&
      t.webSocketDebuggerUrl &&
      !/^chrome-extension:/i.test(String(t.url || ""))
  );
  if (preferUrl) {
    const base = String(preferUrl).split("?")[0];
    const hit = pages.find((t) => String(t.url || "").indexOf(base) !== -1);
    if (hit) return hit;
  }
  const blank = pages.find((t) => /^about:blank/i.test(String(t.url || "")));
  if (blank) return blank;
  return pages[0] || null;
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      let ws;
      try {
        ws = new WebSocket(this.wsUrl);
      } catch (e) {
        reject(new Error("cdp_ws_construct_" + String(e.message || e)));
        return;
      }
      this.ws = ws;
      const t = setTimeout(() => {
        reject(new Error("cdp_connect_timeout"));
        try {
          ws.close();
        } catch (_) {}
      }, 5000);
      ws.addEventListener("open", () => {
        clearTimeout(t);
        resolve();
      });
      ws.addEventListener("error", () => {
        clearTimeout(t);
        reject(new Error("cdp_ws_error url=" + this.wsUrl));
      });
      ws.addEventListener("message", (ev) => {
        let msg;
        try {
          msg = JSON.parse(String(ev.data));
        } catch (_) {
          return;
        }
        if (msg.id != null && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
          else res(msg.result);
        }
      });
      ws.addEventListener("close", () => {
        this.closed = true;
        for (const [, p] of this.pending) p.reject(new Error("cdp_closed"));
        this.pending.clear();
      });
    });
  }

  send(method, params, timeoutMs) {
    const id = this.nextId++;
    const ms = timeoutMs == null ? EVAL_HARD_MS : timeoutMs;
    return new Promise((resolve, reject) => {
      if (this.closed || !this.ws || this.ws.readyState !== 1) {
        reject(new Error("cdp_not_connected"));
        return;
      }
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("cdp_timeout_" + method + "_" + ms + "ms"));
      }, ms);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  async evaluate(expression, timeoutMs, opts) {
    const awaitPromise = !opts || opts.awaitPromise !== false;
    const res = await this.send(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: awaitPromise,
        returnByValue: true,
        userGesture: true,
      },
      timeoutMs
    );
    if (res.exceptionDetails) {
      const desc =
        (res.exceptionDetails.exception && res.exceptionDetails.exception.description) ||
        res.exceptionDetails.text ||
        "evaluate_exception";
      throw new Error(desc);
    }
    return res.result && res.result.value;
  }

  close() {
    try {
      if (this.ws) this.ws.close();
    } catch (_) {}
    this.closed = true;
  }
}

async function waitForDebugger(port, attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const list = await httpGetJson("http://127.0.0.1:" + port + "/json/list", 2000);
      if (Array.isArray(list) && list.length) return list;
    } catch (_) {}
    await sleep(250);
  }
  throw new Error("debugger_not_ready_port_" + port);
}

async function connectPageCdp(port, preferUrl) {
  const targets = await httpGetJson("http://127.0.0.1:" + port + "/json/list", 3000);
  const page = pickPageTarget(targets, preferUrl);
  if (!page) throw new Error("no_page_target");
  const wsUrl = normalizeWsDebuggerUrl(page.webSocketDebuggerUrl, port);
  if (!wsUrl) {
    throw new Error(
      "bad_ws_url raw=" + String(page.webSocketDebuggerUrl || "") + " port=" + port
    );
  }
  const cdp = new CdpSession(wsUrl);
  await cdp.connect();
  await cdp.send("Page.enable", {}, 3000);
  await cdp.send("Runtime.enable", {}, 3000);
  return { cdp, page, wsUrl, targets };
}

function killProc(child) {
  if (!child || child.killed) return;
  try {
    child.kill("SIGTERM");
  } catch (_) {}
  try {
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    }
  } catch (_) {}
}

function killAllHeadlessChrome() {
  if (process.platform !== "win32") return;
  try {
    spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'remote-debugging-port|headless' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      ],
      { windowsHide: true, timeout: 15000 }
    );
  } catch (_) {}
}

function launchChrome(browserPath, port, opts) {
  const killAllFirst = opts && opts.killAllFirst;
  if (killAllFirst) killAllHeadlessChrome();
  const userData =
    (opts && opts.userData) ||
    path.join(os.tmpdir(), "dam-cdp-" + port + "-" + Date.now());
  fs.mkdirSync(userData, { recursive: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--user-data-dir=" + userData,
    "--remote-debugging-port=" + port,
    "--window-size=1400,900",
    "about:blank",
  ];
  const child = spawn(browserPath, args, { windowsHide: true, stdio: "ignore" });
  return { child, userData, port };
}

/** Admin flags — ONLY as CDP evaluate string body (never run in Node). */
function setAdminExpr() {
  return `(function(){
  localStorage.setItem('dam_admin_mode','1');
  localStorage.setItem('dam_viz_admin_mode','1');
  localStorage.setItem('dam_role','admin');
  if(!localStorage.getItem('dam_token')) localStorage.setItem('dam_token','probe-admin-token');
  if(window.DamApi){
    try { DamApi.role = function(){ return 'admin'; }; } catch (e) {}
  }
  return {
    ok:true,
    admin: localStorage.getItem('dam_admin_mode'),
    canEdit: !!(window.DamAssocEdit && DamAssocEdit.canEdit && DamAssocEdit.canEdit())
  };
})()`;
}

function openPickerProgrammaticExpr(cta) {
  const meta = JSON.stringify({
    id: cta.id,
    kind: cta.kind,
    optsFlags: cta.optsFlags,
  });
  return `(function(){
  var meta = ${meta};
  var t0 = performance.now();
  localStorage.setItem('dam_admin_mode','1');
  localStorage.setItem('dam_viz_admin_mode','1');
  localStorage.setItem('dam_role','admin');
  if(!localStorage.getItem('dam_token')) localStorage.setItem('dam_token','demo-admin-dev-token');
  var AE = window.DamAssocEdit;
  if(!AE || !(AE.openPicker || AE.openMediaPicker)){
    return { ok:false, openMode:'programmatic', open_ms: Math.round(performance.now()-t0), error:'DamAssocEdit_missing' };
  }
  var openPickerFn = AE.openPicker || AE.openMediaPicker;
  if(AE.closePicker) try{ AE.closePicker(); }catch(e){}
  var col = document.createElement('div');
  col.className = 'dam-media-preview__assoc-col dam-media-preview__assoc-col--probe';
  if(meta.kind === 'material') col.classList.add('dam-media-preview__assoc-col--materials');
  if(meta.kind === 'variant') col.classList.add('dam-media-preview__assoc-col--variants');
  if(meta.kind === 'product') col.classList.add('dam-media-preview__assoc-col--products');
  document.body.appendChild(col);
  if(meta.id === 'branding-product'){
    openPickerFn(col, {
      kind:'product', selectedIds:[], pinnedIds:[],
      filterType:'product', groupContext:{ linked_products:[], linked_product_ids:[] }
    });
  } else if(meta.id === 'branding-variant'){
    openPickerFn(col, {
      kind:'variant', brandingSearch:true, head:'Warianty materiału',
      selectedIds:[], pinnedIds:[], bootstrapQuery:'',
      variantCandidates:[], groupContext:{}, asset:{ marketing_id:'BU', index:'BU', name:'Probe' }
    });
  } else if(meta.id === 'viz-suggestions'){
    openPickerFn(col, {
      kind:'material', head:'Skojarzone materiały brandingowe',
      selectedIds:[], pinnedIds:[], bootstrapQuery:'',
      materialCandidates:[],
      productContext:{ id:'probe-product', index:'BU', display_name:'Probe' },
      groupContext:{ product_id:'probe-product' },
      assocCtx:{ productContext:{ id:'probe-product', index:'BU' } }
    });
  } else if(meta.id === 'viz-variants'){
    openPickerFn(col, {
      kind:'variant', productSearchForVariants:true,
      head:'Warianty produktu — wybierz rewizję (folder)',
      selectedIds:[], pinnedIds:[], filterType:'product',
      variantCandidates:[], groupContext:{},
      onConfirmVariants: function(){}
    });
  }
  return {
    ok:true,
    openMode:'programmatic',
    open_ms: Math.round(performance.now()-t0),
    canEdit: !!(AE.canEdit && AE.canEdit())
  };
})()`;
}

function clickCardExpr(cta) {
  const sel = JSON.stringify(cta.cardSelector);
  const page = JSON.stringify(cta.page || "");
  return `(function(){
  var sel = ${sel};
  var page = ${page};
  var cards = document.querySelectorAll(sel);
  var card = null;
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    if (!c || c.offsetParent === null) continue;
    /* Prefer cards with product id (real viz groups / branding assets). */
    if (c.getAttribute('data-group-pid') || c.getAttribute('data-pid') || c.getAttribute('data-id')) {
      card = c;
      break;
    }
    if (!card) card = c;
  }
  if(!card) return { ok:false, error:'no_card', sel:sel, count: cards.length };
  card.scrollIntoView({ block:'center', inline:'nearest' });
  /* Viz: openProductModal bound on .dam-viz-thumb only (not article) — dam-viz.js. */
  var target = card;
  if (page === 'viz') {
    target = card.querySelector('.dam-viz-thumb') || card.querySelector('img') || card;
  }
  try {
    target.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window }));
  } catch (e1) {
    target.click();
  }
  return {
    ok:true,
    pid: card.getAttribute('data-group-pid') || card.getAttribute('data-pid') || card.getAttribute('data-id') || '',
    cls: card.className || '',
    clicked: (target.className || target.tagName || '').toString().slice(0, 80),
    count: cards.length
  };
})()`;
}

function clickCtaExpr(cta) {
  const sel = JSON.stringify(cta.selector);
  return `(function(){
  var sel = ${sel};
  var t0 = performance.now();
  var btn = document.querySelector(sel);
  if(!btn){
    var all = Array.prototype.map.call(
      document.querySelectorAll('[data-viz-assoc-cta]'),
      function(el){ return el.getAttribute('data-viz-assoc-cta'); }
    );
    return { ok:false, error:'cta_not_found', found: all, open_ms: Math.round(performance.now()-t0) };
  }
  btn.scrollIntoView({ block:'center', inline:'nearest' });
  btn.click();
  return { ok:true, open_ms: Math.round(performance.now()-t0), label: (btn.textContent||'').trim().slice(0,80) };
})()`;
}

function typeSearchSyncExpr() {
  return `(() => {
  var t0 = performance.now();
  var search = document.querySelector('#damAssocEditSearch');
  if(!search) return { ok:false, error:'no_search' };
  if(!search.closest('#damAssocEditPopover, #damAssocEditOverlay')){
    return { ok:false, error:'search_not_in_picker' };
  }
  var beforeEmpty = document.querySelector('#damAssocEditPopover .dam-tag-edit-popover__empty, #damAssocEditPopover .dam-assoc-edit-popover__list p');
  var beforeMsg = beforeEmpty ? (beforeEmpty.textContent||'').trim() : '';
  search.focus();
  search.value = 'bu';
  search.dispatchEvent(new Event('input', { bubbles:false }));
  var list = document.querySelector('#damAssocEditPopover .dam-assoc-edit-popover__list');
  var state = list ? list.getAttribute('data-assoc-search-state') : '';
  var text = (list && list.textContent || '').trim().slice(0, 120);
  return {
    ok:true,
    beforeMsg: beforeMsg,
    typeMs: Math.round(performance.now() - t0),
    state: state,
    listText: text
  };
})()`;
}

/**
 * Async list poll snapshot.
 * Settled = options OR non-searching message change (not stuck on Szukam alone).
 */
function listStateExpression(beforeMsg) {
  const before = JSON.stringify(beforeMsg || "");
  return `(() => {
  var beforeMsg = ${before};
  var list = document.querySelector('#damAssocEditPopover .dam-assoc-edit-popover__list, .dam-assoc-edit-popover__list');
  var state = list ? (list.getAttribute('data-assoc-search-state') || '') : '';
  var opts = document.querySelectorAll(
    '#damAssocEditPopover .dam-assoc-edit-popover__opt[data-id], #damAssocEditPopover .dam-tag-edit-popover__option, .dam-assoc-edit-popover__opt[data-id], .dam-tag-edit-popover__option'
  );
  var empty = document.querySelector('#damAssocEditPopover .dam-tag-edit-popover__empty, #damAssocEditPopover .dam-assoc-edit-popover__list p, .dam-tag-edit-popover__empty');
  var text = empty ? (empty.textContent||'').trim() : '';
  if(!text && list) text = (list.textContent||'').trim().slice(0,120);
  var searching = state === 'searching' || /^Szukam/i.test(text);
  if(opts.length){
    return { settled:true, kind:'options', count: opts.length, text:'', searching:false, state:state };
  }
  if(searching){
    return { settled:false, kind:'searching', count:0, text: text.slice(0,120), searching:true, state:state };
  }
  if(text && text !== beforeMsg){
    return { settled:true, kind:'message', count:0, text: text.slice(0,120), searching:false, state:state };
  }
  if(text && /Brak wyników|Wpisz|znaki|wynik/i.test(text) && !/^Szukam/i.test(text)){
    return { settled:true, kind:'message', count:0, text: text.slice(0,120), searching:false, state:state };
  }
  return { settled:false, kind:'pending', count:0, text: (text||'').slice(0,120), searching:false, state:state };
})()`;
}

async function waitDamAssocEdit(cdp, timeoutMs) {
  const bootStart = Date.now();
  let pre = null;
  while (Date.now() - bootStart < timeoutMs) {
    try {
      pre = await cdp.evaluate(
        "({ href: location.href, ready: document.readyState, hasAE: !!window.DamAssocEdit, title: document.title, cards: document.querySelectorAll('.dam-viz-card--clickable, .dam-branding-card').length })",
        3000
      );
      if (pre && pre.hasAE) return pre;
    } catch (e) {
      pre = { hasAE: false, error: String(e.message || e) };
    }
    await sleep(250);
  }
  return pre;
}

async function waitSelector(cdp, expression, timeoutMs, evalTimeout) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    const pollT0 = Date.now();
    try {
      const hit = await cdp.evaluate(expression, evalTimeout || 3000, { awaitPromise: false });
      const dt = Date.now() - pollT0;
      if (dt > FREEZE_MS) {
        return { ok: false, freeze: true, error: "poll_evaluate_gt_" + FREEZE_MS + "ms", blocked_ms: dt };
      }
      if (hit) return { ok: true, value: hit, blocked_ms: dt };
    } catch (e) {
      lastErr = String(e.message || e);
      if (/cdp_timeout/i.test(lastErr)) {
        return { ok: false, freeze: true, error: lastErr };
      }
    }
    await sleep(100);
  }
  return { ok: false, freeze: false, error: "wait_timeout", lastErr: lastErr };
}

/**
 * Poll for async DamSearch settle (Mode B truth).
 * FAIL: blocked >2s, no settle in 8s, stuck searching, CDP timeout.
 */
async function pollAsyncSearch(cdp, beforeMsg, waitMs) {
  const t0 = Date.now();
  let maxBlocked = 0;
  let last = null;
  let sawSearching = false;
  while (Date.now() - t0 < waitMs) {
    const pollT0 = Date.now();
    try {
      last = await cdp.evaluate(listStateExpression(beforeMsg), 5000, { awaitPromise: false });
      const dt = Date.now() - pollT0;
      maxBlocked = Math.max(maxBlocked, dt);
      if (dt > FREEZE_MS) {
        return {
          ok: false,
          freeze: true,
          search_ms: dt,
          async_wait_ms: Date.now() - t0,
          options_count: 0,
          error: "main_thread_blocked_gt_" + FREEZE_MS + "ms",
          last: last,
        };
      }
    } catch (e) {
      const msg = String(e.message || e);
      return {
        ok: false,
        freeze: true,
        search_ms: Date.now() - t0,
        async_wait_ms: Date.now() - t0,
        options_count: 0,
        error: "search_poll_" + msg,
      };
    }
    if (last && last.searching) sawSearching = true;
    if (last && last.settled) {
      const wait = Date.now() - t0;
      const freeze = maxBlocked > FREEZE_MS;
      return {
        ok: !freeze,
        freeze: freeze,
        search_ms: wait,
        async_wait_ms: wait,
        options_count: last.count || 0,
        result_kind: last.kind,
        message: last.text || "",
        saw_searching: sawSearching,
        error: freeze ? "poll_evaluate_gt_" + FREEZE_MS + "ms" : null,
      };
    }
    await sleep(80);
  }
  return {
    ok: false,
    freeze: true,
    search_ms: Date.now() - t0,
    async_wait_ms: Date.now() - t0,
    options_count: (last && last.count) || 0,
    result_kind: (last && last.kind) || "timeout",
    message: (last && last.text) || "",
    saw_searching: sawSearching,
    error: sawSearching ? "async_search_stuck_searching" : "async_search_timeout_" + waitMs + "ms",
    last: last,
  };
}

async function screenshot(cdp, logDir, ctaId, mode) {
  const file = path.join(logDir, "e2e-" + ctaId + "-" + mode + "-" + stamp() + ".png");
  const res = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }, 5000);
  fs.writeFileSync(file, Buffer.from(res.data, "base64"));
  return file;
}

async function injectAdminOnNewDocument(cdp) {
  /* Browser-only APIs inside source string — never Node localStorage. */
  await cdp.send(
    "Page.addScriptToEvaluateOnNewDocument",
    {
      source:
        "(function(){ try {" +
        "localStorage.setItem('dam_admin_mode','1');" +
        "localStorage.setItem('dam_viz_admin_mode','1');" +
        "localStorage.setItem('dam_role','admin');" +
        "if(!localStorage.getItem('dam_token')) localStorage.setItem('dam_token','probe-admin-token');" +
        "} catch(e) {} })();",
    },
    3000
  );
}

async function navigateAndBoot(cdp, cta) {
  try {
    await injectAdminOnNewDocument(cdp);
  } catch (_) {}

  try {
    await Promise.race([
      (async () => {
        await cdp.send("Page.navigate", { url: cta.url }, NAV_MS);
        await Promise.race([
          cdp
            .evaluate(
              "new Promise(function(r){ if(document.readyState==='complete') r('ok'); else window.addEventListener('load', function(){ r('ok'); }, {once:true}); })",
              NAV_MS
            )
            .catch(() => null),
          sleep(NAV_MS),
        ]);
      })(),
      sleep(NAV_MS + 500).then(() => {
        throw new Error("nav_timeout_" + NAV_MS);
      }),
    ]);
  } catch (e) {
    return { ok: false, freeze: true, error: String(e.message || e), stage: "navigate" };
  }

  /* Headless + branding/viz hydrate can jam evaluate for many seconds. */
  const bootMs = cta.page === "viz" ? 30000 : 25000;
  const pre = await waitDamAssocEdit(cdp, bootMs);
  if (!pre || !pre.hasAE) {
    return { ok: false, freeze: true, error: "DamAssocEdit_boot_timeout", stage: "boot", pre: pre };
  }

  try {
    await cdp.evaluate(setAdminExpr(), 3000, { awaitPromise: false });
  } catch (e) {
    return { ok: false, freeze: true, error: "set_admin_" + String(e.message || e), stage: "admin" };
  }

  if (cta.page === "viz") {
    try {
      await cdp.evaluate(
        "(() => { try { if (window.gsap && gsap.globalTimeline) gsap.globalTimeline.pause(); } catch(e) {} document.documentElement.setAttribute('data-dam-e2e','1'); return true; })()",
        3000,
        { awaitPromise: false }
      );
    } catch (_) {}
  }

  /* Best-effort quiet; Mode B has its own quiet gates. Do not fail boot here. */
  const quietBoot = await waitMainThreadQuiet(cdp, 12000);
  return {
    ok: true,
    pre: pre,
    quiet_ms: quietBoot && quietBoot.ok ? quietBoot.quiet_ms : null,
    quiet_warn: quietBoot && !quietBoot.ok ? quietBoot.error : null,
  };
}

/** Mode A: programmatic openPicker + sync paint timing (labeled; NOT overall truth). */
async function runModeA(cdp, cta) {
  const out = {
    open_ms: null,
    search_ms: null,
    freeze: false,
    pass: false,
    openMode: "programmatic",
    error: null,
    option_count: null,
    result_kind: null,
    message: null,
  };
  try {
    const invoke = await cdp.evaluate(openPickerProgrammaticExpr(cta), 8000, {
      awaitPromise: false,
    });
    out.open_ms = invoke && invoke.open_ms;
    if (!invoke || !invoke.ok) {
      out.error = (invoke && invoke.error) || "open_failed";
      out.freeze = /timeout|FREEZE/i.test(String(out.error || ""));
      return out;
    }
    const searchReady = await waitSelector(
      cdp,
      "(() => { var s=document.querySelector('#damAssocEditSearch'); return !!(s && s.closest('#damAssocEditPopover, #damAssocEditOverlay')); })()",
      PICKER_OPEN_MS,
      2000
    );
    if (!searchReady.ok) {
      out.error = searchReady.error || "picker_search_not_found";
      out.freeze = !!searchReady.freeze;
      return out;
    }
    const typed = await cdp.evaluate(typeSearchSyncExpr(), 5000, { awaitPromise: false });
    if (!typed || !typed.ok) {
      out.error = (typed && typed.error) || "type_failed";
      return out;
    }
    out.search_ms = typed.typeMs != null ? typed.typeMs : 0;
    out.freeze = out.search_ms > FREEZE_MS;
    out.message = typed.listText || "";
    out.result_kind =
      typed.state === "searching" || /Szukam/i.test(typed.listText || "")
        ? "sync_searching"
        : "sync_paint";
    out.pass = !out.freeze && typed.ok;
    if (out.freeze) out.error = "sync_paint_gt_" + FREEZE_MS + "ms";
    return out;
  } catch (e) {
    out.freeze = true;
    out.error = "mode_a_" + String(e.message || e);
    return out;
  }
}

/** Wait until CDP evaluate is snappy (branding hydrate / search-index must settle). */
async function waitMainThreadQuiet(cdp, timeoutMs) {
  const start = Date.now();
  let streak = 0;
  while (Date.now() - start < timeoutMs) {
    const t0 = Date.now();
    try {
      await cdp.evaluate("1+1", 1500, { awaitPromise: false });
      const dt = Date.now() - t0;
      if (dt < 250) {
        streak++;
        if (streak >= 3) return { ok: true, quiet_ms: Date.now() - start };
      } else {
        streak = 0;
      }
    } catch (e) {
      streak = 0;
      if (/cdp_timeout/i.test(String(e.message || e))) {
        /* still jammed */
      } else {
        return { ok: false, freeze: true, error: String(e.message || e) };
      }
    }
    await sleep(200);
  }
  return { ok: false, freeze: true, error: "main_thread_not_quiet_" + timeoutMs + "ms" };
}

/** Mode B: real card + real CTA click + async DamSearch poll (overall truth). */
async function runModeB(cdp, cta, logDir) {
  const out = {
    open_ms: null,
    search_ms: null,
    async_wait_ms: null,
    options_count: 0,
    freeze: false,
    pass: false,
    openMode: "ui_click",
    error: null,
    result_kind: null,
    message: null,
    screenshot: null,
    card: null,
    cta_label: null,
  };
  try {
    /* Wait for grid cards (branding index hydrate often >2s). */
    const cardReady = await waitSelector(
      cdp,
      "(!!document.querySelector(" + JSON.stringify(cta.cardSelector) + "))",
      25000,
      3000
    );
    if (!cardReady.ok) {
      out.error = "no_card_" + (cardReady.error || "timeout");
      out.freeze = !!cardReady.freeze;
      return out;
    }

    /* HARD: do not click CTA during branding search-index / layout storm (false FREEZE). */
    const quiet = await waitMainThreadQuiet(cdp, 15000);
    if (!quiet.ok) {
      out.error = quiet.error || "main_thread_busy";
      out.freeze = !!quiet.freeze;
      return out;
    }
    out.quiet_ms = quiet.quiet_ms;

    try {
      await cdp.evaluate(
        "(() => { try { if (window.gsap && gsap.globalTimeline) gsap.globalTimeline.pause(); } catch(e) {} return 1; })()",
        2000,
        { awaitPromise: false }
      );
    } catch (_) {}

    const cardClick = await cdp.evaluate(clickCardExpr(cta), 5000, { awaitPromise: false });
    out.card = cardClick;
    if (!cardClick || !cardClick.ok) {
      out.error = (cardClick && cardClick.error) || "card_click_failed";
      return out;
    }

    const modalWaitMs = cta.page === "viz" ? 15000 : 10000;
    const modalReady = await waitSelector(
      cdp,
      "(function(){ var m=document.querySelector(" +
        JSON.stringify(cta.modalSelector) +
        "); if(!m) return false; var st=getComputedStyle(m); return st.display!=='none' && st.visibility!=='hidden'; })()",
      modalWaitMs,
      3000
    );
    if (!modalReady.ok) {
      /* Retry card click once — viz cards sometimes need second activation after hydrate. */
      await cdp.evaluate(clickCardExpr(cta), 5000, { awaitPromise: false });
      const modalRetry = await waitSelector(
        cdp,
        "(function(){ var m=document.querySelector(" +
          JSON.stringify(cta.modalSelector) +
          "); if(!m) return false; var st=getComputedStyle(m); return st.display!=='none' && st.visibility!=='hidden'; })()",
        8000,
        2000
      );
      if (!modalRetry.ok) {
        out.error = "modal_not_open_" + (modalReady.error || "timeout");
        out.freeze = !!modalReady.freeze;
        return out;
      }
    }

    /* CTA may paint after assoc bind — poll. */
    const ctaReady = await waitSelector(
      cdp,
      "(!!document.querySelector(" + JSON.stringify(cta.selector) + "))",
      8000,
      3000
    );
    if (!ctaReady.ok) {
      out.error = "cta_not_in_modal_" + (ctaReady.error || "timeout");
      out.freeze = !!ctaReady.freeze;
      return out;
    }

    /* Modal open can kick enrich/layout — wait quiet again before CTA. */
    const quiet2 = await waitMainThreadQuiet(cdp, 12000);
    if (!quiet2.ok) {
      out.error = "busy_before_cta_" + (quiet2.error || "timeout");
      out.freeze = !!quiet2.freeze;
      return out;
    }

    const ctaClick = await cdp.evaluate(clickCtaExpr(cta), 8000, { awaitPromise: false });
    out.open_ms = ctaClick && ctaClick.open_ms;
    out.cta_label = ctaClick && ctaClick.label;
    if (!ctaClick || !ctaClick.ok) {
      out.error = (ctaClick && ctaClick.error) || "cta_click_failed";
      out.found_ctas = ctaClick && ctaClick.found;
      return out;
    }

    const searchReady = await waitSelector(
      cdp,
      "(() => { var s=document.querySelector('#damAssocEditSearch'); return !!(s && s.closest('#damAssocEditPopover, #damAssocEditOverlay')); })()",
      PICKER_OPEN_MS,
      2000
    );
    if (!searchReady.ok) {
      out.error = searchReady.error || "picker_search_not_found";
      out.freeze = !!searchReady.freeze;
      return out;
    }

    /* Picker already open (#damAssocEditSearch ready). Branding hydrate may keep
       main thread "busy" forever — do NOT fail on quiet gate; measure typeMs instead. */
    const quiet3 = await waitMainThreadQuiet(cdp, 2500);
    out.quiet_before_type = quiet3.ok;
    out.quiet_before_type_err = quiet3.ok ? null : quiet3.error || null;

    let typed;
    try {
      typed = await cdp.evaluate(typeSearchSyncExpr(), 8000, { awaitPromise: false });
    } catch (e) {
      out.freeze = true;
      out.error = "type_" + String(e.message || e);
      return out;
    }
    if (!typed || !typed.ok) {
      out.error = (typed && typed.error) || "type_failed";
      return out;
    }
    if (typed.typeMs > FREEZE_MS) {
      out.freeze = true;
      out.search_ms = typed.typeMs;
      out.async_wait_ms = typed.typeMs;
      out.error = "input_handler_blocked_gt_" + FREEZE_MS + "ms";
      return out;
    }

    const asyncRes = await pollAsyncSearch(cdp, typed.beforeMsg, ASYNC_WAIT_MS);
    out.search_ms = asyncRes.search_ms;
    out.async_wait_ms = asyncRes.async_wait_ms;
    out.options_count = asyncRes.options_count || 0;
    out.result_kind = asyncRes.result_kind;
    out.message = asyncRes.message;
    out.freeze = !!asyncRes.freeze;
    out.error = asyncRes.error || null;
    out.saw_searching = asyncRes.saw_searching;
    /* Mode B PASS: settled async result, no freeze, no error. */
    out.pass =
      !!asyncRes.ok &&
      !out.freeze &&
      !out.error &&
      (out.options_count > 0 || out.result_kind === "message");

    if (logDir) {
      try {
        out.screenshot = await screenshot(cdp, logDir, cta.id, "modeB");
      } catch (e) {
        out.shot_error = String(e.message || e);
      }
    }
    return out;
  } catch (e) {
    out.freeze = /timeout|FREEZE/i.test(String(e.message || e));
    out.error = "mode_b_" + String(e.message || e);
    return out;
  }
}

/**
 * Full CTA run: Mode A then Mode B on fresh navigations (or same session).
 * overall_pass = Mode B only.
 */
async function runCtaBothModes(browserPath, cta, attemptNo, logDir) {
  const port = 9339 + (CTAS.indexOf(cta) % 7) + (attemptNo || 1) * 17;
  const launch = launchChrome(browserPath, port, {
    userData: path.join(os.tmpdir(), "dam-e2e-" + cta.id + "-" + stamp()),
  });
  let cdp = null;
  const row = {
    cta: cta.id,
    selector: cta.selector,
    kind: cta.kind,
    optsFlags: cta.optsFlags,
    pathSummary: cta.pathSummary,
    mode_a: null,
    mode_b: null,
    overall_pass: false,
    attempt: attemptNo || 1,
    error: null,
    wsUrl: null,
  };

  try {
    await waitForDebugger(port, 40);
    const conn = await connectPageCdp(port);
    cdp = conn.cdp;
    row.wsUrl = conn.wsUrl;

    const boot = await navigateAndBoot(cdp, cta);
    if (!boot.ok) {
      row.error = boot.error;
      row.mode_a = { open_ms: null, search_ms: null, freeze: !!boot.freeze, pass: false, error: boot.error };
      row.mode_b = {
        open_ms: null,
        search_ms: null,
        async_wait_ms: null,
        options_count: 0,
        freeze: !!boot.freeze,
        pass: false,
        error: boot.error,
      };
      row.overall_pass = false;
      return row;
    }
    row.preflight = boot.pre;

    row.mode_a = await runModeA(cdp, cta);

    /* Close picker before Mode B UI path. */
    try {
      await cdp.evaluate(
        "(function(){ try{ if(window.DamAssocEdit&&DamAssocEdit.closePicker) DamAssocEdit.closePicker(); }catch(e){} return true; })()",
        3000,
        { awaitPromise: false }
      );
    } catch (_) {}

    /* Re-navigate for clean Mode B (avoids leftover probe col / state). */
    const boot2 = await navigateAndBoot(cdp, cta);
    if (!boot2.ok) {
      row.mode_b = {
        open_ms: null,
        search_ms: null,
        async_wait_ms: null,
        options_count: 0,
        freeze: !!boot2.freeze,
        pass: false,
        error: boot2.error,
      };
      row.overall_pass = false;
      return row;
    }

    row.mode_b = await runModeB(cdp, cta, logDir);
    row.overall_pass = !!(row.mode_b && row.mode_b.pass);
    if (!row.overall_pass && row.mode_b && row.mode_b.error) row.error = row.mode_b.error;
    return row;
  } catch (e) {
    row.error = String(e.message || e);
    row.mode_a = row.mode_a || {
      open_ms: null,
      search_ms: null,
      freeze: /timeout|FREEZE|ws/i.test(row.error),
      pass: false,
      error: row.error,
    };
    row.mode_b = row.mode_b || {
      open_ms: null,
      search_ms: null,
      async_wait_ms: null,
      options_count: 0,
      freeze: /timeout|FREEZE|ws/i.test(row.error),
      pass: false,
      error: row.error,
    };
    row.overall_pass = false;
    return row;
  } finally {
    if (cdp) cdp.close();
    killProc(launch.child);
    await sleep(200);
  }
}

/** Mode B only (resilience loop). Same PASS criteria as e2e Mode B. */
async function runModeBOnly(browserPath, cta, port, logDir, opts) {
  const launch = launchChrome(browserPath, port, {
    killAllFirst: opts && opts.killAllFirst,
    userData: path.join(os.tmpdir(), "dam-resilience-" + port + "-" + Date.now()),
  });
  let cdp = null;
  const t0 = Date.now();
  try {
    await waitForDebugger(port, 40);
    const conn = await connectPageCdp(port);
    cdp = conn.cdp;
    const boot = await navigateAndBoot(cdp, cta);
    if (!boot.ok) {
      return {
        ok: false,
        hang_point: boot.stage || "navigate",
        diagnosis: boot.freeze ? "connection_or_boot" : "code",
        error: boot.error,
        latency_ms: Date.now() - t0,
        mode_b: boot,
        wsUrl: conn.wsUrl,
      };
    }
    const mode_b = await runModeB(cdp, cta, logDir);
    return {
      ok: !!mode_b.pass,
      hang_point: mode_b.pass ? null : mode_b.freeze ? "evaluate" : "selector",
      diagnosis: mode_b.pass ? "pass" : mode_b.freeze ? "code" : "code",
      error: mode_b.error,
      latency_ms: Date.now() - t0,
      search_ms: mode_b.search_ms,
      async_wait_ms: mode_b.async_wait_ms,
      open_ms: mode_b.open_ms,
      options_count: mode_b.options_count,
      mode_b: mode_b,
      wsUrl: conn.wsUrl,
    };
  } catch (e) {
    const msg = String(e.message || e);
    return {
      ok: false,
      hang_point: /ws|connect|debugger|no_page|bad_ws/i.test(msg) ? "navigate" : "evaluate",
      diagnosis: /ws|connect|debugger|no_page|bad_ws/i.test(msg) ? "connection" : "code",
      error: msg,
      latency_ms: Date.now() - t0,
    };
  } finally {
    if (cdp) cdp.close();
    killProc(launch.child);
    await sleep(150);
  }
}

module.exports = {
  CACHE,
  VERSION,
  UI,
  CTAS,
  FREEZE_MS,
  ASYNC_WAIT_MS,
  PICKER_OPEN_MS,
  NAV_MS,
  sleep,
  nowIso,
  stamp,
  findBrowser,
  httpGet,
  httpGetJson,
  normalizeWsDebuggerUrl,
  pickPageTarget,
  CdpSession,
  waitForDebugger,
  connectPageCdp,
  killProc,
  killAllHeadlessChrome,
  launchChrome,
  setAdminExpr,
  clickCardExpr,
  clickCtaExpr,
  runModeA,
  runModeB,
  runCtaBothModes,
  runModeBOnly,
  navigateAndBoot,
  pollAsyncSearch,
  screenshot,
};
