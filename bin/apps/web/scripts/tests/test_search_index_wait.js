/**
 * DamSearch na swiezym komputerze: instalator nie wozi search-index.json, plik przychodzi
 * z bazy. 404 = czekanie ("Pobieram katalog z bazy..."), ponawianie odczytu co 3 s do 180 s,
 * po porazce tekst wspolnego loadera. Plik od razu = zero dodatkowych pytan.
 * Prawdziwy dam-search.js, udawany zegar i fetch, bez przegladarki.
 * Run: node apps/web/scripts/tests/test_search_index_wait.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var code = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-search.js"), "utf8");
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

var SI = { by_tag: {}, by_base: {}, association_reverse: {} };
var FI = { generated_at: "2026-10-07T10:00:00", products: [{ id: "arbuz", name: "ARBUZ", revisions: [] }] };

/* page: "index" (pobiera tez spis plikow przez loader) albo "explorer" (tylko spis wyszukiwarki) */
function world(page) {
  var now = 7000000, timers = [], tid = 0, listeners = {};
  var w = { searchFetches: 0, otherFetches: [], events: [], loader: { state: "idle" }, loaderGets: 0 };
  w.searchStatus = 200;
  w.flush = async function () { for (var i = 0; i < 6; i++) await new Promise(function (r) { setImmediate(r); }); };
  w.advance = async function (ms) {
    var end = now + ms;
    for (;;) {
      await w.flush();
      var due = timers.filter(function (t) { return t.at <= end; }).sort(function (x, y) { return x.at - y.at || x.id - y.id; })[0];
      if (!due) break;
      timers = timers.filter(function (t) { return t !== due; });
      now = due.at;
      due.fn();
    }
    now = end;
    await w.flush();
  };
  w.pendingTimers = function () { return timers.length; };
  var win = {
    addEventListener: function (n, fn) { (listeners[n] = listeners[n] || []).push(fn); },
    removeEventListener: function (n, fn) { listeners[n] = (listeners[n] || []).filter(function (x) { return x !== fn; }); },
    dispatchEvent: function (ev) { w.events.push(ev.type + ":" + (ev.detail && ev.detail.state)); (listeners[ev.type] || []).slice().forEach(function (fn) { fn(ev); }); },
    DamFileIndex: {
      state: function () { return w.loader; },
      invalidate: function () {},
      get: function () { w.loaderGets += 1; return w.loaderGet ? w.loaderGet() : Promise.resolve(FI); }
    }
  };
  w.listenerCount = function (n) { return (listeners[n] || []).length; };
  w.emitLoader = function (detail) { w.loader = detail; win.dispatchEvent({ type: "dam:file-index-state", detail: detail }); };
  var sb = {
    window: win,
    document: { readyState: "complete", addEventListener: function () {} },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    location: { pathname: page === "explorer" ? "/explorer.html" : "/index.html" },
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    Date: { now: function () { return now; } },
    setTimeout: function (fn, ms) { timers.push({ id: ++tid, at: now + (ms || 0), fn: fn }); return tid; },
    clearTimeout: function (id) { timers = timers.filter(function (t) { return t.id !== id; }); },
    Promise: Promise, console: console,
    fetch: function (url) {
      url = String(url);
      if (url.indexOf("data/search-index.json") !== -1) {
        w.searchFetches += 1;
        var st = typeof w.searchStatus === "function" ? w.searchStatus(w.searchFetches) : w.searchStatus;
        return Promise.resolve(st === 200 ? { ok: true, status: 200, json: function () { return Promise.resolve(SI); } } : { ok: false, status: st });
      }
      /* slownik semantyczny brandingu: modul pobiera go raz przy starcie, niezaleznie od spisu */
      if (/data\/(semantic-vocabulary|branding-recognition)\.json/.test(url)) return Promise.resolve({ ok: false, status: 404 });
      w.otherFetches.push(url);
      return Promise.reject(new Error("nieoczekiwany adres: " + url));
    }
  };
  vm.createContext(sb);
  vm.runInContext(code, sb);
  w.S = win.DamSearch;
  w.win = win;
  return w;
}

function settle(p) {
  var box = { state: "pending" };
  p.then(function (v) { box.state = "ok"; box.value = v; }, function (e) { box.state = "err"; box.error = e; });
  return box;
}

(async function () {
  var w, r;

  /* --- plik jest od razu: zero dodatkowych pytan --- */
  w = world("index");
  r = settle(w.S.load());
  await w.flush();
  check(r.state === "ok" && w.searchFetches === 1, "plik od razu: jedno pobranie spisu wyszukiwarki (bylo " + w.searchFetches + ")");
  check(w.pendingTimers() === 0 && w.events.length === 0 && w.otherFetches.length === 0, "plik od razu: zero licznikow czasu, zero zdarzen, zero innych pytan (liczniki " + w.pendingTimers() + ", zdarzenia " + w.events.join() + ")");
  check(w.listenerCount("dam:file-index-state") === 0, "plik od razu: zadnego nasluchu loadera");
  check(w.S.catalogWaiting() === false, "plik od razu: catalogWaiting() = false");
  await w.advance(200000);
  check(w.searchFetches === 1, "plik od razu: potem cisza przez 200 s");

  /* --- czekam -> mam (Eksplorator: bez loadera spisu plikow) --- */
  w = world("explorer");
  w.searchStatus = function (n) { return n <= 4 ? 404 : 200; };
  r = settle(w.S.load({ searchOnly: true }));
  await w.flush();
  check(r.state === "pending" && w.events.join() === "dam:search-index-state:waiting" && w.S.catalogWaiting() === true, "404: czekanie zamiast bledu, jedno zdarzenie waiting (" + w.events.join() + ")");
  check(w.loaderGets === 0, "Eksplorator: bez DamFileIndex.get() (pelny spis 9 MB)");
  await w.advance(2900);
  check(w.searchFetches === 1, "przed 3 s nie ponawia");
  await w.advance(200);
  check(w.searchFetches === 2, "po 3 s pierwsze ponowienie");
  await w.advance(9000);
  check(r.state === "ok" && r.value.searchIndex === SI && w.searchFetches === 5, "plik przyszedl przy 5. odczycie: obietnica rozwiazana spisem (odczytow " + w.searchFetches + ")");
  check(w.S.catalogWaiting() === false && w.pendingTimers() === 0 && w.listenerCount("dam:file-index-state") === 0, "po sukcesie: koniec petli, nasluch zdjety");
  await w.advance(60000);
  check(w.searchFetches === 5 && w.otherFetches.length === 0, "po sukcesie zadnych dalszych pytan; mostu nie pytalismy ani razu");

  /* --- czekam -> porazka po 180 s (loader nic nie mowi) --- */
  w = world("explorer");
  w.searchStatus = 404;
  r = settle(w.S.load({ searchOnly: true }));
  await w.advance(177000);
  check(r.state === "pending", "w 177 s nadal czeka");
  await w.advance(6000);
  check(r.state === "err" && r.error.message === FAIL && r.error.code === "index_first_sync_failed", "po 180 s: tekst jak w loaderze (" + (r.error && r.error.message) + ")");
  check(w.searchFetches >= 59 && w.searchFetches <= 61, "przez 180 s odczyt co 3 s (bylo " + w.searchFetches + ")");
  var n0 = w.searchFetches;
  await w.advance(60000);
  check(w.searchFetches === n0 && w.S.catalogWaiting() === false, "po porazce koniec petli");
  w.searchStatus = 200;
  r = settle(w.S.load({ searchOnly: true }));
  await w.flush();
  check(r.state === "ok", "po porazce nastepne zapytanie probuje od nowa i dostaje spis");

  /* --- czekam -> porazka ogloszona przez loader --- */
  w = world("explorer");
  w.searchStatus = 404;
  r = settle(w.S.load({ searchOnly: true }));
  await w.advance(4000);
  w.emitLoader({ state: "failed", since: 1, message: "W bazie nie ma jeszcze katalogu produktów." });
  await w.flush();
  check(r.state === "err" && r.error.message === "W bazie nie ma jeszcze katalogu produktów.", "zdarzenie failed loadera: jego tekst, od razu (" + (r.error && r.error.message) + ")");
  n0 = w.searchFetches;
  await w.advance(30000);
  check(w.searchFetches === n0, "po porazce z loadera zadnych dalszych odczytow");

  w = world("explorer");
  w.searchStatus = 404;
  w.loader = { state: "failed", since: 2, message: "" };
  r = settle(w.S.load({ searchOnly: true }));
  await w.flush();
  check(r.state === "err" && r.error.message === FAIL && w.searchFetches === 1, "loader juz w stanie failed: porazka od razu, jeden odczyt, domyslny tekst");

  /* --- zdarzenie ready loadera: sprawdz od razu --- */
  w = world("explorer");
  w.searchStatus = 404;
  r = settle(w.S.load({ searchOnly: true }));
  await w.advance(1000);
  w.searchStatus = 200;
  w.emitLoader({ state: "ready", since: 3 });
  await w.flush();
  check(r.state === "ok" && w.searchFetches === 2, "zdarzenie ready: odczyt od razu, bez czekania na 3 s");
  w = world("explorer");
  w.searchStatus = 404;
  r = settle(w.S.load({ searchOnly: true }));
  await w.advance(1000);
  w.emitLoader({ state: "ready", since: 3 });
  await w.advance(1000);
  check(r.state === "pending", "ready, ale spisu wyszukiwarki jeszcze nie ma: czekamy dalej");
  w.searchStatus = 200;
  await w.advance(3000);
  check(r.state === "ok", "...i dostajemy go przy nastepnym odczycie");

  /* --- jedna petla na strone, takze przy force --- */
  w = world("explorer");
  w.searchStatus = 404;
  var a = settle(w.S.load({ searchOnly: true }));
  await w.flush();
  var b = settle(w.S.load({ searchOnly: true, force: true }));
  var c = settle(w.S.load({ searchOnly: true }));
  await w.advance(30000);
  check(w.searchFetches <= 13 && w.pendingTimers() === 1, "trzy wywolania, jedna petla (odczytow " + w.searchFetches + ", licznikow " + w.pendingTimers() + ")");
  check(w.events.length === 1, "jedno zdarzenie waiting na cale czekanie (" + w.events.length + ")");
  w.searchStatus = 200;
  await w.advance(3000);
  check(a.state === "ok" && b.state === "ok" && c.state === "ok", "wszyscy czekajacy dostaja spis");

  /* --- inne bledy jak dawniej --- */
  w = world("explorer");
  w.searchStatus = 500;
  r = settle(w.S.load({ searchOnly: true }));
  await w.flush();
  check(r.state === "err" && r.error.message === "search-index.json" && !r.error.code && w.pendingTimers() === 0, "blad 500 to nie brak katalogu: od razu, bez petli");

  /* --- strona ze spisem plikow: loader czeka, pole wyszukiwania mowi dlaczego --- */
  function box(w2) {
    var input = { value: "", listeners: {}, addEventListener: function (n, fn) { this.listeners[n] = fn; } };
    var results = { innerHTML: "", style: {}, contains: function () { return false; }, querySelectorAll: function () { return []; }, addEventListener: function () {} };
    w2.S.bindSearchBox(input, results, function () {}, null, {});
    return { input: input, results: results, type: function (q) { input.value = q; input.listeners.input(); } };
  }
  w = world("index");
  w.searchStatus = 404;
  var loaderResolve;
  w.loaderGet = function () { w.loader = { state: "waiting", since: 5 }; return new Promise(function (res) { loaderResolve = res; }); };
  var bx = box(w);
  bx.type("arbuz");
  await w.advance(200);
  check(bx.results.innerHTML.indexOf(WAIT) !== -1 && bx.results.style.display === "block", "pole wyszukiwania w trakcie czekania: " + bx.results.innerHTML.replace(/<[^>]+>/g, ""));
  check(bx.results.innerHTML.indexOf("search-index.json") === -1 && bx.results.innerHTML.indexOf("d indeksu") === -1, "pole: bez surowego bledu");
  w.searchStatus = 200;
  w.loader = { state: "ready", since: 5 };
  loaderResolve(FI);
  await w.advance(3500);
  check(bx.results.innerHTML.indexOf(WAIT) === -1 && /arbuz|ARBUZ|Arbuz/.test(bx.results.innerHTML), "katalog przyszedl: pole pokazuje wyniki zapytania wpisanego w trakcie czekania");

  w = world("explorer");
  w.searchStatus = 404;
  w.win._DAM_FILE_INDEX = FI;
  bx = box(w);
  bx.type("arbuz");
  await w.advance(200);
  check(bx.results.innerHTML.indexOf(WAIT) !== -1, "Eksplorator: pole mowi o pobieraniu takze bez loadera spisu plikow");
  w.emitLoader({ state: "failed", since: 9, message: "W bazie nie ma jeszcze katalogu produktów." });
  await w.flush();
  check(bx.results.innerHTML.indexOf("W bazie nie ma jeszcze katalogu produkt") !== -1 && bx.results.innerHTML.indexOf("d indeksu") === -1, "porazka: sam tekst loadera, bez przedrostka 'Blad indeksu' (" + bx.results.innerHTML.replace(/<[^>]+>/g, "") + ")");
  bx.type("");
  await w.advance(200);
  check(bx.results.innerHTML === "" , "puste pole: bez tekstu o pobieraniu");

  w = world("explorer");
  w.searchStatus = 500;
  w.win._DAM_FILE_INDEX = FI;
  bx = box(w);
  bx.type("arbuz");
  await w.advance(200);
  check(bx.results.innerHTML.indexOf("Błąd indeksu: search-index.json") !== -1, "inny blad: 'Blad indeksu' z ogonkami (" + bx.results.innerHTML.replace(/<[^>]+>/g, "") + ")");
  check(code.indexOf("Blad indeksu") === -1, "dam-search.js: nie ma juz 'Blad indeksu' bez ogonkow");

  if (fails) {
    console.error("FAIL: " + fails + " z " + count);
    process.exit(1);
  }
  console.log("OK search index wait (" + count + " asercji)");
  process.exit(0);
})();
