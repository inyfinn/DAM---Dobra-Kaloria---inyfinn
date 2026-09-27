/**
 * Faza 3 (2026-09-27): kafelek wariantu w oknie podgladu nie moze zostac na
 * zaslepce do konca sesji. Bez ROOT most dociaga miniature z NAS chwile pozniej;
 * zaslepka ma sie zarejestrowac w DamPreviewTruth.retryPlaceholderLater i po
 * udanym /thumb-cache wrocic do obrazka.
 * Run: node apps/web/scripts/tests/test_thumb_variant_placeholder_revive.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var assert = require("assert");

var code = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-media-preview.js"), "utf8");
var start = code.indexOf("window.__damVariantThumbFallback = function");
assert.ok(start > 0, "brak __damVariantThumbFallback");
var end = code.indexOf("\n    };", start);
var src = code.slice(start, end + 7);

function el(tag) {
  var node = {
    tag: tag,
    attrs: {},
    dataset: {},
    isConnected: true,
    parentNode: {},
    getAttribute: function (k) {
      return this.attrs[k] || null;
    },
    replaceWith: function (other) {
      this.isConnected = false;
      other.isConnected = true;
      other.parentNode = {};
      state.shown = other;
    },
  };
  return node;
}

var state = { shown: null, revive: null };
var window = {
  DamPreviewTruth: {
    retryPlaceholderLater: function (ph, p, profile, onReady) {
      state.revive = { ph: ph, path: p, profile: profile, onReady: onReady };
    },
  },
};
var document = { createElement: el };
function previewUrl(p) {
  return "http://127.0.0.1:8766/media?path=" + encodeURIComponent(p);
}
new Function("window", "document", "previewUrl", src)(window, document, previewUrl);

var img = el("img");
img.attrs["data-path"] = "X:/Marketing/- POLSKA/a.png";
img.attrs.alt = "a.png";
state.shown = img;

window.__damVariantThumbFallback(img); // 1. blad /thumb-cache -> /media
assert.ok(/\/media\?/.test(img.src), "najpierw proba /media");
window.__damVariantThumbFallback(img); // 2. blad /media -> zaslepka
assert.notStrictEqual(state.shown, img, "zaslepka zamiast obrazka");
assert.ok(state.revive, "zaslepka zarejestrowana do ponownej proby");
assert.strictEqual(state.revive.path, "X:/Marketing/- POLSKA/a.png");
assert.strictEqual(state.revive.profile, "grid");

state.revive.onReady("http://127.0.0.1:8766/thumb-cache?path=a&profile=grid&_rv=1");
assert.strictEqual(state.shown, img, "po udanym /thumb-cache wraca obrazek");
assert.ok(/thumb-cache/.test(img.src));
assert.ok(!img.dataset.fallbackTried, "kolejny blad znow probuje /media, nie od razu zaslepka");

console.log("OK variant placeholder revive");
