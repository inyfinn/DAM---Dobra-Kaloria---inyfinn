var fs = require("fs");
var idx = JSON.parse(fs.readFileSync("bin/apps/web/data/file-index.json", "utf8"));

function letterFromFolderName(pathOrName) {
  var nm = String(pathOrName || "").split(/[/\\]/).pop() || "";
  var m = nm.match(/\s-\s([FXD])$/i);
  return m ? m[1].toUpperCase() : "";
}
function revisionIsFinal(rev) {
  if (!rev) return false;
  var diskLit = letterFromFolderName(rev.path || "");
  if (!diskLit && !rev.path && rev.folder) diskLit = letterFromFolderName(rev.folder);
  return diskLit === "F";
}
function normDashText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ą/g, "a")
    .replace(/ć/g, "c")
    .replace(/ę/g, "e")
    .replace(/ł/g, "l")
    .replace(/ń/g, "n")
    .replace(/ó/g, "o")
    .replace(/ś/g, "s")
    .replace(/ź|ż/g, "z")
    .replace(/[`'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function parseRevisionDate(folder, fallback) {
  var s = String(folder || "");
  var m = s.match(/(\d{2})[.\s](\d{2})[.\s](\d{4})/);
  if (m) return m[3] + "-" + m[2] + "-" + m[1];
  return fallback || "";
}
function recordMtimeMs(rec) {
  var ms = Number(rec.mtime_ms);
  if (ms && isFinite(ms)) return ms;
  var raw = rec.mtime || rec.sortDate || rec.date || "";
  var t = Date.parse(String(raw || ""));
  return t && isFinite(t) ? t : 0;
}
function hashSeriesKey(key) {
  var h = 2166136261;
  var s = String(key || "");
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

var rows = [];
var ciasto = [];
(idx.products || []).forEach(function (prod) {
  var pid = prod.id || "";
  var name = prod.display_name || prod.name || pid;
  if (/test-lifecycle/i.test(pid) || /^test\b/i.test(name)) return;
  if (/sliw|ciasto/i.test(normDashText(name))) {
    ciasto.push({
      name: name,
      revs: (prod.revisions || []).map(function (r) {
        return { folder: r.folder, index: r.index, date: r.date, F: revisionIsFinal(r) };
      })
    });
  }
  (prod.revisions || []).forEach(function (rev) {
    if (!revisionIsFinal(rev)) return;
    var ix = String(rev.index || rev.index_base || "");
    if (!ix || ix === "pending" || /^noid/i.test(ix) || ix.indexOf("000000") === 0) return;
    var sortDate = rev.date || parseRevisionDate(rev.folder || rev.path || "", "") || "";
    rows.push({
      name: name,
      index: ix,
      date: sortDate,
      mtime_ms: recordMtimeMs({ date: sortDate, mtime: sortDate })
    });
  });
});

console.log("F_ROWS", rows.length);
var by = {};
var order = [];
rows.forEach(function (r) {
  var k = normDashText(r.name) || "idx:" + r.index;
  if (!by[k]) {
    by[k] = { vars: [], seen: {} };
    order.push(k);
  }
  if (by[k].seen[r.index]) return;
  by[k].seen[r.index] = 1;
  by[k].vars.push(r);
});
var series = order.map(function (k) {
  var vars = by[k].vars;
  var newest = 0;
  vars.forEach(function (v) {
    if (v.mtime_ms > newest) newest = v.mtime_ms;
  });
  var arr = vars.slice().sort(function (a, b) {
    return String(a.index).localeCompare(String(b.index));
  });
  var rep = arr[hashSeriesKey(k) % arr.length];
  return {
    name: rep.name,
    key: k,
    rep: rep.index,
    count: vars.length,
    date: newest ? new Date(newest).toISOString().slice(0, 10) : "",
    indexes: arr.map(function (v) {
      return v.index;
    })
  };
});
series.sort(function (a, b) {
  var am = Date.parse(a.date) || 0;
  var bm = Date.parse(b.date) || 0;
  if (!am && !bm) return 0;
  if (!am) return 1;
  if (!bm) return -1;
  return bm - am;
});
series.slice(0, 8).forEach(function (s, i) {
  console.log(
    i + 1 + ". " + s.name + " n=" + s.count + " date=" + s.date + " rep=" + s.rep + " idxs=" + s.indexes.join(",")
  );
});
console.log("CIASTO", JSON.stringify(ciasto, null, 2));
