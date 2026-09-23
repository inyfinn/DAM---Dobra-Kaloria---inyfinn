/**
 * DAM - Dashboard widget registry, layout store, customize modal.
 */
(function (global) {
  "use strict";

  var LAYOUT_PREFIX = "dam_dash_layout_v1:";
  /* v4: third stat panel projects_in_progress next to products + month */
  var LAYOUT_VERSION = 4;
  var registry = [];
  var draftOrder = null;

  function t(key, fallback) {
    if (global.DamI18n && typeof DamI18n.t === "function") {
      var v = DamI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function userKey() {
    try {
      var u = JSON.parse(localStorage.getItem("dam_user") || "{}");
      if (u && u.email) return String(u.email).toLowerCase();
    } catch (e) { /* ignore */ }
    return localStorage.getItem("dam_user_email") || "anon";
  }

  function userRole() {
    return (
      localStorage.getItem("dam_role") ||
      (function () {
        try {
          return (JSON.parse(localStorage.getItem("dam_user") || "{}").role) || "";
        } catch (e) {
          return "";
        }
      })() ||
      "user"
    );
  }

  function defaultOrder() {
    return registry
      .filter(function (w) {
        return w.defaultOn;
      })
      .map(function (w) {
        return w.id;
      });
  }

  function allIds() {
    return registry.map(function (w) {
      return w.id;
    });
  }

  function migrateAsanaHomeOrder(order) {
    var known = {};
    allIds().forEach(function (id) {
      known[id] = true;
    });
    var next = (order || []).filter(function (id) {
      return known[id];
    });
    if (!known.asana_home) return next;
    if (next.indexOf("asana_home") >= 0) return next;
    var replaceAt = next.indexOf("tasks_next");
    if (replaceAt < 0) replaceAt = next.indexOf("asana_open");
    if (replaceAt >= 0) {
      next.splice(replaceAt, 1, "asana_home");
    } else {
      var after = next.indexOf("products_count");
      next.splice(after >= 0 ? after + 1 : 0, 0, "asana_home");
    }
    return next;
  }

  function migrateNewestProductsFOrder(order) {
    var known = {};
    allIds().forEach(function (id) {
      known[id] = true;
    });
    var next = (order || []).filter(function (id) {
      return known[id];
    });
    if (!known.newest_products_f) return next;
    if (next.indexOf("newest_products_f") >= 0) return next;
    var afterViz = next.indexOf("newest_viz_3");
    if (afterViz >= 0) {
      next.splice(afterViz + 1, 0, "newest_products_f");
      return next;
    }
    var afterBrand = next.indexOf("branding_latest");
    if (afterBrand >= 0) {
      next.splice(afterBrand + 1, 0, "newest_products_f");
      return next;
    }
    next.splice(0, 0, "newest_products_f");
    return next;
  }

  function migrateProjectsInProgressOrder(order) {
    var known = {};
    allIds().forEach(function (id) {
      known[id] = true;
    });
    var next = (order || []).filter(function (id) {
      return known[id];
    });
    if (!known.projects_in_progress) return next;
    if (next.indexOf("projects_in_progress") >= 0) return next;
    var afterMonth = next.indexOf("projects_this_month");
    if (afterMonth >= 0) {
      next.splice(afterMonth + 1, 0, "projects_in_progress");
      return next;
    }
    var afterProd = next.indexOf("products_count");
    if (afterProd >= 0) {
      next.splice(afterProd + 1, 0, "projects_in_progress");
      return next;
    }
    next.splice(0, 0, "projects_in_progress");
    return next;
  }

  function loadLayout() {
    defineWidgets();
    var key = LAYOUT_PREFIX + userKey();
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return { order: defaultOrder(), version: LAYOUT_VERSION };
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.order)) {
        return { order: defaultOrder(), version: LAYOUT_VERSION };
      }
      var known = {};
      allIds().forEach(function (id) {
        known[id] = true;
      });
      var order = parsed.order.filter(function (id) {
        return known[id];
      });
      if (!order.length) order = defaultOrder();
      var dirty = (parsed.version || 1) < LAYOUT_VERSION;
      if ((parsed.version || 1) < 2) {
        order = migrateAsanaHomeOrder(order);
      }
      if (order.indexOf("asana_home") < 0) {
        order = migrateAsanaHomeOrder(order);
      }
      if (order.indexOf("newest_products_f") < 0) {
        order = migrateNewestProductsFOrder(order);
        dirty = true;
      }
      if (order.indexOf("projects_in_progress") < 0) {
        order = migrateProjectsInProgressOrder(order);
        dirty = true;
      }
      if ((parsed.version || 1) < 3) {
        migrateAllTileCounts();
        dirty = true;
      }
      if (dirty) {
        saveLayout({ order: order });
      }
      return { order: order, version: LAYOUT_VERSION };
    } catch (e) {
      return { order: defaultOrder(), version: LAYOUT_VERSION };
    }
  }

  function saveLayout(layout) {
    localStorage.setItem(
      LAYOUT_PREFIX + userKey(),
      JSON.stringify({ version: LAYOUT_VERSION, order: layout.order || [] })
    );
  }

  function resetLayout() {
    localStorage.removeItem(LAYOUT_PREFIX + userKey());
  }

  function findWidget(id) {
    for (var i = 0; i < registry.length; i++) {
      if (registry[i].id === id) return registry[i];
    }
    return null;
  }

  function allowedForRole(w) {
    if (!w.roles || !w.roles.length) return true;
    var role = userRole();
    return w.roles.indexOf(role) !== -1;
  }

  var TILE_COUNTS = [2, 4, 6, 8, 10];
  var TILE_LAYOUTS = TILE_COUNTS.map(String);
  var MEDIA_TILE_IDS = ["newest_viz_3", "newest_products_f", "branding_latest"];

  function layoutStorageKey(widgetId) {
    return "dam_dash_tile_layout:" + userKey() + ":" + widgetId;
  }

  function migrateTileCountValue(raw) {
    var v = String(raw == null ? "" : raw).trim();
    if (v === "1x6") return "6";
    if (v === "1x4" || v === "2x2") return "4";
    var n = parseInt(v, 10);
    if (TILE_COUNTS.indexOf(n) >= 0) return String(n);
    return "4";
  }

  function migrateAllTileCounts() {
    MEDIA_TILE_IDS.forEach(function (id) {
      try {
        var k = layoutStorageKey(id);
        var cur = localStorage.getItem(k);
        if (cur == null) return;
        var next = migrateTileCountValue(cur);
        if (next !== cur) localStorage.setItem(k, next);
      } catch (eMigrate) {
        /* ignore */
      }
    });
  }

  function defaultTileLayout(widgetId) {
    return "4";
  }

  function getTileLayout(widgetId) {
    var fallback = defaultTileLayout(widgetId);
    try {
      var v = localStorage.getItem(layoutStorageKey(widgetId));
      return migrateTileCountValue(v == null ? fallback : v);
    } catch (e) {
      return fallback;
    }
  }

  function setTileLayout(widgetId, layout) {
    try {
      localStorage.setItem(layoutStorageKey(widgetId), migrateTileCountValue(layout));
    } catch (e) {}
  }

  function layoutCardCount(layout) {
    var n = parseInt(migrateTileCountValue(layout), 10);
    return TILE_COUNTS.indexOf(n) >= 0 ? n : 4;
  }

  function newestTitleForCount(kind, n) {
    var count = layoutCardCount(n);
    var fallbacks = {
      viz: {
        2: "2 najnowsze wizualizacje",
        4: "4 najnowsze wizualizacje",
        6: "6 najnowszych wizualizacji",
        8: "8 najnowszych wizualizacji",
        10: "10 najnowszych wizualizacji"
      },
      products: {
        2: "2 najnowsze produkty",
        4: "4 najnowsze produkty",
        6: "6 najnowszych produktów",
        8: "8 najnowszych produktów",
        10: "10 najnowszych produktów"
      },
      branding: {
        2: "2 najnowsze materiały branding",
        4: "4 najnowsze materiały branding",
        6: "6 najnowszych materiałów branding",
        8: "8 najnowszych materiałów branding",
        10: "10 najnowszych materiałów branding"
      }
    };
    var keyMap = { viz: "newest_viz", products: "newest_products_f", branding: "branding_latest" };
    var key = "dash.widget." + keyMap[kind] + "_" + count;
    var fb = (fallbacks[kind] && fallbacks[kind][count]) || fallbacks[kind][4];
    return t(key, fb);
  }

  function vizTitleForCount(n) {
    return newestTitleForCount("viz", n);
  }

  function productsTitleForCount(n) {
    return newestTitleForCount("products", n);
  }

  function brandingTitleForCount(n) {
    return newestTitleForCount("branding", n);
  }

  function recordMtimeMs(rec) {
    if (!rec) return 0;
    var ms = Number(rec.mtime_ms);
    if (ms && isFinite(ms)) return ms;
    var raw =
      rec.mtime ||
      rec.sortDate ||
      rec.date ||
      rec.asanaStart ||
      rec.revDate ||
      rec.mtClean ||
      "";
    var t = Date.parse(String(raw || ""));
    return t && isFinite(t) ? t : 0;
  }

  function compareNewestDesc(a, b) {
    var am = recordMtimeMs(a);
    var bm = recordMtimeMs(b);
    if (!am && !bm) return 0;
    if (!am) return 1;
    if (!bm) return -1;
    return bm - am;
  }

  function looksLikeThumbFile(pathOrName) {
    var name = String(pathOrName || "").split(/[/\\]/).pop() || "";
    return /\.(png|jpe?g|webp|gif|avif|svg|tif|tiff|bmp|psd|psb|ai|pdf)$/i.test(name);
  }

  /** Bridge expects forward slashes; Windows toLocal() may emit backslashes. */
  function normThumbPath(pathOrName) {
    return String(pathOrName || "").replace(/\\/g, "/");
  }

  function mediaPreviewUrl(path) {
    if (
      global.DamPreviewTruth &&
      typeof DamPreviewTruth.mediaPreviewUrl === "function"
    ) {
      return DamPreviewTruth.mediaPreviewUrl(path);
    }
    var p = String(path || "");
    if (!p || !looksLikeThumbFile(p)) return "";
    var bridge =
      (global.DamPaths && typeof DamPaths.bridgeUrl === "function" && DamPaths.bridgeUrl()) ||
      (global.DamRuntime && typeof DamRuntime.bridgeUrl === "function" && DamRuntime.bridgeUrl()) ||
      "http://127.0.0.1:8766";
    var local =
      global.DamPaths && typeof DamPaths.toLocal === "function"
        ? DamPaths.toLocal(p)
        : p;
    return bridge + "/media?path=" + encodeURIComponent(local) + "&preview=1";
  }

  function cardThumbUrl(path) {
    var p = normThumbPath(path);
    if (!p || !looksLikeThumbFile(p)) return "";
    if (
      global.DamPreviewTruth &&
      typeof DamPreviewTruth.thumbCacheUrl === "function"
    ) {
      /* Parity with dam-viz cardThumbSrc: profile=grid only (card AVIF fails in WebView). */
      return DamPreviewTruth.thumbCacheUrl(p, "grid");
    }
    return mediaPreviewUrl(p);
  }

  function collectRevWizki(rev) {
    if (!rev) return [];
    if (Array.isArray(rev.wizki) && rev.wizki.length) return rev.wizki.slice();
    var out = [];
    var fbr = rev.files_by_role || {};
    ["viz", "visual", "render"].forEach(function (role) {
      (fbr[role] || []).forEach(function (f) {
        if (f) out.push(f);
      });
    });
    return out;
  }

  /** Same FRONT-S tier rule as dam-viz firstWizkiPath (KAR6X -> FRONT-L). */
  function firstWizkiPathFromRev(rev) {
    var wizki = collectRevWizki(rev);
    var imgs = [];
    var i;
    for (i = 0; i < wizki.length; i++) {
      var f = wizki[i];
      var ext = String((f && f.ext) || "").toLowerCase();
      if (!ext && f && f.name) {
        ext = String(f.name.split(".").pop() || "").toLowerCase();
      }
      if (["jpg", "jpeg", "png", "webp", "gif"].indexOf(ext) !== -1) imgs.push(f);
    }
    if (!imgs.length) {
      return normThumbPath((wizki[0] && (wizki[0].path || wizki[0].rel)) || (rev && rev.path) || "");
    }
    var carrierU = String((rev && (rev.carrier || rev.carrier_code)) || "")
      .toUpperCase()
      .replace(/\s+/g, "");
    var preferFrontL = carrierU.indexOf("KAR6X") !== -1 || carrierU.indexOf("KARTON6X") !== -1;
    function tier(name) {
      var n = String(name || "")
        .toUpperCase()
        .replace(/\u0141/g, "L")
        .replace(/\u0142/g, "L");
      var isEnface = n.indexOf("ENFACE") !== -1 && n.indexOf("TYL") === -1;
      var isFrontToken = n.indexOf("FRONT") !== -1;
      var isFront = isFrontToken || isEnface;
      var isSklep = n.indexOf("SKLEP") !== -1;
      var isXl = /[-_]XL\b/.test(n) || n.indexOf("XL.") !== -1;
      var isFrontL = /FRONT[-_]?L\b/.test(n) || (isFrontToken && /[-_]L\./.test(n) && !isXl);
      var isFrontS =
        isFront &&
        !isSklep &&
        !isXl &&
        (n.indexOf("FRONT-S") !== -1 ||
          n.indexOf("ENFACE-S") !== -1 ||
          /(?:FRONT|ENFACE)[-_]?S\b/.test(n) ||
          /[-_]S\./.test(n));
      if (preferFrontL && isFrontL && !isEnface) return 0;
      if (preferFrontL && isEnface) return 4;
      if (isFrontS) return preferFrontL ? 1 : 0;
      if (isFront && isSklep && !isXl) return 2;
      if (isFront && (isXl || isFrontL)) return 3;
      if (isFront) return 4;
      if (n.indexOf("PREV") !== -1 || n.indexOf("WIZKA") !== -1 || n.indexOf("WIZ_") !== -1) return 5;
      if (n.indexOf("TYL") !== -1 || n.indexOf("BACK") !== -1) return 7;
      return 6;
    }
    var best = 99;
    imgs.forEach(function (f) {
      var t = tier(f.name || f.path || "");
      if (t < best) best = t;
    });
    var pool = imgs.filter(function (f) {
      return tier(f.name || f.path || "") === best;
    });
    pool.sort(function (a, b) {
      var ae = String(a.ext || "").toLowerCase();
      var be = String(b.ext || "").toLowerCase();
      var at = ae === "png" || ae === "webp" ? 1 : 0;
      var bt = be === "png" || be === "webp" ? 1 : 0;
      return bt - at;
    });
    var pick = pool[0] || imgs[0];
    return normThumbPath(pick.path || pick.rel || "");
  }

  function resolveVizThumbPath(viz, rev) {
    if (viz && viz.path && looksLikeThumbFile(viz.path)) {
      return normThumbPath(viz.path);
    }
    if (rev) {
      var fromRev = firstWizkiPathFromRev(rev);
      if (fromRev && looksLikeThumbFile(fromRev)) return fromRev;
    }
    return "";
  }

  function resolveProductThumbUrl(viz, rev) {
    var thumbPath = resolveVizThumbPath(viz, rev);
    if (thumbPath) return cardThumbUrl(thumbPath);
    return "";
  }

  function resolveDashboardThumbSrc(v, thumbPath) {
    if (
      v &&
      v.thumb_url &&
      String(v.thumb_url).indexOf("placeholder") === -1 &&
      (String(v.thumb_url).indexOf("/thumb-cache") >= 0 ||
        String(v.thumb_url).indexOf("/media?") >= 0)
    ) {
      return v.thumb_url;
    }
    var p =
      normThumbPath(thumbPath || (v && v.thumb_path) || "") ||
      (v && looksLikeThumbFile(v.path) ? normThumbPath(v.path) : "");
    if (p) return cardThumbUrl(p);
    return "";
  }

  function warmThumbPathsFromRows(rows) {
    return (rows || [])
      .map(function (v) {
        if (!v) return "";
        if (v.thumb_path) return normThumbPath(v.thumb_path);
        if (looksLikeThumbFile(v.path)) return normThumbPath(v.path);
        return "";
      })
      .filter(Boolean);
  }

  function ensureDashThumbReveal(root) {
    if (!root) return;
    root.querySelectorAll(".dam-widget__thumb").forEach(function (img) {
      img.style.opacity = "1";
      img.style.visibility = "visible";
    });
  }

  /** B5: dashboard-only layout safety (header wrap). Tile template lives in dam-dashboard.css. */
  function ensureDashLayoutCss() {
    if (document.getElementById("damDashLayoutB6Css")) return;
    var s = document.createElement("style");
    s.id = "damDashLayoutB6Css";
    s.textContent =
      "/* B5 QA: header must not force page horizontal scroll */" +
      "body.geex-dashboard .geex-content__header{" +
      "flex-wrap:wrap;min-width:0;max-width:100%;align-items:flex-start;gap:10px 16px;}" +
      "body.geex-dashboard .geex-content__header__content," +
      "body.geex-dashboard .geex-content__header__title{" +
      "min-width:0;max-width:100%;}" +
      "body.geex-dashboard .geex-content__header__action{" +
      "flex:1 1 auto;min-width:0;max-width:100%;display:flex;flex-wrap:wrap;" +
      "justify-content:flex-end;align-items:center;gap:8px;}" +
      "body.geex-dashboard .geex-content__header__action__wrap," +
      "body.geex-dashboard .geex-content__header__quickaction{" +
      "min-width:0;max-width:100%;display:flex;flex-wrap:wrap;" +
      "justify-content:flex-end;align-items:center;gap:4px;}" +
      "body.geex-dashboard .geex-content__header__customizer{" +
      "flex-wrap:wrap;min-width:0;}" +
      "body.geex-dashboard .geex-main-content," +
      "body.geex-dashboard .geex-content," +
      "body.geex-dashboard .geex-content__wrapper," +
      "body.geex-dashboard .geex-content__section-wrapper{" +
      "min-width:0;max-width:100%;}" +
      "body.geex-dashboard .geex-customizer{" +
      "position:fixed!important;}";
    document.head.appendChild(s);
  }

  /** Chrome-only floor. Real --bento-h comes from measured content rows. */
  function mediaLayoutMinH(_layout) {
    return 3;
  }

  /**
   * Measure li-driven card height and write --bento-h so grid cell matches content.
   * Always re-pack viz → products → branding (no phantom empty rows between).
   */
  var _syncMediaHeightsLock = false;
  function syncMediaTileBentoHeights(mount) {
    mount = mount || document.getElementById("damDashGrid");
    var BR = global.DamBentoResize;
    if (!mount || !BR || typeof BR.loadLayout !== "function") {
      return false;
    }
    if (_syncMediaHeightsLock) {
      setTimeout(function () {
        syncMediaTileBentoHeights(mount);
      }, 160);
      return false;
    }
    var scope = "dashboard";
    var saved = BR.loadLayout(scope);
    if (!saved || !saved.items) {
      saved = {
        version: BR.BENTO_LAYOUT_VERSION != null ? BR.BENTO_LAYOUT_VERSION : 10,
        items:
          typeof BR.defaultDashboardLayout === "function"
            ? BR.defaultDashboardLayout()
            : {}
      };
    }
    var rowPx = BR.ROW_PX || 48;
    /* CSS gap inflates cell height: n*row + (n-1)*gap — must count in row math
     * or --bento-h overshoots and leaves ~160px phantom space under cards. */
    var gapPx = 16;
    try {
      var g = parseFloat(global.getComputedStyle(mount).rowGap);
      if (g > 0) gapPx = g;
    } catch (eGap) {
      /* keep 16 */
    }
    function rowsForContentPx(px) {
      if (!(px > 0)) return 1;
      if (!(gapPx > 0)) return Math.max(1, Math.ceil(px / rowPx));
      return Math.max(1, Math.ceil((px + gapPx) / (rowPx + gapPx)));
    }
    var ids = ["newest_viz_3", "newest_products_f", "branding_latest"];
    var changed = false;
    function mediaContentPx(el) {
      var list = el.querySelector(".dam-widget__list");
      var head =
        el.querySelector(".dam-widget__head") ||
        el.querySelector(".dam-widget__title") ||
        el.querySelector("h3");
      var headH = head ? Math.ceil(head.getBoundingClientRect().height || 0) : 48;
      if (!list) {
        var meta = el.querySelector(".dam-widget__meta");
        return headH + (meta ? Math.ceil(meta.getBoundingClientRect().height || 0) + 24 : 32) + 24;
      }
      var rows = list.querySelectorAll("li.dam-widget__viz-row");
      if (!rows.length) {
        return headH + 48;
      }
      var firstH = Math.ceil(rows[0].getBoundingClientRect().height || 0);
      if (!(firstH > 8)) firstH = 128;
      var cs = global.getComputedStyle(list);
      var listGap = parseFloat(cs.rowGap);
      if (!(listGap > 0)) listGap = 16;
      var cols = (cs.gridTemplateColumns || "")
        .split(" ")
        .filter(function (p) {
          return p && p !== "none";
        }).length;
      if (!(cols > 0)) cols = 2;
      var nRows = Math.ceil(rows.length / cols);
      var listH = Math.ceil(list.scrollHeight || 0);
      if (!(listH > 8)) {
        listH = nRows * firstH + Math.max(0, nRows - 1) * listGap;
      }
      var csEl = global.getComputedStyle(el);
      var padY =
        (parseFloat(csEl.paddingTop) || 0) + (parseFloat(csEl.paddingBottom) || 0);
      var extra = 0;
      var foot = el.querySelector(".dam-widget__body > .dam-widget__meta");
      if (foot) {
        extra += Math.ceil(foot.getBoundingClientRect().height || 0) + 10;
      }
      return Math.ceil(headH + listH + padY + extra + 4);
    }
    function quickLinksContentPx(el) {
      var head =
        el.querySelector(".dam-widget__head") ||
        el.querySelector(".dam-widget__title") ||
        el.querySelector("h3");
      var headH = head ? Math.ceil(head.getBoundingClientRect().height || 0) : 28;
      var links = el.querySelector(".dam-widget__links");
      var linksH = 44;
      if (links) {
        var prevFlex = links.style.flex;
        var prevH = links.style.height;
        links.style.flex = "0 0 auto";
        links.style.height = "auto";
        linksH = Math.ceil(links.scrollHeight || links.getBoundingClientRect().height || 0);
        links.style.flex = prevFlex;
        links.style.height = prevH;
      }
      if (!(linksH > 8)) linksH = 44;
      var csEl = global.getComputedStyle(el);
      var padY =
        (parseFloat(csEl.paddingTop) || 0) + (parseFloat(csEl.paddingBottom) || 0);
      var headMb = 0;
      if (head) {
        try {
          headMb = parseFloat(global.getComputedStyle(head).marginBottom) || 0;
        } catch (eMb) {
          headMb = 8;
        }
      }
      return Math.ceil(headH + headMb + linksH + padY + 4);
    }
    ids.forEach(function (id) {
      var el = mount.querySelector('[data-widget-id="' + id + '"]');
      if (!el || !saved.items[id]) return;
      if (!el.classList.contains("dam-widget--media-latest")) {
        el.classList.add("dam-widget--media-latest");
      }
      el.setAttribute("data-bento-id", id);
      var px = mediaContentPx(el);
      var need = px > 40 ? rowsForContentPx(px) : 3;
      if (saved.items[id].h !== need) {
        saved.items[id].h = need;
        changed = true;
      }
      el.style.setProperty("--bento-h", String(need));
      el.setAttribute("data-bento-min-h", String(need));
    });

    var row = 4;
    ids.forEach(function (id) {
      if (!saved.items[id]) return;
      var it = saved.items[id];
      if (it.c !== 1 || it.r !== row || it.w !== 9) changed = true;
      saved.items[id] = {
        c: 1,
        r: row,
        w: 9,
        h: it.h
      };
      row += saved.items[id].h;
    });
    var bandH = 4;
    if (saved.items.notify_new_viz) {
      var n0 = saved.items.notify_new_viz;
      if (n0.c !== 1 || n0.r !== row || n0.w !== 3 || n0.h !== bandH) changed = true;
      saved.items.notify_new_viz = { c: 1, r: row, w: 3, h: bandH };
    }
    if (saved.items.checklists_ok) {
      var c0 = saved.items.checklists_ok;
      if (c0.c !== 7 || c0.r !== row || c0.w !== 3 || c0.h !== bandH) changed = true;
      saved.items.checklists_ok = { c: 7, r: row, w: 3, h: bandH };
    }
    row += bandH;
    if (saved.items.quick_links) {
      var qEl = mount.querySelector('[data-widget-id="quick_links"]');
      if (qEl) qEl.setAttribute("data-bento-id", "quick_links");
      var qPx = qEl ? quickLinksContentPx(qEl) : 96;
      var qNeed = Math.max(2, rowsForContentPx(qPx));
      var q0 = saved.items.quick_links;
      if (q0.c !== 1 || q0.r !== row || q0.w !== 9 || q0.h !== qNeed) changed = true;
      saved.items.quick_links = { c: 1, r: row, w: 9, h: qNeed };
      if (qEl) {
        qEl.style.setProperty("--bento-h", String(qNeed));
        qEl.setAttribute("data-bento-min-h", String(qNeed));
      }
      row += qNeed;
    }
    if (saved.items.asana_home) {
      var aH = saved.items.asana_home.h || 8;
      var a0 = saved.items.asana_home;
      if (a0.c !== 1 || a0.r !== row || a0.w !== 9) changed = true;
      saved.items.asana_home = { c: 1, r: row, w: 9, h: aH };
    }

    /* ALWAYS write --bento-* onto live articles. outerHTML replace drops
     * data-bento-id and grid placement; skipping when saved.h is unchanged
     * left branding/products auto-placed on top of viz. */
    _syncMediaHeightsLock = true;
    try {
      if (typeof BR.saveLayout === "function") BR.saveLayout(scope, saved.items);
      Object.keys(saved.items).forEach(function (id) {
        var el =
          mount.querySelector('[data-widget-id="' + id + '"]') ||
          mount.querySelector('[data-bento-id="' + id + '"]');
        var it = saved.items[id];
        if (!el || !it || it.spacer) return;
        el.setAttribute("data-bento-id", id);
        el.style.setProperty("--bento-c", String(it.c));
        el.style.setProperty("--bento-r", String(it.r));
        el.style.setProperty("--bento-w", String(it.w));
        el.style.setProperty("--bento-h", String(it.h));
      });
    } finally {
      setTimeout(function () {
        _syncMediaHeightsLock = false;
      }, 120);
    }
    return true;
  }

  function scheduleSyncMediaTileHeights() {
    var mount = document.getElementById("damDashGrid");
    if (!mount) return;
    mount.querySelectorAll("img.dam-widget__thumb").forEach(function (img) {
      if (img._damBentoLoad) return;
      img._damBentoLoad = true;
      img.addEventListener("load", function () {
        scheduleSyncMediaTileHeights();
      });
    });
    [0, 400, 900, 1600].forEach(function (ms) {
      setTimeout(function () {
        syncMediaTileBentoHeights(mount);
      }, ms);
    });
  }

  function layoutToggleHtml(widgetId, layout) {
    var count = layoutCardCount(layout);
    var aria = t(
      "dash.widget.tile_count_aria",
      "Liczba kafelków: 2, 4, 6, 8 albo 10"
    );
    var options = TILE_COUNTS.map(function (n) {
      return (
        '<option value="' +
        n +
        '"' +
        (n === count ? " selected" : "") +
        ">" +
        n +
        "</option>"
      );
    }).join("");
    // Natywnej listy <select> nie da sie ostylowac (rysuje ja system, nie strona),
    // wiec <select> zostaje wylacznie jako nosnik stanu - to na nim dalej leci
    // "change", ktory lapie bindLayoutToggle. Widoczna jest kontrolka DAM.
    var menuOptions = TILE_COUNTS.map(function (n) {
      return (
        '<button type="button" role="option" class="dam-widget__count-option" data-count-value="' +
        n +
        '" aria-selected="' +
        (n === count ? "true" : "false") +
        '" tabindex="-1">' +
        n +
        "</button>"
      );
    }).join("");
    return (
      '<div class="dam-widget__actions">' +
      '<div class="dam-widget__count-field" data-dam-count-field>' +
      '<select class="dam-widget__count-native" data-widget-layout-toggle="' +
      escapeHtml(widgetId) +
      '" data-layout="' +
      escapeHtml(String(count)) +
      '" tabindex="-1" aria-hidden="true">' +
      options +
      "</select>" +
      '<button type="button" class="dam-widget__count-select" data-dam-count-trigger' +
      ' aria-haspopup="listbox" aria-expanded="false" aria-label="' +
      escapeHtml(aria) +
      '" data-dam-tip="' +
      escapeHtml(aria) +
      '">' +
      '<span class="dam-widget__count-value">' +
      count +
      "</span>" +
      '<i class="uil uil-angle-down dam-widget__count-caret" aria-hidden="true"></i>' +
      "</button>" +
      '<div class="dam-widget__count-menu" role="listbox" aria-label="' +
      escapeHtml(aria) +
      '" hidden>' +
      menuOptions +
      "</div></div></div>"
    );
  }

  /* --- Lista liczby kafelkow: jedna delegacja na dokument ---------------------
     Widgety przerysowuja sie w calosci, wiec handlery per element gineloby przy
     kazdym renderze. Delegacja na dokumencie przezywa kazdy remount. */
  var _countMenuBound = false;

  function closeCountMenus(except) {
    var fields = document.querySelectorAll("[data-dam-count-field]");
    for (var i = 0; i < fields.length; i += 1) {
      if (fields[i] === except) continue;
      var menu = fields[i].querySelector(".dam-widget__count-menu");
      var trigger = fields[i].querySelector("[data-dam-count-trigger]");
      if (menu) menu.hidden = true;
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      fields[i].classList.remove("is-open");
    }
  }

  function openCountMenu(field) {
    var menu = field.querySelector(".dam-widget__count-menu");
    var trigger = field.querySelector("[data-dam-count-trigger]");
    if (!menu || !trigger) return;
    closeCountMenus(field);
    menu.hidden = false;
    field.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    var sel = menu.querySelector('[aria-selected="true"]') || menu.firstElementChild;
    if (sel) sel.focus();
  }

  function chooseCount(field, value) {
    var native = field.querySelector(".dam-widget__count-native");
    var trigger = field.querySelector("[data-dam-count-trigger]");
    var label = field.querySelector(".dam-widget__count-value");
    var opts = field.querySelectorAll(".dam-widget__count-option");
    for (var i = 0; i < opts.length; i += 1) {
      opts[i].setAttribute(
        "aria-selected",
        opts[i].getAttribute("data-count-value") === String(value) ? "true" : "false"
      );
    }
    if (label) label.textContent = String(value);
    closeCountMenus(null);
    if (trigger) trigger.focus();
    if (native && native.value !== String(value)) {
      native.value = String(value);
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function bindCountMenus() {
    if (_countMenuBound) return;
    _countMenuBound = true;
    document.addEventListener("click", function (ev) {
      var trigger = ev.target.closest && ev.target.closest("[data-dam-count-trigger]");
      if (trigger) {
        ev.preventDefault();
        var field = trigger.closest("[data-dam-count-field]");
        if (!field) return;
        if (field.classList.contains("is-open")) closeCountMenus(null);
        else openCountMenu(field);
        return;
      }
      var opt = ev.target.closest && ev.target.closest(".dam-widget__count-option");
      if (opt) {
        ev.preventDefault();
        var f = opt.closest("[data-dam-count-field]");
        if (f) chooseCount(f, opt.getAttribute("data-count-value"));
        return;
      }
      closeCountMenus(null);
    });
    document.addEventListener("keydown", function (ev) {
      var field = ev.target.closest && ev.target.closest("[data-dam-count-field]");
      if (!field) return;
      var open = field.classList.contains("is-open");
      if (ev.key === "Escape" && open) {
        ev.preventDefault();
        closeCountMenus(null);
        var tr = field.querySelector("[data-dam-count-trigger]");
        if (tr) tr.focus();
        return;
      }
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.classList.contains("dam-widget__count-option")) {
        ev.preventDefault();
        chooseCount(field, ev.target.getAttribute("data-count-value"));
        return;
      }
      if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
      ev.preventDefault();
      if (!open) {
        openCountMenu(field);
        return;
      }
      var list = [].slice.call(field.querySelectorAll(".dam-widget__count-option"));
      var idx = list.indexOf(document.activeElement);
      var next = ev.key === "ArrowDown" ? idx + 1 : idx - 1;
      if (next < 0) next = list.length - 1;
      if (next >= list.length) next = 0;
      if (list[next]) list[next].focus();
    });
  }

  function shell(w, bodyHtml, extraClass, headActionsHtml) {
    var size = w.size || "sm";
    var cls =
      "dam-widget dam-widget--" +
      size +
      (extraClass ? " " + extraClass : "") +
      (w.accent ? " dam-widget--accent" : "");
    return (
      '<article class="' +
      cls +
      '" data-widget-id="' +
      escapeHtml(w.id) +
      '" aria-labelledby="dw-title-' +
      escapeHtml(w.id) +
      '">' +
      '<div class="dam-widget__head">' +
      '<h3 class="dam-widget__title" id="dw-title-' +
      escapeHtml(w.id) +
      '">' +
      escapeHtml(w.title) +
      "</h3>" +
      (headActionsHtml || "") +
      "</div>" +
      '<div class="dam-widget__body">' +
      bodyHtml +
      "</div>" +
      "</article>"
    );
  }

  function dirnamePath(p) {
    var s = String(p || "").replace(/\\/g, "/");
    var i = s.lastIndexOf("/");
    return i > 0 ? s.slice(0, i) : s;
  }

  /** Folder names that must never become branding_latest row titles. */
  var BRANDING_LATEST_JUNK_FOLDER_RE =
    /^(?:\d+\s*-\s*)?(?:elementy|elements|links?|wizki|visuals?|wizualizacje|packshots?|miniatura|galeria|preview|thumbs?|exports?|web_rgb|print_cmyk|internet_prezentacje_rgb|gotowe|ready|finals?)$/i;

  function folderLabel(path, asset) {
    var parts = dirnamePath(path).split("/").filter(Boolean);
    if (!parts.length) return "Material";
    var skip = /^(miniatura|galeria|preview|thumbs?|exports?|\d+x|web_rgb|print_cmyk)$/i;
    while (parts.length > 1 && skip.test(parts[parts.length - 1])) {
      parts.pop();
    }
    /* Walk past WIZKI / VISUALS / ELEMENTY / links — show product/campaign folder. */
    while (parts.length > 1 && BRANDING_LATEST_JUNK_FOLDER_RE.test(parts[parts.length - 1])) {
      parts.pop();
    }
    var last = parts[parts.length - 1] || "";
    if (BRANDING_LATEST_JUNK_FOLDER_RE.test(last) || !last) {
      var nameHint = String((asset && (asset.name || asset.file_name)) || "").replace(
        /\.[a-z0-9]+$/i,
        ""
      );
      if (nameHint && nameHint.length >= 4) return nameHint.trim();
      return "Material";
    }
    var prev = parts.length > 1 ? parts[parts.length - 2] : "";
    if (/^\d+x$/i.test(last) && prev) return prev + " / " + last;
    if (/^\d{2}\s*-\s*/.test(last) && prev) return prev + " / " + last;
    var fileHint = String((asset && (asset.name || asset.file_name)) || "");
    var stem = fileHint.replace(/\.[a-z0-9]+$/i, "").trim();
    if (stem && /---/.test(stem) && stem.length >= 8) return stem;
    var m = fileHint.match(/^(.+?)\s*-\s*\d+\.(png|jpg|jpeg|webp|svg)$/i);
    if (m && m[1] && m[1].length >= 4) return m[1].trim();
    return last;
  }

  function normalizeBrandingMediaType(mt) {
    if (global.DamAssetTaxonomy && typeof DamAssetTaxonomy.normalizeMediaType === "function") {
      return DamAssetTaxonomy.normalizeMediaType(mt);
    }
    var m = String(mt || "").toLowerCase();
    return m === "raster" ? "image" : m;
  }

  /** Browser-safe raster only (PSD/AI break native <img> /media). */
  function isRasterPreviewPath(pathOrName) {
    var p = String(pathOrName || "");
    if (!p || /(^|[\\/])\._/.test(p)) return false;
    return /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(p);
  }

  function isBrandingLatestSourceFile(a) {
    if (!a) return true;
    var mt = normalizeBrandingMediaType(a.media_type);
    if (mt === "source") return true;
    var role = String(a.asset_role || "").toLowerCase();
    if (role === "artwork_source") return true;
    var ext = String(a.name || a.path || "")
      .split(".")
      .pop()
      .toLowerCase();
    return /^(psd|psb|ai|indd|indt|eps|tif|tiff)$/.test(ext);
  }

  /**
   * HARD filter branding_latest: only finished raster/vector graphics.
   * Never ELEMENTY / links / product_element / source (spirit of Tylko grafiki).
   * Path/name only — never full search_blob (OCR blobs are huge; first-load OOM).
   */
  function isBrandingWidgetThumb(a) {
    if (!a) return false;
    var role = String(a.asset_role || "").toLowerCase();
    if (role === "product_element" || role === "artwork_source") return false;
    var mt = normalizeBrandingMediaType(a.media_type);
    if (mt === "document" || mt === "video" || mt === "source") return false;
    if (isBrandingLatestSourceFile(a)) return false;
    var pathNorm = String(a.path || "").replace(/\\/g, "/");
    var name = String(a.name || "");
    var pathLower = pathNorm.toLowerCase();
    if (
      /(^|\/)\d*\s*-?\s*elementy(\/|$)/i.test(pathNorm) ||
      /(^|\/)elements(\/|$)/i.test(pathLower)
    ) {
      return false;
    }
    var segs = pathNorm.split("/");
    var si;
    for (si = 0; si < segs.length; si++) {
      if (/^links?$/i.test(String(segs[si] || "").trim())) return false;
      if (/^(?:\d+\s*-\s*)?elementy$/i.test(String(segs[si] || "").trim())) return false;
      if (/^elements$/i.test(String(segs[si] || "").trim())) return false;
    }
    if (/(^|[\\/])\._/.test(pathNorm) || /(^|[\\/])\._/.test(name)) return false;
    var p = name || pathNorm;
    if (isRasterPreviewPath(p) || /\.svg$/i.test(p)) return true;
    return mt === "image" || mt === "vector";
  }

  function brandingAssetMtimeMs(a) {
    var ms = Number(a && a.mtime_ms);
    if (ms && isFinite(ms)) return ms;
    var t = Date.parse(String((a && a.mtime) || "") || "");
    return isFinite(t) ? t : 0;
  }

  /**
   * Newest thumb-eligible assets only (cap scan) — dashboard needs N groups, not 50k.
   */
  function collectRecentBrandingThumbs(assets, needGroups) {
    var need = Math.max(4, needGroups || 4);
    var wantDirs = Math.max(need * 4, 16);
    var wantAssets = Math.max(need * 12, 48);
    var list = assets || [];
    var scored = [];
    var i;
    var a;
    for (i = 0; i < list.length; i++) {
      a = list[i];
      if (!isBrandingWidgetThumb(a)) continue;
      scored.push(a);
    }
    scored.sort(function (x, y) {
      return brandingAssetMtimeMs(y) - brandingAssetMtimeMs(x);
    });
    var out = [];
    var dirs = Object.create(null);
    var dirCount = 0;
    var key;
    for (i = 0; i < scored.length; i++) {
      a = scored[i];
      out.push(a);
      key = dirnamePath(a.path || a.folder_group_id || a.id).toLowerCase();
      if (!dirs[key]) {
        dirs[key] = 1;
        dirCount += 1;
      }
      if (dirCount >= wantDirs && out.length >= wantAssets) break;
      if (out.length >= 400) break;
    }
    return out;
  }

  function pickBrandingCover(arr) {
    var list = (arr || []).slice();
    if (!list.length) return null;
    list.sort(compareNewestDesc);
    var i;
    for (i = 0; i < list.length; i++) {
      if (isRasterPreviewPath(list[i].name || list[i].path || "")) return list[i];
    }
    for (i = 0; i < list.length; i++) {
      if (/\.svg$/i.test(String(list[i].name || list[i].path || ""))) return list[i];
    }
    return list[0];
  }

  /** Badges for branding_latest — same color families as viz/explorer pills. */
  function brandingBadgesHtml(asset, group) {
    var a = asset || {};
    var seen = {};
    var chips = [];
    function push(label, mod) {
      var t = String(label || "").trim();
      if (!t) return;
      var key = t.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      var cls = "dam-viz-badge dam-badge-tag";
      if (mod) cls += " " + mod;
      chips.push({ t: t, cls: cls });
    }
    if (a.brand) push(a.brand, "dam-viz-badge--brand");
    var apps = Array.isArray(a.appearance_tags) ? a.appearance_tags : [];
    var ai;
    for (ai = 0; ai < apps.length && ai < 2; ai++) {
      push(apps[ai], "dam-viz-badge--subcat");
    }
    var mt = normalizeBrandingMediaType(a.media_type);
    if (mt === "image") push("Grafika", "dam-viz-badge--cat");
    else if (mt === "vector") push("Wektor", "dam-viz-badge--cat");
    else if (mt && mt !== "document") push(mt, "dam-viz-badge--meta");
    var bg = String(a.background || "").toLowerCase();
    if (bg === "transparent" || /przezrocz/.test(bg)) {
      push("Przezroczyste", "dam-viz-badge--lang");
    } else if (bg && bg !== "null" && bg !== "none") {
      push(a.background, "dam-viz-badge--lang");
    }
    var tags = Array.isArray(a.tags) ? a.tags : [];
    var ti;
    for (ti = 0; ti < tags.length && ti < 2; ti++) {
      push(tags[ti], "dam-viz-badge--carrier");
    }
    if (group && group.count > 1) {
      push("x" + group.count + " warianty", "dam-viz-badge--variants");
    }
    return chips
      .slice(0, 5)
      .map(function (c) {
        return (
          '<span class="' +
          escapeHtml(c.cls) +
          '">' +
          escapeHtml(c.t) +
          "</span>"
        );
      })
      .join("");
  }

  function brandingThumbUrl(asset) {
    var path = (asset && asset.path) || "";
    if (!path) return "";
    var cached = cardThumbUrl(path);
    if (cached) return cached;
    return mediaPreviewUrl(path);
  }

  /** Honest PL placeholder (never Synology Drive lie). */
  function brandingThumbPlaceholderDataUri() {
    var label =
      (global.DamPreviewTruth && DamPreviewTruth.LABEL_HINT) || "brak podglądu";
    /* bez wlasnego tla: jasny prostokat byl biala plama w ciemnym motywie */
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
      '<rect x="36" y="44" width="88" height="64" rx="8" fill="none" stroke="#7A9A8C" stroke-width="3"/>' +
      '<circle cx="62" cy="68" r="8" fill="#7A9A8C"/>' +
      '<path d="M44 96l22-20 18 16 12-10 20 22" fill="none" stroke="#7A9A8C" stroke-width="3" stroke-linecap="round"/>' +
      '<text x="80" y="132" text-anchor="middle" font-family="Jost,sans-serif" font-size="11" fill="#7A9A8C">' +
      String(label).replace(/[<&]/g, "") +
      "</text></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function bindHonestThumbFallbacks(root) {
    if (!root) return;
    var ph = brandingThumbPlaceholderDataUri();
    var title =
      (global.DamPreviewTruth &&
        typeof DamPreviewTruth.onErrorTitle === "function" &&
        DamPreviewTruth.onErrorTitle()) ||
      "Podglad niedostępny";
    root.querySelectorAll("img.dam-widget__thumb").forEach(function (img) {
      if (img._damHonestThumb) return;
      img._damHonestThumb = true;
      var initialSrc = img.getAttribute("src") || "";
      img._damOriginalThumbSrc =
        initialSrc && initialSrc.indexOf("data:image/") !== 0 ? initialSrc : "";
      img._damThumbRetryCount = 0;
      img.addEventListener("load", function () {
        if (img.getAttribute("src") === ph) return;
        img.classList.remove("dam-widget__thumb--fallback");
        img.removeAttribute("title");
        img._damThumbRetryCount = 0;
      });
      img.addEventListener("error", function () {
        var path =
          img.getAttribute("data-thumb-path") ||
          img.getAttribute("data-media-path") ||
          img.getAttribute("data-path") ||
          "";
        /*
         * DAM.exe uruchamia WebView rownolegle z mostem. Pierwszy request obrazu
         * moze trafic w kilkuset-ms okno przed startem :8766. Nie utrwalaj wtedy
         * placeholdera do konca sesji - ponow oryginalny /thumb-cache z backoff.
         */
        if (img._damOriginalThumbSrc && img._damThumbRetryCount < 3) {
          img._damThumbRetryCount += 1;
          var retryNo = img._damThumbRetryCount;
          img.src = ph;
          img.classList.add("dam-widget__thumb--fallback");
          setTimeout(function () {
            if (!document.documentElement.contains(img)) return;
            var sep = img._damOriginalThumbSrc.indexOf("?") >= 0 ? "&" : "?";
            img.src = img._damOriginalThumbSrc + sep + "dam_retry=" + retryNo;
          }, retryNo * 700);
          return;
        }
        if (img.dataset.damThumbFallback !== "1" && path) {
          var live = mediaPreviewUrl(path);
          if (live && live !== img.getAttribute("src")) {
            img.dataset.damThumbFallback = "1";
            img.removeAttribute("srcset");
            img.src = live;
            return;
          }
        }
        if (img.dataset.damThumbFallback === "2") return;
        img.dataset.damThumbFallback = "2";
        img.removeAttribute("srcset");
        img.src = ph;
        img.alt = title;
        img.title = title;
        img.classList.add("dam-widget__thumb--fallback");
      });
    });
  }

  function brandingBridgeBase() {
    return (
      (global.DamPaths && typeof DamPaths.bridgeUrl === "function" && DamPaths.bridgeUrl()) ||
      (global.DamRuntime && typeof DamRuntime.bridgeUrl === "function" && DamRuntime.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  /*
   * HARD freeze fix: NEVER fetch data/branding-index.json (~388MB).
   * /branding-for-product is not a bridge route (404) — dashboard used it and
   * painted "Indeks branding niedostępny". Same sources as branding.html:
   * branding-grid-head.json then branding-grid-index.json (static + bridge).
   */
  function fetchJsonOk(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http-" + r.status);
      return r.json();
    });
  }

  function adoptBrandingSlice(data, partial) {
    if (!data || !Array.isArray(data.assets) || !data.assets.length) {
      throw new Error("branding-index-unavailable");
    }
    return { assets: data.assets, partial: !!partial || !!data.partial };
  }

  function damBridgeAuthHeaders() {
    var headers = {};
    try {
      var tok = localStorage.getItem("dam_token");
      if (tok) headers.Authorization = "Bearer " + tok;
    } catch (eTok) {
      /* ignore */
    }
    return headers;
  }

  function brandingAssetLooksLikeTuba(a) {
    var blob = String((a && (a.path || a.name)) || "").replace(/\\/g, "/");
    return /TUBA---PREZENT/i.test(blob);
  }

  function mergeBrandingMtime(target, fat) {
    if (!target || !fat) return;
    var ms = Number(fat.mtime_ms);
    if (ms && isFinite(ms)) target.mtime_ms = ms;
    if (fat.mtime) target.mtime = fat.mtime;
    if (!target.path && fat.path) target.path = fat.path;
    if (!target.name && fat.name) target.name = fat.name;
  }

  /**
   * Slim grid-head has no mtime_ms (sorted by role+id). Pull numeric file
   * mtime from /branding/asset so dashboard newest is real file date.
   */
  function enrichBrandingMtimes(data) {
    if (!data || !Array.isArray(data.assets) || !data.assets.length) {
      return Promise.resolve(data);
    }
    if (data.__damMtimesEnriched) return Promise.resolve(data);
    var byId = Object.create(null);
    var need = [];
    var i;
    var a;
    var PRIORITY_ROLES = {
      web_hero_slider: 1,
      key_visual: 1,
      campaign: 1,
      web_banner: 1,
      www: 1,
      web_bundle_tile: 1,
      ecommerce_ad: 1,
      social_asset: 1,
      social: 1
    };
    for (i = 0; i < data.assets.length; i++) {
      a = data.assets[i];
      if (!a || !a.id) continue;
      byId[String(a.id)] = a;
      if (!isBrandingWidgetThumb(a)) continue;
      if (brandingAssetMtimeMs(a)) continue;
      need.push(String(a.id));
    }
    if (need.length > 720) {
      var tubaIds = [];
      var roleIds = [];
      var restIds = [];
      need.forEach(function (id) {
        var row = byId[id];
        if (brandingAssetLooksLikeTuba(row)) tubaIds.push(id);
        else if (PRIORITY_ROLES[String((row && row.asset_role) || "").toLowerCase()]) {
          roleIds.push(id);
        } else restIds.push(id);
      });
      need = tubaIds.concat(roleIds, restIds).slice(0, 720);
    }
    if (!need.length) {
      data.__damMtimesEnriched = true;
      return Promise.resolve(data);
    }
    var base = brandingBridgeBase().replace(/\/$/, "");
    var CHUNK = 40;
    var chunks = [];
    for (i = 0; i < need.length; i += CHUNK) {
      chunks.push(need.slice(i, i + CHUNK));
    }
    function fetchChunk(ids) {
      var url = base + "/branding/asset?ids=" + encodeURIComponent(ids.join(","));
      return fetch(url, { cache: "no-store", headers: damBridgeAuthHeaders() })
        .then(function (r) {
          if (!r.ok) throw new Error("http-" + r.status);
          return r.json();
        })
        .then(function (j) {
          var list = (j && j.assets) || [];
          if (j && j.asset) list = list.concat([j.asset]);
          return list;
        })
        .catch(function () {
          return [];
        });
    }
    var PARALLEL = 3;
    function runAt(offset) {
      if (offset >= chunks.length) return Promise.resolve();
      var slice = chunks.slice(offset, offset + PARALLEL);
      return Promise.all(slice.map(fetchChunk)).then(function (rows) {
        rows.forEach(function (list) {
          (list || []).forEach(function (fat) {
            if (!fat || !fat.id) return;
            mergeBrandingMtime(byId[String(fat.id)], fat);
          });
        });
        return runAt(offset + PARALLEL);
      });
    }
    return runAt(0).then(function () {
      data.__damMtimesEnriched = true;
      return data;
    });
  }

  function ensureTubaBrandingAsset(data) {
    if (!data || !Array.isArray(data.assets)) return Promise.resolve(data);
    var has = data.assets.some(brandingAssetLooksLikeTuba);
    if (has) return Promise.resolve(data);
    var cb = encodeURIComponent(String(global.DAM_APP_VERSION || "1"));
    var base = brandingBridgeBase().replace(/\/$/, "");
    var gridUrls = [
      "data/branding-grid-index.json?v=" + cb,
      base + "/branding-grid-index?v=" + cb
    ];
    function findInGrid(i) {
      if (i >= gridUrls.length) return Promise.resolve(null);
      return fetchJsonOk(gridUrls[i])
        .then(function (grid) {
          var list = (grid && grid.assets) || [];
          var hit = null;
          var gi;
          for (gi = 0; gi < list.length; gi++) {
            if (brandingAssetLooksLikeTuba(list[gi])) {
              hit = list[gi];
              break;
            }
          }
          if (hit) return hit;
          return findInGrid(i + 1);
        })
        .catch(function () {
          return findInGrid(i + 1);
        });
    }
    return findInGrid(0).then(function (slim) {
      if (!slim || !slim.id) return data;
      var url = base + "/branding/asset?id=" + encodeURIComponent(slim.id);
      return fetch(url, { cache: "no-store", headers: damBridgeAuthHeaders() })
        .then(function (r) {
          if (!r.ok) throw new Error("http-" + r.status);
          return r.json();
        })
        .then(function (j) {
          var fat = (j && j.asset) || slim;
          mergeBrandingMtime(slim, fat);
          if (!isBrandingWidgetThumb(fat) && !isBrandingWidgetThumb(slim)) {
            return data;
          }
          data.assets = [fat.path ? fat : slim].concat(data.assets);
          return data;
        })
        .catch(function () {
          data.assets = [slim].concat(data.assets);
          return data;
        });
    });
  }

  function enrichTubaFirst(data) {
    if (!data || !Array.isArray(data.assets)) return Promise.resolve(data);
    var hit = null;
    var i;
    for (i = 0; i < data.assets.length; i++) {
      if (brandingAssetLooksLikeTuba(data.assets[i])) {
        hit = data.assets[i];
        break;
      }
    }
    if (!hit) return Promise.resolve(data);
    if (brandingAssetMtimeMs(hit)) {
      data.__damTubaReady = true;
      return Promise.resolve(data);
    }
    var base = brandingBridgeBase().replace(/\/$/, "");
    var url = base + "/branding/asset?id=" + encodeURIComponent(hit.id || "");
    return fetch(url, { cache: "no-store", headers: damBridgeAuthHeaders() })
      .then(function (r) {
        if (!r.ok) throw new Error("http-" + r.status);
        return r.json();
      })
      .then(function (j) {
        mergeBrandingMtime(hit, (j && j.asset) || {});
        data.__damTubaReady = true;
        return data;
      })
      .catch(function () {
        data.__damTubaReady = true;
        return data;
      });
  }

  function loadBrandingIndex() {
    if (
      global.__damBrandingIndex &&
      global.__damBrandingIndex.assets &&
      (global.__damBrandingIndex.__damMtimesEnriched || global.__damBrandingIndex.__damTubaReady)
    ) {
      return Promise.resolve(global.__damBrandingIndex);
    }
    if (
      global.__damBrandingGridIndex &&
      global.__damBrandingGridIndex.assets &&
      (global.__damBrandingGridIndex.__damMtimesEnriched || global.__damBrandingGridIndex.__damTubaReady)
    ) {
      return Promise.resolve(global.__damBrandingGridIndex);
    }
    if (global.__damBrandingIndexPromise) return global.__damBrandingIndexPromise;
    var cached =
      (global.__damBrandingIndex && global.__damBrandingIndex.assets && global.__damBrandingIndex) ||
      (global.__damBrandingGridIndex && global.__damBrandingGridIndex.assets && global.__damBrandingGridIndex) ||
      null;
    var cb = encodeURIComponent(String(global.DAM_APP_VERSION || "1"));
    var base = brandingBridgeBase().replace(/\/$/, "");
    var urls = [
      { href: "data/branding-grid-head.json?v=" + cb, partial: true },
      { href: base + "/branding-grid-head?v=" + cb, partial: true },
      { href: "data/branding-grid-index.json?v=" + cb, partial: false },
      { href: base + "/branding-grid-index?v=" + cb, partial: false }
    ];
    function tryNext(i) {
      if (i >= urls.length) {
        return Promise.reject(new Error("branding-index-unavailable"));
      }
      return fetchJsonOk(urls[i].href)
        .then(function (data) {
          return adoptBrandingSlice(data, urls[i].partial);
        })
        .catch(function () {
          return tryNext(i + 1);
        });
    }
    var start = cached ? Promise.resolve(cached) : tryNext(0);
    global.__damBrandingIndexPromise = start
      .then(function (data) {
        return ensureTubaBrandingAsset(data);
      })
      .then(function (data) {
        return enrichTubaFirst(data);
      })
      .then(function (data) {
        enrichBrandingMtimes(data).catch(function () {
          /* background */
        });
        global.__damBrandingIndexPromise = null;
        try {
          global.__damBrandingGridIndex = data;
        } catch (eShare) {
          /* ignore */
        }
        try {
          global.__damBrandingIndex = data;
        } catch (eIdx) {
          /* ignore */
        }
        return data;
      })
      .catch(function (err) {
        global.__damBrandingIndexPromise = null;
        throw err;
      });
    return global.__damBrandingIndexPromise;
  }

  function yieldTick() {
    return new Promise(function (resolve) {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(function () {
          setTimeout(resolve, 0);
        });
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  function groupBrandingAssets(assets, maxGroups, oversample) {
    var byDir = {};
    (assets || []).forEach(function (a) {
      var key = dirnamePath(a.path || a.folder_group_id || a.id).toLowerCase();
      if (!byDir[key]) byDir[key] = [];
      byDir[key].push(a);
    });
    var groups = Object.keys(byDir).map(function (k) {
      var arr = byDir[k].slice().sort(compareNewestDesc);
      var newest = arr[0];
      var cover = pickBrandingCover(arr) || newest;
      var hasSafeCover =
        !!cover &&
        (isRasterPreviewPath(cover.name || cover.path || "") ||
          /\.svg$/i.test(String(cover.name || cover.path || "")));
      var groupNewest = cover || newest;
      return {
        key: k,
        label: folderLabel((cover && cover.path) || (newest && newest.path) || "", cover || newest),
        count: arr.length,
        newest: groupNewest,
        hasSafeCover: hasSafeCover,
        path: (cover && cover.path) || (newest && newest.path) || "",
        mtime: (newest && newest.mtime) || (cover && cover.mtime) || "",
        mtime_ms: brandingAssetMtimeMs(newest) || brandingAssetMtimeMs(cover)
      };
    });
    /* Prefer groups with a browser-safe cover, then newest mtime. */
    groups.sort(function (a, b) {
      if (!!a.hasSafeCover !== !!b.hasSafeCover) return a.hasSafeCover ? -1 : 1;
      return compareNewestDesc(a, b);
    });
    var limit = Math.max(maxGroups || 4, oversample || maxGroups || 4);
    return groups.slice(0, limit);
  }

  function treatAsReadableThumb(avail) {
    if (!avail) return false;
    if (avail.treat_as_local === true) return true;
    var st = String(avail.state || "").toLowerCase();
    return st === "local" || st === "sync_pending";
  }

  /**
   * Pick up to maxGroups rows: prefer files that exist on disk (readable thumb).
   * Missing covers fall back only if we cannot fill the grid with live assets.
   */
  function pickBrandingLatestGroups(assets, maxGroups) {
    var n = maxGroups || 4;
    var candidates = groupBrandingAssets(assets, n, Math.max(n * 4, 16));
    if (!candidates.length) return Promise.resolve([]);
    var probe =
      global.DamPreviewTruth && typeof DamPreviewTruth.fileAvailability === "function"
        ? DamPreviewTruth.fileAvailability
        : null;
    if (!probe) {
      return Promise.resolve(
        candidates
          .filter(function (g) {
            return g.hasSafeCover;
          })
          .concat(
            candidates.filter(function (g) {
              return !g.hasSafeCover;
            })
          )
          .slice(0, n)
      );
    }
    return Promise.all(
      candidates.map(function (g) {
        if (!g.hasSafeCover || !g.path) {
          return Promise.resolve({ g: g, ok: false });
        }
        return probe(g.path).then(function (avail) {
          return { g: g, ok: treatAsReadableThumb(avail) };
        });
      })
    ).then(function (rows) {
      var live = [];
      var fallback = [];
      rows.forEach(function (row) {
        if (row.ok) live.push(row.g);
        else fallback.push(row.g);
      });
      return live.concat(fallback).slice(0, n);
    });
  }

  function mediaListClass(_layout) {
    return (
      "dam-widget__list dam-widget__list--media dam-widget__list--bento dam-widget__list--grid-2x2"
    );
  }

  /**
   * Per-object skeleton: same geometry as real .dam-widget__viz-row
   * (icon stack + thumb + title/badge lines). Neutral gray only.
   */
  function mediaWidgetSkeletonHtml(layout, count, extraListClass) {
    var n = Math.max(1, count || layoutCardCount(layout) || 4);
    var rows = "";
    var i;
    for (i = 0; i < n; i++) {
      rows +=
        '<li class="dam-widget__viz-row dam-widget-skel__row" aria-hidden="true">' +
        '<div class="dam-nav-circles dam-nav-circles--stack dam-nav-circles--tiles">' +
        '<span class="dam-widget-skel__icon"></span>' +
        '<span class="dam-widget-skel__icon"></span>' +
        '<span class="dam-widget-skel__icon"></span>' +
        "</div>" +
        '<div class="dam-widget__viz-media">' +
        '<span class="dam-widget-skel__thumb"></span>' +
        '<div class="dam-widget__viz-body">' +
        '<span class="dam-widget-skel__line"></span>' +
        '<span class="dam-widget-skel__line dam-widget-skel__line--short"></span>' +
        "</div></div></li>";
    }
    return (
      '<ul class="' +
      mediaListClass(layout) +
      (extraListClass ? " " + extraListClass : "") +
      ' dam-widget-skel" aria-busy="true">' +
      rows +
      "</ul>"
    );
  }

  /** Map path -> branding tab so ?q= lands on a tab that has results. */
  function brandingTabFromPath(path) {
    var p = String(path || "").toUpperCase();
    if (/08\s*-\s*KAMAPANIE/i.test(p)) return "campaigns";
    if (/05\s*-\s*SOCIAL/i.test(p)) return "social";
    if (/06\s*-\s*STRONY|07\s*-\s*E-COMMERCE|\/SLIDERY\//i.test(p)) return "www";
    if (/BRANDING|BRANDBOOK|BRAND\s*BOOK/i.test(p)) return "brandbook";
    if (/WIZKI|01\s*-\s*PRODUKTY/i.test(p)) return "packshots";
    return "";
  }

  function brandingHrefForAsset(a, label) {
    var q = encodeURIComponent(label || (a && a.name) || "");
    var tab = brandingTabFromPath((a && a.path) || "");
    var href = "branding.html?q=" + q;
    if (tab) href += "&tab=" + encodeURIComponent(tab);
    if (a && a.id) href += "&asset=" + encodeURIComponent(a.id);
    return href;
  }

  function ensureDashWinDelegation(mount) {
    if (!mount || mount._damWinDelegated) return;
    mount._damWinDelegated = true;
    mount.addEventListener(
      "click",
      function (e) {
        var btn = e.target && e.target.closest ? e.target.closest(".dam-win-btn") : null;
        if (!btn || !mount.contains(btn) || btn.disabled) return;
        e.preventDefault();
        e.stopPropagation();
        var raw = btn.getAttribute("data-path") || "";
        if (!raw) return;
        var path =
          global.DamPaths && typeof DamPaths.resolveWinFolderPath === "function"
            ? DamPaths.resolveWinFolderPath(raw)
            : raw;
        if (global.DamPaths && typeof DamPaths.openFolderInExplorer === "function") {
          DamPaths.openFolderInExplorer(path);
        }
      },
      true
    );
  }

  function bindDashIndexAnchors(host) {
    if (!host) return;
    if (global.DamCardIndexPopover && typeof DamCardIndexPopover.bind === "function") {
      DamCardIndexPopover.bind(host);
      return;
    }
    host.querySelectorAll(".dam-viz-card__show-indexes").forEach(function (btn) {
      if (btn._damDashIdxBound) return;
      btn._damDashIdxBound = true;
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var anchor = btn.closest(".dam-viz-card__indexes-anchor");
        var wrap =
          (anchor && anchor.querySelector(".dam-viz-card__indexes-wrap")) ||
          (btn.parentNode && btn.parentNode.querySelector(".dam-viz-card__indexes-wrap"));
        if (!wrap) return;
        var open = !(anchor && anchor.classList.contains("is-expanded"));
        if (anchor) {
          if (open) anchor.classList.add("is-expanded");
          else anchor.classList.remove("is-expanded");
        }
        if (open) wrap.removeAttribute("hidden");
        else wrap.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  function rebindWidgetChrome(host) {
    if (!host) return;
    if (global.DamIcons && typeof DamIcons.bindWinButtons === "function") {
      DamIcons.bindWinButtons(host);
    }
    if (global.DamBadges && typeof DamBadges.bindClicks === "function") {
      DamBadges.bindClicks(host, "dashboard");
    }
    bindDashIndexAnchors(host);
    if (host.classList && host.classList.contains("dam-widget--media-latest")) {
      scheduleSyncMediaTileHeights();
    }
  }

  var LAYOUT_MORPH_MS = 400;
  var LAYOUT_MORPH_EASE = "ease-in-out";

  function prefersLayoutReducedMotion() {
    try {
      return (
        global.matchMedia &&
        global.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (e) {
      return false;
    }
  }

  function requestDashBentoRemount() {
    /* During layout morph, remount is deferred so FLIP translate can play. */
    if (global.__damDashLayoutMorphing) return;
    var grid = document.getElementById("damDashGrid");
    if (grid && typeof grid._damBentoRemount === "function") {
      setTimeout(grid._damBentoRemount, 0);
    }
  }

  function afterMediaHostReplace(host) {
    if (host) {
      var id = host.getAttribute("data-widget-id");
      if (id) host.setAttribute("data-bento-id", id);
    }
    requestDashBentoRemount();
    scheduleSyncMediaTileHeights();
  }

  var MEDIA_TILE_WIDGETS = {
    newest_viz_3: true,
    newest_products_f: true,
    branding_latest: true
  };

  function captureWidgetOrigins(root) {
    var map = {};
    if (!root) return map;
    root.querySelectorAll(".dam-widget[data-widget-id]").forEach(function (el) {
      var id = el.getAttribute("data-widget-id");
      if (!id) return;
      var r = el.getBoundingClientRect();
      map[id] = { x: r.left, y: r.top };
    });
    return map;
  }

  function captureListItemOrigins(host) {
    var list = host && host.querySelector(".dam-widget__list");
    if (!list) return [];
    return Array.prototype.map.call(list.children, function (li, i) {
      var r = li.getBoundingClientRect();
      var keyBtn = li.querySelector("[data-path]");
      return {
        i: i,
        key: (keyBtn && keyBtn.getAttribute("data-path")) || "i:" + i,
        x: r.left,
        y: r.top
      };
    });
  }

  function playTranslateFlip(el, dx, dy, ms) {
    if (!el) return;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    el.style.transition = "none";
    el.style.transform = "translate(" + dx + "px, " + dy + "px)";
    void el.offsetWidth;
    el.style.transition =
      "transform " + (ms || LAYOUT_MORPH_MS) + "ms " + LAYOUT_MORPH_EASE;
    el.style.transform = "translate(0, 0)";
  }

  function clearTranslateFlip(el) {
    if (!el) return;
    el.style.transition = "";
    el.style.transform = "";
  }

  /**
   * Layout cycle 2x2 / 1x4 / 1x6: FLIP translate 0.4s ease-in-out on rows
   * and sibling media cards (pack shift), instead of hard remount jump.
   */
  function runMediaLayoutMorph(widgetId, applyFn, doneFn) {
    var grid = document.getElementById("damDashGrid");
    var host0 = document.querySelector('[data-widget-id="' + widgetId + '"]');
    if (!host0 || typeof applyFn !== "function") {
      if (typeof applyFn === "function") applyFn();
      if (typeof doneFn === "function") doneFn();
      return;
    }
    if (prefersLayoutReducedMotion()) {
      applyFn();
      requestDashBentoRemount();
      scheduleSyncMediaTileHeights();
      if (typeof doneFn === "function") doneFn();
      return;
    }

    global.__damDashLayoutMorphing = true;
    host0.classList.add("is-layout-morphing");
    var itemFirst = captureListItemOrigins(host0);
    var widgetFirst = captureWidgetOrigins(grid);

    applyFn();

    var host = document.querySelector('[data-widget-id="' + widgetId + '"]');
    if (host) host.classList.add("is-layout-morphing");

    /* Sync pack now (remount suppressed) so Last positions are final. */
    try {
      syncMediaTileBentoHeights(grid || document.getElementById("damDashGrid"));
    } catch (eSync) {
      /* ignore */
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var host2 = document.querySelector('[data-widget-id="' + widgetId + '"]');
        var list2 = host2 && host2.querySelector(".dam-widget__list");
        var byKey = {};
        itemFirst.forEach(function (f) {
          byKey[f.key] = f;
        });

        if (list2) {
          Array.prototype.forEach.call(list2.children, function (li, i) {
            var keyBtn = li.querySelector("[data-path]");
            var key = (keyBtn && keyBtn.getAttribute("data-path")) || "i:" + i;
            var f = byKey[key] || itemFirst[i];
            var r = li.getBoundingClientRect();
            if (!f) {
              /* New rows (e.g. 2x2 -> 1x6): enter with short translateY. */
              playTranslateFlip(li, 0, 16, LAYOUT_MORPH_MS);
              return;
            }
            playTranslateFlip(li, f.x - r.left, f.y - r.top, LAYOUT_MORPH_MS);
          });
        }

        var grid2 = document.getElementById("damDashGrid");
        if (grid2) {
          Object.keys(widgetFirst).forEach(function (id) {
            var el = grid2.querySelector('[data-widget-id="' + id + '"]');
            if (!el) return;
            var r = el.getBoundingClientRect();
            var f = widgetFirst[id];
            playTranslateFlip(el, f.x - r.left, f.y - r.top, LAYOUT_MORPH_MS);
          });
        }

        setTimeout(function () {
          if (list2) {
            Array.prototype.forEach.call(list2.children, clearTranslateFlip);
          }
          if (grid2) {
            Object.keys(widgetFirst).forEach(function (id) {
              clearTranslateFlip(
                grid2.querySelector('[data-widget-id="' + id + '"]')
              );
            });
          }
          if (host2) host2.classList.remove("is-layout-morphing");
          global.__damDashLayoutMorphing = false;
          /* Remount after morph so mins/handles match new layout without jump. */
          var g = document.getElementById("damDashGrid");
          if (g && typeof g._damBentoRemount === "function") {
            g._damBentoRemount();
          }
          scheduleSyncMediaTileHeights();
          if (typeof doneFn === "function") doneFn();
        }, LAYOUT_MORPH_MS + 40);
      });
    });
  }

  function bindLayoutToggle(widgetId, onCycle) {
    var btn = document.querySelector(
      '[data-widget-layout-toggle="' + widgetId + '"]'
    );
    if (!btn || btn._damLayoutBound) return;
    btn._damLayoutBound = true;
    var applyNext = function (next) {
      next = migrateTileCountValue(next);
      setTileLayout(widgetId, next);
      if (!MEDIA_TILE_WIDGETS[widgetId]) {
        if (typeof onCycle === "function") onCycle(next);
        return;
      }
      btn._damLayoutBusy = true;
      runMediaLayoutMorph(
        widgetId,
        function () {
          if (typeof onCycle === "function") onCycle(next);
        },
        function () {
          btn._damLayoutBusy = false;
          var live = document.querySelector(
            '[data-widget-layout-toggle="' + widgetId + '"]'
          );
          if (live) live._damLayoutBusy = false;
        }
      );
    };
    btn.addEventListener("change", function (ev) {
      ev.preventDefault();
      if (btn._damLayoutBusy || global.__damDashLayoutMorphing) return;
      applyNext(btn.value);
    });
    btn.addEventListener("click", function (ev) {
      if (btn.tagName === "SELECT") return;
      ev.preventDefault();
      if (btn._damLayoutBusy || global.__damDashLayoutMorphing) return;
      var cur = layoutCardCount(getTileLayout(widgetId));
      var idx = TILE_COUNTS.indexOf(cur);
      var next = TILE_COUNTS[(idx + 1) % TILE_COUNTS.length];
      applyNext(next);
    });
  }

  function statBody(value, meta) {
    return (
      '<p class="dam-widget__value">' +
      escapeHtml(String(value)) +
      "</p>" +
      (meta
        ? '<span class="dam-widget__meta">' + escapeHtml(meta) + "</span>"
        : "")
    );
  }

  function openTasks(ctx) {
    return ((ctx.asana && ctx.asana.tasks) || []).filter(function (task) {
      return task.status === "open";
    });
  }

  function asanaStartOfDay(d) {
    var x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function asanaParseDue(due) {
    if (!due) return null;
    var raw = String(due);
    var d = new Date(raw.length === 10 ? raw + "T12:00:00" : raw);
    return isNaN(d.getTime()) ? null : d;
  }

  function asanaLooksLikeProject(s) {
    return /\(DK\)|\|\s*C\/\d+/i.test(String(s || ""));
  }

  function asanaShortPill(s) {
    var t0 = String(s || "").trim();
    if (t0.length > 48) return t0.slice(0, 46) + "\u2026";
    return t0;
  }

  function asanaFormatDueLabel(due) {
    var d = asanaParseDue(due);
    if (!d) return "";
    var today = asanaStartOfDay(new Date());
    var target = asanaStartOfDay(d);
    var diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return "Dzisiaj";
    if (diff === 1) return "Jutro";
    if (diff === -1) return "Wczoraj";
    var days = [
      "Niedziela",
      "Poniedzia\u0142ek",
      "Wtorek",
      "\u015aroda",
      "Czwartek",
      "Pi\u0105tek",
      "Sobota"
    ];
    if (diff > 1 && diff < 7) return days[target.getDay()];
    return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  }

  function loadAsanaLocalDoneSet() {
    try {
      var raw = JSON.parse(
        localStorage.getItem("dam_asana_local_done_v1") || "[]"
      );
      var set = {};
      (Array.isArray(raw) ? raw : []).forEach(function (id) {
        set[String(id)] = true;
      });
      return set;
    } catch (e) {
      return {};
    }
  }

  function enrichAsanaTasks(tasks) {
    var byName = {};
    var localDone = loadAsanaLocalDoneSet();
    (tasks || []).forEach(function (task) {
      if (task && task.name) byName[String(task.name)] = task;
    });
    return (tasks || []).map(function (task) {
      var project = String(task.project || "").trim();
      var walkParent = String(task.parent || "").trim();
      var hops = 0;
      while (!project && walkParent && hops < 6) {
        if (asanaLooksLikeProject(walkParent)) {
          project = walkParent;
          break;
        }
        var parentTask = byName[walkParent];
        if (!parentTask) break;
        project = String(parentTask.project || "").trim();
        walkParent = String(parentTask.parent || "").trim();
        hops += 1;
      }
      if (!project && task.parent) {
        project = String(task.parent).trim();
      }
      var dueDate = asanaParseDue(task.due);
      var today = asanaStartOfDay(new Date());
      var tid = String(task.id || task.gid || "");
      var isDone =
        task.status === "done" ||
        task.status === "completed" ||
        (!!tid && !!localDone[tid]);
      var isOverdue =
        !isDone && dueDate && asanaStartOfDay(dueDate).getTime() < today.getTime();
      var dueLabel = asanaFormatDueLabel(task.due);
      var parent = String(task.parent || "").trim();
      var parentCtx = "";
      if (
        parent &&
        parent !== project &&
        normDashText(parent) !== normDashText(project)
      ) {
        parentCtx = asanaShortPill(parent);
      }
      return {
        id: task.id || task.gid || "",
        name: task.name || "",
        parent: task.parent || "",
        project: task.project || "",
        section: task.section || "",
        assignee: task.assignee || "",
        due: task.due || "",
        status: task.status || "open",
        displayTitle: task.name || "Zadanie",
        parentCtx: parentCtx,
        projectPill: asanaShortPill(project),
        dueLabel: dueLabel,
        isOverdue: !!isOverdue,
        isDone: !!isDone,
        isToday: dueLabel === "Dzisiaj"
      };
    });
  }

  function filterAsanaHomeTab(enriched, tab) {
    var list = enriched || [];
    if (tab === "done") {
      return list.filter(function (t) {
        return t.isDone;
      });
    }
    if (tab === "overdue") {
      return list
        .filter(function (t) {
          return !t.isDone && t.isOverdue;
        })
        .sort(function (a, b) {
          return String(a.due || "").localeCompare(String(b.due || ""));
        });
    }
    return list
      .filter(function (t) {
        return !t.isDone && !t.isOverdue;
      })
      .sort(function (a, b) {
        return String(a.due || "9999-99-99").localeCompare(
          String(b.due || "9999-99-99")
        );
      });
  }

  function asanaHomeTaskRowsHtml(rows) {
    if (!rows.length) {
      return (
        '<li class="dam-asana-home__empty">' +
        escapeHtml(
          t("dash.widget.asana_home_empty", "Brak zada\u0144 w tej zak\u0142adce")
        ) +
        "</li>"
      );
    }
    return rows
      .slice(0, 12)
      .map(function (task) {
        var dueCls =
          "dam-asana-home__due" +
          (task.isOverdue
            ? " is-overdue"
            : task.isToday
              ? " is-today"
              : "");
        var href = task.id
          ? "https://app.asana.com/0/0/" + encodeURIComponent(task.id)
          : "inbox.html?tag=asana";
        return (
          '<li class="dam-asana-home__row">' +
          '<span class="dam-asana-home__check" aria-hidden="true"></span>' +
          '<a class="dam-asana-home__main" href="' +
          escapeHtml(href) +
          '" target="_blank" rel="noopener noreferrer">' +
          '<span class="dam-asana-home__title">' +
          escapeHtml(task.displayTitle) +
          "</span>" +
          (task.parentCtx
            ? '<span class="dam-asana-home__parent" title="' +
              escapeHtml(task.parentCtx) +
              '">' +
              escapeHtml(task.parentCtx) +
              "</span>"
            : "") +
          (task.projectPill
            ? '<span class="dam-asana-home__pill" title="' +
              escapeHtml(task.projectPill) +
              '">' +
              escapeHtml(task.projectPill) +
              "</span>"
            : "") +
          "</a>" +
          '<span class="' +
          dueCls +
          '">' +
          escapeHtml(task.dueLabel || "\u2014") +
          "</span></li>"
        );
      })
      .join("");
  }

  function asanaHomeProjectsHtml(enriched) {
    var map = {};
    enriched.forEach(function (t) {
      if (t.isDone || !t.projectPill) return;
      var key = t.projectPill;
      if (!map[key]) map[key] = 0;
      map[key] += 1;
    });
    var rows = Object.keys(map)
      .map(function (k) {
        return { name: k, n: map[k] };
      })
      .sort(function (a, b) {
        return b.n - a.n;
      })
      .slice(0, 6);
    if (!rows.length) {
      return '<p class="dam-widget__meta">Brak projektow w eksporcie</p>';
    }
    return (
      '<ul class="dam-asana-home__mini">' +
      rows
        .map(function (r) {
          return (
            "<li><span title=\"" +
            escapeHtml(r.name) +
            '">' +
            escapeHtml(r.name) +
            "</span><strong>" +
            r.n +
            "</strong></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function asanaHomePeopleHtml(enriched) {
    var map = {};
    enriched.forEach(function (t) {
      if (t.isDone) return;
      var a = t.assignee || "Nieprzypisane";
      map[a] = (map[a] || 0) + 1;
    });
    var rows = Object.keys(map)
      .map(function (k) {
        return { name: k, n: map[k] };
      })
      .sort(function (a, b) {
        return b.n - a.n;
      })
      .slice(0, 5);
    if (!rows.length) {
      return '<p class="dam-widget__meta">Brak os\u00f3b</p>';
    }
    return (
      '<ul class="dam-asana-home__mini">' +
      rows
        .map(function (r) {
          var short =
            r.name === "Nieprzypisane"
              ? "Nieprzypisane"
              : r.name.split(" ").slice(0, 2).join(" ") || r.name;
          return (
            "<li><span title=\"" +
            escapeHtml(r.name) +
            '">' +
            escapeHtml(short) +
            "</span><strong>" +
            r.n +
            "</strong></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function bindAsanaHomeWidget(host, enriched) {
    if (!host || host._damAsanaHomeBound) return;
    host._damAsanaHomeBound = true;
    host._damAsanaEnriched = enriched;
    host.addEventListener("click", function (ev) {
      var tab = ev.target && ev.target.closest
        ? ev.target.closest("[data-asana-tab]")
        : null;
      if (!tab || !host.contains(tab)) return;
      ev.preventDefault();
      var key = tab.getAttribute("data-asana-tab") || "upcoming";
      host.querySelectorAll("[data-asana-tab]").forEach(function (btn) {
        var on = btn === tab;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      var list = host.querySelector("[data-asana-task-list]");
      if (list) {
        list.innerHTML = asanaHomeTaskRowsHtml(
          filterAsanaHomeTab(host._damAsanaEnriched || [], key)
        );
      }
    });
  }

  function monthPrefix() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    if (m.length < 2) m = "0" + m;
    return d.getFullYear() + "-" + m;
  }

  function normDashText(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/ą/g, "a")
      .replace(/ć/g, "c")
      .replace(/ę/g, "e")
      .replace(/ł/g, "l")
      .replace(/ń/g, "n")
      .replace(/ó/g, "o")
      .replace(/ś/g, "s")
      .replace(/ź|ż/g, "z")
      .replace(/[`'’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function parseRevisionDate(folder, fallback) {
    var s = String(folder || "");
    var m = s.match(/(\d{2})[.\s](\d{2})[.\s](\d{4})/);
    if (m) return m[3] + "-" + m[2] + "-" + m[1];
    return fallback || "";
  }

  function letterFromFolderName(pathOrName) {
    var nm = String(pathOrName || "").split(/[/\\]/).pop() || "";
    var m = nm.match(/\s-\s([FXD])$/i);
    return m ? m[1].toUpperCase() : "";
  }

  function revisionIsFinal(rev) {
    if (!rev) return false;
    var diskLit = letterFromFolderName(rev.path || "");
    if (!diskLit && !rev.path && rev.folder) {
      diskLit = letterFromFolderName(rev.folder);
    }
    return diskLit === "F";
  }

  function revisionEligibleForNewest(rev) {
    if (!rev) return false;
    if (revisionIsFinal(rev)) return true;
    var lit =
      letterFromFolderName(rev.path || "") || letterFromFolderName(rev.folder || "");
    if (lit === "X" || lit === "D") return false;
    var path = String(rev.path || "") + " " + String(rev.folder || "");
    if (/archiwum/i.test(path)) return false;
    return rev.is_latest === true;
  }

  function revisionHasFinalOrFq(rev) {
    if (!rev) return false;
    if (letterFromFolderName(rev.path || "") === "F") return true;
    if (letterFromFolderName(rev.folder || "") === "F") return true;
    var blob = String(rev.folder || "") + " " + String(rev.path || "");
    var fbr = rev.files_by_role || {};
    Object.keys(fbr).forEach(function (k) {
      (fbr[k] || []).forEach(function (f) {
        if (typeof f === "string") blob += " " + f;
        else blob += " " + String((f && (f.name || f.path || f.file)) || "");
      });
    });
    (rev.wizki || []).forEach(function (w) {
      blob += " " + String((w && (w.name || w.path || w.file)) || "");
    });
    if (/\bFQ(?:[-_.]|\b)/i.test(blob)) return true;
    if (/\s-\sF(?:\s|$|[\\/])/i.test(blob)) return true;
    return false;
  }

  function countProjectsInProgress(ctx) {
    var products = (ctx.fileIndex && ctx.fileIndex.products) || [];
    var n = 0;
    products.forEach(function (prod) {
      var pid = prod.id || "";
      var name = prod.display_name || prod.name || pid;
      if (/test-lifecycle/i.test(pid) || /^test\b/i.test(name)) return;
      if (!((prod.revisions || []).some(revisionHasFinalOrFq))) n += 1;
    });
    return n;
  }

  function flattenProductTags(prod) {
    var tags = prod && prod.tags;
    if (!tags || typeof tags !== "object") return [];
    var out = [];
    Object.keys(tags).forEach(function (k) {
      var arr = tags[k];
      if (!Array.isArray(arr)) return;
      arr.forEach(function (x) {
        if (x && out.indexOf(x) === -1) out.push(x);
      });
    });
    return out;
  }

  function buildVizThumbByIndex(ctx) {
    var map = {};
    function put(key, v) {
      if (!key) return;
      if (!map[key] || recordMtimeMs(v) > recordMtimeMs(map[key])) {
        map[key] = v;
      }
    }
    ((ctx.fileIndex && ctx.fileIndex.viz_latest) || []).forEach(function (v) {
      put(String(v.index || v.product_index || ""), v);
      put(String(v.index_base || ""), v);
    });
    return map;
  }

  function hashSeriesKey(key) {
    var h = 2166136261;
    var s = String(key || "");
    var i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pickStableSeriesRep(variants, seriesKey) {
    var arr = (variants || []).slice().sort(function (a, b) {
      return String(a.index || "").localeCompare(String(b.index || ""));
    });
    if (!arr.length) return null;
    return arr[hashSeriesKey(seriesKey) % arr.length];
  }

  function variantExtraAria(extra) {
    var n = Number(extra) || 0;
    if (n <= 0) return "";
    if (n === 1) return t("dash.widget.variant_extra_1", "+1 wariant");
    if (n <= 4) {
      return t("dash.widget.variant_extra_few", "+" + n + " warianty").replace(
        "{n}",
        String(n)
      );
    }
    return t("dash.widget.variant_extra_many", "+" + n + " wariantów").replace(
      "{n}",
      String(n)
    );
  }

  function productVariantBadgeHtml(displayCount) {
    if (!displayCount || displayCount <= 1) return "";
    var extra = displayCount - 1;
    return (
      '<span class="dam-viz-card__variant-badge" aria-label="' +
      escapeHtml(variantExtraAria(extra)) +
      '">+' +
      extra +
      "</span>"
    );
  }

  function productIndexesBlockHtml(variants) {
    var labels = [];
    var seen = {};
    (variants || []).forEach(function (v) {
      var idx = String((v && (v.index || v.product_index || v.index_base)) || "");
      if (!idx || seen[idx]) return;
      seen[idx] = true;
      labels.push(idx);
    });
    if (labels.length <= 1) return "";
    return (
      '<div class="dam-viz-card__indexes-anchor">' +
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-card__show-indexes" data-dam-tip="' +
      escapeHtml(
        t(
          "dash.widget.show_indexes_tip",
          "Pokaż wszystkie indeksy wariantów (klik = kopiuj)"
        )
      ) +
      '" aria-expanded="false">' +
      '<i class="uil uil-layer-group" aria-hidden="true"></i><span>' +
      escapeHtml(t("dash.widget.show_indexes", "Pokaż indeksy")) +
      "</span></button>" +
      '<div class="dam-viz-card__indexes-wrap dam-index-popover" hidden>' +
      labels
        .map(function (idx) {
          return (
            '<button type="button" class="dam-viz-badge dam-viz-badge--index dam-branding-id-chip" data-copy-id="' +
            escapeHtml(idx) +
            '" data-tag-value="' +
            escapeHtml(idx) +
            '" data-dam-tip="Kliknij, aby skopiować" aria-label="Kopiuj indeks ' +
            escapeHtml(idx) +
            '"><i class="uil uil-copy" aria-hidden="true"></i>' +
            escapeHtml(idx) +
            "</button>"
          );
        })
        .join("") +
      "</div></div>"
    );
  }

  /**
   * Najnowsze produkty Final (F), zgrupowane w serie po znormalizowanej nazwie.
   * Licznik kafelków = liczba serii. Data serii = najnowszy wariant.
   * Reprezentant stały: skrót klucza serii modulo liczba wariantów.
   */
  function pickNewestProductsF(ctx, limit) {
    var products = (ctx.fileIndex && ctx.fileIndex.products) || [];
    var thumbByIndex = buildVizThumbByIndex(ctx);
    var rows = [];
    products.forEach(function (prod) {
      var pid = prod.id || "";
      var name = prod.display_name || prod.name || pid;
      if (/test-lifecycle/i.test(pid) || /^test\b/i.test(name)) return;
      (prod.revisions || []).forEach(function (rev) {
        if (!revisionIsFinal(rev)) return;
        var idx = String(rev.index || rev.index_base || "");
        if (!idx || idx === "pending" || /^noid/i.test(idx) || idx.indexOf("000000") === 0) {
          return;
        }
        var viz = thumbByIndex[idx] || null;
        var thumbPath = resolveVizThumbPath(viz, rev);
        var sortDate =
          rev.date ||
          parseRevisionDate(rev.folder || rev.path || "", "") ||
          (viz && parseRevisionDate(viz.revision_folder, "")) ||
          "";
        var mtimeMs = recordMtimeMs({ date: sortDate, mtime: sortDate });
        rows.push({
          product_id: pid,
          product_name: name,
          category: prod.category || (viz && viz.category) || "",
          brand: prod.brand || (viz && viz.brand) || "",
          carrier: rev.carrier || (viz && viz.carrier) || "",
          carrier_label: viz && viz.carrier_label,
          index: idx,
          index_base: rev.index_base || (viz && viz.index_base) || "",
          revision_folder: rev.folder || (viz && viz.revision_folder) || "",
          path:
            (global.DamPaths && typeof DamPaths.resolveWinFolderPath === "function"
              ? DamPaths.resolveWinFolderPath(rev)
              : rev.path) ||
            rev.path ||
            (viz && viz.revision_path) ||
            "",
          tags: flattenProductTags(prod).length ? flattenProductTags(prod) : viz && viz.tags,
          sortDate: sortDate,
          date: sortDate,
          mtime: sortDate,
          mtime_ms: mtimeMs,
          thumb_path: thumbPath,
          thumb_url: thumbPath ? cardThumbUrl(thumbPath) : "",
          is_mix: prod.is_mix || (viz && viz.is_mix) || false
        });
      });
    });
    rows.sort(compareNewestDesc);
    var byKey = {};
    var keyOrder = [];
    rows.forEach(function (r) {
      var key = normDashText(r.product_name || "");
      if (!key) key = "idx:" + String(r.index || r.product_id || "");
      if (!byKey[key]) {
        byKey[key] = { variants: [], seenIdx: {} };
        keyOrder.push(key);
      }
      var g = byKey[key];
      if (g.seenIdx[r.index]) return;
      g.seenIdx[r.index] = true;
      g.variants.push(r);
    });
    var series = keyOrder.map(function (key) {
      var vars = byKey[key].variants;
      var newestMs = 0;
      vars.forEach(function (v) {
        var ms = recordMtimeMs(v);
        if (ms > newestMs) newestMs = ms;
      });
      var rep = pickStableSeriesRep(vars, key);
      var out = Object.assign({}, rep, {
        series_key: key,
        series_count: vars.length,
        series_variants: vars,
        mtime_ms: newestMs
      });
      if (newestMs) {
        var iso = new Date(newestMs).toISOString().slice(0, 10);
        out.date = iso;
        out.mtime = iso;
        out.sortDate = iso;
      }
      return out;
    });
    series.sort(compareNewestDesc);
    return series.slice(0, limit || 4);
  }

  function buildMediaLatestRowHtml(v, opts) {
    opts = opts || {};
    var linkTarget = opts.linkTarget === "explorer" ? "explorer" : "viz";
    var name = v.product_name || v.product_id || "Produkt";
    var pid = v.product_id || "";
    var thumbPath =
      resolveVizThumbPath(v, null) ||
      normThumbPath(v.thumb_path || "") ||
      (looksLikeThumbFile(v.path) ? normThumbPath(v.path) : "");
    var winPath = v.revision_path || v.path || "";
    if (looksLikeThumbFile(winPath)) winPath = dirnamePath(winPath);
    if (!winPath && thumbPath) winPath = dirnamePath(thumbPath);
    var path = winPath;
    var vizHref = pid
      ? "visualizations.html?product=" + encodeURIComponent(pid)
      : "visualizations.html";
    var explorerHref = pid
      ? "explorer.html?product=" + encodeURIComponent(pid)
      : "explorer.html";
    var primaryHref = linkTarget === "explorer" ? explorerHref : vizHref;
    var primaryTip =
      linkTarget === "explorer"
        ? "Otworz produkt w Eksplorerze"
        : "Otworz wizualizacje produktu";
    var primaryTitle = linkTarget === "explorer" ? "Eksplorer" : "Wizualizacje";
    var thumbSrc = resolveDashboardThumbSrc(v, thumbPath);
    if (!thumbSrc) thumbSrc = brandingThumbPlaceholderDataUri();
    var winIcon =
      global.DamIcons && typeof DamIcons.winExplorerSvg === "function"
        ? DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    var indexVal = v.index || v.product_index || v.index_base || "";
    var seriesCount = Number(v.series_count) || 0;
    var variantBadge = productVariantBadgeHtml(seriesCount);
    var indexesBlock = productIndexesBlockHtml(v.series_variants);
    var badges =
      global.DamBadges && typeof DamBadges.render === "function"
        ? DamBadges.render({
            brand: v.brand || "",
            carrier: v.carrier || "",
            carrierLabel:
              global.DamLabels && typeof DamLabels.carrierLabel === "function"
                ? DamLabels.carrierLabel(v.carrier, v.revision_folder || v.carrier, {
                    isMix: v.is_mix,
                    productName: v.product_name,
                    tags: v.tags
                  })
                : v.carrier_label || v.carrier || "",
            index: indexVal,
            productName: name,
            productId: pid,
            tags: v.tags,
            revisionFolder: v.revision_folder,
            revisionFullPath: path,
            compact: true,
            maxPerKind: 1,
            maxTotal: 4,
            showCarrierPlaceholder: false
          })
        : '<span class="dam-widget__meta">' +
          escapeHtml(
            [indexVal, v.carrier_label || v.carrier || ""].filter(Boolean).join(" / ")
          ) +
          "</span>";
    return (
      '<li class="dam-widget__viz-row" data-series-key="' +
      escapeHtml(v.series_key || "") +
      '" data-rep-index="' +
      escapeHtml(indexVal) +
      '" data-variant-count="' +
      escapeHtml(String(seriesCount || 1)) +
      '">' +
      '<div class="dam-nav-circles dam-nav-circles--stack dam-nav-circles--tiles">' +
      '<a class="dam-viz-icon-btn dam-viz-icon-btn--explorer" href="' +
      escapeHtml(explorerHref) +
      '" title="Przejdz do Eksplorera" aria-label="Przejdz do Eksplorera" data-dam-tip="Otworz produkt w Eksplorerze">' +
      '<i class="uil uil-sitemap" aria-hidden="true"></i></a>' +
      '<button type="button" class="dam-viz-icon-btn dam-win-btn" data-path="' +
      escapeHtml(path) +
      '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera folder w Eksploratorze plikow Windows"' +
      (!path ? " disabled" : "") +
      ">" +
      winIcon +
      "</button>" +
      '<a class="dam-viz-icon-btn dam-viz-icon-btn--viz" href="' +
      escapeHtml(vizHref) +
      '" title="Wizualizacje" aria-label="Wizualizacje" data-dam-tip="Otworz wizualizacje produktu" data-dam-action="open-viz">' +
      '<i class="uil uil-image" aria-hidden="true"></i></a>' +
      "</div>" +
      '<div class="dam-widget__viz-media">' +
      '<a class="dam-widget__thumb-link" href="' +
      escapeHtml(primaryHref) +
      '" title="' +
      escapeHtml(primaryTitle) +
      '" data-dam-tip="' +
      escapeHtml(primaryTip) +
      '">' +
      '<img class="dam-widget__thumb" src="' +
      escapeHtml(thumbSrc) +
      '" data-thumb-path="' +
      escapeHtml(thumbPath || "") +
      '" data-media-path="' +
      escapeHtml(thumbPath || "") +
      '" data-path="' +
      escapeHtml(thumbPath || "") +
      '" alt="' +
      escapeHtml(name) +
      '" loading="lazy" />' +
      variantBadge +
      "</a>" +
      '<div class="dam-widget__viz-body">' +
      '<a href="' +
      escapeHtml(primaryHref) +
      '" title="' +
      escapeHtml(name) +
      '">' +
      escapeHtml(name) +
      "</a>" +
      '<div class="dam-widget__viz-badges">' +
      badges +
      "</div>" +
      indexesBlock +
      "</div></div></li>"
    );
  }

  var VIZ_FLAVOR_RE =
    /(cynamonka|sliwk|tiramisu|banoffee|lemon|cheesecake|malina|porzeczk|cytryn|wanili|szarlot|karmel|arachid|migdal|czekolad|chocolate|oats|cornflake|sezam|daktyl|mango|yuzu|marakuja|piernik|imbirow|jagod|nugget|burger|parow|tuba|shot|chia|pasztet)/g;

  function vizFlavorSet(text) {
    var n = normDashText(text);
    var out = {};
    var m;
    VIZ_FLAVOR_RE.lastIndex = 0;
    while ((m = VIZ_FLAVOR_RE.exec(n))) out[m[1]] = true;
    return out;
  }

  function vizFamily(name, category) {
    var s = normDashText(name) + " " + normDashText(category);
    if (/(kulki|balls|deserowe)/.test(s)) return "kulki";
    if (/(proteina|krem|\bgi\b)/.test(s)) return "krem";
    if (/(pasztet|pate|kielbas|parow|sznycel|burger|plant|roslinn|wedlin|klops|rolad)/.test(s)) {
      return "plant";
    }
    if (/(baton|ciasto|cynamonka|nerkow|cashew|mini)/.test(s)) return "baton";
    if (/tuba/.test(s)) return "tuba";
    if (/(kulki|balls)/.test(normDashText(category))) return "kulki";
    if (/(baton|bars)/.test(normDashText(category))) return "baton";
    if (/przetwor/.test(normDashText(category))) return "krem";
    if (/(roslinn|plant)/.test(normDashText(category))) return "plant";
    return "other";
  }

  function buildAsanaProjectCatalog(ctx) {
    var catalog = [];
    var seen = {};
    function add(name, start) {
      var n = normDashText(name);
      if (!n || seen[n]) return;
      if (/e commerce|marketing|zmiany biezacych/.test(n)) return;
      seen[n] = true;
      catalog.push({
        name: name,
        norm: n,
        start: start || "",
        flavors: vizFlavorSet(n),
        fam: vizFamily(n, ""),
      });
    }
    (((ctx.projectCosts && ctx.projectCosts.projects) || [])).forEach(function (p) {
      add(p.name || p.label || "", p.start || "");
    });
    (((ctx.asana && ctx.asana.tasks) || [])).forEach(function (task) {
      if (task.project) add(task.project, "");
    });
    return catalog;
  }

  function matchAsanaProject(productName, category, catalog) {
    var pn = normDashText(productName);
    var pf = vizFamily(pn, category || "");
    var pflav = vizFlavorSet(pn);
    var best = null;
    var bestScore = -1;
    catalog.forEach(function (c) {
      if (pf !== "other" && c.fam !== "other" && pf !== c.fam) return;
      var shared = 0;
      Object.keys(pflav).forEach(function (f) {
        if (c.flavors[f]) shared += 1;
      });
      if (!shared) return;
      if (shared > bestScore) {
        bestScore = shared;
        best = c;
      }
    });
    return bestScore >= 1 ? best : null;
  }

  function bulkMtimeMinutes(vizRows) {
    var counts = {};
    (vizRows || []).forEach(function (v) {
      var mt = String(v.mtime || "");
      if (mt.length < 16) return;
      var key = mt.slice(0, 16);
      counts[key] = (counts[key] || 0) + 1;
    });
    var bulk = {};
    Object.keys(counts).forEach(function (k) {
      if (counts[k] >= 4) bulk[k] = true;
    });
    return bulk;
  }

  /**
   * Najnowsze wizualizacje: data modyfikacji pliku (bez bulk-sync) + projekt Asana.
   * Oats/Cornflakes z masowym mtime (GC sync) wypadaja; zostaja produkty z projektem.
   */
  function pickNewestViz(ctx, limit) {
    var viz = ((ctx.fileIndex && ctx.fileIndex.viz_latest) || []).slice();
    var byPid = {};
    viz.forEach(function (v) {
      var pid = v.product_id || "";
      if (!pid) return;
      if (!byPid[pid] || recordMtimeMs(v) > recordMtimeMs(byPid[pid])) {
        byPid[pid] = v;
      }
    });
    var bulk = bulkMtimeMinutes(
      Object.keys(byPid).map(function (k) {
        return byPid[k];
      })
    );
    var catalog = buildAsanaProjectCatalog(ctx);
    var rows = [];
    Object.keys(byPid).forEach(function (pid) {
      var v = byPid[pid];
      var name = v.product_name || pid;
      if (/test-lifecycle/i.test(pid) || /^test\b/i.test(name)) return;
      var idx = String(v.index || v.product_index || v.index_base || "");
      if (idx.indexOf("000000") === 0) return;
      if (!idx || idx === "pending" || /^noid/i.test(idx)) return;
      var mt = String(v.mtime || "");
      var mtClean = mt.length >= 16 && bulk[mt.slice(0, 16)] ? "" : mt;
      if (!mtClean) return;
      var asana = matchAsanaProject(name, v.category || "", catalog);
      if (!asana) return;
      var revDate = parseRevisionDate(v.revision_folder, "");
      rows.push({
        row: v,
        mtClean: mtClean,
        revDate: revDate,
        asanaStart: asana.start || "",
        asanaKey: asana.norm || asana.name || "",
        brand: v.brand || "",
      });
    });
    /* Ranking: projekt Asana (start) > data pliku (anti-bulk) > data rewizji */
    rows.sort(function (a, b) {
      var cmp = compareNewestDesc(
        { mtime: a.asanaStart, date: a.asanaStart },
        { mtime: b.asanaStart, date: b.asanaStart }
      );
      if (cmp) return cmp;
      cmp = compareNewestDesc(
        { mtime: a.mtClean, mtime_ms: a.row && a.row.mtime_ms },
        { mtime: b.mtClean, mtime_ms: b.row && b.row.mtime_ms }
      );
      if (cmp) return cmp;
      cmp = compareNewestDesc({ date: a.revDate }, { date: b.revDate });
      if (cmp) return cmp;
      if (a.brand === "DK" && b.brand !== "DK") return -1;
      if (b.brand === "DK" && a.brand !== "DK") return 1;
      return 0;
    });
    /* Jeden produkt na projekt Asana (unikaj GI + Proteina z tego samego C/xx) */
    var seenAsana = {};
    var unique = [];
    rows.forEach(function (r) {
      var key = r.asanaKey || r.row.product_id;
      if (seenAsana[key]) return;
      seenAsana[key] = true;
      unique.push(r);
    });
    return unique.slice(0, limit || 4).map(function (r) {
      return r.row;
    });
  }

  /* ---------- customize modal copy (clear PL labels + descriptions) ---------- */

  var CUSTOMIZE_META = {
    products_count: {
      label: "Liczba produktów",
      description:
        "Pokazuje ile produktów jest w indeksie DAM. Szybki licznik katalogu na pulpicie."
    },
    asana_open: {
      label: "Otwarte zadania Asana",
      description:
        "Liczba otwartych zadan z Asany powiazanych z projektami. Pomaga zobaczyc aktualne obciazenie pracy."
    },
    asana_home: {
      label: "Asana - Moje zadania",
      description:
        "Kokpit zadan Asana: zakladki Nadchodzace / Zalegle / Ukonczone, lista z terminami oraz boczne karty projektow, osob i źródła danych."
    },
    checklists_ok: {
      label: "Kompletne checklisty",
      description:
        "Ile produktów ma uzupelniona checklistę (kompletne). Sygnal gotowosci do dalszych krokow."
    },
    checklists_gap: {
      label: "Checklisty z brakami",
      description:
        "Ile produktów ma niekompletna checklistę. Lista do uzupelnienia w indeksie lub Eksplorerze."
    },
    cost_month: {
      label: "Szacowany koszt miesiąca",
      description:
        "Suma szacunkowego kosztu miesiąca (landed / FMCG). Domyślnie wylaczona - wlacz, gdy potrzebujesz widoku kosztów."
    },
    cost_fmcg_breakdown: {
      label: "Rozbicie kosztów FMCG",
      description:
        "Szczegolowe linie landed cost: praca, druk, ryzyko i suma. Pokazuje skad bierze sie koszt miesiąca."
    },
    cost_swot_risk: {
      label: "SWOT kosztów i ryzyka",
      description:
        "Cztery pola SWOT (sily, slabe strony, szanse, zagrozenia) dla ryzyka kosztówego. Szybki kontekst decyzyjny."
    },
    projects_this_month: {
      label: "Projekty w tym miesiącu",
      description:
        "Ile nowych lub aktywnych projektow / wizualizacji pojawilo sie w biezacym miesiącu."
    },
    projects_in_progress: {
      label: "Projekty w toku",
      description:
        "Definicja robocza: ile produktów w indeksie nie ma jeszcze pliku F / FQ (folder „ - F” albo PDF/ZIP FQ). Do doprecyzowania."
    },
    newest_viz_3: {
      label: "Najnowsze wizualizacje produktów",
      description:
        "Siatka najnowszych wizualizacji z miniaturami, tagami i skrotami. Liczbę kafelków (2, 4, 6, 8 albo 10) wybierasz na karcie."
    },
    newest_products_f: {
      label: "Najnowsze produkty",
      description:
        "Najnowsze warianty produktów na dysku, posortowane po dacie rewizji. Miniatury, tagi DK/opakowanie/indeks oraz skroty jak przy wizualizacjach."
    },
    branding_latest: {
      label: "Najnowsze materiały branding",
      description:
        "Ostatnie assety z Brandingu (miniatury, marka, warianty) ze skrotami do Brandingu, folderu i podglądu."
    },
    notify_new_viz: {
      label: "Powiadomienia o nowych wizualizacjach",
      description:
        "Przelacznik powiadomien przeglądarki, gdy w indeksie pojawi sie nowa wizualizacja. Pokazuje tez status uprawnien."
    },
    tasks_next: {
      label: "Nastepne zadania",
      description:
        "Lista otwartych zadan Asana posortowana po terminie. Nazwa zadania i data due po prawej."
    },
    tasks_by_section: {
      label: "Zadania wedlug sekcji",
      description:
        "Zlicza otwarte zadania Asana w sekcjach (Dzis, Tydzien, Odlozone, Inne). Widok rozkladu pracy."
    },
    tasks_overdue: {
      label: "Zadania przeterminowane",
      description:
        "Liczba otwartych zadan z terminem w przeszlosci. Szybki alert zaleglosci."
    },
    assignees_load: {
      label: "Obciazenie osob (Asana)",
      description:
        "Paski pokazujace ile otwartych zadan ma kazda osoba. Pomaga zobaczyc kto jest najbardziej obciazony."
    },
    sales_mock: {
      label: "Sprzedaz (szacunek)",
      description:
        "Szacunkowy przychod miesieczny i trend. Dane modelowe do czasu podpiecia realnych wynikow."
    },
    langs_mix: {
      label: "Jezyki i warianty MIX",
      description:
        "Ile jezykow wystepuje w najnowszych wizualizacjach oraz ile pozycji to MIX. Lista top jezykow z liczbami."
    },
    carriers_top: {
      label: "Najczestsze opakowania",
      description:
        "Ranking typow opakowan (carrier) z najnowszych wizualizacji. Bez pozycji nieznanych / OTHER."
    },
    index_health: {
      label: "Stan indeksu plikow",
      description:
        "Liczba wizualizacji i produktów w indeksie oraz data ostatniej generacji. Diagnostyka swiezosci danych."
    },
    viz_flags: {
      label: "Flagi wizualizacji (admin)",
      description:
        "Licznik wizualizacji oznaczonych jako demo oraz ukrytych. Widok tylko dla roli admin."
    },
    missing_thumbs: {
      label: "Wizualizacje bez miniatury",
      description:
        "Ile najnowszych wizualizacji nie ma poprawnej miniatury. Sygnal do uzupelnienia thumbs."
    },
    demo_vs_prod: {
      label: "Demo vs produkcja",
      description:
        "Porownanie liczby wizualizacji demo do pozostalych. Pomaga odseparowac materialy testowe."
    },
    quick_links: {
      label: "Szybkie skroty",
      description:
        "Kompaktowe przyciski nawigacyjne. Plus otwiera wyszukiwalna liste stron DAM (bez tworzenia nowych URL). Wybor zapisuje sie per uzytkownik."
    },
    labor_vs_print: {
      label: "Praca vs druk",
      description:
        "Udzial kosztu pracy i druku w szacunku FMCG (paski procentowe). Pokazuje strukture landed cost."
    },
    efficiency_mock: {
      label: "Koszt na wariant",
      description:
        "Szacunkowy koszt miesiąca podzielony przez liczbe otwartych wariantow. Jedna liczba efektywnosci."
    }
  };

  function customizeMeta(id) {
    return CUSTOMIZE_META[id] || null;
  }

  function customizeLabel(w) {
    if (!w) return "";
    var m = customizeMeta(w.id);
    return (m && m.label) || w.title || w.id;
  }

  function customizeDescription(w) {
    if (!w) return "";
    var m = customizeMeta(w.id);
    return (m && m.description) || "";
  }

  /* ---------- widget defs ---------- */

  function defineWidgets() {
    registry = [
      {
        id: "products_count",
        title: t("dash.widget.products", "Produkty"),
        size: "sm",
        defaultOn: true,
        accentClass: "primary-bg",
        render: function (el, ctx) {
          var n =
            (ctx.projects && ctx.projects.length) ||
            (ctx.fileIndex && ctx.fileIndex.product_count) ||
            0;
          el.outerHTML = shell(
            this,
            statBody(n, t("dash.widget.products_meta", "W indeksie / API")),
            "dam-widget--stat dam-widget--fill-brand"
          );
        }
      },
      {
        id: "asana_open",
        title: t("dash.widget.asana_open", "Zadania Asana"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var tasks = openTasks(ctx);
          el.outerHTML = shell(
            this,
            statBody(tasks.length, t("dash.widget.asana_open_meta", "Otwarte")),
            "dam-widget--stat dam-widget--fill-info"
          );
        }
      },
      {
        id: "asana_home",
        title: t("dash.widget.asana_home", "Asana - Moje zadania"),
        size: "lg",
        defaultOn: true,
        render: function (el, ctx) {
          var raw = (ctx.asana && ctx.asana.tasks) || [];
          var enriched = enrichAsanaTasks(raw);
          var upcoming = filterAsanaHomeTab(enriched, "upcoming");
          var overdue = filterAsanaHomeTab(enriched, "overdue");
          var done = filterAsanaHomeTab(enriched, "done");
          var source =
            (ctx.asana &&
              (ctx.asana.source ||
                (ctx.asana.meta && ctx.asana.meta.source))) ||
            "file";
          var sourceLabel =
            source === "asana-api" || source === "oauth"
              ? "API Asana (live)"
              : source === "asana-export"
                ? "Eksport Asana"
                : "Lokalny cache";
          var greet = t(
            "dash.widget.asana_home_greet",
            "Kokpit zada\u0144 - terminy, projekty i osoby"
          );
          var body =
            '<div class="dam-asana-home">' +
            '<p class="dam-asana-home__greet">' +
            escapeHtml(greet) +
            "</p>" +
            '<div class="dam-asana-home__bento">' +
            '<section class="dam-asana-home__tasks" aria-label="Moje zadania">' +
            '<div class="dam-asana-home__tasks-head">' +
            "<h4>" +
            escapeHtml(t("dash.widget.asana_home_tasks", "Moje zadania")) +
            "</h4>" +
            '<div class="dam-asana-home__tabs" role="tablist">' +
            '<button type="button" class="dam-asana-home__tab is-active" role="tab" aria-selected="true" data-asana-tab="upcoming">' +
            escapeHtml(t("dash.widget.asana_home_upcoming", "Nadchodz\u0105ce")) +
            " (" +
            upcoming.length +
            ")</button>" +
            '<button type="button" class="dam-asana-home__tab" role="tab" aria-selected="false" data-asana-tab="overdue">' +
            escapeHtml(t("dash.widget.asana_home_overdue", "Zaleg\u0142e")) +
            " (" +
            overdue.length +
            ")</button>" +
            '<button type="button" class="dam-asana-home__tab" role="tab" aria-selected="false" data-asana-tab="done">' +
            escapeHtml(t("dash.widget.asana_home_done", "Uko\u0144czone")) +
            " (" +
            done.length +
            ")</button>" +
            "</div></div>" +
            '<ul class="dam-asana-home__list" data-asana-task-list>' +
            asanaHomeTaskRowsHtml(upcoming) +
            "</ul></section>" +
            '<aside class="dam-asana-home__rail">' +
            '<div class="dam-asana-home__card">' +
            "<h4>" +
            escapeHtml(t("dash.widget.asana_home_projects", "Projekty")) +
            "</h4>" +
            asanaHomeProjectsHtml(enriched) +
            "</div>" +
            '<div class="dam-asana-home__card">' +
            "<h4>" +
            escapeHtml(t("dash.widget.asana_home_people", "Osoby")) +
            "</h4>" +
            asanaHomePeopleHtml(enriched) +
            "</div>" +
            '<div class="dam-asana-home__card dam-asana-home__card--meta">' +
            "<h4>" +
            escapeHtml(t("dash.widget.asana_home_notes", "Komentarze / \u017ar\u00f3d\u0142o")) +
            "</h4>" +
            '<p class="dam-widget__meta">' +
            escapeHtml(
              "Komentarze Asana nie s\u0105 w eksporcie lokalnym. \u0179r\u00f3d\u0142o: " +
                sourceLabel +
                "."
            ) +
            "</p>" +
            '<p class="dam-asana-home__meta-line">' +
            '<a href="tasks.html">Otw\u00f3rz Zadania</a>' +
            '<a href="inbox.html?tag=asana">Skrzynka</a>' +
            '<span class="dam-asana-home__source">' +
            escapeHtml(sourceLabel) +
            "</span></p></div></aside></div></div>";
          if (!raw.length && ctx.asanaLoading) {
            if (
              global.DamTasks &&
              typeof DamTasks.dashboardAsanaSkeletonHtml === "function"
            ) {
              body = DamTasks.dashboardAsanaSkeletonHtml();
            } else {
              var skRows = "";
              var si;
              for (si = 0; si < 5; si++) {
                skRows +=
                  '<li class="dam-asana-home__row" aria-hidden="true">' +
                  '<span class="dam-tasks-skel__check"></span>' +
                  '<span class="dam-asana-home__main"><span class="dam-tasks-skel__line"></span>' +
                  '<span class="dam-tasks-skel__pill"></span></span>' +
                  '<span class="dam-tasks-skel__due"></span></li>';
              }
              body =
                '<div class="dam-asana-home" aria-busy="true">' +
                '<section class="dam-asana-home__tasks"><ul class="dam-asana-home__list">' +
                skRows +
                "</ul></section></div>";
            }
          }
          el.outerHTML = shell(this, body, "dam-widget--asana-home");
          var host = document.querySelector('[data-widget-id="asana_home"]');
          if (!(ctx.asanaLoading && !raw.length)) {
            bindAsanaHomeWidget(host, enriched);
          }
        }
      },
      {
        id: "checklists_ok",
        title: t("dash.widget.checklists_ok", "Kompletne checklisty"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var rows = ctx.projects || [];
          var n = rows.filter(function (p) {
            return p.completeness === "complete";
          }).length;
          el.outerHTML = shell(
            this,
            statBody(n, t("dash.widget.checklists_ok_meta", "Gotowe")),
            "dam-widget--stat dam-widget--fill-success"
          );
        }
      },
      {
        id: "checklists_gap",
        title: t("dash.widget.checklists_gap", "Z brakami"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var rows = ctx.projects || [];
          var n = rows.length
            ? rows.filter(function (p) {
                return p.completeness !== "complete";
              }).length
            : "-";
          el.outerHTML = shell(
            this,
            statBody(n, t("dash.widget.checklists_gap_meta", "Do uzupełnienia")),
            "dam-widget--stat dam-widget--fill-warning"
          );
        }
      },
      {
        id: "cost_month",
        title: t("dash.balance_label", "Szacowany koszt miesiąca"),
        size: "md",
        defaultOn: false,
        accent: true,
        render: function (el, ctx) {
          var landed =
            (ctx.landed && ctx.landed.landed_month) ||
            (ctx.projectCosts && ctx.projectCosts.sum_open_projects) ||
            0;
          var chip =
            (ctx.landed && ctx.landed.chip) ||
            t("dash.balance_chip", "Szacunek branżowy");
          var when = new Date().toLocaleDateString("pl-PL", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          });
          el.outerHTML = shell(
            this,
            statBody(
              global.DamFmcg ? DamFmcg.formatPLN(landed) : Math.round(landed) + " PLN",
              when
            ) +
              '<span class="dam-widget__chip">' +
              escapeHtml(chip) +
              "</span>",
            ""
          );
        }
      },
      {
        id: "cost_fmcg_breakdown",
        title: t("dash.widget.fmcg_breakdown", "Landed cost (FMCG)"),
        size: "lg",
        defaultOn: false,
        render: function (el, ctx) {
          var L = ctx.landed || { lines: [], estimate: true };
          var rows = (L.lines || [])
            .map(function (line) {
              return (
                '<li><span>' +
                escapeHtml(line.label) +
                '</span><strong style="margin-left:auto">' +
                escapeHtml(
                  global.DamFmcg
                    ? DamFmcg.formatPLN(line.total)
                    : Math.round(line.total) + " PLN"
                ) +
                "</strong></li>"
              );
            })
            .join("");
          var risk =
            '<li><span>Narzut ryzyka (' +
            escapeHtml(String(L.risk_pct || 0)) +
            '%)</span><strong style="margin-left:auto">' +
            escapeHtml(
              global.DamFmcg ? DamFmcg.formatPLN(L.risk) : Math.round(L.risk || 0) + " PLN"
            ) +
            "</strong></li>";
          el.outerHTML = shell(
            this,
            '<span class="dam-widget__chip">' +
              escapeHtml(
                L.chip || "Szacunek branżowy - podmienimy na dane realne"
              ) +
              "</span>" +
              '<ul class="dam-widget__list">' +
              rows +
              risk +
              "</ul>" +
              '<p class="dam-widget__value" style="font-size:1.35rem;margin-top:4px">' +
              escapeHtml(
                global.DamFmcg
                  ? DamFmcg.formatPLN(L.landed_month)
                  : Math.round(L.landed_month || 0) + " PLN"
              ) +
              "</p>"
          );
        }
      },
      {
        id: "cost_swot_risk",
        title: t("dash.widget.swot", "SWOT / ryzyko kosztówe"),
        size: "lg",
        defaultOn: false,
        render: function (el, ctx) {
          var sw =
            (global.DamFmcg && DamFmcg.getSwot(ctx.fmcg)) || {
              strengths: [],
              weaknesses: [],
              opportunities: [],
              threats: []
            };
          function card(label, items, tone) {
            var lis = (items || [])
              .slice(0, 3)
              .map(function (x) {
                return "<li>" + escapeHtml(x) + "</li>";
              })
              .join("");
            return (
              '<div class="dam-widget__swot-card" data-tone="' +
              tone +
              '"><h6>' +
              escapeHtml(label) +
              "</h6><ul>" +
              lis +
              "</ul></div>"
            );
          }
          el.outerHTML = shell(
            this,
            '<div class="dam-widget__swot">' +
              card("Sily", sw.strengths, "s") +
              card("Slabe strony", sw.weaknesses, "w") +
              card("Szanse", sw.opportunities, "o") +
              card("Zagrozenia", sw.threats, "t") +
              "</div>"
          );
        }
      },
      {
        id: "projects_this_month",
        title: t("dash.widget.projects_month", "Projekty w tym miesiącu"),
        size: "sm",
        defaultOn: true,
        render: function (el, ctx) {
          var prefix = monthPrefix();
          var viz = (ctx.fileIndex && ctx.fileIndex.viz_latest) || [];
          var ids = {};
          viz.forEach(function (v) {
            if ((v.mtime || "").indexOf(prefix) === 0) {
              ids[v.product_id || v.path] = true;
            }
          });
          var asanaNew = ((ctx.projectCosts && ctx.projectCosts.projects) || []).filter(
            function (p) {
              return (p.start || "").indexOf(prefix) === 0;
            }
          ).length;
          var n = Object.keys(ids).length || asanaNew;
          el.outerHTML = shell(
            this,
            statBody(n, t("dash.widget.projects_month_meta", "Nowe / aktywne w indeksie")),
            "dam-widget--stat dam-widget--fill-primary"
          );
        }
      },
      {
        id: "projects_in_progress",
        title: t("dash.widget.projects_wip", "W toku"),
        size: "sm",
        defaultOn: true,
        render: function (el, ctx) {
          var n = countProjectsInProgress(ctx);
          el.outerHTML = shell(
            this,
            statBody(
              n,
              t(
                "dash.widget.projects_wip_meta",
                "Bez pliku F / FQ (definicja robocza)"
              )
            ),
            "dam-widget--stat dam-widget--fill-info"
          );
        }
      },
      {
        id: "newest_viz_3",
        title: t("dash.widget.newest_viz", "Najnowsze wizualizacje"),
        size: "md",
        defaultOn: true,
        render: function (el, ctx) {
          var self = this;
          ensureDashLayoutCss();
          var layout = getTileLayout(self.id);
          var n = layoutCardCount(layout);
          var prevTitle = self.title;
          self.title = vizTitleForCount(n);
          if (ctx && ctx.dashLoading) {
            el.outerHTML = shell(
              self,
              mediaWidgetSkeletonHtml(layout, n, "dam-widget__list--viz"),
              "dam-widget--viz-latest dam-widget--media-latest",
              layoutToggleHtml(self.id, layout)
            );
            self.title = prevTitle;
            bindLayoutToggle(self.id, function () {
              var host = document.querySelector('[data-widget-id="newest_viz_3"]');
              if (host) self.render(host, ctx);
            });
            return;
          }
          var list = pickNewestViz(ctx, n);
          if (!list.length) {
            el.outerHTML = shell(
              self,
              '<p class="dam-widget__meta">Brak wizualizacji powiazanych z projektem Asana</p>',
              "dam-widget--viz-latest dam-widget--media-latest",
              layoutToggleHtml(self.id, layout)
            );
            self.title = prevTitle;
            bindLayoutToggle(self.id, function () {
              var host = document.querySelector('[data-widget-id="newest_viz_3"]');
              if (host) self.render(host, ctx);
            });
            return;
          }
          var html =
            '<ul class="' +
            mediaListClass(layout) +
            ' dam-widget__list--viz">' +
            list.map(buildMediaLatestRowHtml).join("") +
            "</ul>";
          el.outerHTML = shell(
            self,
            html,
            "dam-widget--viz-latest dam-widget--media-latest",
            layoutToggleHtml(self.id, layout)
          );
          self.title = prevTitle;
          var hostViz = document.querySelector('[data-widget-id="newest_viz_3"]');
          rebindWidgetChrome(hostViz);
          bindHonestThumbFallbacks(hostViz);
          ensureDashThumbReveal(hostViz);
          if (
            global.DamPreviewTruth &&
            typeof DamPreviewTruth.warmThumbs === "function"
          ) {
            DamPreviewTruth.warmThumbs(warmThumbPathsFromRows(list), "grid");
          }
          bindLayoutToggle(self.id, function () {
            var host = document.querySelector('[data-widget-id="newest_viz_3"]');
            if (host) self.render(host, ctx);
          });
        }
      },
      {
        id: "newest_products_f",
        title: t("dash.widget.newest_products_f", "Najnowsze"),
        size: "md",
        defaultOn: true,
        render: function (el, ctx) {
          var self = this;
          ensureDashLayoutCss();
          var layout = getTileLayout(self.id);
          var n = layoutCardCount(layout);
          var prevTitle = self.title;
          self.title = productsTitleForCount(n);
          if (ctx && ctx.dashLoading) {
            el.outerHTML = shell(
              self,
              mediaWidgetSkeletonHtml(layout, n, "dam-widget__list--viz"),
              "dam-widget--viz-latest dam-widget--media-latest",
              layoutToggleHtml(self.id, layout)
            );
            self.title = prevTitle;
            bindLayoutToggle(self.id, function () {
              var host = document.querySelector('[data-widget-id="newest_products_f"]');
              if (host) self.render(host, ctx);
            });
            return;
          }
          var list = pickNewestProductsF(ctx, n);
          if (!list.length) {
            el.outerHTML = shell(
              self,
              '<p class="dam-widget__meta">Brak wariantow ze statusem Final (F) w indeksie</p>',
              "dam-widget--viz-latest dam-widget--media-latest",
              layoutToggleHtml(self.id, layout)
            );
            self.title = prevTitle;
            bindLayoutToggle(self.id, function () {
              var host = document.querySelector('[data-widget-id="newest_products_f"]');
              if (host) self.render(host, ctx);
            });
            return;
          }
          var htmlProducts =
            '<ul class="' +
            mediaListClass(layout) +
            ' dam-widget__list--viz">' +
            list
              .map(function (row) {
                return buildMediaLatestRowHtml(row, { linkTarget: "explorer" });
              })
              .join("") +
            "</ul>";
          el.outerHTML = shell(
            self,
            htmlProducts,
            "dam-widget--viz-latest dam-widget--media-latest",
            layoutToggleHtml(self.id, layout)
          );
          self.title = prevTitle;
          var hostProd = document.querySelector('[data-widget-id="newest_products_f"]');
          rebindWidgetChrome(hostProd);
          bindHonestThumbFallbacks(hostProd);
          ensureDashThumbReveal(hostProd);
          if (
            global.DamPreviewTruth &&
            typeof DamPreviewTruth.warmThumbs === "function"
          ) {
            DamPreviewTruth.warmThumbs(warmThumbPathsFromRows(list), "grid");
          }
          bindLayoutToggle(self.id, function () {
            var host = document.querySelector('[data-widget-id="newest_products_f"]');
            if (host) self.render(host, ctx);
          });
          requestDashBentoRemount();
        }
      },
      {
        id: "branding_latest",
        title: t("dash.widget.branding_latest", "Najnowsze materiały branding"),
        size: "md",
        defaultOn: true,
        render: function (el) {
          var self = this;
          ensureDashLayoutCss();
          var layout = getTileLayout(self.id);
          var n = layoutCardCount(layout);
          var prevTitle = self.title;
          self.title = brandingTitleForCount(n);
          /* Per-object skel inside widget body — mirrors real 2x2 media rows */
          el.outerHTML = shell(
            self,
            mediaWidgetSkeletonHtml(layout, n),
            "dam-widget--branding-latest dam-widget--media-latest",
            layoutToggleHtml(self.id, layout)
          );
          self.title = prevTitle;
          bindLayoutToggle(self.id, function () {
            var hostToggle = document.querySelector('[data-widget-id="branding_latest"]');
            if (hostToggle) self.render(hostToggle);
          });
          /* Yield a frame so per-object skel paints before index fetch */
          var loadBranding = function () {
            return loadBrandingIndex();
          };
          var afterPaint =
            typeof requestAnimationFrame === "function"
              ? function (fn) {
                  requestAnimationFrame(function () {
                    requestAnimationFrame(fn);
                  });
                }
              : function (fn) {
                  setTimeout(fn, 32);
                };
          afterPaint(function () {
            var retryCount = Number(self._brandingLoadTries) || 0;
            loadBranding()
              .then(function (data) {
                /* Yield so per-object skeleton stays painted; avoid sync OOM after 300MB+ JSON. */
                return yieldTick().then(function () {
                  return data;
                });
              })
              .then(function (data) {
                var elHost = document.querySelector('[data-widget-id="branding_latest"]');
                if (!elHost) return null;
                el = elHost;
                var assets = collectRecentBrandingThumbs(data.assets || [], n);
                return pickBrandingLatestGroups(assets, n);
              })
              .then(function (groups) {
                if (!groups) return;
                var elHost = document.querySelector('[data-widget-id="branding_latest"]');
                if (!elHost) return;
                el = elHost;
                self._brandingLoadTries = 0;
                self.title = brandingTitleForCount(n);
                if (!groups.length) {
                  el.outerHTML = shell(
                    self,
                    '<p class="dam-widget__meta">' +
                      escapeHtml(
                        t(
                          "dash.widget.branding_no_thumbs",
                          "Brak miniatur graficznych do podglądu."
                        )
                      ) +
                      ' <a href="branding.html">' +
                      escapeHtml(t("dash.widget.open_branding", "Otwórz Branding")) +
                      "</a></p>",
                    "dam-widget--branding-latest dam-widget--media-latest",
                    layoutToggleHtml(self.id, layout)
                  );
                  bindLayoutToggle(self.id, function () {
                    var host = document.querySelector('[data-widget-id="branding_latest"]');
                    if (host) self.render(host);
                  });
                  afterMediaHostReplace(
                    document.querySelector('[data-widget-id="branding_latest"]')
                  );
                  if (global.DamPageReady && typeof DamPageReady.mark === "function") {
                    DamPageReady.mark("dashboard-branding");
                  }
                  return;
                }
                var winIcon =
                  global.DamIcons && typeof DamIcons.winExplorerSvg === "function"
                    ? DamIcons.winExplorerSvg()
                    : '<i class="uil uil-folder" aria-hidden="true"></i>';
                var ph = brandingThumbPlaceholderDataUri();
                var html =
                  '<ul class="' +
                  mediaListClass(layout) +
                  '">' +
                  groups
                    .map(function (g) {
                      var a = g.newest || {};
                      var brandingHref = brandingHrefForAsset(a, g.label || a.name || "");
                      var thumb = g.hasSafeCover ? brandingThumbUrl(a) : ph;
                      if (!thumb) thumb = ph;
                      var assetJson = escapeHtml(
                        JSON.stringify({
                          id: a.id || "",
                          name: a.name || g.label || "",
                          path: a.path || "",
                          media_type: a.media_type || "image",
                          brand: a.brand || "",
                        })
                      );
                      return (
                        '<li class="dam-widget__viz-row" data-dash-asset="' +
                        assetJson +
                        '">' +
                        '<div class="dam-nav-circles dam-nav-circles--stack dam-nav-circles--tiles">' +
                        '<a class="dam-viz-icon-btn dam-viz-icon-btn--explorer" href="' +
                        brandingHref +
                        '" title="Branding" aria-label="Branding" data-dam-tip="Otworz Branding">' +
                        '<i class="uil uil-palette" aria-hidden="true"></i></a>' +
                        '<button type="button" class="dam-viz-icon-btn dam-win-btn" data-path="' +
                        escapeHtml(dirnamePath(a.path || "")) +
                        '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera folder w Eksploratorze plikow Windows"' +
                        (!a.path ? " disabled" : "") +
                        ">" +
                        winIcon +
                        "</button>" +
                        '<button type="button" class="dam-viz-icon-btn dam-viz-icon-btn--viz" data-dash-preview="1" title="Podglad" aria-label="Podglad" data-dam-tip="Podglad materialu w miejscu">' +
                        '<i class="uil uil-eye" aria-hidden="true"></i></button>' +
                        "</div>" +
                        '<div class="dam-widget__viz-media">' +
                        '<a class="dam-widget__thumb-link" href="' +
                        brandingHref +
                        '" data-dash-preview="1" title="Podglad">' +
                        '<img class="dam-widget__thumb' +
                        (g.hasSafeCover ? "" : " dam-widget__thumb--fallback") +
                        '" src="' +
                        escapeHtml(thumb) +
                        '" data-path="' +
                        escapeHtml(a.path || "") +
                        '" alt="' +
                        escapeHtml(g.label) +
                        '" loading="lazy" />' +
                        "</a>" +
                        '<div class="dam-widget__viz-body">' +
                        '<a href="' +
                        brandingHref +
                        '" title="' +
                        escapeHtml(g.label) +
                        '">' +
                        escapeHtml(g.label) +
                        "</a>" +
                        '<div class="dam-widget__viz-badges">' +
                        brandingBadgesHtml(a, g) +
                        "</div></div></div></li>"
                      );
                    })
                    .join("") +
                  '</ul><p class="dam-widget__meta"><a href="branding.html">' +
                  escapeHtml(t("dash.widget.open_branding", "Otwórz Branding")) +
                  "</a></p>";
                el.outerHTML = shell(
                  self,
                  html,
                  "dam-widget--branding-latest dam-widget--media-latest",
                  layoutToggleHtml(self.id, layout)
                );
                var hostBr = document.querySelector('[data-widget-id="branding_latest"]');
                rebindWidgetChrome(hostBr);
                bindHonestThumbFallbacks(hostBr);
                ensureDashThumbReveal(hostBr);
                if (
                  global.DamPreviewTruth &&
                  typeof DamPreviewTruth.warmThumbs === "function"
                ) {
                  DamPreviewTruth.warmThumbs(
                    groups
                      .filter(function (g) {
                        return g.hasSafeCover && g.path;
                      })
                      .map(function (g) {
                        return normThumbPath(g.path);
                      }),
                    "grid"
                  );
                }
                bindLayoutToggle(self.id, function () {
                  var host = document.querySelector('[data-widget-id="branding_latest"]');
                  if (host) self.render(host);
                });
                afterMediaHostReplace(hostBr);
                if (global.DamPageReady && typeof DamPageReady.mark === "function") {
                  DamPageReady.mark("dashboard-branding");
                }
              })
              .catch(function () {
                var failHost = document.querySelector('[data-widget-id="branding_latest"]');
                if (!failHost) return;
                var hasData =
                  global.__damBrandingIndex &&
                  Array.isArray(global.__damBrandingIndex.assets) &&
                  global.__damBrandingIndex.assets.length > 0;
                /* Brief fetch/process fail: keep per-object skeleton and retry.
                   Cap tries even when cache exists (avoid infinite loop). */
                var maxTries = hasData ? 3 : 2;
                if (retryCount < maxTries) {
                  self._brandingLoadTries = retryCount + 1;
                  failHost.outerHTML = shell(
                    self,
                    mediaWidgetSkeletonHtml(layout, n),
                    "dam-widget--branding-latest dam-widget--media-latest",
                    layoutToggleHtml(self.id, layout)
                  );
                  bindLayoutToggle(self.id, function () {
                    var hostToggle = document.querySelector('[data-widget-id="branding_latest"]');
                    if (hostToggle) self.render(hostToggle);
                  });
                  setTimeout(function () {
                    var host = document.querySelector('[data-widget-id="branding_latest"]');
                    if (host) self.render(host);
                  }, hasData ? 120 : 400);
                  return;
                }
                self.title = brandingTitleForCount(n);
                failHost.outerHTML = shell(
                  self,
                  '<p class="dam-widget__meta">' +
                    escapeHtml(
                      t(
                        "dash.widget.branding_index_unavailable",
                        "Nie udało się wczytać indeksu branding."
                      )
                    ) +
                    ' <a href="branding.html">' +
                    escapeHtml(t("dash.widget.open_branding", "Otwórz Branding")) +
                    "</a></p>",
                  "dam-widget--branding-latest dam-widget--media-latest",
                  layoutToggleHtml(self.id, layout)
                );
                bindLayoutToggle(self.id, function () {
                  var host = document.querySelector('[data-widget-id="branding_latest"]');
                  if (host) {
                    self._brandingLoadTries = 0;
                    self.render(host);
                  }
                });
                afterMediaHostReplace(
                  document.querySelector('[data-widget-id="branding_latest"]')
                );
                if (global.DamPageReady && typeof DamPageReady.mark === "function") {
                  DamPageReady.mark("dashboard-branding");
                }
              });
          });
        },
      },
      {
        id: "notify_new_viz",
        title: t("dash.widget.notify", "Powiadomienia o wizualizacjach"),
        size: "strip",
        defaultOn: true,
        render: function (el, ctx) {
          var enabled = global.DamNotify && DamNotify.isEnabled();
          var status =
            (global.DamNotify && DamNotify.statusText()) || "Niedostępne";
          var id = "damNotifyToggle";
          el.outerHTML = shell(
            this,
            '<div class="dam-widget__notify dam-widget__notify--strip">' +
              '<label class="dam-widget__toggle" for="' +
              id +
              '">' +
              '<input type="checkbox" id="' +
              id +
              '"' +
              (enabled ? " checked" : "") +
              " />" +
              "<span>" +
              escapeHtml(
                t("dash.widget.notify_label", "Powiadom gdy pojawi się nowa wizualizacja")
              ) +
              "</span></label>" +
              '<span class="dam-widget__meta" id="damNotifyStatus">' +
              escapeHtml(status) +
              "</span></div>"
          );
          var input = document.getElementById(id);
          if (input && global.DamNotify) {
            input.addEventListener("change", function () {
              var on = !!input.checked;
              if (on) {
                DamNotify.requestPermission().then(function () {
                  DamNotify.setEnabled(true);
                  var st = document.getElementById("damNotifyStatus");
                  if (st) st.textContent = DamNotify.statusText();
                });
              } else {
                DamNotify.setEnabled(false);
                var st2 = document.getElementById("damNotifyStatus");
                if (st2) st2.textContent = DamNotify.statusText();
              }
            });
          }
        }
      },
      {
        id: "tasks_next",
        title: t("dash.widget.tasks_next", "Następne zadania"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var tasks = filterAsanaHomeTab(
            enrichAsanaTasks((ctx.asana && ctx.asana.tasks) || []),
            "upcoming"
          ).slice(0, 6);
          if (!tasks.length) {
            el.outerHTML = shell(
              this,
              '<p class="dam-widget__meta">Brak otwartych zadan</p>'
            );
            return;
          }
          var html =
            '<ul class="dam-widget__list">' +
            tasks
              .map(function (task) {
                var label = task.displayTitle;
                if (task.projectPill) {
                  label = task.displayTitle + " · " + task.projectPill;
                }
                return (
                  "<li>" +
                  '<span title="' +
                  escapeHtml(label) +
                  '">' +
                  escapeHtml(task.displayTitle) +
                  "</span>" +
                  '<span class="' +
                  (task.isOverdue ? "is-overdue" : "") +
                  '">' +
                  escapeHtml(task.dueLabel || "-") +
                  "</span></li>"
                );
              })
              .join("") +
            "</ul>";
          el.outerHTML = shell(this, html);
        }
      },
      {
        id: "tasks_by_section",
        title: t("dash.widget.tasks_sections", "Zadania wg sekcji"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var buckets = { Dzis: 0, Tydzien: 0, Odlozone: 0, Inne: 0 };
          openTasks(ctx).forEach(function (task) {
            var s = (task.section || "").toLowerCase();
            if (s.indexOf("dzi") !== -1) buckets.Dzis++;
            else if (s.indexOf("tydzie") !== -1 || s.indexOf("tydzień") !== -1)
              buckets.Tydzien++;
            else if (s.indexOf("odloz") !== -1 || s.indexOf("odłoż") !== -1)
              buckets.Odlozone++;
            else buckets.Inne++;
          });
          var html =
            '<ul class="dam-widget__list">' +
            Object.keys(buckets)
              .map(function (k) {
                return (
                  "<li><span>" +
                  escapeHtml(k) +
                  '</span><strong style="margin-left:auto">' +
                  buckets[k] +
                  "</strong></li>"
                );
              })
              .join("") +
            "</ul>";
          el.outerHTML = shell(this, html);
        }
      },
      {
        id: "tasks_overdue",
        title: t("dash.widget.tasks_overdue", "Przeterminowane"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var now = new Date();
          var n = openTasks(ctx).filter(function (task) {
            return task.due && new Date(task.due) < now;
          }).length;
          el.outerHTML = shell(this, statBody(n, "Z due w przeszlosci"));
        }
      },
      {
        id: "assignees_load",
        title: t("dash.widget.assignees", "Obciążenie osób"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var map = {};
          openTasks(ctx).forEach(function (task) {
            var a = task.assignee || "Bez przypisania";
            map[a] = (map[a] || 0) + 1;
          });
          var rows = Object.keys(map)
            .map(function (k) {
              return { name: k, n: map[k] };
            })
            .sort(function (a, b) {
              return b.n - a.n;
            })
            .slice(0, 5);
          var max = (rows[0] && rows[0].n) || 1;
          var html =
            '<div class="dam-widget__bars">' +
            rows
              .map(function (r) {
                var pct = Math.round((r.n / max) * 100);
                return (
                  '<div class="dam-widget__bar-row">' +
                  "<span>" +
                  escapeHtml(r.name.split(" ")[0]) +
                  "</span>" +
                  '<div class="dam-widget__bar-track"><div class="dam-widget__bar-fill" style="width:' +
                  pct +
                  '%"></div></div>' +
                  "<span>" +
                  r.n +
                  "</span></div>"
                );
              })
              .join("") +
            "</div>";
          el.outerHTML = shell(
            this,
            rows.length
              ? html
              : '<p class="dam-widget__meta">Brak danych Asana</p>'
          );
        }
      },
      {
        id: "sales_mock",
        title: t("dash.widget.sales", "Sprzedaż (szacunek)"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var s =
            (global.DamFmcg && DamFmcg.getSalesMock(ctx.fmcg)) || {
              monthly_revenue_pln: 0,
              trend_pct: 0,
              note: ""
            };
          el.outerHTML = shell(
            this,
            '<p class="dam-widget__value">' +
              escapeHtml(
                global.DamFmcg
                  ? DamFmcg.formatPLN(s.monthly_revenue_pln)
                  : Math.round(s.monthly_revenue_pln || 0) + " PLN"
              ) +
              "</p>" +
              '<span class="dam-widget__meta">Trend ' +
              escapeHtml(String(s.trend_pct || 0)) +
              "% · " +
              escapeHtml(String(s.monthly_units || 0)) +
              " szt.</span>" +
              '<span class="dam-widget__chip">' +
              escapeHtml(
                s.note || "Szacunek do czasu danych rzeczywistych"
              ) +
              "</span>"
          );
        }
      },
      {
        id: "langs_mix",
        title: t("dash.widget.langs", "Języki / MIX"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var viz = (ctx.fileIndex && ctx.fileIndex.viz_latest) || [];
          var langs = {};
          var mix = 0;
          viz.forEach(function (v) {
            if (v.is_mix) mix++;
            var lg = v.lang || "pl";
            langs[lg] = (langs[lg] || 0) + 1;
          });
          var top = Object.keys(langs)
            .sort(function (a, b) {
              return langs[b] - langs[a];
            })
            .slice(0, 6);
          var html =
            '<p class="dam-widget__value" style="font-size:1.35rem">' +
            Object.keys(langs).length +
            ' językow · MIX: ' +
            mix +
            "</p>" +
            '<ul class="dam-widget__list">' +
            top
              .map(function (lg) {
                return (
                  "<li><span>" +
                  escapeHtml(lg.toUpperCase()) +
                  '</span><strong style="margin-left:auto">' +
                  langs[lg] +
                  "</strong></li>"
                );
              })
              .join("") +
            "</ul>";
          el.outerHTML = shell(this, html);
        }
      },
      {
        id: "carriers_top",
        title: t("dash.widget.carriers", "Top opakowań"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var viz = (ctx.fileIndex && ctx.fileIndex.viz_latest) || [];
          var map = {};
          viz.forEach(function (v) {
            var c =
              window.DamLabels && typeof window.DamLabels.carrierLabel === "function"
                ? window.DamLabels.carrierLabel(v.carrier, v.revision_folder || v.carrier, {
                    isMix: v.is_mix,
                    productName: v.product_name,
                    tags: v.tags,
                  })
                : v.carrier_label || v.carrier || "";
            /* Typ nieznany - nie liczymy go do "Top opakowań" (bez OTHER/WARIANT) */
            if (!c || /^(OTHER|UNKNOWN|WARIANT)$/i.test(c)) return;
            map[c] = (map[c] || 0) + 1;
          });
          var rows = Object.keys(map)
            .map(function (k) {
              return { name: k, n: map[k] };
            })
            .sort(function (a, b) {
              return b.n - a.n;
            })
            .slice(0, 6);
          var html =
            '<ul class="dam-widget__list">' +
            rows
              .map(function (r) {
                return (
                  "<li><span>" +
                  escapeHtml(r.name) +
                  '</span><strong style="margin-left:auto">' +
                  r.n +
                  "</strong></li>"
                );
              })
              .join("") +
            "</ul>";
          el.outerHTML = shell(this, html);
        }
      },
      {
        id: "index_health",
        title: t("dash.widget.index_health", "Stan indeksu"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var fi = ctx.fileIndex || {};
          var when = fi.generated_at
            ? new Date(fi.generated_at).toLocaleString("pl-PL")
            : "-";
          el.outerHTML = shell(
            this,
            '<p class="dam-widget__value" style="font-size:1.2rem">' +
              escapeHtml(String(fi.viz_count || 0)) +
              " wiz</p>" +
              '<span class="dam-widget__meta">' +
              escapeHtml(String(fi.product_count || 0)) +
              " produktów · " +
              escapeHtml(when) +
              "</span>"
          );
        }
      },
      {
        id: "viz_flags",
        title: t("dash.widget.viz_flags", "Flagi wizualizacji"),
        size: "sm",
        defaultOn: false,
        roles: ["admin"],
        render: function (el, ctx) {
          var flags = ctx.vizFlags || { demo: {}, hidden: {} };
          var demo = Object.keys(flags.demo || {}).length;
          var hidden = Object.keys(flags.hidden || {}).length;
          el.outerHTML = shell(
            this,
            statBody(demo + " / " + hidden, "Demo / ukryte")
          );
        }
      },
      {
        id: "missing_thumbs",
        title: t("dash.widget.missing_thumbs", "Bez miniatury"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var viz = (ctx.fileIndex && ctx.fileIndex.viz_latest) || [];
          var n = viz.filter(function (v) {
            return !v.thumb_url || String(v.thumb_url).indexOf("noid") !== -1;
          }).length;
          el.outerHTML = shell(this, statBody(n, "Wymagaja thumbs"));
        }
      },
      {
        id: "demo_vs_prod",
        title: t("dash.widget.demo_vs_prod", "Demo vs produkcja"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var viz = (ctx.fileIndex && ctx.fileIndex.viz_latest) || [];
          var flags = ctx.vizFlags || { demo: {} };
          var demo = 0;
          viz.forEach(function (v) {
            var key = [v.index_base || "", v.lang || "", v.path || ""].join("|");
            if (flags.demo && flags.demo[key]) demo++;
            else if ((v.revision_folder || "").toUpperCase().indexOf("DEMO") !== -1)
              demo++;
          });
          el.outerHTML = shell(
            this,
            statBody(demo + " / " + Math.max(0, viz.length - demo), "Demo / reszta")
          );
        }
      },
      {
        id: "quick_links",
        title: t("dash.widget.quick_links", "Szybkie skróty"),
        size: "md",
        defaultOn: true,
        render: function (el) {
          el.outerHTML = shell(
            this,
            buildQuickLinksBodyHtml(),
            "dam-widget--quick-links"
          );
          var host = document.querySelector('[data-widget-id="quick_links"]');
          if (host) {
            bindQuickLinksWidget(host);
            syncQuickLinksLayout(host);
          }
        }
      },
      {
        id: "labor_vs_print",
        title: t("dash.widget.labor_vs_print", "Praca vs druk"),
        size: "md",
        defaultOn: false,
        render: function (el, ctx) {
          var L = ctx.landed || {};
          var labor = L.labor_total || 0;
          var print = L.print_total || 0;
          var sum = labor + print || 1;
          el.outerHTML = shell(
            this,
            '<div class="dam-widget__bars">' +
              '<div class="dam-widget__bar-row"><span>Praca</span><div class="dam-widget__bar-track"><div class="dam-widget__bar-fill" style="width:' +
              Math.round((labor / sum) * 100) +
              '%"></div></div><span>' +
              Math.round((labor / sum) * 100) +
              "%</span></div>" +
              '<div class="dam-widget__bar-row"><span>Druk</span><div class="dam-widget__bar-track"><div class="dam-widget__bar-fill" style="width:' +
              Math.round((print / sum) * 100) +
              '%;background:var(--dam-primary)"></div></div><span>' +
              Math.round((print / sum) * 100) +
              "%</span></div></div>" +
              '<span class="dam-widget__chip">Szacunek FMCG</span>'
          );
        }
      },
      {
        id: "efficiency_mock",
        title: t("dash.widget.efficiency", "Koszt / wariant"),
        size: "sm",
        defaultOn: false,
        render: function (el, ctx) {
          var L = ctx.landed || {};
          var units = L.variantUnits || 1;
          var per = (L.landed_month || 0) / units;
          el.outerHTML = shell(
            this,
            statBody(
              global.DamFmcg ? DamFmcg.formatPLN(per) : Math.round(per) + " PLN",
              "Na otwarty wariant (szacunek)"
            )
          );
        }
      }
    ];
  }

  function placeAsanaHomeBleed() {
    var bleed = document.getElementById("damDashAsanaBleed");
    var home = document.querySelector('#damDashGrid [data-widget-id="asana_home"]');
    if (!bleed) return;
    if (!home) {
      bleed.innerHTML = "";
      bleed.hidden = true;
      return;
    }
    bleed.hidden = false;
    bleed.innerHTML = "";
    bleed.appendChild(home);
  }

  /* ---------- quick_links: compact chips + searchable pool picker ---------- */

  var QL_STORAGE_PREFIX = "dam_quick_links_v1:";
  var QL_DEFAULT_KEYS = ["visualizations", "costs", "explorer", "invoices"];
  var QL_SHORT_LABELS = {
    dashboard: "Dashboard",
    explorer: "Eksplorer",
    visualizations: "Wizualizacje",
    branding: "Branding",
    projects: "Projekty",
    inbox: "Wiadomosci",
    tasks: "Zadania",
    invoices: "Faktury",
    costs: "Koszty",
    integrations: "Integracja i produkcja"
  };
  var _qlPickerEl = null;
  var _qlPickerCloseBound = null;

  function quickLinksFallbackPool() {
    return [
      { key: "explorer", href: "explorer.html", icon: "uil-sitemap", label: "Eksplorer" },
      {
        key: "visualizations",
        href: "visualizations.html",
        icon: "uil-image",
        label: "Wizualizacje"
      },
      { key: "branding", href: "branding.html", icon: "uil-palette", label: "Branding" },
      { key: "projects", href: "index.html", icon: "uil-box", label: "Projekty" },
      { key: "inbox", href: "inbox.html", icon: "uil-envelope", label: "Wiadomosci" },
      { key: "tasks", href: "tasks.html", icon: "uil-check-square", label: "Zadania" },
      { key: "invoices", href: "invoices.html", icon: "uil-invoice", label: "Faktury" },
      { key: "costs", href: "costs.html", icon: "uil-calculator-alt", label: "Koszty" },
      {
        key: "integrations",
        href: "integrations.html",
        icon: "uil-plug",
        label: "Integracja i produkcja"
      },
      { key: "dashboard", href: "dashboard.html", icon: "uil-apps", label: "Dashboard" }
    ];
  }

  function quickLinksPool() {
    var items = [];
    try {
      if (global.DamShell && typeof DamShell.getNavItems === "function") {
        items = DamShell.getNavItems() || [];
      }
    } catch (e) {
      items = [];
    }
    if (!items.length) items = quickLinksFallbackPool();
    return items.map(function (it) {
      var key = String(it.key || "");
      var short = QL_SHORT_LABELS[key] || it.label || key;
      return {
        key: key,
        href: String(it.href || ""),
        icon: String(it.icon || "uil-link").replace(/^uil\s+/, ""),
        label: String(it.label || short),
        shortLabel: short
      };
    }).filter(function (it) {
      return it.key && it.href;
    });
  }

  function quickLinksStorageKey() {
    return QL_STORAGE_PREFIX + userKey();
  }

  function loadQuickLinkKeys() {
    var pool = quickLinksPool();
    var known = {};
    pool.forEach(function (p) {
      known[p.key] = true;
    });
    try {
      var raw = localStorage.getItem(quickLinksStorageKey());
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          var filtered = parsed
            .map(function (k) {
              return String(k || "");
            })
            .filter(function (k) {
              return known[k];
            });
          if (filtered.length) return filtered;
        }
      }
    } catch (e) { /* ignore */ }
    return QL_DEFAULT_KEYS.filter(function (k) {
      return known[k];
    });
  }

  function saveQuickLinkKeys(keys) {
    try {
      localStorage.setItem(quickLinksStorageKey(), JSON.stringify(keys || []));
    } catch (e) { /* ignore */ }
  }

  function resolveQuickLinks(keys) {
    var byKey = {};
    quickLinksPool().forEach(function (p) {
      byKey[p.key] = p;
    });
    var out = [];
    (keys || []).forEach(function (k) {
      if (byKey[k]) out.push(byKey[k]);
    });
    return out;
  }

  function buildQuickLinksBodyHtml() {
    var items = resolveQuickLinks(loadQuickLinkKeys());
    var chips = items
      .map(function (it) {
        var icon = it.icon.indexOf("uil-") === 0 ? it.icon : "uil-" + it.icon;
        return (
          '<div class="dam-ql-chip" data-ql-key="' +
          escapeHtml(it.key) +
          '">' +
          '<a class="dam-ql-chip__link" href="' +
          escapeHtml(it.href) +
          '">' +
          '<i class="uil ' +
          escapeHtml(icon) +
          '" aria-hidden="true"></i>' +
          "<span>" +
          escapeHtml(it.shortLabel || it.label) +
          "</span></a>" +
          '<button type="button" class="dam-ql-chip__remove" data-ql-remove="' +
          escapeHtml(it.key) +
          '" aria-label="Usun skrot ' +
          escapeHtml(it.shortLabel || it.label) +
          '" data-dam-tip="Przytrzymaj 1,5 s, aby usunac skrot" data-dam-hold-delete' +
          ' data-dam-hold-ms="1500" data-dam-label="Usun skrot"' +
          ' data-dam-hint="Przytrzymaj 1,5 s, aby usunac skrot">' +
          '<i class="uil uil-times" aria-hidden="true"></i></button></div>'
        );
      })
      .join("");
    return (
      '<div class="dam-widget__links dam-widget__links--chips" data-links-root="1">' +
      chips +
      '<button type="button" class="dam-ql-plus" data-ql-plus="1" aria-label="Dodaj skrot" ' +
      'aria-haspopup="dialog" data-dam-tip="Dodaj skrot z listy stron DAM">' +
      '<i class="uil uil-plus" aria-hidden="true"></i></button></div>'
    );
  }

  function closeQuickLinksPicker() {
    if (_qlPickerCloseBound) {
      document.removeEventListener("mousedown", _qlPickerCloseBound, true);
      document.removeEventListener("keydown", _qlPickerCloseBound, true);
      _qlPickerCloseBound = null;
    }
    if (_qlPickerEl && _qlPickerEl.parentNode) {
      _qlPickerEl.parentNode.removeChild(_qlPickerEl);
    }
    _qlPickerEl = null;
    document.querySelectorAll(".dam-ql-plus[aria-expanded='true']").forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
    });
  }

  function renderQuickLinksPickerList(listEl, query, selectedKeys) {
    if (!listEl) return;
    var q = String(query || "")
      .trim()
      .toLowerCase();
    var selected = {};
    (selectedKeys || []).forEach(function (k) {
      selected[k] = true;
    });
    var rows = quickLinksPool().filter(function (it) {
      if (!q) return true;
      var hay = (it.label + " " + it.shortLabel + " " + it.key + " " + it.href).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    if (!rows.length) {
      listEl.innerHTML =
        '<p class="dam-ql-picker__empty">Brak stron dla tego wyszukiwania.</p>';
      return;
    }
    listEl.innerHTML = rows
      .map(function (it) {
        var icon = it.icon.indexOf("uil-") === 0 ? it.icon : "uil-" + it.icon;
        var on = !!selected[it.key];
        return (
          '<button type="button" class="dam-ql-picker__item' +
          (on ? " is-selected" : "") +
          '" data-ql-pick="' +
          escapeHtml(it.key) +
          '"' +
          (on ? " disabled aria-disabled=\"true\"" : "") +
          ">" +
          '<i class="uil ' +
          escapeHtml(icon) +
          '" aria-hidden="true"></i>' +
          '<span class="dam-ql-picker__label">' +
          escapeHtml(it.label) +
          "</span>" +
          (on
            ? '<i class="uil uil-check dam-ql-picker__check" aria-hidden="true"></i>'
            : "") +
          "</button>"
        );
      })
      .join("");
  }

  function openQuickLinksPicker(anchorBtn, widget) {
    closeQuickLinksPicker();
    if (!anchorBtn || !widget) return;
    var pop = document.createElement("div");
    pop.className = "dam-ql-picker";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Dodaj skrot");
    pop.innerHTML =
      '<div class="dam-ql-picker__head">' +
      "<strong>Dodaj skrot</strong>" +
      '<button type="button" class="dam-ql-picker__close" data-ql-picker-close aria-label="Zamknij">' +
      '<i class="uil uil-times" aria-hidden="true"></i></button></div>' +
      '<div class="dam-ql-picker__search-wrap">' +
      '<i class="uil uil-search" aria-hidden="true"></i>' +
      '<input type="search" class="dam-ql-picker__search" placeholder="Szukaj strony…" autocomplete="off" />' +
      "</div>" +
      '<div class="dam-ql-picker__list" role="listbox"></div>' +
      '<p class="dam-ql-picker__hint">Tylko istniejace strony DAM. Bez nowych URL.</p>';
    document.body.appendChild(pop);
    _qlPickerEl = pop;
    anchorBtn.setAttribute("aria-expanded", "true");

    var listEl = pop.querySelector(".dam-ql-picker__list");
    var searchEl = pop.querySelector(".dam-ql-picker__search");
    var keys = loadQuickLinkKeys();
    renderQuickLinksPickerList(listEl, "", keys);

    function place() {
      var r = anchorBtn.getBoundingClientRect();
      var pw = Math.min(320, Math.max(260, window.innerWidth - 24));
      var left = Math.min(Math.max(12, r.left), window.innerWidth - pw - 12);
      var top = r.bottom + 8;
      var maxH = Math.min(360, window.innerHeight - top - 16);
      if (maxH < 180 && r.top > 200) {
        top = Math.max(12, r.top - Math.min(360, r.top - 12) - 8);
        maxH = Math.min(360, r.top - 20);
      }
      pop.style.width = pw + "px";
      pop.style.left = left + "px";
      pop.style.top = top + "px";
      pop.style.maxHeight = maxH + "px";
    }
    place();

    pop.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-ql-picker-close]")) {
        closeQuickLinksPicker();
        return;
      }
      var pick = ev.target.closest("[data-ql-pick]");
      if (!pick || pick.disabled) return;
      var key = pick.getAttribute("data-ql-pick");
      if (!key) return;
      var next = loadQuickLinkKeys().slice();
      if (next.indexOf(key) >= 0) return;
      next.push(key);
      saveQuickLinkKeys(next);
      refreshQuickLinksWidget(widget);
      closeQuickLinksPicker();
    });

    if (searchEl) {
      searchEl.addEventListener("input", function () {
        renderQuickLinksPickerList(listEl, searchEl.value, loadQuickLinkKeys());
      });
      setTimeout(function () {
        try {
          searchEl.focus();
        } catch (e) { /* ignore */ }
      }, 0);
    }

    _qlPickerCloseBound = function (ev) {
      if (ev.type === "keydown" && ev.key === "Escape") {
        closeQuickLinksPicker();
        return;
      }
      if (ev.type === "mousedown") {
        if (pop.contains(ev.target) || anchorBtn.contains(ev.target)) return;
        closeQuickLinksPicker();
      }
    };
    document.addEventListener("mousedown", _qlPickerCloseBound, true);
    document.addEventListener("keydown", _qlPickerCloseBound, true);
    window.addEventListener(
      "resize",
      function onR() {
        if (!_qlPickerEl) {
          window.removeEventListener("resize", onR);
          return;
        }
        place();
      },
      { passive: true }
    );
  }

  function refreshQuickLinksWidget(widget) {
    if (!widget) return;
    var body = widget.querySelector(".dam-widget__body");
    if (!body) return;
    body.innerHTML = buildQuickLinksBodyHtml();
    bindQuickLinksWidget(widget);
    syncQuickLinksLayout(widget);
  }

  function bindQuickLinksWidget(widget) {
    if (!widget || widget.getAttribute("data-ql-bound") === "1") {
      /* re-bind after refresh: clear flag first */
    }
    widget.setAttribute("data-ql-bound", "1");
    if (widget._qlClickHandler) {
      widget.removeEventListener("click", widget._qlClickHandler);
    }
    widget._qlClickHandler = function (ev) {
      var rm = ev.target.closest("[data-ql-remove]");
      if (rm) {
        ev.preventDefault();
        ev.stopPropagation();
        var key = rm.getAttribute("data-ql-remove");
        var next = loadQuickLinkKeys().filter(function (k) {
          return k !== key;
        });
        saveQuickLinkKeys(next);
        refreshQuickLinksWidget(widget);
        return;
      }
      var plus = ev.target.closest("[data-ql-plus]");
      if (plus) {
        ev.preventDefault();
        ev.stopPropagation();
        if (plus.getAttribute("aria-expanded") === "true") {
          closeQuickLinksPicker();
        } else {
          openQuickLinksPicker(plus, widget);
        }
      }
    };
    widget.addEventListener("click", widget._qlClickHandler);
  }

  /**
   * quick_links adaptive layout from bento aspect:
   * wide → row wrap; narrow → column wrap. Chips stay compact (no stretch).
   */
  function syncQuickLinksLayout(mountOrEl) {
    var root = mountOrEl || document.getElementById("damDashGrid");
    if (!root) return;
    var widget =
      root.getAttribute && root.getAttribute("data-widget-id") === "quick_links"
        ? root
        : root.querySelector
          ? root.querySelector('[data-widget-id="quick_links"]')
          : null;
    if (!widget) return;
    var links = widget.querySelector(".dam-widget__links");
    if (!links) return;
    var w =
      parseInt(widget.style.getPropertyValue("--bento-w"), 10) ||
      parseInt(
        (global.getComputedStyle(widget).getPropertyValue("--bento-w") || "").trim(),
        10
      ) ||
      3;
    var h =
      parseInt(widget.style.getPropertyValue("--bento-h"), 10) ||
      parseInt(
        (global.getComputedStyle(widget).getPropertyValue("--bento-h") || "").trim(),
        10
      ) ||
      4;
    if (!(w > 0 && h > 0)) {
      var rect = widget.getBoundingClientRect();
      if (rect.width > 8 && rect.height > 8) {
        w = rect.width;
        h = rect.height;
      }
    }
    var horizontal = w >= h;
    links.classList.toggle("dam-widget__links--horizontal", horizontal);
    links.classList.toggle("dam-widget__links--vertical", !horizontal);
    links.classList.add("dam-widget__links--chips");
    widget.setAttribute("data-links-layout", horizontal ? "horizontal" : "vertical");
    widget.classList.toggle("dam-widget--links-h", horizontal);
    widget.classList.toggle("dam-widget--links-v", !horizontal);
  }

  function dashBentoItemsOverlap(items) {
    var ids = Object.keys(items || {}).filter(function (id) {
      return items[id] && !items[id].spacer;
    });
    function ov(a, b) {
      return !(
        a.c + a.w - 1 < b.c ||
        b.c + b.w - 1 < a.c ||
        a.r + a.h - 1 < b.r ||
        b.r + b.h - 1 < a.r
      );
    }
    var i;
    var j;
    for (i = 0; i < ids.length; i++) {
      for (j = i + 1; j < ids.length; j++) {
        if (ov(items[ids[i]], items[ids[j]])) return true;
      }
    }
    return false;
  }

  /** Compact mins so viz+products+branding+bottom band fit MAX_ROWS=32 without overlap. */
  function compactDashMinSizes() {
    var base =
      global.DamBentoResize && DamBentoResize.DEFAULT_MIN_SIZES
        ? DamBentoResize.DEFAULT_MIN_SIZES
        : {};
    return Object.assign({}, base, {
      newest_viz_3: { w: 9, h: mediaLayoutMinH(getTileLayout("newest_viz_3")) },
      newest_products_f: {
        w: 9,
        h: mediaLayoutMinH(getTileLayout("newest_products_f")),
      },
      branding_latest: {
        w: 9,
        h: mediaLayoutMinH(getTileLayout("branding_latest")),
      },
      notify_new_viz: { w: 3, h: 4 },
      quick_links: { w: 9, h: 2 },
      checklists_ok: { w: 3, h: 4 },
    });
  }

  /**
   * Repair persisted bento when row sum exceeds grid (overlap at branding/notify/quick band).
   * Re-stacks media column and places quick_links + checklists_ok side-by-side on last row.
   */
  function repairDashBentoLayout(mount) {
    var BR = global.DamBentoResize;
    if (!BR || !mount || typeof BR.loadLayout !== "function") return false;
    var scope = "dashboard";
    var saved = BR.loadLayout(scope);
    if (!saved || !saved.items) return false;

    var layoutVersion =
      BR.BENTO_LAYOUT_VERSION != null ? BR.BENTO_LAYOUT_VERSION : 2;

    var ids = []
      .map.call(mount.querySelectorAll(".dam-widget[data-widget-id]"), function (el) {
        return el.getAttribute("data-widget-id");
      })
      .filter(Boolean);

    var minSizes = compactDashMinSizes();
    var opts = { scope: scope, minSizes: minSizes };
    var items = {};
    var needsRepair =
      saved.version == null ||
      saved.version < layoutVersion ||
      dashBentoItemsOverlap(saved.items);

    ids.forEach(function (id) {
      if (!saved.items[id]) return;
      var el = mount.querySelector('[data-widget-id="' + id + '"]');
      var mins = BR.getMinSize(id, opts, el, saved.items[id]);
      var it = saved.items[id];
      var isMedia = !!MEDIA_TILE_WIDGETS[id];
      if (!isMedia && (it.h > mins.h + 1 || it.w < mins.w)) needsRepair = true;
      if (isMedia && it.w < mins.w) needsRepair = true;
      items[id] = {
        c: it.c || 1,
        r: it.r || 1,
        w: Math.max(mins.w, it.w || mins.w),
        h: isMedia
          ? Math.max(mins.h, it.h || mins.h)
          : Math.max(mins.h, Math.min(it.h || mins.h, mins.h + 1)),
      };
    });

    if (!needsRepair && !dashBentoItemsOverlap(items)) return false;

    ["products_count", "projects_this_month", "projects_in_progress"].forEach(function (sid, idx) {
      if (!items[sid]) return;
      items[sid] = { c: 1 + idx * 3, r: 1, w: 3, h: 3 };
    });

    var row = 4;
    if (items.newest_viz_3) {
      items.newest_viz_3 = { c: 1, r: row, w: 9, h: items.newest_viz_3.h };
      row += items.newest_viz_3.h;
    }
    if (items.newest_products_f) {
      items.newest_products_f = { c: 1, r: row, w: 9, h: items.newest_products_f.h };
      row += items.newest_products_f.h;
    }
    if (items.branding_latest) {
      items.branding_latest = { c: 1, r: row, w: 9, h: items.branding_latest.h };
      row += items.branding_latest.h;
    }
    /* Bottom band: notify | checklists same row+height; quick_links full width under. */
    var bandH = Math.max(
      minSizes.notify_new_viz.h,
      minSizes.checklists_ok.h,
      4
    );
    if (items.notify_new_viz) {
      items.notify_new_viz = { c: 1, r: row, w: 3, h: bandH };
    }
    if (items.checklists_ok) {
      items.checklists_ok = { c: 7, r: row, w: 3, h: bandH };
    }
    row += bandH;
    if (items.quick_links) {
      items.quick_links = {
        c: 1,
        r: row,
        w: 9,
        h: minSizes.quick_links.h,
      };
      row += minSizes.quick_links.h;
    }
    if (items.asana_home) {
      items.asana_home = {
        c: 1,
        r: row,
        w: 9,
        h: (minSizes.asana_home && minSizes.asana_home.h) || 8,
      };
    }

    if (typeof BR.enforceMinsAndReflow === "function") {
      items = BR.enforceMinsAndReflow(items, ids, opts, mount);
    }
    if (dashBentoItemsOverlap(items) && typeof BR.packDefaults === "function") {
      var spans = {};
      ids.forEach(function (id) {
        if (!items[id]) return;
        var m2 = BR.getMinSize(id, opts, mount.querySelector('[data-widget-id="' + id + '"]'), items[id]);
        spans[id] = { w: m2.w, h: m2.h };
      });
      items = BR.packDefaults(
        ids.filter(function (id) {
          return !!spans[id];
        }),
        spans
      );
      if (typeof BR.enforceMinsAndReflow === "function") {
        items = BR.enforceMinsAndReflow(items, ids, opts, mount);
      }
    }

    if (dashBentoItemsOverlap(items)) {
      try {
        localStorage.removeItem(BR.storageKey(scope));
      } catch (eClr) {
        /* ignore */
      }
      return false;
    }

    if (typeof BR.saveLayout === "function") {
      BR.saveLayout(scope, items);
    }
    return true;
  }

  function mountDashBento(mount, mountOpts) {
    if (!mount || !global.DamBentoResize || typeof DamBentoResize.mount !== "function") {
      return;
    }
    mountOpts = mountOpts || {};
    var preserveReveal = !!mountOpts.preserveReveal;
    var opts = {
      scope: "dashboard",
      itemSelector: ".dam-widget[data-widget-id]",
      idAttr: "data-widget-id",
      noStretchIds: [],
      spacers: true,
      stackOnNarrow: false,
      minSizes: compactDashMinSizes(),
      defaults:
        global.DamBentoResize &&
        typeof DamBentoResize.defaultDashboardLayout === "function"
          ? DamBentoResize.defaultDashboardLayout()
          : null,
      onLayout: function () {
        syncQuickLinksLayout(mount);
      },
      onChange: function () {
        syncQuickLinksLayout(mount);
      },
      onResizePreview: function () {
        syncQuickLinksLayout(mount);
      }
    };

    function collectNoStretch() {
      var noStretch = [];
      var customizeOn =
        document.body && document.body.classList.contains("dam-dash-customize-on");
      mount.querySelectorAll(".dam-widget").forEach(function (el) {
        var id = el.getAttribute("data-widget-id");
        if (!id) return;
        el.setAttribute("data-bento-id", id);
        if (
          el.classList.contains("dam-widget--strip") ||
          el.classList.contains("dam-widget--stat") ||
          el.classList.contains("dam-widget--sm") ||
          el.classList.contains("dam-widget--media-latest") ||
          MEDIA_TILE_WIDGETS[id]
        ) {
          noStretch.push(id);
        }
        /*
         * Skeleton / customize: force visible.
         * Final boot: leave opacity alone so revealSequence can fade+translate.
         * Never leave collapsing clip-path in rest state (IO doctrine).
         */
        if (!preserveReveal || customizeOn) {
          el.style.setProperty("opacity", "1", "important");
        } else {
          el.style.removeProperty("opacity");
        }
        el.style.setProperty("clip-path", "none", "important");
        el.style.setProperty("-webkit-clip-path", "none", "important");
      });
      opts.noStretchIds = noStretch;
    }

    function widgetSig() {
      return [].map
        .call(mount.querySelectorAll(".dam-widget[data-widget-id]"), function (el) {
          return el.getAttribute("data-widget-id");
        })
        .join("|");
    }

    var lastSig = "";
    var applying = false;

    function apply() {
      if (applying) return;
      var sig = widgetSig();
      applying = true;
      try {
        repairDashBentoLayout(mount);
        collectNoStretch();
        DamBentoResize.mount(mount, opts);
        syncQuickLinksLayout(mount);
        scheduleSyncMediaTileHeights();
        lastSig = sig;
      } finally {
        applying = false;
      }
    }

    mount._damBentoRemount = apply;
    apply();
    /* Async shells (branding/viz) replace outerHTML after first paint - remount */
    if (mount._damBentoRemountTimers) {
      mount._damBentoRemountTimers.forEach(function (t) {
        clearTimeout(t);
      });
    }
    mount._damBentoRemountTimers = [
      setTimeout(apply, 400),
      setTimeout(apply, 1200),
      setTimeout(apply, 2800)
    ];

    if (!mount._damBentoMo) {
      var moTimer = null;
      mount._damBentoMo = new MutationObserver(function (mutations) {
        if (applying) return;
        var relevant = mutations.some(function (m) {
          var nodes = [].slice
            .call(m.addedNodes)
            .concat([].slice.call(m.removedNodes));
          return nodes.some(function (n) {
            return (
              n.nodeType === 1 &&
              n.classList &&
              n.classList.contains("dam-widget")
            );
          });
        });
        if (!relevant) return;
        if (moTimer) clearTimeout(moTimer);
        moTimer = setTimeout(apply, 120);
      });
      mount._damBentoMo.observe(mount, { childList: true, subtree: false });
    }
  }

  function renderGrid(mount, ctx) {
    if (!mount) return;
    ctx = ctx || {};
    var isSkeleton = !!ctx.dashLoading;
    defineWidgets();
    var layout = loadLayout();
    var order = layout.order.slice();
    mount.innerHTML = "";
    mount.setAttribute("data-dash-boot", isSkeleton ? "skeleton" : "ready");
    var bleed = document.getElementById("damDashAsanaBleed");
    if (bleed) {
      bleed.innerHTML = "";
      bleed.hidden = true;
    }
    order.forEach(function (id) {
      var w = findWidget(id);
      if (!w || !allowedForRole(w)) return;
      var placeholder = document.createElement("div");
      placeholder.dataset.widgetId = id;
      mount.appendChild(placeholder);
      try {
        w.render(placeholder, ctx);
      } catch (e) {
        console.warn("DAM widget fail", id, e);
        placeholder.outerHTML = shell(
          w,
          '<p class="dam-widget__meta">Błąd renderu widgetu</p>'
        );
      }
    });
    placeAsanaHomeBleed();
    ensureDashWinDelegation(mount);
    if (global.DamIcons && typeof DamIcons.bindWinButtons === "function") {
      DamIcons.bindWinButtons(mount);
    }
    if (global.DamBadges && typeof DamBadges.bindClicks === "function") {
      DamBadges.bindClicks(mount);
    }
    /* Final paint: preserve opacity for fade/translate entrance */
    mountDashBento(mount, { preserveReveal: !isSkeleton });
    if (mount && !mount._damDashPreviewBound) {
      mount._damDashPreviewBound = true;
      mount.addEventListener(
        "click",
        function (e) {
          var previewEl =
            e.target && e.target.closest
              ? e.target.closest("[data-dash-preview], .dam-viz-icon-btn--viz")
              : null;
          if (!previewEl || !mount.contains(previewEl)) return;
          if (previewEl.classList.contains("dam-win-btn")) return;
          var row = previewEl.closest("[data-dash-asset]");
          var raw = row && row.getAttribute("data-dash-asset");
          if (
            raw &&
            global.DamMediaPreview &&
            typeof DamMediaPreview.openAsset === "function"
          ) {
            try {
              var asset = JSON.parse(raw);
              if (asset && asset.path) {
                e.preventDefault();
                e.stopPropagation();
                DamMediaPreview.openAsset(asset, { siblings: [asset], index: 0 });
                return;
              }
            } catch (err) {
              /* fall through to href */
            }
          }
          var href = previewEl.getAttribute("href") || "";
          if (href && previewEl.tagName === "A") {
            /* native navigation */
            return;
          }
          if (href) {
            e.preventDefault();
            window.location.href = href;
          }
        },
        true
      );
    }
    if (isSkeleton) return;
    /* One entrance: fade + translate ~0.4s (no clip-path rest; doctrine-safe) */
    if (
      window.DamGridReveal &&
      typeof DamGridReveal.revealSequence === "function" &&
      DamGridReveal.selectors &&
      DamGridReveal.selectors.dashboardWidget
    ) {
      DamGridReveal.revealSequence(mount, DamGridReveal.selectors.dashboardWidget, {
        mode: "slide",
        duration: 0.4,
        stagger: 0.04,
        y: 10
      });
      setTimeout(function () {
        ensureDashThumbReveal(mount);
      }, 500);
      setTimeout(function () {
        ensureDashThumbReveal(mount);
      }, 1500);
    } else if (window.DamGridReveal) {
      window.DamGridReveal.reveal(mount, window.DamGridReveal.selectors.dashboardWidget, {
        duration: 0.4
      });
    }
  }

  /* ---------- customize modal ---------- */

  /* Tips for tucked metka — Dobrokaloriuś points at the side tab. */
  var DASH_MASCOT_TIPS = [
    "Widzisz te mala metke z boku? Kliknij ja, zeby wysunac panel Dostosuj.",
    "Jezyczek po lewej chowa i pokazuje liste kart - jak zakladka w ksiazce.",
    "Schowaj panel w lewo, by widziec cala siatke, a metka zostanie z boku.",
    "Przeciagnij uchwyty na kartach, aby zmienic uklad pulpitu.",
    "Wlacz tylko te widgety, z ktorych korzystasz na co dzien.",
    "Kolejnosc kart ustawisz strzalkami lub przeciaganiem.",
    "Podglad pokazuje szkic karty zanim zapiszesz zmiany.",
    "Anuluj przywraca stan sprzed edycji bez zapisu.",
    "Przywroc domyslne wraca do fabrycznego ukladu kart.",
    "Zapisz dopiero gdy uklad kart jest gotowy do pracy."
  ];
  global.__damDashMascotTips = DASH_MASCOT_TIPS;
  /* v2: after metka UX change, show tips again even if old dismiss was set. */
  var MASCOT_DISMISS_KEY = "dam.dashCustomize.mascotDismissed.v2";

  function mascotDismissed() {
    try {
      return localStorage.getItem(MASCOT_DISMISS_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function dismissDashMascot() {
    try {
      localStorage.setItem(MASCOT_DISMISS_KEY, "1");
    } catch (err) { /* ignore */ }
    var tip = document.getElementById("damDashMascotTip");
    if (tip) tip.remove();
  }

  function dashMascotPoseUrl(poseToken) {
    var file = "pose-" + (poseToken || "2") + ".png";
    try {
      return new URL("assets/img/maskotka/" + file, global.location.href).href;
    } catch (err) {
      return "assets/img/maskotka/" + file;
    }
  }

  function ensureDashMascotTip(modal) {
    if (!modal || mascotDismissed()) return;
    /* Tip must live on dock (outside panel overflow:hidden) or it gets clipped when tucked. */
    var dock = modal.querySelector(".dam-dash-modal__dock");
    if (!dock) return;
    var existing = document.getElementById("damDashMascotTip");
    if (existing) existing.remove();
    var idx = Math.floor(Math.random() * DASH_MASCOT_TIPS.length);
    var tip = document.createElement("div");
    tip.id = "damDashMascotTip";
    tip.className = "dam-dash-modal__mascot-tip";
    tip.setAttribute("role", "note");
    tip.setAttribute("aria-label", "Podpowiedz Dobrokaloriusia");
    /* Same leaf sprite as tutorial companion — never text-only "Dobrokaloriuś". */
    tip.style.setProperty("--dam-dash-mascot-pose", "url('" + dashMascotPoseUrl(2) + "')");
    tip.innerHTML =
      '<div class="dam-dash-modal__mascot-figure" aria-hidden="true">' +
        '<span class="dam-dash-modal__mascot-img"></span>' +
      "</div>" +
      '<div class="dam-dash-modal__mascot-body">' +
        "<p>" + DASH_MASCOT_TIPS[idx] + "</p>" +
        '<button type="button" class="dam-dash-modal__mascot-dismiss" data-dam-mascot-dismiss="1">Nie pokazuj wi\u0119cej</button>' +
      "</div>";
    dock.appendChild(tip);
    tip.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-dam-mascot-dismiss]")) {
        e.preventDefault();
        e.stopPropagation();
        dismissDashMascot();
      }
    });
  }

  var PREVIEW_MS = 350;
  var _previewQueue = Promise.resolve();
  var _previewActiveId = "";
  var _previewHideTimer = null;
  var _baselineSnapshot = "";
  var _confirmOpen = false;

  function snapshotDraft() {
    if (!draftOrder) return "";
    return JSON.stringify(
      draftOrder.map(function (r) {
        return { id: r.id, on: !!r.on };
      })
    );
  }

  function syncDraftFromChecks(modal) {
    if (!draftOrder || !modal) return;
    var onMap = {};
    modal.querySelectorAll('input[type="checkbox"][data-id]').forEach(function (c) {
      onMap[c.getAttribute("data-id")] = c.checked;
    });
    draftOrder.forEach(function (row) {
      row.on = !!onMap[row.id];
    });
  }

  function isDraftDirty(modal) {
    syncDraftFromChecks(modal);
    return snapshotDraft() !== _baselineSnapshot;
  }

  function setLayoutEditMode(on) {
    var body = document.body;
    if (!body) return;
    body.classList.toggle("dam-bento-layout-edit", !!on);
    body.classList.toggle("dam-dash-customize-on", !!on);
  }

  function setDrawerExpanded(modal, expanded) {
    if (!modal) return;
    modal.classList.toggle("is-drawer-tucked", !expanded);
    modal.classList.toggle("is-drawer-expanded", !!expanded);
    modal.setAttribute("aria-modal", expanded ? "true" : "false");
    var stage = modal.querySelector(".dam-dash-modal__stage");
    if (stage) {
      /* Kill transition first - otherwise used transform can stick at prior matrix. */
      stage.style.transition = "none";
      var w = stage.offsetWidth || 600;
      /* Tucked: panel fully off-screen; metka tab (absolute right:-36px) stays in view. */
      var tx = expanded ? 0 : Math.round(0 - w);
      stage.style.transform = "translateX(" + tx + "px)";
      void stage.offsetWidth;
      stage.style.transition = "";
    }
    var backdrop = modal.querySelector(".dam-dash-modal__backdrop");
    if (backdrop) {
      backdrop.style.transition = "none";
      backdrop.style.opacity = expanded ? "1" : "0";
      backdrop.style.pointerEvents = expanded ? "auto" : "none";
      void backdrop.offsetWidth;
      backdrop.style.transition = "";
    }
    var toggle = document.getElementById("damDashDrawerToggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.setAttribute(
        "aria-label",
        expanded ? "Schowaj panel Dostosuj" : "Rozwin panel Dostosuj"
      );
      toggle.title = expanded ? "Schowaj panel" : "Rozwin panel";
      var icon = toggle.querySelector("i");
      if (icon) {
        icon.className = expanded ? "uil uil-angle-left" : "uil uil-angle-right";
      }
    }
    var mascot = document.getElementById("damDashMascotTip");
    if (mascot) {
      mascot.hidden = !!expanded;
      mascot.style.display = expanded ? "none" : "";
    }
  }

  function ensureModal() {
    var existing = document.getElementById("damDashCustomize");
    var toggle = existing && existing.querySelector("#damDashDrawerToggle");
    var toggleInDock =
      toggle && toggle.parentElement &&
      toggle.parentElement.classList.contains("dam-dash-modal__dock");
    /* Recreate when missing shell, legacy peek, or toggle still inside panel (clipped). */
    if (
      existing &&
      (!existing.querySelector(".dam-dash-modal__stage") ||
        !existing.querySelector(".dam-dash-modal__scroll") ||
        !toggle ||
        !toggleInDock ||
        existing.querySelector("#damDashDrawerPeek"))
    ) {
      existing.remove();
      existing = null;
    }
    if (existing) return existing;
    var wrap = document.createElement("div");
    wrap.id = "damDashCustomize";
    wrap.className = "dam-dash-modal dam-dash-modal--drawer is-drawer-tucked";
    wrap.hidden = true;
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "false");
    wrap.setAttribute("aria-labelledby", "damDashCustomizeTitle");
    wrap.innerHTML =
      '<div class="dam-dash-modal__backdrop" data-dam-close="1"></div>' +
      '<div class="dam-dash-modal__stage">' +
      '<div class="dam-dash-modal__dock">' +
      '<div class="dam-dash-modal__panel">' +
      '<div class="dam-dash-modal__head">' +
      '<h3 id="damDashCustomizeTitle">Dostosuj pulpit</h3>' +
      "<p>Tryb edycji ukladu: przeciagnij uchwyty na widgetach. Tutaj wlacz/wylacz karty i ustaw kolejnosc. Panel mozesz schowac do metki z lewej, zeby swobodnie przesuwac kafelki.</p>" +
      "</div>" +
      '<div class="dam-dash-modal__scroll">' +
      '<ul class="dam-dash-modal__list" id="damDashCustomizeList"></ul>' +
      "</div>" +
      '<div class="dam-dash-modal__footer">' +
      '<button type="button" class="geex-btn geex-btn--ghost" id="damDashReset">Przywroc domyslne</button>' +
      '<button type="button" class="geex-btn geex-btn--secondary" data-dam-close="1">Anuluj</button>' +
      '<button type="button" class="geex-btn geex-btn--primary" id="damDashSave">Zapisz</button>' +
      "</div></div>" +
      '<button type="button" class="dam-dash-modal__drawer-toggle" id="damDashDrawerToggle" ' +
      'aria-expanded="false" aria-controls="damDashCustomize" aria-label="Rozwin panel Dostosuj" ' +
      'title="Rozwin panel" data-dam-tip="Rozwin panel">' +
      '<i class="uil uil-angle-right" aria-hidden="true"></i>' +
      "</button></div>" +
      '<aside class="dam-dash-modal__preview" id="damDashPreview" aria-live="polite" hidden>' +
      '<div class="dam-dash-modal__preview-inner" id="damDashPreviewInner"></div>' +
      "</aside></div>" +
      '<div class="dam-dash-modal__confirm" id="damDashDirtyConfirm" hidden>' +
      '<div class="dam-dash-modal__confirm-card" role="alertdialog" aria-labelledby="damDashDirtyTitle">' +
      '<h4 id="damDashDirtyTitle">Czy chcesz porzuci\u0107 zmiany?</h4>' +
      "<p>Masz niezapisane wybory. Mo\u017cesz je zapisa\u0107, odrzuci\u0107 albo wr\u00f3ci\u0107 do edycji.</p>" +
      '<div class="dam-dash-modal__confirm-actions dam-dialog-actions">' +
      '<button type="button" class="geex-btn geex-btn--secondary" data-dirty="discard">Odrzu\u0107</button>' +
      '<button type="button" class="geex-btn geex-btn--ghost" data-dirty="back">Nie, wr\u00f3\u0107</button>' +
      '<span class="dam-dialog-actions__spacer" aria-hidden="true"></span>' +
      '<button type="button" class="geex-btn geex-btn--primary" data-dirty="save">Zapisz zmiany</button>' +
      "</div></div></div>";
    document.body.appendChild(wrap);
    return wrap;
  }

  function buildDraftFromLayout() {
    defineWidgets();
    var layout = loadLayout();
    var on = {};
    layout.order.forEach(function (id) {
      on[id] = true;
    });
    draftOrder = allIds()
      .filter(function (id) {
        var w = findWidget(id);
        return w && allowedForRole(w);
      })
      .sort(function (a, b) {
        var ia = layout.order.indexOf(a);
        var ib = layout.order.indexOf(b);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
      .map(function (id) {
        return { id: id, on: !!on[id] };
      });
  }

  /**
   * Honest wireframe for customize-modal PODGLAD.
   * Neutral gray (#e8e8ee) per-object skeleton matching real widget geometry.
   */
  function previewMockHtml(widgetId) {
    var id = String(widgetId || "");
    function skLine(w, shortCls) {
      return (
        '<span class="dam-widget-skel__line' +
        (shortCls ? " dam-widget-skel__line--short" : "") +
        '" style="width:' +
        (w || "62%") +
        ';max-width:none;margin-bottom:' +
        (shortCls ? "0" : "6px") +
        '"></span>'
      );
    }
    function skRow(leftW, rightW) {
      return (
        '<div class="dam-dash-preview-card__row">' +
        skLine(leftW || "62%") +
        skLine(rightW || "22%", true) +
        "</div>"
      );
    }
    function listRows(n, lefts, rights) {
      var out = "";
      var i;
      for (i = 0; i < n; i++) {
        out += skRow(
          (lefts && lefts[i]) || (70 - i * 6) + "%",
          (rights && rights[i]) || "20%"
        );
      }
      return out;
    }
    function barTrack(pct) {
      return (
        '<div class="dam-dash-preview-card__bar-row">' +
        skLine("18%", true) +
        '<span class="dam-dash-preview-card__track"><i style="width:' +
        (pct || "60%") +
        '"></i></span>' +
        skLine("12%", true) +
        "</div>"
      );
    }
    function skMetric(wide) {
      return (
        '<span class="dam-widget-skel__line' +
        (wide ? " dam-dash-preview-card__metric--wide" : "") +
        '" style="height:28px;width:' +
        (wide ? "72%" : "40%") +
        ';max-width:none;border-radius:8px;margin-bottom:8px"></span>'
      );
    }
    function skChip() {
      return (
        '<span class="dam-widget-skel__line" style="width:72px;height:20px;border-radius:999px;max-width:none;margin:4px 0 0"></span>'
      );
    }

    switch (id) {
      case "products_count":
      case "asana_open":
      case "checklists_ok":
      case "checklists_gap":
      case "projects_this_month":
      case "projects_in_progress":
      case "tasks_overdue":
      case "viz_flags":
      case "missing_thumbs":
      case "demo_vs_prod":
      case "efficiency_mock":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--stat dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          skMetric(false) +
          skLine("42%", true) +
          "</div>"
        );

      case "cost_month":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--stat dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          skMetric(true) +
          skLine("68%") +
          skChip() +
          "</div>"
        );

      case "sales_mock":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--stat dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          skMetric(true) +
          skLine("55%") +
          skChip() +
          "</div>"
        );
      case "index_health":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--stat dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          skMetric(false) +
          skLine("78%") +
          "</div>"
        );

      /* Asana home: task list + side rail cards (honest gray silhouette) */
      case "asana_home":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--asana-home dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          skLine("70%") +
          '<div class="dam-dash-preview-card__asana-bento">' +
          '<div class="dam-dash-preview-card__asana-tasks">' +
          '<div class="dam-dash-preview-card__asana-tabs">' +
          skChip() +
          skChip() +
          skChip() +
          "</div>" +
          listRows(4, ["72%", "64%", "68%", "55%"], ["22%", "20%", "18%", "22%"]) +
          "</div>" +
          '<div class="dam-dash-preview-card__asana-rail">' +
          '<div class="dam-dash-preview-card__swot-cell">' +
          skLine("50%") +
          skLine("80%", true) +
          skLine("60%", true) +
          "</div>" +
          '<div class="dam-dash-preview-card__swot-cell">' +
          skLine("40%") +
          skLine("70%", true) +
          skLine("55%", true) +
          "</div>" +
          '<div class="dam-dash-preview-card__swot-cell">' +
          skLine("55%") +
          skLine("85%", true) +
          "</div>" +
          "</div></div></div>"
        );

      case "tasks_next":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--list dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          listRows(5, ["78%", "64%", "70%", "52%", "60%"], ["24%", "24%", "20%", "24%", "18%"]) +
          "</div>"
        );

      case "tasks_by_section":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--list dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          listRows(4, ["40%", "44%", "48%", "36%"], ["14%", "14%", "14%", "14%"]) +
          "</div>"
        );
      case "carriers_top":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--list dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          listRows(5, ["58%", "50%", "46%", "42%", "38%"], ["16%", "14%", "14%", "12%", "12%"]) +
          "</div>"
        );
      case "langs_mix":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--list dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          skMetric(true) +
          listRows(4, ["22%", "22%", "22%", "22%"], ["14%", "14%", "12%", "12%"]) +
          "</div>"
        );
      case "cost_fmcg_breakdown":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--list dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          skChip() +
          listRows(4, ["55%", "48%", "50%", "62%"], ["22%", "20%", "20%", "24%"]) +
          skMetric(true) +
          "</div>"
        );

      /* Real per-object media geometry (icon stack + thumb + lines), gray */
      case "newest_viz_3":
      case "newest_products_f":
      case "branding_latest":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--media-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          mediaWidgetSkeletonHtml("2x2", 4) +
          (id === "branding_latest"
            ? '<span class="dam-widget-skel__line dam-widget-skel__line--short" style="margin-top:10px;width:40%"></span>'
            : "") +
          "</div>"
        );

      case "notify_new_viz":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--notify dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          '<span class="dam-dash-preview-card__toggle dam-dash-preview-card__toggle--gray"></span>' +
          skLine("72%") +
          skLine("40%", true) +
          "</div>"
        );

      case "cost_swot_risk":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--swot dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          '<div class="dam-dash-preview-card__swot-cell">' +
          skLine("40%") +
          skLine("70%", true) +
          skLine("55%", true) +
          "</div>" +
          '<div class="dam-dash-preview-card__swot-cell">' +
          skLine("50%") +
          skLine("60%", true) +
          skLine("45%", true) +
          "</div>" +
          '<div class="dam-dash-preview-card__swot-cell">' +
          skLine("36%") +
          skLine("65%", true) +
          skLine("60%", true) +
          "</div>" +
          '<div class="dam-dash-preview-card__swot-cell">' +
          skLine("44%") +
          skLine("58%", true) +
          skLine("50%", true) +
          "</div>" +
          "</div>"
        );

      case "assignees_load":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--bars dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          barTrack("88%") +
          barTrack("70%") +
          barTrack("55%") +
          barTrack("40%") +
          barTrack("28%") +
          "</div>"
        );
      case "labor_vs_print":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--bars dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          barTrack("62%") +
          barTrack("38%") +
          skChip() +
          "</div>"
        );

      case "quick_links":
        return (
          '<div class="dam-dash-preview-card__mock dam-dash-preview-card__mock--links dam-widget-skel" data-mock="' +
          escapeHtml(id) +
          '">' +
          '<span class="dam-dash-preview-card__link dam-dash-preview-card__link--gray"></span>' +
          '<span class="dam-dash-preview-card__link dam-dash-preview-card__link--gray"></span>' +
          '<span class="dam-dash-preview-card__link dam-dash-preview-card__link--gray"></span>' +
          '<span class="dam-dash-preview-card__link dam-dash-preview-card__link--gray"></span>' +
          "</div>"
        );

      default:
        return (
          '<div class="dam-dash-preview-card__mock dam-widget-skel" data-mock="generic">' +
          skLine("78%") +
          skLine("48%", true) +
          skChip() +
          "</div>"
        );
    }
  }

  function previewHtmlForWidget(w) {
    if (!w) return "";
    var label = customizeLabel(w);
    var desc = customizeDescription(w);
    var fallbackHint = w.defaultOn
      ? "Widget widoczny domyślnie na pulpicie."
      : "Widget opcjonalny. Wlacz, jesli go potrzebujesz.";
    var hint = desc || fallbackHint;
    return (
      '<div class="dam-dash-preview-card" data-widget-id="' +
      escapeHtml(w.id) +
      '">' +
      '<div class="dam-dash-preview-card__badge">Podglad</div>' +
      '<div class="dam-dash-preview-card__title">' +
      escapeHtml(label) +
      "</div>" +
      '<p class="dam-dash-preview-card__hint">' +
      escapeHtml(hint) +
      "</p>" +
      previewMockHtml(w.id) +
      "</div>"
    );
  }

  function waitMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function showPreview(widgetId) {
    var preview = document.getElementById("damDashPreview");
    var inner = document.getElementById("damDashPreviewInner");
    if (!preview || !inner) return;
    if (_previewHideTimer) {
      clearTimeout(_previewHideTimer);
      _previewHideTimer = null;
    }
    _previewActiveId = widgetId || "";
    var w = findWidget(widgetId);
    _previewQueue = _previewQueue.then(function () {
      if (_previewActiveId !== widgetId) return;
      var wasVisible = !preview.hidden && preview.classList.contains("is-visible");
      if (wasVisible) {
        preview.classList.remove("is-visible");
        preview.classList.add("is-leaving");
        return waitMs(PREVIEW_MS).then(function () {
          if (_previewActiveId !== widgetId) return;
          preview.classList.remove("is-leaving");
          inner.innerHTML = previewHtmlForWidget(w);
          preview.hidden = false;
          preview.classList.add("is-visible");
          preview.style.zIndex = "3";
          return waitMs(PREVIEW_MS);
        });
      }
      inner.innerHTML = previewHtmlForWidget(w);
      preview.hidden = false;
      preview.classList.remove("is-leaving");
      preview.classList.add("is-visible");
      preview.style.zIndex = "3";
      return waitMs(PREVIEW_MS);
    });
  }

  function hidePreviewSoon() {
    if (_previewHideTimer) clearTimeout(_previewHideTimer);
    _previewHideTimer = setTimeout(function () {
      _previewHideTimer = null;
      _previewActiveId = "";
      var preview = document.getElementById("damDashPreview");
      if (!preview) return;
      _previewQueue = _previewQueue.then(function () {
        if (_previewActiveId) return;
        preview.classList.remove("is-visible");
        preview.classList.add("is-leaving");
        return waitMs(PREVIEW_MS).then(function () {
          if (_previewActiveId) return;
          preview.classList.remove("is-leaving");
          preview.hidden = true;
          preview.style.zIndex = "";
        });
      });
    }, 80);
  }

  function paintModalList() {
    var list = document.getElementById("damDashCustomizeList");
    if (!list || !draftOrder) return;
    list.innerHTML = draftOrder
      .map(function (row, idx) {
        var w = findWidget(row.id);
        if (!w) return "";
        var label = customizeLabel(w);
        var desc = customizeDescription(w);
        return (
          '<li class="dam-dash-modal__row" data-idx="' +
          idx +
          '" data-id="' +
          escapeHtml(row.id) +
          '" draggable="true">' +
          '<span class="dam-dash-modal__drag" aria-hidden="true" title="Przeciagnij">' +
          '<i class="uil uil-draggabledots"></i></span>' +
          '<label class="dam-dash-modal__check">' +
          '<input type="checkbox" data-id="' +
          escapeHtml(row.id) +
          '"' +
          (row.on ? " checked" : "") +
          " />" +
          '<span class="dam-dash-modal__copy">' +
          '<span class="dam-dash-modal__title">' +
          escapeHtml(label) +
          (w.defaultOn
            ? ""
            : ' <span class="dam-widget__meta">(opcjonalny)</span>') +
          "</span>" +
          (desc
            ? '<span class="dam-dash-modal__desc">' + escapeHtml(desc) + "</span>"
            : "") +
          "</span></label>" +
          '<div class="dam-dash-modal__move">' +
          '<button type="button" data-move="up" data-idx="' +
          idx +
          '" aria-label="W gore"' +
          (idx === 0 ? " disabled" : "") +
          '><i class="uil uil-angle-up" aria-hidden="true"></i></button>' +
          '<button type="button" data-move="down" data-idx="' +
          idx +
          '" aria-label="W dol"' +
          (idx === draftOrder.length - 1 ? " disabled" : "") +
          '><i class="uil uil-angle-down" aria-hidden="true"></i></button>' +
          "</div></li>"
        );
      })
      .join("");
  }

  function bindListInteractions(modal) {
    var list = document.getElementById("damDashCustomizeList");
    if (!list) return;
    var dragFrom = -1;

    list.querySelectorAll(".dam-dash-modal__row").forEach(function (row) {
      row.addEventListener("mouseenter", function () {
        var id = row.getAttribute("data-id");
        if (id) showPreview(id);
      });
      row.addEventListener("mouseleave", function () {
        hidePreviewSoon();
      });
      row.addEventListener("dragstart", function (e) {
        dragFrom = parseInt(row.getAttribute("data-idx"), 10);
        row.classList.add("is-dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(dragFrom));
        }
      });
      row.addEventListener("dragend", function () {
        row.classList.remove("is-dragging");
        list.querySelectorAll(".is-drop-target").forEach(function (el) {
          el.classList.remove("is-drop-target");
        });
        dragFrom = -1;
      });
      row.addEventListener("dragover", function (e) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        row.classList.add("is-drop-target");
      });
      row.addEventListener("dragleave", function () {
        row.classList.remove("is-drop-target");
      });
      row.addEventListener("drop", function (e) {
        e.preventDefault();
        row.classList.remove("is-drop-target");
        var to = parseInt(row.getAttribute("data-idx"), 10);
        var from = dragFrom;
        if (from < 0 || to < 0 || from === to || !draftOrder) return;
        var item = draftOrder.splice(from, 1)[0];
        draftOrder.splice(to, 0, item);
        paintModalList();
        bindListInteractions(modal);
      });
    });

    list.querySelectorAll('input[type="checkbox"][data-id]').forEach(function (c) {
      c.addEventListener("change", function () {
        syncDraftFromChecks(modal);
      });
    });
  }

  function applySave(modal, onSaved, closeFn) {
    syncDraftFromChecks(modal);
    var order = draftOrder
      .filter(function (row) {
        return row.on;
      })
      .map(function (row) {
        return row.id;
      });
    if (!order.length) order = defaultOrder();
    saveLayout({ order: order });
    _baselineSnapshot = snapshotDraft();
    closeFn();
    if (typeof onSaved === "function") onSaved();
  }

  function openDirtyConfirm(modal, onSaved, forceClose) {
    var box = document.getElementById("damDashDirtyConfirm");
    if (!box) {
      forceClose();
      return;
    }
    _confirmOpen = true;
    box.hidden = false;
    function finishConfirm() {
      _confirmOpen = false;
      box.hidden = true;
      box.removeEventListener("click", onConfirmClick);
    }
    function onConfirmClick(e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-dirty]") : null;
      if (!btn) return;
      var act = btn.getAttribute("data-dirty");
      if (act === "save") {
        finishConfirm();
        applySave(modal, onSaved, forceClose);
        return;
      }
      if (act === "discard") {
        finishConfirm();
        forceClose();
        return;
      }
      if (act === "back") {
        finishConfirm();
      }
    }
    box.addEventListener("click", onConfirmClick);
  }

  var _customizeSession = null;

  function setCustomizeToolbarEditing(on) {
    var btn = document.getElementById("damDashCustomizeBtn");
    var cancel = document.getElementById("damDashCustomizeCancel");
    if (!btn) return;
    var label = btn.querySelector("span");
    var icon = btn.querySelector("i");
    btn.classList.toggle("is-editing", !!on);
    if (on) {
      if (label) {
        label.removeAttribute("data-i18n");
        label.textContent = "Zatwierd\u017a";
      }
      if (icon) icon.className = "uil uil-check";
      btn.setAttribute("aria-label", "Zatwierdz uklad pulpitu");
      btn.title = "Zatwierdz i zapisz uklad";
    } else {
      if (label) {
        label.setAttribute("data-i18n", "dash.customize");
        label.textContent = "Dostosuj pulpit";
      }
      if (icon) icon.className = "uil uil-apps";
      btn.setAttribute("aria-label", "Dostosuj pulpit");
      btn.title = "";
    }
    if (cancel) {
      cancel.hidden = !on;
      cancel.setAttribute("aria-hidden", on ? "false" : "true");
    }
  }

  function confirmCustomizeFromToolbar() {
    if (!_customizeSession || typeof _customizeSession.confirm !== "function") return false;
    _customizeSession.confirm();
    return true;
  }

  function openCustomize(onSaved) {
    var modal = ensureModal();
    /* Drop prior session listeners so peek/toggle does not double-fire. */
    if (modal._damDashOnClick) {
      modal.removeEventListener("click", modal._damDashOnClick);
      modal._damDashOnClick = null;
    }
    if (modal._damDashOnKey) {
      document.removeEventListener("keydown", modal._damDashOnKey);
      modal._damDashOnKey = null;
    }
    buildDraftFromLayout();
    _baselineSnapshot = snapshotDraft();
    _confirmOpen = false;
    _previewActiveId = "";
    _previewQueue = Promise.resolve();
    var dirtyBox = document.getElementById("damDashDirtyConfirm");
    if (dirtyBox) dirtyBox.hidden = true;
    var preview = document.getElementById("damDashPreview");
    if (preview) {
      preview.hidden = true;
      preview.classList.remove("is-visible", "is-leaving");
    }
    paintModalList();
    bindListInteractions(modal);
    setLayoutEditMode(true);
    setCustomizeToolbarEditing(true);
    /* Open tucked (metka tab only): edit handles on, no dim; user expands for widget list. */
    modal.classList.remove("is-drawer-leaving", "is-drawer-entering");
    setDrawerExpanded(modal, false);
    modal.hidden = false;
    if (typeof ensureDashMascotTip === "function") {
      ensureDashMascotTip(modal);
    }
    var prevFocus = document.activeElement;
    var toggleBtn = document.getElementById("damDashDrawerToggle");
    if (toggleBtn) toggleBtn.focus();

    function forceClose() {
      setLayoutEditMode(false);
      setCustomizeToolbarEditing(false);
      _customizeSession = null;
      setDrawerExpanded(modal, false);
      modal.classList.remove("is-drawer-entering", "is-drawer-leaving");
      modal.hidden = true;
      if (modal._damDashOnClick) {
        modal.removeEventListener("click", modal._damDashOnClick);
        modal._damDashOnClick = null;
      }
      if (modal._damDashOnKey) {
        document.removeEventListener("keydown", modal._damDashOnKey);
        modal._damDashOnKey = null;
      }
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }

    function requestClose() {
      if (_confirmOpen) return;
      if (isDraftDirty(modal)) {
        setDrawerExpanded(modal, true);
        openDirtyConfirm(modal, onSaved, forceClose);
        return;
      }
      forceClose();
    }

    _customizeSession = {
      confirm: function () {
        applySave(modal, onSaved, forceClose);
      },
      cancel: requestClose
    };

    var cancelBtn = document.getElementById("damDashCustomizeCancel");
    if (cancelBtn && !cancelBtn._damDashCancelWired) {
      cancelBtn._damDashCancelWired = true;
      cancelBtn.addEventListener("click", function () {
        if (_customizeSession && typeof _customizeSession.cancel === "function") {
          _customizeSession.cancel();
        }
      });
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (_confirmOpen) {
          var box = document.getElementById("damDashDirtyConfirm");
          if (box) box.hidden = true;
          _confirmOpen = false;
          return;
        }
        /* Esc while expanded: tuck first; Esc while tucked: exit edit mode */
        if (modal.classList.contains("is-drawer-expanded")) {
          setDrawerExpanded(modal, false);
          if (toggleBtn) toggleBtn.focus();
          return;
        }
        requestClose();
      }
    }

    function onClick(e) {
      var tEl = e.target;
      if (tEl.closest && tEl.closest("#damDashDirtyConfirm")) return;
      if (tEl.closest && tEl.closest("#damDashDrawerToggle")) {
        var nextExpanded = !modal.classList.contains("is-drawer-expanded");
        setDrawerExpanded(modal, nextExpanded);
        return;
      }
      /* Backdrop closes only when expanded (tucked backdrop is non-interactive). */
      if (tEl.closest && tEl.closest("[data-dam-close]")) {
        if (
          tEl.closest(".dam-dash-modal__backdrop") &&
          modal.classList.contains("is-drawer-tucked")
        ) {
          return;
        }
        requestClose();
        return;
      }
      var moveBtn = tEl.closest ? tEl.closest("[data-move]") : null;
      var move = moveBtn && moveBtn.getAttribute("data-move");
      if (move != null) {
        var idx = parseInt(moveBtn.getAttribute("data-idx"), 10);
        if (move === "up" && idx > 0) {
          var tmp = draftOrder[idx - 1];
          draftOrder[idx - 1] = draftOrder[idx];
          draftOrder[idx] = tmp;
          paintModalList();
          bindListInteractions(modal);
        }
        if (move === "down" && idx < draftOrder.length - 1) {
          var tmp2 = draftOrder[idx + 1];
          draftOrder[idx + 1] = draftOrder[idx];
          draftOrder[idx] = tmp2;
          paintModalList();
          bindListInteractions(modal);
        }
        return;
      }
      if (tEl.closest && tEl.closest("#damDashReset")) {
        resetLayout();
        buildDraftFromLayout();
        paintModalList();
        bindListInteractions(modal);
        return;
      }
      if (tEl.closest && tEl.closest("#damDashSave")) {
        applySave(modal, onSaved, forceClose);
      }
    }

    modal._damDashOnClick = onClick;
    modal._damDashOnKey = onKey;
    modal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
  }

  function bootDashChrome() {
    ensureDashLayoutCss();
    bindCountMenus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootDashChrome);
  } else {
    bootDashChrome();
  }

  global.DamDashWidgets = {
    defineWidgets: defineWidgets,
    getRegistry: function () {
      defineWidgets();
      return registry.slice();
    },
    loadLayout: loadLayout,
    saveLayout: saveLayout,
    resetLayout: resetLayout,
    renderGrid: renderGrid,
    openCustomize: openCustomize,
    confirmCustomize: confirmCustomizeFromToolbar,
    isCustomizeOpen: function () {
      return !!(
        document.body &&
        document.body.classList.contains("dam-dash-customize-on")
      );
    },
    userKey: userKey
  };
})(typeof window !== "undefined" ? window : globalThis);
