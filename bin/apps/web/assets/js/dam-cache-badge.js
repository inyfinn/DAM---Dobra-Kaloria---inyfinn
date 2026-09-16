/**
 * dam-cache-badge.js — hover "Cache" chip when /thumb-cache served from PAMIEC.
 * Probes X-Dam-Thumb-Hit via HEAD (CORS Expose-Headers on local_bridge).
 */
(function () {
  "use strict";

  var HIT_ATTR = "data-dam-cache-hit";
  var probing = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  var probingLegacy = probing ? null : [];

  function isProbing(img) {
    if (probing) return probing.has(img);
    return probingLegacy.indexOf(img) !== -1;
  }

  function markProbing(img, on) {
    if (probing) {
      if (on) probing.add(img);
      else probing.delete(img);
      return;
    }
    var i = probingLegacy.indexOf(img);
    if (on && i < 0) probingLegacy.push(img);
    if (!on && i >= 0) probingLegacy.splice(i, 1);
  }

  function isThumbCacheUrl(src) {
    return typeof src === "string" && src.indexOf("/thumb-cache") !== -1;
  }

  function hostFor(img) {
    var host =
      img.closest(
        ".dam-viz-thumb, .dam-branding-thumb-stack, .dam-branding-recent__thumb-wrap, " +
          ".dam-dash-preview-card__media, .dam-search-hit__thumb, .dam-media-preview__assoc-thumb, " +
          ".dam-cache-host"
      ) || img.parentElement;
    if (!host) return null;
    host.classList.add("dam-cache-host");
    return host;
  }

  function ensureBadge(host) {
    var badge = host.querySelector(":scope > .dam-cache-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "dam-cache-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = "Cache";
      host.appendChild(badge);
    }
    return badge;
  }

  function applyHit(img, hit) {
    img.setAttribute(HIT_ATTR, hit ? "1" : "0");
    if (!hit) return;
    var host = hostFor(img);
    if (!host) return;
    ensureBadge(host).classList.add("dam-cache-badge--hit");
  }

  function probe(img) {
    if (!img || img.nodeType !== 1) return;
    if (img.getAttribute(HIT_ATTR) !== null) return;
    if (isProbing(img)) return;
    var src = img.currentSrc || img.getAttribute("src") || img.src || "";
    if (!isThumbCacheUrl(src)) return;
    markProbing(img, true);
    fetch(src, { method: "HEAD", cache: "no-store", credentials: "omit" })
      .then(function (res) {
        var hit = String(res.headers.get("X-Dam-Thumb-Hit") || "") === "1";
        applyHit(img, hit);
      })
      .catch(function () {
        /* network / CORS — leave unmarked */
      })
      .then(function () {
        markProbing(img, false);
      });
  }

  document.addEventListener(
    "pointerover",
    function (e) {
      var t = e.target;
      if (!t) return;
      if (t.tagName !== "IMG") {
        t = typeof t.closest === "function" ? t.closest("img") : null;
      }
      if (!t || t.tagName !== "IMG") return;
      probe(t);
    },
    true
  );

  window.DamCacheBadge = {
    probe: probe,
    refresh: function (root) {
      var scope = root && root.querySelectorAll ? root : document;
      var imgs = scope.querySelectorAll
        ? scope.querySelectorAll('img[src*="thumb-cache"]')
        : [];
      for (var i = 0; i < imgs.length; i++) probe(imgs[i]);
    }
  };
})();
