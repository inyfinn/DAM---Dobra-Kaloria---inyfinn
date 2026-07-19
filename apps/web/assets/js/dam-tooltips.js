/**
 * DAM - Global Tooltips Helper
 * Pokazuje tooltip dla elementow z data-dam-tip, title lub aria-label.
 * Szanuje localStorage.dam_tooltips=off.
 * Ustawienie: localStorage.dam_tooltips ("on" | "off"), domyslnie on.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "dam_tooltips";
  var DELAY_MS = 280;
  var tipEl = null;
  var showTimer = null;

  function isEnabled() {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  }

  function tipText(el) {
    if (!el || !el.getAttribute) return "";
    return (
      el.getAttribute("data-dam-tip") ||
      el.getAttribute("title") ||
      el.getAttribute("aria-label") ||
      ""
    ).trim();
  }

  function getOrCreateTip() {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "dam-tooltip";
      tipEl.id = "damGlobalTooltip";
      tipEl.setAttribute("role", "tooltip");
      tipEl.setAttribute("aria-hidden", "true");
      tipEl.style.display = "none";
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function showTip(el, text) {
    var tip = getOrCreateTip();
    tip.textContent = text;
    tip.style.visibility = "hidden";
    tip.style.display = "block";
    tip.setAttribute("aria-hidden", "false");
    /* fixed - wspolrzedne viewport (dziala nad modalem) */
    tip.style.position = "fixed";
    tip.style.zIndex = "20050";

    var rect = el.getBoundingClientRect();
    var tipW = Math.min(tip.offsetWidth || 280, window.innerWidth - 24);
    var tipH = tip.offsetHeight || 40;

    var left = rect.left + rect.width / 2 - tipW / 2;
    var maxLeft = window.innerWidth - tipW - 12;
    if (left > maxLeft) left = maxLeft;
    if (left < 12) left = 12;

    /* Stopka modala: tip nad przyciskiem (nie pod viewport) */
    var preferAbove = rect.top > window.innerHeight * 0.55;
    var top = preferAbove ? rect.top - tipH - 8 : rect.bottom + 8;
    if (!preferAbove && top + tipH + 12 > window.innerHeight) {
      top = rect.top - tipH - 8;
    }
    if (top < 8) top = 8;

    tip.style.top = Math.round(top) + "px";
    tip.style.left = Math.round(left) + "px";
    tip.style.visibility = "visible";
  }

  function hideTip() {
    clearTimeout(showTimer);
    if (tipEl) {
      tipEl.style.display = "none";
      tipEl.setAttribute("aria-hidden", "true");
    }
  }

  function bindElement(el) {
    if (!el || el._damTipBound) return;
    var text = tipText(el);
    if (!text) return;
    el._damTipBound = true;

    /* Ukryj natywny title, zeby nie dublowac z naszym jasnym tipem */
    if (el.getAttribute("title") && !el.getAttribute("data-dam-tip")) {
      el.setAttribute("data-dam-tip", el.getAttribute("title"));
    }
    if (el.getAttribute("title")) {
      el.setAttribute("data-dam-native-title", el.getAttribute("title"));
      el.removeAttribute("title");
    }

    el.addEventListener("mouseenter", function () {
      if (!isEnabled()) return;
      var t = tipText(el);
      if (!t) return;
      clearTimeout(showTimer);
      showTimer = setTimeout(function () {
        showTip(el, t);
      }, DELAY_MS);
    });

    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", function () {
      if (!isEnabled()) return;
      var t = tipText(el);
      if (!t) return;
      showTip(el, t);
    });
    el.addEventListener("blur", hideTip);
    el.addEventListener("click", hideTip);
  }

  function shouldAutoTip(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled || el.getAttribute("aria-hidden") === "true") return false;
    /* Nie tipuj kontenerow (modal/dialog) - tylko interaktywne elementy */
    var role = el.getAttribute("role") || "";
    if (role === "dialog" || role === "listbox" || role === "group" || el.getAttribute("aria-modal") === "true") {
      return el.hasAttribute("data-dam-tip");
    }
    if (el.id === "damVizModal" || (el.classList && el.classList.contains("dam-viz-modal-overlay"))) {
      return false;
    }
    var tag = el.tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return true;
    if (role === "button") return true;
    if (el.classList && (
      el.classList.contains("dam-badge-tag") ||
      el.classList.contains("dam-viz-badge") ||
      el.classList.contains("dam-viz-icon-btn") ||
      el.classList.contains("dam-tag-pill") ||
      el.classList.contains("geex-btn") ||
      el.classList.contains("dam-admin-control")
    )) return true;
    return el.hasAttribute("data-dam-tip") || !!el.getAttribute("title") || !!el.getAttribute("aria-label");
  }

  function bindAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-dam-tip], [title], [aria-label], button, a.geex-btn, .dam-badge-tag, .dam-viz-icon-btn, .dam-tag-pill").forEach(function (el) {
      if (shouldAutoTip(el)) bindElement(el);
    });
  }

  function init() {
    bindAll(document);

    if (window.MutationObserver) {
      var obs = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            if (shouldAutoTip(node)) bindElement(node);
            if (node.querySelectorAll) bindAll(node);
          });
        });
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.DamTooltips = {
    enable: function () { localStorage.setItem(STORAGE_KEY, "on"); },
    disable: function () { localStorage.setItem(STORAGE_KEY, "off"); },
    isEnabled: isEnabled,
    bind: bindAll
  };
})();
