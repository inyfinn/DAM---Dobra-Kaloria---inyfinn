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
  fail("status poll must preserve the unsaved selection");
}
// UI zostalo przeprojektowane w 0526d704 z radio+"Zastosuj" na klikalne
// karty (.dam-db-source[data-dam-db-mode]) - applyMode() jest teraz
// jedynym miejscem, ktore ustawia _draftMode. Pilnujemy zamiaru: wybor
// silnika jest zapamietywany od razu po kliknieciu karty, zanim/gdy
// trwa poll statusu (patrz "_draftMode || prefer.mode" wyzej).
var applyModeIdx = code.indexOf("function applyMode(mode)");
if (applyModeIdx === -1) {
  fail("applyMode(mode) function missing");
}
var applyModeSlice = code.slice(applyModeIdx, applyModeIdx + 400);
if (applyModeSlice.indexOf('_draftMode = mode || "auto"') === -1) {
  fail("applyMode must store the pending engine mode into _draftMode");
}
var cardsIdx = code.indexOf('.dam-db-source[data-dam-db-mode]").forEach(');
if (cardsIdx === -1) {
  fail("mode cards must be wired via querySelectorAll on data-dam-db-mode");
}
var cardsSlice = code.slice(cardsIdx, cardsIdx + 300);
if (cardsSlice.indexOf("applyMode(") === -1) {
  fail("clicking a data-dam-db-mode card must call applyMode(...)");
}
console.log("OK dam-db-status panel: real engine modes + auth dump");
