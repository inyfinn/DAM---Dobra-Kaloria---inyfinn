/**
 * DAM - pelnoekranowy lightbox podgladu materialu (2.4.1).
 *
 * Otwierany dwuklikiem na duzym obrazie w modalu podgladu (dam-media-preview.js).
 * Pokazuje ten sam material na calym oknie przegladarki (dopasowanie = object-fit
 * contain), z zoomem kolkiem, przesuwaniem, pinch na dotyku i dwuklikiem
 * dopasuj <-> 100%.
 *
 * Zrodlo obrazu: najpierw to, co modal juz ma w pamieci (natychmiast), potem
 * oryginal (/media z mostu) podmieniany po zaladowaniu. GIF zostaje GIF-em
 * (animacja), bo oryginal to plik zrodlowy, nie miniatura AVIF.
 *
 * API: window.DamLightbox.open({ src, placeholderSrc, alt, returnFocusEl, nav })
 *   nav (opcjonalnie): { hasPrev(), hasNext(), go(dir) -> {src, placeholderSrc, alt} | null }
 * Czyste funkcje (fitScale, clampPan, zoomAt) wystawione dla testow node.
 */
(function (global) {
  "use strict";

  /* Fallback PL = kanoniczne wartosci z i18n/pl.json (te same klucze). */
  var FALLBACK = {
    "lightbox.label": "Podgląd na pełnym ekranie",
    "lightbox.close": "Zamknij pełny ekran",
    "lightbox.prev": "Poprzedni materiał",
    "lightbox.next": "Następny materiał",
    "lightbox.hint": "Scroll: powiększ. Przeciągnij: przesuń. Dwuklik: dopasuj/100%. Esc: zamknij.",
    "lightbox.loading": "Wczytuję oryginał…",
  };

  var MIN_ZOOM_FACTOR = 0.25; /* wzgledem dopasowania */
  var MAX_ZOOM = 8; /* wzgledem 100% pikseli */
  var DRAG_SLOP = 5;
  var DOUBLE_TAP_MS = 300;
  var DOUBLE_TAP_DIST = 30; /* px miedzy tknieciami */
  var TAP_MAX_MS = 350; /* dluzej = przytrzymanie, nie tkniecie */
  var TAP_MAX_MOVE = 10; /* px ruchu palca w obrebie tkniecia */
  var SWIPE_MIN_PX = 60;
  var SWIPE_MAX_MS = 800;

  function tr(key) {
    var fb = FALLBACK[key] || key;
    var i18n = global.DamI18n;
    if (i18n && typeof i18n.t === "function") {
      var v = i18n.t(key);
      if (v && v !== key) return typeof i18n.nbspPl === "function" ? i18n.nbspPl(v) : v;
    }
    return fb;
  }

  /* ---------- czysta geometria (testowana w node) ---------- */

  function fitScale(nw, nh, vw, vh) {
    if (!(nw > 0) || !(nh > 0) || !(vw > 0) || !(vh > 0)) return 1;
    return Math.min(vw / nw, vh / nh);
  }

  /** Obraz mniejszy niz okno -> wysrodkowany; wiekszy -> krawedzie nie odjezdzaja do srodka. */
  function clampPan(tx, ty, scale, nw, nh, vw, vh) {
    var w = nw * scale;
    var h = nh * scale;
    var x = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, tx));
    var y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, ty));
    return { x: x, y: y };
  }

  /** Zoom wokol punktu (px, py) w ukladzie okna: punkt pod kursorem zostaje w miejscu. */
  function zoomAt(state, nextScale, px, py) {
    var k = nextScale / state.scale;
    return {
      scale: nextScale,
      x: px - (px - state.x) * k,
      y: py - (py - state.y) * k,
    };
  }

  function clampScale(s, fit) {
    var lo = Math.min(fit, 1) * MIN_ZOOM_FACTOR;
    var hi = Math.max(MAX_ZOOM, fit);
    return Math.max(lo, Math.min(hi, s));
  }

  /* ---------- czyste gesty (testowane w node) ---------- */

  /** Tkniecie = krotko i prawie bez ruchu. down/up: {t, x, y}. */
  function isTap(down, up) {
    if (!down || !up) return false;
    return up.t - down.t <= TAP_MAX_MS && Math.hypot(up.x - down.x, up.y - down.y) <= TAP_MAX_MOVE;
  }

  /** Dwa tkniecia < 300 ms i blisko siebie = podwojne tkniecie. */
  function isDoubleTap(prev, cur) {
    if (!prev || !cur) return false;
    var dt = cur.t - prev.t;
    return dt > 0 && dt < DOUBLE_TAP_MS && Math.hypot(cur.x - prev.x, cur.y - prev.y) <= DOUBLE_TAP_DIST;
  }

  /**
   * Przesuniecie palcem przy dopasowaniu -> kierunek nawigacji.
   * Palec w lewo (dx < 0) = nastepny (+1), w prawo = poprzedni (-1), inaczej 0.
   */
  function classifySwipe(dx, dy, dt) {
    if (!(dt >= 0) || dt > SWIPE_MAX_MS) return 0;
    if (Math.abs(dx) < SWIPE_MIN_PX) return 0;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
    return dx < 0 ? 1 : -1;
  }

  function prefersReducedMotion() {
    try {
      return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  /* ---------- DOM ---------- */

  var current = null; /* stan otwartego lightboxa */

  function isOpen() {
    return !!current;
  }

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        n.setAttribute(k, attrs[k]);
      });
    }
    return n;
  }

  function iconBtn(cls, icon, label) {
    var b = el("button", "dam-fs-lightbox__btn " + cls, { type: "button", "aria-label": label, title: label });
    b.innerHTML = '<i class="uil ' + icon + '" aria-hidden="true"></i>';
    return b;
  }

  function open(opts) {
    opts = opts || {};
    if (!opts.src && !opts.placeholderSrc) return false;
    if (current) close();

    var doc = document;
    var root = el("div", "dam-fs-lightbox", {
      id: "damFsLightbox",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": tr("lightbox.label"),
    });
    if (prefersReducedMotion()) root.classList.add("dam-fs-lightbox--no-motion");

    var stage = el("div", "dam-fs-lightbox__stage");
    var img = el("img", "dam-fs-lightbox__img", { draggable: "false", alt: "" });
    img.decoding = "async";
    stage.appendChild(img);

    var closeBtn = iconBtn("dam-fs-lightbox__close", "uil-times", tr("lightbox.close"));
    var prevBtn = null;
    var nextBtn = null;
    if (opts.nav) {
      prevBtn = iconBtn("dam-fs-lightbox__nav dam-fs-lightbox__nav--prev", "uil-angle-left", tr("lightbox.prev"));
      nextBtn = iconBtn("dam-fs-lightbox__nav dam-fs-lightbox__nav--next", "uil-angle-right", tr("lightbox.next"));
    }

    var bar = el("div", "dam-fs-lightbox__bar");
    var caption = el("p", "dam-fs-lightbox__caption");
    var zoomOut = el("span", "dam-fs-lightbox__zoom", { "aria-live": "polite" });
    var hint = el("p", "dam-fs-lightbox__hint");
    hint.textContent = tr("lightbox.hint");
    var loading = el("span", "dam-fs-lightbox__loading", { role: "status" });
    bar.appendChild(caption);
    bar.appendChild(loading);
    bar.appendChild(zoomOut);
    bar.appendChild(hint);

    root.appendChild(stage);
    if (prevBtn) root.appendChild(prevBtn);
    if (nextBtn) root.appendChild(nextBtn);
    root.appendChild(bar);
    root.appendChild(closeBtn);

    /* Tlo pod spodem: modal podgladu nieaktywny (inert), strona bez scrolla. */
    var inertEls = [];
    Array.prototype.forEach.call(doc.body.children, function (c) {
      if (c === root || c.hasAttribute("inert") || c.tagName === "SCRIPT") return;
      c.setAttribute("inert", "");
      inertEls.push(c);
    });
    var html = doc.documentElement;
    var prevHtmlOverflow = html.style.overflow;
    var prevBodyOverflow = doc.body.style.overflow;
    html.style.overflow = "hidden";
    doc.body.style.overflow = "hidden";
    html.classList.add("dam-fs-lightbox-open");

    doc.body.appendChild(root);

    var st = {
      root: root,
      stage: stage,
      img: img,
      nw: 0,
      nh: 0,
      scale: 1,
      x: 0,
      y: 0,
      fit: 1,
      atFit: true,
      token: 0,
      returnFocusEl: opts.returnFocusEl || null,
      nav: opts.nav || null,
      inertEls: inertEls,
      prevHtmlOverflow: prevHtmlOverflow,
      prevBodyOverflow: prevBodyOverflow,
      pointers: {},
      drag: null,
      pinch: null,
      moved: false,
      lastTap: 0,
      listeners: [],
    };
    current = st;

    function on(target, type, fn, o) {
      target.addEventListener(type, fn, o);
      st.listeners.push(function () {
        target.removeEventListener(type, fn, o);
      });
    }

    function viewport() {
      return { w: stage.clientWidth || global.innerWidth, h: stage.clientHeight || global.innerHeight };
    }

    function fitPad() {
      return global.innerWidth < 600 ? 8 : 32;
    }

    function computeFit() {
      var v = viewport();
      var pad = fitPad();
      return fitScale(st.nw, st.nh, Math.max(1, v.w - pad * 2), Math.max(1, v.h - pad * 2));
    }

    function paint(animate) {
      var v = viewport();
      var p = clampPan(st.x, st.y, st.scale, st.nw, st.nh, v.w, v.h);
      st.x = p.x;
      st.y = p.y;
      img.classList.toggle("is-animating", !!animate);
      img.style.width = st.nw + "px";
      img.style.height = st.nh + "px";
      img.style.transform =
        "translate(" + (st.x + (st.swipeDx || 0)) + "px," + st.y + "px) scale(" + st.scale + ")";
      var pannable = isPannable();
      stage.classList.toggle("is-pannable", pannable);
      zoomOut.textContent = st.nw ? Math.round(st.scale * 100) + "%" : "";
    }

    function isPannable() {
      var v = viewport();
      return st.nw * st.scale > v.w + 1 || st.nh * st.scale > v.h + 1;
    }

    function toFit(animate) {
      st.fit = computeFit();
      st.scale = st.fit;
      st.atFit = true;
      st.x = 0;
      st.y = 0;
      paint(animate);
    }

    function setScaleAt(next, px, py, animate) {
      next = clampScale(next, st.fit);
      var z = zoomAt({ scale: st.scale, x: st.x, y: st.y }, next, px, py);
      st.scale = z.scale;
      st.x = z.x;
      st.y = z.y;
      st.atFit = Math.abs(st.scale - st.fit) < 0.001;
      paint(animate);
    }

    function toggleFit(px, py) {
      var anim = !root.classList.contains("dam-fs-lightbox--no-motion");
      if (!st.atFit) {
        toFit(anim);
        return;
      }
      /* dopasowanie -> 100%; gdy oryginal i tak miesci sie w 100%, to 2x */
      var target = Math.abs(st.fit - 1) < 0.02 || st.fit > 1 ? st.fit * 2 : 1;
      setScaleAt(target, px, py, anim);
      st.atFit = false;
    }

    function onDims(w, h, keepView) {
      if (!(w > 0) || !(h > 0)) return;
      if (keepView && st.nw && !st.atFit) {
        /* podmiana na oryginal o innej rozdzielczosci: zachowaj widoczny rozmiar */
        st.scale = st.scale * (st.nw / w);
        st.nw = w;
        st.nh = h;
        st.fit = computeFit();
        paint(false);
        return;
      }
      st.nw = w;
      st.nh = h;
      toFit(false);
    }

    function setSource(src, placeholderSrc, alt) {
      var token = ++st.token;
      img.alt = alt || "";
      caption.textContent = alt || "";
      root.classList.remove("is-ready");
      var first = placeholderSrc || src;
      loading.textContent = "";
      img.onload = function () {
        if (token !== st.token) return;
        root.classList.add("is-ready");
        onDims(img.naturalWidth, img.naturalHeight, false);
      };
      img.onerror = function () {
        if (token !== st.token) return;
        if (src && img.getAttribute("src") !== src) img.src = src;
      };
      img.src = first;
      if (img.complete && img.naturalWidth) img.onload();
      if (src && src !== first) {
        loading.textContent = tr("lightbox.loading");
        var probe = new Image();
        probe.decoding = "async";
        probe.onload = function () {
          if (token !== st.token || !current) return;
          loading.textContent = "";
          img.onload = function () {
            if (token !== st.token) return;
            root.classList.add("is-ready");
            onDims(img.naturalWidth, img.naturalHeight, true);
          };
          img.onerror = null;
          img.src = src;
          img.setAttribute("data-dam-original-ready", "1");
          if (img.complete && img.naturalWidth) img.onload();
        };
        probe.onerror = function () {
          if (token !== st.token) return;
          loading.textContent = "";
        };
        probe.src = src;
      } else if (src) {
        img.setAttribute("data-dam-original-ready", "1");
      }
    }
    st.setSource = setSource;

    function syncNav() {
      if (!st.nav) return;
      var hp = typeof st.nav.hasPrev === "function" ? !!st.nav.hasPrev() : false;
      var hn = typeof st.nav.hasNext === "function" ? !!st.nav.hasNext() : false;
      if (prevBtn) prevBtn.hidden = !hp;
      if (nextBtn) nextBtn.hidden = !hn;
    }

    function go(dir) {
      if (!st.nav || typeof st.nav.go !== "function") return;
      var r = st.nav.go(dir);
      if (r && (r.src || r.placeholderSrc)) {
        setSource(r.src, r.placeholderSrc, r.alt);
      }
      syncNav();
    }

    /* --- wskazniki: przesuwanie, pinch, podwojne tkniecie --- */
    function localPoint(e) {
      var r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    on(stage, "wheel", function (e) {
      e.preventDefault();
      if (!st.nw) return;
      var p = localPoint(e);
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      var factor = Math.exp(-Math.max(-300, Math.min(300, dy)) * 0.0015);
      setScaleAt(st.scale * factor, p.x, p.y, false);
    }, { passive: false });

    on(stage, "pointerdown", function (e) {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      st.pointers[e.pointerId] = localPoint(e);
      st.moved = false;
      var ids = Object.keys(st.pointers);
      if (ids.length === 2) {
        var a = st.pointers[ids[0]];
        var b = st.pointers[ids[1]];
        st.swipeDx = 0;
        st.pinch = {
          dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          scale: st.scale,
          x: st.x,
          y: st.y,
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
        };
        st.drag = null;
      } else if (ids.length === 1) {
        var p0 = st.pointers[ids[0]];
        st.drag = {
          sx: p0.x,
          sy: p0.y,
          x: st.x,
          y: st.y,
          t: Date.now(),
          /* bez przyblizenia palec/mysz w bok = poprzedni/nastepny material */
          swipe: !!st.nav && !isPannable(),
        };
      }
      try {
        stage.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    });

    on(stage, "pointermove", function (e) {
      if (!st.pointers[e.pointerId]) return;
      var p = localPoint(e);
      st.pointers[e.pointerId] = p;
      if (st.pinch) {
        var ids = Object.keys(st.pointers);
        if (ids.length < 2) return;
        var a = st.pointers[ids[0]];
        var b = st.pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        var base = { scale: st.pinch.scale, x: st.pinch.x, y: st.pinch.y };
        var next = clampScale(st.pinch.scale * (d / st.pinch.dist), st.fit);
        var z = zoomAt(base, next, st.pinch.cx, st.pinch.cy);
        st.scale = z.scale;
        st.x = z.x + ((a.x + b.x) / 2 - st.pinch.cx);
        st.y = z.y + ((a.y + b.y) / 2 - st.pinch.cy);
        st.atFit = false;
        st.moved = true;
        paint(false);
        return;
      }
      if (!st.drag) return;
      var dx = p.x - st.drag.sx;
      var dy = p.y - st.drag.sy;
      if (!st.moved && Math.abs(dx) + Math.abs(dy) < DRAG_SLOP) return;
      st.moved = true;
      stage.classList.add("is-panning");
      if (st.drag.swipe) {
        st.swipeDx = dx;
        paint(false);
        return;
      }
      st.x = st.drag.x + dx;
      st.y = st.drag.y + dy;
      paint(false);
    });

    function endPointer(e) {
      if (!st.pointers[e.pointerId]) return;
      var endDrag = st.drag;
      delete st.pointers[e.pointerId];
      try {
        stage.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      if (Object.keys(st.pointers).length < 2) st.pinch = null;
      if (!Object.keys(st.pointers).length) {
        st.drag = null;
        stage.classList.remove("is-panning");
      }
      if (endDrag && endDrag.swipe && st.swipeDx) {
        var pe = localPoint(e);
        var dir =
          e.type === "pointerup"
            ? classifySwipe(pe.x - endDrag.sx, pe.y - endDrag.sy, Date.now() - endDrag.t)
            : 0;
        var canGo =
          dir &&
          st.nav &&
          (dir < 0
            ? typeof st.nav.hasPrev === "function" && st.nav.hasPrev()
            : typeof st.nav.hasNext === "function" && st.nav.hasNext());
        st.swipeDx = 0;
        if (canGo) {
          paint(false);
          go(dir);
        } else {
          paint(!root.classList.contains("dam-fs-lightbox--no-motion"));
        }
        return;
      }
      /* dotyk: podwojne tkniecie = dwuklik (dblclick na dotyku bywa niepewny) */
      if (e.type === "pointerup" && e.pointerType === "touch" && !st.moved) {
        var now = Date.now();
        var pt = localPoint(e);
        var tap = { t: now, x: pt.x, y: pt.y };
        if (isDoubleTap(st.lastTapPt, tap)) {
          st.lastTap = 0;
          st.lastTapPt = null;
          var p = pt;
          toggleFit(p.x, p.y);
          st.suppressClick = true;
          setTimeout(function () {
            st.suppressClick = false;
          }, 500);
        } else {
          st.lastTap = now;
          st.lastTapPt = tap;
        }
      }
    }
    on(stage, "pointerup", endPointer);
    on(stage, "pointercancel", endPointer);

    on(stage, "dblclick", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (st.suppressClick) {
        st.suppressClick = false;
        return;
      }
      var p = localPoint(e);
      toggleFit(p.x, p.y);
    });

    /* klik w tlo (nie w obraz, nie po przeciagnieciu) zamyka */
    on(stage, "click", function (e) {
      if (st.moved) {
        st.moved = false;
        return;
      }
      /* setPointerCapture przekierowuje click na stage - trafienie liczymy z geometrii */
      var ir = img.getBoundingClientRect();
      if (
        e.target === img ||
        (ir.width &&
          e.clientX >= ir.left &&
          e.clientX <= ir.right &&
          e.clientY >= ir.top &&
          e.clientY <= ir.bottom)
      ) {
        return;
      }
      if (e.pointerType === "touch" || st.lastTap) {
        /* na dotyku poczekaj, czy to nie pierwsze z dwoch tkniec */
        var tapAt = st.lastTap;
        setTimeout(function () {
          if (current === st && st.lastTap === tapAt && tapAt) close();
        }, DOUBLE_TAP_MS + 20);
        return;
      }
      close();
    });
    on(bar, "click", function (e) {
      if (e.target === bar) close();
    });

    on(closeBtn, "click", function (e) {
      e.stopPropagation();
      close();
    });
    if (prevBtn) on(prevBtn, "click", function (e) { e.stopPropagation(); go(-1); });
    if (nextBtn) on(nextBtn, "click", function (e) { e.stopPropagation(); go(1); });

    /* klawiatura w fazie capture na window: modal pod spodem nie dostaje Esc/strzalek */
    on(global, "keydown", function (e) {
      if (current !== st) return;
      var k = e.key;
      if (k === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        close();
        return;
      }
      if (k === "ArrowLeft" || k === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        go(k === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (k === "+" || k === "=" || k === "-" || k === "0") {
        e.preventDefault();
        e.stopPropagation();
        var v = viewport();
        if (k === "0") toFit(false);
        else setScaleAt(st.scale * (k === "-" ? 1 / 1.25 : 1.25), v.w / 2, v.h / 2, false);
        return;
      }
      if (k === "Tab") {
        var f = Array.prototype.filter.call(
          root.querySelectorAll("button:not([hidden]):not([disabled])"),
          function (b) {
            return b.offsetParent !== null || b === closeBtn;
          }
        );
        if (!f.length) {
          e.preventDefault();
          return;
        }
        var i = f.indexOf(document.activeElement);
        var n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i >= f.length - 1 ? 0 : i + 1);
        e.preventDefault();
        e.stopPropagation();
        f[n].focus();
      }
    }, true);

    on(global, "resize", function () {
      if (!st.nw) return;
      var wasFit = st.atFit;
      st.fit = computeFit();
      if (wasFit) toFit(false);
      else paint(false);
    });

    syncNav();
    setSource(opts.src, opts.placeholderSrc, opts.alt);
    /* wejscie: fade (bez ruchu przy prefers-reduced-motion - patrz CSS) */
    global.requestAnimationFrame(function () {
      if (current === st) root.classList.add("is-open");
    });
    try {
      closeBtn.focus({ preventScroll: true });
    } catch (err) {
      closeBtn.focus();
    }
    return true;
  }

  function close() {
    var st = current;
    if (!st) return;
    current = null;
    st.token++;
    st.listeners.forEach(function (off) {
      off();
    });
    st.listeners = [];
    st.inertEls.forEach(function (c) {
      c.removeAttribute("inert");
    });
    var html = document.documentElement;
    html.style.overflow = st.prevHtmlOverflow;
    document.body.style.overflow = st.prevBodyOverflow;
    html.classList.remove("dam-fs-lightbox-open");
    if (st.root && st.root.parentNode) st.root.parentNode.removeChild(st.root);
    var back = typeof st.returnFocusEl === "function" ? st.returnFocusEl() : st.returnFocusEl;
    if (back && back.isConnected) {
      try {
        back.focus({ preventScroll: true });
      } catch (err) {
        try {
          back.focus();
        } catch (err2) {
          /* ignore */
        }
      }
    }
  }

  /**
   * Wejscie do lightboxa z duzego obrazu w modalu: dwuklik mysza ORAZ wlasna
   * detekcja podwojnego tkniecia (2 tkniecia < 300 ms, <= 30 px), bo dblclick
   * na dotyku bywa zawodny. Nie wola preventDefault na pointerdown, wiec nie
   * rusza istniejacego przyblizania/przesuwania w modalu (DamModalShared.bindZoom).
   * opts.filter(e) -> false = ignoruj (np. klik w strzalke / brak obrazu).
   * Zwraca funkcje odpinajaca.
   */
  function bindOpenGesture(el, openFn, opts) {
    if (!el || typeof openFn !== "function") return function () {};
    opts = opts || {};
    var filter =
      typeof opts.filter === "function"
        ? opts.filter
        : function () {
            return true;
          };
    var downs = {};
    var active = 0;
    var multi = false;
    var lastTap = null;
    var lastOpen = 0;
    var lastDown = null;

    function fire(e) {
      var now = Date.now();
      if (now - lastOpen < 600 || isOpen()) return;
      lastOpen = now;
      openFn(e);
    }
    function onDown(e) {
      downs[e.pointerId] = { t: Date.now(), x: e.clientX, y: e.clientY };
      lastDown = downs[e.pointerId];
      active++;
      if (active > 1) {
        multi = true;
        lastTap = null;
      }
    }
    function onUp(e) {
      var d = downs[e.pointerId];
      delete downs[e.pointerId];
      active = Math.max(0, active - 1);
      var wasMulti = multi;
      if (!active) multi = false;
      if (e.type !== "pointerup" || e.pointerType === "mouse" || !d || wasMulti) return;
      var up = { t: Date.now(), x: e.clientX, y: e.clientY };
      if (!isTap(d, up) || !filter(e)) {
        lastTap = null;
        return;
      }
      if (isDoubleTap(lastTap, up)) {
        lastTap = null;
        if (e.cancelable) e.preventDefault();
        fire(e);
      } else {
        lastTap = up;
      }
    }
    function onDbl(e) {
      if (!filter(e)) return;
      if (lastDown && Math.abs(e.clientX - lastDown.x) + Math.abs(e.clientY - lastDown.y) > 6) return;
      e.preventDefault();
      e.stopPropagation();
      fire(e);
    }
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("dblclick", onDbl);
    return function unbind() {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("dblclick", onDbl);
    };
  }

  global.DamLightbox = {
    open: open,
    close: close,
    isOpen: isOpen,
    bindOpenGesture: bindOpenGesture,
    t: tr,
    _geom: { fitScale: fitScale, clampPan: clampPan, zoomAt: zoomAt, clampScale: clampScale },
    _gest: {
      isTap: isTap,
      isDoubleTap: isDoubleTap,
      classifySwipe: classifySwipe,
      DOUBLE_TAP_MS: DOUBLE_TAP_MS,
      SWIPE_MIN_PX: SWIPE_MIN_PX,
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
