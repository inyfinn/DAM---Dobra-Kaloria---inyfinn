/**
 * DAM - dam-danger.js
 * Globalny, reuzywalny mechanizm UX dla akcji destrukcyjnych (STREFA H, brief 2026-07-20, pkt 27-32).
 *
 * Doktryna (reel o "przyciskach smierci"):
 *  - Zwykly klik NIE usuwa. Trzeba PRZYTRZYMAC (~550 ms) - wokol przycisku rosnie
 *    ring postepu (SVG circle stroke-dashoffset). Puszczenie przed czasem = reset.
 *  - Zwykly klik = podpowiedz "Przytrzymaj, aby usunac".
 *  - Etykiety czasownikowe ("Usun skojarzenie"), nigdy "Tak"/"OK".
 *  - Czerwony = budzet: kolor destrukcji rezerwowany dla tego mechanizmu.
 *  - Cooldown: opcjonalny toast "Cofnij" (soft-delete) - DamDanger.toastUndo(...).
 *  - Dostepnosc: prefers-reduced-motion => ring bez plynnej animacji, hold nadal wymagany.
 *    Klawiatura (Enter/Spacja) => tryb "uzbrojony" z jawnym labelem + drugie
 *    Enter/Spacja potwierdza (alternatywa dla przytrzymania myszy).
 *
 * API:
 *   window.DamDanger.bind(el, {
 *     onConfirm: fn,        // wywolane po udanym holdzie (obowiazkowe, chyba ze delegacja)
 *     label: "Usun",        // czasownik akcji (do a11y + trybu klawiatury)
 *     hint: "Przytrzymaj, aby usunac",
 *     holdMs: 550,
 *     onCancel: fn          // opcjonalnie: puszczono przed czasem
 *   })
 *   window.DamDanger.unbind(el)
 *   window.DamDanger.toastUndo({ message, actionLabel, onUndo, onCommit, duration })
 *   window.DamDanger.toastAction({ message, actionLabel, onAction, note, duration })
 *   window.DamDanger.isSafeDeleteEnabled()  // DamUserPrefs / default ON
 *
 * Delegacja (bez JS na kazdy przycisk): dodaj atrybut na przycisku i zachowaj
 * jego normalny click handler - DamDanger przejmie gest:
 *   <button data-dam-hold-delete data-dam-label="Usun skojarzenie">...</button>
 *   (opcjonalnie data-dam-hold-ms, data-dam-hint)
 *
 * Preferencja ui.safe_delete (KV /user-prefs): gdy OFF - hold nie uzbraja sie,
 * zwykly klik przechodzi. Krotki klik przy ON = toast z opcja wylaczenia.
 */
(function (global) {
  "use strict";

  var CSS_ID = "damDangerInjectedCss";
  var DEFAULT_HOLD_MS = 300; // brief / reel UX: commitment ~300 ms
  var TAP_HINT_MS = 140; // ponizej tego = czysty "klik" -> pokaz podpowiedz
  var KEY_ARM_MS = 4000; // okno na drugie Enter/Spacja w trybie klawiatury

  function reducedMotion() {
    try {
      return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function isSafeDeleteEnabled() {
    try {
      if (global.DamUserPrefs && typeof DamUserPrefs.isSafeDeleteEnabled === "function") {
        return DamUserPrefs.isSafeDeleteEnabled() !== false;
      }
    } catch (e) { /* ignore */ }
    try {
      var raw = localStorage.getItem("dam_user_prefs");
      if (raw) {
        var p = JSON.parse(raw);
        if (p && "safe_delete" in p) return !!p.safe_delete;
      }
    } catch (e2) { /* ignore */ }
    return true;
  }

  function ensureCss() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      /* ring wrapper - overlay wewnatrz przycisku (przycisk staje sie position:relative) */
      ".dam-danger-ring{position:absolute;inset:-5px;pointer-events:none;z-index:5;",
      "display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .12s ease;}",
      ".dam-danger-ring.is-on{opacity:1;}",
      ".dam-danger-ring svg{width:100%;height:100%;overflow:visible;transform:rotate(-90deg);}",
      ".dam-danger-ring__track{fill:none;stroke:color-mix(in srgb,var(--dam-danger,#ff5b5b) 22%,transparent);}",
      ".dam-danger-ring__bar{fill:none;stroke:var(--dam-danger,#ff5b5b);stroke-linecap:round;",
      "filter:drop-shadow(0 0 4px color-mix(in srgb,var(--dam-danger,#ff5b5b) 55%,transparent));}",
      /* stan trzymania na samym przycisku */
      ".dam-danger-holding{color:var(--dam-danger,#ff5b5b)!important;}",
      ".dam-danger-armed{outline:2px solid var(--dam-danger,#ff5b5b)!important;outline-offset:2px;}",
      /* podpowiedz (bubble) */
      ".dam-danger-hint{position:fixed;z-index:24060;background:var(--dam-dark,#17161e);color:#fff;",
      "padding:6px 11px;border-radius:8px;font-size:12px;line-height:1.3;font-weight:600;",
      "box-shadow:0 8px 24px rgba(23,22,30,.28);pointer-events:none;opacity:0;transform:translateY(4px);",
      "transition:opacity .16s ease,transform .16s ease;max-width:240px;white-space:nowrap;}",
      ".dam-danger-hint.is-on{opacity:1;transform:translateY(0);}",
      ".dam-danger-hint::after{content:'';position:absolute;left:50%;bottom:-5px;width:9px;height:9px;",
      "background:inherit;transform:translateX(-50%) rotate(45deg);border-radius:0 0 2px 0;}",
      /* toast cofnij (soft-delete) */
      ".dam-danger-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);",
      "z-index:24070;display:flex;align-items:center;gap:14px;min-width:280px;max-width:min(92vw,460px);",
      "background:var(--dam-dark,#17161e);color:#fff;padding:12px 14px 12px 16px;border-radius:12px;",
      "box-shadow:0 16px 44px rgba(23,22,30,.34);opacity:0;transition:opacity .2s ease,transform .2s ease;",
      "font-size:13px;line-height:1.35;}",
      ".dam-danger-toast.is-on{opacity:1;transform:translateX(-50%) translateY(0);}",
      ".dam-danger-toast__msg{flex:1 1 auto;min-width:0;font-weight:500;}",
      ".dam-danger-toast__undo{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;",
      "background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.22);",
      "border-radius:8px;padding:6px 12px;font-size:12.5px;font-weight:700;cursor:pointer;",
      "transition:background .14s ease,border-color .14s ease;}",
      ".dam-danger-toast__undo:hover{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.4);}",
      ".dam-danger-toast__undo:focus-visible{outline:2px solid #fff;outline-offset:2px;}",
      ".dam-danger-toast__bar{position:absolute;left:0;bottom:0;height:3px;border-radius:0 0 12px 12px;",
      "background:var(--dam-danger,#ff5b5b);width:100%;transform-origin:left center;}",
      ".dam-danger-toast--action{pointer-events:auto;flex-wrap:wrap;gap:10px 14px;}",
      ".dam-danger-toast__note{flex:1 1 100%;margin:0;font-size:11.5px;font-weight:400;",
      "opacity:.78;line-height:1.35;}",
      /* --- pkt 29: offset destrukcji od slotu Confirm (zwykle prawa / primary) --- */
      ".dam-check-actions [data-dam-hold-delete]{order:-1;margin-right:8px;}",
      ".dam-assoc-edit-popover__opt.is-pinned.dam-danger-holding{",
      "outline:2px solid color-mix(in srgb,var(--dam-danger,#ff5b5b) 55%,transparent);outline-offset:2px;}",
      /* --- pkt 30: red budget - czerwień TYLKO dla destrukcji; reszta -> neutral --- */
      ".dam-modal-x:hover,.dam-lightbox__close:hover,.dam-lightbox__close:focus-visible,",
      ".dam-viz-request-close:hover,.dam-tag-edit-popover__close:hover,",
      ".dam-inbox-hist-conflict__close:hover{",
      "background:color-mix(in srgb,var(--dam-dark,#17161e) 12%,transparent)!important;",
      "color:var(--dam-dark,#17161e)!important;}",
      ".dam-lb-size--missing{",
      "border-color:color-mix(in srgb,#8f8b9f 45%,transparent)!important;",
      "background:rgba(143,139,159,.08)!important;}",
      ".dam-lb-size--missing .dam-lb-size__code,",
      ".dam-lb-size--missing .dam-lb-size__ext,",
      ".dam-lb-size__miss{color:#8f8b9f!important;}",
      ".dam-lb-size--missing .dam-lb-size__tag{",
      "background:rgba(143,139,159,.14)!important;color:#6f6b7c!important;}",
      ".dam-check-brak .dam-check-icon,",
      ".dam-check-brak .dam-check-label,",
      ".dam-check-brak .dam-check-detail{color:#8f8b9f!important;}",
      ".dam-check-brak .dam-check-label{font-weight:600;}",
      ".dam-tag-edit-popover__cancel{",
      "background:rgba(143,139,159,.1)!important;border-color:#c5c2ce!important;color:#5c5868!important;}",
      ".dam-tag-edit-popover__cancel:hover{",
      "background:rgba(143,139,159,.18)!important;border-color:#8f8b9f!important;}",
      ".dam-inbox-hist-item__btn--undo:hover,",
      ".dam-inbox-hist-item__btn--undo:focus-visible{",
      "border-color:#8f8b9f!important;background:rgba(143,139,159,.12)!important;color:#5c5868!important;}",
      ".dam-viz-modal__missing-langs-label,",
      ".dam-viz-badge--lang-missing{color:#8f8b9f!important;}",
      ".dam-viz-badge--lang-missing{",
      "background:rgba(143,139,159,.12)!important;",
      "border-color:color-mix(in srgb,#8f8b9f 30%,transparent)!important;}",
      "@media (prefers-reduced-motion: reduce){",
      ".dam-danger-ring,.dam-danger-hint,.dam-danger-toast{transition:none;}",
      ".dam-danger-ring__bar{filter:none;}",
      ".dam-danger-toast__bar{transition:none;}",
      "}"
    ].join("");
    var style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ---------- podpowiedz ---------- */
  var hintEl = null;
  var hintTimer = null;
  function showHint(anchor, text) {
    ensureCss();
    if (!hintEl) {
      hintEl = document.createElement("div");
      hintEl.className = "dam-danger-hint";
      hintEl.setAttribute("role", "status");
      document.body.appendChild(hintEl);
    }
    hintEl.textContent = text || "Przytrzymaj, aby usunac";
    hintEl.style.visibility = "hidden";
    hintEl.classList.add("is-on");
    var r = anchor.getBoundingClientRect();
    var hb = hintEl.getBoundingClientRect();
    var left = r.left + r.width / 2 - hb.width / 2;
    left = Math.max(8, Math.min(left, global.innerWidth - hb.width - 8));
    var top = r.top - hb.height - 10;
    if (top < 8) top = r.bottom + 10;
    hintEl.style.left = left + "px";
    hintEl.style.top = top + "px";
    hintEl.style.visibility = "visible";
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHint, 1900);
  }
  function hideHint() {
    if (hintEl) hintEl.classList.remove("is-on");
  }

  /* ---------- ring ---------- */
  function makeRing(el) {
    var ring = document.createElement("span");
    ring.className = "dam-danger-ring";
    ring.setAttribute("aria-hidden", "true");
    var r = el.getBoundingClientRect();
    var side = Math.max(r.width, r.height) + 10;
    var radius = side / 2 - 3;
    var circ = 2 * Math.PI * radius;
    ring.innerHTML =
      '<svg viewBox="0 0 ' + side + " " + side + '" width="' + side + '" height="' + side + '">' +
      '<circle class="dam-danger-ring__track" cx="' + side / 2 + '" cy="' + side / 2 + '" r="' + radius + '" stroke-width="3"></circle>' +
      '<circle class="dam-danger-ring__bar" cx="' + side / 2 + '" cy="' + side / 2 + '" r="' + radius + '" stroke-width="3" ' +
      'stroke-dasharray="' + circ + '" stroke-dashoffset="' + circ + '"></circle>' +
      "</svg>";
    ring._bar = ring.querySelector(".dam-danger-ring__bar");
    ring._circ = circ;
    return ring;
  }
  function setRingProgress(ring, p) {
    if (!ring || !ring._bar) return;
    p = Math.max(0, Math.min(1, p));
    ring._bar.setAttribute("stroke-dashoffset", String(ring._circ * (1 - p)));
  }

  /* ---------- rdzen: uzbrojenie elementu ---------- */
  function arm(el, opts) {
    if (!el || el.__damDanger) return;
    opts = opts || {};
    var state = {
      opts: opts,
      holdMs: opts.holdMs || (el.getAttribute && parseInt(el.getAttribute("data-dam-hold-ms"), 10)) || DEFAULT_HOLD_MS,
      label: opts.label || (el.getAttribute && el.getAttribute("data-dam-label")) || "Usun",
      hint: opts.hint || (el.getAttribute && el.getAttribute("data-dam-hint")) || null,
      raf: 0,
      startAt: 0,
      holding: false,
      ring: null,
      keyArmed: false,
      keyTimer: null,
      confirmed: false,
      prevPos: ""
    };
    el.__damDanger = state;

    // a11y: opisz gest
    if (!el.getAttribute("aria-description")) {
      el.setAttribute("aria-description", state.hint || ("Przytrzymaj, aby wykonac: " + state.label));
    }

    function cleanupRing() {
      state.holding = false;
      if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
      el.classList.remove("dam-danger-holding");
      if (state.ring) {
        state.ring.classList.remove("is-on");
        var r = state.ring;
        setTimeout(function () { if (r && r.parentNode) r.parentNode.removeChild(r); }, 140);
        state.ring = null;
      }
      if (state.prevPos !== undefined) {
        el.style.position = state.prevPos;
      }
    }

    function complete() {
      cleanupRing();
      hideHint();
      fireConfirm();
    }

    function fireConfirm() {
      if (typeof state.opts.onConfirm === "function") {
        state.opts.onConfirm.call(el);
        return;
      }
      // delegacja: odpal natywny click z flaga (przepuszcza bloker)
      state.confirmed = true;
      try {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      } finally {
        state.confirmed = false;
      }
    }

    function startHold() {
      if (state.holding) return;
      ensureCss();
      state.holding = true;
      state.startAt = performance.now ? performance.now() : Date.now();
      // przycisk musi byc position:relative aby ring lezal na nim
      var cs = global.getComputedStyle(el);
      state.prevPos = el.style.position || "";
      if (cs.position === "static") el.style.position = "relative";
      state.ring = makeRing(el);
      el.appendChild(state.ring);
      el.classList.add("dam-danger-holding");
      requestAnimationFrame(function () { if (state.ring) state.ring.classList.add("is-on"); });

      if (reducedMotion()) {
        // bez plynnej animacji: ring pelny od razu, hold nadal odmierzany timerem
        setRingProgress(state.ring, 1);
        state.raf = setTimeout(function () {
          if (state.holding) complete();
        }, state.holdMs);
        return;
      }
      var tick = function () {
        if (!state.holding) return;
        var now = performance.now ? performance.now() : Date.now();
        var p = (now - state.startAt) / state.holdMs;
        setRingProgress(state.ring, p);
        if (p >= 1) { complete(); return; }
        state.raf = requestAnimationFrame(tick);
      };
      state.raf = requestAnimationFrame(tick);
    }

    function endHold() {
      if (!state.holding) return;
      var elapsed = (performance.now ? performance.now() : Date.now()) - state.startAt;
      if (reducedMotion() && state.raf) { clearTimeout(state.raf); state.raf = 0; }
      cleanupRing();
      if (elapsed < TAP_HINT_MS) {
        if (typeof state.opts.onTapHint === "function") {
          state.opts.onTapHint.call(el);
        } else if (state.opts.disableSafeDeleteAction !== false) {
          showDisableSafeDeleteToast(
            state.hint || "Spróbuj przytrzymać, by usunąć"
          );
        } else {
          showHint(el, state.hint || ("Przytrzymaj, aby " + state.label.toLowerCase()));
        }
      } else {
        // czesciowy hold - tez podpowiedz, ale krotka
        showHint(el, state.hint || ("Przytrzymaj dłużej, aby " + state.label.toLowerCase()));
        if (typeof state.opts.onCancel === "function") state.opts.onCancel.call(el);
      }
    }

    // --- pointer (mysz + dotyk) ---
    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (!isSafeDeleteEnabled()) return; // zwykly klik przejdzie
      e.preventDefault();
      startHold();
      global.addEventListener("pointerup", onPointerUp, true);
      global.addEventListener("pointercancel", onPointerUp, true);
    }
    function onPointerUp() {
      global.removeEventListener("pointerup", onPointerUp, true);
      global.removeEventListener("pointercancel", onPointerUp, true);
      endHold();
    }

    // --- blokada natywnego click (dopoki nie confirmed) ---
    function onClickCapture(e) {
      if (!isSafeDeleteEnabled()) return;
      if (state.confirmed) return; // przepusc potwierdzone
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    // --- klawiatura: Enter/Spacja -> uzbroj, druga -> potwierdz ---
    function onKeyDown(e) {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (state.keyArmed) {
        clearTimeout(state.keyTimer);
        state.keyArmed = false;
        el.classList.remove("dam-danger-armed");
        restoreLabel();
        fireConfirm();
        return;
      }
      state.keyArmed = true;
      el.classList.add("dam-danger-armed");
      armLabel();
      showHint(el, "Nacisnij ponownie Enter, aby " + state.label.toLowerCase());
      state.keyTimer = setTimeout(function () {
        state.keyArmed = false;
        el.classList.remove("dam-danger-armed");
        restoreLabel();
        hideHint();
      }, KEY_ARM_MS);
    }
    function onBlur() {
      if (state.keyArmed) {
        clearTimeout(state.keyTimer);
        state.keyArmed = false;
        el.classList.remove("dam-danger-armed");
        restoreLabel();
      }
    }
    function armLabel() {
      var lbl = el.querySelector("span");
      if (lbl && !state._prevLabel) {
        state._prevLabel = lbl.textContent;
        lbl.textContent = "Potwierdz: " + state.label;
      }
    }
    function restoreLabel() {
      var lbl = el.querySelector("span");
      if (lbl && state._prevLabel) {
        lbl.textContent = state._prevLabel;
        state._prevLabel = null;
      }
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("keydown", onKeyDown, true);
    el.addEventListener("blur", onBlur);
    el.addEventListener("contextmenu", function (e) { if (state.holding) e.preventDefault(); });

    state._detach = function () {
      cleanupRing();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("keydown", onKeyDown, true);
      el.removeEventListener("blur", onBlur);
      global.removeEventListener("pointerup", onPointerUp, true);
      global.removeEventListener("pointercancel", onPointerUp, true);
    };
  }

  function showDisableSafeDeleteToast(message) {
    return toastAction({
      message: message || "Spróbuj przytrzymać, by usunąć",
      actionLabel: "Wyłącz bezpieczne usuwanie",
      note: "Możesz przywrócić w ustawieniach profilu (Preferencje).",
      duration: 6500,
      onAction: function () {
        if (global.DamUserPrefs && typeof DamUserPrefs.setSafeDelete === "function") {
          DamUserPrefs.setSafeDelete(false);
        } else {
          try {
            localStorage.setItem(
              "dam_user_prefs",
              JSON.stringify({ safe_delete: false })
            );
          } catch (e) { /* ignore */ }
        }
      },
    });
  }

  function toastAction(cfg) {
    ensureCss();
    cfg = cfg || {};
    var duration = cfg.duration || 6500;
    var done = false;
    var el = document.createElement("div");
    el.className = "dam-danger-toast dam-danger-toast--action";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<span class="dam-danger-toast__msg"></span>' +
      '<button type="button" class="dam-danger-toast__undo"></button>' +
      (cfg.note ? '<p class="dam-danger-toast__note"></p>' : "") +
      '<span class="dam-danger-toast__bar" aria-hidden="true"></span>';
    el.querySelector(".dam-danger-toast__msg").textContent =
      cfg.message || "Spróbuj przytrzymać, by usunąć";
    el.querySelector(".dam-danger-toast__undo").textContent =
      cfg.actionLabel || "Akcja";
    if (cfg.note) {
      el.querySelector(".dam-danger-toast__note").textContent = cfg.note;
    }
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      el.classList.add("is-on");
    });

    var bar = el.querySelector(".dam-danger-toast__bar");
    if (bar && !reducedMotion()) {
      bar.style.transition = "transform " + duration + "ms linear";
      requestAnimationFrame(function () {
        bar.style.transform = "scaleX(0)";
      });
    }

    var timer = setTimeout(close, duration);

    function close() {
      if (done && !el.parentNode) return;
      clearTimeout(timer);
      el.classList.remove("is-on");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }
    function runAction() {
      if (done) return;
      done = true;
      close();
      if (typeof cfg.onAction === "function") cfg.onAction();
    }
    el.querySelector(".dam-danger-toast__undo").addEventListener("click", runAction);
    return { close: close, action: runAction };
  }

  function bind(el, opts) {
    if (!el) return;
    ensureCss();
    arm(el, opts || {});
    return el;
  }

  function unbind(el) {
    if (el && el.__damDanger) {
      if (typeof el.__damDanger._detach === "function") el.__damDanger._detach();
      el.__damDanger = null;
    }
  }

  /* ---------- delegacja po atrybucie ----------
   * Lazy-arm przy pierwszym pointerdown. Listener elementu (dodany w arm)
   * odpali sie jeszcze w tym samym zdarzeniu (faza target > faza capture
   * dokumentu), wiec hold startuje naturalnie - bez recznego re-dispatch.
   * onConfirm pozostaje null => complete() odpali natywny click z flaga,
   * co przepusci istniejacy handler aplikacji przez bloker.
   */
  function onDocPointerDown(e) {
    if (!isSafeDeleteEnabled()) return;
    var el = e.target && e.target.closest && e.target.closest("[data-dam-hold-delete]");
    if (!el || el.__damDanger) return;
    arm(el, {
      hint: el.getAttribute("data-dam-hint") || "Spróbuj przytrzymać, by usunąć",
      holdMs: parseInt(el.getAttribute("data-dam-hold-ms"), 10) || undefined,
      label: el.getAttribute("data-dam-label") || "Usuń",
    });
  }

  /* ---------- toast "Cofnij" (soft-delete / cooldown) ---------- */
  function toastUndo(cfg) {
    ensureCss();
    cfg = cfg || {};
    var duration = cfg.duration || 6500;
    var committed = false;
    var el = document.createElement("div");
    el.className = "dam-danger-toast";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<span class="dam-danger-toast__msg"></span>' +
      '<button type="button" class="dam-danger-toast__undo"><i class="uil uil-corner-up-left" aria-hidden="true"></i>' +
      "<span>" + (cfg.actionLabel || "Cofnij") + "</span></button>" +
      '<span class="dam-danger-toast__bar" aria-hidden="true"></span>';
    el.querySelector(".dam-danger-toast__msg").textContent = cfg.message || "Usunieto";
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("is-on"); });

    var bar = el.querySelector(".dam-danger-toast__bar");
    if (bar && !reducedMotion()) {
      bar.style.transition = "transform " + duration + "ms linear";
      requestAnimationFrame(function () { bar.style.transform = "scaleX(0)"; });
    }

    var timer = setTimeout(commit, duration);

    function close() {
      clearTimeout(timer);
      el.classList.remove("is-on");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }
    function commit() {
      if (committed) return;
      committed = true;
      close();
      if (typeof cfg.onCommit === "function") cfg.onCommit();
    }
    function undo() {
      if (committed) return;
      committed = true;
      close();
      if (typeof cfg.onUndo === "function") cfg.onUndo();
    }
    el.querySelector(".dam-danger-toast__undo").addEventListener("click", undo);
    return { commit: commit, undo: undo, close: close };
  }

  if (document.addEventListener) {
    document.addEventListener("pointerdown", onDocPointerDown, true);
  }

  global.DamDanger = {
    bind: bind,
    unbind: unbind,
    toastUndo: toastUndo,
    toastAction: toastAction,
    showDisableSafeDeleteToast: showDisableSafeDeleteToast,
    isSafeDeleteEnabled: isSafeDeleteEnabled,
    _reducedMotion: reducedMotion
  };
})(typeof window !== "undefined" ? window : globalThis);
