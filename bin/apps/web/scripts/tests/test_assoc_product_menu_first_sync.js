/**
 * Menu produktu w panelu skojarzen (dam-assoc-edit.js, prawy przycisk na etykiecie),
 * 07.10.2026: na swiezym komputerze spisu jeszcze nie ma (pierwsze pobranie katalogu z bazy).
 *  - trwa pobieranie: klikniecie od razu daje komunikat, menu otwiera sie samo po "ready";
 *  - "failed": komunikat loadera, bez menu;
 *  - spis jest: zachowanie jak dotad (menu od razu, bez komunikatu);
 *  - ostatnie klikniecie wygrywa; po przerysowaniu panelu menu staje przy zywej etykiecie.
 * Run: node bin/apps/web/scripts/tests/test_assoc_product_menu_first_sync.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = fs.readFileSync(path.join(__dirname, "..", "..", "assets", "js", "dam-assoc-edit.js"), "utf8").replace(/\r\n/g, "\n");
var from = SRC.indexOf('\n  var ASSOC_NAV_SEL = ');
var to = SRC.indexOf("\n  function installAssocProductNav(");
if (from < 0 || to < from) {
  console.error("FAIL dam-assoc-edit.js: nie ma bloku openAssocProductMenu");
  process.exit(1);
}
var BLOCK = SRC.slice(from, to) + "\nthis.openAssocProductMenu = openAssocProductMenu;";
var NAV = SRC.slice(to, SRC.indexOf("\n  function dbSyncSince(", to));

var fails = 0;
var count = 0;
function ok(cond, label) {
  count++;
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}

var PRODUCT = { id: "baton-kakao", display_name: "Baton kakao", path: "M:/x/baton-kakao" };

function chip(pid, connected) {
  return {
    isConnected: connected !== false,
    textContent: " Baton kakao ",
    getAttribute: function (k) {
      return k === "data-product-id" ? pid : null;
    },
  };
}

/* o.state = stan loadera w chwili klikniecia; o.chips = etykiety obecne na stronie. */
function makeWin(o) {
  var log = { toasts: [], menus: [], ensure: 0, loaderGet: 0 };
  var listeners = [];
  var loaderState = o.state || "ready";
  var ctx = {
    log: log,
    Promise: Promise,
    toast: function (msg) {
      log.toasts.push(msg);
    },
    openActionMenu: function (el, product) {
      log.menus.push({ el: el, product: product });
    },
    ensureFileIndex: function () {
      log.ensure++;
      return o.ensureFail ? Promise.reject(new Error("search-index.json")) : Promise.resolve({ products: [PRODUCT] });
    },
    document: {
      querySelectorAll: function () {
        return o.chips || [];
      },
    },
  };
  ctx.global = {
    DamFileIndex: o.noLoader
      ? undefined
      : {
          state: function () {
            return { state: loaderState };
          },
          get: function () {
            log.loaderGet++;
            return Promise.resolve({ products: [PRODUCT] });
          },
        },
    addEventListener: function (type, fn) {
      listeners.push(fn);
    },
    removeEventListener: function (type, fn) {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    },
  };
  ctx.emit = function (detail) {
    loaderState = detail.state;
    listeners.slice().forEach(function (fn) {
      fn({ detail: detail });
    });
  };
  ctx.listenerCount = function () {
    return listeners.length;
  };
  vm.createContext(ctx);
  vm.runInContext(BLOCK, ctx);
  return ctx;
}

function tick() {
  return new Promise(setImmediate);
}

(async function () {
  /* 1. Spis jest: jak dotad. */
  var c = makeWin({ state: "ready" });
  var b = chip("baton-kakao");
  await c.openAssocProductMenu(b, "baton-kakao");
  ok(c.log.menus.length === 1 && c.log.menus[0].el === b && c.log.menus[0].product === PRODUCT, "spis jest: menu od razu, z pelnym produktem");
  ok(c.log.toasts.length === 0 && c.log.ensure === 1 && c.listenerCount() === 0, "spis jest: bez komunikatu i bez sluchaczy");

  c = makeWin({ noLoader: true, ensureFail: true });
  await c.openAssocProductMenu(b, "baton-kakao");
  ok(c.log.menus.length === 1 && c.log.menus[0].product.id === "baton-kakao" && c.log.menus[0].product.display_name === "Baton kakao", "spisu nie da sie wczytac (stara sciezka): menu z samym id i nazwa z etykiety, bez wyjatku");

  /* 2. Trwa pierwsze pobranie -> ready. */
  c = makeWin({ state: "waiting" });
  var pending = c.openAssocProductMenu(b, "baton-kakao");
  await tick();
  ok(c.log.toasts.join("|") === "Pobieram katalog z bazy - menu otworzy się za chwilę", "czekam: komunikat od razu (" + c.log.toasts.join("|") + ")");
  ok(c.log.menus.length === 0 && c.log.ensure === 0, "czekam: menu jeszcze sie nie otwiera, nic nie wisi na starej sciezce");
  c.emit({ state: "waiting" });
  await tick();
  ok(c.log.menus.length === 0 && c.log.toasts.length === 1, "czekam: powtorzone 'waiting' nic nie zmienia");
  c.emit({ state: "ready" });
  await pending;
  ok(c.log.menus.length === 1 && c.log.menus[0].product === PRODUCT && c.log.loaderGet === 1, "mam: menu otwiera sie samo, produkt prosto z loadera");
  ok(c.log.toasts.length === 1 && c.listenerCount() === 0, "mam: bez drugiego komunikatu, sluchacz posprzatany");

  /* 3. Trwa pierwsze pobranie -> failed. */
  c = makeWin({ state: "waiting" });
  pending = c.openAssocProductMenu(b, "baton-kakao");
  c.emit({ state: "failed", reason: "db", message: "Nie udało się pobrać katalogu z bazy - sprawdź połączenie" });
  await pending;
  ok(c.log.menus.length === 0 && c.log.toasts[1] === "Nie udało się pobrać katalogu z bazy - sprawdź połączenie", "porazka: komunikat loadera, bez menu");
  ok(c.listenerCount() === 0, "porazka: sluchacz posprzatany");
  c = makeWin({ state: "waiting" });
  pending = c.openAssocProductMenu(b, "baton-kakao");
  c.emit({ state: "failed", reason: "empty_db", message: "W bazie nie ma jeszcze katalogu produktów - administrator musi uruchomić skan dysku" });
  await pending;
  ok(c.log.toasts[1].indexOf("W bazie nie ma jeszcze katalogu") === 0, "porazka z innym powodem: tekst loadera, nie wlasny");

  /* 4. Dwa klikniecia w trakcie czekania: wygrywa ostatnie. */
  c = makeWin({ state: "waiting" });
  var b2 = chip("zel-cola");
  var p1 = c.openAssocProductMenu(b, "baton-kakao");
  var p2 = c.openAssocProductMenu(b2, "zel-cola");
  c.emit({ state: "ready" });
  await Promise.all([p1, p2]);
  ok(c.log.menus.length === 1 && c.log.menus[0].el === b2 && c.log.menus[0].product.id === "zel-cola", "dwa klikniecia: jedno menu, przy ostatniej etykiecie");
  ok(c.listenerCount() === 0, "dwa klikniecia: sluchacze posprzatane");
  c = makeWin({ state: "waiting" });
  p1 = c.openAssocProductMenu(b, "baton-kakao");
  p2 = c.openAssocProductMenu(b2, "zel-cola");
  c.emit({ state: "failed", reason: "db", message: "Nie udało się pobrać katalogu z bazy - sprawdź połączenie" });
  await Promise.all([p1, p2]);
  ok(c.log.toasts.length === 3 && c.log.menus.length === 0, "dwa klikniecia i porazka: komunikat porazki raz, nie dwa (" + c.log.toasts.length + " komunikatow)");

  /* 5. Panel przerysowany w trakcie czekania: stary wezel odlaczony. */
  var live = chip("baton-kakao");
  var dead = chip("baton-kakao", false);
  c = makeWin({ state: "waiting", chips: [chip("inny"), live] });
  pending = c.openAssocProductMenu(dead, "baton-kakao");
  c.emit({ state: "ready" });
  await pending;
  ok(c.log.menus.length === 1 && c.log.menus[0].el === live, "panel przerysowany: menu przy zywej etykiecie tego samego produktu");
  c = makeWin({ state: "waiting", chips: [chip("inny")] });
  pending = c.openAssocProductMenu(dead, "baton-kakao");
  c.emit({ state: "ready" });
  await pending;
  ok(c.log.menus.length === 0, "etykiety juz nie ma (zamkniety podglad): menu sie nie otwiera");

  /* 6. Prawy przycisk naprawde idzie przez nowa funkcje. */
  ok(NAV.indexOf("openAssocProductMenu(btn, pid);") !== -1 && NAV.indexOf("ensureFileIndex()") === -1, "contextmenu wola openAssocProductMenu, bez wlasnego ensureFileIndex()");

  if (fails) process.exit(1);
  console.log("OK test_assoc_product_menu_first_sync: " + count + " asercji");
})().catch(function (e) {
  console.error("FAIL wyjatek testu: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
