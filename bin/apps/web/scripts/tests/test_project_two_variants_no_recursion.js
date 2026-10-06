/**
 * assetMatchesRevision (dam-project.js): produkt z DWOMA wariantami i plik niepasujacy do zadnego
 * wpadal w nieskonczona rekurencje (rev -> other -> rev ...) i project.html pokazywal
 * "Błąd ładowania projektu: Maximum call stack size exceeded" (Cynamonka, 06.10.2026).
 * Run: node apps/web/scripts/tests/test_project_two_variants_no_recursion.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-project.js"), "utf8").replace(/\r\n/g, "\n");
var m = SRC.match(/\n  function assetMatchesRevision\([^)]*\) \{[\s\S]*?\n  \}\n/);
if (!m) {
  console.error("FAIL dam-project.js ma funkcje assetMatchesRevision");
  process.exit(1);
}
var ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(
  "function digitsOnly(v) { return String(v || '').replace(/\\D+/g, ''); }\n" + m[0] + "\nthis.f = assetMatchesRevision;",
  ctx
);
var f = ctx.f;

var revs = [
  { index: "6300783.00", folder: "KAR6X - 20.05.2026  - PL EN - 6300783.00 - F", carrier: "KAR6X", path: "M:/x/CYNAMONKA/KAR6X - 20.05.2026  - PL EN - 6300783.00 - F" },
  { index: "6300782.00", folder: "MINI - 18 06 2026 - 6300782.00 - F", carrier: "MINI", path: "M:/x/CYNAMONKA/MINI - 18 06 2026 - 6300782.00 - F" },
];
var fails = 0;
function check(label, fn) {
  try {
    fn();
  } catch (e) {
    console.error("FAIL " + label + ": " + e.message);
    fails++;
  }
}
check("plik niepasujacy do zadnego z 2 wariantow nie zapetla", function () {
  var a = { path: "M:/BRANDING/DOBRA KALORIA/03 - X/baner.jpg", name: "baner.jpg", search_blob: "", sku: "" };
  var r1 = f(a, revs[0], revs);
  var r2 = f(a, revs[1], revs);
  if (r1 !== false || r2 !== false) throw new Error("oczekiwano false/false, jest " + r1 + "/" + r2);
});
check("plik z indeksem wariantu pasuje tylko do niego", function () {
  var a = { path: "M:/BRANDING/x/DK-MINI-NERK-CYNAMONKA-6300782.00-RGB-FRONT-S.png", name: "", search_blob: "", sku: "" };
  if (f(a, revs[1], revs) !== true) throw new Error("MINI powinien pasowac");
  if (f(a, revs[0], revs) !== false) throw new Error("KAR6X nie powinien pasowac");
});
check("tif bez znacznika KAR6X trafia do MINI (regula 2 wariantow) bez rekurencji", function () {
  var a = { path: "M:/BRANDING/x/cynamonka_packshot.tif", name: "cynamonka_packshot.tif", search_blob: "", sku: "" };
  f(a, revs[0], revs);
  f(a, revs[1], revs);
});
if (fails) process.exit(1);
console.log("OK test_project_two_variants_no_recursion: 3 sprawdzenia");
