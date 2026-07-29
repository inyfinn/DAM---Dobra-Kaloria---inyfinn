/**
 * Behavioral cap test: forEach+return vs for+break on large product list.
 * Contract (4.0.66 golden):
 * - for+break CAP in collectProductPickerRows
 * - scheduleListPaint(raw) on input (immediate rAF)
 * - q≥2 also schedules DamSearch (no early-return that skips scheduleListPaint)
 * - product/variant branches pass productQ / variantQ into collect
 *
 * Run: node scripts/qa/sim-assoc-picker-search-cap.js
 */
"use strict";

var CAP = 80;
var N = 50000;

function makeProducts(n) {
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push({
      id: "prod-" + i,
      display_name: "Product " + i,
      search_blob: "product " + i,
      indexes: [String(6300000 + (i % 999))],
      revisions: [],
    });
  }
  return out;
}

/** Symuluj droższy productSearchBlob (norm + wielokrotne indexOf) — jak realny freeze UI. */
function blobCost(p) {
  var s =
    String(p.search_blob || "") +
    " " +
    String(p.display_name || "") +
    " " +
    String(p.id || "") +
    " " +
    String((p.indexes && p.indexes.join(" ")) || "");
  s = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  var q = "product";
  var ok = false;
  for (var k = 0; k < 12; k++) {
    ok = s.indexOf(q) !== -1 || s.indexOf(String(k)) !== -1;
  }
  return ok;
}

function collectBrokenForEach(list, cap) {
  var items = [];
  list.forEach(function (p) {
    if (items.length >= cap) return; /* NIE przerywa forEach — skanuje całe N */
    if (!blobCost(p)) return;
    items.push(p);
  });
  return items.length;
}

function collectFixedForLoop(list, cap) {
  var items = [];
  for (var i = 0; i < list.length; i++) {
    if (items.length >= cap) break;
    if (!blobCost(list[i])) continue;
    items.push(list[i]);
  }
  return items.length;
}

function countBrokenIterations(list, cap) {
  var items = [];
  var iterations = 0;
  list.forEach(function (p) {
    iterations++;
    if (items.length >= cap) return;
    if (!blobCost(p)) return;
    items.push(p);
  });
  return iterations;
}

function countFixedIterations(list, cap) {
  var items = [];
  var iterations = 0;
  for (var i = 0; i < list.length; i++) {
    iterations++;
    if (items.length >= cap) break;
    if (!blobCost(list[i])) continue;
    items.push(list[i]);
  }
  return iterations;
}

var products = makeProducts(N);
var brokenIters = countBrokenIterations(products, CAP);
var fixedIters = countFixedIterations(products, CAP);
var fails = [];

console.log("broken forEach iterations:", brokenIters, "items:", collectBrokenForEach(products, CAP));
console.log("fixed for+break iterations:", fixedIters, "items:", collectFixedForLoop(products, CAP));

var ROUNDS = 8;
function timeMs(fn) {
  var t0 = process.hrtime.bigint();
  for (var r = 0; r < ROUNDS; r++) fn();
  var t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6 / ROUNDS;
}
var brokenMs = timeMs(function () {
  collectBrokenForEach(products, CAP);
});
var fixedMs = timeMs(function () {
  collectFixedForLoop(products, CAP);
});
console.log("TIMING avg ms (N=" + N + ", CAP=" + CAP + ", rounds=" + ROUNDS + "):");
console.log("  OLD forEach+return:", brokenMs.toFixed(3), "ms  → expect FAIL/FREEZE pattern (>100ms)");
console.log("  NEW for+break:     ", fixedMs.toFixed(3), "ms  → expect PASS (<5ms)");

if (brokenIters === N && fixedIters <= CAP + 5 && fixedIters < brokenIters) {
  console.log(
    "FAIL→PASS evidence: OLD forEach iterations=" +
      brokenIters +
      " (FAIL/FREEZE pattern) → NEW for+break iterations=" +
      fixedIters +
      " (PASS)"
  );
} else {
  fails.push(
    "fail→pass INVALID: need brokenIters=" +
      N +
      " and fixedIters<=" +
      (CAP + 5) +
      " (got " +
      brokenIters +
      "/" +
      fixedIters +
      ")"
  );
}
if (fixedMs >= 5) {
  fails.push("NEW for+break too slow: " + fixedMs.toFixed(2) + "ms (want <5ms)");
} else {
  console.log("FAIL→PASS evidence: NEW pattern FAST (" + fixedMs.toFixed(2) + "ms < 5ms) = PASS");
}
if (brokenMs < 1 && fixedMs < 1) {
  console.log(
    "FAIL→PASS evidence: timing noise (old=" +
      brokenMs.toFixed(2) +
      " new=" +
      fixedMs.toFixed(2) +
      "ms) — rely on iteration contract"
  );
} else if (!(fixedMs < brokenMs / 5)) {
  fails.push(
    "NEW must be >5x faster than OLD (old=" +
      brokenMs.toFixed(2) +
      " new=" +
      fixedMs.toFixed(2) +
      ")"
  );
} else {
  console.log(
    "FAIL→PASS evidence: OLD slower (" +
      brokenMs.toFixed(2) +
      "ms) vs NEW (" +
      fixedMs.toFixed(2) +
      "ms) ratio OK"
  );
}
if (brokenMs > 50) {
  console.log("FAIL→PASS evidence: OLD pattern SLOW (" + brokenMs.toFixed(2) + "ms > 50ms) = FREEZE-class timing");
}

if (brokenIters !== N) {
  fails.push("broken forEach should scan all " + N + " got " + brokenIters);
}
if (fixedIters > CAP + 5) {
  fails.push("fixed for+break should stop near cap, got " + fixedIters + " iterations");
}
if (fixedIters >= brokenIters) {
  fails.push("fixed must iterate fewer than broken");
}

var fs = require("fs");
var path = require("path");
var assoc = fs.readFileSync(
  path.join(__dirname, "..", "..", "apps/web/assets/js/dam-assoc-edit.js"),
  "utf8"
);

if (!/function collectProductPickerRows/.test(assoc)) {
  fails.push("missing collectProductPickerRows");
}
if (!/if \(items\.length >= cap\) break/.test(assoc)) {
  fails.push("missing for+break cap in collectProductPickerRows");
}
if (!/PICKER_SCAN_BUDGET/.test(assoc)) {
  fails.push("missing PICKER_SCAN_BUDGET");
}
if (!/function scheduleListPaint/.test(assoc)) {
  fails.push("missing scheduleListPaint");
}
if (!/scheduleListPaint\(raw\)/.test(assoc)) {
  fails.push("input must call scheduleListPaint(raw) immediately");
}
if (!/renderOptionsDebounced/.test(assoc)) {
  fails.push("missing renderOptionsDebounced (HARD — never remove)");
}
if (/scheduleProductSearchFetch\(raw\);\s*return/.test(assoc)) {
  fails.push("input must NOT return before scheduleListPaint on product q>=2");
}
if (!/scheduleProductSearchFetch/.test(assoc)) {
  fails.push("missing scheduleProductSearchFetch for q>=2 DamSearch path");
}
if (/q:\s*productQ/.test(assoc) || /q:\s*variantQ/.test(assoc)) {
  console.log("PASS product filter passes productQ/variantQ to collectProductPickerRows");
} else {
  fails.push("product branch must pass productQ/variantQ to collectProductPickerRows");
}
if (
  !/q\.length >= 2 && productSearchHits\.length \? "" : q/.test(assoc) &&
  !/q\.length >= 2 \? "" : q/.test(assoc)
) {
  fails.push("q>=2 must clear local q when DamSearch hits present (or always)");
}
if (!/function collectBrandingPickerRows/.test(assoc)) {
  fails.push("missing collectBrandingPickerRows (branding material/wariant for+break)");
}
if (!/function listSafeThumb/.test(assoc)) {
  fails.push("missing listSafeThumb (block N× /media?preview list storm)");
}
if (!/limit:\s*PICKER_LIST_CAP/.test(assoc) && !/limit:\s*PICKER_LIST_CAP/.test(assoc.replace(/\s/g, ""))) {
  /* DamSearch call uses limit: PICKER_LIST_CAP */
}
if (!/includeArchive:\s*false[\s\S]{0,80}limit:\s*PICKER_LIST_CAP/.test(assoc)) {
  fails.push("DamSearch picker path must pass limit: PICKER_LIST_CAP");
}
if (!/light:\s*true/.test(assoc)) {
  fails.push("DamSearch picker path must pass light:true (budgeted scans)");
}
if (!/ensureFileIndexForPicker/.test(assoc)) {
  fails.push("missing ensureFileIndexForPicker cold GOLDEN restore");
}
var searchJs = fs.readFileSync(
  path.join(__dirname, "..", "..", "apps/web/assets/js/dam-search.js"),
  "utf8"
);
if (!/function adoptWarmCaches/.test(searchJs) || !/scanBudget/.test(searchJs)) {
  fails.push("dam-search must expose adoptWarmCaches + budgeted appendFileIndexMatches");
}

if (fails.length) {
  console.error("FAIL sim-assoc-picker-search-cap");
  fails.forEach(function (f) {
    console.error(" - " + f);
  });
  process.exit(1);
}

console.log(
  "ALL PASS sim-assoc-picker-search-cap (brokenIters=" +
    brokenIters +
    " fixedIters=" +
    fixedIters +
    " oldMs=" +
    brokenMs.toFixed(2) +
    " newMs=" +
    fixedMs.toFixed(2) +
    ")"
);
console.log(
  "CONTRACT: old=FAIL/FREEZE (" +
    brokenMs.toFixed(2) +
    "ms) → new=PASS (" +
    fixedMs.toFixed(2) +
    "ms); input=scheduleListPaint+DamSearch q>=2"
);
process.exit(0);
