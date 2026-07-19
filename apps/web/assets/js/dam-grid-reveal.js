/**
 * DAM — wspólny reveal siatki (GSAP clipPath gora->dol, jak Projekty).
 * prefers-reduced-motion = pomija animacje.
 */
(function (global) {
  "use strict";

  var STAGGER_EACH = 0.035;
  var DURATION = 0.2;

  function prefersReducedMotion() {
    return (
      global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function clearRevealStyles(nodes) {
    nodes.forEach(function (el) {
      el.style.opacity = "";
      el.style.visibility = "";
      el.style.clipPath = "";
    });
  }

  function loadGsap(cb) {
    if (global.gsap) {
      cb(global.gsap);
      return;
    }
    var existing = document.querySelector('script[data-dam-gsap="1"]');
    if (existing) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        cb(global.gsap || null);
      }
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

  function resolveNodes(container, selector) {
    if (!container || !selector) return [];
    if (typeof selector === "string") {
      return Array.prototype.slice.call(container.querySelectorAll(selector));
    }
    if (selector instanceof Element) return [selector];
    if (typeof selector.length === "number") {
      return Array.prototype.slice.call(selector);
    }
    return [];
  }

  /**
   * @param {Element} container
   * @param {string|Element|NodeList} selector
   * @param {{ stagger?: number, duration?: number }} [opts]
   */
  function reveal(container, selector, opts) {
    opts = opts || {};
    var nodes = resolveNodes(container, selector);
    if (!nodes.length) return;

    if (prefersReducedMotion()) {
      clearRevealStyles(nodes);
      return;
    }

    loadGsap(function (gsap) {
      if (!gsap) {
        clearRevealStyles(nodes);
        return;
      }
      gsap.killTweensOf(nodes);
      gsap.fromTo(
        nodes,
        {
          autoAlpha: 0,
          clipPath: "inset(0% 0% 100% 0%)",
        },
        {
          autoAlpha: 1,
          clipPath: "inset(0% 0% 0% 0%)",
          duration: opts.duration != null ? opts.duration : DURATION,
          ease: "power1.out",
          stagger: {
            each: opts.stagger != null ? opts.stagger : STAGGER_EACH,
            from: "start",
          },
          overwrite: true,
          clearProps: "clipPath",
        }
      );
    });
  }

  global.DamGridReveal = {
    reveal: reveal,
    selectors: {
      projectCard: ".dam-project-card",
      vizCard: ".dam-viz-card",
      brandingCard: ".dam-branding-card",
      brandingRecent: ".dam-branding-recent__item",
      explorerRow: ".dam-prod-row, .dam-carrier-toggle-row",
      dashboardWidget: ".dam-widget",
      inboxItem: ".dam-inbox-item[data-id]",
    },
  };
})(window);
