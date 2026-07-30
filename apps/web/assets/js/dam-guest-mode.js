/**

 * DAM Guest Mode — przeglądarka bez mostu (Panel-DAM na Synology).

 * Podgląd: snapshot bazy (JSON) + statyczne miniatury z PAMIEC-PODRECZNA (data/thumbs).

 * Bez zapisu, bez dysku Marketing.

 */

(function (global) {

  "use strict";



  var INSTALLER_URL = "./pobierz-instalator.html";

  var SNAPSHOT_URL = "./data/guest-snapshot.json";

  var MANIFEST_URL = "./data/guest-cache-manifest.json";



  function isRemotePanel() {

    try {

      var h = (global.location && global.location.hostname) || "";

      if (/synology\.me$/i.test(h) || /inyfinn\./i.test(h)) return true;

      var rt = global.DamRuntime || {};

      var note = String(rt.deploy_note || "");

      if (/Web Station|Panel-DAM|synology/i.test(note)) return true;

      var origin = String(rt.ui_origin || "");

      if (/synology\.me/i.test(origin)) return true;

    } catch (e) { /* ignore */ }

    return false;

  }



  function bridgeOk() {

    return !!(global.DamRuntime && global.DamRuntime.services_ok);

  }



  function shouldActivate() {

    if (bridgeOk()) return false;

    if (global.DAM_FORCE_GUEST) return true;

    return isRemotePanel();

  }



  function injectBanner() {

    if (document.getElementById("damGuestModeBanner")) return;

    var bar = document.createElement("div");

    bar.id = "damGuestModeBanner";

    bar.setAttribute("role", "status");

    bar.style.cssText =

      "position:sticky;top:0;z-index:12050;margin:0;padding:12px 18px;" +

      "background:linear-gradient(90deg,#008244 0%,#AB54DB 100%);color:#fff;" +

      "font:500 14px/1.45 Jost,Segoe UI,sans-serif;display:flex;flex-wrap:wrap;" +

      "align-items:center;gap:12px 20px;box-shadow:0 4px 18px rgba(0,0,0,.12);";

    bar.innerHTML =

      '<span style="flex:1;min-width:200px">' +

      "<strong>Tryb podglądu</strong> — widzisz snapshot bazy i cache miniaturek. " +

      "Bez instalatora nie ma zapisu ani plików z dysku Marketing." +

      "</span>" +

      '<a href="' +

      INSTALLER_URL +

      '" style="color:#fff;background:rgba(255,255,255,.18);padding:8px 16px;border-radius:10px;' +

      'text-decoration:none;font-weight:600;white-space:nowrap">Pobierz instalator DAM</a>';

    var main = document.querySelector(".geex-content") || document.body;

    main.insertBefore(bar, main.firstChild);

    document.documentElement.classList.add("dam-guest-mode");

  }



  function loadSnapshot() {

    return fetch(SNAPSHOT_URL + "?_=" + Date.now(), { cache: "no-store" })

      .then(function (r) {

        if (!r.ok) throw new Error("snapshot_" + r.status);

        return r.json();

      })

      .then(function (snap) {

        global.DAM_GUEST_SNAPSHOT = snap;

        if (snap && snap.file_index) {

          global._DAM_FILE_INDEX = snap.file_index;

        }

        if (snap && snap.branding_index) {

          global._DAM_BRANDING_INDEX = snap.branding_index;

        }

        if (snap && snap.thumb_manifest) {

          global.DAM_THUMB_MANIFEST = snap.thumb_manifest;

        }

        return snap;

      })

      .catch(function () {

        return null;

      });

  }



  function loadThumbManifest() {

    if (

      global.DamPreviewTruth &&

      typeof global.DamPreviewTruth.loadThumbManifest === "function"

    ) {

      return global.DamPreviewTruth.loadThumbManifest(MANIFEST_URL);

    }

    return fetch(MANIFEST_URL + "?_=" + Date.now(), { cache: "no-store" })

      .then(function (r) {

        if (!r.ok) throw new Error("manifest_" + r.status);

        return r.json();

      })

      .then(function (m) {

        global.DAM_THUMB_MANIFEST = m;

        return m;

      })

      .catch(function () {

        return null;

      });

  }



  function blockDestructiveUi() {

    document.addEventListener(

      "click",

      function (e) {

        if (!global.DAM_GUEST_MODE) return;

        var t = e.target && e.target.closest

          ? e.target.closest(

              "[data-viz-assoc-cta],[data-assoc-edit-all],.dam-assoc-quick-minus," +

                "[data-dam-hold-delete],button[type=submit].dam-save"

            )

          : null;

        if (!t) return;

        e.preventDefault();

        e.stopPropagation();

        toastGuest("Zapis wymaga instalatora DAM na tym komputerze.");

      },

      true

    );

  }



  function toastGuest(msg) {

    if (global.DamDanger && typeof global.DamDanger.toast === "function") {

      global.DamDanger.toast(msg);

      return;

    }

    if (global.DamToast && typeof global.DamToast.show === "function") {

      global.DamToast.show(msg);

      return;

    }

    console.warn("[guest]", msg);

  }



  function activate() {

    if (global.DAM_GUEST_MODE) return;

    global.DAM_GUEST_MODE = true;

    injectBanner();

    blockDestructiveUi();

    Promise.all([loadSnapshot(), loadThumbManifest()]).then(function (results) {
      if (global.DamGuestCache && typeof global.DamGuestCache.loadManifest === "function") {
        return global.DamGuestCache.loadManifest().then(function () {
          return results;
        });
      }
      return results;
    }).then(function (results) {

      global.dispatchEvent(

        new CustomEvent("dam:guest-mode-ready", {

          detail: { snapshot: results[0], manifest: results[1] },

        })

      );

    });

  }



  function init() {

    if (!shouldActivate()) return;

    activate();

  }



  if (global.DamRuntime && global.DamRuntime.ready) {

    init();

  } else {

    global.addEventListener("dam-runtime-ready", init);

  }



  global.DamGuestMode = {

    isActive: function () {

      return !!global.DAM_GUEST_MODE;

    },

    activate: activate,

    loadSnapshot: loadSnapshot,

    loadThumbManifest: loadThumbManifest,

  };

})(window);

