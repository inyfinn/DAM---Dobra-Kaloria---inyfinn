/**
 * 07.10.2026 - "Użytkownik nie może być niepewny, czy coś działa, czy nie działa" (wlasciciel).
 * Objaw z prawdziwego okna (ROOT M: dziala): po wejsciu na strone czerwone "Pliki offline",
 * czerwona linia u gory i baner "Pracujesz bez folderu Marketing", po kilku sekundach samo znika.
 * Przyczyna: most oddaje "dysk nie odpowiada" natychmiast, gdy rownolegle trwa inna sonda tego
 * samego folderu. Interfejs nie moze brac jednej takiej odpowiedzi za rozstrzygajaca:
 *  - sonda w toku = stan neutralny (bez czerwieni, bez linii, bez banera);
 *  - rozstrzygajace "jest" = bez alarmu w zadnej klatce, takze gdy wczesniej padlo jedno falszywe "nie ma";
 *  - rozstrzygajace "nie ma" (druga z rzedu odpowiedz) = alarm, prawdziwy brak dysku nie jest wyciszany.
 * Run: node bin/apps/web/scripts/tests/test_root_status_no_false_alarm.js
 *      (DAM_ROOT_STATUS_SRC / DAM_PREFLIGHT_SRC podmieniaja badane pliki)
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var JS = path.join(__dirname, "..", "..", "assets", "js");
var STATUS_SRC = process.env.DAM_ROOT_STATUS_SRC || path.join(JS, "dam-root-status.js");
var PREFLIGHT_SRC = process.env.DAM_PREFLIGHT_SRC || path.join(JS, "dam-preflight.js");
var fails = 0;
var count = 0;
function ok(cond, label) {
  count++;
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}
function tick() {
  return new Promise(function (r) { setTimeout(r, 5); });
}

var ON = { online: true, state: "full", root: "M:\\", timeout: false, exists: true, missing: [] };
var BUSY = { online: false, state: "none", timeout: true, exists: false, missing: ["-- ARCHIWUM --", "- EKSPORT", "- POLSKA"] };

/* o.answers: kolejne odpowiedzi GET /files/status (ostatnia sie powtarza); "pending" = most jeszcze nie odpowiedzial. */
function makeStatus(o) {
  var log = { fetches: 0, alarmFrames: 0, frames: 0, timers: [] };
  var nodes = {};
  var pending = [];
  function el() {
    var cls = {};
    var kids = {};
    var attrs = {};
    var e = {
      id: "", title: "", innerHTML: "", textContent: "", hidden: false, className: "",
      classList: {
        toggle: function (c, on) { cls[c] = !!on; frame(); },
        add: function (c) { cls[c] = true; frame(); },
        remove: function (c) { cls[c] = false; frame(); },
        contains: function (c) { return !!cls[c]; }
      },
      setAttribute: function (k, v) { attrs[k] = String(v); },
      getAttribute: function (k) { return k in attrs ? attrs[k] : null; },
      addEventListener: function () {},
      appendChild: function () {},
      querySelector: function (sel) { kids[sel] = kids[sel] || el(); return kids[sel]; }
    };
    return e;
  }
  var host = el();
  var body = el();
  /* "Klatka": kazda zmiana klas. Alarm = czerwona pigulka, czerwona linia albo klasa offline na <body>. */
  function alarmNow() {
    var pill = nodes.damRootStatus;
    var bar = nodes.damOfflineBar;
    return !!((pill && pill.classList.contains("is-offline")) || (bar && bar.classList.contains("is-active")) || body.classList.contains("dam-bridge-offline"));
  }
  function frame() {
    log.frames++;
    if (alarmNow()) log.alarmFrames++;
  }
  host.insertBefore = function (child) { nodes[child.id] = child; };
  body.appendChild = function (child) { nodes[child.id] = child; };
  var document = {
    readyState: "loading", body: body,
    head: { appendChild: function (s) { nodes[s.id] = s; } },
    addEventListener: function () {},
    createElement: function () { return el(); },
    getElementById: function (id) { return nodes[id] || null; },
    querySelector: function (sel) { return sel === ".geex-content__header__action" ? host : null; }
  };
  var win = {
    DamRuntime: { bridgeUrl: function () { return "http://bridge"; }, ready: true },
    DamPaths: { getBasePath: function () { return "M:\\"; } },
    DamCacheSync: {}, DamDataMode: {},
    addEventListener: function () {}, dispatchEvent: function () { return true; },
    location: { pathname: "/dashboard.html", href: "" }
  };
  var ctx = {
    window: win, document: document,
    localStorage: { getItem: function () { return ""; }, setItem: function () {} },
    fetch: function () {
      var a = o.answers[Math.min(log.fetches, o.answers.length - 1)];
      log.fetches++;
      if (a === "pending") return new Promise(function (resolve) { pending.push(resolve); });
      if (a === "down") return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve(a); } });
    },
    CustomEvent: function () {}, Promise: Promise, console: console, JSON: JSON,
    /* ponowne pytanie (potwierdzenie) zamawiane przez setTimeout: test odpala je sam */
    setTimeout: function (fn, ms) { log.timers.push({ fn: fn, ms: ms }); return log.timers.length; },
    clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {},
    encodeURIComponent: encodeURIComponent
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(STATUS_SRC, "utf8"), ctx, { filename: "dam-root-status.js" });
  return {
    status: win.DamRootStatus, log: log, alarmNow: alarmNow,
    pill: function () { return nodes.damRootStatus; },
    label: function () { return nodes.damRootStatus.querySelector(".dam-root-status__label").innerHTML; },
    answer: function (a) { pending.shift()({ ok: true, json: function () { return Promise.resolve(a); } }); },
    confirm: function () { var t = log.timers.pop(); return t ? t.fn() : null; },
    lastTimer: function () { return log.timers[log.timers.length - 1]; }
  };
}

/* ---- baner dam-preflight.js ---- */
function makePreflight(reports) {
  var log = { fetches: 0, banners: 0, maxBanners: 0, timers: [] };
  var nodes = {};
  function node(tag) {
    var n = { tag: tag, id: "", className: "", textContent: "", childNodes: [], parentNode: null, disabled: false,
      classList: { contains: function () { return false; }, toggle: function () {}, add: function () {}, remove: function () {} },
      setAttribute: function () {}, addEventListener: function () {},
      appendChild: function (c) { n.childNodes.push(c); c.parentNode = n; return c; },
      insertBefore: function (c) { n.childNodes.push(c); c.parentNode = n; if (c.id) { nodes[c.id] = c; if (c.id === "damPreflightBar") { log.banners++; log.maxBanners++; } } return c; },
      removeChild: function (c) { if (c.id && nodes[c.id] === c) { delete nodes[c.id]; if (c.id === "damPreflightBar") log.banners--; } },
      querySelector: function () { return null; } };
    return n;
  }
  var body = node("body");
  var document = { readyState: "complete", body: body, head: node("head"),
    addEventListener: function () {}, createElement: node,
    getElementById: function (id) { return nodes[id] || null; },
    querySelector: function () { return null; } };
  var ctx = { window: { addEventListener: function () {}, DamRuntime: { bridgeUrl: function () { return "http://bridge"; } }, location: { href: "" } },
    document: document, localStorage: { getItem: function () { return null; }, setItem: function () {} },
    fetch: function () {
      var r = reports[Math.min(log.fetches, reports.length - 1)];
      log.fetches++;
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve(r); } });
    },
    setTimeout: function (fn, ms) { log.timers.push({ fn: fn, ms: ms }); return log.timers.length; },
    clearTimeout: function () {}, Promise: Promise, console: console, JSON: JSON, Object: Object, Array: Array, String: String };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(PREFLIGHT_SRC, "utf8"), ctx, { filename: "dam-preflight.js" });
  return { pre: ctx.window.DamPreflight, log: log };
}

var M_BAD = { ok: true, items: [{ id: "marketing", ok: false, level: "info", label: "Pracujesz bez folderu Marketing - miniatury z pamięci podręcznej", hint: "Dysk nie odpowiada (sieć lub VPN).", action: "pick_marketing" }] };
var M_OK = { ok: true, items: [{ id: "marketing", ok: true, label: "Folder Marketing: M:\\", hint: "" }] };
var DB_BAD = { ok: true, items: [{ id: "database", group: "database", ok: false, level: "warn", label: "Baza Synology nie odpowiada (tryb offline)", hint: "x" }, M_BAD.items[0]] };

(async function () {
  /* 1. Sonda w toku: stan neutralny. */
  var s = makeStatus({ answers: ["pending", ON] });
  s.status.start();
  await tick();
  var pill = s.pill();
  ok(pill && pill.classList.contains("is-checking") && !pill.classList.contains("is-offline") && !pill.classList.contains("is-online"), "sonda w toku: pigulka w stanie neutralnym (ani online, ani offline)");
  var firstLabel = (pill.innerHTML.match(/dam-root-status__label">(.*?)<\/span><\/span>/) || ["", ""])[1];
  ok(pill.title === "Sprawdzam dysk..." && />Pliki</.test(firstLabel) && !/online|offline/.test(firstLabel), "sonda w toku: 'Sprawdzam dysk...', bez slowa online/offline (" + firstLabel + ")");
  ok(!s.alarmNow() && / id="damRootResetBtn" hidden /.test(pill.innerHTML), "sonda w toku: bez czerwonej linii, przycisk Wskaż folder ukryty");
  ok(s.log.alarmFrames === 0, "sonda w toku: zadnej klatki z alarmem");
  s.answer(ON);
  await tick();
  ok(pill.classList.contains("is-online") && !pill.classList.contains("is-checking") && /Pliki.*online/.test(s.label()) && s.log.alarmFrames === 0, "rozstrzygajace 'jest': Pliki online, zero klatek z alarmem (" + s.log.alarmFrames + " z " + s.log.frames + ")");

  /* 2. Trzy zdarzenia startu naraz = jedno pytanie do mostu. */
  s = makeStatus({ answers: ["pending", ON] });
  var a = s.status.check();
  var b = s.status.check();
  var c = s.status.check();
  ok(s.log.fetches === 1 && a === b && b === c, "trzy check() naraz: jedno pytanie do mostu (bylo: " + s.log.fetches + ")");
  s.answer(ON);
  await a;

  /* 3. Falszywe "nie odpowiada" (most zajety inna sonda), potem "jest": bez alarmu w zadnej klatce. */
  s = makeStatus({ answers: [BUSY, ON] });
  s.status.start();
  await tick();
  pill = s.pill();
  ok(!s.alarmNow() && pill.classList.contains("is-checking") && s.log.alarmFrames === 0, "jedno 'nie odpowiada' na starcie: nadal stan neutralny, bez alarmu");
  ok(s.lastTimer() && s.lastTimer().ms === 2000, "jedno 'nie odpowiada': zamowione potwierdzenie po 2 s");
  await s.confirm();
  await tick();
  ok(pill.classList.contains("is-online") && s.log.alarmFrames === 0, "potwierdzenie mowi 'jest': Pliki online, zero klatek z alarmem przez cale wejscie");

  /* 4. Dysk dzialal, jedno falszywe "nie odpowiada" w trakcie pracy: zostaje "Pliki online". */
  s = makeStatus({ answers: [ON, BUSY, ON] });
  await s.status.check();
  await s.status.check();
  ok(s.pill().classList.contains("is-online") && s.log.alarmFrames === 0, "dysk dzialal, jedno 'nie odpowiada': zostaje Pliki online, bez mrugniecia");
  await s.status.check();
  ok(s.pill().classList.contains("is-online") && s.log.alarmFrames === 0, "nastepna odpowiedz 'jest': licznik potwierdzen wyzerowany");

  /* 5. Rozstrzygajace "nie ma": druga z rzedu odpowiedz = alarm. */
  s = makeStatus({ answers: [BUSY, BUSY] });
  s.status.start();
  await tick();
  ok(!s.alarmNow(), "prawdziwy brak dysku, pierwsza odpowiedz: jeszcze bez alarmu");
  await s.confirm();
  await tick();
  pill = s.pill();
  ok(s.alarmNow() && pill.classList.contains("is-offline") && !pill.classList.contains("is-checking") && /Pliki.*offline/.test(s.label()), "prawdziwy brak dysku, druga odpowiedz: Pliki offline z czerwona linia");
  ok(pill.querySelector("#damRootResetBtn").hidden === false, "prawdziwy brak dysku: przycisk Wskaż folder widoczny");

  /* 6. Most nie odpowiada wcale: tez dopiero po potwierdzeniu. */
  s = makeStatus({ answers: ["down", "down"] });
  await s.status.check();
  ok(!s.alarmNow(), "most milczy, pierwsza proba: bez alarmu");
  await s.status.check();
  ok(s.alarmNow() && /Most.*offline/.test(s.label()), "most milczy, druga proba: Most offline");

  /* 7. Baner Pulpitu: jeden raport "folder niedostepny" nie pokazuje banera. */
  var p = makePreflight([M_BAD, M_OK]);
  await p.pre.check();
  ok(p.log.banners === 0 && p.log.maxBanners === 0, "baner: jeden raport 'dysk nie odpowiada' = bez banera");
  ok(p.log.timers.length && p.log.timers[p.log.timers.length - 1].ms === 2000, "baner: zamowione potwierdzenie po 2 s");
  await p.pre.check();
  ok(p.log.maxBanners === 0, "baner: potwierdzenie mowi 'jest' = baner nie pojawil sie ani razu");

  p = makePreflight([M_BAD, M_BAD]);
  await p.pre.check();
  await p.pre.check();
  ok(p.log.banners === 1, "baner: dwa raporty z rzedu 'folder niedostepny' = baner jest (prawdziwy brak dysku)");

  p = makePreflight([M_OK, M_BAD, M_OK, M_BAD, M_BAD]);
  await p.pre.check(); await p.pre.check(); await p.pre.check(); await p.pre.check();
  ok(p.log.maxBanners === 0, "baner: pojedyncze 'nie ma' przedzielone 'jest' nie sumuja sie");
  await p.pre.check();
  ok(p.log.banners === 1, "baner: dopiero dwa z rzedu");

  /* 8. Problem z baza w tym samym raporcie pokazuje sie od razu (osobny pasek), bez czekania na dysk. */
  p = makePreflight([DB_BAD]);
  await p.pre.check();
  ok(p.log.banners === 0, "baza nie odpowiada + pierwszy raport o dysku: baner dysku czeka na potwierdzenie");

  console.log(fails ? "FAILED " + fails : "OK test_root_status_no_false_alarm.js: " + count + " asercji");
  process.exit(fails ? 1 : 0);
})().catch(function (e) {
  console.error("FAIL wyjatek testu: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
