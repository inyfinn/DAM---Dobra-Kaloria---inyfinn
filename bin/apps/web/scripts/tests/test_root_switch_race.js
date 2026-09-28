/**
 * Usterka 5 (28.09.2026) - dwa nakladajace sie przelaczenia ROOT (X wolne,
 * pozniejsze M szybkie) nie moga skonczyc sie UI=M i backendem=X. Kontrakt G:
 * `root_generation` w odpowiedzi /root/switch; UI stosuje wynik tylko gdy
 * jego generacja >= ostatnio zastosowanej (dam-paths.js: applyRootResultIfNewer).
 * Rowniez POSIX (/Volumes, /mnt, /media) i UNC (\\serwer\udzial) w
 * normalizeMarketingRoot() nie moga zmienic rodziny separatorow.
 *
 * Run: node bin/apps/web/scripts/tests/test_root_switch_race.js
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

/** Ten sam harness co test_root_switch.js - fetch atrapa moze zwrocic Promise
 * odroczony w czasie (deferred), zeby symulowac wolniejsza/szybsza odpowiedz.
 * `sharedStore` (opcjonalny) = wspolny localStorage dwoch "okien" tego samego
 * pochodzenia (prawdziwa przegladarka: dwie karty widza TEN SAM localStorage). */
function makeEnv(routes, sharedStore) {
  var store = sharedStore || {};
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
    var reqBody = opts && opts.body ? JSON.parse(opts.body) : null;
    calls.push({ path: p, body: reqBody });
    var h = routes[p];
    if (!h) return Promise.resolve({ status: 404, ok: false, json: function () { return Promise.resolve({}); } });
    var out = h(reqBody);
    if (out === "offline") return Promise.reject(new TypeError("Failed to fetch"));
    function toResponse(o) {
      return {
        status: o.status || 200,
        ok: (o.status || 200) < 400,
        json: function () { return Promise.resolve(o.body); }
      };
    }
    // h moze zwrocic {body} (natychmiast) albo {delayMs, body} (odroczone -
    // symuluje wolna sonde folderu na dysku sieciowym).
    if (out && typeof out.delayMs === "number") {
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(toResponse(out)); }, out.delayMs);
      });
    }
    return Promise.resolve(toResponse(out));
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

  // 1) Dwa nakladajace sie przelaczenia z DWOCH ROZNYCH OKIEN (dwie karty tego
  // samego pochodzenia = wspolny localStorage, ale kazde ze swoim _switchSeq -
  // wiec to NIE jest test starego mechanizmu _switchSeq, tylko generacji z
  // kontraktu G). Okno X wystartowalo pierwsze, ale most odpowiada mu dopiero
  // po 30ms (wolna sonda folderu); okno M wystartowalo pozniej i most
  // odpowiada od razu - tak jak w prawdziwym przelaczeniu M wygrywa zapis pod
  // zamkiem (wyzsza generacja), wiec backendowy mock zwraca M z wyzsza
  // generacja niz X, mimo ze odpowiedz X wraca PO odpowiedzi M.
  chain = chain.then(function () {
    var sharedStore = { dam_device_id: "dev-1" };
    var routes = {
      "/root/switch": function (body) {
        if (body.base_path === "X:\\Marketing") {
          return { delayMs: 30, body: { ok: true, base_path: "X:\\Marketing", root_alive: true, reason: "ok", root_generation: 5 } };
        }
        return { body: { ok: true, base_path: "M:\\Marketing", root_alive: true, reason: "ok", root_generation: 6 } };
      }
    };
    var winX = makeEnv(routes, sharedStore);
    var winM = makeEnv(routes, sharedStore);
    sharedStore["dam_base_path::dev-1"] = "D:\\Marketing";
    var pX = winX.DamPaths.setBasePath("X:\\Marketing");
    var pM = winM.DamPaths.setBasePath("M:\\Marketing");
    return Promise.all([pX, pM]).then(function () {
      eq(sharedStore["dam_base_path::dev-1"], "M:\\Marketing", "backend i UI (oba okna) zbiegaja do M (nowsza generacja), nie X");
    });
  });

  // 2) stale_request niesie BIEZACY stan (M) - okno, ktore "przegralo" (X),
  // ma zbiec sie do M zamiast zostac przy przekonaniu, ze nic sie nie stalo.
  // Dwa OSOBNE okna (jak w tescie 1) - to sprawdza konwergencje kontraktu G,
  // nie wewnetrzny _switchSeq jednego okna (ktory i tak by to zablokowal, bo
  // dotyczy tylko najnowszego wywolania z TEGO SAMEGO okna).
  chain = chain.then(function () {
    var sharedStore = { dam_device_id: "dev-1" };
    var routes = {
      "/root/switch": function (body) {
        if (body.base_path === "X:\\Marketing") {
          return {
            delayMs: 20,
            body: { ok: false, error: "stale_request", reason: "stale_request", base_path: "M:\\Marketing", root_generation: 9, root_alive: true }
          };
        }
        return { body: { ok: true, base_path: "M:\\Marketing", root_alive: true, reason: "ok", root_generation: 9 } };
      }
    };
    var winX = makeEnv(routes, sharedStore);
    var winM = makeEnv(routes, sharedStore);
    sharedStore["dam_base_path::dev-1"] = "D:\\Marketing";
    var pX = winX.DamPaths.setBasePath("X:\\Marketing");
    var pM = winM.DamPaths.setBasePath("M:\\Marketing");
    return Promise.all([pX, pM]).then(function (results) {
      var resX = results[0];
      ok(resX.ok === false && resX.error === "stale_request", "X dostaje stale_request");
      eq(sharedStore["dam_base_path::dev-1"], "M:\\Marketing", "mimo stale_request obie karty zbiegaja do M");
      ok(/M:\\Marketing/.test(resX.message), "komunikat stale_request wskazuje nowa sciezke");
    });
  });

  // 3) Odpowiedz ze STARSZA generacja niz juz zastosowana nie cofa UI (np.
  // request wyslany dawno temu wraca po fakcie - powinien byc noopem).
  chain = chain.then(function () {
    var call = 0;
    var env = makeEnv({
      "/root/switch": function () {
        call++;
        if (call === 1) return { body: { ok: true, base_path: "N:\\Marketing", root_alive: true, reason: "ok", root_generation: 10 } };
        return { body: { ok: true, base_path: "STARY:\\Marketing", root_alive: true, reason: "ok", root_generation: 3 } };
      }
    });
    return env.DamPaths.setBasePath("N:\\Marketing").then(function () {
      eq(env.store["dam_base_path::dev-1"], "N:\\Marketing", "pierwszy zapis z generacja 10");
      return env.DamPaths.setBasePath("STARY:\\Marketing");
    }).then(function () {
      eq(env.store["dam_base_path::dev-1"], "N:\\Marketing", "starsza generacja (3) nie nadpisuje nowszej (10)");
    });
  });

  // 4) normalizeMarketingRoot: POSIX i UNC nie zmieniaja rodziny separatorow.
  chain = chain.then(function () {
    var env = makeEnv({});
    var n = env.DamPaths.normalizeMarketingRoot;
    eq(n("/Volumes/Marketing"), "/Volumes/Marketing", "POSIX /Volumes zostaje POSIX");
    eq(n("/Volumes/Marketing/- POLSKA"), "/Volumes/Marketing", "POSIX: obcina podfolder do Marketing");
    eq(n("/mnt/x/Marketing"), "/mnt/x/Marketing", "POSIX /mnt zostaje POSIX");
    eq(n("/media/x/Marketing/- EKSPORT"), "/media/x/Marketing", "POSIX /media: obcina podfolder");
    eq(n("\\\\serwer\\udzial\\Marketing"), "\\\\serwer\\udzial\\Marketing", "UNC zostaje UNC (backslash)");
    eq(n("//serwer/udzial/Marketing/- POLSKA"), "\\\\serwer\\udzial\\Marketing", "UNC ze slashami -> kanoniczny UNC");
    eq(n("X:\\Marketing\\- POLSKA"), "X:\\Marketing", "dysk Windows bez zmian zachowania");
    eq(n("D:/Marketing"), "D:\\Marketing", "dysk Windows ze slashami -> backslash (bez zmiany zachowania)");
    eq(n("M:"), "M:\\", "sam dysk -> M:\\");
  });

  return chain;
}

run().then(function () {
  if (fails) {
    console.error(fails + " FAIL");
    process.exit(1);
  }
  console.log("OK test_root_switch_race.js");
}, function (err) {
  console.error("CRASH", err && err.stack);
  process.exit(1);
});
