/**
 * DAM ETA - Global Tooltips Helper
 * Pokazuje tooltip dla elementow z data-dam-tip lub title (fallback).
 * Szanuje localStorage.dam_tooltips=off.
 * Ustawienie: localStorage.dam_tooltips ("on" | "off"), domyslnie on.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "dam_tooltips";
  var DELAY_MS = 500;
  var tipEl = null;
  var showTimer = null;

  function isEnabled() {
    return localStorage.getItem(STORAGE_KEY) !== "off";
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
    tip.style.display = "block";
    tip.setAttribute("aria-hidden", "false");

    var rect = el.getBoundingClientRect();
    var scrollY = window.scrollY || document.documentElement.scrollTop;
    var scrollX = window.scrollX || document.documentElement.scrollLeft;

    var top = rect.bottom + scrollY + 6;
    var left = rect.left + scrollX;

    // Upewnij sie, ze nie wychodzi poza prawy brzeg
    var tipW = tip.offsetWidth || 200;
    var maxLeft = window.innerWidth - tipW - 12;
    if (left > maxLeft) left = maxLeft;
    if (left < 4) left = 4;

    tip.style.top = top + "px";
    tip.style.left = left + "px";
  }

  function hideTip() {
    clearTimeout(showTimer);
    if (tipEl) {
      tipEl.style.display = "none";
      tipEl.setAttribute("aria-hidden", "true");
    }
  }

  function bindElement(el) {
    if (el._damTipBound) return;
    el._damTipBound = true;

    el.addEventListener("mouseenter", function () {
      if (!isEnabled()) return;
      var text = el.getAttribute("data-dam-tip") || el.getAttribute("title") || "";
      if (!text) return;
      clearTimeout(showTimer);
      showTimer = setTimeout(function () {
        showTip(el, text);
      }, DELAY_MS);
    });

    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", function () {
      if (!isEnabled()) return;
      var text = el.getAttribute("data-dam-tip") || el.getAttribute("title") || "";
      if (!text) return;
      showTip(el, text);
    });
    el.addEventListener("blur", hideTip);
    el.addEventListener("click", hideTip);
  }

  function bindAll() {
    document.querySelectorAll("[data-dam-tip]").forEach(bindElement);
  }

  function init() {
    bindAll();

    // MutationObserver - binduj nowo dodane elementy
    if (window.MutationObserver) {
      var obs = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            if (node.hasAttribute && node.hasAttribute("data-dam-tip")) bindElement(node);
            node.querySelectorAll && node.querySelectorAll("[data-dam-tip]").forEach(bindElement);
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
