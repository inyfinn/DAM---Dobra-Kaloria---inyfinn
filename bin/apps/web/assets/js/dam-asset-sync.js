/**
 * DamAssetSync - stan synchronizacji indeksu materialow (faza 2 - scalanie jak
 * Synology Drive), widoczny tylko dla administratora w Ustawieniach.
 *
 * Kontrakt mostu (local_bridge.py :8766, robi worker rownolegle):
 *   GET  /asset-sync/status  -> {"ok":true,"mode":"rows"|"off","last_run":ISO|"",
 *                                 "last_ok":bool,"pulled":int,"pushed":int,
 *                                 "blocked_count":int,"last_scan_time_ms":int,"error":""}
 *   GET  /asset-sync/blocked -> {"ok":true,"items":[{"folder":"...","count":int}]}
 *   POST /asset-sync/confirm {"folder"} -> {"ok":true} (tylko admin;
 *                                 nie-admin -> {"ok":false,"error":"..."})
 *
 * Gdy most jest starszy i nie ma tych tras (404 / brak polaczenia), sekcja
 * pokazuje "Niedostępne w tej wersji mostu" zamiast bledu.
 *
 * Uzycie: settings.html -> DamAssetSync.mountSettings("damAssetSyncBody").
 * Widocznosc calej sekcji (#damAssetSync, atrybut hidden) jest sterowana tutaj
 * po roli z localStorage - jak gateAdminSettingsUi() w dam-settings.js robi to
 * dla #historiaZmian, ale bez dotykania tego pliku (poza zakresem zadania).
 */
(function (w, d) {
  "use strict";

  function bridgeUrl() {
    try {
      if (w.DamRuntime && typeof w.DamRuntime.bridgeUrl === "function") {
        return String(w.DamRuntime.bridgeUrl()).replace(/\/+$/, "");
      }
      if (w.DamPaths && typeof w.DamPaths.bridgeUrl === "function") {
        return String(w.DamPaths.bridgeUrl()).replace(/\/+$/, "");
      }
    } catch (e) {
      /* ignore */
    }
    return "http://127.0.0.1:8766";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c] || c
      );
    });
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json", Accept: "application/json" };
    var t = "";
    try {
      t = localStorage.getItem("dam_token") || "";
    } catch (e) {
      t = "";
    }
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }

  function isAdminRole() {
    var role = "";
    try {
      role =
        (w.DamApi && typeof w.DamApi.role === "function" && w.DamApi.role()) ||
        localStorage.getItem("dam_role") ||
        "";
    } catch (e) {
      role = "";
    }
    return String(role).toLowerCase() === "admin";
  }

  function fetchJson(path, opts) {
    return fetch(bridgeUrl() + path, opts).then(function (r) {
      return r
        .json()
        .catch(function () {
          return null;
        })
        .then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
    });
  }

  /** GET /asset-sync/status - nigdy nie rzuca; 404/brak mostu -> {ok:false,status:...}. */
  function fetchStatus() {
    return fetchJson("/asset-sync/status", { headers: authHeaders(), cache: "no-store" }).catch(function () {
      return { ok: false, status: 0, data: null };
    });
  }

  /** GET /asset-sync/blocked - jak wyzej. */
  function fetchBlocked() {
    return fetchJson("/asset-sync/blocked", { headers: authHeaders(), cache: "no-store" }).catch(function () {
      return { ok: false, status: 0, data: null };
    });
  }

  /** POST /asset-sync/confirm {folder}. */
  function confirmDelete(folder) {
    return fetchJson("/asset-sync/confirm", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ folder: folder }),
    }).then(function (res) {
      return res.data || { ok: false };
    });
  }

  /** Skrot sciezki do ostatnich 2-3 segmentow, pelna wersja w title. */
  function shortFolder(folder) {
    var full = String(folder || "");
    var parts = full.split(/[\\/]+/).filter(Boolean);
    var tail = parts.slice(Math.max(0, parts.length - 3));
    var short = tail.join(" / ");
    return { short: short || full, full: full };
  }

  function fmtDate(iso) {
    if (!iso) return "brak";
    try {
      var t = new Date(iso);
      if (isNaN(t.getTime())) return String(iso);
      return t.toLocaleString("pl-PL");
    } catch (e) {
      return String(iso);
    }
  }

  var MODE_LABEL = {
    rows: "Włączona - dane z bazy",
    off: "Wyłączona - migawki",
  };

  var HELP_TEXT =
    "Gdy z folderu znika naraz ponad 20% plików, usunięcia są wstrzymane - to zwykle chwilowy " +
    "brak dostępu do dysku, a nie prawdziwe usunięcie.";

  /* ------------------------------------------------------------------ */
  /* settings.html - status + lista zablokowanych folderów               */
  /* ------------------------------------------------------------------ */

  function mountSettings(containerId) {
    var container = typeof containerId === "string" ? d.getElementById(containerId) : containerId;
    if (!container) return;
    var section = d.getElementById("damAssetSync");

    function reveal() {
      if (!section) return;
      if (isAdminRole()) {
        section.removeAttribute("hidden");
        section.removeAttribute("aria-hidden");
      } else {
        section.setAttribute("hidden", "");
        section.setAttribute("aria-hidden", "true");
      }
    }

    /** Wlasny filtr wyszukiwania w Ustawieniach (dam-settings.js, initSettingsSearch ->
     * applySettingsVisibility) na starcie zdejmuje "hidden" ze WSZYSTKICH sekcji chip=all,
     * wiec sam atrybut hidden nie jest niezawodna bramka (dotyczy tez #damIpBlocks i
     * #damAssocHistory - te same dwie istniejace sekcje admina maja ten sam efekt). Realna
     * bramka jest tutaj: bez roli administratora nie odpytujemy mostu i nie pokazujemy tresci. */
    function renderRequiresAdmin() {
      container.innerHTML = '<p class="dam-widget__meta">Wymaga roli administratora.</p>';
    }

    function renderUnavailable() {
      container.innerHTML = '<p class="dam-widget__meta">Niedostępne w tej wersji mostu.</p>';
    }

    function renderOffline() {
      container.innerHTML =
        '<p class="dam-widget__meta">Brak połączenia z mostem DAM - stan synchronizacji niedostepny.</p>';
    }

    function renderBlockedList(items) {
      if (!items || !items.length) {
        return '<p class="dam-widget__meta dam-asset-sync__empty">Brak zablokowanych folderów.</p>';
      }
      return (
        '<div class="dam-notify-list dam-asset-sync__blocked">' +
        items
          .map(function (it) {
            var folder = shortFolder(it && it.folder);
            var count = Number(it && it.count) || 0;
            var folderAttr = esc(it && it.folder);
            return (
              '<div class="dam-notify-row dam-asset-sync__blocked-row" data-folder="' +
              folderAttr +
              '">' +
              "<div>" +
              '<p class="dam-sw-row__name" title="' +
              esc(folder.full) +
              '">' +
              esc(folder.short) +
              "</p>" +
              '<p class="dam-sw-row__desc">' +
              count +
              (count === 1 ? " plik" : " plików") +
              "</p>" +
              "</div>" +
              '<button type="button" class="geex-btn geex-btn--sm" data-confirm-delete="' +
              folderAttr +
              '">' +
              '<i class="uil uil-check" aria-hidden="true"></i> Potwierdź usunięcie' +
              "</button>" +
              "</div>"
            );
          })
          .join("") +
        "</div>"
      );
    }

    function wireBlockedButtons() {
      container.querySelectorAll("[data-confirm-delete]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var folder = btn.getAttribute("data-confirm-delete");
          if (
            !w.confirm(
              "Pliki z tego folderu znikną z indeksu na wszystkich komputerach. Potwierdzasz?"
            )
          ) {
            return;
          }
          btn.disabled = true;
          confirmDelete(folder).then(
            function (res) {
              if (!res || !res.ok) {
                btn.disabled = false;
                w.alert((res && res.error) || "Nie udało się potwierdzić usunięcia.");
                return;
              }
              load();
            },
            function () {
              btn.disabled = false;
            }
          );
        });
      });
    }

    function renderStatus(status, blocked) {
      var mode = status && status.mode;
      var modeLabel = MODE_LABEL[mode] || "Nieznany (" + esc(String(mode)) + ")";
      var lastRun = fmtDate(status && status.last_run);
      var lastOk = status && status.last_ok;
      var cycleBadge = lastOk === false ? "błąd" : lastOk === true ? "ok" : "brak danych";
      var pulled = Number(status && status.pulled) || 0;
      var pushed = Number(status && status.pushed) || 0;
      var blockedCount = Number((status && status.blocked_count) || (blocked && blocked.length) || 0);
      var errorLine =
        status && status.error
          ? '<p class="dam-widget__meta dam-asset-sync__error">Błąd: ' + esc(status.error) + "</p>"
          : "";

      container.innerHTML =
        '<div class="dam-asset-sync__summary">' +
        '<p class="dam-sw-row__name">Tryb: ' +
        esc(modeLabel) +
        "</p>" +
        '<p class="dam-widget__meta">Ostatni cykl: ' +
        esc(lastRun) +
        " (" +
        esc(cycleBadge) +
        ")</p>" +
        '<p class="dam-widget__meta">Pobrane: ' +
        pulled +
        " &middot; Wysłane: " +
        pushed +
        "</p>" +
        '<p class="dam-widget__meta">Zablokowane foldery: ' +
        blockedCount +
        "</p>" +
        errorLine +
        "</div>" +
        renderBlockedList(blocked) +
        '<p class="dam-widget__meta dam-asset-sync__help">' +
        esc(HELP_TEXT) +
        "</p>";

      wireBlockedButtons();
    }

    function load() {
      container.innerHTML = '<p class="dam-widget__meta">Wczytywanie...</p>';
      fetchStatus().then(function (statusRes) {
        if (statusRes.status === 404) {
          renderUnavailable();
          return;
        }
        if (!statusRes || !statusRes.ok || !statusRes.data || !statusRes.data.ok) {
          renderOffline();
          return;
        }
        var status = statusRes.data;
        fetchBlocked().then(function (blockedRes) {
          if (blockedRes.status === 404) {
            renderUnavailable();
            return;
          }
          var items =
            blockedRes && blockedRes.ok && blockedRes.data && blockedRes.data.ok
              ? blockedRes.data.items || []
              : [];
          renderStatus(status, items);
        });
      });
    }

    reveal();
    if (isAdminRole()) {
      load();
    } else {
      renderRequiresAdmin();
    }
    return { refresh: load };
  }

  w.DamAssetSync = {
    esc: esc,
    isAdminRole: isAdminRole,
    fetchStatus: fetchStatus,
    fetchBlocked: fetchBlocked,
    confirmDelete: confirmDelete,
    shortFolder: shortFolder,
    mountSettings: mountSettings,
  };
})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : {});
