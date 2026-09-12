/**
 * Dockable toast: cache download from NAS + index ETA / cancel / snooze.
 * Does not block login. Geex tokens only. No em-dash.
 */
(function (global) {
  "use strict";

  var STYLE_ID = "damCacheSyncCss";
  var HOST_ID = "damJobToast";
  var POLL_IDLE_MS = 8000;
  var POLL_HOT_MS = 2000;
  var MIN_TOUCH = 44;

  var _timer = null;
  var _minimized = false;
  var _startedDownload = false;
  var _lastSig = "";

  function bridgeBase() {
    if (global.DamRuntime && typeof global.DamRuntime.bridgeUrl === "function") {
      return global.DamRuntime.bridgeUrl();
    }
    if (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function") {
      return global.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    var tok =
      (global.DamApi && typeof global.DamApi.token === "function" && global.DamApi.token()) ||
      localStorage.getItem("dam_token") ||
      "";
    if (tok) h.Authorization = "Bearer " + tok;
    return h;
  }

  function ensureCss() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      "#" + HOST_ID + "{" +
        "position:fixed;right:20px;bottom:76px;z-index:11040;" +
        "width:min(360px,calc(100vw - 24px));" +
        "background:var(--white-color,#fff);" +
        "color:var(--body-color,#464255);" +
        "border:1px solid rgba(70,66,85,.12);" +
        "border-radius:14px;" +
        "box-shadow:0 16px 40px rgba(23,22,30,.14);" +
        "padding:14px 14px 12px;font-weight:600;font-size:13px;line-height:1.35;" +
        "box-sizing:border-box;" +
      "}" +
      "#" + HOST_ID + "[hidden]{display:none!important;}" +
      "#" + HOST_ID + ".is-min{width:auto;min-width:220px;padding:8px 10px;}" +
      "#" + HOST_ID + " .dam-job-toast__row{display:flex;align-items:flex-start;gap:10px;}" +
      "#" + HOST_ID + " .dam-job-toast__copy{flex:1;min-width:0;}" +
      "#" + HOST_ID + " .dam-job-toast__title{display:block;font-size:13px;color:#17161E;}" +
      "#" + HOST_ID + " .dam-job-toast__meta{display:block;margin-top:2px;font-size:12px;font-weight:500;color:#5c5668;}" +
      "#" + HOST_ID + " .dam-job-toast__bar{height:6px;margin:10px 0 8px;border-radius:99px;background:var(--gray-color,#eceaf3);overflow:hidden;}" +
      "#" + HOST_ID + " .dam-job-toast__fill{height:100%;width:0;border-radius:99px;background:var(--primary-color,#ab54db);transition:width .25s ease;}" +
      "#" + HOST_ID + " .dam-job-toast__actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}" +
      "#" + HOST_ID + " .dam-job-toast__btn," +
      "#" + HOST_ID + " .dam-job-toast__icon{" +
        "min-width:" + MIN_TOUCH + "px;min-height:" + MIN_TOUCH + "px;" +
        "border:0;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;" +
        "display:inline-flex;align-items:center;justify-content:center;padding:0 12px;" +
      "}" +
      "#" + HOST_ID + " .dam-job-toast__btn.is-ghost{background:var(--gray-color,#eceaf3);color:var(--body-color,#464255);}" +
      "#" + HOST_ID + " .dam-job-toast__btn.is-danger{background:color-mix(in srgb,var(--primary-color,#ab54db) 14%, #fff);color:#6b2d8a;}" +
      "#" + HOST_ID + " .dam-job-toast__icon{background:transparent;color:var(--body-color,#464255);padding:0;}" +
      "#" + HOST_ID + " .dam-job-toast__btn:hover," +
      "#" + HOST_ID + " .dam-job-toast__icon:hover{background:color-mix(in srgb,var(--primary-color,#ab54db) 12%, transparent);}" +
      "#" + HOST_ID + " .dam-job-toast__btn:focus-visible," +
      "#" + HOST_ID + " .dam-job-toast__icon:focus-visible{outline:2px solid var(--primary-color,#ab54db);outline-offset:2px;}" +
      "html[data-theme='dark'] #" + HOST_ID + "{background:#1f1d27;color:#eceaf3;border-color:rgba(255,255,255,.08);}" +
      "html[data-theme='dark'] #" + HOST_ID + " .dam-job-toast__title{color:#fff;}" +
      "html[data-theme='dark'] #" + HOST_ID + " .dam-job-toast__meta{color:#c9c4d4;}";
    document.head.appendChild(st);
  }

  function host() {
    var el = document.getElementById(HOST_ID);
    if (el) return el;
    el = document.createElement("aside");
    el.id = HOST_ID;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    el.innerHTML =
      '<div class="dam-job-toast__row">' +
        '<div class="dam-job-toast__copy">' +
          '<span class="dam-job-toast__title" id="damJobToastTitle"></span>' +
          '<span class="dam-job-toast__meta" id="damJobToastMeta"></span>' +
        "</div>" +
        '<button type="button" class="dam-job-toast__icon" id="damJobToastMin" aria-label="Zwin" title="Zwin">_</button>' +
      "</div>" +
      '<div class="dam-job-toast__bar" id="damJobToastBar" aria-hidden="true"><div class="dam-job-toast__fill" id="damJobToastFill"></div></div>' +
      '<div class="dam-job-toast__actions" id="damJobToastActions">' +
        '<button type="button" class="dam-job-toast__btn is-danger" id="damJobToastCancel">Przerwij</button>' +
        '<button type="button" class="dam-job-toast__btn is-ghost" id="damJobToastSnooze">Nie dzisiaj</button>' +
      "</div>";
    document.body.appendChild(el);
    _minimized = localStorage.getItem("dam_job_toast_min") === "1";
    el.classList.toggle("is-min", _minimized);
    var minBtn = el.querySelector("#damJobToastMin");
    if (minBtn) {
      minBtn.addEventListener("click", function () {
        _minimized = !_minimized;
        localStorage.setItem("dam_job_toast_min", _minimized ? "1" : "0");
        el.classList.toggle("is-min", _minimized);
        minBtn.setAttribute("aria-label", _minimized ? "Rozwin" : "Zwin");
        minBtn.textContent = _minimized ? "+" : "_";
      });
    }
    var cancelBtn = el.querySelector("#damJobToastCancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        fetch(bridgeBase() + "/index/cancel", {
          method: "POST",
          headers: authHeaders(),
          body: "{}",
        }).catch(function () {});
      });
    }
    var snoozeBtn = el.querySelector("#damJobToastSnooze");
    if (snoozeBtn) {
      snoozeBtn.addEventListener("click", function () {
        var until = snoozeBtn.getAttribute("data-until") || "eod";
        fetch(bridgeBase() + "/index/snooze", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ until: until }),
        }).catch(function () {});
      });
    }
    return el;
  }

  function fmtEta(sec) {
    if (sec == null || sec === "" || isNaN(Number(sec))) return "";
    var n = Math.max(0, Math.round(Number(sec)));
    if (n < 60) return "~" + n + " s";
    var min = Math.round(n / 60);
    return "~" + min + " min";
  }

  function applyView(sync, index) {
    var el = host();
    var title = el.querySelector("#damJobToastTitle");
    var meta = el.querySelector("#damJobToastMeta");
    var fill = el.querySelector("#damJobToastFill");
    var bar = el.querySelector("#damJobToastBar");
    var actions = el.querySelector("#damJobToastActions");
    var cancelBtn = el.querySelector("#damJobToastCancel");
    var snoozeBtn = el.querySelector("#damJobToastSnooze");

    var syncRun = !!(sync && sync.running);
    var done = Number((sync && sync.done) || 0);
    var total = Number((sync && sync.total) || 0);
    var progress = (index && index.progress) || {};
    var idxRun = !!(progress.running || (index && index.rebuild_running) || (index && index.rebuild && index.rebuild.running));
    var snoozed = !!(index && index.snoozed);
    var pendingHourly = !!(index && index.hourly_pending);
    var show = syncRun || idxRun || snoozed || pendingHourly;
    el.hidden = !show;
    if (!show) return;

    var lines = [];
    var pct = 0;
    if (syncRun) {
      var tot = total || 329;
      lines.push("Pobieram pamięć podręczną (" + done + "/" + tot + ")");
      if (tot > 0) pct = Math.max(pct, Math.round((100 * done) / tot));
    }
    if (idxRun) {
      var eta = fmtEta(progress.eta_sec != null ? progress.eta_sec : progress.remaining_sec);
      lines.push(eta ? ("Indeksowanie · " + eta) : "Indeksowanie");
      if (progress.pct) pct = Math.max(pct, Number(progress.pct) || 0);
    } else if (pendingHourly && !snoozed) {
      lines.push("Pełny skan ROOT · start za chwilę");
    }
    if (snoozed && !idxRun) {
      lines.push("Indeksowanie odroczone do końca dnia");
    }

    if (_minimized) {
      title.textContent = lines[0] || "Praca w tle";
      meta.textContent = "";
      if (bar) bar.hidden = true;
      if (actions) actions.hidden = true;
    } else {
      title.textContent = lines[0] || "";
      meta.textContent = lines.slice(1).join(" · ");
      if (bar) bar.hidden = false;
      if (actions) actions.hidden = !(idxRun || snoozed || pendingHourly);
    }
    if (fill) fill.style.width = Math.max(4, Math.min(100, pct || (idxRun ? 12 : 8))) + "%";
    if (cancelBtn) {
      cancelBtn.hidden = !idxRun;
      cancelBtn.disabled = !idxRun;
    }
    if (snoozeBtn) {
      snoozeBtn.hidden = false;
      snoozeBtn.setAttribute("data-until", snoozed ? "clear" : "eod");
      snoozeBtn.textContent = snoozed ? "Wznów dziś" : "Nie dzisiaj";
    }
  }

  function maybeStartDownload(sync) {
    if (_startedDownload) return;
    if (!sync || sync.running) return;
    if (!sync.needs_download) return;
    _startedDownload = true;
    fetch(bridgeBase() + "/thumb-cache/sync/start", {
      method: "POST",
      headers: authHeaders(),
      body: "{}",
    }).catch(function () {
      _startedDownload = false;
    });
  }

  function tick() {
    var base = bridgeBase();
    Promise.all([
      fetch(base + "/thumb-cache/sync/status", { cache: "no-store" }).then(function (r) {
        return r.ok ? r.json() : {};
      }),
      fetch(base + "/index/status", { cache: "no-store" }).then(function (r) {
        return r.ok ? r.json() : {};
      }),
    ])
      .then(function (pair) {
        var sync = pair[0] || {};
        var index = pair[1] || {};
        maybeStartDownload(sync);
        applyView(sync, index);
        var hot = !!(sync.running || (index.progress && index.progress.running) || index.rebuild_running);
        var sig = JSON.stringify({
          d: sync.done,
          t: sync.total,
          r: sync.running,
          ir: index.rebuild_running,
          s: index.snoozed,
          e: index.progress && index.progress.eta_sec,
        });
        if (sig !== _lastSig) {
          _lastSig = sig;
          global.dispatchEvent(
            new CustomEvent("dam:job-toast", { detail: { sync: sync, index: index } })
          );
        }
        schedule(hot ? POLL_HOT_MS : POLL_IDLE_MS);
      })
      .catch(function () {
        schedule(POLL_IDLE_MS);
      });
  }

  function schedule(ms) {
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(tick, ms);
  }

  function start() {
    ensureCss();
    host();
    try {
      _minimized = localStorage.getItem("dam_job_toast_min") === "1";
    } catch (_e) {
      _minimized = false;
    }
    tick();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) tick();
      });
    }
  }

  global.DamCacheSync = {
    start: start,
    refresh: tick,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(typeof window !== "undefined" ? window : globalThis);
