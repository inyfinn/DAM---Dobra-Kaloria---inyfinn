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

  function ensureFileIndex() {
    if (global._DAM_FILE_INDEX && global._DAM_FILE_INDEX.products) {
      return Promise.resolve(global._DAM_FILE_INDEX);
    }
    /* Prefer direct fetch over DamSearch.load — large indexes must not hang
       enrichLinkedProducts / assoc paint (gapship20260721a). */
    var fetchP = fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        global._DAM_FILE_INDEX = d;
        return d;
      });
    if (global.DamSearch && typeof global.DamSearch.load === "function") {
      var searchP = global.DamSearch.load()
        .then(function (bundle) {
          return (bundle && bundle.fileIndex) || global._DAM_FILE_INDEX || null;
        })
        .catch(function () {
          return null;
        });
      return Promise.race([
        fetchP,
        searchP.then(function (fi) {
          return fi || fetchP;
        }),
      ]).catch(function () {
        return global._DAM_FILE_INDEX || { products: [] };
      });
    }
    return fetchP.catch(function () {
      return global._DAM_FILE_INDEX || { products: [] };
    });
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
  /** Keyboard Shift latch — mouseleave/mousemove must not clear while key is down. */
  var shiftKeyDown = false;

  /** Wstrzykuje style: Bento grid + pkt 36 podglad LEWA | lista PRAWA (nie ruszamy plikow agentow). */
  function ensureInjectedCss() {
    var css =
      /* Shell / bento grid popover — HARD: 70vw × 90vh (wszędzie: branding + viz) */
      ".dam-assoc-edit-overlay{overflow:hidden;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover.dam-assoc-edit-popover," +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover--wide.dam-assoc-edit-popover{" +
      "display:grid!important;grid-template-columns:minmax(0,1fr);" +
      "grid-template-rows:auto auto auto minmax(0,1fr) auto;" +
      "grid-template-areas:'head' 'pinned' 'search' 'body' 'actions';" +
      "width:70vw!important;min-width:min(70vw,calc(100vw - 16px))!important;" +
      "max-width:min(70vw,calc(100vw - 16px))!important;" +
      "height:90vh!important;min-height:90vh!important;max-height:90vh!important;" +
      "overflow-x:hidden!important;overflow-y:hidden!important;}" +
      ".dam-assoc-edit-popover > .dam-tag-edit-popover__head{grid-area:head;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__pinned-wrap{grid-area:pinned;min-width:0;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__section-sep{display:none;}" +
      ".dam-assoc-edit-popover > .dam-tag-edit-popover__search-wrap{grid-area:search;margin:0!important;" +
      "padding:10px 14px;border-bottom:1px solid #ececf2;}" +
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
      /* Tagi jak na kartach viz (DK / BATONY / Mixy / PL) — nie tiny cut-off */
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
      ".dam-media-preview__all-file{position:relative;}" +
      ".dam-media-preview__assoc-item .dam-assoc-quick-minus," +
      ".dam-media-preview__all-file .dam-assoc-quick-minus{" +
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
      ".dam-media-preview__assoc-plus-tile{" +
      "display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;" +
      "min-height:96px;border:1.5px dashed color-mix(in srgb,var(--dam-primary,#ab54db) 45%,#d7d7e0);" +
      "border-radius:12px;background:color-mix(in srgb,var(--dam-primary,#ab54db) 6%,#fff);color:#7a3aa8;" +
      "cursor:pointer;font-size:12px;font-weight:600;padding:10px;}" +
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-media-preview__assoc-plus-tile{display:flex;}" +
      ".dam-media-preview__assoc-plus-tile i{font-size:22px;}" +
      ".dam-media-preview__assoc-plus-tile:hover{background:color-mix(in srgb,var(--dam-primary,#ab54db) 12%,#fff);" +
      "border-color:var(--dam-primary,#ab54db);}" +
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
      "width:70vw!important;max-width:min(70vw,calc(100vw - 24px))!important;" +
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
      /* Fallback: wizka z file-index.viz_latest (jak karty siatki). */
      var fi = global._DAM_FILE_INDEX;
      var latest = (fi && fi.viz_latest) || [];
      for (var i = 0; i < latest.length; i++) {
        var row = latest[i];
        if (row && row.product_id === p.id && row.thumb_url) return String(row.thumb_url);
      }
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

  function closePicker() {
    var overlay = document.getElementById("damAssocEditOverlay");
    if (overlay) overlay.remove();
    hideThumbZoom();
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onDocKey, true);
  }

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

  function openMediaPicker(anchorEl, opts) {
    opts = opts || {};
    closePicker();
    ensureInjectedCss();
    ensureFileIndex().then(function (fi) {
      var products = (fi && fi.products) || [];
      var selected = {};
      (opts.selectedIds || []).forEach(function (id) {
        selected[id] = true;
      });
      var pinnedIds = (opts.pinnedIds || opts.selectedIds || []).slice();
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

      var head = opts.kind === "variant" ? "Warianty materiału" : "Skojarzone produkty";
      var html =
        '<div class="dam-tag-edit-popover__head">' +
        "<span>" +
        esc(head) +
        '</span><button type="button" class="dam-tag-edit-popover__close" data-close aria-label="Zamknij">' +
        '<i class="uil uil-times"></i></button></div>' +
        '<div class="dam-assoc-edit-popover__pinned-wrap">' +
        '<div class="dam-assoc-edit-popover__pinned-label">Aktualne</div>' +
        '<div class="dam-assoc-edit-popover__pinned"></div>' +
        "</div>" +
        '<div class="dam-assoc-edit-popover__section-sep" aria-hidden="true"></div>' +
        '<div class="dam-tag-edit-popover__search-wrap">' +
        '<i class="uil uil-search" aria-hidden="true"></i>' +
        '<input type="text" id="damAssocEditSearch" class="dam-tag-edit-popover__search" placeholder="Szukaj tytuł, indeks, wariant…" autocomplete="off" />' +
        "</div>" +
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

      function lookupItem(id) {
        if (opts.kind === "variant") {
          var v = (opts.variantCandidates || []).find(function (x) {
            return x && x.id === id;
          });
          if (v) {
            return {
              id: v.id,
              label: v.name || v.label || v.id,
              thumb: v.path && global.DamMediaPreview ? global.DamMediaPreview.previewUrl(v.path, v) : "",
              sub: v.id || "",
              path: v.path || "",
            };
          }
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
        if (opts.kind !== "variant") {
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
        var on = !!selected[it.id];
        return (
          '<div class="dam-assoc-edit-popover__opt-row">' +
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
            if (selected[id]) delete selected[id];
            else selected[id] = true;
            renderPinned();
            var s = pop.querySelector("#damAssocEditSearch");
            renderOptions(s ? s.value : "");
          }
          /* Pkt 27-29: odznaczenie AKTUALNEGO skojarzenia = akcja destrukcyjna ->
             hold-to-delete (ring). Dodawanie / ponowne zaznaczenie = zwykly klik. */
          var isRemove = btn.classList.contains("is-pinned") && !!selected[id];
          if (isRemove && global.DamDanger && typeof global.DamDanger.bind === "function") {
            global.DamDanger.bind(btn, {
              label: "Usun skojarzenie",
              hint: "Przytrzymaj 3 sekundy, aby usunac skojarzenie",
              holdMs: 3000,
              onConfirm: toggle,
            });
          } else {
            btn.addEventListener("click", function (e) {
              e.preventDefault();
              e.stopPropagation();
              toggle();
            });
          }
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

      function renderPinned() {
        var pinnedEl = pop.querySelector(".dam-assoc-edit-popover__pinned");
        if (!pinnedEl) return;
        if (!pinnedIds.length) {
          pinnedEl.innerHTML = '<p class="dam-tag-edit-popover__empty">Brak aktualnych skojarzen.</p>';
          setSearchPreview(pop, null);
          return;
        }
        pinnedEl.innerHTML = pinnedIds
          .map(function (id) {
            return optionButtonHtml(lookupItem(id), true);
          })
          .join("");
        bindOptionButtons(pinnedEl);
        /* Podglad: pierwsza przypieta miniatura (nie "Brak miniatury" przy otwarciu). */
        activatePreviewFromBtn(pinnedEl.querySelector(".dam-assoc-edit-popover__opt[data-id]"));
      }

      function renderOptions(filter) {
        var q = String(filter || "")
          .toLowerCase()
          .trim();
        var listEl = pop.querySelector(".dam-assoc-edit-popover__list");
        if (!listEl) return;
        var excl = buildAssocExclude(opts);
        var seenIds = {};
        var seenIdx = {};
        var items = [];
        if (opts.kind === "variant") {
          (opts.variantCandidates || []).forEach(function (v) {
            if (!v || !v.id || pinnedSet[v.id]) return;
            if (seenIds[v.id]) return;
            if (excl.ids[String(v.id)]) return;
            var vIdx = normIndexKey(v.index || v.id);
            if (vIdx && excl.indexes[vIdx]) return;
            if (vIdx && seenIdx[vIdx]) return;
            var blob = ((v.name || v.label || "") + " " + (v.id || "") + " " + (v.index || "")).toLowerCase();
            if (q && blob.indexOf(q) === -1) return;
            seenIds[v.id] = true;
            if (vIdx) seenIdx[vIdx] = true;
            items.push({
              id: v.id,
              label: v.name || v.label || v.id,
              thumb: v.path && global.DamMediaPreview ? global.DamMediaPreview.previewUrl(v.path, v) : "",
              sub: v.id || "",
              path: v.path || "",
            });
          });
        } else {
          products.forEach(function (p) {
            if (!p || !p.id || pinnedSet[p.id]) return;
            if (seenIds[p.id]) return;
            /* Zakaz self-assoc / petli + dedupe po indeksie */
            if (productMatchesExclude(p, excl)) return;
            /* W kontekscie produktu/viz: nie proponuj wizualizacji jako "produktow" */
            if (opts.filterType !== "all" && isVisualizationLike(p)) return;
            var idxKey = normIndexKey(productIndexOf(p));
            if (idxKey && seenIdx[idxKey]) return;
            if (q && productSearchBlob(p).indexOf(q) === -1) return;
            seenIds[p.id] = true;
            if (idxKey) seenIdx[idxKey] = true;
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
          });
        }
        items = items.slice(0, 120);
        if (!items.length) {
          listEl.innerHTML = '<p class="dam-tag-edit-popover__empty">Brak wyników dla tego wyszukiwania.</p>';
          var pinnedKeep = pop.querySelector(
            ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"
          );
          if (pinnedKeep) activatePreviewFromBtn(pinnedKeep);
          else setSearchPreview(pop, null);
          return;
        }
        listEl.innerHTML = items.map(function (it) {
          return optionButtonHtml(it, false);
        }).join("");
        bindOptionButtons(listEl);
        /* Preferuj podglad z AKTUALNYCH (pinned), nie z pierwszego wyniku wyszukiwania. */
        var pinnedBtn = pop.querySelector(
          ".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]"
        );
        if (pinnedBtn) {
          activatePreviewFromBtn(pinnedBtn);
        } else {
          var firstBtn = listEl.querySelector(".dam-assoc-edit-popover__opt[data-id]");
          if (firstBtn) activatePreviewFromBtn(firstBtn);
        }
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
        '<button type="button" class="dam-tag-edit-popover__confirm" data-confirm><i class="uil uil-check"></i><span>Zatwierdź</span></button>' +
        '<button type="button" class="dam-tag-edit-popover__cancel" data-cancel><i class="uil uil-arrow-left"></i><span>Wstecz</span></button>' +
        "</div>";
      pop.innerHTML = html;
      overlay.appendChild(pop);
      document.body.appendChild(overlay);
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onDocKey, true);

      var search = pop.querySelector("#damAssocEditSearch");
      if (search) {
        search.focus();
        search.addEventListener("input", function () {
          renderOptions(search.value);
        });
      }
      renderPinned();
      renderOptions("");
      activatePreviewFromBtn(
        pop.querySelector(".dam-assoc-edit-popover__pinned .dam-assoc-edit-popover__opt[data-id]")
      );

      pop.querySelector("[data-close]") &&
        pop.querySelector("[data-close]").addEventListener("click", closePicker);
      pop.querySelector("[data-cancel]") &&
        pop.querySelector("[data-cancel]").addEventListener("click", closePicker);
      pop.querySelector("[data-confirm]") &&
        pop.querySelector("[data-confirm]").addEventListener("click", function () {
          var ids = Object.keys(selected);
          closePicker();
          if (typeof opts.onConfirm === "function") opts.onConfirm(ids, selected);
        });
      pop.querySelector("[data-disk]") &&
        pop.querySelector("[data-disk]").addEventListener("click", function () {
          openDiskFolderPicker(opts, selected, function (ids) {
            closePicker();
            if (typeof opts.onConfirm === "function") opts.onConfirm(ids, selected);
          });
        });
      pop.querySelector("[data-browse]") &&
        pop.querySelector("[data-browse]").addEventListener("click", function () {
          openVariantBrowsePicker(opts, selected, function (ids) {
            closePicker();
            if (typeof opts.onConfirm === "function") opts.onConfirm(ids, selected);
          });
        });
    });
  }

  function openVariantBrowsePicker(opts, selected, onDone) {
    var start = (opts.asset && opts.asset.path) || "";
    var dir = start.replace(/\\/g, "/");
    var i = dir.lastIndexOf("/");
    if (i > 0) dir = dir.slice(0, i);
    openFolderGrid(dir, function (picked) {
      if (picked && picked.variant_id) selected[picked.variant_id] = true;
      onDone(Object.keys(selected));
    }, true);
  }

  function openDiskFolderPicker(opts, selected, onDone) {
    var start = (opts.asset && opts.asset.path) || "X:/Marketing";
    var dir = start.replace(/\\/g, "/");
    var i = dir.lastIndexOf("/");
    if (i > 0) dir = dir.slice(0, i);
    openFolderGrid(dir, function (picked) {
      if (!picked || !picked.folder) return;
      ensureFileIndex().then(function (fi) {
        var products = (fi && fi.products) || [];
        var ids = matchProductsByFolder(products, picked.folder);
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
    }, false);
  }

  function openFolderGrid(startDir, onPicked, pickVariants) {
    var existing = document.getElementById("damAssocFolderPicker");
    if (existing) existing.remove();
    var overlay = document.createElement("div");
    overlay.id = "damAssocFolderPicker";
    overlay.className = "dam-thumb-picker-overlay";
    // Musi byc NAD nakladka edycji skojarzen (z-index 12100), inaczej nie da sie kliknac.
    overlay.style.zIndex = "12300";
    overlay.innerHTML =
      '<div class="dam-thumb-picker-box">' +
      '<div class="dam-thumb-picker__head"><strong>' +
      (pickVariants ? "Wskaż plik wariantu" : "Wybierz folder projektu") +
      "</strong>" +
      '<button type="button" class="dam-admin-control" id="damAssocFolderPickerClose">×</button></div>' +
      '<div class="dam-thumb-picker__nav">' +
      '<button type="button" class="dam-admin-control" id="damAssocFolderPickerUp"><i class="uil uil-arrow-up"></i></button>' +
      '<input type="text" id="damAssocFolderPickerPath" class="dam-thumb-picker__path-input" />' +
      '<button type="button" class="dam-admin-control" id="damAssocFolderPickerGo">Idź</button>' +
      "</div>" +
      '<div class="dam-thumb-picker__grid" id="damAssocFolderPickerGrid">Ładowanie…</div></div>';
    document.body.appendChild(overlay);
    document.getElementById("damAssocFolderPickerClose").onclick = function () {
      overlay.remove();
    };
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });

    function loadDir(target) {
      var grid = document.getElementById("damAssocFolderPickerGrid");
      var pathInput = document.getElementById("damAssocFolderPickerPath");
      if (grid) grid.innerHTML = "Ładowanie…";
      fetch(bridgeUrl() + "/folder-browse?path=" + encodeURIComponent(target) + "&mode=assets")
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          grid = document.getElementById("damAssocFolderPickerGrid");
          if (!grid) return;
          if (!data || !data.ok) {
            grid.innerHTML = "<p>Nie udało się otworzyć folderu.</p>";
            return;
          }
          if (pathInput) pathInput.value = data.path || target;
          var folders = data.folders || [];
          var files = data.files || [];
          var html = "";
          if (!pickVariants) {
            html +=
              '<button type="button" class="dam-thumb-picker__item dam-thumb-picker__item--folder dam-admin-control" data-select-folder="' +
              esc(data.path || target) +
              '"><i class="uil uil-check-circle"></i><span class="dam-thumb-picker__name">Użyj tego folderu</span></button>';
          }
          html += folders
            .map(function (f) {
              return (
                '<button type="button" class="dam-thumb-picker__item dam-thumb-picker__item--folder dam-admin-control" data-open="' +
                esc(f.path) +
                '"><i class="uil uil-folder"></i><span class="dam-thumb-picker__name">' +
                esc(f.name) +
                "</span></button>"
              );
            })
            .join("");
          html += files
            .map(function (f) {
              return (
                '<button type="button" class="dam-thumb-picker__item dam-admin-control" data-file="' +
                esc(f.path) +
                '" data-name="' +
                esc(f.name) +
                '"><span class="dam-thumb-picker__name">' +
                esc(f.name) +
                "</span></button>"
              );
            })
            .join("");
          grid.innerHTML = html || "<p>Folder pusty.</p>";
          grid.querySelectorAll("[data-open]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              loadDir(btn.getAttribute("data-open"));
            });
          });
          grid.querySelectorAll("[data-select-folder]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              overlay.remove();
              onPicked({ folder: btn.getAttribute("data-select-folder") });
            });
          });
          grid.querySelectorAll("[data-file]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              overlay.remove();
              onPicked({
                path: btn.getAttribute("data-file"),
                name: btn.getAttribute("data-name"),
                variant_id: btn.getAttribute("data-file"),
              });
            });
          });
        });
    }

    document.getElementById("damAssocFolderPickerGo").onclick = function () {
      loadDir(document.getElementById("damAssocFolderPickerPath").value || startDir);
    };
    document.getElementById("damAssocFolderPickerUp").onclick = function () {
      var cur = document.getElementById("damAssocFolderPickerPath").value || startDir;
      var p = cur.replace(/\\/g, "/");
      var j = p.lastIndexOf("/");
      if (j > 0) loadDir(p.slice(0, j));
    };
    loadDir(startDir);
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
   * Preferuj groupContext (juz przefiltrowany w UI brandingu) — NIE doklejaj
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
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    var selectedIds = collectLinkedIdsFromCtx(ctx, kind);
    var excludeIds = [];
    var excludeIndexes = [];
    var gc = ctx.groupContext || {};
    if (gc.product_id) excludeIds.push(gc.product_id);
    if (gc.source_product_id) excludeIds.push(gc.source_product_id);
    if (gc.product_index) excludeIndexes.push(gc.product_index);
    if (gc.index) excludeIndexes.push(gc.index);
    if (ctx.asset && ctx.asset.product_id) excludeIds.push(ctx.asset.product_id);
    if (ctx.asset && ctx.asset.product_index) excludeIndexes.push(ctx.asset.product_index);
    /* Kontekst wizualizacji / produktu: filtr typu produktu (bez innych wizualizacji) */
    var filterType = kind === "product" ? "product" : "all";
    if (ctx.sourceType === "viz" || ctx.mode === "viz" || (ctx.asset && /viz|wizual/i.test(String(ctx.asset.type || ctx.asset.kind || "")))) {
      filterType = "product";
    }
    /* Upewnij sie, ze groupContext ma pelna liste do zapisu/undo (nie tylko uciety linked_products). */
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
      pinnedIds: selectedIds.slice(),
      variantCandidates: ctx.groupContext.variants || [],
      asset: ctx.asset,
      groupContext: ctx.groupContext,
      excludeIds: excludeIds,
      excludeIndexes: excludeIndexes,
      filterType: filterType,
      onConfirm: function (ids) {
        var prevPids = (ctx.groupContext.linked_products || [])
          .map(function (p) { return p && p.id; })
          .filter(Boolean);
        var prevVids = (ctx.groupContext.variants || [])
          .map(function (v) { return v && v.id; })
          .filter(Boolean);
        var pids = kind === "product" ? ids : prevPids;
        var vids = kind === "variant" ? ids : prevVids;

        /* Pkt 32: cooldown / soft-delete. Jesli zapis USUWA skojarzenia,
           daj okno "Cofnij" (~7 s) przywracajace poprzedni stan. */
        var prevForKind = kind === "product" ? prevPids : prevVids;
        var nextForKind = ids || [];
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

  /** Shift+minus na kafelku WARIANTY MATERIAŁU — usuwa wariant z grupy. */
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
    var tipText = tip || "Shift + przytrzymaj 2 s, aby usunąć";
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
          "Shift + przytrzymaj 2 s, aby ukryć z listy (nie usuwa z dysku)"
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
        if (down && grid.classList.contains("dam-media-preview__assoc-grid")) {
          var plus = grid.querySelector(".dam-media-preview__assoc-plus-tile");
          if (!plus) {
            grid.dispatchEvent(new MouseEvent("mousemove", { shiftKey: true, bubbles: true }));
          }
        }
      });
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
   * Shift+hover UX — JEDNA sciezka globalna:
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
       Use array identity — object-keying HTMLElements collapses to one slot. */
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
          /* brandComposer20260721a: material WARIANTY grid gets plus → Edytuj wszystko (variant). */
          if (
            isVariantGrid &&
            !grid.classList.contains("dam-media-preview__variant-grid--material")
          ) {
            return null;
          }
          if (inElementy) return null;
          var plus = grid.querySelector(".dam-media-preview__assoc-plus-tile");
          if (plus) return plus;
          plus = document.createElement("button");
          plus.type = "button";
          plus.className = "dam-media-preview__assoc-plus-tile";
          plus.setAttribute("aria-label", "Edytuj wszystko — dodaj skojarzenie");
          plus.innerHTML = '<i class="uil uil-plus" aria-hidden="true"></i><span>Dodaj</span>';
          plus.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var col = grid.closest(".dam-media-preview__assoc-col") || assocEl;
            var editBtn = col.querySelector("[data-assoc-edit-all]");
            if (editBtn) {
              editBtn.click();
              return;
            }
            openEditPicker(col, isVariantGrid ? "variant" : "product", ctx);
          });
          grid.appendChild(plus);
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

        bindShiftHoverHost(grid, {
          onShiftOn: function () {
            ensurePlusTile();
          },
        });
      });

    /* Studio all-files live under modal (sibling of assoc pane) — wire globally. */
    wireStudioAllFiles(scope);
    ensureGlobalShiftKeyLatch(scope);
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
        var materials = ctx.materialsList || [];
        var asset = materials[0] || ctx.asset;
        if (!asset) {
          toast("Brak materiału do edycji skojarzeń.");
          return;
        }
        var col = btn.closest(".dam-media-preview__assoc-col") || assocEl;
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
    /** Shift+edit na karcie materialu brandingowego (viz assoc / Elementy). */
    openEditPicker: openEditPicker,
    save: saveAssociations,
  };
})(window);
