/**
 * DAM — sprawdzanie wersji przy starcie (takze signin, bez logowania).
 * 1) Lokalny build: version.json vs DAM_APP_VERSION -> auto-reload.
 * 2) GitHub: /app-update/check -> banner (portable = restart DAM.exe, nie installer).
 */
(function (global) {
  "use strict";

  var RELOAD_KEY = "dam_version_reload_ts";

  function parseVer(v) {
    var p = String(v || "0").replace(/^v/i, "").split(/[.\-]/);
    var out = [];
    for (var i = 0; i < p.length; i++) {
      var n = parseInt(p[i], 10);
      out.push(isNaN(n) ? 0 : n);
    }
    return out;
  }

  function cmpVer(a, b) {
    var x = parseVer(a);
    var y = parseVer(b);
    var n = Math.max(x.length, y.length);
    for (var i = 0; i < n; i++) {
      var d = (x[i] || 0) - (y[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  function bridgeUrl() {
    if (global.DamRuntime && typeof global.DamRuntime.bridgeUrl === "function") {
      return String(global.DamRuntime.bridgeUrl()).replace(/\/$/, "");
    }
    return "http://127.0.0.1:8766";
  }

  function ensureBanner() {
    var el = document.getElementById("damAppUpdateBanner");
    if (el) return el;
    el = document.createElement("div");
    el.id = "damAppUpdateBanner";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    el.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:99999;padding:10px 16px;" +
      "font:600 14px/1.4 Jost,system-ui,sans-serif;text-align:center;" +
      "background:#2d1b4e;color:#fff;box-shadow:0 2px 12px rgba(0,0,0,.2);";
    document.body.appendChild(el);
    return el;
  }

  function showBanner(html, opts) {
    var el = ensureBanner();
    el.innerHTML = html;
    el.hidden = false;
    if (opts && opts.autoHideMs) {
      setTimeout(function () {
        el.hidden = true;
      }, opts.autoHideMs);
    }
  }

  function setVersionPill(text) {
    if (global.DamVersion && typeof global.DamVersion.setSidebarLabel === "function") {
      global.DamVersion.setSidebarLabel(text);
      return;
    }
    if (global.DamVersion && typeof global.DamVersion.hideFloatingPill === "function") {
      global.DamVersion.hideFloatingPill();
    }
    var legacy = document.getElementById("damAppVersionPill");
    if (legacy) {
      legacy.hidden = true;
      legacy.style.display = "none";
    }
  }

  function hardReload(reason) {
    var now = Date.now();
    try {
      var last = parseInt(sessionStorage.getItem(RELOAD_KEY) || "0", 10);
      if (last && now - last < 8000) return;
      sessionStorage.setItem(RELOAD_KEY, String(now));
    } catch (_e) { /* ignore */ }
    showBanner("Nowa wersja DAM (" + reason + "). Odswiezam...", { autoHideMs: 2500 });
    setTimeout(function () {
      try {
        var u = location.pathname + location.search;
        var h = location.hash || "";
        location.replace(u + (u.indexOf("?") >= 0 ? "&" : "?") + "_damv=" + now + h);
      } catch (e2) {
        location.reload();
      }
    }, 400);
  }

  function syncLocalBuild() {
    var embedded = String(global.DAM_APP_VERSION || "");
    if (!embedded) return Promise.resolve(null);
    return fetch("./version.json?_=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (vj) {
        var disk = vj && vj.version ? String(vj.version) : "";
        setVersionPill("DAM v" + (disk || embedded));
        if (disk && cmpVer(disk, embedded) > 0) {
          hardReload(disk);
          return { reload: true, disk: disk, embedded: embedded };
        }
        return { reload: false, disk: disk || embedded, embedded: embedded };
      })
      .catch(function () {
        setVersionPill("DAM v" + embedded);
        return null;
      });
  }

  function checkRemote() {
    return fetch(bridgeUrl() + "/app-update/check?force=1", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok) return data;
        var cur = String(data.current || global.DAM_APP_VERSION || "?");
        var lat = String(data.latest || cur);
        setVersionPill("DAM v" + cur);
        if (!data.update_available) return data;
        var portable = !!data.portable;
        var msg = portable
          ? "Dostepna wersja <b>" + lat + "</b> (masz " + cur + "). Zamknij DAM i uruchom ponownie <b>DAM.exe</b> z folderu projektu."
          : "Dostepna wersja <b>" + lat + "</b>. Zaktualizuj w Ustawieniach lub uruchom DAM.exe ponownie.";
        showBanner(msg);
        return data;
      })
      .catch(function () { return null; });
  }

  function boot() {
    syncLocalBuild().then(function () {
      checkRemote();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.DamAppUpdate = {
    syncLocalBuild: syncLocalBuild,
    checkRemote: checkRemote,
    cmpVer: cmpVer,
  };
})(typeof window !== "undefined" ? window : globalThis);
