/**
 * DAM Guest Cache — statyczne miniatury z data/thumbs/ (Panel-DAM bez mostu).
 * Uzywaj TYLKO gdy brak dostepu do dysku Marketing (tryb goscia / bridge offline).
 */
(function (global) {
  "use strict";

  var MANIFEST_URL = "./data/guest-cache-manifest.json";
  var _manifest = null;
  var _loadPromise = null;

  function normKey(path) {
    return String(path || "").replace(/\\/g, "/").trim().toLowerCase();
  }

  function bridgeOk() {
    return !!(global.DamRuntime && global.DamRuntime.services_ok);
  }

  function isGuestContext() {
    if (global.DAM_GUEST_MODE) return true;
    if (global.DAM_FORCE_GUEST_CACHE) return true;
    if (global.DamGuestMode && typeof global.DamGuestMode.isActive === "function") {
      if (global.DamGuestMode.isActive()) return true;
    }
    return false;
  }

  /**
   * Statyczny cache TYLKO w trybie goscia / wymuszonym offline.
   * Gdy most + dysk OK: false (prawdziwe pliki przez bridge).
   */
  function shouldUse() {
    if (global.DAM_USE_GUEST_CACHE_ONLY) return true;
    if (isGuestContext()) return true;
    return false;
  }

  function loadManifest() {
    if (_manifest) return Promise.resolve(_manifest);
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch(MANIFEST_URL + "?_=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("manifest_" + r.status);
        return r.json();
      })
      .then(function (doc) {
        _manifest = doc || { entries: {} };
        global.DAM_GUEST_CACHE_MANIFEST = _manifest;
        try {
          global.dispatchEvent(
            new CustomEvent("dam:guest-cache-ready", { detail: { manifest: _manifest } })
          );
        } catch (e) { /* ignore */ }
        return _manifest;
      })
      .catch(function () {
        _manifest = { entries: {}, _error: true };
        return _manifest;
      });
    return _loadPromise;
  }

  function lookupEntry(path) {
    if (!_manifest || !_manifest.entries) return null;
    var key = normKey(path);
    if (!key) return null;
    return _manifest.entries[key] || null;
  }

  function thumbUrl(path, profile) {
    if (!path || !shouldUse()) return "";
    var prof = (profile || "grid").trim().toLowerCase() || "grid";
    var entry = lookupEntry(path);
    if (!entry) {
      /* Fallback: sprobuj grid gdy brak profilu */
      if (prof !== "grid") entry = lookupEntry(path);
      if (!entry && _manifest && _manifest.entries) {
        entry = _manifest.entries[normKey(path)];
      }
    }
    if (!entry) return "";
    var url = entry[prof] || entry.grid || entry.card || entry.modal || "";
    if (!url) return "";
    if (/^https?:\/\//i.test(url) || url.indexOf("data:") === 0) return url;
    if (url.charAt(0) === "/") return url;
    return url;
  }

  function stats() {
    if (!_manifest) return null;
    return _manifest.stats || null;
  }

  global.DamGuestCache = {
    shouldUse: shouldUse,
    isGuestContext: isGuestContext,
    loadManifest: loadManifest,
    thumbUrl: thumbUrl,
    normKey: normKey,
    stats: stats,
  };

  /* Preload manifest w trybie goscia (dam-guest-mode wywola ponownie — idempotent). */
  if (isGuestContext() || global.DAM_PRELOAD_GUEST_CACHE) {
    loadManifest();
  }
})(typeof window !== "undefined" ? window : globalThis);
