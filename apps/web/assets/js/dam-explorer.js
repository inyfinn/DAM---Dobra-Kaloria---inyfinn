/**
 * DAM - File Explorer v3 (nosniki ludzkie, MIXY, checklista, DK+GC)
 * Wymaga: dam-labels.js zaladowanego PRZED tym plikiem (window.DamLabels)
 */
(function () {
  "use strict";

  var DL = window.DamLabels;

  function bridgeUrl() {
    if (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function") {
      return window.DamRuntime.bridgeUrl();
    }
    if (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function") {
      return window.DamPaths.bridgeUrl();
    }
    return "http://127.0.0.1:8766";
  }

  var STATUS_KEY = "dam_product_status";
  var ADMIN_KEY  = "dam_admin_mode";
  var RECENT_KEY = "dam_explorer_recent";
  var VIZ_VIEW_KEY = "dam_viz_view_mode";
  var VIZ_SCALE_KEY = "dam_viz_scale";
  var SHOW_ALL_KEY = "dam_explorer_show_all";
  var LANG_FILTER_KEY = "dam_explorer_lang_filter";
  var CAT_MODE_KEY = "dam_explorer_cat_mode";
  var EXPLORER_CAT_PRODUCT = "PRODUCT";
  var EXPLORER_CAT_MATERIAL = "MATERIAL";
  var PRODUCT_PATH_MARKERS = ["01 - PRODUKTY", "01 - PRODUCTS"];
  var MATERIAL_PATH_MARKERS = [
    "03 - MATERIAŁY",
    "03 - MATERIALY",
    "07 - E-COMMERCE",
    "05 - SOCIAL",
    "04 - DRUKOWANE"
  ];

  var state = {
    fileIndex:        null,
    statusStore:      null,
    lifecycleStore:   null,
    carrierOverrides: { overrides: {} },
    elementsLinks:    { links: {} },
    adminMode:        false,
    brands:           (window.DamBrandFilter ? window.DamBrandFilter.loadBrands() : { DK: true, GC: true }),
    canonCat:         null,
    product:          null,
    expandedCarriers: {},
    showOlderCarriers:{},
    showAllRevisions: localStorage.getItem(SHOW_ALL_KEY) === "1",
    langFilter:       localStorage.getItem(LANG_FILTER_KEY) || "",
    filter:           "",
    expandedTagGroups:{},
    vizViewMode:      localStorage.getItem(VIZ_VIEW_KEY) || "tiles",
    vizScale:         parseInt(localStorage.getItem(VIZ_SCALE_KEY) || "140", 10) || 140,
    vizBgFilter:      "z-tlem",
    navStack:         [],
    navPos:           -1,
    navSilent:        false,
    catMode:          localStorage.getItem(CAT_MODE_KEY) || EXPLORER_CAT_PRODUCT,
    searchQuery:      "",
    searchHits:       null,
    searchPanelTimer: null
  };

  function navSnapshot() {
    return {
      canonCat: state.canonCat || null,
      productId: state.product && state.product.id ? state.product.id : null
    };
  }

  function navSame(a, b) {
    return !!a && !!b && a.canonCat === b.canonCat && a.productId === b.productId;
  }

  function navPush() {
    if (state.navSilent) return;
    var snap = navSnapshot();
    if (!snap.canonCat && !snap.productId) return;
    var cur = state.navStack[state.navPos];
    if (navSame(cur, snap)) return;
    state.navStack = state.navStack.slice(0, state.navPos + 1);
    state.navStack.push(snap);
    state.navPos = state.navStack.length - 1;
  }

  function navApply(snap) {
    state.navSilent = true;
    state.canonCat = snap.canonCat || null;
    state.product = null;
    if (snap.productId && state.fileIndex) {
      state.product = (state.fileIndex.products || []).find(function (x) {
        return x.id === snap.productId;
      }) || null;
    }
    state.expandedCarriers = {};
    state.showOlderCarriers = {};
    renderAll();
    state.navSilent = false;
  }

  function navGo(delta) {
    var next = state.navPos + delta;
    if (next < 0 || next >= state.navStack.length) return;
    state.navPos = next;
    navApply(state.navStack[next]);
  }

  function panelCanStepUp() {
    return !!(state.product || state.canonCat || (state.searchQuery && state.searchHits));
  }

  /** Obetnij koniec stosu nawigacji do bieżącego snapshota (bez push - anty-pulapka Wstecz). */
  function navReplaceTip() {
    var snap = navSnapshot();
    if (!snap.canonCat && !snap.productId) {
      state.navStack = [];
      state.navPos = -1;
      return;
    }
    if (state.navPos >= 0) {
      state.navStack[state.navPos] = snap;
      state.navStack = state.navStack.slice(0, state.navPos + 1);
    } else {
      state.navStack = [snap];
      state.navPos = 0;
    }
  }

  /**
   * Wstecz panelu = krok w gore hierarchii (nie slepa historia).
   * Produkt → wyniki wyszukiwania / kategoria → clear search → welcome.
   * Historia (navGo) tylko dla Do przodu.
   */
  function panelStepUp() {
    state.expandedCarriers = {};
    state.showOlderCarriers = {};

    if (state.product) {
      state.product = null;
      /* Zdejmij wpisy produktu z konca stosu, zeby Wstecz nie wrocil do produktu */
      while (
        state.navPos >= 0 &&
        state.navStack[state.navPos] &&
        state.navStack[state.navPos].productId
      ) {
        state.navStack = state.navStack.slice(0, state.navPos);
        state.navPos -= 1;
      }
      navReplaceTip();
      renderAll();
      return;
    }

    if (state.searchQuery && state.searchHits) {
      clearSearchPanel();
      return;
    }

    if (state.canonCat) {
      state.canonCat = null;
      state.navStack = [];
      state.navPos = -1;
      renderAll();
      return;
    }
  }

  var EXPLORER_CTA_STYLE_ID = "damExplorerCtaUnify";

  function ensureExplorerCtaUnifyCss() {
    if (typeof document === "undefined") return;
    var css =
      "/* EXP-A: explorer toolbar + add CTAs = .dam-int-cta anatomy */" +
      ".dam-explorer-results__actions .dam-int-cta," +
      ".dam-explorer-results__actions #damStatusExport," +
      ".dam-explorer-results__actions #damIndexRefresh," +
      ".dam-explorer-results__actions #damLifecycleForce," +
      "#damExplorerAddCategory.dam-int-cta," +
      ".dam-panel-head .dam-explorer-add-product-btn.dam-int-cta," +
      ".dam-panel-head .dam-explorer-add-variant-btn.dam-int-cta," +
      "#damExplorerAddVariantHead.dam-int-cta{" +
      "display:inline-flex!important;align-items:center;justify-content:center;gap:6px;" +
      "min-height:34px!important;height:34px!important;padding:8px 12px!important;margin:0;" +
      "box-sizing:border-box;" +
      "font-family:inherit;font-size:12px!important;font-weight:500!important;line-height:1.2;" +
      "border-radius:8px!important;border:1px solid #e7e7e7!important;" +
      "background:#fff!important;color:#464255!important;" +
      "text-decoration:none;cursor:pointer;box-shadow:none!important;" +
      "-webkit-appearance:none;appearance:none;white-space:nowrap;" +
      "transition:background .15s ease,border-color .15s ease,color .15s ease}" +
      ".dam-explorer-results__actions .dam-int-cta:hover," +
      ".dam-explorer-results__actions #damStatusExport:hover," +
      ".dam-explorer-results__actions #damIndexRefresh:hover," +
      ".dam-explorer-results__actions #damLifecycleForce:hover," +
      "#damExplorerAddCategory.dam-int-cta:hover," +
      ".dam-panel-head .dam-explorer-add-product-btn.dam-int-cta:hover," +
      ".dam-panel-head .dam-explorer-add-variant-btn.dam-int-cta:hover," +
      "#damExplorerAddVariantHead.dam-int-cta:hover{" +
      "border-color:var(--dam-primary,#ab54db)!important;background:#fbf7fe!important;" +
      "color:var(--dam-primary,#ab54db)!important}" +
      ".dam-explorer-results__actions .dam-int-cta:focus-visible," +
      "#damExplorerAddCategory.dam-int-cta:focus-visible," +
      ".dam-panel-head .dam-explorer-add-product-btn.dam-int-cta:focus-visible," +
      ".dam-panel-head .dam-explorer-add-variant-btn.dam-int-cta:focus-visible," +
      "#damExplorerAddVariantHead.dam-int-cta:focus-visible{" +
      "outline:2px solid color-mix(in srgb,var(--dam-primary,#ab54db) 55%,transparent);" +
      "outline-offset:2px}" +
      "#damExplorerAddCategory.dam-int-cta--icon{" +
      "min-width:34px!important;width:34px!important;padding:0!important;flex:0 0 34px}" +
      "#damExplorerAddCategory.dam-int-cta--icon i," +
      ".dam-panel-head .dam-explorer-add-product-btn.dam-int-cta i," +
      ".dam-panel-head .dam-explorer-add-variant-btn.dam-int-cta i," +
      "#damExplorerAddVariantHead.dam-int-cta i{" +
      "font-size:16px;line-height:1}" +
      "#damLifecycleForce.dam-int-cta{gap:6px}" +
      "#damLifecycleForce.dam-int-cta .dam-force-btn__label{font-size:12px!important;font-weight:500!important}" +
      "#damLifecycleForce.dam-int-cta i{font-size:16px;line-height:1}" +
      ".dam-panel-head__top{" +
      "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}" +
      ".dam-panel-head__actions{display:inline-flex;align-items:center;gap:8px;margin-left:auto}" +
      /* Confirm dialogs FORCE: before/after rows - never place unary + after a bare comment */ 
      "#damExplorerConfirmModal.dam-basepath-overlay{z-index:12200;padding:20px}" +
      "#damExplorerConfirmModal .dam-basepath-box.dam-explorer-confirm-modal," +
      "#damExplorerConfirmModal .dam-explorer-confirm-modal{" +
      "width:min(70vw,1200px)!important;height:min(90vh,900px)!important;max-width:none!important;" +
      "max-height:min(90vh,900px)!important;" +
      "display:flex!important;flex-direction:column;padding:0!important;overflow:hidden!important;" +
      "box-sizing:border-box}" +
      "#damExplorerConfirmModal .dam-explorer-confirm-modal__header{" +
      "flex:0 0 auto;padding:22px 28px 16px;border-bottom:1px solid #ebe6f0}" +
      "#damExplorerConfirmModal .dam-explorer-confirm-modal__header h3{" +
      "margin:0 36px 10px 0;font-size:18px;font-weight:700;color:#1f1f2e;line-height:1.3}" +
      "#damExplorerConfirmModal .dam-confirm-lead{" +
      "margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b6578}" +
      "#damExplorerConfirmModal .dam-confirm-meta{" +
      "margin:0;font-size:12px;line-height:1.45;color:#464255}" +
      "#damExplorerConfirmModal .dam-explorer-confirm-modal__body{" +
      "flex:1 1 auto;min-height:0;overflow:auto;padding:24px 28px}" +
      "#damExplorerConfirmModal .dam-explorer-confirm-modal__footer{" +
      "flex:0 0 auto;padding:16px 28px 20px;border-top:1px solid #ebe6f0;" +
      "display:flex;flex-direction:column;gap:12px;background:#faf9fb}" +
      "#damExplorerConfirmModal .dam-confirm-warn{" +
      "margin:0;font-size:12px;line-height:1.45;color:#b45309}" +
      "#damExplorerConfirmModal .dam-basepath-actions{" +
      "display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap;margin:0}" +
      "#damExplorerConfirmModal .dam-basepath-actions .dam-int-cta," +
      "#damExplorerConfirmModal .dam-basepath-actions .geex-btn{" +
      "display:inline-flex!important;align-items:center;justify-content:center;gap:6px;" +
      "min-height:34px!important;height:34px!important;max-height:36px;" +
      "padding:8px 14px!important;margin:0;box-sizing:border-box;" +
      "font-family:inherit;font-size:12px!important;font-weight:500!important;line-height:1.2;" +
      "border-radius:8px!important;width:auto!important;flex:0 0 auto;" +
      "box-shadow:none!important;white-space:nowrap;cursor:pointer}" +
      "#damExplorerConfirmModal .dam-basepath-actions .dam-int-cta--cancel{" +
      "background:#fff!important;border:1px solid #e7e7e7!important;color:#464255!important}" +
      "#damExplorerConfirmModal .dam-basepath-actions .dam-int-cta--cancel:hover{" +
      "border-color:var(--dam-primary,#ab54db)!important;background:#fbf7fe!important;" +
      "color:var(--dam-primary,#ab54db)!important}" +
      "#damExplorerConfirmModal .dam-basepath-actions .geex-btn--danger," +
      "#damExplorerConfirmModal .dam-basepath-actions .dam-int-cta--danger{" +
      "background:#dc2626!important;border:1px solid #dc2626!important;color:#fff!important}" +
      "#damExplorerConfirmModal .dam-basepath-actions .geex-btn--danger:hover," +
      "#damExplorerConfirmModal .dam-basepath-actions .dam-int-cta--danger:hover{" +
      "background:#b91c1c!important;border-color:#b91c1c!important;color:#fff!important}" +
      "#damExplorerConfirmModal .dam-basepath-actions .geex-btn--primary{" +
      "background:var(--dam-primary,#ab54db)!important;border:1px solid var(--dam-primary,#ab54db)!important;" +
      "color:#fff!important}" +
      "#damExplorerConfirmModal .dam-force-preview{display:flex;flex-direction:column;gap:20px;margin:0}" +
      "#damExplorerConfirmModal .dam-force-preview__head{" +
      "display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;" +
      "margin:0;padding:0 0 16px;position:sticky;top:0;z-index:2;background:#fff;" +
      "border-bottom:1px solid #f0ecf4}" +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-force-preview__head{background:var(--dam-surface,#1e1e28);border-color:rgba(255,255,255,.08)}" +
      "#damExplorerConfirmModal .dam-force-preview__count{" +
      "font-size:15px;font-weight:700;color:#464255;letter-spacing:-0.01em}" +
      "#damExplorerConfirmModal .dam-force-preview__chips{display:inline-flex;flex-wrap:wrap;gap:8px}" +
      "#damExplorerConfirmModal .dam-force-chip{" +
      "appearance:none;border:1px solid #e2dde8;background:#fff;color:#6b6578;" +
      "border-radius:999px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;line-height:1.2}" +
      "#damExplorerConfirmModal .dam-force-chip:hover{border-color:#cbb8e0;color:#464255}" +
      "#damExplorerConfirmModal .dam-force-chip.is-on{" +
      "border-color:var(--dam-primary,#ab54db);background:#f7f0fc;color:var(--dam-primary,#ab54db)}" +
      "#damExplorerConfirmModal .dam-force-preview__list{" +
      "display:flex;flex-direction:column;gap:20px;margin:0;padding:0;list-style:none}" +
      "#damExplorerConfirmModal .dam-force-preview__empty{" +
      "margin:8px 0 0;padding:20px 18px;border:1px dashed #e2dde8;border-radius:10px;" +
      "font-size:13px;line-height:1.45;color:#8b8d97;text-align:center;background:#faf9fb}" +
      "#damExplorerConfirmModal .dam-force-preview__empty[hidden]{display:none!important}" +
      "#damExplorerConfirmModal .dam-force-row{" +
      "display:flex;flex-direction:column;gap:12px;padding:16px 18px;" +
      "border:1px solid #ebe6f0;border-radius:12px;background:#fff;min-width:0}" +
      "#damExplorerConfirmModal .dam-force-row[hidden]{display:none!important}" +
      "#damExplorerConfirmModal .dam-force-row__head{" +
      "display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}" +
      "#damExplorerConfirmModal .dam-force-row__title{" +
      "margin:0;font-size:14px;font-weight:600;line-height:1.35;color:#464255;min-width:0;flex:1 1 200px}" +
      "#damExplorerConfirmModal .dam-force-row__meta{" +
      "display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
      "#damExplorerConfirmModal .dam-force-row__scope{" +
      "font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#8b8d97}" +
      "#damExplorerConfirmModal .dam-force-row__kind{" +
      "display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;" +
      "color:#6b6578;padding:2px 8px;border-radius:6px;background:#f4f1f7}" +
      "#damExplorerConfirmModal .dam-force-row__kind--archive{background:rgba(255,86,83,.1);color:#D63B38}" +
      "#damExplorerConfirmModal .dam-force-row__kind--clear{background:rgba(70,66,85,.08);color:#6b6980}" +
      "#damExplorerConfirmModal .dam-force-row__kind--rename{background:rgba(40,199,111,.12);color:#1E9E5A}" +
      "#damExplorerConfirmModal .dam-force-diff{" +
      "display:flex;align-items:stretch;gap:14px;min-width:0}" +
      "@media (max-width:768px){" +
      "#damExplorerConfirmModal .dam-force-diff{flex-direction:column;align-items:stretch}" +
      "#damExplorerConfirmModal .dam-force-diff__arrow{padding:0;transform:rotate(90deg);align-self:center}" +
      "}" +
      "#damExplorerConfirmModal .dam-force-diff__arrow{" +
      "flex:0 0 auto;display:flex;align-items:center;justify-content:center;" +
      "min-width:28px;color:#8b8d97;font-size:22px;line-height:1;user-select:none}" +
      "#damExplorerConfirmModal .dam-force-block{" +
      "display:flex;flex-direction:column;gap:8px;padding:16px 18px;min-width:0;flex:1 1 0;" +
      "border:1px solid #e8e4ee;border-radius:10px;background:#faf9fb;box-shadow:none}" +
      "#damExplorerConfirmModal .dam-force-block--to{" +
      "border-color:#e2dde8;background:#f7f5fa}" +
      "#damExplorerConfirmModal .dam-force-block--to.dam-force-block--archive{" +
      "border-color:#eddada;background:#fbf7f7}" +
      "#damExplorerConfirmModal .dam-force-block--to.dam-force-block--clear{" +
      "border-color:#e0dde6;background:#f7f7f9}" +
      "#damExplorerConfirmModal .dam-force-block__label{" +
      "font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;" +
      "color:#8b8d97;line-height:1.2}" +
      "#damExplorerConfirmModal .dam-force-block--to .dam-force-block__label{color:#6b6578}" +
      "#damExplorerConfirmModal .dam-force-block--to.dam-force-block--archive .dam-force-block__label{color:#8b6b6b}" +
      "#damExplorerConfirmModal .dam-force-block--to.dam-force-block--clear .dam-force-block__label{color:#6b6980}" +

      "#damExplorerConfirmModal .dam-force-block__name{" +
      "font-size:13px;font-weight:600;line-height:1.45;color:#464255;word-break:break-word}" +
      "#damExplorerConfirmModal .dam-force-block--from .dam-force-block__name{font-weight:500;color:#6b6578}" +
      "#damExplorerConfirmModal .dam-force-block__badge-row{" +
      "display:flex;flex-wrap:wrap;gap:6px;align-items:center}" +
      "#damExplorerConfirmModal .dam-force-block__path-btn{" +
      "appearance:none;border:0;background:transparent;padding:0;margin:0;" +
      "font-size:11px;font-weight:600;color:#8b8d97;cursor:pointer;text-align:left;" +
      "display:inline-flex;align-items:center;gap:4px}" +
      "#damExplorerConfirmModal .dam-force-block__path-btn:hover{color:var(--dam-primary,#ab54db)}" +
      "#damExplorerConfirmModal .dam-force-block__path{" +
      "margin:0;font-size:11px;line-height:1.4;color:#8a8494;word-break:break-all;" +
      "background:#fff;border:1px solid #ebe6f0;border-radius:6px;padding:8px 10px}" +
      "#damExplorerConfirmModal .dam-force-block__path[hidden]{display:none!important}" +
      "#damExplorerConfirmModal .dam-force-skel{display:flex;flex-direction:column;gap:16px}" +
      "#damExplorerConfirmModal .dam-force-skel__row{" +
      "height:88px;border-radius:12px;border:1px solid #ebe6f0;background:linear-gradient(90deg,#f4f2f7 25%,#ebe7f1 37%,#f4f2f7 63%);" +
      "background-size:400% 100%;animation:damForceSkel 1.2s ease-in-out infinite}" +
      "@keyframes damForceSkel{0%{background-position:100% 0}100%{background-position:0 0}}" +
      "#damExplorerConfirmModal .dam-confirm-info-tile{" +
      "display:flex;gap:12px;align-items:flex-start;padding:16px 18px;" +
      "border:1px solid #ebe6f0;border-radius:12px;background:#faf9fb;margin:0}" +
      "#damExplorerConfirmModal .dam-confirm-info-tile i{font-size:18px;color:var(--dam-primary,#ab54db);margin-top:1px}" +
      "#damExplorerConfirmModal .dam-confirm-info-tile p{margin:0;font-size:13px;line-height:1.5;color:#464255}" +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-explorer-confirm-modal{" +
      "background:var(--dam-surface,#1e1e28);color:#e8e6ef}" +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-explorer-confirm-modal__header," +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-explorer-confirm-modal__footer," +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-force-preview__head{" +
      "border-color:rgba(255,255,255,.08);background:#1a1a24}" +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-force-row{" +
      "background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1)}" +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-force-block{" +
      "background:rgba(0,0,0,.25);border-color:rgba(255,255,255,.12)}" +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-force-block--to{background:rgba(255,255,255,.06)}" +

      "html[data-theme=dark] #damExplorerConfirmModal .dam-force-row__title," +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-force-block__name," +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-force-preview__count," +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-explorer-confirm-modal__header h3{color:#e8e6ef}" +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-confirm-lead," +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-force-block--from .dam-force-block__name{color:#a8a4b4}" +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-force-chip{" +
      "background:transparent;border-color:rgba(255,255,255,.18);color:#c4c0ce}" +
      "html[data-theme=dark] #damExplorerConfirmModal .dam-basepath-actions .dam-int-cta--cancel{" +
      "background:transparent!important;border-color:rgba(255,255,255,.22)!important;color:#e8e6ef!important}";
    var style = document.getElementById(EXPLORER_CTA_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = EXPLORER_CTA_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function panelHeadHtml(opts) {
    opts = opts || {};
    var canBack = state.navPos > 0 || panelCanStepUp();
    var canFwd = state.navPos >= 0 && state.navPos < state.navStack.length - 1;
    var icon = opts.icon || "uil-folder";
    var kicker = opts.kicker || "Kategoria";
    var title = opts.title || "";
    var meta = opts.meta || "";
    var headActionsHtml = "";
    if (opts.showAddProduct) {
      var catId = (opts.categoryContext && opts.categoryContext.id) || state.canonCat || "";
      var catTitle =
        (opts.categoryContext && opts.categoryContext.title) || title || "";
      headActionsHtml =
        '<div class="dam-panel-head__actions">' +
          '<button type="button" class="dam-int-cta dam-explorer-add-product-btn" data-dam-add-product="1"' +
            ' data-canon-cat="' + esc(catId) + '"' +
            ' data-cat-title="' + esc(catTitle) + '"' +
            ' aria-label="Dodaj produkt" title="Dodaj produkt" data-dam-tip="Dodaj produkt do tej kategorii">' +
            '<i class="uil uil-plus" aria-hidden="true"></i>' +
            "<span>Dodaj produkt</span>" +
          "</button>" +
        "</div>";
    } else if (opts.showAddVariant) {
      headActionsHtml =
        '<div class="dam-panel-head__actions">' +
          '<button type="button" class="dam-int-cta dam-explorer-add-variant-btn" id="damExplorerAddVariantHead"' +
            ' aria-label="Dodaj wariant" title="Dodaj wariant" data-dam-tip="Utworz wariant ze Szablonow w tym produkcie">' +
            '<i class="uil uil-plus" aria-hidden="true"></i>' +
            "<span>Dodaj wariant</span>" +
          "</button>" +
        "</div>";
    }
    return (
      '<div class="dam-panel-head">' +
        '<div class="dam-panel-head__top">' +
          '<div class="dam-panel-head__nav" role="group" aria-label="Nawigacja panelu">' +
            '<button type="button" class="dam-panel-nav-btn" data-panel-nav="-1"' +
              (canBack ? "" : " disabled") +
              ' aria-label="Wstecz" data-dam-tip="Wstecz">' +
              '<i class="uil uil-arrow-left" aria-hidden="true"></i></button>' +
            '<button type="button" class="dam-panel-nav-btn" data-panel-nav="1"' +
              (canFwd ? "" : " disabled") +
              ' aria-label="Do przodu" data-dam-tip="Do przodu">' +
              '<i class="uil uil-arrow-right" aria-hidden="true"></i></button>' +
          "</div>" +
          headActionsHtml +
        "</div>" +
        '<div class="dam-panel-head__place">' +
          '<span class="dam-panel-head__icon" aria-hidden="true">' +
            '<i class="uil ' + esc(icon) + '"></i></span>' +
          '<div class="dam-panel-head__text">' +
            '<div class="dam-panel-head__kicker">' + esc(kicker) + "</div>" +
            '<h5 class="dam-explorer-panel__title">' + esc(title) + "</h5>" +
            (meta ? '<p class="dam-panel-head__meta">' + esc(meta) + "</p>" : "") +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function openExplorerAddProduct(opts) {
    var api = window.DamExplorerAddProduct;
    if (api && typeof api.open === "function") {
      try {
        api.open(opts || {});
      } catch (eOpen) {
        showToast(
          "Nie udało się otworzyć Dodaj produkt: " + String((eOpen && eOpen.message) || eOpen),
          "error"
        );
      }
      return;
    }
    showToast("Moduł tworzenia produktu niedostępny - odśwież stronę (Ctrl+F5).");
    console.warn("[DamExplorer] DamExplorerAddProduct not loaded yet", opts || {});
  }

  function bindAddProductCtas(root) {
    (root || document).querySelectorAll("[data-dam-add-product]").forEach(function (btn) {
      if (btn._damAddBound) return;
      btn._damAddBound = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openExplorerAddProduct({
          mode: "product",
          categoryContext: {
            id: btn.getAttribute("data-canon-cat") || state.canonCat || "",
            title: btn.getAttribute("data-cat-title") || ""
          }
        });
      });
    });
  }

  function bindCategoryAddButton() {
    var btn = document.getElementById("damExplorerAddCategory");
    if (!btn || btn._damAddCatBound) return;
    btn._damAddCatBound = true;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openExplorerAddProduct({ mode: "category" });
    });
  }

  function bindPanelNav(root) {
    (root || document).querySelectorAll("[data-panel-nav]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;
        var dir = parseInt(btn.getAttribute("data-panel-nav"), 10) || 0;
        if (dir < 0) {
          /* Hierarchia ma pierwszenstwo - historia cofala do produktu (pulapka) */
          if (panelCanStepUp()) panelStepUp();
          else if (state.navPos > 0) navGo(-1);
          return;
        }
        if (state.navPos >= 0 && state.navPos < state.navStack.length - 1) navGo(dir);
      });
    });
    bindAddProductCtas(root);
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                              */
  /* ------------------------------------------------------------------ */

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n > 1048576) return (n / 1048576).toFixed(1) + " MB";
    if (n > 1024)    return (n / 1024).toFixed(1) + " KB";
    return n + " B";
  }

  function fmtDate(s) {
    if (!s) return "";
    var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + "." + m[2] + "." + m[1];
    return String(s).slice(0, 10);
  }

  function getProductBrand(p) {
    if (p.brand) return p.brand;
    var rk = String(p.root_key || "");
    if (rk.indexOf("GC") >= 0 || rk.indexOf("EKSPORT") >= 0) return "GC";
    return "DK";
  }

  function isBrandEnabled(p) {
    return !!state.brands[getProductBrand(p)];
  }

  function fileExt(name) {
    return (String(name || "").split(".").pop() || "").toLowerCase();
  }

  function fileIcon(ext) {
    ext = (ext || "").toLowerCase();
    if (ext === "ai")  return "uil uil-vector-square";
    if (ext === "psd" || ext === "indd") return "uil uil-layer-group";
    if (ext === "pdf") return "uil uil-file-alt";
    if (ext === "zip" || ext === "rar" || ext === "7z") return "uil uil-archive";
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp" || ext === "tif" || ext === "tiff") return "uil uil-image";
    return "uil uil-file";
  }

  /** ZIP/RAR nigdy nie sa wizualizacja - tylko obrazy w studio / galerii. */
  function isVizImageFile(f) {
    if (DL && typeof DL.isVizImage === "function") return DL.isVizImage(f);
    var e = fileExt((f && f.name) || "");
    return ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"].indexOf(e) >= 0;
  }

  function isArchiveFile(f) {
    if (DL && typeof DL.isArchive === "function") return DL.isArchive(f);
    var e = fileExt((f && f.name) || "");
    return e === "zip" || e === "rar" || e === "7z";
  }

  function filterVizImageFiles(files) {
    return (files || []).filter(isVizImageFile);
  }

  /** Archiwa z slotu viz (blednie) traktuj jak druk - zwykle Pakiet.zip. */
  function printFilesFromRevision(rev) {
    var fbr = (rev && rev.files_by_role) || {};
    var prt = (fbr.print || []).slice();
    var misplaced = []
      .concat(fbr.viz || [])
      .concat((rev && rev.wizki) || [])
      .filter(isArchiveFile);
    misplaced.forEach(function (f) {
      if (!prt.some(function (p) { return p.path === f.path; })) prt.push(f);
    });
    return prt;
  }

  /* ------------------------------------------------------------------ */
  /* Status store                                                         */
  /* ------------------------------------------------------------------ */

  function loadLocalStatus() {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY) || "{}"); }
    catch (e) { return {}; }
  }

  function saveLocalStatus(data) {
    localStorage.setItem(STATUS_KEY, JSON.stringify(data));
  }

  function mergeStatusStore(fileDefaults) {
    var merged = {
      updated_at: (fileDefaults && fileDefaults.updated_at) || new Date().toISOString(),
      revisions: Object.assign({}, (fileDefaults && fileDefaults.revisions) || {}),
      products: Object.assign({}, (fileDefaults && fileDefaults.products) || {})
    };
    var local = loadLocalStatus();
    if (local.revisions) {
      Object.keys(local.revisions).forEach(function (k) {
        merged.revisions[k] = local.revisions[k];
      });
    }
    if (local.products) {
      Object.keys(local.products).forEach(function (k) {
        merged.products[k] = local.products[k];
      });
    }
    if (local.updated_at) merged.updated_at = local.updated_at;
    return merged;
  }

  function revisionStatusKey(rev) {
    var pk = normPathKey(rev && rev.path);
    if (pk) return pk;
    return rev ? (rev.index || rev.folder || "") : "";
  }

  /** Wiersz lifecycle dla wariantu - po sciezce (index moze byc wspólny: DOY + ETY). */
  function lifecycleRowForRev(rev) {
    if (!rev) return null;
    var store = state.lifecycleStore && state.lifecycleStore.revisions;
    if (!store) return null;
    var pk = normPathKey(rev.path || "");
    if (pk && store[pk]) return store[pk];
    if (pk) {
      var keys = Object.keys(store);
      for (var i = 0; i < keys.length; i++) {
        var row = store[keys[i]];
        if (row && normPathKey(row.path) === pk) return row;
      }
    }
    return null;
  }

  /** Status z localStorage / statusStore - tylko gdy pasuje ścieżka wariantu. */
  function statusRowForRev(rev) {
    if (!rev) return null;
    var store = state.statusStore && state.statusStore.revisions;
    if (!store) return null;
    var pk = normPathKey(rev.path || "");
    if (pk && store[pk]) return store[pk];
    if (pk) {
      var keys = Object.keys(store);
      for (var j = 0; j < keys.length; j++) {
        var row = store[keys[j]];
        if (row && normPathKey(row.path) === pk) return row;
      }
    }
    return null;
  }

  function letterFromFolderName(pathOrName) {
    var nm = String(pathOrName || "").split(/[/\\]/).pop() || "";
    var m = nm.match(/\s-\s([FXD])$/i);
    return m ? m[1].toUpperCase() : "";
  }

  function statusFromLetter(lit) {
    if (lit === "F") return "aktualne";
    if (lit === "X") return "nieaktualne";
    if (lit === "D") return "demo";
    return "clear";
  }

  function getRevisionStatus(rev) {
    if (!rev) return "starsza";
    /* DYSK (nazwa folderu w indeksie) = prawda. Brak literki = clear / Bez statusu.
       NIGDY: is_latest → aktualne (to mylilo F z "bez statusu").
       NIGDY: lookup po samym index (TEST-TEST2 moze byc DOY live + ETY w archiwum).
       Gdy jest rev.path - tylko basename ścieżki (folder w indeksie moze byc nieaktualny). */
    var diskLit = letterFromFolderName(rev.path || "");
    if (!diskLit && !rev.path && rev.folder) diskLit = letterFromFolderName(rev.folder);
    if (diskLit) return statusFromLetter(diskLit);
    if (rev.path || rev.folder) return "clear";

    var lrow = lifecycleRowForRev(rev);
    if (lrow && Object.prototype.hasOwnProperty.call(lrow, "status")) {
      if (lrow.status === "clear" || !lrow.status) return "clear";
      if (lrow.status === "aktualne" || lrow.status === "nieaktualne" || lrow.status === "demo") {
        return lrow.status;
      }
    }
    var ov = overrideForRev(rev);
    if (ov && ov.status && ov.status !== "clear" && ov.status !== "starsza") return ov.status;
    var srow = statusRowForRev(rev);
    if (srow) {
      var st = srow.status;
      if (st === "clear") return "clear";
      if (st && st !== "starsza") return st;
    }
    if (rev && rev.is_latest) return "clear";
    return "starsza";
  }

  /** Aktualna ścieżka dyskowa z lifecycle-store (po rename/archiwum), nie z przeterminowanego indeksu. */
  function resolveLifecycleDiskPath(opts) {
    opts = opts || {};
    var idx = opts.index || "";
    var path = opts.path || "";
    var productId = opts.productId || "";
    if (path) return path;
    var store = state.lifecycleStore;
    if (store && store.revisions) {
      var pk = normPathKey(path);
      if (pk && store.revisions[pk] && store.revisions[pk].path) {
        return store.revisions[pk].path;
      }
      var keys = Object.keys(store.revisions);
      for (var i = 0; i < keys.length; i++) {
        var row = store.revisions[keys[i]];
        if (!row || !row.path) continue;
        if (pk && normPathKey(row.path) === pk) return row.path;
        if (productId && row.product_id === productId && idx && normPathKey(row.path).indexOf(idx) !== -1) {
          return row.path;
        }
      }
    }
    if (store && store.products && productId && opts.scope === "product") {
      var prow = store.products[productId];
      if (prow && prow.path) return prow.path;
    }
    return path;
  }

  function normVariantBasename(pathOrName) {
    var leaf = String(pathOrName || "").split(/[/\\]/).pop() || "";
    return leaf.replace(/\s-\s[FXD]$/i, "").toLowerCase();
  }

  function patchPathsAfterLifecycle(res, body) {
    if (!res || !res.ok) return;
    if (!state.lifecycleStore) state.lifecycleStore = { products: {}, revisions: {}, history: [] };
    if (!state.lifecycleStore.revisions) state.lifecycleStore.revisions = {};
    if (!state.lifecycleStore.products) state.lifecycleStore.products = {};
    if (body.scope === "variant") {
      var vpath = res.final_variant_path || res.resolved_path || body.path;
      var idx = body.revision_index || "";
      if (idx) {
        state.lifecycleStore.revisions[idx] = Object.assign({}, state.lifecycleStore.revisions[idx] || {}, {
          path: vpath,
          previous_path: body.path,
          status: res.status || "clear",
          letter: res.letter || null,
          product_id: body.product_id || ""
        });
      }
      if (vpath) {
        state.lifecycleStore.revisions[vpath] = state.lifecycleStore.revisions[idx] || {
          path: vpath,
          status: res.status || "clear",
          letter: res.letter || null
        };
      }
      var revs = (state.product && state.product.revisions) || [];
      revs.forEach(function (r) {
        if (!r) return;
        if ((idx && r.index === idx) || (body.path && normPathKey(r.path || "") === normPathKey(body.path))) {
          r.path = vpath;
        }
      });
    } else {
      var ppath = res.final_product_path || res.resolved_path || body.path;
      if (body.product_id) {
        state.lifecycleStore.products[body.product_id] = Object.assign(
          {},
          state.lifecycleStore.products[body.product_id] || {},
          {
            path: ppath,
            previous_path: body.path,
            status: res.status || "clear",
            letter: res.letter || null
          }
        );
      }
      if (state.product && (state.product.id === body.product_id || normPathKey(state.product.path || "") === normPathKey(body.path))) {
        state.product.path = ppath;
      }
      var cascade = res.cascade_meta || res.cascaded_variants_meta || [];
      if (cascade.length && state.product && state.product.revisions) {
        cascade.forEach(function (m) {
          if (!m || !m.to) return;
          var toKey = normPathKey(m.to);
          state.product.revisions.forEach(function (r) {
            if (!r) return;
            var pathMatch = normPathKey(r.path || "") === normPathKey(m.from || "");
            var baseMatch = normVariantBasename(r.path || r.folder) === normVariantBasename(m.from || m.to);
            if (pathMatch || baseMatch) {
              r.path = m.to;
              if (m.to) {
                var base = String(m.to).split(/[/\\]/).pop();
                if (base) r.folder = base;
              }
              r.in_archive = pathLooksLikeCategoryArchive(m.to);
            }
          });
          var st = statusFromLetter(m.new_letter || "");
          var row = {
            path: m.to,
            previous_path: m.from || "",
            status: st,
            letter: m.new_letter || null,
            product_id: body.product_id || "",
            synced_from_disk: true,
            source: "cascade"
          };
          state.lifecycleStore.revisions[toKey] = Object.assign(
            {},
            state.lifecycleStore.revisions[toKey] || {},
            row
          );
          if (m.from) {
            delete state.lifecycleStore.revisions[normPathKey(m.from)];
          }
        });
      }
    }
  }

  function findRevisionByRef(path, index) {
    var revs = (state.product && state.product.revisions) || [];
    var pathKey = path ? normPathKey(path) : "";
    if (pathKey) {
      for (var i = 0; i < revs.length; i++) {
        if (normPathKey(revs[i].path || "") === pathKey) return revs[i];
      }
    }
    if (index) {
      for (var j = 0; j < revs.length; j++) {
        if (revs[j].index === index) return revs[j];
      }
    }
    return null;
  }

  function setRevisionStatus(rev, status) {
    if (!rev || !status) return;
    var product = state.product;
    applyLifecycleStatus({
      scope: "variant",
      status: status,
      path: rev.path || "",
      productPath: (product && product.path) || "",
      productId: (product && product.id) || "",
      index: rev.index || ""
    }).then(function (res) {
      if (!res || !res.ok) return;
      /* Dodatkowo mirror w carrier-overrides (UI filtry) */
      var ov = overrideForRev(rev) || {};
      var entry = Object.assign({}, ov, {
        status: status === "clear" ? "clear" : status,
        carrier: ov.carrier || resolveCarrierCode(rev) || "",
        note: ov.note || ("Lifecycle: " + status)
      });
      var pathKey = (res.final_variant_path || rev.path || rev.index || "");
      saveCarrierOverride(pathKey, entry);
    });
  }

  function setProductLifecycleStatus(product, status) {
    if (!product) return;
    applyLifecycleStatus({
      scope: "product",
      status: status,
      path: product.path || "",
      productPath: product.path || "",
      productId: product.id || ""
    });
  }

  /** Strict: tylko status=aktualne (bez fallbacku is_latest). */
  function getAktualneRevisions(revisions) {
    return (revisions || []).filter(function (r) {
      return getRevisionStatus(r) === "aktualne";
    });
  }

  function revisionsForProductView(product, showAll) {
    var revs = (product && product.revisions) || [];
    if (!showAll) {
      revs = revs.filter(function (r) { return !r.in_archive; });
    }
    if (state.langFilter) {
      revs = revs.filter(function (r) { return revisionMatchesLang(r, state.langFilter); });
    }
    return revs;
  }

  function productHasLivePresence(p) {
    if (!p) return false;
    var revs = p.revisions || [];
    if (revs.some(function (r) { return !r.in_archive; })) return true;
    var path = String(p.path || "");
    if (path && path.toUpperCase().indexOf("ARCHIWUM") === -1) return true;
    return revs.length === 0;
  }

  function revisionMatchesLang(rev, lang) {
    if (!lang || !rev) return true;
    var code = String(lang).toLowerCase();
    if ((rev.langs || []).some(function (l) { return String(l).toLowerCase() === code; })) return true;
    return (rev.files || []).some(function (f) {
      return f && String(f.lang || "").toLowerCase() === code;
    });
  }

  function productMatchesLang(p, lang) {
    if (!lang || !p) return true;
    return (p.revisions || []).some(function (r) { return revisionMatchesLang(r, lang); });
  }

  function filterProductsForExplorerView(products) {
    return (products || []).filter(function (p) {
      if (!isBrandEnabled(p)) return false;
      if (!state.showAllRevisions && !productHasLivePresence(p)) return false;
      if (state.langFilter && !productMatchesLang(p, state.langFilter)) return false;
      return true;
    });
  }

  function filterSearchResponse(res) {
    if (!res) return res;
    if (state.showAllRevisions && !state.langFilter) {
      return Object.assign({}, res, {
        products: (res.products || []).filter(function (p) {
          return p && p.id && productInFileIndex(p.id);
        }),
        hits: (res.hits || []).filter(function (h) {
          return h && h.product && h.product.id && productInFileIndex(h.product.id);
        })
      });
    }
    var products = filterProductsForExplorerView(res.products || []).filter(function (p) {
      return p && p.id && productInFileIndex(p.id);
    });
    var ids = {};
    products.forEach(function (p) { if (p && p.id) ids[p.id] = true; });
    var hits = (res.hits || []).filter(function (h) {
      if (!h || !h.product || !ids[h.product.id]) return false;
      if (state.langFilter && h.revision && !revisionMatchesLang(h.revision, state.langFilter)) return false;
      if (!state.showAllRevisions && h.revision && h.revision.in_archive) return false;
      return true;
    });
    if (!state.showAllRevisions) {
      products = products.filter(function (p) {
        if (productHasLivePresence(p)) return true;
        return hits.some(function (h) { return h.product && h.product.id === p.id; });
      });
    }
    return Object.assign({}, res, { products: products, hits: hits });
  }

  function populateExplorerLangFilter() {
    var sel = document.getElementById("damExplorerLangFilter");
    if (!sel || !state.fileIndex) return;
    var codes = {};
    (state.fileIndex.products || []).forEach(function (p) {
      (p.revisions || []).forEach(function (r) {
        (r.langs || []).forEach(function (l) {
          if (l) codes[String(l).toLowerCase()] = true;
        });
        (r.files || []).forEach(function (f) {
          if (f && f.lang) codes[String(f.lang).toLowerCase()] = true;
        });
      });
    });
    var sorted = Object.keys(codes).sort(function (a, b) {
      var la = DL && DL.langLabel ? DL.langLabel(a) : a;
      var lb = DL && DL.langLabel ? DL.langLabel(b) : b;
      return String(la).localeCompare(String(lb), "pl");
    });
    var html = '<option value="">Wszystkie języki</option>';
    sorted.forEach(function (code) {
      var label = DL && DL.langLabel ? DL.langLabel(code) : code;
      html += '<option value="' + esc(code) + '">' + esc(label) + "</option>";
    });
    var prev = state.langFilter || sel.value || "";
    sel.innerHTML = html;
    if (prev && codes[prev]) sel.value = prev;
    else sel.value = "";
  }

  function syncExplorerShowAllUi() {
    var showAllEl = document.getElementById("damExplorerShowAll");
    if (!showAllEl) return;
    showAllEl.checked = !!state.showAllRevisions;
    var wrap = showAllEl.closest(".dam-switch");
    if (wrap) wrap.classList.toggle("is-off", !state.showAllRevisions);
  }

  /** Nazwa pliku / folderu ze szkicami (nie jest "prawdziwym" projektem). */
  function isSzkiceName(name) {
    return /szkice/i.test(String(name || ""));
  }

  /** Slot 2 - PROJEKT / PROJEKTY / PROJECT (case-insensitive). */
  function isProjektSlot(slot, pathOrRel) {
    var s = String(slot || "").toLowerCase();
    if (/^2\s*-\s*(projekty|projekt|projects|project)\b/.test(s)) return true;
    var p = String(pathOrRel || "").replace(/\\/g, "/").toLowerCase();
    return /\/2\s*-\s*(projekty|projekt|projects|project)(\/|$)/.test(p);
  }

  /**
   * Lista zrodel w karcie nośnika:
   * OFF (Pokaż wszystkie): tylko 2 - PROJEKT bez SZKICE.
   * ON: pełna lista (archiwum / szkice) jak w indeksie.
   */
  function filterSourceFilesForView(files) {
    var list = files || [];
    if (state.showAllRevisions) return list.slice();
    return list.filter(function (f) {
      if (!f || !f.name) return false;
      if (isSzkiceName(f.name)) return false;
      return isProjektSlot(f.slot, f.path || f.rel || "");
    });
  }

  function ensurePakietStyles() {
    /* PAKIET = lifecycle clear anatomy; only row-layout extras here (no geex chip). */
    var s = document.getElementById("dam-pakiet-style");
    if (!s) {
      s = document.createElement("style");
      s.id = "dam-pakiet-style";
      document.head.appendChild(s);
    }
    s.textContent =
      ".dam-carrier-toggle-row__end .dam-pakiet-btn.dam-lifecycle__btn{" +
      "flex-shrink:0;letter-spacing:.02em;text-transform:uppercase;" +
      "}" +
      ".dam-carrier-toggle-row__end .dam-pakiet-btn:disabled{opacity:.55;cursor:wait;}";
  }

  function renderExplorerGridStatus() {
    var status = document.getElementById("damExplorerGridStatus");
    if (!status || !state.fileIndex) return;
    var all = (state.fileIndex.products || []).filter(isBrandEnabled);
    var visible = filterProductsForExplorerView(all);
    var revVisible = 0;
    var revAll = 0;
    visible.forEach(function (p) {
      revVisible += revisionsForProductView(p, state.showAllRevisions).length;
    });
    all.forEach(function (p) {
      revAll += (p.revisions || []).length;
    });
    status.textContent =
      visible.length + " produktów (" + revVisible + " wariantow)" +
      (visible.length !== all.length || revVisible !== revAll
        ? " / z " + all.length + " wszystkich"
        : "");
  }

  function persistExplorerUiPrefs(patch) {
    try {
      if (patch && "explorer_show_all" in patch) {
        localStorage.setItem(SHOW_ALL_KEY, patch.explorer_show_all ? "1" : "0");
      }
      if (patch && "explorer_lang_filter" in patch) {
        localStorage.setItem(LANG_FILTER_KEY, patch.explorer_lang_filter || "");
      }
      if (patch && "explorer_viz_view" in patch) {
        localStorage.setItem(VIZ_VIEW_KEY, patch.explorer_viz_view || "tiles");
      }
      if (patch && "explorer_viz_scale" in patch) {
        localStorage.setItem(VIZ_SCALE_KEY, String(patch.explorer_viz_scale));
      }
    } catch (eLs) { /* ignore */ }
    if (window.DamUserPrefs && typeof DamUserPrefs.set === "function") {
      DamUserPrefs.set(patch || {}).catch(function () {});
    }
  }

  function hydrateExplorerUiPrefsFromKv() {
    if (!window.DamUserPrefs || typeof DamUserPrefs.load !== "function") return;
    DamUserPrefs.load().then(function (prefs) {
      if (!prefs) return;
      var changed = false;
      if (!!prefs.explorer_show_all !== !!state.showAllRevisions) {
        state.showAllRevisions = !!prefs.explorer_show_all;
        changed = true;
      }
      if (String(prefs.explorer_lang_filter || "") !== String(state.langFilter || "")) {
        state.langFilter = String(prefs.explorer_lang_filter || "");
        changed = true;
      }
      if ((prefs.explorer_viz_view || "tiles") !== state.vizViewMode) {
        state.vizViewMode = prefs.explorer_viz_view === "list" ? "list" : "tiles";
        changed = true;
      }
      var sc = parseInt(prefs.explorer_viz_scale, 10);
      if (!isNaN(sc) && sc !== state.vizScale) {
        state.vizScale = sc;
        changed = true;
      }
      if (changed) {
        syncExplorerShowAllUi();
        var langSel = document.getElementById("damExplorerLangFilter");
        if (langSel) langSel.value = state.langFilter || "";
        renderExplorerGridStatus();
        renderMain();
      }
    });
  }

  function setShowAllRevisions(on) {
    state.showAllRevisions = !!on;
    persistExplorerUiPrefs({ explorer_show_all: state.showAllRevisions });
    syncExplorerShowAllUi();
    renderExplorerGridStatus();
    if (state.searchQuery && state.searchQuery.length >= 2) {
      applySearchToPanel(state.searchQuery);
    } else {
      renderMain();
    }
  }

  /**
   * Karty nosnikow: OFF = tylko aktualne; ON = wszystkie (nieaktualne/starsze).
   * Zwraca null = ukryj karte.
   */
  function pickCarrierDisplay(revisions, showAll) {
    var all = revisions || [];
    if (!all.length) return null;
    var aktualne = getAktualneRevisions(all);
    if (!showAll) {
      /* F albo working (Bez statusu / latest) - nie chowaj czystego TEST-TEST */
      var currentOff = aktualne.length ? aktualne : getCurrentRevisions(all);
      currentOff = currentOff.filter(function (r) {
        return getRevisionStatus(r) !== "nieaktualne";
      });
      if (!currentOff.length) return null;
      return { current: currentOff, older: [] };
    }
    var current = aktualne.length ? aktualne : getCurrentRevisions(all);
    var older = getOlderRevisions(all, current);
    return { current: current, older: older };
  }

  /* ------------------------------------------------------------------ */
  /* Toast / status                                                       */
  /* ------------------------------------------------------------------ */

  function showToast(msg, kind) {
    /* kind: success | error | info (domyślnie info - nie "straszny" szary log) */
    var el = document.getElementById("damExplorerToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damExplorerToast";
      el.className = "dam-explorer-toast";
      document.body.appendChild(el);
    }
    var k = kind || "info";
    if (k !== "success" && k !== "error" && k !== "info") k = "info";
    el.textContent = msg;
    el.classList.remove("dam-explorer-toast--success", "dam-explorer-toast--error", "dam-explorer-toast--info");
    el.classList.add("dam-explorer-toast--" + k);
    el.classList.add("is-visible");
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove("is-visible"); }, k === "error" ? 5200 : 3200);
  }

  function setStatus(msg) {
    var el = document.getElementById("damExplorerStatus");
    if (el) el.textContent = msg || "";
  }

  /* ------------------------------------------------------------------ */
  /* Category helpers                                                     */
  /* ------------------------------------------------------------------ */

  function productPathUpper(p) {
    return String((p && (p.path || p.root_key)) || "").toUpperCase();
  }

  function isExplorerProductItem(p) {
    if (!p) return false;
    var path = productPathUpper(p);
    var i;
    for (i = 0; i < PRODUCT_PATH_MARKERS.length; i++) {
      if (path.indexOf(PRODUCT_PATH_MARKERS[i].toUpperCase()) !== -1) return true;
    }
    if (DL && typeof DL.categoryCanonId === "function" && DL.CATEGORY_CANON) {
      var cid = DL.categoryCanonId(p.category);
      for (i = 0; i < DL.CATEGORY_CANON.length; i++) {
        if (DL.CATEGORY_CANON[i].id === cid) return true;
      }
    }
    return false;
  }

  function isExplorerMaterialItem(p) {
    if (!p || isExplorerProductItem(p)) return false;
    var path = productPathUpper(p);
    var i;
    for (i = 0; i < MATERIAL_PATH_MARKERS.length; i++) {
      if (path.indexOf(MATERIAL_PATH_MARKERS[i].toUpperCase()) !== -1) return true;
    }
    if (path.indexOf("MARKETING") !== -1) return true;
    return false;
  }

  function productMatchesExplorerCatMode(p) {
    if (state.catMode === EXPLORER_CAT_MATERIAL) return isExplorerMaterialItem(p);
    return isExplorerProductItem(p);
  }

  function getCanonicalCategoryList() {
    var products = (state.fileIndex && state.fileIndex.products) || [];
    var map = {};
    var orderMap = {};
    var isProductMode = state.catMode !== EXPLORER_CAT_MATERIAL;
    if (isProductMode && DL && DL.CATEGORY_CANON) {
      DL.CATEGORY_CANON.forEach(function (c, idx) {
        orderMap[c.id] = idx;
        map[c.id] = { id: c.id, title: c.title, count: 0 };
      });
    }
    products.forEach(function (p) {
      if (!isBrandEnabled(p)) return;
      if (!productMatchesExplorerCatMode(p)) return;
      var cid;
      var ctitle;
      if (isProductMode) {
        cid = DL ? DL.categoryCanonId(p.category) : p.category;
        ctitle = DL ? DL.categoryTitle(p.category) : p.category;
      } else {
        cid = String(p.category || "INNE");
        ctitle = DL && DL.stripCategoryNumber
          ? DL.stripCategoryNumber(p.category) || p.category
          : p.category;
      }
      if (!map[cid]) map[cid] = { id: cid, title: ctitle, count: 0 };
      map[cid].count++;
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) {
      var oa = orderMap[a.id] !== undefined ? orderMap[a.id] : 99;
      var ob = orderMap[b.id] !== undefined ? orderMap[b.id] : 99;
      if (oa !== ob) return oa - ob;
      return String(a.title).localeCompare(String(b.title), "pl");
    });
    return list;
  }

  function getProductsForCanonCat() {
    if (!state.canonCat || !state.fileIndex) return [];
    var isProductMode = state.catMode !== EXPLORER_CAT_MATERIAL;
    return filterProductsForExplorerView(
      (state.fileIndex.products || []).filter(function (p) {
        if (!isBrandEnabled(p)) return false;
        if (!productMatchesExplorerCatMode(p)) return false;
        if (isProductMode) {
          var cid = DL ? DL.categoryCanonId(p.category) : p.category;
          return cid === state.canonCat;
        }
        return String(p.category || "INNE") === state.canonCat;
      })
    );
  }

  /* ------------------------------------------------------------------ */
  /* Recent products                                                      */
  /* ------------------------------------------------------------------ */

  function getRecentProducts() {
    try {
      var ids = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return ids.map(function (id) {
        return (state.fileIndex && state.fileIndex.products || []).find(function (p) { return p.id === id; });
      }).filter(Boolean);
    } catch (e) { return []; }
  }

  function trackRecentProduct(product) {
    if (!product || !product.id) return;
    try {
      var ids = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      ids = [product.id].concat(ids.filter(function (id) { return id !== product.id; })).slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* Carrier helpers                                                      */
  /* ------------------------------------------------------------------ */

  function overrideForRev(rev) {
    var ov = (state.carrierOverrides && state.carrierOverrides.overrides) || {};
    if (!rev) return null;
    if (rev.path && ov[rev.path]) return ov[rev.path];
    if (rev.index && ov[rev.index]) return ov[rev.index];
    return null;
  }

  function resolveCarrierCode(rev) {
    var ov = overrideForRev(rev);
    if (ov && ov.carrier) return ov.carrier;
    if (DL && typeof DL.inferCarrierFromRevision === "function") {
      return DL.inferCarrierFromRevision(rev);
    }
    return parseCode(rev && rev.folder);
  }

  function parseCode(folder) {
    return DL ? DL.parseCarrierCode(folder) : folder;
  }

  function carrierLabel(code, folder) {
    if (!DL) return code || headTokenSafe(folder) || "WARIANT";
    var product = state.product || {};
    // DamLabels.carrierLabel ratuje FOLIA/DOY z nazwy folderu; nie doklejaj raw folderu
    return DL.carrierLabel(code, folder, {
      isMix: DL.isMixProduct(product.display_name || product.name, product.tags),
      productName: product.display_name || product.name,
      tags: product.tags,
    });
  }

  function isBogus(folder) {
    return DL ? DL.isBogusRevision(folder) : false;
  }

  function groupRevisionsByCarrier(revisions) {
    var groups = {};
    var order = [];
    (revisions || []).forEach(function (r) {
      if (isBogus(r.folder)) return;
      var code = resolveCarrierCode(r);
      if (!groups[code]) { groups[code] = []; order.push(code); }
      groups[code].push(r);
    });
    // UNKNOWN na koncu
    order.sort(function (a, b) {
      if (a === "UNKNOWN") return 1;
      if (b === "UNKNOWN") return -1;
      return 0;
    });
    return order.map(function (code) { return { code: code, revisions: groups[code] }; });
  }

  function sortRevsByIndex(revs) {
    return revs.slice().sort(function (a, b) {
      var ra = parseFloat(a.index_rev || a.index || 0) || 0;
      var rb = parseFloat(b.index_rev || b.index || 0) || 0;
      if (ra !== rb) return rb - ra;
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }

  function getCurrentRevisions(revisions) {
    var withStatus = revisions.filter(function (r) { return getRevisionStatus(r) === "aktualne"; });
    if (withStatus.length > 0) return withStatus;
    var latests = revisions.filter(function (r) { return r.is_latest; });
    if (latests.length > 0) {
      var sorted = sortRevsByIndex(latests);
      return [sorted[0]]; // only one by default
    }
    var sorted2 = sortRevsByIndex(revisions);
    return [sorted2[0]];
  }

  function getOlderRevisions(revisions, currentRevs) {
    var curKeys = currentRevs.map(function (r) { return revisionStatusKey(r); });
    return revisions.filter(function (r) {
      return curKeys.indexOf(revisionStatusKey(r)) < 0;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Checklist computation                                                */
  /* ------------------------------------------------------------------ */

  function normPathKey(p) {
    return String(p || "").replace(/\\/g, "/").replace(/\/+$/, "");
  }

  function getElementsLink(rev) {
    var links = (state.elementsLinks && state.elementsLinks.links) || {};
    var byPath = links[normPathKey(rev && rev.path)];
    if (byPath && byPath.path) return byPath;
    var idx = String((rev && rev.index) || "").trim();
    if (idx && links[idx] && links[idx].path) return links[idx];
    return null;
  }

  function elementsOpenPath(rev) {
    var link = getElementsLink(rev);
    if (link) return link.folder || link.path || "";
    var els = (rev && rev.files_by_role && rev.files_by_role.elements) || [];
    if (els[0] && els[0].path) {
      var p = normPathKey(els[0].path);
      var i = p.lastIndexOf("/");
      return i > 0 ? p.slice(0, i) : p;
    }
    return "";
  }

  function computeChecklist(rev, allProductRevisions, product) {
    var fbr = rev.files_by_role || {};
    var src  = fbr.source || [];
    var viz  = filterVizImageFiles(fbr.viz || []);
    var wizki = filterVizImageFiles(rev.wizki || []);

    // AI / edytowalny
    var hasAI = src.some(function (f) {
      var e = fileExt(f.name);
      return e === "ai" || e === "psd" || e === "indd";
    });

    // Podgląd akceptacji (PREV lub F bez FQ)
    var hasPrev = src.some(function (f) {
      if (!DL) return false;
      return DL.fileRole(f.name) === "podgląd";
    }) || src.some(function (f) {
      var u = String(f.name || "").toUpperCase();
      return /\bPREV\b/.test(u) || (/[-_]F([-_.]|$)/.test(u) && !/FQ/.test(u));
    });

    // Pliki do druku (+ ZIP z 3-DRUK / Pakiet nawet gdy lezal w WIZKI)
    var drukFiles = printFilesFromRevision(rev).filter(function (f) { return f && f.name; });
    var hasDruk = drukFiles.length > 0;
    // Also check source for FQ PDF
    if (!hasDruk) {
      hasDruk = src.some(function (f) {
        var u = String(f.name || "").toUpperCase();
        return /FQ/.test(u) && fileExt(f.name) === "pdf";
      });
    }
    var drukarnia = "";
    drukFiles.forEach(function (f) {
      if (!drukarnia && DL) drukarnia = DL.detectDrukarnia(f.name);
    });

    // Wizualizacje = tylko obrazy (nie ZIP)
    var hasViz = viz.length > 0 || wizki.length > 0;

    // Elementy: indeks, slot/path, albo reczne powiazanie (elements-overrides)
    function revisionHasElements(r) {
      if (getElementsLink(r)) return true;
      var elFiles = (r.files_by_role && r.files_by_role.elements) || [];
      if (elFiles.length > 0) return true;
      var slotsR = r.slots || [];
      if (slotsR.some(function (s) {
        var su = String(s).toUpperCase();
        return su.indexOf("ELEMENTY") >= 0 || su.indexOf("ELEMENTS") >= 0 ||
          su.indexOf("SKLADNIKI") >= 0 || su.indexOf("SKŁADNIKI") >= 0 ||
          su.indexOf("INGREDIENTS") >= 0;
      })) return true;
      var allf = ((r.files_by_role && r.files_by_role.source) || [])
        .concat((r.files_by_role && r.files_by_role.print) || [])
        .concat((r.files_by_role && r.files_by_role.viz) || [])
        .concat(elFiles)
        .concat(r.wizki || []);
      return allf.some(function (f) {
        var pa = String(f.path || f.name || "").toUpperCase().replace(/\//g, "\\");
        return pa.indexOf("ELEMENTY") >= 0 || pa.indexOf("ELEMENTS") >= 0 ||
          pa.indexOf("SKLADNIKI") >= 0 || pa.indexOf("INGREDIENTS") >= 0 ||
          String(f.layer || "").toLowerCase() === "elements";
      });
    }
    var link = getElementsLink(rev);
    var hasElements = revisionHasElements(rev);
    var elementsNote = "";
    var elementsLinked = !!(link && link.path);
    var elementsPath = elementsOpenPath(rev);
    if (elementsLinked) {
      hasElements = true;
      elementsNote = link.file_count
        ? ("powiazane: " + link.file_count + " pl.")
        : "powiazane recznie";
    }
    if (!hasElements) {
      var otherRev = null;
      (allProductRevisions || []).forEach(function (or_) {
        if (otherRev || or_ === rev || isBogus(or_.folder)) return;
        if (revisionHasElements(or_)) otherRev = or_;
      });
      if (otherRev) {
        hasElements = true;
        var code2 = parseCode(otherRev.folder);
        var lbl2  = carrierLabel(code2, otherRev.folder);
        elementsNote = "z wariantu " + lbl2 + " (" + (otherRev.index || otherRev.folder) + ")";
        if (!elementsPath) elementsPath = elementsOpenPath(otherRev);
      }
    }

    // Marketing
    var hasMkt = ((product && product.related_materials) || []).some(function (m) { return m.file_count > 0; });

    var fbr2 = rev.files_by_role || {};
    var hasKarta =
      ((fbr2.karty_wprowadzenia || []).length > 0) ||
      src.some(function (f) {
        var u = String(f.name || "").toUpperCase();
        return /KARTA/.test(u) && /WPROWADZ/.test(u);
      });
    var hasPresentation =
      ((fbr2.strategia || []).length > 0) ||
      src.some(function (f) {
        var e = fileExt(f.name);
        var u = String(f.name || "").toUpperCase();
        return (e === "pptx" || e === "ppt" || e === "key") &&
          (/PREZENT|STRATEG|POZYCJON/.test(u));
      });

    return {
      ai: hasAI, prev: hasPrev, druk: hasDruk, drukarnia: drukarnia,
      viz: hasViz, elements: hasElements, elementsNote: elementsNote,
      elementsLinked: elementsLinked, elementsPath: elementsPath,
      revisionPath: normPathKey(rev && rev.path), revisionIndex: (rev && rev.index) || "",
      marketing: hasMkt, karta: hasKarta, presentation: hasPresentation
    };
  }

  /* ------------------------------------------------------------------ */
  /* Viz grouping                                                         */
  /* ------------------------------------------------------------------ */

  function groupVizFiles(vizFiles) {
    var PERSP_ORDER = ["ENFACE", "FRONT", "BACK", "TYL-ENFACE", "BOK", "INNE"];
    var groups = {};
    (vizFiles || []).forEach(function (f) {
      var persp = DL ? DL.vizPerspective(f.name) : "INNE";
      var size  = DL ? DL.vizSize(f.name) : "";
      if (!groups[persp]) groups[persp] = {};
      if (!groups[persp][size]) groups[persp][size] = [];
      groups[persp][size].push(f);
    });
    return PERSP_ORDER.filter(function (p) { return groups[p]; }).map(function (p) {
      return { perspective: p, bySizes: groups[p] };
    });
  }

  function vizBgOf(f) {
    return DL && DL.vizBackground ? DL.vizBackground(f.name) : "z-tlem";
  }

  function vizLangOf(f) {
    return DL && DL.vizLangFromFile ? DL.vizLangFromFile(f) : (f.lang || "");
  }

  function pickHeroFile(files) {
    if (!files || !files.length) return null;
    var SIZE_RANK = { XL: 3, L: 4, S: 2, "S-SKLEP": 1, "": 0 };
    var EXT_RANK = { jpg: 5, jpeg: 5, png: 4, webp: 3, tif: 1, tiff: 1 };
    var scored = files.slice().map(function (f) {
      var sz = DL ? DL.vizSize(f.name) : "";
      var ext = fileExt(f.name).toLowerCase();
      return { f: f, score: (SIZE_RANK[sz] || 0) * 10 + (EXT_RANK[ext] || 0) + ((f.size || 0) / 1e9) };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored[0].f;
  }

  var VIZ_SIZE_CATALOG = ["XL", "L", "S-SKLEP", "S"];
  var VIZ_PERSP_ORDER = ["ENFACE", "FRONT", "BACK", "TYL-ENFACE", "BOK", "INNE"];

  function enrichVizFile(f) {
    return {
      file: f,
      persp: DL ? DL.vizPerspective(f.name) : "INNE",
      size: DL ? DL.vizSize(f.name) : "",
      bg: vizBgOf(f),
      lang: vizLangOf(f),
      ext: fileExt(f.name).toUpperCase()
    };
  }

  function buildVizStudioModel(vizFiles) {
    var items = (vizFiles || []).map(enrichVizFile);
    var byBg = { "z-tlem": [], "bez-tla": [] };
    items.forEach(function (it) {
      (byBg[it.bg] || byBg["z-tlem"]).push(it);
    });
    var PERSP_ORDER = VIZ_PERSP_ORDER;
    function heroesFor(list) {
      var map = {};
      list.forEach(function (it) {
        if (!map[it.persp]) map[it.persp] = [];
        map[it.persp].push(it.file);
      });
      return PERSP_ORDER.filter(function (p) { return map[p]; }).map(function (p) {
        return { perspective: p, hero: pickHeroFile(map[p]), files: map[p], count: map[p].length };
      });
    }
    var langs = {};
    items.forEach(function (it) { langs[it.lang] = true; });
    return {
      items: items,
      heroesZ: heroesFor(byBg["z-tlem"]),
      heroesBez: heroesFor(byBg["bez-tla"]),
      langs: Object.keys(langs).sort(),
      counts: { "z-tlem": byBg["z-tlem"].length, "bez-tla": byBg["bez-tla"].length }
    };
  }

  /* ------------------------------------------------------------------ */
  /* HTML builders                                                        */
  /* ------------------------------------------------------------------ */

  function renderIndexChips(indexes) {
    return (indexes || []).slice(0, 5).map(function (idx) {
      return '<span class="dam-index-chip dam-viz-badge dam-viz-badge--index" title="Indeks produktu">' + esc(idx) + "</span>";
    }).join("");
  }

  function diskPathShort(path) {
    if (!path) return "";
    if (window.DamPaths && typeof window.DamPaths.relativeFromMarketing === "function") {
      return String(window.DamPaths.relativeFromMarketing(path) || "").replace(/\//g, "\\");
    }
    return String(path)
      .replace(/^.*[\\/]Marketing[\\/]/i, "")
      .replace(/\//g, "\\");
  }

  function isVariantFolderName(name) {
    return /^(BAT|DOY|ETY|MINI|TUBA|BIGPAK|KARTON|FOLIA|KARTON\s*6x)\s*-/i.test(String(name || "").trim());
  }

  function productFolderFromAnyPath(path) {
    var parts = String(path || "").split(/[/\\]/).filter(Boolean);
    if (!parts.length) return "";
    if (isVariantFolderName(parts[parts.length - 1]) && parts.length > 1) {
      return parts[parts.length - 2];
    }
    return parts[parts.length - 1];
  }

  function enrichedProductTitle(product, rev) {
    var p = product || {};
    var name = DL
      ? DL.cleanProductDisplayName(p.display_name || p.name || "")
      : (p.display_name || p.name || "");
    if (!name) {
      name = productFolderFromAnyPath((rev && rev.path) || p.path || (rev && rev.archive_wrapper) || "");
      if (DL) name = DL.cleanProductDisplayName(name) || name;
    }
    var cat = categoryTitleOf(p);
    if (cat && name) return cat + " · " + name;
    return name || cat || p.id || "Produkt";
  }

  function categoryTitleOf(productOrCat) {
    var raw = typeof productOrCat === "string"
      ? productOrCat
      : (productOrCat && (productOrCat.category || productOrCat.canon_category)) || "";
    /* Sidebar (np. Kulki) tylko w widoku listy kategorii - nie w wyszukiwaniu ani po otwarciu produktu */
    if (!raw && state.canonCat && !state.searchQuery && !state.product) raw = state.canonCat;
    if (!raw) return "";
    if (DL && typeof DL.categoryTitle === "function") return DL.categoryTitle(raw) || "";
    return String(raw).replace(/^\s*\d+\s*[-\u2013\u2014]\s*/u, "").trim();
  }

  function productDisplayTitle(product, rev) {
    return enrichedProductTitle(product, rev);
  }

  function statusBadge(status, rev) {
    var st = status || "starsza";
    var mod =
      st === "aktualne" ? "aktualne" :
      st === "nieaktualne" ? "nieaktualne" :
      st === "demo" ? "demo" :
      st === "clear" ? "clear" : "starsza";
    var label =
      mod === "aktualne" ? "Aktualne" :
      mod === "nieaktualne" ? "Nieaktualne" :
      mod === "demo" ? "Demo" :
      mod === "clear" ? "Bez statusu" : "Starsza";
    var tip = "Status wariantu (F/X/D). Admin: F / X / D / Bez statusu - zmienia nazwe folderu na dysku.";
    var path = (rev && rev.path) || "";
    var idx = (rev && rev.index) || "";
    return (
      '<button type="button" class="dam-status-badge dam-status-badge--' + mod +
      ' dam-badge-tag dam-tag-editable" data-tag-kind="status" data-tag-value="' + esc(st) +
      '" data-revision-path="' + esc(path) + '" data-revision-index="' + esc(idx) +
      '" data-dam-tip="' + esc(tip) + '" aria-label="' + esc(label) + '">' +
      esc(label) +
      "</button>"
    );
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    var tok =
      (window.DamApi && typeof window.DamApi.token === "function" && window.DamApi.token()) ||
      localStorage.getItem("dam_token") ||
      "";
    if (tok) h.Authorization = "Bearer " + tok;
    return h;
  }

  function hasBridgeToken() {
    var tok =
      (window.DamApi && typeof window.DamApi.token === "function" && window.DamApi.token()) ||
      localStorage.getItem("dam_token") ||
      "";
    return !!(tok && tok !== "demo-admin-dev-token" && tok !== "qa");
  }

  /** Sesja mostu (rehydrate) przed zapisem F/X/D i odświeżaniem z dysku. */
  function ensureBridgeSession() {
    if (window.DamApi && typeof window.DamApi.ensureSession === "function") {
      return withTimeout(window.DamApi.ensureSession(), 8000, "bridge_session_timeout").catch(function () {
        return { ok: false, error: "login_required" };
      });
    }
    if (hasBridgeToken()) return Promise.resolve({ ok: true });
    return Promise.resolve({ ok: false, error: "login_required" });
  }

  function withTimeout(promise, ms, label) {
    ms = ms || 12000;
    return Promise.race([
      promise,
      new Promise(function (_resolve, reject) {
        setTimeout(function () {
          reject(new Error(label || "timeout"));
        }, ms);
      }),
    ]);
  }

  function fetchWithTimeout(url, opts, timeoutMs) {
    timeoutMs = timeoutMs || 12000;
    opts = opts || {};
    if (typeof AbortController === "undefined") {
      return fetch(url, opts);
    }
    var ac = new AbortController();
    var tid = setTimeout(function () {
      try {
        ac.abort();
      } catch (_eAbort) { /* ignore */ }
    }, timeoutMs);
    var merged = Object.assign({}, opts, { signal: ac.signal });
    return fetch(url, merged).finally(function () {
      clearTimeout(tid);
    });
  }

  function showSessionRequiredToast(errCode) {
    var code = String(errCode || "login_required");
    var hint =
      code === "admin_required"
        ? "Tylko admin może zapisywać F/X/D na dysku."
        : "Sesja wygasła - zaloguj się ponownie (profil w prawym górnym rogu), potem włącz ADMIN.";
    showToast(hint, "error");
  }

  function bridgeFetchJson(url, opts, timeoutMs) {
    opts = opts || {};
    var method = opts.method || "GET";
    var body = opts.body;
    timeoutMs = timeoutMs || 12000;
    return ensureBridgeSession().then(function (sess) {
      if (!sess || !sess.ok) {
        return { http: 401, data: { ok: false, error: (sess && sess.error) || "login_required" } };
      }
      return fetchWithTimeout(
        url,
        {
          method: method,
          headers: authHeaders(),
          body: body,
        },
        timeoutMs
      ).then(function (r) {
        return r.json().then(function (data) {
          return { http: r.status, data: data };
        });
      });
    });
  }

  function getProductStatus(product) {
    if (!product) return "clear";
    /* DYSK najpierw - nazwa folderu produktu */
    var diskLit = letterFromFolderName(product.path || product.name || "");
    if (diskLit) return statusFromLetter(diskLit);

    var keys = [product.id, product.path, product.name].filter(Boolean);
    if (state.lifecycleStore && state.lifecycleStore.products) {
      for (var j = 0; j < keys.length; j++) {
        var row = state.lifecycleStore.products[keys[j]];
        if (row && Object.prototype.hasOwnProperty.call(row, "status")) {
          return row.status || "clear";
        }
      }
    }
    var store = state.statusStore;
    for (var i = 0; i < keys.length; i++) {
      if (store && store.products && store.products[keys[i]] && store.products[keys[i]].status) {
        var pst = store.products[keys[i]].status;
        if (pst === "clear") return "clear";
        if (pst) return pst;
      }
    }
    return "clear";
  }

  function lifecycleLetterLabel(status) {
    if (status === "aktualne") return "F";
    if (status === "nieaktualne") return "X";
    if (status === "demo") return "D";
    return "";
  }

  function productHasVariantF(productId, productObj) {
    var prod = productObj || null;
    if (!prod && productId && state.fileIndex) {
      prod = (state.fileIndex.products || []).find(function (p) { return p.id === productId; }) || null;
    }
    if (!prod && state.product && state.product.id === productId) prod = state.product;
    if (!prod) return false;
    var revs = prod.revisions || [];
    for (var i = 0; i < revs.length; i++) {
      var lit = letterFromFolderName(revs[i].path || revs[i].folder || revs[i].name || "");
      if (lit === "F") return true;
      var st = getRevisionStatus(revs[i]);
      if (st === "aktualne" || lifecycleLetterLabel(st) === "F") return true;
    }
    return false;
  }

  function renderLifecycleControls(opts) {
    opts = opts || {};
    if (!state.adminMode) return "";
    var scope = opts.scope || "variant";
    var current = opts.current || "clear";
    var path = opts.path || "";
    var productPath = opts.productPath || "";
    var productId = opts.productId || "";
    var index = opts.index || "";
    var ridx = opts.ridx || "";
    var fBlocked = false;
    var fBlockTip =
      "Produkt może mieć F tylko wtedy, gdy przynajmniej jeden wariant też ma F. Najpierw nadaj F wybranemu wariantowi.";
    if (scope === "product") {
      fBlocked = !productHasVariantF(productId, opts.product || null) &&
        lifecycleLetterLabel(current) !== "F";
    }
    var items = [
      {
        status: "aktualne",
        label: "F",
        title: scope === "product"
          ? (fBlocked ? fBlockTip : "Final (F) - produkt. Wymaga przynajmniej jednego wariantu z F. Ponowne kliknięcie przywraca poprzedni stan.")
          : "Final (F) - wariant. Wpływa na to, czy produkt może mieć F. Ponowne kliknięcie przywraca poprzednią literę.",
        cls: "ok",
        disabled: fBlocked
      },
      {
        status: "nieaktualne",
        label: "X",
        title: scope === "product"
          ? "Archiwum (X) - produkt i warianty (oprócz Demo D) dostają X. Ponowne kliknięcie przywraca poprzedni stan."
          : "Archiwum (X) - przenosi wariant do archiwum. Ponowne kliknięcie przywraca poprzednią literę.",
        cls: "no"
      },
      {
        status: "demo",
        label: "D",
        title: scope === "product"
          ? "Demo (D) - warianty bez litery i z F dostają D; X zostaje w archiwum. Ponowne kliknięcie przywraca poprzedni stan."
          : "Demo (D) - tylko ten wariant. Nie zmienia litery produktu. Ponowne kliknięcie przywraca poprzednią literę.",
        cls: "demo"
      },
      {
        status: "clear",
        label: "Bez statusu",
        title: "Usuń literę z nazwy (przywraca poprzednią literę, jeśli była zapisana).",
        cls: "clear"
      }
    ];
    var html = '<div class="dam-lifecycle" data-scope="' + esc(scope) + '" role="group" aria-label="Status lifecycle">';
    items.forEach(function (it) {
      var on = current === it.status;
      if (it.status === "clear") on = !lifecycleLetterLabel(current) && (current === "clear" || current === "starsza" || !current);
      var disabled = !!it.disabled;
      html +=
        '<button type="button" class="dam-lifecycle__btn dam-lifecycle__btn--' +
        it.cls +
        (on ? " is-on" : "") +
        (disabled ? " is-disabled" : "") +
        ' dam-admin-control" data-lifecycle="1" data-scope="' +
        esc(scope) +
        '" data-status="' +
        esc(it.status) +
        '" data-path="' +
        esc(path) +
        '" data-product-path="' +
        esc(productPath) +
        '" data-product-id="' +
        esc(productId) +
        '" data-revision-index="' +
        esc(index) +
        '" data-ridx="' +
        esc(ridx) +
        '" data-dam-tip="' +
        esc(it.title) +
        '" aria-pressed="' +
        (on ? "true" : "false") +
        '"' +
        (disabled ? ' aria-disabled="true" disabled' : "") +
        ' title="' +
        esc(it.title) +
        '">' +
        esc(it.label) +
        "</button>";
    });
    html += "</div>";
    html += renderLifecycleHistory(opts);
    return html;
  }

  function lifecycleLetterFromStatus(status) {
    var s = String(status || "").toLowerCase();
    if (s === "aktualne" || s === "f") return "F";
    if (s === "nieaktualne" || s === "x" || s === "archiwum") return "X";
    if (s === "demo" || s === "d") return "D";
    if (s === "clear" || s === "starsza" || !s) return "-";
    return String(status || "").toUpperCase().slice(0, 3);
  }

  function filterLifecycleHistoryRows(opts) {
    opts = opts || {};
    var hist = (state.lifecycleStore && state.lifecycleStore.history) || [];
    if (!hist.length) return [];
    var productId = String(opts.productId || "");
    var index = String(opts.index || opts.ridx || "");
    var path = String(opts.path || "").toLowerCase();
    var productPath = String(opts.productPath || "").toLowerCase();
    var rows = hist.filter(function (h) {
      if (!h) return false;
      if (productId && String(h.product_id || "") === productId) return true;
      if (index && (String(h.revision_index || "") === index || String(h.index || "") === index)) return true;
      var hp = String(h.path || h.variant_path || h.product_path || "").toLowerCase();
      if (path && hp && (hp === path || hp.indexOf(path) !== -1 || path.indexOf(hp) !== -1)) return true;
      if (productPath && hp && hp.indexOf(productPath) !== -1) return true;
      return false;
    });
    return rows.slice().sort(function (a, b) {
      return String(b.ts || "").localeCompare(String(a.ts || ""));
    });
  }

  /** Skrocenie autora: e-mail -> czytelna nazwa ("jan.kowalski@x.pl" -> "Jan Kowalski"). */
  function lifecycleAuthorShort(who) {
    var raw = String(who || "").trim();
    if (!raw) return { label: "", full: "" };
    var at = raw.indexOf("@");
    if (at < 1) return { label: raw, full: raw };
    var name = raw
      .slice(0, at)
      .split(/[._-]+/)
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
    return { label: name || raw, full: raw };
  }

  function lifecycleChipClass(letter) {
    if (letter === "F") return "dam-lifecycle-chip dam-lifecycle-chip--f";
    if (letter === "X") return "dam-lifecycle-chip dam-lifecycle-chip--x";
    if (letter === "D") return "dam-lifecycle-chip dam-lifecycle-chip--d";
    if (letter === "-" || letter === "\u2014" || letter === "∅") {
      return "dam-lifecycle-chip dam-lifecycle-chip--clear";
    }
    return "dam-lifecycle-chip";
  }

  function lifecycleHistHashtag(h) {
    var id = String((h && h.id) || "").trim();
    if (!id || id === "current") return "";
    return id.charAt(0) === "#" ? id : "#" + id;
  }

  function historyEntryApplyStatus(h) {
    if (!h) return "clear";
    if (h._isCurrent) {
      var st = String(h.status || "clear");
      if (st === "aktualne" || st === "nieaktualne" || st === "demo" || st === "clear") return st;
      return "clear";
    }
    var lit = lifecycleLetterFromStatus(h.letter || h.status || h.to || h.after);
    if (lit === "F") return "aktualne";
    if (lit === "X") return "nieaktualne";
    if (lit === "D") return "demo";
    return "clear";
  }

  function findRevisionForHistOpts(opts) {
    opts = opts || {};
    var idx = String(opts.index || opts.ridx || "");
    var revs = (state.product && state.product.revisions) || [];
    var i;
    if (idx) {
      for (i = 0; i < revs.length; i++) {
        if (revs[i] && revs[i].index === idx) return revs[i];
      }
    }
    if (opts.path) {
      var pk = normPathKey(opts.path);
      for (i = 0; i < revs.length; i++) {
        if (revs[i] && normPathKey(revs[i].path || "") === pk) return revs[i];
      }
    }
    return null;
  }

  function captureLifecycleContext(opts) {
    opts = opts || {};
    var scope = opts.scope || "variant";
    if (scope === "product") {
      var prod = state.product;
      if ((!prod || prod.id !== opts.productId) && opts.productId && state.fileIndex) {
        prod =
          (state.fileIndex.products || []).find(function (p) {
            return p && p.id === opts.productId;
          }) || prod;
      }
      var pst = getProductStatus(prod);
      return {
        scope: "product",
        status: pst || "clear",
        letter: lifecycleLetterLabel(pst) || null,
        path: (prod && prod.path) || opts.path || "",
        productPath: opts.productPath || (prod && prod.path) || "",
        productId: opts.productId || (prod && prod.id) || "",
        index: ""
      };
    }
    var rev = findRevisionForHistOpts(opts);
    var rst = getRevisionStatus(rev);
    var lrow = rev ? lifecycleRowForRev(rev) : null;
    return {
      scope: "variant",
      status: rst || "clear",
      letter: lifecycleLetterLabel(rst) || null,
      path: (rev && rev.path) || opts.path || (lrow && lrow.path) || "",
      productPath: opts.productPath || (state.product && state.product.path) || "",
      productId: opts.productId || (state.product && state.product.id) || "",
      index: (rev && rev.index) || opts.index || opts.ridx || ""
    };
  }

  function buildCurrentLifecycleRow(opts) {
    var ctx = captureLifecycleContext(opts);
    var lrow = null;
    if (state.lifecycleStore && state.lifecycleStore.revisions) {
      var keys = [ctx.index, normPathKey(ctx.path), ctx.path].filter(Boolean);
      for (var i = 0; i < keys.length; i++) {
        if (state.lifecycleStore.revisions[keys[i]]) {
          lrow = state.lifecycleStore.revisions[keys[i]];
          break;
        }
      }
    }
    if (!lrow && ctx.scope === "product" && state.lifecycleStore && state.lifecycleStore.products) {
      lrow = state.lifecycleStore.products[ctx.productId] || null;
    }
    return {
      _isCurrent: true,
      id: "current",
      ts: (lrow && (lrow.updated_at || lrow.applied_at)) || new Date().toISOString(),
      letter: ctx.letter,
      status: ctx.status,
      scope: ctx.scope,
      product_id: ctx.productId,
      revision_index: ctx.index,
      path: ctx.path,
      product_path: ctx.productPath,
      actor: (lrow && lrow.updated_by) || ""
    };
  }

  function buildLifecycleModalRows(opts) {
    var hist = applyLifeHistPatches(filterLifecycleHistoryRows(opts));
    return [buildCurrentLifecycleRow(opts)].concat(hist);
  }

  var LIFE_HIST_PATCH_KEY = "dam_life_hist_patches";

  function readLifeHistPatches() {
    try {
      return JSON.parse(sessionStorage.getItem(LIFE_HIST_PATCH_KEY) || "{}") || {};
    } catch (ePatch) {
      return {};
    }
  }

  function writeLifeHistPatch(id, patch) {
    if (!id || id === "current") return;
    var all = readLifeHistPatches();
    all[id] = Object.assign({}, all[id] || {}, patch || {});
    try {
      sessionStorage.setItem(LIFE_HIST_PATCH_KEY, JSON.stringify(all));
    } catch (eStore) { /* ignore */ }
  }

  function applyLifeHistPatches(rows) {
    var all = readLifeHistPatches();
    return (rows || []).map(function (h) {
      if (!h || !h.id || !all[h.id]) return h;
      return Object.assign({}, h, all[h.id]);
    });
  }

  function tagLatestHistoryRestore(fromId, undoSnapshot) {
    var hist = state.lifecycleStore && state.lifecycleStore.history;
    if (!hist || !hist.length) return null;
    var row = hist[hist.length - 1];
    row.restored_from = fromId;
    row.action = "lifecycle_restore";
    if (undoSnapshot) row.undo_snapshot = undoSnapshot;
    writeLifeHistPatch(row.id, {
      restored_from: fromId,
      action: "lifecycle_restore",
      undo_snapshot: undoSnapshot || null
    });
    return row.id;
  }

  /* Pkt 1 brief 2026-07-20: modal historii = pionowa os czasu z chipami F/X/D,
     filtrem per status, licznikiem, akcjami (kopiuj indeks / przejdz do produktu). */
  function openLifecycleHistoryModal(opts) {
    opts = opts || {};
    if (!opts.scope) opts.scope = opts.index || opts.ridx ? "variant" : "product";
    var existing = document.getElementById("damLifecycleHistoryModal");
    if (existing) existing.remove();
    var allRows = buildLifecycleModalRows(opts);
    var activeFilters = {};
    var histBusy = false;

    function rowLetter(h) {
      if (h && h._isCurrent) {
        var cur = lifecycleLetterFromStatus(h.letter || h.status);
        return (cur === "-" || cur === "\u2014") ? "∅" : cur;
      }
      var lit = lifecycleLetterFromStatus(h.letter || h.status || h.to || h.after);
      return (lit === "-" || lit === "\u2014") ? "∅" : lit;
    }

    function visibleRows() {
      var keys = Object.keys(activeFilters);
      if (!keys.length) return allRows;
      return allRows.filter(function (h) {
        if (h._isCurrent) return true;
        return activeFilters[rowLetter(h)];
      });
    }

    function entryNoteHtml(h) {
      if (h._isCurrent) {
        return '<span class="dam-life-hist__note dam-life-hist__note--current">Aktualny stan na dysku</span>';
      }
      var tag = lifecycleHistHashtag(h);
      var parts = [];
      if (tag) {
        parts.push('<span class="dam-life-hist__tag" title="Identyfikator wpisu">' + esc(tag) + "</span>");
      }
      if (h.restored_from) {
        var fromTag = String(h.restored_from).charAt(0) === "#" ? h.restored_from : "#" + h.restored_from;
        parts.push(
          '<span class="dam-life-hist__note">Przywrócono z <strong>' +
            esc(fromTag) +
            "</strong></span>"
        );
      } else if (!h.letter && (h.status === "clear" || !h.status)) {
        parts.push('<span class="dam-life-hist__note">Bez statusu (odznaczono F/X/D)</span>');
      }
      return parts.join("");
    }

    function getNewestHistId() {
      for (var nh = 0; nh < allRows.length; nh++) {
        if (!allRows[nh]._isCurrent && allRows[nh].id) return allRows[nh].id;
      }
      return "";
    }

    function entryHtml(h) {
      var letter = rowLetter(h);
      var dotLetter = letter === "∅" ? "-" : letter;
      var when = String(h.ts || "").replace("T", " ").slice(0, 16);
      var who = lifecycleAuthorShort(h.actor || h.user || h.by || "");
      var scope =
        h._isCurrent
          ? "Teraz"
          : h.scope === "product"
            ? "Produkt"
            : h.scope === "variant"
              ? "Wariant"
              : h.scope || "Status";
      var idxShow = String(h.revision_index || h.index || opts.index || opts.ridx || "");
      var pid = String(h.product_id || opts.productId || "");
      var noteHtml = entryNoteHtml(h);
      var isNewestHist = !h._isCurrent && h.id && h.id === getNewestHistId();
      var canUndo =
        isNewestHist &&
        (h.restored_from ||
          h.action === "lifecycle_restore" ||
          (state._lifeHistUndo && state._lifeHistUndo.entryId === h.id));
      var adminOk = state.adminMode && isAdminRole();
      var restoreDisabled = histBusy || h._isCurrent || !adminOk;
      var undoDisabled = histBusy || !canUndo || !adminOk;
      return (
        '<li class="dam-life-hist__item' +
        (h._isCurrent ? " dam-life-hist__item--current" : "") +
        '">' +
        '<span class="dam-life-hist__rail">' +
        '<span class="dam-life-hist__dot ' +
        lifecycleChipClass(dotLetter) +
        '" title="' +
        (h._isCurrent ? "Aktualny stan" : "Status " + esc(dotLetter)) +
        '">' +
        esc(dotLetter) +
        "</span>" +
        '<span class="dam-life-hist__line" aria-hidden="true"></span>' +
        "</span>" +
        '<span class="dam-life-hist__body">' +
        '<span class="dam-life-hist__row1">' +
        '<span class="dam-life-hist__when">' +
        esc(when || "brak daty") +
        "</span>" +
        '<span class="dam-life-hist__scope">' +
        esc(scope) +
        "</span>" +
        (noteHtml ? '<span class="dam-life-hist__meta-inline">' + noteHtml + "</span>" : "") +
        '<span class="dam-life-hist__actions">' +
        (idxShow
          ? '<button type="button" class="dam-life-hist__act" data-life-copy="' +
            esc(idxShow) +
            '" title="Kopiuj indeks" aria-label="Kopiuj indeks" data-dam-tip="Kopiuj indeks ' +
            esc(idxShow) +
            '"><i class="uil uil-copy"></i></button>'
          : "") +
        (pid
          ? '<button type="button" class="dam-life-hist__act" data-life-go="' +
            esc(pid) +
            '" title="Przejdź do produktu" aria-label="Przejdź do produktu" data-dam-tip="Otwiera produkt w Eksplorerze"><i class="uil uil-sitemap"></i></button>'
          : "") +
        (!h._isCurrent
          ? '<button type="button" class="dam-life-hist__act dam-life-hist__act--restore" data-life-restore="' +
            esc(h.id || "") +
            '" data-life-letter="' +
            esc(dotLetter) +
            '"' +
            (restoreDisabled ? " disabled" : "") +
            ' title="Przywróć ten stan" aria-label="Przywróć stan" data-dam-tip="Przywraca status tej pozycji"><i class="uil uil-redo" aria-hidden="true"></i></button>'
          : "") +
        (canUndo
          ? '<button type="button" class="dam-life-hist__act dam-life-hist__act--undo" data-life-undo="' +
            esc(h.id || "") +
            '"' +
            (undoDisabled ? " disabled" : "") +
            ' title="Cofnij zmianę" aria-label="Cofnij zmianę" data-dam-tip="Przywraca poprzedni stan sprzed ostatniego przywrócenia"><i class="uil uil-undo" aria-hidden="true"></i></button>'
          : "") +
        "</span>" +
        "</span>" +
        '<span class="dam-life-hist__row2">' +
        (idxShow
          ? '<span class="dam-viz-badge dam-viz-badge--index" title="Indeks">' + esc(idxShow) + "</span>"
          : "") +
        (pid
          ? '<span class="dam-viz-badge" title="Produkt">' + esc(pid) + "</span>"
          : "") +
        (who.label
          ? '<span class="dam-life-hist__author" title="' +
            esc(who.full) +
            '" data-dam-tip="' +
            esc(who.full) +
            '"><i class="uil uil-user" aria-hidden="true"></i> ' +
            esc(who.label) +
            "</span>"
          : "") +
        "</span>" +
        "</span></li>"
      );
    }

    function listHtml() {
      var rows = visibleRows();
      if (!rows.length) {
        return (
          '<div class="dam-life-hist__empty">' +
          '<i class="uil uil-history" aria-hidden="true"></i>' +
          "<p>" +
          (allRows.length
            ? "Brak wpisów dla wybranego filtra statusu."
            : "Brak wpisów historii dla tego zakresu.<br>Zmiany F / X / D pojawią się tutaj automatycznie.") +
          "</p></div>"
        );
      }
      return (
        '<ul class="dam-life-hist__timeline" aria-label="Oś czasu statusów">' +
        rows
          .map(function (h) {
            return entryHtml(h);
          })
          .join("") +
        "</ul>"
      );
    }

    var filterChips = ["F", "X", "D", "∅"]
      .map(function (l) {
        var label = l === "∅" ? "-" : l;
        var tip =
          l === "∅"
            ? "Filtruj wpisy: bez statusu (odznaczono)"
            : "Filtruj wpisy: status " + l;
        return (
          '<button type="button" class="dam-life-hist__filter ' +
          lifecycleChipClass(l === "∅" ? "-" : l) +
          '" data-life-filter="' +
          l +
          '" aria-pressed="false" title="' +
          esc(tip) +
          '" data-dam-tip="' +
          esc(tip) +
          '">' +
          esc(label) +
          "</button>"
        );
      })
      .join("");

    var html =
      '<div class="dam-basepath-overlay" id="damLifecycleHistoryModal" role="dialog" aria-modal="true" aria-label="Historia statusów" data-life-hist-scope="product">' +
      '<div class="dam-basepath-box dam-lifecycle-history-modal dam-lifecycle-history-modal--product">' +
      '<button type="button" class="dam-viz-modal-close" data-life-hist-close aria-label="Zamknij" style="position:absolute;top:12px;right:12px;z-index:2"><i class="uil uil-times"></i></button>' +
      '<div class="dam-life-hist__head">' +
      "<h3>Historia statusów</h3>" +
      '<span class="dam-life-hist__count" id="damLifeHistCount" title="Liczba wpisów">' +
      Math.max(0, allRows.length - 1) +
      "</span>" +
      "</div>" +
      '<p class="dam-lifecycle-history__lead">Pełna historia zmian F / X / D / bez statusu. U góry aktualny stan; każdy wpis ma hashtag (#lc_…).</p>' +
      '<div class="dam-life-hist__filters" role="group" aria-label="Filtr statusów">' +
      '<span class="dam-life-hist__filter-label">Filtr:</span>' +
      filterChips +
      "</div>" +
      '<div id="damLifeHistList" class="dam-life-hist__scroll">' +
      listHtml() +
      "</div>" +
      '<div class="dam-lifecycle-history-modal__actions">' +
      '<button type="button" class="geex-btn geex-btn--sm" data-life-hist-close>Zamknij</button>' +
      '<a class="geex-btn geex-btn--sm geex-btn--primary" href="inbox.html" data-dam-tip="Zgłoś problem w Wiadomościach">Zgłoś</a>' +
      "</div></div></div>";
    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("damLifecycleHistoryModal");

    function setHistBusy(busy, activeBtn) {
      histBusy = !!busy;
      if (!modal) return;
      modal.classList.toggle("is-life-hist-busy", histBusy);
      modal.querySelectorAll("[data-life-restore],[data-life-undo]").forEach(function (b) {
        b.disabled = histBusy;
        b.classList.toggle("is-pending", histBusy && b === activeBtn);
        b.setAttribute("aria-busy", histBusy && b === activeBtn ? "true" : "false");
      });
    }

    function refreshRows() {
      allRows = buildLifecycleModalRows(opts);
    }

    function findHistRowById(id) {
      if (!id) return null;
      for (var i = 0; i < allRows.length; i++) {
        if (allRows[i].id === id) return allRows[i];
      }
      var hist = filterLifecycleHistoryRows(opts);
      for (var j = 0; j < hist.length; j++) {
        if (hist[j].id === id) return hist[j];
      }
      return null;
    }

    function applyFromHistoryRow(sourceRow, activeBtn, mode) {
      if (histBusy) return;
      if (!state.adminMode || !isAdminRole()) {
        showToast("Włącz tryb admina, aby przywracać statusy", "error");
        return;
      }
      var before = captureLifecycleContext(opts);
      var targetStatus;
      var restoredFromId = "";
      if (mode === "undo") {
        var snap =
          (sourceRow && sourceRow.undo_snapshot) ||
          (state._lifeHistUndo && state._lifeHistUndo.snapshot) ||
          null;
        if (!snap) {
          showToast("Brak danych do cofnięcia", "error");
          return;
        }
        targetStatus = snap.status || "clear";
        restoredFromId = "";
      } else {
        targetStatus = historyEntryApplyStatus(sourceRow);
        restoredFromId = sourceRow.id || "";
      }
      var scope = sourceRow.scope || opts.scope || "variant";
      var path =
        resolveLifecycleDiskPath({
          scope: scope,
          path: sourceRow.path || opts.path || "",
          index: sourceRow.revision_index || opts.index || opts.ridx || "",
          productId: sourceRow.product_id || opts.productId || ""
        }) ||
        sourceRow.path ||
        opts.path ||
        "";
      setHistBusy(true, activeBtn);
      applyLifecycleStatus({
        scope: scope,
        status: targetStatus,
        path: path,
        productPath: sourceRow.product_path || opts.productPath || "",
        productId: sourceRow.product_id || opts.productId || "",
        index: sourceRow.revision_index || opts.index || opts.ridx || ""
      })
        .then(function (res) {
          if (!res || res.ok === false) return null;
          return loadLifecycleStore().then(function () {
            if (mode === "restore" && restoredFromId) {
              var newId = tagLatestHistoryRestore(restoredFromId, before);
              state._lifeHistUndo = {
                entryId: newId || (res.history_id || ""),
                snapshot: before,
                restoredFrom: restoredFromId
              };
            } else if (mode === "undo") {
              state._lifeHistUndo = null;
            }
            refreshRows();
            repaintList();
            showToast(
              mode === "undo" ? "Cofnięto ostatnie przywrócenie" : "Przywrócono stan z historii",
              "success"
            );
          });
        })
        .finally(function () {
          setHistBusy(false, null);
        });
    }

    function bindListActions() {
      modal.querySelectorAll("[data-life-copy]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var txt = btn.getAttribute("data-life-copy") || "";
          if (!txt) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(function () {
              if (typeof window.damShowToast === "function") window.damShowToast("Skopiowano: " + txt);
            });
          }
        });
      });
      modal.querySelectorAll("[data-life-go]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var pid = btn.getAttribute("data-life-go") || "";
          if (!pid) return;
          location.href = "explorer.html?product=" + encodeURIComponent(pid);
        });
      });
      modal.querySelectorAll("[data-life-restore]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (btn.disabled || histBusy) return;
          var id = btn.getAttribute("data-life-restore") || "";
          var row = findHistRowById(id);
          if (!row) {
            showToast("Nie znaleziono wpisu historii", "error");
            return;
          }
          applyFromHistoryRow(row, btn, "restore");
        });
      });
      modal.querySelectorAll("[data-life-undo]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (btn.disabled || histBusy) return;
          var id = btn.getAttribute("data-life-undo") || "";
          var row = findHistRowById(id);
          if (!row) {
            showToast("Nie znaleziono wpisu do cofnięcia", "error");
            return;
          }
          applyFromHistoryRow(row, btn, "undo");
        });
      });
    }

    function repaintList() {
      var host = document.getElementById("damLifeHistList");
      if (!host) return;
      host.innerHTML = listHtml();
      var cnt = document.getElementById("damLifeHistCount");
      if (cnt) cnt.textContent = String(Math.max(0, visibleRows().length - 1));
      bindListActions();
      if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
        window.DamTooltips.bind(host);
      }
    }

    modal.querySelectorAll("[data-life-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var l = chip.getAttribute("data-life-filter") || "";
        if (activeFilters[l]) delete activeFilters[l];
        else activeFilters[l] = true;
        chip.classList.toggle("is-on", !!activeFilters[l]);
        chip.setAttribute("aria-pressed", activeFilters[l] ? "true" : "false");
        repaintList();
      });
    });
    bindListActions();

    function close() {
      if (modal) modal.remove();
      document.removeEventListener("keydown", onEsc);
    }
    function onEsc(e) {
      if (e.key === "Escape") close();
    }
    modal.addEventListener("click", function (e) {
      if (e.target === modal || (e.target.closest && e.target.closest("[data-life-hist-close]"))) {
        close();
      }
    });
    document.addEventListener("keydown", onEsc);
    if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
      window.DamTooltips.bind(modal);
    }
  }

  function renderLifecycleHistory(opts) {
    opts = opts || {};
    var rows = filterLifecycleHistoryRows(opts);
    var count = rows.length;
    if (!count && !state.adminMode) return "";
    var payload = esc(
      JSON.stringify({
        productId: opts.productId || "",
        index: opts.index || opts.ridx || "",
        path: opts.path || "",
        productPath: opts.productPath || "",
        scope: opts.scope || "variant",
      })
    );
    return (
      '<div class="dam-lifecycle-history dam-lifecycle-history--btn">' +
      '<button type="button" class="geex-btn geex-btn--sm dam-lifecycle-history__open" data-lifecycle-history-open="1" data-life-hist="' +
      payload +
      '" aria-label="Historia statusów (' +
      count +
      ')">' +
      '<i class="uil uil-history" aria-hidden="true"></i>' +
      "<span>Historia statusów</span>" +
      (count
        ? '<span class="dam-lifecycle-history__badge" aria-hidden="true">' + count + "</span>"
        : "") +
      "</button></div>"
    );
  }

  function waitForIndexRebuild(timeoutMs) {
    var started = Date.now();
    var limit = timeoutMs || 45000;
    function poll() {
      return fetch(bridgeUrl() + "/index/status", { headers: authHeaders() })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          var running = d && d.rebuild && d.rebuild.running;
          if (!running) return d;
          if (Date.now() - started > limit) return d;
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(poll());
            }, 600);
          });
        })
        .catch(function () {
          return {};
        });
    }
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(poll());
      }, 400);
    });
  }

  var _lifecycleQueue = Promise.resolve();

  function _dbgLifeLog(location, message, data, hypothesisId) {
    // #region agent log
    fetch("http://127.0.0.1:7922/ingest/8b6cf650-a21b-4d56-ad4a-ad3ea44edb8c", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "3ca09b" },
      body: JSON.stringify({
        sessionId: "3ca09b",
        hypothesisId: hypothesisId || "D",
        location: location,
        message: message,
        data: data || {},
        timestamp: Date.now()
      })
    }).catch(function () {});
    // #endregion
  }

  function lifecyclePendingTarget(btn) {
    if (!btn || !btn.closest) return null;
    return {
      btn: btn,
      group: btn.closest(".dam-lifecycle"),
      card: btn.closest(".dam-carrier-card")
    };
  }

  function setLifecyclePending(target) {
    clearLifecyclePending();
    if (!target || !target.btn) return;
    state._lifecyclePending = target;
    target.btn.classList.add("is-pending");
    target.btn.setAttribute("aria-busy", "true");
    if (target.group) {
      target.group.querySelectorAll(".dam-lifecycle__btn").forEach(function (b) {
        b.disabled = true;
        if (b !== target.btn) b.classList.add("is-disabled");
      });
    }
    if (target.card) target.card.classList.add("is-lifecycle-pending");
  }

  function clearLifecyclePending() {
    var t = state._lifecyclePending;
    if (!t) return;
    if (t.btn && t.btn.classList) {
      t.btn.classList.remove("is-pending");
      t.btn.removeAttribute("aria-busy");
    }
    if (t.group) {
      t.group.querySelectorAll(".dam-lifecycle__btn").forEach(function (b) {
        b.disabled = false;
        b.classList.remove("is-disabled");
      });
    }
    if (t.card && t.card.classList) t.card.classList.remove("is-lifecycle-pending");
    state._lifecyclePending = null;
  }

  function applyLifecycleStatus(opts) {
    /* Kolejka - szybkie klikniecia F/X/D nie moga sie nakladac */
    var run = function () {
      return applyLifecycleStatusNow(opts || {});
    };
    _lifecycleQueue = _lifecycleQueue.then(run, run);
    return _lifecycleQueue;
  }

  function applyLifecycleStatusNow(opts) {
    opts = opts || {};
    var t0 = Date.now();
    if (!isAdminRole() || !state.adminMode) {
      showToast("Włącz tryb admina, aby zmieniać statusy F/X/D", "error");
      return Promise.resolve({ ok: false });
    }
    if (!hasBridgeToken()) {
      return ensureBridgeSession().then(function (sess) {
        if (!sess || !sess.ok) {
          showSessionRequiredToast((sess && sess.error) || "login_required");
          return { ok: false, error: "login_required" };
        }
        return applyLifecycleStatusNow(opts);
      });
    }
    setLifecyclePending(lifecyclePendingTarget(opts.uiBtn));
    _dbgLifeLog("dam-explorer.js:applyLifecycleStatusNow", "lifecycle start", {
      scope: opts.scope || "variant",
      status: opts.status || "clear",
      hasUiBtn: !!opts.uiBtn
    }, "D");
    var resolvedPath = resolveLifecycleDiskPath({
      scope: opts.scope || "variant",
      path: opts.path || "",
      index: opts.index || "",
      productId: opts.productId || ""
    });
    var body = {
      scope: opts.scope || "variant",
      status: opts.status || "clear",
      path: resolvedPath || opts.path || "",
      product_path: opts.productPath || "",
      product_id: opts.productId || "",
      revision_index: opts.index || "",
      dry_run: !!opts.dryRun
    };
    if (!body.path && !body.revision_index) {
      showToast("Brak ścieżki do zmiany statusu", "error");
      clearLifecyclePending();
      return Promise.resolve({ ok: false });
    }
    showToast("Zapisuję status na dysku…", "info");
    return bridgeFetchJson(bridgeUrl() + "/lifecycle-status", {
      method: "POST",
      body: JSON.stringify(body)
    })
      .then(function (res) {
        var tBridge = Date.now() - t0;
        _dbgLifeLog("dam-explorer.js:applyLifecycleStatusNow", "bridge POST done", { ms: tBridge, ok: !!(res.data && res.data.ok) }, "A");
        if (!res.data || !res.data.ok) {
          var err = (res.data && res.data.error) || "lifecycle-status";
          var hint = (res.data && res.data.hint) || "";
          if (err === "login_required" || err === "admin_required" || res.http === 401 || res.http === 403) {
            showSessionRequiredToast(err);
            return res.data || { ok: false, error: err };
          }
          if (err === "product_f_requires_variant_f") {
            showToast(
              hint ||
                "Produkt może mieć F tylko gdy przynajmniej jeden wariant też ma F.",
              "error"
            );
          } else {
            showToast((hint ? hint + " " : "") + "Błąd: " + err, "error");
          }
          return res.data || { ok: false };
        }
        patchPathsAfterLifecycle(res.data, body);
        var letter = res.data.letter;
        showToast(
          letter
            ? "Pomyślnie zaktualizowano status (− " + letter + ")"
            : "Pomyślnie zaktualizowano status",
          "success"
        );
        if (window.DamPaths && typeof window.DamPaths.logAction === "function") {
          window.DamPaths.logAction("lifecycle_status", {
            scope: body.scope,
            status: body.status,
            path: body.path,
            detail: res.data
          });
        }
        /* Lokalny mirror statusu */
        var local = loadLocalStatus();
        if (!local.revisions) local.revisions = {};
        if (!local.products) local.products = {};
        if (body.scope === "variant") {
          var st = res.data.status || body.status;
          var key = normPathKey(res.data.final_variant_path || body.path);
          if (!key) key = body.revision_index || opts.index || "";
          local.revisions[key] = {
            status: st,
            note: "Lifecycle",
            letter: res.data.letter || null,
            path: res.data.final_variant_path || body.path || ""
          };
        } else {
          var pst = res.data.status || body.status;
          if (body.product_id) {
            local.products[body.product_id] = {
              status: pst,
              letter: res.data.letter || null,
              path: res.data.final_product_path || body.path
            };
          }
        }
        local.updated_at = new Date().toISOString();
        saveLocalStatus(local);
        state.statusStore = mergeStatusStore(state.statusStore);
        var keepProductId = body.product_id || opts.productId || (state.product && state.product.id) || "";
        /* Po FS rename: przebuduj indeks z dysku, potem odśwież UI */
        showToast("Odświeżam listę plików…", "info");
        var tRebuildStart = Date.now();
        return fetch(bridgeUrl() + "/index/rebuild", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({})
        })
          .then(function (r) {
            return r.json().catch(function () {
              return {};
            });
          })
          .then(function () {
            return waitForIndexRebuild(45000);
          })
          .then(function () {
            _dbgLifeLog("dam-explorer.js:applyLifecycleStatusNow", "index rebuild done", { ms: Date.now() - tRebuildStart }, "B");
            var tRefreshStart = Date.now();
            return refreshIndex({
              silent: true,
              reopenProductId: keepProductId,
              lifecyclePathHint: res.data.final_product_path || res.data.final_variant_path || body.path || ""
            }).then(function () {
              _dbgLifeLog("dam-explorer.js:applyLifecycleStatusNow", "refreshIndex done", { ms: Date.now() - tRefreshStart }, "C");
              return null;
            });
          })
          .then(function () {
            _dbgLifeLog("dam-explorer.js:applyLifecycleStatusNow", "lifecycle complete", { msTotal: Date.now() - t0 }, "E");
            showToast("Pomyślnie zaktualizowano", "success");
            return res.data;
          })
          .catch(function () {
            return refreshIndex({
              silent: true,
              reopenProductId: keepProductId,
              lifecyclePathHint: res.data.final_product_path || res.data.final_variant_path || body.path || ""
            }).then(function () {
              showToast("Zapisano status (odświeżenie częściowe)", "info");
              return res.data;
            });
          });
      })
      .catch(function (err) {
        showToast("Brak połączenia z mostem: " + (err && err.message ? err.message : err), "error");
        return { ok: false, error: "bridge_offline" };
      })
      .finally(function () {
        clearLifecyclePending();
      });
  }

  function applyPakietFileToProduct(data) {
    var product = state.product;
    if (!product || !data) return false;
    var revKey = normPathKey(data.revision_path || "");
    var file = data.file || null;
    if (!file && data.zip_path) {
      file = {
        name: data.zip_name || "",
        path: String(data.zip_path || "").replace(/\\/g, "/"),
        ext: "zip",
        size: data.zip_size || 0,
        mtime: data.mtime || "",
        lang: "",
        slot: "3 - DRUK",
        role: "print"
      };
    }
    if (!file || !file.name) return false;
    var patched = false;
    (product.revisions || []).forEach(function (rev) {
      if (!rev) return;
      if (revKey && normPathKey(rev.path || "") !== revKey) return;
      if (!revKey && data.index && String(rev.index || "") !== String(data.index || "")) return;
      var fbr = rev.files_by_role || (rev.files_by_role = {});
      var print = (fbr.print || []).slice();
      print = print.filter(function (f) {
        return !f || String(f.name || "") !== String(file.name);
      });
      print.unshift(file);
      fbr.print = print;
      patched = true;
    });
    return patched;
  }

  function packPrintPackage(btn) {
    if (!btn || btn.disabled) return;
    var revPath = btn.getAttribute("data-pakiet-path") || "";
    var index = btn.getAttribute("data-pakiet-index") || "";
    var productId =
      btn.getAttribute("data-pakiet-product") ||
      (state.product && state.product.id) ||
      "";
    if (!revPath && !productId) {
      showToast("Brak ścieżki wariantu do pakietu.", "error");
      return;
    }
    btn.disabled = true;
    if (window.DamLoader && typeof window.DamLoader.start === "function") {
      window.DamLoader.start("Pakuję PAKIET…");
    } else {
      showToast("Pakuję PAKIET…", "info");
    }
    bridgeFetchJson(bridgeUrl() + "/explorer/pack-print", {
      method: "POST",
      body: JSON.stringify({
        revision_path: revPath,
        path: revPath,
        product_id: productId,
        index: index,
        dry_run: false
      })
    })
      .then(function (res) {
        var data = (res && res.data) || {};
        if (!res || res.http >= 400 || !data.ok) {
          var err = (data && data.error) || "pack_failed";
          var msg =
            (data && data.message) ||
            (err === "folders_missing"
              ? "Brak folderow: " + ((data.missing || []).join(", ") || "2 - PROJEKT / 4 - WIZKI")
              : err === "ai_project_missing"
                ? "Brak pliku .ai projektu w 2 - PROJEKT."
                : err === "login_required"
                  ? "Zaloguj się, aby utworzyc PAKIET."
                  : "Nie udalo sie utworzyc pakietu (" + err + ").");
          showToast(msg, "error");
          return;
        }
        applyPakietFileToProduct(data);
        var keepCode = null;
        try {
          var card = btn.closest(".dam-carrier-card");
          if (card && card.id) keepCode = card.id.replace(/^dam-carrier-/, "");
        } catch (_eKeep) { /* ignore */ }
        if (keepCode) state.expandedCarriers[keepCode] = true;
        renderMain();
        showToast(
          "PAKIET gotowy: " + (data.zip_name || "ZIP") + " w 3 - DRUK",
          "success"
        );
        setTimeout(function () {
          var printSec = document.querySelector(
            '.dam-file-layer[data-check-section="print"]'
          );
          if (printSec && printSec.scrollIntoView) {
            printSec.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }, 80);
      })
      .catch(function (err) {
        showToast(
          "Brak połączenia z mostem: " + (err && err.message ? err.message : err),
          "error"
        );
      })
      .finally(function () {
        btn.disabled = false;
        if (window.DamLoader && typeof window.DamLoader.done === "function") {
          window.DamLoader.done();
        }
      });
  }

  function pathActions(path) {
    if (window.DamPaths && typeof window.DamPaths.pathActionsHtml === "function") {
      return window.DamPaths.pathActionsHtml(path);
    }
    return '<button type="button" class="dam-file-copy" data-path="' + esc(path) + '" title="Kopiuj ścieżkę"><i class="uil uil-copy" aria-hidden="true"></i></button>';
  }

  function renderFileRow(f, role) {
    var ext = fileExt(f.name);
    return '<div class="dam-file-row dam-file-role--' + esc(role || "other") + '">' +
      '<i class="' + fileIcon(ext) + ' dam-file-row__icon" aria-hidden="true"></i>' +
      '<div class="dam-file-row__body">' +
        '<div class="dam-file-row__name">' + esc(f.name) + "</div>" +
        '<div class="dam-file-row__meta">' +
          esc(ext.toUpperCase()) + " " + fmtSize(f.size) +
          (f.lang ? " " + esc(String(f.lang).toUpperCase()) : "") +
          (f.mtime ? " " + fmtDate(f.mtime) : "") +
        "</div></div>" +
      pathActions(f.path) +
    "</div>";
  }

  function renderFileSection(title, files, role) {
    if (!files || !files.length) return "";
    return '<div class="dam-file-layer" data-check-section="' + esc(role || "other") + '">' +
      '<div class="dam-file-layer__title">' + esc(title) + "</div>" +
      files.map(function (f) { return renderFileRow(f, role); }).join("") +
    "</div>";
  }

  function renderChecklist(cl, rev, product) {
    var pathEsc = String((rev && rev.path) || "").replace(/"/g, "&quot;");
    var winIcon =
      window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>';

    function row(ok, label, detail, scrollSection, winPath, extraActionsHtml) {
      var cls = ok ? "dam-check-ok" : "dam-check-brak";
      var icon = ok ? "uil-check-circle" : "uil-times-circle";
      var actionsHtml = extraActionsHtml || "";
      if (ok) {
        var goPath = String(winPath || (rev && rev.path) || "").replace(/"/g, "&quot;");
        var scrollAttr = scrollSection
          ? ' data-scroll-section="' + esc(scrollSection) + '"'
          : "";
        actionsHtml =
          '<span class="dam-check-row__actions" hidden>' +
          '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-check-go dam-check-scroll"' +
          scrollAttr +
          ' title="Przewiń do plików" data-dam-tip="Przewiń do sekcji plików tego materiału w tym wariancie">' +
          '<i class="uil uil-arrow-down" aria-hidden="true"></i><span>Przejdź</span></button>' +
          '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-btn-icon-only dam-win-btn dam-check-win" data-path="' +
          goPath +
          '" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwórz folder w Eksploratorze plików Windows (wymaga mostu online)">' +
          winIcon +
          "</button></span>";
      }
      return (
        '<div class="' +
        cls +
        (ok ? " dam-check-row--interactive" : "") +
        '"' +
        (ok ? ' data-path="' + pathEsc + '" tabindex="0" role="button"' : "") +
        ">" +
        '<i class="uil ' +
        icon +
        ' dam-check-icon" aria-hidden="true"></i>' +
        '<span class="dam-check-label">' +
        esc(label) +
        (detail ? ' <span class="dam-check-detail">' + esc(detail) + "</span>" : "") +
        "</span>" +
        actionsHtml +
        "</div>"
      );
    }
    var drukDetail = cl.drukarnia ? "drukarnia: " + cl.drukarnia : "";
    var elemDetail = cl.elementsNote ? cl.elementsNote : (cl.elements ? "" : "BRAK");
    var elemActions =
      '<span class="dam-check-actions">' +
        (cl.elementsPath
          ? '<button type="button" class="dam-check-action" data-elements-open="' + esc(cl.elementsPath) +
            '" title="Otwórz folder Elementy w Eksploratorze" data-dam-tip="Otwórz folder Elementy">' +
            '<i class="uil uil-folder-open" aria-hidden="true"></i></button>'
          : "") +
        '<button type="button" class="dam-check-action" data-elements-link="' + esc(cl.revisionPath || "") +
          '" data-elements-index="' + esc(cl.revisionIndex || "") +
          '" title="Wskaż folder lub pliki Elementy" data-dam-tip="Wskaż folder / pliki Elementy">' +
          '<i class="uil uil-link" aria-hidden="true"></i></button>' +
        (cl.elementsLinked
          ? '<button type="button" class="dam-check-action dam-check-action--danger" data-elements-unlink="' +
            esc(cl.revisionPath || "") + '" data-elements-index="' + esc(cl.revisionIndex || "") +
            '" data-dam-hold-delete data-dam-label="Usuń powiazanie"' +
            ' data-dam-hint="Przytrzymaj, aby usunac powiazanie"' +
            ' title="Przytrzymaj, aby usunac powiazanie" data-dam-tip="Przytrzymaj, aby usunac reczne powiazanie">' +
            '<i class="uil uil-link-broken" aria-hidden="true"></i></button>'
          : "") +
      "</span>";
    return '<div class="dam-checklist dam-card-checklist" aria-label="Kompletność materiałów">' +
      row(cl.ai,       "Plik źródłowy projektu graficznego", "", "source", rev && rev.path) +
      row(cl.prev,     "Podgląd PDF projektu", "", "source", rev && rev.path) +
      row(cl.druk,     "Pliki do druku", drukDetail, "print", rev && rev.path) +
      row(cl.viz,      "Wizualizacje", "", "viz", rev && rev.path) +
      row(cl.elements, "Elementy / składniki", elemDetail, "elements", cl.elementsPath || (rev && rev.path), elemActions) +
      row(cl.marketing,"Materiały marketingowe", "", "marketing", rev && rev.path) +
      row(cl.karta,    "Karta wprowadzenia", "", "source", rev && rev.path) +
      row(!!cl.presentation, "Prezentacja", "", "source", rev && rev.path) +
    "</div>";
  }

  function mediaUrl(indexPath) {
    if (!indexPath) return "";
    var local = window.DamPaths ? window.DamPaths.toLocal(indexPath) : indexPath;
    return bridgeUrl() + "/media?path=" + encodeURIComponent(local);
  }

  function thumbCandidates(f) {
    var name = f.name || "";
    var stem = name.replace(/\.[^.]+$/, "");
    var list = [];
    if (f.path) list.push(mediaUrl(f.path));
    list.push(
      "data/thumbs/" + encodeURIComponent(stem + ".jpg"),
      "data/thumbs/" + encodeURIComponent(name.replace(/\.(png|tif|tiff|webp)$/i, ".jpg"))
    );
    return list;
  }

  function renderVizGroups(vizFiles) {
    var allFiles = filterVizImageFiles(vizFiles || []);
    if (!allFiles.length) return "";
    var model = buildVizStudioModel(allFiles);
    state._vizStudio = model;
    state._lightboxFiles = allFiles;

    var activeBg = state.vizBgFilter || "z-tlem";
    if (activeBg === "z-tlem" && !model.counts["z-tlem"] && model.counts["bez-tla"]) activeBg = "bez-tla";
    if (activeBg === "bez-tla" && !model.counts["bez-tla"] && model.counts["z-tlem"]) activeBg = "z-tlem";
    state.vizBgFilter = activeBg;

    var heroes = activeBg === "bez-tla" ? model.heroesBez : model.heroesZ;
    var html = '<div class="dam-viz-studio" data-viz-root="1" data-check-section="viz" style="--dam-viz-hero:' + Math.max(120, Math.min(280, state.vizScale || 140)) + 'px">' +
      '<div class="dam-viz-bg-tabs" role="tablist" aria-label="Tlo wizualizacji">' +
        '<button type="button" role="tab" class="dam-viz-bg-tab' + (activeBg === "z-tlem" ? " is-active" : "") + '" data-viz-bg="z-tlem" aria-selected="' + (activeBg === "z-tlem") + '">' +
          'Z tlem <span class="dam-viz-bg-tab__n">' + model.counts["z-tlem"] + "</span></button>" +
        '<button type="button" role="tab" class="dam-viz-bg-tab' + (activeBg === "bez-tla" ? " is-active" : "") + '" data-viz-bg="bez-tla" aria-selected="' + (activeBg === "bez-tla") + '">' +
          'Bez tla <span class="dam-viz-bg-tab__n">' + model.counts["bez-tla"] + "</span></button>" +
      "</div>";

    if (!heroes.length) {
      html += '<p class="dam-viz-empty">Brak plików w tej grupie.</p></div>';
      return html;
    }

    html += '<div class="dam-viz-hero-grid">';
    heroes.forEach(function (h) {
      var f = h.hero;
      if (!f) return;
      var cands = thumbCandidates(f);
      var sizes = {};
      h.files.forEach(function (ff) {
        var s = DL ? DL.vizSize(ff.name) : "";
        if (s) sizes[s] = (sizes[s] || 0) + 1;
      });
      var sizeChips = Object.keys(sizes).map(function (s) {
        return '<span class="dam-viz-badge dam-viz-badge--index" title="' + esc(DL ? DL.vizSizeHint(s) : s) + '">' + esc(s) + "</span>";
      }).join(" ");
      var globalIdx = allFiles.indexOf(f);
      html += '<article class="dam-viz-hero" data-persp="' + esc(h.perspective) + '">' +
        '<button type="button" class="dam-viz-hero__open" data-lightbox-idx="' + globalIdx + '" data-dam-tip="Otwórz studio podglądu">' +
          '<span class="dam-viz-hero__frame">' +
            '<img src="' + cands[0] + '" alt="' + esc(h.perspective + " - " + (f.name || "")) + '" ' +
              'data-fallbacks="' + esc(cands.slice(1).join("|")) + '" ' +
              'onerror="window.__damThumbFallback&&window.__damThumbFallback(this)">' +
            '<span class="dam-viz-mini__placeholder" hidden><i class="uil uil-image" aria-hidden="true"></i></span>' +
          "</span>" +
          '<span class="dam-viz-hero__caption">' +
            '<span class="dam-viz-hero__persp">' + esc(h.perspective) + "</span>" +
            '<span class="dam-viz-hero__meta">' + h.count + " plików " + sizeChips + "</span>" +
          "</span>" +
        "</button>" +
        '<div class="dam-viz-hero__actions">' + pathActions(f.path) + "</div>" +
      "</article>";
    });
    html += "</div>" +
      '<p class="dam-viz-hint">Jeden podgląd na widok (najwyzsza jakosc). Kliknij, aby otwórzyc studio: L/S, formaty, zoom, języki.</p>' +
    "</div>";
    return html;
  }

  function renderMarketingSection(materials) {
    var mats = (materials || []).filter(function (m) { return m.title; });
    if (!mats.length) return "";
    var html = '<div class="dam-file-layer" data-check-section="marketing"><div class="dam-file-layer__title">Materiały marketingowe</div>';
    mats.forEach(function (m) {
      html += '<div class="dam-marketing-row">' +
        '<div class="dam-marketing-row__body">' +
          '<div class="dam-marketing-row__title">' + esc(m.title) + "</div>" +
          '<div class="dam-marketing-row__path">' + esc(m.path) + "</div>" +
          '<div class="dam-marketing-row__meta">' + esc(m.type || "marketing") +
            (m.file_count ? " - " + m.file_count + " plików" : "") +
          "</div></div>" +
        pathActions(m.path) +
      "</div>";
    });
    html += '<p class="dam-marketing-hint">Sciezki lokalne po mapowaniu bazy (Ustawienia). Kopiuj lub pokaz w Eksploratorze.</p></div>';
    return html;
  }

  function renderAdminRevButtons(rev, idx) {
    if (!state.adminMode || !rev) return "";
    var cur = getRevisionStatus(rev);
    return (
      '<div class="dam-admin-rev-actions">' +
      renderLifecycleControls({
        scope: "variant",
        current: cur,
        path: rev.path || "",
        productPath: (state.product && state.product.path) || "",
        productId: (state.product && state.product.id) || "",
        index: rev.index || "",
        ridx: idx
      }) +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------ */
  /* Carrier card                                                         */
  /* ------------------------------------------------------------------ */

  function headTokenSafe(folder) {
    var head = String(folder || "").split(/\s*-\s*/)[0].trim();
    head = head.replace(/_/g, " ").toUpperCase();
    if (!head || /^\d/.test(head)) return "";
    return head;
  }

  function revisionMeta(rev, product) {
    var folder = (rev && rev.folder) || "";
    var path = (rev && rev.path) || "";
    var meta = DL && typeof DL.parseRevisionMeta === "function"
      ? DL.parseRevisionMeta(folder, path)
      : { brand: "", carrier: "", index: "", date: "", label: "" };
    if (!meta.brand && product) meta.brand = getProductBrand(product);
    if (!meta.index && rev && rev.index) meta.index = rev.index;
    if (!meta.date && rev && rev.date) meta.date = rev.date;
    if ((!meta.label || meta.carrier === "UNKNOWN") && folder) {
      meta.label = carrierLabel(meta.carrier || codeFromRev(rev), folder);
    }
    return meta;
  }

  function codeFromRev(rev) {
    if (DL && typeof DL.inferCarrierFromRevision === "function") {
      return DL.inferCarrierFromRevision(rev);
    }
    return DL ? DL.parseCarrierCode((rev && rev.folder) || "") : "UNKNOWN";
  }

  function renderIndexChip(rev, meta) {
    var idx = meta.index || rev.index || "";
    if (!idx) return "";
    if (!state.adminMode) {
      return '<span class="dam-index-chip dam-viz-badge dam-viz-badge--index" title="Indeks produktu">' + esc(idx) + "</span> ";
    }
    return (
      '<span class="dam-index-chip dam-index-chip--admin dam-viz-badge dam-viz-badge--index" ' +
        'data-dam-tip="Tryb admina: edytuj indeks i zastosuj w folderze" title="Tryb admina: edytuj indeks i zastosuj w folderze">' +
        '<input type="text" class="dam-index-edit" value="' +
        esc(idx) +
        '" readonly ' +
        'data-from-index="' +
        esc(idx) +
        '" ' +
        'data-folder="' +
        esc(rev.path || "") +
        '" ' +
        'aria-label="Indeks produktu" />' +
        '<button type="button" class="dam-index-action" data-mode="edit" ' +
        'data-dam-tip="Wlacz edycje indeksu w tym folderze" aria-label="Edytuj indeks">Edytuj</button>' +
        "</span> "
    );
  }

  function renderCarrierCard(code, currentRevs, olderRevs, product, allProductRevisions) {
    var rev = currentRevs[0]; // primary current revision
    if (!rev) return "";

    var meta = revisionMeta(rev, product);
    var resolvedCode = (code && code !== "UNKNOWN") ? code : (meta.carrier || codeFromRev(rev) || "UNKNOWN");
    var label = carrierLabel(resolvedCode, rev.folder);
    // Nigdy: "Nośnik nieokreslony · FOLIA..." - jeśli jest nosnik, pokaz tylko niego
    if (!label || /^NOSNIK/i.test(label)) {
      label = meta.label || headTokenSafe(rev.folder) || "WARIANT";
    }
    var st = getRevisionStatus(rev);
    var cardId = "dam-carrier-" + esc(resolvedCode);
    var isExpanded = !!state.expandedCarriers[resolvedCode] || !!state.expandedCarriers[code];
    var showOlder = !!state.showOlderCarriers[resolvedCode] || !!state.showOlderCarriers[code];

    // Gather viz images only (ZIP/Pakiet nigdy nie trafia do studia)
    var allViz = [];
    currentRevs.forEach(function (r) {
      allViz = allViz.concat(
        filterVizImageFiles((r.files_by_role && r.files_by_role.viz) || [])
      ).concat(filterVizImageFiles(r.wizki || []));
    });

    var cl = computeChecklist(rev, allProductRevisions, product);

    var revLangs = (rev.langs || []).slice();
    if (!revLangs.length) {
      var langSet = {};
      var fbrL = rev.files_by_role || {};
      ["source", "print", "viz", "elements"].forEach(function (rk) {
        (fbrL[rk] || []).forEach(function (f) {
          if (f && f.lang) langSet[String(f.lang).toLowerCase()] = true;
        });
      });
      (rev.wizki || []).forEach(function (f) {
        if (f && f.lang) langSet[String(f.lang).toLowerCase()] = true;
      });
      revLangs = Object.keys(langSet).sort();
    }

    // Tagi globalne 22px. Label = nazwa (bez duplikatu tagu nośnika). Indeks TYLKO w meta.
    // Toggle = DIV role=button (nested <button> rozrywa DOM i wyrzuca karty z listy).
    var tags = "";
    var hasVisibleLabel = !!(label && !/^NOSNIK/i.test(label));
    if (window.DamBadges && typeof window.DamBadges.render === "function") {
      tags = window.DamBadges.render({
        brand: meta.brand,
        // Nazwa jest w .dam-carrier-toggle__label - nie powtarzaj tego samego w chipach.
        carrier: hasVisibleLabel ? "" : resolvedCode,
        carrierLabel: hasVisibleLabel ? "" : label,
        revisionFullPath: rev.path || "",
        productId: product && product.id,
        productName: product && (product.display_name || product.name || product.title),
        langs: revLangs,
        index: "",
        compact: true,
        overflow: false,
        maxPerKind: 8,
        includeTagTiers:
          window.DamBadges && typeof window.DamBadges.getIncludeTagTiers === "function"
            ? window.DamBadges.getIncludeTagTiers()
            : ["primary"],
      });
    } else {
      if (meta.brand) {
        tags +=
          '<button type="button" class="dam-viz-badge dam-badge-tag dam-viz-badge--brand dam-tag-editable" data-tag-kind="brand" data-tag-value="' +
          esc(meta.brand) +
          '">' +
          esc(meta.brand) +
          "</button> ";
      }
      revLangs.slice(0, 6).forEach(function (l) {
        var langCode = String(l || "").toLowerCase();
        var short =
          window.DamLabels && typeof window.DamLabels.langShort === "function"
            ? window.DamLabels.langShort(langCode)
            : langCode.toUpperCase();
        if (!short) return;
        tags +=
          '<button type="button" class="dam-viz-badge dam-badge-tag dam-viz-badge--lang dam-tag-editable" data-tag-kind="lang" data-tag-value="' +
          esc(langCode) +
          '">' +
          esc(short) +
          "</button> ";
      });
    }
    // Data w meta (nie w chipach) - chipy zostaja w jednym rzedzie.
    var dateOutside = "";
    if (meta.date || rev.date) {
      dateOutside =
        '<span class="dam-date-chip dam-viz-badge" title="Data folderu">' +
        esc(meta.date || rev.date) +
        "</span>";
    }
    // Indeks: JEDEN raz w meta (readonly span albo admin Edytuj/Zastosuj). Nie w chipach.
    var indexOutside = renderIndexChip(rev, meta);
    var statusOutside = statusBadge(st, rev);
    if (rev.in_archive) {
      statusOutside =
        '<span class="dam-status-badge dam-status-badge--archive" title="Folder w - ARCHIWUM kategorii">Archiwum</span> ' +
        statusOutside;
    }

    // Extra current revisions (admin marked multiple)
    var extraCurrHtml = "";
    currentRevs.slice(1).forEach(function (r2, i) {
      var st2 = getRevisionStatus(r2);
      extraCurrHtml += '<div class="dam-carrier-extra-rev">' +
        '<span class="dam-rev-row__folder">' + esc(r2.folder) + "</span> " +
        statusBadge(st2, r2) +
        renderAdminRevButtons(r2, "extra_" + i) +
      "</div>";
    });

    // Older revisions section (widoczne gdy Pokaż wszystko lub lokalny "Pokaz starsze")
    var olderHtml = "";
    if (olderRevs.length > 0) {
      var forceOlder = !!state.showAllRevisions;
      var olderOpen = forceOlder || showOlder;
      olderHtml = '<div class="dam-carrier-older">' +
        (forceOlder
          ? '<div class="dam-show-older-label">Nieaktualne / starsze (' + olderRevs.length + ")</div>"
          : '<button type="button" class="dam-show-older-btn" data-code="' + esc(resolvedCode) + '">' +
              (showOlder ? "Ukryj starsze" : "Pokaz starsze (" + olderRevs.length + ")") +
            "</button>");
      if (olderOpen) {
        olderHtml += '<div class="dam-older-revs">';
        olderRevs.forEach(function (r, ri) {
          var ost = getRevisionStatus(r);
          olderHtml += '<div class="dam-older-rev-row">' +
            '<div class="dam-older-rev-row__main">' +
            '<span class="dam-rev-row__folder">' + esc(r.folder) + "</span>" +
            (r.index ? '<span class="dam-viz-badge dam-viz-badge--index">' + esc(r.index) + "</span>" : "") +
            statusBadge(ost, r) +
            "</div>" +
            '<div class="dam-older-rev-row__life">' +
            renderAdminRevButtons(r, "older_" + ri) +
            "</div>" +
          "</div>";
        });
        olderHtml += "</div>";
      }
      olderHtml += "</div>";
    }

    // Full detail (shown when expanded). Przy "Pokaż wszystko" lista starszych jest poza body.
    var detailHtml = "";
    if (isExpanded) {
      var fbr = rev.files_by_role || {};
      var lifeBlock = state.adminMode ? '<div class="dam-carrier-body__life">' + renderAdminRevButtons(rev, "curr") + "</div>" : "";
      detailHtml =
        lifeBlock +
        renderChecklist(cl, rev, product) +
        renderFileSection(
          "Projekt / źródło",
          filterSourceFilesForView(fbr.source),
          "source"
        ) +
        renderFileSection("Pliki do druku",   printFilesFromRevision(rev),  "print") +
        renderVizGroups(allViz) +
        renderMarketingSection(product.related_materials) +
        extraCurrHtml +
        (state.showAllRevisions ? "" : olderHtml);
    }
    var variantLifeHtml = "";

    var cardCls =
      "dam-carrier-card" +
      (isExpanded ? " is-expanded" : "") +
      (st === "aktualne" ? " dam-carrier-card--aktualne" : "");

    ensurePakietStyles();
    var pakietBtn =
      '<button type="button" class="dam-lifecycle__btn dam-lifecycle__btn--clear dam-pakiet-btn" ' +
      'data-pakiet-path="' +
      esc(rev.path || "") +
      '" data-pakiet-index="' +
      esc(rev.index || "") +
      '" data-pakiet-product="' +
      esc((product && product.id) || "") +
      '" data-dam-tip="Spakuj 2 - PROJEKT i 4 - WIZKI do ZIP w 3 - DRUK (bez SZKICE; nazwa jak plik .ai)">' +
      "PAKIET</button>";

    return (
      '<div class="' + cardCls + '" id="' + cardId + '">' +
        '<div class="dam-carrier-toggle-row" role="button" tabindex="0" data-toggle-code="' +
        esc(resolvedCode) +
        '" aria-expanded="' +
        isExpanded +
        '" aria-label="' +
        esc(label) +
        '">' +
          '<div class="dam-carrier-toggle-row__body">' +
            '<div class="dam-carrier-toggle__left">' +
              '<span class="dam-carrier-toggle__label dam-tag-editable" data-tag-kind="carrier" data-tag-value="' +
              esc(resolvedCode) +
              '" data-revision-path="' +
              esc(rev.path || "") +
              '" data-current-code="' +
              esc(resolvedCode) +
              '" data-product-id="' +
              esc((product && product.id) || "") +
              '" data-product-name="' +
              esc((product && (product.display_name || product.name || product.title)) || "") +
              '" data-dam-tip="Nośnik. Klik: filtr. Admin: Shift+klik lub podwojny klik - wybierz z listy.">' +
              esc(label) +
              "</span>" +
              '<div class="dam-carrier-toggle__chips">' +
              tags +
              "</div>" +
            "</div>" +
          "</div>" +
          '<div class="dam-carrier-head__meta">' +
            '<div class="dam-carrier-head__meta-chips">' +
            statusOutside +
            dateOutside +
            indexOutside +
            "</div>" +
            (variantLifeHtml
              ? '<div class="dam-carrier-head__meta-life">' + variantLifeHtml + "</div>"
              : "") +
          "</div>" +
          '<div class="dam-carrier-toggle-row__end">' +
            pakietBtn +
            '<div class="dam-carrier-toggle__actions" data-dam-tip="Kopiuj ścieżkę / otwórz folder w Windows">' +
              pathActions(rev.path || "") +
            "</div>" +
            '<i class="uil dam-carrier-chevron ' +
            (isExpanded ? "uil-angle-up" : "uil-angle-down") +
            '" aria-hidden="true"></i>' +
          "</div>" +
        "</div>" +
        (state.showAllRevisions && olderHtml ? olderHtml : "") +
        '<div class="dam-carrier-body"' +
        (isExpanded ? "" : " hidden") +
        ">" +
        detailHtml +
        "</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------ */
  /* Brand filter bar (legacy - nie używany, zastąpiony dam-brand-filter.js) */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Breadcrumb                                                           */
  /* ------------------------------------------------------------------ */

  function renderBreadcrumb() {
    var el = document.getElementById("damBreadcrumb");
    if (!el) return;
    var parts = ['<a href="#" class="dam-breadcrumb__link" data-nav="root">DAM</a>'];
    if (state.canonCat) {
      var title = "";
      if (DL) {
        DL.CATEGORY_CANON.forEach(function (c) { if (c.id === state.canonCat) title = c.title; });
      }
      title = title || state.canonCat;
      parts.push(state.product
        ? '<a href="#" class="dam-breadcrumb__link" data-nav="cat">' + esc(title) + "</a>"
        : "<span>" + esc(title) + "</span>"
      );
    }
    if (state.product) {
      var pName = productDisplayTitle(state.product);
      parts.push("<span>" + esc(pName) + "</span>");
    }
    el.innerHTML = parts.join(' <span class="dam-bc-sep">/</span> ');
    el.querySelectorAll("a[data-nav]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var nav = this.getAttribute("data-nav");
        if (nav === "root") {
          state.canonCat = null;
          state.product = null;
          state.navStack = [];
          state.navPos = -1;
        } else if (nav === "cat") {
          state.product = null;
          while (
            state.navPos >= 0 &&
            state.navStack[state.navPos] &&
            state.navStack[state.navPos].productId
          ) {
            state.navStack = state.navStack.slice(0, state.navPos);
            state.navPos -= 1;
          }
          navReplaceTip();
        }
        state.expandedCarriers = {};
        state.showOlderCarriers = {};
        renderAll();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sidebar                                                              */
  /* ------------------------------------------------------------------ */

  function renderSidebar() {
    var mount = document.getElementById("damFolderList");
    if (!mount || !state.fileIndex) return;

    var cats = getCanonicalCategoryList();
    var html = '<div class="dam-cat-list">';
    cats.forEach(function (c) {
      var active = state.canonCat === c.id;
      html += '<div class="dam-folder-item' + (active ? " is-active" : "") + '" data-canon-cat="' + esc(c.id) + '">' +
        '<i class="uil uil-folder dam-folder-item__icon" aria-hidden="true"></i>' +
        '<div class="dam-folder-item__text">' +
          '<div class="dam-folder-item__name">' + esc(c.title) + "</div>" +
          '<div class="dam-folder-item__count">' + c.count + " prod.</div>" +
        "</div></div>";
    });
    html += "</div>";
    mount.innerHTML = html;

    // Bind category clicks
    mount.querySelectorAll(".dam-folder-item").forEach(function (item) {
      item.addEventListener("click", function () {
        state.canonCat = this.getAttribute("data-canon-cat");
        state.product = null;
        state.expandedCarriers = {};
        state.showOlderCarriers = {};
        navPush();
        renderAll();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Main panel                                                           */
  /* ------------------------------------------------------------------ */

  function collectProductLangs(prod) {
    var set = {};
    (prod.revisions || []).forEach(function (r) {
      ((r && r.langs) || []).forEach(function (l) {
        if (l) set[String(l).toLowerCase()] = true;
      });
      var fbrL = (r && r.files_by_role) || {};
      ["source", "print", "viz", "elements"].forEach(function (rk) {
        (fbrL[rk] || []).forEach(function (f) {
          if (f && f.lang) set[String(f.lang).toLowerCase()] = true;
        });
      });
      ((r && r.wizki) || []).forEach(function (f) {
        if (f && f.lang) set[String(f.lang).toLowerCase()] = true;
      });
    });
    return Object.keys(set).sort();
  }

  function resolveProductFromIndex(p) {
    if (!p || !p.id) return p;
    var lists = [];
    if (state.fileIndex && state.fileIndex.products) lists.push(state.fileIndex.products);
    if (window._DAM_FILE_INDEX && window._DAM_FILE_INDEX.products) lists.push(window._DAM_FILE_INDEX.products);
    for (var i = 0; i < lists.length; i++) {
      var full = lists[i].find(function (x) { return x.id === p.id; });
      if (full) return full;
    }
    return p;
  }

  function productRowNavBlocked(target) {
    if (!target || !target.closest) return false;
    return !!target.closest(
      "[data-stop-nav], .dam-lifecycle, .dam-lifecycle__btn, " +
        ".dam-prod-row__actions, .dam-path-actions, .dam-file-copy, .dam-file-reveal"
    );
  }

  function bestDisplayPath(product, revision) {
    if (revision && revision.path) return revision.path;
    if (product && product.path) return product.path;
    if (revision && revision.archive_wrapper) return revision.archive_wrapper;
    var revs = (product && product.revisions) || [];
    for (var i = 0; i < revs.length; i++) {
      if (revs[i] && revs[i].path) return revs[i].path;
    }
    return "";
  }

  function enrichSearchProduct(p) {
    p = resolveProductFromIndex(p);
    if (!p || !p.id) return p;
    var pid = String(p.id);
    if (!productInFileIndex(pid)) {
      var resolved = resolveProductFromIndexStrict(pid);
      if (resolved) {
        p = Object.assign({}, resolved, p, { id: resolved.id });
        pid = p.id;
      }
    }
    var baseId = pid.replace(/-(f|x|d)$/i, "");
    if (baseId !== pid) {
      var base = resolveProductFromIndex({ id: baseId });
      if (base && base.id && productInFileIndex(base.id)) {
        p = Object.assign({}, base, p, {
          id: base.id,
          path: p.path || base.path || "",
          name: p.name || base.name,
          display_name: p.display_name || base.display_name
        });
        pid = base.id;
      }
    }
    if (!p.path) {
      var local = loadLocalStatus();
      var maps = [
        (state.lifecycleStore && state.lifecycleStore.products) || {},
        (state.statusStore && state.statusStore.products) || {},
        (local && local.products) || {}
      ];
      for (var i = 0; i < maps.length; i++) {
        var row = maps[i][pid];
        if (!row) continue;
        var rowPath = row.product_path || row.path || "";
        if (rowPath) {
          p = Object.assign({}, p, { path: rowPath });
          break;
        }
      }
    }
    if (!p.display_name && !p.name && p.path) {
      var folder = productFolderFromAnyPath(p.path);
      if (folder) {
        p = Object.assign({}, p, {
          name: folder,
          display_name: DL && DL.cleanProductDisplayName
            ? DL.cleanProductDisplayName(folder) || folder
            : folder
        });
      }
    }
    return p;
  }

  function buildProductRowHtml(p) {
    p = enrichSearchProduct(p);
    var name = enrichedProductTitle(p);
    var brand = getProductBrand(p);
    var productPath = p.path || bestDisplayPath(p, null);
    var inArchive = pathLooksLikeCategoryArchive(productPath);
    var langs = collectProductLangs(p);
    var revCount = p.revision_count || (p.revisions && p.revisions.length) || 0;
    if (!revCount && p.indexes && p.indexes.length) revCount = p.indexes.length;
    var hasVariants = revCount > 1;
    var tagsHtml = "";
    if (window.DamBadges && typeof window.DamBadges.render === "function") {
      tagsHtml = window.DamBadges.render({
        brand: brand || "",
        category: "",
        subcategory: p.subcategory_slug || "",
        subcategoryLabel: p.subcategory_label || "",
        langs: langs,
        productName: name,
        productId: p.id,
        tags: p.tags,
        multiIndex: false,
        compact: true,
        maxPerKind: 3,
        maxTotal: 7,
        showCarrierPlaceholder: false,
        includeTagTiers:
          window.DamBadges && typeof window.DamBadges.getIncludeTagTiers === "function"
            ? window.DamBadges.getIncludeTagTiers()
            : ["primary"],
      });
    } else {
      if (brand) {
        tagsHtml +=
          '<span class="dam-viz-badge dam-viz-badge--brand' +
          (brand === "GC" ? " dam-viz-badge--brand-gc" : "") +
          '">' +
          esc(brand) +
          "</span>";
      }
      if (p.subcategory_label) {
        tagsHtml +=
          '<span class="dam-viz-badge dam-viz-badge--subcat">' +
          esc(p.subcategory_label) +
          "</span>";
      }
      langs.slice(0, 4).forEach(function (l) {
        tagsHtml +=
          '<span class="dam-viz-badge dam-viz-badge--lang">' +
          esc(String(l).toUpperCase()) +
          "</span>";
      });
    }
    var variantsHtml = hasVariants
      ? '<div class="dam-prod-row__variants" data-dam-tip="' +
        esc(String(revCount)) +
        ' warianty">' +
        '<span class="dam-prod-row__count-num" aria-hidden="true">' +
        esc(String(revCount)) +
        "</span>" +
        '<span class="dam-viz-badge dam-viz-badge--variants">Warianty</span>' +
        "</div>"
      : "";
    var pStatus = getProductStatus(p);
    var lifeHtml = state.adminMode
      ? '<div class="dam-prod-row__lifecycle" data-stop-nav="1">' +
        renderLifecycleControls({
          scope: "product",
          current: pStatus,
          path: productPath || "",
          productPath: productPath || "",
          productId: p.id || ""
        }) +
        "</div>"
      : "";
    var letter = lifecycleLetterLabel(pStatus);
    var letterChip = letter
      ? '<span class="dam-lifecycle-chip dam-lifecycle-chip--' +
        letter.toLowerCase() +
        '" title="Status produktu">' +
        esc(letter) +
        "</span>"
      : "";
    var archBadge = inArchive
      ? '<span class="dam-viz-badge dam-viz-badge--archive" title="Produkt w archiwum kategorii">Archiwum</span>'
      : "";
    var actionsHtml = productPath
      ? '<div class="dam-prod-row__end" data-stop-nav="1">' +
        '<div class="dam-prod-row__actions dam-carrier-toggle__actions" data-dam-tip="Kopiuj ścieżkę / otwórz folder w Windows">' +
        pathActions(productPath) +
        "</div>" +
        '<i class="uil uil-angle-down dam-prod-row__chevron" aria-hidden="true"></i>' +
        "</div>"
      : "";
    var rowCls = "dam-prod-row";
    if (inArchive) rowCls += " dam-prod-row--archive";
    if (hasVariants) rowCls += " dam-prod-row--variants";
    if (productPath) rowCls += " dam-prod-row--actions";
    return (
      '<div class="' +
      rowCls +
      '" data-pid="' +
      esc(p.id) +
      '">' +
      '<div class="dam-prod-row__main">' +
      '<div class="dam-prod-row__title">' +
      esc(name) +
      archBadge +
      letterChip +
      "</div>" +
      (tagsHtml ? '<div class="dam-prod-row__tags">' + tagsHtml + "</div>" : "") +
      '<div class="dam-prod-row__sub">' +
      renderIndexChips(p.indexes) +
      "</div>" +
      lifeHtml +
      "</div>" +
      variantsHtml +
      actionsHtml +
      "</div>"
    );
  }

  var _explorerRevealSig = "";
  function revealExplorerModules(mount) {
    if (!window.DamGridReveal || !mount) return;
    var rows = mount.querySelectorAll(
      (window.DamGridReveal.selectors &&
        window.DamGridReveal.selectors.explorerRow) ||
        ".dam-prod-row"
    );
    if (!rows.length) return;
    /* Skip re-animating identical list (boot reconcile / prefs → double renderAll). */
    var sig =
      rows.length +
      ":" +
      (rows[0].getAttribute("data-pid") || "") +
      ":" +
      (rows[rows.length - 1].getAttribute("data-pid") || "");
    if (sig === _explorerRevealSig) return;
    _explorerRevealSig = sig;
    window.DamGridReveal.reveal(
      mount,
      window.DamGridReveal.selectors.explorerRow
    );
  }

  function bindProductRowClicks(mount) {
    mount.querySelectorAll(".dam-prod-row").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (productRowNavBlocked(e.target)) return;
        var p = resolveProductFromIndexStrict(this.getAttribute("data-pid"));
        if (!p) return;
        openProduct(p);
      });
    });
  }

  function renderSearchResultsPanel(mount) {
    var res = filterSearchResponse(state.searchHits || {}) || {};
    var products = (res.products || []).slice();
    var hits = res.hits || [];
    var q = state.searchQuery || "";
    /* Fallback: zbuduj liste produktów z hitow (gdy API odda same hits) */
    if (!products.length && hits.length) {
      var seen = {};
      hits.forEach(function (h) {
        if (!h || !h.product || !h.product.id || seen[h.product.id]) return;
        if (!productInFileIndex(h.product.id)) return;
        seen[h.product.id] = 1;
        products.push(h.product);
      });
    }
    var html =
      '<div class="dam-explorer-panel">' +
      panelHeadHtml({
        icon: "uil-search",
        kicker: "Wyszukiwanie",
        title: q,
        meta:
          products.length +
          " " +
          (products.length === 1
            ? "trafiony produkt"
            : products.length >= 2 && products.length <= 4
              ? "trafione produkty"
              : "trafionych produktów") +
          (hits.length ? " · " + hits.length + " pozycji" : "")
      });

    if (!hits.length && !products.length && !(res.suggestions && res.suggestions.length)) {
      var emptyBundle =
        window.DamEmptyMascot && typeof window.DamEmptyMascot.pick === "function"
          ? window.DamEmptyMascot.pick()
          : {
              text: "Hmm... albo literówka, albo ten produkt żyje w innej galaktyce.",
              mood: "think",
              poseUrl: "assets/img/maskotka/pose-think-q.png"
            };
      var emptyPose = String(emptyBundle.poseUrl || "").replace(/'/g, "%27");
      var emptyDesc = !state.showAllRevisions
        ? "Włącz Pokaż wszystkie, aby przeszukiwać też warianty z archiwum kategorii (- ARCHIWUM)."
        : "Brak trafień w indeksie. Kliknij Odśwież z dysku, aby zindeksować archiwum na dysku.";
      var emptyFilters = q
        ? '<ul class="dam-branding-empty__filters"><li>Szukaj: ' + esc(q) + "</li></ul>"
        : "";
      html +=
        '<div class="dam-branding-empty-wrap">' +
        '<div class="dam-empty-mascot-row" data-empty-mood="' +
        esc(emptyBundle.mood || "think") +
        '">' +
        '<div class="dam-empty-mascot-row__speak">' +
        '<div class="dam-empty-mascot-row__bubble">' +
        '<p class="dam-empty-mascot-row__bubble-text">' +
        esc(emptyBundle.text || "") +
        "</p>" +
        "</div>" +
        '<div class="dam-empty-mascot-row__mascot" aria-hidden="true" style="--dam-empty-pose:url(\'' +
        emptyPose +
        "')\">" +
        '<span class="dam-empty-mascot-row__mascot-img"></span>' +
        "</div>" +
        "</div>" +
        '<div class="dam-empty-mascot-row__card">' +
        '<div class="dam-branding-empty" role="status">' +
        '<div class="dam-branding-empty__icon" aria-hidden="true"><i class="uil uil-search-alt"></i></div>' +
        '<h3 class="dam-branding-empty__title">Brak wyników</h3>' +
        '<p class="dam-branding-empty__desc">' +
        esc(emptyDesc) +
        "</p>" +
        emptyFilters +
        '<button type="button" class="geex-btn geex-btn--primary-transparent dam-explorer-clear-filters">Wyczyść filtry</button>' +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div></div>";
      mount.innerHTML = html;
      bindPanelNav(mount);
      var clearBtn = mount.querySelector(".dam-explorer-clear-filters");
      if (clearBtn) {
        clearBtn.addEventListener("click", function () {
          clearSearchPanel();
        });
      }
      return;
    }

    if (res.message) {
      html += '<p class="dam-panel-head__meta" style="margin:0 0 8px">' + esc(res.message) + "</p>";
    }

    if (hits.length && window.DamSearch && typeof window.DamSearch.renderHitsHtml === "function") {
      html += window.DamSearch.renderHitsHtml(res, { limit: 40, panel: true });
    } else if (products.length) {
      html += '<div class="dam-prod-list">';
      var seenProd = {};
      products.forEach(function (p) {
        if (!p || !p.id) return;
        var ep = enrichSearchProduct(p);
        if (!ep || !ep.id || seenProd[ep.id]) return;
        seenProd[ep.id] = true;
        html += buildProductRowHtml(ep);
      });
      html += "</div>";
    }
    html += "</div>";
    mount.innerHTML = html;
    bindPanelNav(mount);
    if (hits.length && window.DamSearch && typeof window.DamSearch.bindHitsClick === "function") {
      window.DamSearch.bindHitsClick(mount, function (prod) {
        openProduct(prod);
      }, { clearInput: false });
    } else {
      bindProductRowClicks(mount);
    }
    bindCopyButtons(mount);
    bindLifecycleControls(mount);
    if (window.DamTooltips && typeof window.DamTooltips.refresh === "function") {
      window.DamTooltips.refresh(mount);
    }
    revealExplorerModules(mount);
  }

  function renderMain() {
    var mount = document.getElementById("damExplorerMain");
    if (!mount) return;

    if (!state.fileIndex) {
      mount.innerHTML = '<div class="dam-explorer-empty">Ładowanie indeksu dysku...</div>';
      return;
    }

    /* Live search results in panel (AJAX) - zanim welcome / kategoria */
    if (!state.product && state.searchQuery && state.searchQuery.length >= 2 && state.searchHits) {
      renderSearchResultsPanel(mount);
      return;
    }

    /* Welcome */
    if (!state.canonCat) {
      var recent = getRecentProducts().slice(0, 4);
      var recentHtml = recent.length
        ? '<div class="dam-welcome-section"><div class="dam-welcome-section__title">Ostatnio otwierane</div><div class="dam-welcome-links">' +
          recent.map(function (p) {
            var name = DL ? DL.cleanProductDisplayName(p.display_name || p.name) : (p.display_name || p.name);
            return '<button type="button" class="dam-welcome-link" data-pid="' + esc(p.id) + '">' +
              '<i class="uil uil-history" aria-hidden="true"></i> ' + esc(name) + "</button>";
          }).join("") + "</div></div>"
        : "";
      mount.innerHTML = '<div class="dam-explorer-panel dam-explorer-welcome">' +
        '<h5 class="dam-explorer-panel__title">Eksplorator DAM</h5>' +
        '<p class="dam-explorer-panel__lead">Wybierz kategorie po lewej lub wyszukaj indeks / skojarzenie (np. <strong>6300</strong>, <strong>czekolada</strong>).</p>' +
        '<div class="dam-welcome-section"><div class="dam-welcome-section__title">Szybkie linki</div>' +
        '<div class="dam-welcome-links">' +
          '<a href="visualizations.html" class="dam-welcome-link"><i class="uil uil-image" aria-hidden="true"></i> Wizualizacje</a>' +
          '<button type="button" class="dam-welcome-link" data-focus-search="1"><i class="uil uil-search" aria-hidden="true"></i> Szukaj indeksu</button>' +
        "</div></div>" + recentHtml +
        '<p class="dam-welcome-hint">' + (state.fileIndex.product_count || 0) + " produktów - wybierz kategorie z panelu bocznego.</p>" +
      "</div>";
      mount.querySelectorAll("[data-pid]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var p = (state.fileIndex.products || []).find(function (x) { return x.id === this.getAttribute("data-pid"); }.bind(this));
          if (p) openProduct(p);
        });
      });
      mount.querySelectorAll("[data-focus-search]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var inp = document.getElementById("damFileSearch");
          if (inp) { inp.focus(); inp.select(); }
        });
      });
      return;
    }

    /* Product list */
    if (!state.product) {
      var products = getProductsForCanonCat();
      var mixProds = products.filter(function (p) {
        return DL ? DL.isMixProduct(p.display_name || p.name, p.tags) : false;
      });
      var regularProds = products.filter(function (p) {
        return !(DL ? DL.isMixProduct(p.display_name || p.name, p.tags) : false);
      });

      var catTitle = "";
      if (DL) {
        DL.CATEGORY_CANON.forEach(function (c) { if (c.id === state.canonCat) catTitle = c.title; });
      }
      catTitle = catTitle || state.canonCat;

      function prodRowHtml(p) {
        return buildProductRowHtml(p);
      }

      var html = '<div class="dam-explorer-panel">' +
        panelHeadHtml({
          icon: "uil-folder",
          kicker: "Kategoria",
          title: catTitle,
          meta: products.length + " " +
            (products.length === 1 ? "produkt" : (products.length >= 2 && products.length <= 4 ? "produkty" : "produktów")) +
            " w tej kategorii",
          showAddProduct: true,
          categoryContext: { id: state.canonCat, title: catTitle }
        });

      if (mixProds.length > 0) {
        var mixOpen = !!state.expandedCarriers["__mix__"];
        html += '<div class="dam-mix-section' + (mixOpen ? " is-open" : "") + '">' +
          '<button type="button" class="dam-mix-toggle" data-toggle-mix="1">' +
            '<span>MIXY (' + mixProds.length + ")</span>" +
            '<i class="uil ' + (mixOpen ? "uil-angle-up" : "uil-angle-down") + '" aria-hidden="true"></i>' +
          "</button>" +
          '<div class="dam-mix-body"' + (mixOpen ? "" : " hidden") + ">" +
          mixProds.map(prodRowHtml).join("") +
          "</div></div>";
      }

      html += '<div class="dam-prod-list">' + regularProds.map(prodRowHtml).join("") + "</div>";
      html += "</div>";
      mount.innerHTML = html;
      bindPanelNav(mount);

      mount.querySelectorAll("[data-toggle-mix]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.expandedCarriers["__mix__"] = !state.expandedCarriers["__mix__"];
          renderMain();
        });
      });
      bindProductRowClicks(mount);
      bindCopyButtons(mount);
      bindLifecycleControls(mount);
      if (window.DamTooltips && typeof window.DamTooltips.refresh === "function") {
        window.DamTooltips.refresh(mount);
      }
      revealExplorerModules(mount);
      return;
    }

    /* Product detail - carrier list */
    var showAllOn = !!state.showAllRevisions;
    var allRevisions = revisionsForProductView(state.product, showAllOn);
    var groups = groupRevisionsByCarrier(allRevisions);
    var pName = productDisplayTitle(state.product);

    var catForProduct = "";
    if (DL) {
      DL.CATEGORY_CANON.forEach(function (c) { if (c.id === state.canonCat) catForProduct = c.title; });
    }
    catForProduct = catForProduct || state.canonCat || "Produkt";
    var visibleGroups = 0;
    groups.forEach(function (g) {
      if (pickCarrierDisplay(g.revisions, showAllOn)) visibleGroups++;
    });

    var html2 = '<div class="dam-explorer-panel">' +
      panelHeadHtml({
        icon: "uil-box",
        kicker: "Produkt · " + catForProduct,
        title: pName,
        meta: visibleGroups + " typ" + (visibleGroups === 1 ? "" : "y") +
          " nośnika" + (showAllOn ? " (wszystkie)" : " (aktualne)") +
          ". Kliknij, aby rozwinąć szczegóły.",
        showAddVariant: true
      }) +
      '<div class="dam-product-toolbar">' +
        '<div class="dam-product-toolbar__main">' +
          (state.adminMode
            ? '<div class="dam-product-toolbar__lifecycle">' +
              '<span class="dam-product-toolbar__life-label">Produkt</span>' +
              renderLifecycleControls({
                scope: "product",
                current: getProductStatus(state.product),
                path: state.product.path || "",
                productPath: state.product.path || "",
                productId: state.product.id || ""
              }) +
              "</div>"
            : "") +
        "</div>" +
      "</div>" +
      '<div class="dam-carrier-list">';

    if (groups.length === 0) {
      html2 += '<div class="dam-explorer-empty">Brak danych o nośnikach. Sprawdz indeks dysku.</div>';
    } else {
      var anyShown = false;
      groups.forEach(function (g) {
        var picked = pickCarrierDisplay(g.revisions, showAllOn);
        if (!picked) return;
        anyShown = true;
        html2 += renderCarrierCard(g.code, picked.current, picked.older, state.product, allRevisions);
      });
      if (!anyShown) {
        html2 += '<div class="dam-explorer-empty">Brak aktualnych wariantów. Włącz <strong>Pokaż wszystko</strong>, aby zobaczyć nieaktualne.</div>';
      }
    }

    html2 += "</div>" +
      '<div class="dam-add-variant-wrap">' +
        '<button type="button" class="geex-btn dam-add-variant-btn" id="damAddVariantBtn" data-dam-tip="Wskaż folder wariantu i zmapuj go do bazy">' +
          "Nie widzisz wariantu? Dodaj go</button>" +
      "</div>" +
    "</div>";
    mount.innerHTML = html2;
    bindPanelNav(mount);

    bindProductToolbar(mount);
    bindCarrierInteractions(mount);
    bindCopyButtons(mount);
    var addVariantHead = mount.querySelector("#damExplorerAddVariantHead");
    if (addVariantHead && !addVariantHead._damBound) {
      addVariantHead._damBound = true;
      addVariantHead.addEventListener("click", function () {
        openCreateVariantFromTemplates();
      });
    }
    if (window.DamTooltips && typeof window.DamTooltips.refresh === "function") {
      window.DamTooltips.refresh(mount);
    }
    revealExplorerModules(mount);
  }

  function syncExplorerCatModeUi() {
    var mount = document.getElementById("damExplorerCatMode");
    if (!mount) return;
    mount.querySelectorAll('input[name="damExplorerCatMode"]').forEach(function (inp) {
      inp.checked = inp.value === state.catMode;
    });
  }

  function setExplorerCatMode(mode) {
    var next = mode === EXPLORER_CAT_MATERIAL ? EXPLORER_CAT_MATERIAL : EXPLORER_CAT_PRODUCT;
    if (state.catMode === next) return;
    state.catMode = next;
    state.canonCat = null;
    state.product = null;
    localStorage.setItem(CAT_MODE_KEY, next);
    syncExplorerCatModeUi();
    renderSidebar();
    renderMain();
  }

  function bindGlobalExplorerFilters() {
    syncExplorerShowAllUi();
    syncExplorerCatModeUi();
    var catModeMount = document.getElementById("damExplorerCatMode");
    if (catModeMount && !catModeMount._damBound) {
      catModeMount._damBound = true;
      catModeMount.addEventListener("change", function (e) {
        var inp = e.target;
        if (!inp || inp.name !== "damExplorerCatMode") return;
        setExplorerCatMode(inp.value);
      });
    }
    var showAllEl = document.getElementById("damExplorerShowAll");
    if (showAllEl && !showAllEl._damBound) {
      showAllEl._damBound = true;
      showAllEl.addEventListener("change", function () {
        setShowAllRevisions(!!this.checked);
      });
    }
    var langSel = document.getElementById("damExplorerLangFilter");
    if (langSel && !langSel._damBound) {
      langSel._damBound = true;
      if (state.langFilter) langSel.value = state.langFilter;
      langSel.addEventListener("change", function () {
        state.langFilter = this.value || "";
        persistExplorerUiPrefs({ explorer_lang_filter: state.langFilter });
        renderExplorerGridStatus();
        if (state.searchQuery && state.searchQuery.length >= 2) {
          applySearchToPanel(state.searchQuery);
        } else {
          renderSidebar();
          renderMain();
        }
      });
    }
    if (window.DamBrandFilter && typeof window.DamBrandFilter.renderChips === "function") {
      var globalBrand = document.getElementById("damExplorerBrandMount");
      if (globalBrand) window.DamBrandFilter.renderChips(globalBrand);
    }
  }

  function onBrandFilterChange(brands) {
    state.brands = brands;
    renderExplorerGridStatus();
    renderSidebar();
    renderMain();
    if (state.searchQuery && state.searchQuery.length >= 2) {
      applySearchToPanel(state.searchQuery);
    }
  }

  function bindProductToolbar(mount) {
    mount.querySelectorAll("[data-viz-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.vizViewMode = this.getAttribute("data-viz-mode") || "tiles";
        persistExplorerUiPrefs({ explorer_viz_view: state.vizViewMode });
        renderMain();
      });
    });
    var scaleEl = document.getElementById("damVizScale");
    if (scaleEl) {
      scaleEl.addEventListener("input", function () {
        state.vizScale = parseInt(this.value, 10) || 140;
        persistExplorerUiPrefs({ explorer_viz_scale: state.vizScale });
        mount.querySelectorAll(".dam-viz-studio").forEach(function (el) {
          el.style.setProperty("--dam-viz-hero", state.vizScale + "px");
        });
      });
      scaleEl.addEventListener("change", function () {
        persistExplorerUiPrefs({ explorer_viz_scale: state.vizScale });
        renderMain();
      });
    }

    mount.querySelectorAll("[data-viz-bg]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.vizBgFilter = this.getAttribute("data-viz-bg") || "z-tlem";
        renderMain();
      });
    });

    mount.querySelectorAll("[data-lightbox-idx]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        if (e.target.closest(".dam-path-actions")) return;
        var idx = parseInt(this.getAttribute("data-lightbox-idx"), 10);
        if (!isNaN(idx)) openLightbox(idx);
      });
    });

    var addBtn = document.getElementById("damAddVariantBtn");
    if (addBtn) addBtn.addEventListener("click", openAddVariantModal);
  }

  function bindCarrierInteractions(mount) {
    // Admin: edycja indeksu nie rozwija karty
    mount.querySelectorAll(".dam-index-edit, .dam-index-action").forEach(function (el) {
      el.addEventListener("click", function (e) { e.stopPropagation(); });
    });
    mount.querySelectorAll(".dam-index-action").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var wrap = this.closest(".dam-index-chip--admin");
        var input = wrap && wrap.querySelector(".dam-index-edit");
        if (!input) return;
        if (this.getAttribute("data-mode") === "apply" || wrap.classList.contains("dam-index-chip--editing")) {
          applyIndexRename(input, wrap, this);
          return;
        }
        wrap.classList.add("dam-index-chip--editing");
        input.removeAttribute("readonly");
        input.focus();
        try { input.select(); } catch (errSel) { /* ignore */ }
        this.setAttribute("data-mode", "apply");
        this.textContent = "Zastosuj";
        this.setAttribute(
          "data-dam-tip",
          "Zastosuj zmiane indeksu we wszystkich plikach tego folderu"
        );
      });
    });
    mount.querySelectorAll(".dam-index-edit").forEach(function (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          var wrap = this.closest(".dam-index-chip--admin");
          var btn = wrap && wrap.querySelector(".dam-index-action");
          if (wrap && btn && !wrap.classList.contains("dam-index-chip--editing")) {
            wrap.classList.add("dam-index-chip--editing");
            this.removeAttribute("readonly");
            btn.setAttribute("data-mode", "apply");
            btn.textContent = "Zastosuj";
          }
          applyIndexRename(this, wrap, btn);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          var wrap2 = this.closest(".dam-index-chip--admin");
          var btn2 = wrap2 && wrap2.querySelector(".dam-index-action");
          if (!wrap2) return;
          wrap2.classList.remove("dam-index-chip--editing");
          this.value = this.getAttribute("data-from-index") || this.value;
          this.setAttribute("readonly", "readonly");
          if (btn2) {
            btn2.setAttribute("data-mode", "edit");
            btn2.textContent = "Edytuj indeks";
            btn2.setAttribute("data-dam-tip", "Wlacz edycje indeksu w tym folderze");
          }
        }
      });
    });

    // Caly pasek nośnika rozwija szczegóły (chevron / puste miejsce).
    // Sterowanie (button/a/input/tagi/edycja/F-X-D/akcje) NIE toggle'uje.
    var CARRIER_TOGGLE_IGNORE =
      "button, a, input, select, textarea, label, " +
      ".dam-tag-editable, .dam-index-chip--admin, .dam-carrier-toggle__actions, " +
      ".dam-admin-rev-actions, .dam-admin-control, .dam-lifecycle, .dam-lifecycle__btn, .dam-lifecycle-btn";
    function toggleCarrierFromEl(el) {
      var code = el.getAttribute("data-toggle-code");
      if (!code) return;
      state.expandedCarriers[code] = !state.expandedCarriers[code];
      renderMain();
      var card = document.getElementById("dam-carrier-" + code);
      if (card && state.expandedCarriers[code]) {
        setTimeout(function () {
          card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 60);
      }
    }
    mount.querySelectorAll(".dam-carrier-toggle-row[data-toggle-code]").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest(CARRIER_TOGGLE_IGNORE)) return;
        toggleCarrierFromEl(this);
      });
      row.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (e.target.closest(CARRIER_TOGGLE_IGNORE)) return;
        e.preventDefault();
        toggleCarrierFromEl(this);
      });
    });

    // Bind "show older" buttons
    mount.querySelectorAll(".dam-show-older-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var code = this.getAttribute("data-code");
        state.showOlderCarriers[code] = !state.showOlderCarriers[code];
        renderMain();
      });
    });

    bindLifecycleControls(mount);

    mount.querySelectorAll("[data-pakiet-path]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        packPrintPackage(this);
      });
    });

    // Elementy: otwórz / wskaz / odlacz
    mount.querySelectorAll("[data-elements-open]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var p = this.getAttribute("data-elements-open") || "";
        if (!p) return;
        if (window.DamPaths && typeof window.DamPaths.revealInExplorer === "function") {
          window.DamPaths.revealInExplorer(p);
        } else {
          var hdrs = { "Content-Type": "application/json" };
          try {
            if (window.DamApi && typeof DamApi.authHeaders === "function") {
              var ah = DamApi.authHeaders();
              if (ah && ah.Authorization) hdrs.Authorization = ah.Authorization;
            }
          } catch (_e) { /* ignore */ }
          fetch(bridgeUrl() + "/reveal", {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify({ path: p })
          }).catch(function () {});
        }
      });
    });
    mount.querySelectorAll("[data-elements-link]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openElementsLinkPicker(
          this.getAttribute("data-elements-link") || "",
          this.getAttribute("data-elements-index") || ""
        );
      });
    });
    mount.querySelectorAll("[data-elements-unlink]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        unlinkElementsLink(
          this.getAttribute("data-elements-unlink") || "",
          this.getAttribute("data-elements-index") || ""
        );
      });
    });
  }

  window.__damThumbFallback = function (img) {
    var raw = img.getAttribute("data-fallbacks") || "";
    var list = raw ? raw.split("|").filter(Boolean) : [];
    if (!list.length) {
      img.style.display = "none";
      var ph = img.nextElementSibling;
      if (ph) ph.hidden = false;
      return;
    }
    img.setAttribute("data-fallbacks", list.slice(1).join("|"));
    img.src = list[0];
  };

  function openLightbox(startIdx) {
    var allFiles = state._lightboxFiles || [];
    if (!allFiles.length) return;
    var model = state._vizStudio || buildVizStudioModel(allFiles);
    state._vizStudio = model;
    var items = (model.items || []).length ? model.items : allFiles.map(enrichVizFile);

    var startFile = allFiles[Math.max(0, Math.min(allFiles.length - 1, startIdx || 0))];
    var startItem = items.find(function (it) { return it.file === startFile; }) || items[0];
    if (!startItem) return;

    /* FAZA 3: jeden globalny modal (DamMediaPreview) zamiast #damLightbox */
    if (window.DamMediaPreview && typeof window.DamMediaPreview.openAsset === "function") {
      var productIndexFallback =
        (state.product && state.product.index_bases && state.product.index_bases[0]) || "";
      var parseIdx =
        window.DamMarketingId && typeof window.DamMarketingId.parseIndexFromPath === "function"
          ? window.DamMarketingId.parseIndexFromPath
          : function () { return ""; };
      var siblings = items.map(function (it, i) {
        var f = it.file || {};
        return {
          id: "viz-" + i + "-" + String(f.path || f.name || i).slice(-48),
          name: f.name || "",
          path: f.path || "",
          perspective: it.persp || "",
          persp: it.persp || "",
          size: it.size || "",
          bg: it.bg || "",
          lang: it.lang || "",
          media_type: "image",
          product_index: parseIdx(f.path) || productIndexFallback,
          mtime: f.mtime || f.modified || "",
        };
      });
      var idx = siblings.findIndex(function (s) {
        return s.path && startItem.file && s.path === startItem.file.path;
      });
      if (idx < 0) idx = 0;
      var existingLb = document.getElementById("damLightbox");
      if (existingLb) existingLb.remove();
      window.DamMediaPreview.openAsset(siblings[idx], {
        siblings: siblings,
        index: idx,
        mode: "viz-studio",
        vizStudio: { items: items, model: model },
        groupContext: { variants: siblings, linked_products: [] },
        /* pkt 6: kontekst produktu -> lustrzane "Skojarzone materiały" */
        productContext: state.product
          ? {
              id: state.product.id || "",
              name: state.product.display_name || state.product.name || "",
              index: productIndexFallback,
            }
          : null,
      });
      return;
    }

    var studio = {
      persp: startItem.persp,
      lang: startItem.lang,
      bg: startItem.bg,
      file: startItem.file,
      zoom: 1
    };

    function filteredItems() {
      return items.filter(function (it) {
        return it.persp === studio.persp &&
          it.bg === studio.bg &&
          (!studio.lang || it.lang === studio.lang);
      });
    }

    function perspList() {
      var seen = {};
      items.forEach(function (it) {
        if (it.bg === studio.bg && (!studio.lang || it.lang === studio.lang)) seen[it.persp] = true;
      });
      return VIZ_PERSP_ORDER.filter(function (p) { return seen[p]; });
    }

    function expectedFormatsForBg(bg) {
      return bg === "bez-tla" ? ["PNG"] : ["JPG", "JPEG"];
    }

    function findItem(persp, bg, lang, size, ext) {
      var e = String(ext || "").toUpperCase();
      return items.find(function (it) {
        return it.persp === persp &&
          it.bg === bg &&
          (!lang || it.lang === lang) &&
          it.size === size &&
          String(it.ext || "").toUpperCase() === e;
      });
    }

    function langList() {
      var seen = {};
      items.forEach(function (it) {
        if (it.bg === studio.bg && it.persp === studio.persp) seen[it.lang] = true;
      });
      return Object.keys(seen).sort();
    }

    function ensureSelection() {
      var list = filteredItems();
      if (!list.length) {
        var any = items.filter(function (it) { return it.persp === studio.persp && it.bg === studio.bg; });
        if (any.length) studio.lang = any[0].lang;
        list = filteredItems();
      }
      if (!list.length) return;
      var still = list.some(function (it) { return it.file === studio.file; });
      if (!still) studio.file = pickHeroFile(list.map(function (it) { return it.file; })) || list[0].file;
    }

    function metaUrl(indexPath) {
      var local = window.DamPaths ? window.DamPaths.toLocal(indexPath) : indexPath;
      return bridgeUrl() + "/media-meta?path=" + encodeURIComponent(local);
    }

    function loadMeta(f) {
      var box = document.getElementById("damLbMeta");
      if (!box || !f) return;
      box.innerHTML = '<span class="dam-lb-meta__loading">Ładowanie metadanych…</span>';
      var sizeKnown = f.size ? fmtSize(f.size) : "";
      fetch(metaUrl(f.path), { headers: authHeaders() }).then(function (r) { return r.json(); }).then(function (data) {
        if (!data || !data.ok) {
          box.innerHTML = (sizeKnown ? '<div><strong>Rozmiar</strong> ' + esc(sizeKnown) + "</div>" : "") +
            '<div class="dam-lb-meta__muted">Metadane niedostępne - uruchom aplikację DAM.</div>';
          return;
        }
        var dims = (data.width && data.height) ? (data.width + " x " + data.height + " px") : "-";
        var cs = data.colorspace || data.mode || "-";
        var weight = data.size_bytes ? fmtSize(data.size_bytes) : sizeKnown || "-";
        var dpi = data.dpi ? (Array.isArray(data.dpi) ? data.dpi.join(" x ") : String(data.dpi)) : "";
        box.innerHTML =
          '<div><strong>Rozdzielczosc</strong> ' + esc(dims) + "</div>" +
          '<div><strong>Waga</strong> ' + esc(weight) + "</div>" +
          '<div><strong>Przestrzen</strong> ' + esc(cs) +
            (data.has_alpha ? ' <span class="dam-viz-badge dam-viz-badge--brand">alpha</span>' : "") +
          "</div>" +
          (dpi ? '<div><strong>DPI</strong> ' + esc(dpi) + "</div>" : "") +
          '<div><strong>Format</strong> ' + esc((data.format || fileExt(f.name)).toUpperCase()) + "</div>";
      }).catch(function () {
        box.innerHTML = sizeKnown
          ? '<div><strong>Rozmiar</strong> ' + esc(sizeKnown) + '</div><div class="dam-lb-meta__muted">Bridge offline</div>'
          : '<div class="dam-lb-meta__muted">Bridge offline</div>';
      });
    }

    function paint() {
      ensureSelection();
      var overlay = document.getElementById("damLightbox");
      if (!overlay) return;
      var f = studio.file;
      var cands = thumbCandidates(f);
      var img = overlay.querySelector(".dam-lightbox__img");
      if (img) {
        img.onerror = function () { window.__damThumbFallback(img); };
        img.setAttribute("data-fallbacks", cands.slice(1).join("|"));
        img.src = mediaUrl(f.path) || cands[0];
        img.alt = f.name || "";
        img.style.transform = "scale(" + studio.zoom + ")";
        var frame = overlay.querySelector(".dam-lightbox__frame");
        if (frame) {
          if (studio.zoom > 1.01) frame.classList.add("is-zoomed");
          else frame.classList.remove("is-zoomed");
        }
      }
      var title = overlay.querySelector(".dam-lightbox__title");
      if (title) {
        title.textContent = f.name || "";
        title.setAttribute("title", f.name || "");
      }

      var bgBox = document.getElementById("damLbBg");
      if (bgBox) {
        var bgOpts = [
          { id: "bez-tla", label: "Bez tla", sub: "PNG", icon: "uil-image-v" },
          { id: "z-tlem", label: "Z tlem", sub: "JPG", icon: "uil-square-full" }
        ].filter(function (o) {
          return items.some(function (it) { return it.bg === o.id; });
        });
        bgBox.innerHTML = bgOpts.map(function (o) {
          return '<button type="button" class="dam-lb-chip dam-lb-chip--bg' + (o.id === studio.bg ? " is-active" : "") +
            '" data-lb-bg="' + esc(o.id) + '" title="' + esc(o.id === "bez-tla" ? "PNG - przezroczyste tlo" : "JPG - biale tlo") + '">' +
            '<span class="dam-lb-chip__label">' + esc(o.label) + "</span>" +
            '<span class="dam-lb-chip__sub">' + esc(o.sub) + "</span></button>";
        }).join("");
      }

      var persps = perspList();
      var perspBox = document.getElementById("damLbPersp");
      if (perspBox) {
        perspBox.innerHTML = persps.map(function (p) {
          var hint = DL && DL.vizPerspHint ? DL.vizPerspHint(p) : p;
          return '<button type="button" class="dam-lb-persp' + (p === studio.persp ? " is-active" : "") +
            '" data-lb-persp="' + esc(p) + '" title="' + esc(hint) + '">' +
            '<span class="dam-lb-persp__code">' + esc(p) + "</span>" +
            '<span class="dam-lb-persp__hint">' + esc(hint) + "</span></button>";
        }).join("");
      }

      var langs = langList();
      var langWrap = document.getElementById("damLbLangWrap");
      var langBox = document.getElementById("damLbLang");
      if (langWrap && langBox) {
        if (langs.length > 1) {
          langWrap.hidden = false;
          langBox.innerHTML = langs.map(function (l) {
            return '<button type="button" class="dam-lb-chip' + (l === studio.lang ? " is-active" : "") + '" data-lb-lang="' + esc(l) + '">' + esc(l.toUpperCase()) + "</button>";
          }).join("");
        } else {
          langWrap.hidden = true;
        }
      }

      var variants = filteredItems();
      var presentKeys = {};
      variants.forEach(function (it) {
        presentKeys[(it.size || "?") + "|" + (it.ext || "")] = it;
      });
      var extsForBg = expectedFormatsForBg(studio.bg);
      var sizeRows = [];
      VIZ_SIZE_CATALOG.forEach(function (sz) {
        extsForBg.forEach(function (extRaw) {
          var ext = String(extRaw).toUpperCase();
          var key = sz + "|" + ext;
          if (presentKeys[key]) {
            sizeRows.push({ kind: "file", item: presentKeys[key], size: sz, ext: ext });
            return;
          }
          var altExt = ext === "JPG" ? "JPEG" : "";
          if (altExt && presentKeys[sz + "|" + altExt]) {
            sizeRows.push({ kind: "file", item: presentKeys[sz + "|" + altExt], size: sz, ext: altExt });
            return;
          }
          sizeRows.push({ kind: "missing", size: sz, ext: ext });
        });
      });
      variants.forEach(function (it) {
        var k = (it.size || "?") + "|" + (it.ext || "");
        if (!sizeRows.some(function (r) { return r.kind === "file" && r.item === it; })) {
          sizeRows.push({ kind: "file", item: it, size: it.size, ext: it.ext });
        }
      });
      var varBox = document.getElementById("damLbVariants");
      if (varBox) {
        varBox.innerHTML = sizeRows.length
          ? '<div class="dam-lb-size-grid" role="listbox" aria-label="Rozmiar i format">' +
            sizeRows.map(function (row) {
              if (row.kind === "missing") {
                var sizeH = DL ? DL.vizSizeHint(row.size) : row.size;
                var fmtH = DL ? DL.vizFormatHint(row.ext) : row.ext;
                var tag = DL && DL.vizSizeTag ? DL.vizSizeTag(row.size) : "";
                return '<div class="dam-lb-size dam-lb-size--missing" role="option" aria-disabled="true" title="Brak pliku: ' +
                  esc(row.size + " " + row.ext) + " - " + esc(sizeH) + '">' +
                  '<span class="dam-lb-size__code">' + esc(row.size || "?") + "</span>" +
                  (tag ? '<span class="dam-lb-size__tag">' + esc(tag) + "</span>" : "") +
                  '<span class="dam-lb-size__ext">' + esc(row.ext || "") + "</span>" +
                  '<span class="dam-lb-size__miss">Brak</span></div>';
              }
              var it = row.item;
              var active = it.file === studio.file;
              var sizeH = DL ? DL.vizSizeHint(it.size) : (it.size || "Wariant");
              var fmtH = DL ? DL.vizFormatHint(it.ext) : it.ext;
              var tag = DL && DL.vizSizeTag ? DL.vizSizeTag(it.size) : "";
              var tip = sizeH + " - " + fmtH + " - " + (it.file.name || "");
              return '<button type="button" role="option" class="dam-lb-size' + (active ? " is-active" : "") +
                '" data-lb-file="' + esc(it.file.path) + '" title="' + esc(tip) + '" aria-selected="' + active + '">' +
                '<span class="dam-lb-size__code">' + esc(it.size || "?") + "</span>" +
                (tag ? '<span class="dam-lb-size__tag dam-lb-size__tag--' + esc(String(it.size || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")) + '">' + esc(tag) + "</span>" : "") +
                '<span class="dam-lb-size__ext">' + esc(it.ext || "") + "</span></button>";
            }).join("") +
            "</div>"
          : '<p class="dam-lb-meta__muted">Brak wariantow dla tego widoku.</p>';
      }

      var revealBtn = document.getElementById("damLbRevealFile");
      if (revealBtn) {
        revealBtn.disabled = !f || !f.path;
        revealBtn.setAttribute("data-path", f && f.path ? f.path : "");
      }
      var copyBtn = document.getElementById("damLbCopyPath");
      if (copyBtn) copyBtn.setAttribute("data-path", f && f.path ? f.path : "");

      var zoomLabel = document.getElementById("damLbZoomLabel");
      if (zoomLabel) zoomLabel.textContent = Math.round(studio.zoom * 100) + "%";

      var prev = overlay.querySelector("[data-lb-prev]");
      var next = overlay.querySelector("[data-lb-next]");
      var pi = persps.indexOf(studio.persp);
      if (prev) prev.disabled = pi <= 0;
      if (next) next.disabled = pi < 0 || pi >= persps.length - 1;

      loadMeta(f);
    }

    var existing = document.getElementById("damLightbox");
    if (existing) existing.remove();

    var html =
      '<div class="dam-lightbox dam-lightbox--studio dam-lightbox--studio-v2" id="damLightbox" role="dialog" aria-modal="true" aria-label="Studio podglądu wizualizacji">' +
        '<div class="dam-lightbox__box">' +
          '<button type="button" class="dam-lightbox__close" data-lb-close aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
          '<div class="dam-lightbox__layout">' +
            '<aside class="dam-lightbox__side" aria-label="Szukaj wizualizacji">' +
              '<p class="dam-lb-lead">Wybierz perspektywe, tlo i rozmiar. Brakujace pliki oznaczone na czerwono.</p>' +
              '<div class="dam-lb-filters">' +
                '<div class="dam-lb-section">' +
                  '<div class="dam-lb-section__title">Tlo / format</div>' +
                  '<div class="dam-lb-chips dam-lb-chips--bg" id="damLbBg"></div>' +
                "</div>" +
                '<div class="dam-lb-section">' +
                  '<div class="dam-lb-section__title">Perspektywa</div>' +
                  '<div class="dam-lb-persp-grid" id="damLbPersp"></div>' +
                "</div>" +
                '<div class="dam-lb-section" id="damLbLangWrap" hidden>' +
                  '<div class="dam-lb-section__title">Język</div>' +
                  '<div class="dam-lb-chips" id="damLbLang"></div>' +
                "</div>" +
              "</div>" +
              '<div class="dam-lb-section dam-lb-section--sizes">' +
                '<div class="dam-lb-section__title">Rozmiar i jakosc</div>' +
                '<div class="dam-lb-variants" id="damLbVariants"></div>' +
              "</div>" +
              '<details class="dam-lb-details">' +
                '<summary class="dam-lb-details__sum">Metadane techniczne</summary>' +
                '<div class="dam-lb-meta" id="damLbMeta"></div>' +
              "</details>" +
            "</aside>" +
            '<div class="dam-lightbox__main">' +
              '<div class="dam-lightbox__thumb">' +
                '<div class="dam-lightbox__toolbar dam-lightbox__toolbar--float" role="group" aria-label="Zoom i nawigacja">' +
                  '<button type="button" class="dam-lb-tool" data-lb-prev aria-label="Poprzedni widok"><i class="uil uil-angle-left"></i></button>' +
                  '<button type="button" class="dam-lb-tool" data-lb-zoom-out aria-label="Pomniejsz"><i class="uil uil-search-minus"></i></button>' +
                  '<span class="dam-lb-zoom-label" id="damLbZoomLabel">100%</span>' +
                  '<button type="button" class="dam-lb-tool" data-lb-zoom-in aria-label="Powieksz"><i class="uil uil-search-plus"></i></button>' +
                  '<button type="button" class="dam-lb-tool" data-lb-zoom-reset aria-label="Reset 100%"><i class="uil uil-search"></i></button>' +
                  '<button type="button" class="dam-lb-tool" data-lb-next aria-label="Nastepny widok"><i class="uil uil-angle-right"></i></button>' +
                "</div>" +
                '<div class="dam-lightbox__frame">' +
                  '<img class="dam-lightbox__img" alt="">' +
                "</div>" +
              "</div>" +
              '<div class="dam-lightbox__footer-bar">' +
                '<div class="dam-lightbox__title" title=""></div>' +
                '<div class="dam-lightbox__cta">' +
                  '<button type="button" class="geex-btn geex-btn--primary geex-btn--sm dam-lb-cta-reveal" id="damLbRevealFile" data-dam-tip="Otwórz folder w Windows i zaznacz ten plik">' +
                    '<i class="uil uil-folder-open" aria-hidden="true"></i><span>Pokaz w Explorerze</span></button>' +
                  '<button type="button" class="geex-btn geex-btn--sm dam-lb-cta-copy" id="damLbCopyPath" data-dam-tip="Kopiuj ścieżkę pliku">' +
                    '<i class="uil uil-copy" aria-hidden="true"></i><span>Kopiuj ścieżkę</span></button>' +
                "</div>" +
              "</div>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>";
    document.body.insertAdjacentHTML("beforeend", html);
    var overlay = document.getElementById("damLightbox");

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function stepPersp(dir) {
      var persps = perspList();
      var i = persps.indexOf(studio.persp);
      var n = i + dir;
      if (n < 0 || n >= persps.length) return;
      studio.persp = persps[n];
      studio.zoom = 1;
      paint();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") stepPersp(-1);
      if (e.key === "ArrowRight") stepPersp(1);
      if (e.key === "+" || e.key === "=") { studio.zoom = Math.min(3, studio.zoom + 0.15); paint(); }
      if (e.key === "-") { studio.zoom = Math.max(0.4, studio.zoom - 0.15); paint(); }
    }

    overlay.querySelector("[data-lb-close]").addEventListener("click", close);
    overlay.querySelector("[data-lb-prev]").addEventListener("click", function () { stepPersp(-1); });
    overlay.querySelector("[data-lb-next]").addEventListener("click", function () { stepPersp(1); });
    overlay.querySelector("[data-lb-zoom-in]").addEventListener("click", function () {
      studio.zoom = Math.min(3, +(studio.zoom + 0.2).toFixed(2));
      paint();
    });
    overlay.querySelector("[data-lb-zoom-out]").addEventListener("click", function () {
      studio.zoom = Math.max(0.4, +(studio.zoom - 0.2).toFixed(2));
      paint();
    });
    var zoomResetBtn = overlay.querySelector("[data-lb-zoom-reset]");
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener("click", function () {
        studio.zoom = 1;
        paint();
      });
    }
    var revealBtnEl = document.getElementById("damLbRevealFile");
    if (revealBtnEl) {
      revealBtnEl.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var p = this.getAttribute("data-path") || (studio.file && studio.file.path) || "";
        if (p && window.DamPaths && window.DamPaths.revealInExplorer) {
          window.DamPaths.revealInExplorer(p);
        }
      });
    }
    var copyBtnEl = document.getElementById("damLbCopyPath");
    if (copyBtnEl) {
      copyBtnEl.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var p = this.getAttribute("data-path") || (studio.file && studio.file.path) || "";
        if (p && window.DamPaths && window.DamPaths.copyPath) {
          window.DamPaths.copyPath(p);
        }
      });
    }
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.classList.contains("dam-lightbox__box")) close();
      var bgBtn = e.target.closest("[data-lb-bg]");
      if (bgBtn) {
        studio.bg = bgBtn.getAttribute("data-lb-bg") || "z-tlem";
        studio.zoom = 1;
        var nextPersps = perspList();
        if (nextPersps.indexOf(studio.persp) < 0 && nextPersps.length) studio.persp = nextPersps[0];
        paint();
        return;
      }
      var perspBtn = e.target.closest("[data-lb-persp]");
      if (perspBtn) {
        studio.persp = perspBtn.getAttribute("data-lb-persp");
        studio.zoom = 1;
        paint();
        return;
      }
      var langBtn = e.target.closest("[data-lb-lang]");
      if (langBtn) {
        studio.lang = langBtn.getAttribute("data-lb-lang");
        studio.zoom = 1;
        paint();
        return;
      }
      var varBtn = e.target.closest("[data-lb-file]");
      if (varBtn) {
        var path = varBtn.getAttribute("data-lb-file");
        var hit = items.find(function (it) { return it.file.path === path; });
        if (hit) { studio.file = hit.file; studio.zoom = 1; paint(); }
      }
    });
    document.addEventListener("keydown", onKey);
    paint();
  }

  function openCreateVariantFromTemplates() {
    if (!state.product) return;
    if (!window.DamExplorerAddProduct || typeof window.DamExplorerAddProduct.open !== "function") {
      showToast("Moduł tworzenia produktu niedostępny - odśwież stronę.");
      return;
    }
    try {
      window.DamExplorerAddProduct.open({
        mode: "add-variant",
        productPath: state.product.path || "",
        categoryContext: { id: state.canonCat || "", title: "" }
      });
    } catch (eOpen) {
      showToast(
        "Nie udało się otworzyć Dodaj wariant: " + String((eOpen && eOpen.message) || eOpen),
        "error"
      );
    }
  }

  function openAddVariantModal() {
    if (!state.product) return;
    if (!window.DamFolderPicker || typeof window.DamFolderPicker.open !== "function") {
      showToast("DamFolderPicker niedostępny - odśwież stronę (cache).");
      return;
    }
    var existing = document.getElementById("damAddVariantModal");
    if (existing) existing.remove();

    var carriers = Object.keys((DL && DL.CARRIER_LABELS) || {}).concat(["UNKNOWN"]);
    var opts = carriers.map(function (c) {
      var lab = DL ? DL.carrierLabel(c) : c;
      return '<option value="' + esc(c) + '">' + esc(lab) + " (" + esc(c) + ")</option>";
    }).join("");

    var html =
      '<div class="dam-basepath-overlay" id="damAddVariantModal">' +
        '<div class="dam-basepath-box" role="dialog" aria-modal="true" aria-labelledby="damAddVariantTitle">' +
          '<button type="button" class="dam-modal-x" id="damAddVariantClose" aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
          '<h3 id="damAddVariantTitle">Mapuj wariant z dysku</h3>' +
          '<p class="dam-basepath-lead">Wskaż folder wariantu (COMBO lub Eksplorator Windows). Określ typ nośnika i status. Rynek (DK/GC) rozpoznamy ze ścieżki.</p>' +
          '<label class="dam-basepath-label" for="damAddVariantPath">Sciezka folderu</label>' +
          '<div class="dam-add-variant-path-row" style="display:flex;gap:8px;align-items:center">' +
            '<input type="text" id="damAddVariantPath" class="dam-basepath-input" placeholder="Wklej ścieżkę lub wybierz folder…" style="flex:1" autocomplete="off" spellcheck="false">' +
            '<button type="button" class="geex-btn geex-btn--primary" id="damAddVariantPick">Wybierz folder</button>' +
          "</div>" +
          '<label class="dam-basepath-label" for="damAddVariantCarrier">Typ nosnika</label>' +
          '<select id="damAddVariantCarrier" class="dam-basepath-input">' + opts + "</select>" +
          '<label class="dam-basepath-label" for="damAddVariantStatus">Status</label>' +
          '<select id="damAddVariantStatus" class="dam-basepath-input">' +
            '<option value="aktualne">Aktualne</option>' +
            '<option value="nieaktualne">Nieaktualne</option>' +
            '<option value="starsza">Starsze</option>' +
          "</select>" +
          '<p id="damAddVariantMarket" class="dam-basepath-msg" hidden></p>' +
          '<div class="dam-basepath-actions dam-dialog-actions">' +
            '<button type="button" class="geex-btn" id="damAddVariantCancel">Anuluj</button>' +
            '<span class="dam-dialog-actions__spacer" aria-hidden="true"></span>' +
            '<button type="button" class="geex-btn geex-btn--primary" id="damAddVariantSave">Zapisz do bazy</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("damAddVariantModal");

    function updateMarket() {
      var path = (document.getElementById("damAddVariantPath").value || "").trim();
      var market = DL && DL.detectMarketFromPath ? DL.detectMarketFromPath(path) : "";
      var msg = document.getElementById("damAddVariantMarket");
      if (!msg) return;
      if (!path) { msg.hidden = true; return; }
      msg.hidden = false;
      msg.className = "dam-basepath-msg is-ok";
      msg.textContent = market ? ("Rozpoznany rynek: " + market + (market === "DK" ? " (Polska)" : " (Eksport)")) : "Nie rozpoznano rynku ze ścieżki - uzupełnij ręcznie w notatce.";
      msg.dataset.market = market || "";
    }

    function openComboPick() {
      var start = (state.product && state.product.path) || "X:\\";
      window.DamFolderPicker.open({
        startDir: start,
        mode: "folder",
        title: "Wybierz folder wariantu",
        showWindowsButton: true,
        onPicked: function (picked) {
          var path = picked && picked.path;
          if (!path) return;
          var input = document.getElementById("damAddVariantPath");
          if (input) input.value = path;
          updateMarket();
        }
      });
    }

    document.getElementById("damAddVariantPath").addEventListener("input", updateMarket);
    document.getElementById("damAddVariantPick").addEventListener("click", openComboPick);
    document.getElementById("damAddVariantCancel").addEventListener("click", function () { modal.remove(); });
    document.getElementById("damAddVariantClose").addEventListener("click", function () { modal.remove(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") { modal.remove(); document.removeEventListener("keydown", onEsc); }
    });
    openComboPick();
    document.getElementById("damAddVariantSave").addEventListener("click", function () {
      var pathRaw = (document.getElementById("damAddVariantPath").value || "").trim();
      var carrier = document.getElementById("damAddVariantCarrier").value;
      var status = document.getElementById("damAddVariantStatus").value;
      var market = (document.getElementById("damAddVariantMarket").dataset.market) || "";
      if (!pathRaw) { showToast("Wklej ścieżkę lub wybierz folder wariantu"); return; }
      if (!carrier || carrier === "UNKNOWN") {
        showToast("Wybierz konkretny typ nosnika - nie zapisujemy UNKNOWN");
        return;
      }
      var canonPath = pathRaw.replace(/\\/g, "/");
      if (window.DamPaths && window.DamPaths.getBasePath && window.DamPaths.getIndexBase) {
        var base = window.DamPaths.getBasePath().replace(/\\/g, "/").replace(/\/+$/, "");
        var idxBase = window.DamPaths.getIndexBase();
        var n = canonPath.replace(/\/+$/, "");
        if (base && n.toLowerCase().indexOf(base.toLowerCase()) === 0) {
          canonPath = idxBase + n.slice(base.length);
        }
      }
      var entry = {
        carrier: carrier,
        status: status,
        market: market,
        note: "Dodane recznie dla " + (state.product.id || ""),
        product_id: state.product.id || "",
        folder: canonPath.split("/").pop()
      };
      saveCarrierOverride(canonPath, entry).then(function () {
        showToast("Zapisano mapowanie nosnika");
        modal.remove();
        return loadCarrierOverrides().then(function () { renderMain(); });
      }).catch(function (err) {
        showToast("Blad zapisu: " + (err && err.message ? err.message : "bridge"));
      });
    });
  }

  function resetIndexChipEdit(wrap, btn, input) {
    if (!wrap || !input) return;
    wrap.classList.remove("dam-index-chip--editing");
    input.value = input.getAttribute("data-from-index") || input.value;
    input.setAttribute("readonly", "readonly");
    if (btn) {
      btn.setAttribute("data-mode", "edit");
      btn.textContent = "Edytuj indeks";
      btn.setAttribute("data-dam-tip", "Wlacz edycje indeksu w tym folderze");
    }
  }

  function applyIndexRename(input, wrap, btn) {
    if (!state.adminMode) {
      showToast("Wlacz tryb admina, aby edytowac indeks");
      return;
    }
    var fromIndex = String(input.getAttribute("data-from-index") || "").trim();
    var toIndex = String(input.value || "").trim();
    var folder = String(input.getAttribute("data-folder") || "").trim();
    if (!folder) {
      showToast("Brak ścieżki folderu wariantu");
      return;
    }
    if (!fromIndex || !toIndex) {
      showToast("Podaj poprawny indeks");
      return;
    }
    if (fromIndex === toIndex) {
      showToast("Indeks bez zmian");
      return;
    }
    if (!/^(FOL\d+|\d{5,9})(\.\d{2})?$/i.test(toIndex)) {
      showToast("Niepoprawny format indeksu (np. 6300450 lub 6300450.00)");
      return;
    }
    var msg = "Zmienic indeks \"" + fromIndex + "\" -> \"" + toIndex +
      "\" we wszystkich nazwach plików i podfolderow wewnatrz:\n\n" + folder +
      "\n\nTo realna zmiana na dysku. Kontynuowac?";
    if (!window.confirm(msg)) return;

    showToast("Zmieniam indeks w folderze…");
    fetch(bridgeUrl() + "/rename-index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder: folder,
        from_index: fromIndex,
        to_index: toIndex,
        dry_run: false
      })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, data: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.data || !res.data.ok) {
          showToast("Błąd: " + ((res.data && res.data.error) || "rename-index"));
          return;
        }
        var n = (res.data.renamed || []).length;
        if (window.DamPaths && window.DamPaths.logAction) {
          window.DamPaths.logAction("rename_index", {
            path: folder,
            detail: fromIndex + " -> " + toIndex + " (" + n + ")"
          });
        }
        showToast("Pomyślnie zmieniono indeks (" + n + ")", "success");
        return refreshIndex({ silent: true, reopenProductId: state.product && state.product.id }).then(function () {
          if (window.DamTagEdit && typeof window.DamTagEdit.refreshChangeLogBar === "function") {
            window.DamTagEdit.refreshChangeLogBar();
          }
          resetIndexChipEdit(wrap, btn, input);
        });
      })
      .catch(function (err) {
        showToast("Bridge niedostępny: " + (err && err.message ? err.message : "fetch"));
      });
  }

  function saveCarrierOverride(pathKey, entry) {
    if (!state.carrierOverrides.overrides) state.carrierOverrides.overrides = {};
    state.carrierOverrides.overrides[pathKey] = entry;
    if (entry.folder && /\d{7}/.test(entry.folder)) {
      var m = String(entry.folder).match(/(\d{7}(?:\.\d+)?)/);
      if (m) state.carrierOverrides.overrides[m[1]] = entry;
    }
    state.carrierOverrides.updated_at = new Date().toISOString();
    try {
      localStorage.setItem("dam_carrier_overrides", JSON.stringify(state.carrierOverrides));
    } catch (e) { /* ignore */ }
    if (window.DamPaths && window.DamPaths.logAction) {
      window.DamPaths.logAction("carrier_override", { path: pathKey, detail: entry.carrier + " / " + entry.status });
    }
    return fetch(bridgeUrl() + "/carrier-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathKey, entry: entry })
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).catch(function () {
      // lokalny zapis wystarczy offline
      return { ok: true, offline: true };
    });
  }

  function loadCarrierOverrides() {
    return fetch("data/carrier-overrides.json?v=" + Date.now())
      .then(function (r) { return r.ok ? r.json() : { overrides: {} }; })
      .catch(function () { return { overrides: {} }; })
      .then(function (fileData) {
        var local = {};
        try { local = JSON.parse(localStorage.getItem("dam_carrier_overrides") || "{}"); } catch (e) { local = {}; }
        var merged = { overrides: Object.assign({}, (fileData && fileData.overrides) || {}, (local && local.overrides) || {}) };
        state.carrierOverrides = merged;
      });
  }

  function loadElementsLinks() {
    return fetch("data/elements-overrides.json?v=" + Date.now())
      .then(function (r) { return r.ok ? r.json() : { links: {} }; })
      .catch(function () { return { links: {} }; })
      .then(function (fileData) {
        var local = {};
        try { local = JSON.parse(localStorage.getItem("dam_elements_links") || "{}"); } catch (e) { local = {}; }
        state.elementsLinks = {
          links: Object.assign({}, (fileData && fileData.links) || {}, (local && local.links) || {}),
          updated_at: (fileData && fileData.updated_at) || (local && local.updated_at) || ""
        };
      });
  }

  function persistElementsLinksLocal() {
    try {
      localStorage.setItem("dam_elements_links", JSON.stringify(state.elementsLinks));
    } catch (e) { /* ignore */ }
  }

  function saveElementsLink(revPath, index, targetPath) {
    var key = normPathKey(revPath);
    var payload = {
      action: "link",
      revision_path: key,
      index: index || "",
      target_path: targetPath,
      product_id: (state.product && (state.product.id || state.product.product_id)) || "",
      linked_by: isAdminRole() ? "admin" : "user"
    };
    return fetch(bridgeUrl() + "/elements-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json().then(function (j) { return { httpOk: r.ok, data: j }; }); })
      .then(function (res) {
        var entry = (res.data && res.data.entry) || {
          path: targetPath,
          folder: targetPath,
          kind: "folder",
          file_count: 0,
          revision_path: key,
          index: index || "",
          linked_at: new Date().toISOString()
        };
        if (!state.elementsLinks.links) state.elementsLinks.links = {};
        state.elementsLinks.links[key] = entry;
        if (index) state.elementsLinks.links[index] = entry;
        state.elementsLinks.updated_at = new Date().toISOString();
        persistElementsLinksLocal();
        if (window.DamPaths && window.DamPaths.logAction) {
          window.DamPaths.logAction("elements_link", { path: key, detail: targetPath });
        }
        if (!res.httpOk || !res.data || !res.data.ok) {
          showToast("Zapisano lokalnie (bridge: " + ((res.data && res.data.error) || "offline") + ")");
        } else {
          var n = entry.file_count || 0;
          showToast("Powiazano Elementy" + (n ? " (" + n + " pl.)" : ""));
        }
        renderMain();
        return entry;
      })
      .catch(function (err) {
        if (!state.elementsLinks.links) state.elementsLinks.links = {};
        var offline = {
          path: targetPath,
          folder: targetPath,
          kind: "folder",
          file_count: 0,
          revision_path: key,
          index: index || "",
          linked_at: new Date().toISOString()
        };
        state.elementsLinks.links[key] = offline;
        if (index) state.elementsLinks.links[index] = offline;
        persistElementsLinksLocal();
        showToast("Powiazano lokalnie (bridge niedostępny)");
        renderMain();
        return offline;
      });
  }

  function unlinkElementsLink(revPath, index) {
    var key = normPathKey(revPath);
    /* Pkt 32 (STREFA H): zapamietaj poprzednie powiazanie na potrzeby "Cofnij". */
    var prevLink =
      (state.elementsLinks.links &&
        (state.elementsLinks.links[key] || (index && state.elementsLinks.links[index]))) ||
      null;
    var prevTarget = prevLink ? prevLink.folder || prevLink.path || "" : "";
    return fetch(bridgeUrl() + "/elements-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlink", revision_path: key, index: index || "" })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .catch(function () { return {}; })
      .then(function () {
        if (state.elementsLinks.links) {
          delete state.elementsLinks.links[key];
          if (index) delete state.elementsLinks.links[index];
        }
        persistElementsLinksLocal();
        renderMain();
        /* Pkt 32: soft-delete z oknem cofniecia zamiast twardej destrukcji. */
        if (prevTarget && window.DamDanger && typeof window.DamDanger.toastUndo === "function") {
          window.DamDanger.toastUndo({
            message: "Usuńieto powiazanie Elementy",
            actionLabel: "Cofnij",
            duration: 8000,
            onUndo: function () {
              saveElementsLink(revPath, index, prevTarget);
            }
          });
        } else {
          showToast("Usuńieto powiazanie Elementy");
        }
      });
  }

  function openElementsLinkPicker(revPath, index) {
    var startDir = revPath || "X:\\";
    if (!window.DamFolderPicker || typeof window.DamFolderPicker.open !== "function") {
      showToast("DamFolderPicker niedostępny - odśwież stronę (cache).");
      return;
    }
    window.DamFolderPicker.open({
      startDir: startDir,
      mode: "folder",
      title: "Wskaz Elementy / skladniki",
      showWindowsButton: true,
      onPicked: function (picked) {
        var path = picked && picked.path;
        if (!path) return;
        saveElementsLink(revPath, index, path);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Copy buttons                                                         */
  /* ------------------------------------------------------------------ */

  function bindCopyButtons(root) {
    if (window.DamPaths && typeof window.DamPaths.bindPathActions === "function") {
      window.DamPaths.bindPathActions(root || document);
      return;
    }
    (root || document).querySelectorAll(".dam-file-copy").forEach(function (btn) {
      if (btn._damCopy) return;
      btn._damCopy = true;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var path = this.getAttribute("data-path");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(path).then(function () { showToast("Skopiowano ścieżkę"); });
        } else {
          showToast(path);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Admin controls                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Shared confirm modal (dam-basepath-overlay). Returns Promise<boolean>.
   * opts: { title, lead, metaHtml, listHtml, warn, confirmLabel, danger,
   *         confirmDisabled, waitFor(Promise → partial opts to patch) }
   */
  function showExplorerConfirmModal(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var existing = document.getElementById("damExplorerConfirmModal");
      if (existing) existing.remove();
      ensureExplorerCtaUnifyCss();
      var confirmLabel = opts.confirmLabel || "Kontynuuj";
      var okCls = opts.danger
        ? "dam-int-cta dam-int-cta--danger geex-btn geex-btn--danger"
        : "dam-int-cta geex-btn geex-btn--primary";
      var html =
        '<div class="dam-basepath-overlay" id="damExplorerConfirmModal">' +
          '<div class="dam-basepath-box dam-explorer-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="damExplorerConfirmTitle">' +
            '<button type="button" class="dam-modal-x" id="damExplorerConfirmClose" aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
            '<div class="dam-explorer-confirm-modal__header">' +
              '<h3 id="damExplorerConfirmTitle">' + esc(opts.title || "Potwierdź") + "</h3>" +
              (opts.lead ? '<p class="dam-confirm-lead">' + esc(opts.lead) + "</p>" : "") +
              '<div class="dam-confirm-meta" id="damExplorerConfirmMeta">' +
                (opts.metaHtml || "") +
              "</div>" +
            "</div>" +
            '<div class="dam-explorer-confirm-modal__body" id="damExplorerConfirmBody">' +
              (opts.listHtml || "") +
            "</div>" +
            '<div class="dam-explorer-confirm-modal__footer">' +
              '<p class="dam-confirm-warn" id="damExplorerConfirmWarn"' +
                (opts.warn ? "" : " hidden") +
              ">" +
                (opts.warn ? esc(opts.warn) : "") +
              "</p>" +
              '<div class="dam-basepath-actions">' +
                '<button type="button" class="dam-int-cta dam-int-cta--cancel" id="damExplorerConfirmCancel">Anuluj</button>' +
                '<button type="button" class="' + okCls + '" id="damExplorerConfirmOk"' +
                  (opts.confirmDisabled ? " disabled" : "") +
                ">" +
                  esc(confirmLabel) +
                "</button>" +
              "</div>" +
            "</div>" +
          "</div>" +
        "</div>";
      document.body.insertAdjacentHTML("beforeend", html);
      var modal = document.getElementById("damExplorerConfirmModal");
      var okBtn = document.getElementById("damExplorerConfirmOk");
      var bodyEl = document.getElementById("damExplorerConfirmBody");
      var metaEl = document.getElementById("damExplorerConfirmMeta");
      var warnEl = document.getElementById("damExplorerConfirmWarn");
      bindForcePreviewInteractions(modal);
      var settled = false;
      function finish(ok) {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", onEsc);
        if (modal && modal.parentNode) modal.remove();
        resolve(!!ok);
      }
      function onEsc(e) {
        if (e.key === "Escape") finish(false);
      }
      function applyPatch(patch) {
        if (!patch || settled) return;
        if (typeof patch.listHtml === "string" && bodyEl) {
          bodyEl.innerHTML = patch.listHtml;
          bindForcePreviewInteractions(modal);
        }
        if (typeof patch.metaHtml === "string" && metaEl) {
          metaEl.innerHTML = patch.metaHtml;
        }
        if (typeof patch.warn === "string" && warnEl) {
          if (patch.warn) {
            warnEl.textContent = patch.warn;
            warnEl.removeAttribute("hidden");
          } else {
            warnEl.textContent = "";
            warnEl.setAttribute("hidden", "");
          }
        }
        if (typeof patch.confirmLabel === "string" && okBtn) {
          okBtn.textContent = patch.confirmLabel;
        }
        if (okBtn && typeof patch.confirmDisabled === "boolean") {
          okBtn.disabled = patch.confirmDisabled;
        }
        if (okBtn && typeof patch.danger === "boolean") {
          okBtn.className = patch.danger
            ? "dam-int-cta dam-int-cta--danger geex-btn geex-btn--danger"
            : "dam-int-cta geex-btn geex-btn--primary";
        }
      }
      document.getElementById("damExplorerConfirmCancel").addEventListener("click", function () { finish(false); });
      document.getElementById("damExplorerConfirmClose").addEventListener("click", function () { finish(false); });
      modal.addEventListener("click", function (e) { if (e.target === modal) finish(false); });
      document.addEventListener("keydown", onEsc);
      okBtn.addEventListener("click", function () {
        if (okBtn.disabled) return;
        finish(true);
      });
      if (opts.waitFor && typeof opts.waitFor.then === "function") {
        opts.waitFor.then(applyPatch).catch(function (err) {
          applyPatch({
            listHtml:
              '<div class="dam-confirm-info-tile">' +
                '<i class="uil uil-exclamation-triangle" aria-hidden="true"></i>' +
                "<p><strong>Błąd podglądu.</strong> " +
                esc((err && err.message) || String(err || "nieznany")) +
                "</p>" +
              "</div>",
            confirmLabel: "Zamknij",
            confirmDisabled: false,
            danger: false,
            warn: "",
          });
        });
      }
    });
  }

  function folderBasename(path) {
    var parts = String(path || "").replace(/\//g, "\\").split("\\").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  }

  function stripStatusSuffixName(name) {
    return String(name || "").replace(/\s-\s([FXD])$/i, "").trim();
  }

  function withStatusSuffixName(name, letter) {
    var base = stripStatusSuffixName(name);
    var lit = String(letter || "").toUpperCase();
    if (!base) return lit ? ("(brak) - " + lit) : "(brak)";
    if (lit === "F" || lit === "X" || lit === "D") return base + " - " + lit;
    return base;
  }

  function forceActionKind(item) {
    var want = String((item && item.letter) || "").toUpperCase();
    if (!want) return "clear";
    if (want === "X") return "archive";
    return "rename";
  }

  function humanizeProductId(id) {
    var raw = String(id || "").replace(/^dk[-_]?|^gc[-_]?/i, "");
    return raw
      .split(/[-_]+/)
      .filter(Boolean)
      .map(function (p) {
        return p.charAt(0).toUpperCase() + p.slice(1);
      })
      .join(" ");
  }

  function lookupProductForForce(productId) {
    var pid = String(productId || "");
    if (!pid) return null;
    var products =
      (state.fileIndex && state.fileIndex.products) ||
      (state.fileIndex && state.fileIndex.items) ||
      [];
    if (!Array.isArray(products)) return null;
    for (var i = 0; i < products.length; i++) {
      if (String(products[i].id || "") === pid) return products[i];
    }
    return null;
  }

  function looksLikeRevisionFolderName(name) {
    var n = stripStatusSuffixName(name);
    if (!n) return false;
    if (isVariantFolderName(n)) return true;
    if (/\d{2}[.\-]\d{2}[.\-]\d{4}/.test(n)) return true;
    if (/\b6300[\dXx]{3}/i.test(n)) return true;
    if (/^(KAR|BAT|DOY|ETY|MINI|TUBA|FOL|BIG|KARTON)/i.test(n)) return true;
    return false;
  }

  /** Product folder segment from disk/index path (skip revision + archive wrappers). */
  function forceProductFolderFromPath(path) {
    var parts = String(path || "")
      .replace(/\//g, "\\")
      .split("\\")
      .filter(Boolean);
    while (parts.length) {
      var last = parts[parts.length - 1];
      var cleaned = stripStatusSuffixName(last);
      if (/archiwum/i.test(cleaned)) {
        parts.pop();
        continue;
      }
      if (looksLikeRevisionFolderName(cleaned) && parts.length > 1) {
        parts.pop();
        continue;
      }
      break;
    }
    if (!parts.length) return "";
    var folder = stripStatusSuffixName(parts[parts.length - 1]);
    return DL && DL.cleanProductDisplayName
      ? DL.cleanProductDisplayName(folder) || folder
      : folder;
  }

  function forceTileProductTitle(item) {
    if (item && item.display_name) {
      var dn = DL
        ? DL.cleanProductDisplayName(item.display_name)
        : String(item.display_name);
      if (dn) return dn;
    }
    var p = lookupProductForForce(item && item.product_id);
    if (p) {
      var nm = DL
        ? DL.cleanProductDisplayName(p.display_name || p.name || "")
        : (p.display_name || p.name || "");
      if (nm) return nm;
    }
    var fromPath = forceProductFolderFromPath(
      (item && (item.disk_path || item.path)) || ""
    );
    if (fromPath) return fromPath;
    return (
      humanizeProductId(item && item.product_id) ||
      String((item && item.product_id) || "Produkt")
    );
  }

  function letterBadgeHtml(letter, opts) {
    opts = opts || {};
    var lit = String(letter || "").toUpperCase();
    if (lit === "F" || lit === "X" || lit === "D") {
      var tip =
        lit === "F" ? "Aktualne (F)" : lit === "X" ? "Nieaktualne / archiwum (X)" : "Demo (D)";
      return '<span class="' + lifecycleChipClass(lit) + '" title="' + tip + '">' + lit + "</span>";
    }
    var emptyText = opts.emptyText || "-";
    var emptyTip = opts.emptyTip || "Bez litery";
    return (
      '<span class="' +
      lifecycleChipClass("-") +
      '" title="' +
      esc(emptyTip) +
      '">' +
      esc(emptyText) +
      "</span>"
    );
  }

  function forceKindLabel(kind) {
    if (kind === "archive") return "Archiwum";
    if (kind === "clear") return "Bez litery";
    return "Zmiana nazwy";
  }

  function formatForcePreviewLoading() {
    return (
      '<div class="dam-force-preview" id="damForcePreview">' +
        '<div class="dam-force-preview__head">' +
          '<div class="dam-force-preview__count">Liczenie zmian…</div>' +
        "</div>" +
        '<div class="dam-force-skel" aria-hidden="true">' +
          '<div class="dam-force-skel__row"></div>' +
          '<div class="dam-force-skel__row"></div>' +
          '<div class="dam-force-skel__row"></div>' +
        "</div>" +
      "</div>"
    );
  }

  function formatForcePreviewList(planned) {
    planned = planned || [];
    if (!planned.length) {
      return (
        '<div class="dam-confirm-info-tile">' +
          '<i class="uil uil-check-circle" aria-hidden="true"></i>' +
          "<p><strong>Brak zmian.</strong> Dysk Marketing jest już zgodny z programem.</p>" +
        "</div>"
      );
    }
    var counts = { all: planned.length, rename: 0, archive: 0, clear: 0 };
    planned.forEach(function (it) {
      counts[forceActionKind(it)] += 1;
    });
    var rows = planned.map(function (item, idx) {
      var kind = forceActionKind(item);
      var diskPath = item.disk_path || item.path || "";
      var rawName = folderBasename(diskPath) || "(brak folderu)";
      /* Before/after from status letters (basename may already include -F/-X/-D). */
      var baseName = stripStatusSuffixName(rawName) || rawName;
      var fromName = withStatusSuffixName(baseName, item.disk_letter);
      var toName = withStatusSuffixName(baseName, item.letter);
      var title = forceTileProductTitle(item);
      var scopeLabel = item.scope === "product" ? "Produkt" : "Wariant";
      var revRaw = String(item.revision_index || "");
      var revBit = "";
      if (revRaw) {
        /* Store sometimes keys variants by full path - show short segment only */
        if (/[:\\\/]/.test(revRaw) || revRaw.length > 36) {
          revBit = " · " + (folderBasename(revRaw) || revRaw.slice(0, 28));
        } else {
          revBit = " · " + revRaw;
        }
      }
      var kindLabel = forceKindLabel(kind);
      var toBlockExtra =
        kind === "archive"
          ? " dam-force-block--archive"
          : kind === "clear"
            ? " dam-force-block--clear"
            : "";
      var pathShort = diskPathShort(diskPath) || diskPath;
      var pathId = "damForcePath-" + idx;
      var pathFromId = pathId + "-from";
      return (
        '<article class="dam-force-row" data-force-kind="' +
        esc(kind) +
        '">' +
          '<div class="dam-force-row__head">' +
            '<h4 class="dam-force-row__title" title="' +
            esc(title) +
            '">' +
            esc(title) +
            "</h4>" +
            '<div class="dam-force-row__meta">' +
              '<span class="dam-force-row__kind dam-force-row__kind--' +
              esc(kind) +
              '">' +
              esc(kindLabel) +
              "</span>" +
              '<span class="dam-force-row__scope">' +
              esc(scopeLabel + revBit) +
              "</span>" +
            "</div>" +
          "</div>" +
          '<div class="dam-force-diff">' +
            '<div class="dam-force-block dam-force-block--from">' +
              '<div class="dam-force-block__label">Teraz</div>' +
              '<div class="dam-force-block__name" title="' +
              esc(fromName) +
              '">' +
              esc(fromName) +
              "</div>" +
              '<div class="dam-force-block__badge-row">' +
                letterBadgeHtml(item.disk_letter, {
                  emptyText: "-",
                  emptyTip: "Na dysku: bez litery",
                }) +
              "</div>" +
              (pathShort
                ? '<button type="button" class="dam-force-block__path-btn" data-force-path-toggle="' +
                  pathFromId +
                  '" aria-expanded="false">' +
                  '<i class="uil uil-angle-down" aria-hidden="true"></i> Pełna ścieżka' +
                  "</button>" +
                  '<p class="dam-force-block__path" id="' +
                  pathFromId +
                  '" hidden>' +
                  esc(pathShort) +
                  "</p>"
                : "") +
            "</div>" +
            '<div class="dam-force-diff__arrow" aria-hidden="true">→</div>' +
            '<div class="dam-force-block dam-force-block--to' +
            toBlockExtra +
            '">' +
              '<div class="dam-force-block__label">Po zmianie</div>' +

              '<div class="dam-force-block__name" title="' +
              esc(toName) +
              '">' +
              esc(toName) +
              "</div>" +
              '<div class="dam-force-block__badge-row">' +
                letterBadgeHtml(item.letter, {
                  emptyText: "∅",
                  emptyTip: "Program: bez litery",
                }) +
              "</div>" +
            "</div>" +
          "</div>" +
        "</article>"
      );
    }).join("");

    return (
      '<div class="dam-force-preview" id="damForcePreview">' +
        '<div class="dam-force-preview__head">' +
          '<div class="dam-force-preview__count" id="damForcePreviewCount">' +
            esc(String(counts.all)) +
            (counts.all === 1 ? " zmiana" : " zmian") +
          "</div>" +
          '<div class="dam-force-preview__chips" role="group" aria-label="Filtr zmian">' +
            '<button type="button" class="dam-force-chip is-on" data-force-filter="all">Wszystkie (' +
            counts.all +
            ")</button>" +
            '<button type="button" class="dam-force-chip" data-force-filter="rename">Zmiana nazwy (' +
            counts.rename +
            ")</button>" +
            '<button type="button" class="dam-force-chip" data-force-filter="archive">Archiwum (' +
            counts.archive +
            ")</button>" +
            '<button type="button" class="dam-force-chip" data-force-filter="clear">Bez litery (' +
            counts.clear +
            ")</button>" +
          "</div>" +
        "</div>" +
        '<div class="dam-force-preview__list" id="damForcePreviewList">' +
          rows +
        "</div>" +
        '<div class="dam-force-preview__empty" id="damForcePreviewEmpty" hidden>' +
          "Brak zmian w tym filtrze." +
        "</div>" +
      "</div>"
    );
  }

  function bindForcePreviewInteractions(root) {
    if (!root) return;
    var list = root.querySelector("#damForcePreviewList");
    var emptyEl = root.querySelector("#damForcePreviewEmpty");
    var countEl = root.querySelector("#damForcePreviewCount");
    var chips = root.querySelectorAll("[data-force-filter]");
    if (chips.length && list) {
      chips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          var filter = chip.getAttribute("data-force-filter") || "all";
          chips.forEach(function (c) {
            c.classList.toggle("is-on", c === chip);
          });
          var visible = 0;
          list.querySelectorAll(".dam-force-row").forEach(function (row) {
            var kind = row.getAttribute("data-force-kind") || "";
            var show = filter === "all" || kind === filter;
            row.hidden = !show;
            if (show) visible += 1;
          });
          if (countEl) {
            countEl.textContent =
              String(visible) +
              (visible === 1 ? " zmiana" : " zmian") +
              (filter !== "all" ? " (filtr)" : "");
          }
          if (emptyEl) {
            if (visible === 0) emptyEl.removeAttribute("hidden");
            else emptyEl.setAttribute("hidden", "");
          }
        });
      });
    }
    root.querySelectorAll("[data-force-path-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-force-path-toggle");
        var pathEl = id ? document.getElementById(id) : null;
        if (!pathEl) return;
        var open = pathEl.hasAttribute("hidden");
        if (open) pathEl.removeAttribute("hidden");
        else pathEl.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.innerHTML =
          '<i class="uil ' +
          (open ? "uil-angle-up" : "uil-angle-down") +
          '" aria-hidden="true"></i>' +
          (open ? " Ukryj ścieżkę" : " Pełna ścieżka");
      });
    });
  }

  function confirmInfoTileHtml(text) {
    return (
      '<div class="dam-confirm-info-tile">' +
        '<i class="uil uil-info-circle" aria-hidden="true"></i>' +
        "<p>" +
        text +
        "</p>" +
      "</div>"
    );
  }

  function exportStatusJson() {
    return showExplorerConfirmModal({
      title: "Pobierz backup JSON",
      lead: "Pobierze lokalny plik product-status.json (backup statusów w przeglądarce). Nie zmienia folderów na dysku Marketing.",
      listHtml: confirmInfoTileHtml(
        "<strong>Backup lokalny.</strong> To kopia statusów z przeglądarki - nie zapis na dysk Marketing."
      ),
      confirmLabel: "Pobierz backup",
      danger: false
    }).then(function (ok) {
      if (!ok) return;
      var data = mergeStatusStore(state.statusStore);
      data.updated_at = new Date().toISOString();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "product-status.json";
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("Pobrano backup statusów (JSON). To nie zapisuje na dysk Marketing - do tego jest „Stosuj zmiany”.", "info");
    });
  }

  /** Prawda o zapisie statusu - ukryty pasek (user nie chce copy w eksploratorze). */
  function updateAdminStatusTruthBar() {
    var bar = document.getElementById("damAdminBar");
    if (bar) bar.style.display = "none";
    var el = document.getElementById("damAdminBarText");
    if (el) el.textContent = "";
  }

  function isAdminRole() {
    var role =
      (window.DamApi && typeof window.DamApi.role === "function" && window.DamApi.role()) ||
      localStorage.getItem("dam_role") ||
      "";
    return String(role).toLowerCase() === "admin";
  }

  function bindLifecycleControls(mount) {
    if (!mount) return;
    mount.querySelectorAll("[data-lifecycle-history-open]").forEach(function (btn) {
      if (btn._damLifeHistBound) return;
      btn._damLifeHistBound = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var raw = this.getAttribute("data-life-hist") || "{}";
        var opts = {};
        try {
          opts = JSON.parse(raw);
        } catch (err) {
          opts = {};
        }
        openLifecycleHistoryModal(opts);
      });
    });
    mount.querySelectorAll("[data-lifecycle='1']").forEach(function (btn) {
      if (btn._damLifeBound) return;
      btn._damLifeBound = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (this.classList.contains("is-pending") || this.disabled) return;
        var uiBtn = this;
        var scope = this.getAttribute("data-scope") || "variant";
        var status = this.getAttribute("data-status") || "clear";
        /* Ponowne klikniecie aktywnego F/X/D = odznacz (toggle) */
        if (status !== "clear" && this.classList.contains("is-on")) {
          status = "clear";
        }
        var path = this.getAttribute("data-path") || "";
        var productPath = this.getAttribute("data-product-path") || "";
        var productId = this.getAttribute("data-product-id") || "";
        var index = this.getAttribute("data-revision-index") || "";
        path = resolveLifecycleDiskPath({
          scope: scope,
          path: path,
          index: index,
          productId: productId
        }) || path;
        if (scope === "product") {
          var prod =
            (state.fileIndex &&
              (state.fileIndex.products || []).find(function (x) {
                return x.id === productId || x.path === path;
              })) ||
            state.product;
          if (prod) {
            applyLifecycleStatus({
              scope: "product",
              status: status,
              path: path || prod.path || "",
              productPath: productPath || path || prod.path || "",
              productId: productId || prod.id || "",
              uiBtn: uiBtn
            });
          } else {
            applyLifecycleStatus({
              scope: "product",
              status: status,
              path: path,
              productPath: productPath || path,
              productId: productId,
              uiBtn: uiBtn
            });
          }
          return;
        }
        /* variant: prefer path z lifecycle-store / przycisku; fallback przez ridx */
        if (path || index) {
          applyLifecycleStatus({
            scope: "variant",
            status: status,
            path: path,
            productPath: productPath || (state.product && state.product.path) || "",
            productId: productId || (state.product && state.product.id) || "",
            index: index,
            uiBtn: uiBtn
          });
          return;
        }
        var ridx = this.getAttribute("data-ridx") || "";
        var allRevs = (state.product && state.product.revisions) || [];
        var groups2 = groupRevisionsByCarrier(allRevs);
        groups2.forEach(function (g) {
          var cur = getCurrentRevisions(g.revisions);
          var older = getOlderRevisions(g.revisions, cur);
          if (ridx === "curr" && cur[0]) setRevisionStatus(cur[0], status);
          else if (ridx.indexOf("extra_") === 0) {
            var i = parseInt(ridx.replace("extra_", ""), 10);
            if (cur[i + 1]) setRevisionStatus(cur[i + 1], status);
          } else if (ridx.indexOf("older_") === 0) {
            var i2 = parseInt(ridx.replace("older_", ""), 10);
            if (older[i2]) setRevisionStatus(older[i2], status);
          }
        });
      });
    });
  }

  function bindAdminControls() {
    var exportBtn = document.getElementById("damStatusExport");
    var adminSlot = document.querySelector(".dam-admin-slot");
    if (!isAdminRole()) {
      if (adminSlot) adminSlot.style.display = "none";
      if (exportBtn) exportBtn.hidden = true;
      var barHidden = document.getElementById("damAdminBar");
      if (barHidden) barHidden.style.display = "none";
      state.adminMode = false;
      localStorage.setItem(ADMIN_KEY, "0");
      return;
    }
    if (adminSlot) adminSlot.style.display = "";
    function syncAdminUi() {
      state.adminMode = localStorage.getItem(ADMIN_KEY) === "1";
      if (exportBtn) exportBtn.hidden = !state.adminMode;
      var bar = document.getElementById("damAdminBar");
      if (bar) bar.style.display = "none";
      updateAdminStatusTruthBar();
    }
    if (!window._damExplorerAdminBound) {
      window._damExplorerAdminBound = true;
      window.addEventListener("dam:admin-mode", function () {
        syncAdminUi();
        renderAll();
      });
      window.addEventListener("storage", function (e) {
        if (e.key === ADMIN_KEY) {
          syncAdminUi();
          renderAll();
        }
      });
      window.addEventListener("dam:db-status", function () {
        updateAdminStatusTruthBar();
      });
      window.addEventListener("dam-runtime-ready", function () {
        updateAdminStatusTruthBar();
      });
      setTimeout(updateAdminStatusTruthBar, 800);
      setTimeout(updateAdminStatusTruthBar, 2500);
    }
    if (exportBtn && !exportBtn._damBound) {
      exportBtn._damBound = true;
      exportBtn.addEventListener("click", exportStatusJson);
      exportBtn.setAttribute(
        "data-dam-tip",
        "Opcjonalna kopia zapasowa zmergowanego statusu z tej sesji. Wspolne F/X/D zapisuje most (dysk Marketing + apps/web/data/*.json + Postgres KV). Nie podmieniaj recznie pliku na P:."
      );
      exportBtn.title = "Pobierz kopie statusu (JSON backup)";
    }
    syncAdminUi();
  }

  /* ------------------------------------------------------------------ */
  /* Tag chips (search helper)                                            */
  /* ------------------------------------------------------------------ */

  function renderTagChips() {
    if (window.DamTagBar && typeof window.DamTagBar.bind === "function") {
      /* bind jest idempotentny (refresh); zawsze wywoluj po load indeksu */
      state._tagBar = window.DamTagBar.bind({
        tagsEl: "damSearchTags",
        inputEl: "damFileSearch",
      });
      return;
    }
    /* fallback bez dam-tag-bar.js */
    var tagsEl = document.getElementById("damSearchTags");
    var input = document.getElementById("damFileSearch");
    if (!tagsEl || !window._DAM_SEARCH_INDEX) return;
    var groups = window._DAM_SEARCH_INDEX.tag_groups || {};
    var html = "";
    ["smak", "typ", "opakowanie", "autor", "osoba"].forEach(function (gk) {
      var tags = groups[gk] || [];
      if (!tags.length) return;
      html +=
        '<div class="dam-tag-group-row">' +
        '<span class="dam-tag-group-label">' +
        esc(gk) +
        ':</span><span class="dam-tag-group-pills">';
      tags.slice(0, 24).forEach(function (t) {
        html +=
          '<button type="button" class="dam-tag-pill" data-tag="' +
          esc(t) +
          '">' +
          esc(t) +
          "</button>";
      });
      html += "</span></div>";
    });
    tagsEl.innerHTML = html;
    tagsEl.querySelectorAll(".dam-tag-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (input) {
          input.value = this.getAttribute("data-tag");
          input.dispatchEvent(new Event("input"));
          input.focus();
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* renderAll                                                            */
  /* ------------------------------------------------------------------ */

  function renderAll() {
    renderBreadcrumb();
    renderExplorerGridStatus();
    syncExplorerShowAllUi();
    renderSidebar();
    renderMain();
    var mainEl = document.getElementById("damExplorerMain");
    bindCopyButtons(mainEl);
    if (window.DamIcons && typeof window.DamIcons.bindChecklistRows === "function") {
      window.DamIcons.bindChecklistRows(mainEl);
    }
    if (mainEl) {
      mainEl.querySelectorAll(".dam-check-scroll").forEach(function (btn) {
        if (btn._damScrollBound) return;
        btn._damScrollBound = true;
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var section = btn.getAttribute("data-scroll-section");
          var card = btn.closest(".dam-carrier-card");
          var target =
            card && section ? card.querySelector('[data-check-section="' + section + '"]') : null;
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
    if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
      window.DamBadges.bindClicks(mainEl, "explorer");
    }

    var meta = document.getElementById("damExplorerMeta");
    if (meta && state.fileIndex) {
      meta.textContent =
        (state.fileIndex.product_count || 0) + " prod. " +
        (state.fileIndex.viz_count ? " " + state.fileIndex.viz_count + " wiz." : "") +
        " indeks: " + (state.fileIndex.generated_at || "");
    }

    if (window.DamShell && typeof window.DamShell.setTrailLeaf === "function") {
      var leaf = state.product
        ? (DL ? DL.cleanProductDisplayName(state.product.display_name || state.product.name) : (state.product.display_name || state.product.name))
        : (state.canonCat || "Eksplorator");
      window.DamShell.setTrailLeaf(leaf);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Data loading                                                         */
  /* ------------------------------------------------------------------ */

  function syncStatusMirrorFromLifecycle() {
    /* Po zaladowaniu lifecycle - nadpisz lokalny mirror dla tych samych kluczy (anty-stale X/F). */
    if (!state.lifecycleStore) return;
    if (!state.statusStore) state.statusStore = { products: {}, revisions: {} };
    if (!state.statusStore.products) state.statusStore.products = {};
    if (!state.statusStore.revisions) state.statusStore.revisions = {};
    var lp = state.lifecycleStore.products || {};
    Object.keys(lp).forEach(function (k) {
      var row = lp[k];
      if (!row) return;
      state.statusStore.products[k] = Object.assign({}, state.statusStore.products[k] || {}, {
        status: row.status || "clear",
        letter: row.letter || null,
        path: row.path || (state.statusStore.products[k] && state.statusStore.products[k].path) || ""
      });
    });
    var lr = state.lifecycleStore.revisions || {};
    Object.keys(lr).forEach(function (k) {
      var row = lr[k];
      if (!row) return;
      state.statusStore.revisions[k] = Object.assign({}, state.statusStore.revisions[k] || {}, {
        status: row.status || "clear",
        letter: row.letter || null,
        path: row.path || (state.statusStore.revisions[k] && state.statusStore.revisions[k].path) || "",
        product_id: row.product_id || ""
      });
    });
    try {
      saveLocalStatus(state.statusStore);
    } catch (e) { /* ignore quota */ }
  }

  function loadLifecycleStore() {
    function applyLifecyclePayload(d) {
      if (d && d.ok) {
        state.lifecycleStore = d;
      } else if (d && (d.products || d.revisions)) {
        state.lifecycleStore = {
          ok: true,
          products: d.products || {},
          revisions: d.revisions || {},
          history: d.history || [],
          updated_at: d.updated_at || ""
        };
      } else {
        state.lifecycleStore = { products: {}, revisions: {}, history: [] };
      }
      syncStatusMirrorFromLifecycle();
      return state.lifecycleStore;
    }
    function loadLifecycleFileFallback() {
      return fetch("data/lifecycle-status.json?v=" + Date.now())
        .then(function (r) {
          if (!r.ok) throw new Error("file_lifecycle_" + r.status);
          return r.json();
        })
        .then(applyLifecyclePayload)
        .catch(function () {
          state.lifecycleStore = { products: {}, revisions: {}, history: [] };
          return state.lifecycleStore;
        });
    }
    return fetchWithTimeout(bridgeUrl() + "/lifecycle-status", { headers: authHeaders() }, 10000)
      .then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error("bridge_lifecycle_auth");
        if (!r.ok) throw new Error("bridge_lifecycle_" + r.status);
        return r.json();
      })
      .then(applyLifecyclePayload)
      .catch(function () {
        return ensureBridgeSession()
          .then(function (sess) {
            if (!sess || !sess.ok) throw new Error("bridge_lifecycle_auth");
            return fetchWithTimeout(bridgeUrl() + "/lifecycle-status", { headers: authHeaders() }, 10000);
          })
          .then(function (r) {
            if (!r.ok) throw new Error("bridge_lifecycle_" + r.status);
            return r.json();
          })
          .then(applyLifecyclePayload)
          .catch(function () {
            return loadLifecycleFileFallback();
          });
      });
  }

  function dismissExplorerLoader() {
    if (window.DamLoader && typeof window.DamLoader.done === "function") {
      window.DamLoader.done();
    }
  }

  function scheduleExplorerRender() {
    var run = function () {
      renderAll();
      renderTagChips();
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  }

  function loadExplorerMetaLight() {
    return Promise.all([
      loadStatusStore(),
      loadCarrierOverrides(),
      loadElementsLinks()
    ]);
  }

  function runDeferredLifecycleBoot() {
    if (state._lifecycleBootScheduled) return;
    state._lifecycleBootScheduled = true;
    var run = function () {
      loadLifecycleStore()
        .then(function () {
          return bootLifecycleReconcile();
        })
        .then(function (boot) {
          syncLifecycleFromDiskIndex({
            skipProgramWins: boot && boot.ok ? (boot.program_wins || []) : [],
          });
          scheduleExplorerRender();
        })
        .catch(function (err) {
          try {
            console.warn(
              "[DAM explorer] lifecycle deferred:",
              err && err.message ? err.message : err
            );
          } catch (_eLog) { /* ignore */ }
          try {
            syncLifecycleFromDiskIndex({ skipProgramWins: [] });
            scheduleExplorerRender();
          } catch (_eSync) { /* ignore */ }
        });
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(function () { run(); }, { timeout: 2500 });
    } else {
      setTimeout(run, 80);
    }
  }

  function loadStatusStore() {
    return fetch("data/product-status.json?v=20260718life1")
      .then(function (r) { return r.ok ? r.json() : { updated_at: null, revisions: {} }; })
      .catch(function ()  { return { updated_at: null, revisions: {} }; })
      .then(function (fileData) { state.statusStore = mergeStatusStore(fileData); });
  }

  function loadAllMeta() {
    return Promise.all([
      loadStatusStore(),
      loadCarrierOverrides(),
      loadElementsLinks(),
      loadLifecycleStore()
    ]);
  }

  /** Po przeładowaniu file-index: odśwież otwarty produkt (nowe warianty, litery F/X/D). */
  function findFreshProductInIndex(preferredId, pathHint) {
    var list = (state.fileIndex && state.fileIndex.products) || [];
    if (!list.length) return null;

    if (preferredId) {
      var strict = resolveProductFromIndexStrict(preferredId);
      if (strict) return strict;
    }

    if (pathHint) {
      var want = normPathKey(pathHint);
      for (var i = 0; i < list.length; i++) {
        if (normPathKey(list[i].path || "") === want) return list[i];
      }
    }

    if (preferredId) {
      var sid = String(preferredId);
      var base = sid.replace(/-(f|x|d)$/i, "");
      for (var j = 0; j < list.length; j++) {
        var pid = list[j].id || "";
        if (pid === sid || pid === base) return list[j];
        if (base && pid.replace(/-(f|x|d)$/i, "") === base) return list[j];
      }
    }

    if (pathHint) {
      var leaf = String(pathHint).split(/[/\\]/).filter(Boolean).pop() || "";
      var leafBase = leaf.replace(/\s-\s[FXD]$/i, "");
      if (leafBase) {
        for (var k = 0; k < list.length; k++) {
          var nm = list[k].name || list[k].display_name || "";
          if (nm && nm.indexOf(leafBase) !== -1) return list[k];
        }
      }
    }

    return null;
  }

  /**
   * Po kazdej zmianie F/X/D: wyrzuc stare wpisy store, ustaw statusy wszystkich wariantow z dysku (indeks).
   * Naprawia sytuacje gdy jeden wariant (np. ETY) zostaje ze starym X po cascade produktu.
   */
  function reconcileProductLifecycleFromDisk(preferredId, pathHint) {
    var fresh = findFreshProductInIndex(preferredId, pathHint);
    if (!fresh) return null;

    if (!state.lifecycleStore) state.lifecycleStore = { products: {}, revisions: {}, history: [] };
    if (!state.lifecycleStore.products) state.lifecycleStore.products = {};
    if (!state.lifecycleStore.revisions) state.lifecycleStore.revisions = {};

    var local = loadLocalStatus();
    if (!local.revisions) local.revisions = {};
    if (!local.products) local.products = {};

    var validPaths = {};
    (fresh.revisions || []).forEach(function (r) {
      var pk = normPathKey(r.path || "");
      if (pk) validPaths[pk] = true;
    });

    var freshBase = String(fresh.id || "").replace(/-(f|x|d)$/i, "");

    function purgeStaleProductMap(map) {
      if (!map || !fresh.id) return;
      Object.keys(map).slice().forEach(function (k) {
        if (k === fresh.id) return;
        var row = map[k];
        var kbase = String(k).replace(/-(f|x|d)$/i, "");
        if (freshBase && kbase === freshBase) delete map[k];
        else if (row && row.path && normPathKey(row.path) !== normPathKey(fresh.path || "")) {
          var rowBase = String(k).replace(/-(f|x|d)$/i, "");
          if (freshBase && rowBase === freshBase) delete map[k];
        }
      });
    }

    purgeStaleProductMap(local.products);
    purgeStaleProductMap(state.lifecycleStore.products);

    function purgeStaleRevisionMap(map) {
      if (!map) return;
      Object.keys(map).slice().forEach(function (k) {
        var row = map[k];
        if (!row) return;
        if (row.product_id && row.product_id !== fresh.id) return;
        var rp = normPathKey(row.path || k);
        if (row.product_id === fresh.id && rp && !validPaths[rp]) {
          delete map[k];
          return;
        }
        if (!row.product_id && rp && rp.indexOf("archiwum") !== -1) {
          var stillUsed = false;
          Object.keys(validPaths).forEach(function (vp) {
            if (vp && rp.indexOf(vp.split("/").pop()) !== -1) stillUsed = true;
          });
          if (!stillUsed) delete map[k];
        }
      });
    }

    purgeStaleRevisionMap(local.revisions);
    purgeStaleRevisionMap(state.lifecycleStore.revisions);

    var plit = letterFromFolderName(fresh.path || fresh.name || "");
    var pst = statusFromLetter(plit);
    local.products[fresh.id] = {
      status: pst,
      letter: plit || null,
      path: fresh.path || "",
      note: "Reconciled from disk"
    };
    state.lifecycleStore.products[fresh.id] = Object.assign({}, state.lifecycleStore.products[fresh.id] || {}, {
      path: fresh.path || "",
      letter: plit || null,
      status: pst,
      synced_from_disk: true,
      source: "disk_reconcile"
    });

    (fresh.revisions || []).forEach(function (r) {
      if (!r) return;
      var rlit = letterFromFolderName(r.path || "");
      if (!rlit && r.folder) rlit = letterFromFolderName(r.folder);
      var rst = statusFromLetter(rlit);
      var pk = normPathKey(r.path || "");
      var key = pk || r.index || r.folder;
      if (!key) return;
      var prevRow = lifecycleRowForRev(r) || {};
      var prevLetter = prevRow.previous_letter;
      if (prevLetter === undefined && state.lifecycleStore.revisions[key]) {
        prevLetter = state.lifecycleStore.revisions[key].previous_letter;
      }
      var row = {
        status: rst,
        letter: rlit || null,
        path: r.path || "",
        product_id: fresh.id,
        revision_index: r.index || "",
        note: "Reconciled from disk"
      };
      if (prevLetter !== undefined) {
        row.previous_letter = prevLetter || null;
      }
      local.revisions[key] = row;
      if (pk && pk !== key) local.revisions[pk] = row;
      state.lifecycleStore.revisions[key] = Object.assign({}, row, {
        synced_from_disk: true,
        source: "disk_reconcile"
      });
      if (pk && pk !== key) state.lifecycleStore.revisions[pk] = state.lifecycleStore.revisions[key];
    });

    local.updated_at = new Date().toISOString();
    saveLocalStatus(local);
    syncStatusMirrorFromLifecycle();
    state.product = fresh;
    return fresh;
  }

  function refreshOpenProductFromIndex(productId, pathHint) {
    var pid = productId || (state.product && state.product.id) || "";
    var fresh = findFreshProductInIndex(pid, pathHint || (state.product && state.product.path) || "");
    if (fresh) state.product = fresh;
    return fresh;
  }

  function bindExplorerData(bundle) {
    state.fileIndex = bundle.fileIndex || window._DAM_FILE_INDEX;
    if (!state.fileIndex && bundle.products) state.fileIndex = bundle;
    window._DAM_FILE_INDEX = state.fileIndex;
    _fileIndexIdSet = null;
    _fileIndexIdSetSource = null;
    if (window.DamPaths && state.fileIndex && state.fileIndex.roots) {
      window.DamPaths.detectIndexBaseFromRoots(state.fileIndex.roots);
    }
    refreshOpenProductFromIndex();
    setStatus("");
    scheduleExplorerRender();

    var input = document.getElementById("damFileSearch");
    var results = document.getElementById("damSearchResults");
    if (window.DamSearch && input && !input._damBound) {
      input._damBound = true;
      var scopeEl = document.getElementById("damSearchScope");
      /* HARD: one search flight for dropdown + panel (no dual DamSearch.search). */
      window.DamSearch.bindSearchBox(
        input,
        results,
        function (prod) {
          openProduct(prod);
        },
        scopeEl,
        {
          debounceMs: 160,
          limit: 40,
          fileIndex: state.fileIndex || window._DAM_FILE_INDEX,
          onResults: function (res, q) {
            applySearchResultsToPanel(q, res);
          }
        }
      );
      /* Po zmianie scope odśwież AJAX panel (reuse single search path) */
      if (scopeEl && !scopeEl._damPanelScopeBound) {
        scopeEl._damPanelScopeBound = true;
        scopeEl.addEventListener("click", function () {
          if ((input.value || "").trim().length >= 2) {
            clearTimeout(state.searchPanelTimer);
            state.searchPanelTimer = setTimeout(function () {
              applySearchToPanel(input.value);
            }, 160);
          }
        });
      }
    }
    /* Panel clear for short query only — full search owned by bindSearchBox.onResults */
    if (input) bindSearchPanelSync(input);
  }

  function applyDeepLink() {
    var params = new URLSearchParams(location.search);
    var qIndex = params.get("index");
    var qProd  = params.get("product");
    if (qProd && window.DamSearch) {
      var p = window.DamSearch.productById(qProd);
      if (p) openProduct(p);
    } else if (qIndex && window.DamSearch) {
      window.DamSearch.search(qIndex).then(function (res) {
        if (res.products[0]) openProduct(res.products[0]);
      });
    }
  }

  /** Po odświeżeniu indeksu: zsynchronizuj store/UI z literkami na dysku (nazwy folderow). */
  function syncLifecycleFromDiskIndex(opts) {
    opts = opts || {};
    /* skipProgramWins: po boot mtime program ma pierwszenstwo az do Odśwież/FORCE */
    var skipProd = {};
    var skipRev = {};
    (opts.skipProgramWins || []).forEach(function (w) {
      if (!w) return;
      if (w.scope === "product" && w.product_id) skipProd[w.product_id] = true;
      if (w.scope === "variant") {
        if (w.revision_index) skipRev[w.revision_index] = true;
        if (w.path) skipRev[w.path] = true;
      }
    });
    if (!state.fileIndex) return { drifts: [] };
    if (!state.lifecycleStore) state.lifecycleStore = { products: {}, revisions: {}, history: [] };
    if (!state.lifecycleStore.products) state.lifecycleStore.products = {};
    if (!state.lifecycleStore.revisions) state.lifecycleStore.revisions = {};
    var local = loadLocalStatus();
    if (!local.products) local.products = {};
    if (!local.revisions) local.revisions = {};
    var drifts = [];
    (state.fileIndex.products || []).forEach(function (p) {
      if (!p || !p.id) return;
      var skipP = !!skipProd[p.id];
      var lit = letterFromFolderName(p.path || p.name || "");
      var st = statusFromLetter(lit);
      var prevP = state.lifecycleStore.products[p.id] || {};
      var prevLit = (prevP.letter || letterFromFolderName(prevP.path || "") || "").toString().toUpperCase();
      if (!skipP) {
        if ((prevLit || "") !== (lit || "") && (prevP.status || prevLit || lit)) {
          drifts.push({
            scope: "product",
            product_id: p.id,
            previous_letter: prevLit || null,
            disk_letter: lit || null,
            path: p.path || ""
          });
        }
        state.lifecycleStore.products[p.id] = Object.assign({}, prevP, {
          path: p.path || "",
          letter: lit || null,
          status: st,
          synced_from_disk: true,
          source: "disk"
        });
        local.products[p.id] = {
          status: st,
          letter: lit || null,
          path: p.path || "",
          note: "Synced from disk"
        };
      }
      (p.revisions || []).forEach(function (r) {
        if (!r) return;
        var rlit = letterFromFolderName(r.path || "");
        if (!rlit && !r.path && r.folder) rlit = letterFromFolderName(r.folder);
        var rst = statusFromLetter(rlit);
        var pathKey = normPathKey(r.path || "");
        var key = pathKey || r.index || r.folder;
        if (!key) return;
        if (skipP || skipRev[key] || skipRev[r.path || ""] || (pathKey && skipRev[pathKey])) return;
        var prevR = (pathKey && state.lifecycleStore.revisions[pathKey]) ||
          state.lifecycleStore.revisions[key] ||
          lifecycleRowForRev(r) ||
          {};
        var prevRLit = (prevR.letter || letterFromFolderName(prevR.path || "") || "").toString().toUpperCase();
        if ((prevRLit || "") !== (rlit || "") && (prevR.status || prevRLit || rlit)) {
          drifts.push({
            scope: "variant",
            product_id: p.id,
            revision_index: r.index || "",
            previous_letter: prevRLit || null,
            disk_letter: rlit || null,
            path: r.path || ""
          });
        }
        var row = Object.assign({}, prevR, {
          path: r.path || "",
          letter: rlit || null,
          status: rst,
          product_id: p.id,
          revision_index: r.index || "",
          synced_from_disk: true,
          source: "disk"
        });
        state.lifecycleStore.revisions[key] = row;
        if (pathKey && pathKey !== key) state.lifecycleStore.revisions[pathKey] = row;
        local.revisions[key] = {
          status: rst,
          letter: rlit || null,
          path: r.path || "",
          product_id: p.id,
          note: "Synced from disk"
        };
        if (pathKey && pathKey !== key) local.revisions[pathKey] = local.revisions[key];
      });
    });
    local.updated_at = new Date().toISOString();
    saveLocalStatus(local);
    state.statusStore = mergeStatusStore(state.statusStore);
    return { drifts: drifts };
  }

  function notifyLifecycleDrifts(drifts, sourceLabel) {
    drifts = drifts || [];
    var real = drifts.filter(function (d) {
      var a = (d.previous_letter || "").toString().toUpperCase();
      var b = (d.disk_letter || "").toString().toUpperCase();
      return a !== b;
    });
    if (!real.length) {
      try { console.info("[DAM lifecycle] sync OK, brak istotnych zmian liter", sourceLabel || ""); } catch (_e) {}
      return;
    }
    showToast(
      "Pomyślnie zsynchronizowano statusy z dysku (" + real.length + ")",
      "success"
    );
    setStatus("Zsynchronizowano z dysku: " + real.length + " zmian");
    try { console.info("[DAM lifecycle drifts]", real); } catch (_e2) {}
  }

  /** Most: pull dysk->program (bez FS rename). Fallback: lokalny sync z indeksu. */
  function pullLifecycleFromBridge() {
    return bridgeFetchJson(bridgeUrl() + "/lifecycle-reconcile?mode=pull")
      .then(function (res) {
        if (!res.data || !res.data.ok) {
          if (res.http === 401 || res.http === 403 || (res.data && res.data.error === "login_required")) {
            throw new Error("login_required");
          }
          throw new Error((res.data && res.data.error) || "reconcile_failed");
        }
        return res.data;
      });
  }

  function bootLifecycleReconcile() {
    if (state._lifecycleBootDone) return Promise.resolve(null);
    state._lifecycleBootDone = true;
    /* Na starcie strony: pull (odczyt), NIE boot z enforce_moves - to blokuje admina na minuty. */
    return bridgeFetchJson(bridgeUrl() + "/lifecycle-reconcile?mode=pull", {}, 8000)
      .then(function (res) {
        if (!res.data || !res.data.ok) {
          if (res.http === 401 || res.http === 403) return null;
          return null;
        }
        return res.data;
      })
      .catch(function () { return null; });
  }


  var _forcePreviewCache = { at: 0, data: null, ttlMs: 8000 };
  var _forceApplyBusy = false;

  function fetchLifecycleForcePreview() {
    var now = Date.now();
    if (
      _forcePreviewCache.data &&
      now - _forcePreviewCache.at < _forcePreviewCache.ttlMs
    ) {
      return Promise.resolve({
        data: _forcePreviewCache.data,
        http: 200,
        fromCache: true,
      });
    }
    return bridgeFetchJson(bridgeUrl() + "/lifecycle-force", {
      method: "POST",
      body: JSON.stringify({ dry_run: true }),
    }).then(function (previewRes) {
      if (previewRes.data && previewRes.data.ok) {
        _forcePreviewCache = {
          at: Date.now(),
          data: previewRes.data,
          ttlMs: _forcePreviewCache.ttlMs,
        };
      }
      return previewRes;
    });
  }

  /** Stosuj zmiany: PROGRAM -> dysk (FORCE). Skeleton first, then dry-run fill. */
  function forceApplyLifecycleToDisk() {
    if (!isAdminRole() || !state.adminMode) {
      showToast("Włącz tryb admina, aby stosować zmiany na dysku.", "error");
      return Promise.resolve({ ok: false });
    }
    if (!hasBridgeToken()) {
      return ensureBridgeSession().then(function (sess) {
        if (!sess || !sess.ok) {
          showSessionRequiredToast((sess && sess.error) || "login_required");
          return { ok: false, error: "login_required" };
        }
        return forceApplyLifecycleToDisk();
      });
    }
    if (_forceApplyBusy) {
      return Promise.resolve({ ok: false, busy: true });
    }
    _forceApplyBusy = true;
    setStatus("FORCE dry-run…");
    var previewCount = 0;
    var previewReady = false;
    var waitPreview = fetchLifecycleForcePreview()
      .then(function (previewRes) {
        if (!previewRes.data || !previewRes.data.ok) {
          var err =
            (previewRes.data && previewRes.data.error) || previewRes.http;
          if (
            err === "login_required" ||
            err === "admin_required" ||
            previewRes.http === 401 ||
            previewRes.http === 403
          ) {
            showSessionRequiredToast(err);
          }
          throw new Error(
            typeof err === "string" ? err : "Nie udało się przygotować podglądu"
          );
        }
        var planned = previewRes.data.planned || [];
        previewCount =
          typeof previewRes.data.count === "number"
            ? previewRes.data.count
            : planned.length;
        previewReady = true;
        return {
          listHtml: formatForcePreviewList(planned),
          metaHtml: previewCount
            ? "<strong>Podgląd bez zapisu</strong> - jeszcze nic nie zapisano na dysku."
            : "",
          warn: previewCount
            ? "Tej operacji nie da się łatwo cofnąć. Sprawdź bloki Teraz / Po zmianie przed potwierdźeniem."
            : "",
          confirmLabel: previewCount
            ? "Stosuj (" + previewCount + ")"
            : "Zamknij",
          confirmDisabled: false,
          danger: !!previewCount,
        };
      });

    return showExplorerConfirmModal({
      title: "Stosuj zmiany na dysk",
      lead:
        "FORCE zapisze statusy z PROGRAMU na foldery Marketing (zmiana nazwy / archiwum). Odśwież tylko czyta dysk - to odwrotność.",
      metaHtml: "Trwa liczenie zmian z dysku…",
      listHtml: formatForcePreviewLoading(),
      warn: "",
      confirmLabel: "Stosuj",
      confirmDisabled: true,
      danger: true,
      waitFor: waitPreview,
    })
      .then(function (confirmed) {
        _forceApplyBusy = false;
        if (!confirmed) return { ok: false, cancelled: true };
        if (!previewReady) return { ok: false, error: "preview_failed" };
        if (!previewCount) {
          return { ok: true, applied_ok: 0, applied_fail: 0, dry_run: true };
        }
        _forcePreviewCache = { at: 0, data: null, ttlMs: _forcePreviewCache.ttlMs };
        showToast("Stosuję zmiany na dysku…");
        setStatus("FORCE lifecycle…");
        return bridgeFetchJson(bridgeUrl() + "/lifecycle-force", {
          method: "POST",
          body: JSON.stringify({ dry_run: false }),
        }).then(function (res) {
          if (!res.data || !res.data.ok) {
            var err2 = (res.data && res.data.error) || res.http;
            if (
              err2 === "login_required" ||
              err2 === "admin_required" ||
              res.http === 401 ||
              res.http === 403
            ) {
              showSessionRequiredToast(err2);
            } else {
              showToast("Nie udało się zastosować zmian: " + err2, "error");
            }
            return res.data || { ok: false };
          }
          var n = res.data.applied_ok || 0;
          var fail = res.data.applied_fail || 0;
          if (fail) {
            showToast("Zapisano " + n + " zmian, błędów: " + fail, "error");
          } else {
            showToast(
              "Pomyślnie zastosowano zmiany na dysku (" + n + ")",
              "success"
            );
          }
          return refreshIndex({ silent: true }).then(function () {
            return res.data;
          });
        });
      })
      .catch(function (err) {
        _forceApplyBusy = false;
        showToast(
          "Błąd zapisu na dysk: " +
            (err && err.message ? err.message : err),
          "error"
        );
        return { ok: false };
      });
  }

  /** Toolbar Odśwież: confirm read-only scan, then refreshIndex. */
  function confirmAndRefreshIndex() {
    return showExplorerConfirmModal({
      title: "Odśwież listę z dysku",
      lead: "Skan tylko odczytu - nie zmienia dysku Marketing. Wczyta foldery do programu (dysk -> program) i odświeży indeks.",
      listHtml: confirmInfoTileHtml(
        "<strong>Tylko odczyt.</strong> Nie zapisuje liter F/X/D na folderach. Do zapisu na dysk służy „Stosuj zmiany”."
      ),
      confirmLabel: "Odśwież",
      danger: false
    }).then(function (ok) {
      if (!ok) return { ok: false, cancelled: true };
      return refreshIndex();
    });
  }

  function refreshIndex(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    var reopenId = opts.reopenProductId || (state.product && state.product.id) || "";
    var lifecyclePathHint = opts.lifecyclePathHint || "";
    setStatus("Odświeżanie z dysku…");
    if (!silent) showToast("Odświeżam listę z dysku…", "info");

    function afterBundle(bundle) {
      return loadAllMeta().then(function () {
        bindExplorerData(bundle);
        return pullLifecycleFromBridge()
          .then(function (pull) {
            var drifts = (pull && pull.drifts) || [];
            return loadLifecycleStore().then(function () {
              var localSync = syncLifecycleFromDiskIndex();
              if (!drifts.length && localSync && localSync.drifts) drifts = localSync.drifts;
              if (reopenId || state.product) {
                reconcileProductLifecycleFromDisk(
                  reopenId || (state.product && state.product.id),
                  lifecyclePathHint || (state.product && state.product.path) || ""
                );
              } else {
                refreshOpenProductFromIndex(reopenId, lifecyclePathHint);
              }
              if (!silent) notifyLifecycleDrifts(drifts, "odśwież");
              renderAll();
              var gen = (state.fileIndex && state.fileIndex.generated_at) || "";
              setStatus(gen ? "Zaktualizowano z dysku: " + gen : "Zaktualizowano z dysku");
              if (!silent) {
                var archN = 0;
                if (state.product && state.product.revisions) {
                  archN = state.product.revisions.filter(function (r) { return r.in_archive; }).length;
                }
                if (archN > 0) {
                  showToast("Odświeżono listę (+" + archN + " w archiwum - włącz Pokaż wszystko)", "success");
                } else {
                  showToast("Pomyślnie odświeżono listę", "success");
                }
              }
              return bundle;
            });
          })
          .catch(function () {
            var localSync = syncLifecycleFromDiskIndex();
            if (!silent) notifyLifecycleDrifts((localSync && localSync.drifts) || [], "odśwież lokalnie");
            if (reopenId || state.product) {
              reconcileProductLifecycleFromDisk(
                reopenId || (state.product && state.product.id),
                lifecyclePathHint || (state.product && state.product.path) || ""
              );
            } else {
              refreshOpenProductFromIndex(reopenId, lifecyclePathHint);
            }
            renderAll();
            var gen2 = (state.fileIndex && state.fileIndex.generated_at) || "";
            setStatus(gen2 ? "Zaktualizowano z dysku: " + gen2 : "Zaktualizowano z dysku");
            if (!silent) showToast("Pomyślnie odświeżono listę", "success");
            return bundle;
          });
      });
    }

    /* Przebudowa indeksu z dysku = tylko admin (PI). User: przeładuj JSON + pull statusow. */
    var rebuild = ensureBridgeSession()
      .then(function (sess) {
        if (!sess || !sess.ok) {
          return { ok: false, authError: true, error: (sess && sess.error) || "login_required" };
        }
        if (!isAdminRole()) {
          return { ok: true, skippedRebuild: true };
        }
        if (opts.skipRebuild) {
          return { ok: true, skippedRebuild: true };
        }
        return fetch(bridgeUrl() + "/index/rebuild", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({})
        })
          .then(function (r) {
            return r.json().catch(function () {
              return { ok: false, error: "rebuild_" + r.status };
            }).then(function (data) {
              if (r.status === 401 || r.status === 403) {
                return { ok: false, authError: true, error: (data && data.error) || "auth" };
              }
              if (!r.ok || (data && data.ok === false)) {
                return { ok: false, error: (data && data.error) || "rebuild_failed" };
              }
              return waitForIndexRebuild(silent ? 15000 : 60000);
            });
          });
      })
      .catch(function (err) {
        return { ok: false, error: err && err.message ? err.message : "rebuild_failed" };
      });

    return rebuild.then(function (rebuildResult) {
      if (rebuildResult && rebuildResult.authError && !silent) {
        showSessionRequiredToast(rebuildResult.error || "login_required");
      } else if (rebuildResult && rebuildResult.error && !silent) {
        showToast("Indeks dysku: " + rebuildResult.error + " - wczytuję ostatnią kopię.", "info");
      }
      var reloader = window.DamSearch && window.DamSearch.reload
        ? window.DamSearch.reload()
        : fetch("data/file-index.json?v=" + Date.now())
            .then(function (r) { if (!r.ok) throw new Error("file-index.json"); return r.json(); })
            .then(function (d) { return { fileIndex: d }; });
      return reloader.then(afterBundle);
    }).catch(function (err) {
      setStatus("Błąd odświeżania: " + (err && err.message ? err.message : err));
      showToast("Nie udało się odświeżyć listy: " + (err && err.message ? err.message : err), "error");
      throw err;
    });
  }

  /* ------------------------------------------------------------------ */
  /* openProduct                                                          */
  /* ------------------------------------------------------------------ */

  function openProduct(product) {
    if (!product) return;
    var resolved =
      typeof product === "string"
        ? resolveProductFromIndexStrict(product)
        : resolveProductFromIndexStrict(product.id) || resolveProductFromIndex(product);
    if (!resolved || !resolved.id || !productInFileIndex(resolved.id)) return;
    product = resolved;

    state.searchQuery = "";
    state.searchHits = null;
    var inp = document.getElementById("damFileSearch");
    if (inp) inp.value = "";
    var searchDrop = document.getElementById("damSearchResults");
    if (searchDrop) {
      searchDrop.innerHTML = "";
      searchDrop.style.display = "none";
    }

    state.product = product;
    state.canonCat = DL ? DL.categoryCanonId(product.category) : product.category;
    reconcileProductLifecycleFromDisk(product.id, product.path || "");
    state.expandedCarriers = {};
    state.showOlderCarriers = {};
    trackRecentProduct(product);
    navPush();
    renderAll();
  }

  function clearSearchPanel() {
    state.searchQuery = "";
    state.searchHits = null;
    var inp = document.getElementById("damFileSearch");
    if (inp) inp.value = "";
    var res = document.getElementById("damSearchResults");
    if (res) {
      res.innerHTML = "";
      res.style.display = "none";
    }
    state.expandedCarriers = {};
    state.showOlderCarriers = {};
    var snap = navSnapshot();
    if (state.navPos >= 0) {
      state.navStack[state.navPos] = snap;
      state.navStack = state.navStack.slice(0, state.navPos + 1);
    }
    renderAll();
  }

  function normSearchText(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function pathLooksLikeCategoryArchive(path) {
    var p = String(path || "").toUpperCase();
    if (!p || p.indexOf("ARCHIWUM") === -1) return false;
    return (
      p.indexOf("\u2014 ARCHIWUM") !== -1 || p.indexOf("- ARCHIWUM") !== -1 ||
      p.indexOf("/ARCHIWUM/") !== -1 ||
      p.indexOf("\\ARCHIWUM\\") !== -1 ||
      p.indexOf("0 - ARCHIWUM") !== -1
    );
  }

  function isStatusStorePathKey(id) {
    var s = String(id || "").trim();
    return /[:\\\/]/.test(s) || /^[A-Za-z]:/.test(s);
  }

  var _fileIndexIdSet = null;
  var _fileIndexIdSetSource = null;
  function getFileIndexIdSet() {
    var fi = state.fileIndex;
    if (!fi || !fi.products) return null;
    if (_fileIndexIdSet && _fileIndexIdSetSource === fi) return _fileIndexIdSet;
    var set = Object.create(null);
    for (var i = 0; i < fi.products.length; i++) {
      var p = fi.products[i];
      if (p && p.id) set[p.id] = 1;
    }
    _fileIndexIdSet = set;
    _fileIndexIdSetSource = fi;
    return set;
  }

  function productInFileIndex(id) {
    if (!id || !state.fileIndex || !state.fileIndex.products) return false;
    var set = getFileIndexIdSet();
    return !!(set && set[id]);
  }

  function resolveProductFromIndexStrict(id) {
    var sid = String(id || "").trim();
    if (!sid) return null;
    var p = resolveProductFromIndex({ id: sid });
    if (p && p.id && productInFileIndex(p.id)) return p;
    var suffixes = ["-f", "-x", "-d"];
    for (var i = 0; i < suffixes.length; i++) {
      p = resolveProductFromIndex({ id: sid + suffixes[i] });
      if (p && p.id && productInFileIndex(p.id)) return p;
    }
    var baseId = sid.replace(/-(f|x|d)$/i, "");
    if (baseId !== sid) {
      p = resolveProductFromIndex({ id: baseId });
      if (p && p.id && productInFileIndex(p.id)) return p;
    }
    return null;
  }

  function findProductByRevisionIndex(indexKey) {
    if (!indexKey || !state.fileIndex || !state.fileIndex.products) return null;
    var ik = String(indexKey).trim();
    for (var i = 0; i < state.fileIndex.products.length; i++) {
      var p = state.fileIndex.products[i];
      if (!p) continue;
      if ((p.indexes || []).indexOf(ik) !== -1) return p;
      var revs = p.revisions || [];
      for (var j = 0; j < revs.length; j++) {
        var r = revs[j];
        if (!r) continue;
        if (r.index === ik) return p;
        if (r.folder && String(r.folder).indexOf(ik) !== -1) return p;
      }
    }
    return null;
  }

  function findProductByRevisionPath(path) {
    if (!path || !state.fileIndex || !state.fileIndex.products) return null;
    var target = normSearchText(String(path).replace(/\\/g, "/"));
    if (!target) return null;
    for (var i = 0; i < state.fileIndex.products.length; i++) {
      var p = state.fileIndex.products[i];
      var revs = p.revisions || [];
      for (var j = 0; j < revs.length; j++) {
        var rp = revs[j] && revs[j].path;
        if (rp && normSearchText(String(rp).replace(/\\/g, "/")) === target) return p;
      }
    }
    return null;
  }

  function supplementSearchFromLifecycle(q, res) {
    if (!state.showAllRevisions || !q) return res || { products: [], hits: [] };
    res = res || { products: [], hits: [], query: q };
    var nq = normSearchText(q);
    if (!nq) return res;
    var seen = {};
    (res.products || []).forEach(function (p) {
      if (p && p.id && productInFileIndex(p.id)) seen[p.id] = true;
    });
    var added = [];
    var hits = (res.hits || []).slice();
    var hitKeys = {};
    hits.forEach(function (h) {
      if (!h || !h.product || !h.product.id) return;
      hitKeys[h.product.id + "|" + (h.label || "") + "|" + (h.revision && h.revision.path || "")] = true;
    });

    function tryAddProduct(prod) {
      if (!prod || !prod.id || !productInFileIndex(prod.id) || seen[prod.id]) return null;
      seen[prod.id] = true;
      added.push(prod);
      return prod;
    }

    function resolveProdForLifecycleRow(idx, row) {
      if (row && row.product_id) {
        var byPid = resolveProductFromIndexStrict(row.product_id);
        if (byPid) return byPid;
      }
      var byIdx = findProductByRevisionIndex(idx);
      if (byIdx) return byIdx;
      var path = (row && row.path) || (isStatusStorePathKey(idx) ? idx : "");
      if (path) return findProductByRevisionPath(path);
      return null;
    }

    var local = loadLocalStatus();
    var statusStore = state.statusStore || {};
    var revMaps = [
      (local && local.revisions) || {},
      (statusStore.revisions) || {},
      (state.lifecycleStore && state.lifecycleStore.revisions) || {}
    ];
    revMaps.forEach(function (map) {
      Object.keys(map).forEach(function (idx) {
        var row = map[idx];
        if (!row) return;
        var blob = normSearchText([idx, row.path, row.note, row.product_id].join(" "));
        if (blob.indexOf(nq) === -1) return;
        var prod = resolveProdForLifecycleRow(idx, row);
        if (!prod) return;
        tryAddProduct(prod);
        var revPath = row.path || (isStatusStorePathKey(idx) ? idx : "");
        var hitKey = prod.id + "|" + idx + "|" + revPath;
        if (hitKeys[hitKey]) return;
        hitKeys[hitKey] = true;
        hits.push({
          kind: "variant",
          product: prod,
          revision: {
            path: revPath,
            index: /^[A-Z0-9][A-Z0-9.-]*$/i.test(idx) ? idx : "",
            folder: (revPath || idx).split(/[/\\]/).pop() || idx,
            in_archive: pathLooksLikeCategoryArchive(revPath || idx)
          },
          label: idx,
          meta: revPath || row.note || ""
        });
      });
    });

    if (!added.length && hits.length === (res.hits || []).length) {
      return Object.assign({}, res, {
        products: (res.products || []).filter(function (p) { return p && productInFileIndex(p.id); }),
        hits: hits.filter(function (h) { return h && h.product && productInFileIndex(h.product.id); })
      });
    }
    var products = (res.products || []).filter(function (p) { return p && productInFileIndex(p.id); }).concat(added);
    added.forEach(function (p) {
      var hk = p.id + "|product|";
      if (hitKeys[hk]) return;
      hitKeys[hk] = true;
      hits.push({
        kind: "product",
        product: p,
        revision: null,
        label: p.display_name || p.name,
        meta: p.path || ""
      });
    });
    return Object.assign({}, res, { products: products, hits: hits });
  }

  /** Apply already-fetched DamSearch result to explorer panel (no second search). */
  function applySearchResultsToPanel(query, res) {
    var q = String(query || "").trim();
    state.searchQuery = q;
    if (!q || q.length < 2) {
      state.searchHits = null;
      if (!state.product) {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(function () { renderAll(); });
        } else {
          setTimeout(function () { renderAll(); }, 0);
        }
      }
      return;
    }
    if (res && res.stale) return;
    state.searchHits = filterSearchResponse(res || { products: [], hits: [], query: q });
    /* Szukanie w panelu ma pierwszenstwo - zamknij produkt, pokaz liste wynikow */
    if (state.product) state.product = null;
    renderMain();
    renderBreadcrumb();
  }

  function applySearchToPanel(query) {
    var q = String(query || "").trim();
    state.searchQuery = q;
    if (!q || q.length < 2) {
      applySearchResultsToPanel(q, null);
      return;
    }
    if (!window.DamSearch || typeof window.DamSearch.search !== "function") return;
    var seq = (state._searchPanelSeq = (state._searchPanelSeq || 0) + 1);
    window.DamSearch.search(q, {
      limit: 40,
      includeArchive: !!state.showAllRevisions,
      fileIndex: state.fileIndex
    }).then(function (res) {
      if (state._searchPanelSeq !== seq) return;
      if (state.searchQuery !== q) return;
      applySearchResultsToPanel(q, res);
    }).catch(function () {
      if (state._searchPanelSeq !== seq) return;
      if (state.searchQuery !== q) return;
      applySearchResultsToPanel(q, {
        products: [],
        hits: [],
        query: q,
        message: "Błąd wyszukiwania"
      });
    });
  }

  function bindSearchPanelSync(input) {
    if (!input || input._damPanelSearchBound) return;
    input._damPanelSearchBound = true;
    /*
     * When DamSearch.bindSearchBox owns input (onResults → panel), only handle
     * short-query clear here — never fire a second DamSearch.search on input.
     */
    var boxOwnsSearch = !!(input._damBound);
    input.addEventListener("input", function () {
      clearTimeout(state.searchPanelTimer);
      var q = input.value || "";
      var trimmed = String(q).trim();
      if (boxOwnsSearch) {
        if (trimmed.length < 2) {
          state.searchPanelTimer = setTimeout(function () {
            applySearchResultsToPanel(trimmed, null);
          }, 160);
        }
        return;
      }
      state.searchPanelTimer = setTimeout(function () {
        applySearchToPanel(q);
      }, 160);
    });
    if ((input.value || "").trim().length >= 2) {
      applySearchToPanel(input.value);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                 */
  /* ------------------------------------------------------------------ */

  function init() {
    if (init._damDone) return;
    var main = document.getElementById("damExplorerMain");
    if (!main) return;
    init._damDone = true;

    ensureExplorerCtaUnifyCss();
    bindCategoryAddButton();

    var revealLow = document.getElementById("damRevealLowTags");
    if (revealLow && window.DamBadges && typeof window.DamBadges.setRevealLowTags === "function") {
      try {
        var revealOn =
          window.DamUserPrefs && typeof DamUserPrefs.getSync === "function"
            ? !!DamUserPrefs.getSync().reveal_low_tags
            : localStorage.getItem("dam_reveal_low_tags") === "1";
        revealLow.checked = revealOn;
      } catch (eRev) { /* ignore */ }
      revealLow.addEventListener("change", function () {
        window.DamBadges.setRevealLowTags(revealLow.checked);
        if (window.DamUserPrefs && typeof DamUserPrefs.set === "function") {
          DamUserPrefs.set({ reveal_low_tags: !!revealLow.checked }).catch(function () {});
        }
        if (typeof renderProductList === "function") renderProductList();
      });
    }
    hydrateExplorerUiPrefsFromKv();

    /* Tag bar NAJPIERW - zanim brand/admin cos rzuci */
    try {
      renderTagChips();
      setTimeout(renderTagChips, 50);
      setTimeout(renderTagChips, 600);
    } catch (e) { /* ignore */ }

    // Hide Geex demo sections below the live explorer shell
    var shell = document.querySelector(".dam-explorer-shell");
    if (shell) {
      var sib = shell.nextElementSibling;
      while (sib) {
        var next = sib.nextElementSibling;
        if (!sib.classList.contains("dam-explorer-shell")) {
          sib.style.display = "none";
          sib.setAttribute("aria-hidden", "true");
        }
        sib = next;
      }
    }

    var sub = document.querySelector(".geex-content__header__subtitle");
    if (sub) sub.textContent = "Pełna struktura produktów Dobra Kaloria i Good Calories";

    // Filtr marki: chipy DK/GC tylko na pasku filtrów (damExplorerBrandMount).
    // Synchronizacja: DamBrandFilter.commitBrands / syncAllUi.
    try {
      if (window.DamBrandFilter) {
        window.DamBrandFilter.addListener(onBrandFilterChange);
        state.brands = window.DamBrandFilter.loadBrands();
      }
      bindGlobalExplorerFilters();
      bindAdminControls();
      if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
        window.DamBadges.bindClicks(main, "explorer");
      }
    } catch (e) { /* ignore */ }

    setStatus("Ładowanie indeksu...");
    if (window.DamLoader && typeof window.DamLoader.start === "function") {
      window.DamLoader.start("Skojarzenia…");
    }

    var loader = Promise.all([
      withTimeout(
        window.DamSearch
          ? window.DamSearch.load()
          : fetch("data/file-index.json?v=20260717ux3").then(function (r) { return r.json(); }).then(function (d) { return { fileIndex: d }; }),
        15000,
        "index_load_timeout"
      ),
      loadExplorerMetaLight()
    ]);

    loader.then(function (pair) {
      dismissExplorerLoader();
      bindExplorerData(pair[0]);
      populateExplorerLangFilter();
      bindGlobalExplorerFilters();
      renderTagChips();
      applyDeepLink();
      setStatus("");
      runDeferredLifecycleBoot();
    }).catch(function (err) {
      dismissExplorerLoader();
      setStatus("Błąd indeksu: " + (err && err.message ? err.message : err));
      main.innerHTML =
        '<div class="dam-explorer-empty"><p style="color:#FF5653">Nie załadowano file-index.json</p>' +
        "<p>Uruchom: <code>python apps/web/scripts/build-file-index.py</code></p></div>";
      renderTagChips();
    }).finally(function () {
      dismissExplorerLoader();
    });

    var refreshBtn = document.getElementById("damIndexRefresh");
    if (refreshBtn && !refreshBtn._damBound) {
      refreshBtn._damBound = true;
      refreshBtn.addEventListener("click", confirmAndRefreshIndex);
    }
    var forceBtn = document.getElementById("damLifecycleForce");
    if (forceBtn && !forceBtn._damBound) {
      forceBtn._damBound = true;
      forceBtn.addEventListener("click", function () {
        forceApplyLifecycleToDisk();
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                           */
  /* ------------------------------------------------------------------ */

  window.damSetRevisionStatus = function (opts) {
    opts = opts || {};
    var rev = findRevisionByRef(opts.path || opts.revision_path || "", opts.index || opts.revision_index || "");
    if (!rev) {
      showToast("Nie znaleziono rewizji do zmiany statusu");
      return;
    }
    var next = opts.status;
    if (!next) {
      var cur = getRevisionStatus(rev);
      next = cur === "aktualne" ? "nieaktualne" : "aktualne";
    }
    setRevisionStatus(rev, next);
  };

  window.DamExplorer = {
    state: state,
    openProduct: openProduct,
    reload:      refreshIndex,
    exportStatus: exportStatusJson,
    getElementsLink: getElementsLink,
    setRevisionStatus: setRevisionStatus,
    setProductStatus: setProductLifecycleStatus,
    applyLifecycleStatus: applyLifecycleStatus,
    forceApplyLifecycle: forceApplyLifecycleToDisk,
    pullLifecycle: pullLifecycleFromBridge,
    /** QA helper: FORCE confirm from real dry-run (or explicit planned). No disk write. */
    debugForcePreview: function (planned) {
      if (Array.isArray(planned) && planned.length) {
        return showExplorerConfirmModal({
          title: "Stosuj zmiany na dysk",
          lead:
            "FORCE zapisze statusy z PROGRAMU na foldery Marketing (zmiana nazwy / archiwum). Odśwież tylko czyta dysk - to odwrotność.",
          metaHtml:
            "<strong>Podgląd bez zapisu</strong> - jeszcze nic nie zapisano na dysku.",
          listHtml: formatForcePreviewList(planned),
          warn:
            "Tej operacji nie da się łatwo cofnąć. Sprawdź bloki Teraz / Po zmianie przed potwierdźeniem.",
          confirmLabel: "Stosuj (" + planned.length + ")",
          danger: true,
        });
      }
      return forceApplyLifecycleToDisk();
    },
    init: init,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
