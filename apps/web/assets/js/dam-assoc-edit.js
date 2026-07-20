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
    if (global.DamSearch && typeof global.DamSearch.load === "function") {
      return global.DamSearch.load().then(function (bundle) {
        return bundle.fileIndex || global._DAM_FILE_INDEX || null;
      });
    }
    if (global._DAM_FILE_INDEX && global._DAM_FILE_INDEX.products) {
      return Promise.resolve(global._DAM_FILE_INDEX);
    }
    return fetch("data/file-index.json?v=" + Date.now())
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        global._DAM_FILE_INDEX = d;
        return d;
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

  /** Wstrzykuje style: Bento grid + pkt 36 podglad LEWA | lista PRAWA (nie ruszamy plikow agentow). */
  function ensureInjectedCss() {
    var css =
      /* Shell / bento grid popover */
      ".dam-assoc-edit-overlay{overflow:hidden;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover.dam-assoc-edit-popover," +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover--wide.dam-assoc-edit-popover{" +
      "display:grid!important;grid-template-columns:minmax(0,1fr);" +
      "grid-template-rows:auto auto auto minmax(0,1fr) auto;" +
      "grid-template-areas:'head' 'pinned' 'search' 'body' 'actions';" +
      "width:min(720px,calc(100vw - 24px))!important;" +
      "max-width:min(720px,calc(100vw - 24px))!important;" +
      "max-height:min(88dvh,640px)!important;height:auto!important;" +
      "overflow-x:hidden!important;overflow-y:hidden!important;}" +
      ".dam-assoc-edit-popover > .dam-tag-edit-popover__head{grid-area:head;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__pinned-wrap{grid-area:pinned;min-width:0;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__section-sep{display:none;}" +
      ".dam-assoc-edit-popover > .dam-tag-edit-popover__search-wrap{grid-area:search;margin:0!important;" +
      "padding:10px 14px;border-bottom:1px solid #ececf2;}" +
      ".dam-assoc-edit-popover > .dam-assoc-edit-popover__body{grid-area:body;min-height:0;min-width:0;}" +
      ".dam-assoc-edit-popover > .dam-tag-edit-popover__actions{grid-area:actions;}" +
      /* Body: preview LEFT | list RIGHT */
      ".dam-assoc-edit-popover__body{display:grid;grid-template-columns:200px minmax(0,1fr);gap:12px;" +
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
      ".dam-assoc-edit-popover__tags{display:flex;flex-wrap:wrap;gap:3px;max-height:22px;overflow:hidden;}" +
      ".dam-assoc-edit-popover__tags .dam-viz-badge{font-size:10px;padding:1px 6px;max-width:100%;" +
      "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".dam-assoc-edit-popover__row-actions{display:flex;align-items:center;gap:3px;flex-shrink:0;padding-right:4px;}" +
      ".dam-assoc-edit-popover__row-btn{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;" +
      "border:1px solid #e7e7ec;border-radius:7px;background:#fff;color:#6b6b76;cursor:pointer;font-size:14px;" +
      "transition:background .12s ease,color .12s ease,border-color .12s ease;}" +
      ".dam-assoc-edit-popover__row-btn:hover{background:#f8f4fd;color:var(--dam-primary,#ab54db);border-color:#e2d3f2;}" +
      ".dam-assoc-edit-popover__opt.is-pinned:not(.is-selected) .dam-assoc-edit-popover__check{color:#e2506b;}" +
      ".dam-assoc-edit-popover__opt.is-pinned .dam-assoc-edit-popover__check{width:22px;font-size:17px;}" +
      ".dam-assoc-edit-popover__opt.is-preview-active{background:#f8f4fd!important;" +
      "box-shadow:inset 0 0 0 1px #e2d3f2;}" +
      ".dam-assoc-edit-popover__pinned{max-height:min(22dvh,140px);overflow-x:hidden;overflow-y:auto;}" +
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
      "width:min(100vw - 16px,560px)!important;max-width:min(100vw - 16px,560px)!important;}" +
      ".dam-assoc-edit-popover__body{grid-template-columns:1fr;grid-template-rows:auto minmax(120px,1fr);}" +
      ".dam-assoc-edit-popover__preview-frame{min-height:140px;max-height:160px;aspect-ratio:auto;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__actions{justify-content:stretch;}" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__confirm," +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover__cancel{flex:1 1 auto;}" +
      "}" +
      "@media (min-width:768px) and (max-width:1279.98px){" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover.dam-assoc-edit-popover{" +
      "width:min(680px,calc(100vw - 24px))!important;}" +
      ".dam-assoc-edit-popover__body{grid-template-columns:180px minmax(0,1fr);}" +
      "}" +
      "@media (min-width:1280px){" +
      ".dam-assoc-edit-overlay .dam-tag-edit-popover.dam-assoc-edit-popover{" +
      "width:min(760px,calc(100vw - 48px))!important;max-width:760px!important;}" +
      ".dam-assoc-edit-popover__body{grid-template-columns:220px minmax(0,1fr);gap:14px;}" +
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
    var slug = p.id || "";
    var rev = (p.revisions && p.revisions[0]) || {};
    var base = (rev.path || rev.viz_path || "").split(/[/\\]/).pop() || "000098";
    base = base.replace(/\.[^.]+$/, "");
    return "data/thumbs/" + slug + "__" + base + "_pl.jpg?v=" + (Date.now() % 999999);
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
        setSearchPreview(pop, {
          thumb: thumb ? thumb.currentSrc || thumb.src : "",
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
            return {
              id: p.id,
              label: p.display_name || p.name || p.id,
              thumb: productThumb(p),
              sub: productIndexOf(p) || p.id,
              path: p.path || "",
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

      /* Pkt 9: wiersz tagow - marka, kategoria, podkategoria, jezyk, indeks */
      function optionTagsHtml(it) {
        var tags = [];
        function tag(v, cls, tip) {
          if (!v) return;
          tags.push(
            '<span class="dam-viz-badge' +
              (cls ? " " + cls : "") +
              '"' +
              (tip ? ' title="' + esc(tip) + '"' : "") +
              ">" +
              esc(v) +
              "</span>"
          );
        }
        tag(it.brand, "dam-viz-badge--brand", "Marka");
        tag(stripCategoryPrefix(it.category), "", "Kategoria");
        tag(it.subcategory, "", "Podkategoria");
        (it.langs || []).forEach(function (lg) {
          tag(String(lg).toUpperCase(), "", "Język");
        });
        tag(it.sub, "dam-viz-badge--index", "Indeks");
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

      function renderPinned() {
        var pinnedEl = pop.querySelector(".dam-assoc-edit-popover__pinned");
        if (!pinnedEl) return;
        if (!pinnedIds.length) {
          pinnedEl.innerHTML = '<p class="dam-tag-edit-popover__empty">Brak aktualnych skojarzen.</p>';
          return;
        }
        pinnedEl.innerHTML = pinnedIds
          .map(function (id) {
            return optionButtonHtml(lookupItem(id), true);
          })
          .join("");
        bindOptionButtons(pinnedEl);
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
          setSearchPreview(pop, null);
          return;
        }
        listEl.innerHTML = items.map(function (it) {
          return optionButtonHtml(it, false);
        }).join("");
        bindOptionButtons(listEl);
        var firstBtn = listEl.querySelector(".dam-assoc-edit-popover__opt[data-id]");
        if (firstBtn) {
          var thumb = firstBtn.querySelector(".dam-assoc-edit-popover__thumb");
          var labelEl = firstBtn.querySelector(".dam-assoc-edit-popover__label");
          var idxBadge = firstBtn.querySelector(".dam-viz-badge--index");
          setSearchPreview(pop, {
            thumb: thumb ? thumb.currentSrc || thumb.src : items[0].thumb,
            label: labelEl ? labelEl.textContent : items[0].label,
            sub: idxBadge ? idxBadge.textContent : items[0].sub || "",
            btn: firstBtn,
          });
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

  function openEditPicker(colEl, kind, ctx) {
    if (!canEditAssoc()) {
      toast("Włącz tryb admina, aby edytować skojarzenia.");
      return;
    }
    var selectedIds =
      kind === "product"
        ? (ctx.groupContext.linked_products || [])
            .map(function (p) {
              return p && p.id;
            })
            .filter(Boolean)
        : (ctx.groupContext.variants || [])
            .map(function (v) {
              return v && v.id;
            })
            .filter(Boolean);
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

  function bindAssocSection(assocEl, ctx) {
    if (!assocEl || !ctx) return;

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
        e.preventDefault();
        e.stopPropagation();
        var col = item.closest(".dam-media-preview__assoc-col");
        if (col) openEditPicker(col, "product", ctx);
      });
    });
  }

  global.DamAssocEdit = {
    canEdit: canEditAssoc,
    bind: bindAssocSection,
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
