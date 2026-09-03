/**
 * Static checks for DamSearch force reload contract.
 * Run: node apps/web/scripts/tests/test_dam_search_force.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var jsPath = path.join(__dirname, "..", "..", "assets", "js", "dam-search.js");
var code = fs.readFileSync(jsPath, "utf8");

if (code.indexOf("if (opts.force)") === -1) {
  console.error("FAIL: dam-search.js missing opts.force branch");
  process.exit(1);
}
if (code.indexOf("window._DAM_FILE_INDEX = null") === -1) {
  console.error("FAIL: dam-search.js does not clear warm file-index cache on force");
  process.exit(1);
}

var sandbox = {
  window: {},
  localStorage: {
    _d: {},
    getItem: function (k) {
      return this._d[k] || null;
    },
    setItem: function (k, v) {
      this._d[k] = String(v);
    },
  },
  fetch: function () {
    return Promise.reject(new Error("fetch_should_not_run_in_static_test"));
  },
  Date: Date,
  Promise: Promise,
  console: console,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

var DamSearch = sandbox.window.DamSearch;
if (!DamSearch || typeof DamSearch.load !== "function") {
  console.error("FAIL: DamSearch.load not exported");
  process.exit(1);
}
if (typeof DamSearch.productMatchesTextQuery !== "function") {
  console.error("FAIL: DamSearch.productMatchesTextQuery not exported");
  process.exit(1);
}
if (typeof DamSearch.normQuery !== "function" || typeof DamSearch.digitsOnly !== "function") {
  console.error("FAIL: DamSearch.normQuery/digitsOnly not exported");
  process.exit(1);
}

sandbox.window._DAM_FILE_INDEX = { products: [{ id: "cached" }] };
sandbox.window._DAM_SEARCH_INDEX = { products: [] };

DamSearch.load({ force: true })
  .then(function () {
    console.error("FAIL: expected fetch rejection path");
    process.exit(1);
  })
  .catch(function () {
    if (sandbox.window._DAM_FILE_INDEX !== null) {
      console.error("FAIL: force load did not clear _DAM_FILE_INDEX before fetch");
      process.exit(1);
    }
    console.log("OK dam-search force clears warm caches");
  });
