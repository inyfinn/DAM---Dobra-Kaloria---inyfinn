/**
 * Synchronizacja indeksu materialow (dam-asset-sync.js) - render statusu, listy
 * zablokowanych folderow, 404 -> "niedostepne", confirm woła POST z folderem,
 * brak sekcji dla nie-admina. Run: node apps/web/scripts/tests/test_asset_sync_ui.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = path.join(__dirname, "..", "..", "assets", "js", "dam-asset-sync.js");

var fails = 0;
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}

/** Minimalne DOM potrzebne przez mountSettings - bez jsdom (brak w repo). */
function makeFakeEl(tag) {
  var listeners = {};
  var _html = "";
  var _qsaCache = {};
  var el = {
    tagName: String(tag || "div").toUpperCase(),
    _attrs: {},
    hidden: false,
    setAttribute: function (k, v) {
      this._attrs[k] = String(v);
    },
    removeAttribute: function (k) {
      delete this._attrs[k];
    },
    getAttribute: function (k) {
      return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null;
    },
    hasAttribute: function (k) {
      return Object.prototype.hasOwnProperty.call(this._attrs, k);
    },
    addEventListener: function (type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    __fire: function (type) {
      (listeners[type] || []).forEach(function (fn) {
        fn({ preventDefault: function () {} });
      });
    },
    /* querySelectorAll na atrapie: parsujemy tylko data-* atrybuty wpisane w innerHTML
       przez wlasny szablon (proste [data-x] selektory uzywane w kodzie). */
    querySelectorAll: function (selector) {
      if (_qsaCache[selector]) return _qsaCache[selector];
      var m = selector.match(/^\[([a-zA-Z0-9-]+)\]$/);
      var attrName = m ? m[1] : null;
      var out = [];
      if (attrName) {
        var re = new RegExp('<[a-zA-Z0-9]+[^>]*\\b' + attrName + '="([^"]*)"[^>]*>', "g");
        var mm;
        while ((mm = re.exec(_html))) {
          var fakeBtn = makeFakeEl("button");
          fakeBtn.setAttribute(attrName, mm[1]);
          out.push(fakeBtn);
        }
      }
      _qsaCache[selector] = out;
      return out;
    },
  };
  Object.defineProperty(el, "innerHTML", {
    get: function () {
      return _html;
    },
    set: function (v) {
      _html = v;
      _qsaCache = {};
    },
  });
  return el;
}

/* ------------------------------------------------------------------ */
/* Sandbox: ladujemy modul jak w przegladarce (window.*), bez sieci.    */
/* ------------------------------------------------------------------ */

var storage = {};
var fakeLocalStorage = {
  getItem: function (k) {
    return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null;
  },
  setItem: function (k, v) {
    storage[k] = String(v);
  },
  removeItem: function (k) {
    delete storage[k];
  },
};

var fetchImpl = function () {
  return Promise.reject(new Error("fetch nieoczekiwany w tym tescie"));
};
var confirmCalls = [];
var confirmReturn = true;

var fakeWindow = {
  localStorage: fakeLocalStorage,
  confirm: function (msg) {
    confirmCalls.push(msg);
    return confirmReturn;
  },
  alert: function () {},
};
fakeWindow.window = fakeWindow;

var byIdMap = {};
var fakeDocument = {
  getElementById: function (id) {
    return Object.prototype.hasOwnProperty.call(byIdMap, id) ? byIdMap[id] : null;
  },
};

var sandbox = {
  window: fakeWindow,
  document: fakeDocument,
  localStorage: fakeLocalStorage,
  console: console,
  fetch: function () {
    return fetchImpl.apply(null, arguments);
  },
  Promise: Promise,
  Object: Object,
  Number: Number,
  Date: Date,
  isNaN: isNaN,
  String: String,
  Array: Array,
  Math: Math,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, "utf8"), sandbox);

var AS = fakeWindow.DamAssetSync;

ok(!!AS, "brak bledu skladni / DamAssetSync sie wystawia po zaladowaniu");
ok(typeof AS.mountSettings === "function", "mountSettings istnieje");
ok(typeof AS.fetchStatus === "function", "fetchStatus istnieje");
ok(typeof AS.fetchBlocked === "function", "fetchBlocked istnieje");
ok(typeof AS.confirmDelete === "function", "confirmDelete istnieje");
ok(typeof AS.esc === "function", "esc istnieje (HTML-escape dla renderu)");

/* --- esc() nie przepuszcza znacznikow --- */
ok(AS.esc('<img src=x onerror=alert(1)>') === "&lt;img src=x onerror=alert(1)&gt;", "esc ucieka znaczniki");

/* --- shortFolder: ostatnie segmenty + pelna sciezka --- */
(function () {
  var r = AS.shortFolder("- polska/marketing/burgery/wariant-1/x");
  ok(r.short === "burgery / wariant-1 / x", "shortFolder bierze ostatnie 3 segmenty: " + r.short);
  ok(r.full === "- polska/marketing/burgery/wariant-1/x", "shortFolder zachowuje pelna sciezke");
})();

function jsonResponse(body, status) {
  return Promise.resolve({
    ok: (status || 200) < 400,
    status: status || 200,
    json: function () {
      return Promise.resolve(body);
    },
  });
}

function waitTicks(n) {
  var p = Promise.resolve();
  for (var i = 0; i < (n || 6); i++) {
    p = p.then(function () {
      return new Promise(function (r) {
        setTimeout(r, 0);
      });
    });
  }
  return p;
}

var chain = Promise.resolve();

/* --- Nie-admin: sekcja zostaje ukryta, brak fetch --- */
chain = chain.then(function () {
  storage = {};
  var fetchCalled = false;
  fetchImpl = function () {
    fetchCalled = true;
    return jsonResponse({ ok: false });
  };
  var section = makeFakeEl("section");
  section.setAttribute("hidden", "");
  var container = makeFakeEl("div");
  byIdMap = { damAssetSync: section, damAssetSyncBody: container };
  AS.mountSettings("damAssetSyncBody");
  return waitTicks(3).then(function () {
    ok(section.hasAttribute("hidden"), "sekcja pozostaje ukryta bez roli admin");
    ok(!fetchCalled, "brak zadania /asset-sync/* bez roli admin");
    ok(
      container.innerHTML.indexOf("Wymaga roli administratora") >= 0,
      "tresc mowi, ze wymagana jest rola administratora (nie zostaje na 'Wczytywanie...')"
    );
  });
});

/* --- Admin: tryb rows, status ok, 2 zablokowane foldery --- */
chain = chain.then(function () {
  storage = { dam_role: "admin", dam_token: "qa-token" };
  fetchImpl = function (url) {
    if (String(url).indexOf("/asset-sync/status") >= 0) {
      return jsonResponse({
        ok: true,
        mode: "rows",
        last_run: "2026-09-23T08:00:00Z",
        last_ok: true,
        pulled: 12,
        pushed: 3,
        blocked_count: 2,
        last_scan_time_ms: 450,
        error: "",
      });
    }
    if (String(url).indexOf("/asset-sync/blocked") >= 0) {
      return jsonResponse({
        ok: true,
        items: [
          { folder: "- polska/marketing/burgery/wariant-1", count: 24 },
          { folder: "- polska/marketing/batony/wariant-2", count: 5 },
        ],
      });
    }
    return jsonResponse({ ok: false }, 404);
  };
  var section = makeFakeEl("section");
  section.setAttribute("hidden", "");
  var container = makeFakeEl("div");
  byIdMap = { damAssetSync: section, damAssetSyncBody: container };
  AS.mountSettings("damAssetSyncBody");
  return waitTicks(6).then(function () {
    ok(!section.hasAttribute("hidden"), "sekcja odslonieta dla admina");
    ok(container.innerHTML.indexOf("Włączona - dane z bazy") >= 0, "render trybu 'rows'");
    ok(container.innerHTML.indexOf("burgery / wariant-1") >= 0, "skrocona sciezka folderu 1 w renderze");
    ok(container.innerHTML.indexOf("24") >= 0, "liczba plikow folderu 1 w renderze");
    ok(container.innerHTML.indexOf("batony / wariant-2") >= 0, "skrocona sciezka folderu 2 w renderze");
    ok(container.innerHTML.indexOf("Potwierdź usunięcie") >= 0, "przycisk Potwierdz usuniecie w renderze");
    ok(
      container.innerHTML.indexOf("ponad 20% plików") >= 0,
      "tekst pomocy o progu 20% obecny"
    );

    /* --- klik Potwierdz usuniecie: confirm() + POST z folderem --- */
    var posted = null;
    confirmCalls = [];
    confirmReturn = true;
    fetchImpl = function (url, opts) {
      if (String(url).indexOf("/asset-sync/confirm") >= 0) {
        posted = JSON.parse((opts && opts.body) || "{}");
        return jsonResponse({ ok: true });
      }
      if (String(url).indexOf("/asset-sync/status") >= 0) {
        return jsonResponse({ ok: true, mode: "rows", last_run: "", last_ok: true, pulled: 0, pushed: 0, blocked_count: 0, error: "" });
      }
      if (String(url).indexOf("/asset-sync/blocked") >= 0) {
        return jsonResponse({ ok: true, items: [] });
      }
      return jsonResponse({ ok: false }, 404);
    };
    var btns = container.querySelectorAll("[data-confirm-delete]");
    ok(btns.length === 2, "dwa przyciski Potwierdz usuniecie wyrenderowane");
    btns[0].__fire("click");
    return waitTicks(6).then(function () {
      ok(confirmCalls.length === 1, "confirm() wywolany raz");
      ok(
        confirmCalls[0].indexOf("znikną z indeksu na wszystkich komputerach") >= 0,
        "tresc confirm() zawiera ostrzezenie o zniknieciu z indeksu"
      );
      ok(!!posted, "POST /asset-sync/confirm wyslany");
      ok(
        posted && posted.folder === btns[0].getAttribute("data-confirm-delete"),
        "POST niesie folder z klikanego wiersza"
      );
    });
  });
});

/* --- confirm() odrzucony przez uzytkownika -> brak POST --- */
chain = chain.then(function () {
  storage = { dam_role: "admin" };
  fetchImpl = function (url) {
    if (String(url).indexOf("/asset-sync/status") >= 0) {
      return jsonResponse({ ok: true, mode: "off", last_run: "", last_ok: false, pulled: 0, pushed: 0, blocked_count: 1, error: "" });
    }
    if (String(url).indexOf("/asset-sync/blocked") >= 0) {
      return jsonResponse({ ok: true, items: [{ folder: "x/y/z", count: 1 }] });
    }
    return jsonResponse({ ok: false }, 404);
  };
  var section = makeFakeEl("section");
  section.setAttribute("hidden", "");
  var container = makeFakeEl("div");
  byIdMap = { damAssetSync: section, damAssetSyncBody: container };
  AS.mountSettings("damAssetSyncBody");
  return waitTicks(6).then(function () {
    ok(container.innerHTML.indexOf("Wyłączona - migawki") >= 0, "render trybu 'off'");
    var postCalled = false;
    fetchImpl = function (url) {
      if (String(url).indexOf("/asset-sync/confirm") >= 0) postCalled = true;
      return jsonResponse({ ok: true });
    };
    confirmReturn = false;
    var btn = container.querySelectorAll("[data-confirm-delete]")[0];
    btn.__fire("click");
    return waitTicks(3).then(function () {
      ok(!postCalled, "anulowanie confirm() nie wysyla POST");
    });
  });
});

/* --- most bez tras (404 na status) -> "Niedostepne w tej wersji mostu" --- */
chain = chain.then(function () {
  storage = { dam_role: "admin" };
  fetchImpl = function () {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  };
  var section = makeFakeEl("section");
  section.setAttribute("hidden", "");
  var container = makeFakeEl("div");
  byIdMap = { damAssetSync: section, damAssetSyncBody: container };
  AS.mountSettings("damAssetSyncBody");
  return waitTicks(4).then(function () {
    ok(!section.hasAttribute("hidden"), "sekcja odslonieta (admin), tresc mowi o niedostepnosci");
    ok(
      container.innerHTML.indexOf("Niedostępne w tej wersji mostu") >= 0,
      "404 na /asset-sync/status pokazuje komunikat 'Niedostepne w tej wersji mostu'"
    );
  });
});

/* --- most offline (fetch reject) -> komunikat o braku polaczenia, bez wyjatku --- */
chain = chain.then(function () {
  storage = { dam_role: "admin" };
  fetchImpl = function () {
    return Promise.reject(new Error("network down"));
  };
  var section = makeFakeEl("section");
  section.setAttribute("hidden", "");
  var container = makeFakeEl("div");
  byIdMap = { damAssetSync: section, damAssetSyncBody: container };
  AS.mountSettings("damAssetSyncBody");
  return waitTicks(4).then(function () {
    ok(
      container.innerHTML.indexOf("Brak połączenia z mostem DAM") >= 0,
      "most offline pokazuje komunikat o braku polaczenia (bez wyjatku)"
    );
  });
});

chain
  .then(function () {
    if (fails) {
      console.error("\nBLEDOW: " + fails);
      process.exit(1);
    }
    console.log("OK test_asset_sync_ui");
  })
  .catch(function (e) {
    console.error("FAIL (wyjatek):", (e && e.stack) || e);
    process.exit(1);
  });
