/**
 * DAM boot helpers — pierwszy skrypt w <head>.
 *
 * F5 / Ctrl+R / toolbar refresh / URL Enter:
 * - NIE preventDefault (doktryna: natywny reload WebView2/Chrome musi dzialac)
 * - NIE window.stop — przerywa dokument w polowie i zostawia bialy ekran
 * - NIE location.replace cache-bust na keydown — sciga sie z natywnym F5
 *
 * Ten plik: rejestr abort (Escape), fail-SAFE boot (nie fail-open).
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

  function isSigninPage() {
    try {
      return (location.pathname || "").indexOf("signin") !== -1;
    } catch (eP) {
      return false;
    }
  }

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

  function unlockBootSuccess() {
    try {
      var root = document.documentElement;
      var body = document.body;
      if (!root) return;
      root.classList.remove("dam-booting");
      root.classList.remove("dam-boot-failed");
      root.classList.add("dam-booted");
      if (body) {
        body.classList.remove("is-booting");
        body.style.setProperty("opacity", "1", "important");
        body.style.setProperty("pointer-events", "auto", "important");
      }
      var fail = document.getElementById("damBootFail");
      if (fail && fail.parentNode) fail.parentNode.removeChild(fail);
    } catch (eBootFs) {
      /* ignore */
    }
  }

  function showBootFail(reason) {
    if (window.__damBootSucceeded) return;
    if (isSigninPage()) {
      unlockBootSuccess();
      return;
    }
    try {
      var root = document.documentElement;
      var body = document.body || document.documentElement;
      root.classList.remove("dam-booting");
      root.classList.add("dam-boot-failed");
      if (document.body) {
        document.body.classList.remove("is-booting");
        document.body.style.setProperty("opacity", "1", "important");
        document.body.style.setProperty("pointer-events", "auto", "important");
      }
      var existing = document.getElementById("damBootFail");
      if (existing) {
        existing.hidden = false;
        return;
      }
      var wrap = document.createElement("div");
      wrap.id = "damBootFail";
      wrap.className = "dam-boot-fail";
      wrap.setAttribute("role", "alertdialog");
      wrap.setAttribute("aria-labelledby", "damBootFailTitle");
      wrap.setAttribute("aria-describedby", "damBootFailText");
      wrap.innerHTML =
        '<div class="dam-boot-fail__card">' +
        '<p class="dam-boot-fail__brand">DAM Dobra Kaloria</p>' +
        '<h1 id="damBootFailTitle" class="dam-boot-fail__title">Nie udało się uruchomić aplikacji</h1>' +
        '<p id="damBootFailText" class="dam-boot-fail__text">Program nie połączył się z danymi. Spróbuj ponownie, a&nbsp;jeśli to nie pomoże, zamknij i&nbsp;uruchom aplikację jeszcze raz.</p>' +
        '<button type="button" class="dam-boot-fail__btn" id="damBootFailRetry">Spróbuj ponownie</button>' +
        "</div>";
      body.appendChild(wrap);
      var btn = document.getElementById("damBootFailRetry");
      if (btn) {
        btn.addEventListener("click", function () {
          hardReload();
        });
      }
    } catch (eFail) {
      /* ignore */
    }
  }

  window.__damMarkBootOk = function () {
    if (window.__damForceBootFail) {
      showBootFail("forced");
      return;
    }
    window.__damBootSucceeded = true;
    unlockBootSuccess();
  };

  window.__damShowBootFail = showBootFail;

  window.__damBootWatchdog = function (tag) {
    if (window.__damBootSucceeded) return;
    if (isSigninPage()) {
      unlockBootSuccess();
      return;
    }
    showBootFail(tag || "watchdog");
  };

  window.__damForceBootFail =
    (function () {
      try {
        return /(?:\?|&)dam_boot_fail=1(?:&|$)/.test(location.search || "");
      } catch (eF) {
        return false;
      }
    })();

  if (window.__damForceBootFail) {
    showBootFail("forced");
    setTimeout(function () {
      showBootFail("forced");
    }, 80);
  }

  /* Fail-safe: po 4.5 s bez sukcesu pokaż ekran DAM, nie odsłaniaj surowego motywu. */
  setTimeout(function () {
    window.__damBootWatchdog("4.5s");
  }, 4500);
})();
