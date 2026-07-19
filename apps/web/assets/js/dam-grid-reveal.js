/**
 * DAM — wspólny silnik animacji "reveal" (GSAP).
 *
 * Dwa tryby:
 *  1) reveal(container, selector)          -> siatki kart/wierszy. Animacja
 *     odslania sie GORA->DOL (clipPath) + fade, ale KAZDY element startuje
 *     dopiero, gdy wjedzie w viewport (IntersectionObserver) — jak na
 *     prawdziwej stronie www.
 *  2) revealSequence(container, selector)  -> tresci modali / sidebar. Kaskada
 *     od gory do dolu: fade (mode:"fade") albo fade + zjazd z gory (mode:"slide").
 *
 * Modale (.dam-viz-modal-overlay) sa wykrywane globalnie i animowane bez
 * modyfikacji ich wlasnego JS (obserwator DOM). Sidebar animuje sie przy
 * wejsciu na strone. #damHelpFab i inne stale przyciski NIE sa animowane.
 *
 * prefers-reduced-motion = pomija animacje (elementy od razu widoczne).
 */
(function (global) {
  "use strict";

  // Tempo (medium): ~0.45s na element, 0.05s odstepu miedzy elementami.
  var DURATION = 0.45;
  var STAGGER_EACH = 0.05;
  var EASE = "power2.out";
  var VIEWPORT_THRESHOLD = 0.01;
  // Element musi wejsc ~50px w viewport zanim sie odsloni (nie tuz przy krawedzi,
  // zeby animacja byla widoczna, a nie "juz sie stala" poza ekranem).
  var VIEWPORT_MARGIN = 50;

  // "Belki": toolbary, paski filtrow, context bar, changelog. Animowane jako
  // bloki (nie per-element) przez revealBars(); jednorazowo (znacznik dataset).
  var BARS_SELECTOR = [
    ".dam-branding-context",
    ".dam-branding-toolbar",
    ".dam-branding-grid-toolbar",
    ".dam-branding-tag-filters",
    ".dam-tag-groups",
    ".dam-explorer-toolbar",
    ".dam-viz-toolbar",
    ".dam-viz-grid-toolbar",
    ".dam-product-toolbar",
    ".dam-projects-grid-toolbar",
    ".dam-changelog-bar",
    ".dam-inbox-toolbar",
    ".dam-dash-toolbar"
  ].join(",");

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
      el.style.transform = "";
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
    if (!selector && container && container.nodeType === 1 && !arguments[1]) {
      return [container];
    }
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

  // ---------------------------------------------------------------------------
  // 1) Siatki — reveal z bramka viewportu
  // ---------------------------------------------------------------------------

  var gridObserver = null;
  var nodeCfg = typeof WeakMap === "function" ? new WeakMap() : null;

  function animateClip(gsap, nodes, opts) {
    gsap.killTweensOf(nodes);
    // UWAGA: uzywamy opacity (nie autoAlpha) i NIE trzymamy clip-path w stanie
    // spoczynku. Collapsing clip-path zeruje prostokat elementu, przez co
    // IntersectionObserver raportuje ratio 0 i reveal nigdy by sie nie odpalil.
    gsap.fromTo(
      nodes,
      { opacity: 0, clipPath: "inset(0% 0% 100% 0%)" },
      {
        opacity: 1,
        clipPath: "inset(0% 0% 0% 0%)",
        duration: opts.duration != null ? opts.duration : DURATION,
        ease: EASE,
        stagger: {
          each: opts.stagger != null ? opts.stagger : STAGGER_EACH,
          from: "start",
        },
        overwrite: true,
        clearProps: "clipPath,opacity",
      }
    );
  }

  function ensureGridObserver(gsap) {
    if (gridObserver || !global.IntersectionObserver) return gridObserver;
    gridObserver = new IntersectionObserver(
      function (entries) {
        var hits = [];
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            gridObserver.unobserve(entry.target);
            hits.push(entry.target);
          }
        });
        if (!hits.length) return;
        // Kolejnosc gora->dol niezaleznie od kolejnosci callbacku IO.
        hits.sort(function (a, b) {
          return (
            a.getBoundingClientRect().top - b.getBoundingClientRect().top
          );
        });
        var cfg = (nodeCfg && nodeCfg.get(hits[0])) || {};
        animateClip(gsap, hits, cfg);
      },
      {
        threshold: VIEWPORT_THRESHOLD,
        rootMargin: "0px 0px -" + VIEWPORT_MARGIN + "px 0px",
      }
    );
    return gridObserver;
  }

  /**
   * Reveal siatki: elementy odslaniaja sie po kolei od gory, ale dopiero po
   * wejsciu w viewport.
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
      var observer = ensureGridObserver(gsap);
      if (!observer) {
        // Brak IntersectionObserver -> animuj od razu (fallback).
        animateClip(gsap, nodes, opts);
        return;
      }
      gsap.set(nodes, { opacity: 0 });
      // Elementy widoczne juz na starcie animujemy w JEDNEJ sekwencji gora->dol,
      // zeby nie "wyskakiwaly poza kolejnoscia" zanim pokaze sie pierwszy. Reszta
      // (ponizej ekranu) odslania sie przez IntersectionObserver przy scrollu.
      var vh =
        global.innerHeight || document.documentElement.clientHeight || 0;
      var inView = [];
      var below = [];
      nodes.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < vh - VIEWPORT_MARGIN && r.bottom > 0) {
          inView.push(el);
        } else {
          below.push(el);
        }
      });
      if (inView.length) {
        inView.sort(function (a, b) {
          return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
        });
        animateClip(gsap, inView, opts);
      }
      below.forEach(function (el) {
        if (nodeCfg) nodeCfg.set(el, opts);
        observer.observe(el);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 2) Tresci (modale, sidebar) — kaskada od razu, bez bramki viewportu
  // ---------------------------------------------------------------------------

  /**
   * @param {Element} container
   * @param {string|Element|NodeList} selector
   * @param {{ mode?: "fade"|"slide", stagger?: number, duration?: number,
   *           delay?: number, y?: number }} [opts]
   */
  function revealSequence(container, selector, opts) {
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
      var mode = opts.mode || "slide";
      var from = { autoAlpha: 0 };
      var to = {
        autoAlpha: 1,
        duration: opts.duration != null ? opts.duration : DURATION,
        ease: EASE,
        delay: opts.delay || 0,
        stagger: {
          each: opts.stagger != null ? opts.stagger : STAGGER_EACH,
          from: "start",
        },
        overwrite: true,
        clearProps: "transform,visibility,opacity",
      };
      if (mode !== "fade") {
        from.y = opts.y != null ? opts.y : -14;
        to.y = 0;
      }
      gsap.killTweensOf(nodes);
      gsap.fromTo(nodes, from, to);
    });
  }

  // ---------------------------------------------------------------------------
  // Belki (toolbary / paski filtrow / context bar) — reveal jako bloki
  // ---------------------------------------------------------------------------

  function isVisible(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  /**
   * Odslania "belki" obecne pod root. Kazda belka animuje sie raz
   * (znacznik data-dam-bar-revealed), wiec przerysowania siatki przy
   * filtrowaniu nie powoduja migotania, a nowo pokazana belka (np. context
   * bar po wybraniu filtra) dostaje wejscie.
   * @param {Element|Document} [root]
   */
  function revealBars(root) {
    if (prefersReducedMotion()) return;
    root = root || document;
    var all = Array.prototype.slice.call(root.querySelectorAll(BARS_SELECTOR));
    var fresh = all.filter(function (el) {
      return el.getAttribute("data-dam-bar-revealed") !== "1" && isVisible(el);
    });
    if (!fresh.length) return;
    fresh.forEach(function (el) {
      el.setAttribute("data-dam-bar-revealed", "1");
    });
    revealSequence(root, fresh, { mode: "slide", stagger: 0.06, y: -10 });
  }

  // ---------------------------------------------------------------------------
  // Modale — generyczny reveal przy otwarciu (obserwator DOM)
  // ---------------------------------------------------------------------------

  function isModalOverlay(node) {
    if (!node || node.nodeType !== 1 || !node.classList) return false;
    return node.classList.contains("dam-viz-modal-overlay");
  }

  function revealModal(overlay) {
    if (prefersReducedMotion()) return;
    var box = overlay.querySelector(".dam-viz-modal-box") || overlay;
    var thumb = box.querySelector(".dam-viz-modal__thumb");
    var body = box.querySelector(".dam-viz-modal__body");

    if (thumb) {
      revealSequence(thumb, thumb, { mode: "fade", duration: 0.35 });
    }
    if (body && body.children.length) {
      var kids = Array.prototype.slice.call(body.children);
      revealSequence(body, kids, {
        mode: "slide",
        stagger: STAGGER_EACH,
        delay: thumb ? 0.06 : 0,
      });
    } else if (!body) {
      var boxKids = Array.prototype.slice.call(box.children).filter(function (el) {
        return !el.classList || !el.classList.contains("dam-viz-modal-close");
      });
      revealSequence(box, boxKids, { mode: "slide", stagger: STAGGER_EACH });
    }
  }

  function initModalObserver() {
    if (!global.MutationObserver || !document.body) return;
    var mo = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (isModalOverlay(n)) {
            global.requestAnimationFrame(function () {
              revealModal(n);
            });
          }
        });
      });
    });
    mo.observe(document.body, { childList: true });
  }

  // ---------------------------------------------------------------------------
  // Sidebar — reveal menu przy wejsciu na strone
  // ---------------------------------------------------------------------------

  function revealSidebarWhenReady() {
    if (prefersReducedMotion()) return;
    var sidebar = document.getElementById("damSidebar");
    if (!sidebar) return;

    function tryReveal() {
      var items = sidebar.querySelectorAll(".geex-sidebar__menu__item");
      if (!items.length) return false;
      revealSequence(sidebar, items, {
        mode: "slide",
        stagger: 0.04,
        duration: 0.4,
        y: -10,
      });
      return true;
    }

    if (tryReveal()) return;
    if (!global.MutationObserver) return;
    // Nav budowany jest przez dam-shell.js po zaladowaniu — poczekaj na items.
    var mo = new MutationObserver(function () {
      if (tryReveal()) mo.disconnect();
    });
    mo.observe(sidebar, { childList: true, subtree: true });
    setTimeout(function () {
      mo.disconnect();
    }, 4000);
  }

  // ---------------------------------------------------------------------------
  // Auto-init
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Wejscie strony — tytul + podtytul + belki, kaskada gora->dol
  // ---------------------------------------------------------------------------

  // Sidebar oraz pasek akcji naglowka (#damHeaderAction: Pliki/Baza/PL/ADMIN)
  // NIE animuja sie tym reveal. Sidebar ma tylko morph przy zwijaniu/rozwijaniu.

  function revealPageEntrance() {
    if (prefersReducedMotion()) return;
    var seq = [];
    var title = document.querySelector(".geex-content__header__title");
    var sub = document.querySelector(".geex-content__header__subtitle");
    if (title) seq.push(title);
    if (sub) seq.push(sub);
    Array.prototype.forEach.call(
      document.querySelectorAll(BARS_SELECTOR),
      function (el) {
        if (el.getAttribute("data-dam-bar-revealed") !== "1" && isVisible(el)) {
          el.setAttribute("data-dam-bar-revealed", "1");
          seq.push(el);
        }
      }
    );
    if (!seq.length) return;
    // Twarda kolejnosc gora->dol niezaleznie od kolejnosci w DOM.
    seq.sort(function (a, b) {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });
    revealSequence(document, seq, { mode: "slide", stagger: 0.06, y: -12 });
  }

  // ---------------------------------------------------------------------------
  // Wiersze / pozycje list (tabele faktur, kosztow) — fade + lekki zjazd
  // ---------------------------------------------------------------------------

  function revealRows(container, selector, opts) {
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
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: opts.duration != null ? opts.duration : 0.4,
          ease: EASE,
          stagger: {
            each: opts.stagger != null ? opts.stagger : 0.04,
            from: "start",
          },
          overwrite: true,
          clearProps: "transform,visibility,opacity",
        }
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Skeleton loading (shimmer) — placeholder ksztaltu tresci podczas ladowania
  // ---------------------------------------------------------------------------

  function skeleton(mount, opts) {
    if (!mount) return;
    opts = opts || {};
    var count = opts.count || 5;
    var variant = opts.variant || "lines";
    var i;
    if (mount.tagName === "TBODY") {
      var cols = opts.cols || 6;
      var rows = "";
      for (i = 0; i < count; i++) {
        rows +=
          '<tr class="dam-skeleton-tr"><td colspan="' +
          cols +
          '"><span class="dam-skeleton__line"></span></td></tr>';
      }
      mount.innerHTML = rows;
      return;
    }
    var cls = "dam-skeleton";
    if (variant === "cards") cls += " dam-skeleton--grid";
    var html = '<div class="' + cls + '" aria-hidden="true">';
    for (i = 0; i < count; i++) {
      if (variant === "cards") {
        html += '<div class="dam-skeleton__card"></div>';
      } else if (variant === "rows") {
        html += '<div class="dam-skeleton__row"></div>';
      } else {
        html +=
          '<div class="dam-skeleton__line" style="width:' +
          (62 + ((i * 13) % 34)) +
          '%"></div>';
      }
    }
    html += "</div>";
    mount.innerHTML = html;
  }

  function autoInit() {
    initModalObserver();
    if (global.requestAnimationFrame) {
      global.requestAnimationFrame(revealPageEntrance);
    } else {
      revealPageEntrance();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }

  global.DamGridReveal = {
    reveal: reveal,
    revealSequence: revealSequence,
    revealModal: revealModal,
    revealBars: revealBars,
    revealRows: revealRows,
    revealPageEntrance: revealPageEntrance,
    skeleton: skeleton,
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
