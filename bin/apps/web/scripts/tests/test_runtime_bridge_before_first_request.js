/**
 * dam-runtime.js, 07.10.2026: adres mostu ma byc znany, ZANIM jakikolwiek inny skrypt strony
 * wysle pierwsze zadanie. Przed poprawka bridgeUrl() do czasu odpowiedzi na
 * fetch("/dam-runtime.json") zwracal domyslne http://127.0.0.1:8766, wiec na komputerze, gdzie DAM
 * dostal inne porty, ekran logowania pytal cudzy most o /db/status, /auth/saved i /db/activation
 * (zmierzone w oknie testu odbioru: 3 zadania GET do 8766 z instancji na portach 18778/18768).
 *  - serwer UI oddaje /dam-runtime.json: bridgeUrl() od razu po wczytaniu skryptu = most z konfiguracji,
 *    a pierwsze zadanie /health idzie na ten most, nie na 8766;
 *  - brak /dam-runtime.json (tryb przegladarkowy, 404) albo wyjatek: zachowanie jak dotad (domyslny adres).
 * Run: node apps/web/scripts/tests/test_runtime_bridge_before_first_request.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-runtime.js"), "utf8");
var fails = 0;
var count = 0;
function ok(cond, label) {
  count++;
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}

function load(xhrMode) {
  var fetched = [];
  var xhrCalls = [];
  function XHR() {}
  XHR.prototype.open = function (method, url, async) {
    xhrCalls.push({ method: method, url: url, async: async });
  };
  XHR.prototype.send = function () {
    if (xhrMode === "throw") throw new Error("network");
    this.status = xhrMode === "ok" ? 200 : 404;
    this.responseText = xhrMode === "ok" ? JSON.stringify({ bridge: "http://127.0.0.1:18768", bridge_port: 18768 }) : "";
  };
  var win = {
    addEventListener: function () {},
    dispatchEvent: function () {},
  };
  var ctx = {
    window: win,
    location: { origin: "http://127.0.0.1:18778", protocol: "http:", hostname: "127.0.0.1", port: "18778" },
    XMLHttpRequest: xhrMode === "none" ? undefined : XHR,
    CustomEvent: function (name, init) {
      this.type = name;
      this.detail = init && init.detail;
    },
    fetch: function (url) {
      fetched.push(String(url));
      return new Promise(function () {}); // nigdy nie odpowiada: liczy sie stan PRZED odpowiedzia
    },
    setTimeout: setTimeout,
    Promise: Promise,
    JSON: JSON,
    Object: Object,
    String: String,
    Date: Date,
    Error: Error,
  };
  vm.runInNewContext(SRC, ctx, { filename: "dam-runtime.js" });
  return { rt: win.DamRuntime, fetched: fetched, xhrCalls: xhrCalls };
}

// 1. Serwer UI programu: konfiguracja znana synchronicznie.
var a = load("ok");
ok(a.rt.bridgeUrl() === "http://127.0.0.1:18768", "most z /dam-runtime.json od razu po wczytaniu skryptu: " + a.rt.bridgeUrl());
ok(a.xhrCalls.length === 1 && a.xhrCalls[0].url === "/dam-runtime.json" && a.xhrCalls[0].async === false,
  "jeden synchroniczny odczyt /dam-runtime.json");
ok(a.fetched.every(function (u) { return u.indexOf(":8766") === -1; }), "zadne zadanie nie idzie na domyslny port 8766: " + a.fetched.join(", "));
ok(a.rt.bridge_port === 18768, "pola konfiguracji przeniesione do DamRuntime");

// 2. Brak /dam-runtime.json (404): jak dotad - domyslny adres, a asynchroniczne wczytanie nadal probuje.
var b = load("404");
ok(b.rt.bridgeUrl() === "http://127.0.0.1:8766", "404: domyslny adres jak dotad");
ok(b.fetched.indexOf("/dam-runtime.json") !== -1, "404: asynchroniczne wczytanie konfiguracji nadal startuje");

// 3. Wyjatek sieci i brak XMLHttpRequest nie wywracaja skryptu.
var c = load("throw");
ok(c.rt && typeof c.rt.bridgeUrl === "function" && c.rt.bridgeUrl() === "http://127.0.0.1:8766", "wyjatek XHR: skrypt dziala, adres domyslny");
var d = load("none");
ok(d.rt && d.rt.bridgeUrl() === "http://127.0.0.1:8766", "brak XMLHttpRequest: skrypt dziala, adres domyslny");

console.log((fails ? "FAIL" : "OK") + " test_runtime_bridge_before_first_request: " + (count - fails) + "/" + count);
process.exit(fails ? 1 : 0);
