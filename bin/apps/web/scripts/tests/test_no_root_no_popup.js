/**
 * 07.10.2026 - komputer bez folderu Marketing widzi katalog z bazy bez przeszkod.
 * Zgloszenie z prawdziwego okna (odbior C-2.5.8-104900 t060, C-2.5.9-110850 t030): okno
 * "Ścieżka Marketing na tym komputerze" wyskakiwalo na Pulpicie i znowu na Projektach.
 *  - wejscie na 3 strony bez ROOT = 0 okien;
 *  - akcja wymagajaca dysku = 1 okno, najwyzej raz na uruchomienie programu (potem komunikat);
 *  - swiadome "Wskaż folder" otwiera okno zawsze;
 *  - komputer z dzialajacym ROOT = bez zmian (zadnego okna, akcja idzie do mostu);
 *  - naglowek: "Bez dysku" ze spokojna kropka i bez czerwonego paska zamiast "Brak ścieżki".
 * Run: node bin/apps/web/scripts/tests/test_no_root_no_popup.js
 *      (DAM_PATHS_SRC / DAM_ROOT_STATUS_SRC podmieniaja badane pliki)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var JS = path.join(__dirname, "..", "..", "assets", "js");
var PATHS_SRC = process.env.DAM_PATHS_SRC || path.join(JS, "dam-paths.js");
var STATUS_SRC = process.env.DAM_ROOT_STATUS_SRC || path.join(JS, "dam-root-status.js");
var fails = 0;
var count = 0;
function ok(cond, label) {
  count++;
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}
function wait(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function storage(init) {
  var store = Object.assign({}, init || {});
  return {
    _store: store,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
}

/* Jedno "uruchomienie programu" = wspolne localStorage + sessionStorage dla kolejnych stron. */
function newRun(hasRoot) {
  var base = hasRoot ? { dam_base_path: "M:\\", "dam_base_path::dev-1": "M:\\" } : {};
  return {
    hasRoot: hasRoot,
    local: storage(Object.assign({ dam_device_id: "dev-1", dam_token: "t" }, base)),
    session: storage(),
    log: { modals: 0, toasts: [], posts: [] }
  };
}

/* Wejscie na strone: swiezy kontekst skryptu, ten sam stan programu. */
function openPage(run, page) {
  var log = run.log;
  var modalOpen = false;
  var handlers = {};
  function stub(id) {
    return {
      id: id, value: "", hidden: false, style: {}, textContent: "", placeholder: "", innerHTML: "",
      classList: { add: function () {}, remove: function () {}, toggle: function () {} },
      addEventListener: function (type, fn) { handlers[id + ":" + type] = fn; },
      setAttribute: function () {}, getAttribute: function () { return null; },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; },
      appendChild: function () {}, focus: function () {}, select: function () {},
      remove: function () { if (this.id === "damBasePathModal") modalOpen = false; }
    };
  }
  var routes = {
    "GET /machine-config": { ok: true, base_path: run.hasRoot ? "M:\\" : "", root_generation: run.hasRoot ? 1 : 0 },
    "GET /user-device-paths/current": { ok: true, device_id: "dev-1", base_path: run.hasRoot ? "M:\\" : "", source: run.hasRoot ? "machine-config-fallback" : "unset" },
    "GET /detect-marketing-bases": { ok: true, bases: [], recommended: "" },
    "GET /health": { ok: true },
    "POST /open": { ok: true }
  };
  var document = {
    readyState: "complete",
    body: { appendChild: function (el) { if (el && el.id === "damBasePathModal") { modalOpen = true; log.modals++; } } },
    addEventListener: function () {},
    createElement: function () { return stub(""); },
    getElementById: function (id) {
      if (String(id).indexOf("damBasePath") !== 0) return null;
      if (!modalOpen) return null;
      return stub(id);
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
  /* stub("") z createElement dostaje id nadane przez kod (modal.id = ...): appendChild czyta je pozniej. */
  var win = {
    addEventListener: function () {},
    dispatchEvent: function () { return true; },
    DamRuntime: { bridgeUrl: function () { return "http://bridge"; } },
    DamShell: { toast: function (msg) { log.toasts.push(msg); } },
    localStorage: run.local
  };
  function fetch(url, opts) {
    var p = String(url).replace("http://bridge", "").replace(/\?.*$/, "");
    var method = (opts && opts.method) || "GET";
    if (method !== "GET") log.posts.push(method + " " + p);
    var body = routes[method + " " + p];
    return Promise.resolve({ status: body ? 200 : 404, ok: !!body, json: function () { return Promise.resolve(body || {}); } });
  }
  var ctx = { window: win, document: document, localStorage: run.local, sessionStorage: run.session,
    location: { pathname: "/" + page + ".html" }, navigator: { clipboard: { writeText: function () { return Promise.resolve(); } } },
    fetch: fetch, CustomEvent: function () {}, Promise: Promise, console: console, JSON: JSON, Object: Object,
    /* stary kod otwieral okno po 600 ms: w tescie od razu, zeby nie czekac naprawde */
    setTimeout: function (fn) { return setTimeout(fn, 0); }, clearTimeout: clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(PATHS_SRC, "utf8"), ctx, { filename: "dam-paths.js" });
  return {
    DamPaths: win.DamPaths,
    click: function (id) { if (handlers[id + ":click"]) handlers[id + ":click"]({ preventDefault: function () {}, stopPropagation: function () {} }); },
    isOpen: function () { return modalOpen; }
  };
}

/* ---- naglowek: dam-root-status.js ---- */
function makeStatus(o) {
  function el(tag) {
    var cls = {};
    var kids = {};
    var attrs = {};
    var e = {
      tag: tag, id: "", title: "", innerHTML: "", textContent: "", hidden: false, className: "",
      classList: {
        toggle: function (c, on) { cls[c] = !!on; },
        add: function (c) { cls[c] = true; },
        remove: function (c) { cls[c] = false; },
        contains: function (c) { return !!cls[c]; }
      },
      setAttribute: function (k, v) { attrs[k] = String(v); },
      getAttribute: function (k) { return k in attrs ? attrs[k] : null; },
      addEventListener: function (type, fn) { e["on" + type] = fn; },
      appendChild: function () {},
      insertBefore: function () {},
      querySelector: function (sel) { kids[sel] = kids[sel] || el("child"); return kids[sel]; }
    };
    return e;
  }
  var log = { opened: 0, styles: [] };
  var nodes = {};
  var host = el("div");
  var body = el("body");
  var document = {
    readyState: "loading",
    body: body,
    head: { appendChild: function (s) { log.styles.push(s.textContent || ""); nodes[s.id] = s; } },
    addEventListener: function () {},
    createElement: function (tag) { return el(tag); },
    getElementById: function (id) { return nodes[id] || null; },
    querySelector: function (sel) { return sel === ".geex-content__header__action" ? host : null; }
  };
  host.insertBefore = function (child) { nodes[child.id] = child; };
  body.appendChild = function (child) { nodes[child.id] = child; };
  var win = {
    DamRuntime: { bridgeUrl: function () { return "http://bridge"; } },
    DamPaths: {
      getBasePath: function () { return o.root || ""; },
      openSetupModal: function () { log.opened++; }
    },
    addEventListener: function () {},
    dispatchEvent: function () { return true; },
    location: { pathname: "/index.html", href: "" }
  };
  var ctx = {
    window: win, document: document,
    localStorage: { getItem: function () { return ""; }, setItem: function () {} },
    fetch: function () {
      if (o.bridgeDown) return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve(o.status || {}); } });
    },
    CustomEvent: function () {}, Promise: Promise, console: console, JSON: JSON,
    setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () {},
    encodeURIComponent: encodeURIComponent
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(STATUS_SRC, "utf8"), ctx, { filename: "dam-root-status.js" });
  return { status: win.DamRootStatus, log: log, body: body, pill: function () { return nodes.damRootStatus; }, bar: function () { return nodes.damOfflineBar; } };
}

(async function () {
  /* 1. Bez ROOT: Pulpit -> Projekty -> Eksplorator w jednym uruchomieniu programu. */
  var run = newRun(false);
  var pg;
  var pages = ["dashboard", "index", "explorer"];
  for (var i = 0; i < pages.length; i++) {
    pg = openPage(run, pages[i]);
    await wait(40);
  }
  ok(run.log.modals === 0, "bez ROOT: wejscie na 3 strony = 0 okien (bylo: " + run.log.modals + ")");
  ok(run.log.toasts.length === 0 && run.log.posts.length === 0, "bez ROOT: wejscie na strone nic nie komunikuje i nic nie zapisuje do mostu");
  ok(pg.DamPaths.hasBasePath() === false, "bez ROOT: sciezka nadal nieustawiona (nic nie zgadnieto)");

  /* 2. Akcja wymagajaca dysku: pierwsze otwarcie oryginalu = 1 okno. */
  var r = await pg.DamPaths.openInDefaultApp("M:/Marketing/- POLSKA/x/plik.pdf");
  await wait(20);
  ok(run.log.modals === 1 && pg.isOpen() && r && r.error === "no_base_path", "akcja wymagajaca dysku: 1 okno");
  ok(run.log.toasts.join("|") === "Najpierw wskaż folder Marketing na tym komputerze", "akcja: komunikat po polsku z ogonkami (" + run.log.toasts.join("|") + ")");
  pg.click("damBasePathClose");
  ok(pg.isOpen() === false, "okno zamkniete krzyzykiem");

  /* 3. Kolejne akcje w tym samym uruchomieniu: bez okna, sam komunikat - takze na innej stronie. */
  await pg.DamPaths.revealInExplorer("M:/Marketing/- POLSKA/x");
  await pg.DamPaths.openFolderInExplorer("M:/Marketing/- POLSKA/x");
  pg = openPage(run, "visualizations");
  await wait(40);
  await pg.DamPaths.openFileAndCopyPath("M:/Marketing/- POLSKA/x/plik.pdf");
  await pg.DamPaths.shareViaSynology("M:/Marketing/- POLSKA/x/plik.pdf");
  await wait(20);
  ok(run.log.modals === 1, "kolejne akcje i kolejna strona: nadal 1 okno na uruchomienie (jest: " + run.log.modals + ")");
  ok(run.log.toasts.length === 5 && run.log.toasts[4].indexOf("wymaga folderu Marketing") !== -1 && run.log.toasts[4].indexOf("Wskaż folder") !== -1, "kolejne akcje: komunikat mowi, gdzie ustawic folder");
  ok(run.log.posts.length === 0, "bez ROOT: zadna akcja nie poszla do mostu");

  /* 4. Swiadome "Wskaż folder" otwiera okno zawsze. */
  pg.DamPaths.openSetupModal();
  ok(run.log.modals === 2 && pg.isOpen(), "swiadome Wskaż folder: okno otwiera sie mimo limitu");
  pg.click("damBasePathSkip");
  ok(pg.isOpen() === false && run.session.getItem("dam_basepath_later") === "1", "Zrobię to później: zamyka i zapamietuje do konca uruchomienia");

  /* 5. Nowe uruchomienie programu: limit liczony od nowa. */
  run = newRun(false);
  pg = openPage(run, "dashboard");
  await wait(40);
  await pg.DamPaths.openInDefaultApp("M:/Marketing/- POLSKA/x/plik.pdf");
  await pg.DamPaths.openInDefaultApp("M:/Marketing/- POLSKA/x/plik.pdf");
  ok(run.log.modals === 1, "nowe uruchomienie: znowu najwyzej 1 okno");

  /* 6. "Zrobię to później" przed pierwsza akcja: akcja juz nie otwiera okna. */
  run = newRun(false);
  pg = openPage(run, "dashboard");
  await wait(40);
  pg.DamPaths.openSetupModal();
  pg.click("damBasePathSkip");
  await pg.DamPaths.openInDefaultApp("M:/Marketing/- POLSKA/x/plik.pdf");
  ok(run.log.modals === 1 && run.log.toasts.length === 1 && run.log.toasts[0].indexOf("wymaga folderu Marketing") !== -1, "po 'Zrobię to później' akcja daje sam komunikat");

  /* 7. Komputer z dzialajacym ROOT: bez zmian. */
  run = newRun(true);
  for (i = 0; i < pages.length; i++) {
    pg = openPage(run, pages[i]);
    await wait(40);
  }
  ok(run.log.modals === 0 && run.log.toasts.length === 0, "z ROOT: 3 strony, 0 okien, 0 komunikatow");
  r = await pg.DamPaths.openInDefaultApp("M:/Marketing/- POLSKA/x/plik.pdf");
  await wait(20);
  ok(run.log.modals === 0 && r && r.ok === true && run.log.posts.some(function (p) { return p.indexOf("POST /open") === 0; }), "z ROOT: otwarcie pliku idzie do mostu, bez okna (" + run.log.posts.join(", ") + ")");
  ok(run.log.toasts.join("|").indexOf("wskaż folder") === -1 && run.log.toasts.join("|").indexOf("Wskaż folder") === -1, "z ROOT: zadnego komunikatu o wskazywaniu folderu");

  /* 8. Naglowek bez ROOT: spokojny wskaznik zamiast alarmu. */
  var s = makeStatus({ root: "" });
  await s.status.check();
  var pill = s.pill();
  var label = pill.querySelector(".dam-root-status__label").innerHTML;
  ok(/>Bez<\/span>.*>dysku<\/span>/.test(label), "naglowek bez ROOT: 'Bez dysku' (" + label + ")");
  ok(pill.title.indexOf("Tryb bez dysku - widzisz katalog z bazy") === 0, "naglowek bez ROOT: podpowiedz mowi, ze katalog z bazy dziala");
  ok(pill.classList.contains("is-nodisk") && !pill.classList.contains("is-offline") && !pill.classList.contains("is-online"), "naglowek bez ROOT: stan is-nodisk, nie is-offline");
  ok(!s.body.classList.contains("dam-bridge-offline") && !(s.bar() && s.bar().classList.contains("is-active")), "naglowek bez ROOT: bez czerwonego paska u gory okna");
  ok(s.log.styles.join("").indexOf(".dam-root-status.is-nodisk .dam-root-status__dot{background:var(--dam-text-muted);}") !== -1 && !/#[0-9a-fA-F]{3,6}|rgb\(/.test(s.log.styles.join("")), "kropka: kolor z tokenu, bez surowych kolorow");
  var pick = pill.querySelector("#damRootResetBtn");
  ok(pick.hidden === false, "naglowek bez ROOT: przycisk Wskaż folder widoczny");
  s = makeStatus({ root: "" });
  s.status.start();
  pick = s.pill().querySelector("#damRootResetBtn");
  pick.onclick({ preventDefault: function () {} });
  ok(s.log.opened === 1, "Wskaż folder w naglowku otwiera okno sciezki");

  /* 9. Naglowek: pozostale stany bez zmian. */
  s = makeStatus({ root: "M:\\", status: { online: true, state: "full", root: "M:\\" } });
  await s.status.check();
  pill = s.pill();
  ok(pill.classList.contains("is-online") && !pill.classList.contains("is-nodisk") && /Pliki.*online/.test(pill.querySelector(".dam-root-status__label").innerHTML) && !s.body.classList.contains("dam-bridge-offline"), "z ROOT: Pliki online, jak dotad");
  s = makeStatus({ root: "M:\\", status: { online: false, exists: false } });
  await s.status.check();
  pill = s.pill();
  ok(pill.classList.contains("is-offline") && !pill.classList.contains("is-nodisk") && s.body.classList.contains("dam-bridge-offline"), "sciezka ustawiona, dysku nie ma: Pliki offline z paskiem, jak dotad");
  s = makeStatus({ root: "M:\\", bridgeDown: true });
  await s.status.check();
  pill = s.pill();
  ok(pill.classList.contains("is-offline") && /Most.*offline/.test(pill.querySelector(".dam-root-status__label").innerHTML) && s.body.classList.contains("dam-bridge-offline"), "most nie odpowiada: Most offline z paskiem, jak dotad");

  console.log(fails ? "FAILED " + fails : "OK test_no_root_no_popup.js: " + count + " asercji");
  process.exit(fails ? 1 : 0);
})().catch(function (e) {
  console.error("FAIL wyjatek testu: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
