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
  var VIDEO_EXTS = { mp4: 1, mov: 1, webm: 1, avi: 1, mkv: 1, m4v: 1 };
  var CARD_ZOOM_KEY = "dam_viz_card_zoom";
  var CARD_ZOOM_MIN = 65;
  var CARD_ZOOM_MAX = 350;
  var ELEMENT_ASSOC_RE = /(^|[^a-z0-9])(skladniki|składniki|owoce|owocki)([^a-z0-9]|$)/i;

  /** STREFA A3: style wstrzykniete (nie ruszamy dam-brand.css / dam-branding.css). */
  function injectA3Styles() {
    if (document.getElementById("dam-a3-styles")) return;
    var st = document.createElement("style");
    st.id = "dam-a3-styles";
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
      ".dam-media-preview__elementy-panel{margin-top:8px;}",
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
      /* Task 38: ikona zamiast broken-image */
      ".dam-media-preview__assoc-thumb--fallback{",
      "display:flex;align-items:center;justify-content:center;width:100%;height:100%;",
      "min-height:48px;background:var(--dam-surface-muted,#f1f3f6);",
      "color:var(--dam-text-muted,#94a3b8);border-radius:6px;}",
      ".dam-media-preview__assoc-thumb--fallback i{font-size:20px;}",
    ].join("");
    document.head.appendChild(st);
  }
  if (document.head) injectA3Styles();
  else document.addEventListener("DOMContentLoaded", injectA3Styles);

  function pathNormSlashes(p) {
    return String(p || "").replace(/\//g, "\\");
  }

  /** SUROWE ELEMENTY: folder Links (np. ...\\2 - PROJEKT\\Links\\flor2.png). */
  function isLinksRawPath(path) {
    var n = pathNormSlashes(path).toLowerCase();
    if (!n) return false;
    if (n.indexOf("\\2 - projekt\\links\\") >= 0) return true;
    if (n.indexOf("\\links\\") >= 0) return true;
    if (/\\links$/i.test(n)) return true;
    return false;
  }

  /** GOTOWE ELEMENTY: ...\\1 - MATERIALY\\ELEMENTY\\... */
  function isMaterialyElementyPath(path) {
    var n = pathNormSlashes(path).toLowerCase();
    if (!n) return false;
    if (n.indexOf("\\1 - materia") >= 0 && n.indexOf("\\elementy") >= 0) return true;
    return false;
  }

  function isElementPath(path) {
    return isLinksRawPath(path) || isMaterialyElementyPath(path);
  }

  function assetMatchesElementAssoc(x) {
    if (!x) return false;
    var blob = String(x.search_blob || "");
    var tags = Array.isArray(x.tags) ? x.tags.join(" ") : "";
    var appearance = Array.isArray(x.appearance_tags) ? x.appearance_tags.join(" ") : "";
    return ELEMENT_ASSOC_RE.test(blob + " " + tags + " " + appearance + " " + String(x.name || ""));
  }

  function classifyAssocAsset(x) {
    if (!x) return "material";
    if (isElementPath(x.path) || assetMatchesElementAssoc(x)) return "element";
    return "material";
  }

  /**
   * PI viz.assoc_no_visualization_loop: packshot / WIZKI / VISUALS nie moga
   * trafic do "Skojarzone materialy" przy podgladzie innej wizualizacji.
   */
  function isVisualizationAsset(x) {
    if (!x) return false;
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
   * albo nazwa/indeks w sciezce). Odciecie kafelkow WWW obcych produktow.
   */
  function isRelevantMaterialForProduct(x, ctx) {
    if (!x) return false;
    var role = String(x.asset_role || "").toLowerCase();
    if (VIZ_ASSOC_KEEP_ROLES[role]) return true;
    var blob = String(x.name || "") + " " + String(x.path || "") + " " + String(x.search_blob || "");
    blob = blob.toLowerCase();
    var idxBase = String((ctx && ctx.index) || "").split(".")[0];
    if (idxBase && idxBase.length >= 4 && blob.indexOf(idxBase.toLowerCase()) >= 0) return true;
    var name = String((ctx && ctx.name) || "").toLowerCase();
    if (name) {
      var tokens = name.split(/[^a-z0-9ąćęłńóśźż]+/i).filter(function (t) {
        return t && t.length > 3;
      });
      var hits = 0;
      tokens.forEach(function (t) {
        if (blob.indexOf(t) >= 0) hits += 1;
      });
      if (tokens.length && hits >= Math.min(2, tokens.length)) return true;
      if (tokens.length === 1 && hits === 1) return true;
    }
    return false;
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
    if (img.dataset.fallbackDone === "1") return;
    img.dataset.fallbackDone = "1";
    img.onerror = null;
    var ph = document.createElement("span");
    ph.className = "dam-media-preview__assoc-thumb dam-media-preview__assoc-thumb--fallback";
    ph.setAttribute("aria-hidden", "true");
    ph.innerHTML = '<i class="uil uil-image-slash"></i>';
    img.replaceWith(ph);
  };

  function readCardZoomPct() {
    var n = parseInt(localStorage.getItem(CARD_ZOOM_KEY) || "100", 10);
    if (isNaN(n)) n = 100;
    return Math.min(CARD_ZOOM_MAX, Math.max(CARD_ZOOM_MIN, n));
  }

  function basePreviewZoom() {
    return readCardZoomPct() / 100;
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
    var url = bridgeUrl() + "/media?path=" + encodeURIComponent(local);
    if ((asset && needsServerPreview(asset)) || PREVIEW_EXTS[fileExt(path)]) {
      url += "&preview=1";
    }
    return url;
  }

  function mediaUrl(path, asset) {
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
                  : '<span class="dam-media-preview__assoc-thumb dam-media-preview__assoc-thumb--fallback" aria-hidden="true"><i class="uil uil-image-slash"></i></span>') +
                "</button>" +
                '<button type="button" class="dam-media-preview__assoc-name" data-assoc-name data-product-id="' +
                esc(p.id) +
                '" title="' +
                esc(label) +
                '">' +
                esc(label) +
                "</button>" +
                (idx
                  ? '<span class="dam-media-preview__assoc-index">' + esc(idx) + "</span>"
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

  var EDITABLE_EXTS = { psd: 1, psb: 1, ai: 1, indd: 1, eps: 1 };
  var SOURCE_DIR_RE = /^(psd|psb|ai|edytowalne|zrodla|zrodlo|source|sources|src)$/i;
  var QUALITY_LABELS = ["XL", "L", "S", "XS", "XXS", "XXXS"];
  var _indexAssetsPromise = null;

  function loadIndexAssets() {
    if (_indexAssetsPromise) return _indexAssetsPromise;
    // Reuzyj indeksu zaladowanego przez dam-branding.js (ta sama sesja) zamiast
    // pobierac ~35 MB drugi raz.
    if (window.__damBrandingIndex && window.__damBrandingIndex.assets) {
      _indexAssetsPromise = Promise.resolve(window.__damBrandingIndex.assets);
      return _indexAssetsPromise;
    }
    _indexAssetsPromise = fetch(bridgeUrl() + "/branding-index")
      .then(function (r) {
        if (!r.ok) throw new Error("bridge_branding_index");
        return r.json();
      })
      .catch(function () {
        return fetch("data/branding-index.json").then(function (r) {
          return r.ok ? r.json() : null;
        });
      })
      .then(function (d) {
        if (d && d.assets && !window.__damBrandingIndex) {
          try {
            window.__damBrandingIndex = d;
          } catch (eShare) {
            /* ignore */
          }
        }
        return (d && d.assets) || [];
      })
      .catch(function () {
        return [];
      });
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
   */
  function creativeKey(nameOrPath) {
    var base = String(baseNameNoExt(nameOrPath)).toLowerCase();
    base = base.replace(/[\s._\u2013\u2014-]+/g, "-");
    base = base.replace(/\b(skompresowane|compressed|compress|ultralow|ultra|low|high|hq|full|master|oryginalne|oryginal|org|min)\b/g, "");
    base = base.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
    return base;
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

  function folderVariantsHtml(variants, activeId) {
    var list = (variants || []).filter(function (v) {
      return v && v.id;
    });
    list = dedupeVariantsByCreative(list, activeId);
    var activeIdx = list.findIndex(function (v) {
      return v.id === activeId;
    });
    if (activeIdx >= VARIANTS_VISIBLE_COLLAPSED) {
      var activeItem = list.splice(activeIdx, 1)[0];
      list.unshift(activeItem);
    }
    var collapsible = list.length > VARIANTS_VISIBLE_COLLAPSED;
    var body =
      list.length > 0
        ? list
            .map(function (v, i) {
              var active = v.id === activeId ? " is-active" : "";
              var extra = collapsible && i >= VARIANTS_VISIBLE_COLLAPSED ? " dam-media-preview__variant--extra" : "";
              var fileName = variantFileLabel(v);
              return (
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
                esc(variantDisplayLabel(v, fileName)) +
                "</span></button>"
              );
            })
            .join("")
        : '<p class="dam-media-preview__assoc-empty">Brak wariantów</p>';
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
      '<div class="dam-media-preview__assoc-grid" id="damMediaPreviewLinkedAssets" role="list">' +
      '<p class="dam-media-preview__assoc-empty">Ładowanie…</p>' +
      "</div>" +
      '<div class="dam-media-preview__elementy" id="damMediaPreviewElementyHost" hidden></div>' +
      '<div class="dam-media-preview__resizer-wrap" id="damMediaPreviewResizerHost" hidden></div>' +
      "</div>"
    );
  }

  function linkedBrandingCardHtml(x, i, extra, idxAttr) {
    var label = splitNameExt(x.name || "").base || x.name || x.id || "Materiał";
    var mkId = marketingDisplayId(x);
    var thumb = isRasterPreviewable(x) ? previewUrl(x.path, x) : "";
    var attr = idxAttr || "data-linked-asset-idx";
    return (
      '<div class="dam-media-preview__assoc-item dam-media-preview__assoc-item--asset' +
      (extra ? " dam-media-preview__assoc-item--extra" : "") +
      '" role="listitem">' +
      '<button type="button" class="dam-media-preview__assoc-thumb-btn" ' +
      attr +
      '="' +
      i +
      '" title="' +
      esc(label) +
      '">' +
      (thumb
        ? '<img class="dam-media-preview__assoc-thumb" src="' +
          esc(thumb) +
          '" alt="' +
          esc(label) +
          '" loading="lazy" onerror="window.__damAssocThumbFallback&&__damAssocThumbFallback(this)">'
        : '<span class="dam-media-preview__assoc-thumb dam-media-preview__assoc-thumb--fallback" aria-hidden="true"><i class="uil uil-image-slash"></i></span>') +
      "</button>" +
      '<button type="button" class="dam-media-preview__assoc-name" ' +
      attr +
      '="' +
      i +
      '" title="' +
      esc(label) +
      '">' +
      esc(label) +
      "</button>" +
      (mkId
        ? '<span class="dam-media-preview__assoc-index" title="ID marketingowe">' + esc(mkId) + "</span>"
        : "") +
      "</div>"
    );
  }

  var LINKED_ASSETS_VISIBLE = 6;

  function bindLinkedAssetClicks(host, list, attrName) {
    if (!host || !list) return;
    host.querySelectorAll("[" + attrName + "]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = parseInt(btn.getAttribute(attrName), 10) || 0;
        var target = list[i];
        if (!target) return;
        openAsset(target, { siblings: list.slice(), index: i });
      });
    });
  }

  function renderElementyGroup(host, elements) {
    if (!host) return;
    if (!elements || !elements.length) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML =
      '<button type="button" class="dam-media-preview__elementy-toggle" data-elementy-toggle aria-expanded="false">' +
      '<i class="uil uil-angle-down" aria-hidden="true"></i>' +
      "<span>ELEMENTY (" +
      elements.length +
      ")</span></button>" +
      '<div class="dam-media-preview__elementy-panel" data-elementy-panel hidden>' +
      '<p class="dam-media-preview__elementy-hint">Surowe elementy z Links oraz gotowe z 1 - MATERIAŁY\\ELEMENTY. Skojarzenia: składniki / owoce / owocki.</p>' +
      '<div class="dam-media-preview__assoc-grid" role="list">' +
      elements
        .map(function (x, i) {
          return linkedBrandingCardHtml(x, i, false, "data-element-asset-idx");
        })
        .join("") +
      "</div></div>";
    var toggle = host.querySelector("[data-elementy-toggle]");
    var panel = host.querySelector("[data-elementy-panel]");
    if (toggle && panel) {
      toggle.addEventListener("click", function () {
        var open = toggle.getAttribute("aria-expanded") === "true";
        var next = !open;
        toggle.setAttribute("aria-expanded", next ? "true" : "false");
        panel.hidden = !next;
        var icon = toggle.querySelector("i");
        if (icon) icon.className = next ? "uil uil-angle-up" : "uil uil-angle-down";
        var m = document.getElementById("damMediaPreview");
        var shared = window.DamModalShared;
        if (m && shared && shared.scheduleFitChrome) shared.scheduleFitChrome(m);
      });
    }
    bindLinkedAssetClicks(host, elements, "data-element-asset-idx");
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
    var ctx = (options && options.productContext) || {};
    var pid = ctx.id || "";
    var idxBase = String(ctx.index || "").split(".")[0];
    if (!pid && !idxBase) {
      mount.innerHTML = '<p class="dam-media-preview__assoc-empty">Brak skojarzonych materiałów</p>';
      if (elementyHost) {
        elementyHost.hidden = true;
        elementyHost.innerHTML = "";
      }
      if (resizerHost) {
        resizerHost.hidden = true;
        resizerHost.innerHTML = "";
      }
      return;
    }
    loadIndexAssets().then(function (all) {
      if (!document.body.contains(mount)) return;
      var hits = (all || []).filter(function (x) {
        if (!x) return false;
        /* HARD: zero petli wiz→wiz w kolumnie skojarzonych materialow */
        if (isVisualizationAsset(x)) return false;
        if (isNoiseBrandKitAsset(x)) return false;
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
        /* Elementy (Links/ELEMENTY) zawsze; materialy tylko relewantne do produktu */
        if (classifyAssocAsset(x) === "element") return true;
        return isRelevantMaterialForProduct(x, ctx);
      });
      /* Task 35: Links / ELEMENTY poza glowna lista "Skojarzone materialy" */
      var materials = [];
      var elements = [];
      hits.forEach(function (x) {
        if (classifyAssocAsset(x) === "element") elements.push(x);
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
      sortHits(elements);
      if (labelEl) labelEl.textContent = "Skojarzone materiały (" + materials.length + ")";
      if (!materials.length) {
        mount.innerHTML = '<p class="dam-media-preview__assoc-empty">Brak skojarzonych materiałów</p>';
      } else {
        var shown = materials.slice(0, 24);
        var collapsible = shown.length > LINKED_ASSETS_VISIBLE;
        mount.innerHTML =
          shown
            .map(function (x, i) {
              return linkedBrandingCardHtml(x, i, collapsible && i >= LINKED_ASSETS_VISIBLE);
            })
            .join("") +
          (collapsible
            ? '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-media-preview__variants-toggle" data-linked-assets-toggle aria-expanded="false">' +
              '<i class="uil uil-angle-down" aria-hidden="true"></i><span>Pokaż wszystkie (' +
              shown.length +
              ")</span></button>"
            : "");
        if (collapsible) mount.classList.add("is-collapsed-assets");
        else mount.classList.remove("is-collapsed-assets");
        bindLinkedAssetClicks(mount, shown, "data-linked-asset-idx");
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
            if (lbl) lbl.textContent = next ? "Zwiń" : "Pokaż wszystkie (" + shown.length + ")";
            var m = document.getElementById("damMediaPreview");
            var shared = window.DamModalShared;
            if (m && shared && shared.scheduleFitChrome) shared.scheduleFitChrome(m);
          });
        }
      }
      renderElementyGroup(elementyHost, elements.slice(0, 40));
      renderResizerCta(resizerHost, ctx);
      var m = document.getElementById("damMediaPreview");
      var shared = window.DamModalShared;
      if (m && shared && shared.scheduleFitChrome) shared.scheduleFitChrome(m);
    });
  }

  function associationsFooterHtml(asset, groupContext, options) {
    options = options || {};
    var alwaysShow = options.alwaysShowAssociations !== false;
    var variants = (groupContext && groupContext.variants) || asset.folder_variants || [];
    var linked = (groupContext && groupContext.linked_products) || asset.linked_products || [];
    if (!linked.length && (asset.folder_linked_product_ids || asset.linked_product_ids)) {
      linked = (asset.linked_product_ids || []).map(function (pid) {
        return { id: pid, display_name: pid, thumb_url: "" };
      });
    }
    var variantsHtml = folderVariantsHtml(variants, asset.id);
    var isVizStudio = options.mode === "viz-studio";
    /* viz-studio: materialy ida do prawej kolumny modala (assoc-pane), tu tylko warianty. */
    if (isVizStudio && options.productContext) {
      if (!variants.length && !alwaysShow) return "";
      return '<div class="dam-media-preview__assoc dam-media-preview__assoc--variants-only">' + variantsHtml + "</div>";
    }
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
    return out;
  }

  /** Pliki zrodlowe (PSD/PSB/AI/…) inne niz aktualny podglad - do CTA obok Folder. */
  function sourceActionFiles(asset, groupContext) {
    var order = { psd: 0, psb: 1, ai: 2, indd: 3, eps: 4 };
    var byExt = {};
    editableFilesFor(asset, groupContext).forEach(function (f) {
      if (!f || !f.path) return;
      if (asset && asset.path && f.path === asset.path) return;
      var ext = splitNameExt(f.name || f.path).ext;
      if (!(ext in order)) return;
      // jeden przycisk na rozszerzenie (PSD / PSB / AI) - pierwszy z listy indeksu
      if (!byExt[ext]) byExt[ext] = f;
    });
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

  /** Klik / Enter na chipie ID = kopiuj WIDOCZNE id marketingowe (nigdy br-xxxxx). */
  function bindIdChipCopy(host) {
    if (!host) return;
    host.querySelectorAll(".dam-media-preview__asset-id").forEach(function (chip) {
      function doCopy(e) {
        e.preventDefault();
        e.stopPropagation();
        var mid = chip.getAttribute("data-marketing-id") || chip.textContent.trim();
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

  /** Jeden przycisk na rozszerzenie (PSD/PSB/AI) z dowolnej listy plikow zrodlowych. */
  function dedupeSourceFilesByExt(files) {
    var order = { psd: 0, psb: 1, ai: 2, indd: 3, eps: 4 };
    var byExt = {};
    (files || []).forEach(function (f) {
      if (!f || !f.path) return;
      var ext = splitNameExt(f.name || f.path).ext;
      if (!(ext in order)) return;
      if (!byExt[ext]) byExt[ext] = f;
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
    if (!thumbStage || !zoomBar) return;
    zoomBar.classList.add("is-docked");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dockedY = 30;

    function animateTo(y, duration) {
      if (reduceMotion) {
        zoomBar.style.transform = "translateX(-50%) translateY(" + y + "px)";
        return;
      }
      if (window.gsap) {
        window.gsap.to(zoomBar, {
          y: y,
          duration: duration || 0.3,
          ease: "power2.out",
          overwrite: true,
        });
        return;
      }
      zoomBar.style.transform = "translateX(-50%) translateY(" + y + "px)";
    }

    function showDock() {
      zoomBar.classList.remove("is-docked");
      animateTo(0, 0.3);
    }

    function hideDock() {
      zoomBar.classList.add("is-docked");
      animateTo(dockedY, 0.3);
    }

    if (window.gsap) {
      window.gsap.set(zoomBar, { xPercent: -50, y: dockedY });
    } else {
      zoomBar.style.transform = "translateX(-50%) translateY(" + dockedY + "px)";
    }

    thumbStage.addEventListener("mousemove", function (e) {
      var rect = thumbStage.getBoundingClientRect();
      var nearBottom = e.clientY >= rect.bottom - 52;
      if (nearBottom) showDock();
      else if (!zoomBar.matches(":hover")) hideDock();
    });
    thumbStage.addEventListener("mouseleave", hideDock);
    zoomBar.addEventListener("mouseenter", showDock);
    zoomBar.addEventListener("focusin", showDock);
    zoomBar.addEventListener("mouseleave", function () {
      hideDock();
    });
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.remove();
    document.body.classList.remove("dam-media-preview-open");
  }

  function openAsset(asset, options) {
    options = options || {};
    if (!asset) return;
    if (options.mode === "viz-studio") ensureVizModalCss();

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
      '<button type="button" class="geex-btn geex-btn--sm dam-btn-icon dam-viz-modal__cta dam-win-btn" id="damMediaPreviewExplorer" aria-label="Folder Windows" title="Folder Windows" data-dam-tip="Otwiera folder w Eksploratorze plikow Windows">' +
      (window.DamIcons && typeof window.DamIcons.winExplorerSvg === "function"
        ? window.DamIcons.winExplorerSvg()
        : '<i class="uil uil-folder" aria-hidden="true"></i>') +
      "<span>Folder</span></button>" +
      '<span id="damMediaPreviewSourceMount" class="dam-media-preview__source-mount" aria-label="Pliki zrodlowe"></span>' +
      '<button type="button" class="dam-viz-icon-btn" id="damMediaPreviewCopy" data-dam-tip="Kopiuje lokalna sciezke pliku" aria-label="Kopiuj sciezke" title="Kopiuj sciezke">' +
      '<i class="uil uil-copy" aria-hidden="true"></i></button>' +
      '<button type="button" class="dam-viz-icon-btn' +
      (syEnabled ? "" : " is-disabled") +
      '" id="damMediaPreviewShare" aria-label="Udostepnij" title="' +
      esc(shareTitle) +
      '" data-dam-tip="' +
      esc(shareTitle) +
      '"' +
      (syEnabled ? "" : " disabled") +
      '><i class="uil uil-share-alt" aria-hidden="true"></i></button>' +
      "</div></div>";
    var bodyInnerHtml =
      '<div class="dam-viz-card__badges" id="damMediaPreviewBadges"></div>' +
      '<div class="dam-media-preview__title-block">' +
      '<div class="dam-media-preview__title-row">' +
      '<h4 class="dam-viz-modal__title" id="damMediaPreviewTitle"></h4>' +
      '<div id="damMediaPreviewTitleMeta"></div>' +
      "</div></div>" +
      '<div id="damMediaPreviewQuality" class="dam-media-preview__quality" role="group" aria-label="Jakość / kompresja" hidden></div>' +
      '<div id="damMediaPreviewStudio" class="dam-media-preview__studio" hidden></div>' +
      '<div id="damMediaPreviewAssoc"></div>' +
      actionsHtml;
    var thumbHtml =
      '<div class="dam-viz-modal__thumb" id="damMediaPreviewThumb">' +
      '<div class="dam-viz-modal__zoom dam-media-preview__zoom" role="group" aria-label="Przyblizenie" data-dam-tip="CTRL+scroll lub ALT+scroll: zoom. Przy przyblizeniu: przeciagnij, zeby przesunac.">' +
      navPrev +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewZoomOut" aria-label="Pomniejsz"><i class="uil uil-search-minus"></i></button>' +
      '<span class="dam-viz-modal__zoom-label" id="damMediaPreviewZoomLabel">100%</span>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewZoomIn" aria-label="Powieksz"><i class="uil uil-search-plus"></i></button>' +
      '<button type="button" class="dam-viz-modal__zoom-btn" id="damMediaPreviewZoomReset" aria-label="Reset"><i class="uil uil-search"></i></button>' +
      navNext +
      "</div>" +
      "</div>";
    var assocPaneHtml = isVizStudioLayout
      ? '<aside class="dam-viz-modal__assoc-pane" aria-label="Skojarzone materiały">' +
        linkedBrandingColumnHtml() +
        "</aside>"
      : "";
    var boxInner = isVizStudioLayout
      ? '<div class="dam-viz-modal__main">' +
        thumbHtml +
        '<div class="dam-viz-modal__body">' +
        bodyInnerHtml +
        "</div></div>" +
        assocPaneHtml
      : thumbHtml + '<div class="dam-viz-modal__body">' + bodyInnerHtml + "</div>";
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
      ["damMediaPreviewExplorer", "damMediaPreviewCopy", "damMediaPreviewShare"].forEach(function (id) {
        var btn = document.getElementById(id);
        if (btn) btn.setAttribute("data-path", path || "");
      });
    }

    var VIZ_PERSP_ORDER = ["ENFACE", "FRONT", "BACK", "SIDE", "TOP", "3_4", "OTHER"];

    /** FAZA 3: switch tla + perspektywa + jezyk (tryb viz-studio / assety WIZKI). */
    function renderVizStudioControls(a) {
      var host = document.getElementById("damMediaPreviewStudio");
      if (!host) return;
      host.hidden = true;
      host.innerHTML = "";
      var mode = options.mode || "";
      var studio = options.vizStudio || null;
      var items = (studio && studio.items) || [];
      if (!items.length && mode !== "viz-studio") {
        // Branding assets with bg metadata can still offer a simple bg switch
        var hasBgMeta = a && (a.bg || a.background);
        if (!hasBgMeta) return;
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

      var curPath = String(a.path || "").toLowerCase().replace(/\\/g, "/");
      var cur =
        items.find(function (it) {
          return String((it.file && it.file.path) || "").toLowerCase().replace(/\\/g, "/") === curPath;
        }) || items[0];
      var state = {
        bg: cur.bg || "z-tlem",
        persp: cur.persp || "",
        lang: cur.lang || "",
      };

      function filtered() {
        return items.filter(function (it) {
          return (
            (!state.bg || it.bg === state.bg) &&
            (!state.persp || it.persp === state.persp) &&
            (!state.lang || it.lang === state.lang)
          );
        });
      }

      function bgList() {
        var seen = {};
        items.forEach(function (it) {
          if (it.bg) seen[it.bg] = true;
        });
        return Object.keys(seen);
      }

      function perspList() {
        var seen = {};
        items.forEach(function (it) {
          if (it.bg === state.bg && (!state.lang || it.lang === state.lang) && it.persp) {
            seen[it.persp] = true;
          }
        });
        return VIZ_PERSP_ORDER.filter(function (p) {
          return seen[p];
        }).concat(
          Object.keys(seen).filter(function (p) {
            return VIZ_PERSP_ORDER.indexOf(p) < 0;
          })
        );
      }

      function langList() {
        var seen = {};
        items.forEach(function (it) {
          if (it.bg === state.bg && it.lang) seen[it.lang] = true;
        });
        return Object.keys(seen).sort();
      }

      function applySelection() {
        var list = filtered();
        var pick = list[0];
        if (!pick && items.length) pick = items[0];
        if (!pick) return;
        var targetIdx =
          typeof pick.siblingIndex === "number"
            ? pick.siblingIndex
            : siblings.findIndex(function (s) {
                return (
                  String(s.path || "").toLowerCase().replace(/\\/g, "/") ===
                  String((pick.file && pick.file.path) || "").toLowerCase().replace(/\\/g, "/")
                );
              });
        if (targetIdx >= 0) showAt(targetIdx);
      }

      function paint() {
        var bgs = bgList();
        var persps = perspList();
        var langs = langList();
        var html = "";
        /* Chipy studia = globalny styl tagow (dam-viz-badge); etykiety pelnymi slowami.
           Rozszerzenie po kropce srodkowej w JEDNEJ linii: "Z tlem • JPG". */
        var chipCls = "dam-viz-badge dam-media-preview__studio-chip";
        if (bgs.length > 1) {
          html +=
            '<div class="dam-media-preview__studio-row" role="group" aria-label="Tło">' +
            '<span class="dam-media-preview__studio-label">Tło:</span>';
          bgs.forEach(function (bg) {
            var label = bg === "bez-tla" ? "Bez tła" : "Z tłem";
            var sub = bg === "bez-tla" ? "PNG" : "JPG";
            html +=
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
          html += "</div>";
        }
        if (persps.length > 1) {
          html +=
            '<div class="dam-media-preview__studio-row" role="group" aria-label="Perspektywa">' +
            '<span class="dam-media-preview__studio-label">Perspektywa:</span>';
          persps.forEach(function (p) {
            html +=
              '<button type="button" class="' +
              chipCls +
              (p === state.persp ? " is-active" : "") +
              '" data-studio-persp="' +
              esc(p) +
              '">' +
              esc(p) +
              "</button>";
          });
          html += "</div>";
        }
        if (langs.length > 1) {
          html +=
            '<div class="dam-media-preview__studio-row" role="group" aria-label="Język">' +
            '<span class="dam-media-preview__studio-label">Język:</span>';
          langs.forEach(function (l) {
            html +=
              '<button type="button" class="' +
              chipCls +
              (l === state.lang ? " is-active" : "") +
              '" data-studio-lang="' +
              esc(l) +
              '">' +
              esc(String(l).toUpperCase()) +
              "</button>";
          });
          html += "</div>";
        }
        if (!html) {
          host.hidden = true;
          host.innerHTML = "";
          return;
        }
        host.innerHTML = html;
        host.hidden = false;
        host.querySelectorAll("[data-studio-bg]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            state.bg = btn.getAttribute("data-studio-bg") || state.bg;
            var nextPersps = perspList();
            if (nextPersps.indexOf(state.persp) < 0) state.persp = nextPersps[0] || "";
            applySelection();
          });
        });
        host.querySelectorAll("[data-studio-persp]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            state.persp = btn.getAttribute("data-studio-persp") || state.persp;
            applySelection();
          });
        });
        host.querySelectorAll("[data-studio-lang]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            state.lang = btn.getAttribute("data-studio-lang") || state.lang;
            applySelection();
          });
        });
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
      if (title) title.innerHTML = titleHtml(a.name, a.id);
      if (titleMeta) {
        titleMeta.innerHTML = titleMetaHtml(a, options);
        bindIdChipCopy(titleMeta);
      }
      if (sourceMount) {
        sourceMount.innerHTML = sourceFileActionHtml(a, groupContext);
        bindSourceButtons(sourceMount);
        if (!sourceMount.firstChild) renderSourceFallback(a, sourceMount);
      }
      renderQualityPills(a);
      renderVizStudioControls(a);
      if (assocHost) {
        var paintAssoc = function () {
          assocHost.innerHTML = associationsFooterHtml(a, groupContext, options);
          renderLinkedBrandingAssets(options);
          assocHost.querySelectorAll("[data-variant-id]").forEach(function (btn) {
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
                var total = grid.querySelectorAll("[data-variant-id]").length;
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
          if (shared && shared.scheduleFitChrome) shared.scheduleFitChrome(modal);
        };
        if (window.DamAssocEdit && typeof window.DamAssocEdit.enrichLinkedProducts === "function") {
          window.DamAssocEdit.enrichLinkedProducts(seedLinkedProducts(a, groupContext)).then(function (linked) {
            groupContext.linked_products = linked;
            a.linked_products = linked;
            paintAssoc();
          });
        } else {
          paintAssoc();
        }
      }
      if (badges) {
        badges.innerHTML = badgesHtml(a);
        if (window.DamBadges && typeof window.DamBadges.bindClicks === "function") {
          window.DamBadges.bindClicks(badges, "branding");
        }
      }
      var goProduct = document.getElementById("damMediaPreviewGoProduct");
      var explorer = document.getElementById("damMediaPreviewExplorer");
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
        var p = explorerBtn.getAttribute("data-path") || "";
        if (window.DamPaths && typeof window.DamPaths.revealInExplorer === "function") {
          window.DamPaths.revealInExplorer(p);
        } else if (window.DamPaths && typeof window.DamPaths.openFolderInExplorer === "function") {
          window.DamPaths.openFolderInExplorer(p);
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
    readPct: readCardZoomPct,
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
    if (document.getElementById("dam-viz-modal-css")) return;
    var link = document.createElement("link");
    link.id = "dam-viz-modal-css";
    link.rel = "stylesheet";
    link.href = "assets/css/dam-viz-modal.css?v=vizassoc20260720c";
    document.head.appendChild(link);
  }

  window.DamMediaPreview = {
    openAsset: openAsset,
    /* Pkt 6/7: pozwala innym modulom (dam-viz) osadzic "Skojarzone materialy" */
    renderLinkedAssetsInto: function (mount, labelEl, productContext) {
      renderLinkedBrandingAssets({ mount: mount, labelEl: labelEl, productContext: productContext });
    },
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
