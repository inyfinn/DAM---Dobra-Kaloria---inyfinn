/**
 * DAM - wspolny loader data/file-index.json (~9.5 MB) dla calej strony.
 *
 * Jedno Promise na strone zamiast osobnego fetch + JSON.parse w kazdym module
 * (zamrazanie UI). Samodzielny: nie wymaga dam-api.js, ladowany przed nim.
 *
 *   DamFileIndex.get()        -> Promise<surowy JSON indeksu> (wspolne)
 *   DamFileIndex.peek()       -> ostatnio wczytany indeks albo null
 *   DamFileIndex.invalidate() -> porzuca pamiec i wymusza swiezy adres (bez fetch)
 *   DamFileIndex.refresh()    -> invalidate() + get()
 *   DamFileIndex.revalidate() -> pyta most o znacznik przebudowy; gdy sie zmienil,
 *                                robi invalidate(). Zwraca Promise<bool zmieniono>.
 *
 * Wersjonowanie adresu: znacznik ostatniej przebudowy z GET <most>/health
 * (watcher.last_finished). Brak znacznika albo most milczy 1.5 s -> staly znacznik
 * sesji strony (czas ladowania zaokraglony do 10 min), przegladarka moze uzyc cache.
 * Po invalidate() adres dostaje unikalny znacznik i cache: "no-store".
 * Odrzucone Promise nie zostaje w pamieci: nastepne get() probuje ponownie.
 */
(function (w) {
  "use strict";
  if (w.DamFileIndex && w.DamFileIndex.__v) return;

  var INDEX_URL = "data/file-index.json";
  var HEALTH_TIMEOUT_MS = 1500;
  var WORKER_PARSE_MIN = 1200000;
  var WORKER_TIMEOUT_MS = 25000;
  var SESSION_TOKEN = "s" + Math.floor(Date.now() / 600000);

  var _promise = null;
  var _data = null;
  var _tokenPromise = null;
  var _token = "";
  var _tokenIsReal = false;
  var _forced = "";

  function bridgeBase() {
    try {
      if (w.DamBridgeUrl && typeof w.DamBridgeUrl.resolve === "function") {
        return String(w.DamBridgeUrl.resolve() || "").replace(/\/+$/, "");
      }
      if (w.__DAM_BRIDGE__) return String(w.__DAM_BRIDGE__).replace(/\/+$/, "");
      if (typeof location !== "undefined" && location.hostname && location.protocol !== "file:") {
        var port = location.port ? parseInt(location.port, 10) : NaN;
        if (!port || isNaN(port)) port = location.protocol === "https:" ? 443 : 80;
        var bp = port === 8765 || port === 8766 ? 8766 : port + 1;
        return location.protocol + "//" + location.hostname + ":" + bp;
      }
    } catch (eBase) {
      /* ignore */
    }
    return "http://127.0.0.1:8766";
  }

  function pickToken(h) {
    if (!h || typeof h !== "object") return "";
    var wt = h.watcher;
    if (!wt || typeof wt !== "object") return "";
    var raw = wt.watcher && typeof wt.watcher === "object" ? wt.watcher : {};
    return String(raw.last_finished || wt.last_finished || "").trim();
  }

  function fetchHealthToken() {
    return new Promise(function (resolve) {
      var done = false;
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        try {
          if (ctrl) ctrl.abort();
        } catch (eAb) {
          /* ignore */
        }
        resolve("");
      }, HEALTH_TIMEOUT_MS);
      var opts = { cache: "no-store" };
      if (ctrl) opts.signal = ctrl.signal;
      var p;
      try {
        p = fetch(bridgeBase() + "/health", opts);
      } catch (eF) {
        p = Promise.reject(eF);
      }
      p.then(function (r) {
        return r && r.ok ? r.json() : null;
      })
        .then(function (h) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(pickToken(h));
        })
        .catch(function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve("");
        });
    });
  }

  function currentToken() {
    if (_forced) return Promise.resolve(_forced);
    if (_tokenPromise) return _tokenPromise;
    _tokenPromise = fetchHealthToken().then(function (t) {
      _tokenIsReal = !!t;
      _token = t ? "b" + t.replace(/[^0-9A-Za-z]/g, "") : SESSION_TOKEN;
      return _token;
    });
    return _tokenPromise;
  }

  function parseText(text) {
    if (typeof text !== "string") throw new Error("file-index_not_text");
    if (text.length < WORKER_PARSE_MIN || typeof Worker === "undefined" || typeof Blob === "undefined") {
      return JSON.parse(text);
    }
    return new Promise(function (resolve, reject) {
      var src =
        "self.onmessage=function(e){try{self.postMessage({ok:1,data:JSON.parse(e.data)});}" +
        "catch(err){self.postMessage({ok:0,error:String(err)});}};";
      var url = "";
      var worker = null;
      try {
        url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
        worker = new Worker(url);
      } catch (eW) {
        if (url) URL.revokeObjectURL(url);
        try {
          resolve(JSON.parse(text));
        } catch (eP) {
          reject(eP);
        }
        return;
      }
      function cleanup() {
        clearTimeout(tid);
        try {
          worker.terminate();
        } catch (eT) {
          /* ignore */
        }
        URL.revokeObjectURL(url);
      }
      var tid = setTimeout(function () {
        cleanup();
        reject(new Error("file-index_parse_timeout"));
      }, WORKER_TIMEOUT_MS);
      worker.onmessage = function (ev) {
        cleanup();
        var msg = ev.data || {};
        if (msg.ok) resolve(msg.data);
        else reject(new Error(msg.error || "file-index_parse"));
      };
      worker.onerror = function () {
        cleanup();
        try {
          resolve(JSON.parse(text));
        } catch (eP2) {
          reject(eP2);
        }
      };
      worker.postMessage(text);
    });
  }

  function get() {
    if (_promise) return _promise;
    var p = currentToken()
      .then(function (tok) {
        var opts = _forced ? { cache: "no-store" } : {};
        return fetch(INDEX_URL + "?v=" + encodeURIComponent(tok), opts);
      })
      .then(function (r) {
        if (!r.ok) throw new Error("Brak file-index.json (" + r.status + ")");
        return r.text();
      })
      .then(parseText)
      .then(function (data) {
        data = data || {};
        if (_promise === p) _data = data;
        return data;
      });
    p.catch(function () {
      if (_promise === p) _promise = null;
    });
    _promise = p;
    return p;
  }

  function invalidate() {
    _promise = null;
    _data = null;
    _forced = "r" + Date.now();
  }

  function refresh() {
    invalidate();
    return get();
  }

  function revalidate() {
    return fetchHealthToken().then(function (t) {
      if (!t) return false;
      var next = "b" + t.replace(/[^0-9A-Za-z]/g, "");
      var prevReal = _tokenIsReal;
      var prev = _token;
      _tokenPromise = Promise.resolve(next);
      _token = next;
      _tokenIsReal = true;
      if (prevReal && prev && prev !== next) {
        _forced = "";
        _promise = null;
        _data = null;
        return true;
      }
      return false;
    });
  }

  function peek() {
    return _data;
  }

  w.DamFileIndex = {
    __v: 1,
    get: get,
    peek: peek,
    invalidate: invalidate,
    refresh: refresh,
    revalidate: revalidate,
    parseText: parseText,
  };
})(typeof window !== "undefined" ? window : globalThis);
