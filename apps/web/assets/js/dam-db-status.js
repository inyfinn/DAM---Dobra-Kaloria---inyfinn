/**
 * Status bazy danych (obok Pliki online).
 * Pill: online/offline + ikona DB. Klik = panel zrodel (Synology / GitHub / lokalna)
 * + delikatne Odśwież (force reconnect + opcjonalny pull dumpa).
 */
(function () {
  "use strict";

  var POLL_MS = 15000;
  var _timer = null;
  var _last = null;
  var _panelOpen = false;

  function bridgeBase() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    if (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function") {
      return window.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureUi() {
    var host = document.querySelector(".geex-content__header__action") || document.getElementById("damHeaderAction");
    if (!host) return null;
    var el = document.getElementById("damDbStatus");
    if (el) return el;

    el = document.createElement("div");
    el.id = "damDbStatus";
    el.className = "dam-db-status";
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-haspopup", "dialog");
    el.setAttribute("aria-expanded", "false");
    el.innerHTML =
      '<i class="uil uil-database dam-db-status__icon" aria-hidden="true"></i>' +
      '<span class="dam-db-status__dot" aria-hidden="true"></span>' +
      '<span class="dam-db-status__label">' +
      '<span class="dam-status-line">Baza</span>' +
      '<span class="dam-status-line">…</span>' +
      "</span>" +
      '<button type="button" class="dam-db-status__refresh" id="damDbRefreshBtn" title="Odśwież połączenie z bazą teraz" data-dam-tip="Wymusza ponowne połączenie z Synology (bez czekania) i opcjonalnie pobiera dump GitHub/DATABASE." aria-label="Odśwież bazę">' +
      '<i class="uil uil-refresh" aria-hidden="true"></i>' +
      "</button>" +
      '<div class="dam-db-status__panel" id="damDbStatusPanel" hidden role="dialog" aria-label="Źródła bazy danych"></div>';

    var root = document.getElementById("damRootStatus");
    if (root && root.parentNode === host) {
      if (root.nextSibling) host.insertBefore(el, root.nextSibling);
      else host.appendChild(el);
    } else {
      host.insertBefore(el, host.firstChild);
    }

    el.addEventListener("click", function (e) {
      if (e.target.closest("#damDbRefreshBtn")) return;
      if (e.target.closest("#damDbStatusPanel")) return;
      togglePanel();
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        togglePanel();
      } else if (e.key === "Escape") {
        closePanel();
      }
    });

    var refreshBtn = el.querySelector("#damDbRefreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        reconnect(true);
      });
    }

    document.addEventListener("click", function (e) {
      if (!_panelOpen) return;
      if (!el.contains(e.target)) closePanel();
    });

    return el;
  }

  function setPill(online, label, detail) {
    var el = ensureUi();
    if (!el) return;
    el.classList.toggle("is-offline", !online);
    el.classList.toggle("is-online", !!online);
    el.title = detail || label || "Status bazy";
    var lab = el.querySelector(".dam-db-status__label");
    if (lab) {
      var raw = String(label || (online ? "Baza online" : "Baza offline")).trim();
      var parts = raw.split(/\s+/);
      var line1 = parts[0] || "Baza";
      var line2 = parts.slice(1).join(" ") || (online ? "online" : "offline");
      lab.innerHTML =
        '<span class="dam-status-line">' +
        line1 +
        '</span><span class="dam-status-line">' +
        line2 +
        "</span>";
    }
  }

  function renderPanel(data) {
    var panel = document.getElementById("damDbStatusPanel");
    if (!panel) return;
    var sources = (data && data.sources) || {};
    var prefer = (data && data.prefer) || { mode: "auto", sources: {} };
    var order = (data && data.priority) || ["synology", "github", "local"];
    var rows = order
      .map(function (id) {
        var s = sources[id] || {};
        var checked = s.enabled !== false;
        var active = !!s.active;
        var avail = !!s.available;
        return (
          '<label class="dam-db-source' +
          (active ? " is-active" : "") +
          (!avail && id !== "local" ? " is-dim" : "") +
          '">' +
          '<span class="dam-db-check">' +
          '<input type="checkbox" data-source="' +
          esc(id) +
          '"' +
          (checked ? " checked" : "") +
          (id === "local" ? " disabled" : "") +
          " />" +
          '<span class="dam-db-check__box" aria-hidden="true"></span>' +
          "</span>" +
          '<span class="dam-db-source__body">' +
          '<span class="dam-db-source__title">' +
          esc(s.label || id) +
          (active ? ' <em class="dam-db-source__badge">aktywna</em>' : "") +
          "</span>" +
          '<span class="dam-db-source__detail" title="' +
          esc(s.detail || "") +
          '">' +
          esc(s.detail || "") +
          "</span>" +
          (s.note
            ? '<span class="dam-db-source__note" title="' + esc(s.note) + '">' + esc(s.note) + "</span>"
            : "") +
          "</span>" +
          "</label>"
        );
      })
      .join("");

    var mode = prefer.mode || "auto";
    var metaBits = [];
    if (data.engine) metaBits.push(String(data.engine));
    if (data.host) metaBits.push(String(data.host));
    panel.innerHTML =
      '<div class="dam-db-panel__head">' +
      "<strong>Źródła bazy</strong>" +
      (metaBits.length
        ? '<span class="dam-db-panel__meta" title="' +
          esc(metaBits.join(" · ")) +
          '">' +
          esc(metaBits.join(" · ")) +
          "</span>"
        : "") +
      "</div>" +
      '<p class="dam-db-panel__hint">Auto bierze pierwsze działające źródło. Wymuś Synology albo lokalną bazę poniżej.</p>' +
      '<div class="dam-db-panel__mode" role="radiogroup" aria-label="Tryb połączenia">' +
      '<label class="dam-db-mode-chip">' +
      '<input type="radio" name="damDbMode" value="auto"' +
      (mode === "auto" ? " checked" : "") +
      " />" +
      "<span>Auto</span></label>" +
      '<label class="dam-db-mode-chip">' +
      '<input type="radio" name="damDbMode" value="postgres"' +
      (mode === "postgres" ? " checked" : "") +
      " />" +
      "<span>Synology</span></label>" +
      '<label class="dam-db-mode-chip">' +
      '<input type="radio" name="damDbMode" value="sqlite"' +
      (mode === "sqlite" ? " checked" : "") +
      " />" +
      "<span>Lokalna</span></label>" +
      "</div>" +
      '<div class="dam-db-panel__sources">' +
      rows +
      "</div>" +
      (data.offline_hint
        ? '<p class="dam-db-panel__warn">' + esc(data.offline_hint) + "</p>"
        : "") +
      '<div class="dam-db-panel__actions">' +
      '<button type="button" class="geex-btn geex-btn--sm" id="damDbApplyPrefer">Zapisz wybór</button>' +
      '<button type="button" class="geex-btn geex-btn--sm geex-btn--primary" id="damDbForceRefresh">Odśwież teraz</button>' +
      "</div>";

    var apply = panel.querySelector("#damDbApplyPrefer");
    if (apply) {
      apply.addEventListener("click", function (e) {
        e.preventDefault();
        savePreferFromPanel();
      });
    }
    var force = panel.querySelector("#damDbForceRefresh");
    if (force) {
      force.addEventListener("click", function (e) {
        e.preventDefault();
        reconnect(true);
      });
    }
  }

  function collectPrefer() {
    var panel = document.getElementById("damDbStatusPanel");
    var modeEl = panel && panel.querySelector('input[name="damDbMode"]:checked');
    var mode = modeEl ? modeEl.value : "auto";
    var sources = { synology: true, github: true, local: true };
    if (panel) {
      panel.querySelectorAll("input[data-source]").forEach(function (inp) {
        sources[inp.getAttribute("data-source")] = !!inp.checked;
      });
    }
    sources.local = true;
    return { mode: mode, sources: sources };
  }

  function savePreferFromPanel() {
    var payload = collectPrefer();
    return fetch(bridgeBase() + "/db/prefer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        _last = res;
        applyStatus(res);
        renderPanel(res);
        toast("Zapisano źródła bazy");
        return res;
      })
      .catch(function () {
        toast("Nie udało się zapisać (most offline?)");
      });
  }

  function toast(msg) {
    if (window.DamBadges && typeof window.DamBadges.toast === "function") {
      window.DamBadges.toast(msg);
      return;
    }
    var el = document.getElementById("damGlobalToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damGlobalToast";
      el.className = "dam-global-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2800);
  }

  function togglePanel() {
    if (_panelOpen) closePanel();
    else openPanel();
  }

  function openPanel() {
    var el = ensureUi();
    var panel = document.getElementById("damDbStatusPanel");
    if (!el || !panel) return;
    _panelOpen = true;
    el.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    if (_last) renderPanel(_last);
    else check().then(function () {
      if (_last) renderPanel(_last);
    });
  }

  function closePanel() {
    var el = document.getElementById("damDbStatus");
    var panel = document.getElementById("damDbStatusPanel");
    _panelOpen = false;
    if (el) el.setAttribute("aria-expanded", "false");
    if (panel) panel.hidden = true;
  }

  function applyStatus(res) {
    if (!res) {
      setPill(false, "Baza offline", "Most nie odpowiada");
      return;
    }
    var online = res.online !== false && res.ok !== false;
    if (res.offline_mode && res.prefer && res.prefer.sources && res.prefer.sources.synology !== false && res.prefer.mode !== "sqlite") {
      online = false;
    }
    var label = res.label || (online ? "Baza online" : "Baza offline");
    var detail =
      (res.engine || "") +
      (res.host ? " @ " + res.host : res.path ? " · " + res.path : "") +
      (res.offline_hint ? "\n" + res.offline_hint : "");
    setPill(online, label, detail);
  }

  function check() {
    return fetch(bridgeBase() + "/db/status", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        _last = res;
        applyStatus(res);
        if (_panelOpen) renderPanel(res);
        return res;
      })
      .catch(function () {
        _last = { ok: false, online: false, label: "Baza offline", engine: "?", sources: {} };
        applyStatus(_last);
        return _last;
      });
  }

  function reconnect(pullDump) {
    var btn = document.getElementById("damDbRefreshBtn");
    if (btn) {
      btn.classList.add("is-busy");
      btn.disabled = true;
    }
    return fetch(bridgeBase() + "/db/reconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pull_dump: !!pullDump }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        _last = res;
        applyStatus(res);
        if (_panelOpen) renderPanel(res);
        var dumpOk = res.dump_sync && res.dump_sync.ok;
        toast(
          pullDump
            ? dumpOk
              ? "Baza odświeżona + dump pobrany"
              : "Baza odświeżona (dump: " + ((res.dump_sync && res.dump_sync.error) || "pominięty") + ")"
            : "Baza odświeżona"
        );
        return res;
      })
      .catch(function () {
        toast("Odświeżenie nieudane - most offline?");
        setPill(false, "Baza offline", "Most nie odpowiada");
      })
      .finally(function () {
        if (btn) {
          btn.classList.remove("is-busy");
          btn.disabled = false;
        }
      });
  }

  function start() {
    if (window.location.pathname.indexOf("signin") !== -1) return;
    ensureUi();
    check();
    if (_timer) clearInterval(_timer);
    _timer = setInterval(check, POLL_MS);
    window.addEventListener("dam-runtime-ready", function () {
      check();
    });
  }

  window.DamDbStatus = {
    check: check,
    reconnect: reconnect,
    start: start,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
