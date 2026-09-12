/**
 * Status bazy danych (obok Pliki online).
 * Pill: online/offline + ikona DB. Klik = panel zrodel (Synology / GitHub / lokalna)
 * + delikatne Odśwież (force reconnect + opcjonalny pull dumpa).
 */
(function () {
  "use strict";

  var POLL_MS = 15000;
  var FULL_STATUS_MS = 60000;
  var _timer = null;
  var _lastFullCheck = 0;
  var _last = null;
  var _pillOnline = false;
  var _panelOpen = false;
  var _draftMode = null;
  var _syncToast = null;
  var _syncTween = null;

  function bridgeBase() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    if (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function") {
      return window.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function loadGsap() {
    return new Promise(function (resolve) {
      if (window.gsap) {
        resolve(window.gsap);
        return;
      }
      var existing = document.querySelector('script[data-dam-gsap="1"]');
      if (existing) {
        if (window.gsap) {
          resolve(window.gsap);
          return;
        }
        existing.addEventListener("load", function () {
          resolve(window.gsap || null);
        });
        existing.addEventListener("error", function () {
          resolve(null);
        });
        return;
      }
      var s = document.createElement("script");
      s.src = "assets/vendor/js/gsap/gsap.min.js?v=5.0.196";
      s.setAttribute("data-dam-gsap", "1");
      s.onload = function () {
        resolve(window.gsap || null);
      };
      s.onerror = function () {
        resolve(null);
      };
      document.head.appendChild(s);
    });
  }

  function ensureSyncToast() {
    if (_syncToast) return _syncToast;
    var el = document.createElement("div");
    el.id = "damDbSyncToast";
    el.className = "dam-db-sync-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML =
      '<div class="dam-db-sync-toast__head">' +
      '<span class="dam-db-sync-toast__title">Odświeżanie bazy</span>' +
      '<span class="dam-db-sync-toast__badge">Synology</span>' +
      "</div>" +
      '<div class="dam-db-sync-toast__track"><span class="dam-db-sync-toast__bar"></span></div>' +
      '<ul class="dam-db-sync-toast__steps"></ul>';
    document.body.appendChild(el);
    _syncToast = el;
    return el;
  }

  function animateSyncToast(open) {
    var el = ensureSyncToast();
    var reduce = prefersReducedMotion();
    if (_syncTween && _syncTween.kill) _syncTween.kill();
    if (!window.gsap || reduce) {
      if (open) {
        el.classList.add("is-open");
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
        el.style.visibility = "visible";
      } else {
        el.classList.remove("is-open");
        el.style.opacity = "";
        el.style.transform = "";
        el.style.visibility = "";
      }
      return Promise.resolve();
    }
    if (open) {
      el.classList.add("is-open");
      return new Promise(function (resolve) {
        _syncTween = window.gsap.fromTo(
          el,
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out", onComplete: resolve }
        );
      });
    }
    return new Promise(function (resolve) {
      _syncTween = window.gsap.to(el, {
        autoAlpha: 0,
        y: 10,
        duration: 0.22,
        ease: "power1.in",
        onComplete: function () {
          el.classList.remove("is-open");
          resolve();
        },
      });
    });
  }

  function setSyncProgress(ratio) {
    var el = ensureSyncToast();
    var bar = el.querySelector(".dam-db-sync-toast__bar");
    if (!bar) return;
    var pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
    if (window.gsap && !prefersReducedMotion()) {
      window.gsap.to(bar, { width: pct + "%", duration: 0.35, ease: "power1.out" });
    } else {
      bar.style.width = pct + "%";
    }
  }

  function renderSyncSteps(steps) {
    var el = ensureSyncToast();
    var list = el.querySelector(".dam-db-sync-toast__steps");
    if (!list) return;
    list.innerHTML = steps
      .map(function (step) {
        var cls = "dam-db-sync-toast__step";
        if (step.status === "active") cls += " is-active";
        if (step.status === "done") cls += " is-done";
        if (step.status === "error") cls += " is-error";
        return (
          '<li class="' +
          cls +
          '" data-step="' +
          esc(step.id) +
          '"><span class="dam-db-sync-toast__mark" aria-hidden="true"></span><span>' +
          esc(step.label) +
          "</span></li>"
        );
      })
      .join("");
  }

  function openSyncToast(pullDump) {
    var steps = [
      { id: "bridge", label: "Łączenie z mostem DAM (port 8766)…", status: "active" },
      { id: "postgres", label: "Sprawdzam PostgreSQL na Synology…", status: "pending" },
    ];
    if (pullDump) {
      steps.push({
        id: "dump",
        label: "Synchronizuję dump GitHub/DATABASE (jeśli włączony)…",
        status: "pending",
      });
    }
    steps.push({ id: "apply", label: "Aktualizuję status w panelu…", status: "pending" });
    renderSyncSteps(steps);
    setSyncProgress(0.08);
    return loadGsap().then(function () {
      return animateSyncToast(true);
    });
  }

  function advanceSyncStep(stepId, status, nextId) {
    var el = ensureSyncToast();
    var items = el.querySelectorAll(".dam-db-sync-toast__step");
    items.forEach(function (node) {
      var id = node.getAttribute("data-step");
      if (id === stepId) {
        node.classList.remove("is-active", "is-done", "is-error");
        node.classList.add(
          status === "error" ? "is-error" : status === "done" ? "is-done" : "is-active"
        );
      } else if (nextId && id === nextId) {
        node.classList.add("is-active");
      }
    });
  }

  function closeSyncToast(delayMs) {
    var wait = typeof delayMs === "number" ? delayMs : 1200;
    return new Promise(function (resolve) {
      setTimeout(function () {
        animateSyncToast(false).then(resolve);
      }, wait);
    });
  }

  function authHeaders() {
    var base = { "Content-Type": "application/json" };
    if (window.DamApi && typeof window.DamApi.authHeaders === "function") {
      var ah = window.DamApi.authHeaders() || {};
      if (ah.Authorization) base.Authorization = ah.Authorization;
    } else {
      var tok = localStorage.getItem("dam_token") || "";
      if (tok) base.Authorization = "Bearer " + tok;
    }
    return base;
  }

  function dumpSyncOk(res) {
    if (res && res.dump_sync && res.dump_sync.ok) return true;
    if (res && res.github_dump) return true;
    if (res && res.sources && res.sources.github && res.sources.github.configured) return true;
    return false;
  }

  function ensureSessionForDb() {
    if (window.DamApi && typeof window.DamApi.ensureSession === "function") {
      return window.DamApi.ensureSession().catch(function () {
        return null;
      });
    }
    return Promise.resolve(null);
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
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
      '<span class="dam-db-status__dot" aria-hidden="true"></span>' +
      '<span class="dam-db-status__label">' +
      '<span class="dam-status-line">Baza</span>' +
      '<span class="dam-status-line">…</span>' +
      "</span>" +
      '<button type="button" class="dam-db-status__refresh" id="damDbRefreshBtn" title="Odśwież połączenie z bazą teraz" data-dam-tip="Wymusza ponowne połączenie z Synology (bez czekania) i opcjonalnie pobiera dump GitHub/DATABASE." aria-label="Odśwież bazę">' +
      '<i class="uil uil-redo" aria-hidden="true"></i>' +
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
    var syn = sources.synology || {};
    var gh = sources.github || {};
    var loc = sources.local || {};
    /* Poll statusu nie moze kasowac wyboru pomiedzy kliknieciem radio i Zastosuj. */
    var mode = _draftMode || prefer.mode || "auto";
    var engine = String((data && data.engine) || "");
    var liveActive =
      engine === "postgres"
        ? "synology"
        : engine.indexOf("sqlite") >= 0
          ? "local"
          : "";
    var pathOrHost =
      (data && data.host) ||
      (data && data.path) ||
      (loc.detail || "") ||
      "";
    var synOk = !!syn.active && engine === "postgres";
    var synWanted = mode === "postgres" || mode === "auto";
    var synFail =
      synWanted && !synOk && (!!data.offline_mode || engine.indexOf("sqlite") >= 0);

    var metaBits = [];
    if (engine) metaBits.push(engine);
    if (pathOrHost) metaBits.push(String(pathOrHost));

    panel.innerHTML =
      '<div class="dam-db-panel__head">' +
      "<strong>Silnik bazy</strong>" +
      (metaBits.length
        ? '<span class="dam-db-panel__meta" title="' +
          esc(metaBits.join(" · ")) +
          '">' +
          esc(metaBits.join(" · ")) +
          "</span>"
        : "") +
      "</div>" +
      '<p class="dam-db-panel__hint">Wybierz silnik live: lokalny SQLite albo Postgres na Synology. Dump GitHub to kopia zapasowa — nie silnik.</p>' +
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
      '<div class="dam-db-source' +
      (liveActive === "local" ? " is-active" : "") +
      '">' +
      '<span class="dam-db-source__body">' +
      '<span class="dam-db-source__title">Lokalna (SQLite)' +
      (liveActive === "local" ? ' <em class="dam-db-source__badge">aktywna</em>' : "") +
      "</span>" +
      '<span class="dam-db-source__detail" title="' +
      esc(loc.detail || "bin/DATABASE/dam-local.sqlite") +
      '">' +
      esc(loc.detail || "bin/DATABASE/dam-local.sqlite") +
      "</span>" +
      '<span class="dam-db-source__note">Działa offline. Kanon: bin/DATABASE.</span>' +
      "</span></div>" +
      '<div class="dam-db-source' +
      (synOk ? " is-active" : synFail ? " is-dim" : "") +
      '">' +
      '<span class="dam-db-source__body">' +
      '<span class="dam-db-source__title">Synology (Postgres)' +
      (synOk ? ' <em class="dam-db-source__badge">aktywna</em>' : "") +
      "</span>" +
      '<span class="dam-db-source__detail">' +
      esc(syn.detail || "inyfinn.synology.me:5433") +
      "</span>" +
      (synFail
        ? '<span class="dam-db-source__note">Chwilowo niedostępna — DAM działa na kopii lokalnej.</span>'
        : !syn.configured
          ? '<span class="dam-db-source__note">Baza nie jest jeszcze podłączona.</span>'
          : '<span class="dam-db-source__note">Wspólna baza firmy.</span>') +
      "</span></div>" +
      '<div class="dam-db-source dam-db-source--dump">' +
      '<span class="dam-db-source__body">' +
      '<span class="dam-db-source__title">Kopia zapasowa (dump GitHub)</span>' +
      '<span class="dam-db-source__detail">' +
      esc(gh.detail || "Brak dam_eta_*.sql.gz w bin/DATABASE/") +
      "</span>" +
      '<span class="dam-db-source__note">To nie jest silnik live. Przycisk pobiera dump do bin/DATABASE.</span>' +
      '<button type="button" class="geex-btn geex-btn--sm" id="damDbPullDump">Pobierz dump</button>' +
      "</span></div>" +
      "</div>" +
      (data.offline_hint
        ? '<p class="dam-db-panel__warn">' + esc(data.offline_hint) + "</p>"
        : "") +
      '<div class="dam-db-panel__actions">' +
      '<button type="button" class="geex-btn geex-btn--sm" id="damDbApplyPrefer">Zastosuj tryb</button>' +
      '<button type="button" class="geex-btn geex-btn--sm geex-btn--primary" id="damDbForceRefresh">Odśwież teraz</button>' +
      "</div>";

    var apply = panel.querySelector("#damDbApplyPrefer");
    panel.querySelectorAll('input[name="damDbMode"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) _draftMode = radio.value;
      });
    });
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
        reconnect(false);
      });
    }
    var pull = panel.querySelector("#damDbPullDump");
    if (pull) {
      pull.addEventListener("click", function (e) {
        e.preventDefault();
        reconnect(true);
      });
    }
  }

  function collectPrefer() {
    var panel = document.getElementById("damDbStatusPanel");
    var modeEl = panel && panel.querySelector('input[name="damDbMode"]:checked');
    var mode = modeEl ? modeEl.value : "auto";
    return {
      mode: mode,
      sources: {
        synology: mode !== "sqlite",
        github: true,
        local: true,
      },
    };
  }

  function savePreferFromPanel() {
    var payload = collectPrefer();
    return fetch(bridgeBase() + "/db/prefer", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          body._httpStatus = r.status;
          return body;
        });
      })
      .then(function (res) {
        if (res._httpStatus === 401 || res._httpStatus === 403 || res.error === "admin_required" || res.error === "login_required") {
          toast("Zmiana trybu wymaga konta admina");
          return res;
        }
        if (res.ok === false && res.error) {
          toast("Nie udało się zmienić trybu: " + res.error);
          return res;
        }
        _draftMode = null;
        _last = res;
        applyStatus(res);
        renderPanel(res);
        var eng = res.engine || "?";
        var where = res.host || res.path || "";
        toast("Tryb zapisany → " + eng + (where ? " · " + where : ""));
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
    el.classList.add("is-on");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("is-on");
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
    _draftMode = null;
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
    _draftMode = null;
    _panelOpen = false;
    if (el) el.setAttribute("aria-expanded", "false");
    if (panel) panel.hidden = true;
  }

  function applyStatus(res) {
    if (!res) {
      _pillOnline = false;
      setPill(false, "Baza offline", "Most nie odpowiada");
      try {
        window.dispatchEvent(new CustomEvent("dam:db-status", { detail: { online: false } }));
      } catch (e) { /* ignore */ }
      return;
    }
    var mode = (res.prefer && res.prefer.mode) || "auto";
    var online = res.online !== false && res.ok !== false;
    // Intentional SQLite = lokalna OK, nie czerwona „offline”
    if (mode === "sqlite" && String(res.engine || "").indexOf("sqlite") >= 0) {
      online = true;
    } else if (
      res.offline_mode &&
      mode !== "sqlite" &&
      res.prefer &&
      res.prefer.sources &&
      res.prefer.sources.synology !== false
    ) {
      online = false;
    }
    var label = res.label || (online ? "Baza online" : "Baza offline");
    if (mode === "sqlite" || (online && String(res.engine || "").indexOf("sqlite") >= 0 && !res.offline_mode)) {
      label = "Baza lokalna";
    }
    if (online && res.engine === "postgres") label = "Baza online";
    var detail =
      (res.engine || "") +
      (res.host ? " @ " + res.host : res.path ? " · " + res.path : "") +
      (res.offline_hint ? "\n" + res.offline_hint : "");
    _pillOnline = !!online;
    setPill(online, label, detail);
    try {
      window.dispatchEvent(new CustomEvent("dam:db-status", { detail: { online: !!online, res: res } }));
    } catch (e) { /* ignore */ }
  }

  function applyPing(res) {
    if (!res) {
      _pillOnline = false;
      setPill(false, "Baza offline", "Most nie odpowiada");
      try {
        window.dispatchEvent(new CustomEvent("dam:db-status", { detail: { online: false } }));
      } catch (e) { /* ignore */ }
      return;
    }
    var online = res.ok === true && !res.offline_mode;
    var label = online ? "Baza online" : "Baza offline";
    if (res.engine === "sqlite" && !res.offline_mode) label = "Baza lokalna";
    var detail =
      (res.engine || "") +
      (res.host ? " @ " + res.host : res.path ? " · " + res.path : "") +
      (res.latency_ms != null ? " · " + res.latency_ms + "ms" : "");
    _pillOnline = !!online;
    setPill(online, label, detail);
    try {
      window.dispatchEvent(new CustomEvent("dam:db-status", { detail: { online: !!online, res: res } }));
    } catch (e) { /* ignore */ }
  }

  function checkFull() {
    return fetch(bridgeBase() + "/db/status", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        _last = res;
        _lastFullCheck = Date.now();
        applyStatus(res);
        if (_panelOpen) renderPanel(res);
        return res;
      });
  }

  function check() {
    var needFull = _panelOpen || !_last || Date.now() - _lastFullCheck > FULL_STATUS_MS;
    if (needFull) {
      return checkFull().catch(function () {
        return pingOnly();
      });
    }
    return pingOnly();
  }

  function pingOnly() {
    return fetch(bridgeBase() + "/db/ping", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        if (_last && _last.sources) {
          res.sources = _last.sources;
          res.prefer = _last.prefer;
          res.priority = _last.priority;
        }
        applyPing(res);
        return res;
      })
      .catch(function () {
        if (window.DamRuntime && typeof window.DamRuntime.ensureServices === "function") {
          return window.DamRuntime.ensureServices().then(function (boot) {
            if (boot && boot.ok) return check();
            _last = { ok: false, online: false, label: "Baza offline", engine: "?", sources: {} };
            applyStatus(_last);
            return _last;
          });
        }
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

    var stepIds = ["bridge", "postgres"];
    if (pullDump) stepIds.push("dump");
    stepIds.push("apply");

    return openSyncToast(!!pullDump)
      .then(function () {
        setSyncProgress(0.18);
        return sleep(prefersReducedMotion() ? 0 : 180);
      })
      .then(function () {
        advanceSyncStep("bridge", "done", "postgres");
        setSyncProgress(0.38);
        return sleep(prefersReducedMotion() ? 0 : 160);
      })
      .then(function () {
        return ensureSessionForDb().then(function () {
          return fetch(bridgeBase() + "/db/reconnect", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ pull_dump: !!pullDump }),
          });
        });
      })
      .then(function (r) {
        advanceSyncStep("postgres", "done", pullDump ? "dump" : "apply");
        setSyncProgress(pullDump ? 0.62 : 0.78);
        return r.json().then(function (body) {
          body._httpStatus = r.status;
          return body;
        });
      })
      .then(function (res) {
        var dumpOk = dumpSyncOk(res);
        if (pullDump) {
          advanceSyncStep("dump", dumpOk ? "done" : "error", "apply");
          setSyncProgress(0.88);
        }
        if (res && (res.error === "login_required" || res.error === "admin_required" || res._httpStatus === 401)) {
          var titleAuth = ensureSyncToast().querySelector(".dam-db-sync-toast__title");
          if (titleAuth) titleAuth.textContent = "Wymagane logowanie (odśwież bazę)";
          return closeSyncToast(2400);
        }
        _last = res;
        applyStatus(res);
        if (_panelOpen) renderPanel(res);
        advanceSyncStep("apply", "done");
        setSyncProgress(1);
        var title = ensureSyncToast().querySelector(".dam-db-sync-toast__title");
        if (title) {
          var syncedFresh = res.dump_sync && res.dump_sync.ok && !res.dump_sync.skipped;
          if (res.online === false || res.ok === false) {
            title.textContent = "Baza nadal offline";
          } else if (pullDump && syncedFresh) {
            title.textContent = "Baza online, dump zsynchronizowany";
          } else if (pullDump && dumpOk) {
            title.textContent = "Baza online (dump lokalny gotowy)";
          } else if (pullDump) {
            title.textContent = "Baza online (brak dumpa lokalnego)";
          } else {
            title.textContent = "Połączenie odświeżone";
          }
        }
        return closeSyncToast(res.online === false || res.ok === false ? 2200 : 1600).then(function () {
          return res;
        });
      })
      .catch(function () {
        advanceSyncStep(stepIds[stepIds.length - 2] || "postgres", "error");
        setSyncProgress(1);
        var title = ensureSyncToast().querySelector(".dam-db-sync-toast__title");
        if (title) title.textContent = "Odświeżenie nieudane";
        setPill(false, "Baza offline", "Most nie odpowiada");
        return closeSyncToast(2400);
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
    function go() {
      check();
      if (_timer) clearInterval(_timer);
      _timer = setInterval(check, POLL_MS);
    }
    if (window.DamRuntime && window.DamRuntime.ready) {
      go();
    } else {
      window.addEventListener("dam-runtime-ready", go, { once: true });
    }
    window.addEventListener("dam-runtime-ready", function () {
      check();
    });
    window.addEventListener("dam:bridge-ready", function () {
      check();
    });
  }

  window.DamDbStatus = {
    check: check,
    reconnect: reconnect,
    start: start,
    isOnline: function () {
      return !!_pillOnline;
    },
    allowsMutations: function () {
      return !!_pillOnline;
    },
    last: function () {
      return _last;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
