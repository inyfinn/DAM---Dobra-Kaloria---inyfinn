/**
 * Shared helpers for assoc freeze QA suites (read-only, no browser).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const REF_STABLE = "092821f";
const REF_LIGHT = "2b3873a";
const MODE = process.env.ASSOC_QA_MODE || "baseline";

function readSrc(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function gitShow(commit, rel) {
  try {
    return execSync(`git show ${commit}:${rel}`, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 25 * 1024 * 1024,
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch (e) {
    return "";
  }
}

/** Extract function body including outer braces. */
function extractFunctionBody(src, funcName) {
  if (!src) return "";
  const re = new RegExp("function\\s+" + funcName + "\\s*\\(");
  const m = re.exec(src);
  if (!m) return "";
  let i = src.indexOf("{", m.index);
  if (i < 0) return "";
  let depth = 0;
  const start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

/**
 * True only when searchInput.focus() runs on open/bootstrap — not inside click handlers.
 */
function tagPickerHasOpenAutofocus(tagPickerBody) {
  if (!tagPickerBody || !/searchInput\.focus\s*\(\s*\)/.test(tagPickerBody)) return false;
  /* Explicit no-autofocus on open + focus only inside add-tag click handler = OK (3.1.5 parity). */
  if (/No auto-focus on open/.test(tagPickerBody)) {
    var addTagBlock = tagPickerBody.match(
      /var addTagBtn = pop\.querySelector\(\s*["']\[data-add-tag\]["']\s*\);[\s\S]*?var changeCatBtn/
    );
    if (addTagBlock && /searchInput\.focus/.test(addTagBlock[0])) {
      var outside = tagPickerBody.replace(addTagBlock[0], "");
      return /searchInput\.focus/.test(outside);
    }
  }
  var bindBlock = tagPickerBody.match(/var searchInput = pop\.querySelector[\s\S]{0,700}/);
  if (bindBlock && /searchInput\.focus\s*\(\s*\)/.test(bindBlock[0])) return true;
  var rafBoot = tagPickerBody.match(/requestAnimationFrame\s*\(\s*function[\s\S]{0,600}/);
  if (rafBoot && /searchInput\.focus/.test(rafBoot[0])) return true;
  return false;
}

function extractVizAssocCtaSnippet(vizSrc, which) {
  if (!vizSrc) return "";
  var re = new RegExp('data-viz-assoc-cta="' + which + '"[\\s\\S]{0,220}');
  var m = re.exec(vizSrc);
  return m ? m[0] : "";
}

function loadSources() {
  return {
    assoc: readSrc("apps/web/assets/js/dam-assoc-edit.js"),
    viz: readSrc("apps/web/assets/js/dam-viz.js"),
    preview: readSrc("apps/web/assets/js/dam-media-preview.js"),
    tag: readSrc("apps/web/assets/js/dam-tag-edit.js"),
    picker: fs.existsSync(path.join(ROOT, "apps/web/assets/js/dam-folder-picker.js"))
      ? readSrc("apps/web/assets/js/dam-folder-picker.js")
      : "",
    stableAssoc: gitShow(REF_STABLE, "apps/web/assets/js/dam-assoc-edit.js"),
    stableTag: gitShow(REF_STABLE, "apps/web/assets/js/dam-tag-edit.js"),
    lightTag: gitShow(REF_LIGHT, "apps/web/assets/js/dam-tag-edit.js"),
  };
}

function findBrandingAsset(brandingIndex, assetId) {
  const data = brandingIndex;
  const assets = Array.isArray(data) ? data : data.assets || data.items || [];
  for (let i = 0; i < assets.length; i++) {
    if (assets[i] && assets[i].id === assetId) return assets[i];
  }
  return null;
}

/** Mirror dam-media-preview seedLinkedProducts (contract reference). */
function seedLinkedProducts(asset, groupContext) {
  asset = asset || {};
  groupContext = groupContext || {};
  var linked = groupContext.linked_products || asset.linked_products || [];
  if (linked && linked.length) return linked.slice();
  var ids = asset.folder_linked_product_ids || asset.linked_product_ids || [];
  if (!ids.length) return [];
  return ids.map(function (pid) {
    return { id: pid, display_name: pid, thumb_url: "" };
  });
}

function createReporter(suiteName) {
  const results = [];
  function record(name, ok, detail, expect) {
    results.push({ name, ok, detail, expect });
    const tag = expect === "after-fix" ? "AFTER-FIX" : expect === "baseline-fail" ? "BASELINE-FAIL" : "INVARIANT";
    console.log((ok ? "PASS" : "FAIL") + " [" + tag + "] " + name + (detail ? " — " + detail : ""));
  }

  /** Must hold in all modes (structural / safety). */
  function invariant(name, cond, detail) {
    record(name, !!cond, detail, "invariant");
    return cond;
  }

  /** Should be true after Grok fix; false on baseline = expected regression signal. */
  function afterFix(name, cond, detail) {
    if (MODE === "after-fix") {
      record(name, !!cond, detail, "after-fix");
      return cond;
    }
    if (cond) {
      record(name, true, detail || "already fixed", "baseline-fail");
      return true;
    }
    record(name, false, detail || "regression present (expected on baseline)", "baseline-fail");
    return false;
  }

  /** Bad pattern must be absent; present = FAIL always. */
  function forbid(name, badPresent, detail) {
    const ok = !badPresent;
    record(name, ok, detail, badPresent ? "baseline-fail" : "invariant");
    return ok;
  }

  function summary() {
    const fails = results.filter(function (r) {
      return !r.ok;
    });
    const baselineExpected = results.filter(function (r) {
      return !r.ok && r.expect === "baseline-fail" && MODE === "baseline";
    });
    console.log("\n=== " + suiteName + " MODE=" + MODE + " ===");
    console.log("total=" + results.length + " fail=" + fails.length);
    if (MODE === "baseline" && baselineExpected.length) {
      console.log("baseline-expected-fail=" + baselineExpected.length + " (Grok must fix these)");
    }
    const exitFail =
      MODE === "after-fix"
        ? fails.length > 0
        : fails.some(function (r) {
            return r.expect !== "baseline-fail";
          });
    return { results, fails, exitFail };
  }

  return { invariant, afterFix, forbid, summary };
}

module.exports = {
  ROOT,
  REF_STABLE,
  REF_LIGHT,
  MODE,
  readSrc,
  gitShow,
  extractFunctionBody,
  loadSources,
  findBrandingAsset,
  seedLinkedProducts,
  createReporter,
  tagPickerHasOpenAutofocus,
  extractVizAssocCtaSnippet,
};
