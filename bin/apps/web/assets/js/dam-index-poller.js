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

  global.DamIndexPoller = {
    create: createPoller,
    pickGeneration: pickGeneration,
    isRunning: isRunning,
  };
})(typeof window !== "undefined" ? window : globalThis);
