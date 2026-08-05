/**
 * Wspolny layout (thumb vs body) i zoom dla #damVizModal + #damMediaPreview.
 */
(function () {
  "use strict";

  var CARD_ZOOM_KEY = "dam_viz_card_zoom";
  var CARD_ZOOM_MIN = 65;
  var CARD_ZOOM_MAX = 350;
  var MODAL_ZOOM_MIN = 65;
  var MODAL_ZOOM_MAX = 400;

  var ZOOM_SHORTCUT_TIP =
    "Scroll na grafice: +/-5%. Shift+scroll: +/-10%. Ctrl+scroll: +/-1%. Kliknij wartość i wpisz procent (np. 125). Lupa: +/-10%.";

  /**
   * Zoom pill auto-hide (Explorer canon): docks down when pointer leaves the
   * lower thumb band; shows on hover near bottom / focus. Shared by
   * #damMediaPreview and #damVizModal (parity — do not special-case Viz).
   */
  function initZoomDock(thumbStage, zoomBar) {
    if (!thumbStage || !zoomBar) return;
    if (zoomBar.dataset.damZoomDockBound === "1") return;
    zoomBar.dataset.damZoomDockBound = "1";
    zoomBar.classList.add("is-docked", "dam-media-preview__zoom");
    var reduceMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dockedY = 30;

    function animateTo(y, duration) {
      if (reduceMotion) {
        zoomBar.style.transform = "translateX(-50%) translateY(" + y + "px)";
        return;
      }
      if (window.gsap) {
        window.gsap.to(zoomBar, {
          y: y,
          duration: duration || 0.3,
          ease: "power2.out",
          overwrite: true,
        });
        return;
      }
      zoomBar.style.transform = "translateX(-50%) translateY(" + y + "px)";
    }

    function showDock() {
      zoomBar.classList.remove("is-docked");
      animateTo(0, 0.3);
    }

    function hideDock() {
      zoomBar.classList.add("is-docked");
      animateTo(dockedY, 0.3);
    }

    if (window.gsap) {
      window.gsap.set(zoomBar, { xPercent: -50, y: dockedY });
    } else {
      zoomBar.style.transform = "translateX(-50%) translateY(" + dockedY + "px)";
    }

    thumbStage.addEventListener("mousemove", function (e) {
      var rect = thumbStage.getBoundingClientRect();
      var nearBottom = e.clientY >= rect.bottom - 52;
      if (nearBottom) showDock();
      else if (!zoomBar.matches(":hover")) hideDock();
    });
    thumbStage.addEventListener("mouseleave", hideDock);
    zoomBar.addEventListener("mouseenter", showDock);
    zoomBar.addEventListener("focusin", showDock);
    zoomBar.addEventListener("mouseleave", function () {
      hideDock();
    });
  }

  function readCardZoomPct() {
    var n = parseInt(localStorage.getItem(CARD_ZOOM_KEY) || "100", 10);
    if (isNaN(n)) n = 100;
    return Math.min(CARD_ZOOM_MAX, Math.max(CARD_ZOOM_MIN, n));
  }

  /** Skala startowa w modalu vs suwak kafelka: zakres 85%–100% (110%+ kafelka -> 100% modalu). */
  function modalStartZoomPct(cardPct) {
    var pct = Math.min(CARD_ZOOM_MAX, Math.max(CARD_ZOOM_MIN, cardPct == null ? readCardZoomPct() : cardPct));
    if (pct <= 85) return 85;
    if (pct >= 100) return 100;
    return Math.round(pct);
  }

  function modalResetZoomFactor(cardPct) {
    return modalStartZoomPct(cardPct == null ? readCardZoomPct() : cardPct) / 100;
  }

  function clampModalZoom(z) {
    return Math.min(MODAL_ZOOM_MAX / 100, Math.max(MODAL_ZOOM_MIN / 100, +Number(z).toFixed(2)));
  }

  function wheelStep(e) {
    if (e.ctrlKey) return 0.01;
    if (e.shiftKey) return 0.1;
    return 0.05;
  }

  function parseZoomLabel(text) {
    var m = /(\d+(?:\.\d+)?)\s*%?/.exec(String(text || "").trim());
    if (!m) return null;
    return clampModalZoom(parseFloat(m[1], 10) / 100);
  }

  function parseVideoAspect(value) {
    var raw = String(value || "16 / 9").trim();
    var parts = raw.split("/");
    if (parts.length === 2) {
      var w = parseFloat(parts[0], 10);
      var h = parseFloat(parts[1], 10);
      if (w > 0 && h > 0) return w / h;
    }
    return 16 / 9;
  }

  function fitVideoStage(modalRoot) {
    if (!modalRoot) return;
    var thumb = modalRoot.querySelector(".dam-viz-modal__thumb");
    if (!thumb) return;
    var stage = thumb.querySelector(".dam-media-preview__video-stage");
    if (!stage || stage.classList.contains("is-error")) return;

    var ar = parseVideoAspect(
      stage.style.getPropertyValue("--dam-video-aspect") ||
        getComputedStyle(stage).getPropertyValue("--dam-video-aspect")
    );
    var styles = getComputedStyle(thumb);
    var padL = parseFloat(styles.paddingLeft) || 0;
    var padR = parseFloat(styles.paddingRight) || 0;
    var padT = parseFloat(styles.paddingTop) || 0;
    var padB = parseFloat(styles.paddingBottom) || 0;
    var zoomBar = thumb.querySelector(".dam-viz-modal__zoom, .dam-media-preview__zoom");
    var zoomH = zoomBar ? zoomBar.offsetHeight + 14 : 52;
    var hintSlot = thumb.querySelector(".dam-media-preview__hint-slot");
    var hintH = hintSlot && hintSlot.textContent.trim() ? hintSlot.offsetHeight + 10 : 0;
    var availW = thumb.clientWidth - padL - padR;
    var availH = thumb.clientHeight - padT - padB - zoomH - hintH;
    if (availW < 160 || availH < 120) return;

    var maxH = Math.min(520, availH, window.innerHeight * 0.56);
    var maxW = Math.min(availW, 980);
    var h = maxH;
    var w = h * ar;
    if (w > maxW) {
      w = maxW;
      h = w / ar;
    }

    stage.style.width = Math.round(w) + "px";
    stage.style.height = Math.round(h) + "px";
    stage.style.maxWidth = "100%";
    stage.style.maxHeight = Math.round(maxH) + "px";
  }

  function fitChrome(modalRoot) {
    if (!modalRoot) return;
    var thumb = modalRoot.querySelector(".dam-viz-modal__thumb");
    if (!thumb) return;

    thumb.style.flex = "";
    thumb.style.maxHeight = "";
    thumb.style.minHeight = "";
    delete thumb.dataset.damThumbNaturalH;

    fitVideoStage(modalRoot);
  }

  function scheduleFitChrome(modalRoot) {
    if (!modalRoot) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fitChrome(modalRoot);
      });
    });
  }

  function bindChromeFit(modalRoot) {
    if (!modalRoot) return function () {};
    var onResize = function () {
      scheduleFitChrome(modalRoot);
    };
    window.addEventListener("resize", onResize);
    scheduleFitChrome(modalRoot);
    return function teardown() {
      window.removeEventListener("resize", onResize);
      var thumb = modalRoot.querySelector(".dam-viz-modal__thumb");
      if (thumb) {
        thumb.style.maxHeight = "";
        thumb.style.minHeight = "";
        thumb.style.flex = "";
        var stage = thumb.querySelector(".dam-media-preview__video-stage");
        if (stage) {
          stage.style.width = "";
          stage.style.height = "";
          stage.style.maxWidth = "";
          stage.style.maxHeight = "";
        }
      }
    };
  }

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.thumbStage
   * @param {HTMLElement} opts.labelEl
   * @param {HTMLElement} [opts.zoomBar]
   * @param {HTMLElement} [opts.zoomInBtn]
   * @param {HTMLElement} [opts.zoomOutBtn]
   * @param {HTMLElement} [opts.zoomResetBtn]
   * @param {function(): HTMLElement|null} opts.getHero
   * @param {function(): number} [opts.getResetFactor]
   * @param {function(boolean): void} [opts.onPanState]
   */
  function bindZoom(opts) {
    var thumbStage = opts.thumbStage;
    var labelEl = opts.labelEl;
    var zoomBar = opts.zoomBar;
    var getHero = opts.getHero;
    var getResetFactor = opts.getResetFactor || modalResetZoomFactor;
    var onPanState = opts.onPanState || function () {};

    var zoom = getResetFactor();
    var panX = 0;
    var panY = 0;
    var dragging = false;
    var dragStartX = 0;
    var dragStartY = 0;
    var panAtDragStartX = 0;
    var panAtDragStartY = 0;

    if (zoomBar) {
      zoomBar.setAttribute("data-dam-tip", ZOOM_SHORTCUT_TIP);
      zoomBar.setAttribute("title", ZOOM_SHORTCUT_TIP);
    }

    if (labelEl) {
      labelEl.setAttribute("contenteditable", "true");
      labelEl.setAttribute("spellcheck", "false");
      labelEl.setAttribute("role", "textbox");
      labelEl.setAttribute("aria-label", "Skala podglądu w procentach");
      labelEl.setAttribute("data-dam-tip", ZOOM_SHORTCUT_TIP);
      labelEl.setAttribute("title", ZOOM_SHORTCUT_TIP);
    }

    function resetBaseline() {
      return getResetFactor();
    }

    function panEnabled() {
      return zoom > resetBaseline() * 1.01;
    }

    function paintZoom() {
      var hero = getHero && getHero();
      if (hero && hero.style) {
        if (hero.tagName === "IMG") {
          hero.style.transform = "translate(" + panX + "px, " + panY + "px) scale(" + zoom + ")";
          hero.classList.toggle("is-zoomed", panEnabled());
        }
      }
      if (thumbStage) {
        thumbStage.classList.toggle("is-zoomed", panEnabled());
        thumbStage.classList.toggle("is-panning", dragging);
      }
      if (labelEl && document.activeElement !== labelEl) {
        labelEl.textContent = Math.round(zoom * 100) + "%";
      }
      onPanState(panEnabled());
    }

    function resetView() {
      zoom = resetBaseline();
      panX = 0;
      panY = 0;
      dragging = false;
      paintZoom();
    }

    function setZoom(next) {
      var prev = zoom;
      var base = resetBaseline();
      zoom = clampModalZoom(next);
      if (zoom <= base * 1.01) {
        panX = 0;
        panY = 0;
      } else if (prev <= base * 1.01 && zoom > base * 1.01) {
        panX = 0;
        panY = 0;
      }
      paintZoom();
    }

    if (opts.zoomInBtn) {
      opts.zoomInBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        setZoom(zoom + 0.1);
      });
    }
    if (opts.zoomOutBtn) {
      opts.zoomOutBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        setZoom(zoom - 0.1);
      });
    }
    if (opts.zoomResetBtn) {
      opts.zoomResetBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        resetView();
      });
    }

    if (labelEl) {
      labelEl.addEventListener("focus", function () {
        var range = document.createRange();
        range.selectNodeContents(labelEl);
        var sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
      labelEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          labelEl.blur();
        }
      });
      labelEl.addEventListener("blur", function () {
        var parsed = parseZoomLabel(labelEl.textContent);
        if (parsed != null) setZoom(parsed);
        else paintZoom();
      });
    }

    if (thumbStage) {
      thumbStage.addEventListener(
        "wheel",
        function (e) {
          if (e.target.closest(".dam-viz-modal__zoom") && e.target !== labelEl) return;
          e.preventDefault();
          e.stopPropagation();
          var step = wheelStep(e);
          setZoom(zoom + (e.deltaY > 0 ? -step : step));
        },
        { passive: false }
      );

      thumbStage.addEventListener("pointerdown", function (e) {
        if (!panEnabled()) return;
        if (e.target.closest(".dam-viz-modal__zoom")) return;
        if (e.button !== 0) return;
        dragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        panAtDragStartX = panX;
        panAtDragStartY = panY;
        thumbStage.classList.add("is-panning");
        try {
          thumbStage.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
        e.preventDefault();
      });

      thumbStage.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        panX = panAtDragStartX + (e.clientX - dragStartX);
        panY = panAtDragStartY + (e.clientY - dragStartY);
        paintZoom();
      });

      function endPan(e) {
        if (!dragging) return;
        dragging = false;
        thumbStage.classList.remove("is-panning");
        if (e && e.pointerId != null) {
          try {
            thumbStage.releasePointerCapture(e.pointerId);
          } catch (err) {
            /* ignore */
          }
        }
        paintZoom();
      }
      thumbStage.addEventListener("pointerup", endPan);
      thumbStage.addEventListener("pointercancel", endPan);
    }

    resetView();

    return {
      getZoom: function () {
        return zoom;
      },
      setZoom: setZoom,
      resetView: resetView,
      paintZoom: paintZoom,
      panEnabled: panEnabled,
    };
  }

  /**
   * Dialog przy zamykaniu brudnego pickera/modala.
   * TYLKO Zatwierdz/OK zapisuje bez pytania; X / Wstecz / klik poza / Esc
   * przy zmianach → Odrzuc | Nie, wroc | Zapisz zmiany.
   * opts: { isDirty, onDiscard, onStay, onSave, title, body }
   * Zwraca true gdy zamkniecie odroczone (dialog otwarty).
   */
  function confirmUnsavedClose(opts) {
    opts = opts || {};
    if (typeof opts.isDirty === "function" ? !opts.isDirty() : !opts.isDirty) {
      if (typeof opts.onDiscard === "function") opts.onDiscard();
      return false;
    }
    ensureUnsavedCloseCss();
    var prev = document.getElementById("damUnsavedCloseOverlay");
    if (prev) prev.remove();
    var wrap = document.createElement("div");
    wrap.id = "damUnsavedCloseOverlay";
    wrap.className = "dam-unsaved-close-overlay";
    wrap.setAttribute("role", "presentation");
    wrap.innerHTML =
      '<div class="dam-unsaved-close-card" role="alertdialog" aria-modal="true" aria-labelledby="damUnsavedCloseTitle">' +
      '<h4 id="damUnsavedCloseTitle">' +
      (opts.title || "Czy chcesz porzuci\u0107 zmiany?") +
      "</h4>" +
      "<p>" +
      (opts.body ||
        "Masz niezapisane wybory. Mo\u017cesz je zapisa\u0107, odrzuci\u0107 albo wr\u00f3ci\u0107 do edycji.") +
      "</p>" +
      '<div class="dam-unsaved-close-actions dam-dialog-actions">' +
      '<button type="button" class="geex-btn geex-btn--secondary" data-unsaved="discard">Odrzu\u0107</button>' +
      '<button type="button" class="geex-btn geex-btn--ghost" data-unsaved="stay">Nie, wr\u00f3\u0107</button>' +
      '<span class="dam-unsaved-close-spacer dam-dialog-actions__spacer" aria-hidden="true"></span>' +
      '<button type="button" class="geex-btn geex-btn--primary" data-unsaved="save">Zapisz zmiany</button>' +
      "</div></div>";
    document.body.appendChild(wrap);
    function finish(act) {
      wrap.remove();
      if (act === "discard" && typeof opts.onDiscard === "function") opts.onDiscard();
      else if (act === "stay" && typeof opts.onStay === "function") opts.onStay();
      else if (act === "save" && typeof opts.onSave === "function") opts.onSave();
    }
    wrap.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-unsaved]") : null;
      if (!btn) {
        if (e.target === wrap) finish("stay");
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      finish(btn.getAttribute("data-unsaved"));
    });
    document.addEventListener(
      "keydown",
      function onEsc(e) {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        document.removeEventListener("keydown", onEsc, true);
        finish("stay");
      },
      true
    );
    var stayBtn = wrap.querySelector('[data-unsaved="stay"]');
    if (stayBtn) stayBtn.focus();
    return true;
  }

  function ensureUnsavedCloseCss() {
    var css =
      ".dam-unsaved-close-overlay{position:fixed;inset:0;z-index:13050;display:flex;" +
      "align-items:center;justify-content:center;padding:24px;" +
      "background:rgba(28,25,38,.45);backdrop-filter:blur(2px);}" +
      ".dam-unsaved-close-card{max-width:560px;width:min(560px,96vw);background:#fff;border-radius:16px;" +
      "box-shadow:0 18px 48px rgba(28,25,38,.22);padding:22px 22px 18px;border:1px solid rgba(70,66,85,.12);}" +
      ".dam-unsaved-close-card h4{margin:0 0 8px;font-size:18px;font-weight:700;color:#2d2a37;}" +
      ".dam-unsaved-close-card p{margin:0 0 18px;font-size:14px;line-height:1.45;color:#5c5668;}" +
      /* Global: odrzuc/anuluj lewo, zatwierdz prawo, jeden rzad (jak .dam-dialog-actions). */
      ".dam-unsaved-close-actions.dam-dialog-actions," +
      ".dam-unsaved-close-actions{display:grid!important;" +
      "grid-template-columns:auto auto 1fr auto!important;align-items:center;gap:8px;" +
      "min-height:0;padding:0;margin:0;border:none;background:transparent;flex:none;}" +
      ".dam-unsaved-close-actions > [data-unsaved=discard]{grid-column:1;justify-self:start;}" +
      ".dam-unsaved-close-actions > [data-unsaved=stay]{grid-column:2;justify-self:start;}" +
      ".dam-unsaved-close-actions > .dam-unsaved-close-spacer{grid-column:3;display:block!important;min-width:8px;}" +
      ".dam-unsaved-close-actions > [data-unsaved=save]{grid-column:4;justify-self:end;}" +
      ".dam-unsaved-close-actions .geex-btn{white-space:nowrap;flex:0 0 auto;margin:0;}";
    var st = document.getElementById("damUnsavedCloseCss");
    if (!st) {
      st = document.createElement("style");
      st.id = "damUnsavedCloseCss";
      document.head.appendChild(st);
    }
    st.textContent = css;
  }

  window.DamModalShared = {
    CARD_ZOOM_KEY: CARD_ZOOM_KEY,
    CARD_ZOOM_MIN: CARD_ZOOM_MIN,
    CARD_ZOOM_MAX: CARD_ZOOM_MAX,
    MODAL_ZOOM_MIN: MODAL_ZOOM_MIN,
    MODAL_ZOOM_MAX: MODAL_ZOOM_MAX,
    ZOOM_SHORTCUT_TIP: ZOOM_SHORTCUT_TIP,
    readCardZoomPct: readCardZoomPct,
    modalStartZoomPct: modalStartZoomPct,
    modalResetZoomFactor: modalResetZoomFactor,
    clampModalZoom: clampModalZoom,
    fitChrome: fitChrome,
    fitVideoStage: fitVideoStage,
    scheduleFitChrome: scheduleFitChrome,
    bindChromeFit: bindChromeFit,
    bindZoom: bindZoom,
    initZoomDock: initZoomDock,
    bindPreviewNav: bindPreviewNav,
    bindModalClose: bindModalClose,
    confirmUnsavedClose: confirmUnsavedClose,
  };

  /**
   * Capture-phase close (parity #damVizModalClose / #damMediaPreviewClose).
   * Beats assoc overlays that swallow bubble-phase clicks.
   */
  function bindModalClose(closeBtn, onClose) {
    if (!closeBtn || closeBtn.dataset.damModalCloseBound === "1") return;
    closeBtn.dataset.damModalCloseBound = "1";
    function fire(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      }
      if (typeof onClose === "function") onClose();
    }
    closeBtn.addEventListener("pointerdown", fire, true);
    closeBtn.addEventListener("click", fire, true);
  }

  function ensurePreviewNavCss() {
    if (document.getElementById("damPreviewNavCss")) return;
    var st = document.createElement("style");
    st.id = "damPreviewNavCss";
    st.textContent =
      ".dam-viz-modal-shell{display:flex;flex-direction:column;position:relative;" +
      "width:var(--dam-modal-box-w,90vw);max-width:var(--dam-modal-box-w,90vw);" +
      "height:var(--dam-modal-box-h,90vh);min-height:min(var(--dam-modal-box-min-h),var(--dam-modal-box-h,90vh));" +
      "max-height:var(--dam-modal-box-h,90vh);box-sizing:border-box;}" +
      ".dam-viz-modal-shell>.dam-viz-modal-box{flex:1 1 0;min-height:0;height:auto!important;max-height:none!important;}" +
      ".dam-preview-nav{display:flex;align-items:center;gap:4px;padding:6px 8px;min-height:45px;" +
      "border-bottom:1px solid rgba(70,66,85,.12);background:rgba(255,255,255,.96);" +
      "flex:0 0 auto;width:100%;box-sizing:border-box;border-radius:16px 16px 0 0;position:relative;z-index:2;}" +
      ".dam-viz-modal-shell:has(.dam-preview-nav)>.dam-viz-modal-box{border-top-left-radius:0;border-top-right-radius:0;}" +
      ".dam-preview-nav__btn{width:32px;height:32px;border-radius:8px;border:1px solid rgba(70,66,85,.16);" +
      "background:#fff;color:#464255;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;}" +
      ".dam-preview-nav__btn:hover:not(:disabled){background:#f3f2f6;border-color:rgba(70,66,85,.28);}" +
      ".dam-preview-nav__btn:disabled{opacity:.4;cursor:not-allowed;}" +
      ".dam-preview-nav .dam-viz-modal-close,.dam-preview-nav__close{" +
      "margin-left:auto!important;position:static!important;top:auto!important;right:auto!important;" +
      "width:32px;height:32px;border-radius:8px;border:1px solid rgba(70,66,85,.16);" +
      "background:#fff;color:#464255;display:inline-flex;align-items:center;justify-content:center;" +
      "cursor:pointer;flex:0 0 auto;z-index:1;pointer-events:auto!important;}" +
      ".dam-preview-nav .dam-viz-modal-close:hover,.dam-preview-nav__close:hover{" +
      "background:rgba(239,68,68,.14)!important;border-color:#fecaca!important;color:#b91c1c!important;}";
    document.head.appendChild(st);
  }

  /**
   * Back/Forward/Up/Refresh toolbar for #damVizModal and #damMediaPreview (not pickers).
   * opts: { modalRoot, getPath, onNavigate, onUp, onRefresh }
   */
  function bindPreviewNav(opts) {
    ensurePreviewNavCss();
    opts = opts || {};
    var modalRoot = opts.modalRoot;
    if (!modalRoot || modalRoot.dataset.damPreviewNavBound === "1") return;
    modalRoot.dataset.damPreviewNavBound = "1";
    var history = [];
    var cursor = -1;
    var shell = modalRoot.querySelector(".dam-viz-modal-shell");
    if (!shell) return;
    var nav = document.createElement("div");
    nav.className = "dam-preview-nav";
    nav.setAttribute("role", "toolbar");
    nav.setAttribute("aria-label", "Nawigacja podglądu");
    nav.innerHTML =
      '<button type="button" class="dam-preview-nav__btn" data-preview-back aria-label="Wstecz" title="Wstecz" disabled><i class="uil uil-angle-left"></i></button>' +
      '<button type="button" class="dam-preview-nav__btn" data-preview-fwd aria-label="Dalej" title="Dalej" disabled><i class="uil uil-angle-right"></i></button>' +
      '<button type="button" class="dam-preview-nav__btn" data-preview-up aria-label="Folder wyżej" title="Folder wyżej"><i class="uil uil-arrow-up"></i></button>' +
      '<button type="button" class="dam-preview-nav__btn" data-preview-refresh aria-label="Odśwież" title="Odśwież"><i class="uil uil-refresh"></i></button>';
    /* Header row: nav must live inside .dam-viz-modal-shell (not overlay flex sibling). */
    if (shell.firstChild) shell.insertBefore(nav, shell.firstChild);
    else shell.appendChild(nav);

    /* P0-A: close X in same flex row as nav (margin-left:auto), not absolute on shell. */
    var closeBtn =
      (opts.closeBtnId && shell.querySelector("#" + opts.closeBtnId)) ||
      shell.querySelector(".dam-viz-modal-close");
    if (closeBtn && closeBtn.parentElement !== nav) {
      closeBtn.classList.add("dam-preview-nav__close");
      nav.appendChild(closeBtn);
    }

    function paintBtns() {
      var back = nav.querySelector("[data-preview-back]");
      var fwd = nav.querySelector("[data-preview-fwd]");
      if (back) back.disabled = cursor <= 0;
      if (fwd) fwd.disabled = cursor < 0 || cursor >= history.length - 1;
    }

    function pushState(state) {
      if (!state) return;
      if (cursor < history.length - 1) history = history.slice(0, cursor + 1);
      var last = history[history.length - 1];
      if (last && last.key === state.key) return;
      history.push(state);
      cursor = history.length - 1;
      paintBtns();
    }

    function goTo(idx) {
      if (idx < 0 || idx >= history.length) return;
      cursor = idx;
      paintBtns();
      if (typeof opts.onNavigate === "function") opts.onNavigate(history[cursor]);
    }

    nav.querySelector("[data-preview-back]").addEventListener("click", function () {
      goTo(cursor - 1);
    });
    nav.querySelector("[data-preview-fwd]").addEventListener("click", function () {
      goTo(cursor + 1);
    });
    nav.querySelector("[data-preview-up]").addEventListener("click", function () {
      if (typeof opts.onUp === "function") opts.onUp();
    });
    nav.querySelector("[data-preview-refresh]").addEventListener("click", function () {
      if (typeof opts.onRefresh === "function") opts.onRefresh();
    });

    return {
      push: pushState,
      reset: function () {
        history = [];
        cursor = -1;
        paintBtns();
      },
    };
  }
})();
