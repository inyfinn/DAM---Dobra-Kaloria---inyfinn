/**
 * DAM - shared resizable bento grid (9 cols x 28 rows max).
 * Edge resize + whole-tile DnD (Edit / is-bento-active); neighbors reflow;
 * layout persisted per user. Used by Zadania (#damTasksHome) and Dashboard.
 */
(function (global) {
  "use strict";

  var COLS = 9;
  /* Room for 3 media stacks of 10 tiles (5 rows) plus stats/notify/asana. */
  var MAX_ROWS = 96;
  /* v10: always re-stamp --bento-* after media outerHTML; content-sized h. */
  var BENTO_LAYOUT_VERSION = 10;
  var ROW_PX = 48;
  var STORAGE_PREFIX = "dam_bento_v1:";
  var MIN_W = 2;
  var MIN_H = 2;

  /**
   * Content-safe minimum spans (grid units). Shrink below these is forbidden.
   * Measured against real widget chrome (title + body) at ~48px row / 9 cols.
   */
  /**
   * Content-safe mins (2026-07-23 pack-tight):
   * media-latest: floor w=9 (tags readable). Height = chrome floor only;
   * real --bento-h comes from syncMediaTileBentoHeights (measured li).
   * Do NOT reserve rows for a future 1x4/1x6 switch — grow on layout change.
   */
  var DEFAULT_MIN_SIZES = {
    /* dashboard */
    notify_new_viz: { w: 3, h: 6 },
    /* Compact chips (~44px) + wrap; short floor (was h:8 for tall tiles) */
    quick_links: { w: 3, h: 4 },
    newest_viz_3: { w: 9, h: 3 },
    newest_products_f: { w: 9, h: 3 },
    branding_latest: { w: 9, h: 3 },
    asana_home: { w: 6, h: 8 },
    products_count: { w: 3, h: 3 },
    asana_open: { w: 3, h: 3 },
    projects_this_month: { w: 3, h: 3 },
    projects_in_progress: { w: 3, h: 3 },
    checklists_ok: { w: 3, h: 3 },
    tasks_next: { w: 3, h: 5 },
    tasks_by_section: { w: 3, h: 5 },
    tasks_overdue: { w: 3, h: 3 },
    assignees_load: { w: 3, h: 5 },
    sales_mock: { w: 3, h: 3 },
    langs_mix: { w: 3, h: 4 },
    carriers_top: { w: 3, h: 4 },
    index_health: { w: 3, h: 3 },
    viz_flags: { w: 3, h: 3 },
    missing_thumbs: { w: 3, h: 3 },
    demo_vs_prod: { w: 3, h: 3 },
    labor_vs_print: { w: 3, h: 4 },
    efficiency_mock: { w: 3, h: 3 },
    cost_swot_risk: { w: 4, h: 5 },
    /* tasks */
    ai: { w: 5, h: 3 },
    mytasks: { w: 4, h: 5 },
    notes: { w: 3, h: 5 },
    projects: { w: 3, h: 4 },
    people: { w: 3, h: 4 },
    comments: { w: 3, h: 4 },
    customize: { w: 3, h: 4 }
  };

  var _instances = [];

  function hostElForId(host, id) {
    if (!host || !id) return null;
    return (
      host.querySelector('[data-bento-id="' + id + '"]') ||
      host.querySelector('[data-widget-id="' + id + '"]')
    );
  }

  /** Tile count (localStorage) for media widgets; drives content-safe minH. */
  function migrateTileCountValue(raw) {
    var v = String(raw == null ? "" : raw).trim();
    if (v === "1x6") return "6";
    if (v === "1x4" || v === "2x2") return "4";
    var n = parseInt(v, 10);
    if ([2, 4, 6, 8, 10].indexOf(n) >= 0) return String(n);
    return "4";
  }

  function readTileLayout(widgetId) {
    try {
      var key =
        "dam_dash_tile_layout:" +
        userKey() +
        ":" +
        widgetId;
      var v = localStorage.getItem(key);
      if (v != null && v !== "") return migrateTileCountValue(v);
    } catch (e) {
      /* ignore */
    }
    return "4";
  }

  function readProductsTileLayout() {
    return readTileLayout("newest_products_f");
  }

  function mediaTileLayoutMinH(_layout) {
    return 3;
  }

  function productsLayoutMinH(_layout) {
    return 3;
  }

  function productsMinHForId(id) {
    if (id !== "newest_products_f") return null;
    return Math.max(MIN_H, 3);
  }

  function classBasedMins(el) {
    if (!el || !el.classList) return null;
    var wid =
      el.getAttribute && el.getAttribute("data-widget-id")
        ? el.getAttribute("data-widget-id")
        : el.getAttribute && el.getAttribute("data-bento-id")
          ? el.getAttribute("data-bento-id")
          : "";
    if (wid === "newest_products_f") {
      return { w: 9, h: mediaTileLayoutMinH(readTileLayout("newest_products_f")) };
    }
    if (wid === "newest_viz_3") {
      return { w: 9, h: mediaTileLayoutMinH(readTileLayout("newest_viz_3")) };
    }
    if (wid === "branding_latest") {
      return { w: 9, h: mediaTileLayoutMinH(readTileLayout("branding_latest")) };
    }
    if (el.classList.contains("dam-widget--asana-home")) return { w: 6, h: 8 };
    if (el.classList.contains("dam-widget--strip")) return { w: 3, h: 6 };
    if (el.classList.contains("dam-widget--stat") || el.classList.contains("dam-widget--sm")) {
      return { w: 3, h: 3 };
    }
    if (el.classList.contains("dam-widget--md")) return { w: 3, h: 4 };
    if (el.classList.contains("dam-widget--lg")) return { w: 5, h: 6 };
    return null;
  }

  function getMinSize(id, opts, el, current) {
    var fromOpts = opts && opts.minSizes && opts.minSizes[id];
    var fromDefault = id && DEFAULT_MIN_SIZES[id] ? DEFAULT_MIN_SIZES[id] : null;
    var fromClass = classBasedMins(el);
    var base = fromOpts || fromDefault || fromClass || { w: MIN_W, h: MIN_H };
    var minW = Math.max(MIN_W, clamp(base.w != null ? base.w : MIN_W, MIN_W, COLS));
    var minH = Math.max(MIN_H, clamp(base.h != null ? base.h : MIN_H, MIN_H, MAX_ROWS));
    /* quick_links: compact chips wrap; short floor in both aspects */
    if (id === "quick_links") {
      var cw =
        current && current.w != null
          ? current.w
          : el
            ? parseInt(el.style.getPropertyValue("--bento-w"), 10) || minW
            : minW;
      if (cw >= 6) minH = Math.max(MIN_H, 3);
      else minH = Math.max(MIN_H, 4);
      minW = Math.max(minW, 3);
    }
    if (id === "newest_products_f" || id === "newest_viz_3" || id === "branding_latest") {
      minW = Math.max(minW, 9);
      if (!(fromOpts && fromOpts.h != null)) {
        var tileMinH = mediaTileLayoutMinH(readTileLayout(id));
        minH = Math.max(minH, tileMinH);
      }
    }
    return { w: minW, h: minH };
  }

  function userKey() {
    try {
      var u = JSON.parse(localStorage.getItem("dam_user") || "{}");
      if (u && u.email) return String(u.email).toLowerCase();
    } catch (e) {
      /* ignore */
    }
    return localStorage.getItem("dam_user_email") || "anon";
  }

  function storageKey(scope) {
    return STORAGE_PREFIX + String(scope || "default") + ":" + userKey();
  }

  function clamp(n, lo, hi) {
    n = Math.round(Number(n) || 0);
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function ensureCss() {
    var prev = document.getElementById("damBentoResizeCss");
    if (prev && prev.getAttribute("data-bento-css") === "editGate2") return;
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    var s = document.createElement("style");
    s.id = "damBentoResizeCss";
    s.setAttribute("data-bento-css", "editGate2");
    s.textContent =
      ".dam-bento-resize{" +
      "display:grid;" +
      "grid-template-columns:repeat(" +
      COLS +
      ",minmax(0,1fr));" +
      "grid-auto-rows:var(--dam-bento-row," +
      ROW_PX +
      "px);" +
      "gap:var(--dam-bento-gap,14px);" +
      "align-items:stretch;" +
      "align-content:start;" +
      "}" +
      ".dam-bento-resize.is-bento-active > [data-bento-id]," +
      ".dam-bento-resize.is-bento-active > .dam-bento-resize-item{" +
      "position:relative;" +
      "min-width:0;min-height:0;" +
      "display:flex;flex-direction:column;" +
      "height:100%;" +
      /* visible so edge handles (outside box) do not inflate scrollHeight / fake scrollbars */
      "overflow:visible;" +
      "grid-column:var(--bento-c)/span var(--bento-w)!important;" +
      "grid-row:var(--bento-r)/span var(--bento-h)!important;" +
      "}" +
      ".dam-bento-resize .dam-bento-spacer{" +
      "pointer-events:none;" +
      "min-height:0;" +
      "border:0;" +
      "background:transparent;" +
      "opacity:0;" +
      "}" +
      ".dam-bento-resize .dam-bento-handle{" +
      "position:absolute;z-index:4;" +
      "background:transparent;border:0;padding:0;" +
      "opacity:0;transition:opacity .12s ease;" +
      /* Dashboard: chrome only in customize/edit mode (body.dam-bento-layout-edit) */
      /* Tasks: chrome only while Dostosuj (is-tasks-customize / body.dam-tasks-customize) */
      "visibility:hidden;pointer-events:none;" +
      "}" +
      "body.dam-bento-layout-edit .dam-bento-resize.is-bento-active .dam-bento-handle," +
      "body.dam-tasks-customize .dam-tasks-bento.is-bento-active .dam-bento-handle," +
      ".dam-tasks-bento.is-bento-active.is-tasks-customize .dam-bento-handle{" +
      "visibility:visible;pointer-events:auto;" +
      "}" +
      "body.dam-bento-layout-edit .dam-bento-resize.is-bento-active:hover .dam-bento-handle," +
      "body.dam-bento-layout-edit .dam-bento-resize.is-bento-resizing .dam-bento-handle," +
      "body.dam-bento-layout-edit .dam-bento-resize [data-bento-id]:focus-within > .dam-bento-handle," +
      "body.dam-bento-layout-edit .dam-bento-resize [data-bento-id]:hover > .dam-bento-handle," +
      "body.dam-tasks-customize .dam-tasks-bento.is-bento-active:hover .dam-bento-handle," +
      "body.dam-tasks-customize .dam-tasks-bento.is-bento-resizing .dam-bento-handle," +
      "body.dam-tasks-customize .dam-tasks-bento [data-bento-id]:focus-within > .dam-bento-handle," +
      "body.dam-tasks-customize .dam-tasks-bento [data-bento-id]:hover > .dam-bento-handle," +
      ".dam-tasks-bento.is-bento-active.is-tasks-customize:hover .dam-bento-handle," +
      ".dam-tasks-bento.is-tasks-customize.is-bento-resizing .dam-bento-handle," +
      ".dam-tasks-bento.is-tasks-customize [data-bento-id]:focus-within > .dam-bento-handle," +
      ".dam-tasks-bento.is-tasks-customize [data-bento-id]:hover > .dam-bento-handle{" +
      "opacity:1;" +
      "}" +
      ".dam-bento-handle--e{" +
      "top:12px;bottom:12px;right:-5px;width:10px;cursor:col-resize;" +
      "}" +
      ".dam-bento-handle--s{" +
      "left:12px;right:12px;bottom:-5px;height:10px;cursor:row-resize;" +
      "}" +
      ".dam-bento-handle--se{" +
      "right:-6px;bottom:-6px;width:14px;height:14px;cursor:nwse-resize;" +
      "border-radius:3px;" +
      "background:color-mix(in srgb,var(--dam-text,#464255) 22%,transparent);" +
      "}" +
      ".dam-bento-handle--e::after," +
      ".dam-bento-handle--s::after{" +
      "content:'';position:absolute;" +
      "background:color-mix(in srgb,var(--dam-text,#464255) 28%,transparent);" +
      "border-radius:2px;" +
      "}" +
      ".dam-bento-handle--e::after{top:20%;bottom:20%;left:3px;width:3px;}" +
      ".dam-bento-handle--s::after{left:20%;right:20%;top:3px;height:3px;}" +
      ".dam-bento-handle.is-bento-at-min{" +
      "opacity:.28!important;cursor:not-allowed;" +
      "}" +
      ".dam-bento-handle.is-bento-at-min:not(.is-bento-grow-only){" +
      "pointer-events:none;" +
      "}" +
      /* At minW/minH still allow enlarge via the same edge (grow-only keeps events) */
      ".dam-bento-handle.is-bento-grow-only{" +
      "pointer-events:auto;cursor:inherit;" +
      "opacity:.55!important;" +
      "}" +
      ".dam-bento-handle--e.is-bento-grow-only{cursor:e-resize;}" +
      ".dam-bento-handle--s.is-bento-grow-only{cursor:s-resize;}" +
      ".dam-bento-handle--se.is-bento-grow-only{cursor:nwse-resize;}" +
      "body.dam-bento-resizing{cursor:col-resize;user-select:none;}" +
      "body.dam-bento-resizing-row{cursor:row-resize;}" +
      ".dam-bento-resize .dam-tasks-notes," +
      ".dam-bento-resize .dam-tasks-list," +
      ".dam-bento-resize .dam-tasks-projects," +
      ".dam-bento-resize .dam-tasks-people," +
      ".dam-bento-resize .dam-tasks-comments," +
      ".dam-bento-resize .dam-widget__body{" +
      "flex:1 1 auto;min-height:0;" +
      "}" +
      ".dam-bento-resize .dam-tasks-notes{resize:none;height:100%;min-height:0;}" +
      "@media (max-width:1100px){" +
      ".dam-bento-resize.is-bento-active.dam-bento-resize--stack-sm > [data-bento-id]," +
      ".dam-bento-resize.is-bento-active.dam-bento-resize--stack-sm > .dam-bento-resize-item{" +
      "grid-column:1/-1!important;" +
      "grid-row:auto!important;" +
      "}" +
      ".dam-bento-resize.is-bento-active.dam-bento-resize--stack-sm .dam-bento-handle," +
      ".dam-bento-resize.is-bento-active.dam-bento-resize--stack-sm .dam-bento-spacer," +
      ".dam-bento-resize.is-bento-active.dam-bento-resize--stack-sm .dam-bento-move-handle," +
      ".dam-bento-resize.is-bento-active.dam-bento-resize--stack-sm .dam-bento-skel-cell," +
      ".dam-bento-resize.is-bento-active.dam-bento-resize--stack-sm .dam-bento-source-hole," +
      ".dam-bento-resize.is-bento-active.dam-bento-resize--stack-sm .dam-bento-drop-ghost{display:none!important;}" +
      "}" +
      ".dam-bento-resize.is-bento-active{position:relative;}" +
      ".dam-bento-move-handle{" +
      "--bento-move-ink:#5c5866;" +
      "--bento-move-on:#2f2c36;" +
      "position:absolute;z-index:5;left:10px;right:10px;bottom:8px;top:auto;" +
      "width:auto;height:18px;min-width:44px;min-height:18px;" +
      "display:none;align-items:center;justify-content:flex-start;" +
      "border:1px solid color-mix(in srgb,var(--bento-move-ink) 22%,transparent);" +
      "border-radius:8px;padding:0 8px;cursor:grab;" +
      "background:color-mix(in srgb,var(--bento-move-ink) 10%,var(--dam-surface,#fff))!important;" +
      "color:var(--bento-move-on);" +
      "box-shadow:0 1px 0 rgba(255,255,255,.35) inset;" +
      "opacity:0;" +
      "transition:opacity .12s ease,background .12s ease,border-color .12s ease;" +
      "}" +
      ".dam-bento-move-handle:hover," +
      ".dam-bento-move-handle:focus-visible{" +
      "background:color-mix(in srgb,var(--bento-move-ink) 16%,var(--dam-surface,#fff))!important;" +
      "border-color:color-mix(in srgb,var(--bento-move-ink) 34%,transparent);" +
      "outline:none;" +
      "}" +
      /* Dashboard: Dostosuj = body.dam-bento-layout-edit. Tasks: Dostosuj = is-tasks-customize. */
      "body.dam-bento-layout-edit .dam-bento-resize.is-bento-active .dam-bento-move-handle," +
      "body.dam-tasks-customize .dam-tasks-bento.is-bento-active .dam-bento-move-handle," +
      ".dam-tasks-bento.is-bento-active.is-tasks-customize .dam-bento-move-handle{" +
      "display:inline-flex;opacity:.92;" +
      "}" +
      "body.dam-bento-layout-edit .dam-bento-resize.is-bento-active:hover .dam-bento-move-handle," +
      "body.dam-bento-layout-edit .dam-bento-resize.is-bento-dragging .dam-bento-move-handle," +
      "body.dam-bento-layout-edit .dam-bento-resize [data-bento-id]:hover > .dam-bento-move-handle," +
      "body.dam-bento-layout-edit .dam-bento-resize [data-bento-id]:focus-within > .dam-bento-move-handle," +
      "body.dam-tasks-customize .dam-tasks-bento.is-bento-active:hover .dam-bento-move-handle," +
      "body.dam-tasks-customize .dam-tasks-bento.is-bento-dragging .dam-bento-move-handle," +
      "body.dam-tasks-customize .dam-tasks-bento [data-bento-id]:hover > .dam-bento-move-handle," +
      "body.dam-tasks-customize .dam-tasks-bento [data-bento-id]:focus-within > .dam-bento-move-handle," +
      ".dam-tasks-bento.is-bento-active.is-tasks-customize:hover .dam-bento-move-handle," +
      ".dam-tasks-bento.is-tasks-customize.is-bento-dragging .dam-bento-move-handle," +
      ".dam-tasks-bento.is-tasks-customize [data-bento-id]:hover > .dam-bento-move-handle," +
      ".dam-tasks-bento.is-tasks-customize [data-bento-id]:focus-within > .dam-bento-move-handle{" +
      "opacity:1;" +
      "}" +
      ".dam-bento-move-handle:active," +
      "body.dam-bento-moving .dam-bento-move-handle{cursor:grabbing;}" +
      ".dam-bento-move-handle i,.dam-bento-move-handle .uil{" +
      "font-size:14px;line-height:1;opacity:.85;" +
      "}" +
      "body.dam-bento-layout-edit .dam-bento-resize.is-bento-active .dam-widget__head," +
      "body.dam-bento-layout-edit .dam-bento-resize.is-bento-active .dam-bento-drag-chrome," +
      "body.dam-tasks-customize .dam-tasks-bento.is-bento-active .dam-widget__head," +
      "body.dam-tasks-customize .dam-tasks-bento.is-bento-active .dam-bento-drag-chrome," +
      "body.dam-tasks-customize .dam-tasks-bento.is-bento-active .dam-tasks-ai__head," +
      ".dam-tasks-bento.is-bento-active.is-tasks-customize .dam-widget__head," +
      ".dam-tasks-bento.is-bento-active.is-tasks-customize .dam-bento-drag-chrome," +
      ".dam-tasks-bento.is-bento-active.is-tasks-customize .dam-tasks-ai__head{" +
      "cursor:grab;" +
      "}" +
      "body.dam-bento-moving{cursor:grabbing;user-select:none;}" +
      ".dam-bento-resize.is-bento-dragging > [data-bento-id].is-bento-drag-source{" +
      "opacity:.38;filter:saturate(.7);" +
      "}" +
      ".dam-bento-skel-cell{" +
      "pointer-events:none;z-index:0;" +
      "border:1px dashed color-mix(in srgb,var(--dam-primary,#ab54db) 28%,var(--dam-border,#e4e2ea));" +
      "border-radius:10px;" +
      "background:color-mix(in srgb,var(--dam-surface-muted,#f6f5f8) 70%,transparent);" +
      "opacity:0;transition:opacity .14s ease;" +
      "box-sizing:border-box;min-height:0;" +
      "}" +
      ".dam-bento-resize.is-bento-dragging .dam-bento-skel-cell," +
      ".dam-bento-resize.is-bento-skel-on .dam-bento-skel-cell{opacity:.9;}" +
      ".dam-bento-source-hole," +
      ".dam-bento-drop-ghost{" +
      "pointer-events:none;z-index:2;box-sizing:border-box;min-height:0;" +
      "border-radius:var(--dam-radius-md,14px);" +
      "}" +
      ".dam-bento-source-hole{" +
      "border:2px dashed color-mix(in srgb,var(--dam-text,#464255) 35%,transparent);" +
      "background:color-mix(in srgb,var(--dam-surface-muted,#f6f5f8) 85%,transparent);" +
      "}" +
      ".dam-bento-drop-ghost{" +
      "border:2px dashed color-mix(in srgb,var(--dam-primary,#ab54db) 55%,transparent);" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 10%,transparent);" +
      "box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dam-primary,#ab54db) 18%,transparent);" +
      "}" +
      "@media (prefers-reduced-motion:no-preference){" +
      ".dam-bento-drop-ghost.is-bento-ghost-live{" +
      "animation:dam-bento-ghost-shimmer 1.1s ease-in-out infinite;" +
      "}" +
      "@keyframes dam-bento-ghost-shimmer{" +
      "0%,100%{background:color-mix(in srgb,var(--dam-primary,#ab54db) 8%,transparent);}" +
      "50%{background:color-mix(in srgb,var(--dam-primary,#ab54db) 16%,transparent);}" +
      "}" +
      "}" +
      ".dam-bento-drop-ghost__label{" +
      "position:absolute;top:8px;left:10px;font-size:11px;font-weight:600;" +
      "letter-spacing:.02em;color:color-mix(in srgb,var(--dam-primary,#ab54db) 80%,#464255);" +
      "pointer-events:none;" +
      "}";
    document.head.appendChild(s);
  }

  function loadLayout(scope) {
    try {
      var raw = localStorage.getItem(storageKey(scope));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.items) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveLayout(scope, items) {
    var payload = {
      version: BENTO_LAYOUT_VERSION,
      cols: COLS,
      maxRows: MAX_ROWS,
      items: items || {}
    };
    try {
      localStorage.setItem(storageKey(scope), JSON.stringify(payload));
    } catch (e) {
      /* ignore */
    }
    if (global.DamUserPrefs && typeof DamUserPrefs.setDebounced === "function") {
      var patch = {};
      patch["bento_layout_" + scope] = payload;
      DamUserPrefs.setDebounced(patch, 400).catch(function () {});
    } else if (global.DamUserPrefs && typeof DamUserPrefs.set === "function") {
      var patch2 = {};
      patch2["bento_layout_" + scope] = payload;
      DamUserPrefs.set(patch2).catch(function () {});
    }
  }

  function normalizeItem(it, fallback, mins) {
    var base = fallback || { c: 1, r: 1, w: 3, h: 2 };
    var minW = mins && mins.w != null ? mins.w : MIN_W;
    var minH = mins && mins.h != null ? mins.h : MIN_H;
    var c = clamp(it && it.c != null ? it.c : base.c, 1, COLS);
    var r = clamp(it && it.r != null ? it.r : base.r, 1, MAX_ROWS);
    var maxW = COLS - c + 1;
    var maxH = MAX_ROWS - r + 1;
    /* Prefer content min; if column start is too far right, shift left */
    if (minW > maxW) {
      c = Math.max(1, COLS - minW + 1);
      maxW = COLS - c + 1;
    }
    if (minH > maxH) {
      r = Math.max(1, MAX_ROWS - minH + 1);
      maxH = MAX_ROWS - r + 1;
    }
    var w = clamp(it && it.w != null ? it.w : base.w, minW, maxW);
    var h = clamp(it && it.h != null ? it.h : base.h, minH, maxH);
    return { c: c, r: r, w: w, h: h };
  }

  function findFreeSlot(occItems, w, h, prefer) {
    var startR = (prefer && prefer.r) || 1;
    var startC = (prefer && prefer.c) || 1;
    var r, c, ok, other, O;
    function freeAt(c0, r0) {
      for (other in occItems) {
        if (!occItems.hasOwnProperty(other)) continue;
        O = occItems[other];
        if (overlaps({ c: c0, r: r0, w: w, h: h }, O)) return false;
      }
      return c0 >= 1 && r0 >= 1 && c0 + w - 1 <= COLS && r0 + h - 1 <= MAX_ROWS;
    }
    if (freeAt(startC, startR)) return { c: startC, r: startR };
    for (r = 1; r <= MAX_ROWS - h + 1; r++) {
      for (c = 1; c <= COLS - w + 1; c++) {
        if (freeAt(c, r)) return { c: c, r: r };
      }
    }
    return { c: 1, r: Math.max(1, MAX_ROWS - h + 1) };
  }

  /** Dashboard stack: viz → products → branding (adjacent rows, no phantom gap). */
  function ensureVizProductsStackGap(items, ids, opts, host) {
    var viz = items.newest_viz_3;
    var prod = items.newest_products_f;
    var brand = items.branding_latest;
    if ((!viz || viz.spacer) && (!prod || prod.spacer) && (!brand || brand.spacer)) {
      return items;
    }
    var out = {};
    ids.forEach(function (id) {
      if (items[id]) out[id] = Object.assign({}, items[id]);
    });
    /* Next tile starts at prev.r + prev.h (CSS grid: no empty row between). */
    if (viz && !viz.spacer && prod && !prod.spacer) {
      var minProdRow = viz.r + viz.h;
      if (out.newest_products_f.r < minProdRow) {
        out.newest_products_f = Object.assign({}, out.newest_products_f, { r: minProdRow });
      }
    }
    var anchor = null;
    if (out.newest_products_f && !out.newest_products_f.spacer) {
      anchor = out.newest_products_f;
    } else if (viz && !viz.spacer) {
      anchor = viz;
    }
    if (anchor && brand && !brand.spacer) {
      var minBrandRow = anchor.r + anchor.h;
      if (out.branding_latest.r < minBrandRow) {
        out.branding_latest = Object.assign({}, out.branding_latest, { r: minBrandRow });
      }
    }
    return enforceMinsAndReflow(out, ids, opts, host);
  }

  /** Bump persisted layouts that are below content-safe mins; reflow overlaps. */
  function enforceMinsAndReflow(items, ids, opts, host) {
    var out = {};
    var ordered = ids.slice().sort(function (a, b) {
      var A = items[a] || { r: 1, c: 1 };
      var B = items[b] || { r: 1, c: 1 };
      return A.r - B.r || A.c - B.c;
    });
    var i, id, mins, it, j, other, O, push, slot;
    for (i = 0; i < ordered.length; i++) {
      id = ordered[i];
      if (!items[id] || items[id].spacer) continue;
      mins = getMinSize(id, opts, hostElForId(host, id), items[id]);
      it = normalizeItem(items[id], items[id], mins);
      /* Resolve overlaps: prefer push-down, else find free slot */
      for (j = 0; j < 40; j++) {
        push = it.r;
        for (other in out) {
          if (!out.hasOwnProperty(other)) continue;
          O = out[other];
          if (overlaps(it, O)) {
            push = Math.max(push, O.r + O.h);
          }
        }
        if (push <= it.r) break;
        if (push + it.h - 1 <= MAX_ROWS) {
          it.r = push;
        } else {
          slot = findFreeSlot(out, it.w, it.h, { c: it.c, r: 1 });
          it.c = slot.c;
          it.r = slot.r;
          break;
        }
      }
      /* Final guarantee: if still overlapping, relocate */
      for (other in out) {
        if (!out.hasOwnProperty(other)) continue;
        if (overlaps(it, out[other])) {
          slot = findFreeSlot(out, it.w, it.h, null);
          it.c = slot.c;
          it.r = slot.r;
          break;
        }
      }
      out[id] = it;
    }
    /* If grid is too tight for mins (e.g. tall media + quick_links h=5), re-pack */
    var stillOverlap = false;
    var a, b;
    for (a = 0; a < ordered.length && !stillOverlap; a++) {
      if (!out[ordered[a]]) continue;
      for (b = a + 1; b < ordered.length; b++) {
        if (!out[ordered[b]]) continue;
        if (overlaps(out[ordered[a]], out[ordered[b]])) {
          stillOverlap = true;
          break;
        }
      }
    }
    if (stillOverlap) {
      var spans = {};
      var packIds = ordered.filter(function (oid) {
        return !!out[oid];
      });
      /* Pack at content mins so tall media cannot consume the whole 21 rows */
      packIds.forEach(function (oid) {
        var m = getMinSize(oid, opts, hostElForId(host, oid), out[oid]);
        spans[oid] = {
          w: Math.max(m.w, Math.min(out[oid].w, COLS)),
          h: m.h
        };
      });
      var repacked = packDefaults(packIds, spans);
      packIds.forEach(function (oid) {
        if (!repacked[oid] || repacked[oid].spacer) return;
        var minsR = getMinSize(oid, opts, hostElForId(host, oid), repacked[oid]);
        repacked[oid] = normalizeItem(repacked[oid], repacked[oid], minsR);
      });
      return repacked;
    }
    return out;
  }

  function overlaps(a, b) {
    return !(
      a.c + a.w - 1 < b.c ||
      b.c + b.w - 1 < a.c ||
      a.r + a.h - 1 < b.r ||
      b.r + b.h - 1 < a.r
    );
  }

  function itemsOverlap(items) {
    var ids = Object.keys(items || {}).filter(function (id) {
      return items[id] && !items[id].spacer;
    });
    var a;
    var b;
    for (a = 0; a < ids.length; a++) {
      for (b = a + 1; b < ids.length; b++) {
        if (overlaps(items[ids[a]], items[ids[b]])) return true;
      }
    }
    return false;
  }

  function itemLayoutChanged(before, after) {
    if (!before || !after) return !!after;
    return (
      before.c !== after.c ||
      before.r !== after.r ||
      before.w !== after.w ||
      before.h !== after.h
    );
  }

  function cellFree(occupancy, c, r, w, h, ignoreId) {
    var x, y, key;
    for (y = r; y < r + h; y++) {
      for (x = c; x < c + w; x++) {
        key = x + "," + y;
        if (occupancy[key] && occupancy[key] !== ignoreId) return false;
      }
    }
    return true;
  }

  function markOcc(occupancy, id, it) {
    var x, y;
    for (y = it.r; y < it.r + it.h; y++) {
      for (x = it.c; x < it.c + it.w; x++) {
        occupancy[x + "," + y] = id;
      }
    }
  }

  function clearOcc(occupancy, id, it) {
    var x, y, key;
    for (y = it.r; y < it.r + it.h; y++) {
      for (x = it.c; x < it.c + it.w; x++) {
        key = x + "," + y;
        if (occupancy[key] === id) delete occupancy[key];
      }
    }
  }

  function sizeToSpan(size, el) {
    if (el) {
      var wid =
        el.getAttribute && el.getAttribute("data-widget-id")
          ? el.getAttribute("data-widget-id")
          : el.getAttribute && el.getAttribute("data-bento-id")
            ? el.getAttribute("data-bento-id")
            : "";
      if (wid === "newest_products_f") {
        return { w: 9, h: productsLayoutMinH(readProductsTileLayout()) };
      }
      if (el.classList.contains("dam-widget--asana-home")) return { w: 9, h: 8 };
      if (el.classList.contains("dam-widget--branding-latest")) {
        return { w: 9, h: 9 };
      }
      if (
        el.classList.contains("dam-widget--viz-latest") ||
        el.classList.contains("dam-widget--media-latest")
      ) {
        return { w: 9, h: 8 };
      }
      if (el.classList.contains("dam-widget--strip")) return { w: 3, h: 6 };
      if (el.classList.contains("dam-widget--lg")) return { w: 9, h: 6 };
      if (el.classList.contains("dam-widget--md")) return { w: 3, h: 6 };
      if (el.classList.contains("dam-widget--sm")) return { w: 3, h: 3 };
    }
    var map = {
      sm: { w: 3, h: 3 },
      md: { w: 3, h: 6 },
      lg: { w: 9, h: 6 },
      strip: { w: 3, h: 6 },
      xl: { w: 9, h: 9 }
    };
    return map[size] || { w: 3, h: 3 };
  }

  function isNoStretch(id, opts, el) {
    var list = (opts && opts.noStretchIds) || [];
    if (list.indexOf(id) >= 0) return true;
    if (el && (el.classList.contains("dam-widget--strip") || el.classList.contains("dam-widget--stat"))) {
      return true;
    }
    return false;
  }

  function packDefaults(ids, spans) {
    var items = {};
    var occ = {};
    var i, id, span, c, r, placed;
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      span = spans[id] || { w: 3, h: 2 };
      placed = false;
      for (r = 1; r <= MAX_ROWS - span.h + 1 && !placed; r++) {
        for (c = 1; c <= COLS - span.w + 1; c++) {
          if (cellFree(occ, c, r, span.w, span.h, id)) {
            items[id] = { c: c, r: r, w: span.w, h: span.h };
            markOcc(occ, id, items[id]);
            placed = true;
            break;
          }
        }
      }
      if (!placed) {
        /* Last resort: never crush below content-safe span.h (e.g. newest_products_f 1x4) */
        var fitH = span.h;
        var floorH = Math.max(1, span.h);
        for (; fitH >= floorH && !placed; fitH--) {
          for (r = 1; r <= MAX_ROWS - fitH + 1 && !placed; r++) {
            for (c = 1; c <= COLS - span.w + 1; c++) {
              if (cellFree(occ, c, r, span.w, fitH, id)) {
                items[id] = { c: c, r: r, w: span.w, h: fitH };
                markOcc(occ, id, items[id]);
                placed = true;
                break;
              }
            }
          }
        }
        if (!placed) {
          /* findFreeSlot needs item rects, not the cell occupancy map */
          var slot = findFreeSlot(items, span.w, floorH, null);
          items[id] = {
            c: slot.c,
            r: slot.r,
            w: Math.min(COLS, span.w),
            h: Math.min(MAX_ROWS, floorH)
          };
          markOcc(occ, id, items[id]);
        }
      }
    }
    return items;
  }

  /**
   * Fill leftover cells: stretch fillable neighbors, else insert spacers
   * that occupy the void so the visual band is complete (no red-W voids).
   */
  function fillGaps(items, ids, opts, host) {
    var occ = {};
    var id, it, r, c, maxR, run, x, spacerId, n;
    ids.forEach(function (i) {
      if (items[i]) markOcc(occ, i, items[i]);
    });
    maxR = 1;
    ids.forEach(function (i) {
      it = items[i];
      if (it) maxR = Math.max(maxR, it.r + it.h - 1);
    });
    maxR = Math.min(MAX_ROWS, maxR);

    /* Prefer stretching a neighbor that already ends at this free cell's left */
    for (r = 1; r <= maxR; r++) {
      c = 1;
      while (c <= COLS) {
        if (occ[c + "," + r]) {
          c++;
          continue;
        }
        run = 1;
        while (c + run <= COLS && !occ[c + run + "," + r]) run++;
        var stretched = false;
        var leftId = c > 1 ? occ[c - 1 + "," + r] : null;
        if (leftId && items[leftId] && !isNoStretch(leftId, opts, null)) {
          var left = items[leftId];
          if (left.r <= r && left.r + left.h - 1 >= r) {
            var grow = Math.min(run, COLS - left.c - left.w + 1);
            if (grow > 0 && cellFree(occ, left.c + left.w, left.r, grow, left.h, leftId)) {
              clearOcc(occ, leftId, left);
              left.w += grow;
              markOcc(occ, leftId, left);
              stretched = true;
              c = left.c + left.w;
            }
          }
        }
        if (!stretched) {
          /* vertical stretch of item above into this band */
          var upId = r > 1 ? occ[c + "," + (r - 1)] : null;
          if (upId && items[upId] && !isNoStretch(upId, opts, null)) {
            var up = items[upId];
            if (up.c <= c && up.c + up.w - 1 >= c + run - 1) {
              var gh = 1;
              while (
                up.r + up.h - 1 + gh <= MAX_ROWS &&
                cellFree(occ, up.c, up.r + up.h, up.w, gh, upId)
              ) {
                /* check full width free for this row */
                var ok = true;
                for (x = up.c; x < up.c + up.w; x++) {
                  if (occ[x + "," + (up.r + up.h - 1 + gh)]) {
                    ok = false;
                    break;
                  }
                }
                if (!ok) break;
                clearOcc(occ, upId, up);
                up.h += 1;
                markOcc(occ, upId, up);
                gh = 0;
                stretched = true;
                break;
              }
            }
          }
        }
        if (!stretched && opts && opts.spacers !== false && host) {
          spacerId = "__spacer_" + r + "_" + c;
          n = 1;
          while (r + n <= maxR) {
            var rowOk = true;
            for (x = c; x < c + run; x++) {
              if (occ[x + "," + (r + n)]) {
                rowOk = false;
                break;
              }
            }
            if (!rowOk) break;
            n++;
          }
          items[spacerId] = {
            c: c,
            r: r,
            w: run,
            h: Math.max(1, n),
            spacer: true
          };
          markOcc(occ, spacerId, items[spacerId]);
        }
        c += run;
      }
    }

    /* Equalize side-by-side band heights for stretchable pairs */
    ids.forEach(function (a) {
      var A = items[a];
      if (!A || A.spacer || isNoStretch(a, opts, null)) return;
      ids.forEach(function (b) {
        var B = items[b];
        if (!B || b === a || B.spacer || isNoStretch(b, opts, null)) return;
        if (A.r === B.r && A.c + A.w === B.c) {
          var mh = Math.max(A.h, B.h);
          if (A.h < mh && cellFree(occ, A.c, A.r + A.h, A.w, mh - A.h, a)) {
            clearOcc(occ, a, A);
            A.h = mh;
            markOcc(occ, a, A);
          }
          if (B.h < mh && cellFree(occ, B.c, B.r + B.h, B.w, mh - B.h, b)) {
            clearOcc(occ, b, B);
            B.h = mh;
            markOcc(occ, b, B);
          }
        }
      });
    });

    return items;
  }

  function updateHandleState(el, it, mins) {
    if (!el || !it) return;
    var atMinW = it.w <= mins.w;
    var atMinH = it.h <= mins.h;
    el.classList.toggle("is-bento-at-min-w", atMinW);
    el.classList.toggle("is-bento-at-min-h", atMinH);
    el.setAttribute("data-bento-min-w", String(mins.w));
    el.setAttribute("data-bento-min-h", String(mins.h));
    el.querySelectorAll(":scope > .dam-bento-handle").forEach(function (btn) {
      var dir = btn.getAttribute("data-bento-handle");
      var atMin =
        (dir === "e" && atMinW) ||
        (dir === "s" && atMinH) ||
        (dir === "se" && atMinW && atMinH);
      btn.classList.toggle("is-bento-at-min", atMin);
      /* Edge/corner still allow enlarge when at min in that axis */
      var growOnly =
        (dir === "e" && atMinW) ||
        (dir === "s" && atMinH) ||
        (dir === "se" && (atMinW || atMinH));
      btn.classList.toggle("is-bento-grow-only", !!growOnly && atMin);
      if (atMin) {
        btn.setAttribute(
          "title",
          "Minimalny rozmiar - mozna tylko powiekszyc"
        );
        btn.setAttribute("aria-disabled", "false");
      } else {
        btn.removeAttribute("title");
        btn.removeAttribute("aria-disabled");
      }
    });
  }

  function applyStyles(host, items, opts) {
    var nodes = host.querySelectorAll("[data-bento-id]");
    nodes.forEach(function (el) {
      var id = el.getAttribute("data-bento-id");
      var it = items[id];
      if (!it) return;
      el.style.setProperty("--bento-c", String(it.c));
      el.style.setProperty("--bento-r", String(it.r));
      el.style.setProperty("--bento-w", String(it.w));
      el.style.setProperty("--bento-h", String(it.h));
      el.classList.add("dam-bento-resize-item");
      if (!it.spacer) {
        updateHandleState(el, it, getMinSize(id, opts, el, it));
      }
    });
  }

  function syncSpacers(host, items) {
    host.querySelectorAll(".dam-bento-spacer").forEach(function (el) {
      el.parentNode.removeChild(el);
    });
    Object.keys(items).forEach(function (id) {
      var it = items[id];
      if (!it || !it.spacer) return;
      var el = document.createElement("div");
      el.className = "dam-bento-spacer dam-bento-resize-item";
      el.setAttribute("data-bento-id", id);
      el.setAttribute("aria-hidden", "true");
      el.style.setProperty("--bento-c", String(it.c));
      el.style.setProperty("--bento-r", String(it.r));
      el.style.setProperty("--bento-w", String(it.w));
      el.style.setProperty("--bento-h", String(it.h));
      host.appendChild(el);
    });
  }

  function ensureHandles(el) {
    if (el.querySelector(":scope > .dam-bento-handle")) return;
    ["e", "s", "se"].forEach(function (dir) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dam-bento-handle dam-bento-handle--" + dir;
      btn.setAttribute("data-bento-handle", dir);
      btn.setAttribute(
        "aria-label",
        dir === "e" ? "Zmien szerokosc" : dir === "s" ? "Zmien wysokosc" : "Zmien rozmiar"
      );
      btn.tabIndex = -1;
      el.appendChild(btn);
    });
  }

  function ensureMoveHandle(el) {
    if (!el || el.classList.contains("dam-bento-spacer")) return;
    if (el.querySelector(":scope > .dam-bento-move-handle")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dam-bento-move-handle";
    btn.setAttribute("data-bento-move", "1");
    btn.setAttribute("aria-label", "Przesun kafelek");
    btn.setAttribute("title", "Przeciagnij, aby przesunac kafelek");
    btn.tabIndex = -1;
    btn.innerHTML = '<i class="uil uil-draggabledots" aria-hidden="true"></i>';
    el.appendChild(btn);
  }

  function cellMetrics(host) {
    var cs = global.getComputedStyle(host);
    var gap = parseFloat(cs.columnGap || cs.gap) || 14;
    var w = host.clientWidth;
    var col = (w - gap * (COLS - 1)) / COLS;
    var row = parseFloat(cs.gridAutoRows) || ROW_PX;
    if (!isFinite(row) || row < 8) row = ROW_PX;
    return { col: col, row: row, gap: gap };
  }

  function pointerToCell(host, clientX, clientY, spanW, spanH) {
    var rect = host.getBoundingClientRect();
    var m = cellMetrics(host);
    var stepX = m.col + m.gap;
    var stepY = m.row + m.gap;
    if (stepX < 1) stepX = 1;
    if (stepY < 1) stepY = 1;
    var x = clientX - rect.left + host.scrollLeft;
    var y = clientY - rect.top + host.scrollTop;
    var c = Math.floor(x / stepX) + 1;
    var r = Math.floor(y / stepY) + 1;
    c = clamp(c, 1, Math.max(1, COLS - spanW + 1));
    r = clamp(r, 1, Math.max(1, MAX_ROWS - spanH + 1));
    return { c: c, r: r };
  }

  function clearDnDChrome(host) {
    if (!host) return;
    host.querySelectorAll(
      ".dam-bento-skel-cell, .dam-bento-source-hole, .dam-bento-drop-ghost"
    ).forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    host.classList.remove("is-bento-dragging", "is-bento-skel-on");
    host.querySelectorAll(".is-bento-drag-source").forEach(function (el) {
      el.classList.remove("is-bento-drag-source");
    });
    document.body.classList.remove("dam-bento-moving");
  }

  function usedRowSpan(items) {
    var max = 8;
    Object.keys(items || {}).forEach(function (id) {
      var it = items[id];
      if (!it || it.spacer) return;
      max = Math.max(max, it.r + it.h - 1);
    });
    return Math.min(MAX_ROWS, max + 2);
  }

  function showSkelGrid(host, items) {
    host.querySelectorAll(".dam-bento-skel-cell").forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    var rows = usedRowSpan(items);
    var r, c, cell;
    for (r = 1; r <= rows; r++) {
      for (c = 1; c <= COLS; c++) {
        cell = document.createElement("div");
        cell.className = "dam-bento-skel-cell dam-bento-resize-item";
        cell.setAttribute("aria-hidden", "true");
        cell.setAttribute("data-bento-skel", c + "," + r);
        cell.style.setProperty("--bento-c", String(c));
        cell.style.setProperty("--bento-r", String(r));
        cell.style.setProperty("--bento-w", "1");
        cell.style.setProperty("--bento-h", "1");
        host.appendChild(cell);
      }
    }
    host.classList.add("is-bento-skel-on");
  }

  function ensureGhostEl(host, cls, id) {
    var el = host.querySelector("." + cls);
    if (!el) {
      el = document.createElement("div");
      el.className = cls + " dam-bento-resize-item";
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("data-bento-id", id);
      if (cls === "dam-bento-drop-ghost") {
        var lab = document.createElement("span");
        lab.className = "dam-bento-drop-ghost__label";
        el.appendChild(lab);
      }
      host.appendChild(el);
    }
    return el;
  }

  function setGhostRect(el, it, label) {
    if (!el || !it) return;
    el.style.setProperty("--bento-c", String(it.c));
    el.style.setProperty("--bento-r", String(it.r));
    el.style.setProperty("--bento-w", String(it.w));
    el.style.setProperty("--bento-h", String(it.h));
    var lab = el.querySelector(".dam-bento-drop-ghost__label");
    if (lab && label) lab.textContent = label;
  }

  function cloneSolidItems(items) {
    var out = {};
    Object.keys(items || {}).forEach(function (k) {
      if (items[k] && !items[k].spacer) {
        out[k] = {
          c: items[k].c,
          r: items[k].r,
          w: items[k].w,
          h: items[k].h
        };
      }
    });
    return out;
  }

  /** Place dragged tile at target; swap single peer or push overlaps; no leftover overlap. */
  function placeDraggedAt(items, id, targetC, targetR, opts, host) {
    var trial = cloneSolidItems(items);
    var self = trial[id];
    if (!self) return items;
    var next = {
      c: clamp(targetC, 1, COLS - self.w + 1),
      r: clamp(targetR, 1, MAX_ROWS - self.h + 1),
      w: self.w,
      h: self.h
    };
    var old = { c: self.c, r: self.r, w: self.w, h: self.h };
    if (next.c === old.c && next.r === old.r) return trial;

    var overlapping = [];
    Object.keys(trial).forEach(function (other) {
      if (other === id) return;
      if (overlaps(next, trial[other])) overlapping.push(other);
    });

    if (overlapping.length === 1) {
      var oid = overlapping[0];
      var oItem = trial[oid];
      var swapOk =
        old.c + oItem.w - 1 <= COLS &&
        old.r + oItem.h - 1 <= MAX_ROWS;
      if (swapOk) {
        var probe = { c: old.c, r: old.r, w: oItem.w, h: oItem.h };
        var blocked = false;
        Object.keys(trial).forEach(function (k) {
          if (k === id || k === oid) return;
          if (overlaps(probe, trial[k])) blocked = true;
        });
        if (!blocked) {
          trial[oid] = probe;
          trial[id] = next;
          return trial;
        }
      }
    }

    trial[id] = next;
    overlapping.forEach(function (oid2) {
      if (!trial[oid2]) return;
      var o2 = trial[oid2];
      var others = cloneSolidItems(trial);
      delete others[oid2];
      var slot = findFreeSlot(others, o2.w, o2.h, {
        c: o2.c,
        r: next.r + next.h
      });
      trial[oid2] = { c: slot.c, r: slot.r, w: o2.w, h: o2.h };
    });
    return enforceMinsAndReflow(trial, Object.keys(trial), opts, host);
  }

  function interactiveBlocker(el) {
    if (!el || !el.closest) return null;
    return el.closest(
      "a, input, select, textarea, label, option," +
        "[data-bento-handle]," +
        ".dam-viz-icon-btn, .dam-win-btn, .dam-widget__layout-btn," +
        "[data-widget-layout-toggle], .dam-widget__actions button," +
        "button:not([data-bento-move])"
    );
  }

  /** Dashboard: body.dam-bento-layout-edit. Tasks: Dostosuj -> is-tasks-customize / body.dam-tasks-customize. */
  function layoutEditAllowed(host) {
    if (!host) return false;
    if (host.classList.contains("dam-tasks-bento")) {
      return (
        host.classList.contains("is-tasks-customize") ||
        !!(document.body && document.body.classList.contains("dam-tasks-customize"))
      );
    }
    if (host.id === "damDashGrid") {
      return !!(
        document.body &&
        document.body.classList.contains("dam-bento-layout-edit")
      );
    }
    return !!(
      document.body &&
      document.body.classList.contains("dam-bento-layout-edit")
    );
  }

  function resolveMoveItem(ev, host) {
    if (!host.classList.contains("is-bento-active")) return null;
    if (host.classList.contains("is-bento-resizing")) return null;
    if (!layoutEditAllowed(host)) return null;
    if (!ev.target || !ev.target.closest) return null;
    var moveBtn = ev.target.closest("[data-bento-move]");
    var chrome = ev.target.closest(
      ".dam-widget__head, .dam-bento-drag-chrome, .dam-tasks-ai__head"
    );
    if (!moveBtn && !chrome) return null;
    if (!moveBtn && interactiveBlocker(ev.target)) return null;
    var item = (moveBtn || chrome).closest("[data-bento-id]");
    if (!item || !host.contains(item) || item.classList.contains("dam-bento-spacer")) {
      return null;
    }
    if (
      item.classList.contains("dam-bento-skel-cell") ||
      item.classList.contains("dam-bento-source-hole") ||
      item.classList.contains("dam-bento-drop-ghost")
    ) {
      return null;
    }
    return item;
  }

  function bindMove(host, state) {
    host.addEventListener("pointerdown", function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      var item = resolveMoveItem(ev, host);
      if (!item) return;
      var id = item.getAttribute("data-bento-id");
      var start = state.items[id];
      if (!start || start.spacer) return;
      ev.preventDefault();
      ev.stopPropagation();

      var origin = { c: start.c, r: start.r, w: start.w, h: start.h };
      var hover = { c: origin.c, r: origin.r };
      /* Freeze layout at drag start so live preview can reflow neighbors from baseline. */
      var baseline = cloneSolidItems(state.items);
      state.moving = { id: id };

      showSkelGrid(host, state.items);
      var source = ensureGhostEl(host, "dam-bento-source-hole", "__bento_source");
      var ghost = ensureGhostEl(host, "dam-bento-drop-ghost", "__bento_ghost");
      setGhostRect(source, origin, null);
      setGhostRect(ghost, origin, origin.w + "×" + origin.h);
      ghost.classList.add("is-bento-ghost-live");
      item.classList.add("is-bento-drag-source");
      host.classList.add("is-bento-dragging");
      document.body.classList.add("dam-bento-moving");

      function previewNeighborShift(nextHover) {
        var preview = placeDraggedAt(
          baseline,
          id,
          nextHover.c,
          nextHover.r,
          state.opts,
          host
        );
        preview = enforceMinsAndReflow(
          preview,
          Object.keys(preview),
          state.opts,
          host
        );
        /* Keep dragged tile in place (hole); neighbors jump to tentative slots. */
        var visual = cloneSolidItems(preview);
        visual[id] = { c: origin.c, r: origin.r, w: origin.w, h: origin.h };
        applyStyles(host, visual, state.opts);
        if (typeof state.opts.onResizePreview === "function") {
          state.opts.onResizePreview(visual);
        }
        return preview;
      }

      function onMove(e) {
        hover = pointerToCell(host, e.clientX, e.clientY, origin.w, origin.h);
        setGhostRect(
          ghost,
          { c: hover.c, r: hover.r, w: origin.w, h: origin.h },
          origin.w + "×" + origin.h
        );
        previewNeighborShift(hover);
      }

      function onUp(e) {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        if (e) {
          hover = pointerToCell(host, e.clientX, e.clientY, origin.w, origin.h);
        }
        var placed = placeDraggedAt(
          baseline,
          id,
          hover.c,
          hover.r,
          state.opts,
          host
        );
        placed = enforceMinsAndReflow(
          placed,
          Object.keys(placed),
          state.opts,
          host
        );
        state.items = fillGaps(placed, Object.keys(placed), state.opts, host);
        clearDnDChrome(host);
        applyStyles(host, state.items, state.opts);
        syncSpacers(host, state.items);
        state.moving = null;
        var clean = cloneSolidItems(state.items);
        saveLayout(state.scope, clean);
        if (typeof state.opts.onChange === "function") {
          state.opts.onChange(clean);
        }
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  function bindResize(host, state) {
    if (host._damBentoBound) return;
    host._damBentoBound = true;
    bindMove(host, state);

    host.addEventListener("pointerdown", function (ev) {
      var handle = ev.target && ev.target.closest
        ? ev.target.closest("[data-bento-handle]")
        : null;
      if (!handle || !host.contains(handle)) return;
      if (!layoutEditAllowed(host)) return;
      var item = handle.closest("[data-bento-id]");
      if (!item || item.classList.contains("dam-bento-spacer")) return;
      var id = item.getAttribute("data-bento-id");
      var dir = handle.getAttribute("data-bento-handle");
      var start = state.items[id];
      if (!start) return;
      ev.preventDefault();
      ev.stopPropagation();

      var metrics = cellMetrics(host);
      var originX = ev.clientX;
      var originY = ev.clientY;
      var startItem = { c: start.c, r: start.r, w: start.w, h: start.h };
      state.dragging = { id: id, dir: dir };

      host.classList.add("is-bento-resizing");
      document.body.classList.add("dam-bento-resizing");
      if (dir === "s") document.body.classList.add("dam-bento-resizing-row");

      function onMove(e) {
        var dx = e.clientX - originX;
        var dy = e.clientY - originY;
        var dw = Math.round(dx / (metrics.col + metrics.gap));
        var dh = Math.round(dy / (metrics.row + metrics.gap));
        var next = { c: startItem.c, r: startItem.r, w: startItem.w, h: startItem.h };
        /* Tentative width first so aspect-aware mins (quick_links) see new w */
        if (dir === "e" || dir === "se") {
          next.w = clamp(startItem.w + dw, MIN_W, COLS - startItem.c + 1);
        }
        var selfMins = getMinSize(id, state.opts, item, next);
        if (dir === "e" || dir === "se") {
          next.w = clamp(startItem.w + dw, selfMins.w, COLS - startItem.c + 1);
        }
        if (dir === "s" || dir === "se") {
          next.h = clamp(
            startItem.h + dh,
            selfMins.h,
            MAX_ROWS - startItem.r + 1
          );
        } else if (next.h < selfMins.h) {
          /* Width change raised minH (e.g. quick_links narrowed) */
          next.h = Math.min(MAX_ROWS - startItem.r + 1, selfMins.h);
        }

        var trial = {};
        Object.keys(state.items).forEach(function (k) {
          if (state.items[k] && !state.items[k].spacer) {
            trial[k] = {
              c: state.items[k].c,
              r: state.items[k].r,
              w: state.items[k].w,
              h: state.items[k].h
            };
          }
        });
        trial[id] = next;

        /* Resolve overlaps: shrink / push siblings (respect their mins) */
        Object.keys(trial).forEach(function (other) {
          if (other === id) return;
          var O = trial[other];
          var oMins = getMinSize(other, state.opts, hostElForId(host, other), O);
          if (!overlaps(next, O)) return;
          if (dir === "e" || dir === "se") {
            if (O.c >= startItem.c + startItem.w - 1 || O.c >= next.c) {
              var newC = next.c + next.w;
              if (newC <= COLS) {
                var shrink = O.c + O.w - newC;
                if (shrink > 0) {
                  O.c = newC;
                  O.w = Math.max(oMins.w, O.w - shrink);
                  if (O.c + O.w - 1 > COLS) O.w = COLS - O.c + 1;
                  if (O.w < oMins.w) {
                    /* Cannot crush sibling below min - block grow */
                    next.w = Math.max(selfMins.w, O.c - next.c);
                    trial[id] = next;
                  }
                }
              }
            }
          }
          if (dir === "s" || dir === "se") {
            if (O.r >= startItem.r + startItem.h - 1 || O.r >= next.r) {
              var newR = next.r + next.h;
              if (newR <= MAX_ROWS) {
                var shrinkR = O.r + O.h - newR;
                if (shrinkR > 0) {
                  O.r = newR;
                  O.h = Math.max(oMins.h, O.h - shrinkR);
                  if (O.r + O.h - 1 > MAX_ROWS) O.h = MAX_ROWS - O.r + 1;
                  if (O.h < oMins.h) {
                    next.h = Math.max(selfMins.h, O.r - next.r);
                    trial[id] = next;
                  }
                }
              }
            }
          }
          /* side-by-side equalize when resizing height */
          if (
            (dir === "s" || dir === "se") &&
            O.r === next.r &&
            (O.c === next.c + next.w || next.c === O.c + O.w) &&
            !isNoStretch(other, state.opts, null)
          ) {
            O.h = Math.max(oMins.h, next.h);
          }
        });

        /* Drop spacers; rebuild fill */
        Object.keys(trial).forEach(function (k) {
          if (trial[k] && trial[k].spacer) delete trial[k];
        });
        var ids = Object.keys(trial);
        state.items = fillGaps(trial, ids, state.opts, host);
        applyStyles(host, state.items, state.opts);
        syncSpacers(host, state.items);
        if (typeof state.opts.onResizePreview === "function") {
          state.opts.onResizePreview(state.items);
        }
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        host.classList.remove("is-bento-resizing");
        document.body.classList.remove("dam-bento-resizing");
        document.body.classList.remove("dam-bento-resizing-row");
        state.dragging = null;
        /* persist without spacer keys; re-enforce mins */
        var persist = {};
        Object.keys(state.items).forEach(function (k) {
          if (state.items[k] && !state.items[k].spacer) {
            persist[k] = {
              c: state.items[k].c,
              r: state.items[k].r,
              w: state.items[k].w,
              h: state.items[k].h
            };
          }
        });
        persist = enforceMinsAndReflow(
          persist,
          Object.keys(persist),
          state.opts,
          host
        );
        state.items = fillGaps(persist, Object.keys(persist), state.opts, host);
        applyStyles(host, state.items, state.opts);
        syncSpacers(host, state.items);
        var clean = {};
        Object.keys(persist).forEach(function (k) {
          if (persist[k] && !persist[k].spacer) {
            clean[k] = {
              c: persist[k].c,
              r: persist[k].r,
              w: persist[k].w,
              h: persist[k].h
            };
          }
        });
        saveLayout(state.scope, clean);
        if (typeof state.opts.onChange === "function") {
          state.opts.onChange(clean);
        }
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  function collectItems(host, opts) {
    var sel = (opts && opts.itemSelector) || "[data-bento-id]";
    var nodes = [].slice.call(host.querySelectorAll(sel));
    var ids = [];
    var spans = {};
    var defaults = (opts && opts.defaults) || {};
    nodes.forEach(function (el) {
      if (el.classList.contains("dam-bento-spacer")) return;
      var id =
        el.getAttribute("data-bento-id") ||
        el.getAttribute((opts && opts.idAttr) || "data-widget-id");
      if (!id) return;
      el.setAttribute("data-bento-id", id);
      ids.push(id);
      if (defaults[id]) {
        spans[id] = { w: defaults[id].w, h: defaults[id].h };
      } else {
        spans[id] = sizeToSpan(null, el);
      }
      ensureHandles(el);
      ensureMoveHandle(el);
    });
    return { ids: ids, spans: spans };
  }

  function mount(host, opts) {
    if (!host) return null;
    ensureCss();
    opts = opts || {};
    var scope = opts.scope || host.getAttribute("data-bento-scope") || "default";
    host.classList.add("dam-bento-resize");
    if (opts.stackOnNarrow !== false) host.classList.add("dam-bento-resize--stack-sm");
    host.setAttribute("data-bento-scope", scope);

    /* Remount: clear prior handles/spacers/DnD chrome; allow rebinding */
    clearDnDChrome(host);
    host.querySelectorAll(
      ".dam-bento-handle, .dam-bento-move-handle, .dam-bento-spacer"
    ).forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    host._damBentoBound = false;

    var collected = collectItems(host, opts);
    var saved = loadLayout(scope);
    if (
      saved &&
      (saved.version == null || saved.version < BENTO_LAYOUT_VERSION)
    ) {
      saved = null;
    }
    var items = {};
    var packed;

    if (!saved && opts.defaults) {
      collected.ids.forEach(function (id3) {
        var seed3 = opts.defaults[id3] || collected.spans[id3];
        var mins3 = getMinSize(id3, opts, hostElForId(host, id3), seed3);
        items[id3] = normalizeItem(seed3, { c: 1, r: 1, w: 3, h: 2 }, mins3);
      });
    } else if (saved && saved.items) {
      collected.ids.forEach(function (id2) {
        if (saved.items[id2]) {
          var mins2 = getMinSize(
            id2,
            opts,
            hostElForId(host, id2),
            saved.items[id2]
          );
          items[id2] = normalizeItem(
            saved.items[id2],
            {
              c: 1,
              r: 1,
              w: (collected.spans[id2] && collected.spans[id2].w) || 3,
              h: (collected.spans[id2] && collected.spans[id2].h) || 2
            },
            mins2
          );
        } else if (opts.defaults && opts.defaults[id2]) {
          var mins2b = getMinSize(
            id2,
            opts,
            hostElForId(host, id2),
            opts.defaults[id2]
          );
          items[id2] = normalizeItem(
            opts.defaults[id2],
            { c: 1, r: 1, w: 3, h: 2 },
            mins2b
          );
        }
      });
      var missing = collected.ids.filter(function (id2) {
        return !items[id2];
      });
      if (missing.length) {
        packed = packDefaults(missing, collected.spans);
        missing.forEach(function (id2) {
          var minsM = getMinSize(
            id2,
            opts,
            hostElForId(host, id2),
            packed[id2]
          );
          items[id2] = normalizeItem(packed[id2], packed[id2], minsM);
        });
      }
    } else {
      packed = packDefaults(collected.ids, collected.spans);
      collected.ids.forEach(function (id4) {
        var mins4 = getMinSize(id4, opts, hostElForId(host, id4), packed[id4]);
        items[id4] = normalizeItem(packed[id4], packed[id4], mins4);
      });
    }

    /* Migrate undersized persisted layouts up to content-safe mins */
    items = enforceMinsAndReflow(items, collected.ids, opts, host);
    items = ensureVizProductsStackGap(items, collected.ids, opts, host);
    if (itemsOverlap(items)) {
      var spansRepack = {};
      collected.ids.forEach(function (oid) {
        if (!items[oid] || items[oid].spacer) return;
        var mRep = getMinSize(oid, opts, hostElForId(host, oid), items[oid]);
        spansRepack[oid] = {
          w: Math.max(mRep.w, items[oid].w),
          h: mRep.h
        };
      });
      items = packDefaults(
        collected.ids.filter(function (oid) {
          return !!spansRepack[oid];
        }),
        spansRepack
      );
      items = enforceMinsAndReflow(items, collected.ids, opts, host);
    }
    items = fillGaps(items, collected.ids, opts, host);
    host.classList.add("is-bento-active");
    applyStyles(host, items, opts);
    syncSpacers(host, items);

    /* Persist migrated mins so reload stays stable */
    var migrated = {};
    var migratedDirty = false;
    collected.ids.forEach(function (id5) {
      if (!items[id5] || items[id5].spacer) return;
      migrated[id5] = {
        c: items[id5].c,
        r: items[id5].r,
        w: items[id5].w,
        h: items[id5].h
      };
      if (
        saved &&
        saved.items &&
        saved.items[id5] &&
        itemLayoutChanged(saved.items[id5], items[id5])
      ) {
        migratedDirty = true;
      }
    });
    if (migratedDirty) saveLayout(scope, migrated);

    var state = {
      host: host,
      scope: scope,
      opts: opts,
      items: items,
      dragging: null
    };
    bindResize(host, state);

    _instances = _instances.filter(function (inst) {
      return inst.host !== host;
    });
    _instances.push(state);

    if (typeof opts.onLayout === "function") {
      try {
        opts.onLayout(migrated);
      } catch (eOn) {
        /* ignore */
      }
    }

    return {
      scope: scope,
      items: items,
      refresh: function () {
        mount(host, opts);
      },
      reset: function () {
        try {
          localStorage.removeItem(storageKey(scope));
        } catch (e) {
          /* ignore */
        }
        mount(host, opts);
      }
    };
  }

  function unmount(host) {
    if (!host) return;
    clearDnDChrome(host);
    host.classList.remove(
      "is-bento-active",
      "dam-bento-resize",
      "is-bento-resizing",
      "is-bento-dragging",
      "is-bento-skel-on"
    );
    host.querySelectorAll(
      ".dam-bento-handle, .dam-bento-move-handle, .dam-bento-spacer"
    ).forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    host._damBentoBound = false;
    _instances = _instances.filter(function (inst) {
      return inst.host !== host;
    });
  }

  function defaultTasksLayout() {
    return {
      ai: { c: 1, r: 1, w: 9, h: 3 },
      mytasks: { c: 1, r: 4, w: 5, h: 9 },
      notes: { c: 6, r: 4, w: 4, h: 9 },
      projects: { c: 1, r: 13, w: 5, h: 5 },
      people: { c: 6, r: 13, w: 4, h: 5 },
      comments: { c: 1, r: 18, w: 5, h: 4 },
      customize: { c: 6, r: 18, w: 4, h: 4 }
    };
  }

  /** Dashboard seed — media stack adjacent; syncMediaTileBentoHeights sets real h. */
  function defaultDashboardLayout() {
    return {
      products_count: { c: 1, r: 1, w: 3, h: 3 },
      projects_this_month: { c: 4, r: 1, w: 3, h: 3 },
      projects_in_progress: { c: 7, r: 1, w: 3, h: 3 },
      newest_viz_3: { c: 1, r: 4, w: 9, h: 8 },
      newest_products_f: { c: 1, r: 12, w: 9, h: 8 },
      branding_latest: { c: 1, r: 20, w: 9, h: 8 },
      notify_new_viz: { c: 1, r: 28, w: 3, h: 4 },
      checklists_ok: { c: 7, r: 28, w: 3, h: 4 },
      quick_links: { c: 1, r: 32, w: 9, h: 3 },
      asana_home: { c: 1, r: 35, w: 9, h: 8 }
    };
  }

  global.DamBentoResize = {
    COLS: COLS,
    MAX_ROWS: MAX_ROWS,
    ROW_PX: ROW_PX,
    MIN_W: MIN_W,
    MIN_H: MIN_H,
    DEFAULT_MIN_SIZES: DEFAULT_MIN_SIZES,
    STORAGE_PREFIX: STORAGE_PREFIX,
    storageKey: storageKey,
    sizeToSpan: sizeToSpan,
    getMinSize: getMinSize,
    enforceMinsAndReflow: enforceMinsAndReflow,
    loadLayout: loadLayout,
    saveLayout: saveLayout,
    mount: mount,
    unmount: unmount,
    defaultTasksLayout: defaultTasksLayout,
    defaultDashboardLayout: defaultDashboardLayout,
    BENTO_LAYOUT_VERSION: BENTO_LAYOUT_VERSION,
    packDefaults: packDefaults,
    fillGaps: fillGaps
  };
})(window);
