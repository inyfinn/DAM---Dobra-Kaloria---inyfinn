/**
 * Pulpit: odswiezanie po zmianie spisu i pierwsze pobranie katalogu z bazy.
 * Prawdziwy kod z dam-dashboard.js (od paintIndexMeta do wireCustomize) i prawdziwy
 * dam-index-poller.js, z udawanym zegarem, fetch i zdarzeniami. Bez przegladarki, bez mostu.
 * Run: node apps/web/scripts/tests/test_dashboard_index_refresh.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var JS = path.join(__dirname, "..", "..", "assets", "js");
var dash = fs.readFileSync(path.join(JS, "dam-dashboard.js"), "utf8");
var widgets = fs.readFileSync(path.join(JS, "dam-dashboard-widgets.js"), "utf8");
var a = dash.indexOf("  function paintIndexMeta(");
var b = dash.indexOf("  function wireCustomize(");
if (a < 0 || b < a) {
  console.error("FAIL: nie znaleziono paintIndexMeta..wireCustomize w dam-dashboard.js");
  process.exit(1);
}
var chunk = dash.slice(a, b);
var initPart = dash.slice(b);

var fails = 0;
var count = 0;
function check(ok, msg) {
  count += 1;
  if (ok) return;
  fails += 1;
  console.error("FAIL: " + msg);
}

var WAIT = "Pobieram katalog z bazy...";
var FAIL = "Nie udało się pobrać katalogu z bazy - sprawdź połączenie";

function world() {
  var now = 0, timers = [], tid = 0, listeners = {}, w = {};
  w.flush = function () { return new Promise(function (r) { setImmediate(r); }); };
  w.advance = async function (ms) {
    var end = now + ms;
    for (;;) {
      await w.flush();
      var due = timers
        .filter(function (t) { return t.at <= end; })
        .sort(function (x, y) { return x.at - y.at || x.id - y.id; })[0];
      if (!due) break;
      timers = timers.filter(function (t) { return t !== due; });
      now = due.at;
      due.fn();
    }
    now = end;
    await w.flush();
  };
  w.meta = { textContent: "" };
  w.renders = [];
  w.refreshCalls = 0;
  w.getCalls = 0;
  w.customize = false;
  w.statusCalls = 0;
  w.fiState = { state: "idle" };
  w.emit = function (detail) {
    w.fiState = detail;
    (listeners["dam:file-index-state"] || []).forEach(function (fn) { fn({ detail: detail }); });
  };
  var sb = {
    console: console, Promise: Promise, String: String, Math: Math,
    setTimeout: function (fn, ms) { timers.push({ id: ++tid, at: now + (ms || 0), fn: fn }); return tid; },
    clearTimeout: function (id) { timers = timers.filter(function (t) { return t.id !== id; }); },
    document: {
      hidden: false, readyState: "complete",
      body: { classList: { contains: function () { return true; } } },
      addEventListener: function () {},
      getElementById: function (id) { return id === "damDashIndexMeta" ? w.meta : null; }
    },
    addEventListener: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    CustomEvent: function () {}, dispatchEvent: function () {},
    fetch: function () {
      w.statusCalls += 1;
      var s = w.statusNow;
      return Promise.resolve(
        s && s.http ? { ok: false, status: s.http } : { ok: true, json: function () { return Promise.resolve(s); } }
      );
    },
    DamRuntime: { bridgeUrl: function () { return "http://most.test"; } },
    DamIndexSource: { decorate: function (el) { el.decorated = (el.decorated || 0) + 1; }, reload: function () {} },
    DamFileIndex: {
      refresh: function () { w.refreshCalls += 1; return w.nextRefresh(w.refreshCalls); },
      get: function () { w.getCalls += 1; return w.nextGet(w.getCalls); },
      state: function () { return w.fiState; }
    },
    DamApi: { projects: function () { return Promise.resolve({ data: ["proj"] }); } },
    DamDashWidgets: { isCustomizeOpen: function () { return w.customize; } },
    buildCtx: function (parts) { return { fileIndex: parts.fileIndex, projects: parts.projects, catalog: parts.catalog || null }; },
    render: function (ctx) { w.renders.push((ctx.fileIndex.generated_at || "pusty") + "|" + (ctx.catalogNote || "") + (ctx.catalog ? "|katalog" : "")); }
  };
  sb.window = sb;
  sb.globalThis = sb;
  w.clockNow = function () { return now; };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(JS, "dam-index-poller.js"), "utf8"), sb);
  vm.runInContext(
    chunk +
      "\nthis.__t = { refresh: refreshFromIndex, paint: paintIndexMeta, gate: catalogGate, orEmpty: orEmptyCatalog," +
      " onState: onCatalogState, note: catalogNote, paintState: paintCatalogState, missing: catalogMissing," +
      " firstPaintCatalog: firstPaintCatalog, applyLateCatalog: applyLateCatalog, LATE: FMCG_CATALOG_LATE, WAIT_MS: FMCG_CATALOG_WAIT_MS };",
    sb
  );
  w.sb = sb;
  w.t = sb.__t;
  w.ctxRef = { parts: { fileIndex: { generated_at: "2026-10-07T09:00:00" }, projects: ["stare"] }, current: null };
  w.idx = function (t) { return { generated_at: "2026-10-07T" + t + ":00", products: [] }; };
  return w;
}

(async function () {
  var w, r;

  /* --- data spisu --- */
  w = world();
  w.t.paint({ generated_at: "2026-10-07T09:08:41" });
  check(w.meta.textContent === "Spis z 07.10 09:08" && w.meta.decorated === 1, "data spisu: " + w.meta.textContent);
  w.t.paint({});
  check(w.meta.textContent === "", "brak generated_at -> pusty tekst");
  w.t.paint(null);
  check(w.meta.textContent === "", "brak spisu -> pusty tekst, bez wyjatku");

  /* --- poller + odswiezenie --- */
  w = world();
  w.nextRefresh = function () { return Promise.resolve(w.idx("10:00")); };
  w.sb.DamIndexPoller.create({ name: "dashboard", statusPath: "/index/status", onChange: function () { w.t.refresh(w.ctxRef); } });
  w.statusNow = { mtime: "A" };
  await w.advance(31000);
  check(w.refreshCalls === 0, "ta sama generacja -> 0 pobran");
  w.statusNow = { mtime: "B", running: true };
  await w.advance(12000);
  check(w.refreshCalls === 0, "skan w toku -> jeszcze nie odswieza");
  w.statusNow = { mtime: "B" };
  await w.advance(12000);
  check(w.refreshCalls === 1 && w.renders.length === 1 && w.meta.textContent === "Spis z 07.10 10:00", "nowa generacja -> 1 pobranie, 1 rysowanie");
  w.statusNow = { http: 403 };
  await w.advance(40000);
  check(w.refreshCalls === 1, "status 403 -> Pulpit nietkniety");

  /* --- nieudane pobranie i ponowienia --- */
  w = world();
  w.t.paint(w.ctxRef.parts.fileIndex);
  w.nextRefresh = function (n) { return n === 1 ? Promise.reject(new Error("500")) : Promise.resolve(w.idx("12:00")); };
  r = await w.t.refresh(w.ctxRef);
  await w.flush();
  check(r === false && w.renders.length === 0 && w.meta.textContent === "Spis z 07.10 09:00", "blad pobrania: stare dane i stara data");
  await w.advance(14000);
  check(w.refreshCalls === 1, "przed 15 s nie ponawia");
  await w.advance(2000);
  check(w.refreshCalls === 2 && w.meta.textContent === "Spis z 07.10 12:00", "po 15 s ponowienie udane");
  w = world();
  w.nextRefresh = function () { return Promise.reject(new Error("500")); };
  await w.t.refresh(w.ctxRef);
  await w.advance(300000);
  check(w.refreshCalls === 3, "serwer lezy: 1 + 2 ponowienia i stop (pobran=" + w.refreshCalls + ")");

  /* --- kolejnosc odpowiedzi --- */
  w = world();
  var resolveA;
  w.nextRefresh = function (n) { return n === 1 ? new Promise(function (res) { resolveA = res; }) : Promise.resolve(w.idx("15:00")); };
  var p1 = w.t.refresh(w.ctxRef);
  var p2 = w.t.refresh(w.ctxRef);
  await p2;
  await w.flush();
  resolveA(w.idx("14:00"));
  r = await p1;
  check(r === false && w.renders.length === 1 && w.meta.textContent === "Spis z 07.10 15:00", "spozniona starsza odpowiedz odrzucona");

  /* --- otwarte Dostosuj pulpit --- */
  w = world();
  w.customize = true;
  w.nextRefresh = function () { return Promise.resolve(w.idx("16:00")); };
  r = await w.t.refresh(w.ctxRef);
  check(r === true && w.renders.length === 0 && w.meta.textContent === "Spis z 07.10 16:00", "Dostosuj otwarte: siatka nie przerysowana, data nowa");

  /* --- pierwsze pobranie katalogu z bazy: teksty --- */
  w = world();
  check(w.t.note({ state: "waiting" }) === WAIT, "widzety przy czekaniu: " + w.t.note({ state: "waiting" }));
  check(w.t.note({ state: "failed" }) !== "" && w.t.note({ state: "failed" }).indexOf("Pobieram") === -1, "widzety przy porazce nie udaja pobierania");
  check(w.t.note({ state: "ready" }) === "" && w.t.note({ state: "idle" }) === "" && w.t.note({}) === "" && w.t.note(null) === "", "jest spis albo stary loader bez state(): brak notki");
  w.t.paintState({ state: "waiting" });
  check(w.meta.textContent === WAIT, "wiersz statusu przy czekaniu: " + w.meta.textContent);
  w.t.paintState({ state: "failed", message: "" });
  check(w.meta.textContent === FAIL, "wiersz statusu przy porazce bez message: " + w.meta.textContent);
  w.t.paintState({ state: "failed", message: "W bazie nie ma jeszcze katalogu." });
  check(w.meta.textContent === "W bazie nie ma jeszcze katalogu.", "wiersz statusu bierze message loadera");
  w.meta.textContent = "Spis z 07.10 09:00";
  w.t.paintState({ state: "ready" });
  check(w.meta.textContent === "Spis z 07.10 09:00", "stan ready nie zamazuje daty spisu");

  /* --- bramka: Pulpit nie stoi na wiszacym get() --- */
  w = world();
  var hang = new Promise(function () {});
  var gate = w.t.gate();
  var pIdx = w.t.orEmpty(hang, gate, {});
  var settled = null;
  pIdx.then(function (v) { settled = v; });
  await w.flush();
  check(settled === null, "przed zdarzeniem get() wisi (stan idle)");
  w.emit({ state: "waiting", since: 1 });
  await w.flush();
  check(settled && Object.keys(settled).length === 0 && w.meta.textContent === WAIT, "zdarzenie waiting: pusty katalog na pierwszy obraz + tekst w wierszu statusu");

  w = world();
  w.fiState = { state: "failed", message: "" };
  settled = null;
  w.t.orEmpty(hang, w.t.gate(), []).then(function (v) { settled = v; });
  await w.flush();
  check(Array.isArray(settled) && w.meta.textContent === FAIL, "ekran otwarty PO zdarzeniu: stan z DamFileIndex.state()");

  w = world();
  settled = null;
  w.t.orEmpty(Promise.resolve({ generated_at: "x" }), w.t.gate(), {}).then(function (v) { settled = v; });
  await w.flush();
  check(settled && settled.generated_at === "x" && w.meta.textContent === "", "spis jest od razu: bramka nie przeszkadza, zadnego tekstu o pobieraniu");

  /* --- przejscia stanu po pierwszym obrazie --- */
  w = world();
  w.ctxRef.parts = { fileIndex: {}, projects: [] };
  w.ctxRef.current = { fileIndex: {}, projects: [], catalogNote: WAIT };
  w.nextGet = function () { return Promise.resolve(w.idx("17:00")); };
  w.t.onState(w.ctxRef, { state: "waiting" });
  check(w.renders.length === 0, "powtorzone waiting nie przerysowuje siatki");
  w.t.onState(w.ctxRef, { state: "ready" });
  await w.flush();
  await w.flush();
  check(w.getCalls === 1 && w.refreshCalls === 0, "ready: get(), bez refresh() (pobran get=" + w.getCalls + ", refresh=" + w.refreshCalls + ")");
  check(w.renders.join() === "2026-10-07T17:00:00|" && w.meta.textContent === "Spis z 07.10 17:00" && w.ctxRef.parts.projects[0] === "proj", "ready: Pulpit wypelnia sie sam, notka znika, data spisu w wierszu");

  w = world();
  w.ctxRef.parts = { fileIndex: {}, projects: [] };
  w.ctxRef.current = { fileIndex: {}, projects: [], catalogNote: WAIT };
  w.t.onState(w.ctxRef, { state: "failed", message: "" });
  check(w.meta.textContent === FAIL && w.renders.length === 1 && w.renders[0].indexOf("Pobieram") === -1, "failed: komunikat w wierszu, widzety przestaja pisac o pobieraniu");
  w.nextGet = function () { return Promise.reject(new Error("index_first_sync_failed")); };
  r = await w.t.refresh(w.ctxRef, 0, true);
  await w.advance(120000);
  check(r === false && w.getCalls === 1 && w.meta.textContent === FAIL, "ponowna proba po porazce tez nieudana: komunikat zostaje, Pulpit sam nie mieli ponowien (get=" + w.getCalls + ")");
  w.nextGet = function () { return Promise.resolve(w.idx("18:00")); };
  r = await w.t.refresh(w.ctxRef, 0, true);
  check(r === true && w.meta.textContent === "Spis z 07.10 18:00", "po porazce polaczenie wraca: Pulpit wypelniony");

  w = world();
  w.customize = true;
  w.ctxRef.parts = { fileIndex: {}, projects: [] };
  w.ctxRef.current = { fileIndex: {}, projects: [] };
  w.t.onState(w.ctxRef, { state: "waiting" });
  check(w.renders.length === 0 && w.meta.textContent === WAIT && w.ctxRef.current.catalogNote === WAIT, "Dostosuj otwarte: tekst w wierszu, siatka nietknieta");

  w = world();
  w.ctxRef.parts = null;
  w.t.onState(w.ctxRef, { state: "ready" });
  w.t.onState(w.ctxRef, { state: "waiting" });
  check(w.getCalls === 0 && w.renders.length === 0, "zdarzenie przed pierwszym obrazem nic nie psuje");

  /* --- razem z PRAWDZIWYM loaderem (dam-file-index.js): swiezy komputer od 404 do spisu --- */
  async function fresh(snapshots) {
    var now = 1000000, timers = [], tid = 0, listeners = {}, f = { file: null, snapshots: snapshots, meta: { textContent: "" }, renders: [] };
    var sb = {
      console: console, Promise: Promise, String: String, Math: Math, JSON: JSON, Error: Error, parseInt: parseInt, isNaN: isNaN,
      Date: { now: function () { return now; } },
      setTimeout: function (fn, ms) { timers.push({ id: ++tid, at: now + (ms || 0), fn: fn }); return tid; },
      clearTimeout: function (id) { timers = timers.filter(function (t) { return t.id !== id; }); },
      document: { getElementById: function (id) { return id === "damDashIndexMeta" ? f.meta : null; } },
      addEventListener: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
      CustomEvent: function (name, init) { this.type = name; this.detail = init && init.detail; },
      dispatchEvent: function (ev) { (listeners[ev.type] || []).forEach(function (fn) { fn(ev); }); },
      fetch: function (url) {
        url = String(url);
        if (url.indexOf("/index/snapshots") !== -1) {
          return Promise.resolve(f.snapshots ? { ok: true, json: function () { return Promise.resolve(f.snapshots); } } : { ok: false, status: 503 });
        }
        if (url.indexOf("/health") !== -1) return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
        if (url.indexOf("data/file-index.json") !== -1) {
          return Promise.resolve(
            f.file ? { ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(f.file)); } } : { ok: false, status: 404 }
          );
        }
        return Promise.reject(new Error("nieznany adres " + url));
      },
      DamIndexSource: { decorate: function () {}, reload: function () {} },
      DamDashWidgets: { isCustomizeOpen: function () { return false; } },
      buildCtx: function (parts) { return { fileIndex: parts.fileIndex, projects: parts.projects }; },
      render: function (ctx) { f.renders.push((ctx.fileIndex.generated_at || "pusty") + "|" + (ctx.catalogNote || "")); }
    };
    sb.window = sb;
    sb.globalThis = sb;
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(JS, "dam-file-index.js"), "utf8"), sb);
    sb.DamApi = { projects: function () { return sb.DamFileIndex.get().then(function (d) { return { data: d.products || [] }; }); } };
    vm.runInContext(
      chunk + "\nthis.__t = { refresh: refreshFromIndex, gate: catalogGate, orEmpty: orEmptyCatalog, onState: onCatalogState, note: catalogNote, paintState: paintCatalogState, missing: catalogMissing, paint: paintIndexMeta };",
      sb
    );
    f.sb = sb;
    f.t = sb.__t;
    f.flush = function () { return new Promise(function (r) { setImmediate(r); }); };
    f.advance = async function (ms) {
      var end = now + ms;
      for (;;) {
        for (var i = 0; i < 6; i++) await f.flush();
        var due = timers.filter(function (t) { return t.at <= end; }).sort(function (x, y) { return x.at - y.at || x.id - y.id; })[0];
        if (!due) break;
        timers = timers.filter(function (t) { return t !== due; });
        now = due.at;
        due.fn();
      }
      now = end;
      for (var j = 0; j < 6; j++) await f.flush();
    };
    /* to samo, co robi init Pulpitu: bramka, pierwszy obraz z pustym katalogiem, nasluch */
    f.boot = async function () {
      var gate = f.t.gate();
      var pIndex = f.t.orEmpty(sb.DamFileIndex.get().then(function (d) { return d || {}; }).catch(function () { return {}; }), gate, {});
      var pProjects = f.t.orEmpty(sb.DamApi.projects().then(function (r) { return r.data; }).catch(function () { return []; }), gate, []);
      var settledAt = null;
      Promise.all([pIndex, pProjects]).then(function (all) {
        settledAt = now;
        f.ctxRef = { parts: { fileIndex: all[0], projects: all[1] } };
        f.ctxRef.current = sb.buildCtx(f.ctxRef.parts);
        var st0 = sb.DamFileIndex.state();
        f.ctxRef.current.catalogNote = f.t.note(st0);
        sb.render(f.ctxRef.current);
        f.t.paint(f.ctxRef.current.fileIndex);
        f.t.paintState(st0);
        sb.addEventListener("dam:file-index-state", function (ev) { f.t.onState(f.ctxRef, ev.detail); });
      });
      await f.advance(2000);
      return settledAt;
    };
    return f;
  }

  var f = await fresh({ first_sync: { done: false } });
  var at = await f.boot();
  check(at !== null && f.renders.join() === "pusty|" + WAIT && f.meta.textContent === WAIT, "swiezy komputer: pierwszy obraz w 2 s, pusty katalog, tekst czekania (" + f.renders.join() + ")");
  await f.advance(20000);
  check(f.renders.length === 1 && f.meta.textContent === WAIT, "20 s czekania: jeden obraz, bez migania i bez bledu");
  f.file = { generated_at: "2026-10-07T19:00:00", products: [{ id: "p1" }] };
  f.snapshots = { first_sync: { done: true, ok: true } };
  await f.advance(4000);
  check(f.renders[f.renders.length - 1] === "2026-10-07T19:00:00|" && f.meta.textContent === "Spis z 07.10 19:00", "katalog przyszedl: Pulpit wypelnia sie sam (" + f.renders.join(" ; ") + " / " + f.meta.textContent + ")");
  check(f.ctxRef.parts.projects.length === 1, "projekty przeliczone z nowego spisu");
  check(f.sb.DamFileIndex.state().state === "ready", "loader w stanie ready");

  f = await fresh({ first_sync: { done: true }, last: { at: "t1", pull: { ok: true, missing_in_db: ["file-index"] } } });
  await f.boot();
  check(f.meta.textContent.indexOf("W bazie nie ma jeszcze katalogu") === 0, "pusta baza: prawdziwy powod z loadera, nie 'sprawdz polaczenie' (" + f.meta.textContent + ")");
  check(f.renders[f.renders.length - 1].indexOf("Pobieram") === -1 && f.renders[f.renders.length - 1].indexOf("pusty|") === 0, "pusta baza: widzety nie udaja pobierania");

  f = await fresh({ first_sync: { done: true }, last: { at: "t1", pull: { ok: false } } });
  await f.boot();
  check(f.meta.textContent === WAIT, "brak polaczenia z baza: najpierw czekanie (most jeszcze ponawia)");
  await f.advance(70000);
  check(f.meta.textContent === FAIL, "brak polaczenia z baza: po odczekaniu komunikat o polaczeniu (" + f.meta.textContent + ")");
  f.file = { generated_at: "2026-10-07T20:00:00", products: [] };
  await f.t.refresh(f.ctxRef, 0, true);
  await f.advance(4000);
  check(f.meta.textContent === "Spis z 07.10 20:00", "po porazce i powrocie polaczenia: ponowne get() wypelnia Pulpit (" + f.meta.textContent + ")");

  f = await fresh(null);
  f.file = { generated_at: "2026-10-07T21:00:00", products: [] };
  await f.boot();
  check(f.renders.join() === "2026-10-07T21:00:00|" && f.meta.textContent === "Spis z 07.10 21:00", "zwykly start (plik jest): jeden obraz, zadnego tekstu o pobieraniu");

  /* --- poller: pojawienie sie spisu, ktorego wczesniej nie bylo (most: mtime null) --- */
  w = world();
  var seen = 0;
  w.sb.DamIndexPoller.create({ name: "dashboard", statusPath: "/index/status", onChange: function () { seen += 1; } });
  w.statusNow = { ok: true, mtime: null };
  await w.advance(25000);
  check(seen === 0, "brak spisu: poller czeka (zdarzen " + seen + ")");
  w.statusNow = { ok: true, mtime: 1791360000 };
  await w.advance(25000);
  check(seen === 1, "spis sie pojawil: dokladnie jedno zdarzenie (bylo " + seen + ")");
  await w.advance(60000);
  check(seen === 1, "ten sam spis dalej: bez kolejnych zdarzen (bylo " + seen + ")");
  w.statusNow = { ok: true, mtime: 1791360999 };
  await w.advance(25000);
  check(seen === 2, "zwykla zmiana spisu dalej dziala (bylo " + seen + ")");
  /* strona otwarta, gdy spis juz jest: pierwszy odczyt to nie zmiana */
  w = world();
  seen = 0;
  w.sb.DamIndexPoller.create({ name: "x", statusPath: "/index/status", onChange: function () { seen += 1; } });
  w.statusNow = { ok: true, mtime: 5 };
  await w.advance(60000);
  check(seen === 0, "spis byl od poczatku: 0 zdarzen");
  /* most milczy (blad HTTP), potem wraca ze spisem: to nie jest pojawienie sie spisu */
  w = world();
  seen = 0;
  w.sb.DamIndexPoller.create({ name: "y", statusPath: "/index/status", onChange: function () { seen += 1; } });
  w.statusNow = { http: 503 };
  await w.advance(40000);
  w.statusNow = { ok: true, mtime: 5 };
  await w.advance(60000);
  check(seen === 0, "most milczal, potem podal spis: 0 zdarzen (bylo " + seen + ")");
  /* wlasny znacznik braku (Projekty: "brak") nie daje drugiego zdarzenia */
  w = world();
  seen = 0;
  w.sb.DamIndexPoller.create({
    name: "projects", statusPath: "/index/status",
    getGeneration: function (st) { return w.sb.DamIndexPoller.pickGeneration(st) || "brak"; },
    onChange: function () { seen += 1; }
  });
  w.statusNow = { ok: true, mtime: null };
  await w.advance(25000);
  w.statusNow = { ok: true, mtime: 1791360000 };
  await w.advance(60000);
  check(seen === 1, "Projekty (znacznik brak): jedno zdarzenie na pojawienie sie spisu, nie dwa (bylo " + seen + ")");

  /* --- katalog FMCG z mostu nie wstrzymuje pierwszego obrazu (odbior C-2.5.9-110850) --- */
  /* to samo, co robi init: pierwszy obraz po wyscigu, spozniony katalog dochodzi sam */
  function bootWithCatalog(w2, pCatalogReal) {
    var box = { paintedAt: null, late: null };
    var t0 = w2.clockNow();
    w2.t.firstPaintCatalog(pCatalogReal).then(function (cat) {
      box.paintedAt = w2.clockNow() - t0;
      box.late = cat === w2.t.LATE;
      w2.ctxRef.parts = { fileIndex: w2.idx("10:00"), projects: ["p1", "p2"], catalog: box.late ? null : cat };
      w2.ctxRef.current = w2.sb.buildCtx(w2.ctxRef.parts);
      w2.ctxRef.current.dashLoading = false;
      w2.sb.render(w2.ctxRef.current);
      if (box.late) pCatalogReal.then(function (c) { w2.t.applyLateCatalog(w2.ctxRef, c); });
    });
    return box;
  }
  check(world().t.WAIT_MS === 1500, "limit czekania na katalog FMCG przy pierwszym obrazie: 1,5 s");

  w = world();
  var lateResolve;
  var bxc = bootWithCatalog(w, new Promise(function (res) { lateResolve = res; }));
  await w.advance(1400);
  check(bxc.paintedAt === null, "katalog spozniony: przed 1,5 s Pulpit jeszcze czeka");
  await w.advance(200);
  check(bxc.paintedAt === 1500 && bxc.late === true && w.renders.join() === "2026-10-07T10:00:00|", "katalog spozniony: pierwszy obraz po 1,5 s, z produktami, bez katalogu (" + w.renders.join() + ")");
  check(w.ctxRef.parts.projects.length === 2, "katalog spozniony: produkty sa na pierwszym obrazie");
  await w.advance(8000);
  check(w.renders.length === 1, "do czasu odpowiedzi mostu zadnego dodatkowego rysowania");
  lateResolve({ items: [{ id: 1 }], stages: [] });
  await w.advance(500);
  check(w.renders.join() === "2026-10-07T10:00:00|,2026-10-07T10:00:00||katalog" && w.ctxRef.parts.catalog.items.length === 1, "katalog doszedl po 10 s: drugi obraz z katalogiem, razem dokladnie 2 (" + w.renders.join() + ")");
  await w.advance(60000);
  check(w.renders.length === 2, "potem cisza: bez kolejnych przerysowan");

  w = world();
  bxc = bootWithCatalog(w, new Promise(function (res) { w.sb.setTimeout(function () { res({ items: [{ id: 1 }] }); }, 400); }));
  await w.advance(5000);
  check(bxc.paintedAt === 400 && bxc.late === false && w.renders.join() === "2026-10-07T10:00:00||katalog", "katalog na czas (0,4 s): jeden obraz, od razu z katalogiem (" + w.renders.join() + ")");

  w = world();
  bxc = bootWithCatalog(w, new Promise(function () {}));
  await w.advance(600000);
  check(bxc.paintedAt === 1500 && w.renders.join() === "2026-10-07T10:00:00|" && w.meta.textContent === "", "katalog nie dochodzi wcale: Pulpit zostaje z produktami, jeden obraz, zadnego tekstu bledu");
  w.nextRefresh = function () { return Promise.resolve(w.idx("11:00")); };
  r = await w.t.refresh(w.ctxRef);
  check(r === true && w.renders.length === 2, "bez katalogu odswiezanie po zmianie spisu dziala dalej");

  w = world();
  bxc = bootWithCatalog(w, Promise.resolve(null));
  await w.advance(3000);
  check(w.renders.length === 1, "most nie ma katalogu (null): jeden obraz");
  check(w.t.applyLateCatalog(w.ctxRef, null) === false && w.renders.length === 1, "pusty spozniony katalog niczego nie przerysowuje");

  w = world();
  bxc = bootWithCatalog(w, new Promise(function (res) { lateResolve = res; }));
  await w.advance(2000);
  w.customize = true;
  w.ctxRef.current.catalogNote = "notka";
  lateResolve({ items: [{ id: 1 }] });
  await w.advance(100);
  check(w.renders.length === 1 && !!w.ctxRef.current.catalog && w.ctxRef.current.catalogNote === "notka" && w.ctxRef.current.dashLoading === false, "Dostosuj otwarte: spozniony katalog czeka w danych, siatka nietknieta, notka zachowana");

  w = world();
  w.ctxRef.parts = null;
  check(w.t.applyLateCatalog(w.ctxRef, { items: [] }) === false, "spozniony katalog przed pierwszym obrazem nic nie psuje");

  check(/var pCatalog = firstPaintCatalog\(pCatalogReal\);/.test(initPart), "init: pierwszy obraz czeka na katalog przez firstPaintCatalog");
  check(/catalog: all\[7\] === FMCG_CATALOG_LATE \? null : all\[7\]/.test(initPart), "init: znacznik spoznienia nie trafia do danych");
  check(/if \(all\[7\] === FMCG_CATALOG_LATE\) \{\s*pCatalogReal\.then\(function \(catalog\) \{\s*applyLateCatalog\(ctxRef, catalog\);/.test(initPart), "init: spozniony katalog trafia do applyLateCatalog");

  /* --- init: Pulpit faktycznie uzywa bramki i nie odswieza w trakcie czekania --- */
  check(/var gate = catalogGate\(\);/.test(initPart), "init tworzy bramke");
  check((initPart.match(/orEmptyCatalog\(/g) || []).length === 2, "spis i projekty ida przez bramke");
  check(/if \(s === "waiting"\) return;/.test(initPart), "poller nie wola refresh() w trakcie pierwszego pobrania");
  check(/addEventListener\("dam:file-index-state"/.test(initPart), "init slucha zdarzenia loadera");

  /* --- widzety: spokojny stan zamiast zer i 'Brak ...' --- */
  var m = widgets.match(/var CATALOG_WIDGETS = \{([\s\S]*?)\};/);
  check(!!m, "lista widzetow zaleznych od katalogu istnieje");
  var ids = m ? m[1].split(",").map(function (x) { return x.split(":")[0].trim(); }).filter(Boolean) : [];
  ids.forEach(function (id) {
    check(widgets.indexOf('id: "' + id + '"') !== -1, "widzet z listy istnieje: " + id);
  });
  /* kazdy widzet liczony z ctx.fileIndex musi byc na liscie */
  var blocks = widgets.split(/\n      \{\r?\n        id: "/).slice(1);
  blocks.forEach(function (blk) {
    var id = blk.slice(0, blk.indexOf('"'));
    var body = blk.slice(0, blk.indexOf("\n      },"));
    if (/ctx\.fileIndex|pickNewestViz\(|pickNewestProductsF\(/.test(body)) {
      check(ids.indexOf(id) !== -1, "widzet liczony ze spisu jest na liscie CATALOG_WIDGETS: " + id);
    }
  });
  var fnA = widgets.indexOf("  function calmCatalogBody(");
  var fnB = widgets.indexOf("  function renderGrid(");
  check(fnA > 0 && fnB > fnA, "calmCatalogBody istnieje");
  var sb2 = { escapeHtml: function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }, catalogNoteNow: "A<b" };
  vm.createContext(sb2);
  vm.runInContext(widgets.slice(fnA, fnB) + "\nthis.calm = calmCatalogBody;", sb2);
  var bodyEl = { innerHTML: "<p class=\"dam-widget__value\">0</p>" };
  var asked = "";
  sb2.calm({ querySelector: function (sel) { asked = sel; return bodyEl; } }, "products_count");
  check(asked === '[data-widget-id="products_count"] .dam-widget__body', "podmieniana jest tresc kafla, nie caly kafel: " + asked);
  check(bodyEl.innerHTML === '<p class="dam-widget__meta">A&lt;b</p>', "zero znika, tekst zamieniony na bezpieczny: " + bodyEl.innerHTML);
  sb2.calm({ querySelector: function () { return null; } }, "x");
  check(true, "kafel jeszcze nienarysowany: bez wyjatku");
  sb2.catalogNoteNow = "";
  bodyEl.innerHTML = "<p>0</p>";
  sb2.calm({ querySelector: function () { return bodyEl; } }, "products_count");
  check(bodyEl.innerHTML === "", "bez notki: tresc kafla pusta");

  /* prawdziwa petla rysowania z renderGrid: co dostaje kafel w szkielecie, a co po danych */
  var loopA = widgets.indexOf("    order.forEach(function (id) {", fnB);
  var loopB = widgets.indexOf("    placeAsanaHomeBleed();", loopA);
  var ownA = widgets.indexOf("  var OWN_SKELETON");
  check(loopA > fnB && loopB > loopA && ownA > 0 && ownA < fnB, "petla rysowania i lista OWN_SKELETON znalezione");
  function gridWorld(isSkeleton, note) {
    var bodies = {};
    var sb3 = {
      escapeHtml: sb2.escapeHtml, console: { warn: function () {} },
      isSkeleton: isSkeleton, catalogNoteNow: note, ctx: {},
      document: { createElement: function () { return { dataset: {} }; } },
      findWidget: function (id) {
        return { id: id, render: function () { bodies[id] = { innerHTML: isSkeleton && (id === "newest_viz_3" || id === "newest_products_f") ? "SZARE-KARTY" : "<p>0</p>" }; } };
      },
      allowedForRole: function () { return true; },
      shell: function () { return ""; },
      mount: {
        appendChild: function () {},
        querySelector: function (sel) { var mm = sel.match(/data-widget-id="([^"]+)"/); return mm ? bodies[mm[1]] : null; }
      },
      order: ["products_count", "projects_this_month", "newest_viz_3", "newest_products_f", "asana_open", "index_health"]
    };
    vm.createContext(sb3);
    vm.runInContext("var CATALOG_WIDGETS = {" + m[1] + "};\n" + widgets.slice(ownA, fnB) + "\n" + widgets.slice(loopA, loopB), sb3);
    return bodies;
  }
  var g = gridWorld(true, "");
  check(g.products_count.innerHTML === "" && g.projects_this_month.innerHTML === "" && g.index_health.innerHTML === "", "szkielet: kafle liczone ze spisu maja pusta tresc zamiast 0");
  check(g.newest_viz_3.innerHTML === "SZARE-KARTY" && g.newest_products_f.innerHTML === "SZARE-KARTY", "szkielet: listy zachowuja wlasne szare karty");
  check(g.asana_open.innerHTML === "<p>0</p>", "szkielet: kafle spoza spisu bez zmian");
  g = gridWorld(false, "");
  check(g.products_count.innerHTML === "<p>0</p>" && g.newest_viz_3.innerHTML === "<p>0</p>", "po danych: tresc kafli nietknieta (prawdziwe zero zostaje zerem)");
  g = gridWorld(false, WAIT);
  check(g.products_count.innerHTML.indexOf(WAIT) !== -1 && g.newest_viz_3.innerHTML.indexOf(WAIT) !== -1 && g.asana_open.innerHTML === "<p>0</p>", "pierwsze pobranie: notka w kaflach ze spisu, reszta bez zmian");
  check(/catalogNoteNow = String\(ctx\.catalogNote \|\| ""\);/.test(widgets), "renderGrid bierze notke z ctx.catalogNote");
  check((widgets.match(/catalogNoteNow\s*\n?\s*\? escapeHtml\(catalogNoteNow\)/g) || []).length === 2, "przelacznik ukladu w dwoch widzetach nie wraca do 'Brak ...'");

  if (fails) {
    console.error("FAIL: " + fails + " z " + count);
    process.exit(1);
  }
  console.log("OK dashboard index refresh + pierwsze pobranie katalogu (" + count + " asercji)");
  process.exit(0);
})();
