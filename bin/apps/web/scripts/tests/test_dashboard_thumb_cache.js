/**
 * Regression: dashboard cards use /thumb-cache, never legacy data/thumbs JPG,
 * and do not force DAM_DISABLE_THUMB_WARM.
 */
const fs = require("fs");
const path = require("path");

const jsDir = path.join(__dirname, "..", "..", "assets", "js");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const dash = fs.readFileSync(path.join(jsDir, "dam-dashboard.js"), "utf8");
if (/DAM_DISABLE_THUMB_WARM\s*=\s*true/.test(dash)) {
  fail("dam-dashboard.js must not disable thumb-cache");
}

const widgets = fs.readFileSync(path.join(jsDir, "dam-dashboard-widgets.js"), "utf8");
if (widgets.indexOf("function cardThumbUrl") === -1) fail("missing cardThumbUrl");
if (widgets.indexOf("DamPreviewTruth.thumbCacheUrl") === -1) {
  fail("widgets must call thumbCacheUrl");
}
if (widgets.indexOf("data/thumbs/") !== -1) fail("must not use data/thumbs JPG");
if (widgets.indexOf("projects_in_progress") === -1) fail("missing third stat panel");

const truth = fs.readFileSync(path.join(jsDir, "dam-preview-truth.js"), "utf8");
if (truth.indexOf("/thumb-cache?path=") === -1) fail("preview-truth missing /thumb-cache");
if (truth.indexOf("mediaPreviewUrl") === -1) fail("missing mediaPreviewUrl fallback");

const branding = fs.readFileSync(path.join(jsDir, "dam-branding.js"), "utf8");
if (branding.indexOf("var bootStarted = false") === -1) fail("branding boot must be single-shot");
if (branding.indexOf("First paint already happened from head") === -1) {
  fail("hydrate must skip second grid paint");
}

console.log("OK dashboard thumbs cache-first; branding single boot; WIP panel present");
