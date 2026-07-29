/**
 * DAM - preferencje UI per konto (Postgres KV via bridge /user-prefs).
 * PI: ui.safe_delete + ui.user_prefs_kv.
 * localStorage = cache / fallback offline, nie zrodlo prawdy.
 */
(function (global) {
  "use strict";

  var CACHE_KEY = "dam_user_prefs";
  var PAGE_SIZE_MIN = 24;
  var PAGE_SIZE_MAX = 500;
  var CARD_ZOOM_MIN = 70;
  var CARD_ZOOM_MAX = 160;
  var MIGRATE_FLAG = "dam_user_prefs_migrated_v2";

  var DEFAULTS = {
    safe_delete: true,
    branding_page_size: 100,
    card_zoom: 100,
    assoc_split: {},
    explorer_show_all: false,
    explorer_lang_filter: "",
    explorer_viz_view: "tiles",
    explorer_viz_scale: 140,
    reveal_low_tags: false,
    sidebar_collapsed: false,
  };

  /* Legacy localStorage keys → prefs field (one-shot migrate) */
  var LEGACY_MAP = [
    { ls: "dam_viz_card_zoom", field: "card_zoom", parse: "int" },
    { ls: "dam_branding_page_size", field: "branding_page_size", parse: "int" },
    { ls: "dam_explorer_show_all", field: "explorer_show_all", parse: "bool01" },
    { ls: "dam_explorer_lang_filter", field: "explorer_lang_filter", parse: "str" },
    { ls: "dam_viz_view_mode", field: "explorer_viz_view", parse: "str" },
    { ls: "dam_viz_scale", field: "explorer_viz_scale", parse: "int" },
    { ls: "dam_reveal_low_tags", field: "reveal_low_tags", parse: "bool01" },
    { ls: "dam_sidebar_collapsed", field: "sidebar_collapsed", parse: "bool01" },
  ];

  var ASSOC_SPLIT_PREFIX = "dam-assoc-elementy-split:";

  var _prefs = null;
  var _loading = null;
  var _debounceTimer = null;
  var _pendingPatch = null;

  function clampPageSize(n) {
    n = Math.round(Number(n) || DEFAULTS.branding_page_size);
    if (isNaN(n)) n = DEFAULTS.branding_page_size;
    if (n < PAGE_SIZE_MIN) n = PAGE_SIZE_MIN;
    if (n > PAGE_SIZE_MAX) n = PAGE_SIZE_MAX;
    return n;
  }

  function clampCardZoom(n) {
    n = Math.round(Number(n) || DEFAULTS.card_zoom);
    if (isNaN(n)) n = DEFAULTS.card_zoom;
    if (n < CARD_ZOOM_MIN) n = CARD_ZOOM_MIN;
    if (n > CARD_ZOOM_MAX) n = CARD_ZOOM_MAX;
    return n;
  }

  function clampVizScale(n) {
    n = Math.round(Number(n) || DEFAULTS.explorer_viz_scale);
    if (isNaN(n)) n = DEFAULTS.explorer_viz_scale;
    if (n < 80) n = 80;
    if (n > 220) n = 220;
    return n;
  }

  function normalizeAssocSplit(raw) {
    var out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach(function (k) {
      var n = parseFloat(raw[k]);
      if (!isNaN(n) && n >= 0.2 && n <= 0.8) out[String(k)] = Math.round(n * 1000) / 1000;
    });
    return out;
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
      safe_delete: DEFAULTS.safe_delete,
      branding_page_size: DEFAULTS.branding_page_size,
      card_zoom: DEFAULTS.card_zoom,
      assoc_split: {},
      explorer_show_all: DEFAULTS.explorer_show_all,
      explorer_lang_filter: DEFAULTS.explorer_lang_filter,
      explorer_viz_view: DEFAULTS.explorer_viz_view,
      explorer_viz_scale: DEFAULTS.explorer_viz_scale,
      reveal_low_tags: DEFAULTS.reveal_low_tags,
      sidebar_collapsed: DEFAULTS.sidebar_collapsed,
    };
    if (!raw || typeof raw !== "object") return out;
    if ("safe_delete" in raw) out.safe_delete = !!raw.safe_delete;
    if ("branding_page_size" in raw) {
      out.branding_page_size = clampPageSize(raw.branding_page_size);
    }
    if ("card_zoom" in raw) out.card_zoom = clampCardZoom(raw.card_zoom);
    if ("assoc_split" in raw) out.assoc_split = normalizeAssocSplit(raw.assoc_split);
    if ("explorer_show_all" in raw) out.explorer_show_all = !!raw.explorer_show_all;
    if ("explorer_lang_filter" in raw) {
      out.explorer_lang_filter = String(raw.explorer_lang_filter || "");
    }
    if ("explorer_viz_view" in raw) {
      var vv = String(raw.explorer_viz_view || "tiles");
      out.explorer_viz_view = vv === "list" ? "list" : "tiles";
    }
    if ("explorer_viz_scale" in raw) {
      out.explorer_viz_scale = clampVizScale(raw.explorer_viz_scale);
    }
    if ("reveal_low_tags" in raw) out.reveal_low_tags = !!raw.reveal_low_tags;
    if ("sidebar_collapsed" in raw) out.sidebar_collapsed = !!raw.sidebar_collapsed;
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
    /* Mirror hot keys for modules that still read legacy LS once at boot */
    try {
      localStorage.setItem("dam_viz_card_zoom", String(_prefs.card_zoom));
      localStorage.setItem("dam_branding_page_size", String(_prefs.branding_page_size));
      localStorage.setItem("dam_explorer_show_all", _prefs.explorer_show_all ? "1" : "0");
      localStorage.setItem("dam_explorer_lang_filter", _prefs.explorer_lang_filter || "");
      localStorage.setItem("dam_viz_view_mode", _prefs.explorer_viz_view || "tiles");
      localStorage.setItem("dam_viz_scale", String(_prefs.explorer_viz_scale));
      localStorage.setItem("dam_reveal_low_tags", _prefs.reveal_low_tags ? "1" : "0");
      localStorage.setItem("dam_sidebar_collapsed", _prefs.sidebar_collapsed ? "1" : "0");
      Object.keys(_prefs.assoc_split || {}).forEach(function (pid) {
        localStorage.setItem(ASSOC_SPLIT_PREFIX + pid, String(_prefs.assoc_split[pid]));
      });
    } catch (e2) { /* ignore */ }
    try {
      global.dispatchEvent(
        new CustomEvent("dam:user-prefs", { detail: { prefs: _prefs } })
      );
    } catch (e3) { /* ignore */ }
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

  function parseLegacyValue(entry, raw) {
    if (raw == null || raw === "") return undefined;
    if (entry.parse === "int") {
      var n = parseInt(raw, 10);
      return isNaN(n) ? undefined : n;
    }
    if (entry.parse === "bool01") return raw === "1" || raw === "true";
    return String(raw);
  }

  function collectLegacyMigrationPatch() {
    var patch = {};
    var had = false;
    try {
      if (localStorage.getItem(MIGRATE_FLAG) === "1") return null;
    } catch (e0) { /* continue */ }

    LEGACY_MAP.forEach(function (entry) {
      try {
        var raw = localStorage.getItem(entry.ls);
        var val = parseLegacyValue(entry, raw);
        if (val !== undefined) {
          patch[entry.field] = val;
          had = true;
        }
      } catch (e) { /* ignore */ }
    });

    try {
      var assoc = {};
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(ASSOC_SPLIT_PREFIX) !== 0) continue;
        var pid = k.slice(ASSOC_SPLIT_PREFIX.length);
        var ratio = parseFloat(localStorage.getItem(k));
        if (!isNaN(ratio)) assoc[pid] = ratio;
      }
      if (Object.keys(assoc).length) {
        patch.assoc_split = assoc;
        had = true;
      }
    } catch (e2) { /* ignore */ }

    if (!had) {
      try { localStorage.setItem(MIGRATE_FLAG, "1"); } catch (e3) { /* ignore */ }
      return null;
    }
    return patch;
  }

  function postPrefs(prefs) {
    return fetch(bridgeUrl() + "/user-prefs", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ prefs: prefs }),
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
        return prefs;
      })
      .catch(function () {
        return prefs;
      });
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
        var server = null;
        if (res.httpOk && res.data && res.data.ok !== false && res.data.prefs) {
          server = normalize(res.data.prefs);
        }
        var local = getSync();
        var legacy = collectLegacyMigrationPatch();
        var merged = normalize(Object.assign({}, DEFAULTS, local, server || {}, legacy || {}));

        /* If server missing fields that legacy/local have — push migration */
        var needPush = !!legacy;
        if (server) {
          LEGACY_MAP.forEach(function (entry) {
            if (!(entry.field in (res.data.prefs || {})) && entry.field in merged) {
              needPush = true;
            }
          });
          if (!("assoc_split" in (res.data.prefs || {})) &&
              Object.keys(merged.assoc_split || {}).length) {
            needPush = true;
          }
        } else if (legacy || local) {
          needPush = true;
        }

        writeCache(merged);
        if (needPush) {
          return postPrefs(merged).then(function (p) {
            try { localStorage.setItem(MIGRATE_FLAG, "1"); } catch (e) { /* ignore */ }
            return p;
          });
        }
        try { localStorage.setItem(MIGRATE_FLAG, "1"); } catch (e2) { /* ignore */ }
        return merged;
      })
      .catch(function () {
        var fallback = writeCache(getSync());
        return fallback;
      })
      .then(function (prefs) {
        _loading = null;
        return prefs;
      });
    return _loading;
  }

  function set(patch) {
    var next = normalize(Object.assign({}, getSync(), patch || {}));
    if (patch && patch.assoc_split && typeof patch.assoc_split === "object") {
      next.assoc_split = normalizeAssocSplit(
        Object.assign({}, getSync().assoc_split || {}, patch.assoc_split)
      );
    }
    writeCache(next);
    return postPrefs(next);
  }

  function setDebounced(patch, ms) {
    _pendingPatch = Object.assign({}, _pendingPatch || {}, patch || {});
    if (_debounceTimer) clearTimeout(_debounceTimer);
    var wait = typeof ms === "number" ? ms : 400;
    var optimistic = normalize(Object.assign({}, getSync(), _pendingPatch));
    if (_pendingPatch.assoc_split) {
      optimistic.assoc_split = normalizeAssocSplit(
        Object.assign({}, getSync().assoc_split || {}, _pendingPatch.assoc_split)
      );
    }
    writeCache(optimistic);
    return new Promise(function (resolve) {
      _debounceTimer = setTimeout(function () {
        var toSend = _pendingPatch;
        _pendingPatch = null;
        _debounceTimer = null;
        set(toSend).then(resolve);
      }, wait);
    });
  }

  function setSafeDelete(on) {
    return set({ safe_delete: !!on });
  }

  function getCardZoom() {
    return clampCardZoom(getSync().card_zoom);
  }

  function setCardZoom(n, debounced) {
    var zoom = clampCardZoom(n);
    if (debounced) return setDebounced({ card_zoom: zoom });
    return set({ card_zoom: zoom });
  }

  function getAssocSplit(productId, fallback) {
    var map = getSync().assoc_split || {};
    var pid = String(productId || "");
    if (pid && map[pid] != null) return map[pid];
    return typeof fallback === "number" ? fallback : null;
  }

  function setAssocSplit(productId, ratio, debounced) {
    var pid = String(productId || "");
    if (!pid) return Promise.resolve(getSync());
    var patch = { assoc_split: {} };
    patch.assoc_split[pid] = ratio;
    if (debounced) return setDebounced(patch);
    return set(patch);
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
    setDebounced: setDebounced,
    setSafeDelete: setSafeDelete,
    isSafeDeleteEnabled: isSafeDeleteEnabled,
    getCardZoom: getCardZoom,
    setCardZoom: setCardZoom,
    getAssocSplit: getAssocSplit,
    setAssocSplit: setAssocSplit,
  };
})(typeof window !== "undefined" ? window : globalThis);
