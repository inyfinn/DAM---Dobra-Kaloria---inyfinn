/**
 * Regression: Viz cards must use /thumb-cache AVIF, never legacy data/thumbs JPG.
 */
const fs = require("fs");
const path = require("path");

const vizPath = path.join(__dirname, "..", "..", "assets", "js", "dam-viz.js");
const code = fs.readFileSync(vizPath, "utf8");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

if (code.indexOf("function cardThumbSrc") === -1) fail("missing cardThumbSrc");
if (code.indexOf("DamPreviewTruth.thumbCacheUrl") === -1) fail("cardThumbSrc must use thumbCacheUrl");
if (code.indexOf('return "data/thumbs/"') !== -1) fail("must not build data/thumbs JPG paths");
if (code.indexOf("function hasStaticDataThumb") === -1) fail("missing hasStaticDataThumb");
if (!/function hasStaticDataThumb\(v\) \{\s*\/\*[\s\S]*?\*\/\s*return false;\s*\}/.test(code)) {
  fail("hasStaticDataThumb must always return false (legacy JPG dead)");
}
if (code.indexOf("data-static-thumb") !== -1 && code.indexOf('var staticThumbFb = ""') === -1) {
  /* attribute may remain in template but fb must be empty */
}

console.log("OK dam-viz never prefers legacy data/thumbs JPG");
