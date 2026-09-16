/**
 * DAM — lokalny build vs GitHub. Banner tylko po zalogowaniu,
 * tylko gdy most potwierdzi prawdziwie nowsza wersje z DAM-Setup.exe.
 */
(function (global) {
  "use strict";

  var RELOAD_KEY = "dam_version_reload_ts";
  var DISMISS_KEY = "dam_update_banner_dismissed";

  var CANONICAL_VER = /^\d\.\d\.\d$/;

  function isCanonicalVer(v) {
    return CANONICAL_VER.test(String(v || "").replace(/^v/i, "").trim());
  }

  function versionInt(v) {
    var s = String(v || "").replace(/^v/i, "").trim();
    if (!isCanonicalVer(s)) return -1;
    return parseInt(s.replace(/\./g, ""), 10) || 0;
  }

  function cmpVer(a, b) {
    var ai = versionInt(a);
    var bi = versionInt(b);
    if (ai >= 0 && bi >= 0) {
      if (ai > bi) return 1;
      if (ai < bi) return -1;
      return 0;
    }
    if (ai < 0 && bi >= 0) return -1;
    if (bi < 0 && ai >= 0) return 1;
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
    if (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function") {
      return String(global.DamPaths.bridgeUrl()).replace(/\/$/, "");
    }
    if (global.DamBridgeUrl && typeof global.DamBridgeUrl.resolve === "function") {
      return global.DamBridgeUrl.resolve();
    }
    return "http://127.0.0.1:8766";
  }

  function releasesPageUrl() {
    return "https://github.com/inyfinn/DAM---Dobra-Kaloria---inyfinn/releases";
  }

  function authHeaders() {
    var headers = { "Content-Type": "application/json", Accept: "application/json" };
    try {
      if (global.DamApi && typeof global.DamApi.authHeaders === "function") {
        var ah = global.DamApi.authHeaders();
        if (ah && ah.Authorization) headers.Authorization = ah.Authorization;
      } else {
        var t = localStorage.getItem("dam_token") || "";
        if (t) headers.Authorization = "Bearer " + t;
      }
    } catch (_e) {
      /* ignore */
    }
    return headers;
  }

  function ensureBanner() {
    var el = document.getElementById("damAppUpdateBanner");
    if (el) return el;
    el = document.createElement("div");
    el.id = "damAppUpdateBanner";
    el.className = "dam-app-update-banner";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    var main = document.querySelector(".geex-main-content") || document.body;
    if (main.firstChild) {
      main.insertBefore(el, main.firstChild);
    } else {
      main.appendChild(el);
    }
    return el;
  }

  function hideBanner() {
    var el = document.getElementById("damAppUpdateBanner");
    if (el) {
      el.hidden = true;
      el.innerHTML = "";
    }
    document.body.classList.remove("dam-update-banner-open");
  }

  function showBanner(html, opts) {
    var el = ensureBanner();
    el.innerHTML = html;
    el.hidden = false;
    if (!opts || !opts.autoHideMs) {
      document.body.classList.add("dam-update-banner-open");
    }
    if (opts && opts.autoHideMs) {
      setTimeout(function () {
        el.hidden = true;
        document.body.classList.remove("dam-update-banner-open");
      }, opts.autoHideMs);
    }
  }

  function applyUpdateFlow(data) {
    var payload = {
      action: data && data.installer_ready ? "install" : "download",
      download_url: data && data.download_url ? data.download_url : "",
    };
    showBanner("<span>" + tr("update.applying", "Pobieranie aktualizacji…") + "</span>");
    return fetch(bridgeUrl() + "/app-update/apply", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        if (res && res.launched) {
          showBanner("<span>" + tr("update.installer_started", "Instalator uruchomiony.") + "</span>", {
            autoHideMs: 6000,
          });
          return res;
        }
        if (res && res.status === "downloading") {
          showBanner("<span>" + tr("update.downloading", "Pobieranie w toku…") + "</span>");
          return res;
        }
        showBanner("<span>" + tr("update.check_failed", "Nie udało się sprawdzić aktualizacji") + "</span>", {
          autoHideMs: 7000,
        });
        return res;
      })
      .catch(function () {
        showBanner("<span>" + tr("update.check_failed", "Nie udało się sprawdzić aktualizacji") + "</span>", {
          autoHideMs: 7000,
        });
        return null;
      });
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
      "Dostępna jest nowsza wersja ({latest}).",
      { latest: lat }
    );
    var dismiss = tr("update.dismiss", "Ukryj na dziś");
    var html =
      "<span class=\"dam-app-update-banner__msg\">" + msg + "</span>" +
      "<div class=\"dam-app-update-banner__actions\">" +
      "<button type=\"button\" id=\"damAppUpdateApply\" class=\"geex-btn geex-btn--sm dam-app-update-banner__btn\">" +
      tr("update.apply_now", "Aktualizuj") + "</button>" +
      "<button type=\"button\" id=\"damAppUpdateManual\" class=\"geex-btn geex-btn--sm dam-app-update-banner__btn dam-app-update-banner__btn--ghost\">" +
      tr("update.download_manual", "Pobierz ręcznie") + "</button>" +
      "<button type=\"button\" id=\"damAppUpdateDismiss\" class=\"geex-btn geex-btn--sm dam-app-update-banner__btn dam-app-update-banner__btn--ghost\">" +
      dismiss + "</button></div>";
    showBanner(html);
    var btn = document.getElementById("damAppUpdateDismiss");
    if (btn) btn.addEventListener("click", dismissToday);
    var applyBtn = document.getElementById("damAppUpdateApply");
    if (applyBtn) {
      applyBtn.addEventListener("click", function () {
        applyUpdateFlow(data);
      });
    }
    var manualBtn = document.getElementById("damAppUpdateManual");
    if (manualBtn) {
      manualBtn.addEventListener("click", function () {
        try {
          window.open(releasesPageUrl(), "_blank", "noopener,noreferrer");
        } catch (_open) {
          location.href = releasesPageUrl();
        }
      });
    }
    return data;
  }

  function showCheckResult(data) {
    var cur = String((data && data.current) || global.DAM_APP_VERSION || "");
    var lat = String((data && data.latest) || cur);
    var msg;
    if (!data || data.ok === false) {
      msg = tr("update.check_failed", "Nie udało się sprawdzić aktualizacji");
    } else if (isRealUpdate(data) || (lat && cmpVer(lat, cur) > 0)) {
      msg = tr("update.available", "Dostępna jest nowsza wersja ({latest}).", {
        latest: lat,
      });
    } else {
      msg = tr("update.already_latest", "Masz najnowszą wersję ({current}).", {
        current: cur || "?",
      });
    }
    showBanner("<span>" + msg + "</span>", { autoHideMs: 7000 });
    return data;
  }

  function checkFromMenu() {
    showBanner("<span>" + tr("update.checking", "Sprawdzanie aktualizacji…") + "</span>");
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
