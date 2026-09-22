/**
 * Brak litery F != jeden wariant. Regresja z 2026-09-22.
 * Run: node apps/web/scripts/tests/test_carrier_cards_no_final.js
 *
 * Objaw zgloszony przez uzytkownika:
 *   BURGER KLASYCZNY nie ma ANI JEDNEGO folderu z "-F" (sprawdzone na
 *   file-index.json: 0 z 8 rewizji), a Eksplorator przy "Pokaz wszystkie" = OFF
 *   pokazywal JEDEN rekaw zamiast osmiu.
 *
 * Regula (ta sama od poczatku, patrz test_lifecycle_letters.js):
 *   - grupa nosnika ma chocby JEDEN folder z F -> pokazujemy tylko te z F,
 *   - zadnego F -> pokazujemy WSZYSTKIE.
 *
 * Przyczyna NIE byla w danych: getCurrentRevisions juz zwracalo komplet osmiu.
 * Zwijal je RENDER - jedna karta na grupe nosnika, budowana z current[0],
 * a pozostale siedem szlo do extraCurrHtml, ktore rysuje sie dopiero po
 * rozwinieciu karty. Dlatego ten test pilnuje WIDOKU, nie parsera liter.
 */
"use strict";

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "..", "..", "assets", "js", "dam-explorer.js");
var src = fs.readFileSync(SRC, "utf8");

var fails = 0;
function eq(got, want, label) {
  if (got !== want) {
    console.error("FAIL " + label + ": oczekiwano " + JSON.stringify(want) + ", jest " + JSON.stringify(got));
    fails++;
  }
}
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}

/* --- wyciagamy sama funkcje; caly modul wymaga DOM --- */
var m = src.match(/function carrierEntriesForCards\(groups, pick, flatten\) \{[\s\S]*?\n  \}/);
if (!m) {
  console.error("FAIL: brak carrierEntriesForCards w dam-explorer.js");
  process.exit(1);
}
var carrierEntriesForCards = eval("(" + m[0] + ")");

/* --- atrapy: tylko to, czego funkcja naprawde uzywa --- */
function flatten(revs) {
  return revs.slice().sort(function (a, b) {
    return String(b.folder || "").localeCompare(String(a.folder || ""));
  });
}
function pickFrom(hasFinalFolders) {
  /* odwzorowuje pickCarrierDisplay(..., false): F wygrywa, inaczej wszystko */
  return function (revisions) {
    var all = revisions || [];
    if (!all.length) return null;
    var finals = all.filter(function (r) { return r.letter === "F"; });
    var hasFinal = finals.length > 0;
    var current = hasFinal ? finals : all;
    if (!current.length) return null;
    return { current: current, older: [], hasFinal: hasFinal };
  };
}
var pick = pickFrom();

function rev(folder, letter) {
  return { folder: folder, letter: letter || "" };
}

/* --- 1. Burger Klasyczny: osiem rekawow, zero F --- */
var burger = [
  {
    code: "REKAW",
    revisions: [
      rev("01.04.2025 - 6300631.00"),
      rev("02.04.2025 - 6300631.00"),
      rev("10.08.2026 – 6300810"),
      rev("15.10.2024 - 6300569.00"),
      rev("27.04.2023 - 6300342.00"),
      rev("29.04.2024 - 6300473.00"),
      rev("RĘKAW - 03.04.2025 - 6300631.00"),
      rev("RĘKAW - 25.05.2026 - 6300755"),
    ],
  },
];
var outBurger = carrierEntriesForCards(burger, pick, flatten);
eq(outBurger.length, 8, "zero F -> osiem kart, nie jedna");
ok(
  outBurger.every(function (e) { return e.hasFinal === false; }),
  "zero F -> hasFinal=false na kazdej karcie (etykieta nie moze klamac 'aktualne')"
);
ok(
  outBurger.every(function (e) { return e.flat === true; }),
  "wiele kart w grupie -> etykieta z nazwy folderu, inaczej osiem razy 'RĘKAW'"
);

/* --- 2. Pojawia sie jeden F -> tylko on --- */
var zJednymF = [
  { code: "REKAW", revisions: burger[0].revisions.concat([rev("RĘKAW - 01.01.2027 - 6300999.00 - F", "F")]) },
];
var outJedenF = carrierEntriesForCards(zJednymF, pick, flatten);
eq(outJedenF.length, 1, "jeden F -> tylko ten wariant");
eq(outJedenF[0].hasFinal, true, "jeden F -> hasFinal=true");
eq(outJedenF[0].flat, false, "pojedyncza karta -> zostaje etykieta nosnika");

/* --- 3. Dwa F -> oba widoczne (wczesniej drugi ladowal w extraCurrHtml) --- */
var zDwomaF = [
  {
    code: "REKAW",
    revisions: burger[0].revisions.concat([
      rev("RĘKAW - 01.01.2027 - 6300999.00 - F", "F"),
      rev("RĘKAW - 02.01.2027 - 6301000.00 -F", "F"),
    ]),
  },
];
eq(carrierEntriesForCards(zDwomaF, pick, flatten).length, 2, "dwa F -> dwie karty, nie jedna + ukryta");

/* --- 4. Kilka nosnikow: regula liczona OSOBNO dla kazdej grupy --- */
var mieszane = [
  { code: "REKAW", revisions: [rev("RĘKAW - a"), rev("RĘKAW - b"), rev("RĘKAW - c")] },
  { code: "DOY", revisions: [rev("DOY - a"), rev("DOY - b - F", "F")] },
];
var outMix = carrierEntriesForCards(mieszane, pick, flatten);
eq(outMix.length, 4, "REKAW bez F (3) + DOY z jednym F (1) = 4 karty");
eq(
  outMix.filter(function (e) { return e.code === "DOY"; }).length,
  1,
  "F w DOY nie moze filtrowac REKAWA i odwrotnie"
);
ok(
  outMix.some(function (e) { return !e.hasFinal; }),
  "mieszane -> etykieta musi przyznac, ze czesc grup nie ma F"
);

/* --- 5. Pusta grupa nie tworzy karty-widma --- */
eq(carrierEntriesForCards([{ code: "REKAW", revisions: [] }], pick, flatten).length, 0, "pusta grupa -> zero kart");
eq(carrierEntriesForCards(null, pick, flatten).length, 0, "brak grup -> zero kart");

/* --- 6. Strukturalnie: render OFF nie moze wrocic do jednej karty na grupe --- */
ok(
  src.indexOf("renderCarrierCard(g.code, picked.current, picked.older") === -1,
  "render OFF znowu zwija cala grupe do jednej karty (regresja)"
);
ok(
  /offEntries\.forEach\(function \(e\) \{[\s\S]{0,400}renderCarrierCard\(\s*e\.code,\s*\[e\.rev\]/.test(src),
  "render OFF musi rysowac po jednej karcie na wariant"
);

if (fails) {
  console.error("\nBLEDOW: " + fails);
  process.exit(1);
}
console.log("OK test_carrier_cards_no_final (16 asercji)");
