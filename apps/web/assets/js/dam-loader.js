/**
 * DAM - Globalny wskaznik ladowania (window.DamLoader).
 *
 * API:
 *   DamLoader.start("Wyszukuję…")  - pokazuje pasek na srodku ekranu
 *   DamLoader.done()               - konczy (fade out)
 *
 * Zachowanie: pasek indeterminate w bialym pill-boxie na srodku (1 s),
 * potem GSAP (power2.inOut) plynnie przenosi go do prawego dolnego rogu
 * jako maly spinner NAD help fabem (#damHelpFab). pointer-events: none,
 * z-index 13000 - niczego nie blokuje i nic go nie zaslania.
 * prefers-reduced-motion: bez animacji przenoszenia (od razu rog).
 */
(function (global) {
  "use strict";

  var STYLE_ID = "damLoaderCss";
  var HOLD_CENTER_MS = 1000;
  var Z_INDEX = 13000;
  /* Help fab siedzi ~24px od prawej/dolu i ma ~48px - loader parkuje wyzej. */
  var CORNER_RIGHT = 24;
  var CORNER_BOTTOM = 92;

  var el = null;
  var innerEl = null;
  var labelEl = null;
  var activeCount = 0;
  var dockTimer = null;
  var docked = false;
  var hiding = false;

  function prefersReducedMotion() {
    return (
      global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /* GSAP ladowany tym samym wzorcem co dam-grid-reveal.js (wspolny tag). */
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
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      "#damLoader{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);" +
      "z-index:" + Z_INDEX + ";pointer-events:none;display:flex;align-items:center;gap:10px;" +
      "background:#fff;border:1px solid rgb(171 84 219 / .28);border-radius:999px;" +
      "padding:10px 16px;box-shadow:0 14px 38px rgb(23 22 30 / .18);opacity:0;" +
      "will-change:left,top,opacity;}" +
      "#damLoader .dam-loader__spin{width:18px;height:18px;flex:0 0 18px;border-radius:50%;" +
      "border:2.5px solid rgb(171 84 219 / .22);border-top-color:#ab54db;" +
      "animation:damLoaderSpin .8s linear infinite;box-sizing:border-box;}" +
      "#damLoader .dam-loader__inner{display:flex;align-items:center;gap:10px;overflow:hidden;white-space:nowrap;}" +
      "#damLoader .dam-loader__label{font-size:12.5px;font-weight:600;color:#464255;" +
      "font-family:inherit;letter-spacing:.01em;}" +
      "#damLoader .dam-loader__bar{position:relative;width:160px;height:5px;border-radius:999px;" +
      "background:rgb(171 84 219 / .16);overflow:hidden;flex:0 0 auto;}" +
      "#damLoader .dam-loader__bar::after{content:\"\";position:absolute;top:0;bottom:0;left:-40%;width:40%;" +
      "border-radius:999px;background:linear-gradient(90deg,#c07ae6,#ab54db);" +
      "animation:damLoaderSlide 1.1s cubic-bezier(.45,.05,.55,.95) infinite;}" +
      "@keyframes damLoaderSlide{0%{left:-40%}100%{left:105%}}" +
      "@keyframes damLoaderSpin{to{transform:rotate(360deg)}}" +
      "@media (prefers-reduced-motion: reduce){" +
      "#damLoader .dam-loader__bar::after{animation-duration:2.2s;}" +
      "#damLoader .dam-loader__spin{animation-duration:1.6s;}}";
    document.head.appendChild(s);
  }

  function ensureEl() {
    if (el && document.body.contains(el)) return el;
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

  function setCornerNow() {
    /* Bez animacji: od razu maly spinner w rogu (reduced motion / fallback). */
    docked = true;
    if (innerEl) innerEl.style.display = "none";
    el.style.left = "auto";
    el.style.top = "auto";
    el.style.right = CORNER_RIGHT + "px";
    el.style.bottom = CORNER_BOTTOM + "px";
    el.style.transform = "none";
    el.style.opacity = "1";
  }

  function dockWithGsap() {
    loadGsap(function (gsap) {
      /* Sesja mogla sie skonczyc zanim GSAP wstal */
      if (!gsap || !activeCount || !el || docked) {
        if (!gsap && activeCount && el && !docked) setCornerNow();
        return;
      }
      docked = true;
      var rect = el.getBoundingClientRect();
      var targetW = rect.height; /* pill -> kolko (spinner + padding) */
      var targetLeft = global.innerWidth - CORNER_RIGHT - targetW;
      var targetTop = global.innerHeight - CORNER_BOTTOM - rect.height;
      var tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
      tl.to(innerEl, { width: 0, opacity: 0, gap: 0, duration: 0.3 });
      tl.to(
        el,
        {
          left: targetLeft,
          top: targetTop,
          xPercent: 0,
          yPercent: 0,
          duration: 0.6,
          onComplete: function () {
            if (innerEl) innerEl.style.display = "none";
          },
        },
        "<0.08"
      );
    });
  }

  function start(label) {
    activeCount += 1;
    hiding = false;
    ensureEl();
    if (labelEl) labelEl.textContent = label || "Ładowanie…";
    if (global.gsap) global.gsap.killTweensOf([el, innerEl]);
    if (dockTimer) clearTimeout(dockTimer);

    if (activeCount > 1 && docked) {
      /* juz zaparkowany w rogu - zostaje */
      el.style.opacity = "1";
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

    if (prefersReducedMotion()) {
      setCornerNow();
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
    dockTimer = setTimeout(function () {
      dockTimer = null;
      if (activeCount > 0 && el) dockWithGsap();
    }, HOLD_CENTER_MS);
  }

  function done() {
    if (activeCount <= 0) return;
    activeCount -= 1;
    if (activeCount > 0 || !el) return;
    hiding = true;
    if (dockTimer) {
      clearTimeout(dockTimer);
      dockTimer = null;
    }
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
    if (dockTimer) {
      clearTimeout(dockTimer);
      dockTimer = null;
    }
    if (el) el.style.opacity = "0";
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
