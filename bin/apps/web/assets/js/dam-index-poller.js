/**
 * DAM - lightweight index generation poller (Explorer / Viz / Branding).
 * Polls bridge status endpoints when page is visible; backoff while rebuild running.
 */
(function (global) {
  "use strict";

  var DEFAULT_INTERVAL_MS = 10000;
  var MIN_BACKOFF_MS = 2000;
  var MAX_BACKOFF_MS = 30000;

  function bridgeUrl() {
    if (global.DamRuntime && typeof global.DamRuntime.bridgeUrl === "function") {
      return global.DamRuntime.bridgeUrl();
    }
    return (global.DamRuntime && global.DamRuntime.bridge) || "http://127.0.0.1:8766";
  }

  function pickGeneration(st) {
    if (!st || typeof st !== "object") return "";
    if (st.generation_id) return String(st.generation_id);
    if (st.grid && st.grid.generation_id) return String(st.grid.generation_id);
    if (st.mtime) return "mtime:" + String(st.mtime);
    if (st.updated_at) return "at:" + String(st.updated_at);
    if (st.state) return "state:" + String(st.state);
    return "";
  }

  function isRunning(st) {
    if (!st || typeof st !== "object") return false;
    if (st.running === true || st.rebuild_running === true) return true;
    if (st.rebuild && st.rebuild.running) return true;
    if (st.grid && st.grid.running) return true;
    var state = String(st.state || "").toLowerCase();
    return state === "running" || state === "building" || state === "rebuilding";
  }

  function createPoller(config) {
    config = config || {};
    var statusPath = String(config.statusPath || "/index/status");
    var name = String(config.name || statusPath);
    var intervalMs = config.intervalMs || DEFAULT_INTERVAL_MS;
    var onChange = typeof config.onChange === "function" ? config.onChange : function () {};
    var getGeneration =
      typeof config.getGeneration === "function" ? config.getGeneration : pickGeneration;

    var state = {
      lastGen: "",
      timer: null,
      backoffMs: MIN_BACKOFF_MS,
      stopped: false,
    };

    function schedule(nextMs) {
      if (state.stopped) return;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(tick, nextMs);
    }

    function tick() {
      if (state.stopped || (typeof document !== "undefined" && document.hidden)) {
        schedule(intervalMs);
        return;
      }
      fetch(bridgeUrl() + statusPath, { cache: "no-store" })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (st) {
          if (!st) {
            schedule(Math.min(state.backoffMs * 2, MAX_BACKOFF_MS));
            return;
          }
          if (isRunning(st)) {
            try {
              if (typeof global.dispatchEvent === "function") {
                global.dispatchEvent(new CustomEvent("dam:index-progress", { detail: st }));
              }
            } catch (_e) {}
            schedule(MIN_BACKOFF_MS);
            return;
          }
          state.backoffMs = MIN_BACKOFF_MS;
          var gen = getGeneration(st);
          if (gen && state.lastGen && gen !== state.lastGen) {
            try {
              onChange(gen, st);
            } catch (eCb) {
              /* ignore */
            }
          }
          if (gen) state.lastGen = gen;
          schedule(intervalMs);
        })
        .catch(function () {
          schedule(Math.min(state.backoffMs * 2, MAX_BACKOFF_MS));
        });
    }

    function kick() {
      tick();
    }

    function stop() {
      state.stopped = true;
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) kick();
      });
    }
    if (typeof global !== "undefined") {
      global.addEventListener("focus", kick);
    }

    schedule(config.initialDelayMs || 800);
    return { kick: kick, stop: stop, name: name };
  }

  function pickLive(st) {
    var p = (st && st.progress) || {};
    var w = (st && st.watcher) || {};
    var path = String(
      st.current_path || p.current_path || w.current_path || ""
    ).trim();
    var label = String(
      st.current_label ||
        p.current_label ||
        st.current_item ||
        p.current_item ||
        st.current_name ||
        p.current_name ||
        w.current_label ||
        w.current_item ||
        ""
    ).trim();
    if (!label && path) {
      var parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
      label = parts.length ? parts[parts.length - 1] : path;
    }
    return { path: path, label: label };
  }

  function isIndexRunning(st) {
    if (!st || typeof st !== "object") return false;
    if (st.rebuild_running === true) return true;
    if (st.progress && st.progress.running) return true;
    if (st.rebuild && st.rebuild.running) return true;
    return isRunning(st);
  }

  function shortPath(p) {
    var s = String(p || "").replace(/\\/g, "/");
    var parts = s.split("/").filter(Boolean);
    if (parts.length <= 4) return s;
    return parts.slice(-4).join("/");
  }

  function emptyReportCopy(rep) {
    return "Nic nowego";
  }

  function injectLiveStyle() {
    if (typeof document === "undefined") return;
    if (document.getElementById("dam-index-live-style")) return;
    var st = document.createElement("style");
    st.id = "dam-index-live-style";
    st.textContent =
      "#damJobToast #damJobToastClose{" +
        "background:var(--primary-color,#ab54db);color:#fff;" +
      "}" +
      "#damJobToast #damJobToastReport{" +
        "background:var(--gray-color,#eceaf3);color:var(--body-color,#464255);" +
      "}" +
      "#damJobToast.is-min .dam-job-toast__now{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      "#damIndexReport .dam-index-report__lead.is-empty{color:#5c5668;}" +
      "body:has(#damJobToastClose:not([hidden])) #damIndexCountPill{display:none!important;}";
    document.head.appendChild(st);
  }

  function ensureNowEls() {
    var host = document.getElementById("damJobToast");
    if (!host) return { nowEl: null, pathEl: null };
    var copy = host.querySelector(".dam-job-toast__copy") || host;
    var nowEl = document.getElementById("damJobToastNow");
    var pathEl = document.getElementById("damJobToastPath");
    if (!nowEl) {
      nowEl = document.createElement("span");
      nowEl.id = "damJobToastNow";
      nowEl.className = "dam-job-toast__now";
      var title = host.querySelector("#damJobToastTitle");
      if (title && title.parentNode) title.parentNode.insertBefore(nowEl, title.nextSibling);
      else copy.appendChild(nowEl);
    }
    if (!pathEl) {
      pathEl = document.createElement("span");
      pathEl.id = "damJobToastPath";
      pathEl.className = "dam-job-toast__path";
      nowEl.parentNode.insertBefore(pathEl, nowEl.nextSibling);
    }
    return { nowEl: nowEl, pathEl: pathEl };
  }

  function applyLiveDom(st) {
    var els = ensureNowEls();
    var nowEl = els.nowEl;
    var pathEl = els.pathEl;
    if (!nowEl) return;
    var running = isIndexRunning(st);
    var live = pickLive(st);
    if (running && (live.label || live.path)) {
      nowEl.hidden = false;
      nowEl.textContent = "Teraz: " + (live.label || live.path);
      nowEl.setAttribute("title", live.path || live.label);
      if (pathEl) {
        pathEl.hidden = !live.path;
        pathEl.textContent = live.path ? shortPath(live.path) : "";
        pathEl.setAttribute("title", live.path);
      }
    }
  }

  function wrapOpenReport() {
    var api = global.DamCacheSync;
    if (!api || typeof api.openReport !== "function" || api.__damLiveWrapped) return;
    api.__damLiveWrapped = true;
    var orig = api.openReport;
    api.openReport = function (rep) {
      orig(rep);
      var lead = document.querySelector("#damIndexReport .dam-index-report__lead");
      if (!lead) return;
      var data = rep || {};
      var items = data.items || data.new_items || [];
      if (!items.length) {
        lead.textContent = emptyReportCopy(data);
        lead.classList.add("is-empty");
      }
    };
  }

  var _liveTimer = null;
  var _livePhase = "idle";

  function liveTick() {
    fetch(bridgeUrl() + "/index/status", { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (st) {
        if (!st) {
          _liveTimer = setTimeout(liveTick, 4000);
          return;
        }
        var running = isIndexRunning(st);
        if (running) {
          _livePhase = "running";
          applyLiveDom(st);
          _liveTimer = setTimeout(liveTick, 900);
          return;
        }
        if (_livePhase === "running") {
          _livePhase = "result";
        }
        _liveTimer = setTimeout(liveTick, running ? 900 : 4000);
      })
      .catch(function () {
        _liveTimer = setTimeout(liveTick, 4000);
      });
  }

  function patchEmptyReportLead() {
    var lead = document.querySelector("#damIndexReport .dam-index-report__lead");
    if (!lead) return;
    var txt = String(lead.textContent || "").trim();
    if (txt === "Nic nowego" || txt === "Nic nowego.") {
      lead.textContent = emptyReportCopy({});
      lead.classList.add("is-empty");
    }
  }

  function bootLiveUi() {
    if (global.__damIndexLiveBooted) return;
    global.__damIndexLiveBooted = true;
    injectLiveStyle();
    wrapOpenReport();
    if (typeof document !== "undefined" && document.body) {
      var mo = new MutationObserver(function () {
        patchEmptyReportLead();
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    if (typeof global.addEventListener === "function") {
      global.addEventListener("dam:job-toast", function (ev) {
        var detail = ev && ev.detail;
        applyLiveDom((detail && detail.index) || {});
      });
      global.addEventListener("dam:index-progress", function (ev) {
        applyLiveDom((ev && ev.detail) || {});
      });
    }
    var tries = 0;
    (function waitCache() {
      wrapOpenReport()