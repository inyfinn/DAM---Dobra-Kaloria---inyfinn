/**
 * Static check: enrichVizRowFromProducts preserves data/thumbs on card.
 * Run: node apps/web/scripts/tests/test_enrich_preserves_data_thumbs.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var jsPath = path.join(__dirname, "..", "..", "assets", "js", "dam-viz.js");
var code = fs.readFileSync(jsPath, "utf8");

var required = [
  "function hasStaticDataThumb",
  "preserveCardThumb",
  "if (!preserveCardThumb)",
  "hasStaticDataThumb(v)",
  "split(/[?#]/)[0]",
];

required.forEach(function (needle) {
  if (code.indexOf(needle) === -1) {
    console.error("FAIL: dam-viz.js missing", needle);
    process.exit(1);
  }
});

console.log("OK enrich preserves static data/thumbs contract present");
