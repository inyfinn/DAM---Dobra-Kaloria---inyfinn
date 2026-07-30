/**
 * DamPreviewTruth — honest preview labels + thumb-cache URLs.
 * PI: preview.file_state.*, preview.onerror_not_synology, preview.cache.*
 *
 * Disk path (bridge /media) when bridge + local file available.
 * PAMIEC-PODRECZNA cache ONLY when guest mode, bridge offline, or file unavailable.
 */
(function (global) {
  "use strict";

  var LABEL_ONLINE_ONLY = "Element z dysku dostępny tylko online - Synology";
  var LABEL_MISSING = "Podglad niedostępny";
  var LABEL_HINT = "brak podglądu";
  var LABEL_ROOT = "Ustaw ścieżke Marketing w ustawieniach dysku";
  var CTA_DISK = "settings.html#damDisk";

  function bridgeUrl() {
    return global.DamRuntime && DamRuntime.bridgeUrl
      ? DamRuntime.bridgeUrl()
      : "http://127.0.0.1:8766";
  }

  function bridgeOnline() {
    return !!(global.DamRuntime && global.DamRuntime.services_ok);
  }

  function toLocal(path) {
    if (global.DamPaths && typeof DamPaths.toLocal === "function") {
      return DamPaths.toLocal(path);
    }
    return path || "";
  }

  function normPathKey(path) {
    return String(path || "").replace(/\\/g, "/").trim().toLowerCase();
  }

  function shouldUseStaticThumbCache(opts) {
    opts = opts || {};
    if (opts.cacheOnly) return true;
    if (opts.fileState === "online_only" || opts.fileState === "missing") return true;
    if (global.DamGuestCache && typeof global.DamGuestCache.shouldUse === "function") {
      if (global.DamGuestCache.shouldUse()) return true;
    }
    if (global.DAM_GUEST_MODE) return true;
    if (!bridgeOnline()) return true;
    return false;
  }

  function manifestBaseUrl() {
    var m = global.DAM_THUMB_MANIFEST;
    return (m && m.base_url) || "data/thumbs/";
  }

  function staticThumbFromManifest(path, profile) {
    if (global.DamGuestCache && typeof global.DamGuestCache.thumbUrl === "function") {
      var guestUrl = global.DamGuestCache.thumbUrl(path, profile);
      if (guestUrl) return guestUrl;
    }
    var m = global.DAM_THUMB_MANIFEST || global.DAM_GUEST_CACHE_MANIFEST;
    if (!m || !m.entries) return "";
    var key = normPathKey(path);
    var localKey = normPathKey(toLocal(path));
    var entry = m.entries[key] || m.entries[localKey];
    if (!entry) return "";
    var prof = (profile || "grid").trim() || "grid";
    return entry[prof] || entry.grid || entry.card || entry.modal || "";
  }

  function bridgeCacheOnlyUrl(path, profile) {
    var local = toLocal(path);
    var p = (profile || "grid").trim() || "grid";
    return (
      bridgeUrl() +
      "/thumb-cache?path=" +
      encodeURIComponent(local) +
      "&profile=" +
      encodeURIComponent(p) +
      "&cache_only=1"
    );
  }

  function liveDiskPreviewUrl(path) {
    var localDirect = toLocal(path);
    var ext = String(localDirect.split(".").pop() || "").toLowerCase();
    var url = bridgeUrl() + "/media?path=" + encodeURIComponent(localDirect);
    if (/^(png|jpe?g|webp|gif|tif|tiff|bmp|psd|psb|ai|pdf)$/i.test(ext)) {
      url += "&preview=1";
    }
    return url;
  }

  /**
   * Grid/card thumb URL.
   * Guest / offline / unavailable file -> static PAMIEC manifest or bridge cache_only.
   * Bridge + local disk -> /media?preview=1 (never stale Redis placeholder).
   */
  function thumbCacheUrl(path, profile, opts) {
    if (!path) return "";
    opts = opts || {};
    var prof = (profile || "grid").trim() || "grid";

    if (shouldUseStaticThumbCache(opts)) {
      var staticUrl = staticThumbFromManifest(path, prof);
      if (staticUrl) return staticUrl;
      if (bridgeOnline()) return bridgeCacheOnlyUrl(path, prof);
      return "";
    }

    return liveDiskPreviewUrl(path);
  }

  function fallbackTitle(state) {
    if (state === "online_only") return LABEL_ONLINE_ONLY;
    if (state === "root_unset") return LABEL_ROOT;
    return LABEL_MISSING;
  }

  function fallbackHint(state) {
    if (state === "online_only") return "tylko online";
    if (state === "root_unset") return "ustaw dysk";
    return LABEL_HINT;
  }

  function onErrorTitle(state) {
    return fallbackTitle(state || "");
  }

  var _availCache = Object.create(null);
  var _availInflight = Object.create(null);

  function fileAvailability(path) {
    var local = toLocal(path);
    if (!local) {
      return Promise.resolve({
        ok: true,
        state: "missing",
        label_pl: LABEL_MISSING,
        treat_as_local: false,
      });
    }
    if (_availCache[local] && Date.now() - _availCache[local]._ts < 25000) {
      return Promise.resolve(_availCache[local]);
    }
    if (!bridgeOnline()) {
      return Promise.resolve({
        ok: true,
        state: "missing",
        label_pl: LABEL_MISSING,
        treat_as_local: false,
        _ts: Date.now(),
      });
    }
    if (_availInflight[local]) return _availInflight[local];
    var url =
      bridgeUrl() + "/file-availability?path=" + encodeURIComponent(local);
    var headers = {};
    try {
      var tok = localStorage.getItem("dam_token");
      if (tok) headers.Authorization = "Bearer " + tok;
    } catch (e) {}
    _availInflight[local] = fetch(url, { headers: headers, credentials: "omit" })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        j = j || {};
        j._ts = Date.now();
        _availCache[local] = j;
        delete _availInflight[local];
        return j;
      })
      .catch(function () {
        delete _availInflight[local];
        return {
          ok: false,
          state: "missing",
          label_pl: LABEL_MISSING,
          treat_as_local: false,
          _ts: Date.now(),
        };
      });
    return _availInflight[local];
  }

  function warmThumbs(paths, profile) {
    if (!bridgeOnline() || global.DAM_GUEST_MODE) {
      return Promise.resolve({ ok: true, queued: 0, skipped: "cache_only_mode" });
    }
    var list = (paths || []).filter(Boolean).slice(0, 40);
    if (!list.length) return Promise.resolve({ ok: true, queued: 0 });
    var headers = { "Content-Type": "application/json" };
    try {
      var tok = localStorage.getItem("dam_token");
      if (tok) headers.Authorization = "Bearer " + tok;
    } catch (e) {}
    return fetch(bridgeUrl() + "/thumb-cache/warm", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        paths: list.map(toLocal),
        profile: profile || "grid",
        async: true,
      }),
    })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function loadThumbManifest(url) {
    if (global.DamGuestCache && typeof global.DamGuestCache.loadManifest === "function") {
      return global.DamGuestCache.loadManifest();
    }
    var src = url || "./data/guest-cache-manifest.json";
    return fetch(src + (src.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now(), {
      cache: "no-store",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("manifest_" + r.status);
        return r.json();
      })
      .then(function (m) {
        global.DAM_THUMB_MANIFEST = m;
        return m;
      })
      .catch(function () {
        return null;
      });
  }

  function rootUnsetCtaHref() {
    return CTA_DISK;
  }

  function applyFallbackEl(el, state) {
    if (!el) return;
    var title = onErrorTitle(state);
    el.title = title;
    if (el.getAttribute("aria-label") && /Synology Drive/i.test(el.getAttribute("aria-label"))) {
      el.setAttribute("aria-label", title);
    }
  }

  global.DamPreviewTruth = {
    LABEL_ONLINE_ONLY: LABEL_ONLINE_ONLY,
    LABEL_MISSING: LABEL_MISSING,
    LABEL_HINT: LABEL_HINT,
    LABEL_ROOT: LABEL_ROOT,
    thumbCacheUrl: thumbCacheUrl,
    shouldUseStaticThumbCache: shouldUseStaticThumbCache,
    staticThumbFromManifest: staticThumbFromManifest,
    liveDiskPreviewUrl: liveDiskPreviewUrl,
    onErrorTitle: onErrorTitle,
    fallbackHint: fallbackHint,
    fileAvailability: fileAvailability,
    warmThumbs: warmThumbs,
    loadThumbManifest: loadThumbManifest,
    rootUnsetCtaHref: rootUnsetCtaHref,
    applyFallbackEl: applyFallbackEl,
  };
})(typeof window !== "undefined" ? window : globalThis);
