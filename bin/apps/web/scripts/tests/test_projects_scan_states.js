/**
 * Strona Projekty (dam-projects.js), 07.10.2026: "Skanuj dysk" i "Odśwież listę" mowia prawde.
 *  - skan: blad odczytu stanu (HTTP 500) nie jest oglaszany jako "Skan zakończony";
 *    lock_held po doczekaniu konca cudzego skanu = swiezy spis, bez "poczekaj na koniec";
 *    403 / 500 / wyjatek z kodu daja tekst po polsku, nigdy surowe "HTTP 404" ani TypeError;
 *    bez potwierdzenia (pelny skan trwa 20-50 minut) nic nie idzie do mostu.
 *  - przeladowanie listy: dwa wywolania naraz = jedno pobranie; po "dam:index-refreshed"
 *    (alreadyFresh) lista rysuje sie z juz pobranego spisu; nieudane pobranie zostawia liste.
 *  - pierwsze pobranie katalogu z bazy (swiezy komputer bez pliku spisu): licznik czasu
 *    zamiast "Brak file-index.json (404)" / "Błąd API", porazka po polsku z ponowieniem;
 *  - naglowkowe "Pliki" przy trwajacym skanie nie udaje "Odświeżono";
 *  - "Skanuj dysk" nieaktywny z podpowiedzia, gdy most zglasza brak zywego folderu Marketing.
 * Run: node apps/web/scripts/tests/test_projects_scan_states.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-projects.js"), "utf8").replace(/\r\n/g, "\n");
var POLLER = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-index-poller.js"), "utf8");
var from = SRC.indexOf("\n  var _reload = null;");
var to = SRC.indexOf("\n  function bindProjectsSortControl(");
if (from < 0 || to < from) {
  console.error("FAIL dam-projects.js: nie ma bloku reloadProjects..scanDisk");
  process.exit(1);
}
var BLOCK =
  SRC.slice(SRC.indexOf("\n  function clockNow()"), from) +
  SRC.slice(from, to) +
  "\nthis.scanDisk = scanDisk; this.reloadProjects = reloadProjects; this.indexGeneration = indexGeneration;" +
  "\nthis.onIndexState = onIndexState; this.showIndexFail = showIndexFail; this.waitSeconds = waitSeconds;" +
  "\nthis.onHeaderRefreshed = onHeaderRefreshed; this.guardScanButton = guardScanButton;";

var fails = 0;
var count = 0;
function ok(cond, label) {
  count++;
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}

function res(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    json: function () {
      return typeof body === "string" ? Promise.reject(new Error("not json")) : Promise.resolve(body);
    },
  };
}

/* Jedno "okno": o.post = odpowiedz POST /index/rebuild (albo funkcja rzucajaca),
   o.statuses = kolejne odpowiedzi GET /index/status (ostatnia powtarza sie). */
function makeCtx(o) {
  var log = { posts: 0, statusReads: 0, fresh: 0, cached: 0, painted: [], loads: 0 };
  var ctx = {
    log: log,
    state: { all: new Array(186), busy: "", notice: "", scanning: false, seenGen: "", noRoot: false },
    paintStatus: function () {
      log.painted.push(ctx.state.busy || ctx.state.notice);
    },
    loadProjects: function () {
      log.loads++;
      ctx.state.all = new Array(o.after || 190);
      ctx.state.fail = "";
      ctx.state.stamp = o.stampAfter || "2026-10-07T12:00:00";
      return Promise.resolve();
    },
    esc: String,
    setInterval: function () {
      log.intervals = (log.intervals || 0) + 1;
      return 7;
    },
    clearInterval: function (id) {
      if (id) log.cleared = (log.cleared || 0) + 1;
    },
    DamApi: {
      ensureSession: function () {
        return Promise.resolve(o.session || { ok: true });
      },
      authHeaders: function () {
        if (o.headersThrow) throw new TypeError("Cannot read properties of undefined (reading 'token')");
        return {};
      },
      reloadLocalIndex: function () {
        log.fresh++;
        return o.indexFail ? Promise.reject(new Error("Brak file-index.json (500)")) : Promise.resolve({});
      },
      loadLocalIndex: function () {
        log.cached++;
        return Promise.resolve({});
      },
    },
    fetch: function (url, opts) {
      if (opts && opts.method === "POST") {
        log.posts++;
        if (typeof o.post === "function") return o.post();
        return Promise.resolve(o.post);
      }
      if (String(url).indexOf("/data-mode") !== -1) {
        log.modeReads = (log.modeReads || 0) + 1;
        return typeof o.dataMode === "function" ? o.dataMode(log.modeReads) : Promise.resolve(o.dataMode);
      }
      var list = o.statuses || [];
      var s = list[Math.min(log.statusReads, list.length - 1)];
      log.statusReads++;
      return Promise.resolve(s);
    },
    setTimeout: function (fn) {
      return setTimeout(fn, 0);
    },
    Promise: Promise,
    Error: Error,
    Date: Date,
    Math: Math,
    String: String,
  };
  ctx.window = {
    confirm: function () {
      return o.confirm !== false;
    },
    scrollY: 0,
    scrollTo: function () {},
    addEventListener: function (type, fn) {
      (log.listeners = log.listeners || {})[type] = fn;
    },
  };
  vm.createContext(ctx);
  /* Prawdziwy poller (pickGeneration, isRunning), zeby atrapa nie rozjechala sie z kodem. */
  vm.runInContext(POLLER, ctx);
  if (o.genThrow) {
    ctx.window.DamIndexPoller.pickGeneration = function () {
      throw new TypeError("Cannot read properties of undefined");
    };
  }
  vm.runInContext(BLOCK, ctx);
  return ctx;
}

var RUN = res(200, { rebuild_running: true, rebuild: { running: true }, progress: { products_done: 30, products_total: 190, eta_sec: 540 } });
var DONE = res(200, { rebuild_running: false, mtime: 7, rebuild: { running: false, last_ok: true } });
var STARTED = res(200, { ok: true, started: true, running: true });
var btn = { disabled: false };

async function scan(o) {
  var ctx = makeCtx(o);
  await ctx.scanDisk({}, {}, btn);
  return ctx;
}

(async function () {
  var c = await scan({ post: STARTED, statuses: [RUN, RUN, DONE] });
  ok(c.log.posts === 1 && c.log.fresh === 1 && c.log.loads === 1, "skan 200: jeden POST, jedno pobranie spisu");
  ok(/^Skan zakończony o \d\d:\d\d · przybyło 4$/.test(c.state.notice), "skan 200: wynik po polsku (" + c.state.notice + ")");
  ok(c.log.painted.indexOf("Skanuję dysk... 30 z 190 produktów · jeszcze ok. 9 min") !== -1, "skan 200: postep w statusie");
  ok(c.log.painted[0].indexOf("20-50 minut") !== -1, "skan: pierwszy tekst mowi, ile trwa pelny skan");
  ok(c.state.seenGen === "mtime:7" && c.state.scanning === false && c.state.busy === "" && btn.disabled === false, "skan 200: stan posprzatany");

  c = await scan({ post: STARTED, statuses: [res(500, { ok: false })] });
  ok(c.log.statusReads === 5 && c.log.fresh === 0, "stan 500: 5 prob, bez przeladowania");
  ok(c.state.notice.indexOf("Most DAM nie odpowiada") === 0 && c.state.notice.indexOf("zakończony") === -1, "stan 500 to nie 'Skan zakończony' (" + c.state.notice + ")");

  var LOCK = res(200, { rebuild_running: false, mtime: 9, rebuild: { running: false, last_ok: false, last_error: "lock_held" } });
  var OTHER = res(200, { rebuild_running: true, rebuild: { running: false }, progress: { running: true } });
  c = await scan({ post: STARTED, statuses: [OTHER, LOCK] });
  ok(c.log.fresh === 1 && c.state.notice.indexOf("Skan zakończony") === 0, "lock_held po doczekaniu cudzego skanu: swiezy spis (" + c.state.notice + ")");
  c = await scan({ post: STARTED, statuses: [LOCK] });
  ok(c.log.fresh === 0 && c.state.notice.indexOf("Inny skan dysku już trwa") === 0, "lock_held bez widocznego skanu: komunikat o innym skanie");

  c = await scan({ post: STARTED, statuses: [RUN, res(200, { rebuild: { running: false, last_ok: false, last_error: "build_rc_1" } })] });
  ok(c.log.fresh === 0 && c.state.notice === "Skan dysku nie powiódł się - lista pokazuje poprzedni spis", "skan padl (build_rc_1): tekst ogolny");

  var cases = [
    [{ post: res(403, { ok: false, error: "admin_required" }) }, "tylko administrator"],
    [{ post: res(401, { ok: false, error: "login_required" }) }, "Sesja wygasła"],
    [{ post: res(500, "Internal Server Error") }, "Skan dysku nie powiódł się"],
    [{ post: res(404, "Not Found") }, "Skan dysku nie powiódł się"],
    [{ post: res(200, { ok: false, error: "root_partial" }) }, "tylko częściowo"],
    [{ post: function () { return Promise.reject(new TypeError("Failed to fetch")); } }, "skan nie został uruchomiony"],
    [{ post: STARTED, headersThrow: true }, "skan nie został uruchomiony"],
    [{ post: STARTED, statuses: [DONE], genThrow: true }, "Skan dysku nie powiódł się"],
    [{ post: STARTED, session: { ok: false, error: "login_required" } }, "Sesja wygasła"],
  ];
  for (var i = 0; i < cases.length; i++) {
    c = await scan(cases[i][0]);
    var n = c.state.notice;
    ok(n.indexOf(cases[i][1]) !== -1 && !/HTTP|\b\d{3}\b|TypeError|fetch|undefined/.test(n), "blad " + i + " po polsku: " + n);
    ok(c.log.fresh === 0 && c.state.all.length === 186 && btn.disabled === false && !c.state.scanning, "blad " + i + ": lista zostaje, przycisk wraca");
  }
  ok((await scan({ post: STARTED, session: { ok: false } })).log.posts === 0, "bez sesji POST nie idzie do mostu");

  c = await scan({ post: STARTED, statuses: [DONE], confirm: false });
  ok(c.log.posts === 0 && c.log.statusReads === 0 && c.log.painted.length === 0, "bez potwierdzenia nic nie idzie do mostu");

  c = makeCtx({});
  var both = await Promise.all([c.reloadProjects({}, {}, "Odświeżono"), c.reloadProjects({}, {}, "Odświeżono")]);
  ok(both[0] === true && both[1] === true && c.log.fresh === 1 && c.log.loads === 1, "dwa wywolania naraz = jedno pobranie");
  ok(/^Odświeżono o \d\d:\d\d$/.test(c.state.notice) && c.state.busy === "", "po odswiezeniu: komunikat z godzina");

  c = makeCtx({});
  await c.reloadProjects({}, {}, "Odświeżono", true);
  ok(c.log.cached === 1 && c.log.fresh === 0 && c.log.loads === 1, "alreadyFresh: bez drugiego pobrania spisu");

  c = makeCtx({ indexFail: true });
  var bad = await c.reloadProjects({}, {}, "Odświeżono");
  ok(bad === false && c.log.loads === 0 && c.state.all.length === 186, "nieudane pobranie: lista zostaje");
  ok(c.state.notice === "Nie udało się pobrać nowego spisu - lista pokazuje poprzedni" && c.state.busy === "", "nieudane pobranie: komunikat, status odblokowany");
  var again = await c.reloadProjects({}, {}, "Odświeżono");
  ok(again === false && c.log.fresh === 2, "po bledzie kolejna proba pobiera od nowa");

  /* Pierwsze pobranie katalogu z bazy: swiezy komputer, pliku spisu jeszcze nie ma. */
  var grid = { innerHTML: "" };
  c = makeCtx({});
  c.state.all = [];
  c.onIndexState({ state: "waiting", since: Date.now() - 12400 }, grid, {});
  ok(c.state.waitSince > 0 && c.waitSeconds() === " 12 s" && c.log.intervals === 1, "czekam: licznik sekund od startu czekania (" + c.waitSeconds() + ")");
  ok(grid.innerHTML.indexOf("Pobieram katalog produktów z bazy. Lista pojawi się sama.") !== -1 && grid.innerHTML.indexOf("dam-page-status") !== -1, "czekam: w miejscu listy zwykly akapit statusu, bez nowych kafelkow");
  var paintsBefore = c.log.painted.length;
  c.onIndexState({ state: "ready", since: 0 }, grid, {});
  ok(c.state.waitSince === 0 && c.log.cleared === 1, "mam: licznik zatrzymany");
  ok(c.log.painted.length === paintsBefore, "mam przy pustej liscie: bez mrugniecia '0 produktów' przed narysowaniem listy");

  c = makeCtx({});
  c.state.all = [];
  var failErr = new Error("Nie udało się pobrać katalogu z bazy - sprawdź połączenie");
  failErr.code = "index_first_sync_failed";
  c.onIndexState({ state: "waiting", since: Date.now() }, grid, {});
  c.onIndexState({ state: "failed", since: 0, reason: "db" }, grid, {});
  c.showIndexFail(grid, {}, failErr);
  ok(c.state.waitSince === 0 && c.state.fail === failErr.message, "porazka: status = tekst po polsku");
  ok(grid.innerHTML.indexOf(failErr.message + ". Kliknij <strong>Odśwież listę</strong>") !== -1, "porazka: w miejscu listy tekst i wskazanie przycisku ponowienia");
  c.showIndexFail(grid, {}, new Error("Brak file-index.json (404)"));
  ok(c.state.fail === "Nie udało się wczytać spisu produktów" && !/404|file-index|API/.test(grid.innerHTML), "inny blad: tekst ogolny, bez surowego 404 i 'Błąd API'");

  /* "Odśwież listę" po porazce: nadal brak katalogu -> ten sam tekst; potem sukces czysci porazke. */
  c = makeCtx({});
  c.state.all = [];
  c.DamApi.reloadLocalIndex = function () {
    return Promise.reject(failErr);
  };
  ok((await c.reloadProjects(grid, {}, "Odświeżono")) === false && c.state.fail === failErr.message && c.state.busy === "", "ponowienie bez skutku: zostaje komunikat o katalogu");
  c.DamApi.reloadLocalIndex = function () {
    return Promise.resolve({});
  };
  ok((await c.reloadProjects(grid, {}, "Odświeżono")) === true && c.state.fail === "" && c.state.all.length === 190, "ponowienie udane: lista jest, komunikat porazki znika");

  /* Naglowkowe "Pliki": ten sam znacznik spisu to nie "Odświeżono". */
  c = makeCtx({ stampAfter: "2026-10-07T09:08:45", statuses: [RUN] });
  c.state.stamp = "2026-10-07T09:08:45";
  await c.onHeaderRefreshed({}, {});
  ok(c.state.notice === "Skan jeszcze trwa - lista odświeży się sama" && c.log.cached === 1, "Pliki przy trwajacym skanie: prawda zamiast 'Odświeżono' (" + c.state.notice + ")");
  ok(c.log.painted[c.log.painted.length - 1] === c.state.notice && c.log.statusReads === 1, "Pliki przy trwajacym skanie: na ekranie zostaje prawda, jedno pytanie do mostu");
  c = makeCtx({ stampAfter: "2026-10-07T09:08:45", statuses: [DONE] });
  c.state.stamp = "2026-10-07T09:08:45";
  await c.onHeaderRefreshed({}, {});
  ok(c.state.notice === "Spis bez zmian", "Pliki bez skanu i bez nowego spisu: 'Spis bez zmian'");
  c = makeCtx({ stampAfter: "2026-10-07T12:30:00", statuses: [RUN] });
  c.state.stamp = "2026-10-07T09:08:45";
  await c.onHeaderRefreshed({}, {});
  ok(/^Odświeżono o \d\d:\d\d$/.test(c.state.notice) && c.log.statusReads === 0, "Pliki z nowym spisem: 'Odświeżono', bez pytania mostu");
  c = makeCtx({});
  c.state.scanning = true;
  await c.onHeaderRefreshed({}, {});
  ok(c.log.cached === 0 && c.log.fresh === 0, "Pliki w trakcie wlasnego skanu: bez przeladowania");
  c = makeCtx({ statuses: [RUN] });
  await c.onHeaderRefreshed({}, {}, { scanRunning: true });
  ok(c.state.notice === "Skan jeszcze trwa - lista odświeży się sama" && c.log.cached === 0 && c.log.fresh === 0 && c.log.statusReads === 0 && c.state.all.length === 186, "Pliki po limicie 120 s (detail.scanRunning): prawda od razu, bez przeladowania i bez pytania mostu");

  /* "Skanuj dysk" u admina na komputerze bez zywego folderu Marketing. */
  function fakeBtn() {
    var attrs = { title: "Pełny skan", "data-dam-tip": "Skanuj dysk = czyta wszystkie foldery" };
    return {
      disabled: false,
      getAttribute: function (k) {
        return k in attrs ? attrs[k] : null;
      },
      hasAttribute: function (k) {
        return k in attrs;
      },
      setAttribute: function (k, v) {
        attrs[k] = v;
      },
      removeAttribute: function (k) {
        delete attrs[k];
      },
    };
  }
  var b = fakeBtn();
  var alive = false;
  c = makeCtx({
    dataMode: function () {
      return Promise.resolve(res(200, { ok: true, mode: "live", root_alive: alive }));
    },
  });
  await c.guardScanButton(b);
  ok(b.getAttribute("aria-disabled") === "true" && b.disabled === false, "brak ROOT: przycisk nieaktywny przez aria-disabled (dymek programu pomija disabled)");
  ok(b.getAttribute("data-dam-tip").indexOf("nie ma podłączonego całego folderu Marketing") !== -1 && b.getAttribute("data-dam-tip") === b.getAttribute("title"), "brak ROOT: podpowiedz w dymku programu i w natywnym title");
  await c.scanDisk({}, {}, b);
  ok(c.log.posts === 0 && c.state.notice.indexOf("skan dysku jest tu niedostępny") !== -1 && !c.state.scanning, "brak ROOT: klikniecie nic nie wysyla do mostu, status mowi dlaczego");
  alive = true;
  await c.log.listeners.focus();
  ok(b.getAttribute("aria-disabled") === null && b.getAttribute("title") === "Pełny skan" && b.getAttribute("data-dam-tip").indexOf("Skanuj dysk =") === 0, "ROOT wrocil (powrot do okna): przycisk i podpowiedzi jak przedtem");
  b.removeAttribute("title");
  alive = false;
  await c.log.listeners.focus();
  ok(b.getAttribute("aria-disabled") === "true" && !b.hasAttribute("title"), "title zabrany przez dam-tooltips.js: nie dokladamy natywnego dymka obok programu");
  var silent = [res(500, "x"), res(200, { ok: false, error: "boom" }), res(200, { ok: true, mode: "live" })];
  for (var s = 0; s < silent.length; s++) {
    b = fakeBtn();
    await makeCtx({ dataMode: silent[s] }).guardScanButton(b);
    ok(b.getAttribute("aria-disabled") === null && b.getAttribute("title") === "Pełny skan", "most nie podaje root_alive (" + s + "): przycisku nie ruszamy");
  }
  b = fakeBtn();
  c = makeCtx({ dataMode: function () { return Promise.reject(new TypeError("Failed to fetch")); } });
  await c.guardScanButton(b);
  ok(b.getAttribute("aria-disabled") === null && c.state.noRoot === false, "most milczy: przycisku nie ruszamy");

  c = makeCtx({});
  ok(
    c.indexGeneration({ mtime: null }) === "brak" && c.indexGeneration({ mtime: 5 }) === "mtime:5",
    "swiezy komputer: brak pliku spisu ma wlasny znacznik, wiec pierwsze pobranie z bazy to zmiana"
  );

  if (fails) process.exit(1);
  console.log("OK test_projects_scan_states: " + count + " asercji");
})().catch(function (e) {
  console.error("FAIL wyjatek testu: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
