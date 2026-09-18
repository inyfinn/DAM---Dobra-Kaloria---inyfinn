/**
 * DAM — aktualizacje aplikacji, wzorzec Inyfinn Photo Resizer.
 * Spokojny dymek stanu w lewym dolnym rogu (bez paska na górze 21 stron).
 * Zero innerHTML dla danych zmiennych - tylko textContent/createElement.
 */
(function (global) {
  "use strict";

  var POLL_ACTIVE_MS = 2000;
  var POLL_IDLE_MS = 60000;
  var SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];
  var SPINNER_TICK_MS = 180;

  var SS_TOAST_LATER = "dam_update_toast_later";
  var SS_TOAST_SHOWN = "dam_update_toast_shown_ready";
  var SS_SUCCESS_CHECKED = "dam_update_success_checked";
  var RELOAD_KEY = "dam_version_reload_ts";

  var CANONICAL_VER = /^\d+\.\d+\.\d+$/;

  var pollTimer = null;
  var manualCheckActive = false;
  var spinnerTimer = null;
  var spinnerIdx = 0;
  var lastState = null;
  var installBusy = false;
  var confirmOverlayEl = null;
  var confirmReturnFocusEl = null;
  var errorHintTimer = null;
  var checkResultTimer = null;
  var toastAutoHideTimer = null;

  function isCanonicalVer(v) {
    return CANONICAL_VER.test(String(v || "").replace(/^v/i, "").trim());
  }

  function versionInt(v) {
    var s = String(v || "").replace(/^v/i, "").trim();
    if (!isCanonicalVer(s)) return -1;
    return parseInt(s.replace(/\./g, ""), 10) || 0;
  }

  function cmpVer(a, b) {
    var ai = versionInt(a);
    var bi = versionInt(b);
    if (ai >= 0 && bi >= 0) {
      if (ai > bi) return 1;
      if (ai < bi) return -1;
      return 0;
    }
    if (ai < 0 && bi >= 0) return -1;
    if (bi < 0 && ai >= 0) return 1;
    return 0;
  }

  function tr(key, fallback, vars) {
    var s = fallback;
    if (global.DamI18n && typeof global.DamI18n.t === "function") {
      var v = global.DamI18n.t(key);
      if (v && v !== key) s = v;
    }
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = String(s).split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  function isSigninPage() {
    var path = String((location && location.pathname) || "");
    return /signin/i.test(path);
  }

  function isLoggedIn() {
    try {
      var token = localStorage.getItem("dam_token") || "";
      if (!token || token === "demo-admin-dev-token" || token === "qa") return false;
      return true;
    } catch (_e) {
      return false;
    }
  }

  function prefersReducedMotion() {
    try {
      return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_e) {
      return false;
    }
  }

  function bridgeUrl() {
    if (global.DamRuntime && typeof global.DamRuntime.bridgeUrl === "function") {
      return String(global.DamRuntime.bridgeUrl()).replace(/\/$/, "");
    }
    if (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function") {
      return String(global.DamPaths.bridgeUrl()).replace(/\/$/, "");
    }
    if (global.DamBridgeUrl && typeof global.DamBridgeUrl.resolve === "function") {
      return global.DamBridgeUrl.resolve();
    }
    return "http://127.0.0.1:8766";
  }

  function authHeaders() {
    var headers = { "Content-Type": "application/json", Accept: "application/json" };
    try {
      if (global.DamApi && typeof global.DamApi.authHeaders === "function") {
        var ah = global.DamApi.authHeaders();
        if (ah && ah.Authorization) headers.Authorization = ah.Authorization;
      } else {
        var t = localStorage.getItem("dam_token") || "";
        if (t) headers.Authorization = "Bearer " + t;
      }
    } catch (_e) {
      /* ignore */
    }
    return headers;
  }

  function safeSessionGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (_e) {
      return null;
    }
  }

  function safeSessionSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (_e) {
      /* ignore */
    }
  }

  function fmtMb(bytes) {
    var n = Number(bytes) || 0;
    return Math.round((n / (1024 * 1024)) * 10) / 10;
  }

  function formatDownloading(target, pct, bytes, total) {
    var mbR = fmtMb(bytes);
    var mbT = fmtMb(total);
    var pctVal = typeof pct === "number" ? pct : (total > 0 ? Math.min(100, Math.round((bytes * 100) / total)) : 0);
    return tr(
      "update.downloading_progress",
      "Pobieranie aktualizacji do v{target}… {pct}% ({recv}/{tot} MB)",
      { target: target || "?", pct: pctVal, recv: mbR, tot: mbT }
    );
  }

  /* ------------------------------------------------------------------ */
  /* Mount points - fixed w viewport, nie w .geex-main-content           */
  /* ------------------------------------------------------------------ */

  function ensureChip() {
    var el = document.getElementById("damUpdateChip");
    if (el) return el;
    el = document.createElement("div");
    el.id = "damUpdateChip";
    el.className = "dam-update-chip";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;

    var spinner = document.createElement("span");
    spinner.className = "dam-update-chip__spinner";
    spinner.setAttribute("aria-hidden", "true");
    spinner.textContent = SPINNER_FRAMES[0];

    var label = document.createElement("span");
    label.className = "dam-update-chip__label";

    var actions = document.createElement("span");
    actions.className = "dam-update-chip__actions";

    el.appendChild(spinner);
    el.appendChild(label);
    el.appendChild(actions);
    document.body.appendChild(el);
    return el;
  }

  function chipParts() {
    var el = ensureChip();
    return {
      root: el,
      spinner: el.querySelector(".dam-update-chip__spinner"),
      label: el.querySelector(".dam-update-chip__label"),
      actions: el.querySelector(".dam-update-chip__actions"),
    };
  }

  function ensureToast() {
    var el = document.getElementById("damUpdateToast");
    if (el) return el;
    el = document.createElement("div");
    el.id = "damUpdateToast";
    el.className = "dam-update-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  }

  function hideToast() {
    var el = document.getElementById("damUpdateToast");
    if (el) {
      el.hidden = true;
      el.textContent = "";
    }
    if (toastAutoHideTimer) {
      clearTimeout(toastAutoHideTimer);
      toastAutoHideTimer = null;
    }
    repositionToast();
  }

  function repositionToast() {
    var toast = document.getElementById("damUpdateToast");
    var chip = document.getElementById("damUpdateChip");
    if (!toast || toast.hidden) return;
    var chipVisible = chip && !chip.hidden;
    var offset = 16;
    if (chipVisible) {
      offset = 16 + chip.getBoundingClientRect().height + 12;
    }
    toast.style.bottom = offset + "px";
  }

  /* ------------------------------------------------------------------ */
  /* Spinner (statyczny gdy prefers-reduced-motion)                      */
  /* ------------------------------------------------------------------ */

  function startSpinner(spinnerEl) {
    if (!spinnerEl) return;
    spinnerEl.hidden = false;
    if (prefersReducedMotion()) {
      spinnerEl.textContent = SPINNER_FRAMES[0];
      return;
    }
    if (spinnerTimer) return;
    spinnerIdx = 0;
    spinnerEl.textContent = SPINNER_FRAMES[0];
    spinnerTimer = setInterval(function () {
      spinnerIdx = (spinnerIdx + 1) % SPINNER_FRAMES.length;
      var live = document.querySelector(".dam-update-chip__spinner");
      if (live) live.textContent = SPINNER_FRAMES[spinnerIdx];
    }, SPINNER_TICK_MS);
  }

  function stopSpinner(spinnerEl) {
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
    }
    if (spinnerEl) spinnerEl.hidden = true;
  }

  /* ------------------------------------------------------------------ */
  /* Chip render                                                         */
  /* ------------------------------------------------------------------ */

  function hideChip() {
    var parts = chipParts();
    parts.root.hidden = true;
    stopSpinner(parts.spinner);
    parts.actions.textContent = "";
    repositionToast();
  }

  function clearErrorHintTimer() {
    if (errorHintTimer) {
      clearTimeout(errorHintTimer);
      errorHintTimer = null;
    }
  }

  function makeChipButton(text, ariaLabel, onClick, variant) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dam-update-chip__btn" + (variant ? " dam-update-chip__btn--" + variant : "");
    btn.textContent = text;
    if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderChipChecking() {
    var parts = chipParts();
    parts.root.hidden = false;
    startSpinner(parts.spinner);
    parts.label.textContent = tr("update.checking_chip", "Sprawdzanie nowej wersji…");
    parts.actions.textContent = "";
    repositionToast();
  }

  function renderChipDownloading(state) {
    var parts = chipParts();
    parts.root.hidden = false;
    startSpinner(parts.spinner);
    parts.label.textContent = formatDownloading(state.target, state.pct, state.bytes, state.total);
    parts.actions.textContent = "";
    parts.actions.appendChild(
      makeChipButton(
        "✕",
        tr("update.cancel_aria", "Anuluj pobieranie aktualizacji"),
        function () {
          cancelDownload();
        },
        "cancel"
      )
    );
    repositionToast();
  }

  function renderChipVerifying() {
    var parts = chipParts();
    parts.root.hidden = false;
    startSpinner(parts.spinner);
    parts.label.textContent = tr("update.verifying", "Sprawdzanie podpisu aktualizacji…");
    parts.actions.textContent = "";
    repositionToast();
  }

  function renderChipReady(state) {
    var parts = chipParts();
    parts.root.hidden = false;
    stopSpinner(parts.spinner);
    parts.label.textContent = tr("update.ready_chip", "Gotowa aktualizacja do v{target}", {
      target: state.target || "?",
    });
    parts.actions.textContent = "";
    parts.actions.appendChild(
      makeChipButton(
        tr("update.install_btn", "Zainstaluj"),
        null,
        function (ev) {
          openConfirmDialog(state, ev.currentTarget);
        },
        "install"
      )
    );
    repositionToast();
  }

  function renderChipTransient(text, ms) {
    var parts = chipParts();
    parts.root.hidden = false;
    stopSpinner(parts.spinner);
    parts.label.textContent = text;
    parts.actions.textContent = "";
    repositionToast();
    clearErrorHintTimer();
    if (ms) {
      errorHintTimer = setTimeout(function () {
        if (!manualCheckActive) hideChip();
      }, ms);
    }
  }

  function renderChipInstalling() {
    var parts = chipParts();
    parts.root.hidden = false;
    stopSpinner(parts.spinner);
    parts.label.textContent = tr("update.installing", "Instalowanie… aplikacja uruchomi się ponownie");
    parts.actions.textContent = "";
    repositionToast();
  }

  /* ------------------------------------------------------------------ */
  /* Toast: "Zainstaluj / Później" (pierwsze wejście w ready)            */
  /* ------------------------------------------------------------------ */

  function buildToastShell(titleText) {
    var el = ensureToast();
    el.textContent = "";
    el.hidden = false;

    var title = document.createElement("div");
    title.className = "dam-update-toast__title";
    title.textContent = titleText;
    el.appendChild(title);

    var body = document.createElement("div");
    body.className = "dam-update-toast__body";
    el.appendChild(body);

    var actions = document.createElement("div");
    actions.className = "dam-update-toast__actions";
    el.appendChild(actions);

    return { root: el, title: title, body: body, actions: actions };
  }

  function makeToastButton(text, variant, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dam-update-toast__btn" + (variant ? " dam-update-toast__btn--" + variant : "");
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function showReadyToast(state) {
    if (safeSessionGet(SS_TOAST_LATER) === "1") return;
    if (safeSessionGet(SS_TOAST_SHOWN) === String(state.target || "")) return;
    safeSessionSet(SS_TOAST_SHOWN, String(state.target || ""));

    var parts = buildToastShell(tr("update.toast_title", "Aktualizacja do nowej wersji"));
    parts.body.textContent = tr(
      "update.toast_body",
      "Nowa wersja {target} jest pobrana i gotowa do instalacji. Zainstalować teraz?",
      { target: state.target || "?" }
    );
    parts.actions.appendChild(
      makeToastButton(tr("update.install_btn", "Zainstaluj"), "primary", function (ev) {
        hideToast();
        openConfirmDialog(state, ev.currentTarget);
      })
    );
    parts.actions.appendChild(
      makeToastButton(tr("update.later_btn", "Później"), "ghost", function () {
        safeSessionSet(SS_TOAST_LATER, "1");
        hideToast();
      })
    );
    repositionToast();
  }

  function showSuccessToast(version) {
    var parts = buildToastShell(tr("update.success_title", "Udana aktualizacja"));
    parts.body.textContent = tr("update.success_body", "Udało się zaktualizować do wersji {version}", {
      version: version || "?",
    });
    parts.actions.appendChild(
      makeToastButton(tr("update.ok_btn", "OK"), "primary", function () {
        hideToast();
      })
    );
    repositionToast();
    toastAutoHideTimer = setTimeout(hideToast, 12000);
  }

  /* ------------------------------------------------------------------ */
  /* Modal potwierdzenia instalacji - focus trap, Esc, brak autofocus    */
  /* ------------------------------------------------------------------ */

  function getFocusableIn(root) {
    var sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(root.querySelectorAll(sel)).filter(function (n) {
      return !n.disabled && n.offsetParent !== null;
    });
  }

  function closeConfirmDialog() {
    if (!confirmOverlayEl) return;
    confirmOverlayEl.removeEventListener("keydown", onConfirmKeydown);
    if (confirmOverlayEl.parentNode) confirmOverlayEl.parentNode.removeChild(confirmOverlayEl);
    confirmOverlayEl = null;
    if (confirmReturnFocusEl && typeof confirmReturnFocusEl.focus === "function") {
      try {
        confirmReturnFocusEl.focus();
      } catch (_e) {
        /* ignore */
      }
    }
    confirmReturnFocusEl = null;
  }

  function onConfirmKeydown(ev) {
    if (ev.key === "Escape") {
      ev.preventDefault();
      closeConfirmDialog();
      return;
    }
    if (ev.key !== "Tab" || !confirmOverlayEl) return;
    var focusables = getFocusableIn(confirmOverlayEl);
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  function openConfirmDialog(state, triggerEl) {
    if (confirmOverlayEl) return;
    confirmReturnFocusEl = triggerEl || document.activeElement;

    var overlay = document.createElement("div");
    overlay.className = "dam-update-confirm-overlay";

    var dialog = document.createElement("div");
    dialog.className = "dam-update-confirm-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "damUpdateConfirmTitle");

    var title = document.createElement("h2");
    title.id = "damUpdateConfirmTitle";
    title.className = "dam-update-confirm-dialog__title";
    title.textContent = tr("update.confirm_title", "Potwierdzenie aktualizacji");

    var body = document.createElement("p");
    body.className = "dam-update-confirm-dialog__body";
    var current = state.current || global.DAM_APP_VERSION || "?";
    var target = state.target || "?";
    body.textContent = tr(
      "update.confirm_body",
      "Czy zainstalować aktualizację z wersji {current} do wersji {target}? Aplikacja zamknie się i uruchomi ponownie.",
      { current: current, target: target }
    );

    var actions = document.createElement("div");
    actions.className = "dam-update-confirm-dialog__actions";

    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "dam-update-confirm-dialog__btn dam-update-confirm-dialog__btn--ghost";
    cancelBtn.textContent = tr("update.confirm_cancel", "Anuluj");
    cancelBtn.addEventListener("click", closeConfirmDialog);

    var confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "dam-update-confirm-dialog__btn dam-update-confirm-dialog__btn--primary";
    confirmBtn.textContent = tr("update.confirm_install", "Zainstaluj i uruchom ponownie");
    confirmBtn.addEventListener("click", function () {
      closeConfirmDialog();
      installNow();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(title);
    dialog.appendChild(body);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    confirmOverlayEl = overlay;
    overlay.addEventListener("keydown", onConfirmKeydown);

    overlay.addEventListener("mousedown", function (ev) {
      if (ev.target === overlay) closeConfirmDialog();
    });

    try {
      cancelBtn.focus();
    } catch (_e) {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------ */
  /* Akcje mostu                                                        */
  /* ------------------------------------------------------------------ */

  function applyAction(action) {
    return fetch(bridgeUrl() + "/app-update/apply", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: action }),
    }).then(function (r) {
      return r.json();
    });
  }

  function cancelDownload() {
    applyAction("cancel")
      .then(function () {
        pollStatus();
      })
      .catch(function (err) {
        console.warn("[DamAppUpdate] cancel failed", err);
        pollStatus();
      });
  }

  function installNow() {
    if (installBusy) return;
    installBusy = true;
    renderChipInstalling();
    applyAction("install")
      .then(function (res) {
        installBusy = false;
        if (res && res.ok !== false) {
          renderChipInstalling();
          return;
        }
        var msg = (res && res.error) || tr("update.install_failed", "Instalacja nie powiodła się.");
        renderChipTransient(msg, 8000);
      })
      .catch(function (err) {
        installBusy = false;
        console.warn("[DamAppUpdate] install failed", err);
        renderChipTransient(tr("update.install_failed", "Instalacja nie powiodła się."), 8000);
      });
  }

  /* ------------------------------------------------------------------ */
  /* Poll /app-update/status                                            */
  /* ------------------------------------------------------------------ */

  function schedulePoll(ms) {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(pollStatus, ms);
  }

  function pollStatus() {
    if (isSigninPage() || !isLoggedIn()) {
      schedulePoll(POLL_IDLE_MS);
      return;
    }
    fetch(bridgeUrl() + "/app-update/status", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        applyState(data && data.ok !== false ? data : null);
      })
      .catch(function (err) {
        console.warn("[DamAppUpdate] status poll failed", err);
        applyState(null);
      });
  }

  function applyState(state) {
    lastState = state;
    if (installBusy) {
      schedulePoll(POLL_ACTIVE_MS);
      return;
    }
    if (!state || !state.status || state.status === "idle") {
      if (!manualCheckActive) hideChip();
      schedulePoll(POLL_IDLE_MS);
      return;
    }

    switch (state.status) {
      case "checking":
        if (manualCheckActive) {
          renderChipChecking();
        } else {
          hideChip();
        }
        schedulePoll(POLL_ACTIVE_MS);
        break;
      case "downloading":
        renderChipDownloading(state);
        schedulePoll(POLL_ACTIVE_MS);
        break;
      case "verifying":
        renderChipVerifying();
        schedulePoll(POLL_ACTIVE_MS);
        break;
      case "ready":
        renderChipReady(state);
        showReadyToast(state);
        schedulePoll(POLL_IDLE_MS);
        break;
      case "error":
        if (state.error) console.warn("[DamAppUpdate] update error:", state.error);
        if (!manualCheckActive) hideChip();
        schedulePoll(POLL_IDLE_MS);
        break;
      default:
        if (!manualCheckActive) hideChip();
        schedulePoll(POLL_IDLE_MS);
    }
  }

  function startPolling() {
    pollStatus();
  }

  /* ------------------------------------------------------------------ */
  /* Sprawdzanie reczne z menu (dam-shell.js) - API zachowane            */
  /* ------------------------------------------------------------------ */

  function runForcedCheck() {
    manualCheckActive = true;
    renderChipChecking();
    return fetch(bridgeUrl() + "/app-update/check?force=1", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        manualCheckActive = false;
        var cur = String((data && data.current) || global.DAM_APP_VERSION || "?");
        if (!data || data.ok === false) {
          renderChipTransient(tr("update.check_failed", "Nie udało się sprawdzić aktualizacji"), 7000);
        } else if (data.update_available) {
          renderChipTransient(
            tr("update.available_short", "Dostępna jest nowsza wersja ({latest})", {
              latest: data.latest || "?",
            }),
            5000
          );
          pollStatus();
        } else {
          renderChipTransient(
            tr("update.already_latest", "Masz najnowszą wersję ({current})", { current: cur }),
            7000
          );
        }
        return data;
      })
      .catch(function (err) {
        manualCheckActive = false;
        console.warn("[DamAppUpdate] force check failed", err);
        renderChipTransient(tr("update.check_failed", "Nie udało się sprawdzić aktualizacji"), 7000);
        return null;
      });
  }

  function checkFromMenu() {
    if (isSigninPage() || !isLoggedIn()) return Promise.resolve(null);
    return runForcedCheck();
  }

  function checkRemote(force) {
    if (isSigninPage() || !isLoggedIn()) return Promise.resolve(null);
    if (force) return runForcedCheck();
    pollStatus();
    return Promise.resolve(lastState);
  }

  /* ------------------------------------------------------------------ */
  /* Sukces po restarcie (jednorazowo per start)                        */
  /* ------------------------------------------------------------------ */

  function maybeShowSuccessToast() {
    if (isSigninPage() || !isLoggedIn()) return;
    if (safeSessionGet(SS_SUCCESS_CHECKED) === "1") return;
    safeSessionSet(SS_SUCCESS_CHECKED, "1");
    fetch(bridgeUrl() + "/app-update/success", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.ok !== false && data.version) {
          showSuccessToast(data.version);
        }
      })
      .catch(function (err) {
        console.warn("[DamAppUpdate] success check failed", err);
      });
  }

  /* ------------------------------------------------------------------ */
  /* Lokalny build vs GitHub - hard reload jesli dysk ma nowszy build    */
  /* (logika reload zostaje; wizual przeniesiony do dolnego dymka)       */
  /* ------------------------------------------------------------------ */

  function setVersionPill(text) {
    if (global.DamVersion && typeof global.DamVersion.setSidebarLabel === "function") {
      global.DamVersion.setSidebarLabel(text);
      return;
    }
    if (global.DamVersion && typeof global.DamVersion.hideFloatingPill === "function") {
      global.DamVersion.hideFloatingPill();
    }
    var legacy = document.getElementById("damAppVersionPill");
    if (legacy) {
      legacy.hidden = true;
      legacy.style.display = "none";
    }
  }

  function hardReload(reason) {
    var now = Date.now();
    try {
      var last = parseInt(sessionStorage.getItem(RELOAD_KEY) || "0", 10);
      if (last && now - last < 8000) return;
      sessionStorage.setItem(RELOAD_KEY, String(now));
    } catch (_e) {
      /* ignore */
    }
    renderChipTransient(tr("update.reloading", "Nowa wersja DAM ({reason}). Odświeżam…", { reason: reason }), 2500);
    setTimeout(function () {
      try {
        var u = location.pathname + location.search;
        var h = location.hash || "";
        location.replace(u + (u.indexOf("?") >= 0 ? "&" : "?") + "_damv=" + now + h);
      } catch (e2) {
        location.reload();
      }
    }, 400);
  }

  function syncLocalBuild() {
    var embedded = String(global.DAM_APP_VERSION || "");
    if (!embedded) return Promise.resolve(null);
    return fetch("./version.json?_=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (vj) {
        var disk = vj && vj.version ? String(vj.version) : "";
        setVersionPill("DAM v" + (disk || embedded));
        if (disk && cmpVer(disk, embedded) > 0) {
          hardReload(disk);
          return { reload: true, disk: disk, embedded: embedded };
        }
        return { reload: false, disk: disk || embedded, embedded: embedded };
      })
      .catch(function () {
        setVersionPill("DAM v" + embedded);
        return null;
      });
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  function boot() {
    if (isSigninPage()) return;
    syncLocalBuild().then(function () {
      if (!isLoggedIn()) return;
      startPolling();
      maybeShowSuccessToast();
    });
    global.addEventListener("resize", repositionToast);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.DamAppUpdate = {
    syncLocalBuild: syncLocalBuild,
    checkRemote: checkRemote,
    checkFromMenu: checkFromMenu,
    cmpVer: cmpVer,
    hideBanner: hideChip,
  };
})(typeof window !== "undefined" ? window : globalThis);
