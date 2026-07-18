/**
 * DAM ETA - desktop / browser notifications for new visualizations.
 * Polls file-index.json every 60s when enabled.
 */
(function (global) {
  "use strict";

  var ENABLED_KEY = "dam_notify_new_viz";
  var SEEN_KEY = "dam_notify_seen_viz";
  var POLL_MS = 60000;
  var timer = null;
  var listeners = [];

  function isEnabled() {
    return localStorage.getItem(ENABLED_KEY) === "1";
  }

  function setEnabled(on) {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
    if (on) start();
    else stop();
    emit({ type: "enabled", value: !!on });
  }

  function permission() {
    if (!("Notification" in global)) return "unsupported";
    return Notification.permission;
  }

  function requestPermission() {
    if (!("Notification" in global)) {
      return Promise.resolve("unsupported");
    }
    if (Notification.permission === "granted") {
      return Promise.resolve("granted");
    }
    if (Notification.permission === "denied") {
      return Promise.resolve("denied");
    }
    return Notification.requestPermission();
  }

  function loadSeen() {
    try {
      return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveSeen(map) {
    localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  }

  function vizKey(v) {
    return [v.product_id || "", v.index_base || v.index || "", v.lang || "", v.mtime || "", v.file || ""].join("|");
  }

  function showNotification(title, body, url) {
    if (!("Notification" in global) || Notification.permission !== "granted") return;
    try {
      var n = new Notification(title, {
        body: body || "",
        tag: "dam-new-viz",
        icon: "assets/img/logo-dobra-kaloria.svg"
      });
      n.onclick = function () {
        try {
          global.focus();
          if (url) global.location.href = url;
        } catch (e2) { /* ignore */ }
        n.close();
      };
    } catch (e) { /* ignore */ }
  }

  function checkIndex() {
    return fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data) return;
        var list = data.viz_latest || [];
        var seen = loadSeen();
        var fresh = [];
        var nextSeen = {};
        list.forEach(function (v) {
          var k = vizKey(v);
          nextSeen[k] = true;
          if (!seen[k] && Object.keys(seen).length) {
            fresh.push(v);
          }
        });
        if (!Object.keys(seen).length) {
          saveSeen(nextSeen);
          emit({ type: "baseline", count: list.length });
          return;
        }
        saveSeen(nextSeen);
        if (fresh.length && isEnabled()) {
          var first = fresh[0];
          var name = first.product_name || first.product_id || "Wizualizacja";
          var more = fresh.length > 1 ? " (+" + (fresh.length - 1) + ")" : "";
          showNotification(
            "Nowa wizualizacja w DAM",
            name + more,
            "visualizations.html"
          );
          emit({ type: "new", items: fresh });
        }
      })
      .catch(function () { /* quiet */ });
  }

  function start() {
    if (timer) return;
    if (!isEnabled()) return;
    checkIndex();
    timer = setInterval(checkIndex, POLL_MS);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function on(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  function emit(evt) {
    listeners.forEach(function (fn) {
      try {
        fn(evt);
      } catch (e) { /* ignore */ }
    });
  }

  function statusText() {
    var p = permission();
    if (p === "unsupported") return "Powiadomienia niedostepne w tym srodowisku";
    if (!isEnabled()) return "Wylaczone";
    if (p === "denied") return "Zablokowane w przegladarce";
    if (p === "granted") return "Aktywne (co 60 s)";
    return "Wymaga zgody przegladarki";
  }

  global.DamNotify = {
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    permission: permission,
    requestPermission: requestPermission,
    start: start,
    stop: stop,
    checkNow: checkIndex,
    on: on,
    statusText: statusText
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (isEnabled()) start();
    });
  } else if (isEnabled()) {
    start();
  }
})(typeof window !== "undefined" ? window : globalThis);
