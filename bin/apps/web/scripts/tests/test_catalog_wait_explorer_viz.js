/**
 * Swiezy komputer (instalator bez spisu): Eksplorator i Wizualizacje biora spis z mostu,
 * a most odpowiada 404, dopoki katalog nie przyjdzie z bazy. Zamiast surowego bledu:
 * "Pobieram katalog z bazy...", ponawianie co 3 s do 180 s, potem komunikat z przyciskiem.
 * Prawdziwy kod wyciety z dam-explorer.js i dam-viz.js, udawany zegar, bez przegladarki.
 * Run: node apps/web/scripts/tests/test_catalog_wait_explorer_viz.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var JS = path.join(__dirname, "..", "..", "assets", "js");
var WAIT = "Pobieram katalog z bazy...";
var FAIL = "Nie udało się pobrać katalogu z bazy - sprawdź połączenie";

var fails = 0;
var count = 0;
function check(ok, msg) {
  count += 1;
  if (ok) return;
  fails += 1;
  console.error("FAIL: " + msg);
}

function cut(src, from, to, name) {
  var a = src.indexOf(from);
  var b = a < 0 ? -1 : src.indexOf(to, a + from.length);
  if (a < 0 || b < 0) {
    console.error("FAIL: nie znaleziono fragmentu " + name);
    process.exit(1);
  }
  return src.slice(a, b);
}

function clock() {
  var c = { now: 5000000, timers: [], tid: 0 };
  c.setTimeout = function (fn, ms) { c.timers.push({ id: ++c.tid, at: c.now + (ms || 0), fn: fn }); return c.tid; };
  c.clearTimeout = function (id) { c.timers = c.timers.filter(function (t) { return t.id !== id; }); };
  c.flush = async function () { for (var i = 0; i < 5; i++) await new Promise(function (r) { setImmediate(r); }); };
  c.advance = async function (ms) {
    var end = c.now + ms;
    for (;;) {
      await c.flush();
      var due = c.timers.filter(function (t) { return t.at <= end; }).sort(function (x, y) { return x.at - y.at || x.id - y.id; })[0];
      if (!due) break;
      c.timers = c.timers.filter(function (t) { return t !== due; });
      c.now = due.at;
      due.fn();
    }
    c.now = end;
    await c.flush();
  };
  return c;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/* ------------------------------ Eksplorator ------------------------------ */
var explorerSrc = fs.readFileSync(path.join(JS, "dam-explorer.js"), "utf8");
var explorerChunk = cut(
  explorerSrc,
  "  function showExplorerIndexError(detail, plain) {",
  "  /* Category helpers",
  "dam-explorer.js: showExplorerIndexError..Category helpers"
);
explorerChunk = explorerChunk.slice(0, explorerChunk.lastIndexOf("  /* ----"));

function explorerWorld() {
  var c = clock();
  var e = { c: c, status: [], loads: 0, applied: [], watchdogCleared: 0, listeners: {}, loader: { state: "idle" } };
  e.main = { innerHTML: "", querySelector: function () { return null; } };
  e.folder = { innerHTML: "" };
  var retryBtn = { addEventListener: function (n, fn) { e.retryClick = fn; } };
  var sb = {
    console: { warn: function () {} }, String: String, Promise: Promise,
    Date: { now: function () { return c.now; } },
    setTimeout: c.setTimeout, clearTimeout: c.clearTimeout,
    esc: esc,
    document: {
      visibilityState: "visible",
      getElementById: function (id) { return id === "damExplorerMain" ? e.main : id === "damFolderList" ? e.folder : null; },
      querySelectorAll: function () { return e.main.innerHTML.indexOf("data-dam-explorer-retry") !== -1 ? [retryBtn] : []; }
    },
    addEventListener: function (n, fn) { (e.listeners[n] = e.listeners[n] || []).push(fn); },
    DamFileIndex: { state: function () { return e.loader; }, get: function () { e.getCalled = true; return Promise.reject(new Error("zakaz")); } },
    explorerIndexBound: false,
    setStatus: function (m) { e.status.push(m); },
    explorerFolderEmpty: function () { return true; },
    explorerNeedsBind: function () { return true; },
    clearExplorerIndexWatchdogs: function () { e.watchdogCleared += 1; },
    isAbortLike: function (err) { return /abort/i.test(String((err && (err.name || err.message)) || "")); },
    startExplorerIndexBind: function () { return Promise.resolve(); },
    dismissExplorerLoader: function () {}, unlockExplorerBoot: function () {},
    loadExplorerPrimaryIndex: function () { e.loads += 1; return e.next(e.loads); },
    applyExplorerIndexBundle: function (bundle, reason) { e.applied.push(reason + ":" + bundle.tag); }
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(explorerChunk + "\nthis.__x = { handle: handleCatalogMissing, retry: retryExplorerIndex, wait: catalogWait, show: showExplorerIndexError };", sb);
  e.x = sb.__x;
  e.sb = sb;
  e.emit = function (detail) { e.loader = detail; (e.listeners["dam:file-index-state"] || []).forEach(function (fn) { fn({ detail: detail }); }); };
  e.lastStatus = function () { return e.status[e.status.length - 1]; };
  return e;
}

var E404 = function () { return Promise.reject(new Error("bridge_file_index_404")); };

(async function () {
  var e, r;

  e = explorerWorld();
  e.next = E404;
  r = e.x.handle(new Error("bridge_file_index_404"), "init");
  check(r === true && e.lastStatus() === WAIT && e.main.innerHTML.indexOf(WAIT) !== -1, "Eksplorator 404: spokojny tekst w statusie i w panelu");
  check(e.main.innerHTML.indexOf("bridge_file_index_404") === -1 && e.main.innerHTML.indexOf("nie odpowiada") === -1 && e.main.innerHTML.indexOf("dam-danger") === -1, "Eksplorator 404: bez surowego kodu bledu, bez czerwieni, bez 'usluga nie odpowiada'");
  check(e.main.innerHTML.indexOf("data-dam-explorer-retry") === -1, "Eksplorator w trakcie czekania: bez przycisku (ponawia sam)");
  check(e.watchdogCleared === 1, "Eksplorator: straznicy 8 s wylaczeni na czas czekania (inaczej nadpisaliby tekst bledem)");
  await e.c.advance(2900);
  check(e.loads === 0, "Eksplorator: przed 3 s nie ponawia");
  await e.c.advance(200);
  check(e.loads === 1, "Eksplorator: po 3 s pierwsze ponowienie");
  await e.c.advance(30000);
  check(e.loads === 11 && e.lastStatus() === WAIT, "Eksplorator: co 3 s, po 33 s jest 11 prob (bylo " + e.loads + "), tekst bez zmian");
  check(e.status.filter(function (s) { return /Błąd|adowanie indeksu/.test(s); }).length === 0, "Eksplorator: status nie miga 'Blad' ani 'Ponowne ladowanie'");
  e.next = function () { return Promise.resolve({ tag: "spis" }); };
  await e.c.advance(3000);
  check(e.applied.join() === "init:spis" && e.x.wait.since === 0, "Eksplorator: katalog przyszedl -> drzewo wypelnione z powodem 'init' (glebokie linki), czekanie zakonczone: " + e.applied.join());
  var loadsAfter = e.loads;
  await e.c.advance(60000);
  check(e.loads === loadsAfter, "Eksplorator: po sukcesie zadnych dalszych pobran");
  check(!e.getCalled, "Eksplorator nie wola DamFileIndex.get() (pelny spis 9 MB)");

  /* limit 180 s */
  e = explorerWorld();
  e.next = E404;
  e.x.handle(new Error("bridge_file_index_404"), "init");
  await e.c.advance(177500);
  check(e.lastStatus() === WAIT, "Eksplorator: w 177 s nadal czeka");
  await e.c.advance(6000);
  check(e.lastStatus() === FAIL && e.main.innerHTML.indexOf(FAIL.replace(/"/g, "&quot;")) !== -1, "Eksplorator: po 180 s komunikat o polaczeniu (" + e.lastStatus() + ")");
  check(e.main.innerHTML.indexOf("data-dam-explorer-retry") !== -1 && e.main.innerHTML.indexOf("nie odpowiada") === -1, "Eksplorator: porazka ma istniejacy przycisk 'Sprobuj ponownie', bez dopisku o lokalnej usludze");
  loadsAfter = e.loads;
  await e.c.advance(30000);
  check(e.loads === loadsAfter, "Eksplorator: po porazce nie mieli ponowien w tle");
  check(typeof e.retryClick === "function", "Eksplorator: przycisk ponowienia podpiety");
  e.retryClick({ preventDefault: function () {} });
  await e.c.advance(500);
  check(e.lastStatus() === WAIT && e.x.wait.since !== 0, "Eksplorator: klik 'Sprobuj ponownie' zaczyna nowe czekanie (" + e.lastStatus() + ")");
  e.next = function () { return Promise.resolve({ tag: "po-kliku" }); };
  await e.c.advance(3100);
  check(e.applied.join() === "retry:po-kliku", "Eksplorator: po kliku katalog wchodzi: " + e.applied.join());

  /* stan loadera: inny skrypt strony juz czeka */
  e = explorerWorld();
  e.next = E404;
  e.loader = { state: "failed", since: 111, message: "W bazie nie ma jeszcze katalogu." };
  e.x.handle(new Error("bridge_file_index_404"), "init");
  check(e.lastStatus() === "W bazie nie ma jeszcze katalogu." && e.x.wait.since === 0, "Eksplorator: loader juz oglosil porazke -> jego komunikat od razu, bez 3 minut czekania");
  e.x.handle(new Error("bridge_file_index_404"), "retry");
  check(e.lastStatus() === WAIT, "Eksplorator: ta sama, stara porazka loadera nie blokuje ponownej proby");

  e = explorerWorld();
  e.next = E404;
  e.x.handle(new Error("bridge_file_index_404"), "init");
  await e.c.advance(1000);
  e.next = function () { return Promise.resolve({ tag: "zdarzenie" }); };
  e.emit({ state: "ready", since: 5 });
  await e.c.flush();
  check(e.applied.join() === "init:zdarzenie", "Eksplorator: zdarzenie ready -> od razu, bez czekania na 3 s");
  e = explorerWorld();
  e.next = E404;
  e.x.handle(new Error("bridge_file_index_404"), "init");
  e.emit({ state: "failed", since: 6, message: "" });
  check(e.lastStatus() === FAIL, "Eksplorator: zdarzenie failed bez tekstu -> domyslny komunikat");
  e = explorerWorld();
  e.emit({ state: "ready", since: 7 });
  e.emit({ state: "failed", since: 7, message: "x" });
  check(e.loads === 0 && e.status.length === 0, "Eksplorator: zdarzenia loadera poza czekaniem nic nie robia");

  /* inne bledy zostaja po staremu */
  e = explorerWorld();
  r = e.x.handle(new Error("timeout"), "init");
  check(r === false && e.status.length === 0, "Eksplorator: blad inny niz 404 idzie stara sciezka");
  r = e.x.handle(new Error("bridge_file_index_500"), "init");
  check(r === false, "Eksplorator: 500 to nie jest brak katalogu");
  e.x.show("timeout");
  check(e.main.innerHTML.indexOf("nie odpowiada") !== -1, "Eksplorator: zwykly blad nadal mowi o lokalnej usludze");
  e = explorerWorld();
  var n = 0;
  e.next = function () {
    n += 1;
    if (n > 1) return Promise.resolve({ tag: "po-przerwaniu" });
    var er = new Error("The user aborted a request.");
    er.name = "AbortError";
    return Promise.reject(er);
  };
  e.x.handle(new Error("bridge_file_index_404"), "init");
  await e.c.advance(6500);
  check(e.applied.join() === "init:po-przerwaniu", "Eksplorator: przerwane pobranie w trakcie czekania nie konczy czekania");
  e = explorerWorld();
  n = 0;
  e.next = function () { n += 1; return Promise.reject(new Error(n === 1 ? "bridge_file_index_404" : "Failed to fetch")); };
  e.x.handle(new Error("bridge_file_index_404"), "init");
  await e.c.advance(7000);
  check(/Błąd indeksu: Failed to fetch/.test(e.lastStatus()) && e.main.innerHTML.indexOf("nie odpowiada") !== -1, "Eksplorator: most padl w trakcie czekania -> zwykly komunikat o usludze (" + e.lastStatus() + ")");

  check((explorerSrc.match(/if \(handleCatalogMissing\(err, (reason|"retry")\)\) return;/g) || []).length === 2, "Eksplorator: oba miejsca bledu indeksu ida przez handleCatalogMissing");
  check(explorerSrc.indexOf("DamFileIndex.get(") === -1, "dam-explorer.js nie zawiera DamFileIndex.get(");

  /* ------------------------------ Wizualizacje ------------------------------ */
  var vizSrc = fs.readFileSync(path.join(JS, "dam-viz.js"), "utf8");
  var vizChunk = cut(
    vizSrc,
    "    /* ---- Swiezy komputer: katalog dopiero idzie z bazy",
    "    var langSel = document.getElementById(\"vizLangFilter\");",
    "dam-viz.js: blok czekania na katalog"
  );
  check(vizSrc.indexOf("Blad indeksu") === -1 && vizSrc.indexOf("Błąd indeksu: ") !== -1, "Wizualizacje: 'Blad indeksu' ma ogonki");

  function vizWorld() {
    var c = clock();
    var v = { c: c, loads: 0, boots: [], listeners: {}, loader: { state: "idle" } };
    v.grid = {
      innerHTML: "",
      querySelector: function (sel) { return sel === "[data-viz-catalog-wait]" && v.grid.innerHTML.indexOf("data-viz-catalog-wait") !== -1 ? {} : null; }
    };
    var sb = {
      String: String, Promise: Promise,
      Date: { now: function () { return c.now; } },
      setTimeout: c.setTimeout, clearTimeout: c.clearTimeout,
      esc: esc, grid: v.grid,
      document: { getElementById: function (id) { return id === "vizCatalogRetry" && v.grid.innerHTML.indexOf('id="vizCatalogRetry"') !== -1 ? { addEventListener: function (n, fn) { v.retryClick = fn; } } : null; } },
      addEventListener: function (n, fn) { (v.listeners[n] = v.listeners[n] || []).push(fn); },
      DamFileIndex: { state: function () { return v.loader; } },
      DamIndexPoller: { create: function (cfg) { v.pollerChange = cfg.onChange; } },
      loadIndex: function () { v.loads += 1; return v.next(v.loads); },
      boot: function (data) { v.boots.push(data.tag); }
    };
    sb.window = sb;
    vm.createContext(sb);
    v.start = async function () { vm.runInContext("(function () {\n" + vizChunk + "\n})();", sb); await c.flush(); };
    v.emit = function (detail) { v.loader = detail; (v.listeners["dam:file-index-state"] || []).forEach(function (fn) { fn({ detail: detail }); }); };
    return v;
  }
  var V404 = function () { return Promise.reject(new Error("bridge_viz_index_404")); };

  var v = vizWorld();
  v.next = V404;
  await v.start();
  check(v.grid.innerHTML.indexOf(WAIT) !== -1 && v.grid.innerHTML.indexOf("bridge_viz_index_404") === -1 && v.grid.innerHTML.indexOf("danger") === -1, "Wizualizacje 404: spokojny tekst, bez surowego kodu i czerwieni");
  await v.c.advance(30500);
  check(v.loads === 11 && v.grid.innerHTML.indexOf(WAIT) !== -1, "Wizualizacje: ponawianie co 3 s (11 pobran po 30 s, bylo " + v.loads + ")");
  v.pollerChange();
  check(v.loads === 11, "Wizualizacje: poller w trakcie czekania nie robi drugiego pobrania");
  v.next = function () { return Promise.resolve({ tag: "spis" }); };
  await v.c.advance(3000);
  check(v.boots.join() === "spis" && v.loads === 12, "Wizualizacje: katalog przyszedl -> siatka wypelniona raz");
  v.pollerChange();
  await v.c.flush();
  check(v.loads === 13 && v.boots.length === 2, "Wizualizacje: poller widzial zmiane juz w trakcie czekania, wiec nastepna zmiana jest prawdziwa i laduje");

  v = vizWorld();
  v.next = V404;
  await v.start();
  v.next = function () { return Promise.resolve({ tag: "spis" }); };
  await v.c.advance(3100);
  check(v.boots.join() === "spis", "Wizualizacje: wypelnione po pierwszym ponowieniu");
  v.pollerChange();
  await v.c.flush();
  check(v.loads === 2 && v.boots.length === 1, "Wizualizacje: poller zglasza pojawienie sie tego samego spisu -> bez drugiego pobrania");
  v.pollerChange();
  await v.c.flush();
  check(v.loads === 3 && v.boots.length === 2, "Wizualizacje: kolejna zmiana spisu laduje normalnie");

  v = vizWorld();
  v.next = V404;
  await v.start();
  v.next = function () { return Promise.resolve({ tag: "spis" }); };
  await v.c.advance(3100);
  await v.c.advance(31000);
  v.pollerChange();
  await v.c.flush();
  check(v.boots.length === 2, "Wizualizacje: pominiecie zdarzenia pollera wygasa po 30 s");

  v = vizWorld();
  v.next = V404;
  await v.start();
  await v.c.advance(177000);
  check(v.grid.innerHTML.indexOf(WAIT) !== -1, "Wizualizacje: w 177 s nadal czeka");
  await v.c.advance(6000);
  check(v.grid.innerHTML.indexOf(esc(FAIL)) !== -1 && v.grid.innerHTML.indexOf('id="vizCatalogRetry"') !== -1, "Wizualizacje: po 180 s komunikat o polaczeniu i przycisk");
  var before = v.loads;
  await v.c.advance(30000);
  check(v.loads === before, "Wizualizacje: po porazce bez ponowien w tle");
  v.next = function () { return Promise.resolve({ tag: "po-kliku" }); };
  v.retryClick();
  await v.c.flush();
  check(v.boots.join() === "po-kliku", "Wizualizacje: przycisk ponowienia laduje spis");

  v = vizWorld();
  v.next = V404;
  v.loader = { state: "failed", since: 9, message: "W bazie nie ma jeszcze katalogu." };
  await v.start();
  check(v.grid.innerHTML.indexOf("W bazie nie ma jeszcze katalogu.") !== -1, "Wizualizacje: komunikat loadera od razu");
  v.retryClick();
  await v.c.flush();
  check(v.grid.innerHTML.indexOf(WAIT) !== -1, "Wizualizacje: po kliku stara porazka loadera nie blokuje nowej proby");

  v = vizWorld();
  v.next = V404;
  await v.start();
  v.next = function () { return Promise.resolve({ tag: "zdarzenie" }); };
  v.emit({ state: "ready", since: 3 });
  await v.c.flush();
  check(v.boots.join() === "zdarzenie", "Wizualizacje: zdarzenie ready -> od razu");

  v = vizWorld();
  v.next = function () { return Promise.reject(new Error("bridge_viz_index_500")); };
  await v.start();
  check(/Błąd indeksu: bridge_viz_index_500/.test(v.grid.innerHTML), "Wizualizacje: inny blad zostaje bledem (z ogonkami)");
  await v.c.advance(20000);
  check(v.loads === 1, "Wizualizacje: przy innym bledzie nie ma petli ponowien");

  v = vizWorld();
  v.next = function () { var er = new Error("The user aborted a request."); er.name = "AbortError"; return Promise.reject(er); };
  await v.start();
  await v.c.advance(20000);
  check(v.grid.innerHTML === "" && v.loads === 1, "Wizualizacje: przerwane pobranie poza czekaniem - cisza jak dotad");

  v = vizWorld();
  v.next = function () { return Promise.resolve({ tag: "zwykly" }); };
  await v.start();
  v.pollerChange();
  await v.c.flush();
  check(v.boots.length === 2 && v.grid.innerHTML === "", "Wizualizacje: zwykly start i zwykla zmiana spisu bez zmian w zachowaniu");

  if (fails) {
    console.error("FAIL: " + fails + " z " + count);
    process.exit(1);
  }
  console.log("OK catalog wait: Eksplorator + Wizualizacje (" + count + " asercji)");
  process.exit(0);
})();
