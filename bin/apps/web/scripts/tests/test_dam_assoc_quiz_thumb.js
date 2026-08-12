/**
 * Regression: DamAssocQuiz must use /thumb-cache (profile=grid), never legacy /thumb?.
 * Run: node apps/web/scripts/tests/test_dam_assoc_quiz_thumb.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var jsPath = path.join(__dirname, "..", "..", "assets", "js", "dam-assoc-quiz.js");
var code = fs.readFileSync(jsPath, "utf8");

if (/\/thumb\?path=/.test(code)) {
  console.error("FAIL: dam-assoc-quiz.js still references legacy /thumb?path=");
  process.exit(1);
}
if (code.indexOf("/thumb-cache?") === -1) {
  console.error("FAIL: dam-assoc-quiz.js missing /thumb-cache?");
  process.exit(1);
}
if (
  code.indexOf('encodeURIComponent("grid")') === -1 &&
  code.indexOf("thumbCacheUrl(path, \"grid\")") === -1
) {
  console.error("FAIL: dam-assoc-quiz.js missing profile=grid contract");
  process.exit(1);
}
if (code.indexOf("encodeURIComponent(localPath(path))") === -1) {
  console.error("FAIL: dam-assoc-quiz.js fallback must encodeURIComponent path");
  process.exit(1);
}
if (code.indexOf("__damBrandingThumbFallback") === -1) {
  console.error("FAIL: dam-assoc-quiz.js missing existing thumb onerror fallback");
  process.exit(1);
}

var samplePath = "M:/Marketing/- POLSKA/campaign/a.png";
var url =
  "http://127.0.0.1:8766/thumb-cache?path=" +
  encodeURIComponent(samplePath) +
  "&profile=" +
  encodeURIComponent("grid");
if (url.indexOf("/thumb-cache?") === -1 || url.indexOf("profile=grid") === -1) {
  console.error("FAIL: URL contract broken", url);
  process.exit(1);
}

console.log("OK dam-assoc-quiz thumb uses /thumb-cache profile=grid");
