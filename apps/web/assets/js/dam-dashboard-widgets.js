/**
 * DAM - Dashboard widget registry, layout store, customize modal.
 */
(function (global) {
  "use strict";

  var LAYOUT_PREFIX = "dam_dash_layout_v1:";
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

  function loadLayout() {
    var key = LAYOUT_PREFIX + userKey();
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return { order: defaultOrder(), version: 1 };
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.order)) {
        return { order: defaultOrder(), version: 1 };
      }
      var known = {};
      allIds().forEach(function (id) {
        known[id] = true;
      });
      var order = parsed.order.filter(function (id) {
        return known[id];
      });
      if (!order.length) order = defaultOrder();
      return { order: order, version: 1 };
    } catch (e) {
      return { order: defaultOrder(), version: 1 };
    }
  }

  function saveLayout(layout) {
    localStorage.setItem(
      LAYOUT_PREFIX + userKey(),
      JSON.stringify({ version: 1, order: layout.order || [] })
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

  var TILE_LAYOUTS = ["2x2", "1x4", "1x6"];

  function layoutStorageKey(widgetId) {
    return "dam_dash_tile_layout:" + userKey() + ":" + widgetId;
  }

  function getTileLayout(widgetId) {
    try {
      var v = localStorage.getItem(layoutStorageKey(widgetId)) || "1x4";
      return TILE_LAYOUTS.indexOf(v) >= 0 ? v : "1x4";
    } catch (e) {
      return "1x4";
    }
  }

  function setTileLayout(widgetId, layout) {
    try {
      localStorage.setItem(layoutStorageKey(widgetId), layout);
    } catch (e) {}
  }

  function layoutCardCount(layout) {
    if (layout === "1x6") return 6;
    if (layout === "2x2") return 4;
    return 4;
  }

  /** i18n "4 najnowsze..." -> "N najnowsze..." for active tile layout. */
  function vizTitleForCount(n) {
    var tpl = t("dash.widget.newest_viz", "4 najnowsze wizualizacje");
    var count = Math.max(1, Number(n) || 4);
    if (/^\d+/.test(tpl)) return tpl.replace(/^\d+/, String(count));
    return count + " " + tpl;
  }

  /** B5: dashboard-only layout safety (header wrap + tile overflow). Prefer inject over shared CSS. */
  function ensureDashLayoutCss() {
    if (document.getElementById("damDashLayoutB5Css")) return;
    var s = document.createElement("style");
    s.id = "damDashLayoutB5Css";
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
      "min-width:0;max-width:100%;overflow-x:clip;}" +
      "/* Off-canvas Geex customizer must not widen document scroll */" +
      "body.geex-dashboard .geex-customizer{" +
      "position:fixed!important;}" +
      "/* Tile layouts: allow 1x6 to grow; keep rows from blowing out */" +
      "body.geex-dashboard .dam-widget," +
      "body.geex-dashboard .dam-dash-grid," +
      "body.geex-dashboard .dam-dash-layout{" +
      "min-width:0;max-width:100%;}" +
      "body.geex-dashboard .dam-widget--media-latest.dam-widget--md," +
      "body.geex-dashboard .dam-widget--md.dam-widget--viz-latest{" +
      "grid-row:span auto;align-self:start;min-width:0;}" +
      "body.geex-dashboard .dam-widget__list--media.dam-widget__list--grid-1x6," +
      "body.geex-dashboard .dam-widget__list--viz.dam-widget__list--grid-1x6{" +
      "grid-auto-rows:minmax(96px,auto);}" +
      "body.geex-dashboard .dam-widget__list--media.dam-widget__list--grid-2x2," +
      "body.geex-dashboard .dam-widget__list--viz.dam-widget__list--grid-2x2{" +
      "grid-template-columns:repeat(2,minmax(0,1fr))!important;}" +
      "body.geex-dashboard .dam-widget__list li.dam-widget__viz-row{" +
      "min-width:0;max-width:100%;}" +
      "body.geex-dashboard .dam-widget__viz-body," +
      "body.geex-dashboard .dam-widget__viz-body > a{" +
      "min-width:0;overflow-wrap:anywhere;}" +
      "@media (max-width:768px){" +
      "body.geex-dashboard .dam-dash-layout{grid-template-columns:1fr!important;}" +
      "body.geex-dashboard .dam-widget__list--media.dam-widget__list--grid-2x2," +
      "body.geex-dashboard .dam-widget__list--viz.dam-widget__list--grid-2x2{" +
      "grid-template-columns:1fr!important;}" +
      "}" +
      "@media (max-width:420px){" +
      "body.geex-dashboard .geex-content__header__action .geex-btn__text," +
      "body.geex-dashboard .geex-content__header__action .dam-status-pill__label{" +
      "display:none;}" +
      "}";
    document.head.appendChild(s);
  }

  function layoutToggleHtml(widgetId, layout) {
    var labels = { "2x2": "Układ 2x2", "1x4": "Układ 1x4", "1x6": "Układ 1x6" };
    return (
      '<div class="dam-widget__actions">' +
      '<button type="button" class="dam-widget__layout-btn" data-widget-layout-toggle="' +
      escapeHtml(widgetId) +
      '" data-layout="' +
      escapeHtml(layout) +
      '" aria-label="' +
      escapeHtml(labels[layout] || "Układ kafelków") +
      '" title="' +
      escapeHtml(labels[layout] || "Zmien układ") +
      '" data-dam-tip="Przelacz uklad: 2x2 / 1x4 / 1x6">' +
      '<i class="uil uil-apps" aria-hidden="true"></i>' +
      '<span class="dam-widget__layout-label">' +
      escapeHtml(layout) +
      "</span></button></div>"
    );
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

  function folderLabel(path, asset) {
    var parts = dirnamePath(path).split("/").filter(Boolean);
    if (!parts.length) return "Material";
    var skip = /^(miniatura|galeria|preview|thumbs?|exports?|\d+x)$/i;
    while (parts.length > 1 && skip.test(parts[parts.length - 1])) {
      parts.pop();
    }
    var last = parts[parts.length - 1];
    var prev = parts.length > 1 ? parts[parts.length - 2] : "";
    if (/^\d+x$/i.test(last) && prev) return prev + " / " + last;
    if (/^\d{2}\s*-\s*/.test(last) && prev) return prev + " / " + last;
    var nameHint = String((asset && (asset.name || asset.file_name)) || "");
    var m = nameHint.match(/^(.+?)\s*-\s*\d+\.(png|jpg|jpeg|webp|svg)$/i);
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

  function isBrandingWidgetThumb(a) {
    if (!a) return false;
    var mt = normalizeBrandingMediaType(a.media_type);
    if (mt === "document" || mt === "video") return false;
    var p = String(a.name || a.path || "");
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(p)) return true;
    return mt === "image" || mt === "vector";
  }

  function loadBrandingIndex() {
    if (global.__damBrandingIndex && global.__damBrandingIndex.assets) {
      return Promise.resolve(global.__damBrandingIndex);
    }
    return fetch(
      "data/branding-index.json?v=" + (global.DAM_APP_VERSION || Date.now())
    )
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        try {
          global.__damBrandingIndex = data;
        } catch (eShare) {
          /* ignore */
        }
        return data;
      });
  }

  function groupBrandingAssets(assets, maxGroups) {
    var byDir = {};
    (assets || []).forEach(function (a) {
      var key = dirnamePath(a.path || a.folder_group_id || a.id).toLowerCase();
      if (!byDir[key]) byDir[key] = [];
      byDir[key].push(a);
    });
    var groups = Object.keys(byDir).map(function (k) {
      var arr = byDir[k].slice().sort(function (a, b) {
        return String(b.mtime || "").localeCompare(String(a.mtime || ""));
      });
      var newest = arr[0];
      return {
        key: k,
        label: folderLabel(newest.path || "", newest),
        count: arr.length,
        newest: newest,
        path: newest.path || "",
        mtime: newest.mtime || "",
      };
    });
    groups.sort(function (a, b) {
      return String(b.mtime || "").localeCompare(String(a.mtime || ""));
    });
    return groups.slice(0, maxGroups || 4);
  }

  function mediaListClass(layout) {
    return (
      "dam-widget__list dam-widget__list--media dam-widget__list--grid-" +
      (layout || "1x4")
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

  function rebindWidgetChrome(host) {
    if (!host) return;
    if (global.DamIcons && typeof DamIcons.bindWinButtons === "function") {
      DamIcons.bindWinButtons(host);
    }
    if (global.DamBadges && typeof DamBadges.bindClicks === "function") {
      DamBadges.bindClicks(host, "dashboard");
    }
  }

  function bindLayoutToggle(widgetId, onCycle) {
    var btn = document.querySelector(
      '[data-widget-layout-toggle="' + widgetId + '"]'
    );
    if (!btn || btn._damLayoutBound) return;
    btn._damLayoutBound = true;
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      var cur = getTileLayout(widgetId);
      var idx = TILE_LAYOUTS.indexOf(cur);
      var next = TILE_LAYOUTS[(idx + 1) % TILE_LAYOUTS.length];
      setTileLayout(widgetId, next);
      if (typeof onCycle === "function") onCycle(next);
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
    var m = String(folder || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (m) return m[3] + "-" + m[2] + "-" + m[1];
    return fallback || "";
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
      if (!byPid[pid] || String(v.mtime || "") > String(byPid[pid].mtime || "")) {
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
      var cmp = String(b.asanaStart || "").localeCompare(String(a.asanaStart || ""));
      if (cmp) return cmp;
      cmp = String(b.mtClean || "").localeCompare(String(a.mtClean || ""));
      if (cmp) return cmp;
      cmp = String(b.revDate || "").localeCompare(String(a.revDate || ""));
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
        defaultOn: true,
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
            list
              .map(function (v) {
                var name = v.product_name || v.product_id || "Wizualizacja";
                var pid = v.product_id || "";
                var path =
                  global.DamPaths && typeof DamPaths.resolveWinFolderPath === "function"
                    ? DamPaths.resolveWinFolderPath(v)
                    : v.path || v.revision_path || "";
                var vizHref = pid
                  ? "visualizations.html?product=" + encodeURIComponent(pid)
                  : "visualizations.html";
                var explorerHref = pid
                  ? "explorer.html?product=" + encodeURIComponent(pid)
                  : "explorer.html";
                var thumb = v.thumb_url || "assets/img/placeholder-product.svg";
                var winIcon =
                  global.DamIcons && typeof DamIcons.winExplorerSvg === "function"
                    ? DamIcons.winExplorerSvg()
                    : '<i class="uil uil-folder" aria-hidden="true"></i>';
                var indexVal = v.index || v.product_index || v.index_base || "";
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
                                tags: v.tags,
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
                        showCarrierPlaceholder: false,
                      })
                    : '<span class="dam-widget__meta">' +
                      escapeHtml(
                        [indexVal, v.carrier_label || v.carrier || ""]
                          .filter(Boolean)
                          .join(" / ")
                      ) +
                      "</span>";
                return (
                  '<li class="dam-widget__viz-row">' +
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
                  escapeHtml(vizHref) +
                  '" title="Wizualizacje" data-dam-tip="Otworz wizualizacje produktu">' +
                  '<img class="dam-widget__thumb" src="' +
                  escapeHtml(thumb) +
                  '" alt="' +
                  escapeHtml(name) +
                  '" loading="lazy" />' +
                  "</a>" +
                  '<div class="dam-widget__viz-body">' +
                  '<a href="' +
                  escapeHtml(vizHref) +
                  '">' +
                  escapeHtml(name) +
                  "</a>" +
                  '<div class="dam-widget__viz-badges">' +
                  badges +
                  "</div></div></div></li>"
                );
              })
              .join("") +
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
          bindLayoutToggle(self.id, function () {
            var host = document.querySelector('[data-widget-id="newest_viz_3"]');
            if (host) self.render(host, ctx);
          });
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
          loadBrandingIndex()
            .then(function (data) {
              var bridge =
                (global.DamPaths && typeof DamPaths.bridgeUrl === "function" && DamPaths.bridgeUrl()) ||
                (global.DamRuntime && typeof DamRuntime.bridgeUrl === "function" && DamRuntime.bridgeUrl()) ||
                "http://127.0.0.1:8766";
              var assets = (data.assets || []).filter(isBrandingWidgetThumb);
              assets.sort(function (a, b) {
                return String(b.mtime || "").localeCompare(String(a.mtime || ""));
              });
              var groups = groupBrandingAssets(assets, n);
              if (!groups.length) {
                el.outerHTML = shell(
                  self,
                  '<p class="dam-widget__meta">Brak miniatur graficznych do podgladu. <a href="branding.html">Otworz Branding</a></p>',
                  "dam-widget--branding-latest dam-widget--media-latest",
                  layoutToggleHtml(self.id, layout)
                );
                bindLayoutToggle(self.id, function () {
                  var host = document.querySelector('[data-widget-id="branding_latest"]');
                  if (host) self.render(host);
                });
                return;
              }
              var winIcon =
                global.DamIcons && typeof DamIcons.winExplorerSvg === "function"
                  ? DamIcons.winExplorerSvg()
                  : '<i class="uil uil-folder" aria-hidden="true"></i>';
              var html =
                '<ul class="' +
                mediaListClass(layout) +
                '">' +
                groups
                  .map(function (g) {
                    var a = g.newest;
                    var brandingHref = brandingHrefForAsset(a, g.label || a.name || "");
                    var thumb = bridge + "/media?path=" + encodeURIComponent(a.path || "");
                    var countChip =
                      g.count > 1
                        ? '<span class="dam-widget__count-chip">x' +
                          g.count +
                          " warianty</span>"
                        : "";
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
                      (!(a.path) ? " disabled" : "") +
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
                      '<img class="dam-widget__thumb" src="' +
                      escapeHtml(thumb) +
                      '" alt="' +
                      escapeHtml(g.label) +
                      '" loading="lazy" />' +
                      "</a>" +
                      '<div class="dam-widget__viz-body">' +
                      '<a href="' +
                      brandingHref +
                      '">' +
                      escapeHtml(g.label) +
                      "</a>" +
                      '<div class="dam-widget__viz-badges">' +
                      (a.brand
                        ? '<span class="dam-viz-badge">' + escapeHtml(a.brand) + "</span>"
                        : "") +
                      countChip +
                      "</div></div></div></li>"
                    );
                  })
                  .join("") +
                '</ul><p class="dam-widget__meta"><a href="branding.html">Otworz Branding</a></p>';
              el.outerHTML = shell(
                self,
                html,
                "dam-widget--branding-latest dam-widget--media-latest",
                layoutToggleHtml(self.id, layout)
              );
              var hostBr = document.querySelector('[data-widget-id="branding_latest"]');
              rebindWidgetChrome(hostBr);
              bindLayoutToggle(self.id, function () {
                var host = document.querySelector('[data-widget-id="branding_latest"]');
                if (host) self.render(host);
              });
            })
            .catch(function () {
              el.outerHTML = shell(
                self,
                '<p class="dam-widget__meta">Indeks branding niedostepny.</p>',
                "dam-widget--branding-latest dam-widget--media-latest"
              );
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
            (global.DamNotify && DamNotify.statusText()) || "Niedostepne";
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
        defaultOn: true,
        render: function (el, ctx) {
          var tasks = openTasks(ctx)
            .slice()
            .sort(function (a, b) {
              return String(a.due || "9999").localeCompare(String(b.due || "9999"));
            })
            .slice(0, 6);
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
                var due = task.due
                  ? new Date(task.due).toLocaleDateString("pl-PL")
                  : "-";
                var overdueCls =
                  task.due && new Date(task.due) < new Date()
                    ? " is-overdue"
                    : "";
                return (
                  "<li>" +
                  '<span title="' +
                  escapeHtml(task.name) +
                  '">' +
                  escapeHtml(task.name) +
                  "</span>" +
                  '<span class="' +
                  overdueCls.trim() +
                  '">' +
                  escapeHtml(due) +
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
            '<div class="dam-widget__links">' +
              '<a href="visualizations.html"><i class="uil uil-image-v"></i> Wizualizacje</a>' +
              '<a href="costs.html"><i class="uil uil-calculator-alt"></i> Koszty</a>' +
              '<a href="explorer.html"><i class="uil uil-sitemap"></i> Eksplorer</a>' +
              '<a href="invoices.html"><i class="uil uil-invoice"></i> Faktury</a>' +
              "</div>"
          );
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
              '%;background:#AB54DB"></div></div><span>' +
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

  function renderGrid(mount, ctx) {
    if (!mount) return;
    defineWidgets();
    var layout = loadLayout();
    var order = layout.order.slice();
    mount.innerHTML = "";
    order.forEach(function (id) {
      var w = findWidget(id);
      if (!w || !allowedForRole(w)) return;
      var placeholder = document.createElement("div");
      placeholder.dataset.widgetId = id;
      mount.appendChild(placeholder);
      try {
        w.render(placeholder, ctx || {});
      } catch (e) {
        console.warn("DAM widget fail", id, e);
        placeholder.outerHTML = shell(
          w,
          '<p class="dam-widget__meta">Błąd renderu widgetu</p>'
        );
      }
    });
    ensureDashWinDelegation(mount);
    if (global.DamIcons && typeof DamIcons.bindWinButtons === "function") {
      DamIcons.bindWinButtons(mount);
    }
    if (global.DamBadges && typeof DamBadges.bindClicks === "function") {
      DamBadges.bindClicks(mount);
    }
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
    if (window.DamGridReveal) {
      window.DamGridReveal.reveal(mount, window.DamGridReveal.selectors.dashboardWidget);
    }
  }

  /* ---------- customize modal ---------- */

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

  function ensureModal() {
    var existing = document.getElementById("damDashCustomize");
    if (existing && !existing.querySelector(".dam-dash-modal__stage")) {
      existing.remove();
      existing = null;
    }
    if (existing) return existing;
    var wrap = document.createElement("div");
    wrap.id = "damDashCustomize";
    wrap.className = "dam-dash-modal";
    wrap.hidden = true;
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "damDashCustomizeTitle");
    wrap.innerHTML =
      '<div class="dam-dash-modal__backdrop" data-dam-close="1"></div>' +
      '<div class="dam-dash-modal__stage">' +
      '<div class="dam-dash-modal__panel">' +
      '<h3 id="damDashCustomizeTitle">Dostosuj pulpit</h3>' +
      "<p>Wybierz widgety i ustaw kolejność. Przeciągnij wiersz albo użyj strzałek. Koszt miesiąca jest wyłączony domyślnie. Najedź na wiersz, żeby zobaczyć podgląd po prawej.</p>" +
      '<ul class="dam-dash-modal__list" id="damDashCustomizeList"></ul>' +
      '<div class="dam-dash-modal__footer">' +
      '<button type="button" class="geex-btn" id="damDashReset">Przywroc domyslne</button>' +
      '<button type="button" class="geex-btn" data-dam-close="1">Anuluj</button>' +
      '<button type="button" class="geex-btn geex-btn--primary" id="damDashSave">Zapisz</button>' +
      "</div></div>" +
      '<aside class="dam-dash-modal__preview" id="damDashPreview" aria-live="polite" hidden>' +
      '<div class="dam-dash-modal__preview-inner" id="damDashPreviewInner"></div>' +
      "</aside></div>" +
      '<div class="dam-dash-modal__confirm" id="damDashDirtyConfirm" hidden>' +
      '<div class="dam-dash-modal__confirm-card" role="alertdialog" aria-labelledby="damDashDirtyTitle">' +
      '<h4 id="damDashDirtyTitle">Masz niezapisane zmiany</h4>' +
      "<p>Chcesz zapisac ustawienia pulpitu, czy wyjsc bez zapisu?</p>" +
      '<div class="dam-dash-modal__confirm-actions">' +
      '<button type="button" class="geex-btn geex-btn--primary" data-dirty="save">Zapisz zmiany</button>' +
      '<button type="button" class="geex-btn" data-dirty="discard">Nie zapisuj</button>' +
      '<button type="button" class="geex-btn" data-dirty="back">Wróć do wyboru</button>' +
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

  function previewHtmlForWidget(w) {
    if (!w) return "";
    var hint = w.defaultOn
      ? "Widget widoczny domyslnie na pulpicie."
      : "Widget opcjonalny. Wlacz, jesli go potrzebujesz.";
    return (
      '<div class="dam-dash-preview-card" data-widget-id="' +
      escapeHtml(w.id) +
      '">' +
      '<div class="dam-dash-preview-card__badge">Podgląd</div>' +
      '<div class="dam-dash-preview-card__title">' +
      escapeHtml(w.title) +
      "</div>" +
      '<p class="dam-dash-preview-card__hint">' +
      hint +
      "</p>" +
      '<div class="dam-dash-preview-card__mock" aria-hidden="true">' +
      '<span class="dam-dash-preview-card__bar"></span>' +
      '<span class="dam-dash-preview-card__bar dam-dash-preview-card__bar--short"></span>' +
      '<span class="dam-dash-preview-card__chip"></span>' +
      "</div></div>"
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
          "<span>" +
          escapeHtml(w.title) +
          (w.defaultOn ? "" : ' <span class="dam-widget__meta">(opcjonalny)</span>') +
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

  function openCustomize(onSaved) {
    var modal = ensureModal();
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
    modal.hidden = false;
    var prevFocus = document.activeElement;
    var saveBtn = document.getElementById("damDashSave");
    if (saveBtn) saveBtn.focus();

    function forceClose() {
      modal.hidden = true;
      modal.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }

    function requestClose() {
      if (_confirmOpen) return;
      if (isDraftDirty(modal)) {
        openDirtyConfirm(modal, onSaved, forceClose);
        return;
      }
      forceClose();
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
        requestClose();
      }
    }

    function onClick(e) {
      var tEl = e.target;
      if (tEl.closest && tEl.closest("#damDashDirtyConfirm")) return;
      if (tEl.closest && tEl.closest("[data-dam-close]")) {
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

    modal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureDashLayoutCss);
  } else {
    ensureDashLayoutCss();
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
    userKey: userKey
  };
})(typeof window !== "undefined" ? window : globalThis);
