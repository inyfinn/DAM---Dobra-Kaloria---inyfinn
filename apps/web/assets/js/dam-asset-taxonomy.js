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
    transparent: "Tło przezroczyste",
    white: "Tło białe",
    editable: "Edytowalny",
  };

  /** Kontrolowany slownik asset_role (kod EN → etykieta PL). Nowe role tylko przez ADR. */
  var ASSET_ROLE_LABELS = {
    brand_asset: "Materiał marki",
    document_spec: "Karta wprowadzenia",
    product_photo: "Zdjęcie produktowe",
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
    return m === "image" || m === "vector" || m === "source" || m === "video";
  }

  global.DamAssetTaxonomy = {
    MEDIA_TYPE_LABELS: MEDIA_TYPE_LABELS,
    FORMAT_TECH_LABELS: FORMAT_TECH_LABELS,
    ASSET_ROLE_LABELS: ASSET_ROLE_LABELS,
    ASSET_ROLE_ORDER: ASSET_ROLE_ORDER,
    normalizeMediaType: normalizeMediaType,
    mediaTypeLabel: mediaTypeLabel,
    formatTechLabel: formatTechLabel,
    assetRoleLabel: assetRoleLabel,
    assetRoleOptions: assetRoleOptions,
    isGraphicMediaType: isGraphicMediaType,
  };
})(typeof window !== "undefined" ? window : globalThis);
