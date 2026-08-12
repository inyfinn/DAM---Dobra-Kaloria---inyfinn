/**
 * DAM — mierzy wysokość paska wyszukiwania i ustawia --dam-sticky-search-h
 * (filtry widoku / toolbar projektów: top = search + gap).
 */
(function () {
  "use strict";

  var TOOLBAR_SEL =
    ".geex-content > .dam-global-search-block > .dam-explorer-toolbar, " +
    ".geex-content__section-wrapper > .dam-global-search-block > .dam-explorer-toolbar, " +
    ".dam-explorer-shell > .dam-global-search-block > .dam-explorer-toolbar";

  function measure() {
    var toolbar = document.querySelector(TOOLBAR_SEL);
    if (!toolbar) return;
    var h = Math.ceil(toolbar.getBoundingClientRect().height);
    if (h > 0) {
      document.documentElement.style.setProperty("--dam-sticky-search-h", h + "px");
    }
  }

  function init() {
    var toolbar = document.querySelector(TOOLBAR_SEL);
    if (!toolbar) return;

    measure();
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(measure).observe(toolbar);
    }
    window.addEventListener("resize", measure, { passive: true });
    setTimeout(measure, 120);
    setTimeout(measure, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.DamStickyChrome = { refresh: measure };
})();
