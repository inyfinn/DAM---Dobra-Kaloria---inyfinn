/**
 * DAM — lokalny build vs GitHub. Banner tylko po zalogowaniu,
 * tylko gdy most potwierdzi prawdziwie nowsza wersje z DAM-Setup.exe.
 */
(function (global) {
  "use strict";

  var RELOAD_KEY = "dam_version_reload_ts";
  var DISMISS_KEY = "dam_update_banner_dismissed";

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

  function tr(key, fallback, vars) {
    var s = fallback;
    if (global.DamI18n && typeof global.DamI18n.t === "function") {
      var v = global.DamI18n.t(key);
      if (v && v !== key) s = v;
    }
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = String(s).split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  function isSigninPage() {
    var path = String((location && location.pathname) || "");
    return /signin/i.test(path);
  }

  function isLoggedIn() {
    try {
      var token = localStorage.getItem("dam_token") || "";
      if (!token || token === "demo-admin-dev-token" || token === "qa") return false;
      return true;
    } catch (_e) {
      return false;
    }
  }

  function todayStamp() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = "0" + m;
    if (day.length < 2) day = "0" + day;
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function dismissedToday() {
    try {
      return localStorage.getItem(DISMISS_KEY) === todayStamp();
    } catch (_e) {
      return false;
    }
  }

  function dismissToday() {
    try {
      localStorage.setItem(DISMISS_KEY, todayStamp());
    } catch (_e) { /* ignore */ }
    hideBanner();
  }

  function isSetupUrl(url) {
    var u = String(url || "").toLowerCase();
    return u.indexOf("https://") === 0 && u.indexOf("github.com") !== -1 && u.indexOf("dam-setup.exe") !== -1;
  }

  function isRealUpdate(data) {
    if (!data || data.ok === false || data.update_available !== true) return false;
    var cur = String(data.current || global.DAM_APP_VERSION || "");
    var lat = String(data.latest || "");
    if (!lat || !cur || cmpVer(lat, cur) <= 0) return false;
    if (data.error) return false;
    return isSetupUrl(data.download_url);
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
      "background:var(--dam-primary);color:var(--dam-surface);" +
      "box-shadow:0 2px 12px rgba(0,0,0,.2);display:flex;gap:12px;" +
      "align-items:center;justify-content:center;flex-wrap:wrap;";
    document.body.appendChild(el);
    return el;
  }

  function hideBanner() {
    var el = document.getElementById("damAppUpdateBanner");
    if (el) {
      el.hidden = true;
      el.innerHTML = "";
    }
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
    showBanner("Nowa wersja DAM (" + reason + "). Odświeżam…", { autoHideMs: 2500 });
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

  function renderUpdateBanner(data) {
    if (isSigninPage() || !isLoggedIn() || dismissedToday() || !isRealUpdate(data)) {
      hideBanner();
      return data;
    }
    var cur = String(data.current || global.DAM_APP_VERSION || "?");
    var lat = String(data.latest || cur);
    var msg = tr(
      "update.banner",
      "Dostępna wersja {latest} (masz {current}).",
      { latest: lat, current: cur }
    );
    var dismiss = tr("update.dismiss", "Ukryj na dziś");
    var html =
      "<span>" + msg + "</span>" +
      "<button type=\"button\" id=\"damAppUpdateOpenCheck\" class=\"geex-btn geex-btn--sm\" " +
      "style=\"background:var(--dam-surface);color:var(--dam-primary);border:0;min-height:44px;padding:8px 14px;\">" +
      tr("update.check_now", "Sprawdź aktualizację") + "</button>" +
      "<button type=\"button\" id=\"damAppUpdateDismiss\" class=\"geex-btn geex-btn--sm\" " +
      "style=\"background:var(--dam-surface);color:var(--dam-primary);border:0;min-height:44px;padding:8px 14px;\">" +
      dismiss + "</button>";
    showBanner(html);
    var btn = document.getElementById("damAppUpdateDismiss");
    if (btn) btn.addEventListener("click", dismissToday);
    var openBtn = document.getElementById("damAppUpdateOpenCheck");
    if (openBtn) {
      openBtn.addEventListener("click", function () {
        checkFromMenu();
      });
    }
    return data;
  }

  function showCheckResult(data) {
    var cur = String((data && data.current) || global.DAM_APP_VERSION || "?");
    var lat = String((data && data.latest) || "-");
    var src = String((data && data.latest_source) || "");
    var gitLat = String((data && data.git_latest) || "");
    var msg;
    if (!data || data.ok === false) {
      msg = tr("update.check_failed", "Nie udało się sprawdzić aktualizacji");
    } else if (isRealUpdate(data)) {
      msg = tr("update.available", "Dostępna wersja {latest} (masz {current}).", {
        latest: lat,
        current: cur,
      });
    } else if (src === "git" && gitLat && cmpVer(gitLat, cur) > 0) {
      msg =
        "Na origin/main jest " +
        gitLat +
        " (masz " +
        cur +
        "). Zamknij DAM, zrób git pull i uruchom DAM.exe.";
    } else if (src === "installed" || cmpVer(lat, cur) <= 0) {
      msg = tr("update.already_latest", "Masz najnowszą wersję.") + " Zainstalowana: " + cur;
      if (data && data.github_latest && String(data.github_latest) !== cur) {
        msg += " GitHub Releases: " + data.github_latest + ".";
      }
    } else {
      msg = tr("update.already_latest", "Masz najnowszą wersję.") + " " + cur + " / " + lat;
    }
    showBanner("<span>" + msg + "</span>", { autoHideMs: 7000 });
    return data;
  }

  function checkFromMenu() {
    showBanner("<span>Sprawdzanie aktualizacji…</span>");
    return checkRemote(true).then(function (data) {
      return showCheckResult(data);
    });
  }

  function checkRemote(force) {
    if (isSigninPage()) {
      hideBanner();
      return Promise.resolve(null);
    }
    if (!isLoggedIn()) {
      hideBanner();
      return Promise.resolve(null);
    }
    var q = force ? "?force=1" : "";
    return fetch(bridgeUrl() + "/app-update/check" + q, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var cur = String((data && data.current) || global.DAM_APP_VERSION || "?");
        setVersionPill("DAM v" + cur);
        if (force) return showCheckResult(data);
        return renderUpdateBanner(data);
      })
      .catch(function () {
        hideBanner();
        return null;
      });
  }

  function boot() {
    if (isSigninPage()) return;
    syncLocalBuild().then(function () {
      checkRemote(false);
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
    checkFromMenu: checkFromMenu,
    showCheckResult: showCheckResult,
    cmpVer: cmpVer,
    isRealUpdate: isRealUpdate,
    hideBanner: hideBanner,
  };
})(typeof window !== "undefined" ? window : globalThis);
