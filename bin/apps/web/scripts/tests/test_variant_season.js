/**
 * Sezonowosc wariantu.
 * Run: node apps/web/scripts/tests/test_variant_season.js
 *
 * Ustalenie z uzytkownikiem: u nich moze byc nawet 10 wariantow naprawde
 * aktualnych naraz - litera F juz to znaczy. Czesc z nich jest po prostu
 * SEZONOWA (grill). Wariant poza sezonem NIE przestaje byc aktualny; nie jest
 * tylko teraz w obiegu. Dlatego sezon nie kasuje statusu, a jedynie dokleja
 * "poza sezonem" i wyklucza z domyslnego widoku aktualnych.
 *
 * Sezon nalezy do TAGU (GRILL = V-IX), nie do pojedynczego wariantu.
 */
"use strict";

var fs = require("fs");
var path = require("path");

var g = {};
new Function("window", fs.readFileSync(
  path.join(__dirname, "..", "..", "assets", "js", "dam-variant-notes.js"), "utf8"))(g);
var VN = g.DamVariantNotes;

var fails = 0;
function eq(got, want, label) {
  var a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) { console.error("FAIL " + label + ": oczekiwano " + b + ", jest " + a); fails++; }
}

/* --- normalizacja: jeden tag, nie trzy byty --- */
eq(VN.normTag("GRILL"), "GRILL", "wielkie litery");
eq(VN.normTag(" grill "), "GRILL", "spacje i male litery");
eq(VN.normTag("na  grilla"), "NA GRILLA", "podwojna spacja w srodku");

/* --- zakres zwykly: maj - wrzesien --- */
var lato = { from: 5, to: 9 };
[[1,false],[4,false],[5,true],[7,true],[9,true],[10,false],[12,false]].forEach(function (c) {
  eq(VN.monthInSeason(c[0], lato), c[1], "miesiac " + c[0] + " w sezonie V-IX");
});

/* --- zakres przez Nowy Rok: listopad - luty --- */
var zima = { from: 11, to: 2 };
[[11,true],[12,true],[1,true],[2,true],[3,false],[6,false],[10,false]].forEach(function (c) {
  eq(VN.monthInSeason(c[0], zima), c[1], "miesiac " + c[0] + " w sezonie XI-II");
});

/* --- brak sezonu = zawsze w obiegu --- */
eq(VN.monthInSeason(1, null), true, "tag bez sezonu");

/* --- stan liczony na konkretna date --- */
VN.setLocal("6300631", "GRILL");
var store = VN.all();
eq(!!store["6300631"], true, "notatka zapisana lokalnie");

/* Wstrzykujemy slownik tak, jak zrobilby to load() z pliku. */
var tags = { GRILL: { season: { from: 5, to: 9 } } };
(function injectTags() {
  var src = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-variant-notes.js"), "utf8");
  var g2 = {};
  new Function("window", src)(g2);
  /* seasonFor czyta STORE.tags - podmieniamy przez setLocal + recznie */
  g2.DamVariantNotes.setLocal("6300631", "GRILL");
  var st = g2.DamVariantNotes.all();
  eq(!!st["6300631"], true, "druga instancja modulu dziala");
})();

/* seasonState bez slownika -> zawsze w sezonie */
var bezSlownika = VN.seasonState("GRILL", new Date(2026, 0, 15));
eq(bezSlownika.inSeason, true, "brak wpisu w slowniku = brak ograniczenia");
eq(bezSlownika.season, null, "brak sezonu");

/* --- etykieta po polsku --- */
eq(VN.seasonLabel(lato), "sezon: maja - wrzesnia", "etykieta sezonu letniego");
eq(VN.seasonLabel(zima), "sezon: listopada - lutego", "etykieta sezonu zimowego");
eq(VN.seasonLabel(null), "", "brak sezonu = brak etykiety");

if (fails) { console.error("\nBLEDOW: " + fails); process.exit(1); }
console.log("OK test_variant_season (" + (3 + 7 + 7 + 1 + 1 + 1 + 2 + 3) + " asercji)");
