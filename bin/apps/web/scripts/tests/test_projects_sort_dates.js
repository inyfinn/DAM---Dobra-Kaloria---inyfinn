/**
 * Sortowanie strony Projekty (dam-projects.js), 07.10.2026:
 *  - "Wprowadzenie": folder "doy_65g_2026_08_31" byl czytany jako 26.08.2031, wiec Figa z makiem
 *    i Mielone wolowe staly zawsze na gorze. Teraz RRRR-MM-DD przed DD.MM.RRRR, granice, brak dat
 *    dalszych niz rok w przyszlosc; data ze spisu (rev.date) wygrywa z nazwa folderu.
 *  - "Modyfikacja": spis bez pol mtime produktu/wariantu dawal 0 dla wszystkich (kolejnosc
 *    alfabetyczna). Teraz zapasowo najnowszy plik z files_by_role.
 * Run: node apps/web/scripts/tests/test_projects_sort_dates.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-projects.js"), "utf8").replace(/\r\n/g, "\n");
var NAMES = ["ymdScore", "parseFolderDateScore", "revisionDateScore", "projectDateScore", "takeTimeMs", "projectMtimeMs"];
var code = "var state = { metaById: {} };\nfunction rawProduct(p) { return p.raw || null; }\n";
NAMES.forEach(function (name) {
  var m = SRC.match(new RegExp("\\n  function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}\\n"));
  if (!m) {
    console.error("FAIL dam-projects.js ma funkcje " + name);
    process.exit(1);
  }
  code += m[0] + "this." + name + " = " + name + ";\n";
});
var ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);

var fails = 0;
var count = 0;
function eq(got, want, label) {
  count++;
  if (got !== want) {
    console.error("FAIL " + label + ": " + got + " != " + want);
    fails++;
  }
}

var f = ctx.parseFolderDateScore;
eq(f("doy_65g_2026_08_31 - 6300808"), 20260831, "RRRR_MM_DD (bylo 20310826)");
eq(f("RĘKAW_2026_07_21-6300406.01"), 20260721, "RRRR_MM_DD przed indeksem");
eq(f("RĘKAW_2026_07_31_6300798"), 20260731, "RRRR_MM_DD_indeks");
eq(f("KAR6X - 2026-07-15 - 6300602.01"), 20260715, "RRRR-MM-DD");
eq(f("RĘKAW – 2026.08.19 - 6300791"), 20260819, "RRRR.MM.DD");
eq(f("2025 10 30 - 6300699.01 - GB DE"), 20251030, "RRRR MM DD");
eq(f("KAR6X - 05.05.2026 - 6300684.00"), 20260505, "DD.MM.RRRR");
eq(f("MINI - 18 06 2026 - 6300784.00 - F"), 20260618, "DD MM RRRR");
eq(f("RĘKAW - 17_09_2026 - 6300822"), 20260917, "DD_MM_RRRR");
eq(f("DOY - 3.07.2026 - PL UA - 6300699.01"), 20260703, "D.MM.RRRR");
eq(f("BIGPAK - 08-04-2021"), 20210408, "DD-MM-RRRR");
eq(f("DOYPACK - 03.26"), 20260300, "MM.RR bez dnia");
eq(f("RĘKAW - 6300791.00"), 0, "sam indeks nie jest data");
eq(f("_merged_duplicate_DOY_-_MAGNEZ_-_65_g_-_24.02.2026_-_6300727.02_20260717-161510"), 20260224, "znacznik czasu po indeksie nie jest data");
eq(f("KAR6X - 45.13.2026 - 6300001.00"), 0, "niemozliwy miesiac/dzien");
var farYear = new Date().getFullYear() + 2;
eq(f("KAR6X - 01.02." + farYear + " - 6300001.00"), 0, "data dalsza niz rok w przyszlosc");
eq(f("KAR6X - " + farYear + "-02-01 - 6300001.00"), 0, "RRRR-MM-DD dalsze niz rok w przyszlosc");

var d = ctx.projectDateScore;
eq(d({ id: "a", raw: { revisions: [{ date: "2026-05-05", folder: "doy_65g_2026_08_31" }] } }), 20260505, "rev.date wygrywa z nazwa folderu");
eq(d({ id: "b", raw: { revisions: [{ folder: "doy_65g_2026_08_31 - 6300808" }, { date: "2025-01-24", folder: "MINI - 24.01.2025" }] } }), 20260831, "najnowszy wariant, folder gdy brak rev.date");
eq(d({ id: "c", path: "M:/x/_merged_24.02.2026_x", raw: { revisions: [{ folder: "0 - ARCHIVE" }] } }), 20260224, "bez dat w wariantach: sciezka produktu");
/* Przypadki z zywego spisu (07.10.2026): zepsute rev.date nie moze wygrac ani wywrocic sortu. */
eq(d({ id: "e", raw: { revisions: [{ date: "2025-04-48", folder: "RĘKAW - 48.04.2025 - 6300647.00" }] } }), 0, "niemozliwe rev.date i folder: 0, nie NaN");
eq(d({ id: "f", raw: { revisions: [{ date: "2031-08-26", folder: "doy_65g_2026_08_31 - 6300808" }] } }), 20260831, "rev.date z przyszlosci (stary spis): liczy sie folder");
eq(d({ id: "g", raw: { revisions: [{ date: "2026-04-22", folder: "2026 04-24 - 22.04.2026 - 6300XXX.00" }] } }), 20260422, "dwie daty w folderze: wygrywa rev.date");
eq(f("ETY - DD MM RRRR - 6300XXX.00"), 0, "szablon nazwy bez cyfr daty");

var t = ctx.projectMtimeMs;
var oldIndex = { id: "o", raw: { revisions: [
  { files_by_role: { viz: [{ mtime: "2025-09-05T10:26:00" }], print_pdf: [{ mtime: "2026-10-06T00:01:57" }] } },
  { files_by_role: { artwork: [{ mtime: "2024-01-01T00:00:00" }] } },
] } };
eq(t(oldIndex), Date.parse("2026-10-06T00:01:57"), "stary spis: najnowszy plik z files_by_role");
eq(t({ id: "n", raw: { mtime: "2026-03-01T12:00:00", revisions: [{ mtime: "2026-03-01T12:00:00", files_by_role: { viz: [{ mtime: "2030-01-01T00:00:00" }] } }] } }),
  Date.parse("2026-03-01T12:00:00"), "nowy spis: pole mtime produktu/wariantu, bez chodzenia po plikach");
eq(t({ id: "z", raw: { revisions: [{ files_by_role: {} }] } }), 0, "brak plikow: 0");

if (fails) process.exit(1);
console.log("OK test_projects_sort_dates: " + count + " asercji");
