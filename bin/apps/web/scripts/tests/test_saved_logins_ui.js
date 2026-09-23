/**
 * Zapisane logowania (dam-saved-logins.js) - render bez bledu, bez hasla w DOM,
 * bez autologowania przy ?logout=1. Run: node apps/web/scripts/tests/test_saved_logins_ui.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var SRC = path.join(__dirname, "..", "..", "assets", "js", "dam-saved-logins.js");

var fails = 0;
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    fails++;
  }
}
function eq(got, want, label) {
  var a = JSON.stringify(got);
  var b = JSON.stringify(want);
  if (a !== b) {
    console.error("FAIL " + label + ":\n  oczekiwano " + b + "\n  jest       " + a);
    fails++;
  }
}

/** Minimalne DOM potrzebne przez mountSignin/mountSettings - bez jsdom (brak w repo). */
function makeFakeEl(tag) {
  var listeners = {};
  var _html = "";
  var _qsaCache = {};
  var el = {
    tagName: String(tag || "div").toUpperCase(),
    _attrs: {},
    _children: [],
    hidden: false,
    textContent: "",
    onclick: null,
    setAttribute: function (k, v) {
      this._attrs[k] = String(v);
    },
    getAttribute: function (k) {
      return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null;
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
       przez nasz wlasny szablon (proste [data-x] selektory uzywane w kodzie). Wynik jest
       cache'owany per aktualny innerHTML, zeby kod produkcyjny i test dostawaly TE SAME
       obiekty (i wpiete na nich listenery) az do kolejnego przypisania innerHTML. */
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

var fetchCalls = [];
var fetchImpl = function () {
  return Promise.reject(new Error("fetch nieoczekiwany w tym tescie"));
};

var fakeWindow = {
  location: { search: "", href: "http://127.0.0.1:9780/signin.html" },
  confirm: function () {
    return true;
  },
};
fakeWindow.window = fakeWindow;

var fakeDocument = { getElementById: function () { return null; } };

var sandbox = {
  window: fakeWindow,
  document: fakeDocument,
  console: console,
  URLSearchParams: URLSearchParams,
  fetch: function () {
    fetchCalls.push(Array.prototype.slice.call(arguments));
    return fetchImpl.apply(null, arguments);
  },
  Promise: Promise,
  Object: Object,
  setInterval: setInterval,
  clearInterval: clearInterval,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, "utf8"), sandbox);

var SL = fakeWindow.DamSavedLogins;

ok(!!SL, "brak bledu skladni / DamSavedLogins.get sie wystawia po zaladowaniu");
ok(typeof SL.mountSignin === "function", "mountSignin istnieje");
ok(typeof SL.mountSettings === "function", "mountSettings istnieje");
ok(typeof SL.fetchSaved === "function", "fetchSaved istnieje");
ok(typeof SL.savedLogin === "function", "savedLogin istnieje");
ok(typeof SL.esc === "function", "esc istnieje (HTML-escape dla renderu)");

/* --- esc() nie przepuszcza znacznikow --- */
eq(SL.esc('<img src=x onerror=alert(1)>'), "&lt;img src=x onerror=alert(1)&gt;", "esc ucieka znaczniki");
eq(SL.esc("Ala & Ola"), "Ala &amp; Ola", "esc ucieka ampersand");

/* --- ?logout=1 wylacza autologowanie (nie samo ladowanie listy) --- */
fakeWindow.location.search = "?logout=1";
ok(SL.isLogoutRedirect() === true, "isLogoutRedirect wykrywa ?logout=1");
fakeWindow.location.search = "";
ok(SL.isLogoutRedirect() === false, "isLogoutRedirect fałsz bez parametru");
fakeWindow.location.search = "?logout=0";
ok(SL.isLogoutRedirect() === false, "isLogoutRedirect fałsz przy logout=0");
fakeWindow.location.search = "";

/* --- mountSignin: render listy z atrapy /auth/saved, bez hasla w DOM --- */
(function () {
  fetchImpl = function (url) {
    ok(String(url).indexOf("/auth/saved") >= 0, "mountSignin odpytuje /auth/saved");
    return Promise.resolve({
      json: function () {
        return Promise.resolve({
          ok: true,
          available: true,
          accounts: [
            { email: "jan@firma.pl", name: "Jan Kowalski", autologin: false },
            { email: "anna@firma.pl", name: "Anna Nowak", autologin: true },
          ],
          autologin_email: null,
        });
      },
    });
  };

  var listEl = makeFakeEl("div");
  var autoBarEl = makeFakeEl("div");
  autoBarEl.hidden = true;
  var autoTextEl = makeFakeEl("span");
  var autoCancelEl = makeFakeEl("button");
  var filled = [];
  var results = [];

  var handle = SL.mountSignin({
    listEl: listEl,
    autoBarEl: autoBarEl,
    autoTextEl: autoTextEl,
    autoCancelEl: autoCancelEl,
    onFillEmail: function (email) {
      filled.push(email);
    },
    onResult: function (promise, ctx) {
      results.push(ctx);
      return promise.catch(function () {
        /* w tescie nie logujemy naprawde - lapiemy odrzucenie */
      });
    },
  });

  return Promise.resolve()
    .then(function () {
      /* refresh() w mountSignin leci asynchronicznie (fetch -> .then) - odczekaj mikrotaski */
      return new Promise(function (r) { setTimeout(r, 0); });
    })
    .then(function () {
      ok(listEl.hidden === false, "lista kont odslonieta po udanym /auth/saved");
      ok(listEl.innerHTML.indexOf("jan@firma.pl") >= 0, "email Jana w renderze");
      ok(listEl.innerHTML.indexOf("Anna Nowak") >= 0, "imie Anny w renderze");
      ok(listEl.innerHTML.toLowerCase().indexOf("password") < 0, "brak slowa password w renderze");
      ok(listEl.innerHTML.indexOf("type=\"password\"") < 0, "brak pola typu password w renderze listy");
      /* Zaden atrybut/tekst nie wyglada na haslo - lista nie zna hasel (kontrakt /auth/saved ich nie zwraca) */
      ok(autoBarEl.hidden === true, "pasek autologowania NIE wystartowal bez autologin_email");

      var fillBtns = listEl.querySelectorAll("[data-fill-email]");
      ok(fillBtns.length === 2, "dwa przyciski wypelnienia emaila wyrenderowane");
      fillBtns[0].__fire("click");
      ok(filled.indexOf(fillBtns[0].getAttribute("data-fill-email")) >= 0 || filled.length > 0,
        "klik w kafelek wywoluje onFillEmail");
      void handle;
    });
})()
  .then(function () {
    /* --- ?logout=1: autologin_email obecny, ale NIE startuje autologowanie --- */
    fakeWindow.location.search = "?logout=1";
    fetchImpl = function () {
      return Promise.resolve({
        json: function () {
          return Promise.resolve({
            ok: true,
            available: true,
            accounts: [{ email: "jan@firma.pl", name: "Jan", autologin: true }],
            autologin_email: "jan@firma.pl",
          });
        },
      });
    };
    var listEl2 = makeFakeEl("div");
    var autoBarEl2 = makeFakeEl("div");
    autoBarEl2.hidden = true;
    SL.mountSignin({
      listEl: listEl2,
      autoBarEl: autoBarEl2,
      autoTextEl: makeFakeEl("span"),
      autoCancelEl: makeFakeEl("button"),
      onFillEmail: function () {},
      onResult: function (p) { return p.catch(function () {}); },
    });
    return new Promise(function (r) { setTimeout(r, 50); }).then(function () {
      ok(autoBarEl2.hidden === true, "?logout=1 nie uruchamia paska autologowania mimo autologin_email");
      fakeWindow.location.search = "";
    });
  })
  .then(function () {
    /* --- stary most (available:false lub brak odpowiedzi) - nic nie pokazuj --- */
    fetchImpl = function () {
      return Promise.resolve({
        json: function () {
          return Promise.resolve({ ok: false });
        },
      });
    };
    var listEl3 = makeFakeEl("div");
    listEl3.hidden = false;
    listEl3.innerHTML = "stare-cos";
    var autoBarEl3 = makeFakeEl("div");
    autoBarEl3.hidden = false;
    SL.mountSignin({
      listEl: listEl3,
      autoBarEl: autoBarEl3,
      autoTextEl: makeFakeEl("span"),
      autoCancelEl: makeFakeEl("button"),
      onFillEmail: function () {},
      onResult: function (p) { return p.catch(function () {}); },
    });
    return new Promise(function (r) { setTimeout(r, 20); }).then(function () {
      ok(listEl3.hidden === true, "stary most (ok:false) chowa liste (formularz dziala jak dotad)");
      ok(autoBarEl3.hidden === true, "stary most (ok:false) chowa pasek autologowania");
    });
  })
  .then(function () {
    /* --- mountSettings: render + brak hasla w markupie --- */
    fetchImpl = function () {
      return Promise.resolve({
        json: function () {
          return Promise.resolve({
            ok: true,
            available: true,
            accounts: [
              { email: "jan@firma.pl", name: "Jan Kowalski", autologin: false, last_used_at: "2026-09-20" },
            ],
          });
        },
      });
    };
    var container = makeFakeEl("div");
    var byIdMap = { damSavedLoginsList: container };
    fakeDocument.getElementById = function (id) {
      return byIdMap[id] || null;
    };
    SL.mountSettings("damSavedLoginsList");
    return new Promise(function (r) { setTimeout(r, 20); }).then(function () {
      ok(container.innerHTML.indexOf("jan@firma.pl") >= 0, "settings: email w renderze");
      ok(container.innerHTML.toLowerCase().indexOf("password") < 0, "settings: brak password w renderze");
      ok(container.innerHTML.indexOf('type="checkbox"') >= 0, "settings: przelacznik autologowania obecny");
    });
  })
  .then(function () {
    if (fails) {
      console.error("\nBLEDOW: " + fails);
      process.exit(1);
    }
    console.log("OK test_saved_logins_ui");
  })
  .catch(function (e) {
    console.error("FAIL (wyjatek):", e && e.stack || e);
    process.exit(1);
  });
