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
 *
 * Pierwsze pobranie katalogu z bazy (07.10.2026): instalator nie pakuje spisu, wiec na
 * swiezym komputerze pliku przez pierwsze sekundy NIE MA (404). To nie blad koncowy:
 * get() wisi, co WAIT_POLL_MS pyta most (GET /index/snapshots) i ponawia odczyt pliku.
 * Konczy sie spisem, gdy plik przyjdzie, albo bledem, gdy most mowi, ze pobranie sie
 * nie powiodlo. Gdy plik jest od razu - nic z tego sie nie dzieje.
 *
 *   DamFileIndex.state() -> { state: "idle" | "waiting" | "ready" | "failed",
 *                            since: ms epoki (start czekania), reason, message }
 *   zdarzenie window "dam:file-index-state" (detail = state()) tylko przy zmianie:
 *   raz "waiting", potem raz "ready" albo "failed". Zwykle wczytanie nie oglasza nic.
 *   reason: "db" (brak polaczenia z baza), "empty_db" (w bazie nie ma katalogu),
 *   "local_mode", "bridge" (most milczy / nie podaje stanu), "timeout".
 *   Blad z get(): Error { code: "index_first_sync_failed", reason, message po polsku }.
 *   DamFileIndex.get({ wait: false }) -> dla wolajacych, ktorym spis jest opcjonalny
 *   (np. wykrycie ROOT w dam-paths.js): nie wisi na pierwszym pobraniu, przy braku
 *   pliku odrzuca od razu jak dawniej. Petla czekania i zdarzenia dzialaja tak samo.
 */
(function (w) {
  "use strict";
  if (w.DamFileIndex && w.DamFileIndex.__v) return;

  var INDEX_URL = "data/file-index.json";
  var HEALTH_TIMEOUT_MS = 1500;
  var WORKER_PARSE_MIN = 1200000;
  var WORKER_TIMEOUT_MS = 25000;
  var SESSION_TOKEN = "s" + Math.floor(Date.now() / 600000);
  /* Zmierzone 07.10.2026: pierwsze pobranie ok. 19 s od startu mostu. Nieudane polaczenie
     z baza: czekamy, dopoki most ponawia (last.at sie zmienia), najwyzej DB_GIVE_UP_MS;
     gdy przez DB_RETRY_GRACE_MS nie bylo nowej proby - most nie ponawia, konczymy. */
  var WAIT_POLL_MS = 3000;
  var DB_RETRY_GRACE_MS = 15000;
  var DB_GIVE_UP_MS = 60000;
  var BRIDGE_SILENT_MAX_MS = 60000;
  var WAIT_MAX_MS = 180000;
  var FAIL_DEFAULT = "Nie udało się pobrać katalogu z bazy - sprawdź połączenie";
  var FAIL_TEXT = {
    empty_db: "W bazie nie ma jeszcze katalogu produktów - administrator musi uruchomić skan dysku",
    local_mode: "Ten komputer pracuje w trybie lokalnym i nie ma jeszcze spisu - uruchom skan dysku",
  };

  var _promise = null;
  var _data = null;
  var _tokenPromise = null;
  var _token = "";
  var _tokenIsReal = false;
  var _forced = "";
  var _state = { state: "idle", since: 0, reason: "", message: "" };
  var _wait = null;
  var _onWait = [];

  function state() {
    return { state: _state.state, since: _state.since, reason: _state.reason, message: _state.message };
  }

  /* Zdarzenie tylko przy zmianie stanu; "ready" bez wczesniejszego czekania to zwykle
     wczytanie i ekrany nie musza o nim wiedziec. */
  function setState(name, since, reason) {
    var prev = _state.state;
    _state = {
      state: name,
      since: since || 0,
      reason: reason || "",
      message: name === "failed" ? FAIL_TEXT[reason] || FAIL_DEFAULT : "",
    };
    var waiters = _onWait;
    _onWait = [];
    if (name === "waiting") {
      waiters.forEach(function (fn) {
        fn();
      });
    }
    if (prev === name || (name === "ready" && prev !== "waiting" && prev !== "failed")) return;
    try {
      w.dispatchEvent(new CustomEvent("dam:file-index-state", { detail: state() }));
    } catch (eEv) {
      /* ignore */
    }
  }

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

  /* GET <most><path> -> JSON albo null (most milczy HEALTH_TIMEOUT_MS / blad / nie 200). */
  function bridgeJson(path) {
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
        resolve(null);
      }, HEALTH_TIMEOUT_MS);
      var opts = { cache: "no-store" };
      if (ctrl) opts.signal = ctrl.signal;
      var p;
      try {
        p = fetch(bridgeBase() + path, opts);
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
          resolve(h && typeof h === "object" ? h : null);
        })
        .catch(function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(null);
        });
    });
  }

  function fetchHealthToken() {
    return bridgeJson("/health").then(pickToken);
  }

  /* Odpowiedz GET /index/snapshots -> null (most milczy) | { done, reason, at }.
     Jedno zrodlo prawdy: index_snapshots.status(). first_sync.done = pierwszy cykl sie
     skonczyl (first_sync.ok jest ustawiane raz, wiec powod bierzemy z last.pull,
     a last.at mowi, kiedy most probowal ostatnio). */
  function firstSyncInfo(j) {
    if (!j) return null;
    var fs = j.first_sync;
    if (!fs || typeof fs !== "object") return { done: true, reason: "bridge", at: "" };
    if (!fs.done) return { done: false, reason: "", at: "" };
    var last = j.last || {};
    var pull = last.pull || {};
    var missing = pull.missing_in_db || [];
    var reason = "db";
    if (pull.skipped_local_mode) reason = "local_mode";
    else if (pull.ok !== false && missing.indexOf("file-index") !== -1) reason = "empty_db";
    return { done: true, reason: reason, at: String(last.at || "") };
  }

  /* Jedna petla czekania na strone (wspolna dla wszystkich get(), takze po invalidate()).
     Kolejnosc w kroku: NAJPIERW most, POTEM plik - gdy most mowi "skonczone", plik
     zapisany tuz przed odpowiedzia jest juz widoczny. Wynik: tekst spisu. */
  function waitForFirstSync() {
    if (_wait) return _wait;
    var since = Date.now();
    var heard = since;
    var tryAt = null;
    var tryseen = 0;
    setState("waiting", since);
    var p = new Promise(function (resolve, reject) {
      function fail(reason) {
        setState("failed", since, reason);
        var e = new Error(_state.message);
        e.code = "index_first_sync_failed";
        e.reason = reason;
        reject(e);
      }
      function step() {
        bridgeJson("/index/snapshots")
          .then(function (j) {
            var info = firstSyncInfo(j);
            var now = Date.now();
            if (info) heard = now;
            return fetch(INDEX_URL + "?v=w" + now, { cache: "no-store" }).then(function (r) {
              if (r.ok) {
                return r.text().then(function (text) {
                  setState("ready");
                  resolve(text);
                });
              }
              if (r.status !== 404) return fail("bridge");
              if (info && info.done) {
                if (info.reason !== "db") return fail(info.reason);
                if (info.at !== tryAt) {
                  tryAt = info.at;
                  tryseen = now;
                }
                if (now - tryseen >= DB_RETRY_GRACE_MS || now - since >= DB_GIVE_UP_MS) return fail("db");
              }
              if (now - heard >= BRIDGE_SILENT_MAX_MS) return fail("bridge");
              if (now - since >= WAIT_MAX_MS) return fail("timeout");
              setTimeout(step, WAIT_POLL_MS);
            });
          })
          .catch(function () {
            fail("bridge");
          });
      }
      step();
    });
    function clear() {
      if (_wait === p) _wait = null;
    }
    p.then(clear, clear);
    _wait = p;
    return p;
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

  function getNoWait() {
    var p = get();
    return new Promise(function (resolve, reject) {
      function missing() {
        reject(new Error("Brak file-index.json (404)"));
      }
      if (_state.state === "waiting") return missing();
      _onWait.push(missing);
      p.then(resolve, reject);
    });
  }

  function get(opts) {
    if (opts && opts.wait === false) return getNoWait();
    if (_promise) return _promise;
    var p = currentToken()
      .then(function (tok) {
        var opts = _forced ? { cache: "no-store" } : {};
        return fetch(INDEX_URL + "?v=" + encodeURIComponent(tok), opts);
      })
      .then(function (r) {
        if (r.status === 404) return waitForFirstSync();
        if (!r.ok) throw new Error("Brak file-index.json (" + r.status + ")");
        return r.text();
      })
      .then(parseText)
      .then(function (data) {
        data = data || {};
        if (_promise === p) _data = data;
        setState("ready");
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
    state: state,
    parseText: parseText,
  };
})(typeof window !== "undefined" ? window : globalThis);
