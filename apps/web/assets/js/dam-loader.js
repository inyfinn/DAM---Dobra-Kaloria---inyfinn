/**
 * DAM - Globalny wskaznik ladowania (window.DamLoader).
 *
 * API:
 *   DamLoader.start([label])  - pokazuje pasek na srodku ekranu
 *   DamLoader.done()          - konczy (fade out)
 *
 * Zachowanie: pasek indeterminate w bialym pill-boxie na srodku (1.0 s),
 * etykieta zawsze "ładowanie". Jesli ladowanie nadal trwa po 1.0 s,
 * CSS transition (translate left/top, 0.5 s) przenosi pasek do prawego dolnego
 * rogu jako maly spinner NAD help fabem (#damHelpFab). Jesli done() przed
 * 1.0 s - znika ze srodka (bez docka). pointer-events: none, z-index 13000.
 * prefers-reduced-motion: bez animacji przenoszenia (od razu rog).
 */
(function (global) {
  "use strict";

  var STYLE_ID = "damLoaderCssHold1sDock05s20260721a";
  var HOLD_CENTER_MS = 1000;
  var DOCK_MS = 500;
  var LOADER_LABEL = "ładowanie";
  var Z_INDEX = 13000;
  /* Odstęp między dolną krawędzią loadera a górą #damHelpFab. */
  var FAB_GAP = 10;
  /* Fallback gdy fab jeszcze nie w DOM (right/bottom jak .dam-help-fab). */
  var FAB_FALLBACK = { right: 20, bottom: 20, size: 44 };

  var el = null;
  var innerEl = null;
  var labelEl = null;
  var activeCount = 0;
  var dockTimer = null;
  var dockBackupTimer = null;
  var parkTimer = null;
  var dockGen = 0;
  var docked = false;
  var hiding = false;
  var safetyTimer = null;
  var SAFETY_TIMEOUT_MS = 5000;

  function clearDockTimers() {
    if (dockTimer) {
      clearTimeout(dockTimer);
      dockTimer = null;
    }
    if (dockBackupTimer) {
      try {
        cancelAnimationFrame(dockBackupTimer);
      } catch (_caf) {
        try {
          clearTimeout(dockBackupTimer);
        } catch (_ct) {}
      }
      dockBackupTimer = null;
    }
    if (parkTimer) {
      clearTimeout(parkTimer);
      parkTimer = null;
    }
  }

  function scheduleDock() {
    clearDockTimers();
    var myGen = ++dockGen;
    var t0 = performance.now();
    var run = function () {
      if (myGen !== dockGen) return;
      if (activeCount > 0 && el && document.body.contains(el) && !docked) {
        dockToFab();
      }
    };
    /* rAF + performance.now: po blokadzie main-thread (siatka Viz) dock
       odpala się w pierwszej wolnej klatce, gdy minął HOLD wall-clock.
       Sam setTimeout przy ciężkim renderze potrafi spóźnić się ×10. */
    var tick = function (now) {
      if (myGen !== dockGen) return;
      if (docked || activeCount <= 0) return;
      if (now - t0 >= HOLD_CENTER_MS) {
        run();
        return;
      }
      dockBackupTimer = requestAnimationFrame(tick);
    };
    dockBackupTimer = requestAnimationFrame(tick);
    dockTimer = setTimeout(function () {
      dockTimer = null;
      run();
    }, HOLD_CENTER_MS);
  }

  /**
   * Idealnie NAD #damHelpFab: środek X loadera = środek X faba,
   * dół loadera = góra faba - FAB_GAP. (user 2026-07-20: nie za daleko w prawo)
   */
  function dockAnchor(loaderW, loaderH) {
    var fab = document.getElementById("damHelpFab");
    var w = loaderW || 38;
    var h = loaderH || 38;
    if (fab) {
      var fr = fab.getBoundingClientRect();
      return {
        left: Math.round(fr.left + fr.width / 2 - w / 2),
        top: Math.round(fr.top - FAB_GAP - h),
      };
    }
    var fb = FAB_FALLBACK;
    return {
      left: Math.round(global.innerWidth - fb.right - fb.size / 2 - w / 2),
      top: Math.round(global.innerHeight - fb.bottom - fb.size - FAB_GAP - h),
    };
  }

  function prefersReducedMotion() {
    return (
      global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /* GSAP ladowany tym samym wzorcem co dam-grid-reveal.js (wspólny tag). */
  function loadGsap(cb) {
    if (global.gsap) {
      cb(global.gsap);
      return;
    }
    var existing = document.querySelector('script[data-dam-gsap="1"]');
    if (existing) {
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        cb(global.gsap || null);
      };
      existing.addEventListener("load", finish);
      if (global.gsap) finish();
      return;
    }
    var s = document.createElement("script");
    s.src = "./assets/vendor/js/gsap/gsap.min.js";
    s.setAttribute("data-dam-gsap", "1");
    s.onload = function () {
      cb(global.gsap || null);
    };
    s.onerror = function () {
      cb(null);
    };
    document.body.appendChild(s);
  }

  function ensureCss() {
    if (document.getElementById(STYLE_ID)) return;
    var stale = document.getElementById("damLoaderCss");
    if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      "#damLoader{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);" +
      "z-index:" + Z_INDEX + ";pointer-events:none;display:flex;align-items:center;justify-content:center;gap:12px;" +
      "box-sizing:border-box;background:#fff;border:1px solid rgb(171 84 219 / .28);border-radius:999px;" +
      /* Inner padding larger so label+bar breathe (vizCtaNav20260721b) */
      "padding:16px 24px;box-shadow:0 14px 38px rgb(23 22 30 / .18);opacity:0;" +
      "will-change:left,top,opacity;}" +
      "#damLoader .dam-loader__spin{width:18px;height:18px;flex:0 0 18px;border-radius:50%;" +
      "border:2.5px solid rgb(171 84 219 / .22);border-top-color:#ab54db;" +
      "animation:damLoaderSpin .8s linear infinite;box-sizing:border-box;}" +
      "#damLoader .dam-loader__inner{display:flex;align-items:center;gap:12px;padding:2px 0;overflow:hidden;white-space:nowrap;}" +
      "#damLoader .dam-loader__label{font-size:12.5px;font-weight:600;color:#464255;" +
      "font-family:inherit;letter-spacing:.01em;}" +
      "#damLoader .dam-loader__bar{position:relative;width:160px;height:5px;border-radius:999px;" +
      "background:rgb(171 84 219 / .16);overflow:hidden;flex:0 0 auto;}" +
      "#damLoader .dam-loader__bar::after{content:\"\";position:absolute;top:0;bottom:0;left:-40%;width:40%;" +
      "border-radius:999px;background:linear-gradient(90deg,#c07ae6,#ab54db);" +
      "animation:damLoaderSlide 1.5s cubic-bezier(.45,.05,.55,.95) infinite;}" +
      "@keyframes damLoaderSlide{0%{left:-40%}100%{left:105%}}" +
      "@keyframes damLoaderSpin{to{transform:rotate(360deg)}}" +
      "@media (prefers-reduced-motion: reduce){" +
      "#damLoader .dam-loader__bar::after{animation:none!important;}" +
      "#damLoader .dam-loader__spin{animation:none!important;border-top-color:rgb(171 84 219 / .45);}}";
    document.head.appendChild(s);
  }

  function ensureEl() {
    if (el && document.body.contains(el)) return el;
    docked = false;
    ensureCss();
    el = document.createElement("div");
    el.id = "damLoader";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML =
      '<span class="dam-loader__spin" aria-hidden="true"></span>' +
      '<span class="dam-loader__inner">' +
      '<span class="dam-loader__label"></span>' +
      '<span class="dam-loader__bar" aria-hidden="true"></span>' +
      "</span>";
    document.body.appendChild(el);
    innerEl = el.querySelector(".dam-loader__inner");
    labelEl = el.querySelector(".dam-loader__label");
    return el;
  }

  function parkAboveFab() {
    if (!el) return;
    docked = true;
    if (innerEl) {
      innerEl.style.display = "none";
      innerEl.style.width = "";
      innerEl.style.opacity = "";
      innerEl.style.gap = "";
    }
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.transform = "none";
    el.style.transition = "none";
    /* Kolko: outer size (border-box) = wysokosc pilla; potem remeasure → idealny środek nad FAB */
    var size = Math.round(el.getBoundingClientRect().height) || 38;
    el.style.boxSizing = "border-box";
    el.style.width = size + "px";
    el.style.paddingLeft = "10px";
    el.style.paddingRight = "10px";
    void el.offsetWidth;
    var outer = el.getBoundingClientRect();
    var a = dockAnchor(outer.width || size, outer.height || size);
    el.style.left = a.left + "px";
    el.style.top = a.top + "px";
    el.style.opacity = "1";
  }

  function setCornerNow() {
    parkAboveFab();
  }

  /**
   * Dock przez CSS transition (nie GSAP) — na wizualizacjach ticker GSAP
   * bywa zamrozony przez grid-reveal i tweeny zostaja na progress:0.
   */
  function dockToFab() {
    if (!activeCount || !el || docked) return;
    docked = true;
    var rect = el.getBoundingClientRect();
    el.style.transition = "none";
    el.style.transform = "none";
    el.style.boxSizing = "border-box";
    el.style.left = rect.left + "px";
    el.style.top = rect.top + "px";
    el.style.opacity = "1";
    if (innerEl) {
      innerEl.style.transition = "opacity .22s ease, width .22s ease";
      innerEl.style.opacity = "0";
      innerEl.style.width = "0px";
      innerEl.style.overflow = "hidden";
    }
    /* Outer diameter = wysokość pilla (border-box); left/top od realnego outer size */
    var targetSize = Math.round(rect.height) || 38;
    el.style.width = targetSize + "px";
    el.style.paddingLeft = "10px";
    el.style.paddingRight = "10px";
    void el.offsetWidth;
    var outerW = el.getBoundingClientRect().width || targetSize;
    var a = dockAnchor(outerW, targetSize);
    /* Cofnij width do pełnego pilla na start tweenu, potem animuj do kółka */
    el.style.width = rect.width + "px";
    void el.offsetWidth;
    /* Translate dock duration = 0.5s (hold1sDock05s20260721a) */
    el.style.transition =
      "left " +
      DOCK_MS / 1000 +
      "s cubic-bezier(0.45, 0.05, 0.55, 0.95), top " +
      DOCK_MS / 1000 +
      "s cubic-bezier(0.45, 0.05, 0.55, 0.95), width " +
      DOCK_MS / 1000 +
      "s cubic-bezier(0.45, 0.05, 0.55, 0.95), opacity .2s ease";
    el.style.left = a.left + "px";
    el.style.top = a.top + "px";
    el.style.width = targetSize + "px";
    var parkGen = dockGen;
    if (parkTimer) clearTimeout(parkTimer);
    parkTimer = global.setTimeout(function () {
      parkTimer = null;
      if (parkGen !== dockGen || !el || !activeCount) return;
      parkAboveFab();
    }, DOCK_MS + 50);
  }

  function dockWithGsap() {
    /* Alias — historyczna nazwa; GSAP nie jest wymagany do docka. */
    dockToFab();
  }

  function start(label) {
    activeCount += 1;
    hiding = false;
    ensureEl();
    /* Etykieta zawsze "ładowanie" (HARD 2026-07-21) - ignoruj stare
       napisy call-site typu "Skojarzenia…". Param label zachowany w API. */
    if (labelEl) labelEl.textContent = LOADER_LABEL;
    if (global.gsap) global.gsap.killTweensOf([el, innerEl]);

    if (activeCount > 1 && docked) {
      /* juz zaparkowany w rogu - zostaje */
      el.style.opacity = "1";
      el.style.visibility = "visible";
      return;
    }

    docked = false;
    if (innerEl) {
      innerEl.style.display = "";
      innerEl.style.width = "";
      innerEl.style.opacity = "";
      innerEl.style.gap = "";
    }
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.width = "";
    el.style.paddingLeft = "";
    el.style.paddingRight = "";
    el.style.visibility = "visible";

    if (prefersReducedMotion()) {
      clearDockTimers();
      parkAboveFab();
      return;
    }

    el.style.left = "50%";
    el.style.top = "42%";
    el.style.transform = "translate(-50%,-50%)";
    el.style.opacity = "0";
    /* fade-in przez rAF (transition-less, GSAP moze nie byc jeszcze zaladowany) */
    requestAnimationFrame(function () {
      if (!el || hiding) return;
      el.style.transition = "opacity .18s ease";
      el.style.opacity = "1";
    });
    /* GSAP prefetch w tle, dock po HOLD_CENTER_MS */
    loadGsap(function () {});
    scheduleDock();
    if (safetyTimer) clearTimeout(safetyTimer);
    safetyTimer = setTimeout(function () {
      safetyTimer = null;
      if (activeCount > 0) {
        reset();
      }
    }, SAFETY_TIMEOUT_MS);
  }

  function done() {
    if (activeCount <= 0) return;
    activeCount -= 1;
    if (activeCount > 0 || !el) return;
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
    hiding = true;
    clearDockTimers();
    dockGen += 1;
    var finish = function () {
      if (!el) return;
      el.style.opacity = "0";
      docked = false;
    };
    if (global.gsap && !prefersReducedMotion()) {
      global.gsap.killTweensOf([el, innerEl]);
      global.gsap.to(el, {
        opacity: 0,
        duration: 0.28,
        ease: "power2.out",
        onComplete: function () {
          docked = false;
        },
      });
    } else {
      finish();
    }
  }

  function reset() {
    activeCount = 0;
    hiding = false;
    clearDockTimers();
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
    dockGen += 1;
    if (el) {
      if (global.gsap) global.gsap.killTweensOf([el, innerEl]);
      el.style.opacity = "0";
      el.style.width = "";
      el.style.paddingLeft = "";
      el.style.paddingRight = "";
    }
    docked = false;
  }

  global.DamLoader = {
    start: start,
    done: done,
    reset: reset,
    isActive: function () {
      return activeCount > 0;
    },
  };
})(window);
