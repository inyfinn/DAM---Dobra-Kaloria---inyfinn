/**
 * Run all assoc QA suites (baseline or after-fix via ASSOC_QA_MODE).
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const MODE = process.env.ASSOC_QA_MODE || "baseline";

const suites = [
  "audit-assoc-regression.js",
  "sim-assoc-dodaj.js",
  "sim-assoc-css-conflict.js",
  "sim-assoc-open-paths.js",
  "sim-assoc-save-auth.js",
  "sim-assoc-search-init.js",
  "sim-assoc-linked-render.js",
  "sim-assoc-ui-contracts.js",
];

console.log("=== sim-assoc-run-all MODE=" + MODE + " ===\n");

let anyUnexpected = 0;
suites.forEach(function (file) {
  const full = path.join(__dirname, file);
  console.log("\n--- RUN " + file + " ---");
  const res = spawnSync(process.execPath, [full], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { ASSOC_QA_MODE: MODE }),
    encoding: "utf8",
    stdio: "pipe",
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  const code = res.status || 0;
  console.log("EXIT " + file + " code=" + code);
  if (code !== 0) anyUnexpected++;
});

console.log("\n=== sim-assoc-run-all summary ===");
console.log("MODE=" + MODE + " suites_failed=" + anyUnexpected + "/" + suites.length);
if (MODE === "baseline" && anyUnexpected > 0) {
  console.log("Note: baseline failures include EXPECTED regression signals for Grok fix.");
}
process.exit(anyUnexpected > 0 ? 1 : 0);
