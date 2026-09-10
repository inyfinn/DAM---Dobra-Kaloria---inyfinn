/**
 * DAM boot helpers — pierwszy skrypt w <head>.
 *
 * F5 / Ctrl+R / toolbar refresh / URL Enter:
 * - NIE preventDefault (doktryna: natywny reload WebView2/Chrome musi dzialac)
 * - NIE window.stop — przerywa dokument w polowie i zostawia bialy ekran
 * - NIE location.replace cache-bust na keydown — sciga sie z natywnym F5
 *
 * Ten plik: rejestr abort (Escape), failsafe html.dam-booting.
 * __damHardReload zostaje dla jawnego UI (pomoc) i robi samo location.reload().
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
      window.location.reload();
    } catch (eRel) {
      window.__damHardReloadInProgress = false;
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

  window.addEventListener("keydown", softInterrupt, true);

  function unlockBootFailsafe(tag) {
    try {
      var root = document.documentElement;
      var body = document.body;
      if (!root) return;
      var wasBooting =
        root.classList.contains("dam-booting") ||
        (body && body.classList.contains("is-booting"));
      if (!wasBooting && body && body.style.pointerEvents !== "none") return;
      root.classList.remove("dam-booting");
      root.classList.add("dam-booted");
      if (body) {
        body.classList.remove("is-booting");
        body.style.setProperty("opacity", "1", "important");
        body.style.setProperty("pointer-events", "auto", "important");
      }
      if (wasBooting) {
        console.warn("DAM: boot failsafe (" + (tag || "timeout") + ") — wymuszono reveal + pointer-events");
      }
    } catch (eBootFs) {
      /* ignore */
    }
  }

  /* Failsafe: odblokuj boot zanim parse slim zablokuje event loop (0–50 ms). */
  setTimeout(function () { unlockBootFailsafe("0ms"); }, 0);
  setTimeout(function () { unlockBootFailsafe("50ms"); }, 50);
  setTimeout(function () { unlockBootFailsafe("4s"); }, 4000);
  window.addEventListener("pageshow", function () {
    unlockBootFailsafe("pageshow");
  });
})();
