/**
 * DAM - preferencje UI per konto (Postgres KV via bridge /user-prefs).
 * PI: ui.safe_delete. localStorage = cache, nie zrodlo prawdy.
 */
(function (global) {
  "use strict";

  var CACHE_KEY = "dam_user_prefs";
  var PAGE_SIZE_MIN = 24;
  var PAGE_SIZE_MAX = 500;
  var DEFAULTS = { safe_delete: true, branding_page_size: 100 };
  var _prefs = null;
  var _loading = null;

  function clampPageSize(n) {
    n = Math.round(Number(n) || DEFAULTS.branding_page_size);
    if (isNaN(n)) n = DEFAULTS.branding_page_size;
    if (n < PAGE_SIZE_MIN) n = PAGE_SIZE_MIN;
    if (n > PAGE_SIZE_MAX) n = PAGE_SIZE_MAX;
    return n;
  }

  function bridgeUrl() {
    if (global.DamPaths && typeof DamPaths.bridgeUrl === "function") {
      return DamPaths.bridgeUrl();
    }
    if (global.DamRuntime && typeof DamRuntime.bridgeUrl === "function") {
      return DamRuntime.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders(json) {
    var h = {};
    if (global.DamApi && typeof DamApi.authHeaders === "function") {
      h = DamApi.authHeaders() || {};
    } else {
      h.Authorization = "Bearer " + (localStorage.getItem("dam_token") || "");
    }
    if (json !== false) h["Content-Type"] = "application/json";
    return h;
  }

  function normalize(raw) {
    var out = {
      safe_delete: true,
      branding_page_size: DEFAULTS.branding_page_size,
    };
    if (!raw || typeof raw !== "object") return out;
    if ("safe_delete" in raw) out.safe_delete = !!raw.safe_delete;
    if ("branding_page_size" in raw) {
      out.branding_page_size = clampPageSize(raw.branding_page_size);
    }
    return out;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function writeCache(prefs) {
    _prefs = normalize(prefs);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(_prefs));
    } catch (e) { /* ignore */ }
    try {
      global.dispatchEvent(
        new CustomEvent("dam:user-prefs", { detail: { prefs: _prefs } })
      );
    } catch (e2) { /* ignore */ }
    return _prefs;
  }

  function getSync() {
    if (_prefs) return _prefs;
    var cached = readCache();
    if (cached) {
      _prefs = cached;
      return _prefs;
    }
    return normalize(DEFAULTS);
  }

  function isSafeDeleteEnabled() {
    return getSync().safe_delete !== false;
  }

  function load() {
    if (_loading) return _loading;
    _loading = fetch(bridgeUrl() + "/user-prefs", {
      headers: authHeaders(false),
      cache: "no-store",
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { httpOk: r.ok, data: data };
        });
      })
      .then(function (res) {
        if (res.httpOk && res.data && res.data.ok !== false && res.data.prefs) {
          return writeCache(res.data.prefs);
        }
        return writeCache(getSync());
      })
      .catch(function () {
        return writeCache(getSync());
      })
      .then(function (prefs) {
        _loading = null;
        return prefs;
      });
    return _loading;
  }

  function set(patch) {
    var next = normalize(Object.assign({}, getSync(), patch || {}));
    writeCache(next);
    return fetch(bridgeUrl() + "/user-prefs", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ prefs: next }),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { httpOk: r.ok, data: data };
        });
      })
      .then(function (res) {
        if (res.httpOk && res.data && res.data.prefs) {
          return writeCache(res.data.prefs);
        }
        return next;
      })
      .catch(function () {
        return next;
      });
  }

  function setSafeDelete(on) {
    return set({ safe_delete: !!on });
  }

  // Eager hydrate when token present
  try {
    if (localStorage.getItem("dam_token")) {
      load();
    }
  } catch (e) { /* ignore */ }

  global.DamUserPrefs = {
    DEFAULTS: DEFAULTS,
    getSync: getSync,
    load: load,
    set: set,
    setSafeDelete: setSafeDelete,
    isSafeDeleteEnabled: isSafeDeleteEnabled,
  };
})(typeof window !== "undefined" ? window : globalThis);
