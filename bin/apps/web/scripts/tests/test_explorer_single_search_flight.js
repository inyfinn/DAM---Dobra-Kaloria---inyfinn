/**
 * Explorer: one DamSearch.search flight for #damFileSearch (dropdown + panel).
 * Run: node apps/web/scripts/tests/test_explorer_single_search_flight.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

var explorer = fs.readFileSync(
  path.join(__dirname, "..", "..", "assets", "js", "dam-explorer.js"),
  "utf8"
);
var search = fs.readFileSync(
  path.join(__dirname, "..", "..", "assets", "js", "dam-search.js"),
  "utf8"
);
var assoc = fs.readFileSync(
  path.join(__dirname, "..", "..", "assets", "js", "dam-assoc-edit.js"),
  "utf8"
);

if (explorer.indexOf("HARD: one search flight") === -1) {
  fail("explorer must document single search flight");
}
if (explorer.indexOf("_damPanelScopeBound") !== -1) {
  fail("scope click must not fire a second DamSearch.search via applySearchToPanel");
}
if (explorer.indexOf("if (!boxOwnsSearch && (input.value || \"\").trim().length >= 2)") === -1) {
  fail("prefilled input must not dual-search when bindSearchBox owns the box");
}
if (search.indexOf("productMatchesTextQuery: productMatchesTextQuery") === -1) {
  fail("DamSearch must export productMatchesTextQuery for projects list filter");
}
if (search.indexOf("normQuery: norm") === -1) {
  fail("DamSearch must export normQuery");
}
if (assoc.indexOf("Nie full products.forEach") === -1) {
  fail("picker must keep DamSearch path instead of full products.forEach");
}
if (assoc.indexOf("scheduleProductSearchFetch") === -1) {
  fail("picker must search products via scheduleProductSearchFetch");
}

console.log("OK explorer single DamSearch flight + picker DamSearch + exported matcher");
