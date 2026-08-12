/**
 * Regression: filtered groupByProduct "datesy" cards use static data/thumbs (6900001-4).
 * Run: node apps/web/scripts/tests/test_viz_datesy_group_thumb.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var jsPath = path.join(__dirname, "..", "..", "assets", "js", "dam-viz.js");
var indexPath = path.join(__dirname, "..", "..", "data", "file-index.json");
var code = fs.readFileSync(jsPath, "utf8");

if (code.indexOf('split(/[?#]/)[0]') === -1) {
  console.error("FAIL: hasStaticDataThumb must strip ?v= cache-bust before path test");
  process.exit(1);
}
if (code.indexOf("if (!hasStaticDataThumb(items[ti])) continue") === -1) {
  console.error("FAIL: renderGroup must prefer static data/thumbs before /media");
  process.exit(1);
}
if (code.indexOf("hasStaticDataThumb(a) ? 2 : a.thumb_url ? 1 : 0") === -1) {
  console.error("FAIL: pickCardHero must rank static data/thumbs above generic thumb_url");
  process.exit(1);
}

/** Mirror of dam-viz.js hasStaticDataThumb (post-fix). */
function hasStaticDataThumb(v) {
  var t = String((v && v.thumb_url) || "").replace(/^\.\//, "");
  if (!t) return false;
  var base = t.split(/[?#]/)[0];
  return /^data\/thumbs\/[^/]+\.(?:jpe?g|png|webp)$/i.test(base);
}

function cardThumbSrc(v) {
  if (!v) return "";
  if (hasStaticDataThumb(v)) {
    return String(v.thumb_url).replace(/^\.\//, "");
  }
  if (v.thumb_url && String(v.thumb_url).indexOf("data/thumbs/") >= 0) {
    return String(v.thumb_url).replace(/^\.\//, "");
  }
  return v.thumb_url || "";
}

function pathLooksArchive(p) {
  var u = String(p || "").toUpperCase();
  if (!u || u.indexOf("ARCHIWUM") === -1) return false;
  return u.indexOf("\u2014 ARCHIWUM") !== -1 || u.indexOf("- ARCHIWUM") !== -1 || u.indexOf("/ARCHIWUM/") !== -1;
}

function groupByProduct(items) {
  var map = {};
  var order = [];
  (items || []).forEach(function (v) {
    var pid = v.product_id || v.index_base || v.index || v.product_name || "_";
    if (!map[pid]) {
      map[pid] = { pid: pid, items: [] };
      order.push(pid);
    }
    map[pid].items.push(v);
  });
  return order.map(function (pid) {
    return map[pid];
  });
}

function normalizeSearchText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function filterDatesy(rows) {
  var qNorm = normalizeSearchText("datesy");
  return rows.filter(function (v) {
    if (pathLooksArchive(v.path || v.revision_path || "")) return false;
    var blob = normalizeSearchText(
      [
        v.product_name || "",
        v.index_base || "",
        v.category || "",
        (v.tags || []).join(" "),
        v.product_id || "",
      ].join(" ")
    );
    return blob.indexOf(qNorm) !== -1;
  });
}

function pickGroupCardThumb(group) {
  var items = group.items;
  var ti;
  for (ti = 0; ti < items.length; ti++) {
    if (!hasStaticDataThumb(items[ti])) continue;
    var staticCand = cardThumbSrc(items[ti]);
    if (staticCand) return staticCand;
  }
  for (ti = 0; ti < items.length; ti++) {
    var cand = cardThumbSrc(items[ti]);
    if (cand) return cand;
  }
  return "";
}

var EXPECT_IDS = {
  "6900001": "lemon-cheesecake-daktyle",
  "6900002": "karmel-daktyle",
  "6900003": "marakuja-daktyle",
  "6900004": "yuzu-daktyle",
};

var data = JSON.parse(fs.readFileSync(indexPath, "utf8"));
var vizLatest = data.viz_latest || [];
var familyRows = vizLatest.filter(function (v) {
  return Object.keys(EXPECT_IDS).some(function (ib) {
    return EXPECT_IDS[ib] === v.product_id;
  });
});

if (familyRows.length !== 4) {
  console.error("FAIL: expected 4 datesy family rows in viz_latest, got", familyRows.length);
  process.exit(1);
}

familyRows.forEach(function (row) {
  if (!hasStaticDataThumb(row)) {
    console.error("FAIL: viz_latest row missing static thumb:", row.product_id, row.thumb_url);
    process.exit(1);
  }
  var src = cardThumbSrc(row);
  if (src.indexOf("/media?") >= 0) {
    console.error("FAIL: cardThumbSrc must not prefer /media when static thumb exists:", row.product_id);
    process.exit(1);
  }
  if (src.indexOf("data/thumbs/") !== 0) {
    console.error("FAIL: cardThumbSrc must return data/thumbs for", row.product_id, "got", src);
    process.exit(1);
  }
});

var filtered = filterDatesy(vizLatest);
var groups = groupByProduct(filtered);
var datesyGroups = groups.filter(function (g) {
  return g.items.some(function (v) {
    return String(v.index_base || "") in EXPECT_IDS || Object.keys(EXPECT_IDS).indexOf(String(v.index_base || "")) >= 0;
  });
});

if (datesyGroups.length !== 4) {
  console.error("FAIL: filtered datesy groupByProduct expected 4 groups, got", datesyGroups.length);
  process.exit(1);
}

var ok = 0;
datesyGroups.forEach(function (g) {
  var thumb = pickGroupCardThumb(g);
  var ib = String((g.items[0] && g.items[0].index_base) || "");
  if (!thumb || thumb.indexOf("data/thumbs/") !== 0 || thumb.indexOf("__" + ib + "_") === -1) {
    console.error("FAIL: group", g.pid, "index", ib, "thumb", thumb);
    process.exit(1);
  }
  if (thumb.indexOf("/media?") >= 0 || thumb.indexOf("placeholder") >= 0) {
    console.error("FAIL: group", g.pid, "must not use media/placeholder thumb");
    process.exit(1);
  }
  ok++;
});

console.log("OK datesy groupByProduct filtered thumbs " + ok + "/4 (6900001-6900004)");
