/**
 * Status ROOT plików (nie API metadanych).
 * Online = da sie odczytać folder usera z -- ARCHIWUM -- / - EKSPORT / - POLSKA.
 * Offline = czerwona kropka + przycisk "Wskaż ścieżkę" + delikatny pasek u gory okna.
 */
(function () {
  "use strict";

  var POLL_MS = 12000;
  var POLL_OFFLINE_MS = 4000;
  var _timer = null;
  var _lastOnline = null;

  function bridgeBase() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    if (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function") {
      return window.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function rootPath() {
    if (window.DamPaths && typeof window.DamPaths.getBasePath === "function") {
      return window.DamPaths.getBasePath() || "";
    }
    return localStorage.getItem("dam_base_path") || "";
  }

  function ensureOfflineBar() {
    var bar = document.getElementById("damOfflineBar");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "damOfflineBar";
    bar.className = "dam-offline-bar";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    return bar;
  }

  function setBodyOffline(offline) {
    document.body.classList.toggle("dam-bridge-offline", !!offline);
    var bar = ensureOfflineBar();
    bar.classList.toggle("is-active", !!offline);
  }

  function schedulePoll(online) {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(check, online ? POLL_MS : POLL_OFFLINE_MS);
  }

  function ensureUi() {
    var host = document.querySelector(".geex-content__header__action");
    if (!host) return null;
    var el = document.getElementById("damRootStatus");
    if (el) return el;
    el = document.createElement("div");
    el.id = "damRootStatus";
    el.className = "dam-root-status";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<span class="dam-root-status__dot" aria-hidden="true"></span>' +
      '<span class="dam-root-status__text">' +
        '<span class="dam-root-status__label">' +
          '<span class="dam-status-line">Pliki</span>' +
          '<span class="dam-status-line">online</span>' +
        "</span>" +
      "</span>" +
      '<button type="button" class="dam-root-status__btn" id="damRootResetBtn" hidden>Wskaż ścieżkę</button>';
    host.insertBefore(el, host.firstChild);
    var btn = el.querySelector("#damRootResetBtn");
    if (btn && !btn.getAttribute("data-bound")) {
      btn.setAttribute("data-bound", "1");
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var why = btn.getAttribute("data-reason") || "";
        if (why === "bridge") {
          if (window.DamShortcuts && typeof window.DamShortcuts.openHelp === "function") {
            window.DamShortcuts.openHelp();
          } else {
            window.location.href = "help.html";
          }
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.openSetupModal === "function") {
          window.DamPaths.openSetupModal();
        } else {
          window.location.href = "settings.html";
        }
      });
    }
    return el;
  }

  function setState(online, detail, reason) {
    var el = ensureUi();
    if (!el) return;
    el.classList.toggle("is-offline", !online);
    el.classList.toggle("is-online", !!online);
    el.title = detail || (online ? "ROOT plików online" : "ROOT plików offline");
    var label = el.querySelector(".dam-root-status__label");
    var btn = el.querySelector("#damRootResetBtn");
    if (label) {
      var line1 = "Pliki";
      var line2 = online ? "online" : "offline";
      if (!online && reason === "bridge") {
        line1 = "Most";
        line2 = "offline";
      } else if (!online && reason === "no_root") {
        line1 = "Brak";
        line2 = "ścieżki";
      }
      label.innerHTML =
        '<span class="dam-status-line">' +
        line1 +
        '</span><span class="dam-status-line">' +
        line2 +
        "</span>";
    }
    if (btn) {
      btn.hidden = !!online;
      btn.setAttribute("data-reason", reason || "");
      btn.textContent = reason === "bridge" ? "Jak uruchomić" : "Wskaż ścieżkę";
    }
    setBodyOffline(!online);
    if (_lastOnline !== online) {
      _lastOnline = online;
      schedulePoll(online);
    }
  }

  function check() {
    var root = rootPath();
    if (!root) {
      setState(false, "Brak ROOT - ustaw ścieżkę Marketing", "no_root");
      return Promise.resolve({ online: false, reason: "no_root" });
    }
    var url = bridgeBase() + "/files/status?root=" + encodeURIComponent(root);
    return fetch(url, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        var online = !!(res && res.online);
        var detail = online
          ? ("ROOT OK: " + (res.root || root))
          : ("Offline: " + (res && res.missing && res.missing.length
            ? ("brak " + res.missing.join(", "))
            : "nie można odczytać plików"));
        setState(online, detail, online ? "ok" : "path");
        return res;
      })
      .catch(function () {
        setState(
          false,
          "Most plików (bridge) nie odpowiada na porcie 8766. Uruchom DAM ETA albo serve_browser.py.",
          "bridge"
        );
        return { online: false, reason: "bridge" };
      });
  }

  function start() {
    if (window.location.pathname.indexOf("signin") !== -1) return;
    ensureUi();
    check();
    schedulePoll(false);
    window.addEventListener("storage", function (e) {
      if (e.key === "dam_base_path") check();
    });
    window.addEventListener("dam-runtime-ready", function () {
      check();
    });
  }

  window.DamRootStatus = {
    check: check,
    start: start,
    setState: setState
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
