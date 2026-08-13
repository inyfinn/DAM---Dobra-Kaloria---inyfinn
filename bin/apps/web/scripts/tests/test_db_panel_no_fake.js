/**
 * Panel bazy: brak checkboxow GitHub-jako-silnik; savePrefer z Authorization.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../../assets/js/dam-db-status.js");
const code = fs.readFileSync(root, "utf8");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

if (code.indexOf('data-source="') !== -1) {
  fail("panel must not use data-source checkboxes for fake engines");
}
if (code.indexOf("damDbPullDump") === -1) {
  fail("missing Pobierz dump button id");
}
if (code.indexOf("Kopia zapasowa") === -1) {
  fail("GitHub must be labeled as backup dump, not live engine");
}
if (code.indexOf("authHeaders()") === -1) {
  fail("savePrefer must use authHeaders");
}
const saveIdx = code.indexOf("function savePreferFromPanel");
const saveSlice = code.slice(saveIdx, saveIdx + 800);
if (saveSlice.indexOf("authHeaders()") === -1) {
  fail("savePreferFromPanel body must call authHeaders()");
}
if (saveSlice.indexOf('"Content-Type": "application/json"') !== -1 && saveSlice.indexOf("authHeaders()") === -1) {
  fail("bare Content-Type without auth");
}
if (code.indexOf("admina") === -1) {
  fail("must toast on admin_required");
}
if (code.indexOf("_draftMode || prefer.mode") === -1) {
  fail("status poll must preserve the unsaved radio selection");
}
if (code.indexOf('_draftMode = radio.value') === -1) {
  fail("radio change must store the pending engine mode");
}
console.log("OK dam-db-status panel: real engine modes + auth dump");
