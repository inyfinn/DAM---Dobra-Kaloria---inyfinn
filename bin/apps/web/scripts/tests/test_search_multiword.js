/**
 * Wyszukiwanie wielowyrazowe (dam-search.js): produkt pasuje, gdy pasuja WSZYSTKIE slowa.
 * 07.10.2026: "kulki z kreatyną" dawalo 0 wynikow, bo cale zapytanie bylo jednym ciagiem.
 *
 * Czesc A: maly staly spis (zawsze). Czesc B: prawdziwy spis z instalacji DAM (gdy jest).
 * Run: node apps/web/scripts/tests/test_search_multiword.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var fails = 0;
function check(ok, msg) {
  if (ok) return;
  fails += 1;
  console.error("FAIL: " + msg);
}
function same(a, b) {
  return JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());
}

function loadSearch(fileIndex, searchIndex) {
  var sandbox = {
    window: { _DAM_FILE_INDEX: fileIndex, _DAM_SEARCH_INDEX: searchIndex },
    document: { readyState: "complete", addEventListener: function () {} },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    location: { pathname: "/index.html" },
    fetch: function () { return Promise.reject(new Error("fetch_should_not_run")); },
    Date: Date,
    Promise: Promise,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-search.js"), "utf8"),
    sandbox
  );
  return sandbox.window.DamSearch;
}

/** Tak szukaja Projekty (dam-projects.js projectMatchesTextQuery). */
function projectIds(S, fi, q) {
  var nq = S.normQuery(q);
  var dig = S.digitsOnly(q);
  return fi.products
    .filter(function (p) { return S.productMatchesTextQuery(p, nq, dig, false); })
    .map(function (p) { return p.id; });
}

/* ---------- A. staly spis ---------- */
function prod(id, name, category, tags, index, extra) {
  var p = {
    id: id,
    name: name,
    display_name: name.replace(/\s*\u2014.*$/, ""),
    category: category,
    path: "M:/PRODUKTY/" + category + "/" + name,
    tags: tags,
    indexes: [index + ".00"],
    index_bases: [index],
    revisions: [
      {
        index: index + ".00",
        folder: "DOY - 65 g - 22.09.2026 - " + index,
        path: "M:/PRODUKTY/" + category + "/" + name + "/DOY - 65 g - 22.09.2026 - " + index,
        carrier: "DOY",
        is_latest: true
      }
    ]
  };
  Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
  return p;
}

var FI = {
  products: [
    prod("arbuz-z-kreatyna", "ARBUZ \u2014 [ z kreatyn\u0105 ]", "02 - KULKI", ["doypack", "kulki"], "6300861"),
    prod("cola-lemon-z-kreatyna", "COLA LEMON \u2014 [ z kreatyn\u0105 ]", "02 - KULKI", ["doypack", "kulki", "lemon"], "6300863"),
    prod("malina-owocowe", "MALINA \u2014 [ owocowe ]", "02 - KULKI", ["doypack", "kulki"], "6300754"),
    prod("test-z-kreatyna", "TEST \u2014 [ z kreatyn\u0105 ]", "09 - TEST", ["doypack"], "6300999"),
    /* Etykieta linii z indeksera, ktorej nie ma w nazwie folderu ani w sciezce. */
    prod("date-cherry-balls-raw", "DATE CHERRY \u2014 [ balls_raw ]", "02 - BALLS", ["dates"], "6300378", {
      subcategory_slug: "balls raw",
      subcategory_label: "Kulki Surowe"
    })
  ]
};
var SI = {
  by_tag: {
    kulki: ["arbuz-z-kreatyna", "cola-lemon-z-kreatyna", "malina-owocowe"],
    doypack: ["arbuz-z-kreatyna", "cola-lemon-z-kreatyna", "malina-owocowe", "test-z-kreatyna"],
    /* osoby stoja tylko w spisie wyszukiwania, nie w tekscie produktu */
    "krzysztof wieczorek": ["arbuz-z-kreatyna", "malina-owocowe"],
    wieczorek: ["arbuz-z-kreatyna", "malina-owocowe"]
  },
  by_base: {},
  by_prefix: {},
  entries: [],
  association_reverse: { malinka: ["malina-owocowe"], "hot dog": ["test-z-kreatyna"] }
};
var S = loadSearch(FI, SI);

check(typeof S.queryWords === "function", "DamSearch.queryWords nie jest wystawione");
check(same(S.queryWords("kreatyn"), ["kreatyn"]), "jedno slowo ma zostac jednym slowem");
check(same(S.queryWords("kulki z kreatyna"), ["kulki", "kreatyna"]), "'z' ma byc pominiete");
check(same(S.queryWords("a b"), ["a b"]), "same jednoliterowe slowa: zapytanie zostaje w calosci");
check(same(S.queryWords("6300 863"), ["6300 863"]), "numer indeksu ze spacja zostaje jednym ciagiem");
check(same(S.queryWords("6300863.00"), ["6300863.00"]), "indeks z rewizja zostaje jednym ciagiem");
/* Gramatura to jedno slowo: samo "63" trafialoby w kazdy indeks 6300xxx. */
check(same(S.queryWords("65 g"), ["65 g"]), "'65 g' zostaje jednym ciagiem (jak przed 2.6.0)");
check(same(S.queryWords("kulki 65 g"), ["kulki", "65 g"]), "'kulki 65 g' -> kulki + '65 g'");
check(same(S.queryWords("shot 200 ml x"), ["shot", "200 ml"]), "'200 ml' razem, 'x' pominiete");
check(projectIds(S, FI, "63 g").length === 0, "'63 g' nie moze trafiac w indeksy 6300xxx: " + projectIds(S, FI, "63 g"));
check(projectIds(S, FI, "kulki 63 g").length === 0, "'kulki 63 g' nie moze trafiac w indeksy 6300xxx");
check(same(projectIds(S, FI, "arbuz 65 g"), ["arbuz-z-kreatyna"]), "'arbuz 65 g' -> " + projectIds(S, FI, "arbuz 65 g"));

check(
  same(projectIds(S, FI, "kulki z kreatyn\u0105"), ["arbuz-z-kreatyna", "cola-lemon-z-kreatyna"]),
  "'kulki z kreatyn\u0105' -> " + projectIds(S, FI, "kulki z kreatyn\u0105")
);
check(same(projectIds(S, FI, "arbuz kreatyna"), ["arbuz-z-kreatyna"]), "'arbuz kreatyna'");
check(same(projectIds(S, FI, "cola kreatyna"), ["cola-lemon-z-kreatyna"]), "'cola kreatyna'");
check(same(projectIds(S, FI, "kreatyna cola"), ["cola-lemon-z-kreatyna"]), "kolejnosc slow nie ma znaczenia");
check(projectIds(S, FI, "arbuz malina").length === 0, "'arbuz malina' nie moze nic znalezc (WSZYSTKIE slowa)");
check(projectIds(S, FI, "kreatyn").length === 3, "'kreatyn' -> 3 w stalym spisie");
check(same(projectIds(S, FI, "6300863"), ["cola-lemon-z-kreatyna"]), "'6300863' -> 1");
check(same(projectIds(S, FI, "cola 6300863"), ["cola-lemon-z-kreatyna"]), "slowo + indeks");
check(projectIds(S, FI, "arbuz 6300863").length === 0, "slowo i indeks z dwoch roznych produktow");
/* tag stoi na produkcie, nosnik i gramatura w folderze wariantu */
check(
  same(projectIds(S, FI, "doypack arbuz 65"), ["arbuz-z-kreatyna"]),
  "slowa rozlozone miedzy produkt i wariant"
);
check(
  same(projectIds(S, FI, "kulki surowe"), ["date-cherry-balls-raw"]),
  "subcategory_label ma byc w tekscie produktu"
);

var pending = [];
function searchCheck(q, expectIds, label) {
  pending.push(
    S.search(q, { includeArchive: false, fileIndex: FI }).then(function (res) {
      var ids = res.products.map(function (p) { return p.id; });
      check(same(ids, expectIds), label + ": products " + JSON.stringify(ids));
      var hitIds = res.hits
        .filter(function (h) { return h.kind === "product"; })
        .map(function (h) { return h.product.id; });
      check(same(hitIds, expectIds), label + ": hits " + JSON.stringify(hitIds));
    })
  );
}
/* Eksplorator / lupa: tag "kulki" nie moze juz wciagac wszystkich kulek. */
searchCheck("kulki z kreatyn\u0105", ["arbuz-z-kreatyna", "cola-lemon-z-kreatyna"], "search wielowyrazowe");
searchCheck("arbuz kreatyna", ["arbuz-z-kreatyna"], "search bez tagu");
pending.push(
  S.search("malinka kulki", { includeArchive: false, fileIndex: FI }).then(function (res) {
    /* skojarzenie ("malinka") liczy sie jako trafione slowo */
    check(
      same(res.products.map(function (p) { return p.id; }), ["malina-owocowe"]),
      "skojarzenie + slowo: " + JSON.stringify(res.products.map(function (p) { return p.id; }))
    );
  })
);
/* Tag wielowyrazowy (osoba) nie stoi w tekscie produktu - filtr "wszystkie slowa" nie moze
   go wyciac (recenzja 07.10.2026: "krzysztof wieczorek" 57 -> 0). */
function searchIds(q, expectIds, label) {
  pending.push(
    S.search(q, { includeArchive: false, fileIndex: FI }).then(function (res) {
      var ids = res.products.map(function (p) { return p.id; });
      check(same(ids, expectIds), label + ": " + JSON.stringify(ids));
    })
  );
}
searchIds("krzysztof wieczorek", ["arbuz-z-kreatyna", "malina-owocowe"], "tag wielowyrazowy");
searchIds("wieczorek kreatyna", ["arbuz-z-kreatyna"], "tag osoby + slowo z nazwy");
searchIds("wieczorek cola", [], "tag osoby + slowo innego produktu");
/* Skojarzenie wielowyrazowe wpisane w calosci ("hot dog" 1 -> 0 po pierwszej wersji filtra). */
searchIds("hot dog", ["test-z-kreatyna"], "skojarzenie wielowyrazowe");
searchIds("hot dog kreatyna", ["test-z-kreatyna"], "skojarzenie wielowyrazowe + slowo z nazwy");
/* Slowo bedace wlasciwoscia obiektu nie moze wywracac wyszukiwania (bylo: TypeError). */
searchIds("constructor", [], "slowo constructor");
searchIds("kulki constructor", [], "slowo constructor w zapytaniu wielowyrazowym");

/* ---------- B. prawdziwy spis ---------- */
var REAL =
  process.env.DAM_REAL_INDEX_DIR ||
  "C:/Users/krzysztof.wieczorek/AppData/Local/Programs/DAM/bin/apps/web/data";
var realNote = "pominieta (brak " + REAL + ")";
if (fs.existsSync(path.join(REAL, "file-index.json")) && fs.existsSync(path.join(REAL, "search-index.json"))) {
  var rfi = JSON.parse(fs.readFileSync(path.join(REAL, "file-index.json"), "utf8"));
  var rsi = JSON.parse(fs.readFileSync(path.join(REAL, "search-index.json"), "utf8"));
  var RS = loadSearch(rfi, rsi);
  var KRE = ["arbuz-z-kreatyna", "cola-lemon-z-kreatyna", "mango-marakuja-z-kreatyna"];
  var have = KRE.filter(function (id) {
    return rfi.products.some(function (p) { return p.id === id; });
  });
  if (have.length === 3) {
    check(same(projectIds(RS, rfi, "kulki z kreatyn\u0105"), KRE), "REAL 'kulki z kreatyn\u0105' -> " + projectIds(RS, rfi, "kulki z kreatyn\u0105"));
    check(same(projectIds(RS, rfi, "arbuz kreatyna"), ["arbuz-z-kreatyna"]), "REAL 'arbuz kreatyna'");
    check(same(projectIds(RS, rfi, "cola kreatyna"), ["cola-lemon-z-kreatyna"]), "REAL 'cola kreatyna'");
    check(same(projectIds(RS, rfi, "6300863"), ["cola-lemon-z-kreatyna"]), "REAL '6300863' -> 1");
    /* "kreatyn": dokladnie produkty z tym ciagiem w nazwie folderu (07.10.2026: 4). */
    var byName = rfi.products
      .filter(function (p) { return RS.normQuery(p.name + " " + p.path).indexOf("kreatyn") !== -1; })
      .map(function (p) { return p.id; });
    var got = projectIds(RS, rfi, "kreatyn");
    check(same(got, byName), "REAL 'kreatyn': " + got.length + " zamiast " + byName.length);
    /* Jedno slowo = to samo, co to slowo wpisane dwa razy (sciezka wielowyrazowa nie
       moze dawac innego wyniku niz jednowyrazowa). Liczby z 07.10.2026 w komentarzu. */
    var counts = [];
    ["kreatyn", "arbuz", "cola", "mango", "doypack", "czekolada", "burger", "daktyle", "nerkowcowy", "lemon"].forEach(function (w) {
      var one = projectIds(RS, rfi, w);
      check(same(one, projectIds(RS, rfi, w + " " + w)), "REAL '" + w + "' != '" + w + " " + w + "'");
      counts.push(w + "=" + one.length);
    });
    /* 07.10.2026 przed zmiana: kreatyn=4 arbuz=1 cola=6 mango=5 doypack=30 czekolada=7
       burger=9 daktyle=4 nerkowcowy=19 lemon=8 */
    realNote = counts.join(" ");
    pending.push(
      RS.search("kulki z kreatyn\u0105", { includeArchive: false, fileIndex: rfi }).then(function (res) {
        check(
          same(res.products.map(function (p) { return p.id; }), KRE),
          "REAL search 'kulki z kreatyn\u0105': " + res.products.length + " produktow"
        );
      })
    );
  } else {
    realNote = "pominieta (w spisie nie ma juz trzech kulek z kreatyna)";
  }
  /* Kazdy tag i kazde skojarzenie wielowyrazowe wpisane w calosci oddaje co najmniej
     swoje produkty. */
  [rsi.by_tag || {}, rsi.association_reverse || {}].forEach(function (map) {
    Object.keys(map).forEach(function (key) {
      if (RS.queryWords(RS.normQuery(key)).length < 2) return;
      var want = (map[key] || []).filter(function (id) {
        return rfi.products.some(function (p) { return p.id === id; });
      });
      pending.push(
        RS.search(key, { includeArchive: true, fileIndex: rfi }).then(function (res) {
          var ids = res.products.map(function (p) { return p.id; });
          var lost = want.filter(function (id) { return ids.indexOf(id) === -1; });
          check(!lost.length, "REAL '" + key + "': zgubione " + lost.length + " z " + want.length);
        })
      );
    });
  });
}

Promise.all(pending)
  .then(function () {
    if (fails) process.exit(1);
    console.log("OK search multiword; prawdziwy spis: " + realNote);
  })
  .catch(function (e) {
    console.error("FAIL: " + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
