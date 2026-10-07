/**
 * 07.10.2026 - samo wczytanie strony (DamUserPrefs.load) nie moze zapisac ustawien konta,
 * gdy odczyt GET /user-prefs sie nie udal (401, 5xx, ok:false). Dawniej szedl wtedy POST z
 * lokalnego cache, a klucz dam_user_prefs nie jest per konto - cudze ustawienia z przegladarki
 * nadpisywaly ustawienia zalogowanego konta. Ten sam wzorzec co ROOT w dam-paths.js.
 * Migracja starych kluczy i dopisanie brakujacych pol zostaja, ale tylko po UDANYM odczycie.
 * Run: node bin/apps/web/scripts/tests/test_user_prefs_no_write_on_failed_read.js
 *      (DAM_USER_PREFS_SRC=<plik> podmienia badany dam-user-prefs.js)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = process.env.DAM_USER_PREFS_SRC ||
  path.join(__dirname, "..", "..", "assets", "js", "dam-user-prefs.js");
var MIGRATE_FLAG = "dam_user_prefs_migrated_v2";
var fails = 0;

var FULL = {
  safe_delete: true, branding_page_size: 100, card_zoom: 100, assoc_split: {},
  explorer_show_all: false, explorer_lang_filter: "", explorer_viz_view: "tiles",
  explorer_viz_scale: 140, reveal_low_tags: false, sidebar_collapsed: false
};

function makeEnv(getReply, storage) {
  var store = Object.assign({ dam_token: "t" }, storage || {});
  var writes = [];
  var localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    key: function (i) { return Object.keys(store)[i] || null; }
  };
  Object.defineProperty(localStorage, "length", { get: function () { return Object.keys(store).length; } });
  var win = { dispatchEvent: function () { return true; } };
  function fetch(url, opts) {
    var method = (opts && opts.method) || "GET";
    if (method !== "GET") {
      writes.push(JSON.parse(opts.body).prefs);
      return Promise.resolve({ status: 200, ok: true,
        json: function () { return Promise.resolve({ ok: true, prefs: JSON.parse(opts.body).prefs }); } });
    }
    if (getReply === "offline") return Promise.reject(new TypeError("Failed to fetch"));
    return Promise.resolve({ status: getReply.status, ok: getReply.status < 400,
      json: function () { return Promise.resolve(getReply.body); } });
  }
  var ctx = { window: win, localStorage: localStorage, fetch: fetch, CustomEvent: function () {},
    Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout, console: console,
    JSON: JSON, Object: Object };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC, "utf8"), ctx, { filename: "dam-user-prefs.js" });
  return { prefs: win.DamUserPrefs, writes: writes, store: store };
}

var FOREIGN_CACHE = JSON.stringify(Object.assign({}, FULL, { card_zoom: 150, safe_delete: false }));
var LEGACY = { dam_viz_card_zoom: "130" };
var partial = Object.assign({}, FULL);
delete partial.sidebar_collapsed;

var CASES = [
  { name: "P1 odczyt 401, w przegladarce cudzy cache", get: { status: 401, body: { ok: false, error: "login_required" } },
    storage: { dam_user_prefs: FOREIGN_CACHE }, wantWrites: 0 },
  { name: "P2 odczyt 200 z ok:false", get: { status: 200, body: { ok: false } },
    storage: { dam_user_prefs: FOREIGN_CACHE }, wantWrites: 0 },
  { name: "P3 odczyt 500", get: { status: 500, body: {} },
    storage: { dam_user_prefs: FOREIGN_CACHE }, wantWrites: 0 },
  { name: "P4 most offline", get: "offline",
    storage: { dam_user_prefs: FOREIGN_CACHE }, wantWrites: 0 },
  { name: "P5 odczyt udany, komplet pol - serwer wygrywa z cache", get: { status: 200, body: { ok: true, prefs: FULL } },
    storage: { dam_user_prefs: FOREIGN_CACHE, dam_user_prefs_migrated_v2: "1" }, wantWrites: 0,
    after: function (env) { return env.prefs.getSync().card_zoom === 100 && env.prefs.getSync().safe_delete === true; } },
  { name: "P6 odczyt udany, serwer bez pola - dopisanie (jak dotad)", get: { status: 200, body: { ok: true, prefs: partial } },
    storage: { dam_user_prefs_migrated_v2: "1" }, wantWrites: 1 },
  { name: "P7 stare klucze + odczyt udany - migracja (jak dotad)", get: { status: 200, body: { ok: true, prefs: FULL } },
    storage: LEGACY, wantWrites: 1,
    after: function (env) { return env.writes[0].card_zoom === 130 && env.store[MIGRATE_FLAG] === "1"; } },
  { name: "P8 stare klucze + odczyt 401 - bez zapisu, migracja ponowi sie pozniej", get: { status: 401, body: { ok: false } },
    storage: LEGACY, wantWrites: 0,
    after: function (env) { return env.store[MIGRATE_FLAG] !== "1"; } },
  { name: "P9 jawna zmiana ustawienia nadal zapisuje", get: { status: 200, body: { ok: true, prefs: FULL } },
    storage: { dam_user_prefs_migrated_v2: "1" }, wantWrites: 1,
    act: function (env) { return env.prefs.set({ card_zoom: 120 }); },
    after: function (env) { return env.writes[0].card_zoom === 120; } }
];

CASES.reduce(function (chain, c) {
  return chain.then(function () {
    var env = makeEnv(c.get, c.storage);
    return env.prefs.load().then(function () {
      return c.act ? c.act(env) : null;
    }).then(function () {
      return new Promise(function (r) { setTimeout(r, 20); });
    }).then(function () {
      var good = env.writes.length === c.wantWrites && (!c.after || c.after(env) === true);
      if (!good) fails++;
      console.log((good ? "ok   " : "FAIL ") + c.name + " -> zapisow: " + env.writes.length +
        " (oczekiwano " + c.wantWrites + ")");
    });
  });
}, Promise.resolve()).then(function () {
  console.log(fails ? "FAILED " + fails : "OK test_user_prefs_no_write_on_failed_read.js");
  process.exit(fails ? 1 : 0);
});
