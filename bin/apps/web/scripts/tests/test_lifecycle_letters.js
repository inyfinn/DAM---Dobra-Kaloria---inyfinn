/**
 * Litery cyklu zycia na folderze wariantu: F / D / X.
 * Run: node apps/web/scripts/tests/test_lifecycle_letters.js
 *
 * Zasady ustalone z uzytkownikiem:
 *  - jest chociaz JEDEN folder z F  -> domyslnie pokazujemy tylko te (ktos wybral),
 *  - nie ma zadnego F               -> pokazujemy WSZYSTKIE (segregacji nie zrobiono),
 *  - "Pokaz wszystkie"              -> zawsze wszystkie, nawet gdy F istnieje,
 *  - D = wersja robocza (szaro), X = do archiwum (czerwono + przycisk).
 *
 * Litera musi byc rozpoznana takze przy niechlujnym zapisie: "-F", "- F",
 * "--F", "_F", " F", z myslnikiem typograficznym. Wczesniejszy wzorzec
 * wymagal dokladnie " - F" i kazdy inny zapis byl po cichu ignorowany.
 */
"use strict";

var fs = require("fs");
var path = require("path");

var src = fs.readFileSync(
  path.join(__dirname, "..", "..", "assets", "js", "dam-explorer.js"), "utf8");

/* Wyciagamy sam parser - caly modul wymaga DOM. */
var m = src.match(/var LIFECYCLE_LETTER_RE = ([^\n]+);/);
if (!m) { console.error("FAIL: brak LIFECYCLE_LETTER_RE w dam-explorer.js"); process.exit(1); }
var RE = eval(m[1]);

function letterFromFolderName(pathOrName) {
  var nm = String(pathOrName || "").split(/[/\\]/).pop() || "";
  var hit = nm.match(RE);
  return hit ? hit[1].toUpperCase() : "";
}

var fails = 0;
function eq(got, want, label) {
  if (got !== want) {
    console.error("FAIL " + label + ": oczekiwano " + JSON.stringify(want) + ", jest " + JSON.stringify(got));
    fails++;
  }
}

/* --- niechlujne zapisy tej samej litery --- */
[
  ["MINI - 18 06 2026 - 6300782.00 - F", "F", "spacje wokol myslnika"],
  ["MINI - 18 06 2026 - 6300782.00 -F", "F", "bez spacji po myslniku"],
  ["MINI - 18 06 2026 - 6300782.00 --F", "F", "podwojny myslnik"],
  ["MINI - 18 06 2026 - 6300782.00_F", "F", "podkreslenie"],
  ["MINI - 18 06 2026 - 6300782.00 F", "F", "sama spacja"],
  ["MINI - 18 06 2026 - 6300782.00 – F", "F", "myslnik typograficzny"],
  ["MINI - 18 06 2026 - 6300782.00 - f", "F", "mala litera"],
  ["MINI - 18 06 2026 - 6300782.00 - F ", "F", "spacja na koncu"],
  ["DOY - 65 g - 24.02.2026 - 6300726.00 - D", "D", "demo"],
  ["DOY - 65 g - 24.02.2026 - 6300726.00 -X", "X", "do archiwum bez spacji"],
].forEach(function (c) { eq(letterFromFolderName(c[0]), c[1], c[2]); });

/* --- nie wolno wymyslac litery tam, gdzie jej nie ma --- */
[
  ["01.04.2025 - 6300631.00", "burger bez litery"],
  ["RĘKAW - 25.05.2026 - 6300755", "rekaw bez litery"],
  ["DOY - MAGNEZ & ŻELAZO - 65 g - 24.02.2026 - 6300753.00", "wyroznik, brak litery"],
  ["CZARNA PORZECZKA — [ owocowe ]", "nazwa produktu"],
  ["10.08.2026 – 6300810", "myslnik typograficzny, brak litery"],
].forEach(function (c) { eq(letterFromFolderName(c[0]), "", c[1]); });

/* --- sciezka, nie tylko nazwa --- */
eq(letterFromFolderName("D:/Marketing/PRODUKTY/BURGER/MINI - 6300782.00 - F"), "F", "pelna sciezka");

/* --- regula widocznosci --- */
function statusFromLetter(l) {
  return l === "F" ? "aktualne" : l === "X" ? "nieaktualne" : l === "D" ? "demo" : "clear";
}
function currentRevisions(folders) {
  var all = folders.map(function (f) { return { folder: f, st: statusFromLetter(letterFromFolderName(f)) }; });
  var finals = all.filter(function (r) { return r.st === "aktualne"; });
  return finals.length ? finals : all;
}

var burger = ["01.04.2025 - 6300631.00", "02.04.2025 - 6300631.00", "10.08.2026 – 6300810",
  "15.10.2024 - 6300569.00", "27.04.2023 - 6300342.00", "29.04.2024 - 6300473.00",
  "RĘKAW - 03.04.2025 - 6300631.00", "RĘKAW - 25.05.2026 - 6300755"];
eq(currentRevisions(burger).length, 8, "Burger bez zadnego F -> wszystkie osiem");

var zF = burger.concat(["RĘKAW - 01.01.2027 - 6300999.00 - F"]);
eq(currentRevisions(zF).length, 1, "pojawia sie jeden F -> tylko on");

var dwaF = zF.concat(["RĘKAW - 02.01.2027 - 6301000.00 -F"]);
eq(currentRevisions(dwaF).length, 2, "dwa F (rozny zapis) -> oba");

var zD = burger.concat(["RĘKAW - 01.01.2027 - 6300998.00 - D"]);
eq(currentRevisions(zD).length, 9, "samo D nie jest wyborem -> nadal wszystkie");

var zX = burger.concat(["RĘKAW - 01.01.2027 - 6300997.00 - X"]);
eq(currentRevisions(zX).length, 9, "X zostaje widoczny, zeby dalo sie go zarchiwizowac");

if (fails) { console.error("\nBLEDOW: " + fails); process.exit(1); }
console.log("OK test_lifecycle_letters (21 asercji)");
