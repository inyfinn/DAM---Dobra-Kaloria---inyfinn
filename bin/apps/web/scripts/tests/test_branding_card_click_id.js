/**
 * Regression: branding card click must open modal for the clicked asset id (not group primary).
 * Show-indexes must stopPropagation and expand inline (is-expanded), not open modal.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const jsPath = path.join(root, "assets", "js", "dam-branding.js");
const cssPath = path.join(root, "assets", "css", "dam-branding.css");
const htmlPath = path.join(root, "branding.html");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const js = fs.readFileSync(jsPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const html = fs.readFileSync(htmlPath, "utf8");

if (js.indexOf("function openCardModalFromEl(card, clickId)") === -1) {
  fail("openCardModalFromEl must accept clickId");
}
if (js.indexOf("function resolveBrandingClickId") === -1) {
  fail("resolveBrandingClickId required for marketing-id cards");
}
if (!/previewBtn\.getAttribute\("data-id"\)/.test(js)) {
  fail("preview click must use previewBtn data-id");
}
if (js.indexOf('.dam-viz-card__show-indexes")) return') === -1) {
  fail("grid delegation must ignore show-indexes clicks");
}
if (js.indexOf("is-expanded") === -1) {
  fail("show-indexes must toggle is-expanded");
}
if (!/cardStub && cardStub\.id === id/.test(js)) {
  fail("buildModalPayload must honor requested id via cardStub");
}
if (css.indexOf(".dam-viz-card__indexes-anchor.is-expanded .dam-viz-card__indexes-wrap") === -1) {
  fail("CSS must show indexes-wrap when anchor is-expanded");
}
// Nie usztywniamy konkretnego numeru wersji (stary schemat "5.0.x" jest
// porzucony, projekt jest teraz na dotted-integer typu 2.3.0 - patrz
// bin/apps/desktop/runtime_config.py). Pilnujemy za to prawdziwej rzeczy:
// zeby JS i CSS brandingu mialy TEN SAM cache-bust "?v=", zeby kazdy bump
// jednego bez drugiego byl widoczny jako regresja.
var jsVerMatch = html.match(/dam-branding\.js\?v=([^"'\s]+)/);
var cssVerMatch = html.match(/dam-branding\.css\?v=([^"'\s]+)/);
if (!jsVerMatch) {
  fail("branding.html must cache-bust dam-branding.js with ?v=");
}
if (!cssVerMatch) {
  fail("branding.html must cache-bust dam-branding.css with ?v=");
}
if (jsVerMatch[1] !== cssVerMatch[1]) {
  fail(
    "branding.html cache-bust mismatch: dam-branding.js?v=" +
      jsVerMatch[1] +
      " vs dam-branding.css?v=" +
      cssVerMatch[1] +
      " (must be the same ?v= on every bump)"
  );
}

console.log("OK branding click-id parity + show-indexes expand");
