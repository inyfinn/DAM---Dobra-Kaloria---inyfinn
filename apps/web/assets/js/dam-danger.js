/**
 * DAM - dam-danger.js
 * Globalny, reuzywalny mechanizm UX dla akcji destrukcyjnych (STREFA H, brief 2026-07-20, pkt 27-32).
 *
 * Doktryna (reel o "przyciskach smierci"):
 *  - Zwykly klik NIE usuwa. Trzeba PRZYTRZYMAC (max 1,5 s) - przy kursorze rosnie
 *    JEDEN ring postepu (SVG circle stroke-dashoffset). Puszczenie przed czasem = reset.
 *  - Zwykly klik / krotkie przytrzymanie = toast na dole "Przytrzymaj…".
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
 *     holdMs: 1500,
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
  /* Bump when toast/hint CSS changes — force re-inject (single cursor ring). */
  var CSS_TOKEN = "holdRing1500ms20260723b";
  var DEFAULT_HOLD_MS = 1500; // global hold-to-delete / cancel (user 2026-07-23)
  var MAX_HOLD_MS = 1500; // hard cap everywhere (incl. data-dam-hold-ms)
  var MEDIA_PREVIEW_HOLD_MS = 1500; // media preview + viz modal: same max
  var TAP_HINT_MS = 220; // ponizej tego = czysty "klik" -> toast na dole
  var KEY_ARM_MS = 4000; // okno na drugie Enter/Spacja w trybie klawiatury
  var CURSOR_RING_SIZE = 44;
  var MASCOT_POSE = "think-q"; /* soft warning pose from tutorial sheet */

  function mascotPoseUrl(token) {
    var file = "pose-" + (token || MASCOT_POSE) + ".png";
    try {
      return new URL("assets/img/maskotka/" + file, global.location.href).href;
    } catch (err) {
      return "assets/img/maskotka/" + file;
    }
  }

  function warnIconHtml() {
    return (
      '<span class="dam-danger-toast__warn" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" focusable="false">' +
      '<path fill="currentColor" d="M12 3.2L1.8 20.2c-.35.58.08 1.3.75 1.3h18.9c.67 0 1.1-.72.75-1.3L12 3.2zm0 5.3c.55 0 1 .4 1 .9v4.4c0 .5-.45.9-1 .9s-1-.4-1-.9V9.4c0-.5.45-.9 1-.9zm0 8.7c.66 0 1.2.54 1.2 1.2S12.66 19.6 12 19.6s-1.2-.54-1.2-1.2.54-1.2 1.2-1.2z"/>' +
      "</svg></span>"
    );
  }

  function mascotHtml() {
    return (
      '<div class="dam-danger-toast__mascot" aria-hidden="true">' +
      '<span class="dam-danger-toast__mascot-img"></span></div>'
    );
  }

  function reducedMotion() {
    try {
      return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function formatHoldSecs(ms) {
    var s = (ms > 0 ? ms : DEFAULT_HOLD_MS) / 1000;
    if (Math.abs(s - Math.round(s)) < 0.001) return String(Math.round(s));
    return String(Math.round(s * 10) / 10).replace(".", ",");
  }

  function resolveHoldMs(el, optsHoldMs) {
    var ms = 0;
    if (optsHoldMs && optsHoldMs > 0) ms = optsHoldMs;
    else if (el && el.getAttribute) {
      var attr = parseInt(el.getAttribute("data-dam-hold-ms"), 10);
      if (attr > 0) ms = attr;
    }
    if (!ms) {
      if (
        el &&
        el.closest &&
        el.closest("#damMediaPreview, #damVizModal, .dam-media-preview, .dam-viz-modal-box")
      ) {
        ms = MEDIA_PREVIEW_HOLD_MS;
      } else {
        ms = DEFAULT_HOLD_MS;
      }
    }
    return Math.min(Math.max(1, ms), MAX_HOLD_MS);
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
    var existing = document.getElementById(CSS_ID);
    if (existing) {
      if (existing.getAttribute("data-v") === CSS_TOKEN) return;
      if (existing.parentNode) existing.parentNode.removeChild(existing);
    }
    var css = [
      /* JEDEN luk postepu przy kursorze (bez track + bez ringa na przycisku) */
      ".dam-danger-cursor-ring{position:fixed;width:" + CURSOR_RING_SIZE + "px;height:" + CURSOR_RING_SIZE + "px;",
      "margin:0;padding:0;pointer-events:none;z-index:24080;opacity:0;",
      "transform:translate(-50%,-50%);transition:opacity .12s ease;}",
      ".dam-danger-cursor-ring.is-on{opacity:1;}",
      ".dam-danger-cursor-ring svg{width:100%;height:100%;overflow:visible;transform:rotate(-90deg);}",
      ".dam-danger-cursor-ring .dam-danger-ring__bar{",
      "fill:none;stroke:var(--dam-danger,#ff5b5b);stroke-linecap:round;",
      "filter:drop-shadow(0 0 4px color-mix(in srgb,var(--dam-danger,#ff5b5b) 55%,transparent));}",
      /* legacy button-ring: never show (old sessions / stale inject) */
      ".dam-danger-ring{display:none!important;opacity:0!important;}",
      /* stan trzymania na samym przycisku */
      ".dam-danger-holding{color:var(--dam-danger,#ff5b5b)!important;}",
      ".dam-danger-armed{outline:2px solid var(--dam-danger,#ff5b5b)!important;outline-offset:2px;}",
      "@media (prefers-reduced-motion: reduce){.dam-danger-cursor-ring{transition:none;}}",
      /* podpowiedz — biała tabliczka (jak tip / invite), nie czarny alarm */
      ".dam-danger-hint{position:fixed;z-index:24060;background:var(--dam-surface,#fff);color:var(--dam-text,#464255);",
      "padding:8px 12px;border-radius:10px;font-size:12.5px;line-height:1.35;font-weight:600;",
      "border:1px solid var(--dam-border,#ececf2);",
      "box-shadow:0 10px 28px rgba(23,22,30,.16);pointer-events:none;opacity:0;transform:translateY(4px);",
      "transition:opacity .16s ease,transform .16s ease;max-width:280px;}",
      ".dam-danger-hint.is-on{opacity:1;transform:translateY(0);}",
      ".dam-danger-hint::after{content:'';position:absolute;left:50%;bottom:-5px;width:9px;height:9px;",
      "background:inherit;border-right:1px solid var(--dam-border,#ececf2);border-bottom:1px solid var(--dam-border,#ececf2);",
      "transform:translateX(-50%) rotate(45deg);border-radius:0 0 2px 0;}",
      /* toast = tabliczka Dobrokaloriusia (wzorzec dam-tut-invite / companion) */
      ".dam-danger-toast{--dam-danger-medal:78px;position:fixed;left:50%;bottom:28px;",
      "transform:translateX(-50%) translateY(14px);z-index:24070;",
      "display:flex;align-items:flex-start;gap:16px;",
      "width:min(420px,calc(100vw - 32px));min-width:0;",
      "padding:22px 24px 18px;border-radius:16px;",
      "background:var(--dam-surface,#fff);color:var(--dam-text,#464255);",
      "border:1px solid var(--dam-border,#ececf2);",
      "box-shadow:0 16px 40px rgba(23,22,30,.22);",
      "font-family:var(--dam-font,'Jost',sans-serif);font-size:14px;line-height:1.45;",
      "opacity:0;transition:opacity .22s ease,transform .22s ease;overflow:visible;}",
      ".dam-danger-toast.is-on{opacity:1;transform:translateX(-50%) translateY(0);}",
      ".dam-danger-toast__mascot{position:relative;flex:0 0 var(--dam-danger-medal);",
      "width:var(--dam-danger-medal);height:calc(var(--dam-danger-medal)*1.28);margin-top:2px;}",
      ".dam-danger-toast__mascot::before{content:'';position:absolute;left:0;bottom:0;",
      "width:var(--dam-danger-medal);height:var(--dam-danger-medal);border-radius:50%;",
      "background:#fff;border:1px solid var(--dam-border,#ececf2);",
      "box-shadow:0 8px 22px rgba(0,130,68,.32),0 2px 6px rgba(0,130,68,.18);}",
      ".dam-danger-toast__mascot-img{position:absolute;left:-8%;bottom:5px;width:116%;height:116%;",
      "background-image:var(--dam-danger-pose);background-repeat:no-repeat;",
      "background-size:contain;background-position:center bottom;",
      "filter:drop-shadow(0 2px 3px rgba(0,130,68,.16));pointer-events:none;}",
      ".dam-danger-toast__body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:10px;padding-top:2px;}",
      ".dam-danger-toast__msg{margin:0;display:flex;align-items:flex-start;gap:8px;",
      "font-weight:600;font-size:14.5px;line-height:1.4;color:var(--dam-text,#464255);}",
      ".dam-danger-toast__warn{flex:0 0 auto;display:inline-flex;margin-top:1px;",
      "color:#d97706;}",
      ".dam-danger-toast__actions{display:flex;flex-wrap:wrap;gap:8px;}",
      ".dam-danger-toast__undo{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;",
      "background:transparent;color:var(--dam-primary,#ab54db);",
      "border:1px solid color-mix(in srgb,var(--dam-primary,#ab54db) 35%,#ececf2);",
      "border-radius:8px;padding:8px 14px;min-height:40px;font-size:13px;font-weight:700;cursor:pointer;",
      "transition:background .14s ease,border-color .14s ease;}",
      ".dam-danger-toast__undo:hover{background:color-mix(in srgb,var(--dam-primary,#ab54db) 10%,#fff);",
      "border-color:var(--dam-primary,#ab54db);}",
      ".dam-danger-toast__undo:focus-visible{outline:2px solid var(--dam-primary,#ab54db);outline-offset:2px;}",
      ".dam-danger-toast__bar{position:absolute;left:12px;right:12px;bottom:0;height:3px;",
      "border-radius:2px 2px 0 0;background:color-mix(in srgb,#d97706 75%,var(--dam-danger,#ff5b5b));",
      "width:auto;transform-origin:left center;}",
      /* compact undo toast: one row, no mascot, ~56-64px tall */
      ".dam-danger-toast--compact{--dam-danger-medal:0px;align-items:center;gap:10px;",
      "padding:10px 14px 12px;border-radius:12px;width:min(380px,calc(100vw - 32px));}",
      ".dam-danger-toast--compact .dam-danger-toast__body{flex-direction:row;align-items:center;",
      "justify-content:space-between;gap:12px;padding-top:0;}",
      ".dam-danger-toast--compact .dam-danger-toast__msg{align-items:center;margin:0;}",
      ".dam-danger-toast--compact .dam-danger-toast__actions{margin:0;}",
      ".dam-danger-toast--compact .dam-danger-toast__undo{min-height:32px;padding:6px 12px;font-size:12px;}",
      ".dam-danger-toast--action{pointer-events:auto;}",
      ".dam-danger-toast__note{margin:0;font-size:12px;font-weight:400;",
      "color:#7a7489;line-height:1.4;}",
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
      ".dam-danger-cursor-ring,.dam-danger-hint,.dam-danger-toast{transition:none;}",
      ".dam-danger-cursor-ring .dam-danger-ring__bar{filter:none;}",
      ".dam-danger-toast__bar{transition:none;}",
      "}"
    ].join("");
    var style = document.createElement("style");
    style.id = CSS_ID;
    style.setAttribute("data-v", CSS_TOKEN);
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

  /* ---------- ring (tylko kursor, jeden luk) ---------- */
  function makeSvgRing(side, strokeW) {
    var radius = side / 2 - strokeW;
    var circ = 2 * Math.PI * radius;
    var wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    /* Sam bar — track wygladal jak drugi, rownolegly ring. */
    wrap.innerHTML =
      '<svg viewBox="0 0 ' + side + " " + side + '" width="' + side + '" height="' + side + '">' +
      '<circle class="dam-danger-ring__bar" cx="' + side / 2 + '" cy="' + side / 2 + '" r="' + radius + '" stroke-width="' + strokeW + '" ' +
      'stroke-dasharray="' + circ + '" stroke-dashoffset="' + circ + '"></circle>' +
      "</svg>";
    wrap._bar = wrap.querySelector(".dam-danger-ring__bar");
    wrap._circ = circ;
    return wrap;
  }
  function makeCursorRing() {
    var old = document.getElementById("damDangerCursorRing");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    document.querySelectorAll(".dam-danger-ring").forEach(function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
    var ring = makeSvgRing(CURSOR_RING_SIZE, 3);
    ring.className = "dam-danger-cursor-ring";
    ring.id = "damDangerCursorRing";
    return ring;
  }
  function setRingProgress(ring, p) {
    if (!ring || !ring._bar) return;
    p = Math.max(0, Math.min(1, p));
    ring._bar.setAttribute("stroke-dashoffset", String(ring._circ * (1 - p)));
  }
  function placeCursorRing(ring, x, y) {
    if (!ring) return;
    ring.style.left = Math.round(x) + "px";
    ring.style.top = Math.round(y) + "px";
  }

  /* ---------- rdzen: uzbrojenie elementu ---------- */
  function arm(el, opts) {
    if (!el || el.__damDanger) return;
    opts = opts || {};
    var state = {
      opts: opts,
      holdMs: resolveHoldMs(el, opts.holdMs),
      label: opts.label || (el.getAttribute && el.getAttribute("data-dam-label")) || "Usun",
      hint: opts.hint || (el.getAttribute && el.getAttribute("data-dam-hint")) || null,
      raf: 0,
      startAt: 0,
      holding: false,
      ring: null,
      cursorRing: null,
      ptrX: 0,
      ptrY: 0,
      keyArmed: false,
      keyTimer: null,
      confirmed: false,
      prevPos: ""
    };
    el.__damDanger = state;

    // a11y: opisz gest
    if (!el.getAttribute("aria-description")) {
      el.setAttribute(
        "aria-description",
        state.hint ||
          ("Przytrzymaj " + formatHoldSecs(state.holdMs) + " s, aby wykonac: " + state.label)
      );
    }

    function onPointerMove(e) {
      if (!state.holding) return;
      state.ptrX = e.clientX;
      state.ptrY = e.clientY;
      placeCursorRing(state.cursorRing, state.ptrX, state.ptrY);
    }

    function cleanupRing() {
      state.holding = false;
      if (state.raf) {
        if (reducedMotion()) clearTimeout(state.raf);
        else cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
      global.removeEventListener("pointermove", onPointerMove, true);
      el.classList.remove("dam-danger-holding");
      state.ring = null;
      if (state.cursorRing) {
        state.cursorRing.classList.remove("is-on");
        var cr = state.cursorRing;
        setTimeout(function () { if (cr && cr.parentNode) cr.parentNode.removeChild(cr); }, 140);
        state.cursorRing = null;
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

    function startHold(clientX, clientY) {
      if (state.holding) return;
      ensureCss();
      state.holding = true;
      state.startAt = performance.now ? performance.now() : Date.now();
      state.ptrX = typeof clientX === "number" ? clientX : 0;
      state.ptrY = typeof clientY === "number" ? clientY : 0;
      state.ring = null; /* only cursor ring — avoid double animation on button */
      state.cursorRing = makeCursorRing();
      document.body.appendChild(state.cursorRing);
      if (!state.ptrX && !state.ptrY) {
        var br = el.getBoundingClientRect();
        state.ptrX = br.left + br.width / 2;
        state.ptrY = br.top + br.height / 2;
      }
      placeCursorRing(state.cursorRing, state.ptrX, state.ptrY);
      el.classList.add("dam-danger-holding");
      requestAnimationFrame(function () {
        if (state.cursorRing) state.cursorRing.classList.add("is-on");
      });
      global.addEventListener("pointermove", onPointerMove, true);

      if (reducedMotion()) {
        setRingProgress(state.cursorRing, 1);
        state.raf = setTimeout(function () {
          if (state.holding) complete();
        }, state.holdMs);
        return;
      }
      var tick = function () {
        if (!state.holding) return;
        var now = performance.now ? performance.now() : Date.now();
        var p = (now - state.startAt) / state.holdMs;
        setRingProgress(state.cursorRing, p);
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
      var secs = formatHoldSecs(state.holdMs);
      var shortMsg =
        state.hint ||
        ("Spróbuj przytrzymać " + secs + " s, by " + String(state.label || "usunąć").toLowerCase());
      var longerMsg =
        state.hint ||
        ("Przytrzymaj dłużej (" + secs + " s), aby " + String(state.label || "usunąć").toLowerCase());
      if (elapsed < TAP_HINT_MS) {
        if (typeof state.opts.onTapHint === "function") {
          state.opts.onTapHint.call(el);
        } else if (state.opts.disableSafeDeleteAction !== false) {
          showDisableSafeDeleteToast(shortMsg);
        } else {
          showHint(el, shortMsg);
        }
      } else {
        if (state.opts.disableSafeDeleteAction !== false) {
          showDisableSafeDeleteToast(longerMsg);
        } else {
          showHint(el, longerMsg);
        }
        if (typeof state.opts.onCancel === "function") state.opts.onCancel.call(el);
      }
    }

    // --- pointer (mysz + dotyk) ---
    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (!isSafeDeleteEnabled()) return; // zwykly klik przejdzie
      e.preventDefault();
      startHold(e.clientX, e.clientY);
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
    el.style.setProperty("--dam-danger-pose", "url('" + mascotPoseUrl(MASCOT_POSE) + "')");
    el.innerHTML =
      mascotHtml() +
      '<div class="dam-danger-toast__body">' +
        '<p class="dam-danger-toast__msg">' + warnIconHtml() +
          '<span class="dam-danger-toast__msg-text"></span></p>' +
        '<div class="dam-danger-toast__actions">' +
          '<button type="button" class="dam-danger-toast__undo"></button>' +
        "</div>" +
        (cfg.note ? '<p class="dam-danger-toast__note"></p>' : "") +
      "</div>" +
      '<span class="dam-danger-toast__bar" aria-hidden="true"></span>';
    el.querySelector(".dam-danger-toast__msg-text").textContent =
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
      holdMs: resolveHoldMs(el, undefined),
      label: el.getAttribute("data-dam-label") || "Usuń",
    });
  }

  /* ---------- toast "Cofnij" (soft-delete / cooldown) ---------- */
  function toastUndo(cfg) {
    ensureCss();
    cfg = cfg || {};
    var duration = cfg.duration != null ? cfg.duration : 1000;
    var committed = false;
    var el = document.createElement("div");
    el.className = "dam-danger-toast dam-danger-toast--compact";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="dam-danger-toast__body">' +
        '<p class="dam-danger-toast__msg">' + warnIconHtml() +
          '<span class="dam-danger-toast__msg-text"></span></p>' +
        '<div class="dam-danger-toast__actions">' +
          '<button type="button" class="dam-danger-toast__undo">' +
            '<i class="uil uil-corner-up-left" aria-hidden="true"></i>' +
            "<span>" + (cfg.actionLabel || "Cofnij") + "</span></button>" +
        "</div>" +
      "</div>" +
      '<span class="dam-danger-toast__bar" aria-hidden="true"></span>';
    el.querySelector(".dam-danger-toast__msg-text").textContent = cfg.message || "Usunięto";
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
    DEFAULT_HOLD_MS: DEFAULT_HOLD_MS,
    MAX_HOLD_MS: MAX_HOLD_MS,
    _reducedMotion: reducedMotion
  };
})(typeof window !== "undefined" ? window : globalThis);
