/**
 * Wspolny podglad mediow (branding, explorer, …) - ten sam DOM/CSS co dam-viz-modal.
 */
(function () {
  "use strict";

  var PLACEHOLDER_SVG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">' +
        '<rect fill="#f1f3f6" width="320" height="240"/>' +
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="14">Brak podgladu</text>' +
        "</svg>"
    );

  /** B3: lokalny poster gdy ffmpeg/bridge nie odda klatki. */
  var VIDEO_POSTER_FALLBACK =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
        '<rect width="640" height="360" fill="#ececf2"/>' +
        '<circle cx="320" cy="168" r="42" fill="#c5c6cd"/>' +
        '<path d="M308 148 L308 188 L348 168 Z" fill="#fff"/>' +
        '<text x="320" y="248" text-anchor="middle" fill="#696877" ' +
        'font-family="Segoe UI,Arial,sans-serif" font-size="22">Wideo</text></svg>'
    );

  var PREVIEW_EXTS = { tif: 1, tiff: 1, psd: 1, psb: 1, bmp: 1 };
  /* PNG/WebP: most dematte czarnego matte (ELEMENTY) + zachowuje alpha. */
  var ALPHA_PREVIEW_EXTS = { png: 1, webp: 1 };
  var VIDEO_EXTS = { mp4: 1, mov: 1, webm: 1, avi: 1, mkv: 1, m4v: 1 };
  var CARD_ZOOM_KEY = "dam_viz_card_zoom";
  var CARD_ZOOM_MIN = 65;
  var CARD_ZOOM_MAX = 350;
  var CARD_ZOOM_STEP = 5;
  /* Assoc grid vs Elementy: pionowy split z suwakiem, ratio per product_id. */
  var ASSOC_SPLIT_KEY_PREFIX = "dam-assoc-elementy-split:";
  var ASSOC_SPLIT_DEFAULT = 0.6;
  var ASSOC_SPLIT_EMPTY_TOP = 0.2;
  var ASSOC_SPLIT_MIN = 0.2;
  var ASSOC_SPLIT_MAX = 0.8;
  /* 1.0 (nie 1.2): DamCardZoom ustawia --dam-viz-img-scale na branding/viz;
     skala >1 + overflow:visible karty wychodzila poza obrys thumbs (HARD 2026-07-21). */
  var CARD_IMG_BASE_SCALE = 1;
  var CARD_BASE_MIN_PX = 220;
  /* Tag/blob skladniki/owoce — NIE "kulki" (kategoria produktu / packshot DK_Kulki_*). */
  var ELEMENT_ASSOC_RE = /(^|[^a-z0-9])(skladniki|składniki|owoce|owocki)([^a-z0-9]|$)/i;
  /**
   * Izolowany element po NAZWIE PLIKU:
   * - KULKA2 / KULKA17 (sam token + cyfry)
   * - "KULKI - kukurydziane (16)" (KULKI + spacja + myslnik)
   * NIE: DK_Kulki_platki_... / GC_*_kulki_* packshoty (underscore po Kulki).
   */
  var ELEMENT_NAME_RE = /(^|[^a-z0-9_.-])kulka\d+([^a-z0-9]|$)|^kulki\s*[-–—]\s+/i;

  /** HARD UI fixes — appended last in <head> to beat concurrent CSS (negative title margin / always-visible minus). */
  function injectUiHardFixes() {
    var id = "dam-uihard-fixes-20260721";
    var st = document.getElementById(id);
    if (!st) {
      st = document.createElement("style");
      st.id = id;
    }
    st.textContent = [
      /* 1) badges → title ≥12px (prefer 16+4 air); NEVER negative margin */
      "#damVizModal .dam-viz-modal__body,#damMediaPreview .dam-viz-modal__body{",
      "--dam-viz-modal-badges-title-gap:12px;gap:16px!important;}",
      "#damVizModal #damVizModalBadges,#damMediaPreview #damMediaPreviewBadges{",
      "margin-bottom:0!important;padding-bottom:2px!important;}",
      "#damVizModal .dam-viz-modal__body > h4.dam-viz-modal__title,",
      "#damVizModal .dam-viz-modal__body > .dam-viz-card__badges + .dam-viz-modal__title,",
      "#damVizModal .dam-viz-modal__body > #damVizModalBadges + .dam-viz-modal__title,",
      "#damMediaPreview .dam-viz-modal__body > .dam-media-preview__title-block{",
      "margin-top:0!important;padding-top:6px!important;}",
      "#damMediaPreview .dam-media-preview__title-block > .dam-viz-modal__title{",
      "margin-top:0!important;padding-top:0!important;}",
      /* 2) branding card ID chip: full string, no ellipsis / no mid-ID clip */
      ".dam-branding-card .dam-branding-card__id-chip,",
      ".dam-branding-card button.dam-branding-card__id-chip,",
      ".dam-viz-card.dam-branding-card button.dam-viz-badge.dam-branding-card__id-chip{",
      "display:inline-flex!important;align-items:center!important;gap:4px!important;",
      "width:fit-content!important;min-width:fit-content!important;max-width:none!important;",
      "flex:0 0 auto!important;overflow:visible!important;text-overflow:clip!important;",
      "white-space:nowrap!important;padding:6px 20px!important;box-sizing:border-box!important;}",
      ".dam-branding-card .dam-branding-card__id-chip .uil{",
      "flex:0 0 auto!important;margin:0!important;}",
      ".dam-branding-card.dam-viz-card,.dam-branding-card .dam-viz-card__title-wrap,",
      ".dam-branding-card .dam-viz-card__body{overflow:visible!important;}",
      /* 3) minus ONLY while Shift. Hide without #id so show (#id + .is-shift-*) always wins.
         brandComposer20260721a: assoc + variant-grid + all-files quality tiles. */
      ".dam-media-preview__assoc-item .dam-assoc-quick-minus,",
      ".dam-media-preview__all-file .dam-assoc-quick-minus{",
      "opacity:0!important;visibility:hidden!important;pointer-events:none!important;}",
      "#damVizModal .dam-media-preview__assoc-grid.is-shift-hover .dam-assoc-quick-minus,",
      "#damMediaPreview .dam-media-preview__assoc-grid.is-shift-hover .dam-assoc-quick-minus,",
      "#damVizModal .dam-media-preview__variant-grid.is-shift-hover .dam-assoc-quick-minus,",
      "#damMediaPreview .dam-media-preview__variant-grid.is-shift-hover .dam-assoc-quick-minus,",
      "#damVizModal .dam-media-preview__all-files.is-shift-hover .dam-assoc-quick-minus,",
      "#damMediaPreview .dam-media-preview__all-files.is-shift-hover .dam-assoc-quick-minus,",
      "#damVizModal .dam-assoc-quick-minus.is-shift-visible,",
      "#damMediaPreview .dam-assoc-quick-minus.is-shift-visible{",
      "opacity:1!important;visibility:visible!important;pointer-events:auto!important;}",
      /* 4) +N badge up 5px vs prior top:4px */
      ".dam-media-preview__assoc-variant-badge{top:-1px!important;}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }
  window.__damInjectUiHardFixes = injectUiHardFixes;

  /** STREFA A3: style wstrzykniete (nie ruszamy dam-brand.css / dam-branding.css). */
  function injectA3Styles() {
    var st = document.getElementById("dam-a3-styles");
    if (!st) {
      st = document.createElement("style");
      st.id = "dam-a3-styles";
      (document.head || document.documentElement).appendChild(st);
    }
    st.textContent = [
      /* Task 34: "Brak wizualizacji" = muted, nigdy danger/czerwony */
      ".dam-viz-modal__missing-langs-label,",
      ".dam-viz-modal__missing-langs-label--muted,",
      "#damMediaPreview .dam-viz-modal__missing-langs-label,",
      "#damVizModal .dam-viz-modal__missing-langs-label{",
      "color:var(--dam-text-muted,#8f8b9f)!important;font-weight:600;}",
      ".dam-viz-badge--lang-missing,",
      ".dam-viz-badge--lang-muted,",
      "#damMediaPreview .dam-viz-badge--lang-missing,",
      "#damVizModal .dam-viz-badge--lang-missing{",
      "background:var(--dam-surface-muted,#f1f3f6)!important;",
      "color:var(--dam-text-muted,#6b6b76)!important;",
      "border:1px solid var(--dam-border,#e2e2ea)!important;}",
      ".dam-viz-thumb__noviz,",
      "#damMediaPreview .dam-viz-thumb__noviz,",
      ".dam-media-preview__variant-placeholder--noviz{",
      "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;",
      "color:var(--dam-text-muted,#8f8b9f)!important;",
      "background:var(--dam-surface-muted,#f1f3f6)!important;",
      "border:1px dashed var(--dam-border,#e2e2ea);",
      "border-radius:8px;min-height:48px;padding:6px;box-sizing:border-box;}",
      ".dam-viz-thumb__noviz span,",
      ".dam-media-preview__variant-placeholder--noviz span{",
      "color:inherit!important;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;",
      "text-align:center;line-height:1.2;}",
      /* Task 35: zwijalna grupa ELEMENTY */
      ".dam-media-preview__elementy{",
      "margin-top:10px;padding-top:10px;border-top:1px solid var(--dam-border,#ececf1);}",
      ".dam-media-preview__elementy-toggle{",
      "display:inline-flex;align-items:center;gap:6px;width:100%;justify-content:flex-start;",
      "background:var(--dam-surface-muted,#f5f6fa);border:1px solid var(--dam-border,#e2e2ea);",
      "color:var(--dam-text-muted,#6b6b76);border-radius:8px;padding:8px 10px;",
      "font-size:12px;font-weight:600;letter-spacing:.02em;cursor:pointer;}",
      ".dam-media-preview__elementy-toggle:hover{background:#eeeef3;color:var(--dam-text,#464255);}",
      ".dam-media-preview__elementy-toggle:focus-visible{outline:2px solid var(--dam-primary,#ab54db);outline-offset:2px;}",
      ".dam-media-preview__elementy-panel[hidden]{display:none!important;}",
      ".dam-media-preview__elementy-panel{margin-top:8px;max-height:min(240px,32vh);overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;}",
      ".dam-assoc-pane-split .dam-media-preview__elementy-panel{max-height:none!important;}",
      ".dam-media-preview__elementy-panel .dam-media-preview__assoc-grid{flex:none;max-height:none;overflow:visible;overscroll-behavior:auto;}",
      ".dam-media-preview__elementy-hint{",
      "margin:0 0 8px;font-size:11px;line-height:1.35;color:var(--dam-text-muted,#8f8b9f);}",
      /* Task 37: resizer CTA + ostrzezenie */
      ".dam-media-preview__resizer-wrap{margin-top:10px;display:flex;flex-direction:column;gap:8px;}",
      ".dam-media-preview__resizer-btn{",
      "display:inline-flex;align-items:center;gap:6px;justify-content:center;",
      "min-height:40px;padding:8px 12px;border-radius:8px;cursor:pointer;",
      "border:1px solid color-mix(in srgb,var(--dam-primary,#ab54db) 35%,var(--dam-border,#e2e2ea));",
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 8%,#fff);",
      "color:var(--dam-text,#464255);font-size:12px;font-weight:600;}",
      ".dam-media-preview__resizer-btn:hover{",
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 14%,#fff);}",
      ".dam-media-preview__resizer-btn:focus-visible{outline:2px solid var(--dam-primary,#ab54db);outline-offset:2px;}",
      ".dam-media-preview__resizer-warn{",
      "margin:0;font-size:11px;line-height:1.4;color:var(--dam-text-muted,#6b6b76);",
      "background:#f7f7f9;border:1px solid var(--dam-border,#e2e2ea);border-radius:8px;padding:8px 10px;}",
      /* Task 38: placeholder w slocie miniatury - BEZ duplikatu nazwy/ID (sa pod kafelkiem) */
      ".dam-media-preview__assoc-thumb--fallback{",
      "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;",
      "width:70px;height:70px;min-height:70px;max-height:70px;padding:4px;box-sizing:border-box;",
      "overflow:hidden;",
      "background:linear-gradient(180deg,#f3f2f6 0%,#e9e8ee 100%);",
      "color:#5c5868;border:1px dashed #c9c7d2;border-radius:8px;text-align:center;}",
      ".dam-media-preview__assoc-thumb--fallback i{font-size:20px;color:#7a758a;line-height:1;}",
      ".dam-media-preview__assoc-thumb--fallback .dam-assoc-thumb-fallback__hint{",
      "display:block;font-size:8px;font-weight:500;line-height:1.15;color:#8b8796;",
      "max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      /* Elementy panel: stabilna siatka, czytelny rytm wierszy (bez overlap) */
      ".dam-media-preview__elementy-panel .dam-media-preview__assoc-grid{",
      "display:grid!important;grid-template-columns:repeat(auto-fill,minmax(92px,1fr))!important;",
      "gap:14px 10px!important;align-items:start!important;}",
      ".dam-media-preview__elementy-panel .dam-media-preview__assoc-item{",
      "min-width:0;max-width:100%;align-items:stretch;gap:5px!important;padding-bottom:2px;}",
      ".dam-media-preview__elementy-panel .dam-media-preview__assoc-name{",
      "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;",
      "overflow:hidden;max-height:2.6em;line-height:1.25;}",
      ".dam-media-preview__elementy-panel .dam-media-preview__assoc-index{",
      "margin-top:0!important;align-self:center;}",
      /* Collapse extras: viz modal uzywa #damVizModalAssoc, nie tylko media-preview id. */
      "#damMediaPreviewLinkedAssets.is-collapsed-assets .dam-media-preview__assoc-item--extra,",
      "#damVizModalAssoc.is-collapsed-assets .dam-media-preview__assoc-item--extra,",
      ".dam-media-preview__assoc-grid.is-collapsed-assets .dam-media-preview__assoc-item--extra{",
      "display:none!important;}",
      /* Assoc group count: styl jak .dam-tag-more (+N), lewy gorny - prawy = minus. */
      ".dam-media-preview__assoc-item--group{position:relative;}",
      ".dam-media-preview__assoc-item--group .dam-media-preview__assoc-thumb-btn{position:relative;}",
      ".dam-media-preview__assoc-variant-badge{",
      "position:absolute;top:-1px;left:4px;z-index:2;min-width:44px;min-height:24px;padding:3px 12px;",
      "display:inline-flex;align-items:center;justify-content:center;",
      "border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.01em;",
      "font-variant-numeric:tabular-nums;line-height:1.35;",
      "background:#fff!important;color:var(--dam-primary,#ab54db)!important;",
      "border:1px solid color-mix(in srgb,var(--dam-primary,#ab54db) 35%,transparent)!important;",
      "box-shadow:0 1px 2px rgba(40,36,56,.08);pointer-events:none;}",
      ".dam-media-preview__assoc-item--group .dam-media-preview__assoc-name{",
      "padding-right:2px;}",
    ].join("");
    /* Re-assert Shift-gated minus / title gap AFTER a3 (beats concurrent always-visible). */
    injectUiHardFixes();
  }
  if (document.head) injectA3Styles();
  else document.addEventListener("DOMContentLoaded", injectA3Styles);

  /**
   * Content modals: Shift+Admin PLUS gate + dark surfaces.
   * HARD: admin affordances visible ONLY while Shift held (class is-shift-revealed).
   */
  function injectContentModalChrome() {
    var id = "dam-content-modal-chrome-20260722";
    var st = document.getElementById(id);
    if (!st) {
      st = document.createElement("style");
      st.id = id;
      (document.head || document.documentElement).appendChild(st);
    }
    st.textContent = [
      "#damVizModalBadges,#damMediaPreviewBadges,",
      "#damVizModal .dam-viz-modal__meta-block--badges .dam-viz-card__badges,",
      "#damMediaPreview .dam-viz-modal__meta-block--badges .dam-viz-card__badges{",
      "display:flex;flex-wrap:wrap;align-items:center;gap:6px;}",
      /* Tag PLUS: hidden unless html.is-shift-revealed (Shift+Admin) */
      ".dam-modal-tag-plus,.dam-admin-shift-plus--tag{",
      "display:inline-flex;align-items:center;justify-content:center;",
      "width:0;height:0;min-width:0;min-height:0;padding:0;margin:0;border:0;",
      "overflow:hidden;opacity:0;visibility:hidden;pointer-events:none;",
      "border-radius:999px;flex:0 0 auto;",
      "transition:opacity .12s ease,visibility .12s ease;}",
      "html.is-shift-revealed .dam-modal-tag-plus,",
      "html.is-shift-revealed .dam-admin-shift-plus--tag,",
      ".dam-modal-tag-plus.is-shift-revealed,",
      ".dam-admin-shift-plus--tag.is-shift-revealed{",
      "width:28px;height:28px;min-width:28px;min-height:28px;",
      "border:1.5px solid color-mix(in srgb,var(--dam-primary,#ab54db) 55%,var(--dam-border,#d7d7e0));",
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 16%,var(--dam-surface,#fff));",
      "color:var(--dam-primary,#7a3aa8);cursor:pointer;",
      "opacity:1;visibility:visible;pointer-events:auto;",
      "box-shadow:0 1px 4px color-mix(in srgb,var(--dam-primary,#ab54db) 28%,transparent);}",
      ".dam-modal-tag-plus i,.dam-admin-shift-plus--tag i{font-size:16px;line-height:1;}",
      ".dam-modal-tag-plus:focus-visible,.dam-admin-shift-plus--tag:focus-visible{",
      "outline:2px solid var(--dam-primary,#ab54db);outline-offset:2px;}",
      /* Square Dodaj tile (assoc / material / product variants) — Shift+Admin only */
      ".dam-media-preview__assoc-plus-tile,.dam-admin-shift-plus--tile{",
      "display:none;flex-direction:column;align-items:center;justify-content:center;gap:2px;",
      "box-sizing:border-box;width:70px;height:70px;min-width:70px;min-height:70px;",
      "max-width:70px;max-height:70px;aspect-ratio:1;padding:4px;",
      "border:1.5px dashed color-mix(in srgb,var(--dam-primary,#ab54db) 45%,var(--dam-border,#d7d7e0));",
      "border-radius:8px;background:color-mix(in srgb,var(--dam-primary,#ab54db) 6%,var(--dam-surface,#fff));",
      "color:var(--dam-primary,#7a3aa8);cursor:pointer;font-size:10px;font-weight:600;",
      "justify-self:start;align-self:start;line-height:1.15;}",
      "html.is-shift-revealed .dam-media-preview__assoc-plus-tile,",
      "html.is-shift-revealed .dam-admin-shift-plus--tile,",
      ".dam-media-preview__assoc-plus-tile.is-shift-revealed,",
      ".dam-admin-shift-plus--tile.is-shift-revealed,",
      ".dam-media-preview__assoc-grid.is-shift-hover .dam-media-preview__assoc-plus-tile,",
      ".dam-media-preview__variant-grid.is-shift-hover .dam-media-preview__assoc-plus-tile{",
      "display:flex!important;}",
      ".dam-media-preview__assoc-plus-tile i,.dam-admin-shift-plus--tile i{font-size:20px;line-height:1;}",
      ".dam-media-preview__assoc-plus-tile span,.dam-admin-shift-plus--tile span{",
      "max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".dam-viz-modal__variant-strip .dam-media-preview__assoc-plus-tile,",
      ".dam-viz-modal__product-variants .dam-media-preview__assoc-plus-tile{",
      "width:64px;height:64px;min-width:64px;min-height:64px;max-width:64px;max-height:64px;}",
      "html[data-theme=\"dark\"] .dam-media-preview__assoc-plus-tile,",
      "html[data-theme=\"dark\"] .dam-admin-shift-plus--tile,",
      "html[data-theme=\"dark\"] html.is-shift-revealed .dam-modal-tag-plus,",
      "html[data-theme=\"dark\"].is-shift-revealed .dam-modal-tag-plus{",
      "background:color-mix(in srgb,var(--dam-primary,#ab54db) 14%,var(--dam-surface,#201f28));",
      "color:color-mix(in srgb,var(--dam-primary,#ab54db) 80%,#fff);}",
      /* --- Dark content modals --- */
      "html[data-theme=\"dark\"] .dam-viz-modal-box,",
      "html[data-theme=\"dark\"] #damVizModal .dam-viz-modal-box,",
      "html[data-theme=\"dark\"] #damMediaPreview .dam-viz-modal-box{",
      "background:var(--dam-surface,#201f28)!important;color:var(--dam-text,#eeeaf6);",
      "box-shadow:0 16px 56px rgba(0,0,0,.55);}",
      "html[data-theme=\"dark\"] .dam-viz-modal-close{",
      "background:var(--dam-surface-elevated,#2a2833)!important;",
      "border-color:var(--dam-border,#2c2b36)!important;color:var(--dam-text,#eeeaf6)!important;}",
      "html[data-theme=\"dark\"] .dam-viz-modal__thumb,",
      "html[data-theme=\"dark\"] #damVizModal .dam-viz-modal__thumb,",
      "html[data-theme=\"dark\"] #damMediaPreview .dam-viz-modal__thumb{",
      "background:var(--dam-surface-muted,#17161e)!important;}",
      "html[data-theme=\"dark\"] .dam-viz-modal__thumb img{background:transparent!important;}",
      "html[data-theme=\"dark\"] .dam-viz-modal__body,",
      "html[data-theme=\"dark\"] #damVizModal .dam-viz-modal__body,",
      "html[data-theme=\"dark\"] #damMediaPreview .dam-viz-modal__body{",
      "background:var(--dam-surface,#201f28)!important;color:var(--dam-text,#eeeaf6);}",
      "html[data-theme=\"dark\"] .dam-viz-modal__title,",
      "html[data-theme=\"dark\"] #damMediaPreviewTitle,",
      "html[data-theme=\"dark\"] .dam-media-preview__title-base{",
      "color:var(--dam-text,#eeeaf6)!important;}",
      "html[data-theme=\"dark\"] .dam-viz-modal__filename,",
      "html[data-theme=\"dark\"] .dam-viz-modal__carrier,",
      "html[data-theme=\"dark\"] .dam-media-preview__assoc-label,",
      "html[data-theme=\"dark\"] .dam-media-preview__assoc-empty{",
      "color:var(--dam-text-muted,#b8b3c6)!important;}",
      "html[data-theme=\"dark\"] .dam-viz-modal__zoom{",
      "background:color-mix(in srgb,var(--dam-surface,#201f28) 92%,transparent)!important;",
      "border-color:var(--dam-border,#2c2b36)!important;}",
      "html[data-theme=\"dark\"] .dam-viz-modal__zoom-btn,",
      "html[data-theme=\"dark\"] .dam-viz-modal__zoom-label{color:var(--dam-text,#eeeaf6)!important;}",
    ].join("");
  }
  if (document.head) injectContentModalChrome();
  else document.addEventListener("DOMContentLoaded", injectContentModalChrome);

  var _adminShiftDown = false;
  var _adminShiftBound = false;

  /** Existing privilege: admin | power_user (DamTagEdit / DamAssocEdit). */
  function isAdminForShiftPlus() {
    if (
      window.DamTagEdit &&
      typeof window.DamTagEdit.isPrivileged === "function" &&
      window.DamTagEdit.isPrivileged()
    ) {
      return true;
    }
    try {
      var role =
        (window.DamAuth && typeof window.DamAuth.role === "function" && window.DamAuth.role()) ||
        localStorage.getItem("dam_role") ||
        "";
      role = String(role || "").toLowerCase();
      return role === "admin" || role === "power_user";
    } catch (eRole) {
      return false;
    }
  }

  /**
   * Global Shift+Admin reveal for modal PLUS controls.
   * @param {boolean} down - Shift keydown
   */
  function showAdminShiftPlus(down) {
    injectContentModalChrome();
    var reveal = !!down && isAdminForShiftPlus();
    _adminShiftDown = reveal;
    document.documentElement.classList.toggle("is-shift-revealed", reveal);
    document.documentElement.classList.toggle("dam-shift-held", reveal);
    document
      .querySelectorAll(
        ".dam-modal-tag-plus, .dam-admin-shift-plus, .dam-admin-shift-plus--tag, .dam-admin-shift-plus--tile, .dam-media-preview__assoc-plus-tile"
      )
      .forEach(function (el) {
        el.classList.toggle("is-shift-revealed", reveal);
      });
    return reveal;
  }

  function ensureAdminShiftPlusLatch() {
    if (_adminShiftBound) return;
    _adminShiftBound = true;
    window.addEventListener(
      "keydown",
      function (e) {
        if (e.key === "Shift") showAdminShiftPlus(true);
      },
      true
    );
    window.addEventListener(
      "keyup",
      function (e) {
        if (e.key === "Shift") showAdminShiftPlus(false);
      },
      true
    );
    window.addEventListener(
      "blur",
      function () {
        showAdminShiftPlus(false);
      },
      true
    );
  }

  function mountAdminShiftPlus(el, kind) {
    if (!el || !isAdminForShiftPlus()) return null;
    ensureAdminShiftPlusLatch();
    el.classList.add("dam-admin-shift-plus");
    if (kind === "tag") el.classList.add("dam-admin-shift-plus--tag");
    if (kind === "tile") el.classList.add("dam-admin-shift-plus--tile");
    el.classList.toggle("is-shift-revealed", _adminShiftDown);
    return el;
  }

  window.DamAdminShiftPlus = {
    show: showAdminShiftPlus,
    ensureLatch: ensureAdminShiftPlusLatch,
    isAdmin: isAdminForShiftPlus,
    isRevealed: function () {
      return _adminShiftDown;
    },
    mount: mountAdminShiftPlus,
  };
  window.showAdminShiftPlus = showAdminShiftPlus;

  /**
   * Shift+Admin PLUS next to modal tag row → DamTagEdit.openTagPicker.
   * ctx: { mode: "branding"|"viz"|"product", asset?, product?, kind? }
   */
  function ensureModalTagPlusUx(badgesEl, ctx) {
    injectContentModalChrome();
    if (!badgesEl || !isAdminForShiftPlus()) {
      var stale = badgesEl && badgesEl.querySelector(".dam-modal-tag-plus");
      if (stale) stale.remove();
      return null;
    }
    ensureAdminShiftPlusLatch();
    ctx = ctx || {};
    var plus = badgesEl.querySelector(".dam-modal-tag-plus");
    if (!plus) {
      plus = document.createElement("button");
      plus.type = "button";
      plus.className = "dam-modal-tag-plus dam-admin-shift-plus dam-admin-shift-plus--tag";
      plus.setAttribute("aria-label", "Dodaj tag");
      plus.setAttribute(
        "data-dam-tip",
        "Admin: przytrzymaj Shift, potem kliknij +, aby dodać tag"
      );
      plus.title = "Admin: przytrzymaj Shift, potem kliknij +, aby dodać tag";
      plus.innerHTML = '<i class="uil uil-plus" aria-hidden="true"></i>';
      badgesEl.appendChild(plus);
    }
    mountAdminShiftPlus(plus, "tag");
    if (!plus._damTagPlusBound) {
      plus._damTagPlusBound = true;
      plus.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!_adminShiftDown || !isAdminForShiftPlus()) return;
        if (!window.DamTagEdit || typeof window.DamTagEdit.openTagPicker !== "function") {
          return;
        }
        var mode = ctx.mode || "branding";
        var product = ctx.product || null;
        var asset = ctx.asset || null;
        var isProductModal = mode === "viz" || mode === "product";
        var brandingId =
          (asset && (asset.id || asset.branding_asset_id)) ||
          (badgesEl.getAttribute && badgesEl.getAttribute("data-branding-asset-id")) ||
          "";
        var productId =
          (product && (product.id || product.product_id)) ||
          (asset && (asset.product_id || (asset.linked_product_ids && asset.linked_product_ids[0]))) ||
          "";
        var productName =
          (product && (product.name || product.display_name || product.product_name)) ||
          (asset && asset.name) ||
          "";
        /* Macrotask: never build tag picker in the same tick as click (freeze). */
        setTimeout(function () {
          try {
            if (isProductModal && window.DamTagEdit && typeof window.DamTagEdit.openProductTagsMultiPicker === "function") {
              window.DamTagEdit.openProductTagsMultiPicker(plus, {
                product: product,
                productId: productId || "",
                productName: productName || "",
                tagGroups: ctx.tagGroups || (product && product.tag_groups) || {},
                onTagsApplied: ctx.onTagsApplied,
              });
              return;
            }
            if (!window.DamTagEdit || typeof window.DamTagEdit.openTagPicker !== "function") {
              return;
            }
            var kind =
              ctx.kind ||
              (mode === "branding" ? "appearance" : "carrier");
            window.DamTagEdit.openTagPicker(plus, {
              kind: kind,
              value: "",
              currentCode: "",
              brandingAssetId: brandingId || "",
              productId: productId || "",
              productName: productName || "",
              revisionPath:
                (product && (product.revision_path || product.revision_folder)) ||
                (asset && asset.path) ||
                "",
              brand: (asset && asset.brand) || (product && product.brand) || "",
            });
          } catch (errTag) {
            console.error("[DamMediaPreview] openTagPicker failed", errTag);
          }
        }, 0);
      });
    }
    if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
      window.DamTooltips.bind(badgesEl);
    }
    return plus;
  }

  /** Tile skeleton + per-row opacity fade (own id — always refresh, no stale A3 early-return). */
  function injectAssocSkeletonStyles() {
    var id = "dam-assoc-skel-styles";
    var st = document.getElementById(id);
    if (!st) {
      st = document.createElement("style");
      st.id = id;
      (document.head || document.documentElement).appendChild(st);
    }
    st.textContent = [
      ".dam-media-preview__assoc-grid.dam-media-preview__assoc-grid--loading{",
      "display:grid!important;",
      "grid-template-columns:repeat(5,minmax(0,1fr))!important;",
      "gap:12px 10px!important;",
      "align-content:start!important;",
      "align-items:start!important;",
      "justify-items:stretch!important;",
      "width:100%;min-width:0;min-height:0;",
      /* Inner padding so loading tiles breathe (vizCtaNav20260721b) */
      "padding:14px 12px 16px!important;box-sizing:border-box;",
      "overflow:hidden!important;overscroll-behavior:none;",
      "-webkit-mask-image:none!important;mask-image:none!important;}",
      ".dam-media-preview__assoc-grid--loading .dam-assoc-skeleton{",
      "display:flex;flex-direction:column;align-items:center;gap:6px;",
      "width:100%;max-width:110px;justify-self:start;",
      "box-sizing:border-box;margin:0;padding:8px 6px;",
      "background:transparent!important;border:none!important;",
      "border-radius:0!important;aspect-ratio:auto!important;height:auto!important;",
      "opacity:var(--dam-skel-op,1);pointer-events:none;}",
      ".dam-media-preview__assoc-grid--loading .dam-assoc-skeleton__thumb{",
      "display:block;width:100%;aspect-ratio:1/1;border-radius:6px;",
      "background:#e2e4ec;border:1px solid #d0d2dc;box-sizing:border-box;",
      "position:relative;overflow:hidden;}",
      ".dam-media-preview__assoc-grid--loading .dam-assoc-skeleton__thumb::after{",
      "content:\"\";position:absolute;inset:0;transform:translateX(-100%);",
      "background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);",
      "animation:dam-skel-shimmer 1.5s ease-in-out infinite;}",
      ".dam-media-preview__assoc-grid--loading .dam-assoc-skeleton__line{",
      "display:block;height:7px;width:82%;border-radius:4px;background:#eceef4;}",
      ".dam-media-preview__assoc-grid--loading .dam-assoc-skeleton__line--short{",
      "width:52%;height:6px;background:#f0f1f6;}",
      ".dam-media-preview__assoc-grid--loading .dam-assoc-skeleton.is-skel-last{",
      "-webkit-mask-image:linear-gradient(to bottom,#000 0%,transparent 50%);",
      "mask-image:linear-gradient(to bottom,#000 0%,transparent 50%);",
      "-webkit-mask-size:100% 100%;mask-size:100% 100%;}",
      ".dam-viz-modal-box--assoc-split .dam-viz-modal__assoc-pane > .dam-media-preview__assoc-col--materials > .dam-media-preview__assoc-grid.dam-media-preview__assoc-grid--loading,",
      ".dam-viz-modal-box--assoc-split .dam-viz-modal__assoc-pane > .dam-viz-modal__assoc > .dam-media-preview__assoc-grid.dam-media-preview__assoc-grid--loading{",
      "grid-template-columns:repeat(5,minmax(0,1fr))!important;",
      "align-items:start!important;overflow:hidden!important;",
      "padding:14px 12px 16px!important;",
      "-webkit-mask-image:none!important;mask-image:none!important;}",
      "@keyframes dam-skel-shimmer{100%{transform:translateX(100%);}}",
      "@media (prefers-reduced-motion:reduce){",
      ".dam-media-preview__assoc-grid--loading .dam-assoc-skeleton__thumb::after{",
      "animation:none!important;display:none!important;}}",
    ].join("");
  }
  if (document.head) injectAssocSkeletonStyles();
  else document.addEventListener("DOMContentLoaded", injectAssocSkeletonStyles);

  function pathNormSlashes(p) {
    return String(p || "").replace(/\//g, "\\");
  }

  /** SUROWE ELEMENTY: tylko `2 - PROJEKT/links` pod `01 - PRODUKTY` (PI branding.element_assoc).
   *  NIE: ARCHIWUM/.../links, paczka_Sial/.../projekt/links, ani dowolny folder LINKS. */
  function isLinksRawPath(path) {
    var n = pathNormSlashes(path).toLowerCase();
    if (!n) return false;
    if (n.indexOf("\\-- archiwum") >= 0 || n.indexOf("\\archiwum\\") >= 0) return false;
    var underProducts =
      n.indexOf("\\01 - produkty\\") >= 0 || n.indexOf("\\01 - products\\") >= 0;
    if (!underProducts) return false;
    if (n.indexOf("\\2 - projekt\\links\\") >= 0) return true;
    if (/\\2 - projekt\\links$/i.test(n)) return true;
    return false;
  }

  /** Element z Links musi lezec w biezacej rewizji (gdy UI poda revision_path). */
  function pathUnderRevision(assetPath, revisionPath) {
    var a = String(assetPath || "")
      .replace(/\\/g, "/")
      .toLowerCase();
    var r = String(revisionPath || "")
      .replace(/\\/g, "/")
      .toLowerCase()
      .replace(/\/+$/, "");
    if (!a || !r) return true;
    return a === r || a.indexOf(r + "/") === 0;
  }

  /** Folder ELEMENTY (dowolny slash) — matte dematte w mostcie. */
  function isElementyFolderPath(path) {
    var n = String(path || "")
      .replace(/\//g, "\\")
      .toLowerCase();
    if (!n) return false;
    return n.indexOf("\\elementy\\") >= 0 || /\\elementy$/i.test(n);
  }

  /** GOTOWE ELEMENTY: ...\\1 - MATERIALY\\ELEMENTY\\... */
  function isMaterialyElementyPath(path) {
    var n = pathNormSlashes(path).toLowerCase();
    if (!n) return false;
    /* pathNormSlashes -> forward slash; sprawdz obie formy. */
    if (
      (n.indexOf("/1 - materia") >= 0 || n.indexOf("\\1 - materia") >= 0) &&
      (n.indexOf("/elementy") >= 0 || n.indexOf("\\elementy") >= 0)
    ) {
      return true;
    }
    return isElementyFolderPath(path);
  }

  function isElementPath(path) {
    return isLinksRawPath(path) || isMaterialyElementyPath(path);
  }

  /** Nazwa wyglada jak izolowany element (KULKA2, freepik splash), nie packshot. */
  function looksLikeIsolatedElementName(name) {
    var n = String(name || "");
    if (!n) return false;
    if (ELEMENT_NAME_RE.test(n)) return true;
    if (/^freepik__/i.test(n)) return true;
    if (/^kulka\d*/i.test(n.replace(/\.[a-z0-9]+$/i, ""))) return true;
    return false;
  }

  function assetMatchesElementAssoc(x) {
    if (!x) return false;
    var name = String(x.name || "");
    if (looksLikeIsolatedElementName(name)) return true;
    /* Tag/blob "skladniki|owoce" — tylko gdy to NIE wyglada na packshot/kampanie */
    var role = String(x.asset_role || "").toLowerCase();
    if (role === "packshot" || role === "web_hero_slider" || role === "web_bundle_tile") return false;
    var blob = String(x.search_blob || "");
    var tags = Array.isArray(x.tags) ? x.tags.join(" ") : "";
    var appearance = Array.isArray(x.appearance_tags) ? x.appearance_tags.join(" ") : "";
    return ELEMENT_ASSOC_RE.test(blob + " " + tags + " " + appearance + " " + name);
  }

  /** Packshot / wizka drukowa — NIGDY do kubelkow Elementy ani do Skojarzonych materialow. */
  function looksLikePackshotOrPrintAsset(x) {
    if (!x) return false;
    var role = String(x.asset_role || "").toLowerCase();
    if (role === "packshot") return true;
    var name = String(x.name || "");
    var path = normSlashesLower(x.path);
    if (/_wiz_|_enface_|druk_cmyk|print_cmyk|hi-res_|low-res_/i.test(name)) return true;
    if (/\/(druk_cmyk|druk_rgb|print|wizki|visuals|enface)\//i.test(path)) return true;
    /* Prefiks wiz_ / packshoty GC/DK z kodem RGB|CMYK (takze z Marketing/Archiwum/WP). */
    if (/^wiz[_-]/i.test(name)) return true;
    if (/^dk_kulki_/i.test(name)) return true;
    if (/^gc_.*_(cmyk|rgb)([-_.]|$)/i.test(name)) return true;
    if (/^gc_(balls|kulki|bar|minibar|delight)/i.test(name) && /_\d{6,}/.test(name)) return true;
    if (/\bv-\d{5,}[-_].*enface/i.test(name)) return true;
    /* WP size-suffixed packshot thumbs: name-500x708.png */
    if (/^gc_|^dk_|^wiz_/i.test(name) && /-\d{2,4}x\d{2,4}\.(png|jpe?g|webp)$/i.test(name)) {
      return true;
    }
    return false;
  }

  /**
   * 3 kubelki: "material" (branding marketingowy), "element-link" (Surowe elementy
   * z Links), "element-ready" (MATERIALY ELEMENTY albo nazwy KULKA / freepik).
   * HARD: elementy NIGDY w glownym gridzie SKOJARZONE MATERIALY.
   * HARD: NIE uzywaj samego search_blob "skladniki" — packshoty maja to w blobie.
   */
  function classifyAssocAsset(x) {
    if (!x) return "material";
    /* Packshot/wizka — nie element; do material trafi i i tak odpadnie w isVisualizationAsset. */
    if (isLinksRawPath(x.path)) return "element-link";
    if (isMaterialyElementyPath(x.path)) return "element-ready";
    /* KULKA2 / KULKI - … / freepik — izolowane elementy (NIE packshot produktowy). */
    if (!looksLikePackshotOrPrintAsset(x) && looksLikeIsolatedElementName(x.name)) {
      return "element-ready";
    }
    return "material";
  }

  /**
   * HARD (user 2026-07-20): pliki zrodlowe (wektor/AI/EPS, PDF, PSD i inne "source")
   * NIGDY nie moga trafic do "Skojarzone materialy" ani do elementow w tym podglądzie -
   * to widok dla materialow marketingowych, nie miejsce na zrodla graficzne.
   */
  var ASSOC_EXCLUDE_MEDIA_TYPES = { vector: 1, document: 1, source: 1 };
  /** Rozszerzenia zrodlowe / edytowalne — NIGDY w Skojarzone materialy (jak Branding grid). */
  var ASSOC_FORBIDDEN_EXTS = {
    ai: 1,
    psd: 1,
    psb: 1,
    pdf: 1,
    eps: 1,
    indd: 1,
    idml: 1,
    svg: 1,
    doc: 1,
    docx: 1,
    xls: 1,
    xlsx: 1,
    ppt: 1,
    pptx: 1,
  };
  var ASSOC_MARKETING_RASTER_EXTS = { jpg: 1, jpeg: 1, png: 1, webp: 1, gif: 1, bmp: 1, tif: 1, tiff: 1 };

  /**
   * HARD GLOBAL (user 2026-07-20): wektor/PDF/PSD/AI/source + heurystyki sciezki.
   * Branding grid nie pokazuje tych plikow jako skojarzone materialy — ten sam zakaz.
   */
  function isSourceLikeAsset(x) {
    if (!x) return true;
    var mt = String(x.media_type || "").toLowerCase();
    if (ASSOC_EXCLUDE_MEDIA_TYPES[mt]) return true;
    var ext = fileExt(x.name || x.path);
    if (ASSOC_FORBIDDEN_EXTS[ext]) return true;
    if (EDITABLE_EXTS && EDITABLE_EXTS[ext]) return true;
    var path = normSlashesLower(x.path);
    if (path) {
      var segs = path.split("/");
      for (var si = 0; si < segs.length; si++) {
        if (SOURCE_DIR_RE && SOURCE_DIR_RE.test(segs[si])) return true;
      }
      if (/\/(zrodla|zrodlo|zrodlowe|sources|src|edytowalne)\//.test(path)) return true;
    }
    return false;
  }

  /** Miniatura sensowna dla listy skojarzen (JPG/PNG/web + wideo) — bez PSD/AI/PDF. */
  function hasUsableMarketingPreview(x) {
    if (!x || isSourceLikeAsset(x)) return false;
    if (isVideoAsset(x)) return true;
    var ext = fileExt(x.name || x.path);
    return !!ASSOC_MARKETING_RASTER_EXTS[ext];
  }

  /** Telefon / dump IMG_* / influencer selfie - NIGDY jako material marketingowy w assoc. */
  function isLikelyPhoneDumpAsset(x) {
    if (!x) return false;
    var name = String(x.name || "");
    var base = name.replace(/\.[a-z0-9]+$/i, "");
    if (/^IMG_\d{3,}/i.test(base) || /\bIMG_\d{3,}/i.test(name)) return true;
    if (/^DSC[_\-]?\d{3,}/i.test(base) || /^WA\d{4,}/i.test(base)) return true;
    /* M-META* w nazwie bez sciezki kampanii - zwykle dump Meta Ads, nie slider. */
    if (/\bM-META\d+/i.test(name) && !isCampaignMarketingPath(x.path)) return true;
    var path = normSlashesLower(x.path);
    /* WSPOLPRACE / influencerzy: zdjecia z telefonu spryskane na wiele produktow PROTEINA*. */
    if (
      path &&
      (/\/02\s*-\s*wsp[oó]lprace\b/.test(path) ||
        /\/(influencerzy|partnerzy|wspolprace|współprace)\b/.test(path)) &&
      (/^img[_\-\s]?\d+/i.test(base) || /\.(jpe?g|heic)$/i.test(name))
    ) {
      return true;
    }
    return false;
  }

  /** Material marketingowy do kolumny Skojarzone materialy (Branding policy). */
  function passesMarketingAssocMaterial(x, ctx) {
    if (!x) return false;
    if (isVisualizationAsset(x)) return false;
    if (isNoiseBrandKitAsset(x)) return false;
    if (isSourceLikeAsset(x)) return false;
    if (classifyAssocAsset(x) !== "material") return false;
    if (!hasUsableMarketingPreview(x)) return false;
    /* HARD: phone dump / IMG_* nigdy - nawet z rola social_asset (false positive V-6300711). */
    if (isLikelyPhoneDumpAsset(x)) return false;
    return isRelevantMaterialForProduct(x, ctx);
  }

  /** Elementy / Links — osobne kubelki, tez bez zrodel. */
  function passesMarketingAssocElement(x) {
    if (!x) return false;
    if (isVisualizationAsset(x)) return false;
    if (isSourceLikeAsset(x)) return false;
    if (classifyAssocAsset(x) === "material") return false;
    return hasUsableMarketingPreview(x);
  }

  /**
   * PI viz.assoc_no_visualization_loop: packshot / WIZKI / VISUALS / packshot-like
   * z Marketing NIGDY nie moga trafic do "Skojarzone materialy" przy wizualizacji.
   * (User 2026-07-20: zero innych wariantow tej samej wizki w skojarzeniach.)
   */
  function isVisualizationAsset(x) {
    if (!x) return false;
    if (looksLikePackshotOrPrintAsset(x)) return true;
    var role = String(x.asset_role || "").toLowerCase();
    if (role === "packshot") return true;
    var src = String(x.source || "").toLowerCase();
    if (src === "wizki" || src === "visuals" || src === "visualization") return true;
    var path = String(x.path || "")
      .replace(/\\/g, "/")
      .toLowerCase();
    if (!path) return false;
    if (/\/4\s*-\s*wizki\b/.test(path) || /\/4\s*-\s*visuals\b/.test(path)) return true;
    if (/\/wizki\//.test(path) || /\/visuals\//.test(path)) return true;
    if (/\bwizka[-_]/.test(path) || /\bwizki\b/.test(path)) return true;
    /* Packshoty wrzucone do Marketing/Archiwum/WP bez roli packshot. */
    if (/wp-content\/uploads/.test(path) && /\/(gc_|dk_|wiz_)/i.test("/" + String(x.name || ""))) {
      return true;
    }
    return false;
  }

  /** Globalny kit marki (ikony/logo) nie jest "skojarzonym materialem" produktu w modalu viz. */
  function isNoiseBrandKitAsset(x) {
    if (!x) return false;
    var path = String(x.path || "")
      .replace(/\\/g, "/")
      .toLowerCase();
    if (!path) return false;
    if (path.indexOf("/ikony/") >= 0) return true;
    if (path.indexOf("/03 - ikony") >= 0) return true;
    if (path.indexOf("/01 - logo") >= 0 && String(x.asset_role || "") === "brand_asset") return true;
    return false;
  }

  var VIZ_ASSOC_KEEP_ROLES = {
    web_hero_slider: 1,
    web_bundle_tile: 1,
    web_banner: 1,
    social_video: 1,
    social_asset: 1,
    ecommerce_ad: 1,
    pos_material: 1,
    key_visual: 1,
  };

  /**
   * Material marketingowy musi byc powiazany z produktem (rola WWW/social/POS
   * albo nazwa/indeks w sciezce kampanii). Sam indeks w packshocie NIE wystarcza.
   */
  function isCampaignMarketingPath(path) {
    var p = normSlashesLower(path);
    if (!p) return false;
    /* PL: SLIDERY / BANERY (folder) - \\bslider nie lapie "slidery". */
    if (
      /\/(www|social|pos|kampanie|campaigns|banery|banners|slidery?|ecommerce|e-commerce)\b/.test(p)
    ) {
      return true;
    }
    if (/\/(web_hero|web_bundle|key.?visual|kv)\b/.test(p)) return true;
    return false;
  }

  /** Nazwa kreacji marketingowej (SLIDER / M-SLI / baner) - nawet bez roli w indeksie. */
  function looksLikeMarketingCreativeName(x) {
    var name = String((x && x.name) || "");
    if (!name) return false;
    if (/\b(slider|baner|banner|key\s*visual|\breel\b|\bstory\b)/i.test(name)) return true;
    if (/\bM-(SLI|BAN|SHOP|META|VID|GOG|GIF|KV)\d*/i.test(name)) return true;
    return false;
  }

  function productSignalHits(x, ctx) {
    var blob = String(x.name || "") + " " + String(x.path || "") + " " + String(x.search_blob || "");
    blob = blob.toLowerCase();
    var idxBase = String((ctx && ctx.index) || "").split(".")[0];
    if (idxBase && idxBase.length >= 4 && blob.indexOf(idxBase.toLowerCase()) >= 0) return 99;
    var name = String((ctx && ctx.name) || "").toLowerCase();
    if (!name) return 0;
    var tokens = name.split(/[^a-z0-9ąćęłńóśźż]+/i).filter(function (t) {
      return t && t.length > 3;
    });
    /* "PROTEINA" / "KARMEL" - unikaj hitow na samym rodzajniku linii (za szeroko). */
    var specific = tokens.filter(function (t) {
      return !/^(proteina|protein|baton|batony|nowa|nowy|krem)$/i.test(t);
    });
    var use = specific.length ? specific : tokens;
    var hits = 0;
    use.forEach(function (t) {
      if (blob.indexOf(t) >= 0) hits += 1;
    });
    return hits;
  }

  /**
   * Material marketingowy przy wizce produktu.
   * HARD: phone dump juz odciety w passesMarketingAssocMaterial.
   * Spray (linkedN>=4) bez sygnalu produktu = out (IMG/WSPOLPRACE false+).
   * Wazne: NIE wymagaj hits>=2 przy jawnych skojarzeniach 1–3 produktow —
   * to wyzerowalo Nuggets (6300586) mimo realnych sliderow/meta.
   */
  function isRelevantMaterialForProduct(x, ctx) {
    if (!x) return false;
    if (isVisualizationAsset(x)) return false;
    var role = String(x.asset_role || "").toLowerCase();
    var hasKeepRole = !!VIZ_ASSOC_KEEP_ROLES[role];
    var campaignPath =
      isCampaignMarketingPath(x.path) || looksLikeMarketingCreativeName(x);
    if (!hasKeepRole && !campaignPath) return false;
    var hits = productSignalHits(x, ctx);
    var linkedN = (x.linked_products && x.linked_products.length) || 0;
    var idxBase = String((ctx && ctx.index) || "").split(".")[0];
    var hasIndexCtx = !!(idxBase && idxBase.length >= 4);

    if (hasKeepRole) {
      if (hits >= 99) return true;
      if (hits >= 2) return true;
      /* Spray bez indeksu/tokenow - odrzuc (phone dump / influencer). */
      if (linkedN >= 4) return false;
      /* Jawne skojarzenie z 1–3 produktami (w tym biezacym) - zaufaj linked_products. */
      if (linkedN > 0 && linkedN <= 3) return true;
      if (hits >= 1) return true;
      return false;
    }

    /* Sciezka/nazwa kampanii bez roli KEEP. */
    if (hits >= 99 || hits >= 2) return true;
    if (linkedN === 1) return true;
    if (linkedN > 0 && linkedN <= 3 && hits >= 1) return true;
    if (!hasIndexCtx && hits >= 1) return true;
    return false;
  }

  var ASSOC_PRODUCT_GENERIC_TOKENS = {
    proteina: 1,
    protein: 1,
    baton: 1,
    batony: 1,
    nowa: 1,
    nowy: 1,
    krem: 1,
    mix: 1,
    zestaw: 1,
    slider: 1,
    desktop: 1,
    mobile: 1,
    tablet: 1,
    gotowe: 1,
    suchy: 1,
    kategorie: 1,
    glowne: 1,
    strona: 1,
    dobra: 1,
    kaloria: 1,
  };

  function assetFileBaseName(asset) {
    var n = String((asset && (asset.name || asset.path)) || "")
      .replace(/\\/g, "/")
      .split("/")
      .pop() || "";
    return n.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  }

  function polishStemToken(t) {
    var s = String(t || "").toLowerCase();
    if (s.length < 5) return s;
    return s.replace(/(owych|owymi|owymi|owie|ami|ach|owi|owe|owy|owa|ego|emu|ymi|ym|ich|ych|ej|ą|ę|e|y|a)$/i, "");
  }

  /**
   * Filtr produktow przy materialie brandingowym (odwrotnosc viz→materials).
   * Folder SLIDERY KATEGORIE czesto ma spray folder_linked_product_ids (Banoffee/
   * Proteina przy "batony daktylowe") - zostaw tylko produkty ze sygnalem w nazwie
   * assetu / podkategorii (np. daktylow*).
   */
  function productRelevanceToBrandingAsset(product, asset) {
    if (!product || !asset) return 0;
    var assetBlob = (
      String(asset.name || "") +
      " " +
      String(asset.path || "") +
      " " +
      String(asset.search_blob || "")
    ).toLowerCase();
    var score = 0;
    var idxs = [].concat(product.indexes || [], product.index_bases || []);
    if (product.product_index) idxs.push(product.product_index);
    for (var i = 0; i < idxs.length; i++) {
      var base = String(idxs[i] || "").split(".")[0];
      if (base && base.length >= 4 && assetBlob.indexOf(base.toLowerCase()) >= 0) score += 99;
    }
    var pname = String(product.display_name || product.name || "").toLowerCase();
    var pTokens = pname.split(/[^a-z0-9ąćęłńóśźż]+/i).filter(function (t) {
      return t && t.length > 3 && !ASSOC_PRODUCT_GENERIC_TOKENS[t];
    });
    pTokens.forEach(function (t) {
      if (assetBlob.indexOf(t) >= 0) score += 2;
    });
    var aBase = assetFileBaseName(asset);
    var aTokens = aBase.split(/[^a-z0-9ąćęłńóśźż]+/i).filter(function (t) {
      return t && t.length > 3 && !ASSOC_PRODUCT_GENERIC_TOKENS[t];
    });
    var pBlob = (
      String(product.search_blob || "") +
      " " +
      pname +
      " " +
      String(product.category || "") +
      " " +
      String(product.subcategory_label || product.subcategory || "") +
      " " +
      (product.tags || []).join(" ")
    ).toLowerCase();
    aTokens.forEach(function (t) {
      if (pBlob.indexOf(t) >= 0) score += 3;
      var stem = polishStemToken(t);
      if (stem && stem.length >= 5 && pBlob.indexOf(stem) >= 0) score += 2;
    });
    return score;
  }

  function resolveProductRecordForAssoc(p) {
    if (!p || !p.id) return p;
    var fi = window._DAM_FILE_INDEX;
    var hit = null;
    if (fi && fi.products) {
      for (var i = 0; i < fi.products.length; i++) {
        if (fi.products[i] && fi.products[i].id === p.id) {
          hit = fi.products[i];
          break;
        }
      }
    }
    if (!hit) return p;
    /* enrichLinkedProducts ucina category/search_blob — dolacz do scoringu. */
    return {
      id: p.id,
      display_name: p.display_name || hit.display_name || hit.name || p.id,
      name: hit.name || p.name || "",
      thumb_url: p.thumb_url || hit.thumb_url || "",
      product_index: p.product_index || "",
      path: p.path || hit.path || "",
      search_blob: hit.search_blob || "",
      category: hit.category || "",
      subcategory_label: hit.subcategory_label || hit.subcategory || "",
      tags: hit.tags || [],
      indexes: hit.indexes || [],
      index_bases: hit.index_bases || [],
    };
  }

  function filterLinkedProductsForBrandingAsset(asset, linkedProducts) {
    var list = (linkedProducts || []).filter(Boolean);
    if (!asset || list.length <= 3) return list;
    var scored = list.map(function (raw) {
      var p = resolveProductRecordForAssoc(raw);
      return { p: raw, s: productRelevanceToBrandingAsset(p, asset) };
    });
    var max = 0;
    scored.forEach(function (x) {
      if (x.s > max) max = x.s;
    });
    if (max <= 0) return list;
    var kept = scored
      .filter(function (x) {
        return x.s >= 2;
      })
      .map(function (x) {
        return x.p;
      });
    return kept.length ? kept : list;
  }

  /** Normalizuj thumb produktu - unikaj broken img (wzgledne / puste / zle). */
  function resolveProductThumbUrl(p) {
    var t = p && p.thumb_url != null ? String(p.thumb_url).trim() : "";
    if (!t) return PLACEHOLDER_SVG;
    if (/^(data:|blob:|https?:)/i.test(t)) return t;
    if (t.charAt(0) === "/") return t.replace(/^\//, "");
    return t;
  }

  window.__damAssocThumbFallback = function (img) {
    if (!img || !img.parentNode) return;
    /* One silent retry: bridge may resolve stale revision paths on 2nd hit
       after cold start / path coerce; also bust any intermediate 404 cache. */
    if (img.dataset.resolveRetry !== "1") {
      img.dataset.resolveRetry = "1";
      var src = img.getAttribute("src") || img.src || "";
      if (src && src.indexOf("/media?") >= 0) {
        var retrySrc =
          src.replace(/([?&])_retry=\d+/g, "$1").replace(/[?&]$/, "") +
          (src.indexOf("?") >= 0 ? "&" : "?") +
          "_retry=" +
          String(Date.now());
        img.src = retrySrc;
        return;
      }
    }
    if (img.dataset.fallbackDone === "1") return;
    img.dataset.fallbackDone = "1";
    img.onerror = null;
    var item = img.closest(".dam-media-preview__assoc-item");
    var labelEl = item && item.querySelector(".dam-media-preview__assoc-name");
    var idxEl = item && item.querySelector(".dam-media-preview__assoc-index");
    var label =
      (img.getAttribute("alt") || "").trim() ||
      (labelEl && (labelEl.textContent || "").trim()) ||
      (idxEl && (idxEl.textContent || "").trim()) ||
      "";
    var idHint =
      (idxEl && (idxEl.getAttribute("data-marketing-id") || idxEl.textContent || "").trim()) || "";
    var ph = document.createElement("span");
    ph.className = "dam-media-preview__assoc-thumb dam-media-preview__assoc-thumb--fallback";
    ph.setAttribute("role", "img");
    ph.setAttribute(
      "aria-label",
      "Podglad niedostepny" + (label ? ": " + label : "") + (idHint && idHint !== label ? " (" + idHint + ")" : "")
    );
    ph.title =
      (window.DamPreviewTruth && DamPreviewTruth.onErrorTitle()) ||
      "Podglad niedostepny";
    /* HARD: tylko ikona + krotki hint w slocie - nazwa i ID sa pod kafelkiem (bez duplikatu). */
    ph.innerHTML =
      '<i class="uil uil-image-slash" aria-hidden="true"></i>' +
      '<span class="dam-assoc-thumb-fallback__hint">brak podgladu</span>';
    img.replaceWith(ph);
  };

  /** Wideo: gdy poster mostu padnie, lokalny SVG "Wideo" (nie uil-image-slash). */
  window.__damAssocVideoThumbFallback = function (img) {
    if (!img || !img.parentNode) return;
    if (img.dataset.fallbackDone === "1") return;
    img.dataset.fallbackDone = "1";
    img.onerror = null;
    img.src = VIDEO_POSTER_FALLBACK;
    img.classList.add("dam-media-preview__assoc-thumb--video-fallback");
    /* Most bez ffmpeg: sprobuj klatke w przegladarce (~25%). */
    tryCaptureAssocVideoFrame(img);
  };

  /**
   * Klatka ~25% czasu trwania z streamu mostu (gdy ffmpeg nie ma na PATH).
   * Wymaga CORS mostu 8766 - canvas.toDataURL.
   */
  function captureVideoPosterFrame(streamSrc, pct) {
    return new Promise(function (resolve) {
      if (!streamSrc) {
        resolve(null);
        return;
      }
      var video = document.createElement("video");
      var done = false;
      var timer = setTimeout(function () {
        finish(null);
      }, 20000);
      function finish(url) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          video.removeAttribute("src");
          video.load();
        } catch (e1) {}
        resolve(url || null);
      }
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.crossOrigin = "anonymous";
      video.addEventListener("error", function () {
        finish(null);
      });
      video.addEventListener("loadedmetadata", function () {
        var dur = video.duration;
        var t = 0.5;
        if (dur && isFinite(dur) && dur > 0.2) {
          t = Math.max(0.05, Math.min(dur * (pct || 0.25), dur - 0.05));
        }
        try {
          video.currentTime = t;
        } catch (e2) {
          finish(null);
        }
      });
      video.addEventListener("seeked", function () {
        try {
          var w = video.videoWidth || 0;
          var h = video.videoHeight || 0;
          if (!w || !h) {
            finish(null);
            return;
          }
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          if (!ctx) {
            finish(null);
            return;
          }
          ctx.drawImage(video, 0, 0, w, h);
          finish(canvas.toDataURL("image/jpeg", 0.82));
        } catch (e3) {
          finish(null);
        }
      });
      video.src = streamSrc;
    });
  }

  function tryCaptureAssocVideoFrame(img) {
    if (!img || img.dataset.captureTried === "1") return;
    img.dataset.captureTried = "1";
    var src = img.getAttribute("src") || img.currentSrc || "";
    var m = /[?&]path=([^&]+)/.exec(src);
    if (!m) return;
    var path = decodeURIComponent(m[1]);
    var stream = streamUrl(path);
    captureVideoPosterFrame(stream, 0.25).then(function (dataUrl) {
      if (!dataUrl || !img.isConnected) return;
      img.onerror = null;
      img.src = dataUrl;
      img.classList.add("dam-media-preview__assoc-thumb--captured");
      img.classList.remove("dam-media-preview__assoc-thumb--video-fallback");
    });
  }

  /** Po renderze: jesli poster mostu to SVG-placeholder, zlap klatke w kliencie. */
  function hydrateVideoAssocThumbs(host) {
    if (!host) return;
    host.querySelectorAll(".dam-media-preview__assoc-item--video img").forEach(function (img) {
      function maybeCapture() {
        if (img.dataset.captureTried === "1") return;
        /* Placeholder SVG mostu = 640x360; prawdziwy JPEG z ffmpeg zwykle inny rozmiar.
           Gdy preview padl / SVG / brak naturalWidth - capture. */
        var nw = img.naturalWidth || 0;
        var nh = img.naturalHeight || 0;
        var src = img.currentSrc || img.src || "";
        var looksPlaceholder =
          !nw ||
          src.indexOf("data:image/svg") === 0 ||
          (nw === 640 && nh === 360) ||
          img.classList.contains("dam-media-preview__assoc-thumb--video-fallback");
        if (looksPlaceholder) tryCaptureAssocVideoFrame(img);
        else img.dataset.captureTried = "1";
      }
      if (img.complete) maybeCapture();
      else img.addEventListener("load", maybeCapture, { once: true });
    });
  }

  function readCardZoomPct() {
    if (window.DamUserPrefs && typeof DamUserPrefs.getCardZoom === "function") {
      return DamUserPrefs.getCardZoom();
    }
    var n = parseInt(localStorage.getItem(CARD_ZOOM_KEY) || "100", 10);
    if (isNaN(n)) n = 100;
    return Math.min(CARD_ZOOM_MAX, Math.max(CARD_ZOOM_MIN, n));
  }

  function basePreviewZoom() {
    return readCardZoomPct() / 100;
  }

  /**
   * Shared density zoom (branding grid + viz assoc pane).
   * Same math as dam-branding applyBrandingCardZoom — one system, many roots.
   */
  function cardZoomRoots() {
    return [
      document.getElementById("damBrandingSectionGrid"),
      document.getElementById("damBrandbookGrid"),
      document.getElementById("vizGrid"),
      document.querySelector("#damVizModal .dam-viz-modal__assoc-pane"),
      document.getElementById("damVizModalAssoc"),
      document.getElementById("damMediaPreviewLinkedAssets"),
      document.getElementById("damMediaPreviewAssoc"),
      document.querySelector("#damMediaPreview .dam-media-preview__assoc"),
    ].filter(Boolean);
  }

  function syncCardZoomControls(n) {
    var labelIds = ["damBrandingCardZoomLabel", "vizCardZoomLabel"];
    var inputIds = ["damBrandingCardZoom", "vizCardZoom"];
    labelIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = n + "%";
    });
    inputIds.forEach(function (id) {
      var input = document.getElementById(id);
      if (input && String(input.value) !== String(n)) input.value = String(n);
    });
  }

  function applyCardZoomPct(pct) {
    var n = Math.round(Number(pct) || 100);
    if (n < CARD_ZOOM_MIN) n = CARD_ZOOM_MIN;
    if (n > CARD_ZOOM_MAX) n = CARD_ZOOM_MAX;
    var imgScale = (n <= 100 ? n / 100 : 1) * CARD_IMG_BASE_SCALE;
    var cardScale = n <= 100 ? 1 : n / 100;
    var cardMin = Math.round(CARD_BASE_MIN_PX * cardScale) + "px";
    cardZoomRoots().forEach(function (root) {
      root.style.setProperty("--dam-viz-img-scale", String(imgScale));
      root.style.setProperty("--dam-viz-card-scale", String(cardScale));
      root.style.setProperty("--dam-viz-card-min", cardMin);
    });
    syncCardZoomControls(n);
    try {
      localStorage.setItem(CARD_ZOOM_KEY, String(n));
    } catch (eZoom) {}
    if (window.DamUserPrefs && typeof DamUserPrefs.setCardZoom === "function") {
      DamUserPrefs.setCardZoom(n, true).catch(function () {});
    }
    return n;
  }

  function injectAssocDensityZoomCss() {
    if (document.getElementById("damAssocDensityZoomCss")) return;
    var st = document.createElement("style");
    st.id = "damAssocDensityZoomCss";
    st.textContent =
      "#damVizModalAssoc," +
      "#damMediaPreviewLinkedAssets," +
      ".dam-viz-modal__assoc-pane .dam-media-preview__assoc-grid," +
      "#damMediaPreviewAssoc .dam-media-preview__assoc-grid{" +
      "grid-template-columns:repeat(auto-fill,minmax(calc(86px * var(--dam-viz-card-scale, 1)),1fr));" +
      "}" +
      "#damVizModalAssoc .dam-media-preview__assoc-thumb," +
      "#damMediaPreviewLinkedAssets .dam-media-preview__assoc-thumb," +
      "#damMediaPreviewAssoc .dam-media-preview__assoc-thumb{" +
      "width:calc(70px * var(--dam-viz-card-scale, 1));" +
      "height:calc(70px * var(--dam-viz-card-scale, 1));" +
      "transform:scale(calc(var(--dam-viz-img-scale, 1) / 1));" +
      "transform-origin:center center;" +
      "}" +
      "#damVizModalAssoc .dam-media-preview__assoc-item," +
      "#damMediaPreviewLinkedAssets .dam-media-preview__assoc-item," +
      "#damMediaPreviewAssoc .dam-media-preview__assoc-item{" +
      "max-width:calc(110px * var(--dam-viz-card-scale, 1));" +
      "}";
    document.head.appendChild(st);
  }

  function bindShiftCardZoomKeys() {
    if (document.documentElement._damShiftCardZoomBound) return;
    document.documentElement._damShiftCardZoomBound = true;
    injectAssocDensityZoomCss();
    applyCardZoomPct(readCardZoomPct());
    document.addEventListener(
      "keydown",
      function (e) {
        if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
        var t = e.target;
        if (
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.tagName === "SELECT" ||
            t.isContentEditable)
        ) {
          return;
        }
        var code = e.code || "";
        var key = e.key || "";
        var isPlus = key === "+" || key === "=" || code === "NumpadAdd" || code === "Equal";
        var isMinus = key === "-" || key === "_" || code === "NumpadSubtract" || code === "Minus";
        if (!isPlus && !isMinus) return;
        e.preventDefault();
        applyCardZoomPct(readCardZoomPct() + (isPlus ? CARD_ZOOM_STEP : -CARD_ZOOM_STEP));
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindShiftCardZoomKeys);
  } else {
    bindShiftCardZoomKeys();
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function bridgeUrl() {
    return (
      (window.DamPaths && typeof window.DamPaths.bridgeUrl === "function" && window.DamPaths.bridgeUrl()) ||
      (window.DamRuntime && typeof window.DamRuntime.bridgeUrl === "function" && window.DamRuntime.bridgeUrl()) ||
      "http://127.0.0.1:8766"
    );
  }

  function toLocal(path) {
    if (window.DamPaths && typeof window.DamPaths.toLocal === "function") {
      return window.DamPaths.toLocal(path);
    }
    return path || "";
  }

  function fileExt(nameOrPath) {
    var m = /\.([a-z0-9]+)$/i.exec(String(nameOrPath || ""));
    return m ? m[1].toLowerCase() : "";
  }

  function isVideoAsset(asset) {
    if (!asset) return false;
    if (asset.media_type === "video") return true;
    return !!VIDEO_EXTS[fileExt(asset.name || asset.path)];
  }

  function needsServerPreview(asset) {
    var ext = fileExt(asset && (asset.name || asset.path));
    if (PREVIEW_EXTS[ext]) return true;
    if (asset && asset.media_type === "source") return true;
    return false;
  }

  function streamUrl(path) {
    if (!path) return "";
    return bridgeUrl() + "/media?path=" + encodeURIComponent(toLocal(path));
  }

  function posterUrl(path) {
    if (!path) return "";
    return streamUrl(path) + "&preview=1";
  }

  function previewUrl(path, asset) {
    if (!path) return "";
    if (isVideoAsset(asset) || VIDEO_EXTS[fileExt(path)]) {
      return streamUrl(path);
    }
    var local = toLocal(path);
    var ext = fileExt(path);
    var url = bridgeUrl() + "/media?path=" + encodeURIComponent(local);
    var wantPreview =
      (asset && needsServerPreview(asset)) ||
      PREVIEW_EXTS[ext] ||
      ALPHA_PREVIEW_EXTS[ext];
    var wantMatte =
      (ext === "png" || ext === "webp") &&
      (isElementyFolderPath(local) || isElementyFolderPath(path));
    if (wantPreview) url += "&preview=1";
    if (wantMatte) url += "&matte=1";
    return url;
  }

  function mediaUrl(path, asset) {
    /* Grid first-paint: /thumb-cache (PAMIEC+Redis). Klik/modal/video: /media = zrodlo z dysku. */
    var ext = fileExt(path || (asset && (asset.name || asset.path)) || "");
    var isVid = isVideoAsset(asset) || VIDEO_EXTS[ext];
    if (
      !isVid &&
      path &&
      window.DamPreviewTruth &&
      typeof DamPreviewTruth.thumbCacheUrl === "function" &&
      /^(png|jpe?g|webp|gif|tif|tiff|bmp)$/i.test(ext)
    ) {
      return DamPreviewTruth.thumbCacheUrl(path, "grid");
    }
    return previewUrl(path, asset);
  }

  function isRasterPreviewable(asset) {
    if (!asset) return false;
    if (asset.media_type === "video" || asset.media_type === "vector") return false;
    var ext = fileExt(asset.name || asset.path);
    if (/^(png|jpe?g|webp|gif|svg)$/i.test(ext)) return true;
    if (PREVIEW_EXTS[ext]) return true;
    if (asset.media_type === "raster" || asset.media_type === "source") return true;
    return false;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text || "");
    }
    return Promise.reject(new Error("clipboard"));
  }

  function toast(msg) {
    if (window.DamToast && typeof window.DamToast.show === "function") {
      window.DamToast.show(msg);
      return;
    }
    /* Fallback (np. explorer.html nie laduje DamToast): prosty toast inline */
    var el = document.getElementById("damMediaPreviewToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "damMediaPreviewToast";
      el.style.cssText =
        "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:13000;" +
        "background:#464255;color:#fff;padding:10px 18px;border-radius:10px;" +
        "font-size:13px;box-shadow:0 10px 28px rgba(28,24,44,0.3);opacity:0;" +
        "transition:opacity 0.18s ease;pointer-events:none;";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.style.opacity = "0";
    }, 2200);
  }

  function badgesHtml(asset) {
    if (window.DamBadges && typeof window.DamBadges.renderBranding === "function") {
      return window.DamBadges.renderBranding(asset, {
        includeTagTiers: ["primary", "low", "minimal"],
        maxPerKind: 5,
        maxTotal: 14,
      });
    }
    return '<span class="dam-viz-badge dam-viz-badge--brand">' + esc(asset.brand || "DK") + "</span>";
  }

  function marketingDisplayId(asset) {
    if (window.DamMarketingId && typeof window.DamMarketingId.format === "function") {
      return window.DamMarketingId.format(asset);
    }
    return asset && asset.id ? asset.id : "";
  }

  /** ID marketingowe wizualizacji (tryb viz-studio): V-<INDEKS>-<PERSP>-<SKALA>-<MM-RR>. */
  function vizDisplayId(asset, options) {
    var mid = window.DamMarketingId;
    if (!mid || typeof mid.formatViz !== "function") return "";
    var ctx = (options && options.productContext) || {};
    var idx =
      asset.product_index ||
      (typeof mid.parseIndexFromPath === "function" ? mid.parseIndexFromPath(asset.path) : "") ||
      ctx.index ||
      "";
    return mid.formatViz({
      index: idx,
      persp: asset.perspective || asset.persp || "",
      size: asset.size || "",
      date: asset.mtime || null,
    });
  }

  function assetIdChipHtml(asset, options) {
    if (!asset || !asset.id) return "";
    var displayId =
      options && options.mode === "viz-studio"
        ? vizDisplayId(asset, options) || marketingDisplayId(asset)
        : marketingDisplayId(asset);
    if (!displayId) return "";
    return (
      '<span class="dam-viz-badge dam-viz-badge--index dam-branding-id-chip dam-media-preview__asset-id" data-tag-value="' +
      esc(displayId) +
      '" data-marketing-id="' +
      esc(displayId) +
      '" data-dam-tip="ID marketingowe: ' +
      esc(displayId) +
      ' (klik = kopiuj)" title="ID marketingowe: ' +
      esc(displayId) +
      '" role="button" tabindex="0">' +
      esc(displayId) +
      "</span>"
    );
  }

  function assocLabelRow(label, editKind) {
    var editBtn =
      '<button type="button" class="dam-assoc-edit-all" data-assoc-edit-all="' +
      editKind +
      '" hidden>Edytuj wszystko</button>';
    return (
      '<div class="dam-media-preview__assoc-label-row">' +
      '<span class="dam-media-preview__assoc-label">' +
      esc(label) +
      "</span>" +
      editBtn +
      "</div>"
    );
  }

  function variantFileLabel(v) {
    if (v && v.name) return v.name;
    if (v && v.path) {
      var p = String(v.path).replace(/\\/g, "/");
      var i = p.lastIndexOf("/");
      return i >= 0 ? p.slice(i + 1) : p;
    }
    return v && (v.label || v.id) ? String(v.label || v.id) : "Plik";
  }

  function linkedProductsHtml(linkedProducts) {
    var list = (linkedProducts || []).filter(Boolean);
    var body =
      list.length > 0
        ? list
            .map(function (p) {
              var thumb = resolveProductThumbUrl(p);
              var label = p.display_name || p.id || "Produkt";
              var idx = p.product_index || "";
              var useImg = thumb && thumb !== PLACEHOLDER_SVG;
              return (
                '<div class="dam-media-preview__assoc-item" role="listitem" data-product-id="' +
                esc(p.id) +
                '">' +
                '<button type="button" class="dam-media-preview__assoc-thumb-btn" data-assoc-thumb-go data-product-id="' +
                esc(p.id) +
                '" title="' +
                esc(label) +
                '">' +
                (useImg
                  ? '<img class="dam-media-preview__assoc-thumb" src="' +
                    esc(thumb) +
                    '" alt="' +
                    esc(label) +
                    '" loading="lazy" onerror="window.__damAssocThumbFallback&&__damAssocThumbFallback(this)">'
                  : '<span class="dam-media-preview__assoc-thumb dam-media-preview__assoc-thumb--fallback" role="img" aria-label="Podglad niedostepny: ' +
                    esc(label) +
                    '" title="' +
                    esc(
                      (window.DamPreviewTruth && DamPreviewTruth.onErrorTitle()) ||
                        "Podglad niedostepny"
                    ) +
                    '">' +
                    '<i class="uil uil-image-slash" aria-hidden="true"></i>' +
                    '<span class="dam-assoc-thumb-fallback__hint">brak podgladu</span>' +
                    "</span>") +
                "</button>" +
                '<button type="button" class="dam-media-preview__assoc-name" data-assoc-name data-product-id="' +
                esc(p.id) +
                '" title="' +
                esc(label) +
                '">' +
                esc(label) +
                "</button>" +
                (idx
                  ? '<span class="dam-media-preview__assoc-index dam-branding-id-chip" role="button" tabindex="0" data-marketing-id="' +
                    esc(idx) +
                    '" data-tag-value="' +
                    esc(idx) +
                    '" title="ID: ' +
                    esc(idx) +
                    ' (klik / prawy = kopiuj)" data-dam-tip="' +
                    esc(idx) +
                    '">' +
                    esc(idx) +
                    "</span>"
                  : "") +
                "</div>"
              );
            })
            .join("")
        : '<p class="dam-media-preview__assoc-empty">Brak skojarzonych produktów</p>';
    return (
      '<div class="dam-media-preview__assoc-col dam-media-preview__assoc-col--products">' +
      assocLabelRow("Skojarzone produkty", "product") +
      '<div class="dam-media-preview__assoc-grid" role="list">' +
      body +
      "</div></div>"
    );
  }

  function variantDisplayLabel(v, fileName) {
    var label = String((v && v.label) || "").trim();
    if (label && label.toLowerCase() !== "plik") return label;
    var base = splitNameExt(fileName).base || fileName || "";
    base = String(base).trim();
    if (!base) return "Plik";
    // Dlugie nazwy: zostaw poczatek i koncowke (sufiks typu _01 rozrznia warianty)
    if (base.length > 18) {
      base = base.slice(0, 8) + "\u2026" + base.slice(-8);
    }
    return base;
  }

  /* ---------- Rule A/B: indeks branding w runtime (tiery jakosci + zrodla w gore drzewa) ---------- */

  /* Zrodla edycyjne: CTA w SourceMount / actions — NIGDY w .variant-grid (HARD 2026-07-21). */
  var EDITABLE_EXTS = { psd: 1, psb: 1, ai: 1, indd: 1, eps: 1, pdf: 1 };
  var SOURCE_DIR_RE = /^(psd|psb|ai|edytowalne|zrodla|zrodlo|source|sources|src)$/i;
  var QUALITY_LABELS = ["XL", "L", "S", "XS", "XXS", "XXXS"];
  var _indexAssetsPromise = null;

  function loadIndexAssets() {
    if (_indexAssetsPromise) return _indexAssetsPromise;
    // Reuzyj indeksu zaladowanego przez dam-branding.js (ta sama sesja).
    if (window.__damBrandingIndex && window.__damBrandingIndex.assets) {
      _indexAssetsPromise = Promise.resolve(window.__damBrandingIndex.assets);
      return _indexAssetsPromise;
    }
    /*
     * HARD freeze fix (2026-07-22): NEVER fetch/parse data/branding-index.json
     * (~388MB) from the UI thread. Sync r.json() kills the whole DAM tab.
     * Bridge /branding-index is the same payload - also forbidden on interactive paths.
     * Without an in-memory index, return [] (assoc pane stays empty / seed-only).
     */
    _indexAssetsPromise = Promise.resolve([]);
    return _indexAssetsPromise;
  }

  function normSlashesLower(p) {
    return String(p || "").replace(/\\/g, "/").toLowerCase();
  }

  function dirOfPath(p) {
    var n = normSlashesLower(p);
    var i = n.lastIndexOf("/");
    return i > 0 ? n.slice(0, i) : "";
  }

  function parentDir(d) {
    var i = String(d || "").lastIndexOf("/");
    return i > 0 ? d.slice(0, i) : "";
  }

  function baseNameNoExt(nameOrPath) {
    var n = String(nameOrPath || "").replace(/\\/g, "/");
    var i = n.lastIndexOf("/");
    var f = i >= 0 ? n.slice(i + 1) : n;
    return splitNameExt(f).base;
  }

  /**
   * Klucz kreacji: baza nazwy bez markerow kompresji (ultra/low/high/skompresowane...).
   * NIE tnie koncowych numerow (_01 vs _03 = ROZNE kreacje) ani rozmiarow (992x600 = inny wariant).
   * (Uzywane przez Rule A / jakosc - zostaw bez device/WxH.)
   */
  function creativeKey(nameOrPath) {
    var base = String(baseNameNoExt(nameOrPath)).toLowerCase();
    base = base.replace(/[\s._\u2013\u2014-]+/g, "-");
    base = base.replace(/\b(skompresowane|compressed|compress|ultralow|ultra|low|high|hq|full|master|oryginalne|oryginal|org|min)\b/g, "");
    base = base.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
    return base;
  }

  /**
   * Rodzina kreacji do grupowania skojarzonych materialow (#damVizModalAssoc):
   * creativeKey + strip MOBILE/DESKTOP/TABLET + WxH (takze po normalizacji do 576-x-600).
   * Scope folderu = folder_group_id (jak branding marketingGroupKey / group cards).
   */
  function familyCreativeKey(nameOrPath) {
    var base = creativeKey(nameOrPath);
    if (!base) return "";
    base = base.replace(/\b(mobile|desktop|tablet|phone|iphone|ipad)\b/g, "");
    base = base.replace(/\b\d{2,5}-x-\d{2,5}\b/g, "");
    base = base.replace(/\b\d{2,5}x\d{2,5}\b/g, "");
    base = base.replace(/\b(rgb|cmyk|px)\b/g, "");
    base = base.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
    return base;
  }

  function assocMaterialGroupScope(a) {
    if (!a) return "";
    var fgi = String(a.folder_group_id || "")
      .replace(/\\/g, "/")
      .toLowerCase()
      .trim();
    if (fgi) return fgi;
    return dirOfPath(a.path || "");
  }

  /** Klucz grupy = scope brandingu (folder_group_id/dir) + family stem (device/WxH/quality). */
  function assocMaterialGroupKey(a) {
    var scope = assocMaterialGroupScope(a) || "orphan";
    var fam =
      familyCreativeKey((a && (a.name || a.path)) || "") ||
      normSlashesLower((a && (a.path || a.id || a.name)) || "unknown");
    return scope + "|" + fam;
  }

  function parseDimsArea(nameOrPath) {
    var s = String(baseNameNoExt(nameOrPath) || "");
    var m = s.match(/(\d{2,5})\s*[xX×]\s*(\d{2,5})/);
    if (!m) m = s.match(/(\d{2,5})-x-(\d{2,5})/i);
    if (!m) return 0;
    return (parseInt(m[1], 10) || 0) * (parseInt(m[2], 10) || 0);
  }

  /** Preferuj DESKTOP / FRONT / najwiekszy raster - jak pickPrimaryMarketing w brandingu. */
  function pickPrimaryAssocMaterial(assets) {
    return (assets || [])
      .slice()
      .sort(function (a, b) {
        var score = function (x) {
          var s = 0;
          var n = String((x && x.name) || "");
          if (/\.(png|jpe?g|webp|gif)$/i.test(n)) s += 40;
          else if (/\.(tif|tiff)$/i.test(n)) s += 24;
          else if (/\.(psd|psb)$/i.test(n)) s += 4;
          if (/desktop/i.test(n)) s += 16;
          else if (/tablet/i.test(n)) s += 8;
          else if (/mobile/i.test(n)) s += 4;
          if (String((x && x.perspective) || "").toUpperCase() === "FRONT") s += 12;
          s += Math.min(20, Math.floor(parseDimsArea(n) / 200000));
          if (x && x.media_type === "video") s += 6;
          return s;
        };
        return score(b) - score(a);
      })[0];
  }

  function assocGroupDisplayLabel(primary) {
    if (!primary) return "Materiał";
    var base = String(baseNameNoExt(primary.name || primary.path || "") || primary.name || "Materiał");
    base = base
      .replace(/\b(MOBILE|DESKTOP|TABLET|PHONE|IPHONE|IPAD)\b/gi, " ")
      .replace(/\b\d{2,5}\s*[xX×]\s*\d{2,5}\b/g, " ")
      .replace(/\b\d{2,5}-x-\d{2,5}\b/gi, " ")
      .replace(/\b(RGB|CMYK|px)\b/gi, " ")
      .replace(/\s*[-–—_|]+\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return base || primary.name || primary.id || "Materiał";
  }

  /**
   * Grupuj materialy skojarzone: 1 kafelek = 1 kreacja (device/WxH/ext/quality warianty).
   * Zgodne ze scope folder_group_id z brandingu; stem jak familyCreativeKey.
   */
  function groupAssocMaterials(list) {
    var byKey = {};
    var order = [];
    (list || []).forEach(function (a) {
      if (!a) return;
      var key = assocMaterialGroupKey(a);
      if (!byKey[key]) {
        byKey[key] = [];
        order.push(key);
      }
      byKey[key].push(a);
    });
    return order.map(function (key) {
      var bucket = byKey[key] || [];
      var sorted = bucket.slice().sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""), "pl");
      });
      var primary = pickPrimaryAssocMaterial(sorted) || sorted[0];
      return {
        type: sorted.length > 1 ? "group" : "single",
        key: key,
        assets: sorted,
        primary: primary,
        label: assocGroupDisplayLabel(primary),
      };
    });
  }

  /** Wyzszy wynik = mocniejsza kompresja (nizszy tier). Brak markerow = 0 (najlepsza jakosc). */
  function qualitySegmentScore(seg) {
    var s = String(seg || "").toLowerCase();
    var score = 0;
    if (/ultra\s*low|ultralow/.test(s)) score += 3;
    else if (/\blow\b/.test(s)) score += 2;
    if (/skompresowane|compressed|\bcompress\b/.test(s)) score += 2;
    if (/\bultra\b/.test(s) && !/ultra\s*low|ultralow/.test(s)) score += 1;
    if (/\bmin\b/.test(s)) score += 2;
    if (/\b(high|hq|full|master|org|oryginal(?:ne)?)\b/.test(s)) score -= 1;
    return score;
  }

  function qualityScoreFor(path, rootDir) {
    var dir = dirOfPath(path);
    var rel = "";
    if (dir !== rootDir && dir.indexOf(rootDir + "/") === 0) rel = dir.slice(rootDir.length + 1);
    var score = 0;
    if (rel) {
      rel.split("/").forEach(function (seg) {
        score += qualitySegmentScore(seg);
      });
    }
    score += qualitySegmentScore(baseNameNoExt(path));
    return score;
  }

  /**
   * Rule A: ta sama kreacja w roznych poziomach kompresji (identyczny creativeKey + ext)
   * w obrebie wspolnego przodka (2 poziomy w gore). Zwraca posortowana liste tierow
   * z etykietami XL/L/S/XS albo null, gdy kreacja ma tylko jeden plik.
   */
  function findQualitySet(asset, allAssets) {
    if (!asset || !asset.path) return null;
    var key = creativeKey(asset.name || asset.path);
    if (!key || key.length < 4) return null;
    var ext = fileExt(asset.name || asset.path);
    var dir = dirOfPath(asset.path);
    if (!dir) return null;
    var root = dir;
    for (var up = 0; up < 2; up++) {
      var p = parentDir(root);
      if (!p || p.split("/").length < 3) break;
      root = p;
    }
    var seen = {};
    var matches = [];
    (allAssets || []).forEach(function (x) {
      if (!x || !x.path) return;
      if (fileExt(x.name || x.path) !== ext) return;
      var xdir = dirOfPath(x.path);
      if (xdir !== root && xdir.indexOf(root + "/") !== 0) return;
      if (creativeKey(x.name || x.path) !== key) return;
      var pkey = normSlashesLower(x.path);
      if (seen[pkey]) return;
      seen[pkey] = 1;
      matches.push({
        id: x.id || "",
        name: x.name || "",
        path: x.path,
        score: qualityScoreFor(x.path, root),
      });
    });
    if (matches.length < 2) return null;
    matches.sort(function (a, b) {
      return a.score - b.score || String(a.path).localeCompare(String(b.path));
    });
    var out = [];
    var lastScore = null;
    matches.forEach(function (m) {
      if (lastScore !== null && m.score === lastScore) return;
      lastScore = m.score;
      out.push(m);
    });
    if (out.length < 2) return null;
    out.forEach(function (m, i) {
      m.label = QUALITY_LABELS[Math.min(i, QUALITY_LABELS.length - 1)];
    });
    return out;
  }

  /** Wspolny prefix >= 60% krotszej nazwy (po normalizacji) = "podobna nazwa". */
  function nameSimilar(aName, bName) {
    var a = creativeKey(aName);
    var b = creativeKey(bName);
    if (!a || !b) return false;
    if (a === b) return true;
    var n = Math.min(a.length, b.length);
    var i = 0;
    while (i < n && a.charAt(i) === b.charAt(i)) i++;
    return i >= Math.max(4, Math.ceil(n * 0.6));
  }

  /**
   * Rule B: gdy folder nie ma plikow edytowalnych, szukaj w gore drzewa (1-2 poziomy)
   * plikow psd/psb/ai/indd z indeksu: najpierw podobna nazwa, potem foldery
   * PSD/AI/EDYTOWALNE/ZRODLA, na koncu dowolny edytowalny pod przodkiem.
   */
  function findEditableUpTree(asset, allAssets) {
    if (!asset || !asset.path) return [];
    var dir = dirOfPath(asset.path);
    if (!dir) return [];
    var baseName = asset.name || asset.path;
    var anc = dir;
    for (var up = 0; up < 2; up++) {
      var p = parentDir(anc);
      if (!p || p.split("/").length < 3) break;
      anc = p;
      var cands = [];
      (allAssets || []).forEach(function (x) {
        if (!x || !x.path) return;
        if (!EDITABLE_EXTS[fileExt(x.name || x.path)]) return;
        var xdir = dirOfPath(x.path);
        if (xdir !== anc && xdir.indexOf(anc + "/") !== 0) return;
        var rel = xdir === anc ? "" : xdir.slice(anc.length + 1);
        var relSegs = rel ? rel.split("/") : [];
        if (relSegs.length > 2) return;
        var inSourceDir = relSegs.some(function (s) {
          return SOURCE_DIR_RE.test(s);
        });
        // Podfoldery zasobow w PSD/ (Linki, fonts, Zdjecia) to skladniki, nie zrodla
        if (inSourceDir && relSegs.length > 1 && !SOURCE_DIR_RE.test(relSegs[relSegs.length - 1])) return;
        var similar = nameSimilar(baseName, x.name || x.path);
        var rank = (similar ? 0 : 2) + (inSourceDir ? 0 : 1) + relSegs.length * 0.1;
        cands.push({ id: x.id || "", name: x.name || "", path: x.path, rank: rank });
      });
      if (cands.length) {
        cands.sort(function (a, b) {
          return a.rank - b.rank;
        });
        return cands;
      }
    }
    return [];
  }

  function variantIsVideo(v) {
    if (!v) return false;
    if (v.media_type === "video") return true;
    return !!VIDEO_EXTS[fileExt(v.name || v.path)];
  }

  function variantThumbInnerHtml(v, fileName) {
    if (variantIsVideo(v)) {
      return (
        '<div class="dam-viz-modal__variant-placeholder dam-media-preview__variant-placeholder dam-media-preview__variant-placeholder--video" title="' +
        esc(fileName) +
        '"><i class="uil uil-play-circle" aria-hidden="true"></i></div>'
      );
    }
    return (
      '<img class="dam-viz-modal__variant-thumb" src="' +
      esc(previewUrl(v.path, v)) +
      '" alt="' +
      esc(fileName) +
      '" loading="lazy" onerror="window.__damVariantThumbFallback&&__damVariantThumbFallback(this)">'
    );
  }

  var VARIANTS_VISIBLE_COLLAPSED = 4;

  /** Rule A (grid): jeden kafelek na kreacje - tiery kompresji tej samej nazwy sie scalaja. */
  function dedupeVariantsByCreative(list, activeId) {
    var byKey = {};
    var order = [];
    (list || []).forEach(function (v) {
      var ck = creativeKey(v.name || v.path);
      var k = (ck || normSlashesLower(v.name || v.path)) + "|" + fileExt(v.name || v.path);
      if (!byKey[k]) {
        byKey[k] = v;
        order.push(k);
        return;
      }
      if (v.id === activeId) byKey[k] = v;
    });
    return order.map(function (k) {
      return byKey[k];
    });
  }

  /** PSD/PSB/AI/PDF/… = zrodla edycyjne — TYLKO CTA w SourceMount / actions.
   *  NIGDY w .variant-grid / WARIANTY MATERIALU (HARD user 2026-07-21, wszedzie). */
  function isSourceVariantFile(v) {
    if (!v) return true;
    var ext = fileExt(v.name || v.path);
    if (EDITABLE_EXTS[ext]) return true;
    if (ASSOC_FORBIDDEN_EXTS[ext]) return true;
    var mt = String(v.media_type || "").toLowerCase();
    return mt === "source" || mt === "vector" || mt === "document";
  }

  /** Krotka etykieta kafelka materiału: PSD / JPG / stem. */
  function materialSiblingTileLabel(v) {
    var name = variantFileLabel(v) || (v && v.name) || "";
    if (!name && v && v.path) {
      var n = String(v.path).replace(/\\/g, "/");
      var i = n.lastIndexOf("/");
      name = i >= 0 ? n.slice(i + 1) : n;
    }
    var ext = String(name || "")
      .split(".")
      .pop()
      .toUpperCase();
    if (ext && ext !== String(name || "").toUpperCase()) return ext;
    var stem = String(name || "").replace(/\.[^.]+$/, "");
    if (stem.length > 18) stem = stem.slice(0, 16) + "…";
    return stem || "Plik";
  }

  /**
   * Branding WARIANTY MATERIAŁU: jeden pasek w .variant-grid.
   * opts.materialSiblings=true → siblingi RASTER/VIDEO (JPG/PNG…), etykieta EXT;
   * PSD/PSB/AI/PDF zawsze wyciete (isSourceVariantFile) — link w belce akcji.
   * wrapper assoc-item pod Shift-minus; bez dedupe creative (kazdy sibling osobno).
   */
  function folderVariantsHtml(variants, activeId, opts) {
    opts = opts || {};
    var materialSiblings = !!opts.materialSiblings;
    var list = (variants || []).filter(function (v) {
      if (!v || !v.id) return false;
      /* HARD: zrodla nigdy w gridzie — ani w materialMode, ani poza nim. */
      return !isSourceVariantFile(v);
    });
    if (!materialSiblings) {
      list = dedupeVariantsByCreative(list, activeId);
    }
    var activeIdx = list.findIndex(function (v) {
      return v.id === activeId;
    });
    if (activeIdx >= VARIANTS_VISIBLE_COLLAPSED) {
      var activeItem = list.splice(activeIdx, 1)[0];
      list.unshift(activeItem);
    }
    var collapsible = !materialSiblings && list.length > VARIANTS_VISIBLE_COLLAPSED;
    var body =
      list.length > 0
        ? list
            .map(function (v, i) {
              var active = v.id === activeId ? " is-active" : "";
              var extra = collapsible && i >= VARIANTS_VISIBLE_COLLAPSED ? " dam-media-preview__variant--extra" : "";
              var fileName = variantFileLabel(v);
              var label = materialSiblings
                ? materialSiblingTileLabel(v)
                : variantDisplayLabel(v, fileName);
              var btn =
                '<button type="button" class="dam-viz-modal__variant dam-media-preview__variant' +
                active +
                extra +
                '" role="option" aria-selected="' +
                (active ? "true" : "false") +
                '" data-variant-id="' +
                esc(v.id) +
                '" title="' +
                esc(fileName) +
                '">' +
                (v.path
                  ? variantThumbInnerHtml(v, fileName)
                  : '<div class="dam-viz-modal__variant-placeholder dam-media-preview__variant-placeholder dam-media-preview__variant-placeholder--noviz" title="Brak wizualizacji"><i class="uil uil-image-slash" aria-hidden="true"></i><span>Brak wizualizacji</span></div>') +
                '<span class="dam-viz-modal__variant-label">' +
                esc(label) +
                "</span></button>";
              if (!materialSiblings) return btn;
              return (
                '<div class="dam-media-preview__assoc-item dam-media-preview__assoc-item--variant" role="listitem" data-variant-id="' +
                esc(v.id) +
                '">' +
                btn +
                "</div>"
              );
            })
            .join("")
        : '<p class="dam-media-preview__assoc-empty">Brak wariantów</p>';
    /* Dodaj wariant: created by DamAssocEdit (Shift+Admin only) — not always in HTML. */
    var toggle = collapsible
      ? '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-media-preview__variants-toggle" data-variants-toggle aria-expanded="false">' +
        '<i class="uil uil-angle-down" aria-hidden="true"></i><span>Pokaż wszystkie (' +
        list.length +
        ")</span></button>"
      : "";
    return (
      '<div class="dam-media-preview__assoc-col dam-media-preview__assoc-col--variants">' +
      assocLabelRow("Warianty materiału", "variant") +
      '<div class="dam-media-preview__variant-grid' +
      (collapsible ? " is-collapsed" : "") +
      (materialSiblings ? " dam-media-preview__variant-grid--material" : "") +
      '" role="listbox" aria-label="Warianty w folderze">' +
      body +
      "</div>" +
      toggle +
      "</div>"
    );
  }

  /**
   * Lustrzane skojarzenia (pkt 6 brief 2026-07-20): kolumna "Skojarzone materialy"
   * w trybie viz-studio - assety brandingowe, ktorych linked_products zawiera
   * produkt otwarty w Eksplorerze. Dane laduja sie async (branding-index).
   */
  function linkedBrandingColumnHtml() {
    return (
      '<div class="dam-media-preview__assoc-col dam-media-preview__assoc-col--materials">' +
      '<div class="dam-media-preview__assoc-label-row">' +
      '<span class="dam-media-preview__assoc-label" id="damMediaPreviewLinkedAssetsLabel">Skojarzone materiały</span>' +
      "</div>" +
      '<div class="dam-media-preview__assoc-grid" id="damMediaPreviewLinkedAssets" role="list"></div>' +
      '<div class="dam-media-preview__elementy" id="damMediaPreviewElementyHost" hidden></div>' +
      '<div class="dam-media-preview__resizer-wrap" id="damMediaPreviewResizerHost" hidden></div>' +
      "</div>"
    );
  }

  function linkedBrandingCardHtml(x, i, extra, idxAttr, groupMeta) {
    groupMeta = groupMeta || null;
    var variantCount = groupMeta && groupMeta.count > 1 ? groupMeta.count : 0;
    var label =
      (groupMeta && groupMeta.label) ||
      splitNameExt(x.name || "").base ||
      x.name ||
      x.id ||
      "Materiał";
    var mkId = marketingDisplayId(x);
    /* Wideo: poster z mostu (&preview=1, klatka ~25% w ffmpeg). Raster: zwykle previewUrl. */
    var isVid = isVideoAsset(x);
    var thumb = "";
    if (isVid && x.path) {
      thumb = posterUrl(x.path);
    } else if (isRasterPreviewable(x)) {
      thumb = previewUrl(x.path, x);
    }
    var onErr = isVid
      ? "window.__damAssocVideoThumbFallback&&__damAssocVideoThumbFallback(this)"
      : "window.__damAssocThumbFallback&&__damAssocThumbFallback(this)";
    var attr = idxAttr || "data-linked-asset-idx";
    var title =
      variantCount > 1
        ? label + " · " + variantCount + (variantCount === 1 ? " wariant" : " warianty")
        : label;
    var badge =
      variantCount > 1
        ? '<span class="dam-media-preview__assoc-variant-badge" aria-label="' +
          esc(String(variantCount) + " pliki w grupie") +
          '">+' +
          esc(String(variantCount)) +
          "</span>"
        : "";
    return (
      '<div class="dam-media-preview__assoc-item dam-media-preview__assoc-item--asset' +
      (variantCount > 1 ? " dam-media-preview__assoc-item--group" : "") +
      (extra ? " dam-media-preview__assoc-item--extra" : "") +
      (isVid ? " dam-media-preview__assoc-item--video" : "") +
      '" role="listitem"' +
      (x && x.id ? ' data-asset-id="' + esc(x.id) + '"' : "") +
      (variantCount > 1 ? ' data-assoc-group-count="' + variantCount + '"' : "") +
      ">" +
      '<button type="button" class="dam-media-preview__assoc-thumb-btn" ' +
      attr +
      '="' +
      i +
      '" title="' +
      esc(title) +
      '">' +
      (thumb
        ? '<img class="dam-media-preview__assoc-thumb" src="' +
          esc(thumb) +
          '" alt="' +
          esc(label) +
          '" loading="lazy" onerror="' +
          onErr +
          '">'
        : '<span class="dam-media-preview__assoc-thumb dam-media-preview__assoc-thumb--fallback" role="img" aria-label="Podglad niedostepny: ' +
          esc(label) +
          '" title="' +
          esc(
            (window.DamPreviewTruth && DamPreviewTruth.onErrorTitle()) ||
              "Podglad niedostepny"
          ) +
          '">' +
          '<i class="uil uil-image-slash" aria-hidden="true"></i>' +
          '<span class="dam-assoc-thumb-fallback__hint">brak podgladu</span>' +
          "</span>") +
      badge +
      "</button>" +
      '<button type="button" class="dam-media-preview__assoc-name" ' +
      attr +
      '="' +
      i +
      '" title="' +
      esc(title) +
      '">' +
      esc(label) +
      "</button>" +
      (mkId
        ? '<span class="dam-media-preview__assoc-index dam-branding-id-chip" role="button" tabindex="0" data-marketing-id="' +
          esc(mkId) +
          '" data-tag-value="' +
          esc(mkId) +
          '" title="ID marketingowe: ' +
          esc(mkId) +
          ' (klik / prawy = kopiuj)" data-dam-tip="ID marketingowe: ' +
          esc(mkId) +
          ' (klik = kopiuj)">' +
          esc(mkId) +
          "</span>"
        : "") +
      "</div>"
    );
  }

  var LINKED_ASSETS_VISIBLE = 6;
  var ASSOC_SKELETON_COLS = 5;
  var ASSOC_SKELETON_MIN_ROWS = 5;
  /** Tile card ≈ square thumb + 2 label lines + gaps (~ real assoc item). */
  var ASSOC_SKELETON_CELL_PITCH = 128;

  /**
   * Opacity for row r (0-based): row0=1, row1≈0.8, taper down.
   * Last row keeps ~0.28 so `.is-skel-last` mask can dissolve to 0 at mid-tile
   * (whole-row opacity:0 made last tiles invisible — no visible fade).
   */
  function assocSkeletonRowOpacity(row, rows) {
    var n = Math.max(2, rows);
    if (row <= 0) return 1;
    var lastTop = n - 1;
    if (row >= lastTop) return 0.28;
    var t = (row - 1) / Math.max(1, lastTop - 1);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return Math.round((0.8 - t * (0.8 - 0.28)) * 1000) / 1000;
  }

  function assocPaneSkeletonCellsHtml(rows) {
    var rCount = Math.max(1, rows || ASSOC_SKELETON_MIN_ROWS);
    var cells = "";
    var r;
    var c;
    for (r = 0; r < rCount; r++) {
      var op = assocSkeletonRowOpacity(r, rCount);
      var lastCls = r === rCount - 1 ? " is-skel-last" : "";
      for (c = 0; c < ASSOC_SKELETON_COLS; c++) {
        cells +=
          '<div class="dam-assoc-skeleton' +
          lastCls +
          '" aria-hidden="true" style="--dam-skel-op:' +
          op +
          '" data-skel-row="' +
          r +
          '">' +
          '<span class="dam-assoc-skeleton__thumb"></span>' +
          '<span class="dam-assoc-skeleton__line"></span>' +
          '<span class="dam-assoc-skeleton__line dam-assoc-skeleton__line--short"></span>' +
          "</div>";
      }
    }
    return cells;
  }

  /** Legacy wrapper (cells-only preferred — mount IS the grid). */
  function assocPaneSkeletonHtml(count) {
    var rows = Math.max(
      ASSOC_SKELETON_MIN_ROWS,
      Math.ceil((count || ASSOC_SKELETON_COLS * ASSOC_SKELETON_MIN_ROWS) / ASSOC_SKELETON_COLS)
    );
    return (
      '<div class="dam-media-preview__assoc-grid dam-media-preview__assoc-grid--loading" role="list" aria-busy="true" aria-label="Ładowanie skojarzonych materiałów">' +
      assocPaneSkeletonCellsHtml(rows) +
      "</div>"
    );
  }

  function measureAssocPaneHeight(mount) {
    if (!mount) return 560;
    var h = mount.clientHeight || 0;
    if (h >= 120) return h;
    var el = mount.parentElement;
    var hops = 0;
    while (el && hops < 5) {
      if (el.clientHeight >= 160) return Math.max(160, el.clientHeight - 52);
      el = el.parentElement;
      hops += 1;
    }
    return 560;
  }

  function clearAssocPaneLoadingState(mount) {
    if (!mount) return;
    mount.classList.remove("dam-media-preview__assoc-grid--loading");
    mount.removeAttribute("aria-busy");
    if (mount.getAttribute("aria-label") === "Ładowanie skojarzonych materiałów") {
      mount.removeAttribute("aria-label");
    }
    mount.style.removeProperty("--dam-assoc-skel-rows");
  }

  function showAssocPaneLoading(mount, labelEl) {
    if (!mount) return;
    injectAssocSkeletonStyles();
    mount.classList.remove("is-collapsed-assets");
    mount.classList.add("dam-media-preview__assoc-grid--loading");
    mount.setAttribute("aria-busy", "true");
    mount.setAttribute("aria-label", "Ładowanie skojarzonych materiałów");
    var h = measureAssocPaneHeight(mount);
    var rows = Math.max(
      ASSOC_SKELETON_MIN_ROWS,
      Math.ceil(h / ASSOC_SKELETON_CELL_PITCH)
    );
    mount.style.setProperty("--dam-assoc-skel-rows", String(rows));
    /* Tile cards into mount — never nest a second .assoc-grid. */
    mount.innerHTML = assocPaneSkeletonCellsHtml(rows);
    if (labelEl) labelEl.textContent = "Skojarzone materiały";
    if (window.DamLoader && typeof window.DamLoader.start === "function") {
      window.DamLoader.start("Skojarzenia…");
    }
  }

  function finishAssocPaneLoading() {
    if (window.DamLoader && typeof window.DamLoader.done === "function") {
      window.DamLoader.done();
    }
  }

  /** Ostatni productContext z renderLinkedBrandingAssets — do odswiezenia po Shift+edit. */
  var _lastLinkedProductContext = null;

  function refreshLinkedBrandingAfterEdit() {
    if (!_lastLinkedProductContext) return;
    var mount =
      document.getElementById("damVizModalAssoc") ||
      document.getElementById("damMediaPreviewLinkedAssets");
    var labelEl =
      document.getElementById("damVizModalAssocLabel") ||
      document.getElementById("damMediaPreviewLinkedAssetsLabel");
    if (!mount || typeof renderLinkedBrandingAssets !== "function") return;
    /* Wyczysc cache indeksu, zeby linked_products po zapisie byly swieze. */
    _indexAssetsPromise = null;
    renderLinkedBrandingAssets({
      mount: mount,
      labelEl: labelEl,
      productContext: _lastLinkedProductContext,
    });
  }

  /** Pelna lista ID produktow skojarzonych z assetem (linked_products + *_ids). */
  function collectAssetLinkedProductIds(asset) {
    var ids = [];
    var seen = {};
    function add(id) {
      id = String(id || "").trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      ids.push(id);
    }
    if (!asset) return ids;
    (asset.linked_products || []).forEach(function (p) {
      if (p && p.id) add(p.id);
    });
    (asset.linked_product_ids || []).forEach(add);
    (asset.folder_linked_product_ids || []).forEach(add);
    return ids;
  }

  /**
   * list = plaskie assety LUB wpisy grupy { primary, assets }.
   * groupEntries: gdy podane, klik otwiera representative + siblings = czlonkowie grupy
   * (parity z branding data-group-ids / openModal siblings).
   */
  function bindLinkedAssetClicks(host, list, attrName, groupEntries) {
    if (!host || !list) return;
    host.querySelectorAll("[" + attrName + "]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var i = parseInt(btn.getAttribute(attrName), 10) || 0;
        var entry = groupEntries && groupEntries[i] ? groupEntries[i] : null;
        var target = entry && entry.primary ? entry.primary : list[i];
        if (!target) return;
        var members =
          entry && entry.assets && entry.assets.length
            ? entry.assets.slice()
            : list.slice();
        /* Shift+klik = edycja skojarzen assetu brandingowego (PI / user 2026-07-20). */
        if (e && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          var AE = window.DamAssocEdit;
          if (!AE || typeof AE.openEditPicker !== "function") return;
          if (typeof AE.canEdit === "function" && !AE.canEdit()) {
            if (window.DamToast && typeof window.DamToast.show === "function") {
              window.DamToast.show("Włącz tryb admina, aby edytować skojarzenia.");
            }
            return;
          }
          var col =
            btn.closest(".dam-media-preview__assoc-col") ||
            host.closest(".dam-media-preview__assoc-col") ||
            host;
          var fullIds = collectAssetLinkedProductIds(target);
          function openWithLinked(linked) {
            AE.openEditPicker(col, "product", {
              asset: target,
              mode: "viz",
              sourceType: "viz",
              groupContext: {
                folder_group_id: target.folder_group_id || "",
                linked_products: linked || [],
                linked_product_ids: fullIds.slice(),
                variants:
                  members.length > 1
                    ? members.map(function (m) {
                        return {
                          id: m.id,
                          name: m.name,
                          path: m.path,
                          media_type: m.media_type || "",
                        };
                      })
                    : target.folder_variants || target.variants || [],
              },
              onRefresh: refreshLinkedBrandingAfterEdit,
              onSaved: function (productIds) {
                var ids = productIds || [];
                target.linked_product_ids = ids.slice();
                target.folder_linked_product_ids = ids.slice();
                if (typeof AE.enrichLinkedProducts === "function") {
                  AE.enrichLinkedProducts(
                    ids.map(function (id) {
                      return { id: id };
                    })
                  ).then(function (nextLinked) {
                    target.linked_products = nextLinked || [];
                    refreshLinkedBrandingAfterEdit();
                  });
                } else {
                  refreshLinkedBrandingAfterEdit();
                }
              },
            });
          }
          if (typeof AE.enrichLinkedProducts === "function" && fullIds.length) {
            AE.enrichLinkedProducts(
              fullIds.map(function (id) {
                return { id: id };
              })
            ).then(function (linked) {
              target.linked_products = linked || target.linked_products || [];
              openWithLinked(target.linked_products);
            });
          } else {
            openWithLinked(
              (target.linked_products || []).length
                ? target.linked_products
                : fullIds.map(function (id) {
                    return { id: id };
                  })
            );
          }
          return;
        }
        var primaryIdx = members.findIndex(function (m) {
          return m && target && m.id === target.id;
        });
        if (primaryIdx < 0) primaryIdx = 0;
        openAsset(target, {
          siblings: members,
          index: primaryIdx,
          groupContext: {
            folder_group_id: target.folder_group_id || "",
            linked_products: target.linked_products || [],
            variants:
              members.length > 1
                ? members.map(function (m) {
                    return {
                      id: m.id,
                      name: m.name,
                      path: m.path,
                      label: assocGroupDisplayLabel(m),
                      media_type: m.media_type || "",
                    };
                  })
                : target.folder_variants || [],
            folder_editable_files: target.folder_editable_files || [],
          },
        });
      });
    });
  }

  /**
   * Jeden blok "rozwiń" (przycisk + panel) dla jednej grupy elementow.
   * idxAttr rozroznia grupy w DOM, zeby bindLinkedAssetClicks nie pomylil klikow
   * miedzy "Elementy" i "Linki do elementow" gdy obie sa otwarte naraz.
   */
  function elementyToggleBlockHtml(label, elements, idxAttr) {
    return (
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-media-preview__elementy-toggle" data-elementy-toggle="' +
      idxAttr +
      '" aria-expanded="false">' +
      '<i class="uil uil-angle-down" aria-hidden="true"></i>' +
      "<span>" +
      esc(label) +
      " (" +
      elements.length +
      ")</span></button>" +
      '<div class="dam-media-preview__elementy-panel" data-elementy-panel="' +
      idxAttr +
      '" hidden>' +
      '<div class="dam-media-preview__assoc-grid" role="list">' +
      elements
        .map(function (x, i) {
          return linkedBrandingCardHtml(x, i, false, idxAttr);
        })
        .join("") +
      "</div></div>"
    );
  }

  function bindElementyToggle(host, idxAttr, elements) {
    var toggle = host.querySelector('[data-elementy-toggle="' + idxAttr + '"]');
    var panel = host.querySelector('[data-elementy-panel="' + idxAttr + '"]');
    var grid = panel && panel.querySelector(".dam-media-preview__assoc-grid");
    if (grid) grid._damAssocList = (elements || []).slice();
    if (toggle && panel) {
      toggle.addEventListener("click", function () {
        var open = toggle.getAttribute("aria-expanded") === "true";
        var next = !open;
        toggle.setAttribute("aria-expanded", next ? "true" : "false");
        panel.hidden = !next;
        var icon = toggle.querySelector("i");
        if (icon) icon.className = next ? "uil uil-angle-up" : "uil uil-angle-down";
        var m = document.getElementById("damMediaPreview") || document.getElementById("damVizModal");
        var shared = window.DamModalShared;
        if (m && shared && shared.scheduleFitChrome) shared.scheduleFitChrome(m);
        /* minusGlobal20260721a: re-wire Shift-minus when Elementy panel opens. */
        if (next && window.DamAssocEdit && typeof window.DamAssocEdit.ensureShiftHoverAssocUx === "function") {
          var pane =
            host.closest(".dam-media-preview__assoc-col, .dam-viz-modal__assoc-pane") || host;
          window.DamAssocEdit.ensureShiftHoverAssocUx(pane, {
            asset: (elements && elements[0]) || null,
            materialsList: (elements || []).slice(),
            shownPrimaries: (elements || []).slice(),
            productContext: (window.__damLastAssocProductCtx) || {},
            groupContext: {
              product_id:
                (window.__damLastAssocProductCtx && window.__damLastAssocProductCtx.id) || "",
            },
            onRefresh: function () {},
          });
        }
      });
    }
    bindLinkedAssetClicks(host, elements, idxAttr);
  }

  /**
   * DWA niezalezne przyciski "rozwiń" (user 2026-07-20): "Elementy" (gotowe,
   * 1 - MATERIALY\ELEMENTY) i "Surowe elementy" (folder Links) -
   * osobno, zeby nie zajmowaly duzo miejsca i nie mieszaly sie w jedna sciane.
   */
  function renderElementyGroups(host, groups) {
    if (!host) return;
    var ready = (groups && groups.ready) || [];
    var links = (groups && groups.links) || [];
    if (!ready.length && !links.length) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML =
      (ready.length ? elementyToggleBlockHtml("Elementy", ready, "data-element-asset-idx") : "") +
      (links.length
        ? elementyToggleBlockHtml("Surowe elementy", links, "data-element-link-idx")
        : "");
    if (ready.length) bindElementyToggle(host, "data-element-asset-idx", ready);
    if (links.length) bindElementyToggle(host, "data-element-link-idx", links);
  }

  function assocSplitStorageKey(productId) {
    return ASSOC_SPLIT_KEY_PREFIX + String(productId || "unknown");
  }

  function clampAssocSplitRatio(n) {
    if (typeof n !== "number" || isNaN(n)) return ASSOC_SPLIT_DEFAULT;
    if (n < ASSOC_SPLIT_MIN) return ASSOC_SPLIT_MIN;
    if (n > ASSOC_SPLIT_MAX) return ASSOC_SPLIT_MAX;
    return n;
  }

  function readAssocSplitRatio(productId, isEmpty) {
    if (window.DamUserPrefs && typeof DamUserPrefs.getAssocSplit === "function") {
      var fromKv = DamUserPrefs.getAssocSplit(productId, null);
      if (typeof fromKv === "number" && !isNaN(fromKv)) {
        return clampAssocSplitRatio(fromKv);
      }
    }
    try {
      var raw = localStorage.getItem(assocSplitStorageKey(productId));
      if (raw != null && raw !== "") {
        var n = parseFloat(raw);
        if (!isNaN(n)) return clampAssocSplitRatio(n);
      }
    } catch (e) {
      /* private mode / blocked storage */
    }
    return isEmpty ? ASSOC_SPLIT_EMPTY_TOP : ASSOC_SPLIT_DEFAULT;
  }

  function writeAssocSplitRatio(productId, ratio) {
    var clamped = clampAssocSplitRatio(ratio);
    try {
      localStorage.setItem(assocSplitStorageKey(productId), String(clamped));
    } catch (e) {
      /* ignore */
    }
    if (window.DamUserPrefs && typeof DamUserPrefs.setAssocSplit === "function") {
      DamUserPrefs.setAssocSplit(productId, clamped, true).catch(function () {});
    }
  }

  function isAssocMountEmpty(mount) {
    if (!mount) return true;
    if (mount.querySelector(".dam-media-preview__assoc-item")) return false;
    if (mount.querySelector(".dam-media-preview__assoc-empty")) return true;
    return !mount.querySelector(".dam-media-preview__assoc-thumb-btn");
  }

  function applyAssocSplitRatio(splitRoot, ratio) {
    if (!splitRoot) return;
    var r = clampAssocSplitRatio(ratio);
    var pct = Math.round(r * 1000) / 10;
    splitRoot.style.setProperty("--dam-assoc-split-top", pct + "%");
    splitRoot.setAttribute("data-split-top", String(r));
    var splitter = splitRoot.querySelector(".dam-assoc-pane-splitter");
    if (splitter) {
      splitter.setAttribute("aria-valuenow", String(Math.round(r * 100)));
      splitter.setAttribute("aria-valuemin", String(Math.round(ASSOC_SPLIT_MIN * 100)));
      splitter.setAttribute("aria-valuemax", String(Math.round(ASSOC_SPLIT_MAX * 100)));
    }
  }

  function ensureAssocSplitCss() {
    if (document.getElementById("dam-assoc-pane-split-css")) return;
    var st = document.createElement("style");
    st.id = "dam-assoc-pane-split-css";
    st.textContent = [
      ".dam-assoc-pane-split{",
      "display:flex;flex-direction:column;flex:1 1 auto;min-height:0;height:100%;",
      "--dam-assoc-split-top:60%;}",
      ".dam-assoc-pane-split__top{",
      "flex:0 0 var(--dam-assoc-split-top);min-height:20%;max-height:80%;",
      "min-width:0;overflow:hidden;display:flex;flex-direction:column;}",
      ".dam-assoc-pane-split__top > .dam-media-preview__assoc-grid{",
      "flex:1 1 auto;min-height:0;max-height:none!important;overflow-x:hidden;overflow-y:auto;",
      "overscroll-behavior:contain;}",
      ".dam-assoc-pane-splitter{",
      "flex:0 0 auto;height:44px;min-height:44px;margin:0;padding:0;border:0;",
      "display:flex;align-items:center;justify-content:center;cursor:row-resize;",
      "background:transparent;touch-action:none;user-select:none;",
      "color:var(--dam-text-muted,#8f8b9f);}",
      ".dam-assoc-pane-splitter:hover,.dam-assoc-pane-splitter:focus-visible{",
      "color:var(--dam-primary,#ab54db);}",
      ".dam-assoc-pane-splitter:focus-visible{",
      "outline:2px solid var(--dam-primary,#ab54db);outline-offset:-2px;}",
      ".dam-assoc-pane-splitter__grip{",
      "display:block;width:44px;height:4px;border-radius:999px;",
      "background:currentColor;opacity:.45;}",
      ".dam-assoc-pane-splitter:hover .dam-assoc-pane-splitter__grip,",
      ".dam-assoc-pane-splitter:focus-visible .dam-assoc-pane-splitter__grip{opacity:.85;}",
      ".dam-assoc-pane-split__bottom{",
      "flex:1 1 auto;min-height:20%;min-width:0;overflow:hidden;",
      "display:flex;flex-direction:column;}",
      ".dam-assoc-pane-split__bottom > .dam-media-preview__elementy,",
      ".dam-assoc-pane-split__bottom > [data-elementy-host-auto],",
      ".dam-assoc-pane-split__bottom > #damMediaPreviewElementyHost{",
      "flex:1 1 auto;min-height:0;margin-top:0;padding-top:8px;",
      "overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;",
      "display:flex;flex-direction:column;gap:6px;}",
      ".dam-assoc-pane-split .dam-media-preview__elementy-panel{",
      "max-height:none!important;flex:1 1 auto;min-height:0;}",
      ".dam-assoc-pane-split.is-assoc-empty .dam-assoc-pane-split__top{",
      "min-height:72px;}",
      ".dam-media-preview__assoc-col--materials:has(> .dam-assoc-pane-split),",
      ".dam-viz-modal__assoc:has(> .dam-assoc-pane-split){",
      "display:flex;flex-direction:column;flex:1 1 auto;min-height:0;height:100%;}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function teardownAssocElementySplit(mount, elementyHost) {
    if (!mount) return;
    var split =
      mount.closest(".dam-assoc-pane-split") ||
      (mount.parentElement &&
        mount.parentElement.parentElement &&
        mount.parentElement.parentElement.classList &&
        mount.parentElement.parentElement.classList.contains("dam-assoc-pane-split")
        ? mount.parentElement.parentElement
        : null);
    if (!split || !split.parentElement) return;
    var parent = split.parentElement;
    parent.insertBefore(mount, split);
    if (elementyHost && elementyHost.parentElement) {
      parent.insertBefore(elementyHost, split);
    }
    split.remove();
  }

  function bindAssocSplitterDrag(splitter, splitRoot) {
    if (!splitter || !splitRoot || splitter.getAttribute("data-split-bound") === "1") return;
    splitter.setAttribute("data-split-bound", "1");
    splitter.setAttribute("role", "separator");
    splitter.setAttribute("aria-orientation", "horizontal");
    splitter.setAttribute("aria-label", "Przesuń podział skojarzeń i elementów");
    splitter.tabIndex = 0;

    function pid() {
      return splitRoot.getAttribute("data-group-pid") || "";
    }

    function currentRatio() {
      var raw = parseFloat(splitRoot.getAttribute("data-split-top") || "");
      return clampAssocSplitRatio(isNaN(raw) ? ASSOC_SPLIT_DEFAULT : raw);
    }

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      var startY = e.clientY;
      var startRatio = currentRatio();
      var rect = splitRoot.getBoundingClientRect();
      var h = rect.height || 1;
      splitter.classList.add("is-dragging");
      function onMove(ev) {
        var dy = ev.clientY - startY;
        applyAssocSplitRatio(splitRoot, startRatio + dy / h);
      }
      function onUp(ev) {
        splitter.classList.remove("is-dragging");
        try {
          splitter.releasePointerCapture(ev.pointerId);
        } catch (err) {
          /* ignore */
        }
        splitter.removeEventListener("pointermove", onMove);
        splitter.removeEventListener("pointerup", onUp);
        splitter.removeEventListener("pointercancel", onUp);
        writeAssocSplitRatio(pid(), currentRatio());
      }
      try {
        splitter.setPointerCapture(e.pointerId);
      } catch (err2) {
        /* ignore */
      }
      splitter.addEventListener("pointermove", onMove);
      splitter.addEventListener("pointerup", onUp);
      splitter.addEventListener("pointercancel", onUp);
    }

    splitter.addEventListener("pointerdown", onPointerDown);
    splitter.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 0.05 : 0.02;
      var r = currentRatio();
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        applyAssocSplitRatio(splitRoot, r - step);
        writeAssocSplitRatio(pid(), currentRatio());
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        applyAssocSplitRatio(splitRoot, r + step);
        writeAssocSplitRatio(pid(), currentRatio());
      } else if (e.key === "Home") {
        e.preventDefault();
        applyAssocSplitRatio(splitRoot, ASSOC_SPLIT_MIN);
        writeAssocSplitRatio(pid(), ASSOC_SPLIT_MIN);
      } else if (e.key === "End") {
        e.preventDefault();
        applyAssocSplitRatio(splitRoot, ASSOC_SPLIT_MAX);
        writeAssocSplitRatio(pid(), ASSOC_SPLIT_MAX);
      }
    });
  }

  /**
   * Wrap assoc grid + elementy host in a vertical split with draggable handle.
   * Ratio persisted per product: localStorage key dam-assoc-elementy-split:{product_id}
   */
  function ensureAssocElementySplit(mount, elementyHost, productId) {
    ensureAssocSplitCss();
    if (!mount || !mount.parentElement) return;
    var hasElementy =
      elementyHost &&
      !elementyHost.hidden &&
      elementyHost.innerHTML &&
      String(elementyHost.innerHTML).replace(/\s+/g, "").length > 0;
    if (!hasElementy) {
      teardownAssocElementySplit(mount, elementyHost);
      return;
    }

    var split = mount.closest(".dam-assoc-pane-split");
    var topPane;
    var bottomPane;
    var splitter;
    if (!split) {
      var insertParent = mount.parentElement;
      split = document.createElement("div");
      split.className = "dam-assoc-pane-split";
      topPane = document.createElement("div");
      topPane.className = "dam-assoc-pane-split__top";
      splitter = document.createElement("button");
      splitter.type = "button";
      splitter.className = "dam-assoc-pane-splitter";
      splitter.innerHTML = '<span class="dam-assoc-pane-splitter__grip" aria-hidden="true"></span>';
      bottomPane = document.createElement("div");
      bottomPane.className = "dam-assoc-pane-split__bottom";
      insertParent.insertBefore(split, mount);
      topPane.appendChild(mount);
      bottomPane.appendChild(elementyHost);
      split.appendChild(topPane);
      split.appendChild(splitter);
      split.appendChild(bottomPane);
    } else {
      topPane = split.querySelector(".dam-assoc-pane-split__top");
      bottomPane = split.querySelector(".dam-assoc-pane-split__bottom");
      splitter = split.querySelector(".dam-assoc-pane-splitter");
      if (topPane && mount.parentElement !== topPane) topPane.appendChild(mount);
      if (bottomPane && elementyHost.parentElement !== bottomPane) {
        bottomPane.appendChild(elementyHost);
      }
    }

    var empty = isAssocMountEmpty(mount);
    split.classList.toggle("is-assoc-empty", empty);
    split.setAttribute("data-group-pid", productId || "");
    applyAssocSplitRatio(split, readAssocSplitRatio(productId, empty));
    if (splitter) bindAssocSplitterDrag(splitter, split);
  }

  function renderResizerCta(host, productContext) {
    if (!host) return;
    host.hidden = true;
    host.innerHTML = "";
    var ctx = productContext || {};
    if (!ctx.id && !ctx.index) return;
    var url =
      bridgeUrl() +
      "/product-links-elementy?product_id=" +
      encodeURIComponent(ctx.id || "") +
      "&index=" +
      encodeURIComponent(ctx.index || "");
    fetch(url, { credentials: "omit" })
      .then(function (r) {
        return r.json();
      })
      .then(function (info) {
        if (!host.isConnected) return;
        if (!info || !info.ok || !info.can_generate) return;
        host.hidden = false;
        host.innerHTML =
          '<p class="dam-media-preview__resizer-warn">Konwersja automatyczna może dać elementy słabej jakości. Jeśli wynik nie jest satysfakcjonujący - poproś grafików.</p>' +
          '<button type="button" class="dam-media-preview__resizer-btn" data-open-image-resizer>' +
          '<i class="uil uil-compress-arrows" aria-hidden="true"></i>' +
          "<span>Wygeneruj elementy z Links</span></button>";
        var btn = host.querySelector("[data-open-image-resizer]");
        if (!btn) return;
        btn.addEventListener("click", function () {
          var ok = window.confirm(
            "Konwersja automatyczna może dać elementy słabej jakości.\n\n" +
              "Jeśli wynik nie jest satysfakcjonujący - poproś grafików.\n\n" +
              "Kontynuować i otworzyć Inyfinn Image resizer?"
          );
          if (!ok) return;
          btn.disabled = true;
          fetch(bridgeUrl() + "/open-image-resizer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "omit",
            body: JSON.stringify({
              product_id: ctx.id || "",
              index: ctx.index || "",
              input: info.links_path || "",
              output: info.elementy_path || "",
            }),
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (res) {
              btn.disabled = false;
              if (!res || !res.ok) {
                window.alert("Nie udało się otworzyć resizera: " + ((res && res.error) || "unknown"));
                return;
              }
              var msg =
                res.mode === "cli_venv"
                  ? "Uruchomiono konwersję CLI (PNG 60%)."
                  : "Otwarto program oraz folder Links. Ustaw output na ELEMENTY (PNG 60%).";
              if (res.warning) msg += "\n\n" + res.warning;
              window.alert(msg);
            })
            .catch(function () {
              btn.disabled = false;
              window.alert("Błąd połączenia z mostem (8766).");
            });
        });
      })
      .catch(function () {
        /* most niedostepny - cicho */
      });
  }

  function renderLinkedBrandingAssets(options) {
    var mount = (options && options.mount) || document.getElementById("damMediaPreviewLinkedAssets");
    var labelEl =
      (options && options.labelEl) || document.getElementById("damMediaPreviewLinkedAssetsLabel");
    var elementyHost =
      (options && options.elementyHost) || document.getElementById("damMediaPreviewElementyHost");
    var resizerHost =
      (options && options.resizerHost) || document.getElementById("damMediaPreviewResizerHost");
    if (!mount) return;
    /* Kontekst bez wlasnego #damMediaPreviewElementyHost (np. #damVizModal) -
       dolep wlasny kontener zaraz po gridzie materialow, zeby "Elementy" /
       "Linki do elementow" mialy gdzie sie zmiescic jako 2 przyciski rozwiń. */
    if (!elementyHost && mount.parentElement) {
      elementyHost = mount.parentElement.querySelector("[data-elementy-host-auto]");
      if (!elementyHost) {
        elementyHost = document.createElement("div");
        elementyHost.setAttribute("data-elementy-host-auto", "1");
        elementyHost.hidden = true;
        mount.insertAdjacentElement("afterend", elementyHost);
      }
    }
    var ctx = (options && options.productContext) || {};
    _lastLinkedProductContext = {
      id: ctx.id || "",
      name: ctx.name || "",
      index: ctx.index || "",
      revision_path: ctx.revision_path || ctx.revisionPath || "",
    };
    var pid = ctx.id || "";
    var idxBase = String(ctx.index || "").split(".")[0];
    var revPath = ctx.revision_path || ctx.revisionPath || "";
    if (!pid && !idxBase) {
      clearAssocPaneLoadingState(mount);
      mount.innerHTML = '<p class="dam-media-preview__assoc-empty">Brak skojarzonych materiałów</p>';
      if (elementyHost) {
        elementyHost.hidden = true;
        elementyHost.innerHTML = "";
      }
      if (resizerHost) {
        resizerHost.hidden = true;
        resizerHost.innerHTML = "";
      }
      ensureAssocElementySplit(mount, elementyHost, "");
      return;
    }
    showAssocPaneLoading(mount, labelEl);
    loadIndexAssets()
      .then(function (all) {
      if (!document.body.contains(mount)) return;
      var hits = (all || []).filter(function (x) {
        if (!x) return false;
        var lps = x.linked_products;
        if (!lps || !lps.length) return false;
        var linkedOk = lps.some(function (lp) {
          if (!lp) return false;
          if (pid && lp.id === pid) return true;
          /* Fallback: indeks bazowy zaszyty w thumb_url produktu (…__6300684_pl.jpg) */
          if (idxBase && lp.thumb_url && String(lp.thumb_url).indexOf("__" + idxBase + "_") >= 0) return true;
          return false;
        });
        if (!linkedOk) return false;
        /* Branding-grade filter: marketing raster/wideo + elementy; zero AI/PSD/PDF/source */
        if (classifyAssocAsset(x) === "material") return passesMarketingAssocMaterial(x, ctx);
        if (!passesMarketingAssocElement(x)) return false;
        /* Surowe Links: tylko biezaca rewizja produktu (nie ARCHIWUM / inne mixy). */
        if (classifyAssocAsset(x) === "element-link" && revPath && !pathUnderRevision(x.path, revPath)) {
          return false;
        }
        return true;
      });
      /* Task 35: Links / ELEMENTY poza glowna lista "Skojarzone materialy" (2 kubelki) */
      var materials = [];
      var elementsReady = [];
      var elementsLinks = [];
      hits.forEach(function (x) {
        var kind = classifyAssocAsset(x);
        if (kind === "element-link") elementsLinks.push(x);
        else if (kind === "element-ready") elementsReady.push(x);
        else materials.push(x);
      });
      /* Materialy marketingowe (slidery, banery) przed generycznymi brand assetami. */
      function assocRank(x1) {
        var role = (x1 && x1.asset_role) || "";
        if (role === "web_hero_slider" || role === "web_bundle_tile") return 0;
        if (role === "packshot") return 3;
        if (role === "brand_asset") return 2;
        return 1;
      }
      function sortHits(arr) {
        arr.sort(function (a1, b1) {
          var r = assocRank(a1) - assocRank(b1);
          if (r) return r;
          var d = (a1.linked_products || []).length - (b1.linked_products || []).length;
          return d || String(a1.path || "").localeCompare(String(b1.path || ""));
        });
      }
      sortHits(materials);
      sortHits(elementsReady);
      sortHits(elementsLinks);
      /* Grupuj warianty kreacji (device/WxH/quality/ext) - 1 kafelek + badge N. */
      var grouped = groupAssocMaterials(materials);
      var fileCount = materials.length;
      var groupCount = grouped.length;
      if (labelEl) {
        labelEl.textContent =
          groupCount > 0 && groupCount !== fileCount
            ? "Skojarzone materiały (" + groupCount + " grup · " + fileCount + " plików)"
            : "Skojarzone materiały (" + fileCount + ")";
      }
      clearAssocPaneLoadingState(mount);
      if (!materials.length) {
        mount.innerHTML = '<p class="dam-media-preview__assoc-empty">Brak skojarzonych materiałów</p>';
        /* Nawet przy 0 materialach: Edytuj wszystko + Shift plus (jak branding). */
        var AE0 = window.DamAssocEdit;
        if (AE0 && typeof AE0.bindMaterialsPane === "function") {
          var pane0 =
            mount.closest(".dam-media-preview__assoc-col") ||
            mount.closest(".dam-viz-modal__assoc-pane") ||
            mount;
          AE0.bindMaterialsPane(pane0, {
            asset: null,
            materialsList: [],
            shownPrimaries: [],
            productContext: ctx,
            groupContext: {
              product_id: pid,
              linked_product_ids: pid ? [pid] : [],
            },
            onRefresh: refreshLinkedBrandingAfterEdit,
          });
        }
      } else {
        var shownGroups = grouped.slice(0, 24);
        var shownPrimaries = shownGroups.map(function (g) {
          return g.primary;
        });
        var collapsible = shownGroups.length > LINKED_ASSETS_VISIBLE;
        mount.innerHTML =
          shownGroups
            .map(function (g, i) {
              return linkedBrandingCardHtml(
                g.primary,
                i,
                collapsible && i >= LINKED_ASSETS_VISIBLE,
                "data-linked-asset-idx",
                {
                  count: (g.assets && g.assets.length) || 1,
                  label: g.label || assocGroupDisplayLabel(g.primary),
                }
              );
            })
            .join("") +
          (collapsible
            ? '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-media-preview__variants-toggle" data-linked-assets-toggle aria-expanded="false">' +
              '<i class="uil uil-angle-down" aria-hidden="true"></i><span>Pokaż wszystkie (' +
              shownGroups.length +
              ")</span></button>"
            : "");
        if (collapsible) mount.classList.add("is-collapsed-assets");
        else mount.classList.remove("is-collapsed-assets");
        bindLinkedAssetClicks(mount, shownPrimaries, "data-linked-asset-idx", shownGroups);
        bindIdChipCopy(mount);
        hydrateVideoAssocThumbs(mount);
        /* Re-apply density vars onto freshly mounted assoc pane roots. */
        if (window.DamCardZoom && typeof window.DamCardZoom.apply === "function") {
          window.DamCardZoom.apply(window.DamCardZoom.readPct());
        }
        /* HARD: ta sama Shift+/−/plus sciezka co branding (#damMediaPreviewAssoc). */
        var AE = window.DamAssocEdit;
        if (AE && typeof AE.bindMaterialsPane === "function") {
          var paneHost =
            mount.closest(".dam-media-preview__assoc-col") ||
            mount.closest(".dam-viz-modal__assoc-pane") ||
            mount;
          window.__damLastAssocProductCtx = ctx || null;
          AE.bindMaterialsPane(paneHost, {
            asset: shownPrimaries[0] || null,
            materialsList: shownPrimaries.slice(),
            shownPrimaries: shownPrimaries.slice(),
            productContext: ctx,
            groupContext: {
              product_id: pid,
              linked_product_ids: pid ? [pid] : [],
            },
            onRefresh: refreshLinkedBrandingAfterEdit,
          });
        }
        var toggle = mount.querySelector("[data-linked-assets-toggle]");
        if (toggle) {
          toggle.addEventListener("click", function () {
            var expanded = toggle.getAttribute("aria-expanded") === "true";
            var next = !expanded;
            mount.classList.toggle("is-collapsed-assets", !next);
            toggle.setAttribute("aria-expanded", next ? "true" : "false");
            var icon = toggle.querySelector("i");
            if (icon) icon.className = next ? "uil uil-angle-up" : "uil uil-angle-down";
            var lbl = toggle.querySelector("span");
            if (lbl) lbl.textContent = next ? "Zwiń" : "Pokaż wszystkie (" + shownGroups.length + ")";
            var m = document.getElementById("damMediaPreview") || document.getElementById("damVizModal");
            var shared = window.DamModalShared;
            if (m && shared && shared.scheduleFitChrome) shared.scheduleFitChrome(m);
          });
        }
      }
      renderElementyGroups(elementyHost, {
        ready: elementsReady.slice(0, 40),
        links: elementsLinks.slice(0, 40),
      });
      ensureAssocElementySplit(mount, elementyHost, pid);
      renderResizerCta(resizerHost, ctx);
      var m = document.getElementById("damMediaPreview") || document.getElementById("damVizModal");
      var shared = window.DamModalShared;
      if (m && shared && shared.scheduleFitChrome) shared.scheduleFitChrome(m);
    })
      .catch(function () {
        if (!document.body.contains(mount)) return;
        clearAssocPaneLoadingState(mount);
        mount.innerHTML =
          '<p class="dam-media-preview__assoc-empty">Nie udało się wczytać skojarzeń</p>';
        ensureAssocElementySplit(mount, elementyHost, pid);
      })
      .then(function () {
        finishAssocPaneLoading();
      });
  }

  /**
   * HARD (ui.viz_modal_parity_explorer): WARIANT produktu = inny INDEKS.
   * Nie lista perspektyw FRONT/BACK jako "Warianty materialu".
   */
  function productIndexKeyFromVariant(v) {
    if (!v) return "";
    var idx =
      String(v.index_base || v.index || v.product_index || "").split(".")[0] ||
      "";
    if (!idx && v.name) {
      var m = String(v.name).match(/\b(630\d{4})\b/);
      if (m) idx = m[1];
    }
    var lang = String(v.lang || "").toUpperCase();
    if (idx || lang) return lang + "|" + idx;
    return "";
  }

  function productIndexVariantsHtml(variants, activeId) {
    var list = (variants || []).filter(function (v) {
      return v && v.id && !isSourceVariantFile(v);
    });
    var byKey = {};
    var order = [];
    list.forEach(function (v) {
      var key = productIndexKeyFromVariant(v);
      if (!key) return;
      if (!byKey[key]) {
        byKey[key] = v;
        order.push(key);
      }
    });
    /* HARD 2026-07-21: pokazuj 1 wariant produktu (nie ukrywaj stripu). */
    if (!order.length) return "";
    var reps = order.map(function (k) {
      return byKey[k];
    });
    var body = reps
      .map(function (v) {
        var active = v.id === activeId ? " is-active" : "";
        var fileName = variantFileLabel(v);
        var label =
          (v.lang ? String(v.lang).toUpperCase() + " · " : "") +
          (String(v.index_base || v.index || "").split(".")[0] ||
            variantDisplayLabel(v, fileName));
        return (
          '<button type="button" class="dam-viz-modal__variant dam-media-preview__variant' +
          active +
          '" role="option" aria-selected="' +
          (active ? "true" : "false") +
          '" data-variant-id="' +
          esc(v.id) +
          '" title="' +
          esc(fileName) +
          '">' +
          (v.path
            ? variantThumbInnerHtml(v, fileName)
            : '<div class="dam-viz-modal__variant-placeholder dam-media-preview__variant-placeholder--noviz" title="Brak wizualizacji"><i class="uil uil-image-slash" aria-hidden="true"></i><span>Brak wizualizacji</span></div>') +
          '<span class="dam-viz-modal__variant-label">' +
          esc(label) +
          "</span></button>"
        );
      })
      .join("");
    return (
      '<div class="dam-media-preview__assoc dam-media-preview__assoc--variants-only">' +
      '<div class="dam-media-preview__assoc-col dam-media-preview__assoc-col--variants">' +
      assocLabelRow("Warianty produktu", "variant") +
      '<div class="dam-media-preview__variant-grid" role="listbox" aria-label="Warianty produktu">' +
      body +
      "</div></div></div>"
    );
  }

  function associationsFooterHtml(asset, groupContext, options) {
    options = options || {};
    var alwaysShow = options.alwaysShowAssociations !== false;
    var variants = (groupContext && groupContext.variants) || asset.folder_variants || [];
    /* mergeVar20260721a: branding material strip = full sibling list (PSD+JPG). */
    if (Array.isArray(options.siblings) && options.siblings.length) {
      variants = options.siblings.slice();
    }
    var linked = (groupContext && groupContext.linked_products) || asset.linked_products || [];
    if (!linked.length && (asset.folder_linked_product_ids || asset.linked_product_ids)) {
      linked = (asset.linked_product_ids || asset.folder_linked_product_ids || []).map(function (pid) {
        return { id: pid, display_name: pid, thumb_url: "" };
      });
    }
    /* Branding asset → produkty: wytnij spray folderowy bez sygnalu nazwy. */
    if (options.mode !== "viz-studio" || !options.productContext) {
      linked = filterLinkedProductsForBrandingAsset(asset, linked);
    }
    var isVizStudio = options.mode === "viz-studio";
    /* viz-studio / Eksplorator: NIE pasku perspektyw jako WARIANTY MATERIALU.
       Tylko warianty produktu (rozne indeksy). Osie pliku = studio TLO/PERSP/JAKOSC. */
    if (isVizStudio && options.productContext) {
      return productIndexVariantsHtml(variants, asset.id) || "";
    }
    var materialSiblings = !isVizStudio && variants.length > 1;
    var variantsHtml = folderVariantsHtml(variants, asset.id, {
      materialSiblings: materialSiblings,
    });
    var secondCol = linkedProductsHtml(linked);
    if (!alwaysShow && variants.length <= 1 && !linked.length) return "";
    return (
      '<div class="dam-media-preview__assoc">' +
      variantsHtml +
      '<div class="dam-media-preview__assoc-sep" aria-hidden="true"></div>' +
      secondCol +
      "</div>"
    );
  }

  function editableFilesFor(asset, groupContext) {
    var out = [];
    var seen = {};
    function push(f) {
      if (!f || !f.path) return;
      var key = String(f.path).toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(f);
    }
    (groupContext && groupContext.folder_editable_files
      ? groupContext.folder_editable_files
      : []
    ).forEach(push);
    (asset && asset.folder_editable_files ? asset.folder_editable_files : []).forEach(push);
    /* Siblings / variants z PSD w grupie marketingowej — tez do SourceMount (nie do gridu). */
    function pushIfSource(f) {
      if (!f || !f.path) return;
      if (EDITABLE_EXTS[fileExt(f.name || f.path)]) push(f);
    }
    (groupContext && groupContext.variants ? groupContext.variants : []).forEach(pushIfSource);
    if (asset && isSourceVariantFile(asset)) push(asset);
    return out;
  }

  function sourceFileMtimeMs(f) {
    if (!f) return 0;
    if (typeof f.mtime_ms === "number" && isFinite(f.mtime_ms)) return f.mtime_ms;
    var raw = f.mtime || f.modified || f.modified_at || f.updated_at || 0;
    if (typeof raw === "number" && isFinite(raw)) return raw < 1e12 ? raw * 1000 : raw;
    var t = Date.parse(String(raw || ""));
    return isNaN(t) ? 0 : t;
  }

  /** Preferuj najnowszy mtime przy wielu plikach tego samego rozszerzenia. */
  function pickNewestSourceFile(a, b) {
    var da = sourceFileMtimeMs(a);
    var db = sourceFileMtimeMs(b);
    if (db !== da) return db > da ? b : a;
    return String((b && b.path) || "").localeCompare(String((a && a.path) || "")) >= 0 ? b : a;
  }

  /** Pliki zrodlowe (PSD/PSB/AI/…) - CTA w #damMediaPreviewSourceMount (nie w variant-grid). */
  function sourceActionFiles(asset, groupContext) {
    var order = { psd: 0, psb: 1, ai: 2, pdf: 3, indd: 4, eps: 5 };
    var byExt = {};
    editableFilesFor(asset, groupContext).forEach(function (f) {
      if (!f || !f.path) return;
      /* Gdy podglad = raster, zrodla PSD i tak w mount; gdy podglad = PSD, pokaz inne zrodla. */
      if (asset && asset.path && f.path === asset.path) return;
      var ext = splitNameExt(f.name || f.path).ext;
      if (!(ext in order)) return;
      /* Jeden przycisk na rozszerzenie — najnowszy mtime (user: multiple PSD → most recent). */
      if (!byExt[ext]) byExt[ext] = f;
      else byExt[ext] = pickNewestSourceFile(byExt[ext], f);
    });
    /* Jesli otwarty asset to PSD, a folder ma inne PSD — najnowszy z grupy (wlacznie z biezacym). */
    if (asset && asset.path && EDITABLE_EXTS[fileExt(asset.name || asset.path)]) {
      var selfExt = splitNameExt(asset.name || asset.path).ext;
      if (selfExt in order) {
        var pool = editableFilesFor(asset, groupContext).filter(function (f) {
          return f && f.path && splitNameExt(f.name || f.path).ext === selfExt;
        });
        if (!pool.length) pool = [asset];
        var newest = pool.reduce(function (acc, f) {
          return pickNewestSourceFile(acc, f);
        }, pool[0]);
        byExt[selfExt] = newest;
      }
    }
    return Object.keys(byExt)
      .sort(function (a, b) {
        return order[a] - order[b];
      })
      .map(function (ext) {
        return byExt[ext];
      });
  }

  function splitNameExt(name) {
    var raw = String(name || "").trim();
    if (!raw) return { base: "", ext: "" };
    var dot = raw.lastIndexOf(".");
    if (dot <= 0 || dot === raw.length - 1) return { base: raw, ext: "" };
    var ext = raw.slice(dot + 1).toLowerCase();
    if (!/^[a-z0-9]{1,8}$/.test(ext)) return { base: raw, ext: "" };
    return { base: raw.slice(0, dot), ext: ext };
  }

  function extTagClass(ext) {
    if (!ext) return "dam-media-preview__ext-tag--default";
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") return "dam-media-preview__ext-tag--png";
    if (ext === "tif" || ext === "tiff") return "dam-media-preview__ext-tag--tif";
    if (ext === "psd" || ext === "psb" || ext === "ai") return "dam-media-preview__ext-tag--psd";
    if (ext === "pdf") return "dam-media-preview__ext-tag--pdf";
    if (ext === "mp4" || ext === "mov" || ext === "webm") return "dam-media-preview__ext-tag--mp4";
    return "dam-media-preview__ext-tag--default";
  }

  function titlePlain(name, fallbackId) {
    var parts = splitNameExt(name || fallbackId || "Material");
    return parts.base || name || fallbackId || "Material";
  }

  function titleHtml(name, fallbackId) {
    var parts = splitNameExt(name || fallbackId || "Material");
    var base = parts.base || name || fallbackId || "Material";
    var extTag = parts.ext
      ? '<span class="dam-media-preview__ext-tag ' +
        extTagClass(parts.ext) +
        '">' +
        esc(parts.ext.toUpperCase()) +
        "</span>"
      : "";
    return '<span class="dam-media-preview__title-base">' + esc(base) + "</span>" + extTag;
  }

  function titleMetaHtml(asset, options) {
    var idChip = assetIdChipHtml(asset, options);
    if (!idChip) return "";
    return '<div class="dam-media-preview__title-meta">' + idChip + "</div>";
  }

  var MARKETING_ID_CHIP_SEL =
    ".dam-media-preview__asset-id, .dam-media-preview__assoc-index, .dam-branding-id-chip, .dam-viz-modal__asset-id, .dam-viz-badge--index[data-marketing-id], .dam-viz-badge--index[data-tag-value], #damAssocEditPopover .dam-viz-badge--index";

  /** Klik / prawy / Enter na chipie ID = kopiuj WIDOCZNE id marketingowe (nigdy br-xxxxx). */
  function bindIdChipCopy(host) {
    if (!host) return;
    host.querySelectorAll(MARKETING_ID_CHIP_SEL).forEach(function (chip) {
      if (chip._damIdCopyBound) return;
      chip._damIdCopyBound = true;
      function doCopy(e) {
        e.preventDefault();
        e.stopPropagation();
        var mid =
          chip.getAttribute("data-marketing-id") ||
          chip.getAttribute("data-tag-value") ||
          chip.textContent.trim();
        if (!mid) return;
        copyToClipboard(mid).then(
          function () {
            toast("Skopiowano: " + mid);
          },
          function () {
            toast("Nie udalo sie skopiowac");
          }
        );
      }
      chip.addEventListener("click", doCopy);
      chip.addEventListener("contextmenu", doCopy);
      chip.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") doCopy(e);
      });
    });
  }

  /** Delegacja contextmenu - assoc-index / chipy doklejane async (viz assoc). */
  function ensureGlobalMarketingIdCopy() {
    if (document.documentElement._damMarketingIdCopyDelegated) return;
    document.documentElement._damMarketingIdCopyDelegated = true;
    document.addEventListener(
      "contextmenu",
      function (e) {
        var chip = e.target && e.target.closest ? e.target.closest(MARKETING_ID_CHIP_SEL) : null;
        if (!chip) return;
        if (chip.classList.contains("dam-tag-editable") && !chip.getAttribute("data-marketing-id")) {
          return;
        }
        var mid =
          chip.getAttribute("data-marketing-id") ||
          chip.getAttribute("data-tag-value") ||
          String(chip.textContent || "").trim();
        if (!mid) return;
        e.preventDefault();
        e.stopPropagation();
        copyToClipboard(mid).then(
          function () {
            toast("Skopiowano: " + mid);
          },
          function () {
            toast("Nie udalo sie skopiowac");
          }
        );
      },
      true
    );
  }
  ensureGlobalMarketingIdCopy();

  function seedLinkedProducts(asset, groupContext) {
    var linked = (groupContext && groupContext.linked_products) || asset.linked_products || [];
    if (linked && linked.length) return linked.slice();
    var ids = (asset && (asset.folder_linked_product_ids || asset.linked_product_ids)) || [];
    if (!ids.length) return [];
    return ids.map(function (pid) {
      return { id: pid, display_name: pid, thumb_url: "" };
    });
  }

  function isEditableSourceAsset(asset) {
    var ext = fileExt(asset && (asset.name || asset.path));
    return ext === "psd" || ext === "psb" || ext === "ai" || ext === "indd";
  }


  /**
   * CTA zrodlowe obok Przejdz / Folder - osobny przycisk na kazdy plik (etykieta = PSD/PSB/AI).
   * Nie pomylac z tagiem rozszerzenia w tytule.
   */
  function sourceFileActionHtml(asset, groupContext) {
    return sourceButtonsHtml(sourceActionFiles(asset, groupContext));
  }

  /** Jeden przycisk na rozszerzenie (PSD/PSB/AI) — najnowszy mtime przy duplikatach. */
  function dedupeSourceFilesByExt(files) {
    var order = { psd: 0, psb: 1, ai: 2, indd: 3, eps: 4 };
    var byExt = {};
    (files || []).forEach(function (f) {
      if (!f || !f.path) return;
      var ext = splitNameExt(f.name || f.path).ext;
      if (!(ext in order)) return;
      if (!byExt[ext]) byExt[ext] = f;
      else byExt[ext] = pickNewestSourceFile(byExt[ext], f);
    });
    return Object.keys(byExt)
      .sort(function (a, b) {
        return order[a] - order[b];
      })
      .map(function (ext) {
        return byExt[ext];
      });
  }

  function sourceButtonsHtml(files) {
    if (!files || !files.length) return "";
    return files
      .map(function (f) {
        var parts = splitNameExt(f.name || f.path);
        var extLabel = (parts.ext || "plik").toUpperCase();
        var label = f.name || f.path;
        var tip = "Otwiera plik zrodlowy (" + extLabel + "): " + label;
        return (
          '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-modal__cta dam-media-preview__source-btn" data-media-source-btn="1" data-path="' +
          esc(f.path) +
          '" data-dam-tip="' +
          esc(tip) +
          '" aria-label="' +
          esc(tip) +
          '" title="' +
          esc(tip) +
          '">' +
          '<i class="uil uil-layer-group" aria-hidden="true"></i><span>' +
          esc(extLabel) +
          "</span></button>"
        );
      })
      .join("");
  }

  function firstLinkedProductId(asset, groupContext) {
    var list =
      (groupContext && groupContext.linked_products) ||
      (asset && asset.linked_products) ||
      [];
    var hit = (list || []).find(function (p) {
      return p && p.id;
    });
    if (hit) return hit.id;
    var ids =
      (asset && (asset.linked_product_ids || asset.folder_linked_product_ids)) || [];
    return ids[0] || "";
  }

  function primaryEditableFile(asset, groupContext) {
    var editableFiles = editableFilesFor(asset, groupContext);
    if (!editableFiles.length) return null;
    var target = null;
    editableFiles.some(function (f) {
      if (f && f.path && f.path !== asset.path) {
        target = f;
        return true;
      }
      return false;
    });
    return target || editableFiles[0];
  }

  function initZoomDock(thumbStage, zoomBar) {
    var shared = window.DamModalShared;
    if (shared && typeof shared.initZoomDock === "function") {
      shared.initZoomDock(thumbStage, zoomBar);
    }
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.remove();
    document.body.classList.remove("dam-media-preview-open");
  }

  function openAsset(asset, options) {
    options = options || {};
    if (!asset) return;
    /* Always load viz-modal CSS: Folder outline hover fix lives there (vizCtaNav20260721a). */
    ensureVizModalCss();

    var siblings = Array.isArray(options.siblings) ? options.siblings.slice() : [asset];
    var idx = typeof options.index === "number" ? options.index : 0;
    if (idx < 0 || idx >= siblings.length) idx = 0;

    var groupContext = options.groupContext || null;
    if (!groupContext) {
      groupContext = {
        variants: asset.folder_variants || [],
        linked_products: seedLinkedProducts(asset, null),
        folder_group_id: asset.folder_group_id || "",
        folder_editable_files: asset.folder_editable_files || [],
      };
    } else if (!groupContext.linked_products || !groupContext.linked_products.length) {
      groupContext.linked_products = seedLinkedProducts(asset, groupContext);
    }

    var assetById = {};
    siblings.forEach(function (s) {
      if (s && s.id) assetById[s.id] = s;
    });
    (groupContext.variants || []).forEach(function (v) {
      if (v && v.id && !assetById[v.id]) assetById[v.id] = v;
    });
    var mergedList = Object.keys(assetById).map(function (id) {
      return assetById[id];
    });
    if (mergedList.length > 1) {
      siblings = mergedList;
      if (typeof options.index !== "number") {
        idx = siblings.findIndex(function (x) {
          return x.id === asset.id;
        });
        if (idx < 0) idx = 0;
      }
    }

    var existing = document.getElementById("damMediaPreview");
    if (existing) existing.remove();

    var syEnabled = localStorage.getItem("dam_synology_enabled") !== "false";
    var shareTitle = syEnabled ? "Udostepnij przez Synology" : "Udostepnij (wylaczone)";

    var navPrev =
      siblings.length > 1
        ? '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewPrev" aria-label="Poprzedni" title="Poprzedni"><i class="uil uil-angle-left"></i></button>'
        : "";
    var navNext =
      siblings.length > 1
        ? '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewNext" aria-label="Nastepny" title="Nastepny"><i class="uil uil-angle-right"></i></button>'
        : "";

    var isVizStudioLayout = options.mode === "viz-studio";
    var actionsHtml =
      '<div class="dam-viz-modal__actions">' +
      '<div class="dam-viz-modal__actions-main">' +
      '<button type="button" class="geex-btn geex-btn--primary geex-btn--sm dam-btn-icon dam-viz-modal__cta" id="damMediaPreviewGoProduct" data-dam-tip="Otwiera produkt w Eksplorerze">' +
      '<i class="uil uil-sitemap" aria-hidden="true"></i><span>Przejdź</span></button>' +
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-modal__cta dam-win-btn" id="damMediaPreviewExplorer" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera Eksplorator Windows z zaznaczonym plikiem">' +
      (window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>') +
      "<span>Folder</span></button>" +
      '<span id="damMediaPreviewSourceMount" class="dam-media-preview__source-mount" aria-label="Pliki zrodlowe"></span>' +
      /* --- FILE OPEN CTA (left of copy) --- */
      '<button type="button" class="dam-viz-icon-btn" id="damMediaPreviewOpenFile" data-dam-tip="Otwiera plik w domyślnej aplikacji Windows i kopiuje ścieżkę" aria-label="Otwórz plik" title="Otwórz plik">' +
      '<i class="uil uil-external-link-alt" aria-hidden="true"></i></button>' +
      '<button type="button" class="dam-viz-icon-btn" id="damMediaPreviewCopy" data-dam-tip="Kopiuje lokalną ścieżkę pliku" aria-label="Kopiuj ścieżkę" title="Kopiuj ścieżkę">' +
      '<i class="uil uil-copy" aria-hidden="true"></i></button>' +
      '<button type="button" class="dam-viz-icon-btn' +
      (syEnabled ? "" : " is-disabled") +
      '" id="damMediaPreviewShare" aria-label="Udostępnij" title="' +
      esc(shareTitle) +
      '" data-dam-tip="' +
      esc(shareTitle) +
      '"' +
      (syEnabled ? "" : " disabled") +
      '><i class="uil uil-share-alt" aria-hidden="true"></i></button>' +
      "</div></div>";
    var bodyInnerHtml =
      '<div class="dam-viz-modal__meta-rail">' +
      '<div class="dam-viz-modal__meta-block dam-viz-modal__meta-block--badges">' +
      '<div class="dam-viz-card__badges" id="damMediaPreviewBadges"></div></div>' +
      '<div class="dam-viz-modal__meta-block dam-viz-modal__meta-block--title">' +
      '<div class="dam-media-preview__title-block">' +
      '<h4 class="dam-viz-modal__title" id="damMediaPreviewTitle"></h4>' +
      '<div id="damMediaPreviewTitleMeta" class="dam-media-preview__title-meta-slot"></div>' +
      "</div></div>" +
      '<div class="dam-viz-modal__meta-block dam-viz-modal__meta-block--filemeta">' +
      '<div class="dam-media-preview__filemeta dam-viz-modal__filemeta">' +
      '<div class="dam-viz-modal__meta-line">' +
      '<span class="dam-viz-modal__meta-k">Nazwa pliku</span>' +
      '<p class="dam-viz-modal__filename" id="damMediaPreviewFilename" hidden></p>' +
      "</div>" +
      '<div class="dam-viz-modal__meta-line">' +
      '<span class="dam-viz-modal__meta-k">Typ pliku</span>' +
      '<p class="dam-viz-modal__carrier" id="damMediaPreviewTypeLine" hidden></p>' +
      "</div></div></div></div>" +
      '<div class="dam-viz-modal__studio-rail">' +
      '<div id="damMediaPreviewStudio" class="dam-media-preview__studio dam-media-preview__studio--rail" hidden></div>' +
      '<div id="damMediaPreviewQuality" class="dam-media-preview__quality" role="group" aria-label="Jakość / kompresja" hidden></div>' +
      "</div>" +
      /* WARIANTY full-width under meta|studio grid */
      '<div id="damMediaPreviewAssoc" class="dam-viz-modal__variants"></div>' +
      '<div id="damMediaPreviewAllFiles" class="dam-viz-modal__all-files-host" hidden></div>';
    var thumbHtml =
      '<div class="dam-viz-modal__thumb" id="damMediaPreviewThumb">' +
      '<div class="dam-viz-modal__zoom dam-media-preview__zoom" role="group" aria-label="Przybliżenie" data-dam-tip="CTRL+scroll lub ALT+scroll: zoom. Przy przybliżeniu: przeciągnij, żeby przesunąć.">' +
      navPrev +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewZoomOut" aria-label="Pomniejsz"><i class="uil uil-search-minus"></i></button>' +
      '<span class="dam-viz-modal__zoom-label" id="damMediaPreviewZoomLabel">100%</span>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewZoomIn" aria-label="Powiększ"><i class="uil uil-search-plus"></i></button>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewZoomReset" aria-label="Reset"><i class="uil uil-search"></i></button>' +
      navNext +
      "</div>" +
      "</div>";
    var assocPaneHtml = isVizStudioLayout
      ? '<aside class="dam-viz-modal__assoc-pane" aria-label="Skojarzone materiały">' +
        linkedBrandingColumnHtml() +
        "</aside>"
      : "";
    /* Actions outside scrollable __body when split; sticky fallback when inside body. */
    var boxInner = isVizStudioLayout
      ? '<div class="dam-viz-modal__main">' +
        thumbHtml +
        '<div class="dam-viz-modal__body">' +
        bodyInnerHtml +
        "</div>" +
        actionsHtml +
        "</div>" +
        assocPaneHtml
      : thumbHtml +
        '<div class="dam-viz-modal__body">' +
        bodyInnerHtml +
        actionsHtml +
        "</div>";
    var html =
      '<div class="dam-viz-modal-overlay dam-media-preview-overlay' +
      (isVizStudioLayout ? " dam-media-preview--viz-studio" : "") +
      '" id="damMediaPreview" role="dialog" aria-modal="true" aria-label="Podglad materialu">' +
      '<div class="dam-viz-modal-box' +
      (isVizStudioLayout ? " dam-viz-modal-box--assoc-split" : "") +
      '">' +
      '<button type="button" class="dam-viz-modal-close" id="damMediaPreviewClose" aria-label="Zamknij"><i class="uil uil-times"></i></button>' +
      boxInner +
      "</div></div>";

    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("damMediaPreview");
    document.body.classList.add("dam-media-preview-open");

    var shared = window.DamModalShared;
    var teardownChrome =
      shared && typeof shared.bindChromeFit === "function" ? shared.bindChromeFit(modal) : function () {};
    function closeSelf() {
      teardownChrome();
      closeModal(modal);
    }

    var thumbStage = document.getElementById("damMediaPreviewThumb");
    var heroEl = null;
    var zoomCtrl = null;

    window.__damVariantThumbFallback = function (img) {
      if (!img || !img.parentNode) return;
      var alt = img.getAttribute("alt") || "Plik";
      var ph = document.createElement("div");
      ph.className = "dam-viz-modal__variant-placeholder dam-media-preview__variant-placeholder";
      ph.title = alt;
      ph.innerHTML = '<i class="uil uil-image" aria-hidden="true"></i>';
      img.replaceWith(ph);
    };

    window.__damMediaPreviewFallback = function (img) {
      if (!img || img.dataset.fallbackTried) {
        img.onerror = null;
        img.src = PLACEHOLDER_SVG;
        return;
      }
      img.dataset.fallbackTried = "1";
      var path = img.getAttribute("data-path");
      if (path) {
        img.src = previewUrl(path);
        return;
      }
      img.onerror = null;
      img.src = PLACEHOLDER_SVG;
    };

  function detectVideoAspect(name) {
    var n = String(name || "").toLowerCase();
    if (/9\s*[x×]\s*16|9:16|\b9x16\b|vertical|pion/.test(n)) return "9 / 16";
    if (/1\s*[x×]\s*1|1:1|\b1x1\b|square|kwadrat/.test(n)) return "1 / 1";
    return "16 / 9";
  }

  function scheduleVideoStageFit() {
    var modal = document.getElementById("damMediaPreview");
    var shared = window.DamModalShared;
    if (modal && shared && typeof shared.scheduleFitChrome === "function") {
      shared.scheduleFitChrome(modal);
    } else if (modal && shared && typeof shared.fitVideoStage === "function") {
      shared.fitVideoStage(modal);
    }
  }

  function showVideoStageError(stage, message) {
    if (!stage) return;
    stage.classList.add("is-error");
    stage.classList.remove("is-playing", "is-ready");
    var vid = stage.querySelector(".dam-media-preview__video");
    if (vid) {
      vid.controls = false;
      vid.pause();
      vid.removeAttribute("src");
      try {
        vid.load();
      } catch (err) {
        /* ignore */
      }
      vid.style.display = "none";
    }
    if (stage.querySelector(".dam-media-preview__video-fallback")) return;
    var fb = document.createElement("div");
    fb.className = "dam-media-preview__video-fallback";
    fb.setAttribute("role", "alert");
    fb.innerHTML =
      '<i class="uil uil-film" aria-hidden="true"></i>' +
      "<p>" +
      esc(message) +
      "</p>";
    stage.appendChild(fb);
    scheduleVideoStageFit();
  }

  function renderVideoHero(thumb, a) {
    var stack = document.createElement("div");
    stack.className = "dam-media-preview__media-stack";

    var stage = document.createElement("div");
    stage.className = "dam-media-preview__video-stage";
    stage.style.setProperty("--dam-video-aspect", detectVideoAspect(a.name));

    var vid = document.createElement("video");
    vid.id = "damMediaPreviewHero";
    vid.className = "dam-media-preview__video";
    vid.controls = false;
    vid.playsInline = true;
    vid.preload = "metadata";
    vid.poster = VIDEO_POSTER_FALLBACK;
    vid.src = streamUrl(a.path);
    (function bindPoster(v, bridgePoster) {
      if (!bridgePoster) return;
      var probe = new Image();
      probe.onload = function () {
        try {
          v.poster = bridgePoster;
        } catch (e) {
          /* ignore */
        }
      };
      probe.onerror = function () {
        try {
          v.poster = VIDEO_POSTER_FALLBACK;
        } catch (e2) {
          /* ignore */
        }
      };
      probe.src = bridgePoster;
    })(vid, posterUrl(a.path));

    var playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "dam-media-preview__play";
    playBtn.setAttribute("aria-label", "Odtwórz wideo");
    playBtn.innerHTML = '<i class="uil uil-play" aria-hidden="true"></i>';

    var hintSlot = document.createElement("div");
    hintSlot.className = "dam-media-preview__hint-slot";

    stage.appendChild(vid);
    stage.appendChild(playBtn);
    stack.appendChild(stage);
    stack.appendChild(hintSlot);
    thumb.appendChild(stack);

    function beginPlayback() {
      if (stage.classList.contains("is-error")) return;
      vid.controls = true;
      var p = vid.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          showVideoStageError(
            stage,
            "Nie udało się odtworzyć wideo (sprawdź bridge /media i rozmiar pliku)."
          );
        });
      }
      stage.classList.add("is-playing");
    }

    playBtn.addEventListener("click", beginPlayback);
    vid.addEventListener("play", function () {
      stage.classList.add("is-playing");
    });
    vid.addEventListener("pause", function () {
      if (vid.currentTime <= 0.05) stage.classList.remove("is-playing");
    });
    vid.addEventListener("ended", function () {
      stage.classList.remove("is-playing");
    });
    vid.addEventListener("loadedmetadata", function () {
      if (vid.videoWidth > 0 && vid.videoHeight > 0) {
        stage.style.setProperty("--dam-video-aspect", vid.videoWidth + " / " + vid.videoHeight);
      }
      stage.classList.add("is-ready");
      scheduleVideoStageFit();
    });
    vid.onerror = function () {
      showVideoStageError(
        stage,
        "Nie udało się odtworzyć wideo (sprawdź bridge /media i rozmiar pliku)."
      );
    };

    heroEl = vid;
    scheduleVideoStageFit();
  }

    function renderStage(a) {
      var thumb = document.getElementById("damMediaPreviewThumb");
      if (!thumb) return;
      var oldHero = document.getElementById("damMediaPreviewHero");
      if (oldHero) oldHero.remove();
      var oldVideo = thumb.querySelector(".dam-media-preview__video");
      if (oldVideo) oldVideo.remove();
      var oldStack = thumb.querySelector(".dam-media-preview__media-stack");
      if (oldStack) oldStack.remove();
      var oldNothumb = thumb.querySelector(".dam-viz-modal__nothumb");
      if (oldNothumb) oldNothumb.remove();
      heroEl = null;
      if (zoomCtrl) zoomCtrl.resetView();

      if (a.media_type === "video" || isVideoAsset(a)) {
        renderVideoHero(thumb, a);
        return;
      }

      if (isRasterPreviewable(a)) {
        var img = document.createElement("img");
        img.id = "damMediaPreviewHero";
        img.alt = a.name || "";
        img.setAttribute("data-path", a.path || "");
        img.onerror = function () {
          window.__damMediaPreviewFallback && window.__damMediaPreviewFallback(img);
        };
        img.src = mediaUrl(a.path, a);
        thumb.appendChild(img);
        heroEl = img;
        return;
      }

      if (a.media_type === "vector") {
        var wrap = document.createElement("div");
        wrap.className = "dam-viz-modal__nothumb";
        wrap.innerHTML = '<i class="uil uil-vector-square"></i>';
        thumb.appendChild(wrap);
        var hint = document.createElement("p");
        hint.className = "dam-media-preview__hint";
        hint.textContent = "Wektor - otworz w aplikacji graficznej";
        thumb.appendChild(hint);
        return;
      }

      var fileWrap = document.createElement("div");
      fileWrap.className = "dam-viz-modal__nothumb";
      fileWrap.innerHTML = '<i class="uil uil-file"></i>';
      thumb.appendChild(fileWrap);
      var hint2 = document.createElement("p");
      hint2.className = "dam-media-preview__hint";
      hint2.textContent = a.name || "Plik";
      thumb.appendChild(hint2);
    }

    function bindSourceButtons(root) {
      if (!root) return;
      root.querySelectorAll("[data-media-source-btn]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var p = btn.getAttribute("data-path") || "";
          if (!p) return;
          if (window.DamPaths && typeof window.DamPaths.revealInExplorer === "function") {
            window.DamPaths.revealInExplorer(p);
          } else if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
            window.DamPaths.openFolderInExplorer(p);
          }
        });
      });
    }

    var qualityReqSeq = 0;
    var sourceReqSeq = 0;

    function setActionPaths(path) {
      ["damMediaPreviewExplorer", "damMediaPreviewOpenFile", "damMediaPreviewCopy", "damMediaPreviewShare"].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.setAttribute("data-path", path || "");
      });
    }

    function fileBasenameFromPath(path, fallbackName) {
      if (window.DamPaths && typeof window.DamPaths.basename === "function") {
        var b = window.DamPaths.basename(path || "");
        if (b) return b;
      }
      var n = String(path || "").replace(/\\/g, "/");
      var i = n.lastIndexOf("/");
      var fromPath = i >= 0 ? n.slice(i + 1) : n;
      return fromPath || String(fallbackName || "").trim();
    }

    function setFilenameLine(path, fallbackName) {
      var el = document.getElementById("damMediaPreviewFilename");
      if (!el) return;
      var name = fileBasenameFromPath(path, fallbackName);
      el.textContent = name || "";
      el.hidden = !name;
      if (name) el.setAttribute("title", name);
    }

    function setTypeLine(a) {
      var el = document.getElementById("damMediaPreviewTypeLine");
      if (!el) return;
      var parts = splitNameExt(a && (a.name || fileBasenameFromPath(a.path || "", "")));
      var ext = parts.ext ? parts.ext.toUpperCase() : "";
      var carrier =
        (a && (a.carrier_label || a.carrier)) ||
        (options.productContext && options.productContext.carrier) ||
        "";
      var idx =
        (a && (a.product_index || a.index_base || a.index)) ||
        (options.productContext && options.productContext.index) ||
        "";
      idx = String(idx || "").split(".")[0];
      var bits = [];
      if (ext) bits.push(ext);
      if (carrier) bits.push(String(carrier));
      if (idx) bits.push("Indeks " + idx);
      var text = bits.join(" · ");
      el.textContent = text;
      el.hidden = !text;
    }

    var VIZ_PERSP_ORDER = [
      "ENFACE",
      "FRONT",
      "BACK",
      "TYL-ENFACE",
      "BOK",
      "SIDE",
      "TOP",
      "3_4",
      "INNE",
      "OTHER",
    ];
    var VIZ_SIZE_ORDER = ["XL", "L", "S", "S-SKLEP"];

    /**
     * Branding material siblings (PSD/JPG packs) ≠ product viz axes.
     * Real axes = named perspective, XL/L/S size, or both bg kinds.
     */
    function itemsHaveRealVizAxes(list) {
      var realPersp = 0;
      var realSize = 0;
      var bgSeen = {};
      (list || []).forEach(function (it) {
        var p = String(it.persp || it.perspective || "")
          .toUpperCase()
          .replace(/_/g, "-");
        if (p && p !== "INNE" && p !== "OTHER" && p !== "?") realPersp += 1;
        var sz = String(it.size || "").toUpperCase();
        if (sz && VIZ_SIZE_ORDER.indexOf(sz) >= 0) realSize += 1;
        var bg = String(it.bg || it.background || "").toLowerCase();
        if (bg) bgSeen[bg] = true;
      });
      return realPersp > 0 || realSize > 0 || Object.keys(bgSeen).length > 1;
    }

    function materialFileTileLabel(it) {
      var name =
        (it && it.file && it.file.name) ||
        (it && it.name) ||
        fileBasenameFromPath((it && it.file && it.file.path) || (it && it.path) || "", "");
      var ext = String(name || "")
        .split(".")
        .pop()
        .toUpperCase();
      if (ext && ext !== String(name || "").toUpperCase()) return ext;
      var stem = String(name || "").replace(/\.[^.]+$/, "");
      if (stem.length > 18) stem = stem.slice(0, 16) + "…";
      return stem || "Plik";
    }

    /**
     * Branding: park studio under left WARIANTY column (not under whole assoc),
     * so SKOJARZONE PRODUKTY stays beside and preview stage gains height.
     * Before assoc innerHTML wipe, hoist studio out so the node survives.
     */
    function parkStudioOutsideAssoc() {
      var studio = document.getElementById("damMediaPreviewStudio");
      var assoc = document.getElementById("damMediaPreviewAssoc");
      if (!studio || !assoc || !assoc.contains(studio)) return;
      if (assoc.parentNode) {
        assoc.parentNode.insertBefore(studio, assoc.nextSibling);
      }
    }

    function ensureStudioUnderVariants() {
      var studio = document.getElementById("damMediaPreviewStudio");
      if (!studio) return;
      if ((options.mode || "") === "viz-studio") return;
      var slot = document.querySelector(
        "#damMediaPreviewAssoc .dam-media-preview__assoc-col--variants"
      );
      if (!slot) return;
      if (studio.parentElement !== slot) slot.appendChild(studio);
      studio.classList.add("dam-media-preview__studio--under-variants");
    }

    /**
     * Parity #damVizModal: 3 ramki CSS Grid TLO | PERSPEKTYWA | JAKOSC.
     * + przycisk "Pokaz wszystkie" = pelna siatka plikow z fade-in.
     * Branding material packs: no fake INNE/Z TŁEM axes — WARIANTY materiału.
     */
    function renderVizStudioControls(a) {
      var host = document.getElementById("damMediaPreviewStudio");
      if (!host) return;
      host.hidden = true;
      host.innerHTML = "";
      var qHost = document.getElementById("damMediaPreviewQuality");
      if (qHost) {
        qHost.innerHTML = "";
        qHost.hidden = true;
      }
      var mode = options.mode || "";
      var studio = options.vizStudio || null;
      var items = (studio && studio.items) || [];
      if (!items.length && mode !== "viz-studio") {
        /* Branding siblings: always allow material all-files when ≥2 files. */
        if (!siblings || siblings.length < 2) {
          var hasBgMeta = a && (a.bg || a.background);
          if (!hasBgMeta) return;
        }
      }
      if (!items.length) {
        siblings.forEach(function (s, i) {
          items.push({
            file: { path: s.path, name: s.name },
            persp: s.perspective || s.persp || "",
            bg: s.bg || s.background || "",
            lang: s.lang || "",
            size: s.size || "",
            ext: String(s.name || "").split(".").pop().toUpperCase(),
            siblingIndex: i,
          });
        });
      } else {
        items = items.map(function (it, i) {
          return Object.assign({}, it, { siblingIndex: i });
        });
      }
      if (!items.length) return;
      var materialMode = mode !== "viz-studio" && !itemsHaveRealVizAxes(items);

      var curPath = String(a.path || "")
        .toLowerCase()
        .replace(/\\/g, "/");
      var cur =
        items.find(function (it) {
          return (
            String((it.file && it.file.path) || "")
              .toLowerCase()
              .replace(/\\/g, "/") === curPath
          );
        }) || items[0];
      var state = {
        bg: cur.bg || "z-tlem",
        persp: cur.persp || "",
        size: cur.size || "",
      };
      var showAllFiles = false;

      function itemPath(it) {
        return String((it.file && it.file.path) || it.path || "")
          .toLowerCase()
          .replace(/\\/g, "/");
      }

      function uniqueKeys(pred) {
        var seen = {};
        var out = [];
        items.forEach(function (it) {
          var k = pred(it);
          if (!k || seen[k]) return;
          seen[k] = true;
          out.push(k);
        });
        return out;
      }

      function orderedPersps(list) {
        return VIZ_PERSP_ORDER.filter(function (p) {
          return list.indexOf(p) >= 0;
        }).concat(
          list.filter(function (p) {
            return VIZ_PERSP_ORDER.indexOf(p) < 0;
          })
        );
      }

      function orderedSizes(list) {
        return VIZ_SIZE_ORDER.filter(function (s) {
          return list.indexOf(s) >= 0;
        }).concat(
          list.filter(function (s) {
            return VIZ_SIZE_ORDER.indexOf(s) < 0;
          })
        );
      }

      function pickBest(next) {
        var best = -1;
        var bestScore = -1;
        items.forEach(function (it, i) {
          if (next.bg && it.bg && it.bg !== next.bg) return;
          if (next.persp && it.persp && it.persp !== next.persp) return;
          if (next.size && it.size && it.size !== next.size) return;
          var sc = 0;
          if (next.bg && it.bg === next.bg) sc += 8;
          if (next.persp && it.persp === next.persp) sc += 4;
          if (next.size && it.size === next.size) sc += 2;
          if (sc > bestScore) {
            bestScore = sc;
            best = typeof it.siblingIndex === "number" ? it.siblingIndex : i;
          }
        });
        if (best >= 0) showAt(best);
      }

      function frameHtml(label, aria, inner) {
        if (!inner) return "";
        return (
          '<div class="dam-media-preview__studio-frame" role="group" aria-label="' +
          esc(aria) +
          '">' +
          '<span class="dam-media-preview__studio-frame-label">' +
          esc(label) +
          "</span>" +
          '<div class="dam-media-preview__studio-frame-chips">' +
          inner +
          "</div></div>"
        );
      }

      function allFilesPanelHtml() {
        if (!showAllFiles || items.length < 2) return "";
        /* mergeVar20260721a: material siblings live in .variant-grid only — never duplicate all-files. */
        if (materialMode) return "";
        /* Product viz: group by Perspektywa + Tło — quality thumbs in a horizontal grid.
           bgSections20260721a: sections by Tło (Bez tła / Z tłem) come first, groups inside
           carry only the Perspektywa label — no interleaving, no repeated "· Z TŁEM" per tile. */
        var groups = {};
        var gOrder = [];
        items.forEach(function (it) {
          var gKey = (it.persp || "?") + "|" + (it.bg || "?");
          if (!groups[gKey]) {
            groups[gKey] = [];
            gOrder.push(gKey);
          }
          groups[gKey].push(it);
        });
        gOrder.sort(function (a, b) {
          var ap = a.split("|")[0];
          var bp = b.split("|")[0];
          var ai = VIZ_PERSP_ORDER.indexOf(ap);
          var bi = VIZ_PERSP_ORDER.indexOf(bp);
          if (ai < 0) ai = 999;
          if (bi < 0) bi = 999;
          return ai - bi;
        });
        function renderGroup(gk) {
          var bits = gk.split("|");
          var perspLab = bits[0] && bits[0] !== "?" ? bits[0] : "INNE";
          var bgKey = bits[1] === "bez-tla" ? "bez-tla" : "z-tlem";
          /* allrows20260721a: one tile per quality label inside Perspektywa group. */
          var bySize = {};
          var sizeOrderKeys = [];
          groups[gk].forEach(function (it) {
            var sk = it.size || "Plik";
            if (!bySize[sk]) {
              bySize[sk] = it;
              sizeOrderKeys.push(sk);
              return;
            }
            var prev = bySize[sk];
            var prevOn = itemPath(prev) === curPath;
            var nextOn = itemPath(it) === curPath;
            if (nextOn && !prevOn) {
              bySize[sk] = it;
              return;
            }
            if (prevOn) return;
            var pPath = (prev.file && prev.file.path) || prev.path || "";
            var nPath = (it.file && it.file.path) || it.path || "";
            var pScore =
              (prev.thumb_url || pPath ? 2 : 0) +
              (String(pPath).toLowerCase().indexOf(".png") >= 0 ? 1 : 0);
            var nScore =
              (it.thumb_url || nPath ? 2 : 0) +
              (String(nPath).toLowerCase().indexOf(".png") >= 0 ? 1 : 0);
            if (nScore > pScore) bySize[sk] = it;
          });
          sizeOrderKeys.sort(function (sa, sb) {
            var ia = VIZ_SIZE_ORDER.indexOf(sa);
            var ib = VIZ_SIZE_ORDER.indexOf(sb);
            if (ia < 0) ia = 999;
            if (ib < 0) ib = 999;
            return ia - ib;
          });
          var cards = sizeOrderKeys
            .map(function (sk) {
              var it = bySize[sk];
              var p = (it.file && it.file.path) || it.path || "";
              var on = itemPath(it) === curPath;
              var thumb =
                it.thumb_url ||
                (p ? previewUrl(p, it.file || it) : "") ||
                "";
              var sidx =
                typeof it.siblingIndex === "number" ? it.siblingIndex : -1;
              var lab = it.size || "Plik";
              return (
                '<button type="button" class="dam-media-preview__all-file' +
                (on ? " is-active" : "") +
                '" data-all-sib="' +
                sidx +
                '" data-all-path="' +
                esc(p) +
                '">' +
                (thumb
                  ? '<img src="' +
                    esc(thumb) +
                    '" alt="" loading="lazy" onerror="window.__damAssocThumbFallback&&__damAssocThumbFallback(this)">'
                  : '<span class="dam-media-preview__all-file-ph"></span>') +
                '<span class="dam-media-preview__all-file-label">' +
                esc(lab) +
                "</span></button>"
              );
            })
            .join("");
          return (
            '<div class="dam-media-preview__all-group" data-bg="' +
            bgKey +
            '">' +
            '<div class="dam-media-preview__all-group-label">' +
            esc(perspLab) +
            "</div>" +
            '<div class="dam-media-preview__all-group-grid">' +
            cards +
            "</div></div>"
          );
        }
        function renderSection(order, label, key) {
          if (!order.length) return "";
          return (
            '<section class="dam-media-preview__all-section dam-media-preview__all-section--' +
            key +
            '"><h5 class="dam-media-preview__all-section-label">' +
            esc(label) +
            '</h5><div class="dam-media-preview__all-section-grid">' +
            order.map(renderGroup).join("") +
            "</div></section>"
          );
        }
        var bezOrder = gOrder.filter(function (gk) {
          return gk.split("|")[1] === "bez-tla";
        });
        var zTlemOrder = gOrder.filter(function (gk) {
          return gk.split("|")[1] !== "bez-tla";
        });
        return (
          '<div class="dam-media-preview__all-files is-enter" id="damMediaPreviewAllFiles">' +
          renderSection(bezOrder, "Bez tła", "bez-tla") +
          renderSection(zTlemOrder, "Z tłem", "z-tlem") +
          "</div>"
        );
      }

      function paint() {
        var activeAsset = siblings[idx] || a;
        curPath = String((activeAsset && activeAsset.path) || a.path || "")
          .toLowerCase()
          .replace(/\\/g, "/");
        cur =
          items.find(function (it) {
            return itemPath(it) === curPath;
          }) || items[0];
        state = {
          bg: (cur && cur.bg) || state.bg || "z-tlem",
          persp: (cur && cur.persp) || state.persp || "",
          size: (cur && cur.size) || state.size || "",
        };

        var bgs = uniqueKeys(function (it) {
          return it.bg;
        });
        var persps = orderedPersps(
          uniqueKeys(function (it) {
            if (state.bg && it.bg && it.bg !== state.bg) return "";
            return it.persp;
          })
        );
        var sizes = orderedSizes(
          uniqueKeys(function (it) {
            if (state.bg && it.bg && it.bg !== state.bg) return "";
            if (state.persp && it.persp && it.persp !== state.persp) return "";
            return it.size;
          })
        );

        var chipCls = "dam-media-preview__studio-chip";
        var bgInner = "";
        var perspInner = "";
        var sizeInner = "";
        var frames = "";
        /* Material branding packs: no fake TŁO/PERSP/JAKOŚĆ — only sibling picker. */
        if (!materialMode) {
          bgs.forEach(function (bg) {
            var label = bg === "bez-tla" ? "Bez tła" : "Z tłem";
            var sub = bg === "bez-tla" ? "PNG" : "JPG";
            bgInner +=
              '<button type="button" class="' +
              chipCls +
              (bg === state.bg ? " is-active" : "") +
              '" data-studio-bg="' +
              esc(bg) +
              '"><span>' +
              esc(label) +
              '</span><small>&bull;&nbsp;' +
              esc(sub) +
              "</small></button>";
          });
          persps.forEach(function (p) {
            perspInner +=
              '<button type="button" class="' +
              chipCls +
              (p === state.persp ? " is-active" : "") +
              '" data-studio-persp="' +
              esc(p) +
              '">' +
              esc(p) +
              "</button>";
          });
          sizes.forEach(function (sz) {
            sizeInner +=
              '<button type="button" class="dam-media-preview__quality-pill' +
              (sz === state.size ? " is-active" : "") +
              '" data-studio-size="' +
              esc(sz) +
              '" aria-pressed="' +
              (sz === state.size ? "true" : "false") +
              '">' +
              esc(sz) +
              "</button>";
          });
          frames =
            frameHtml("Tło", "Tło", bgInner) +
            frameHtml("Perspektywa", "Perspektywa", perspInner) +
            frameHtml("Jakość", "Jakość", sizeInner);
        }
        if (!frames && items.length < 2) {
          host.hidden = true;
          host.innerHTML = "";
          return;
        }
        /* mergeVar20260721a: materialMode → hide studio; siblings already in variant-grid. */
        if (materialMode) {
          host.hidden = true;
          host.innerHTML = "";
          host.className =
            "dam-media-preview__studio dam-media-preview__studio--material";
          return;
        }

        var showAllBtn = "";
        if (items.length > 1 && !materialMode) {
          showAllBtn =
            '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-media-preview__show-all-btn" data-studio-show-all aria-expanded="' +
            (showAllFiles ? "true" : "false") +
            '"><i class="uil ' +
            (showAllFiles ? "uil-angle-up" : "uil-angle-down") +
            '" aria-hidden="true"></i><span>' +
            (showAllFiles ? "Zwiń" : "Pokaż wszystkie") +
            "</span></button>";
        }

        var underVariants = !!host.closest(
          ".dam-media-preview__assoc-col--variants"
        );
        host.className =
          "dam-media-preview__studio dam-media-preview__studio--rail" +
          (materialMode
            ? " dam-media-preview__studio--material"
            : " dam-media-preview__studio--tri") +
          (underVariants ? " dam-media-preview__studio--under-variants" : "");
        host.innerHTML =
          (frames
            ? '<div class="dam-media-preview__studio-frames">' + frames + "</div>"
            : "") +
          showAllBtn;
        host.hidden = false;
        var allPanel = allFilesPanelHtml();
        var allHost = modal.querySelector("#damMediaPreviewAllFiles");
        if (allHost) {
          allHost.innerHTML = allPanel || "";
          allHost.hidden = !allPanel;
        }

        host.querySelectorAll("[data-studio-bg]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            pickBest({
              bg: btn.getAttribute("data-studio-bg") || state.bg,
              persp: state.persp,
              size: state.size,
            });
            paint();
          });
        });
        host.querySelectorAll("[data-studio-persp]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            pickBest({
              bg: state.bg,
              persp: btn.getAttribute("data-studio-persp") || state.persp,
              size: state.size,
            });
            paint();
          });
        });
        host.querySelectorAll("[data-studio-size]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            pickBest({
              bg: state.bg,
              persp: state.persp,
              size: btn.getAttribute("data-studio-size") || state.size,
            });
            paint();
          });
        });
        var allBtn = host.querySelector("[data-studio-show-all]");
        if (allBtn) {
          allBtn.addEventListener("click", function () {
            showAllFiles = !showAllFiles;
            paint();
            if (shared && shared.scheduleFitChrome) shared.scheduleFitChrome(modal);
          });
        }
        var allBindRoot = allHost && !allHost.hidden ? allHost : host;
        allBindRoot.querySelectorAll("[data-all-sib]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var si = parseInt(btn.getAttribute("data-all-sib"), 10);
            if (!isNaN(si) && si >= 0) showAt(si);
            paint();
          });
        });
        /* brandComposer20260721a: Shift-minus on studio all-file quality tiles. */
        if (window.DamAssocEdit && typeof window.DamAssocEdit.wireStudioAllFiles === "function") {
          window.DamAssocEdit.wireStudioAllFiles(allBindRoot);
        }
        if (shared && shared.scheduleFitChrome) shared.scheduleFitChrome(modal);
      }

      paint();
    }

    /** Rule A (UI): segmentowane pigulki XL/L/S/XS - przelaczanie poziomu kompresji tej samej kreacji. */
    function renderQualityPills(a) {
      var host = document.getElementById("damMediaPreviewQuality");
      if (!host) return;
      host.hidden = true;
      host.innerHTML = "";
      var token = ++qualityReqSeq;
      loadIndexAssets().then(function (all) {
        if (token !== qualityReqSeq) return;
        if (!document.getElementById("damMediaPreviewQuality")) return;
        var set = findQualitySet(a, all);
        if (!set || set.length < 2) return;
        var currentPath = normSlashesLower(a.path);
        var activeFound = set.some(function (t) {
          return normSlashesLower(t.path) === currentPath;
        });
        host.innerHTML =
          '<span class="dam-media-preview__quality-label">Jakość:</span>' +
          set
            .map(function (t, i) {
              var isActive = activeFound
                ? normSlashesLower(t.path) === currentPath
                : i === 0;
              return (
                '<button type="button" class="dam-media-preview__quality-pill' +
                (isActive ? " is-active" : "") +
                '" data-quality-idx="' +
                i +
                '" aria-pressed="' +
                (isActive ? "true" : "false") +
                '" title="' +
                esc(t.path) +
                '" data-dam-tip="' +
                esc(t.label + ": " + t.path) +
                '">' +
                esc(t.label) +
                "</button>"
              );
            })
            .join("");
        host.hidden = false;
        host.querySelectorAll("[data-quality-idx]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var t = set[parseInt(btn.getAttribute("data-quality-idx"), 10)];
            if (!t) return;
            host.querySelectorAll("[data-quality-idx]").forEach(function (b) {
              var on = b === btn;
              b.classList.toggle("is-active", on);
              b.setAttribute("aria-pressed", on ? "true" : "false");
            });
            var overlay = Object.assign({}, a, { name: t.name || a.name, path: t.path });
            renderStage(overlay);
            setActionPaths(t.path);
            if (zoomCtrl) zoomCtrl.resetView();
          });
        });
        if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
          window.DamTooltips.bind(host);
        }
        if (shared && shared.scheduleFitChrome) shared.scheduleFitChrome(modal);
      });
    }

    /** Rule B (UI): brak zrodel w folderze -> szukaj w gore drzewa w indeksie. */
    function renderSourceFallback(a, sourceMount) {
      var token = ++sourceReqSeq;
      loadIndexAssets().then(function (all) {
        if (token !== sourceReqSeq) return;
        if (!sourceMount || !document.body.contains(sourceMount) || sourceMount.firstChild) return;
        var files = dedupeSourceFilesByExt(findEditableUpTree(a, all));
        if (!files.length) return;
        sourceMount.innerHTML = sourceButtonsHtml(files);
        bindSourceButtons(sourceMount);
        if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
          window.DamTooltips.bind(sourceMount);
        }
        if (shared && shared.scheduleFitChrome) shared.scheduleFitChrome(modal);
      });
    }

    function renderMeta(a) {
      var title = document.getElementById("damMediaPreviewTitle");
      var titleMeta = document.getElementById("damMediaPreviewTitleMeta");
      var badges = document.getElementById("damMediaPreviewBadges");
      var assocHost = document.getElementById("damMediaPreviewAssoc");
      var sourceMount = document.getElementById("damMediaPreviewSourceMount");
      /* Parity viz modal: skrócona nazwa produktu, nie duplikat basename w H1. */
      if (title) {
        var productTitle =
          options.mode === "viz-studio" &&
          options.productContext &&
          (options.productContext.name || options.productContext.display_name);
        if (productTitle) {
          title.textContent = String(productTitle);
        } else if (options.mode === "viz-studio") {
          title.innerHTML = titleHtml(a.name, a.id);
        } else {
          /* Branding: title = basename bez .ext (ext jako chip), filename poniżej. */
          title.innerHTML = titleHtml(a.name, a.id);
        }
      }
      setFilenameLine(a.path || "", a.name || "");
      setTypeLine(a);
      if (titleMeta) {
        titleMeta.innerHTML = titleMetaHtml(a, options);
        titleMeta.hidden = !String(titleMeta.innerHTML || "").trim();
        bindIdChipCopy(titleMeta);
      }
      if (sourceMount) {
        sourceMount.innerHTML = sourceFileActionHtml(a, groupContext);
        bindSourceButtons(sourceMount);
        if (!sourceMount.firstChild) renderSourceFallback(a, sourceMount);
      }
      renderQualityPills(a);
      if (assocHost) {
        var paintAssoc = function () {
          parkStudioOutsideAssoc();
          /* mergeVar20260721a: sync variants + pass siblings so variant-grid shows PSD/JPG. */
          if (siblings && siblings.length > 1 && (options.mode || "") !== "viz-studio") {
            groupContext.variants = siblings.slice();
          }
          assocHost.innerHTML = associationsFooterHtml(
            a,
            groupContext,
            Object.assign({}, options, { siblings: siblings })
          );
          bindIdChipCopy(assocHost);
          renderLinkedBrandingAssets(options);
          assocHost.querySelectorAll(".dam-media-preview__variant[data-variant-id]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var vid = btn.getAttribute("data-variant-id") || "";
              var targetIdx = siblings.findIndex(function (x) {
                return x.id === vid;
              });
              if (targetIdx >= 0) showAt(targetIdx);
            });
          });
          assocHost.querySelectorAll("[data-variants-toggle]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var grid = assocHost.querySelector(".dam-media-preview__variant-grid");
              if (!grid) return;
              var expanded = btn.getAttribute("aria-expanded") === "true";
              var next = !expanded;
              grid.classList.toggle("is-collapsed", !next);
              btn.setAttribute("aria-expanded", next ? "true" : "false");
              var icon = btn.querySelector("i");
              if (icon) icon.className = next ? "uil uil-angle-up" : "uil uil-angle-down";
              var label = btn.querySelector("span");
              if (label) {
                var total = grid.querySelectorAll(".dam-media-preview__variant[data-variant-id]").length;
                label.textContent = next ? "Zwiń" : "Pokaż wszystkie (" + total + ")";
              }
              if (shared && shared.scheduleFitChrome) shared.scheduleFitChrome(modal);
            });
          });
          if (window.DamAssocEdit && typeof window.DamAssocEdit.bind === "function") {
            window.DamAssocEdit.bind(assocHost, {
              asset: a,
              groupContext: groupContext,
              onRefresh: function () {
                renderMeta(asset);
              },
              onSaved: function (productIds, variantIds) {
                if (productIds && productIds.length) {
                  a.linked_product_ids = productIds.slice();
                  a.folder_linked_product_ids = productIds.slice();
                }
                if (variantIds && variantIds.length && groupContext.variants) {
                  var byId = {};
                  groupContext.variants.forEach(function (v) {
                    if (v && v.id) byId[v.id] = v;
                  });
                  groupContext.variants = variantIds.map(function (id) {
                    return byId[id] || { id: id, name: id };
                  });
                }
                if (window.DamAssocEdit.enrichLinkedProducts) {
                  window.DamAssocEdit.enrichLinkedProducts(
                    (productIds || []).map(function (id) {
                      return { id: id };
                    })
                  ).then(function (linked) {
                    groupContext.linked_products = linked;
                    a.linked_products = linked;
                    renderMeta(asset);
                  });
                } else {
                  renderMeta(asset);
                }
              },
            });
          }
          /* brandVar20260721a: studio under left variants col, then paint. */
          ensureStudioUnderVariants();
          renderVizStudioControls(a);
          if (shared && shared.scheduleFitChrome) shared.scheduleFitChrome(modal);
        };
        /* brandComposer20260721a: NEVER block WARIANTY strip on enrichLinkedProducts /
           ensureFileIndex (huge file-index can hang). Paint seed first; enrich async. */
        paintAssoc();
        if (window.DamAssocEdit && typeof window.DamAssocEdit.enrichLinkedProducts === "function") {
          var seedLinked = seedLinkedProducts(a, groupContext);
          if (seedLinked && seedLinked.length) {
            window.DamAssocEdit.enrichLinkedProducts(seedLinked)
              .then(function (linked) {
                var cleaned =
                  options.mode === "viz-studio" && options.productContext
                    ? linked
                    : filterLinkedProductsForBrandingAsset(a, linked);
                groupContext.linked_products = cleaned;
                a.linked_products = cleaned;
                paintAssoc();
              })
              .catch(function () {
                /* keep seeded assoc UI */
              });
          }
        }
      } else {
        renderVizStudioControls(a);
      }
      if (badges) {
        badges.innerHTML = badgesHtml(a);
        if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
          window.DamBadges.bindClicks(badges, "branding");
        }
        ensureModalTagPlusUx(badges, {
          mode: options.mode === "viz-studio" ? "product" : "branding",
          asset: a,
          product: options.productContext || null,
          kind: options.mode === "viz-studio" ? "carrier" : "appearance",
        });
      }
      var goProduct = document.getElementById("damMediaPreviewGoProduct");
      var explorer = document.getElementById("damMediaPreviewExplorer");
      var openFileBtn = document.getElementById("damMediaPreviewOpenFile");
      var copyBtn = document.getElementById("damMediaPreviewCopy");
      var shareBtn = document.getElementById("damMediaPreviewShare");
      var pid = firstLinkedProductId(a, groupContext);
      if (goProduct) {
        goProduct.setAttribute("data-pid", pid || "");
        goProduct.disabled = !pid;
        goProduct.classList.toggle("is-disabled", !pid);
        goProduct.setAttribute(
          "data-dam-tip",
          pid ? "Otwiera produkt w Eksplorerze" : "Brak skojarzonego produktu"
        );
      }
      if (explorer) explorer.setAttribute("data-path", a.path || "");
      if (openFileBtn) openFileBtn.setAttribute("data-path", a.path || "");
      if (copyBtn) copyBtn.setAttribute("data-path", a.path || "");
      if (shareBtn) shareBtn.setAttribute("data-path", a.path || "");
      renderStage(a);
      if (shared && shared.scheduleFitChrome) shared.scheduleFitChrome(modal);
    }

    function showAt(newIdx) {
      if (newIdx < 0 || newIdx >= siblings.length) return;
      idx = newIdx;
      asset = siblings[idx];
      renderMeta(asset);
      if (zoomCtrl) zoomCtrl.resetView();
    }

    renderMeta(asset);

    if (shared && typeof shared.bindZoom === "function") {
      zoomCtrl = shared.bindZoom({
        thumbStage: thumbStage,
        labelEl: document.getElementById("damMediaPreviewZoomLabel"),
        zoomBar: thumbStage && thumbStage.querySelector(".dam-viz-modal__zoom"),
        zoomInBtn: document.getElementById("damMediaPreviewZoomIn"),
        zoomOutBtn: document.getElementById("damMediaPreviewZoomOut"),
        zoomResetBtn: document.getElementById("damMediaPreviewZoomReset"),
        getHero: function () {
          return heroEl;
        },
      });
    }

    var zoomBar = thumbStage && thumbStage.querySelector(".dam-media-preview__zoom, .dam-viz-modal__zoom");
    initZoomDock(thumbStage, zoomBar);

    var prevBtn = document.getElementById("damMediaPreviewPrev");
    var nextBtn = document.getElementById("damMediaPreviewNext");
    if (prevBtn) prevBtn.addEventListener("click", function (e) { e.stopPropagation(); showAt(idx - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function (e) { e.stopPropagation(); showAt(idx + 1); });

    document.getElementById("damMediaPreviewClose").addEventListener("click", function () {
      closeSelf();
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeSelf();
    });
    document.addEventListener("keydown", function onKey(e) {
      if (!document.getElementById("damMediaPreview")) {
        document.removeEventListener("keydown", onKey);
        return;
      }
      if (e.key === "Escape") {
        if (document.getElementById("damAssocActionMenu")) {
          if (window.DamAssocEdit && typeof window.DamAssocEdit.closeActionMenu === "function") {
            window.DamAssocEdit.closeActionMenu();
          }
          e.preventDefault();
          return;
        }
        if (document.getElementById("damAssocEditOverlay") || document.getElementById("damAssocEditPopover")) {
          if (window.DamAssocEdit && typeof window.DamAssocEdit.closePicker === "function") {
            window.DamAssocEdit.closePicker();
          }
          e.preventDefault();
          return;
        }
        closeSelf();
        document.removeEventListener("keydown", onKey);
      } else if (e.key === "ArrowLeft" && siblings.length > 1) {
        showAt(idx - 1);
      } else if (e.key === "ArrowRight" && siblings.length > 1) {
        showAt(idx + 1);
      }
    });

    var goProductBtn = document.getElementById("damMediaPreviewGoProduct");
    if (goProductBtn) {
      goProductBtn.addEventListener("click", function () {
        var pid = goProductBtn.getAttribute("data-pid") || "";
        if (!pid) {
          toast("Brak skojarzonego produktu");
          return;
        }
        closeSelf();
        location.href = "explorer.html?product=" + encodeURIComponent(pid);
      });
    }

    var explorerBtn = document.getElementById("damMediaPreviewExplorer");
    if (explorerBtn) {
      explorerBtn.addEventListener("click", function () {
        /* Zrodlo prawdy = aktualny asset (S gdy widzimy S), nie stale data-path */
        var p = (asset && asset.path) || explorerBtn.getAttribute("data-path") || "";
        if (p) explorerBtn.setAttribute("data-path", p);
        /* Folder = reveal + select pliku (explorer /select, via bridge POST /reveal) */
        if (window.DamPaths && typeof window.DamPaths.revealInExplorer === "function") {
          window.DamPaths.revealInExplorer(p);
        } else if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
          window.DamPaths.openFolderInExplorer(p);
        }
      });
    }

    /* --- OPEN FILE (left of copy): default app + clipboard --- */
    var openFileBtn = document.getElementById("damMediaPreviewOpenFile");
    if (openFileBtn) {
      openFileBtn.addEventListener("click", function () {
        var p = openFileBtn.getAttribute("data-path") || "";
        if (!p) {
          toast("Brak sciezki pliku");
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.openFileAndCopyPath === "function") {
          window.DamPaths.openFileAndCopyPath(p);
          return;
        }
        if (window.DamPaths && typeof window.DamPaths.copyPortablePath === "function") {
          window.DamPaths.copyPortablePath(p);
        }
      });
    }

    var copyBtn = document.getElementById("damMediaPreviewCopy");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var rawPath = copyBtn.getAttribute("data-path") || "";
        if (window.DamPaths && typeof window.DamPaths.copyPortablePath === "function") {
          window.DamPaths.copyPortablePath(rawPath);
          return;
        }
        copyToClipboard(rawPath).then(function () {
          toast("Skopiowano sciezke do schowka");
        });
      });
    }

    var shareBtn = document.getElementById("damMediaPreviewShare");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        if (!syEnabled) return;
        var p = shareBtn.getAttribute("data-path") || "";
        closeSelf();
        if (window.DamPaths && typeof window.DamPaths.shareViaSynology === "function") {
          window.DamPaths.shareViaSynology(p);
        }
      });
    }

    if (window.DamTooltips && typeof window.DamTooltips.bind === "function") {
      window.DamTooltips.bind(modal);
    }
  }

  window.DamCardZoom = {
    KEY: CARD_ZOOM_KEY,
    MIN: CARD_ZOOM_MIN,
    MAX: CARD_ZOOM_MAX,
    STEP: CARD_ZOOM_STEP,
    readPct: readCardZoomPct,
    apply: applyCardZoomPct,
    bindShiftKeys: bindShiftCardZoomKeys,
    roots: cardZoomRoots,
    baseFactor: basePreviewZoom,
    modalStartPct: function () {
      return window.DamModalShared
        ? window.DamModalShared.modalStartZoomPct(readCardZoomPct())
        : readCardZoomPct();
    },
    modalStartFactor: function () {
      return window.DamModalShared ? window.DamModalShared.modalResetZoomFactor() : basePreviewZoom();
    },
  };

  function ensureVizModalCss() {
    var href = "assets/css/dam-viz-modal.css?v=modalShiftAdmin20260722a";
    var existing = document.getElementById("dam-viz-modal-css");
    if (existing) {
      if (existing.tagName === "LINK" && existing.getAttribute("href") !== href) {
        existing.href = href;
      }
      return;
    }
    var link = document.createElement("link");
    link.id = "dam-viz-modal-css";
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  window.DamMediaPreview = {
    openAsset: openAsset,
    /* Pkt 6/7: pozwala innym modulom (dam-viz) osadzic "Skojarzone materialy" */
    renderLinkedAssetsInto: function (mount, labelEl, productContext) {
      renderLinkedBrandingAssets({ mount: mount, labelEl: labelEl, productContext: productContext });
    },
    /** Shift+Admin PLUS przy wierszu tagow w modalach content (viz/branding/product). */
    ensureModalTagPlusUx: ensureModalTagPlusUx,
    showAdminShiftPlus: showAdminShiftPlus,
    assocPaneSkeletonHtml: assocPaneSkeletonHtml,
    showAssocPaneLoading: showAssocPaneLoading,
    passesMarketingAssocMaterial: passesMarketingAssocMaterial,
    filterLinkedProductsForBrandingAsset: filterLinkedProductsForBrandingAsset,
    isRelevantMaterialForProduct: isRelevantMaterialForProduct,
    groupAssocMaterials: groupAssocMaterials,
    familyCreativeKey: familyCreativeKey,
    assocMaterialGroupKey: assocMaterialGroupKey,
    isSourceLikeAsset: isSourceLikeAsset,
    isVisualizationAsset: isVisualizationAsset,
    previewUrl: previewUrl,
    mediaUrl: mediaUrl,
    streamUrl: streamUrl,
    posterUrl: posterUrl,
    needsServerPreview: needsServerPreview,
    isRasterPreviewable: isRasterPreviewable,
    isVideoAsset: isVideoAsset,
  };
})();
