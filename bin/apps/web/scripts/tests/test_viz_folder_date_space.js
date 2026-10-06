/**
 * parseFolderDateScore (dam-viz.js): data folderu wariantu ze SPACJAMI ("MINI - 18 06 2026 - 6300782.00 - F")
 * musi liczyc sie tak samo jak z kropkami ("KAR6X - 20.05.2026 - ..."). Przed 06.10.2026 dawala 0, wiec
 * "Wprowadzenie: najnowsze" spychalo takie warianty na koniec.
 * Run: node apps/web/scripts/tests/test_viz_folder_date_space.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-viz.js"), "utf8").replace(/\r\n/g, "\n");
var m = SRC.match(/\n  function parseFolderDateScore\([^)]*\) \{[\s\S]*?\n  \}\n/);
if (!m) {
  console.error("FAIL dam-viz.js ma funkcje parseFolderDateScore");
  process.exit(1);
}
var ctx = {};
vm.createContext(ctx);
vm.runInContext(m[0] + "\nthis.f = parseFolderDateScore;", ctx);
var f = ctx.f;

var fails = 0;
function eq(got, want, label) {
  if (got !== want) {
    console.error("FAIL " + label + ": " + got + " != " + want);
    fails++;
  }
}
eq(f("MINI - 18 06 2026 - 6300782.00 - F"), 20260618, "spacje DD MM RRRR");
eq(f("KAR6X - 20.05.2026 - PL EN - 6300783.00 - F"), 20260520, "kropki DD.MM.RRRR");
eq(f("SLEEVE - 21.12.2022 - KAR000164.00"), 20221221, "kropki, indeks KAR");
eq(f("BIGPAK - 08-04-2021"), 20210408, "myslniki");
eq(f("DOYPACK - 03.26"), 20260300, "MM.RR bez dnia");
eq(f("RĘKAW - 6300791.00"), 0, "sam indeks: 6300791.00 nie jest data");
eq(f("KARTON 2026_03_01 - 6300660"), 0, "podkreslenia nie sa separatorem daty");
if (fails) process.exit(1);
console.log("OK test_viz_folder_date_space: 7 asercji");
