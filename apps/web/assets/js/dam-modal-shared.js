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
    "Scroll na grafice: +/-5%. Shift+scroll: +/-10%. Ctrl+scroll: +/-1%. Kliknij wartosc i wpisz procent (np. 125). Lupa: +/-10%.";

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
      labelEl.setAttribute("aria-label", "Skala podgladu w procentach");
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
  };
})();
