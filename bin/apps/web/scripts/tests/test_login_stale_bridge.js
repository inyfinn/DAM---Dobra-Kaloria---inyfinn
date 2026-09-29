/**
 * 29.09.2026 (Mac, DAM.app 2.4.7 -> 2.4.9): stary most zyl w tle i logowanie szlo do
 * starej bazy -> "Nieprawidłowy email lub hasło". DamApi.login porownuje teraz
 * app_version mostu (/health) z wersja serwera UI (/dam-runtime.json) i:
 *  - inna wersja -> prosi serwer UI o przejecie (/dam/ensure-services),
 *  - przejecie nieudane -> jawny blad stale_bridge_running, haslo NIE idzie do starego mostu,
 *  - ta sama wersja albo brak wersji w runtime (tryb publiczny) -> bez zmian.
 * Run: node bin/apps/web/scripts/tests/test_login_stale_bridge.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var JS = path.join(__dirname, "..", "..", "assets", "js");

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

/* opts: runtimeVersion, healths (kolejne odpowiedzi /health), ensure (odpowiedz ensure-services) */
function loadDamApi(opts) {
  var calls = { login: 0, ensure: 0, health: 0 };
  var healths = (opts.healths || []).slice();
  var runtime = {
    app_version: opts.runtimeVersion,
    bridgeUrl: function () { return "http://127.0.0.1:8766"; },
    uiOrigin: function () { return "http://127.0.0.1:8765"; },
    ensureServices: function () { return Promise.resolve({ ok: true, cached: true }); },
    bridgeHealth: function () {
      calls.health++;
      return Promise.resolve(healths.length > 1 ? healths.shift() : healths[0]);
    },
  };
  var ctx = {
    console: console,
    Promise: Promise,
    JSON: JSON,
    Date: Date,
    Object: Object,
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    localStorage: makeStorage(),
    DamRuntime: runtime,
    fetch: function (url) {
      if (/\/auth\/identity$/.test(url)) {
        return jsonResponse({ ok: true, machine_id: "dam-mid-t", device_id: "dam-dev-t" });
      }
      if (/\/dam\/ensure-services$/.test(url)) {
        calls.ensure++;
        return jsonResponse(opts.ensure || { ok: false });
      }
      if (/\/auth\/login$/.test(url)) {
        calls.login++;
        return jsonResponse({ ok: false, error: "invalid_credentials" });
      }
      return Promise.reject(new Error("nieoczekiwany fetch " + url));
    },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, "dam-api.js"), "utf8"), ctx, { filename: "dam-api.js" });
  return { api: ctx.DamApi, calls: calls };
}

async function tryLogin(opts) {
  var env = loadDamApi(opts);
  try {
    await env.api.login("a@kubara.pl", "haslo-testowe-123");
    return { err: null, calls: env.calls };
  } catch (e) {
    return { err: e, calls: env.calls };
  }
}

var OLD = { ok: true, service: "dam-local-bridge", api_version: 10 };
var CUR = { ok: true, service: "dam-local-bridge", api_version: 11, app_version: "2.4.9" };

(async function main() {
  var r1 = await tryLogin({
    runtimeVersion: "2.4.9",
    healths: [OLD],
    ensure: {
      ok: false,
      error: "stale_bridge_running",
      message: "Działa starsza wersja DAM w tle - zamknij ją w Monitorze aktywności / Menedżerze zadań albo uruchom komputer ponownie.",
    },
  });
  ok(r1.err && r1.err.code === "stale_bridge_running", "stary most + nieudane przejecie -> kod stale_bridge_running");
  ok(r1.err && /starsza wersja DAM/.test(r1.err.message), "komunikat: starsza wersja DAM w tle");
  ok(r1.err && !/Nieprawid/.test(r1.err.message), "NIE 'Nieprawidłowy email lub hasło'");
  ok(r1.calls.login === 0, "haslo nie poszlo do starego mostu (/auth/login nie wywolany)");
  ok(r1.calls.ensure === 1, "poproszono serwer UI o przejecie (ensure-services)");

  var r2 = await tryLogin({ runtimeVersion: "2.4.9", healths: [CUR] });
  ok(r2.calls.ensure === 0 && r2.calls.login === 1, "ta sama wersja -> zwykle logowanie, bez przejecia");
  ok(r2.err && /Nieprawid/.test(r2.err.message), "ta sama wersja -> dotychczasowy komunikat bledu hasla");

  var r3 = await tryLogin({ runtimeVersion: "2.4.9", healths: [OLD, CUR], ensure: { ok: true } });
  ok(r3.calls.ensure === 1 && r3.calls.login === 1, "przejecie udane -> logowanie do nowego mostu");

  var r4 = await tryLogin({ runtimeVersion: "2.4.9", healths: [OLD, OLD], ensure: { ok: true } });
  ok(r4.err && r4.err.code === "stale_bridge_running" && r4.calls.login === 0,
    "po przejeciu nadal stary most -> jawny blad, bez logowania");

  var r5 = await tryLogin({ runtimeVersion: undefined, healths: [OLD] });
  ok(r5.calls.ensure === 0 && r5.calls.login === 1, "brak app_version w runtime (tryb publiczny) -> bez bramki");

  var r6 = await tryLogin({ runtimeVersion: "2.4.9", healths: [null] });
  ok(r6.calls.ensure === 0 && r6.calls.login === 1, "most offline -> dotychczasowa sciezka");

  if (fails) {
    console.error(fails + " FAIL");
    process.exit(1);
  }
  console.log("PASS test_login_stale_bridge");
})();
