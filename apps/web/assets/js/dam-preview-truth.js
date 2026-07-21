/**
 * DamPreviewTruth — honest preview labels + thumb-cache URLs.
 * PI: preview.file_state.*, preview.onerror_not_synology, preview.cache.*
 *
 * NEVER use "Synology Drive / brak sync" as a generic onerror fallback.
 * online_only label only after /file-availability says so.
 */
(function (global) {
  "use strict";

  var LABEL_ONLINE_ONLY = "Element z dysku dostepny tylko online - Synology";
  var LABEL_MISSING = "Podglad niedostepny";
  var LABEL_HINT = "brak podgladu";
  var LABEL_ROOT = "Ustaw sciezke Marketing w ustawieniach dysku";
  var CTA_DISK = "settings.html#damDisk";

  function bridgeUrl() {
    return global.DamRuntime && DamRuntime.bridgeUrl
      ? DamRuntime.bridgeUrl()
      : "http://127.0.0.1:8766";
  }

  function toLocal(path) {
    if (global.DamPaths && typeof DamPaths.toLocal === "function") {
      return DamPaths.toLocal(path);
    }
    return path || "";
  }

  /** Grid/card thumbs go through /thumb-cache (disk PAMIEC + Redis meta). */
  function thumbCacheUrl(path, profile) {
    if (!path) return "";
    var local = toLocal(path);
    var p = (profile || "grid").trim() || "grid";
    return (
      bridgeUrl() +
      "/thumb-cache?path=" +
      encodeURIComponent(local) +
      "&profile=" +
      encodeURIComponent(p)
    );
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

  /**
   * Honest onerror title — never the old Synology Drive lie.
   * Optional state from file-availability.
   */
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
    onErrorTitle: onErrorTitle,
    fallbackHint: fallbackHint,
    fileAvailability: fileAvailability,
    warmThumbs: warmThumbs,
    rootUnsetCtaHref: rootUnsetCtaHref,
    applyFallbackEl: applyFallbackEl,
  };
})(typeof window !== "undefined" ? window : globalThis);
