/**
 * Static check: enrich / card thumbs never prefer legacy data/thumbs JPG.
 */
const fs = require("fs");
const path = require("path");
const vizPath = path.join(__dirname, "..", "..", "assets", "js", "dam-viz.js");
const code = fs.readFileSync(vizPath, "utf8");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

["function hasStaticDataThumb", "function cardThumbSrc", "DamPreviewTruth.thumbCacheUrl"].forEach(function (needle) {
  if (code.indexOf(needle) === -1) fail("missing " + needle);
});
if (code.indexOf('return "data/thumbs/"') !== -1) fail("legacy data/thumbs builder still present");
console.log("OK enrich/card contract: thumb-cache only (no static JPG)");
