/**
 * Marketing asset ID — czytelny format M-{TYP}{nrTypu}{id}-{MM}-{RR}.
 * Wewnętrzny klucz br-XXXXXX pozostaje w data-* / indeksie.
 */
(function () {
  "use strict";

  var TYPE_DEFS = [
    { code: "VID", num: 6, test: isVideo },
    { code: "SLI", num: 5, test: isSlider },
    { code: "GOG", num: 8, test: isGoogle },
    { code: "META", num: 7, test: isMeta },
    { code: "SHOP", num: 4, test: isShop },
    { code: "BAN", num: 3, test: isBanner },
    { code: "GIF", num: 9, test: isGif },
    { code: "KV", num: 1, test: isKeyVisual },
    { code: "IMG", num: 2, test: always },
  ];

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function blob(asset) {
    return norm(
      [
        asset && asset.name,
        asset && asset.path,
        asset && asset.asset_role,
        asset && asset.media_type,
        (asset && asset.appearance_tags && asset.appearance_tags.join(" ")) || "",
        (asset && asset.tags && asset.tags.join(" ")) || "",
      ].join(" ")
    );
  }

  function always() {
    return true;
  }

  function isVideo(asset) {
    if (!asset) return false;
    if (asset.media_type === "video") return true;
    return /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(asset.name || asset.path || "");
  }

  function isSlider(asset) {
    var b = blob(asset);
    return /slider|karuzel|carousel/.test(b);
  }

  function isGoogle(asset) {
    var b = blob(asset);
    return /\bdv360\b|google ads|google_ads|display.?video|gog\b/.test(b);
  }

  function isMeta(asset) {
    var b = blob(asset);
    return /\bmeta\b|facebook ads|instagram ads|fb ads/.test(b);
  }

  function isShop(asset) {
    var b = blob(asset);
    return /\bsklep\b|\bshop\b|e-?commerce|woo/.test(b);
  }

  function isBanner(asset) {
    var b = blob(asset);
    if (/baner|banner|billboard|skyscraper|leaderboard/.test(b)) return true;
    return asset && asset.asset_role === "banner";
  }

  function isGif(asset) {
    return /\.gif$/i.test((asset && asset.name) || "") || (asset && asset.media_type === "gif");
  }

  function isKeyVisual(asset) {
    if (!asset) return false;
    if (asset.asset_role === "key_visual") return true;
    return /key.?visual|keyvisual|kv\b/.test(blob(asset));
  }

  function resolveType(asset) {
    for (var i = 0; i < TYPE_DEFS.length; i++) {
      if (TYPE_DEFS[i].test(asset)) return TYPE_DEFS[i];
    }
    return TYPE_DEFS[TYPE_DEFS.length - 1];
  }

  function parseBrDigits(id) {
    var m = /^br-(\d+)$/i.exec(String(id || "").trim());
    return m ? m[1] : "";
  }

  function extractMonthYear(asset) {
    var path = String((asset && asset.path) || "").replace(/\\/g, "/");
    var parts = path.split("/").filter(Boolean);
    var year = "";
    var month = "";

    parts.forEach(function (p) {
      if (/^20\d{2}$/.test(p)) year = p;
    });

    parts.forEach(function (p) {
      var m = /^(\d{2})[_-]/.exec(p);
      if (m && !month) month = m[1];
    });

    if (!month && asset && asset.campaign_id) {
      var cm = /^(\d{4})-(\d{2})/.exec(String(asset.campaign_id));
      if (cm) {
        if (!year) year = cm[1];
        month = cm[2];
      }
    }

    if (!month && asset && asset.mtime) {
      var d = new Date(asset.mtime);
      if (!isNaN(d.getTime())) {
        month = String(d.getMonth() + 1).padStart(2, "0");
        if (!year) year = String(d.getFullYear());
      }
    }

    if (!month) month = "01";
    var yy = year ? year.slice(-2) : "00";
    return { month: month, year: yy };
  }

  function formatMarketingAssetId(assetOrId, assetOptional) {
    var asset = typeof assetOrId === "object" && assetOrId ? assetOrId : assetOptional || null;
    var rawId = typeof assetOrId === "string" ? assetOrId : asset && asset.id;
    var digits = parseBrDigits(rawId);
    if (!digits) return rawId || "";

    var type = resolveType(asset || { id: rawId });
    var core = String(type.num) + digits.slice(1);
    var when = extractMonthYear(asset || { id: rawId, path: "" });

    return "M-" + type.code + core + "-" + when.month + "-" + when.year;
  }

  window.DamMarketingId = {
    format: formatMarketingAssetId,
    resolveType: resolveType,
    parseBrDigits: parseBrDigits,
  };
})();
