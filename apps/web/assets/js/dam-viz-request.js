/**
 * DAM ETA - "Zglos zapotrzebowanie" (Faza 5/6, 2026-07-18, P10).
 * Modal z checkboxami kanalow (Email/Teams/Asana/W aplikacji) +
 * Wszystko/Wyczysc/Odwroc + Anuluj/Wyslij. Zapamietuje ostatni wybor.
 * Wpis w panelu (w aplikacji) tworzony ZAWSZE - patrz local_bridge /viz-request.
 */
(function (global) {
  "use strict";

  var CHANNELS = [
    { key: "email", label: "Email", icon: "uil-envelope" },
    { key: "teams", label: "Teams", icon: "uil-comments-alt" },
    { key: "asana", label: "Asana", icon: "uil-clipboard-notes" },
    { key: "app", label: "W aplikacji", icon: "uil-bell" },
  ];
  var STORAGE_KEY = "dam_viz_request_channels";

  function bridgeUrl() {
    return (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function" && global.DamPaths.bridgeUrl()) || "http://127.0.0.1:8766";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function userLabel() {
    try {
      var u = JSON.parse(localStorage.getItem("dam_user") || "null");
      return (u && (u.email || u.name)) || localStorage.getItem("dam_user_name") || "anonim";
    } catch (e) {
      return localStorage.getItem("dam_user_name") || "anonim";
    }
  }

  function loadLastChannels() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (raw && typeof raw === "object") return raw;
    } catch (e) {
      /* ignore */
    }
    return { email: true, teams: false, asana: true, app: true };
  }

  function saveChannels(sel) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
  }

  function showToast(msg) {
    var el = document.getElementById("damVizToast") || document.getElementById("damExplorerToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damVizRequestToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 3600);
  }

  function close() {
    var el = document.getElementById("damVizRequestModal");
    if (el) el.remove();
    document.removeEventListener("keydown", onKey, true);
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  function open(ctx) {
    close();
    var sel = loadLastChannels();

    var html =
      '<div class="dam-viz-request-overlay" id="damVizRequestModal" role="dialog" aria-modal="true" aria-label="Zglos zapotrzebowanie na wizualizacje">' +
      '<div class="dam-viz-request-box">' +
      '<button type="button" class="dam-viz-request-close" id="damVizRequestClose" aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
      '<h4 class="dam-viz-request-title"><i class="uil uil-bell-plus"></i> Zglos zapotrzebowanie na wizualizacje</h4>' +
      '<p class="dam-viz-request-sub">' +
      esc(ctx.productName || "") +
      (ctx.langFull ? " &middot; " + esc(ctx.langFull) : "") +
      (ctx.index ? " &middot; Indeks " + esc(ctx.index) : "") +
      "</p>" +
      '<div class="dam-viz-request-channels">' +
      CHANNELS.map(function (c) {
        return (
          '<label class="dam-viz-request-channel">' +
          '<input type="checkbox" data-channel="' +
          c.key +
          '"' +
          (sel[c.key] ? " checked" : "") +
          ">" +
          '<i class="uil ' +
          c.icon +
          '"></i><span>' +
          esc(c.label) +
          "</span></label>"
        );
      }).join("") +
      "</div>" +
      '<div class="dam-viz-request-bulk">' +
      '<button type="button" data-bulk="all">Wszystko</button>' +
      '<button type="button" data-bulk="clear">Wyczysc</button>' +
      '<button type="button" data-bulk="invert">Odwroc</button>' +
      "</div>" +
      '<div class="dam-viz-request-actions">' +
      '<button type="button" class="geex-btn geex-btn--sm" id="damVizRequestCancel">Anuluj</button>' +
      '<button type="button" class="geex-btn geex-btn--primary geex-btn--sm" id="damVizRequestSend"><i class="uil uil-message"></i><span>Wyslij</span></button>' +
      "</div></div></div>";

    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("damVizRequestModal");

    function currentSelection() {
      var out = {};
      modal.querySelectorAll("[data-channel]").forEach(function (cb) {
        out[cb.getAttribute("data-channel")] = cb.checked;
      });
      return out;
    }

    modal.querySelectorAll("[data-bulk]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-bulk");
        modal.querySelectorAll("[data-channel]").forEach(function (cb) {
          if (mode === "all") cb.checked = true;
          else if (mode === "clear") cb.checked = false;
          else if (mode === "invert") cb.checked = !cb.checked;
        });
      });
    });

    modal.addEventListener("click", function (e) {
      if (e.target === modal) close();
    });
    var closeBtn = document.getElementById("damVizRequestClose");
    var cancelBtn = document.getElementById("damVizRequestCancel");
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (cancelBtn) cancelBtn.addEventListener("click", close);

    var sendBtn = document.getElementById("damVizRequestSend");
    if (sendBtn) {
      sendBtn.addEventListener("click", function () {
        var channels = currentSelection();
        saveChannels(channels);
        sendBtn.disabled = true;
        sendBtn.classList.add("is-loading");
        fetch(bridgeUrl() + "/viz-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: ctx.productId,
            product_name: ctx.productName,
            lang: ctx.lang,
            lang_full: ctx.langFull,
            brand: ctx.brand,
            category: ctx.category,
            carrier_label: ctx.carrierLabel,
            index: ctx.index,
            path: ctx.path,
            channels: channels,
            requested_by: userLabel(),
          }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (res) {
            if (res && res.ok) {
              showToast("Zgloszenie wyslane" + (res.channels_sent ? " (" + res.channels_sent.join(", ") + ")" : "") + ".");
              close();
            } else {
              showToast("Blad zgloszenia: " + ((res && res.error) || "nieznany"));
              sendBtn.disabled = false;
              sendBtn.classList.remove("is-loading");
            }
          })
          .catch(function () {
            showToast("Bridge offline - zgloszenie nie zostalo wyslane.");
            sendBtn.disabled = false;
            sendBtn.classList.remove("is-loading");
          });
      });
    }

    document.addEventListener("keydown", onKey, true);
  }

  global.DamVizRequest = { open: open, close: close };
})(typeof window !== "undefined" ? window : globalThis);
