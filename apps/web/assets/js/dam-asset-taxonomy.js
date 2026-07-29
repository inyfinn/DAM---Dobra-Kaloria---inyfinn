/**
 * DAM Branding — taksonomia IPTC (3 osie). Etykiety ZAWSZE po polsku w UI.
 */
(function (global) {
  "use strict";

  var MEDIA_TYPE_LABELS = {
    image: "Obraz",
    raster: "Obraz",
    vector: "Wektor",
    video: "Wideo",
    source: "Źródło",
    document: "Dokument",
  };

  var FORMAT_TECH_LABELS = {
    raster: "Raster",
    transparent: "Przezroczyste tło",
    white: "Tło białe",
    editable: "Edytowalny",
  };

  /** Kontrolowany slownik asset_role (kod EN → etykieta PL). Nowe role tylko przez ADR. */
  var ASSET_ROLE_LABELS = {
    brand_asset: "Materiał marki",
    document_spec: "Karta wprowadzenia",
    product_photo: "Zdjęcie produktówe",
    artwork_source: "Plik roboczy artwork",
    print_ready: "Plik do druku",
    packshot: "Wizualizacja opakowania",
    packaging_die: "Wykrojnik",
    bulk_packaging_spec: "Spec. opak. zbiorczego",
    mockup_template: "Szablon mockupu",
    private_label_artwork: "Artwork marki własnej",
    pos_material: "Materiał POS",
    outdoor_material: "Reklama zewnętrzna",
    social_video: "Wideo social",
    social_asset: "Asset social",
    web_banner: "Baner WWW",
    web_bundle_tile: "Kafel zestawu",
    web_product_tile: "Kafel produktu",
    web_hero_slider: "Slider główny",
    ecommerce_ad: "Reklama e-commerce",
    key_visual: "Key visual kampanii",
    icon: "Ikona",
  };

  var ASSET_ROLE_ORDER = [
    "packshot",
    "key_visual",
    "brand_asset",
    "product_photo",
    "social_video",
    "social_asset",
    "web_hero_slider",
    "web_banner",
    "web_product_tile",
    "web_bundle_tile",
    "ecommerce_ad",
    "pos_material",
    "outdoor_material",
    "document_spec",
    "print_ready",
    "artwork_source",
    "packaging_die",
    "bulk_packaging_spec",
    "mockup_template",
    "private_label_artwork",
    "icon",
  ];

  /** Niższa liczba = wyżej w siatce (częściej używane materiały najpierw). */
  var DISPLAY_PRIORITY = {
    ecommerce_ad: 1,
    web_banner: 1,
    web_hero_slider: 1,
    web_product_tile: 1,
    web_bundle_tile: 1,
    social_asset: 1,
    key_visual: 2,
    packshot: 2,
    pos_material: 2,
    outdoor_material: 2,
    product_photo: 3,
    social_video: 3,
    brand_asset: 3,
    artwork_source: 3,
    print_ready: 3,
    document_spec: 4,
    packaging_die: 4,
    bulk_packaging_spec: 4,
    mockup_template: 4,
    private_label_artwork: 4,
    icon: 4,
  };

  function displayPriority(roleOrAsset) {
    var code =
      typeof roleOrAsset === "string"
        ? roleOrAsset
        : (roleOrAsset && roleOrAsset.asset_role) || "";
    var mt =
      typeof roleOrAsset === "object" && roleOrAsset
        ? String(roleOrAsset.media_type || "").toLowerCase()
        : "";
    if (DISPLAY_PRIORITY[code] != null) return DISPLAY_PRIORITY[code];
    if (mt === "video") return 3;
    return 5;
  }

  function normalizeMediaType(mt) {
    var m = String(mt || "").toLowerCase();
    if (m === "raster") return "image";
    return m || "image";
  }

  function mediaTypeLabel(mt) {
    return MEDIA_TYPE_LABELS[normalizeMediaType(mt)] || MEDIA_TYPE_LABELS.image;
  }

  function formatTechLabel(code) {
    return FORMAT_TECH_LABELS[code] || code;
  }

  function assetRoleLabel(code) {
    return ASSET_ROLE_LABELS[code] || String(code || "").replace(/_/g, " ");
  }

  function assetRoleOptions(currentCode) {
    var cur = String(currentCode || "").trim();
    var seen = {};
    var list = [];
    ASSET_ROLE_ORDER.forEach(function (code) {
      if (seen[code]) return;
      seen[code] = true;
      list.push({
        code: code,
        label: assetRoleLabel(code),
        search: (code + " " + assetRoleLabel(code)).toLowerCase(),
      });
    });
    if (cur && !seen[cur]) {
      list.unshift({
        code: cur,
        label: assetRoleLabel(cur),
        search: (cur + " " + assetRoleLabel(cur)).toLowerCase(),
      });
    }
    return list;
  }

  function isGraphicMediaType(mt) {
    var m = normalizeMediaType(mt);
    /* source != gotowa grafika (osobny tag Zrodlo); video osobno */
    return m === "image" || m === "vector";
  }

  /** PNG/WebP bez skanu pikseli — tymczasowo traktuj jako przezroczyste (do dopracowania). */
  var ALPHA_RASTER_EXT = /\.(png|webp)$/i;

  function effectiveBackground(asset) {
    if (!asset) return null;
    var bg = asset.background;
    if (bg === "white" || bg === "transparent") return bg;
    var fts = asset.format_technical || [];
    if (fts.indexOf("white") !== -1) return "white";
    if (fts.indexOf("transparent") !== -1) return "transparent";
    var name = String(asset.name || asset.path || "");
    if (ALPHA_RASTER_EXT.test(name) && normalizeMediaType(asset.media_type) === "image") {
      return "transparent";
    }
    return bg || null;
  }

  function isEffectiveTransparent(asset) {
    return effectiveBackground(asset) === "transparent";
  }

  function isEffectiveWhite(asset) {
    return effectiveBackground(asset) === "white";
  }

  global.DamAssetTaxonomy = {
    MEDIA_TYPE_LABELS: MEDIA_TYPE_LABELS,
    FORMAT_TECH_LABELS: FORMAT_TECH_LABELS,
    ASSET_ROLE_LABELS: ASSET_ROLE_LABELS,
    ASSET_ROLE_ORDER: ASSET_ROLE_ORDER,
    DISPLAY_PRIORITY: DISPLAY_PRIORITY,
    normalizeMediaType: normalizeMediaType,
    mediaTypeLabel: mediaTypeLabel,
    formatTechLabel: formatTechLabel,
    assetRoleLabel: assetRoleLabel,
    assetRoleOptions: assetRoleOptions,
    displayPriority: displayPriority,
    isGraphicMediaType: isGraphicMediaType,
    effectiveBackground: effectiveBackground,
    isEffectiveTransparent: isEffectiveTransparent,
    isEffectiveWhite: isEffectiveWhite,
  };
})(typeof window !== "undefined" ? window : globalThis);
