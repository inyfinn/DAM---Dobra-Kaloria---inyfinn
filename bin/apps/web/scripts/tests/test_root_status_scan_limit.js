/**
 * Naglowkowe "Pliki" (dam-root-status.js), 07.10.2026: przycisk odswiezenia uruchamia skan
 * i czeka na jego koniec najwyzej 120 s. Pelny skan trwa 20-50 minut, wiec po limicie:
 *  - skan trwa: NIE pobieramy spisu (nic sie w nim nie zmienilo) i nie oglaszamy
 *    "odswiezono"; ekrany dostaja dam:index-refreshed z detail.scanRunning = true;
 *  - skan skonczyl sie w limicie: jak dotad, swiezy spis + dam:index-refreshed z fileIndex.
 * Czas jest sztuczny (wlasny zegar i kolejka setTimeout).
 * Run: node bin/apps/web/scripts/tests/test_root_status_scan_limit.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-root-status.js"), "utf8");
var fails = 0;
var count = 0;
function ok(cond, label) {
  count++;
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}

/* o.status(n) -> tresc n-tej odpowiedzi GET /index/status (numeracja od 1). */
function makeWin(o) {
  var log = { posts: 0, statusReads: 0, refresh: 0, events: [] };
  var clock = 5000000;
  var timers = [];
  var seq = 0;
  var win = {
    DamRuntime: { bridgeUrl: function () { return "http://bridge"; } },
    DamFileIndex: {
      refresh: function () {
        log.refresh++;
        return Promise.resolve({ generated_at: "2026-10-07T12:30:00", products: [] });
      }
    },
    addEventListener: function () {},
    dispatchEvent: function (ev) {
      log.events.push(ev);
      return true;
    },
    location: { pathname: "/index.html" }
  };
  var ctx = {
    window: win,
    document: {
      readyState: "loading",
      addEventListener: function () {},
      getElementById: function () { return null; },
      querySelector: function () { return null; }
    },
    localStorage: { getItem: function () { return ""; }, setItem: function () {} },
    fetch: function (url, opts) {
      url = String(url);
      var body = {};
      if (opts && opts.method === "POST") {
        log.posts++;
        body = { ok: true, started: true, running: true };
      } else if (url.indexOf("/index/status") !== -1) {
        log.statusReads++;
        body = o.status(log.statusReads);
      }
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } });
    },
    CustomEvent: function (type, init) {
      this.type = type;
      this.detail = (init && init.detail) || {};
    },
    setTimeout: function (fn, ms) {
      seq++;
      timers.push({ id: seq, at: clock + (ms || 0), fn: fn });
      return seq;
    },
    clearTimeout: function () {},
    setInterval: function () { return 0; },
    clearInterval: function () {},
    Date: { now: function () { return clock; } },
    Promise: Promise,
    JSON: JSON,
    console: console
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "dam-root-status.js" });
  return {
    log: log,
    elapsed: function () { return clock - 5000000; },
    refresh: async function () {
      var out = null;
      win.DamRootStatus.refresh().then(function (v) { out = { value: v }; });
      for (var i = 0; i < 5000 && !out; i++) {
        await new Promise(setImmediate);
        if (out || !timers.length) continue;
        timers.sort(function (a, b) { return a.at - b.at || a.id - b.id; });
        var t = timers.shift();
        clock = Math.max(clock, t.at);
        t.fn();
      }
      if (!out) throw new Error("refresh() nie skonczyl sie w 5000 krokach");
      return out.value;
    }
  };
}

var RUN = { rebuild_running: true, rebuild: { running: true } };
var DONE = { rebuild_running: false, mtime: 7, rebuild: { running: false, last_ok: true } };

(async function () {
  /* 1. Skan trwa dluzej niz limit 120 s. */
  var w = makeWin({ status: function () { return RUN; } });
  var res = await w.refresh();
  ok(w.log.posts === 1 && w.elapsed() >= 120000 && w.elapsed() < 125000, "skan trwa: czekamy do limitu 120 s (" + w.elapsed() + " ms)");
  ok(w.log.refresh === 0, "skan trwa: bez pobierania spisu, w ktorym nic sie nie zmienilo (pobran: " + w.log.refresh + ")");
  var ev = w.log.events.filter(function (e) { return e.type === "dam:index-refreshed"; });
  ok(ev.length === 1 && ev[0].detail.scanRunning === true && !ev[0].detail.fileIndex, "skan trwa: jedno zdarzenie z detail.scanRunning, bez fileIndex");
  ok(res && res.ok === true && res.scanRunning === true, "skan trwa: wynik refresh() mowi scanRunning");
  ok(w.log.events.length === 1, "skan trwa: zadnych innych zdarzen");

  /* 2. Skan konczy sie w limicie: zachowanie jak dotad. */
  w = makeWin({ status: function (n) { return n < 4 ? RUN : DONE; } });
  res = await w.refresh();
  ev = w.log.events.filter(function (e) { return e.type === "dam:index-refreshed"; });
  ok(w.log.refresh === 1 && w.elapsed() < 10000, "skan skonczony: jedno pobranie swiezego spisu (" + w.elapsed() + " ms)");
  ok(ev.length === 1 && !ev[0].detail.scanRunning && ev[0].detail.fileIndex && ev[0].detail.fileIndex.generated_at, "skan skonczony: zdarzenie z fileIndex, bez scanRunning");
  ok(res && res.ok === true && !res.scanRunning, "skan skonczony: wynik bez scanRunning");

  /* 3. Dwa klikniecia naraz: drugie nie uruchamia drugiego skanu. */
  w = makeWin({ status: function () { return DONE; } });
  var first = w.refresh();
  /* refresh() z harnessu wola DamRootStatus.refresh(); drugie wywolanie w tym samym takcie. */
  var second = w.refresh();
  var both = await Promise.all([first, second]);
  ok(w.log.posts === 1 && (both[0].busy === true || both[1].busy === true), "dwa klikniecia: jeden POST, drugie dostaje busy");

  if (fails) process.exit(1);
  console.log("OK test_root_status_scan_limit: " + count + " asercji");
})().catch(function (e) {
  console.error("FAIL wyjatek testu: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
