/**
 * Status ROOT plików (nie API metadanych).
 * Online = da sie odczytać folder usera z -- ARCHIWUM -- / - EKSPORT / - POLSKA.
 * Offline = czerwona kropka + przycisk "Wskaż ścieżkę" + delikatny pasek u góry okna.
 */
(function () {
  "use strict";

  var POLL_MS = 12000;
  var POLL_OFFLINE_MS = 4000;
  var _timer = null;
  var _lastOnline = null;
  var _refreshBusy = false;

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

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    var tok =
      (window.DamApi && typeof window.DamApi.token === "function" && window.DamApi.token()) ||
      localStorage.getItem("dam_token") ||
      "";
    if (tok) h.Authorization = "Bearer " + tok;
    return h;
  }

  function ensureBridgeSession() {
    if (window.DamApi && typeof window.DamApi.ensureSession === "function") {
      return window.DamApi.ensureSession().catch(function () {
        return { ok: false, error: "login_required" };
      });
    }
    return Promise.resolve({ ok: true });
  }

  function waitForIndexRebuild(timeoutMs) {
    var started = Date.now();
    var limit = timeoutMs || 120000;
    function poll() {
      return fetch(bridgeBase() + "/index/status", { cache: "no-store", headers: authHeaders() })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          var running = d && d.rebuild && d.rebuild.running;
          if (!running) return d;
          if (Date.now() - started > limit) return d;
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(poll());
            }, 600);
          });
        })
        .catch(function () {
          return {};
        });
    }
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(poll());
      }, 400);
    });
  }

  function reloadIndexesGlobally() {
    var reloader =
      window.DamSearch && typeof window.DamSearch.reload === "function"
        ? window.DamSearch.reload()
        : (window.DamFileIndex && typeof window.DamFileIndex.refresh === "function"
            ? window.DamFileIndex.refresh()
            : fetch("data/file-index.json?v=" + Date.now(), { cache: "no-store" }).then(function (r) {
                if (!r.ok) throw new Error("file-index");
                return r.json();
              })
          )
            .then(function (d) {
              window._DAM_FILE_INDEX = d;
              return d;
            });
    return reloader.then(function (data) {
      window.dispatchEvent(
        new CustomEvent("dam:index-refreshed", { detail: { fileIndex: data } })
      );
      return { ok: true, data: data };
    });
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
      '<button type="button" class="dam-root-status__refresh" id="damRootRefreshBtn" title="Przeskanuj Marketing i odśwież indeks plików" data-dam-tip="Skan dysku Marketing → file-index → miniatury. Jak „Odśwież z dysku” w eksploratorze." aria-label="Odśwież pliki z dysku">' +
        '<i class="uil uil-redo" aria-hidden="true"></i>' +
      "</button>" +
      '<button type="button" class="dam-root-status__btn" id="damRootResetBtn" hidden title="Wskaż folder Marketing">' +
        '<i class="uil uil-folder-open" aria-hidden="true"></i>' +
        '<span>Wskaż folder</span>' +
      "</button>";
    host.insertBefore(el, host.firstChild);
    var refreshBtn = el.querySelector("#damRootRefreshBtn");
    if (refreshBtn && !refreshBtn.getAttribute("data-bound")) {
      refreshBtn.setAttribute("data-bound", "1");
      refreshBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        triggerRootReindex();
      });
    }
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
    var refreshBtn = el.querySelector("#damRootRefreshBtn");
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
    if (refreshBtn) refreshBtn.hidden = !online;
    if (btn) {
      btn.hidden = !!online;
      btn.setAttribute("data-reason", reason || "");
      if (reason === "bridge") {
        btn.innerHTML = '<i class="uil uil-question-circle" aria-hidden="true"></i><span>Jak uruchomić</span>';
      } else {
        btn.innerHTML = '<i class="uil uil-folder-open" aria-hidden="true"></i><span>Wskaż folder</span>';
      }
    }
    setBodyOffline(!online);
    if (_lastOnline !== online) {
      _lastOnline = online;
      schedulePoll(online);
    }
  }

  function triggerRootReindex() {
    if (_refreshBusy) return Promise.resolve({ ok: false, busy: true });
    _refreshBusy = true;
    var refreshBtn = document.getElementById("damRootRefreshBtn");
    if (refreshBtn) refreshBtn.classList.add("is-busy");
    if (window.DamLoader && typeof window.DamLoader.start === "function") {
      window.DamLoader.start("Skanuję Marketing…");
    }

    var chain;
    if (window.DamExplorer && typeof window.DamExplorer.reload === "function") {
      chain = window.DamExplorer.reload({ silent: false });
    } else {
      chain = ensureBridgeSession()
        .then(function (sess) {
          if (!sess || !sess.ok) return { ok: false, skippedRebuild: true };
          return fetch(bridgeBase() + "/index/rebuild", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({}),
          })
            .then(function (r) {
              return r.json().catch(function () {
                return { ok: false };
              });
            })
            .then(function () {
              return waitForIndexRebuild(120000);
            });
        })
        .then(function () {
          return reloadIndexesGlobally();
        });
    }

    return chain
      .then(function (res) {
        check();
        return res;
      })
      .catch(function (err) {
        return { ok: false, error: err && err.message ? err.message : String(err) };
      })
      .finally(function () {
        _refreshBusy = false;
        if (refreshBtn) refreshBtn.classList.remove("is-busy");
        if (window.DamLoader && typeof window.DamLoader.done === "function") {
          window.DamLoader.done();
        }
      });
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
        if (window.DamRuntime && typeof window.DamRuntime.ensureServices === "function") {
          return window.DamRuntime.ensureServices().then(function (boot) {
            if (boot && boot.ok) return check();
            setState(
              false,
              "Most plików (bridge) nie odpowiada. Uruchom skrót DAM ETA na pulpicie.",
              "bridge"
            );
            return { online: false, reason: "bridge" };
          });
        }
        setState(
          false,
          "Most plików (bridge) nie odpowiada na porcie 8766. Uruchom DAM albo serve_browser.py.",
          "bridge"
        );
        return { online: false, reason: "bridge" };
      });
  }

  function hideSettingsUpdateColumn() {
    if (typeof document === "undefined") return;
    if (document.getElementById("damHideAppUpdatesCss")) return;
    var st = document.createElement("style");
    st.id = "damHideAppUpdatesCss";
    st.textContent =
      "#damAppUpdates,.dam-settings-grid > .dam-sw--app{display:none!important;}";
    document.head.appendChild(st);
    var el = document.getElementById("damAppUpdates");
    if (el) el.setAttribute("hidden", "hidden");
  }

  function loadCacheSync() {
    if (window.DamCacheSync) {
      if (typeof window.DamCacheSync.start === "function") window.DamCacheSync.start();
      return;
    }
    if (document.querySelector("script[data-dam-cache-sync]")) return;
    var s = document.createElement("script");
    s.src = "assets/js/dam-cache-sync.js?v=6.0.13";
    s.setAttribute("data-dam-cache-sync", "1");
    document.head.appendChild(s);
  }

  function start() {
    hideSettingsUpdateColumn();
    loadCacheSync();
    if (window.location.pathname.indexOf("signin") !== -1) return;
    ensureUi();
    function go() {
      check();
      schedulePoll(false);
    }
    if (window.DamRuntime && window.DamRuntime.ready) {
      go();
    } else {
      window.addEventListener("dam-runtime-ready", go, { once: true });
    }
    window.addEventListener("storage", function (e) {
      if (e.key === "dam_base_path") check();
    });
    window.addEventListener("dam-runtime-ready", function () {
      check();
    });
    window.addEventListener("dam:bridge-ready", function () {
      check();
    });
    window.addEventListener("dam:index-refreshed", function () {
      check();
    });
  }

  window.DamRootStatus = {
    check: check,
    start: start,
    setState: setState,
    refresh: triggerRootReindex,
    isRefreshing: function () {
      return _refreshBusy;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
