/**
 * DAM runtime - bridge URL z lokalnej aplikacji (bez recznych portow).
 */
(function () {
  "use strict";

  var fallback = {
    bridge: "http://127.0.0.1:8766",
    ui_origin: "http://127.0.0.1:8765",
    ready: false,
  };

  window.DamRuntime = Object.assign({}, fallback);

  function apply(cfg) {
    if (!cfg || typeof cfg !== "object") return;
    Object.assign(window.DamRuntime, cfg, { ready: true });
    window.dispatchEvent(new CustomEvent("dam-runtime-ready", { detail: window.DamRuntime }));
  }

  fetch("/dam-runtime.json", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("runtime");
      return r.json();
    })
    .then(apply)
    .catch(function () {
      fetch("data/dam-runtime.json", { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("runtime-file");
          return r.json();
        })
        .then(apply)
        .catch(function () {
          window.DamRuntime.ready = true;
        });
    });

  window.DamRuntime.bridgeUrl = function () {
    return String(window.DamRuntime.bridge || fallback.bridge).replace(/\/+$/, "");
  };
})();
