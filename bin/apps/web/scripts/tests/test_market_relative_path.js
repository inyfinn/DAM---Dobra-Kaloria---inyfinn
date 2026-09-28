/**
 * W8 (28.09.2026): komputer bez ROOT dostaje w katalogu sciezki wzgledne "- POLSKA/..."
 * (asset_sync.local_path(rel, None)), komputer z dyskiem "X:/Marketing/- POLSKA/...".
 * DamLabels.detectMarketFromPath musi dac ten sam rynek dla obu - inaczej etykieta karty
 * rozni sie miedzy komputerami.
 * Run: node apps/web/scripts/tests/test_market_relative_path.js [sciezka do dam-labels.js]
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = process.argv[2] || path.join(__dirname, "..", "..", "assets", "js", "dam-labels.js");
var sandbox = { console: console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, "utf8"), sandbox, { filename: SRC });
var DL = Object.keys(sandbox)
  .map(function (k) { return sandbox[k]; })
  .filter(function (v) { return v && typeof v === "object" && typeof v.detectMarketFromPath === "function"; })[0];

var fails = 0;
function eq(got, want, label) {
  if (got !== want) {
    console.error("FAIL " + label + ": oczekiwano " + JSON.stringify(want) + ", jest " + JSON.stringify(got));
    fails++;
  }
}

eq(DL.detectMarketFromPath("X:/Marketing/- POLSKA/04 - MARKETING/a.png"), "DK", "absolutna PL");
eq(DL.detectMarketFromPath("- POLSKA/04 - MARKETING/a.png"), "DK", "wzgledna PL (bez ROOT)");
eq(DL.detectMarketFromPath("- EKSPORT/GC/x.png"), "GC", "wzgledna eksport (bez ROOT)");
eq(DL.detectMarketFromPath(""), "", "pusta");

if (fails) {
  console.error(fails + " FAIL");
  process.exit(1);
}
console.log("OK test_market_relative_path");
