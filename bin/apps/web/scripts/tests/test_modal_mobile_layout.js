/**
 * Uklad okien podgladu materialu (#damMediaPreview) i produktu (#damVizModal) na
 * telefonie i dotyku (2.4.2) - kontrakt CSS w dam-viz-modal.css.
 * Run: node apps/web/scripts/tests/test_modal_mobile_layout.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var WEB = path.join(__dirname, "..", "..");
var css = fs.readFileSync(path.join(WEB, "assets", "css", "dam-viz-modal.css"), "utf8").replace(/\r\n/g, "\n");
var noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

var fails = 0;
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}
function block(query) {
  var i = noComments.indexOf(query);
  if (i < 0) return "";
  var depth = 0;
  for (var j = noComments.indexOf("{", i); j < noComments.length; j++) {
    if (noComments[j] === "{") depth++;
    else if (noComments[j] === "}") {
      depth--;
      if (!depth) return noComments.slice(i, j + 1);
    }
  }
  return "";
}

var coarse = block("@media (pointer: coarse)");
ok(/#damVizModal \.dam-viz-modal__actions button:not\(#dam-touch-target\)/.test(coarse), "dotyk: przyciski stopki okna produktu");
ok(/#damMediaPreview \.dam-viz-modal__actions button:not\(#dam-touch-target\)/.test(coarse), "dotyk: przyciski stopki podgladu materialu");
ok(/min-height: var\(--dam-control-h\) !important/.test(coarse) && /min-width: var\(--dam-control-h\) !important/.test(coarse), "dotyk: 44x44 z tokenu --dam-control-h");
ok(!/geex-btn--sm\s*\{/.test(coarse), "dotyk: bez globalnego .geex-btn--sm");

var stack = noComments.slice(noComments.indexOf("@media (max-width: 767px) {\n  #damVizModal .dam-viz-modal-box--assoc-split,"));
stack = block("@media (max-width: 767px) {\n  #damVizModal .dam-viz-modal-box--assoc-split,");
ok(/overflow-y: auto/.test(stack), "telefon: pudelko okna przewija sie (bylo overflow hidden z dam-branding.css)");
ok(/#damMediaPreview \.dam-viz-modal-box--assoc-split \.dam-viz-modal__thumb \{[^}]*flex: 0 0 auto/.test(stack), "telefon: miniatura podgladu nie jest sciskana (hero caly widoczny)");
ok(/\.dam-viz-modal__body \{[^}]*overflow: visible !important/.test(stack), "telefon: bez drugiego, zagniezdzonego przewijania w __body");

var phone = block("@media (max-width: 720px) {\n  #damVizModal .dam-viz-modal-box--assoc-split > .dam-viz-modal__main");
ok(/display: contents/.test(phone), "telefon: __main display: contents (stopka na poziomie pudelka)");
ok(/order: 99/.test(phone) && /position: sticky/.test(phone) && /bottom: 0/.test(phone), "telefon: stopka ostatnia i przypieta do dolu przez cale przewijanie");
ok(/background: var\(--dam-surface\)/.test(phone), "telefon: tlo stopki z tokenu");
ok(/\.dam-viz-modal__thumb:has\(> \.dam-cache-origin\)/.test(phone), "telefon: miejsce nad obrazem na znacznik pamieci podrecznej");
ok(/\.dam-cache-origin__badge,[\s\S]*?font-size: 0/.test(phone), "telefon: znacznik jako sama ikona (tekst zostaje dla czytnika)");
ok(/body:has\(#damMediaPreview\) #damJobToast/.test(phone), "telefon: dymek zadania nie zaslania stopki otwartego okna");

ok(/#damMediaPreview \.dam-media-preview__source-mount:empty/.test(noComments), "pusty kontener PSD/PSB nie dodaje drugiego odstepu");
ok(!/#[0-9a-fA-F]{3,8}\b/.test(coarse + stack + phone), "bez surowego hex w nowych regulach");

var html = ["explorer.html", "visualizations.html"].map(function (f) {
  return fs.readFileSync(path.join(WEB, f), "utf8");
});
html.forEach(function (h, i) {
  ok(h.indexOf("dam-viz-modal.css?v=2.4.2") > 0, ["explorer.html", "visualizations.html"][i] + ": dam-viz-modal.css?v=2.4.2");
});

if (fails) {
  console.error("\n" + fails + " FAIL");
  process.exit(1);
}
console.log("OK test_modal_mobile_layout.js");
