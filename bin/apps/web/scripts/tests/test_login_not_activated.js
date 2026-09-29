/**
 * 29.09.2026 (DAM 2.4.7 na Macu): nieaktywowana instalacja mowila "Nieprawidłowy email
 * lub hasło". Most zwraca teraz error="not_activated" - dam-api.js ma pokazac czytelny
 * komunikat i otworzyc okno kodu (dam-activation.js -> window.DamActivation.show).
 * Run: node bin/apps/web/scripts/tests/test_login_not_activated.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var JS = path.join(__dirname, "..", "..", "assets", "js");
var MSG = "Aplikacja nie jest aktywowana - wpisz kod aktywacyjny od administratora.";

var fails = 0;
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  } else {
    console.log("ok   " + label);
  }
}

function jsonResponse(data) {
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } });
}

function makeStorage() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
  };
}

/* ---------------- dam-api.js: DamApi.login -> not_activated ---------------- */

function loadDamApi(loginPayload) {
  var shown = [];
  var ctx = {
    console: console,
    Promise: Promise,
    JSON: JSON,
    Date: Date,
    Object: Object,
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    localStorage: makeStorage(),
    fetch: function (url) {
      if (/\/auth\/identity$/.test(url)) {
        return jsonResponse({ ok: true, machine_id: "dam-mid-t", device_id: "dam-dev-t" });
      }
      if (/\/auth\/login$/.test(url)) return jsonResponse(loginPayload);
      return Promise.reject(new Error("nieoczekiwany fetch " + url));
    },
    DamActivation: { show: function (reason) { shown.push(reason); } },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, "dam-api.js"), "utf8"), ctx, { filename: "dam-api.js" });
  return { api: ctx.DamApi, shown: shown };
}

async function loginError(payload) {
  var env = loadDamApi(payload);
  try {
    await env.api.login("a@kubara.pl", "haslo-testowe-123");
    return { err: null, shown: env.shown };
  } catch (e) {
    return { err: e, shown: env.shown };
  }
}

/* ---------------- dam-activation.js: okno kodu ---------------- */

function makeDom() {
  var all = [];
  function el(tag) {
    var node = {
      tagName: String(tag).toUpperCase(),
      style: { cssText: "" },
      textContent: "",
      id: "",
      value: "",
      children: [],
      attrs: {},
      setAttribute: function (k, v) { this.attrs[k] = String(v); },
      appendChild: function (c) { this.children.push(c); c.parent = this; return c; },
      addEventListener: function () {},
      focus: function () {},
      select: function () {},
      setSelectionRange: function () {},
    };
    all.push(node);
    return node;
  }
  var body = el("body");
  function attached(node) {
    for (var n = node; n; n = n.parent) if (n === body) return true;
    return false;
  }
  return {
    body: body,
    readyState: "complete",
    createElement: el,
    addEventListener: function () {},
    getElementById: function (id) {
      for (var i = 0; i < all.length; i++) if (all[i].id === id && attached(all[i])) return all[i];
      return null;
    },
  };
}

function allText(node) {
  var out = node.textContent || "";
  (node.children || []).forEach(function (c) { out += " " + allText(c); });
  return out;
}

function loadActivation(platform) {
  var document = makeDom();
  var ctx = {
    console: console,
    Promise: Promise,
    JSON: JSON,
    document: document,
    navigator: { platform: platform, userAgent: platform },
    setTimeout: function () { return 0; },
    fetch: function () { return jsonResponse({ ok: true, activation_required: false, reason: "" }); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, "dam-activation.js"), "utf8"), ctx, { filename: "dam-activation.js" });
  return ctx;
}

(async function main() {
  var r1 = await loginError({ ok: false, error: "not_activated", reason: "not_activated",
                              activation_available: true, message: MSG });
  ok(r1.err && r1.err.code === "not_activated", "not_activated: kod bledu not_activated");
  ok(r1.err && r1.err.message === MSG, "not_activated: komunikat po polsku z mostu");
  ok(r1.err && !/Nieprawid/.test(r1.err.message), "not_activated: NIE 'Nieprawidłowy email lub hasło'");
  ok(r1.err && !/Most DAM niedost/.test(r1.err.message), "not_activated: NIE 'Most DAM niedostępny'");
  ok(r1.shown.length === 1 && r1.shown[0] === "not_activated", "not_activated: otwiera okno kodu");

  var r2 = await loginError({ ok: false, error: "not_activated", reason: "no_config",
                              activation_available: false, message: "Aplikacja nie jest aktywowana - brak konfiguracji." });
  ok(r2.err && r2.err.code === "not_activated", "no_config: kod bledu not_activated");
  ok(r2.shown.length === 0, "no_config: okno kodu sie NIE otwiera (kod nic nie da)");
  ok(r2.err && /Aplikacja nie jest aktywowana/.test(r2.err.message), "no_config: komunikat z mostu");

  var r3 = await loginError({ ok: false, error: "not_activated" });
  ok(r3.err && r3.err.message === MSG, "brak message z mostu: domyslny komunikat");

  var r4 = await loginError({ ok: false, error: "invalid_credentials" });
  ok(r4.err && r4.err.message === "Nieprawidłowy email lub hasło.", "invalid_credentials bez zmian");
  ok(r4.shown.length === 0, "invalid_credentials: bez okna kodu");

  var mac = loadActivation("MacIntel");
  ok(mac.DamActivation && typeof mac.DamActivation.show === "function", "dam-activation.js wystawia DamActivation.show");
  mac.DamActivation.show("not_activated");
  var overlay = mac.document.getElementById("damActivationOverlay");
  ok(!!overlay, "show(): okno kodu w DOM");
  var text = overlay ? allText(overlay) : "";
  ok(/Aplikacja nie jest aktywowana/.test(text), "okno: 'Aplikacja nie jest aktywowana'");
  ok(/koncie macOS/.test(text), "okno na Macu: 'koncie macOS' (nie Windows)");
  ok(/kod aktywacyjny/.test(text), "okno: prosi o kod aktywacyjny");
  mac.DamActivation.show("not_activated");
  ok(mac.document.body.children.length === 1, "drugie show() nie dubluje okna");

  var win = loadActivation("Win32");
  win.DamActivation.show("not_activated");
  var wtext = allText(win.document.getElementById("damActivationOverlay") || {});
  ok(/koncie Windows/.test(wtext), "okno na Windows: 'koncie Windows' jak dotad");

  if (fails) {
    console.error("\n" + fails + " FAIL");
    process.exit(1);
  }
  console.log("\nOK test_login_not_activated");
})();
