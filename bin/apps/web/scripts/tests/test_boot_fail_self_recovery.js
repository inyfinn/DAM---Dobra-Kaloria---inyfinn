/**
 * dam-panic-reload.js, 07.10.2026: ekran "Nie udalo sie uruchomic aplikacji" ma zejsc sam.
 * W oknie programu (test odbioru) pojawil sie przy 2 z 6 startow i stal 3 minuty, choc most i serwer UI
 * dzialaly - straznik po 4,5 s tylko pokazywal ekran. Teraz:
 *  - po pokazaniu ekranu co 3 s sprawdza /dam-runtime.json i <most>/health; gdy oba odpowiadaja, a program
 *    nadal nie wystartowal - sam przeladowuje strone;
 *  - najwyzej 2 razy na karte (licznik w sessionStorage), potem zostaje przycisk;
 *  - udany start (__damMarkBootOk) zeruje licznik i niczego nie przeladowuje;
 *  - uslugi nie odpowiadaja -> nie przeladowuje (nie ma po co), pyta dalej;
 *  - strona logowania i wymuszony ekran (?dam_boot_fail=1) - bez samonaprawy.
 * Czas jest sztuczny (wlasna kolejka setTimeout), test nie czeka naprawde.
 * Run: node apps/web/scripts/tests/test_boot_fail_self_recovery.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-panic-reload.js"), "utf8");
var fails = 0;
var count = 0;
function ok(cond, label) {
  count++;
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}

function load(opts) {
  var now = 0;
  var timers = [];
  var store = Object.assign({}, opts.session || {});
  var reloads = 0;
  var fetched = [];
  var nodes = {};
  function el(id) {
    return { id: id, hidden: false, style: { setProperty: function () {} }, classList: { add: function () {}, remove: function () {} },
      setAttribute: function () {}, addEventListener: function () {}, appendChild: function (c) { if (c && c.id) nodes[c.id] = c; nodes.damBootFailRetry = nodes.damBootFailRetry || el("damBootFailRetry"); },
      parentNode: { removeChild: function (c) { delete nodes[c.id]; } }, set innerHTML(v) {} };
  }
  var doc = { documentElement: el("html"), body: el("body"), createElement: function () { return el(""); },
    getElementById: function (id) { return nodes[id] || null; } };
  var win = { addEventListener: function () {}, location: { reload: function () { reloads++; } } };
  var ctx = {
    window: win, document: doc,
    location: { pathname: opts.pathname || "/dashboard.html", search: opts.search || "" },
    sessionStorage: { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; } },
    setTimeout: function (fn, ms) { timers.push({ at: now + (ms || 0), fn: fn }); return timers.length; },
    fetch: function (url) {
      fetched.push(String(url));
      if (!opts.servicesUp) return Promise.reject(new Error("offline"));
      if (String(url).indexOf("/dam-runtime.json") === 0) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ bridge: "http://127.0.0.1:18768/" }); } });
      return Promise.resolve({ ok: true });
    },
    Promise: Promise, parseInt: parseInt, String: String, Object: Object, Error: Error,
  };
  win.location.reload = function () { reloads++; };
  ctx.window.location = win.location;
  vm.runInNewContext(SRC, ctx, { filename: "dam-panic-reload.js" });
  async function advance(ms) {
    var end = now + ms;
    for (;;) {
      timers.sort(function (a, b) { return a.at - b.at; });
      var t = timers[0];
      if (!t || t.at > end) break;
      timers.shift();
      now = t.at;
      t.fn();
      for (var i = 0; i < 8; i++) await Promise.resolve(); // dokoncz lancuchy then()
    }
    now = end;
  }
  return { win: win, advance: advance, store: store, reloads: function () { return reloads; }, fetched: fetched,
    failShown: function () { return !!nodes.damBootFail; } };
}

(async function () {
  // 1. Start sie nie udal, uslugi dzialaja: ekran, po 3 s jedno samoczynne przeladowanie.
  var a = load({ servicesUp: true });
  await a.advance(4600);
  ok(a.failShown(), "po 4,5 s bez startu jest ekran awarii");
  ok(a.reloads() === 0, "samo pokazanie ekranu niczego nie przeladowuje");
  await a.advance(3100);
  ok(a.reloads() === 1, "uslugi odpowiadaja -> jedno samoczynne przeladowanie, bylo: " + a.reloads());
  ok(a.store.dam_boot_autoreload === "1", "licznik ponowien = 1");
  ok(a.fetched[0] === "/dam-runtime.json" && a.fetched[1] === "http://127.0.0.1:18768/health", "sprawdza serwer UI i most z konfiguracji: " + a.fetched.join(", "));

  // 2. Trzecie z rzedu nieudane uruchomienie tej karty: juz bez przeladowania (zostaje przycisk).
  var b = load({ servicesUp: true, session: { dam_boot_autoreload: "2" } });
  await b.advance(20000);
  ok(b.failShown() && b.reloads() === 0 && b.fetched.length === 0, "po 2 ponowieniach nie przeladowuje i nie pyta");

  // 3. Uslugi nie odpowiadaja: pyta dalej, nie przeladowuje.
  var c = load({ servicesUp: false });
  await c.advance(4600 + 3100 * 3);
  ok(c.reloads() === 0, "bez uslug nie ma przeladowania");
  ok(c.fetched.length >= 3, "pyta co 3 s: " + c.fetched.length);

  // 4. Udany start: brak ekranu, brak pytan, licznik wyzerowany.
  var d = load({ servicesUp: true, session: { dam_boot_autoreload: "1" } });
  d.win.__damMarkBootOk();
  await d.advance(20000);
  ok(!d.failShown() && d.reloads() === 0 && d.fetched.length === 0, "udany start: nic sie nie dzieje");
  ok(!("dam_boot_autoreload" in d.store), "udany start zeruje licznik");

  // 5. Start udaje sie juz po pokazaniu ekranu (wolny komputer): bez przeladowania.
  var e = load({ servicesUp: false });
  await e.advance(4600);
  e.win.__damMarkBootOk();
  await e.advance(10000);
  ok(e.reloads() === 0, "spozniony udany start nie przeladowuje strony");

  // 6. Strona logowania i wymuszony ekran: bez samonaprawy.
  var f = load({ servicesUp: true, pathname: "/signin.html" });
  await f.advance(20000);
  ok(!f.failShown() && f.reloads() === 0, "signin: bez ekranu awarii i bez przeladowan");
  var g = load({ servicesUp: true, search: "?dam_boot_fail=1" });
  await g.advance(20000);
  ok(g.failShown() && g.reloads() === 0, "wymuszony ekran (?dam_boot_fail=1) zostaje, bez przeladowan");

  console.log((fails ? "FAIL" : "OK") + " test_boot_fail_self_recovery: " + (count - fails) + "/" + count);
  process.exit(fails ? 1 : 0);
})();
