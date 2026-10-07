/**
 * DAM runtime - bridge URL + auto-start mostu (ensure-services).
 */
(function () {
  "use strict";

  function inferBridge() {
    if (window.DamBridgeUrl && typeof window.DamBridgeUrl.resolve === "function") {
      return window.DamBridgeUrl.resolve();
    }
    return "http://127.0.0.1:8766";
  }

  function inferUi() {
    if (window.DamBridgeUrl && typeof window.DamBridgeUrl.uiOrigin === "function") {
      return window.DamBridgeUrl.uiOrigin();
    }
    if (typeof location !== "undefined" && location.origin && location.protocol !== "file:") {
      return String(location.origin).replace(/\/+$/, "");
    }
    return "http://127.0.0.1:8765";
  }

  var fallback = {
    bridge: inferBridge(),
    ui_origin: inferUi(),
    ready: false,
    services_ok: false,
  };

  window.DamRuntime = Object.assign({}, fallback);

  /* 07.10.2026: adres mostu musi byc znany, ZANIM ruszy jakikolwiek inny skrypt strony.
     Do czasu odpowiedzi na fetch("/dam-runtime.json") bridgeUrl() zwracal domyslne
     127.0.0.1:8766 - na komputerze, gdzie DAM dostal inne porty (zajete 8765/8766, drugie
     konto Windows, instancja testowa), ekran logowania pytal CUDZY most o /db/status,
     /auth/saved i /db/activation. Odczyt synchroniczny: odpowiada ten sam serwer UI,
     ktory wlasnie oddal strone. Brak pliku (tryb przegladarkowy) = zachowanie jak dotad.
     ponytail: synchroniczny XHR blokuje watek strony na jedna odpowiedz z loopback; gdyby
     serwer UI byl kiedys zdalny - wstrzyknac konfiguracje w HTML po stronie serwera. */
  function loadRuntimeSync() {
    try {
      if (typeof XMLHttpRequest === "undefined" || location.protocol === "file:") return false;
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "/dam-runtime.json", false);
      xhr.send(null);
      if (xhr.status !== 200) return false;
      apply(JSON.parse(xhr.responseText));
      return true;
    } catch (_sync) {
      return false;
    }
  }

  loadRuntimeSync();

  function uiOrigin() {
    var o = window.DamRuntime.ui_origin || fallback.ui_origin;
    return String(o).replace(/\/+$/, "");
  }

  function bridgeUrl() {
    return String(window.DamRuntime.bridge || fallback.bridge).replace(/\/+$/, "");
  }

  function apply(cfg) {
    if (!cfg || typeof cfg !== "object") return;
    Object.assign(window.DamRuntime, cfg);
  }

  function bridgeHealth() {
    return fetch(bridgeUrl() + "/health", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("health_" + r.status);
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  function requestEnsureServices() {
    return fetch(uiOrigin() + "/dam/ensure-services", {
      method: "POST",
      cache: "no-store",
    })
      .then(function (r) {
        return r.json().catch(function () {
          return { ok: false, error: "bad_json", status: r.status };
        });
      })
      .catch(function (err) {
        return { ok: false, error: String(err && err.message ? err.message : err) };
      });
  }

  function waitBridgeUp(maxMs) {
    var deadline = Date.now() + (maxMs || 12000);
    function tick() {
      return bridgeHealth().then(function (h) {
        if (h && h.ok !== false) return h;
        if (Date.now() >= deadline) return null;
        return new Promise(function (resolve) {
          setTimeout(resolve, 350);
        }).then(tick);
      });
    }
    return tick();
  }

  function ensureServices(opts) {
    if (window.DamRuntime.services_ok) {
      return Promise.resolve({ ok: true, cached: true });
    }
    return bridgeHealth().then(function (h) {
      if (h && h.ok !== false) {
        window.DamRuntime.services_ok = true;
        return { ok: true, started: false, health: h };
      }
      if (opts && opts.skipEnsure) {
        return { ok: false, error: "bridge_offline" };
      }
      return requestEnsureServices().then(function (res) {
        if (res && res.ok) {
          window.DamRuntime.services_ok = true;
          return res;
        }
        return waitBridgeUp(12000).then(function (h2) {
          if (h2 && h2.ok !== false) {
            window.DamRuntime.services_ok = true;
            return { ok: true, started: true, health: h2 };
          }
          return res || { ok: false, error: "ensure_failed" };
        });
      });
    });
  }

  function finishReady() {
    window.DamRuntime.ready = true;
    window.dispatchEvent(new CustomEvent("dam-runtime-ready", { detail: window.DamRuntime }));
    if (window.DamRuntime.services_ok) {
      window.dispatchEvent(new CustomEvent("dam:bridge-ready", { detail: window.DamRuntime }));
    }
  }

  function loadRuntimeConfig() {
    return fetch("/dam-runtime.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("runtime");
        return r.json();
      })
      .catch(function () {
        return fetch("data/dam-runtime.json", { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("runtime-file");
            return r.json();
          });
      });
  }

  loadRuntimeConfig()
    .then(function (cfg) {
      apply(cfg);
      return ensureServices();
    })
    .catch(function () {
      return ensureServices();
    })
    .finally(finishReady);

  window.DamRuntime.bridgeUrl = bridgeUrl;
  window.DamRuntime.uiOrigin = uiOrigin;
  window.DamRuntime.ensureServices = ensureServices;
  window.DamRuntime.bridgeHealth = bridgeHealth;
})();
