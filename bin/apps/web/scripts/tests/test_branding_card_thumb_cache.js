/**
 * Regression: branding grid cards use /thumb-cache (card profile), never DamMediaPreview.previewUrl (/media).
 */
const fs = require("fs");
const path = require("path");

const jsDir = path.join(__dirname, "..", "..", "assets", "js");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const branding = fs.readFileSync(path.join(jsDir, "dam-branding.js"), "utf8");
if (branding.indexOf("function cardThumbSrc") === -1) fail("missing cardThumbSrc");
if (branding.indexOf("DamPreviewTruth.thumbCacheUrl") === -1) {
  fail("cardThumbSrc must call thumbCacheUrl");
}
if (/DamMediaPreview\.previewUrl/.test(branding)) {
  fail("dam-branding.js must not call DamMediaPreview.previewUrl on cards");
}
if (branding.indexOf('bindBrandingGridDelegation') === -1) {
  fail('bindBrandingGridDelegation required for grid click delegation');
}
if (branding.indexOf("pickThumbAsset") === -1) fail("missing pickThumbAsset");
if (branding.indexOf("thumbPathForAsset") === -1) fail("missing thumbPathForAsset");
if (branding.indexOf(".pdf$/i.test(thumbPath)") === -1) fail("thumbHtml must handle PDF raster img");
if (branding.indexOf('function brandingIndexFingerprint') === -1) {
  fail('brandingIndexFingerprint required for openModal cache');
}

const preview = fs.readFileSync(path.join(jsDir, "dam-media-preview.js"), "utf8");
if (preview.indexOf("thumbCacheUrl(a.path, \"modal\")") === -1) {
  fail("heroSrcFromAsset must prefer thumb-cache modal profile");
}
const heroBlock = preview.slice(
  preview.indexOf("function heroSrcFromAsset"),
  preview.indexOf("function previewUrl")
);
if (heroBlock.indexOf("previewUrl(a.path") < heroBlock.indexOf("thumbCacheUrl")) {
  fail("heroSrcFromAsset must use thumb-cache before previewUrl");
}

console.log("OK branding cards thumb-cache-first; modal hero cache-first");
