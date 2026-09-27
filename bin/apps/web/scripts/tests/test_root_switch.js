/**
 * Faza 3.1 - kontrakt DamPaths.setBasePath (dam-paths.js):
 *  - zwraca Promise, jeden POST /root/switch;
 *  - localStorage zmienia sie DOPIERO po ok:true z mostu;
 *  - sukces -> jedno zdarzenie window "dam:root-changed" {base_path, root_alive, previous};
 *  - blad (root_missing / timeout / 401 / most offline) -> stary ROOT zostaje, brak zdarzenia, message;
 *  - most bez /root/switch (404) -> stara sciezka (validate-base + 2x POST).
 * Run: node apps/web/scripts/tests/test_root_switch.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = path.join(__dirname, "..", "..", "assets", "js", "dam-paths.js");

var fails = 0;
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}
function eq(got, want, label) {
  var a = JSON.stringify(got);
  var b = JSON.stringify(want);
  if (a !== b) {
    console.error("FAIL " + label + ":\n  oczekiwano " + b + "\n  jest       " + a);
    fails++;
  }
}

function makeEnv(routes) {
  var store = {};
  var listeners = {};
  var events = [];
  var calls = [];
  var localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
  function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; }
  var win = {
    addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    dispatchEvent: function (ev) {
      events.push({ type: ev.type, detail: ev.detail });
      (listeners[ev.type] || []).forEach(function (fn) { fn(ev); });
      return true;
    },
    DamRuntime: { bridgeUrl: function () { return "http://bridge"; } }
  };
  function fetch(url, opts) {
    var p = url.replace("http://bridge", "");
    calls.push({ path: p, body: opts && opts.body ? JSON.parse(opts.body) : null });
    var h = routes[p];
    if (!h) return Promise.resolve({ status: 404, ok: false, json: function () { return Promise.resolve({}); } });
    var out = h(opts && opts.body ? JSON.parse(opts.body) : null);
    if (out === "offline") return Promise.reject(new TypeError("Failed to fetch"));
    return Promise.resolve({
      status: out.status || 200,
      ok: (out.status || 200) < 400,
      json: function () { return Promise.resolve(out.body); }
    });
  }
  var ctx = {
    window: win,
    localStorage: localStorage,
    sessionStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: { readyState: "loading", addEventListener: function () {} },
    fetch: fetch,
    CustomEvent: CustomEvent,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    console: console,
    JSON: JSON,
    Object: Object
  };
  win.localStorage = localStorage;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC, "utf8"), ctx, { filename: "dam-paths.js" });
  store["dam_device_id"] = "dev-1";
  return { DamPaths: win.DamPaths, store: store, events: events, calls: calls, win: win, listeners: listeners };
}

function run() {
  var chain = Promise.resolve();

  // 1) Sukces: localStorage po odpowiedzi, jedno zdarzenie, Promise z wynikiem
  chain = chain.then(function () {
    var seenBeforeReply = null;
    var env = makeEnv({
      "/root/switch": function (body) {
        seenBeforeReply = env.store["dam_base_path::dev-1"] || null;
        eq(body.base_path, "X:\\Marketing", "znormalizowany base_path (podfolder -> root)");
        eq(body.device_id, "dev-1", "device_id w body");
        return { body: { ok: true, base_path: "X:\\Marketing", root_alive: true, reason: "ok" } };
      }
    });
    env.store["dam_base_path::dev-1"] = "D:\\Marketing";
    env.store["dam_base_path"] = "D:\\Marketing";
    var p = env.DamPaths.setBasePath("X:\\Marketing\\- POLSKA");
    ok(p && typeof p.then === "function", "setBasePath zwraca Promise");
    eq(env.store["dam_base_path::dev-1"], "D:\\Marketing", "localStorage bez zmian przed odpowiedzia");
    return p.then(function (res) {
      eq(seenBeforeReply, "D:\\Marketing", "most widzi stary ROOT w chwili zapytania");
      ok(res.ok === true, "wynik ok");
      eq(env.store["dam_base_path::dev-1"], "X:\\Marketing", "scoped klucz zapisany po ok");
      eq(env.store["dam_base_path"], "X:\\Marketing", "legacy klucz zapisany po ok");
      eq(env.events.length, 1, "dokladnie jedno zdarzenie");
      eq(env.events[0].type, "dam:root-changed", "typ zdarzenia");
      eq(env.events[0].detail.base_path, "X:\\Marketing", "detail.base_path");
      eq(env.events[0].detail.root_alive, true, "detail.root_alive");
      eq(env.events[0].detail.previous, "D:\\Marketing", "detail.previous");
      eq(env.calls.map(function (c) { return c.path; }), ["/root/switch"], "jeden request, bez starych 2x POST");
      ok(/X:\\Marketing/.test(res.message || ""), "komunikat sukcesu z sciezka");
    });
  });

  // 2) Sciezka nie istnieje: stary ROOT zostaje, brak zdarzenia, komunikat
  chain = chain.then(function () {
    var env = makeEnv({
      "/root/switch": function () {
        return { body: { ok: false, error: "root_missing", reason: "missing", base_path: "Q:\\Marketing", root_alive: false } };
      }
    });
    env.store["dam_base_path::dev-1"] = "X:\\Marketing";
    return env.DamPaths.setBasePath("Q:\\Marketing").then(function (res) {
      ok(res.ok === false, "root_missing -> ok false");
      eq(env.store["dam_base_path::dev-1"], "X:\\Marketing", "root_missing: stary ROOT zostaje");
      eq(env.events.length, 0, "root_missing: brak zdarzenia");
      ok(/Q:\\Marketing/.test(res.message) && /nie istnieje/.test(res.message), "root_missing: czytelny komunikat");
    });
  });

  // 3) Dysk nie odpowiada
  chain = chain.then(function () {
    var env = makeEnv({
      "/root/switch": function () {
        return { body: { ok: false, error: "root_timeout", reason: "timeout", base_path: "M:\\", root_alive: false } };
      }
    });
    env.store["dam_base_path::dev-1"] = "X:\\Marketing";
    return env.DamPaths.setBasePath("M:\\").then(function (res) {
      eq(env.store["dam_base_path::dev-1"], "X:\\Marketing", "timeout: stary ROOT zostaje");
      eq(env.events.length, 0, "timeout: brak zdarzenia");
      ok(/nie odpowiada/.test(res.message), "timeout: komunikat");
    });
  });

  // 4) Brak sesji (401)
  chain = chain.then(function () {
    var env = makeEnv({
      "/root/switch": function () {
        return { status: 401, body: { ok: false, error: "login_required" } };
      }
    });
    env.store["dam_base_path::dev-1"] = "X:\\Marketing";
    return env.DamPaths.setBasePath("D:\\Marketing").then(function (res) {
      ok(res.ok === false, "401 -> ok false");
      eq(env.store["dam_base_path::dev-1"], "X:\\Marketing", "401: stary ROOT zostaje");
      eq(env.events.length, 0, "401: brak zdarzenia");
      ok(/Zaloguj/.test(res.message), "401: komunikat logowania");
    });
  });

  // 5) Most offline: Promise sie rozwiazuje (nie odrzuca), stary ROOT zostaje
  chain = chain.then(function () {
    var env = makeEnv({ "/root/switch": function () { return "offline"; } });
    env.store["dam_base_path::dev-1"] = "X:\\Marketing";
    return env.DamPaths.setBasePath("D:\\Marketing").then(function (res) {
      eq(res.error, "bridge_offline", "offline: error");
      eq(env.store["dam_base_path::dev-1"], "X:\\Marketing", "offline: stary ROOT zostaje");
      eq(env.events.length, 0, "offline: brak zdarzenia");
    });
  });

  // 6) Stary most bez /root/switch -> validate-base + stary zapis, potem zdarzenie
  chain = chain.then(function () {
    var env = makeEnv({
      "/validate-base": function () { return { body: { ok: true, missing: [] } }; },
      "/machine-config": function () { return { body: { ok: true } }; },
      "/user-device-paths": function () { return { body: { ok: true } }; }
    });
    return env.DamPaths.setBasePath("D:\\Marketing").then(function (res) {
      ok(res.ok === true && res.legacy === true, "404 -> sciezka zgodnosci");
      eq(env.calls.map(function (c) { return c.path; }).sort(),
        ["/machine-config", "/root/switch", "/user-device-paths", "/validate-base"], "legacy: requesty");
      eq(env.store["dam_base_path::dev-1"], "D:\\Marketing", "legacy: zapis po walidacji");
      eq(env.events.length, 1, "legacy: zdarzenie");
    });
  });

  // 6b) Czesciowa struktura: zapis + ostrzezenie (nie odrzucenie)
  chain = chain.then(function () {
    var env = makeEnv({
      "/root/switch": function () {
        return { body: { ok: true, base_path: "E:\\Kopia", root_alive: true, warning: "root_incomplete", missing: ["- EKSPORT"] } };
      }
    });
    env.store["dam_base_path::dev-1"] = "X:\\Marketing";
    return env.DamPaths.setBasePath("E:\\Kopia").then(function (res) {
      ok(res.ok === true, "incomplete -> ok");
      eq(env.store["dam_base_path::dev-1"], "E:\\Kopia", "incomplete: zapisany");
      eq(env.events.length, 1, "incomplete: zdarzenie");
      ok(/brakuje/.test(res.message) && /- EKSPORT/.test(res.message), "incomplete: ostrzezenie z lista brakow");
    });
  });

  // 6c) Folder bez zadnego folderu Marketing: brak zapisu, needs_confirm; confirm:true wysylany
  chain = chain.then(function () {
    var sent = [];
    var env = makeEnv({
      "/root/switch": function (body) {
        sent.push(body.confirm === true);
        if (body.confirm !== true) {
          return { body: { ok: false, error: "root_unrecognized", needs_confirm: true, base_path: "C:\\Windows",
            missing: ["-- ARCHIWUM --", "- EKSPORT", "- POLSKA"], root_alive: true } };
        }
        return { body: { ok: true, base_path: "C:\\Windows", root_alive: true, warning: "root_unrecognized",
          missing: ["-- ARCHIWUM --", "- EKSPORT", "- POLSKA"] } };
      }
    });
    env.store["dam_base_path::dev-1"] = "X:\\Marketing";
    return env.DamPaths.setBasePath("C:\\Windows").then(function (res) {
      ok(res.ok === false && res.needs_confirm === true, "unrecognized -> needs_confirm");
      eq(env.store["dam_base_path::dev-1"], "X:\\Marketing", "unrecognized: bez zapisu");
      eq(env.events.length, 0, "unrecognized: bez zdarzenia");
      ok(/liter/.test(res.message), "unrecognized: komunikat o literowce");
      return env.DamPaths.setBasePath("C:\\Windows", { confirm: true });
    }).then(function (res2) {
      eq(sent, [false, true], "confirm:true tylko w drugim zadaniu");
      ok(res2.ok === true, "po potwierdzeniu ok");
      eq(env.store["dam_base_path::dev-1"], "C:\\Windows", "po potwierdzeniu zapisany");
    });
  });

  // 7) Inna karta zmienila ROOT (storage) -> ta karta dostaje dam:root-changed
  chain = chain.then(function () {
    var env = makeEnv({});
    // "storage" w przegladarce przychodzi z innej karty - wolamy listener wprost
    var storageFns = env.listeners.storage || [];
    eq(storageFns.length, 1, "dam-paths rejestruje listener storage");
    storageFns[0]({ key: "dam_base_path::dev-1", newValue: "D:\\Marketing", oldValue: "X:\\Marketing" });
    eq(env.events.length, 1, "storage -> jedno zdarzenie");
    eq(env.events[0].detail.base_path, "D:\\Marketing", "storage -> base_path");
    eq(env.events[0].detail.source, "storage", "storage -> source");
    storageFns[0]({ key: "dam_token", newValue: "x", oldValue: "y" });
    eq(env.events.length, 1, "inny klucz -> bez zdarzenia");
  });

  return chain;
}

run().then(function () {
  if (fails) {
    console.error(fails + " FAIL");
    process.exit(1);
  }
  console.log("OK test_root_switch.js");
}, function (err) {
  console.error("CRASH", err && err.stack);
  process.exit(1);
});
