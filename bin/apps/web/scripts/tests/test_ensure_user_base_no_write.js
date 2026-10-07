/**
 * 07.10.2026 - samo wczytanie strony (DamPaths.ensureUserBase) nie moze zapisac ROOT do mostu,
 * gdy odczyt /user-device-paths/current sie nie udal albo most ma juz sciezke.
 * Zapis przy starcie zostaje tylko dla migracji: most odpowiedzial i sam nie ma zadnego ROOT.
 * Run: node bin/apps/web/scripts/tests/test_ensure_user_base_no_write.js
 *      (DAM_PATHS_SRC=<plik> podmienia badany dam-paths.js; EXPECT_BUG=1 = oczekuj starego zachowania)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = process.env.DAM_PATHS_SRC || path.join(__dirname, "..", "..", "assets", "js", "dam-paths.js");
var EXPECT_BUG = process.env.EXPECT_BUG === "1";
var fails = 0;

function makeEnv(routes, storage) {
  var store = Object.assign({ dam_device_id: "dev-1", dam_token: "t" }, storage || {});
  var writes = [];
  var localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
  var win = {
    addEventListener: function () {},
    dispatchEvent: function () { return true; },
    DamRuntime: { bridgeUrl: function () { return "http://bridge"; } }
  };
  function fetch(url, opts) {
    var p = String(url).replace("http://bridge", "").replace(/\?.*$/, "");
    var method = (opts && opts.method) || "GET";
    if (method !== "GET") writes.push(method + " " + p + " " + (opts.body || ""));
    var h = routes[method + " " + p];
    if (h === "offline") return Promise.reject(new TypeError("Failed to fetch"));
    if (!h) return Promise.resolve({ status: 404, ok: false, json: function () { return Promise.resolve({}); } });
    return Promise.resolve({ status: h.status || 200, ok: (h.status || 200) < 400,
      json: function () { return Promise.resolve(h.body || {}); } });
  }
  var ctx = { window: win, localStorage: localStorage, location: { pathname: "/explorer.html" },
    sessionStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: { readyState: "loading", addEventListener: function () {} },
    fetch: fetch, CustomEvent: function () {}, Promise: Promise, setTimeout: setTimeout,
    clearTimeout: clearTimeout, console: console, JSON: JSON, Object: Object };
  win.localStorage = localStorage;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC, "utf8"), ctx, { filename: "dam-paths.js" });
  return { DamPaths: win.DamPaths, writes: writes };
}

var M = { status: 200, body: { ok: true, base_path: "M:\\", root_generation: 1 } };
var NONE = { status: 200, body: { ok: true, base_path: "", root_generation: 0 } };
var CASES = [
  { name: "S1 cache M:, odczyt biezacej sciezki 401, most ma M:", bugWrites: 2, wantWrites: 0,
    storage: { dam_base_path: "M:\\", "dam_base_path::dev-1": "M:\\" },
    routes: { "GET /machine-config": M, "GET /user-device-paths/current": { status: 401, body: { ok: false } } } },
  { name: "S2 cache M:, odczyt 200 (most oddaje M: z machine-config)", bugWrites: 0, wantWrites: 0,
    storage: { dam_base_path: "M:\\", "dam_base_path::dev-1": "M:\\" },
    routes: { "GET /machine-config": M, "GET /user-device-paths/current":
      { status: 200, body: { ok: true, device_id: "dev-1", base_path: "M:\\", source: "machine-config-fallback" } } } },
  { name: "S3 pusty cache, odczyt biezacej sciezki nieudany (siec), most ma M:", bugWrites: 2, wantWrites: 0,
    storage: {},
    routes: { "GET /machine-config": M, "GET /user-device-paths/current": "offline" } },
  { name: "S4 cache M:, most odpowiedzial i nie ma zadnego ROOT (migracja)", bugWrites: 2, wantWrites: 2,
    storage: { dam_base_path: "M:\\", "dam_base_path::dev-1": "M:\\" },
    routes: { "GET /machine-config": NONE, "GET /user-device-paths/current":
      { status: 200, body: { ok: true, device_id: "dev-1", base_path: "", source: "unset" } } } },
  { name: "S5 OBCY cache X:/Marketing, odczyt 500, most ma M: (ciche przelaczenie ROOT)", bugWrites: 2, wantWrites: 0,
    storage: { dam_base_path: "X:\\Marketing", "dam_base_path::dev-1": "X:\\Marketing" },
    routes: { "GET /machine-config": M, "GET /user-device-paths/current": { status: 500, body: {} } } }
];

CASES.reduce(function (chain, c) {
  return chain.then(function () {
    var env = makeEnv(c.routes, c.storage);
    return env.DamPaths.ensureUserBase().then(function () {
      return new Promise(function (r) { setTimeout(r, 20); });
    }).then(function () {
      var want = EXPECT_BUG ? c.bugWrites : c.wantWrites;
      var good = env.writes.length === want;
      if (!good) fails++;
      console.log((good ? "ok   " : "FAIL ") + c.name + " -> zapisow: " + env.writes.length + " (oczekiwano " + want + ")");
      env.writes.forEach(function (w) { console.log("       " + w); });
    });
  });
}, Promise.resolve()).then(function () {
  console.log(fails ? "FAILED " + fails : "OK test_ensure_user_base_no_write.js");
  process.exit(fails ? 1 : 0);
});
