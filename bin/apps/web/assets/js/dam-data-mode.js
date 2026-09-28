/**
 * Tryb danych tego komputera (most: GET/POST /data-mode, data_mode.py).
 * LIVE = katalog z bazy (jak na kazdym komputerze), LOKALNY = tylko to, co jest na ROOT.
 * Przelacznik w stopce panelu bocznego, nad wersja. Po przelaczeniu most przebudowuje
 * (LOKALNY) albo pobiera (LIVE) indeksy; strona odswieza sie po zakonczeniu.
 */
(function () {
  "use strict";

  var POLL_MS = 1500;
  var _mode = "";
  var _busy = false;

  function bridgeBase() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    if (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function") {
      return window.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function tr(key, fallback) {
    if (window.DamI18n && typeof window.DamI18n.t === "function") {
      var v = window.DamI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    var tok =
      (window.DamApi && typeof window.DamApi.token === "function" && window.DamApi.token()) ||
      localStorage.getItem("dam_token") ||
      "";
    if (tok) h.Authorization = "Bearer " + tok;
    return h;
  }

  function ensureCss() {
    if (document.getElementById("damDataModeCss")) return;
    var s = document.createElement("style");
    s.id = "damDataModeCss";
    s.textContent =
      ".dam-data-mode{display:flex;gap:6px;margin:0 0 12px;}" +
      ".dam-data-mode .dam-db-mode-chip{min-height:32px;height:32px;}" +
      ".dam-data-mode.is-busy{opacity:.6;cursor:progress;}";
    document.head.appendChild(s);
  }

  function ensureUi() {
    ensureCss();
    var el = document.getElementById("damDataMode");
    if (el) return el;
    /* Stopka panelu bocznego (nad wersja): w naglowku przy 1440 px brakuje miejsca. */
    var host = document.querySelector(".geex-sidebar__footer");
    if (!host) return null;
    el = document.createElement("div");
    el.id = "damDataMode";
    el.className = "dam-data-mode";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", tr("data_mode.aria", "Źródło danych"));
    el.innerHTML =
      '<button type="button" class="dam-db-mode-chip" data-mode="live" aria-pressed="false" title="' +
      tr("data_mode.live_tip", "Wszystko z bazy danych - ten sam katalog na każdym komputerze") +
      '">LIVE</button>' +
      '<button type="button" class="dam-db-mode-chip" data-mode="local" aria-pressed="false" title="' +
      tr("data_mode.local_tip", "Tylko pliki z ROOT tego komputera, bez danych z bazy") +
      '">' +
      tr("data_mode.local", "LOKALNY") +
      "</button>";
    host.insertBefore(el, host.firstChild);
    el.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-mode]");
      if (!btn || _busy) return;
      var mode = btn.getAttribute("data-mode");
      if (mode !== _mode) switchTo(mode);
    });
    return el;
  }

  function render(mode, busy) {
    var el = ensureUi();
    if (!el) return;
    _mode = mode || _mode;
    el.classList.toggle("is-busy", !!busy);
    el.setAttribute("aria-busy", busy ? "true" : "false");
    var btns = el.querySelectorAll("button[data-mode]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-mode") === _mode ? "true" : "false");
      btns[i].disabled = !!busy;
    }
  }

  function fetchStatus() {
    return fetch(bridgeBase() + "/data-mode", { cache: "no-store" }).then(function (r) {
      return r.json();
    });
  }

  function waitDone() {
    return fetchStatus().then(function (d) {
      if (d && d.switch && d.switch.running) {
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve(waitDone());
          }, POLL_MS);
        });
      }
      return d;
    });
  }

  function notify(msg) {
    if (window.DamToast && typeof window.DamToast.show === "function") window.DamToast.show(msg);
    else window.alert(msg);
  }

  function switchTo(mode) {
    _busy = true;
    render(_mode, true);
    if (window.DamLoader && typeof window.DamLoader.start === "function") {
      window.DamLoader.start(
        mode === "local"
          ? tr("data_mode.loading_local", "Buduję katalog z ROOT…")
          : tr("data_mode.loading_live", "Pobieram katalog z bazy…")
      );
    }
    return fetch(bridgeBase() + "/data-mode", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ mode: mode }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (!d || !d.ok) {
          var err = (d && d.error) || "";
          throw new Error(
            err === "root_unavailable"
              ? tr("data_mode.err_root", "Tryb LOKALNY wymaga pełnego ROOT. Wskaż folder Marketing.")
              : err === "login_required"
                ? tr("data_mode.err_login", "Zaloguj się, aby zmienić źródło danych.")
                : tr("data_mode.err", "Nie udało się przełączyć: ") + err
          );
        }
        render(d.mode, true);
        return waitDone();
      })
      .then(function (d) {
        if (d && d.switch && d.switch.error) {
          notify(tr("data_mode.err", "Nie udało się przełączyć: ") + d.switch.error);
        }
        window.location.reload();
      })
      .catch(function (err) {
        notify(err && err.message ? err.message : String(err));
        _busy = false;
        render(_mode, false);
      })
      .finally(function () {
        if (window.DamLoader && typeof window.DamLoader.done === "function") window.DamLoader.done();
      });
  }

  function start() {
    if (window.location.pathname.indexOf("signin") !== -1) return;
    if (!ensureUi()) return;
    fetchStatus()
      .then(function (d) {
        if (!d || !d.ok) throw new Error("data_mode_status");
        var el = document.getElementById("damDataMode");
        if (el) el.hidden = false;
        var running = !!(d.switch && d.switch.running);
        render(d.mode, running);
        if (running) {
          _busy = true;
          waitDone().then(function () {
            window.location.reload();
          });
        }
      })
      .catch(function () {
        /* Most jeszcze nie wstal (start DAM.exe) albo stara wersja bez /data-mode: ukryj i ponow. */
        var el = document.getElementById("damDataMode");
        if (el) el.hidden = true;
        setTimeout(start, 5000);
      });
  }

  window.DamDataMode = { start: start, switchTo: switchTo };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
