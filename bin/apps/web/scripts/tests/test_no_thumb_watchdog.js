/**
 * Regression: miniatury nie maja czasowego watchdoga (setTimeout, ktory po
 * paru sekundach wola thumb-fallback, zanim onerror/404 realnie przyjdzie).
 * Diagnoza A/B (BRIEF-235): lazy <img> poza viewportem nigdy nie startuje
 * load/error, wiec watchdog strzelal falszywym "Podglad niedostepny" mimo ze
 * most zwracal 200. Jedyna droga do fallbacku ma byc prawdziwy onerror (404).
 * Run: node apps/web/scripts/tests/test_no_thumb_watchdog.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var assetsDir = path.join(__dirname, "..", "..", "assets", "js");
// Kopie konfliktow Synology Drive (*_Conflict.js) nie sa ladowane przez strony
// ani pakowane do instalatora - to nie jest kod produktu.
var files = fs.readdirSync(assetsDir).filter(function (f) {
  return f.endsWith(".js") && !/_Conflict/i.test(f);
});

var FALLBACK_CALLS = [
  "__damBrandingThumbFallback",
  "__damMediaPreviewFallback",
  "damVizThumbError",
];
var TIMEOUT_CONST_RE = /\b(THUMB_LOAD_TIMEOUT_MS|HERO_LOAD_TIMEOUT_MS)\b/;
var SETTIMEOUT_RE = /\bset(?:Timeout|Interval)\s*\(/g;

var failures = [];

files.forEach(function (f) {
  var full = path.join(assetsDir, f);
  var code = fs.readFileSync(full, "utf8");

  if (TIMEOUT_CONST_RE.test(code)) {
    failures.push(f + ": still defines THUMB_LOAD_TIMEOUT_MS/HERO_LOAD_TIMEOUT_MS");
  }

  // Kazdy setTimeout/setInterval w pliku: sprawdz, czy jego cialo (do
  // dopasowanego zamkniecia nawiasu, przyblizone - do najblizszego "}, <liczba>)")
  // woła ktoras z funkcji fallbacku. Prosty heurystyczny skan okna znakow
  // wokol wywolania wystarcza (te pliki nie zagniezdzaja setTimeout w setTimeout
  // z fallbackiem posrodku bez zwiazku).
  var m;
  SETTIMEOUT_RE.lastIndex = 0;
  while ((m = SETTIMEOUT_RE.exec(code))) {
    var start = m.index;
    var windowEnd = Math.min(code.length, start + 1200);
    var body = code.slice(start, windowEnd);
    // ogranicz do samego wywolania timera: do pierwszego wystapienia "}, <ms>)"
    var closeMatch = body.match(/\}\s*,\s*[0-9A-Za-z_.]+\s*\)/);
    if (closeMatch) {
      body = body.slice(0, closeMatch.index + closeMatch[0].length);
    }
    FALLBACK_CALLS.forEach(function (fnName) {
      if (body.indexOf(fnName) !== -1) {
        failures.push(
          f + ": setTimeout/setInterval body calls " + fnName + " (watchdog reintroduced) near offset " + start
        );
      }
    });
  }
});

if (failures.length) {
  console.error("FAIL: thumb watchdog present");
  failures.forEach(function (line) {
    console.error("  - " + line);
  });
  process.exit(1);
}

console.log("OK no thumb-load watchdog in assets/js (" + files.length + " files scanned)");
