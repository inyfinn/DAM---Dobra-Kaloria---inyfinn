/**
 * Wyroznik wariantu: co program czyta z nazwy folderu.
 * Run: node apps/web/scripts/tests/test_variant_distinguisher.js
 *
 * Kontekst: Czarna Porzeczka ma dwa doypacki 65 g z ta sama data - rozni je
 * wylacznie czlon "MAGNEZ & ZELAZO". Burger Klasyczny ma osiem folderow
 * "DATA - INDEKS" i nie rozni ich nic. Parser ma wyciagnac pierwszy przypadek
 * i UCZCIWIE zwrocic pusto w drugim (wtedy opis dokleja recznie uzytkownik).
 *
 * Zasada: lepiej NIE pokazac wyroznika niz go zmyslic. Pierwsza wersja brala
 * "GB AR FR NL", "RĘKAW 180 g" i "KAR000147.00" za wyrozniki (42% rewizji).
 */
"use strict";

var fs = require("fs");
var path = require("path");

var jsPath = path.join(__dirname, "..", "..", "assets", "js", "dam-labels.js");
var g = {};
new Function("window", fs.readFileSync(jsPath, "utf8"))(g);
var DL = g.DamLabels;

var fails = 0;
function eq(got, want, label) {
  if (got !== want) {
    console.error("FAIL " + label + "\n  oczekiwano: " + JSON.stringify(want) + "\n  otrzymano : " + JSON.stringify(got));
    fails++;
  }
}

/* --- wyroznik JEST w nazwie folderu (konwencja: NOSNIK - WYROZNIK - GRAM - DATA - INDEKS) */
eq(DL.variantDistinguisherFromFolder("DOY - MAGNEZ & ŻELAZO - 65 g - 24.02.2026 - 6300753.00"),
   "MAGNEZ & ŻELAZO", "doypack z wyroznikiem");
eq(DL.variantDistinguisherFromFolder("DOY - HIGH PROTEIN - 44 g - 01.02.2026 - 6300900.00"),
   "HIGH PROTEIN", "high protein");

/* --- nazwa nic nie wnosi: ma byc PUSTO, nie zgadywanie */
[
  ["DOY - 65 g - 24.02.2026 - 6300726.00", "blizniaczy doypack bez wyroznika"],
  ["KAR6X - 20.05.2026  - PL EN - 6300783.00 - F", "karton 6x z jezykami"],
  ["MINI - 18 06 2026 - 6300782.00 - F", "mini baton"],
  ["01.04.2025 - 6300631.00", "burger: sama data i indeks"],
  ["RĘKAW - 25.05.2026 - 6300755", "rekaw bez .00"],
  ["10.08.2026 – 6300810", "myslnik typograficzny"],
].forEach(function (c) { eq(DL.variantDistinguisherFromFolder(c[0]), "", c[1]); });

/* --- falszywe trafienia z pierwszej wersji parsera */
[
  ["DOY - GB AR FR NL - 6300484.00", "kody jezykow to nie wyroznik"],
  ["RĘKAW 180 g - 01.01.2026 - 6300111.00", "nosnik + gramatura w jednym czlonie"],
  ["KAR000147.00", "nosnik sklejony z indeksem"],
  ["DOY - 6300XXX.00", "placeholder indeksu"],
  ["DOY - GB_SE_FI_DK_DE_000000.00", "jezyki i zera po podkresleniu"],
  ["DOY - ARCHIWUM - 6300222.00", "marker archiwum"],
  ["DOY - DD MM RRRR - 6300333.00", "placeholder daty"],
].forEach(function (c) { eq(DL.variantDistinguisherFromFolder(c[0]), "", c[1]); });

/* --- zrodlo wyroznika decyduje, jak UI go oznaczy */
var fromDisk = DL.variantDistinguisher({ folder: "DOY - MAGNEZ & ŻELAZO - 65 g - 24.02.2026 - 6300753.00" }, "nieuzyte");
eq(fromDisk.text, "MAGNEZ & ŻELAZO", "zrodlo folder: tekst");
eq(fromDisk.source, "folder", "nazwa folderu wygrywa z notatka");

var fromNote = DL.variantDistinguisher({ folder: "01.04.2025 - 6300631.00" }, function () { return "GRILL"; });
eq(fromNote.text, "GRILL", "zrodlo notatka: tekst");
eq(fromNote.source, "note", "pusta nazwa -> notatka z programu");

var none = DL.variantDistinguisher({ folder: "01.04.2025 - 6300631.00" }, function () { return ""; });
eq(none.text, "", "brak obu zrodel: tekst");
eq(none.source, "", "brak obu zrodel: source");

if (fails) { console.error("\nBLEDOW: " + fails); process.exit(1); }
console.log("OK test_variant_distinguisher (" + 22 + " asercji)");
