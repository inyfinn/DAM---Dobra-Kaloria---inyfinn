/**
 * Wspolny loader spisu (dam-file-index.js), 07.10.2026: instalator nie pakuje spisu,
 * wiec na swiezym komputerze data/file-index.json przez pierwsze sekundy nie istnieje.
 *  - plik jest od razu: zachowanie jak dotad, zero zdarzen, zero pytan o /index/snapshots;
 *  - 404 + most mowi "pierwsze pobranie trwa": get() wisi, potem oddaje spis (waiting -> ready);
 *  - 404 + most mowi "pobranie sie nie powiodlo": blad po polsku z powodem (waiting -> failed);
 *  - kazde zdarzenie dam:file-index-state przychodzi raz, takze przy kilku get() naraz;
 *  - get({ wait: false }) (spis opcjonalny, np. wykrycie ROOT) nie wisi na pierwszym pobraniu;
 *  - "Odśwież listę" po powrocie bazy: most ponawia pobranie co 5 s, lista jest w kilka sekund;
 *  - ekrany, ktorym spis tylko dopisuje nazwy, wolaja get({ wait: false }).
 * Czas jest sztuczny (wlasny zegar i kolejka setTimeout), test nie czeka naprawde.
 * Run: node apps/web/scripts/tests/test_file_index_first_sync.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-file-index.js"), "utf8");

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
  var text = typeof body === "string" ? body : JSON.stringify(body || {});
  return {
    ok: status >= 200 && status < 300,
    status: status,
    text: function () {
      return Promise.resolve(text);
    },
    json: function () {
      return Promise.resolve(JSON.parse(text));
    },
  };
}

var INDEX = { generated_at: "2026-10-07T09:08:45", products: [{ id: "a" }, { id: "b" }] };
var WAITING = { ok: true, first_sync: { done: false, ok: null }, last: {} };
function dbDown(at) {
  return { ok: true, first_sync: { done: true, ok: false }, last: { at: at, pull: { ok: false, error: "timeout expired" } } };
}

/* o.file(n, url)  -> odpowiedz n-tego odczytu data/file-index.json (numeracja od 1),
   o.snap(n)      -> tresc n-tej odpowiedzi GET /index/snapshots; null = most milczy,
   o.health       -> tresc GET /health (domyslnie brak znacznika). */
function makeWin(o) {
  var log = { file: 0, snap: 0, health: 0, events: [], urls: [] };
  var clock = 1000000;
  var timers = [];
  var seq = 0;
  var ctx = {
    log: log,
    fetch: function (url) {
      url = String(url);
      if (url.indexOf("/index/snapshots") !== -1) {
        log.snap++;
        var s = o.snap ? o.snap(log.snap) : WAITING;
        return s === null ? new Promise(function () {}) : Promise.resolve(res(200, s));
      }
      if (url.indexOf("/health") !== -1) {
        log.health++;
        return Promise.resolve(res(200, o.health || { ok: true }));
      }
      log.file++;
      log.urls.push(url);
      return Promise.resolve(o.file(log.file, url));
    },
    setTimeout: function (fn, ms) {
      seq++;
      timers.push({ id: seq, at: clock + (ms || 0), fn: fn });
      return seq;
    },
    clearTimeout: function (id) {
      timers = timers.filter(function (t) {
        return t.id !== id;
      });
    },
    Date: {
      now: function () {
        return clock;
      },
    },
    CustomEvent: function (type, init) {
      this.type = type;
      this.detail = init && init.detail;
    },
    dispatchEvent: function (ev) {
      log.events.push(ev.detail.state + (ev.detail.reason ? ":" + ev.detail.reason : ""));
      log.lastDetail = ev.detail;
    },
    JSON: JSON,
    Promise: Promise,
    Error: Error,
    Math: Math,
    String: String,
    console: console,
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  ctx.elapsed = function () {
    return clock - 1000000;
  };
  /* Wykonuje obietnice i sztuczne timery, az p sie rozstrzygnie. */
  ctx.settle = async function (p) {
    var out = null;
    p.then(
      function (v) {
        out = { value: v };
      },
      function (e) {
        out = { error: e };
      }
    );
    for (var i = 0; i < 2000 && !out; i++) {
      await new Promise(setImmediate);
      if (out) break;
      if (!timers.length) continue;
      timers.sort(function (a, b) {
        return a.at - b.at || a.id - b.id;
      });
      var t = timers.shift();
      clock = Math.max(clock, t.at);
      t.fn();
    }
    if (!out) throw new Error("obietnica nie rozstrzygnieta w 2000 krokach");
    return out;
  };
  return ctx;
}

(async function () {
  /* 1. Plik jest od razu: nic sie nie zmienia. */
  var c = makeWin({
    file: function () {
      return res(200, INDEX);
    },
    health: { ok: true, watcher: { last_finished: "2026-10-07T09:08:45" } },
  });
  var r = await c.settle(c.DamFileIndex.get());
  ok(r.value && r.value.products.length === 2, "plik jest: get() oddaje spis");
  ok(c.log.file === 1 && c.log.snap === 0 && c.log.events.length === 0, "plik jest: jeden odczyt, zero pytan o pierwsze pobranie, zero zdarzen");
  ok(c.log.urls[0] === "data/file-index.json?v=b20261007T090845", "plik jest: adres ze znacznikiem przebudowy z /health (" + c.log.urls[0] + ")");
  ok(c.DamFileIndex.state().state === "ready" && c.DamFileIndex.peek() === r.value, "plik jest: stan ready, peek() ma spis");
  ok(c.DamFileIndex.get() === c.DamFileIndex.get() && c.log.file === 1, "plik jest: kolejne get() to ta sama obietnica");

  /* 2. Czekam -> mam. Trzy get() naraz (w tym jedno po invalidate) = jedna petla i po jednym zdarzeniu. */
  c = makeWin({
    file: function (n) {
      return n < 7 ? res(404, "") : res(200, INDEX);
    },
  });
  var p1 = c.DamFileIndex.get();
  var p2 = c.DamFileIndex.get();
  ok(c.DamFileIndex.state().state === "idle", "czekam: przed pierwsza odpowiedzia stan idle");
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  ok(c.log.events.join() === "waiting" && c.DamFileIndex.state().state === "waiting", "czekam: zdarzenie waiting zaraz po pierwszym 404 (" + c.log.events.join() + ")");
  var since = c.DamFileIndex.state().since;
  c.DamFileIndex.invalidate();
  var p3 = c.DamFileIndex.get();
  r = await c.settle(Promise.all([p1, p2, p3]));
  ok(r.value && r.value[0].products.length === 2 && r.value[2].products.length === 2, "czekam -> mam: wiszace get() oddaja spis, takze to po invalidate()");
  ok(c.log.events.join() === "waiting,ready", "czekam -> mam: zdarzenia przychodza raz (" + c.log.events.join() + ")");
  ok(since === 1000000 && c.log.lastDetail.state === "ready", "czekam -> mam: since = start czekania");
  ok(c.log.snap >= 3 && c.log.snap <= 6, "czekam -> mam: jedna wspolna petla pyta most (" + c.log.snap + " pytan)");
  ok(c.elapsed() >= 9000 && c.elapsed() <= 18000, "czekam -> mam: odczyt co 3 s (" + c.elapsed() + " ms)");
  ok(c.DamFileIndex.peek() && c.DamFileIndex.state().state === "ready", "czekam -> mam: stan ready, peek() ma spis");

  /* 2a. Spis opcjonalny: get({ wait: false }) nie wisi, a zwykle get() obok czeka dalej. */
  c = makeWin({
    file: function (n) {
      return n < 5 ? res(404, "") : res(200, INDEX);
    },
  });
  var opt = c.DamFileIndex.get({ wait: false });
  var full = c.DamFileIndex.get();
  r = await c.settle(opt);
  ok(r.error && r.error.message === "Brak file-index.json (404)" && c.elapsed() === 0, "wait:false przy braku pliku: blad od razu, jak dawniej");
  ok(c.log.events.join() === "waiting" && c.log.snap === 1, "wait:false: petla czekania i tak ruszyla (zdarzenie waiting, pytanie do mostu)");
  r = await c.settle(c.DamFileIndex.get({ wait: false }));
  ok(r.error && c.log.events.join() === "waiting", "wait:false w trakcie czekania: blad od razu, bez nowego zdarzenia");
  r = await c.settle(full);
  ok(r.value && r.value.products.length === 2 && c.log.events.join() === "waiting,ready", "wait:false nie psuje zwyklego get(): spis przychodzi");
  r = await c.settle(c.DamFileIndex.get({ wait: false }));
  ok(r.value && r.value.products.length === 2, "wait:false, gdy spis jest: oddaje spis");

  /* 3. Czekam -> porazka: baza niedostepna, most nie ponawia (last.at stoi). */
  c = makeWin({
    file: function () {
      return res(404, "");
    },
    snap: function (n) {
      return n < 3 ? WAITING : dbDown("2026-10-07T10:00:20Z");
    },
  });
  r = await c.settle(c.DamFileIndex.get());
  ok(r.error && r.error.code === "index_first_sync_failed" && r.error.reason === "db", "porazka: blad z kodem i powodem db");
  ok(r.error && r.error.message === "Nie udało się pobrać katalogu z bazy - sprawdź połączenie", "porazka: tekst po polsku (" + (r.error && r.error.message) + ")");
  ok(c.log.events.join() === "waiting,failed:db", "czekam -> porazka: zdarzenia raz (" + c.log.events.join() + ")");
  ok(c.log.lastDetail.message === r.error.message && c.DamFileIndex.state().state === "failed", "porazka: detail.message = tekst bledu, stan failed");
  ok(c.elapsed() >= 15000 && c.elapsed() < 30000, "porazka: most nie ponawia -> koniec po ok. 15 s od nieudanej proby (" + c.elapsed() + " ms)");
  ok(!/404|file-index|HTTP/.test(r.error.message), "porazka: bez surowego 404 w tekscie");

  /* 3a. Po porazce nastepne get() probuje od nowa; gdy plik juz jest - raz "ready". */
  var c3 = makeWin({
    file: function (n) {
      return n < 3 ? res(404, "") : res(200, INDEX);
    },
    snap: function () {
      return { ok: true, first_sync: { done: true, ok: true }, last: { at: "x", pull: { ok: true, missing_in_db: ["file-index"] } } };
    },
  });
  r = await c3.settle(c3.DamFileIndex.get());
  ok(r.error && r.error.reason === "empty_db" && r.error.message.indexOf("W bazie nie ma jeszcze katalogu") === 0, "pusta baza: porazka od razu, wlasny tekst");
  ok(c3.elapsed() < 3000, "pusta baza: bez odliczania (" + c3.elapsed() + " ms)");
  r = await c3.settle(c3.DamFileIndex.get());
  ok(r.value && r.value.products.length === 2 && c3.log.events.join() === "waiting,failed:empty_db,ready", "po porazce kolejne get() pobiera i oglasza ready (" + c3.log.events.join() + ")");

  /* 3b. Baza chwilowo niedostepna, most ponawia (last.at sie zmienia) i w koncu pobiera. */
  c = makeWin({
    file: function (n) {
      return n < 12 ? res(404, "") : res(200, INDEX);
    },
    snap: function (n) {
      return dbDown("proba-" + Math.floor(n / 2));
    },
  });
  r = await c.settle(c.DamFileIndex.get());
  ok(r.value && c.log.events.join() === "waiting,ready", "most ponawia: czekamy do skutku, bez falszywej porazki (" + c.log.events.join() + ")");

  /* 3c. Most ponawia, ale baza nie wraca: koniec po 60 s. */
  c = makeWin({
    file: function () {
      return res(404, "");
    },
    snap: function (n) {
      return dbDown("proba-" + n);
    },
  });
  r = await c.settle(c.DamFileIndex.get());
  ok(r.error && r.error.reason === "db" && c.elapsed() >= 60000 && c.elapsed() < 70000, "most ponawia bez skutku: porazka po 60 s (" + c.elapsed() + " ms)");

  /* 3d. "Odśwież listę" po powrocie bazy. Most po nieudanym pobraniu ponawia co 5 s
     (latka mostu do Wydania 1): last.at zmienia sie przy kazdej probie, a pierwsza udana
     zapisuje plik. Bez tej latki most stoi 10 minut - wtedy konczy sie jak w 3. */
  var backAt = -1;
  c = makeWin({
    file: function () {
      return backAt >= 0 && c.elapsed() >= backAt + 5000 ? res(200, INDEX) : res(404, "");
    },
    snap: function () {
      if (backAt < 0) return dbDown("stoi");
      if (c.elapsed() < backAt + 5000) return dbDown("proba-" + Math.floor(c.elapsed() / 5000));
      return { ok: true, first_sync: { done: true, ok: true }, last: { at: "udana", pull: { ok: true, pulled: [{ key: "file-index" }] } } };
    },
  });
  r = await c.settle(c.DamFileIndex.get());
  ok(r.error && r.error.reason === "db", "baza lezy: porazka (stan wyjsciowy dla ponowienia)");
  backAt = c.elapsed();
  c.DamFileIndex.invalidate();
  r = await c.settle(c.DamFileIndex.get());
  var tookMs = c.elapsed() - backAt;
  ok(r.value && r.value.products.length === 2, "Odśwież listę po powrocie bazy: lista jest");
  ok(tookMs >= 5000 && tookMs <= 9000, "Odśwież listę po powrocie bazy: w kilka sekund (" + tookMs + " ms = ponowienie mostu 5 s + odczyt co 3 s)");
  ok(c.log.events.join() === "waiting,failed:db,waiting,ready", "Odśwież listę po powrocie bazy: bez drugiej porazki po drodze (" + c.log.events.join() + ")");

  /* 3e. Most caly czas mowi "pierwsze pobranie trwa": bezpiecznik 180 s. */
  c = makeWin({
    file: function () {
      return res(404, "");
    },
  });
  r = await c.settle(c.DamFileIndex.get());
  ok(r.error && r.error.reason === "timeout" && c.elapsed() >= 180000 && c.elapsed() < 190000, "pobranie trwa bez konca: bezpiecznik 180 s (" + c.elapsed() + " ms)");

  /* 4. Tryb lokalny bez spisu, most bez pola first_sync, most milczy. */
  c = makeWin({
    file: function () {
      return res(404, "");
    },
    snap: function () {
      return { ok: true, first_sync: { done: true, ok: true }, last: { pull: { ok: true, skipped_local_mode: true } } };
    },
  });
  r = await c.settle(c.DamFileIndex.get());
  ok(r.error && r.error.reason === "local_mode" && r.error.message.indexOf("tryb") !== -1, "tryb lokalny: wlasny powod i tekst");

  c = makeWin({
    file: function () {
      return res(404, "");
    },
    snap: function () {
      return { ok: false, error: "boom" };
    },
  });
  r = await c.settle(c.DamFileIndex.get());
  ok(r.error && r.error.reason === "bridge" && c.elapsed() < 3000, "most bez first_sync: porazka od razu, powod bridge");

  c = makeWin({
    file: function () {
      return res(404, "");
    },
    snap: function () {
      return null;
    },
  });
  r = await c.settle(c.DamFileIndex.get());
  ok(r.error && r.error.reason === "bridge" && c.elapsed() >= 60000 && c.elapsed() < 70000, "most milczy: porazka po 60 s (" + c.elapsed() + " ms)");
  ok(c.log.events.join() === "waiting,failed:bridge", "most milczy: zdarzenia raz");

  /* 5. Inny blad niz 404 nie jest "pierwszym pobraniem": stary komunikat, bez zdarzen. */
  c = makeWin({
    file: function () {
      return res(500, "");
    },
  });
  r = await c.settle(c.DamFileIndex.get());
  ok(r.error && r.error.message === "Brak file-index.json (500)" && c.log.snap === 0 && c.log.events.length === 0, "500: jak dotad, bez czekania i zdarzen");
  ok(c.DamFileIndex.state().state === "idle", "500: stan bez zmian");

  /* 6. Ekrany, ktorych wlasne dane przychodza z mostu, a spis tylko dopisuje nazwy
     (wykrywanie ROOT, skrzynka, kolejka wykrojnikow), nie moga wisiec na pierwszym pobraniu. */
  ["dam-paths.js", "dam-inbox.js", "dam-wykrojnik-queue.js"].forEach(function (name) {
    var js = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", name), "utf8");
    ok(js.indexOf("DamFileIndex.get({ wait: false })") !== -1 && js.indexOf("DamFileIndex.get()") === -1, name + ": spis opcjonalny przez get({ wait: false })");
  });

  if (fails) process.exit(1);
  console.log("OK test_file_index_first_sync: " + count + " asercji");
})().catch(function (e) {
  console.error("FAIL wyjatek testu: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
