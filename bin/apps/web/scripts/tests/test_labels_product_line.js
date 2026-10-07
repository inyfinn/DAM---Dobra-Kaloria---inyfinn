/**
 * DamLabels.productLine: nazwa linii produktu z nawiasu w nazwie folderu.
 * Nowy spis: subcategory_label. Stary spis (puste pola): tekst nawiasu z p.name.
 * Run: node apps/web/scripts/tests/test_labels_product_line.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var sandbox = { window: {}, console: console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-labels.js"), "utf8"),
  sandbox
);
var DL = sandbox.window.DamLabels || sandbox.DamLabels;

var fails = 0;
function eq(got, want, msg) {
  if (JSON.stringify(got) === JSON.stringify(want)) return;
  fails += 1;
  console.error("FAIL: " + msg + " -> " + JSON.stringify(got) + ", oczekiwano " + JSON.stringify(want));
}

if (!DL || typeof DL.productLine !== "function") {
  console.error("FAIL: DamLabels.productLine nie jest wystawione");
  process.exit(1);
}

/* nowy spis: etykieta i slug z indeksera maja pierwszenstwo */
eq(
  DL.productLine({ name: "ARBUZ \u2014 [ z kreatyn\u0105 ]", subcategory_slug: "z kreatyna", subcategory_label: "Z kreatyn\u0105" }),
  { slug: "z kreatyna", label: "Z kreatyn\u0105" },
  "nowy spis"
);
/* stary spis: puste pola, dlugi myslnik i "\u0105" w nazwie folderu */
eq(
  DL.productLine({ name: "ARBUZ \u2014 [ z kreatyn\u0105 ]", subcategory_slug: "", subcategory_label: "" }),
  { slug: "z kreatyna", label: "Z kreatyn\u0105" },
  "stary spis: slug jak z indeksera (bez ogonka), etykieta z ogonkiem"
);
eq(DL.productLine({ name: "KARMEL - [ daktyle ]" }), { slug: "daktyle", label: "Daktyle" }, "zwykly myslnik");
eq(DL.productLine({ name: "DATE LIME \u2014 [ balls_raw ]" }).label, "Balls raw", "podkreslenie -> spacja");
/* wiersz wizualizacji na Pulpicie nie ma nazwy folderu produktu - nawias stoi w sciezce */
eq(
  DL.productLine({ name: "M:/- POLSKA/01 - PRODUKTY/- DK/02 - KULKI/MANGO-MARAKUJA \u2014 [ z kreatyn\u0105 ]/DOY - 65 g" }).label,
  "Z kreatyn\u0105",
  "nawias w sciezce"
);
eq(DL.productLine({ name: "TUBA 250 g" }), null, "produkt bez linii");
eq(DL.productLine({ name: "PUSTY \u2014 [ ]" }), null, "pusty nawias");
eq(DL.productLine(null), null, "brak produktu");

/* Slug zawsze ta sama normalizacja co indekser (build-file-index.py norm): klik w znacznik
   na starym spisie ma dac ten sam filtr co na nowym. */
eq(DL.lineSlug("Z Kreatyn\u0105"), "z kreatyna", "slug: ogonki i wielkie litery");
eq(DL.lineSlug("  plant-based /  BURGER_xl "), "plant based burger xl", "slug: myslnik, ukosnik, podkreslenie, spacje");
eq(DL.lineSlug("\u015aniadaniowe"), "sniadaniowe", "slug: S z kreska");
eq(DL.lineSlug("jab\u0142ko 0.5 l"), "jab ko 0.5 l", "slug: l z kreska staje sie spacja jak w indekserze, kropka zostaje");
eq(DL.lineSlug(""), "", "slug: pusty");
eq(DL.lineSlug(null), "", "slug: null");
eq(
  DL.productLine({ name: "X - [ \u015aNIADANIOWE ]" }),
  { slug: "sniadaniowe", label: "\u015aNIADANIOWE" },
  "stary spis: wielkie litery i ogonek w nawiasie"
);
eq(DL.productLine({ subcategory_label: "Niski IG", subcategory_slug: "" }).slug, "niski ig", "etykieta bez sluga: slug z etykiety");
eq(
  DL.productLine({ subcategory_label: "Z kreatyn\u0105", subcategory_slug: "Z Kreatyn\u0105" }).slug,
  "z kreatyna",
  "slug ze spisu tez przechodzi normalizacje"
);

/* Nawias-smiec nie jest linia (te same progi co indekser: > 40 znakow, sam numer, U+FFFD). */
var LONG41 = new Array(42).join("a");
eq(DL.productLine({ name: "X - [ " + LONG41 + " ]" }), null, "nawias 41 znakow: brak linii");
eq(DL.productLine({ name: "X - [ " + LONG41.slice(1) + " ]" }).label.length, 40, "nawias 40 znakow: jest linia");
eq(DL.productLine({ name: "X - [ 2024 ]" }), null, "sam numer w nawiasie");
eq(DL.productLine({ name: "X - [ 12 34 ]" }), null, "same cyfry ze spacja");
eq(DL.productLine({ name: "X - [ z kreatyn\ufffd ]" }), null, "uszkodzony bajt w nawiasie");
eq(
  DL.productLine({ name: "X - [ 2024 ] - [ " + LONG41 + " ] - [ daktyle ]" }),
  { slug: "daktyle", label: "Daktyle" },
  "smieciowe nawiasy pomijane, bierze pierwszy dobry"
);
eq(DL.productLine({ name: "X - [ 0.5 l ]" }), { slug: "0.5 l", label: "0.5 l" }, "liczba z jednostka to nie sam numer");
/* tytul karty zostaje bez nawiasu - linia idzie osobnym znacznikiem, nie w tytule */
eq(DL.cleanProductDisplayName("ARBUZ \u2014 [ z kreatyn\u0105 ]"), "Arbuz", "tytul bez nawiasu");

if (fails) process.exit(1);
console.log("OK labels productLine");
