/**
 * DAM client telemetry — kliknięcia, nawigacja, fetch, błędy JS.
 * Bufor w pamięci + flush co 5s do bridge POST /telemetry/batch.
 * Logi: apps/desktop/logs/telemetry-YYYY-MM-DD.jsonl
 */
(function (global) {
  "use strict";

  var FLUSH_MS = 5000;
  var MAX_BUFFER = 200;
  var SESSION_KEY = "dam_telemetry_session";
  var _buf = [];
  var _timer = null;
  var _sessionId = "";

  function bridgeBase() {
    if (global.DamRuntime && typeof global.DamRuntime.bridgeUrl === "function") {
      return global.DamRuntime.bridgeUrl();
    }
    if (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function") {
      return global.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (e) {
      return "";
    }
  }

  function pageId() {
    try {
      return (global.location && global.location.pathname) || "";
    } catch (e2) {
      return "";
    }
  }

  function ensureSession() {
    if (_sessionId) return _sessionId;
    try {
      _sessionId = sessionStorage.getItem(SESSION_KEY) || "";
      if (!_sessionId) {
        _sessionId = "ui-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        sessionStorage.setItem(SESSION_KEY, _sessionId);
      }
    } catch (e) {
      _sessionId = "ui-" + Date.now();
    }
    return _sessionId;
  }

  function push(type, meta, level) {
    if (!type) return;
    var row = {
      ts: nowIso(),
      type: String(type),
      component: "ui",
      level: level || "info",
      session_id: ensureSession(),
      meta: meta && typeof meta === "object" ? meta : {},
    };
    row.meta.page = pageId();
    _buf.push(row);
    if (_buf.length > MAX_BUFFER) _buf.splice(0, _buf.length - MAX_BUFFER);
    if (_buf.length >= 40) flush();
  }

  function flush() {
    if (!_buf.length) return Promise.resolve({ ok: true, written: 0 });
    var batch = _buf.splice(0, _buf.length);
    return fetch(bridgeBase() + "/telemetry/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    })
      .then(function (r) {
        return r.ok ? r.json() : { ok: false };
      })
      .catch(function () {
        _buf = batch.concat(_buf).slice(-MAX_BUFFER);
        return { ok: false };
      });
  }

  function scheduleFlush() {
    if (_timer) return;
    _timer = setInterval(function () {
      flush();
    }, FLUSH_MS);
  }

  function describeClick(el) {
    if (!el || el.nodeType !== 1) return {};
    var tag = (el.tagName || "").toLowerCase();
    var id = el.id || "";
    var cls = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 4).join(" ") : "";
    var text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
    var href = el.getAttribute && (el.getAttribute("href") || el.getAttribute("data-path") || "");
    var damAction = el.getAttribute && el.getAttribute("data-dam-action");
    return { tag: tag, id: id, class: cls, text: text, href: href || undefined, dam_action: damAction || undefined };
  }

  function bindClicks() {
    document.addEventListener(
      "click",
      function (e) {
        var t = e.target;
        var el = t && t.closest ? t.closest("a,button,[role=button],input,select,textarea,[data-dam-action]") : t;
        if (!el) return;
        push("click", describeClick(el));
      },
      true
    );
  }

  function bindNavigation() {
    global.addEventListener("hashchange", function () {
      push("nav_hash", { hash: global.location.hash || "" });
    });
    global.addEventListener("popstate", function () {
      push("nav_popstate", { path: pageId() });
    });
    var _pushState = history.pushState;
    var _replaceState = history.replaceState;
    history.pushState = function () {
      var r = _pushState.apply(this, arguments);
      push("nav_push", { path: pageId() });
      return r;
    };
    history.replaceState = function () {
      var r = _replaceState.apply(this, arguments);
      push("nav_replace", { path: pageId() });
      return r;
    };
  }

  function bindErrors() {
    global.addEventListener("error", function (ev) {
      push(
        "js_error",
        {
          message: String(ev.message || ""),
          source: String(ev.filename || ""),
          line: ev.lineno,
          col: ev.colno,
        },
        "error"
      );
    });
    global.addEventListener("unhandledrejection", function (ev) {
      var reason = ev.reason;
      push(
        "promise_rejection",
        {
          message: reason && reason.message ? String(reason.message) : String(reason || ""),
        },
        "error"
      );
    });
  }

  function bindFetch() {
    if (!global.fetch) return;
    var _fetch = global.fetch.bind(global);
    global.fetch = function (input, init) {
      var url = typeof input === "string" ? input : input && input.url ? input.url : "";
      var method = (init && init.method) || "GET";
      var t0 = performance && performance.now ? performance.now() : Date.now();
      return _fetch(input, init)
        .then(function (res) {
          var slow = false;
          if (performance && performance.now) {
            slow = performance.now() - t0 > 3000;
          }
          if (slow || !res.ok) {
            push(
              "fetch",
              {
                url: String(url).slice(0, 240),
                method: method,
                status: res.status,
                duration_ms: performance && performance.now ? Math.round(performance.now() - t0) : undefined,
              },
              res.ok ? "info" : "warn"
            );
          }
          return res;
        })
        .catch(function (err) {
          push(
            "fetch_error",
            {
              url: String(url).slice(0, 240),
              method: method,
              error: String(err && err.message ? err.message : err),
            },
            "error"
          );
          throw err;
        });
    };
  }

  function start() {
    if (global.location && global.location.pathname.indexOf("signin") !== -1) return;
    ensureSession();
    bindClicks();
    bindNavigation();
    bindErrors();
    bindFetch();
    scheduleFlush();
    push("telemetry_boot", { ua: navigator.userAgent ? navigator.userAgent.slice(0, 160) : "" });
    global.addEventListener("beforeunload", function () {
      flush();
    });
    global.addEventListener("visibilitychange", function () {
      if (document.hidden) flush();
    });
  }

  global.DamTelemetry = {
    push: push,
    flush: flush,
    start: start,
    sessionId: ensureSession,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(typeof window !== "undefined" ? window : globalThis);
