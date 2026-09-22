/**
 * Opis wariantu -> TAGI (tokeny). Run: node apps/web/scripts/tests/test_note_tags.js
 *
 * Wymaganie uzytkownika (2026-09-22):
 *   "dodaj do TAGOW te tagi zwiazane z opisami, tylko je skracaj, jak tokeny.
 *    np. jesli opis to 'magnez, zelazo i blonnik', to tagow powinno byc 3.
 *    Magnez, zelazo, blonnik."
 *
 * Pulapka, ktorej ten test pilnuje: NIE wolno ciac po samej spacji.
 * "Witamina E" to jedna cecha, nie "Witamina" + "E"; "26 g bialka" to jedna
 * liczba, a nie trzy smieci. Tniemy tylko po separatorach listy i po
 * polskich spojnikach " i " / " oraz ".
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = path.join(__dirname, "..", "..", "assets", "js", "dam-variant-notes.js");
var sandbox = { window: {}, console: console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, "utf8"), sandbox);

var VN = sandbox.window.DamVariantNotes;
if (!VN || typeof VN.tokens !== "function") {
  console.error("FAIL: brak DamVariantNotes.tokens");
  process.exit(1);
}

var fails = 0;
function eq(got, want, label) {
  var a = JSON.stringify(got);
  var b = JSON.stringify(want);
  if (a !== b) {
    console.error("FAIL " + label + ":\n  oczekiwano " + b + "\n  jest       " + a);
    fails++;
  }
}
function ok(cond, label) {
  if (!cond) { console.error("FAIL " + label); fails++; }
}

/* --- przyklad wprost od uzytkownika --- */
eq(VN.tokens("magnez, żelazo i błonnik"), ["Magnez", "Żelazo", "Błonnik"],
   "przyklad z rozmowy: trzy tagi");

/* --- prawdziwe opisy z variant-notes.json --- */
eq(VN.tokens("Żelazo, Magnez, Witamina E"), ["Żelazo", "Magnez", "Witamina E"],
   "6300569 - 'Witamina E' zostaje calascia");
eq(VN.tokens("Żelazo, Magnez, Tiamina, 26 g białka"),
   ["Żelazo", "Magnez", "Tiamina", "26 g białka"],
   "6300473 - '26 g białka' to jeden token, nie trzy");
eq(VN.tokens("GRILL"), ["GRILL"], "6300631 - jeden token, wersaliki zostaja");

/* --- wyroznik z nazwy folderu --- */
eq(VN.tokens("MAGNEZ & ŻELAZO"), ["MAGNEZ", "ŻELAZO"], "ampersand tnie");
eq(VN.tokens("Doypack / 65 g"), ["Doypack", "65 g"], "ukosnik tnie");
eq(VN.tokens("Kakao · Orzech"), ["Kakao", "Orzech"], "srodkowa kropka tnie");
/* Celowo: pojedyncza litera po cieciu to zwykle resztka po separatorze
   ("Magnez, , E"), nie cecha produktu. "Witamina E" przechodzi calascia,
   bo spacja NIE tnie - patrz asercje nizej. */
eq(VN.tokens("Kakao, E"), ["Kakao"], "pojedyncza litera odrzucona jako resztka");
eq(VN.tokens("sól oraz pieprz"), ["Sól", "Pieprz"], "spojnik 'oraz' tnie");

/* --- NIE wolno ciac po spacji --- */
eq(VN.tokens("Witamina E"), ["Witamina E"], "sama spacja NIE tnie");
eq(VN.tokens("Nowa receptura bez cukru"), ["Nowa receptura bez cukru"],
   "zdanie zostaje jednym tagiem, nie rozsypuje sie na slowa");
/* "i" tylko jako osobne slowo - nie w srodku wyrazu */
eq(VN.tokens("Wiosna"), ["Wiosna"], "litera i wewnatrz slowa nie tnie");
eq(VN.tokens("mini i maxi"), ["Mini", "Maxi"], "'i' jako osobne slowo tnie");

/* --- porzadki --- */
eq(VN.tokens(""), [], "pusty opis");
eq(VN.tokens(null), [], "null");
eq(VN.tokens("   ,  ;  "), [], "same separatory");
eq(VN.tokens("Magnez, magnez, MAGNEZ"), ["Magnez"], "duplikaty po normalizacji znikaja");
eq(VN.tokens("Żelazo, itp."), ["Żelazo"], "'itp.' to nie cecha produktu");
eq(VN.tokens("Magnez."), ["Magnez"], "kropka na koncu obcieta");

/* --- dopasowanie do zapytania --- */
ok(VN.noteMatches("Żelazo, Magnez, Witamina E", "magnez"),
   "szukanie po pojedynczym tagu z opisu");
ok(VN.noteMatches("GRILL", "grill"), "wielkosc liter bez znaczenia");
ok(VN.noteMatches("Żelazo, Magnez", "zelazo"), "bez polskich znakow tez trafia");
ok(!VN.noteMatches("Żelazo, Magnez", "czekolada"), "nie trafia w nieswoje");
ok(!VN.noteMatches("Żelazo", ""), "puste zapytanie nie trafia we wszystko");

/* --- agregat do paska tagow --- */
ok(typeof VN.allTokens === "function", "allTokens istnieje");
ok(Array.isArray(VN.allTokens()), "allTokens zwraca liste nawet bez wczytanych opisow");

if (fails) {
  console.error("\nBLEDOW: " + fails);
  process.exit(1);
}
console.log("OK test_note_tags (26 asercji)");
