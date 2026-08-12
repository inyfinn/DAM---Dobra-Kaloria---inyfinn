/**
 * Regression: group cards use /thumb-cache (path), never data/thumbs JPG.
 */
const fs = require("fs");
const path = require("path");
const vizPath = path.join(__dirname, "..", "..", "assets", "js", "dam-viz.js");
const code = fs.readFileSync(vizPath, "utf8");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

if (code.indexOf("DamPreviewTruth.thumbCacheUrl") === -1) fail("missing thumbCacheUrl usage");
if (code.indexOf('return "data/thumbs/"') !== -1) fail("must not return data/thumbs paths");
if (code.indexOf("function cardThumbSrc") === -1) fail("missing cardThumbSrc");
console.log("OK group thumbs use /thumb-cache path, not legacy JPG");
