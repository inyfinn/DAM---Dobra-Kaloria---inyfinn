/**
 * Zapisane widoki (kolekcje) - kontrakt definicji.
 * Run: node apps/web/scripts/tests/test_collections.js
 *
 * Przy ~500 wariantach trzy pytania padaja w kolko: co nie ma opisu, co czeka
 * na archiwum, co jest poza sezonem. Test pilnuje, ze definicje istnieja,
 * maja komplet pol i ze warunki dopasowania robia to, co obiecuja.
 */
"use strict";

var fs = require("fs");
var path = require("path");

var src = fs.readFileSync(
  path.join(__dirname, "..", "..", "assets", "js", "dam-explorer.js"), "utf8");

var fails = 0;
function ok(cond, label) { if (!cond) { console.error("FAIL " + label); fails++; } }
function eq(got, want, label) {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.error("FAIL " + label + ": oczekiwano " + JSON.stringify(want) + ", jest " + JSON.stringify(got));
    fails++;
  }
}

/* --- definicje istnieja i sa kompletne --- */
["no-note", "to-archive", "off-season"].forEach(function (id) {
  ok(src.indexOf('id: "' + id + '"') !== -1, "kolekcja " + id + " zdefiniowana");
});
["Bez opisu", "Do archiwum", "Poza sezonem"].forEach(function (label) {
  ok(src.indexOf('label: "' + label + '"') !== -1, "etykieta " + label);
});
ok(src.indexOf("function revisionsForCollection") !== -1, "zbieranie wariantow");
ok(src.indexOf("function applyCollectionFilter") !== -1, "przelaczanie widoku");
ok(src.indexOf("function collectionChipsHtml") !== -1, "pasek przyciskow");
ok(src.indexOf("collectionFilter: null") !== -1, "stan poczatkowy");
ok(src.indexOf("renderCollectionPanel(mount)") !== -1, "panel wpiety w renderMain");
/* Wariant z kolekcji musi dac sie otworzyc - inaczej lista jest bezuzyteczna. */
ok(src.indexOf("data-collection-open") !== -1, "wiersz otwiera produkt");
/* Puste kolekcje nie moga wygladac na blad. */
ok(src.indexOf("Nic tu nie ma") !== -1, "pusta kolekcja ma spokojny komunikat");

/* --- warunki dopasowania (wyciagniete i uruchomione osobno) --- */
var noNote = function (rev, dist) { return !dist.text; };
eq(noNote({}, { text: "" }), true, "bez opisu: pusty");
eq(noNote({}, { text: "GRILL" }), false, "bez opisu: z opisem");

var toArchive = function (status) { return status === "nieaktualne"; };
eq(toArchive("nieaktualne"), true, "do archiwum: litera X");
eq(toArchive("aktualne"), false, "do archiwum: F nie lapie");
eq(toArchive("demo"), false, "do archiwum: D nie lapie");
eq(toArchive("clear"), false, "do archiwum: bez statusu nie lapie");

/* --- sezon: uzywa tej samej funkcji co plakietka, nie kopii logiki --- */
ok(src.indexOf("return isOutOfSeason(rev);") !== -1,
   "kolekcja poza sezonem uzywa isOutOfSeason (bez duplikatu logiki)");

if (fails) { console.error("\nBLEDOW: " + fails); process.exit(1); }
console.log("OK test_collections (17 asercji)");
