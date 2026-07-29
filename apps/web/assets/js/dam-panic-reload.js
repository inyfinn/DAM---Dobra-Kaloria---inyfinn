/**
 * DAM HARD RESET — pierwszy skrypt w <head>.
 *
 * F5 / Ctrl+R:
 * - NIE wywoluje dam:panic-reset (re-entry freeze)
 * - NIE preventDefault — natywny reload WebView2/Chrome musi dzialac gdy JS zamrozone
 * - JS path: abort fetch + window.stop + navigate / restart_window
 *
 * Desktop: pelny restart okna robi tez Python watchdog (launch.py) — poza watkiem JS.
 */
(function () {
  "use strict";

  if (window.__damPanicReloadInstalled) return;
  window.__damPanicReloadInstalled = true;

  var _abortControllers = [];
  window.__damRegisterAbort = function (ctrl) {
    if (!ctrl || typeof ctrl.abort !== "function") return;
    _abortControllers.push(ctrl);
    if (_abortControllers.length > 64) _abortControllers.splice(0, 32);
  };

  function abortAll() {
    for (var i = 0; i < _abortControllers.length; i++) {
      try {
        if (!_abortControllers[i].signal || !_abortControllers[i].signal.aborted) {
          _abortControllers[i].abort();
        }
      } catch (eAb) {
        /* ignore */
      }
    }
    _abortControllers.length = 0;
  }
  window.__damAbortAll = abortAll;

  function hardReload() {
    if (window.__damHardReloadInProgress) return;
    window.__damHardReloadInProgress = true;

    try {
      abortAll();
    } catch (e0) {
      /* ignore */
    }

    try {
      window.stop();
    } catch (e1) {
      /* ignore */
    }

    try {
      if (
        window.pywebview &&
        window.pywebview.api &&
        typeof window.pywebview.api.restart_window === "function"
      ) {
        window.pywebview.api.restart_window();
        return;
      }
    } catch (eDesk) {
      /* ignore */
    }

    try {
      var url = window.location.pathname + window.location.search;
      var sep = url.indexOf("?") >= 0 ? "&" : "?";
      window.location.replace(url + sep + "_damr=" + Date.now() + (window.location.hash || ""));
      return;
    } catch (eNav) {
      /* ignore */
    }

    try {
      window.location.href =
        window.location.pathname + window.location.search + (window.location.hash || "");
    } catch (eHref) {
      try {
        window.location.reload();
      } catch (eRel) {
        /* native F5 fallback — only works if preventDefault was NOT called */
      }
    }
  }

  window.__damHardReload = hardReload;

  function softInterrupt(e) {
    if (!e) return;
    var key = e.key || e.code || "";
    if (key !== "Escape" && key !== "Esc") return;
    try {
      abortAll();
    } catch (eAb) {
      /* ignore */
    }
    try {
      var ids = [
        "damAssocEditOverlay",
        "damAssocEditPopover",
        "damTagEditPopover",
        "damThumbPicker",
        "damAssocFolderPicker",
      ];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
    } catch (eDom) {
      /* ignore */
    }
  }

  function onHardResetKey(e) {
    if (!e) return;
    var key = e.key || e.code || "";
    var isReloadKey = key === "F5";
    var isCtrlR =
      (e.ctrlKey || e.metaKey) && !e.shiftKey && (key === "r" || key === "R");
    if (!isReloadKey && !isCtrlR) return;

    hardReload();
    /* HARD: zero preventDefault — zaden kod aplikacji nie moze zablokowac natywnego F5. */
  }

  window.addEventListener("keydown", onHardResetKey, true);
  window.addEventListener("keydown", softInterrupt, true);

  /* Failsafe: html.dam-booting trzyma body opacity:0 — odblokuj po 6s gdy shell nie domknie boot. */
  setTimeout(function () {
    try {
      var root = document.documentElement;
      var body = document.body;
      if (!root || !root.classList.contains("dam-booting")) return;
      root.classList.remove("dam-booting");
      root.classList.add("dam-booted");
      if (body) {
        body.classList.remove("is-booting");
        body.style.setProperty("opacity", "1", "important");
        body.style.setProperty("pointer-events", "auto");
      }
      console.warn("DAM: boot failsafe — shell nie domknal dam-booting w 6s, wymuszono reveal");
    } catch (eBootFs) {
      /* ignore */
    }
  }, 6000);
})();
