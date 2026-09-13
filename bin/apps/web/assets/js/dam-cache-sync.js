/**
 * Dockable toast: cache download from NAS + index ETA / cancel / snooze.
 * Live current item + after-run report. Geex tokens only. No em-dash.
 */
(function (global) {
  "use strict";

  var STYLE_ID = "damCacheSyncCss";
  var HOST_ID = "damJobToast";
  var REPORT_ID = "damIndexReport";
  var PILL_ID = "damIndexCountPill";
  var POLL_IDLE_MS = 8000;
  var POLL_HOT_MS = 1200;
  var MIN_TOUCH = 44;
  var REPORT_KEY = "dam_index_last_report";
  var ACK_KEY = "dam_index_report_ack";

  var _timer = null;
  var _minimized = false;
  var _startedDownload = false;
  var _lastSig = "";
  var _wasRunning = false;
  var _awaitAck = false;
  var _lastReport = null;

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

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shortPath(p) {
    var s = String(p || "").replace(/\\/g, "/");
    var parts = s.split("/").filter(Boolean);
    if (parts.length <= 4) return s;
    return parts.slice(-4).join("/");
  }

  function persistReport(rep) {
    _lastReport = rep || _lastReport;
    try {
      if (_lastReport) localStorage.setItem(REPORT_KEY, JSON.stringify(_lastReport));
    } catch (_e) {}
  }

  function loadPersistedReport() {
    if (_lastReport) return _lastReport;
    try {
      var raw = localStorage.getItem(REPORT_KEY);
      if (raw) _lastReport = JSON.parse(raw);
    } catch (_e) {
      _lastReport = null;
    }
    return _lastReport;
  }

  function reportId(rep) {
    if (!rep) return "";
    return String(rep.finished_at || rep.updated_at || "");
  }

  function isAcked(rep) {
    try {
      return localStorage.getItem(ACK_KEY) === reportId(rep);
    } catch (_e) {
      return false;
    }
  }

  function ackReport(rep) {
    try {
      localStorage.setItem(ACK_KEY, reportId(rep) || "1");
    } catch (_e) {}
    _awaitAck = false;
  }

  function ensureCss() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      "#" + HOST_ID + "{" +
        "position:fixed;right:20px;bottom:76px;z-index:11040;" +
        "width:min(400px,calc(100vw - 24px));" +
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
      "#" + HOST_ID + " .dam-job-toast__now{" +
        "display:block;margin-top:6px;font-size:12.5px;font-weight:600;color:#3d3550;" +
        "word-break:break-word;line-height:1.4;" +
      "}" +
      "#" + HOST_ID + " .dam-job-toast__now[hidden],#" + HOST_ID + " .dam-job-toast__path[hidden]{display:none!important;}" +
      "#" + HOST_ID + " .dam-job-toast__path{" +
        "display:block;margin-top:2px;font-size:11px;font-weight:500;color:#7a7388;" +
        "word-break:break-all;" +
      "}" +
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
      "#" + HOST_ID + " .dam-job-toast__btn.is-primary{background:var(--primary-color,#ab54db);color:#fff;}" +
      "#" + HOST_ID + " .dam-job-toast__btn.is-danger{background:color-mix(in srgb,var(--primary-color,#ab54db) 14%, #fff);color:#6b2d8a;}" +
      "#" + HOST_ID + " .dam-job-toast__icon{background:transparent;color:var(--body-color,#464255);padding:0;}" +
      "#" + HOST_ID + " .dam-job-toast__btn:hover," +
      "#" + HOST_ID + " .dam-job-toast__icon:hover{background:color-mix(in srgb,var(--primary-color,#ab54db) 12%, transparent);}" +
      "#" + HOST_ID + " .dam-job-toast__btn.is-primary:hover{background:#9a45c9;}" +
      "#" + HOST_ID + " .dam-job-toast__btn:focus-visible," +
      "#" + HOST_ID + " .dam-job-toast__icon:focus-visible{outline:2px solid var(--primary-color,#ab54db);outline-offset:2px;}" +
      "#" + PILL_ID + "{" +
        "position:fixed;right:76px;bottom:20px;z-index:11030;" +
        "min-height:" + MIN_TOUCH + "px;padding:0 14px;" +
        "display:inline-flex;align-items:center;" +
        "background:#fff;border:1px solid rgba(70,66,85,.12);border-radius:999px;" +
        "box-shadow:0 8px 24px rgba(23,22,30,.10);" +
        "font-size:12.5px;font-weight:600;color:#464255;" +
      "}" +
      "#" + PILL_ID + "[hidden]{display:none!important;}" +
      "#" + REPORT_ID + "{" +
        "position:fixed;inset:0;z-index:12150;display:flex;align-items:center;justify-content:center;" +
        "background:rgba(23,22,30,.36);padding:20px;" +
      "}" +
      "#" + REPORT_ID + "[hidden]{display:none!important;}" +
      "#" + REPORT_ID + " .dam-index-report__card{" +
        "width:min(520px,100%);max-height:min(80vh,640px);overflow:auto;" +
        "background:#fff;border-radius:16px;padding:20px 20px 16px;" +
        "box-shadow:0 20px 50px rgba(23,22,30,.22);" +
      "}" +
      "#" + REPORT_ID + " h2{margin:0 0 8px;font-size:18px;color:#17161E;}" +
      "#" + REPORT_ID + " .dam-index-report__lead{margin:0 0 12px;font-size:13px;color:#5c5668;font-weight:500;}" +
      "#" + REPORT_ID + " ul{margin:0;padding:0;list-style:none;}" +
      "#" + REPORT_ID + " li{padding:10px 0;border-top:1px solid #eceaf3;font-size:13px;}" +
      "#" + REPORT_ID + " .dam-index-report__kind{display:inline-block;min-width:72px;font-size:11px;font-weight:700;color:#6b2d8a;}" +
      "#" + REPORT_ID + " .dam-index-report__actions{display:flex;gap:8px;margin-top:16px;}" +
      "#" + REPORT_ID + " button{min-width:" + MIN_TOUCH + "px;min-height:" + MIN_TOUCH + "px;border:0;border-radius:12px;padding:0 14px;font-weight:700;cursor:pointer;}" +
      "#" + REPORT_ID + " .is-primary{background:var(--primary-color,#ab54db);color:#fff;}" +
      "#" + REPORT_ID + " .is-ghost{background:#eceaf3;color:#464255;}" +
      "html[data-theme='dark'] #" + HOST_ID + "{background:#1f1d27;color:#eceaf3;border-color:rgba(255,255,255,.08);}" +
      "html[data-theme='dark'] #" + HOST_ID + " .dam-job-toast__title{color:#fff;}" +
      "html[data-theme='dark'] #" + HOST_ID + " .dam-job-toast__now{color:#e4dff0;}" +
      "html[data-theme='dark'] #" + HOST_ID + " .dam-job-toast__meta," +
      "html[data-theme='dark'] #" + HOST_ID + " .dam-job-toast__path{color:#c9c4d4;}" +
      "html[data-theme='dark'] #" + PILL_ID + "{background:#1f1d27;color:#eceaf3;border-color:rgba(255,255,255,.08);}" +
      "html[data-theme='dark'] #" + REPORT_ID + " .dam-index-report__card{background:#1f1d27;color:#eceaf3;}";
    document.head.appendChild(st);
  }

  function countPill() {
    var el = document.getElementById(PILL_ID);
    if (el) return el;
    el = document.createElement("div");
    el.id = PILL_ID;
    el.hidden = true;
    document.body.appendChild(el);
    return el;
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
          '<span class="dam-job-toast__now" id="damJobToastNow" hidden></span>' +
          '<span class="dam-job-toast__path" id="damJobToastPath" hidden></span>' +
          '<span class="dam-job-toast__meta" id="damJobToastMeta"></span>' +
        "</div>" +
        '<button type="button" class="dam-job-toast__icon" id="damJobToastMin" aria-label="Zwin" title="Zwin">_</button>' +
      "</div>" +
      '<div class="dam-job-toast__bar" id="damJobToastBar" aria-hidden="true"><div class="dam-job-toast__fill" id="damJobToastFill"></div></div>' +
      '<div class="dam-job-toast__actions" id="damJobToastActions">' +
        '<button type="button" class="dam-job-toast__btn is-danger" id="damJobToastCancel">Przerwij</button>' +
        '<button type="button" class="dam-job-toast__btn is-ghost" id="damJobToastSnooze">Nie dzisiaj</button>' +
        '<button type="button" class="dam-job-toast__btn is-ghost" id="damJobToastClose" hidden>Zamknij</button>' +
        '<button type="button" class="dam-job-toast__btn is-primary" id="damJobToastReport" hidden>Raport</button>' +
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
    var closeBtn = el.querySelector("#damJobToastClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        ackReport(_lastReport || loadPersistedReport());
        el.hidden = true;
        countPill().hidden = true;
      });
    }
    var reportBtn = el.querySelector("#damJobToastReport");
    if (reportBtn) {
      reportBtn.addEventListener("click", function () {
        openReport(_lastReport || loadPersistedReport());
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

  function pickCurrent(index) {
    var p = (index && index.progress) || {};
    var label = String(
      p.current_item ||
        p.current_label ||
        index.current_item ||
        p.current_name ||
        index.current_name ||
        ""
    ).trim();
    var path = String(p.current_path || index.current_path || "").trim();
    return { label: label, path: path };
  }

  function pickCounts(index, sync) {
    var p = (index && index.progress) || {};
    var pd = Number(p.products_done != null ? p.products_done : sync && sync.done);
    var pt = Number(p.products_total != null ? p.products_total : sync && sync.total);
    var fd = Number(p.files_done);
    var ft = Number(p.files_total);
    return { pd: pd, pt: pt, fd: fd, ft: ft };
  }

  function fetchReport() {
    return fetch(bridgeBase() + "/index/report", { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (rep) {
        if (rep && (rep.items || rep.ok)) persistReport(rep);
        return rep;
      })
      .catch(function () {
        return loadPersistedReport();
      });
  }

  function openReport(rep) {
    ensureCss();
    var data = rep || loadPersistedReport() || { items: [], empty: true };
    var items = data.items || data.new_items || [];
    var el = document.getElementById(REPORT_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = REPORT_ID;
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-labelledby", "damIndexReportTitle");
      document.body.appendChild(el);
    }
    var rows = items
      .map(function (it) {
        var kind = it.kind === "changed" ? "Zmiana" : "Nowe";
        return (
          "<li><span class=\"dam-index-report__kind\">" +
          esc(kind) +
          "</span> " +
          esc(it.name || it.id || "") +
          (it.category ? " <span style=\"color:#7a7388\">(" + esc(it.category) + ")</span>" : "") +
          "</li>"
        );
      })
      .join("");
    var lead = items.length
      ? "Nowe i zmienione w tym przebiegu: " + items.length + "."
      : "Nic nowego";
    el.innerHTML =
      '<div class="dam-index-report__card">' +
        ' <h2 id="damIndexReportTitle">Raport indeksowania</h2>' +
        '<p class="dam-index-report__lead">' +
        esc(lead) +
        "</p>" +
        (items.length ? "<ul>" + rows + "</ul>" : "") +
        '<div class="dam-index-report__actions">' +
          '<button type="button" class="is-ghost" id="damIndexReportClose">Zamknij</button>' +
        "</div>" +
      "</div>";
    el.hidden = false;
    var closer = el.querySelector("#damIndexReportClose");
    if (closer) {
      closer.addEventListener("click", function () {
        el.hidden = true;
      });
    }
    el.addEventListener("click", function (ev) {
      if (ev.target === el) el.hidden = true;
    });
  }

  function applyView(sync, index) {
    var el = host();
    var title = el.querySelector("#damJobToastTitle");
    var nowEl = el.querySelector("#damJobToastNow");
    var pathEl = el.querySelector("#damJobToastPath");
    var meta = el.querySelector("#damJobToastMeta");
    var fill = el.querySelector("#damJobToastFill");
    var bar = el.querySelector("#damJobToastBar");
    var actions = el.querySelector("#damJobToastActions");
    var cancelBtn = el.querySelector("#damJobToastCancel");
    var snoozeBtn = el.querySelector("#damJobToastSnooze");
    var closeBtn = el.querySelector("#damJobToastClose");
    var reportBtn = el.querySelector("#damJobToastReport");
    var pill = countPill();

    var syncRun = !!(sync && sync.running);
    var done = Number((sync && sync.done) || 0);
    var total = Number((sync && sync.total) || 0);
    var progress = (index && index.progress) || {};
    var idxRun = !!(
      progress.running ||
      (index && index.rebuild_running) ||
      (index && index.rebuild && index.rebuild.running)
    );
    var snoozed = !!(index && index.snoozed);
    var pendingHourly = !!(index && index.hourly_pending);
    var cur = pickCurrent(index);
    var counts = pickCounts(index, sync);

    if (idxRun) {
      _wasRunning = true;
      _awaitAck = false;
    } else if (_wasRunning) {
      _wasRunning = false;
      _awaitAck = true;
      fetchReport();
    }

    var persisted = loadPersistedReport();
    if (!idxRun && persisted && !isAcked(persisted)) {
      _awaitAck = true;
    }

    var show = syncRun || idxRun || snoozed || pendingHourly || _awaitAck;
    el.hidden = !show;
    if (!show) {
      pill.hidden = true;
      return;
    }

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
    } else if (_awaitAck) {
      lines.push("Indeksowanie zakonczone");
    } else if (pendingHourly && !snoozed) {
      lines.push("Pełny skan ROOT · start za chwilę");
    }
    if (snoozed && !idxRun && !_awaitAck) {
      lines.push("Indeksowanie odroczone do końca dnia");
    }

    var countTxt = "";
    if (counts.pt > 0) {
      countTxt =
        (isNaN(counts.pd) ? "0" : counts.pd) +
        " / " +
        counts.pt +
        " elementów";
    }
    if (counts.ft > 0) {
      countTxt +=
        (countTxt ? " · " : "") +
        (isNaN(counts.fd) ? "0" : counts.fd) +
        " / " +
        counts.ft +
        " plików";
    }
    pill.textContent = countTxt;
    pill.hidden = !countTxt || _minimized;

    if (_minimized) {
      title.textContent = lines[0] || "Praca w tle";
      if (nowEl) {
        nowEl.hidden = !cur.label;
        nowEl.textContent = cur.label ? "Teraz: " + cur.label : "";
      }
      if (pathEl) pathEl.hidden = true;
      meta.textContent = "";
      if (bar) bar.hidden = true;
      if (actions) actions.hidden = true;
    } else {
      title.textContent = lines[0] || "";
      if (nowEl) {
        nowEl.hidden = !(idxRun && cur.label);
        nowEl.textContent = cur.label ? "Teraz: " + cur.label : "";
      }
      if (pathEl) {
        pathEl.hidden = !(idxRun && cur.path);
        pathEl.textContent = cur.path ? shortPath(cur.path) : "";
      }
      meta.textContent = lines.slice(1).join(" · ");
      if (bar) bar.hidden = !idxRun && !syncRun;
      if (actions) actions.hidden = !(idxRun || snoozed || pendingHourly || _awaitAck);
    }
    if (fill) fill.style.width = Math.max(4, Math.min(100, pct || (idxRun ? 12 : 8))) + "%";
    if (cancelBtn) {
      cancelBtn.hidden = !idxRun;
      cancelBtn.disabled = !idxRun;
    }
    if (snoozeBtn) {
      snoozeBtn.hidden = _awaitAck && !idxRun;
      snoozeBtn.setAttribute("data-until", snoozed ? "clear" : "eod");
      snoozeBtn.textContent = snoozed ? "Wznów dziś" : "Nie dzisiaj";
    }
    if (closeBtn) closeBtn.hidden = !(_awaitAck && !idxRun);
    if (reportBtn) reportBtn.hidden = !(_awaitAck && !idxRun);
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
        if (index.last_report && (index.last_report.items || index.last_report.ok)) {
          persistReport(index.last_report);
        }
        maybeStartDownload(sync);
        applyView(sync, index);
        var hot = !!(
          sync.running ||
          (index.progress && index.progress.running) ||
          index.rebuild_running
        );
        var sig = JSON.stringify({
          d: sync.done,
          t: sync.total,
          r: sync.running,
          ir: index.rebuild_running,
          s: index.snoozed,
          e: index.progress && index.progress.eta_sec,
          c: (index.progress && index.progress.current_item) || index.current_item || "",
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
    loadPersistedReport();
    tick();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) tick();
      });
    }
  }

  function debugPreview(kind) {
    ensureCss();
    var mockIndex;
    if (kind === "done" || kind === "report") {
      persistReport({
        ok: true,
        finished_at: new Date().toISOString(),
        items: [
          { kind: "added", name: "Cynamonka nerkowcowy", category: "BATONY", path: "X:/Marketing/- POLSKA/01 - PRODUKTY/- DK/BATONY/Cynamonka" },
        ],
        empty: false,
      });
      _awaitAck = true;
      _wasRunning = false;
      mockIndex = { progress: { running: false }, rebuild_running: false, last_report: _lastReport };
    } else if (kind === "empty") {
      persistReport({ ok: true, finished_at: new Date().toISOString(), items: [], empty: true });
      _awaitAck = true;
      _wasRunning = false;
      mockIndex = { progress: { running: false }, rebuild_running: false, last_report: _lastReport };
    } else {
      mockIndex = {
        rebuild_running: true,
        progress: {
          running: true,
          pct: 48,
          eta_sec: 90,
          current_item: "Cynamonka / ELEMENTY / front.ai",
          current_name: "front.ai",
          current_path: "X:/Marketing/- POLSKA/01 - PRODUKTY/- DK/BATONY/Cynamonka nerkowcowy/ELEMENTY/front.ai",
          products_done: 158,
          products_total: 165,
          files_done: 428,
          files_total: 435,
        },
      };
    }
    applyView({ running: false }, mockIndex);
    if (kind === "report" || kind === "empty") openReport(_lastReport);
    return mockIndex;
  }

  global.DamCacheSync = {
    start: start,
    refresh: tick,
    debugPreview: debugPreview,
    openReport: openReport,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(typeof window !== "undefined" ? window : globalThis);
