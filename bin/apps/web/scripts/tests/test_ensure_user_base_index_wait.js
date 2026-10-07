/**
 * 07.10.2026 - wykrywanie ROOT (DamPaths.ensureUserBase) nie czeka na pierwsze pobranie
 * katalogu z bazy. Instalator nie pakuje spisu, wiec na swiezym komputerze
 * data/file-index.json przez pierwsze sekundy nie istnieje, a DamFileIndex.get() wisi.
 * Spis jest w dam-paths.js tylko podpowiedzia (roots -> prefiks indeksu), wiec:
 *  - spis wisi: ensureUserBase() i tak sie konczy, bez zapisu do mostu;
 *  - spis jest: prefiks indeksu nadal bierze sie z roots (zachowanie jak dotad).
 * Test laduje PRAWDZIWY dam-file-index.js i dam-paths.js do jednego "okna".
 * Run: node bin/apps/web/scripts/tests/test_ensure_user_base_index_wait.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var JS = path.join(__dirname, "..", "..", "assets", "js");
var PATHS_SRC = process.env.DAM_PATHS_SRC || path.join(JS, "dam-paths.js");
var fails = 0;
var count = 0;
function ok(cond, label) {
  count++;
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}

function makeEnv(routes) {
  var store = { dam_device_id: "dev-1", dam_token: "t", dam_base_path: "M:\\", "dam_base_path::dev-1": "M:\\" };
  var writes = [];
  var localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
  var win = {
    addEventListener: function () {},
    dispatchEvent: function () { return true; },
    DamRuntime: { bridgeUrl: function () { return "http://bridge"; } },
    __DAM_BRIDGE__: "http://bridge"
  };
  function fetch(url, opts) {
    var p = String(url).replace("http://bridge", "").replace(/\?.*$/, "");
    var method = (opts && opts.method) || "GET";
    if (method !== "GET") writes.push(method + " " + p);
    var h = routes[method + " " + p] || { status: 404, body: {} };
    var text = JSON.stringify(h.body || {});
    return Promise.resolve({
      status: h.status || 200,
      ok: (h.status || 200) < 400,
      json: function () { return Promise.resolve(JSON.parse(text)); },
      text: function () { return Promise.resolve(text); }
    });
  }
  /* Strona inna niz Eksplorator/Wizualizacje: tylko tam dam-paths.js siega po spis. */
  var ctx = { window: win, localStorage: localStorage, location: { pathname: "/index.html" },
    sessionStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: { readyState: "loading", addEventListener: function () {} },
    fetch: fetch, CustomEvent: function () {}, Promise: Promise, setTimeout: setTimeout,
    clearTimeout: clearTimeout, console: console, JSON: JSON, Object: Object };
  win.localStorage = localStorage;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, "dam-file-index.js"), "utf8"), ctx, { filename: "dam-file-index.js" });
  vm.runInContext(fs.readFileSync(PATHS_SRC, "utf8"), ctx, { filename: "dam-paths.js" });
  return { win: win, store: store, writes: writes };
}

function within(p, ms) {
  return Promise.race([
    p.then(function () { return "done"; }, function () { return "rejected"; }),
    new Promise(function (r) { setTimeout(function () { r("hangs"); }, ms); })
  ]);
}

var M = { status: 200, body: { ok: true, base_path: "M:\\", root_generation: 1 } };
var CURRENT = { status: 200, body: { ok: true, device_id: "dev-1", base_path: "M:\\", source: "machine-config-fallback" } };

(async function () {
  /* 1. Swiezy komputer: pliku spisu nie ma, most mowi "pierwsze pobranie trwa". */
  var env = makeEnv({
    "GET /machine-config": M,
    "GET /user-device-paths/current": CURRENT,
    "GET /index/snapshots": { status: 200, body: { ok: true, first_sync: { done: false, ok: null }, last: {} } }
  });
  var res = await within(env.win.DamPaths.ensureUserBase(), 1500);
  ok(res === "done", "spis wisi: wykrywanie ROOT konczy sie mimo to (wynik: " + res + ")");
  ok(env.win.DamFileIndex.state().state === "waiting", "spis wisi: loader naprawde czeka na pierwsze pobranie (" + env.win.DamFileIndex.state().state + ")");
  ok(env.win.DamPaths.getBasePath() === "M:\\" && env.writes.length === 0, "spis wisi: ROOT bez zmian, zero zapisow do mostu (" + env.writes.join(", ") + ")");

  /* 2. Spis jest: prefiks indeksu z roots, jak dotad. */
  env = makeEnv({
    "GET /machine-config": M,
    "GET /user-device-paths/current": CURRENT,
    "GET data/file-index.json": { status: 200, body: { roots: [{ brand: "DK", path: "D:/Marketing/- POLSKA/01 - PRODUKTY/- DK" }], products: [] } }
  });
  res = await within(env.win.DamPaths.ensureUserBase(), 1500);
  var hasPrefix = Object.keys(env.store).some(function (k) { return env.store[k] === "D:/Marketing"; });
  ok(res === "done" && hasPrefix, "spis jest: prefiks indeksu wziety z roots (" + res + ")");
  ok(env.win.DamFileIndex.state().state === "ready", "spis jest: bez czekania");

  console.log(fails ? "FAILED " + fails : "OK test_ensure_user_base_index_wait.js: " + count + " asercji");
  /* Petla czekania loadera ma zywy setTimeout - konczymy jawnie. */
  process.exit(fails ? 1 : 0);
})().catch(function (e) {
  console.error("FAIL wyjatek testu: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
