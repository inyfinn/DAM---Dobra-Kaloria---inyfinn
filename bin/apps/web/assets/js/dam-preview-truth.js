/**
 * DamPreviewTruth — honest preview labels + thumb-cache URLs.
 * PI: preview.file_state.*, preview.onerror_not_synology, preview.cache.*
 *
 * NEVER use "Synology Drive / brak sync" as a generic onerror fallback.
 * online_only label only after /file-availability says so.
 */
(function (global) {
  "use strict";

  /* Thumb-cache WŁĄCZONY: /thumb-cache → PAMIEC-PODRECZNA (AVIF/JPG).
   * Wyłączenie awaryjne: window.DAM_DISABLE_THUMB_WARM = true przed tym plikiem. */
  if (typeof global.DAM_DISABLE_THUMB_WARM === "undefined") {
    global.DAM_DISABLE_THUMB_WARM = false;
  }

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

  function toLocal(path) {
    if (global.DamPaths && typeof DamPaths.toLocal === "function") {
      return DamPaths.toLocal(path);
    }
    return path || "";
  }

  /**
   * Grid/card FIRST PAINT only (PI preview.cache.ephemeral_only).
   * Redis/PAMIEC przyspiesza pokazanie karty — NIGDY nie uzywac jako stale src
   * po kliknieciu (modal/lightbox = /media, źródło z dysku).
   */
  function mediaPreviewUrl(path) {
    if (!path) return "";
    var local = toLocal(path);
    if (!local) return "";
    var name = String(local).split(/[/\\]/).pop() || "";
    if (!/\.[A-Za-z0-9]{2,8}$/.test(name)) return "";
    var ext = String(name.split(".").pop() || "").toLowerCase();
    var url = bridgeUrl() + "/media?path=" + encodeURIComponent(local);
    if (/^(png|jpe?g|webp|gif|tif|tiff|bmp|psd|psb|ai|pdf|avif|svg)$/i.test(ext)) {
      url += "&preview=1";
    }
    return url;
  }

  function thumbCacheUrl(path, profile) {
    if (!path) return "";
    if (global.DAM_DISABLE_THUMB_WARM) {
      return mediaPreviewUrl(path);
    }
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

  /**
   * Cache paints immediately, but the source request starts in parallel and
   * always replaces it when available. No delay and no cache-only steady state.
   */
  function preferOriginal(img, path) {
    if (!img || !path || img.getAttribute("data-dam-original-started") === "1") return;
    var original = mediaPreviewUrl(path);
    if (!original || img.src === original) return;
    img.setAttribute("data-dam-original-started", "1");
    var probe = new Image();
    probe.decoding = "async";
    probe.onload = function () {
      if (!img.isConnected || img.getAttribute("data-dam-original") !== path) return;
      img.src = original;
      img.setAttribute("data-dam-original-ready", "1");
    };
    probe.onerror = function () {
      img.setAttribute("data-dam-original-unavailable", "1");
    };
    probe.src = original;
  }

  var _originalObserver =
    global.IntersectionObserver
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              _originalObserver.unobserve(entry.target);
              preferOriginal(entry.target, entry.target.getAttribute("data-dam-original") || "");
            });
          },
          { rootMargin: "320px 0px" }
        )
      : null;

  function armOriginal(img) {
    if (!img || img.getAttribute("data-dam-original-armed") === "1") return;
    img.setAttribute("data-dam-original-armed", "1");
    if (_originalObserver) _originalObserver.observe(img);
    else preferOriginal(img, img.getAttribute("data-dam-original") || "");
  }

  function armOriginals(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("img[data-dam-original]").forEach(function (img) {
      armOriginal(img);
    });
    if (root && root.matches && root.matches("img[data-dam-original]")) {
      armOriginal(root);
    }
  }

  function observeOriginals() {
    armOriginals(document);
    if (!global.MutationObserver || !document.documentElement) return;
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (node && node.nodeType === 1) armOriginals(node);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
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
    if (global.DAM_DISABLE_THUMB_WARM) {
      return Promise.resolve({ ok: true, queued: 0, skipped: "disabled" });
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

  /*
   * Most po 2,5 s oddaje 504 (thumb_timeout), ale dalej liczy miniature w tle i zapisuje
   * ja w PAMIEC-PODRECZNA. Plik JEST - podglad jeszcze nie. Zamiast od razu
   * "Podglad niedostepny" (a potem kilka recznych przeladowan okna) ponawiamy sami.
   */
  var RETRY_DELAYS_MS = [2500, 6000, 12000, 25000, 45000];
  var RETRY_CSS_ID = "damThumbRetryCss";

  function ensureRetryCss() {
    if (document.getElementById(RETRY_CSS_ID)) return;
    var st = document.createElement("style");
    st.id = RETRY_CSS_ID;
    st.textContent =
      ".dam-thumb-wait{background:linear-gradient(100deg,var(--dam-surface-muted,#f1f3f2) 30%,var(--dam-surface,#fff) 50%,var(--dam-surface-muted,#f1f3f2) 70%);" +
      "background-size:300% 100%;animation:damThumbWait 1.6s ease-in-out infinite;}" +
      "@keyframes damThumbWait{0%{background-position:100% 0}100%{background-position:0 0}}" +
      "@media (prefers-reduced-motion: reduce){.dam-thumb-wait{animation:none}}";
    (document.head || document.documentElement).appendChild(st);
  }

  function waitHost(img) {
    return (img.closest && img.closest(".dam-viz-thumb, .dam-branding-thumb")) || img.parentNode;
  }

  /**
   * Zaplanuj ponowne wczytanie img z url po chwili. Zwraca false, gdy limit prob wyczerpany
   * (wtedy wolajacy pokazuje uczciwy placeholder).
   */
  function retryThumbLater(img, url) {
    if (!img || !url) return false;
    var n = Number(img.getAttribute("data-thumb-retry") || "0");
    if (n >= RETRY_DELAYS_MS.length) return false;
    img.setAttribute("data-thumb-retry", String(n + 1));
    ensureRetryCss();
    var host = waitHost(img);
    if (host && host.classList) host.classList.add("dam-thumb-wait");
    if (img.getAttribute("data-thumb-retry-bound") !== "1") {
      img.setAttribute("data-thumb-retry-bound", "1");
      img.addEventListener("load", function () {
        var h = waitHost(img);
        if (h && h.classList) h.classList.remove("dam-thumb-wait");
      });
    }
    setTimeout(function () {
      if (!img.isConnected) return;
      if (img.getAttribute("data-dam-original-ready") === "1") return;
      img.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "_r=" + (n + 1);
    }, RETRY_DELAYS_MS[n]);
    return true;
  }

  function stopThumbWait(img) {
    var host = img && waitHost(img);
    if (host && host.classList) host.classList.remove("dam-thumb-wait");
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
    mediaPreviewUrl: mediaPreviewUrl,
    preferOriginal: preferOriginal,
    armOriginals: armOriginals,
    onErrorTitle: onErrorTitle,
    fallbackHint: fallbackHint,
    fileAvailability: fileAvailability,
    warmThumbs: warmThumbs,
    rootUnsetCtaHref: rootUnsetCtaHref,
    applyFallbackEl: applyFallbackEl,
    retryThumbLater: retryThumbLater,
    stopThumbWait: stopThumbWait,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeOriginals, { once: true });
  } else {
    observeOriginals();
  }
})(typeof window !== "undefined" ? window : globalThis);
