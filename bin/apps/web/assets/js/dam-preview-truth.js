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
  var LABEL_MISSING = "Podgląd niedostępny";
  var LABEL_HINT = "brak podglądu";
  var LABEL_ROOT = "Ustaw ścieżkę Marketing w ustawieniach dysku";
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

  /** Explicit single-file open: the bridge may download this one original (fetch=1). */
  function withFetch(url) {
    if (!url || url.indexOf("/media?") < 0 || /[?&]fetch=1\b/.test(url)) return url || "";
    return url + "&fetch=1";
  }

  /**
   * Hero already shows the cache-first response; ask the bridge again (it returns the original
   * only when the file is on this disk) and swap once it has fully arrived. Never downloads.
   */
  function upgradeWhenReady(img, url) {
    var full = url || "";
    if (!img || !full) return;
    var token = (img._damUpgradeToken = (img._damUpgradeToken || 0) + 1);
    var probe = new Image();
    probe.decoding = "async";
    probe.onload = function () {
      if (img._damUpgradeToken !== token || !img.isConnected) return;
      img.onerror = null;
      img.src = full;
      img.setAttribute("data-dam-original-ready", "1");
    };
    probe.src = full;
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
   * "Podgląd niedostępny" (a potem kilka recznych przeladowan okna) ponawiamy sami.
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

  /*
   * Zaslepka po wyczerpaniu retryThumbLater (prawdziwy 404, nie pending 504): most
   * albo inny watek moze dociagnac miniature pozniej (boot sync / K-WARM). Zamiast
   * zostawiac karte martwa do recznego przeladowania, co 60 s sprawdzamy ponownie
   * /thumb-cache - ale TYLKO dla zaslepek aktualnie widocznych w oknie.
   */
  var REVIVE_INTERVAL_MS = 60000;
  var reviveTargets = [];
  var reviveTimer = null;
  var reviveObserver = global.IntersectionObserver
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          entry.target._damReviveVisible = entry.isIntersecting;
        });
      })
    : null;

  function isReviveTargetVisible(el) {
    if (!el || !el.isConnected) return false;
    if (reviveObserver) return !!el._damReviveVisible;
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (!r) return false;
    var vh = global.innerHeight || document.documentElement.clientHeight || 0;
    var vw = global.innerWidth || document.documentElement.clientWidth || 0;
    return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
  }

  function dropReviveTarget(t) {
    var i = reviveTargets.indexOf(t);
    if (i >= 0) reviveTargets.splice(i, 1);
    if (reviveObserver) reviveObserver.unobserve(t.el);
  }

  function reviveSweep() {
    // odpiete z DOM w miedzyczasie - przestan sledzic
    reviveTargets = reviveTargets.filter(function (t) {
      return t.el && t.el.isConnected;
    });
    reviveTargets.forEach(function (t) {
      if (!isReviveTargetVisible(t.el)) return;
      var url = thumbCacheUrl(t.path, t.profile);
      if (!url) return;
      var probe = new Image();
      probe.decoding = "async";
      probe.onload = function () {
        dropReviveTarget(t);
        t.onReady(url);
      };
      probe.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "_rv=" + Date.now();
    });
    if (!reviveTargets.length && reviveTimer) {
      global.clearInterval(reviveTimer);
      reviveTimer = null;
    }
  }

  /**
   * Zarejestruj zaslepke (img albo div) do samo-naprawy. path = sciezka pliku,
   * profile = "grid"/"card"/"modal", onReady(freshUrl) wywolane raz, gdy
   * /thumb-cache odda 200 podczas gdy el jest widoczny w oknie.
   */
  function retryPlaceholderLater(el, path, profile, onReady) {
    if (!el || !path || typeof onReady !== "function") return;
    var already = reviveTargets.some(function (t) {
      return t.el === el;
    });
    if (already) return;
    reviveTargets.push({ el: el, path: path, profile: profile || "grid", onReady: onReady });
    if (reviveObserver) reviveObserver.observe(el);
    if (!reviveTimer) reviveTimer = global.setInterval(reviveSweep, REVIVE_INTERVAL_MS);
  }

  var ORIGIN_CSS_ID = "damCacheOriginCss";

  function ensureOriginCss() {
    if (document.getElementById(ORIGIN_CSS_ID)) return;
    var st = document.createElement("style");
    st.id = ORIGIN_CSS_ID;
    st.textContent =
      ".dam-cache-origin{position:absolute;left:12px;bottom:12px;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:calc(100% - 24px);pointer-events:none}" +
      ".dam-cache-origin__badge,.dam-cache-origin__get{box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 14px;border-radius:var(--dam-radius-sm,8px);font-family:inherit;font-size:13px;font-weight:600;line-height:1.2;white-space:nowrap;box-shadow:var(--dam-shadow,0 10px 30px rgb(34 34 34 / .08));pointer-events:auto}" +
      ".dam-cache-origin__badge{background:var(--dam-surface,#fff);color:var(--dam-text,#222);border:1px solid rgb(var(--dam-shadow-rgb,34 34 34) / .12)}" +
      ".dam-cache-origin__badge i{font-size:16px;color:var(--dam-primary,#007936)}" +
      ".dam-cache-origin__get{border:0;cursor:pointer;background:var(--dam-primary,#007936);color:#fff;transition:background .15s ease,transform .15s ease}" +
      ".dam-cache-origin__get i{font-size:18px}" +
      ".dam-cache-origin__get:hover{background:var(--dam-primary-hover,#00642E)}" +
      ".dam-cache-origin__get:active{transform:translateY(1px)}" +
      ".dam-cache-origin__get:focus-visible{outline:2px solid var(--dam-primary,#007936);outline-offset:2px}" +
      ".dam-cache-origin__get[disabled]{cursor:progress;opacity:.85}" +
      ".dam-cache-origin__msg{flex-basis:100%;margin:0;padding:4px 8px;border-radius:var(--dam-radius-sm,8px);background:var(--dam-surface,#fff);color:#b42318;font-family:inherit;font-size:12px;font-weight:500;line-height:1.4;pointer-events:auto}" +
      "@media (prefers-reduced-motion: reduce){.dam-cache-origin__get{transition:none}}";
    (document.head || document.documentElement).appendChild(st);
  }

  function iconEl(name) {
    var i = document.createElement("i");
    i.className = "uil " + name;
    i.setAttribute("aria-hidden", "true");
    return i;
  }

  /**
   * Preview of one file: when the image does not come from this disk, say so and offer
   * "Pobierz oryginał". That click is the only thing that ever downloads an online-only file.
   */
  function markPreviewSource(img, path, host) {
    host = host || (img && img.parentNode);
    if (!img || !path || !host) return;
    var prev = host.querySelector(".dam-cache-origin");
    if (prev) prev.remove();
    var token = (img._damOriginToken = (img._damOriginToken || 0) + 1);
    fileAvailability(path).then(function (av) {
      if (img._damOriginToken !== token || !img.isConnected) return;
      var state = (av && av.state) || "missing";
      if (state === "local" || state === "sync_pending") return;
      ensureOriginCss();
      if (global.getComputedStyle && getComputedStyle(host).position === "static") {
        host.style.position = "relative";
      }
      var bar = document.createElement("div");
      bar.className = "dam-cache-origin";
      var badge = document.createElement("span");
      badge.className = "dam-cache-origin__badge";
      badge.title =
        state === "online_only"
          ? "Oryginał jest tylko online na Synology. Widzisz kopię z pamięci podręcznej."
          : "Oryginału nie ma na tym komputerze. Widzisz kopię z pamięci podręcznej.";
      badge.appendChild(iconEl("uil-database"));
      badge.appendChild(document.createTextNode("Podgląd z pamięci podręcznej"));
      bar.appendChild(badge);
      if (state === "online_only") {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dam-cache-origin__get";
        btn.title = "Pobierz ten plik z Synology na dysk i pokaż oryginał";
        btn.appendChild(iconEl("uil-arrow-down"));
        var label = document.createElement("span");
        label.textContent = "Pobierz oryginał";
        btn.appendChild(label);
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var msg = bar.querySelector(".dam-cache-origin__msg");
          if (msg) msg.remove();
          var full = withFetch(mediaPreviewUrl(path));
          if (!full) return;
          btn.disabled = true;
          label.textContent = "Pobieram z Synology...";
          var probe = new Image();
          probe.decoding = "async";
          probe.onload = function () {
            delete _availCache[toLocal(path)];
            if (!img.isConnected) return;
            img.onerror = null;
            img.src = full;
            img.setAttribute("data-dam-original-ready", "1");
            bar.remove();
          };
          probe.onerror = function () {
            btn.disabled = false;
            label.textContent = "Pobierz oryginał";
            var m = document.createElement("p");
            m.className = "dam-cache-origin__msg";
            m.setAttribute("role", "alert");
            m.textContent = "Nie udało się pobrać. Sprawdź połączenie z Synology i spróbuj ponownie.";
            bar.appendChild(m);
          };
          probe.src = full;
        });
        bar.appendChild(btn);
      }
      host.appendChild(bar);
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
    withFetch: withFetch,
    upgradeWhenReady: upgradeWhenReady,
    markPreviewSource: markPreviewSource,
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
    retryPlaceholderLater: retryPlaceholderLater,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeOriginals, { once: true });
  } else {
    observeOriginals();
  }
})(typeof window !== "undefined" ? window : globalThis);
