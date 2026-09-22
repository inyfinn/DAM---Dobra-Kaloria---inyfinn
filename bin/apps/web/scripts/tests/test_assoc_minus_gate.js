/**
 * Czerwony minus: jedno ustawienie rzadzi OBIEMA bramkami.
 * Run: node apps/web/scripts/tests/test_assoc_minus_gate.js
 *
 * Zgloszenie uzytkownika 2026-09-22:
 *   "jak przy usuwaniu wylaczylem potrzebe przytrzymywania i wtedy nie
 *    reagowalo na nic w ogole"
 *
 * Ustawienia -> "Bezpieczne usuwanie" obiecuje w opisie wprost:
 *   "Przyciski Usun wymagaja przytrzymania (~1 s). Wylaczenie = zwykly klik."
 * (bin/apps/web/settings.html)
 *
 * Kod tej obietnicy nie dotrzymywal. dam-danger.js jest POPRAWNY - jego
 * onPointerDown i onClickCapture sprawdzaja isSafeDeleteEnabled() i wychodza
 * wczesnie. Blokowala OSOBNA, bezwarunkowa bramka Shift w dam-assoc-edit.js:
 * przy kliku bez Shift robila preventDefault + stopImmediatePropagation na
 * pointerdown, co TLUMI pozniejsze zdarzenie click - wiec handler usuwania
 * (aktywny wlasnie dlatego, ze bezpieczne usuwanie bylo wylaczone) nigdy sie
 * nie odpalal. Jedyna reakcja to toast dlawiony do raz na 2,5 s, latwy do
 * przeoczenia przy serii klikniec. Stad "nie reagowalo na nic".
 *
 * Trzy niezmienniki pilnowane nizej sa dokladnie tymi, ktore byly zlamane.
 */
"use strict";

var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "..", "..", "assets", "js", "dam-assoc-edit.js");
var src = fs.readFileSync(SRC, "utf8");

var fails = 0;
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}

/* --- wytnij sama funkcje, zeby asercje nie lapaly przypadkiem innego kodu --- */
var start = src.indexOf("function wireQuickMinusControl(");
ok(start > -1, "wireQuickMinusControl istnieje w dam-assoc-edit.js");
if (start === -1) {
  console.error("\nBLEDOW: " + fails);
  process.exit(1);
}
var fn = src.slice(start, src.indexOf("\n  function bindShiftHoverHost", start));
ok(fn.length > 500, "udalo sie wyciac cialo funkcji (" + fn.length + " znakow)");

/* --- 1. Stan ustawienia czytany w CHWILI ZDARZENIA, nie przy tworzeniu --- */
ok(
  /function holdGateOn\(\)/.test(fn),
  "brak holdGateOn() - stan bezpiecznego usuwania musi byc funkcja, nie zmienna"
);
ok(
  !/if\s*\(\s*!global\.DamDanger\s*\|\|\s*!global\.DamDanger\.isSafeDeleteEnabled\(\)\s*\)/.test(fn),
  "regresja: handler kliku znowu rejestrowany warunkowo wg stanu z chwili TWORZENIA " +
    "przycisku - przelaczenie ustawienia w innej karcie nie zadziala bez przeladowania"
);

/* --- 2. Bramka Shift MUSI odpuscic, gdy bezpieczne usuwanie jest wylaczone --- */
/* Uwaga: "global.DamDanger.bind" wystepuje TEZ w warunku if() powyzej handlera,
   wiec granice bierzemy po wywolaniu z nawiasem, inaczej wycinek wychodzi pusty. */
var pd = fn.slice(fn.indexOf('"pointerdown"'), fn.indexOf("global.DamDanger.bind("));
ok(pd.length > 100, "wycinek handlera pointerdown niepusty (" + pd.length + " znakow)");
ok(pd.indexOf("holdGateOn()") > -1, "handler pointerdown nie sprawdza holdGateOn()");
ok(
  pd.indexOf("if (!holdGateOn()) return;") > -1,
  "brak wczesnego wyjscia przy wylaczonej bramce - to JEST ta linia, ktorej brakowalo"
);
/* Szukamy WYWOLANIA "e.preventDefault()", nie samego slowa - slowo wystepuje
   takze w komentarzu nad strazikiem i dawalo falszywy alarm. */
ok(
  pd.indexOf("if (!holdGateOn()) return;") < pd.indexOf("e.preventDefault()"),
  "wyjscie musi byc PRZED e.preventDefault(), inaczej klik dalej bedzie tlumiony"
);

/* --- 3. Handler kliku rejestrowany zawsze, ale bez podwojnego usuniecia --- */
var clickIdx = fn.lastIndexOf('addEventListener("click"');
ok(clickIdx > -1, "brak handlera click");
var clickBody = fn.slice(clickIdx);
ok(
  clickBody.indexOf("if (holdGateOn()) return;") > -1,
  "handler kliku musi wyjsc przy wlaczonej bramce - inaczej po potwierdzonym " +
    "przytrzymaniu DamDanger wywola onClick, klik przeleci dalej i skojarzenie " +
    "zniknie DWA RAZY"
);
ok(
  clickBody.indexOf("onClick()") > clickBody.indexOf("if (holdGateOn()) return;"),
  "onClick() musi byc PO wyjsciu dla wlaczonej bramki"
);

/* --- 4. Shift czytany ze zdarzenia (zatrzask gubi sie po blur okna) --- */
ok(
  /function shiftArmed\(e\)/.test(fn),
  "shiftArmed musi przyjmowac zdarzenie - zatrzasniety shiftKeyDown zeruje sie " +
    "po alt-tabie i po powrocie trzeba puscic i wcisnac Shift ponownie"
);
ok(
  /if \(e && e\.shiftKey\) return true;/.test(fn),
  "shiftArmed ma czytac e.shiftKey bezposrednio jako zrodlo prawdy"
);

/* --- 5. Podpowiedz nie moze klamac o trybie --- */
ok(/var tipPlain/.test(fn), "brak osobnej podpowiedzi dla trybu bez przytrzymania");
ok(
  /function syncTip\(\)/.test(fn),
  "podpowiedz musi sie odswiezac - inaczej zawsze mowi o Shifcie, takze gdy " +
    "bezpieczne usuwanie jest wylaczone"
);

/* --- 6. Bezpieczenstwo: usuniecie zostaje odwracalne --- */
ok(
  src.indexOf('actionLabel: "Cofnij"') > -1,
  "usuwanie skojarzen musi miec Cofnij - to ono pozwala odpuscic bramke Shift"
);

if (fails) {
  console.error("\nBLEDOW: " + fails);
  process.exit(1);
}
console.log("OK test_assoc_minus_gate (16 asercji)");
