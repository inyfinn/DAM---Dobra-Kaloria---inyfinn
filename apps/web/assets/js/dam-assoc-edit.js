/**
 * DAM - edycja skojarzen produktow / wariantow w podgladzie mediow (Shift+klik, admin).
 */
(function (global) {
  "use strict";

  var PLACEHOLDER_SVG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">' +
        '<rect fill="#f1f3f6" width="320" height="240"/>' +
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="14">Brak</text>' +
        "</svg>"
    );

  function bridgeUrl() {
    return (
      (global.DamPaths && typeof global.DamPaths.bridgeUrl === "function" && global.DamPaths.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  // #region agent log
  function __damDbg(location, message, data, hypothesisId) {
    var payload = JSON.stringify({
      sessionId: "3ca09b",
      runId: "post-fix",
      hypothesisId: hypothesisId || "",
      location: location,
      message: message,
      data: data || {},
      timestamp: Date.now(),
    });
    try {
      if (!global.__damDbgBuf) global.__damDbgBuf = [];
      global.__damDbgBuf.push(JSON.parse(payload));
      if (global.__damDbgBuf.length > 200) global.__damDbgBuf.shift();
    } catch (eBuf) {
      /* ignore */
    }
  }
  // #endregion

  /** Abort fetch after ms (default 5s) so picker never hangs forever. */
  function fetchWithTimeout(url, ms) {
    ms = ms || 5000;
    if (typeof AbortController === "undefined") return fetch(url);
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      try {
        ctrl.abort();
      } catch (eAbort) { /* ignore */ }
    }, ms);
    return fetch(url, { signal: ctrl.signal }).finally(function () {
      clearTimeout(timer);
    });
  }

  function authHeaders() {
    if (global.DamApi && typeof global.DamApi.authHeaders === "function") {
      return global.DamApi.authHeaders();
    }
    return {
      Authorization: "Bearer " + (localStorage.getItem("dam_token") || ""),
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  function role() {
    return String(
      (global.DamApi && typeof global.DamApi.role === "function" && global.DamApi.role()) ||
        localStorage.getItem("dam_role") ||
        "user"
    ).toLowerCase();
  }

  function isPrivileged() {
    var r = role();
    return r === "admin" || r === "power_user";
  }

  function adminModeOn() {
    return localStorage.getItem("dam_admin_mode") === "1" || localStorage.getItem("dam_viz_admin_mode") === "1";
  }

  function canEditAssoc() {
    return isPrivileged() && adminModeOn();
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    if (global.DamToast && typeof global.DamToast.show === "function") {
      global.DamToast.show(msg);
      return;
    }
    var el = document.getElementById("damTagEditToast") || document.getElementById("damExplorerToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damAssocEditToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 3600);
  }

  function hasWarmProductCatalog(fi) {
    fi = fi || global._DAM_FILE_INDEX;
    return !!(fi && Array.isArray(fi.products) && fi.products.length > 0);
  }

  /** True when catalog is the light search-index stub (safe for picker scans). */
  function isLightProductCatalog(fi) {
    fi = fi || global._DAM_FILE_INDEX;
    return !!(fi && fi._fromSearchIndex && Array.isArray(fi.products) && fi.products.length > 0);
  }

  function productsFromSearchIndex(si) {
    if (!si || !Array.isArray(si.entries)) return [];
    return si.entries
      .map(function (e) {
        if (!e || !e.id) return null;
        return {
          id: e.id,
          name: e.name || e.id,
          display_name: e.display_name || e.name || e.id,
          category: e.category || "",
          tags: e.tags || [],
          indexes: e.indexes || [],
          index_bases: e.index_bases || [],
          search_blob: e.search_blob || "",
          path: e.path || "",
          brand: e.brand || "",
          subcategory_label: e.subcategory || "",
          _fromSearchIndex: true,
        };
      })
      .filter(Boolean);
  }

  /** Fast bootstrap: search-index only (no 8MB file-index parse on click). */
  function ensureSearchIndexBootstrap() {
    if (global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.entries) {
      return Promise.resolve(global._DAM_SEARCH_INDEX);
    }
    if (global.DamSearch && typeof global.DamSearch.loadSearchOnly === "function") {
      return global.DamSearch.loadSearchOnly().then(function (si) {
        return si || global._DAM_SEARCH_INDEX || { entries: [] };
      });
    }
    return fetchWithTimeout("data/search-index.json?v=" + Date.now(), 5000)
      .then(function (r) {
        if (!r.ok) throw new Error("search-index_http_" + r.status);
        return r.text();
      })
      .then(function (text) {
        var parse =
          global.DamSearch && typeof global.DamSearch.parseJsonInWorker === "function"
            ? global.DamSearch.parseJsonInWorker(text, "search-index", 12000)
            : Promise.resolve().then(function () {
                return JSON.parse(text);
              });
        return parse.then(function (d) {
          global._DAM_SEARCH_INDEX = d;
          return d;
        });
      });
  }

  var __assocCatalogInflight = null;

  /** Apply search-index products onto global stub; never leave products:[] as "warm". */
  function applyLightProductCatalog(products) {
    var list = Array.isArray(products) ? products : [];
    /* Never keep a warm full file-index when picker needs light search-index rows. */
    if (isLightProductCatalog()) return global._DAM_FILE_INDEX;
    if (!global._DAM_FILE_INDEX) {
      global._DAM_FILE_INDEX = { products: list, _fromSearchIndex: true };
    } else {
      global._DAM_FILE_INDEX.products = list;
      global._DAM_FILE_INDEX._fromSearchIndex = true;
    }
    return global._DAM_FILE_INDEX;
  }

  /**
   * Light catalog for pickers / enrich: search-index products only.
   * NEVER call DamSearch.load() here (it pulls ~8MB file-index and freezes UI).
   */
  function ensureFileIndex(opts) {
    opts = opts || {};
    if (isLightProductCatalog() && !opts.forceLight) {
      return Promise.resolve(global._DAM_FILE_INDEX);
    }
    if (hasWarmProductCatalog() && !opts.forceLight && !opts.allowFull) {
      /* Full file-index warm (e.g. viz page) - still serve light catalog for pickers. */
      if (__assocCatalogInflight) return __assocCatalogInflight;
    } else if (hasWarmProductCatalog() && opts.allowFull && !opts.forceLight) {
      return Promise.resolve(global._DAM_FILE_INDEX);
    }
    if (__assocCatalogInflight) return __assocCatalogInflight;
    __assocCatalogInflight = ensureSearchIndexBootstrap()
      .then(function (si) {
        var products = productsFromSearchIndex(si);
        var fi = applyLightProductCatalog(products);
        __assocCatalogInflight = null;
        return fi;
      })
      .catch(function (e) {
        __assocCatalogInflight = null;
        console.error("[DamAssocEdit] light catalog failed", e);
        return applyLightProductCatalog([]) || { products: [] };
      });
    return __assocCatalogInflight;
  }

  /** Session cache: branding picker uses /branding-search-picker (never full ~40MB JSON). */
  var __damAssocBrandingPickerInflight = null;

  function searchBrandingPicker(query, limit, includeIds) {
    var q = String(query || "").trim();
    var lim = Math.max(1, Math.min(parseInt(limit, 10) || 80, 120));
    var params = "q=" + encodeURIComponent(q) + "&limit=" + String(lim);
    var inc = (includeIds || []).filter(Boolean);
    if (inc.length) params += "&include=" + encodeURIComponent(inc.join(","));
    return fetchWithTimeout(bridgeUrl() + "/branding-search-picker?" + params + "&v=" + Date.now(), 5000)
      .then(function (r) {
        if (!r.ok) throw new Error("branding_picker_http_" + r.status);
        return r.json();
      })
      .then(function (d) {
        var entries = (d && d.entries) || [];
        var byId = {};
        entries.forEach(function (e) {
          if (e && e.id) byId[e.id] = e;
        });
        return { entries: entries, byId: byId };
      });
  }

  function ensureBrandingSearchIndex() {
    /* Legacy name: picker only ever loads a capped slice from bridge. */
    return searchBrandingPicker("", 80, []);
  }

  function brandingThumb(entry) {
    if (!entry || !entry.path) return PLACEHOLDER_SVG;
    if (global.DamPreviewTruth && typeof global.DamPreviewTruth.thumbCacheUrl === "function") {
      return global.DamPreviewTruth.thumbCacheUrl(entry.path, "grid");
    }
    if (global.DamMediaPreview && typeof global.DamMediaPreview.previewUrl === "function") {
      return global.DamMediaPreview.previewUrl(entry.path, entry);
    }
    return PLACEHOLDER_SVG;
  }

  function brandingLabel(entry) {
    if (!entry) return "";
    if (entry.name) return entry.name;
    var p = String(entry.path || "").replace(/\\/g, "/");
    var i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(i + 1) : p || entry.id || "";
  }

  /** Tab switch: click inactive tab only (no XOR flip on active tab). */
  function commitAssocListTab(nextTab, curTab, brandingDisabled) {
    nextTab = nextTab === "branding" ? "branding" : "products";
    if (brandingDisabled) return "products";
    if (nextTab === curTab) return curTab;
    return nextTab;
  }

  /** Variant row thumb without sync previewUrl (freeze: ~150× previewUrl blocked WebView2). */
  function variantThumbFast(v) {
    if (!v) return PLACEHOLDER_SVG;
    var existing = v.thumb || v.thumb_url || "";
    if (existing && String(existing).indexOf("data:image/svg+xml") !== 0) return existing;
    return PLACEHOLDER_SVG;
  }

  function collectBrandingIdsFromCtx(ctx) {
    var ids = [];
    var seen = {};
    function add(id) {
      id = String(id || "").trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      ids.push(id);
    }
    var gc = (ctx && ctx.groupContext) || {};
    (gc.variants || []).forEach(function (v) {
      if (v && v.id) add(v.id);
    });
    var asset = (ctx && ctx.asset) || {};
    (asset.folder_variants || asset.variants || []).forEach(function (v) {
      if (v && v.id) add(v.id);
    });
    return ids;
  }

  function productIndexOf(p) {
    if (!p) return "";
    var idx = "";
    if (p.indexes && p.indexes.length) idx = String(p.indexes[0]);
    else if (p.revisions && p.revisions[0] && p.revisions[0].index) idx = String(p.revisions[0].index);
    if (idx && idx.indexOf(".") > 0) idx = idx.split(".")[0];
    return idx;
  }

  /**
   * Pelny blob wyszukiwania produktu: nazwa + id + WSZYSTKIE indeksy (pelne i
   * bazowe) + tagi + gotowy search_blob z indeksu. Dzieki temu dziala szukanie
   * po dokladnym indeksie wariantu (np. 6300539.01), nie tylko po indexes[0].
   */
  function productSearchBlob(p) {
    if (!p) return "";
    var parts = [
      p.search_blob || "",
      p.display_name || "",
      p.name || "",
      p.id || "",
      (p.indexes || []).join(" "),
      (p.index_bases || []).join(" "),
      (p.tags || []).join(" "),
    ];
    return parts.join(" ").toLowerCase();
  }

  /** Light search on search-index only — never walks full file-index.revisions. */
  function searchProductIdsFromIndex(q, cap) {
    cap = Math.max(1, cap || 120);
    var si = global._DAM_SEARCH_INDEX;
    if (!si || !Array.isArray(si.entries)) return [];
    var nq = String(q || "")
      .toLowerCase()
      .trim();
    if (!nq) return [];
    var idSet = {};
    var ordered = [];
    function pushId(id) {
      id = String(id || "").trim();
      if (!id || idSet[id] || ordered.length >= cap) return;
      idSet[id] = true;
      ordered.push(id);
    }
    var dig = nq.replace(/\D/g, "");
    var numericOnly = /^[\d.\s]+$/.test(nq.replace(/\s/g, ""));
    if (dig.length >= 4 && si.by_prefix) {
      for (var L = Math.min(dig.length, 10); L >= 4; L--) {
        var pref = dig.slice(0, L);
        var arr = si.by_prefix[pref];
        if (arr && arr.length) {
          arr.forEach(function (pid) {
            pushId(pid);
          });
          break;
        }
      }
      /* HARD: brak prefixu dla numeru — nie skanuj calego katalogu (freeze UI). */
      if (!ordered.length && numericOnly) return [];
    }
    if (ordered.length < cap) {
      var entryScanCap = 600;
      for (var i = 0; i < si.entries.length && ordered.length < cap && i < entryScanCap; i++) {
        var e = si.entries[i];
        if (!e || !e.id) continue;
        var blob = (
          String(e.search_blob || "") +
          " " +
          String(e.name || "") +
          " " +
          String(e.display_name || "") +
          " " +
          String(e.id || "") +
          " " +
          (e.indexes || []).join(" ") +
          " " +
          (e.index_bases || []).join(" ") +
          " " +
          (e.tags || []).join(" ")
        ).toLowerCase();
        if (blob.indexOf(nq) === -1) continue;
        pushId(e.id);
      }
    }
    return ordered;
  }

  function findSearchEntryById(id) {
    var si = global._DAM_SEARCH_INDEX;
    if (!si || !Array.isArray(si.entries)) return null;
    id = String(id || "").trim();
    if (!id) return null;
    for (var i = 0; i < si.entries.length; i++) {
      var e = si.entries[i];
      if (e && e.id === id) return e;
    }
    return null;
  }

  function productStubById(id, productById, entryById) {
    if (productById && productById[id]) return productById[id];
    var e = (entryById && entryById[id]) || findSearchEntryById(id);
    if (!e) return null;
    var stub = productsFromSearchIndex({ entries: [e] });
    return stub[0] || null;
  }

  function normPath(s) {
    return String(s == null ? "" : s)
      .replace(/\\/g, "/")
      .replace(/\/+$/, "")
      .toLowerCase();
  }

  /** Dopasuj produkty do wskazanego folderu na dysku (po sciezce). */
  function matchProductsByFolder(products, folder) {
    var f = normPath(folder);
    if (!f) return [];
    var exact = [];
    var under = [];
    var parent = [];
    (products || []).forEach(function (p) {
      var pp = normPath(p && p.path);
      if (!pp) return;
      if (pp === f) exact.push(p.id);
      else if (pp.indexOf(f + "/") === 0) under.push(p.id);
      else if (f.indexOf(pp + "/") === 0) parent.push(p.id);
    });
    if (exact.length) return exact;
    if (under.length) return under;
    return parent;
  }

  var ASSOC_CSS_ID = "damAssocEditInjectedCss";
  /** Keyboard Shift latch - mouseleave/mousemove must not clear while key is down. */
  var shiftKeyDown = false;

  /** Wstrzykuje style: Bento grid + pkt 36 podglad LEWA | lista PRAWA (nie ruszamy plikow agentow). */
  function ensureInjectedCss() {
    var css =
      /* Shell / bento grid popover - HARD: 80vw × 90vh (cap 1400px; branding + viz) */
      ".dam-assoc-edit-overlay{overflow:hidden;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover.dam-assoc-edit-popover," +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover--wide.dam-assoc-edit-popover{" +
      "display:grid!important;grid-template-columns:minmax(0,1fr);" +
      "grid-template-rows:auto auto auto minmax(0,1fr) auto;" +
      "grid-template-areas:'head' 'pinned' 'search' 'body' 'actions';" +
      "width:min(80vw,1400px)!important;min-width:min(80vw,calc(100vw - 16px))!important;" +
      "max-width:min(80vw,1400px)!important;" +
      "height:90vh!important;min-height:90vh!important;max-height:90vh!important;" +
      "overflow-x:hidden!important;overflow-y:hidden!important;}" +
      ".dam-assoc-edit-popover > .dam-tag-edit-popover__head{grid-area:head;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__pinned-wrap{grid-area:pinned;min-width:0;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__section-sep{display:none;}" +
      ".dam-assoc-edit-popover > .dam-tag-edit-popover__search-wrap{grid-area:search;margin:0!important;" +
      "padding:10px 14px;border-bottom:1px solid #ececf2;display:flex;flex-direction:column;gap:8px;}" +
      ".dam-assoc-edit-popover__tabs{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}" +
      ".dam-assoc-edit-popover__tab{min-height:32px;padding:0 12px;border-radius:999px;border:1px solid #e2e2ea;" +
      "background:#fff;color:#6b6b76;font-size:11px;font-weight:600;cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease;}" +
      ".dam-assoc-edit-popover__tab.is-active{background:color-mix(in srgb,var(--dam-primary,#ab54db) 14%,#fff);" +
      "border-color:color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#fff);color:#7a3aa8;}" +
      ".dam-assoc-edit-popover__tab[aria-disabled='true']{opacity:.45;cursor:not-allowed;pointer-events:none;}" +
      ".dam-assoc-edit-popover__search-row{display:flex;align-items:center;gap:8px;min-width:0;}" +
      ".dam-assoc-edit-popover__search-row .dam-tag-edit-popover__search{flex:1 1 auto;min-width:0;}" +
      ".dam-assoc-edit-popover__opt-row.is-pending-remove{opacity:.62;background:#fffbeb!important;" +
      "box-shadow:inset 0 0 0 1px #fde68a;}" +
      ".dam-assoc-edit-popover__soft-x{width:28px;height:28px;flex:0 0 28px;display:inline-flex;align-items:center;" +
      "justify-content:center;border:1px solid #fecaca;border-radius:7px;background:#fff;color:#dc2626;cursor:pointer;font-size:14px;}" +
      ".dam-assoc-edit-popover__soft-x:hover{background:#fef2f2;}" +
      ".dam-assoc-edit-popover__undo-btn{min-height:28px;padding:0 10px;border-radius:7px;border:1px solid #fcd34d;" +
      "background:#fef9c3;color:#854d0e;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;}" +
      ".dam-assoc-edit-popover__undo-btn:hover{background:#fef08a;}" +
      ".dam-assoc-edit-popover__summary{padding:12px 14px;overflow-y:auto;min-height:0;}" +
      ".dam-assoc-edit-popover__summary-title{margin:0 0 8px;font-size:12px;font-weight:700;color:#464255;}" +
      ".dam-assoc-edit-popover__summary-list{display:flex;flex-direction:column;gap:6px;}" +
      ".dam-assoc-edit-popover__summary-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;" +
      "background:#f7f6fa;border:1px solid #ececf2;font-size:12px;color:#464255;}" +
      ".dam-assoc-edit-popover__summary-row.is-remove{background:#fffbeb;border-color:#fde68a;color:#92400e;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__body{grid-area:body;min-height:0;min-width:0;overflow:hidden;}" +
      ".dam-assoc-edit-popover > .dam-tag-edit-popover__actions{grid-area:actions;}" +
      /* Body: preview LEFT | list RIGHT (scroll w liscie) */
      ".dam-assoc-edit-popover__body{display:grid;grid-template-columns:minmax(180px,22%) minmax(0,1fr);gap:12px;" +
      "padding:12px 14px;min-height:0;overflow:hidden;}" +
      ".dam-assoc-edit-popover__preview{min-width:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;" +
      "gap:6px;align-content:start;}" +
      ".dam-assoc-edit-popover__preview-label{margin:0;font-size:10px;font-weight:700;letter-spacing:.08em;" +
      "text-transform:uppercase;color:#8b8d97;}" +
      ".dam-assoc-edit-popover__preview-frame{position:relative;min-height:168px;aspect-ratio:1;" +
      "display:flex;align-items:center;justify-content:center;" +
      "background:linear-gradient(180deg,#faf9fc 0%,#f3f1f7 100%);border:1px solid #ececf1;" +
      "border-radius:14px;overflow:hidden;padding:12px;}" +
      ".dam-assoc-edit-popover__preview-frame img{max-width:100%;max-height:100%;width:auto;height:auto;" +
      "object-fit:contain;border-radius:8px;}" +
      ".dam-assoc-edit-popover__preview-frame img.is-placeholder{opacity:0;position:absolute;width:1px;height:1px;}" +
      ".dam-assoc-edit-popover__preview-empty{display:none;flex-direction:column;align-items:center;justify-content:center;" +
      "gap:6px;color:#a8a8b3;font-size:11px;font-weight:500;}" +
      ".dam-assoc-edit-popover__preview-empty i{font-size:28px;color:#c4bdd2;}" +
      ".dam-assoc-edit-popover__preview.is-empty .dam-assoc-edit-popover__preview-empty{display:flex;}" +
      ".dam-assoc-edit-popover__preview-caption{font-size:12px;font-weight:600;color:#464255;line-height:1.3;" +
      "text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}" +
      ".dam-assoc-edit-popover__preview-meta{font-size:10px;font-weight:600;color:#8b8d97;text-align:center;" +
      "letter-spacing:.02em;font-variant-numeric:tabular-nums;}" +
      /* List: equal-height rows, no horizontal scroll */
      ".dam-assoc-edit-popover__body .dam-assoc-edit-popover__list," +
      ".dam-assoc-edit-popover__body .dam-tag-edit-popover__list{" +
      "min-width:0;max-height:none;height:100%;overflow-x:hidden!important;overflow-y:auto;" +
      "padding:0;display:flex;flex-direction:column;gap:4px;scrollbar-width:thin;}" +
      ".dam-assoc-edit-popover__opt-row{display:flex!important;flex-direction:row;align-items:stretch;" +
      "gap:4px;border-radius:10px;min-width:0;min-height:64px;width:100%;box-sizing:border-box;}" +
      ".dam-assoc-edit-popover__opt-row .dam-assoc-edit-popover__opt{flex:1 1 auto;min-width:0;}" +
      ".dam-assoc-edit-popover__opt{display:flex!important;flex-direction:row;align-items:center;gap:10px;" +
      "width:100%;min-height:64px;padding:8px 10px!important;border-radius:10px;box-sizing:border-box;}" +
      ".dam-assoc-edit-popover__thumb-wrap{flex:0 0 52px;}" +
      ".dam-assoc-edit-popover__check{flex:0 0 22px;}" +
      ".dam-assoc-edit-popover__thumb{width:52px!important;height:52px!important;object-fit:contain;" +
      "border-radius:8px;background:#f4f4f6;border:1px solid #ececf1;}" +
      ".dam-assoc-edit-popover__meta{min-width:0;overflow:hidden;}" +
      ".dam-assoc-edit-popover__label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" +
      "font-size:13px;font-weight:600;color:#464255;}" +
      /* Tagi jak na kartach viz (DK / BATONY / Mixy / PL) - nie tiny cut-off */
      ".dam-assoc-edit-popover__tags{display:flex;flex-wrap:wrap;gap:4px;max-height:none;overflow:visible;margin-top:4px;}" +
      ".dam-assoc-edit-popover__tags .dam-viz-badge{" +
      "font-size:calc((var(--dam-tag-fs-pill,10.5px) + 1px) * var(--dam-badge-scale,1.05))!important;font-weight:500;" +
      "padding:calc(5px * var(--dam-badge-scale,1.05)) calc(11px * var(--dam-badge-scale,1.05))!important;border-radius:999px;letter-spacing:.01em;line-height:1.25;" +
      "white-space:nowrap;max-width:100%;cursor:default;}" +
      ".dam-assoc-edit-popover__tags .dam-viz-badge--index{cursor:copy;user-select:text;}" +
      ".dam-assoc-edit-popover__row-actions{display:flex;align-items:center;gap:3px;flex-shrink:0;padding-right:4px;}" +
      ".dam-assoc-edit-popover__row-btn{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;" +
      "border:1px solid #e7e7ec;border-radius:7px;background:#fff;color:#6b6b76;cursor:pointer;font-size:14px;" +
      "transition:background .12s ease,color .12s ease,border-color .12s ease;}" +
      ".dam-assoc-edit-popover__row-btn:hover{background:#f8f4fd;color:var(--dam-primary,#ab54db);border-color:#e2d3f2;}" +
      ".dam-assoc-edit-popover__opt.is-pinned:not(.is-selected) .dam-assoc-edit-popover__check{color:#e2506b;}" +
      ".dam-assoc-edit-popover__opt.is-pinned .dam-assoc-edit-popover__check{width:22px;font-size:17px;}" +
      ".dam-assoc-edit-popover__opt.is-preview-active{background:#f8f4fd!important;" +
      "box-shadow:inset 0 0 0 1px #e2d3f2;}" +
      ".dam-assoc-edit-popover__pinned{max-height:min(22dvh,160px);overflow-x:hidden;overflow-y:auto;}" +
      /* Shift-gated bubble minus (brandComposer20260721a / minusGlobal): ×0.8 (26→21) Geex chip;
         assoc-item + all-file quality tiles (studio show-all). NOT flat fat disc. */
      ".dam-media-preview__assoc-grid.is-shift-hover," +
      ".dam-media-preview__variant-grid.is-shift-hover," +
      ".dam-media-preview__all-files.is-shift-hover," +
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-media-preview__assoc-item," +
      ".dam-media-preview__variant-grid.is-shift-hover .dam-media-preview__assoc-item{position:relative;}" +
      ".dam-media-preview__assoc-item," +
      ".dam-media-preview__all-file," +
      ".dam-viz-modal__variant{position:relative;}" +
      ".dam-media-preview__assoc-item .dam-assoc-quick-minus," +
      ".dam-media-preview__all-file .dam-assoc-quick-minus," +
      ".dam-viz-modal__variant .dam-assoc-quick-minus{" +
      "position:absolute;top:3px;right:3px;z-index:4;width:21px;height:21px;border-radius:999px;" +
      "border:1px solid rgba(255,255,255,.96);" +
      "background:linear-gradient(180deg,color-mix(in srgb,#ef4444 88%,#fff) 0%,#dc2626 100%);" +
      "color:#fff;display:inline-flex;align-items:center;justify-content:center;" +
      "cursor:pointer;padding:0;box-sizing:border-box;" +
      "box-shadow:0 1px 2px rgba(40,36,56,.10),0 2px 6px rgba(220,38,38,.16);" +
      "opacity:0!important;visibility:hidden!important;pointer-events:none!important;" +
      "transition:opacity .12s ease,visibility .12s ease,background .12s ease,transform .12s ease,box-shadow .12s ease;}" +
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-assoc-quick-minus," +
      ".dam-media-preview__variant-grid.is-shift-hover .dam-assoc-quick-minus," +
      ".dam-media-preview__variant-grid.is-shift-hover .dam-viz-modal__variant .dam-assoc-quick-minus," +
      ".dam-media-preview__all-files.is-shift-hover .dam-assoc-quick-minus," +
      ".dam-assoc-quick-minus.is-shift-visible{" +
      "opacity:1!important;visibility:visible!important;pointer-events:auto!important;}" +
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-assoc-quick-minus:hover," +
      ".dam-media-preview__variant-grid.is-shift-hover .dam-assoc-quick-minus:hover," +
      ".dam-media-preview__all-files.is-shift-hover .dam-assoc-quick-minus:hover," +
      ".dam-assoc-quick-minus.is-shift-visible:hover," +
      ".dam-assoc-quick-minus.is-hover-force{" +
      "opacity:1!important;visibility:visible!important;pointer-events:auto!important;" +
      "background:linear-gradient(180deg,#ef4444 0%,#dc2626 100%);transform:scale(1.05);" +
      "box-shadow:0 1px 2px rgba(40,36,56,.12),0 3px 8px rgba(220,38,38,.22);}" +
      ".dam-assoc-quick-minus.is-holding{" +
      "background:linear-gradient(180deg,#dc2626 0%,#b91c1c 100%);transform:scale(.98);" +
      "box-shadow:inset 0 0 0 1px rgba(255,255,255,.85),0 2px 6px rgba(220,38,38,.2);}" +
      ".dam-assoc-quick-minus i{" +
      "font-size:0!important;line-height:0;pointer-events:none;display:block;" +
      "width:9px;height:2.5px;background:#fff;border-radius:2px;" +
      "box-shadow:0 0 0 0.5px rgba(255,255,255,.35);}" +
      ".dam-assoc-quick-minus i::before{content:none!important;display:none!important;}" +
      /* Square Dodaj (= thumb slot 70×70). Shift+Admin only via html.is-shift-revealed / is-shift-hover. */
      ".dam-media-preview__assoc-plus-tile{" +
      "display:none;flex-direction:column;align-items:center;justify-content:center;gap:2px;" +
      "box-sizing:border-box;width:70px;height:70px;min-width:70px;min-height:70px;" +
      "max-width:70px;max-height:70px;aspect-ratio:1;padding:4px;" +
      "border:1.5px dashed color-mix(in srgb,var(--dam-primary,#ab54db) 45%,var(--dam-border,#d7d7e0));" +
      "border-radius:8px;background:color-mix(in srgb,var(--dam-primary,#ab54db) 6%,var(--dam-surface,#fff));" +
      "color:var(--dam-primary,#7a3aa8);" +
      "cursor:pointer;font-size:10px;font-weight:600;justify-self:start;align-self:start;line-height:1.15;}" +
      "html.is-shift-revealed .dam-media-preview__assoc-plus-tile," +
      ".dam-media-preview__assoc-plus-tile.is-shift-revealed," +
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-media-preview__assoc-plus-tile," +
      ".dam-media-preview__variant-grid.is-shift-hover .dam-media-preview__assoc-plus-tile{display:flex!important;}" +
      ".dam-media-preview__assoc-plus-tile i{font-size:20px;line-height:1;}" +
      ".dam-media-preview__assoc-plus-tile span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".dam-media-preview__assoc-plus-tile:hover{background:color-mix(in srgb,var(--dam-primary,#ab54db) 12%,var(--dam-surface,#fff));" +
      "border-color:var(--dam-primary,#ab54db);}" +
      "html[data-theme=\"dark\"] .dam-media-preview__assoc-plus-tile{" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 14%,var(--dam-surface,#201f28));" +
      "color:color-mix(in srgb,var(--dam-primary,#ab54db) 75%,#fff);}" +
      /* Footer DAM */
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__actions{" +
      "display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;" +
      "padding:12px 14px;background:#f7f6fa;border-top:1px solid #ececf2;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm," +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__cancel{" +
      "min-height:40px;padding:0 16px;border-radius:10px!important;font-size:12.5px;font-weight:600;" +
      "gap:6px;border-width:1px!important;box-shadow:none;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm{" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 14%,#fff);" +
      "border-color:color-mix(in srgb,var(--dam-primary,#ab54db) 55%,#fff);" +
      "color:#7a3aa8;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm:hover{" +
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 22%,#fff);}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm[data-confirm]{" +
      "background:var(--dam-primary,#ab54db);border-color:var(--dam-primary,#ab54db);color:#fff;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm[data-confirm]:hover{" +
      "filter:brightness(1.05);}" +
      ".dam-assoc-edit-overlay .dam-assoc-edit-popover__disk{" +
      "background:#fff;border-color:#e2e2ea;color:#464255;}" +
      ".dam-assoc-edit-overlay .dam-assoc-edit-popover__disk:hover{" +
      "background:#f8f4fd;border-color:#e2d3f2;color:#7a3aa8;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__cancel{" +
      "background:#fff;border-color:#e2e2ea;color:#6b6b76;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__cancel:hover{" +
      "background:#f4f4f6;color:#464255;}" +
      /* Breakpoints */
      "@media (max-width:767.98px){" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover.dam-assoc-edit-popover{" +
      "width:min(96vw,calc(100vw - 12px))!important;max-width:min(96vw,calc(100vw - 12px))!important;" +
      "height:90vh!important;min-height:90vh!important;max-height:90vh!important;}" +
      ".dam-assoc-edit-popover__body{grid-template-columns:1fr;grid-template-rows:auto minmax(120px,1fr);}" +
      ".dam-assoc-edit-popover__preview-frame{min-height:140px;max-height:160px;aspect-ratio:auto;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__actions{justify-content:stretch;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm," +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__cancel{flex:1 1 auto;}" +
      "}" +
      "@media (min-width:768px){" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover.dam-assoc-edit-popover{" +
      "width:min(80vw,1400px)!important;max-width:min(80vw,1400px)!important;" +
      "height:90vh!important;min-height:90vh!important;max-height:90vh!important;}" +
      ".dam-assoc-edit-popover__body{grid-template-columns:minmax(180px,24%) minmax(0,1fr);}" +
      "}";
    var style = document.getElementById(ASSOC_CSS_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = ASSOC_CSS_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function normIndexKey(idx) {
    var s = String(idx == null ? "" : idx).trim().toLowerCase();
    if (!s) return "";
    if (s.indexOf(".") > 0) s = s.split(".")[0];
    return s.replace(/[^a-z0-9]+/g, "");
  }

  /** Czy rekord wyglada na wizualizacje (nie proponowac jako skojarzony produkt). */
  function isVisualizationLike(p) {
    if (!p) return false;
    var kind = String(p.kind || p.type || p.asset_type || p.record_type || "").toLowerCase();
    if (kind === "viz" || kind === "visualization" || kind === "wizualizacja") return true;
    var blob = [
      p.path || "",
      p.category || "",
      p.id || "",
      p.display_name || "",
      ((p.revisions && p.revisions[0]) || {}).path || "",
      ((p.revisions && p.revisions[0]) || {}).viz_path || "",
    ].join(" ");
    return /WIZKI|wizualizac|\bviz-2\b|\bviz-\d|\b\/viz\b/i.test(blob);
  }

  /** Zbior id/indeksow zrodlowych - zakaz self-assoc / petli. */
  function buildAssocExclude(opts) {
    var ids = {};
    var indexes = {};
    function addId(id) {
      if (id) ids[String(id)] = true;
    }
    function addIdx(idx) {
      var k = normIndexKey(idx);
      if (k) indexes[k] = true;
    }
    (opts.excludeIds || []).forEach(addId);
    (opts.excludeIndexes || []).forEach(addIdx);
    var src = opts.sourceProduct || opts.product || null;
    if (src) {
      addId(src.id);
      addIdx(productIndexOf(src));
      (src.indexes || []).forEach(addIdx);
      (src.index_bases || []).forEach(addIdx);
    }
    var gc = opts.groupContext || {};
    addId(gc.product_id || gc.source_product_id || gc.sourceProductId);
    addIdx(gc.product_index || gc.index || gc.source_index);
    var a = opts.asset;
    if (a) {
      addId(a.product_id || a.source_product_id);
      addIdx(a.product_index || a.index);
      if (String(a.type || a.kind || "").toLowerCase() === "product") addId(a.id);
    }
    return { ids: ids, indexes: indexes };
  }

  function productMatchesExclude(p, excl) {
    if (!p || !excl) return false;
    if (p.id && excl.ids[String(p.id)]) return true;
    var base = normIndexKey(productIndexOf(p));
    if (base && excl.indexes[base]) return true;
    var list = [].concat(p.indexes || [], p.index_bases || []);
    for (var i = 0; i < list.length; i++) {
      var k = normIndexKey(list[i]);
      if (k && excl.indexes[k]) return true;
    }
    return false;
  }

  var __vizLatestThumbByProduct = null;

  function vizLatestThumbForProduct(productId) {
    if (!productId) return "";
    if (!__vizLatestThumbByProduct) {
      __vizLatestThumbByProduct = {};
      var latest = (global._DAM_FILE_INDEX && global._DAM_FILE_INDEX.viz_latest) || [];
      latest.forEach(function (row) {
        if (row && row.product_id && row.thumb_url && !__vizLatestThumbByProduct[row.product_id]) {
          __vizLatestThumbByProduct[row.product_id] = String(row.thumb_url);
        }
      });
    }
    return __vizLatestThumbByProduct[productId] || "";
  }

  function productThumb(p) {
    if (!p) return PLACEHOLDER_SVG;
    var existing = p.thumb_url != null ? String(p.thumb_url).trim() : "";
    if (existing && existing.indexOf("data:image/svg+xml") !== 0) {
      if (/^(data:|blob:|https?:|\/|data\/)/i.test(existing) || existing.indexOf("thumbs/") >= 0) {
        return existing;
      }
    }
    var slug = String(p.id || "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96)
      .toLowerCase();
    if (!slug) return PLACEHOLDER_SVG;
    var idx = productIndexOf(p);
    if (!idx) {
      var rev = (p.revisions && p.revisions[0]) || {};
      if (rev.index) idx = String(rev.index).split(".")[0];
    }
    if (!idx) {
      var fromLatest = vizLatestThumbForProduct(p.id);
      if (fromLatest) return fromLatest;
      return PLACEHOLDER_SVG;
    }
    var base = String(idx).replace(/[^0-9A-Za-z]+/g, "") || idx;
    return "data/thumbs/" + slug + "__" + base + "_pl.jpg";
  }

  function enrichLinkedProducts(list) {
    return ensureFileIndex().then(function (fi) {
      var byId = {};
      (fi && fi.products ? fi.products : []).forEach(function (p) {
        if (p && p.id) byId[p.id] = p;
      });
      return (list || []).map(function (lp) {
        var p = byId[lp.id] || lp;
        return {
          id: lp.id,
          display_name: lp.display_name || p.display_name || p.name || lp.id,
          thumb_url: lp.thumb_url || productThumb(p),
          product_index: lp.product_index || productIndexOf(p),
          path: p.path || lp.path || "",
          search_blob: p.search_blob || lp.search_blob || "",
          category: p.category || lp.category || "",
          subcategory_label: p.subcategory_label || p.subcategory || "",
          tags: p.tags || lp.tags || [],
          indexes: p.indexes || [],
          index_bases: p.index_bases || [],
          brand: p.brand || "",
        };
      });
    });
  }

  /* Pkt 9 brief 2026-07-20: powiekszony podglad miniatury ~400x400 nad popoverem */
  function hideThumbZoom() {
    var el = document.getElementById("damAssocThumbZoom");
    if (el) el.remove();
  }

  function showThumbZoom(anchor, src) {
    hideThumbZoom();
    if (!src || !anchor) return;
    var el = document.createElement("div");
    el.id = "damAssocThumbZoom";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;z-index:12400;width:400px;height:400px;background:#fff;" +
      "border:1px solid rgba(70,66,85,0.14);border-radius:14px;" +
      "box-shadow:0 18px 48px rgba(28,24,44,0.28);padding:8px;pointer-events:none;" +
      "display:flex;align-items:center;justify-content:center;overflow:hidden;";
    var img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.style.cssText = "max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;";
    img.onerror = function () {
      hideThumbZoom();
    };
    el.appendChild(img);
    document.body.appendChild(el);
    var r = anchor.getBoundingClientRect();
    var margin = 12;
    var left = r.right + margin;
    if (left + 400 > window.innerWidth - 8) left = r.left - 400 - margin;
    if (left < 8) left = 8;
    var top = r.top + r.height / 2 - 200;
    top = Math.max(8, Math.min(top, window.innerHeight - 408));
    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  function bindThumbZoom(scope) {
    if (!scope) return;
    scope.querySelectorAll(".dam-assoc-edit-popover__thumb-wrap").forEach(function (wrap) {
      var img = wrap.querySelector("img");
      if (!img) return;
      wrap.addEventListener("mouseenter", function () {
        showThumbZoom(wrap, img.currentSrc || img.src);
      });
      wrap.addEventListener("mouseleave", hideThumbZoom);
    });
  }

  function isPlaceholderThumb(src) {
    var s = String(src || "");
    return !s || s.indexOf("data:image/svg+xml") === 0;
  }

  /* Pkt 36: staly panel podgladu po LEWEJ od listy wynikow */
  function setSearchPreview(pop, data) {
    if (!pop) return;
    var panel = pop.querySelector("#damAssocEditPreview");
    if (!panel) return;
    var img = panel.querySelector(".dam-assoc-edit-popover__preview-frame img");
    var empty = panel.querySelector(".dam-assoc-edit-popover__preview-empty");
    var cap = panel.querySelector(".dam-assoc-edit-popover__preview-caption");
    var meta = panel.querySelector(".dam-assoc-edit-popover__preview-meta");
    var src = (data && data.thumb) || "";
    if (src && src.indexOf("http://127.0.0.1") === 0) {
      /* normalize absolute → relative for same-origin thumbs */
      try {
        src = src.replace(/^https?:\/\/127\.0\.0\.1:\d+\//, "");
      } catch (e) {}
    }
    var label = (data && data.label) || "Najedź wynik, aby podejrzeć";
    var sub = (data && data.sub) || "";
    var emptyThumb = isPlaceholderThumb(src);
    if (img) {
      img.alt = label;
      img.classList.toggle("is-placeholder", emptyThumb);
      if (emptyThumb) {
        img.removeAttribute("src");
      } else {
        img.onerror = function () {
          img.onerror = null;
          img.classList.add("is-placeholder");
          img.removeAttribute("src");
          panel.classList.add("is-empty");
          if (empty) empty.style.display = "";
        };
        img.onload = function () {
          img.classList.remove("is-placeholder");
          panel.classList.remove("is-empty");
        };
        img.src = src;
      }
    }
    if (cap) cap.textContent = label;
    if (meta) meta.textContent = sub || "";
    panel.classList.toggle("is-empty", emptyThumb || !data);
    if (empty) {
      var emptyTxt = empty.querySelector("span");
      if (emptyTxt) {
        emptyTxt.textContent = data && data.label ? "Brak miniatury" : "Najedź wynik";
      }
    }
    pop.querySelectorAll(".dam-assoc-edit-popover__opt.is-preview-active").forEach(function (el) {
      el.classList.remove("is-preview-active");
    });
    if (data && data.btn) data.btn.classList.add("is-preview-active");
  }

      function bindSearchPreview(pop, scope) {
    if (!pop || !scope) return;
    scope.querySelectorAll(".dam-assoc-edit-popover__opt[data-id]").forEach(function (btn) {
      function activate() {
        var thumb = btn.querySelector(".dam-assoc-edit-popover__thumb");
        var labelEl = btn.querySelector(".dam-assoc-edit-popover__label");
        var idxBadge = btn.querySelector(".dam-viz-badge--index");
        var src = "";
        if (thumb) {
          src = thumb.getAttribute("src") || thumb.currentSrc || thumb.src || "";
        }
        setSearchPreview(pop, {
          thumb: src,
          label: labelEl ? labelEl.textContent : btn.getAttribute("data-id") || "",
          sub: idxBadge ? idxBadge.textContent : "",
          btn: btn,
        });
      }
      btn.addEventListener("mouseenter", activate);
      btn.addEventListener("focus", activate);
      btn.addEventListener("focusin", activate);
    });
  }

  function stripCategoryPrefix(s) {
    return String(s || "").replace(/^\d+\s*-\s*/, "").trim();
  }

  function closeVizMaterialAddPopover() {
    var pop = document.getElementById("damVizMaterialAddPopover");
    if (pop) {
      if (typeof pop._damVizMatCleanup === "function") pop._damVizMatCleanup();
      pop.remove();
    }
    document.removeEventListener("click", onVizMatDocClick, true);
    document.removeEventListener("keydown", onVizMatDocKey, true);
  }

  function closeBrandingProductAddPopover() {
    var pop = document.getElementById("damBrandingProductAddPopover");
    if (pop) {
      if (typeof pop._damBrandProdCleanup === "function") pop._damBrandProdCleanup();
      pop.remove();
    }
    document.removeEventListener("click", onBrandProdDocClick, true);
    document.removeEventListener("keydown", onBrandProdDocKey, true);
  }

  function onBrandProdDocClick(e) {
    var pop = document.getElementById("damBrandingProductAddPopover");
    if (pop && !pop.contains(e.target)) closeBrandingProductAddPopover();
  }

  function onBrandProdDocKey(e) {
    if (e.key === "Escape") closeBrandingProductAddPopover();
  }

  function onVizMatDocClick(e) {
    var pop = document.getElementById("damVizMaterialAddPopover");
    if (pop && !pop.contains(e.target)) closeVizMaterialAddPopover();
  }

  function onVizMatDocKey(e) {
    if (e.key === "Escape") closeVizMaterialAddPopover();
  }

  function closePicker() {
    closeVizMaterialAddPopover();
    closeBrandingProductAddPopover();
    var overlay = document.getElementById("damAssocEditOverlay");
    if (overlay) overlay.remove();
    var thumb = document.getElementById("damThumbPicker");
    if (thumb) thumb.remove();
    hideThumbZoom();
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onDocKey, true);
    _assocPickerOpening = false;
  }

  function panicAssocReset() {
    __assocCatalogInflight = null;
    __damAssocBrandingPickerInflight = null;
    _assocPickerOpening = false;
    try {
      closePicker();
    } catch (eClose) { /* ignore */ }
  }
  try {
    global.addEventListener("dam:panic-reset", panicAssocReset);
  } catch (ePanic) { /* ignore */ }

  function onDocClick(e) {
    var overlay = document.getElementById("damAssocEditOverlay");
    if (!overlay) return;
    var pop = document.getElementById("damAssocEditPopover");
    if (pop && !pop.contains(e.target) && e.target === overlay) closePicker();
  }

  function onDocKey(e) {
    if (e.key === "Escape") closePicker();
  }

  function openActionMenu(anchorEl, product) {
    closeActionMenu();
    if (!product || !product.id) return;
    var rect = anchorEl.getBoundingClientRect();
    var menu = document.createElement("div");
    menu.id = "damAssocActionMenu";
    menu.className = "dam-assoc-action-menu is-entering";
    menu.setAttribute("role", "menu");
    var pid = product.id;
    var path = product.path || "";
    var winIcon =
      global.DamIcons && typeof global.DamIcons.winExplorerSvg === "function"
        ? global.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';
    menu.innerHTML =
      '<div class="dam-assoc-action-menu__inner">' +
      '<a class="dam-assoc-action-menu__item" role="menuitem" href="explorer.html?product=' +
      encodeURIComponent(pid) +
      '"><i class="uil uil-sitemap" aria-hidden="true"></i><span>Przejdź</span></a>' +
      '<button type="button" class="dam-assoc-action-menu__item" role="menuitem" data-action="explorer"' +
      (path ? ' data-path="' + esc(path) + '"' : " disabled") +
      ">" +
      winIcon +
      "<span>Eksplorator</span></button>" +
      '<a class="dam-assoc-action-menu__item" role="menuitem" href="visualizations.html?product=' +
      encodeURIComponent(pid) +
      '"><i class="uil uil-image" aria-hidden="true"></i><span>Wizualizacja</span></a>' +
      '<button type="button" class="dam-assoc-action-menu__item" role="menuitem" data-action="copy-link" data-pid="' +
      esc(pid) +
      '"><i class="uil uil-link" aria-hidden="true"></i><span>Kopiuj link</span></button>' +
      "</div>";
    document.body.appendChild(menu);
    var top = window.scrollY + rect.bottom + 6;
    var left = window.scrollX + rect.left;
    menu.style.top = top + "px";
    menu.style.left = left + "px";
    requestAnimationFrame(function () {
      menu.classList.remove("is-entering");
      menu.classList.add("is-visible");
    });
    menu.querySelector('[data-action="explorer"]') &&
      menu.querySelector('[data-action="explorer"]').addEventListener("click", function () {
        var p = this.getAttribute("data-path") || "";
        if (p && global.DamPaths && typeof global.DamPaths.revealInExplorer === "function") {
          global.DamPaths.revealInExplorer(p);
        }
        closeActionMenu();
      });
    menu.querySelector('[data-action="copy-link"]') &&
      menu.querySelector('[data-action="copy-link"]').addEventListener("click", function () {
        var link = location.origin + location.pathname.replace(/[^/]+$/, "") + "explorer.html?product=" + encodeURIComponent(pid);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link).then(function () {
            toast("Skopiowano link do produktu");
          });
        }
        closeActionMenu();
      });
    setTimeout(function () {
      document.addEventListener("click", closeActionMenuOnOutside, true);
      document.addEventListener("keydown", closeActionMenuOnKey, true);
    }, 0);
  }

  function closeActionMenuOnOutside(e) {
    var menu = document.getElementById("damAssocActionMenu");
    if (menu && !menu.contains(e.target)) closeActionMenu();
  }

  function closeActionMenuOnKey(e) {
    if (e.key === "Escape") closeActionMenu();
  }

  function closeActionMenu() {
    var menu = document.getElementById("damAssocActionMenu");
    if (menu) {
      menu.classList.remove("is-visible");
      menu.classList.add("is-leaving");
      setTimeout(function () {
        if (menu.parentNode) menu.parentNode.removeChild(menu);
      }, 180);
    }
    document.removeEventListener("click", closeActionMenuOnOutside, true);
    document.removeEventListener("keydown", closeActionMenuOnKey, true);
  }

  var _assocPickerOpening = false;

  /**
   * HARD (2026-07-22): "Dodaj wariant materiału" NIE otwiera ciezkiego assoc-pickera
   * (microtask + ewentualny JSON/index walk zacinal caly DAM). Zamiast tego:
   * odroczony macrotask → lekki folder picker (Wskaz plik) → zapis skojarzen.
   */
  function openMaterialVariantAdd(ctx) {
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    if (document.getElementById("damThumbPicker")) {
      toast("Picker juz otwarty…");
      return;
    }
    ctx = ctx || {};
    if (!ctx.groupContext) ctx.groupContext = {};
    if (!ctx.asset || !ctx.asset.id) {
      toast("Brak materialu do dodania wariantu.");
      return;
    }
    var selected = {};
    collectLinkedIdsFromCtx(ctx, "variant").forEach(function (id) {
      selected[id] = true;
    });
    var prevPids = collectLinkedIdsFromCtx(ctx, "product");
    var prevVids = Object.keys(selected);
    toast("Wskaz plik wariantu materialu…");
    openVariantBrowsePicker(
      { asset: ctx.asset, groupContext: ctx.groupContext },
      selected,
      function (ids) {
        var next = ids || [];
        var removed = prevVids.filter(function (x) {
          return next.indexOf(x) === -1;
        });
        saveAssociations(ctx, prevPids, next, { silentToast: removed.length > 0 }).then(function () {
          if (typeof ctx.onRefresh === "function") ctx.onRefresh();
          if (removed.length && global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
            global.DamDanger.toastUndo({
              message:
                removed.length === 1
                  ? "Usunieto 1 skojarzenie"
                  : "Usunieto skojarzenia: " + removed.length,
              actionLabel: "Cofnij",
              duration: 8000,
              onUndo: function () {
                saveAssociations(ctx, prevPids, prevVids, { silentToast: true }).then(function () {
                  if (typeof ctx.onRefresh === "function") ctx.onRefresh();
                });
              },
            });
          }
        });
      }
    );
  }

  /**
   * WARIANTY PRODUKTU (viz strip) — lekki DamFolderPicker, bez ciezkiego COMBO shell.
   * Start: folder produktu z productContext / pierwszego wariantu.
   */
  function openProductStripVariantAdd(ctx) {
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    if (document.getElementById("damThumbPicker") || document.getElementById("damAssocEditOverlay")) {
      toast("Picker juz otwarty…");
      return;
    }
    ctx = ctx || {};
    var pc = ctx.productContext || {};
    var start =
      pc.path ||
      pc.folder ||
      pc.dir ||
      (pc.files && pc.files[0] && (pc.files[0].path || pc.files[0].file)) ||
      "";
    if (!start && ctx.groupContext && ctx.groupContext.variants && ctx.groupContext.variants[0]) {
      var v0 = ctx.groupContext.variants[0];
      start = v0.path || v0.file || "";
    }
    if (!start) start = "X:/Marketing";
    var dir = String(start).replace(/\\/g, "/");
    var slash = dir.lastIndexOf("/");
    if (slash > 0 && /\.[a-z0-9]{2,5}$/i.test(dir)) dir = dir.slice(0, slash);
    toast("Wskaz plik wariantu produktu…");
    openDamFolderPickerSafe({
      startDir: dir,
      mode: "file",
      allowFolderPick: true,
      title: "Wskaz plik wariantu produktu",
      showWindowsButton: true,
      resolveBrandingAssetId: false,
      onPicked: function (picked) {
        if (!picked) return;
        var path =
          picked.type === "folder"
            ? picked.folder || picked.path
            : picked.filePath || picked.path;
        if (!path) return;
        toast("Wybrano: " + String(path).split(/[/\\]/).pop());
        if (typeof ctx.onRefresh === "function") {
          try {
            ctx.onRefresh({
              addedVariantPath: path,
              pickedType: picked.type || "file",
            });
          } catch (eRef) {
            /* ignore */
          }
        }
      },
    });
  }

  function resolveAssocGrid(el) {
    if (!el) return null;
    if (
      el.id === "damVizModalAssoc" ||
      (el.classList && el.classList.contains("dam-media-preview__assoc-grid"))
    ) {
      return el;
    }
    if (el.querySelector) {
      return el.querySelector("#damVizModalAssoc, .dam-media-preview__assoc-grid");
    }
    return null;
  }

  function resolveVizProductId(ctx) {
    ctx = ctx || {};
    var id =
      (ctx.productContext && ctx.productContext.id) ||
      (ctx.groupContext && ctx.groupContext.product_id) ||
      (global.__damLastAssocProductCtx && global.__damLastAssocProductCtx.id) ||
      "";
    if (id) return String(id).trim();
    try {
      var badge = document.querySelector(
        "#damVizModal [data-product-id], #damVizModalBadges [data-product-id]"
      );
      if (badge) id = badge.getAttribute("data-product-id") || "";
    } catch (eDom) {
      /* ignore */
    }
    if (!id) {
      try {
        id = new URLSearchParams(global.location.search).get("product") || "";
      } catch (eUrl) {
        /* ignore */
      }
    }
    return String(id || "").trim();
  }

  function isInsideVizModal(el) {
    if (!el) return false;
    if (el.id === "damVizModal" || el.id === "damVizModalAssoc") return true;
    return !!(
      el.closest &&
      (el.closest("#damVizModal") || el.closest(".dam-viz-modal__assoc-pane"))
    );
  }

  function isVizProductMaterialsAdd(grid, ctx) {
    grid = resolveAssocGrid(grid) || grid;
    if (!grid || grid.classList.contains("dam-media-preview__variant-grid")) return false;
    if (grid.classList.contains("dam-viz-modal__variant-strip")) return false;
    if (grid.closest && grid.closest(".dam-viz-modal__product-variants")) return false;
    /* HARD: any materials assoc Dodaj inside viz modal — never require productId
       for routing (missing id used to fall through into freezing COMBO). */
    return isInsideVizModal(grid);
  }

  function isBrandingProductAssocAdd(grid, ctx) {
    grid = resolveAssocGrid(grid) || grid;
    if (!grid || grid.classList.contains("dam-media-preview__variant-grid")) return false;
    if (grid.closest && grid.closest("#damVizModal")) return false;
    var col = grid.closest(
      ".dam-media-preview__assoc-col--products, .dam-media-preview__assoc-col--product"
    );
    if (!col || !(grid.closest && grid.closest("#damMediaPreview"))) return false;
    return !!(ctx && ctx.asset && ctx.asset.id);
  }

  function productDisplayName(p) {
    if (!p) return "";
    return p.display_name || p.name || p.title || p.id || "";
  }

  function positionAssocLightPopover(pop, anchorEl) {
    if (!pop || !anchorEl) return;
    if (pop.parentNode !== document.body) document.body.appendChild(pop);
    var rect = anchorEl.getBoundingClientRect();
    var margin = 12;
    pop.style.setProperty("position", "fixed", "important");
    pop.style.setProperty("z-index", "12350", "important");
    pop.style.setProperty("transform", "none", "important");
    var w = pop.offsetWidth || 420;
    var h = pop.offsetHeight || 360;
    var top = rect.bottom + margin;
    var left = Math.max(margin, Math.min(rect.left, window.innerWidth - w - margin));
    if (top + h > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - h - margin);
    }
    pop.style.top = top + "px";
    pop.style.left = left + "px";
  }

  /**
   * Viz modal (#damVizModalAssoc): dodaj skojarzony material brandingowy do produktu.
   * Lekki picker (/branding-search-picker) — bez ciezkiego COMBO produktow i bez overlay 12100.
   */
  function openVizProductMaterialAdd(anchorEl, ctx) {
    if (!canEditAssoc()) {
      toast("Wlacz tryb admina, aby edytowac skojarzenia.");
      return;
    }
    closePicker();
    ctx = ctx || {};
    var productId = resolveVizProductId(ctx);
    if (!productId) {
      toast("Brak produktu — nie mozna dodac materialu.");
      return;
    }
    if (!ctx.productContext) ctx.productContext = { id: productId };
    if (!ctx.groupContext) ctx.groupContext = {};
    if (!ctx.groupContext.product_id) ctx.groupContext.product_id = productId;
    global.__damLastAssocProductCtx = ctx.productContext;
    if (document.getElementById("damThumbPicker")) {
      toast("Picker juz otwarty…");
      return;
    }
    ensureInjectedCss();
    var pop = document.createElement("div");
    pop.id = "damVizMaterialAddPopover";
    pop.className =
      "dam-tag-edit-popover dam-tag-edit-popover--wide dam-assoc-edit-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "true");
    pop.innerHTML =
      '<div class="dam-tag-edit-popover__head">' +
      "<span>Dodaj skojarzony material</span>" +
      '<button type="button" class="dam-tag-edit-popover__close" data-close aria-label="Zamknij">' +
      '<i class="uil uil-times"></i></button></div>' +
      '<div class="dam-tag-edit-popover__search-wrap">' +
      '<div class="dam-assoc-edit-popover__search-row">' +
      '<i class="uil uil-search" aria-hidden="true"></i>' +
      '<input type="text" id="damVizMatAddSearch" class="dam-tag-edit-popover__search" placeholder="Szukaj material (nazwa, sciezka, id)…" autocomplete="off" />' +
      "</div></div>" +
      '<div class="dam-tag-edit-popover__list dam-assoc-edit-popover__list" role="listbox">' +
      '<p class="dam-tag-edit-popover__empty">Ladowanie…</p></div>' +
      '<div class="dam-tag-edit-popover__actions">' +
      '<button type="button" class="dam-tag-edit-popover__confirm" data-confirm disabled>' +
      '<i class="uil uil-check"></i><span>Dodaj skojarzenie</span></button>' +
      '<button type="button" class="dam-tag-edit-popover__cancel" data-cancel>' +
      '<i class="uil uil-arrow-left"></i><span>Anuluj</span></button></div>';
    document.body.appendChild(pop);
    requestAnimationFrame(function () {
      positionAssocLightPopover(pop, anchorEl || document.body);
    });

    var selectedId = "";
    var selectedEntry = null;
    var searchTimer = null;
    var listEl = pop.querySelector(".dam-assoc-edit-popover__list");
    var confirmBtn = pop.querySelector("[data-confirm]");
    var searchInput = pop.querySelector("#damVizMatAddSearch");

    function paintBrandingList(entries) {
      if (!listEl || !document.getElementById("damVizMaterialAddPopover")) return;
      if (!entries || !entries.length) {
        listEl.innerHTML =
          '<p class="dam-tag-edit-popover__empty">Brak wynikow — zmien wyszukiwanie.</p>';
        return;
      }
      listEl.innerHTML = entries
        .map(function (entry) {
          if (!entry || !entry.id) return "";
          var sel = entry.id === selectedId ? " is-selected" : "";
          return (
            '<button type="button" class="dam-assoc-edit-popover__opt' +
            sel +
            '" data-id="' +
            esc(entry.id) +
            '" data-thumb-path="' +
            esc(entry.path || "") +
            '" role="option">' +
            '<span class="dam-assoc-edit-popover__opt-thumb"><img src="' +
            esc(PLACEHOLDER_SVG) +
            '" alt="" loading="lazy" /></span>' +
            '<span class="dam-assoc-edit-popover__opt-body">' +
            '<span class="dam-assoc-edit-popover__opt-label">' +
            esc(brandingLabel(entry)) +
            "</span>" +
            '<span class="dam-assoc-edit-popover__opt-sub">' +
            esc(entry.id) +
            "</span></span></button>"
          );
        })
        .join("");
      listEl.querySelectorAll("[data-id]").forEach(function (btn) {
        function hydrateThumb() {
          var img = btn.querySelector("img");
          var path = btn.getAttribute("data-thumb-path") || "";
          if (!img || !path || img.getAttribute("data-hydrated") === "1") return;
          var src = brandingThumb({ path: path, id: btn.getAttribute("data-id") });
          if (src && src !== PLACEHOLDER_SVG) {
            img.src = src;
            img.setAttribute("data-hydrated", "1");
          }
        }
        btn.addEventListener("mouseenter", hydrateThumb);
        btn.addEventListener("focus", hydrateThumb);
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          hydrateThumb();
          selectedId = btn.getAttribute("data-id") || "";
          selectedEntry =
            entries.find(function (x) {
              return x && x.id === selectedId;
            }) || null;
          listEl.querySelectorAll("[data-id]").forEach(function (b) {
            b.classList.toggle("is-selected", b.getAttribute("data-id") === selectedId);
          });
          if (confirmBtn) confirmBtn.disabled = !selectedId;
        });
      });
    }

    function loadBranding(q) {
      if (!listEl) return;
      listEl.innerHTML = '<p class="dam-tag-edit-popover__empty">Ladowanie…</p>';
      searchBrandingPicker(q, 80, selectedId ? [selectedId] : [])
        .then(function (res) {
          paintBrandingList((res && res.entries) || []);
        })
        .catch(function () {
          if (listEl) {
            listEl.innerHTML =
              '<p class="dam-tag-edit-popover__empty">Blad ladowania katalogu brandingu.</p>';
          }
        });
    }

    function collectLinkedProductIds(entry) {
      var ids = [];
      var seen = {};
      function add(id) {
        id = String(id || "").trim();
        if (!id || seen[id]) return;
        seen[id] = true;
        ids.push(id);
      }
      if (!entry) return ids;
      (entry.linked_product_ids || []).forEach(add);
      (entry.linked_products || []).forEach(function (p) {
        if (p && p.id) add(p.id);
      });
      return ids;
    }

    function commitLink() {
      if (!selectedId || !selectedEntry) return;
      if (confirmBtn) confirmBtn.disabled = true;
      var pids = collectLinkedProductIds(selectedEntry);
      if (pids.indexOf(productId) === -1) pids.push(productId);
      saveAssociations(
        {
          asset: {
            id: selectedId,
            folder_group_id: selectedEntry.folder_group_id || "",
          },
          groupContext: { folder_group_id: selectedEntry.folder_group_id || "" },
        },
        pids,
        [],
        { silentToast: false }
      ).then(function () {
        closeVizMaterialAddPopover();
        if (typeof ctx.onRefresh === "function") ctx.onRefresh();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          loadBranding(searchInput.value || "");
        }, 120);
      });
      searchInput.addEventListener("keydown", function (e) {
        e.stopPropagation();
      });
      requestAnimationFrame(function () {
        searchInput.focus();
      });
    }
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        commitLink();
      });
    }
    pop.querySelector("[data-cancel]").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeVizMaterialAddPopover();
    });
    pop.querySelector("[data-close]").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeVizMaterialAddPopover();
    });
    pop._damVizMatCleanup = function () {
      clearTimeout(searchTimer);
    };
    setTimeout(function () {
      document.addEventListener("click", onVizMatDocClick, true);
      document.addEventListener("keydown", onVizMatDocKey, true);
    }, 0);
    loadBranding("");
  }

  /**
   * Branding preview (#damMediaPreview): dodaj skojarzony produkt do materialu.
   * Lekki picker (search-index) — bez ciezkiego COMBO i overlay 12100.
   */
  function openBrandingProductAssocAdd(anchorEl, ctx) {
    if (!canEditAssoc()) {
      toast("Wlacz tryb admina, aby edytowac skojarzenia.");
      return;
    }
    closePicker();
    ctx = ctx || {};
    if (!ctx.asset || !ctx.asset.id) {
      toast("Brak materialu — nie mozna dodac produktu.");
      return;
    }
    if (document.getElementById("damThumbPicker") || document.getElementById("damBrandingProductAddPopover")) {
      toast("Picker juz otwarty…");
      return;
    }
    ensureInjectedCss();
    var pop = document.createElement("div");
    pop.id = "damBrandingProductAddPopover";
    pop.className =
      "dam-tag-edit-popover dam-tag-edit-popover--wide dam-assoc-edit-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "true");
    pop.innerHTML =
      '<div class="dam-tag-edit-popover__head">' +
      "<span>Dodaj skojarzony produkt</span>" +
      '<button type="button" class="dam-tag-edit-popover__close" data-close aria-label="Zamknij">' +
      '<i class="uil uil-times"></i></button></div>' +
      '<div class="dam-tag-edit-popover__search-wrap">' +
      '<div class="dam-assoc-edit-popover__search-row">' +
      '<i class="uil uil-search" aria-hidden="true"></i>' +
      '<input type="text" id="damBrandProdAddSearch" class="dam-tag-edit-popover__search" placeholder="Szukaj produkt (nazwa, indeks, id)…" autocomplete="off" />' +
      "</div></div>" +
      '<div class="dam-tag-edit-popover__list dam-assoc-edit-popover__list" role="listbox">' +
      '<p class="dam-tag-edit-popover__empty">Wpisz nazwe lub indeks produktu…</p></div>' +
      '<div class="dam-tag-edit-popover__actions">' +
      '<button type="button" class="dam-tag-edit-popover__confirm" data-confirm disabled>' +
      '<i class="uil uil-check"></i><span>Dodaj skojarzenie</span></button>' +
      '<button type="button" class="dam-tag-edit-popover__cancel" data-cancel>' +
      '<i class="uil uil-arrow-left"></i><span>Anuluj</span></button></div>';
    document.body.appendChild(pop);
    requestAnimationFrame(function () {
      positionAssocLightPopover(pop, anchorEl || document.body);
    });

    var selectedId = "";
    var searchTimer = null;
    var listEl = pop.querySelector(".dam-assoc-edit-popover__list");
    var confirmBtn = pop.querySelector("[data-confirm]");
    var searchInput = pop.querySelector("#damBrandProdAddSearch");
    var linkedIds = collectLinkedIdsFromCtx(ctx, "product");
    var linkedSet = {};
    linkedIds.forEach(function (id) {
      linkedSet[id] = true;
    });

    function paintProductList(products) {
      if (!listEl || !document.getElementById("damBrandingProductAddPopover")) return;
      if (!products || !products.length) {
        listEl.innerHTML =
          '<p class="dam-tag-edit-popover__empty">Brak wynikow — zmien wyszukiwanie.</p>';
        return;
      }
      listEl.innerHTML = products
        .map(function (p) {
          if (!p || !p.id) return "";
          if (linkedSet[p.id]) return "";
          var sel = p.id === selectedId ? " is-selected" : "";
          var idx =
            (p.indexes && p.indexes[0]) ||
            (p.index_bases && p.index_bases[0]) ||
            p.index ||
            "";
          return (
            '<button type="button" class="dam-assoc-edit-popover__opt' +
            sel +
            '" data-id="' +
            esc(p.id) +
            '" role="option">' +
            '<span class="dam-assoc-edit-popover__opt-body">' +
            '<span class="dam-assoc-edit-popover__opt-label">' +
            esc(productDisplayName(p)) +
            "</span>" +
            '<span class="dam-assoc-edit-popover__opt-sub">' +
            esc(p.id + (idx ? " · " + idx : "")) +
            "</span></span></button>"
          );
        })
        .filter(Boolean)
        .join("");
      if (!listEl.innerHTML) {
        listEl.innerHTML =
          '<p class="dam-tag-edit-popover__empty">Wszystkie wyniki sa juz skojarzone.</p>';
      }
      listEl.querySelectorAll("[data-id]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          selectedId = btn.getAttribute("data-id") || "";
          listEl.querySelectorAll("[data-id]").forEach(function (b) {
            b.classList.toggle("is-selected", b.getAttribute("data-id") === selectedId);
          });
          if (confirmBtn) confirmBtn.disabled = !selectedId;
        });
      });
    }

    function loadProducts(q) {
      if (!listEl) return;
      var nq = String(q || "").trim();
      if (!nq) {
        listEl.innerHTML =
          '<p class="dam-tag-edit-popover__empty">Wpisz nazwe lub indeks produktu…</p>';
        return;
      }
      listEl.innerHTML = '<p class="dam-tag-edit-popover__empty">Ladowanie…</p>';
      var boot =
        global.DamSearch && typeof global.DamSearch.ensureSearchIndexBootstrap === "function"
          ? global.DamSearch.ensureSearchIndexBootstrap()
          : Promise.resolve(global._DAM_SEARCH_INDEX || null);
      boot
        .then(function () {
          var ids = searchProductIdsFromIndex(nq, 80);
          var products = ids
            .map(function (id) {
              return productStubById(id);
            })
            .filter(Boolean);
          paintProductList(products);
        })
        .catch(function () {
          if (listEl) {
            listEl.innerHTML =
              '<p class="dam-tag-edit-popover__empty">Blad ladowania indeksu produktow.</p>';
          }
        });
    }

    function commitLink() {
      if (!selectedId) return;
      if (confirmBtn) confirmBtn.disabled = true;
      var prevPids = collectLinkedIdsFromCtx(ctx, "product");
      var prevVids = collectLinkedIdsFromCtx(ctx, "variant");
      var nextPids = prevPids.slice();
      if (nextPids.indexOf(selectedId) === -1) nextPids.push(selectedId);
      saveAssociations(ctx, nextPids, prevVids, { silentToast: false }).then(function () {
        closeBrandingProductAddPopover();
        if (typeof ctx.onRefresh === "function") ctx.onRefresh();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          loadProducts(searchInput.value || "");
        }, 120);
      });
      searchInput.addEventListener("keydown", function (e) {
        e.stopPropagation();
      });
      requestAnimationFrame(function () {
        searchInput.focus();
      });
    }
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        commitLink();
      });
    }
    pop.querySelector("[data-cancel]").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeBrandingProductAddPopover();
    });
    pop.querySelector("[data-close]").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeBrandingProductAddPopover();
    });
    pop._damBrandProdCleanup = function () {
      clearTimeout(searchTimer);
    };
    setTimeout(function () {
      document.addEventListener("click", onBrandProdDocClick, true);
      document.addEventListener("keydown", onBrandProdDocKey, true);
    }, 0);
  }

  function openMediaPicker(anchorEl, opts) {
    opts = opts || {};
    var gridOrAnchor = resolveAssocGrid(anchorEl) || anchorEl;
    /* HARD gate: viz modal never mounts #damAssocEditOverlay (z-index 12100 freeze). */
    if (isInsideVizModal(gridOrAnchor) || isInsideVizModal(anchorEl)) {
      if (opts.kind === "variant") {
        openProductStripVariantAdd(opts);
        return;
      }
      openVizProductMaterialAdd(anchorEl, opts);
      return;
    }
    if (
      opts.kind === "product" &&
      isBrandingProductAssocAdd(gridOrAnchor, opts)
    ) {
      openBrandingProductAssocAdd(anchorEl, opts);
      return;
    }
    if (
      opts.kind === "product" &&
      isVizProductMaterialsAdd(gridOrAnchor, opts)
    ) {
      openVizProductMaterialAdd(anchorEl, opts);
      return;
    }
    // #region agent log
    __damDbg("dam-assoc-edit.js:openMediaPicker", "entry", {
      kind: opts.kind || "",
      opening: _assocPickerOpening,
      warmProducts: (global._DAM_FILE_INDEX && global._DAM_FILE_INDEX.products || []).length,
      fromSearchIndex: !!(global._DAM_FILE_INDEX && global._DAM_FILE_INDEX._fromSearchIndex),
      variantCandidates: (opts.variantCandidates || []).length,
    }, "H2");
    // #endregion
    /* HARD: re-entry / double-click must never stack pickers or re-parse file-index. */
    if (_assocPickerOpening) {
      if (document.getElementById("damAssocEditOverlay")) {
        // #region agent log
        __damDbg("dam-assoc-edit.js:openMediaPicker", "ignored_duplicate_while_open", { kind: opts.kind || "" }, "H2");
        // #endregion
        return;
      }
      // #region agent log
      __damDbg("dam-assoc-edit.js:openMediaPicker", "blocked_stuck_flag", { kind: opts.kind || "" }, "H2");
      // #endregion
      _assocPickerOpening = false;
      toast("Picker juz sie otwiera…");
      return;
    }
    _assocPickerOpening = true;
    /* Macrotask: click handler / CDP evaluate musi wrócić zanim budujemy DOM pickera. */
    setTimeout(function () {
      try {
        openMediaPickerNow(anchorEl, opts);
      } catch (errSync) {
        console.error("[DamAssocEdit] openMediaPicker sync failed", errSync);
        toast("Nie udalo sie otworzyc pickera: " + ((errSync && errSync.message) || errSync));
        _assocPickerOpening = false;
      }
    }, 0);
  }

  function openMediaPickerNow(anchorEl, opts) {
    opts = opts || {};
    closePicker();
    ensureInjectedCss();
    _assocPickerOpening = true;

    /**
     * HARD freeze fix (2026-07-22k): shell FIRST (empty + loading), THEN light
     * search-index hydrate. Never wait on fetch/parse before painting overlay —
     * waiting was the "click Dodaj = permanent freeze" regression.
     * NEVER load file-index (~8MB) / branding-index on this path.
     */
    var needsProductIndex = opts.kind !== "variant";
    // #region agent log
    __damDbg("dam-assoc-edit.js:openMediaPickerNow", "start_shell_first", {
      kind: opts.kind || "",
      needsProductIndex: needsProductIndex,
      hasSearchIndex: !!(global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.entries),
      warmProducts: (global._DAM_FILE_INDEX && global._DAM_FILE_INDEX.products || []).length,
    }, "H1");
    // #endregion

    var searchIndexReady = !!(global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.entries);
    /* HARD 2026-07-23f: never materialize full catalog synchronously on click
       (productsFromSearchIndex on warm index froze entire DAM on assoc Dodaj). */
    var initialList = [];
    var loading = !!needsProductIndex && !searchIndexReady;
    if (!needsProductIndex) {
      loading = false;
    }

    try {
      buildAssocMediaPickerUi(anchorEl, opts, initialList, loading);
    } catch (eBuild) {
      console.error("[DamAssocEdit] buildAssocMediaPickerUi failed", eBuild);
      toast("Nie udalo sie otworzyc COMBO.");
      _assocPickerOpening = false;
      return;
    }
    _assocPickerOpening = false;

    if (!needsProductIndex) return;

    /**
     * HARD freeze fix 2026-07-23l: DO NOT bootstrap/parse search-index on Dodaj open.
     * Parsing warm/cold index on the main thread froze DAM + blocked X (overlay 12100).
     * Hydrate flag only — list stays "Wpisz nazwe…" until user types (search-as-you-type).
     */
    var popReady = document.getElementById("damAssocEditPopover");
    if (popReady && typeof popReady._damAssocHydrateProducts === "function") {
      popReady._damAssocHydrateProducts({ _indexReady: true });
    }
    if (!(global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.entries)) {
      /* Idle bootstrap — never on click tick. */
      setTimeout(function () {
        if (!document.getElementById("damAssocEditPopover")) return;
        ensureSearchIndexBootstrap()
          .then(function (si) {
            global._DAM_SEARCH_INDEX = si || global._DAM_SEARCH_INDEX;
          })
          .catch(function () {
            /* user can still type later after retry */
          });
      }, 400);
    }
  }

  function buildAssocMediaPickerUi(anchorEl, opts, productsIn, isLoadingProducts) {
    var __buildT0 = Date.now();
    // #region agent log
    __damDbg("dam-assoc-edit.js:buildAssocMediaPickerUi", "start", {
      kind: opts.kind || "",
      productsIn: (productsIn || []).length,
      isLoadingProducts: !!isLoadingProducts,
      variantCandidates: (opts.variantCandidates || []).length,
    }, "H3");
    // #endregion
    var products = productsIn || [];
    /**
     * COMBO tabs PRODUKT | BRANDING stay (user requirement).
     * Freeze fix: branding loads ONLY on tab click / typed search via
     * /branding-search-picker (cap 80) — never full branding-index JSON.
     */
    var brandingDisabled = opts.kind === "variant";
    var listTab = "products";
    var summaryMode = false;
    var pendingRemove = {};
    var brandingSearch = null;
    var brandingLoading = false;

    var selectedProducts = {};
    var selectedBranding = {};
    (opts.selectedProductIds || opts.selectedIds || []).forEach(function (id) {
      selectedProducts[id] = true;
    });
    (opts.selectedBrandingIds || []).forEach(function (id) {
      if (id) selectedBranding[id] = true;
    });

    function activeSelected() {
      return listTab === "branding" ? selectedBranding : selectedProducts;
    }

    var pinnedProductIds = (opts.pinnedProductIds || opts.pinnedIds || opts.selectedIds || []).slice();
    var pinnedBrandingIds = (opts.pinnedBrandingIds || opts.selectedBrandingIds || []).slice();
    var pinnedIds = pinnedProductIds;
    var pinnedSet = {};
    pinnedIds.forEach(function (id) {
      pinnedSet[id] = true;
    });

    var overlay = document.createElement("div");
    overlay.id = "damAssocEditOverlay";
    overlay.className = "dam-assoc-edit-overlay";
    overlay.setAttribute("role", "presentation");

    var pop = document.createElement("div");
    pop.id = "damAssocEditPopover";
    pop.className = "dam-tag-edit-popover dam-tag-edit-popover--wide dam-assoc-edit-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "true");

    var head = opts.kind === "variant" ? "Warianty materiału" : "Skojarzone";
    var html =
      '<div class="dam-tag-edit-popover__head">' +
      "<span>" +
      esc(head) +
      '</span><button type="button" class="dam-tag-edit-popover__close" data-close aria-label="Zamknij">' +
      '<i class="uil uil-times"></i></button></div>' +
      (opts.kind !== "variant" && !brandingDisabled
        ? '<div class="dam-assoc-edit-popover__tabs" role="tablist" aria-label="Typ skojarzenia">' +
          '<button type="button" class="dam-assoc-edit-popover__tab is-active" data-list-tab="products" role="tab" aria-selected="true">PRODUKT</button>' +
          '<button type="button" class="dam-assoc-edit-popover__tab" data-list-tab="branding" role="tab" aria-selected="false">BRANDING</button>' +
          "</div>"
        : "") +
      '<div class="dam-assoc-edit-popover__pinned-wrap">' +
      '<div class="dam-assoc-edit-popover__pinned-label">Aktualne</div>' +
      '<div class="dam-assoc-edit-popover__pinned"></div>' +
      "</div>" +
      '<div class="dam-assoc-edit-popover__section-sep" aria-hidden="true"></div>' +
      '<div class="dam-tag-edit-popover__search-wrap">' +
      '<div class="dam-assoc-edit-popover__search-row">' +
      '<i class="uil uil-search" aria-hidden="true"></i>' +
      '<input type="text" id="damAssocEditSearch" class="dam-tag-edit-popover__search" placeholder="Szukaj tytuł, indeks, wariant…" autocomplete="off" />' +
      "</div></div>" +
      '<div class="dam-assoc-edit-popover__body">' +
      '<aside class="dam-assoc-edit-popover__preview is-empty" id="damAssocEditPreview" aria-live="polite">' +
      '<p class="dam-assoc-edit-popover__preview-label">Podgląd</p>' +
      '<div class="dam-assoc-edit-popover__preview-frame">' +
      '<img alt="" class="is-placeholder" />' +
      '<div class="dam-assoc-edit-popover__preview-empty" aria-hidden="true">' +
      '<i class="uil uil-image"></i><span>Najedź wynik</span></div>' +
      "</div>" +
      '<div class="dam-assoc-edit-popover__preview-caption">Najedź wynik, aby podejrzeć</div>' +
      '<div class="dam-assoc-edit-popover__preview-meta"></div>' +
      "</aside>" +
      '<div class="dam-tag-edit-popover__list dam-assoc-edit-popover__list" role="listbox">';

    function lookupBrandingEntry(id) {
      id = String(id || "").trim();
      if (!id) return null;
      if (brandingSearch && brandingSearch.byId && brandingSearch.byId[id]) {
        return brandingSearch.byId[id];
      }
      var entries = (brandingSearch && brandingSearch.entries) || [];
      for (var bi = 0; bi < entries.length; bi++) {
        if (entries[bi] && entries[bi].id === id) return entries[bi];
      }
      return null;
    }

    function lookupItem(id) {
      id = String(id || "").trim();
      if (!id) return { id: "", label: "", thumb: PLACEHOLDER_SVG, sub: "", path: "" };
      if (opts.kind === "variant") {
        var v = (opts.variantCandidates || []).find(function (x) {
          return x && x.id === id;
        });
        if (v) {
          return {
            id: v.id,
            label: v.name || v.label || v.id,
            thumb: variantThumbFast(v),
            sub: v.id || "",
            path: v.path || "",
          };
        }
      } else if (listTab === "branding") {
        var be = lookupBrandingEntry(id);
        if (be) {
          return {
            id: be.id,
            label: brandingLabel(be),
            thumb: brandingThumb(be),
            sub: be.id || "",
            path: be.path || "",
          };
        }
        return { id: id, label: id, thumb: PLACEHOLDER_SVG, sub: "", path: "" };
      } else {
        var p = products.find(function (x) {
          return x && x.id === id;
        });
        if (p) {
          var revL = (p.revisions && p.revisions[0]) || {};
          return {
            id: p.id,
            label: p.display_name || p.name || p.id,
            thumb: productThumb(p),
            sub: productIndexOf(p) || "",
            path: p.path || "",
            brand: p.brand || "",
            category: p.category || "",
            subcategory: p.subcategory_label || "",
            langs: revL.langs || [],
          };
        }
        var e = findSearchEntryById(id);
        if (e) {
          var stub = productsFromSearchIndex({ entries: [e] });
          if (stub[0]) {
            return {
              id: stub[0].id,
              label: stub[0].display_name || stub[0].name || stub[0].id,
              thumb: productThumb(stub[0]),
              sub: productIndexOf(stub[0]) || "",
              path: stub[0].path || "",
              brand: stub[0].brand || "",
              category: stub[0].category || "",
              subcategory: stub[0].subcategory_label || "",
              langs: [],
            };
          }
        }
      }
      return { id: id, label: id, thumb: PLACEHOLDER_SVG, sub: "", path: "" };
    }

      function checkIconHtml(on, pinned) {
        if (on) return '<i class="uil uil-check"></i>';
        if (pinned) return '<i class="uil uil-times" title="Kliknij, aby usunac skojarzenie"></i>';
        return "";
      }

      function rowActionsHtml(it) {
        var actions = "";
        if (it.path) {
          actions +=
            '<button type="button" class="dam-assoc-edit-popover__row-btn" data-row-folder data-path="' +
            esc(it.path) +
            '" title="Otworz folder" aria-label="Otworz folder"><i class="uil uil-folder"></i></button>';
        }
        if (opts.kind !== "variant" && listTab === "products") {
          actions +=
            '<button type="button" class="dam-assoc-edit-popover__row-btn" data-row-copy data-pid="' +
            esc(it.id) +
            '" title="Kopiuj link do produktu" aria-label="Kopiuj link"><i class="uil uil-link"></i></button>';
        }
        return actions ? '<span class="dam-assoc-edit-popover__row-actions">' + actions + "</span>" : "";
      }

      /* Pkt 9: wiersz tagow - marka, kategoria, podkategoria, jezyk, indeks (jak karty viz) */
      function optionTagsHtml(it) {
        var tags = [];
        function tag(v, cls, tip, copyVal) {
          if (!v) return;
          var copyAttrs = "";
          if (copyVal) {
            copyAttrs =
              ' data-marketing-id="' +
              esc(copyVal) +
              '" data-tag-value="' +
              esc(copyVal) +
              '" role="button" tabindex="0"';
          }
          tags.push(
            '<span class="dam-viz-badge' +
              (cls ? " " + cls : "") +
              '"' +
              (tip ? ' title="' + esc(tip) + '"' : "") +
              copyAttrs +
              ">" +
              esc(v) +
              "</span>"
          );
        }
        tag(it.brand, "dam-viz-badge--brand", "Marka");
        tag(stripCategoryPrefix(it.category), "dam-viz-badge--cat", "Kategoria");
        tag(it.subcategory, "dam-viz-badge--subcat", "Podkategoria");
        (it.langs || []).forEach(function (lg) {
          tag(String(lg).toUpperCase(), "dam-viz-badge--lang", "Język");
        });
        tag(it.sub, "dam-viz-badge--index", "Indeks (klik / prawy = kopiuj)", it.sub);
        if (!tags.length) return "";
        return '<span class="dam-assoc-edit-popover__tags">' + tags.join("") + "</span>";
      }

      function optionButtonHtml(it, pinned) {
        var sel = activeSelected();
        var on = !!sel[it.id];
        var pending = !!pendingRemove[it.id];
        var rowCls = "dam-assoc-edit-popover__opt-row" + (pending ? " is-pending-remove" : "");
        var softX =
          pinned && on
            ? '<button type="button" class="dam-assoc-edit-popover__soft-x" data-soft-remove data-id="' +
              esc(it.id) +
              '" aria-label="Oznacz do usuniecia" title="Oznacz do usuniecia"><i class="uil uil-times"></i></button>' +
              (pending
                ? '<button type="button" class="dam-assoc-edit-popover__undo-btn" data-soft-undo data-id="' +
                  esc(it.id) +
                  '">Cofnij</button>'
                : "")
            : "";
        return (
          '<div class="' +
          rowCls +
          '">' +
          '<button type="button" class="dam-assoc-edit-popover__opt' +
          (on ? " is-selected" : "") +
          (pinned ? " is-pinned" : "") +
          '" data-id="' +
          esc(it.id) +
          '">' +
          '<span class="dam-assoc-edit-popover__thumb-wrap">' +
          '<img class="dam-assoc-edit-popover__thumb" src="' +
          esc(it.thumb || PLACEHOLDER_SVG) +
          '" alt="" loading="lazy" onerror="this.src=\'' +
          PLACEHOLDER_SVG.replace(/'/g, "%27") +
          "'\">" +
          "</span>" +
          '<span class="dam-assoc-edit-popover__meta">' +
          '<span class="dam-assoc-edit-popover__label">' +
          esc(it.label) +
          "</span>" +
          optionTagsHtml(it) +
          "</span>" +
          '<span class="dam-assoc-edit-popover__check" aria-hidden="true">' +
          checkIconHtml(on, pinned) +
          "</span></button>" +
          softX +
          rowActionsHtml(it) +
          "</div>"
        );
      }

      function bindOptionButtons(scope) {
        if (!scope) return;
        bindThumbZoom(scope);
        bindSearchPreview(pop, scope);
        scope.querySelectorAll(".dam-assoc-edit-popover__opt[data-id]").forEach(function (btn) {
          var id = btn.getAttribute("data-id");
          function toggle() {
            var sel = activeSelected();
            if (sel[id]) delete sel[id];
            else sel[id] = true;
            if (pendingRemove[id]) delete pendingRemove[id];
            renderPinned();
            var s = pop.querySelector("#damAssocEditSearch");
            renderOptions(s ? s.value : "");
          }
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          });
        });
        scope.querySelectorAll("[data-soft-remove]").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var id = btn.getAttribute("data-id") || "";
            if (!id) return;
            pendingRemove[id] = true;
            renderPinned();
          });
        });
        scope.querySelectorAll("[data-soft-undo]").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var id = btn.getAttribute("data-id") || "";
            if (!id) return;
            delete pendingRemove[id];
            renderPinned();
          });
        });
        scope.querySelectorAll("[data-row-folder]").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var p = btn.getAttribute("data-path") || "";
            if (p && global.DamPaths && typeof global.DamPaths.revealInExplorer === "function") {
              global.DamPaths.revealInExplorer(p);
              toast("Otwieram folder w Eksploratorze");
            } else if (p && global.DamPaths && typeof global.DamPaths.openFolderInExplorer === "function") {
              global.DamPaths.openFolderInExplorer(p);
            }
          });
        });
        scope.querySelectorAll("[data-row-copy]").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var pid = btn.getAttribute("data-pid") || "";
            var link =
              location.origin +
              location.pathname.replace(/[^/]+$/, "") +
              "explorer.html?product=" +
              encodeURIComponent(pid);
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(link).then(function () {
                toast("Skopiowano link do produktu");
              });
            }
          });
        });
      }

      function activatePreviewFromBtn(btn) {
        if (!btn) return;
        var thumb = btn.querySelector(".dam-assoc-edit-popover__thumb");
        var labelEl = btn.querySelector(".dam-assoc-edit-popover__label");
        var idxBadge = btn.querySelector(".dam-viz-badge--index");
        var src = thumb ? thumb.getAttribute("src") || thumb.currentSrc || thumb.src : "";
        setSearchPreview(pop, {
          thumb: src,
          label: labelEl ? labelEl.textContent : btn.getAttribute("data-id") || "",
          sub: idxBadge ? idxBadge.textContent : "",
          btn: btn,
        });
      }

      function currentPinnedIds() {
        if (opts.kind === "variant") return pinnedProductIds;
        return listTab === "branding" ? pinnedBrandingIds : pinnedProductIds;
      }

      function renderPinned() {
        var pinnedEl = pop.querySelector(".dam-assoc-edit-popover__pinned");
        if (!pinnedEl) return;
        var ids = currentPinnedIds();
        if (!ids.length) {
          pinnedEl.innerHTML = '<p class="dam-tag-edit-popover__empty">Brak aktualnych skojarzen.</p>';
          setSearchPreview(pop, null);
          return;
        }
        pinnedEl.innerHTML = ids
          .map(function (id) {
            return optionButtonHtml(lookupItem(id), true);
          })
          .join("");
        bindOptionButtons(pinnedEl);
        activatePreviewFromBtn(pinnedEl.querySelector(".dam-assoc-edit-popover__opt[data-id]"));
      }

      function paintOptionList(listEl, items) {
        if (!listEl || !document.getElementById("damAssocEditPopover")) return;
        if (!items.length) {
          listEl.innerHTML = '<p class="dam-tag-edit-popover__empty">Brak wyników dla tego wyszukiwania.</p>';
          var pinnedKeep = pop.querySelector(
            ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"
          );
          if (pinnedKeep) activatePreviewFromBtn(pinnedKeep);
          else setSearchPreview(pop, null);
          return;
        }
        listEl.innerHTML = items
          .map(function (it) {
            return optionButtonHtml(it, false);
          })
          .join("");
        bindOptionButtons(listEl);
        var pinnedBtn = pop.querySelector(
          ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"
        );
        if (pinnedBtn) activatePreviewFromBtn(pinnedBtn);
        else {
          var firstBtn = listEl.querySelector(".dam-assoc-edit-popover__opt[data-id]");
          if (firstBtn) activatePreviewFromBtn(firstBtn);
        }
      }

      function renderOptionsNow(filter, passGen) {
        var q = String(filter || "")
          .toLowerCase()
          .trim();
        var listEl = pop.querySelector(".dam-assoc-edit-popover__list");
        if (!listEl || summaryMode) return;
        if (passGen && passGen !== pop._damRenderPass) return;
        // #region agent log
        __damDbg("dam-assoc-edit.js:renderOptions", "start", {
          kind: opts.kind || "",
          listTab: listTab,
          productsLen: products.length,
          variantCandidates: (opts.variantCandidates || []).length,
          filter: q.slice(0, 40),
          brandingLoading: !!brandingLoading,
        }, "H1");
        // #endregion

        if (opts.kind !== "variant" && listTab === "branding") {
          if (brandingLoading || !brandingSearch) {
            listEl.innerHTML =
              '<p class="dam-tag-edit-popover__empty">Ladowanie katalogu brandingu…</p>';
            return;
          }
          var bPinned = {};
          pinnedBrandingIds.forEach(function (id) {
            bPinned[id] = true;
          });
          var bItems = [];
          (brandingSearch.entries || []).forEach(function (entry) {
            if (!entry || !entry.id || bPinned[entry.id]) return;
            var blob = (
              String(entry.id || "") +
              " " +
              String(entry.name || "") +
              " " +
              String(entry.path || "")
            ).toLowerCase();
            if (q && blob.indexOf(q) === -1) return;
            bItems.push({
              id: entry.id,
              label: brandingLabel(entry),
              thumb: brandingThumb(entry),
              sub: entry.id,
              path: entry.path || "",
            });
          });
          requestAnimationFrame(function () {
            if (passGen && passGen !== pop._damRenderPass) return;
            paintOptionList(listEl, bItems);
          });
          return;
        }

        if (
          opts.kind !== "variant" &&
          listTab === "products" &&
          isLoadingProducts &&
          !products.length &&
          !(global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.entries)
        ) {
          listEl.innerHTML =
            '<p class="dam-tag-edit-popover__empty">Ladowanie katalogu produktow…</p>';
          if (!pop._damAssocLoadGuard) {
            pop._damAssocLoadGuard = setTimeout(function () {
              if (!document.getElementById("damAssocEditPopover")) return;
              if (!isLoadingProducts || products.length) return;
              ensureSearchIndexBootstrap()
                .then(function (si) {
                  global._DAM_SEARCH_INDEX = si || global._DAM_SEARCH_INDEX;
                  isLoadingProducts = false;
                  renderOptions(filter);
                })
                .catch(function () {
                  isLoadingProducts = false;
                  listEl.innerHTML =
                    '<p class="dam-tag-edit-popover__empty">Nie udalo sie zaladowac katalogu. Sprobuj ponownie.</p>';
                });
            }, 2500);
          }
          return;
        }

        /* Never linear-scan full file-index (viz warm catalog without _fromSearchIndex). */
        if (
          opts.kind !== "variant" &&
          listTab === "products" &&
          products.length > 600 &&
          !(products[0] && products[0]._fromSearchIndex)
        ) {
          listEl.innerHTML =
            '<p class="dam-tag-edit-popover__empty">Przygotowywanie lekkiego indeksu…</p>';
          ensureSearchIndexBootstrap()
            .then(function (si) {
              global._DAM_SEARCH_INDEX = si || global._DAM_SEARCH_INDEX;
              isLoadingProducts = false;
              renderOptions(filter);
            })
            .catch(function () {
              listEl.innerHTML =
                '<p class="dam-tag-edit-popover__empty">Nie udalo sie zaladowac katalogu. Sprobuj ponownie.</p>';
            });
          return;
        }

        var excl = buildAssocExclude(opts);
        var matchCap = 120;
        var items = [];

        if (opts.kind === "variant") {
          var seenIds = {};
          var seenIdx = {};
          (opts.variantCandidates || []).some(function (v) {
            if (!v || !v.id || pinnedSet[v.id]) return false;
            if (seenIds[v.id]) return false;
            if (excl.ids[String(v.id)]) return false;
            var vIdx = normIndexKey(v.index || v.id);
            if (vIdx && excl.indexes[vIdx]) return false;
            if (vIdx && seenIdx[vIdx]) return false;
            var blob = ((v.name || v.label || "") + " " + (v.id || "") + " " + (v.index || "")).toLowerCase();
            if (q && blob.indexOf(q) === -1) return false;
            seenIds[v.id] = true;
            if (vIdx) seenIdx[vIdx] = true;
            items.push({
              id: v.id,
              label: v.name || v.label || v.id,
              thumb: variantThumbFast(v),
              sub: v.id || "",
              path: v.path || "",
            });
            return items.length >= matchCap;
          });
          paintOptionList(listEl, items);
          __damDbg("dam-assoc-edit.js:renderOptions", "rendered", {
            kind: opts.kind || "",
            itemsLen: items.length,
            listTab: listTab,
          }, "H3");
          return;
        }

        /* Typed filter: search-index lookup (by_prefix + search_blob) — O(cap) not O(catalog). */
        if (opts.kind !== "variant" && listTab === "products" && q) {
          var indexHits = searchProductIdsFromIndex(q, matchCap + 40);
          if (indexHits.length) {
            var productById = {};
            products.forEach(function (p) {
              if (p && p.id) productById[p.id] = p;
            });
            indexHits.some(function (id) {
              if (pinnedSet[id] || items.length >= matchCap) return items.length >= matchCap;
              var p = productStubById(id, productById, null);
              if (!p || !p.id) return false;
              if (productMatchesExclude(p, excl)) return false;
              if (opts.filterType !== "all" && isVisualizationLike(p)) return false;
              var rev0 = (p.revisions && p.revisions[0]) || {};
              items.push({
                id: p.id,
                label: p.display_name || p.name || p.id,
                thumb: productThumb(p),
                sub: productIndexOf(p) || p.id,
                path: p.path || "",
                brand: p.brand || "",
                category: p.category || "",
                subcategory: p.subcategory_label || "",
                langs: rev0.langs || [],
              });
              return items.length >= matchCap;
            });
            requestAnimationFrame(function () {
              if (passGen && passGen !== pop._damRenderPass) return;
              paintOptionList(listEl, items);
            });
            return;
          }
          /* Trafienie w search-index = 0 — natychmiast pusto, bez skanowania calego file-index. */
          if (global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.entries) {
            listEl.innerHTML =
              '<p class="dam-tag-edit-popover__empty">Brak wyników dla „' +
              esc(String(filter || "").trim()) +
              '".</p>';
            setSearchPreview(pop, null);
            return;
          }
        }

        /* Empty filter: never linear-scan whole catalog (freeze on viz + full file-index). */
        if (!q && opts.kind !== "variant" && listTab === "products") {
          listEl.innerHTML =
            '<p class="dam-tag-edit-popover__empty">Wpisz nazwę, indeks lub tag, aby wyszukać produkt…</p>';
          return;
        }

        /* Search-index loaded — no chunked scan fallback (would walk thousands of rows). */
        if (global._DAM_SEARCH_INDEX && global._DAM_SEARCH_INDEX.entries) {
          listEl.innerHTML =
            '<p class="dam-tag-edit-popover__empty">Brak wyników dla „' +
            esc(String(filter || "").trim()) +
            '".</p>';
          setSearchPreview(pop, null);
          return;
        }

        /* Chunked scan: yield every 350 rows so full file-index never blocks F5. */
        var scanSeenIds = {};
        var scanSeenIdx = {};
        var scanPi = 0;
        var scanChunk = 350;
        function scanProductChunk() {
          if (!document.getElementById("damAssocEditPopover")) return;
          if (passGen && passGen !== pop._damRenderPass) return;
          var end = Math.min(scanPi + scanChunk, products.length);
          for (; scanPi < end && items.length < matchCap; scanPi++) {
            var p = products[scanPi];
            if (!p || !p.id || pinnedSet[p.id]) continue;
            if (scanSeenIds[p.id]) continue;
            if (productMatchesExclude(p, excl)) continue;
            if (opts.filterType !== "all" && isVisualizationLike(p)) continue;
            var idxKey = normIndexKey(productIndexOf(p));
            if (idxKey && scanSeenIdx[idxKey]) continue;
            if (q && productSearchBlob(p).indexOf(q) === -1) continue;
            scanSeenIds[p.id] = true;
            if (idxKey) scanSeenIdx[idxKey] = true;
            var rev0 = (p.revisions && p.revisions[0]) || {};
            items.push({
              id: p.id,
              label: p.display_name || p.name || p.id,
              thumb: productThumb(p),
              sub: productIndexOf(p) || p.id,
              path: p.path || "",
              brand: p.brand || "",
              category: p.category || "",
              subcategory: p.subcategory_label || "",
              langs: rev0.langs || [],
            });
          }
          if (items.length >= matchCap || scanPi >= products.length) {
            requestAnimationFrame(function () {
              if (passGen && passGen !== pop._damRenderPass) return;
              paintOptionList(listEl, items);
              __damDbg("dam-assoc-edit.js:renderOptions", items.length ? "rendered" : "empty", {
                kind: opts.kind || "",
                itemsLen: items.length,
                listTab: listTab,
              }, "H3");
            });
            return;
          }
          requestAnimationFrame(scanProductChunk);
        }
        requestAnimationFrame(scanProductChunk);
      }

      function renderOptions(filter) {
        pop._damRenderPass = (pop._damRenderPass || 0) + 1;
        var passGen = pop._damRenderPass;
        if (pop._damRenderOptionsTimer) clearTimeout(pop._damRenderOptionsTimer);
        var q = String(filter || "").trim();
        /* Empty filter: paint list immediately (shell already in DOM). Deferred chain caused empty/frozen picker. */
        if (!q) {
          renderOptionsNow(filter, passGen);
          return;
        }
        pop._damRenderOptionsTimer = setTimeout(function () {
          pop._damRenderOptionsTimer = null;
          if (!document.getElementById("damAssocEditPopover")) return;
          renderOptionsNow(filter, passGen);
        }, 70);
      }

      function effectiveIdsForTab(tabKey) {
        var src = tabKey === "branding" ? selectedBranding : selectedProducts;
        return Object.keys(src).filter(function (id) {
          return src[id] && !pendingRemove[id];
        });
      }

      function renderSummary() {
        summaryMode = true;
        var body = pop.querySelector(".dam-assoc-edit-popover__body");
        var searchWrap = pop.querySelector(".dam-tag-edit-popover__search-wrap");
        var pinnedWrap = pop.querySelector(".dam-assoc-edit-popover__pinned-wrap");
        if (searchWrap) searchWrap.hidden = true;
        if (pinnedWrap) pinnedWrap.hidden = true;
        if (!body) return;
        var rows = [];
        if (opts.kind !== "variant") {
          effectiveIdsForTab("products").forEach(function (id) {
            var it = lookupItem(id);
            rows.push(
              '<div class="dam-assoc-edit-popover__summary-row"><span>PRODUKT</span><strong>' +
                esc(it.label || id) +
                "</strong></div>"
            );
          });
          effectiveIdsForTab("branding").forEach(function (id) {
            var it = lookupItem(id);
            rows.push(
              '<div class="dam-assoc-edit-popover__summary-row"><span>BRANDING</span><strong>' +
                esc(it.label || id) +
                "</strong></div>"
            );
          });
        } else {
          effectiveIdsForTab("products").forEach(function (id) {
            var it = lookupItem(id);
            rows.push(
              '<div class="dam-assoc-edit-popover__summary-row"><strong>' +
                esc(it.label || id) +
                "</strong></div>"
            );
          });
        }
        Object.keys(pendingRemove).forEach(function (id) {
          if (!pendingRemove[id]) return;
          var it = lookupItem(id);
          rows.push(
            '<div class="dam-assoc-edit-popover__summary-row is-remove"><span>Usuniecie</span><strong>' +
              esc(it.label || id) +
              "</strong></div>"
          );
        });
        body.innerHTML =
          '<div class="dam-assoc-edit-popover__summary">' +
          '<p class="dam-assoc-edit-popover__summary-title">Podsumowanie zmian</p>' +
          '<div class="dam-assoc-edit-popover__summary-list">' +
          (rows.length
            ? rows.join("")
            : '<p class="dam-tag-edit-popover__empty">Brak zmian do zatwierdzenia.</p>') +
          "</div></div>";
        updateActionsForSummary(true);
      }

      function exitSummary() {
        summaryMode = false;
        var body = pop.querySelector(".dam-assoc-edit-popover__body");
        var searchWrap = pop.querySelector(".dam-tag-edit-popover__search-wrap");
        var pinnedWrap = pop.querySelector(".dam-assoc-edit-popover__pinned-wrap");
        if (searchWrap) searchWrap.hidden = false;
        if (pinnedWrap) pinnedWrap.hidden = false;
        if (!body) return;
        body.innerHTML =
          '<aside class="dam-assoc-edit-popover__preview is-empty" id="damAssocEditPreview" aria-live="polite">' +
          '<p class="dam-assoc-edit-popover__preview-label">Podgląd</p>' +
          '<div class="dam-assoc-edit-popover__preview-frame">' +
          '<img alt="" class="is-placeholder" />' +
          '<div class="dam-assoc-edit-popover__preview-empty" aria-hidden="true">' +
          '<i class="uil uil-image"></i><span>Najedź wynik</span></div></div>' +
          '<div class="dam-assoc-edit-popover__preview-caption">Najedź wynik, aby podejrzeć</div>' +
          '<div class="dam-assoc-edit-popover__preview-meta"></div></aside>' +
          '<div class="dam-tag-edit-popover__list dam-assoc-edit-popover__list" role="listbox"></div>';
        updateActionsForSummary(false);
        renderPinned();
        var s = pop.querySelector("#damAssocEditSearch");
        renderOptions(s ? s.value : "");
      }

      function updateActionsForSummary(inSummary) {
        var actions = pop.querySelector(".dam-tag-edit-popover__actions");
        if (!actions) return;
        actions.querySelectorAll("[data-disk],[data-browse],[data-summary],[data-confirm]").forEach(function (el) {
          el.hidden = !!inSummary;
        });
        var okBtn = actions.querySelector("[data-summary-ok]");
        var backBtn = actions.querySelector("[data-summary-back]");
        if (okBtn) okBtn.hidden = !inSummary;
        if (backBtn) backBtn.hidden = !inSummary;
        var cancelBtn = actions.querySelector("[data-cancel]");
        if (cancelBtn) cancelBtn.hidden = !!inSummary;
      }

      function commitPicker() {
        var payload = {
          productIds: effectiveIdsForTab("products"),
          brandingIds: effectiveIdsForTab("branding"),
          listTab: listTab,
        };
        closePicker();
        if (typeof opts.onConfirm === "function") {
          opts.onConfirm(
            listTab === "branding" ? payload.brandingIds : payload.productIds,
            listTab === "branding" ? selectedBranding : selectedProducts,
            payload
          );
        }
      }

      function paintTabs() {
        pop.querySelectorAll("[data-list-tab]").forEach(function (btn) {
          var on = btn.getAttribute("data-list-tab") === listTab;
          btn.classList.toggle("is-active", on);
          btn.setAttribute("aria-selected", on ? "true" : "false");
        });
        var label = pop.querySelector(".dam-assoc-edit-popover__pinned-label");
        if (label) {
          label.textContent = listTab === "branding" ? "Aktualne (branding)" : "Aktualne (produkty)";
        }
        pinnedIds = currentPinnedIds();
        pinnedSet = {};
        pinnedIds.forEach(function (id) {
          pinnedSet[id] = true;
        });
        renderPinned();
        var s = pop.querySelector("#damAssocEditSearch");
        renderOptions(s ? s.value : "");
      }

      function loadBrandingIfNeeded(query) {
        if (brandingDisabled) return;
        if (brandingLoading) return;
        brandingLoading = true;
        var listEl = pop.querySelector(".dam-assoc-edit-popover__list");
        if (listEl) {
          listEl.innerHTML =
            '<p class="dam-tag-edit-popover__empty">Ladowanie katalogu brandingu…</p>';
        }
        searchBrandingPicker(query || "", 80, pinnedBrandingIds)
          .then(function (res) {
            brandingSearch = res || { entries: [], byId: {} };
            brandingLoading = false;
            if (listTab === "branding") {
              var s = pop.querySelector("#damAssocEditSearch");
              renderOptions(s ? s.value : "");
            }
          })
          .catch(function () {
            brandingLoading = false;
            brandingSearch = { entries: [], byId: {} };
            if (listTab === "branding" && listEl) {
              listEl.innerHTML =
                '<p class="dam-tag-edit-popover__empty">Blad ladowania brandingu (timeout 5s).</p>';
            }
          });
      }

      html +=
        "</div></div>" +
        '<div class="dam-tag-edit-popover__actions">' +
        (opts.kind === "product"
          ? '<button type="button" class="dam-tag-edit-popover__confirm dam-assoc-edit-popover__disk" data-disk data-dam-tip="Wybierz folder projektu na dysku">' +
            '<i class="uil uil-folder-plus" aria-hidden="true"></i><span>Dodaj z dysku</span></button>'
          : "") +
        (opts.kind === "variant"
          ? '<button type="button" class="dam-tag-edit-popover__confirm dam-assoc-edit-popover__disk" data-browse data-dam-tip="Wyszukaj plik w eksploratorze">' +
            '<i class="uil uil-folder-open" aria-hidden="true"></i><span>Wskaż plik</span></button>'
          : "") +
        '<button type="button" class="dam-tag-edit-popover__confirm" data-summary><i class="uil uil-list-ul"></i><span>Podsumowanie</span></button>' +
        '<button type="button" class="dam-tag-edit-popover__confirm" data-confirm><i class="uil uil-check"></i><span>Zatwierdź</span></button>' +
        '<button type="button" class="dam-tag-edit-popover__confirm" data-summary-ok hidden><i class="uil uil-check"></i><span>Ok</span></button>' +
        '<button type="button" class="dam-tag-edit-popover__cancel" data-summary-back hidden><i class="uil uil-arrow-left"></i><span>Anuluj</span></button>' +
        '<button type="button" class="dam-tag-edit-popover__cancel" data-cancel><i class="uil uil-arrow-left"></i><span>Wstecz</span></button>' +
        "</div>";
      pop.innerHTML = html;
      overlay.appendChild(pop);
      document.body.appendChild(overlay);
      // #region agent log
      __damDbg("dam-assoc-edit.js:buildAssocMediaPickerUi", "dom_appended", {
        kind: opts.kind || "",
        ms: Date.now() - __buildT0,
        overlayInDom: !!document.getElementById("damAssocEditOverlay"),
      }, "H3");
      // #endregion
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onDocKey, true);

      var search = pop.querySelector("#damAssocEditSearch");
      if (search) {
        var productSearchTimer = null;
        search.addEventListener("input", function () {
          /* Debounce — never sync-scan catalog on every keystroke. */
          clearTimeout(productSearchTimer);
          productSearchTimer = setTimeout(function () {
            if (!document.getElementById("damAssocEditPopover")) return;
            if (listTab === "branding") {
              loadBrandingIfNeeded(search.value || "");
              return;
            }
            renderOptions(search.value);
          }, 120);
        });
      }

      pop.querySelectorAll("[data-list-tab]").forEach(function (tabBtn) {
        tabBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var next = commitAssocListTab(
            tabBtn.getAttribute("data-list-tab"),
            listTab,
            brandingDisabled
          );
          if (next === listTab) return;
          listTab = next;
          paintTabs();
          if (listTab === "branding") {
            loadBrandingIfNeeded((search && search.value) || "");
          }
        });
      });

      var listBoot = pop.querySelector(".dam-assoc-edit-popover__list");
      if (listBoot) {
        listBoot.innerHTML = '<p class="dam-tag-edit-popover__empty">Ładowanie listy…</p>';
      }
      /* One macrotask after shell mount: list must paint in this turn (no rAF+setTimeout chain). */
      setTimeout(function () {
        if (!document.getElementById("damAssocEditPopover")) return;
        renderPinned();
        renderOptions("");
        if (search) {
          try {
            search.focus({ preventScroll: true });
          } catch (eFocus) {
            search.focus();
          }
        }
        __damDbg("dam-assoc-edit.js:buildAssocMediaPickerUi", "list_painted", {
          kind: opts.kind || "",
          variantCandidates: (opts.variantCandidates || []).length,
        }, "H3");
      }, 0);

      pop.querySelector("[data-close]") &&
        pop.querySelector("[data-close]").addEventListener("click", closePicker);
      pop.querySelector("[data-cancel]") &&
        pop.querySelector("[data-cancel]").addEventListener("click", closePicker);
      pop.querySelector("[data-summary]") &&
        pop.querySelector("[data-summary]").addEventListener("click", function () {
          renderSummary();
        });
      pop.querySelector("[data-confirm]") &&
        pop.querySelector("[data-confirm]").addEventListener("click", function () {
          renderSummary();
        });
      pop.querySelector("[data-summary-ok]") &&
        pop.querySelector("[data-summary-ok]").addEventListener("click", function () {
          commitPicker();
        });
      pop.querySelector("[data-summary-back]") &&
        pop.querySelector("[data-summary-back]").addEventListener("click", function () {
          exitSummary();
        });
      pop.querySelector("[data-disk]") &&
        pop.querySelector("[data-disk]").addEventListener("click", function () {
          openDiskFolderPicker(opts, selectedProducts, function (ids) {
            ids.forEach(function (id) {
              selectedProducts[id] = true;
            });
            renderPinned();
            var s2 = pop.querySelector("#damAssocEditSearch");
            renderOptions(s2 ? s2.value : "");
          });
        });
      pop.querySelector("[data-browse]") &&
        pop.querySelector("[data-browse]").addEventListener("click", function () {
          openVariantBrowsePicker(opts, selectedProducts, function (ids) {
            ids.forEach(function (id) {
              selectedProducts[id] = true;
            });
            renderPinned();
            var s2 = pop.querySelector("#damAssocEditSearch");
            renderOptions(s2 ? s2.value : "");
          });
        });

      pop._damAssocHydrateProducts = function (nextProducts) {
        if (nextProducts && nextProducts._indexReady) {
          isLoadingProducts = false;
        } else {
          products = nextProducts || [];
          isLoadingProducts = false;
        }
        if (pop._damAssocLoadGuard) {
          clearTimeout(pop._damAssocLoadGuard);
          pop._damAssocLoadGuard = null;
        }
        var s = pop.querySelector("#damAssocEditSearch");
        setTimeout(function () {
          if (!document.getElementById("damAssocEditPopover")) return;
          if (summaryMode) return;
          renderPinned();
          renderOptions(s ? s.value : "");
        }, 0);
      };
  }

  function openDamFolderPickerSafe(opts) {
    if (!window.DamFolderPicker || typeof window.DamFolderPicker.open !== "function") {
      toast("DamFolderPicker niedostepny - odswiez strone (cache).");
      return false;
    }
    window.DamFolderPicker.open(opts);
    return true;
  }

  function openVariantBrowsePicker(opts, selected, onDone) {
    var start = (opts.asset && opts.asset.path) || "";
    var dir = start.replace(/\\/g, "/");
    var i = dir.lastIndexOf("/");
    if (i > 0) dir = dir.slice(0, i);
    openDamFolderPickerSafe({
      startDir: dir,
      mode: "file",
      allowFolderPick: true,
      title: "Wskaz plik wariantu",
      showWindowsButton: true,
      resolveBrandingAssetId: true,
      onPicked: function (picked) {
        if (!picked) return;
        function commitKey(key) {
          key = String(key || "").trim();
          if (!key) {
            toast("Nie udalo sie zapisac wariantu - pusty identyfikator.");
            return;
          }
          selected[key] = true;
          if (typeof onDone === "function") onDone(Object.keys(selected));
        }
        if (picked.type === "folder") {
          var folder = picked.folder || picked.path;
          if (!folder) {
            toast("Brak folderu wariantu.");
            return;
          }
          var folderNorm = normPath(folder);
          searchBrandingPicker(String(folder).split(/[/\\]/).pop(), 40, [])
            .then(function (res) {
              var entries = (res && res.entries) || [];
              var match = entries.find(function (entry) {
                if (!entry || !entry.path) return false;
                var ep = normPath(entry.path);
                return ep === folderNorm || ep.indexOf(folderNorm + "/") === 0;
              });
              if (match && match.id) {
                commitKey(match.id);
              } else {
                toast("Folder nie jest w indeksie brandingu.");
                commitKey(folder);
              }
            })
            .catch(function () {
              toast("Nie udalo sie sprawdzic indeksu - zapisuje sciezke folderu.");
              commitKey(folder);
            });
          return;
        }
        /* File path from DamFolderPicker.finish: path = branding asset id when resolve ok. */
        var key = picked.id || picked.path || picked.filePath || "";
        if (!key) {
          toast("Brak id/sciezki wariantu po wyborze.");
          return;
        }
        commitKey(key);
      },
    });
  }

  function openDiskFolderPicker(opts, selected, onDone) {
    var start = (opts.asset && opts.asset.path) || "X:/Marketing";
    var dir = start.replace(/\\/g, "/");
    var i = dir.lastIndexOf("/");
    if (i > 0) dir = dir.slice(0, i);
    openDamFolderPickerSafe({
      startDir: dir,
      mode: "folder",
      title: "Wybierz folder",
      showWindowsButton: true,
      onPicked: function (picked) {
        var folder = (picked && (picked.folder || picked.path)) || "";
        if (!folder) return;
        ensureFileIndex().then(function (fi) {
          var products = (fi && fi.products) || [];
          var ids = matchProductsByFolder(products, folder);
          if (!ids.length) {
            toast("Nie znaleziono produktu dla tego folderu. Wybierz produkt z listy.");
            return;
          }
          ids.forEach(function (id) {
            selected[id] = true;
          });
          toast(
            ids.length === 1
              ? "Dodano produkt z folderu"
              : "Dodano produkty z folderu: " + ids.length
          );
          if (typeof onDone === "function") onDone(Object.keys(selected));
        });
      }
    });
  }

  function saveAssociations(ctx, productIds, variantIds, opts) {
    opts = opts || {};
    return fetch(bridgeUrl() + "/branding/asset-associations", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        asset_id: ctx.asset.id,
        folder_group_id: ctx.groupContext.folder_group_id || "",
        linked_product_ids: productIds || [],
        linked_variant_ids: variantIds || [],
      }),
    })
      .then(function (r) {
        return r.json().then(function (res) {
          if (!r.ok || !res || !res.ok) {
            var code = (res && res.error) || ("http_" + r.status);
            if (code === "not_found") {
              throw new Error("bridge_endpoint_missing (zrestartuj local_bridge.py)");
            }
            throw new Error(code);
          }
          return res;
        });
      })
      .then(function (res) {
        /* Pomin "Zapisano" gdy zaraz leci toastUndo (pkt 32 - bez podwojnego toasta). */
        if (!opts.silentToast) toast("Zapisano skojarzenia");
        if (global.DamBranding && typeof global.DamBranding.clearComputeCache === "function") {
          global.DamBranding.clearComputeCache();
        }
        if (typeof ctx.onSaved === "function") ctx.onSaved(productIds, variantIds);
        return res;
      })
      .catch(function (err) {
        toast("Błąd zapisu: " + (err.message || err));
      });
  }

  function ensureAssocGrid(colEl, kind) {
    if (!colEl) return null;
    var grid = colEl.querySelector(".dam-media-preview__assoc-grid, .dam-media-preview__variant-grid");
    if (grid) return grid;
    var empty = colEl.querySelector(".dam-media-preview__assoc-empty");
    grid = document.createElement("div");
    grid.className =
      kind === "variant" ? "dam-media-preview__variant-grid" : "dam-media-preview__assoc-grid";
    if (kind === "variant") {
      grid.setAttribute("role", "listbox");
      grid.setAttribute("aria-label", "Warianty w folderze");
    } else {
      grid.setAttribute("role", "list");
    }
    if (empty) {
      grid.appendChild(empty);
    }
    colEl.appendChild(grid);
    return grid;
  }

  /**
   * Pelne ID skojarzen do edycji.
   * Preferuj groupContext (juz przefiltrowany w UI brandingu) - NIE doklejaj
   * z powrotem folder_linked_product_ids (spray SLIDERY KATEGORIE).
   */
  function collectLinkedIdsFromCtx(ctx, kind) {
    var ids = [];
    var seen = {};
    function add(id) {
      id = String(id || "").trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      ids.push(id);
    }
    var gc = (ctx && ctx.groupContext) || {};
    var asset = (ctx && ctx.asset) || {};
    if (kind === "variant") {
      (gc.variants || asset.folder_variants || asset.variants || []).forEach(function (v) {
        if (v && v.id) add(v.id);
      });
      return ids;
    }
    var gcHas =
      (gc.linked_products && gc.linked_products.length) ||
      (gc.linked_product_ids && gc.linked_product_ids.length);
    if (gcHas) {
      (gc.linked_products || []).forEach(function (p) {
        if (p && p.id) add(p.id);
      });
      (gc.linked_product_ids || []).forEach(add);
      return ids;
    }
    (asset.linked_products || []).forEach(function (p) {
      if (p && p.id) add(p.id);
    });
    (asset.linked_product_ids || []).forEach(add);
    (asset.folder_linked_product_ids || []).forEach(add);
    return ids;
  }

  function openEditPicker(colEl, kind, ctx) {
    /* Macrotask: "Edytuj wszystko" click must return before any list/index work. */
    setTimeout(function () {
      try {
        openEditPickerNow(colEl, kind, ctx);
      } catch (errOpen) {
        console.error("[DamAssocEdit] openEditPicker failed", errOpen);
        toast("Nie udalo sie otworzyc edycji: " + ((errOpen && errOpen.message) || errOpen));
        _assocPickerOpening = false;
      }
    }, 0);
  }

  function openEditPickerNow(colEl, kind, ctx) {
    // #region agent log
    __damDbg("dam-assoc-edit.js:openEditPickerNow", "entry", {
      kind: kind || "",
      canEdit: canEditAssoc(),
      variantCount: ((ctx && ctx.groupContext && ctx.groupContext.variants) || []).length,
    }, "H5");
    // #endregion
    var assocGrid = resolveAssocGrid(colEl) || colEl;
    if (isInsideVizModal(assocGrid) || isInsideVizModal(colEl)) {
      if (kind === "variant") {
        openProductStripVariantAdd(ctx || {});
        return;
      }
      openVizProductMaterialAdd(colEl, ctx || {});
      return;
    }
    if (kind === "product") {
      if (isBrandingProductAssocAdd(assocGrid, ctx || {})) {
        openBrandingProductAssocAdd(colEl, ctx || {});
        return;
      }
      if (isVizProductMaterialsAdd(assocGrid, ctx || {})) {
        openVizProductMaterialAdd(colEl, ctx || {});
        return;
      }
    }
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    ctx = ctx || {};
    if (!ctx.groupContext) ctx.groupContext = {};
    var selectedIds = collectLinkedIdsFromCtx(ctx, kind);
    var brandingIds = kind === "product" ? collectBrandingIdsFromCtx(ctx) : [];
    var excludeIds = [];
    var excludeIndexes = [];
    var gc = ctx.groupContext;
    if (gc.product_id) excludeIds.push(gc.product_id);
    if (gc.source_product_id) excludeIds.push(gc.source_product_id);
    if (gc.product_index) excludeIndexes.push(gc.product_index);
    if (gc.index) excludeIndexes.push(gc.index);
    if (ctx.asset && ctx.asset.product_id) excludeIds.push(ctx.asset.product_id);
    if (ctx.asset && ctx.asset.product_index) excludeIndexes.push(ctx.asset.product_index);
    var filterType = kind === "product" ? "product" : "all";
    if (
      ctx.sourceType === "viz" ||
      ctx.mode === "viz" ||
      (ctx.asset && /viz|wizual/i.test(String(ctx.asset.type || ctx.asset.kind || "")))
    ) {
      filterType = "product";
    }
    if (kind === "product") {
      gc.linked_product_ids = selectedIds.slice();
      var byId = {};
      (gc.linked_products || []).forEach(function (p) {
        if (p && p.id) byId[p.id] = p;
      });
      (ctx.asset && ctx.asset.linked_products ? ctx.asset.linked_products : []).forEach(function (p) {
        if (p && p.id && !byId[p.id]) byId[p.id] = p;
      });
      gc.linked_products = selectedIds.map(function (id) {
        return byId[id] || { id: id };
      });
    }
    openMediaPicker(colEl, {
      kind: kind,
      selectedIds: selectedIds,
      selectedProductIds: selectedIds,
      selectedBrandingIds: brandingIds,
      pinnedIds: selectedIds.slice(),
      pinnedProductIds: selectedIds.slice(),
      pinnedBrandingIds: brandingIds.slice(),
      variantCandidates: (gc.variants || []).slice(),
      asset: ctx.asset,
      groupContext: gc,
      excludeIds: excludeIds,
      excludeIndexes: excludeIndexes,
      filterType: filterType,
      onConfirm: function (ids, selectedMap, payload) {
        payload = payload || {};
        var nextProductIds = payload.productIds || ids || [];
        var nextBrandingIds = payload.brandingIds || [];
        var prevPids = (gc.linked_products || [])
          .map(function (p) {
            return p && p.id;
          })
          .filter(Boolean);
        var prevVids = (gc.variants || [])
          .map(function (v) {
            return v && v.id;
          })
          .filter(Boolean);
        var pids = kind === "product" ? nextProductIds : prevPids;
        var vids = kind === "variant" ? nextProductIds : nextBrandingIds.length ? nextBrandingIds : prevVids;
        var prevForKind = kind === "product" ? prevPids : prevVids;
        var nextForKind = kind === "product" ? nextProductIds : kind === "variant" ? nextProductIds : nextBrandingIds;
        var removed = prevForKind.filter(function (x) {
          return nextForKind.indexOf(x) === -1;
        });
        saveAssociations(ctx, pids, vids, { silentToast: removed.length > 0 }).then(function () {
          if (typeof ctx.onRefresh === "function") ctx.onRefresh();
          if (removed.length && global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
            global.DamDanger.toastUndo({
              message:
                removed.length === 1
                  ? "Usunieto 1 skojarzenie"
                  : "Usunieto skojarzenia: " + removed.length,
              actionLabel: "Cofnij",
              duration: 8000,
              onUndo: function () {
                saveAssociations(ctx, prevPids, prevVids, { silentToast: true }).then(function () {
                  if (typeof ctx.onRefresh === "function") ctx.onRefresh();
                });
              },
            });
          }
        });
      },
    });
  }

  function enterEditMode(colEl, kind, ctx) {
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    var grid = ensureAssocGrid(colEl, kind);
    if (!grid) {
      toast("Brak sekcji do edycji.");
      return;
    }
    if (grid.classList.contains("is-editing")) return;
    grid.classList.add("is-editing");
    colEl.classList.add("is-editing");

    var selectedProducts = {};
    var selectedVariants = {};
    (ctx.groupContext.linked_products || []).forEach(function (p) {
      if (p && p.id) selectedProducts[p.id] = true;
    });
    (ctx.groupContext.variants || []).forEach(function (v) {
      if (v && v.id) selectedVariants[v.id] = true;
    });

    var toolbar = document.createElement("div");
    toolbar.className = "dam-assoc-edit-toolbar";
    toolbar.innerHTML =
      '<button type="button" class="dam-assoc-edit-toolbar__btn" data-add><i class="uil uil-plus"></i> Dodaj</button>' +
      (kind === "product"
        ? '<button type="button" class="dam-assoc-edit-toolbar__btn" data-disk><i class="uil uil-folder-plus"></i> Dodaj z dysku</button>'
        : '<button type="button" class="dam-assoc-edit-toolbar__btn" data-browse><i class="uil uil-folder-open"></i> Wskaż</button>') +
      '<button type="button" class="dam-assoc-edit-toolbar__btn dam-assoc-edit-toolbar__btn--primary" data-save><i class="uil uil-check"></i> Zapisz</button>' +
      '<button type="button" class="dam-assoc-edit-toolbar__btn" data-cancel><i class="uil uil-times"></i> Anuluj</button>';
    var labelRow = colEl.querySelector(".dam-media-preview__assoc-label-row");
    if (labelRow && labelRow.parentNode) {
      labelRow.insertAdjacentElement("afterend", toolbar);
    } else {
      colEl.insertBefore(toolbar, grid);
    }
    requestAnimationFrame(function () {
      toolbar.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    function exitEdit() {
      grid.classList.remove("is-editing");
      colEl.classList.remove("is-editing");
      if (toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
      if (typeof ctx.onRefresh === "function") ctx.onRefresh();
    }

    toolbar.querySelector("[data-cancel]").addEventListener("click", exitEdit);
    toolbar.querySelector("[data-save]").addEventListener("click", function () {
      var pids =
        kind === "product"
          ? Object.keys(selectedProducts)
          : (ctx.groupContext.linked_products || [])
              .map(function (p) {
                return p && p.id;
              })
              .filter(Boolean);
      var vids =
        kind === "variant"
          ? Object.keys(selectedVariants)
          : (ctx.groupContext.variants || [])
              .map(function (v) {
                return v && v.id;
              })
              .filter(Boolean);
      saveAssociations(ctx, pids, vids).then(function () {
        exitEdit();
      });
    });
    toolbar.querySelector("[data-add]").addEventListener("click", function () {
      openMediaPicker(toolbar.querySelector("[data-add]"), {
        kind: kind,
        selectedIds: kind === "product" ? Object.keys(selectedProducts) : Object.keys(selectedVariants),
        variantCandidates: ctx.groupContext.variants || [],
        asset: ctx.asset,
        groupContext: ctx.groupContext,
        excludeIds: [ctx.groupContext && ctx.groupContext.product_id, ctx.asset && ctx.asset.product_id].filter(Boolean),
        excludeIndexes: [ctx.groupContext && ctx.groupContext.product_index, ctx.asset && ctx.asset.product_index].filter(Boolean),
        filterType: kind === "product" ? "product" : "all",
        asset: ctx.asset,
        onConfirm: function (ids) {
          ids.forEach(function (id) {
            if (kind === "product") selectedProducts[id] = true;
            else selectedVariants[id] = true;
          });
        },
      });
    });
    if (toolbar.querySelector("[data-disk]")) {
      toolbar.querySelector("[data-disk]").addEventListener("click", function () {
        openDiskFolderPicker({ asset: ctx.asset }, selectedProducts, function () {});
      });
    }
    if (toolbar.querySelector("[data-browse]")) {
      toolbar.querySelector("[data-browse]").addEventListener("click", function () {
        openVariantBrowsePicker({ asset: ctx.asset, groupContext: ctx.groupContext }, selectedVariants, function (ids) {
          ids.forEach(function (id) {
            selectedVariants[id] = true;
          });
        });
      });
    }
  }

  function quickRemoveProductAssoc(ctx, productId) {
    if (!canEditAssoc() || !productId) return Promise.resolve();
    var prevPids = collectLinkedIdsFromCtx(ctx, "product");
    var nextPids = prevPids.filter(function (id) {
      return id !== productId;
    });
    if (nextPids.length === prevPids.length) return Promise.resolve();
    var prevVids = (ctx.groupContext.variants || [])
      .map(function (v) {
        return v && v.id;
      })
      .filter(Boolean);
    return saveAssociations(ctx, nextPids, prevVids, { silentToast: true }).then(function () {
      if (typeof ctx.onRefresh === "function") ctx.onRefresh();
      if (global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
        global.DamDanger.toastUndo({
          message: "Usunieto 1 skojarzenie",
          actionLabel: "Cofnij",
          duration: 8000,
          onUndo: function () {
            saveAssociations(ctx, prevPids, prevVids, { silentToast: true }).then(function () {
              if (typeof ctx.onRefresh === "function") ctx.onRefresh();
            });
          },
        });
      } else {
        toast("Usunieto skojarzenie");
      }
    });
  }

  /** Shift+minus na kafelku WARIANTY MATERIAŁU - usuwa wariant z grupy. */
  function quickRemoveVariantAssoc(ctx, variantId) {
    if (!canEditAssoc() || !variantId) return Promise.resolve();
    var prevVids = collectLinkedIdsFromCtx(ctx, "variant");
    var nextVids = prevVids.filter(function (id) {
      return id !== variantId;
    });
    if (nextVids.length === prevVids.length) return Promise.resolve();
    var prevPids = collectLinkedIdsFromCtx(ctx, "product");
    return saveAssociations(ctx, prevPids, nextVids, { silentToast: true }).then(function () {
      if (typeof ctx.onRefresh === "function") ctx.onRefresh();
      if (global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
        global.DamDanger.toastUndo({
          message: "Usunieto 1 wariant",
          actionLabel: "Cofnij",
          duration: 8000,
          onUndo: function () {
            saveAssociations(ctx, prevPids, prevVids, { silentToast: true }).then(function () {
              if (typeof ctx.onRefresh === "function") ctx.onRefresh();
            });
          },
        });
      } else {
        toast("Usunieto wariant");
      }
    });
  }

  var ALLFILE_SOFT_HIDE_KEY = "dam_allfile_soft_hide_v1";

  function readAllFileSoftHide() {
    try {
      var raw = sessionStorage.getItem(ALLFILE_SOFT_HIDE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeAllFileSoftHide(arr) {
    try {
      sessionStorage.setItem(ALLFILE_SOFT_HIDE_KEY, JSON.stringify(arr || []));
    } catch (e) {
      /* ignore quota */
    }
  }

  function allFileTileKey(tile) {
    if (!tile) return "";
    var path = String(tile.getAttribute("data-all-path") || "").trim().toLowerCase().replace(/\\/g, "/");
    if (path) return "path:" + path;
    var assetId = String(tile.getAttribute("data-asset-id") || "").trim();
    if (assetId) return "asset:" + assetId;
    var vidx = tile.getAttribute("data-all-vidx");
    if (vidx != null && String(vidx) !== "") return "vidx:" + String(vidx);
    var sib = tile.getAttribute("data-all-sib");
    if (sib != null && String(sib) !== "" && String(sib) !== "-1") return "sib:" + String(sib);
    var lab =
      tile.querySelector(".dam-media-preview__all-file-label") ||
      tile.querySelector(".dam-media-preview__assoc-name");
    var labT = lab ? String(lab.textContent || "").trim() : "";
    return labT ? "lab:" + labT : "";
  }

  /**
   * Soft-hide all-file quality tile from "Pokaż wszystkie" picker only.
   * NEVER deletes disk files. Session-scoped; undo restores tile.
   */
  function softHideAllFileTile(tile) {
    var key = allFileTileKey(tile);
    if (!key || !tile) return;
    var list = readAllFileSoftHide();
    if (list.indexOf(key) < 0) {
      list.push(key);
      writeAllFileSoftHide(list);
    }
    tile.style.display = "none";
    tile.setAttribute("data-soft-hidden", "1");
    var labelEl = tile.querySelector(".dam-media-preview__all-file-label");
    var label = labelEl ? String(labelEl.textContent || "").trim() : "plik";
    if (global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
      global.DamDanger.toastUndo({
        message: "Ukryto " + label + " z listy (nie usunięto z dysku)",
        actionLabel: "Cofnij",
        duration: 8000,
        onUndo: function () {
          var next = readAllFileSoftHide().filter(function (k) {
            return k !== key;
          });
          writeAllFileSoftHide(next);
          tile.style.display = "";
          tile.removeAttribute("data-soft-hidden");
        },
      });
    } else {
      toast("Ukryto " + label + " z listy (nie usunięto z dysku)");
    }
  }

  function applyAllFileSoftHide(host) {
    if (!host) return;
    var hide = readAllFileSoftHide();
    if (!hide.length) return;
    host.querySelectorAll(".dam-media-preview__all-file").forEach(function (tile) {
      var key = allFileTileKey(tile);
      if (key && hide.indexOf(key) >= 0) {
        tile.style.display = "none";
        tile.setAttribute("data-soft-hidden", "1");
      }
    });
  }

  /**
   * Shared hold-to-remove minus control.
   * Parent may be BUTTON (.all-file) → use span[role=button] (no nested <button>).
   */
  function wireQuickMinusControl(item, shiftHost, onClick, tip) {
    if (!item || item.querySelector(".dam-assoc-quick-minus")) return null;
    var nestSafe = String(item.tagName || "").toUpperCase() === "BUTTON";
    var btn = document.createElement(nestSafe ? "span" : "button");
    if (!nestSafe) btn.type = "button";
    btn.className = "dam-assoc-quick-minus";
    btn.setAttribute("role", "button");
    btn.tabIndex = 0;
    var tipText = tip || "Shift + przytrzymaj 1,5 s, aby usunąć";
    btn.setAttribute("aria-label", tipText);
    btn.title = tipText;
    btn.setAttribute("data-dam-tip", tipText);
    btn.innerHTML = '<i class="uil uil-minus" aria-hidden="true"></i>';
    var holdTimer = null;
    var HOLD_MS = 2000;
    function clearHold() {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      btn.classList.remove("is-holding");
    }
    function shiftArmed() {
      return !!(
        shiftKeyDown ||
        (shiftHost && shiftHost.classList.contains("is-shift-hover"))
      );
    }
    function startHold(e) {
      if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      if (!e.shiftKey && !shiftArmed()) {
        clearHold();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      clearHold();
      btn.classList.add("is-holding");
      holdTimer = setTimeout(function () {
        holdTimer = null;
        btn.classList.remove("is-holding");
        onClick();
      }, HOLD_MS);
    }
    btn.addEventListener("pointerdown", startHold);
    btn.addEventListener("pointerup", clearHold);
    btn.addEventListener("pointerleave", clearHold);
    btn.addEventListener("pointercancel", clearHold);
    btn.addEventListener("keydown", startHold);
    btn.addEventListener("keyup", clearHold);
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
    item.appendChild(btn);
    return btn;
  }

  function bindShiftHoverHost(host, opts) {
    if (!host || host._damShiftUxBound) return;
    host._damShiftUxBound = true;
    opts = opts || {};
    function setShift(on) {
      var active = !!(on || shiftKeyDown);
      host.classList.toggle("is-shift-hover", active);
      host.querySelectorAll(".dam-assoc-quick-minus").forEach(function (btn) {
        btn.classList.toggle("is-shift-visible", active);
      });
      if (active && typeof opts.onShiftOn === "function") opts.onShiftOn();
    }
    host.addEventListener("mousemove", function (e) {
      setShift(!!e.shiftKey || shiftKeyDown);
    });
    host.addEventListener("mouseenter", function (e) {
      setShift(!!e.shiftKey || shiftKeyDown);
    });
    host.addEventListener("mouseleave", function () {
      if (!shiftKeyDown) setShift(false);
    });
  }

  function resolveModalScope(el) {
    return (
      (el &&
        el.closest &&
        el.closest("#damVizModal, #damMediaPreview, .dam-viz-modal-overlay, .dam-media-preview-overlay")) ||
      document.getElementById("damVizModal") ||
      document.getElementById("damMediaPreview") ||
      el
    );
  }

  /**
   * Wire Shift-minus onto studio "Pokaż wszystkie" quality tiles (.all-file).
   * Action = soft-hide from picker (session), never disk delete.
   */
  function wireStudioAllFiles(host) {
    if (!host || !canEditAssoc()) return;
    ensureInjectedCss();
    if (typeof window.__damInjectUiHardFixes === "function") {
      window.__damInjectUiHardFixes();
    }
    applyAllFileSoftHide(host);
    var panels = host.matches && host.matches(".dam-media-preview__all-files")
      ? [host]
      : Array.prototype.slice.call(host.querySelectorAll(".dam-media-preview__all-files"));
    if (!panels.length && host.querySelectorAll(".dam-media-preview__all-file").length) {
      panels = [host];
    }
    panels.forEach(function (panel) {
      panel.querySelectorAll(".dam-media-preview__all-file").forEach(function (tile) {
        if (tile.getAttribute("data-soft-hidden") === "1") return;
        wireQuickMinusControl(
          tile,
          panel,
          function () {
            softHideAllFileTile(tile);
          },
          "Shift + przytrzymaj 1,5 s, aby ukryć z listy (nie usuwa z dysku)"
        );
      });
      bindShiftHoverHost(panel);
      if (shiftKeyDown) {
        panel.classList.add("is-shift-hover");
        panel.querySelectorAll(".dam-assoc-quick-minus").forEach(function (btn) {
          btn.classList.add("is-shift-visible");
        });
      }
    });
    ensureGlobalShiftKeyLatch(resolveModalScope(host));
  }

  function applyShiftToScope(scope, down) {
    if (!scope) return;
    scope
      .querySelectorAll(
        ".dam-media-preview__assoc-grid, .dam-media-preview__variant-grid, .dam-media-preview__all-files"
      )
      .forEach(function (grid) {
        grid.classList.toggle("is-shift-hover", !!down);
        grid.querySelectorAll(".dam-assoc-quick-minus").forEach(function (btn) {
          btn.classList.toggle("is-shift-visible", !!down);
        });
        if (down) {
          var plusMissing = !grid.querySelector(".dam-media-preview__assoc-plus-tile");
          if (
            plusMissing &&
            (grid.classList.contains("dam-media-preview__assoc-grid") ||
              grid.classList.contains("dam-media-preview__variant-grid"))
          ) {
            grid.dispatchEvent(new MouseEvent("mousemove", { shiftKey: true, bubbles: true }));
          }
        }
      });
    if (typeof global.showAdminShiftPlus === "function") {
      global.showAdminShiftPlus(!!down);
    } else if (global.DamAdminShiftPlus && typeof global.DamAdminShiftPlus.show === "function") {
      global.DamAdminShiftPlus.show(!!down);
    }
  }

  function ensureGlobalShiftKeyLatch(scopeEl) {
    if (!scopeEl || scopeEl._damShiftKeyBound) return;
    scopeEl._damShiftKeyBound = true;
    function scopeOpen() {
      if (!scopeEl.isConnected) return false;
      var style = window.getComputedStyle(scopeEl);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (scopeEl.hasAttribute("hidden")) return false;
      if (scopeEl.getAttribute("aria-hidden") === "true") return false;
      return true;
    }
    function onKey(e) {
      if (e.key !== "Shift") return;
      shiftKeyDown = e.type === "keydown";
      if (!scopeOpen()) return;
      applyShiftToScope(scopeEl, shiftKeyDown);
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener(
      "blur",
      function () {
        shiftKeyDown = false;
        applyShiftToScope(scopeEl, false);
      },
      true
    );
  }

  /**
   * Shift+hover UX - JEDNA sciezka globalna:
   * branding (#damMediaPreviewAssoc) + viz (#damVizModalAssoc) + studio all-files
   * + WARIANTY / explorer media-preview assoc tiles.
   * - item z data-product-id → minus usuwa produkt
   * - item z data-linked-asset-idx (material) → minus odcina biezacy produkt od assetu
   * - item--variant / data-variant-id → minus usuwa wariant materiałuu
   * - .all-file → soft-hide z pickera (nie kasuje dysku)
   * - plus na koncu → Edytuj wszystko (openEditPicker)
   */
  function ensureShiftHoverAssocUx(assocEl, ctx) {
    if (!assocEl || !ctx || !canEditAssoc()) return;
    ensureInjectedCss();
    if (typeof window.__damInjectUiHardFixes === "function") {
      window.__damInjectUiHardFixes();
    }
    var scope = resolveModalScope(assocEl) || assocEl;

    /* Collect grids from assoc pane AND modal (Elementy / Surowe mount late).
       Use array identity - object-keying HTMLElements collapses to one slot. */
    var gridList = [];
    function collectGrids(root) {
      if (!root || !root.querySelectorAll) return;
      root
        .querySelectorAll(".dam-media-preview__assoc-grid, .dam-media-preview__variant-grid")
        .forEach(function (grid) {
          if (gridList.indexOf(grid) >= 0) return;
          gridList.push(grid);
        });
    }
    collectGrids(assocEl);
    collectGrids(scope);

    gridList.forEach(function (grid) {
        var isVariantGrid = grid.classList.contains("dam-media-preview__variant-grid");
        var inElementy = !!(
          grid.closest &&
          grid.closest(".dam-media-preview__elementy-panel, .dam-media-preview__elementy")
        );
        function ensurePlusTile() {
          /* Assoc products + material/product WARIANTY: Shift+Admin square Dodaj. */
          if (inElementy) return null;
          if (!canEditAssoc()) return null;
          var plus = grid.querySelector(".dam-media-preview__assoc-plus-tile");
          if (!plus) {
            plus = document.createElement("button");
            plus.type = "button";
            plus.className =
              "dam-media-preview__assoc-plus-tile dam-admin-shift-plus dam-admin-shift-plus--tile";
            var isProductStrip = !!(
              grid.classList.contains("dam-viz-modal__variant-strip") ||
              (grid.closest && grid.closest(".dam-viz-modal__product-variants"))
            );
            plus.setAttribute(
              "aria-label",
              isVariantGrid
                ? isProductStrip
                  ? "Dodaj wariant produktu"
                  : "Dodaj wariant materiału"
                : "Edytuj wszystko - dodaj skojarzenie"
            );
            plus.innerHTML = '<i class="uil uil-plus" aria-hidden="true"></i><span>Dodaj</span>';
            if (grid.firstChild) {
              grid.insertBefore(plus, grid.firstChild);
            } else {
              grid.appendChild(plus);
            }
          }
          if (global.DamAdminShiftPlus && typeof global.DamAdminShiftPlus.mount === "function") {
            global.DamAdminShiftPlus.mount(plus, "tile");
          }
          if (!plus._damAssocPlusBound) {
            plus._damAssocPlusBound = true;
            plus.addEventListener("click", function (e) {
              e.preventDefault();
              e.stopPropagation();
              // #region agent log
              __damDbg(
                "dam-assoc-edit.js:plusClick",
                "sync",
                {
                  isVariantGrid: isVariantGrid,
                  variantCandidates: (((ctx || {}).groupContext || {}).variants || []).length,
                },
                "H6"
              );
              // #endregion
              var col = grid.closest(".dam-media-preview__assoc-col") || assocEl;
              var isProductStrip = !!(
                grid.classList.contains("dam-viz-modal__variant-strip") ||
                (grid.closest && grid.closest(".dam-viz-modal__product-variants"))
              );
              /* Macrotask: nigdy nie buduj pickera w tym samym ticku co click (freeze UI). */
              setTimeout(function () {
                try {
                  /* Soft reset only - never dam:panic-reset here (re-enters handlers / freeze). */
                  _assocPickerOpening = false;
                  closePicker();
                  if (!canEditAssoc()) {
                    toast("Włącz tryb admina, aby edytować skojarzenia.");
                    return;
                  }
                  if (
                    global.DamAdminShiftPlus &&
                    typeof global.DamAdminShiftPlus.isRevealed === "function" &&
                    !global.DamAdminShiftPlus.isRevealed() &&
                    !grid.classList.contains("is-shift-hover") &&
                    !document.documentElement.classList.contains("is-shift-revealed")
                  ) {
                    return;
                  }
                  /* HARD: #damVizModal Dodaj NEVER opens heavy COMBO (freeze + dead X). */
                  if (isInsideVizModal(grid) || isInsideVizModal(col)) {
                    if (isVariantGrid) {
                      openProductStripVariantAdd(ctx || {});
                      return;
                    }
                    openVizProductMaterialAdd(col, ctx || {});
                    return;
                  }
                  /* Material WARIANTY: lekki DamFolderPicker. */
                  if (isVariantGrid) {
                    if (ctx && ctx.asset && ctx.asset.id) {
                      openMaterialVariantAdd(ctx || {});
                      return;
                    }
                    openProductStripVariantAdd(ctx || {});
                    return;
                  }
                  if (isVizProductMaterialsAdd(grid, ctx || {})) {
                    openVizProductMaterialAdd(col, ctx || {});
                    return;
                  }
                  if (isBrandingProductAssocAdd(grid, ctx || {})) {
                    openBrandingProductAssocAdd(col, ctx || {});
                    return;
                  }
                  /* Branding "Edytuj wszystko" / non-viz: COMBO with PRODUKT|BRANDING tabs (lazy). */
                  openEditPickerNow(col, "product", ctx || {});
                } catch (errClick) {
                  console.error("[DamAssocEdit] plus click failed", errClick);
                  toast("Blad dodawania wariantu (UI nie zablokowane).");
                  _assocPickerOpening = false;
                }
              }, 0);
            });
          }
          return plus;
        }

        grid.querySelectorAll(".dam-media-preview__assoc-item[data-product-id]").forEach(function (item) {
          wireQuickMinusControl(item, grid, function () {
            quickRemoveProductAssoc(ctx, item.getAttribute("data-product-id") || "");
          });
        });

        grid.querySelectorAll(".dam-media-preview__assoc-item--asset").forEach(function (item) {
          wireQuickMinusControl(item, grid, function () {
            var idxBtn = item.querySelector(
              "[data-linked-asset-idx], [data-element-asset-idx], [data-element-link-idx]"
            );
            var idx = 0;
            if (idxBtn) {
              idx =
                parseInt(
                  idxBtn.getAttribute("data-linked-asset-idx") ||
                    idxBtn.getAttribute("data-element-asset-idx") ||
                    idxBtn.getAttribute("data-element-link-idx"),
                  10
                ) || 0;
            }
            var materials = (
              grid._damAssocList ||
              ctx.materialsList ||
              ctx.shownPrimaries ||
              []
            ).slice();
            var assetId = item.getAttribute("data-asset-id") || "";
            var asset =
              materials[idx] ||
              materials.find(function (a) {
                return a && String(a.id) === String(assetId);
              }) ||
              ctx.asset;
            var pid =
              (ctx.productContext && ctx.productContext.id) ||
              (ctx.groupContext && ctx.groupContext.product_id) ||
              (window.__damLastAssocProductCtx && window.__damLastAssocProductCtx.id) ||
              "";
            if (!asset || !pid) {
              softHideAllFileTile(item);
              return;
            }
            quickUnlinkProductFromMaterial(ctx, asset, pid);
          });
        });

        grid.querySelectorAll(".dam-media-preview__assoc-item--variant[data-variant-id]").forEach(function (item) {
          wireQuickMinusControl(item, grid, function () {
            quickRemoveVariantAssoc(ctx, item.getAttribute("data-variant-id") || "");
          });
        });

        /* Viz modal: WARIANTY PRODUKTU chips (.dam-viz-modal__variant). */
        if (
          grid.classList.contains("dam-viz-modal__variant-strip") ||
          (grid.closest && grid.closest(".dam-viz-modal__product-variants"))
        ) {
          grid.querySelectorAll(".dam-viz-modal__variant[data-variant-key]").forEach(function (item) {
            wireQuickMinusControl(
              item,
              grid,
              function () {
                var vkey = item.getAttribute("data-variant-key") || "";
                var vpath = item.getAttribute("data-path") || "";
                if (typeof ctx.onRemoveProductVariant === "function") {
                  ctx.onRemoveProductVariant(vkey, vpath, item);
                  return;
                }
                toast("Brak handlera usuwania wariantu — odśwież stronę.");
              },
              "Shift + przytrzymaj 2 s, aby usunąć wariant"
            );
          });
        }

        /* Prefetch plus node (hidden until Shift+Admin). */
        ensurePlusTile();

        bindShiftHoverHost(grid, {
          onShiftOn: function () {
            ensurePlusTile();
            if (typeof global.showAdminShiftPlus === "function") {
              global.showAdminShiftPlus(true);
            }
          },
        });
      });

    /* Studio all-files live under modal (sibling of assoc pane) - wire globally. */
    wireStudioAllFiles(scope);
    ensureGlobalShiftKeyLatch(scope);
    if (global.DamAdminShiftPlus && typeof global.DamAdminShiftPlus.ensureLatch === "function") {
      global.DamAdminShiftPlus.ensureLatch();
    }
  }

  /** Odetnij produkt od materialu brandingowego (viz Shift+minus). */
  function quickUnlinkProductFromMaterial(ctx, asset, productId) {
    if (!canEditAssoc() || !asset || !asset.id || !productId) return Promise.resolve();
    var prev = [];
    var seen = {};
    function add(id) {
      id = String(id || "").trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      prev.push(id);
    }
    (asset.linked_products || []).forEach(function (p) {
      if (p && p.id) add(p.id);
    });
    (asset.linked_product_ids || []).forEach(add);
    (asset.folder_linked_product_ids || []).forEach(add);
    var next = prev.filter(function (id) {
      return id !== productId;
    });
    if (next.length === prev.length) return Promise.resolve();
    var matCtx = {
      asset: asset,
      groupContext: {
        folder_group_id: asset.folder_group_id || "",
        linked_products: next.map(function (id) {
          return { id: id };
        }),
        linked_product_ids: next.slice(),
        variants: [],
      },
      onSaved: function () {
        if (typeof ctx.onRefresh === "function") ctx.onRefresh();
      },
      onRefresh: ctx.onRefresh,
    };
    return saveAssociations(matCtx, next, [], { silentToast: true }).then(function () {
      if (typeof ctx.onRefresh === "function") ctx.onRefresh();
      if (global.DamDanger && typeof global.DamDanger.toastUndo === "function") {
        global.DamDanger.toastUndo({
          message: "Usunieto 1 skojarzenie",
          actionLabel: "Cofnij",
          duration: 8000,
          onUndo: function () {
            saveAssociations(matCtx, prev, [], { silentToast: true }).then(function () {
              if (typeof ctx.onRefresh === "function") ctx.onRefresh();
            });
          },
        });
      } else {
        toast("Usunieto skojarzenie");
      }
    });
  }

  /**
   * Publiczny bind Shift UX na panele materialow (viz + branding linked).
   * Wywolywac PO wstawieniu kart do DOM (async load).
   */
  function bindMaterialsPane(assocEl, ctx) {
    if (!assocEl || !ctx) return;
    ensureInjectedCss();
    /* Dopnij Edytuj wszystko gdy brak. */
    var labelRow = assocEl.querySelector(".dam-media-preview__assoc-label-row");
    if (labelRow && !labelRow.querySelector("[data-assoc-edit-all]") && canEditAssoc()) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dam-assoc-edit-all";
      btn.setAttribute("data-assoc-edit-all", "product");
      btn.textContent = "Edytuj wszystko";
      labelRow.appendChild(btn);
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var col = btn.closest(".dam-media-preview__assoc-col") || assocEl;
        if (isVizProductMaterialsAdd(assocEl.querySelector(".dam-media-preview__assoc-grid") || assocEl, ctx)) {
          openVizProductMaterialAdd(btn, ctx);
          return;
        }
        if (isBrandingProductAssocAdd(assocEl.querySelector(".dam-media-preview__assoc-grid") || assocEl, ctx)) {
          openBrandingProductAssocAdd(btn, ctx);
          return;
        }
        var materials = ctx.materialsList || [];
        var asset = materials[0] || ctx.asset;
        if (!asset) {
          toast("Brak materialu do edycji skojarzen.");
          return;
        }
        var ids = [];
        var seen = {};
        function add(id) {
          id = String(id || "").trim();
          if (!id || seen[id]) return;
          seen[id] = true;
          ids.push(id);
        }
        (asset.linked_products || []).forEach(function (p) {
          if (p && p.id) add(p.id);
        });
        (asset.linked_product_ids || []).forEach(add);
        openEditPicker(col, "product", {
          asset: asset,
          mode: "viz",
          sourceType: "viz",
          groupContext: {
            folder_group_id: asset.folder_group_id || "",
            linked_products: ids.map(function (id) {
              return { id: id };
            }),
            linked_product_ids: ids.slice(),
            variants: [],
          },
          onRefresh: ctx.onRefresh,
          onSaved: function (productIds) {
            asset.linked_product_ids = (productIds || []).slice();
            asset.folder_linked_product_ids = (productIds || []).slice();
            if (typeof ctx.onRefresh === "function") ctx.onRefresh();
          },
        });
      });
    }
    ensureShiftHoverAssocUx(assocEl, ctx);
  }

  function bindAssocSection(assocEl, ctx) {
    if (!assocEl || !ctx) return;
    ensureInjectedCss();
    ensureShiftHoverAssocUx(assocEl, ctx);

    assocEl.querySelectorAll("[data-assoc-edit-all]").forEach(function (btn) {
      if (!canEditAssoc()) {
        btn.hidden = true;
        return;
      }
      btn.hidden = false;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var kind = btn.getAttribute("data-assoc-edit-all");
        var col = btn.closest(".dam-media-preview__assoc-col");
        if (col) openEditPicker(col, kind, ctx);
      });
    });

    assocEl.querySelectorAll(".dam-media-preview__assoc-col").forEach(function (col) {
      col.addEventListener("click", function (e) {
        if (!e.shiftKey || !canEditAssoc()) return;
        if (e.target.closest("[data-assoc-edit-all]")) return;
        if (e.target.closest(".dam-assoc-quick-minus")) return;
        if (e.target.closest(".dam-media-preview__assoc-plus-tile")) return;
        var kind =
          col.classList.contains("dam-media-preview__assoc-col--products") ||
          col.classList.contains("dam-media-preview__assoc-col--product")
            ? "product"
            : "variant";
        e.preventDefault();
        e.stopPropagation();
        openEditPicker(col, kind, ctx);
      });
    });

    assocEl.querySelectorAll("[data-assoc-name]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          if (!canEditAssoc()) {
            toast("Włącz tryb admina, aby edytować skojarzenia.");
            return;
          }
          var col = btn.closest(".dam-media-preview__assoc-col");
          if (col) openEditPicker(col, "product", ctx);
          return;
        }
        var pid = btn.getAttribute("data-product-id") || "";
        ensureFileIndex().then(function (fi) {
          var p = (fi.products || []).find(function (x) {
            return x.id === pid;
          });
          openActionMenu(btn, p || { id: pid, display_name: btn.textContent.trim() });
        });
      });
    });

    assocEl.querySelectorAll("[data-assoc-thumb-go]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          if (!canEditAssoc()) {
            toast("Włącz tryb admina, aby edytować skojarzenia.");
            return;
          }
          var col = btn.closest(".dam-media-preview__assoc-col");
          if (col) openEditPicker(col, "product", ctx);
          return;
        }
        var pid = btn.getAttribute("data-product-id") || "";
        if (pid) location.href = "explorer.html?product=" + encodeURIComponent(pid);
      });
    });

    assocEl.querySelectorAll(".dam-media-preview__assoc-item").forEach(function (item) {
      item.addEventListener("click", function (e) {
        if (!e.shiftKey || !canEditAssoc()) return;
        if (e.target.closest("[data-assoc-edit-all]")) return;
        if (e.target.closest(".dam-assoc-quick-minus")) return;
        e.preventDefault();
        e.stopPropagation();
        var col = item.closest(".dam-media-preview__assoc-col");
        if (col) {
          var kind = item.classList.contains("dam-media-preview__assoc-item--variant")
            ? "variant"
            : "product";
          openEditPicker(col, kind, ctx);
        }
      });
    });
  }

  global.DamAssocEdit = {
    canEdit: canEditAssoc,
    bind: bindAssocSection,
    /** Shift+/−/plus na panelu materialow (#damVizModalAssoc + branding linked). */
    bindMaterialsPane: bindMaterialsPane,
    ensureShiftHoverAssocUx: ensureShiftHoverAssocUx,
    /** Shift-minus on studio .all-file tiles (soft-hide picker; no disk delete). */
    wireStudioAllFiles: wireStudioAllFiles,
    enrichLinkedProducts: enrichLinkedProducts,
    openActionMenu: openActionMenu,
    closeActionMenu: closeActionMenu,
    closePicker: closePicker,
    /** Otwiera picker skojarzen (produkty/warianty); uzywane tez w QA/CDP gdy synthetic click nie odpala handlerow. */
    openPicker: openMediaPicker,
    /** Lekki dodaj wariant materialu (folder) - bez ciezkiego assoc shell / branding-index. */
    openMaterialVariantAdd: openMaterialVariantAdd,
    openVizProductMaterialAdd: openVizProductMaterialAdd,
    openBrandingProductAssocAdd: openBrandingProductAssocAdd,
    /** Shift+edit na karcie materialu brandingowego (viz assoc / Elementy). */
    openEditPicker: openEditPicker,
    save: saveAssociations,
  };
})(window);
